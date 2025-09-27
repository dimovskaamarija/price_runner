import { createHash } from 'crypto';

export const createId = (s: string) =>
    createHash('sha1').update(s).digest('hex').slice(0, 24);
