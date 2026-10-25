"""STEP 1: download, validate and join the public coastal-erosion datasets.

Leakage rules enforced here
---------------------------
* ``area_after_m2`` is used only to build the target.
* Features for an interval ``[start_year, end_year]`` come only from information dated
  on or before ``start_year``: earlier intervals that already ended (``end_year <= start_year``)
  and sediment surveys with a survey year ``<= start_year``.
* Different sources are joined on the site code (never on row order).
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    DATA_ORIGIN_REAL,
    DATA_SOURCES,
    PROCESSED_DIR,
    RAW_DIR,
    UNAVAILABLE_FEATURES,
)

AREA_COLUMNS = [
    "seq", "sido", "site", "start_year", "end_year", "area_before_m2", "area_after_m2",
    "d_area", "erode_area", "erode_width", "net_area", "net_width", "width_change", "change_ratio",
]
SEDIMENT_COLUMNS = [
    "seq", "site", "sido", "survey_date", "sample_no", "gravel_pct", "sand_pct", "silt_pct",
    "clay_pct", "phi", "sorting", "skewness", "kurtosis", "sediment_type",
]
EXPECTED_AREA_HEADERS = ["백사장면적변화지역", "백사장면적변화시작년도", "백사장면적변화종료년도", "백사장이전면적", "백사장이후면적"]
EXPECTED_SEDIMENT_HEADERS = ["퇴적물조성지역법정동내용", "퇴적물조성조사일자", "퇴적물조성평균입도내용"]


def download_raw(raw_dir: Path = RAW_DIR) -> None:
    """Download the raw CSV files from data.go.kr (no API key required)."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    for src in DATA_SOURCES.values():
        target = raw_dir / src["file"]
        req = urllib.request.Request(src["download"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            target.write_bytes(resp.read())
        print(f"downloaded {target.name} ({target.stat().st_size:,} bytes)")


def _read_csv(path: Path, columns: list[str], expected_headers: list[str]) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="utf-8-sig")
    if len(df.columns) != len(columns) or not all(h in df.columns for h in expected_headers):
        raise ValueError(f"{path.name}: unexpected header layout {list(df.columns)}")
    df.columns = columns
    return df


def clean_area_change(raw: pd.DataFrame, report: dict) -> pd.DataFrame:
    """Keep only validated, de-duplicated, non-cumulative before/after observations."""
    df = raw.copy()
    report["area_rows_raw"] = len(df)
    df["site"] = df["site"].astype("int64").astype(str)
    for col in ["start_year", "end_year", "area_before_m2", "area_after_m2"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    both = df["area_before_m2"].notna() & df["area_after_m2"].notna()
    report["area_rows_missing_before_or_after"] = int((~both).sum())
    df = df[both]

    bad = (df["area_before_m2"] <= 0) | (df["area_after_m2"] <= 0) | (df["end_year"] <= df["start_year"])
    report["area_rows_invalid_values"] = int(bad.sum())
    df = df[~bad]

    key = ["site", "start_year", "end_year"]
    before = len(df)
    df = df.drop_duplicates(key + ["area_before_m2", "area_after_m2"])
    report["area_rows_exact_duplicates_removed"] = before - len(df)
    before = len(df)
    df = df.drop_duplicates(key, keep="first")
    report["area_rows_conflicting_duplicates_removed"] = before - len(df)

    # Drop cumulative spans (e.g. 1971-2009 when 1971-1980 and 1980-2005 exist): they reuse the
    # information of shorter intervals and would double count / leak into the history features.
    keep_idx = []
    for _, g in df.groupby("site"):
        spans = g[["start_year", "end_year"]].to_numpy()
        for i, (s, e) in enumerate(spans):
            inside = (spans[:, 0] >= s) & (spans[:, 1] <= e) & ~((spans[:, 0] == s) & (spans[:, 1] == e))
            if not inside.any():
                keep_idx.append(g.index[i])
    report["area_rows_cumulative_spans_removed"] = len(df) - len(keep_idx)
    df = df.loc[keep_idx]

    df = df[["site", "sido", "start_year", "end_year", "area_before_m2", "area_after_m2"]].copy()
    df[["start_year", "end_year"]] = df[["start_year", "end_year"]].astype(int)
    return df.sort_values(["site", "start_year", "end_year"]).reset_index(drop=True)


def clean_sediment(raw: pd.DataFrame, report: dict) -> pd.DataFrame:
    df = raw.copy()
    report["sediment_rows_raw"] = len(df)
    df["site"] = df["site"].astype("int64").astype(str)
    df["survey_year"] = pd.to_datetime(df["survey_date"], errors="coerce").dt.year
    for col in ["gravel_pct", "sand_pct", "silt_pct", "clay_pct", "phi"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["survey_year", "phi"])
    pct_sum = df[["gravel_pct", "sand_pct", "silt_pct", "clay_pct"]].fillna(0).sum(axis=1)
    valid = pct_sum.between(95, 105) & df["phi"].between(-6, 10)
    report["sediment_rows_invalid"] = int((~valid).sum())
    df = df[valid].copy()
    # Mean grain size is stored in phi units: d[mm] = 2 ** (-phi).
    df["grain_mm"] = np.power(2.0, -df["phi"])
    df["survey_year"] = df["survey_year"].astype(int)
    return df[["site", "survey_year", "grain_mm", "sand_pct", "gravel_pct", "silt_pct"]]


def _history_features(areas: pd.DataFrame) -> pd.DataFrame:
    """Past erosion rates per interval, using only intervals that ended on/before its start."""
    signed = (areas["area_before_m2"] - areas["area_after_m2"]) / areas["area_before_m2"] * 100 / (
        areas["end_year"] - areas["start_year"]
    )
    areas = areas.assign(_signed_rate=signed)
    last = pd.Series(np.nan, index=areas.index)
    mean = pd.Series(np.nan, index=areas.index)
    count = pd.Series(0, index=areas.index)
    for _, g in areas.groupby("site"):
        for idx, row in g.iterrows():
            prev = g[g["end_year"] <= row["start_year"]].sort_values("end_year")
            if len(prev):
                last[idx] = prev["_signed_rate"].iloc[-1]
                mean[idx] = prev["_signed_rate"].mean()
                count[idx] = len(prev)
    out = areas.drop(columns="_signed_rate")
    out["historical_erosion_pct_per_year"] = last
    out["hist_mean_erosion_pct_per_year"] = mean
    out["n_prev_intervals"] = count
    return out


def _sediment_features(areas: pd.DataFrame, sed: pd.DataFrame) -> pd.DataFrame:
    """Join sediment by site code, using only surveys dated <= start_year of the interval."""
    keyed = areas[["site", "start_year"]].drop_duplicates()
    joined = keyed.merge(sed, on="site", how="inner")
    joined = joined[joined["survey_year"] <= joined["start_year"]]
    agg = joined.groupby(["site", "start_year"]).agg(
        mean_grain_mm=("grain_mm", "mean"),
        sand_pct=("sand_pct", "mean"),
        gravel_pct=("gravel_pct", "mean"),
        silt_pct=("silt_pct", "mean"),
        n_sediment_samples=("grain_mm", "size"),
    ).reset_index()
    out = areas.merge(agg, on=["site", "start_year"], how="left")
    out["n_sediment_samples"] = out["n_sediment_samples"].fillna(0).astype(int)
    return out


def build_site_profiles(areas: pd.DataFrame, sed: pd.DataFrame) -> dict:
    """Latest known state per site, used by the API to fill features for a known ``site_id``.

    Valid for predicting the period that *starts* at the site's latest observation year, so
    every surveyed sediment sample is already in the past at that point.
    """
    signed = (areas["area_before_m2"] - areas["area_after_m2"]) / areas["area_before_m2"] * 100 / (
        areas["end_year"] - areas["start_year"]
    )
    areas = areas.assign(_signed=signed)
    sed_mean = sed.groupby("site").agg(
        mean_grain_mm=("grain_mm", "mean"), sand_pct=("sand_pct", "mean"),
        gravel_pct=("gravel_pct", "mean"), silt_pct=("silt_pct", "mean"),
    )
    profiles: dict = {}
    for site, g in areas.groupby("site"):
        last = g.sort_values("end_year").iloc[-1]
        prof = {
            "area_before_m2": float(last["area_after_m2"]),
            "start_year": int(last["end_year"]),
            "historical_erosion_pct_per_year": float(last["_signed"]),
            "hist_mean_erosion_pct_per_year": float(g["_signed"].mean()),
            "n_prev_intervals": int(len(g)),
            "region_code": site[:2],
        }
        if site in sed_mean.index:
            prof.update({k: float(v) for k, v in sed_mean.loc[site].items()})
        profiles[site] = prof
    return profiles


def annual_loss_pct(before, after, start, end):
    """Target: annualised beach-AREA loss in %/yr (not shoreline retreat in m/yr); accretion is clipped to 0."""
    return ((before - after) / before * 100 / (end - start)).clip(lower=0)


def build_dataset(raw_dir: Path = RAW_DIR, out_dir: Path = PROCESSED_DIR) -> tuple[pd.DataFrame, dict]:
    report: dict = {"data_origin": DATA_ORIGIN_REAL, "sources": DATA_SOURCES}
    area_raw = _read_csv(raw_dir / DATA_SOURCES["area_change"]["file"], AREA_COLUMNS, EXPECTED_AREA_HEADERS)
    sed_raw = _read_csv(raw_dir / DATA_SOURCES["sediment"]["file"], SEDIMENT_COLUMNS, EXPECTED_SEDIMENT_HEADERS)

    areas = clean_area_change(area_raw, report)
    sed = clean_sediment(sed_raw, report)
    profiles = build_site_profiles(areas, sed)
    areas = _history_features(areas)
    areas = _sediment_features(areas, sed)

    areas["site_id"] = areas["site"]
    areas["region_code"] = areas["site"].str[:2]
    areas["span_years"] = areas["end_year"] - areas["start_year"]
    areas["annual_erosion_loss_pct"] = annual_loss_pct(
        areas["area_before_m2"], areas["area_after_m2"], areas["start_year"], areas["end_year"]
    )
    for col in UNAVAILABLE_FEATURES:
        areas[col] = np.nan  # schema placeholder only, never used for training
    ds = areas.drop(columns=["site", "sido"]).reset_index(drop=True)

    p99 = ds["annual_erosion_loss_pct"].quantile(0.99)
    report.update(
        rows=len(ds),
        sites=int(ds["site_id"].nunique()),
        year_range=[int(ds["start_year"].min()), int(ds["end_year"].max())],
        target_summary={k: float(v) for k, v in ds["annual_erosion_loss_pct"].describe().items()},
        target_share_zero=float((ds["annual_erosion_loss_pct"] == 0).mean()),
        target_p99=float(p99),
        target_rows_gt_p99=int((ds["annual_erosion_loss_pct"] > p99).sum()),
        missing_rate={c: round(float(ds[c].isna().mean()), 4) for c in ds.columns if ds[c].isna().any()},
        unavailable_features=UNAVAILABLE_FEATURES,
        leakage_rules=[
            "area_after_m2 only builds the target",
            "history features use intervals with end_year <= start_year of the sample",
            "sediment features use surveys with survey_year <= start_year of the sample",
            "joins use site code, never row order",
        ],
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    ds.to_csv(out_dir / "erosion_training_data.csv", index=False)
    (out_dir / "site_profiles.json").write_text(json.dumps(profiles, ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "data_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return ds, report


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true", help="download the raw CSVs first")
    args = ap.parse_args()
    if args.download:
        download_raw()
    _, rep = build_dataset()
    skip = ("sources", "unavailable_features", "leakage_rules")
    print(json.dumps({k: v for k, v in rep.items() if k not in skip}, ensure_ascii=False, indent=2))
