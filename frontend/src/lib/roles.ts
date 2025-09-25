// src/lib/roles.ts
import type { User as FirebaseUser, IdTokenResult } from "firebase/auth";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export async function isAdminUser(user: FirebaseUser | null): Promise<boolean> {
  if (!user) return false;

  // 1) Check custom claims
  const tok: IdTokenResult = await user.getIdTokenResult(true);
  const claims: any = tok.claims || {};
  const rolesArr: string[] = Array.isArray(claims.roles) ? claims.roles : [];
  if (claims.role === "admin" || rolesArr.includes("admin")) return true;

  // 2) Fallback to users/{uid}.roles (safe because client cannot edit roles)
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.data() as any;
    if (Array.isArray(data?.roles) && data.roles.includes("admin")) return true;
  } catch {}
  return false;
}