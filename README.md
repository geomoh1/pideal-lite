# PiDeal Lite

PiDeal Lite is a mobile-first React marketplace for Pi Browser where Pi Network users can buy and sell digital services using Pi.

## Included

- Pi user login through the official Pi SDK
- Home page with search, categories, featured services, and latest services
- Browse approved digital services
- Add a service listing with title, category, Pi price, delivery time, icon, summary, and terms
- Service detail and buyer request flow
- Pi payment creation through the official Pi SDK
- Minimal Node/Express backend for Pi payment approval and completion
- PostgreSQL persistence through Prisma for users, services, orders, payments, reviews, and reports
- API-driven frontend state for services, orders, delivery, reviews, and reports
- Loading and error states for backend API calls
- Arabic/English UI with automatic device-language detection and a user language switcher
- Buying and selling order tabs for the same user account
- Seller delivery message/link placeholder
- Delivery confirmation
- Seller rating
- Profile page with mode switcher and simple stats
- Simple admin moderation for services, orders, and reports

## Architecture

PiDeal Lite keeps public discovery, authenticated marketplace actions, and payment verification separate:

```text
React/Vite frontend
  -> Express backend API
  -> PostgreSQL with Prisma
  -> Pi SDK in Pi Browser
  -> Pi Platform API for server-side payment approval/completion
```

The React app owns the mobile marketplace experience. The Express backend owns persistence, Pi token verification, payment approval/completion, escrow state, admin moderation, order ownership checks, public service pages, and notification computation.

## MVP flows

Browse mode:

```text
Open App -> Pi Login -> Browse -> Service Details -> Add brief/materials -> Seller accepts -> Pay deposit -> Delivery -> Pay remaining balance -> Rating
```

Sell mode:

```text
Login -> Add Service -> Pending Review -> Approved -> Receive Order materials -> Accept request -> Deposit paid -> Deliver message/link/file -> Buyer pays remaining balance -> Rating
```

Admin mode:

```text
Admin Pi account -> Review Services -> Approve/Reject -> Monitor Orders -> Resolve Reports
```

## Order statuses

- Requested
- Pending Payment
- Paid
- Deposit Paid
- In Progress
- Delivered
- Completed
- Disputed
- Refunded
- Cancelled

## Business model placeholder

The MVP uses `PLATFORM_FEE_RATE=0.05` by default, which means a `5%` platform commission on successful paid orders. Change this backend environment value to adjust the fee without code changes.

## Trust and escrow

PiDeal uses a lightweight trust model for the MVP:

- Every new service starts as `pending`.
- Admin reviews each listing before it can appear in Browse.
- Service listings capture experience, portfolio/proof links, revision policy, and requirements from the buyer.
- The backend rejects obvious external contact methods in listing text.
- Sellers have `sellerStatus`: `unverified`, `verified`, or `blocked`.
- Buyers can report services and dispute delivered orders.
- Admin can verify or block sellers, remove services, resolve reports, refund disputed orders, or release disputed orders to the seller.

Payments use app-side escrow records backed by completed Pi payments:

```text
Requested -> Pending Payment -> Deposit Paid -> In Progress -> Delivered -> Completed
```

The buyer first sends requirements/materials. The seller must accept the request before the buyer can pay the deposit. Completed deposit and balance payments are recorded as held escrow on the order. After seller delivery, the order is not completed until the buyer pays the remaining balance. If the service was already fully paid, delivery confirmation can complete the order.

When an order becomes `Completed`, PiDeal starts a dispute window controlled by `ESCROW_DISPUTE_WINDOW_HOURS` (`72` by default). If no dispute is opened before `releaseEligibleAt`, the backend settles the escrow and queues a `SellerPayout` for the seller net of the configured platform fee. If a dispute is opened, settlement is paused until admin chooses refund or settlement for seller.

For disputes:

```text
Delivered -> Disputed -> Refunded
Delivered -> Disputed -> Completed
```

`Deposit Paid` means the backend completed the deposit payment and holds it in escrow. `Completed` means the full service price has been paid through completed backend payments and the dispute window has started. `Released` means the escrow is settled, not paid out. Seller payouts remain `manual_required` until an admin sends Pi manually from the app wallet and records the payout transaction id; only then does the payout become `paid`.

Sellers must add a public Pi payout wallet address in Profile before manual payouts can be completed cleanly. PiDeal stores only the public receiving address and never asks for, stores, or needs a wallet passphrase, private key, or seed phrase.

Manual payout flow:

```text
Completed -> dispute window ends -> escrow settled -> SellerPayout manual_required
Admin sends Pi manually -> admin records txid -> SellerPayout paid
```

## User model

PiDeal uses one normal user account for both buying and selling:

```text
User.role = user | admin
```

