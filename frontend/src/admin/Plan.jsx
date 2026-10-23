import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { useOrderChanges } from './live.jsx';
import { StatusChip, whatsappLink } from './shared.jsx';
import { addDays, dayParts, isDemo, lagosToday, longDate, riderUrl, variantText } from './kit.jsx';

/**
 * The kitchen's day: how full each day is, what to bake, the day's orders,
 * and rider links. Also where the owner closes days and sets limits.
 */
export default function Plan() {
  const { openOrder, me } = useOutletContext();
  const today = lagosToday();
  const [cal, setCal] = useState(null);
  const [date, setDate] = useState(() => addDays(today, 1));
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');

  const loadCal = useCallback(() => api.admin.calendar(addDays(today, -1), addDays(today, 27)).then(setCal).catch((e) => setError(e.message)), [today]);
  const loadDay = useCallback(() => api.admin.day(date).then(setPlan).catch((e) => setError(e.message)), [date]);

  useEffect(() => {
    loadCal();
  }, [loadCal]);
  useEffect(() => {
    setPlan(null);
    loadDay();
  }, [loadDay]);
  useOrderChanges(() => {
    loadCal();
    loadDay();
  }, 400);

  const refresh = () => {
    loadCal();
    loadDay();
  };

  return (
    <div className="plan">
      <div className="page-head">
        <h1>Plan</h1>
        <div className="btn-row">
          <Link className="btn btn-outline btn-sm" to={`/print/day?date=${date}`} target={isDemo() ? undefined : '_blank'}>
            Print bake sheet
          </Link>
          <Link className="btn btn-outline btn-sm" to={`/print/labels?date=${date}`} target={isDemo() ? undefined : '_blank'}>
            Print labels
          </Link>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      {cal ? <DateStrip days={cal.days} today={cal.today} selected={date} onSelect={setDate} /> : <div className="date-strip is-loading" />}

      {plan ? (
        <>
          <DayCard key={date} cap={plan.capacity} defaultLimit={cal?.dailyLimit} onSaved={refresh} past={date < today} />
          <div className="plan-grid">
            <BakeCard toBake={plan.toBake} unpaid={plan.unpaid} />
            <OrdersCard orders={plan.orders} timeSlots={cal?.timeSlots || []} onOpen={openOrder} onChanged={refresh} />
          </div>
          <div className="plan-grid">
            <RidersCard orders={plan.orders} />
            {me?.role === 'OWNER' && cal && <LimitsCard cal={cal} onSaved={refresh} />}
          </div>
        </>
      ) : (
        <p className="muted">Loading the day…</p>
      )}
    </div>
  );
}

