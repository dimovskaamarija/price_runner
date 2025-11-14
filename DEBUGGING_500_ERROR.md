# Debugging 500 Internal Server Error

## What I Fixed

I've added comprehensive error handling and fixed several potential issues:

### 1. **Fixed Update Logic**
   - Before: Was spreading entire `doc` object, which could include `createdAt` (shouldn't be updated)
   - After: Explicitly setting each field to avoid conflicts

### 2. **Added Error Handling**
   - All methods now have try-catch blocks
   - Detailed error logging with stack traces
   - Controller returns proper HTTP error codes

### 3. **Fixed Price History Update**
   - Now properly clones the priceHistory object before modifying
   - Better handling of nested JSONB structure

### 4. **Added Product Interface Field**
   - Added `priceHistory` to Product interface
   - Added `color` field (was missing)

---

## How to Debug

### Step 1: Check Backend Logs

When the 500 error occurs, check your backend console/terminal. You should now see detailed error messages like:

```
Error upserting product abc123: [error message]
Stack trace: [full stack trace]
```

**Look for:**
- Database connection errors
- Constraint violations
- Type mismatches
- JSONB parsing errors

### Step 2: Common Issues and Solutions

#### Issue 1: Database Connection Lost
**Error**: "Connection terminated unexpectedly" or "Connection refused"

**Solution**:
- Check if PostgreSQL is running
- Verify `.env` file has correct credentials
- Test connection: `node setup-postgres.js`

#### Issue 2: Column Doesn't Exist
**Error**: "column 'pricehistory' does not exist" or similar

**Solution**:
- The `priceHistory` column needs to be added
- Restart backend - TypeORM will add it automatically (synchronize: true)
- Or manually add column in PostgreSQL

#### Issue 3: JSONB Type Mismatch
**Error**: "invalid input syntax for type jsonb"

**Solution**:
- Check that priceHistory structure is correct
- Should be: `{ "Store": { "2024-01-15": 5000 } }`
- Not: `{ "Store": [ { date: "...", price: ... } ] }`

#### Issue 4: Constraint Violation
**Error**: "duplicate key value violates unique constraint"

**Solution**:
- Product ID already exists but with different data
- Check if ID generation is unique

---

## Step 3: Check Specific Endpoint

### If error occurs on GET /products:
- Check database connection
- Verify products table exists
- Check if any products have invalid JSONB data

### If error occurs on POST/INSERT (scraper):
- Check the specific product being inserted
- Verify all required fields are present
- Check priceHistory structure

### If error occurs on GET /products/:id:
- Check if product exists
- Verify JSONB fields are valid

---

## Step 4: Manual Database Check

Connect to PostgreSQL and check:

```sql
-- Check if priceHistory column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'priceHistory';

-- Check products data
SELECT id, name, "priceHistory" FROM products LIMIT 1;

-- Check for invalid JSONB
SELECT id, name 
FROM products 
WHERE "priceHistory" IS NOT NULL 
AND jsonb_typeof("priceHistory") != 'object';
```

---

## Step 5: Enable More Logging

Add to `backend/src/postgres/postgres.module.ts`:

```typescript
logging: true,  // Shows all SQL queries
```

This will show you the exact SQL being executed.

---

## Quick Fixes

### Fix 1: Drop and Recreate Tables (Development Only)

```sql
-- Connect to PostgreSQL
psql -U postgres -d price_runner

-- Drop tables
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Restart backend - TypeORM will recreate tables
```

### Fix 2: Add Missing Column Manually

```sql
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS "priceHistory" jsonb DEFAULT '{}';
```

### Fix 3: Fix Invalid JSONB Data

```sql
-- Reset invalid priceHistory to empty object
UPDATE products 
SET "priceHistory" = '{}' 
WHERE "priceHistory" IS NULL OR jsonb_typeof("priceHistory") != 'object';
```

---

## Next Steps

1. **Restart your backend** - The new error handling will show detailed errors
2. **Check console logs** when error occurs - Look for the error message
3. **Try the operation again** - The error message will tell you what's wrong
4. **Share the error message** - If still having issues, share the exact error from logs

---

## Expected Behavior After Fixes

✅ **Better Error Messages**: You'll see detailed errors in console  
✅ **Proper HTTP Responses**: 500 errors will include error details  
✅ **No Silent Failures**: All errors are logged  
✅ **Fixed Update Logic**: No more trying to update createdAt  

---

## Still Getting 500 Error?

Please share:
1. **Exact error message** from backend console/terminal
2. **Which endpoint** triggered it (GET /products, POST, etc.)
3. **Backend logs** showing the stack trace
4. **PostgreSQL version** (run: `psql --version`)

This will help identify the specific issue!

