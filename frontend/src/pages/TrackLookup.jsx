import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';

export default function TrackLookup() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token } = await api.lookup(code, phone);
      navigate(`/order/${token}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wrap narrow page-pad">
      <h1 className="page-title">Track your order</h1>
      <p className="muted lead">Enter the order code from your confirmation (it starts with PU-) and the phone number you used.</p>
      <form className="form-card" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="track-code">Order code</label>
          <input id="track-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PU-7KX4M" autoComplete="off" required />
        </div>
        <div className="field">
          <label htmlFor="track-phone">Phone number</label>
          <input id="track-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" autoComplete="tel" required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !code || !phone}>
          {busy ? 'Finding your order…' : 'Find my order'}
        </button>
      </form>
    </section>
  );
}
