import {
    AGE_KEYWORDS, CATEGORIES, CATEGORY_KEYWORDS, COLORS, COLOR_NAMES, GENDERS, AGES, GENDER_KEYWORDS, SUBCATEGORIES, SUBCATEGORY_NAMES,
} from '../catalog/taxonomy';
import { brandKey, normalizeText } from '../catalog/text';

export const MAX_PRICE = 20000; // listProducts treats this as "no upper limit"
const SORTS = ['available-desc', 'price-asc', 'price-desc', 'newest'] as const;
export type AssistantSort = (typeof SORTS)[number];
export const ASSISTANT_SORTS: string[] = [...SORTS];

export interface AssistantFilters {
    search: string;
    category: string[];
    subcategory: string[];
    brand: string[];
    age: string[];
    gender: string[];
    color: string[];
    minPrice: number;
    maxPrice: number;
    sort: AssistantSort;
}

export const emptyFilters = (): AssistantFilters => ({
    search: '', category: [], subcategory: [], brand: [], age: [], gender: [], color: [],
    minPrice: 0, maxPrice: MAX_PRICE, sort: 'available-desc',
});

export const hasFilters = (f: AssistantFilters) =>
    !!f.search || f.minPrice > 0 || f.maxPrice < MAX_PRICE || f.sort !== 'available-desc' ||
    [f.category, f.subcategory, f.brand, f.age, f.gender, f.color].some((v) => v.length > 0);

/** Keep only values the catalog knows. Used for both model output and anything sent by the browser. */
export function sanitizeFilters(raw: any, brands: string[]): AssistantFilters {
    const r = raw && typeof raw === 'object' ? raw : {};
    const pick = (v: unknown, allowed: readonly string[]) =>
        Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && allowed.includes(x)))].slice(0, 8) : [];
    const byKey = new Map(brands.map((b) => [brandKey(b), b]));
    const brand = Array.isArray(r.brand)
        ? [...new Set(r.brand.filter((b: unknown) => typeof b === 'string').map((b: string) => byKey.get(brandKey(b))).filter(Boolean))]
        : [];
    const num = (v: unknown, fallback: number) => {
        const n = typeof v === 'number' ? Math.round(v) : NaN;
        return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PRICE) : fallback;
    };
    let minPrice = num(r.minPrice, 0);
    let maxPrice = num(r.maxPrice, MAX_PRICE);
    if (minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
    return {
        search: typeof r.search === 'string' ? r.search.trim().slice(0, 80) : '',
        category: pick(r.category, CATEGORIES),
        subcategory: pick(r.subcategory, SUBCATEGORY_NAMES),
        brand: brand.slice(0, 8) as string[],
        age: pick(r.age, AGES),
        gender: pick(r.gender, GENDERS),
        color: pick(r.color, COLOR_NAMES),
        minPrice,
        maxPrice,
        sort: ASSISTANT_SORTS.includes(r.sort) ? r.sort : 'available-desc',
    };
}

// ---------------------------------------------------------------- rules parser

const CYR: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ѓ: 'gj', е: 'e', ж: 'zh', з: 'z', ѕ: 'dz', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm',
    н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ќ: 'kj', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', џ: 'dzh', ш: 'sh',
};
const latin = (s: string) => [...s].map((c) => CYR[c] ?? c).join('').normalize('NFD').replace(/\p{M}/gu, '');
/** "maski" and "mashki" both fold to "maski": people type Macedonian in Latin either way. */
const fold = (s: string) => s.replace(/(dz|[szc])h/g, '$1');
/** Crude stem so црна/црни/црно and shoe/shoes agree. */
function stem(w: string): string {
    let s = w.length > 3 ? w.replace(/s$/, '') : w;
    while (s.length > 3 && /[aeio]$/.test(s)) s = s.slice(0, -1);
    return s;
}

const FOR_ME = /(?<!\p{L})(?:(?:за мене|za mene|for me)(?!\p{L})|препора|предложи|prepora|predlo[zž]|recommend|suggest)/u;
const STOP = new Set(
    ('a an the i im me my we you need want looking look find show give get buy some any something anything for with and or in of to from is are ' +
        'under below over above between than up less more please hi hello hey thanks help what which do does can how good nice best cheap cheapest ' +
        'cheaper budget new newest latest price priced mkd den denar denars denari eur color colour size pair product products recommend suggest like ones ' +
        'sakam baram treba mi mene za na so od do pod nad pomegju megju i ili nekoi nekoj imate ima dali kako kolku ' +
        'zdravo ve molam dobar den evtin evtini najevtini najevtin najeftini eftini novi nov najnovi preporacaj preporachaj predlozi predlozhi cena broj pokazi pokazhi daj dajte nesto neshto ' +
        'poevtini poevtin poeftini').split(' '),
);

export interface ParsedQuery {
    filters: AssistantFilters;
    forMe: boolean;
}

