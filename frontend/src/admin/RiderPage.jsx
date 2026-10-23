import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { addDays, isDemo, longDate } from './kit.jsx';
import logo from '../assets/logo.webp';

const telHref = (p) => `tel:${(p || '').replace(/[^0-9+]/g, '')}`;
const waHref = (p, text) => `https://wa.me/${(p || '').replace(/\D/g, '').replace(/^0/, '234')}?text=${encodeURIComponent(text)}`;
const mapHref = (stop) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([stop.address, stop.zone, 'Lagos'].filter(Boolean).join(', '))}`;

/**
 * A rider's page, opened from the private link the kitchen sends them.
 * Today's paid deliveries in time order, with call, WhatsApp and map
 * buttons, and big Picked up / Delivered buttons.
 */
export default function RiderPage() {
  const { token } = useParams();
  const [date, setDate] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [show, setShow] = useState('todo');

  const load = useCallback(
    () =>
      api.rider
        .day(token, date)
        .then((d) => {
          setData(d);
          setError('');
        })
        .catch((e) => setError(e.message)),
    [token, date],
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    document.title = 'Deliveries · Pastry Universe';
  }, []);

  const mark = async (stop, status) => {
    setBusy(stop.id);
    try {
      const next = await api.rider.update(token, stop.id, status);
      setData((d) => ({ ...d, stops: d.stops.map((s) => (s.id === stop.id ? next : s)) }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <div className="rider rider-empty">
        <img src={logo} alt="" width="64" height="64" />
        <p>{error || 'Loading your deliveries…'}</p>
      </div>
    );
  }

  const done = data.stops.filter((s) => s.status === 'COMPLETED');
  const todo = data.stops.filter((s) => s.status !== 'COMPLETED');
  const list = show === 'todo' ? todo : done;
  const isToday = data.date === data.today;
  const isTomorrow = data.date === addDays(data.today, 1);

  return (
    <div className="rider">
      {isDemo() && (
        <p className="rider-demo">
          This is what your rider sees on their phone. <Link to="/plan">Back to the kitchen</Link>
        </p>
      )}
      <header className="rider-head">
        <img src={logo} alt="" width="40" height="40" />
        <div>
          <p className="rider-hi">
            Hi {data.rider} · {longDate(data.date)}
          </p>
          <h1>{isToday ? "Today's deliveries" : isTomorrow ? "Tomorrow's deliveries" : 'Deliveries'}</h1>
        </div>
        {data.kitchenPhone && (
          <a className="rider-kitchen" href={telHref(data.kitchenPhone)}>
            Call kitchen
          </a>
        )}
      </header>

      <div className="rider-days" role="radiogroup" aria-label="Day">
        {[0, 1].map((n) => {
          const d = addDays(data.today, n);
          return (
            <button type="button" key={d} aria-pressed={data.date === d} onClick={() => setDate(d)}>
              {n === 0 ? 'Today' : 'Tomorrow'}
            </button>
          );
        })}
      </div>

      <div className="rider-progress">
        <strong className="num">{done.length}</strong> of <strong className="num">{data.stops.length}</strong> delivered
        <span className="rider-bar" aria-hidden="true">
          <i style={{ width: `${data.stops.length ? (done.length / data.stops.length) * 100 : 0}%` }} />
        </span>
      </div>

      <div className="rider-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={show === 'todo'} onClick={() => setShow('todo')}>
          To deliver <span className="count">{todo.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={show === 'done'} onClick={() => setShow('done')}>
          Delivered <span className="count">{done.length}</span>
        </button>
      </div>

      {error && <p className="form-error rider-error">{error}</p>}

      {list.length === 0 ? (
        <p className="rider-none">{show === 'todo' ? (data.stops.length ? 'All delivered. Well done!' : 'No deliveries for this day yet.') : 'Nothing delivered yet.'}</p>
      ) : (
        <ol className="rider-stops">
          {list.map((s) => (
            <li key={s.id} className={`stop${s.status === 'OUT_FOR_DELIVERY' ? ' is-out' : ''}${s.status === 'COMPLETED' ? ' is-done' : ''}`}>
              <div className="stop-top">
                <span className="stop-slot">{s.timeSlot}</span>
                <span className="stop-code">{s.code}</span>
              </div>
              <h2>{s.name}</h2>
              {s.gift && (
                <p className="stop-gift">
                  Gift from {s.from}
                  {s.giftNote && <span className="block">“{s.giftNote}”</span>}
                </p>
              )}
              <p className="stop-address">
                {s.address}
                {s.landmark && <span className="block muted">{s.landmark}</span>}
                <span className="block muted small">{s.zone}</span>
              </p>
              <ul className="stop-items">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              {s.notes && <p className="stop-note">Note: {s.notes}</p>}
              <div className="stop-links">
                <a href={telHref(s.phone)}>Call</a>
                <a href={waHref(s.phone, `Hi ${s.name.split(' ')[0]}, this is the Pastry Universe rider with your order ${s.code}.`)} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
                <a href={mapHref(s)} target="_blank" rel="noopener noreferrer">
                  Map
                </a>
              </div>
              {s.status === 'COMPLETED' ? (
                <button type="button" className="stop-action is-undo" disabled={busy === s.id} onClick={() => mark(s, 'OUT_FOR_DELIVERY')}>
                  Delivered ✓ · tap to undo
                </button>
              ) : s.status === 'OUT_FOR_DELIVERY' ? (
                <button type="button" className="stop-action is-deliver" disabled={busy === s.id} onClick={() => mark(s, 'COMPLETED')}>
                  {busy === s.id ? 'Saving…' : 'Delivered'}
                </button>
              ) : (
                <button type="button" className="stop-action" disabled={busy === s.id} onClick={() => mark(s, 'OUT_FOR_DELIVERY')}>
                  {busy === s.id ? 'Saving…' : 'Picked up'}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
