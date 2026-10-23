import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { artFor, defaultSizeKey } from '../menu/art.js';
import { formatNaira, formatShort } from '../lib/format.js';
import Sticker from './Sticker.jsx';
import { track } from '../lib/analytics.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function useBox(ref) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

function choiceLegend(choices) {
  const labels = choices.map((c) => c.label.toLowerCase()).join(' ');
  if (/plain|peppered/.test(labels)) return 'Flavour';
  if (/note/.test(labels)) return 'Gift note';
  return 'Topping';
}

// Bigger sizes sit bigger on the shelf.
function sizeScale(item, sizeKey) {
  const n = item.sizes.length;
  if (n < 2) return 1;
  const i = Math.max(0, item.sizes.findIndex((s) => s.key === sizeKey));
  return 0.74 + 0.26 * (i / (n - 1));
}

const Chevron = ({ dir }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function DisplayCase({ items, active, open, picks, onActive, onOpen, onClose, onPick, onAdd, onViewCart, caseRef }) {
  const boxRef = useRef(null);
  const { w: W } = useBox(boxRef);
  const [hover, setHover] = useState(null);
  const swipe = useRef({ x: 0, moved: false });

  const n = items.length;
  const narrow = W < 640;
  const G = narrow ? 12 : 20;
  const pad = narrow ? 16 : 40;
  const S = clamp((W - pad * 2 - G * (n - 1)) / n, narrow ? 104 : 96, 178);
  const pieceH = S * 1.06;
  const shelfY = narrow ? 70 : 92;
  // Compact while browsing; the case grows when a treat is opened.
  const openH = narrow ? 420 : clamp(W * 0.38, 420, 520);
  const browseH = Math.max(pieceH + shelfY + (narrow ? 90 : 100), narrow ? 300 : 320);
  const room = openH - shelfY - (narrow ? 70 : 86);
  const focusScale = clamp(room / pieceH, 1.45, 2.7);
  const T = n * S + (n - 1) * G;
  const fits = T <= W - pad * 2;
  const centreOn = (i) => W / 2 - (i * (S + G) + S / 2);
  const trackX = open ? centreOn(active) : fits ? (W - T) / 2 : clamp(centreOn(active), W - pad - T, pad);
  const push = (S * (focusScale - 1)) / 2 + G * 0.6;

  const item = items[active];
  const pick = picks[item?.id] || {};
  const sizeKey = pick.size || (item ? defaultSizeKey(item) : null);
  const size = item?.sizes.find((s) => s.key === sizeKey) || item?.sizes[0];
  const showChoices = Boolean(size && (size.choices.length > 1 || size.choices[0]?.label));
  const firstInStock = Math.max(0, size?.choices.findIndex((c) => c.inStock) ?? 0);
  const choiceIndex = pick.choice ?? firstInStock;
  const choice = size?.choices[choiceIndex];
  const choicePricesDiffer = size ? new Set(size.choices.map((c) => c.price)).size > 1 : false;
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setQty(1);
    setAdded(false);
  }, [item?.id, sizeKey, choiceIndex]);

  useEffect(() => {
    if (open && item) track('product_view', { product: item.id });
  }, [open, item?.id]);

  const addToCart = () => {
    if (!choice?.inStock) return;
    onAdd(
      { variantId: choice.variantId, slug: item.id, name: item.name, size: size.label, option: choice.label, price: choice.price },
      qty,
    );
    setAdded(true);
  };

  const go = (step) => onActive((active + step + n) % n);

  // Bring the whole case into view when a treat is opened.
  useEffect(() => {
    if (!open || !caseRef?.current) return;
    const top = caseRef.current.getBoundingClientRect().top;
    if (top < 40 || top > window.innerHeight * 0.3) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      caseRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }, [open, caseRef]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onPointerDown = (e) => {
    swipe.current = { x: e.clientX, moved: false };
  };
  const onPointerUp = (e) => {
    const dx = e.clientX - swipe.current.x;
    if (Math.abs(dx) > 40 && (open || !fits)) {
      swipe.current.moved = true;
      go(dx < 0 ? 1 : -1);
    }
  };
  const onClickCapture = (e) => {
    if (swipe.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      swipe.current.moved = false;
    }
  };

  const shown = !open && hover != null ? items[hover] : item;

  return (
    <section className="display" aria-label="Display case" ref={caseRef}>
      <div
        className={`case${open ? ' is-open' : ''}${W ? ' is-ready' : ''}`}
        ref={boxRef}
        style={W ? { height: open ? openH : browseH } : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClickCapture={onClickCapture}
      >
        <div
          className="track"
          style={{ transform: `translate3d(${trackX}px,0,0)`, bottom: shelfY, height: pieceH, width: T }}
        >
          {items.map((it, k) => {
            const isFocus = open && k === active;
            const dim = open && k !== active;
            const itemSize = isFocus ? sizeKey : defaultSizeKey(it);
            const art = artFor(it, itemSize);
            const dx = open ? (k < active ? -push : k > active ? push : 0) : 0;
            const lift = !open && hover === k ? -12 : 0;
            const scale = isFocus ? focusScale * sizeScale(it, sizeKey) : dim ? 0.8 : 1;
            return (
              <button
                key={it.id}
                type="button"
                className={`slot${isFocus ? ' is-focus' : ''}${dim ? ' is-dim' : ''}`}
                style={{ left: k * (S + G), width: S, height: pieceH, transform: `translate3d(${dx}px,${lift}px,0)` }}
                onClick={() => {
                  if (!open) {
                    onActive(k);
                    onOpen();
                  } else if (k !== active) onActive(k);
                }}
                onMouseEnter={() => setHover(k)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => !open && setHover(k)}
                onBlur={() => setHover(null)}
                tabIndex={dim ? -1 : 0}
                aria-label={`${it.name}, from ${formatNaira(it.priceMin)}`}
                aria-pressed={isFocus}
              >
                <span className="drop" style={{ '--i': k }}>
                  <span className="piece" style={{ transform: `scale(${scale})` }}>
                    <span className="piece-shadow" />
                    {art.src && (
                      <img
                        key={art.src}
                        src={art.src}
                        alt=""
                        draggable="false"
                        className={art.cutout ? 'cutout' : 'photo'}
                      />
                    )}
                  </span>
                  <Sticker top="from" className="slot-sticker">
                    {formatShort(it.priceMin)}
                  </Sticker>
                </span>
              </button>
            );
          })}
        </div>
        <div className="shelf" style={{ bottom: shelfY - 16 }} aria-hidden="true" />
        <div className="glare" aria-hidden="true" />

        {open && (
          <>
            <button type="button" className="case-back" onClick={onClose}>
              <Chevron dir="left" /> All treats
            </button>
            <button type="button" className="case-nav prev" onClick={() => go(-1)} aria-label="Previous treat">
              <Chevron dir="left" />
            </button>
            <button type="button" className="case-nav next" onClick={() => go(1)} aria-label="Next treat">
              <Chevron dir="right" />
            </button>
          </>
        )}
        {!open && !fits && <p className="case-hint">Swipe the shelf</p>}
      </div>

      <div className="wrap below-case" aria-live="polite">
        {!open || !item ? (
          shown && (
            <div className="caption">
              <p className="caption-name">
                {shown.name}
                <span className="caption-price">from {formatNaira(shown.priceMin)}</span>
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  onActive(items.indexOf(shown));
                  onOpen();
                }}
              >
                Look closer
              </button>
            </div>
          )
        ) : (
          <div className="details" key={item.id}>
            <div className="details-copy">
              <p className="details-meta">
                {item.category}
                {item.tag && <span className="tag">{item.tag}</span>}
              </p>
              <h2 className="details-name">{item.name}</h2>
              <p className="details-desc">{item.description}</p>
            </div>

            <div className="details-controls">
              {item.sizes.length > 1 && (
                <fieldset className="option-group">
                  <legend>Size</legend>
                  <div className="seg">
                    {item.sizes.map((s) => (
                      <button
                        type="button"
                        key={s.key}
                        aria-pressed={s.key === size.key}
                        disabled={!s.inStock}
                        onClick={() => onPick(item.id, { size: s.key, choice: undefined })}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {showChoices && (
                <fieldset className="option-group">
                  <legend>{choiceLegend(size.choices)}</legend>
                  <div className="chips">
                    {size.choices.map((c, i) => (
                      <button
                        type="button"
                        key={c.variantId}
                        aria-pressed={i === choiceIndex}
                        disabled={!c.inStock}
                        onClick={() => onPick(item.id, { size: size.key, choice: i })}
                      >
                        {c.label || 'Regular'}
                        {choicePricesDiffer && <span className="chip-price">{formatNaira(c.price)}</span>}
                        {!c.inStock && <span className="chip-price">Sold out</span>}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="buy">
                <p className="buy-price">{formatNaira((choice?.price ?? size?.priceMin ?? 0) * qty)}</p>
                <div className="qty" role="group" aria-label="Quantity">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One less" disabled={qty <= 1}>
                    −
                  </button>
                  <span aria-live="polite">{qty}</span>
                  <button type="button" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="One more">
                    +
                  </button>
                </div>
                <button type="button" className="btn btn-primary" onClick={addToCart} disabled={!choice?.inStock}>
                  {choice?.inStock ? 'Add to cart' : 'Sold out'}
                </button>
              </div>
              {added ? (
                <p className="fine added">
                  Added to your cart.{' '}
                  <button type="button" className="text-btn" onClick={onViewCart}>
                    View cart
                  </button>
                </p>
              ) : (
                <p className="fine">Pay by bank transfer at checkout. Delivery across Lagos or free pickup.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
