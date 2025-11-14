# Price History Optimization

## What Changed

We've optimized the price history storage from a separate table to a JSONB field within the products table. This provides better performance and keeps related data together.

---

## Before vs After

### ❌ Before (Separate Table)
- Separate `price_history` table
- Each price update = new row insert
- Requires JOIN to get price history
- More database operations per scrape

### ✅ After (JSONB Field)
- Price history stored in `products.priceHistory` JSONB field
- Structure: `{ "Store Name": { "2024-01-15": 5000, "2024-01-14": 4900 } }`
- No separate table needed
- Single update operation
- No JOINs required
- Automatic history limit (100 entries per store)

---

## Data Structure

The `priceHistory` field structure:

```typescript
{
  "D Sport": {
    "2024-01-15": 5000,
    "2024-01-14": 4900,
    "2024-01-13": 5100,
    ...
  },
  "Buzz Sneakers MK": {
    "2024-01-15": 4500,
    "2024-01-14": 4500,
    ...
  }
}
```

**Key** = Store name  
**Value** = Object with date (YYYY-MM-DD) as key and price as value

---

## Performance Benefits

1. **Fewer Database Operations**
   - Before: 2 operations (upsert product + insert history)
   - After: 2 operations, but second one is just an UPDATE (not INSERT)

2. **No JOINs Needed**
   - Price history comes with product data automatically
   - Single query to get product + all price history

3. **Atomic Updates**
   - Price history update is part of product update
   - Better data consistency

4. **Storage Efficiency**
   - JSONB is efficient in PostgreSQL
   - No separate index maintenance for price_history table

---

## Implementation Details

### Product Entity

```typescript
@Column('jsonb', { nullable: true, default: {} })
priceHistory?: Record<string, Record<string, number>>;
```

### Service Method

`addPriceHistory()` now:
1. Fetches the product
2. Gets existing price history for the store
3. Adds/updates the price for the date
4. Limits to last 100 entries per store (keeps most recent)
5. Updates the product with merged price history

### History Limit

- **Max entries per store**: 100
- Keeps the **most recent** entries
- Automatically removes oldest entries when limit exceeded
- Prevents JSONB field from growing too large

---

## Migration Notes

### Existing Data

If you have existing data in the `price_history` table:
- Old table is no longer used
- You can drop it or keep it for reference
- New scrapes will use the JSONB field

### Database Schema

TypeORM will automatically:
- Add `priceHistory` JSONB column to `products` table
- Remove/ignore `price_history` table (if it exists)

---

## Usage Example

```typescript
// Adding price history (automatic)
await postgresService.addPriceHistory(
  'product-id',
  'D Sport',
  5000,
  new Date()
);

// Getting product with history
const product = await postgresService.findProductById('product-id');
console.log(product.priceHistory);
// {
//   "D Sport": {
//     "2024-01-15": 5000,
//     "2024-01-14": 4900
//   }
// }
```

---

## Querying Price History

### Get all history for a product
```typescript
const product = await postgresService.findProductById(id);
const history = product.priceHistory; // Already included!
```

### Get history for specific store
```typescript
const product = await postgresService.findProductById(id);
const storeHistory = product.priceHistory?.['D Sport'] || {};
```

### Get latest price for store
```typescript
const product = await postgresService.findProductById(id);
const storeHistory = product.priceHistory?.['D Sport'] || {};
const dates = Object.keys(storeHistory).sort().reverse();
const latestPrice = storeHistory[dates[0]];
```

### PostgreSQL JSONB Queries (Advanced)

```sql
-- Get products with price history
SELECT id, name, priceHistory FROM products;

-- Get products where specific store has history
SELECT * FROM products 
WHERE priceHistory ? 'D Sport';

-- Get price history for specific store
SELECT priceHistory->'D Sport' FROM products WHERE id = 'product-id';
```

---

## Benefits Summary

✅ **Better Performance** - Fewer database operations  
✅ **Simpler Queries** - No JOINs needed  
✅ **Atomic Updates** - Price history update is part of product update  
✅ **Automatic Limiting** - Keeps only recent 100 entries per store  
✅ **Efficient Storage** - JSONB is optimized for this use case  
✅ **Easy Access** - Price history comes with product automatically  

---

## Configuration

To change the history limit, update in `postgres.service.ts`:

```typescript
private readonly MAX_HISTORY_ENTRIES = 100; // Change this value
```

Recommended values:
- **50-100** for most use cases (good balance)
- **200+** if you need longer history (more storage)
- **30** for lightweight storage

---

## Notes

- Price history is automatically added when scrapers run
- History is limited to prevent JSONB field from growing too large
- Dates are stored in ISO format (YYYY-MM-DD)
- Prices are stored as numbers (not strings)
- Old `price_history` table is no longer used (can be dropped)

