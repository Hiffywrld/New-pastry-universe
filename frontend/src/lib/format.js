const naira = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

export const formatNaira = (n) => (n == null ? '' : `₦${naira.format(n)}`);

export function formatRange(min, max) {
  if (min == null) return '';
  if (max == null || max === min) return formatNaira(min);
  return `${formatNaira(min)} – ${formatNaira(max)}`;
}

// Short form for the round price stickers: ₦2k, ₦18.5k
export function formatShort(n) {
  if (n == null) return '';
  if (n < 1000) return `₦${n}`;
  const k = n / 1000;
  return `₦${Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, '')}k`;
}
