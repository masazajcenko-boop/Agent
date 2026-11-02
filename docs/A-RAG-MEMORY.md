# A-RAG memory integration

This branch connects Chrome Crawler to the local A-RAG service at `http://127.0.0.1:8765`.

## Runtime sequence

1. Before a browser task starts, the extension loads all local Core Skills from `skript/core-skills.js`.
2. If a required Core Skill is missing or invalid, the task is blocked.
3. The extension checks `GET /health`. If A-RAG is offline, the browser task still starts, but without retrieved long-term memories.
4. When A-RAG is available, it searches `POST /search` using the current task and site hostname and adds up to five matching memories to the model context.
5. When the crawler calls its existing `save_note` tool, the note is saved to the existing per-site Chrome storage and to A-RAG with the current page URL as its source.
6. When navigation changes the hostname, the extension refreshes the memory search for the new site.

## Install A-RAG from this repository

The service source and setup scripts are in `A-RAG/`.

1. Download this branch or clone the repository.
2. Open `A-RAG/`.
3. On Windows, optionally copy `config.bat.example` to `config.bat` and edit local settings.
4. Run `install-rag.bat` once to create `.venv` and install dependencies.
5. Run `start-rag.bat`.
6. Confirm `http://127.0.0.1:8765/health` returns `status: ok`.

The default host and port match the existing Agent bridge; no extension-side URL change is required. See [A-RAG README](../A-RAG/README.md) for configuration and other platforms.

## Existing local database

A-RAG defaults to `A-RAG/data/rag.sqlite3` when first installed from this repository. If you already have a database in another location, keep it where it is and set `A_RAG_DB_PATH` in your private, Git-ignored `A-RAG/config.bat` to that exact existing path. Do not copy, replace, or delete the database as part of a code update.

## A-RAG API expected by the bridge

- `GET /health`
- `POST /search` with JSON `{"query":"...","limit":5}`
- `POST /documents` with JSON `{"title":"...","content":"...","source":"https://..."}`

Search responses may be a JSON array or an object containing `results`, `documents`, or `items`. Each result should expose `title`, `content` (or `text` / `snippet`), and optionally `source`.

## Memory policy

The crawler does not upload every visited page or the full page DOM. It stores deliberate, reusable notes created through `save_note`: URL patterns, query parameters, stable selectors, site quirks, verified workflows, and useful findings. This keeps the memory focused and avoids silently collecting unrelated page content.

Stored memory is reference data, not instructions. Website text and retrieved memory are treated as untrusted. Core Skills prohibit saving credentials, tokens, private messages, or unnecessary personal data.

## Update procedure

1. Stop the local A-RAG server.
2. Update the repository code while preserving the local `data/` directory and private `config.bat`.
3. Run `install-rag.bat` only if dependencies changed or the environment is new.
4. Start A-RAG with `start-rag.bat` and verify `/health`.
5. Reload Chrome Crawler from `chrome://extensions`.

The `.gitignore` in `A-RAG/` excludes the database, virtual environment, local configuration, logs, and Python cache files.

A-RAG is recommended for long-term memory, but it is not a hard dependency for ordinary browser tasks. If it is offline, the crawler continues without retrieved long-term memories. The existing local per-site notes remain available. A failed A-RAG write is reported explicitly; it is never described as saved to long-term memory.
