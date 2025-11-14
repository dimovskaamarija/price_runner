# Database Setup Instructions

## ⚠️ IMPORTANT: You DON'T Need to Create the Database Manually!

MongoDB will **automatically create** the `price_runner` database and collections when your application first writes data. You just need to:

1. Set up MongoDB (local OR cloud)
2. Configure connection string
3. Start the application

---

## Step 1: Set Up MongoDB

### Option A: MongoDB Atlas (Cloud - Easiest)

1. **Create Account**: https://www.mongodb.com/cloud/atlas/register
2. **Create Free Cluster**: Choose M0 (free tier)
3. **Create Database User**:
   - Go to "Database Access"
   - Click "Add New Database User"
   - Create username/password (SAVE THESE!)
   - Choose "Read and write to any database"
4. **Configure Network Access**:
   - Go to "Network Access"
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
5. **Get Connection String**:
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your password
   - Add database name: `mongodb+srv://user:pass@cluster.xxx.mongodb.net/price_runner?retryWrites=true&w=majority`

### Option B: Local MongoDB

1. **Download**: https://www.mongodb.com/try/download/community
2. **Install** with default settings
3. **MongoDB starts automatically**
4. **Connection string**: `mongodb://localhost:27017/price_runner`

---

## Step 2: Create .env File

**In `backend/` directory, create a file named `.env`:**

```bash
cd backend
```

Then create the file with this content:

**For Local MongoDB:**
```
MONGODB_URI=mongodb://localhost:27017/price_runner
```

**For MongoDB Atlas:**
```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/price_runner?retryWrites=true&w=majority
```

**Example of creating .env file (PowerShell):**
```powershell
cd D:\Users\User\Desktop\MARIJA\DIPLOMSKA\price_runner\backend
@"
MONGODB_URI=mongodb://localhost:27017/price_runner
PORT=3000
"@ | Out-File -FilePath .env -Encoding utf8
```

Or manually:
1. Open `backend/` folder
2. Create new file named `.env` (with the dot at the start!)
3. Paste the connection string

---

## Step 3: Test Connection

Run the test script:

```bash
cd backend
node setup-database.js
```

You should see:
```
✅ Connected to MongoDB successfully!
✅ Database setup complete!
```

---

## Step 4: Start Application

```bash
cd backend
npm run start:dev
```

Should see:
- "NestJS application created successfully"
- "Application is running on: http://localhost:3000"
- **NO MongoDB connection errors**

---

## Step 5: Verify Database Works

1. **Test API**: http://localhost:3000/products
   - Should return: `[]` (empty array - this is correct!)

2. **Run Scraper**: http://localhost:3000/scraper/run-now
   - Wait for completion
   - Check: http://localhost:3000/products
   - Should return products!

---

## Troubleshooting

### "MongoDB connection failed"
- **Local**: Check if MongoDB service is running (services.msc)
- **Atlas**: Verify IP is whitelisted (0.0.0.0/0)
- **Both**: Check `.env` file exists and connection string is correct

### ".env file not found"
- Make sure file is named `.env` (with dot at start)
- Make sure file is in `backend/` directory
- Check file is not hidden (Windows may hide dot-files)

### "Database doesn't exist"
- This is **normal**! Database is created automatically
- Run scraper to create data and database will be created

---

## Ready for Git!

Once database connection works, you're ready to commit to git!

