const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // For Node < 18; for Node 18+ fetch is built in

// Load precomputed embeddings from embeddings.json
let vectorStore = [];
try {
  vectorStore = JSON.parse(fs.readFileSync(path.join(__dirname, '../../embeddings.json'), 'utf8'));
} catch (error) {
  console.error('Error loading vector store:', error);
}

// Import TensorFlow.js and Universal Sentence Encoder
const use = require('@tensorflow-models/universal-sentence-encoder');
const tf = require('@tensorflow/tfjs-node');

// Load the Universal Sentence Encoder model once (cache it across function invocations)
let useModelPromise = use.load();

// Cosine similarity function
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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

    // Load the USE model (if not already loaded)
    const model = await useModelPromise;

    // Compute the embedding for the user query
    const queryEmbeddingTensor = await model.embed(userQuery);
    const queryEmbeddingArray = queryEmbeddingTensor.arraySync()[0];

    // For each chunk, compute cosine similarity with the query
    let similarities = vectorStore.map(chunk => {
      let sim = cosineSimilarity(queryEmbeddingArray, chunk.embedding);
      return { text: chunk.text, similarity: sim };
    });

    // Sort by similarity (descending) and select top 3 chunks
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topChunks = similarities.slice(0, 3).map(item => item.text).join("\n\n");

    // Build the system prompt from the top relevant chunks
    const systemPrompt = `Below is some relevant information about Virtual AI Officer:\n\n${topChunks}\n\nBased solely on the above information, answer the following question concisely.`;

    // Build the payload for Anthropic's Messages API
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

