import json
from pathlib import Path
from lxml import etree

DATASET_DIR = Path("data/S1000D_4-1_Bike_Samples")
OUT_PATH = Path("data/bike_index.json")

def local_name(tag) -> str:
    # lxml can return non-string tag values (comments, PI nodes)
    if not isinstance(tag, str):
        return ""
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag

def build_dmcode_from_attrs(attrs: dict) -> str | None:
    required = [
        "modelIdentCode", "systemDiffCode", "systemCode",
        "subSystemCode", "subSubSystemCode", "assyCode",
        "disassyCode", "disassyCodeVariant",
        "infoCode", "infoCodeVariant", "itemLocationCode",
    ]
    if not all(k in attrs for k in required):
        return None

    return (
        f"{attrs['modelIdentCode']}-"
        f"{attrs['systemDiffCode']}-"
        f"{attrs['systemCode']}-"
        f"{attrs['subSystemCode']}{attrs['subSubSystemCode']}-"
        f"{attrs['assyCode']}-"
        f"{attrs['disassyCode']}{attrs['disassyCodeVariant']}-"
        f"{attrs['infoCode']}{attrs['infoCodeVariant']}-"
        f"{attrs['itemLocationCode']}"
    )

def extract_first_text(root, wanted_localnames: set[str]) -> str | None:
    # Finds first element whose local name matches
    for el in root.iter():
        if local_name(el.tag) in wanted_localnames:
            txt = " ".join("".join(el.itertext()).split())
            return txt or None
    return None

def find_applicability_signals(root) -> dict:
    """
    Heuristic: find anything that looks like applicability:
    - element names containing 'applic'
    - attributes containing 'applic'
    Returns small snippets so we can learn the dataset patterns.
    """
    signals = {
        "has_applicability": False,
        "elements": [],
        "attributes": []
    }

    # element-name signals
    for el in root.iter():
        name = local_name(el.tag).lower()
        if not name:
            continue
        if "applic" in name:
            signals["has_applicability"] = True
            snippet = " ".join("".join(el.itertext()).split())
            signals["elements"].append({
                "name": local_name(el.tag),
                "text": snippet[:180] if snippet else ""
            })
            if len(signals["elements"]) >= 10:
                break

    # attribute-name signals
    # (Some datasets use attributes for applicability IDs/refs)
    if not signals["has_applicability"]:
        for el in root.iter():
            for k, v in el.attrib.items():
                if "applic" in k.lower():
                    signals["has_applicability"] = True
                    signals["attributes"].append({
                        "element": local_name(el.tag),
                        "attr": k,
                        "value": v[:120]
                    })
                    if len(signals["attributes"]) >= 10:
                        break
            if len(signals["attributes"]) >= 10:
                break

    return signals

def main():
    if not DATASET_DIR.exists():
        raise SystemExit(f"Dataset folder not found: {DATASET_DIR.resolve()}")

    xml_files = sorted([p for p in DATASET_DIR.rglob("*.xml")])
    if not xml_files:
        raise SystemExit(f"No .xml files found under {DATASET_DIR.resolve()}")

    index = {
        "dataset_dir": str(DATASET_DIR),
        "file_count": len(xml_files),
        "data_modules": []
    }

    for path in xml_files:
        try:
            xml_bytes = path.read_bytes()
            root = etree.fromstring(xml_bytes)
        except Exception as e:
            index["data_modules"].append({
                "path": str(path),
                "parse_error": str(e)
            })
            continue

        # dm_code = extract_first_text(root, {"dmCode"})
        dm_code = None

        # Prefer dmIdent/dmCode (the DM's own code)
        for el in root.iter():
            if local_name(el.tag) == "dmIdent":
                for child in el.iter():
                    if local_name(child.tag) == "dmCode":
                        dm_code = build_dmcode_from_attrs(child.attrib)
                        break
            if dm_code:
                break

        # Fallback: dmRefIdent/dmCode (sometimes present)
        if not dm_code:
            for el in root.iter():
                if local_name(el.tag) == "dmRefIdent":
                    for child in el.iter():
                        if local_name(child.tag) == "dmCode":
                            dm_code = build_dmcode_from_attrs(child.attrib)
                            break
                if dm_code:
                    break

        # Final fallback: filename stem
        if not dm_code:
            dm_code = path.stem


        dm_title = extract_first_text(root, {"dmTitle"})
        # fallback for datasets that store titles differently
        if not dm_title:
            dm_title = extract_first_text(root, {"techName", "title"})

        applic = find_applicability_signals(root)

        index["data_modules"].append({
            "path": str(path),
            "dmCode": dm_code,
            "dmTitle": dm_title,
            "has_applicability": applic["has_applicability"],
            "applicability_signals": applic
        })

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")

    # quick summary for you
    parse_errors = sum(1 for x in index["data_modules"] if x.get("parse_error"))
    has_app = sum(1 for x in index["data_modules"] if x.get("has_applicability"))

    print(f"Indexed XML files: {len(xml_files)}")
    print(f"Parse errors: {parse_errors}")
    print(f"DMs with applicability signals: {has_app}")
    print(f"Wrote: {OUT_PATH.resolve()}")

if __name__ == "__main__":
    main()
