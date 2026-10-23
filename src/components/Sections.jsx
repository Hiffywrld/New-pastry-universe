import { useMemo, useState } from 'react';
import { BRAND, TICKER } from '../config.js';
import { CATEGORIES } from '../menu/families.js';
import { artFor, defaultSizeKey } from '../menu/art.js';
import { formatNaira, formatRange } from '../lib/format.js';
import logo from '../assets/logo.webp';

const external = { target: '_blank', rel: 'noopener noreferrer' };

export function Header() {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <a href="#top" className="brand">
          <img src={logo} alt="" width="44" height="44" />
          <span>{BRAND.name}</span>
        </a>
        <nav aria-label="Main" className="nav">
          <a href="#menu">Menu</a>
          <a href="#delivery">Delivery</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="btn btn-primary btn-sm" href={BRAND.storeUrl} {...external}>
          Shop on Bumpa
        </a>
      </div>
    </header>
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

export function Ticker() {
  const run = (hidden) => (
    <div className="ticker-run" aria-hidden={hidden || undefined}>
      {TICKER.map((t) => (
        <span key={t} className="ticker-item">
          {t}
          <i className="ticker-dot" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="ticker" role="marquee" aria-label={TICKER.join('. ')}>
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
    return [...CATEGORIES.filter((c) => present.includes(c)), ...present.filter((c) => !CATEGORIES.includes(c))];
  }, [items]);

  return (
    <section id="menu" className="section menu">
      <div className="wrap">
        <div className="section-head">
          <h2>The full menu</h2>
          <p>Every size and price, straight from our Bumpa store. Tap a size to order it.</p>
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
                              <a href={s.url} {...external}>
                                <span>{s.key === 'regular' ? 'Price' : s.label}</span>
                                <span className="leader" aria-hidden="true" />
                                <span className="num">{s.inStock ? formatRange(s.priceMin, s.priceMax) : 'Sold out'}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                        <button type="button" className="text-btn" onClick={() => onView(item.id)}>
                          See it in the case
                        </button>
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

export function Delivery({ delivery }) {
  const [q, setQ] = useState('');
  const zones = delivery?.zones || [];
  const term = q.trim().toLowerCase();
  const shown = term
    ? zones.filter((z) => `${z.name} ${z.areas}`.toLowerCase().includes(term))
    : zones;

  return (
    <section id="delivery" className="section delivery">
      <div className="wrap">
        <div className="section-head">
          <h2>Delivery across Lagos</h2>
          <p>Order on Bumpa and pick your area at checkout. Here is what delivery costs.</p>
        </div>

        <ol className="steps">
          <li>
            <span className="step-num">1</span>
            <div>
              <h3>Pick your treats</h3>
              <p>Browse the case or the menu and choose a size.</p>
            </div>
          </li>
          <li>
            <span className="step-num">2</span>
            <div>
              <h3>Check out on Bumpa</h3>
              <p>Choose toppings, add delivery or pickup, and pay securely.</p>
            </div>
          </li>
          <li>
            <span className="step-num">3</span>
            <div>
              <h3>Enjoy</h3>
              <p>We deliver to your area, or you pick up in Ojodu Berger.</p>
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
                  <li key={z.name}>
                    <span>{z.name}</span>
                    <span className="num">{formatNaira(z.fee)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="zones-empty">
                No delivery zone matches “{q}”. Message us on WhatsApp and we will tell you the fee.
              </p>
            )}
          </div>

          {delivery?.pickup && (
            <aside className="pickup">
              <h3>Free pickup</h3>
              <p>{delivery.pickup.replace(/^Pick up at /i, 'Pick up at ')}</p>
              <a className="btn btn-outline" href={`tel:${BRAND.phoneIntl}`}>
                Call {BRAND.phone}
              </a>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
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
            <div>
              <dt>WhatsApp</dt>
              <dd>
                <a href={BRAND.whatsapp} {...external}>
                  Chat with us
                </a>
              </dd>
            </div>
            <div>
              <dt>Call</dt>
              <dd>
                <a href={`tel:${BRAND.phoneIntl}`}>{BRAND.phone}</a>
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
              </dd>
            </div>
            <div>
              <dt>Instagram</dt>
              <dd>
                <a href={`https://instagram.com/${BRAND.instagram}`} {...external}>
                  @{BRAND.instagram}
                </a>
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{BRAND.address}</dd>
            </div>
          </dl>
          <a className="btn btn-orange" href={BRAND.storeUrl} {...external}>
            Shop on Bumpa
          </a>
        </div>
      </div>
      <div className="wrap footer-base">
        <p>
          © {year} {BRAND.name}
        </p>
        {BRAND.credit && (
          <p>
            Site by{' '}
            <a href={BRAND.credit.url} {...external}>
              {BRAND.credit.label}
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
