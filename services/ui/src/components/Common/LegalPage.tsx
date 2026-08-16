import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Logo } from "@/components/Common/Logo"

/** Chrome-less public shell for the legal documents (/terms, /privacy).
 * Renders the markdown to React elements — no raw HTML injection. The
 * header is a plain anchor so anonymous readers land on the public
 * landing page instead of the SPA's auth gate. */
export function LegalPage({ markdown }: { markdown: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto w-full max-w-3xl px-4 pt-8">
        <a href="/" className="flex w-fit items-center gap-3">
          <Logo variant="icon" asLink={false} className="size-8" />
          <span className="font-semibold tracking-tight">Drone Grid</span>
        </a>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <article className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      </main>
    </div>
  )
}
