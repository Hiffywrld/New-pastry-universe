import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { useLive, useOrderChanges } from './live.jsx';
import { StatusChip, ago, compactNaira, shortDate } from './shared.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function useWidth(ref) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function niceMax(v) {
  if (v <= 0) return 10000;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// Daily revenue for the last 14 days. One series, so no legend; the title names it.
function RevenueChart({ points }) {
  const box = useRef(null);
  const width = useWidth(box);
  const [hover, setHover] = useState(null);
  const height = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 48 };
  const max = niceMax(Math.max(...points.map((p) => p.revenue), 0));
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const band = innerW / points.length;
  const barW = Math.min(24, band * 0.62);
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const total = points.reduce((s, p) => s + p.revenue, 0);

  return (
    <div className="chart" ref={box}>
      <p className="chart-sub">
        <strong className="num">{formatNaira(total)}</strong> in the last 14 days
      </p>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Daily revenue, last 14 days">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={pad.left - 8} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
                {compactNaira(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = pad.left + band * i + band / 2;
            const h = Math.max(0, y(0) - y(p.revenue));
            const r = Math.min(4, h, barW / 2);
            const x0 = cx - barW / 2;
            const top = y(p.revenue);
            const d = h > 0
              ? `M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z`
              : '';
            const isToday = i === points.length - 1;
            const day = new Date(p.day + 'T12:00:00');
            return (
              <g
                key={p.day}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${day.toDateString()}: ${formatNaira(p.revenue)} from ${p.orders} orders`}
              >
                <rect x={cx - band / 2} y={pad.top} width={band} height={innerH} fill="transparent" />
                {d && <path d={d} className={`bar${hover === i ? ' is-hover' : ''}`} />}
                {(i % 2 === 1 || isToday) && (
                  <text x={cx} y={height - 8} className="axis" textAnchor="middle">
                    {isToday ? 'Today' : day.getDate()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && width > 0 && (
        <div
          className="tip"
          style={{
            left: Math.min(width - 150, Math.max(0, pad.left + band * hover + band / 2 - 75)),
            top: Math.max(0, y(points[hover].revenue) - 64),
          }}
        >
          <strong>{new Date(points[hover].day + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
          <span className="num">{formatNaira(points[hover].revenue)}</span>
          <span className="muted small">
            {points[hover].orders} {points[hover].orders === 1 ? 'order' : 'orders'}
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>Daily revenue, last 14 days</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Revenue</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>{p.day}</td>
              <td>{p.revenue}</td>
              <td>{p.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarList({ rows, value, label, format, empty }) {
  if (!rows.length) return <p className="muted small">{empty}</p>;
  const max = Math.max(...rows.map(value), 1);
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={label(r)}>
          <span className="barlist-label">{label(r)}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${(value(r) / max) * 100}%` }} />
          </span>
          <span className="barlist-value num">{format(r)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { openOrder, me } = useOutletContext();
  const { visitors } = useLive();
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [fresh, setFresh] = useState(new Set());
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api.admin.dashboard(), api.admin.board()])
      .then(([d, board]) => {
        setData(d);
        setRecent([...board].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8));
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useOrderChanges((e) => {
    if (e.kind === 'created') {
      setFresh((f) => new Set(f).add(e.order.id));
      setTimeout(() => setFresh((f) => { const n = new Set(f); n.delete(e.order.id); return n; }), 4000);
    }
    load();
  });

  if (error && !data) return <p className="form-error">{error}</p>;
  if (!data) return <p className="muted">Loading the numbers…</p>;

  const k = data.kpis;
  const delta = k.salesYesterday ? Math.round(((k.salesToday - k.salesYesterday) / k.salesYesterday) * 100) : null;
  const visitorsShown = visitors ?? k.visitorsNow;
  const funnelTop = data.funnel[0]?.count || 0;

  return (
    <div className="dash">
      <div className="dash-head">
        <h1>
          {greeting()}, {me?.name?.split(' ')[0] || 'chef'}
        </h1>
        <p className="muted">{new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="kpis">
        <div className="kpi kpi-hero">
          <p className="kpi-label">Sales today</p>
          <p className="kpi-value num">{formatNaira(k.salesToday)}</p>
          <p className="kpi-delta">
            {k.paidOrdersToday} paid {k.paidOrdersToday === 1 ? 'order' : 'orders'}
            {delta != null && (
              <span className={delta >= 0 ? 'up' : 'down'}>
                {' '}
                · {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs yesterday
              </span>
            )}
          </p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Orders today</p>
          <p className="kpi-value num">{k.ordersToday}</p>
        </div>
        <Link to="/payments" className={`kpi kpi-link${k.awaitingReview ? ' needs-you' : ''}`}>
          <p className="kpi-label">Payments to check</p>
          <p className="kpi-value num">{k.awaitingReview}</p>
          <p className="kpi-delta">{k.awaitingPayment} waiting for transfer</p>
        </Link>
        <Link to="/orders" className="kpi kpi-link">
          <p className="kpi-label">Due tomorrow</p>
          <p className="kpi-value num">{k.dueTomorrow}</p>
          <p className="kpi-delta">orders to bake</p>
        </Link>
        <div className="kpi">
          <p className="kpi-label">
            <i className="pulse" aria-hidden="true" /> On the site now
          </p>
          <p className="kpi-value num">{visitorsShown}</p>
          <p className="kpi-delta">
            {k.signupsToday ?? 0} sign-ups · {k.gamesToday ?? 0} games today
          </p>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <h2>Daily revenue</h2>
          <RevenueChart points={data.revenue} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Latest orders</h2>
            <Link to="/orders" className="text-btn small">
              All orders
            </Link>
          </div>
          {recent.length ? (
            <ul className="feed">
              {recent.map((o) => (
                <li key={o.id} className={fresh.has(o.id) ? 'is-fresh' : ''}>
                  <button type="button" onClick={() => openOrder(o.id)}>
                    <span className="feed-main">
                      <strong>{o.customerName}</strong>
                      <span className="muted small">
                        {o.code} · {ago(o.createdAt)} · for {shortDate(o.deliveryDate).toLowerCase()}
                      </span>
                    </span>
                    <span className="feed-side">
                      <span className="num">{formatNaira(o.total)}</span>
                      <StatusChip status={o.status} fulfilment={o.fulfilment} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No open orders right now. New ones appear here the moment they're placed.</p>
          )}
        </section>

        <section className="card">
          <h2>Best sellers</h2>
          <p className="chart-sub muted small">Pieces sold, last 30 days</p>
          <BarList rows={data.bestSellers} value={(r) => r.quantity} label={(r) => r.name} format={(r) => r.quantity} empty="Sales will show up here." />
        </section>

        <section className="card">
          <h2>Top delivery areas</h2>
          <p className="chart-sub muted small">Paid orders, last 30 days</p>
          <BarList rows={data.topAreas} value={(r) => r.orders} label={(r) => r.name} format={(r) => r.orders} empty="Areas will show up here." />
        </section>

        <section className="card card-wide">
          <h2>Today's shoppers</h2>
          <p className="chart-sub muted small">How many visitors made it to each step today</p>
          <ul className="funnel">
            {data.funnel.map((f) => (
              <li key={f.key}>
                <span className="barlist-label">{f.label}</span>
                <span className="barlist-track">
                  <span className="barlist-bar" style={{ width: `${funnelTop ? Math.min(100, (f.count / funnelTop) * 100) : 0}%` }} />
                </span>
                <span className="barlist-value num">
                  {f.count}
                  {funnelTop > 0 && f.key !== 'visited' && <span className="muted small"> · {Math.min(100, Math.round((f.count / funnelTop) * 100))}%</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
