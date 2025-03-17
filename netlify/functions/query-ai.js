const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // For Node < 18; for Node 18+ fetch is built in

// Load precomputed knowledge base chunks (via RAG)
// Read the full knowledge base
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

// Cosine similarity between two frequency vectors.
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

// Precompute frequency vectors for each chunk (RAG setup)
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
    
    // Compute cosine similarity for each chunk and select top 2 chunks
    let similarities = chunks.map((chunk, idx) => {
      return { chunk, sim: cosineSimilarity(queryVector, chunkVectors[idx]) };
    });
    similarities.sort((a, b) => b.sim - a.sim);
    const topChunks = similarities.slice(0, 2).map(item => item.chunk.substring(0, 300) + (item.chunk.length > 300 ? "..." : "")).join("\n\n");
    
    // For troubleshooting, you can toggle between the RAG prompt and a simple prompt:
    const useRAG = true; // Set false for testing with a simple prompt
    const systemPrompt = useRAG
      ? `Below is some relevant information about Virtual AI Officer:\n\n${topChunks}\n\nBased solely on the above information, answer the following question concisely.`
      : "Virtual AI Officer (VAIO) is an AI-driven business providing AI strategy consulting, automation tools, education, and AI-driven solutions. Answer the following question concisely.";
    
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
    
    const responseText = await response.text();
    console.log("Raw API response:", responseText);
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: responseText })
      };
    }
    
    const data = JSON.parse(responseText);
    console.log("Parsed API response:", JSON.stringify(data));
    
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

