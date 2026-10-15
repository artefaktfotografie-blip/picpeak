// artefakt fork: ask a guest for name/email once per gallery, not per photo.
// The identity is kept in localStorage per gallery slug and shared live
// between every component that asks for it (colour labels, favourites,
// comments, pen tool, …), so answering the prompt once covers them all.
import { useCallback, useEffect, useState } from 'react';

export type GuestIdentity = { name: string; email: string };

const EVENT = 'artefakt:guest-identity';
const keyFor = (slug?: string) => `artefakt.guestIdentity.${slug || 'default'}`;

export function readRememberedGuestIdentity(slug?: string): GuestIdentity | null {
  try {
    const raw = localStorage.getItem(keyFor(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string' && typeof parsed.email === 'string') return parsed;
  } catch {
    // Private mode or blocked storage: fall back to asking again.
  }
  return null;
}

export function useRememberedGuestIdentity(slug?: string) {
  const [identity, setIdentityState] = useState<GuestIdentity | null>(() => readRememberedGuestIdentity(slug));

  useEffect(() => {
    setIdentityState(readRememberedGuestIdentity(slug));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ slug?: string; identity: GuestIdentity | null }>).detail;
      if (detail && keyFor(detail.slug) === keyFor(slug)) setIdentityState(detail.identity);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [slug]);

  const setIdentity = useCallback(
    (next: GuestIdentity | null) => {
      setIdentityState(next);
      try {
        if (next) localStorage.setItem(keyFor(slug), JSON.stringify(next));
        else localStorage.removeItem(keyFor(slug));
      } catch {
        // Storage unavailable: still remembered for this page view.
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { slug, identity: next } }));
    },
    [slug]
  );

  return [identity, setIdentity] as const;
}
