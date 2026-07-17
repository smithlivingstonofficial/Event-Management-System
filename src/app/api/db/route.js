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
          name: payload.name
        };
        db.categories.push(newCat);
      } else if (action === 'update') {
        const index = db.categories.findIndex(c => c.id === payload.id);
        if (index !== -1) {
          db.categories[index].name = payload.name;
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
      if (action === 'create') {
        const newTeam = {
          id: 't_' + Date.now(),
          name: payload.name,
          members: Array.isArray(payload.members) 
            ? payload.members 
            : (payload.members ? payload.members.split(',').map(m => m.trim()) : []),
          color: payload.color || '#6366f1'
        };
        db.teams.push(newTeam);
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
          
          // Cascading update to event team lists
          db.events = db.events.map(e => {
            const matchedTeamIdx = e.teams.findIndex(t => t.id === payload.id);
            if (matchedTeamIdx !== -1) {
              const updatedTeams = [...e.teams];
              updatedTeams[matchedTeamIdx] = {
                ...updatedTeams[matchedTeamIdx],
                name: payload.name,
                members: updatedMembers,
                color: payload.color || '#6366f1'
              };
              return { ...e, teams: updatedTeams };
            }
            return e;
          });
        }
      } else if (action === 'delete') {
        db.teams = db.teams.filter(t => t.id !== payload.id);
        // Cascading delete to event team lists
        db.events = db.events.map(e => ({
          ...e,
          teams: e.teams.filter(t => t.id !== payload.id)
        }));
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
