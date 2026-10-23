import qrcode from 'qrcode-generator';
import { api } from '../api/index.js';

/** The shop's public address, for tracking links and QR codes. */
export const shopUrl = () => (import.meta.env.VITE_SHOP_URL || window.location.origin).replace(/\/$/, '');

export const trackingUrl = (token) => `${shopUrl()}/order/${token}`;

/** Where a rider opens their page. The kitchen app lives at /admin. */
export const riderUrl = (token) => `${window.location.origin}/admin/rider/${token}`;

/** Today in Lagos as YYYY-MM-DD. */
export const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const at = (iso) => new Date(iso + 'T12:00:00Z');

export const longDate = (iso) => at(iso).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export const dayParts = (iso) => {
  const d = at(iso);
  return {
    weekday: d.toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'UTC' }),
    day: d.getUTCDate(),
    month: d.toLocaleDateString('en-NG', { month: 'short', timeZone: 'UTC' }),
  };
};

/** Size and topping in one short line, skipping "Regular". */
export const variantText = (size, option) => [size !== 'Regular' && size, option].filter(Boolean).join(' · ');

/** A QR code as inline SVG. */
export function QR({ value, size = 96, label }) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  return <span className="qr" role="img" aria-label={label || 'QR code'} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export const isDemo = () => api.mode === 'demo';
