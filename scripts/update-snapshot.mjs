// Refreshes the bundled backup menu (src/menu/snapshot.json) from Bumpa.
// The live site syncs on its own; this backup is only used if Bumpa is down.
//
//   npm run snapshot
//   node scripts/update-snapshot.mjs --from products.json shippings.json

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildMenu, fetchBumpa } from '../src/menu/fromBumpa.js';

const out = fileURLToPath(new URL('../src/menu/snapshot.json', import.meta.url));
const args = process.argv.slice(2);

let products;
let shippings;
if (args[0] === '--from') {
  const pj = JSON.parse(readFileSync(args[1], 'utf8'));
  const sj = args[2] ? JSON.parse(readFileSync(args[2], 'utf8')) : { shippings: [] };
  products = pj?.products?.data || pj?.data || pj;
  shippings = sj?.shippings || sj;
} else {
  ({ products, shippings } = await fetchBumpa());
}

const menu = buildMenu(products, shippings, { source: 'snapshot' });
writeFileSync(out, JSON.stringify(menu, null, 2) + '\n');
console.log(`Saved ${menu.items.length} items and ${menu.delivery.zones.length} delivery zones to ${out}`);
