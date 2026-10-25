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
WAVE_COLUMNS = ["seq", "year", "name", "site", "point_id", "direction", "height", "period"]
EXPECTED_WAVE_HEADERS = ["파향파고측정지역코드", "측정파고길이", "측정주기초수"]
RIVER_COLUMNS = [
    "seq", "sido", "name", "site", "start_year", "end_year", "river_id", "river_name", "grade",
    "channel_length", "length", "basin_area", "inflow", "level", "width",
]
EXPECTED_RIVER_HEADERS = ["하천현황지역법정동내용", "하천유입량", "하천면적"]
NAME_COLUMNS = ["seq", "site", "name", "sido", "sigungu"]
EXPECTED_NAME_HEADERS = ["연안침식지역법정동내용", "연안침식지역명"]
# Plausibility limits used to drop obvious entry errors (e.g. height 38, period 1424).
WAVE_HEIGHT_MAX, WAVE_PERIOD_RANGE = 20.0, (3.0, 30.0)


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


def wave_site_features(raw: pd.DataFrame, report: dict) -> pd.DataFrame:
    """Site-level wave climate: median over survey years of per-year mean/max height and mean period.

    The source rows are per direction sector; units are taken as metres / seconds as published
    (not independently verified). Values are static site attributes (exogenous forcing).
    """
    df = raw.copy()
    df["site"] = pd.to_numeric(df["site"], errors="coerce").dropna().astype("int64").astype(str).reindex(df.index)
    df["height"] = pd.to_numeric(df["height"], errors="coerce")
    df["period"] = pd.to_numeric(df["period"], errors="coerce")
    bad_h = ~df["height"].between(0, WAVE_HEIGHT_MAX, inclusive="neither")
    bad_p = ~df["period"].between(*WAVE_PERIOD_RANGE)
    report["wave_rows_raw"] = len(df)
    report["wave_height_outliers_dropped"] = int((bad_h & df["height"].notna()).sum())
    report["wave_period_outliers_dropped"] = int((bad_p & df["period"].notna()).sum())
    df.loc[bad_h, "height"] = np.nan
    df.loc[bad_p, "period"] = np.nan
    per_year = df.dropna(subset=["site"]).groupby(["site", "year"]).agg(
        h_mean=("height", "mean"), h_max=("height", "max"), p_mean=("period", "mean")).reset_index()
    out = per_year.groupby("site").agg(
        mean_wave_height_m=("h_mean", "median"), max_wave_height_m=("h_max", "median"),
        mean_wave_period_s=("p_mean", "median"))
    report["wave_sites"] = int(len(out))
    return out


