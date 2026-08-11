import { NextResponse } from 'next/server';
import { requireTeam } from '@/lib/session';
import prisma from '@/lib/prisma';
import { runTestCases } from '@/lib/execute-code';
import { assertTeamCanAccessQuestion } from '@/lib/team-groups';

export async function POST(request, { params }) {
  const session = await requireTeam();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code, language } = await request.json();
  const qid = parseInt(params.id);

  if (!code || !language) return NextResponse.json({ error: 'code and language required' }, { status: 400 });

  const question = await prisma.question.findUnique({
    where: { id: qid },
    include: {
      testCases: { where: { isHidden: false }, orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!question || !question.isReleased) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = await assertTeamCanAccessQuestion(session.teamId, question);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  if (question.type !== 'CODING') return NextResponse.json({ error: 'Not a coding question' }, { status: 400 });

  let allowedLanguages;
  try { allowedLanguages = JSON.parse(question.allowedLanguages); } catch { allowedLanguages = ['javascript', 'python']; }
  if (!allowedLanguages.includes(language)) {
    return NextResponse.json({ error: 'Language not allowed for this question' }, { status: 400 });
  }

  if (question.testCases.length === 0) {
    return NextResponse.json({ results: [], message: 'No visible test cases for this question' });
  }

  try {
    const results = await runTestCases(language, code, question.testCases);
    const passed = results.filter(r => r.passed).length;
    return NextResponse.json({ results, passed, total: results.length });
  } catch (err) {
    return NextResponse.json({ error: 'Execution failed: ' + err.message }, { status: 500 });
  }
}
