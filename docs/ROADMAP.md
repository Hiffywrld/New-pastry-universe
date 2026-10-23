# Pastry Universe: roadmap

Our own shop, no Bumpa. Bumpa keeps running until launch day, then we switch over.

## Stack

- **Frontend:** React + Vite, hosted on Vercel.
- **Backend:** Spring Boot 3 (Java 21) REST API + WebSockets for live updates, in Docker.
- **Database:** PostgreSQL with Flyway migrations.
- **Files:** S3-compatible storage for product photos and payment receipts.
- **Notifications:** email, web push (installable app), WhatsApp click-to-chat links.
- **Repo layout:** `frontend/`, `backend/`, `docker-compose.yml` for local Postgres.

## Payments

Bank transfer only, for now:

1. At checkout the customer sees her account details and a unique order code to put in the transfer description.
2. The customer uploads a screenshot of the receipt.
3. The order lands in **Confirm payments** in the admin. She taps confirm.
4. The customer is notified, and the order moves to baking.

Automatic confirmation (e.g. Paystack dedicated virtual accounts) can come later.

## Features

### Shop
- Display case (existing), menu, search and filters (no sugar, fitfam, nut-free)
- Cart drawer, checkout (delivery or pickup, area-based fee, delivery date and time slot, gift note)
- Order tracking page with live status: Received → Payment confirmed → Baking → Out for delivery → Delivered
- Delivery calendar with daily baking limits ("Only 3 slots left Saturday")
- Build your own Petit Loaf Box
- Birthday cake builder (size, topping, topper message, date, live preview)
- Send a Treat (order for someone else, schedule for their birthday, surprise note) and gift cards
- Drops: limited editions with countdowns and waitlists
- Accounts: order history, one-tap reorder, saved addresses
- Universe Points loyalty and referral codes
- Taste quiz: "find your banana bread"
- About, FAQ, allergen labels, reviews
- Installable phone app with push alerts for order updates

### Admin
- Live dashboard: today's sales, orders, visitors right now, live order feed with sound
- Analytics: revenue over time, best sellers, top areas, busiest days, visitor-to-buyer funnel
- Orders board: drag through statuses, customer notified automatically
- Confirm payments queue (bank transfer receipts)
- Baking plan: what to bake for each day, totalled from orders
- Products: items, sizes, toppings, prices, stock, photos
- Delivery zones and fees, opening hours, daily limits, shop closed switch, announcement banner
- Profit and ingredients: recipes, shopping list for tomorrow, cost per loaf, real profit
- Rider page: assign riders, who tap "Picked up" and "Delivered" from a link
- Printable branded labels and receipts
- Customer CRM: VIPs, lifetime spend, birthdays, WhatsApp promos
- Discount codes, gift cards, drops scheduler
- Logins and roles: owner, staff, rider

## Phases

1. **Foundation:** monorepo, Spring Boot + Postgres, products seeded from the current menu, cart, checkout with bank transfer and receipt upload, order tracking, admin login, orders board, confirm payments, live dashboard.
2. **Running the kitchen:** baking plan ✅, delivery calendar with limits ✅, labels and receipts ✅, rider page ✅, customer CRM ✅. Still to do: products manager, delivery zones editor.
3. **Customer magic:** accounts, Universe Points, referrals, box builder, cake builder, Send a Treat, gift cards, drops and waitlists, taste quiz, about, FAQ, reviews.
4. **Launch:** installable app and push alerts, profit and ingredients, full analytics, polish, deploy, switch off Bumpa.

Done so far beyond phase 1: Google sign-in with the Topping Rush welcome game (part of phase 3), the Treat Spotlight, Liquid Glass and spring motion, cleaner cut-outs (second pass).

Ongoing: better product photos. Re-shooting on a plain background would beat any cut-out tool.
