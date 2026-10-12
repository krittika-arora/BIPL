const path = require('path');
const multer = require('multer');

const MAX_FILE_BYTES = 100 * 1024;
const ALLOWED_EXTENSIONS = ['.csv', '.txt'];

// Files stay in memory: they are small, parsed immediately and never stored.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) {
      req.uploadError = 'Upload a .csv or .txt file.';
      return cb(null, false);
    }
    cb(null, true);
  },
});

// Accepts an optional single file in `fieldName`. Upload problems are recorded on
// req.uploadError so the controller can show them on the form instead of a 500 page.
function optionalListFile(fieldName) {
  const handler = upload.single(fieldName);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        req.uploadError =
          err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 100 KB.' : 'The upload could not be read.';
        return next();
      }
      next(err);
    });
  };
}

module.exports = { optionalListFile };
