import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const teamId = parseInt(params.id);
  const body = await request.json();
  const data = {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    data.name = String(body.name).trim();
  }
  if (body.password !== undefined && body.password !== '') {
    data.password = String(body.password);
  }
  if (body.groupId !== undefined) {
    if (body.groupId === null || body.groupId === '' || body.groupId === '__none__') {
      data.groupId = null;
    } else {
      data.groupId = parseInt(body.groupId);
    }
  }

  try {
    const team = await prisma.team.update({ where: { id: teamId }, data });
    return NextResponse.json({ id: team.id, groupId: team.groupId });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 400 });
  }
}
