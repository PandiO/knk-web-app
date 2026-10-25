/**
 * A full page load, as opposed to react-router's in-app `navigate()`. Needed where Cloudflare Access
 * must see the request (2026-10-25): after sign-up the new account's email is on the Access list, but
 * the browser only gets its Cloudflare session when a *document* request hits a protected path —
 * Cloudflare then shows its login, asks for the email and mails the one-time code. An in-app
 * navigation never reaches it, and every API call afterwards dies on Cloudflare's redirect (CORS).
 * In a module of its own so tests can mock it (jsdom has no navigation).
 */
export function fullPageLoad(path: string): void {
  window.location.assign(path);
}

/** Reload the current URL as a document request (same reason as above). */
export function reloadPage(): void {
  window.location.reload();
}
