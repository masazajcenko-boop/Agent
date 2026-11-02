# A-RAG memory integration

This branch connects Chrome Crawler to the local A-RAG service at `http://127.0.0.1:8765`.

## Three memory scopes

All three scopes use the **same SQLite database** (`data/rag.sqlite3`):

- **Global** — reusable knowledge available on every site.
- **Site** — knowledge visible only on the matching hostname.
- **Task** — temporary context visible only to the current task ID. Task records expire after seven days.

The search order is task → site → global. Search never returns another site's records or another task's temporary records. Old records are retained and migrated as global memory.

## Runtime sequence

1. Before a browser task starts, the extension loads all local Core Skills from `skript/core-skills.js`.
2. If a required Core Skill is missing or invalid, the task is blocked.
3. The extension checks `GET /health`. If A-RAG is offline, the browser task still starts, but without retrieved long-term memories.
4. When A-RAG is available, it searches `POST /search` with the task text, current hostname and current task ID.
5. The existing `save_note` tool accepts `scope`: `site` (default), `global`, or `task`. Site notes are also kept in Chrome's per-site local storage.
6. When navigation changes the hostname, the extension refreshes memory search for the new site while retaining the current task ID.

## A-RAG API

- `GET /health`
- `POST /search`: `{"query":"...","limit":5,"site":"example.com","task_id":"..."}`
- `POST /documents`: `{"title":"...","content":"...","source":"...","scope":"global|site|task","site":"example.com","task_id":"..."}`
- `GET /documents`: lists recent entries; optional `scope=global|site|task`.

For compatibility, older clients may omit all scope fields. Such writes default to global memory. Existing database rows are migrated to global scope without deleting their content. The original endpoints and response fields remain available.

## Updating the local A-RAG server

The updated server files are in `A-RAG-server/` in this repository.

1. Keep a backup copy of `E:\A-rag\main.py`.
2. Copy `A-RAG-server\main.py`, `requirements.txt`, and `start-rag.bat` into `E:\A-rag\`, replacing the matching files.
3. **Do not delete or replace** `E:\A-rag\data\rag.sqlite3`.
4. Run `E:\A-rag\start-rag.bat`. It installs the listed Python packages into a local `.venv` if needed and starts the service.
5. On first startup, the server adds the new metadata columns to the existing database in place. Existing rows remain intact and are treated as global memory.

The service binds only to `127.0.0.1`; it is not exposed to the local network.

## Windows paths and launcher

- Extension repository: `E:\Agent`
- Local A-RAG service: `E:\A-rag`
- A-RAG health endpoint: `http://127.0.0.1:8765/health`

Run `START_AURORA.bat` from the repository root. It checks the extension folder and Chrome, checks whether A-RAG is responding, starts `E:\A-rag\start-rag.bat` when needed, and opens Chrome with the unpacked extension. If A-RAG is unavailable, the crawler continues without long-term memory. Close all Chrome windows before launching if you need the `--load-extension` argument to take effect.

## Memory policy

The crawler does not upload every visited page or the full page DOM. It stores deliberate, reusable notes created through `save_note`. Stored memory is reference data, not instructions. Website text and retrieved memory are treated as untrusted. Core Skills prohibit saving credentials, tokens, private messages, or unnecessary personal data.
