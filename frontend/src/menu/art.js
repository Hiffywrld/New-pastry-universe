// Cut-out photos for the display case, keyed by item and size.
// Files live in src/assets/cutouts. To add one: drop a transparent .webp
// in that folder and reference its name here. Items without a cut-out use
// their first Bumpa photo instead.

const files = import.meta.glob('../assets/cutouts/*.webp', { eager: true, import: 'default' });
const byName = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.webp', ''), url]),
);

const ART = {
  'banana-bread': {
    default: 'banana-medium',
    sizes: {
      mini: 'banana-mini',
      medium: 'banana-medium',
      large: 'banana-large',
      pan: 'banana-large',
      jumbo: 'banana-family',
      family: 'banana-family',
    },
  },
  birthday: {
    default: 'birthday-loaf',
    sizes: { '7in': 'birthday-loaf', '8in': 'birthday-round', '12in': 'birthday-loaf', double: 'birthday-double' },
  },
  oats: { default: 'oats' },
  'petit-box': { default: 'petit-box' },
  chinchin: {
    default: 'chinchin-pouch',
    sizes: { '200g': 'chinchin-pouch', '400g': 'chinchin-pouches', '1kg': 'chinchin-bucket', '2kg': 'chinchin-bucket' },
  },
  lemon: { default: 'lemon' },
  'red-velvet': { default: 'red-velvet' },
  cubed: { default: 'cubed' },
  dates: { default: 'dates' },
};

// The colour each treat's spotlight blooms in. Light, warm tones that dark
// text reads well on; dark mode mixes them down in styles.css.
const COLORS = {
  'banana-bread': '#f7cb4d',
  birthday: '#f5adc0',
  oats: '#e9d1a4',
  'petit-box': '#a9dcc9',
  chinchin: '#f5a845',
  lemon: '#f1e384',
  'red-velvet': '#ef8186',
  cubed: '#cfbbea',
  dates: '#d9a576',
};
const CATEGORY_COLORS = { 'Banana bread': '#f7cb4d', Cakes: '#f5adc0', 'Gift boxes': '#a9dcc9', 'Chin-chin': '#f5a845' };

export const colorFor = (item) => COLORS[item.id] || CATEGORY_COLORS[item.category] || '#efd8b4';

// The size shown first when someone opens an item.
const DEFAULT_SIZE = { 'banana-bread': 'medium', birthday: '7in', chinchin: '400g', cubed: '400g' };

export function defaultSizeKey(item) {
  const preferred = item.sizes.find((s) => s.key === DEFAULT_SIZE[item.id] && s.inStock);
  return (preferred || item.sizes.find((s) => s.inStock) || item.sizes[0])?.key;
}

// Returns { src, cutout } for an item, optionally at a given size.
export function artFor(item, sizeKey) {
  const entry = ART[item.id];
  const name = entry && ((sizeKey && entry.sizes?.[sizeKey]) || entry.default);
  if (name && byName[name]) return { src: byName[name], cutout: true };
  return { src: item.photos?.[0] || '', cutout: false };
}
