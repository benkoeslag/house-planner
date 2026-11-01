# Security

## Reporting a vulnerability

Use GitHub private vulnerability reporting on this repository when enabled. Otherwise, contact the repository owner through a private channel. Do not put vulnerability details, credentials, tokens, customer data, or private production data in a public issue or pull request.

Supported versions, response targets, and a private reporting contact are `TBD` until the application is defined.

## Development policy

Keep secrets outside source control. Use sanitized examples and separate development, staging, and production credentials. Enforce protected operations on the server, validate external input, apply least privilege, and redact sensitive data from logs.

The scaffold CI requires only repository read access. Expand workflow permissions only for a concrete, reviewed need.
