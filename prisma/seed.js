const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.setting.createMany({
    data: [
      { key: 'admin_password', value: 'admin123' },
      { key: 'contest_end_time', value: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() },
      { key: 'contest_start_time', value: '' },
      { key: 'points_per_question', value: '10' },
      { key: 'allow_late_submit', value: 'false' },
      { key: 'team_login_enabled', value: 'true' },
      { key: 'arena_tagline', value: 'Live quiz arena for teams. Answer fast, code clean, climb the board.' },
      { key: 'login_banner', value: '' },
    ],
    skipDuplicates: true,
  });
  console.log('Seeded default settings.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
