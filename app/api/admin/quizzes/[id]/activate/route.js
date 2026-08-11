import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { emitToAll, updateLiveState } from '@/lib/socket-emitter';

export async function POST(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const quizId = parseInt(params.id);
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  if (quiz.isDisabled) {
    return NextResponse.json({ error: 'Enable the quiz before activating it for live' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.quiz.updateMany({ data: { isActive: false } }),
    prisma.quiz.update({ where: { id: quizId }, data: { isActive: true } }),
  ]);

  const teams = await prisma.team.findMany({
    where: { isBanned: false },
    select: { id: true, name: true },
  });

  updateLiveState({
    activeQuizId: quizId,
    activeQuizTitle: quiz.title,
    timeLimitSeconds: quiz.timeLimitSeconds,
    currentQuestion: null,
    showResults: false,
    resultStats: null,
    fastestAnswers: [],
    allTeams: teams,
    submittedTeamIds: [],
  });

  emitToAll('quiz:activated', { quizId, title: quiz.title, timeLimitSeconds: quiz.timeLimitSeconds });

  return NextResponse.json({ success: true });
}
