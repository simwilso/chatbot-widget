const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // For Node < 18; for Node 18+ fetch is built in

// Load precomputed knowledge base chunks (via RAG)
let knowledgeBase = '';
try {
  knowledgeBase = fs.readFileSync(path.join(__dirname, '../../knowledgebase.md'), 'utf8');
} catch (error) {
  console.error('Error loading knowledge base:', error);
}

// Split the knowledge base into chunks (using double newlines as delimiters)
const chunks = knowledgeBase.split(/\n\s*\n/).filter(chunk => chunk.trim() !== '');

// Simple tokenization: lower case and split by word boundaries.
function tokenize(text) {
  return text.toLowerCase().match(/\w+/g) || [];
}

// Build a frequency vector for tokens
function vectorize(tokens) {
  const freq = {};
  tokens.forEach(token => {
    freq[token] = (freq[token] || 0) + 1;
  });
  return freq;
}

// Compute cosine similarity between two frequency vectors.
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;

  for (const key in vecA) {
    if (vecB[key]) {
      dot += vecA[key] * vecB[key];
    }
    normA += vecA[key] * vecA[key];
  }

  for (const key in vecB) {
    normB += vecB[key] * vecB[key];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Precompute frequency vectors for each chunk
const chunkVectors = chunks.map(chunk => vectorize(tokenize(chunk)));

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version'
      },
      body: ''
    };
  }

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

    // Compute the query vector
    const queryVector = vectorize(tokenize(userQuery));

    // Compute cosine similarity for each chunk
    let similarities = chunks.map((chunk, idx) => {
      return {
        chunk,
        sim: cosineSimilarity(queryVector, chunkVectors[idx])
      };
    });

    similarities.sort((a, b) => b.sim - a.sim);

    // Select top 5 chunks instead of only top 2, and allow more context per chunk
    const topChunks = similarities.slice(0, 5)
      .map(item => item.chunk.substring(0, 700) + (item.chunk.length > 700 ? '...' : ''))
      .join('\n\n---\n\n');

    // Build the system prompt using the top relevant chunks
    const systemPrompt = `
You are ARIA, the AI Co-Founder and operating agent for Virtual AI Officer (VAIO).

Your role is to help visitors understand how AI could apply to their business and how VAIO can help. You are not a generic chatbot and you should not simply repeat the knowledgebase.

ARIA's personality:
- warm, clear, practical and confident
- thoughtful but not overly formal
- human-centred, not hype-driven
- commercially aware
- focused on real business operations, workflows and outcomes

How to respond:
- Give useful insight first, then ask a helpful follow-up question.
- Use the knowledgebase as context, but do not sound like you are quoting it.
- Never say “based on the information available”.
- Never say “based solely on the above information”.
- Never refuse to help just because the user has not provided full context.
- If more context is needed, provide a general answer first, then ask 1–2 targeted questions.
- Keep answers concise, but not robotic.
- Avoid excessive bullets unless they make the answer clearer.
- Avoid generic AI hype.

VAIO positioning:
VAIO helps businesses move beyond AI experimentation and into real operational impact. VAIO acts as an embedded AI function, designing, building and running AI systems that integrate into how teams actually work.

When users ask where AI could help:
- Talk about repetitive work, analysis-heavy tasks, reporting, document review, bottlenecks, inconsistent outputs, knowledge capture, customer communication and decision support.
- Encourage starting with one workflow that is frequent, painful, and reviewable by a human.

When users ask about working with VAIO:
- Explain discovery, prioritisation, build, embed and support.
- Mention that VAIO works as a fractional AI capability inside the business.

Relevant VAIO knowledgebase context:

${topChunks}
`;

    const payload = {
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      temperature: 0.6,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userQuery
        }
      ]
    };

    console.log('Payload:', JSON.stringify(payload));

    // Call Anthropic's Messages API endpoint
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('Raw API response:', responseText);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: responseText })
      };
    }

    const data = JSON.parse(responseText);

    let completion = '';
    if (data.content && Array.isArray(data.content)) {
      completion = data.content.map(item => item.text).join(' ');
    }

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
