"""Provisional risk classes. NOT an official coastal-erosion assessment standard."""
from __future__ import annotations

import numpy as np

from .config import RISK_LABELS, RISK_THRESHOLDS


def risk_class(loss_pct_per_year: float) -> str:
    if loss_pct_per_year >= RISK_THRESHOLDS["high"]:
        return "high"
    if loss_pct_per_year >= RISK_THRESHOLDS["medium"]:
        return "medium"
    return "low"


def risk_classes(values) -> np.ndarray:
    return np.array([risk_class(v) for v in np.asarray(values, dtype=float)])


__all__ = ["risk_class", "risk_classes", "RISK_LABELS"]
