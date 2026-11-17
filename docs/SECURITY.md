# Security requirements

Imported project archives and source files are untrusted input.

## Archive intake

- Enforce compressed and expanded byte limits and a maximum entry count.
- Reject absolute paths, drive prefixes, traversal segments and normalized path collisions.
- Reject symlinks and unsupported special file types.
- Validate MIME/type by content where relevant; never trust file extensions alone.
- Do not extract into a publicly served directory.
- Avoid loading the entire archive into memory when streaming limits are possible.

## Execution

- Never run imported package scripts in the StudioForge web process.
- Use disposable, isolated workspaces with CPU, memory, process and time limits.
- Deny cloud metadata and internal control-plane access from project workloads.
- Apply outbound network policy and dependency-install policy.
- Keep runtime provider tokens server-side.

## Preview

- Use a dedicated preview origin, separate from authentication cookies and app storage.
- Use restrictive iframe sandbox flags and CSP.
- Do not grant same-origin privileges to untrusted content.
- Do not pass app credentials or privileged postMessage commands into preview frames.
- Validate message origin and message schema for any preview communication.

## Authorization and data

- Enforce ownership checks on every project and file operation.
- Keep projects private by default.
- Validate all paths server-side.
- Log security-relevant events without logging secrets or source contents unnecessarily.


## Static preview boundary

The first preview mode is deliberately static-only:

- The static preview iframe grants `allow-scripts` only so StudioForge’s trusted selection bridge can inspect rendered DOM. It does not grant forms, popups, navigation privileges or same-origin access.
- HTML is sanitized server-side before rendering.
- Local linked CSS files are parsed; imports, external resource URLs and behavior-like declarations are removed.
- The preview response applies a restrictive CSP and disables network connections, media and external fonts.
- JavaScript from imported projects is not executed. The only script is a StudioForge-owned, same-origin selection bridge allowed by CSP; it reports hover and selection metadata and does not execute project code. Framework projects require a separately isolated runtime provider before they can run.
- This preview is a compatibility-limited static renderer, not a full browser-equivalent execution environment.

## Local source editing boundary

The local source editor accepts only an explicit text-extension allowlist and limits each saved file to 1 MiB. Save requests validate the project manifest membership and normalized path, reject symlinks and targets outside the extracted project root, write through a unique temporary file, then atomically replace the target. The manifest's recorded file size is updated after a successful write.

The local filesystem import and edit routes are development-oriented. Production editing remains disabled by default until authentication, per-project ownership authorization, and private user-scoped storage are implemented. The current local workspace is not a multi-user production storage design.

## Preview selection bridge

The current selection bridge is limited to the sanitized static preview; it is not the final live-runtime bridge. The iframe has `sandbox="allow-scripts"` without `allow-same-origin`, so it retains an opaque origin and cannot access the app origin's cookies or storage. The bridge posts only element metadata using a versioned protocol and a per-preview session identifier. The parent checks the exact iframe `contentWindow` and session identifier before accepting messages. Because sandboxed opaque-origin messages serialize their origin as `null`, source-window and session checks are used for this dedicated preview frame; every message type and payload must also be schema-validated. Never send secrets or privileged commands through this channel.

The preview bridge is StudioForge-owned code injected with a per-response CSP nonce; project-supplied scripts remain removed. The bridge uses `postMessage` for the isolated frame boundary. See the browser security guidance for validating sender identity and message shape: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage.
