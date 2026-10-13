# 🚀 Deployment Guide - Easiest & Cheapest Options

This guide covers the **easiest and cheapest** ways to deploy your Price Runner application.

## 📋 Application Overview

Your app consists of:
- **Frontend**: React + Vite (port 5173 in dev)
- **Backend**: NestJS API (port 3000)
- **Auth Server**: Express server (port 4000)
- **Database**: PostgreSQL

---

## 🏆 **RECOMMENDED: Railway (Easiest - All-in-One)**

**Cost**: Free $5 credit/month (usually enough for small apps), then ~$5-10/month

**Why Railway?**
- ✅ Deploy everything in one place (frontend, backend, auth, database)
- ✅ Automatic deployments from GitHub
- ✅ Free PostgreSQL database included
- ✅ Very easy setup (5-10 minutes)
- ✅ No credit card required for free tier

### Step 1: Prepare Your Code

1. **Update CORS in backend** to allow your production domain:
   ```typescript
   // backend/src/main.ts
   app.enableCors({
       origin: [
           'http://localhost:5173',
           'http://localhost:3000',
           'http://localhost:4000',
           'https://your-app-name.up.railway.app', // Add your Railway frontend URL
           process.env.FRONTEND_URL || '', // Or use env variable
       ].filter(Boolean),
       credentials: true,
   });
   ```

2. **Update backend port** to use Railway's PORT:
   ```typescript
   // backend/src/main.ts
   const port = process.env.PORT || 3000;
   await app.listen(port);
   ```

3. **Update auth server port** similarly:
   ```typescript
   // authkit-server/src/server.ts
   const port = process.env.PORT || 4000;
   ```

### Step 2: Deploy to Railway

1. **Sign up**: Go to https://railway.app and sign up with GitHub

2. **Create New Project** → "Deploy from GitHub repo"

3. **Add Services** (add these 3 services):
   
   **a) PostgreSQL Database:**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will create a PostgreSQL instance
   - Copy the connection details (you'll need them)

   **b) Backend Service:**
   - Click "New" → "GitHub Repo" → Select your repo
   - Set **Root Directory**: `backend`
   - Set **Build Command**: `npm install && npm run build`
   - Set **Start Command**: `npm run start:prod`
   - Add **Environment Variables**:
     ```
     DB_HOST=<from PostgreSQL service>
     DB_PORT=5432
     DB_USERNAME=<from PostgreSQL service>
     DB_PASSWORD=<from PostgreSQL service>
     DB_DATABASE=railway
     PORT=3000
     NODE_ENV=production
     FRONTEND_URL=https://your-frontend-url.up.railway.app
     ```
   - Click "Generate Domain" to get your backend URL

   **c) Auth Server:**
   - Click "New" → "GitHub Repo" → Select your repo
   - Set **Root Directory**: `authkit-server`
   - Set **Build Command**: `npm install`
   - Set **Start Command**: `npm run dev` (or add a production script)
   - Add **Environment Variables** (same DB connection + your WorkOS keys)
   - Click "Generate Domain" to get your auth URL

   **d) Frontend Service:**
   - Click "New" → "GitHub Repo" → Select your repo
   - Set **Root Directory**: `frontend`
   - Set **Build Command**: `npm install && npm run build`
   - Set **Start Command**: `npx serve -s dist -l 3000`
   - Add **Environment Variables**:
     ```
     VITE_API_URL=https://your-backend-url.up.railway.app
     VITE_AUTH_API_URL=https://your-auth-url.up.railway.app
     ```
   - Click "Generate Domain" to get your frontend URL

4. **Update Environment Variables** with the actual URLs:
   - Update `FRONTEND_URL` in backend with frontend URL
   - Update `VITE_API_URL` and `VITE_AUTH_API_URL` in frontend

5. **Run Database Migrations**:
   - In backend service, go to "Settings" → "Deploy" → Add a one-time command:
     `npm run start:prod` (TypeORM will create tables on first run)

---

## 🥈 **ALTERNATIVE: Render (Free Tier)**

**Cost**: Free tier available (with limitations), then ~$7/month per service

**Why Render?**
- ✅ Free tier for web services
- ✅ Free PostgreSQL database
- ✅ Automatic deployments
- ⚠️ Services sleep after 15 min inactivity (free tier)

### Step 1: Deploy PostgreSQL Database

1. Go to https://render.com
2. "New" → "PostgreSQL"
3. Name: `price-runner-db`
4. Plan: Free
5. Create and copy connection string

### Step 2: Deploy Backend

