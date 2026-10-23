import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminLayout from './AdminLayout.jsx';
import AdminLogin from './AdminLogin.jsx';
import Dashboard from './Dashboard.jsx';
import OrdersBoard from './OrdersBoard.jsx';
import Payments from './Payments.jsx';
import Settings from './Settings.jsx';
import Plan from './Plan.jsx';
import Customers from './Customers.jsx';
import RiderPage from './RiderPage.jsx';
import { PrintDay, PrintLabels, PrintReceipt } from './Print.jsx';
import '../styles.css';
import './admin.css';

// The kitchen is its own app at /admin, separate from the shop.
const router = import.meta.env.VITE_MOCK ? <MemoryRouter /> : <BrowserRouter basename="/admin" />;
const Router = router.type;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router {...router.props}>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route path="rider/:token" element={<RiderPage />} />
        <Route path="print/day" element={<PrintDay />} />
        <Route path="print/labels" element={<PrintLabels />} />
        <Route path="print/receipt/:id" element={<PrintReceipt />} />
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersBoard />} />
          <Route path="plan" element={<Plan />} />
          <Route path="customers" element={<Customers />} />
          <Route path="payments" element={<Payments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </Router>
  </StrictMode>,
);
