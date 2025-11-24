# Student Manager (Render ready)

This is a minimal Node.js + Express + PostgreSQL student management app prepared for deployment to Render.com.

- Public registration: `/register`
- Admin login: `/login` (default admin created by init_db.js: admin@example.com / adminpass)

Setup:
1. Copy repo to GitHub.
2. Set environment variable `DATABASE_URL` (Postgres) and `SESSION_SECRET` on Render.
3. Render build runs `npm install && npm run init-db` which creates DB schema and default admin.
4. Start service.

