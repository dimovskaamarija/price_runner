# Quick Setup Instructions

## Prerequisites
- Node.js installed
- MongoDB installed locally OR MongoDB Atlas account

---

## Step 1: Install MongoDB (Choose One)

### Option A: Local MongoDB (Recommended for Development)

1. Download from: https://www.mongodb.com/try/download/community
2. Install with default settings
3. MongoDB will start automatically as a Windows service

### Option B: MongoDB Atlas (Cloud - Free Tier)

1. Sign up at: https://www.mongodb.com/cloud/atlas
2. Create a free cluster (M0)
3. Create database user
4. Allow access from anywhere (0.0.0.0/0) for development
5. Copy connection string

---

## Step 2: Configure Backend

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create `.env` file** (copy from `.env.example`)
   ```bash
   # For local MongoDB:
   MONGODB_URI=mongodb://localhost:27017/price_runner
   
   # OR for MongoDB Atlas (replace with your connection string):
   # MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/price_runner
   ```

3. **Install dependencies** (if not already done)
   ```bash
   npm install
   ```

4. **Start backend**
   ```bash
   npm run start:dev
   ```
   
   You should see:
   - "Starting NestJS application..."
   - "NestJS application created successfully"
   - "Application is running on: http://localhost:3000"

---

## Step 3: Configure Frontend

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies** (if not already done)
   ```bash
   npm install
   ```

3. **Start frontend**
   ```bash
   npm run dev
   ```
   
   You should see:
   - "Local: http://localhost:5173"

---

## Step 4: Test the Application

1. **Open browser** to frontend URL (usually http://localhost:5173)

2. **Test API endpoints**:
   - Backend: http://localhost:3000
   - Products API: http://localhost:3000/products (should return `[]` initially)

3. **Run scraper** (optional):
   - Visit: http://localhost:3000/scraper/run-now
   - Wait for scraping to complete
   - Check products: http://localhost:3000/products

4. **Verify frontend**:
   - Products should appear in the frontend
   - Click on a product to see details

---

## Step 5: Verify MongoDB

### Using MongoDB Compass (GUI)

1. Open MongoDB Compass
2. Connect to: `mongodb://localhost:27017`
3. Navigate to `price_runner` database
4. Check `products` collection

### Using Command Line

```bash
mongosh
use price_runner
db.products.find().pretty()
db.price_history.find().pretty()
```

---

## Troubleshooting

### MongoDB Connection Failed

**Error**: "MongooseError: connect ECONNREFUSED"

**Solution**:
1. Check if MongoDB is running:
   - Windows: Check Services (services.msc) for MongoDB service
   - Or run: `mongosh` (should connect)
2. Verify `.env` file exists and `MONGODB_URI` is correct
3. Check MongoDB connection string format

### CORS Errors

**Error**: "Access to fetch blocked by CORS policy"

**Solution**:
1. Verify backend CORS settings in `backend/src/main.ts`
2. Ensure frontend URL matches CORS allowed origins
3. Restart backend after changes

### Products Not Loading

**Symptom**: Empty array returned

**Solution**:
1. Check backend logs for MongoDB connection
2. Run scraper to populate data: http://localhost:3000/scraper/run-now
3. Verify data in MongoDB directly
4. Check browser console for API errors

### Environment Variables Not Loading

**Symptom**: Using default MongoDB URI

**Solution**:
1. Ensure `.env` file is in `backend/` directory
2. Verify `.env` file format (no spaces around `=`)
3. Restart backend after creating/updating `.env`

---

## Common Commands

### Backend
```bash
cd backend
npm run start:dev    # Start development server
npm run build         # Build for production
npm run start:prod    # Run production build
```

### Frontend
```bash
cd frontend
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
```

### MongoDB
```bash
mongosh                                    # Connect to MongoDB shell
mongosh --host localhost:27017             # Explicit connection
mongosh "mongodb://localhost:27017"        # With connection string
use price_runner                           # Switch database
show collections                           # List collections
db.products.find().limit(5)                # Query products
db.products.countDocuments()               # Count products
```

---

## Next Steps

1. **Run initial scraper** to populate data
2. **Monitor MongoDB** for database growth
3. **Set up backups** (important for production)
4. **Configure production environment** variables
5. **Review** the full MIGRATION_GUIDE.md for detailed information

---

## Need Help?

- Check `MIGRATION_GUIDE.md` for detailed troubleshooting
- Verify MongoDB is running: `mongosh`
- Check backend logs for errors
- Verify `.env` file configuration
- Ensure all dependencies are installed

