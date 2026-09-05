/**
 * Multi-level quiz timing: question / section / quiz session budgets
 * with configurable enforcement of which maximum is binding.
 *
 * Semantics:
 * - Question time: answer window from question.releasedAt
 * - Section time: session budget from section.sessionStartedAt
 * - Quiz time: session budget from quiz.sessionStartedAt
 * - defaultQuestionTimeSeconds cascade: question → section → quiz
 *
 * Enforcement:
 * - QUESTION: only per-question timers bind
 * - SECTION: min(question, section session)
 * - QUIZ: min(question, quiz session)
 * - STRICTEST: min(question, section, quiz)
 */

export const TIME_ENFORCEMENT = {
  QUESTION: 'QUESTION',
  SECTION: 'SECTION',
  QUIZ: 'QUIZ',
  STRICTEST: 'STRICTEST',
};

/** Plain-language labels for the admin UI. */
export const TIME_ENFORCEMENT_OPTIONS = [
  {
    value: 'QUESTION',
    label: 'Only each question’s own timer',
    shortLabel: 'Questions only',
    hint: 'Ignore quiz/section totals. Each question runs until its own time is up.',
  },
  {
    value: 'SECTION',
    label: 'The section’s total time',
    shortLabel: 'Section total',
    hint: 'Cut off when the section’s total time runs out. Question timers still apply too.',
  },
  {
    value: 'QUIZ',
    label: 'The whole quiz’s total time',
    shortLabel: 'Quiz total',
    hint: 'Cut off when the quiz’s total time runs out — even if questions would add up to more. Example: 60 min quiz + 90 questions × 1 min → stops at 60 min.',
  },
  {
    value: 'STRICTEST',
    label: 'Whichever timer runs out first',
    shortLabel: 'Earliest timer',
    hint: 'Uses the earliest of: question timer, section total, or quiz total.',
  },
];

export function enforcementShortLabel(value) {
  return TIME_ENFORCEMENT_OPTIONS.find(o => o.value === value)?.shortLabel || value;
}

export function enforcementHint(value) {
  return TIME_ENFORCEMENT_OPTIONS.find(o => o.value === value)?.hint || '';
}

/** UI helpers: quiz/section totals are edited in minutes; stored as seconds. */
export function secondsToMinutesInput(seconds) {
  if (seconds == null || seconds === '') return '';
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '';
  // Prefer whole minutes when clean; otherwise one decimal
  return n % 60 === 0 ? String(n / 60) : String(Math.round((n / 60) * 10) / 10);
}

export function minutesInputToSeconds(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 60);
}

/** Per-question answer window (seconds), after cascade defaults. */
export function resolveQuestionTimeLimit(question, section, quiz) {
  if (question?.timeLimitSeconds != null) return question.timeLimitSeconds;
  if (section?.defaultQuestionTimeSeconds != null) return section.defaultQuestionTimeSeconds;
  if (quiz?.defaultQuestionTimeSeconds != null) return quiz.defaultQuestionTimeSeconds;
  return null;
}

function expiresAtFrom(start, limitSeconds) {
  if (!start || !limitSeconds) return null;
  return new Date(start).getTime() + limitSeconds * 1000;
}

/**
 * Compute all deadlines and the binding effective limit for a question.
 * @returns {{
 *   enforcement: string,
 *   questionLimitSeconds: number|null,
 *   questionExpiresAt: number|null,
 *   sectionLimitSeconds: number|null,
 *   sectionExpiresAt: number|null,
 *   quizLimitSeconds: number|null,
 *   quizExpiresAt: number|null,
 *   effectiveExpiresAt: number|null,
 *   effectiveLimitSeconds: number|null,
 *   bindingSource: 'QUESTION'|'SECTION'|'QUIZ'|null,
 *   timeRemaining: number|null,
 *   isExpired: boolean,
 * }}
 */
