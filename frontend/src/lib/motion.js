export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Reads an easing from a CSS custom property (e.g. the spring curves in styles.css). */
export function easing(name, fallback = 'cubic-bezier(0.25, 1, 0.5, 1)') {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** el.animate(), falling back to a plain curve if the browser rejects the easing. */
export function play(el, frames, options) {
  try {
    return el.animate(frames, options);
  } catch {
    return el.animate(frames, { ...options, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
  }
}

/** Sends a copy of an image flying into the cart button. */
export function flyToCart(img, target = document.querySelector('.cart-btn')) {
  if (!img || !target || prefersReducedMotion()) return;
  const from = img.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width) return;
  const clone = img.cloneNode(true);
  clone.removeAttribute('style');
  clone.removeAttribute('class');
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    objectFit: 'contain',
    zIndex: 100,
    pointerEvents: 'none',
    filter: 'drop-shadow(0 10px 16px rgba(0,0,0,.3))',
  });
  document.body.appendChild(clone);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = Math.max(0.08, 28 / Math.max(from.width, from.height));
  const anim = clone.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(${0.55 + scale / 2}) rotate(-12deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(-24deg)`, opacity: 0.2 },
    ],
    { duration: 750, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' },
  );
  anim.onfinish = () => {
    clone.remove();
    target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'ease-out' });
  };
}
