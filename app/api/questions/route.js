import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/session';
import prisma from '@/lib/prisma';
import { getAccessibleActiveQuizzes } from '@/lib/team-groups';

export async function GET() {
  const session = await requireTeam();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { team, quizzes } = await getAccessibleActiveQuizzes(session.teamId);
  if (!team) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  if (!quizzes.length) return NextResponse.json([]);

  const quizIds = quizzes.map(q => q.id);
  const quizTitleById = Object.fromEntries(quizzes.map(q => [q.id, q.title]));

  const questions = await prisma.question.findMany({
    where: {
      quizId: { in: quizIds },
      isReleased: true,
      OR: [
        { sectionId: null },
        { section: { isEnabled: true } },
      ],
    },
    include: { section: { select: { id: true, name: true } } },
    orderBy: [{ quizId: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
  });

  const answers = await prisma.answer.findMany({ where: { teamId: session.teamId } });
  const answerMap = Object.fromEntries(answers.map(a => [a.questionId, a]));

  return NextResponse.json(questions.map(q => ({
    id: q.id,
    title: q.title,
    quizId: q.quizId,
    quizTitle: quizTitleById[q.quizId] || null,
    isMultiAnswer: q.isMultiAnswer,
    sectionId: q.sectionId,
    sectionName: q.section?.name ?? null,
    answered: !!answerMap[q.id],
    isCorrect: answerMap[q.id] ? answerMap[q.id].isCorrect : null,
    score: answerMap[q.id] ? answerMap[q.id].score : null,
  })));
}
