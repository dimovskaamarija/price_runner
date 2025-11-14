# PostgreSQL Quick Setup

## ⚡ Fast Setup (5 minutes)

### 1. Install PostgreSQL

**Windows:**
1. Download: https://www.postgresql.org/download/windows/
2. Install with default settings
3. **Remember the password** you set for `postgres` user!

### 2. Create `.env` File

**In `backend/` directory, create `.env` file:**

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password_here
DB_DATABASE=price_runner
PORT=3000
```

**Replace `your_password_here` with your PostgreSQL password!**

**PowerShell command:**
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

### 3. Setup Database

```bash
cd backend
node setup-postgres.js
```

**Expected:**
```
✅ Connected to PostgreSQL successfully!
✅ Database "price_runner" created successfully!
✅ PostgreSQL setup complete!
```

### 4. Start Backend

```bash
cd backend
npm run start:dev
```

**First time:**
- TypeORM will create tables automatically
- Should see: "NestJS application created successfully"
- Tables will be created: `products`, `price_history`

### 5. Test

1. **API**: http://localhost:3000/products → Should return `[]`
2. **Scraper**: http://localhost:3000/scraper/run-now
3. **Check**: http://localhost:3000/products → Should return products!

---

## ✅ Done!

Your database is ready! Tables are created automatically.

---

## 🔧 Troubleshooting

**"ECONNREFUSED"** → PostgreSQL not running
- Check Services: `services.msc` → Start `postgresql-*` service

**"password authentication failed"** → Wrong password
- Check `.env` file - verify password matches PostgreSQL install

**"database does not exist"** → Run `setup-postgres.js` first

---

## 📚 More Info

See `POSTGRESQL_SETUP.md` for detailed instructions.

