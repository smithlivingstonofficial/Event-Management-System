import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';

// GET: Returns the detailed event state, including active question info, categories, and questions
export async function GET(request, { params }) {
  const { id } = await params;
  const db = getDb();
  const event = db.events.find(e => e.id === id);
  
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Get active question details if available
  let activeQuestion = null;
  const questionId = event.questionIds[event.currentQuestionIndex];
  
  if (questionId) {
    const question = db.questions.find(q => q.id === questionId);
    if (question) {
      const category = db.categories.find(c => c.id === question.categoryId);
      activeQuestion = {
        ...question,
        categoryName: category ? category.name : 'Uncategorized'
      };
    }
  }

  const eventQuestions = db.questions.filter(q => event.questionIds.includes(q.id));

  return NextResponse.json({
    event,
    activeQuestion,
    totalQuestions: event.questionIds.length,
    categories: db.categories,
    questions: eventQuestions
  });
}

// PUT: Handles state updates and controls (start timer, show answer, score adjustments)
export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const { action, payload } = body;
  
  const db = getDb();
  const eventIndex = db.events.findIndex(e => e.id === id);
  
  if (eventIndex === -1) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  
  const event = db.events[eventIndex];
  
  // Ensure completedQuestionIds exists
  if (!event.state.completedQuestionIds) {
    event.state.completedQuestionIds = [];
  }
  
  // Ensure currentRound exists
  if (!event.state.currentRound) {
    event.state.currentRound = 1;
  }
  
  switch (action) {
    case 'select-question': {
      const qId = payload.questionId;
      const index = event.questionIds.indexOf(qId);
      if (index !== -1) {
        event.currentQuestionIndex = index;
        
        const qObj = db.questions.find(q => q.id === qId);
        const limit = qObj ? qObj.timeLimit : 20;
        
        event.state.showQuestion = true;
        event.state.showAnswer = false;
        event.state.timerDuration = limit;
        event.state.timerRemaining = limit;
        event.state.timerRunning = false;
        event.state.timerStartedAt = null;
      }
      break;
    }
    
    case 'return-to-grid': {
      const activeQId = event.questionIds[event.currentQuestionIndex];
      if (activeQId && !event.state.completedQuestionIds.includes(activeQId)) {
        event.state.completedQuestionIds.push(activeQId);
      }
      event.state.showQuestion = false;
      event.state.showAnswer = false;
      event.state.timerRunning = false;
      event.state.timerStartedAt = null;
      break;
    }
    
    case 'reset-grid': {
      event.state.completedQuestionIds = [];
      event.state.showQuestion = false;
      event.state.showAnswer = false;
      event.state.timerRunning = false;
      event.state.timerStartedAt = null;
      event.currentQuestionIndex = -1;
      event.state.currentRound = 1;
      event.teams = event.teams.map(t => ({ ...t, score: 0 }));
      break;
    }

    case 'change-round': {
      event.state.currentRound = payload;
      event.state.showQuestion = false;
      event.state.showAnswer = false;
      break;
    }

    case 'start-timer':
      event.state.timerRunning = true;
      event.state.timerStartedAt = new Date().toISOString();
      break;
      
    case 'pause-timer':
      if (event.state.timerRunning && event.state.timerStartedAt) {
        const elapsed = Math.floor((Date.now() - new Date(event.state.timerStartedAt).getTime()) / 1000);
        event.state.timerRemaining = Math.max(0, event.state.timerRemaining - elapsed);
      }
      event.state.timerRunning = false;
      event.state.timerStartedAt = null;
      break;
      
    case 'reset-timer':
      event.state.timerRunning = false;
      event.state.timerStartedAt = null;
      
      const currentQId = event.questionIds[event.currentQuestionIndex];
      const currentQ = db.questions.find(q => q.id === currentQId);
      const timeLimit = currentQ ? currentQ.timeLimit : 20;
      
      event.state.timerDuration = timeLimit;
      event.state.timerRemaining = timeLimit;
      break;
      
    case 'tick-timer':
      if (event.state.timerRunning && event.state.timerStartedAt) {
        const elapsed = Math.floor((Date.now() - new Date(event.state.timerStartedAt).getTime()) / 1000);
        const rem = event.state.timerDuration - elapsed;
        event.state.timerRemaining = Math.max(0, rem);
        if (event.state.timerRemaining === 0) {
          event.state.timerRunning = false;
          event.state.timerStartedAt = null;
        }
      }
      break;

    case 'show-question':
      event.state.showQuestion = payload !== undefined ? payload : true;
      break;
      
    case 'reveal-answer':
      event.state.showAnswer = payload !== undefined ? payload : true;
      event.state.timerRunning = false;
      event.state.timerStartedAt = null;
      break;
      
    case 'next-question':
      if (event.currentQuestionIndex < event.questionIds.length - 1) {
        event.currentQuestionIndex += 1;
        event.state.showQuestion = false;
        event.state.showAnswer = false;
        
        const nextQId = event.questionIds[event.currentQuestionIndex];
        const nextQ = db.questions.find(q => q.id === nextQId);
        const nextLimit = nextQ ? nextQ.timeLimit : 20;
        
        event.state.timerDuration = nextLimit;
        event.state.timerRemaining = nextLimit;
        event.state.timerRunning = false;
        event.state.timerStartedAt = null;
      }
      break;
      
    case 'prev-question':
      if (event.currentQuestionIndex > 0) {
        event.currentQuestionIndex -= 1;
        event.state.showQuestion = false;
        event.state.showAnswer = false;
        
        const prevQId = event.questionIds[event.currentQuestionIndex];
        const prevQ = db.questions.find(q => q.id === prevQId);
        const prevLimit = prevQ ? prevQ.timeLimit : 20;
        
        event.state.timerDuration = prevLimit;
        event.state.timerRemaining = prevLimit;
        event.state.timerRunning = false;
        event.state.timerStartedAt = null;
      }
      break;
      
    case 'update-score': {
      const team = event.teams.find(t => t.id === payload.teamId);
      if (team) {
        team.score = (team.score || 0) + payload.amount;
      }
      break;
    }

    case 'update-event-status':
      event.status = payload.status;
      if (payload.status === 'active' && event.currentQuestionIndex === 0) {
        event.state.showQuestion = false;
        event.state.showAnswer = false;
        const qId = event.questionIds[0];
        const qObj = db.questions.find(q => q.id === qId);
        event.state.timerDuration = qObj ? qObj.timeLimit : 20;
        event.state.timerRemaining = event.state.timerDuration;
      }
      break;
      
    case 'update-teams':
      event.teams = payload;
      break;

    case 'set-active-question-index':
      event.currentQuestionIndex = payload;
      event.state.showQuestion = false;
      event.state.showAnswer = false;
      const selectQId = event.questionIds[payload];
      const selectQ = db.questions.find(q => q.id === selectQId);
      event.state.timerDuration = selectQ ? selectQ.timeLimit : 20;
      event.state.timerRemaining = event.state.timerDuration;
      event.state.timerRunning = false;
      event.state.timerStartedAt = null;
      break;

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  
  db.events[eventIndex] = event;
  saveDb(db);
  
  return NextResponse.json({ success: true, event });
}
