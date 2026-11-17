# StudioForge architecture

StudioForge is a visual website designer for existing projects. Users work on the rendered page and visual controls; source code is the persisted output, not the primary editing surface.

## Product flow

1. Import a ZIP and validate/extract its files without executing them.
2. Detect the project framework and identify candidate start/build commands.
3. Start the project in a disposable, isolated runtime. Never execute imported code in the StudioForge application process or origin.
4. Display the actual running site in a dedicated preview origin.
5. Let users select rendered elements, inspect computed styles and edit through visual controls.
6. Translate visual operations into source-aware changes, validate them, and persist them in project files.
7. Export the modified project as a ZIP.

## Application boundaries

- **Web app:** project management, visual canvas, selection tools, visual inspector and authenticated APIs.
- **Project storage:** private, owner-scoped source files, snapshots and edit history.
- **Runtime provider:** disposable project execution with lifecycle, resource, network and filesystem limits.
- **Preview surface:** a dedicated origin, isolated from app cookies, storage and privileged APIs.
- **Visual bridge:** a narrow, versioned message protocol between the canvas and preview frame.
- **Source adapters:** framework-aware readers/writers that map rendered elements and visual operations to source files.
- **Export service:** produces a ZIP from validated project files and committed changes.

## Framework support strategy

All common web project types are in product scope: static HTML/CSS/JS, React, Vite, Next.js, Vue, Svelte and Angular. This is a shared visual-editor experience, not a promise that all projects have identical runtime or source-editing behavior.

Use a framework adapter registry. Each adapter reports:
- detection confidence and project kind;
- supported package manager and candidate run commands;
- runtime compatibility requirements;
- source-map / component metadata capabilities;
- supported visual write operations and unsupported-operation reasons.

Detection is metadata only. Never infer that a project runs merely because its framework was detected. Next.js and other server-rendered projects need a Node-capable runtime; static export support is not equivalent to full server feature support. Runtime selection must report incompatibilities instead of silently showing a stale or sanitized preview.

## Runtime provider contract

1. Create a per-project disposable workspace.
2. Transfer validated files.
3. Install dependencies under policy and resource limits.
4. Start the detected development command.
5. Return an isolated preview URL and runtime session identifier.
6. Stream logs and health status.
7. Stop and delete the workspace on user request, timeout or failure.

The first provider evaluation should compare:
- **Browser runtime:** WebContainers can run Node.js toolchains in the browser, but require cross-origin isolation headers and have browser/platform constraints. Verify package/native-addon compatibility and memory limits for each project.
- **Remote runtime:** isolated containers or microVMs provide broader OS and server compatibility, but require strong tenant isolation, egress controls, quotas and lifecycle cleanup.

Keep the provider interface independent of either implementation. Do not claim that a browser runtime is a security boundary equivalent to a hardened multi-tenant microVM without a separate threat assessment.

## Visual canvas and selection

The preview is the real project, rendered in an isolated iframe. A parent-owned overlay draws selection outlines, handles, guides and drop indicators. The iframe bridge uses a strict versioned message schema and validates message origin, source window, project/session identity and payload shape.

The selection agent should:
- identify the clicked element and stable selector candidates;
- report tag, attributes, bounding box, computed styles and ancestor context;
- ignore StudioForge overlays and injected editor chrome;
- support hover outlines, click selection, escape-to-clear and selection persistence where safe;
- expose semantic roles (section, container, text, image, button, link, card) without assuming every DOM node is a standalone component.

Never grant the preview frame access to app cookies, local storage, auth tokens or privileged APIs. Do not use an unrestricted same-origin iframe. The bridge is not a general-purpose RPC channel.

## Visual edit model

Represent every operation as a typed, reversible edit:
- target identity and confidence;
- property path and old/new values;
- breakpoint / responsive scope;
- source adapter and source file mapping;
- preview operation;
- source transformation result;
- validation status and warnings.

Examples: set text, set color, set gradient stops, typography, border, shadow, spacing, width/height, flex/grid properties, alignment, order, and responsive overrides.

Preview changes may be optimistic, but they are not committed until the source adapter can persist the equivalent source change. If a target cannot be mapped confidently, offer a clearly marked limited/unsupported operation rather than silently storing a DOM-only mutation.

## Source mapping and code synchronization

Use layered strategies:
1. Existing source maps, framework dev metadata and stable component identifiers when available.
2. Parser-backed source transformations for supported HTML/CSS/JSX/TSX/Vue/Svelte/Angular templates.
3. A generated project stylesheet or scoped style layer only when its cascade and selector scope are provably safe.
4. Explicit unsupported state when a transformation cannot be made safely.

Do not use regex as the general-purpose JSX/TSX/template rewrite engine. Do not treat a preview-only inline style as a saved source edit. Keep a reversible patch log and verify that the changed project still builds/runs when possible.

## Layout editing semantics

- Dragging within a flex/grid parent should change ordering, alignment, gap or grid placement as appropriate—not blindly apply absolute positioning.
- Free positioning is an explicit mode, never the default interpretation of drag.
- Resize handles should write width/height constraints appropriate to the selected layout context.
- Responsive values are breakpoint-scoped; editing desktop must not accidentally overwrite tablet/mobile styles.
- Provide undo/redo across visual operations, source patches and breakpoint changes.

## Inspector capabilities

The visual inspector is the primary editing UI:
- dimensions, min/max size, margin, padding and gap;
- flex/grid layout, direction, wrapping, alignment, ordering and placement;
- typography, text content and decoration;
- solid color, opacity, image background and multi-stop gradients;
- border, radius, outline and shadow;
- positioning and stacking;
- desktop/tablet/mobile responsive values.

Gradient editing supports editable hex values and draggable 2-, 3- and 4-stop color controls, with angle and stop-position controls.

## Current repository status and migration

The current scaffold has ZIP intake, local file inspection/editing and a sanitized static-only preview. That preview is not the final runtime and must not be presented as a running framework project. The current textarea is an implementation utility, not the product's primary editor.

Next build order:
1. Replace the static-only preview as the primary project experience with the Runtime Provider lifecycle and truthful runtime status.
2. Implement the isolated iframe selection bridge and parent-owned selection overlays.
3. Implement the visual inspector and preview-only live style updates.
4. Add source adapters and commit visual edits to project source.
5. Add drag/drop layout operations and responsive breakpoint editing.
6. Add snapshot/undo and ZIP export of modified source.

## Security

- Enforce ownership on every project/runtime/file operation.
- Keep projects private by default and secrets server-side.
- Validate archive paths, sizes, entry counts and file types.
- Never execute imported code in the StudioForge app server or app origin.
- Apply CPU, memory, process, time, disk and network limits to runtime workspaces.
- Deny access to cloud metadata, internal control planes and app credentials from project workloads.
- Use a separate preview origin, restrictive sandboxing and a narrow validated bridge.
- Log security-relevant events without logging secrets or source contents unnecessarily.
- Disable local unauthenticated filesystem operations in production until authentication and ownership checks exist.
