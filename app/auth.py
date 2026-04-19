from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from app.config import JWT_SECRET
from app.database import supabase

# Password hashing setup (passlib use kar rahe hain)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ============================================
# 1️⃣  PASSWORD HASHING FUNCTIONS
# ============================================

def hash_password(password: str) -> str:
    """
    Password ko encrypt karo (plain text -> hashed)
    
    Example:
    Input: "MyPassword123"
    Output: "$2b$12$AKxK8L9JK2kJ...encrypted..."
    """
    return pwd_context.hash(password)



def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check  plain password and  hashed password match 
    
    Example:
    User enters: "MyPassword123"
    Database has: "$2b$12$AKxK8L9JK2kJ..."
    Match? YES ✅
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False
    
# ============================================
# 2️⃣  JWT TOKEN FUNCTIONS
# ============================================

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    JWT token banao (login ke baad)
    
    Token mein ye hota hai:
    - username
    - role
    - expiry time
    
    Example token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFsaV9raGFuIiwicm9sZSI6InRlYWNoZXIiLCJleHAiOjE2MzM1MzQ1MDB9.xyz"
    """
    to_encode = data.copy()
    
    # Token expiry time (24 hours by default)
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    
    to_encode.update({"exp": expire})
    
    # Token JWT_SECRET 
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")
    return encoded_jwt


def verify_token(token: str) -> dict:
    """
    JWT token verify karo aur payload extract karo
    
    Token valid hai? → Username aur role return karo
    Token invalid/expired? → Exception throw karo
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username: str = payload.get("username")
        role: str = payload.get("role")
        
        if username is None or role is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        return {"username": username, "role": role}
    
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid"
        )


# ============================================
# 3️⃣  DEPENDENCY - Get current user data

async def get_current_user(token: str) -> dict:
    """
    Ye function har protected endpoint mein use hoga
    
    Request headers mein Authorization check karega
    Example: Authorization: "Bearer eyJhbGc..."
    
    Valid? → Username aur role return karo
    Invalid? → Error throw karo
    """
    from fastapi import Header
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token not provided"
        )
    
    # "Bearer <token>" se token extract karo
    try:
        scheme, credentials = token.split()
        if scheme.lower() != "bearer":
            raise ValueError()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header"
        )
    
    # Token verify karo
    current_user = verify_token(credentials)
    return current_user