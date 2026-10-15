// artefakt fork: admin tab listing the pen annotations guests drew on photos.
import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Download, Trash2, PenLine, Loader2 } from 'lucide-react';
import { AdminAuthenticatedImage } from '../../../components/admin/AdminAuthenticatedImage';
import { AnnotationOverlay, strokeToPath } from '../../../components/gallery/AnnotationOverlay';
import { annotationService, type AdminAnnotation } from '../../../services/annotation.service';
import type { AdminPhoto } from '../../../services/photos.service';

interface AnnotationsTabProps {
  eventId: string;
  photos: AdminPhoto[];
}

function baseName(a: AdminAnnotation) {
  return (a.original_filename || a.filename || `foto-${a.photo_id}`).replace(/\.[^.]+$/, '');
}

const AnnotationCard: React.FC<{
  annotation: AdminAnnotation;
  photo?: AdminPhoto;
  onDelete: () => void;
}> = ({ annotation, photo, onDelete }) => {
  const [aspect, setAspect] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Flatten photo + drawing into one PNG, e.g. as a retouching reference.
  const exportPng = async () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const viewH = 1000 / (w / h);
    const scale = w / 1000;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of annotation.strokes) {
      const path = new Path2D(strokeToPath(s, viewH));
      ctx.save();
      ctx.scale(scale, scale);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * 1000;
      if (s.color === '#ffffff') {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 2;
      }
      ctx.stroke(path);
      ctx.restore();
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${baseName(annotation)}_markierung.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  };

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
      <div className="relative bg-neutral-900 flex items-center justify-center">
        {photo ? (
          <div className="relative inline-block max-w-full">
            <AdminAuthenticatedImage
              src={photo.url}
              alt={annotation.filename}
              className="block max-w-full max-h-[60vh] w-auto h-auto"
              onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
                const el = e.currentTarget;
                imgRef.current = el;
                if (el.naturalWidth && el.naturalHeight) setAspect(el.naturalWidth / el.naturalHeight);
              }}
            />
            {aspect && (
              <AnnotationOverlay strokes={annotation.strokes} aspect={aspect} className="absolute inset-0 w-full h-full" />
            )}
          </div>
        ) : (
          <div className="p-8 text-neutral-400 text-sm">Foto nicht gefunden</div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {annotation.original_filename || annotation.filename}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {annotation.guest_name || 'Gast'}
              {annotation.guest_email ? ` · ${annotation.guest_email}` : ''}
              {' · '}
              {new Date(annotation.updated_at).toLocaleString('de-CH')}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={exportPng}
              disabled={!aspect}
              className="p-2 rounded-md bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 disabled:opacity-50"
              title="Als PNG speichern"
              aria-label="Als PNG speichern"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 rounded-md bg-neutral-100 dark:bg-neutral-700 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600"
              title="Markierung löschen"
              aria-label="Markierung löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {annotation.note && (
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap border-l-2 border-accent pl-3">
            {annotation.note}
          </p>
        )}
      </div>
    </div>
  );
};

export const AnnotationsTab: React.FC<AnnotationsTabProps> = ({ eventId, photos }) => {
  const queryClient = useQueryClient();
  const { data: annotations = [], isLoading } = useQuery({
    queryKey: ['admin-event-annotations', eventId],
    queryFn: () => annotationService.listForEvent(eventId),
  });

  const remove = async (a: AdminAnnotation) => {
    if (!window.confirm('Diese Markierung wirklich löschen?')) return;
    try {
      await annotationService.remove(eventId, a.id);
      queryClient.invalidateQueries({ queryKey: ['admin-event-annotations', eventId] });
      toast.success('Markierung gelöscht');
    } catch {
      toast.error('Markierung konnte nicht gelöscht werden');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (annotations.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500 dark:text-neutral-400">
        <PenLine className="w-8 h-8 mx-auto mb-3 opacity-60" />
        <p>Noch keine Markierungen.</p>
        <p className="text-sm mt-1">
          Kunden können in der Bildansicht mit dem Stift-Symbol Stellen im Bild markieren
          (Kommentare müssen dafür erlaubt sein).
        </p>
      </div>
    );
  }

  const byId = new Map(photos.map((p) => [p.id, p]));
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {annotations.map((a) => (
        <AnnotationCard key={a.id} annotation={a} photo={byId.get(a.photo_id)} onDelete={() => remove(a)} />
      ))}
    </div>
  );
};
