// Small helpers shared by the display case and the treat spotlight.

export function choiceLegend(choices) {
  const labels = choices.map((c) => c.label.toLowerCase()).join(' ');
  if (/plain|peppered/.test(labels)) return 'Flavour';
  if (/note/.test(labels)) return 'Gift note';
  return 'Topping';
}

// Bigger sizes sit bigger on the shelf.
export function sizeScale(item, sizeKey) {
  const n = item.sizes.length;
  if (n < 2) return 1;
  const i = Math.max(0, item.sizes.findIndex((s) => s.key === sizeKey));
  return 0.74 + 0.26 * (i / (n - 1));
}

export const hasChoices = (size) => Boolean(size && (size.choices.length > 1 || size.choices[0]?.label));
