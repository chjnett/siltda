# siltDA erosion-risk ML backend

Independent ML module (no dredge optimisation logic). Predicts **annual beach-area loss (%/year)** for a coast
site and maps it to a **provisional** risk class. The output is an exploratory prediction, not an erosion assessment.

## Run

```bash
pip install -r requirements.txt
python -m siltda_ml.data --download     # download data.go.kr CSVs + build training table (no API key)
python -m siltda_ml.train               # trains baseline / RandomForest / LightGBM, saves artifacts/
python -m pytest -q                     # tests (uses synthetic data in a temp dir)
uvicorn siltda_ml.api:app --port 8000   # Swagger: http://localhost:8000/docs
```

Env: `SILTDA_MODEL_PATH` (default `artifacts/erosion_model.joblib`), `SILTDA_CORS_ORIGINS`
(comma list; default `localhost:3000`, `127.0.0.1:3000`, `https://siltda.pages.dev`).
Frontend: `NEXT_PUBLIC_SILTDA_ML_API_URL` (HTTPS in production).

## Data (real, MOF via data.go.kr)

| Source | Use |
|---|---|
| [15126857 beach-area change](https://www.data.go.kr/data/15126857/fileData.do) | target + history features |
| [15126862 sediment composition](https://www.data.go.kr/data/15126862/fileData.do) | grain size / sand / gravel / silt |

After cleaning: **279 intervals, 55 sites** (of 6,190 raw rows only 988 had both before/after areas;
duplicates and cumulative spans such as 1971-2009 were removed). See `data/processed/data_report.json`.

**Not available** (no data downloaded, so not used): wave height / period, coastal slope, rainfall.
They are accepted by the API but ignored and reported in `ignored_inputs`. Needed: KMA/KHOA wave and ASOS
rainfall data plus a site-coordinate table to join them. The public files contain only an 8-digit site code
(first 5 digits = legal-dong district), no beach names or coordinates.

## Leakage rules

`area_after_m2` only builds the target; history features use intervals with `end_year <= start_year`;
sediment uses surveys with `survey_year <= start_year` (surveys are 2008-2023, so ~67 % of rows have no sediment
features); sources are joined by site code; evaluation splits are grouped by `site_id`.

## Results (see `artifacts/metrics.json`, `artifacts/figures/`)

Site-grouped 5-fold CV x3 (mean): MAE / RMSE / R² / Macro-F1

| Model | MAE | RMSE | R² | Macro-F1 |
|---|---|---|---|---|
| median baseline | 2.07 | 4.14 | -0.19 | 0.25 |
| mean baseline | 2.46 | 3.82 | -0.01 | 0.11 |
| RandomForest (selected) | 2.32 | 3.68 | 0.06 | 0.32 |
| LightGBM | 2.38 | 3.75 | 0.02 | 0.37 |

**The models do not beat the median baseline on MAE** (they improve RMSE/R² only marginally) and the temporal split
is no better. The API reports `model_beats_baseline: false`. Treat predictions as a demo of the pipeline.
Risk classes (LOW <1, MEDIUM 1-3, HIGH >=3 %/yr) are a hackathon rule, not an official standard.

## Synthetic mode

`python -m siltda_ml.train --synthetic` writes to `artifacts_synthetic/` with `synthetic=true` and
`data_origin=["SYNTHETIC_DEMO_ONLY"]`; its metrics are meaningless as accuracy.

## API

`GET /health`, `POST /api/ml/erosion-risk` — send `site_id` of a known site (e.g. `26380002`) to auto-fill
features from its latest observation, or send `area_before_m2` + `start_year` (+ optional features).
Errors: 422 `INSUFFICIENT_DATA` / invalid fields, 503 `MODEL_UNAVAILABLE`.
