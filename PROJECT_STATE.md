# PROJECT_STATE.md

## 1) Executive Snapshot
- Project: `odera-05-store` (Next.js 14 + Firebase + Vercel)
- Local path: `C:\Users\youte\Downloads\odera-05-store-guia\odera-05-store`
- Default branch: `main`
- Deployment target: `https://odera-05-store-v2.vercel.app`
- Business scope: e-commerce (catalog, cart, checkout with proof upload, manual payment validation, tracking, admin panel)

Current maturity:
- Backend and data consistency: solid for current stage
- Security baseline: good (Zod, CSRF, idempotency, guarded admin routes)
- DevOps baseline: acceptable (TTL + backup workflows)
- UX quality: improving, still with pending mobile and visual consistency tasks

## 2) Architecture (Real)
### Frontend
- Next.js App Router pages under `src/app/(public)` and `src/app/(admin)`
- Tailwind-based UI
- Client-side cart state via provider/context

### Backend
- Route handlers under `src/app/api/**/route.ts`
- Node runtime handlers
- Validation with Zod schemas in `src/schemas`

### Data and Integrations
- Firestore (primary DB)
- Firebase Auth (admin login with claims + session cookie)
- Cloudinary (proof/image upload flow)
- Nodemailer + Gmail SMTP (transactional notifications)
- GitHub Actions (TTL and backup jobs)
- Vercel (hosting/deploy)

## 3) Verified Scripts (`package.json`)
- `npm run dev`: local dev server
- `npm run build`: production build
- `npm run start`: production start
- `npm run lint`: lint checks
- `npm run test`: Vitest tests
- `npm run test:coverage`: test coverage
- `npm run typecheck`: TS noEmit
- `npm run admin:set-claim`: admin claim helper
- `npm run backup:run`: Firestore backup script

## 4) Environment Contracts
Source of truth: `.env.example` and runtime parser in `src/lib/env.ts`

### Server required
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `SMTP_USER`
- `SMTP_PASS`
- `CRON_SECRET`
- `STORAGE_MODE` (`spark_public_only` or `firebase_storage`)

### Server optional
- `FIRESTORE_DATABASE_ID` (defaults to `(default)`)
- `ADMIN_ALLOWLIST_EMAILS`
- `ENABLE_APP_CHECK_VERIFY`
- `EMAIL_BRAND_IMAGE_URL`

### Client required
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_APP_CHECK_SITE_KEY`
- `NEXT_PUBLIC_FIRESTORE_DATABASE_ID`

### Client optional
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

## 5) API Surface (Current)
Base folder: `src/app/api`

### Public APIs
- `POST /api/create-order`
- `POST /api/submit-payment`
- `POST /api/track`

### Scheduled API
- `POST /api/cron/release-expired`

### Admin APIs
- `POST /api/admin/session-login`
- `POST /api/admin/session-logout`
- `POST /api/admin/products/upsert`
- `POST /api/admin/orders/update-status`
- `POST /api/admin/settings/update`

## 6) API Contract Notes (High Value)
This section is for engineers onboarding from zero.

### `POST /api/create-order`
Input intent:
- Customer data
- Shipping data
- Cart items with variants
- Payment method and receipt URL
- Optional coupon

Backend guarantees:
- Zod validation
- Firestore transaction
- Stock reservation
- Idempotency (`x-idempotency-key` + `orderOps`)
- `publicCode` and `trackingToken` creation
- Initial status set to `PENDING_VALIDATION`
- Email dispatch attempt (customer + business)

Failure classes:
- 400 invalid payload
- 409 idempotency/stock conflicts
- 500 unexpected internal error

### `POST /api/submit-payment`
Input intent:
- payment operation code and supporting fields

Backend guarantees:
- Zod validation
- anti-duplicate operation checks
- status flow constraints

Failure classes:
- 400 invalid payload
- 409 duplicate or invalid transition
- 500 unexpected internal error

### `POST /api/track`
Input intent:
- `publicCode` + `trackingToken`

Backend guarantees:
- only returns matching order context
- does not expose admin-only internals

Failure classes:
- 400 invalid payload
- 404 not found / mismatch

### `POST /api/admin/orders/update-status`
Input intent:
- order code + target status

Backend guarantees:
- transition validation from central state map
- transactional stock restoration when cancellation applies
- status-change email dispatch attempt

Failure classes:
- 400 invalid payload
- 401/403 auth or claim issue
- 409 invalid transition

## 7) Firestore Model (Operational View)
Key collections:
- `products`
- `orders`
- `settings`
- `counters`
- `orderOps`
- `stockLogs`
- `auditLogs`

Important document patterns:
- `settings/store`: operational toggles, payment channels, social links, promo config, product types
- `counters/orders`: sequential number source for public order code
- `orderOps`: dedupe/idempotency evidence
- `stockLogs`: inventory traceability

## 8) State Machine (Orders)
Source: `src/lib/orderStatus.ts`

States:
- `SCHEDULED`
- `PENDING_VALIDATION`
- `PAYMENT_SENT`
- `PAID`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`
- `CANCELLED_EXPIRED`

Transition policy summary:
- pre-payment states can advance or cancel
- paid order can only move to shipment chain
- delivered/cancelled states are terminal

