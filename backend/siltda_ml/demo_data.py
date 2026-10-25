"""SYNTHETIC demo data generator.

Used ONLY to smoke-test the pipeline / API when real data is missing. Every row is invented
from a made-up formula, so any metric computed on it says nothing about real erosion.
Models trained on it are flagged ``synthetic=True`` and ``data_origin=['SYNTHETIC_DEMO_ONLY']``.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import UNAVAILABLE_FEATURES


def generate_synthetic(n_sites: int = 40, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for s in range(n_sites):
        region = str(rng.choice([26, 42, 44, 45, 46, 47, 48]))
        grain = float(rng.uniform(0.1, 0.8))
        year, area = int(rng.integers(1990, 2000)), float(rng.uniform(5e3, 2e5))
        prev_rates = []
        for _ in range(int(rng.integers(4, 9))):
            span = int(rng.integers(2, 12))
            true_rate = max(0.0, 1.5 + 0.8 * (0.4 - grain) * 4 + rng.normal(0, 1.0))
            after = max(100.0, area * (1 - true_rate * span / 100))
            rows.append({
                "site_id": f"SYN{s:03d}", "start_year": year, "end_year": year + span, "span_years": span,
                "area_before_m2": area, "area_after_m2": after, "region_code": region,
                "historical_erosion_pct_per_year": prev_rates[-1] if prev_rates else np.nan,
                "hist_mean_erosion_pct_per_year": float(np.mean(prev_rates)) if prev_rates else np.nan,
                "n_prev_intervals": len(prev_rates), "mean_grain_mm": grain,
                "sand_pct": 100 - rng.uniform(0, 10), "gravel_pct": rng.uniform(0, 5), "silt_pct": rng.uniform(0, 3),
            })
            prev_rates.append((area - after) / area * 100 / span)
            year, area = year + span, after
    df = pd.DataFrame(rows)
    df["annual_erosion_loss_pct"] = ((df.area_before_m2 - df.area_after_m2) / df.area_before_m2 * 100
                                     / (df.end_year - df.start_year)).clip(lower=0)
    for col in UNAVAILABLE_FEATURES:
        df[col] = np.nan
    return df
