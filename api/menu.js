// Vercel serverless function: GET /api/menu
// Reads Pastry Universe's live products and delivery fees from Bumpa and
// returns them in the shape the site uses. Cached at the edge for 5 minutes,
// so a price change on Bumpa shows up on the site within a few minutes.

import { buildMenu, fetchBumpa } from '../src/menu/fromBumpa.js';

export default async function handler(req, res) {
  try {
    const { products, shippings } = await fetchBumpa();
    const menu = buildMenu(products, shippings, { source: 'live' });
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.status(200).json(menu);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'Could not reach Bumpa', detail: String(err?.message || err) });
  }
}
