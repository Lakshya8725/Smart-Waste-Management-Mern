import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Custom storage engine for Cloudinary
class CloudinaryStorage {
  constructor(options) {
    this.options = options;
  }

  _handleFile(req, file, cb) {
    const uploadOptions = {
      folder: this.options.folder,
      allowed_formats: this.options.allowedFormats,
      transformation: this.options.transformation,
    };

    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        Readable.from(buffer).pipe(uploadStream);
      });
    };

    const chunks = [];
    file.stream.on('data', (chunk) => chunks.push(chunk));
    file.stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const result = await streamUpload(buffer);
        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
        });
      } catch (error) {
        cb(error);
      }
    });
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, cb);
  }
}

// Storage for waste reports
const reportStorage = new CloudinaryStorage({
  folder: 'waste-reports',
  allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  transformation: [
    { width: 1024, height: 1024, crop: 'limit' },
    { quality: 'auto' }
  ],
});

// Storage for user profiles
const profileStorage = new CloudinaryStorage({
  folder: 'user-profiles',
  allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  transformation: [
    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
    { quality: 'auto' }
  ],
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/jpg,image/png,image/webp').split(',');
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

// Multer upload configurations
export const uploadReportImage = multer({
  storage: reportStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  },
});

export const uploadProfileImage = multer({
  storage: profileStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

// Helper function to delete image from Cloudinary
export const deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return false;
  }
};

export default cloudinary;
