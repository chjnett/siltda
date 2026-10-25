"""STEP 3: load the saved model bundle and predict for one site."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .config import ARTIFACTS_DIR, FEATURES, NUMERIC_FEATURES, RISK_RULE_NOTE
from .risk import risk_class

DEFAULT_MODEL_PATH = ARTIFACTS_DIR / "erosion_model.joblib"
IGNORED_INPUTS = ["coastal_slope_deg", "rainfall_mm"]


class ModelUnavailable(RuntimeError):
    """The saved model file is missing or unreadable."""


class InsufficientData(ValueError):
    """The request (plus any known site profile) lacks the minimum inputs."""


class NoAreaHistory(InsufficientData):
    """Known beach, but the public data has no before/after beach-area record for it."""


def model_path() -> Path:
    return Path(os.environ.get("SILTDA_MODEL_PATH", DEFAULT_MODEL_PATH))


@lru_cache(maxsize=4)
def _load(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        raise ModelUnavailable(f"model file not found: {p.name}. Run `python -m siltda_ml.train` first.")
    try:
        return joblib.load(p)
    except Exception as exc:  # corrupted / incompatible pickle
        raise ModelUnavailable(f"model file could not be loaded: {exc}") from exc


def load_bundle(path: Path | None = None) -> dict:
    return _load(str(path or model_path()))


def clear_cache() -> None:
    _load.cache_clear()


def _resolve_features(req: dict, bundle: dict) -> tuple[dict, list[str], str]:
    """Merge explicit request values over the stored site profile. Returns (values, from_profile, source)."""
    site_id = str(req.get("site_id") or "")
    profile = bundle.get("site_profiles", {}).get(site_id)
    values: dict[str, Any] = {f: None for f in FEATURES}
    from_profile: list[str] = []
    if profile:
        for k, v in profile.items():
            if k in values:
                values[k] = v
                from_profile.append(k)
    for k in FEATURES:
        if req.get(k) is not None:
            values[k] = req[k]
            if k in from_profile:
                from_profile.remove(k)
    if req.get("horizon_years") is not None:
        values["span_years"] = req["horizon_years"]
    elif values["span_years"] is None:
        values["span_years"] = bundle["median_span_years"]
    if values["region_code"] is None and site_id[:2].isdigit() and site_id[:2] in bundle["known_region_codes"]:
        values["region_code"] = site_id[:2]
    if values["region_code"] is not None:
        values["region_code"] = str(values["region_code"])
    # a user-supplied historical rate with no count means we only know "some" history
    if req.get("historical_erosion_pct_per_year") is not None:
        if values["hist_mean_erosion_pct_per_year"] is None or "hist_mean_erosion_pct_per_year" in from_profile:
            values["hist_mean_erosion_pct_per_year"] = req["historical_erosion_pct_per_year"]
            if "hist_mean_erosion_pct_per_year" in from_profile:
                from_profile.remove("hist_mean_erosion_pct_per_year")
    return values, from_profile, ("site_profile+request" if profile else "request")


def predict_one(req: dict, bundle: dict | None = None) -> dict:
    bundle = bundle or load_bundle()
    values, from_profile, source = _resolve_features(req, bundle)
    if values["area_before_m2"] is None or values["start_year"] is None:
        known = bundle.get("site_names", {}).get(str(req.get("site_id") or ""))
        if known:
            raise NoAreaHistory(
                f"{known['name']} ({req.get('site_id')}) is a surveyed beach but has no beach-area before/after "
                "record in the public data; send area_before_m2 and start_year to get an experimental estimate."
            )
        raise InsufficientData(
            "area_before_m2 and start_year are required (send them, or use a site_id that exists in the training data)."
        )
    row = pd.DataFrame([{f: values[f] for f in bundle["features"]}])
    for c in NUMERIC_FEATURES:
        row[c] = pd.to_numeric(row[c], errors="coerce")
    row["region_code"] = row["region_code"].astype("object")
    pred = float(max(0.0, bundle["pipeline"].predict(row)[0]))
    lo, hi = bundle["start_year_range"]
    missing = [f for f in bundle["features"] if values[f] is None]
    ignored = [k for k in IGNORED_INPUTS if req.get(k) is not None]
    synthetic = bool(bundle["synthetic"])
    profile = bundle.get("site_profiles", {}).get(str(req.get("site_id") or ""), {})
    observed = profile.get("observed")
    return {
        "site_name": profile.get("site_name"),
        "observed_history": observed,
        "observed_risk": risk_class(max(0.0, observed["long_term_loss_pct_per_year"])) if observed else None,
        "observed_risk_basis": "long-term measured area change; provisional heuristic classes" if observed else None,
        "site_id": req.get("site_id"),
        "predicted_annual_area_loss_pct": round(pred, 3),
        "erosion_risk": risk_class(pred),
        "risk_label_is_heuristic": True,
        "risk_rule_note": RISK_RULE_NOTE,
        "synthetic_model": synthetic,
        "data_origin": bundle["data_origin"],
        "outside_training_year_range": bool(not (lo <= values["start_year"] <= bundle["year_range"][1])),
        "training_year_range": bundle["year_range"],
        "model": bundle["model_name"],
        "model_version": bundle["model_version"],
        "model_beats_baseline": bool(bundle["beats_baseline"]),
        "horizon_years_used": float(values["span_years"]),
        "inputs_from_site_profile": sorted(from_profile),
        "input_source": source,
        "missing_features_imputed": missing,
        "ignored_inputs": ignored,
        "unavailable_features": sorted(bundle["unavailable_features"]),
        "note": (
            "Exploratory prediction from a small dataset. "
            + ("Model is trained on SYNTHETIC data. " if synthetic else "")
            + ("Model did NOT outperform the median baseline in validation. " if not bundle["beats_baseline"] else "")
            + "Not a confirmed erosion assessment."
        ),
    }


__all__ = ["predict_one", "load_bundle", "ModelUnavailable", "InsufficientData", "np"]
