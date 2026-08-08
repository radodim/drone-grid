import keycloak from "@/keycloak"

/**
 * Build a ws(s):// URL for a backend API path, with a credential as a query
 * param (browsers can't set headers on native WebSocket connections).
 * Defaults to the Keycloak JWT; pass an explicit token (e.g. a `dgs_` share
 * token) for unauthenticated viewers.
 *
 * Async because sockets outlive REST traffic (the only other thing that
 * refreshes the token): each (re)connect refreshes here, so an attempt
 * never presents an expired JWT. Share tokens aren't Keycloak's business.
 */
export async function buildApiWsUrl(
  path: string,
  token?: string,
): Promise<string> {
  if (token === undefined && keycloak.authenticated) {
    try {
      await keycloak.updateToken(30)
    } catch {
      // Session gone — connect with what we have; the terminal login
      // redirect is the expiry keepalive's job (main.tsx).
    }
  }
  const url = new URL(import.meta.env.VITE_API_URL)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = path
  url.searchParams.set("token", token ?? keycloak.token ?? "")
  return url.toString()
}
