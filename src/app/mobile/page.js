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
  const teamList = activeEvent ? (activeEvent[activeTab] || []) : [];

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
      } else {
        triggerToast('Failed to save score');
      }
    } catch (err) {
      console.error('Score submit error:', err);
      triggerToast('Network error');
    }
  };

  // Stepper / Input changes for Quiz Scoring
  const handleQuizScoreUpdate = (teamId, newScore) => {
    const val = Math.max(0, Number(newScore) || 0);
    submitJudgeScore(teamId, val, null);
  };

  // Slider adjustments for evaluated judged round criteria
  const handleJudgedCriteriaUpdate = (teamId, criterionId, val) => {
    if (!activeEvent) return;
    const trackTeams = activeEvent[activeTab] || [];
    const team = trackTeams.find(t => t.id === teamId);
    if (!team) return;

    const currentJudgeScore = team.judgeScores?.[deviceId];
    const currentCriteria = currentJudgeScore?.criteria || team.criteria || {};

    const updatedCriteria = {
      ...currentCriteria,
      [criterionId]: Math.max(0, Number(val) || 0)
    };

    let sum = 0;
    Object.keys(updatedCriteria).forEach(k => {
      sum += updatedCriteria[k];
    });

    submitJudgeScore(teamId, sum, updatedCriteria);
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

      {/* Tab bar selection */}
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tabButton} ${activeTab === t.key ? styles.tabButtonActive : ''}`}
            onClick={() => {
              setActiveTab(t.key);
              localStorage.setItem('judgeActiveTab', t.key);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Team Cards Lists */}
      <main className={styles.teamList}>
        {teamList.length === 0 ? (
          <div className={styles.noTeams}>
            No teams registered for this track. Configure teams on the laptop dashboard.
          </div>
        ) : (
          teamList.map(team => {
            const isQuiz = activeTab === 'teams';
            const criteriaInfo = isQuiz ? null : TRACKS_CRITERIA[activeTab];

            // UI/UX: Display the judge's OWN score instead of the global aggregated average
            const judgeScoreRecord = team.judgeScores?.[deviceId];
            const displayedScore = judgeScoreRecord ? judgeScoreRecord.score : 0;

            return (
              <section
                key={team.id}
                className={styles.teamCard}
                style={{ borderLeft: `6px solid ${team.color || '#cbd5e1'}` }}
              >
                {/* Team header and current score */}
                <div className={styles.teamHeader}>
                  <div>
                    <h2 className={styles.teamName}>{team.name}</h2>
                    {team.members && team.members.length > 0 && (
                      <p className={styles.teamMembers}>{team.members.join(', ')}</p>
                    )}
                  </div>
                  <div className={styles.scoreBadge}>
                    <span className={styles.scoreNumber} style={{ color: team.color || '#4f46e5' }}>
                      {displayedScore}
                    </span>
                    <span className={styles.scoreUnits}>pts</span>
                  </div>
                </div>

                {/* Score Controls */}
                {isQuiz ? (
                  /* Quiz: Steppers & manual keypad input */
                  <div className={styles.quizControls}>
                    <div className={styles.stepperRow}>
                      <button
                        className={`${styles.stepperBtn} ${styles.stepperBtnSub}`}
                        onClick={() => handleQuizScoreUpdate(team.id, displayedScore - 10)}
                      >
                        -10
                      </button>
                      <button
                        className={`${styles.stepperBtn} ${styles.stepperBtnSub}`}
                        onClick={() => handleQuizScoreUpdate(team.id, displayedScore - 1)}
                      >
                        -1
                      </button>
                      <button
                        className={`${styles.stepperBtn} ${styles.stepperBtnAdd}`}
                        onClick={() => handleQuizScoreUpdate(team.id, displayedScore + 1)}
                      >
                        +1
                      </button>
                      <button
                        className={`${styles.stepperBtn} ${styles.stepperBtnAdd}`}
                        onClick={() => handleQuizScoreUpdate(team.id, displayedScore + 10)}
                      >
                        +10
                      </button>
                    </div>
                    <div className={styles.manualInputRow}>
                      <span className={styles.label}>Score Override</span>
                      <input
                        type="number"
                        className={styles.manualInput}
                        value={displayedScore}
                        onChange={(e) => handleQuizScoreUpdate(team.id, e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  /* Judged: Sliders per evaluation criteria */
                  <div className={styles.judgedControls}>
                    {criteriaInfo.criteria.map(crit => {
                      const criteriaObj = judgeScoreRecord ? (judgeScoreRecord.criteria || {}) : {};
                      const val = criteriaObj[crit.id] || 0;
                      return (
                        <div key={crit.id} className={styles.sliderRow}>
                          <div className={styles.sliderHeader}>
                            <span className={styles.sliderName}>{crit.name}</span>
                            <span className={styles.sliderVal}>{val} / {crit.max}</span>
                          </div>
                          <input
                            type="range"
                            className={styles.sliderInput}
                            min="0"
                            max={crit.max}
                            value={val}
                            onChange={(e) => handleJudgedCriteriaUpdate(team.id, crit.id, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>

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
