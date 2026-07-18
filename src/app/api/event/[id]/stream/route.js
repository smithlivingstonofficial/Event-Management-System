import { NextResponse } from 'next/server';
import { getDb, dbEmitter } from '@/lib/db';

export async function GET(request, { params }) {
  const { id } = await params;
  const db = getDb();
  const event = db.events.find(e => e.id === id);

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Helper to send data in SSE format
  const sendSSE = (eventName, data) => {
    try {
      const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
      writer.write(encoder.encode(message));
    } catch (e) {
      console.error('SSE Stream write error:', e);
    }
  };

  // Helper to compile state payload
  const getEventStatePayload = (currentDb) => {
    const activeEvent = currentDb.events.find(e => e.id === id);
    if (!activeEvent) return null;

    let activeQuestion = null;
    const questionId = activeEvent.questionIds[activeEvent.currentQuestionIndex];
    
    if (questionId) {
      const question = currentDb.questions.find(q => q.id === questionId);
      if (question) {
        const category = currentDb.categories.find(c => c.id === question.categoryId);
        activeQuestion = {
          ...question,
          categoryName: category ? category.name : 'Uncategorized'
        };
      }
    }

    const eventQuestions = currentDb.questions.filter(q => activeEvent.questionIds.includes(q.id));

    return {
      event: activeEvent,
      activeQuestion,
      totalQuestions: activeEvent.questionIds.length,
      categories: currentDb.categories,
      questions: eventQuestions
    };
  };

  // Send initial load state
  sendSSE('state', getEventStatePayload(db));

  // Listener for dynamic database overrides
  const onDbChange = (newDb) => {
    const payload = getEventStatePayload(newDb);
    if (payload) {
      sendSSE('state', payload);
    }
  };

  dbEmitter.on('change', onDbChange);

  // Handle client disconnect gracefully
  request.signal.addEventListener('abort', () => {
    dbEmitter.off('change', onDbChange);
    try {
      writer.close();
    } catch (err) {
      // Stream already closed or aborted
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
export const dynamic = 'force-dynamic';
