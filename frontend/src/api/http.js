// Talks to the Spring Boot API.
// VITE_API_URL is the API's address, e.g. https://api.pastryuniverse.ng
// Leave it empty when the site and API share a domain (or in dev, via the Vite proxy).

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'pu-admin-token';

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

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: stay logged in for this tab only */
  }
}

async function request(path, { method = 'GET', body, admin = false, form } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) {
    const t = adminToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
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
  createOrder: (body) => request('/api/orders', { method: 'POST', body }),
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
  },
};
