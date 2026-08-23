import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.error_handling import install_error_handlers
from app.routers import auth, patients, cases, sync, predict
from app.integrations.quality_client import is_using_real_module as quality_is_real
from app.integrations.risk_client import is_using_real_module as risk_is_real

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TobaccoShield Backend (Member D)",
    description="Patient records, case queue, auth, sync, and doctor dashboard API for TobaccoShield Phase 1.",
    version="1.0.0",
)

install_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before any real deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(cases.router)
app.include_router(sync.router)
app.include_router(predict.router)

DASHBOARD_DIR = Path(__file__).resolve().parent.parent / "dashboard"
if DASHBOARD_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=str(DASHBOARD_DIR), html=True), name="dashboard")

SAMPLE_IMAGES_DIR = Path(__file__).resolve().parent.parent / "sample_images"
if SAMPLE_IMAGES_DIR.exists():
    app.mount("/sample-images", StaticFiles(directory=str(SAMPLE_IMAGES_DIR)), name="sample_images")

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
if UPLOAD_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "quality_module": "real" if quality_is_real() else "stub (Member B not installed yet)",
        "risk_module": "real" if risk_is_real() else "stub (Member C not installed yet)",
    }


@app.get("/")
def root():
    return {
        "service": "TobaccoShield Backend (Member D)",
        "docs": "/docs",
        "dashboard": "/dashboard",
        "health": "/health",
    }
