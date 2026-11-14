"""Supervised classifiers: one TF-IDF + logistic-regression model per field.

Training labels come from the catalog itself (weak supervision): values produced by
high-precision label rules, learned/manual label mappings, or Gemini. Defaults and the
model's own earlier predictions are excluded so errors are not fed back into training.

Model choice (leave-one-store-out ablation on real scraped data): multinomial LR matches
one-vs-rest accuracy but is confident on more items (coverage@0.8: 0.55 vs 0.47 for
subcategory, 0.80 vs 0.71 for gender) at the same precision. Label-dropout augmentation
(training extra name-only copies) was tried and rejected: it lowered new-store accuracy
from 0.81 to 0.69 and made name-only predictions over-confident (0.84 precision at 0.8).
With too little signal the model should abstain, and the backend falls back to rules/Gemini.

Evaluation (in `metrics`):
  * holdout           - random 80/20 split
  * leave_one_store_out - train on all other stores, test on one: estimates accuracy on a
                          *new website*, which is the real production scenario
  * at_threshold      - coverage and accuracy when only predictions with
                        probability >= ML_MIN_CONFIDENCE are accepted (what the backend does)

A field's model is enabled only if its holdout accuracy at the threshold reaches ML_MIN_PRECISION.
"""
from __future__ import annotations

import logging
import os
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split

from .features import build_text, make_vectorizer

log = logging.getLogger("ml.model")

FIELDS = ("subcategory", "gender", "age", "color")
TRUSTED_SOURCES = {"rules", "mapping", "gemini", "manual"}
MIN_CLASS_SAMPLES = int(os.environ.get("ML_MIN_CLASS_SAMPLES", "5"))
MIN_FIELD_SAMPLES = int(os.environ.get("ML_MIN_FIELD_SAMPLES", "50"))
CONFIDENCE = float(os.environ.get("ML_MIN_CONFIDENCE", "0.8"))
MIN_PRECISION = float(os.environ.get("ML_MIN_PRECISION", "0.9"))
EVAL_LOSO = os.environ.get("ML_EVAL_LOSO", "true") != "false"


def make_classifier() -> LogisticRegression:
    # Multinomial (softmax) logistic regression: well-calibrated probabilities across many classes,
    # which matters because the backend accepts predictions by confidence threshold.
    return LogisticRegression(C=10.0, max_iter=3000, solver="lbfgs")


@dataclass
class FieldModel:
    clf: LogisticRegression
    enabled: bool
    metrics: Dict[str, Any]


