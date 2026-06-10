import keycloak from "@/keycloak"

/**
 * Build a ws(s):// URL for a backend API path, with the Keycloak JWT as a
 * query param (browsers can't set headers on native WebSocket connections).
 */
export function buildApiWsUrl(path: string): string {
  const url = new URL(import.meta.env.VITE_API_URL)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = path
  url.searchParams.set("token", keycloak.token ?? "")
  return url.toString()
}
