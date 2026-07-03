// 16-Bit Polyphonic Web Audio API Synthesizer for Platformer Game
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Helper to make sure context is running
function resumeAudio() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Noise generator for retro explosions and sweeps
function createNoiseBuffer() {
  const bufferSize = audioCtx.sampleRate * 0.45; // 0.45 seconds
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

const noiseBuffer = createNoiseBuffer();

// Helper to spawn a detuned 16-bit double oscillator with sub-bass
function play16BitVoice(freq, type, duration, gainVal, sweepEndFreq = null) {
  const now = audioCtx.currentTime;
  
  // Carrier 1
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = type;
  osc1.frequency.setValueAtTime(freq, now);
  osc1.detune.setValueAtTime(-5, now); // Detuned left
  
  // Carrier 2 (Detuned right for chorus effect)
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = type;
  osc2.frequency.setValueAtTime(freq, now);
  osc2.detune.setValueAtTime(5, now);
  
  // Sub-Oscillator (warm triangle 1 octave below)
  const subOsc = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  subOsc.type = 'triangle';
  subOsc.frequency.setValueAtTime(freq / 2, now);
  
  if (sweepEndFreq) {
    osc1.frequency.exponentialRampToValueAtTime(sweepEndFreq, now + duration);
    osc2.frequency.exponentialRampToValueAtTime(sweepEndFreq, now + duration);
    subOsc.frequency.exponentialRampToValueAtTime(sweepEndFreq / 2, now + duration);
  }
  
  // Set volume envelope
  gain1.gain.setValueAtTime(gainVal * 0.4, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  gain2.gain.setValueAtTime(gainVal * 0.4, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  subGain.gain.setValueAtTime(gainVal * 0.3, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  // Connect and start
  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);
  
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  
  subOsc.connect(subGain);
  subGain.connect(audioCtx.destination);
  
  osc1.start(now);
  osc1.stop(now + duration + 0.05);
  osc2.start(now);
  osc2.stop(now + duration + 0.05);
  subOsc.start(now);
  subOsc.stop(now + duration + 0.05);
}

window.AudioEffects = {
  playJump() {
    resumeAudio();
    // Warm 16-bit double sweep (sawtooth chorus)
    play16BitVoice(140, 'sawtooth', 0.16, 0.18, 550);
  },

  playBaseballThrow() {
    resumeAudio();
    // High-pitched 16-bit FM-style square whistle
    play16BitVoice(320, 'square', 0.12, 0.12, 1000);
  },

  playDrum() {
    resumeAudio();
    // Warm detuned bass kick thump
    play16BitVoice(110, 'triangle', 0.18, 0.28, 35);
    
    // Snare white noise splash
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const gainNoise = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, audioCtx.currentTime);

    gainNoise.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);

    noiseSource.connect(filter);
    filter.connect(gainNoise);
    gainNoise.connect(audioCtx.destination);

    noiseSource.start();
    noiseSource.stop(audioCtx.currentTime + 0.22);
  },

  playHit() {
    resumeAudio();
    // Low-pass filtered noise crash explosion + sub pitch thump
    play16BitVoice(90, 'sawtooth', 0.26, 0.25, 30);
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noiseSource.start();
    noiseSource.stop(audioCtx.currentTime + 0.28);
  },

  playBounce() {
    resumeAudio();
    // Rubbery frequency bounce sweep with detuned triangle chorus
    const now = audioCtx.currentTime;
    play16BitVoice(160, 'triangle', 0.18, 0.22, 280);
  },

  playBasketballThrow() {
    resumeAudio();
    // Rubbery swish chime
    play16BitVoice(440, 'sine', 0.14, 0.12, 700);
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noiseSource.start();
    noiseSource.stop(audioCtx.currentTime + 0.14);
  },

  playBasketballBounce() {
    resumeAudio();
    // Warm, deep rubbery bounce sweep
    play16BitVoice(150, 'triangle', 0.14, 0.25, 45);
  },

  playWin() {
    resumeAudio();
    const now = audioCtx.currentTime;
    // 16-bit polyphonic victory chords! (C Major scale triads)
    const chords = [
      [261.63, 329.63, 392.00], // C Major
      [293.66, 349.23, 440.00], // D minor
      [329.63, 392.00, 493.88], // E minor
      [523.25, 659.25, 783.99]  // C Major (Octave up)
    ];
    
    chords.forEach((chord, chordIdx) => {
      chord.forEach((freq) => {
        const timeOffset = chordIdx * 0.12;
        // Detuned square wave voices for each note in the chord!
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(freq, now + timeOffset);
        osc1.detune.setValueAtTime(-6, now + timeOffset);
        
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(freq, now + timeOffset);
        osc2.detune.setValueAtTime(6, now + timeOffset);

        gain.gain.setValueAtTime(0.06, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.24);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start(now + timeOffset);
        osc1.stop(now + timeOffset + 0.24);
        osc2.start(now + timeOffset);
        osc2.stop(now + timeOffset + 0.24);
      });
    });
  },

  playLose() {
    resumeAudio();
    const now = audioCtx.currentTime;
    // Sad 16-bit descending polyphonic chords (G minor -> C minor -> D diminished)
    const chords = [
      [392.00, 466.16, 587.33], // G minor
      [349.23, 415.30, 523.25], // F minor
      [293.66, 349.23, 440.00]  // D minor
    ];
    
    chords.forEach((chord, chordIdx) => {
      chord.forEach((freq) => {
        const timeOffset = chordIdx * 0.2;
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, now + timeOffset);
        osc1.detune.setValueAtTime(-8, now + timeOffset);
        
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, now + timeOffset);
        osc2.detune.setValueAtTime(8, now + timeOffset);

        gain.gain.setValueAtTime(0.05, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start(now + timeOffset);
        osc1.stop(now + timeOffset + 0.35);
        osc2.start(now + timeOffset);
        osc2.stop(now + timeOffset + 0.35);
      });
    });
  },

  playGuitarShred() {
    resumeAudio();
    const now = audioCtx.currentTime;
    const freqs = [196.00, 233.08, 293.66, 392.00, 466.16];
    freqs.forEach((freq, idx) => {
      const timeOffset = idx * 0.05;
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const subOsc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, now + timeOffset);
      osc1.frequency.exponentialRampToValueAtTime(freq * 1.05, now + timeOffset + 0.15);
      osc1.detune.setValueAtTime(-10, now + timeOffset);
      
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq, now + timeOffset);
      osc2.frequency.exponentialRampToValueAtTime(freq * 1.05, now + timeOffset + 0.15);
      osc2.detune.setValueAtTime(10, now + timeOffset);
      
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(freq / 2, now + timeOffset);

      gain.gain.setValueAtTime(0.06, now + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      subOsc.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.start(now + timeOffset);
      osc1.stop(now + timeOffset + 0.22);
      osc2.start(now + timeOffset);
      osc2.stop(now + timeOffset + 0.22);
      subOsc.start(now + timeOffset);
      subOsc.stop(now + timeOffset + 0.22);
    });
  },
  
  playMonsterTruck() {
    resumeAudio();
    const now = audioCtx.currentTime;
    
    // Polyphonic detuned engine hum
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(60, now);
    osc1.frequency.linearRampToValueAtTime(190, now + 0.16);
    osc1.frequency.linearRampToValueAtTime(80, now + 0.35);
    osc1.detune.setValueAtTime(-12, now);
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(60, now);
    osc2.frequency.linearRampToValueAtTime(190, now + 0.16);
    osc2.frequency.linearRampToValueAtTime(80, now + 0.35);
    osc2.detune.setValueAtTime(12, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.35);
    osc2.start(now);
    osc2.stop(now + 0.35);
  }
};
