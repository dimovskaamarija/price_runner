import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Weekday, WeeklyHours } from '../../database/entities/store-location.entity';

/** A shop as read from a chain's store locator. lat/lng may be missing (then it's geocoded). */
export interface SourceLocation {
    id: string;
    store: string;
    name: string;
    address: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
    phone: string | null;
    hours: WeeklyHours | null;
    url: string | null;
}

export interface LocationSource {
    store: string;
    fetch: () => Promise<SourceLocation[]>;
}

const http = axios.create({
    timeout: 30_000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)', 'Accept-Language': 'mk,en;q=0.8' },
});

const clean = (s?: string | null) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim() || null;
const num = (s: unknown) => {
    const n = parseFloat(String(s));
    return Number.isFinite(n) && n !== 0 ? n : null;
};
const isOnlineShop = (name: string) => /е[\s-]*продавница|online|онлајн|web\s*shop/i.test(name);

// ------------------------------------------------------------------ cities

const CITIES = [
    'Скопје', 'Битола', 'Куманово', 'Прилеп', 'Тетово', 'Велес', 'Охрид', 'Штип', 'Гостивар', 'Струмица',
    'Кавадарци', 'Кочани', 'Кичево', 'Струга', 'Радовиш', 'Гевгелија', 'Дебар', 'Крива Паланка', 'Свети Николе',
    'Неготино', 'Делчево', 'Виница', 'Ресен', 'Пробиштип', 'Берово', 'Кратово', 'Валандово', 'Демир Хисар',
    'Македонски Брод', 'Богданци', 'Дојран',
];
/** Skopje municipalities that appear instead of the city name in some addresses. */
const SKOPJE_AREAS = ['Центар', 'Карпош', 'Аеродром', 'Чаир', 'Кисела Вода', 'Гази Баба', 'Ѓорче Петров', 'Бутел', 'Сарај', 'Шуто Оризари'];

const LATIN_TO_MK: Array<[RegExp, string]> = [
    [/dzh/g, 'џ'], [/gj/g, 'ѓ'], [/kj/g, 'ќ'], [/lj/g, 'љ'], [/nj/g, 'њ'], [/zh/g, 'ж'], [/ch/g, 'ч'], [/sh/g, 'ш'], [/dz/g, 'ѕ'],
    [/č/g, 'ч'], [/š/g, 'ш'], [/ž/g, 'ж'], [/ć/g, 'ќ'], [/đ/g, 'ѓ'],
];
const LATIN_LETTERS: Record<string, string> = {
    a: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'ј', k: 'к', l: 'л', m: 'м',
    n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', z: 'з', y: 'ј', w: 'в', q: 'к', x: 'кс',
};

function toCyrillic(latin: string): string {
    let s = latin.toLowerCase();
    for (const [re, mk] of LATIN_TO_MK) s = s.replace(re, mk);
    s = s.replace(/[a-z]/g, (ch) => LATIN_LETTERS[ch] || ch);
    return s.replace(/(^|\s)(\S)/g, (_, sp, ch) => sp + ch.toUpperCase());
}

/** One spelling per city ("Skopje", "Скопје-Чаир", "Центар" -> "Скопје"), so lists group and sort properly. */
export function normalizeCity(raw: string | null, address: string | null): string | null {
    const candidates = [raw, address].filter(Boolean).map((v) => (/[a-z]/i.test(v!) ? toCyrillic(v!) : v!));
    const haystack = ` ${candidates.join(' ').toLowerCase()} `;
    // Whole words only ("Климент Охридски" is a street, not Охрид), and the city mentioned last wins
    // because addresses end with the city ("ул. Климент Охридски 91А, Струмица").
    const at = (name: string) => {
        const re = new RegExp(`[\\s,.(\\-]${name.toLowerCase()}(?=[\\s,.)\\-])`, 'g');
        let last = -1;
        for (const m of haystack.matchAll(re)) last = m.index!;
        return last;
    };
    const city = CITIES.map((c) => ({ c, i: at(c) }))
        .filter((x) => x.i >= 0)
        .sort((a, b) => b.i - a.i)[0]?.c;
    if (city) return city;
    if (SKOPJE_AREAS.some((a) => at(a) >= 0)) return 'Скопје';
    const first = candidates[0];
    return first && !/\d/.test(first) ? first : null;
}

