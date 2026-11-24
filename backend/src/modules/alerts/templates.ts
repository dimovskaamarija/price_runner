import type { Mail } from './mail.service';

type Lang = 'mk' | 'en';

const T = {
    mk: {
        brand: 'Спореди и купи',
        locale: 'mk-MK',
        currency: 'ден',
        confirmSubject: (p: string) => `Потврдете го известувањето за цена: ${p}`,
        confirmIntro: 'Побаравте известување за цената на овој производ. Кликнете за да го потврдите:',
        confirmButton: 'Потврди известување',
        confirmIgnore: 'Ако не сте го побарале ова, едноставно игнорирајте ја пораката.',
        targetSubject: (p: string, price: string) => `Цената падна на ${price}: ${p}`,
        targetReached: 'Цената ја достигна вашата цел',
        yourTarget: 'Вашата цел',
        belowTarget: (d: string) => `${d} под целта`,
        changeUp: (p: string) => `Цената се зголеми: ${p}`,
        changeDown: (p: string) => `Цената се намали: ${p}`,
        priceUp: 'Цената се зголеми',
        priceDown: 'Цената се намали',
        before: 'Претходно',
        now: 'Сега',
        checkedOn: (d: string) => `Цена проверена на ${d}`,
        atStore: (s: string) => `кај ${s}`,
        storesTitle: 'Најниски цени по продавници',
        cheapest: 'Најевтино',
        buyAt: (s: string) => `Купи кај ${s}`,
        compare: 'Спореди ги цените',
        why: (rule: string) => `Ја добивате оваа порака бидејќи вклучивте известување: ${rule}.`,
        ruleTarget: (t: string) => `цена до ${t}`,
        ruleChange: 'секоја промена на цената',
        typeTarget: (target: string) => `Известување: цена до ${target}`,
        typeChange: 'Известување: секоја промена на цената',
        unsubscribe: 'Откажи го ова известување',
    },
    en: {
        brand: 'Compare & Buy',
        locale: 'en-GB',
        currency: 'MKD',
        confirmSubject: (p: string) => `Confirm your price alert: ${p}`,
        confirmIntro: 'You asked to be notified about the price of this product. Click to confirm:',
        confirmButton: 'Confirm alert',
        confirmIgnore: "If you didn't request this, just ignore this email.",
        targetSubject: (p: string, price: string) => `Price dropped to ${price}: ${p}`,
        targetReached: 'The price reached your target',
        yourTarget: 'Your target',
        belowTarget: (d: string) => `${d} below target`,
        changeUp: (p: string) => `Price went up: ${p}`,
        changeDown: (p: string) => `Price went down: ${p}`,
        priceUp: 'The price went up',
        priceDown: 'The price went down',
        before: 'Before',
        now: 'Now',
        checkedOn: (d: string) => `Price checked on ${d}`,
        atStore: (s: string) => `at ${s}`,
        storesTitle: 'Lowest prices by store',
        cheapest: 'Cheapest',
        buyAt: (s: string) => `Buy at ${s}`,
        compare: 'Compare prices',
        why: (rule: string) => `You're getting this email because you set an alert: ${rule}.`,
        ruleTarget: (t: string) => `price up to ${t}`,
        ruleChange: 'any price change',
        typeTarget: (target: string) => `Alert: price up to ${target}`,
        typeChange: 'Alert: any price change',
        unsubscribe: 'Unsubscribe from this alert',
    },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number, lang: Lang) => `${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')} ${T[lang].currency}`;
const langOf = (l: string): Lang => (l === 'en' ? 'en' : 'mk');
/** "Sport Vision MK" -> "Sport Vision" */
const storeName = (s: string) => s.replace(/\s+MK$/i, '');

