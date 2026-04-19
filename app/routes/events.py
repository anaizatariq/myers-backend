from fastapi import APIRouter, HTTPException, status, Header, UploadFile, File
from typing import List, Optional
from datetime import date, datetime
from app.schemas import EventCreate, EventUpdate, EventResponse
from app.database import supabase
from app.auth import verify_token

router = APIRouter(prefix="/api/events", tags=["events"])


# ── HELPER ────────────────────────────────────────────────────────────────────

def get_token_from_header(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise ValueError()
        return token
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )


def require_role(user: dict, allowed_roles: list):
    if user["role"] not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission for this action"
        )


# ── PUBLIC ENDPOINTS ──────────────────────────────────────────────────────────

@router.get("/upcoming", response_model=List[EventResponse])
def get_upcoming_events(limit: int = 4):
    try:
        # Use the most stable database query bypassing date constraints.
        # Orders by descending ID to ensure the newest created events always show up.
        response = (
            supabase.table("events")
            .select("*")
            .eq("is_active", True)
            .order("id", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch upcoming events: {str(e)}")


@router.get("/", response_model=List[EventResponse])
def get_all_events(skip: int = 0, limit: int = 100):
    try:
        response = (
            supabase.table("events")
            .select("*")
            .order("event_date", desc=False)
            .range(skip, skip + limit - 1)
            .execute()
        )
        # Filter active dynamically in python
        active_events = [e for e in response.data if e.get("is_active") in [True, "true", "True", 1, "1", "yes"]]
        return active_events
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int):
    try:
        response = (
            supabase.table("events")
            .select("*")
            .eq("id", event_id)
            .eq("is_active", True)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Event not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch event: {str(e)}")


# ── ADMIN ENDPOINTS ───────────────────────────────────────────────────────────

# NOTE: /admin/all and /admin/upload-image MUST come before /admin/{event_id}
# to prevent FastAPI treating "all" and "upload-image" as integer IDs

@router.get("/admin/all", response_model=List[EventResponse])
def get_all_events_admin(authorization: Optional[str] = Header(None)):
    token = get_token_from_header(authorization)
    user = verify_token(token)
    require_role(user, ["principal", "senior", "junior"])
    try:
        response = (
            supabase.table("events")
            .select("*")
            .order("event_date", desc=False)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")


@router.post("/admin/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    token = get_token_from_header(authorization)
    user = verify_token(token)
    require_role(user, ["principal", "senior", "junior"])

    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, PNG, WEBP allowed")

    max_size = 5 * 1024 * 1024  # 5MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")

    try:
        timestamp = int(datetime.utcnow().timestamp())
        safe_filename = file.filename.replace(" ", "_")
        path = f"events/{user['username']}/{timestamp}_{safe_filename}"

        supabase.storage.from_("event-images").upload(
            path,
            contents,
            {"content-type": file.content_type, "upsert": "true"}
        )

        public_url = supabase.storage.from_("event-images").get_public_url(path)

        return {"success": True, "url": public_url, "filename": path}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/admin/create", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event: EventCreate, authorization: Optional[str] = Header(None)):
    token = get_token_from_header(authorization)
    user = verify_token(token)
    require_role(user, ["principal", "senior", "junior"])

    try:
        event_data = {
            "title": event.title,
            "description": event.description,
            "event_date": event.event_date.isoformat(),
            "event_end_date": event.event_end_date.isoformat() if event.event_end_date else None,
            "image_url": event.image_url,
            "is_active": True,
            "created_by": user["username"],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        response = supabase.table("events").insert(event_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create event")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create event: {str(e)}")


@router.put("/admin/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event: EventUpdate,
    authorization: Optional[str] = Header(None)
):
    token = get_token_from_header(authorization)
    user = verify_token(token)
    require_role(user, ["principal", "senior", "junior"])

    # Verify event exists
    check = supabase.table("events").select("id").eq("id", event_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = {"updated_at": datetime.utcnow().isoformat()}
    if event.title is not None:
        update_data["title"] = event.title
    if event.description is not None:
        update_data["description"] = event.description
    if event.event_date is not None:
        update_data["event_date"] = event.event_date.isoformat()
    if event.event_end_date is not None:
        update_data["event_end_date"] = event.event_end_date.isoformat()
    if event.image_url is not None:
        update_data["image_url"] = event.image_url

    try:
        response = (
            supabase.table("events")
            .update(update_data)
            .eq("id", event_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to update event")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update event: {str(e)}")


@router.delete("/admin/{event_id}", status_code=status.HTTP_200_OK)
def delete_event(event_id: int, authorization: Optional[str] = Header(None)):
    """Hard delete — removes from DB and admin panel permanently"""
    token = get_token_from_header(authorization)
    user = verify_token(token)

    if user["role"] != "principal":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only principal can delete events"
        )

    check = supabase.table("events").select("id").eq("id", event_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Event not found")

    try:
        # Hard delete — gone from DB immediately
        supabase.table("events").delete().eq("id", event_id).execute()
        return {"message": "Event deleted successfully", "event_id": event_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete event: {str(e)}")