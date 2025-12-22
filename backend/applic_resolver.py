import json
from pathlib import Path
from lxml import etree

from backend.eval_applic_expr import evaluate

BASE_DIR = Path(__file__).resolve().parent.parent

DATASET_DIR = BASE_DIR / "data" / "S1000D_4-1_Bike_Samples"
INDEX_PATH = BASE_DIR / "data" / "bike_index.json"
GROUPS_PATH = BASE_DIR / "data" / "applic_groups.json"


def local_name(tag) -> str:
    if not isinstance(tag, str):
        return ""
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag


def text_of(el) -> str:
    return " ".join("".join(el.itertext()).split())


def load_index() -> dict:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def load_dm_meta(index: dict) -> dict:
    meta = {}
    for dm in index["data_modules"]:
        p = dm.get("path")
        if p and not dm.get("parse_error"):
            meta[p] = {
                "dmCode": dm.get("dmCode"),
                "dmTitle": dm.get("dmTitle"),
            }
    return meta


def extract_applic_text(xml_path: Path) -> str | None:
    """
    Extract the first <applic>...</applic> text found in a DM.
    """
    root = etree.fromstring(xml_path.read_bytes())
    for el in root.iter():
        if local_name(el.tag) == "applic":
            t = text_of(el)
            return t or None
    return None


def load_group_texts() -> list[str]:
    groups = json.loads(GROUPS_PATH.read_text(encoding="utf-8"))
    return [g["raw_text"] for g in groups if g.get("raw_text")]


def summarize(dm_meta: dict, paths: list[str], limit: int = 50) -> list[dict]:
    items = []
    for p in paths[:limit]:
        m = dm_meta.get(p, {})
        items.append(
            {
                "path": p,
                "dmCode": m.get("dmCode"),
                "dmTitle": m.get("dmTitle"),
            }
        )
    return items


def resolve_applicability(selected: list[str]) -> dict:
    """
    MVP (DM-level):
    - If <applic> == "All" => applicable
    - Else evaluate applicability expression text against `selected`
    - If no <applic>, include by default (and note it)
    """
    index = load_index()
    dm_meta = load_dm_meta(index)

    xml_paths = [
        dm["path"]
        for dm in index["data_modules"]
        if dm.get("path")
        and not dm.get("parse_error")
        and Path(dm["path"]).name.upper().startswith("DMC-")
    ]


    group_exprs = load_group_texts()

    applicable: list[str] = []
    excluded: list[str] = []
    reasons: dict[str, str] = {}

    for p_str in xml_paths:
        p = Path(p_str)
        if not p.is_absolute():
            p = (BASE_DIR / p).resolve()
        
        # print("DEBUG PATH:", p)

        try:
            applic_text = extract_applic_text(p)
        except Exception as e:
            excluded.append(p_str)
            reasons[p_str] = f"XML read error: {e}"
            continue

        if applic_text:
            if applic_text.strip().lower() == "all":
                applicable.append(p_str)
                continue

            try:
                ok = evaluate(applic_text, selected)
            except Exception as e:
                excluded.append(p_str)
                reasons[p_str] = f"Applic parse error: {e}"
                continue

            if ok:
                applicable.append(p_str)
            else:
                excluded.append(p_str)
                reasons[p_str] = f"Applic false for: {applic_text[:120]}"
            continue

        # No <applic> found:
        # For learning/accuracy, treat as NOT applicable unless we can match a known applicability group.
        matched_any_group = any(evaluate(g, selected) for g in group_exprs)

        if matched_any_group:
            applicable.append(p_str)
        else:
            excluded.append(p_str)
            reasons[p_str] = "No <applic> found and no known group matched (strict mode)"


    return {
        "selected": selected,
        "applicable_count": len(applicable),
        "applicable": summarize(dm_meta, applicable, limit=50),
        "excluded_count": len(excluded),
        "excluded": summarize(dm_meta, excluded, limit=50),
        "notes": {
            "resolver_mode": "STRICT_MODE_TEST_v1",
            "default_behavior": "Strict mode: If <applic> missing, exclude unless a known applicability group matches",
            "reasons_sample": dict(list(reasons.items())[:20]),
        },
    }
