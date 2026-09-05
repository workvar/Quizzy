/**
 * Lightweight self-check for multi-level timing resolution.
 * Run: node scripts/check-time-limits.js
 */
import {
  computeTiming,
  resolveQuestionTimeLimit,
  TIME_ENFORCEMENT,
} from '../lib/time-limits.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const now = Date.parse('2026-01-01T12:00:00.000Z');
const releasedAt = new Date(now - 10_000); // released 10s ago
const quizStarted = new Date(now - 60_000); // quiz started 60s ago
const sectionStarted = new Date(now - 30_000);

// Cascade defaults
assert(resolveQuestionTimeLimit({ timeLimitSeconds: 30 }, { defaultQuestionTimeSeconds: 45 }, { defaultQuestionTimeSeconds: 60 }) === 30, 'question wins');
assert(resolveQuestionTimeLimit({}, { defaultQuestionTimeSeconds: 45 }, { defaultQuestionTimeSeconds: 60 }) === 45, 'section default');
assert(resolveQuestionTimeLimit({}, null, { defaultQuestionTimeSeconds: 60 }) === 60, 'quiz default');

// QUESTION enforcement: only question timer (50s limit, 10s elapsed → 40 left)
{
  const t = computeTiming({
    question: { timeLimitSeconds: 50, releasedAt },
    section: { timeLimitSeconds: 100, sessionStartedAt: sectionStarted },
    quiz: { timeLimitSeconds: 120, sessionStartedAt: quizStarted, timeEnforcement: TIME_ENFORCEMENT.QUESTION, defaultQuestionTimeSeconds: null },
    now,
  });
  assert(t.bindingSource === 'QUESTION', 'QUESTION binds to question');
  assert(t.timeRemaining === 40, `expected 40 got ${t.timeRemaining}`);
  assert(!t.isExpired, 'not expired');
}

// QUIZ enforcement: quiz 120s started 60s ago → 60 left; question has 40 left → quiz is later, question wins as min
{
  const t = computeTiming({
    question: { timeLimitSeconds: 50, releasedAt },
    section: null,
    quiz: { timeLimitSeconds: 120, sessionStartedAt: quizStarted, timeEnforcement: TIME_ENFORCEMENT.QUIZ },
    now,
  });
  assert(t.bindingSource === 'QUESTION', 'QUIZ mode still respects shorter question');
  assert(t.timeRemaining === 40, `expected 40 got ${t.timeRemaining}`);
}

// QUIZ enforcement: long question, short quiz remaining — quiz wins
{
  const t = computeTiming({
    question: { timeLimitSeconds: 500, releasedAt },
    section: null,
    quiz: { timeLimitSeconds: 90, sessionStartedAt: quizStarted, timeEnforcement: TIME_ENFORCEMENT.QUIZ },
    now,
  });
  // quiz: 90 - 60 = 30 left
  assert(t.bindingSource === 'QUIZ', `expected QUIZ got ${t.bindingSource}`);
  assert(t.timeRemaining === 30, `expected 30 got ${t.timeRemaining}`);
}

// SECTION enforcement
{
  const t = computeTiming({
    question: { timeLimitSeconds: 500, releasedAt },
    section: { timeLimitSeconds: 40, sessionStartedAt: sectionStarted },
    quiz: { timeLimitSeconds: 9999, sessionStartedAt: quizStarted, timeEnforcement: TIME_ENFORCEMENT.SECTION },
    now,
  });
  // section: 40 - 30 = 10 left
  assert(t.bindingSource === 'SECTION', `expected SECTION got ${t.bindingSource}`);
  assert(t.timeRemaining === 10, `expected 10 got ${t.timeRemaining}`);
}

// STRICTEST: earliest of all
{
  const t = computeTiming({
    question: { timeLimitSeconds: 500, releasedAt },
    section: { timeLimitSeconds: 40, sessionStartedAt: sectionStarted },
    quiz: { timeLimitSeconds: 70, sessionStartedAt: quizStarted, timeEnforcement: TIME_ENFORCEMENT.STRICTEST },
    now,
  });
  // quiz remaining 10, section remaining 10 — either is fine; both at same? quiz: 70-60=10, section: 40-30=10
  assert(t.timeRemaining === 10, `expected 10 got ${t.timeRemaining}`);
  assert(['SECTION', 'QUIZ'].includes(t.bindingSource), `unexpected ${t.bindingSource}`);
}

// Expired
{
  const t = computeTiming({
    question: { timeLimitSeconds: 5, releasedAt },
    section: null,
    quiz: { timeEnforcement: TIME_ENFORCEMENT.QUESTION },
    now,
  });
  assert(t.isExpired, 'should be expired');
  assert(t.timeRemaining === 0, 'remaining 0');
}

console.log('All time-limit checks passed.');
