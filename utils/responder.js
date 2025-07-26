import fetch from 'node-fetch';

export const responderConOpenAI = async (prompt) => {
  const apiKey = process.env.OPENAI_API_KEY;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Sos un asistente inteligente y preciso.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    })
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || 'No se obtuvo respuesta.';
};

export const validarPreguntaRelacionada = async (pregunta) => {
  const prompt = `
Quiero que actúes como un filtro temático para un sistema de gimnasios.

Este sistema tiene dos funciones:
1. Contestar procedimientos como un profesor (explicaciones claras sobre ejercicios, rutinas, etc.).
2. Contestar información como un vendedor, enfocándose en beneficios, ventajas y público objetivo, útil para explicar servicios como Pilates a potenciales clientes.

A continuación te daré una pregunta.

Respondé únicamente con "sí" si la pregunta está relacionada al mundo del gimnasio, entrenamiento físico, musculación, rutinas, fitness o si puede ser útil para vender servicios relacionados al bienestar físico. 
Respondé con "no" en cualquier otro caso.

Pregunta: ${pregunta}
  `;

  const respuesta = await responderConOpenAI(prompt);
  return respuesta.toLowerCase().includes('sí');
};

export const normalizarTexto = (texto) => {
  return texto
    .toLowerCase()
    .normalize('NFD') // elimina acentos
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '') // elimina signos de puntuación
    .trim();
};
