import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { artFor, defaultSizeKey } from '../menu/art.js';
import { choiceLegend, hasChoices, sizeScale } from '../menu/options.js';
import { formatNaira } from '../lib/format.js';
import { flyToCart } from '../lib/motion.js';
import { track } from '../lib/analytics.js';
import { useCart } from '../state/cart.jsx';
import Sticker from './Sticker.jsx';

/**
 * The panel that opens when a treat is tapped on the menu. A bottom sheet on
 * phones (swipe down to close), a centred card on bigger screens. The photo
 * morphs in from the menu card when the browser supports view transitions.
 */
export default function ProductSheet({ item, initialSize, morphing, onClose }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const [sizeKey, setSizeKey] = useState(initialSize || defaultSizeKey(item));
  const size = item.sizes.find((s) => s.key === sizeKey) || item.sizes[0];
  const firstInStock = Math.max(0, size.choices.findIndex((c) => c.inStock));
  const [choiceIndex, setChoiceIndex] = useState(firstInStock);
  const choice = size.choices[choiceIndex] || size.choices[0];
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef(null);
  const panel = useRef(null);
  const photo = useRef(null);
  const art = artFor(item, sizeKey);
  const pricesDiffer = new Set(size.choices.map((c) => c.price)).size > 1;

  useEffect(() => {
    track('product_view', { product: item.id });
    panel.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === 'Escape' && requestClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickSize = (key) => {
    setSizeKey(key);
    const next = item.sizes.find((s) => s.key === key);
    setChoiceIndex(Math.max(0, next.choices.findIndex((c) => c.inStock)));
    setAdded(false);
  };

  const requestClose = (viaDrag = false) => {
    if (morphing && !viaDrag) {
      onClose(true);
      return;
    }
    setClosing(true);
  };

  const addToCart = () => {
    if (!choice?.inStock) return;
    add({ variantId: choice.variantId, slug: item.id, name: item.name, size: size.label, option: choice.label, price: choice.price }, qty);
    flyToCart(photo.current);
    setAdded(true);
  };

  // Swipe down on the top of the sheet to close it (phones).
  const onPointerDown = (e) => {
    if (window.innerWidth > 720) return;
    dragStart.current = { y: e.clientY, t: Date.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragStart.current) return;
    setDrag(Math.max(0, e.clientY - dragStart.current.y));
  };
  const onPointerUp = (e) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    const speed = dy / Math.max(1, Date.now() - dragStart.current.t);
    dragStart.current = null;
    if (dy > 120 || speed > 0.8) requestClose(true);
    else setDrag(0);
  };

  const scale = sizeScale(item, sizeKey);

  return (
    <div className={`sheet-root${closing ? ' is-closing' : ''}${morphing ? '' : ' animate-in'}`} role="dialog" aria-modal="true" aria-label={item.name}>
      <button type="button" className="sheet-scrim" aria-label="Close" onClick={() => requestClose()} />
      <div
        className="sheet"
        ref={panel}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) onClose(false);
        }}
      >
        <div className="sheet-hero" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className="sheet-handle" aria-hidden="true" />
          <button type="button" className="sheet-close icon-btn" onClick={() => requestClose()} aria-label="Close">
            ×
          </button>
          <div className="sheet-stage">
            {art.src && (
              <img
                ref={photo}
                key={art.src}
                src={art.src}
                alt={`${item.name}, ${size.label}`}
                className={art.cutout ? 'sheet-photo' : 'sheet-photo photo'}
                style={{ viewTransitionName: `pu-photo-${item.id}`, transform: `scale(${scale})` }}
                draggable="false"
              />
            )}
          </div>
          <span className="sheet-shelf" aria-hidden="true" />
        </div>

        <div className="sheet-body">
          <p className="details-meta">
            {item.category}
            {item.tag && <span className="tag">{item.tag}</span>}
          </p>
          <h2 className="sheet-name">{item.name}</h2>
          <p className="details-desc">{item.description}</p>

          {item.sizes.length > 1 && (
            <fieldset className="option-group">
              <legend>Size</legend>
              <div className="seg">
                {item.sizes.map((s) => (
                  <button type="button" key={s.key} aria-pressed={s.key === size.key} disabled={!s.inStock} onClick={() => pickSize(s.key)}>
                    {s.label}
                    <span className="seg-price">{formatNaira(s.priceMin)}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {hasChoices(size) && (
            <fieldset className="option-group">
              <legend>{choiceLegend(size.choices)}</legend>
              <div className="chips">
                {size.choices.map((c, i) => (
                  <button
                    type="button"
                    key={c.variantId}
                    aria-pressed={i === choiceIndex}
                    disabled={!c.inStock}
                    onClick={() => {
                      setChoiceIndex(i);
                      setAdded(false);
                    }}
                  >
                    {c.label || 'Regular'}
                    {pricesDiffer && <span className="chip-price">{formatNaira(c.price)}</span>}
                    {!c.inStock && <span className="chip-price">Sold out</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="sheet-foot">
          {added ? (
            <div className="sheet-added">
              <p>
                <strong>Added to your cart.</strong>
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn-outline" onClick={() => requestClose()}>
                  Keep shopping
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onClose(false);
                    navigate('/checkout');
                  }}
                >
                  Checkout
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="qty" role="group" aria-label="Quantity">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One less" disabled={qty <= 1}>
                  −
                </button>
                <span aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="One more">
                  +
                </button>
              </div>
              <button type="button" className="btn btn-primary sheet-add" onClick={addToCart} disabled={!choice?.inStock}>
                {choice?.inStock ? (
                  <>
                    Add to cart <span className="num">{formatNaira(choice.price * qty)}</span>
                  </>
                ) : (
                  'Sold out'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** A tappable card on the menu. */
export function MenuCard({ item, hidePhoto, onOpen }) {
  const art = artFor(item, defaultSizeKey(item));
  return (
    <button type="button" className={`menu-card${item.inStock ? '' : ' is-out'}`} onClick={() => onOpen(item)}>
      <span className="menu-card-art">
        {art.src && (
          <img
            src={art.src}
            alt=""
            loading="lazy"
            className={art.cutout ? '' : 'photo'}
            style={{ viewTransitionName: hidePhoto ? 'none' : `pu-photo-${item.id}` }}
          />
        )}
        {item.tag && <span className="tag menu-card-tag">{item.tag}</span>}
        <Sticker top="from" className="menu-card-sticker">
          {item.priceMin >= 1000 ? `₦${(item.priceMin / 1000).toFixed(item.priceMin % 1000 ? 1 : 0)}k` : formatNaira(item.priceMin)}
        </Sticker>
      </span>
      <span className="menu-card-body">
        <span className="menu-card-name">{item.name}</span>
        <span className="muted small">
          {item.inStock
            ? item.sizes.length > 1
              ? `${item.sizes.length} sizes · from ${formatNaira(item.priceMin)}`
              : formatNaira(item.priceMin)
            : 'Sold out'}
        </span>
      </span>
    </button>
  );
}
