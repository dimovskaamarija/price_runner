# Scraping & Catalog Pipeline

## How it works

```
crawl sites (parallel)  ──►  offers            one row per store listing (price, link, raw labels)
                              │
classify                      ▼  rules → learned mappings → Gemini (optional)
cluster                       ▼  same model code / similar name → one product
maintain                      ▼  majority-vote fields, merge duplicates, minPrice/storeCount, cleanup
                           products            canonical product shown in the UI
```

Daily at 03:00 (or `GET /scraper/run-now`). Scrapers only extract data, and every other step is shared.

| Table | Purpose |
|---|---|
| `products` | Canonical product. `minPrice` / `storeCount` are denormalized for fast listing. |
| `offers` | Store listing: `store`, `url`, `price`, `rawLabels`, `lastSeenAt`, `productId`. |
| `price_history` | Price **change log** per offer (a row only when the price changes). |
| `category_mappings` | Learned "raw label → taxonomy value" cache (Gemini answers + manual overrides). |

An offer counts as active if it was seen in the last `ACTIVE_WINDOW_HOURS` (48). Offers are deleted after `OFFER_RETENTION_DAYS` (30) unseen. Products are deleted once they have no offers and aren't favorited.

## Adding a new website

1. Add an entry to `backend/src/modules/scraper/sites/sites.config.ts`:

   ```ts
   {
       store: 'New Shop',
       startPages: [{ url: 'https://newshop.mk/patiki', hints: { category: 'Обувки' } }],
       pageUrl: (start, page) => `${start}?page=${page}`,
       productLinks: { pattern: /\/product\/[\w-]+$/ },
       // extractor: reuse one from platforms.ts if the shop runs on a known platform.
       // Otherwise JSON-LD / OpenGraph / spec tables are read automatically,
       // and `selectors` fill gaps:
       selectors: { price: '.price-now', code: '.sku' },
   }
   ```

2. Check it with a dry run (nothing is saved):
   `GET /scraper/preview?store=New%20Shop&limit=5`
   It shows the extracted name, price, code and labels, plus the rule-based classification.

3. Run it: `GET /scraper/run-now?stores=New%20Shop`.

You don't need to touch the category lists. Labels the rules don't know are classified by Gemini once and cached in `category_mappings`. Offers with the same manufacturer code as another store's product are merged automatically.

## Classification

Order for each field (`subcategory`, `gender`, `age`, `color`):

1. `category_mappings` (manual overrides + earlier Gemini answers)
2. Keyword rules from `backend/src/modules/catalog/taxonomy.ts` (Macedonian + English)
3. Gemini label learning: each **distinct unknown label** is sent once, and the answer is cached forever
4. Gemini product classification (name + labels + URL) for products still unresolved
5. Defaults (`Останато`, `Унисекс`, `За возрасни`)

Gemini output is constrained to the taxonomy enums, so it can never invent a category.

**Correcting a mapping:** insert or update a row with `source = 'manual'`:

```sql
INSERT INTO category_mappings (kind, raw, value, source) VALUES ('subcategory', 'балетанки', 'Кондури и чизми', 'manual')
ON CONFLICT (kind, raw) DO UPDATE SET value = EXCLUDED.value, source = 'manual';
```

Then call `POST /scraper/process?reclassify=true`. The same applies after editing `taxonomy.ts`.

## Clustering (same product across stores)

1. Same normalized model code (`IB6651-300` == `ib6651 300`) and compatible brand. This covers most cases, because stores publish the brand's style code.
2. Only when one side has no code: same brand + category + gender + color, and
   - Gemini embeddings cosine ≥ `CLUSTER_EMBED_THRESHOLD` (0.93), or
   - name-token Jaccard ≥ `CLUSTER_NAME_THRESHOLD` (0.8) without Gemini.
3. Otherwise a new product is created.

Products that later turn out to share a model code are merged. Favorites and offers move to the surviving product.

## Environment variables (backend)

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | – | Postgres connection string |
| `DB_SSL` | `true` | `false` for a local DB without SSL |
| `DB_POOL_SIZE` | `10` | |
| `DB_SYNCHRONIZE` | `false` | Schema comes from migrations (run on startup). Never enable in production. |
| `GEMINI_API_KEY` | – | Optional. Without it the app runs rules-only. Get one at https://aistudio.google.com |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any Gemini model that supports structured output |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | |
| `GEMINI_MAX_CALLS_PER_RUN` | `300` | Cost safety limit per scraper run |
| `SCRAPER_TOKEN` | – | If set, `/scraper/*` requires `Authorization: Bearer <token>` or `?token=` |
| `SCRAPER_SITE_CONCURRENCY` | `3` | Sites crawled in parallel (each site uses 4 parallel requests) |
| `SCRAPER_MAX_PAGES` | `100` | Listing pages per start URL (lower it for testing) |
| `ENABLE_SCRAPER_CRON` | – | `false` disables the nightly run |
| `ACTIVE_WINDOW_HOURS` / `OFFER_RETENTION_DAYS` | `48` / `30` | |

## Admin endpoints

| Endpoint | |
|---|---|
| `GET /scraper/run-now` | Start a run in the background. `?wait=true` waits for it to finish. `?stores=A,B` limits the stores. |
| `GET /scraper/status` | Running flag and last run summary (per-site counts, price changes, Gemini usage) |
| `POST /scraper/process` | Classify + cluster + maintain without scraping. `?reclassify=true` re-labels everything. |
| `GET /scraper/preview?store=X&limit=5` | Dry-run one site |
