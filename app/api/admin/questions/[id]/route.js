import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import emitter from '@/lib/notifications';
import { emitToAll, getLiveState, updateLiveState } from '@/lib/socket-emitter';
import { scheduleQuestionTiming, cancelAutoSubmit } from '@/lib/question-timer';
import { computeTiming } from '@/lib/time-limits';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const qid = parseInt(params.id);

  const before = await prisma.question.findUnique({
    where: { id: qid },
    include: { quiz: true, section: true },
  });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isReleasing = body.isReleased === true && !before.isReleased;

  // Block release if timed and a previous question's timer is still running
  if (isReleasing) {
    const activeTimed = await prisma.question.findFirst({
      where: {
        quizId: before.quizId,
        isReleased: true,
        id: { not: qid },
        releasedAt: { not: null },
      },
      orderBy: { releasedAt: 'desc' },
      include: { section: true, quiz: true },
    });
    if (activeTimed) {
      const activeTiming = computeTiming({
        question: activeTimed,
        section: activeTimed.section,
        quiz: activeTimed.quiz || before.quiz,
      });
      if (activeTiming.effectiveExpiresAt && Date.now() < activeTiming.effectiveExpiresAt) {
        const secsLeft = Math.ceil((activeTiming.effectiveExpiresAt - Date.now()) / 1000);
        const [teams, answers] = await Promise.all([
          prisma.team.count({ where: { isBanned: false } }),
          prisma.answer.count({ where: { questionId: activeTimed.id } }),
        ]);
        const pending = teams - answers;
        if (pending > 0) {
          return NextResponse.json({
            error: `Cannot release: ${pending} team${pending !== 1 ? 's' : ''} haven't submitted yet (${secsLeft}s left)`,
            blocked: true,
          }, { status: 409 });
        }
      }
    }
  }

  const data = {};
  if (body.isReleased !== undefined) data.isReleased = !!body.isReleased;
  if (isReleasing) data.releasedAt = new Date();
  if (body.isReleased === false) data.releasedAt = null;
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) data.content = body.content;
  if (body.isMultiAnswer !== undefined) data.isMultiAnswer = !!body.isMultiAnswer;
  if (body.timeLimitSeconds !== undefined) {
    data.timeLimitSeconds = body.timeLimitSeconds ? parseInt(body.timeLimitSeconds) : null;
  }
  if (body.sectionId !== undefined) {
    data.sectionId = body.sectionId ? parseInt(body.sectionId) : null;
  }
  if (body.starterCode !== undefined) data.starterCode = body.starterCode ? JSON.stringify(body.starterCode) : null;
  if (body.allowedLanguages !== undefined) data.allowedLanguages = JSON.stringify(body.allowedLanguages);

  const after = await prisma.question.update({ where: { id: qid }, data });

  // Handle option and test case edits (only for unreleased questions)
  if (!before.isReleased && body.options !== undefined) {
    await prisma.option.deleteMany({ where: { questionId: qid } });
    if (body.options?.length) {
      await prisma.option.createMany({
        data: body.options.map((opt, i) => ({
          questionId: qid, content: opt.content, isCorrect: !!opt.isCorrect, optionOrder: i,
        })),
      });
    }
  }
  if (!before.isReleased && body.testCases !== undefined) {
    await prisma.testCase.deleteMany({ where: { questionId: qid } });
    if (body.testCases?.length) {
      await prisma.testCase.createMany({
        data: body.testCases.map((tc, i) => ({
          questionId: qid, input: tc.input ?? '', expectedOutput: tc.expectedOutput ?? '',
          isHidden: !!tc.isHidden, orderIndex: i,
        })),
      });
    }
  }

  // Handle release → schedule auto-submit timer, notify live screen + contestants
  if (isReleasing) {
    const timing = await scheduleQuestionTiming(qid);

    emitter.emit('questionReleased', { type: 'questionReleased', id: after.id, title: after.title });

    // Update live state if this quiz is active on the live screen
    const live = getLiveState();
    if (live.activeQuizId === before.quizId) {
      const fresh = await prisma.question.findUnique({
        where: { id: qid },
        include: {
          options: { orderBy: { optionOrder: 'asc' } },
          quiz: true,
          section: true,
        },
      });
      if (fresh) {
        const t = timing || computeTiming({ question: fresh, section: fresh.section, quiz: fresh.quiz });
        const questionData = {
          id: qid,
          title: fresh.title,
          content: fresh.content,
          type: fresh.type,
          isMultiAnswer: fresh.isMultiAnswer,
          sectionName: fresh.section?.name ?? null,
          releasedAt: fresh.releasedAt?.toISOString() ?? null,
          timeLimitSeconds: t.effectiveLimitSeconds,
          questionTimeLimitSeconds: t.questionLimitSeconds,
          timing: {
            enforcement: t.enforcement,
            bindingSource: t.bindingSource,
            quizLimitSeconds: t.quizLimitSeconds,
            sectionLimitSeconds: t.sectionLimitSeconds,
            quizSessionStartedAt: fresh.quiz.sessionStartedAt?.toISOString() ?? null,
            sectionSessionStartedAt: fresh.section?.sessionStartedAt?.toISOString() ?? null,
          },
          options: fresh.type === 'MCQ' ? fresh.options.map(o => ({ id: o.id, content: o.content })) : [],
        };
        updateLiveState({
          currentQuestion: questionData,
          showResults: false,
          resultStats: null,
          quizSessionStartedAt: fresh.quiz.sessionStartedAt?.toISOString() ?? live.quizSessionStartedAt,
        });
        emitToAll('question:show', { question: questionData, fastestAnswers: [], allTeams: live.allTeams, submittedTeamIds: [] });
      }
    }
  } else if (before.isReleased && !after.isReleased) {
    cancelAutoSubmit(qid);
    emitter.emit('questionUnreleased', { type: 'questionUnreleased', id: after.id });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qid = parseInt(params.id);
  cancelAutoSubmit(qid);
  await prisma.question.delete({ where: { id: qid } });
  return NextResponse.json({ success: true });
}
