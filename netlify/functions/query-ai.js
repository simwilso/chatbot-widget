const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // For Node < 18; for Node 18+ fetch is built in

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
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: "Missing 'user_query'" })
      };
    }

    // Build messages for the Anthropic Messages API
    const messages = [
      {
        role: "system",
        content: `Below is some information about Virtual AI Officer:\n\n${knowledgeBase}\n\nBased solely on the above information, answer the following question concisely.`
      },
      {
        role: "user",
        content: userQuery
      }
    ];

    // Call Anthropic's Messages API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 1024,
        temperature: 0.3,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: errorText })
      };
    }

    const data = await response.json();
    const completion = data.completion || '';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ aiReply: completion })
    };

  } catch (err) {
    console.error('Error in function:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.toString() })
    };
  }
};