# .env File Setup Instructions

## ✅ .env File Created!

The `.env` file has been created at: `backend/.env`

---

## 📝 What You Need to Fill In

Open the `.env` file and update these values:

### Required Fields:

1. **`DB_PASSWORD`** - ⚠️ **MOST IMPORTANT!**
   - Replace `your_password_here` with your PostgreSQL password
   - This is the password you set when installing PostgreSQL
   - Example: `DB_PASSWORD=mypassword123`

### Optional (can use defaults):

2. **`DB_HOST`** - Usually `localhost` (already set)
   - Change if PostgreSQL is on a different server

3. **`DB_PORT`** - Usually `5432` (already set)
   - Change if PostgreSQL uses a different port

4. **`DB_USERNAME`** - Usually `postgres` (already set)
   - Change if you use a different PostgreSQL user

5. **`DB_DATABASE`** - `price_runner` (already set)
   - This database will be created automatically

6. **`PORT`** - Backend server port (already set to `3000`)
   - Change if port 3000 is already in use

7. **`NODE_ENV`** - `development` (already set)
   - Set to `production` when deploying

---

## 🔧 Quick Setup Steps

1. **Open the file**: `backend/.env`

2. **Find this line**:
   ```
   DB_PASSWORD=your_password_here
   ```

3. **Replace with your actual password**:
   ```
   DB_PASSWORD=postgres
   ```
   (Use whatever password you set during PostgreSQL installation)

4. **Save the file**

5. **Test the connection**:
   ```bash
   cd backend
   node setup-postgres.js
   ```

---

## 📋 Example .env File

After filling in your password, it should look like:

```env
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=price_runner

# Server Port
PORT=3000

# Environment
NODE_ENV=development
```

---

## ⚠️ Important Notes

1. **Never commit `.env` to git** - It's already in `.gitignore`
2. **Keep your password secure** - Don't share the `.env` file
3. **For production** - Use environment variables or secure secrets management

---

## ✅ Next Steps After Filling .env

1. **Test database connection**:
   ```bash
   cd backend
   node setup-postgres.js
   ```

2. **Start backend**:
   ```bash
   npm run start:dev
   ```

3. **Verify tables created** - TypeORM will create them automatically

---

## ❓ Troubleshooting

**"password authentication failed"**
- Check `DB_PASSWORD` in `.env` file
- Make sure password matches your PostgreSQL password

**"Connection refused"**
- Make sure PostgreSQL is running
- Check `DB_HOST` and `DB_PORT` are correct

**"database does not exist"**
- Run `node setup-postgres.js` first (creates database)

---

## 🎯 Summary

**You only need to change ONE thing:**
- `DB_PASSWORD=your_password_here` → Replace with your actual PostgreSQL password

Everything else can stay as default!

