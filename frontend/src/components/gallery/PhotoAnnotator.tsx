// artefakt fork: full-screen pen tool. Guests circle or mark areas of a photo
// in red or white with the mouse, a finger or a stylus, add an optional note,
// and save. The drawing is stored per guest and photo (see annotation.service).
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { X, Undo2, Trash2, Check, Loader2 } from 'lucide-react';
import type { Photo } from '../../types';
import { AuthenticatedImage } from '../common';
import { lightboxImageUrl } from './imageTiers';
import { AnnotationOverlay } from './AnnotationOverlay';
import {
  annotationService,
  type AnnotationColor,
  type AnnotationStroke,
} from '../../services/annotation.service';

const COLORS: { value: AnnotationColor; de: string; en: string }[] = [
  { value: '#e8493f', de: 'Rot', en: 'Red' },
  { value: '#ffffff', de: 'Weiss', en: 'White' },
];

// Line width relative to the photo width: thin enough to circle a detail,
// thick enough to read on a phone.
const STROKE_WIDTH = 0.006;

const TEXT = {
  de: {
    title: 'Im Bild markieren',
    hint: 'Mit Maus, Finger oder Stift Stellen einkreisen oder markieren.',
    undo: 'Rückgängig',
    clear: 'Alles löschen',
    note: 'Notiz zum Bild (optional), z. B. „Hier bitte retuschieren“',
    cancel: 'Abbrechen',
    save: 'Speichern',
    saved: 'Markierung gespeichert',
    removed: 'Markierung entfernt',
    error: 'Markierung konnte nicht gespeichert werden',
    loadError: 'Markierung konnte nicht geladen werden',
  },
  en: {
    title: 'Mark up photo',
    hint: 'Circle or mark areas with your mouse, finger or stylus.',
    undo: 'Undo',
    clear: 'Clear all',
    note: 'Note for this photo (optional), e.g. “please retouch here”',
    cancel: 'Cancel',
    save: 'Save',
    saved: 'Markup saved',
    removed: 'Markup removed',
    error: 'Could not save the markup',
    loadError: 'Could not load the markup',
  },
};

interface PhotoAnnotatorProps {
  photo: Photo;
  slug: string;
  identity?: { name: string; email: string } | null;
  onClose: () => void;
  onSaved?: (hasAnnotation: boolean) => void;
}

export const PhotoAnnotator: React.FC<PhotoAnnotatorProps> = ({ photo, slug, identity, onClose, onSaved }) => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('de') ? 'de' : 'en';
  const txt = TEXT[lang];

  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [note, setNote] = useState('');
  const [color, setColor] = useState<AnnotationColor>('#e8493f');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aspect, setAspect] = useState<number>(
    photo.width && photo.height ? photo.width / photo.height : 1.5
  );

  // Fit the photo into the stage like object-contain, but with a known box
  // so the drawing surface lines up with the pixels exactly.
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const fitW = Math.min(w, h * aspect);
      setBox({ w: Math.floor(fitW), h: Math.floor(fitW / aspect) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  useEffect(() => {
    let cancelled = false;
    annotationService
      .getMine(slug, photo.id)
      .then((data) => {
        if (cancelled) return;
        setStrokes(data.strokes || []);
        setNote(data.note || '');
      })
      .catch(() => {
        if (!cancelled) toast.error(txt.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, photo.id]);

  // Esc closes; the lightbox's own shortcuts are suspended while we're open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setStrokes((s) => s.slice(0, -1));
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // --- drawing -------------------------------------------------------------
  const drawingRef = useRef<{ pointerId: number; stroke: AnnotationStroke } | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const toPoint = (e: PointerEvent | React.PointerEvent): [number, number] => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return [x, y];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    surfaceRef.current?.setPointerCapture(e.pointerId);
    const stroke: AnnotationStroke = { color, width: STROKE_WIDTH, points: [toPoint(e)] };
    drawingRef.current = { pointerId: e.pointerId, stroke };
    setStrokes((s) => [...s, stroke]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== e.pointerId) return;
    const native = e.nativeEvent as PointerEvent;
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    const pts = drawing.stroke.points;
    for (const ev of events.length ? events : [native]) {
      const p = toPoint(ev);
      const last = pts[pts.length - 1];
      // Skip sub-pixel jitter to keep the stored drawing small.
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) > 0.0015) pts.push(p);
    }
    // New array identity so React re-renders the live stroke.
    setStrokes((s) => [...s.slice(0, -1), { ...drawing.stroke, points: [...pts] }]);
  };

  const endStroke = (e: React.PointerEvent) => {
    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== e.pointerId) return;
    drawingRef.current = null;
    if (drawing.stroke.points.length > 2000) {
      drawing.stroke.points = drawing.stroke.points.filter((_, i, a) => i % 2 === 0 || i === a.length - 1);
      setStrokes((s) => [...s.slice(0, -1), { ...drawing.stroke }]);
    }
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const result = await annotationService.save(slug, photo.id, {
        strokes,
        note: note.trim() || null,
        guest_name: identity?.name,
        guest_email: identity?.email,
      });
      const has = (result.strokes?.length ?? 0) > 0 || !!result.note;
      toast.success(has ? txt.saved : txt.removed);
      onSaved?.(has);
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      toast.error(status === 429 ? `${txt.error} (Limit)` : txt.error);
    } finally {
      setSaving(false);
    }
  }, [slug, photo.id, strokes, note, identity, onClose, onSaved, txt]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={txt.title}
      // Keep lightbox gestures (swipe, zoom) from seeing our events.
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{txt.title}</h2>
          <p className="text-xs text-white/60 truncate">{txt.hint}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20"
          aria-label={txt.cancel}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div ref={stageRef} className="relative flex-1 min-h-0 m-3 flex items-center justify-center">
        {box.w > 0 && (
          <div className="relative" style={{ width: box.w, height: box.h }}>
            <AuthenticatedImage
              queuePriority="high"
              src={lightboxImageUrl(photo)}
              alt={photo.filename}
              fallbackSrc={photo.thumbnail_url || undefined}
              className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
              draggable={false}
              isGallery={true}
              slug={slug}
              onLoad={({ width, height }) => {
                if (width && height) setAspect(width / height);
              }}
            />
            <AnnotationOverlay strokes={strokes} aspect={aspect} className="absolute inset-0 w-full h-full" />
            <div
              ref={surfaceRef}
              className="absolute inset-0"
              style={{ touchAction: 'none', cursor: 'crosshair' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 border-t border-white/10 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`w-9 h-9 rounded-full border-2 transition-transform ${
                color === c.value ? 'border-white scale-110' : 'border-white/30'
              }`}
              style={{ backgroundColor: c.value }}
              aria-label={c[lang]}
              aria-pressed={color === c.value}
              title={c[lang]}
            />
          ))}
          <div className="w-px h-6 bg-white/20 mx-1" />
          <button
            onClick={() => setStrokes((s) => s.slice(0, -1))}
            disabled={strokes.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-sm"
          >
            <Undo2 className="w-4 h-4" /> {txt.undo}
          </button>
          <button
            onClick={() => setStrokes([])}
            disabled={strokes.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-sm"
          >
            <Trash2 className="w-4 h-4" /> {txt.clear}
          </button>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 1000))}
          rows={2}
          placeholder={txt.note}
          className="w-full rounded-md bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/40"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm">
            {txt.cancel}
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent, #c4a26a)', color: '#1e1e1e' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {txt.save}
          </button>
        </div>
      </div>
    </div>
  );
};
