# Scraper Optimization for Daily Runs

## Problem

Scraping was stopping after some time due to:
- Too many database operations (2 operations per product)
- Connection pool exhaustion
- Memory issues
- No error recovery
- Timeouts

## Solutions Implemented

### 1. **Combined Database Operations** ✅

**Before:**
```typescript
await this.db.upsertProduct(doc);
await this.db.addPriceHistory(id, STORE, price, now.toDate());
```

**After:**
```typescript
await this.db.upsertProduct(doc, STORE, price, now.toDate());
```

**Benefits:**
- **50% fewer database operations** (1 instead of 2 per product)
- Single atomic update
- Price history is updated during product upsert
- No separate query needed

---

### 2. **Connection Pooling** ✅

Added proper connection pool configuration:

```typescript
extra: {
    max: 20,                      // Max 20 connections
    idleTimeoutMillis: 30000,    // Close idle after 30s
    connectionTimeoutMillis: 30000,
},
poolSize: 20,                     // Connection pool size
acquireTimeoutMillis: 60000,      // Wait 60s for connection
timeout: 60000,                   // Query timeout 60s
```

**Benefits:**
- Prevents connection exhaustion
- Reuses connections efficiently
- Handles connection timeouts gracefully
- Better resource management

---

### 3. **Error Handling & Recovery** ✅

**Added:**
- Try-catch blocks around critical operations
- Error logging with stack traces
- Continue on individual product failures
- Graceful degradation

**Example:**
```typescript
private async scrapePdp(productUrl: string, ...) {
    try {
        // Scrape product
        await this.db.upsertProduct(doc, STORE, price, now.toDate());
    } catch (error) {
        this.log.error(`Error scraping PDP ${productUrl}:`, error.message);
        // Continue with next product instead of stopping
    }
}
```

**Benefits:**
- Scraper continues even if one product fails
- Detailed error logs for debugging
- No silent failures
- Better monitoring

---

### 4. **Progress Tracking** ✅

Added progress tracking in scraper service:

```typescript
@Cron('0 5 * * *')
async runAll() {
    const startTime = Date.now();
    this.log.log('=== Starting full scraper run ===');
    
    try {
        // Run all scrapers...
    } catch (error) {
        this.log.error('Critical error in scraper run:', error.message);
    }
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    this.log.log(`=== Scraper run completed in ${duration} minutes ===`);
}
```

**Benefits:**
- Track total execution time
- Monitor scraper progress
- Identify slow sections
- Better logging

---

### 5. **Optimized Price History Storage** ✅

Price history is now stored in product record (JSONB):
- No separate table needed
- No JOINs required
- Single update operation
- Automatic history limiting (100 entries per store)

**Structure:**
```json
{
  "D Sport": {
    "2024-01-15": 5000,
    "2024-01-14": 4900,
    ...
  }
}
```

---

## Performance Improvements

### Database Operations
- **Before:** 2 operations per product = ~10,000 products = 20,000 DB ops
- **After:** 1 operation per product = ~10,000 products = 10,000 DB ops
- **Reduction:** 50% fewer database operations

### Connection Usage
- **Before:** Connections could exhaust, causing timeouts
- **After:** Pool of 20 connections, reused efficiently
- **Result:** No more connection exhaustion

### Error Recovery
- **Before:** One failed product could stop entire run
- **After:** Failed products logged, run continues
- **Result:** More reliable daily runs

---

## Configuration

### Connection Pool Settings

Edit `backend/src/postgres/postgres.module.ts`:

```typescript
poolSize: 20,                     // Adjust based on your DB server
acquireTimeoutMillis: 60000,      // Increase if DB is slow
timeout: 60000,                   // Query timeout
```

### Max History Entries

Edit `backend/src/postgres/postgres.service.ts`:

```typescript
private readonly MAX_HISTORY_ENTRIES = 100;  // Adjust as needed
```

### Concurrent Scraping

Each scraper uses `pLimit(4)` - adjust in individual scrapers:

```typescript
private readonly limit = pLimit(4);  // 4 concurrent requests
```

---

## Monitoring

### Check Logs

After scraper runs, check logs for:
- `=== Scraper run completed in X minutes ===`
- Error messages for failed products
- Connection timeout warnings

### Database Performance

Monitor PostgreSQL:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Check connection pool usage
SELECT max_conn, used, reserved, free FROM pg_stat_database;
```

---

## Best Practices

1. **Run During Off-Peak Hours** (currently 5 AM)
   - Less server load
   - Better performance
   - Less likely to hit rate limits

2. **Monitor Memory Usage**
   - Watch for memory leaks
   - Adjust concurrent limits if needed

3. **Check Logs Regularly**
   - Identify failing products
   - Monitor execution time
   - Track error patterns

4. **Database Maintenance**
   - Regular VACUUM ANALYZE
   - Monitor table growth
   - Check index usage

---

## Troubleshooting

### Issue: Scraper Still Stopping

**Check:**
1. Database connection pool exhausted?
   - Increase `poolSize` in postgres.module.ts
   - Check PostgreSQL `max_connections`

2. Memory issues?
   - Reduce concurrent limits (`pLimit(4)` → `pLimit(2)`)
   - Check server memory

3. Network timeouts?
   - Increase timeout values
   - Check internet connection

4. Database locks?
   - Check for long-running queries
   - Ensure `synchronize: false` in production

### Issue: Too Slow

**Solutions:**
1. Increase concurrent limits (if server can handle it)
2. Reduce sleep times between requests
3. Optimize database indexes
4. Use faster database server

### Issue: Missing Products

**Check:**
1. Error logs for failed products
2. Network connectivity issues
3. Website structure changes
4. Rate limiting from websites

---

## Expected Performance

After optimizations:
- **50% fewer database operations**
- **No connection pool exhaustion**
- **Better error recovery**
- **Reliable daily runs**
- **Faster execution** (fewer DB ops)

---

## Next Steps

1. **Monitor First Run**
   - Check logs after first optimized run
   - Verify all products are scraped
   - Check execution time

2. **Fine-Tune Settings**
   - Adjust connection pool if needed
   - Adjust concurrent limits
   - Adjust history limits

3. **Set Up Monitoring**
   - Database monitoring
   - Application logging
   - Error alerts

---

## Summary

✅ **Combined operations** - 50% fewer DB operations  
✅ **Connection pooling** - No more exhaustion  
✅ **Error handling** - Continue on failures  
✅ **Progress tracking** - Better monitoring  
✅ **Optimized storage** - Single update per product  

The scraper should now be able to run reliably every day!

