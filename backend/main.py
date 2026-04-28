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

import os
from typing import Literal

import anthropic
from fastapi import FastAPI, HTTPException
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
    """
    Proxy a chat request to the Claude API.
    The API key is read from the server environment — never from the request.
    """
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=5000,
            system=req.system,
            messages=[m.model_dump() for m in req.messages],
        )
        block = response.content[0] if response.content else None
        if block is None or block.type != "text":
            raise HTTPException(status_code=502, detail="Unexpected response format from Claude API.")
        text = block.text
        if response.stop_reason == "max_tokens":
            text += "\n\n---\n*The response reached the length limit. Ask me to continue if you'd like more.*"
        return ChatResponse(text=text)

    except HTTPException:
        raise  # preserve HTTPExceptions we raise ourselves (e.g. bad content-type check)
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Anthropic API key.")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit reached. Try again shortly.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


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
