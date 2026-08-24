# Publication Checklist

- Keep `.env.local`, generated `data/`, source uploads, videos, and sprite assets
  out of Git.
- Configure both `APP_BASIC_AUTH_*` values in every production deployment.
- Store xAI API and management keys only as server-side environment variables.
- Confirm no environment variable containing a credential uses `NEXT_PUBLIC_`.
- Run lint, type checking, build, dependency audit, current-tree secret scan,
  and full-history secret scan.
- Review generated assets for third-party rights before distributing them.
- Choose an open-source license only if reuse rights should be granted.

The repository can be source-visible without publishing a live unauthenticated
generator or granting reuse rights.
