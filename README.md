# chatbot-widget

ARIA, the chat assistant on www.virtualaiofficer.com.au.

The website sends each question to the Netlify function at
`/.netlify/functions/query-ai`. The function adds ARIA's instructions and the
knowledge base, calls Claude, and returns the reply as plain text.

## How to update ARIA

There are two things you can change:

- **What ARIA knows** (prices, packages, contact details, facts about VAIO):
  edit `knowledgebase.md`. The whole file is sent with every question.
- **How ARIA talks** (tone, length, rules, what to lead with): edit the
  `SYSTEM_PROMPT` text near the top of `netlify/functions/query-ai.js`.

Then commit and push:

    git add knowledgebase.md netlify/functions/query-ai.js
    git commit -m "Update ARIA"
    git push origin main

Netlify picks up the push, rebuilds and redeploys the function. Check the
deploy in the Netlify dashboard, then ask ARIA a question on the website.

## Notes

- The Claude API key is the `ANTHROPIC_API_KEY` environment variable in Netlify.
- The website can send earlier turns of the chat as `history` so ARIA can
  follow a conversation. It is optional.
- `embeddings.json`, `precompute_embeddings.py` and `requirements.txt` are left
  over from an earlier version and are no longer used. There is no need to
  recompute embeddings.
