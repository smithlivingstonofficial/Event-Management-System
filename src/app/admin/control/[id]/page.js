'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from '../control.module.css';
import adminStyles from '../../admin.module.css';
import { useSoundEngine } from '@/lib/useSoundEngine';

export default function AdminControlPanel() {
  const params = useParams();
  const eventId = params.id;

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [dbData, setDbData] = useState({ categories: [], questions: [] });
  const [timerVal, setTimerVal] = useState(20);
  const [scoreEdits, setScoreEdits] = useState({});
  const [scoringTab, setScoringTab] = useState('quiz'); // 'quiz' | 'tracks' | 'ranks'
  const [selectedTrack, setSelectedTrack] = useState('pptTeams'); // 'pptTeams' | 'posterTeams' | 'interviewTeams' | 'debuggingTeams'
  const [audioState, setAudioState] = useState('suspended');
  const timerInterval = useRef(null);
  const sound = useSoundEngine();
  const prevTimerRunning = useRef(false);
  const prevTimerVal = useRef(null);

  // Fetch complete DB database (to map categories and select question data)
  const fetchDb = async () => {
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const data = await res.json();
        setDbData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch active event state
  const fetchEventState = async (isFirst = false) => {
    try {
      const res = await fetch(`/api/event/${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setEventData(data);
        
        // Update local timer state if it's the first run or if timer is not running
        const state = data.event.state;
        if (state.timerRunning && state.timerStartedAt) {
          const elapsed = Math.floor((Date.now() - new Date(state.timerStartedAt).getTime()) / 1000);
          const remaining = Math.max(0, state.timerDuration - elapsed);
          setTimerVal(remaining);
        } else {
          setTimerVal(state.timerRemaining);
        }
      }
    } catch (e) {
      console.error('Error fetching event state:', e);
    } finally {
      if (isFirst) setLoading(false);
    }
  };

  // Connect to SSE stream for live updates
  useEffect(() => {
    fetchDb();
    let eventSource = null;
    
    const connectSSE = () => {
      eventSource = new EventSource(`/api/event/${eventId}/stream`);
      
      eventSource.addEventListener('state', (e) => {
        const json = JSON.parse(e.data);
        setEventData(json);
        setLoading(false);
        
        // Sync local timer values
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
        console.error('Control panel SSE failed. Reconnecting in 3 seconds...', err);
        eventSource.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [eventId]);

  // Local clock decrement effect when timer is running
  useEffect(() => {
    if (eventData?.event?.state?.timerRunning) {
      if (timerInterval.current) clearInterval(timerInterval.current);
      
      timerInterval.current = setInterval(() => {
        const state = eventData.event.state;
        const elapsed = Math.floor((Date.now() - new Date(state.timerStartedAt).getTime()) / 1000);
        const remaining = Math.max(0, state.timerDuration - elapsed);
        setTimerVal(remaining);
        
        if (remaining <= 0) {
          clearInterval(timerInterval.current);
          triggerAction('tick-timer');
        }
      }, 200);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      if (eventData?.event?.state) {
        setTimerVal(eventData.event.state.timerRemaining);
      }
    }

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [eventData?.event?.state?.timerRunning, eventData?.event?.state?.timerStartedAt]);

  // 🔊 Admin Sound: timer ticks
  useEffect(() => {
    if (timerVal === null || timerVal === prevTimerVal.current) return;
    if (!eventData?.event?.state?.timerRunning) return;
    if (timerVal <= 0 && prevTimerVal.current > 0) sound.playBuzzer();
    else if (timerVal <= 5 && timerVal > 0) sound.playUrgentTick();
    else if (timerVal > 5) sound.playTick();
    prevTimerVal.current = timerVal;
  }, [timerVal]);

  // 🔊 Admin Sound: timer start
  useEffect(() => {
    const running = eventData?.event?.state?.timerRunning;
    if (running && !prevTimerRunning.current) sound.playTimerStart();
    prevTimerRunning.current = running;
  }, [eventData?.event?.state?.timerRunning]);

  // PUT controller actions
  const triggerAction = async (action, payload = null) => {
    try {
      const res = await fetch(`/api/event/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      if (res.ok) {
        // SSE handles state update, but fallback to sync is fine
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnlockAudio = () => {
    const state = sound.unlockAudio();
    setAudioState(state);
  };

  const handleTrackSliderChange = (teamId, criterion, val) => {
    const trackKey = selectedTrack;
    const currentTeams = [...(eventData.event[trackKey] || [])];
    const index = currentTeams.findIndex(t => t.id === teamId);
    if (index !== -1) {
      const team = { ...currentTeams[index] };
      if (!team.criteria) team.criteria = {};
      team.criteria = { ...team.criteria, [criterion]: Number(val) };
      
      let total = 0;
      Object.keys(team.criteria).forEach(k => {
        total += team.criteria[k];
      });
      team.score = total;
      currentTeams[index] = team;
      
      triggerAction('update-track-scores', {
        trackKey,
        teams: currentTeams
      });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem', color: 'var(--text-muted)' }}>
        Loading controller console...
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className={styles.wrapper} style={{ textAlign: 'center', padding: '6rem' }}>
        <h1 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Event Not Found</h1>
        <p>The event ID you requested does not exist in local storage database.</p>
        <Link href="/admin" className={styles.backBtn} style={{ marginTop: '1.5rem' }}>
          Back to Admin Dashboard
        </Link>
      </div>
    );
  }

  const { event, activeQuestion } = eventData;
  const isQuestionActive = activeQuestion !== null;
  const timerRunning = event.state.timerRunning;
  const isTimeUp = timerVal <= 0;
  const completedQIds = event.state.completedQuestionIds || [];
  const currentRound = event.state.currentRound || 1;
  const totalRounds = dbData.categories?.length || 1;

  return (
    <div className={adminStyles.appShell}>
      {/* Sidebar Navigation */}
      <aside className={adminStyles.sidebar}>
        <div className={adminStyles.sidebarLogo}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          QuizPlatform
        </div>
        <nav className={adminStyles.navMenu}>
          <Link href="/admin?tab=overview" className={adminStyles.navItem}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            Dashboard
          </Link>
          <Link href="/admin?tab=events" className={adminStyles.navItem}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Events
          </Link>
          <Link href="/admin?tab=scoreboard" className={adminStyles.navItem}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            Score Board
          </Link>
          <Link href="/admin?tab=questions" className={adminStyles.navItem}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Question Bank
          </Link>
          <Link href="/admin?tab=categories" className={adminStyles.navItem}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Categories
          </Link>
          <Link href="/admin?tab=teams" className={adminStyles.navItem}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Teams Pool
          </Link>
          <Link href="/admin?tab=backups" className={adminStyles.navItem}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
            Data Backups
          </Link>
          <div className={adminStyles.navItemActive} style={{ marginTop: 'auto', padding: '0.75rem 1rem', background: 'rgba(79, 70, 229, 0.05)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>Active Control</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>{event.name}</span>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className={adminStyles.mainContent}>
        {/* Topbar Header */}
        <header className={adminStyles.topbar}>
          <div className={adminStyles.topbarLeft}>
            <span className={adminStyles.breadcrumb}>
              Admin / <span style={{ color: 'var(--primary)' }}>Control Event</span>
            </span>
            <span className={`${styles.eventStatusBadge} ${
              event.status === 'active' ? adminStyles.statusActive : 
              event.status === 'finished' ? adminStyles.statusFinished : adminStyles.statusIdle
            }`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '800', border: '1px solid currentColor', marginLeft: '0.5rem' }}>
              {event.status}
            </span>
          </div>
          <div className={adminStyles.topbarRight} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {audioState === 'suspended' ? (
              <button
                onClick={handleUnlockAudio}
                className={adminStyles.btnSecondary}
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: '800', borderRadius: '6px', cursor: 'pointer' }}
              >
                🔇 Unlock Sound
              </button>
            ) : (
              <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(16,185,129,0.3)', padding: '0.4rem 0.8rem', borderRadius: '6px', background: 'rgba(16,185,129,0.05)' }}>
                🔊 Audio Enabled
              </span>
            )}
            <Link href={`/event/${event.id}`} target="_blank" className={adminStyles.hostBtn} id="btn-open-presenter-tab">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
              Presenter Window
            </Link>
          </div>
        </header>

        <div className={adminStyles.pagePadding} style={{ paddingTop: '1.25rem' }}>
          {/* Main Layout Grid */}
          <div className={styles.layoutGrid}>
        
        {/* LEFT COLUMN: ACTIVE CONTROL & PRESENTATION STATUS */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* General status controller - Ultra Compact Toolbar */}
          <div className={styles.controlToolbar}>
            <div className={styles.toolbarLeft}>
              <span className={styles.toolbarLabel}>Controls:</span>
              {event.status !== 'active' && (
                <button
                  id="btn-status-activate"
                  className={`${styles.toolbarBtn} ${styles.btnPrimary}`}
                  onClick={() => triggerAction('update-event-status', { status: 'active' })}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Activate
                </button>
              )}
              {event.status === 'active' && (
                <button
                  id="btn-status-finish"
                  className={`${styles.toolbarBtn} ${styles.btnSuccess}`}
                  onClick={() => triggerAction('update-event-status', { status: 'finished' })}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Complete
                </button>
              )}
              {event.status === 'finished' && (
                <button
                  id="btn-status-reactivate"
                  className={`${styles.toolbarBtn} ${styles.btnPrimary}`}
                  onClick={() => triggerAction('update-event-status', { status: 'active' })}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                  Re-Open
                </button>
              )}
            </div>

            <div className={styles.segmentedRounds}>
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => (
                <button
                  key={r}
                  className={`${styles.segmentItem} ${r === currentRound ? styles.segmentActive : ''}`}
                  onClick={() => triggerAction('change-round', r)}
                  title={`Go to Round ${r}`}
                >
                  R{r}
                </button>
              ))}
            </div>

            <div className={styles.toolbarRight}>
              <button
                id="btn-reset-grid"
                className={`${styles.toolbarBtn} ${styles.btnSecondary}`}
                onClick={() => {
                  if (confirm('Reset the entire question board grid and clear all team scores? This cannot be undone.')) {
                    triggerAction('reset-grid');
                  }
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Reset Board
              </button>
            </div>
          </div>

          {/* SAAS DUAL-VIEW CONTAINER */}
          {event.state.showQuestion && isQuestionActive ? (
            
            /* VIEW A: QUESTION CONTROL MODE */
            <article className={`${styles.panel} glass`} style={{ border: '1px solid rgba(79, 70, 229, 0.3)' }}>
              <div className={styles.panelTitle}>
                <span>Active Question Console</span>
                <button
                  id="btn-return-grid"
                  className={`${styles.btnSecondary} ${styles.btnSmall}`}
                  onClick={() => triggerAction('return-to-grid')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  Return to Grid
                </button>
              </div>

              <div className={styles.questionBox}>
                <div className={styles.questionMeta}>
                  <span className={styles.qNum}>
                    {activeQuestion.categoryName}
                  </span>
                  <span className={styles.qPoints}>{activeQuestion.points} Points</span>
                </div>
                <p className={styles.questionText}>{activeQuestion.text}</p>

                {activeQuestion.image && (
                  <div style={{ margin: '1rem 0', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={activeQuestion.image}
                      alt="Question Clue"
                      style={{
                        maxHeight: '100px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                      }}
                    />
                  </div>
                )}
                
                {/* Open Answer OR Multiple Choice options */}
                {activeQuestion.options.length === 0 ? (
                  /* === OPEN ANSWER — host-only answer card === */
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
                    border: '2px solid rgba(16,185,129,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--success)' }}>
                      🔒 HOST ONLY — Correct Answer
                    </span>
                    <span style={{
                      fontSize: '1.4rem',
                      fontWeight: '900',
                      color: 'var(--text-main)',
                      fontFamily: 'var(--font-mono)',
                      filter: event.state.showAnswer ? 'none' : 'blur(6px)',
                      transition: 'filter 0.2s ease',
                      userSelect: event.state.showAnswer ? 'text' : 'none'
                    }}>
                      {activeQuestion.correctAnswer}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {event.state.showAnswer 
                        ? 'Open answer round — correct answer revealed.' 
                        : 'Blurred to prevent spoilers. Click "Reveal Answer Key" below to unblur.'}
                    </span>
                  </div>
                ) : (
                  /* === MULTIPLE CHOICE — normal list === */
                  <div className={styles.optionsGrid}>
                    {activeQuestion.options.map((opt, idx) => {
                      const optChar = String.fromCharCode(65 + idx);
                      const isCorrect = activeQuestion.correctAnswer === optChar;
                      const showCorrectHighlight = event.state.showAnswer && isCorrect;
                      return (
                        <div
                          key={idx}
                          className={`${styles.optionCard} ${showCorrectHighlight ? styles.correctOptionCard : ''}`}
                        >
                          <span className={styles.optionLetterBadge}>{optChar}</span>
                          <span style={{ fontWeight: '500' }}>{opt}</span>
                          {showCorrectHighlight && (
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', marginLeft: 'auto', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              CORRECT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Visibility switches on presenter screen */}
              <div className={styles.visibilityToolbar}>
                <button
                  id="btn-toggle-show-question"
                  className={`${styles.controlToggle} ${event.state.showQuestion ? styles.toggleActive : ''}`}
                  onClick={() => triggerAction('show-question', !event.state.showQuestion)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.4rem' }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  Question Body: <strong>{event.state.showQuestion ? 'VISIBLE' : 'HIDDEN'}</strong>
                </button>

                <button
                  id="btn-toggle-reveal-answer"
                  className={`${styles.controlToggle} ${event.state.showAnswer ? styles.toggleActive : ''}`}
                  onClick={() => triggerAction('reveal-answer', !event.state.showAnswer)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.4rem' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 14 14"></polyline>
                  </svg>
                  Answer Key: <strong>{event.state.showAnswer ? 'REVEALED' : 'HIDDEN'}</strong>
                </button>

                <button
                  id="btn-toggle-show-standings"
                  className={`${styles.controlToggle} ${event.state.showStandings ? styles.toggleActive : ''}`}
                  onClick={() => triggerAction('show-standings', !event.state.showStandings)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.4rem' }}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                  Live Standings: <strong>{event.state.showStandings ? 'VISIBLE' : 'HIDDEN'}</strong>
                </button>
              </div>

              {/* Timer Control Section */}
              <div className={styles.timerPanel}>
                <div className={styles.timerBarWrapper}>
                  <div className={styles.timerBarLabel}>
                    <span>Timer Countdown</span>
                    <span className={`${styles.timerClockText} ${isTimeUp ? styles.timerAlertText : ''}`}>
                      {timerVal}s / {event.state.timerDuration || 20}s
                    </span>
                  </div>
                  <div className={styles.timerBarOuter}>
                    <div
                      className={`${styles.timerBarInner} ${isTimeUp ? styles.timerBarAlert : ''}`}
                      style={{ width: `${Math.min(100, Math.max(0, (timerVal / (event.state.timerDuration || 20)) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className={styles.timerActions}>
                  {!timerRunning ? (
                    <button
                      id="btn-timer-start"
                      className={`${styles.btnPrimary} ${styles.btnSmall}`}
                      onClick={() => triggerAction('start-timer')}
                      disabled={isTimeUp}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.25rem' }}><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                      Start
                    </button>
                  ) : (
                    <button
                      id="btn-timer-pause"
                      className={`${styles.btnDanger} ${styles.btnSmall}`}
                      onClick={() => triggerAction('pause-timer')}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.25rem' }}><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                      Pause
                    </button>
                  )}
                  <button
                    id="btn-timer-reset"
                    className={`${styles.btnSecondary} ${styles.btnSmall}`}
                    onClick={() => triggerAction('reset-timer')}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '0.25rem' }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                    Reset
                  </button>
                </div>
              </div>

            </article>
          ) : (
            
            /* VIEW B: INTERACTIVE CATEGORY GRID MODE */
            <article className={`${styles.panel} glass`}>
              <div className={styles.panelTitle}>
                <span>Round {currentRound} - {dbData.categories?.[currentRound - 1]?.name || ''}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {completedQIds.length} / {event.questionIds.length} Answered
                </span>
              </div>

              {dbData.categories.length === 0 ? (
                <div className={adminStyles.emptyState} style={{ padding: '2rem' }}>
                  No categories in the database. Add categories and assign questions to view board.
                </div>
              ) : (
                <div className={styles.gridBoard}>
                  {dbData.categories.filter((_, idx) => idx === currentRound - 1).map(cat => {
                    // Filter questions in this category that are part of this event
                    const catQuestions = dbData.questions
                      .filter(q => q.categoryId === cat.id && event.questionIds.includes(q.id))
                      .sort((a, b) => a.points - b.points);

                    return (
                      <div key={cat.id} className={styles.gridCol}>
                        {catQuestions.map((q, idx) => {
                          const isCompleted = completedQIds.includes(q.id);
                          return (
                            <button
                              key={q.id}
                              id={`btn-grid-q-${q.id}`}
                              className={`${styles.gridButton} ${isCompleted ? styles.gridButtonCompleted : ''}`}
                              disabled={isCompleted}
                              onClick={() => triggerAction('select-question', { questionId: q.id })}
                            >
                              <span className={styles.gridQBadge}>Q{idx + 1}</span>
                              <span className={styles.gridQPoints}>{q.points} pts</span>
                            </button>
                          );
                        })}
                        {catQuestions.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.1)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            Empty
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          )}

        </section>

        {/* RIGHT COLUMN: SCORING PANEL */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <article className={`${styles.panel} glass`}>
            
            {/* Scoring Sub-Tabs Selector */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              {[
                { id: 'quiz', name: '⚡ Quiz Scores' },
                { id: 'tracks', name: '🏆 Other Tracks' },
                { id: 'ranks', name: '📊 Standings' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setScoringTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 0.25rem',
                    background: 'transparent',
                    border: 'none',
                    color: scoringTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: '800',
                    fontSize: '0.8rem',
                    borderBottom: scoringTab === tab.id ? '3px solid var(--primary)' : 'none',
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                    outline: 'none'
                  }}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* Tab A: Live Quiz Score steppers */}
            {scoringTab === 'quiz' && (
              <div className={styles.teamList} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {event.teams.map((team) => (
                  <div
                    key={team.id}
                    className={styles.teamRow}
                    id={`team-row-${team.id}`}
                    style={{ borderLeftColor: team.color || 'var(--primary)' }}
                  >
                    <div className={styles.teamRowHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={styles.teamColorDot} style={{ backgroundColor: team.color || 'var(--primary)' }} />
                        <span className={styles.teamName}>{team.name}</span>
                      </div>
                      <div className={styles.scoreStepper}>
                        <button
                          className={styles.stepperBtn}
                          onClick={() => triggerAction('update-score', { teamId: team.id, amount: -10 })}
                          title="Deduct 10 pts"
                        >
                          -
                        </button>
                        <input
                          id={`score-input-${team.id}`}
                          type="number"
                          defaultValue={team.score || 0}
                          key={team.score}
                          className={styles.stepperInput}
                          style={{ color: team.color || 'var(--primary)' }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) triggerAction('update-score', { teamId: team.id, amount: val - (team.score || 0) });
                              e.target.blur();
                            }
                          }}
                          onBlur={e => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val !== (team.score || 0)) {
                              triggerAction('update-score', { teamId: team.id, amount: val - (team.score || 0) });
                            }
                          }}
                        />
                        <button
                          className={styles.stepperBtn}
                          onClick={() => triggerAction('update-score', { teamId: team.id, amount: 10 })}
                          title="Add 10 pts"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className={styles.scoreActions}>
                      {event.state.showQuestion && isQuestionActive && (
                        <>
                          <button
                            id={`btn-score-correct-${team.id}`}
                            className={`${styles.pillScoreBtn} ${styles.scoreAdd}`}
                            onClick={() => {
                              sound.playCorrectChime();
                              triggerAction('update-score', { teamId: team.id, amount: activeQuestion.points });
                            }}
                            title={`Award correct answer (+${activeQuestion.points} pts)`}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            +{activeQuestion.points}
                          </button>
                          <button
                            id={`btn-score-incorrect-${team.id}`}
                            className={`${styles.pillScoreBtn} ${styles.scoreSub}`}
                            onClick={() => triggerAction('update-score', { teamId: team.id, amount: -activeQuestion.points })}
                            title={`Deduct wrong answer (-${activeQuestion.points} pts)`}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            -{activeQuestion.points}
                          </button>
                        </>
                      )}
                      <button
                        id={`btn-score-plus-50-${team.id}`}
                        className={styles.pillScoreBtn}
                        onClick={() => triggerAction('update-score', { teamId: team.id, amount: 50 })}
                      >
                        +50
                      </button>
                      <button
                        id={`btn-score-plus-10-${team.id}`}
                        className={styles.pillScoreBtn}
                        onClick={() => triggerAction('update-score', { teamId: team.id, amount: 10 })}
                      >
                        +10
                      </button>
                      <button
                        id={`btn-score-minus-10-${team.id}`}
                        className={`${styles.pillScoreBtn} ${styles.scoreSub}`}
                        onClick={() => triggerAction('update-score', { teamId: team.id, amount: -10 })}
                      >
                        -10
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab B: Sub-event tracks sliders */}
            {scoringTab === 'tracks' && (() => {
              const trackKey = selectedTrack;
              const trackTeams = event[trackKey] || [];
              
              const trackMetadata = {
                pptTeams: {
                  title: 'PPT Presentation',
                  criteria: [
                    { id: 'content', name: 'Content (20)', max: 20 },
                    { id: 'delivery', name: 'Voice & Delivery (20)', max: 20 },
                    { id: 'design', name: 'Visual Design (20)', max: 20 },
                    { id: 'qa', name: 'Q&A Defense (20)', max: 20 },
                    { id: 'time', name: 'Time Mgmt (20)', max: 20 }
                  ]
                },
                posterTeams: {
                  title: 'Poster Presentation',
                  criteria: [
                    { id: 'creativity', name: 'Creativity (25)', max: 25 },
                    { id: 'relevance', name: 'Topic Relevance (25)', max: 25 },
                    { id: 'aesthetics', name: 'Aesthetics (25)', max: 25 },
                    { id: 'explanation', name: 'Explanation & Q&A (25)', max: 25 }
                  ]
                },
                interviewTeams: {
                  title: 'Stress Interview',
                  criteria: [
                    { id: 'calmness', name: 'Calmness (30)', max: 30 },
                    { id: 'mind', name: 'Presence of Mind (30)', max: 30 },
                    { id: 'communication', name: 'Communication (20)', max: 20 },
                    { id: 'arguments', name: 'Arguments (20)', max: 20 }
                  ]
                },
                debuggingTeams: {
                  title: 'Debugging Challenge',
                  criteria: [
                    { id: 'syntactic', name: 'Syntactic Fixes (30)', max: 30 },
                    { id: 'logical', name: 'Logical Debug (40)', max: 40 },
                    { id: 'speed', name: 'Comp. Speed (20)', max: 20 },
                    { id: 'style', name: 'Code Quality (10)', max: 10 }
                  ]
                }
              }[trackKey] || { title: 'Unknown Track', criteria: [] };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <select
                    value={selectedTrack}
                    onChange={(e) => setSelectedTrack(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="pptTeams">📊 PowerPoint Presentation</option>
                    <option value="posterTeams">🎨 Poster Presentation</option>
                    <option value="interviewTeams">🎤 Stress Interview</option>
                    <option value="debuggingTeams">💻 Debugging Challenge</option>
                  </select>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {trackTeams.map(team => (
                      <div
                        key={team.id}
                        style={{
                          padding: '1rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'rgba(255,255,255,0.01)',
                          borderLeft: `4px solid ${team.color || 'var(--primary)'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--text-main)' }}>{team.name}</span>
                          <span style={{ fontWeight: '900', color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{team.score || 0} pts</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {trackMetadata.criteria.map(crit => {
                            const val = team.criteria?.[crit.id] || 0;
                            return (
                              <div key={crit.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{crit.name}</span>
                                  <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{val}</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max={crit.max}
                                  value={val}
                                  onChange={(e) => handleTrackSliderChange(team.id, crit.id, e.target.value)}
                                  style={{
                                    width: '100%',
                                    height: '5px',
                                    accentColor: team.color || 'var(--primary)',
                                    cursor: 'pointer'
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {trackTeams.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                        No teams assigned to this competition track yet. Add teams under scoreboard in the admin tab.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Tab C: Live rankings standings */}
            {scoringTab === 'ranks' && (() => {
              const quizTeams = event.teams || [];
              const pptTeams = event.pptTeams || [];
              const posterTeams = event.posterTeams || [];
              const interviewTeams = event.interviewTeams || [];
              const debuggingTeams = event.debuggingTeams || [];

              const allUniqueIds = Array.from(new Set([
                ...quizTeams.map(t => t.id),
                ...pptTeams.map(t => t.id),
                ...posterTeams.map(t => t.id),
                ...interviewTeams.map(t => t.id),
                ...debuggingTeams.map(t => t.id)
              ]));

              const standings = allUniqueIds.map(id => {
                const baseTeam = dbData.teams?.find(t => t.id === id) || { name: 'Unknown Team', color: '#cbd5e1' };
                const qScore = quizTeams.find(t => t.id === id)?.score || 0;
                const pScore = pptTeams.find(t => t.id === id)?.score || 0;
                const postScore = posterTeams.find(t => t.id === id)?.score || 0;
                const iScore = interviewTeams.find(t => t.id === id)?.score || 0;
                const dScore = debuggingTeams.find(t => t.id === id)?.score || 0;
                const grandTotal = qScore + pScore + postScore + iScore + dScore;

                const name = quizTeams.find(t => t.id === id)?.name || 
                             pptTeams.find(t => t.id === id)?.name ||
                             baseTeam.name;

                return {
                  id,
                  name,
                  color: quizTeams.find(t => t.id === id)?.color || baseTeam.color,
                  grandTotal
                };
              }).sort((a, b) => b.grandTotal - a.grandTotal);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '450px', overflowY: 'auto' }}>
                  {standings.map((t, idx) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(255,255,255,0.01)',
                        borderLeft: `4px solid ${t.color || 'var(--primary)'}`
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-main)' }}>
                        #{idx + 1} {t.name}
                      </span>
                      <span style={{ fontWeight: '900', fontSize: '0.85rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                        {t.grandTotal} pts
                      </span>
                    </div>
                  ))}
                  {standings.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      No active standings calculated.
                    </div>
                  )}
                </div>
              );
            })()}

          </article>
        </section>

      </div>
        </div>
      </main>
    </div>
  );
}
