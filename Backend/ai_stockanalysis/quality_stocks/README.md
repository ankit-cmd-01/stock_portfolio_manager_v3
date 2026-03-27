# Quality Stocks Feature

## Architecture
- `quality_stocks.models.QualityStock` stores one saved report per `(portfolio, stock)`.
- `quality_stocks.services` owns ranking, fetch/analyze/persist flow, graph normalization, and deterministic fallback behavior.
- `quality_stocks.views.QualityStockViewSet` exposes authenticated DRF endpoints for list/detail/snapshot/generate/rerun.

## Endpoints
- `GET /api/quality-stocks/`
  - Optional filters: `portfolio`, `signal`
- `GET /api/quality-stocks/{id}/`
- `POST /api/quality-stocks/snapshot/`
  - Body: `{ "portfolio_id": 1 }`
- `POST /api/quality-stocks/generate/`
  - Body: `{ "portfolio_id": 1, "stock_ids": [10, 11, 12] }`
- `POST /api/quality-stocks/{id}/rerun/`

## Reliability
- The generate flow uses `fetch -> analyze -> persist` with LangGraph when available.
- If LangGraph is unavailable, the same stages run sequentially.
- LLM/provider failures never crash the feature; deterministic fallback still returns and persists a report.
- Graph payloads normalize revenue to billions (`Revenue (B)`, `unit: "B"`) on save and again at read-time for legacy rows.
