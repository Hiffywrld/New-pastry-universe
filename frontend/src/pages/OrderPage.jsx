import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api/index.js';
import { formatNaira } from '../lib/format.js';

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      window.prompt?.('Copy this:', text);
    }
  };
  return (
    <button type="button" className="copy-btn" onClick={copy} aria-label={`Copy ${label}`}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const time = (iso) =>
  iso ? new Date(iso).toLocaleString('en-NG', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const longDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });

function Headline({ order }) {
  const pickup = order.fulfilment === 'PICKUP';
  const map = {
    AWAITING_PAYMENT: [`Transfer ${formatNaira(order.total)} to confirm your order`, 'Then upload your receipt below and we start baking.'],
    PAYMENT_REVIEW: ["We're checking your payment", 'This usually takes a few minutes during opening hours. This page updates by itself.'],
    CONFIRMED: ['Payment received. Thank you!', `Your order is booked for ${longDate(order.deliveryDate)}.`],
    BAKING: ['Your order is in the oven', 'Fresh and warm, the way it should be.'],
    READY: [pickup ? 'Ready for pickup' : 'Packed and ready', pickup ? 'Come through any time in your slot.' : 'It leaves with our rider soon.'],
    OUT_FOR_DELIVERY: ['On its way to you', 'Keep your phone close. The rider may call when nearby.'],
    COMPLETED: [pickup ? 'Collected. Enjoy!' : 'Delivered. Enjoy!', 'Thanks for ordering from Pastry Universe.'],
    CANCELLED: ['This order was cancelled', 'Message us on WhatsApp if this is a mistake.'],
  };
  const [title, sub] = map[order.status] || [order.statusLabel, ''];
  return (
    <div className="order-headline">
      <h1>{title}</h1>
      <p className="muted lead">{sub}</p>
    </div>
  );
}

