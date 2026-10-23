# Pastry Universe

The online shop and kitchen dashboard for Pastry Universe: premium banana bread, cakes and chin-chin in Lagos.

- **Shop:** treats sit in a glass display case. Open one, pick a size and topping, and add it to the cart. Checkout handles delivery (fee by area) or free pickup, a delivery date and time, and gift notes. Customers pay by bank transfer, upload their receipt, and follow their order live.
- **Kitchen (admin):** a live dashboard (sales, orders, visitors on the site right now, revenue trend, best sellers, top areas, shopper funnel), an orders board you drag from "To bake" to "Delivered", a payments list for checking receipts, and settings for bank details, opening days, time slots and the shop front.

## What's inside

```
frontend/   React + Vite: the shop (index.html) and the kitchen admin (admin/index.html), built as two separate apps
backend/    Spring Boot 3 (Java 21) API, PostgreSQL, Flyway migrations
docs/       Roadmap
docker-compose.yml   Local database + API
```

## Run it on your computer

You need Docker, Node 20+ and (optionally) Java 21.

```bash
# 1. Database + API
cp .env.example .env          # set ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET
docker compose up --build     # API on http://localhost:8080

# 2. Shop
cd frontend
npm install
npm run dev                   # http://localhost:5173  (calls the API through /api)
```

Log in to the kitchen at `http://localhost:5173/admin` with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`. The owner account is created the first time the API starts.

Without Docker, start Postgres yourself, create a `pastry` database and user, then run `cd backend && ./gradlew bootRun`.

### Tests

```bash
cd backend && ./gradlew test   # needs Postgres; uses the pastry_test database
```

The tests place an order, upload a receipt, log in as staff, confirm the payment, move the order to baking and check the dashboard.

## How it works

- **Menu:** products and their variants (size + topping, each with a price and in-stock flag) live in Postgres. The first migration seeds her current menu and the 27 Lagos delivery zones.
- **Prices are worked out on the server.** The browser only sends which variants and how many, so nobody can edit a price before paying.
- **Payment flow:** an order starts as *Not paid yet*. When the customer uploads a receipt it moves to *Check payment*. Staff tap *Payment received* (or *Payment not found* with a note), and the customer's page updates instantly.
- **Live updates** use Server-Sent Events: `/api/orders/track/{token}/stream` for customers and `/api/admin/stream` for the kitchen. The admin gets a toast (and an optional sound) for every new order and receipt.
- **Analytics** are anonymous: a random id per browser tab and no cookies. Page views, treats opened, add to cart and checkout starts feed the shopper funnel, and heartbeats power "on the site now".
- **Staff login** uses signed tokens (JWT, 12 hours). Only the owner can change settings.

### Main API routes

| Route | What it does |
| --- | --- |
| `GET /api/menu` | Products, sizes, toppings, delivery zones, dates and time slots |
| `POST /api/orders` | Place an order |
| `GET /api/orders/track/{token}` | Order status for the customer |
| `POST /api/orders/track/{token}/receipt` | Upload a transfer receipt |
| `POST /api/orders/lookup` | Find an order by code + phone |
| `POST /api/admin/auth/login` | Staff login |
| `GET /api/admin/dashboard` | Dashboard numbers |
| `GET /api/admin/orders` | Orders board |
| `POST /api/admin/orders/{id}/payment/confirm` | Confirm a payment |
| `POST /api/admin/orders/{id}/status` | Move an order along |
| `GET/PUT /api/admin/settings` | Store settings |

## Going live

**API + database**
1. Create a Postgres database. Neon or Supabase both have free plans.
2. Deploy `backend/` with its Dockerfile to Railway, Render or Fly.io, using an always-on instance so live updates stay connected. Set:
   - `DATABASE_URL` (JDBC form, e.g. `jdbc:postgresql://host:5432/db?sslmode=require`), `DATABASE_USER`, `DATABASE_PASSWORD`
   - `JWT_SECRET`: a long random string
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`: the first owner account
   - `APP_CORS_ORIGINS`: your shop's address, e.g. `https://pastryuniverse.ng`
   - `UPLOAD_DIR`: a mounted volume (default `/data/uploads`) so receipts survive restarts

**Shop**
1. Import the repo into Vercel and set the root directory to `frontend`.
2. Set `VITE_API_URL` to the API's address, e.g. `https://api.pastryuniverse.ng`.
3. Add her domain under Project → Settings → Domains.

Then open `/admin`, log in, and put her bank details in **Settings** before sharing the link.

The kitchen is its own app at `/admin`, so the shop never loads any admin code. To give it its own address (e.g. `admin.pastryuniverse.ng`), add that domain to the same Vercel project and redirect it to `/admin`.

## Product photos

The display case uses cut-out photos in `frontend/src/assets/cutouts/`, mapped to products and sizes in `frontend/src/menu/art.js`. For cleaner cut-outs, shoot each item on a plain light background in daylight, from the same angle, with no hands in the shot.

## Clickable demo

`VITE_MOCK=1` builds the frontend with a pretend backend that runs in the browser, with sample orders, so the whole shop and kitchen can be clicked through without a server. The real site never includes it.
