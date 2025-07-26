// Importa modelo y embedding
import ChunkIAModel from '../Models/MD_TB_ChunksIA.js';

import { obtenerEmbedding } from '../utils/embeddings.js';

// --------------------
// CREAR CHUNK EMBEBIDO
// --------------------
export const CR_ChunkIA_CTS = async (req, res) => {
  try {
    const { titulo, texto } = req.body;

    // Validación de entrada
    if (!titulo || !texto || texto.trim().length < 20) {
      return res.status(400).json({
        mensajeError:
          'Título o texto inválido. El texto debe tener al menos 20 caracteres.'
      });
    }

    // Obtener embedding
    const embedding = await obtenerEmbedding(texto);

    // Validar embedding
    if (!Array.isArray(embedding) || embedding.length < 10) {
      return res.status(400).json({
        mensajeError:
          'Embedding inválido o demasiado corto. No se puede guardar.'
      });
    }

    // Crear el chunk
    await ChunkIAModel.create({
      titulo,
      texto,
      embedding
    });

    res.json({ message: '✅ Chunk registrado correctamente' });
  } catch (error) {
    console.error('❌ Error creando chunk IA:', error);
    res.status(500).json({
      mensajeError: 'Error al guardar el chunk IA',
      detalle: error.message
    });
  }
};

// ----------------------------------
// OBTENER CHUNKS MÁS SIMILARES A UNA CONSULTA
// ----------------------------------
export const OBRS_ChunksIA_Similares_CTS = async (req, res) => {
  try {
    const { consulta } = req.query;

    if (!consulta || consulta.length < 5) {
      return res.status(400).json({ mensajeError: 'Consulta inválida.' });
    }

    const embeddingConsulta = await obtenerEmbedding(consulta);

    const chunks = await ChunkIAModel.findAll();

    const calcularSimilitudCoseno = (a, b) => {
      const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
      const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
      return dotProduct / (normA * normB);
    };

    const resultados = chunks.map((chunk) => {
      const similitud = calcularSimilitudCoseno(
        embeddingConsulta,
        chunk.embedding
      );
      return {
        id: chunk.id,
        titulo: chunk.titulo,
        texto: chunk.texto,
        similitud
      };
    });

    const topChunks = resultados
      .sort((a, b) => b.similitud - a.similitud)
      .slice(0, 3); // ← ajustable

    res.json(topChunks);
  } catch (error) {
    console.error('Error comparando embeddings:', error);
    res.status(500).json({ mensajeError: 'Error al comparar embeddings' });
  }
};

export const crearChunkSiNoExiste = async (req, res) => {
  try {
    const { titulo, texto } = req.body;

    if (!texto || texto.length < 30) {
      return res
        .status(400)
        .json({
          mensajeError:
            'Texto demasiado corto. el chunk debe tener mas de 30 caracteres para ser valido'
        });
    }

    const yaExiste = await ChunkIAModel.findOne({ where: { texto } });
    if (yaExiste) {
      return res.status(200).json({ mensaje: 'Ya existía el chunk.' });
    }

    const embedding = await obtenerEmbedding(texto);
    await ChunkIAModel.create({ titulo, texto, embedding });

    res.status(200).json({ mensaje: '✅ Chunk creado automáticamente.' });
  } catch (error) {
    console.error('❌ Error creando chunk:', error);
    res.status(500).json({ mensajeError: 'Error interno al crear chunk.' });
  }
};


export const OBRT_ChunksIA_CTS = async (req, res) => {
  try {
    const chunks = await ChunkIAModel.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(chunks);
  } catch (error) {
    console.error('❌ Error al obtener chunks:', error);
    res.status(500).json({ mensajeError: 'Error al listar los chunks.' });
  }
};

export const OBRS_ChunkIA_PorID_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const chunk = await ChunkIAModel.findByPk(id);

    if (!chunk) {
      return res.status(404).json({ mensajeError: 'Chunk no encontrado.' });
    }

    res.json(chunk);
  } catch (error) {
    console.error('❌ Error al obtener chunk por ID:', error);
    res.status(500).json({ mensajeError: 'Error al buscar el chunk.' });
  }
};

export const UPD_ChunkIA_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, texto } = req.body;

    const chunk = await ChunkIAModel.findByPk(id);
    if (!chunk) {
      return res.status(404).json({ mensajeError: 'Chunk no encontrado.' });
    }

    const embedding = await obtenerEmbedding(texto);
    await chunk.update({ titulo, texto, embedding });

    res.json({ mensaje: '✅ Chunk actualizado correctamente.' });
  } catch (error) {
    console.error('❌ Error actualizando chunk:', error);
    res.status(500).json({ mensajeError: 'Error al actualizar el chunk.' });
  }
};

export const DEL_ChunkIA_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const chunk = await ChunkIAModel.findByPk(id);

    if (!chunk) {
      return res.status(404).json({ mensajeError: 'Chunk no encontrado.' });
    }

    await chunk.destroy();
    res.json({ mensaje: '✅ Chunk eliminado correctamente.' });
  } catch (error) {
    console.error('❌ Error eliminando chunk:', error);
    res.status(500).json({ mensajeError: 'Error al eliminar el chunk.' });
  }
};
