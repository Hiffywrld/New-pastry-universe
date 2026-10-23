import { Link, useNavigate } from 'react-router-dom';
import GoogleButton from '../components/GoogleButton.jsx';
import ToppingIcon from '../game/ToppingIcon.jsx';
import { formatNaira } from '../lib/format.js';
import { useAccount } from '../state/account.jsx';
import { RewardCard } from './PlayPage.jsx';

const FLOATERS = [
  ['raisin', 8, 12, 0],
  ['almond', 78, 6, 0.6],
  ['choc', 88, 52, 1.2],
  ['coconut', 4, 62, 1.8],
  ['banana', 62, 82, 0.9],
  ['raisin', 30, 88, 1.5],
  ['almond', 46, 4, 2.1],
];

function SignUp() {
  const { config } = useAccount();
  const navigate = useNavigate();
  const top = config?.topPercent ?? 40;
  return (
    <section className="signup">
      <div className="wrap signup-grid">
        <div className="signup-copy">
          <p className="eyebrow-pill">New here?</p>
          <h1>
            Win up to <span className="signup-pct">{top}%</span> off your first order
          </h1>
          <p className="lead">
            Sign up, then play <strong>Topping Rush</strong>: 45 seconds to top 3 banana bread orders. Clean and fast wins the most.
          </p>
          <GoogleButton onSignedIn={(me) => navigate(me?.game?.played || me?.reward ? '/account' : '/play')} />
          <p className="muted small fine-print">
            One go per account and phone number. Discount is for your first order, up to {formatNaira(config?.maxDiscount ?? 5000)} off, valid {config?.validDays ?? 14} days. Most players win 5–15%.
          </p>
          <p className="muted small">Already have an account? The same button signs you in.</p>
        </div>
        <div className="signup-art" aria-hidden="true">
          {FLOATERS.map(([k, x, y, d], i) => (
            <span key={i} className="floater" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}>
              <ToppingIcon kind={k} size={44} />
            </span>
          ))}
          <div className="signup-loaf">
            <span className="signup-loaf-top" />
            <span className="signup-loaf-tray" />
          </div>
          <span className="sticker sticker-lg signup-sticker">
            <span className="sticker-top">up to</span>
            <span className="sticker-main">{top}%</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function AccountHome() {
  const { me, signOut, config } = useAccount();
  const first = me.profile.name.split(' ')[0];
  return (
    <section className="wrap page-pad account">
      <div className="account-head">
        <span className="avatar" aria-hidden="true">
          {me.profile.avatarUrl ? <img src={me.profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : first[0]}
        </span>
        <div>
          <h1 className="page-title">Hi, {first}</h1>
          <p className="muted">{me.profile.email}</p>
        </div>
        <button type="button" className="text-btn small sign-out" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="account-grid">
        <div className="account-main">
          {me.reward ? (
            <section>
              <h2 className="account-h2">Your welcome reward</h2>
              <RewardCard reward={me.reward} />
            </section>
          ) : me.game.enabled && !me.game.played ? (
            <section className="play-cta">
              <div>
                <h2>Play Topping Rush</h2>
                <p>
                  45 seconds, 3 orders, one go. Win up to {config?.topPercent ?? 40}% off your first order.
                </p>
              </div>
              <Link to="/play" className="btn btn-orange">
                Play now
              </Link>
            </section>
          ) : null}

          <section>
            <h2 className="account-h2">Your orders</h2>
            {me.orders.length ? (
              <ul className="history">
                {me.orders.map((o) => (
                  <li key={o.code}>
                    <Link to={`/order/${o.token}`}>
                      <span>
                        <strong>{o.code}</strong>
                        <span className="muted small block">{o.itemsText}</span>
                      </span>
                      <span className="history-side">
                        <span className="num">{formatNaira(o.total)}</span>
                        <span className="muted small">{o.statusLabel}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No orders yet. <Link to="/">Find something sweet</Link>.
              </p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

export default function AccountPage() {
  const { status } = useAccount();
  if (status === 'loading') return <div className="wrap page-pad muted">Loading…</div>;
  return status === 'in' ? <AccountHome /> : <SignUp />;
}
