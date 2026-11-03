# Aurora Desktop

This directory contains the native desktop automation component used by the Aurora integration.

## Components

- `agent-desktop/` — Git submodule pointing to the maintained fork at
  https://github.com/masazajcenko-boop/agent-desktop
- `../docs/DESKTOP-INTEGRATION.md` — integration architecture, Windows setup notes,
  privacy boundaries and the planned Aurora bridge contract.

The submodule is intentionally kept separate from the Chrome extension and A-RAG.
It retains its upstream Apache-2.0 license and notices. The Agent repository's own
license remains unchanged.

## Current status

The source repository is linked here; this does not yet mean the native CLI is
installed on Windows or that Aurora can invoke it from the extension. Follow the
integration document before enabling any desktop actions.
