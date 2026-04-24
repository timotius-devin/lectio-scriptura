# ✝ Lectio Scriptura

> AI-powered Bible study with commentary in the voice of the great Reformed theologians.
> Supports English (KJV, WEB) with EN/ID UI language toggle.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Sources & Citations](#sources--citations)
3. [Project Structure](#project-structure)
4. [API Key Safety](#api-key-safety)
5. [Run Locally](#run-locally)
6. [Run Headless (CLI / Script)](#run-headless-cli--script)
7. [Deploy to Fly.io](#deploy-to-flyio)
8. [Deploy Frontend to Vercel (optional)](#deploy-frontend-to-vercel-optional)
9. [Environment Variables Reference](#environment-variables-reference)
10. [Theologians & Knowledge Base](#theologians--knowledge-base)
11. [Guardrails](#guardrails)
12. [Contributing](#contributing)

---

## What It Does

1. You enter a Bible passage reference (e.g. `Romans 8:1-11`)
2. The app fetches the passage text from [bible-api.com](https://bible-api.com)
3. Claude generates deep commentary in the voice and theological tradition of your chosen theologian
4. A persistent chat lets you ask follow-up questions about the passage
5. Supports EN/ID language toggle — all UI, commentary, and chat responses switch language

---

## Sources & Citations

### Bible Text
- **Source:** [bible-api.com](https://bible-api.com) — a free, open REST API, no key required
- **Underlying data:** [github.com/wldeh/bible-api](https://github.com/wldeh/bible-api)
- **KJV** — King James Version (1611). Public domain. Crown copyright expired.
- **WEB** — World English Bible. Public domain. Modern English, no copyright restrictions.

### AI Commentary
All commentary is **AI-generated** by Claude (Anthropic) in the voice and theological tradition
of the named theologian. It is **not** verbatim text from their published works.
Each commentary panel is labelled: *"AI-generated · Claude (Anthropic) · Not verbatim [Theologian]"*

### Reformed Confessional Texts (Knowledge Base)
All documents injected into Claude's context are **public domain**:

| Document | Author / Body | Year |
|---|---|---|
| Westminster Confession of Faith | Westminster Assembly | 1646 |
| Westminster Shorter Catechism | Westminster Assembly | 1647 |
| Westminster Larger Catechism | Westminster Assembly | 1648 |
| Heidelberg Catechism | Ursinus & Olevianus | 1563 |
| Belgic Confession | Guido de Brès | 1561 |
| Canons of Dort | Synod of Dort | 1618–1619 |
| Second Helvetic Confession | Heinrich Bullinger | 1566 |
| Institutes of the Christian Religion | John Calvin | 1559 |
| Apostles' Creed | Ancient, c. 2nd–9th century | — |
| Nicene Creed | Council of Nicaea / Constantinople | 325, 381 AD |
| Athanasian Creed | Unknown, attributed to Athanasius | c. 5th century |

### AI Model
- **Claude Sonnet 4** by Anthropic — [anthropic.com](https://anthropic.com)
- API documentation: [docs.anthropic.com](https://docs.anthropic.com)

---

## Project Structure

```
lectio-scriptura/
│
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx             # Main app component (all UI + logic)
│   │   └── main.jsx            # React entry point
│   ├── index.html
│   ├── vite.config.js          # Dev proxy → backend at :8000
│   └── package.json
│
├── backend/                    # FastAPI backend (holds the API key)
│   ├── main.py                 # API proxy + health check
│   └── requirements.txt
│
├── docs/                       # Additional documentation (see below)
│
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions: lint + build on push
│
├── .env.example                # Template — copy to .env, fill in key
├── .gitignore                  # Excludes .env, node_modules, dist, etc.
├── Dockerfile                  # Multi-stage build for Fly.io
├── fly.toml                    # Fly.io deployment config
└── README.md                   # This file
```

---

## API Key Safety

> **The API key must never appear in source code, browser network requests, or git history.**

Here is how this project keeps it safe:

```
Browser (React)
    │
    │  POST /api/chat  ← only sends {messages, system}
    │  No API key in this request
    ▼
FastAPI Backend (your server)
    │
    │  Reads ANTHROPIC_API_KEY from environment variable
    │  Adds it to the Authorization header
    ▼
Anthropic Claude API
```

### Rules

| ✅ Safe | ❌ Never do this |
|---|---|
| Store key in `.env` (gitignored) | Hard-code key in any `.js` or `.py` file |
| Set as Fly.io secret (`fly secrets set`) | Commit `.env` to git |
| Read via `os.getenv()` in Python | Put key in `VITE_` env vars (these are public) |
| Rotate key if accidentally exposed | Share key in Slack, email, or GitHub issues |

### If You Accidentally Expose a Key
1. Go to [console.anthropic.com](https://console.anthropic.com) immediately
2. Revoke the exposed key
3. Generate a new key
4. Update your `.env` and Fly.io secrets
5. Audit your git history — if the key was committed, consider the repo compromised

---

## Run Locally

### Prerequisites
- Python 3.11+
- Node.js 20+
- An Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### Step 1 — Clone the repo

```bash
git clone https://github.com/your-username/lectio-scriptura.git
cd lectio-scriptura
```

### Step 2 — Set up your API key

```bash
cp .env.example .env
```

Open `.env` and replace `sk-ant-your-key-here` with your real key:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Do not commit this file.** It is already in `.gitignore`.

### Step 3 — Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Test it:
```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

### Step 4 — Start the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Step 5 — Use the app

1. Type a passage reference, e.g. `John 3:16` or `Roma 8:1-11`
2. Select a translation (KJV or WEB)
3. Select a theologian
4. Press **Study**
5. Read the commentary, then ask follow-up questions in the chat

---

## Run Headless (CLI / Script)

If you want to use the backend without the browser — e.g. for scripting, automation,
or generating commentary from the terminal — you can call the API directly.

### Start the backend (same as above)

```bash
cd backend
source venv/bin/activate
uvicorn main:app --port 8000
```

### Call it with curl

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "system": "You are John Calvin writing a biblical commentary. Be precise and Reformed.",
    "messages": [
      {
        "role": "user",
        "content": "Write a short commentary on John 3:16."
      }
    ]
  }'
```

### Call it with Python

```python
import requests

response = requests.post("http://localhost:8000/api/chat", json={
    "system": "You are Matthew Henry writing a pastoral commentary.",
    "messages": [
        {"role": "user", "content": "Comment on Psalm 23."}
    ]
})

print(response.json()["text"])
```

### Run as a one-shot script

```python
# headless_study.py
import requests

PASSAGE = "Romans 8:1-11"
THEOLOGIAN = "Charles Spurgeon"
SYSTEM = f"You are {THEOLOGIAN} writing a sermon commentary. Be vivid and applicational."

# Fetch passage from Bible API
import urllib.parse
bible = requests.get(f"https://bible-api.com/{urllib.parse.quote(PASSAGE)}?translation=kjv").json()
passage_text = bible["text"]

# Get commentary
result = requests.post("http://localhost:8000/api/chat", json={
    "system": SYSTEM,
    "messages": [{"role": "user", "content": f"Comment on {PASSAGE}:\n\n{passage_text}"}]
})

print(f"=== {THEOLOGIAN} on {PASSAGE} ===\n")
print(result.json()["text"])
```

```bash
python headless_study.py
```

---

## Deploy to Fly.io

This is the recommended production path — single Fly.io app serves both backend and frontend.

### Prerequisites
- [Fly CLI installed](https://fly.io/docs/getting-started/installing-flyctl/)
- A Fly.io account (free tier works for personal use)

### Step 1 — Build the frontend first

```bash
cd frontend
npm install
npm run build
cd ..
```

This generates `frontend/dist/` which the Dockerfile copies into the image.

### Step 2 — Launch the app (first time only)

```bash
fly launch
```

When prompted:
- App name: `lectio-scriptura` (or your preferred name)
- Region: `syd` (Sydney, closest to Melbourne)
- Do NOT deploy yet

### Step 3 — Set your API key as a Fly secret

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

This stores the key encrypted in Fly's secret store. It is injected as an
environment variable at runtime. It **never** appears in the Dockerfile or
source code.

### Step 4 — Deploy

```bash
fly deploy
```

### Step 5 — Open it

```bash
fly open
```

Your app is live at `https://lectio-scriptura.fly.dev` (or your custom domain).

### Subsequent deploys

```bash
cd frontend && npm run build && cd ..
fly deploy
```

---

## Deploy Frontend to Vercel (optional)

If you prefer to host the frontend separately on Vercel and the backend on Fly.io:

### Step 1 — Deploy backend to Fly.io (as above, steps 1–4)

Note your backend URL, e.g. `https://lectio-scriptura.fly.dev`

### Step 2 — Deploy frontend to Vercel

```bash
cd frontend
npx vercel
```

When prompted, set the environment variable:
```
VITE_API_BASE_URL = https://lectio-scriptura.fly.dev
```

This tells the frontend where to send API requests.

### Step 3 — Update CORS in backend

In `backend/main.py`, update the `allow_origins` list:

```python
allow_origins=["https://your-app.vercel.app"],
```

Redeploy the backend: `fly deploy`

---

## Environment Variables Reference

| Variable | Where | Required | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Backend only | ✅ Yes | Your Anthropic API key. Never in frontend. |
| `VITE_API_BASE_URL` | Frontend build | ❌ No | Backend URL for production. Empty = same origin. |

---

## Theologians & Knowledge Base

### Theologians

All commentaries are AI-generated in the voice of each theologian, not verbatim quotes.

| Theologian | Tradition | Style |
|---|---|---|
| John Calvin (1509–1564) | Reformed, Geneva | Precise, exegetical, covenantal |
| Matthew Henry (1662–1714) | Puritan, Presbyterian | Pastoral, devotional, applicational |
| N.T. Wright (1948–present) | Anglican, New Perspective | Narrative, historical-critical |
| Charles Spurgeon (1834–1892) | Particular Baptist | Preacher, vivid, evangelistic |
| Martin Luther (1483–1546) | Lutheran | Law/gospel, direct, earthy |
| Thomas Aquinas (1225–1274) | Roman Catholic, Scholastic | Systematic, logical, patristic |

### Reformed Knowledge Base

Claude is given a detailed summary of eleven confessional documents as part of its
system prompt on every request (see `App.jsx` → `REFORMED_KNOWLEDGE`).
It is instructed to cite these documents specifically by chapter, article, or
question number when relevant.

---

## Guardrails

The app enforces strict scope on chat responses:

**Allowed:**
- Questions about the current Bible passage
- Christian theology, doctrine, biblical interpretation
- Reformed/Presbyterian confessional standards
- Church history, Christian ethics, spiritual application
- Philosophy or history if meaningfully connected to Scripture

**Declined (guardrail triggered):**
- Sports, cooking, programming, entertainment, politics, general trivia
- Any question clearly unrelated to the Bible or Christian faith

When declined, a shield icon and a gracious message are shown in the chat.
The system never returns a cold error — always a pastoral redirect.

---

## Contributing

Pull requests welcome. Please:
- Keep `.env` out of commits (check `.gitignore`)
- Run `ruff check backend/` before pushing Python changes
- Run `npm run build` before pushing frontend changes to verify it compiles
- Document any new theologians added with era and tradition in this README

---

*Soli Deo Gloria*
