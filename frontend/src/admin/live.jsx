import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';

const LiveContext = createContext(null);
const SOUND_KEY = 'pu-admin-sound';

let audio = null;
function kaching() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    [
      [1318.5, 0],
      [1760, 0.09],
      [2637, 0.18],
    ].forEach(([freq, delay]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, t + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.4);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.45);
    });
  } catch {
    /* audio not available */
  }
}

// One live connection for the whole admin: new orders, receipts, status
// changes and the visitor count, shared with every page.
export function LiveProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [visitors, setVisitors] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [sound, setSoundState] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) === '1';
    } catch {
      return false;
    }
  });
  const soundRef = useRef(sound);
  const listeners = useRef(new Set());

  const setSound = useCallback((on) => {
    soundRef.current = on;
    setSoundState(on);
    if (on) kaching();
    try {
      localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useEffect(() => {
    const stop = api.admin.stream({
      open: () => setConnected(true),
      error: () => setConnected(false),
      hello: (d) => setVisitors(d.visitors),
      visitors: (d) => setVisitors(d.count),
      order: (e) => {
        listeners.current.forEach((fn) => fn(e));
        if (e.kind === 'created' || e.kind === 'receipt') {
          if (soundRef.current) kaching();
          const id = `${e.order.id}-${e.kind}-${Date.now()}`;
          setToasts((t) => [...t.slice(-2), { id, kind: e.kind, order: e.order }]);
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 7000);
        }
      },
    });
    return stop;
  }, []);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  return (
    <LiveContext.Provider value={{ connected, visitors, sound, setSound, subscribe, toasts, dismiss }}>
      {children}
    </LiveContext.Provider>
  );
}

export const useLive = () => useContext(LiveContext);

/** Calls `fn` whenever any order changes, at most once per `ms`. */
export function useOrderChanges(fn, ms = 600) {
  const { subscribe } = useLive();
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let timer = null;
    const off = subscribe((e) => {
      clearTimeout(timer);
      timer = setTimeout(() => fnRef.current(e), ms);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [subscribe, ms]);
}
