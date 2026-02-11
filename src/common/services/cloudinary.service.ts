import cloudinary from '@/config/cloudinary.config';

type UploadedFile = {
  buffer: Buffer;
};

export class CloudinaryService {
  static async uploadProductImage(file: UploadedFile) {
    return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'products',
          resource_type: 'image',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto:eco' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            return reject(error);
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      stream.end(file.buffer);
    });
  }
  static async deleteImage(publicId: string) {
    return cloudinary.uploader.destroy(publicId);
  }
}