`user` accounts can browse, buy services from others, add services, and deliver work. `admin` is only an extra moderation permission. Buyer and seller are order/service relationships, not account roles. The app blocks users from ordering their own service.

## Buyer materials and seller delivery

The MVP now captures the digital handoff needed for services such as logo references, translation text, CV edits, image cleanup, and simple code work:

- Buyer request brief
- Source text for translation/writing/code prompts
- Reference link
- Reference file selection shown as file name and size
- Seller delivery message
- Seller delivery link
- Seller delivery file selection shown as file name and size

Current MVP mode records file metadata only. It does not upload or store binary files yet. Before public production, add a dedicated upload endpoint and object storage such as S3, Cloudflare R2, Supabase Storage, or another persistent file store. Keep PostgreSQL for metadata only, not file blobs.

## Pi SDK integration

PiDeal loads the official Pi JavaScript SDK from `index.html` so Pi App Studio can detect `Pi.authenticate(...)`. `src/piPlaceholders.js` still owns every direct Pi SDK call and can dynamically load the script for one-off local SDK tests.

```text
https://sdk.minepi.com/pi-sdk.js
```

All Pi auth and payment logic is isolated in `src/piPlaceholders.js`:

- `authenticateWithPi`
- `createPiDepositPayment`
- `approvePiPayment`
- `completePiPayment`
- `confirmPiDeliveryPayment`
- `completeIncompletePiPayment`

The frontend uses the official SDK calls `Pi.authenticate(...)` and `Pi.createPayment(...)` when the SDK is available. Authentication requests the `username` and `payments` scopes so the Pi SDK can surface incomplete in-flight payments. After Pi authentication succeeds, the frontend sends only the Pi `accessToken` to `POST /api/session`; the backend verifies it with `GET https://api.minepi.com/v2/me` using `Authorization: Bearer <accessToken>`, creates/finds the local `User` from the verified Pi `uid`, and sets an httpOnly session cookie for later authenticated API calls.

Important: official Pi payments require server-side approval and server-side completion before an order should be treated as truly paid. PiDeal Lite now routes approval, completion, and incomplete-payment recovery through the backend endpoints below. The React frontend only advances escrow state after the backend completion endpoint returns the updated order.

## Backend API

The backend is intentionally small. It supports the Pi payment lifecycle and now serves the marketplace state from PostgreSQL through Prisma. React no longer depends on local `initialServices` or `initialOrders`; it loads services, orders, and reports through REST APIs.

Endpoints:

```text
GET  /api/services
GET  /api/public/services/:slug
GET  /service/:slug
GET  /service/:slug?lang=ar
POST /api/services
POST /api/services/:serviceId/status
POST /api/services/:serviceId/remove
POST /api/users/:userId/seller-status

GET  /api/orders
POST /api/orders
POST /api/orders/:orderId/accept
POST /api/orders/:orderId/start
POST /api/orders/:orderId/deliver
POST /api/orders/:orderId/confirm
POST /api/orders/:orderId/review
POST /api/orders/:orderId/cancel
POST /api/orders/:orderId/dispute
POST /api/orders/:orderId/refund
POST /api/orders/:orderId/release
POST /api/escrow/release-due
GET  /api/seller-payouts
POST /api/seller-payouts/:payoutId/mark-paid
GET  /api/orders/:orderId/status

POST /api/session
GET  /api/session
GET  /api/notifications
POST /api/users/payout-wallet

GET  /api/reports
POST /api/reports
POST /api/reports/:reportId/resolve

POST /api/pi/payments/:paymentId/approve
POST /api/pi/payments/:paymentId/complete
POST /api/pi/payments/incomplete
POST /api/payments/incomplete
```

Environment files:

```bash
cp .env.backend.example .env
cp .env.frontend.example .env.local
```

Backend `.env` values:

```text
PORT=4000
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
PI_API_BASE_URL=https://api.minepi.com/v2
PI_NETWORK_API_KEY=
PI_API_KEY=
FRONTEND_ORIGIN=http://localhost:5173
FRONTEND_ORIGINS=
PUBLIC_SITE_URL=http://localhost:4000
SESSION_SECRET=replace-with-a-long-random-secret
PI_ADMIN_USERNAMES=mohammedabobaker
PLATFORM_FEE_RATE=0.05
ESCROW_DISPUTE_WINDOW_HOURS=72
PI_USE_MOCK_PAYMENTS=true
```

Frontend `.env.local` values:

```text
VITE_API_BASE_URL=
VITE_PUBLIC_SITE_URL=
VITE_ENABLE_PI_SDK=false
```

Use `PI_USE_MOCK_PAYMENTS=true` for local development without a Pi server API key. In production, configure `PI_NETWORK_API_KEY` or `PI_API_KEY`, set `PI_USE_MOCK_PAYMENTS=false`, and set a stable `SESSION_SECRET` so httpOnly sessions survive backend restarts.

