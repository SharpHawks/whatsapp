import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { mediaService } from '../services/media.service';
import { authenticateApiKey, AuthRequest } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024, // 16 MB
  },
});

// Upload media (API key authentication)
router.post(
  '/upload',
  authenticateApiKey,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError('No file uploaded');
      }

      if (!req.botId) {
        throw new ValidationError('API key must be associated with a bot');
      }

      const media = await mediaService.uploadMedia(
        req.botId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.status(201).json({
        message: 'Media uploaded successfully',
        media: {
          id: media.id,
          filename: media.filename,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          url: media.storageUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get media info (API key authentication)
router.get('/:mediaId', authenticateApiKey, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mediaId } = req.params;

    if (!req.botId) {
      throw new ValidationError('API key must be associated with a bot');
    }

    const media = await mediaService.getMedia(mediaId, req.botId);

    res.json({ media });
  } catch (error) {
    next(error);
  }
});

// Delete media (API key authentication)
router.delete('/:mediaId', authenticateApiKey, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mediaId } = req.params;

    if (!req.botId) {
      throw new ValidationError('API key must be associated with a bot');
    }

    await mediaService.deleteMedia(mediaId, req.botId);

    res.json({
      message: 'Media deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
