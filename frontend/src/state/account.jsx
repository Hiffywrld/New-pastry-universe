import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';

const AccountContext = createContext(null);

// The signed-in shopper (Google sign-in), their welcome reward and orders.
export function AccountProvider({ children }) {
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState(api.account.hasToken() ? 'loading' : 'out');
  const [config, setConfig] = useState(null);

  const refresh = useCallback(
    () =>
      api.account
        .me()
        .then((m) => {
          setMe(m);
          setStatus('in');
          return m;
        })
        .catch(() => {
          api.account.signOut();
          setMe(null);
          setStatus('out');
          return null;
        }),
    [],
  );

  useEffect(() => {
    api.account.config().then(setConfig).catch(() => setConfig({ googleClientId: '', gameEnabled: false }));
    if (api.account.hasToken()) refresh();
  }, [refresh]);

  const signInWith = useCallback(async (credential) => {
    const m = credential === 'demo' ? await api.account.demoSignIn() : await api.account.signInWithGoogle(credential);
    setMe(m);
    setStatus('in');
    return m;
  }, []);

  const signOut = useCallback(() => {
    api.account.signOut();
    setMe(null);
    setStatus('out');
  }, []);

  const value = useMemo(() => {
    const r = me?.reward;
    const usableReward = r && r.percent > 0 && !r.redeemed && !r.expired ? r : null;
    return { me, status, config, refresh, signInWith, signOut, usableReward };
  }, [me, status, config, refresh, signInWith, signOut]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export const useAccount = () => useContext(AccountContext);
