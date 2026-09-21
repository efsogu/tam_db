# PRJ-026 — Supabase Persistence & RLS Gate v0.32

**Status: OFFLINE CONTRACT PASS / LIVE POSTGRES ROLLBACK-COMPILE PASS / DEDICATED AUTH SANDBOX NOT YET AUTHORIZED.**

## What v0.32 adds

- Supabase/Postgres security overlay on top of the v0.26 logical schema.
- RLS enabled on all 11 PRJ-026 tables.
- No `anon` table access.
- Browser/authenticated users get read access only to the surfaces needed by the internal UI.
- Review session drafting is limited to REVIEWER/ADMIN and bound to `auth.uid()`.
- Authorization is derived only from `app_metadata.prj026_role`; user-editable metadata is not used.
- Queue resolution and review-event insertion are not directly granted to authenticated users.
- Atomic review commit is implemented through a private `SECURITY DEFINER` function with an explicit JWT/user/role check, exposed only through a public `SECURITY INVOKER` wrapper.
- Every item re-checks `queue_status=PENDING` and the optimistic `version_token` before mutation.
- Batch is one PostgreSQL transaction: any stale/invalid item aborts the whole session commit.
- Review commit audit record is written to `auth_audit`.
- Snapshot import materializes the existing Python concurrency token into `review_queue_items.version_token` for DB parity.

## Security decisions

1. `anon` receives no grants.
2. `service_role` / secret keys are never intended for browser code.
3. RLS role claims use `auth.jwt()->'app_metadata'->>'prj026_role'`, never `user_metadata`.
4. Direct authenticated writes to `review_queue_items` and `review_events` remain revoked.
5. The privileged function lives in the non-exposed `prj026_private` schema and checks `auth.uid()` + role before any write.
6. The public RPC wrapper is `SECURITY INVOKER`, and `PUBLIC`/`anon` execution is revoked.

## Live SQL compatibility evidence

The base schema plus v0.32 overlay was compiled on a real Supabase Postgres 17 database inside a single transaction.

Result:
- SQL/DDL/RLS/function compilation: **PASS**
- in-transaction catalog assertions: **PASS**
- transaction rollback: **PASS**
- post-rollback `public.cases`: absent
- post-rollback `public.review_queue_items`: absent
- post-rollback `prj026_private`: absent
- post-rollback `prj026_%` policies: absent
- unrelated existing public tables remained unchanged.

This gate intentionally does **not** use real Supabase Auth users/JWTs and does not persist any PRJ-026 rows.

## Dedicated live gate still required

Before review write controls are enabled in Vercel:

1. Use a dedicated PRJ-026 Supabase project or development branch. Do not repurpose unrelated projects.
2. Apply `postgres_schema_v0.26.sql` then `supabase_rls_v0.32.sql`.
3. Import a clean 6-case / 66-pending snapshot with v0.32 version tokens.
4. Verify no pending row has a null version token.
5. Test VIEWER/REVIEWER/ADMIN + unauthenticated matrices with real Supabase Auth JWTs.
6. Test one successful synthetic review-session commit and one stale-token rollback; restore/reset sandbox afterward.
7. Run Supabase security and performance advisors and close every relevant finding.
8. Only then expose write review controls.

## Current external-account finding

The connected Supabase account does not currently expose a clearly dedicated PRJ-026 sandbox. `Dragg-TR` is active and unrelated; `PM_Dashboard` is inactive and was not restored or repurposed. No persistent external Supabase schema/data was changed. A transaction-scoped compile test was performed on `Dragg-TR` and explicitly rolled back; post-rollback catalog checks confirmed zero PRJ-026 artifacts.
