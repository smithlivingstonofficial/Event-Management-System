'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './admin.module.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [db, setDb] = useState({ categories: [], questions: [], teams: [], events: [] });
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [showQModal, setShowQModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Score Board states
  const [selectedScoreboardEvent, setSelectedScoreboardEvent] = useState(null);
  const [scoreboardSubTab, setScoreboardSubTab] = useState('overall'); // 'overall' | 'quiz' | 'ppt' | 'poster' | 'interview' | 'debugging'
  const [scoreboardSearch, setScoreboardSearch] = useState('');
  const [selectedScoreboardTeamId, setSelectedScoreboardTeamId] = useState('');
  const [showManageTeamsModal, setShowManageTeamsModal] = useState(false);
  const [manageTeamsList, setManageTeamsList] = useState([]); // List of team IDs
  const [manageTeamsEventKey, setManageTeamsEventKey] = useState(''); // 'pptTeams' | 'posterTeams' | ...

  // Edit item targets (null if creating new)
  const [editEvent, setEditEvent] = useState(null);
  const [editQ, setEditQ] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [editTeam, setEditTeam] = useState(null);

  // Event Form fields
  const [eventName, setEventName] = useState('');
  const [eventQIds, setEventQIds] = useState([]);
  const [eventTeams, setEventTeams] = useState([]); // Array of checked team objects (Quiz)
  
  // Track toggle states
  const [enableQuiz, setEnableQuiz] = useState(true);
  const [enablePpt, setEnablePpt] = useState(false);
  const [enablePoster, setEnablePoster] = useState(false);
  const [enableInterview, setEnableInterview] = useState(false);
  const [enableDebugging, setEnableDebugging] = useState(false);

  // Participating teams per track
  const [eventPptTeams, setEventPptTeams] = useState([]);
  const [eventPosterTeams, setEventPosterTeams] = useState([]);
  const [eventInterviewTeams, setEventInterviewTeams] = useState([]);
  const [eventDebuggingTeams, setEventDebuggingTeams] = useState([]);

  // Question Form fields
  const [qText, setQText] = useState('');
  const [qCatId, setQCatId] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState('');
  const [qLimit, setQLimit] = useState(20);
  const [qPoints, setQPoints] = useState(100);
  const [qImage, setQImage] = useState('');

  // Category Form fields
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('circle');
  const [catColor, setCatColor] = useState('#3b82f6');

  // Team Form fields
  const [teamName, setTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [teamColor, setTeamColor] = useState('#6366f1');
  const [selectedTeamEventId, setSelectedTeamEventId] = useState('');
  const [teamParticipatesQuiz, setTeamParticipatesQuiz] = useState(false);
  const [teamParticipatesPpt, setTeamParticipatesPpt] = useState(false);
  const [teamParticipatesPoster, setTeamParticipatesPoster] = useState(false);
  const [teamParticipatesInterview, setTeamParticipatesInterview] = useState(false);
  const [teamParticipatesDebugging, setTeamParticipatesDebugging] = useState(false);

  // Fetch db content and backup list
  const fetchData = async () => {
    setLoading(true);
    try {
      const dbRes = await fetch('/api/db');
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        setDb({
          categories: dbData.categories || [],
          questions: dbData.questions || [],
          teams: dbData.teams || [],
          events: dbData.events || []
        });
      }
      
      const backupRes = await fetch('/api/db/backup');
      if (backupRes.ok) {
        const backupData = await backupRes.json();
        setBackups(backupData.backups || []);
      }
    } catch (error) {
      console.error('Failed to load database:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

  // Sync selected team selection automatically on sub-tab switch
  useEffect(() => {
    if (selectedScoreboardEvent && ['ppt', 'poster', 'interview', 'debugging'].includes(scoreboardSubTab)) {
      const eventKey = {
        ppt: 'pptTeams',
        poster: 'posterTeams',
        interview: 'interviewTeams',
        debugging: 'debuggingTeams'
      }[scoreboardSubTab];
      
      const teamList = selectedScoreboardEvent[eventKey] || [];
      if (teamList.length > 0) {
        if (!selectedScoreboardTeamId || !teamList.some(t => t.id === selectedScoreboardTeamId)) {
          setSelectedScoreboardTeamId(teamList[0].id);
        }
      } else {
        setSelectedScoreboardTeamId('');
      }
    } else {
      setSelectedScoreboardTeamId('');
    }
  }, [scoreboardSubTab, selectedScoreboardEvent?.id]);

  // Handler for database exports
  const exportDatabase = () => {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    link.download = `quiz_database_backup_${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handler for database imports
  const handleImportDatabase = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!importedData.categories || !importedData.questions || !importedData.events) {
          alert('Invalid file format. Make sure it contains categories, questions, and events.');
          return;
        }

        if (confirm('Importing this file will overwrite all current questions, categories, and events. Proceed?')) {
          const res = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'db',
              action: 'restore',
              payload: importedData
            })
          });

          if (res.ok) {
            alert('Database imported successfully!');
            fetchData();
          } else {
            alert('Failed to import database.');
          }
        }
      } catch (error) {
        alert('Failed to parse file. Ensure it is a valid JSON database file.');
      }
    };
    reader.readAsText(file);
  };

  // Restore automated backup
  const handleRestoreBackup = async (filename) => {
    if (confirm(`Are you sure you want to restore the database to the state in ${filename}? Current unsaved data will be lost.`)) {
      try {
        const res = await fetch('/api/db/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        if (res.ok) {
          alert('Database restored successfully.');
          fetchData();
        } else {
          alert('Failed to restore backup.');
        }
      } catch (error) {
        alert('Network/Server error.');
      }
    }
  };

  // CRUD API helpers
  const saveEntity = async (type, action, payload) => {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, action, payload })
      });
      if (res.ok) {
        fetchData();
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // Category Submit
  const handleCatSubmit = async (e) => {
    e.preventDefault();
    const action = editCat ? 'update' : 'create';
    const payload = editCat 
      ? { id: editCat.id, name: catName, icon: catIcon, color: catColor } 
      : { name: catName, icon: catIcon, color: catColor };

    const success = await saveEntity('category', action, payload);
    if (success) {
      setShowCatModal(false);
      setCatName('');
      setCatIcon('circle');
      setCatColor('#3b82f6');
      setEditCat(null);
    }
  };

  // Question Submit
  const handleQSubmit = async (e) => {
    e.preventDefault();
    if (!qText.trim()) return;
    if (!qCorrect) {
      alert('Please select the correct answer option.');
      return;
    }

    const action = editQ ? 'update' : 'create';
    const payload = {
      id: editQ?.id,
      categoryId: qCatId,
      text: qText,
      options: qOptions,
      correctAnswer: qCorrect,
      timeLimit: Number(qLimit),
      points: Number(qPoints),
      image: qImage
    };

    const success = await saveEntity('question', action, payload);
    if (success) {
      setShowQModal(false);
      setEditQ(null);
      setQText('');
      setQCatId('');
      setQOptions(['', '', '', '']);
      setQCorrect('');
      setQLimit(20);
      setQPoints(100);
      setQImage('');
    }
  };

  // Team Submit
  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    const participatingTracks = [];
    if (teamParticipatesQuiz) participatingTracks.push('quiz');
    if (teamParticipatesPpt) participatingTracks.push('ppt');
    if (teamParticipatesPoster) participatingTracks.push('poster');
    if (teamParticipatesInterview) participatingTracks.push('interview');
    if (teamParticipatesDebugging) participatingTracks.push('debugging');

    const action = editTeam ? 'update' : 'create';
    const payload = {
      id: editTeam?.id,
      name: teamName,
      members: teamMembers,
      color: teamColor,
      eventId: selectedTeamEventId,
      participatingTracks
    };

    const success = await saveEntity('team', action, payload);
    if (success) {
      setShowTeamModal(false);
      setEditTeam(null);
      setTeamName('');
      setTeamMembers('');
      setTeamColor('#6366f1');
      setSelectedTeamEventId('');
      setTeamParticipatesQuiz(false);
      setTeamParticipatesPpt(false);
      setTeamParticipatesPoster(false);
      setTeamParticipatesInterview(false);
      setTeamParticipatesDebugging(false);
    }
  };

  // Event Submit
  const handleEventSubmit = async (e) => {
    e.preventDefault();
    if (!eventName.trim()) return;

    // Multi-track Validations
    if (!enableQuiz && !enablePpt && !enablePoster && !enableInterview && !enableDebugging) {
      alert('Please enable at least one track for this event.');
      return;
    }
    if (enableQuiz && eventTeams.length < 2) {
      alert('Please select at least 2 teams for the Live Quiz track.');
      return;
    }
    if (enablePpt && eventPptTeams.length < 2) {
      alert('Please select at least 2 teams for the PPT Presentation track.');
      return;
    }
    if (enablePoster && eventPosterTeams.length < 2) {
      alert('Please select at least 2 teams for the Poster Presentation track.');
      return;
    }
    if (enableInterview && eventInterviewTeams.length < 2) {
      alert('Please select at least 2 teams for the Stress Interview track.');
      return;
    }
    if (enableDebugging && eventDebuggingTeams.length < 2) {
      alert('Please select at least 2 teams for the Debugging Challenge track.');
      return;
    }

    const action = editEvent ? 'update' : 'create';
    const payload = {
      id: editEvent?.id,
      name: eventName,
      questionIds: enableQuiz ? eventQIds : [],
      teams: enableQuiz ? eventTeams : [],
      pptTeams: enablePpt ? eventPptTeams : [],
      posterTeams: enablePoster ? eventPosterTeams : [],
      interviewTeams: enableInterview ? eventInterviewTeams : [],
      debuggingTeams: enableDebugging ? eventDebuggingTeams : []
    };

    const success = await saveEntity('event', action, payload);
    if (success) {
      setShowEventModal(false);
      setEditEvent(null);
      setEventName('');
      setEventQIds([]);
      setEventTeams([]);
      setEventPptTeams([]);
      setEventPosterTeams([]);
      setEventInterviewTeams([]);
      setEventDebuggingTeams([]);
    }
  };

  // Modal Open Triggers
  const openEditEvent = (event) => {
    setEditEvent(event);
    setEventName(event.name);
    setEventQIds(event.questionIds || []);
    setEventTeams(event.teams || []);
    
    // Auto-detect enabled tracks
    setEnableQuiz(event.questionIds?.length > 0 || event.teams?.length > 0);
    setEnablePpt((event.pptTeams || []).length > 0);
    setEnablePoster((event.posterTeams || []).length > 0);
    setEnableInterview((event.interviewTeams || []).length > 0);
    setEnableDebugging((event.debuggingTeams || []).length > 0);

    // Set teams list
    setEventPptTeams(event.pptTeams || []);
    setEventPosterTeams(event.posterTeams || []);
    setEventInterviewTeams(event.interviewTeams || []);
    setEventDebuggingTeams(event.debuggingTeams || []);

    setShowEventModal(true);
  };

  const openEditQ = (q) => {
    setEditQ(q);
    setQText(q.text);
    setQCatId(q.categoryId || '');
    setQOptions(q.options || ['', '', '', '']);
    setQCorrect(q.correctAnswer || '');
    setQLimit(q.timeLimit || 20);
    setQPoints(q.points || 100);
    setQImage(q.image || '');
    setShowQModal(true);
  };

  const openEditCat = (cat) => {
    setEditCat(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon || 'circle');
    setCatColor(cat.color || '#3b82f6');
    setShowCatModal(true);
  };

  const openEditTeam = (team) => {
    setEditTeam(team);
    setTeamName(team.name);
    setTeamMembers(team.members ? team.members.join(', ') : '');
    setTeamColor(team.color || '#6366f1');

    // Detect event and tracks this team is currently in
    const matchedEvent = db.events.find(e => 
      (e.teams || []).some(t => t.id === team.id) ||
      (e.pptTeams || []).some(t => t.id === team.id) ||
      (e.posterTeams || []).some(t => t.id === team.id) ||
      (e.interviewTeams || []).some(t => t.id === team.id) ||
      (e.debuggingTeams || []).some(t => t.id === team.id)
    );

    if (matchedEvent) {
      setSelectedTeamEventId(matchedEvent.id);
      setTeamParticipatesQuiz((matchedEvent.teams || []).some(t => t.id === team.id));
      setTeamParticipatesPpt((matchedEvent.pptTeams || []).some(t => t.id === team.id));
      setTeamParticipatesPoster((matchedEvent.posterTeams || []).some(t => t.id === team.id));
      setTeamParticipatesInterview((matchedEvent.interviewTeams || []).some(t => t.id === team.id));
      setTeamParticipatesDebugging((matchedEvent.debuggingTeams || []).some(t => t.id === team.id));
    } else {
      setSelectedTeamEventId('');
      setTeamParticipatesQuiz(false);
      setTeamParticipatesPpt(false);
      setTeamParticipatesPoster(false);
      setTeamParticipatesInterview(false);
      setTeamParticipatesDebugging(false);
    }
    
    setShowTeamModal(true);
  };

  // Options Helper
  const setOptionIndex = (index, value) => {
    const updated = [...qOptions];
    updated[index] = value;
    setQOptions(updated);
  };

  // Helper to auto-save scoreboard states directly into the database on update
  const autoSaveEvent = async (updatedEvent) => {
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'event',
          action: 'update',
          payload: updatedEvent
        })
      });
    } catch (e) {
      console.error('Error auto-saving event data:', e);
    }
  };

  // Score Board Handlers
  const handleSliderChange = (teamId, eventKey, criterion, val) => {
    if (!selectedScoreboardEvent) return;
    const updatedEvent = { ...selectedScoreboardEvent };
    if (!updatedEvent[eventKey]) updatedEvent[eventKey] = [];
    
    const teamIndex = updatedEvent[eventKey].findIndex(t => t.id === teamId);
    if (teamIndex !== -1) {
      const team = { ...updatedEvent[eventKey][teamIndex] };
      if (!team.criteria) team.criteria = {};
      team.criteria = { ...team.criteria, [criterion]: Number(val) };
      
      // Calculate total score based on sum of criteria
      let total = 0;
      Object.keys(team.criteria).forEach(k => {
        total += team.criteria[k];
      });
      team.score = total;
      
      updatedEvent[eventKey][teamIndex] = team;
      setSelectedScoreboardEvent(updatedEvent);
      autoSaveEvent(updatedEvent);
    }
  };

  const handleQuizScoreChange = (teamId, val) => {
    if (!selectedScoreboardEvent) return;
    const updatedEvent = { ...selectedScoreboardEvent };
    if (!updatedEvent.teams) updatedEvent.teams = [];
    
    const teamIndex = updatedEvent.teams.findIndex(t => t.id === teamId);
    if (teamIndex !== -1) {
      updatedEvent.teams[teamIndex].score = Number(val) || 0;
      setSelectedScoreboardEvent(updatedEvent);
      autoSaveEvent(updatedEvent);
    }
  };

  const openManageTeamsModal = (eventKey) => {
    if (!selectedScoreboardEvent) return;
    setManageTeamsEventKey(eventKey);
    const currentTeams = selectedScoreboardEvent[eventKey] || [];
    setManageTeamsList(currentTeams.map(t => t.id));
    setShowManageTeamsModal(true);
  };

  const handleManageTeamsSave = () => {
    if (!selectedScoreboardEvent) return;
    const updatedEvent = { ...selectedScoreboardEvent };
    const eventKey = manageTeamsEventKey;
    
    const currentTeams = updatedEvent[eventKey] || [];
    
    const newTeamsList = manageTeamsList.map(id => {
      const existing = currentTeams.find(t => t.id === id);
      if (existing) return existing;
      
      const baseTeam = db.teams.find(t => t.id === id);
      
      let criteria = {};
      if (eventKey === 'pptTeams') {
        criteria = { content: 0, delivery: 0, design: 0, qa: 0, time: 0 };
      } else if (eventKey === 'posterTeams') {
        criteria = { creativity: 0, relevance: 0, aesthetics: 0, explanation: 0 };
      } else if (eventKey === 'interviewTeams') {
        criteria = { calmness: 0, mind: 0, communication: 0, arguments: 0 };
      } else if (eventKey === 'debuggingTeams') {
        criteria = { syntactic: 0, logical: 0, speed: 0, style: 0 };
      }
      
      return {
        id: id,
        name: baseTeam ? baseTeam.name : 'Unknown Team',
        color: baseTeam ? baseTeam.color : '#6366f1',
        members: baseTeam ? baseTeam.members : [],
        score: 0,
        criteria: criteria
      };
    });
    
    updatedEvent[eventKey] = newTeamsList;
    setSelectedScoreboardEvent(updatedEvent);
    setShowManageTeamsModal(false);
    autoSaveEvent(updatedEvent);
  };

  return (
    <div className={styles.appShell}>
      {/* Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          QuizPlatform
        </div>
        <nav className={styles.navMenu}>
          <button className={`${styles.navItem} ${activeTab === 'overview' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('overview')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            Dashboard
          </button>
          <button className={`${styles.navItem} ${activeTab === 'events' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('events')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Events
          </button>
          <button className={`${styles.navItem} ${activeTab === 'scoreboard' ? styles.navItemActive : ''}`} onClick={() => { setActiveTab('scoreboard'); setSelectedScoreboardEvent(null); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            Score Board
          </button>
          <button className={`${styles.navItem} ${activeTab === 'questions' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('questions')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Question Bank
          </button>
          <button className={`${styles.navItem} ${activeTab === 'categories' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('categories')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Categories
          </button>
          <button className={`${styles.navItem} ${activeTab === 'teams' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('teams')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Teams Pool
          </button>
          <button className={`${styles.navItem} ${activeTab === 'backups' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('backups')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
            Data Backups
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {/* Topbar Header */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.breadcrumb}>
              Admin / <span style={{ color: 'var(--primary)', textTransform: 'capitalize' }}>{activeTab}</span>
            </span>
          </div>
          <div className={styles.topbarRight}>
            <Link href="/" className={styles.hostBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
              Exit to Home
            </Link>
          </div>
        </header>

        <div className={styles.pagePadding}>
          {/* TAB 0: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="animate-fade">
              <div className={styles.cardHeader}>
                <h2>Overview Statistics</h2>
              </div>
              <div className={styles.overviewGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Total Events</span>
                    <div className={styles.statIcon} style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect></svg>
                    </div>
                  </div>
                  <div className={styles.statValue}>{db.events.length}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Total Questions</span>
                    <div className={styles.statIcon} style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle></svg>
                    </div>
                  </div>
                  <div className={styles.statValue}>{db.questions.length}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Total Categories</span>
                    <div className={styles.statIcon} style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                  </div>
                  <div className={styles.statValue}>{db.categories.length}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statHeader}>
                    <span>Registered Teams</span>
                    <div className={styles.statIcon} style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path></svg>
                    </div>
                  </div>
                  <div className={styles.statValue}>{db.teams.length}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: EVENTS */}
          {activeTab === 'events' && (
            <div className="animate-fade">
              <div className={styles.cardHeader}>
                <h2>Quiz Events</h2>
                <button
                  id="btn-create-event"
                  className={styles.btnPrimary}
                  onClick={() => {
                    setEditEvent(null);
                    setEventName('');
                    setEventQIds([]);
                    setEventTeams([]);
                    setEnableQuiz(true);
                    setEnablePpt(false);
                    setEnablePoster(false);
                    setEnableInterview(false);
                    setEnableDebugging(false);
                    setEventPptTeams([]);
                    setEventPosterTeams([]);
                    setEventInterviewTeams([]);
                    setEventDebuggingTeams([]);
                    setShowEventModal(true);
                  }}
                >
                  Create Event
                </button>
              </div>

              {db.events.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No events found. Create an event to register teams and questions.</p>
                </div>
              ) : (
                <div className={`${styles.tableContainer} glass`}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Event Name</th>
                        <th>Questions</th>
                        <th>Quiz Teams</th>
                        <th>Other Events</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.events.map(event => {
                        const otherParticipantsCount = (event.pptTeams?.length || 0) + 
                                                      (event.posterTeams?.length || 0) + 
                                                      (event.interviewTeams?.length || 0) + 
                                                      (event.debuggingTeams?.length || 0);
                        return (
                          <tr key={event.id} className={styles.tableRow}>
                            <td style={{ width: '120px' }}>
                              <span className={`${styles.statusIndicator} ${
                                event.status === 'active' ? styles.statusActive : 
                                event.status === 'finished' ? styles.statusFinished : styles.statusIdle
                              }`}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  display: 'inline-block',
                                  backgroundColor: event.status === 'active' ? 'var(--success)' : event.status === 'finished' ? 'var(--primary)' : 'var(--text-muted)',
                                  marginRight: '0.35rem'
                                }} />
                                {event.status}
                              </span>
                            </td>
                            <td style={{ fontWeight: '750', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                              {event.name}
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                {event.questionIds?.length || 0} Questions
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                                {event.teams?.length || 0} Teams
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                                {otherParticipantsCount} Entries
                              </span>
                            </td>
                            <td className={styles.actionCell}>
                              <Link
                                id={`btn-control-${event.id}`}
                                href={`/admin/control/${event.id}`}
                                className={`${styles.btnPrimary} ${styles.btnSmall}`}
                                style={{ textDecoration: 'none', padding: '0.35rem 0.65rem' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                Control
                              </Link>
                              <Link
                                id={`btn-view-${event.id}`}
                                href={`/event/${event.id}`}
                                target="_blank"
                                className={`${styles.btnSecondary} ${styles.btnSmall}`}
                                style={{ textDecoration: 'none', padding: '0.35rem 0.65rem' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                Screen
                              </Link>
                              <button
                                className={`${styles.btnSecondary} ${styles.btnSmall}`}
                                onClick={() => {
                                  setSelectedScoreboardEvent(event);
                                  setScoreboardSubTab('overall');
                                  setActiveTab('scoreboard');
                                }}
                                style={{ padding: '0.35rem 0.65rem' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                                Scores
                              </button>
                              <button
                                id={`btn-edit-event-${event.id}`}
                                className={`${styles.btnSecondary} ${styles.btnSmall}`}
                                onClick={() => openEditEvent(event)}
                                style={{ padding: '0.35rem' }}
                                title="Edit Event"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              </button>
                              <button
                                id={`btn-delete-event-${event.id}`}
                                className={`${styles.btnDanger} ${styles.btnSmall}`}
                                onClick={() => {
                                  if (confirm('Delete this event? All current scores and state will be erased.')) {
                                    saveEntity('event', 'delete', { id: event.id });
                                  }
                                }}
                                style={{ padding: '0.35rem' }}
                                title="Delete Event"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUESTIONS */}
          {activeTab === 'questions' && (
            <div className="animate-fade">
              <div className={styles.cardHeader}>
                <h2>Question Bank</h2>
                <button
                  id="btn-add-question"
                  className={styles.btnPrimary}
                  onClick={() => {
                    setEditQ(null);
                    setQText('');
                    setQCatId(db.categories[0]?.id || '');
                    setQOptions(['', '', '', '']);
                    setQCorrect('');
                    setQLimit(20);
                    setQPoints(100);
                    setShowQModal(true);
                  }}
                >
                  Add Question
                </button>
              </div>

              {db.questions.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No questions inside your database. Add a question to start building quizzes.</p>
                </div>
              ) : (
                <div className={`${styles.tableContainer} glass`}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Question</th>
                        <th>Category</th>
                        <th>Options</th>
                        <th>Correct Answer</th>
                        <th>Time Limit</th>
                        <th>Points</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.questions.map(q => {
                        const cat = db.categories.find(c => c.id === q.categoryId);
                        return (
                          <tr key={q.id} className={styles.tableRow}>
                            <td style={{ fontWeight: '600', maxWidth: '300px' }}>{q.text}</td>
                            <td>
                              <span className={styles.categoryTag}>
                                {cat ? cat.name : 'Uncategorized'}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {q.options.map((o, idx) => (
                                  <div key={idx}>
                                    <strong>{String.fromCharCode(65 + idx)}:</strong> {o}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                              Option {q.correctAnswer}
                            </td>
                            <td>{q.timeLimit}s</td>
                            <td>{q.points} pts</td>
                            <td className={styles.actionCell}>
                              <button
                                id={`btn-edit-q-${q.id}`}
                                className={`${styles.btnSecondary} ${styles.btnSmall}`}
                                onClick={() => openEditQ(q)}
                              >
                                Edit
                              </button>
                              <button
                                id={`btn-delete-q-${q.id}`}
                                className={`${styles.btnDanger} ${styles.btnSmall}`}
                                onClick={() => {
                                  if (confirm('Delete this question? It will be removed from all events.')) {
                                    saveEntity('question', 'delete', { id: q.id });
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="animate-fade">
              <div className={styles.cardHeader}>
                <h2>Categories</h2>
                <button
                  id="btn-add-cat"
                  className={styles.btnPrimary}
                  onClick={() => {
                    setEditCat(null);
                    setCatName('');
                    setShowCatModal(true);
                  }}
                >
                  Add Category
                </button>
              </div>

              {db.categories.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No categories found. Create a category to organize your questions.</p>
                </div>
              ) : (
                <div className={`${styles.tableContainer} glass`}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Category Name</th>
                        <th>Linked Questions</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.categories.map(cat => {
                        const count = db.questions.filter(q => q.categoryId === cat.id).length;
                        return (
                          <tr key={cat.id} className={styles.tableRow}>
                            <td style={{ fontWeight: '600' }}>{cat.name}</td>
                            <td>{count} Questions</td>
                            <td className={styles.actionCell}>
                              <button
                                id={`btn-edit-cat-${cat.id}`}
                                className={`${styles.btnSecondary} ${styles.btnSmall}`}
                                onClick={() => openEditCat(cat)}
                              >
                                Edit
                              </button>
                              <button
                                id={`btn-delete-cat-${cat.id}`}
                                className={`${styles.btnDanger} ${styles.btnSmall}`}
                                onClick={() => {
                                  if (confirm(`Delete category "${cat.name}"? Questions belonging to this category will be uncategorized.`)) {
                                    saveEntity('category', 'delete', { id: cat.id });
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TEAMS POOL */}
          {activeTab === 'teams' && (
            <div className="animate-fade">
              <div className={styles.cardHeader}>
                <h2>Registered Teams</h2>
                <button
                  id="btn-add-team"
                  className={styles.btnPrimary}
                  onClick={() => {
                    setEditTeam(null);
                    setTeamName('');
                    setTeamMembers('');
                    setTeamColor('#6366f1');
                    setSelectedTeamEventId('');
                    setTeamParticipatesQuiz(false);
                    setTeamParticipatesPpt(false);
                    setTeamParticipatesPoster(false);
                    setTeamParticipatesInterview(false);
                    setTeamParticipatesDebugging(false);
                    setShowTeamModal(true);
                  }}
                >
                  Register Team
                </button>
              </div>

              {db.teams.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No teams registered yet. Add teams to the global registry pool first.</p>
                </div>
              ) : (
                <div className={styles.teamsGrid}>
                  {db.teams.map(team => (
                    <div key={team.id} className={styles.teamCard}>
                      {/* Top colored accent line */}
                      <div 
                        className={styles.teamCardHeader} 
                        style={{ backgroundColor: team.color || '#6366f1' }}
                      />
                      
                      <div className={styles.teamCardBody}>
                        {/* Title and Color Circle */}
                        <div className={styles.teamCardTitle}>
                          <div 
                            className={styles.teamColorIndicator} 
                            style={{ backgroundColor: team.color || '#6366f1' }}
                          />
                          <h3 className={styles.teamNameText}>{team.name}</h3>
                        </div>

                        {/* Members Pool */}
                        <div className={styles.teamMembersList}>
                          <span className={styles.memberLabel}>Members</span>
                          {team.members && team.members.length > 0 ? (
                            team.members.map((member, idx) => (
                              <div key={idx} className={styles.memberBadge}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                                <span>{member}</span>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              No members registered
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className={styles.teamCardFooter}>
                        <button
                          id={`btn-edit-team-${team.id}`}
                          className={`${styles.btnSecondary} ${styles.btnSmall}`}
                          onClick={() => openEditTeam(team)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          id={`btn-delete-team-${team.id}`}
                          className={`${styles.btnDanger} ${styles.btnSmall}`}
                          onClick={() => {
                            if (confirm(`Delete team "${team.name}"? It will also be removed from any active events.`)) {
                              saveEntity('team', 'delete', { id: team.id });
                            }
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BACKUPS */}
          {activeTab === 'backups' && (
            <div className={`${styles.adminGrid} animate-fade`}>
              <div className={`${styles.adminCard} glass`}>
                <h3>Backup Administration</h3>
                <p>Export the current database file to save your setup locally, or upload a JSON backup to restore a previously configured database.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <button
                    id="btn-export-db"
                    className={styles.btnPrimary}
                    onClick={exportDatabase}
                    style={{ width: '100%' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export Database (.json)
                  </button>

                  <div className={styles.fileInputWrapper}>
                    <input
                      id="input-import-db"
                      type="file"
                      accept=".json"
                      onChange={handleImportDatabase}
                      className={styles.fileInput}
                    />
                    <div className={styles.fileInputLabel}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span>Upload JSON Database Backup</span>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Click or Drag file here</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${styles.adminCard} glass`}>
                <h3>Automated Backups</h3>
                <p>The system automatically backs up data files in the local directory whenever you make changes. Select any backup below to restore the database structure.</p>
                {backups.length === 0 ? (
                  <div className={styles.emptyState} style={{ padding: '1.5rem' }}>
                    No automated backups stored yet. Modifying categories, questions, or events will trigger auto-backups.
                  </div>
                ) : (
                  <div className={styles.backupList}>
                    {backups.map(name => {
                      const match = name.match(/db_backup_(\d{14})\.json/);
                      let formattedDate = 'Unknown Date';
                      if (match) {
                        const ts = match[1];
                        const year = ts.slice(0, 4);
                        const month = ts.slice(4, 6);
                        const day = ts.slice(6, 8);
                        const hour = ts.slice(8, 10);
                        const min = ts.slice(10, 12);
                        const sec = ts.slice(12, 14);
                        formattedDate = `${year}-${month}-${day} ${hour}:${min}:${sec}`;
                      }
                      return (
                        <div key={name} className={styles.backupItem}>
                          <div>
                            <div className={styles.backupName}>{name}</div>
                            <div className={styles.backupDate}>{formattedDate}</div>
                          </div>
                          <button
                            id={`btn-restore-backup-${name}`}
                            className={`${styles.btnSecondary} ${styles.btnSmall}`}
                            onClick={() => handleRestoreBackup(name)}
                          >
                            Restore
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SCORE BOARD */}
          {activeTab === 'scoreboard' && (
            <div className="animate-fade">
              {!selectedScoreboardEvent ? (
                // View A: List of Events
                <div>
                  <div className={styles.cardHeader}>
                    <h2>Event Score Boards</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', width: '100%', margin: 0 }}>
                      Select a tech fest/event to view standings, manage participants, and grade sub-competitions.
                    </p>
                  </div>

                  {db.events.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>No events found. Go to the "Events" tab to create one.</p>
                    </div>
                  ) : (
                    <div className={styles.eventsGrid}>
                      {db.events.map(event => (
                        <article key={event.id} className={`${styles.eventCard} glass`}>
                          <div className={styles.eventInfo}>
                            <h3>{event.name}</h3>
                            <div className={styles.eventMeta}>
                              <span className={`${styles.statusIndicator} ${
                                event.status === 'active' ? styles.statusActive : 
                                event.status === 'finished' ? styles.statusFinished : styles.statusIdle
                              }`}>
                                {event.status}
                              </span>
                              <span>&bull;</span>
                              <span>{event.teams?.length || 0} Quiz Teams</span>
                              <span>&bull;</span>
                              <span>{((event.pptTeams?.length || 0) + (event.posterTeams?.length || 0) + (event.interviewTeams?.length || 0) + (event.debuggingTeams?.length || 0))} Other Participants</span>
                            </div>
                          </div>
                          <div className={styles.eventActions}>
                            <button
                              id={`btn-open-scoreboard-${event.id}`}
                              className={styles.btnPrimary}
                              onClick={() => {
                                setSelectedScoreboardEvent(event);
                                setScoreboardSubTab('overall');
                              }}
                            >
                              Manage Scoreboard
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // View B: Scoreboard Dashboard for Selected Event
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button 
                        className={styles.btnSecondary} 
                        onClick={() => setSelectedScoreboardEvent(null)}
                        style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 'bold' }}
                      >
                        &larr; Back
                      </button>
                      <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>{selectedScoreboardEvent.name}</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={styles.btnPrimary}
                        onClick={async () => {
                          const index = db.events.findIndex(e => e.id === selectedScoreboardEvent.id);
                          if (index !== -1) {
                            const success = await saveEntity('event', 'update', selectedScoreboardEvent);
                            if (success) {
                              alert('Scoreboard saved successfully!');
                              fetchData();
                            } else {
                              alert('Failed to save scoreboard data.');
                            }
                          }
                        }}
                      >
                        Save All Changes
                      </button>
                    </div>
                  </div>

                  {/* Sub-tabs menu */}
                  <div style={{ display: 'flex', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    {[
                      { id: 'overall', name: '🏆 Standings' },
                      { id: 'quiz', name: '⚡ Live Quiz' },
                      { id: 'ppt', name: '📊 PPT' },
                      { id: 'poster', name: '🎨 Poster' },
                      { id: 'interview', name: '🎤 Interview' },
                      { id: 'debugging', name: '🐛 Debug' }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        className={`${styles.navItem} ${scoreboardSubTab === sub.id ? styles.navItemActive : ''}`}
                        style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', whiteSpace: 'nowrap', borderRadius: '6px' }}
                        onClick={() => setScoreboardSubTab(sub.id)}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>

                  {/* Sub-tab 1: Overall Standings */}
                  {scoreboardSubTab === 'overall' && (() => {
                    const quizTeams = selectedScoreboardEvent.teams || [];
                    const pptTeams = selectedScoreboardEvent.pptTeams || [];
                    const posterTeams = selectedScoreboardEvent.posterTeams || [];
                    const interviewTeams = selectedScoreboardEvent.interviewTeams || [];
                    const debuggingTeams = selectedScoreboardEvent.debuggingTeams || [];

                    const allUniqueIds = Array.from(new Set([
                      ...quizTeams.map(t => t.id),
                      ...pptTeams.map(t => t.id),
                      ...posterTeams.map(t => t.id),
                      ...interviewTeams.map(t => t.id),
                      ...debuggingTeams.map(t => t.id)
                    ]));

                    const standings = allUniqueIds.map(id => {
                      const baseTeam = db.teams.find(t => t.id === id) ||
                                       quizTeams.find(t => t.id === id) ||
                                       pptTeams.find(t => t.id === id) ||
                                       posterTeams.find(t => t.id === id) ||
                                       interviewTeams.find(t => t.id === id) ||
                                       debuggingTeams.find(t => t.id === id) ||
                                       { name: 'Unknown Team', color: '#cbd5e1', members: [] };

                      const qScore = quizTeams.find(t => t.id === id)?.score || 0;
                      const pScore = pptTeams.find(t => t.id === id)?.score || 0;
                      const postScore = posterTeams.find(t => t.id === id)?.score || 0;
                      const iScore = interviewTeams.find(t => t.id === id)?.score || 0;
                      const dScore = debuggingTeams.find(t => t.id === id)?.score || 0;
                      const grandTotal = qScore + pScore + postScore + iScore + dScore;

                      return {
                        id,
                        name: baseTeam.name,
                        color: baseTeam.color,
                        members: baseTeam.members || [],
                        quiz: qScore,
                        ppt: pScore,
                        poster: postScore,
                        interview: iScore,
                        debugging: dScore,
                        grandTotal
                      };
                    }).sort((a, b) => b.grandTotal - a.grandTotal);

                    // Calculations for Summary Cards
                    const totalTeams = standings.length;
                    const leaderTeamName = standings[0] ? standings[0].name : 'None';
                    const leaderTeamColor = standings[0] ? standings[0].color : 'var(--primary)';
                    const leaderScore = standings[0] ? standings[0].grandTotal : 0;
                    
                    const avgScore = totalTeams > 0 
                      ? (standings.reduce((sum, t) => sum + t.grandTotal, 0) / totalTeams).toFixed(1) 
                      : 0;

                    const avgQuiz = totalTeams > 0 ? standings.reduce((sum, t) => sum + t.quiz, 0) / totalTeams : 0;
                    const avgPpt = totalTeams > 0 ? standings.reduce((sum, t) => sum + t.ppt, 0) / totalTeams : 0;
                    const avgPoster = totalTeams > 0 ? standings.reduce((sum, t) => sum + t.poster, 0) / totalTeams : 0;
                    const avgInterview = totalTeams > 0 ? standings.reduce((sum, t) => sum + t.interview, 0) / totalTeams : 0;
                    const avgDebug = totalTeams > 0 ? standings.reduce((sum, t) => sum + t.debugging, 0) / totalTeams : 0;
                    
                    const trackAverages = [
                      { name: 'Live Quiz', score: avgQuiz },
                      { name: 'PPT', score: avgPpt },
                      { name: 'Poster', score: avgPoster },
                      { name: 'Interview', score: avgInterview },
                      { name: 'Debugging', score: avgDebug }
                    ].sort((a, b) => b.score - a.score);

                    const topTrackStr = trackAverages[0]?.score > 0 
                      ? `${trackAverages[0].name} (${trackAverages[0].score.toFixed(1)} avg)` 
                      : 'None';

                    // Filtered Standings
                    const filteredStandings = standings.filter(t => 
                      t.name.toLowerCase().includes(scoreboardSearch.toLowerCase()) ||
                      t.members.some(m => m.toLowerCase().includes(scoreboardSearch.toLowerCase()))
                    );

                    // Export Standings CSV helper
                    const exportCSV = () => {
                      let csv = "Rank,Team Name,Members,Quiz Score,PPT Score,Poster Score,Interview Score,Debugging Score,Grand Total\n";
                      standings.forEach((t, i) => {
                        csv += `${i + 1},"${t.name.replace(/"/g, '""')}",` +
                               `"${t.members.join(', ').replace(/"/g, '""')}",` +
                               `${t.quiz},${t.ppt},${t.poster},${t.interview},${t.debugging},${t.grandTotal}\n`;
                      });
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(blob);
                      link.setAttribute("download", `${selectedScoreboardEvent.name.replace(/\s+/g, '_')}_standings.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    };

                    return (
                      <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* 🥇 SUMMARY METRICS CARDS */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                          <div className="glass" style={{ padding: '1rem 1.25rem', borderLeft: `4px solid ${leaderTeamColor}`, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Current Leader</span>
                            <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{leaderTeamName}</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: leaderTeamColor, fontFamily: 'var(--font-mono)' }}>{leaderScore} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>pts</span></span>
                          </div>

                          <div className="glass" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Teams Competing</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', marginTop: 'auto' }}>{totalTeams} Teams</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registered in global registry</span>
                          </div>

                          <div className="glass" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Average Score</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', marginTop: 'auto', fontFamily: 'var(--font-mono)' }}>{avgScore} pts</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sum of all score sheets</span>
                          </div>

                          <div className="glass" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #a855f7', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Top Performing Track</span>
                            <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', marginTop: 'auto' }}>{topTrackStr}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Highest average score</span>
                          </div>
                        </div>

                        {/* 🏆 WINNER'S PODIUM STAGE */}
                        {standings.length >= 2 && (
                          <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <h4 style={{ margin: 0, width: '100%', fontSize: '0.95rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>🥇 Winner's Podium Stage</span>
                            </h4>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1.5rem', height: '200px', width: '100%', maxWidth: '500px', margin: '0.5rem 0' }}>
                              {/* 2nd Place Column */}
                              {standings[1] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>2nd Place</span>
                                  <div style={{
                                    width: '100%',
                                    height: '90px',
                                    background: 'linear-gradient(to top, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.02) 100%)',
                                    border: `2px solid ${standings[1].color || '#94a3b8'}`,
                                    borderRadius: '12px 12px 0 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    textAlign: 'center',
                                    boxShadow: `0 4px 15px ${(standings[1].color || '#94a3b8')}11`
                                  }}>
                                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>{standings[1].name}</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>{standings[1].grandTotal}</span>
                                  </div>
                                </div>
                              )}

                              {/* 1st Place Column */}
                              {standings[0] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '140px' }}>
                                  <span style={{ fontSize: '1.5rem', marginBottom: '-0.2rem' }}>👑</span>
                                  <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#fbbf24' }}>Winner</span>
                                  <div style={{
                                    width: '100%',
                                    height: '120px',
                                    background: 'linear-gradient(to top, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.03) 100%)',
                                    border: `2.5px solid ${standings[0].color || '#fbbf24'}`,
                                    borderRadius: '16px 16px 0 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    textAlign: 'center',
                                    boxShadow: `0 6px 20px ${(standings[0].color || '#fbbf24')}22`
                                  }}>
                                    <span style={{ fontWeight: '900', fontSize: '0.95rem', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>{standings[0].name}</span>
                                    <span style={{ fontSize: '1.3rem', fontWeight: '950', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>{standings[0].grandTotal}</span>
                                  </div>
                                </div>
                              )}

                              {/* 3rd Place Column */}
                              {standings[2] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '110px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>3rd Place</span>
                                  <div style={{
                                    width: '100%',
                                    height: '70px',
                                    background: 'linear-gradient(to top, rgba(180, 83, 9, 0.08) 0%, rgba(180, 83, 9, 0.01) 100%)',
                                    border: `2px solid ${standings[2].color || '#b45309'}`,
                                    borderRadius: '10px 10px 0 0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    textAlign: 'center',
                                    boxShadow: `0 4px 15px ${(standings[2].color || '#b45309')}08`
                                  }}>
                                    <span style={{ fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>{standings[2].name}</span>
                                    <span style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>{standings[2].grandTotal}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* SEARCH & EXPORT ACTION ROW */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            placeholder="🔍 Search team name or members..."
                            value={scoreboardSearch}
                            onChange={(e) => setScoreboardSearch(e.target.value)}
                            style={{
                              padding: '0.6rem 1rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)',
                              color: 'var(--text-main)',
                              width: '100%',
                              maxWidth: '300px',
                              fontSize: '0.85rem'
                            }}
                          />
                          <button
                            onClick={exportCSV}
                            className={styles.btnSecondary}
                            style={{ width: 'auto', padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export Standings (.csv)
                          </button>
                        </div>

                        {/* LEADERBOARD TABLE */}
                        <div className={`${styles.tableContainer} glass`}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>Rank</th>
                                <th>Team Name</th>
                                <th>Quiz</th>
                                <th>PPT</th>
                                <th>Poster</th>
                                <th>Interview</th>
                                <th>Debugging</th>
                                <th style={{ fontWeight: '800', color: 'var(--primary)' }}>Grand Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStandings.map((t, idx) => {
                                const originalRank = standings.findIndex(item => item.id === t.id) + 1;
                                return (
                                  <tr key={t.id} className={styles.tableRow}>
                                    <td style={{ fontWeight: '800', width: '70px' }}>
                                      {originalRank === 1 ? '🥇 1st' : originalRank === 2 ? '🥈 2nd' : originalRank === 3 ? '🥉 3rd' : `${originalRank}th`}
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: t.color || 'var(--primary)', flexShrink: 0 }} />
                                        <div>
                                          <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{t.name}</div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.members.join(', ')}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td>{t.quiz} pts</td>
                                    <td>{t.ppt} pts</td>
                                    <td>{t.poster} pts</td>
                                    <td>{t.interview} pts</td>
                                    <td>{t.debugging} pts</td>
                                    <td style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>{t.grandTotal} pts</td>
                                  </tr>
                                );
                              })}
                              {filteredStandings.length === 0 && (
                                <tr>
                                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    {scoreboardSearch ? 'No matching teams found.' : 'No teams registered yet.'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sub-tab 2: Quiz Standings */}
                  {scoreboardSubTab === 'quiz' && (
                    <div className="animate-fade">
                      <div className={styles.cardHeader} style={{ marginBottom: '1rem' }}>
                        <h3>⚡ Live Quiz Scores</h3>
                        <Link href={`/admin/control/${selectedScoreboardEvent.id}`} className={styles.btnSecondary} style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
                          Open Live Quiz Control &rarr;
                        </Link>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                        Quiz scores are updated live from the active quiz screen. You can adjust scores manually below if there are disputes, or launch the presenter interface.
                      </p>

                      <div className={`${styles.tableContainer} glass`}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Color</th>
                              <th>Team Name</th>
                              <th>Members</th>
                              <th>Quiz Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedScoreboardEvent.teams || []).map((t, idx) => (
                              <tr key={t.id} className={styles.tableRow}>
                                <td style={{ width: '60px' }}>
                                  <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: t.color || 'var(--primary)' }} />
                                </td>
                                <td style={{ fontWeight: 'bold' }}>{t.name}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{(t.members || []).join(', ')}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                      type="number"
                                      value={t.score || 0}
                                      onChange={(e) => handleQuizScoreChange(t.id, e.target.value)}
                                      style={{ width: '80px', padding: '0.25rem 0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}
                                    />
                                    <button 
                                      className={`${styles.btnSecondary} ${styles.btnSmall}`} 
                                      onClick={() => handleQuizScoreChange(t.id, (t.score || 0) + 10)}
                                      style={{ padding: '0.2rem 0.4rem' }}
                                    >
                                      +10
                                    </button>
                                    <button 
                                      className={`${styles.btnSecondary} ${styles.btnSmall}`}
                                      onClick={() => handleQuizScoreChange(t.id, Math.max(0, (t.score || 0) - 10))}
                                      style={{ padding: '0.2rem 0.4rem' }}
                                    >
                                      -10
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {(selectedScoreboardEvent.teams || []).length === 0 && (
                              <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                  No teams added to the Quiz. Edit the event to select Quiz teams.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sub-tabs 3-6: PPT, Poster, Stress Interview, Debugging */}
                  {['ppt', 'poster', 'interview', 'debugging'].includes(scoreboardSubTab) && (() => {
                    const subEventData = {
                      ppt: {
                        key: 'pptTeams',
                        title: 'PPT Presentation',
                        desc: 'Evaluate the PowerPoint Presentation based on topic content, speaker slide deck flow, visual designs, Q&A defense and strict time limits.',
                        criteria: [
                          { id: 'content', name: 'Slide Content', max: 20 },
                          { id: 'delivery', name: 'Delivery & Voice', max: 20 },
                          { id: 'design', name: 'Visual Design', max: 20 },
                          { id: 'qa', name: 'Q&A Defense', max: 20 },
                          { id: 'time', name: 'Time Management', max: 20 }
                        ]
                      },
                      poster: {
                        key: 'posterTeams',
                        title: 'Poster Presentation',
                        desc: 'Evaluate posters based on visual layouts, topic concept creativity, topical relevance, and student explanations.',
                        criteria: [
                          { id: 'creativity', name: 'Creativity & Originality', max: 25 },
                          { id: 'relevance', name: 'Topic Relevance', max: 25 },
                          { id: 'aesthetics', name: 'Visual Appeal & Aesthetics', max: 25 },
                          { id: 'explanation', name: 'Explanation & Q&A', max: 25 }
                        ]
                      },
                      interview: {
                        key: 'interviewTeams',
                        title: 'Stress Interview',
                        desc: 'Score individual candidates under intense stress testing: evaluate confidence, response speed, clarity, and rebuttal arguments.',
                        criteria: [
                          { id: 'calmness', name: 'Calmness under Stress', max: 30 },
                          { id: 'mind', name: 'Presence of Mind', max: 30 },
                          { id: 'communication', name: 'Communication Style', max: 20 },
                          { id: 'arguments', name: 'Counter-Arguments Quality', max: 20 }
                        ]
                      },
                      debugging: {
                        key: 'debuggingTeams',
                        title: 'Debugging Challenge',
                        desc: 'Grade code debugging rounds: code troubleshooting, resolving bugs, algorithm complexity optimization, and completion time.',
                        criteria: [
                          { id: 'syntactic', name: 'Syntactic Fixes', max: 30 },
                          { id: 'logical', name: 'Logical Debugging', max: 40 },
                          { id: 'speed', name: 'Completion Speed', max: 20 },
                          { id: 'style', name: 'Code Quality & Style', max: 10 }
                        ]
                      }
                    }[scoreboardSubTab];

                    const teamList = selectedScoreboardEvent[subEventData.key] || [];

                    return (
                      <div className="animate-fade">
                        <div className={styles.cardHeader} style={{ marginBottom: '0.5rem' }}>
                          <h3>{subEventData.title} Score Sheet</h3>
                          <button
                            className={`${styles.btnSecondary} ${styles.btnSmall}`}
                            onClick={() => openManageTeamsModal(subEventData.key)}
                          >
                            Manage participating teams
                          </button>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                          {subEventData.desc} Adjust range sliders for each team below. Click "Save All Changes" at the top to save weights.
                        </p>

                        {teamList.length === 0 ? (
                          <div className={styles.emptyState} style={{ padding: '3rem' }}>
                            <p>No teams assigned to this competition yet.</p>
                            <button
                              className={styles.btnPrimary}
                              onClick={() => openManageTeamsModal(subEventData.key)}
                              style={{ marginTop: '1rem' }}
                            >
                              Assign Teams Now
                            </button>
                          </div>
                        ) : (
                          <div className={styles.scoreboardSplit}>
                            
                            {/* LEFT SIDEBAR: List of teams participating */}
                            <div className="glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', height: 'fit-content' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Participating Teams</h4>
                              {teamList.map(team => {
                                const isSelected = selectedScoreboardTeamId === team.id;
                                return (
                                  <button
                                    key={team.id}
                                    onClick={() => setSelectedScoreboardTeamId(team.id)}
                                    style={{
                                      width: '100%',
                                      padding: '1rem',
                                      borderRadius: '12px',
                                      border: isSelected 
                                        ? `2px solid ${team.color || 'var(--primary)'}` 
                                        : '1.5px solid var(--border-color)',
                                      background: isSelected 
                                        ? `linear-gradient(to right, ${(team.color || '#6366f1')}11, transparent)` 
                                        : 'rgba(255,255,255,0.01)',
                                      color: 'var(--text-main)',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.35rem',
                                      boxShadow: isSelected 
                                        ? `0 6px 16px ${(team.color || '#6366f1')}1a` 
                                        : 'none',
                                      transition: 'all 0.2s ease-in-out'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                      <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>{team.name}</span>
                                      <span style={{ fontWeight: '900', color: team.color || 'var(--primary)', fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>{team.score || 0} pts</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      {team.members ? team.members.join(', ') : 'No members'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* RIGHT CONTENT: Detailed control panel for the selected team */}
                            {(() => {
                              const activeTeam = teamList.find(t => t.id === selectedScoreboardTeamId) || teamList[0];
                              if (!activeTeam) return null;
                              
                              return (
                                <div
                                  className="glass"
                                  style={{
                                    padding: '2rem',
                                    borderRadius: '16px',
                                    border: '1px solid var(--border-color)',
                                    borderLeft: `6px solid ${activeTeam.color || 'var(--primary)'}`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1.5rem',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.03)'
                                  }}
                                >
                                  {/* Team Header Summary */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                                    <div>
                                      <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>{activeTeam.name}</h3>
                                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Members: {activeTeam.members ? activeTeam.members.join(', ') : 'No members listed'}
                                      </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: '2rem', fontWeight: '950', color: activeTeam.color || 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                                        {activeTeam.score || 0}
                                      </span>
                                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Total points</span>
                                    </div>
                                  </div>

                                  {/* Auto-save Status Indicator */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.05)', padding: '0.4rem 0.75rem', borderRadius: '20px', width: 'fit-content', fontWeight: '800', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                    <span>Real-Time Auto-Save Active</span>
                                  </div>

                                  {/* Sliders Grid */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginTop: '0.5rem' }}>
                                    {subEventData.criteria.map(crit => {
                                      const val = activeTeam.criteria?.[crit.id] || 0;
                                      return (
                                        <div key={crit.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            <span style={{ color: 'var(--text-main)' }}>{crit.name} (Max {crit.max})</span>
                                            <span style={{ color: activeTeam.color || 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{val} / {crit.max}</span>
                                          </div>
                                          
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            {/* Deduct Button */}
                                            <button
                                              onClick={() => handleSliderChange(activeTeam.id, subEventData.key, crit.id, Math.max(0, val - 1))}
                                              style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '6px',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-main)',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                width: '28px',
                                                height: '28px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                              }}
                                            >
                                              -
                                            </button>
                                            
                                            {/* Custom styled range slider */}
                                            <input
                                              type="range"
                                              min="0"
                                              max={crit.max}
                                              value={val}
                                              onChange={(e) => handleSliderChange(activeTeam.id, subEventData.key, crit.id, e.target.value)}
                                              style={{
                                                flex: 1,
                                                height: '6px',
                                                borderRadius: '3px',
                                                outline: 'none',
                                                accentColor: activeTeam.color || 'var(--primary)',
                                                background: 'var(--bg-secondary)',
                                                cursor: 'pointer'
                                              }}
                                            />
                                            
                                            {/* Add Button */}
                                            <button
                                              onClick={() => handleSliderChange(activeTeam.id, subEventData.key, crit.id, Math.min(crit.max, val + 1))}
                                              style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '6px',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-main)',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                width: '28px',
                                                height: '28px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                              }}
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      {showEventModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
          <form onSubmit={handleEventSubmit} className={`${styles.modalContent} glass`} style={{ maxWidth: '800px' }}>
            <h2 id="event-modal-title" style={{ marginBottom: '1.5rem' }}>{editEvent ? 'Edit Event Setup' : 'Create New Event'}</h2>
            
            <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="event-name">Event Name *</label>
              <input
                id="event-name"
                type="text"
                required
                placeholder="e.g. TechFest Finals 2026"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className={styles.input}
              />
            </div>

            {/* Select Active Event Tracks */}
            <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'block', marginBottom: '0.75rem' }}>Select Event Tracks</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: enableQuiz ? 'rgba(99,102,241,0.06)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: enableQuiz ? 'var(--primary)' : 'var(--border-color)', borderWidth: enableQuiz ? '1.5px' : '1px' }}>
                  <input type="checkbox" checked={enableQuiz} onChange={(e) => setEnableQuiz(e.target.checked)} style={{ cursor: 'pointer' }} />
                  <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>⚡ Live Quiz</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: enablePpt ? 'rgba(99,102,241,0.06)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: enablePpt ? 'var(--primary)' : 'var(--border-color)', borderWidth: enablePpt ? '1.5px' : '1px' }}>
                  <input type="checkbox" checked={enablePpt} onChange={(e) => setEnablePpt(e.target.checked)} style={{ cursor: 'pointer' }} />
                  <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>📊 PPT</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: enablePoster ? 'rgba(99,102,241,0.06)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: enablePoster ? 'var(--primary)' : 'var(--border-color)', borderWidth: enablePoster ? '1.5px' : '1px' }}>
                  <input type="checkbox" checked={enablePoster} onChange={(e) => setEnablePoster(e.target.checked)} style={{ cursor: 'pointer' }} />
                  <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>🎨 Poster</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: enableInterview ? 'rgba(99,102,241,0.06)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: enableInterview ? 'var(--primary)' : 'var(--border-color)', borderWidth: enableInterview ? '1.5px' : '1px' }}>
                  <input type="checkbox" checked={enableInterview} onChange={(e) => setEnableInterview(e.target.checked)} style={{ cursor: 'pointer' }} />
                  <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>🤝 Interview</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '10px', background: enableDebugging ? 'rgba(99,102,241,0.06)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: enableDebugging ? 'var(--primary)' : 'var(--border-color)', borderWidth: enableDebugging ? '1.5px' : '1px' }}>
                  <input type="checkbox" checked={enableDebugging} onChange={(e) => setEnableDebugging(e.target.checked)} style={{ cursor: 'pointer' }} />
                  <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>💻 Debugging</span>
                </label>

              </div>
            </div>

            {/* Track Configuration Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
              
              {enableQuiz && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.02)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span>⚡ Live Quiz Configuration</span>
                  </h4>
                  <div className={styles.formGrid}>
                    {/* Available Teams Multi-Select */}
                    <div className={styles.formGroup}>
                      <label>Select Quiz Teams (Min 2)</label>
                      <div className={styles.checkList}>
                        {db.teams.map(team => {
                          const isChecked = eventTeams.some(t => t.id === team.id);
                          return (
                            <label key={team.id} className={styles.checkItem}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEventTeams([...eventTeams, { ...team, score: 0 }]);
                                  } else {
                                    setEventTeams(eventTeams.filter(t => t.id !== team.id));
                                  }
                                }}
                              />
                              <span>{team.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Available Questions Multi-Select */}
                    <div className={styles.formGroup}>
                      <label>Select Questions to Include</label>
                      <div className={styles.checkList}>
                        {db.questions.map(q => (
                          <label key={q.id} className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={eventQIds.includes(q.id)}
                              onChange={(e) => {
                                  if (e.target.checked) {
                                    setEventQIds([...eventQIds, q.id]);
                                  } else {
                                    setEventQIds(eventQIds.filter(id => id !== q.id));
                                  }
                              }}
                            />
                            <span>{q.text.substring(0, 45)}{q.text.length > 45 ? '...' : ''}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {enablePpt && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.02)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span>📊 PPT Presentation Configuration</span>
                  </h4>
                  <div className={styles.formGroup}>
                    <label>Select PPT Participating Teams (Min 2)</label>
                    <div className={styles.checkList} style={{ maxHeight: '140px' }}>
                      {db.teams.map(team => {
                        const isChecked = eventPptTeams.some(t => t.id === team.id);
                        return (
                          <label key={team.id} className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEventPptTeams([...eventPptTeams, { 
                                    id: team.id, 
                                    name: team.name, 
                                    color: team.color, 
                                    members: team.members || [], 
                                    score: 0, 
                                    criteria: { content: 0, delivery: 0, design: 0, qa: 0, time: 0 } 
                                  }]);
                                } else {
                                  setEventPptTeams(eventPptTeams.filter(t => t.id !== team.id));
                                }
                              }}
                            />
                            <span>{team.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {enablePoster && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.02)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span>🎨 Poster Presentation Configuration</span>
                  </h4>
                  <div className={styles.formGroup}>
                    <label>Select Poster Participating Teams (Min 2)</label>
                    <div className={styles.checkList} style={{ maxHeight: '140px' }}>
                      {db.teams.map(team => {
                        const isChecked = eventPosterTeams.some(t => t.id === team.id);
                        return (
                          <label key={team.id} className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEventPosterTeams([...eventPosterTeams, { 
                                    id: team.id, 
                                    name: team.name, 
                                    color: team.color, 
                                    members: team.members || [], 
                                    score: 0, 
                                    criteria: { creativity: 0, relevance: 0, aesthetics: 0, explanation: 0 } 
                                  }]);
                                } else {
                                  setEventPosterTeams(eventPosterTeams.filter(t => t.id !== team.id));
                                }
                              }}
                            />
                            <span>{team.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {enableInterview && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.02)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span>🤝 Stress Interview Configuration</span>
                  </h4>
                  <div className={styles.formGroup}>
                    <label>Select Interview Participating Teams (Min 2)</label>
                    <div className={styles.checkList} style={{ maxHeight: '140px' }}>
                      {db.teams.map(team => {
                        const isChecked = eventInterviewTeams.some(t => t.id === team.id);
                        return (
                          <label key={team.id} className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEventInterviewTeams([...eventInterviewTeams, { 
                                    id: team.id, 
                                    name: team.name, 
                                    color: team.color, 
                                    members: team.members || [], 
                                    score: 0, 
                                    criteria: { calmness: 0, mind: 0, communication: 0, arguments: 0 } 
                                  }]);
                                } else {
                                  setEventInterviewTeams(eventInterviewTeams.filter(t => t.id !== team.id));
                                }
                              }}
                            />
                            <span>{team.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {enableDebugging && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.02)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span>💻 Debugging Challenge Configuration</span>
                  </h4>
                  <div className={styles.formGroup}>
                    <label>Select Debugging Participating Teams (Min 2)</label>
                    <div className={styles.checkList} style={{ maxHeight: '140px' }}>
                      {db.teams.map(team => {
                        const isChecked = eventDebuggingTeams.some(t => t.id === team.id);
                        return (
                          <label key={team.id} className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEventDebuggingTeams([...eventDebuggingTeams, { 
                                    id: team.id, 
                                    name: team.name, 
                                    color: team.color, 
                                    members: team.members || [], 
                                    score: 0, 
                                    criteria: { syntactic: 0, logical: 0, speed: 0, style: 0 } 
                                  }]);
                                } else {
                                  setEventDebuggingTeams(eventDebuggingTeams.filter(t => t.id !== team.id));
                                }
                              }}
                            />
                            <span>{team.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowEventModal(false)}
                id="btn-cancel-event-modal"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                id="btn-submit-event-modal"
              >
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* QUESTION MODAL */}
      {showQModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="q-modal-title">
          <form onSubmit={handleQSubmit} className={`${styles.modalContent} glass`}>
            <h2 id="q-modal-title" style={{ marginBottom: '1.5rem' }}>{editQ ? 'Edit Question' : 'Add Question'}</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="q-text">Question Prompt *</label>
                <textarea
                  id="q-text"
                  required
                  rows="3"
                  placeholder="e.g. Which planet has the most moons?"
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className={styles.textarea}
                />
              </div>

              <div className={`${styles.formGrid} ${styles.formGrid2Col}`}>
                <div className={styles.formGroup}>
                  <label htmlFor="q-cat">Category</label>
                  <select
                    id="q-cat"
                    value={qCatId}
                    onChange={(e) => setQCatId(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">Uncategorized</option>
                    {db.categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="q-correct">Correct Answer *</label>
                  <select
                    id="q-correct"
                    required
                    value={qCorrect}
                    onChange={(e) => setQCorrect(e.target.value)}
                    className={styles.select}
                  >
                    <option value="">Select Option...</option>
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
              </div>

              {/* Options */}
              <div className={styles.formGroup}>
                <label>Options (A, B, C, D) *</label>
                <div className={styles.optionsGrid}>
                  <div className={styles.optionInputGroup}>
                    <span className={`${styles.optionPrefix} ${styles.optA}`}>A:</span>
                    <input
                      type="text"
                      required
                      placeholder="Choice A"
                      value={qOptions[0]}
                      onChange={(e) => setOptionIndex(0, e.target.value)}
                      className={`${styles.input} ${styles.optionInput}`}
                      id="opt-a-input"
                    />
                  </div>
                  <div className={styles.optionInputGroup}>
                    <span className={`${styles.optionPrefix} ${styles.optB}`}>B:</span>
                    <input
                      type="text"
                      required
                      placeholder="Choice B"
                      value={qOptions[1]}
                      onChange={(e) => setOptionIndex(1, e.target.value)}
                      className={`${styles.input} ${styles.optionInput}`}
                      id="opt-b-input"
                    />
                  </div>
                  <div className={styles.optionInputGroup}>
                    <span className={`${styles.optionPrefix} ${styles.optC}`}>C:</span>
                    <input
                      type="text"
                      required
                      placeholder="Choice C"
                      value={qOptions[2]}
                      onChange={(e) => setOptionIndex(2, e.target.value)}
                      className={`${styles.input} ${styles.optionInput}`}
                      id="opt-c-input"
                    />
                  </div>
                  <div className={styles.optionInputGroup}>
                    <span className={`${styles.optionPrefix} ${styles.optD}`}>D:</span>
                    <input
                      type="text"
                      required
                      placeholder="Choice D"
                      value={qOptions[3]}
                      onChange={(e) => setOptionIndex(3, e.target.value)}
                      className={`${styles.input} ${styles.optionInput}`}
                      id="opt-d-input"
                    />
                  </div>
                </div>
              </div>

              <div className={`${styles.formGrid} ${styles.formGrid2Col}`}>
                <div className={styles.formGroup}>
                  <label htmlFor="q-limit">Time Limit (seconds) *</label>
                  <input
                    id="q-limit"
                    type="number"
                    required
                    min="5"
                    max="180"
                    value={qLimit}
                    onChange={(e) => setQLimit(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="q-points">Points *</label>
                  <input
                    id="q-points"
                    type="number"
                    required
                    min="10"
                    max="1000"
                    step="10"
                    value={qPoints}
                    onChange={(e) => setQPoints(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="q-image">Question Image File Path (Optional, e.g. /images/logo.png)</label>
                <input
                  id="q-image"
                  type="text"
                  placeholder="e.g. /images/logo.png"
                  value={qImage}
                  onChange={(e) => setQImage(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowQModal(false)}
                id="btn-cancel-q-modal"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                id="btn-submit-q-modal"
              >
                Save Question
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {showCatModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
          <form onSubmit={handleCatSubmit} className={`${styles.modalContent} glass`}>
            <h2 id="cat-modal-title" style={{ marginBottom: '1.5rem' }}>{editCat ? 'Edit Category' : 'Add Category'}</h2>
            
            <div className={styles.formGroup}>
              <label htmlFor="cat-name">Category Name *</label>
              <input
                id="cat-name"
                type="text"
                required
                placeholder="e.g. Web Development"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className={styles.formGroup}>
                <label htmlFor="cat-icon">Category Icon Style</label>
                <select
                  id="cat-icon"
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value)}
                  className={styles.select}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                >
                  <option value="circle">Generic Circle</option>
                  <option value="riddles">Puzzle / Riddles</option>
                  <option value="connections">Network Connections</option>
                  <option value="emojis">Faces / Emojis</option>
                  <option value="analogies">Split Arrows / Analogies</option>
                  <option value="code">Brackets / Coding</option>
                  <option value="presentation">Presentation / PPT</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="cat-color">Category Brand Color</label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    id="cat-color"
                    type="color"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    style={{ 
                      width: '50px', 
                      height: '38px', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '8px', 
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Preview: <strong style={{ color: catColor }}>{catColor.toUpperCase()}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setShowCatModal(false);
                  setCatName('');
                  setCatIcon('circle');
                  setCatColor('#3b82f6');
                  setEditCat(null);
                }}
                id="btn-cancel-cat-modal"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                id="btn-submit-cat-modal"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TEAM MODAL */}
      {showTeamModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
          <form onSubmit={handleTeamSubmit} className={`${styles.modalContent} glass`}>
            <h2 id="team-modal-title" style={{ marginBottom: '1.5rem' }}>{editTeam ? 'Edit Team Details' : 'Register New Team'}</h2>
            
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="team-name">Team Name *</label>
                <input
                  id="team-name"
                  type="text"
                  required
                  placeholder="e.g. The Code Breakers"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="team-members">Student Members (Comma-separated)</label>
                <input
                  id="team-members"
                  type="text"
                  placeholder="e.g. Amit Kumar, Pooja Roy, Rohit Singh"
                  value={teamMembers}
                  onChange={(e) => setTeamMembers(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="team-color">Custom Theme Brand Color</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input
                    id="team-color"
                    type="color"
                    value={teamColor}
                    onChange={(e) => setTeamColor(e.target.value)}
                    style={{ 
                      width: '60px', 
                      height: '40px', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '8px', 
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Selected Color: <strong style={{ color: teamColor }}>{teamColor.toUpperCase()}</strong>
                  </span>
                </div>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                <label htmlFor="team-event">Event Participation (Optional)</label>
                <select
                  id="team-event"
                  value={selectedTeamEventId}
                  onChange={(e) => {
                    setSelectedTeamEventId(e.target.value);
                    if (!e.target.value) {
                      setTeamParticipatesQuiz(false);
                      setTeamParticipatesPpt(false);
                      setTeamParticipatesPoster(false);
                      setTeamParticipatesInterview(false);
                      setTeamParticipatesDebugging(false);
                    }
                  }}
                  className={styles.select}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#ffffff', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                >
                  <option value="">-- No Event / Keep in Registry Pool only --</option>
                  {db.events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              </div>

              {selectedTeamEventId && (
                <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                  <label>Select Event Track(s) *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: teamParticipatesQuiz ? 'rgba(99,102,241,0.05)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: teamParticipatesQuiz ? 'var(--primary)' : 'var(--border-color)' }}>
                      <input type="checkbox" checked={teamParticipatesQuiz} onChange={(e) => setTeamParticipatesQuiz(e.target.checked)} style={{ cursor: 'pointer' }} />
                      <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>⚡ Live Quiz</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: teamParticipatesPpt ? 'rgba(99,102,241,0.05)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: teamParticipatesPpt ? 'var(--primary)' : 'var(--border-color)' }}>
                      <input type="checkbox" checked={teamParticipatesPpt} onChange={(e) => setTeamParticipatesPpt(e.target.checked)} style={{ cursor: 'pointer' }} />
                      <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>📊 PPT</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: teamParticipatesPoster ? 'rgba(99,102,241,0.05)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: teamParticipatesPoster ? 'var(--primary)' : 'var(--border-color)' }}>
                      <input type="checkbox" checked={teamParticipatesPoster} onChange={(e) => setTeamParticipatesPoster(e.target.checked)} style={{ cursor: 'pointer' }} />
                      <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>🎨 Poster</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: teamParticipatesInterview ? 'rgba(99,102,241,0.05)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: teamParticipatesInterview ? 'var(--primary)' : 'var(--border-color)' }}>
                      <input type="checkbox" checked={teamParticipatesInterview} onChange={(e) => setTeamParticipatesInterview(e.target.checked)} style={{ cursor: 'pointer' }} />
                      <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>🤝 Interview</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: teamParticipatesDebugging ? 'rgba(99,102,241,0.05)' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', borderColor: teamParticipatesDebugging ? 'var(--primary)' : 'var(--border-color)' }}>
                      <input type="checkbox" checked={teamParticipatesDebugging} onChange={(e) => setTeamParticipatesDebugging(e.target.checked)} style={{ cursor: 'pointer' }} />
                      <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>💻 Debugging</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowTeamModal(false)}
                id="btn-cancel-team-modal"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                id="btn-submit-team-modal"
              >
                Save Team
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MANAGE TEAMS MODAL FOR SUB-COMPETITIONS */}
      {showManageTeamsModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="manage-teams-title">
          <div className={`${styles.modalContent} glass`} style={{ maxWidth: '500px' }}>
            <h2 id="manage-teams-title" style={{ marginBottom: '1.5rem' }}>
              Manage Participating Teams
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Select which teams from the Teams Pool will participate in this sub-competition. Already entered scores for checked teams will be preserved.
            </p>
            
            <div className={styles.formGroup} style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem' }}>
              {db.teams.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                  No registered teams found. Please register teams in the "Teams Pool" first.
                </p>
              ) : (
                db.teams.map(team => {
                  const isChecked = manageTeamsList.includes(team.id);
                  return (
                    <label key={team.id} className={styles.checkItem} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setManageTeamsList([...manageTeamsList, team.id]);
                          } else {
                            setManageTeamsList(manageTeamsList.filter(id => id !== team.id));
                          }
                        }}
                      />
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: team.color || '#6366f1' }} />
                      <span style={{ fontWeight: 'bold' }}>{team.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ({team.members ? team.members.join(', ') : ''})
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className={styles.modalActions} style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowManageTeamsModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleManageTeamsSave}
              >
                Save Selections
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
