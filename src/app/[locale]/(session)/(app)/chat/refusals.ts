/**
 * Copy for each `{code, message}` refusal the chat API can return.
 *
 * A flat record rather than a chain of ternaries, so a missing entry is visible
 * and `chatI18n.test.ts` can assert over it — the same thing that makes the
 * error-code contract on a *failed turn* trustworthy. These reach the athlete as
 * a toast rather than as a styled panel, and an unmapped one falls through to the
 * backend's own English sentence inside a translated UI.
 *
 * `chat_disabled` matters more than it looks: the backend raises it from
 * `_require_chat_access` on every POST, not only at page load, so it is
 * reachable mid-session by turning the agentic coach off in another tab and
 * coming back to send.
 *
 * In its own module, rather than beside the page that uses it, so the test can
 * import the mapping without dragging in a client component and its SWR calls.
 */
export const REFUSAL_KEYS: Record<string, string> = {
  chat_daily_budget: 'budget.spentBody',
  chat_conversation_budget: 'budget.conversationFullBody',
  chat_turn_in_flight: 'budget.turnInFlight',
  chat_disabled: 'unavailable.disabledBody',
  chat_tools_unsupported: 'unavailable.toolsBody',
}
