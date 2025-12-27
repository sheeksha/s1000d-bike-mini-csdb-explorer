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


def choose_main_content_child(content_el):
    """
    Fix: don't assume the first child is the DM type.
    Many DMs start with <refs> then contain <procedure>, etc.
    """
    # Priority order: "real" content types should win over refs
    priority = [
        "procedure",
        "description",
        "appliccrossreftable",
        "frontmatter",
        "brex",
    ]

    # Look for a direct child that matches our priority list
    children = list(content_el)
    for want in priority:
        for child in children:
            if local_name(child.tag).lower() == want:
                return child

    # Fallback: first child (previous behavior)
    return children[0] if children else None

def extract_generic_blocks(main, max_blocks: int = 500):
    """
    Generic renderer for unknown DM types.
    Turns common S1000D-ish structures into simple blocks that React can render.
    """
    blocks = []
    for el in main.iter():
        n = local_name(el.tag)

        # headings
        if n == "title":
            t = text_of(el)
            if t:
                blocks.append({"type": "heading", "text": t})
            continue

        # paragraphs
        if n in ("para", "simplePara"):
            t = text_of(el)
            if t:
                blocks.append({"type": "para", "text": t})
            continue

        # list items
        if n == "listItem":
            t = text_of(el)
            if t:
                blocks.append({"type": "bullet", "text": t})
            continue

        # BREX rules (very useful to show!)
        if n == "structureObjectRule":
            obj_path = ""
            obj_use = ""
            obj_values = []

            for c in el:
                cn = local_name(c.tag)
                if cn == "objectPath":
                    obj_path = text_of(c)
                elif cn == "objectUse":
                    obj_use = text_of(c)
                elif cn == "objectValue":
                    obj_values.append({
                        "valueAllowed": c.get("valueAllowed"),
                        "valueForm": c.get("valueForm"),
                        "valueTailoring": c.get("valueTailoring"),
                        "text": text_of(c) or None,
                    })

            blocks.append({
                "type": "brex_rule",
                "objectPath": obj_path or None,
                "objectUse": obj_use or None,
                "objectValues": obj_values,
            })
            continue

        if len(blocks) >= max_blocks:
            break

    return blocks

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

    # Choose the "main" content child (FIXED)
    main = choose_main_content_child(content_el)

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

        # Collect ONLY direct para text per proceduralStep (no nesting bleed)
        for step_el in main.iter():
            if local_name(step_el.tag) != "proceduralStep":
                continue

            # Ignore parent steps that only wrap other steps
            paras = []
            for child in step_el:
                if local_name(child.tag) == "para":
                    t = text_of(child)
                    if t:
                        paras.append(t)

            if paras:
                steps.append(" ".join(paras))


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
    # ACT / Applicability Cross-Reference Table DM
    # ======================================================
    if main_name == "appliccrossreftable":
        product_attributes = []

        # Find productAttribute nodes under productAttributeList
        for pa in main.iter():
            if local_name(pa.tag) != "productAttribute":
                continue

            pid = pa.get("id") or ""
            name_txt = ""
            display_txt = ""
            descr_txt = ""
            values = []

            for child in pa:
                cn = local_name(child.tag)
                if cn == "name":
                    name_txt = text_of(child)
                elif cn == "displayName":
                    display_txt = text_of(child)
                elif cn == "descr":
                    descr_txt = text_of(child)
                elif cn == "enumeration":
                    v = child.get("applicPropertyValues") or ""
                    if v:
                        # values look like "BR01|BR02"
                        values.extend([x.strip() for x in v.split("|") if x.strip()])

            product_attributes.append({
                "id": pid or None,
                "name": name_txt or None,
                "displayName": display_txt or None,
                "descr": descr_txt or None,
                "values": values
            })

        return {
            "path": norm_path(path_str),
            "dmCode": meta["dmCode"],
            "dmTitle": meta["dmTitle"],
            "dm_type_guess": "appliccrossreftable",
            "product_attributes": product_attributes
        }

    # ======================================================
    # FRONT MATTER DM (Title page)
    # ======================================================
    if main_name == "frontmatter":
        # frontMatter/frontMatterTitlePage contains most of what we need
        title_page = None
        for el in main.iter():
            if local_name(el.tag).lower() == "frontmattertitlepage":
                title_page = el
                break

        def first_text(tag_name: str) -> str | None:
            if title_page is None:
                return None
            for el in title_page.iter():
                if local_name(el.tag).lower() == tag_name.lower():
                    t = text_of(el)
                    return t or None
            return None

        pm_title = first_text("pmTitle")
        short_pm_title = first_text("shortPmTitle")

        # Product intro name is nested: productIntroName/name
        product_intro = None
        if title_page is not None:
            for el in title_page.iter():
                if local_name(el.tag).lower() == "productintroname":
                    # find inner <name>
                    for c in el.iter():
                        if local_name(c.tag).lower() == "name":
                            product_intro = text_of(c) or None
                            break
                    break

        # Collect product models: productAndModel/productModel/modelName/name
        models = []
        if title_page is not None:
            for pm in title_page.iter():
                if local_name(pm.tag).lower() == "productmodel":
                    # find <name> under modelName
                    name_txt = None
                    for c in pm.iter():
                        if local_name(c.tag).lower() == "name":
                            name_txt = text_of(c) or None
                            break
                    if name_txt:
                        models.append(name_txt)

        # Publisher logo URN (symbol @xlink:href or @infoEntityIdent)
        publisher_logo_urn = None
        if title_page is not None:
            for el in title_page.iter():
                if local_name(el.tag).lower() == "symbol":
                    publisher_logo_urn = (
                        el.get("{http://www.w3.org/1999/xlink}href")
                        or el.get("xlink:href")
                        or el.get("infoEntityIdent")
                        or None
                    )
                    break

        return {
            "path": norm_path(path_str),
            "dmCode": meta["dmCode"],
            "dmTitle": meta["dmTitle"],
            "dm_type_guess": "frontmatter",
            "frontmatter": {
                "product_intro_name": product_intro,
                "pm_title": pm_title,
                "short_pm_title": short_pm_title,
                "models": models,
                "publisher_logo_urn": publisher_logo_urn,
            },
        }

    # ======================================================
    # BREX DM (Business rules)
    # ======================================================
    if main_name == "brex":
        # --- 1) commonInfo (intro narrative) ---
        intro = {"title": None, "paras": [], "bullets": []}

        common_info = None
        for el in main:
            if local_name(el.tag) == "commonInfo":
                common_info = el
                break

        if common_info is not None:
            # title
            for ch in common_info:
                if local_name(ch.tag) == "title":
                    t = text_of(ch)
                    if t:
                        intro["title"] = t
                    break

            # paragraphs and list items
            for el in common_info.iter():
                n = local_name(el.tag)
                if n in ("para", "simplePara"):
                    t = text_of(el)
                    if t:
                        intro["paras"].append(t)
                elif n == "listItem":
                    t = text_of(el)
                    if t:
                        intro["bullets"].append(t)

        # --- 2) reasonForUpdate: id -> list of paras ---
        rfu_map = {}  # {"rfu-008": ["text1", "text2"], ...}
        # note: reasonForUpdate lives in identAndStatusSection, not <content>
        for el in root.iter():
            if local_name(el.tag) != "reasonForUpdate":
                continue
            rid = el.get("id")
            if not rid:
                continue
            paras = []
            for p in el.iter():
                if local_name(p.tag) in ("para", "simplePara"):
                    t = text_of(p)
                    if t:
                        paras.append(t)
            if paras:
                rfu_map[rid] = paras

        # --- 3) Context Rules: structureObjectRule ---
        context_rules = []
        # find contextRules node
        ctx = None
        for el in main.iter():
            if local_name(el.tag) == "contextRules":
                ctx = el
                break

        if ctx is not None:
            for rule in ctx.iter():
                if local_name(rule.tag) != "structureObjectRule":
                    continue

                rule_obj_path = None
                rule_obj_use = None
                allowed_flag = None
                values = []

                # attributes on structureObjectRule itself
                change_type = rule.get("changeType")
                change_mark = rule.get("changeMark")
                rfu_ids = (rule.get("reasonForUpdateRefIds") or "").strip() or None

                # objectPath has allowedObjectFlag attr
                for ch in rule:
                    cn = local_name(ch.tag)

                    if cn == "objectPath":
                        rule_obj_path = text_of(ch) or None
                        allowed_flag = ch.get("allowedObjectFlag") or None

                    elif cn == "objectUse":
                        rule_obj_use = text_of(ch) or None

                    elif cn == "objectValue":
                        values.append({
                            "valueAllowed": ch.get("valueAllowed"),
                            "valueForm": ch.get("valueForm"),
                            "valueTailoring": ch.get("valueTailoring"),
                            "text": text_of(ch) or None,
                            "changeType": ch.get("changeType"),
                            "changeMark": ch.get("changeMark"),
                            "reasonForUpdateRefIds": (ch.get("reasonForUpdateRefIds") or "").strip() or None,
                        })

                context_rules.append({
                    "objectPath": rule_obj_path,
                    "objectUse": rule_obj_use,
                    "allowedObjectFlag": allowed_flag,
                    "changeType": change_type,
                    "changeMark": change_mark,
                    "reasonForUpdateRefIds": rfu_ids,
                    "values": values,
                })

        # --- 4) Non-context rules ---
        non_context = []
        for el in main.iter():
            if local_name(el.tag) == "nonContextRule":
                # collect its simplePara content
                for p in el.iter():
                    if local_name(p.tag) in ("para", "simplePara"):
                        t = text_of(p)
                        if t:
                            non_context.append(t)

        return {
            "path": norm_path(path_str),
            "dmCode": meta["dmCode"],
            "dmTitle": meta["dmTitle"],
            "dm_type_guess": "brex",
            "intro": intro,
            "context_rules": context_rules[:1200],   # safety cap
            "non_context_rules": non_context[:400],  # safety cap
            "reason_for_update": rfu_map,            # small map, ok
        }

    # ======================================================
    # OTHER DM TYPES
    # ======================================================
    blocks = extract_generic_blocks(main, max_blocks=400)
    return {
        "path": norm_path(path_str),
        "dmCode": meta["dmCode"],
        "dmTitle": meta["dmTitle"],
        "dm_type_guess": main_name,
        "blocks": blocks,
    }
