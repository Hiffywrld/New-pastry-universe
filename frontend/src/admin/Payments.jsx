import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { useOrderChanges } from './live.jsx';
import { ago, customerMessage, shortDate, whatsappLink } from './shared.jsx';

export default function Payments() {
  const { openOrder } = useOutletContext();
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.admin.board().then(setOrders).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useOrderChanges(load, 300);

  if (!orders) return <p className="muted">{error || 'Loading payments…'}</p>;
  const review = orders.filter((o) => o.status === 'PAYMENT_REVIEW');
  const waiting = orders.filter((o) => o.status === 'AWAITING_PAYMENT');

  const confirm = async (o) => {
    setBusy(o.id);
    setError('');
    try {
      await api.admin.confirmPayment(o.id);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="payments-page">
      <div className="page-head">
        <h1>Payments</h1>
        <p className="muted">Check each receipt against your bank app, then confirm.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="card">
        <h2>
          Receipts to check <span className="count num">{review.length}</span>
        </h2>
        {review.length ? (
          <ul className="pay-list">
            {review.map((o) => (
              <li key={o.id}>
                <div className="pay-info">
                  <strong>{o.customerName}</strong>
                  <span className="muted small">
                    {o.code} · uploaded {ago(o.updatedAt)}
                  </span>
                  <span className="pay-expect">
                    Look for <strong className="num">{formatNaira(o.total)}</strong> with “{o.code}”
                  </span>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openOrder(o.id)}>
                    View receipt
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy === o.id} onClick={() => confirm(o)}>
                    {busy === o.id ? 'Confirming…' : 'Payment received'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">All caught up. New receipts show up here instantly.</p>
        )}
      </section>

      <section className="card">
        <h2>
          Waiting for transfer <span className="count num">{waiting.length}</span>
        </h2>
        {waiting.length ? (
          <ul className="pay-list">
            {waiting.map((o) => (
              <li key={o.id}>
                <div className="pay-info">
                  <strong>{o.customerName}</strong>
                  <span className="muted small">
                    {o.code} · ordered {ago(o.createdAt)} · for {shortDate(o.deliveryDate).toLowerCase()}
                  </span>
                  <span className="num">{formatNaira(o.total)}</span>
                </div>
                <div className="btn-row">
                  <a className="btn btn-ghost btn-sm" href={whatsappLink(o.customerPhone, customerMessage(o))} target="_blank" rel="noopener noreferrer">
                    Remind on WhatsApp
                  </a>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openOrder(o.id)}>
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No unpaid orders.</p>
        )}
      </section>
    </div>
  );
}
