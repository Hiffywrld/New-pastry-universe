import { useEffect, useRef, useState } from 'react';
import { formatNaira } from '../lib/format.js';

/** A naira amount that rolls smoothly to its new value when it changes. */
export default function RollingNumber({ value, ms = 450 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      from.current = value;
      setShown(value);
      return undefined;
    }
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - (1 - k) ** 4;
      const v = Math.round(start + (value - start) * eased);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span className="roll">{formatNaira(shown)}</span>;
}
