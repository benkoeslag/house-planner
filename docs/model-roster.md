# Model Roster

Last reviewed: 2026-10-10

Agents take package model recommendations from this table (see "Work packages and model recommendations" in [`AGENTS.md`](../AGENTS.md)). The rule never names models; this file does, so keeping recommendations current means editing only this file and syncing it from the template.

| Tier | Use for | Claude (model · effort) | ChatGPT/Codex (model · effort) |
| --- | --- | --- | --- |
| Light | Mechanical edits, value tuning, copy and docs changes, renames, obvious single-cause fixes | Haiku 4.5 · low–medium | GPT-6 Luna · high |
| Standard | Typical feature work, bug fixes needing investigation, adding tests, contained refactors | Sonnet 5.5 · medium–high | GPT-6.1 Sol · medium |
| Heavy | New systems, design-heavy or cross-cutting work, tricky debugging, security-sensitive implementation | Opus 5.5 · high–xhigh | GPT-6 Astra · high |
| Reviewer | Higher-model review and refutation of high-risk packages | Fable 5.1 · high (alternative: Opus 5.5 · max) | GPT-6 Astra · high |

Claude effort levels: `low`, `medium`, `high`, `xhigh`, `max`. ChatGPT/Codex common documented effort levels: `low`, `medium`, `high`, `xhigh`, `max`; the recommendations above use owner-confirmed `medium` and `high`. Picker controls depend on the client, plan, settings, and model; verify availability before recommending a different effort.

## Sources

- Claude column: confirmed by the owner from the Claude model picker in VS Code on 2026-10-10 (Opus 5.5, Sonnet 5.5, Fable 5.1, Haiku 4.5; effort slider low to max).
- ChatGPT/Codex reviewed: 2026-10-10. The owner confirmed GPT-6 Luna, GPT-6.1 Sol, GPT-6 Astra and the proposed efforts from the Codex picker in the authorized fish-sticks governance session on this date. Tier assignments are project recommendations, not official OpenAI tiers or claims of equivalent performance across vendors.
- ChatGPT/Codex sources checked on 2026-10-10: [OpenAI's Codex/Work model guide](https://learn.chatgpt.com/docs/models?surface=app) documents model names, task fit, picker availability and effort controls; [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) documents the common effort values. Account availability was confirmed by the owner, not inferred from API documentation. API identifiers are `gpt-6-luna`, `gpt-6.1-sol`, and `gpt-6-astra`; the guide maps CLI `low` to picker Light and `xhigh` to Extra High.

## Maintenance

- Each vendor's agents maintain only their own vendor's column. They may flag the other vendor's column as stale but never edit it.
- Use the vendor's dated Sources entry for freshness; the shared Last reviewed date is a legacy fallback. Updating one vendor must not make the other's information appear freshly reviewed. An agent that finds its own column `TBD`, more than 90 days past that vendor's review date, or naming a model it knows has been replaced proposes an update in a small, separate pull request that cites its source and updates only its vendor's review date.
- Agents do not invent model names. A model's knowledge ends at its training cutoff, so unsure entries stay `TBD` until the owner confirms them from the model picker.
- Update this file in the template repository first, then copy it to projects created from the template.
