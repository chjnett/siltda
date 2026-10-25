"""STEP 4: FastAPI service.   uvicorn siltda_ml.api:app --reload --port 8000"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from .inference import InsufficientData, ModelUnavailable, load_bundle, model_path, predict_one

DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000", "https://siltda.pages.dev"]
origins = [o.strip() for o in os.environ.get("SILTDA_CORS_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",") if o.strip()]

app = FastAPI(title="siltDA Erosion Risk ML API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])


class ErosionRiskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_id: str = Field(min_length=1, max_length=64)
    area_before_m2: float | None = Field(default=None, gt=0, le=1e8)
    start_year: int | None = Field(default=None, ge=1900, le=2100)
    horizon_years: float | None = Field(default=None, gt=0, le=60, description="prediction horizon; default = median training interval")
    region_code: str | None = Field(default=None, max_length=2)
    historical_erosion_pct_per_year: float | None = Field(default=None, ge=-100, le=100)
    hist_mean_erosion_pct_per_year: float | None = Field(default=None, ge=-100, le=100)
    n_prev_intervals: int | None = Field(default=None, ge=0, le=100)
    mean_grain_mm: float | None = Field(default=None, gt=0, le=64)
    sand_pct: float | None = Field(default=None, ge=0, le=100)
    gravel_pct: float | None = Field(default=None, ge=0, le=100)
    silt_pct: float | None = Field(default=None, ge=0, le=100)
    # accepted for forward compatibility, currently NOT used by the model (no such training data)
    mean_wave_height_m: float | None = Field(default=None, ge=0, le=30)
    max_wave_height_m: float | None = Field(default=None, ge=0, le=40)
    mean_wave_period_s: float | None = Field(default=None, ge=0, le=40)
    coastal_slope_deg: float | None = Field(default=None, ge=0, le=90)
    rainfall_mm: float | None = Field(default=None, ge=0, le=20000)


@app.get("/health")
def health() -> dict:
    path = model_path()
    try:
        b = load_bundle()
        return {"status": "ok", "model_loaded": True, "model": b["model_name"], "model_version": b["model_version"],
                "synthetic_model": b["synthetic"], "data_origin": b["data_origin"], "model_beats_baseline": b["beats_baseline"],
                "n_rows": b["n_rows"], "n_sites": b["n_sites"], "known_site_profiles": len(b["site_profiles"])}
    except ModelUnavailable as exc:
        return {"status": "degraded", "model_loaded": False, "model_file": path.name, "detail": str(exc)}


@app.post("/api/ml/erosion-risk")
def erosion_risk(req: ErosionRiskRequest) -> dict:
    try:
        return predict_one(req.model_dump())
    except ModelUnavailable as exc:
        raise HTTPException(status_code=503, detail={"code": "MODEL_UNAVAILABLE", "message": str(exc)})
    except InsufficientData as exc:
        raise HTTPException(status_code=422, detail={"code": "INSUFFICIENT_DATA", "message": str(exc)})
