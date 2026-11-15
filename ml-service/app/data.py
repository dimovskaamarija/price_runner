"""Data access: reads labelled offers straight from the catalog's Postgres."""
from __future__ import annotations

import os
from typing import Any, Dict, List

import psycopg
from psycopg.rows import dict_row

_COLUMNS = """id, store, name, brand, url, "rawLabels", hints,
              category, subcategory, gender, age, color, "fieldSources" """


def _connect() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    sslmode = "disable" if os.environ.get("DB_SSL") == "false" else "prefer"
    return psycopg.connect(url, sslmode=sslmode, row_factory=dict_row, connect_timeout=30)


def load_training_rows() -> List[Dict[str, Any]]:
    """Every classified offer except legacy rows (whose labels came from the old hand-made defaults).
    Per-field trust filtering happens in model.py using `fieldSources`."""
    with _connect() as conn:
        return conn.execute(
            f"""SELECT {_COLUMNS} FROM offers
                WHERE "classifiedAt" IS NOT NULL
                  AND "classificationSource" IS DISTINCT FROM 'legacy'"""
        ).fetchall()


def load_active_rows(hours: int = 48) -> List[Dict[str, Any]]:
    """Offers currently on sale — the population we cluster."""
    with _connect() as conn:
        return conn.execute(
            f"""SELECT {_COLUMNS} FROM offers
                WHERE "lastSeenAt" >= now() - make_interval(hours => %s) AND price IS NOT NULL""",
            (hours,),
        ).fetchall()
