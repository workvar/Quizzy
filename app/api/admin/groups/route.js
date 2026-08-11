import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { findOrCreateGroupByName } from '@/lib/team-groups';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await prisma.teamGroup.findMany({
    include: { _count: { select: { teams: true, quizzes: true } } },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(groups.map(g => ({
    id: g.id,
    name: g.name,
    createdAt: g.createdAt,
    teamCount: g._count.teams,
    quizCount: g._count.quizzes,
  })));
}

export async function POST(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  try {
    const group = await findOrCreateGroupByName(name);
    return NextResponse.json({ id: group.id, name: group.name, created: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to create group' }, { status: 400 });
  }
}

export async function DELETE(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  const groupId = parseInt(id);
  if (!groupId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.teamGroup.delete({ where: { id: groupId } });
  return NextResponse.json({ success: true });
}
