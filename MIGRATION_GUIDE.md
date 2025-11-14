# Firebase to MongoDB Migration Guide

This guide provides detailed steps for migrating from Firebase to MongoDB.

## Overview

The project has been migrated from Firebase Firestore to MongoDB. All backend services now use MongoDB, and the frontend uses REST API calls instead of direct Firebase connections.

---

## Part 1: MongoDB Setup

### Step 1.1: Install MongoDB Locally (Windows)

1. **Download MongoDB Community Server**
   - Visit: https://www.mongodb.com/try/download/community
   - Select: Windows, MSI installer
   - Choose: Complete installation (includes MongoDB Compass)

2. **Run the Installer**
   - Click "Complete" installation type
   - Check "Install MongoDB as a Service"
   - Choose "Run service as Network Service user"
   - Install MongoDB Compass (GUI tool)
   - Click "Install"

3. **Verify Installation**
   - MongoDB should start automatically
   - Open Command Prompt and run:
     ```bash
     mongod --version
     ```
   - You should see the MongoDB version

4. **Access MongoDB**
   - Default connection: `mongodb://localhost:27017`
   - Database will be created automatically when first used

### Step 1.2: Alternative - Use MongoDB Atlas (Cloud)

1. **Create Account**
   - Visit: https://www.mongodb.com/cloud/atlas
   - Sign up for free account

2. **Create Cluster**
   - Click "Build a Database"
   - Choose "FREE" tier (M0)
   - Select your preferred cloud provider and region
   - Click "Create Cluster"

3. **Configure Database Access**
   - Go to "Database Access" → "Add New Database User"
   - Create username and password (save these!)
   - Set user privileges: "Read and write to any database"
   - Click "Add User"

4. **Configure Network Access**
   - Go to "Network Access" → "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add specific IP addresses

5. **Get Connection String**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/price_runner?retryWrites=true&w=majority`

---

## Part 2: Backend Configuration

### Step 2.1: Install Dependencies

The MongoDB dependencies should already be installed, but verify:

```bash
cd backend
npm list mongoose @nestjs/mongoose
```

If not installed:
```bash
npm install mongoose @nestjs/mongoose
```

### Step 2.2: Configure Environment Variables

1. **Create `.env` file in `backend/` directory**

   For local MongoDB:
   ```env
   MONGODB_URI=mongodb://localhost:27017/price_runner
   ```

   For MongoDB Atlas:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/price_runner?retryWrites=true&w=majority
   ```

2. **Install dotenv (if not already installed)**
   ```bash
   cd backend
   npm install @nestjs/config
   ```

3. **Update `backend/src/main.ts` to load environment variables**

   Add this import at the top:
   ```typescript
   import * as dotenv from 'dotenv';
   dotenv.config();
   ```

   Or better, update `app.module.ts`:
   ```typescript
   import { ConfigModule } from '@nestjs/config';
   
   @Module({
     imports: [
       ConfigModule.forRoot({
         isGlobal: true,
         envFilePath: '.env',
       }),
       // ... other imports
     ],
   })
   ```

4. **Update `backend/src/mongodb/mongodb.module.ts`**

   Change:
   ```typescript
   MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/price_runner')
   ```

   To (if using ConfigModule):
   ```typescript
   MongooseModule.forRootAsync({
     useFactory: () => ({
       uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/price_runner',
     }),
   })
   ```

### Step 2.3: Verify Backend Configuration

1. **Check MongoDB connection**
   - The connection happens automatically when the app starts
   - Look for connection logs in the console

2. **Test the scraper endpoints**
   - Start backend: `npm run start:dev`
   - Should see: "NestJS application created successfully"
   - Should see: "Application is running on: http://localhost:3000"
   - Test: `http://localhost:3000/products` (should return empty array initially)

---

## Part 3: Frontend Configuration

### Step 3.1: Verify Firebase Removal

1. **Check that Firebase is removed**
   ```bash
   cd frontend
   npm list firebase
   ```
   Should show: "npm ERR! code ELSPROBLEMS" (package not found)

2. **Verify API endpoint**
   - The frontend now calls: `http://localhost:3000/products`
   - Make sure this matches your backend URL

### Step 3.2: Update API Base URL (Optional)

If your backend runs on a different URL, create a config file:

1. **Create `frontend/src/config/api.ts`**
   ```typescript
   export const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';
   ```

2. **Update `ProductList.tsx`**
   ```typescript
   import { API_BASE_URL } from '../config/api';
   
   const response = await fetch(`${API_BASE_URL}/products`);
   ```

3. **Update `ProductDetail.tsx` similarly**

4. **Create `frontend/.env` (if using custom URL)**
   ```env
   VITE_API_URL=http://localhost:3000
   ```

---

## Part 4: Data Migration (If You Have Existing Firebase Data)

### Step 4.1: Export Firebase Data

1. **Install Firebase CLI** (if not installed)
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Export Firestore data**
   ```bash
   firebase firestore:export ./firebase-export
   ```

3. **Convert to JSON** (if needed)
   - The export will be in Firestore format
   - You may need to convert it to JSON

### Step 4.2: Import to MongoDB

1. **Create migration script: `backend/scripts/migrate-firebase-to-mongo.js`**
   ```javascript
   const mongoose = require('mongoose');
   const fs = require('fs');
   
   const ProductSchema = new mongoose.Schema({
     id: String,
     name: String,
     brand: String,
     // ... other fields
   }, { collection: 'products' });
   
   const Product = mongoose.model('Product', ProductSchema);
   
   async function migrate() {
     await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/price_runner');
     
     const firebaseData = JSON.parse(fs.readFileSync('./firebase-export/products.json', 'utf8'));
     
     for (const product of firebaseData) {
       await Product.findOneAndUpdate(
         { id: product.id },
         product,
         { upsert: true, new: true }
       );
     }
     
     console.log('Migration complete!');
     await mongoose.disconnect();
   }
   
   migrate();
   ```

