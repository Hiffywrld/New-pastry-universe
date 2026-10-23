// A pretend backend that runs in the browser, used only for the clickable
// preview (VITE_MOCK=1). It mirrors the Spring Boot API closely enough to
// click through the shop and the admin with sample orders.

import demoMenu from './demo-menu.json';

const KEY = 'pu-demo-v3';
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

function seed() {
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
  };
  const db = { settings, orders: [], events: [], nextId: 1, account: null, reward: null, played: false, signupsToday: 3, gamesToday: 5 };
  const now = Date.now();
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
      customer: { name: pick(NAMES), phone: '080' + String(10000000 + rand(89999999)) },
      fulfilment: delivery ? 'DELIVERY' : 'PICKUP',
      zoneId: zone.id,
      address: '14 Sample Close, Lagos',
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
        deliveryDate: availableDates(db.settings)[0], timeSlot: db.settings.timeSlots[0],
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
    return { ...demoMenu, store: { ...demoMenu.store, ticker: s.ticker, announcement: s.announcement, shopOpen: s.shopOpen, timeSlots: s.timeSlots, availableDates: availableDates(s) } };
  },
  createOrder: async (req) => {
    await wait(500);
    const db = load();
    if (!db.settings.shopOpen) throw new MockError("The shop isn't taking orders right now. Please check back soon.", 409);
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
};
