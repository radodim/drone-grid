/** Copy that survives plain-http LAN origins, where the async clipboard API
 * is absent (secure-context-only). The fallback selects a throwaway <span>
 * via a Range and uses execCommand("copy") — selection-based rather than
 * focus-based, because every copy button here sits inside a Radix modal
 * (dialog/menu) whose focus trap instantly reclaims focus from a temporary
 * textarea, leaving execCommand nothing to copy while it still returns true.
 * Must run inside the user gesture. */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // permission denied — the legacy path may still work
    }
  }
  const selection = window.getSelection()
  if (selection == null) return false

  const span = document.createElement("span")
  span.textContent = text
  // pre: the credentials env block must keep its newlines in the selection
  span.style.whiteSpace = "pre"
  span.style.position = "fixed"
  span.style.left = "-9999px"
  document.body.appendChild(span)

  const range = document.createRange()
  range.selectNodeContents(span)
  selection.removeAllRanges()
  selection.addRange(range)
  let copied = false
  try {
    copied = document.execCommand("copy")
  } catch {
    copied = false
  }
  selection.removeAllRanges()
  span.remove()

  return copied
}
