# PostgreSQL Setup Guide

## Quick Start

### Step 1: Install PostgreSQL

#### Option A: Download and Install (Windows)

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Or use installer: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - Choose latest version (PostgreSQL 16 or 15)

2. **Install PostgreSQL**
   - Run the installer
   - Choose installation directory (default is fine)
   - **Important**: Remember the password you set for `postgres` superuser!
   - Default port: 5432 (keep default)
   - Default locale: (keep default)
   - Click "Install"

3. **Verify Installation**
   - PostgreSQL should start automatically
   - You can check in Services (services.msc) - look for "postgresql-x64-*"

#### Option B: Docker (If you have Docker)

```bash
docker run --name postgres-price-runner -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=price_runner -p 5432:5432 -d postgres
```

#### Option C: Cloud (ElephantSQL, Supabase, AWS RDS, etc.)

1. Sign up for free tier
2. Get connection details
3. Use those in `.env` file

---

### Step 2: Configure Backend

1. **Create `.env` file in `backend/` directory:**

   ```env
   # PostgreSQL Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_password_here
   DB_DATABASE=price_runner
   
   # Server Port
   PORT=3000
   ```

   **Replace `your_password_here` with your PostgreSQL password!**

2. **Create `.env` file (PowerShell):**

   ```powershell
   cd D:\Users\User\Desktop\MARIJA\DIPLOMSKA\price_runner\backend
   
   @"
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_DATABASE=price_runner
   PORT=3000
   "@ | Out-File -FilePath .env -Encoding utf8
   ```

   **⚠️ Change password to your actual PostgreSQL password!**

---

### Step 3: Setup Database

Run the setup script:

```bash
cd backend
node setup-postgres.js
```

This will:
- Connect to PostgreSQL
- Create the `price_runner` database if it doesn't exist
- Verify connection

**Expected output:**
```
✅ Connected to PostgreSQL successfully!
✅ Database "price_runner" created successfully!
✅ PostgreSQL setup complete!
```

---

### Step 4: Start Backend

```bash
cd backend
npm run start:dev
```

**First time running:**
- TypeORM will automatically create tables (`products`, `price_history`)
- You'll see connection logs
- Should see: "NestJS application created successfully"

**Expected logs:**
```
Query: CREATE TABLE "products" ...
Query: CREATE TABLE "price_history" ...
```

---

### Step 5: Test Connection

1. **Test API**: http://localhost:3000/products
   - Should return: `[]` (empty array - correct!)

2. **Test Scraper**: http://localhost:3000/scraper/run-now
   - Wait for completion
   - Check: http://localhost:3000/products
   - Should return products!

---

## Troubleshooting

### Connection Failed: "ECONNREFUSED"

**Problem**: PostgreSQL is not running

**Solution**:
1. Check if PostgreSQL service is running:
   ```powershell
   # Windows
   services.msc
   # Look for "postgresql-x64-*" service
   ```

2. Start PostgreSQL service:
   ```powershell
   # Windows
   net start postgresql-x64-16
   # Or use Services GUI
   ```

3. Verify PostgreSQL is listening:
   ```powershell
   netstat -an | findstr 5432
   # Should see LISTENING
   ```

---

### Authentication Failed: "password authentication failed"

**Problem**: Wrong username or password

**Solution**:
1. Check `.env` file - ensure password is correct
2. Try connecting with pgAdmin or psql to verify credentials
3. If forgot password, you can reset it (requires admin access)

---

### Database Creation Failed: "permission denied"

**Problem**: User doesn't have permission to create database

**Solution**:
1. Connect as superuser (`postgres` user)
2. Grant permissions:
   ```sql
   -- Connect as postgres user
   ALTER USER postgres WITH CREATEDB;
   ```

---

### Tables Not Created

**Problem**: TypeORM synchronize might be disabled

**Solution**:
1. Check `backend/src/postgres/postgres.module.ts`
2. Ensure `synchronize: true` (or use migrations in production)
3. Restart backend server

---

## Using PostgreSQL GUI Tools

### pgAdmin (Included with PostgreSQL)

1. Open pgAdmin (usually in Start Menu)
2. Connect to PostgreSQL server
3. Navigate to Databases → price_runner
4. Browse tables and data

### Alternative Tools

- **DBeaver**: Free, cross-platform
- **TablePlus**: Modern GUI (free tier available)
- **DataGrip**: JetBrains (paid)

---

## Production Setup

### Disable Auto-Sync

In production, disable automatic table creation:

```typescript
// backend/src/postgres/postgres.module.ts
synchronize: process.env.NODE_ENV !== 'production',
```

### Use Migrations

For production, use TypeORM migrations instead of `synchronize`:

```bash
npm install -g typeorm
typeorm migration:generate -n InitialMigration
typeorm migration:run
```

---

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_DATABASE` | Database name | `price_runner` |
| `PORT` | Backend server port | `3000` |

---

## Database Schema

### Products Table

- `id` (VARCHAR, Primary Key)
- `name` (VARCHAR)
- `brand` (VARCHAR, nullable)
- `category` (VARCHAR, nullable)
- `subcategory` (VARCHAR, nullable)
- `gender` (VARCHAR, nullable)
- `age` (VARCHAR, nullable)
- `color` (VARCHAR, nullable)
- `image` (VARCHAR, nullable)
- `priceMap` (JSONB)
- `storeLinks` (JSONB)
- `productUrl` (VARCHAR, nullable)
- `currency` (VARCHAR, default: 'MKD')
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

### Price History Table

- `id` (SERIAL, Primary Key)
- `productId` (VARCHAR, Foreign Key)
- `store` (VARCHAR)
- `price` (DECIMAL)
- `date` (TIMESTAMP)
- Index on: `(productId, store, date)`

---

## Next Steps

1. ✅ Install PostgreSQL
2. ✅ Create `.env` file
3. ✅ Run `setup-postgres.js`
4. ✅ Start backend server
5. ✅ Test API endpoints
6. ✅ Run scraper to populate data

---

## Need Help?

- Check PostgreSQL logs (usually in `C:\Program Files\PostgreSQL\*\data\log`)
- Verify `.env` file exists and has correct values
- Test connection with `psql` or `pgAdmin`
- Check backend logs for detailed error messages

