import os

import psycopg2
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg2 import errors

from .routers import admissions, analytics, appointments, auth_routes, billing, clinical, patients

app = FastAPI(title="Smart Hospital Management System", version="1.0.0")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)


@app.exception_handler(psycopg2.Error)
async def postgres_error_handler(request: Request, exc: psycopg2.Error):
    """Turn database rule violations (triggers, constraints) into clean API errors."""
    message = (exc.diag.message_primary if getattr(exc, "diag", None) and exc.diag.message_primary else str(exc))
    if isinstance(exc, errors.UniqueViolation):
        code = 409
    elif isinstance(
        exc,
        (errors.RaiseException, errors.CheckViolation, errors.ForeignKeyViolation,
         errors.NotNullViolation, errors.InvalidTextRepresentation),
    ):
        code = 400
    elif isinstance(exc, errors.InsufficientPrivilege):
        code = 403
    else:
        code = 500
        message = "Database error"
    return JSONResponse(status_code=code, content={"detail": message})


@app.get("/api/health")
def health():
    return {"status": "ok"}


for r in (auth_routes, patients, appointments, clinical, admissions, billing, analytics):
    app.include_router(r.router, prefix="/api")
