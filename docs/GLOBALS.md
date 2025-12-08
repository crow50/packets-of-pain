# Globals Map

## Globals intentionally set today
None. All runtime, UI, and sim modules use explicit imports and injected engines; packet enums and helpers are module-only.

## Globals that should be temporary / tech debt
- Avoid reintroducing catalog/connection/routing globals; keep imports only.
- Engine runtime is injected via bootstrap; avoid adding window-based accessors.
- Tool helpers, menu actions, and sound are module-scoped; avoid new globals.

## Allowed globals (short list to keep)
None planned; any new `window.*` should be treated as debt.

Everything should use imports and injected dependencies instead of `window.*`.
