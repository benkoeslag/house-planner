# Data Model

Status: `TBD`; do not choose a database or persistence model implicitly.

## Entities

Application entities, stable identifiers, important fields, relationships, ownership, and retention are `TBD`.

## Invariants and audit records

Uniqueness, state transitions, concurrency, referential integrity, administrative audit records, and retention requirements are `TBD`.

## Persistence and migration

If the application requires persistence, document the database decision in an ADR and define migration ownership, rollback limits, backups, and restore verification before production use.
