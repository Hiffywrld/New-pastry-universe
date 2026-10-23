// A pretend backend that runs in the browser, used only for the clickable
// preview (VITE_MOCK=1). It mirrors the Spring Boot API closely enough to
// click through the shop and the admin with sample orders.

import demoMenu from './demo-menu.json';

const KEY = 'pu-demo-v4';
const DAY = 86_400_000;
const LAGOS_OFFSET = 60 * 60_000; // UTC+1, no daylight saving

const memory = { db: null };
const adminListeners = new Set();
const trackListeners = new Map();

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const lagosDate = (t = Date.now()) => new Date(t + LAGOS_OFFSET).toISOString().slice(0, 10);
const startOfLagosDay = (t = Date.now()) => Date.parse(lagosDate(t) + 'T00:00:00Z') - LAGOS_OFFSET;
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const CODE = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const code = () => 'PU-' + Array.from({ length: 5 }, () => CODE[rand(CODE.length)]).join('');
const token = () => Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14);

class MockError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function variantIndex() {
  const idx = new Map();
  for (const item of demoMenu.items) {
    for (const size of item.sizes) {
      for (const c of size.choices) idx.set(c.variantId, { item, size, choice: c });
    }
  }
  return idx;
}
const VARIANTS = variantIndex();

function normalizePhone(raw = '') {
  let d = String(raw).replace(/[^0-9+]/g, '');
  if (d.startsWith('+234')) d = d.slice(4);
  else if (d.startsWith('234') && d.length > 10) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  if (!/^[789][01]\d{8}$/.test(d)) throw new MockError('Enter a Nigerian phone number, like 0803 123 4567.');
  return '+234' + d;
}
const displayPhone = (p) => (p && p.length === 14 ? `0${p.slice(4, 7)} ${p.slice(7, 10)} ${p.slice(10)}` : p);