// ------------------------------------------------------------------ hours

const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MK_DAYS: Record<string, Weekday> = {
    понеделник: 'mon', вторник: 'tue', среда: 'wed', четврток: 'thu', петок: 'fri', сабота: 'sat', недела: 'sun',
};
const hhmm = (t: string) => t.slice(0, 5);

/** nbshop: {"mon":{"from":"09:00:00","to":"21:00:00"}, "sun":{"from":"","to":""}} */
function nbshopHours(raw: unknown): WeeklyHours | null {
    try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!obj || typeof obj !== 'object') return null;
        const out = {} as WeeklyHours;
        for (const d of DAYS) {
            const v = (obj as any)[d];
            out[d] = v?.from && v?.to ? { from: hhmm(v.from), to: hhmm(v.to) } : null;
        }
        return DAYS.some((d) => out[d]) ? out : null;
    } catch {
        return null;
    }
}

/** Lines like "Понеделник | од 10:00 до 22:00" or "Недела X". */
function macedonianDayLines(lines: string[]): WeeklyHours | null {
    const out = Object.fromEntries(DAYS.map((d) => [d, null])) as WeeklyHours;
    let found = 0;
    for (const line of lines) {
        const l = line.toLowerCase();
        const day = Object.keys(MK_DAYS).find((d) => l.includes(d));
        if (!day) continue;
        found++;
        const m = l.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/);
        out[MK_DAYS[day]] = m ? { from: m[1].padStart(5, '0'), to: m[2].padStart(5, '0') } : null;
    }
    return found ? out : null;
}

// ------------------------------------------------------------------ nbshop (Sport Vision, Sport Reality, Buzz)

function nbshop(store: string, origin: string): LocationSource {
    return {
        store,
        fetch: async () => {
            const res = await http.get(`${origin}/mk/prodavnici?type=json&ver=1`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                responseType: 'json',
            });
            const stores: any[] = res.data?.stores || [];
            return stores
                .filter((s) => String(s.status) === '1' && String(s.forMap) !== '0')
                .map((s) => {
                    const [lat, lng] = String(s.customCoordinatesGoogleMap || s.coordinatesGoogleMap || '').split(',').map(num);
                    return {
                        id: `${store}:${s.id}`,
                        store,
                        name: clean(s.publicName || s.name) || store,
                        address: clean(s.street),
                        city: normalizeCity(clean(String(s.cityName || '').replace(/\s*\(.*\)\s*$/, '')), clean(s.street)),
                        lat: lat ?? null,
                        lng: lng ?? null,
                        phone: clean(s.phone) ? `+${String(s.phone).replace(/^\+/, '')}` : null,
                        hours: nbshopHours(s.workingHoursObject || s.f_workingHoursObjectAsString),
                        url: s.url || null,
                    };
                });
        },
    };
}

// ------------------------------------------------------------------ OW catalog (Sport M, Sizeer)

