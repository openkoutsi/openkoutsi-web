/**
 * Frontend LLM config helpers.
 *
 * The browser never builds LLM prompts and never calls a model directly.
 * Activity analysis and plan generation go through the purpose-built server
 * endpoints (`POST /api/activities/{id}/analyze`, `POST /api/plans`,
 * `POST /api/plans/{id}/regenerate`), which construct prompts server-side and
 * resolve the caller's LLM (BYO or instance) via `resolve_llm_config`. There is
 * no general-purpose chat passthrough to call instead — it was removed
 * deliberately, since a client-supplied `messages` array would let the browser
 * override the server's system prompt. This module only exposes whether a BYO
 * server is configured so the UI can label the two cases.
 */

export interface LlmConfig {
  base_url: string
  model: string
  /** True when an API key is stored encrypted on the server. */
  api_key_set: boolean
}

/** Extract LLM config from app_settings; returns null when not configured. */
export function getLlmConfig(
  appSettings: Record<string, unknown> | undefined | null,
): LlmConfig | null {
  const base_url = (appSettings?.llm_base_url as string | undefined)?.trim()
  if (!base_url) return null
  return {
    base_url,
    model: ((appSettings?.llm_model as string) || 'llama3.2').trim(),
    api_key_set: Boolean(appSettings?.llm_api_key_set),
  }
}
