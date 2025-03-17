# precompute_embeddings.py
from sentence_transformers import SentenceTransformer
import json
import re

def split_text(text, chunk_size=300):
    # Split text roughly into chunks of ~300 words
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append(" ".join(words[i:i+chunk_size]))
    return chunks

model = SentenceTransformer('all-MiniLM-L6-v2')

with open('knowledgebase.md', 'r', encoding='utf-8') as f:
    kb = f.read()

chunks = split_text(kb, chunk_size=300)
embeddings = model.encode(chunks).tolist()

vector_store = [{"text": chunk, "embedding": embedding} for chunk, embedding in zip(chunks, embeddings)]

with open("embeddings.json", "w", encoding="utf-8") as f:
    json.dump(vector_store, f, ensure_ascii=False, indent=2)
