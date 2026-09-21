# PRJ-026 — Supabase Persistence Contract v0.32

Status: offline contract implemented; live PostgreSQL rollback-compile validation PASS; dedicated authenticated sandbox validation pending.

## Base + overlay

Apply in order:
1. `api/postgres_schema_v0.26.sql`
2. `api/supabase_rls_v0.32.sql`

The overlay advances `schema_meta.schema_version` to `7`, adds `review_queue_items.version_token`, indexes review access paths, enables RLS, installs least-privilege grants/policies, and creates `prj026_commit_review_session(session_id)`.

## Auth contract

- JWT issuer/JWKS verification remains the v0.26 asymmetric OIDC implementation.
- Supabase convenience mode derives issuer and JWKS from `PRJ026_SUPABASE_PROJECT_URL`.
- RLS authorization role is `app_metadata.prj026_role` with canonical values `VIEWER`, `REVIEWER`, `ADMIN`.
- `user_metadata` is forbidden for authorization.

## Commit contract

`prj026_commit_review_session(session_id)` may commit only a READY session whose validation payload contains `status=READY_TO_COMMIT`.

For every decision it re-checks:
- role REVIEWER or ADMIN,
- session ownership (unless ADMIN),
- allowed action,
- queue item exists,
- queue status PENDING,
- exact optimistic `version_token`,
- CORRECT has a value,
- CONFIRM_AMBIGUITY targets an AMBIGUOUS item.

Any failure aborts the entire transaction. Direct authenticated writes to review queue/events are not granted.

## Live SQL compatibility gate

The full base schema + v0.32 overlay was executed against Supabase Postgres 17 inside a single transaction and rolled back.

Validated inside the transaction:
- all v0.32 policies compile,
- RLS is enabled on `review_queue_items`,
- the private commit function is `SECURITY DEFINER`,
- the public wrapper is `SECURITY INVOKER`.

After rollback, catalog checks confirmed no PRJ-026 tables, private schema, or policies remained.

This is **not** a durable persistence/auth acceptance result. Real Supabase Auth JWT role tests and successful/stale review-session transaction tests still require a dedicated PRJ-026 sandbox.
