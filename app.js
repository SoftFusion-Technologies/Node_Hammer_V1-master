import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
// El Intercambio de Recursos de Origen Cruzado (CORS (en-US))
// es un mecanismo que utiliza cabeceras HTTP adicionales para permitir que un user agent (en-US)
// obtenga permiso para acceder a recursos seleccionados desde un servidor, en un origen distinto (dominio) al que pertenece.

// importamos la conexion de la base de datos
import db from './DataBase/db.js';
import GetRoutes from './Routes/routes.js';
import dotenv from 'dotenv';

import { Op } from 'sequelize';
import NovedadesModel from './Models/MD_TB_Novedades.js';
import cron from 'node-cron';

import multer from 'multer';
import path, { join } from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise'; // Usar mysql2 para las promesas
import { dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { PORT } from './DataBase/config.js';

import { AlumnosModel } from './Models/MD_TB_Alumnos.js';
import { PostulanteV2Model } from './Models/MD_TB_Postulante_v2.js';
import { AsistenciasModel } from './Models/MD_TB_Asistencias.js';
import { AgendasModel } from './Models/MD_TB_Agendas.js';
import NotificationModel from './Models/MD_TB_Notifications.js';
// nueva forma de congelar las  planillas sab 15 de mar
import { Sequelize } from 'sequelize';
import { PlanillasCerradasModel } from './Models/MD_TB_PlanillasCerradas.js';

import moment from 'moment-timezone';

import { login, authenticateToken } from './Security/auth.js'; // Importa las funciones del archivo auth.js

import sharp from 'sharp';
import dayjs from 'dayjs';

// CONFIGURACION PRODUCCION
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// const PORT = process.env.PORT || 3000;

// console.log(process.env.PORT)

const app = express();
app.use(cors()); // aca configuramos cors para no tener errores
app.use(express.json());
app.use('/', GetRoutes);
// definimos la conexion

// Para verificar si nuestra conexión funciona, lo hacemos con el método authenticate()
//  el cual nos devuelve una promesa que funciona de la siguiente manera:
// un try y un catch para captar cualquier tipo de errores
try {
  db.authenticate();
  console.log('Conexion con la db establecida');
} catch (error) {
  console.log(`El error de la conexion es : ${error}`);
}

// Ruta de login
app.post('/login', login);

// Ruta protegida
app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Esto es una ruta protegida' });
});

app.get('/', (req, res) => {
  if (req.url == '/') {
    res.send(
      'si en la URL pone /jobs,/ask,/postulantes... vera los registros en formato JSON'
    ); // este hola mundo se mostrara en el puerto 5000 y en la raiz principal
  } else if (req.url != '/') {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404 ERROR');
  }
});

// Función para obtener el mes y año actual y el anterior
const getMesYAnioActual = () => {
  const now = new Date();
  const mesActual = now.getMonth() + 1; // Los meses en JS son 0-11, así que sumamos 1
  const anioActual = now.getFullYear();

  // Si el mes actual es enero (mes 1), entonces el mes anterior será diciembre (mes 12 del año anterior)
  const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
  const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;

  return { mesActual, anioActual, mesAnterior, anioAnterior };
};

// Ruta para obtener convenio y sus integrantes
app.get('/admconvenios/:id_conv/integrantes', async (req, res) => {
  const { id_conv } = req.params;

  try {
    const results = await db.query(
      'SELECT * FROM integrantes_conve i WHERE i.id_conv = :id_conv',
      {
        replacements: { id_conv },
        type: db.QueryTypes.SELECT
      }
    );

    res.json(results);
  } catch (err) {
    console.log('Error executing query', err);
    res.status(500).json({ error: 'Error ejecutando la consulta' });
  }
});

// Ruta para obtener integrantes y sus familiares
app.get(
  '/admconvenios/:id_conv/integrantes/:id_integrante/integrantesfam',
  async (req, res) => {
    const { id_conv, id_integrante } = req.params;

    try {
      // Validar id_conv e id_integrante
      if (!id_conv || !id_integrante) {
        return res
          .status(400)
          .json({ error: 'id_conv y id_integrante son requeridos' });
      }

      const results = await db.query(
        'SELECT * FROM fam_integrante i WHERE i.id_integrante = :id_integrante',
        {
          replacements: { id_integrante },
          type: db.QueryTypes.SELECT
        }
      );

      res.json(results);
    } catch (err) {
      console.log('Error executing query', err);
      res.status(500).json({ error: 'Error ejecutando la consulta' });
    }
  }
);

// Ruta para obtener alumnos de instructores
app.get('/instructores/:user_id/alumnos', async (req, res) => {
  const { user_id } = req.params;

  try {
    const results = await db.query(
      'SELECT * FROM alumnos i WHERE i.user_id = :user_id',
      {
        replacements: { user_id },
        type: db.QueryTypes.SELECT
      }
    );

    res.json(results);
  } catch (err) {
    console.log('Error executing query', err);
    res.status(500).json({ error: 'Error ejecutando la consulta' });
  }
});

// Función para eliminar novedades vencidas hace más de un mes
async function deleteOldNovedades() {
  try {
    // Calcula la fecha de hace un mes desde hoy
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Elimina los registros con vencimiento anterior o igual a esa fecha
    const result = await NovedadesModel.destroy({
      where: {
        vencimiento: {
          [Op.lte]: oneMonthAgo
        }
      }
    });

    console.log(`${result} novedades eliminadas.`); // Muestra cuántos registros fueron eliminados
  } catch (error) {
    console.error('Error eliminando novedades:', error);
  }
}

deleteOldNovedades();

// Programar la tarea para que se ejecute cada día a medianoche
cron.schedule('0 0 * * *', () => {
  console.log('Cron job iniciado - eliminando novedades vencidas...');
  deleteOldNovedades();
});

const pool = mysql.createPool({
  host: 'localhost', // Configurar según tu base de datos
  user: 'root', // Configurar según tu base de datos
  password: '123456', // Configurar según tu base de datos
  database: 'DB_HammerDESA_c1841398'
});

// const pool = mysql.createPool({
//   host: '149.50.141.175', // Configurar según tu base de datos
//   user: 'c1841398_hammer', // Configurar según tu base de datos
//   password: 'bu21guPOfu', // Configurar según tu base de datos
//   database: 'c1841398_hammer'
// });

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
console.log('Current Directory:', CURRENT_DIR);

// Obtener el directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const multerUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = join(CURRENT_DIR, 'uploads', 'agendas'); // Esto debe ser la carpeta en la raíz del proyecto
      cb(null, uploadPath); // Asegúrate de que esta ruta sea la correcta
    },
    filename: (req, file, cb) => {
      const fileExtension = extname(file.originalname);
      const fileName = file.originalname.split(fileExtension)[0];
      cb(null, `${fileName}-${Date.now()}${fileExtension}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Permitir diferentes tipos de archivos
    const MIMETYPES = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp', // Agregar soporte para capturas WebP
      'image/heic', // Para iPhone
      'image/heif', // También para iPhone
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Para .docx
      'application/vnd.oasis.opendocument.text', // Para .odt
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // Añadido para .xlsx
    ];
    if (MIMETYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Solo se permiten ${MIMETYPES.join(', ')}.`));
  },
  limits: {
    fileSize: 70000000 // Tamaño máximo del archivo antes (30 MB) ahora 60
  }
});

app.post(
  '/upload/:convenio_id',
  multerUpload.single('file'),
  async (req, res) => {
    const { convenio_id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'Archivo no proporcionado' });
    }

    const imagePath = `uploads/agendas/${req.file.filename}`;
    const fecha = req.body.fecha;

    try {
      // Guardar la ruta de la imagen en la base de datos
      await pool.query(
        'INSERT INTO adm_convenio_images (convenio_id, image_path,created_at) VALUES (?, ?, ?)',
        [convenio_id, imagePath, fecha]
      );

      res
        .status(200)
        .json({ message: 'Imagen subida y guardada correctamente.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al guardar la imagen.' });
    }
  }
);

app.get('/download/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT image_path FROM adm_convenio_images WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    console.log('Ruta de la imagen desde la BD:', rows[0].image_path);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    // Construir la ruta completa de la imagen
    const imagePath = join(
      CURRENT_DIR,
      'uploads',
      'agendas',
      rows[0].image_path.split('/').pop()
    );
    console.log('Ruta completa de la imagen:', imagePath);

    // Verifica si el archivo existe
    if (!fs.existsSync(imagePath)) {
      console.log('El archivo no existe en:', imagePath);
      return res
        .status(404)
        .json({ message: 'Archivo no encontrado en el servidor.' });
    }

    // Enviar la imagen al cliente
    res.download(imagePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al descargar la imagen.' });
  }
});

app.get('/images/:convenio_id', async (req, res) => {
  const { convenio_id } = req.params;

  try {
    // Obtener las imágenes relacionadas al convenio
    const [rows] = await pool.query(
      'SELECT image_path FROM adm_convenio_images WHERE convenio_id = ?',
      [convenio_id]
    );

    // Enviar las rutas de las imágenes al frontend
    const images = rows.map((row) => row.image_path.split('/').pop()); // Obtener solo el nombre del archivo
    res.json({ images });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener las imágenes.' });
  }
});

//Para administrar las facturas emitidas por el comercio

app.post(
  '/uploadfac/:convenio_id',
  multerUpload.single('file'),
  async (req, res) => {
    const { convenio_id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'Archivo no proporcionado' });
    }

    const imagePath = `uploads/agendas/${req.file.filename}`;
    const fecha = req.body.fecha;

    try {
      // Guardar la ruta de la imagen en la base de datos
      await pool.query(
        'INSERT INTO adm_convenio_fac (convenio_id, image_path, created_at) VALUES (?, ?, ?)',
        [convenio_id, imagePath, fecha]
      );
      res
        .status(200)
        .json({ message: 'Imagen subida y guardada correctamente.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al guardar la imagen.' });
    }
  }
);

app.get('/downloadfac/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT image_path FROM adm_convenio_fac WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    console.log('Ruta de la imagen desde la BD:', rows[0].image_path);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    // Construir la ruta relativa a la carpeta "uploads"
    const imagePath = join(
      CURRENT_DIR,
      'uploads',
      'agendas',
      rows[0].image_path.split('/').pop()
    );
    console.log('Ruta completa de la imagen:', imagePath);

    // Verifica si el archivo existe
    if (!fs.existsSync(imagePath)) {
      console.log('El archivo no existe en:', imagePath);
      return res
        .status(404)
        .json({ message: 'Archivo no encontrado en el servidor.' });
    }

    // Enviar la imagen al cliente
    res.download(imagePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al descargar la imagen.' });
  }
});

app.get('/imagesfac/:convenio_id', async (req, res) => {
  const { convenio_id } = req.params;

  try {
    // Obtener las imágenes relacionadas al convenio
    const [rows] = await pool.query(
      'SELECT image_path FROM adm_convenio_fac WHERE convenio_id = ?',
      [convenio_id]
    );

    // Enviar las rutas de las imágenes al frontend
    const images = rows.map((row) => row.image_path.split('/').pop()); // Obtener solo el nombre del archivo
    res.json({ images });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener las imágenes.' });
  }
});

// R5-SUBIR ARCHIVOS A NOVEDADES - 16-09-2024 - Benjamin Orellana - INICIO
app.post(
  '/upload/novedad/:novedad_id',
  multerUpload.single('file'),
  async (req, res) => {
    const { novedad_id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'Archivo no proporcionado' });
    }

    // Actualizar la ruta para incluir "agendas"
    const filePath = `uploads/agendas/${req.file.filename}`;

    try {
      // Guardar la ruta del archivo en la base de datos
      await pool.query(
        'INSERT INTO novedad_archivos (novedad_id, nombre_archivo, ruta_archivo) VALUES (?, ?, ?)',
        [novedad_id, req.file.originalname, filePath]
      );
      res
        .status(200)
        .json({ message: 'Archivo subido y guardado correctamente.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al guardar el archivo.' });
    }
  }
);

app.get('/download/novedad/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT ruta_archivo FROM novedad_archivos WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

    const filePath = join(CURRENT_DIR, rows[0].ruta_archivo);
    console.log('Ruta completa del archivo:', filePath);

    // Verifica la existencia del archivo
    try {
      await fs.promises.access(filePath);
    } catch {
      return res
        .status(404)
        .json({ message: 'Archivo no encontrado en el servidor.' });
    }

    // Configura el tipo de contenido
    res.setHeader('Content-Type', 'application/octet-stream');

    // Envía el archivo
    res.download(filePath, (err) => {
      if (err) {
        console.error('Error al descargar el archivo:', err);
        res.status(500).json({ message: 'Error al descargar el archivo.' });
      }
    });
  } catch (error) {
    console.error('Error en el endpoint de descarga:', error);
    res.status(500).json({ message: 'Error al descargar el archivo.' });
  }
});

// Ejemplo usando Express.js
app.get('/novedadesarch/:novedadId', async (req, res) => {
  const novedadId = parseInt(req.params.novedadId);

  try {
    console.log('Buscando archivos con novedad_id:', novedadId);
    const [rows] = await pool.query(
      'SELECT * FROM novedad_archivos WHERE novedad_id = ?',
      [novedadId]
    );

    if (rows.length === 0) {
      console.log('No se encontraron archivos para esta novedad.');
      return res
        .status(404)
        .json({ message: 'No se encontraron archivos para esta novedad.' });
    }
    res.json(rows);
  } catch (error) {
    console.error('Error en la consulta:', error); // Añadir detalles del error
    res.status(500).json({ message: 'Error al obtener los archivos.' });
  }
});

// R5-SUBIR ARCHIVOS A NOVEDADES - 16-09-2024 - Benjamin Orellana - FINAL

