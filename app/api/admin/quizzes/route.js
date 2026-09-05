import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { getSetting } from '@/lib/settings';
import { parseOptionalSeconds, parseTimeEnforcement } from '@/lib/time-limits';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const quizzes = await prisma.quiz.findMany({
    include: {
      _count: { select: { questions: true } },
      teamGroups: { include: { group: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(quizzes.map(q => ({
    id: q.id,
    title: q.title,
    description: q.description,
    isActive: q.isActive,
    isDisabled: q.isDisabled,
    pointsPerQuestion: q.pointsPerQuestion,
    timeLimitSeconds: q.timeLimitSeconds,
    defaultQuestionTimeSeconds: q.defaultQuestionTimeSeconds,
    timeEnforcement: q.timeEnforcement,
    sessionStartedAt: q.sessionStartedAt,
    createdAt: q.createdAt,
    questionCount: q._count.questions,
    groupIds: q.teamGroups.map(tg => tg.groupId),
    groups: q.teamGroups.map(tg => ({ id: tg.group.id, name: tg.group.name })),
  })));
}

export async function POST(request) {
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
    groupIds,
  } = body;
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const defaultPoints = parseInt(await getSetting('points_per_question', '10')) || 10;
  const ids = Array.isArray(groupIds)
    ? [...new Set(groupIds.map(id => parseInt(id)).filter(n => Number.isFinite(n)))]
    : [];

  const enforcement = parseTimeEnforcement(timeEnforcement) || 'QUESTION';

  const quiz = await prisma.quiz.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      pointsPerQuestion: parseInt(pointsPerQuestion) || defaultPoints,
      timeLimitSeconds: parseOptionalSeconds(timeLimitSeconds) ?? null,
      defaultQuestionTimeSeconds: parseOptionalSeconds(defaultQuestionTimeSeconds) ?? null,
      timeEnforcement: enforcement,
      ...(ids.length
        ? { teamGroups: { create: ids.map(groupId => ({ groupId })) } }
        : {}),
    },
  });

  return NextResponse.json({
    id: quiz.id,
    title: quiz.title,
    timeLimitSeconds: quiz.timeLimitSeconds,
    defaultQuestionTimeSeconds: quiz.defaultQuestionTimeSeconds,
    timeEnforcement: quiz.timeEnforcement,
  });
}
