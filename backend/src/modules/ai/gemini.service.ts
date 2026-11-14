import { Injectable, Logger } from '@nestjs/common';
import pLimit from 'p-limit';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Subset of the OpenAPI schema accepted by Gemini's `responseSchema`. */
export interface GeminiSchema {
    type: 'OBJECT' | 'ARRAY' | 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN';
    properties?: Record<string, GeminiSchema>;
    required?: string[];
    items?: GeminiSchema;
    enum?: string[];
    nullable?: boolean;
    description?: string;
}

/**
 * Thin client for the Gemini REST API (no SDK dependency).
 *
 * Configuration (all optional — without GEMINI_API_KEY the app runs rules-only):
 *   GEMINI_API_KEY             API key from https://aistudio.google.com
 *   GEMINI_MODEL               default "gemini-2.5-flash"
 *   GEMINI_EMBEDDING_MODEL     default "gemini-embedding-001"
 *   GEMINI_MAX_CALLS_PER_RUN   safety budget per scraper run, default 300
 */
@Injectable()
export class GeminiService {
    private readonly log = new Logger(GeminiService.name);
    private readonly apiKey = process.env.GEMINI_API_KEY || '';
    private readonly model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    private readonly embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
    private readonly maxCalls = parseInt(process.env.GEMINI_MAX_CALLS_PER_RUN || '300', 10);
    private readonly limit = pLimit(2);
    private callsThisRun = 0;
    private disabledReason: string | null = null;

    get enabled(): boolean {
        return !!this.apiKey && !this.disabledReason && this.callsThisRun < this.maxCalls;
    }

    /** Call at the start of each scraper run to reset the call budget. */
    resetBudget() {
        this.callsThisRun = 0;
    }

    get stats() {
        return { enabled: !!this.apiKey, calls: this.callsThisRun, budget: this.maxCalls, disabledReason: this.disabledReason };
    }

    /** Structured generation: the response is guaranteed to match `schema` (enums included). */
    async generateJson<T>(prompt: string, schema: GeminiSchema, systemInstruction?: string): Promise<T | null> {
        if (!this.enabled) return null;
        const body = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
            generationConfig: {
                temperature: 0,
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        };
        const res = await this.post(`models/${this.model}:generateContent`, body);
        const text: string | undefined = res?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('');
        if (!text) return null;
        try {
            return JSON.parse(text) as T;
        } catch {
            this.log.warn(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
            return null;
        }
    }

    /** Embeddings for semantic similarity (batched, 100 per request). Returns null if disabled. */
    async embed(texts: string[], dimensions = 256): Promise<number[][] | null> {
        if (!this.enabled || texts.length === 0) return texts.length ? null : [];
        const out: number[][] = [];
        for (let i = 0; i < texts.length; i += 100) {
            const chunk = texts.slice(i, i + 100);
            const res = await this.post(`models/${this.embeddingModel}:batchEmbedContents`, {
                requests: chunk.map((text) => ({
                    model: `models/${this.embeddingModel}`,
                    content: { parts: [{ text }] },
                    taskType: 'SEMANTIC_SIMILARITY',
                    outputDimensionality: dimensions,
                })),
            });
            const vectors: number[][] | undefined = res?.embeddings?.map((e: any) => e.values);
            if (!vectors || vectors.length !== chunk.length) return null;
            out.push(...vectors);
        }
        return out;
    }

    private post(path: string, body: unknown): Promise<any> {
        return this.limit(async () => {
            for (let attempt = 0; attempt < 4; attempt++) {
                if (!this.enabled) return null;
                this.callsThisRun++;
                try {
                    const res = await fetch(`${API_BASE}/${path}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
                        body: JSON.stringify(body),
                        signal: AbortSignal.timeout(60_000),
                    });
                    if (res.ok) return res.json();

                    const detail = (await res.text()).slice(0, 300);
                    if (res.status === 429 || res.status >= 500) {
                        const wait = 2000 * 2 ** attempt;
                        this.log.warn(`Gemini ${res.status}, retrying in ${wait}ms`);
                        await new Promise((r) => setTimeout(r, wait));
                        continue;
                    }
                    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
                        // Bad key / unknown model: stop calling for the rest of the process.
                        this.disabledReason = `HTTP ${res.status}: ${detail}`;
                        this.log.error(`Gemini disabled (${path}): ${this.disabledReason}`);
                        return null;
                    }
                    this.log.warn(`Gemini ${res.status}: ${detail}`);
                    return null;
                } catch (e) {
                    this.log.warn(`Gemini request failed: ${(e as Error).message}`);
                    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
            return null;
        });
    }
}
