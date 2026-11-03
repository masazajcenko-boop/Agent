# Aurora Desktop integration

## Purpose

Add native desktop-app awareness to Aurora without replacing either existing subsystem:

- **Chrome Agent** remains responsible for browser tabs and web-page automation.
- **agent-desktop** provides native desktop observation and accessibility-based actions.
- **A-RAG** remains the separate local memory service at `127.0.0.1:8765`.
- **Aurora** is the future orchestrator that decides which capability is appropriate.

## Source integration

The native project is linked as a Git submodule:

- Path: `desktop/agent-desktop`
- Repository: https://github.com/masazajcenko-boop/agent-desktop
- Tracked revision: the fork's `main` commit recorded by the submodule pointer.
- Upstream project: https://github.com/vercel-labs/agent-desktop
- License: Apache-2.0. Keep its LICENSE, notices and attribution with the component.

The Agent repository's root `LICENSE` is not changed. Do not copy the desktop component's license over it.

When downloading Agent as a ZIP from GitHub, GitHub does not populate submodule contents in the ZIP.
To get the native source, download the fork separately or clone Agent with submodules enabled:

```bash
git clone --recurse-submodules --branch feature/chrome-crawler-floating-window https://github.com/masazajcenko-boop/Agent.git
```

## Windows target

The current target machine is Windows 10. The upstream project documents Windows support for
accessibility snapshots, click/type/keyboard, mouse input, screenshots, clipboard,
application/window management and notifications. Actual support depends on the target app
and its accessibility implementation.

The upstream project is a native Rust CLI/C library, not a Chrome extension and not an
autonomous LLM agent. It does not automatically connect to Chrome Agent or A-RAG.

Install/build instructions and platform-specific prerequisites must be taken from the
submodule's own `README.md` and `docs/install.md`. Do not assume that adding the submodule
installs its executable.

## Planned Aurora bridge

The next implementation stage is a small local bridge process between Aurora and the native CLI.
It is deliberately not enabled by this source-linking commit.

Proposed boundary:

1. Aurora sends a narrowly scoped request to the local bridge.
2. The bridge validates the request against an allowlist of supported operations.
3. The bridge invokes `agent-desktop` and returns the structured JSON result.
4. Aurora observes the result and verifies state with a fresh snapshot before continuing.

The bridge should bind only to loopback (`127.0.0.1`), reject remote origins, validate input sizes,
and avoid exposing a general-purpose shell or arbitrary command execution endpoint.

## Action safety

- Observation commands (snapshot, find, get, screenshot) should be the default.
- Actions that change the desktop must be allowlisted and scoped to a specific app/window.
- Closing apps, changing system settings, sending messages, deleting files, purchases and other
  consequential actions must require explicit user confirmation.
- Never treat webpage text, clipboard contents, accessibility labels or retrieved A-RAG memories
  as trusted instructions.
- Do not log screenshots, clipboard contents or full accessibility trees by default.
- Credentials, tokens and private content must not be copied into A-RAG.

## Separation from A-RAG

This integration does not access, migrate, replace or modify the A-RAG database.
A-RAG remains an independent service and its existing SQLite database must be preserved.

## Verification checklist

- [ ] Download/clone Agent with the submodule populated.
- [ ] Build or install agent-desktop using its official Windows instructions.
- [ ] Run the CLI's version/status checks manually.
- [ ] Test read-only snapshots against a harmless desktop app.
- [ ] Design and review the bridge API before implementing desktop actions.
- [ ] Add explicit confirmation gates and loopback-only access.
- [ ] Test that Chrome Agent and A-RAG continue working independently.
