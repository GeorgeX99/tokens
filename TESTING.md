# Testing

What CI enforces, and what you can run locally before opening a PR. A PR is expected to pass the credential-free automated checks below; the environment-dependent checks are run by maintainers against staging.

## Automated Checks (no credentials needed)

These run in CI and locally with no external accounts — this is the bar for a PR:

```bash
bun run check:repo-hygiene
bun run verify:api-health-routes
bun run lint
bun run build
bun run audit:deps
```

What these cover:

- `check:repo-hygiene`: blocks tracked secret-bearing env files, assistant artifacts, and junk files such as `.DS_Store`
- `verify:api-health-routes`: smoke-checks the public health route handlers and their cache/request-id behavior
- `lint`: static analysis across the monorepo
- `build`: production builds for the workspaces in scope
- `audit:deps`: dependency advisory scan

## Environment-Dependent Checks (maintainers)

Some verification requires real credentials, a seeded data environment, or a deployed API
surface, so it is not part of the PR baseline and is run by maintainers against staging:

```bash
bun run verify:assets-api-v1
node scripts/smoke-assets-v1.mjs
```

These require environment variables such as:

- `API_BASE_URL` or `TOKENS_API_BASE_URL`
- `API_KEY` or `TOKENS_API_KEY`

You do not need these to contribute — open your PR against the credential-free checks above,
and a maintainer will run the data-dependent checks during review where relevant.

## Testing Posture

- Public API route smoke coverage exists but is intentionally narrow.
- Hosted and data-dependent behavior is verified against staging during review.
- Operational apps (`apps/admin`, `apps/cloudrun-*`) are build-verified in CI, not
  comprehensively end-to-end tested here.

If you add security-sensitive behavior, auth boundaries, or public API routes, add or update
an automated check alongside the change.
