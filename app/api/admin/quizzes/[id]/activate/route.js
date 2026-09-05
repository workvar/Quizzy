import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { emitToAll, updateLiveState } from '@/lib/socket-emitter';
import { startQuizSessionIfNeeded } from '@/lib/question-timer';

export async function POST(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const quizId = parseInt(params.id);
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { teamGroups: { select: { groupId: true } } },
  });
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (quiz.isDisabled) {
    return NextResponse.json({ error: 'Enable the quiz before activating it for live' }, { status: 400 });
  }

  // Allow multiple active quizzes so different team groups can run in parallel.
  // Live broadcast still focuses on the quiz being activated.
  await prisma.quiz.update({ where: { id: quizId }, data: { isActive: true } });

  // Start quiz session clock when a quiz duration is configured
  const withSession = await startQuizSessionIfNeeded(quizId);

  const groupIds = quiz.teamGroups.map(tg => tg.groupId);
  const teams = await prisma.team.findMany({
    where: {
      isBanned: false,
      ...(groupIds.length ? { groupId: { in: groupIds } } : {}),
    },
    select: { id: true, name: true },
  });

  const sessionStartedAt = withSession?.sessionStartedAt?.toISOString?.()
    ?? withSession?.sessionStartedAt
    ?? null;

  updateLiveState({
    activeQuizId: quizId,
    activeQuizTitle: quiz.title,
    timeLimitSeconds: quiz.timeLimitSeconds,
    defaultQuestionTimeSeconds: quiz.defaultQuestionTimeSeconds,
    timeEnforcement: quiz.timeEnforcement,
    quizSessionStartedAt: sessionStartedAt,
    quizSessionExpired: false,
    currentQuestion: null,
    showResults: false,
    resultStats: null,
    fastestAnswers: [],
    allTeams: teams,
    submittedTeamIds: [],
  });

  emitToAll('quiz:activated', {
    quizId,
    title: quiz.title,
    timeLimitSeconds: quiz.timeLimitSeconds,
    defaultQuestionTimeSeconds: quiz.defaultQuestionTimeSeconds,
    timeEnforcement: quiz.timeEnforcement,
    sessionStartedAt,
  });

  return NextResponse.json({
    success: true,
    sessionStartedAt,
    timeLimitSeconds: quiz.timeLimitSeconds,
    timeEnforcement: quiz.timeEnforcement,
  });
}
