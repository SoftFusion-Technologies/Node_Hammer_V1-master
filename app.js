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
import { AsistenciasModel } from './Models/MD_TB_Asistencias.js';
import moment from 'moment-timezone';

import { login, authenticateToken } from './Security/auth.js'; // Importa las funciones del archivo auth.js

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
    fileSize: 30000000 // Tamaño máximo del archivo (30 MB)
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

    const imagePath = `uploads/${req.file.filename}`;
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

    // Construir la ruta relativa a la carpeta "uploads"
    const imagePath = join(
      CURRENT_DIR,
      'uploads',
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

    const imagePath = `uploads/${req.file.filename}`;
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

    const filePath = `uploads/${req.file.filename}`;

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

// Función para obtener el día de asistencia actual para cada alumno
const obtenerDiaAsistenciaAlumno = async (alumnoId) => {
  const ultimaAsistencia = await AsistenciasModel.findOne({
    where: { alumno_id: alumnoId },
    order: [['dia', 'DESC']]
  });
  return ultimaAsistencia ? ultimaAsistencia.dia + 1 : 1; // Si no hay asistencia, empieza en el día 1
};

// Función para crear asistencias automáticas
const crearAsistenciasAutomáticas = async () => {
  try {
    // 1. Obtener todos los alumnos
    const alumnos = await AlumnosModel.findAll();

    // 2. Crear una asistencia con estado "A" para cada alumno
    const asistencias = await Promise.all(
      alumnos.map(async (alumno) => {
        const diaAsistencia = await obtenerDiaAsistenciaAlumno(alumno.id);
        return {
          alumno_id: alumno.id,
          dia: diaAsistencia,
          estado: 'A'
        };
      })
    );

    // Insertar todas las asistencias de una vez
    await AsistenciasModel.bulkCreate(asistencias); // Inserta todas las asistencias al mismo tiempo

    console.log('Asistencias creadas con éxito para todos los alumnos.');
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
    const fechaAyer = new Date(hoy);
    fechaAyer.setDate(hoy.getDate() - 1);
    const fechaAyerISO = fechaAyer.toISOString().split('T')[0];
    console.log(`Fecha de ayer en formato ISO: ${fechaAyerISO}`);

    // obtenemos los alumnos creados el día anterior y que no sean de prospecto = 'socio'
    const [alumnos] = await pool.execute(
      `SELECT id FROM alumnos 
       WHERE DATE(fecha_creacion) = ? 
       AND prospecto IN ('nuevo', 'prospecto')`,
      [fechaAyerISO]
    );

    for (const alumno of alumnos) {
      // Verificamos si ya existe la alerta para este alumno y agenda_num = 1
      const [alertasExistentes] = await pool.execute(
        `SELECT id FROM agendas WHERE alumno_id = ? AND agenda_num = 1`,
        [alumno.id]
      );

      if (alertasExistentes.length === 0) {
        // Si no existe, insertamos la nueva alerta
        console.log(`Insertando alerta para alumno_id: ${alumno.id}`);
        await pool.execute(
          `INSERT INTO agendas (alumno_id, agenda_num, contenido)
                     VALUES (?, 1, 'PENDIENTE')`,
          [alumno.id]
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

// genAlertAgendN1(); // se comenta esto, en produccion funciona, para desarrollo se descomenta
// Configura el cron job para ejecutarse de lunes a viernes

cron.schedule('0 0 * * *', async () => {
  console.log('Ejecutando cron de alertas...');
  await genAlertAgendN1();
});

// Función para generar alertas en la tabla 'agendas' para la 3ra semana celda 2
const genAlertAgendN3 = async () => {
  try {
    const hoy = new Date();
    const fechaTresSemanas = new Date(hoy);
    fechaTresSemanas.setDate(hoy.getDate() - 21); // Tres semanas atrás
    const fechaTresSemanasISO = fechaTresSemanas.toISOString().split('T')[0];
    console.log(
      `Fecha de hace tres semanas en formato ISO: ${fechaTresSemanasISO}`
    );

    // obtenemos los alumnos creados el día anterior y que no sean de prospecto = 'socio'
    const [alumnos] = await pool.execute(
      `SELECT id FROM alumnos 
       WHERE DATE(fecha_creacion) = ? 
       AND prospecto IN ('nuevo', 'prospecto')`,
      [fechaAyerISO]
    );

    for (const alumno of alumnos) {
      // Verificamos si ya existe la alerta para este alumno y agenda_num = 2
      const [alertasExistentes] = await pool.execute(
        `SELECT id FROM agendas WHERE alumno_id = ? AND agenda_num = 2`,
        [alumno.id]
      );

      if (alertasExistentes.length === 0) {
        // Si no existe, inserta la nueva alerta
        console.log(`Insertando alerta para alumno_id: ${alumno.id}`);
        await pool.execute(
          `INSERT INTO agendas (alumno_id, agenda_num, contenido)
                     VALUES (?, 2, 'PENDIENTE')`,
          [alumno.id]
        );
      } else {
        console.log(
          `Alerta ya existente para alumno_id: ${alumno.id}, no se crea duplicado.`
        );
      }
    }

    console.log(
      `Proceso de generación de alertas de la 3ra semana completado.`
    );
  } catch (error) {
    console.error('Error generando alertas de la 3ra semana:', error);
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
    console.log(`Fecha de hoy: ${fechaHoyISO}`);

    // Obtener los alumnos que son prospectos
    const [alumnosProspecto] = await pool.execute(
      `SELECT id, fecha_creacion, prospecto FROM alumnos WHERE prospecto = 'prospecto'`
    );

    console.log(`Alumnos prospecto encontrados:`, alumnosProspecto); // Verificamos los alumnos encontrados

    // Si no hay prospectos, no hacer nada
    if (alumnosProspecto.length === 0) {
      console.log('No se encontraron alumnos prospecto.');
      return;
    }

    // Itera sobre los alumnos prospecto
    for (const alumno of alumnosProspecto) {
      // Calculamos el día siguiente a la fecha de creación del alumno
      const fechaCreacion = new Date(alumno.fecha_creacion);
      const fechaSiguiente = new Date(fechaCreacion);
      fechaSiguiente.setDate(fechaCreacion.getDate() + 1); // Día siguiente
      const fechaSiguienteISO = fechaSiguiente.toISOString().split('T')[0]; // Solo la fecha (sin hora)

      console.log(
        `Fecha siguiente para alumno_id ${alumno.id}: ${fechaSiguienteISO}`
      );

      // Verificamos si la fecha siguiente es igual a hoy
      if (fechaSiguienteISO === fechaHoyISO) {
        console.log(
          `Generando alerta para alumno_id ${alumno.id} en la agenda 3`
        );

        // Verifica si ya existe la agenda con agenda_num = 3 para este alumno
        const [alertasExistentes] = await pool.execute(
          `SELECT id FROM agendas WHERE alumno_id = ? AND agenda_num = 3`,
          [alumno.id]
        );

        console.log(
          `Alertas existentes para alumno_id ${alumno.id}:`,
          alertasExistentes
        );

        if (alertasExistentes.length > 0) {
          // Si existe, actualiza el contenido de la agenda
          console.log(
            `Actualizando alerta para agenda_num 3 para alumno_id: ${alumno.id}`
          );

          const [result] = await pool.execute(
            `UPDATE agendas SET contenido = 'PENDIENTE' WHERE alumno_id = ? AND agenda_num = 3`,
            [alumno.id]
          );

          console.log(`Resultado de la actualización:`, result);
        } else {
          // Si no existe, inserta la nueva alerta para la agenda 3
          console.log(
            `Insertando alerta para agenda_num 3 para alumno_id: ${alumno.id}`
          );

          const [result] = await pool.execute(
            `INSERT INTO agendas (alumno_id, agenda_num, contenido) VALUES (?, 3, 'PENDIENTE')`,
            [alumno.id]
          );

          console.log(`Resultado de la inserción:`, result);
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

// Función para generar alertas de inactivos (sin asistencia en 5 días)
const genAlertInactivos = async () => {
  try {
    const hoy = new Date();
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(hoy.getDate() - 5); // 5 días atrás
    const fechaLimiteISO = fechaLimite.toISOString().split('T')[0];
    console.log(`Fecha límite para inactivos: ${fechaLimiteISO}`);

    // Obtén los alumnos que tienen 5 días consecutivos con estado 'A'
    const [alumnos] = await pool.execute(
      `SELECT DISTINCT alumno_id
       FROM asistencias
       WHERE estado = 'A'
       GROUP BY alumno_id
       HAVING COUNT(DISTINCT dia) >= 5`,
      [fechaLimiteISO]
    );

    for (const alumno of alumnos) {
      // Verifica si ya existe la alerta para este alumno y agenda_num = 4 (Inactivos)
      const [alertasExistentes] = await pool.execute(
        `SELECT id FROM agendas WHERE alumno_id = ? AND agenda_num = 4`,
        [alumno.alumno_id]
      );

      if (alertasExistentes.length === 0) {
        // Si no existe, inserta la nueva alerta
        console.log(
          `Insertando alerta de inactividad para alumno_id: ${alumno.alumno_id}`
        );
        await pool.execute(
          `INSERT INTO agendas (alumno_id, agenda_num, contenido)
           VALUES (?, 4, 'PENDIENTE')`,
          [alumno.alumno_id]
        );
      } else {
        console.log(
          `Alerta de inactividad ya existente para alumno_id: ${alumno.alumno_id}, no se crea duplicado.`
        );
      }
    }

    console.log('Proceso de generación de alertas para inactivos completado.');
  } catch (error) {
    console.error('Error generando alertas para inactivos:', error);
  }
};

// genAlertInactivos(); se comenta
// Configura el cron job para ejecutarse diariamente
cron.schedule('0 0 * * *', async () => {
  console.log('Ejecutando cron de alertas para los inactivos...');
  await genAlertInactivos();
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
app.post(
  '/upload-image', // Endpoint para subir la imagen
  multerUpload.single('file'), // Usamos multer para manejar la carga del archivo
  async (req, res) => {
    // Acceder a los datos del cuerpo y el archivo
    const { agenda_id, agenda_num, alumno_id } = req.body; // Extraer datos de req.body
    const file = req.file; // Obtener el archivo subido

    // Verificar que el archivo haya sido cargado
    if (!file) {
      return res.status(400).json({ message: 'Archivo no proporcionado' });
    }

    // Guardar la ruta del archivo
    const imagePath = `uploads/agendas/${file.filename}`;
    const fileName = file.originalname; // Nombre original del archivo

    // Verificar que los datos necesarios existan
    if (!agenda_id || !agenda_num || !alumno_id) {
      return res.status(400).json({ message: 'Faltan datos necesarios' });
    }

    try {
      // Insertar los datos en la tabla agenda_imagenes
      await pool.query(
        'INSERT INTO agenda_imagenes (agenda_id, agenda_num, alumno_id, nombre_archivo, ruta_archivo) VALUES (?, ?, ?, ?, ?)',
        [agenda_id, agenda_num, alumno_id, fileName, imagePath]
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

// app.use('/public', express.static(join(CURRENT_DIR, '../uploads')));
app.use('/public', express.static(join(CURRENT_DIR, 'uploads')));

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
