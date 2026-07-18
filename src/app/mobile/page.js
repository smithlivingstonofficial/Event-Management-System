'use client';

import { useState, useEffect } from 'react';
import styles from './mobile.module.css';

const TRACKS_CRITERIA = {
  pptTeams: {
    key: 'pptTeams',
    title: 'PPT Presentation',
    criteria: [
      { id: 'content', name: 'Slide Content', max: 20 },
      { id: 'delivery', name: 'Delivery & Voice', max: 20 },
      { id: 'design', name: 'Visual Design', max: 20 },
      { id: 'qa', name: 'Q&A Defense', max: 20 },
      { id: 'time', name: 'Time Management', max: 20 }
    ]
  },
  posterTeams: {
    key: 'posterTeams',
    title: 'Poster Presentation',
    criteria: [
      { id: 'creativity', name: 'Creativity & Originality', max: 25 },
      { id: 'relevance', name: 'Topic Relevance', max: 25 },
      { id: 'aesthetics', name: 'Visual Appeal & Aesthetics', max: 25 },
      { id: 'explanation', name: 'Explanation & Q&A', max: 25 }
    ]
  },
  interviewTeams: {
    key: 'interviewTeams',
    title: 'Stress Interview',
    criteria: [
      { id: 'calmness', name: 'Calmness under Stress', max: 30 },
      { id: 'mind', name: 'Presence of Mind', max: 30 },
      { id: 'communication', name: 'Communication Style', max: 20 },
      { id: 'arguments', name: 'Counter-Arguments Quality', max: 20 }
    ]
  },
  debuggingTeams: {
    key: 'debuggingTeams',
    title: 'Debugging Challenge',
    criteria: [
      { id: 'syntactic', name: 'Syntactic Fixes', max: 30 },
      { id: 'logical', name: 'Logical Debugging', max: 40 },
      { id: 'speed', name: 'Completion Speed', max: 20 },
      { id: 'style', name: 'Code Quality & Style', max: 10 }
    ]
  }
};

const TABS = [
  { key: 'teams', label: 'Quiz' },
  { key: 'pptTeams', label: 'PPT' },
  { key: 'posterTeams', label: 'Poster' },
  { key: 'interviewTeams', label: 'Interview' },
  { key: 'debuggingTeams', label: 'Debugging' }
];

