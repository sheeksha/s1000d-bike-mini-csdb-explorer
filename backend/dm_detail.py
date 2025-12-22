from pathlib import Path
from lxml import etree

BASE_DIR = Path(__file__).resolve().parent.parent

def local_name(tag) -> str:
    if not isinstance(tag, str):
        return ""
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag

def extract_applic_text_from_xml_bytes(xml_bytes: bytes) -> str | None:
    try:
        root = etree.fromstring(xml_bytes)
        for el in root.iter():
            if local_name(el.tag) == "applic":
                txt = " ".join("".join(el.itertext()).split())
                return txt or None
    except Exception:
        return None
    return None

def load_dm_details(path: str) -> dict:
    safe = path.replace("\\", "/")
    p = Path(path)
    if not p.is_absolute():
        p = (BASE_DIR / p).resolve()

    xml_bytes = p.read_bytes()
    xml = xml_bytes.decode("utf-8", errors="ignore")
    applic_text = extract_applic_text_from_xml_bytes(xml_bytes)

    return {
        "path": path,
        "xml": xml,
        "applic_text": applic_text
    }
