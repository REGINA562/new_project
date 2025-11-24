require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const PgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');

const db = require('./db');
const { ensureAuthenticated } = require('./auth');
const { allowedFile, uniqueFilename } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uniqueFilename(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedFile(file.originalname)) return cb(new Error('Недопустимый тип файла'));
    cb(null, true);
  }
});

// view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// static
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(flash());

// session store in Postgres
app.use(session({
  store: new PgSession({
    pool: db.pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// make flash and user available in views
app.use((req, res, next) => {
  res.locals.flash = req.flash();
  res.locals.currentUser = req.session.user || null;
  next();
});

// --- Routes ---

app.get('/login', (req, res) => {
  res.render('login', { title: 'Вход' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'Заполните email и пароль');
    return res.redirect('/login');
  }
  try {
    const r = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = r.rows[0];
    if (!user) {
      req.flash('error', 'Неверный email или пароль');
      return res.redirect('/login');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      req.flash('error', 'Неверный email или пароль');
      return res.redirect('/login');
    }
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    req.flash('success', 'Вход выполнен');
    return res.redirect('/');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Ошибка сервера');
    return res.redirect('/login');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', ensureAuthenticated, async (req, res) => {
  const totalStudents = (await db.query('SELECT COUNT(*)::int AS c FROM students')).rows[0].c;
  const totalNotes = (await db.query('SELECT COUNT(*)::int AS c FROM notes')).rows[0].c;
  const recent = (await db.query('SELECT * FROM students ORDER BY created_at DESC LIMIT 5')).rows;
  res.render('dashboard', { title: 'Панель', totalStudents, totalNotes, recent });
});

app.get('/students', ensureAuthenticated, async (req, res) => {
  const students = (await db.query('SELECT * FROM students ORDER BY full_name')).rows;
  res.render('students', { title: 'Ученики', students });
});

app.get('/students/add', ensureAuthenticated, (req, res) => res.render('add_student', { title: 'Добавить ученика' }));
app.post('/students/add', ensureAuthenticated, upload.single('photo'), async (req, res) => {
  const { full_name, age, phone, email, level, paid_until } = req.body;
  const photo = req.file ? req.file.filename : null;
  await db.query(`INSERT INTO students (full_name, age, phone, email, level, photo, paid_until)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [full_name, age || null, phone || null, email || null, level || null, photo, paid_until || null]);
  req.flash('success', 'Ученик добавлен');
  res.redirect('/students');
});

app.get('/students/:id', ensureAuthenticated, async (req, res) => {
  const id = req.params.id;
  const s = (await db.query('SELECT * FROM students WHERE id=$1', [id])).rows[0];
  if (!s) return res.status(404).send('Не найдено');
  const notes = (await db.query(
    `SELECT n.*, u.name as author_name FROM notes n LEFT JOIN users u ON n.author_id = u.id
     WHERE n.student_id = $1 ORDER BY n.created_at DESC`, [id]
  )).rows;
  res.render('student_detail', { title: s.full_name, student: s, notes });
});

app.get('/students/:id/edit', ensureAuthenticated, async (req, res) => {
  const s = (await db.query('SELECT * FROM students WHERE id=$1', [req.params.id])).rows[0];
  if (!s) return res.status(404).send('Не найдено');
  res.render('edit_student', { title: 'Редактировать', student: s });
});
app.post('/students/:id/edit', ensureAuthenticated, upload.single('photo'), async (req, res) => {
  const id = req.params.id;
  const s = (await db.query('SELECT * FROM students WHERE id=$1', [id])).rows[0];
  if (!s) return res.status(404).send('Не найдено');
  const { full_name, age, phone, email, level, paid_until } = req.body;
  const photo = req.file ? req.file.filename : s.photo;
  await db.query(`UPDATE students SET full_name=$1, age=$2, phone=$3, email=$4, level=$5, photo=$6, paid_until=$7 WHERE id=$8`,
    [full_name, age || null, phone || null, email || null, level || null, photo, paid_until || null, id]);
  req.flash('success', 'Данные ученика обновлены');
  res.redirect(`/students/${id}`);
});

app.delete('/students/:id', ensureAuthenticated, async (req, res) => {
  await db.query('DELETE FROM students WHERE id=$1', [req.params.id]);
  req.flash('info', 'Ученик удалён');
  res.redirect('/students');
});

app.get('/students/:id/notes/add', ensureAuthenticated, async (req, res) => {
  const s = (await db.query('SELECT * FROM students WHERE id=$1', [req.params.id])).rows[0];
  if (!s) return res.status(404).send('Не найдено');
  res.render('add_note', { title: 'Добавить заметку', student: s });
});
app.post('/students/:id/notes/add', ensureAuthenticated, upload.single('attachment'), async (req, res) => {
  const student_id = req.params.id;
  const content = req.body.content;
  const attachment = req.file ? req.file.filename : null;
  const author_id = req.session.user.id;
  await db.query('INSERT INTO notes (student_id, author_id, content, attachment) VALUES ($1,$2,$3,$4)',
    [student_id, author_id, content, attachment]);
  req.flash('success', 'Заметка добавлена');
  res.redirect(`/students/${student_id}`);
});

app.delete('/notes/:id', ensureAuthenticated, async (req, res) => {
  const note = (await db.query('SELECT * FROM notes WHERE id=$1', [req.params.id])).rows[0];
  if (!note) return res.status(404).send('Не найдено');
  await db.query('DELETE FROM notes WHERE id=$1', [req.params.id]);
  req.flash('info', 'Заметка удалена');
  res.redirect(`/students/${note.student_id}`);
});

app.get('/register', (req, res) => res.render('register', { title: 'Регистрация ученика' }));
app.post('/register', upload.single('photo'), async (req, res) => {
  const { full_name, age, phone, email, level, initial_note } = req.body;
  const photo = req.file ? req.file.filename : null;
  const r = await db.query('INSERT INTO students (full_name, age, phone, email, level, photo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [full_name, age || null, phone || null, email || null, level || null, photo]);
  const studentId = r.rows[0].id;
  if (initial_note && initial_note.trim().length) {
    await db.query('INSERT INTO notes (student_id, content) VALUES ($1,$2)', [studentId, initial_note]);
  }
  res.render('register_success', { title: 'Спасибо', student: { id: studentId, full_name } });
});

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