export default function MobileController() {
  const [mounted, setMounted] = useState(false);
  const [db, setDb] = useState({ categories: [], questions: [], teams: [], events: [] });
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'pptTeams' | ...
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [localCriteria, setLocalCriteria] = useState({});
  const [localQuizScore, setLocalQuizScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlockedOverride, setIsUnlockedOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Judge Access Control State
  const [judgeName, setJudgeName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [regError, setRegError] = useState('');

  // Set mounted true on client load to avoid Next.js hydration issues
  useEffect(() => {
    setMounted(true);
    
    // Read or generate unique local deviceId
    let id = localStorage.getItem('judgeDeviceId');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('judgeDeviceId', id);
    }
    setDeviceId(id);
    
    const savedName = localStorage.getItem('judgeName');
    if (savedName) {
      setJudgeName(savedName);
    }

    const savedEventId = localStorage.getItem('judgeSelectedEventId');
    if (savedEventId) {
      setSelectedEventId(savedEventId);
    }

    const savedTab = localStorage.getItem('judgeActiveTab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // Fetch db configuration on mount
  const fetchData = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const res = await fetch(`${origin}/api/db`);
      if (res.ok) {
        const data = await res.json();
        setDb({
          categories: data.categories || [],
          questions: data.questions || [],
          teams: data.teams || [],
          events: data.events || []
        });
        
        // Auto-select first event if none selected yet, checking localStorage first
        if (data.events && data.events.length > 0) {
          setSelectedEventId(prev => {
            const savedEventId = localStorage.getItem('judgeSelectedEventId');
            if (savedEventId && data.events.some(e => e.id === savedEventId)) {
              return savedEventId;
            }
            return prev || data.events[0].id;
          });
        }
      }
    } catch (err) {
      console.error('Failed to load database on mobile controller:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchData();
    }
  }, [mounted]);

  // Check if current device is registered as an active judge
  const activeEvent = db.events.find(e => e.id === selectedEventId);
  
  // Automatically determine which track is enabled on activeEvent and set activeTab
  useEffect(() => {
    if (activeEvent) {
      if ((activeEvent.pptTeams || []).length > 0) {
        setActiveTab('pptTeams');
      } else if ((activeEvent.posterTeams || []).length > 0) {
        setActiveTab('posterTeams');
      } else if ((activeEvent.interviewTeams || []).length > 0) {
        setActiveTab('interviewTeams');
      } else if ((activeEvent.debuggingTeams || []).length > 0) {
        setActiveTab('debuggingTeams');
      } else {
        setActiveTab('teams'); // Default/Quiz
      }
      setCurrentTeamIndex(0); // Reset index on event change
    }
  }, [selectedEventId, activeEvent?.id]);

  const teamList = activeEvent ? (activeEvent[activeTab] || []) : [];
  const currentTeam = teamList[currentTeamIndex];

  // Synchronize local edit state when team changes
  useEffect(() => {
    if (currentTeam) {
      const match = currentTeam.judgeScores?.[deviceId];
      if (match) {
        setLocalCriteria(match.criteria || {});
        setLocalQuizScore(match.score || 0);
      } else {
        setLocalCriteria({});
        setLocalQuizScore(0);
      }
    }
  }, [currentTeamIndex, selectedEventId, activeTab, currentTeam?.id]);

  // Reset unlock override when team changes
  useEffect(() => {
    setIsUnlockedOverride(false);
  }, [currentTeamIndex, selectedEventId]);

  // Subscribe to EventSource SSE stream for the selected event to get real-time additions (teams/questions/judges)
  useEffect(() => {
    if (!selectedEventId || !mounted) return;

    let eventSource = null;
    const connectSSE = () => {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      eventSource = new EventSource(`${origin}/api/event/${selectedEventId}/stream`);

      eventSource.addEventListener('state', (e) => {
        try {
          const json = JSON.parse(e.data);
          if (json.event) {
            setDb(prev => {
              const nextEvents = prev.events.map(ev => ev.id === json.event.id ? json.event : ev);
              if (!nextEvents.some(ev => ev.id === json.event.id)) {
                nextEvents.push(json.event);
              }
              return {
                ...prev,
                events: nextEvents
              };
            });
          }
        } catch (err) {
          console.error('Failed to parse SSE payload:', err);
        }
      });

      eventSource.onerror = (err) => {
        console.error('Mobile SSE connection lost. Reconnecting in 3 seconds...', err);
        eventSource.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [selectedEventId, mounted]);

  useEffect(() => {
    if (activeEvent && deviceId) {
      const activeJudges = activeEvent.connectedJudges || [];
      const match = activeJudges.find(j => j.deviceId === deviceId);
      if (match) {
        setIsRegistered(true);
        if (match.name) setJudgeName(match.name);
      } else {
        setIsRegistered(false);
      }
    }
  }, [activeEvent, deviceId]);

  // Register Judge with Name and Device Id (checking limits)
  const handleRegisterJudge = async (e) => {
    e.preventDefault();
    if (!judgeName.trim() || !selectedEventId) return;
    setRegError('');
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const res = await fetch(`${origin}/api/event/${selectedEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register-judge',
          payload: { deviceId, name: judgeName.trim() }
        })
      });

      if (res.ok) {
        localStorage.setItem('judgeName', judgeName.trim());
        setIsRegistered(true);
        fetchData();
      } else {
        const errData = await res.json();
        setRegError(errData.error || 'Failed to connect. Slots might be full.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setRegError('Network error. Check network connection to server.');
    }
  };

  const handleLogout = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      await fetch(`${origin}/api/event/${selectedEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-judge',
          payload: { deviceId }
        })
      });
      setIsRegistered(false);
      fetchData();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Show dynamic toast notifications
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 1500);
  };

  // Submit individual judge score to dynamic average scoring API
  const submitJudgeScore = async (teamId, score, criteria) => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const res = await fetch(`${origin}/api/event/${selectedEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-judge-score',
          payload: {
            teamId,
            trackKey: activeTab,
            deviceId,
            judgeName,
            score,
            criteria
          }
        })
      });

      if (res.ok) {
        const resData = await res.json();
        // Sync React state with the updated event details returned by the server
        setDb(prev => {
          const nextEvents = prev.events.map(e => e.id === resData.event.id ? resData.event : e);
          return { ...prev, events: nextEvents };
        });
        triggerToast('Score saved');
        return true;
      } else {
        triggerToast('Failed to save score');
        return false;
      }
    } catch (err) {
      console.error('Score submit error:', err);
      triggerToast('Network error');
      return false;
    }
  };

  // Stepper / Input changes for Quiz Scoring (local state only)
  const handleQuizScoreUpdate = (newScore) => {
    const val = Math.max(0, Number(newScore) || 0);
    setLocalQuizScore(val);
  };

  // Slider adjustments for evaluated judged round criteria (local state only)
  const handleJudgedCriteriaUpdate = (criterionId, val) => {
    setLocalCriteria(prev => ({
      ...prev,
      [criterionId]: Math.max(0, Number(val) || 0)
    }));
  };

  // Handles explicit score submission for active team
  const handleScoreSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!currentTeam) return;

    let finalScore = 0;
    let finalCriteria = null;

    if (activeTab === 'teams') {
      finalScore = localQuizScore;
      finalCriteria = null;
    } else {
      const criteriaInfo = TRACKS_CRITERIA[activeTab];
      if (!criteriaInfo) return;

      finalCriteria = {};
      criteriaInfo.criteria.forEach(crit => {
        finalCriteria[crit.id] = localCriteria[crit.id] !== undefined ? localCriteria[crit.id] : 0;
        finalScore += finalCriteria[crit.id];
      });
    }

    setIsSubmitting(true);
    const success = await submitJudgeScore(currentTeam.id, finalScore, finalCriteria);
    if (success) {
      setIsUnlockedOverride(false); // Reset unlock override so it locks instantly!
    }
    setIsSubmitting(false);
  };

  if (!mounted || loading) {
    return (
      <div className={styles.mobileContainer} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ fontWeight: 'bold', color: '#64748b' }}>Loading local controller...</p>
      </div>
    );
  }

  // 1. SETUP / REGISTRATION ACCESS CONTROL VIEW
  if (!isRegistered) {
    return (
      <div className={styles.mobileContainer} style={{ justifyContent: 'center' }}>
        <header className={styles.header}>
          <h1 className={styles.title}>Scoring Setup</h1>
          <p className={styles.subtitle}>Register as an active event judge</p>
        </header>

        <form onSubmit={handleRegisterJudge} className={styles.selectorCard}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.75rem' }}>
            <span className={styles.label}>Select Event</span>
            <select
              className={styles.selectInput}
              value={selectedEventId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedEventId(val);
                localStorage.setItem('judgeSelectedEventId', val);
                setRegError('');
              }}
            >
              {db.events.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.25rem' }}>
            <span className={styles.label}>Judge Display Name</span>
            <input
              type="text"
              placeholder="e.g. Judge Smith"
              className={styles.manualInput}
              value={judgeName}
              onChange={(e) => {
                setJudgeName(e.target.value);
                setRegError('');
              }}
              required
              style={{ textAlign: 'left', fontWeight: 'bold' }}
            />
          </div>

          {regError && (
            <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.05)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center' }}>
              ⚠️ {regError}
            </div>
          )}

          <button
            type="submit"
            className={styles.tabButtonActive}
            style={{ width: '100%', padding: '0.85rem', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Connect to Event
          </button>
        </form>
      </div>
    );
  }

  // 2. SCORING VIEW (FOR REGISTERED JUDGES ONLY)
  return (
    <div className={styles.mobileContainer}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ textAlign: 'left' }}>
          <h1 className={styles.title} style={{ fontSize: '1.5rem' }}>Mobile Controller</h1>
          <p className={styles.subtitle} style={{ margin: 0 }}>Active: <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>{judgeName}</span></p>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Disconnect
        </button>
      </header>

      {/* Select Event display info */}
      <div className={styles.selectorCard} style={{ padding: '0.85rem 1rem', marginBottom: '1rem' }}>
        <span className={styles.label} style={{ fontSize: '0.7rem' }}>Active Event Scope</span>
        <span style={{ fontSize: '0.95rem', fontWeight: '850', color: '#1e293b' }}>{activeEvent?.name}</span>
      </div>

      {teamList.length === 0 ? (
        <main className={styles.teamList}>
          <div className={styles.noTeams}>
            No teams registered for this track. Configure teams on the laptop dashboard.
          </div>
        </main>
      ) : (
        <main style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Progress Indicator */}
          <div className={styles.progressContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</span>
              <span style={{ fontSize: '0.8rem', fontWeight: '850', color: '#4f46e5' }}>Team {currentTeamIndex + 1} of {teamList.length}</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${((currentTeamIndex + 1) / teamList.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #4f46e5, #6366f1)', borderRadius: '10px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Single Team Card */}
          {(() => {
            const team = teamList[currentTeamIndex];
            const isQuiz = activeTab === 'teams';
            const criteriaInfo = isQuiz ? null : TRACKS_CRITERIA[activeTab];

            // Check if this judge device has already submitted scores for this team
            const judgeScoreRecord = team.judgeScores?.[deviceId];
            const isLocked = !!judgeScoreRecord && !isUnlockedOverride;

            // Compute score to display
            let displayedScore = 0;
            if (isLocked) {
              displayedScore = judgeScoreRecord.score;
            } else if (isQuiz) {
              displayedScore = localQuizScore;
            } else {
              // Sum criteria
              displayedScore = Object.keys(localCriteria).reduce((acc, k) => acc + (localCriteria[k] || 0), 0);
            }

            return (
              <section
                className={styles.teamCard}
                style={{ borderTop: `6px solid ${team.color || '#4f46e5'}`, borderLeft: '1px solid #e2e8f0' }}
              >
                {/* Team header */}
                <div className={styles.teamHeader}>
                  <div>
                    <h2 className={styles.teamName}>{team.name}</h2>
                    {team.members && team.members.length > 0 && (
                      <p className={styles.teamMembers}>{team.members.join(', ')}</p>
                    )}
                  </div>
                  <div className={styles.scoreBadge} style={{ background: isLocked ? 'rgba(16, 185, 129, 0.05)' : '#f8fafc', borderColor: isLocked ? 'rgba(16, 185, 129, 0.2)' : '#e2e8f0' }}>
                    <span className={styles.scoreNumber} style={{ color: isLocked ? '#10b981' : (team.color || '#4f46e5') }}>
                      {displayedScore}
                    </span>
                    <span className={styles.scoreUnits}>pts</span>
                  </div>
                </div>

                {/* Score Locked Alert banner */}
                {isLocked && (
                  <div className={styles.lockedBadge}>
                    <span className={styles.lockedText}>🔒 Score Submitted & Locked</span>
                    <span className={styles.lockedDesc}>You graded this team {displayedScore} pts. Results are saved.</span>
                    <button
                      onClick={() => setIsUnlockedOverride(true)}
                      style={{
                        marginTop: '0.65rem',
                        padding: '0.4rem 0.85rem',
                        background: 'rgba(79, 70, 229, 0.08)',
                        color: '#4f46e5',
                        border: '1.5px solid rgba(79, 70, 229, 0.25)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      🔓 Unlock Score to Edit
                    </button>
                  </div>
                )}

                {/* Score Controls */}
                {isQuiz ? (
                  /* Quiz: Steppers & manual keypad input */
                  <div className={styles.quizControls}>
                    <div className={styles.stepperRow}>
                      <button
                        className={`${styles.stepperBtn} ${styles.stepperBtnSub}`}
                        disabled={isLocked}
                        onClick={() => handleQuizScoreUpdate(displayedScore - 10)}
                      >
                        -10
                      </button>
                      <button
                        className={`${styles.stepperBtn} ${styles.stepperBtnSub}`}
                        disabled={isLocked}
                        onClick={() => handleQuizScoreUpdate(displayedScore - 1)}
                      >
                        -1
                      </button>
                      <button
                        className={`${styles.stepperBtn} ${styles.stepperBtnAdd}`}
                        disabled={isLocked}
                        onClick={() => handleQuizScoreUpdate(displayedScore + 1)}
                      >
                        +1
                      </button>
                      <button
                        className={`${styles.stepperBtn} ${styles.stepperBtnAdd}`}
                        disabled={isLocked}
                        onClick={() => handleQuizScoreUpdate(displayedScore + 10)}
                      >
                        +10
                      </button>
                    </div>
                    <div className={styles.manualInputRow}>
                      <span className={styles.label}>Score Override</span>
                      <input
                        type="number"
                        className={styles.manualInput}
                        disabled={isLocked}
                        value={displayedScore}
                        onChange={(e) => handleQuizScoreUpdate(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  /* Judged: Sliders per evaluation criteria */
                  <div className={styles.judgedControls}>
                    {criteriaInfo.criteria.map(crit => {
                      const val = isLocked 
                        ? (judgeScoreRecord.criteria?.[crit.id] || 0)
                        : (localCriteria[crit.id] || 0);

                      return (
                        <div key={crit.id} className={styles.sliderRow}>
                          <div className={styles.sliderHeader}>
                            <span className={styles.sliderName}>{crit.name}</span>
                            <span className={styles.sliderVal} style={{ background: isLocked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(79, 70, 229, 0.08)', color: isLocked ? '#10b981' : '#4f46e5' }}>{val} / {crit.max}</span>
                          </div>
                          <input
                            type="range"
                            className={styles.sliderInput}
                            disabled={isLocked}
                            min="0"
                            max={crit.max}
                            value={val}
                            style={{ accentColor: isLocked ? '#10b981' : '#4f46e5' }}
                            onChange={(e) => handleJudgedCriteriaUpdate(crit.id, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Submit button when not locked */}
                {!isLocked && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      onClick={handleScoreSubmit}
                      disabled={isSubmitting}
                      className={styles.submitBtn}
                    >
                      {isSubmitting ? 'Submitting...' : '💾 Submit Score'}
                    </button>
                  </div>
                )}
              </section>
            );
          })()}

          {/* Navigation Controls */}
          <div className={styles.navRow}>
            <button
              className={styles.navBtn}
              onClick={() => setCurrentTeamIndex(prev => Math.max(0, prev - 1))}
              disabled={currentTeamIndex === 0}
            >
              &larr; Prev Team
            </button>
            <button
              className={styles.navBtn}
              onClick={() => setCurrentTeamIndex(prev => Math.min(teamList.length - 1, prev + 1))}
              disabled={currentTeamIndex === teamList.length - 1}
            >
              Next Team &rarr;
            </button>
          </div>
        </main>
      )}

      {/* Floating Save Toast feedback */}
      {toastMessage && (
        <div className={styles.toast}>
          <span>💾</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
