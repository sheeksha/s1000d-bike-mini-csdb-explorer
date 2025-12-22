import re
from xml.sax.saxutils import escape

RE_WARNING = re.compile(r"^\s*(warning|warn)\s*[:\-]?\s*(.+)$", re.IGNORECASE)
RE_CAUTION = re.compile(r"^\s*(caution|caut)\s*[:\-]?\s*(.+)$", re.IGNORECASE)
RE_NOTE = re.compile(r"^\s*(note)\s*[:\-]?\s*(.+)$", re.IGNORECASE)
RE_STEP_PREFIX = re.compile(r"^\s*(?:step\s*\d+|[0-9]+[.)])\s*[:\-]?\s*(.+)$", re.IGNORECASE)


IMPERATIVE_START = (
    "remove", "install", "disconnect", "connect", "inspect", "verify", "tighten",
    "loosen", "apply", "turn", "switch", "open", "close", "secure", "clean", "attach"
)

def guess_dm_type(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ("troubleshoot", "fault", "symptom")):
        return "fault"
    if any(k in t for k in ("part number", "qty", "quantity", "nomenclature")):
        return "parts"
    if any(k in t for k in ("step", "remove", "install", "disconnect", "connect", "procedure")):
        return "procedure"
    if any(k in t for k in ("description", "consists of", "is made of", "overview")):
        return "description"
    return "unknown"

def map_engineer_notes(text: str) -> dict:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    dm_type = guess_dm_type(text)

    prelim = []
    warnings = []
    cautions = []
    notes = []
    steps = []

    for ln in lines:
        m = RE_WARNING.match(ln)
        if m:
            warnings.append(m.group(2).strip())
            continue

        m = RE_CAUTION.match(ln)
        if m:
            cautions.append(m.group(2).strip())
            continue

        m = RE_NOTE.match(ln)
        if m:
            notes.append(m.group(2).strip())
            continue

        m = RE_STEP_PREFIX.match(ln)
        if m:
            steps.append(m.group(1).strip())
            continue

        first = ln.split(" ", 1)[0].lower()
        if first in IMPERATIVE_START:
            steps.append(ln)
            continue

        if any(k in ln.lower() for k in ("must", "ensure", "before", "power off", "access panel", "aircraft")):
            prelim.append(ln)
            continue

    return {
        "dm_type_guess": dm_type,
        "preliminary_requirements": prelim,
        "warnings": warnings,
        "cautions": cautions,
        "notes": notes,
        "steps": steps,
    }

def to_procedural_dm_xml(mapped: dict) -> str:
    """
    Generate a simple S1000D-like procedural DM XML skeleton.
    (Learning/authoring aid — not aiming for full schema validation yet.)
    """
    warnings = mapped.get("warnings", [])
    cautions = mapped.get("cautions", [])
    notes = mapped.get("notes", [])
    steps = mapped.get("steps", [])

    w_xml = "\n".join(
        f"""      <warning><para>{escape(w)}</para></warning>""" for w in warnings
    )
    c_xml = "\n".join(
        f"""      <caution><para>{escape(c)}</para></caution>""" for c in cautions
    )
    n_xml = "\n".join(
        f"""      <note><para>{escape(n)}</para></note>""" for n in notes
    )
    s_xml = "\n".join(
        f"""      <proceduralStep><para>{escape(s)}</para></proceduralStep>""" for s in steps
    )

    body = "\n".join(x for x in [w_xml, c_xml, n_xml, s_xml] if x.strip())

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<dmodule>
  <content>
    <procedure>
{body if body else "      <para/>"}
    </procedure>
  </content>
</dmodule>
"""