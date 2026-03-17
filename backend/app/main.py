from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .rbtree import DuplicateValueError, RBTree


app = FastAPI(title="Interactive RB Tree")
tree = RBTree()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InsertRequest(BaseModel):
    value: int


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_, exc: RequestValidationError) -> JSONResponse:
    first_error = exc.errors()[0] if exc.errors() else None
    detail = first_error.get("msg", "Invalid request") if first_error else "Invalid request"
    return JSONResponse(status_code=400, content={"detail": detail})


@app.get("/api/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@app.get("/api/tree/export")
def export_tree() -> dict:
    return {"tree": tree.export()}


@app.post("/api/tree/reset")
def reset_tree() -> dict:
    tree.reset()
    return {"tree": tree.export()}


@app.post("/api/tree/insert")
def insert_value(payload: InsertRequest) -> dict:
    try:
        return tree.insert(payload.value)
    except DuplicateValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