`FRONTEND_ORIGIN` should point to the deployed frontend URL. `FRONTEND_ORIGINS` can hold comma-separated extra origins. The backend also allows localhost and HTTPS Vercel preview domains ending in `.vercel.app`.

`VITE_API_BASE_URL` controls where the React app sends `/api` calls. Leave it empty in local development so Vite can proxy `/api` to `http://127.0.0.1:4000`. Set it to the deployed backend HTTPS URL before building for Vercel or Netlify, for example `https://your-pideal-backend.onrender.com`.

Public Pi review pages:

```text
/privacy
/terms
/contact
```

Use `/privacy` as the Privacy Policy URL, `/terms` as the Terms URL, `pideal.support@gmail.com` as the developer contact, and `https://github.com/geomoh1/pideal-lite` as the repository URL if the repository is public.

`PUBLIC_SITE_URL` is the public origin used by backend-rendered share pages such as `/service/:slug`. `VITE_PUBLIC_SITE_URL` should point to the same public origin so the SPA share button creates links with real Open Graph previews. Share links include `?lang=ar` or `?lang=en` so public landing pages render in the sharer's current app language.

`VITE_ENABLE_PI_SDK=false` keeps local development from forcing Pi SDK auth. In deployed builds, if the official SDK is present, the app can auto-trigger Pi authentication for Pi App Studio verification. Setting `VITE_ENABLE_PI_SDK=true` still forces SDK auth explicitly, and `?pi_sdk=1` can be used for an intentional one-off local SDK test.

Database setup:

```bash
npm run prisma:generate
npm run prisma:apply
npm run prisma:seed
```

Set `DATABASE_URL` to a PostgreSQL connection string before running database commands. The schema and migration files are committed so the same structure can be recreated on another machine. `npm run prisma:apply` applies committed SQL migrations in order and tolerates already-applied columns for simple deployment reruns. Use `npm run prisma:migrate -- --name <name>` when adding future migrations.

Development:

```bash
npm run dev:backend
npm run dev:frontend
```

The Vite dev server proxies `/api` to `http://127.0.0.1:4000`.

## Seed testing

The production UI does not show demo account buttons. Sign-in requires a verified Pi access token from `Pi.authenticate(...)`.

The Prisma seed creates marketplace test users for local database checks:

- Users with listed services: `maha.pi`, `pixelcare`, `faris.lang`, `devdesk`
- Users with sample orders: `nora.pi`, `sami.pi`

Seed data includes approved services, one pending listing, orders across the main statuses, completed mock payments, one review, and one admin report. Do not seed production with sample users or orders.

## Language support

PiDeal Lite detects the device/browser language on first visit:

- Arabic device language opens the UI in Arabic with RTL direction.
- Other languages open the UI in English.
- The language selector in the top bar lets the user switch between English and Arabic.
- The selected language is saved locally in the browser so the user preference wins over device language on later visits.

## Admin access

Admin moderation is controlled by the backend database, not by the mode switcher in the React UI.

- Seed data includes a local admin user named `lina.admin` with user id `admin-lina` for database-only smoke tests.
- A verified Pi user whose username is listed in `PI_ADMIN_USERNAMES` is created/returned as `admin` after the backend verifies the Pi access token. The current configured admin username is `mohammedabobaker`; set `PI_ADMIN_USERNAMES=` to disable username-based admin bootstrapping after setup.
- Only users with `User.role = "admin"` can approve, reject, block, remove services, or resolve reports.
- The frontend hides the Admin tab for non-admin users.
- The backend also rejects moderation requests from non-admin users.

To make a real Pi user an admin after their first login creates a `User` row, either add the verified Pi username to `PI_ADMIN_USERNAMES` before login or update that user's role in the production database:

```sql
UPDATE "User" SET role = 'admin' WHERE id = '<real-pi-user-uid>';
```

For local testing, run the same SQL against your configured PostgreSQL database. In production, do this in the managed database/admin console. Real Pi sessions now verify the Pi access token before creating/finding the user, then issue an httpOnly cookie. The `X-PiDeal-User-Id` fallback is disabled in production and is only kept for non-production smoke/development helpers.

Backend smoke test:

```bash
npm run test:backend
```

The smoke test uses mock Pi payments and verifies the API-driven flow: reject external contact text, create service, approve listing, verify seller, create order with request metadata, require seller acceptance before deposit, approve/complete deposit payment, start work, deliver, reject completion while a balance is due, approve/complete remaining balance payment, review, report, resolve report, refund a disputed order, and reload persisted order state.

## Security model

