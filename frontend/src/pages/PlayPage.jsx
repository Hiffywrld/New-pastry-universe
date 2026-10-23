import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { createGame, GAME_SECONDS, TOPPINGS } from '../game/engine.js';
import ToppingIcon from '../game/ToppingIcon.jsx';
import { formatNaira } from '../lib/format.js';
import { useAccount } from '../state/account.jsx';

function PrizeLadder({ config }) {
  const p = config?.percentByOrders || [5, 10, 15, 25];
  return (
    <ol className="ladder">
      <li>
        <span>No orders finished</span>
        <strong>{p[0]}%</strong>
      </li>
      <li>
        <span>1 order</span>
        <strong>{p[1]}%</strong>
      </li>
      <li>
        <span>2 orders</span>
        <strong>{p[2]}%</strong>
      </li>
      <li>
        <span>All 3 orders</span>
        <strong>{p[3]}%</strong>
      </li>
      <li className="ladder-top">
        <span>
          All 3, no mistakes, {config?.perfectMinTimeLeft ?? 8}+ seconds left
        </span>
        <strong>{config?.topPercent ?? 40}%</strong>
      </li>
    </ol>
  );
}

function Confetti() {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const c = ref.current;
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.offsetWidth;
    const H = c.offsetHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#f0a334', '#e8693a', '#201e1e', '#ffffff', '#8c5426'];
    const bits = Array.from({ length: 120 }, () => ({
      x: W / 2, y: H * 0.38, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 3,
      s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf;
    let frames = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.vy += 0.28;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      }
      if (++frames < 220) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

function CountUp({ to, ms = 1400 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / ms);
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <span className="num">{n}</span>;
}

export function RewardCard({ reward, compact }) {
  const [copied, setCopied] = useState(false);
  const state = reward.redeemed ? 'Used' : reward.expired ? 'Expired' : reward.percent > 0 ? 'Ready to use' : '';
  return (
    <div className={`reward-card${compact ? ' compact' : ''}${reward.redeemed || reward.expired ? ' is-done' : ''}`}>
      <div className="reward-big">
        <strong className="num">{reward.percent}%</strong>
        <span>off your first order</span>
      </div>
      <div className="reward-info">
        <p className="reward-state">{state}</p>
        <p>
          Code <strong>{reward.code}</strong>{' '}
          <button
            type="button"
            className="copy-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reward.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard unavailable */
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </p>
        <p className="muted small">
          Up to {formatNaira(reward.maxAmount)} off · use by {new Date(reward.expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}. It applies at checkout when you're signed in.
        </p>
      </div>
    </div>
  );
}

export default function PlayPage() {
  const { me, status, config, refresh } = useAccount();
  const [phase, setPhase] = useState('intro');
  const [hud, setHud] = useState(null);
  const [count, setCount] = useState(3);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const canvas = useRef(null);
  const game = useRef(null);
  const session = useRef(null);
  const latest = useRef({ ordersCompleted: 0, timeLeft: 0, mistakes: 0 });
  const ended = useRef(false);

  const submit = async (r) => {
    if (ended.current) return;
    ended.current = true;
    setPhase('saving');
    try {
      const res = await api.account.finishGame({ sessionId: session.current, ...r });
      setResult(res);
      setPhase('result');
      refresh();
    } catch (e) {
      setError(e.message);
      setPhase('result');
      refresh();
    }
  };

  // The game takes over the whole screen while it runs.
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'playing' && phase !== 'saving') return undefined;
    window.scrollTo(0, 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase === 'result']); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving mid-game still ends your go, with what you had.
  useEffect(() => {
    const warn = (e) => {
      if (phase === 'playing' || phase === 'countdown') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  useEffect(
    () => () => {
      game.current?.destroy();
      if (session.current && !ended.current) {
        ended.current = true;
        api.account.finishGame({ sessionId: session.current, ...latest.current }).catch(() => {});
      }
    },
    [],
  );

  const [seed, setSeed] = useState(null);

  const start = async () => {
    setError('');
    try {
      const s = await api.account.startGame();
      session.current = s.sessionId;
      setSeed(Number(s.seed % 2147483647) || 1);
      setPhase('countdown');
    } catch (e) {
      setError(e.message);
      refresh();
    }
  };

  // Once the arena is on screen: build the game, count down, then go.
  useEffect(() => {
    if (phase !== 'countdown' || !canvas.current) return undefined;
    if (!game.current) {
      game.current = createGame(canvas.current, {
        seed,
        onState: (h) => {
          setHud(h);
          latest.current = { ordersCompleted: h.completed, timeLeft: Math.floor(h.timeLeft), mistakes: h.mistakes };
        },
        onEnd: submit,
      });
    }
    let n = 3;
    setCount(n);
    const t = setInterval(() => {
      n -= 1;
      setCount(n);
      if (n <= 0) {
        clearInterval(t);
        setPhase('playing');
        game.current.start();
      }
    }, 750);
    return () => clearInterval(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'out') return <Navigate to="/account" replace />;
  if (status === 'loading' || !me) return <div className="wrap page-pad muted">Loading…</div>;

  const alreadyPlayed = (me.game.played || me.reward) && phase === 'intro';
  if (alreadyPlayed) {
    return (
      <section className="wrap narrow page-pad play-done">
        <h1 className="page-title">You've had your go</h1>
        <p className="muted lead">Topping Rush is one go per person. Here's what you won:</p>
        {me.reward ? <RewardCard reward={me.reward} /> : <p className="muted">Your reward is being saved. Refresh in a moment.</p>}
        <Link to="/" className="btn btn-primary">
          Go shopping
        </Link>
      </section>
    );
  }

  const timePct = hud ? Math.max(0, hud.timeLeft / GAME_SECONDS) : 1;

  return (
    <section className={`play phase-${phase}`}>
      {phase === 'intro' && (
        <div className="wrap narrow play-intro">
          <p className="eyebrow-pill">One go only</p>
          <h1 className="page-title">Topping Rush</h1>
          <p className="lead">
            You have <strong>{GAME_SECONDS} seconds</strong> to top <strong>3 banana bread orders</strong>. Toppings fly across the screen: tap only what the order card asks for.
          </p>
          <ul className="rules">
            <li>
              <span className="rule-bad">−3s</span> Wrong topping, or one you already have enough of
            </li>
            <li>
              <ToppingIcon kind="burnt" size={26} /> <span className="rule-bad">−5s</span> Burnt bits
            </li>
            <li>Each order gets faster. Leaving the game ends your go.</li>
          </ul>
          <h2 className="ladder-title">What you can win</h2>
          <PrizeLadder config={config} />
          <p className="muted small">
            Discount is for your first order, up to {formatNaira(config?.maxDiscount ?? 5000)} off, valid {config?.validDays ?? 14} days. One per account and phone number.
          </p>
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="btn btn-primary btn-block play-start" onClick={start}>
            I'm ready, start
          </button>
        </div>
      )}

      {(phase === 'countdown' || phase === 'playing' || phase === 'saving') && (
        <div className="arena-wrap">
        <div className="arena">
          <div className="hud">
            <div className="hud-top">
              <span className="hud-round">Order {hud?.round ?? 1} of 3</span>
              <span className={`hud-time num${hud && hud.timeLeft < 10 ? ' low' : ''}`}>{Math.ceil(hud?.timeLeft ?? GAME_SECONDS)}s</span>
            </div>
            <div className="hud-bar">
              <span style={{ transform: `scaleX(${timePct})` }} className={hud && hud.timeLeft < 10 ? 'low' : ''} />
            </div>
            <div className="order-card-game">
              {hud?.order?.map((o) => (
                <span key={o.kind} className={`need${o.have >= o.need ? ' done' : ''}`}>
                  <ToppingIcon kind={o.kind} size={30} />
                  <span className="need-label">{TOPPINGS[o.kind].label}</span>
                  <strong className="num">
                    {o.have}/{o.need}
                  </strong>
                </span>
              ))}
            </div>
          </div>
          <canvas ref={canvas} className="arena-canvas" />
          {phase === 'countdown' && (
            <div className="countdown" key={count}>
              {count > 0 ? count : 'Go!'}
            </div>
          )}
          {phase === 'saving' && <div className="countdown small">Counting up…</div>}
        </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="wrap narrow play-result">
          {result && <Confetti />}
          {result ? (
            <>
              <p className="eyebrow-pill">
                {result.ordersCompleted} of 3 orders · {result.mistakes} {result.mistakes === 1 ? 'mistake' : 'mistakes'}
              </p>
              <h1 className="result-big">
                <CountUp to={result.reward.percent} />% off
              </h1>
              <p className="lead">
                {result.reward.percent >= (config?.topPercent ?? 40)
                  ? 'Flawless. You got the top prize!'
                  : result.ordersCompleted === 3
                    ? 'All three orders done. Nice hands!'
                    : 'Not bad for a busy kitchen. Your discount is saved.'}
              </p>
              <RewardCard reward={result.reward} />
              <div className="btn-row">
                <Link to="/" className="btn btn-primary">
                  Use it now
                </Link>
                <Link to="/account" className="btn btn-outline">
                  My account
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="page-title">Game over</h1>
              <p className="muted">{error || "We couldn't save your result."} Your account page shows your reward.</p>
              <Link to="/account" className="btn btn-primary">
                My account
              </Link>
            </>
          )}
        </div>
      )}
    </section>
  );
}
