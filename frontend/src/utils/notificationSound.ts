/**
 * Professional Notification Sound Generator
 * 
 * Uses Web Audio API to generate a clean, professional two-tone chime
 * suitable for a medical/healthcare SaaS application.
 * 
 * This replaces the raw base64 WAV approach with a synthesized sound
 * that is higher quality and smaller in bundle size.
 * 
 * @module utils/notificationSound
 * @version 1.0.0
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Play a professional two-tone notification chime.
 * 
 * Sound design: Two ascending sine tones (E5 → G5) with smooth
 * attack/decay envelope. Clean, pleasant, and non-intrusive.
 * Duration: ~400ms total.
 */
export function playNotificationChime(volume = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Master gain
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volume, now);
  masterGain.connect(ctx.destination);

  // Tone 1: E5 (659.25 Hz) — starts immediately
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now);
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.6, now + 0.02);  // Quick attack
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25); // Smooth decay
  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.25);

  // Tone 2: G5 (783.99 Hz) — starts slightly after
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(783.99, now + 0.12);
  gain2.gain.setValueAtTime(0, now + 0.12);
  gain2.gain.linearRampToValueAtTime(0.5, now + 0.14);  // Quick attack
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.42); // Smooth decay
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.42);

  // Subtle harmonic overlay for richness (E6, very quiet)
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(1318.51, now);
  gain3.gain.setValueAtTime(0, now);
  gain3.gain.linearRampToValueAtTime(0.08, now + 0.02);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc3.connect(gain3);
  gain3.connect(masterGain);
  osc3.start(now);
  osc3.stop(now + 0.2);
}

export default playNotificationChime;
