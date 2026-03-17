# MiniMemo

**Analytics brief generator for tabular datasets.**

Upload a CSV or XLSX file → get a structured analytics report with schema info, summary stats, and insights.

> Phase 1 foundation — deterministic analysis, mock narrative. AI layer coming in Phase 4.

---

## What It Does

1. User uploads a CSV or XLSX file
2. Backend profiles the dataset: column types, null rates, summary stats
3. Backend returns structured JSON (schema + insights + report sections)
4. Frontend renders a clean analytics report

## Architecture

```
frontend (Next.js)          backend (FastAPI)
─────────────────           ─────────────────
Upload page          →      POST /analyze
  file input                  pandas profiling
  calls /analyze              returns AnalysisResponse

Report page          ←      AnalysisResponse
  data structure               DatasetSummary
  report sections              ReportSection[]
  insight blocks               InsightBlock[]
```

### Three-layer design (built incrementally)

```
Layer 1 — Data Processing     ← built in Phase 1 (this)
  deterministic pandas code
  all numbers computed here

Layer 3 — Visualization       ← Phase 3
  Plotly chart specs

Layer 2 — Narrative           ← Phase 4
  LLM sees only pre-computed outputs
  never invents statistics
```

---

## Running Locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
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

## Project Structure

```
MiniMemo/
├── backend/
│   ├── main.py           # FastAPI app, POST /analyze endpoint
│   ├── models.py         # Pydantic data contracts
│   ├── processing.py     # Deterministic pandas profiling (Layer 1)
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx           # Upload page
    │   └── report/
    │       └── page.tsx       # Report display page
    ├── lib/
    │   ├── types.ts           # TypeScript mirrors of backend models
    │   └── api.ts             # Typed fetch wrapper
    └── store/
        └── report-store.ts    # Zustand: holds AnalysisResponse between pages
```

---

## Data Contracts

```
AnalysisResponse
├── dataset: DatasetSummary
│   ├── filename, row_count, col_count
│   └── columns: ColumnSummary[]
│       ├── name, dtype, null_count, null_pct, unique_count
│       ├── sample_values: string[]
│       └── numeric_stats?: { mean, median, std, min, max }
│
├── insights: InsightBlock[]
│   ├── title, summary
│   ├── bullets: string[]
│   └── caveat?: string
│
└── report_sections: ReportSection[]
    ├── title
    └── content
```

---

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| 1 — Upload + Profile | File in → schema + stats out | ✅ Done |
| 2 — Join detection | Suggest join keys across tables | ⬜ Planned |
| 3 — Context form + full analysis | User objective, aggregations, chart specs | ⬜ Planned |
| 4 — LLM narrative | AI writes report around computed stats | ⬜ Planned |
| 5 — Polish | Error handling, edge cases, loading states | ⬜ Planned |
| 6 — Portfolio layer | Landing page, demo dataset, deploy | ⬜ Planned |

### Key TODOs

- **Phase 2**: `backend/processing/join_suggester.py` — heuristic join key detection
- **Phase 3**: `POST /sessions/{id}/context` — user objective + domain notes
- **Phase 3**: `backend/charts/` — Plotly chart spec builders (histogram, bar, heatmap, timeseries, scatter)
- **Phase 4**: `backend/report/llm_client.py` — provider-abstracted LLM interface (`Protocol`)
- **Phase 4**: `backend/report/builder.py` — section-by-section report generation from `AnalysisSummary`
- **Phase 4**: LLM receives only pre-computed stats — never raw data

---

## Principles

- **Deterministic code computes all numbers.** The LLM never invents statistics.
- **Multi-dataset joins are user-confirmed.** Never auto-applied.
- **Predefined chart system.** Not a freeform chart generator.
- **MVP = EDA only.** No ML, no forecasting, no causal inference.
