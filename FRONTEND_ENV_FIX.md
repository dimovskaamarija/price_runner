# CRITICAL: Fix Frontend Environment Variables

## The Problem
Frontend is using `localhost:3000` because **Vite embeds environment variables at BUILD TIME**, not runtime.

## The Solution - Do These Steps IN ORDER:

### Step 1: Set Environment Variables in Railway
Go to your **frontend service** in Railway → **Variables** tab → Add/Update:

```
NODE_ENV=production
VITE_API_URL=https://your-backend-url.up.railway.app
VITE_AUTH_API_URL=https://your-auth-url.up.railway.app
```

**IMPORTANT:**
- ✅ `NODE_ENV=production` - Ensures production optimizations
- ✅ `VITE_API_URL` - Must include `https://`, NO trailing slash
- ✅ `VITE_AUTH_API_URL` - Must include `https://`, NO trailing slash
- ✅ Use your actual Railway URLs (not localhost!)

### Step 2: Trigger a Rebuild
**After setting the variables**, you MUST rebuild:

1. Go to frontend service in Railway
2. Click **"Deploy"** or **"Redeploy"** button
3. Wait for build to complete

### Step 3: Verify
After rebuild, check browser console. You should see:
```
🔍 API Configuration: {
  VITE_API_URL: "https://your-backend-url.up.railway.app",
  API_BASE_URL: "https://your-backend-url.up.railway.app",
  ...
}
```

If you see `localhost:3000`, the variables weren't set BEFORE the build.

## About the 502 Error on /products

The `-s` flag in the serve command should handle SPA routing. If you still get 502:
1. Check Railway deploy logs for frontend service
2. Verify the build completed successfully
3. Check if `dist` folder exists after build

## Why This Happens

Vite replaces `import.meta.env.VITE_*` variables **during the build process**. If the variables aren't available when `npm run build` runs, it uses the fallback (`localhost:3000`).

**You cannot change Vite env vars after the build - you must rebuild!**
