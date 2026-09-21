# PRJ-026 backend contract

This directory is intentionally isolated from the TeamGram production path.

## v0.32 status

- extraction Stage-A: CASE_001–006 PASS
- Full-75: 0/6 COMPLETE
- review queue: 66 pending, read-only
- Supabase RLS contract: offline PASS
- live Supabase Postgres 17 rollback-compile: PASS
- durable authenticated PRJ-026 sandbox: NOT CONNECTED
- review write controls: DISABLED

Apply the existing v0.26 base schema first, then `supabase_rls_v0.32.sql`. Do not apply this migration to an unrelated Supabase project.

Full v0.32 evidence package is stored in the project Gold Set Drive folder under `ENGINE_v0.32`.
