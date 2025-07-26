import { obtenerEmbedding } from './embeddings.js';
import { calcularSimilaridadCoseno } from './similaridad.js';
import ChunksIAModel from '../Models/MD_TB_ChunksIA.js';

export const buscarChunksRelevantes = async (pregunta, maxResultados = 200) => {
  const embeddingPregunta = await obtenerEmbedding(pregunta);

  const chunks = await ChunksIAModel.findAll();

  const chunksConScore = chunks.map((chunk) => {
    const embeddingChunk = Array.isArray(chunk.embedding)
      ? chunk.embedding
      : JSON.parse(chunk.embedding);

    const score = calcularSimilaridadCoseno(embeddingPregunta, embeddingChunk);
    return { ...chunk.dataValues, score };
  });

  const chunksOrdenados = chunksConScore
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResultados);

  return chunksOrdenados;
};
