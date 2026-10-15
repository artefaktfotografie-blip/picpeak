// artefakt fork: renders pen annotations as an SVG laid exactly over a photo.
import React from 'react';
import type { AnnotationStroke } from '../../services/annotation.service';

// The SVG uses a 1000-unit wide coordinate space; the height follows the
// photo's aspect ratio so stroke widths stay round (no non-uniform scaling).
const VIEW_W = 1000;

export function strokeToPath(stroke: AnnotationStroke, viewH: number): string {
  const pts = stroke.points;
  if (pts.length === 0) return '';
  const x = (p: [number, number]) => (p[0] * VIEW_W).toFixed(1);
  const y = (p: [number, number]) => (p[1] * viewH).toFixed(1);
  if (pts.length === 1) {
    // A tap: draw a dot as a zero-length line (round caps make it visible).
    return `M${x(pts[0])} ${y(pts[0])}L${x(pts[0])} ${y(pts[0])}`;
  }
  let d = `M${x(pts[0])} ${y(pts[0])}`;
  for (let i = 1; i < pts.length; i++) d += `L${x(pts[i])} ${y(pts[i])}`;
  return d;
}

interface AnnotationOverlayProps {
  strokes: AnnotationStroke[];
  // width / height of the photo
  aspect: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({ strokes, aspect, className, style }) => {
  const viewH = VIEW_W / (aspect || 1);
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${viewH.toFixed(1)}`}
      preserveAspectRatio="none"
      className={className}
      style={{ pointerEvents: 'none', ...style }}
      aria-hidden="true"
    >
      {strokes.map((s, i) => (
        <path
          key={i}
          d={strokeToPath(s, viewH)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width * VIEW_W}
          strokeLinecap="round"
          strokeLinejoin="round"
          // A faint dark halo keeps white strokes readable on bright areas.
          style={{ filter: s.color === '#ffffff' ? 'drop-shadow(0 0 1.5px rgba(0,0,0,0.6))' : undefined }}
        />
      ))}
    </svg>
  );
};
