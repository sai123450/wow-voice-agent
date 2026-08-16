import os
import json
from abc import ABC, abstractmethod
import google.generativeai as genai
from models import LLMResponse, ExtractedInfo, Stage
from prompts import SYSTEM_PROMPT

class LLMProvider(ABC):
    @abstractmethod
    async def generate_response(self, history: list, current_extracted: ExtractedInfo) -> LLMResponse:
        pass

class GeminiProvider(LLMProvider):
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        genai.configure(api_key=api_key)
        # Using Gemini 2.5 Flash as it is fast and supports system_instruction
        self.model = genai.GenerativeModel('gemini-3.5-flash-lite', system_instruction=SYSTEM_PROMPT)

    async def generate_response(self, history: list, current_extracted: ExtractedInfo) -> LLMResponse:
        chat_history = []
        for msg in history[:-1]:  # all except the last one
            role = "user" if msg.role == "user" else "model"
            chat_history.append({"role": role, "parts": [msg.content]})
            
        chat = self.model.start_chat(history=chat_history)
        
        last_msg = history[-1].content if history else "Start the conversation."
        
        prompt = (
            f"User message: {last_msg}\n\n"
            f"Current extracted information: {current_extracted.model_dump_json()}\n"
            "Remember: DO NOT ask for information that is already extracted and present above.\n"
            "Provide your response adhering strictly to the JSON schema."
        )
        
        max_retries = 3
        base_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                response = chat.send_message(
                    content=prompt,
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                    )
                )
                
                res_dict = json.loads(response.text)
                extracted_dict = res_dict.get("extracted", {})
                
                # Map dict back to ExtractedInfo, keeping existing valid info if LLM returns null
                intent = extracted_dict.get("intent")
                location_fit = extracted_dict.get("location_fit")
                budget_fit = extracted_dict.get("budget_fit")
                timeline_fit = extracted_dict.get("timeline_fit")
                
                extracted = ExtractedInfo(
                    intent=intent if intent is not None else current_extracted.intent,
                    location_fit=location_fit if location_fit is not None else current_extracted.location_fit,
                    budget_fit=budget_fit if budget_fit is not None else current_extracted.budget_fit,
                    timeline_fit=timeline_fit if timeline_fit is not None else current_extracted.timeline_fit
                )
                
                next_stage_str = res_dict.get("next_stage", "END")
                try:
                    next_stage = Stage(next_stage_str)
                except ValueError:
                    next_stage = Stage.END
                    
                return LLMResponse(
                    reply=res_dict.get("reply", "I'm sorry, I didn't quite catch that. Could you please repeat?"),
                    extracted=extracted,
                    next_stage=next_stage
                )
            except Exception as e:
                error_msg = str(e).lower()
                if "api_key" in error_msg or "invalid argument" in error_msg or "authentication" in error_msg or "unauthorized" in error_msg:
                    print(f"Fatal LLM error (no retry): {e}")
                    break
                    
                if attempt < max_retries - 1:
                    import asyncio
                    print(f"Transient error, retrying in {base_delay}s... ({e})")
                    await asyncio.sleep(base_delay)
                    base_delay *= 2
                else:
                    print(f"Error parsing LLM response after {max_retries} attempts: {e}")
                    
        return LLMResponse(
            reply="I'm having a little trouble right now. Could we pause for a moment?",
            extracted=current_extracted,
            next_stage=Stage.END
        )

class GroqProvider(LLMProvider):
    # To be implemented if Groq is preferred later.
    async def generate_response(self, history: list, current_extracted: ExtractedInfo) -> LLMResponse:
        raise NotImplementedError("Groq provider is not implemented yet.")

def get_llm_provider() -> LLMProvider:
    return GeminiProvider()
