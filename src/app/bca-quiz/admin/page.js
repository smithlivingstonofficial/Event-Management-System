'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import '../style.css';

export default function BcaQuizAdmin() {
  const router = useRouter();
  
  // Theme state
  const [lightTheme, setLightTheme] = useState(false);

  // Script loading state
  const [jsLoaded, setJsLoaded] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeOperator, setActiveOperator] = useState('');

  // Active Tab: 'students' | 'events' | 'standings' | 'top10' | 'admins'
  const [activeTab, setActiveTab] = useState('students');

  // Sheet DOM Containers & Handsontable references
  const studentSheetContainerRef = useRef(null);
  const eventSheetContainerRef = useRef(null);
  const studentSheetRef = useRef(null);
  const eventSheetRef = useRef(null);

  // Standings data state
  const [standingsData, setStandingsData] = useState({});
  const [standingsLoading, setStandingsLoading] = useState(false);

  // Top 10 Leaderboards state
  const [top10Data, setTop10Data] = useState({});
  const [leaderboardEvents, setLeaderboardEvents] = useState([]);
  const [selectedLeaderboardEvent, setSelectedLeaderboardEvent] = useState('');
  const [leaderboardRows, setLeaderboardRows] = useState([]);

  // Superadmin Admins control state
  const [adminAccounts, setAdminAccounts] = useState([]);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');

  // Dynamic asset loading for Handsontable
  useEffect(() => {
    // 1. Inject Handsontable CSS
    if (!document.getElementById('handsontable-css')) {
      const link = document.createElement('link');
      link.id = 'handsontable-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.css';
      document.head.appendChild(link);
    }

    // 2. Inject Handsontable JS Script
    if (typeof window !== 'undefined' && !window.Handsontable) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.js';
      script.async = true;
      script.onload = () => {
        setJsLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      setJsLoaded(true);
    }
  }, []);

  // Check login session storage on mount
  useEffect(() => {
    const savedUser = sessionStorage.getItem('activeOperator');
    if (savedUser) {
      setActiveOperator(savedUser);
      setIsAuthenticated(true);
    }
  }, []);

  // Render spreadsheets when authenticated and Handsontable script is loaded
  useEffect(() => {
    if (isAuthenticated && jsLoaded) {
      if (activeTab === 'students') {
        initStudentSheet();
      } else if (activeTab === 'events') {
        initEventSheet();
      }
    }
    
    // Cleanup sheets on tab switches
    return () => {
      if (activeTab !== 'students' && studentSheetRef.current) {
        studentSheetRef.current.destroy();
        studentSheetRef.current = null;
      }
      if (activeTab !== 'events' && eventSheetRef.current) {
        eventSheetRef.current.destroy();
        eventSheetRef.current = null;
      }
    };
  }, [isAuthenticated, jsLoaded, activeTab]);

  // Login handler
  const handleAdminVerify = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');

    if (!adminUsername || !adminPassword) {
      setAuthError('⚠️ Both username and password are required.');
      return;
    }

    try {
      const res = await fetch('/api/bca-quiz/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const authResult = await res.json();

      if (authResult.success) {
        const username = authResult.userProfileName;
        setActiveOperator(username);
        sessionStorage.setItem('activeOperator', username);
        setIsAuthenticated(true);
      } else {
        setAuthError('❌ Invalid username or password. Access denied.');
        setAdminPassword('');
      }
    } catch (err) {
      console.error(err);
      setAuthError('💥 Server error. Please verify backend state.');
    }
  };

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem('activeOperator');
    setActiveOperator('');
    setIsAuthenticated(false);
  };

  /* ========================================================
     STUDENT EXCEL GRID INITIALIZATION
  ======================================================== */
  const initStudentSheet = async () => {
    if (typeof window === 'undefined' || !window.Handsontable || !studentSheetContainerRef.current) return;

    try {
      const masterRes = await fetch('/api/bca-quiz/student-list');
      const masterStudents = await masterRes.json();

      const submissionsRes = await fetch('/api/bca-quiz/students');
      const liveSubmissions = await submissionsRes.json();

      const flatStudents = masterStudents.map(s => {
        const eventNames = s.events ? s.events.map(e => e.eventName).join(', ') : '';
        const partTypes = s.events ? s.events.map(e => e.participantType).join(', ') : '';
        const teamNames = s.events ? s.events.map(e => e.teamName || '').join(', ') : '';
        
        const lookup = liveSubmissions.find(sub => sub.regNo === s.regNo);
        const scoreValue = lookup ? lookup.score : '';
        const auditorName = lookup && lookup.awardedBy ? lookup.awardedBy : '-';
        
        return [
          s.collegeName || '', 
          s.regNo || '', 
          s.name || '', 
          s.dept || '', 
          eventNames, 
          partTypes, 
          teamNames, 
          scoreValue, 
          auditorName
        ];
      });

      if (studentSheetRef.current) {
        studentSheetRef.current.destroy();
      }

      studentSheetRef.current = new window.Handsontable(studentSheetContainerRef.current, {
        data: flatStudents,
        rowHeaders: true,
        colHeaders: ['College Name', 'Register No', 'Student Name', 'Department', 'Assigned Events', 'Participation Type', 'Team Name', 'Score', 'Awarded By'],
        columns: [
          { width: 160 }, { width: 100 }, { width: 120 }, { width: 90 }, { width: 180 }, { width: 120 }, { width: 120 },
          { 
            width: 80,  
            type: 'numeric',
            validator: function(value, callback) {
              if (value === null || value === "") {
                callback(true);
              } else {
                callback(value >= 0 && value <= 10);
              }
            }
          },
          { width: 110, readOnly: true }
        ],
        contextMenu: true,
        licenseKey: 'non-commercial-and-evaluation',
        stretchH: 'all'
      });
    } catch (err) {
      console.error('Failed to initialize students grid:', err);
    }
  };

  const saveStudentsData = () => {
    if (!studentSheetRef.current) return;

    studentSheetRef.current.validateCells((valid) => {
      if (!valid) {
        alert("❌ Input Error: High Score values inside Excel rows must fall strictly between 0 and 10 points.");
        return;
      }
      executeStudentsSaveOperation();
    });
  };

  const executeStudentsSaveOperation = async () => {
    if (!studentSheetRef.current) return;

    const rawData = studentSheetRef.current.getData();
    const processedStudents = [];

    for (let row of rawData) {
      if (!row[1] || !row[2]) continue;

      const eventList = row[4] ? row[4].split(',').map(e => e.trim()) : [];
      const typeList = row[5] ? row[5].split(',').map(t => t.trim()) : [];
      const teamList = row[6] ? row[6].split(',').map(tm => tm.trim()) : [];

      const eventsArray = eventList.map((evt, idx) => ({
        eventName: evt,
        participantType: typeList[idx] || 'Solo',
        teamName: teamList[idx] || ''
      })).filter(e => e.eventName !== '');

      processedStudents.push({
        collegeName: row[0] || '', 
        regNo: row[1] || '', 
        name: row[2] || '', 
        dept: row[3] || '',
        events: eventsArray,
        score: (row[7] !== null && row[7] !== "") ? parseInt(row[7], 10) : null
      });
    }

    try {
      const res = await fetch('/api/bca-quiz/admin/students', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestor: activeOperator, studentsData: processedStudents })
      });
      const feedback = await res.json();
      alert(feedback.message || "Records updated successfully");
      initStudentSheet();
    } catch (err) {
      console.error(err);
      alert('Failed saving student records changes.');
    }
  };

  /* ========================================================
     EVENTS EXCEL GRID INITIALIZATION
  ======================================================== */
  const initEventSheet = async () => {
    if (typeof window === 'undefined' || !window.Handsontable || !eventSheetContainerRef.current) return;

    try {
      const res = await fetch('/api/bca-quiz/events');
      const data = await res.json();
      const events = data.events || [];

      const flatEvents = events.map(e => [e.name || '', e.participantTypes ? e.participantTypes.join(', ') : 'Solo', e.page || '']);

      if (eventSheetRef.current) {
        eventSheetRef.current.destroy();
      }

      eventSheetRef.current = new window.Handsontable(eventSheetContainerRef.current, {
        data: flatEvents,
        rowHeaders: true,
        colHeaders: ['Event Name', 'Participant Types Allowed', 'Template Layout Engine Page'],
        columns: [{ width: 250 }, { width: 200 }, { width: 200 }],
        contextMenu: true,
        licenseKey: 'non-commercial-and-evaluation',
        stretchH: 'all'
      });
    } catch (err) {
      console.error('Failed to initialize events config sheet:', err);
    }
  };

  const saveEventsData = async () => {
    if (!eventSheetRef.current) return;

    const rawData = eventSheetRef.current.getData();
    const processedEvents = [];

    for (let row of rawData) {
      if (!row[0]) continue;
      processedEvents.push({
        name: row[0].trim(),
        participantTypes: row[1] ? row[1].split(',').map(item => item.trim()) : ['Solo'],
        page: row[2] ? row[2].trim() : 'quiz.html'
      });
    }

    try {
      const res = await fetch("/api/bca-quiz/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: processedEvents })
      });
      const feedback = await res.json();
      alert(feedback.message || "Events updated successfully");
      initEventSheet();
    } catch (err) {
      console.error(err);
      alert('Failed saving events configuration maps.');
    }
  };

  const addNewBlankRow = (sheetType) => {
    if (sheetType === 'students' && studentSheetRef.current) {
      studentSheetRef.current.alter('insert_row_below');
    } else if (sheetType === 'events' && eventSheetRef.current) {
      eventSheetRef.current.alter('insert_row_below');
    }
  };

  /* ========================================================
     PODIUM STANDINGS COMPILER
  ======================================================== */
  const loadLiveStandings = async () => {
    setStandingsLoading(true);
    try {
      const res = await fetch("/api/bca-quiz/admin/standings");
      const data = await res.json();
      setStandingsData(data);
    } catch (err) {
      console.error(err);
      alert("❌ Failed compiling standing placements.");
    } finally {
      setStandingsLoading(false);
    }
  };

  /* ========================================================
     TOP 10 LEADERBOARD MATRICES
  ======================================================== */
  const loadTop10Leaderboards = async () => {
    try {
      const res = await fetch("/api/bca-quiz/admin/top10");
      const data = await res.json();
      setTop10Data(data);
      
      const events = Object.keys(data);
      setLeaderboardEvents(events);
      setSelectedLeaderboardEvent('');
      setLeaderboardRows([]);
    } catch (err) {
      console.error(err);
      alert("❌ Failed compiling leaderboard lists.");
    }
  };

  const handleLeaderboardFilterChange = (e) => {
    const eventName = e.target.value;
    setSelectedLeaderboardEvent(eventName);
    if (eventName) {
      setLeaderboardRows(top10Data[eventName] || []);
    } else {
      setLeaderboardRows([]);
    }
  };

  /* ========================================================
     SUPERADMIN CONTROL LOGIC (ONLY FOR DURAI)
  ======================================================== */
  const loadAdminAccountsList = async () => {
    try {
      const res = await fetch(`/api/bca-quiz/admin/users?requestor=${activeOperator}`);
      const users = await res.json();
      setAdminAccounts(users);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAdminAccount = async () => {
    if (!newAdminUser || !newAdminPass) {
      alert('Fields cannot be empty.');
      return;
    }

    try {
      const res = await fetch("/api/bca-quiz/admin/users/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestor: activeOperator, username: newAdminUser, password: newAdminPass })
      });
      const result = await res.json();
      alert(result.message);

      if (result.success) {
        setNewAdminUser('');
        setNewAdminPass('');
        loadAdminAccountsList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveAdminAccount = async (targetUser) => {
    if (!confirm(`Are you sure you want to permanently delete admin user: "${targetUser}"?`)) return;

    try {
      const res = await fetch("/api/bca-quiz/admin/users/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestor: activeOperator, username: targetUser })
      });
      const result = await res.json();
      alert(result.message);

      if (result.success) {
        loadAdminAccountsList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Tab Switch Manager
  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'standings') {
      loadLiveStandings();
    } else if (tab === 'top10') {
      loadTop10Leaderboards();
    } else if (tab === 'admins') {
      loadAdminAccountsList();
    }
  };

  // Toggle Theme
  const toggleTheme = () => {
    setLightTheme(!lightTheme);
  };

  return (
    <div className={`bca_quiz_body ${lightTheme ? 'light-theme' : ''}`}>
      {!isAuthenticated ? (
        <div className="auth-overlay">
          <form className="auth-card" onSubmit={handleAdminVerify}>
            <h2>🔒 Admin Sheet Login</h2>
            <p>Please enter administrative credentials to unlock Excel sheets and metrics dashboards.</p>
            
            <div className="input-group" style={{ textAlign: 'left' }}>
              <label htmlFor="adminUsername">Username</label>
              <input 
                type="text" 
                id="adminUsername" 
                placeholder="Enter username" 
                autoComplete="username"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ textAlign: 'left', marginTop: '15px' }}>
              <label htmlFor="adminPassword">Password</label>
              <input 
                type="password" 
                id="adminPassword" 
                placeholder="••••••••" 
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
              {authError && <div className="error-msg" style={{ display: 'block', color: 'var(--danger)', marginTop: '10px', fontWeight: 'bold' }}>{authError}</div>}
            </div>

            <button type="submit" style={{ background: 'var(--primary)', width: '100%' }}>Verify Identity</button>
            <button 
              type="button" 
              onClick={() => router.push('/bca-quiz')} 
              style={{ background: 'transparent', color: 'var(--text-muted)', boxShadow: 'none', marginTop: '5px', width: '100%', border: 'none' }}
            >
              Cancel
            </button>
          </form>
        </div>
      ) : (
        <div className="container" style={{ maxWidth: '1100px' }}>
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {lightTheme ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
          
          <h1 className="bca_title">
            Excel Administrative Dashboard 
            <span id="activeUserBadge" style={{ fontSize: '1rem', color: 'var(--accent-neon)', verticalAlign: 'middle', marginLeft: '10px' }}>
              (Logged in as: {activeOperator})
            </span>
          </h1>

          {/* Admin Tabs */}
          <div className="admin-nav" style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => switchTab('students')} 
              style={{ width: 'auto', padding: '10px 20px', background: activeTab === 'students' ? 'var(--primary)' : '#475569' }}
            >
              🧑‍🎓 Manage Students Master
            </button>
            <button 
              onClick={() => switchTab('events')} 
              style={{ width: 'auto', padding: '10px 20px', background: activeTab === 'events' ? 'var(--primary)' : '#475569' }}
            >
              🏆 Manage Events Config
            </button>

            {activeOperator.toLowerCase() === 'durai' && (
              <>
                <button 
                  onClick={() => switchTab('standings')} 
                  style={{ width: 'auto', padding: '10px 20px', background: activeTab === 'standings' ? 'var(--primary)' : '#6366f1' }}
                >
                  🥇 Winner Podiums
                </button>
                <button 
                  onClick={() => switchTab('top10')} 
                  style={{ width: 'auto', padding: '10px 20px', background: activeTab === 'top10' ? 'var(--primary)' : '#10b981' }}
                >
                  🏆 Top 10 Leaderboard
                </button>
                <button 
                  onClick={() => switchTab('admins')} 
                  style={{ width: 'auto', padding: '10px 20px', background: activeTab === 'admins' ? 'var(--primary)' : '#a855f7' }}
                >
                  👥 Manage Admins
                </button>
              </>
            )}

            <button onClick={() => router.push('/bca-quiz')} style={{ width: 'auto', padding: '10px 20px', background: '#334155' }}>
              🏠 Back to Registration
            </button>
            <button onClick={handleLogout} style={{ width: 'auto', padding: '10px 20px', background: 'var(--danger)', marginLeft: 'auto' }}>
              🚪 Logout
            </button>
          </div>

          {/* Tab 1: Students Grid */}
          <div className={`sheet-section ${activeTab === 'students' ? 'active' : ''}`}>
            <h2>Students Master Dataset</h2>
            <p className="helper-text">💡 Tip: You can copy cells from an external Excel sheet and paste them here directly. Split multiple items by commas (e.g. Events: <code>Quiz Competition, Web Design</code> | Type: <code>Solo, Team</code> | Team Name: <code>, Tech Titans</code>).</p>
            <div ref={studentSheetContainerRef} className="excel-container"></div>
            <div className="action-row">
              <button onClick={saveStudentsData} className="btn-success">💾 Save Student & Score Changes</button>
              <button onClick={() => addNewBlankRow('students')} style={{ background: 'var(--primary)' }}>➕ Add Blank Row</button>
            </div>
          </div>

          {/* Tab 2: Events Grid */}
          <div className={`sheet-section ${activeTab === 'events' ? 'active' : ''}`}>
            <h2>Events Configuration Meta</h2>
            <p className="helper-text">💡 Format participants types split by comma (e.g. <code>Solo, Team</code>)</p>
            <div ref={eventSheetContainerRef} className="excel-container"></div>
            <div className="action-row">
              <button onClick={saveEventsData} className="btn-success">💾 Save Event Configuration</button>
              <button onClick={() => addNewBlankRow('events')} style={{ background: 'var(--primary)' }}>➕ Add Blank Row</button>
            </div>
          </div>

          {/* Tab 3: Standings Winner Podiums */}
          <div className={`sheet-section ${activeTab === 'standings' ? 'active' : ''}`}>
            <h2>Event Leaderboards (Winners & Runners-Up)</h2>
            <p className="helper-text">🏆 Rank evaluation updates dynamically when students complete activities on this framework.</p>
            
            {standingsLoading ? (
              <p className="helper-text">Computing podium layouts...</p>
            ) : (
              <div id="leaderboardGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginTop: '20px' }}>
                {Object.entries(standingsData).map(([eventName, placement]) => (
                  <div key={eventName} className="podium-card">
                    <h3>🏆 {eventName}</h3>
                    {placement.winner ? (
                      <div className="rank-box gold">
                        <span className="badge">🥇</span>
                        <div className="rank-info">
                          <p style={{ fontWeight: 'bold', color: '#f59e0b' }}>Winner (1st Place)</p>
                          <p><strong>Name:</strong> {placement.winner.name} ({placement.winner.regNo})</p>
                          <p>
                            {placement.winner.teamName && <><strong>Team:</strong> {placement.winner.teamName} | </>}
                            <strong>Score:</strong> {placement.winner.score} Pts
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rank-box">
                        <span className="badge">⚪</span>
                        <div className="rank-info">
                          <p className="no-record">No entries recorded.</p>
                        </div>
                      </div>
                    )}
                    {placement.runner ? (
                      <div className="rank-box silver">
                        <span className="badge">🥈</span>
                        <div className="rank-info">
                          <p style={{ fontWeight: 'bold', color: '#e2e8f0' }}>Runner-Up (2nd Place)</p>
                          <p><strong>Name:</strong> {placement.runner.name} ({placement.runner.regNo})</p>
                          <p>
                            {placement.runner.teamName && <><strong>Team:</strong> {placement.runner.teamName} | </>}
                            <strong>Score:</strong> {placement.runner.score} Pts
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rank-box">
                        <span className="badge">⚪</span>
                        <div className="rank-info">
                          <p className="no-record">No runner entries.</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tab 4: Top 10 Leaderboard */}
          <div className={`sheet-section ${activeTab === 'top10' ? 'active' : ''}`}>
            <h2>Top 10 High Scores Leaderboard</h2>
            <p className="helper-text">📊 Select an event from the list layout below to view its specific ranking matrix.</p>
            
            <div className="input-group" style={{ maxWidth: '400px', margin: '20px 0' }}>
              <label htmlFor="eventLeaderboardFilter" style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>Select Event Competition</label>
              <select id="eventLeaderboardFilter" value={selectedLeaderboardEvent} onChange={handleLeaderboardFilterChange} style={{ cursor: 'pointer' }}>
                <option value="">-- Choose Competition Event --</option>
                {leaderboardEvents.map(evtName => (
                  <option key={evtName} value={evtName}>{evtName}</option>
                ))}
              </select>
            </div>

            <div id="top10VerticalLayout" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
              {selectedLeaderboardEvent ? (
                <div className="leaderboard-panel" style={{ animation: 'fadeInArena 0.3s ease-in-out' }}>
                  <h3>🏆 Top 10 High Scores: {selectedLeaderboardEvent}</h3>
                  <table className="rank-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Reg No</th>
                        <th>Student Name</th>
                        <th>Dept</th>
                        <th>Team Name</th>
                        <th>Score Accomplished</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardRows.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No records found for this competition event yet.
                          </td>
                        </tr>
                      ) : (
                        leaderboardRows.map((r) => {
                          const badgeClass = r.rank <= 3 ? `pos-${r.rank}` : '';
                          return (
                            <tr key={r.regNo}>
                              <td><span className={`pos-badge ${badgeClass}`}>{r.rank}</span></td>
                              <td><strong>{r.regNo}</strong></td>
                              <td>{r.name}</td>
                              <td><span style={{ color: 'var(--text-muted)' }}>{r.dept}</span></td>
                              <td><span style={{ color: '#10b981', fontWeight: '600' }}>{r.teamName || '-'}</span></td>
                              <td><strong>{r.score}</strong> / {r.totalQuestions} Pts</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="helper-text">💡 Please choose an entry from the dropdown menu above to display its leaderboard data.</p>
              )}
            </div>
          </div>

          {/* Tab 5: Manage Admins */}
          <div className={`sheet-section ${activeTab === 'admins' ? 'active' : ''}`}>
            <h2>Admin Accounts Controller Workspace</h2>
            <p className="helper-text">🔒 Superadmin Privileges Enabled. Only you can create or clear active system controller identities.</p>
            
            <div className="user-control-grid">
              <div className="leaderboard-panel" style={{ height: 'fit-content' }}>
                <h4 style={{ marginTop: 0, color: 'var(--primary)' }}>➕ Add New Administrator</h4>
                <div className="input-group">
                  <label>New Username</label>
                  <input 
                    type="text" 
                    placeholder="e.g., staff_bca"
                    value={newAdminUser}
                    onChange={(e) => setNewAdminUser(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ marginTop: '10px' }}>
                  <label>Set Secure Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                  />
                </div>
                <button onClick={handleAddAdminAccount} style={{ background: 'var(--accent-neon)', marginTop: '10px' }}>Create Admin Account</button>
              </div>

              <div className="leaderboard-panel">
                <h4 style={{ marginTop: 0, color: '#60a5fa' }}>📋 Current System Administrators</h4>
                <div id="activeAdminsContainer" style={{ marginTop: '15px' }}>
                  {adminAccounts.map((u) => (
                    <div key={u.username} className="user-card-item">
                      <span>👤 <strong>{u.username}</strong></span>
                      {u.username === 'durai' ? (
                        <span style={{ color: 'var(--accent-neon)', fontSize: '0.85rem', fontWeight: 'bold' }}>👑 Primary Superadmin</span>
                      ) : (
                        <button onClick={() => handleRemoveAdminAccount(u.username)} style={{ width: 'auto', padding: '5px 12px', fontSize: '0.8rem', background: 'var(--danger)' }}>
                          Delete User
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
