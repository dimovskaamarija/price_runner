"""FastAPI service exposing the catalog ML models to the NestJS backend.

Endpoints
  GET  /health            model status
  POST /train             retrain from the database (background; ?wait=true to block)
  POST /predict           classify offers -> {field: {value, confidence}}
  GET  /metrics           evaluation metrics of the current model
  GET  /clusters?k=       LSA + K-Means cluster report of products currently on sale

Env: DATABASE_URL, DB_SSL, ML_SERVICE_TOKEN, MODEL_DIR, ML_MIN_CONFIDENCE, ML_MIN_PRECISION
"""
from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel

from . import clustering, data, model as ml

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("ml.api")

MODEL_PATH = Path(os.environ.get("MODEL_DIR", "./models")) / "catalog_model.joblib"
TOKEN = os.environ.get("ML_SERVICE_TOKEN", "")


class State:
    model: Optional[ml.CatalogModel] = None
    training = False
    last_error: Optional[str] = None
    lock = threading.Lock()


state = State()
app = FastAPI(title="Price Runner ML", version="1.0")


def auth(x_ml_token: Optional[str] = Header(default=None)) -> None:
    if TOKEN and x_ml_token != TOKEN:
        raise HTTPException(status_code=401, detail="invalid token")


def _train() -> Dict[str, Any]:
    with state.lock:
        if state.training:
            return {"status": "already-running"}
        state.training = True
    try:
        rows = data.load_training_rows()
        log.info("training on %d rows", len(rows))
        new_model = ml.train(rows)
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(new_model, MODEL_PATH, compress=3)
        state.model = new_model  # atomic swap; predictions keep using the old model until now
        state.last_error = None
        return {"status": "trained", "metrics": new_model.metrics}
    except Exception as e:  # noqa: BLE001 - surfaced via /health
        state.last_error = f"{type(e).__name__}: {e}"
        log.exception("training failed")
        return {"status": "failed", "error": state.last_error}
    finally:
        state.training = False


@app.on_event("startup")
def startup() -> None:
    if MODEL_PATH.exists():
        try:
            state.model = joblib.load(MODEL_PATH)
            log.info("loaded model trained at %s", state.model.metrics.get("trained_at"))
            return
        except Exception:  # noqa: BLE001
            log.exception("could not load %s, retraining", MODEL_PATH)
    if os.environ.get("DATABASE_URL"):
        threading.Thread(target=_train, daemon=True).start()


@app.get("/health")
def health() -> Dict[str, Any]:
    m = state.model
    return {
        "status": "ok",
        "model_loaded": m is not None,
        "trained_at": m.metrics.get("trained_at") if m else None,
        "enabled_fields": [f for f, fm in m.fields.items() if fm.enabled] if m else [],
        "training": state.training,
        "last_error": state.last_error,
    }


@app.post("/train", dependencies=[Depends(auth)])
def train(wait: bool = Query(False)) -> Dict[str, Any]:
    if wait:
        return _train()
    if state.training:
        return {"status": "already-running"}
    threading.Thread(target=_train, daemon=True).start()
    return {"status": "started"}


class PredictItem(BaseModel):
    id: int
    name: str
    brand: Optional[str] = None
    url: Optional[str] = None
    store: Optional[str] = None
    rawLabels: Optional[Dict[str, Any]] = None
    hints: Optional[Dict[str, Any]] = None


class PredictRequest(BaseModel):
    items: List[PredictItem]


@app.post("/predict", dependencies=[Depends(auth)])
def predict(req: PredictRequest) -> Dict[str, Any]:
    m = state.model
    if m is None:
        raise HTTPException(status_code=503, detail="model not trained yet")
    return {"results": m.predict([i.model_dump() for i in req.items])}


@app.get("/metrics", dependencies=[Depends(auth)])
def metrics() -> Dict[str, Any]:
    if state.model is None:
        raise HTTPException(status_code=503, detail="model not trained yet")
    return state.model.metrics


@app.get("/clusters", dependencies=[Depends(auth)])
def clusters(k: Optional[int] = Query(None, ge=2, le=200)) -> Dict[str, Any]:
    rows = data.load_active_rows()
    try:
        return clustering.cluster_report(rows, k)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
