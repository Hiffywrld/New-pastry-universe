// How Bumpa products get grouped on the site.
//
// Each Bumpa product (e.g. "Banana Bread- Medium") is matched to one family
// (e.g. "Banana Bread") by its name. Sizes and toppings come from Bumpa, so
// prices and stock stay in sync automatically. A new Bumpa product that
// matches nothing below still shows up, as its own item under "More treats".
//
// The order of this list is the order on the shelf.

export const FAMILIES = [
  {
    id: 'banana-bread',
    name: 'Banana Bread',
    category: 'Banana bread',
    match: /banana bread/i,
    exclude: /oats|lemon|birthday|dates/i,
    tag: 'Bestseller',
    description:
      'Our classic loaf. Get it plain or topped with raisins, coconut chips, chocolate chips or almond nuts. The mini feeds one person.',
  },
  {
    id: 'birthday',
    name: 'Birthday Banana Cake',
    category: 'Cakes',
    match: /birthday/i,
    description:
      'Loaded with assorted nuts inside and covered with chocolate or any other topping. Made for birthdays and gifts.',
  },
  {
    id: 'oats',
    name: 'Oats Banana Bread',
    category: 'Banana bread',
    match: /oats/i,
    tag: 'Fitfam',
    description: 'Made with oats and other natural ingredients, for anyone on a fitfam journey.',
  },
  {
    id: 'petit-box',
    name: 'Petit Loaf Box',
    category: 'Gift boxes',
    match: /petit/i,
    tag: 'Gift',
    description:
      'Six mini banana breads with different exotic toppings. Perfect for gifting friends and loved ones, with a handwritten note if you like.',
  },
  {
    id: 'chinchin',
    name: 'Chin-Chin',
    category: 'Chin-chin',
    match: /chin-?chin/i,
    exclude: /cubed/i,
    description: 'Delicious, crunchy chin-chin, plain or peppered.',
  },
  {
    id: 'lemon',
    name: 'Lemon Infused Banana Bread',
    category: 'Banana bread',
    match: /lemon/i,
    description: 'Banana bread infused with fresh lemon juice and lemon rind.',
  },
  {
    id: 'red-velvet',
    name: 'Red Velvet Cake',
    category: 'Cakes',
    match: /red velvet/i,
    description: 'Succulent, moist red dessert cake.',
  },
  {
    id: 'cubed',
    name: 'Cubed Chin-Chin',
    category: 'Chin-chin',
    match: /cubed/i,
    description: 'Cut into cubes. Delicious and crunchy, plain or peppered.',
  },
  {
    id: 'dates',
    name: 'Dates Powder Bread',
    category: 'Banana bread',
    match: /dates/i,
    tag: 'No sugar',
    description: 'Made with whole wheat flour and dates powder, with no sugar added.',
  },
];

// Menu sections, in order. Unknown categories go at the end.
export const CATEGORIES = ['Banana bread', 'Cakes', 'Gift boxes', 'Chin-chin', 'More treats'];

// Size words found in Bumpa product or variation names, smallest first.
// Order matters: "half paint bucket" must be caught as 1kg before 2kg.
export const SIZES = [
  { key: '200g', re: /200\s?g\b/i, label: '200g pouch' },
  { key: '400g', re: /400\s?g\b/i, label: '400g pouch' },
  { key: '1kg', re: /half\s+(paint\s+)?bucket|\b1\s?kg\b/i, label: '1kg half bucket' },
  { key: '2kg', re: /paint\s*bucket|\b2\s?kg\b/i, label: '2kg paint bucket' },
  { key: 'mini', re: /\bminis?\b/i, label: 'Mini' },
  { key: 'medium', re: /\bmedium\b/i, label: 'Medium' },
  { key: 'large', re: /\blarge\b/i, label: 'Large' },
  { key: 'pan', re: /pan[\s-]?sized/i, label: 'Pan-sized' },
  { key: 'jumbo', re: /\bjumbo(\s+size)?\b/i, label: 'Jumbo' },
  { key: 'family', re: /family(\s+size)?(\s+tray)?/i, label: 'Family tray' },
  { key: '7in', re: /\b7[\s-]?inch(es)?/i, label: '7-inch' },
  { key: '8in', re: /\b8[\s-]?inch(es)?/i, label: '8-inch' },
  { key: '12in', re: /\b12[\s-]?inch(es)?(\s+squared?)?/i, label: '12-inch square' },
  { key: 'double', re: /double\s+layer/i, label: 'Double layer' },
];
