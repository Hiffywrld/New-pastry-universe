// Turns Bumpa's storefront data into the menu the site uses.
// Shared by the live sync (api/menu.js) and the bundled snapshot script.

import { FAMILIES, SIZES } from './families.js';

export const STORE_URL = 'https://pastryuniverse.bumpa.shop';
export const LOCATION_ID = 207040;

export const BUMPA_PRODUCTS_URL =
  `${STORE_URL}/storefront/products?limit=100&page=1&min_stock=0&with_variations=true&status=1` +
  `&location=${LOCATION_ID}&image_width=1200`;
export const BUMPA_SHIPPING_URL = `${STORE_URL}/storefront/shippings`;

const squash = (s = '') => String(s).replace(/\s+/g, ' ').trim();
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function detectSize(text = '') {
  return SIZES.find((s) => s.re.test(text)) || null;
}

function stripSize(label, size) {
  if (!size) return label;
  const all = new RegExp(size.re.source, 'gi');
  return squash(
    label
      .replace(all, ' ')
      .replace(/\b(pouch|paint|half|bucket)\b/gi, ' ')
      .replace(/[()]/g, ' '),
  );
}

const TYPO_FIXES = [
  [/raisings/gi, 'raisins'],
  [/choclate/gi, 'chocolate'],
  [/ground ?nuts?/gi, 'groundnuts'],
];

export function tidyChoice(label = '') {
  let s = squash(label);
  if (!s) return '';
  if (/^without\s+toppings?$/i.test(s)) return 'No toppings';
  if (/^without\s+handwritten\s+note$/i.test(s)) return 'No note';
  s = s.replace(/^with\s+/i, '');
  for (const [re, to] of TYPO_FIXES) s = s.replace(re, to);
  s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "Cubed Chinchin - (Paint bucket (2kg) Plain)" -> "Paint bucket (2kg) Plain"
function variationLabel(product, variation) {
  const name = squash(variation.name);
  const base = squash(product.name);
  let rest = name.startsWith(base) ? name.slice(base.length) : name;
  rest = rest.replace(/^\s*-\s*/, '');
  if (rest.startsWith('(') && rest.endsWith(')')) rest = rest.slice(1, -1);
  return squash(rest);
}

function slug(s) {
  return squash(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function familyFor(product) {
  const fam = FAMILIES.find(
    (f) => f.match.test(product.name) && !(f.exclude && f.exclude.test(product.name)),
  );
  if (fam) return fam;
  return {
    id: slug(product.name) || `item-${product.id}`,
    name: squash(product.name),
    category: 'More treats',
    description: '',
  };
}

function photosOf(product) {
  const host = 'https://dodptt9f4zk9h.cloudfront.net';
  const list = (product.images || []).map((i) => (i.path ? host + i.path : null)).filter(Boolean);
  if (!list.length && product.image_url) list.push(product.image_url);
  return list;
}

function addChoice(item, size, product, choice) {
  const key = size ? size.key : 'regular';
  if (!item.sizes.has(key)) {
    item.sizes.set(key, {
      key,
      label: size ? size.label : 'Regular',
      rank: size ? SIZES.indexOf(size) : -1,
      url: product.url || STORE_URL,
      productId: product.id,
      choices: [],
    });
  }
  const s = item.sizes.get(key);
  const dupe = s.choices.find((c) => c.label.toLowerCase() === choice.label.toLowerCase());
  if (dupe) {
    dupe.inStock = dupe.inStock || choice.inStock;
    return;
  }
  s.choices.push(choice);
}

export function buildMenu(products = [], shippings = [], meta = {}) {
  const families = new Map();
  const order = FAMILIES.map((f) => f.id);

  for (const p of products) {
    if (!p || p.status === 0) continue;
    const fam = familyFor(p);
    if (!families.has(fam.id)) {
      families.set(fam.id, {
        id: fam.id,
        name: fam.name,
        category: fam.category,
        tag: fam.tag || null,
        description: fam.description || '',
        photos: [],
        sizes: new Map(),
      });
    }
    const item = families.get(fam.id);
    if (!item.description && p.description) item.description = squash(p.description);
    item.photos.push(...photosOf(p));

    const nameSize = detectSize(p.name);
    const variations = Array.isArray(p.variations) ? p.variations : [];
    if (variations.length) {
      for (const v of variations) {
        const label = variationLabel(p, v);
        const vSize = detectSize(label);
        addChoice(item, vSize || nameSize, p, {
          label: tidyChoice(stripSize(label, vSize)),
          price: num(v.price),
          inStock: Boolean(v.in_stock),
        });
      }
    } else {
      addChoice(item, nameSize, p, { label: '', price: num(p.price), inStock: Boolean(p.in_stock) });
    }
  }

  const items = [...families.values()].map((item) => {
    const sizes = [...item.sizes.values()]
      .sort((a, b) => a.rank - b.rank)
      .map((s) => {
        const priced = s.choices.filter((c) => c.price != null);
        const prices = priced.map((c) => c.price);
        const choices = s.choices.length === 1 && !s.choices[0].label ? [] : s.choices;
        return {
          key: s.key,
          label: s.label,
          url: s.url,
          productId: s.productId,
          choices,
          priceMin: prices.length ? Math.min(...prices) : null,
          priceMax: prices.length ? Math.max(...prices) : null,
          inStock: s.choices.some((c) => c.inStock),
        };
      });
    const mins = sizes.map((s) => s.priceMin).filter((n) => n != null);
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      tag: item.tag,
      description: item.description,
      photos: [...new Set(item.photos)].slice(0, 6),
      sizes,
      priceMin: mins.length ? Math.min(...mins) : null,
      inStock: sizes.some((s) => s.inStock),
    };
  });

  items.sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  return {
    source: meta.source || 'live',
    updatedAt: meta.updatedAt || new Date().toISOString(),
    items,
    delivery: buildDelivery(shippings),
  };
}

export function buildDelivery(shippings = []) {
  const visible = shippings.filter((s) => s && s.visible !== 0 && s.status !== 0);
  const pickupRow = visible.find((s) => /pick\s*-?\s*up/i.test(s.name));
  const zones = visible
    .filter((s) => s !== pickupRow && num(s.price) != null)
    .map((s) => ({
      name: squash(s.name).replace(/\s*\/\s*/g, ' / '),
      areas: squash(s.description || ''),
      fee: num(s.price),
    }))
    .sort((a, b) => a.fee - b.fee || a.name.localeCompare(b.name));
  return {
    pickup: pickupRow ? squash(pickupRow.description || '') : '',
    zones,
  };
}

const HEADERS = {
  accept: 'application/json',
  'x-requested-with': 'XMLHttpRequest',
  'bumpa-agent': 'Storefront',
  referer: `${STORE_URL}/`,
};

export async function fetchBumpa(fetchImpl = fetch) {
  const [pr, sr] = await Promise.all([
    fetchImpl(BUMPA_PRODUCTS_URL, { headers: HEADERS }),
    fetchImpl(BUMPA_SHIPPING_URL, { headers: HEADERS }),
  ]);
  if (!pr.ok) throw new Error(`Bumpa products returned ${pr.status}`);
  const pj = await pr.json();
  const sj = sr.ok ? await sr.json() : { shippings: [] };
  const products = pj?.products?.data || pj?.data || [];
  const shippings = sj?.shippings || [];
  if (!products.length) throw new Error('Bumpa returned no products');
  return { products, shippings };
}
