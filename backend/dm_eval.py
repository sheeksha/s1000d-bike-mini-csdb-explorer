import json
from pathlib import Path
from lxml import etree

from backend.eval_applic_expr import evaluate
from backend.s1000d_code import build_dmcode_from_attrs

BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_PATH = BASE_DIR / "data" / "bike_index.json"

def local_name(tag) -> str:
    if not isinstance(tag, str):
        return ""
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag

def norm_path(p: str) -> str:
    # Convert Windows backslashes to Linux-friendly slashes
    return p.replace("\\", "/") if isinstance(p, str) else p

def text_of(el) -> str:
    return " ".join("".join(el.itertext()).split())

def load_index() -> dict:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))

def dmcode_to_path_map(index: dict) -> dict[str, str]:
    m = {}
    for dm in index.get("data_modules", []):
        if dm.get("parse_error"):
            continue
        if dm.get("dmCode") and dm.get("path"):
            m[dm["dmCode"]] = dm["path"]
    return m

def read_xml_root(path_str: str):
    path_str = norm_path(path_str)
    p = Path(path_str)
    if not p.is_absolute():
        p = (BASE_DIR / p).resolve()
    return etree.fromstring(p.read_bytes())


def extract_applic_text(root) -> str | None:
    for el in root.iter():
        if local_name(el.tag) == "applic":
            t = text_of(el)
            return t or None
    return None

def has_applic_structures(root) -> bool:
    for el in root.iter():
        if "applic" in local_name(el.tag).lower():
            return True
    return False

def extract_act_dmcode_from_dm(root) -> str | None:
    """
    Extract dmCode specifically from within <applicCrossRefTableRef> ... </applicCrossRefTableRef>.
    We DO NOT want the DM's own dmIdent/dmCode.
    """
    for acr in root.iter():
        if local_name(acr.tag) != "applicCrossRefTableRef":
            continue

        # search descendants of applicCrossRefTableRef only
        for child in acr.iter():
            if local_name(child.tag) == "dmCode":
                dmcode = build_dmcode_from_attrs(child.attrib)
                if dmcode:
                    return dmcode
    return None


def extract_group_ids_referenced_by_dm(root) -> set[str]:
    """
    Try to find referenced applicability group IDs referenced by the DM.
    We look for any element with name containing 'referencedApplicGroupRef' or 'applicRef'
    and collect attribute values that look like IDs.
    """
    ids = set()
    for el in root.iter():
        n = local_name(el.tag)
        if n in ("referencedApplicGroupRef", "referencedApplicGroupRefId", "applicRef", "applicRefId"):
            # common patterns: refId/refid/idRef/idref/ids
            for k, v in el.attrib.items():
                lk = k.lower()
                if "ref" in lk or "id" in lk:
                    if v:
                        ids.add(v)
    return ids

def extract_referenced_applic_groups_from_act(act_root) -> dict[str, str]:
    """
    Return { group_id: group_expression_text }
    Uses <referencedApplicGroup> blocks inside the ACT DM.
    """
    groups = {}
    for el in act_root.iter():
        if local_name(el.tag) == "referencedApplicGroup":
            gid = None
            # id attribute is common; sometimes it's 'id' / 'applicGroupId'
            for k in ("id", "applicGroupId", "ident"):
                if el.get(k):
                    gid = el.get(k)
                    break
            expr = text_of(el)
            if gid and expr:
                groups[gid] = expr
    return groups

def eval_dm(path: str, selected: list[str]) -> dict:
    path = norm_path(path)
    p = Path(path)
    if not p.is_absolute():
        p = (BASE_DIR / p).resolve()

    xml_bytes = p.read_bytes()
    root = etree.fromstring(xml_bytes)

    applic_text = extract_applic_text(root)
    has_struct = has_applic_structures(root)

    # 1) Direct <applic>
    if applic_text:
        try:
            ok = evaluate(applic_text, selected)
        except Exception:
            ok = False
        return {
            "path": path,
            "has_applic_structures": has_struct,
            "applies": bool(ok),
            "reason_kind": "applic",
            "reason_text": applic_text,
            "act_dmCode": None,
        }

    # 2) ACT-aware path (use applicCrossRefTableRef)
    index = load_index()
    dm_map = dmcode_to_path_map(index)

    act_dmcode = extract_act_dmcode_from_dm(root)
    if act_dmcode and act_dmcode in dm_map:
        act_path = dm_map[act_dmcode]
        act_path = norm_path(act_path)
        act_root = read_xml_root(act_path)

        act_groups = extract_referenced_applic_groups_from_act(act_root)
        referenced_ids = extract_group_ids_referenced_by_dm(root)

        # decide which group expressions to evaluate
        candidates = []
        if referenced_ids:
            # only evaluate groups referenced by this DM
            for rid in referenced_ids:
                if rid in act_groups:
                    candidates.append((rid, act_groups[rid]))
        if not candidates:
            # fallback: evaluate all groups in this ACT (still ACT-scoped, not global!)
            candidates = list(act_groups.items())

        for gid, expr in candidates:
            try:
                if evaluate(expr, selected):
                    return {
                        "path": path,
                        "has_applic_structures": has_struct,
                        "applies": True,
                        "reason_kind": "ACT",
                        "reason_text": expr,
                        "reason_group_id": gid,
                        "act_dmCode": act_dmcode,
                        "act_path": act_path,
                    }
            except Exception:
                continue

        return {
            "path": path,
            "has_applic_structures": has_struct,
            "applies": False,
            "reason_kind": "ACT",
            "reason_text": None,
            "reason_group_id": None,
            "act_dmCode": act_dmcode,
            "act_path": dm_map[act_dmcode],
        }

    # 3) No <applic>, no ACT ref found (or ACT not in index)
    return {
        "path": path,
        "has_applic_structures": has_struct,
        "applies": False,
        "reason_kind": "none",
        "reason_text": None,
        "act_dmCode": act_dmcode,
    }
