import jwt from 'jsonwebtoken';
import express from "express";
import cors from 'cors'
// El Intercambio de Recursos de Origen Cruzado (CORS (en-US)) 
// es un mecanismo que utiliza cabeceras HTTP adicionales para permitir que un user agent (en-US) 
// obtenga permiso para acceder a recursos seleccionados desde un servidor, en un origen distinto (dominio) al que pertenece.

// importamos la conexion de la base de datos
import db from "./DataBase/db.js";
import GetRoutes from './Routes/routes.js';
import dotenv from 'dotenv'

import { Op } from 'sequelize';
import NovedadesModel from './Models/MD_TB_Novedades.js';
import cron from 'node-cron';

import multer from 'multer';
import path, { join } from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise'; // Usar mysql2 para las promesas
import { dirname , extname} from 'path';
import { fileURLToPath } from 'url'
import { PORT } from './DataBase/config.js';

// CONFIGURACION PRODUCCION

if (process.env.NODE_ENV !== 'production') {
    dotenv.config()
}

// const PORT = process.env.PORT || 3000;

// console.log(process.env.PORT)

const app = express();
app.use(cors())// aca configuramos cors para no tener errores
app.use(express.json());
app.use('/', GetRoutes);
// definimos la conexion 


// Ruta en el backend para actualizar el estado de la novedad
app.patch('/novedades/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const novedad = await Novedad.findByPk(id);
    if (!novedad) {
      return res.status(404).json({ error: 'Novedad no encontrada' });
    }
    novedad.estado = estado;
    await novedad.save();
    res.json(novedad);
  } catch (error) {
    console.error('Error al actualizar la novedad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// Para verificar si nuestra conexión funciona, lo hacemos con el método authenticate()
//  el cual nos devuelve una promesa que funciona de la siguiente manera:
// un try y un catch para captar cualquier tipo de errores 
try {
    db.authenticate()
    console.log('Conexion con la db establecida')
}
catch (error) {
    console.log(`El error de la conexion es : ${error}`)
}

app.post('/login', async (req, res) => {
  const sql = 'SELECT * FROM users WHERE email = :email AND password = :password';
  try {
    const [results, metadata] = await db.query(sql, {
      replacements: { email: req.body.email, password: req.body.password }
    });
    if (results.length > 0) {
      const user = results[0];
          const token = jwt.sign(
            { id: user.id, level: user.level },
            'softfusion',
            { expiresIn: '1h' }
          );
          return res.json({ message: 'Success', token, level: user.level });
    } else {
      return res.json('Fail');
    }
  } catch (err) {
    console.log('Error executing query', err);
    return res.json('Error');
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'softfusion', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};


app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Esto es una ruta protegida mi ray' });
});

app.get('/', (req, res) => {
    if (req.url == '/') {
        res.send('si en la URL pone /jobs,/ask,/postulantes... vera los registros en formato JSON') // este hola mundo se mostrara en el puerto 5000 y en la raiz principal
    }
    else if (req.url != '/') {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('404 ERROR')
    }
})

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
app.get('/admconvenios/:id_conv/integrantes/:id_integrante/integrantesfam', async (req, res) => {
  const { id_conv, id_integrante } = req.params;

  try {
    // Validar id_conv e id_integrante
    if (!id_conv || !id_integrante) {
      return res.status(400).json({ error: 'id_conv y id_integrante son requeridos' });
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

    console.log(`${result} novedades eliminadas.`);  // Muestra cuántos registros fueron eliminados
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
      const uploadPath = join(CURRENT_DIR, 'uploads'); // Esto debe ser la carpeta en la raíz del proyecto
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

      try {
        // Guardar la ruta de la imagen en la base de datos
        await pool.query(
          'INSERT INTO adm_convenio_images (convenio_id, image_path) VALUES (?, ?)',
          [convenio_id, imagePath]
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

    try {
      // Guardar la ruta de la imagen en la base de datos
      await pool.query(
        'INSERT INTO adm_convenio_fac (convenio_id, image_path) VALUES (?, ?)',
        [convenio_id, imagePath]
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


// app.use('/public', express.static(join(CURRENT_DIR, '../uploads')));
app.use('/public', express.static(join(CURRENT_DIR, 'uploads')));


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
      return res.status(404).json({ message: 'No se encontraron vencimientos para esta novedad.' });
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
  const { novedad_id, vencimiento, sede, titulo, mensaje, user, estado } = req.body;

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
      return res.status(404).json({ message: 'No se encontraron vencimientos.' });
    }

    // Enviar los resultados en formato JSON
    res.json(rows);
  } catch (error) {
    console.error('Error en la consulta:', error); // Añadir detalles del error
    res.status(500).json({ message: 'Error al obtener los vencimientos.' });
  }
});


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
