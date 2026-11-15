"""Text feature construction shared by training, prediction and clustering.

Each offer becomes one document combining everything a human would look at:
product name, brand, the store's own category labels, breadcrumbs, crawl hints and
the URL slug. Word n-grams capture phrases ("патики ниски", "air max"); character
n-grams (in features.make_vectorizer) handle Cyrillic inflections, transliteration
("patiki") and typos, which is what lets the model generalise to unseen stores.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Iterable, Optional
from urllib.parse import unquote, urlparse

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion

LABEL_KEYS = ("category", "subcategory", "gender", "age", "color")
_NON_WORD = re.compile(r"[^\w]+", re.UNICODE)


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "").lower()
    return re.sub(r"\s+", " ", _NON_WORD.sub(" ", text)).strip()


def url_tokens(url: Optional[str], include_query: bool = True) -> str:
    """'/mk/patiki/8738149-nike-dunk-se' -> 'mk patiki nike dunk se' (ids dropped)."""
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        path = unquote(parsed.path) + (" " + unquote(parsed.query) if include_query else "")
    except ValueError:
        return ""
    return " ".join(t for t in _NON_WORD.split(path.lower()) if t and not t.isdigit() and len(t) > 1)


def build_text(item: Dict[str, Any], include_brand: bool = True, product_type_only: bool = False) -> str:
    """`product_type_only` (used for clustering) keeps only signals about *what* the product is,
    dropping audience/colour labels, crawl hints and URL query strings, so clusters form by
    product type rather than by "women's" / "kids 8-14" / store URL scheme."""
    labels = item.get("rawLabels") or {}
    hints = item.get("hints") or {}
    keys = ("category", "subcategory") if product_type_only else LABEL_KEYS
    parts: list[str] = [item.get("name") or ""]
    if include_brand:
        parts.append(item.get("brand") or "")
    parts += [str(labels[k]) for k in keys if labels.get(k)]
    parts += [str(b) for b in (labels.get("breadcrumbs") or [])]
    if not product_type_only:
        parts += [str(v) for v in hints.values() if v]
    parts.append(url_tokens(item.get("url"), include_query=not product_type_only))
    return normalize(" ".join(p for p in parts if p))


def make_vectorizer() -> FeatureUnion:
    return FeatureUnion(
        [
            (
                "word",
                TfidfVectorizer(
                    analyzer="word",
                    ngram_range=(1, 2),
                    min_df=2,
                    sublinear_tf=True,
                    token_pattern=r"(?u)\b\w\w+\b",
                    max_features=150_000,
                ),
            ),
            (
                "char",
                TfidfVectorizer(
                    analyzer="char_wb",
                    ngram_range=(2, 5),
                    min_df=2,
                    sublinear_tf=True,
                    max_features=300_000,
                ),
            ),
        ]
    )


def brand_stop_words(brands: Iterable[Optional[str]]) -> list[str]:
    """Brand tokens are excluded from clustering so clusters form by product type, not by brand."""
    words: set[str] = set()
    for b in brands:
        words.update(t for t in normalize(b or "").split() if len(t) > 1)
    return sorted(words)
