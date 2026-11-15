"""Offline tests on synthetic data (no database needed): python -m pytest ml-service/tests"""
import random

from app import clustering
from app import model as ml
from app.features import build_text, url_tokens

PRODUCTS = {
    "Патики": ["air max", "dunk low", "runner", "court vision", "gel kayano", "samba"],
    "Маици": ["tee logo", "t shirt essential", "polo club", "tank top", "graphic tee"],
    "Чорапи": ["crew socks 3pk", "ankle socks", "no show socks", "everyday cushioned socks"],
    "Топки": ["football ball", "basketball ball", "volleyball ball", "match ball pro"],
}
LABELS = {"Патики": "патики ниски", "Маици": "маица", "Чорапи": "чорапи", "Топки": "топка"}
STORES = ["A", "B", "C"]


def make_rows(n=600, seed=1):
    rnd = random.Random(seed)
    rows = []
    for i in range(n):
        sub = rnd.choice(list(PRODUCTS))
        store = rnd.choice(STORES)
        gender = rnd.choice(["Машки", "Женски"])
        rows.append(
            {
                "id": i,
                "store": store,
                "name": f"{rnd.choice(['Nike', 'Adidas', 'Puma'])} {rnd.choice(PRODUCTS[sub])} {rnd.randint(1, 99)}",
                "brand": "Nike",
                "url": f"https://{store}.mk/mk/{sub}/{i}-item",
                # Store C never shows a subcategory label: the model must rely on the name.
                "rawLabels": {"subcategory": LABELS[sub] if store != "C" else None, "gender": gender.lower()},
                "hints": {},
                "subcategory": sub,
                "gender": gender,
                "age": "За возрасни",
                "color": None,
                "fieldSources": {"subcategory": "rules", "gender": "rules", "age": "default"},
            }
        )
    return rows


def test_url_tokens_drop_ids():
    assert url_tokens("https://x.mk/mk/patiki/8738149-nike-dunk-se") == "mk patiki nike dunk se"


def test_build_text_includes_labels_and_name():
    t = build_text({"name": "Nike Dunk", "brand": "Nike", "rawLabels": {"subcategory": "Патики-ниски"}})
    assert "dunk" in t and "патики" in t


def test_train_predict_and_trust_filter():
    rows = make_rows()
    m = ml.train(rows)
    assert m.fields["subcategory"].enabled
    assert "age" not in m.fields  # only default-sourced labels -> never trained on
    loso = m.metrics["fields"]["subcategory"]["leave_one_store_out"]["per_store"]
    assert loso["C"]["accuracy"] > 0.9  # generalises to a store without labels

    pred = m.predict([{"id": 1, "name": "Puma crew socks 3pk 12", "rawLabels": {}, "hints": {}}])[0]
    assert pred["predictions"]["subcategory"]["value"] == "Чорапи"


def test_cluster_report_finds_groups():
    rows = make_rows(400)
    report = clustering.cluster_report(rows, k=4)
    assert report["k"] == 4
    assert sum(c["size"] for c in report["clusters"]) == 400
    assert report["nmi_vs_taxonomy"] > 0.5
