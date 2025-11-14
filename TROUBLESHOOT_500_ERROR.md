# Troubleshooting 500 Internal Server Error

## Fixed Issues

### 1. **TypeORM Configuration Error** ✅ FIXED

**Problem:**
Invalid TypeORM configuration options:
- `poolSize`, `acquireTimeoutMillis`, `timeout` are not valid at root level
- These should only be in `extra` object

**Fix:**
Removed invalid options and corrected configuration:

```typescript
extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
}
```

---

## Next Steps to Debug

### Step 1: Check Backend Logs

**IMPORTANT:** The backend console/terminal will now show detailed error messages.

When you see the 500 error:
1. **Check your backend console/terminal** (where `npm run start:dev` is running)
2. **Look for error messages** like:
   ```
   Error getting all products: [error message]
   Stack trace: [full stack trace]
   ```

---

### Step 2: Common Causes

#### Cause 1: Database Connection Issue

**Symptoms:**
- "Connection refused" or "Connection terminated"
- "password authentication failed"

**Solutions:**

1. **Check PostgreSQL is running:**
   ```powershell
   # Check if PostgreSQL is running
   Get-Service postgresql*
   ```

2. **Verify .env file:**
   - Check `backend/.env` exists
   - Verify `DB_PASSWORD` matches your PostgreSQL password
   - Check `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_DATABASE`

3. **Test connection:**
   ```powershell
   cd backend
   node setup-postgres.js
   ```

---

#### Cause 2: Missing Column (priceHistory)

**Symptoms:**
- "column 'pricehistory' does not exist"
- "column 'priceHistory' does not exist"

**Solutions:**

1. **Restart backend** - TypeORM will add it automatically (`synchronize: true`)

2. **Or manually add column:**
   ```sql
   -- Connect to PostgreSQL
   psql -U postgres -d price_runner

   -- Add column
   ALTER TABLE products ADD COLUMN IF NOT EXISTS "priceHistory" jsonb DEFAULT '{}';
   ```

---

#### Cause 3: Invalid JSONB Data

**Symptoms:**
- "invalid input syntax for type jsonb"
- "malformed array literal"

**Solutions:**

1. **Check existing data:**
   ```sql
   SELECT id, name, "priceHistory" 
   FROM products 
   WHERE "priceHistory" IS NOT NULL 
   LIMIT 10;
   ```

2. **Reset invalid data:**
   ```sql
   UPDATE products 
   SET "priceHistory" = '{}' 
   WHERE "priceHistory" IS NULL 
   OR jsonb_typeof("priceHistory") != 'object';
   ```

---

#### Cause 4: TypeORM Query Error

**Symptoms:**
- "Cannot read property 'find' of undefined"
- "QueryFailedError"

**Solutions:**

1. **Check entity registration** - Make sure `Product` is in entities array
2. **Restart backend** - TypeORM needs to initialize
3. **Check database exists:**
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'price_runner';
   ```

---

### Step 3: Enable More Detailed Logging

Edit `backend/src/postgres/postgres.module.ts`:

```typescript
logging: true,  // Shows all SQL queries
```

This will show you the exact SQL being executed.

---

### Step 4: Check Database State

Connect to PostgreSQL and check:

```sql
-- Check if priceHistory column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name = 'priceHistory';

-- Check products table structure
\d products

-- Check for any products
SELECT count(*) FROM products;

-- Check for invalid JSONB
SELECT id, name 
FROM products 
WHERE "priceHistory" IS NOT NULL 
AND jsonb_typeof("priceHistory") != 'object';
```

---

## Quick Fixes

### Fix 1: Restart Backend

```powershell
# Stop backend (Ctrl+C)
# Then restart
cd backend
npm run start:dev
```

This will:
- Reconnect to database
- Add missing columns (if synchronize: true)
- Reinitialize TypeORM

---

### Fix 2: Reset Database (Development Only!)

⚠️ **WARNING: This will delete all data!**

```sql
-- Connect to PostgreSQL
psql -U postgres -d price_runner

-- Drop and recreate tables
DROP TABLE IF EXISTS products CASCADE;
-- Restart backend - tables will be recreated
```

---

### Fix 3: Check Environment Variables

```powershell
# In backend directory
Get-Content .env
```

Verify:
- `DB_HOST=localhost` (or your PostgreSQL host)
- `DB_PORT=5432`
- `DB_USERNAME=postgres` (or your username)
- `DB_PASSWORD=your_actual_password` ← **MOST IMPORTANT!**
- `DB_DATABASE=price_runner`

---

## Step 5: Get Exact Error Message

1. **Check backend console** when error occurs
2. **Look for error logs** like:
   ```
   [Nest] ERROR [PostgresService] Error finding all products: ...
   [Nest] ERROR [ProductsController] Error getting all products: ...
   ```

3. **Share the error message** - It will tell us exactly what's wrong!

---

## Expected Error Messages

After these fixes, you should see:

✅ **If successful:**
- Products returned
- No errors in console

❌ **If database connection issue:**
```
Error: Connection refused
Error: password authentication failed
```

❌ **If missing column:**
```
QueryFailedError: column "priceHistory" does not exist
```

❌ **If invalid data:**
```
QueryFailedError: invalid input syntax for type jsonb
```

---

## Summary

1. **Fixed TypeORM configuration** - Removed invalid options
2. **Check backend logs** - Error messages will be there
3. **Verify database connection** - Check `.env` file
4. **Restart backend** - Reinitializes TypeORM
5. **Check for missing columns** - Should auto-add with synchronize: true

---

## Still Getting 500 Error?

Please share:
1. **Exact error message** from backend console
2. **Which endpoint** triggered it (GET /products, etc.)
3. **Backend logs** showing the stack trace
4. **Database status** (is PostgreSQL running?)

This will help identify the specific issue!

