# A-RAG — local-first memory service

A-RAG is the local persistent-memory service used by Chrome Crawler Agent. It stores deliberate notes in SQLite and searches them with SQLite FTS5 when available, falling back to SQL LIKE search.

## Compatibility

Default endpoint: **http://127.0.0.1:8765** — matches `panel/rag-bridge.js` in this repository branch.

API:
- `GET /` — service information
- `GET /health` — health check
- `POST /documents` — save a memory
- `GET /documents?limit=50` — list memory metadata
- `POST /search` — search saved memories

Search body: `{"query":"site workflow","limit":5}`.

## Windows quick start

1. Install Python 3.10+ and ensure the `py` launcher is available.
2. Optionally copy `config.bat.example` to `config.bat` and edit settings. Defaults already match Agent.
3. Run `install-rag.bat` once.
4. Run `start-rag.bat`.
5. Check `http://127.0.0.1:8765/health` or run `test-rag.bat`.

The installer creates a local `.venv`, which is excluded from Git.

### Safe code updates on Windows

1. Stop the A-RAG server window.
2. Run `update-rag.bat` from this folder.
3. The updater downloads an explicit allowlist of program files into a temporary staging folder, validates the downloads, backs up the current versions, and then copies the updates.
4. Run `install-rag.bat` only if dependencies changed or the environment is new.
5. Run `start-rag.bat`, then `test-rag.bat`.

The updater is pinned to the `feature/agent-a-rag-integration` branch. It does not copy or delete `data/`, SQLite databases, `.venv/`, `config.bat`, or any other unlisted file. If copying a program file fails, it attempts to restore the previous program files. Keep a separate backup of important data as usual.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `A_RAG_HOST` | `127.0.0.1` | Bind address |
| `A_RAG_PORT` | `8765` | HTTP port |
| `A_RAG_DATA_DIR` | `A-RAG/data` | Default data directory |
| `A_RAG_DB_PATH` | `A_RAG_DATA_DIR/rag.sqlite3` | Explicit database path |

On Windows, put overrides in your private `config.bat` (ignored by Git). By default, the database is created under this folder's `data/`. To continue using an existing database, set `A_RAG_DB_PATH` to its current absolute path in `config.bat`; do not copy or overwrite the database during code updates.

## Agent integration

Agent calls A-RAG through `panel/rag-bridge.js`: health check before tasks, search before task execution, and deliberate memory writes through the existing `save_note` flow.

A-RAG is optional at runtime. If it is offline, normal browser tasks continue without retrieved long-term memories.

## Data and privacy

- The database is created locally and excluded by `.gitignore`.
- Never commit `data/`, SQLite files, `.venv/`, `config.bat`, `.env`, credentials, or personal memory exports.
- The server binds to loopback (`127.0.0.1`) by default. Do not expose it to the public internet.

## Linux / macOS

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8765
```

Set `A_RAG_DB_PATH` or `A_RAG_DATA_DIR` in the process environment to choose another local database location.

## Current scope

This is the first local-memory foundation: SQLite storage and lexical full-text search. Semantic/vector embeddings, cloud synchronization, Google Drive, Telegram intake, and automatic skill ingestion are not implemented in this version.
