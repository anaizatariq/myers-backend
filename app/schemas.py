from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

# ============================================
# USER SCHEMAS
# ============================================

class UserLoginRequest(BaseModel):
    """Login Request"""
    username: str
    password: str


class UserLoginResponse(BaseModel):
    """Login Response"""
    access_token: str
    token_type: str
    username: str
    role: str
    department: Optional[str] = None


# ============================================
# EVENT SCHEMAS
# ============================================

class EventBase(BaseModel):
    """Base Event Schema"""
    title: str
    description: Optional[str] = None
    event_date: date
    event_end_date: Optional[date] = None
    image_url: Optional[str] = None


class EventCreate(EventBase):
    """Create Event"""
    pass


class EventUpdate(BaseModel):
    """Update Event"""
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[date] = None
    event_end_date: Optional[date] = None
    image_url: Optional[str] = None


class EventResponse(EventBase):
    """Event Response"""
    id: int
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True