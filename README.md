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
- Buyer and seller orders dashboard
- Seller delivery message/link placeholder
- Delivery confirmation
- Seller rating
- Profile page with role switcher and simple stats
- Simple admin moderation for services, orders, and reports

## MVP flows

Buyer:

```text
Open App -> Pi Login -> Browse -> Service Details -> Order -> Pi Payment -> Delivery -> Confirm -> Rating
```

Seller:

```text
Login -> Add Service -> Pending Review -> Approved -> Receive Order -> Deliver -> Buyer Confirms -> Rating
```

Admin:

```text
Admin placeholder -> Review Services -> Approve/Reject -> Monitor Orders -> Resolve Reports
```

## Order statuses

- Pending Payment
- Paid
- In Progress
- Delivered
- Completed
- Disputed
- Cancelled

## Business model placeholder

The MVP shows a simple `5%` platform commission on successful paid orders.

## Pi SDK integration

`index.html` loads the official Pi JavaScript SDK:

```html
<script src="https://sdk.minepi.com/pi-sdk.js"></script>
<script>
  if (window.Pi) {
    Pi.init({ version: "2.0" });
  }
</script>
```

All Pi auth and payment logic is isolated in `src/piPlaceholders.js`:

- `authenticateWithPi`
- `createPiDepositPayment`
- `approvePiPayment`
- `completePiPayment`
- `confirmPiDeliveryPayment`

The frontend uses the official SDK calls `Pi.authenticate(...)` and `Pi.createPayment(...)` when the SDK is available. Outside Pi Browser, the app uses local fallback responses so the MVP can still be tested during development.

Important: official Pi payments require server-side approval and server-side completion before an order should be treated as truly paid. PiDeal Lite now routes approval and completion callbacks through the backend endpoints below. The React frontend only marks an order as `Paid` after the backend completion endpoint returns `order.status = "Paid"`.

## Backend payment API

The backend is intentionally small. It supports the Pi payment lifecycle and persists users, services, orders, payments, reviews, and reports in SQLite through Prisma.

Endpoints:

```text
POST /api/pi/payments/:paymentId/approve
POST /api/pi/payments/:paymentId/complete
GET  /api/orders/:orderId/status
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
PI_USE_MOCK_PAYMENTS=true
```

Frontend `.env.local` values:

```text
VITE_API_BASE_URL=
```

Use `PI_USE_MOCK_PAYMENTS=true` for local development without a Pi server API key. In production, configure `PI_API_KEY` and set `PI_USE_MOCK_PAYMENTS=false`.

`VITE_API_BASE_URL` controls where the React app sends `/api` calls. Leave it empty in local development so Vite can proxy `/api` to `http://127.0.0.1:4000`. Set it to the deployed backend HTTPS URL before building for Vercel or Netlify, for example `https://your-pideal-backend.onrender.com`.

Database setup:

```bash
npm run prisma:generate
npm run prisma:apply
npm run prisma:seed
```

The default SQLite database path is `prisma/dev.db`. It is ignored by git. The schema and migration files are committed so the same structure can be recreated on another machine. Use `npm run prisma:migrate -- --name <name>` when adding future migrations.

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

- Buyer: `ali.pi` (`buyer-ali`)
- Seller: `pioneer.demo` (`pi-user-placeholder`)
- Admin: `lina.admin` (`admin-lina`)

The Prisma seed also creates additional marketplace test users:

- Sellers: `maha.pi`, `pixelcare`, `faris.lang`, `devdesk`
- Buyers: `nora.pi`, `sami.pi`

Seed data includes approved services, one pending listing, orders across the main statuses, completed mock payments, one review, and one admin report.

Backend smoke test:

```bash
npm run test:backend
```

The smoke test uses mock Pi payments and verifies that approval leaves the order in `Pending Payment`, while completion persists the order as `Paid`.

## Deployment notes

Frontend on Vercel or Netlify:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-deployed-backend`
- Rebuild the frontend after changing `VITE_API_BASE_URL`; Vite embeds this value at build time.
- The frontend is a single-page app. Pi auth and payment calls still stay isolated in `src/piPlaceholders.js`.
- Before Pi App Studio submission, open the deployed frontend in a normal mobile browser and confirm Demo Buyer, Demo Seller, and Demo Admin can complete their flows without Pi Browser.

Backend on Render or Railway:

- Start command: `npm start`
- Recommended deploy setup command: `npm install && npm run prisma:generate && npm run prisma:apply`
- Environment variables: copy values from `.env.backend.example`.
- Production values must include `PI_API_KEY` and `PI_USE_MOCK_PAYMENTS=false`.
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
- Confirm the deployed app shows Demo Buyer, Demo Seller, and Demo Admin before real Pi auth succeeds.
- Confirm demo payments stay in mock mode on the deployed backend.
- Confirm demo buttons disappear after a real Pi SDK authentication succeeds.
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
