import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BRAND } from '../brand.js';
import { formatNaira } from '../lib/format.js';
import { MenuCard } from './ProductSheet.jsx';
import { useCart } from '../state/cart.jsx';
import { useAccount } from '../state/account.jsx';
import ToppingIcon from '../game/ToppingIcon.jsx';
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

function AccountButton() {
  const { me, status } = useAccount();
  const first = me?.profile?.name?.split(' ')[0];
  return (
    <Link to="/account" className={`account-btn${status === 'in' ? ' is-in' : ''}`} aria-label={status === 'in' ? `Your account, ${first}` : 'Sign in'}>
      {status === 'in' ? (
        <span className="avatar avatar-sm" aria-hidden="true">
          {me.profile.avatarUrl ? <img src={me.profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : first?.[0]}
        </span>
      ) : (
        <>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Sign in</span>
        </>
      )}
    </Link>
  );
}

export function GamePromo() {
  const { status, me, config } = useAccount();
  if (!config?.gameEnabled) return null;
  if (status === 'in' && (me?.game?.played || me?.reward)) return null;
  return (
    <section className="promo">
      <div className="wrap promo-inner">
        <div className="promo-toppings" aria-hidden="true">
          {['raisin', 'almond', 'choc', 'coconut', 'banana'].map((k, i) => (
            <span key={k} style={{ animationDelay: `${i * 0.35}s` }}>
              <ToppingIcon kind={k} size={40} />
            </span>
          ))}
        </div>
        <div className="promo-copy">
          <h2>Win up to {config.topPercent}% off your first order</h2>
          <p>Sign up and play Topping Rush: 45 seconds, 3 orders, one go.</p>
        </div>
        <Link to={status === 'in' ? '/play' : '/account'} className="btn btn-orange">
          {status === 'in' ? 'Play now' : 'Sign up and play'}
        </Link>
      </div>
    </section>
  );
}

export function Header({ simple = false }) {
  const { count, setOpen, bump } = useCart();
  const [scrolled, setScrolled] = useState(false);

  // The header turns into a floating glass capsule once you scroll.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 24));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
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
        <AccountButton />
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

export function MenuBoard({ items, openId, onOpen }) {
  const [cat, setCat] = useState('All');
  const cats = useMemo(() => {
    const present = [...new Set(items.map((i) => i.category))];
    return [...CATEGORY_ORDER.filter((c) => present.includes(c)), ...present.filter((c) => !CATEGORY_ORDER.includes(c))];
  }, [items]);
  const shown = cat === 'All' ? items : items.filter((i) => i.category === cat);

  return (
    <section id="menu" className="section menu">
      <div className="wrap">
        <div className="section-head">
          <h2>The full menu</h2>
          <p>Tap a treat to pick a size and topping.</p>
        </div>
        <div className="cat-row" role="radiogroup" aria-label="Category">
          {['All', ...cats].map((c) => (
            <button type="button" key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
              <span className="cat-count">{c === 'All' ? items.length : items.filter((i) => i.category === c).length}</span>
            </button>
          ))}
        </div>
        <div className="menu-cards" key={cat}>
          {shown.map((item, i) => (
            <div className="menu-card-wrap" style={{ '--i': i }} key={item.id}>
              <MenuCard item={item} hidePhoto={openId === item.id} onOpen={onOpen} />
            </div>
          ))}
        </div>
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
      </div>
    </footer>
  );
}
