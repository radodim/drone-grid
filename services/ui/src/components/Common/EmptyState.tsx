import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/** Page-level empty state — icon badge, headline, one guidance line. */
export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  )
}
