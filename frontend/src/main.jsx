import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

// The clickable preview can't change the page address, so it keeps its
// place in memory. The real site uses normal links (/checkout, /admin).
const Router = import.meta.env.VITE_MOCK ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
