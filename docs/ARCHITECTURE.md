# StudioForge architecture

## Application boundaries

- **Web app:** project management UI, editor surfaces and authenticated API.
- **Project storage:** private, owner-scoped source files and immutable snapshots.
- **Preview surface:** a separate origin, sandboxed from the main application.
- **Runtime provider:** optional adapter that provisions isolated execution environments.
- **Export service:** produces a ZIP from validated project files and recorded edits.

## Initial vertical slice

The first usable slice targets static HTML/CSS/JS archives. The import pipeline validates entries before any write, records a manifest, and keeps source files as data. Previewing must not evaluate imported code inside the main app origin. Visual edits are represented as explicit, reviewable changes and must round-trip through export.

## Framework support

Framework detection is metadata only. Detecting a package such as Next.js or Vite does not mean the project can run. Framework execution requires a configured runtime provider with isolation, lifecycle controls, resource limits, logs and a dedicated preview URL.

## Runtime adapter lifecycle

1. Create a per-project workspace.
2. Transfer validated files.
3. Install dependencies under policy and resource limits.
4. Start the requested development command.
5. Return a preview URL on the isolated preview origin.
6. Stream logs and health status.
7. Stop and delete the workspace.

The app must surface provider absence and failures clearly. Never silently downgrade a framework project to a misleading "live" preview.

## Editing model

Source changes should be represented as patches with original and updated content, file path, operation type and validation status. CSS visual overrides can be an early supported edit path. Structural JSX/TSX transformations require parser-backed edits and must not be simulated by changing only the preview DOM.
