import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groupId = parseInt(params.id);
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  try {
    const group = await prisma.teamGroup.update({
      where: { id: groupId },
      data: { name: name.trim() },
    });
    return NextResponse.json({ id: group.id, name: group.name });
  } catch {
    return NextResponse.json({ error: 'Group name already exists or not found' }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.teamGroup.delete({ where: { id: parseInt(params.id) } });
  return NextResponse.json({ success: true });
}
