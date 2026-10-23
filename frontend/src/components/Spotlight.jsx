import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { artFor, colorFor, defaultSizeKey } from '../menu/art.js';
import { choiceLegend, hasChoices, sizeScale } from '../menu/options.js';
import { formatNaira } from '../lib/format.js';
import { easing, flyToCart, play, prefersReducedMotion } from '../lib/motion.js';
import { track } from '../lib/analytics.js';
import { useCart } from '../state/cart.jsx';
import RollingNumber from './RollingNumber.jsx';

/**
 * The Treat Spotlight: tap a treat on the menu and its colour blooms out of
 * the card to fill the screen, while the photo lifts out of the card and
 * lands centre stage with the treat's name rolling behind it. Swipe (or use
 * the arrows) to move between treats. Closing flies the photo back into its
 * card. The open treat lives in the address (?treat=banana-bread), so a link
 * opens straight onto it and the back button closes it.
 */

const SHARE_LINKS = !import.meta.env.VITE_MOCK;
const BLOOM = 'cubic-bezier(0.7, 0, 0.2, 1)';

const cardFor = (id) => document.querySelector(`.menu-card[data-treat="${id}"]`);
const onScreen = (r) => Boolean(r && r.width && r.bottom > 40 && r.top < window.innerHeight - 40 && r.right > 0 && r.left < window.innerWidth);

// The transform that makes the photo (`img`, inside `fly`) sit exactly over the `from` box.
function flipFrom(fly, img, from) {
  const wrap = fly.getBoundingClientRect();
  const to = img.getBoundingClientRect();
  if (!to.width || !from.width) return null;
  const s = Math.sqrt((from.width * from.height) / (to.width * to.height));
  const cx = to.left + to.width / 2;
  const cy = to.top + to.height / 2;
  fly.style.transformOrigin = `${cx - wrap.left}px ${cy - wrap.top}px`;
  return `translate(${from.left + from.width / 2 - cx}px, ${from.top + from.height / 2 - cy}px) scale(${s})`;
}

// A circle of colour growing out of (or shrinking back into) a point.
function bloomFrames(cx, cy, r0, opening) {
  const R = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 24;
  const small = `circle(${r0}px at ${cx}px ${cy}px)`;
  const big = `circle(${R}px at ${cx}px ${cy}px)`;
  return opening
    ? [{ clipPath: small, opacity: 0 }, { opacity: 1, offset: 0.16 }, { clipPath: big, opacity: 1 }]
    : [{ clipPath: big, opacity: 1 }, { opacity: 1, offset: 0.72 }, { clipPath: small, opacity: 0 }];
}

