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

An offer counts as active if it has a price and was seen within `ACTIVE_WINDOW_HOURS` (48) of **that store's latest scrape** (not the clock), and within `MAX_STALE_DAYS` (7). So a late or failed scrape keeps the last known prices instead of emptying the site. Offers are deleted after `OFFER_RETENTION_DAYS` (30) unseen. Products are deleted once they have no offers and aren't favorited.

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

1. **Store labels** (spec tables, breadcrumbs, crawl hints), mapped through `category_mappings` (manual overrides + earlier Gemini answers) or keyword rules from `backend/src/modules/catalog/taxonomy.ts`
2. **ML model** (`ml-service/`), accepted only if its confidence is ≥ `ML_MIN_CONFIDENCE` (0.8)
3. Keywords in the product name
4. **Gemini**: each distinct unknown label is learned once and cached, then products still unresolved are classified
5. Defaults (`Останато`, `Унисекс`, `За возрасни`)

Each offer stores per-field provenance in `offers.fieldSources` (`rules`, `mapping`, `ml`, `gemini`, `default`). Gemini output is constrained to the taxonomy enums, so it can never invent a category.

### ML service (`ml-service/`, Python + scikit-learn)

**Supervised model.** For each field it trains TF-IDF (word 1–2-grams + character 2–5-grams over name, brand, store labels, breadcrumbs and URL slug) feeding a multinomial logistic regression.

- **Training data:** the catalog labels itself (weak supervision). Only labels from trusted sources are used (`rules`, `mapping`, `gemini`, `manual`), never defaults or the model's own predictions, so errors don't feed back into training.
- **Self-improving:** every Gemini answer becomes training data, so as the model learns, Gemini is needed less.
- **Retraining:** the backend triggers `POST /train` after every scraper run.
- **Evaluation** (`GET /scraper/ml/metrics`):
  - holdout 80/20 accuracy, macro-F1, and per-class precision/recall
  - **leave-one-store-out:** train on all stores but one and test on that one. This estimates accuracy on a *new website*.
  - coverage and accuracy at the confidence threshold, which is what production actually uses
- **Quality gate:** a field's model is used only if its holdout accuracy at the threshold is ≥ `ML_MIN_PRECISION` (0.9).

Results on the page-1 test sample (about 1,000 listings):

| Field | Accuracy on an unseen store | Accuracy when confidence ≥ 0.8 |
|---|---|---|
| subcategory | 0.81 | 1.00 (covering 55% of items) |
| gender | 0.91 | 0.99 |
| age | 0.97 | 1.00 |

Expect higher coverage after a full scrape, which provides much more training data.

Model selection (ablation, leave-one-store-out): multinomial beat one-vs-rest on coverage at equal precision. Label-dropout augmentation was tried and rejected: it lowered new-store accuracy from 0.81 to 0.69 and made name-only predictions over-confident.

**Unsupervised clustering** (`GET /scraper/clusters?k=`):
- **Method:** LSA (TF-IDF → truncated SVD, 100 dimensions) + K-Means, with k chosen by silhouette. It runs on products currently on sale, using only product-type text (no brand, audience words, colors or URL scaffolding).
- **Output:**
  - natural product groups with top terms, dominant subcategory and purity
  - **suggested new categories:** clusters that are ≥ 50% `Останато`, named by Gemini if configured. On test data this found *CROCS JIBBITZ shoe charms*.
  - **outliers:** products far from every cluster centre, often mis-scraped or mis-labelled
  - NMI between clusters and the taxonomy (0.70 on test data), which measures how well the taxonomy fits the data

**Deploying.** Create a Railway service from `ml-service/`; it builds from its Dockerfile.
- On the ML service, set `DATABASE_URL` (same database) and `ML_SERVICE_TOKEN`.
- Optionally mount a volume at `/data` so the trained model survives redeploys. Without it, the model is retrained from the database on startup in about 30 seconds.
- On the backend, set `ML_SERVICE_URL` (e.g. `http://ml-service.railway.internal:8000`) and the same `ML_SERVICE_TOKEN`.

Without `ML_SERVICE_URL`, the backend skips step 2.

Run the ML tests locally with `cd ml-service && pip install -r requirements.txt pytest && python -m pytest tests`.

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
| `ACTIVE_WINDOW_HOURS` / `MAX_STALE_DAYS` / `OFFER_RETENTION_DAYS` | `48` / `7` / `30` | Active = seen within 48 h of the store's last scrape and within 7 days; deleted after 30 days unseen |
| `ML_SERVICE_URL` | – | ML service URL. Unset means ML is disabled. |
| `ML_SERVICE_TOKEN` | – | Shared secret between the backend and the ML service |
| `ML_MIN_CONFIDENCE` | `0.8` | Minimum model probability to accept a label (set it on both services) |
| `ML_MIN_PRECISION` | `0.9` | ML service: quality gate for enabling a field's model |
| `SMTP_USER` / `SMTP_PASS` | – | Price alert emails via SMTP, e.g. a Gmail address + Google App Password (free, ~500/day) |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com` / `465` | |
| `RESEND_API_KEY` | – | Alternative to SMTP. With neither set, emails are saved as HTML files in `backend/dev-emails/` (local testing) |
| `EMAIL_FROM` | `Спореди и купи <SMTP_USER>` | Sender; with Gmail use the same address as `SMTP_USER` |
| `FRONTEND_URL` | `http://localhost:5173` (emails) | Site URL used in email links (also used for CORS) |

## Admin endpoints

| Endpoint | |
|---|---|
| `GET /scraper/run-now` | Start a run in the background. `?wait=true` waits for it to finish. `?stores=A,B` limits the stores. |
| `GET /scraper/status` | Running flag and last run summary (per-site counts, price changes, Gemini usage) |
| `POST /scraper/process` | Classify + cluster + maintain without scraping. `?reclassify=true` re-labels everything. |
| `GET /scraper/preview?store=X&limit=5` | Dry-run one site |
| `GET /scraper/ml/metrics` | ML evaluation: holdout, leave-one-store-out, per-class scores, gate status |
| `GET /scraper/clusters?k=` | Clustering report: groups, suggested new categories, outliers |

## Price alerts

On a product page, **Известување за цена** lets a visitor choose:
- **Target price**: one email when the product's lowest price is at or below the target. It re-arms if the price rises above the target again.
- **Any change**: an email whenever the lowest price changes, up or down (old → new).

Logged-in users' alerts are active immediately and listed at `/alerts`. Guests enter an email and must click the confirmation link first, so nobody can sign up someone else's address. Every email has a one-click unsubscribe link, and emails use the site language the alert was created in.

Each price email shows the product image and name, the new lowest price and the store selling it, what changed (old → new with the difference, or how far below the target it is), the date the price was checked, the 3 cheapest stores, a **Buy at {store}** button, a **Compare prices** link to the product page, and an unsubscribe link.

Alerts are checked once after each **full** scrape (not on the interim passes during a run), and on `POST /scraper/process`.
