# Quick MongoDB Setup - Choose Your Option

## ⚡ FASTEST OPTION: MongoDB Atlas (Cloud - No Installation)

### 1. Go to: https://www.mongodb.com/cloud/atlas/register
### 2. Create free account (M0 cluster)
### 3. Click "Database Access" → Add user (save username/password!)
### 4. Click "Network Access" → Allow from anywhere (0.0.0.0/0)
### 5. Click "Database" → "Connect" → "Connect your application"
### 6. Copy connection string, replace `<password>` with your password
### 7. Add database name: `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/price_runner?retryWrites=true&w=majority`
### 8. Update `backend/.env` with your connection string

**✅ Done! No installation needed!**

---

## 🏠 LOCAL OPTION: Install MongoDB

### 1. Download: https://www.mongodb.com/try/download/community
### 2. Install with default settings (includes MongoDB Compass)
### 3. MongoDB starts automatically
### 4. Use: `MONGODB_URI=mongodb://localhost:27017/price_runner`

---

## ✅ Test Connection

Run this to test your setup:

```bash
cd backend
node setup-database.js
```

Should see: "✅ Connected to MongoDB successfully!"

---

## 🚀 Next Steps

1. **Start Backend**:
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Test API**:
   - Visit: http://localhost:3000/products
   - Should return: `[]` (empty - this is correct!)

3. **Database is ready!** MongoDB creates the database automatically on first write.

---

## ❓ Need Help?

- Check `MONGODB_SETUP.md` for detailed instructions
- The database doesn't need to exist - it's created automatically!
- Just make sure MongoDB is running (local) or connection string is correct (Atlas)

