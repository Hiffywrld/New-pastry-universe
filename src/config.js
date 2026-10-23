// Brand details shown around the site. Edit these freely.

export const BRAND = {
  name: 'Pastry Universe',
  tagline: 'Premium quality snacks for premium clients.',
  intro: 'Banana bread, cakes and chin-chin from our kitchen in Lagos. Delivered across Lagos, or pick up in Ojodu Berger.',
  storeUrl: 'https://pastryuniverse.bumpa.shop',
  phone: '0901 720 2788',
  phoneIntl: '+2349017202788',
  whatsapp: 'https://wa.me/2349017202788',
  email: 'pastryuniversee@gmail.com',
  instagram: 'pastryuniverse',
  address: '8b Adefeyisan Street, Olawaiye Estate, Olowora, Lagos',
  credit: { label: 'Hiffy', url: 'https://github.com/hiffywrld' },
};

// The scrolling band under the display case.
export const TICKER = [
  'Fresh banana bread',
  'Premium quality snacks for premium clients',
  'Delivery across Lagos',
  'Birthday banana cakes',
  'Chin-chin by the bucket',
  'Pickup in Ojodu Berger',
];

// Where the site reads the live menu. Set to '' to always use the backup.
export const LIVE_MENU_URL = import.meta.env.VITE_PREVIEW ? '' : '/api/menu';