@dataclass
class CatalogModel:
    vectorizer: Any
    fields: Dict[str, FieldModel]
    trained_at: float
    n_rows: int
    metrics: Dict[str, Any] = field(default_factory=dict)

    def predict(self, items: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not items:
            return []
        X = self.vectorizer.transform([build_text(i) for i in items])
        out: List[Dict[str, Any]] = [{"id": i.get("id"), "predictions": {}} for i in items]
        for name, fm in self.fields.items():
            if not fm.enabled:
                continue
            proba = fm.clf.predict_proba(X)
            best = proba.argmax(axis=1)
            for row, (idx, p) in enumerate(zip(best, proba[np.arange(len(best)), best])):
                out[row]["predictions"][name] = {"value": str(fm.clf.classes_[idx]), "confidence": round(float(p), 4)}
        return out


def labelled(rows: Sequence[Dict[str, Any]], fld: str) -> List[int]:
    """Indices of rows whose `fld` value comes from a trusted source."""
    idx = []
    for i, r in enumerate(rows):
        src = (r.get("fieldSources") or {}).get(fld)
        if r.get(fld) and src in TRUSTED_SOURCES:
            idx.append(i)
    return idx


def _drop_rare(idx: List[int], y: List[str]) -> tuple[List[int], List[str]]:
    counts = Counter(y)
    keep = [k for k, label in enumerate(y) if counts[label] >= MIN_CLASS_SAMPLES]
    return [idx[k] for k in keep], [y[k] for k in keep]


def _scores(y_true: Sequence[str], y_pred: Sequence[str], conf: np.ndarray) -> Dict[str, Any]:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    confident = conf >= CONFIDENCE
    return {
        "n": int(len(y_true)),
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "weighted_f1": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "at_threshold": {
            "threshold": CONFIDENCE,
            "coverage": round(float(confident.mean()), 4) if len(conf) else 0.0,
            "accuracy": round(float((y_true[confident] == y_pred[confident]).mean()), 4) if confident.any() else None,
        },
    }


def _fit_predict(texts_train, y_train, texts_test):
    vec = make_vectorizer()
    clf = make_classifier()
    clf.fit(vec.fit_transform(texts_train), y_train)
    proba = clf.predict_proba(vec.transform(texts_test))
    return clf.classes_[proba.argmax(axis=1)], proba.max(axis=1)


def evaluate_field(texts: List[str], y: List[str], stores: List[str]) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}

    stratify = y if min(Counter(y).values()) >= 2 else None
    tr, te = train_test_split(np.arange(len(y)), test_size=0.2, random_state=42, stratify=stratify)
    pred, conf = _fit_predict([texts[i] for i in tr], [y[i] for i in tr], [texts[i] for i in te])
    y_te = [y[i] for i in te]
    metrics["holdout"] = _scores(y_te, pred, conf)
    labels = sorted(set(y_te))
    p, r, f, s = precision_recall_fscore_support(y_te, pred, labels=labels, zero_division=0)
    metrics["per_class"] = {
        lab: {"precision": round(float(p[k]), 3), "recall": round(float(r[k]), 3), "f1": round(float(f[k]), 3), "support": int(s[k])}
        for k, lab in enumerate(labels)
    }

    if EVAL_LOSO:
        per_store = {}
        for store in sorted(set(stores)):
            te_idx = [i for i, s_ in enumerate(stores) if s_ == store]
            tr_idx = [i for i, s_ in enumerate(stores) if s_ != store]
            if len(te_idx) < 30 or len({y[i] for i in tr_idx}) < 2:
                continue
            pred, conf = _fit_predict([texts[i] for i in tr_idx], [y[i] for i in tr_idx], [texts[i] for i in te_idx])
            per_store[store] = _scores([y[i] for i in te_idx], pred, conf)
        if per_store:
            metrics["leave_one_store_out"] = {
                "mean_accuracy": round(float(np.mean([m["accuracy"] for m in per_store.values()])), 4),
                "mean_macro_f1": round(float(np.mean([m["macro_f1"] for m in per_store.values()])), 4),
                "per_store": per_store,
            }
    return metrics


def train(rows: List[Dict[str, Any]]) -> CatalogModel:
    started = time.time()
    if len(rows) < MIN_FIELD_SAMPLES:
        raise ValueError(f"not enough classified offers to train ({len(rows)} < {MIN_FIELD_SAMPLES}); run a scrape first")
    texts = [build_text(r) for r in rows]
    stores = [r.get("store") or "" for r in rows]

    vectorizer = make_vectorizer()
    X = vectorizer.fit_transform(texts)  # unsupervised: fit on all rows, labelled or not

    fields: Dict[str, FieldModel] = {}
    summary: Dict[str, Any] = {}
    for fld in FIELDS:
        idx = labelled(rows, fld)
        idx, y = _drop_rare(idx, [rows[i][fld] for i in idx])
        if len(idx) < MIN_FIELD_SAMPLES or len(set(y)) < 2:
            summary[fld] = {"enabled": False, "reason": f"not enough labelled data ({len(idx)} rows, {len(set(y))} classes)"}
            continue

        m = evaluate_field([texts[i] for i in idx], y, [stores[i] for i in idx])
        clf = make_classifier()
        clf.fit(X[idx], y)
        at = m["holdout"]["at_threshold"]
        enabled = at["accuracy"] is not None and at["accuracy"] >= MIN_PRECISION
        m.update({"enabled": enabled, "n_train": len(idx), "classes": sorted(set(y)), "class_counts": dict(Counter(y))})
        if not enabled:
            m["reason"] = f"holdout accuracy at confidence {CONFIDENCE} below ML_MIN_PRECISION={MIN_PRECISION}"
        fields[fld] = FieldModel(clf=clf, enabled=enabled, metrics=m)
        summary[fld] = m
        log.info("field=%s n=%d holdout_acc=%.3f enabled=%s", fld, len(idx), m["holdout"]["accuracy"], enabled)

    return CatalogModel(
        vectorizer=vectorizer,
        fields=fields,
        trained_at=time.time(),
        n_rows=len(rows),
        metrics={
            "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "training_seconds": round(time.time() - started, 1),
            "n_rows": len(rows),
            "fields": summary,
        },
    )

