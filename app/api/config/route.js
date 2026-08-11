import { NextResponse } from 'next/server';
import { SETTING_DEFAULTS, asBool, getSettingsMap } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const map = await getSettingsMap();
  return NextResponse.json({
    contestEndTime: map.contest_end_time || null,
    contestStartTime: map.contest_start_time || null,
    arenaTagline: map.arena_tagline || SETTING_DEFAULTS.arena_tagline,
    loginBanner: map.login_banner || '',
    teamLoginEnabled: asBool(map.team_login_enabled, true),
  });
}
