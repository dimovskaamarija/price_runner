# 🚨 Fix Sign-Up Redirect Loop

## The Problem

Your logs show `/sign-up` being called repeatedly, but **never** `/auth/callback`. This means WorkOS is not redirecting back to your callback URL.

## Root Cause

The redirect URI `https://respectful-fascination-production-3f17.up.railway.app/auth/callback` is **not whitelisted** in your WorkOS dashboard.

## ✅ Fix in WorkOS Dashboard

1. **Go to WorkOS Dashboard**: https://dashboard.workos.com
2. **Navigate to**: Your AuthKit Application
3. **Go to**: Settings → Redirect URIs (or Configuration → Redirect URIs)
4. **Add this EXACT URI**:
   ```
   https://respectful-fascination-production-3f17.up.railway.app/auth/callback
   ```
5. **Save** the changes

### ⚠️ Important Notes:

- **Must match EXACTLY**:
  - ✅ `https://` (not `http://`)
  - ✅ No trailing slash (`/auth/callback` not `/auth/callback/`)
  - ✅ Exact domain: `respectful-fascination-production-3f17.up.railway.app`
  - ✅ Exact path: `/auth/callback`

- **If you have multiple environments**, add both:
  - Production: `https://respectful-fascination-production-3f17.up.railway.app/auth/callback`
  - Local (if testing): `http://localhost:4000/auth/callback`

## 🔍 How to Verify

After adding the redirect URI in WorkOS:

1. **Try sign-up again**
2. **Check Railway logs** - you should now see:
   ```
   === CALLBACK REQUEST ===
   Query params: { "code": "..." }
   ```
3. **If you still see the loop**, double-check:
   - The URI in WorkOS matches **exactly** what's in the logs
   - No typos or extra spaces
   - Saved the changes in WorkOS

## 📋 Current Configuration (from logs)

- **Redirect URI being sent**: `https://respectful-fascination-production-3f17.up.railway.app/auth/callback`
- **Client ID**: `client_01KA2DVX23D1M2CEBVA6XJV7BC`
- **Screen Hint**: `sign-up`

Make sure this **exact** redirect URI is in your WorkOS dashboard!

## 🐛 If Still Not Working

1. **Check WorkOS logs** (if available in dashboard)
2. **Try login** - does it work? (If login works but sign-up doesn't, it's a `screenHint` issue)
3. **Check for typos** in the redirect URI
4. **Wait a few minutes** after saving - WorkOS might cache redirect URIs
