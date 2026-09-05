import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import { parseOptionalSeconds } from '@/lib/time-limits';
import { scheduleQuestionTiming, cancelAutoSubmit, cancelSectionSessionExpiry } from '@/lib/question-timer';

export async function PUT(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = parseInt(params.id);
  const body = await request.json();
  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.isEnabled !== undefined) data.isEnabled = !!body.isEnabled;
  if (body.timeLimitSeconds !== undefined) {
    data.timeLimitSeconds = parseOptionalSeconds(body.timeLimitSeconds);
  }
  if (body.defaultQuestionTimeSeconds !== undefined) {
    data.defaultQuestionTimeSeconds = parseOptionalSeconds(body.defaultQuestionTimeSeconds);
  }
  if (body.resetSession) {
    data.sessionStartedAt = null;
    cancelSectionSessionExpiry(id);
  }

  // Bulk release/unrelease all questions in section
  if (body.releaseAll !== undefined) {
    const release = !!body.releaseAll;
    if (release) {
      const now = new Date();
      const section = await prisma.section.findUnique({ where: { id } });
      if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      // Start section session if it has a budget
      if (section.timeLimitSeconds && !section.sessionStartedAt) {
        await prisma.section.update({
          where: { id },
          data: { sessionStartedAt: now },
        });
      }

      await prisma.question.updateMany({
        where: { sectionId: id },
        data: { isReleased: true, releasedAt: now },
      });

      const questions = await prisma.question.findMany({
        where: { sectionId: id },
        select: { id: true },
      });
      for (const q of questions) {
        await scheduleQuestionTiming(q.id);
      }
    } else {
      const questions = await prisma.question.findMany({
        where: { sectionId: id },
        select: { id: true },
      });
      for (const q of questions) cancelAutoSubmit(q.id);
      await prisma.question.updateMany({
        where: { sectionId: id },
        data: { isReleased: false, releasedAt: null },
      });
    }
    return NextResponse.json({ success: true });
  }

  const section = await prisma.section.update({ where: { id }, data });
  return NextResponse.json({
    id: section.id,
    name: section.name,
    isEnabled: section.isEnabled,
    timeLimitSeconds: section.timeLimitSeconds,
    defaultQuestionTimeSeconds: section.defaultQuestionTimeSeconds,
    sessionStartedAt: section.sessionStartedAt,
  });
}

export async function DELETE(request, { params }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = parseInt(params.id);
  cancelSectionSessionExpiry(id);
  await prisma.question.updateMany({ where: { sectionId: id }, data: { sectionId: null } });
  await prisma.section.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
