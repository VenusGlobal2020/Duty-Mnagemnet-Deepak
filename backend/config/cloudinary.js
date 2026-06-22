const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const createStorage = (folder, resourceType = 'auto') => new CloudinaryStorage({
  cloudinary,
  params: {
    folder: `duty_mgmt/${folder}`,
    resource_type: resourceType,
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'xls', 'doc', 'docx'],
  },
});

const uploadOfficerExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'];
    const allowedExt = /\.(xlsx|xls)$/i;
    if (allowedMimes.includes(file.mimetype) || allowedExt.test(file.originalname)) cb(null, true);
    else cb(new Error('Only Excel files allowed'), false);
  }
});

const uploadDutyDoc = multer({
  storage: createStorage('duty_documents'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not supported'), false);
  }
});

const uploadProfileImage = multer({
  storage: createStorage('profiles', 'image'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'), false);
  }
});

module.exports = { cloudinary, uploadOfficerExcel, uploadDutyDoc, uploadProfileImage };