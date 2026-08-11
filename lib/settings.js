import prisma from '@/lib/prisma';

export const SETTING_DEFAULTS = {
  admin_password: 'admin123',
  contest_end_time: '',
  contest_start_time: '',
  points_per_question: '10',
  allow_late_submit: 'false',
  team_login_enabled: 'true',
  arena_tagline: 'Live quiz arena for teams. Answer fast, code clean, climb the board.',
  login_banner: '',
};

export async function getSettingsMap() {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map(s => [s.key, s.value]));
}

export async function getSetting(key, fallback) {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (row?.value !== undefined && row?.value !== null) return row.value;
  if (fallback !== undefined) return fallback;
  return SETTING_DEFAULTS[key] ?? null;
}

export function asBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true' || value === '1' || value === true;
}

export async function upsertSetting(key, value) {
  const v = value === null || value === undefined ? '' : String(value);
  await prisma.setting.upsert({
    where: { key },
    update: { value: v },
    create: { key, value: v },
  });
}

export async function upsertSettings(entries) {
  await Promise.all(Object.entries(entries).map(([key, value]) => upsertSetting(key, value)));
}

/** Returns true if submissions should be blocked because contest has ended. */
export async function isContestClosedForSubmit() {
  const map = await getSettingsMap();
  const end = map.contest_end_time;
  if (!end) return false;
  const endMs = new Date(end).getTime();
  if (Number.isNaN(endMs) || Date.now() < endMs) return false;
  return !asBool(map.allow_late_submit, false);
}
