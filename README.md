# Pastry Universe

The website for [Pastry Universe](https://pastryuniverse.bumpa.shop): premium banana bread, cakes and chin-chin from Lagos.

Treats sit in a glass display case. Click one and it glides to the centre while the rest blur back, then pick a size (the loaf grows on the shelf), choose a topping or flavour and order it on Bumpa.

## How the menu stays up to date

The site reads the menu straight from the Bumpa store, so there is nothing to update here when a price, topping or stock level changes. Update Bumpa as usual and the site follows within about 5 minutes.

- `api/menu.js` is a Vercel serverless function. It fetches Bumpa's product and delivery data and returns it at `/api/menu`, cached for 5 minutes.
- `src/menu/fromBumpa.js` groups Bumpa products into the items on the shelf (for example, "Banana Bread- Mini" and "Banana Bread- Large" become one Banana Bread with two sizes).
- `src/menu/families.js` lists those groups, their order on the shelf, and the descriptions shown on the site. A brand-new Bumpa product that doesn't match any group still appears, under "More treats".
- `src/menu/snapshot.json` is a bundled backup copy, used when Bumpa can't be reached. Refresh it with `npm run snapshot`.

## Run it locally

```bash
npm install
npm run dev
```

`npm run dev` doesn't run the `/api/menu` function, so the local site uses the backup menu. To run the function locally as well, use `npx vercel dev`.

## Deploy (Vercel, free)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com), choose **Add New → Project** and import the repo. Vercel detects Vite automatically. No settings need changing.
3. Every push to `main` redeploys the site.
4. To use a custom domain, add it under **Project → Settings → Domains**.

## Editing

| What | Where |
| --- | --- |
| Phone, WhatsApp, email, Instagram, address, tagline | `src/config.js` |
| Words in the orange ticker | `TICKER` in `src/config.js` |
| Item names, descriptions, tags, shelf order | `src/menu/families.js` |
| Which photo shows for each item or size | `src/menu/art.js` |
| Colours and fonts | top of `src/styles.css` |

## Product photos

The display case uses cut-out photos (transparent background) in `src/assets/cutouts/`. The current ones were cut from the Bumpa photos. Items without a cut-out fall back to their Bumpa photo.

For sharper cut-outs next time:

- Shoot every item from the same angle, slightly above, with the phone held level.
- Use a plain background that contrasts with the bread, like a white or light grey board. Avoid marble and patterned surfaces.
- Keep the whole item in frame with space around it. No hands or gloves in the shot.
- Use daylight from a window, not the kitchen bulb, and avoid harsh shadows.
- One item per photo. Take the same shot for every size so they line up on the shelf.

To add one, export it as a transparent `.webp` (around 800px tall), drop it in `src/assets/cutouts/`, and reference its file name in `src/menu/art.js`.
