// /Utils/embeddings.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

export const obtenerEmbedding = async (texto) => {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: texto,
      model: 'text-embedding-ada-002'
    })
  });

  const data = await res.json();

  if (data.error) {
    console.error('❌ Error en OpenAI:', data.error);
    throw new Error(data.error.message);
  }

  return data.data[0].embedding;
};
