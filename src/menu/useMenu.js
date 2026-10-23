import { useEffect, useState } from 'react';
import snapshot from './snapshot.json';
import { LIVE_MENU_URL } from '../config.js';

// Starts with the bundled backup so the page renders instantly,
// then swaps in the live Bumpa menu when it arrives.
export function useMenu() {
  const [menu, setMenu] = useState(snapshot);

  useEffect(() => {
    if (!LIVE_MENU_URL) return;
    const ctrl = new AbortController();
    fetch(LIVE_MENU_URL, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((live) => {
        if (live && Array.isArray(live.items) && live.items.length) setMenu(live);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  return menu;
}
