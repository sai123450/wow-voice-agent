import asyncio
from dotenv import load_dotenv
load_dotenv()
from llm import get_llm_provider
from models import MessageHistory, ExtractedInfo

async def test():
    llm = get_llm_provider()
    history = [MessageHistory(role='user', content='Start the conversation by saying exactly: "Hello, I’m a consultant from Divyasree Developers calling regarding our premium villa plot project, Whispers of the Wind, in Nandi Valley. Is this a good time for a quick conversation?"')]
    extracted = ExtractedInfo(intent=None, location_fit=None, budget_fit=None, timeline_fit=None)
    try:
        res = await llm.generate_response(history, extracted)
        print('RESULT:', res)
    except Exception as e:
        print('ERROR:', e)

asyncio.run(test())
