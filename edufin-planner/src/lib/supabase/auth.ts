"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { authRedirectUrl, getSupabase, supabaseEnabled } from "./client";

export interface AuthState {
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  email: string | null;
  role: "user" | "admin" | "advisor" | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    enabled: supabaseEnabled,
    loading: supabaseEnabled,
    session: null,
    email: null,
    role: null,
  });
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    const load = async (session: Session | null) => {
      let role: AuthState["role"] = null;
      if (session) {
        const { data } = await sb.from("users").select("role").eq("id", session.user.id).maybeSingle();
        role = (data?.role as AuthState["role"]) ?? "user";
      }
      if (active) setState({ enabled: true, loading: false, session, email: session?.user.email ?? null, role });
    };
    sb.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => void load(session));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}

export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: authRedirectUrl() } });
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } });
  if (error) throw error;
}

export async function sendMagicLink(email: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectUrl() } });
  if (error) throw error;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}
