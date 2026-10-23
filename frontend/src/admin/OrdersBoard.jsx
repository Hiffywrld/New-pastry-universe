import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { useOrderChanges } from './live.jsx';
import { nextLabel, nextStatus, shortDate } from './shared.jsx';

const COLUMNS = [
  { key: 'AWAITING_PAYMENT', title: 'Not paid yet', hint: 'Waiting for the transfer' },
  { key: 'PAYMENT_REVIEW', title: 'Check payment', hint: 'Receipt uploaded' },
  { key: 'CONFIRMED', title: 'To bake', hint: 'Paid' },
  { key: 'BAKING', title: 'In the oven', hint: '' },
  { key: 'READY', title: 'Ready', hint: 'Packed or waiting for pickup' },
  { key: 'OUT_FOR_DELIVERY', title: 'Out for delivery', hint: 'With the rider' },
  { key: 'COMPLETED', title: 'Done today', hint: '' },
];

export default function OrdersBoard() {
  const { openOrder } = useOutletContext();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('all');
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.admin.board().then(setOrders).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useOrderChanges(load, 300);

  const dates = useMemo(() => [...new Set((orders || []).filter((o) => o.status !== 'COMPLETED').map((o) => o.deliveryDate))].sort(), [orders]);
  const shown = (orders || []).filter((o) => filter === 'all' || o.deliveryDate === filter);

  const move = async (order, status) => {
    if (!order || order.status === status) return;
    if (status === 'AWAITING_PAYMENT' || status === 'PAYMENT_REVIEW') {
      setError('Payment columns update by themselves when a receipt comes in or you confirm it.');
      return;
    }
    setError('');
    setOrders((cur) => cur.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      if (status === 'CONFIRMED' && order.paymentStatus !== 'CONFIRMED') await api.admin.confirmPayment(order.id);
      else await api.admin.setStatus(order.id, status);
    } catch (e) {
      setError(e.message);
    }
    load();
  };

  if (!orders) return <p className="muted">{error || 'Loading orders…'}</p>;

  return (
    <div className="board-page">
      <div className="page-head">
        <h1>Orders</h1>
        <div className="filter-row" role="radiogroup" aria-label="Filter by delivery date">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </button>
          {dates.map((d) => (
            <button type="button" key={d} aria-pressed={filter === d} onClick={() => setFilter(d)}>
              {shortDate(d)}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="board">
        {COLUMNS.map((col) => {
          const cards = shown.filter((o) => o.status === col.key);
          return (
            <section
              key={col.key}
              className={`board-col${over === col.key ? ' is-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                move(orders.find((o) => o.id === dragging), col.key);
                setDragging(null);
              }}
              aria-label={col.title}
            >
              <header className="board-col-head">
                <h2>{col.title}</h2>
                <span className="count num">{cards.length}</span>
              </header>
              {col.hint && <p className="board-hint">{col.hint}</p>}
              <div className="board-cards">
                {cards.map((o) => {
                  const next = nextStatus(o.status, o.fulfilment);
                  return (
                    <article
                      key={o.id}
                      className={`order-card${dragging === o.id ? ' is-dragging' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        setDragging(o.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDragging(null)}
                    >
                      <button type="button" className="order-card-main" onClick={() => openOrder(o.id)}>
                        <span className="row-between">
                          <strong>{o.customerName}</strong>
                          <span className="num">{formatNaira(o.total)}</span>
                        </span>
                        <span className="order-card-items">{o.itemsText}</span>
                        <span className="order-card-meta">
                          <span className="pill-mini">{o.fulfilment === 'DELIVERY' ? o.zoneName?.split(' / ')[0] || 'Delivery' : 'Pickup'}</span>
                          <span className="pill-mini">
                            {shortDate(o.deliveryDate)} · {o.timeSlot}
                          </span>
                          {o.gift && <span className="pill-mini gift">Gift</span>}
                          <span className="muted small">{o.code}</span>
                        </span>
                      </button>
                      {o.status === 'PAYMENT_REVIEW' && (
                        <button type="button" className="card-action" onClick={() => openOrder(o.id)}>
                          Check receipt
                        </button>
                      )}
                      {next && (
                        <button type="button" className="card-action" onClick={() => move(o, next)}>
                          {nextLabel(o.status, o.fulfilment)} →
                        </button>
                      )}
                    </article>
                  );
                })}
                {!cards.length && <p className="board-empty">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
