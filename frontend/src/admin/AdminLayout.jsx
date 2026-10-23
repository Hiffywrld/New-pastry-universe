import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { LiveProvider, useLive } from './live.jsx';
import OrderDrawer from './OrderDrawer.jsx';
import logo from '../assets/logo.webp';
import './admin.css';

const SHOP_URL = import.meta.env.VITE_SHOP_URL || '/';

const icons = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z',
  orders: 'M4 5h16v4H4V5Zm0 6h7v8H4v-8Zm9 0h7v8h-7v-8Z',
  payments: 'M3 6h18v12H3V6Zm0 4h18M7 15h3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
};

function Icon({ name }) {
  const filled = name === 'dashboard' || name === 'orders';
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={icons[name]} fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Toasts({ onOpen }) {
  const { toasts, dismiss } = useLive();
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button
          type="button"
          key={t.id}
          className={`toast toast-${t.kind}`}
          onClick={() => {
            dismiss(t.id);
            onOpen(t.order.id);
          }}
        >
          <strong>{t.kind === 'created' ? 'New order' : 'Receipt uploaded'}</strong>
          <span>
            {t.order.code} · {t.order.customerName} · {formatNaira(t.order.total)}
          </span>
        </button>
      ))}
    </div>
  );
}

function Shell({ me }) {
  const { connected, visitors, sound, setSound } = useLive();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(null);

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-brand">
          <img src={logo} alt="" width="36" height="36" />
          <span>Kitchen</span>
        </div>
        <nav className="admin-nav" aria-label="Admin">
          <NavLink to="/" end>
            <Icon name="dashboard" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/orders">
            <Icon name="orders" />
            <span>Orders</span>
          </NavLink>
          <NavLink to="/payments">
            <Icon name="payments" />
            <span>Payments</span>
          </NavLink>
          <NavLink to="/settings">
            <Icon name="settings" />
            <span>Settings</span>
          </NavLink>
        </nav>
        <div className="admin-me">
          <p>{me?.name}</p>
          <button
            type="button"
            className="text-btn small"
            onClick={() => {
              api.admin.logout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <span className={`live-pill${connected ? ' is-live' : ''}`}>{connected ? 'Live' : 'Reconnecting'}</span>
          <span className="visitors" title="People on the shop right now">
            <i className="pulse" aria-hidden="true" />
            <strong className="num">{visitors ?? '–'}</strong> on the site now
          </span>
          <label className="switch">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
            <span>Order sound</span>
          </label>
          <a className="text-btn small view-shop" href={SHOP_URL} target="_blank" rel="noopener noreferrer">
            View shop
          </a>
        </header>
        {api.mode === 'demo' && <p className="demo-note">Demo mode: sample orders, nothing is saved to a real database. A new test order arrives about every 45 seconds.</p>}
        <main className="admin-content">
          <Outlet context={{ openOrder: setDrawer, me }} />
        </main>
      </div>

      <Toasts onOpen={setDrawer} />
      {drawer && <OrderDrawer id={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

export default function AdminLayout() {
  const [me, setMe] = useState(null);
  const [state, setState] = useState(api.admin.hasToken() ? 'checking' : 'out');

  useEffect(() => {
    if (state !== 'checking') return;
    api.admin
      .me()
      .then((u) => {
        setMe(u);
        setState('in');
      })
      .catch(() => {
        api.admin.logout();
        setState('out');
      });
  }, [state]);

  if (state === 'out') return <Navigate to="/login" replace />;
  if (state === 'checking') return <div className="admin-loading">Opening the kitchen…</div>;
  return (
    <LiveProvider>
      <Shell me={me} />
    </LiveProvider>
  );
}
