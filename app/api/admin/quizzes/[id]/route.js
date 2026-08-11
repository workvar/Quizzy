import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { getLiveState, updateLiveState, emitToAll } from '@/lib/socket-emitter';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, pointsPerQuestion, timeLimitSeconds, isDisabled, isActive, groupIds } = await request.json();
  const data = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (pointsPerQuestion !== undefined) data.pointsPerQuestion = parseInt(pointsPerQuestion) || 10;
  if (timeLimitSeconds !== undefined) {
    data.timeLimitSeconds = timeLimitSeconds ? parseInt(timeLimitSeconds) : null;
  }
  if (isDisabled !== undefined) data.isDisabled = !!isDisabled;
  if (isActive !== undefined) data.isActive = !!isActive;

  const quizId = parseInt(params.id);

  // Disabling a quiz also clears active so Live/contestants don't keep using it
  if (data.isDisabled === true) {
    data.isActive = false;
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
    const live = getLiveState();
    if (live.activeQuizId === quizId) {
      updateLiveState({
        activeQuizId: null,
        activeQuizTitle: null,
        timeLimitSeconds: null,
        currentQuestion: null,
        showResults: false,
        resultStats: null,
        fastestAnswers: [],
        submittedTeamIds: [],
      });
      emitToAll('quiz:activated', { quizId: null, title: null, timeLimitSeconds: null });
    }
  }

  return NextResponse.json({ success: true, isActive: updated.isActive, isDisabled: updated.isDisabled });
}

export async function DELETE(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.quiz.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ success: true });
}
