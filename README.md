# Game Asset Generator

A local-first Next.js workspace for turning source images into generated video,
frames, sprite sheets, and playable sprite configurations with xAI APIs.

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and replace every placeholder.
4. Run `npm run dev`.

Local development may omit both basic-auth values. Production fails closed when
they are absent or only partly configured. Generated source images, video,
frames, and manifests live under the ignored `data/` directory.

## Verification

Run `npm run lint`, `npm run typecheck`, and `npm run build` before publishing.
See `docs/PUBLICATION.md` for the release checklist.

No open-source license has been selected; normal copyright restrictions apply.
