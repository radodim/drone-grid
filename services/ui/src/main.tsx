import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom/client"
import { ApiError, OpenAPI } from "./client"
import { BootScreen } from "./components/Common/BootScreen"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import "./index.css"
import "./lib/insecure-context-shim"
import keycloak from "./keycloak"
import { routeTree } from "./routeTree.gen"

OpenAPI.BASE = import.meta.env.VITE_API_URL
OpenAPI.TOKEN = async () => {
  if (keycloak.isTokenExpired(5)) {
    await keycloak.updateToken(30)
  }
  return keycloak.token || ""
}

// Proactive refresh: REST refreshes lazily above, but a pilot parked on the
// stream page generates no REST — without this, prod's 5-minute tokens go
// stale and every socket/WHEP reconnect is rejected until a page reload.
// A failed refresh means the SSO session itself ended: redirect to login,
// same as handleApiError does for REST (never fires for share-link viewers,
// who hold no Keycloak token).
keycloak.onTokenExpired = () => {
  keycloak.updateToken(30).catch(() => {
    // Offline (field LTE blip coinciding with expiry): redirecting would
    // swap the cockpit for an unreachable-Keycloak error page — wait
    // instead; the reconnect paths refresh again once connectivity
    // returns. Online + failed = the SSO session truly ended: re-login,
    // same as REST's 401 handling.
    if (navigator.onLine) keycloak.login()
  })
}

const handleApiError = (error: Error) => {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    keycloak.login()
  }
}
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleApiError,
  }),
  mutationCache: new MutationCache({
    onError: handleApiError,
  }),
})

const router = createRouter({ routeTree })
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

function App() {
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // check-sso (not login-required): the app renders for everyone, including
    // unauthenticated share-link viewers. App routes guard themselves via
    // _layout's beforeLoad, which redirects to Keycloak when not signed in.
    // S256 needs crypto.subtle, which browsers disable on insecure origins
    // (LAN dev over plain http) — prod https always gets PKCE.
    keycloak
      .init({
        onLoad: "check-sso",
        pkceMethod: window.isSecureContext ? "S256" : false,
        // The SSO-monitor iframe probes 3p-cookie access via
        // requestStorageAccess, which insecure origins reject with console
        // errors on every load — keep session monitoring to https.
        checkLoginIframe: window.isSecureContext,
      })
      .then(() => setLoading(false))
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <BootScreen message="connecting…" pulse />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors closeButton />
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
)
