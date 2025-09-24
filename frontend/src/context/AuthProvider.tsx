import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut, getIdToken } from "firebase/auth";
import type { User } from "firebase/auth";
import { isAllowedEmail } from "../lib/auth-domain";

type Ctx = { user: User | null; idToken: string | null; loading: boolean };
const AuthCtx = createContext<Ctx>({ user: null, idToken: null, loading: true });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]   = useState<User | null>(null);
  const [idToken, setTok] = useState<string | null>(null);
  const [loading, setL]   = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u && !isAllowedEmail(u.email)) {
        // Soft client-side restriction
        alert("Please use your @umass.edu email.");
        await signOut(auth);
        setUser(null); setTok(null); setL(false);
        return;
      }
      setUser(u);
      setTok(u ? await getIdToken(u, /*forceRefresh*/ true) : null);
      setL(false);
    });
  }, []);

  return <AuthCtx.Provider value={{ user, idToken, loading }}>{children}</AuthCtx.Provider>;
}
