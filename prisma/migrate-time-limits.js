/**
 * One-time migration for existing deployments:
 * Previously quiz/section `time_limit_seconds` meant "default per-question time".
 * Now that field is the session budget, and defaults live in
 * `default_question_time_seconds`.
 *
 * Safe to re-run: only copies when default is null and session limit is set.
 *
 * Usage: node prisma/migrate-time-limits.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const quizzes = await prisma.quiz.findMany();
  let quizMoved = 0;
  for (const q of quizzes) {
    if (q.timeLimitSeconds != null && q.defaultQuestionTimeSeconds == null) {
      await prisma.quiz.update({
        where: { id: q.id },
        data: {
          defaultQuestionTimeSeconds: q.timeLimitSeconds,
          timeLimitSeconds: null,
          timeEnforcement: 'QUESTION',
        },
      });
      quizMoved++;
      console.log(`Quiz #${q.id} "${q.title}": moved ${q.timeLimitSeconds}s → defaultQuestionTimeSeconds`);
    }
  }

  const sections = await prisma.section.findMany();
  let sectionMoved = 0;
  for (const s of sections) {
    if (s.timeLimitSeconds != null && s.defaultQuestionTimeSeconds == null) {
      await prisma.section.update({
        where: { id: s.id },
        data: {
          defaultQuestionTimeSeconds: s.timeLimitSeconds,
          timeLimitSeconds: null,
        },
      });
      sectionMoved++;
      console.log(`Section #${s.id} "${s.name}": moved ${s.timeLimitSeconds}s → defaultQuestionTimeSeconds`);
    }
  }

  console.log(`Done. Migrated ${quizMoved} quizzes, ${sectionMoved} sections.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
