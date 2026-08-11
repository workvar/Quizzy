import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/session';
import prisma from '@/lib/prisma';
import { assertTeamCanAccessQuestion } from '@/lib/team-groups';

export async function GET(request, { params }) {
  const session = await requireTeam();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qid = parseInt(params.id);
  const question = await prisma.question.findUnique({
    where: { id: qid },
    include: {
      quiz: true,
      section: { select: { timeLimitSeconds: true } },
      testCases: { orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!question || !question.isReleased) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await assertTeamCanAccessQuestion(session.teamId, question);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const answer = await prisma.answer.findUnique({
    where: { teamId_questionId: { teamId: session.teamId, questionId: qid } },
  });

  const allReleased = await prisma.question.findMany({
    where: { quizId: question.quizId, isReleased: true },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
  });
  const idx = allReleased.findIndex(q => q.id === question.id);

  // Effective time limit: question > section > quiz
  const effectiveTimeLimit = question.timeLimitSeconds
    ?? question.section?.timeLimitSeconds
    ?? question.quiz.timeLimitSeconds
    ?? null;

  let timeRemaining = null;
  if (effectiveTimeLimit && question.releasedAt && !answer) {
    const elapsed = Math.floor((Date.now() - new Date(question.releasedAt).getTime()) / 1000);
    timeRemaining = Math.max(0, effectiveTimeLimit - elapsed);
  }

  const base = {
    id: question.id,
    title: question.title,
    content: question.content,
    type: question.type,
    submitted: !!answer,
    isCorrect: answer ? answer.isCorrect : null,
    score: answer ? answer.score : null,
    prevId: idx > 0 ? allReleased[idx - 1].id : null,
    nextId: idx < allReleased.length - 1 ? allReleased[idx + 1].id : null,
    questionNumber: idx + 1,
    totalQuestions: allReleased.length,
    timeLimitSeconds: effectiveTimeLimit,
    releasedAt: question.releasedAt?.toISOString() ?? null,
    timeRemaining,
  };

  // ── CODING ────────────────────────────────────────────────────────────────
  if (question.type === 'CODING') {
    const starterCode = question.starterCode ? JSON.parse(question.starterCode) : {};
    let allowedLanguages;
    try { allowedLanguages = JSON.parse(question.allowedLanguages); } catch { allowedLanguages = ['javascript', 'python']; }
    const visibleTestCases = question.testCases.filter(tc => !tc.isHidden).map(tc => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    }));

    return NextResponse.json({
      ...base,
      starterCode,
      allowedLanguages,
      visibleTestCases,
      // Submission data
      submittedCode: answer?.codeSubmission ?? null,
      submittedLanguage: answer?.language ?? null,
      testsPassed: answer?.testsPassed ?? null,
      testsTotal: answer?.testsTotal ?? null,
    });
  }

  // ── MCQ ───────────────────────────────────────────────────────────────────
  const options = await prisma.option.findMany({
    where: { questionId: qid },
    orderBy: { optionOrder: 'asc' },
  });

  const correctOptionIds = answer ? options.filter(o => o.isCorrect).map(o => o.id) : null;

  let optionStats = null;
  let totalAnswered = 0;
  if (answer) {
    const allAnswers = await prisma.answer.findMany({ where: { questionId: qid } });
    const countMap = {};
    for (const a of allAnswers) {
      try { for (const id of JSON.parse(a.selectedOptions)) countMap[id] = (countMap[id] || 0) + 1; } catch {}
    }
    optionStats = countMap;
    totalAnswered = allAnswers.length;
  }

  return NextResponse.json({
    ...base,
    isMultiAnswer: question.isMultiAnswer,
    options: options.map(o => ({ id: o.id, content: o.content })),
    selectedOptions: answer ? JSON.parse(answer.selectedOptions) : null,
    correctOptions: correctOptionIds,
    optionStats,
    totalAnswered,
  });
}
