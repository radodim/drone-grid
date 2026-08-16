import { createFileRoute } from "@tanstack/react-router"

import { LegalPage } from "@/components/Common/LegalPage"
import privacyMarkdown from "@/legal/privacy-policy.md?raw"

export const Route = createFileRoute("/privacy")({
  component: () => <LegalPage markdown={privacyMarkdown} />,
  head: () => ({ meta: [{ title: "Privacy Policy - Drone Grid" }] }),
})