1. "New" → "Web Service"
2. Connect GitHub repo
3. Settings:
   - **Name**: `price-runner-backend`
   - **Root Directory**: `backend`
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Plan**: Free
4. Environment Variables:
   ```
   DB_HOST=<from PostgreSQL>
   DB_PORT=5432
   DB_USERNAME=<from PostgreSQL>
   DB_PASSWORD=<from PostgreSQL>
   DB_DATABASE=<from PostgreSQL>
   PORT=10000
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend.onrender.com
   ```

### Step 3: Deploy Auth Server

1. "New" → "Web Service"
2. Same repo, different settings:
   - **Root Directory**: `authkit-server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run dev`
   - **Plan**: Free

### Step 4: Deploy Frontend

1. "New" → "Static Site"
2. Connect GitHub repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Environment Variables:
   ```
   VITE_API_URL=https://price-runner-backend.onrender.com
   VITE_AUTH_API_URL=https://your-auth-server.onrender.com
   ```

---

## 🥉 **ALTERNATIVE: Vercel (Frontend) + Railway/Render (Backend)**

**Cost**: Free for frontend, ~$5-10/month for backend
image.png
**Why this combo?**
- ✅ Vercel is best-in-class for frontend (free, fast CDN)
- ✅ Use Railway/Render for backend (cheaper than Vercel Pro)

### Frontend on Vercel

1. Go to https://vercel.com
2. "New Project" → Import GitHub repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Environment Variables:
   ```
   VITE_API_URL=https://your-backend-url.up.railway.app
   VITE_AUTH_API_URL=https://your-auth-url.up.railway.app
   ```
5. Deploy!

### Backend on Railway/Render

Follow the backend deployment steps from Railway or Render above.

---

## 🔧 **Pre-Deployment Checklist**

Before deploying, make sure:

- [ ] **Backend CORS** allows your production frontend URL
- [ ] **Environment variables** are set correctly
- [ ] **Database migrations** will run (TypeORM auto-sync or manual)
- [ ] **Port configuration** uses `process.env.PORT`
- [ ] **Build scripts** work (`npm run build` in both frontend and backend)
- [ ] **Production scripts** exist (`npm run start:prod` in backend)
- [ ] **`.env` files** are NOT committed (use platform env vars instead)
- [ ] **WorkOS keys** are set in auth server environment

---

## 📝 **Required Code Changes**

### 1. Update Backend CORS (backend/src/main.ts)

```typescript
app.enableCors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:4000',
        process.env.FRONTEND_URL || '',
    ].filter(Boolean),
    credentials: true,
});

const port = process.env.PORT || 3000;
await app.listen(port);
```

### 2. Update Auth Server Port (authkit-server/src/server.ts)

```typescript
const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Auth server running on port ${port}`);
});
```

### 3. Add Production Script (backend/package.json)

Already exists: `"start:prod": "node dist/main"`

### 4. Add Production Script (authkit-server/package.json)

Add:
```json
"scripts": {
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
}
```

---

## 💰 **Cost Comparison**

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Railway** | $5 credit/month | ~$5-10/month | All-in-one, easiest |
| **Render** | Free (sleeps) | ~$7/service | Multiple services |
| **Vercel** | Free (frontend) | $20/month (backend) | Frontend only |
| **Fly.io** | Free tier | ~$5-10/month | More control |

**Recommendation**: Start with **Railway** - it's the easiest and cheapest for your full-stack app.

---

## 🐛 **Common Issues & Solutions**

### Issue: CORS Errors
**Solution**: Make sure `FRONTEND_URL` in backend matches your actual frontend URL

### Issue: Database Connection Failed
**Solution**: 
- Check environment variables match your database service
- Ensure database is running (not sleeping on Render free tier)
- Verify connection string format

### Issue: Frontend Can't Connect to Backend
**Solution**:
- Check `VITE_API_URL` is set correctly
- Ensure backend is deployed and running
- Check backend logs for errors

### Issue: Puppeteer/Scraper Not Working
**Solution**: 
- Railway/Render may need additional setup for Puppeteer
- Consider using a headless browser service or Docker image with Chrome

---

## 🚀 **Quick Start (Railway - Recommended)**

1. Sign up at https://railway.app
2. Create project from GitHub
3. Add PostgreSQL database
4. Deploy backend, auth, and frontend as separate services
5. Set environment variables
6. Deploy!

**Time**: ~15-20 minutes for first deployment

---

## 📚 **Additional Resources**

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs

---

## ✅ **After Deployment**

1. Test your app at the production URL
2. Run scraper: `https://your-backend-url/scraper/run-now`
3. Monitor logs in your platform dashboard
4. Set up custom domain (optional)
5. Configure backups for database

---

**Need help?** Check platform-specific documentation or logs in your deployment dashboard.
