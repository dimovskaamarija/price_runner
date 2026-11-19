import type { Mail } from './mail.service';

type Lang = 'mk' | 'en';

const T = {
    mk: {
        brand: 'Спореди и купи',
        confirmSubject: (p: string) => `Потврдете го известувањето за цена: ${p}`,
        confirmIntro: 'Побаравте известување за цената на овој производ. Кликнете за да го потврдите:',
        confirmButton: 'Потврди известување',
        confirmIgnore: 'Ако не сте го побарале ова, едноставно игнорирајте ја пораката.',
        targetSubject: (p: string, price: string) => `Цената падна на ${price}: ${p}`,
        targetIntro: (target: string) => `Најниската цена е на или под вашата цел од ${target}.`,
        changeUp: (p: string) => `Цената се зголеми: ${p}`,
        changeDown: (p: string) => `Цената се намали: ${p}`,
        changeIntro: (oldP: string, newP: string) => `Најниската цена се промени од ${oldP} на ${newP}.`,
        view: 'Види ги цените',
        typeTarget: (target: string) => `Известување: цена до ${target}`,
        typeChange: 'Известување: секоја промена на цената',
        unsubscribe: 'Откажи го ова известување',
        currency: 'ден',
    },
    en: {
        brand: 'Compare & Buy',
        confirmSubject: (p: string) => `Confirm your price alert: ${p}`,
        confirmIntro: 'You asked to be notified about the price of this product. Click to confirm:',
        confirmButton: 'Confirm alert',
        confirmIgnore: "If you didn't request this, just ignore this email.",
        targetSubject: (p: string, price: string) => `Price dropped to ${price}: ${p}`,
        targetIntro: (target: string) => `The lowest price is at or below your target of ${target}.`,
        changeUp: (p: string) => `Price went up: ${p}`,
        changeDown: (p: string) => `Price went down: ${p}`,
        changeIntro: (oldP: string, newP: string) => `The lowest price changed from ${oldP} to ${newP}.`,
        view: 'See prices',
        typeTarget: (target: string) => `Alert: price up to ${target}`,
        typeChange: 'Alert: any price change',
        unsubscribe: 'Unsubscribe from this alert',
        currency: 'MKD',
    },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number, lang: Lang) => `${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')} ${T[lang].currency}`;

export interface AlertMailContext {
    lang: string;
    to: string;
    productName: string;
    productImage: string | null;
    productUrl: string;
    unsubscribeUrl: string;
    type: 'target' | 'change';
    targetPrice: number | null;
}

function layout(lang: Lang, ctx: AlertMailContext, heading: string, body: string, buttonText: string, buttonUrl: string, footer: string) {
    const t = T[lang];
    const image = ctx.productImage
        ? `<img src="${esc(ctx.productImage)}" alt="" width="160" style="display:block;margin:0 auto 16px;max-width:160px;height:auto">`
        : '';
    return `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;padding:28px">
<tr><td style="font-weight:700;color:#2563eb;font-size:14px;padding-bottom:16px">${t.brand}</td></tr>
<tr><td style="text-align:center">${image}
<div style="font-size:20px;font-weight:700;margin-bottom:6px">${esc(heading)}</div>
<div style="font-size:15px;color:#374151;margin-bottom:6px">${esc(ctx.productName)}</div>
<div style="font-size:15px;color:#374151;margin:12px 0 20px">${body}</div>
<a href="${esc(buttonUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${esc(buttonText)}</a>
</td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#6b7280;text-align:center">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const langOf = (l: string): Lang => (l === 'en' ? 'en' : 'mk');

export function confirmMail(ctx: AlertMailContext, confirmUrl: string): Mail {
    const lang = langOf(ctx.lang);
    const t = T[lang];
    const kind = ctx.type === 'target' && ctx.targetPrice != null ? t.typeTarget(money(ctx.targetPrice, lang)) : t.typeChange;
    return {
        to: ctx.to,
        subject: t.confirmSubject(ctx.productName),
        html: layout(lang, ctx, kind, esc(t.confirmIntro), t.confirmButton, confirmUrl, esc(t.confirmIgnore)),
        text: `${kind}\n${ctx.productName}\n\n${t.confirmIntro}\n${confirmUrl}\n\n${t.confirmIgnore}`,
    };
}

export function priceMail(ctx: AlertMailContext, oldPrice: number | null, newPrice: number): Mail {
    const lang = langOf(ctx.lang);
    const t = T[lang];
    const unsubscribe = `<a href="${esc(ctx.unsubscribeUrl)}" style="color:#6b7280">${t.unsubscribe}</a>`;
    if (ctx.type === 'target') {
        const intro = t.targetIntro(money(ctx.targetPrice ?? newPrice, lang));
        return {
            to: ctx.to,
            subject: t.targetSubject(ctx.productName, money(newPrice, lang)),
            html: layout(lang, ctx, money(newPrice, lang), esc(intro), t.view, ctx.productUrl, unsubscribe),
            text: `${ctx.productName}: ${money(newPrice, lang)}\n${intro}\n${ctx.productUrl}\n\n${t.unsubscribe}: ${ctx.unsubscribeUrl}`,
        };
    }
    const up = oldPrice != null && newPrice > oldPrice;
    const intro = t.changeIntro(oldPrice != null ? money(oldPrice, lang) : '—', money(newPrice, lang));
    const arrow = up ? '▲' : '▼';
    return {
        to: ctx.to,
        subject: (up ? t.changeUp : t.changeDown)(ctx.productName),
        html: layout(lang, ctx, `${arrow} ${money(newPrice, lang)}`, esc(intro), t.view, ctx.productUrl, unsubscribe),
        text: `${ctx.productName}\n${intro}\n${ctx.productUrl}\n\n${t.unsubscribe}: ${ctx.unsubscribeUrl}`,
    };
}
