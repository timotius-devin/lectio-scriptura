"""
backend/main.py
FastAPI backend for Lectio Scriptura.

Responsibilities:
- Holds the ANTHROPIC_API_KEY server-side (never exposed to the browser)
- Proxies Claude API requests from the frontend
- Validates request shape and enforces a max-token cap
- Serves the built frontend in production (optional — see README)

Run locally:
    uvicorn main:app --reload --port 8000
"""

import hashlib
import json
import os
from typing import Literal
from urllib.parse import quote

import anthropic
import httpx
from cachetools import TTLCache
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ── Environment ───────────────────────────────────────────────────
#
# NEVER hard-code your API key here.
# Set it in your shell or in a .env file (loaded below).
#
# Local development:
#   Copy .env.example → .env and fill in your key.
#   The key is read from the environment at startup.
#
# Production (Fly.io):
#   fly secrets set ANTHROPIC_API_KEY=sk-ant-...
#   The key is injected as an environment variable — never in source code.
#

from dotenv import load_dotenv
load_dotenv()  # loads .env if present; no-op in production where env vars are set directly

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise RuntimeError(
        "ANTHROPIC_API_KEY is not set. "
        "Copy .env.example to .env and add your key, or set the environment variable directly."
    )

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ── Caches ─────────────────────────────────────────────────────────
# Response cache: Claude API responses keyed by request hash (6h TTL)
RESPONSE_CACHE = TTLCache(maxsize=128, ttl=21600)

# Bible passage cache: bible-api.com responses (24h TTL — scripture never changes)
BIBLE_CACHE = TTLCache(maxsize=512, ttl=86400)


def _cache_key(messages, system):
    """Hash the request payload for cache lookup."""
    payload = json.dumps({"messages": messages, "system": system}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()

# ── App ───────────────────────────────────────────────────────────
app = FastAPI(
    title="Lectio Scriptura API",
    description="Backend proxy for Claude API — keeps the API key server-side.",
    version="1.0.0",
)

# CORS: in production, restrict this to your actual frontend domain.
# e.g. allow_origins=["https://lectio.yourdomain.com"]
'''
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)
'''
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # open for local dev only
    allow_credentials=False,      # must be False when using "*"
    allow_methods=["*"],
    allow_headers=["*"],
)
# ── Request / Response models ─────────────────────────────────────

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=20_000)

class ChatRequest(BaseModel):
    messages: list[Message] = Field(..., min_length=1, max_length=50)
    system: str = Field(..., max_length=30_000)

class ChatResponse(BaseModel):
    text: str

# ── Routes ────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Health check endpoint — used by Fly.io and CI."""
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Proxy a chat request to the Claude API. Uses in-memory cache and prompt caching."""
    messages = [m.model_dump() for m in req.messages]

    # Check response cache for identical requests
    key = _cache_key(messages, req.system)
    if key in RESPONSE_CACHE:
        return RESPONSE_CACHE[key]

    # Split system prompt for Claude's prompt caching.
    # Frontend inserts [CACHE_BREAK] between static prefix and dynamic suffix.
    parts = req.system.split("[CACHE_BREAK]", 1)
    if len(parts) == 2:
        system = [
            {"type": "text", "text": parts[0], "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": parts[1]},
        ]
    else:
        system = req.system

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=5000,
            system=system,
            messages=messages,
        )
        block = response.content[0] if response.content else None
        if block is None or block.type != "text":
            raise HTTPException(status_code=502, detail="Unexpected response format from Claude API.")
        text = block.text
        if response.stop_reason == "max_tokens":
            text += "\n\n---\n*The response reached the length limit. Ask me to continue if you'd like more.*"

        result = ChatResponse(text=text)
        RESPONSE_CACHE[key] = result
        return result

    except HTTPException:
        raise
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Anthropic API key.")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit reached. Try again shortly.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


# ── Bible proxy (cached) ────────────────────────────────────────────

@app.get("/api/bible")
async def bible_proxy(reference: str = Query(...), translation: str = Query("kjv")):
    """Proxy bible-api.com with in-memory caching (24h TTL)."""
    cache_key = f"{reference}|{translation}"
    if cache_key in BIBLE_CACHE:
        return BIBLE_CACHE[cache_key]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://bible-api.com/{quote(reference)}",
                params={"translation": translation},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
        if data.get("error"):
            raise HTTPException(status_code=404, detail=data["error"])
        if not data.get("text"):
            raise HTTPException(status_code=404, detail="Bible API returned an empty passage.")
        BIBLE_CACHE[cache_key] = data
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Bible API error: {str(e)}")


# ── Serve built frontend in production (optional) ─────────────────
#
# If you've run `npm run build` in /frontend, FastAPI can serve the
# static files directly — no separate web server needed.
# Comment this out if you're hosting the frontend separately (e.g. Vercel).
#
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    from fastapi.responses import FileResponse

    @app.get("/")
    def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
