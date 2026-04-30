from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import os

from app.knowledge_base import MYERS_KNOWLEDGE_BASE
from app.database import supabase

router = APIRouter(prefix="/api/chat", tags=["Chat"])


# --- Request & Response ---

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list] = []

class ChatResponse(BaseModel):
    reply: str
    success: bool = True


# --- Helper: get live events from Supabase ---

def get_live_events():
    """Fetch upcoming events so the chatbot can mention them."""
    try:
        result = supabase.table("events") \
            .select("title, description, event_date") \
            .eq("is_active", True) \
            .order("id", desc=True) \
            .limit(5) \
            .execute()

        if not result.data:
            return "\n\nUPCOMING EVENTS: No upcoming events right now.\n"

        text = "\n\nUPCOMING EVENTS (LIVE):\n"
        for i, ev in enumerate(result.data, 1):
            text += f"{i}. {ev.get('title', 'Untitled')}"
            if ev.get('event_date'):
                text += f" — {ev['event_date']}"
            if ev.get('description'):
                text += f" — {ev['description'][:100]}"
            text += "\n"
        return text

    except Exception:
        return "\n\nUPCOMING EVENTS: Could not fetch events.\n"


# --- Main Chat Endpoint ---

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Receives a user message, adds college knowledge + live events,
    sends to LLM and returns AI response.
    """

    # 1. Validate
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 1000:
        raise HTTPException(status_code=400, detail="Message too long (max 1000 chars)")

    # 2. Check API key
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Chat service not configured")

    # 3. Build system prompt = knowledge base + live events
    system_prompt = MYERS_KNOWLEDGE_BASE + get_live_events()

    # 4. Build messages list
    messages = [{"role": "system", "content": system_prompt}]

    # Add last 6 messages from conversation history (for context)
    if request.conversation_history:
        for msg in request.conversation_history[-6:]:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role in ["user", "assistant"] and content:
                messages.append({"role": role, "content": content[:500]})

    # Add current message
    messages.append({"role": "user", "content": message})

    # 5. Call OpenRouter API
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://myers.edu.pk",
                    "X-Title": "Myers College Chatbot",
                },
                json={
                    "model": "anthropic/claude-3.5-haiku",
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.7,
                },
            )

        # Check if API call was successful
        if response.status_code != 200:
            print("=== OPENROUTER ERROR ===")
            print("Status:", response.status_code)
            print("Response:", response.text)
            print("========================")
            return ChatResponse(
                reply="I'm temporarily unavailable. Please try again or call +92-543-541610.",
                success=False,
            )

        # Extract the reply
        data = response.json()
        reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        if not reply:
            reply = "Sorry, I couldn't generate a response. Please try again or contact us at +92-543-541610."

        return ChatResponse(reply=reply, success=True)

    except httpx.TimeoutException:
        return ChatResponse(
            reply="I'm taking too long to respond. Please try again or call +92-543-541610.",
            success=False,
        )
    except Exception:
        return ChatResponse(
            reply="Something went wrong. Please try again or contact us at +92-543-541610.",
            success=False,
        )