function DateStrip({ days, today, selected, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selected]);
  return (
    <div className="date-strip" ref={ref} role="radiogroup" aria-label="Day">
      {days.map((d) => {
        const p = dayParts(d.date);
        const pct = d.limit ? Math.min(100, Math.round((d.orders / d.limit) * 100)) : null;
        const state = d.closed ? 'closed' : d.full ? 'full' : '';
        return (
          <button
            type="button"
            key={d.date}
            aria-pressed={d.date === selected}
            className={`day-chip${state ? ` is-${state}` : ''}${d.date === today ? ' is-today' : ''}${d.date < today ? ' is-past' : ''}`}
            onClick={() => onSelect(d.date)}
          >
            <span className="day-chip-week">{d.date === today ? 'Today' : p.weekday}</span>
            <strong className="day-chip-num">{p.day}</strong>
            <span className="day-chip-month">{p.month}</span>
            <span className="day-chip-count">
              {d.closed ? 'Closed' : d.limit ? `${d.orders}/${d.limit}` : d.orders ? `${d.orders} order${d.orders === 1 ? '' : 's'}` : '–'}
            </span>
            {pct != null && !d.closed && (
              <span className="day-chip-bar" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DayCard({ cap, defaultLimit, onSaved, past }) {
  const [closed, setClosed] = useState(Boolean(cap.closed && !cap.weekdayClosed));
  const [limit, setLimit] = useState(cap.customLimit ?? '');
  const [note, setNote] = useState(cap.note || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const dirty = closed !== Boolean(cap.closed && !cap.weekdayClosed) || String(limit) !== String(cap.customLimit ?? '') || note !== (cap.note || '');
  const pct = cap.limit ? Math.min(100, Math.round((cap.orders / cap.limit) * 100)) : 0;

  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      await api.admin.setDay(cap.date, { closed, maxOrders: limit === '' ? null : Number(limit), note });
      setMsg('Saved');
      onSaved();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card day-card">
      <div className="day-card-head">
        <div>
          <h2>{longDate(cap.date)}</h2>
          <p className="muted">
            {cap.closed ? (
              cap.weekdayClosed ? 'Closed every week on this day (change it in Settings).' : `Closed${cap.note ? `: ${cap.note}` : ''}`
            ) : (
              <>
                <strong className="num">{cap.orders}</strong>
                {cap.limit ? ` of ${cap.limit} orders` : ` order${cap.orders === 1 ? '' : 's'}, no limit`}
                {cap.full && <span className="day-full-tag">Full</span>}
                {cap.paidOrders > 0 && (
                  <>
                    {' · '}
                    <span className="num">{formatNaira(cap.revenue)}</span> paid
                  </>
                )}
              </>
            )}
          </p>
        </div>
        {cap.limit && !cap.closed && (
          <div className={`day-meter${cap.full ? ' is-full' : ''}`} aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="slot-pills">
        {cap.slots.map((s) => (
          <span key={s.label} className={`slot-pill${s.full ? ' is-full' : ''}`}>
            {s.label} <strong className="num">{s.orders}</strong>
            {s.full && <em>full</em>}
          </span>
        ))}
      </div>

      {!past && !cap.weekdayClosed && (
        <div className="day-controls">
          <label className="switch">
            <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
            <span>Close this day</span>
          </label>
          <label className="field-inline">
            <span>Most orders</span>
            <input type="number" min="0" inputMode="numeric" value={limit} placeholder={defaultLimit ? String(defaultLimit) : 'No limit'} onChange={(e) => setLimit(e.target.value)} disabled={closed} />
          </label>
          <label className="field-inline grow">
            <span>Note</span>
            <input type="text" maxLength={160} value={note} placeholder={closed ? 'Why? e.g. Family wedding' : 'e.g. Big corporate order'} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={save}>
            {busy ? 'Saving…' : 'Save day'}
          </button>
          {msg && <span className={msg === 'Saved' ? 'saved' : 'form-error'}>{msg}</span>}
        </div>
      )}
    </section>
  );
}

function BakeCard({ toBake, unpaid }) {
  const groups = useMemo(() => group(toBake), [toBake]);
  const maybe = unpaid.reduce((t, x) => t + x.quantity, 0);
  const total = toBake.reduce((t, x) => t + x.quantity, 0);
  const done = toBake.reduce((t, x) => t + x.baked, 0);
  return (
    <section className="card bake-card">
      <div className="card-head">
        <h2>
          What to bake <span className="count">{total}</span>
        </h2>
        {total > 0 && (
          <span className="muted small">
            {done} of {total} done
          </span>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="muted">Nothing paid for this day yet.</p>
      ) : (
        <ul className="bake-list">
          {groups.map((g) => (
            <li key={g.product}>
              <div className="bake-product">
                <span>{g.product}</span>
                <strong className="num">{g.quantity}</strong>
              </div>
              <ul>
                {g.lines.map((l) => (
                  <li key={l.size + l.option} className={l.baked >= l.quantity ? 'is-done' : ''}>
                    <span>{variantText(l.size, l.option) || 'Regular'}</span>
                    <span className="num">
                      {l.quantity}
                      {l.baked > 0 && l.baked < l.quantity && <span className="muted small"> ({l.baked} done)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {maybe > 0 && (
        <details className="bake-maybe">
          <summary>
            +{maybe} more if unpaid orders pay
          </summary>
          <ul>
            {unpaid.map((l) => (
              <li key={l.slug + l.size + l.option}>
                <span>
                  {l.product} <span className="muted small">{variantText(l.size, l.option)}</span>
                </span>
                <span className="num">{l.quantity}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function group(lines) {
  const map = new Map();
  lines.forEach((l) => {
    const g = map.get(l.product) || { product: l.product, quantity: 0, lines: [] };
    g.quantity += l.quantity;
    g.lines.push(l);
    map.set(l.product, g);
  });
  return [...map.values()];
}

function OrdersCard({ orders, timeSlots, onOpen, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const toStart = orders.filter((o) => o.summary.status === 'CONFIRMED');
  const inOven = orders.filter((o) => o.summary.status === 'BAKING');
  const slots = [...new Set([...timeSlots, ...orders.map((o) => o.summary.timeSlot)])].filter((s) => orders.some((o) => o.summary.timeSlot === s));

  const bulk = async (list, status, label) => {
    setBusy(label);
    setError('');
    try {
      await api.admin.bulkStatus(list.map((o) => o.summary.id), status);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          Orders <span className="count">{orders.length}</span>
        </h2>
      </div>
      {(toStart.length > 0 || inOven.length > 0) && (
        <div className="btn-row bulk-row">
          {toStart.length > 0 && (
            <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy)} onClick={() => bulk(toStart, 'BAKING', 'bake')}>
              {busy === 'bake' ? 'Moving…' : `Start baking all ${toStart.length}`}
            </button>
          )}
          {inOven.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" disabled={Boolean(busy)} onClick={() => bulk(inOven, 'READY', 'ready')}>
              {busy === 'ready' ? 'Moving…' : `Mark ${inOven.length} ready`}
            </button>
          )}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      {orders.length === 0 ? (
        <p className="muted">No orders for this day yet.</p>
      ) : (
        slots.map((slot) => (
          <div key={slot} className="slot-group">
            <h3>{slot}</h3>
            <ul className="day-orders">
              {orders
                .filter((o) => o.summary.timeSlot === slot)
                .map((o) => (
                  <li key={o.summary.id}>
                    <button type="button" className="day-order" onClick={() => onOpen(o.summary.id)}>
                      <span className="day-order-main">
                        <strong>{o.gift ? o.gift.recipientName : o.summary.customerName}</strong>
                        <span className="muted small">
                          {o.summary.code} · {o.summary.fulfilment === 'DELIVERY' ? o.summary.zoneName : 'Pickup'}
                          {o.gift && ' · Gift'}
                        </span>
                        <span className="day-order-items">{o.summary.itemsText}</span>
                      </span>
                      <StatusChip status={o.summary.status} fulfilment={o.summary.fulfilment} />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function RidersCard({ orders }) {
  const [riders, setRiders] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const deliveries = orders.filter((o) => o.summary.fulfilment === 'DELIVERY' && !['AWAITING_PAYMENT', 'PAYMENT_REVIEW'].includes(o.summary.status));
  const zones = Object.entries(
    deliveries.reduce((acc, o) => ({ ...acc, [o.summary.zoneName]: (acc[o.summary.zoneName] || 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  const load = () => api.admin.riders().then(setRiders).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.admin.addRider({ name, phone });
      setName('');
      setPhone('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async (r) => {
    try {
      await navigator.clipboard.writeText(riderUrl(r.token));
      setCopied(r.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          Deliveries <span className="count">{deliveries.length}</span>
        </h2>
      </div>
      {zones.length > 0 ? (
        <div className="slot-pills">
          {zones.map(([zone, n]) => (
            <span key={zone} className="slot-pill">
              {zone} <strong className="num">{n}</strong>
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">No paid deliveries for this day yet.</p>
      )}

      <h3 className="sub-head">Rider links</h3>
      <p className="muted small">Each rider gets a private link to the day's deliveries, with call and map buttons. They tap Delivered and the customer's page updates.</p>
      {riders?.length > 0 && (
        <ul className="rider-list">
          {riders.map((r) => (
            <li key={r.id}>
              <span>
                <strong>{r.name}</strong>
                {r.phone && <span className="muted small"> · {r.phone}</span>}
                <span className="muted small block">{r.lastSeenAt ? `Last opened ${new Date(r.lastSeenAt).toLocaleString('en-NG', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Not opened yet'}</span>
              </span>
              <span className="btn-row">
                {isDemo() ? (
                  <Link className="btn btn-outline btn-sm" to={`/rider/${r.token}`}>
                    Open rider page
                  </Link>
                ) : (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(r)}>
                    {copied === r.id ? 'Copied' : 'Copy link'}
                  </button>
                )}
                {r.phone && (
                  <a className="btn btn-ghost btn-sm" href={whatsappLink(r.phone, `Hi ${r.name}, here's your Pastry Universe delivery page: ${riderUrl(r.token)}`)} target="_blank" rel="noopener noreferrer">
                    Send on WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  className="text-btn small danger"
                  onClick={async () => {
                    await api.admin.removeRider(r.id);
                    load();
                  }}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="rider-form" onSubmit={add}>
        <input type="text" placeholder="Rider's name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Rider's name" />
        <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Rider's phone" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>
          Add rider
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

function LimitsCard({ cal, onSaved }) {
  const [daily, setDaily] = useState(cal.dailyLimit ?? '');
  const [slot, setSlot] = useState(cal.slotLimit ?? '');
  const [msg, setMsg] = useState('');
  const dirty = String(daily) !== String(cal.dailyLimit ?? '') || String(slot) !== String(cal.slotLimit ?? '');

  const save = async () => {
    setMsg('');
    try {
      await api.admin.setLimits({ dailyLimit: daily === '' ? null : Number(daily), slotLimit: slot === '' ? null : Number(slot) });
      setMsg('Saved');
      onSaved();
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <section className="card">
      <h2>How many orders you can take</h2>
      <p className="muted small">When a day reaches its limit, the shop shows it as full and nobody can pick it. Leave empty for no limit. You can change single days above.</p>
      <div className="limits-grid">
        <label className="field">
          <span>Most orders per day</span>
          <input type="number" min="0" inputMode="numeric" value={daily} placeholder="No limit" onChange={(e) => setDaily(e.target.value)} />
        </label>
        <label className="field">
          <span>Most orders per delivery time</span>
          <input type="number" min="0" inputMode="numeric" value={slot} placeholder="No limit" onChange={(e) => setSlot(e.target.value)} />
        </label>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty} onClick={save}>
          Save limits
        </button>
        {msg && <span className={msg === 'Saved' ? 'saved' : 'form-error'}>{msg}</span>}
      </div>
    </section>
  );
}
