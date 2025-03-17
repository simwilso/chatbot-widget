const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // For Node < 18; for Node 18+ fetch is built in

// -------------------------
// Helper Functions
// -------------------------

// Simple tokenization: convert to lowercase and split by word boundaries.
function tokenize(text) {
  return text.toLowerCase().match(/\w+/g) || [];
}

// Build a frequency dictionary from an array of tokens.
function vectorize(tokens) {
  const freq = {};
  tokens.forEach(token => {
    freq[token] = (freq[token] || 0) + 1;
  });
  return freq;
}

// Compute dot product of two frequency dictionaries.
function dotProduct(vecA, vecB) {
  let dot = 0;
  for (const key in vecA) {
    if (vecB[key]) {
      dot += vecA[key] * vecB[key];
    }
  }
  return dot;
}

// Compute Euclidean norm of a vector.
function norm(vec) {
  let sumSq = 0;
  for (const key in vec) {
    sumSq += vec[key] * vec[key];
  }
  return Math.sqrt(sumSq);
}

// Compute cosine similarity between two vectors.
function cosineSimilarity(vecA, vecB) {
  const dot = dotProduct(vecA, vecB);
  const normA = norm(vecA);
  const normB = norm(vecB);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

// -------------------------
// Load & Preprocess Knowledge Base
// -------------------------

let knowledgeBase = '';
try {
  knowledgeBase = fs.readFileSync(path.join(__dirname, '../../knowledgebase.md'), 'utf8');
} catch (error) {
  console.error('Error loading knowledge base:', error);
}

// Split the knowledge base into chunks (using double newline as delimiter)
const chunks = knowledgeBase.split(/\n\s*\n/).filter(chunk => chunk.trim() !== '');

// Compute a frequency vector for each chunk once (at cold start)
const chunkVectors = chunks.map(chunk => {
  const tokens = tokenize(chunk);
  return vectorize(tokens);
});

// -------------------------
// Netlify Function Handler
// -------------------------

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
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
    
    // Tokenize and vectorize the user query
    const queryTokens = tokenize(userQuery);
    const queryVector = vectorize(queryTokens);
    
    // Compute cosine similarity for each chunk
    const similarities = chunks.map((chunk, index) => {
      const sim = cosineSimilarity(queryVector, chunkVectors[index]);
      return { chunk, sim };
    });
    
    // Sort chunks by similarity (highest first) and select top 3
    similarities.sort((a, b) => b.sim - a.sim);
    const topChunks = similarities.slice(0, 3).map(item => item.chunk).join("\n\n");
    
    // Build the system prompt using only the top relevant chunks
    const systemPrompt = `Below is some relevant information about Virtual AI Officer:\n\n${topChunks}\n\nBased solely on the above information, answer the following question concisely.`;
    
    // Build payload for Anthropic's Messages API
    const payload = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
         {
           role: "user",
           content: userQuery
         }
      ]
    };
    
    console.log("Payload:", JSON.stringify(payload));
    
    // Call Anthropic's Messages API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
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

