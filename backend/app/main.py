from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import resources, sessions

app = FastAPI(title="FieldFlo Evals UI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(resources.router)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
