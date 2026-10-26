from app.routers.locations import router as locations_router
from app.routers.diaries import router as diaries_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.health import router as health_router


app = FastAPI(
    title="LifeLog Diary API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(locations_router)
app.include_router(diaries_router)