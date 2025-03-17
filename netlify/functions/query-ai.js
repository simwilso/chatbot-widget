const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // If using Node < 18; for Node 18+, fetch is built-in

// Load the knowledge base from your repository root
let knowledgeBase = '';
try {
  knowledgeBase = fs.readFileSync(path.join(__dirname, '../../knowledgebase.md'), 'utf8');
} catch (error) {
  console.error('Error loading knowledge base:', error);
}

exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const userQuery = body.user_query?.trim() || '';
    if (!userQuery) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'user_query'" })
      };
    }

    // Build the prompt using your knowledge base content
    const prompt = `Below is some information about Virtual AI Officer:\n\n${knowledgeBase}\n\nBased solely on the above information, answer the following question concisely:\n\nHuman: ${userQuery}\n\nAssistant:`;

    // Prepare the request for Anthropic's Claude API (or another inference provider)
    const response = await fetch('https://api.anthropic.com/v1/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Anthropic-API-Key': process.env.ANTHROPIC_API_KEY
      },
      body: JSON.stringify({
        prompt: prompt,
        model: "claude-v1",             // Adjust model if needed
        max_tokens_to_sample: 300,       // Adjust token limit as required
        temperature: 0.3                 // Lower temperature for more deterministic responses
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: errorText })
      };
    }

    const data = await response.json();
    const completion = data.completion || '';

    return {
      statusCode: 200,
      body: JSON.stringify({ aiReply: completion })
    };

  } catch (err) {
    console.error('Error in function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.toString() })
    };
  }
};