import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { QR, isDemo, longDate, trackingUrl, variantText } from './kit.jsx';
import logo from '../assets/logo.webp';

function PrintShell({ title, ready, children, extra }) {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = `${title} · Pastry Universe`;
  }, [title]);
  if (!api.admin.hasToken()) return <Navigate to="/login" replace />;
  return (
    <div className="print-page">
      <div className="print-bar no-print">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          ← Back
        </button>
        <strong>{title}</strong>
        {extra}
        {isDemo() ? (
          <span className="muted small">Printing works on the real kitchen site.</span>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" disabled={!ready} onClick={() => window.print()}>
            Print
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** A sheet for the kitchen wall: totals to bake and every order of the day. */
export function PrintDay() {
  const [params] = useSearchParams();
  const date = params.get('date');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.admin.day(date).then(setPlan).catch((e) => setError(e.message));
  }, [date]);

  return (
    <PrintShell title="Bake sheet" ready={Boolean(plan)}>
      {!plan ? (
        <p className="muted pad">{error || 'Loading…'}</p>
      ) : (
        <article className="sheet-a4">
          <header className="sheet-head">
            <img src={logo} alt="" width="44" height="44" />
            <div>
              <h1>Bake sheet</h1>
              <p>{longDate(plan.date)} · {plan.orders.length} orders</p>
            </div>
          </header>
          <h2>To bake</h2>
          {plan.toBake.length === 0 ? (
            <p>Nothing paid yet.</p>
          ) : (
            <table className="sheet-table">
              <thead>
                <tr>
                  <th>Treat</th>
                  <th>Size and topping</th>
                  <th className="r">How many</th>
                  <th className="r">Done</th>
                </tr>
              </thead>
              <tbody>
                {plan.toBake.map((l) => (
                  <tr key={l.slug + l.size + l.option}>
                    <td>{l.product}</td>
                    <td>{variantText(l.size, l.option) || 'Regular'}</td>
                    <td className="r num big">{l.quantity}</td>
                    <td className="r">
                      <span className="tick-box" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {plan.unpaid.length > 0 && (
            <p className="sheet-muted">Not paid yet (don't bake until paid): {plan.unpaid.map((l) => `${l.quantity}× ${l.product} ${variantText(l.size, l.option)}`.trim()).join(', ')}</p>
          )}
          <h2>Orders</h2>
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Order</th>
                <th>For</th>
                <th>Items</th>
                <th>Where</th>
              </tr>
            </thead>
            <tbody>
              {plan.orders.map((o) => (
                <tr key={o.summary.id}>
                  <td>{o.summary.timeSlot}</td>
                  <td>
                    {o.summary.code}
                    {['AWAITING_PAYMENT', 'PAYMENT_REVIEW'].includes(o.summary.status) && <span className="sheet-flag">Unpaid</span>}
                  </td>
                  <td>
                    {o.gift ? o.gift.recipientName : o.summary.customerName}
                    <span className="block small">{o.gift?.recipientPhone || o.summary.customerPhone}</span>
                  </td>
                  <td>{o.summary.itemsText}</td>
                  <td>
                    {o.summary.fulfilment === 'DELIVERY' ? (
                      <>
                        {o.address}
                        <span className="block small">{o.summary.zoneName}</span>
                      </>
                    ) : (
                      'Pickup'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
    </PrintShell>
  );
}

/** Stickers for each box: who it's for, where it's going, what's inside, and a tracking QR. */
export function PrintLabels() {
  const [params] = useSearchParams();
  const date = params.get('date');
  const [plan, setPlan] = useState(null);
  const [unpaid, setUnpaid] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api.admin.day(date).then(setPlan).catch((e) => setError(e.message));
  }, [date]);
  const orders = (plan?.orders || []).filter((o) => unpaid || !['AWAITING_PAYMENT', 'PAYMENT_REVIEW'].includes(o.summary.status));

  return (
    <PrintShell
      title="Labels"
      ready={orders.length > 0}
      extra={
        <label className="switch">
          <input type="checkbox" checked={unpaid} onChange={(e) => setUnpaid(e.target.checked)} />
          <span>Include unpaid</span>
        </label>
      }
    >
      {!plan ? (
        <p className="muted pad">{error || 'Loading…'}</p>
      ) : orders.length === 0 ? (
        <p className="muted pad">No paid orders for {longDate(plan.date)} yet.</p>
      ) : (
        <div className="labels-a4">
          {orders.map((o) => (
            <OrderLabel key={o.summary.id} o={o} />
          ))}
        </div>
      )}
    </PrintShell>
  );
}

function OrderLabel({ o }) {
  const s = o.summary;
  const delivery = s.fulfilment === 'DELIVERY';
  return (
    <section className="label">
      <div className="label-top">
        <img src={logo} alt="" width="28" height="28" />
        <span className="label-brand">Pastry Universe</span>
        <span className="label-code">{s.code}</span>
      </div>
      <div className="label-body">
        <div className="label-main">
          <p className="label-name">{o.gift ? o.gift.recipientName : s.customerName}</p>
          <p className="label-phone">{o.gift?.recipientPhone || s.customerPhone}</p>
          <p className="label-when">
            {longDate(s.deliveryDate)} · {s.timeSlot}
          </p>
          <p className="label-where">{delivery ? `${o.address}${o.landmark ? ` (${o.landmark})` : ''} · ${s.zoneName}` : 'PICKUP'}</p>
        </div>
        <QR value={trackingUrl(o.trackingToken)} size={72} label="Tracking link" />
      </div>
      <ul className="label-items">
        {o.items.map((l, i) => (
          <li key={i}>
            {l.quantity}× {l.name} <span>{variantText(l.size, l.option)}</span>
          </li>
        ))}
      </ul>
      {o.gift?.note && <p className="label-note">“{o.gift.note}”{o.gift && ` From ${s.customerName.split(' ')[0]}`}</p>}
    </section>
  );
}

/** A customer receipt, sized for a small receipt printer but fine on A4 too. */
export function PrintReceipt() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [store, setStore] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api.admin.order(id), api.admin.settings()])
      .then(([o, s]) => {
        setOrder(o);
        setStore(s);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const s = order?.summary;
  const paid = s && s.paymentStatus === 'CONFIRMED';

  return (
    <PrintShell title="Receipt" ready={Boolean(order)}>
      {!order ? (
        <p className="muted pad">{error || 'Loading…'}</p>
      ) : (
        <article className="receipt-80">
          <header>
            <img src={logo} alt="" width="56" height="56" />
            <h1>Pastry Universe</h1>
            <p>Premium quality snacks for premium clients</p>
            {store?.address && <p>{store.address}</p>}
            <p>
              {[store?.phone, store?.instagram && `@${store.instagram}`].filter(Boolean).join(' · ')}
            </p>
          </header>
          <div className="rc-rule" />
          <div className="rc-meta">
            <p>
              <span>Order</span>
              <strong>{s.code}</strong>
            </p>
            <p>
              <span>Placed</span>
              <span>{new Date(s.createdAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </p>
            <p>
              <span>For</span>
              <span>{s.customerName}</span>
            </p>
            <p>
              <span>{s.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'}</span>
              <span>
                {longDate(s.deliveryDate)}, {s.timeSlot}
              </span>
            </p>
            {s.fulfilment === 'DELIVERY' && (
              <p>
                <span>To</span>
                <span>{order.gift ? `${order.gift.recipientName}, ` : ''}{order.address}</span>
              </p>
            )}
          </div>
          <div className="rc-rule" />
          <ul className="rc-items">
            {order.items.map((l, i) => (
              <li key={i}>
                <span>
                  {l.quantity}× {l.name}
                  {variantText(l.size, l.option) && <span className="block">{variantText(l.size, l.option)}</span>}
                </span>
                <span className="num">{formatNaira(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="rc-rule" />
          <div className="rc-totals">
            <p>
              <span>Subtotal</span>
              <span className="num">{formatNaira(order.subtotal)}</span>
            </p>
            {order.discount > 0 && (
              <p>
                <span>Welcome discount</span>
                <span className="num">−{formatNaira(order.discount)}</span>
              </p>
            )}
            <p>
              <span>Delivery</span>
              <span className="num">{order.deliveryFee ? formatNaira(order.deliveryFee) : 'Free'}</span>
            </p>
            <p className="rc-total">
              <span>Total</span>
              <span className="num">{formatNaira(s.total)}</span>
            </p>
            <p className="rc-paid">{paid ? `Paid by transfer${order.paidAt ? ` · ${new Date(order.paidAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}` : ''}` : 'Not paid yet'}</p>
          </div>
          <div className="rc-rule" />
          <footer>
            <QR value={trackingUrl(order.trackingToken)} size={96} label="Track this order" />
            <p>Scan to track your order</p>
            <p className="rc-thanks">Thank you for choosing Pastry Universe!</p>
          </footer>
        </article>
      )}
    </PrintShell>
  );
}
