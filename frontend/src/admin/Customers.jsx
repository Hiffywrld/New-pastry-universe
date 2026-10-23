import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { StatusChip, ago, shortDate, whatsappLink } from './shared.jsx';

const SORTS = [
  ['recent', 'Recent'],
  ['spent', 'Top spenders'],
  ['orders', 'Most orders'],
  ['name', 'A to Z'],
];

/** Everyone who has ordered (or signed up), with what they spend and love. */
export default function Customers() {
  const { openOrder } = useOutletContext();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [tag, setTag] = useState('');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.admin.customers(q, sort).then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const tags = useMemo(() => [...new Set((rows || []).flatMap((r) => r.tags))].sort(), [rows]);
  const shown = (rows || []).filter((r) => !tag || r.tags.includes(tag));
  const buyers = shown.filter((r) => r.orders > 0);
  const totalSpent = buyers.reduce((t, r) => t + r.spent, 0);
  const repeat = buyers.filter((r) => r.orders > 1).length;

  const exportCsv = () => {
    const head = ['Name', 'Phone', 'Email', 'Orders', 'Spent', 'Last order', 'Favourite', 'Tags'];
    const lines = shown.map((r) => [r.name, r.phone, r.email || '', r.orders, r.spent, r.lastOrder ? r.lastOrder.slice(0, 10) : '', r.favourite || '', r.tags.join('; ')]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pastry-universe-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="customers">
      <div className="page-head">
        <h1>Customers</h1>
        <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} disabled={!shown.length}>
          Download list (CSV)
        </button>
      </div>

      {rows && (
        <div className="cust-stats">
          <div>
            <span className="kpi-label">Customers</span>
            <strong className="num">{buyers.length}</strong>
          </div>
          <div>
            <span className="kpi-label">Came back for more</span>
            <strong className="num">{buyers.length ? Math.round((repeat / buyers.length) * 100) : 0}%</strong>
          </div>
          <div>
            <span className="kpi-label">Average spend</span>
            <strong className="num">{formatNaira(buyers.length ? Math.round(totalSpent / buyers.length) : 0)}</strong>
          </div>
        </div>
      )}

      <div className="cust-tools">
        <input type="search" className="cust-search" placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
        <div className="filter-row" role="radiogroup" aria-label="Sort">
          {SORTS.map(([k, label]) => (
            <button type="button" key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="filter-row tag-filter" role="radiogroup" aria-label="Tag">
          <button type="button" aria-pressed={!tag} onClick={() => setTag('')}>
            All tags
          </button>
          {tags.map((t) => (
            <button type="button" key={t} aria-pressed={tag === t} onClick={() => setTag(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {!rows ? (
        <p className="muted">Loading customers…</p>
      ) : shown.length === 0 ? (
        <p className="muted">{q ? `Nobody matches “${q}”.` : 'No customers yet. They show up here after their first order.'}</p>
      ) : (
        <ul className="cust-list">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className="cust-row" onClick={() => setOpen(r.id)}>
                <span className="avatar avatar-sm" aria-hidden="true">
                  {r.avatarUrl ? <img src={r.avatarUrl} alt="" referrerPolicy="no-referrer" /> : r.name?.[0]}
                </span>
                <span className="cust-main">
                  <strong>{r.name}</strong>
                  <span className="muted small">
                    {r.phone || r.email}
                    {r.signedIn && ' · Google account'}
                  </span>
                  {(r.tags.length > 0 || r.hasNotes) && (
                    <span className="cust-tags">
                      {r.tags.map((t) => (
                        <span key={t} className="tag-chip">
                          {t}
                        </span>
                      ))}
                      {r.hasNotes && <span className="tag-chip is-note">Note</span>}
                    </span>
                  )}
                </span>
                <span className="cust-fav muted small">{r.favourite || (r.noOrdersYet ? 'Signed up, no order yet' : '')}</span>
                <span className="cust-num">
                  <strong className="num">{formatNaira(r.spent)}</strong>
                  <span className="muted small">
                    {r.orders} order{r.orders === 1 ? '' : 's'}
                    {r.lastOrder && ` · ${ago(r.lastOrder)}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <CustomerDrawer
          id={open}
          onClose={() => setOpen(null)}
          onSaved={load}
          onOpenOrder={(id) => {
            setOpen(null);
            openOrder(id);
          }}
        />
      )}
    </div>
  );
}

function CustomerDrawer({ id, onClose, onSaved, onOpenOrder }) {
  const [c, setC] = useState(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.admin
      .customer(id)
      .then((d) => {
        setC(d);
        setNotes(d.notes || '');
        setTags(d.row.tags);
      })
      .catch((e) => setError(e.message));
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTag = () => {
    const t = draft.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags([...tags, t]);
    setDraft('');
  };

  const save = async () => {
    setMsg('');
    try {
      const d = await api.admin.saveCustomer(id, { notes, tags });
      setC(d);
      setTags(d.row.tags);
      setMsg('Saved');
      onSaved();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const r = c?.row;
  const dirty = c && (notes !== (c.notes || '') || tags.join('|') !== r.tags.join('|'));

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Customer">
      <button type="button" className="drawer-scrim" aria-label="Close" onClick={onClose} />
      <div className="drawer drawer-wide">
        <div className="drawer-head">
          <div>
            <h2>{r ? r.name : 'Customer'}</h2>
            {r && <span className="muted small">{r.phone || r.email}</span>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {!c ? (
          <p className="muted pad">{error || 'Loading…'}</p>
        ) : (
          <div className="drawer-body">
            <section className="od-section">
              <div className="cust-figures">
                <div>
                  <span className="kpi-label">Spent</span>
                  <strong className="num">{formatNaira(r.spent)}</strong>
                </div>
                <div>
                  <span className="kpi-label">Orders</span>
                  <strong className="num">{r.orders}</strong>
                </div>
                <div>
                  <span className="kpi-label">Average</span>
                  <strong className="num">{formatNaira(c.averageOrder)}</strong>
                </div>
              </div>
              <p className="muted small">
                {r.firstOrder ? `First order ${shortDate(r.firstOrder.slice(0, 10))}` : 'No orders yet'}
                {r.lastOrder && ` · last ${ago(r.lastOrder)}`}
                {r.signedIn && ' · Has a Google account'}
              </p>
              <div className="btn-row">
                {r.phone && (
                  <>
                    <a className="btn btn-outline btn-sm" href={whatsappLink(r.phone, `Hi ${r.name.split(' ')[0]}, `)} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                    <a className="btn btn-ghost btn-sm" href={`tel:${r.phone.replace(/\s/g, '')}`}>
                      Call
                    </a>
                  </>
                )}
                {r.email && (
                  <a className="btn btn-ghost btn-sm" href={`mailto:${r.email}`}>
                    Email
                  </a>
                )}
              </div>
            </section>

            {c.favourites.length > 0 && (
              <section className="od-section">
                <h3>Favourites</h3>
                <ul className="fav-list">
                  {c.favourites.map((f) => (
                    <li key={f.product}>
                      <span>{f.product}</span>
                      <span className="num">{f.quantity}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="od-section">
              <h3>Notes and tags</h3>
              <div className="cust-tags edit">
                {tags.map((t) => (
                  <span key={t} className="tag-chip">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={draft}
                  maxLength={24}
                  placeholder="Add a tag, e.g. Corporate"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  onBlur={addTag}
                  aria-label="Add a tag"
                />
              </div>
              <div className="field">
                <label htmlFor="cust-notes">Notes for the team</label>
                <textarea id="cust-notes" rows={3} value={notes} maxLength={2000} placeholder="e.g. Allergic to nuts. Prefers morning delivery." onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-primary btn-sm" disabled={!dirty} onClick={save}>
                  Save
                </button>
                {msg && <span className={msg === 'Saved' ? 'saved' : 'form-error'}>{msg}</span>}
              </div>
            </section>

            {c.orders.length > 0 && (
              <section className="od-section">
                <h3>Orders</h3>
                <ul className="cust-orders">
                  {c.orders.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => onOpenOrder(o.id)}>
                        <span>
                          <strong>{o.code}</strong> <span className="muted small">· {shortDate(o.deliveryDate)}</span>
                          <span className="muted small block">{o.itemsText}</span>
                        </span>
                        <span className="cust-order-side">
                          <span className="num">{formatNaira(o.total)}</span>
                          <StatusChip status={o.status} fulfilment={o.fulfilment} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
