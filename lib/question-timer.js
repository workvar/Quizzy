/**
 * Server-side auto-submit timers for timed questions and session budgets.
 * When a timed question's countdown expires, all teams that haven't
 * answered receive a blank (score=0) answer automatically.
 */
import prisma from './prisma.js';
import { emitToAll, getLiveState, updateLiveState } from './socket-emitter.js';
import { computeTiming, autoSubmitDelayMs } from './time-limits.js';

function ensureTimerMaps() {
  if (!global._questionTimers) global._questionTimers = {};
  if (!global._quizSessionTimers) global._quizSessionTimers = {};
  if (!global._sectionSessionTimers) global._sectionSessionTimers = {};
}

/** Schedule auto-submit for a question after `delayMs` milliseconds. */
export function scheduleAutoSubmit(questionId, delayMs) {
  ensureTimerMaps();

  if (global._questionTimers[questionId]) {
    clearTimeout(global._questionTimers[questionId]);
  }

  global._questionTimers[questionId] = setTimeout(async () => {
    try {
      await performAutoSubmit(questionId);
    } catch (err) {
      console.error(`Auto-submit failed for question ${questionId}:`, err);
    } finally {
      delete global._questionTimers[questionId];
    }
  }, Math.max(0, delayMs));
}

/** Cancel a pending auto-submit timer. */
export function cancelAutoSubmit(questionId) {
  if (!global._questionTimers) return;
  if (global._questionTimers[questionId]) {
    clearTimeout(global._questionTimers[questionId]);
    delete global._questionTimers[questionId];
  }
}

/**
 * Load question+section+quiz and schedule auto-submit based on enforcement.
 * Also ensures quiz/section session clocks are started when needed.
 */
export async function scheduleQuestionTiming(questionId, { startSessions = true } = {}) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      quiz: true,
      section: true,
    },
  });
  if (!question || !question.isReleased || !question.releasedAt) return null;

  let quiz = question.quiz;
  let section = question.section;

  if (startSessions) {
    const updates = [];
    if (!quiz.sessionStartedAt && (quiz.timeLimitSeconds || quiz.timeEnforcement === 'QUIZ' || quiz.timeEnforcement === 'STRICTEST')) {
      // Start quiz session on first release when a quiz budget may apply
      if (quiz.timeLimitSeconds) {
        const started = new Date();
        quiz = await prisma.quiz.update({
          where: { id: quiz.id },
          data: { sessionStartedAt: started },
        });
        scheduleQuizSessionExpiry(quiz.id, quiz.timeLimitSeconds * 1000);
        emitToAll('quiz:session-started', {
          quizId: quiz.id,
          sessionStartedAt: started.toISOString(),
          timeLimitSeconds: quiz.timeLimitSeconds,
        });
      }
    } else if (quiz.sessionStartedAt && quiz.timeLimitSeconds) {
      const remaining = new Date(quiz.sessionStartedAt).getTime() + quiz.timeLimitSeconds * 1000 - Date.now();
      if (remaining > 0) scheduleQuizSessionExpiry(quiz.id, remaining);
    }

    if (section && !section.sessionStartedAt && section.timeLimitSeconds) {
      const started = new Date();
      section = await prisma.section.update({
        where: { id: section.id },
        data: { sessionStartedAt: started },
      });
      scheduleSectionSessionExpiry(section.id, section.timeLimitSeconds * 1000);
      emitToAll('section:session-started', {
        sectionId: section.id,
        quizId: quiz.id,
        sessionStartedAt: started.toISOString(),
        timeLimitSeconds: section.timeLimitSeconds,
      });
    } else if (section?.sessionStartedAt && section.timeLimitSeconds) {
      const remaining = new Date(section.sessionStartedAt).getTime() + section.timeLimitSeconds * 1000 - Date.now();
      if (remaining > 0) scheduleSectionSessionExpiry(section.id, remaining);
    }
  }

  const timing = computeTiming({ question, section, quiz });
  const delay = autoSubmitDelayMs(timing);
  if (delay != null) {
    scheduleAutoSubmit(questionId, delay);
  } else {
    cancelAutoSubmit(questionId);
  }
  return timing;
}

export function scheduleQuizSessionExpiry(quizId, delayMs) {
  ensureTimerMaps();
  if (global._quizSessionTimers[quizId]) {
    clearTimeout(global._quizSessionTimers[quizId]);
  }
  global._quizSessionTimers[quizId] = setTimeout(async () => {
    try {
      await performQuizSessionExpiry(quizId);
    } catch (err) {
      console.error(`Quiz session expiry failed for quiz ${quizId}:`, err);
    } finally {
      delete global._quizSessionTimers[quizId];
    }
  }, Math.max(0, delayMs));
}

