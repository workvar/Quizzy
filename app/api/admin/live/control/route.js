import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import emitter from '@/lib/notifications';
import { emitToAll, getLiveState, updateLiveState } from '@/lib/socket-emitter';
import { scheduleQuestionTiming, cancelAutoSubmit } from '@/lib/question-timer';
import { computeTiming } from '@/lib/time-limits';

function buildQuestionPayload(q, timing) {
  return {
    id: q.id,
    title: q.title,
    content: q.content,
    type: q.type,
    isMultiAnswer: q.isMultiAnswer,
    sectionName: q.section?.name ?? null,
    releasedAt: q.releasedAt?.toISOString?.() ?? q.releasedAt ?? null,
    timeLimitSeconds: timing.effectiveLimitSeconds,
    questionTimeLimitSeconds: timing.questionLimitSeconds,
    timing: {
      enforcement: timing.enforcement,
      bindingSource: timing.bindingSource,
      quizLimitSeconds: timing.quizLimitSeconds,
      sectionLimitSeconds: timing.sectionLimitSeconds,
      quizSessionStartedAt: q.quiz?.sessionStartedAt?.toISOString?.() ?? q.quiz?.sessionStartedAt ?? null,
      sectionSessionStartedAt: q.section?.sessionStartedAt?.toISOString?.() ?? q.section?.sessionStartedAt ?? null,
    },
    options: q.type === 'MCQ' && q.options
      ? q.options.map(o => ({ id: o.id, content: o.content }))
      : [],
  };
}

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, questionId, sectionId } = await request.json();

  // ─── Release a question (DB + live screen) ─────────────────────────────────
  if (action === 'releaseQuestion') {
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
    const qid = parseInt(questionId);

    const q = await prisma.question.findUnique({
      where: { id: qid },
      include: { quiz: true, section: true },
    });
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Block if previous timed question is still open
    const activeTimed = await prisma.question.findFirst({
      where: { quizId: q.quizId, isReleased: true, id: { not: qid }, releasedAt: { not: null } },
      orderBy: { releasedAt: 'desc' },
      include: { section: true, quiz: true },
    });
    if (activeTimed) {
      const activeTiming = computeTiming({
        question: activeTimed,
        section: activeTimed.section,
        quiz: activeTimed.quiz || q.quiz,
      });
      if (activeTiming.effectiveExpiresAt && Date.now() < activeTiming.effectiveExpiresAt) {
        const [teams, answers] = await Promise.all([
          prisma.team.count({ where: { isBanned: false } }),
          prisma.answer.count({ where: { questionId: activeTimed.id } }),
        ]);
        const pending = teams - answers;
        if (pending > 0) {
          const secsLeft = Math.ceil((activeTiming.effectiveExpiresAt - Date.now()) / 1000);
          return NextResponse.json({
            error: `${pending} team${pending !== 1 ? 's' : ''} haven't submitted (${secsLeft}s left)`,
            blocked: true,
          }, { status: 409 });
        }
      }
    }

    const now = new Date();
    await prisma.question.update({ where: { id: qid }, data: { isReleased: true, releasedAt: now } });

    const timing = await scheduleQuestionTiming(qid);

    emitter.emit('questionReleased', { type: 'questionReleased', id: qid, title: q.title });

    const options = await prisma.option.findMany({ where: { questionId: qid }, orderBy: { optionOrder: 'asc' } });
    const existingAnswers = await prisma.answer.findMany({
      where: { questionId: qid },
      include: { team: { select: { name: true } } },
      orderBy: { answerRank: 'asc' },
    });
    const allTeams = await prisma.team.findMany({ where: { isBanned: false }, select: { id: true, name: true } });

    const fresh = await prisma.question.findUnique({
      where: { id: qid },
      include: { quiz: true, section: true },
    });
    const t = timing || computeTiming({
      question: { ...fresh, releasedAt: now },
      section: fresh.section,
      quiz: fresh.quiz,
    });

    const questionData = buildQuestionPayload(
      { ...fresh, options, releasedAt: now },
      t,
    );

    const fastestAnswers = existingAnswers.map(a => ({
      rank: a.answerRank,
      teamName: a.team.name,
      isCorrect: a.isCorrect,
      submittedAt: a.submittedAt,
    }));

    updateLiveState({
      currentQuestion: questionData,
      showResults: false,
      resultStats: null,
      fastestAnswers,
      allTeams,
      submittedTeamIds: existingAnswers.map(a => a.teamId),
      quizSessionStartedAt: fresh.quiz.sessionStartedAt?.toISOString() ?? null,
      timeLimitSeconds: fresh.quiz.timeLimitSeconds,
      timeEnforcement: fresh.quiz.timeEnforcement,
    });

    emitToAll('question:show', { question: questionData, fastestAnswers, allTeams, submittedTeamIds: existingAnswers.map(a => a.teamId) });
    return NextResponse.json({ success: true, timing: t });

  // ─── Unrelease a question ──────────────────────────────────────────────────
  } else if (action === 'unreleaseQuestion') {
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
    const qid = parseInt(questionId);
    cancelAutoSubmit(qid);
    await prisma.question.update({ where: { id: qid }, data: { isReleased: false, releasedAt: null } });
    emitter.emit('questionUnreleased', { type: 'questionUnreleased', id: qid });

    const state = getLiveState();
    if (state.currentQuestion?.id === qid) {
      updateLiveState({ currentQuestion: null, showResults: false, resultStats: null, fastestAnswers: [], submittedTeamIds: [] });
      emitToAll('question:hide', {});
    }
    return NextResponse.json({ success: true });

  // ─── Show question on live screen (without DB release) ───────────────────
  } else if (action === 'showQuestion') {
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
    const qid = parseInt(questionId);
    const question = await prisma.question.findUnique({
      where: { id: qid },
      include: {
        options: { orderBy: { optionOrder: 'asc' } },
        quiz: true,
        section: true,
      },
    });
    if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existingAnswers = await prisma.answer.findMany({
      where: { questionId: qid },
      include: { team: { select: { name: true } } },
      orderBy: { answerRank: 'asc' },
    });
    const allTeams = await prisma.team.findMany({ where: { isBanned: false }, select: { id: true, name: true } });

    const timing = computeTiming({
      question,
      section: question.section,
      quiz: question.quiz,
    });
    const questionData = buildQuestionPayload(question, timing);

    updateLiveState({
      currentQuestion: questionData,
      showResults: false,
      resultStats: null,
      fastestAnswers: existingAnswers.map(a => ({
        rank: a.answerRank,
        teamName: a.team.name,
        isCorrect: a.isCorrect,
        submittedAt: a.submittedAt,
      })),
      allTeams,
      submittedTeamIds: existingAnswers.map(a => a.teamId),
      quizSessionStartedAt: question.quiz.sessionStartedAt?.toISOString() ?? null,
    });

    emitToAll('question:show', {
      question: questionData,
      fastestAnswers: getLiveState().fastestAnswers,
      allTeams,
      submittedTeamIds: existingAnswers.map(a => a.teamId),
    });
    return NextResponse.json({ success: true });

  // ─── Hide question from live screen ──────────────────────────────────────
  } else if (action === 'hideQuestion') {
    updateLiveState({ currentQuestion: null, showResults: false, resultStats: null, fastestAnswers: [], submittedTeamIds: [] });
    emitToAll('question:hide', {});
    return NextResponse.json({ success: true });

  // ─── Show answer results ──────────────────────────────────────────────────
  } else if (action === 'showResults') {
    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 });
    const qid = parseInt(questionId);
    const question = await prisma.question.findUnique({ where: { id: qid } });
    const allAnswers = await prisma.answer.findMany({ where: { questionId: qid } });

    let resultStats;
    if (question?.type === 'CODING') {
      resultStats = {
        type: 'CODING',
        totalAnswered: allAnswers.length,
        solved: allAnswers.filter(a => a.isCorrect).length,
      };
    } else {
      const options = await prisma.option.findMany({ where: { questionId: qid }, orderBy: { optionOrder: 'asc' } });
      const countMap = {};
      for (const a of allAnswers) {
        try { for (const id of JSON.parse(a.selectedOptions)) countMap[id] = (countMap[id] || 0) + 1; } catch {}
      }
      resultStats = {
        type: 'MCQ',
        correctOptionIds: options.filter(o => o.isCorrect).map(o => o.id),
        options: options.map(o => ({ id: o.id, content: o.content, isCorrect: o.isCorrect })),
        optionStats: countMap,
        totalAnswered: allAnswers.length,
      };
    }
    updateLiveState({ showResults: true, resultStats });
    emitToAll('results:show', resultStats);
    return NextResponse.json({ success: true });

  // ─── Hide results ─────────────────────────────────────────────────────────
  } else if (action === 'hideResults') {
    updateLiveState({ showResults: false, resultStats: null });
    emitToAll('results:hide', {});
    return NextResponse.json({ success: true });

  // ─── Reset fastest answers feed ───────────────────────────────────────────
  } else if (action === 'resetFeed') {
    updateLiveState({ fastestAnswers: [] });
    emitToAll('feed:reset', {});
    return NextResponse.json({ success: true });

  // ─── Enable / disable a section ───────────────────────────────────────────
  } else if (action === 'enableSection' || action === 'disableSection') {
    if (!sectionId) return NextResponse.json({ error: 'sectionId required' }, { status: 400 });
    const sid = parseInt(sectionId);
    const isEnabled = action === 'enableSection';
    const section = await prisma.section.update({ where: { id: sid }, data: { isEnabled } });
    emitToAll('section:toggled', { sectionId: sid, isEnabled });
    return NextResponse.json({ success: true, id: section.id, isEnabled: section.isEnabled });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
