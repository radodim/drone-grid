import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Drone, TriangleAlert } from "lucide-react"
import { Suspense } from "react"

import { DronesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import { EmptyState } from "@/components/Common/EmptyState"
import AddDrone from "@/components/Drones/AddDrone"
import { columns } from "@/components/Drones/columns"
import { Skeleton } from "@/components/ui/skeleton"

// TODO: Add a manual refresh button
// TODO: Explore websocket streaming of changes instead of polling
function getDronesQueryOptions() {
  return {
    queryFn: () => DronesService.listDrones(),
    queryKey: ["drones"],
    refetchInterval: 5000,
  }
}

export const Route = createFileRoute("/_layout/drones")({
  component: Drones,
  head: () => ({
    meta: [
      {
        title: "Drones - Drone Grid",
      },
    ],
  }),
})

function PendingDrones() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function DronesTableContent() {
  const { data: drones } = useSuspenseQuery(getDronesQueryOptions())

  if (drones.length === 0) {
    return (
      <EmptyState icon={Drone} title="No drones yet">
        Add a drone to get the credentials its companion needs
      </EmptyState>
    )
  }

  return <DataTable columns={columns} data={drones} />
}

function DronesTable() {
  return (
    <Suspense fallback={<PendingDrones />}>
      <DronesTableContent />
    </Suspense>
  )
}

function Drones() {
  // Narrower than the layout's max-w-7xl: a fleet list can't fill a video
  // player's width — capping the column keeps the table's gaps modest and
  // the whitespace at the page margins, where it reads as intended.
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drones</h1>
          <a
            href="https://docs.drone-grid.com/hardware/x650-raspberry-pi/safety-recommendations/"
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex w-fit items-center gap-1.5 text-amber-600 text-sm underline underline-offset-2 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-100"
          >
            <TriangleAlert className="size-3.5 shrink-0" />
            Safety recommendations
          </a>
        </div>
        <AddDrone />
      </div>
      <DronesTable />
    </div>
  )
}
