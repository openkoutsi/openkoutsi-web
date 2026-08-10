export const KOUTSI_AVATAR: Record<string, string> = {
  cheer: '/koutsi/koutsi-cheer.svg',
  knowing: '/koutsi/koutsi-knowing.svg',
  neutral: '/koutsi/koutsi-neutral.svg',
  stern: '/koutsi/koutsi-stern.svg',
}

export function parseMoodAndParagraphs(text: string): { mood: string; paragraphs: string[] } {
  const lines = text.split('\n')
  let mood = 'knowing'
  let startIdx = 0
  if (lines[0]?.startsWith('MOOD:')) {
    const candidate = lines[0].slice(5).trim().toLowerCase()
    if (Object.prototype.hasOwnProperty.call(KOUTSI_AVATAR, candidate)) mood = candidate
    startIdx = 1
    while (startIdx < lines.length && lines[startIdx].trim() === '') startIdx++
  }
  const rest = lines.slice(startIdx).join('\n')
  return { mood, paragraphs: rest.split(/\n\n+/).map((p) => p.trim()).filter(Boolean) }
}

export function KoutsiAvatar({ mood }: { mood: string }) {
  const src = KOUTSI_AVATAR[mood] ?? KOUTSI_AVATAR.knowing
  return <img src={src} alt="Koutsi" className="w-10 h-10 shrink-0 rounded-full" />
}

/**
 * Which `common.llm.progress.*` key renders a backend progress code (issue #43).
 *
 * The agentic coach spends its first rounds calling tools and writing no prose,
 * so the API reports a *code* — `thinking`, or `tool.<registry tool name>` — for
 * the card to show meanwhile. Codes rather than model-written sentences because
 * the coaching prompts run in fourteen languages while every tool name is
 * English, and because a code cannot leak tool internals into the bubble.
 *
 * Returns `null` for anything unrecognised, which the caller shows generic
 * "thinking" copy for. That is the whole point of the contract: the tool set
 * grows, and a backend that has learned a new tool must not make an older
 * frontend render `tool.get_something_new` at the athlete.
 */
export function progressMessageKey(code: string | null | undefined): string | null {
  if (!code) return null
  if (code === 'thinking') return 'progress.thinking'
  if (code.startsWith('tool.')) {
    const name = code.slice('tool.'.length)
    // The registry constrains tool names to lowercase snake_case; anything else
    // did not come from it, so it is not something to look up or display.
    return /^[a-z][a-z0-9_]{2,47}$/.test(name) ? `progress.tools.${name}` : null
  }
  return null
}

/**
 * The line Koutsi shows while it is still gathering (issue #43).
 *
 * `t` is a `common.llm` translator. An unknown code falls back to the generic
 * copy rather than showing nothing: the athlete should always see that
 * *something* is happening, even against a backend newer than this build.
 */
export function progressText(
  t: { (key: string): string; has: (key: string) => boolean },
  code: string | null | undefined,
  fallback: string,
): string {
  const key = progressMessageKey(code)
  return key && t.has(key) ? t(key) : fallback
}

export function KoutsiBubble({ text, isPartial }: { text: string; isPartial?: boolean }) {
  return (
    <p className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed max-w-prose">
      {text}
      {isPartial && <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-foreground align-middle animate-pulse" />}
    </p>
  )
}
