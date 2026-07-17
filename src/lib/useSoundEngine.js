'use client';

import { useRef, useCallback } from 'react';

/**
 * useSoundEngine
 * A pure Web Audio API sound engine for the QuizPresenter platform.
 * No external libraries required. Generates all sounds procedurally.
 */
export function useSoundEngine() {
  const audioCtxRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Helper: play a single tone
  const playTone = useCallback((frequency, duration, type = 'sine', gainVal = 0.3, startDelay = 0) => {
    try {
      const ctx = getCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startDelay);

      gainNode.gain.setValueAtTime(0, ctx.currentTime + startDelay);
      gainNode.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + startDelay + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);

      oscillator.start(ctx.currentTime + startDelay);
      oscillator.stop(ctx.currentTime + startDelay + duration);
    } catch (e) {
      console.warn('Sound playback error:', e);
    }
  }, [getCtx]);

  // 🎵 TICK — each second during countdown
  const playTick = useCallback(() => {
    playTone(880, 0.08, 'square', 0.15);
  }, [playTone]);

  // 🔴 URGENT TICK — last 5 seconds, louder and lower
  const playUrgentTick = useCallback(() => {
    playTone(440, 0.12, 'square', 0.35);
    playTone(660, 0.06, 'sine', 0.1, 0.06);
  }, [playTone]);

  // 🔔 BUZZER — timer hits zero
  const playBuzzer = useCallback(() => {
    try {
      const ctx = getCtx();
      // Create a noisy buzzer sound
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120 + i * 40, ctx.currentTime + i * 0.2);
        osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + i * 0.2 + 0.3);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.35);
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.4);
      }
    } catch (e) {
      console.warn('Buzzer error:', e);
    }
  }, [getCtx]);

  // ✅ CORRECT ANSWER CHIME — ascending triumphant notes
  const playCorrectChime = useCallback(() => {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      playTone(freq, 0.25, 'sine', 0.3, i * 0.1);
    });
  }, [playTone]);

  // 💰 SCORE DING — points added
  const playScoreDing = useCallback(() => {
    playTone(1047, 0.1, 'sine', 0.25);
    playTone(1319, 0.15, 'sine', 0.2, 0.08);
  }, [playTone]);

  // 💸 SCORE SUBTRACT — points removed
  const playScoreSubtract = useCallback(() => {
    playTone(300, 0.15, 'sine', 0.25);
    playTone(220, 0.2, 'sine', 0.2, 0.1);
  }, [playTone]);

  // 🚀 QUESTION SELECT — whoosh on board click
  const playQuestionSelect = useCallback(() => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn('Select sound error:', e);
    }
  }, [getCtx]);

  // 🎺 ROUND FANFARE — round change announcement
  const playRoundFanfare = useCallback(() => {
    const melody = [
      { f: 523, t: 0, d: 0.15 },
      { f: 659, t: 0.12, d: 0.15 },
      { f: 784, t: 0.24, d: 0.15 },
      { f: 1047, t: 0.36, d: 0.4 },
    ];
    melody.forEach(({ f, t, d }) => playTone(f, d, 'triangle', 0.35, t));
  }, [playTone]);

  // 🏁 START — timer starts
  const playTimerStart = useCallback(() => {
    playTone(660, 0.1, 'sine', 0.2);
    playTone(880, 0.15, 'sine', 0.18, 0.08);
  }, [playTone]);

  return {
    playTick,
    playUrgentTick,
    playBuzzer,
    playCorrectChime,
    playScoreDing,
    playScoreSubtract,
    playQuestionSelect,
    playRoundFanfare,
    playTimerStart,
  };
}
