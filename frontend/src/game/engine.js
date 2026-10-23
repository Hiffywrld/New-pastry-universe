// Topping Rush: the game loop, drawn on a canvas.
//
// Three orders in 45 seconds. Each order card asks for toppings (e.g. 3
// raisins, 2 almonds). Toppings are tossed up from the bottom of the screen
// and across it; tap only what the order needs. A wrong topping costs 3
// seconds, a burnt bit costs 5. Every order is faster and nastier.

export const GAME_SECONDS = 45;

export const TOPPINGS = {
  raisin: { label: 'Raisins' },
  almond: { label: 'Almonds' },
  choc: { label: 'Choc chips' },
  coconut: { label: 'Coconut' },
  banana: { label: 'Banana' },
};
const KINDS = Object.keys(TOPPINGS);

const ROUNDS = [
  { kinds: 2, total: 5, every: 0.52, speed: 1, burnt: 0.16, decoy: 0.36 },
  { kinds: 3, total: 7, every: 0.42, speed: 1.18, burnt: 0.2, decoy: 0.4 },
  { kinds: 3, total: 9, every: 0.33, speed: 1.38, burnt: 0.27, decoy: 0.42 },
];

// Small, fast, seeded random numbers so a game can be replayed from its seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Drawing --------------------------------------------------------------------

