// Anonymous activity for the admin dashboard: a random id per browser tab,
// no names, no cookies.
import { api } from '../api/index.js';

function sessionId() {
  try {
    let id = sessionStorage.getItem('pu-session');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('pu-session', id);
    }
    return id;
  } catch {
    if (!window.__puSession) window.__puSession = Math.random().toString(36).slice(2);
    return window.__puSession;
  }
}

export function track(type, extra = {}) {
  api.event({ sessionId: sessionId(), type, path: window.location.pathname, referrer: document.referrer || undefined, ...extra });
}

export { sessionId };

let beat = null;
export function startHeartbeat() {
  if (beat) return;
  const send = () => document.visibilityState === 'visible' && track('heartbeat');
  send();
  beat = setInterval(send, 30_000);
  document.addEventListener('visibilitychange', send);
}
