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
import { Logo } from "./components/Common/Logo"
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
      })
      .then(() => setLoading(false))
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    // First paint of the product (also the Keycloak-redirect holding screen
    // and what share-link viewers see) — speak instrument, not template.
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
        <Logo variant="full" asLink={false} />
        <p className="font-mono text-xs text-muted-foreground motion-safe:animate-pulse">
          connecting…
        </p>
      </div>
    )
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