function availableDates(settings) {
  const today = Date.parse(lagosDate() + 'T00:00:00Z');
  const out = [];
  for (let i = settings.leadDays; i <= settings.maxDaysAhead; i++) {
    const d = new Date(today + i * DAY);
    const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (!settings.closedWeekdays.includes(weekday)) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function weekdayOf(iso) {
  const d = new Date(iso + 'T12:00:00Z').getUTCDay();
  return d === 0 ? 7 : d;
}

function capacity(db, date) {
  const s = db.settings;
  const live = db.orders.filter((o) => o.deliveryDate === date && o.status !== 'CANCELLED');
  const custom = (db.calendar || {})[date];
  const customLimit = custom && custom.maxOrders != null ? custom.maxOrders : null;
  const limit = customLimit != null ? customLimit : s.dailyLimit > 0 ? s.dailyLimit : null;
  const slotLimit = s.slotLimit > 0 ? s.slotLimit : null;
  const full = limit != null && live.length >= limit;
  const labels = [...s.timeSlots, ...new Set(live.map((o) => o.timeSlot).filter((t) => !s.timeSlots.includes(t)))];
  const weekdayClosed = s.closedWeekdays.includes(weekdayOf(date));
  const paid = live.filter((o) => o.paymentStatus === 'CONFIRMED');
  return {
    date, closed: weekdayClosed || Boolean(custom?.closed), weekdayClosed, note: custom?.note || null, limit, customLimit,
    orders: live.length, paidOrders: paid.length, revenue: paid.reduce((t, o) => t + o.total, 0), full,
    slots: labels.map((label) => {
      const n = live.filter((o) => o.timeSlot === label).length;
      return { label, orders: n, full: full || (slotLimit != null && n >= slotLimit) };
    }),
  };
}

function shopCalendar(db) {
  const out = { availableDates: [], fullDates: [], fullSlots: {} };
  for (const d of availableDates(db.settings)) {
    const c = capacity(db, d);
    if (c.closed) continue;
    if (c.full || c.slots.every((x) => x.full)) out.fullDates.push(d);
    else {
      out.availableDates.push(d);
      const taken = c.slots.filter((x) => x.full).map((x) => x.label);
      if (taken.length) out.fullSlots[d] = taken;
    }
  }
  return out;
}

const PAID = ['CONFIRMED', 'BAKING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];
const BAKED = ['READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];

function bySlot(db) {
  const slots = db.settings.timeSlots;
  const idx = (o) => (slots.indexOf(o.timeSlot) < 0 ? slots.length : slots.indexOf(o.timeSlot));
  return (a, b) => idx(a) - idx(b) || a.createdAt - b.createdAt;
}

function totals(orders) {
  const map = new Map();
  orders.forEach((o) => o.items.forEach((i) => {
    const key = [i.slug, i.size, i.option].join('|');
    const cur = map.get(key) || { slug: i.slug, product: i.name, size: i.size, option: i.option, quantity: 0, baked: 0, orders: 0 };
    cur.quantity += i.quantity;
    if (BAKED.includes(o.status)) cur.baked += i.quantity;
    cur.orders += 1;
    map.set(key, cur);
  }));
  return [...map.values()].sort((a, b) => a.product.localeCompare(b.product) || a.size.localeCompare(b.size) || a.option.localeCompare(b.option));
}

function riderStop(o, rider) {
  const gift = Boolean(o.gift);
  const phone = gift && o.gift.recipientPhone ? o.gift.recipientPhone : o.customerPhone;
  return {
    id: o.id, code: o.code, timeSlot: o.timeSlot, status: o.status, statusLabel: label(o.status, o.fulfilment),
    zone: o.zoneName, address: o.address, landmark: o.landmark, name: gift ? o.gift.recipientName : o.customerName,
    phone, phoneDisplay: displayPhone(phone), gift, from: gift ? o.customerName : null, giftNote: gift ? o.gift.note : null,
    notes: o.notes, items: toSummary(o).itemsText.split(', '), itemCount: o.items.reduce((t, i) => t + i.quantity, 0),
    mine: o.riderId === rider.id,
  };
}

function customerRows(db) {
  const rows = [];
  for (const [phone, c] of Object.entries(db.customers || {})) {
    const list = db.orders.filter((o) => o.customerPhone === phone);
    const live = list.filter((o) => o.status !== 'CANCELLED');
    const counts = {};
    live.forEach((o) => o.items.forEach((i) => { counts[i.name] = (counts[i.name] || 0) + i.quantity; }));
    const fav = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    rows.push({
      id: c.id, name: c.name, phone: displayPhone(phone), email: c.email, avatarUrl: null,
      orders: live.length, spent: live.filter((o) => o.paymentStatus === 'CONFIRMED').reduce((t, o) => t + o.total, 0),
      firstOrder: live.length ? new Date(Math.min(...live.map((o) => o.createdAt))).toISOString() : null,
      lastOrder: live.length ? new Date(Math.max(...live.map((o) => o.createdAt))).toISOString() : null,
      favourite: fav ? fav[0] : null, tags: c.tags || [], hasNotes: Boolean(c.notes), signedIn: list.some((o) => o.accountId),
      noOrdersYet: list.length === 0, _phone: phone, _counts: counts,
    });
  }
  return rows;
}

const LABELS = {
  AWAITING_PAYMENT: 'Order placed',
  PAYMENT_REVIEW: 'Checking payment',
  CONFIRMED: 'Payment confirmed',
  BAKING: 'In the oven',
  READY: 'Packed and ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  COMPLETED: 'Delivered',
  CANCELLED: 'Cancelled',
};
function label(status, fulfilment) {
  if (fulfilment === 'PICKUP' && status === 'READY') return 'Ready for pickup';
  if (fulfilment === 'PICKUP' && status === 'COMPLETED') return 'Collected';
  return LABELS[status];
}

const RECEIPT_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="560"><rect width="360" height="560" rx="24" fill="#f3f1ec"/><text x="180" y="250" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#6b645e">Sample transfer</text><text x="180" y="282" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#6b645e">screenshot (demo)</text></svg>',
  );

// Sample data -------------------------------------------------------------

const NAMES = ['Ada Obi', 'Tolu Adeyemi', 'Chidi Okeke', 'Funmi Bello', 'Kemi Lawal', 'Ifeanyi Eze', 'Bisi Ogun', 'Zainab Musa', 'Seun Ajayi', 'Ngozi Nwosu', 'Tunde Bakare', 'Amaka Uche', 'Yemi Alade', 'Dayo Fashola'];
const phoneFor = (name) => '080' + String(31000000 + NAMES.indexOf(name) * 1234567).slice(0, 8);
const ADDRESSES = ['14 Admiralty Way, Lekki Phase 1', '3 Opebi Road, Ikeja', '22 Herbert Macaulay Way, Yaba', '7 Awolowo Road, Ikoyi', '41 Isaac John Street, GRA Ikeja', '9 Fola Osibo Road, Lekki', '18 Bode Thomas Street, Surulere'];
const LANDMARKS = ['Opposite the filling station', 'Blue gate, next to the pharmacy', 'Behind the church', null, null];

function seed() {
  const now = Date.now();
  const settings = {
    bankName: 'Moniepoint MFB',
    accountName: 'Pastry Universe (demo)',
    accountNumber: '0000000000',
    phone: '0901 720 2788',
    whatsapp: '2349017202788',
    email: 'pastryuniversee@gmail.com',
    instagram: 'pastryuniverse',
    address: '8b Adefeyisan Street, Olawaiye Estate, Olowora, Lagos',
    pickupAddress: 'No. 10 Johnson Street, Kajola, Ojodu Berger',
    pickupNote: 'Please call 0901 720 2788 before you come.',
    leadDays: 1,
    maxDaysAhead: 21,
    closedWeekdays: [],
    timeSlots: demoMenu.store.timeSlots,
    ticker: demoMenu.store.ticker,
    announcement: '',
    shopOpen: true,
    game: { enabled: true, percentByOrders: [5, 10, 15, 25], perfectPercent: 40, perfectMinTimeLeft: 8, maxDiscount: 5000, validDays: 14 },
    dailyLimit: 14,
    slotLimit: null,
  };
  const db = {
    settings, orders: [], events: [], nextId: 1, account: null, reward: null, played: false, signupsToday: 3, gamesToday: 5,
    customers: {}, nextCustomerId: 1, calendar: {},
    riders: [{ id: 1, name: 'Tunde', phone: '+2348055555555', token: 'demo-rider-tunde', createdAt: now - 20 * DAY, lastSeenAt: now - 3_600_000 }],
    nextRiderId: 2,
  };
  const popular = [...VARIANTS.keys()];
  for (let i = 0; i < 46; i++) {
    const daysAgo = i < 9 ? 0 : 1 + rand(13);
    const sinceMidnight = Math.max(10 * 60_000, now - startOfLagosDay(now) - 5 * 60_000);
    const created = daysAgo === 0
      ? now - Math.floor(((i + 1) / 10) * sinceMidnight)
      : now - daysAgo * DAY - rand(9) * 3_600_000 - rand(60) * 60_000;
    const lines = Array.from({ length: 1 + rand(3) }, () => ({ variantId: pick(popular.slice(0, 40)), quantity: 1 + rand(3) }));
    const delivery = Math.random() > 0.25;
    const zone = pick(demoMenu.delivery.zones.slice(0, 14));
    let status = 'COMPLETED';
    if (daysAgo === 0) status = ['PAYMENT_REVIEW', 'PAYMENT_REVIEW', 'CONFIRMED', 'CONFIRMED', 'BAKING', 'READY', 'OUT_FOR_DELIVERY', 'AWAITING_PAYMENT', 'COMPLETED'][i];
    if (daysAgo > 0 && Math.random() < 0.06) status = 'CANCELLED';
    const o = buildOrder(db, {
      items: lines,
      customer: (() => { const n = pick(NAMES); return { name: n, phone: phoneFor(n) }; })(),
      fulfilment: delivery ? 'DELIVERY' : 'PICKUP',
      zoneId: zone.id,
      address: pick(ADDRESSES),
      landmark: pick(LANDMARKS),
      deliveryDate: lagosDate(created + DAY),
      timeSlot: pick(settings.timeSlots),
    }, created);
    const paid = !['AWAITING_PAYMENT', 'PAYMENT_REVIEW', 'CANCELLED'].includes(status);
    if (status !== 'AWAITING_PAYMENT' && status !== 'CANCELLED') o.receipts.push({ id: o.id * 10, url: RECEIPT_SVG, contentType: 'image/svg+xml', createdAt: created + 600_000 });
    if (paid) {
      o.paymentStatus = 'CONFIRMED';
      o.paidAt = created + 1_800_000;
    } else if (status === 'PAYMENT_REVIEW') o.paymentStatus = 'RECEIPT_UPLOADED';
    const path = ['PAYMENT_REVIEW', 'CONFIRMED', 'BAKING', 'READY', ...(delivery ? ['OUT_FOR_DELIVERY'] : []), 'COMPLETED'];
    const stop = status === 'CANCELLED' ? -1 : path.indexOf(status);
    path.slice(0, stop + 1).forEach((s, k) => o.events.push({ status: s, note: null, actor: k === 0 ? 'Customer' : 'Pastry Universe', at: created + (k + 1) * 1_200_000 }));
    if (status === 'CANCELLED') o.events.push({ status: 'CANCELLED', note: null, actor: 'Pastry Universe', at: created + 3_600_000 });
    o.status = status;
    o.updatedAt = o.events[o.events.length - 1].at;
  }
  const upcoming = [
    [0, 'READY'], [0, 'READY'], [0, 'OUT_FOR_DELIVERY'], [0, 'BAKING'], [0, 'COMPLETED'],
    [1, 'CONFIRMED'], [1, 'CONFIRMED'], [1, 'CONFIRMED'], [1, 'AWAITING_PAYMENT'],
    [2, 'CONFIRMED'], [2, 'CONFIRMED'], [2, 'PAYMENT_REVIEW'], [3, 'CONFIRMED'], [3, 'CONFIRMED'], [4, 'CONFIRMED'], [5, 'AWAITING_PAYMENT'],
  ];
  upcoming.forEach(([ahead, status], k) => {
    const created = now - (ahead === 0 ? DAY + rand(8) * 3_600_000 : rand(20) * 3_600_000);
    const n = NAMES[(k * 5) % NAMES.length];
    const delivery = k % 4 !== 3;
    const o = buildOrder(db, {
      items: Array.from({ length: 1 + rand(2) }, () => ({ variantId: pick(popular.slice(0, 30)), quantity: 1 + rand(3) })),
      customer: { name: n, phone: phoneFor(n) },
      fulfilment: delivery ? 'DELIVERY' : 'PICKUP',
      zoneId: pick(demoMenu.delivery.zones.slice(0, 12)).id,
      address: ADDRESSES[k % ADDRESSES.length],
      landmark: LANDMARKS[k % LANDMARKS.length],
      deliveryDate: lagosDate(now + ahead * DAY),
      timeSlot: settings.timeSlots[k % settings.timeSlots.length],
      gift: k === 6 ? { recipientName: 'Mummy Bisi', recipientPhone: '0802 444 1234', note: 'Happy birthday Mum! Love, Funmi' } : undefined,
    }, created);
    const paid = !['AWAITING_PAYMENT', 'PAYMENT_REVIEW'].includes(status);
    if (status !== 'AWAITING_PAYMENT') o.receipts.push({ id: o.id * 10, url: RECEIPT_SVG, contentType: 'image/svg+xml', createdAt: created + 600_000 });
    if (paid) {
      o.paymentStatus = 'CONFIRMED';
      o.paidAt = created + 1_800_000;
    } else if (status === 'PAYMENT_REVIEW') o.paymentStatus = 'RECEIPT_UPLOADED';
    const path = ['PAYMENT_REVIEW', 'CONFIRMED', 'BAKING', 'READY', ...(delivery ? ['OUT_FOR_DELIVERY'] : []), 'COMPLETED'];
    path.slice(0, path.indexOf(status) + 1).forEach((st, j) => o.events.push({ status: st, note: null, actor: j === 0 ? 'Customer' : 'Pastry Universe', at: created + (j + 1) * 1_200_000 }));
    o.status = status;
    o.updatedAt = o.events[o.events.length - 1].at;
  });
  db.customers[normalizePhone(phoneFor('Ada Obi'))].notes = 'Orders for her office most Fridays. Likes extra raisins.';
  db.customers[normalizePhone(phoneFor('Ada Obi'))].tags = ['Regular', 'Office'];
  db.customers[normalizePhone(phoneFor('Kemi Lawal'))].tags = ['Birthday cakes'];
  // Some anonymous browsing for the funnel.
  for (let i = 0; i < 64; i++) db.events.push({ session: 's' + i, type: 'page_view', at: now - rand(8) * 3_600_000 });
  for (let i = 0; i < 41; i++) db.events.push({ session: 's' + i, type: 'product_view', at: now - rand(8) * 3_600_000 });
  for (let i = 0; i < 19; i++) db.events.push({ session: 's' + i, type: 'add_to_cart', at: now - rand(8) * 3_600_000 });
  for (let i = 0; i < 12; i++) db.events.push({ session: 's' + i, type: 'checkout_start', at: now - rand(8) * 3_600_000 });
  return db;
}

function load() {
  if (memory.db) return memory.db;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory.db = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  if (!memory.db) memory.db = seed();
  return memory.db;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory.db));
  } catch {
    /* storage unavailable: keep in memory */
  }
}

