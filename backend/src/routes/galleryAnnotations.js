// artefakt fork: guests draw on a photo with a red or white pen.
// Gated like comments: feedback must be enabled and comments allowed.
const express = require('express');
const router = express.Router();
const { verifyGalleryAccess, denySlideshowToken } = require('../middleware/gallery');
const { blockHiddenGallery } = require('../utils/revealMode');
const { feedbackRateLimit, generateGuestIdentifier } = require('../middleware/feedbackRateLimit');
const { resolveGuest } = require('../middleware/guestAuth');
const feedbackService = require('../services/feedbackService');
const annotationService = require('../services/annotationService');
const { db, logActivity } = require('../database/db');
const logger = require('../utils/logger');
const { isPhotoHiddenFromViewer } = require('../utils/photoVisibility');
const {
  validatePhotoId,
  checkValidation,
  validateGuestRequirements
} = require('../utils/feedbackValidation');

async function loadContext(req, res) {
  const settings = await feedbackService.getEventFeedbackSettings(req.event.id);
  if (!settings.feedback_enabled || !settings.allow_comments) {
    res.status(403).json({ error: 'Annotations are not enabled for this event' });
    return null;
  }
  const photo = await db('photos')
    .where({ id: req.params.photoId, event_id: req.event.id })
    .first();
  if (!photo || isPhotoHiddenFromViewer(photo, req.accessLevel)) {
    res.status(404).json({ error: 'Photo not found' });
    return null;
  }
  return { settings, photo };
}

// The current guest's own drawing on a photo
router.get('/:slug/photos/:photoId/annotation',
  verifyGalleryAccess,
  blockHiddenGallery,
  resolveGuest,
  validatePhotoId,
  checkValidation,
  async (req, res) => {
    try {
      const ctx = await loadContext(req, res);
      if (!ctx) return;
      const guestIdentifier = await generateGuestIdentifier(req);
      const annotation = await annotationService.getGuestAnnotation(ctx.photo.id, guestIdentifier);
      res.json({
        strokes: annotation?.strokes || [],
        note: annotation?.note || null,
        updated_at: annotation?.updated_at || null
      });
    } catch (error) {
      logger.error('Error getting annotation:', error);
      res.status(500).json({ error: 'Failed to get annotation' });
    }
  }
);

// Save (replace) the current guest's drawing on a photo
router.put('/:slug/photos/:photoId/annotation',
  verifyGalleryAccess,
  denySlideshowToken,
  blockHiddenGallery,
  resolveGuest,
  validatePhotoId,
  checkValidation,
  async (req, res) => {
    try {
      const ctx = await loadContext(req, res);
      if (!ctx) return;
      const { settings, photo } = ctx;
      const event = req.event;

      if (settings.identity_mode === 'guest' && (!req.guest || req.guest.eventId !== event.id)) {
        return res.status(401).json({ error: 'Guest identity required', code: 'GUEST_IDENTITY_REQUIRED' });
      }
      if (settings.identity_mode !== 'guest') {
        const guestValidation = await validateGuestRequirements(settings, req.body);
        if (!guestValidation.valid) {
          return res.status(400).json({ error: 'Guest information required', errors: guestValidation.errors });
        }
      }

      const { strokes, error } = annotationService.sanitizeStrokes(req.body.strokes);
      if (error) return res.status(400).json({ error });

      const rateLimit = feedbackRateLimit('annotation');
      await rateLimit(req, res, (err) => { if (err) throw err; });
      if (res.headersSent) return;

      const guestIdentifier = await generateGuestIdentifier(req);
      const guestName = req.guest?.name ?? req.body.guest_name;
      const saved = await annotationService.saveGuestAnnotation(photo.id, event.id, guestIdentifier, {
        strokes,
        note: annotationService.sanitizeNote(req.body.note),
        guest_id: req.guest?.id ?? null,
        guest_name: guestName,
        guest_email: req.guest?.email ?? req.body.guest_email
      });

      await logActivity('guest_feedback_annotation', {
        photo_id: photo.id,
        strokes: strokes.length,
        cleared: !saved
      }, event.id, {
        type: 'guest',
        id: guestIdentifier.substring(0, 16),
        name: guestName || 'Anonymous'
      });

      res.json({
        success: true,
        strokes: saved?.strokes || [],
        note: saved?.note || null,
        updated_at: saved?.updated_at || null
      });
    } catch (error) {
      logger.error('Error saving annotation:', error);
      res.status(500).json({ error: 'Failed to save annotation' });
    }
  }
);

module.exports = router;
