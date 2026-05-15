# PiDeal Lite

PiDeal Lite is a mobile-first React marketplace for Pi Browser where Pi Network users can buy and sell digital services using Pi.

## Included

- Pi user login through the official Pi SDK when available, with local fallback for development
- Home page with search, categories, featured services, and latest services
- Browse approved digital services
- Add a service listing with title, category, Pi price, delivery time, icon, summary, and terms
- Service detail and buyer request flow
- Pi payment creation through the official Pi SDK when available, with local fallback for development
- Minimal Node/Express backend for Pi payment approval and completion
- SQLite persistence through Prisma for users, services, orders, payments, reviews, and reports
- API-driven frontend state for services, orders, delivery, reviews, and reports
- Loading and error states for backend API calls
- Arabic/English UI with automatic device-language detection and a user language switcher
- Buying and selling order tabs for the same user account
- Seller delivery message/link placeholder
- Delivery confirmation
- Seller rating
- Profile page with mode switcher and simple stats
- Simple admin moderation for services, orders, and reports

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
Admin placeholder -> Review Services -> Approve/Reject -> Monitor Orders -> Resolve Reports
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

The MVP shows a simple `5%` platform commission on successful paid orders.

## Trust and escrow

PiDeal uses a lightweight trust model for the MVP:

- Every new service starts as `pending`.
- Admin reviews each listing before it can appear in Browse.
- Service listings capture experience, portfolio/proof links, revision policy, and requirements from the buyer.
- The backend rejects obvious external contact methods in listing text.
- Sellers have `sellerStatus`: `unverified`, `verified`, or `blocked`.
- Buyers can report services and dispute delivered orders.
- Admin can verify or block sellers, remove services, resolve reports, refund disputed orders, or release disputed orders to the seller.

Payments use logical escrow state, not internal wallets or balances:

```text
Requested -> Pending Payment -> Deposit Paid -> In Progress -> Delivered -> Completed
```

The buyer first sends requirements/materials. The seller must accept the request before the buyer can pay the deposit. After seller delivery, the order is not completed until the buyer pays the remaining balance. If the service was already fully paid, delivery confirmation can complete the order.

For disputes:

```text
Delivered -> Disputed -> Refunded
Delivered -> Disputed -> Completed
```

`Deposit Paid` means the backend completed the deposit payment. `Completed` means the full service price has been paid through completed backend payments.

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

Current demo mode records file metadata only. It does not upload or store binary files yet. Before public production, add a dedicated upload endpoint and object storage such as S3, Cloudflare R2, Supabase Storage, or another persistent file store. Keep SQLite for metadata only, not file blobs.

## Pi SDK integration

PiDeal loads the official Pi JavaScript SDK dynamically from `src/piPlaceholders.js` only when SDK testing is explicitly enabled:

```text
https://sdk.minepi.com/pi-sdk.js
```

All Pi auth and payment logic is isolated in `src/piPlaceholders.js`:

- `authenticateWithPi`
- `createPiDepositPayment`
- `approvePiPayment`
- `completePiPayment`
- `confirmPiDeliveryPayment`

The frontend uses the official SDK calls `Pi.authenticate(...)` and `Pi.createPayment(...)` when the SDK is available. Outside Pi Browser, the app uses local fallback responses so the MVP can still be tested during development.

Important: official Pi payments require server-side approval and server-side completion before an order should be treated as truly paid. PiDeal Lite now routes approval and completion callbacks through the backend endpoints below. The React frontend only marks an order as `Paid` after the backend completion endpoint returns `order.status = "Paid"`.

## Backend API

The backend is intentionally small. It supports the Pi payment lifecycle and now serves the marketplace state from SQLite through Prisma. React no longer depends on local `initialServices` or `initialOrders`; it loads services, orders, and reports through REST APIs.

Endpoints:

```text
GET  /api/services
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
GET  /api/orders/:orderId/status

GET  /api/reports
POST /api/reports
POST /api/reports/:reportId/resolve

POST /api/pi/payments/:paymentId/approve
POST /api/pi/payments/:paymentId/complete
```

Environment files:

```bash
cp .env.backend.example .env
cp .env.frontend.example .env.local
```