export function computeTiming({ question, section, quiz, now = Date.now(), alreadyAnswered = false }) {
  const enforcement = quiz?.timeEnforcement || TIME_ENFORCEMENT.QUESTION;
  const questionLimitSeconds = resolveQuestionTimeLimit(question, section, quiz);
  const questionExpiresAt = expiresAtFrom(question?.releasedAt, questionLimitSeconds);

  const sectionLimitSeconds = section?.timeLimitSeconds ?? null;
  const sectionExpiresAt = expiresAtFrom(section?.sessionStartedAt, sectionLimitSeconds);

  const quizLimitSeconds = quiz?.timeLimitSeconds ?? null;
  const quizExpiresAt = expiresAtFrom(quiz?.sessionStartedAt, quizLimitSeconds);

  const candidates = [];

  // Question timer always applies when set (except it is the only candidate in QUESTION mode).
  if (questionExpiresAt != null) {
    candidates.push({ source: 'QUESTION', at: questionExpiresAt, limit: questionLimitSeconds });
  }

  if (enforcement === TIME_ENFORCEMENT.SECTION || enforcement === TIME_ENFORCEMENT.STRICTEST) {
    if (sectionExpiresAt != null) {
      candidates.push({ source: 'SECTION', at: sectionExpiresAt, limit: sectionLimitSeconds });
    }
  }

  if (enforcement === TIME_ENFORCEMENT.QUIZ || enforcement === TIME_ENFORCEMENT.STRICTEST) {
    if (quizExpiresAt != null) {
      candidates.push({ source: 'QUIZ', at: quizExpiresAt, limit: quizLimitSeconds });
    }
  }

  // SECTION enforcement without a section session: still use question timer only.
  // QUIZ enforcement without quiz session: question timer only.
  // STRICTEST with only question: question only.

  let binding = null;
  if (candidates.length) {
    binding = candidates.reduce((best, c) => (c.at < best.at ? c : best));
  }

  let timeRemaining = null;
  let effectiveLimitSeconds = null;
  if (binding && question?.releasedAt && !alreadyAnswered) {
    timeRemaining = Math.max(0, Math.floor((binding.at - now) / 1000));
    // Effective display limit = seconds from question release to binding expiry
    const fromRelease = Math.max(0, Math.floor((binding.at - new Date(question.releasedAt).getTime()) / 1000));
    effectiveLimitSeconds = fromRelease;
  } else if (binding && !alreadyAnswered) {
    timeRemaining = Math.max(0, Math.floor((binding.at - now) / 1000));
    effectiveLimitSeconds = binding.limit;
  }

  return {
    enforcement,
    questionLimitSeconds,
    questionExpiresAt,
    sectionLimitSeconds,
    sectionExpiresAt,
    quizLimitSeconds,
    quizExpiresAt,
    effectiveExpiresAt: binding?.at ?? null,
    effectiveLimitSeconds,
    bindingSource: binding?.source ?? null,
    timeRemaining,
    isExpired: binding != null && now > binding.at,
  };
}

/** Delay (ms) until auto-submit should fire for this question, or null if untimed. */
export function autoSubmitDelayMs(timing, now = Date.now()) {
  if (timing.effectiveExpiresAt == null) return null;
  return Math.max(0, timing.effectiveExpiresAt - now);
}

/** Parse optional positive int seconds from request body; empty/invalid → null. */
export function parseOptionalSeconds(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '' || value === false) return null;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseTimeEnforcement(value) {
  if (!value) return undefined;
  const upper = String(value).toUpperCase();
  if (Object.values(TIME_ENFORCEMENT).includes(upper)) return upper;
  return undefined;
}

/** Format seconds for admin display (e.g. 90 → "1m 30s", 3600 → "1h"). */
export function formatDuration(seconds) {
  if (seconds == null) return null;
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) {
    if (m === 0 && rem === 0) return `${h}h`;
    if (rem === 0) return `${h}h ${m}m`;
    return `${h}h ${m}m ${rem}s`;
  }
  if (rem === 0) return `${m}m`;
  return `${m}m ${rem}s`;
}