function PaymentCard({ order, onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.uploadReceipt(order.token, file);
      setFile(null);
      onUploaded(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const waLink = `https://wa.me/${order.whatsapp}?text=${encodeURIComponent(`Hi Pastry Universe, I'm paying for order ${order.code}.`)}`;

  return (
    <section className="pay-card" aria-labelledby="pay-title">
      <h2 id="pay-title">Pay by bank transfer</h2>
      {order.rejectedReason && (
        <p className="notice notice-warn" role="alert">
          {order.rejectedReason}
        </p>
      )}
      {order.bank ? (
        <dl className="bank">
          <div>
            <dt>Amount</dt>
            <dd className="bank-amount num">
              {formatNaira(order.total)} <CopyButton text={String(order.total)} label="amount" />
            </dd>
          </div>
          <div>
            <dt>Bank</dt>
            <dd>{order.bank.bankName}</dd>
          </div>
          <div>
            <dt>Account number</dt>
            <dd className="num big">
              {order.bank.accountNumber} <CopyButton text={order.bank.accountNumber} label="account number" />
            </dd>
          </div>
          <div>
            <dt>Account name</dt>
            <dd>{order.bank.accountName}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>
              <strong>{order.code}</strong> <CopyButton text={order.code} label="order code" />
              <span className="muted small block">Add this to the transfer so we can match your payment.</span>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="notice">
          We'll send our account details on WhatsApp.{' '}
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            Message us
          </a>{' '}
          with your order code <strong>{order.code}</strong>.
        </p>
      )}

      <div className="upload">
        <p className="upload-title">{order.receiptUploaded ? 'Upload another receipt' : 'Upload your receipt'}</p>
        <button type="button" className={`dropzone${file ? ' has-file' : ''}`} onClick={() => input.current?.click()}>
          {preview ? <img src={preview} alt="Your receipt" /> : null}
          <span>{file ? file.name : 'Tap to choose a screenshot or PDF'}</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => {
            setError('');
            setFile(e.target.files?.[0] || null);
          }}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary btn-block" disabled={!file || busy} onClick={upload}>
          {busy ? 'Uploading…' : 'Send receipt'}
        </button>
      </div>
    </section>
  );
}

export default function OrderPage() {
  const { token } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState(false);
  const lastStatus = useRef(null);

  useEffect(() => {
    let stop = () => {};
    api
      .track(token)
      .then((o) => {
        setOrder(o);
        lastStatus.current = o.status;
        stop = api.trackStream(token, {
          open: () => setLive(true),
          error: () => setLive(false),
          order: (next) => {
            if (next.status !== lastStatus.current) {
              setFlash(true);
              setTimeout(() => setFlash(false), 1600);
            }
            lastStatus.current = next.status;
            setOrder(next);
          },
        });
      })
      .catch((err) => setError(err.message));
    return () => stop();
  }, [token]);

  if (error) {
    return (
      <section className="wrap narrow page-pad state-box">
        <h1 className="page-title">We couldn't find that order</h1>
        <p className="muted">{error}</p>
        <Link to="/track" className="btn btn-primary">
          Find it with your order code
        </Link>
      </section>
    );
  }
  if (!order) return <div className="wrap page-pad muted">Loading your order…</div>;

  const showPayment = order.status === 'AWAITING_PAYMENT' || order.status === 'PAYMENT_REVIEW';
  const waHelp = `https://wa.me/${order.whatsapp}?text=${encodeURIComponent(`Hi Pastry Universe, I have a question about order ${order.code}.`)}`;

  return (
    <section className="wrap page-pad order-page">
      <div className="order-top">
        <p className="order-code">
          Order <strong>{order.code}</strong>
          <span className={`live-pill${live ? ' is-live' : ''}`}>{live ? 'Live' : 'Connecting'}</span>
        </p>
        {location.state?.justPlaced && order.status === 'AWAITING_PAYMENT' && (
          <p className="notice notice-good">Order placed, {order.customerName}! Save this page to check on your order any time.</p>
        )}
        <Headline order={order} />
      </div>

      <div className="order-grid">
        <div className="order-main">
          {showPayment && order.status === 'PAYMENT_REVIEW' && (
            <div className="checking">
              <span className="spinner" aria-hidden="true" />
              <p>Receipt received. We'll confirm shortly.</p>
            </div>
          )}
          {showPayment && <PaymentCard order={order} onUploaded={setOrder} />}

          <section className={`timeline-card${flash ? ' flash' : ''}`} aria-label="Order progress">
            <h2>Progress</h2>
            {order.status === 'CANCELLED' ? (
              <p className="muted">This order was cancelled.</p>
            ) : (
              <ol className="timeline">
                {order.timeline.map((s, i) => {
                  const current = s.done && !order.timeline[i + 1]?.done;
                  return (
                    <li key={s.status} className={`${s.done ? 'is-done' : ''}${current ? ' is-current' : ''}`}>
                      <span className="tl-dot" aria-hidden="true" />
                      <span className="tl-label">{s.label}</span>
                      {s.at && <span className="tl-time muted small">{time(s.at)}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="order-side">
          <div className="summary-card">
            <h2>Summary</h2>
            <ul className="summary-lines">
              {order.items.map((l, i) => (
                <li key={i}>
                  <span>
                    <span className="num">{l.quantity}×</span> {l.name}
                    <span className="muted small block">{[l.size !== 'Regular' && l.size, l.option].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="num">{formatNaira(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="summary-totals">
              <div className="row-between">
                <span>Subtotal</span>
                <span className="num">{formatNaira(order.subtotal)}</span>
              </div>
              <div className="row-between">
                <span>{order.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'}</span>
                <span className="num">{order.deliveryFee ? formatNaira(order.deliveryFee) : 'Free'}</span>
              </div>
              <div className="row-between total">
                <span>Total</span>
                <span className="num">{formatNaira(order.total)}</span>
              </div>
            </div>
            <dl className="mini-dl">
              <div>
                <dt>{order.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup'}</dt>
                <dd>
                  {longDate(order.deliveryDate)}, {order.timeSlot}
                </dd>
              </div>
              {order.fulfilment === 'DELIVERY' ? (
                <div>
                  <dt>Address</dt>
                  <dd>
                    {order.address}
                    {order.landmark ? ` (${order.landmark})` : ''}
                    <span className="muted small block">{order.zoneName}</span>
                  </dd>
                </div>
              ) : (
                <div>
                  <dt>Pickup point</dt>
                  <dd>{order.pickupAddress}</dd>
                </div>
              )}
              {order.gift && (
                <div>
                  <dt>Gift for</dt>
                  <dd>
                    {order.gift.recipientName}
                    {order.gift.note && <span className="muted small block">“{order.gift.note}”</span>}
                  </dd>
                </div>
              )}
            </dl>
            <a className="btn btn-outline btn-block" href={waHelp} target="_blank" rel="noopener noreferrer">
              Questions? WhatsApp us
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
