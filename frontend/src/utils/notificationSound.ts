/**
 * Professional Notification Sound Generator
 * 
 * Uses Web Audio API to generate a clean, professional three-tone chime
 * suitable for a medical/healthcare SaaS application.
 * 
 * Chime design: E5 (659.25 Hz) → G5 (783.99 Hz) → B5 (987.77 Hz)
 * Three ascending sine tones forming a major-triad arpeggio.
 * Clean, pleasant, non-intrusive.  Duration: ~600ms total.
 * 
 * @module utils/notificationSound
 * @version 2.0.0
 */


let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext || audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext = new AudioContextClass();
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
 * Play a professional three-note ascending notification chime.
 *
 * Sound design: E5 → G5 → B5 major-triad arpeggio.
 * Each note has a snappy attack (20ms) and smooth exponential decay.
 * Notes are staggered 160ms apart; total duration ≈ 620ms.
 *
 *   Note  │ Freq (Hz) │ Start offset │ Stop offset
 *   ──────┼───────────┼──────────────┼────────────
 *   E5    │  659.25   │  0.000s      │  0.280s
 *   G5    │  783.99   │  0.160s      │  0.440s
 *   B5    │  987.77   │  0.320s      │  0.620s
 */
export function playNotificationChime(volume = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Master gain — controls overall volume
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volume, now);
  masterGain.connect(ctx.destination);

  // ── Note 1: E5 (659.25 Hz) ─────────────────────────────────────────────
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now);
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(0.65, now + 0.02);       // snappy attack
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.28);  // smooth decay
  osc1.connect(gain1);
  gain1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.28);

  // ── Note 2: G5 (783.99 Hz) ─────────────────────────────────────────────
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(783.99, now + 0.16);
  gain2.gain.setValueAtTime(0, now + 0.16);
  gain2.gain.linearRampToValueAtTime(0.55, now + 0.18);       // snappy attack
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.44);  // smooth decay
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc2.start(now + 0.16);
  osc2.stop(now + 0.44);

  // ── Note 3: B5 (987.77 Hz) — premium third tone ────────────────────────
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(987.77, now + 0.32);
  gain3.gain.setValueAtTime(0, now + 0.32);
  gain3.gain.linearRampToValueAtTime(0.45, now + 0.34);       // snappy attack
  gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.62);  // smooth, lingering decay
  osc3.connect(gain3);
  gain3.connect(masterGain);
  osc3.start(now + 0.32);
  osc3.stop(now + 0.62);
}


export default playNotificationChime;