export function drawTopping(ctx, kind, r) {
  ctx.save();
  switch (kind) {
    case 'raisin': {
      ctx.fillStyle = '#3b1f2b';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.72, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.1);
      ctx.quadraticCurveTo(0, -r * 0.45, r * 0.45, -r * 0.05);
      ctx.moveTo(-r * 0.35, r * 0.25);
      ctx.quadraticCurveTo(0.05 * r, 0, r * 0.4, r * 0.3);
      ctx.stroke();
      break;
    }
    case 'almond': {
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, '#e2b07a');
      g.addColorStop(1, '#a8673a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.85, -r * 0.5, r * 0.7, r * 0.75, 0, r);
      ctx.bezierCurveTo(-r * 0.7, r * 0.75, -r * 0.85, -r * 0.5, 0, -r);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,45,15,0.45)';
      ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.12, 0, 0, r * 0.7);
      ctx.stroke();
      break;
    }
    case 'choc': {
      ctx.fillStyle = '#3d2314';
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.25, -r * 0.4, r, r * 0.1, r * 0.85, r * 0.55);
      ctx.quadraticCurveTo(0, r * 1.05, -r * 0.85, r * 0.55);
      ctx.bezierCurveTo(-r, r * 0.1, -r * 0.25, -r * 0.4, 0, -r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, 0, r * 0.15, r * 0.3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'coconut': {
      ctx.fillStyle = '#fbf6ec';
      ctx.strokeStyle = '#c9b48f';
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.2);
      ctx.quadraticCurveTo(0, -r * 1.05, r, -r * 0.35);
      ctx.lineTo(r * 0.75, r * 0.25);
      ctx.quadraticCurveTo(0, -r * 0.35, -r * 0.8, r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'banana': {
      ctx.fillStyle = '#f6e3a1';
      ctx.strokeStyle = '#d9b75a';
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8a6a2a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'burnt': {
      ctx.fillStyle = '#141111';
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const rr = r * (0.75 + (i % 3) * 0.12);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8501c';
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 0.15, r * 0.12, 0, Math.PI * 2);
      ctx.arc(-r * 0.3, r * 0.25, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The game ---------------------------------------------------------------------

/**
 * Creates a game on a canvas. Calls onState with HUD info as it changes and
 * onEnd({ ordersCompleted, timeLeft, mistakes }) when it's over.
 */
export function createGame(canvas, { seed, onState, onEnd }) {
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(seed || 1);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  let W = 0;
  let H = 0;
  let dpr = 1;

  const items = [];
  const flying = [];
  const pops = [];
  const onLoaf = [];
  let round = 0;
  let order = null;
  let timeLeft = GAME_SECONDS;
  let mistakes = 0;
  let completed = 0;
  let spawnIn = 0.4;
  let pauseFor = 0;
  let shake = 0;
  let flash = 0;
  let last = 0;
  let raf = 0;
  let over = false;
  let started = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function newOrder() {
    const spec = ROUNDS[round];
    const kinds = [...KINDS].sort(() => rand() - 0.5).slice(0, spec.kinds);
    const need = Object.fromEntries(kinds.map((k) => [k, 1]));
    for (let left = spec.total - spec.kinds; left > 0; left--) need[pick(kinds)]++;
    order = { need, have: Object.fromEntries(kinds.map((k) => [k, 0])) };
    onLoaf.length = 0;
  }

  const remaining = () => Object.keys(order.need).reduce((s, k) => s + (order.need[k] - order.have[k]), 0);

  function emit() {
    onState?.({
      timeLeft,
      round: Math.min(round + 1, 3),
      completed,
      mistakes,
      order: order && Object.keys(order.need).map((k) => ({ kind: k, need: order.need[k], have: order.have[k] })),
    });
  }

  function spawn() {
    const spec = ROUNDS[round];
    const unmet = Object.keys(order.need).filter((k) => order.have[k] < order.need[k]);
    const roll = rand();
    let kind;
    if (roll < spec.burnt) kind = 'burnt';
    else if (roll < spec.burnt + spec.decoy || !unmet.length) kind = pick(KINDS.filter((k) => !unmet.includes(k)).concat(KINDS));
    else kind = pick(unmet);
    const r = Math.max(17, Math.min(26, W * 0.055));
    const s = spec.speed;
    if (rand() < 0.68) {
      // Tossed up from the bottom, like a juggler.
      const x = W * (0.12 + rand() * 0.76);
      const toward = (W / 2 - x) / W;
      items.push({ kind, r, x, y: H + r, vx: (toward * 220 + (rand() - 0.5) * 140) * s, vy: -(H * (0.95 + rand() * 0.35)) * Math.sqrt(s), g: H * 1.15 * s, rot: rand() * 6, vr: (rand() - 0.5) * 7 });
    } else {
      // Zipping across the middle.
      const fromLeft = rand() < 0.5;
      items.push({ kind, r, x: fromLeft ? -r : W + r, y: H * (0.25 + rand() * 0.38), vx: (fromLeft ? 1 : -1) * W * (0.42 + rand() * 0.3) * s, vy: (rand() - 0.5) * 50, g: 0, wobble: rand() * 6, rot: 0, vr: (rand() - 0.5) * 9 });
    }
  }

  const loafBox = () => {
    const w = Math.min(W * 0.62, 260);
    const h = Math.min(H * 0.11, 70);
    return { x: (W - w) / 2, y: H - h - 18, w, h };
  };

  function hit(px, py) {
    if (!started || over || pauseFor > 0) return;
    let best = null;
    let bestD = Infinity;
    for (const it of items) {
      const d = Math.hypot(it.x - px, it.y - py);
      if (d < it.r + 16 && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    if (!best) return;
    items.splice(items.indexOf(best), 1);
    const needed = order.need[best.kind] != null && order.have[best.kind] < order.need[best.kind];
    if (needed) {
      order.have[best.kind]++;
      const lb = loafBox();
      const tx = lb.x + 18 + rand() * (lb.w - 36);
      const ty = lb.y + 10 + rand() * (lb.h * 0.45);
      flying.push({ kind: best.kind, r: best.r, x: best.x, y: best.y, sx: best.x, sy: best.y, tx, ty, t: 0 });
      pops.push({ text: '+1', x: best.x, y: best.y, t: 0, good: true });
      navigator.vibrate?.(8);
      if (remaining() === 0) {
        completed++;
        pops.push({ text: completed === 3 ? 'All done!' : 'Order up!', x: W / 2, y: H * 0.42, t: 0, big: true, good: true });
        if (completed === 3) {
          finish();
        } else {
          round++;
          pauseFor = 0.9;
          items.length = 0;
          setTimeout(() => {
            if (!over) {
              newOrder();
              emit();
            }
          }, 650);
        }
      }
    } else {
      const penalty = best.kind === 'burnt' ? 5 : 3;
      timeLeft = Math.max(0, timeLeft - penalty);
      mistakes++;
      shake = 0.35;
      flash = 0.3;
      pops.push({ text: `−${penalty}s`, x: best.x, y: best.y, t: 0, good: false });
      navigator.vibrate?.([30, 40, 30]);
    }
    emit();
  }

  function finish() {
    if (over) return;
    over = true;
    emit();
    setTimeout(() => onEnd?.({ ordersCompleted: completed, timeLeft: Math.floor(timeLeft), mistakes }), 900);
  }

  function update(dt) {
    if (pauseFor > 0) pauseFor -= dt;
    if (!over && pauseFor <= 0) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        finish();
      }
      spawnIn -= dt;
      if (spawnIn <= 0 && order) {
        spawn();
        spawnIn = ROUNDS[round].every * (0.75 + rand() * 0.5);
      }
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.vy += it.g * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt + (it.wobble != null ? Math.sin((it.wobble += dt * 6)) * 0.6 : 0);
      it.rot += it.vr * dt;
      if (it.y > H + it.r * 2 + 10 || it.x < -it.r * 3 || it.x > W + it.r * 3) items.splice(i, 1);
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt / 0.35;
      const t = Math.min(1, f.t);
      const e = 1 - (1 - t) ** 3;
      f.x = f.sx + (f.tx - f.sx) * e;
      f.y = f.sy + (f.ty - f.sy) * e - Math.sin(t * Math.PI) * 60;
      if (t >= 1) {
        onLoaf.push({ kind: f.kind, x: f.tx, y: f.ty, r: f.r * 0.62, rot: rand() * 6 });
        flying.splice(i, 1);
      }
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].t += dt;
      if (pops[i].t > (pops[i].big ? 1.1 : 0.7)) pops.splice(i, 1);
    }
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);

    // The loaf, waiting for its toppings.
    const lb = loafBox();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(W / 2, lb.y + lb.h + 8, lb.w * 0.55, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const foil = ctx.createLinearGradient(0, lb.y + lb.h * 0.35, 0, lb.y + lb.h + 6);
    foil.addColorStop(0, '#f1f1f1');
    foil.addColorStop(0.5, '#b9bcc0');
    foil.addColorStop(1, '#e6e7e9');
    ctx.fillStyle = foil;
    roundRect(ctx, lb.x - 8, lb.y + lb.h * 0.38, lb.w + 16, lb.h * 0.7, 8);
    ctx.fill();
    const bread = ctx.createLinearGradient(0, lb.y, 0, lb.y + lb.h);
    bread.addColorStop(0, '#8c5426');
    bread.addColorStop(1, '#5a3214');
    ctx.fillStyle = bread;
    roundRect(ctx, lb.x, lb.y, lb.w, lb.h * 0.82, lb.h * 0.35);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, lb.x + 10, lb.y + 5, lb.w * 0.5, 8, 4);
    ctx.fill();
    for (const t of onLoaf) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      drawTopping(ctx, t.kind, t.r);
      ctx.restore();
    }

    for (const it of items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      drawTopping(ctx, it.kind, it.r);
      ctx.restore();
    }
    for (const f of flying) {
      ctx.save();
      ctx.translate(f.x, f.y);
      drawTopping(ctx, f.kind, f.r * (1 - Math.min(1, f.t) * 0.35));
      ctx.restore();
    }
    for (const p of pops) {
      const life = p.big ? 1.1 : 0.7;
      ctx.globalAlpha = Math.max(0, 1 - p.t / life);
      ctx.fillStyle = p.good ? '#1f7a4d' : '#d43d2a';
      ctx.font = `700 ${p.big ? 34 : 20}px Fredoka, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y - p.t * (p.big ? 30 : 50));
      ctx.globalAlpha = 1;
    }
    if (flash > 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgba(212, 61, 42, ${flash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    if (started) update(dt);
    draw();
    raf = requestAnimationFrame(frame);
    if (started && !over && Math.floor(timeLeft * 4) !== Math.floor((timeLeft + dt) * 4)) emit();
  }

  const onPointer = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    hit(e.clientX - rect.left, e.clientY - rect.top);
  };

  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointer);
  newOrder();
  emit();
  raf = requestAnimationFrame(frame);

  return {
    start() {
      started = true;
      last = 0;
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointer);
    },
    /** Ends the game now (used when the player leaves). */
    quit() {
      finish();
    },
  };
}
