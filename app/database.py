from supabase import create_client
from app.config import SUPABASE_URL, SUPABASE_KEY

# initializing supabase client 
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print(" Supabase connected successfully!")