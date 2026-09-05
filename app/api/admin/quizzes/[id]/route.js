import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { getLiveState, updateLiveState, emitToAll } from '@/lib/socket-emitter';
import { parseOptionalSeconds, parseTimeEnforcement } from '@/lib/time-limits';
import { clearQuizSession, cancelQuizSessionExpiry } from '@/lib/question-timer';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    title,
    description,
    pointsPerQuestion,
    timeLimitSeconds,
    defaultQuestionTimeSeconds,
    timeEnforcement,
    isDisabled,
    isActive,
    groupIds,
    resetSession,
  } = body;
  const data = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (pointsPerQuestion !== undefined) data.pointsPerQuestion = parseInt(pointsPerQuestion) || 10;
  if (timeLimitSeconds !== undefined) {
    data.timeLimitSeconds = parseOptionalSeconds(timeLimitSeconds);
  }
  if (defaultQuestionTimeSeconds !== undefined) {
    data.defaultQuestionTimeSeconds = parseOptionalSeconds(defaultQuestionTimeSeconds);
  }
  if (timeEnforcement !== undefined) {
    const enforcement = parseTimeEnforcement(timeEnforcement);
    if (enforcement) data.timeEnforcement = enforcement;
  }
  if (isDisabled !== undefined) data.isDisabled = !!isDisabled;
  if (isActive !== undefined) data.isActive = !!isActive;

  const quizId = parseInt(params.id);

  // Disabling a quiz also clears active so Live/contestants don't keep using it
  if (data.isDisabled === true) {
    data.isActive = false;
  }

  if (resetSession || data.isActive === false || data.isDisabled === true) {
    data.sessionStartedAt = null;
    await clearQuizSession(quizId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (groupIds !== undefined) {
      const ids = Array.isArray(groupIds)
        ? [...new Set(groupIds.map(id => parseInt(id)).filter(n => Number.isFinite(n)))]
        : [];
      await tx.quizTeamGroup.deleteMany({ where: { quizId } });
      if (ids.length) {
        await tx.quizTeamGroup.createMany({
          data: ids.map(groupId => ({ quizId, groupId })),
          skipDuplicates: true,
        });
      }
    }
    return tx.quiz.update({ where: { id: quizId }, data });
  });

  if (data.isDisabled === true || data.isActive === false) {
    cancelQuizSessionExpiry(quizId);
    const live = getLiveState();
    if (live.activeQuizId === quizId) {
      updateLiveState({
        activeQuizId: null,
        activeQuizTitle: null,
        timeLimitSeconds: null,
        defaultQuestionTimeSeconds: null,
        timeEnforcement: null,
        quizSessionStartedAt: null,
        quizSessionExpired: false,
        currentQuestion: null,
        showResults: false,
        resultStats: null,
        fastestAnswers: [],
        submittedTeamIds: [],
      });
      emitToAll('quiz:activated', {
        quizId: null,
        title: null,
        timeLimitSeconds: null,
        defaultQuestionTimeSeconds: null,
        timeEnforcement: null,
        sessionStartedAt: null,
      });
    }
  }

  return NextResponse.json({
    success: true,
    isActive: updated.isActive,
    isDisabled: updated.isDisabled,
    timeLimitSeconds: updated.timeLimitSeconds,
    defaultQuestionTimeSeconds: updated.defaultQuestionTimeSeconds,
    timeEnforcement: updated.timeEnforcement,
    sessionStartedAt: updated.sessionStartedAt,
  });
}

export async function DELETE(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const quizId = parseInt(params.id);
  cancelQuizSessionExpiry(quizId);
  await prisma.quiz.delete({ where: { id: quizId } });
  return NextResponse.json({ success: true });
}
