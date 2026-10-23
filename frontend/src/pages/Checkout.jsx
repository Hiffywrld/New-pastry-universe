import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';
import { sessionId, track } from '../lib/analytics.js';
import { useMenu } from '../menu/useMenu.js';
import { lineLabel, useCart } from '../state/cart.jsx';
import { useAccount } from '../state/account.jsx';

const SAVED = 'pu-customer';
const PHONE_RE = /^(\+?234|0)?[789][01]\d{8}$/;

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(SAVED) || '{}');
  } catch {
    return {};
  }
}

function dateLabel(iso, index) {
  const d = new Date(iso + 'T12:00:00');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  return {
    top: isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-NG', { weekday: 'short' }),
    bottom: d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
    key: `${iso}-${index}`,
  };
}

export default function Checkout() {
  const { menu } = useMenu();
  const { lines, subtotal, clear } = useCart();
  const { me, status: accountStatus, usableReward, refresh: refreshAccount } = useAccount();
  const [useReward, setUseReward] = useState(true);
  const navigate = useNavigate();
  const saved = useMemo(loadSaved, []);
  const [form, setForm] = useState({
    name: saved.name || '',
    phone: saved.phone || '',
    email: saved.email || '',
    fulfilment: saved.fulfilment || 'DELIVERY',
    zoneId: saved.zoneId || '',
    address: saved.address || '',
    landmark: saved.landmark || '',
    deliveryDate: '',
    timeSlot: '',
    isGift: false,
    giftName: '',
    giftPhone: '',
    giftNote: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const dates = menu?.store?.availableDates || [];
  const fullDates = menu?.store?.fullDates || [];
  const fullSlots = menu?.store?.fullSlots || {};
  const slots = menu?.store?.timeSlots || [];
  // Fully booked days still show, greyed out, so people can see why they're missing.
  const shownDates = [...new Set([...dates, ...fullDates])].sort();
  const takenSlots = fullSlots[form.deliveryDate] || [];
  const zones = menu?.delivery?.zones || [];

  useEffect(() => {
    if (lines.length) track('checkout_start');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setForm((f) => {
      const deliveryDate = dates.includes(f.deliveryDate) ? f.deliveryDate : dates[0] || '';
      const taken = fullSlots[deliveryDate] || [];
      const open = slots.filter((x) => !taken.includes(x));
      return { ...f, deliveryDate, timeSlot: open.includes(f.timeSlot) ? f.timeSlot : open[0] || '' };
    });
  }, [dates.join(), slots.join(), JSON.stringify(fullSlots), form.deliveryDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  useEffect(() => {
    if (!me?.profile) return;
    setForm((f) => ({ ...f, name: f.name || me.profile.name || '', email: f.email || me.profile.email || '' }));
  }, [me?.profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const zone = zones.find((z) => String(z.id) === String(form.zoneId));
  const fee = form.fulfilment === 'DELIVERY' ? zone?.fee ?? null : 0;
  const discount = usableReward && useReward ? Math.min(usableReward.maxAmount, Math.round((subtotal * usableReward.percent) / 100)) : 0;
  const total = subtotal - discount + (fee || 0);
  const closed = menu?.store?.shopOpen === false;

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Enter your name.';
    if (!PHONE_RE.test(form.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a Nigerian phone number, like 0803 123 4567.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.fulfilment === 'DELIVERY') {
      if (!form.zoneId) e.zoneId = 'Choose your delivery area.';
      if (!form.address.trim()) e.address = 'Enter the delivery address.';
    }
    if (!form.deliveryDate) e.deliveryDate = 'Choose a date.';
    if (!form.timeSlot) e.timeSlot = 'Choose a time.';
    if (form.isGift && !form.giftName.trim()) e.giftName = "Enter the recipient's name.";
    if (form.isGift && form.giftPhone && !PHONE_RE.test(form.giftPhone.replace(/[\s-]/g, ''))) e.giftPhone = 'Enter a Nigerian phone number.';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`co-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const order = await api.createOrder({
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        customer: { name: form.name.trim(), phone: form.phone, email: form.email || undefined },
        fulfilment: form.fulfilment,
        zoneId: form.fulfilment === 'DELIVERY' ? Number(form.zoneId) : undefined,
        address: form.fulfilment === 'DELIVERY' ? form.address : undefined,
        landmark: form.fulfilment === 'DELIVERY' ? form.landmark : undefined,
        deliveryDate: form.deliveryDate,
        timeSlot: form.timeSlot,
        gift: form.isGift ? { recipientName: form.giftName, recipientPhone: form.giftPhone || undefined, note: form.giftNote || undefined } : undefined,
        notes: form.notes || undefined,
        sessionId: sessionId(),
        useReward: Boolean(usableReward && useReward),
      });
      if (accountStatus === 'in') refreshAccount();
      try {
        const { name, phone, email, fulfilment, zoneId, address, landmark } = form;
        localStorage.setItem(SAVED, JSON.stringify({ name, phone, email, fulfilment, zoneId, address, landmark }));
      } catch {
        /* storage unavailable */
      }
      clear();
      navigate(`/order/${order.token}`, { state: { justPlaced: true } });
    } catch (err) {
      setServerError(err.message);
      if (err.fields) setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k.split('.').pop(), v])));
    } finally {
      setBusy(false);
    }
  };

  if (!lines.length) {
    return (
      <section className="wrap narrow page-pad state-box">
        <h1 className="page-title">Your cart is empty</h1>
        <p className="muted">Add a few treats first, then come back here to check out.</p>
        <Link to="/" className="btn btn-primary">
          Back to the shop
        </Link>
      </section>
    );
  }

  const err = (k) => errors[k] && <p className="field-error" id={`co-${k}-err`}>{errors[k]}</p>;

  return (
    <section className="wrap page-pad">
      <h1 className="page-title">Checkout</h1>
      <form className="checkout" onSubmit={submit} noValidate>
        <div className="checkout-main">
          <fieldset className="form-card">
            <legend>Your details</legend>
            <div className="field">
              <label htmlFor="co-name">Full name</label>
              <input id="co-name" value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={Boolean(errors.name)} />
              {err('name')}
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="co-phone">Phone number</label>
                <input id="co-phone" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="0803 123 4567" autoComplete="tel" aria-invalid={Boolean(errors.phone)} />
                {err('phone')}
              </div>
              <div className="field">
                <label htmlFor="co-email">
                  Email <span className="muted">(optional)</span>
                </label>
                <input id="co-email" type="email" value={form.email} onChange={set('email')} autoComplete="email" aria-invalid={Boolean(errors.email)} />
                {err('email')}
              </div>
            </div>
          </fieldset>

          <fieldset className="form-card">
            <legend>Delivery or pickup</legend>
            <div className="toggle-pair" role="radiogroup" aria-label="Delivery or pickup">
              {[
                ['DELIVERY', 'Delivery', 'Across Lagos'],
                ['PICKUP', 'Pickup', 'Free, Ojodu Berger'],
              ].map(([value, title, sub]) => (
                <label key={value} className={`toggle-card${form.fulfilment === value ? ' is-on' : ''}`}>
                  <input type="radio" name="fulfilment" value={value} checked={form.fulfilment === value} onChange={set('fulfilment')} />
                  <span className="toggle-title">{title}</span>
                  <span className="muted small">{sub}</span>
                </label>
              ))}
            </div>

            {form.fulfilment === 'DELIVERY' ? (
              <>
                <div className="field">
                  <label htmlFor="co-zoneId">Delivery area</label>
                  <select id="co-zoneId" value={form.zoneId} onChange={set('zoneId')} aria-invalid={Boolean(errors.zoneId)}>
                    <option value="">Choose your area</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} — {formatNaira(z.fee)}
                      </option>
                    ))}
                  </select>
                  {err('zoneId')}
                </div>
                <div className="field">
                  <label htmlFor="co-address">Address</label>
                  <textarea id="co-address" rows={2} value={form.address} onChange={set('address')} autoComplete="street-address" aria-invalid={Boolean(errors.address)} />
                  {err('address')}
                </div>
                <div className="field">
                  <label htmlFor="co-landmark">
                    Nearest landmark <span className="muted">(optional)</span>
                  </label>
                  <input id="co-landmark" value={form.landmark} onChange={set('landmark')} placeholder="e.g. Opposite the filling station" />
                </div>
              </>
            ) : (
              <p className="pickup-note">
                Pick up at <strong>{menu?.delivery?.pickupAddress}</strong>. {menu?.delivery?.pickupNote}
              </p>
            )}
          </fieldset>

          <fieldset className="form-card">
            <legend>{form.fulfilment === 'DELIVERY' ? 'When should it arrive?' : 'When will you pick up?'}</legend>
            <div className="date-row" role="radiogroup" aria-label="Date" id="co-deliveryDate" tabIndex={-1}>
              {shownDates.map((d, i) => {
                const l = dateLabel(d, i);
                const full = !dates.includes(d);
                return (
                  <label key={l.key} className={`date-chip${form.deliveryDate === d ? ' is-on' : ''}${full ? ' is-full' : ''}`}>
                    <input type="radio" name="date" value={d} checked={form.deliveryDate === d} onChange={set('deliveryDate')} disabled={full} />
                    <span className="small">{l.top}</span>
                    <strong>{l.bottom}</strong>
                    {full && <span className="date-full">Full</span>}
                  </label>
                );
              })}
            </div>
            {err('deliveryDate')}
            <div className="chips slot-row" role="radiogroup" aria-label="Time" id="co-timeSlot" tabIndex={-1}>
              {slots.map((s) => {
                const taken = takenSlots.includes(s);
                return (
                  <button type="button" key={s} aria-pressed={form.timeSlot === s} disabled={taken} onClick={() => set('timeSlot')(s)}>
                    {s}
                    {taken && <span className="chip-price">Full</span>}
                  </button>
                );
              })}
            </div>
            {err('timeSlot')}
          </fieldset>

          <fieldset className="form-card">
            <legend>Extras</legend>
            <label className="check">
              <input type="checkbox" checked={form.isGift} onChange={set('isGift')} />
              <span>This is a gift for someone else</span>
            </label>
            {form.isGift && (
              <div className="gift-box">
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="co-giftName">Their name</label>
                    <input id="co-giftName" value={form.giftName} onChange={set('giftName')} aria-invalid={Boolean(errors.giftName)} />
                    {err('giftName')}
                  </div>
                  <div className="field">
                    <label htmlFor="co-giftPhone">
                      Their phone <span className="muted">(optional)</span>
                    </label>
                    <input id="co-giftPhone" type="tel" inputMode="tel" value={form.giftPhone} onChange={set('giftPhone')} aria-invalid={Boolean(errors.giftPhone)} />
                    {err('giftPhone')}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="co-giftNote">Note to include</label>
                  <textarea id="co-giftNote" rows={2} maxLength={400} value={form.giftNote} onChange={set('giftNote')} placeholder="Happy birthday! Enjoy your treat." />
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor="co-notes">
                Anything else? <span className="muted">(optional)</span>
              </label>
              <textarea id="co-notes" rows={2} maxLength={500} value={form.notes} onChange={set('notes')} placeholder="Allergies, gate code, special requests" />
            </div>
          </fieldset>
        </div>

        <aside className="checkout-side">
          <div className="summary-card">
            <h2>Your order</h2>
            <ul className="summary-lines">
              {lines.map((l) => (
                <li key={l.variantId}>
                  <span>
                    <span className="num">{l.quantity}×</span> {l.name}
                    {lineLabel(l) && <span className="muted small block">{lineLabel(l)}</span>}
                  </span>
                  <span className="num">{formatNaira(l.price * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="summary-totals">
              <div className="row-between">
                <span>Subtotal</span>
                <span className="num">{formatNaira(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="row-between discount-row">
                  <span>Welcome discount ({usableReward.percent}%)</span>
                  <span className="num">−{formatNaira(discount)}</span>
                </div>
              )}
              <div className="row-between">
                <span>{form.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'}</span>
                <span className="num">{form.fulfilment === 'PICKUP' ? 'Free' : fee == null ? 'Choose area' : formatNaira(fee)}</span>
              </div>
              <div className="row-between total">
                <span>Total</span>
                <span className="num">{formatNaira(total)}</span>
              </div>
            </div>
            {usableReward ? (
              <label className="reward-toggle">
                <input type="checkbox" checked={useReward} onChange={(e) => setUseReward(e.target.checked)} />
                <span>
                  Use my {usableReward.percent}% welcome discount
                  <span className="muted small block">Up to {formatNaira(usableReward.maxAmount)} off. One use only.</span>
                </span>
              </label>
            ) : accountStatus !== 'in' ? (
              <p className="muted small">
                <Link to="/account">Sign up</Link> to win up to 40% off your first order.
              </p>
            ) : null}
            {serverError && <p className="form-error" role="alert">{serverError}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || closed}>
              {closed ? 'Shop closed for now' : busy ? 'Placing your order…' : `Place order · ${formatNaira(total)}`}
            </button>
            <p className="muted small center">Next, you'll get our account details to pay by bank transfer.</p>
          </div>
        </aside>
      </form>
    </section>
  );
}
