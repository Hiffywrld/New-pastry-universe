// Talks to the Spring Boot API.
// VITE_API_URL is the API's address, e.g. https://api.pastryuniverse.ng
// Leave it empty when the site and API share a domain (or in dev, via the Vite proxy).

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'pu-admin-token';
const CUSTOMER_KEY = 'pu-customer-token';

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function adminToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function customerToken() {
  try {
    return localStorage.getItem(CUSTOMER_KEY);
  } catch {
    return null;
  }
}

export function setCustomerToken(token) {
  try {
    if (token) localStorage.setItem(CUSTOMER_KEY, token);
    else localStorage.removeItem(CUSTOMER_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: stay logged in for this tab only */
  }
}

async function request(path, { method = 'GET', body, admin = false, customer = false, form } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = admin ? adminToken() : customer ? customerToken() : null;
  if (t) headers.Authorization = `Bearer ${t}`;
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError("Can't reach the shop right now. Check your connection and try again.", 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && admin) setAdminToken(null);
    if (res.status === 401 && customer) setCustomerToken(null);
    throw new ApiError(data?.error || 'Something went wrong. Please try again.', res.status, data?.fields);
  }
  return data;
}

function stream(path, handlers) {
  const source = new EventSource(BASE + path);
  Object.entries(handlers).forEach(([event, fn]) => {
    if (event === 'open' || event === 'error') return;
    source.addEventListener(event, (e) => {
      try {
        fn(JSON.parse(e.data));
      } catch {
        /* ignore malformed events */
      }
    });
  });
  source.onopen = () => handlers.open?.();
  source.onerror = () => handlers.error?.();
  return () => source.close();
}

export const api = {
  mode: 'live',

  menu: () => request('/api/menu'),
  createOrder: (body) => request('/api/orders', { method: 'POST', body, customer: true }),
  track: (token) => request(`/api/orders/track/${encodeURIComponent(token)}`),
  lookup: (code, phone) => request('/api/orders/lookup', { method: 'POST', body: { code, phone } }),
  uploadReceipt: (token, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/api/orders/track/${encodeURIComponent(token)}/receipt`, { method: 'POST', form });
  },
  trackStream: (token, handlers) => stream(`/api/orders/track/${encodeURIComponent(token)}/stream`, handlers),
  event: (payload) =>
    fetch(BASE + '/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {}),

  account: {
    hasToken: () => Boolean(customerToken()),
    config: () => request('/api/auth/config'),
    signInWithGoogle: async (credential) => {
      const res = await request('/api/auth/google', { method: 'POST', body: { credential } });
      setCustomerToken(res.token);
      return res.me;
    },
    demoSignIn: null,
    signOut: () => setCustomerToken(null),
    me: () => request('/api/me', { customer: true }),
    startGame: () => request('/api/game/start', { method: 'POST', customer: true }),
    finishGame: (result) => request('/api/game/finish', { method: 'POST', customer: true, body: result }),
  },

  admin: {
    hasToken: () => Boolean(adminToken()),
    login: async (email, password) => {
      const res = await request('/api/admin/auth/login', { method: 'POST', body: { email, password } });
      setAdminToken(res.token);
      return res.user;
    },
    logout: () => setAdminToken(null),
    me: () => request('/api/admin/me', { admin: true }),
    dashboard: () => request('/api/admin/dashboard', { admin: true }),
    board: () => request('/api/admin/orders', { admin: true }),
    order: (id) => request(`/api/admin/orders/${id}`, { admin: true }),
    setStatus: (id, status, note) => request(`/api/admin/orders/${id}/status`, { method: 'POST', admin: true, body: { status, note } }),
    confirmPayment: (id) => request(`/api/admin/orders/${id}/payment/confirm`, { method: 'POST', admin: true }),
    rejectPayment: (id, reason) => request(`/api/admin/orders/${id}/payment/reject`, { method: 'POST', admin: true, body: { reason } }),
    receiptUrl: async (id, receiptId) => {
      const res = await fetch(`${BASE}/api/admin/orders/${id}/receipts/${receiptId}`, {
        headers: { Authorization: `Bearer ${adminToken()}` },
      });
      if (!res.ok) throw new ApiError("Couldn't load the receipt.", res.status);
      return URL.createObjectURL(await res.blob());
    },
    settings: () => request('/api/admin/settings', { admin: true }),
    saveSettings: (s) => request('/api/admin/settings', { method: 'PUT', admin: true, body: s }),
    stream: (handlers) => stream(`/api/admin/stream?access_token=${encodeURIComponent(adminToken() || '')}`, handlers),

    // Kitchen tools
    calendar: (from, to) => request(`/api/admin/calendar${query({ from, to })}`, { admin: true }),
    setDay: (date, body) => request(`/api/admin/calendar/days/${date}`, { method: 'PUT', admin: true, body }),
    setLimits: (body) => request('/api/admin/calendar/limits', { method: 'PUT', admin: true, body }),
    day: (date) => request(`/api/admin/day${query({ date })}`, { admin: true }),
    bulkStatus: (ids, status) => request('/api/admin/orders/bulk-status', { method: 'POST', admin: true, body: { ids, status } }),
    riders: () => request('/api/admin/riders', { admin: true }),
    addRider: (body) => request('/api/admin/riders', { method: 'POST', admin: true, body }),
    removeRider: (id) => request(`/api/admin/riders/${id}`, { method: 'DELETE', admin: true }),
    customers: (q, sort) => request(`/api/admin/customers${query({ q, sort })}`, { admin: true }),
    customer: (id) => request(`/api/admin/customers/${id}`, { admin: true }),
    saveCustomer: (id, body) => request(`/api/admin/customers/${id}`, { method: 'PUT', admin: true, body }),
  },

  // The rider's page: no login, the secret link is the key.
  rider: {
    day: (token, date) => request(`/api/rider/${encodeURIComponent(token)}${query({ date })}`),
    update: (token, id, status) => request(`/api/rider/${encodeURIComponent(token)}/orders/${id}`, { method: 'POST', body: { status } }),
  },
};

function query(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v != null && v !== '' && q.set(k, v));
  const s = q.toString();
  return s ? `?${s}` : '';
}
