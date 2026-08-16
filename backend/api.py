from fastapi import APIRouter, HTTPException, Depends
from models import (
    ConversationStartResponse, MessageRequest, MessageResponse, 
    SessionState, MessageHistory, Stage, QualificationResult
)
from llm import get_llm_provider, LLMProvider
from engine import evaluate_qualification
import uuid
from typing import Dict

router = APIRouter()

# In-memory session store
sessions: Dict[str, SessionState] = {}

@router.post("/conversation/start", response_model=ConversationStartResponse)
async def start_conversation(llm: LLMProvider = Depends(get_llm_provider)):
    session_id = str(uuid.uuid4())
    session = SessionState(session_id=session_id)
    
    # Inject a system-level user message to prompt the LLM for a dynamic greeting using the specific script
    start_prompt = 'Start the conversation by saying exactly: "Hello, I’m a consultant from Divyasree Developers calling regarding our premium villa plot project, Whispers of the Wind, in Nandi Valley. Is this a good time for a quick conversation?"'
    session.history.append(MessageHistory(role="user", content=start_prompt))
    
    try:
        llm_response = await llm.generate_response(session.history, session.extracted)
    except Exception as e:
        print(f"LLM Error: {e}")
        raise HTTPException(status_code=500, detail="Error generating AI response")
        
    initial_msg = llm_response.reply
    
    session.history.append(MessageHistory(role="model", content=initial_msg))
    session.extracted = llm_response.extracted
    session.stage = llm_response.next_stage
    
    sessions[session_id] = session
    
    return ConversationStartResponse(session_id=session_id, message=initial_msg)

@router.post("/conversation/message", response_model=MessageResponse)
async def handle_message(req: MessageRequest, llm: LLMProvider = Depends(get_llm_provider)):
    session_id = req.session_id
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = sessions[session_id]
    
    # Append user message
    session.history.append(MessageHistory(role="user", content=req.message))
    
    # Get LLM response
    try:
        llm_response = await llm.generate_response(session.history, session.extracted)
    except Exception as e:
        print(f"LLM Error: {e}")
        raise HTTPException(status_code=500, detail="Error generating AI response")
        
    # Append model reply and update state
    session.history.append(MessageHistory(role="model", content=llm_response.reply))
    session.extracted = llm_response.extracted
    session.stage = llm_response.next_stage
    
    return MessageResponse(reply=llm_response.reply, stage=session.stage)

@router.get("/conversation/{session_id}/qualification", response_model=QualificationResult)
async def get_qualification(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = sessions[session_id]
    return evaluate_qualification(session.extracted)

@router.get("/conversation/{session_id}/debug")
async def get_debug_info(session_id: str):
    # This endpoint powers the Demo Mode UI
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sessions[session_id]
    qual = evaluate_qualification(session.extracted)
    
    return {
        "stage": session.stage,
        "extracted": session.extracted.model_dump(),
        "qualification": qual.model_dump()
    }

@router.post("/conversation/{session_id}/end", response_model=QualificationResult)
async def end_conversation(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = sessions[session_id]
    session.stage = Stage.END
    
    return evaluate_qualification(session.extracted)
