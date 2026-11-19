import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AlertType, PriceAlert } from '../../database/entities/price-alert.entity';
import { MailService } from './mail.service';
import { AlertMailContext, confirmMail, priceMail } from './templates';

const MAX_ACTIVE_PER_EMAIL = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface CreateAlertInput {
    productId: string;
    type: AlertType;
    targetPrice?: number | null;
    email?: string;
    lang?: string;
}

interface ProductInfo {
    id: string;
    name: string;
    image: string | null;
    minPrice: number | null;
}

/**
 * Price alerts on a product's lowest price (products.minPrice, i.e. the cheapest store).
 * Checked after every scrape; see evaluate().
 */
@Injectable()
export class AlertsService {
    private readonly log = new Logger(AlertsService.name);
    private readonly frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

    constructor(
        @InjectRepository(PriceAlert) private readonly alerts: Repository<PriceAlert>,
        private readonly mail: MailService,
        private readonly dataSource: DataSource,
    ) {}

    // ------------------------------------------------------------------ create / manage

    async create(input: CreateAlertInput, user: { id: number; email: string } | null) {
        const type: AlertType = input.type === 'change' ? 'change' : 'target';
        const product = await this.product(input.productId);
        if (!product) throw new NotFoundException('Product not found');

        let targetPrice: number | null = null;
        if (type === 'target') {
            targetPrice = Math.round(Number(input.targetPrice));
            if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 1_000_000) {
                throw new BadRequestException('Invalid target price');
            }
        }

        const email = (user?.email || input.email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email.length > 200) throw new BadRequestException('Invalid email');
        const lang = input.lang === 'en' ? 'en' : 'mk';

        // One alert per email + product + type: setting it again just updates it.
        const existing = await this.alerts.findOne({ where: { email, productId: product.id, type, active: true } });
        if (existing) {
            existing.targetPrice = targetPrice;
            existing.triggered = false;
            existing.lastPrice = product.minPrice;
            existing.lang = lang;
            if (user) {
                existing.userId = user.id;
                existing.confirmed = true;
            }
            await this.alerts.save(existing);
            if (!existing.confirmed) await this.sendConfirmation(existing, product);
            return { id: existing.id, status: existing.confirmed ? 'active' : 'confirm-email', updated: true };
        }

        const activeCount = await this.alerts.count({ where: { email, active: true } });
        if (activeCount >= MAX_ACTIVE_PER_EMAIL) throw new BadRequestException(`At most ${MAX_ACTIVE_PER_EMAIL} alerts per email`);

