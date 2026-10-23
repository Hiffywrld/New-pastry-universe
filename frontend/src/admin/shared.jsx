import { formatNaira } from '../lib/format.js';

export const STATUS = {
  AWAITING_PAYMENT: { label: 'Not paid yet', tone: 'muted' },
  PAYMENT_REVIEW: { label: 'Check payment', tone: 'alert' },
  CONFIRMED: { label: 'To bake', tone: 'info' },
  BAKING: { label: 'In the oven', tone: 'warm' },
  READY: { label: 'Ready', tone: 'good' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'good' },
  COMPLETED: { label: 'Done', tone: 'done' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export function StatusChip({ status, fulfilment }) {
  const s = STATUS[status] || { label: status, tone: 'muted' };
  let label = s.label;
  if (status === 'READY' && fulfilment === 'PICKUP') label = 'Ready for pickup';
  if (status === 'COMPLETED') label = fulfilment === 'PICKUP' ? 'Collected' : 'Delivered';
  return <span className={`chip-status tone-${s.tone}`}>{label}</span>;
}

/** The next step an order normally moves to. */
export function nextStatus(status, fulfilment) {
  const flow = ['CONFIRMED', 'BAKING', 'READY', ...(fulfilment === 'DELIVERY' ? ['OUT_FOR_DELIVERY'] : []), 'COMPLETED'];
  const i = flow.indexOf(status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

export function nextLabel(status, fulfilment) {
  const n = nextStatus(status, fulfilment);
  return {
    BAKING: 'Start baking',
    READY: 'Mark ready',
    OUT_FOR_DELIVERY: 'Send out',
    COMPLETED: fulfilment === 'PICKUP' ? 'Mark collected' : 'Mark delivered',
  }[n];
}

export const shortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
};

export function compactNaira(n) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1000) return `₦${Math.round(n / 100) / 10}K`.replace('.0K', 'K');
  return formatNaira(n);
}

export function whatsappLink(phone, text) {
  const digits = (phone || '').replace(/\D/g, '').replace(/^0/, '234');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function customerMessage(order) {
  const first = order.customerName.split(' ')[0];
  const code = order.code;
  const pickup = order.fulfilment === 'PICKUP';
  return {
    AWAITING_PAYMENT: `Hi ${first}, thanks for your Pastry Universe order ${code}. Please transfer ${formatNaira(order.total)} and upload your receipt on your order page so we can start baking.`,
    PAYMENT_REVIEW: `Hi ${first}, we've got your receipt for order ${code}. Confirming it now.`,
    CONFIRMED: `Hi ${first}, payment received for order ${code}. Thank you! We'll have it ready for ${shortDate(order.deliveryDate).toLowerCase()}.`,
    BAKING: `Hi ${first}, your order ${code} is in the oven now.`,
    READY: pickup ? `Hi ${first}, your order ${code} is ready for pickup.` : `Hi ${first}, your order ${code} is packed and leaving with our rider soon.`,
    OUT_FOR_DELIVERY: `Hi ${first}, your order ${code} is on its way to you.`,
    COMPLETED: `Hi ${first}, thank you for ordering from Pastry Universe! We hope you enjoy every bite.`,
    CANCELLED: `Hi ${first}, your order ${code} has been cancelled. Message us if you have any questions.`,
  }[order.status];
}
