import axios, { AxiosInstance } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { Logger } from '@nestjs/common';

const client: AxiosInstance = axios.create({
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: 16 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 16 }),
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)',
        'Accept-Language': 'mk,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml',
    },
    responseType: 'text',
    maxRedirects: 5,
    decompress: true,
});

const log = new Logger('HttpFetch');

/**
 * GET a page as text with keep-alive, retries (timeouts, 429, 5xx) and anti-bot detection.
 * Returns null instead of throwing so one bad page never stops a crawl.
 */
export async function fetchHtml(url: string, timeoutMs = 30_000, retries = 2): Promise<string | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await client.get<string>(url, { timeout: timeoutMs, validateStatus: () => true });
            if (res.status === 200) {
                const body = String(res.data);
                if (isBotChallenge(body)) {
                    log.warn(`Blocked by anti-bot challenge: ${url}`);
                    return null;
                }
                return body;
            }
            if (res.status === 404 || res.status === 410) return null;
            if (res.status !== 429 && res.status < 500) {
                log.warn(`HTTP ${res.status}: ${url}`);
                return null;
            }
        } catch (e) {
            if (attempt === retries) log.warn(`Fetch failed: ${url} -> ${(e as Error).message}`);
        }
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
    return null;
}

function isBotChallenge(body: string): boolean {
    const head = body.slice(0, 3000);
    return /Attention Required! \| Cloudflare|cf-browser-verification|Just a moment\.\.\./i.test(head);
}
