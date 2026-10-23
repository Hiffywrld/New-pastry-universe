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