const Icon = {
  back: <path d="M15 5 8 12l7 7" />,
  prev: <path d="M14.5 6 8.5 12l6 6" />,
  next: <path d="m9.5 6 6 6-6 6" />,
  share: (
    <>
      <path d="M12 15V4m0 0L8 8m4-4 4 4" />
      <path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  bag: (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
};
const Svg = ({ name }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {Icon[name]}
  </svg>
);

export default function Spotlight({ items, id, closing, onSwitch, onClose, onClosed, onCheckout }) {
  const index = Math.max(0, items.findIndex((i) => i.id === id));
  const item = items[index];
  const { count, bump, open: cartOpen, setOpen: setCartOpen } = useCart();
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const flyRef = useRef(null);
  const imgRef = useRef(null);
  const cartRef = useRef(null);
  const busy = useRef(false);
  const drag = useRef(null);
  const [enter, setEnter] = useState(null);
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Hold the page still underneath.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // Opening: bloom out of the card and fly the photo from it to centre stage.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const bg = bgRef.current;
    const fly = flyRef.current;
    const img = imgRef.current;
    const anims = [];
    let cancelled = false;
    if (prefersReducedMotion()) {
      anims.push(root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }));
    } else {
      const card = cardFor(id);
      const cardImg = card?.querySelector('.menu-card-art img');
      const cr = card?.getBoundingClientRect();
      if (cardImg && img && onScreen(cr)) {
        anims.push(bg.animate(bloomFrames(cr.left + cr.width / 2, cr.top + cr.height / 2, Math.min(cr.width, cr.height) / 2, true), { duration: 640, easing: BLOOM }));
        fly.style.opacity = '0';
        const go = () => {
          if (cancelled) return;
          fly.style.opacity = '';
          const from = flipFrom(fly, img, cardImg.getBoundingClientRect());
          if (from) anims.push(play(fly, [{ transform: from }, { transform: 'none' }], { duration: 780, easing: easing('--spring-smooth') }));
        };
        if (img.complete && img.naturalWidth) go();
        else (img.decode ? img.decode() : Promise.resolve()).then(go, go);
      } else {
        anims.push(bg.animate(bloomFrames(window.innerWidth / 2, window.innerHeight * 0.55, 0, true), { duration: 640, easing: BLOOM }));
        if (fly) {
          anims.push(
            play(fly, [{ transform: 'translateY(70px) scale(0.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
              duration: 800,
              delay: 160,
              easing: easing('--spring-bouncy'),
              fill: 'backwards',
            }),
          );
        }
      }
    }
    return () => {
      cancelled = true;
      if (fly) fly.style.opacity = '';
      anims.forEach((a) => a.cancel());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing: the photo flies back into its card (scrolling the menu to it if
  // you swiped to another treat) and the colour shrinks back in after it.
  useEffect(() => {
    if (!closing) return undefined;
    const root = rootRef.current;
    const bg = bgRef.current;
    const fly = flyRef.current;
    const img = imgRef.current;
    const card = cardFor(item.id);
    if (card && !onScreen(card.getBoundingClientRect())) card.scrollIntoView({ block: 'center' });
    const cr = card?.getBoundingClientRect();
    const cardImg = card?.querySelector('.menu-card-art img');
    const anims = [];
    if (prefersReducedMotion()) {
      anims.push(root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }));
    } else if (cardImg && img && fly && onScreen(cr)) {
      const to = flipFrom(fly, img, cardImg.getBoundingClientRect());
      anims.push(bg.animate(bloomFrames(cr.left + cr.width / 2, cr.top + cr.height / 2, Math.min(cr.width, cr.height) / 2, false), { duration: 580, easing: 'cubic-bezier(0.55, 0, 0.3, 1)', fill: 'forwards' }));
      if (to) anims.push(fly.animate([{ transform: 'none' }, { transform: to }], { duration: 560, easing: 'cubic-bezier(0.5, 0, 0.15, 1)', fill: 'forwards' }));
    } else {
      anims.push(bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 340, fill: 'forwards' }));
      if (fly) anims.push(fly.animate([{ opacity: 1 }, { transform: 'translateY(40px) scale(0.8)', opacity: 0 }], { duration: 280, fill: 'forwards' }));
    }
    let done = false;
    Promise.all(anims.map((a) => a.finished))
      .then(() => {
        if (done) return;
        done = true;
        card?.focus({ preventScroll: true });
        onClosed();
      })
      .catch(() => {});
    return () => {
      done = true;
      anims.forEach((a) => a.cancel());
    };
  }, [closing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move to the next (dir 1) or previous (dir -1) treat.
  const go = (dir) => {
    if (busy.current || closing || items.length < 2) return;
    const next = items[(index + dir + items.length) % items.length];
    const fly = flyRef.current;
    const switchNow = () => {
      busy.current = false;
      setEnter({ dir });
      onSwitch(next.id);
    };
    busy.current = true;
    if (!fly || prefersReducedMotion()) {
      switchNow();
      return;
    }
    const current = fly.style.transform || 'none';
    fly.style.transform = '';
    rootRef.current.querySelector('.spot-info')?.animate([{ opacity: 1 }, { opacity: 0, transform: `translateX(${-dir * 28}px)` }], { duration: 180, fill: 'forwards' });
    const out = fly.animate([{ transform: current }, { transform: `translateX(${-dir * 75}vw) rotate(${-dir * 16}deg)`, opacity: 0 }], {
      duration: 260,
      easing: 'cubic-bezier(0.5, 0, 0.75, 0)',
      fill: 'forwards',
    });
    out.finished.then(switchNow, switchNow);
  };

  // Drag the photo sideways to swipe between treats.
  const dragHandlers = {
    onPointerDown: (e) => {
      if (e.button !== 0 || busy.current || closing) return;
      drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null };
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d || !flyRef.current) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (d.axis === 'x') e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      if (d.axis === 'x') flyRef.current.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`;
    },
    onPointerUp: (e) => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.axis !== 'x' || !flyRef.current) return;
      const dx = e.clientX - d.x;
      const speed = Math.abs(dx) / Math.max(1, performance.now() - d.t);
      if (Math.abs(dx) > 70 || (speed > 0.6 && Math.abs(dx) > 24)) {
        go(dx < 0 ? 1 : -1);
      } else {
        const from = flyRef.current.style.transform;
        flyRef.current.style.transform = '';
        play(flyRef.current, [{ transform: from }, { transform: 'none' }], { duration: 520, easing: easing('--spring-bouncy') });
      }
    },
    onPointerCancel: () => {
      drag.current = null;
      if (flyRef.current) flyRef.current.style.transform = '';
    },
  };

  // Keys: Escape closes, arrows move between treats.
  useEffect(() => {
    const onKey = (e) => {
      if (cartOpen) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const share = async () => {
    const url = `${window.location.origin}/?treat=${encodeURIComponent(item.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, text: `${item.name} from Pastry Universe`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* closed the share sheet */
    }
  };

  const prev = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];

  return (
    <div
      ref={rootRef}
      className={`spot${closing ? ' is-closing' : ''}${scrolled ? ' is-scrolled' : ''}`}
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 110)}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      tabIndex={-1}
      style={{ '--treat': colorFor(item) }}
    >
      <div className="spot-bg" ref={bgRef} aria-hidden="true" />

      <div className="spot-bar">
        <button type="button" className="spot-btn glass" onClick={onClose} aria-label="Back to the menu">
          <Svg name="back" />
        </button>
        <span className="spot-count">
          <span className="num">{index + 1}</span> of {items.length}
        </span>
        {SHARE_LINKS && (
          <button type="button" className="spot-btn glass" onClick={share} aria-label={copied ? 'Link copied' : `Share ${item.name}`}>
            <Svg name={copied ? 'check' : 'share'} />
          </button>
        )}
        <button type="button" ref={cartRef} className="spot-btn spot-cart glass" onClick={() => setCartOpen(true)} aria-label={`Cart, ${count} items`}>
          <Svg name="bag" />
          {count > 0 && (
            <span className="cart-count" key={bump}>
              {count}
            </span>
          )}
        </button>
      </div>

      <div className="spot-body">
        <TreatView key={item.id} item={item} enter={enter} flyRef={flyRef} imgRef={imgRef} cartRef={cartRef} dragHandlers={dragHandlers} onCheckout={onCheckout} />
        {items.length > 1 && (
          <div className="spot-arrows">
            <button type="button" className="spot-btn glass" onClick={() => go(-1)} aria-label={`Previous: ${prev.name}`}>
              <Svg name="prev" />
            </button>
            <button type="button" className="spot-btn glass" onClick={() => go(1)} aria-label={`Next: ${next.name}`}>
              <Svg name="next" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TreatView({ item, enter, flyRef, imgRef, cartRef, dragHandlers, onCheckout }) {
  const { add } = useCart();
  const [sizeKey, setSizeKey] = useState(() => defaultSizeKey(item));
  const size = item.sizes.find((s) => s.key === sizeKey) || item.sizes[0];
  const [choiceIndex, setChoiceIndex] = useState(() => Math.max(0, size.choices.findIndex((c) => c.inStock)));
  const choice = size.choices[choiceIndex] || size.choices[0];
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const art = artFor(item, sizeKey);
  const firstArt = useRef(art.src);
  const scale = sizeScale(item, sizeKey);
  const pricesDiffer = new Set(size.choices.map((c) => c.price)).size > 1;

  useEffect(() => {
    track('product_view', { product: item.id });
  }, [item.id]);

  // Arriving from a swipe: slide in from the side it came from.
  useLayoutEffect(() => {
    if (!enter || !flyRef.current || prefersReducedMotion()) return undefined;
    const a = play(flyRef.current, [{ transform: `translateX(${enter.dir * 65}vw) rotate(${enter.dir * 14}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], {
      duration: 720,
      easing: easing('--spring-bouncy'),
    });
    return () => a.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickSize = (key) => {
    setSizeKey(key);
    const s = item.sizes.find((x) => x.key === key);
    setChoiceIndex(Math.max(0, s.choices.findIndex((c) => c.inStock)));
    setAdded(false);
  };

  const addToCart = () => {
    if (!choice?.inStock) return;
    add({ variantId: choice.variantId, slug: item.id, name: item.name, size: size.label, option: choice.label, price: choice.price }, qty);
    flyToCart(imgRef.current, cartRef.current);
    setAdded(true);
  };

  const word = `${item.name} • `.repeat(3);

  return (
    <>
      <div className="spot-stage" {...dragHandlers}>
        <div className="spot-word" aria-hidden="true">
          <div className="spot-word-track">
            <span>{word}</span>
            <span>{word}</span>
          </div>
        </div>
        <div className="spot-fly" ref={flyRef}>
          <div className="spot-float">
            {art.src && (
              <img
                ref={imgRef}
                key={art.src}
                src={art.src}
                alt={`${item.name}, ${size.label}`}
                className={`${art.cutout ? '' : 'photo'}${art.src !== firstArt.current ? ' is-new' : ''}`}
                style={{ transform: `scale(${scale})` }}
                draggable="false"
              />
            )}
          </div>
        </div>
        <span className="spot-floor" style={{ '--s': scale }} aria-hidden="true" />
      </div>

      <div className="spot-info">
        <p className="spot-meta spot-in" style={{ '--d': 0 }}>
          {item.category}
          {item.tag && <span className="tag">{item.tag}</span>}
        </p>
        <h2 className="spot-name spot-in" style={{ '--d': 1 }}>
          {item.name}
        </h2>
        {item.description && (
          <p className="spot-desc spot-in" style={{ '--d': 2 }}>
            {item.description}
          </p>
        )}

        {item.sizes.length > 1 && (
          <fieldset className="option-group spot-in" style={{ '--d': 3 }}>
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
          <fieldset className="option-group spot-in" style={{ '--d': 4 }}>
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

        <div className="spot-buy spot-in" style={{ '--d': 5 }}>
          {added ? (
            <>
              <button type="button" className="spot-added" onClick={() => setAdded(false)}>
                <span className="spot-tick" aria-hidden="true">
                  <Svg name="check" />
                </span>
                <span>
                  In your cart
                  <small>Tap to add more</small>
                </span>
              </button>
              <button type="button" className="spot-add spot-checkout" onClick={onCheckout}>
                Checkout
              </button>
            </>
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
              <button type="button" className="spot-add" onClick={addToCart} disabled={!choice?.inStock}>
                {choice?.inStock ? (
                  <>
                    <span>Add to cart</span>
                    <RollingNumber value={choice.price * qty} />
                  </>
                ) : (
                  'Sold out'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