async function owDetail(origin: string, path: string) {
    const $ = cheerio.load((await http.get(`${origin}${path}`)).data);
    const text = (sel: string) => clean($(sel).first().text());

    // Sport M: labelled blocks ("КОНТАКТ" / "АДРЕСА"); Sizeer: .store-phone + address paragraph.
    let phone = text('.store-phone');
    let address: string | null = null;
    $('div').each((_, el) => {
        const label = clean($(el).text());
        if (label === 'КОНТАКТ' && !phone) phone = clean($(el).nextAll('label').first().text());
        if (label === 'АДРЕСА' && !address) address = clean($(el).nextAll('label').first().text());
    });
    if (!address) address = clean($('.shop-details-container .col-md-7 p').first().text());

    const hourLines = $('p')
        .map((_, p) => clean($(p).text()) || '')
        .get()
        .filter((l) => Object.keys(MK_DAYS).some((d) => l.toLowerCase().startsWith(d)));

    const coords = String($.html()).match(/setView\(\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/);
    return {
        name: text('h2.title') || text('.shops h3'),
        phone,
        address,
        hours: macedonianDayLines(hourLines),
        lat: coords ? num(coords[1]) : null,
        lng: coords ? num(coords[2]) : null,
    };
}

function owCatalog(store: string, origin: string): LocationSource {
    return {
        store,
        fetch: async () => {
            const html: string = (await http.get(`${origin}/Home/Shops`)).data;
            const $ = cheerio.load(html);
            const paths = [...new Set($('a[href*="/Home/ShopDetails/"]').map((_, a) => $(a).attr('href')!).get())];
            const out: SourceLocation[] = [];
            for (const path of paths) {
                const d = await owDetail(origin, path);
                if (!d.name || isOnlineShop(d.name)) continue;
                const city = normalizeCity(d.address?.split(',').pop()?.trim() || null, d.address);
                out.push({
                    id: `${store}:${path.split('/').pop()}`,
                    store,
                    name: d.name,
                    address: d.address,
                    city,
                    lat: d.lat,
                    lng: d.lng,
                    phone: d.phone,
                    hours: d.hours,
                    url: `${origin}${path}`,
                });
            }
            return out;
        },
    };
}

// ------------------------------------------------------------------ Amasty store locator (D Sport, Magento)

function amasty(store: string, origin: string): LocationSource {
    return {
        store,
        fetch: async () => {
            const seen = new Map<string, SourceLocation>();
            for (let page = 1; page <= 20; page++) {
                const res = await http.get(`${origin}/amlocator/index/ajax/p/${page}/`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    responseType: 'json',
                });
                const items: any[] = res.data?.items || [];
                const fresh = items.filter((i) => !seen.has(String(i.id)));
                if (!fresh.length) break; // the endpoint wraps around after the last page
                for (const i of fresh) {
                    const $ = cheerio.load(String(i.popup_html || ''));
                    const info = clean($.text()) || '';
                    const city = info.match(/Град:\s*([^|]+?)\s*(Zip:|Адреса:|$)/)?.[1]?.trim() || null;
                    const address = info.match(/Адреса:\s*([^|]+?)\s*(Opis:|$)/)?.[1]?.trim() || null;
                    seen.set(String(i.id), {
                        id: `${store}:${i.id}`,
                        store,
                        name: clean(i.name) || store,
                        address,
                        city: normalizeCity(city, `${address || ''} ${clean(i.name) || ''}`),
                        lat: num(i.lat),
                        lng: num(i.lng),
                        phone: null,
                        hours: null,
                        url: $('a.amlocator-link').attr('href') || `${origin}/lokacije/`,
                    });
                }
            }
            return [...seen.values()];
        },
    };
}

/** One entry per chain; `store` must match the store names used by the scrapers. */
export const LOCATION_SOURCES: LocationSource[] = [
    nbshop('Sport Vision MK', 'https://www.sportvision.mk'),
    nbshop('Sport Reality MK', 'https://www.sportreality.mk'),
    nbshop('Buzz Sneakers MK', 'https://www.buzzsneakers.mk'),
    owCatalog('Sizeer MK', 'https://www.sizeer.com.mk'),
    owCatalog('Sport M', 'https://www.sport-m.com.mk'),
    // Same company group as Sport M / Sizeer: their "find in store" also lists Intersport shops.
    owCatalog('Intersport MK', 'https://www.intersport.mk'),
    amasty('D Sport', 'https://www.dsport.mk'),
];
