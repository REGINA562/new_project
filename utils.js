const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_EXT = new Set(['png','jpg','jpeg','gif','pdf','doc','docx','mp4','m4a','wav']);

function allowedFile(filename) {
  if (!filename) return false;
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ALLOWED_EXT.has(ext);
}

function uniqueFilename(original) {
  const ext = path.extname(original);
  return `${uuidv4()}${ext}`;
}

module.exports = { allowedFile, uniqueFilename };
