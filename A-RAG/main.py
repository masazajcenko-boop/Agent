from contextlib import asynccontextmanager
from pathlib import Path
import os
import sqlite3

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("A_RAG_DATA_DIR", ROOT / "data")).expanduser()
DB_PATH = Path(os.environ.get("A_RAG_DB_PATH", DATA_DIR / "rag.sqlite3")).expanduser()
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with connect() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, content TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
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
    description="Local-first memory service for Chrome Crawler Agent.",
    version="0.1.1",
    lifespan=lifespan,
)


class DocumentIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=500000)
    source: str = Field(default="manual", max_length=100)


class SearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    limit: int = Field(default=5, ge=1, le=20)


@app.get("/")
def root():
    return {"service": "A-RAG Local Memory", "status": "running", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "A-RAG Local Memory", "mode": "local"}


@app.post("/documents")
def add_document(item: DocumentIn):
    title, content = item.title.strip(), item.content.strip()
    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content cannot be blank")
    with connect() as con:
        cur = con.execute(
            "INSERT INTO documents(title,content,source) VALUES(?,?,?)",
            (title, content, item.source.strip() or "manual"),
        )
        doc_id = cur.lastrowid
    return {"ok": True, "id": doc_id, "title": title}


@app.get("/documents")
def list_documents(limit: int = 50):
    limit = max(1, min(limit, 200))
    with connect() as con:
        rows = con.execute(
            "SELECT id,title,source,created_at,length(content) AS chars "
            "FROM documents ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.post("/search")
def search(item: SearchIn):
    query = item.query.strip()
    with connect() as con:
        try:
            tokens = [token.replace('"', '""') for token in query.split() if token.strip()]
            fts_query = " AND ".join(f'"{token}"' for token in tokens)
            rows = con.execute(
                """SELECT d.id,d.title,d.content,d.source,d.created_at,
                    snippet(documents_fts,1,'[',']','…',18) AS excerpt
                FROM documents_fts JOIN documents d ON d.id=documents_fts.rowid
                WHERE documents_fts MATCH ? ORDER BY rank LIMIT ?""",
                (fts_query, item.limit),
            ).fetchall()
        except sqlite3.OperationalError:
            terms = [f"%{term}%" for term in query.split()[:8]]
            if not terms:
                return {"query": query, "results": []}
            where = " AND ".join("content LIKE ?" for _ in terms)
            rows = con.execute(
                f"SELECT id,title,content,source,created_at,"
                f"substr(content,1,500) AS excerpt FROM documents WHERE {where} "
                f"ORDER BY id DESC LIMIT ?",
                (*terms, item.limit),
            ).fetchall()

    return {
        "query": query,
        "results": [
            {
                "id": row["id"], "title": row["title"], "source": row["source"],
                "created_at": row["created_at"],
                "excerpt": row["excerpt"] or row["content"][:500],
                "content": row["content"],
            }
            for row in rows
        ],
    }
