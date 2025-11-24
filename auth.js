function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash('error', 'Требуется вход в систему');
  return res.redirect('/login');
}

module.exports = { ensureAuthenticated };
