from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_DIR = BASE_DIR / "data" / "S1000D_4-1_Bike_Samples"

# Allowed web-viewable formats
WEB_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}

MIME_MAP = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
}

def urn_to_candidate_prefix(urn: str) -> str:
    # URN:S1000D:ICN-... -> ICN-...
    u = (urn or "").strip()
    if u.upper().startswith("URN:S1000D:"):
        u = u.split(":", 2)[-1]  # keep ICN-...
    return u

def find_icn_file(urn: str) -> Path:
    prefix = urn_to_candidate_prefix(urn)

    # Some DMs use ICN-... exactly; files may be upper/lower case differences
    # We'll search for any file whose stem starts with that prefix.
    matches = []
    for p in DATASET_DIR.rglob("*"):
        if not p.is_file():
            continue
        if p.name.upper().startswith(prefix.upper()):
            matches.append(p)

    if not matches:
        raise HTTPException(status_code=404, detail=f"ICN not found for URN: {urn}")

    # Prefer web formats first; else return first match
    web = [m for m in matches if m.suffix.lower() in WEB_EXTS]
    if web:
        return web[0]
    return matches[0]

def serve_icn_by_urn(urn: str):
    p = find_icn_file(urn)
    ext = p.suffix.lower()

    if ext == ".cgm":
        raise HTTPException(
            status_code=415,
            detail="CGM graphic found but not web-renderable. Convert CGM to PNG/SVG to display."
        )

    if ext not in WEB_EXTS:
        raise HTTPException(status_code=415, detail=f"Unsupported image type: {ext}")

    return FileResponse(str(p), media_type=MIME_MAP.get(ext, "application/octet-stream"))
