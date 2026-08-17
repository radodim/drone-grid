import { useQueries, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Circle, Drone } from "lucide-react"
import { Suspense } from "react"

import { DronesService } from "@/client"
import { EmptyState } from "@/components/Common/EmptyState"
import { formatExpiry, ShareDialog } from "@/components/Drones/ShareDialog"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/shares")({
  component: Shares,
  head: () => ({
    meta: [{ title: "Shares - Drone Grid" }],
  }),
})

function Shares() {
  // Same capped column as the Drones page — list pages share one width.
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shares</h1>
        <p className="text-muted-foreground">
          Read-only live-view links — viewers watch video and telemetry, never
          control
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        }
      >
        <ShareList />
      </Suspense>
    </div>
  )
}

function ShareList() {
  const { data: drones } = useSuspenseQuery({
    queryKey: ["drones"],
    queryFn: () => DronesService.listDrones(),
  })
  // Same keys as ShareDialog's internal query, so creating or revoking a
  // link in the dialog updates this list through the shared cache.
  const shareQueries = useQueries({
    queries: drones.map((drone) => ({
      queryKey: ["shares", drone.id],
      queryFn: () => DronesService.listShares({ droneId: drone.id }),
    })),
  })

  if (drones.length === 0) {
    return (
      <EmptyState icon={Drone} title="No drones yet">
        Shares belong to a drone — register one on the{" "}
        <Link to="/drones" className="underline">
          Drones
        </Link>{" "}
        page first
      </EmptyState>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {drones.map((drone, i) => {
        const shares = shareQueries[i]?.data ?? []

        return (
          <div
            key={drone.id}
            className="rounded-lg border p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <Circle
                  className={
                    drone.stream_url
                      ? "size-2.5 fill-green-500 text-green-500"
                      : "size-2.5 fill-muted-foreground text-muted-foreground"
                  }
                />
                <span className="font-medium truncate">{drone.name}</span>
              </div>
              <ShareDialog droneId={drone.id} />
            </div>
            {shares.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="truncate">
                      {share.label || "Untitled link"}
                    </span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      expires {formatExpiry(share.expiration_timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
