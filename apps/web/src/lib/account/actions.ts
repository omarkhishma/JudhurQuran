"use client";

import { deleteLocalData } from "@/lib/localData";
import { type Account, authFetch, deviceName, useAccount } from "./store";

/**
 * Signing in and out (PLAN P6.1, D3): a link by e-mail, or Google and Apple where configured. Nothing here sets a
 * cookie: the session the API returns is kept with the account (lib/account/store) and sent as a bearer header.
 */
export type Providers = { email: boolean; google: boolean; apple: boolean; link_minutes?: number };
export type Provider = "google" | "apple";

export async function getProviders(): Promise<Providers> {
  const r = await fetch("/api/v1/auth/providers");
  if (!r.ok) return { email: false, google: false, apple: false };
  return (await r.json()) as Providers;
}

/** The answer never says whether the address has an account: "sent" is all a reader learns. */
export async function requestLink(email: string, returnTo: string, locale: string): Promise<"sent" | "invalid" | "unavailable" | "failed"> {
  try {
    const r = await fetch("/api/v1/auth/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, return_to: returnTo, locale }) });
    if (r.status === 202) return "sent";
    if (r.status === 422) return "invalid";
    if (r.status === 503) return "unavailable";
    return "failed";
  } catch {
    return "failed";
  }
}

type SignedIn = { session: string; user: Account; return_to: string };

/** A link from the e-mail, exchanged once for a session on this device. Returns where the reader was going. */
export async function verifyLink(token: string): Promise<string | null> {
  const r = await fetch("/api/v1/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, device: deviceName() }) });
  if (!r.ok) return null;
  const out = (await r.json()) as SignedIn;
  useAccount.getState().signIn(out.session, out.user);
  return out.return_to;
}

// ─── Google and Apple: the authorization code with PKCE, exchanged by the API ───

const OIDC_KEY = "jadhr-oidc";
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

/** Where the provider returns: Google to our page; Apple posts its answer, so to a handler that passes it on. */
export const redirectUri = (provider: Provider) => `${window.location.origin}${provider === "apple" ? "/api/auth/apple" : "/auth/oidc/google"}`;

export async function startOidc(provider: Provider, returnTo: string, locale: string): Promise<boolean> {
  const verifier = random(48);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const state = random(24);
  // for this tab only, and only until the provider answers
  sessionStorage.setItem(OIDC_KEY, JSON.stringify({ provider, state, verifier, returnTo, locale }));
  const qs = new URLSearchParams({ redirect_uri: redirectUri(provider), state, challenge });
  const r = await fetch(`/api/v1/auth/oidc/${provider}/start?${qs}`);
  if (!r.ok) return false;
  window.location.assign(((await r.json()) as { url: string }).url);
  return true;
}

export async function finishOidc(provider: Provider, code: string, state: string): Promise<{ returnTo: string; locale: string } | null> {
  let saved: { provider: string; state: string; verifier: string; returnTo: string; locale: string } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(OIDC_KEY) ?? "null");
  } catch {}
  sessionStorage.removeItem(OIDC_KEY);
  // the state proves this answer belongs to the sign-in this tab began
  if (!saved || saved.provider !== provider || saved.state !== state) return null;
  const r = await fetch(`/api/v1/auth/oidc/${provider}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri(provider), verifier: saved.verifier, device: deviceName() }),
  });
  if (!r.ok) return null;
  const out = (await r.json()) as SignedIn;
  useAccount.getState().signIn(out.session, out.user);
  return { returnTo: saved.returnTo, locale: saved.locale };
}

/** Sign this device out. With `removeData`, everything this site keeps in this browser goes too (a shared computer). */
export async function signOutHere(removeData = false): Promise<void> {
  if (removeData) {
    await deleteLocalData(); // signs out first
    window.location.reload();
    return;
  }
  await authFetch("/auth/signout", { method: "POST" }).catch(() => null);
  useAccount.getState().signOut();
}
