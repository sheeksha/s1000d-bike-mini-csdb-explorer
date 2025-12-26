import json
from pathlib import Path
from lxml import etree

BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_PATH = BASE_DIR / "data" / "bike_index.json"


# -------------------------
# Helpers
# -------------------------

def norm_path(p: str) -> str:
    return p.replace("\\", "/") if isinstance(p, str) else p


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


def meta_for_path(request_path: str) -> dict:
    idx = load_index()
    target = norm_path(request_path)

    for dm in idx.get("data_modules", []):
        p = dm.get("path")
        if not p:
            continue
        if norm_path(p) == target:
            return {
                "dmCode": dm.get("dmCode"),
                "dmTitle": dm.get("dmTitle"),
            }

    return {"dmCode": None, "dmTitle": None}


def read_root(path_str: str):
    path_str = norm_path(path_str)
    p = Path(path_str)
    if not p.is_absolute():
        p = (BASE_DIR / p).resolve()
    return etree.fromstring(p.read_bytes())


# -------------------------
# Main extractor
# -------------------------

def extract_dm_preview(path_str: str) -> dict:
    root = read_root(path_str)
    meta = meta_for_path(path_str)

    # Find <content>
    content_el = None
    for el in root.iter():
        if local_name(el.tag) == "content":
            content_el = el
            break

    if content_el is None:
        return {
            "path": norm_path(path_str),
            "dmCode": meta["dmCode"],
            "dmTitle": meta["dmTitle"],
            "dm_type_guess": "unknown",
            "blocks": [],
        }

    # First real child under <content>
    main = None
    for child in content_el:
        main = child
        break

    if main is None:
        return {
            "path": norm_path(path_str),
            "dmCode": meta["dmCode"],
            "dmTitle": meta["dmTitle"],
            "dm_type_guess": "unknown",
            "blocks": [],
        }

    main_name = local_name(main.tag).lower()

    # ======================================================
    # PROCEDURE DM
    # ======================================================
    if main_name == "procedure":
        warnings, cautions, notes, steps = [], [], [], []

        for el in main.iter():
            n = local_name(el.tag)

            if n == "warning":
                t = text_of(el)
                if t:
                    warnings.append(t)

            elif n == "caution":
                t = text_of(el)
                if t:
                    cautions.append(t)

            elif n == "note":
                t = text_of(el)
                if t:
                    notes.append(t)

        for el in main.iter():
            if local_name(el.tag) == "proceduralStep":
                t = text_of(el)
                if t:
                    steps.append(t)

        return {
            "path": norm_path(path_str),
            "dmCode": meta["dmCode"],
            "dmTitle": meta["dmTitle"],
            "dm_type_guess": "procedure",
            "warnings": warnings,
            "cautions": cautions,
            "notes": notes,
            "steps": steps,
        }

    # ======================================================
    # DESCRIPTION DM
    # ======================================================
    if main_name == "description":
        blocks = []

        for el in main.iter():
            n = local_name(el.tag)

            # --- Headings (but NOT figure titles) ---
            if n == "title":
                parent = el.getparent()
                if parent is not None and local_name(parent.tag) == "figure":
                    continue

                t = text_of(el)
                if t:
                    blocks.append({"type": "heading", "text": t})
                continue

            # --- Paragraphs (but NOT those inside list items) ---
            if n == "para":
                parent = el.getparent()
                if parent is not None and local_name(parent.tag) in ("listItem", "randomList"):
                    continue

                t = text_of(el)
                if t:
                    blocks.append({"type": "para", "text": t})
                continue

            # --- Bulleted list items ---
            if n == "listItem":
                t = text_of(el)
                if t:
                    blocks.append({"type": "bullet", "text": t})
                continue

            # --- Figures ---
            if n == "figure":
                fig_title = ""
                urn = ""

                for c in el:
                    if local_name(c.tag) == "title":
                        fig_title = text_of(c)
                    elif local_name(c.tag) == "graphic":
                        urn = (
                            c.get("{http://www.w3.org/1999/xlink}href")
                            or c.get("xlink:href")
                            or ""
                        )

                blocks.append({
                    "type": "figure",
                    "title": fig_title or "(figure)",
                    "urn": urn
                })
                continue

        return {
            "path": norm_path(path_str),
            "dmCode": meta["dmCode"],
            "dmTitle": meta["dmTitle"],
            "dm_type_guess": "description",
            "blocks": blocks[:400],  # safety cap
        }

    # ======================================================
    # OTHER DM TYPES
    # ======================================================
    return {
        "path": norm_path(path_str),
        "dmCode": meta["dmCode"],
        "dmTitle": meta["dmTitle"],
        "dm_type_guess": main_name,
        "blocks": [],
    }
