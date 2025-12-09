# AuthKit Configuration for sporediikupi.up.railway.app

This document contains all the AuthKit configuration values you need to set in your WorkOS AuthKit dashboard for the frontend domain.

## Frontend URL
**Frontend URL:** `https://sporediikupi.up.railway.app`

## Backend URLs
- **Backend API:** `https://pricerunner-production.up.railway.app`
- **AuthKit Server:** `https://respectful-fascination-production-3f17.up.railway.app`

---

## AuthKit Configuration Values

### 1. Redirect URIs
**Where users are redirected when they sign in.**

Add these redirect URIs:
- `https://respectful-fascination-production-3f17.up.railway.app/auth/callback` (Production)
- `http://localhost:4000/auth/callback` (Default - for local development)

**Action:** Click "Edit Redirect URIs" and add the production callback URL if not already present.

---

### 2. App Homepage URL
**Link to your app homepage in the AuthKit pages and in the emails that users receive.**

**Value:** `https://sporediikupi.up.railway.app`

**Action:** Click "Edit app homepage URL" and set it to the above value.

---

### 3. Sign-in Endpoint
**An endpoint at your app that redirects to WorkOS's authorize endpoint. It is needed in cases where the sign-in was not initiated from your app.**

**Value:** `https://respectful-fascination-production-3f17.up.railway.app/auth/login`

**Action:** Click "Edit sign-in endpoint" and set it to the above value.

---

### 4. Sign-out Redirect
**Where users are redirected when they sign out.**

Add these sign-out redirect URLs:
- `https://sporediikupi.up.railway.app/products` (Production - main)
- `https://sporediikupi.up.railway.app` (Production - homepage)
- `http://localhost:5173/products` (Default - for local development)

**Action:** Click "Edit Sign-out redirects" and add the production URLs.

---

### 5. Sign up URL
**Where to navigate the user from the "sign up" link on AuthKit pages.**

**Value:** `https://respectful-fascination-production-3f17.up.railway.app/auth/sign-up`

**Note:** If you don't have a separate sign-up endpoint, you can use the login endpoint or create one.

**Action:** Set this URL in the AuthKit dashboard.

---

### 6. User Invitation URL
**Where to navigate the user from the user invitation email.**

**Value:** `https://sporediikupi.up.railway.app/invite`

**Note:** You may need to create this route in your frontend if it doesn't exist, or use the homepage.

**Action:** Click "Edit user invitation URL" and set it to the above value.

---

### 7. Password Reset URL
**Where to navigate the user from the password reset email.**

**Value:** `https://sporediikupi.up.railway.app/reset-password`

**Note:** You may need to create this route in your frontend if it doesn't exist, or use the homepage.

**Action:** Click "Edit password reset URL" and set it to the above value.

---

## Summary Checklist

- [ ] Add redirect URI: `https://respectful-fascination-production-3f17.up.railway.app/auth/callback`
- [ ] Set App Homepage URL: `https://sporediikupi.up.railway.app`
- [ ] Set Sign-in Endpoint: `https://respectful-fascination-production-3f17.up.railway.app/auth/login`
- [ ] Add Sign-out Redirect: `https://sporediikupi.up.railway.app/products`
- [ ] Add Sign-out Redirect: `https://sporediikupi.up.railway.app`
- [ ] Set Sign up URL: `https://respectful-fascination-production-3f17.up.railway.app/auth/sign-up` (or login endpoint)
- [ ] Set User Invitation URL: `https://sporediikupi.up.railway.app/invite` (or homepage)
- [ ] Set Password Reset URL: `https://sporediikupi.up.railway.app/reset-password` (or homepage)

---

## Environment Variables to Set

Make sure these environment variables are set in your Railway services:

### Backend Service
```
FRONTEND_URL=https://sporediikupi.up.railway.app
```

### AuthKit Server Service
```
FRONTEND_URL=https://sporediikupi.up.railway.app
WORKOS_REDIRECT_URI=https://respectful-fascination-production-3f17.up.railway.app/auth/callback
```

### Frontend Service
```
VITE_API_URL=https://pricerunner-production.up.railway.app
VITE_AUTH_API_URL=https://respectful-fascination-production-3f17.up.railway.app
NODE_ENV=production
```

**Important:** After setting environment variables, you must rebuild/redeploy the services for the changes to take effect!

---

## Notes

1. All production URLs use `https://` - Railway automatically provides SSL for Railway domains.
2. The frontend is hosted at `sporediikupi.up.railway.app` on Railway.
3. After updating AuthKit configuration, test the authentication flow to ensure everything works.
4. The cache time for products has been reduced to 1 minute so new database values will appear faster on the frontend.