// Endpoint para obtener vencimientos relacionados con una novedad específica
app.get('/novedades-vencimientos/:novedadId', async (req, res) => {
  const novedadId = parseInt(req.params.novedadId);

  // Verificar si novedadId es un número válido
  if (isNaN(novedadId)) {
    return res.status(400).json({ message: 'ID de novedad inválido.' });
  }

  try {
    console.log('Buscando vencimientos con novedad_id:', novedadId);

    // Realizar la consulta a la base de datos
    const [rows] = await pool.query(
      'SELECT * FROM novedades_vencimientos WHERE novedad_id = ?',
      [novedadId]
    );

    // Verificar si se encontraron vencimientos
    if (rows.length === 0) {
      console.log('No se encontraron vencimientos para esta novedad.');
      return res
        .status(404)
        .json({ message: 'No se encontraron vencimientos para esta novedad.' });
    }

    // Enviar los resultados en formato JSON
    res.json(rows);
  } catch (error) {
    console.error('Error en la consulta:', error); // Añadir detalles del error
    res.status(500).json({ message: 'Error al obtener los vencimientos.' });
  }
});

// Endpoint para crear un nuevo vencimiento
app.post('/novedades-vencimientos', async (req, res) => {
  const { novedad_id, vencimiento, sede, titulo, mensaje, user, estado } =
    req.body;

  // Validar que se envían los campos requeridos
  if (!novedad_id || !vencimiento || !sede) {
    return res.status(400).json({
      message: 'Faltan datos requeridos: novedad_id, vencimiento y sede.'
    });
  }

  try {
    // Verificar si ya existe un vencimiento con el mismo novedad_id, vencimiento y sede
    const [existingVencimiento] = await pool.query(
      `SELECT * FROM novedades_vencimientos 
       WHERE novedad_id = ? AND vencimiento = ? AND sede = ?`,
      [novedad_id, vencimiento, sede]
    );

    // Si ya existe, retornamos un error o simplemente no agregamos el duplicado
    if (existingVencimiento.length > 0) {
      return res.status(409).json({
        message: 'El vencimiento ya existe para esta novedad y sede.'
      });
    }

    const userId = Array.isArray(user) && user.length > 0 ? user[0].id : null; // Solo tomamos el primer user_id

    // Insertar el vencimiento en la base de datos
    const [result] = await pool.query(
      `INSERT INTO novedades_vencimientos 
        (novedad_id, vencimiento, sede, titulo, mensaje, user, estado) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        novedad_id,
        vencimiento,
        sede,
        titulo || null,
        mensaje || null,
        user || null,
        estado || 1
      ]
    );

    res.status(201).json({
      message: 'Vencimiento creado correctamente',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error al crear vencimiento:', error);
    res.status(500).json({ message: 'Error al crear vencimiento.' });
  }
});

// Endpoint para obtener todas las novedades vencimientos
app.get('/novedades-vencimientos', async (req, res) => {
  try {
    console.log('Buscando todas las novedades vencimientos');

    // Realizar la consulta a la base de datos
    const [rows] = await pool.query('SELECT * FROM novedades_vencimientos');

    // Verificar si se encontraron vencimientos
    if (rows.length === 0) {
      console.log('No se encontraron vencimientos.');
      return res
        .status(404)
        .json({ message: 'No se encontraron vencimientos.' });
    }

    // Enviar los resultados en formato JSON
    res.json(rows);
  } catch (error) {
    console.error('Error en la consulta:', error); // Añadir detalles del error
    res.status(500).json({ message: 'Error al obtener los vencimientos.' });
  }
});

// Endpoint para eliminar un vencimiento por su ID
app.delete('/novedades-vencimientos/:id', async (req, res) => {
  const { id } = req.params; // Obtener el ID del vencimiento de los parámetros de la URL

  try {
    // Verificar si existe el vencimiento
    const [existingVencimiento] = await pool.query(
      `SELECT * FROM novedades_vencimientos WHERE id = ?`,
      [id]
    );

    if (existingVencimiento.length === 0) {
      return res.status(404).json({
        message: 'El vencimiento no existe.'
      });
    }

    // Eliminar el vencimiento de la base de datos
    await pool.query(`DELETE FROM novedades_vencimientos WHERE id = ?`, [id]);

    res.status(200).json({
      message: 'Vencimiento eliminado correctamente.'
    });
  } catch (error) {
    console.error('Error al eliminar vencimiento:', error);
    res.status(500).json({
      message: 'Error al eliminar el vencimiento.'
    });
  }
});

//R8 - SE AGREGAN FECHAS PARA TRABAJAR EN CONVENIOS INICIO - BENJAMIN ORELLANA */
import IntegrantesConveModelClon from './Models/MD_TB_IntegrantesConveClon.js';
import Meses from './Models/MD_TB_Meses.js';
// const registros = await IntegrantesConveModelClon.findAll();
// console.log(`Registros encontrados: ${JSON.stringify(registros, null, 2)}`);

// Función para obtener el último mes de ejecución de la base de datos
async function getLastExecutionMonth() {
  const lastExecution = await Meses.findOne();
  if (lastExecution) {
    return new Date(lastExecution.fecha).getMonth();
  }
  return null;
}

// Función para actualizar la fecha de la última ejecución
async function updateLastExecutionMonth() {
  const currentDate = new Date();
  await Meses.upsert({
    id: 1, // Aseguramos que solo haya un registro con el id 1
    fecha: currentDate
  });
}

// Función para clonar todos los registros de `integrantes_conve`
async function cloneIntegrantes() {
  try {
    // Verificar si existe al menos un convenio con permiteFec igual a 1

    // Obtener los convenios que permiten la clonación
    const [conveniosPermitidos] = await pool.query(
      `SELECT id FROM adm_convenios WHERE permiteFec = 1`
    );

    // Log de convenios permitidos
    console.log('Convenios permitidos:', conveniosPermitidos);

    // Si no hay convenios permitiendo la clonación, salimos
    if (conveniosPermitidos.length === 0) {
      console.log(
        'La clonación no está permitida. No hay convenios con permiteFec igual a 1.'
      );
      return; // Salir si no se permite la clonación
    }

    const registros = await IntegrantesConveModelClon.findAll(); // Todos los registros de la tabla original
    const currentMonth = new Date().getMonth(); // Mes actual
    const lastExecutionMonth = await getLastExecutionMonth(); // Obtiene el último mes de clonación

    // Si ya se ejecutó este mes, salir
    if (currentMonth === lastExecutionMonth) {
      console.log('La clonación ya se ejecutó este mes. Saliendo...');
      return;
    }

    // Obtener solo los IDs de los convenios permitidos
    const conveniosIdsPermitidos = conveniosPermitidos.map(
      (convenio) => convenio.id
    );
    console.log('IDs de convenios permitidos:', conveniosIdsPermitidos);

    // Filtrar los registros que se deben clonar basados en los convenios permitidos
    const registrosAClonar = registros.filter((registro) => {
      const shouldClone = conveniosIdsPermitidos.includes(registro.id_conv); // Asegúrate de que 'convenioId' es el nombre correcto
      console.log(
        `Registro ID: ${registro.id}, Conv ID: ${registro.id_conv}, Clonable: ${shouldClone}`
      ); // Log para ver el estado de cada registro
      return shouldClone; // Retorna solo aquellos que son clonables
    });

    // Verifica los registros a clonar
    console.log('Registros a clonar:', registrosAClonar);

    // Log de registros que se intentan clonar
    console.log('Registros a clonar:', registrosAClonar);

    // Si hay registros para clonar
    if (registrosAClonar.length > 0) {
      console.log(
        `${registrosAClonar.length} registros encontrados. Comenzando a clonar...`
      );

      const fechaCreacion = new Date(new Date().getFullYear(), currentMonth, 1);

      // Eliminar registros antiguos de la tabla clonada que coincidan con la fecha actual
      await IntegrantesConveModelClon.destroy({
        where: {
          fechaCreacion: fechaCreacion // Eliminar registros de la fecha de clonación
        }
      });

      // Clonar cada registro que está permitido por el convenio
      for (let registro of registrosAClonar) {
        // Verificar si el registro ya existe en la tabla clonada
        const existingRegistro = await IntegrantesConveModelClon.findOne({
          where: {
            nombre: registro.nombre,
            dni: registro.dni,
            telefono: registro.telefono,
            email: registro.email,
            fechaCreacion: fechaCreacion
          }
        });

        // Solo crear un nuevo registro si no existe uno igual
        if (!existingRegistro) {
          await IntegrantesConveModelClon.create({
            ...registro.dataValues, // Copia los valores del registro original
            id: undefined, // Evita conflictos con el ID
            fechaCreacion: fechaCreacion // Fecha del primer día del mes actual
          });
        } else {
          console.log(
            `El registro con ${registro.nombre} ya existe y no será duplicado.`
          );
        }
      }

      console.log('Registros duplicados con éxito.');
      await updateLastExecutionMonth(); // Actualiza la fecha de la última clonación
    } else {
      console.log('No se encontraron registros para clonar.');
    }
  } catch (error) {
    console.error('Error en la clonación:', error);
  }
}

cloneIntegrantes();

// Programar la tarea para que se ejecute el 1 de cada mes a las 00:00
cron.schedule('0 0 1 * *', () => {
  console.log(
    'Cron job ejecutado - Comenzando a clonar registros de IntegrantesConve...'
  );
  cloneIntegrantes();
});

//R8 - SE AGREGAN FECHAS PARA TRABAJAR EN CONVENIOS FINAL - BENJAMIN ORELLANA */

app.post('/congelamientos/:convenio_id', async (req, res) => {
  const { convenio_id } = req.params;
  const { estado, vencimiento } = req.body;

  if (typeof estado === 'undefined' || typeof vencimiento === 'undefined') {
    return res.status(400).json({ error: 'Faltan parámetros en la solicitud' });
  }

  try {
    // Verifica si ya existe un registro congelado para el mismo convenio y mes
    const existingRecord = await db.query(
      'SELECT * FROM congelamiento_integrantes WHERE convenio_id = :convenio_id AND MONTH(vencimiento) = MONTH(:vencimiento) AND YEAR(vencimiento) = YEAR(:vencimiento)',
      {
        replacements: { convenio_id, vencimiento },
        type: db.QueryTypes.SELECT
      }
    );

    if (existingRecord.length > 0) {
      // Si ya existe, actualizamos el estado contrario (congelar o descongelar)
      const results = await db.query(
        'UPDATE congelamiento_integrantes SET estado = :estado WHERE convenio_id = :convenio_id AND vencimiento = :vencimiento',
        {
          replacements: { estado, convenio_id, vencimiento },
          type: db.QueryTypes.UPDATE
        }
      );

      return res.status(200).json({
        message:
          estado === 1
            ? 'Congelamiento activado correctamente'
            : 'Congelamiento desactivado correctamente',
        data: results
      });
    } else {
      // Si no existe, crear nuevo registro
      const results = await db.query(
        'INSERT INTO congelamiento_integrantes (convenio_id, estado, vencimiento) VALUES (:convenio_id, :estado, :vencimiento)',
        {
          replacements: { convenio_id, estado, vencimiento },
          type: db.QueryTypes.INSERT
        }
      );

      return res
        .status(201)
        .json({ message: 'Congelamiento creado con éxito', data: results });
    }
  } catch (err) {
    console.log('Error ejecutando la consulta', err);
    res.status(500).json({ error: 'Error ejecutando la consulta' });
  }
});

app.put('/congelamientos/:convenio_id', async (req, res) => {
  const { convenio_id } = req.params;
  const { estado, vencimiento } = req.body;

  if (typeof estado === 'undefined' || typeof vencimiento === 'undefined') {
    return res.status(400).json({ error: 'Faltan parámetros en la solicitud' });
  }

  try {
    // Si el estado es 0, descongelar
    if (estado === 0) {
      const results = await db.query(
        'UPDATE congelamiento_integrantes SET estado = :estado WHERE convenio_id = :convenio_id AND vencimiento = :vencimiento',
        {
          replacements: { estado, convenio_id, vencimiento },
          type: db.QueryTypes.UPDATE
        }
      );

      // Verificar si se realizó alguna actualización
      if (results[1] > 0) {
        // results[1] contiene el número de filas afectadas
        return res
          .status(200)
          .json({ message: 'Congelamiento descongelado correctamente' });
      } else {
        return res.status(404).json({
          message: 'No se encontró el congelamiento para descongelar'
        });
      }
    } else {
      // Si el estado es 1, congelar
      const [existingRecord] = await db.query(
        'SELECT * FROM congelamiento_integrantes WHERE convenio_id = :convenio_id AND vencimiento = :vencimiento',
        {
          replacements: { convenio_id, vencimiento },
          type: db.QueryTypes.SELECT
        }
      );

      if (existingRecord) {
        // Si existe, actualizamos el registro
        const results = await db.query(
          'UPDATE congelamiento_integrantes SET estado = :estado WHERE convenio_id = :convenio_id AND vencimiento = :vencimiento',
          {
            replacements: { estado, convenio_id, vencimiento },
            type: db.QueryTypes.UPDATE
          }
        );

        return res.status(200).json({
          message: 'Congelamiento actualizado correctamente',
          data: results
        });
      } else {
        // Si no existe, creamos un nuevo registro
        const results = await db.query(
          'INSERT INTO congelamiento_integrantes (convenio_id, estado, vencimiento) VALUES (:convenio_id, :estado, :vencimiento)',
          {
            replacements: { convenio_id, estado, vencimiento },
            type: db.QueryTypes.INSERT
          }
        );

        return res
          .status(201)
          .json({ message: 'Congelamiento creado con éxito', data: results });
      }
    }
  } catch (err) {
    console.log('Error executing query', err);
    res.status(500).json({ error: 'Error ejecutando la consulta' });
  }
});

app.get('/integrantes-congelados/:id_conv', async (req, res) => {
  const { id_conv } = req.params;

  try {
    const results = await db.query(
      'SELECT estado, vencimiento FROM congelamiento_integrantes c WHERE c.convenio_id = :convenio_id',
      {
        replacements: { convenio_id: id_conv },
        type: db.QueryTypes.SELECT
      }
    );

    res.json(results);
  } catch (err) {
    console.log('Error executing query', err);
    res.status(500).json({ error: 'Error ejecutando la consulta' });
  }
});

// Función para eliminar asistencias futuras
const eliminarAsistenciasFuturas = async (diaHoy, mesHoy, anioHoy) => {
  const fechaHoy = new Date();
  const diaHoyActual = fechaHoy.getDate(); // Obtener el día actual del mes
  await AsistenciasModel.destroy({
    where: {
      [Op.and]: [
        { dia: { [Op.gt]: diaHoyActual } }, // Días mayores al actual
        { mes: mesHoy }, // Asegurarse de que sea el mismo mes
        { anio: anioHoy } // Asegurarse de que sea el mismo año
      ]
    }
  });
  console.log(`Asistencias futuras eliminadas hasta el día ${diaHoyActual}.`);
};

// Función para crear asistencias automáticas
const crearAsistenciasAutomáticas = async () => {
  try {
    // 1. Obtener todos los alumnos
    const alumnos = await AlumnosModel.findAll();

    // 2. Verificar si es día hábil (lunes a viernes)
    const fechaHoy = new Date();
    const diaSemana = fechaHoy.getDay();
    const diaHoy = fechaHoy.getDate();
    const mesHoy = fechaHoy.getMonth() + 1;
    const anioHoy = fechaHoy.getFullYear();

    if (diaSemana === 0 || diaSemana === 6) {
      console.log('No se crean asistencias los fines de semana.');
      return;
    }

    // 3. Obtener asistencias ya registradas hoy
    const asistenciasExistentes = await AsistenciasModel.findAll({
      where: { dia: diaHoy, mes: mesHoy, anio: anioHoy }
    });

    // 4. Crear asistencias solo si no existen
    const asistencias = alumnos
      .filter(
        (alumno) =>
          !asistenciasExistentes.some((a) => a.alumno_id === alumno.id)
      )
      .map((alumno) => ({
        alumno_id: alumno.id,
        dia: diaHoy,
        mes: mesHoy,
        anio: anioHoy,
        estado: 'A'
      }));

    if (asistencias.length > 0) {
      await AsistenciasModel.bulkCreate(asistencias);
      console.log('Asistencias creadas con éxito.');
    } else {
      console.log('Las asistencias ya estaban registradas.');
    }

    // 5. Eliminar asistencias futuras
    await eliminarAsistenciasFuturas(diaHoy, mesHoy, anioHoy);
  } catch (error) {
    console.error('Error al crear asistencias automáticas:', error);
  }
};

// Configuración del cron job
cron.schedule(
  '0 7 * * 1-5',
  async () => {
    try {
      const currentTime = moment()
        .tz('America/Argentina/Buenos_Aires')
        .format('HH:mm');
      console.log(
        `Creando asistencias automáticas a las ${currentTime} en Buenos Aires...`
      );

      await crearAsistenciasAutomáticas();
    } catch (error) {
      console.error('Error en el cron job:', error);
    }
  },
  {
    timezone: 'America/Argentina/Buenos_Aires' // Configura la zona horaria para Buenos Aires
  }
);

// ALERTAS - AGENDAS - R9 - BENJAMIN ORELLANA - INICIO 17-NOV-24
// Función para generar alertas en la tabla 'agendas' en la celda 1
const genAlertAgendN1 = async () => {
  try {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const mesActual = hoy.getMonth() + 1; // Mes actual (0 indexado)
    const anioActual = hoy.getFullYear();

    console.log(`Fecha actual: ${diaHoy}-${mesActual}-${anioActual}`);

    // Rango de fecha: 2 días atrás (desde) hasta ayer (hasta)
    const fechaInicio = new Date();
    fechaInicio.setDate(hoy.getDate() - 2);
    fechaInicio.setHours(0, 0, 0, 0);

    const fechaFin = new Date();
    fechaFin.setDate(hoy.getDate() - 1);
    fechaFin.setHours(23, 59, 59, 999);

    const fechaInicioStr = fechaInicio
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const fechaFinStr = fechaFin.toISOString().slice(0, 19).replace('T', ' ');

    console.log(`Buscando alumnos entre: ${fechaInicioStr} y ${fechaFinStr}`);

    const [alumnos] = await pool.execute(
      `SELECT id, fecha_creacion, prospecto FROM alumnos 
       WHERE id IN (
         SELECT MAX(id) 
         FROM alumnos 
         WHERE fecha_creacion BETWEEN ? AND ?
           AND prospecto IN ('nuevo', 'prospecto')
           AND mes = ? 
           AND anio = ?
         GROUP BY nombre
       )`,
      [fechaInicioStr, fechaFinStr, mesActual, anioActual]
    );

    console.log('Alumnos encontrados:', alumnos);

    if (alumnos.length === 0) {
      console.log(
        'No se encontraron alumnos que coincidan con la fecha y condiciones.'
      );
      return;
    }

    for (const alumno of alumnos) {
      const [alertasExistentes] = await pool.execute(
        `SELECT id FROM agendas 
         WHERE alumno_id = ? 
           AND agenda_num = 1
           AND mes = ? 
           AND anio = ?`,
        [alumno.id, mesActual, anioActual]
      );

      console.log(
        `Alertas existentes para alumno_id ${alumno.id}:`,
        alertasExistentes
      );

      if (alertasExistentes.length === 0) {
        console.log(`Insertando alerta para alumno_id: ${alumno.id}`);
        await pool.execute(
          `INSERT INTO agendas (alumno_id, agenda_num, contenido, mes, anio)
           VALUES (?, 1, 'PENDIENTE', ?, ?)`,
          [alumno.id, mesActual, anioActual]
        );
      } else {
        console.log(
          `Alerta ya existente para alumno_id: ${alumno.id}, no se crea duplicado.`
        );
      }
    }

    console.log(`Proceso de generación de alertas completado.`);
  } catch (error) {
    console.error('Error generando alertas:', error);
  }
};

//genAlertAgendN1(); // se comenta esto, en produccion funciona, para desarrollo se descomenta
// Configura el cron job para ejecutarse de lunes a viernes

cron.schedule('0 0 * * *', async () => {
  console.log('Ejecutando cron de alertas...');
  await genAlertAgendN1();
});

// Función para generar alertas en la tabla 'agendas' para la 3ra semana celda 2
const genAlertAgendN3 = async () => {
  try {
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();

    // Fecha exacta de hace 21 días (3 semanas)
    const fechaObjetivo = new Date();
    fechaObjetivo.setDate(hoy.getDate() - 21);
    fechaObjetivo.setHours(0, 0, 0, 0); // inicio del día
    const fechaObjetivoFin = new Date(fechaObjetivo);
    fechaObjetivoFin.setHours(23, 59, 59, 999); // fin del día

    const fechaInicioStr = fechaObjetivo
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const fechaFinStr = fechaObjetivoFin
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    console.log(
      `Buscando alumnos creados hace 3 semanas (${fechaInicioStr} - ${fechaFinStr})`
    );

    const [alumnos] = await pool.execute(
      `SELECT id, fecha_creacion, prospecto 
       FROM alumnos 
       WHERE id IN (
         SELECT MAX(id) 
         FROM alumnos 
         WHERE fecha_creacion BETWEEN ? AND ?
           AND prospecto IN ('nuevo', 'prospecto')
           AND mes = ? 
           AND anio = ?
         GROUP BY nombre
       )`,
      [fechaInicioStr, fechaFinStr, mesActual, anioActual]
    );

    if (alumnos.length === 0) {
      console.log('No se encontraron alumnos para generar alertas N3.');
      return;
    }

    for (const alumno of alumnos) {
      const [alertasExistentes] = await pool.execute(
        `SELECT id FROM agendas 
         WHERE alumno_id = ? 
           AND agenda_num = 2 
           AND mes = ? 
           AND anio = ?`,
        [alumno.id, mesActual, anioActual]
      );

      if (alertasExistentes.length === 0) {
        console.log(`Insertando alerta N3 para alumno_id: ${alumno.id}`);
        await pool.execute(
          `INSERT INTO agendas (alumno_id, agenda_num, contenido, mes, anio)
           VALUES (?, 2, 'PENDIENTE', ?, ?)`,
          [alumno.id, mesActual, anioActual]
        );
      } else {
        console.log(
          `Ya existe alerta N3 para alumno_id: ${alumno.id}, no se genera duplicado.`
        );
      }
    }

    console.log('Proceso de generación de alertas N3 completado.');
  } catch (error) {
    console.error('Error generando alertas N3:', error);
  }
};

// genAlertAgendN3(); -- se comenta esto, en produccion funciona, para desarrollo se descomenta
// Configura el cron job para ejecutarse diariamente
cron.schedule('0 0 * * *', async () => {
  console.log('Ejecutando cron de alertas para la 3ra semana...');
  await genAlertAgendN3();
});

const generarAlertaProspecto = async () => {
  try {
    // Obtener la fecha de hoy
    const hoy = new Date();
    const fechaHoyISO = hoy.toISOString().split('T')[0]; // Solo la fecha (sin hora)
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();

    console.log(`Fecha de hoy: ${fechaHoyISO}`);

    // Obtener prospectos del mes y año actual (id más alto por nombre)
    const [alumnosProspecto] = await pool.execute(
      `SELECT MAX(id) AS id, MAX(fecha_creacion) AS fecha_creacion, prospecto 
       FROM alumnos 
       WHERE prospecto = 'prospecto' 
         AND mes = ? AND anio = ?
       GROUP BY nombre`,
      [mesActual, anioActual]
    );

    console.log(`Alumnos prospecto encontrados:`, alumnosProspecto);

    if (alumnosProspecto.length === 0) {
      console.log('No se encontraron alumnos prospecto.');
      return;
    }

    for (const alumno of alumnosProspecto) {
      const fechaCreacion = new Date(alumno.fecha_creacion);
      const fechaSieteDias = new Date(fechaCreacion);
      fechaSieteDias.setDate(fechaCreacion.getDate() + 7);
      const fechaSieteDiasISO = fechaSieteDias.toISOString().split('T')[0];

      console.log(
        `Fecha para generar alerta (7 días después) para alumno_id ${alumno.id}: ${fechaSieteDiasISO}`
      );

      if (fechaSieteDiasISO === fechaHoyISO) {
        console.log(
          `Generando alerta para alumno_id ${alumno.id} en la agenda 3`
        );

        const [alertasExistentes] = await pool.execute(
          `SELECT id FROM agendas 
           WHERE alumno_id = ? AND agenda_num = 3 AND mes = ? AND anio = ?`,
          [alumno.id, mesActual, anioActual]
        );

        if (alertasExistentes.length > 0) {
          console.log(
            `Actualizando alerta existente para agenda_num 3 para alumno_id: ${alumno.id}`
          );

          await pool.execute(
            `UPDATE agendas 
             SET contenido = 'PENDIENTE', mes = ?, anio = ? 
             WHERE alumno_id = ? AND agenda_num = 3`,
            [mesActual, anioActual, alumno.id]
          );
        } else {
          console.log(
            `Insertando nueva alerta para agenda_num 3 para alumno_id: ${alumno.id}`
          );

          await pool.execute(
            `INSERT INTO agendas (alumno_id, agenda_num, contenido, mes, anio) 
             VALUES (?, 3, 'PENDIENTE', ?, ?)`,
            [alumno.id, mesActual, anioActual]
          );
        }
      }
    }

    console.log('Proceso de generación de alerta para prospectos completado.');
  } catch (error) {
    console.error('Error generando alerta para prospectos:', error);
  }
};

// generarAlertaProspecto(); se comenta
// Configura el cron job para ejecutarse diariamente
cron.schedule('0 0 * * *', async () => {
  console.log('Ejecutando cron de alertas para los inactivos...');
  await generarAlertaProspecto();
});

// Registrar la creación de una nueva alerta
const registrarCreacionAlerta = async (alumno_id, agenda_num) => {
  try {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();

    // Verificar si ya existe una alerta con esos datos
    const [result] = await pool.execute(
      `SELECT id FROM alertas_creadas 
       WHERE alumno_id = ? AND agenda_num = ? AND mes = ? AND anio = ?`,
      [alumno_id, agenda_num, mes, anio]
    );

    if (result.length > 0) {
      console.log(
        `Ya existe una alerta para alumno_id: ${alumno_id}, agenda: ${agenda_num}, mes: ${mes}, año: ${anio}`
      );
      return; // Salís sin hacer el insert
    }

    // Si no existe, la insertás
    await pool.execute(
      `INSERT IGNORE INTO alertas_creadas (alumno_id, fecha_creacion, agenda_num, mes, anio)
       VALUES (?, ?, ?, ?, ?)`,
      [alumno_id, hoy, agenda_num, mes, anio]
    );

    console.log(
      `Alerta creada y registrada para el alumno_id: ${alumno_id}, mes: ${mes}, año: ${anio}`
    );
  } catch (error) {
    console.error('Error al registrar la creación de la alerta:', error);
  }
};

const filtrarAlumnosCon5AConsecutivas = (asistencias) => {
  const alumnosConAlerta = new Set();
  const porAlumno = {};

  for (const asis of asistencias) {
    if (!porAlumno[asis.alumno_id]) porAlumno[asis.alumno_id] = [];
    porAlumno[asis.alumno_id].push({ dia: asis.dia, estado: asis.estado });
  }

  for (const [alumnoId, registros] of Object.entries(porAlumno)) {
    const ordenados = registros.sort((a, b) => a.dia - b.dia);
    let consecutivas = 0;

    for (const reg of ordenados) {
      if (reg.estado === 'A') {
        consecutivas++;
        if (consecutivas >= 5) {
          alumnosConAlerta.add(parseInt(alumnoId));
          break;
        }
      } else {
        consecutivas = 0;
      }
    }
  }

  return [...alumnosConAlerta];
};

const genAlertInactivos = async () => {
  try {
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();
    const agenda_num = 4; // Alerta de inactividad

    const [asistencias] = await pool.execute(
      `SELECT a.alumno_id, a.dia, a.estado
       FROM asistencias a
       JOIN alumnos al ON al.id = a.alumno_id
       WHERE a.mes = ? AND a.anio = ?
       ORDER BY a.alumno_id, a.dia`,
      [mesActual, anioActual]
    );

    const alumnos = filtrarAlumnosCon5AConsecutivas(asistencias);

    for (const alumno_id of alumnos) {
      try {
        // Intentamos insertar directamente (sin consultar antes)
        await pool.execute(
          `INSERT INTO agendas (alumno_id, agenda_num, contenido, mes, anio)
           VALUES (?, ?, 'PENDIENTE', ?, ?)`,
          [alumno_id, agenda_num, mesActual, anioActual]
        );

        await registrarCreacionAlerta(alumno_id, agenda_num);

        console.log(
          `✅ Insertada alerta de inactividad para alumno_id: ${alumno_id}`
        );
      } catch (error) {
        // Si hay error de duplicado (código ER_DUP_ENTRY en MySQL), lo ignoramos
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(
            `⚠️ Alerta ya existe para alumno_id: ${alumno_id} en mes ${mesActual} y año ${anioActual}`
          );
        } else {
          // Si otro error, lo lanzamos para manejarlo afuera
          throw error;
        }
      }
    }

    console.log(
      '✅ Proceso de generación de alertas para inactivos completado.'
    );
  } catch (error) {
    console.error('❌ Error generando alertas para inactivos:', error);
  }
};
// Configura el cron job para ejecutarse diariamente
cron.schedule('0 0 * * *', async () => {
  console.log('Ejecutando cron de alertas para los inactivos...');
  await genAlertInactivos();
});

const actualizarProspectosANuevo = async () => {
  try {
    // Consulta para obtener alumnos con 2 o más asistencias consecutivas usando MAX(id)
    const [alumnosConAsistencias] = await pool.execute(`
      SELECT MAX(asis.id) AS max_asistencia_id, a.id AS alumno_id, COUNT(*) AS asistencias_consecutivas
      FROM asistencias AS asis
      JOIN alumnos AS a ON asis.alumno_id = a.id
      WHERE asis.estado = 'P' AND a.prospecto = 'prospecto'
      GROUP BY asis.alumno_id
      HAVING asistencias_consecutivas >= 2
    `);

    // Si no hay alumnos con asistencias suficientes, no hacer nada
    if (alumnosConAsistencias.length === 0) {
      console.log('No se encontraron alumnos para convertir a "nuevo".');
      return;
    }

    for (const { alumno_id, max_asistencia_id } of alumnosConAsistencias) {
      console.log(`Actualizando alumno_id: ${alumno_id} a "nuevo"`);

      // Actualizar el alumno a "nuevo" solo si el id de asistencia es el más alto
      const [resultUpdate] = await pool.execute(
        `UPDATE alumnos 
         SET prospecto = 'nuevo', c = 'c', fecha_creacion = CURDATE()
         WHERE id = ? AND prospecto = 'prospecto'`,
        [alumno_id]
      );

      console.log(
        `Alumno ${alumno_id} actualizado a "nuevo". Resultado:`,
        resultUpdate
      );

      // Generar las agendas necesarias (llamadas a funciones)
      await genAlertAgendN1(); // Alerta para la próxima semana
      await genAlertAgendN3(); // Alerta para la tercera semana
    }

    console.log('Proceso de verificación y actualización completado.');
  } catch (error) {
    console.error('Error verificando asistencias:', error);
  }
};

// actualizarProspectosANuevo();
cron.schedule('0 0 * * *', async () => {
  console.log('Ejecutando cron de alertas para la actualizacion...');
  await actualizarProspectosANuevo();
});

// ALERTAS - AGENDAS - R9 - BENJAMIN ORELLANA - FIN 17-NOV-24

// SUBIR IMAGENES A LAS AGENDAS

// Endpoint para obtener las agendas de un alumno por su ID
app.get('/agendas/:alumnoId', async (req, res) => {
  const alumnoId = req.params.alumnoId;

  try {
    // Consulta para obtener las agendas del alumno
    const agendas = await db.query(
      'SELECT * FROM agendas WHERE alumno_id = ?',
      [alumnoId]
    );

    if (agendas.length === 0) {
      return res
        .status(404)
        .json({ message: 'No se encontraron agendas para este alumno.' });
    }

    // Enviar las agendas al frontend
    res.json(agendas);
  } catch (error) {
    console.error('Error al obtener las agendas:', error);
    res.status(500).json({ message: 'Hubo un error al obtener las agendas.' });
  }
});

// Ruta para subir imagen
app.post('/upload-image', multerUpload.single('file'), async (req, res) => {
  const { agenda_id, agenda_num, alumno_id } = req.body;
  let file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'Archivo no proporcionado' });
  }

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const originalPath = file.path; // Ruta donde multer lo guardó
  let finalPath = originalPath;

  try {
    // Si es una imagen WebP, la convertimos a JPG
    if (file.mimetype === 'image/webp') {
      const jpgFileName = file.filename.replace(/\.webp$/, `.jpg`);
      const outputPath = path.join(path.dirname(originalPath), jpgFileName);

      await sharp(originalPath)
        .jpeg({ quality: 90 }) // Convertimos a JPG con buena calidad
        .toFile(outputPath);

      // Eliminamos el archivo WebP original
      await fs.promises.unlink(originalPath); // no bloquea el event loop

      // Actualizamos variables para que el resto funcione igual
      file.filename = jpgFileName;
      file.mimetype = 'image/jpeg';
      finalPath = outputPath;
    }

    if (!agenda_id || !agenda_num || !alumno_id) {
      return res.status(400).json({ message: 'Faltan datos necesarios' });
    }

    await pool.query(
      'INSERT INTO agenda_imagenes (agenda_id, agenda_num, alumno_id, nombre_archivo, ruta_archivo) VALUES (?, ?, ?, ?, ?)',
      [
        agenda_id,
        agenda_num,
        alumno_id,
        file.filename,
        `uploads/agendas/${file.filename}`
      ]
    );

    res
      .status(200)
      .json({ message: 'Imagen subida y guardada correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al guardar la imagen.' });
  }
});

// Ruta para descargar imagen
app.get('/download-image/:agenda_id', async (req, res) => {
  const { agenda_id } = req.params;

  try {
    // Recupera el registro de la base de datos
    const imageRecord = await pool.query(
      'SELECT * FROM agenda_imagenes WHERE agenda_id = ?',
      [agenda_id]
    );

    console.log('Resultado de la consulta:', imageRecord);

    // Accede a la ruta del archivo desde el registro
    const imagePath = imageRecord[0][0]?.ruta_archivo;
    console.log('Ruta de archivo:', imagePath);

    if (!imagePath) {
      return res.status(400).json({ message: 'Ruta de archivo inválida' });
    }

    // Construye la ruta completa del archivo (sin duplicar 'uploads/agendas')
    const filePath = join(CURRENT_DIR, imagePath); // Elimina 'uploads/agendas'
    console.log('Ruta completa del archivo:', filePath);

    // Verifica si el archivo existe
    try {
      await fs.promises.access(filePath);
    } catch {
      return res
        .status(404)
        .json({ message: 'Archivo no encontrado en el servidor.' });
    }

    // Configura el tipo de contenido y descarga
    res.setHeader('Content-Type', 'application/octet-stream');
    res.download(filePath, (err) => {
      if (err) {
        console.error('Error al descargar el archivo:', err);
        res.status(500).json({ message: 'Error al descargar el archivo.' });
      }
    });
  } catch (error) {
    console.error('Error en el endpoint de descarga:', error);
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
});

// Endpoint para obtener asistencias por día
app.get('/asistencia/:dia', async (req, res) => {
  const { dia } = req.params;

  try {
    // Obtener todas las asistencias para ese día específico
    const registros = await AsistenciasModel.findAll({
      where: {
        dia: parseInt(dia) // Convertimos el dia a int
      }
    });

    // Si no hay registros para el día solicitado
    if (registros.length === 0) {
      return res.json({ mensaje: `No hay registros para el día ${dia}` });
    }

    // Devolver los registros encontrados
    res.json(registros);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ mensajeError: error.message });
  }
});

// Endpoint que devuelve las agendas pendientes agrupadas por alumno usando el mes y año actuales
app.get('/notificaciones', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Falta el id del instructor' });
  }

  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  try {
    const [result] = await pool.query(
      `SELECT DISTINCT
          a.alumno_id,
          a.agenda_num,
          al.nombre AS alumno_nombre,
          a.contenido AS estado_agenda,
          a.mes,
          a.anio
       FROM 
          agendas AS a
       JOIN 
          alumnos AS al ON a.alumno_id = al.id
       WHERE 
          a.id = (
              SELECT MAX(sub_a.id)
              FROM agendas AS sub_a
              WHERE 
                  sub_a.alumno_id = a.alumno_id
                  AND sub_a.agenda_num = a.agenda_num
          )
          AND a.contenido = 'PENDIENTE'
          AND NOT EXISTS (
              SELECT 1 
              FROM agendas AS sub_a
              WHERE 
                  sub_a.alumno_id = a.alumno_id
                  AND sub_a.agenda_num = a.agenda_num
                  AND sub_a.contenido IN ('REVISIÓN', 'ENVIADO')
                  AND sub_a.id = (
                      SELECT MAX(sub_sub_a.id)
                      FROM agendas AS sub_sub_a
                      WHERE 
                          sub_sub_a.alumno_id = a.alumno_id
                          AND sub_sub_a.agenda_num = a.agenda_num
                  )
          )
          AND al.user_id = ?
          AND a.mes = ? 
          AND a.anio = ?
          AND al.mes = ?   -- ✅ Validación del alumno
          AND al.anio = ?  -- ✅ Validación del alumno
       ORDER BY 
          a.alumno_id, a.agenda_num`,
      [user_id, mesActual, anioActual, mesActual, anioActual]
    );

    res.json(result);
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

/*
 * MODULO ESTADISTICAS
 */
// Endpoint que devuelve el total de alumnos con más de 6 "P" por profesor, filtrado por mes y año
app.get(
  '/estadisticas/profesores-con-alumnos-mas-de-seis-p',
  async (req, res) => {
    try {
      // Obtener los parámetros de la URL
      const { mes, anio } = req.query;

      // Validar que los parámetros existan
      if (!mes || !anio) {
        return res.status(400).json({ error: 'Mes y año son requeridos' });
      }

      // Convertir a número y validar rango
      const selectedMonth = parseInt(mes, 10);
      const selectedYear = parseInt(anio, 10);

      if (
        isNaN(selectedMonth) ||
        selectedMonth < 1 ||
        selectedMonth > 12 ||
        isNaN(selectedYear) ||
        selectedYear < 2000
      ) {
        return res.status(400).json({ error: 'Mes o año inválido' });
      }

      // Consulta SQL para obtener estadísticas filtradas por mes y año
      const [result] = await pool.query(
        `SELECT 
          u.id AS profesor_id,
          u.name AS profesor_nombre,
          COUNT(DISTINCT al.id) AS total_alumnos
        FROM 
          users AS u
        JOIN 
          alumnos AS al ON u.id = al.user_id
        JOIN 
          (SELECT alumno_id
          FROM asistencias 
          WHERE estado = 'P' AND mes = ? AND anio = ?
          GROUP BY alumno_id
          HAVING COUNT(alumno_id) > 5) AS a ON al.id = a.alumno_id
        GROUP BY 
          u.id, u.name
        ORDER BY 
          total_alumnos DESC`,
        [mes, anio]
      );

      // Verificar si hay resultados
      if (!result || result.length === 0) {
        return res.status(200).json({
          message: 'No se encontraron datos para el mes y año especificados',
          data: [] // Retornar un array vacío para que el frontend lo maneje sin errores
        });
      }

      // Responder con los datos
      res.json(result);
    } catch (error) {
      console.error(
        'Error obteniendo estadísticas de profesores profesores-con-alumnos-mas-de-seis-p:',
        error
      );
      res.status(500).json({
        error:
          'Error obteniendo estadísticas de profesores profesores-con-alumnos-mas-de-seis-p'
      });
    }
  }
);

// Endpoint que devuelve el total de asistencias por profesor filtrado por mes y año
app.get('/estadisticas/asistencias-por-profe', async (req, res) => {
  try {
    const { mes, anio } = req.query;

    // Validar que los parámetros mes y anio estén presentes
    if (!mes || !anio) {
      return res.status(400).json({ error: 'Mes y año son requeridos' });
    }

    // Convertir a número y validar rango
    const selectedMonth = parseInt(mes, 10);
    const selectedYear = parseInt(anio, 10);

    if (
      isNaN(selectedMonth) ||
      selectedMonth < 1 ||
      selectedMonth > 12 ||
      isNaN(selectedYear) ||
      selectedYear < 2000
    ) {
      return res.status(400).json({ error: 'Mes o año inválido' });
    }

    // Consulta para obtener el total de asistencias por profesor filtrado por mes y año
    const [result] = await pool.query(
      `SELECT 
          u.id AS profesor_id,
          u.name AS profesor_nombre,
          COUNT(a.id) AS total_asistencias
       FROM 
          users AS u
       JOIN 
          alumnos AS al ON u.id = al.user_id
       JOIN 
          asistencias AS a ON al.id = a.alumno_id
       WHERE 
          a.estado = 'P' AND a.mes = ? AND a.anio = ?
       GROUP BY 
          u.id, u.name
       ORDER BY 
          total_asistencias DESC`,
      [selectedMonth, selectedYear]
    );

    // Verificar si hay resultados
    if (!result || result.length === 0) {
      return res.status(200).json({
        message: 'No se encontraron datos para el mes y año especificados',
        data: [] // Retornar un array vacío para que el frontend lo maneje sin errores
      });
    }

    // Responder con los datos
    res.json(result);
  } catch (error) {
    console.error(
      'Error obteniendo estadísticas de asistencias asistencias-por-profe:',
      error
    );
    res.status(500).json({
      error:
        'Error obteniendo estadísticas de asistencias asistencias-por-profe'
    });
  }
});

// Endpoint que devuelve el Nuevos del Mes por Profe
// Endpoint que devuelve Nuevos del Mes por Profe con filtro de mes y año
app.get('/estadisticas/nuevos-del-mes', async (req, res) => {
  try {
    const { mes, anio } = req.query;

    // Validar que los parámetros existan
    if (!mes || !anio) {
      return res.status(400).json({ error: 'Mes y año son requeridos' });
    }

    // Convertir a número y validar el mes y el año
    const selectedMonth = parseInt(mes, 10);
    const selectedYear = parseInt(anio, 10);

    if (
      isNaN(selectedMonth) ||
      selectedMonth < 1 ||
      selectedMonth > 12 ||
      isNaN(selectedYear) ||
      selectedYear < 2000
    ) {
      return res.status(400).json({ error: 'Mes o año inválido' });
    }

    // Consulta SQL para obtener los nuevos alumnos del mes y año especificado
    const [result] = await pool.query(
      `
      SELECT 
        u.id AS profesor_id,
        u.name AS profesor_nombre,
        COUNT(a.id) AS nuevos_del_mes
      FROM 
        users AS u
      JOIN 
        alumnos AS a ON u.id = a.user_id
      WHERE 
        a.prospecto = 'nuevo'
        AND a.mes = ?  -- Usar el campo 'mes' directamente
        AND a.anio = ? -- Usar el campo 'anio' directamente
      GROUP BY 
        u.id, u.name
      ORDER BY 
        nuevos_del_mes DESC
    `,
      [selectedMonth, selectedYear]
    );

    // Verificar si se encontraron resultados
    if (!result || result.length === 0) {
      return res.status(200).json({
        message: 'No se encontraron datos para el mes y año especificados',
        data: [] // Retornar un array vacío para que el frontend lo maneje sin errores
      });
    }

    // Responder con los datos
    res.json(result);
  } catch (error) {
    console.error('Error obteniendo nuevos del mes nuevos-del-mes:', error);
    res
      .status(500)
      .json({ error: 'Error obteniendo nuevos del mes nuevos-del-mes' });
  }
});

// proscpectos del mes
app.get('/estadisticas/prospectos-del-mes', async (req, res) => {
  try {
    const { mes, anio } = req.query;

    // Validar que los parámetros existan
    if (!mes || !anio) {
      return res.status(400).json({ error: 'Mes y año son requeridos' });
    }

    // Convertir a número y validar el mes y el año
    const selectedMonth = parseInt(mes, 10);
    const selectedYear = parseInt(anio, 10);

    if (
      isNaN(selectedMonth) ||
      selectedMonth < 1 ||
      selectedMonth > 12 ||
      isNaN(selectedYear) ||
      selectedYear < 2000
    ) {
      return res.status(400).json({ error: 'Mes o año inválido' });
    }

    // Consulta SQL para obtener los prospectos del mes y año especificado
    const [result] = await pool.query(
      `
      SELECT 
        u.id AS profesor_id,
        u.name AS profesor_nombre,
        COUNT(ap.id) AS prospectos_del_mes
      FROM 
        users AS u
      JOIN 
        alumnos_prospecto AS ap ON u.id = ap.user_id
      WHERE 
        ap.prospecto = 'prospecto'
        AND ap.mes = ? 
        AND ap.anio = ?
      GROUP BY 
        u.id, u.name
      ORDER BY 
        prospectos_del_mes DESC
    `,
      [selectedMonth, selectedYear]
    );

    // Verificar si se encontraron resultados
    if (!result || result.length === 0) {
      return res.status(200).json({
        message: 'No se encontraron prospectos para el mes y año especificados',
        data: [] // Retornar un array vacío para que el frontend lo maneje sin errores
      });
    }

    // Responder con los datos
    res.json({
      message: 'Prospectos encontrados exitosamente',
      data: result
    });
  } catch (error) {
    console.error(
      'Error obteniendo prospectos del mes prospectos-del-mes:',
      error
    );
    res.status(500).json({
      error: 'Error obteniendo prospectos del mes prospectos-del-mes'
    });
  }
});

app.get('/estadisticas/convertidos', async (req, res) => {
  try {
    // Obtener mes y año de los parámetros de consulta
    const { mes, anio } = req.query;

    // Validar que los parámetros existen
    if (!mes || !anio) {
      return res.status(400).json({ error: 'Mes y año son requeridos' });
    }

    // Consulta SQL con filtro por mes y año
    const [resultados] = await pool.query(
      `SELECT 
          a.user_id AS profesor_id, 
          u.name AS profesor_nombre, 
          COUNT(*) AS totalConvertidos
       FROM alumnos a
       INNER JOIN users u ON a.user_id = u.id
       WHERE a.c = 'c' 
         AND a.mes = ? 
         AND a.anio = ?
       GROUP BY a.user_id, u.name`,
      [mes, anio]
    );

    res.status(200).json(resultados);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Nuevo Endpoint: Porcentaje de Conversión
app.get('/estadisticas/porcentaje-conversion', async (req, res) => {
  try {
    const { mes, anio } = req.query;

    // Validar que los parámetros mes y anio existan
    if (!mes || !anio) {
      return res.status(400).json({ error: 'Mes y año son requeridos' });
    }

    // Convertir a número y validar mes y anio
    const selectedMonth = parseInt(mes, 10);
    const selectedYear = parseInt(anio, 10);

    if (
      isNaN(selectedMonth) ||
      selectedMonth < 1 ||
      selectedMonth > 12 ||
      isNaN(selectedYear) ||
      selectedYear < 2000
    ) {
      return res.status(400).json({ error: 'Mes o año inválido' });
    }

    // Obtener los prospectos del mes y año especificado
    const [prospectos] = await db.query(
      `
      SELECT 
        u.id AS profesorId, 
        u.name AS profesorName,
        COUNT(ap.id) AS totalProspectos
      FROM 
        users AS u
      JOIN 
        alumnos_prospecto AS ap ON u.id = ap.user_id
      WHERE 
        ap.prospecto = 'prospecto' 
        AND MONTH(ap.fecha_creacion) = ${selectedMonth}
        AND YEAR(ap.fecha_creacion) = ${selectedYear}
      GROUP BY 
        u.id, u.name
    `
    );

    // Obtener los convertidos del mes y año especificado
    const [convertidos] = await db.query(
      `
      SELECT 
        a.user_id AS profesorId, 
        COUNT(*) AS totalConvertidos
      FROM 
        alumnos AS a
      WHERE 
        a.c = 'c' 
        AND MONTH(a.fecha_creacion) = ${selectedMonth}
        AND YEAR(a.fecha_creacion) = ${selectedYear}
      GROUP BY 
        a.user_id
    `
    );

    // Combinar los resultados de prospectos y convertidos
    const resultadoFinal = prospectos.map((profesor) => {
      const totalProspectos = profesor.totalProspectos;
      const totalConvertidos =
        convertidos.find((conv) => conv.profesorId === profesor.profesorId)
          ?.totalConvertidos || 0;

      // Asegurarse de que los convertidos no sean mayores que los prospectos
      const porcentajeConversion =
        totalProspectos === 0
          ? 0
          : ((totalConvertidos / totalProspectos) * 100).toFixed(2);

      return {
        profesorId: profesor.profesorId,
        profesorName: profesor.profesorName,
        totalProspectos,
        totalConvertidos,
        porcentajeConversion
      };
    });

    // Verificar si se encontraron resultados
    if (resultadoFinal.length === 0) {
      return res.status(200).json({
        message: 'No se encontraron resultados para el mes y año especificados',
        data: [] // Retornar un array vacío para que el frontend lo maneje sin errores
      });
    }

    res.status(200).json(resultadoFinal);
  } catch (error) {
    console.error('Error obteniendo porcentaje de conversión:', error);
    res
      .status(500)
      .json({ error: 'Error al calcular el porcentaje de conversión' });
  }
});

// Endpoint que devuelve la tasa de asistencia por profesor
app.get('/estadisticas/tasa-asistencia-por-profe', async (req, res) => {
  try {
    // Obtener mes y año desde los parámetros de la consulta, si no existen, usar el mes y año actuales
    const { mes, anio } = req.query;

    // Validar que los parámetros mes y anio existan
    if (!mes || !anio) {
      return res.status(400).json({ error: 'Mes y año son requeridos' });
    }

    // Convertir a número y validar mes y anio
    const selectedMonth = parseInt(mes, 10);
    const selectedYear = parseInt(anio, 10);

    if (
      isNaN(selectedMonth) ||
      selectedMonth < 1 ||
      selectedMonth > 12 ||
      isNaN(selectedYear) ||
      selectedYear < 2000
    ) {
      return res.status(400).json({ error: 'Mes o año inválido' });
    }

    // Consulta para obtener el total de asistencias por profesor
    const [asistencias] = await pool.query(
      `SELECT 
          u.id AS profesor_id,
          u.name AS profesor_nombre,
          COUNT(a.id) AS total_asistencias
       FROM 
          users AS u
       JOIN 
          alumnos AS al ON u.id = al.user_id
       JOIN 
          asistencias AS a ON al.id = a.alumno_id
         WHERE 
          a.estado = 'P'
          AND a.mes = ? 
          AND a.anio = ?
       GROUP BY 
          u.id, u.name`,
      [selectedMonth, selectedYear]
    );

    // Consulta para obtener el total de alumnos con más de 6 "P" por profesor
    const [alumnos] = await pool.query(
      `SELECT 
        u.id AS profesor_id,
        u.name AS profesor_nombre,
        COUNT(DISTINCT al.id) AS totalalumnos
      FROM 
        users AS u
      JOIN 
        alumnos AS al ON u.id = al.user_id
      JOIN 
        (SELECT alumno_id
         FROM asistencias 
         WHERE estado = 'P' 
         AND mes = ? 
         AND anio = ?
         GROUP BY alumno_id
         HAVING COUNT(alumno_id) > 6) AS a ON al.id = a.alumno_id
      GROUP BY 
        u.id, u.name`,
      [selectedMonth, selectedYear]
    );

    // Crear un objeto para almacenar la tasa de asistencia por profesor
    const tasaAsistencia = asistencias.map((profesor) => {
      // Encontrar el total de alumnos para este profesor
      const profesorAlumnos = alumnos.find(
        (alumno) => alumno.profesor_id === profesor.profesor_id
      );

      // Si no se encontró el profesor en los alumnos, la tasa es 0
      const totalAlumnos = profesorAlumnos ? profesorAlumnos.totalalumnos : 0;

      // Calcular la tasa de asistencia
      const tasa =
        totalAlumnos > 0 ? profesor.total_asistencias / totalAlumnos : 0;

      return {
        profesor_id: profesor.profesor_id,
        profesor_nombre: profesor.profesor_nombre,
        tasa_asistencia: tasa
      };
    });

    // Enviar la respuesta con las tasas de asistencia
    res.json(tasaAsistencia);
  } catch (error) {
    console.error('Error obteniendo tasas de asistencia:', error);
    res.status(500).json({ error: 'Error obteniendo tasas de asistencia' });
  }
});

app.get('/estadisticas/retenciones-del-mes', async (req, res) => {
  try {
    // 1. Consulta para obtener el nombre del profesor y la cantidad de alumnos retenidos
    const [retenidos] = await db.query(`
      SELECT 
        u.name AS profesor_nombre,  -- Nombre del profesor
        COUNT(DISTINCT a.id) AS retenidos  -- Número de alumnos retenidos
      FROM 
        alumnos AS a
      LEFT JOIN 
        asistencias AS asis ON a.id = asis.alumno_id 
        AND asis.estado = 'P'  -- Solo contamos las asistencias con estado 'P'
        AND YEAR(asis.dia) = YEAR(CURRENT_DATE())  -- Año actual
        AND MONTH(asis.dia) = MONTH(CURRENT_DATE())  -- Asistencias en el mes actual
      LEFT JOIN 
        users AS u ON a.user_id = u.id  -- Obtener el nombre del profesor
      WHERE 
        a.prospecto = 'nuevo'  -- Solo los alumnos nuevos
        AND YEAR(a.fecha_creacion) = YEAR(CURRENT_DATE())  -- Año actual
        AND MONTH(a.fecha_creacion) = MONTH(CURRENT_DATE()) - 1  -- Alumnos creados en el mes anterior
      GROUP BY 
        u.name;
    `);

    // 2. Responder con los resultados
    res.status(200).json(retenidos);
  } catch (error) {
    console.error('Error obteniendo estadísticas de retenciones:', error);
    res
      .status(500)
      .json({ error: 'Error al calcular las retenciones del mes' });
  }
});

app.get('/estadisticas/mensajes-por-profe', async (req, res) => {
  try {
    // Obtener los parámetros de la URL
    const { mes, anio } = req.query;

    // Validar que los parámetros existen
    if (!mes || !anio) {
      return res.status(400).json({ error: 'Mes y año son requeridos' });
    }

    // Consulta para obtener el total de mensajes enviados por cada profesor
    const [result] = await pool.query(
      `SELECT 
          u.id AS profesor_id,
          u.name AS profesor_nombre,
          COUNT(ai.id) AS total_mensajes
       FROM 
          agenda_imagenes ai
       JOIN 
          alumnos al ON ai.alumno_id = al.id
       JOIN 
          users u ON al.user_id = u.id
       WHERE 
          al.mes = ?  -- Filtrar por mes
          AND al.anio = ?  -- Filtrar por año
       GROUP BY 
          u.id, u.name
       ORDER BY 
          total_mensajes DESC`,
      [mes, anio]
    );

    res.json(result);
  } catch (error) {
    console.error('Error obteniendo el total de mensajes por profesor:', error);
    res
      .status(500)
      .json({ error: 'Error obteniendo el total de mensajes por profesor' });
  }
});

// Ruta para subir imagen de preguntas frecuentes
app.post(
  '/upload-imagen-pregunta', // Endpoint para subir la imagen
  multerUpload.single('file'), // Usamos multer para manejar la carga del archivo
  async (req, res) => {
    const { pregunta_id } = req.body; // Extraer pregunta_id de req.body
    const file = req.file; // Obtener el archivo subido

    // Verificar que el archivo haya sido cargado
    if (!file) {
      return res.status(400).json({ message: 'Archivo no proporcionado' });
    }

    console.log(`Tamaño del archivo recibido: ${file.size} bytes`);

    // Verificar que el pregunta_id esté presente
    if (!pregunta_id) {
      return res
        .status(400)
        .json({ message: 'El ID de la pregunta es requerido.' });
    }

    // Al guardar la imagen en el backend
    const imagePath = `uploads/agendas/${file.filename}`; // Ruta donde se guarda la imagen (en la carpeta 'agendas')
    const fileName = file.originalname; // Nombre original del archivo

    try {
      // Insertar los datos en la tabla imagenes_preguntas_frec
      await pool.query(
        'INSERT INTO imagenes_preguntas_frec (pregunta_id, nombre_archivo, ruta_archivo ) VALUES (?, ?, ?)',
        [pregunta_id, file.filename, imagePath] // Inserta pregunta_id en lugar de descripcion
      );

      // Responder con éxito
      res
        .status(200)
        .json({ message: 'Imagen subida y guardada correctamente.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al guardar la imagen.' });
    }
  }
);

// Ruta para descargar imagen por id de la imagen
app.get('/download-image-pregunta/:id', async (req, res) => {
  const { id } = req.params; // Obtener el id de la imagen desde los parámetros de la URL

  try {
    // Recupera el registro de la base de datos
    const imageRecord = await pool.query(
      'SELECT * FROM imagenes_preguntas_frec WHERE id = ?',
      [id]
    );

    console.log('Resultado de la consulta:', imageRecord);

    // Verifica si existe el registro de la imagen
    if (imageRecord[0].length === 0) {
      return res.status(404).json({ message: 'Imagen no encontrada.' });
    }

    // Accede a la ruta del archivo desde el registro
    const imagePath = imageRecord[0][0]?.ruta_archivo;
    console.log('Ruta de archivo:', imagePath);

    if (!imagePath) {
      return res.status(400).json({ message: 'Ruta de archivo inválida.' });
    }

    // Construye la ruta completa del archivo
    const filePath = join(CURRENT_DIR, imagePath); // Asegúrate de que 'uploads/agendas/' esté bien concatenado en la ruta
    console.log('Ruta completa del archivo:', filePath);

    // Verifica si el archivo existe en el servidor
    try {
      await fs.promises.access(filePath);
    } catch {
      return res
        .status(404)
        .json({ message: 'Archivo no encontrado en el servidor.' });
    }

    // Configura el tipo de contenido y descarga el archivo
    res.setHeader('Content-Type', 'application/octet-stream');
    res.download(filePath, (err) => {
      if (err) {
        console.error('Error al descargar el archivo:', err);
        res.status(500).json({ message: 'Error al descargar el archivo.' });
      }
    });
  } catch (error) {
    console.error('Error en el endpoint de descarga:', error);
    res.status(500).json({ message: 'Error al procesar la solicitud.' });
  }
});

app.delete('/asistencias_masivo', async (req, res) => {
  const { mes, anio } = req.query;

  if (!mes || !anio) {
    return res.status(400).json({ error: 'Mes y año son obligatorios' });
  }

  try {
    await AsistenciasModel.destroy({
      where: {
        mes,
        anio
      }
    });
    res.json({
      message: `Asistencias del mes ${mes} del año ${anio} eliminadas exitosamente`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para borrado masivo en agendas
app.delete('/agendas_masivo', async (req, res) => {
  const { mes, anio } = req.query;

  if (!mes || !anio) {
    return res.status(400).json({ error: 'Mes y año son obligatorios' });
  }

  try {
    await AgendasModel.destroy({
      where: {
        mes,
        anio
      }
    });
    res.json({
      message: `Agendas del mes ${mes} del año ${anio} eliminadas exitosamente`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const insertarAlumnosNuevos = async () => {
  try {
    // Consulta para obtener todos los alumnos con prospecto 'nuevo'
    const [alumnosNuevos] = await pool.execute(`
  SELECT id, nombre, fecha_creacion
  FROM alumnos
  WHERE prospecto = 'nuevo'
    AND mes = MONTH(CURDATE())
    AND anio = YEAR(CURDATE())
`);

    // Si no hay alumnos nuevos, no hacer nada
    if (alumnosNuevos.length === 0) {
      console.log(
        'No se encontraron alumnos nuevos para insertar en alumnos_nuevos.'
      );
      return;
    }

    for (const alumno of alumnosNuevos) {
      const { id, fecha_creacion } = alumno;

      // Verificar si el alumno ya existe en la tabla alumnos_nuevos
      const [existeAlumno] = await pool.execute(
        `
        SELECT COUNT(*) AS count
        FROM alumnos_nuevos
        WHERE idAlumno = ?
      `,
        [id]
      );

      if (existeAlumno[0].count > 0) {
        console.log(`El alumno ${id} ya existe en la tabla alumnos_nuevos.`);
        continue; // Salta la inserción si ya existe
      }

      // Convertir la fecha de creación a un objeto Date
      const fechaCreacionDate = new Date(fecha_creacion);
      const fechaActual = new Date();

      // Verificar si la fecha de creación ya alcanzó un mes de antigüedad
      const fechaUnMesDespues = new Date(fechaCreacionDate);
      fechaUnMesDespues.setMonth(fechaUnMesDespues.getMonth() + 1);

      // Si la fecha de creación es exactamente un mes antes de la fecha actual
      if (
        fechaUnMesDespues.getFullYear() === fechaActual.getFullYear() &&
        fechaUnMesDespues.getMonth() === fechaActual.getMonth() &&
        fechaUnMesDespues.getDate() === fechaActual.getDate()
      ) {
        console.log(
          `Alumno ${id} cumple con el mes exacto, insertando en alumnos_nuevos.`
        );

        // Calcular fecha de creación para la tabla alumnos_nuevos (el último día del mes anterior)
        const fechaCreacionNuevo = new Date(
          fechaUnMesDespues.getFullYear(),
          fechaUnMesDespues.getMonth(),
          30
        );

        // Calcular fecha de eliminación (un mes después de la fecha de creación de alumnos_nuevos)
        const fechaEliminacion = new Date(
          fechaUnMesDespues.getFullYear(),
          fechaUnMesDespues.getMonth() + 1,
          30
        );

        console.log(`Insertando alumno_id: ${id} en la tabla alumnos_nuevos`);

        // Insertar en alumnos_nuevos con marca true
        const [resultInsert] = await pool.execute(
          `INSERT INTO alumnos_nuevos (idAlumno, marca, fecha_creacion, fecha_eliminacion)
           VALUES (?, ?, ?, ?)`,
          [id, true, fechaCreacionNuevo, fechaEliminacion]
        );

        console.log(
          `Alumno ${id} insertado en alumnos_nuevos. Resultado:`,
          resultInsert
        );

        // **Actualizar el alumno a "socio" en la tabla alumnos**
        const [resultUpdate] = await pool.execute(
          `UPDATE alumnos 
           SET prospecto = 'socio', c = 'c', fecha_creacion = CURDATE()
           WHERE id = ? AND prospecto = 'nuevo'`,
          [id]
        );

        if (resultUpdate.affectedRows > 0) {
          console.log(`Alumno ${id} actualizado a socio en la tabla alumnos.`);
        } else {
          console.log(
            `No se pudo actualizar el alumno ${id}. Puede que ya no sea "nuevo".`
          );
        }
      } else {
        console.log(
          `El alumno ${id} no cumple con la condición de fecha (no ha pasado un mes exacto).`
        );
      }
    }

    console.log('Proceso de inserción de alumnos nuevos completado.');
  } catch (error) {
    console.error('Error insertando alumnos nuevos:', error);
  }
};

// Ejecutar la inserción de alumnos nuevos
cron.schedule('* * * * *', async () => {
  console.log('Ejecutando cron de inserción de alumnos nuevos...');
  await insertarAlumnosNuevos();
});

// Función para eliminar los registros con fecha_eliminacion vencida
const eliminarAlumnosNuevos = async () => {
  try {
    const today = moment().startOf('day').toDate();

    // Eliminar registros cuya fecha_eliminacion sea hoy o antes
    const [resultDelete] = await pool.execute(
      'DELETE FROM alumnos_nuevos WHERE fecha_eliminacion <= ?',
      [today]
    );

    console.log('Eliminación completada correctamente:', resultDelete);
  } catch (error) {
    console.error('Error en la tarea de eliminación:', error);
  }
};

// Ejecutar la eliminación de registros con fecha_eliminacion vencida cada minuto
cron.schedule('* * * * *', async () => {
  console.log('Ejecutando cron de eliminación de registros vencidos...');
  await eliminarAlumnosNuevos();
});

// Endpoint para obtener alumnos con marca = 1
app.get('/alumnos_nuevos', async (req, res) => {
  try {
    const [alumnosNuevos] = await pool.execute(
      `SELECT idAlumno, marca, fecha_creacion, fecha_eliminacion FROM alumnos_nuevos WHERE marca = 1`
    );
    res.json(alumnosNuevos); // Devolver los resultados como JSON
  } catch (error) {
    console.error('Error al obtener alumnos nuevos:', error);
    res.status(500).json({ message: 'Error al obtener alumnos nuevos' });
  }
});

// NUEVA FORMA DE SUBIR POSTULANTES
app.post('/postulantes_v2', multerUpload.single('cv'), async (req, res) => {
  try {
    const {
      name,
      email,
      celular,
      edad,
      puesto,
      sede,
      info,
      redes,
      observaciones = 'sin valoracion',
      state,
      sexo,
      estudios // 🔹 Nuevo campo
    } = req.body;

    const valoracion = req.body.valoracion || 0;

    let cv_url = null; // 🔹 Asegurar que sea null por defecto

    // Si se sube un archivo, procesarlo
    if (req.file) {
      const allowedImageTypes = ['image/jpeg', 'image/png'];
      if (allowedImageTypes.includes(req.file.mimetype)) {
        const compressedPath = path.join(
          __dirname,
          'uploads/agendas',
          `compressed_${req.file.filename}`
        );

        // Reducimos la calidad de la imagen manualmente con fs (sin sharp)
        fs.rename(req.file.path, compressedPath, (err) => {
          if (err) console.error('Error al comprimir imagen:', err);
        });

        cv_url = `uploads/agendas/compressed_${req.file.filename}`;
      } else {
        cv_url = `uploads/agendas/${req.file.filename}`;
      }
    }

    // 🔹 Respuesta rápida al cliente sin esperar la inserción en BD
    res.status(202).json({
      message: 'Postulante registrado, procesando en segundo plano...'
    });

    // 🔹 Inserción en la BD de forma asíncrona con mejor manejo de errores
    try {
      await PostulanteV2Model.create({
        name,
        email,
        celular,
        edad,
        puesto,
        sede,
        info,
        redes,
        observaciones,
        valoracion,
        state,
        sexo,
        estudios, // 🔹 Nuevo campo
        cv_url
      });
    } catch (dbError) {
      console.error('Error al guardar en BD:', dbError);
    }
  } catch (error) {
    console.error('Error en el servidor:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para obtener todos los postulantes
app.get('/postulantes_v2', async (req, res) => {
  try {
    const postulantes = await PostulanteV2Model.findAll({
      attributes: [
        'id',
        'name',
        'email',
        'celular',
        'edad',
        'puesto',
        'sede',
        'info',
        'redes',
        'observaciones',
        'valoracion',
        'state',
        'sexo',
        'estudios',
        'cv_url',
        'created_at',
        'updated_at'
      ]
    });

    if (!postulantes) {
      return res.status(404).json({ error: 'No se encontraron postulantes' });
    }

    res.json(postulantes); // Devolver todos los postulantes
  } catch (error) {
    console.error('Error al obtener los postulantes:', error);
    res
      .status(500)
      .json({ error: 'Hubo un problema al obtener los postulantes' });
  }
});

// Ruta para descargar el CV del postulante
app.get('/postulantes_v2/:id/cv', async (req, res) => {
  const { id } = req.params;

  try {
    const postulante = await PostulanteV2Model.findOne({
      where: { id },
      attributes: ['cv_url']
    });

    // Verificamos si el postulante tiene un CV
    if (!postulante || !postulante.cv_url) {
      return res.status(404).json({ error: 'CV no encontrado' });
    }

    const cvPath = path.join(__dirname, postulante.cv_url);
    console.log('Ruta del CV:', cvPath);

    // Verificamos si el archivo existe
    if (fs.existsSync(cvPath)) {
      // Determinamos el tipo de archivo
      const fileExtension = path.extname(cvPath).toLowerCase();
      let contentType = 'application/octet-stream'; // Tipo genérico

      if (fileExtension === '.pdf') {
        contentType = 'application/pdf';
      } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
        contentType = 'image/jpeg';
      } else if (fileExtension === '.png') {
        contentType = 'image/png';
      }

      // Establecemos los encabezados de respuesta
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${path.basename(cvPath)}`
      );

      // Enviamos el archivo al cliente
      fs.createReadStream(cvPath).pipe(res);
    } else {
      return res
        .status(404)
        .json({ error: 'El archivo no existe en el servidor' });
    }
  } catch (error) {
    console.error('Error al obtener el CV:', error);
    res.status(500).json({ error: 'Hubo un problema al obtener el CV' });
  }
});

