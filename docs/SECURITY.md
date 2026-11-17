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
