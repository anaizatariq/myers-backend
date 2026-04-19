import os
from dotenv import load_dotenv

# .env 
load_dotenv()

# Supabase Credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# JWT Secret 
JWT_SECRET = os.getenv("JWT_SECRET", "default-secret-key-change-this")

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Validation 
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("⚠️  SUPABASE_URL aur SUPABASE_KEY .env mein set karo!")