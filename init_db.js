const db = require('./db');
const bcrypt = require('bcrypt');

async function init() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher'
    );`);

    await db.query(`CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      age INTEGER,
      phone TEXT,
      email TEXT,
      level TEXT,
      photo TEXT,
      paid_until TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );`);

    await db.query(`CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      attachment TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );`);

    await db.query(`CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;`);

    const res = await db.query('SELECT COUNT(*)::int AS c FROM users');
    if (res.rows[0].c === 0) {
      const pwd = 'adminpass';
      const hash = await bcrypt.hash(pwd, 10);
      await db.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', ['Admin', 'admin@example.com', hash, 'admin']);
      console.log('Created admin: admin@example.com / adminpass — поменяй пароль!');
    } else {
      console.log('Users exist — skipping admin creation');
    }

    console.log('DB init done');
    process.exit(0);
  } catch (err) {
    console.error('DB init error', err);
    process.exit(1);
  }
}

init();
