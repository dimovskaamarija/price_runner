import { Injectable, Logger } from '@nestjs/common';

export type MlField = 'subcategory' | 'gender' | 'age' | 'color';

export interface MlItem {
    id: number;
    name: string;
    brand?: string | null;
    url?: string;
    store?: string;
    rawLabels?: Record<string, unknown>;
    hints?: Record<string, unknown>;
}

export interface MlPrediction {
    id: number;
    predictions: Partial<Record<MlField, { value: string; confidence: number }>>;
}

/**
 * Client for the Python ML service (ml-service/): TF-IDF + logistic-regression classifiers
 * trained on the catalog's own labelled data, plus LSA/K-Means clustering.
 *
 *   ML_SERVICE_URL       e.g. http://ml-service.railway.internal:8000  (unset = ML disabled)
 *   ML_SERVICE_TOKEN     shared secret, sent as X-ML-Token
 *   ML_MIN_CONFIDENCE    minimum predicted probability to accept a label (default 0.8)
 */
@Injectable()
export class MlClient {
    private readonly log = new Logger(MlClient.name);
    private readonly baseUrl = (process.env.ML_SERVICE_URL || '').replace(/\/+$/, '');
    private readonly token = process.env.ML_SERVICE_TOKEN || '';
    readonly minConfidence = parseFloat(process.env.ML_MIN_CONFIDENCE || '0.8');
    private unavailableUntil = 0;

    get enabled() {
        return !!this.baseUrl && Date.now() > this.unavailableUntil;
    }

    async predict(items: MlItem[]): Promise<MlPrediction[] | null> {
        if (!items.length) return [];
        const res = await this.call<{ results: MlPrediction[] }>('POST', '/predict', { items }, 60_000);
        return res?.results ?? null;
    }

    /** Retrain in the background on the latest labelled data. */
    train() {
        return this.call<{ status: string }>('POST', '/train', {}, 15_000);
    }

    metrics() {
        return this.call<unknown>('GET', '/metrics', undefined, 15_000);
    }

    clusters(k?: number) {
        return this.call<ClusterReport>('GET', `/clusters${k ? `?k=${k}` : ''}`, undefined, 300_000);
    }

    private async call<T>(method: 'GET' | 'POST', path: string, body: unknown, timeoutMs: number): Promise<T | null> {
        if (!this.enabled) return null;
        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers: { 'Content-Type': 'application/json', ...(this.token ? { 'X-ML-Token': this.token } : {}) },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (res.status === 503) return null; // no model trained yet
            if (!res.ok) {
                this.log.warn(`ML ${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
                return null;
            }
            return (await res.json()) as T;
        } catch (e) {
            // Don't slow every batch down while the service is down.
            this.unavailableUntil = Date.now() + 5 * 60_000;
            this.log.warn(`ML service unreachable (${path}): ${(e as Error).message}`);
            return null;
        }
    }
}

export interface ClusterReport {
    k: number;
    n_items: number;
    silhouette: number | null;
    nmi_vs_taxonomy: number | null;
    clusters: Array<{
        id: number;
        size: number;
        top_terms: string[];
        dominant_subcategory: string | null;
        purity: number;
        other_share: number;
        stores: Record<string, number>;
        examples: string[];
        suggested_name?: string;
    }>;
    suggested_new_categories: number[];
    outliers: Array<{ offer_id: number; name: string; subcategory: string | null; similarity: number }>;
}
