from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "rag.sqlite3"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def utc_now():
    return datetime.now(timezone.utc)


def init_db():
    """Create the original schema, then add scope metadata in-place.
    Existing rows are retained and treated as global memory.
    """
    with connect() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, content TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")

        columns = {row["name"] for row in con.execute("PRAGMA table_info(documents)").fetchall()}
        migrations = {
            "scope": "TEXT NOT NULL DEFAULT 'global'",
            "site": "TEXT NOT NULL DEFAULT ''",
            "task_id": "TEXT NOT NULL DEFAULT ''",
            "expires_at": "TEXT NOT NULL DEFAULT ''",
        }
        for name, definition in migrations.items():
            if name not in columns:
                con.execute(f"ALTER TABLE documents ADD COLUMN {name} {definition}")

        con.execute("CREATE INDEX IF NOT EXISTS idx_documents_scope_site ON documents(scope, site)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_documents_task ON documents(task_id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expires_at)")

        try:
            con.execute("""CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts
                USING fts5(title, content, content='documents', content_rowid='id')""")
            con.execute("""CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
                INSERT INTO documents_fts(rowid,title,content) VALUES(new.id,new.title,new.content); END""")
            con.execute("""CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
                INSERT INTO documents_fts(documents_fts,rowid,title,content)
                VALUES('delete',old.id,old.title,old.content); END""")
            con.execute("""CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
                INSERT INTO documents_fts(documents_fts,rowid,title,content)
                VALUES('delete',old.id,old.title,old.content);
                INSERT INTO documents_fts(rowid,title,content) VALUES(new.id,new.title,new.content); END""")
        except sqlite3.OperationalError:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="A-RAG Local Memory",
    description="Local-first memory service with global, site and task scopes.",
    version="0.2.0",
    lifespan=lifespan,
)


class DocumentIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=500000)
    source: str = Field(default="manual", max_length=500)
    scope: Literal["global", "site", "task"] = "global"
    site: str = Field(default="", max_length=255)
    task_id: str = Field(default="", max_length=100)


class SearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(default=5, ge=1, le=20)
    site: str = Field(default="", max_length=255)
    task_id: str = Field(default="", max_length=100)


def cleanup_expired(con):
    con.execute(
        "DELETE FROM documents WHERE expires_at <> '' AND expires_at <= ?",
        (utc_now().isoformat(),),
    )


@app.get("/")
def root():
    return {
        "service": "A-RAG Local Memory",
        "status": "running",
        "version": app.version,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "A-RAG Local Memory", "mode": "local", "version": app.version}


@app.post("/documents")
def add_document(item: DocumentIn):
    title, content = item.title.strip(), item.content.strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content cannot be blank")

    site = item.site.strip().lower().rstrip(".")
    task_id = item.task_id.strip()
    if item.scope == "site" and not site:
        raise HTTPException(status_code=400, detail="site is required for site-scoped memory")
    if item.scope == "task" and not task_id:
        raise HTTPException(status_code=400, detail="task_id is required for task-scoped memory")

    expires_at = ""
    if item.scope == "task":
        # Temporary task context is retained for up to seven days, then removed on access.
        expires_at = (utc_now() + timedelta(days=7)).isoformat()

    with connect() as con:
        cleanup_expired(con)
        cur = con.execute(
            """INSERT INTO documents(title,content,source,scope,site,task_id,expires_at)
               VALUES(?,?,?,?,?,?,?)""",
            (title, content, item.source.strip() or "manual", item.scope, site, task_id, expires_at),
        )
        doc_id = cur.lastrowid

    return {
        "ok": True,
        "id": doc_id,
        "title": title,
        "scope": item.scope,
        "site": site,
        "task_id": task_id,
        "expires_at": expires_at or None,
    }


@app.get("/documents")
def list_documents(limit: int = 50, scope: str = ""):
    limit = max(1, min(limit, 200))
    with connect() as con:
        cleanup_expired(con)
        if scope in ("global", "site", "task"):
            rows = con.execute(
                """SELECT id,title,source,scope,site,task_id,expires_at,created_at,
                          length(content) AS chars
                   FROM documents WHERE scope=? ORDER BY id DESC LIMIT ?""",
                (scope, limit),
            ).fetchall()
        else:
            rows = con.execute(
                """SELECT id,title,source,scope,site,task_id,expires_at,created_at,
                          length(content) AS chars
                   FROM documents ORDER BY id DESC LIMIT ?""",
                (limit,),
            ).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.post("/search")
def search(item: SearchIn):
    query = item.query.strip()
    if not query:
        return {"query": query, "results": []}

    site = item.site.strip().lower().rstrip(".")
    task_id = item.task_id.strip()
    # Only current task, current site and global knowledge are visible.
    # Legacy records were migrated with scope='global'.
    visibility = ["d.scope = 'global'"]
    params = []
    if site:
        visibility.append("(d.scope = 'site' AND d.site = ?)")
        params.append(site)
    if task_id:
        visibility.append("(d.scope = 'task' AND d.task_id = ?)")
        params.append(task_id)
    where_scope = "(" + " OR ".join(visibility) + ")"
    priorities = "CASE d.scope WHEN 'task' THEN 0 WHEN 'site' THEN 1 ELSE 2 END"

    with connect() as con:
        cleanup_expired(con)
        rows = []
        try:
            tokens = [token.replace('"', '""') for token in query.split() if token.strip()]
            fts_query = " AND ".join(f'"{token}"' for token in tokens)
            if fts_query:
                sql = f"""SELECT d.id,d.title,d.content,d.source,d.scope,d.site,d.task_id,
                                 d.created_at,d.expires_at,
                                 snippet(documents_fts,1,'[',']','…',18) AS excerpt
                          FROM documents_fts
                          JOIN documents d ON d.id=documents_fts.rowid
                          WHERE documents_fts MATCH ? AND {where_scope}
                          ORDER BY {priorities}, rank, d.id DESC LIMIT ?"""
                rows = con.execute(sql, (fts_query, *params, item.limit)).fetchall()
        except sqlite3.OperationalError:
            rows = []

        if not rows:
            terms = [f"%{token}%" for token in query.split()[:8] if token.strip()]
            if terms:
                where_text = " AND ".join("(d.content LIKE ? OR d.title LIKE ?)" for _ in terms)
                text_params = [value for term in terms for value in (term, term)]
                sql = f"""SELECT d.id,d.title,d.content,d.source,d.scope,d.site,d.task_id,
                                 d.created_at,d.expires_at,
                                 substr(d.content,1,500) AS excerpt
                          FROM documents d
                          WHERE {where_scope} AND {where_text}
                          ORDER BY {priorities}, d.id DESC LIMIT ?"""
                rows = con.execute(sql, (*params, *text_params, item.limit)).fetchall()

    return {
        "query": query,
        "results": [
            {
                "id": row["id"],
                "title": row["title"],
                "source": row["source"],
                "scope": row["scope"] or "global",
                "site": row["site"] or "",
                "task_id": row["task_id"] or "",
                "created_at": row["created_at"],
                "expires_at": row["expires_at"] or None,
                "excerpt": row["excerpt"] or row["content"][:500],
                "content": row["content"],
            }
            for row in rows
        ],
    }