- Pi access tokens are verified server-side through the official Pi API before a local session is created.
- Production sessions use signed httpOnly cookies. Set a stable `SESSION_SECRET` in production.
- Sensitive order actions require authenticated ownership checks.
- The production backend does not trust client-supplied `buyerId`, `sellerId`, or `reporterId` values.
- Normal users can only list orders connected to their own buyer or seller identity.
- Admin endpoints require `User.role = "admin"` from the backend database.
- Payment approval, completion, and incomplete-payment recovery require the authenticated buyer for that order.
- Manual seller payouts require a public payout wallet address and an admin-recorded transaction id.
- PiDeal never requests wallet passphrases, seed phrases, private keys, or private wallet secrets.

## Current MVP limitations

- Binary file uploads are not implemented yet. The MVP records request and delivery file metadata only.
- Seller payouts are currently manual admin-verified transfers from the app wallet.
- Automated Pi App-to-User payouts are not enabled.
- Public service pages are lightweight backend-rendered pages intended mainly for sharing, discovery, and Open Graph previews.
- Rate limiting is implemented in-process for the MVP. A shared external limiter is recommended for multi-instance production deployments.
- The smoke test requires a PostgreSQL `DATABASE_URL`; it does not run against SQLite.

## Deployment notes

Frontend on Vercel or Netlify:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-deployed-backend`
- Rebuild the frontend after changing `VITE_API_BASE_URL`; Vite embeds this value at build time.
- The frontend is a single-page app. Pi auth and payment calls still stay isolated in `src/piPlaceholders.js`.
- The deployed frontend must reach the backend API over HTTPS for services, orders, reports, and Pi payment callbacks.
- If the deployed console shows `/api/services`, `/api/orders`, or `/api/reports` returning 404 from the Vercel domain, `VITE_API_BASE_URL` is missing or the frontend was not rebuilt after setting it.

Backend on Render or Railway:

- Start command: `npm start`
- Recommended deploy setup command: `npm install && npm run prisma:generate && npm run prisma:apply`
- Environment variables: copy values from `.env.backend.example`.
- Production values must include `PI_NETWORK_API_KEY` or `PI_API_KEY`, plus `PI_USE_MOCK_PAYMENTS=false`.
- Set `FRONTEND_ORIGIN` to the Vercel or Netlify production URL. Add extra domains to `FRONTEND_ORIGINS` as needed.
- The backend must be served over HTTPS because the Pi Browser and payment callbacks should not rely on insecure origins.

PostgreSQL persistence:

- Use a managed PostgreSQL database for Render/Railway deployments.
- Keep regular database backups enabled before a public beta.
- Confirm persistence by creating a paid mock order, restarting the backend, and checking `GET /api/orders/:orderId/status`.

## Pi Browser production checklist

- Serve both frontend and backend over HTTPS.
- Test the app inside Pi Browser on a real mobile device.
- Confirm every primary view works as a single-page app: Services, Sell, Orders, Admin, and Service Detail.
- Confirm there are no desktop-only controls or hover-required actions.
- Confirm all text, buttons, forms, and bottom navigation fit at narrow mobile widths.
- Confirm Pi Login uses the official SDK in Pi Browser and rejects non-Pi sessions outside Pi Browser.
- Confirm payment creation opens the official Pi payment flow in Pi Browser.
- Confirm `VITE_API_BASE_URL` points to the deployed backend outside local development.
- Confirm backend CORS allows the production frontend domain and Vercel preview domains.
- Confirm services, orders, delivery, reviews, and reports load from the backend after a page refresh.
- Confirm no demo account buttons are visible in production.
- Confirm the Pi App Studio app domain matches the deployed frontend domain before expecting production Pi SDK auth to work.
- Confirm `PI_NETWORK_API_KEY` or `PI_API_KEY` is configured on the backend host.
- Confirm `PI_ADMIN_USERNAMES=mohammedabobaker` is configured on the backend host if this Pi account should be the production admin.
- Confirm `PI_USE_MOCK_PAYMENTS=false` in production.
- Confirm database persistence survives backend restart or redeploy.
- Confirm backend server-side approval and completion are configured before treating real Pi payments as settled.
- Confirm backend payment approval and completion endpoints are tested against the deployed backend.
- Confirm PostgreSQL migrations have run before backend startup.
- Keep all future Pi auth/payment changes inside `src/piPlaceholders.js`.
- Verify Pi auth, deposit creation, cancellation, completion, and error states inside Pi Browser after SDK integration.
- Verify `GET /api/orders/:orderId/status` returns `Paid` only after successful completion.
- Re-run `npm run build` and test the production build before submission.

## Commands

```bash
npm install
npm run dev
npm run dev:backend
npm run dev:frontend
npm run prisma:generate
npm run prisma:apply
npm run prisma:seed
npm run test:backend
npm run build
npm start
```

## License

This project is released under the MIT License. See [LICENSE](./LICENSE).
