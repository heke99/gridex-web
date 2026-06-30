# Gridex Web Signup Production Hotfix

## What this patch fixes

1. A successful OPS application can no longer be shown as failed just because local customer-portal onboarding fails afterwards.
   - `submitOpsCustomerApplication()` is now handled separately from `ensureCustomerPortalOnboarding()`.
   - After OPS accepts the application, the user is redirected to the thank-you page even if local onboarding fails.
   - Portal onboarding status is still included in the thank-you query string for diagnostics.

2. Supabase service-role/config errors in portal onboarding are no longer fatal for signup.
   - `loadServiceClient()` is now inside the onboarding try/catch.
   - Missing/faulty Supabase envs return a failed onboarding status instead of throwing through the signup action.

3. OPS application errors are logged and mapped more clearly.
   - 401/403 => config/API-token problem.
   - 400/422 => validation/consent/offer problem where possible.
   - 503 => live signup disabled/unavailable.
   - Details are logged server-side for Vercel debugging.

4. Contract-display snapshot validation is less brittle.
   - It still verifies the selected `offer_reference`.
   - It still detects legal version changes when both submitted and live values exist.
   - It no longer compares the entire display snapshot byte-for-byte, which could block valid applications after harmless UI/label changes.

5. Local portal onboarding no longer stores a metering-point id as `facility_id`.
   - `facility_id` and `metering_point_id` remain separated.

6. Launch regression checks were extended so these mistakes do not come back.

## Files changed

- `app/(public)/teckna-avtal/page.tsx`
- `lib/customerPortal/onboarding.ts`
- `lib/website/snapshotValidation.ts`
- `tests/launch-readiness.test.mjs`

## Verification run

- `npm run test:launch` passed.
- `npm run lint` passed with 0 errors and 9 existing warnings outside this patch.
- `npm run build` compiled successfully and TypeScript passed; sandbox timed out during static page generation after 120/160 pages, not on a TypeScript/code error.

## Apply from project root

```bash
unzip ~/Downloads/gridex-web-signup-production-hotfix.zip -d ~/Downloads/gridex-web-signup-production-hotfix
rsync -av ~/Downloads/gridex-web-signup-production-hotfix/ ./
npm run test:launch
npm run lint
npm run build
```
