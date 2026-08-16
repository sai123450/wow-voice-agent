from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime

class Stage(str, Enum):
    START = "START"
    INTRO = "INTRO"
    PERMISSION = "PERMISSION"
    INTENT = "INTENT"
    LOCATION = "LOCATION"
    BUDGET = "BUDGET"
    TIMELINE = "TIMELINE"
    PITCH = "PITCH"
    CTA = "CTA"
    RESULT = "RESULT"
    END = "END"

class ExtractedInfo(BaseModel):
    intent: Optional[str] = Field(None, description="self-use, investment, or both")
    location_fit: Optional[bool] = Field(None, description="True if comfortable with Nandi Hills/Devanahalli corridor")
    budget_fit: Optional[bool] = Field(None, description="True if budget is >= 92.4 lakh")
    timeline_fit: Optional[bool] = Field(None, description="True if OK with Dec 2029 possession")

class LLMResponse(BaseModel):
    reply: str
    extracted: ExtractedInfo
    next_stage: Stage

class MessageHistory(BaseModel):
    role: str
    content: str

class SessionState(BaseModel):
    session_id: str
    stage: Stage = Stage.START
    history: List[MessageHistory] = []
    extracted: ExtractedInfo = ExtractedInfo()
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class ConversationStartResponse(BaseModel):
    session_id: str
    message: str

class MessageRequest(BaseModel):
    session_id: str
    message: str

class MessageResponse(BaseModel):
    reply: str
    stage: Stage

class QualificationResult(BaseModel):
    qualified: bool
    status: str = "PENDING"
    reason: str
