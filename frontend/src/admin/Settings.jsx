import { useEffect, useState } from 'react';
import { api } from '../api/index.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Settings() {
  const [s, setS] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.admin.settings().then(setS).catch((e) => setError(e.message));
  }, []);

  if (!s) return <p className="muted">{error || 'Loading settings…'}</p>;

  const set = (key) => (e) => {
    setStatus('');
    setS((cur) => ({ ...cur, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  };
  const setLines = (key) => (e) => setS((cur) => ({ ...cur, [key]: e.target.value.split('\n') }));
  const toggleDay = (n) => setS((cur) => {
    const days = new Set(cur.closedWeekdays || []);
    if (days.has(n)) days.delete(n);
    else days.add(n);
    return { ...cur, closedWeekdays: [...days].sort() };
  });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const clean = {
        ...s,
        leadDays: Number(s.leadDays) || 0,
        maxDaysAhead: Number(s.maxDaysAhead) || 21,
        timeSlots: (s.timeSlots || []).map((t) => t.trim()).filter(Boolean),
        ticker: (s.ticker || []).map((t) => t.trim()).filter(Boolean),
      };
      setS(await api.admin.saveSettings(clean));
      setStatus('Saved. The shop shows the changes straight away.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, props = {}) => (
    <div className="field">
      <label htmlFor={`set-${key}`}>{label}</label>
      <input id={`set-${key}`} value={s[key] ?? ''} onChange={set(key)} {...props} />
    </div>
  );

  return (
    <form className="settings" onSubmit={save}>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <section className="card">
        <h2>Taking orders</h2>
        <label className="switch big">
          <input type="checkbox" checked={s.shopOpen !== false} onChange={set('shopOpen')} />
          <span>{s.shopOpen !== false ? 'Shop is open for orders' : 'Shop is closed. Customers can browse but not order.'}</span>
        </label>
        <div className="field-row">
          {field('leadDays', 'Earliest delivery (days from today)', { type: 'number', min: 0, max: 14 })}
          {field('maxDaysAhead', 'Latest delivery (days from today)', { type: 'number', min: 1, max: 90 })}
        </div>
        <fieldset className="field">
          <legend>Closed on</legend>
          <div className="chips">
            {WEEKDAYS.map((d, i) => (
              <button type="button" key={d} aria-pressed={(s.closedWeekdays || []).includes(i + 1)} onClick={() => toggleDay(i + 1)}>
                {d}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="set-slots">Time slots (one per line)</label>
          <textarea id="set-slots" rows={3} value={(s.timeSlots || []).join('\n')} onChange={setLines('timeSlots')} />
        </div>
      </section>

      <section className="card">
        <h2>Bank details</h2>
        <p className="muted small">Customers see these after placing an order.</p>
        <div className="field-row">
          {field('bankName', 'Bank')}
          {field('accountNumber', 'Account number', { inputMode: 'numeric' })}
        </div>
        {field('accountName', 'Account name')}
      </section>

      <section className="card">
        <h2>Contact and pickup</h2>
        <div className="field-row">
          {field('phone', 'Phone')}
          {field('whatsapp', 'WhatsApp number (international, e.g. 2349017202788)', { inputMode: 'numeric' })}
        </div>
        <div className="field-row">
          {field('email', 'Email', { type: 'email' })}
          {field('instagram', 'Instagram handle (without @)')}
        </div>
        {field('address', 'Address')}
        {field('pickupAddress', 'Pickup address')}
        {field('pickupNote', 'Pickup instructions')}
      </section>

      <section className="card">
        <h2>Shop front</h2>
        <div className="field">
          <label htmlFor="set-announcement">Announcement banner (leave empty to hide)</label>
          <input id="set-announcement" value={s.announcement ?? ''} onChange={set('announcement')} placeholder="e.g. Christmas orders close on 20 December" />
        </div>
        <div className="field">
          <label htmlFor="set-ticker">Scrolling band (one line each)</label>
          <textarea id="set-ticker" rows={5} value={(s.ticker || []).join('\n')} onChange={setLines('ticker')} />
        </div>
      </section>

      <div className="save-bar">
        {error && <p className="form-error">{error}</p>}
        {status && <p className="saved">{status}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
