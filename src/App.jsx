import { useRef, useState } from 'react';
import DisplayCase from './components/DisplayCase.jsx';
import { Delivery, Footer, Header, Intro, MenuBoard, Ticker } from './components/Sections.jsx';
import { useMenu } from './menu/useMenu.js';

export default function App() {
  const menu = useMenu();
  const items = menu.items;
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState({});
  const caseRef = useRef(null);

  const safeActive = Math.min(active, Math.max(0, items.length - 1));

  const viewItem = (id) => {
    const i = items.findIndex((it) => it.id === id);
    if (i < 0) return;
    setActive(i);
    setOpen(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    caseRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <>
      <Header />
      <main>
        <Intro />
        {items.length > 0 && (
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
          />
        )}
        <Ticker />
        <MenuBoard items={items} onView={viewItem} />
        <Delivery delivery={menu.delivery} />
      </main>
      <Footer />
    </>
  );
}
