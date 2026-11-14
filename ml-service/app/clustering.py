"""Unsupervised category discovery: LSA (TF-IDF -> truncated SVD) + K-Means.

Used to:
  * see the natural product groups in the catalog (independent of the hand-made taxonomy)
  * find clusters mostly labelled "Останато" -> candidate new categories
  * find outliers: products far from every cluster centre (often mis-scraped or mis-labelled)
  * measure how well the taxonomy matches the data (NMI between clusters and subcategories)
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.cluster import MiniBatchKMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import normalized_mutual_info_score, silhouette_score
from sklearn.preprocessing import normalize as l2_normalize

from .features import brand_stop_words, build_text

OTHER = "Останато"
# Site URL scaffolding and audience words: they describe *where* or *for whom*, not *what*.
NON_PRODUCT_TERMS = [
    "productcatalog", "productdetails", "productid", "mk", "www", "html",
    "muskarci", "mazhi", "za", "zene", "zheni", "deca", "men", "women", "kids", "unisex",
    "машки", "женски", "мажи", "жени", "деца", "унисекс", "возрасни",
]
K_CANDIDATES = (8, 12, 16, 24, 32, 48, 64)


def _choose_k(Z: np.ndarray, rng: np.random.Generator) -> tuple[int, Optional[float]]:
    n = Z.shape[0]
    candidates = [k for k in K_CANDIDATES if k <= max(2, n // 20)] or [max(2, min(8, n // 2))]
    sample = Z[rng.choice(n, size=min(n, 4000), replace=False)]
    best_k, best_s = candidates[0], None
    for k in candidates:
        labels = MiniBatchKMeans(n_clusters=k, random_state=42, n_init=3, batch_size=2048).fit_predict(sample)
        if len(set(labels)) < 2:
            continue
        s = float(silhouette_score(sample, labels))
        if best_s is None or s > best_s:
            best_k, best_s = k, s
    return best_k, best_s


def cluster_report(rows: List[Dict[str, Any]], k: Optional[int] = None) -> Dict[str, Any]:
    if len(rows) < 20:
        raise ValueError(f"need at least 20 products to cluster, got {len(rows)}")
    rng = np.random.default_rng(42)

    texts = [build_text(r, include_brand=False, product_type_only=True) for r in rows]
    tfidf = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),
        min_df=3,
        max_df=0.4,
        sublinear_tf=True,
        token_pattern=r"(?u)\b[^\W\d_]{2,}\b",  # letters only: no sizes, years, ids
        stop_words=brand_stop_words(r.get("brand") for r in rows) + NON_PRODUCT_TERMS,
        max_features=50_000,
    )
    X = tfidf.fit_transform(texts)
    n_components = max(2, min(100, X.shape[1] - 1, X.shape[0] - 1))
    svd = TruncatedSVD(n_components=n_components, random_state=42)
    Z = l2_normalize(svd.fit_transform(X))

    silhouette: Optional[float] = None
    if k is None:
        k, silhouette = _choose_k(Z, rng)
    k = int(max(2, min(k, len(rows) // 2)))
    km = MiniBatchKMeans(n_clusters=k, random_state=42, n_init=5, batch_size=2048).fit(Z)
    labels = km.labels_
    centers = l2_normalize(km.cluster_centers_)
    similarity = (Z * centers[labels]).sum(axis=1)  # cosine to own centre

    terms = tfidf.get_feature_names_out()
    with np.errstate(all="ignore"):  # spurious BLAS warnings on macOS Accelerate
        term_weights = km.cluster_centers_ @ svd.components_
    subcats = [r.get("subcategory") for r in rows]

    clusters = []
    for c in range(k):
        members = np.where(labels == c)[0]
        if not len(members):
            continue
        sub_counts = Counter(subcats[i] or "-" for i in members)
        dominant, dominant_n = sub_counts.most_common(1)[0]
        closest = members[np.argsort(-similarity[members])[:6]]
        clusters.append(
            {
                "id": int(c),
                "size": int(len(members)),
                "top_terms": [str(terms[t]) for t in np.argsort(-term_weights[c])[:10]],
                "dominant_subcategory": None if dominant == "-" else dominant,
                "purity": round(dominant_n / len(members), 3),
                "other_share": round(sub_counts.get(OTHER, 0) / len(members), 3),
                "subcategories": dict(sub_counts.most_common(5)),
                "stores": dict(Counter(rows[i].get("store") for i in members)),
                "examples": [rows[i].get("name") for i in closest],
            }
        )
    clusters.sort(key=lambda c: -c["size"])

    suggested = [c["id"] for c in clusters if c["other_share"] >= 0.5 and c["size"] >= 10]

    n_out = min(50, max(1, len(rows) // 100))
    outlier_idx = np.argsort(similarity)[:n_out]
    outliers = [
        {
            "offer_id": int(rows[i]["id"]),
            "name": rows[i].get("name"),
            "store": rows[i].get("store"),
            "subcategory": rows[i].get("subcategory"),
            "similarity": round(float(similarity[i]), 3),
        }
        for i in outlier_idx
    ]

    labelled = [i for i, s in enumerate(subcats) if s]
    nmi = normalized_mutual_info_score([subcats[i] for i in labelled], labels[labelled]) if labelled else None

    return {
        "k": k,
        "n_items": len(rows),
        "silhouette": None if silhouette is None else round(silhouette, 4),
        "explained_variance": round(float(svd.explained_variance_ratio_.sum()), 4),
        "nmi_vs_taxonomy": None if nmi is None else round(float(nmi), 4),
        "clusters": clusters,
        "suggested_new_categories": suggested,
        "outliers": outliers,
    }
