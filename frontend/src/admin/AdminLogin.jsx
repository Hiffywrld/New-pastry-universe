import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import logo from '../assets/logo.webp';
import './admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const demo = api.mode === 'demo';
  const [email, setEmail] = useState(demo ? 'owner@pastryuniverse.demo' : '');
  const [password, setPassword] = useState(demo ? 'demo' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.admin.login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src={logo} alt="Pastry Universe" width="96" height="96" />
        <h1>Kitchen login</h1>
        <p className="muted">For Pastry Universe staff.</p>
        {demo && <p className="demo-note">Demo: the details are filled in for you. Just tap Log in.</p>}
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
