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
import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'goosta19802@gmail.com',
    pass: 'ynqekrvulwsrertp'
  }
});

// Contenido del correo electrónico
let mail = {
  from: 'goosta19802@gmail.com',
  to: 'softfusionsa@gmail.com',
  subject: 'Gracias por querer ser parte del equipo de HAMMERX',
  html: `
      <img src="cid:imagenlogo" alt="HAMMERX Logo" style="max-width: 100%; height: auto;">
      <h3 font-family: 'Big Noodle Titling', sans-serif;">¡Gracias por tu interés en ser parte del equipo de HAMMERX!</h3>
      <p style="font-size: 16px; font-family: 'Big Noodle Titling', sans-serif;">Hemos recibido tu información y la revisaremos cuidadosamente. Nos pondremos en contacto contigo para discutir los próximos pasos en breve.</p>
      <p style="font-size: 16px; font-family: 'Big Noodle Titling', sans-serif;">Si tienes alguna pregunta o necesitas más información, no dudes en ponerte en contacto con nosotros a través de este correo electrónico.</p>
      <p style="font-size: 16px; font-family: 'Big Noodle Titling', sans-serif;">Saludos,</p>
      <p style="font-size: 16px; font-family: 'Big Noodle Titling', sans-serif;">Equipo de HAMMERX</p>
    `,
  attachments: [
    {
      filename: 'logohammerorange.jpg',
      path: './Images/logohammerorange.jpg',
      cid: 'imagenlogo' // ID de la imagen para incrustarla en el HTML
    }
  ]
};

// transporter.sendMail(mail, (error, info) => {
//      if (error) {
//          console.log("Error sending email", error)
//      }
//      else {
//          console.log('Email send');
//      }
//  })

if (process.env.NODE_ENV !== 'production') {
    dotenv.config()
}

const PORT = process.env.PORT || 3000;

// console.log(process.env.PORT)

const app = express();
app.use(cors())// aca configuramos cors para no tener errores
app.use(express.json());
app.use('/', GetRoutes);
// definimos la conexion 


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
      const token = jwt.sign({ id: user.id }, 'softfusion', { expiresIn: '1h' });
      return res.json({ message: 'Success', token });
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
app.get('/integrantes/:id_integrante/integrantesfam', async (req, res) => {
  const { id_integrante } = req.params;

  try {
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


// // Ruta para obtener todos los registros de las tablas
// app.get('/datos', async (req, res) => {
//     try {
//         const postulantes = await obtenerRegistrosPostulante();
//         const testClasses = await obtenerRegistrosTestClass();
//         res.json({ postulantes, testClasses });
//     } catch (error) {
//         res.status(500).json({ error: 'Error al obtener los registros de las tablas' });
//     }
// });

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto http://localhost:${PORT}/ o bien  http://localhost:${PORT}/postulante/ `)
})