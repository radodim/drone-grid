import { createFileRoute, Outlet } from "@tanstack/react-router"

import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import keycloak from "@/keycloak"

export const Route = createFileRoute("/_layout")({
  // The app shell is sign-in-only. Public routes (e.g. /share/$token) live
  // outside this layout and render without auth. login() is a full-page
  // redirect to Keycloak; awaiting it halts loading until navigation.
  beforeLoad: async () => {
    if (!keycloak.authenticated) {
      await keycloak.login()
    }
  },
  component: Layout,
})

function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
        </header>
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
