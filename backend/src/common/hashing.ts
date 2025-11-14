import { createHash } from 'crypto';

function normalizeString(s: string): string {
    return s
        .toLowerCase()
        .replace(/\s+/g, ' ') 
        .trim();
}

export const createId = (s: string) =>
    createHash('sha1').update(normalizeString(s)).digest('hex').slice(0, 24);
