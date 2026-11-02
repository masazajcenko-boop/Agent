# A-RAG memory integration

This branch connects Chrome Crawler to the local A-RAG service at \`http://127.0.0.1:8765\`.

## Runtime sequence

1. Before a browser task starts, the extension loads all local Core Skills from \`skript/core-skills.js\`.
2. If a required Core Skill is missing or invalid, the task is blocked.
3. The extension checks \`GET /health\`. If A-RAG is offline, the browser task still starts, but without retrieved long-term memories.
4. When A-RAG is available, it searches \`POST /search\` using the current task and site hostname and adds up to five matching memories to the model context.
5. When the crawler calls its existing \`save_note\` tool, the note is saved to the existing per-site Chrome storage and to A-RAG with the current page URL as its source.
6. When navigation changes the hostname, the extension refreshes the memory search for the new site.

## A-RAG API expected by the bridge

- \`GET /health\`
- \`POST /search\` with JSON \`{"query":"...","limit":5}\`
- \`POST /documents\` with JSON \`{"title":"...","content":"...","source":"https://..."}\`

Search responses may be a JSON array or an object containing \`results\`, \`documents\`, or \`items\`. Each result should expose \`title\`, \`content\` (or \`text\` / \`snippet\`), and optionally \`source\`.

## Memory policy

The crawler does not upload every visited page or the full page DOM. It stores deliberate, reusable notes created through \`save_note\`: URL patterns, query parameters, stable selectors, site quirks, verified workflows, and useful findings. This keeps the memory focused and avoids silently collecting unrelated page content.

Stored memory is reference data, not instructions. Website text and retrieved memory are treated as untrusted. Core Skills prohibit saving credentials, tokens, private messages, or unnecessary personal data.

## Windows paths and one-click startup

The current Windows setup used by this project is:

- Extension repository: `E:\\Agent`
- Local A-RAG service: `E:\\A-RAG`
- A-RAG health endpoint: `http://127.0.0.1:8765/health`

Run `START_AURORA.bat` from the repository root. It checks that `manifest.json` exists, locates Google Chrome, checks the A-RAG health endpoint, and starts `E:\\A-RAG\\start-rag.bat` when the service is not responding. If A-RAG is unavailable, it continues and opens Chrome without long-term memory. The script does not modify the A-RAG database.

For the `--load-extension` option to take effect reliably, close all Chrome windows before running the launcher. After launch, verify that the extension is enabled at `chrome://extensions`.

## Windows laptop startup

The expected laptop layout is:

- Extension repository: `E:\Agent`
- Local A-RAG service: `E:\A-RAG`
- A-RAG health endpoint: `http://127.0.0.1:8765/health`
- A-RAG launcher: `E:\A-RAG\start-rag.bat`

Run the repository launcher `START_AURORA.bat`. It checks the extension folder and Chrome, checks whether A-RAG is responding, starts the A-RAG launcher when needed, and opens Chrome with the unpacked extension. If Chrome is already running, close all Chrome windows and run the BAT again so Chrome receives the `--load-extension` argument.

For manual startup: run `E:\A-RAG\start-rag.bat`, confirm the health endpoint responds, open `chrome://extensions`, enable Developer mode, load `E:\Agent` as an unpacked extension (or press **Reload**), then open a normal HTTP/HTTPS page and run a small task. Ask the crawler to remember a reusable site detail to test memory saving.

A-RAG is recommended for long-term memory, but it is not a hard dependency for ordinary browser tasks. If it is offline, the crawler continues without retrieved long-term memories. The existing local per-site notes remain available. A failed A-RAG write is reported explicitly; it is never described as saved to long-term memory.