/** Understands common requests without any AI. Also the fallback when Gemini is off or fails. */
export function parseQuery(message: string, brands: string[], previous?: AssistantFilters): ParsedQuery {
    const f = emptyFilters();
    let text = message.normalize('NFKC').toLowerCase();
    const forMe = FOR_ME.test(text);
    // "мене" would otherwise stem to "men".
    text = text.replace(/(?<!\p{L})(?:мене|mene)(?!\p{L})/gu, ' ');

    // ---- prices (numbers below 100 are model names, e.g. "Air Max 90")
    const NUM = '(\\d{1,3}(?:[.,\\s]\\d{3})+|\\d{3,6})(?!\\d)';
    const toNum = (s: string) => parseInt(s.replace(/\D/g, ''), 10);
    const take = (re: string, use: (m: RegExpMatchArray) => void) => {
        const m = text.match(new RegExp(`(?<![\\p{L}\\d])${re}`, 'u'));
        if (!m) return;
        use(m);
        text = text.replace(m[0], ' ');
    };
    const range = (m: RegExpMatchArray) => {
        const [a, b] = [toNum(m[1]), toNum(m[2])];
        if (Math.max(a, b) >= 100) [f.minPrice, f.maxPrice] = [Math.min(a, b), Math.max(a, b)];
    };
    take(`(?:between|помеѓу|меѓу|pomegju|megju|from|од|od)\\s+${NUM}\\s*(?:and|и|to|до|i|do|-|–)\\s*${NUM}`, range);
    take(`(?:under|below|up to|less than|под|до|помалку од|pod|do|<)\\s*${NUM}`, (m) => (f.maxPrice = toNum(m[1])));
    take(`(?:over|above|more than|from|над|повеќе од|од|nad|od|>)\\s*${NUM}`, (m) => (f.minPrice = toNum(m[1])));
    f.maxPrice = Math.min(f.maxPrice, MAX_PRICE);
    f.minPrice = Math.min(f.minPrice, MAX_PRICE);

    // ---- words
    let tokens = normalizeText(text.replace(/['’]s(?!\p{L})/gu, '')).split(' ').filter(Boolean).map((w) => ({ raw: w, lat: latin(w) }));
    /** Remove the first occurrence of a phrase; true when found. */
    const consume = (phrase: string, exact = false): boolean => {
        const words = normalizeText(phrase).split(' ').map(latin);
        const same = (t: { raw: string; lat: string }, w: string) =>
            exact
                ? t.lat === w
                : stem(t.lat) === stem(w) || (t.raw === t.lat && stem(fold(t.lat)) === stem(fold(w)));
        for (let i = 0; i + words.length <= tokens.length; i++) {
            if (words.every((w, j) => same(tokens[i + j], w))) {
                tokens.splice(i, words.length);
                return true;
            }
        }
        return false;
    };
    const byLength = (dict: Record<string, string[]>) =>
        Object.entries(dict).flatMap(([value, kws]) => kws.map((kw) => ({ value, kw }))).sort((a, b) => b.kw.length - a.kw.length);
    const collect = (dict: Record<string, string[]>, into: string[]) => {
        for (const { value, kw } of byLength(dict)) if (consume(kw) && !into.includes(value)) into.push(value);
    };

    // Brands first, so "New Balance" is not read as "newest".
    // Some scraped brands are also model words ("Max"): keep "air max" together as a model name.
    const airMax = consume('air max', true);
    for (const b of [...brands].sort((x, y) => y.length - x.length)) if (b.length > 1 && consume(b, true)) f.brand.push(b);

    const words = tokens.map((t) => t.lat);
    if (words.some((w) => /^(naj|po)?e[vf]tin|^(naj|po)nisk|^cheap|^lower|^budget/.test(w))) f.sort = 'price-asc';
    else if (words.some((w) => /^(new|newest|latest|novi|nov|nova|novo|najnov.*)$/.test(w))) f.sort = 'newest';

    // Products first by long phrases ("капа за пливање"), then who it's for, then single-word products.
    const subs = Object.fromEntries(Object.entries(SUBCATEGORIES).map(([k, v]) => [k, v.keywords]));
    const only = (multi: boolean) =>
        Object.fromEntries(Object.entries(subs).map(([k, kws]) => [k, kws.filter((kw) => kw.includes(' ') === multi)]));
    collect(only(true), f.subcategory);

    const kid = byLength({ 'За деца': AGE_KEYWORDS['За деца'] }).filter(({ kw }) => tokens.some((t) => stem(t.lat) === stem(latin(kw))));
    if (kid.length) f.age = ['За деца'];
    const genderFound: string[] = [];
    collect({ Машки: GENDER_KEYWORDS['Машки'], Женски: GENDER_KEYWORDS['Женски'] }, genderFound);
    for (const { kw } of kid) consume(kw);
    if (genderFound.length === 1) f.gender = [genderFound[0], 'Унисекс'];
    if (genderFound.length && !kid.length) f.age = ['За возрасни'];

    collect(COLORS, f.color);
    collect(only(false), f.subcategory);
    if (f.subcategory.length) for (const kws of Object.values(CATEGORY_KEYWORDS)) kws.forEach((kw) => consume(kw));
    else collect(CATEGORY_KEYWORDS, f.category);

    // Leftover Latin words are usually model names ("air max 90"). Cyrillic leftovers are filler.
    const rest = tokens.filter((t) => t.raw === t.lat && !STOP.has(t.raw) && /^[a-z0-9]+$/.test(t.raw)).map((t) => t.raw);
    if (airMax) rest.unshift('air', 'max');
    if (rest.some((w) => w.length > 1 && /[a-z]/.test(w)) || (f.brand.length && rest.length)) f.search = rest.slice(0, 4).join(' ');

    if (previous && hasFilters(f) && !f.subcategory.length && !f.category.length && !f.search) {
        // "cheaper", "in black", "for women": refine the previous request.
        const merged = { ...previous };
        for (const k of ['brand', 'age', 'gender', 'color'] as const) if (f[k].length) merged[k] = f[k];
        if (f.brand.length) merged.search = ''; // a model name belongs to the old brand
        if (f.minPrice > 0) merged.minPrice = f.minPrice;
        if (f.maxPrice < MAX_PRICE) merged.maxPrice = f.maxPrice;
        if (merged.minPrice > merged.maxPrice) {
            if (f.maxPrice < MAX_PRICE) merged.minPrice = 0;
            else merged.maxPrice = MAX_PRICE;
        }
        if (f.sort !== 'available-desc') merged.sort = f.sort;
        return { filters: merged, forMe };
    }
    return { filters: f, forMe };
}
