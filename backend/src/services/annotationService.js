// artefakt fork: pen annotations on photos.
// Strokes are stored as JSON: [{ color, width, points: [[x, y], ...] }]
// with x/y normalised to the photo (0..1) and width relative to its width.
const { db } = require('../database/db');

const ALLOWED_COLORS = ['#e8493f', '#ffffff'];
const MAX_STROKES = 200;
const MAX_POINTS_PER_STROKE = 2000;
const MAX_POINTS_TOTAL = 40000;
const MAX_NOTE_LENGTH = 1000;

function round(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Validate and normalise a strokes payload from the client.
 * Returns { strokes } or { error }.
 */
function sanitizeStrokes(input) {
  if (!Array.isArray(input)) return { error: 'strokes must be an array' };
  if (input.length > MAX_STROKES) return { error: `At most ${MAX_STROKES} strokes` };

  let total = 0;
  const strokes = [];
  for (const stroke of input) {
    if (!stroke || typeof stroke !== 'object') return { error: 'Invalid stroke' };
    const color = String(stroke.color || '').toLowerCase();
    if (!ALLOWED_COLORS.includes(color)) return { error: 'Invalid stroke color' };
    const width = Number(stroke.width);
    if (!Number.isFinite(width) || width <= 0 || width > 0.05) return { error: 'Invalid stroke width' };
    if (!Array.isArray(stroke.points) || stroke.points.length === 0) return { error: 'Invalid stroke points' };
    if (stroke.points.length > MAX_POINTS_PER_STROKE) return { error: 'Stroke too long' };
    total += stroke.points.length;
    if (total > MAX_POINTS_TOTAL) return { error: 'Drawing too large' };

    const points = [];
    for (const p of stroke.points) {
      if (!Array.isArray(p) || p.length !== 2) return { error: 'Invalid point' };
      const [x, y] = p.map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        return { error: 'Point out of range' };
      }
      points.push([round(x), round(y)]);
    }
    strokes.push({ color, width: round(width), points });
  }
  return { strokes };
}

function sanitizeNote(note) {
  if (note === undefined || note === null) return null;
  const text = String(note).replace(/[<>]/g, '').trim().slice(0, MAX_NOTE_LENGTH);
  return text.length ? text : null;
}

function parseRow(row) {
  if (!row) return null;
  let strokes = [];
  try {
    strokes = JSON.parse(row.strokes);
  } catch {
    strokes = [];
  }
  return { ...row, strokes };
}

async function getGuestAnnotation(photoId, guestIdentifier) {
  const row = await db('photo_annotations')
    .where({ photo_id: photoId, guest_identifier: guestIdentifier })
    .first();
  return parseRow(row);
}

/**
 * Save (or replace) a guest's drawing on a photo. An empty drawing without
 * a note deletes the row, so "clear + save" really removes it.
 */
async function saveGuestAnnotation(photoId, eventId, guestIdentifier, data) {
  const where = { photo_id: photoId, guest_identifier: guestIdentifier };
  if (data.strokes.length === 0 && !data.note) {
    await db('photo_annotations').where(where).del();
    return null;
  }

  const values = {
    event_id: eventId,
    guest_id: data.guest_id ?? null,
    guest_name: data.guest_name ? String(data.guest_name).slice(0, 100) : null,
    guest_email: data.guest_email ? String(data.guest_email).slice(0, 255) : null,
    strokes: JSON.stringify(data.strokes),
    note: data.note,
    updated_at: new Date()
  };

  const existing = await db('photo_annotations').where(where).first();
  if (existing) {
    await db('photo_annotations').where({ id: existing.id }).update(values);
  } else {
    await db('photo_annotations').insert({ ...where, ...values, created_at: new Date() });
  }
  return getGuestAnnotation(photoId, guestIdentifier);
}

async function getEventAnnotations(eventId, photoId) {
  const query = db('photo_annotations as a')
    .join('photos as p', 'p.id', 'a.photo_id')
    .where('a.event_id', eventId)
    .select(
      'a.id', 'a.photo_id', 'a.guest_name', 'a.guest_email', 'a.strokes', 'a.note',
      'a.created_at', 'a.updated_at',
      'p.filename', 'p.original_filename'
    )
    .orderBy('a.updated_at', 'desc');
  if (photoId) query.andWhere('a.photo_id', photoId);
  const rows = await query;
  return rows.map(parseRow);
}

async function deleteAnnotation(eventId, annotationId) {
  return db('photo_annotations').where({ id: annotationId, event_id: eventId }).del();
}

module.exports = {
  ALLOWED_COLORS,
  sanitizeStrokes,
  sanitizeNote,
  getGuestAnnotation,
  saveGuestAnnotation,
  getEventAnnotations,
  deleteAnnotation
};
