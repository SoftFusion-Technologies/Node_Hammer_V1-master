import { Sequelize } from 'sequelize';
//Sequelize es un ORM para Nodejs que te permitirá agilizar bastante tus desarrollos que incluyan bases de datos relacionales como MySQL o Postgress.
// crear una instancia de sequelize

import { DB_HOST, DB_NAME, DB_PASSWORD, DB_USER, DB_PORT } from './config.js';

// para realizar la conexion de forma muy sensilla es poner los parametros dentro de la instancia
const db = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT, // Agrega el puerto a la configuración
  dialect: 'mysql',
  define: { freezeTableName: true },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    connectTimeout: 60000 // Tiempo de espera en milisegundos (60 segundos)
  }
});

// Lo primero que estamos haciendo es importar la clase Sequelize despues lo que se hace es crear una nueva instancia de esta clase
// que recibe como parámetros en su constructor, el nombre de la base de datos, el nombre del usuario, la contraseña,
// y un objeto de configuración donde especificamos el host de nuestra base de datos, el dialect que es donde ponemos que base de datos se esta utilizando.
export default db;
