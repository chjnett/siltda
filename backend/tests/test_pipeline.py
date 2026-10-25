import os
import warnings

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from siltda_ml import inference
from siltda_ml.config import ARTIFACTS_DIR, DATA_ORIGIN_SYNTHETIC
from siltda_ml.data import _history_features, _sediment_features, annual_loss_pct, clean_area_change
from siltda_ml.demo_data import generate_synthetic
from siltda_ml.risk import risk_class
from siltda_ml.train import run_training

warnings.filterwarnings("ignore")


@pytest.fixture(scope="module")
def synthetic_dir(tmp_path_factory):
    out = tmp_path_factory.mktemp("synthetic_artifacts")
    metrics = run_training(generate_synthetic(), out, DATA_ORIGIN_SYNTHETIC, synthetic=True)
    return out, metrics


def test_target_formula():
    y = annual_loss_pct(pd.Series([1000.0, 1000.0]), pd.Series([900.0, 1100.0]), pd.Series([2000, 2000]), pd.Series([2010, 2010]))
    assert y.iloc[0] == pytest.approx(1.0)  # 10 % over 10 years
    assert y.iloc[1] == 0.0  # accretion clipped


def test_risk_thresholds():
    assert [risk_class(v) for v in (0.99, 1.0, 2.99, 3.0)] == ["low", "medium", "medium", "high"]


def test_cleaning_drops_cumulative_and_duplicates():
    cols = ["seq", "sido", "site", "start_year", "end_year", "area_before_m2", "area_after_m2",
            "d_area", "erode_area", "erode_width", "net_area", "net_width", "width_change", "change_ratio"]
    rows = [
        [1, "x", 11110001, 1980, 1990, 100.0, 90.0] + [0] * 7,
        [2, "x", 11110001, 1980, 1990, 100.0, 90.0] + [0] * 7,  # exact duplicate
        [3, "x", 11110001, 1990, 2000, 90.0, 80.0] + [0] * 7,
        [4, "x", 11110001, 1980, 2000, 100.0, 80.0] + [0] * 7,  # cumulative span
        [5, "x", 11110001, 2000, 2005, np.nan, 70.0] + [0] * 7,  # missing before
    ]
    out = clean_area_change(pd.DataFrame(rows, columns=cols), {})
    assert list(zip(out.start_year, out.end_year)) == [(1980, 1990), (1990, 2000)]


def test_no_future_information_in_features():
    areas = pd.DataFrame({
        "site": ["A", "A", "A"], "start_year": [1990, 2000, 2010], "end_year": [2000, 2010, 2020],
        "area_before_m2": [100.0, 90.0, 80.0], "area_after_m2": [90.0, 80.0, 40.0],
    })
    feats = _history_features(areas)
    assert np.isnan(feats.loc[0, "historical_erosion_pct_per_year"])
    assert feats.loc[2, "n_prev_intervals"] == 2
    changed = areas.copy()
    changed.loc[2, "area_after_m2"] = 1.0  # the answer of the last row must not alter any feature
    assert _history_features(changed).drop(columns="area_after_m2").equals(feats.drop(columns="area_after_m2"))

    sed = pd.DataFrame({"site": ["A", "A"], "survey_year": [2005, 2015], "grain_mm": [0.2, 0.9],
                        "sand_pct": [90.0, 50.0], "gravel_pct": [5.0, 40.0], "silt_pct": [5.0, 10.0]})
    joined = _sediment_features(feats, sed).set_index("start_year")
    assert np.isnan(joined.loc[1990, "mean_grain_mm"])  # survey is after the interval start
    assert joined.loc[2010, "mean_grain_mm"] == pytest.approx(0.2)  # the 2015 survey is excluded


def test_synthetic_training_is_flagged(synthetic_dir):
    out, metrics = synthetic_dir
    assert metrics["synthetic"] is True and "NOT real model accuracy" in metrics["warning"]
    for f in ("erosion_model.joblib", "metrics.json", "holdout_predictions.csv"):
        assert (out / f).exists()
    assert {"random_forest", "lightgbm", "baseline_median"} <= set(metrics["evaluation"]["site_grouped_holdout"]["models"])


def test_inference_roundtrip_and_errors(synthetic_dir):
    out, _ = synthetic_dir
    inference.clear_cache()
    bundle = inference.load_bundle(out / "erosion_model.joblib")
    res = inference.predict_one({"site_id": "NEW", "area_before_m2": 34000, "start_year": 2150,
                                 "historical_erosion_pct_per_year": 2.3, "mean_wave_height_m": 1.9}, bundle)
    assert res["synthetic_model"] is True and res["data_origin"] == DATA_ORIGIN_SYNTHETIC
    assert res["erosion_risk"] in ("low", "medium", "high") and res["outside_training_year_range"] is True
    assert "mean_wave_height_m" in res["ignored_inputs"] and "mean_grain_mm" in res["missing_features_imputed"]
    with pytest.raises(inference.InsufficientData):
        inference.predict_one({"site_id": "NEW"}, bundle)
    with pytest.raises(inference.ModelUnavailable):
        inference.load_bundle(out / "missing.joblib")


def test_api(synthetic_dir, monkeypatch):
    out, _ = synthetic_dir
    monkeypatch.setenv("SILTDA_MODEL_PATH", str(out / "erosion_model.joblib"))
    inference.clear_cache()
    from siltda_ml.api import app

    c = TestClient(app)
    h = c.get("/health").json()
    assert h["status"] == "ok" and h["synthetic_model"] is True
    ok = c.post("/api/ml/erosion-risk", json={"site_id": "S", "area_before_m2": 34000, "start_year": 2026})
    assert ok.status_code == 200 and ok.json()["synthetic_model"] is True
    assert c.post("/api/ml/erosion-risk", json={"site_id": "S"}).status_code == 422  # insufficient data
    assert c.post("/api/ml/erosion-risk", json={"site_id": "S", "area_before_m2": -5, "start_year": 2026}).status_code == 422
    assert c.post("/api/ml/erosion-risk", json={"site_id": "S", "area_before_m2": 5, "start_year": 2026, "bogus": 1}).status_code == 422
    cors = c.options("/api/ml/erosion-risk", headers={"Origin": "https://siltda.pages.dev", "Access-Control-Request-Method": "POST"})
    assert cors.headers.get("access-control-allow-origin") == "https://siltda.pages.dev"
    blocked = c.options("/api/ml/erosion-risk", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in blocked.headers

    monkeypatch.setenv("SILTDA_MODEL_PATH", str(out / "nope.joblib"))
    inference.clear_cache()
    assert c.post("/api/ml/erosion-risk", json={"site_id": "S", "area_before_m2": 5, "start_year": 2026}).status_code == 503
    assert c.get("/health").json()["status"] == "degraded"


@pytest.mark.skipif(not (ARTIFACTS_DIR / "erosion_model.joblib").exists(), reason="real model not trained")
def test_real_model_is_not_synthetic_and_knows_sites():
    os.environ.pop("SILTDA_MODEL_PATH", None)
    inference.clear_cache()
    b = inference.load_bundle(ARTIFACTS_DIR / "erosion_model.joblib")
    assert b["synthetic"] is False and "SYNTHETIC_DEMO_ONLY" not in b["data_origin"]
    site = next(iter(b["site_profiles"]))
    res = inference.predict_one({"site_id": site}, b)
    assert res["input_source"] == "site_profile+request" and res["inputs_from_site_profile"]
