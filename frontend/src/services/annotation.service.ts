// artefakt fork: pen annotations guests draw on photos.
import { api } from '../config/api';

export type AnnotationColor = '#e8493f' | '#ffffff';

export interface AnnotationStroke {
  color: AnnotationColor;
  // Relative to the photo's width, so the line scales with the rendition.
  width: number;
  // Normalised to the photo: 0..1 on both axes.
  points: [number, number][];
}

export interface GuestAnnotation {
  strokes: AnnotationStroke[];
  note: string | null;
  updated_at: string | null;
}

export interface AdminAnnotation {
  id: number;
  photo_id: number;
  guest_name: string | null;
  guest_email: string | null;
  strokes: AnnotationStroke[];
  note: string | null;
  created_at: string;
  updated_at: string;
  filename: string;
  original_filename: string | null;
}

class AnnotationService {
  async getMine(slug: string, photoId: number | string): Promise<GuestAnnotation> {
    const response = await api.get(`/gallery/${slug}/photos/${photoId}/annotation`);
    return response.data;
  }

  async save(
    slug: string,
    photoId: number | string,
    data: { strokes: AnnotationStroke[]; note?: string | null; guest_name?: string; guest_email?: string }
  ): Promise<GuestAnnotation> {
    const response = await api.put(`/gallery/${slug}/photos/${photoId}/annotation`, data);
    return response.data;
  }

  async listForEvent(eventId: number | string, photoId?: number | string): Promise<AdminAnnotation[]> {
    const response = await api.get(`/admin/feedback/events/${eventId}/annotations`, {
      params: photoId ? { photo_id: photoId } : undefined,
    });
    return response.data.annotations;
  }

  async remove(eventId: number | string, annotationId: number): Promise<void> {
    await api.delete(`/admin/feedback/events/${eventId}/annotations/${annotationId}`);
  }
}

export const annotationService = new AnnotationService();
