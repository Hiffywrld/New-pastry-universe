import { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { useOrderChanges } from './live.jsx';
import { StatusChip, customerMessage, nextLabel, nextStatus, shortDate, whatsappLink } from './shared.jsx';

function Receipt({ orderId, receipt }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let revoke = null;
    api.admin
      .receiptUrl(orderId, receipt.id)
      .then((u) => {
        setUrl(u);
        if (u.startsWith('blob:')) revoke = u;
      })
      .catch((e) => setError(e.message));
    return () => revoke && URL.revokeObjectURL(revoke);
  }, [orderId, receipt.id]);
  if (error) return <p className="form-error">{error}</p>;
  if (!url) return <div className="receipt-img is-loading" />;
  if (receipt.contentType === 'application/pdf') {
    return (
      <a className="btn btn-outline" href={url} target="_blank" rel="noopener noreferrer">
        Open PDF receipt
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="receipt-link">
      <img className="receipt-img" src={url} alt="Payment receipt" />
    </a>
  );
}

const time = (iso) => new Date(iso).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function OrderDrawer({ id, onClose }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () =>
    api.admin
      .order(id)
      .then(setOrder)
      .catch((e) => setError(e.message));

  useEffect(() => {
    setOrder(null);
    load();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useOrderChanges((e) => {
    if (e.order.id === id) load();
  }, 200);

  const act = async (label, fn) => {
    setBusy(label);
    setError('');
    try {
      setOrder(await fn());
      setRejecting(false);
      setConfirmCancel(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const s = order?.summary;
  const next = s && nextStatus(s.status, s.fulfilment);
  const awaiting = s && (s.status === 'PAYMENT_REVIEW' || s.status === 'AWAITING_PAYMENT');
  const trackUrl = order ? `${window.location.origin}/order/${order.trackingToken}` : '';

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Order details">
      <button type="button" className="drawer-scrim" aria-label="Close" onClick={onClose} />
      <div className="drawer drawer-wide">
        <div className="drawer-head">
          <div>
            <h2>{s ? s.code : 'Order'}</h2>
            {s && <StatusChip status={s.status} fulfilment={s.fulfilment} />}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!order ? (
          <p className="muted pad">{error || 'Loading…'}</p>
        ) : (
          <div className="drawer-body">
            {error && <p className="form-error" role="alert">{error}</p>}

            <section className="od-section od-actions">
              {awaiting && (
                <>
                  <p className="od-expect">
                    Expect <strong className="num">{formatNaira(s.total)}</strong> with description <strong>{s.code}</strong>
                  </p>
                  {order.receipts.length > 0 ? (
                    <div className="receipts">
                      {order.receipts.map((r) => (
                        <Receipt key={r.id} orderId={s.id} receipt={r} />
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No receipt uploaded yet.</p>
                  )}
                  {rejecting ? (
                    <div className="reject-box">
                      <label htmlFor="reject-reason">What should the customer know?</label>
                      <textarea id="reject-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="We received ₦10,000 but the total is ₦14,700. Please send the balance." />
                      <div className="btn-row">
                        <button type="button" className="btn btn-danger" disabled={busy} onClick={() => act('reject', () => api.admin.rejectPayment(s.id, reason))}>
                          {busy === 'reject' ? 'Sending…' : 'Send back to customer'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setRejecting(false)}>
                          Keep reviewing
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="btn-row">
                      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act('confirm', () => api.admin.confirmPayment(s.id))}>
                        {busy === 'confirm' ? 'Confirming…' : 'Payment received'}
                      </button>
                      {order.receipts.length > 0 && (
                        <button type="button" className="btn btn-ghost" onClick={() => setRejecting(true)}>
                          Payment not found
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              {next && (
                <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => act('next', () => api.admin.setStatus(s.id, next))}>
                  {busy === 'next' ? 'Updating…' : nextLabel(s.status, s.fulfilment)}
                </button>
              )}
              <a className="btn btn-outline btn-block" href={whatsappLink(s.customerPhone, customerMessage(s) || '')} target="_blank" rel="noopener noreferrer">
                Message {s.customerName.split(' ')[0]} on WhatsApp
              </a>
            </section>

            <section className="od-section">
              <h3>Customer</h3>
              <p>
                <strong>{s.customerName}</strong>
              </p>
              <p>
                <a href={`tel:${s.customerPhone.replace(/\s/g, '')}`}>{s.customerPhone}</a>
                {order.customerEmail && <span className="muted"> · {order.customerEmail}</span>}
              </p>
            </section>

            <section className="od-section">
              <h3>{s.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'}</h3>
              <p>
                <strong>{shortDate(s.deliveryDate)}</strong>, {s.timeSlot}
              </p>
              {s.fulfilment === 'DELIVERY' && (
                <p>
                  {order.address}
                  {order.landmark && <span className="muted"> ({order.landmark})</span>}
                  <span className="muted block small">{s.zoneName}</span>
                </p>
              )}
              {order.gift && (
                <div className="od-gift">
                  <p>
                    Gift for <strong>{order.gift.recipientName}</strong>
                    {order.gift.recipientPhone && <span> · {order.gift.recipientPhone}</span>}
                  </p>
                  {order.gift.note && <p className="muted">“{order.gift.note}”</p>}
                </div>
              )}
              {order.notes && <p className="od-notes">Note: {order.notes}</p>}
            </section>

            <section className="od-section">
              <h3>Items</h3>
              <ul className="summary-lines">
                {order.items.map((l, i) => (
                  <li key={i}>
                    <span>
                      <span className="num">{l.quantity}×</span> {l.name}
                      <span className="muted small block">{[l.size !== 'Regular' && l.size, l.option].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="num">{formatNaira(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="summary-totals">
                <div className="row-between">
                  <span>Delivery</span>
                  <span className="num">{order.deliveryFee ? formatNaira(order.deliveryFee) : 'Free'}</span>
                </div>
                <div className="row-between total">
                  <span>Total</span>
                  <span className="num">{formatNaira(s.total)}</span>
                </div>
              </div>
            </section>

            <section className="od-section">
              <h3>History</h3>
              <ol className="od-history">
                {order.events.map((e, i) => (
                  <li key={i}>
                    <span>{e.label}</span>
                    <span className="muted small">
                      {time(e.at)} · {e.actor}
                    </span>
                    {e.note && <span className="small block">{e.note}</span>}
                  </li>
                ))}
              </ol>
            </section>

            <section className="od-section od-footer">
              <button
                type="button"
                className="text-btn small"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(trackUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* clipboard unavailable */
                  }
                }}
              >
                {copied ? 'Link copied' : 'Copy customer tracking link'}
              </button>
              {s.status !== 'CANCELLED' && s.status !== 'COMPLETED' && (
                confirmCancel ? (
                  <span className="btn-row">
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => act('cancel', () => api.admin.setStatus(s.id, 'CANCELLED'))}>
                      Yes, cancel order
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" className="text-btn small danger" onClick={() => setConfirmCancel(true)}>
                    Cancel order
                  </button>
                )
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
