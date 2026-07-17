import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';

// GET: Returns the full db object
export async function GET() {
  const db = getDb();
  return NextResponse.json(db);
}

// POST: Handles CRUD operations for categories, questions, teams, events, and DB restore
export async function POST(request) {
  try {
    const body = await request.json();
    const { type, action, payload } = body;
    const db = getDb();
    
    // Ensure teams array exists
    if (!db.teams) {
      db.teams = [];
    }

    if (type === 'db' && action === 'restore') {
      if (!payload.categories || !payload.questions || !payload.events) {
        return NextResponse.json({ error: 'Invalid database format' }, { status: 400 });
      }
      if (!payload.teams) payload.teams = [];
      saveDb(payload);
      return NextResponse.json({ success: true, message: 'Database restored successfully' });
    }

    if (type === 'category') {
      if (action === 'create') {
        const newCat = {
          id: 'cat_' + Date.now(),
          name: payload.name,
          icon: payload.icon || 'circle',
          color: payload.color || '#3b82f6'
        };
        db.categories.push(newCat);
      } else if (action === 'update') {
        const index = db.categories.findIndex(c => c.id === payload.id);
        if (index !== -1) {
          db.categories[index].name = payload.name;
          db.categories[index].icon = payload.icon || 'circle';
          db.categories[index].color = payload.color || '#3b82f6';
        }
      } else if (action === 'delete') {
        db.categories = db.categories.filter(c => c.id !== payload.id);
        db.questions = db.questions.map(q => {
          if (q.categoryId === payload.id) {
            return { ...q, categoryId: '' };
          }
          return q;
        });
      }
    } 
    
    else if (type === 'question') {
      if (action === 'create') {
        const newQ = {
          id: 'q_' + Date.now(),
          categoryId: payload.categoryId,
          text: payload.text,
          options: payload.options || [],
          correctAnswer: payload.correctAnswer,
          timeLimit: Number(payload.timeLimit) || 20,
          points: Number(payload.points) || 100
        };
        db.questions.push(newQ);
      } else if (action === 'update') {
        const index = db.questions.findIndex(q => q.id === payload.id);
        if (index !== -1) {
          db.questions[index] = {
            ...db.questions[index],
            categoryId: payload.categoryId,
            text: payload.text,
            options: payload.options || [],
            correctAnswer: payload.correctAnswer,
            timeLimit: Number(payload.timeLimit) || 20,
            points: Number(payload.points) || 100
          };
        }
      } else if (action === 'delete') {
        db.questions = db.questions.filter(q => q.id !== payload.id);
        db.events = db.events.map(e => {
          const originalIndex = e.currentQuestionIndex;
          const filteredQIds = e.questionIds.filter(id => id !== payload.id);
          
          let newIndex = originalIndex;
          if (newIndex >= filteredQIds.length) {
            newIndex = Math.max(0, filteredQIds.length - 1);
          }
          
          return {
            ...e,
            questionIds: filteredQIds,
            currentQuestionIndex: newIndex
          };
        });
      }
    } 
    
    else if (type === 'team') {
      let teamObj = null;
      if (action === 'create') {
        teamObj = {
          id: 't_' + Date.now(),
          name: payload.name,
          members: Array.isArray(payload.members) 
            ? payload.members 
            : (payload.members ? payload.members.split(',').map(m => m.trim()) : []),
          color: payload.color || '#6366f1'
        };
        db.teams.push(teamObj);
      } else if (action === 'update') {
        const index = db.teams.findIndex(t => t.id === payload.id);
        if (index !== -1) {
          const updatedMembers = Array.isArray(payload.members) 
            ? payload.members 
            : (payload.members ? payload.members.split(',').map(m => m.trim()) : []);
            
          db.teams[index] = {
            ...db.teams[index],
            name: payload.name,
            members: updatedMembers,
            color: payload.color || '#6366f1'
          };
          teamObj = db.teams[index];
        }
      } else if (action === 'delete') {
        db.teams = db.teams.filter(t => t.id !== payload.id);
        // Cascading delete to all event team lists
        db.events = db.events.map(e => ({
          ...e,
          teams: (e.teams || []).filter(t => t.id !== payload.id),
          pptTeams: (e.pptTeams || []).filter(t => t.id !== payload.id),
          posterTeams: (e.posterTeams || []).filter(t => t.id !== payload.id),
          interviewTeams: (e.interviewTeams || []).filter(t => t.id !== payload.id),
          debuggingTeams: (e.debuggingTeams || []).filter(t => t.id !== payload.id)
        }));
      }

      // Sync event and track selections for create/update actions
      if ((action === 'create' || action === 'update') && teamObj) {
        const targetEventId = payload.eventId || '';
        const tracks = payload.participatingTracks || []; // e.g. ['quiz', 'ppt']

        db.events = db.events.map(e => {
          // If this is the selected event, add/update tracks
          if (e.id === targetEventId) {
            const hasQuiz = tracks.includes('quiz');
            const hasPpt = tracks.includes('ppt');
            const hasPoster = tracks.includes('poster');
            const hasInterview = tracks.includes('interview');
            const hasDebugging = tracks.includes('debugging');

            // 1. Quiz
            let updatedTeams = [...(e.teams || [])];
            const qIdx = updatedTeams.findIndex(t => t.id === teamObj.id);
            if (hasQuiz) {
              const item = { id: teamObj.id, name: teamObj.name, color: teamObj.color, members: teamObj.members, score: qIdx !== -1 ? updatedTeams[qIdx].score : 0 };
              if (qIdx !== -1) updatedTeams[qIdx] = item;
              else updatedTeams.push(item);
            } else {
              updatedTeams = updatedTeams.filter(t => t.id !== teamObj.id);
            }

            // 2. PPT
            let updatedPptTeams = [...(e.pptTeams || [])];
            const pptIdx = updatedPptTeams.findIndex(t => t.id === teamObj.id);
            if (hasPpt) {
              const item = { id: teamObj.id, name: teamObj.name, color: teamObj.color, members: teamObj.members, score: pptIdx !== -1 ? updatedPptTeams[pptIdx].score : 0, criteria: pptIdx !== -1 ? updatedPptTeams[pptIdx].criteria : { content: 0, delivery: 0, design: 0, qa: 0, time: 0 } };
              if (pptIdx !== -1) updatedPptTeams[pptIdx] = item;
              else updatedPptTeams.push(item);
            } else {
              updatedPptTeams = updatedPptTeams.filter(t => t.id !== teamObj.id);
            }

            // 3. Poster
            let updatedPosterTeams = [...(e.posterTeams || [])];
            const postIdx = updatedPosterTeams.findIndex(t => t.id === teamObj.id);
            if (hasPoster) {
              const item = { id: teamObj.id, name: teamObj.name, color: teamObj.color, members: teamObj.members, score: postIdx !== -1 ? updatedPosterTeams[postIdx].score : 0, criteria: postIdx !== -1 ? updatedPosterTeams[postIdx].criteria : { creativity: 0, relevance: 0, aesthetics: 0, explanation: 0 } };
              if (postIdx !== -1) updatedPosterTeams[postIdx] = item;
              else updatedPosterTeams.push(item);
            } else {
              updatedPosterTeams = updatedPosterTeams.filter(t => t.id !== teamObj.id);
            }

            // 4. Interview
            let updatedInterviewTeams = [...(e.interviewTeams || [])];
            const intIdx = updatedInterviewTeams.findIndex(t => t.id === teamObj.id);
            if (hasInterview) {
              const item = { id: teamObj.id, name: teamObj.name, color: teamObj.color, members: teamObj.members, score: intIdx !== -1 ? updatedInterviewTeams[intIdx].score : 0, criteria: intIdx !== -1 ? updatedInterviewTeams[intIdx].criteria : { calmness: 0, mind: 0, communication: 0, arguments: 0 } };
              if (intIdx !== -1) updatedInterviewTeams[intIdx] = item;
              else updatedInterviewTeams.push(item);
            } else {
              updatedInterviewTeams = updatedInterviewTeams.filter(t => t.id !== teamObj.id);
            }

            // 5. Debugging
            let updatedDebuggingTeams = [...(e.debuggingTeams || [])];
            const debIdx = updatedDebuggingTeams.findIndex(t => t.id === teamObj.id);
            if (hasDebugging) {
              const item = { id: teamObj.id, name: teamObj.name, color: teamObj.color, members: teamObj.members, score: debIdx !== -1 ? updatedDebuggingTeams[debIdx].score : 0, criteria: debIdx !== -1 ? updatedDebuggingTeams[debIdx].criteria : { syntactic: 0, logical: 0, speed: 0, style: 0 } };
              if (debIdx !== -1) updatedDebuggingTeams[debIdx] = item;
              else updatedDebuggingTeams.push(item);
            } else {
              updatedDebuggingTeams = updatedDebuggingTeams.filter(t => t.id !== teamObj.id);
            }

            return {
              ...e,
              teams: updatedTeams,
              pptTeams: updatedPptTeams,
              posterTeams: updatedPosterTeams,
              interviewTeams: updatedInterviewTeams,
              debuggingTeams: updatedDebuggingTeams
            };
          } else {
            // Remove team from all track arrays of other events
            return {
              ...e,
              teams: (e.teams || []).filter(t => t.id !== teamObj.id),
              pptTeams: (e.pptTeams || []).filter(t => t.id !== teamObj.id),
              posterTeams: (e.posterTeams || []).filter(t => t.id !== teamObj.id),
              interviewTeams: (e.interviewTeams || []).filter(t => t.id !== teamObj.id),
              debuggingTeams: (e.debuggingTeams || []).filter(t => t.id !== teamObj.id)
            };
          }
        });
      }
    }
    
    else if (type === 'event') {
      if (action === 'create') {
        const newEvent = {
          id: 'event_' + Date.now(),
          name: payload.name,
          status: 'idle',
          currentQuestionIndex: 0,
          questionIds: payload.questionIds || [],
          state: {
            showQuestion: false,
            showAnswer: false,
            timerStartedAt: null,
            timerDuration: 20,
            timerRemaining: 20,
            timerRunning: false,
            completedQuestionIds: []
          },
          teams: payload.teams || [],
          pptTeams: payload.pptTeams || [],
          posterTeams: payload.posterTeams || [],
          interviewTeams: payload.interviewTeams || [],
          debuggingTeams: payload.debuggingTeams || []
        };
        db.events.push(newEvent);
      } else if (action === 'update') {
        const index = db.events.findIndex(e => e.id === payload.id);
        if (index !== -1) {
          db.events[index] = {
            ...db.events[index],
            ...payload
          };
        }
      } else if (action === 'delete') {
        db.events = db.events.filter(e => e.id !== payload.id);
      }
    }
    
    saveDb(db);
    return NextResponse.json({ success: true, db });
  } catch (error) {
    console.error('API database edit error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
