"""Shared constants for the siltDA erosion-risk ML module."""
from __future__ import annotations

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BACKEND_DIR / "data" / "raw"
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
ARTIFACTS_DIR = BACKEND_DIR / "artifacts"
SYNTHETIC_ARTIFACTS_DIR = BACKEND_DIR / "artifacts_synthetic"

MODEL_VERSION = "0.1.0"

# --- Source datasets (data.go.kr file datasets, Ministry of Oceans and Fisheries) ---
DATA_SOURCES = {
    "area_change": {
        "title": "해양수산부_연안정비_연안침식백사장면적변화정보",
        "page": "https://www.data.go.kr/data/15126857/fileData.do",
        "download": "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000002882681&fileDetailSn=1&insertDataPrcus=N",
        "file": "area_change.csv",
    },
    "sediment": {
        "title": "해양수산부_연안정비_연안침식퇴적물조성정보",
        "page": "https://www.data.go.kr/data/15126862/fileData.do",
        "download": "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000002883022&fileDetailSn=1&insertDataPrcus=N",
        "file": "sediment.csv",
    },
    "wave": {
        "title": "해양수산부_연안정비_연안침식파향파고주기정보",
        "page": "https://www.data.go.kr/data/15126863/fileData.do",
        "download": "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003517624&fileDetailSn=1&insertDataPrcus=N",
        "file": "wave.csv",
    },
    "river": {
        "title": "해양수산부_연안정비_연안침식하천현황정보",
        "page": "https://www.data.go.kr/data/15126866/fileData.do",
        "download": "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003517615&fileDetailSn=1&insertDataPrcus=N",
        "file": "river.csv",
    },
    "site_names": {
        "title": "해양수산부_연안정비_연안침식조사현황정보",
        "page": "https://www.data.go.kr/data/15126860/fileData.do",
        "download": "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000002883032&fileDetailSn=1&insertDataPrcus=N",
        "file": "site_names.csv",
    },
}
DATA_ORIGIN_REAL = [
    "MOF_BEACH_AREA_CHANGE_15126857",
    "MOF_SEDIMENT_COMPOSITION_15126862",
    "MOF_WAVE_DIRECTION_HEIGHT_PERIOD_15126863",
    "MOF_RIVER_STATUS_15126866",
]
DATA_ORIGIN_SYNTHETIC = ["SYNTHETIC_DEMO_ONLY"]

# --- Target / risk classes ---
# Hackathon demo thresholds. NOT an official coastal-erosion assessment standard.
RISK_THRESHOLDS = {"medium": 1.0, "high": 3.0}  # % beach-area loss per year
RISK_LABELS = ["low", "medium", "high"]
RISK_RULE_NOTE = (
    "Provisional hackathon rule (LOW <1 %/yr, MEDIUM 1-3 %/yr, HIGH >=3 %/yr of beach-area loss). "
    "Not an official coastal-erosion assessment criterion."
)

# --- Model features (order matters; stored in the model bundle) ---
NUMERIC_FEATURES = [
    "area_before_m2",
    "start_year",
    "span_years",
    "historical_erosion_pct_per_year",
    "hist_mean_erosion_pct_per_year",
    "n_prev_intervals",
    "mean_grain_mm",
    "sand_pct",
    "gravel_pct",
    "silt_pct",
    "mean_wave_height_m",
    "max_wave_height_m",
    "mean_wave_period_s",
    "river_inflow",
    "river_basin_area",
]
CATEGORICAL_FEATURES = ["region_code"]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# Variables requested for the project but NOT available in the downloaded public files.
UNAVAILABLE_FEATURES = {
    "coastal_slope_deg": "no beach-profile / slope data in the public files",
    "rainfall_mm": "no rainfall data downloaded (KMA ASOS needed, matched by station-to-site mapping)",
}
