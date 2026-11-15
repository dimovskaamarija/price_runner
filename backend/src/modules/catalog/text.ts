import { createHash } from 'crypto';

/** Lowercase, unify separators, strip punctuation, collapse whitespace. Works for Cyrillic and Latin. */
export function normalizeText(s?: string | null): string {
    return (s || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[‐-―_\-/|,.:;()[\]{}"'`+&!?*]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** True if `phrase` occurs in `text` as a sequence of whole words (both already normalized). */
export function containsPhrase(text: string, phrase: string): boolean {
    if (!text || !phrase) return false;
    return ` ${text} `.includes(` ${phrase} `);
}

/** Normalize a URL into a stable per-store key (drops fragment and trailing slashes). */
export function urlKey(url: string): string {
    return url.trim().replace(/#.*$/, '').replace(/\/+$/, '');
}

/** "IB6651-300" / "ib6651 300" -> "IB6651300". Returns undefined for codes too weak to match on. */
export function normalizeModelCode(code?: string | null): string | undefined {
    if (!code) return undefined;
    const c = code.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 5 || !/\d/.test(c) || c === 'UNKNOWN') return undefined;
    return c;
}

const KEEP_UPPER = /^[A-Z0-9]{1,3}$/;

/** "NIKE" -> "Nike", "the north face" -> "The North Face", "4F" stays "4F". */
export function canonicalBrand(brand?: string | null): string | undefined {
    const b = (brand || '').replace(/\s+/g, ' ').trim();
    if (!b || b.toLowerCase() === 'unknown') return undefined;
    return b
        .split(' ')
        .map((w) => (KEEP_UPPER.test(w) && /[0-9]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(' ');
}

export function brandKey(brand?: string | null): string {
    return normalizeText(brand).replace(/\s+/g, '');
}

/** Name tokens useful for similarity: no brand words, no very short tokens. */
export function nameTokens(name: string, brand?: string | null): Set<string> {
    const brandWords = new Set(normalizeText(brand).split(' '));
    return new Set(
        normalizeText(name)
            .split(' ')
            .filter((t) => t.length > 1 && !brandWords.has(t)),
    );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
}

export function cosine(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export const createId = (s: string) =>
    createHash('sha1').update(s.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 24);