        const alert = await this.alerts.save(
            this.alerts.create({
                token: randomBytes(24).toString('hex'),
                productId: product.id,
                userId: user?.id ?? null,
                email,
                type,
                targetPrice,
                lastPrice: product.minPrice,
                // Logged-in users already proved their email; guests confirm by email (no spamming others).
                confirmed: !!user,
                lang,
            }),
        );
        if (!alert.confirmed) await this.sendConfirmation(alert, product);
        return { id: alert.id, status: alert.confirmed ? 'active' : 'confirm-email', updated: false };
    }

    async byToken(token: string) {
        const alert = await this.alerts.findOne({ where: { token } });
        if (!alert) throw new NotFoundException('Alert not found');
        const product = await this.product(alert.productId);
        return { alert, product };
    }

    async confirm(token: string) {
        const { alert, product } = await this.byToken(token);
        if (!alert.active) return { status: 'unsubscribed', productId: alert.productId, productName: product?.name };
        if (!alert.confirmed) {
            alert.confirmed = true;
            alert.lastPrice = product?.minPrice ?? alert.lastPrice;
            await this.alerts.save(alert);
        }
        return { status: 'confirmed', type: alert.type, targetPrice: alert.targetPrice, productId: alert.productId, productName: product?.name };
    }

    async unsubscribe(token: string) {
        const { alert, product } = await this.byToken(token);
        if (alert.active) {
            alert.active = false;
            await this.alerts.save(alert);
        }
        return { status: 'unsubscribed', productId: alert.productId, productName: product?.name };
    }

    /** The logged-in user's alerts, newest first, with the product's current lowest price. */
    listForUser(userId: number) {
        return this.dataSource.query(
            `SELECT a.id, a.type, a."targetPrice", a."createdAt", a."lastNotifiedAt",
                    p.id AS "productId", p.name AS "productName", p.image AS "productImage", p."minPrice"
             FROM price_alerts a JOIN products p ON p.id = a."productId"
             WHERE a."userId" = $1 AND a.active
             ORDER BY a."createdAt" DESC`,
            [userId],
        );
    }

    async removeForUser(userId: number, id: number) {
        const res = await this.alerts.update({ id, userId, active: true }, { active: false });
        if (!res.affected) throw new NotFoundException('Alert not found');
        return { status: 'deleted' };
    }

    // ------------------------------------------------------------------ nightly check

    /**
     * Run after each scrape. Compares every live alert with the product's current lowest price:
     *   target - notify once when price <= target; re-arm when the price goes back above it
     *   change - notify whenever the lowest price differs from the last one we told them about
     */
    async evaluate(): Promise<{ checked: number; sent: number }> {
        const rows: Array<PriceAlert & { name: string; image: string | null; minPrice: number | null }> =
            await this.dataSource.query(
                `SELECT a.*, p.name, p.image, p."minPrice"
                 FROM price_alerts a JOIN products p ON p.id = a."productId"
                 WHERE a.active AND a.confirmed`,
            );
        let sent = 0;
        for (const a of rows) {
            const price = a.minPrice;
            if (price == null) continue; // not on sale anywhere right now: nothing to report

            let notify = false;
            const update: Partial<PriceAlert> = {};
            if (a.type === 'target') {
                if (price <= (a.targetPrice ?? 0) && !a.triggered) {
                    notify = true;
                    update.triggered = true;
                } else if (price > (a.targetPrice ?? 0) && a.triggered) {
                    update.triggered = false; // re-arm
                }
            } else if (a.lastPrice != null && price !== a.lastPrice) {
                notify = true;
            }
            if (a.lastPrice !== price) update.lastPrice = price;

            if (notify) {
                const ok = await this.mail.send(priceMail(this.mailContext(a, { id: a.productId, name: a.name, image: a.image, minPrice: price }), a.lastPrice, price));
                if (ok) {
                    sent++;
                    update.lastNotifiedAt = new Date();
                } else {
                    // Keep the old state so the next run retries.
                    delete update.triggered;
                    delete update.lastPrice;
                }
            }
            if (Object.keys(update).length) await this.alerts.update({ id: a.id }, update);
        }
        if (sent) this.log.log(`Price alerts: ${sent} email(s) sent, ${rows.length} alert(s) checked`);
        return { checked: rows.length, sent };
    }

    // ------------------------------------------------------------------ helpers

    private async product(id: string): Promise<ProductInfo | null> {
        const [p] = await this.dataSource.query(`SELECT id, name, image, "minPrice" FROM products WHERE id = $1`, [id]);
        return p || null;
    }

    private mailContext(a: PriceAlert, p: ProductInfo): AlertMailContext {
        return {
            lang: a.lang,
            to: a.email,
            productName: p.name,
            productImage: p.image,
            productUrl: `${this.frontendUrl}/product/${p.id}${a.lang === 'en' ? '?lang=en' : ''}`,
            unsubscribeUrl: `${this.frontendUrl}/alerts/unsubscribe/${a.token}`,
            type: a.type,
            targetPrice: a.targetPrice,
        };
    }

    private async sendConfirmation(a: PriceAlert, p: ProductInfo) {
        await this.mail.send(confirmMail(this.mailContext(a, p), `${this.frontendUrl}/alerts/confirm/${a.token}`));
    }
}
