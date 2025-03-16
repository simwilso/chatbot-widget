import os
import json
import requests

def load_knowledge_base():
    kb_path = os.path.join(os.path.dirname(__file__), '../../knowledgebase.md')
    with open(kb_path, 'r', encoding='utf-8') as f:
        return f.read()

# Load the knowledge base once.
knowledge_base = load_knowledge_base()

# Retrieve your Anthropic API key from environment variables.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise Exception("Missing ANTHROPIC_API_KEY environment variable.")

def handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        user_query = body.get("user_query", "").strip()
        if not user_query:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing 'user_query'"})
            }

        # Create a prompt that includes your knowledge base as context.
        # Adjust the prompt formatting as needed.
        prompt = (
            "Below is some information about Virtual AI Officer:\n\n"
            f"{knowledge_base}\n\n"
            "Based solely on the above information, answer the following question concisely:\n\n"
            f"Human: {user_query}\n\nAssistant:"
        )

        headers = {
            "Content-Type": "application/json",
            "Anthropic-API-Key": ANTHROPIC_API_KEY,
        }

        data = {
            "prompt": prompt,
            "model": "claude-v1",  # You can adjust this to another Claude model if available.
            "max_tokens_to_sample": 300,
            "temperature": 0.3,  # Lower temperature helps keep responses focused.
        }

        # Call Anthropic's Claude API endpoint.
        response = requests.post("https://api.anthropic.com/v1/complete", headers=headers, json=data)
        if response.status_code != 200:
            return {
                "statusCode": response.status_code,
                "body": json.dumps({"error": f"Anthropic API error: {response.text}"})
            }

        result = response.json()
        # Anthropic's API returns the completion in the 'completion' field.
        completion = result.get("completion", "").strip()

        return {
            "statusCode": 200,
            "body": json.dumps({"aiReply": completion})
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
