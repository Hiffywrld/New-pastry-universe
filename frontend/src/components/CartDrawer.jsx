import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { artFor } from '../menu/art.js';
import { formatNaira } from '../lib/format.js';
import { lineLabel, useCart } from '../state/cart.jsx';
import { useMenu } from '../menu/useMenu.js';

export default function CartDrawer() {
  const { lines, open, setOpen, setQuantity, subtotal, count } = useCart();
  const { menu } = useMenu() || {};
  const navigate = useNavigate();
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, setOpen]);

  if (!open) return null;

  const itemFor = (slug) => menu?.items.find((i) => i.id === slug);

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Your cart">
      <button type="button" className="drawer-scrim" aria-label="Close cart" onClick={() => setOpen(false)} />
      <div className="drawer" ref={panel} tabIndex={-1}>
        <div className="drawer-head">
          <h2>Your cart</h2>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close cart">
            ×
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="drawer-empty">
            <p>Your cart is empty.</p>
            <p className="muted">Open a treat in the display case and tap Add to cart.</p>
            <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
              Keep browsing
            </button>
          </div>
        ) : (
          <>
            <ul className="cart-lines">
              {lines.map((l) => {
                const item = itemFor(l.slug);
                const art = item ? artFor(item) : null;
                return (
                  <li key={l.variantId} className="cart-line">
                    <div className="cart-thumb">{art?.src && <img src={art.src} alt="" />}</div>
                    <div className="cart-info">
                      <p className="cart-name">{l.name}</p>
                      {lineLabel(l) && <p className="muted small">{lineLabel(l)}</p>}
                      <div className="qty qty-sm" role="group" aria-label={`Quantity of ${l.name}`}>
                        <button type="button" onClick={() => setQuantity(l.variantId, l.quantity - 1)} aria-label="One less">
                          −
                        </button>
                        <span>{l.quantity}</span>
                        <button type="button" onClick={() => setQuantity(l.variantId, l.quantity + 1)} aria-label="One more">
                          +
                        </button>
                      </div>
                    </div>
                    <div className="cart-price">
                      <p className="num">{formatNaira(l.price * l.quantity)}</p>
                      <button type="button" className="text-btn small" onClick={() => setQuantity(l.variantId, 0)}>
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="drawer-foot">
              <div className="row-between">
                <span>Subtotal ({count} {count === 1 ? 'item' : 'items'})</span>
                <strong className="num">{formatNaira(subtotal)}</strong>
              </div>
              <p className="muted small">Delivery fee is added at checkout, based on your area.</p>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => {
                  setOpen(false);
                  navigate('/checkout');
                }}
              >
                Go to checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
