import jwt from 'jsonwebtoken';
import db from '../DataBase/db.js';

// Función de login

export const login = async (req, res) => {
  const { email, password } = req.body;

  const sql =
    'SELECT * FROM users WHERE email = :email AND password = :password';
  try {
    const [results, metadata] = await db.query(sql, {
      replacements: { email: email, password: password }
    });

    if (results.length > 0) {
      const user = results[0];
      const token = jwt.sign({ id: user.id, level: user.level, sede: user.sede, name: user.name }, 'softfusion', {
        expiresIn: '1h'
      });

      return res.json({
        message: 'Success',
        token,
        level: user.level,
        id: user.id, // ← se incluye aquí el ID
        sede: user.sede,
        name: user.name
      });
    } else {
      return res.json('Fail');
    }
  } catch (err) {
    console.log('Error executing query', err);
    return res.json('Error');
  }
};

export const login_profesores_pilates = async (req, res) => {
  const { email, password } = req.body;

  const sql =
    'SELECT * FROM usuarios_pilates WHERE email = :email AND password = :password';
  try {
    const [results, metadata] = await db.query(sql, {
      replacements: { email: email, password: password }
    });
    if (results.length > 0) {
      const user = results[0];
      const token = jwt.sign({ id: user.id, level: user.rol, sede_id: user.sede_id, nombre: user.nombre, apellido: user.apellido, telefono: user.telefono }, 'softfusion', {
        expiresIn: '1h'
      });
      return res.json({ message: 'Success', token, level: user.rol, sede_id: user.sede_id, nombre: user.nombre, apellido: user.apellido, telefono: user.telefono });
    } else {
      return res.json('Fail');
    }
  } catch (err) {
    console.log('Error executing query', err);
    return res.json('Error');
  }
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'softfusion', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};
