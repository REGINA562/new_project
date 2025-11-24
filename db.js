const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. See .env.example");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  // ssl: { rejectUnauthorized: false } // enable if your DB requires SSL
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
