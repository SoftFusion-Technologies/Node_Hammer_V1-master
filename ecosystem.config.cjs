module.exports = {
  apps: [
    {
      name: 'Node_Hammer_V1-master',
      script: 'app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DB_HOST: 'localhost',
        DB_USER: 'root',
        DB_PASSWORD: 123456,
        DB_NAME: 'development_db',
        DB_PORT: 3306
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_HOST: '149.50.141.175',
        DB_USER: 'root',
        DB_PASSWORD: '8aKPXCd25GBR',
        DB_NAME: 'c1841398_hammer',
        DB_PORT: 5417
      }
    }
  ]
};