function buildOrder(db, req, createdAt = Date.now()) {
  const merged = new Map();
  for (const l of req.items || []) merged.set(l.variantId, (merged.get(l.variantId) || 0) + Number(l.quantity || 0));
  if (!merged.size) throw new MockError('Your cart is empty.');
  const items = [...merged].map(([variantId, quantity]) => {
    const v = VARIANTS.get(variantId);
    if (!v) throw new MockError('Something in your cart is no longer on the menu. Remove it and try again.');
    if (!v.choice.inStock) throw new MockError(`${v.item.name} (${v.size.label}) is sold out. Remove it to continue.`, 409);
    return {
      slug: v.item.id, name: v.item.name, size: v.size.label, option: v.choice.label,
      quantity, unitPrice: v.choice.price, lineTotal: v.choice.price * quantity,
    };
  });
  const name = (req.customer?.name || '').trim();
  if (!name) throw new MockError('Enter your name.');
  const phone = normalizePhone(req.customer?.phone);
  db.customers = db.customers || {};
  if (!db.customers[phone]) {
    db.nextCustomerId = db.nextCustomerId || 1;
    db.customers[phone] = { id: db.nextCustomerId++, name, email: req.customer?.email || null, notes: null, tags: [], createdAt };
  } else db.customers[phone].name = name;
  let zone = null;
  if (req.fulfilment === 'DELIVERY') {
    zone = demoMenu.delivery.zones.find((z) => z.id === Number(req.zoneId));
    if (!zone) throw new MockError('Choose your delivery area.');
    if (!req.address?.trim()) throw new MockError('Enter the delivery address.');
  }
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const fee = zone ? zone.fee : 0;
  const gift = req.gift?.recipientName?.trim()
    ? { recipientName: req.gift.recipientName.trim(), recipientPhone: req.gift.recipientPhone ? normalizePhone(req.gift.recipientPhone) : null, note: req.gift.note || null }
    : null;
  const o = {
    id: db.nextId++, code: code(), token: token(), status: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID',
    customerName: name, customerPhone: phone, customerEmail: req.customer?.email || null,
    fulfilment: req.fulfilment, zoneName: zone?.name || null, address: zone ? req.address.trim() : null,
    landmark: zone ? req.landmark || null : null, deliveryDate: req.deliveryDate, timeSlot: req.timeSlot,
    gift, notes: req.notes || null, items, subtotal, deliveryFee: fee, total: subtotal + fee,
    receipts: [], events: [{ status: 'AWAITING_PAYMENT', note: null, actor: 'Customer', at: createdAt }],
    createdAt, updatedAt: createdAt, paidAt: null, rejectedReason: null, discount: 0, rewardCode: null, accountId: null,
    customerId: db.customers[phone].id, riderId: null,
  };
  if (req.useReward) {
    const r = db.reward;
    if (!db.account) throw new MockError('Sign in to use your welcome discount.');
    if (!r || r.redeemed || r.percent <= 0 || Date.now() > Date.parse(r.expiresAt)) throw new MockError('Your welcome discount has expired or was already used.', 409);
    o.discount = Math.min(r.maxAmount, Math.round((subtotal * r.percent) / 100));
    o.rewardCode = r.code;
    o.total = subtotal - o.discount + fee;
    r.redeemed = true;
  }
  if (req.accountId) o.accountId = req.accountId;
  db.orders.push(o);
  return o;
}

