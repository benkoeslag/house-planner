# Security Design

Status: Draft. Repository safeguards are defined; the application threat model is `TBD`.

## Repository assets and trust boundaries

Source code, documentation, issues, pull requests, Actions, and repository settings are private project assets. GitHub and each developer workstation are trust boundaries. Agent output must be reviewed before merge.

## Credentials and private data

- Never commit credentials, API keys, tokens, private keys, `.env` secrets, customer data, or private production data.
- Store local secrets outside Git and use sanitized examples.
- Grant agents and automation only the permissions required for the current task.
- Keep Actions permissions read-only unless a reviewed workflow requires more.
- Redact secrets and personal data from logs, issues, and PRs.

## Application security

Identity, authorization, public endpoints, encryption, retention, abuse controls, incident response, and security tests are `TBD` until the application is defined.

See `SECURITY.md` for the vulnerability-reporting entry point.
