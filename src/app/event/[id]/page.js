'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import styles from '../event.module.css';
import { useSoundEngine } from '@/lib/useSoundEngine';

// Custom SVG Icons mapper based on category ID
function getCategoryIcon(categoryId) {
  switch (categoryId) {
    case 'riddles':
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 1.63.74 3.08 1.91 4.05C5.35 12.04 5 12.48 5 13a2 2 0 0 0 4 0c0-.52-.35-.96-.91-1.45A5.485 5.485 0 0 0 10 7.5c0-.17-.01-.34-.03-.5" />
          <path d="M14.5 2A5.5 5.5 0 0 1 20 7.5c0 1.63-.74 3.08-1.91 4.05.56.49.91.93.91 1.45a2 2 0 0 1-4 0c0-.52.35-.96.91-1.45A5.485 5.485 0 0 1 14 7.5" />
          <path d="M12 9v9M9 16h6" />
        </svg>
      );
    case 'connections':
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      );
    case 'emojis':
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
    case 'analogies':
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="8 21 3 21 3 16" />
        </svg>
      );
    default:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

export default function PresenterScreen() {
  const params = useParams();
  const eventId = params.id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [timerVal, setTimerVal] = useState(20);
  const [showRoundOverlay, setShowRoundOverlay] = useState(false);
  const [roundOverlayText, setRoundOverlayText] = useState('');
  const [scoreFlashes, setScoreFlashes] = useState({});
  const [audioState, setAudioState] = useState('suspended');
  const localTimer = useRef(null);
  const prevTimerVal = useRef(null);
  const prevRound = useRef(null);
  const prevScores = useRef({});
  const sound = useSoundEngine();

  // Connect to SSE stream for zero-latency updates
  useEffect(() => {
    let eventSource = null;
    
    const connectSSE = () => {
      eventSource = new EventSource(`/api/event/${eventId}/stream`);
      
      eventSource.addEventListener('state', (e) => {
        const json = JSON.parse(e.data);
        setData(json);
        setLoading(false);
        
        // Sync local countdown clock
        const state = json.event.state;
        if (state.timerRunning && state.timerStartedAt) {
          const elapsed = Math.floor((Date.now() - new Date(state.timerStartedAt).getTime()) / 1000);
          const remaining = Math.max(0, state.timerDuration - elapsed);
          setTimerVal(remaining);
        } else {
          setTimerVal(state.timerRemaining);
        }
      });

      eventSource.onerror = (err) => {
        console.error('SSE Connection collapsed. Retrying in 3 seconds...', err);
        eventSource.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [eventId]);

  const handleUnlockAudio = () => {
    const state = sound.unlockAudio();
    setAudioState(state);
  };

  // Handle local countdown updates smoothly (run clock internally every 200ms)
  useEffect(() => {
    if (data?.event?.state?.timerRunning) {
      if (localTimer.current) clearInterval(localTimer.current);

      localTimer.current = setInterval(() => {
        const state = data.event.state;
        const elapsed = Math.floor((Date.now() - new Date(state.timerStartedAt).getTime()) / 1000);
        const remaining = Math.max(0, state.timerDuration - elapsed);
        setTimerVal(remaining);

        if (remaining <= 0) {
          clearInterval(localTimer.current);
        }
      }, 200);
    } else {
      if (localTimer.current) clearInterval(localTimer.current);
      if (data?.event?.state) {
        setTimerVal(data.event.state.timerRemaining);
      }
    }

    return () => {
      if (localTimer.current) clearInterval(localTimer.current);
    };
  }, [data?.event?.state?.timerRunning, data?.event?.state?.timerStartedAt]);

  // Canvas Confetti Loop Emitter when event is 'finished'
  useEffect(() => {
    if (!data || data.event.status !== 'finished') return;

    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#f43f5e', '#3b82f6', '#f59e0b', '#a855f7', '#10b981', '#6366f1'];
    const particles = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height - 20,
      r: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.08 + 0.02,
      tiltAngle: 0,
      speed: Math.random() * 3 + 2.5
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += p.speed;
        p.x += Math.sin(p.tiltAngle) * 0.5;
        p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;

        // Reset particle on boundary drop
        if (p.y > canvas.height) {
          p.x = Math.random() * canvas.width;
          p.y = -20;
        }

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
        ctx.stroke();
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [data?.event?.status]);

  // 🔊 SOUND: Fire tick sounds as timer counts down
  useEffect(() => {
    if (timerVal === null || timerVal === prevTimerVal.current) return;
    if (!data?.event?.state?.timerRunning) return;

    if (timerVal <= 0 && prevTimerVal.current > 0) {
      sound.playBuzzer();
    } else if (timerVal <= 5 && timerVal > 0) {
      sound.playUrgentTick();
    } else if (timerVal > 5) {
      sound.playTick();
    }
    prevTimerVal.current = timerVal;
  }, [timerVal]);

  // 🔊 SOUND + OVERLAY: Fire round fanfare when round changes
  useEffect(() => {
    const round = data?.event?.state?.currentRound;
    if (!round) return;
    if (prevRound.current !== null && prevRound.current !== round) {
      sound.playRoundFanfare();
      setRoundOverlayText(`Round ${round}`);
      setShowRoundOverlay(true);
      setTimeout(() => setShowRoundOverlay(false), 2500);
    }
    prevRound.current = round;
  }, [data?.event?.state?.currentRound]);

  // 🔊 SOUND: Fire score sounds on change + animate score flash
  useEffect(() => {
    if (!data?.event?.teams) return;
    const teams = data.event.teams;
    const newFlashes = {};
    teams.forEach(team => {
      const prev = prevScores.current[team.id];
      if (prev !== undefined && prev !== team.score) {
        const diff = team.score - prev;
        if (diff > 0) {
          sound.playScoreDing();
          newFlashes[team.id] = 'add';
        } else {
          sound.playScoreSubtract();
          newFlashes[team.id] = 'sub';
        }
      }
      prevScores.current[team.id] = team.score;
    });
    if (Object.keys(newFlashes).length > 0) {
      setScoreFlashes(newFlashes);
      setTimeout(() => setScoreFlashes({}), 800);
    }
  }, [data?.event?.teams]);

  // 🔊 SOUND: Fire question-select sound when a question becomes active
  const prevActiveQ = useRef(null);
  useEffect(() => {
    const qId = data?.event?.questionIds?.[data?.event?.currentQuestionIndex];
    if (qId && qId !== prevActiveQ.current && data?.event?.state?.showQuestion) {
      sound.playQuestionSelect();
    }
    prevActiveQ.current = qId;
  }, [data?.event?.state?.showQuestion]);

  // 🔊 SOUND: Fire timer start sound
  const prevTimerRunning = useRef(false);
  useEffect(() => {
    const running = data?.event?.state?.timerRunning;
    if (running && !prevTimerRunning.current) {
      sound.playTimerStart();
    }
    prevTimerRunning.current = running;
  }, [data?.event?.state?.timerRunning]);

  if (loading) {
    return (
      <main className={styles.fullScreen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', color: 'var(--text-muted)' }}>Loading presentation...</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className={styles.fullScreen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <h1 style={{ color: 'var(--danger)', fontSize: '3rem', marginBottom: '1.5rem' }}>Event Not Found</h1>
          <p style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>
            Ensure this event has been initialized in the Admin Panel.
          </p>
        </div>
      </main>
    );
  }

  const { event, activeQuestion, totalQuestions, categories, questions } = data;
  const isQuestionActive = activeQuestion !== null;
  const activeQuestionCategory = isQuestionActive ? categories.find(c => c.id === activeQuestion.categoryId) : null;
  const activeQuestionIcon = activeQuestionCategory?.icon || activeQuestion?.categoryId;
  const activeQuestionColor = activeQuestionCategory?.color || 'var(--primary)';
  const status = event.status;
  const completedQIds = event.state.completedQuestionIds || [];
  const currentRound = event.state.currentRound || 1;

  // Sorted teams for leaderboard standings podium
  const sortedTeams = [...event.teams].sort((a, b) => b.score - a.score);

  // SVG Circular progress values — 140px ring
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const timerDuration = event.state.timerDuration || 20;
  const percentageRemaining = Math.max(0, Math.min(1, timerVal / timerDuration));
  const strokeDashoffset = circumference - (percentageRemaining * circumference);
  const isTimeWarning = timerVal <= 5;
  const isTimeDanger = timerVal <= 10;
  // Dynamic ring color: indigo → amber → red
  const timerStrokeColor = timerVal <= 5 ? '#f43f5e' : timerVal <= 10 ? '#f59e0b' : '#4f46e5';

  return (
    <main className={styles.fullScreen}>

      {/* Floating Audio Unlock Controls */}
      {audioState === 'suspended' ? (
        <button
          onClick={handleUnlockAudio}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 1000,
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 16px',
            fontSize: '0.8rem',
            fontWeight: '800',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          🔇 Sound Blocked (Click to Enable)
        </button>
      ) : (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 1000,
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            borderRadius: '20px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}
        >
          🔊 Audio Active
        </div>
      )}

      {/* === ROUND ANNOUNCEMENT OVERLAY === */}
      {showRoundOverlay && (
        <div className={styles.roundOverlay}>
          <div className={styles.roundOverlayInner}>
            <span className={styles.roundOverlayEyebrow}>Get Ready!</span>
            <div className={styles.roundOverlayTitle}>{roundOverlayText}</div>
            <span className={styles.roundOverlaySubtext}>Begins Now</span>
          </div>
        </div>
      )}
      
      {/* Canvas element for Confetti celebration when event is finished */}
      {status === 'finished' && (
        <canvas
          id="confetti-canvas"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 99
          }}
        />
      )}

      {/* 1. LOBBY VIEW (Idle Event) */}
      {status === 'idle' && (
        <section className={`${styles.lobbyContainer} animate-fade`} aria-labelledby="lobby-title">
          <span className={styles.lobbySubtitle}>Welcome to</span>
          <h1 className={styles.lobbyTitle} id="lobby-title">{event.name}</h1>
          <p style={{ fontSize: '1.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Registered Teams
          </p>
          <div className={styles.lobbyTeamsGrid}>
            {event.teams.map(team => (
              <div
                key={team.id}
                className={styles.lobbyTeamCard}
                id={`lobby-team-${team.id}`}
                style={{
                  border: `2px solid ${team.color || 'var(--border-color)'}`,
                  boxShadow: `0 10px 30px ${(team.color || '#6366f1')}1a`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>{team.name}</span>
                {team.members && team.members.length > 0 && (
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    {team.members.join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '2rem', fontSize: '1.25rem', color: 'var(--text-muted)', animation: 'fadeIn 2s infinite' }}>
            Waiting for the host to start...
          </div>
        </section>
      )}

      {/* 2. ACTIVE VIEW */}
      {status === 'active' && (
        <>
          {/* Live Standings Presentation Screen */}
          {event.state.showStandings ? (
            <section className={`${styles.lobbyContainer} animate-fade`} aria-labelledby="live-standings-title" style={{ maxWidth: '900px', width: '100%', margin: '0 auto', zIndex: 10 }}>
              <span className={styles.lobbySubtitle}>Current Standings</span>
              <h1 className={styles.lobbyTitle} id="live-standings-title" style={{ fontSize: '3.5rem' }}>Live Leaderboard</h1>
              
              {/* 3D height-scaled team podium for the top 3 teams */}
              {sortedTeams.length >= 2 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '2rem', margin: '3rem auto 1rem auto', height: '320px', width: '100%' }}>
                  
                  {/* 2nd Place Column */}
                  {sortedTeams[1] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '160px', animation: 'slideUp 0.6s ease-out forwards' }}>
                      <div style={{ fontWeight: '800', color: 'var(--text-muted)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>2nd Place</div>
                      <div style={{
                        width: '100%',
                        height: '160px',
                        background: 'linear-gradient(to top, rgba(148, 163, 184, 0.15) 0%, rgba(203, 213, 225, 0.05) 100%)',
                        border: `2px solid ${sortedTeams[1].color || '#cbd5e1'}`,
                        borderRadius: '16px 16px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '1rem',
                        textAlign: 'center',
                        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.03), 0 0 20px ${(sortedTeams[1].color || '#cbd5e1')}10`
                      }}>
                        <span style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-main)' }}>{sortedTeams[1].name}</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>{sortedTeams[1].score || 0} pts</span>
                      </div>
                    </div>
                  )}

                  {/* 1st Place Column (Center) */}
                  {sortedTeams[0] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '185px', animation: 'slideUp 0.8s ease-out forwards' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem', animation: 'bounce 2s infinite' }}>👑</div>
                      <div style={{ fontWeight: '900', color: '#d97706', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Winner</div>
                      <div style={{
                        width: '100%',
                        height: '210px',
                        background: 'linear-gradient(to top, rgba(234, 179, 8, 0.18) 0%, rgba(253, 224, 71, 0.08) 100%)',
                        border: `3px solid ${sortedTeams[0].color || '#fbbf24'}`,
                        borderRadius: '20px 20px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '1rem',
                        textAlign: 'center',
                        boxShadow: `0 12px 40px rgba(0, 0, 0, 0.05), 0 0 35px ${(sortedTeams[0].color || '#fbbf24')}20`
                      }}>
                        <span style={{ fontWeight: '900', fontSize: '1.45rem', color: 'var(--text-main)' }}>{sortedTeams[0].name}</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '950', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>{sortedTeams[0].score || 0} pts</span>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place Column */}
                  {sortedTeams[2] && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '140px', animation: 'slideUp 1s ease-out forwards' }}>
                      <div style={{ fontWeight: '800', color: '#b45309', fontSize: '1.15rem', marginBottom: '0.5rem' }}>3rd Place</div>
                      <div style={{
                        width: '100%',
                        height: '110px',
                        background: 'linear-gradient(to top, rgba(180, 83, 9, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%)',
                        border: `2px solid ${sortedTeams[2].color || '#d97706'}`,
                        borderRadius: '12px 12px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '1rem',
                        textAlign: 'center',
                        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.03), 0 0 15px ${(sortedTeams[2].color || '#d97706')}08`
                      }}>
                        <span style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-main)' }}>{sortedTeams[2].name}</span>
                        <span style={{ fontSize: '1.3rem', fontWeight: '950', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>{sortedTeams[2].score || 0} pts</span>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Table list of other teams ranked 4th place onwards */}
              {sortedTeams.length > 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', margin: '2rem auto' }}>
                  {sortedTeams.slice(3).map((team, idx) => (
                    <div
                      key={team.id}
                      className="glass animate-fade"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem 2.5rem',
                        borderLeft: `6px solid ${team.color || 'var(--border-color)'}`,
                        borderRadius: '12px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                      }}
                    >
                      <span style={{ fontWeight: '700', fontSize: '1.15rem', color: 'var(--text-main)' }}>
                        #{idx + 4} {team.name}
                      </span>
                      <span style={{ fontWeight: '900', fontSize: '1.25rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                        {team.score || 0} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : event.state.showQuestion && isQuestionActive ? (
            <section className={`${styles.questionMain} ${styles.animateSlideEntry}`} aria-labelledby="question-text">
              
              {/* Question Header */}
              <header className={styles.quizHeader}>
                <div className={styles.qMeta}>
                  <span className={styles.categoryTagLarge} style={{ color: activeQuestionColor, border: `1.5px solid ${activeQuestionColor}`, background: `${activeQuestionColor}0a` }}>
                    <span className={styles.catHeaderIcon} style={{ color: activeQuestionColor }}>
                      {getCategoryIcon(activeQuestionIcon)}
                    </span>
                    {activeQuestion.categoryName}
                  </span>
                  <h1 className={styles.qCount} id="question-index-title">
                    Active Question ({activeQuestion.points} points)
                  </h1>
                </div>

                {/* Circular Timer Ring — 140px, dynamic color */}
                <div className={styles.timerWrapper} aria-label={`Timer remaining: ${timerVal} seconds`}>
                  <svg className={styles.timerSvg} viewBox="0 0 128 128">
                    <circle className={styles.timerBgCircle} cx="64" cy="64" r={radius} />
                    <circle
                      className={styles.timerFillCircle}
                      cx="64"
                      cy="64"
                      r={radius}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      style={{ stroke: timerStrokeColor, transition: 'stroke 0.5s, stroke-dashoffset 0.2s linear' }}
                    />
                  </svg>
                  <span className={`${styles.timerNumber} ${isTimeWarning ? styles.timerAlert : ''}`}
                    style={{ color: timerStrokeColor, transition: 'color 0.5s', fontSize: isTimeWarning ? '2.4rem' : '2rem' }}>
                    {timerVal}
                  </span>
                </div>
              </header>

              {/* Layout splits side-by-side if question has an image (Option C) and options */}
              {activeQuestion.image && activeQuestion.options.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', flex: 1, alignItems: 'center' }}>
                  
                  {/* Left Column: Question Prompt */}
                  <div className={`${styles.questionCard} glass`} style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p id="question-text" className={styles.questionTextLarge} style={{ textAlign: 'left', fontSize: '2.2rem' }}>
                      {activeQuestion.text}
                    </p>
                  </div>

                  {/* Right Column: Framed Image */}
                  <div className="glass" style={{
                    padding: '1.5rem',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffffff',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.03)',
                    maxHeight: '380px',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={activeQuestion.image}
                      alt="Question Illustration Clue"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '320px',
                        objectFit: 'contain',
                        borderRadius: '12px'
                      }}
                    />
                  </div>
                </div>
              ) : activeQuestion.image && activeQuestion.options.length === 0 ? (
                /* Centered Single Column with Large Logo (Round 2 Style) */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', flex: 1, justifyContent: 'center', width: '100%' }}>
                  <div className={`${styles.questionCard} glass`} style={{ width: '100%', textAlign: 'center', padding: '1.5rem 2rem' }}>
                    <p id="question-text" className={styles.questionTextLarge} style={{ margin: 0, fontSize: '2.5rem' }}>
                      {activeQuestion.text}
                    </p>
                  </div>
                  
                  <div className="glass" style={{
                    padding: '2rem',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffffff',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.04)',
                    maxHeight: '380px',
                    maxWidth: '420px',
                    width: '100%',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={activeQuestion.image}
                      alt="Logo to Identify"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        objectFit: 'contain',
                        borderRadius: '12px'
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Default: Centered Single Column question text box */
                <div className={`${styles.questionCard} glass`}>
                  <p id="question-text" className={styles.questionTextLarge}>
                    {activeQuestion.text}
                  </p>
                </div>
              )}

              {/* === OPEN ANSWER MODE (Rounds 6 & 7 — no options) === */}
              {activeQuestion.options.length === 0 ? (
                <div className={styles.openAnswerZone}>
                  {event.state.showAnswer ? (
                    /* Answer Reveal */
                    <div className={`${styles.openAnswerReveal} ${styles.animateSlideEntry}`}>
                      <span className={styles.openAnswerRevealLabel}>✅ The Answer Is</span>
                      <div className={styles.openAnswerRevealText}>{activeQuestion.correctAnswer}</div>
                    </div>
                  ) : (
                    /* Shout prompt */
                    <div className={styles.shoutPrompt}>
                      <span className={styles.shoutIcon}>🎤</span>
                      <span className={styles.shoutText}>SHOUT YOUR ANSWER!</span>
                      <span className={styles.shoutSub}>First correct team wins {activeQuestion.points} pts</span>
                    </div>
                  )}
                </div>
              ) : (
                /* === MULTIPLE CHOICE MODE (Rounds 1–5) === */
                <div className={styles.optionsLayout}>
                  {activeQuestion.options.map((opt, idx) => {
                    const optLetter = String.fromCharCode(65 + idx);
                    const isCorrect = activeQuestion.correctAnswer === optLetter;
                    const showAnswer = event.state.showAnswer;
                    let animClass = '';
                    if (idx === 0) animClass = styles.animateStagger1;
                    else if (idx === 1) animClass = styles.animateStagger2;
                    else if (idx === 2) animClass = styles.animateStagger3;
                    else if (idx === 3) animClass = styles.animateStagger4;

                    return (
                      <div
                        key={idx}
                        className={`${styles.optCard} glass ${animClass} ${
                          showAnswer && isCorrect ? styles.correctOptionReveal : ''
                        } ${
                          showAnswer && !isCorrect ? styles.incorrectOptionReveal : ''
                        }`}
                        id={`presenter-opt-${optLetter}`}
                      >
                        <div className={`${styles.optLetter} ${
                          idx === 0 ? styles.optA_Letter :
                          idx === 1 ? styles.optB_Letter :
                          idx === 2 ? styles.optC_Letter : styles.optD_Letter
                        }`}>
                          {showAnswer && isCorrect ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : optLetter}
                        </div>
                        <span className={styles.optText}>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              )}

            </section>
          ) : (
            /* B. If showQuestion is FALSE, render the Interactive Category Grid */
            <section className={`${styles.orbitalWrapper} ${styles.animateSlideEntry}`}>
              <div className={styles.orbitalBoard}>
                {categories.filter((_, idx) => idx === currentRound - 1).map(cat => {
                  // Filter event questions belonging to this category
                  const catQuestions = questions
                    .filter(q => q.categoryId === cat.id)
                    .sort((a, b) => a.points - b.points);

                  return (
                    <div key={cat.id} className={styles.orbitalContainer}>
                      {/* Orbit Track Line */}
                      <div className={styles.orbitLine} />

                      {/* Central Hub */}
                      <div className={styles.centralHub} style={{ border: `3px solid ${cat.color || '#4f46e5'}`, boxShadow: `0 0 25px ${(cat.color || '#4f46e5')}33` }}>
                        <div className={styles.centralPulse} style={{ background: cat.color || '#4f46e5' }} />
                        <span className={styles.hubRoundLabel} style={{ color: cat.color || 'var(--primary)' }}>Round {currentRound}</span>
                        <h2 className={styles.hubCategoryName}>{cat.name}</h2>
                        <span className={styles.hubProgress}>
                          {completedQIds.filter(id => catQuestions.some(q => q.id === id)).length} / {catQuestions.length} Resolved
                        </span>
                      </div>

                      {/* Orbiting Questions */}
                      {catQuestions.map((q, idx) => {
                        const isCompleted = completedQIds.includes(q.id);
                        
                        // Calculate positions around the circle (radius = 280px)
                        const radius = 280; 
                        const angle = (idx * 2 * Math.PI) / catQuestions.length - Math.PI / 2;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;

                        return (
                          <div
                            key={q.id}
                            className={`${styles.orbitCard} ${
                              isCompleted ? styles.orbitCardCompleted : styles.orbitCardActive
                            }`}
                            style={{
                              position: 'absolute',
                              left: `calc(50% + ${x}px)`,
                              top: `calc(50% + ${y}px)`,
                              transform: 'translate(-50%, -50%)',
                              animationDelay: `${idx * 0.3}s`,
                              borderColor: isCompleted ? 'var(--success)' : (cat.color || '#4f46e5'),
                              boxShadow: isCompleted ? 'none' : `0 0 15px ${(cat.color || '#4f46e5')}22`
                            }}
                          >
                            {isCompleted ? (
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            ) : (
                              `Q${idx + 1}`
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* 3. FINISHED VIEW (Option B: 3D podium layout) */}
      {status === 'finished' && (
        <section className={`${styles.lobbyContainer} animate-fade`} aria-labelledby="winner-title" style={{ maxWidth: '900px', width: '100%', margin: '0 auto', zIndex: 10 }}>
          <span className={styles.lobbySubtitle}>Quiz Completed!</span>
          <h1 className={styles.lobbyTitle} id="winner-title" style={{ fontSize: '3.5rem' }}>Final Standings</h1>
          
          {/* 3D height-scaled team podium for the top 3 teams */}
          {sortedTeams.length >= 2 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '2rem', margin: '3rem auto 1rem auto', height: '320px', width: '100%' }}>
              
              {/* 2nd Place Column */}
              {sortedTeams[1] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '160px', animation: 'slideUp 0.6s ease-out forwards' }}>
                  <div style={{ fontWeight: '800', color: 'var(--text-muted)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>2nd Place</div>
                  <div style={{
                    width: '100%',
                    height: '160px',
                    background: 'linear-gradient(to top, rgba(148, 163, 184, 0.15) 0%, rgba(203, 213, 225, 0.05) 100%)',
                    border: `2px solid ${sortedTeams[1].color || '#cbd5e1'}`,
                    borderRadius: '16px 16px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '1rem',
                    textAlign: 'center',
                    boxShadow: `0 8px 32px rgba(0, 0, 0, 0.03), 0 0 20px ${(sortedTeams[1].color || '#cbd5e1')}10`
                  }}>
                    <span style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-main)' }}>{sortedTeams[1].name}</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>{sortedTeams[1].score || 0} pts</span>
                  </div>
                </div>
              )}

              {/* 1st Place Column (Center) */}
              {sortedTeams[0] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '185px', animation: 'slideUp 0.8s ease-out forwards' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem', animation: 'bounce 2s infinite' }}>👑</div>
                  <div style={{ fontWeight: '900', color: '#d97706', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Winner</div>
                  <div style={{
                    width: '100%',
                    height: '210px',
                    background: 'linear-gradient(to top, rgba(234, 179, 8, 0.18) 0%, rgba(253, 224, 71, 0.08) 100%)',
                    border: `3px solid ${sortedTeams[0].color || '#fbbf24'}`,
                    borderRadius: '20px 20px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '1rem',
                    textAlign: 'center',
                    boxShadow: `0 12px 40px rgba(0, 0, 0, 0.05), 0 0 35px ${(sortedTeams[0].color || '#fbbf24')}20`
                  }}>
                    <span style={{ fontWeight: '900', fontSize: '1.45rem', color: 'var(--text-main)' }}>{sortedTeams[0].name}</span>
                    <span style={{ fontSize: '1.8rem', fontWeight: '950', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>{sortedTeams[0].score || 0} pts</span>
                  </div>
                </div>
              )}

              {/* 3rd Place Column */}
              {sortedTeams[2] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '140px', animation: 'slideUp 1s ease-out forwards' }}>
                  <div style={{ fontWeight: '800', color: '#b45309', fontSize: '1.15rem', marginBottom: '0.5rem' }}>3rd Place</div>
                  <div style={{
                    width: '100%',
                    height: '110px',
                    background: 'linear-gradient(to top, rgba(180, 83, 9, 0.12) 0%, rgba(217, 119, 6, 0.04) 100%)',
                    border: `2px solid ${sortedTeams[2].color || '#d97706'}`,
                    borderRadius: '12px 12px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '1rem',
                    textAlign: 'center',
                    boxShadow: `0 8px 24px rgba(0, 0, 0, 0.03), 0 0 15px ${(sortedTeams[2].color || '#d97706')}08`
                  }}>
                    <span style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-main)' }}>{sortedTeams[2].name}</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: '950', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>{sortedTeams[2].score || 0} pts</span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Table list of other teams ranked 4th place onwards */}
          {sortedTeams.length > 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', margin: '2rem auto' }}>
              {sortedTeams.slice(3).map((team, idx) => (
                <div
                  key={team.id}
                  className="glass animate-fade"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 2.5rem',
                    borderLeft: `6px solid ${team.color || 'var(--border-color)'}`,
                    borderRadius: '12px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.02)'
                  }}
                >
                  <span style={{ fontWeight: '700', fontSize: '1.15rem', color: 'var(--text-main)' }}>
                    #{idx + 4} {team.name}
                  </span>
                  <span style={{ fontWeight: '900', fontSize: '1.25rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                    {team.score || 0} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}


    </main>
  );
}
