import { useEffect, useRef, useState } from 'react';
import { useAccount } from '../state/account.jsx';

let gisPromise = null;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Google sign-in couldn't load."));
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

const GoogleG = () => (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** "Continue with Google". In the demo it signs in a pretend shopper. */
export default function GoogleButton({ onSignedIn }) {
  const { config, signInWith } = useAccount();
  const box = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async (credential) => {
    setBusy(true);
    setError('');
    try {
      const me = await signInWith(credential);
      onSignedIn?.(me);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!config?.googleClientId || !box.current) return;
    loadGoogle()
      .then(() => {
        window.google.accounts.id.initialize({ client_id: config.googleClientId, callback: (r) => finish(r.credential) });
        window.google.accounts.id.renderButton(box.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 300 });
      })
      .catch((e) => setError(e.message));
  }, [config?.googleClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!config) return <div className="google-slot" />;

  return (
    <div className="google-wrap">
      {config.googleClientId ? (
        <div ref={box} className="google-slot" />
      ) : config.demo ? (
        <button type="button" className="google-btn" onClick={() => finish('demo')} disabled={busy}>
          <GoogleG />
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
      ) : (
        <p className="muted small">Sign-in is being set up. Check back soon.</p>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
