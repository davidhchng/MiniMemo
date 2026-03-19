# MiniMemo Data Analytics

**Upload a dataset. Add context. Get a structured, tailored analytics report.**

MiniMemo Data Analytics is a lightweight analytics report generator that profiles tabular datasets, surfaces insights, and produces clean, readable reports.

**Live:** [mini-memo-data-analytics.vercel.app](https://mini-memo-data-analytics.vercel.app)

---

## What It Does

1. Upload one or more datasets (CSV, XLSX, TSV, JSON, JSONL, Parquet)
2. Optionally describe your goal and dataset background
3. Receive a structured report covering:
   - Column types, null rates, cardinality, and distributions
   - Outlier detection across numeric columns
   - Correlation analysis between measures
   - Group breakdowns by dimension
   - Time trends when date columns are present
   - Ranked, actionable recommendations

All analysis is deterministic. An LLM optionally rewrites narrative sections — but never invents numbers.

---

## Example Report

![Example report — dashboard view](examples/sales_large-dashboard%20(2).png)

Full report (PDF): [examples/MiniMemo example report.pdf](examples/MiniMemo%20example%20report.pdf)

Given a sales dataset with columns `date`, `revenue`, `category`, `region`:

**Dataset Overview**
- 50 rows x 4 columns
- Dimensions: category, region
- Time dimension: date

**Insights**
- `category` — 3 unique values. Top: A (44%), B (30%), C (26%)
- `region` — 3 unique values. Top: North (40%), South (30%), East (30%)
- Datetime column `date` detected — trend chart rendered if series has 6+ points

**Recommendations**
- With 2 grouping dimensions available (category, region), cross-dimensional analysis may reveal interaction effects not visible in single-dimension breakdowns

**Assumptions & Limitations**
- Statistical patterns noted where sample size may limit generalisability
- Columns classified as identifiers are excluded from aggregations

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), Zustand, Plotly |
| Backend | FastAPI, pandas, pyarrow |
| AI (optional) | OpenAI or Gemini — narrative rewriting only |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Running Locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # add OPENAI_API_KEY or GEMINI_API_KEY if wanted
python run.py
# → http://localhost:8001
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
# → http://localhost:3000
```

---

## Supported File Formats

| Format | Extensions |
|---|---|
| CSV | `.csv` |
| Excel | `.xlsx` |
| Tab-separated | `.tsv`, `.tab` |
| JSON | `.json` |
| JSON Lines | `.jsonl`, `.ndjson` |
| Parquet | `.parquet` |

Up to 200,000 rows per file. Multiple files supported in one session.

---

## Project Structure

```
MiniMemo/
├── backend/
│   ├── main.py           # FastAPI app, /analyze endpoint, LRU cache
│   ├── models.py         # Pydantic data contracts
│   ├── processing.py     # Deterministic pandas profiling
│   ├── report/
│   │   ├── charts.py     # Plotly chart spec builders
│   │   ├── llm_client.py # Provider-abstracted LLM interface
│   │   └── narrative.py  # Optional AI narrative layer
│   ├── Procfile          # Railway deployment
│   └── runtime.txt       # Python 3.12
│
└── frontend/
    ├── app/
    │   ├── page.tsx           # Landing page
    │   ├── upload/page.tsx    # File upload
    │   ├── context/page.tsx   # Goals + background form
    │   ├── report/page.tsx    # Report display
    │   └── api/analyze/       # Next.js proxy to backend
    ├── lib/
    │   ├── types.ts           # TypeScript mirrors of backend models
    │   └── api.ts             # Fetch wrapper
    └── store/
        └── report-store.ts    # Zustand state
```

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | [mini-memo-data-analytics.vercel.app](https://mini-memo-data-analytics.vercel.app) |
| Backend | Railway | [minimemo-production.up.railway.app](https://minimemo-production.up.railway.app) |

**Environment variables required:**

Frontend (Vercel):
```
BACKEND_URL=https://minimemo-production.up.railway.app
```

Backend (Railway):
```
OPENAI_API_KEY=...         # or GEMINI_API_KEY — at least one for AI narrative
ALLOWED_ORIGINS=https://mini-memo-data-analytics.vercel.app
```

---