const fmtDate = (d: Date, lang: Lang) =>
    new Intl.DateTimeFormat(T[lang].locale, { timeZone: 'Europe/Skopje', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

export interface StoreOffer {
    store: string;
    price: number;
    url: string;
}

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

const button = (text: string, url: string, primary: boolean) =>
    `<a href="${esc(url)}" style="display:inline-block;margin:4px;padding:12px 20px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;${
        primary ? 'background:#2563eb;color:#ffffff' : 'background:#ffffff;color:#2563eb;border:1px solid #2563eb'
    }">${esc(text)}</a>`;

function shell(lang: Lang, inner: string, footer: string) {
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:16px">
<tr><td style="padding:20px 28px 0;font-weight:700;color:#2563eb;font-size:15px">${T[lang].brand}</td></tr>
<tr><td style="padding:12px 28px 24px">${inner}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px"><tr>
<td style="padding:16px 28px;font-size:12px;line-height:1.5;color:#6b7280;text-align:center">${footer}</td></tr></table>
</td></tr></table></body></html>`;
}

function productBlock(ctx: AlertMailContext) {
    const image = ctx.productImage
        ? `<img src="${esc(ctx.productImage)}" alt="" width="180" style="display:block;margin:0 auto 12px;max-width:180px;height:auto">`
        : '';
    return `${image}<div style="text-align:center;font-size:15px;font-weight:600;color:#374151">${esc(ctx.productName)}</div>`;
}

// ------------------------------------------------------------------ confirmation

export function confirmMail(ctx: AlertMailContext, confirmUrl: string): Mail {
    const lang = langOf(ctx.lang);
    const t = T[lang];
    const kind = ctx.type === 'target' && ctx.targetPrice != null ? t.typeTarget(money(ctx.targetPrice, lang)) : t.typeChange;
    const inner = `${productBlock(ctx)}
<div style="text-align:center;font-size:18px;font-weight:700;margin:16px 0 8px">${esc(kind)}</div>
<div style="text-align:center;font-size:15px;color:#374151;margin-bottom:18px">${esc(t.confirmIntro)}</div>
<div style="text-align:center">${button(t.confirmButton, confirmUrl, true)}</div>`;
    return {
        to: ctx.to,
        subject: t.confirmSubject(ctx.productName),
        html: shell(lang, inner, esc(t.confirmIgnore)),
        text: `${kind}\n${ctx.productName}\n\n${t.confirmIntro}\n${confirmUrl}\n\n${t.confirmIgnore}`,
    };
}

// ------------------------------------------------------------------ price alert

/**
 * Price email: product image + name, the new lowest price and where, what changed (old -> new,
 * difference and %, or the target), when it was checked, the cheapest stores, a button to the
 * cheapest store and one to compare on our site, and why they got it + unsubscribe.
 */
export function priceMail(ctx: AlertMailContext, oldPrice: number | null, newPrice: number, offers: StoreOffer[], checkedAt: Date): Mail {
    const lang = langOf(ctx.lang);
    const t = T[lang];
    const best = offers[0];
    const up = oldPrice != null && newPrice > oldPrice;

    let headline: string;
    let subject: string;
    let detail: string;
    let detailText: string;
    if (ctx.type === 'target') {
        const target = ctx.targetPrice ?? newPrice;
        headline = t.targetReached;
        subject = t.targetSubject(ctx.productName, money(newPrice, lang));
        const below = target - newPrice > 0 ? ` · ${t.belowTarget(money(target - newPrice, lang))}` : '';
        detail = `${t.yourTarget}: <strong>${money(target, lang)}</strong>${below}`;
        detailText = `${t.yourTarget}: ${money(target, lang)}${below}`;
    } else {
        headline = up ? t.priceUp : t.priceDown;
        subject = (up ? t.changeUp : t.changeDown)(ctx.productName);
        if (oldPrice != null) {
            const diff = newPrice - oldPrice;
            const pct = Math.round((diff / oldPrice) * 100);
            const sign = diff > 0 ? '+' : '−';
            const change = `${sign}${money(Math.abs(diff), lang)}, ${sign}${Math.abs(pct)}%`;
            detail = `${t.before}: <s>${money(oldPrice, lang)}</s> → ${t.now}: <strong>${money(newPrice, lang)}</strong> <span style="color:${
                up ? '#b91c1c' : '#15803d'
            };font-weight:700">(${change})</span>`;
            detailText = `${t.before}: ${money(oldPrice, lang)} -> ${t.now}: ${money(newPrice, lang)} (${change})`;
        } else {
            detail = `${t.now}: <strong>${money(newPrice, lang)}</strong>`;
            detailText = `${t.now}: ${money(newPrice, lang)}`;
        }
    }

    const priceColor = ctx.type === 'change' && up ? '#b91c1c' : '#15803d';
    const arrow = ctx.type === 'change' ? (up ? '▲ ' : '▼ ') : '';
    const where = best ? `<div style="text-align:center;font-size:14px;color:#374151">${esc(t.atStore(storeName(best.store)))}</div>` : '';

    const rows = offers
        .slice(0, 3)
        .map(
            (o, i) => `<tr>
<td style="padding:8px 0;border-top:1px solid #eef0f4;font-size:14px">${esc(storeName(o.store))}${
                i === 0 ? ` <span style="background:#16a34a;color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:700">${t.cheapest}</span>` : ''
            }</td>
<td style="padding:8px 0;border-top:1px solid #eef0f4;font-size:14px;text-align:right;font-weight:${i === 0 ? 700 : 400}"><a href="${esc(o.url)}" style="color:#1f2937;text-decoration:none">${money(o.price, lang)}</a></td>
</tr>`,
        )
        .join('');
    const storesTable = rows
        ? `<div style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.03em;margin:22px 0 4px">${t.storesTitle}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
        : '';

    const inner = `${productBlock(ctx)}
<div style="text-align:center;font-size:14px;color:#6b7280;margin-top:16px">${esc(headline)}</div>
<div style="text-align:center;font-size:30px;font-weight:800;color:${priceColor};margin:2px 0">${arrow}${money(newPrice, lang)}</div>
${where}
<div style="text-align:center;font-size:14px;color:#374151;margin-top:10px">${detail}</div>
<div style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px">${esc(t.checkedOn(fmtDate(checkedAt, lang)))}</div>
${storesTable}
<div style="text-align:center;margin-top:22px">${best ? button(t.buyAt(storeName(best.store)), best.url, true) : ''}${button(t.compare, ctx.productUrl, !best)}</div>`;

    const rule = ctx.type === 'target' && ctx.targetPrice != null ? t.ruleTarget(money(ctx.targetPrice, lang)) : t.ruleChange;
    const footer = `${esc(t.why(rule))}<br><a href="${esc(ctx.unsubscribeUrl)}" style="color:#6b7280">${t.unsubscribe}</a>`;

    const textStores = offers.slice(0, 3).map((o) => `- ${storeName(o.store)}: ${money(o.price, lang)} ${o.url}`).join('\n');
    return {
        to: ctx.to,
        subject,
        html: shell(lang, inner, footer),
        text: [
            ctx.productName,
            `${headline}: ${money(newPrice, lang)}${best ? ` ${t.atStore(storeName(best.store))}` : ''}`,
            detailText,
            t.checkedOn(fmtDate(checkedAt, lang)),
            textStores,
            `${t.compare}: ${ctx.productUrl}`,
            '',
            t.why(rule),
            `${t.unsubscribe}: ${ctx.unsubscribeUrl}`,
        ]
            .filter(Boolean)
            .join('\n'),
    };
}
