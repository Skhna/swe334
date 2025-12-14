const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, // 🔥 ЯГ ЭНЭ НЭР
  database: process.env.DB_NAME,
});

module.exports = pool;
