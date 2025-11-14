# MongoDB Setup Guide - Quick Start

## Option 1: MongoDB Atlas (Cloud - Recommended for Quick Start)

This is the easiest option - no installation needed!

### Step 1: Create MongoDB Atlas Account

1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up with email (free account)
3. Choose "Free" tier (M0)

### Step 2: Create Database User

1. Go to "Database Access" → "Add New Database User"
2. Create username and password (SAVE THESE!)
3. Set privileges: "Read and write to any database"
4. Click "Add User"

### Step 3: Configure Network Access

1. Go to "Network Access" → "Add IP Address"
2. Click "Allow Access from Anywhere" (0.0.0.0/0)
3. Click "Confirm"

### Step 4: Get Connection String

1. Go to "Database" → "Connect"
2. Choose "Connect your application"
3. Copy the connection string
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
4. Add database name at the end: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/price_runner?retryWrites=true&w=majority`
5. Replace `<password>` with your actual password

### Step 5: Update .env File

In `backend/.env`:
```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/price_runner?retryWrites=true&w=majority
```

---

## Option 2: Local MongoDB Installation

### Step 1: Download MongoDB

1. Visit: https://www.mongodb.com/try/download/community
2. Select:
   - Version: Latest (or 7.0)
   - Platform: Windows
   - Package: MSI
3. Click "Download"

### Step 2: Install MongoDB

1. Run the downloaded MSI file
2. Choose "Complete" installation
3. Check "Install MongoDB as a Service"
4. Check "Install MongoDB Compass" (GUI tool)
5. Click "Install"
6. Wait for installation to complete

### Step 3: Verify Installation

1. MongoDB should start automatically
2. Open Command Prompt and test:
   ```bash
   # Try to connect (if mongosh is installed)
   mongosh
   
   # OR check if service is running
   sc query MongoDB
   ```

### Step 4: Update .env File

In `backend/.env`:
```
MONGODB_URI=mongodb://localhost:27017/price_runner
```

---

## Step 6: Create Database

**You don't need to manually create the database!**

MongoDB will automatically create the `price_runner` database and collections (`products`, `price_history`) when your application first writes data.

---

## Step 7: Test Connection

1. Start backend:
   ```bash
   cd backend
   npm run start:dev
   ```

2. Look for successful connection in logs:
   - Should see "NestJS application created successfully"
   - No MongoDB connection errors

3. Test API:
   - Visit: http://localhost:3000/products
   - Should return: `[]` (empty array - this is correct!)

---

## Troubleshooting

### Connection Failed
- **Local**: Check if MongoDB service is running (services.msc)
- **Atlas**: Verify IP is whitelisted (0.0.0.0/0 for development)
- **Both**: Check `.env` file exists and `MONGODB_URI` is correct

### Database Not Found
- This is normal! Database is created automatically on first write
- Run scraper to create data: http://localhost:3000/scraper/run-now

### Authentication Failed (Atlas)
- Double-check username and password in connection string
- Ensure password is URL-encoded (special chars need encoding)

