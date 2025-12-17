# Railway Configuration for Bearer Token Authentication

## 🔑 Required Changes on Railway

After switching from cookies to Bearer tokens, you need to add **one new environment variable** to your Railway deployment.

---

## ✅ Step 1: Add JWT_SECRET to Auth Server

**This is REQUIRED** - Without this, authentication will not work!

1. Go to your **Railway dashboard**
2. Select your **authkit-server** service
3. Go to the **Variables** tab
4. Click **"New Variable"**
5. Add:
   ```
   JWT_SECRET=<generate-a-strong-random-string>
   ```

### How to Generate a Strong JWT Secret

You can use any of these methods:

**Option A: Use an online generator**
- Visit: https://generate-secret.vercel.app/32
- Copy the generated secret

**Option B: Use Node.js (in terminal)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option C: Use PowerShell (Windows)**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Example JWT_SECRET value:**
```
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

⚠️ **IMPORTANT**: 
- Use a **long, random string** (at least 32 characters)
- **Never commit this secret** to git
- **Keep it secure** - anyone with this secret can create valid tokens

---

## 📝 Step 2: Optional - Configure Token Expiration

You can optionally set how long tokens last:

1. In the same **authkit-server** service Variables tab
2. Add (optional):
   ```
   JWT_EXPIRES_IN=7d
   ```

**Common values:**
- `7d` = 7 days (default)
- `30d` = 30 days
- `24h` = 24 hours
- `1h` = 1 hour

If you don't set this, it defaults to `7d`.

---

## 🔄 Step 3: Redeploy Auth Server

After adding the environment variable:

1. Go to your **authkit-server** service
2. Click **"Redeploy"** or trigger a new deployment
3. Wait for the deployment to complete

---

## ✅ Step 4: Verify It's Working

After redeployment:

1. Try logging in through your frontend
2. Check browser **localStorage** (F12 → Application → Local Storage)
3. You should see a key called `auth_token` with a JWT token value
4. Try adding a product to favorites - it should work!

---

## 📋 Complete Environment Variables Checklist

### Auth Server (authkit-server) Service

**Required:**
- ✅ `JWT_SECRET` ← **NEW - ADD THIS!**
- ✅ `WORKOS_CLIENT_ID`
- ✅ `WORKOS_COOKIE_PASSWORD` (still needed for WorkOS session handling)
- ✅ `WORKOS_REDIRECT_URI`
- ✅ `DATABASE_URL` (or DB connection vars)
- ✅ `FRONTEND_URL`
- ✅ `PORT` (usually auto-set by Railway)

**Optional:**
- `JWT_EXPIRES_IN` (defaults to "7d")

### Backend Service

**No changes needed** - Backend automatically reads Bearer tokens from Authorization header.

**Existing variables (keep as-is):**
- ✅ `DB_HOST`
- ✅ `DB_PORT`
- ✅ `DB_USERNAME`
- ✅ `DB_PASSWORD`
- ✅ `DB_DATABASE`
- ✅ `PORT`
- ✅ `NODE_ENV=production`
- ✅ `FRONTEND_URL`
- ✅ `AUTHKIT_URL` or `AUTH_API_URL` (pointing to your auth server)

### Frontend Service

**No changes needed** - Frontend automatically includes Bearer token in requests.

**Existing variables (keep as-is):**
- ✅ `VITE_API_URL`
- ✅ `VITE_AUTH_API_URL`
- ✅ `NODE_ENV=production`

---

## 🐛 Troubleshooting

### Issue: "User not authenticated" errors

**Solution:**
1. Check that `JWT_SECRET` is set in authkit-server
2. Verify the authkit-server was redeployed after adding the variable
3. Check authkit-server logs for JWT errors

### Issue: Tokens expire too quickly

**Solution:**
- Add `JWT_EXPIRES_IN=30d` (or your preferred duration) to authkit-server variables
- Redeploy authkit-server

### Issue: Can't log in / tokens not being created

**Solution:**
1. Check authkit-server logs for errors
2. Verify `JWT_SECRET` is set correctly
3. Check that `/auth/callback` is working (check logs when you try to log in)

---

## 🔒 Security Notes

1. **JWT_SECRET must be kept secret** - Never commit it to git
2. **Use a strong random string** - At least 32 characters
3. **Different secrets for different environments** - Use different secrets for dev/staging/production
4. **Rotate secrets if compromised** - If you suspect a leak, generate a new secret and redeploy

---

## ✅ Summary

**What you need to do:**
1. ✅ Add `JWT_SECRET` to authkit-server service in Railway
2. ✅ (Optional) Add `JWT_EXPIRES_IN` if you want custom expiration
3. ✅ Redeploy authkit-server service
4. ✅ Test login and favorites functionality

**That's it!** No other changes needed on Railway. The frontend and backend will automatically use Bearer tokens.
