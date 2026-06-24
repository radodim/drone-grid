import { createFileRoute, redirect } from "@tanstack/react-router"

// No dashboard yet — land authenticated users straight on the drones list.
export const Route = createFileRoute("/_layout/")({
  beforeLoad: () => {
    throw redirect({ to: "/drones" })
  },
})
