"""STEP 2/3: train, evaluate and save the erosion-loss models.

Target: annual beach-AREA loss in %/yr (annualised over a multi-year interval).
Evaluation, all grouped by ``site_id`` so a coast never appears on both sides of a split:
  1. one site-grouped holdout split (20 % of sites),
  2. repeated site-grouped 5-fold CV (3 repeats, pooled out-of-fold metrics),
  3. a temporal split (train: intervals ended <= cutoff, test: intervals starting >= cutoff).
Run:  python -m siltda_ml.train            (real data)
      python -m siltda_ml.train --synthetic (pipeline smoke test only - never real accuracy)
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import lightgbm as lgb
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.compose import ColumnTransformer  # noqa: E402
from sklearn.dummy import DummyRegressor  # noqa: E402
from sklearn.ensemble import RandomForestRegressor  # noqa: E402
from sklearn.impute import SimpleImputer  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402
from sklearn.metrics import f1_score, mean_absolute_error, mean_squared_error, r2_score  # noqa: E402
from sklearn.model_selection import GroupShuffleSplit  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import OneHotEncoder  # noqa: E402

from .config import (  # noqa: E402
    ARTIFACTS_DIR,
    CATEGORICAL_FEATURES,
    DATA_ORIGIN_REAL,
    DATA_ORIGIN_SYNTHETIC,
    FEATURES,
    MODEL_VERSION,
    NUMERIC_FEATURES,
    PROCESSED_DIR,
    RISK_LABELS,
    RISK_RULE_NOTE,
    SYNTHETIC_ARTIFACTS_DIR,
    UNAVAILABLE_FEATURES,
)
from .risk import risk_classes  # noqa: E402

TARGET = "annual_erosion_loss_pct"
SEED = 42


def make_pipeline(model) -> Pipeline:
    """Identical preprocessing for training and inference (stored inside the saved pipeline)."""
    pre = ColumnTransformer(
        [
            ("num", SimpleImputer(strategy="median", add_indicator=True, keep_empty_features=True), NUMERIC_FEATURES),
            ("cat", Pipeline([
                ("imp", SimpleImputer(strategy="constant", fill_value="unknown")),
                ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]), CATEGORICAL_FEATURES),
        ]
    ).set_output(transform="pandas")
    return Pipeline([("prep", pre), ("model", model)])


def model_zoo() -> dict[str, Pipeline]:
    return {
        "baseline_median": make_pipeline(DummyRegressor(strategy="median")),
        "baseline_mean": make_pipeline(DummyRegressor(strategy="mean")),
        "random_forest": make_pipeline(RandomForestRegressor(
            n_estimators=400, min_samples_leaf=5, max_features=0.6, random_state=SEED, n_jobs=-1)),
        "lightgbm": make_pipeline(lgb.LGBMRegressor(
            n_estimators=250, learning_rate=0.03, num_leaves=8, min_child_samples=12,
            subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=2.0,
            random_state=SEED, verbose=-1, n_jobs=1)),
    }


def prepare_X(df: pd.DataFrame) -> pd.DataFrame:
    X = df.reindex(columns=FEATURES).copy()
    for c in NUMERIC_FEATURES:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    X[CATEGORICAL_FEATURES] = X[CATEGORICAL_FEATURES].astype("object")
    return X


def evaluate(y_true, y_pred) -> dict:
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    t_cls, p_cls = risk_classes(y_true), risk_classes(y_pred)
    return {
        "n": int(len(y_true)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)) if len(y_true) > 1 else float("nan"),
        "macro_f1": float(f1_score(t_cls, p_cls, labels=RISK_LABELS, average="macro", zero_division=0)),
    }


def _fit_predict(name_to_pipe: dict, X_tr, y_tr, X_te) -> dict[str, np.ndarray]:
    from sklearn.base import clone

    return {n: clone(p).fit(X_tr, y_tr).predict(X_te) for n, p in name_to_pipe.items()}


def grouped_folds(groups: np.ndarray, n_splits: int, seed: int):
    sites = np.unique(groups)
    rng = np.random.default_rng(seed)
    rng.shuffle(sites)
    assignment = {s: i % n_splits for i, s in enumerate(sites)}
    fold = np.array([assignment[g] for g in groups])
    for k in range(n_splits):
        yield np.where(fold != k)[0], np.where(fold == k)[0]


def temporal_cutoff(df: pd.DataFrame) -> int:
    """Cutoff year: latest year such that >= 20 % of rows start on/after it."""
    for year in sorted(df["start_year"].unique(), reverse=True):
        if (df["start_year"] >= year).mean() >= 0.2:
            return int(year)
    return int(df["start_year"].median())


def run_training(df: pd.DataFrame, out_dir: Path, data_origin: list[str], synthetic: bool) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "figures").mkdir(exist_ok=True)
    df = df.dropna(subset=[TARGET]).reset_index(drop=True)
    X, y, groups = prepare_X(df), df[TARGET].to_numpy(), df["site_id"].astype(str).to_numpy()
    zoo = model_zoo()
    learned = ["random_forest", "lightgbm"]

    # 1) site-grouped holdout
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    tr, te = next(gss.split(X, y, groups))
    assert not set(groups[tr]) & set(groups[te]), "site leakage between train and holdout"
    ho_pred = _fit_predict(zoo, X.iloc[tr], y[tr], X.iloc[te])
    holdout = {n: evaluate(y[te], p) for n, p in ho_pred.items()}
    ho_df = df.iloc[te][["site_id", "start_year", "end_year", TARGET]].copy()
    ho_df["true_risk"] = risk_classes(y[te])
    for n, p in ho_pred.items():
        ho_df[f"pred_{n}"] = p
        ho_df[f"risk_{n}"] = risk_classes(p)
    ho_df.to_csv(out_dir / "holdout_predictions.csv", index=False)

    # 2) repeated site-grouped 5-fold CV
    n_rep, cv_runs, oof_first = 3, {n: [] for n in zoo}, None
    for rep in range(n_rep):
        oof = {n: np.zeros(len(df)) for n in zoo}
        for tr_i, te_i in grouped_folds(groups, 5, SEED + rep):
            preds = _fit_predict(zoo, X.iloc[tr_i], y[tr_i], X.iloc[te_i])
            for n, p in preds.items():
                oof[n][te_i] = p
        for n in zoo:
            cv_runs[n].append(evaluate(y, oof[n]))
        if rep == 0:
            oof_first = oof
    cv = {}
    for n, runs in cv_runs.items():
        cv[n] = {k: {"mean": float(np.mean([r[k] for r in runs])), "std": float(np.std([r[k] for r in runs]))}
                 for k in ("mae", "rmse", "r2", "macro_f1")}
        cv[n]["n"] = runs[0]["n"]
    cvp = df[["site_id", "start_year", "end_year", TARGET]].copy()
    for n in zoo:
        cvp[f"oof_{n}"] = oof_first[n]
    cvp.to_csv(out_dir / "cv_predictions.csv", index=False)

    # 3) temporal split
    cutoff = temporal_cutoff(df)
    t_tr = np.where(df["end_year"] <= cutoff)[0]
    t_te = np.where(df["start_year"] >= cutoff)[0]
    temporal = {"cutoff_year": cutoff, "n_train": int(len(t_tr)), "n_test": int(len(t_te)), "models": {}}
    if len(t_tr) >= 30 and len(t_te) >= 10:
        t_pred = _fit_predict(zoo, X.iloc[t_tr], y[t_tr], X.iloc[t_te])
        temporal["models"] = {n: evaluate(y[t_te], p) for n, p in t_pred.items()}
        temporal["note"] = "train: intervals ended <= cutoff; test: intervals started >= cutoff (same sites may appear on both sides)"
    else:
        temporal["note"] = "not enough rows for a temporal evaluation"

    # model selection on site-grouped CV MAE
    best = min(learned, key=lambda n: cv[n]["mae"]["mean"])
    base_mae = cv["baseline_median"]["mae"]["mean"]
    improvement = {n: float(1 - cv[n]["mae"]["mean"] / base_mae) for n in learned}
    beats_baseline = bool(cv[best]["mae"]["mean"] < base_mae and cv[best]["r2"]["mean"] > cv["baseline_mean"]["r2"]["mean"])

    # final fit on all rows
    final = model_zoo()[best].fit(X, y)
    names = list(final.named_steps["prep"].get_feature_names_out())
    inner = final.named_steps["model"]
    imp_builtin = dict(zip(names, map(float, getattr(inner, "feature_importances_", np.zeros(len(names))))))

    # permutation importance of the holdout-trained selected model on the holdout rows
    ho_model = model_zoo()[best].fit(X.iloc[tr], y[tr])
    perm = permutation_importance(ho_model, X.iloc[te], y[te], scoring="neg_mean_absolute_error",
                                  n_repeats=20, random_state=SEED)
    imp_perm = {f: {"mean": float(m), "std": float(s)} for f, m, s in zip(FEATURES, perm.importances_mean, perm.importances_std)}

    profiles_path = PROCESSED_DIR / "site_profiles.json"
    profiles = json.loads(profiles_path.read_text(encoding="utf-8")) if (profiles_path.exists() and not synthetic) else {}
    bundle = {
        "pipeline": final,
        "model_name": "lightgbm" if best == "lightgbm" else "random_forest",
        "model_version": MODEL_VERSION,
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "synthetic": synthetic,
        "data_origin": data_origin,
        "year_range": [int(df["start_year"].min()), int(df["end_year"].max())],
        "start_year_range": [int(df["start_year"].min()), int(df["start_year"].max())],
        "median_span_years": float(df["span_years"].median()),
        "feature_medians": {c: (None if X[c].isna().all() else float(X[c].median())) for c in NUMERIC_FEATURES},
        "known_region_codes": sorted(df["region_code"].astype(str).unique().tolist()),
        "site_profiles": profiles,
        "unavailable_features": UNAVAILABLE_FEATURES,
        "beats_baseline": beats_baseline,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_rows": int(len(df)),
        "n_sites": int(df["site_id"].nunique()),
    }
    joblib.dump(bundle, out_dir / "erosion_model.joblib")

    metrics = {
        "model_version": MODEL_VERSION,
        "synthetic": synthetic,
        "data_origin": data_origin,
        "warning": ("SYNTHETIC DATA - pipeline smoke test only. These numbers are NOT real model accuracy."
                    if synthetic else
                    "Small real dataset (see n_rows / n_sites). Exploratory model; not a validated erosion forecast."),
        "target": "annual beach-area loss (%/yr), annualised over multi-year intervals; accretion clipped to 0",
        "risk_rule_note": RISK_RULE_NOTE,
        "n_rows": int(len(df)),
        "n_sites": int(df["site_id"].nunique()),
        "features": FEATURES,
        "features_not_available": UNAVAILABLE_FEATURES,
        "evaluation": {
            "site_grouped_holdout": {"n_train_sites": int(len(set(groups[tr]))), "n_test_sites": int(len(set(groups[te]))), "models": holdout},
            "site_grouped_cv_5fold_x3": cv,
            "temporal_split": temporal,
        },
        "selected_model": best,
        "selection_criterion": "lowest mean MAE in repeated site-grouped 5-fold CV",
        "mae_improvement_vs_median_baseline_cv": improvement,
        "selected_beats_baseline": beats_baseline,
        "feature_importance_builtin": imp_builtin,
        "permutation_importance_holdout_mae": imp_perm,
        "hyperparameters": {n: {k: v for k, v in zoo[n].named_steps["model"].get_params().items()
                                if isinstance(v, (int, float, str, bool, type(None)))} for n in learned},
        "hyperparameter_note": "fixed, conservative settings; no extensive tuning because the dataset is small",
    }
    (out_dir / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    _plots(out_dir, y, cvp, cv, ho_df, best, imp_perm, synthetic)
    return metrics


def _plots(out_dir, y, cvp, cv, ho_df, best, imp_perm, synthetic):
    tag = " [SYNTHETIC - not real accuracy]" if synthetic else ""
    fig, ax = plt.subplots(figsize=(5.5, 5))
    ax.scatter(cvp[TARGET], cvp[f"oof_{best}"], s=14, alpha=0.6)
    lim = max(cvp[TARGET].max(), cvp[f"oof_{best}"].max()) * 1.05
    ax.plot([0, lim], [0, lim], "k--", lw=1)
    ax.set(xlabel="actual annual area loss (%/yr)", ylabel="predicted (%/yr)", title=f"{best}: site-grouped CV{tag}")
    fig.tight_layout(); fig.savefig(out_dir / "figures" / "actual_vs_predicted_cv.png", dpi=140); plt.close(fig)

    names = ["baseline_median", "baseline_mean", "random_forest", "lightgbm"]
    fig, ax = plt.subplots(figsize=(6.5, 4))
    ax.bar(names, [cv[n]["mae"]["mean"] for n in names], yerr=[cv[n]["mae"]["std"] for n in names], color=["#999", "#bbb", "#2a9d8f", "#e76f51"])
    ax.set(ylabel="MAE (%/yr), grouped CV", title=f"Model comparison{tag}")
    plt.setp(ax.get_xticklabels(), rotation=15)
    fig.tight_layout(); fig.savefig(out_dir / "figures" / "model_comparison_mae.png", dpi=140); plt.close(fig)

    items = sorted(imp_perm.items(), key=lambda kv: kv[1]["mean"])
    fig, ax = plt.subplots(figsize=(6.5, 4.5))
    ax.barh([k for k, _ in items], [v["mean"] for _, v in items], xerr=[v["std"] for _, v in items])
    ax.set(xlabel="permutation importance (increase in MAE)", title=f"{best}: feature importance (holdout){tag}")
    fig.tight_layout(); fig.savefig(out_dir / "figures" / "feature_importance.png", dpi=140); plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true", help="train on synthetic demo data (smoke test only)")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    if args.synthetic:
        from .demo_data import generate_synthetic

        df, origin, out = generate_synthetic(), DATA_ORIGIN_SYNTHETIC, args.out or SYNTHETIC_ARTIFACTS_DIR
    else:
        path = PROCESSED_DIR / "erosion_training_data.csv"
        if not path.exists():
            from .data import build_dataset

            build_dataset()
        df = pd.read_csv(path, dtype={"site_id": str, "region_code": str})
        origin, out = DATA_ORIGIN_REAL, args.out or ARTIFACTS_DIR
    m = run_training(df, out, origin, args.synthetic)
    summary = {"selected": m["selected_model"], "beats_baseline": m["selected_beats_baseline"],
               "cv": {n: {k: round(v["mean"], 3) for k, v in r.items() if k != "n"} for n, r in m["evaluation"]["site_grouped_cv_5fold_x3"].items()}}
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
