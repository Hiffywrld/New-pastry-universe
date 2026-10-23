import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BRAND } from '../brand.js';
import { artFor, defaultSizeKey } from '../menu/art.js';
import { formatNaira, formatRange } from '../lib/format.js';
import { useCart } from '../state/cart.jsx';
import logo from '../assets/logo.webp';

const external = { target: '_blank', rel: 'noopener noreferrer' };
const CATEGORY_ORDER = ['Banana bread', 'Cakes', 'Gift boxes', 'Chin-chin'];

const BagIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M6 8h12l-1 12H7L6 8Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function SectionLink({ id, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const go = (e) => {
    e.preventDefault();
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (location.pathname === '/') scroll();
    else {
      navigate('/');
      setTimeout(scroll, 120);
    }
  };
  return (
    <a href={`#${id}`} onClick={go}>
      {children}
    </a>
  );
}

export function Header({ simple = false }) {
  const { count, setOpen, bump } = useCart();
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link to="/" className="brand">
          <img src={logo} alt="" width="44" height="44" />
          <span>{BRAND.name}</span>
        </Link>
        {!simple && (
          <nav aria-label="Main" className="nav">
            <SectionLink id="menu">Menu</SectionLink>
            <SectionLink id="delivery">Delivery</SectionLink>
            <Link to="/track">Track order</Link>
          </nav>
        )}
        <button type="button" className="cart-btn" onClick={() => setOpen(true)} aria-label={`Cart, ${count} items`}>
          <BagIcon />
          <span>Cart</span>
          {count > 0 && (
            <span className="cart-count" key={bump}>
              {count}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

export function Announcement({ text }) {
  if (!text) return null;
  return (
    <div className="announcement">
      <p className="wrap">{text}</p>
    </div>
  );
}

export function Intro() {
  return (
    <section className="intro" id="top">
      <div className="wrap intro-row">
        <h1>{BRAND.tagline}</h1>
        <p>{BRAND.intro}</p>
      </div>
    </section>
  );
}

export function Ticker({ lines }) {
  if (!lines?.length) return null;
  const run = (hidden) => (
    <div className="ticker-run" aria-hidden={hidden || undefined}>
      {lines.map((t, i) => (
        <span key={`${t}-${i}`} className="ticker-item">
          {t}
          <i className="ticker-dot" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="ticker" role="marquee" aria-label={lines.join('. ')}>
      <div className="ticker-track">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}

export function MenuBoard({ items, onView }) {
  const cats = useMemo(() => {
    const present = [...new Set(items.map((i) => i.category))];
    return [...CATEGORY_ORDER.filter((c) => present.includes(c)), ...present.filter((c) => !CATEGORY_ORDER.includes(c))];
  }, [items]);

  return (
    <section id="menu" className="section menu">
      <div className="wrap">
        <div className="section-head">
          <h2>The full menu</h2>
          <p>Every size and price. Tap a size to see it in the case and add it to your cart.</p>
        </div>
        {cats.map((cat) => (
          <div className="menu-cat" key={cat}>
            <h3>{cat}</h3>
            <div className="menu-grid">
              {items
                .filter((i) => i.category === cat)
                .map((item) => {
                  const art = artFor(item, defaultSizeKey(item));
                  return (
                    <article className="menu-item" key={item.id}>
                      <button
                        type="button"
                        className="menu-thumb"
                        onClick={() => onView(item.id)}
                        aria-label={`See ${item.name} in the display case`}
                      >
                        {art.src && <img src={art.src} alt="" loading="lazy" className={art.cutout ? '' : 'photo'} />}
                      </button>
                      <div className="menu-body">
                        <h4>
                          {item.name}
                          {item.tag && <span className="tag">{item.tag}</span>}
                        </h4>
                        <p className="menu-desc">{item.description}</p>
                        <ul className="prices">
                          {item.sizes.map((s) => (
                            <li key={s.key} className={s.inStock ? '' : 'is-out'}>
                              <button type="button" onClick={() => onView(item.id, s.key)} disabled={!s.inStock}>
                                <span>{s.key === 'regular' ? 'Price' : s.label}</span>
                                <span className="leader" aria-hidden="true" />
                                <span className="num">{s.inStock ? formatRange(s.priceMin, s.priceMax) : 'Sold out'}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Delivery({ delivery, store }) {
  const [q, setQ] = useState('');
  const zones = delivery?.zones || [];
  const term = q.trim().toLowerCase();
  const shown = term ? zones.filter((z) => `${z.name} ${z.areas}`.toLowerCase().includes(term)) : zones;

  return (
    <section id="delivery" className="section delivery">
      <div className="wrap">
        <div className="section-head">
          <h2>Delivery across Lagos</h2>
          <p>Pick your area at checkout and the fee is added for you. Or pick up for free.</p>
        </div>

        <ol className="steps">
          <li>
            <span className="step-num">1</span>
            <div>
              <h3>Fill your cart</h3>
              <p>Choose sizes and toppings from the case or the menu.</p>
            </div>
          </li>
          <li>
            <span className="step-num">2</span>
            <div>
              <h3>Pay by transfer</h3>
              <p>Send the total to our account and upload your receipt.</p>
            </div>
          </li>
          <li>
            <span className="step-num">3</span>
            <div>
              <h3>Track it live</h3>
              <p>Watch it go from the oven to your door on your order page.</p>
            </div>
          </li>
        </ol>

        <div className="delivery-grid">
          <div className="zone-finder">
            <label htmlFor="area-search">Find your area</label>
            <input
              id="area-search"
              type="search"
              placeholder="Try Lekki, Ikeja or Yaba"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
            {shown.length ? (
              <ul className="zones">
                {shown.map((z) => (
                  <li key={z.id}>
                    <span>{z.name}</span>
                    <span className="num">{formatNaira(z.fee)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zones-empty">No delivery area matches “{q}”. Message us on WhatsApp and we'll tell you the fee.</p>
            )}
          </div>

          {delivery?.pickupAddress && (
            <aside className="pickup">
              <h3>Free pickup</h3>
              <p>{delivery.pickupAddress}</p>
              {delivery.pickupNote && <p className="muted">{delivery.pickupNote}</p>}
              {store?.whatsapp && (
                <a className="btn btn-outline" href={`https://wa.me/${store.whatsapp}`} {...external}>
                  Chat on WhatsApp
                </a>
              )}
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

export function Footer({ store }) {
  const year = new Date().getFullYear();
  return (
    <footer id="contact" className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <img src={logo} alt="Pastry Universe sticker logo" className="footer-logo" width="220" height="220" />
        </div>
        <div className="footer-contact">
          <h2>Talk to us</h2>
          <dl>
            {store?.whatsapp && (
              <div>
                <dt>WhatsApp</dt>
                <dd>
                  <a href={`https://wa.me/${store.whatsapp}`} {...external}>
                    Chat with us
                  </a>
                </dd>
              </div>
            )}
            {store?.phone && (
              <div>
                <dt>Call</dt>
                <dd>
                  <a href={`tel:${store.phone.replace(/\s/g, '')}`}>{store.phone}</a>
                </dd>
              </div>
            )}
            {store?.email && (
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${store.email}`}>{store.email}</a>
                </dd>
              </div>
            )}
            {store?.instagram && (
              <div>
                <dt>Instagram</dt>
                <dd>
                  <a href={`https://instagram.com/${store.instagram}`} {...external}>
                    @{store.instagram}
                  </a>
                </dd>
              </div>
            )}
            {store?.address && (
              <div>
                <dt>Address</dt>
                <dd>{store.address}</dd>
              </div>
            )}
          </dl>
          <Link className="btn btn-orange" to="/track">
            Track an order
          </Link>
        </div>
      </div>
      <div className="wrap footer-base">
        <p>
          © {year} {BRAND.name}
        </p>
        <Link to="/admin">Staff</Link>
      </div>
    </footer>
  );
}
