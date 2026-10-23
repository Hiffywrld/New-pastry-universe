import { useEffect } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import CartDrawer from './components/CartDrawer.jsx';
import { Footer, Header } from './components/Sections.jsx';
import { MenuProvider, useMenu } from './menu/useMenu.js';
import { CartProvider } from './state/cart.jsx';
import { startHeartbeat, track } from './lib/analytics.js';
import Shop from './pages/Shop.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderPage from './pages/OrderPage.jsx';
import TrackLookup from './pages/TrackLookup.jsx';

function ShopLayout() {
  const location = useLocation();
  const { menu } = useMenu();

  useEffect(() => {
    startHeartbeat();
  }, []);

  useEffect(() => {
    track('page_view');
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Header simple={location.pathname !== '/'} />
      <main>
        <Outlet />
      </main>
      <Footer store={menu?.store} />
      <CartDrawer />
    </>
  );
}

export default function App() {
  return (
    <CartProvider>
      <MenuProvider>
        <Routes>
          <Route element={<ShopLayout />}>
            <Route index element={<Shop />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order/:token" element={<OrderPage />} />
            <Route path="track" element={<TrackLookup />} />
            <Route path="*" element={<Shop />} />
          </Route>
        </Routes>
      </MenuProvider>
    </CartProvider>
  );
}