Backend `.env` values:

```text
PORT=4000
DATABASE_URL="file:./dev.db"
PI_API_BASE_URL=https://api.minepi.com/v2
PI_API_KEY=
FRONTEND_ORIGIN=http://localhost:5173
FRONTEND_ORIGINS=
DEMO_ADMIN_IDS=admin-lina
PI_USE_MOCK_PAYMENTS=true
```

Frontend `.env.local` values:

```text
VITE_API_BASE_URL=
VITE_ENABLE_PI_SDK=false
```

Use `PI_USE_MOCK_PAYMENTS=true` for local development without a Pi server API key. In production, configure `PI_API_KEY` and set `PI_USE_MOCK_PAYMENTS=false`.

`FRONTEND_ORIGIN` should point to the deployed frontend URL. `FRONTEND_ORIGINS` can hold comma-separated extra origins. The backend also allows localhost and HTTPS Vercel preview domains ending in `.vercel.app`.

`VITE_API_BASE_URL` controls where the React app sends `/api` calls. Leave it empty in local development so Vite can proxy `/api` to `http://127.0.0.1:4000`. Set it to the deployed backend HTTPS URL before building for Vercel or Netlify, for example `https://your-pideal-backend.onrender.com`.

`VITE_ENABLE_PI_SDK=false` keeps deployed demo testing from trying real Pi SDK auth before Pi App Studio is ready. Set `VITE_ENABLE_PI_SDK=true` only after the Pi App Studio domain/setup is ready, or use `?pi_sdk=1` for an intentional one-off SDK test.

Database setup:

```bash
npm run prisma:generate
npm run prisma:apply
npm run prisma:seed
```

The default SQLite database path is `prisma/dev.db`. It is ignored by git. The schema and migration files are committed so the same structure can be recreated on another machine. `npm run prisma:apply` applies committed SQL migrations in order and tolerates already-applied columns for simple deployment reruns. Use `npm run prisma:migrate -- --name <name>` when adding future migrations.

Development:

```bash
npm run dev:backend
npm run dev:frontend
```

The Vite dev server proxies `/api` to `http://127.0.0.1:4000`.

## Demo testing

The app includes clearly labeled demo account buttons for pre-submission testing on local development and deployed frontend builds such as Vercel or Netlify.

Demo buttons are shown until real `Pi.authenticate(...)` succeeds. After a real Pi SDK user is connected, the demo buttons are hidden and the official Pi auth path remains untouched.

Demo mode does not require Pi Browser or Pi App Studio. It sends `demoMode=true` to the payment backend so demo payments use mock approval and mock completion while still preserving the backend rule that an order only becomes `Paid` after completion.

- Browse demo: `ali.pi` (`buyer-ali`)
- Sell demo: `pioneer.demo` (`pi-user-placeholder`)
- Admin: `lina.admin` (`admin-lina`)

The Prisma seed also creates additional marketplace test users:

- Users with listed services: `maha.pi`, `pixelcare`, `faris.lang`, `devdesk`
- Users with sample orders: `nora.pi`, `sami.pi`

Seed data includes approved services, one pending listing, orders across the main statuses, completed mock payments, one review, and one admin report.

## Language support

PiDeal Lite detects the device/browser language on first visit:

- Arabic device language opens the UI in Arabic with RTL direction.
- Other languages open the UI in English.
- The language selector in the top bar lets the user switch between English and Arabic.
- The selected language is saved locally in the browser so the user preference wins over device language on later visits.

## Admin access

Admin moderation is controlled by the backend database, not by the mode switcher in the React UI.

- The seeded demo admin is `lina.admin` with user id `admin-lina`.
- In mock/demo mode, `DEMO_ADMIN_IDS=admin-lina` also allows the deployed demo backend to recognize Demo Admin even if the database was not seeded first.
- Only users with `User.role = "admin"` can approve, reject, block, remove services, or resolve reports.
- The frontend hides the Admin tab for non-admin users.
- The backend also rejects moderation requests from non-admin users.

To make a real Pi user an admin after their first login creates a `User` row, update that user's role in the production database:

```sql
UPDATE User SET role = 'admin' WHERE id = '<real-pi-user-uid>';
```

