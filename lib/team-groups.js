import prisma from '@/lib/prisma';

/** True if team can attempt this quiz (no group restriction, or team is in an assigned group). */
export function teamCanAccessQuiz(team, quizWithGroups) {
  const assigned = quizWithGroups?.teamGroups || [];
  if (!assigned.length) return true;
  if (!team?.groupId) return false;
  return assigned.some(g => g.groupId === team.groupId || g.group?.id === team.groupId);
}

export async function getAccessibleActiveQuizzes(teamId) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, groupId: true, isBanned: true },
  });
  if (!team || team.isBanned) return { team: null, quizzes: [] };

  const quizzes = await prisma.quiz.findMany({
    where: { isActive: true, isDisabled: false },
    include: { teamGroups: { select: { groupId: true } } },
    orderBy: { id: 'asc' },
  });

  return {
    team,
    quizzes: quizzes.filter(q => teamCanAccessQuiz(team, q)),
  };
}

export async function assertTeamCanAccessQuestion(teamId, question) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, groupId: true, isBanned: true },
  });
  if (!team || team.isBanned) return { ok: false, status: 403, error: 'Access denied' };

  const quiz = await prisma.quiz.findUnique({
    where: { id: question.quizId },
    include: { teamGroups: { select: { groupId: true } } },
  });
  if (!quiz || quiz.isDisabled) return { ok: false, status: 403, error: 'Quiz is currently disabled' };
  if (!quiz.isActive) return { ok: false, status: 403, error: 'Quiz is not active' };
  if (!teamCanAccessQuiz(team, quiz)) {
    return { ok: false, status: 403, error: 'Your team group cannot attempt this quiz' };
  }
  return { ok: true, team, quiz };
}

export async function findOrCreateGroupByName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Group name required');
  const existing = await prisma.teamGroup.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) return existing;
  return prisma.teamGroup.create({ data: { name: trimmed } });
}
