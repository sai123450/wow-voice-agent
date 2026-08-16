import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("API Key is missing in .env file.")
else:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-3.5-flash-lite')
    try:
        response = model.generate_content("Hello, reply with just 'working'.")
        print(f"API KEY IS WORKING! Response: {response.text.strip()}")
    except Exception as e:
        print(f"API KEY IS BLOCKED / ERROR: {e}")