app.get('/postulantes_v2/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar postulante por ID
    const postulante = await PostulanteV2Model.findByPk(id);

    // Si no existe, devolver error
    if (!postulante) {
      return res.status(404).json({ message: 'Postulante no encontrado' });
    }

    // Devolver el postulante encontrado
    res.status(200).json(postulante);
  } catch (error) {
    console.error('Error al obtener el postulante:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.put('/postulantes_v2/:id', multerUpload.single('cv'), async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar el postulante en la BD
    const postulante = await PostulanteV2Model.findByPk(id);
    if (!postulante) {
      return res.status(404).json({ message: 'Postulante no encontrado' });
    }

    // Extraer los datos del cuerpo
    const {
      name,
      email,
      celular,
      edad,
      puesto,
      sede,
      info,
      redes,
      observaciones,
      valoracion,
      state,
      sexo,
      estudios // Nuevo campo agregado
    } = req.body;

    let cv_url = postulante.cv_url; // Mantener el CV actual si no se sube uno nuevo

    // Si se sube un nuevo archivo, actualizar la URL
    if (req.file) {
      cv_url = `uploads/agendas/${req.file.filename}`;
    }

    // Actualizar el postulante en la BD
    await postulante.update({
      name,
      email,
      celular,
      edad,
      puesto,
      sede,
      info,
      redes,
      observaciones,
      valoracion,
      state,
      sexo,
      estudios, // Guardamos el nuevo campo
      cv_url
    });

    res
      .status(200)
      .json({ message: 'Postulante actualizado correctamente', postulante });
  } catch (error) {
    console.error('Error al actualizar el postulante:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Endpoint DELETE para eliminar un postulante
app.delete('/postulantes_v2/:id', async (req, res) => {
  const { id } = req.params; // Recibe el ID desde la URL

  try {
    // Eliminar el postulante de la base de datos
    const postulante = await PostulanteV2Model.destroy({
      where: { id: id }
    });

    if (postulante) {
      return res
        .status(200)
        .json({ message: 'Postulante eliminado correctamente.' });
    } else {
      return res.status(404).json({ error: 'Postulante no encontrado.' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al eliminar el postulante.' });
  }
});

/**
 * Cierra el mes anterior bloqueando las agendas de ese período.
 */
const cerrarMesAnterior = async () => {
  try {
    const now = new Date();
    const mesActual = now.getMonth() + 1; // Mes actual (1-12)
    const anioActual = now.getFullYear();

    // El mes a cerrar es siempre el mes anterior al actual
    let mesCierre = mesActual - 1;
    let anioCierre = anioActual;

    // Si estamos en enero, el mes anterior es diciembre del año anterior
    if (mesCierre === 0) {
      mesCierre = 12;
      anioCierre -= 1;
    }

    console.log(`🔒 Cerrando mes ${mesCierre}/${anioCierre}...`);

    // Verificar si ya existe un registro con el mes y año a cerrar
    const existeCierre = await PlanillasCerradasModel.findOne({
      where: { mes: mesCierre, anio: anioCierre }
    });

    if (existeCierre) {
      console.log(
        `⚠️ Ya existe un registro de cierre para ${mesCierre}/${anioCierre}. No se inserta.`
      );
      return; // No hacer nada si ya existe el registro
    }

    // Registrar el cierre en `planillas_cerradas` si no existe un registro
    await PlanillasCerradasModel.create({
      mes: mesCierre,
      anio: anioCierre,
      fecha_cierre: now // Fecha actual de cierre
    });

    console.log(
      `📝 Registro agregado en planillas_cerradas para ${mesCierre}/${anioCierre}`
    );
  } catch (error) {
    console.error('❌ Error al cerrar el mes anterior:', error);
  }
};

// Función para copiar los alumnos que tienen asistencias después del 20 del mes anterior y estado "P"
const copiarAlumnosMesAnterior = async () => {
  console.log('Ejecutando copiar alumnos');

  // Obtener el mes y año actual y el anterior
  const { mesActual, anioActual, mesAnterior, anioAnterior } =
    getMesYAnioActual();
  console.log(`Mes Actual: ${mesActual}, Año Actual: ${anioActual}`);
  console.log(`Mes Anterior: ${mesAnterior}, Año Anterior: ${anioAnterior}`);

  // Filtrar las asistencias del mes anterior con día superior a 20 y estado "P"
  const asistenciasMesAnterior = await AsistenciasModel.findAll({
    where: {
      mes: mesAnterior,
      anio: anioAnterior,
      dia: { [Sequelize.Op.gte]: 20 }, // Día mayor o igual a 20
      estado: 'P' // Solo asistencias con estado "P"
    }
  });

  console.log(
    `Asistencias del mes ${mesAnterior}-${anioAnterior} después del día 20 con estado "P":`
  );
  console.log(asistenciasMesAnterior);

  // Extraer los IDs de los alumnos que tienen asistencias después del 20 con estado "P"
  const alumnosAcopiar = [
    ...new Set(asistenciasMesAnterior.map((asistencia) => asistencia.alumno_id))
  ];
  console.log('Alumnos a copiar:', alumnosAcopiar);

  // Verificar que no se copien alumnos que ya existan en el mes actual
  for (const alumnoId of alumnosAcopiar) {
    console.log(`Verificando existencia del alumno con ID: ${alumnoId}`);

    const alumno = await AlumnosModel.findOne({
      where: { id: alumnoId }
    });

    if (alumno) {
      console.log(`Alumno encontrado: ${alumno.nombre}`);

      // Verificar si el alumno ya existe en el mes actual (marzo)
      const existeAlumnoEnMesActual = await AlumnosModel.findOne({
        where: {
          id: alumnoId,
          mes: mesActual,
          anio: anioActual
        }
      });

      if (!existeAlumnoEnMesActual) {
        // Verificar si el alumno ya es socio en el mes anterior
        const alumnoSocioEnMesAnterior = await AlumnosModel.findOne({
          where: {
            id: alumnoId,
            mes: mesAnterior, // Verificar en el mes anterior
            anio: anioAnterior, // Año anterior
            prospecto: 'socio' // Verificar si ya es socio
          }
        });

        // Si es socio o nuevo, copiar y marcarlo como socio
        const { id, ...alumnoSinId } = alumno.dataValues;

        // Crear nuevo registro del alumno para el mes actual
        await AlumnosModel.create({
          ...alumnoSinId, // Copiar todos los valores del alumno, excepto el id
          mes: mesActual, // Nuevo mes
          anio: anioActual, // Nuevo año
          prospecto: 'socio'
        });

        console.log(
          `Alumno ${alumno.nombre} copiado al mes ${mesActual}-${anioActual} y marcado como socio`
        );
      } else {
        console.log(
          `El alumno ${alumno.nombre} ya existe en el mes ${mesActual}-${anioActual}`
        );
      }
    } else {
      console.log(`No se encontró el alumno con ID: ${alumnoId}`);
    }
  }
};

const eliminarDuplicados = async () => {
  console.log('🔍 Eliminando alumnos duplicados...');

  // Eliminar duplicados utilizando pool.query
  await pool.query(`
    DELETE a
    FROM alumnos a
    JOIN (
      SELECT nombre, mes, MAX(id) as id_max
      FROM alumnos
      GROUP BY nombre, mes
    ) AS b ON a.nombre = b.nombre AND a.mes = b.mes
    WHERE a.id < b.id_max;
  `);

  console.log('✅ Duplicados eliminados correctamente.');
};

// Programar la tarea para que se ejecute el día 1 de cada mes a las 00:05
cron.schedule('5 0 1 * *', async () => {
  console.log('📅 Es 1° del mes - Ejecutando cierre del mes anterior...');
  await cerrarMesAnterior();
  await copiarAlumnosMesAnterior(); // Copiar los alumnos con asistencias después del 20 del mes anterior
  await eliminarDuplicados();
});

// const test = async () => {
//   console.log('🔍 Ejecutando prueba de cierre de mes...');
//   await cerrarMesAnterior();
//   await copiarAlumnosMesAnterior(); // Copiar los alumnos con asistencias después del 20 del mes anterior
//   await eliminarDuplicados();

//   console.log('✅ Prueba finalizada.');
// };

// test();

// Endpoint para obtener todas las notificaciones con consulta SQL directa
app.get('/notifications/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  console.log('User ID recibido:', userId);

  try {
    // Solo notificaciones tipo "Nueva novedad registrada" asignadas al usuario
    const notifications = await db.query(
      `
      SELECT n.*, nu_user.leido
      FROM notifications n
      LEFT JOIN notifications_users nu_user 
        ON n.id = nu_user.notification_id AND nu_user.user_id = :userId
      LEFT JOIN novedades nov ON n.reference_id = nov.id
      LEFT JOIN novedad_user nu ON nov.id = nu.novedad_id AND nu.user_id = :userId
      WHERE 
        (
          n.title = 'Nueva novedad registrada' AND nu.user_id IS NOT NULL
        )
        OR
        (
          n.title IN ('Nueva queja registrada', 'Nueva pregunta frecuente registrada', 'Nueva clase de prueba registrada')
        )
      ORDER BY n.created_at DESC
      `,
      {
        replacements: { userId },
        type: db.Sequelize.QueryTypes.SELECT
      }
    );

    // Si no hay notificaciones asignadas, devolver vacío
    if (notifications.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error al obtener las notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Endpoint para obtener una notificación por ID con consulta SQL directa
app.get('/notifications/:id', async (req, res) => {
  const notificationId = req.params.id;

  try {
    const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [
      notificationId
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ mensajeError: 'No se encontró la notificación.' });
    }

    res.json(rows[0]); // Devolvemos solo el primer resultado
  } catch (error) {
    console.error('Error al obtener la notificación:', error);
    res
      .status(500)
      .json({ mensajeError: 'Hubo un error al obtener la notificación.' });
  }
});

app.get('/logs', async (req, res) => {
  const { user_id, desde, hasta, alumno } = req.query;
  let sql = `
    SELECT l.*, 
      u.name AS nombre_usuario, 
      a.nombre AS nombre_alumno
    FROM alumnos_log l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN alumnos a ON l.alumno_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (user_id) {
    sql += ' AND l.user_id = ?';
    params.push(user_id);
  }
  if (desde) {
    sql += ' AND l.fecha_evento >= ?';
    params.push(desde);
  }
  if (hasta) {
    sql += ' AND l.fecha_evento <= ?';
    params.push(hasta + ' 23:59:59');
  }
  if (alumno) {
    sql += ` AND (
      a.nombre LIKE ? 
      OR JSON_UNQUOTE(JSON_EXTRACT(l.datos_antes, '$.nombre')) LIKE ?
    )`;
    params.push('%' + alumno + '%');
    params.push('%' + alumno + '%');
  }

  // Dentro del WHERE, después de los filtros
  sql += ` AND NOT EXISTS (
  SELECT 1 FROM alumnos a2 
  WHERE 
    a2.nombre = JSON_UNQUOTE(JSON_EXTRACT(l.datos_antes, '$.nombre'))
    AND a2.email = JSON_UNQUOTE(JSON_EXTRACT(l.datos_antes, '$.email'))
    AND a2.user_id = JSON_UNQUOTE(JSON_EXTRACT(l.datos_antes, '$.user_id'))
)`;

  try {
    const [logs] = await pool.query(sql, params);
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

app.post('/logs/:logId/recuperar', async (req, res) => {
  const { logId } = req.params;
  let { user_id, email } = req.body;
  user_id = Number(user_id);
  if (!user_id || isNaN(user_id)) {
    return res
      .status(400)
      .json({ error: 'user_id no válido para recuperar alumno' });
  }

  try {
    const [logs] = await pool.query('SELECT * FROM alumnos_log WHERE id = ?', [
      logId
    ]);
    const log = logs[0];
    if (!log || !log.datos_antes) {
      return res.status(404).json({ error: 'Log no encontrado o inválido' });
    }
    const datosAntes =
      typeof log.datos_antes === 'string'
        ? JSON.parse(log.datos_antes)
        : log.datos_antes;

    // --- VERIFICAR EXISTENCIA ---
    const [alumnosExist] = await pool.query(
      'SELECT * FROM alumnos WHERE nombre = ? AND user_id = ? AND email = ?',
      [datosAntes.nombre, user_id, email || datosAntes.email]
    );
    if (alumnosExist.length > 0) {
      return res.status(409).json({
        error: 'El alumno ya existe y no puede ser recuperado de nuevo.'
      });
    }

    // --- INSERTAR ALUMNO ---
    const nuevoAlumno = {
      ...datosAntes,
      user_id: user_id,
      email: email || datosAntes.email,
      mes: dayjs().month() + 1,
      anio: dayjs().year(),
      fecha_creacion: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
    delete nuevoAlumno.id;

    await AlumnosModel.create(nuevoAlumno);

    res.json({ ok: true, alumno: nuevoAlumno });
  } catch (err) {
    console.error('Error al recuperar alumno:', err);
    res.status(500).json({ error: 'Error al recuperar alumno' });
  }
});

// Endpoint para marcar una notificación como leída
app.post('/notifications/markAsRead', async (req, res) => {
  console.log(req.body); // Verifica si el user_id y notification_id están llegando correctamente
  const { notification_id, user_id } = req.body;

  try {
    // Verificamos si la relación entre la notificación y el usuario existe
    const [rows] = await db.query(
      'SELECT * FROM notifications_users WHERE notification_id = :notification_id AND user_id = :user_id',
      {
        replacements: { notification_id, user_id }
      }
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ mensajeError: 'Notificación no encontrada para este usuario' });
    }

    // Actualizamos el estado de la notificación a leída (leido = 1)
    await db.query(
      'UPDATE notifications_users SET leido = 1 WHERE notification_id = :notification_id AND user_id = :user_id',
      {
        replacements: { notification_id, user_id }
      }
    );

    // Respondemos con un mensaje de éxito
    res.json({
      message: 'Notificación marcada como leída correctamente'
    });
  } catch (error) {
    console.error('Error al marcar la notificación como leída:', error);
    res.status(500).json({
      mensajeError: 'Hubo un error al marcar la notificación como leída.'
    });
  }
});

async function deleteOldNotifications() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = await NotificationModel.destroy({
      where: {
        created_at: {
          [Op.lte]: oneWeekAgo
        }
      }
    });

    console.log(`${result} notificaciones eliminadas.`);
  } catch (error) {
    console.error('Error eliminando notificaciones:', error);
  }
}

app.post('/actualizar-mes', async (req, res) => {
  try {
    const { id, mesBusqueda } = req.body;
    const mesActual = new Date().getMonth() + 1;
    const anioActual = new Date().getFullYear();

    if (mesBusqueda === mesActual) {
      return res
        .status(400)
        .json({ msg: 'El mes a buscar no puede ser igual al mes actual' });
    }

    const registro = await AlumnosModel.findOne({
      where: { id, mes: mesBusqueda }
    });

    if (!registro) {
      return res.status(404).json({
        msg: `No se encontró registro con id ${id} y mes ${mesBusqueda}`
      });
    }

    const existeMesActual = await AlumnosModel.findOne({
      where: {
        id,
        mes: mesActual,
        anio: anioActual
      }
    });

    if (existeMesActual) {
      return res.status(200).json({
        msg: 'Ya existe registro con ese ID en el mes actual, no se actualizó'
      });
    }

    registro.mes = mesActual;
    registro.anio = anioActual;
    await registro.save();

    res
      .status(200)
      .json({ msg: 'Registro actualizado correctamente', registro });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error en el servidor', error: error.message });
  }
});

// Cron: ejecuta cada día a las 00:10
cron.schedule('10 0 * * *', () => {
  console.log('Cron job iniciado - eliminando notificaciones viejas...');
  deleteOldNotifications();
});

function cleanFileName(filename) {
  // Elimina acentos y caracteres especiales, reemplaza espacios por "_"
  return filename
    .normalize('NFD') // Separa acentos de las letras
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
    .replace(/[^a-zA-Z0-9. \-_]/g, '') // Elimina caracteres raros (menos ".", "-", "_", espacio)
    .replace(/\s+/g, '_'); // Espacios a "_"
}

app.post(
  '/upload-dashboard-image',
  multerUpload.single('file'),
  async (req, res) => {
    const { titulo, descripcion, orden } = req.body;
    let file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Archivo no proporcionado' });
    }

    // --- LIMPIEZA DE NOMBRE ---
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const safeBase = cleanFileName(base);
    const uniqueName = `${safeBase}-${Date.now()}${ext}`;
    const finalPath = path.join('uploads', uniqueName);

    // Mover/renombrar el archivo (si el nombre cambia)
    await fs.promises.rename(file.path, finalPath);

    try {
      // Insertá en la tabla
      await pool.query(
        `INSERT INTO imagenes_dashboard (titulo, descripcion, url, orden, activo) VALUES (?, ?, ?, ?, 1)`,
        [
          titulo || null,
          descripcion || null,
          `uploads/${uniqueName}`,
          orden || 1
        ]
      );

      res.status(200).json({
        message: 'Imagen de dashboard subida y guardada correctamente.',
        url: `uploads/${uniqueName}`,
        nombre: uniqueName
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al guardar la imagen.' });
    }
  }
);

app.get('/dashboard-images', async (req, res) => {
  try {
    const [imagenes] = await pool.query(
      'SELECT * FROM imagenes_dashboard WHERE activo = 1 ORDER BY orden ASC, id ASC'
    );
    res.json(imagenes);
  } catch (e) {
    res.status(500).json({ error: 'Error trayendo imágenes' });
  }
});

app.delete('/dashboard-images/:id', async (req, res) => {
  try {
    await pool.query('UPDATE imagenes_dashboard SET activo = 0 WHERE id = ?', [
      req.params.id
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error eliminando imagen' });
  }
});

app.get('/stats-ventas', async (req, res) => {
  try {
    const { sede } = req.query;
    let whereSede = '';
    let paramsSede = [];

    // Normaliza la sede: "barrio sur" => "barriosur", etc.
    if (sede) {
      whereSede = 'WHERE LOWER(REPLACE(sede, " ", "")) = ?';
      paramsSede = [sede.toLowerCase().replace(/\s/g, '')];
    }

    // 1. Total de ventas
    const [[{ total_ventas }]] = await pool.query(
      `SELECT COUNT(*) AS total_ventas FROM ventas_prospectos ${whereSede}`,
      paramsSede
    );

    // 2. Prospectos
    const [prospectos] = await pool.query(
      `SELECT tipo_prospecto AS tipo, COUNT(*) AS cantidad
       FROM ventas_prospectos ${whereSede}
       GROUP BY tipo_prospecto`,
      paramsSede
    );

    // 3. Canales
    const [canales] = await pool.query(
      `SELECT canal_contacto AS canal, COUNT(*) AS cantidad
       FROM ventas_prospectos ${whereSede}
       GROUP BY canal_contacto`,
      paramsSede
    );

    // 4. Actividades
    const [actividades] = await pool.query(
      `SELECT actividad, COUNT(*) AS cantidad
       FROM ventas_prospectos ${whereSede}
       GROUP BY actividad`,
      paramsSede
    );

    // 5. Contactos (SUM)
    const [[contactos]] = await pool.query(
      `SELECT
        SUM(n_contacto_1) AS total_contacto_1,
        SUM(n_contacto_2) AS total_contacto_2,
        SUM(n_contacto_3) AS total_contacto_3
       FROM ventas_prospectos ${whereSede}`,
      paramsSede
    );

    // 6. Total clases de prueba (sumando todas)
    const [[{ total_clases_prueba }]] = await pool.query(
      `SELECT
        SUM(CASE WHEN clase_prueba_1_fecha IS NOT NULL THEN 1 ELSE 0 END) +
        SUM(CASE WHEN clase_prueba_2_fecha IS NOT NULL THEN 1 ELSE 0 END) +
        SUM(CASE WHEN clase_prueba_3_fecha IS NOT NULL THEN 1 ELSE 0 END)
        AS total_clases_prueba
       FROM ventas_prospectos ${whereSede}`,
      paramsSede
    );

    // 7. Convertidos
    const convertidosQuery = `
      SELECT COUNT(*) AS total_convertidos
      FROM ventas_prospectos
      ${
        sede
          ? 'WHERE LOWER(REPLACE(sede, " ", "")) = ? AND (convertido = 1 OR convertido = true)'
          : 'WHERE convertido = 1 OR convertido = true'
      }
    `;
    const [[{ total_convertidos }]] = await pool.query(
      convertidosQuery,
      paramsSede
    );

    res.json({
      total_ventas,
      prospectos,
      canales,
      actividades,
      contactos,
      total_clases_prueba,
      total_convertidos
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});


export async function generarAgendasAutomaticas() {
  // Día de hoy
  const today = new Date().toISOString().slice(0, 10);

  // 1. Seguimiento: ventas creadas hace 7 días
  const [prospectos] = await pool.query(`
    SELECT * FROM ventas_prospectos
    WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  `);

  for (const p of prospectos) {
    const [yaTiene] = await pool.query(
      "SELECT 1 FROM agendas_ventas WHERE prospecto_id=? AND tipo='seguimiento'",
      [p.id]
    );
    if (!yaTiene.length) {
      await pool.query(
        `INSERT INTO agendas_ventas (prospecto_id, usuario_id, fecha_agenda, tipo, descripcion)
         VALUES (?, ?, ?, 'seguimiento', ?)`,
        [p.id, p.usuario_id, today, 'Recordatorio: 2do contacto automático']
      );
    }
  }

  // 2. Clase de prueba (solo si tiene fecha)
  const [conClasePrueba] = await pool.query(`
    SELECT * FROM ventas_prospectos 
    WHERE clase_prueba_1_fecha IS NOT NULL
  `);

  for (const p of conClasePrueba) {
    const fechaClase =
      p.clase_prueba_1_fecha?.toISOString?.().slice(0, 10) ||
      (typeof p.clase_prueba_1_fecha === 'string'
        ? p.clase_prueba_1_fecha.slice(0, 10)
        : null);
    if (!fechaClase) continue;
    const [yaTiene] = await pool.query(
      "SELECT 1 FROM agendas_ventas WHERE prospecto_id=? AND tipo='clase_prueba' AND fecha_agenda=?",
      [p.id, fechaClase]
    );
    if (!yaTiene.length) {
      await pool.query(
        `INSERT INTO agendas_ventas (prospecto_id, usuario_id, fecha_agenda, tipo, descripcion)
         VALUES (?, ?, ?, 'clase_prueba', ?)`,
        [
          p.id,
          p.usuario_id,
          fechaClase,
          'Recordatorio: día de la clase de prueba'
        ]
      );
    }
  }
}

cron.schedule('10 0 * * *', async () => {
  console.log('[CRON] Generando agendas automáticas...');
  try {
    await generarAgendasAutomaticas();
    console.log('[CRON] Agendas generadas OK');
  } catch (err) {
    console.error('[CRON] Error:', err);
  }
});

// Endpoint para traer agendas con filtro por usuario_id (y fácilmente extensible)
app.get('/agendas-ventas', async (req, res) => {
  try {
    const { usuario_id, desde, hasta, solo_pendientes } = req.query;
    let sql = `
      SELECT 
        a.*, 
        v.nombre AS prospecto_nombre, 
        v.sede,
        v.asesor_nombre
      FROM agendas_ventas a
      LEFT JOIN ventas_prospectos v ON a.prospecto_id = v.id
      WHERE 1=1
    `;
    const params = [];

    if (usuario_id) {
      sql += ' AND a.usuario_id = ?';
      params.push(usuario_id);
    }
    if (desde) {
      sql += ' AND a.fecha_agenda >= ?';
      params.push(desde);
    }
    if (hasta) {
      sql += ' AND a.fecha_agenda <= ?';
      params.push(hasta);
    }
    if (solo_pendientes === '1') {
      sql += ' AND a.resuelta = 0';
    }

    sql += ' ORDER BY a.fecha_agenda DESC, a.id DESC';

    const [agendas] = await pool.query(sql, params);
    res.json(agendas);
  } catch (error) {
    console.error('Error al traer agendas:', error);
    res.status(500).json({ error: 'Error al traer agendas de ventas' });
  }
});

app.put('/agendas-ventas/:id', async (req, res) => {
  const { id } = req.params;
  const { nota_envio } = req.body;

  if (!nota_envio) {
    return res.status(400).json({ error: 'Falta la nota de envío' });
  }

  try {
    const sql = `
      UPDATE agendas_ventas
      SET enviada = 1,
          fecha_envio = NOW(),
          nota_envio = ?
      WHERE id = ?
    `;
    const [result] = await pool.query(sql, [nota_envio, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Agenda no encontrada' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar agenda:', error);
    res.status(500).json({ error: 'Error al actualizar la agenda de ventas' });
  }
});

app.delete('/agendas-ventas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'DELETE FROM agendas_ventas WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Agenda no encontrada' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar agenda:', error);
    res.status(500).json({ error: 'Error al eliminar agenda de ventas' });
  }
});

// app.use('/public', express.static(join(CURRENT_DIR, '../uploads')));
app.use('/public', express.static(join(CURRENT_DIR, 'uploads')));

// Servir imágenes estáticas desde la carpeta 'uploads/agendas'
app.use(
  '/agendas-images-ver',
  express.static(join(CURRENT_DIR, 'uploads', 'agendas'))
);

app.use(
  '/imagenes-preguntas',
  express.static(join(CURRENT_DIR, 'uploads', 'agendas'))
);

if (!PORT) {
  console.error('El puerto no está definido en el archivo de configuración.');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
  process.exit(1); // Opcional: reiniciar la aplicación
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no capturada:', promise, 'razón:', reason);
  process.exit(1); // Opcional: reiniciar la aplicación
});
