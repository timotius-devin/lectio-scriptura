# Lectio Scriptura — Agent Guide

## Architecture
- Monorepo with two dirs: `backend/` (single `main.py` FastAPI app) and `frontend/` (single `App.jsx` React + Vite)
- No TypeScript, no router, no external CSS, no database, no tests
- All state in-memory via `cachetools.TTLCache` (lost on restart)
- API key lives server-side in `ANTHROPIC_API_KEY` env var; never in frontend or `VITE_` vars

## Commands
- Backend: `uvicorn main:app --reload --port 8000` (from `backend/`, with venv active)
- Lint: `ruff check backend/` (CI also runs this); auto-fix: `ruff check --fix backend/`
- Frontend dev: `npm run dev` (from `frontend/`)
- Frontend build: `npm run build` (required before deploy)
- Quick start: `./run-be.sh` or `./run-fe.sh` (auto-creates venv / installs deps)

## Deploy (Fly.io)
- Build frontend first: `cd frontend && npm run build && cd ..`
- Set secret: `fly secrets set ANTHROPIC_API_KEY=sk-ant-...`
- Deploy: `fly deploy`

## Prompt Caching
- System prompt split on `[CACHE_BREAK]` — static prefix (theologian voice + confessions + rules) cached ephemerally via Anthropic's `cache_control`; dynamic suffix (passage + guardrail) uncached
- Handled in `backend/main.py:127-131` and `App.jsx:363-367`

## Guardrails
- Off-topic chats cause Claude to return JSON `{"guardrail":true,"message":"..."}` — parsed in `App.jsx:parseGuardrail()`

## Key Conventions
- `.env` contains a real API key — never commit, never include in diffs/shared output
- `.npmrc` sets `legacy-peer-deps=true`
- No test framework or test files exist
- CORS currently open (`["*"]`); production should restrict to frontend origin