2. **Run migration**
   ```bash
   cd backend
   node scripts/migrate-firebase-to-mongo.js
   ```

---

## Part 5: Testing the Migration

### Step 5.1: Test Backend

1. **Start MongoDB** (if local)
   - Should be running automatically (Windows Service)
   - Or start manually: `mongod`

2. **Start Backend**
   ```bash
   cd backend
   npm run start:dev
   ```

3. **Test Endpoints**
   - Open browser: http://localhost:3000
   - Should see: "Hello World!"
   - Test products: http://localhost:3000/products
   - Should return: `[]` (empty array initially)

4. **Test Scraper**
   - Trigger scraper: http://localhost:3000/scraper/run-now
   - Check logs for MongoDB operations
   - Check products endpoint again (should have data)

### Step 5.2: Test Frontend

1. **Start Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Access Application**
   - Open: http://localhost:5173 (or port shown)
   - Should load product list
   - Click on a product to see details

3. **Verify API Calls**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Should see calls to `http://localhost:3000/products`
   - Should NOT see any Firebase calls

### Step 5.3: Verify MongoDB Data

1. **Using MongoDB Compass**
   - Open MongoDB Compass
   - Connect to: `mongodb://localhost:27017`
   - Navigate to `price_runner` database
   - Check `products` collection
   - Check `price_history` collection

2. **Using MongoDB Shell**
   ```bash
   mongosh
   use price_runner
   db.products.find().pretty()
   db.price_history.find().pretty()
   ```

---

## Part 6: Troubleshooting

### Issue 1: MongoDB Connection Failed

**Symptoms:**
- Error: "MongooseError: connect ECONNREFUSED"
- Backend won't start

**Solutions:**
1. Check if MongoDB is running:
   ```bash
   # Windows
   services.msc  # Look for MongoDB service
   
   # Or check with:
   mongosh
   ```

2. Verify connection string in `.env`
3. Check firewall settings
4. For MongoDB Atlas: Check network access settings

### Issue 2: CORS Errors

**Symptoms:**
- Frontend shows CORS errors in console
- Cannot fetch products

**Solutions:**
1. Verify CORS configuration in `backend/src/main.ts`
2. Check frontend URL matches CORS origins
3. For production, update CORS origins accordingly

### Issue 3: Products Not Appearing

**Symptoms:**
- Backend returns empty array
- Scraper runs but no data

**Solutions:**
1. Check MongoDB connection logs
2. Verify scraper is using MongoDBService (not FirestoreService)
3. Check MongoDB collections exist
4. Check product data in MongoDB directly

### Issue 4: Environment Variables Not Loading

**Symptoms:**
- Using default MongoDB URI
- `.env` file ignored

**Solutions:**
1. Ensure `.env` is in `backend/` directory
2. Install `@nestjs/config` and configure it
3. Restart backend after changing `.env`

---

## Part 7: Project Structure Changes

### Files Added:
- `backend/src/mongodb/` - MongoDB service and schemas
  - `mongodb.service.ts` - Service class
  - `mongodb.module.ts` - NestJS module
  - `schemas/product.schema.ts` - Product schema
  - `schemas/price-history.schema.ts` - Price history schema
- `backend/src/products/` - REST API controllers
  - `products.controller.ts` - Product endpoints
  - `products.module.ts` - Products module

### Files Modified:
- `backend/src/app.module.ts` - Replaced FirestoreModule with MongoDBModule
- `backend/src/scraper/*.scraper.ts` - All scrapers now use MongoDBService
- `backend/src/main.ts` - Added CORS configuration
- `frontend/src/pages/ProductList.tsx` - Uses REST API
- `frontend/src/pages/ProductDetail.tsx` - Uses REST API

### Files Removed:
- `frontend/src/firebase.ts` - No longer needed
- `backend/src/firestore/` - Can be deleted (not used anymore)

### Dependencies Removed:
- `firebase` (frontend)
- `@google-cloud/firestore` (backend)
- `firebase-admin` (backend)

### Dependencies Added:
- `mongoose` (backend)
- `@nestjs/mongoose` (backend)

---

## Part 8: Production Deployment

### Step 8.1: Environment Variables

Set these in your production environment:
- `MONGODB_URI` - Your production MongoDB connection string

### Step 8.2: Update CORS

In `backend/src/main.ts`, update CORS origins:
```typescript
app.enableCors({
  origin: ['https://your-frontend-domain.com'],
  credentials: true,
});
```

### Step 8.3: Database Indexes

The schemas include indexes, but for production, consider:
```javascript
// In MongoDB
db.products.createIndex({ id: 1 }, { unique: true });
db.price_history.createIndex({ productId: 1, store: 1, date: -1 });
```

---

## Summary Checklist

- [ ] MongoDB installed and running (local or Atlas)
- [ ] Backend `.env` file created with `MONGODB_URI`
- [ ] Backend dependencies installed (`mongoose`, `@nestjs/mongoose`)
- [ ] Backend starts without errors
- [ ] Frontend Firebase dependencies removed
- [ ] Frontend uses REST API calls
- [ ] Products endpoint returns data
- [ ] Frontend displays products correctly
- [ ] MongoDB collections created (`products`, `price_history`)
- [ ] Scrapers write to MongoDB successfully
- [ ] Old Firebase files cleaned up (optional)

---

## Next Steps

1. Run the scraper to populate initial data
2. Monitor MongoDB for performance
3. Set up MongoDB backups
4. Configure production environment variables
5. Update documentation with new database info

For questions or issues, check the troubleshooting section above.

