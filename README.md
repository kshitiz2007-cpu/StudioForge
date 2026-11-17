# StudioForge

**A source-aware visual development environment for real web projects.**

StudioForge is being built as a standalone IDE—not a mock editor and not a wrapper around a hosted builder. The repository is the source of truth.

## Product direction

- **Project Hub** — import ZIP projects, inspect structure, detect frameworks, manage workspaces.
- **Visual Studio** — responsive preview, element selection, layers, layout and style inspection.
- **Code Studio** — source editor, file tree, search, diagnostics and change review.
- **Runtime Lab** — isolated project execution through a pluggable runtime provider.
- **Design System** — tokens, themes, reusable styles and component conventions.
- **Asset Studio** — inspect and manage project images, fonts and SVG assets.
- **History & Export** — snapshots, patch review and downloadable source archives.

## Current milestone

The first milestone is a safe, end-to-end **static project workflow**:

1. Import a ZIP containing HTML/CSS/JS.
2. Validate and inspect the archive without extracting unsafe paths.
3. Preview supported static files in a restricted preview surface.
4. Select an element and edit its supported visual properties.
5. Persist edits as explicit project changes.
6. Export the updated project as a ZIP.

Framework-aware execution (Vite, Next.js, Vue, Svelte, etc.) comes through a separately configured runtime provider. StudioForge will never claim that arbitrary project code is running when no runtime is configured.

## Development

The app is a TypeScript + Next.js App Router application.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Security principles

- Treat every imported archive and every project file as untrusted.
- Reject zip-slip paths, symlinks and suspicious archive sizes/counts.
- Never execute imported scripts in the StudioForge application server.
- Keep project execution in a separately isolated runtime.
- Serve previews from a separate origin with restrictive sandboxing and CSP.
- Keep provider credentials server-side.
- Enforce project ownership and validate every server-side operation.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Status

Early foundation. The repository is the active implementation target; features are added in verifiable milestones. Runtime execution is intentionally marked unavailable until a provider is integrated.
