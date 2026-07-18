'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './style.css';

export default function BcaQuizPortal() {
  const router = useRouter();
  
  // Theme state
  const [lightTheme, setLightTheme] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeOperator, setActiveOperator] = useState('');

  // Dropdown / Form State
  const [studentsMasterList, setStudentsMasterList] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');
  const [filteredRegNos, setFilteredRegNos] = useState([]);
  const [selectedRegNo, setSelectedRegNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentDept, setStudentDept] = useState('');
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [participantType, setParticipantType] = useState('');
  const [teamName, setTeamName] = useState('');
  const [showTeamDiv, setShowTeamDiv] = useState(false);

  // Score override State
  const [studentLiveScore, setStudentLiveScore] = useState('');
  const [scoreWarning, setScoreWarning] = useState('');
  const [scoreAuditor, setScoreAuditor] = useState('');
  const [isScoreReadOnly, setIsScoreReadOnly] = useState(false);
  const [showUpdateBtn, setShowUpdateBtn] = useState(true);

  // Load session storage and theme settings
  useEffect(() => {
    const savedUser = sessionStorage.getItem('activeOperator');
    if (savedUser) {
      setActiveOperator(savedUser);
      setIsAuthenticated(true);
      loadStudentsMaster();
    }
  }, []);

  // Sync state if authenticated changes
  useEffect(() => {
    if (isAuthenticated) {
      loadStudentsMaster();
    }
  }, [isAuthenticated]);

  // Load students master list from backend API
  const loadStudentsMaster = async () => {
    try {
      const res = await fetch('/api/bca-quiz/student-list');
      const data = await res.json();
      setStudentsMasterList(data);
      
      const uniqueColleges = [...new Set(data.map(s => s.collegeName))].filter(Boolean);
      setColleges(uniqueColleges);
    } catch (err) {
      console.error('Error loading student master list:', err);
    }
  };

  // Handle portal login verification
  const handlePortalLogin = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');

    if (!adminUsername || !adminPassword) {
      setAuthError('⚠️ Both fields are required.');
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
        setAuthError('❌ Unauthorized: Invalid credentials.');
        setAdminPassword('');
      }
    } catch (err) {
      console.error('Auth server error:', err);
      setAuthError('💥 Server error. Please verify backend state.');
    }
  };

  // Handle logout
  const handleLogout = () => {
    sessionStorage.removeItem('activeOperator');
    setActiveOperator('');
    setIsAuthenticated(false);
    clearFormFields();
  };

  // Handle college change
  const handleCollegeChange = (e) => {
    const college = e.target.value;
    setSelectedCollege(college);
    setSelectedRegNo('');
    clearStudentFields();

    if (college) {
      const regs = studentsMasterList.filter(s => s.collegeName === college).map(s => s.regNo);
      setFilteredRegNos(regs);
    } else {
      setFilteredRegNos([]);
    }
  };

  // Handle reg number change
  const handleRegNoChange = async (e) => {
    const regNo = e.target.value;
    setSelectedRegNo(regNo);
    
    if (!regNo) {
      clearStudentFields();
      return;
    }

    const student = studentsMasterList.find(s => s.regNo === regNo);
    if (!student) {
      clearStudentFields();
      return;
    }

    setStudentName(student.name);
    setStudentDept(student.dept);
    setAvailableEvents(student.events || []);
    setSelectedEvent('');
    setParticipantType('');
    setTeamName('');
    setShowTeamDiv(false);

    // Fetch existing live score
    fetchAndRenderLiveScore(regNo, student.events && student.events[0] ? student.events[0].eventName : '');
  };

  // Handle event change
  const handleEventChange = (e) => {
    const eventVal = e.target.value;
    setSelectedEvent(eventVal);

    if (!eventVal || !selectedRegNo) {
      setParticipantType('');
      setTeamName('');
      setShowTeamDiv(false);
      return;
    }

    const student = studentsMasterList.find(s => s.regNo === selectedRegNo);
    if (!student) return;

    const targetEvent = student.events.find(evt => evt.eventName === eventVal);
    if (!targetEvent) {
      setParticipantType('');
      setTeamName('');
      setShowTeamDiv(false);
      return;
    }

    setParticipantType(targetEvent.participantType || '');
    setTeamName(targetEvent.teamName || '');
    setShowTeamDiv(targetEvent.participantType === 'Team');

    fetchAndRenderLiveScore(selectedRegNo, eventVal);
  };

  // Fetch score logic from ledger
  const fetchAndRenderLiveScore = async (regNo, eventName) => {
    setScoreAuditor('Checking historical ledger logs...');
    setStudentLiveScore('');
    setIsScoreReadOnly(false);
    setShowUpdateBtn(true);
    setScoreWarning('');

    try {
      const res = await fetch(`/api/bca-quiz/students?regNo=${regNo}`);
      const scoreData = await res.json();
      // Find matching registration
      const record = scoreData.find(sub => sub.regNo === regNo);

      if (record && record.score !== null) {
        setStudentLiveScore(record.score.toString());
        setScoreAuditor(record.awardedBy ? `🎖️ Score recorded by admin: "${record.awardedBy}"` : '📝 Auto-submitted by student via exam room.');
        
        // Lock changing score unless operator is superadmin 'durai'
        if (activeOperator.toLowerCase() !== 'durai') {
          setIsScoreReadOnly(true);
          setShowUpdateBtn(false);
          setScoreWarning("🔒 Entry Locked: This student already has a recorded score. Only Superadmin 'durai' can update entries multiple times.");
        }
      } else {
        setStudentLiveScore('');
        setScoreAuditor('❌ Student has not attempted this test item yet.');
      }
    } catch (err) {
      console.error(err);
      setScoreAuditor('⚠️ Failed pulling score tracking data.');
    }
  };

  // Live score input filter validations
  const handleScoreInput = (val) => {
    setScoreWarning('');
    
    if (/[^0-9]/g.test(val)) {
      setScoreWarning('⚠️ Only numbers (0-9) are allowed! Letters and symbols have been blocked.');
      return;
    }

    if (val !== '' && parseInt(val, 10) > 10) {
      setScoreWarning('⚠️ Limit exceeded! The maximum score allowed is 10 points.');
      setStudentLiveScore('10');
      return;
    }

    setStudentLiveScore(val);
  };

  // Submit manual score overrides
  const updateStudentScoreManually = async () => {
    if (!selectedCollege || !selectedRegNo || !selectedEvent) {
      setScoreWarning('❌ Mandatory Selection Required: You must choose a College Name, Register Number, and Event Name before updating scores.');
      alert('⚠️ Submission Denied: College Name, Register Number, and Event Name are strictly required.');
      return;
    }

    // Double check credentials
    if (activeOperator.toLowerCase() !== 'durai') {
      try {
        const checkRes = await fetch(`/api/bca-quiz/students?regNo=${selectedRegNo}`);
        const checkData = await checkRes.json();
        const existingRecord = checkData.find(sub => sub.regNo === selectedRegNo);
        if (existingRecord && existingRecord.score !== null) {
          alert('❌ Permission Denied: You can only submit a student score exactly one time.');
          return;
        }
      } catch (e) {
        console.error('Verification failure:', e);
      }
    }

    if (studentLiveScore === '') {
      setScoreWarning('❌ Please enter a valid numerical score value (0-10).');
      alert('Please fill out a valid numerical score value.');
      return;
    }

    const numScore = parseInt(studentLiveScore, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
      setScoreWarning('❌ Error: Score must be a valid number between 0 and 10 points.');
      alert('❌ Error: Score must be a valid number between 0 and 10 points.');
      return;
    }

    setScoreWarning('');

    try {
      const res = await fetch('/api/bca-quiz/admin/update-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestor: activeOperator,
          regNo: selectedRegNo,
          score: numScore,
          eventName: selectedEvent,
          name: studentName,
          dept: studentDept,
          participantType: participantType || 'Solo',
          teamName: teamName || null
        })
      });
      const feedback = await res.json();
      alert(feedback.message);
      fetchAndRenderLiveScore(selectedRegNo, selectedEvent);
    } catch (err) {
      console.error(err);
      alert('Network failure tracking manual score adjustment.');
    }
  };

  const clearStudentFields = () => {
    setStudentName('');
    setStudentDept('');
    setAvailableEvents([]);
    setSelectedEvent('');
    setParticipantType('');
    setTeamName('');
    setShowTeamDiv(false);
    setStudentLiveScore('');
    setScoreWarning('');
    setScoreAuditor('');
    setIsScoreReadOnly(false);
    setShowUpdateBtn(true);
  };

  const clearFormFields = () => {
    setSelectedCollege('');
    setSelectedRegNo('');
    setFilteredRegNos([]);
    clearStudentFields();
  };

  // Navigate to student exam page
  const openEventPage = () => {
    if (!selectedEvent || !selectedRegNo) {
      alert('Please select an event and a student registration number.');
      return;
    }
    router.push(`/bca-quiz/quiz?event=${encodeURIComponent(selectedEvent)}&regNo=${encodeURIComponent(selectedRegNo)}`);
  };

  // Toggle Theme
  const toggleTheme = () => {
    setLightTheme(!lightTheme);
  };

  return (
    <div className={`bca_quiz_body ${lightTheme ? 'light-theme' : ''}`}>
      {!isAuthenticated ? (
        <div className="auth-overlay">
          <form className="auth-card" onSubmit={handlePortalLogin}>
            <h2>🔒 Portal Login</h2>
            <p>Please enter administrative credentials to access student event participation details.</p>
            
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

            <button type="submit" style={{ marginTop: '15px' }}>Verify & Enter Portal</button>
          </form>
        </div>
      ) : (
        <div className="container">
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {lightTheme ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>

          <button 
            onClick={() => router.push('/bca-quiz/admin')} 
            className="theme-toggle-btn" 
            style={{ background: '#6366f1', color: '#ffffff', border: 'none', top: '20px', right: '140px', width: 'auto', padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            ⚙️ Open Excel Sheets
          </button>

          <h1 className="bca_title">BCA Competition</h1>

          <div className="student-details">
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', marginBottom: '25px' }}>
              <h2 style={{ margin: 0, border: 'none', padding: 0 }}>
                Student Details 
                <span id="operatorTag" style={{ fontSize: '0.9rem', color: 'var(--accent-neon, #10b981)', display: 'block', marginTop: '5px', fontWeight: 'normal' }}>
                  Active Session Monitor: {activeOperator}
                </span>
              </h2>
              <button onClick={handleLogout} style={{ width: 'auto', padding: '6px 14px', background: 'var(--danger, #ef4444)', fontSize: '0.85rem', borderRadius: '6px' }}>🚪 Logout</button>
            </div>
            
            <div className="input-group">
              <label htmlFor="collegeName">College Name</label>
              <select id="collegeName" value={selectedCollege} onChange={handleCollegeChange}>
                <option value="">Select College</option>
                {colleges.map((col, idx) => (
                  <option key={idx} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="regNo">Register Number</label>
              <select id="regNo" value={selectedRegNo} onChange={handleRegNoChange}>
                <option value="">{selectedCollege ? 'Select Register Number' : 'Select College First'}</option>
                {filteredRegNos.map((reg, idx) => (
                  <option key={idx} value={reg}>{reg}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="studentName">Student Name</label>
              <input type="text" id="studentName" readOnly value={studentName} />
            </div>

            <div className="input-group">
              <label htmlFor="dept">Department</label>
              <input type="text" id="dept" readOnly value={studentDept} />
            </div>

            <div className="input-group">
              <label htmlFor="eventName">Event Name</label>
              <select id="eventName" value={selectedEvent} onChange={handleEventChange}>
                <option value="">Select Event</option>
                {availableEvents.map((evt, idx) => (
                  <option key={idx} value={evt.eventName}>{evt.eventName}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="participantType">Participation Type</label>
              <input type="text" id="participantType" readOnly value={participantType} />
            </div>

            {showTeamDiv && (
              <div className="input-group" id="teamDiv">
                <label htmlFor="teamName">Team Name</label>
                <input type="text" id="teamName" readOnly value={teamName} />
              </div>
            )}

            {/* MANAGED MANUAL SCORE ACTIONS OVERRIDES */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="studentLiveScore" style={{ color: 'var(--accent-neon, #10b981)' }}>Assign / Modify Score (Max 10)</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  id="studentLiveScore" 
                  placeholder="0-10" 
                  style={{ borderColor: 'var(--accent-neon, #10b981)', fontWeight: 'bold', color: 'var(--text-main)' }}
                  value={studentLiveScore}
                  readOnly={isScoreReadOnly}
                  onChange={(e) => handleScoreInput(e.target.value)}
                />
                {showUpdateBtn && (
                  <button 
                    onClick={updateStudentScoreManually} 
                    style={{ width: 'auto', padding: '0 20px', background: 'var(--accent-neon, #10b981)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
                  >
                    Update Score
                  </button>
                )}
              </div>
              
              {scoreWarning && (
                <div id="scoreWarningBox" style={{ color: 'var(--danger, #ef4444)', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '6px' }}>
                  {scoreWarning}
                </div>
              )}
              
              {scoreAuditor && (
                <small id="scoreAuditorLabel" style={{ color: 'var(--text-muted, #94a3b8)', display: 'block', marginTop: '5px', fontStyle: 'italic' }}>
                  {scoreAuditor}
                </small>
              )}
            </div>
          </div>

          <button onClick={openEventPage}>Open Event Dashboard</button>
          
          <button 
            onClick={() => router.push('/')} 
            style={{ marginTop: '10px', background: '#475569' }}
          >
            🏠 Back to Main Hub
          </button>
        </div>
      )}
    </div>
  );
}
