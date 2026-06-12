/**
 * Oturum durumu. supabase-js'in onAuthStateChange akisini React context'e tasir;
 * Expo Router'daki korumali rotalar (Stack.Protected) bu durumdan beslenir.
 */

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabase";

type AuthState = {
  session: Session | null;
  /** Secure Store'dan ilk oturum okumasi tamamlandi mi */
  isLoading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, isLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, isLoading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, isLoading: false });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, isLoading: false });
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
