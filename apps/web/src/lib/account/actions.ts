"use client";

import { deleteLocalData } from "@/lib/localData";
import { sitePath } from "./paths";
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

// ─── which browser asked for a link: a random value kept here, so the link's page can tell it was opened elsewhere ───

const ASKED_KEY = "jadhr-link-asked";
const ASKED_FOR = 24 * 3600_000;

function asked(): { v: string; at: number }[] {
  try {
    const list = JSON.parse(localStorage.getItem(ASKED_KEY) ?? "[]") as { v: string; at: number }[];
    return Array.isArray(list) ? list.filter((a) => typeof a?.v === "string" && Date.now() - a.at < ASKED_FOR) : [];
  } catch {
    return [];
  }
}

function remember(list: { v: string; at: number }[]): void {
  try {
    if (list.length) localStorage.setItem(ASKED_KEY, JSON.stringify(list.slice(-5)));
    else localStorage.removeItem(ASKED_KEY);
  } catch {}
}

/** The answer never says whether the address has an account: "sent" is all a reader learns. */
export async function requestLink(email: string, returnTo: string, locale: string): Promise<"sent" | "invalid" | "unavailable" | "failed"> {
  try {
    const browser = random(24);
    remember([...asked(), { v: browser, at: Date.now() }]);
    const r = await fetch("/api/v1/auth/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, return_to: returnTo, locale, browser }) });
    if (r.status === 202) return "sent";
    if (r.status === 422) return "invalid";
    if (r.status === 503) return "unavailable";
    return "failed";
  } catch {
    return "failed";
  }
}

type SignedIn = { session: string; user: Account; return_to: string };

/** What a link opens, without using it: its address, and whether this browser asked for it. null: used or expired. */
export async function peekLink(token: string): Promise<{ email: string; same_browser: boolean } | null | "failed"> {
  try {
    const r = await fetch("/api/v1/auth/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, browsers: asked().map((a) => a.v) }) });
    if (r.status === 404) return null;
    if (!r.ok) return "failed";
    return (await r.json()) as { email: string; same_browser: boolean };
  } catch {
    return "failed";
  }
}

/** A link from the e-mail, exchanged once for a session on this device. Returns where the reader was going. */
export async function verifyLink(token: string): Promise<string | null> {
  const r = await fetch("/api/v1/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, device: deviceName() }) });
  if (!r.ok) return null;
  const out = (await r.json()) as SignedIn;
  remember([]);
  useAccount.getState().signIn(out.session, out.user);
  return sitePath(out.return_to);
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
  // for this tab only, and only until the provider answers; a browser that keeps nothing cannot finish this way (F19)
  try {
    sessionStorage.setItem(OIDC_KEY, JSON.stringify({ provider, state, verifier, returnTo, locale }));
  } catch {
    return false;
  }
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
    sessionStorage.removeItem(OIDC_KEY);
  } catch {}
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
  return { returnTo: sitePath(saved.returnTo), locale: saved.locale === "en" ? "en" : "ar" };
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
