'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import '../style.css';

function QuizArenaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventName = searchParams.get('event') || '';
  const regNo = searchParams.get('regNo') || '';

  // Student details loaded from URL & verified from DB
  const [studentDetails, setStudentDetails] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(true);

  // Questions and Answers
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});

  // Slide Deck State
  const [presentationSlides, setPresentationSlides] = useState([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [slideLoadingText, setSlideLoadingText] = useState('');
  const pptPanelRef = useRef(null);

  // Load student details and questions on mount
  useEffect(() => {
    if (!regNo || !eventName) {
      alert('Error: Register Number and Event Name must be provided.');
      router.push('/bca-quiz');
      return;
    }
    
    verifyAndLoadStudent();
    loadQuestions();
  }, [regNo, eventName]);

  // Verify student against live submissions ledger
  const verifyAndLoadStudent = async () => {
    try {
      // 1. Fetch from student-list to get master registration details
      const masterRes = await fetch('/api/bca-quiz/student-list');
      const masterData = await masterRes.json();
      const matchedMaster = masterData.find(s => s.regNo === regNo);

      if (!matchedMaster) {
        alert(`❌ Error: Student with Register Number ${regNo} is not registered in the system.`);
        router.push('/bca-quiz');
        return;
      }

      // Check if student is signed up for this event
      const hasEvent = matchedMaster.events?.some(e => e.eventName === eventName);
      if (!hasEvent) {
        alert(`❌ Error: Student is not registered for the event: "${eventName}"`);
        router.push('/bca-quiz');
        return;
      }

      const activeEventObj = matchedMaster.events.find(e => e.eventName === eventName);

      setStudentDetails({
        name: matchedMaster.name,
        regNo: matchedMaster.regNo,
        dept: matchedMaster.dept || 'BCA',
        collegeName: matchedMaster.collegeName,
        eventName: eventName,
        participantType: activeEventObj.participantType || 'Solo',
        teamName: activeEventObj.teamName || ''
      });
      setLoadingStudent(false);
    } catch (err) {
      console.error(err);
      alert('Failed loading student verification data.');
      router.push('/bca-quiz');
    }
  };

  // Load safe questions
  const loadQuestions = async () => {
    try {
      const res = await fetch('/api/bca-quiz/questions');
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      console.error(err);
      alert('Failed loading questions database.');
    }
  };

  // Process slide decks local emulation
  const handleLocalPresentationLoad = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSlideLoadingText('Processing presentation structures client-side...');
    
    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = () => {
      setTimeout(() => {
        setPresentationSlides([
          { 
            title: 'Welcome to the Competition Arena', 
            desc: `Successfully processed local file: <strong>${file.name}</strong><br><br>Please use the navigation controls below to flip through material.` 
          },
          { 
            title: 'Core Topic: Systems Architecture', 
            desc: 'Keep a close eye on multi-threading processes, resource allocation formulas, and hardware-software interaction layouts.' 
          },
          { 
            title: 'Core Topic: Database Engineering', 
            desc: 'Analyze schema structures, query processing metrics, relational constraints, and table normalization rules (1NF to BCNF) carefully.' 
          }
        ]);
        setActiveSlideIndex(0);
        setSlideLoadingText('');
      }, 800); // Simulate binary parsing hook delay
    };

    reader.readAsArrayBuffer(file);
  };

  // Navigation handlers
  const navigateSlides = (direction) => {
    if (presentationSlides.length === 0) return;
    let nextIndex = activeSlideIndex + direction;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= presentationSlides.length) nextIndex = presentationSlides.length - 1;
    setActiveSlideIndex(nextIndex);
  };

  const maximizeLocalViewer = () => {
    if (!pptPanelRef.current) return;
    const el = pptPanelRef.current;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  };

  // Answer handler
  const handleAnswerSelect = (qId, optionKey) => {
    setAnswers(prev => ({
      ...prev,
      [`q${qId}`]: optionKey
    }));
  };

  // Submit test Answers
  const submitQuizAnswers = async () => {
    if (!studentDetails) return;

    if (!confirm('Are you sure you want to submit your answers? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch('/api/bca-quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: studentDetails.eventName,
          name: studentDetails.name,
          regNo: studentDetails.regNo,
          dept: studentDetails.dept,
          participantType: studentDetails.participantType,
          teamName: studentDetails.teamName,
          answers: answers
        })
      });

      const result = await res.json();
      alert(result.message || `Score: ${result.score} / ${result.total}`);
      router.push('/bca-quiz');
    } catch (err) {
      console.error(err);
      alert('Network failure submitting quiz answers.');
    }
  };

  if (loadingStudent) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px' }}>
        <h2>Loading Competition Arena...</h2>
        <div style={{ color: 'var(--text-muted)' }}>Verifying registration profiles and loading modules...</div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1100px' }}>
      {/* Student Profile Info Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--panel-bg)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '25px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-neon)', letterSpacing: '0.05em', fontWeight: 'bold' }}>Live Competition Arena</span>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '1.4rem' }}>{studentDetails.name} ({studentDetails.regNo})</h2>
          <small style={{ color: 'var(--text-muted)' }}>
            College: {studentDetails.collegeName} | Dept: {studentDetails.dept} 
            {studentDetails.teamName && ` | Team: ${studentDetails.teamName}`}
          </small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'inline-block', background: 'var(--primary)', color: 'white', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem' }}>
            🏆 {studentDetails.eventName}
          </span>
          <button 
            onClick={() => router.push('/bca-quiz')} 
            style={{ display: 'block', width: 'auto', background: 'transparent', padding: '4px 8px', marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', border: 'none', boxShadow: 'none' }}
          >
            ❌ Quit Test
          </button>
        </div>
      </div>

      <div className="quiz-wrapper">
        <hr className="bca_hr" />
        <h1 className="bca_title">Quiz Live Arena</h1>
        
        <div className="arena-split-zone" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '25px' }}>
          
          {/* PowerPoint presentation emulation module */}
          <div 
            id="pptPanel" 
            ref={pptPanelRef}
            className="ppt-display-panel" 
            style={{ flex: '1', minWidth: '320px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '460px', position: 'relative', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <h3 style={{ margin: 0, color: 'var(--primary)' }}>
                  📊 Presentation Viewer ({presentationSlides.length > 0 ? `${activeSlideIndex + 1}/${presentationSlides.length}` : '0/0'})
                </h3>
                <button onClick={maximizeLocalViewer} style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem', background: 'var(--primary)' }}>🖵 Full Screen</button>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="file" 
                  id="pptxFileInput" 
                  accept=".ppt, .pptx" 
                  style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: '#0f172a', border: '1px solid var(--border-color)', padding: '5px', borderRadius: '4px', width: '100%' }}
                  onChange={handleLocalPresentationLoad}
                />
              </div>
            </div>
            
            <div id="slideStage" style={{ width: '100%', height: '300px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#000000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative', padding: '20px', boxSizing: 'border-box' }}>
              {slideLoadingText ? (
                <p style={{ color: 'var(--text-muted)' }}>{slideLoadingText}</p>
              ) : presentationSlides.length > 0 ? (
                <div style={{ color: '#ffffff', textAlign: 'center', width: '100%' }}>
                  <h2 style={{ color: 'var(--primary)', margin: '0 0 15px 0', fontSize: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '10px', width: '100%' }}>
                    {presentationSlides[activeSlideIndex].title}
                  </h2>
                  <p 
                    style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: '1.6', margin: '0' }}
                    dangerouslySetInnerHTML={{ __html: presentationSlides[activeSlideIndex].desc }}
                  />
                </div>
              ) : (
                <div id="slideContent" style={{ color: '#ffffff', textAlign: 'center', width: '100%' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>📁</span>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>Select a local .ppt or .pptx presentation file above to initialize slides.</p>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '15px', gap: '15px' }}>
              <button onClick={() => navigateSlides(-1)} style={{ background: '#475569', padding: '8px 16px', width: 'auto' }}>◀ Previous</button>
              <button onClick={() => navigateSlides(1)} style={{ background: 'var(--primary)', padding: '8px 16px', width: 'auto' }}>Next ▶</button>
            </div>
          </div>

          {/* Quiz answers feed panel */}
          <div className="questions-feed-panel" style={{ flex: '1', minWidth: '320px' }}>
            <div id="quizContainer">
              {questions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading questions...</p>
              ) : (
                questions.map((q) => (
                  <div key={q.id} className="question">
                    <p>{q.id}. {q.question}</p>
                    {Object.entries(q.options).map(([key, val]) => (
                      <label key={key}>
                        <input 
                          type="radio" 
                          name={`q${q.id}`} 
                          value={key} 
                          checked={answers[`q${q.id}`] === key}
                          onChange={() => handleAnswerSelect(q.id, key)}
                        />
                        {key}) {val}
                      </label>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        <button onClick={submitQuizAnswers} className="btn-submit-quiz">Submit Quiz Answers</button>
      </div>
    </div>
  );
}

export default function BcaQuizArena() {
  return (
    <div className="bca_quiz_body">
      <Suspense fallback={
        <div className="container" style={{ textAlign: 'center', padding: '60px' }}>
          <h2>Loading Session parameters...</h2>
        </div>
      }>
        <QuizArenaContent />
      </Suspense>
    </div>
  );
}
