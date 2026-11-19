import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import nodemailer, { Transporter } from 'nodemailer';

export interface Mail {
    to: string;
    subject: string;
    html: string;
    text: string;
}

type Mode = 'smtp' | 'resend' | 'file';

/**
 * Sends price-alert email. The first configured option wins:
 *
 *   smtp   - any SMTP account; free with Gmail (~500 emails/day):
 *              SMTP_USER=you@gmail.com
 *              SMTP_PASS=<16-char Google App Password>   (needs 2-Step Verification)
 *              SMTP_HOST / SMTP_PORT                     (default smtp.gmail.com / 465)
 *   resend - RESEND_API_KEY (+ EMAIL_FROM on a domain verified in Resend)
 *   file   - nothing configured: each email is saved as .html in backend/dev-emails/
 *
 * EMAIL_FROM sets the sender name/address, e.g. "Спореди и купи <you@gmail.com>"
 * (with Gmail it should be the same address as SMTP_USER).
 */
@Injectable()
export class MailService implements OnModuleInit {
    private readonly log = new Logger(MailService.name);
    private readonly smtpUser = process.env.SMTP_USER || '';
    private readonly smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, ''); // Google shows it in groups of 4
    private readonly resendKey = process.env.RESEND_API_KEY || '';
    private readonly devDir = join(process.cwd(), 'dev-emails');
    private smtp: Transporter | null = null;

    get mode(): Mode {
        if (this.smtpUser && this.smtpPass) return 'smtp';
        if (this.resendKey) return 'resend';
        return 'file';
    }

    private get from(): string {
        if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
        return this.mode === 'smtp' ? `Спореди и купи <${this.smtpUser}>` : 'Спореди и купи <onboarding@resend.dev>';
    }

    async onModuleInit() {
        if (this.mode === 'smtp') {
            const port = parseInt(process.env.SMTP_PORT || '465', 10);
            this.smtp = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port,
                secure: port === 465,
                auth: { user: this.smtpUser, pass: this.smtpPass },
            });
            try {
                await this.smtp.verify();
                this.log.log(`Email: SMTP as ${this.smtpUser} (login OK)`);
            } catch (e) {
                this.log.error(`Email: SMTP login for ${this.smtpUser} failed: ${(e as Error).message}`);
            }
        } else {
            this.log.log(this.mode === 'resend' ? 'Email: Resend API' : `Email: saved as files in ${this.devDir}`);
        }
    }

    async send(mail: Mail): Promise<boolean> {
        if (this.mode === 'smtp') return this.sendSmtp(mail);
        if (this.mode === 'resend') return this.sendResend(mail);
        return this.saveToFile(mail);
    }

    private async sendSmtp(mail: Mail): Promise<boolean> {
        try {
            await this.smtp!.sendMail({ from: this.from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
            this.log.log(`Email "${mail.subject}" sent to ${mail.to}`);
            return true;
        } catch (e) {
            this.log.warn(`Email to ${mail.to} failed: ${(e as Error).message}`);
            return false;
        }
    }

    private async sendResend(mail: Mail): Promise<boolean> {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.resendKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: this.from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
                signal: AbortSignal.timeout(15_000),
            });
            if (!res.ok) {
                this.log.warn(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
                return false;
            }
            return true;
        } catch (e) {
            this.log.warn(`Email to ${mail.to} failed: ${(e as Error).message}`);
            return false;
        }
    }

    private async saveToFile(mail: Mail): Promise<boolean> {
        await mkdir(this.devDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = join(this.devDir, `${stamp}-${mail.to.replace(/[^a-z0-9]+/gi, '_')}.html`);
        await writeFile(file, `<!-- To: ${mail.to}\n     Subject: ${mail.subject} -->\n${mail.html}`, 'utf8');
        this.log.log(`[dev email] "${mail.subject}" to ${mail.to} -> ${file}`);
        return true;
    }
}
