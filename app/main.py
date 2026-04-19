from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from app.config import ENVIRONMENT
from app.database import supabase
from app.routes import auth, events 

# FastAPI app initialize 
app = FastAPI(
    title="Myers College API",
    description="Events Management System",
    version="1.0.0"
)

# ✅ SAFE CORS
if ENVIRONMENT == "development":
    allow_origins = ["*"]
else:
    allow_origins = [
        "https://yourdomain.com",
        "https://www.yourdomain.com",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ← include ROUTERS 
app.include_router(auth.router)
app.include_router(events.router)  # ← EVENTS ROUTER

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "environment": ENVIRONMENT}


# ── FRONTEND & STATIC FILE SERVING ───────────────────────────────────────────
# 🛑 FRONTEND DECOUPLED FROM FASTAPI
# HTML web pages and assets are no longer served by this FastAPI application.
# The API now strictly handles backend requests (/api/*). 
# You should run your frontend folder separately using Live Server, Nginx, Vercel, etc.