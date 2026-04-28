/**
 * Avatar storage.
 *
 * Per-user base64 avatars are kept in localStorage (key
 * `nr_avatar_<userId>`). This mirrors the SleepReach pattern: no backend
 * upload endpoint required, avatar survives across sessions on the same
 * browser. 4 MB cap preserves profile-photo clarity while keeping the
 * localStorage footprint bounded.
 */

import { useEffect, useState } from 'react';

const KEY_PREFIX = 'nr_avatar_';
export const AVATAR_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
export const AVATAR_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function readAvatar(userId: string | undefined | null): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

export function writeAvatar(userId: string, dataUrl: string): void {
  localStorage.setItem(storageKey(userId), dataUrl);
  window.dispatchEvent(new CustomEvent('nr:avatar-changed', { detail: { userId } }));
}

export function clearAvatar(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // Ignore.
  }
  window.dispatchEvent(new CustomEvent('nr:avatar-changed', { detail: { userId } }));
}

/**
 * React hook: returns the current avatar data URL for a user id, and re-renders
 * when it changes (via `storage` event for other tabs, and our custom event
 * for the current tab).
 */
export function useAvatar(userId: string | undefined | null): string | null {
  const [src, setSrc] = useState<string | null>(() => readAvatar(userId));

  useEffect(() => {
    setSrc(readAvatar(userId));
    if (!userId) return;
    const key = storageKey(userId);

    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setSrc(e.newValue);
    };
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<{ userId: string }>).detail;
      if (detail?.userId === userId) setSrc(readAvatar(userId));
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('nr:avatar-changed', onLocal as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('nr:avatar-changed', onLocal as EventListener);
    };
  }, [userId]);

  return src;
}

/**
 * Reads a File into a base64 data URL, validating type + size first.
 * Resolves with the data URL or rejects with a user-friendly message.
 */
export function readFileAsAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      reject(new Error('Unsupported file type. Use PNG, JPEG, WebP, or GIF.'));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      reject(new Error('File is too large. Maximum size is 4 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected file reader result.'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Deterministic small avatar fallback initials.
 */
export function initialsFor(firstName?: string | null, lastName?: string | null): string {
  const a = (firstName || '').trim().charAt(0).toUpperCase();
  const b = (lastName || '').trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}
