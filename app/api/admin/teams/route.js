import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const teams = await prisma.team.findMany({
    include: {
      answers: { select: { score: true, isCorrect: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(teams.map(team => ({
    id: team.id,
    name: team.name,
    isBanned: team.isBanned,
    groupId: team.groupId,
    groupName: team.group?.name ?? null,
    createdAt: team.createdAt,
    total_score: team.answers.reduce((sum, a) => sum + a.score, 0),
    correct_count: team.answers.filter(a => a.isCorrect).length,
    attempted_count: team.answers.length,
  })));
}

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, password, groupId } = await request.json();
  if (!name || !password) return NextResponse.json({ error: 'Name and password required' }, { status: 400 });

  const data = { name: name.trim(), password };
  if (groupId !== undefined && groupId !== null && groupId !== '') {
    data.groupId = parseInt(groupId);
  }

  try {
    const team = await prisma.team.create({ data });
    return NextResponse.json({ id: team.id });
  } catch {
    return NextResponse.json({ error: 'Team name already exists' }, { status: 400 });
  }
}

export async function DELETE(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  await prisma.team.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