For SQLite local testing, you can run the same SQL against `prisma/dev.db` with your preferred SQLite tool. In production, do this in the managed database/admin console. This MVP guard still needs official Pi access-token verification before a public launch; the role must ultimately be tied to a verified Pi identity, not a browser-controlled value.

Backend smoke test:

```bash
npm run test:backend
```

The smoke test uses mock Pi payments and verifies the API-driven flow: reject external contact text, create service, approve listing, verify seller, create order with request metadata, require seller acceptance before deposit, approve/complete deposit payment, start work, deliver, reject completion while a balance is due, approve/complete remaining balance payment, review, report, resolve report, refund a disputed order, and reload persisted order state.

## Deployment notes

Frontend on Vercel or Netlify:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-deployed-backend`
- Environment variable for demo testing: `VITE_ENABLE_PI_SDK=false`
- Rebuild the frontend after changing `VITE_API_BASE_URL`; Vite embeds this value at build time.
- The frontend is a single-page app. Pi auth and payment calls still stay isolated in `src/piPlaceholders.js`.
- Before Pi App Studio submission, open the deployed frontend in a normal mobile browser and confirm Demo Browse, Demo Sell, and Demo Admin can complete their flows without Pi Browser.
- The deployed frontend must reach the backend API over HTTPS for services, orders, reports, and Pi payment callbacks.
- If the deployed console shows `/api/services`, `/api/orders`, or `/api/reports` returning 404 from the Vercel domain, `VITE_API_BASE_URL` is missing or the frontend was not rebuilt after setting it.

Backend on Render or Railway:

- Start command: `npm start`
- Recommended deploy setup command: `npm install && npm run prisma:generate && npm run prisma:apply`
- Environment variables: copy values from `.env.backend.example`.
- Production values must include `PI_API_KEY` and `PI_USE_MOCK_PAYMENTS=false`.
- Set `FRONTEND_ORIGIN` to the Vercel or Netlify production URL. Add extra domains to `FRONTEND_ORIGINS` as needed.
- The backend must be served over HTTPS because the Pi Browser and payment callbacks should not rely on insecure origins.

SQLite production limitation:

- SQLite is acceptable for a small closed beta only if the backend host provides a persistent disk or volume.
- If the host filesystem is ephemeral, `prisma/dev.db` can be lost on redeploy or restart.
- For a broader public beta, move the same Prisma models to PostgreSQL and use managed database backups.
- Confirm persistence by creating a paid mock order, restarting the backend, and checking `GET /api/orders/:orderId/status`.

## Pi Browser production checklist

- Serve both frontend and backend over HTTPS.
- Test the app inside Pi Browser on a real mobile device.
- Confirm every primary view works as a single-page app: Services, Sell, Orders, Admin, and Service Detail.
- Confirm there are no desktop-only controls or hover-required actions.
- Confirm all text, buttons, forms, and bottom navigation fit at narrow mobile widths.
- Confirm Pi Login uses the official SDK in Pi Browser and local fallback outside Pi Browser.
- Confirm payment creation opens the official Pi payment flow in Pi Browser.
- Confirm `VITE_API_BASE_URL` points to the deployed backend outside local development.
- Confirm backend CORS allows the production frontend domain and Vercel preview domains.
- Confirm services, orders, delivery, reviews, and reports load from the backend after a page refresh.
- Confirm the deployed app shows Demo Browse, Demo Sell, and Demo Admin before real Pi auth succeeds.
- Confirm demo payments stay in mock mode on the deployed backend.
- Confirm demo buttons disappear after a real Pi SDK authentication succeeds.
- Confirm the Pi App Studio app domain matches the deployed frontend domain before expecting production Pi SDK auth to work.
- Confirm `PI_API_KEY` is configured on the backend host.
- Confirm `PI_USE_MOCK_PAYMENTS=false` in production.
- Confirm database persistence survives backend restart or redeploy.
- Confirm backend server-side approval and completion are configured before treating real Pi payments as settled.
- Confirm backend payment approval and completion endpoints are tested against the deployed backend.
- Confirm SQLite migrations have run before backend startup.
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
