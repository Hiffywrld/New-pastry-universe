import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { track } from '../lib/analytics.js';

const CartContext = createContext(null);
const KEY = 'pu-cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// A cart line: { variantId, quantity, slug, name, size, option, price }
export function CartProvider({ children }) {
  const [lines, setLines] = useState(loadCart);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines]);

  const add = useCallback((line, quantity = 1) => {
    setLines((cur) => {
      const found = cur.find((l) => l.variantId === line.variantId);
      if (found) return cur.map((l) => (l.variantId === line.variantId ? { ...l, quantity: Math.min(50, l.quantity + quantity) } : l));
      return [...cur, { ...line, quantity }];
    });
    setBump((b) => b + 1);
    track('add_to_cart', { product: line.slug });
  }, []);

  const setQuantity = useCallback((variantId, quantity) => {
    setLines((cur) =>
      quantity <= 0 ? cur.filter((l) => l.variantId !== variantId) : cur.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(50, quantity) } : l)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  // Drop lines whose variant disappeared from the menu, and refresh prices.
  const sync = useCallback((menu) => {
    const index = new Map();
    menu.items.forEach((item) => item.sizes.forEach((s) => s.choices.forEach((c) => index.set(c.variantId, c))));
    setLines((cur) => {
      const next = cur.filter((l) => index.has(l.variantId)).map((l) => ({ ...l, price: index.get(l.variantId).price }));
      return next.length === cur.length && next.every((l, i) => l.price === cur[i].price) ? cur : next;
    });
  }, []);

  const value = useMemo(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.price, 0);
    return { lines, count, subtotal, open, setOpen, add, setQuantity, clear, sync, bump };
  }, [lines, open, add, setQuantity, clear, sync, bump]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

export function lineLabel(line) {
  return [line.size !== 'Regular' ? line.size : null, line.option || null].filter(Boolean).join(' · ');
}
