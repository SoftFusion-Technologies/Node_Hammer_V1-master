module.exports = {
  apps: [
    {
      name: 'Node_Hammer_V1-master', // Cambia aquí al nombre de tu aplicación
      script: 'app.js', // Cambia esto si tu archivo principal es diferente
      instances: 'max', // Ejecuta tantas instancias como CPUs tengas
      exec_mode: 'cluster', // Modo cluster para aprovechar múltiples CPUs
      env: {
        NODE_ENV: 'development' // Variables de entorno para el entorno de desarrollo
      },
      env_production: {
        NODE_ENV: 'production', // Variables de entorno para el entorno de producción
        PORT: 3000, // Puerto en el que tu aplicación escuchará
        DB_HOST: '149.50.141.175', // IP del servidor de base de datos
        DB_USER: 'root',
        DB_PASSWORD: '8aKPXCd25GBR',
        DB_NAME: 'c1841398_hammer',
        DB_PORT: 5417 // Puerto de la base de datos
      }
    }
  ]
};