// Shapes, matching the real API ---------------------------------------------

function toPublic(o, s) {
  const steps = ['AWAITING_PAYMENT', 'PAYMENT_REVIEW', 'CONFIRMED', 'BAKING', 'READY', ...(o.fulfilment === 'DELIVERY' ? ['OUT_FOR_DELIVERY'] : []), 'COMPLETED'];
  const current = steps.indexOf(o.status);
  const awaiting = o.status === 'AWAITING_PAYMENT' || o.status === 'PAYMENT_REVIEW';
  return {
    code: o.code, token: o.token, status: o.status, statusLabel: label(o.status, o.fulfilment), paymentStatus: o.paymentStatus,
    fulfilment: o.fulfilment, items: o.items, subtotal: o.subtotal, deliveryFee: o.deliveryFee, total: o.total,
    discount: o.discount || 0,
    zoneName: o.zoneName, address: o.address, landmark: o.landmark, deliveryDate: o.deliveryDate, timeSlot: o.timeSlot,
    customerName: o.customerName.split(/\s+/)[0], gift: o.gift ? { recipientName: o.gift.recipientName, note: o.gift.note } : undefined,
    notes: o.notes, receiptUploaded: o.receipts.length > 0, rejectedReason: o.paymentStatus === 'REJECTED' ? o.rejectedReason : undefined,
    bank: awaiting && s.bankName ? { bankName: s.bankName, accountName: s.accountName, accountNumber: s.accountNumber } : undefined,
    pickupAddress: o.fulfilment === 'PICKUP' ? s.pickupAddress : undefined, whatsapp: s.whatsapp,
    timeline: steps.map((st, i) => {
      const ev = [...o.events].reverse().find((e) => e.status === st);
      const done = current >= 0 && i <= current;
      return { status: st, label: label(st, o.fulfilment), at: done && ev ? new Date(ev.at).toISOString() : undefined, done };
    }),
    createdAt: new Date(o.createdAt).toISOString(),
  };
}

