/*
  * Programador: Benjamin Orellana
  * Fecha Creación: 06 / 08 / 2025
  * Versión: 1.0
  *
  * Descripción:
    * Este archivo contiene controladores para manejar preguntas realizadas a la IA (OpenAI).
    * Permite consultar, registrar y recuperar respuestas de manera automática.
  
  * Tema: Controladores - Preguntas IA
  
  * Capa: Backend

  * Nomenclatura:
    * OBR_  obtenerRegistro
    * OBRS_ obtenerRegistros (plural)
    * CR_   crearRegistro
    * ER_   eliminarRegistro
*/

import axios from 'axios';
import dotenv from 'dotenv';
import PreguntaIAModel from '../Models/MD_TB_PreguntasIA.js';

import { buscarChunksRelevantes } from '../utils/busquedaChunks.js';
import {
  responderConOpenAI,
  validarPreguntaRelacionada,
  normalizarTexto
} from '../utils/responder.js';
import ChunkIAModel from '../Models/MD_TB_ChunksIA.js';
import { obtenerEmbedding } from '../utils/embeddings.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// ----------------------------------------------------------------
// Obtener todas las preguntas registradas
export const OBRS_PreguntasIA_CTS = async (req, res) => {
  try {
    const preguntas = await PreguntaIAModel.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(preguntas);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// ----------------------------------------------------------------
// Obtener una pregunta por ID
export const OBR_PreguntaIA_CTS = async (req, res) => {
  try {
    const pregunta = await PreguntaIAModel.findByPk(req.params.id);
    res.json(pregunta);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// ----------------------------------------------------------------
// Crear una nueva pregunta o devolver la ya existente
export const CR_PreguntaIA_CTS = async (req, res) => {
  try {
    const {
      pregunta,
      respuesta,
      user_id = null,
      fuente = 'openai',
      contexto
    } = req.body;

    if (!pregunta || pregunta.trim() === '') {
      return res.status(400).json({ mensajeError: 'Pregunta vacía.' });
    }

    const preguntaExistente = await PreguntaIAModel.findOne({
      where: { pregunta: pregunta }
    });

    if (preguntaExistente) {
      return res.json({
        message: 'Ya existe una respuesta para esta pregunta.',
        respuesta: preguntaExistente.respuesta,
        contexto: preguntaExistente.contexto,
        fuente: preguntaExistente.fuente
      });
    }

    // 📌 Si el admin ingresó respuesta manual
    if (respuesta && fuente === 'manual') {
      await PreguntaIAModel.create({
        pregunta,
        respuesta,
        user_id,
        fuente,
        contexto
      });

      return res.json({
        message: 'Pregunta manual registrada correctamente',
        respuesta
      });
    }

    // 📡 Caso general: consultar a la IA
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: pregunta }],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const respuestaIA = response.data.choices[0].message.content;

    await PreguntaIAModel.create({
      pregunta,
      respuesta: respuestaIA,
      user_id,
      fuente: 'openai',
      contexto
    });

    res.json({
      message: 'Respuesta generada por IA',
      respuesta: respuestaIA
    });
  } catch (error) {
    console.error(
      '❌ Error al consultar OpenAI:',
      error.response?.data || error.message
    );

    const esCuota = error.response?.data?.error?.code === 'insufficient_quota';

    res.status(esCuota ? 503 : 500).json({
      mensajeError: esCuota
        ? 'Servicio de IA temporalmente inactivo.'
        : 'Error al consultar la IA',
      detalle: error.response?.data || error.message
    });
  }
};

// ----------------------------------------------------------------
// Eliminar una pregunta por ID
export const ER_PreguntaIA_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    await PreguntaIAModel.destroy({ where: { id } });
    res.json({ message: 'Pregunta eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const preguntarIAConContexto = async (req, res) => {
  try {
    const { pregunta } = req.body;
    const preguntaNormalizada = normalizarTexto(pregunta);

    // 🔍 Buscar si ya fue preguntada (aunque sea manual)
    const preguntasPrevias = await PreguntaIAModel.findAll();
    const preguntaExistente = preguntasPrevias.find(
      (p) => normalizarTexto(p.pregunta) === preguntaNormalizada
    );

    if (preguntaExistente) {
      console.log(
        '✅ Respuesta encontrada (manual o previa):',
        preguntaExistente.pregunta
      );
      return res.json({ respuesta: preguntaExistente.respuesta });
    }

    // ✅ SOLO si no existe en la DB, validamos si es del mundo fitness
    const esValida = await validarPreguntaRelacionada(pregunta);
    if (!esValida) {
      return res.status(400).json({
        mensaje:
          '❌ La pregunta no está relacionada con el mundo del gimnasio o fitness.'
      });
    }

    // 🧠 Buscar chunks relevantes
    const chunks = await buscarChunksRelevantes(pregunta);
    console.log('🧠 Chunks relevantes encontrados:', chunks.length);

    const chunkRelevante = chunks.find((c) => c.score >= 0.8);
    if (chunkRelevante) {
      await PreguntaIAModel.create({
        pregunta: preguntaNormalizada,
        respuesta: chunkRelevante.texto,
        fuente: 'chunk',
        contexto: chunkRelevante.texto
      });

      return res.json({ respuesta: chunkRelevante.texto });
    }

    const contexto = chunks.map((c) => c.texto).join('\n---\n');
    const prompt = `
Quiero que actúes como un asistente especializado en gimnasios.

Tenés dos funciones:
1. Explicar ejercicios, rutinas y procedimientos como un profesor, de forma clara y didáctica.
2. Brindar información útil para vendedores, resaltando beneficios, ventajas, diferencias y público objetivo de actividades como Pilates, Yoga, electrofitness, etc., sin tecnicismos innecesarios.

Respondé la siguiente pregunta usando únicamente la información proporcionada como contexto. Si no hay suficiente contexto, explicá de forma breve pero clara, sin inventar.

Contexto:
${contexto}

Pregunta:
${pregunta}
`;

    const respuesta = await responderConOpenAI(prompt);

    await PreguntaIAModel.create({
      pregunta: preguntaNormalizada,
      respuesta,
      fuente: 'openai',
      contexto
    });

    const yaExiste = await ChunkIAModel.findOne({
      where: { texto: respuesta }
    });
    if (respuesta && respuesta.length > 50 && !yaExiste) {
      await ChunkIAModel.create({
        titulo: pregunta.substring(0, 100),
        texto: respuesta,
        embedding: await obtenerEmbedding(respuesta)
      });
      console.log('✅ Chunk creado automáticamente');
    }

    res.json({ respuesta });
  } catch (error) {
    console.error('❌ Error al responder con contexto:', error);
    res.status(500).json({ mensaje: 'Error al responder la pregunta.' });
  }
};