export function cancelQuizSessionExpiry(quizId) {
  if (!global._quizSessionTimers) return;
  if (global._quizSessionTimers[quizId]) {
    clearTimeout(global._quizSessionTimers[quizId]);
    delete global._quizSessionTimers[quizId];
  }
}

export function scheduleSectionSessionExpiry(sectionId, delayMs) {
  ensureTimerMaps();
  if (global._sectionSessionTimers[sectionId]) {
    clearTimeout(global._sectionSessionTimers[sectionId]);
  }
  global._sectionSessionTimers[sectionId] = setTimeout(async () => {
    try {
      await performSectionSessionExpiry(sectionId);
    } catch (err) {
      console.error(`Section session expiry failed for section ${sectionId}:`, err);
    } finally {
      delete global._sectionSessionTimers[sectionId];
    }
  }, Math.max(0, delayMs));
}

export function cancelSectionSessionExpiry(sectionId) {
  if (!global._sectionSessionTimers) return;
  if (global._sectionSessionTimers[sectionId]) {
    clearTimeout(global._sectionSessionTimers[sectionId]);
    delete global._sectionSessionTimers[sectionId];
  }
}

async function performAutoSubmit(questionId) {
  const [allTeams, existingAnswers] = await Promise.all([
    prisma.team.findMany({ where: { isBanned: false }, select: { id: true, name: true } }),
    prisma.answer.findMany({ where: { questionId }, select: { teamId: true } }),
  ]);

  const submittedIds = new Set(existingAnswers.map(a => a.teamId));
  const unsubmitted = allTeams.filter(t => !submittedIds.has(t.id));

  let nextRank = existingAnswers.length + 1;
  for (const team of unsubmitted) {
    await prisma.answer.upsert({
      where: { teamId_questionId: { teamId: team.id, questionId } },
      create: {
        teamId: team.id,
        questionId,
        selectedOptions: '[]',
        isCorrect: false,
        score: 0,
        answerRank: nextRank++,
      },
      update: {},
    });
  }

  const state = getLiveState();
  if (state.currentQuestion?.id === questionId) {
    updateLiveState({
      submittedTeamIds: allTeams.map(t => t.id),
    });
  }

  emitToAll('question:timer-expired', {
    questionId,
    autoSubmitted: unsubmitted.map(t => t.name),
  });
}

async function autoSubmitQuestions(questionIds) {
  for (const qid of questionIds) {
    cancelAutoSubmit(qid);
    await performAutoSubmit(qid);
  }
}

async function performQuizSessionExpiry(quizId) {
  const openQuestions = await prisma.question.findMany({
    where: { quizId, isReleased: true },
    select: { id: true },
  });
  // Auto-submit every released question (performAutoSubmit skips teams that already answered)
  await autoSubmitQuestions(openQuestions.map(q => q.id));

  emitToAll('quiz:timer-expired', {
    quizId,
    questionIds: openQuestions.map(q => q.id),
  });

  const live = getLiveState();
  if (live.activeQuizId === quizId) {
    updateLiveState({ quizSessionExpired: true });
  }
}

async function performSectionSessionExpiry(sectionId) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) return;

  const openQuestions = await prisma.question.findMany({
    where: { sectionId, isReleased: true },
    select: { id: true },
  });
  await autoSubmitQuestions(openQuestions.map(q => q.id));

  emitToAll('section:timer-expired', {
    sectionId,
    quizId: section.quizId,
    questionIds: openQuestions.map(q => q.id),
  });
}

/**
 * Start quiz session clock on activate (if quiz has a session budget).
 */
export async function startQuizSessionIfNeeded(quizId) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) return null;
  if (!quiz.timeLimitSeconds) return quiz;
  if (quiz.sessionStartedAt) {
    const remaining = new Date(quiz.sessionStartedAt).getTime() + quiz.timeLimitSeconds * 1000 - Date.now();
    if (remaining > 0) scheduleQuizSessionExpiry(quiz.id, remaining);
    return quiz;
  }
  const started = new Date();
  const updated = await prisma.quiz.update({
    where: { id: quizId },
    data: { sessionStartedAt: started },
  });
  scheduleQuizSessionExpiry(updated.id, updated.timeLimitSeconds * 1000);
  emitToAll('quiz:session-started', {
    quizId: updated.id,
    sessionStartedAt: started.toISOString(),
    timeLimitSeconds: updated.timeLimitSeconds,
  });
  return updated;
}

/** Clear session start when deactivating / resetting a quiz. */
export async function clearQuizSession(quizId) {
  cancelQuizSessionExpiry(quizId);
  const sections = await prisma.section.findMany({ where: { quizId }, select: { id: true } });
  for (const s of sections) cancelSectionSessionExpiry(s.id);
  await prisma.quiz.update({
    where: { id: quizId },
    data: { sessionStartedAt: null },
  });
  await prisma.section.updateMany({
    where: { quizId },
    data: { sessionStartedAt: null },
  });
}
