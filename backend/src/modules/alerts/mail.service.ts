import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export interface Mail {
    to: string;
    subject: string;
    html: string;
    text: string;
}

/**
 * Sends email through Resend's HTTP API when RESEND_API_KEY is set; otherwise (local development)
 * writes each email as an .html file to backend/dev-emails/ so it can be opened in a browser.
 *
 *   RESEND_API_KEY   from resend.com (free tier)
 *   EMAIL_FROM       e.g. "Спореди и купи <alerts@yourdomain.mk>" (domain verified in Resend)
 */
@Injectable()
export class MailService {
    private readonly log = new Logger(MailService.name);
    private readonly apiKey = process.env.RESEND_API_KEY || '';
    private readonly from = process.env.EMAIL_FROM || 'Спореди и купи <onboarding@resend.dev>';
    private readonly devDir = join(process.cwd(), 'dev-emails');

    get mode(): 'resend' | 'file' {
        return this.apiKey ? 'resend' : 'file';
    }

    async send(mail: Mail): Promise<boolean> {
        if (this.mode === 'file') return this.saveToFile(mail);
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
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
