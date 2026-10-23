import { useRef, useState } from 'react';
import DisplayCase from '../components/DisplayCase.jsx';
import ProductSheet from '../components/ProductSheet.jsx';
import { canMorph, morph } from '../lib/motion.js';
import { Announcement, Delivery, Intro, MenuBoard, Ticker } from '../components/Sections.jsx';
import { useMenu } from '../menu/useMenu.js';
import { useCart } from '../state/cart.jsx';

export default function Shop() {
  const { menu, error, reload } = useMenu();
  const { add, setOpen: setCartOpen } = useCart();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState({});
  const [sheet, setSheet] = useState(null);
  const caseRef = useRef(null);

  const openSheet = (item, size) => {
    const morphing = canMorph();
    const apply = () => setSheet({ id: item.id, size, morphing });
    if (morphing) morph(apply);
    else apply();
  };
  const closeSheet = (withMorph) => {
    if (withMorph) morph(() => setSheet(null));
    else setSheet(null);
  };

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
      {items.length > 0 && <MenuBoard items={items} openId={sheet?.id} onOpen={(item) => openSheet(item)} />}
      {menu && <Delivery delivery={menu.delivery} store={menu.store} />}
      {sheet && items.find((i) => i.id === sheet.id) && (
        <ProductSheet
          key={sheet.id}
          item={items.find((i) => i.id === sheet.id)}
          initialSize={sheet.size}
          morphing={sheet.morphing}
          onClose={closeSheet}
        />
      )}
    </>
  );
}