function toSummary(o) {
  return {
    id: o.id, code: o.code, customerName: o.customerName, customerPhone: displayPhone(o.customerPhone), total: o.total,
    status: o.status, paymentStatus: o.paymentStatus, fulfilment: o.fulfilment, zoneName: o.zoneName || undefined,
    deliveryDate: o.deliveryDate, timeSlot: o.timeSlot,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    itemsText: o.items.map((i) => `${i.quantity}× ${i.name} (${[i.size !== 'Regular' && i.size, i.option].filter(Boolean).join(', ')})`.replace(' ()', '')).join(', '),
    hasReceipt: o.receipts.length > 0, gift: Boolean(o.gift),
    createdAt: new Date(o.createdAt).toISOString(), updatedAt: new Date(o.updatedAt).toISOString(),
  };
}

function toDetail(o) {
  return {
    summary: toSummary(o), customerEmail: o.customerEmail || undefined, address: o.address || undefined, landmark: o.landmark || undefined,
    gift: o.gift ? { ...o.gift, recipientPhone: displayPhone(o.gift.recipientPhone) } : undefined, notes: o.notes || undefined,
    items: o.items, subtotal: o.subtotal, deliveryFee: o.deliveryFee, discount: o.discount || 0, rewardCode: o.rewardCode || undefined, trackingToken: o.token,
    paidAt: o.paidAt ? new Date(o.paidAt).toISOString() : undefined,
    receipts: o.receipts.map((r) => ({ id: r.id, contentType: r.contentType, sizeBytes: 0, createdAt: new Date(r.createdAt).toISOString() })),
    events: o.events.map((e) => ({ status: e.status, label: label(e.status, o.fulfilment), note: e.note || undefined, actor: e.actor, at: new Date(e.at).toISOString() })),
  };
}

function publish(o, kind) {
  const db = load();
  adminListeners.forEach((l) => l.order?.({ kind, order: toSummary(o) }));
  trackListeners.get(o.token)?.forEach((l) => l.order?.(toPublic(o, db.settings)));
}

function move(o, status, note, actor) {
  o.status = status;
  o.updatedAt = Date.now();
  o.events.push({ status, note: note || null, actor, at: Date.now() });
}

const byToken = (t) => {
  const o = load().orders.find((x) => x.token === t);
  if (!o) throw new MockError("We couldn't find that order.", 404);
  return o;
};
const byId = (id) => {
  const o = load().orders.find((x) => x.id === Number(id));
  if (!o) throw new MockError('Order not found.', 404);
  return o;
};

// Visitors and the occasional demo order, so the admin feels alive.
let visitors = 7;
let ticker = null;
function startDemoPulse() {
  if (ticker) return;
  let tick = 0;
  ticker = setInterval(() => {
    tick++;
    visitors = Math.max(2, Math.min(18, visitors + pick([-2, -1, 0, 1, 1, 2])));
    adminListeners.forEach((l) => l.visitors?.({ count: visitors }));
    if (tick % 9 === 4) {
      const db = load();
      const v = pick([...VARIANTS.keys()].slice(0, 30));
      const zone = pick(demoMenu.delivery.zones.slice(0, 10));
      const o = buildOrder(db, {
        items: [{ variantId: v, quantity: 1 + rand(2) }],
        customer: { name: pick(NAMES), phone: '081' + String(10000000 + rand(89999999)) },
        fulfilment: 'DELIVERY', zoneId: zone.id, address: '3 Demo Street, Lagos',
        deliveryDate: shopCalendar(db).availableDates[0] || availableDates(db.settings)[0], timeSlot: db.settings.timeSlots[0],
      });
      save();
      publish(o, 'created');
    }
  }, 5000);
}

// The API ----------------------------------------------------------------------

