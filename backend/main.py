from fastapi import FastAPI
from pydantic import BaseModel

from backend.applic_resolver import resolve_applicability
from backend.notes_mapper import map_engineer_notes, to_procedural_dm_xml
from backend.dm_catalog import list_dms
from backend.dm_detail import load_dm_details
from backend.dm_eval import eval_dm
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="S1000D Applicability Resolver")



app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://s1000d-bike-mini-csdb-explorer.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResolveRequest(BaseModel):
    selected: list[str]

class NotesRequest(BaseModel):
    text: str

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/resolve")
def resolve(req: ResolveRequest):
    return resolve_applicability(req.selected)

@app.post("/map-notes")
def map_notes(req: NotesRequest):
    return map_engineer_notes(req.text)

@app.post("/map-notes-to-xml")
def map_notes_to_xml(req: NotesRequest):
    mapped = map_engineer_notes(req.text)
    # MVP: if not procedure, still output procedure skeleton (we'll add other types later)
    xml = to_procedural_dm_xml(mapped)
    return {"dm_type_guess": mapped["dm_type_guess"], "xml": xml}

@app.get("/dms")
def get_dms(only_dmc: bool = True):
    return {"items": list_dms(only_dmc=only_dmc)}

@app.get("/dm")
def get_dm(path: str):
    return load_dm_details(path)

@app.get("/dm-eval")
def dm_eval(path: str, selected: str = ""):
    labels = [s.strip() for s in selected.split(",") if s.strip()]
    return eval_dm(path, labels)