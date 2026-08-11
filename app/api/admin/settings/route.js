import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import prisma from '@/lib/prisma';
import {
  SETTING_DEFAULTS,
  asBool,
  getSettingsMap,
  upsertSettings,
} from '@/lib/settings';

function publicSettings(map) {
  return {
    contestEndTime: map.contest_end_time ?? SETTING_DEFAULTS.contest_end_time,
    contestStartTime: map.contest_start_time ?? SETTING_DEFAULTS.contest_start_time,
    pointsPerQuestion: map.points_per_question ?? SETTING_DEFAULTS.points_per_question,
    allowLateSubmit: asBool(map.allow_late_submit, false),
    teamLoginEnabled: asBool(map.team_login_enabled, true),
    arenaTagline: map.arena_tagline ?? SETTING_DEFAULTS.arena_tagline,
    loginBanner: map.login_banner ?? SETTING_DEFAULTS.login_banner,
    hasAdminPassword: Boolean(map.admin_password),
  };
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const map = await getSettingsMap();

  const [teamCount, bannedCount, quizCount, activeQuiz, questionCount, answerCount] = await Promise.all([
    prisma.team.count(),
    prisma.team.count({ where: { isBanned: true } }),
    prisma.quiz.count(),
    prisma.quiz.findFirst({ where: { isActive: true, isDisabled: false }, select: { id: true, title: true } }),
    prisma.question.count(),
    prisma.answer.count(),
  ]);

  return NextResponse.json({
    ...publicSettings(map),
    stats: {
      teams: teamCount,
      bannedTeams: bannedCount,
      quizzes: quizCount,
      activeQuizTitle: activeQuiz?.title ?? null,
      activeQuizId: activeQuiz?.id ?? null,
      questions: questionCount,
      answers: answerCount,
    },
    pistonUrl: process.env.PISTON_URL || 'http://localhost:2000',
  });
}

export async function PUT(request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    adminPassword,
    contestEndTime,
    contestStartTime,
    pointsPerQuestion,
    allowLateSubmit,
    teamLoginEnabled,
    arenaTagline,
    loginBanner,
    action,
  } = body;

  // Quick actions
  if (action === 'endContestNow') {
    await upsertSettings({ contest_end_time: new Date().toISOString() });
    const map = await getSettingsMap();
    return NextResponse.json({ success: true, ...publicSettings(map) });
  }
  if (action === 'extendContest') {
    const minutes = Math.min(Math.max(parseInt(body.minutes) || 30, 5), 24 * 60);
    const map = await getSettingsMap();
    const currentEnd = map.contest_end_time ? new Date(map.contest_end_time).getTime() : Date.now();
    const base = Number.isNaN(currentEnd) || currentEnd < Date.now() ? Date.now() : currentEnd;
    await upsertSettings({ contest_end_time: new Date(base + minutes * 60 * 1000).toISOString() });
    const next = await getSettingsMap();
    return NextResponse.json({ success: true, ...publicSettings(next) });
  }
  if (action === 'clearContestEnd') {
    await upsertSettings({ contest_end_time: '' });
    const map = await getSettingsMap();
    return NextResponse.json({ success: true, ...publicSettings(map) });
  }
  if (action === 'checkPiston') {
    const base = process.env.PISTON_URL || 'http://localhost:2000';
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${base.replace(/\/$/, '')}/api/v2/runtimes`, { signal: controller.signal });
      clearTimeout(t);
      const ok = res.ok;
      let runtimeCount = 0;
      if (ok) {
        try {
          const data = await res.json();
          runtimeCount = Array.isArray(data) ? data.length : 0;
        } catch {}
      }
      return NextResponse.json({
        success: ok,
        ok,
        status: res.status,
        runtimeCount,
        pistonUrl: base,
      });
    } catch (err) {
      return NextResponse.json({
        success: false,
        ok: false,
        error: err.name === 'AbortError' ? 'Timed out' : (err.message || 'Unreachable'),
        pistonUrl: base,
      });
    }
  }
  if (action === 'unreleaseAllActive') {
    const active = await prisma.quiz.findFirst({ where: { isActive: true } });
    if (!active) return NextResponse.json({ error: 'No active quiz' }, { status: 400 });
    const result = await prisma.question.updateMany({
      where: { quizId: active.id, isReleased: true },
      data: { isReleased: false, releasedAt: null },
    });
    return NextResponse.json({ success: true, updated: result.count });
  }
  if (action === 'clearAnswersActive') {
    const active = await prisma.quiz.findFirst({ where: { isActive: true } });
    if (!active) return NextResponse.json({ error: 'No active quiz' }, { status: 400 });
    const qids = (await prisma.question.findMany({ where: { quizId: active.id }, select: { id: true } })).map(q => q.id);
    if (!qids.length) return NextResponse.json({ success: true, deleted: 0 });
    const result = await prisma.answer.deleteMany({ where: { questionId: { in: qids } } });
    return NextResponse.json({ success: true, deleted: result.count });
  }

  const entries = {};
  if (adminPassword) {
    if (String(adminPassword).length < 4) {
      return NextResponse.json({ error: 'Admin password must be at least 4 characters' }, { status: 400 });
    }
    entries.admin_password = adminPassword;
  }
  if (contestEndTime !== undefined) {
    entries.contest_end_time = contestEndTime ? new Date(contestEndTime).toISOString() : '';
  }
  if (contestStartTime !== undefined) {
    entries.contest_start_time = contestStartTime ? new Date(contestStartTime).toISOString() : '';
  }
  if (pointsPerQuestion !== undefined) {
    const pts = parseInt(pointsPerQuestion);
    if (!pts || pts < 1 || pts > 1000) {
      return NextResponse.json({ error: 'Points per question must be 1–1000' }, { status: 400 });
    }
    entries.points_per_question = String(pts);
  }
  if (allowLateSubmit !== undefined) entries.allow_late_submit = asBool(allowLateSubmit) ? 'true' : 'false';
  if (teamLoginEnabled !== undefined) entries.team_login_enabled = asBool(teamLoginEnabled) ? 'true' : 'false';
  if (arenaTagline !== undefined) entries.arena_tagline = String(arenaTagline).slice(0, 240);
  if (loginBanner !== undefined) entries.login_banner = String(loginBanner).slice(0, 280);

  if (!Object.keys(entries).length) {
    return NextResponse.json({ error: 'No settings to update' }, { status: 400 });
  }

  await upsertSettings(entries);
  const map = await getSettingsMap();
  return NextResponse.json({ success: true, ...publicSettings(map) });
}
