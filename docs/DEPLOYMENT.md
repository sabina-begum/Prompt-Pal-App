# PromptPal Deployment Guide

## Production Environment Variables (Convex & Clerk)

When pushing to production, you must use **production** instances—not dev.

| Variable | Dev | Production |
|----------|-----|------------|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `EXPO_PUBLIC_CONVEX_URL` | `https://xxx.convex.cloud` (dev deployment) | `https://xxx.convex.cloud` (prod deployment) |
| `CLERK_JWT_ISSUER_DOMAIN` | `https://xxx.clerk.accounts.dev` | `https://clerk.promptpal.expo.dev` |

---

## Web Build (Static Export)

For `bun run build:web`, Expo loads `.env.production` in production mode.

1. Copy `.env.production` and fill in your **production** values:
   - **Convex**: Convex dashboard → Production deployment → Settings → Deployment URL
   - **Clerk**: Clerk dashboard → switch to **Production** instance → API Keys → Publishable Key (`pk_live_...`)

2. Configure Convex production deployment:
   - Convex dashboard → Production deployment → Settings → Environment Variables
   - Add `CLERK_JWT_ISSUER_DOMAIN` = `https://clerk.promptpal.expo.dev`

3. Deploy Convex to production: `bunx convex deploy`

4. Build: `bun run build:web`

---

## EAS Build (iOS / Android)

Local `.env` files are **not** bundled into EAS production builds. Use EAS Secrets.

### Option A: EAS Secrets (Recommended)

```bash
cd PromptPal

# Convex production URL (from Convex dashboard > Production > Settings > Deployment)
eas secret:create --scope project --name EXPO_PUBLIC_CONVEX_URL --value "https://YOUR_PROD_DEPLOYMENT.convex.cloud"

# Clerk production publishable key (from Clerk dashboard > Production > API Keys)
eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value "pk_live_..."
```

### Option B: Configure in eas.json

Add to `eas.json` under `build.production.env`. Prefer EAS Secrets for sensitive values.

### Verify

1. Run `eas build --profile production --platform ios`
2. Check build logs for environment variables
3. Install via TestFlight and verify the app launches
