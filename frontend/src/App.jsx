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
import AdminLayout from './admin/AdminLayout.jsx';
import AdminLogin from './admin/AdminLogin.jsx';
import Dashboard from './admin/Dashboard.jsx';
import OrdersBoard from './admin/OrdersBoard.jsx';
import Payments from './admin/Payments.jsx';
import Settings from './admin/Settings.jsx';

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
          <Route path="admin/login" element={<AdminLogin />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<OrdersBoard />} />
            <Route path="payments" element={<Payments />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </MenuProvider>
    </CartProvider>
  );
}
