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
import { AgendasModel } from './Models/MD_TB_Agendas.js';
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
      'image/webp', // Agregar soporte para capturas WebP
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
const eliminarAsistenciasFuturas = async () => {
  const fechaHoy = new Date();
  const diaHoy = fechaHoy.getDate(); // Obtener el día actual del mes
  await AsistenciasModel.destroy({
    where: {
      [Op.and]: [
        { dia: { [Op.gt]: diaHoy } }, // Días mayores al actual
        { mes: mesHoy }, // Asegurarse de que sea el mismo mes
        { anio: anioHoy } // Asegurarse de que sea el mismo año
      ]
    }
  });
  console.log(`Asistencias futuras eliminadas hasta el día ${diaHoy}.`);
};

// Función para crear asistencias automáticas
const crearAsistenciasAutomáticas = async () => {
  try {
    // 1. Obtener todos los alumnos
    const alumnos = await AlumnosModel.findAll();

    // 2. Crear asistencia solo si es lunes a viernes
    const fechaHoy = new Date();
    const diaSemana = fechaHoy.getDay(); // Número del día (0 = domingo, 6 = sábado)
    const diaHoy = fechaHoy.getDate();
    const mesHoy = fechaHoy.getMonth() + 1;
    const anioHoy = fechaHoy.getFullYear();

    if (diaSemana === 0 || diaSemana === 6) {
      console.log('No se crean asistencias los fines de semana.');
      return;
    }

    // 3. Eliminar asistencias existentes para hoy
    await AsistenciasModel.destroy({
      where: {
        dia: diaHoy,
        mes: mesHoy,
        anio: anioHoy,
        estado: 'A' // Solo eliminar asistencias con estado "Ausente"
      }
    });
    console.log('Asistencias existentes eliminadas.');
    // 3. Crear asistencias
    const asistencias = alumnos.map((alumno) => ({
      alumno_id: alumno.id,
      dia: diaHoy,
      mes: mesHoy,
      anio: anioHoy,
      estado: 'A' // Estado inicial como "Ausente"
    }));

    if (asistencias.length > 0) {
      // Insertar todas las asistencias
      await AsistenciasModel.bulkCreate(asistencias);
      console.log('Asistencias creadas con éxito.');
    } else {
      console.log('No se encontraron alumnos para registrar asistencias.');
    }

    // 4. Eliminar asistencias futuras
    await eliminarAsistenciasFuturas();
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
    const mesActual = hoy.getMonth() + 1; // Mes actual (0 indexado, por eso +1)
    const anioActual = hoy.getFullYear();

    console.log(`Fecha actual: ${diaHoy}-${mesActual}-${anioActual}`);

    // Obtener los alumnos creados el día anterior que no sean prospecto = 'socio'
    const fechaAyer = new Date(hoy);
    fechaAyer.setDate(hoy.getDate() - 1);
    const fechaAyerISO = fechaAyer.toISOString().split('T')[0];

    const [alumnos] = await pool.execute(
      `SELECT id FROM alumnos 
       WHERE DATE(fecha_creacion) = ? 
       AND prospecto IN ('nuevo', 'prospecto')`,
      [fechaAyerISO]
    );

    for (const alumno of alumnos) {
      // Verificar si ya existe la alerta para este alumno y agenda_num = 1
      const [alertasExistentes] = await pool.execute(
        `SELECT id FROM agendas WHERE alumno_id = ? AND agenda_num = 1`,
        [alumno.id]
      );

      if (alertasExistentes.length === 0) {
        // Insertar nueva alerta con el mes y año actual
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
    const diaHoy = hoy.getDate();
    const mesActual = hoy.getMonth() + 1; // Mes actual (0 indexado, por eso +1)
    const anioActual = hoy.getFullYear();

    console.log(`Fecha actual: ${diaHoy}-${mesActual}-${anioActual}`);

    // Fecha de hace tres semanas (solo para referencia, si es necesaria)
    const fechaTresSemanas = new Date(hoy);
    fechaTresSemanas.setDate(hoy.getDate() - 21);
    const fechaTresSemanasISO = fechaTresSemanas.toISOString().split('T')[0];
    console.log(
      `Fecha de hace tres semanas en formato ISO: ${fechaTresSemanasISO}`
    );

    // Obtener los alumnos creados hace tres semanas que no sean prospecto = 'socio'
    const [alumnos] = await pool.execute(
      `SELECT id FROM alumnos 
       WHERE DATE(fecha_creacion) = ? 
       AND prospecto IN ('nuevo', 'prospecto')`,
      [fechaTresSemanasISO]
    );

    for (const alumno of alumnos) {
      // Verificar si ya existe la alerta para este alumno y agenda_num = 2
      const [alertasExistentes] = await pool.execute(
        `SELECT id FROM agendas WHERE alumno_id = ? AND agenda_num = 2`,
        [alumno.id]
      );

      if (alertasExistentes.length === 0) {
        // Insertar nueva alerta con el mes y año actuales
        console.log(`Insertando alerta para alumno_id: ${alumno.id}`);
        await pool.execute(
          `INSERT INTO agendas (alumno_id, agenda_num, contenido, mes, anio)
           VALUES (?, 2, 'PENDIENTE', ?, ?)`,
          [alumno.id, mesActual, anioActual]
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
    const mesActual = hoy.getMonth() + 1; // Mes actual (0 indexado, por eso +1)
    const anioActual = hoy.getFullYear(); // Año actual
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
      // Calculamos la fecha 7 días después de la fecha de creación del alumno
      const fechaCreacion = new Date(alumno.fecha_creacion);
      const fechaSieteDias = new Date(fechaCreacion);
      fechaSieteDias.setDate(fechaCreacion.getDate() + 7); // 7 días después
      const fechaSieteDiasISO = fechaSieteDias.toISOString().split('T')[0]; // Solo la fecha (sin hora)

      console.log(
        `Fecha para generar alerta (7 días después) para alumno_id ${alumno.id}: ${fechaSieteDiasISO}`
      );

      // Verificamos si la fecha calculada es igual a hoy
      if (fechaSieteDiasISO === fechaHoyISO) {
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
            `UPDATE agendas 
             SET contenido = 'PENDIENTE', mes = ?, anio = ? 
             WHERE alumno_id = ? AND agenda_num = 3`,
            [mesActual, anioActual, alumno.id]
          );

          console.log(`Resultado de la actualización:`, result);
        } else {
          // Si no existe, inserta la nueva alerta para la agenda 3
          console.log(
            `Insertando alerta para agenda_num 3 para alumno_id: ${alumno.id}`
          );

          const [result] = await pool.execute(
            `INSERT INTO agendas (alumno_id, agenda_num, contenido, mes, anio) 
             VALUES (?, 3, 'PENDIENTE', ?, ?)`,
            [alumno.id, mesActual, anioActual]
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

// Registrar la creación de una nueva alerta
const registrarCreacionAlerta = async (alumno_id, agenda_num) => {
  try {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();

    await pool.execute(
      `INSERT INTO alertas_creadas (alumno_id, fecha_creacion, agenda_num, mes, anio)
       VALUES (?, ?, ?, ?, ?)`,
      [alumno_id, new Date(), agenda_num, mes, anio]
    );
    console.log(
      `Alerta creada y registrada para el alumno_id: ${alumno_id}, mes: ${mes}, año: ${anio}`
    );
  } catch (error) {
    console.error('Error al registrar la creación de la alerta:', error);
  }
};

// Función para generar alertas de inactivos (sin asistencia en 5 días)
const genAlertInactivos = async () => {
  try {
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0: Domingo, 1: Lunes, ..., 4: Jueves, 5: Viernes

    // Solo ejecuta los jueves (4) y viernes (5)
    if (diaSemana !== 4 && diaSemana !== 5) {
      console.log('No es jueves ni viernes, el proceso no se ejecuta.');
      return;
    }

    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(hoy.getDate() - 5); // 5 días atrás
    const fechaLimiteISO = fechaLimite.toISOString().split('T')[0];
    console.log(`Fecha límite para inactivos: ${fechaLimiteISO}`);

    // Obtén los alumnos con 5 días consecutivos de estado 'A'
    // Y verifica que no tengan un presente ('P') DESPUÉS del periodo evaluado
    const [alumnos] = await pool.execute(
      `SELECT DISTINCT a.alumno_id
       FROM asistencias a
       WHERE a.estado = 'A'
       AND NOT EXISTS (
        SELECT 1 
        FROM asistencias p
        WHERE p.alumno_id = a.alumno_id
        AND p.estado = 'P'
      )
      GROUP BY a.alumno_id
      HAVING COUNT(DISTINCT a.dia) >= 5`
    );

    const agenda_num = 4; // Alerta para inactividad
    const mesActual = hoy.getMonth() + 1; // Mes actual (0 indexado, por eso +1)
    const anioActual = hoy.getFullYear(); // Año actual

    for (const alumno of alumnos) {
      // Verifica si ya existe la alerta para este alumno y agenda_num = 4 (Inactivos) en el mes y año actual
      const [alertasExistentes] = await pool.execute(
        `SELECT id FROM agendas WHERE alumno_id = ? AND agenda_num = ?`,
        [alumno.alumno_id, agenda_num]
      );

      // Verifica si ya existe un registro de creación en alertas_creadas para el mes y año actual
      const [alertasCreadas] = await pool.execute(
        `SELECT fecha_creacion, mes, anio 
         FROM alertas_creadas 
         WHERE alumno_id = ? AND agenda_num = ? AND mes = ? AND anio = ?`,
        [alumno.alumno_id, agenda_num, mesActual, anioActual]
      );

      if (alertasExistentes.length === 0) {
        if (alertasCreadas.length > 0) {
          console.log(
            `Ya existe una alerta de inactividad para el alumno_id: ${alumno.alumno_id} en el mes ${mesActual} y año ${anioActual}. No se crea una nueva.`
          );
          continue; // No creamos la alerta, pasamos al siguiente alumno
        }

        // Si no existe una alerta para este mes, se crea la alerta
        console.log(
          `Insertando alerta de inactividad para alumno_id: ${alumno.alumno_id}`
        );
        await pool.execute(
          `INSERT INTO agendas (alumno_id, agenda_num, contenido, mes, anio)
           VALUES (?, ?, 'PENDIENTE', ?, ?)`,
          [alumno.alumno_id, agenda_num, mesActual, anioActual]
        );

        // Registrar la creación de la alerta en la tabla alertas_creadas
        await registrarCreacionAlerta(alumno.alumno_id, agenda_num);
      } else {
        console.log(
          `Alerta de inactividad ya existente para alumno_id: ${alumno.alumno_id} en el mes ${mesActual} y año ${anioActual}. No se crea una nueva alerta.`
        );
      }
    }

    console.log('Proceso de generación de alertas para inactivos completado.');
  } catch (error) {
    console.error('Error generando alertas para inactivos:', error);
  }
};

// Configura el cron job para ejecutarse diariamente
cron.schedule('0 0 * * *', async () => {
  console.log('Ejecutando cron de alertas para los inactivos...');
  await genAlertInactivos();
});

const actualizarProspectosANuevo = async () => {
  try {
    // Consulta para obtener alumnos con 2 o más asistencias consecutivas
    const [alumnosConAsistencias] = await pool.execute(`
      SELECT a.id AS alumno_id, COUNT(*) AS asistencias_consecutivas
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

    for (const { alumno_id } of alumnosConAsistencias) {
      console.log(`Actualizando alumno_id: ${alumno_id} a "nuevo"`);

      // Actualizar el alumno a "nuevo" y agregarle "c"
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

    console.log(`Tamaño del archivo recibido: ${file.size} bytes`);

    // Al guardar la imagen en el backend
    const imagePath = `uploads/agendas/${file.filename}`; // `file.filename` contiene el nombre con el timestamp
    const fileName = file.originalname; // Nombre original del archivo (sin timestamp), si es necesario

    // Verificar que los datos necesarios existan
    if (!agenda_id || !agenda_num || !alumno_id) {
      return res.status(400).json({ message: 'Faltan datos necesarios' });
    }

    try {
      // Insertar los datos en la tabla agenda_imagenes
      await pool.query(
        'INSERT INTO agenda_imagenes (agenda_id, agenda_num, alumno_id, nombre_archivo, ruta_archivo) VALUES (?, ?, ?, ?, ?)',
        [agenda_id, agenda_num, alumno_id, file.filename, imagePath] // Usa file.filename con el timestamp
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

// endpoint que devuelve las agendas pendientes agrupadas por alumno
app.get('/notificaciones', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Falta el id del instructor' });
  }

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
          a.contenido = 'PENDIENTE'
          AND NOT EXISTS (
              SELECT 1 
              FROM agendas AS sub_a
              WHERE 
                  sub_a.alumno_id = a.alumno_id
                  AND sub_a.agenda_num = a.agenda_num
                  AND sub_a.contenido IN ('REVISIÓN', 'ENVIADO')
          )
          AND al.user_id = ?
       ORDER BY 
          a.alumno_id, a.agenda_num`,
      [user_id]
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
      console.error('Error obteniendo estadísticas de profesores:', error);
      res
        .status(500)
        .json({ error: 'Error obteniendo estadísticas de profesores' });
    }
  }
);

// Endpoint que devuelve el total de asistencias por profesor
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
    console.error('Error obteniendo estadísticas de asistencias:', error);
    res
      .status(500)
      .json({ error: 'Error obteniendo estadísticas de asistencias' });
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
        AND MONTH(a.fecha_creacion) = ? 
        AND YEAR(a.fecha_creacion) = ?
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
    console.error('Error obteniendo nuevos del mes:', error);
    res.status(500).json({ error: 'Error obteniendo nuevos del mes' });
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
        AND MONTH(ap.fecha_creacion) = ? 
        AND YEAR(ap.fecha_creacion) = ?
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
    res.json(result);
  } catch (error) {
    console.error('Error obteniendo prospectos del mes:', error);
    res.status(500).json({ error: 'Error obteniendo prospectos del mes' });
  }
});

app.get('/estadisticas/convertidos', async (req, res) => {
  try {
    const [resultados] = await db.query(`
      SELECT 
        a.user_id AS profesor_id, 
        u.name AS profesor_nombre, 
        COUNT(*) AS totalConvertidos
      FROM alumnos a
      INNER JOIN users u ON a.user_id = u.id
      WHERE a.c = 'c'
      GROUP BY a.user_id, u.name
    `);

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
       GROUP BY 
          u.id, u.name
       ORDER BY 
          total_mensajes DESC`
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
