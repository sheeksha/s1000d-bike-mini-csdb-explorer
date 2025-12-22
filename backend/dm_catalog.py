import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_PATH = BASE_DIR / "data" / "bike_index.json"

def load_index() -> dict:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))

def filename_from_any_path(p: str) -> str:
    # Normalize Windows and Linux paths
    return p.replace("\\", "/").split("/")[-1]

def list_dms(only_dmc: bool = True) -> list[dict]:
    idx = load_index()
    out = []
    for dm in idx["data_modules"]:
        p = dm.get("path")
        if not p or dm.get("parse_error"):
            continue

        fname = filename_from_any_path(p)
        if only_dmc and (not fname.upper().startswith("DMC-")):
            continue

        out.append({
            "path": p,
            "dmCode": dm.get("dmCode"),
            "dmTitle": dm.get("dmTitle"),
            "has_applicability": dm.get("has_applicability", False),
        })

    out.sort(key=lambda x: ((x["dmCode"] or ""), (x["dmTitle"] or "")))
    return out
