// artefakt fork: admin view of the pen annotations guests drew on photos.
const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { requireEventOwnership } = require('../middleware/ownership');
const annotationService = require('../services/annotationService');
const logger = require('../utils/logger');
const { validateEventId, checkValidation } = require('../utils/feedbackValidation');

// All annotations of an event, optionally for one photo (?photo_id=)
router.get('/events/:eventId/annotations',
  adminAuth,
  requirePermission('events.view'),
  requireEventOwnership,
  validateEventId,
  checkValidation,
  async (req, res) => {
    try {
      const photoId = req.query.photo_id ? Number(req.query.photo_id) : null;
      if (req.query.photo_id && !Number.isInteger(photoId)) {
        return res.status(400).json({ error: 'Invalid photo_id' });
      }
      const annotations = await annotationService.getEventAnnotations(Number(req.params.eventId), photoId);
      res.json({ annotations });
    } catch (error) {
      logger.error('Error listing annotations:', error);
      res.status(500).json({ error: 'Failed to list annotations' });
    }
  }
);

router.delete('/events/:eventId/annotations/:annotationId',
  adminAuth,
  requirePermission('events.edit'),
  requireEventOwnership,
  validateEventId,
  checkValidation,
  async (req, res) => {
    try {
      const deleted = await annotationService.deleteAnnotation(
        Number(req.params.eventId),
        Number(req.params.annotationId)
      );
      if (!deleted) return res.status(404).json({ error: 'Annotation not found' });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting annotation:', error);
      res.status(500).json({ error: 'Failed to delete annotation' });
    }
  }
);

module.exports = router;