def river_site_features(raw: pd.DataFrame, report: dict) -> pd.DataFrame:
    df = raw.copy()
    df["site"] = pd.to_numeric(df["site"], errors="coerce").dropna().astype("int64").astype(str).reindex(df.index)
    for c in ("inflow", "basin_area"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
        df.loc[df[c] <= 0, c] = np.nan
    out = df.dropna(subset=["site"]).groupby("site").agg(river_inflow=("inflow", "mean"), river_basin_area=("basin_area", "mean"))
    report["river_sites"] = int(len(out))
    return out


def build_site_names(names: pd.DataFrame, wave: pd.DataFrame, river: pd.DataFrame, area_sido: dict, has_area: set) -> dict:
    """Canonical beach name per site code, taken from the three source tables (most frequent spelling)."""
    rows = []
    for df, col in ((names, "name"), (wave, "name"), (river, "name")):
        t = df[["site", col]].copy()
        t["site"] = pd.to_numeric(t["site"], errors="coerce")
        t = t.dropna()
        t["site"] = t["site"].astype("int64").astype(str)
        rows.append(t.rename(columns={col: "name"}))
    allnames = pd.concat(rows)
    out = {}
    sg = names.assign(site=pd.to_numeric(names["site"], errors="coerce")).dropna(subset=["site"])
    sg["site"] = sg["site"].astype("int64").astype(str)
    sg = sg.drop_duplicates("site").set_index("site")
    for site, g in allnames.groupby("site"):
        counts = g["name"].str.strip().value_counts()
        best = sorted(counts.index, key=lambda n: (-counts[n], len(n)))[0]
        out[site] = {
            "name": best,
            "sido": sg["sido"].get(site) or area_sido.get(site),
            "sigungu": sg["sigungu"].get(site),
            "has_area_history": site in has_area,
        }
    return out


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


def _chain_rate(chain: pd.DataFrame) -> float:
    first, last = chain.iloc[0], chain.iloc[-1]
    return float((first["area_before_m2"] - last["area_after_m2"]) / first["area_before_m2"] * 100
                 / (last["end_year"] - first["start_year"]))


def observed_history(g: pd.DataFrame) -> dict:
    """Facts from the measured series (no model): signed %/yr area change, positive = beach area lost."""
    g = g.sort_values(["end_year", "start_year"])
    last_iv = g.iloc[-1]
    recent = g.iloc[-3:]
    return {
        "n_intervals": int(len(g)),
        "first_year": int(g["start_year"].min()),
        "last_year": int(g["end_year"].max()),
        "long_term_loss_pct_per_year": round(_chain_rate(g), 3),
        "recent_loss_pct_per_year": round(_chain_rate(recent), 3),
        "recent_period": [int(recent.iloc[0]["start_year"]), int(recent.iloc[-1]["end_year"])],
        "last_interval": {
            "start_year": int(last_iv["start_year"]), "end_year": int(last_iv["end_year"]),
            "loss_pct_per_year": round(_chain_rate(g.iloc[-1:]), 3),
        },
        "latest_area_m2": float(last_iv["area_after_m2"]),
        "note": "Chain of consecutive measured intervals; gaps between surveys are not interpolated.",
    }


def build_site_profiles(areas: pd.DataFrame, sed: pd.DataFrame, static: pd.DataFrame, names: dict) -> dict:
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
        prof["observed"] = observed_history(g)
        if site in static.index:
            prof.update({k: float(v) for k, v in static.loc[site].dropna().items()})
        if site in names:
            prof["site_name"] = names[site]["name"]
        profiles[site] = prof
    return profiles


def annual_loss_pct(before, after, start, end):
    """Target: annualised beach-AREA loss in %/yr (not shoreline retreat in m/yr); accretion is clipped to 0."""
    return ((before - after) / before * 100 / (end - start)).clip(lower=0)


def build_dataset(raw_dir: Path = RAW_DIR, out_dir: Path = PROCESSED_DIR) -> tuple[pd.DataFrame, dict]:
    report: dict = {"data_origin": DATA_ORIGIN_REAL, "sources": DATA_SOURCES}
    area_raw = _read_csv(raw_dir / DATA_SOURCES["area_change"]["file"], AREA_COLUMNS, EXPECTED_AREA_HEADERS)
    sed_raw = _read_csv(raw_dir / DATA_SOURCES["sediment"]["file"], SEDIMENT_COLUMNS, EXPECTED_SEDIMENT_HEADERS)

    wave_raw = _read_csv(raw_dir / DATA_SOURCES["wave"]["file"], WAVE_COLUMNS, EXPECTED_WAVE_HEADERS)
    river_raw = _read_csv(raw_dir / DATA_SOURCES["river"]["file"], RIVER_COLUMNS, EXPECTED_RIVER_HEADERS)
    name_raw = _read_csv(raw_dir / DATA_SOURCES["site_names"]["file"], NAME_COLUMNS, EXPECTED_NAME_HEADERS)

    areas = clean_area_change(area_raw, report)
    sed = clean_sediment(sed_raw, report)
    static = wave_site_features(wave_raw, report).join(river_site_features(river_raw, report), how="outer")
    area_sido = areas.drop_duplicates("site").set_index("site")["sido"].to_dict()
    site_names = build_site_names(name_raw, wave_raw, river_raw.rename(columns={"name": "name"}), area_sido, set(areas["site"]))
    profiles = build_site_profiles(areas, sed, static, site_names)
    areas = _history_features(areas)
    areas = _sediment_features(areas, sed)
    areas = areas.merge(static, left_on="site", right_index=True, how="left")
    report["sites_with_wave_features"] = int(areas.loc[areas["mean_wave_height_m"].notna(), "site"].nunique())
    report["sites_with_river_features"] = int(areas.loc[areas["river_inflow"].notna(), "site"].nunique())

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
            "wave / river features are static site attributes (surveyed 2004-2022) treated as exogenous forcing; "
            "they are NOT time-matched to each interval (documented limitation, see ablation in metrics.json)",
        ],
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    ds.to_csv(out_dir / "erosion_training_data.csv", index=False)
    (out_dir / "site_names.json").write_text(json.dumps(site_names, ensure_ascii=False, indent=1), encoding="utf-8")
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
