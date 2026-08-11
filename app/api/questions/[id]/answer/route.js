import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/session';
import prisma from '@/lib/prisma';
import { emitToAll, getLiveState, updateLiveState } from '@/lib/socket-emitter';
import { runTestCases } from '@/lib/execute-code';
import { isContestClosedForSubmit } from '@/lib/settings';
import { assertTeamCanAccessQuestion } from '@/lib/team-groups';

export async function POST(request, { params }) {
  const session = await requireTeam();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (await isContestClosedForSubmit()) {
    return NextResponse.json({ error: 'Contest has ended. Submissions are closed.' }, { status: 403 });
  }

  const body = await request.json();
  const qid = parseInt(params.id);

  const question = await prisma.question.findUnique({
    where: { id: qid },
    include: { quiz: true, testCases: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!question || !question.isReleased) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await assertTeamCanAccessQuestion(session.teamId, question);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  // Check timer expiry
  if (question.quiz.timeLimitSeconds && question.releasedAt) {
    const expireAt = new Date(question.releasedAt).getTime() + question.quiz.timeLimitSeconds * 1000;
    if (Date.now() > expireAt) {
      return NextResponse.json({ error: 'Time has expired for this question' }, { status: 400 });
    }
  }

  const existing = await prisma.answer.findUnique({
    where: { teamId_questionId: { teamId: session.teamId, questionId: qid } },
  });
  if (existing) return NextResponse.json({ error: 'Already answered' }, { status: 400 });

  // ── CODING question ───────────────────────────────────────────────────────
  if (question.type === 'CODING') {
    const { code, language } = body;
    if (!code || !language) return NextResponse.json({ error: 'code and language required' }, { status: 400 });
    if (!['javascript', 'python'].includes(language)) {
      return NextResponse.json({ error: 'Unsupported language' }, { status: 400 });
    }

    let testResults = [];
    let testsPassed = 0;
    const testsTotal = question.testCases.length;

    if (testsTotal > 0) {
      try {
        testResults = await runTestCases(language, code, question.testCases);
        testsPassed = testResults.filter(r => r.passed).length;
      } catch (err) {
        return NextResponse.json({ error: 'Execution failed: ' + err.message }, { status: 500 });
      }
    }

    const isCorrect = testsTotal > 0 && testsPassed === testsTotal;
    const score = testsTotal > 0 ? Math.round((testsPassed / testsTotal) * question.quiz.pointsPerQuestion) : 0;

    const answer = await prisma.$transaction(async (tx) => {
      const rank = await tx.answer.count({ where: { questionId: qid } }) + 1;
      return tx.answer.create({
        data: {
          teamId: session.teamId,
          questionId: qid,
          selectedOptions: '[]',
          isCorrect,
          score,
          answerRank: rank,
          codeSubmission: code,
          language,
          testsPassed,
          testsTotal,
        },
      });
    });

    // Live state update
    const liveState = getLiveState();
    if (liveState.currentQuestion?.id === qid) {
      updateLiveState({
        fastestAnswers: [
          ...liveState.fastestAnswers,
          { rank: answer.answerRank, teamName: session.teamName, isCorrect, testsPassed, testsTotal, submittedAt: answer.submittedAt },
        ].sort((a, b) => a.rank - b.rank),
        submittedTeamIds: [...(liveState.submittedTeamIds || []), session.teamId],
      });
    }

    emitToAll('answer:submitted', {
      questionId: qid,
      teamId: session.teamId,
      teamName: session.teamName,
      isCorrect,
      testsPassed,
      testsTotal,
      rank: answer.answerRank,
      submittedAt: answer.submittedAt,
    });

    // Return results (hiding hidden test case details)
    const publicResults = testResults.map((r, i) => ({
      passed: r.passed,
      ...(question.testCases[i]?.isHidden
        ? { hidden: true }
        : { input: r.input, expectedOutput: r.expectedOutput, actualOutput: r.actualOutput, stderr: r.stderr }),
    }));

    return NextResponse.json({ isCorrect, score, testsPassed, testsTotal, testResults: publicResults });
  }

  // ── MCQ question ──────────────────────────────────────────────────────────
  const { selectedOptions } = body;
  const selected = (Array.isArray(selectedOptions) ? selectedOptions : [selectedOptions])
    .map(Number).filter(Boolean);
  if (!selected.length) return NextResponse.json({ error: 'No option selected' }, { status: 400 });

  const correctOptions = await prisma.option.findMany({ where: { questionId: qid, isCorrect: true } });
  const correct = correctOptions.map(o => o.id);
  const isCorrect =
    correct.length === selected.length &&
    correct.every(id => selected.includes(id)) &&
    selected.every(id => correct.includes(id));

  const score = isCorrect ? question.quiz.pointsPerQuestion : 0;

  const answer = await prisma.$transaction(async (tx) => {
    const rank = await tx.answer.count({ where: { questionId: qid } }) + 1;
    return tx.answer.create({
      data: {
        teamId: session.teamId,
        questionId: qid,
        selectedOptions: JSON.stringify(selected),
        isCorrect,
        score,
        answerRank: rank,
      },
    });
  });

  const liveState = getLiveState();
  if (liveState.currentQuestion?.id === qid) {
    updateLiveState({
      fastestAnswers: [
        ...liveState.fastestAnswers,
        { rank: answer.answerRank, teamName: session.teamName, isCorrect, submittedAt: answer.submittedAt },
      ].sort((a, b) => a.rank - b.rank),
      submittedTeamIds: [...(liveState.submittedTeamIds || []), session.teamId],
    });
  }

  emitToAll('answer:submitted', {
    questionId: qid,
    teamId: session.teamId,
    teamName: session.teamName,
    isCorrect,
    rank: answer.answerRank,
    submittedAt: answer.submittedAt,
  });

  const allAnswers = await prisma.answer.findMany({ where: { questionId: qid } });
  const countMap = {};
  for (const a of allAnswers) {
    try { for (const id of JSON.parse(a.selectedOptions)) countMap[id] = (countMap[id] || 0) + 1; } catch {}
  }

  return NextResponse.json({
    isCorrect,
    score,
    correctOptions: correct,
    optionStats: countMap,
    totalAnswered: allAnswers.length,
  });
}
