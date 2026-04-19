from fastapi import APIRouter, HTTPException, status
from app.schemas import UserLoginRequest, UserLoginResponse
from app.database import supabase
from app.auth import verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserLoginResponse)
def login(credentials: UserLoginRequest):
    """Login endpoint - Principal, Senior, or Junior"""
    try:
        # Search for user
        response = supabase.table("users") \
            .select("*") \
            .eq("username", credentials.username) \
            .execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

        user = response.data[0]

        # Check if user is active
        if not user.get("is_active", False):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your account is disabled"
            )

        # Verify password
        if not verify_password(credentials.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

        # Create JWT token
        token_data = {
            "username": user["username"],
            "role": user["role"],
            "department": user.get("department", ""),
        }

        access_token = create_access_token(token_data)

        return UserLoginResponse(
            access_token=access_token,
            token_type="bearer",
            username=user["username"],
            role=user["role"],
            department=user.get("department"),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login error: {str(e)}"
        )