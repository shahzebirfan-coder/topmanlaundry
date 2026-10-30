/* ============================================================
   Sound Effects — Tiny embedded beeps, no external files
   Uses Web Audio API to generate sounds on the fly.
   ============================================================ */

const SoundFX = {
  enabled: true,
  ctx: null,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { this.ctx = null; }
  },

  isOn() {
    if (typeof DB !== 'undefined' && DB.settings) {
      return DB.settings().soundEffects !== false;
    }
    return this.enabled;
  },

  play(type) {
    if (!this.isOn()) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const presets = {
        success:  { freq: [523, 783], dur: 0.12, type: 'sine' },     // C5 -> G5 ding
        cash:     { freq: [1046, 1318, 1568], dur: 0.18, type: 'square' }, // cha-ching
        error:    { freq: [220, 196], dur: 0.2, type: 'sawtooth' },  // low buzz
        warning:  { freq: [440], dur: 0.3, type: 'triangle' },        // beep
        click:    { freq: [800], dur: 0.05, type: 'sine' },           // tick
        whoosh:   { freq: [1500, 600], dur: 0.15, type: 'sine' },     // sent
        notify:   { freq: [880, 1100], dur: 0.2, type: 'sine' }       // ding
      };
      const p = presets[type] || presets.click;
      const now = this.ctx.currentTime;
      p.freq.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = p.type;
        osc.frequency.setValueAtTime(f, now + i*p.dur);
        gain.gain.setValueAtTime(0, now + i*p.dur);
        gain.gain.linearRampToValueAtTime(0.15, now + i*p.dur + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i+1)*p.dur);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(now + i*p.dur);
        osc.stop(now + (i+1)*p.dur);
      });
    } catch(e){}
  }
};

// Auto-init on first user interaction (browsers require this)
document.addEventListener('click', () => { if (!SoundFX.ctx) SoundFX.init(); }, { once: true });

// Helper functions
function playSound(type) { SoundFX.play(type); }

// Hook into toast() for automatic sounds
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (typeof toast === 'function') {
      const origToast = toast;
      window.toast = function(msg, type='success') {
        SoundFX.play(type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success');
        return origToast(msg, type);
      };
    }
  }, 500);
}
