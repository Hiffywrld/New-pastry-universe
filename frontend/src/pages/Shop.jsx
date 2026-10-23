import { useRef, useState } from 'react';
import DisplayCase from '../components/DisplayCase.jsx';
import { Announcement, Delivery, Intro, MenuBoard, Ticker } from '../components/Sections.jsx';
import { useMenu } from '../menu/useMenu.js';
import { useCart } from '../state/cart.jsx';

export default function Shop() {
  const { menu, error, reload } = useMenu();
  const { add, setOpen: setCartOpen } = useCart();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState({});
  const caseRef = useRef(null);

  if (error) {
    return (
      <div className="wrap state-box">
        <h1>We can't load the menu right now.</h1>
        <p className="muted">{error.message}</p>
        <button type="button" className="btn btn-primary" onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  const items = menu?.items || [];
  const safeActive = Math.min(active, Math.max(0, items.length - 1));

  const viewItem = (id, sizeKey) => {
    const i = items.findIndex((it) => it.id === id);
    if (i < 0) return;
    if (sizeKey) setPicks((p) => ({ ...p, [id]: { size: sizeKey, choice: undefined } }));
    setActive(i);
    setOpen(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    caseRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <>
      <Announcement text={menu?.store?.shopOpen === false ? "We're not taking orders right now. Check back soon." : menu?.store?.announcement} />
      <Intro />
      {items.length > 0 ? (
        <DisplayCase
          items={items}
          active={safeActive}
          open={open}
          picks={picks}
          caseRef={caseRef}
          onActive={setActive}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          onPick={(id, pick) => setPicks((p) => ({ ...p, [id]: pick }))}
          onAdd={add}
          onViewCart={() => setCartOpen(true)}
        />
      ) : (
        <div className="case case-loading" aria-busy="true" aria-label="Loading the display case" />
      )}
      <Ticker lines={menu?.store?.ticker} />
      {items.length > 0 && <MenuBoard items={items} onView={viewItem} />}
      {menu && <Delivery delivery={menu.delivery} store={menu.store} />}
    </>
  );
}
