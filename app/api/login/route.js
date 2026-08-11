import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { asBool, getSettingsMap } from '@/lib/settings';

export async function POST(request) {
  const { teamname, password } = await request.json();
  if (!teamname || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

  if (teamname.toLowerCase() === 'admin') {
    const setting = await prisma.setting.findUnique({ where: { key: 'admin_password' } });
    if (setting?.value === password) {
      const session = await getSession();
      session.isAdmin = true;
      session.teamId = null;
      session.teamName = null;
      await session.save();
      return NextResponse.json({ redirect: '/admin' });
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const map = await getSettingsMap();
  if (!asBool(map.team_login_enabled, true)) {
    return NextResponse.json({ error: 'Team login is currently disabled by the admin' }, { status: 403 });
  }

  const team = await prisma.team.findFirst({
    where: { name: { equals: teamname, mode: 'insensitive' } },
  });
  if (!team || team.password !== password)
    return NextResponse.json({ error: 'Invalid team name or password' }, { status: 401 });

  if (team.isBanned) {
    return NextResponse.json({ error: 'This team has been banned from the contest' }, { status: 403 });
  }

  const session = await getSession();
  session.teamId = team.id;
  session.teamName = team.name;
  session.isAdmin = false;
  await session.save();
  return NextResponse.json({ redirect: '/contestant' });
}
