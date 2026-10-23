import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useCart } from '../state/cart.jsx';

const MenuContext = createContext(null);

// Loads the menu once and shares it with every page.
export function MenuProvider({ children }) {
  const [state, setState] = useState({ menu: null, error: null });
  const { sync } = useCart();

  const load = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    api
      .menu()
      .then((menu) => {
        setState({ menu, error: null });
        sync(menu);
      })
      .catch((error) => setState({ menu: null, error }));
  }, [sync]);

  useEffect(() => {
    load();
  }, [load]);

  return createElement(MenuContext.Provider, { value: { ...state, reload: load } }, children);
}

export const useMenu = () => useContext(MenuContext);
