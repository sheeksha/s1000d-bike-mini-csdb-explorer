import json
from pathlib import Path
from lxml import etree

DATASET_DIR = Path("data/S1000D_4-1_Bike_Samples")
OUT_PATH = Path("data/applic_groups.json")

def local_name(tag) -> str:
    if not isinstance(tag, str):
        return ""
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag

def text_of(el) -> str:
    return " ".join("".join(el.itertext()).split())

def main():
    xml_files = sorted(DATASET_DIR.rglob("*.xml"))
    groups = []

    for path in xml_files:
        root = etree.fromstring(path.read_bytes())

        # grab any referencedApplicGroup blocks
        for el in root.iter():
            if local_name(el.tag) == "referencedApplicGroup":
                g = {
                    "source": str(path),
                    "raw_text": text_of(el),
                    "ids": {},
                }
                # capture any attributes that look like IDs
                for k, v in el.attrib.items():
                    g["ids"][k] = v
                groups.append(g)

    OUT_PATH.write_text(json.dumps(groups, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Found referencedApplicGroup blocks: {len(groups)}")
    print(f"Wrote: {OUT_PATH.resolve()}")

if __name__ == "__main__":
    main()
