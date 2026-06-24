import keycloak from "@/keycloak"

/**
 * Build a ws(s):// URL for a backend API path, with a credential as a query
 * param (browsers can't set headers on native WebSocket connections).
 * Defaults to the Keycloak JWT; pass an explicit token (e.g. a `dgs_` share
 * token) for unauthenticated viewers.
 */
export function buildApiWsUrl(path: string, token?: string): string {
  const url = new URL(import.meta.env.VITE_API_URL)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = path
  url.searchParams.set("token", token ?? keycloak.token ?? "")
  return url.toString()
}
