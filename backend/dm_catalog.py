import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_PATH = BASE_DIR / "data" / "bike_index.json"

def load_index() -> dict:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))

def list_dms(only_dmc: bool = True) -> list[dict]:
    idx = load_index()
    out = []
    for dm in idx["data_modules"]:
        p = dm.get("path")
        if not p or dm.get("parse_error"):
            continue
        if only_dmc and (not Path(p).name.upper().startswith("DMC-")):
            continue
        out.append({
            "path": p,
            "dmCode": dm.get("dmCode"),
            "dmTitle": dm.get("dmTitle"),
            "has_applicability": dm.get("has_applicability", False),
        })
    # sort: dmCode then title
    out.sort(key=lambda x: ((x["dmCode"] or ""), (x["dmTitle"] or "")))
    return out
