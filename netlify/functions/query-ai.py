import os
import json
from smolagent import Agent
from smolagent.llm import OllamaLLM

def load_knowledge_base():
    # Adjust the path to find knowledgebase.md (located at repo root)
    kb_path = os.path.join(os.path.dirname(__file__), '../../knowledgebase.md')
    with open(kb_path, 'r', encoding='utf-8') as f:
        return f.read()

# Load the knowledge base once when the function instance starts.
knowledge_base = load_knowledge_base()

# Retrieve configuration from environment variables (set these in Netlify later)
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "your-ollama-model")
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "your-api-key")

# Initialize the LLM and the agent
llm = OllamaLLM(model=OLLAMA_MODEL, api_key=OLLAMA_API_KEY)
agent = Agent(llm=llm, knowledge_base=knowledge_base)

def handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        user_query = body.get("user_query", "")
        if not user_query:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing 'user_query'"})
            }
        
        # Ask the agent your query
        answer = agent.ask(user_query)
        return {
            "statusCode": 200,
            "body": json.dumps({"aiReply": answer})
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
