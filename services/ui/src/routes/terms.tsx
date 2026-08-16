import { createFileRoute } from "@tanstack/react-router"

import { LegalPage } from "@/components/Common/LegalPage"
import termsMarkdown from "@/legal/terms-of-service.md?raw"

export const Route = createFileRoute("/terms")({
  component: () => <LegalPage markdown={termsMarkdown} />,
  head: () => ({ meta: [{ title: "Terms of Service - Drone Grid" }] }),
})