export const api = {
  mode: 'demo',

  menu: async () => {
    await wait(150);
    const s = load().settings;
    return { ...demoMenu, store: { ...demoMenu.store, ticker: s.ticker, announcement: s.announcement, shopOpen: s.shopOpen, timeSlots: s.timeSlots, ...shopCalendar(load()) } };
  },
  createOrder: async (req) => {
    await wait(500);
    const db = load();
    if (!db.settings.shopOpen) throw new MockError("The shop isn't taking orders right now. Please check back soon.", 409);
    if (!availableDates(db.settings).includes(req.deliveryDate)) throw new MockError("That date isn't available. Pick another day.");
    if (!db.settings.timeSlots.includes(req.timeSlot)) throw new MockError('Pick one of the available times.');
    const cap = capacity(db, req.deliveryDate);
    if (cap.closed) throw new MockError("We're closed that day. Pick another day.", 409);
    if (cap.full) throw new MockError('That day is fully booked. Pick another day.', 409);
    if (cap.slots.some((x) => x.label === req.timeSlot && x.full)) throw new MockError('That time is fully booked. Pick another time or day.', 409);
    const o = buildOrder(db, { ...req, accountId: db.account ? db.account.id : null });
    save();
    publish(o, 'created');
    return toPublic(o, db.settings);
  },
  track: async (t) => {
    await wait(150);
    return toPublic(byToken(t), load().settings);
  },
  lookup: async (c, phone) => {
    await wait(300);
    const p = normalizePhone(phone);
    const o = load().orders.find((x) => x.code.toLowerCase() === String(c).trim().toLowerCase() && x.customerPhone === p);
    if (!o) throw new MockError("We couldn't find an order with that code and phone number.", 404);
    return { token: o.token };
  },
  uploadReceipt: async (t, file) => {
    const o = byToken(t);
    if (!['AWAITING_PAYMENT', 'PAYMENT_REVIEW'].includes(o.status)) throw new MockError("This order's payment is already confirmed.", 409);
    const url = file.size < 1_500_000
      ? await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); })
      : RECEIPT_SVG;
    await wait(600);
    o.receipts.push({ id: Date.now(), url, contentType: file.type, createdAt: Date.now() });
    o.paymentStatus = 'RECEIPT_UPLOADED';
    if (o.status !== 'PAYMENT_REVIEW') move(o, 'PAYMENT_REVIEW', 'Receipt uploaded', 'Customer');
    save();
    publish(o, 'receipt');
    return toPublic(o, load().settings);
  },
  trackStream: (t, handlers) => {
    if (!trackListeners.has(t)) trackListeners.set(t, new Set());
    trackListeners.get(t).add(handlers);
    setTimeout(() => handlers.open?.(), 50);
    return () => trackListeners.get(t)?.delete(handlers);
  },
  event: (e) => {
    if (e.type === 'heartbeat') return;
    const db = load();
    db.events.push({ session: e.sessionId, type: e.type, at: Date.now() });
    if (db.events.length > 2000) db.events.splice(0, 500);
    save();
  },

  account: {
    hasToken: () => Boolean(load().account),
    config: async () => {
      const g = load().settings.game;
      return { googleClientId: '', demo: true, gameEnabled: g.enabled, topPercent: g.perfectPercent, percentByOrders: g.percentByOrders, perfectMinTimeLeft: g.perfectMinTimeLeft, maxDiscount: g.maxDiscount, validDays: g.validDays };
    },
    signInWithGoogle: async () => api.account.demoSignIn(),
    demoSignIn: async () => {
      await wait(500);
      const db = load();
      if (!db.account) {
        db.account = { id: 9001, name: 'Demo Shopper', email: 'demo.shopper@gmail.com', avatarUrl: null };
        db.signupsToday++;
      }
      save();
      return api.account.me();
    },
    signOut: () => {
      const db = load();
      db.account = null;
      db.reward = null;
      db.played = false;
      save();
    },
    me: async () => {
      await wait(150);
      const db = load();
      if (!db.account) throw new MockError('Please sign in again.', 401);
      const g = db.settings.game;
      const reward = db.reward && { ...db.reward, expired: Date.now() > Date.parse(db.reward.expiresAt) };
      const orders = db.orders.filter((o) => o.accountId === db.account.id).sort((a, b) => b.createdAt - a.createdAt).map((o) => ({
        code: o.code, token: o.token, total: o.total, status: o.status, statusLabel: label(o.status, o.fulfilment),
        itemsText: toSummary(o).itemsText, createdAt: new Date(o.createdAt).toISOString(),
      }));
      return { profile: db.account, reward, game: { enabled: g.enabled, played: db.played || Boolean(db.reward), seconds: 45, topPercent: g.perfectPercent }, orders };
    },
    startGame: async () => {
      await wait(200);
      const db = load();
      if (db.reward) throw new MockError("You've already played. Your reward is on your account page.", 409);
      db.played = true;
      db.gamesToday++;
      save();
      return { sessionId: 'demo', seed: Math.floor(Math.random() * 2 ** 31), seconds: 45 };
    },
    finishGame: async ({ ordersCompleted, timeLeft, mistakes }) => {
      await wait(500);
      const db = load();
      const g = db.settings.game;
      let pct = g.percentByOrders[Math.max(0, Math.min(3, ordersCompleted))];
      if (ordersCompleted === 3 && mistakes === 0 && timeLeft >= g.perfectMinTimeLeft) pct = Math.max(pct, g.perfectPercent);
      db.reward = { code: 'PU' + code().slice(3) + 'X', percent: pct, maxAmount: g.maxDiscount, expiresAt: new Date(Date.now() + g.validDays * DAY).toISOString(), redeemed: false, expired: false };
      save();
      return { ordersCompleted, timeLeft, mistakes, reward: db.reward };
    },
  },

  admin: {
    hasToken: () => {
      try {
        return Boolean(sessionStorage.getItem('pu-demo-admin')) || memory.admin;
      } catch {
        return Boolean(memory.admin);
      }
    },
    login: async (email, password) => {
      await wait(400);
      if (!email || !password) throw new MockError('Enter any email and password to try the demo.', 401);
      memory.admin = true;
      try { sessionStorage.setItem('pu-demo-admin', '1'); } catch { /* ignore */ }
      return { id: 1, email, name: 'Pastry Universe', role: 'OWNER' };
    },
    logout: () => {
      memory.admin = false;
      try { sessionStorage.removeItem('pu-demo-admin'); } catch { /* ignore */ }
    },
    me: async () => ({ id: 1, email: 'owner@pastryuniverse.demo', name: 'Pastry Universe', role: 'OWNER' }),
    dashboard: async () => {
      await wait(200);
      const db = load();
      const today = startOfLagosDay();
      const yesterday = today - DAY;
      const live = db.orders.filter((o) => o.status !== 'CANCELLED');
      const paidToday = live.filter((o) => o.paidAt >= today);
      const tomorrow = lagosDate(Date.now() + DAY);
      const revenue = [];
      for (let i = 13; i >= 0; i--) {
        const start = today - i * DAY;
        const day = live.filter((o) => o.paidAt >= start && o.paidAt < start + DAY);
        revenue.push({ day: lagosDate(start + 3_600_000), revenue: day.reduce((s, o) => s + o.total, 0), orders: day.length });
      }
      const since30 = today - 29 * DAY;
      const sellers = new Map();
      const areas = new Map();
      live.filter((o) => o.paidAt >= since30).forEach((o) => {
        o.items.forEach((i) => {
          const cur = sellers.get(i.slug) || { name: i.name, slug: i.slug, quantity: 0, revenue: 0 };
          cur.quantity += i.quantity;
          cur.revenue += i.lineTotal;
          sellers.set(i.slug, cur);
        });
        const a = o.zoneName || 'Pickup';
        const cur = areas.get(a) || { name: a, orders: 0, revenue: 0 };
        cur.orders++;
        cur.revenue += o.total;
        areas.set(a, cur);
      });
      const sessions = (type) => new Set(db.events.filter((e) => e.type === type && e.at >= today).map((e) => e.session)).size;
      const ordersToday = live.filter((o) => o.createdAt >= today).length;
      return {
        kpis: {
          salesToday: paidToday.reduce((s, o) => s + o.total, 0),
          paidOrdersToday: paidToday.length,
          salesYesterday: live.filter((o) => o.paidAt >= yesterday && o.paidAt < today).reduce((s, o) => s + o.total, 0),
          ordersToday,
          awaitingReview: db.orders.filter((o) => o.status === 'PAYMENT_REVIEW').length,
          awaitingPayment: db.orders.filter((o) => o.status === 'AWAITING_PAYMENT').length,
          dueTomorrow: db.orders.filter((o) => o.deliveryDate === tomorrow && ['CONFIRMED', 'BAKING', 'READY'].includes(o.status)).length,
          visitorsNow: visitors,
          signupsToday: db.signupsToday,
          gamesToday: db.gamesToday,
        },
        revenue,
        bestSellers: [...sellers.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6),
        topAreas: [...areas.values()].sort((a, b) => b.orders - a.orders).slice(0, 6),
        funnel: [
          { key: 'visited', label: 'Visited', count: sessions('page_view') },
          { key: 'viewed', label: 'Looked at a treat', count: sessions('product_view') },
          { key: 'cart', label: 'Added to cart', count: sessions('add_to_cart') },
          { key: 'checkout', label: 'Started checkout', count: sessions('checkout_start') },
          { key: 'ordered', label: 'Placed an order', count: ordersToday },
          { key: 'paid', label: 'Paid', count: paidToday.length },
        ],
        generatedAt: new Date().toISOString(),
      };
    },
    board: async () => {
      await wait(150);
      const today = startOfLagosDay();
      return load().orders
        .filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status) || (o.status === 'COMPLETED' && o.updatedAt >= today))
        .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.createdAt - b.createdAt)
        .map(toSummary);
    },
    order: async (id) => {
      await wait(120);
      return toDetail(byId(id));
    },
    setStatus: async (id, status, note) => {
      await wait(200);
      const o = byId(id);
      if (o.status === 'CANCELLED') throw new MockError('This order was cancelled.', 409);
      if (['AWAITING_PAYMENT', 'PAYMENT_REVIEW'].includes(status)) throw new MockError('Payment steps change when the customer uploads a receipt or you confirm it.');
      if (status !== 'CANCELLED' && o.paymentStatus !== 'CONFIRMED') {
        o.paymentStatus = 'CONFIRMED';
        o.paidAt = Date.now();
      }
      move(o, status, note, 'Pastry Universe');
      save();
      publish(o, 'status');
      return toDetail(o);
    },
    confirmPayment: async (id) => {
      await wait(250);
      const o = byId(id);
      o.paymentStatus = 'CONFIRMED';
      o.paidAt = Date.now();
      move(o, 'CONFIRMED', 'Payment received', 'Pastry Universe');
      save();
      publish(o, 'payment');
      return toDetail(o);
    },
    rejectPayment: async (id, reason) => {
      await wait(250);
      const o = byId(id);
      o.paymentStatus = 'REJECTED';
      o.rejectedReason = reason || "We couldn't find your payment. Check the amount and upload the receipt again.";
      move(o, 'AWAITING_PAYMENT', o.rejectedReason, 'Pastry Universe');
      save();
      publish(o, 'payment');
      return toDetail(o);
    },
    receiptUrl: async (id, receiptId) => byId(id).receipts.find((r) => r.id === receiptId)?.url || RECEIPT_SVG,
    settings: async () => ({ ...load().settings }),
    saveSettings: async (s) => {
      await wait(300);
      load().settings = { ...s };
      save();
      return { ...s };
    },
    calendar: async (from, to) => {
      await wait(150);
      const db = load();
      const today = lagosDate();
      const start = from || lagosDate(Date.now() - 3 * DAY);
      const end = to || lagosDate(Date.parse(start + 'T12:00:00Z') + 30 * DAY);
      const days = [];
      for (let t = Date.parse(start + 'T12:00:00Z'); lagosDate(t - LAGOS_OFFSET) <= end; t += DAY) days.push(capacity(db, new Date(t).toISOString().slice(0, 10)));
      const s = db.settings;
      return { today, dailyLimit: s.dailyLimit > 0 ? s.dailyLimit : null, slotLimit: s.slotLimit > 0 ? s.slotLimit : null, timeSlots: s.timeSlots, days };
    },
    setDay: async (date, { closed, maxOrders, note }) => {
      await wait(200);
      const db = load();
      if (date < lagosDate()) throw new MockError('That day has passed.');
      if (maxOrders != null && maxOrders < 0) throw new MockError("The limit can't be below zero.");
      const entry = { closed: Boolean(closed), maxOrders: maxOrders ?? null, note: note?.trim() || null };
      db.calendar = db.calendar || {};
      if (!entry.closed && entry.maxOrders == null && !entry.note) delete db.calendar[date];
      else db.calendar[date] = entry;
      save();
      return capacity(db, date);
    },
    setLimits: async ({ dailyLimit, slotLimit }) => {
      await wait(200);
      const db = load();
      db.settings.dailyLimit = dailyLimit;
      db.settings.slotLimit = slotLimit;
      save();
      return api.admin.calendar();
    },
    day: async (date) => {
      await wait(180);
      const db = load();
      const d = date || lagosDate();
      const list = db.orders.filter((o) => o.deliveryDate === d && o.status !== 'CANCELLED').sort(bySlot(db));
      return {
        date: d, capacity: capacity(db, d),
        toBake: totals(list.filter((o) => PAID.includes(o.status))),
        unpaid: totals(list.filter((o) => ['AWAITING_PAYMENT', 'PAYMENT_REVIEW'].includes(o.status))),
        orders: list.map(toDetail),
      };
    },
    bulkStatus: async (ids, status) => {
      await wait(250);
      const out = [];
      for (const id of [...new Set(ids)]) out.push((await api.admin.setStatus(id, status)).summary);
      return out;
    },
    riders: async () => {
      await wait(100);
      return (load().riders || []).filter((r) => r.active !== false).map((r) => ({ ...r, phone: displayPhone(r.phone), createdAt: new Date(r.createdAt).toISOString(), lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : null }));
    },
    addRider: async ({ name, phone }) => {
      await wait(200);
      if (!name?.trim()) throw new MockError("Enter the rider's name.");
      const db = load();
      const r = { id: db.nextRiderId++, name: name.trim(), phone: phone ? normalizePhone(phone) : null, token: 'demo-' + token(), createdAt: Date.now(), lastSeenAt: null, active: true };
      db.riders.push(r);
      save();
      return { ...r, phone: displayPhone(r.phone), createdAt: new Date(r.createdAt).toISOString() };
    },
    removeRider: async (id) => {
      await wait(150);
      const r = load().riders.find((x) => x.id === Number(id));
      if (r) r.active = false;
      save();
      return null;
    },
    customers: async (q = '', sort = 'recent') => {
      await wait(150);
      const db = load();
      const term = q.trim().toLowerCase();
      let digits = q.replace(/\D/g, '');
      if (digits.startsWith('0')) digits = '234' + digits.slice(1);
      const rows = customerRows(db).filter((r) => !term || r.name.toLowerCase().includes(term) || (r.email || '').toLowerCase().includes(term) || (digits.length >= 3 && r._phone.replace(/\D/g, '').includes(digits)));
      const cmp = {
        recent: (a, b) => (b.lastOrder || '').localeCompare(a.lastOrder || ''),
        spent: (a, b) => b.spent - a.spent || b.orders - a.orders,
        orders: (a, b) => b.orders - a.orders || b.spent - a.spent,
        name: (a, b) => a.name.localeCompare(b.name),
      }[sort] || ((a, b) => 0);
      return rows.sort(cmp).map(({ _phone, _counts, ...r }) => r);
    },
    customer: async (id) => {
      await wait(150);
      const db = load();
      const row = customerRows(db).find((r) => r.id === Number(id));
      if (!row) throw new MockError('Customer not found.', 404);
      const c = db.customers[row._phone];
      const list = db.orders.filter((o) => o.customerPhone === row._phone).sort((a, b) => b.createdAt - a.createdAt);
      const paidCount = list.filter((o) => o.status !== 'CANCELLED' && o.paymentStatus === 'CONFIRMED').length;
      const { _phone, _counts, ...clean } = row;
      return {
        row: clean, notes: c.notes, joinedAt: new Date(c.createdAt).toISOString(), averageOrder: paidCount ? Math.round(row.spent / paidCount) : 0,
        favourites: Object.entries(_counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([product, quantity]) => ({ product, quantity })),
        orders: list.map(toSummary),
      };
    },
    saveCustomer: async (id, { notes, tags }) => {
      await wait(200);
      const db = load();
      const entry = Object.values(db.customers).find((c) => c.id === Number(id));
      if (!entry) throw new MockError('Customer not found.', 404);
      const seen = new Set();
      const clean = (tags || []).map((t) => t.trim().replace(/\s+/g, ' ')).filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
      if (clean.some((t) => t.length > 24)) throw new MockError('Keep each tag under 24 characters.');
      if (clean.length > 8) throw new MockError('Use up to 8 tags.');
      entry.notes = notes?.trim() || null;
      entry.tags = clean;
      save();
      return api.admin.customer(id);
    },
    stream: (handlers) => {
      adminListeners.add(handlers);
      startDemoPulse();
      setTimeout(() => {
        handlers.open?.();
        handlers.hello?.({ visitors });
      }, 50);
      return () => adminListeners.delete(handlers);
    },
  },

  rider: {
    day: async (t, date) => {
      await wait(200);
      const db = load();
      const rider = (db.riders || []).find((r) => r.token === t && r.active !== false);
      if (!rider) throw new MockError("This rider link isn't active. Ask the kitchen for a new one.", 404);
      rider.lastSeenAt = Date.now();
      save();
      const d = date || lagosDate();
      const stops = db.orders
        .filter((o) => o.deliveryDate === d && o.fulfilment === 'DELIVERY' && PAID.includes(o.status))
        .sort(bySlot(db))
        .map((o) => riderStop(o, rider));
      return { rider: rider.name, date: d, today: lagosDate(), kitchenPhone: db.settings.phone, stops };
    },
    update: async (t, id, status) => {
      await wait(250);
      const db = load();
      const rider = (db.riders || []).find((r) => r.token === t && r.active !== false);
      if (!rider) throw new MockError("This rider link isn't active. Ask the kitchen for a new one.", 404);
      const o = byId(id);
      if (!['OUT_FOR_DELIVERY', 'COMPLETED'].includes(status)) throw new MockError('Riders can only mark orders as picked up or delivered.');
      if (o.status === 'CANCELLED') throw new MockError('This order was cancelled. Call the kitchen.', 409);
      if (o.paymentStatus !== 'CONFIRMED') throw new MockError("This order isn't paid yet. Call the kitchen before you take it.", 409);
      o.riderId = rider.id;
      if (o.status !== status) move(o, status, null, `Rider: ${rider.name}`);
      save();
      publish(o, 'status');
      return riderStop(o, rider);
    },
  },
};