Operational critical point:
- TTL release job must include all expirable pre-final statuses to avoid ghost stock reservations.

## 9) Frontend Route Inventory
### Public
- `/`
- `/catalog`
- `/p/[slug]`
- `/cart`
- `/checkout`
- `/confirm`
- `/track`
- `/t/[publicCode]/[trackingToken]`

### Admin
- `/login`
- `/dashboard`
- `/dashboard/orders`
- `/dashboard/products`
- `/dashboard/settings`

## 10) Workflows and Automation
### `ttl.yml`
- Runs every 10 minutes
- Calls `POST /api/cron/release-expired`
- Requires:
  - `CRON_URL`
  - `CRON_SECRET`
- Strict: non-2xx exits as failure

### `backup.yml`
- Weekly scheduled run
- Executes TypeScript backup script
- Requires:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - optional/recommended `FIRESTORE_DATABASE_ID`

## 11) Secrets Matrix by Platform
### Local (`.env.local`)
Use full app config for local dev and tests.

### Vercel (Production)
Must contain all runtime env used by build and server handlers.

### GitHub Actions
- TTL workflow: only `CRON_URL`, `CRON_SECRET`
- Backup workflow: Firebase service account secrets

Rule:
- keep `CRON_SECRET` identical between Vercel and GitHub
- keep Firebase service account fields exact and without truncation

## 12) Testing Status (Real)
Existing tests:
- `src/lib/orderStatus.test.ts`
- `src/lib/idempotency.test.ts`
- `src/lib/paymentRules.test.ts`

Current coverage profile:
- unit-level confidence for transition and core helper logic
- limited integration coverage for full route behavior

What is still missing for senior-grade confidence:
- route integration tests with mocked Firestore transactions
- end-to-end critical flow tests (checkout -> confirm -> track -> admin status update)
- negative-case matrix for admin route auth and validation

## 13) E2E Business Flows (Expected)
### Flow A: Customer purchase
1. Add product/variant to cart
2. Checkout with personal/shipping data
3. Upload receipt
4. Create order
5. Get confirmation with code and token
6. Track with code+token

### Flow B: Admin validation
1. Login via Firebase Google
2. Open orders list
3. Change status following transition rules
4. Verify customer email notifications

### Flow C: TTL expiration
1. Order remains unpaid beyond reserve window
2. Cron runs
3. Order becomes `CANCELLED_EXPIRED`
4. Stock is restored

## 14) Runbook (Incident Response)
### Incident: SMTP emails not arriving
- Check local/server logs for SMTP auth errors
- Validate `SMTP_USER` and `SMTP_PASS` in Vercel
- Confirm Gmail app password is active
- Validate recipient not blocked/spam filtered

### Incident: TTL workflow red
- Open GitHub Actions run logs
- Verify `CRON_URL`, `CRON_SECRET` secrets
- Test endpoint manually with `curl` and header
- Confirm Vercel env `CRON_SECRET` equals GitHub one

### Incident: Backup workflow red
- Inspect missing env in workflow logs
- Verify Firebase secrets in GitHub Actions
- Confirm private key format is intact

### Incident: Product image not loading
- Verify image URL in product document
- Verify Cloudinary preset and cloud name for upload flow
- Check fallback rendering logic and Next image/domain constraints

## 15) Safe Change Zones vs High-Risk Zones
### Safe (low-risk) zones
- copy/text changes
- isolated UI components
- spacing/layout refinements

### High-risk zones
- order creation transaction logic
- stock update and restore logic
- order status transition map
- cron release logic
- env parser in `src/lib/env.ts`

Policy:
- run `lint + test + build` before merge for any high-risk zone

## 16) Deployment and Verification Protocol
Before deploy:
- `npm run lint`
- `npm run test`
- `npm run build`

After deploy:
- smoke test public routes
- smoke test admin routes
- create test order in production-like flow
- verify tracking and status updates
- verify latest TTL run is green in Actions

## 17) Current Gaps if a New Senior Joins Today
The file now includes the core map, but onboarding still improves if you add:
- explicit JSON request/response examples per API
- architecture diagram (request -> route -> DB -> side effects)
- release checklist by feature area
- rollback checklist per deployment
- SLO/SLA targets (email send time, checkout success rate, cron success rate)

## 18) Critical Assessment (If Rebuilding From Zero)
If starting from zero, what is still not fully documented here:
- exact UX acceptance criteria by page and breakpoint
- full error catalog by API with stable error codes
- load/performance budgets (LCP, TTFB, image weights)
- data migration strategy for schema evolution
- formal monitoring stack (alerts, dashboards, incident ownership)

This means:
- current state is production-usable and technically coherent
- not yet enterprise-grade documentation completeness

## 19) Priority Next Steps
1. Add API examples (`docs/api-contracts.md`)
2. Add onboarding runbook (`docs/onboarding.md`)
3. Add deploy/rollback playbook (`docs/release-playbook.md`)
4. Expand tests to route integration level
5. Finalize mobile-first UI pass with strict breakpoint QA

## 20) Conclusion
The project is in a strong practical state for real operation: secure baseline, transactional order flow, idempotency, cron release, and admin controls are in place. The main remaining work is documentation depth and QA hardening to reduce onboarding and regression risk.
