
export const ACHIEVEMENTS = [
  {
    id: 'first_page',
    title: 'Primeira Página',
    description: 'Registre sua primeira leitura.',
    xp: 50,
    icon: '📖',
    check: (stats) => stats.totalPages >= 1,
  },
  {
    id: 'page_100',
    title: 'Centurião da Leitura',
    description: 'Leia 100 páginas no total.',
    xp: 100,
    icon: '💯',
    check: (stats) => stats.totalPages >= 100,
  },
  {
    id: 'marathon',
    title: 'Maratonista',
    description: 'Leia 50 páginas em uma única sessão.',
    xp: 150,
    icon: '🏃',
    check: (_, session) => session.pages >= 50,
  },
  {
    id: 'summarizer',
    title: 'Mestre do Resumo',
    description: 'Escreva um resumo com mais de 100 palavras.',
    xp: 80,
    icon: '✍️',
    check: (_, session) =>
      session.summary.trim().split(/\s+/).filter(Boolean).length > 100,
  },
  {
    id: 'night_owl',
    title: 'Coruja Noturna',
    description: 'Leia após as 22h.',
    xp: 60,
    icon: '🦉',
    check: (_, session) => new Date(session.timestamp).getHours() >= 22,
  },
  {
    id: 'streak_3',
    title: 'Consistência',
    description: 'Leia por 3 dias seguidos.',
    xp: 200,
    icon: '🔥',
    check: (stats) => stats.currentStreak >= 3,
  },
];

export function calculateStats(logs = []) {
  const validLogs = Array.isArray(logs) ? logs : [];

  const totalSessions = validLogs.length;
  const totalPages = validLogs.reduce(
    (sum, log) => sum + (Number(log.pages) || 0),
    0
  );
  const totalMinutes = validLogs.reduce(
    (sum, log) => sum + (Number(log.minutes) || 0),
    0
  );

  // Agrupa as leituras por dia, ignorando várias leituras no mesmo dia.
  const activeDays = new Set(
    validLogs
      .filter((log) => log.timestamp && !Number.isNaN(Date.parse(log.timestamp)))
      .map((log) => {
        const date = new Date(log.timestamp);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
  );

  // Conta os dias consecutivos a partir de hoje.
  // Se não houve leitura hoje, começa a verificar a partir de ontem.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = new Date(today);
  if (!activeDays.has(checkDate.getTime())) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let currentStreak = 0;

  while (activeDays.has(checkDate.getTime())) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    totalSessions,
    totalPages,
    totalMinutes,
    currentStreak,
    avgReadingSpeed:
      totalMinutes > 0
        ? Math.round((totalPages / totalMinutes) * 100) / 100
        : 0,
  };
}

export function getUnlockedAchievements(stats, logs = []) {
  const saved = localStorage.getItem('unlocked_ach');
  let unlockedIds = [];

  try {
    unlockedIds = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(unlockedIds)) unlockedIds = [];
  } catch {
    unlockedIds = [];
  }

  return ACHIEVEMENTS.filter((achievement) => {
    if (unlockedIds.includes(achievement.id)) return false;

    if (
      achievement.id === 'marathon' ||
      achievement.id === 'summarizer' ||
      achievement.id === 'night_owl'
    ) {
      return logs.some((log) => achievement.check(stats, log));
    }

    return achievement.check(stats);
  });
}

export function addXP(userId, xpAmount) {
  const xpKey = `xp_${userId}`;
  const currentXP = getXP(userId);
  const amount = Math.max(0, Number(xpAmount) || 0);
  const newXP = currentXP + amount;

  localStorage.setItem(xpKey, String(newXP));
  return newXP;
}

export function getXP(userId) {
  const value = Number.parseInt(localStorage.getItem(`xp_${userId}`) || '0', 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
