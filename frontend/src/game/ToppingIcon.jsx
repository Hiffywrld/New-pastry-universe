import { useEffect, useRef } from 'react';
import { drawTopping } from './engine.js';

/** A topping drawn the same way as in the game, for order cards and decoration. */
export default function ToppingIcon({ kind, size = 28, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    drawTopping(ctx, kind, size * 0.4);
  }, [kind, size]);
  return <canvas ref={ref} className={`topping-icon ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
}
