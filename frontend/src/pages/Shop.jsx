import { useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import DisplayCase from '../components/DisplayCase.jsx';
import Spotlight from '../components/Spotlight.jsx';
import { Announcement, Delivery, GamePromo, Intro, MenuBoard, Ticker } from '../components/Sections.jsx';
import { useMenu } from '../menu/useMenu.js';
import { useCart } from '../state/cart.jsx';

export default function Shop() {
  const { menu, error, reload } = useMenu();
  const { add, setOpen: setCartOpen } = useCart();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState({});
  const caseRef = useRef(null);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const items = menu?.items || [];

  // The spotlit treat comes from the address (?treat=…). While it closes, we
  // keep showing it so it can fly back into its card.
  const raw = params.get('treat');
  const treatId = raw && items.some((i) => i.id === raw) ? raw : null;
  const [spot, setSpot] = useState({ id: null, session: 0, last: null });
  if (treatId !== spot.last) {
    setSpot({ id: treatId || spot.id, session: treatId && !spot.last ? spot.session + 1 : spot.session, last: treatId });
  }
  const shownId = treatId || spot.id;

  const openTreat = (item) => setParams({ treat: item.id }, { state: { spot: true } });
  const closeTreat = () => {
    if (location.state?.spot) navigate(-1);
    else setParams({}, { replace: true });
  };
  const switchTreat = (id) => setParams({ treat: id }, { replace: true, state: location.state });

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
      <GamePromo />
      {items.length > 0 && <MenuBoard items={items} liftedId={shownId} onOpen={openTreat} />}
      {menu && <Delivery delivery={menu.delivery} store={menu.store} />}
      {shownId && (
        <Spotlight
          key={spot.session}
          items={items}
          id={shownId}
          closing={!treatId}
          onSwitch={switchTreat}
          onClose={closeTreat}
          onClosed={() => setSpot((s) => ({ ...s, id: null }))}
          onCheckout={() => navigate('/checkout', { replace: true })}
        />
      )}
    </>
  );
}
