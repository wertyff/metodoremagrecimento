const API_BASE = "https://www.thesportsdb.com/api/v1/json/123";
const DAY_WINDOW = 18;
const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

const dayEventsCache = new Map();
const statsCache = new Map();
const timelineCache = new Map();
const seasonEventsCache = new Map();
const previousTeamCache = new Map();
const upcomingTeamCache = new Map();

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value, total, digits = 0) {
  if (!total) return null;
  const factor = 10 ** digits;
  return Math.round((value / total) * 100 * factor) / factor;
}

function average(total, count, digits = 1) {
  if (!count) return null;
  const factor = 10 ** digits;
  return Math.round((total / count) * factor) / factor;
}

function formatPercent(value, digits = 0) {
  if (value === null || value === undefined) {
    return "sem base";
  }

  return `${value.toFixed(digits).replace(".", ",")}%`;
}

function formatAverage(value, digits = 1) {
  if (value === null || value === undefined) {
    return "sem base";
  }

  return value.toFixed(digits).replace(".", ",");
}

function formatStatLabel(label) {
  return String(label || "")
    .replace("Shots on Goal", "Chutes no gol")
    .replace("Shots off Goal", "Chutes para fora")
    .replace("Total Shots", "Finalizacoes")
    .replace("Blocked Shots", "Chutes bloqueados")
    .replace("Shots insidebox", "Chutes na area")
    .replace("Shots outsidebox", "Chutes fora da area")
    .replace("Fouls", "Faltas")
    .replace("Corner Kicks", "Escanteios")
    .replace("Offsides", "Impedimentos")
    .replace("Ball Possession", "Posse de bola")
    .replace("Yellow Cards", "Cartoes amarelos")
    .replace("Red Cards", "Cartoes vermelhos")
    .replace("Goalkeeper Saves", "Defesas do goleiro")
    .replace("Total passes", "Passes")
    .replace("Passes accurate", "Passes certos")
    .replace("Passes %", "Precisao de passes")
    .replace("expected_goals", "Expected goals");
}

function kickoffLabel(rawTime) {
  return String(rawTime || "00:00:00").slice(0, 5);
}

function resolveStatus(rawStatus) {
  const value = normalize(rawStatus);

  if (!value || ["not started", "ns", "tbd", "postponed", "cancelled", "canceled", "delayed"].includes(value)) {
    return "upcoming";
  }

  if (["match finished", "ft", "full time", "after extra time", "aet", "after penalties", "pen"].includes(value)) {
    return "finished";
  }

  return "live";
}

function formatTimelineType(type, detail) {
  const base = String(type || "").trim();
  const extra = String(detail || "").trim();

  if (base === "Goal") return "Gol";
  if (base === "subst" || base === "Substitution") return "Substituicao";
  if (base === "Card" && extra === "Yellow Card") return "Cartao amarelo";
  if (base === "Card" && extra === "Red Card") return "Cartao vermelho";
  if (base === "Var") return "VAR";

  return extra || base || "Evento";
}

function eventDateValue(event) {
  return new Date(`${event.dateEvent || "1970-01-01"}T${event.strTime || "00:00:00"}`).getTime();
}

function buildDateRange(referenceDate, daysBack = DAY_WINDOW) {
  const dates = [];
  const base = new Date(`${referenceDate || formatDateKey(new Date())}T12:00:00`);

  for (let offset = 1; offset <= daysBack; offset += 1) {
    const current = new Date(base);
    current.setDate(current.getDate() - offset);
    dates.push(formatDateKey(current));
  }

  return dates;
}

async function fetchDayEvents(dateKey) {
  if (dayEventsCache.has(dateKey)) {
    return dayEventsCache.get(dateKey);
  }

  const promise = fetch(`${API_BASE}/eventsday.php?d=${dateKey}&s=Soccer`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Falha ao carregar agenda de ${dateKey}`);
      }

      return response.json();
    })
    .then((payload) => payload.events || []);

  dayEventsCache.set(dateKey, promise);
  return promise;
}

async function fetchRecentWindow(referenceDate, daysBack = DAY_WINDOW) {
  const dates = buildDateRange(referenceDate, daysBack);
  const allEvents = [];

  for (let index = 0; index < dates.length; index += 3) {
    const chunk = dates.slice(index, index + 3);
    const responses = await Promise.all(chunk.map((dateKey) => fetchDayEvents(dateKey)));
    responses.forEach((items) => {
      allEvents.push(...items);
    });
  }

  return allEvents;
}

async function fetchSeasonEvents(leagueId, season) {
  if (!leagueId || !season) {
    return [];
  }

  const cacheKey = `${leagueId}-${season}`;
  if (seasonEventsCache.has(cacheKey)) {
    return seasonEventsCache.get(cacheKey);
  }

  const promise = fetch(`${API_BASE}/eventsseason.php?id=${leagueId}&s=${encodeURIComponent(season)}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar temporada da competicao.");
      }

      return response.json();
    })
    .then((payload) => payload.events || [])
    .catch(() => []);

  seasonEventsCache.set(cacheKey, promise);
  return promise;
}

async function fetchPreviousTeamEvents(teamId) {
  if (!teamId) {
    return [];
  }

  if (previousTeamCache.has(teamId)) {
    return previousTeamCache.get(teamId);
  }

  const promise = fetch(`${API_BASE}/eventslast.php?id=${teamId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar o historico mais recente do time.");
      }

      return response.json();
    })
    .then((payload) => payload.results || [])
    .catch(() => []);

  previousTeamCache.set(teamId, promise);
  return promise;
}

async function fetchUpcomingTeamEvents(teamId) {
  if (!teamId) {
    return [];
  }

  if (upcomingTeamCache.has(teamId)) {
    return upcomingTeamCache.get(teamId);
  }

  const promise = fetch(`${API_BASE}/eventsnext.php?id=${teamId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar os proximos jogos do time.");
      }

      return response.json();
    })
    .then((payload) => payload.events || [])
    .catch(() => []);

  upcomingTeamCache.set(teamId, promise);
  return promise;
}

function buildUniqueEvents(calendarEvents, seasonEvents, previousEvents) {
  return [...seasonEvents, ...calendarEvents, ...previousEvents].reduce((acc, event) => {
    if (event?.idEvent && !acc.some((item) => String(item.idEvent) === String(event.idEvent))) {
      acc.push(event);
    }
    return acc;
  }, []);
}

async function fetchEventStatsCached(eventId) {
  if (statsCache.has(eventId)) {
    return statsCache.get(eventId);
  }

  const promise = fetch(`${API_BASE}/lookupeventstats.php?id=${eventId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar estatisticas do evento.");
      }

      return response.json();
    })
    .then((payload) => (payload.eventstats || []).map((item) => ({
      key: item.idStatistic || `${item.strStat}-${item.intHome}-${item.intAway}`,
      label: formatStatLabel(item.strStat),
      rawLabel: item.strStat,
      homeValue: toNumber(item.intHome),
      awayValue: toNumber(item.intAway)
    })));

  statsCache.set(eventId, promise);
  return promise;
}

async function fetchTimelineCached(eventId) {
  if (timelineCache.has(eventId)) {
    return timelineCache.get(eventId);
  }

  const promise = fetch(`${API_BASE}/lookuptimeline.php?id=${eventId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Falha ao carregar timeline do evento.");
      }

      return response.json();
    })
    .then((payload) => (payload.timeline || []).map((item) => ({
      id: item.idTimeline || `${item.strTimeline}-${item.intTime}-${item.strPlayer}`,
      minuteValue: toNumber(item.intTime) || 0,
      minute: item.intTime ? `${item.intTime}'` : "-",
      team: item.strTeam || "",
      side: item.strHome === "Yes" ? "home" : "away",
      player: item.strPlayer || "Jogador",
      type: formatTimelineType(item.strTimeline, item.strTimelineDetail),
      detail: item.strTimelineDetail || ""
    })));

  timelineCache.set(eventId, promise);
  return promise;
}

function matchTeamSide(event, teamId, teamName) {
  const normalizedTeam = normalize(teamName);
  const homeMatch = (teamId && String(event.idHomeTeam || "") === String(teamId)) || normalize(event.strHomeTeam) === normalizedTeam;
  const awayMatch = (teamId && String(event.idAwayTeam || "") === String(teamId)) || normalize(event.strAwayTeam) === normalizedTeam;

  if (homeMatch) return "home";
  if (awayMatch) return "away";
  return "";
}

function mapRecentMatch(event, teamSide, teamName) {
  const teamIsHome = teamSide === "home";
  const teamScore = toNumber(teamIsHome ? event.intHomeScore : event.intAwayScore) || 0;
  const opponentScore = toNumber(teamIsHome ? event.intAwayScore : event.intHomeScore) || 0;

  return {
    id: event.idEvent,
    date: event.dateEvent,
    dateLabel: DATE_FORMATTER.format(new Date(`${event.dateEvent}T12:00:00`)),
    kickoff: kickoffLabel(event.strTime),
    competition: event.strLeague || "Futebol",
    venue: teamIsHome ? "Casa" : "Fora",
    opponent: teamIsHome ? event.strAwayTeam : event.strHomeTeam,
    opponentBadge: teamIsHome ? event.strAwayTeamBadge || "" : event.strHomeTeamBadge || "",
    teamScore,
    opponentScore,
    result: teamScore > opponentScore ? "V" : teamScore < opponentScore ? "D" : "E",
    scored: teamScore,
    conceded: opponentScore,
    status: resolveStatus(event.strStatus),
    raw: event,
    teamName
  };
}

function mapScheduledMatch(event, teamSide, teamName) {
  const teamIsHome = teamSide === "home";

  return {
    id: event.idEvent,
    date: event.dateEvent,
    dateLabel: DATE_FORMATTER.format(new Date(`${event.dateEvent}T12:00:00`)),
    kickoff: kickoffLabel(event.strTime),
    competition: event.strLeague || "Futebol",
    venue: teamIsHome ? "Casa" : "Fora",
    opponent: teamIsHome ? event.strAwayTeam : event.strHomeTeam,
    opponentBadge: teamIsHome ? event.strAwayTeamBadge || "" : event.strHomeTeamBadge || "",
    status: resolveStatus(event.strStatus),
    stage: event.strRound || event.strEventAlternate || "",
    raw: event,
    teamName
  };
}

function takeStatValue(stats, side, labels) {
  const item = stats.find((entry) => labels.includes(entry.rawLabel) || labels.includes(entry.label));
  if (!item) return null;
  return side === "home" ? item.homeValue : item.awayValue;
}

function minuteBucket(minute) {
  if (minute <= 15) return "0-15";
  if (minute <= 30) return "16-30";
  if (minute <= 45) return "31-45";
  if (minute <= 60) return "46-60";
  if (minute <= 75) return "61-75";
  return "76-90";
}

function buildEmptyBuckets() {
  return {
    "0-15": 0,
    "16-30": 0,
    "31-45": 0,
    "46-60": 0,
    "61-75": 0,
    "76-90": 0
  };
}

function topBucketLabel(buckets) {
  const items = Object.entries(buckets || {});
  if (!items.length) return null;
  const sorted = [...items].sort((left, right) => right[1] - left[1]);
  return sorted[0][1] > 0 ? { label: sorted[0][0], count: sorted[0][1] } : null;
}

function calcForm(results) {
  return results.map((result) => ({ V: "Vitoria", E: "Empate", D: "Derrota" }[result] || result)).join(" • ");
}

function descriptionOrFallback(value, fallback) {
  return value || fallback;
}

function buildStyleNotes(metrics) {
  const notes = [];

  if (metrics.possessionAvg !== null) {
    if (metrics.possessionAvg >= 54) {
      notes.push(`Trabalha mais com posse: media de ${formatAverage(metrics.possessionAvg)}% de bola nos jogos com dado avancado.`);
    } else if (metrics.possessionAvg <= 46) {
      notes.push(`Aceita menos posse e acelera transicoes: media de ${formatAverage(metrics.possessionAvg)}% de posse.`);
    }
  }

  if (metrics.shotsInsideShare !== null) {
    if (metrics.shotsInsideShare >= 58) {
      notes.push(`Ataque entra bastante na area: ${formatAverage(metrics.shotsInsideShare)}% das finalizacoes vieram de dentro da area.`);
    } else if (metrics.shotsInsideShare <= 42) {
      notes.push(`Chuta mais de media distancia: apenas ${formatAverage(metrics.shotsInsideShare)}% das finalizacoes vieram de dentro da area.`);
    }
  }

  if (metrics.cornersForAvg !== null && metrics.cornersForAvg >= 5.5) {
    notes.push(`Pressiona territorialmente e transforma volume em escanteios: media de ${formatAverage(metrics.cornersForAvg)} cantos a favor.`);
  }

  if (metrics.passesAccuracyAvg !== null && metrics.passesAccuracyAvg >= 80) {
    notes.push(`Circula com boa limpeza: acerto medio de ${formatAverage(metrics.passesAccuracyAvg)}% nos passes disponiveis.`);
  }

  if (!notes.length) {
    notes.push("A base avancada ainda nao trouxe volume suficiente para cravar um estilo dominante com seguranca.");
  }

  return notes;
}

function buildStrengths(metrics, sample) {
  const items = [];

  if (metrics.scoredPct >= 75) {
    items.push(`Alta frequencia de gol: marcou em ${sample.scoredMatches}/${sample.total} jogos (${formatPercent(metrics.scoredPct)}).`);
  }

  if (metrics.pointsPct >= 60) {
    items.push(`Aproveitamento forte: ${formatPercent(metrics.pointsPct)} dos pontos nos ultimos ${sample.total} jogos.`);
  }

  if (metrics.shotsAvg !== null && metrics.shotsAvg >= 12) {
    items.push(`Volume ofensivo alto: ${formatAverage(metrics.shotsAvg)} finalizacoes por jogo na amostra avancada.`);
  }

  if (metrics.onTargetAvg !== null && metrics.onTargetAvg >= 4.5) {
    items.push(`Leva perigo com constancia: ${formatAverage(metrics.onTargetAvg)} chutes no alvo por jogo.`);
  }

  if (metrics.cleanSheetPct >= 35) {
    items.push(`Consegue sustentar blocos limpos: nao sofreu gol em ${sample.cleanSheets}/${sample.total} partidas.`);
  }

  if (metrics.scoredFirstPct !== null && metrics.scoredFirstPct >= 55) {
    items.push(`Costuma abrir o placar: fez o primeiro gol em ${formatPercent(metrics.scoredFirstPct)} dos jogos com timeline disponivel.`);
  }

  return items.slice(0, 4);
}

function buildWeaknesses(metrics, sample) {
  const items = [];

  if (metrics.concededPct >= 65) {
    items.push(`Defesa vaza com frequencia: sofreu gol em ${sample.concededMatches}/${sample.total} jogos (${formatPercent(metrics.concededPct)}).`);
  }

  if (metrics.goalsAgainstAvg >= 1.4) {
    items.push(`Media alta de gols sofridos: ${formatAverage(metrics.goalsAgainstAvg)} por jogo na janela analisada.`);
  }

  if (metrics.shotsAgainstAvg !== null && metrics.shotsAgainstAvg >= 11) {
    items.push(`Cede muito volume: permite ${formatAverage(metrics.shotsAgainstAvg)} finalizacoes por jogo na amostra avancada.`);
  }

  if (metrics.cardsAvg !== null && metrics.cardsAvg >= 2.6) {
    items.push(`Disciplina pesa: media de ${formatAverage(metrics.cardsAvg)} cartoes por jogo.`);
  }

  if (metrics.concededFirstPct !== null && metrics.concededFirstPct >= 55) {
    items.push(`Sai atras com frequencia: sofreu o primeiro gol em ${formatPercent(metrics.concededFirstPct)} dos jogos com timeline.`);
  }

  return items.slice(0, 4);
}

function buildAttentionNotes(metrics) {
  const items = [];

  if (metrics.goalMomentsForTop) {
    items.push(`Marca mais no recorte ${metrics.goalMomentsForTop.label}, faixa em que produziu ${metrics.goalMomentsForTop.count} gols na amostra temporal.`);
  }

  if (metrics.goalMomentsAgainstTop) {
    items.push(`Sofre mais no recorte ${metrics.goalMomentsAgainstTop.label}, com ${metrics.goalMomentsAgainstTop.count} gols cedidos nessa faixa.`);
  }

  if (metrics.secondHalfGoalShare !== null) {
    if (metrics.secondHalfGoalShare >= 60) {
      items.push(`O jogo cresce depois do intervalo: ${formatPercent(metrics.secondHalfGoalShare)} dos gols marcados sairam no 2o tempo.`);
    } else if (metrics.secondHalfGoalShare <= 40) {
      items.push(`Comeca mais forte do que termina: so ${formatPercent(metrics.secondHalfGoalShare)} dos gols sairam no 2o tempo.`);
    }
  }

  if (metrics.openGamePct >= 60) {
    items.push(`Tendencia de jogo aberto: over 2.5 bateu em ${formatPercent(metrics.openGamePct)} da amostra.`);
  } else if (metrics.openGamePct <= 30) {
    items.push(`Tendencia de jogo mais controlado: over 2.5 apareceu em apenas ${formatPercent(metrics.openGamePct)} da amostra.`);
  }

  if (!items.length) {
    items.push("Sem base temporal suficiente para cravar um momento especifico de atencao.");
  }

  return items.slice(0, 4);
}

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function roundScore(value) {
  return Math.round(clamp(value));
}

function classifyScore(score) {
  if (score >= 85) return "Elite";
  if (score >= 70) return "Forte";
  if (score >= 55) return "Instavel";
  return "Fraco";
}

function classifyPressure(metrics) {
  const value = metrics.pressureScore ?? 0;
  if (value >= 70) return "Forte mentalmente";
  if (value >= 50) return "Instavel";
  return "Fragil";
}

function classifyReliability(sample, metrics) {
  if (sample.total >= 8 && sample.advancedMatches >= 4 && sample.timingMatches >= 3) {
    return {
      label: "Alta",
      reason: "A amostra e boa e a cobertura de estatisticas/timeline sustenta as leituras principais."
    };
  }

  if (sample.total >= 5 && (sample.advancedMatches >= 2 || sample.timingMatches >= 2)) {
    return {
      label: "Media",
      reason: "Ha sinal estatistico util, mas algumas leituras ainda dependem de cobertura parcial."
    };
  }

  return {
    label: "Baixa",
    reason: "A amostra ou a cobertura avancada ainda e curta para previsoes mais firmes."
  };
}

function detectDna(metrics) {
  if ((metrics.shotsAvg || 0) >= 12 && (metrics.onTargetAvg || 0) >= 4.5) {
    return {
      label: "Ofensivo agressivo",
      reason: `Empilha ${formatAverage(metrics.shotsAvg)} finalizacoes e ${formatAverage(metrics.onTargetAvg)} no alvo por jogo, sustentando pressao ofensiva constante.`
    };
  }

  if ((metrics.possessionAvg || 0) >= 54 && (metrics.passesAccuracyAvg || 0) >= 80) {
    return {
      label: "Controlador",
      reason: `Joga mais com a bola: ${formatAverage(metrics.possessionAvg)}% de posse e ${formatAverage(metrics.passesAccuracyAvg)}% de acerto nos passes.`
    };
  }

  if ((metrics.possessionAvg || 50) <= 46 && (metrics.scoredFirstPct || 0) >= 45) {
    return {
      label: "Reativo",
      reason: `Aceita menos posse (${formatAverage(metrics.possessionAvg)}%) e vive de atacar no momento certo, muitas vezes abrindo o placar primeiro.`
    };
  }

  if ((metrics.over25Pct || 0) >= 60 && (metrics.bttsPct || 0) >= 55) {
    return {
      label: "Caotico",
      reason: `Os jogos costumam abrir: over 2.5 em ${formatPercent(metrics.over25Pct)} e ambas marcam em ${formatPercent(metrics.bttsPct)}.`
    };
  }

  return {
    label: "Pragmatico",
    reason: "Ainda sem um recorte dominante de posse ou volume extremo; o time joga mais pela eficiencia do que pelo excesso de volume."
  };
}

function buildMomentMap(metrics) {
  const buckets = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"];
  return buckets.map((bucket) => ({
    bucket,
    scored: metrics.goalMomentsFor?.[bucket] || 0,
    conceded: metrics.goalMomentsAgainst?.[bucket] || 0,
    intensity:
      (metrics.goalMomentsFor?.[bucket] || 0) +
      (metrics.goalMomentsAgainst?.[bucket] || 0)
  }));
}

function buildHiddenPatterns(metrics) {
  const items = [];

  if ((metrics.concededFirstPct || 0) >= 55 && (metrics.comebackPct || 0) >= 35) {
    items.push(`Mesmo quando sofre primeiro, ainda busca reacao: evitou derrota em ${formatPercent(metrics.comebackPct)} dos jogos em que saiu atras.`);
  }

  if ((metrics.ledFirstWinPct || 0) <= 55 && (metrics.scoredFirstPct || 0) >= 45) {
    items.push(`Nem sempre segura a vantagem inicial: apesar de marcar primeiro com frequencia, converteu isso em vitoria em apenas ${formatPercent(metrics.ledFirstWinPct)} dos jogos em que saiu na frente.`);
  }

  if ((metrics.cornersForAvg || 0) >= 5.5 && (metrics.shotsAvg || 0) >= 11) {
    items.push("A pressao territorial vira escanteios com consistencia, indicando ataque empurrando o rival para tras.");
  }

  if ((metrics.cardsAvg || 0) >= 2.6 && (metrics.concededPct || 0) >= 60) {
    items.push("Quando o jogo aperta, a disciplina pesa: o volume de cartoes cresce junto com o numero de partidas sofrendo gol.");
  }

  return items.slice(0, 4);
}

function buildMarket(label, probability, explanation, type) {
  const clamped = clamp(probability);
  return {
    label,
    probability: roundScore(clamped),
    confidence: clamped >= 75 ? "Alta" : clamped >= 60 ? "Media" : "Baixa",
    explanation,
    type
  };
}

function buildPremiumMarkets(metrics) {
  const markets = [];

  if (metrics.over15Pct !== null) {
    markets.push(
      buildMarket(
        "Over 1.5 gols",
        metrics.over15Pct,
        `Bateu em ${formatPercent(metrics.over15Pct)} da amostra recente.`,
        "goals"
      )
    );
  }

  if (metrics.over25Pct !== null) {
    markets.push(
      buildMarket(
        "Over 2.5 gols",
        metrics.over25Pct,
        `Apareceu em ${formatPercent(metrics.over25Pct)} dos jogos, com media combinada de ${formatAverage((metrics.goalsForAvg || 0) + (metrics.goalsAgainstAvg || 0))} gols.`,
        "goals"
      )
    );
  }

  if (metrics.bttsPct !== null) {
    markets.push(
      buildMarket(
        "Ambas marcam",
        metrics.bttsPct,
        `Saiu em ${formatPercent(metrics.bttsPct)} da janela analisada.`,
        "goals"
      )
    );
  }

  if (metrics.cornersForAvg !== null && metrics.cornersAgainstAvg !== null) {
    const cornersTotal = metrics.cornersForAvg + metrics.cornersAgainstAvg;
    markets.push(
      buildMarket(
        "Over 8.5 escanteios",
        clamp((cornersTotal / 10) * 100),
        `A soma media de cantos chega a ${formatAverage(cornersTotal)} por jogo com cobertura avancada.`,
        "corners"
      )
    );
  }

  if (metrics.cornersForAvg !== null && metrics.cornersAgainstAvg !== null) {
    markets.push(
      buildMarket(
        "Time com mais escanteios",
        clamp(50 + ((metrics.cornersForAvg - metrics.cornersAgainstAvg) * 8)),
        `Gera ${formatAverage(metrics.cornersForAvg)} escanteios e cede ${formatAverage(metrics.cornersAgainstAvg)} na mesma amostra.`,
        "corners"
      )
    );
  }

  if (metrics.cardsAvg !== null) {
    markets.push(
      buildMarket(
        "Over cartoes",
        clamp(metrics.cardsAvg * 28),
        `Recebe em media ${formatAverage(metrics.cardsAvg)} cartoes por jogo com timeline disponivel.`,
        "cards"
      )
    );
  }

  return markets.slice(0, 6);
}

function buildPremiumEngine(metrics, sample) {
  const formScore = metrics.pointsPct ?? 0;
  const attackScore = clamp(
    ((metrics.goalsForAvg || 0) * 24) +
      ((metrics.shotsAvg || 0) * 2.1) +
      ((metrics.onTargetAvg || 0) * 4) +
      ((metrics.scoredPct || 0) * 0.18)
  );
  const defenseScore = clamp(
    100 -
      (((metrics.goalsAgainstAvg || 0) * 28) +
        ((metrics.shotsAgainstAvg || 0) * 1.8) +
        ((metrics.concededPct || 0) * 0.2)) +
      ((metrics.cleanSheetPct || 0) * 0.3)
  );
  const homeAwayGap = Math.abs((metrics.homePointsPct || 50) - (metrics.awayPointsPct || 50));
  const consistencyScore = clamp(
    ((metrics.pointsPct || 0) * 0.55) +
      ((metrics.scoredPct || 0) * 0.15) +
      ((metrics.cleanSheetPct || 0) * 0.1) +
      ((100 - homeAwayGap) * 0.2)
  );
  const disciplineScore = clamp(100 - ((metrics.cardsAvg || 0) * 22));
  const pressureScore = clamp(
    ((metrics.ledFirstWinPct || 0) * 0.45) +
      ((metrics.comebackPct || 0) * 0.35) +
      ((100 - (metrics.concededFirstPct || 0)) * 0.2)
  );

  const overallScore = roundScore(
    (formScore * 0.25) +
      (attackScore * 0.2) +
      (defenseScore * 0.2) +
      (consistencyScore * 0.15) +
      (disciplineScore * 0.1) +
      (pressureScore * 0.1)
  );

  const dna = detectDna(metrics);
  const reliability = classifyReliability(sample, metrics);

  return {
    overallScore,
    tier: classifyScore(overallScore),
    reason: `Forma ${roundScore(formScore)}, ataque ${roundScore(attackScore)}, defesa ${roundScore(defenseScore)} e pressao ${roundScore(pressureScore)} compoem a nota geral.`,
    subscores: {
      form: roundScore(formScore),
      attack: roundScore(attackScore),
      defense: roundScore(defenseScore),
      consistency: roundScore(consistencyScore),
      discipline: roundScore(disciplineScore),
      pressure: roundScore(pressureScore)
    },
    dna,
    pressureLabel: classifyPressure({ pressureScore }),
    domain:
      (metrics.shotsAvg || 0) >= 12 || (metrics.possessionAvg || 0) >= 54
        ? "Dominante"
        : (metrics.over25Pct || 0) >= 55
          ? "Equilibrado"
          : "Reativo",
    hiddenPatterns: buildHiddenPatterns(metrics),
    markets: buildPremiumMarkets(metrics),
    reliability,
    momentMap: buildMomentMap(metrics)
  };
}

function buildSections(metrics, sample) {
  const summary = `Fase ${metrics.pointsPct >= 60 ? "positiva" : metrics.pointsPct >= 45 ? "estavel" : "instavel"} com ${sample.wins}V ${sample.draws}E ${sample.losses}D nos ultimos ${sample.total} jogos, aproveitamento de ${formatPercent(metrics.pointsPct)} e saldo de ${sample.goalsFor - sample.goalsAgainst >= 0 ? "+" : ""}${sample.goalsFor - sample.goalsAgainst}.`;

  const performance = `A equipe somou ${sample.points}/${sample.total * 3} pontos. Em casa tem ${sample.home.wins}V ${sample.home.draws}E ${sample.home.losses}D (${formatPercent(metrics.homePointsPct)}), fora soma ${sample.away.wins}V ${sample.away.draws}E ${sample.away.losses}D (${formatPercent(metrics.awayPointsPct)}).`;

  const goals = `Media de ${formatAverage(metrics.goalsForAvg)} gol marcado e ${formatAverage(metrics.goalsAgainstAvg)} sofrido por jogo. Over 1.5 saiu em ${formatPercent(metrics.over15Pct)}, over 2.5 em ${formatPercent(metrics.over25Pct)}, over 3.5 em ${formatPercent(metrics.over35Pct)} e ambas marcam em ${formatPercent(metrics.bttsPct)}.`;

  const attack = metrics.shotsAvg !== null
    ? `Na amostra avancada (${sample.advancedMatches} jogos), finaliza ${formatAverage(metrics.shotsAvg)} vezes por jogo, com ${formatAverage(metrics.onTargetAvg)} no alvo e eficiencia de ${formatAverage(metrics.shotAccuracy)}% de acerto no gol.`
    : "Ataque sem base avancada suficiente nesta janela para medir volume de finalizacao com seguranca.";

  const defense = metrics.shotsAgainstAvg !== null
    ? `Defensivamente cede ${formatAverage(metrics.shotsAgainstAvg)} finalizacoes e ${formatAverage(metrics.onTargetAgainstAvg)} chutes no alvo por jogo na amostra avancada. Clean sheet apareceu em ${formatPercent(metrics.cleanSheetPct)} da janela.`
    : `Defesa sofreu gol em ${sample.concededMatches}/${sample.total} jogos e manteve clean sheet em ${sample.cleanSheets}/${sample.total}, mas a base avancada ainda e curta para detalhar o volume cedido.`;

  const corners = metrics.cornersForAvg !== null
    ? `Nos jogos com escanteios disponiveis, gera ${formatAverage(metrics.cornersForAvg)} cantos e cede ${formatAverage(metrics.cornersAgainstAvg)}.`
    : "Escanteios ainda sem base suficiente nesta janela para calcular tendencia confiavel.";

  const cards = metrics.cardsAvg !== null
    ? `Recebe em media ${formatAverage(metrics.cardsAvg)} cartoes por jogo na amostra com timeline.`
    : "Cartoes ainda sem amostra temporal suficiente para uma leitura disciplinar forte.";

  return {
    summary,
    performance,
    goals,
    attack,
    defense,
    corners,
    cards
  };
}

export async function fetchTeamAnalysis({
  teamId,
  teamName,
  teamBadge = "",
  leagueId = "",
  competition = "",
  season = "",
  referenceDate,
  excludeEventId = "",
  sampleSize = 10
}) {
  if (!teamName) {
    throw new Error("Time nao informado.");
  }

  const [calendarEvents, seasonEvents, previousEvents] = await Promise.all([
    fetchRecentWindow(referenceDate),
    fetchSeasonEvents(leagueId, season),
    fetchPreviousTeamEvents(teamId)
  ]);

  const allEvents = buildUniqueEvents(calendarEvents, seasonEvents, previousEvents);

  const recentMatches = allEvents
    .filter((event) => {
      const side = matchTeamSide(event, teamId, teamName);
      return side && resolveStatus(event.strStatus) === "finished" && String(event.idEvent) !== String(excludeEventId);
    })
    .sort((left, right) => eventDateValue(right) - eventDateValue(left))
    .map((event) => {
      const side = matchTeamSide(event, teamId, teamName);
      return mapRecentMatch(event, side, teamName);
    });

  const sampleMatches = recentMatches.slice(0, sampleSize);
  if (!sampleMatches.length) {
    throw new Error("Sem jogos suficientes para analisar esse time nesta janela.");
  }

  const advancedTarget = sampleMatches.slice(0, Math.min(sampleMatches.length, 6));
  const timelineTarget = sampleMatches.slice(0, Math.min(sampleMatches.length, 4));

  const [statsResults, timelineResults] = await Promise.all([
    Promise.allSettled(advancedTarget.map((item) => fetchEventStatsCached(item.id))),
    Promise.allSettled(timelineTarget.map((item) => fetchTimelineCached(item.id)))
  ]);

  const sample = {
    total: sampleMatches.length,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    scoredMatches: 0,
    concededMatches: 0,
    cleanSheets: 0,
    home: { wins: 0, draws: 0, losses: 0, points: 0, matches: 0 },
    away: { wins: 0, draws: 0, losses: 0, points: 0, matches: 0 },
    advancedMatches: 0,
    timingMatches: 0
  };

  const aggregates = {
    shotsFor: 0,
    shotsAgainst: 0,
    onTargetFor: 0,
    onTargetAgainst: 0,
    insideBoxFor: 0,
    insideBoxAgainst: 0,
    cornersFor: 0,
    cornersAgainst: 0,
    possession: 0,
    possessionMatches: 0,
    passesAccuracy: 0,
    passesAccuracyMatches: 0,
    yellowCards: 0,
    redCards: 0,
    cardsMatches: 0,
    over15: 0,
    over25: 0,
    over35: 0,
    btts: 0,
    goalsForByBucket: buildEmptyBuckets(),
    goalsAgainstByBucket: buildEmptyBuckets(),
    scoredFirst: 0,
    concededFirst: 0,
    firstGoalMatches: 0,
    ledFirstMatches: 0,
    ledFirstWins: 0,
    concededFirstMatches: 0,
    comebackMatches: 0,
    secondHalfGoalsFor: 0,
    totalGoalsForTimed: 0
  };

  sampleMatches.forEach((match) => {
    sample.goalsFor += match.scored;
    sample.goalsAgainst += match.conceded;
    sample.scoredMatches += match.scored > 0 ? 1 : 0;
    sample.concededMatches += match.conceded > 0 ? 1 : 0;
    sample.cleanSheets += match.conceded === 0 ? 1 : 0;
    aggregates.over15 += match.scored + match.conceded >= 2 ? 1 : 0;
    aggregates.over25 += match.scored + match.conceded >= 3 ? 1 : 0;
    aggregates.over35 += match.scored + match.conceded >= 4 ? 1 : 0;
    aggregates.btts += match.scored > 0 && match.conceded > 0 ? 1 : 0;

    const venueBucket = match.venue === "Casa" ? sample.home : sample.away;
    venueBucket.matches += 1;

    if (match.result === "V") {
      sample.wins += 1;
      sample.points += 3;
      venueBucket.wins += 1;
      venueBucket.points += 3;
    } else if (match.result === "E") {
      sample.draws += 1;
      sample.points += 1;
      venueBucket.draws += 1;
      venueBucket.points += 1;
    } else {
      sample.losses += 1;
      venueBucket.losses += 1;
    }
  });

  advancedTarget.forEach((match, index) => {
    const result = statsResults[index];
    if (result?.status !== "fulfilled" || !result.value.length) {
      return;
    }

    sample.advancedMatches += 1;
    const side = match.venue === "Casa" ? "home" : "away";
    aggregates.shotsFor += takeStatValue(result.value, side, ["Total Shots", "Finalizacoes"]) || 0;
    aggregates.shotsAgainst += takeStatValue(result.value, side === "home" ? "away" : "home", ["Total Shots", "Finalizacoes"]) || 0;
    aggregates.onTargetFor += takeStatValue(result.value, side, ["Shots on Goal", "Chutes no gol"]) || 0;
    aggregates.onTargetAgainst += takeStatValue(result.value, side === "home" ? "away" : "home", ["Shots on Goal", "Chutes no gol"]) || 0;
    aggregates.insideBoxFor += takeStatValue(result.value, side, ["Shots insidebox", "Chutes na area"]) || 0;
    aggregates.insideBoxAgainst += takeStatValue(result.value, side === "home" ? "away" : "home", ["Shots insidebox", "Chutes na area"]) || 0;

    const cornersFor = takeStatValue(result.value, side, ["Corner Kicks", "Escanteios"]);
    const cornersAgainst = takeStatValue(result.value, side === "home" ? "away" : "home", ["Corner Kicks", "Escanteios"]);
    if (cornersFor !== null || cornersAgainst !== null) {
      aggregates.cornersFor += cornersFor || 0;
      aggregates.cornersAgainst += cornersAgainst || 0;
    }

    const possession = takeStatValue(result.value, side, ["Ball Possession", "Posse de bola"]);
    if (possession !== null) {
      aggregates.possession += possession;
      aggregates.possessionMatches += 1;
    }

    const passesAccuracy = takeStatValue(result.value, side, ["Passes %", "Precisao de passes"]);
    if (passesAccuracy !== null) {
      aggregates.passesAccuracy += passesAccuracy;
      aggregates.passesAccuracyMatches += 1;
    }
  });

  timelineTarget.forEach((match, index) => {
    const result = timelineResults[index];
    if (result?.status !== "fulfilled" || !result.value.length) {
      return;
    }

    sample.timingMatches += 1;
    const relevantEvents = result.value
      .filter((item) => item.type === "Gol" || item.type === "Cartao amarelo" || item.type === "Cartao vermelho")
      .sort((left, right) => left.minuteValue - right.minuteValue);

    const goals = relevantEvents.filter((item) => item.type === "Gol");
    const cards = relevantEvents.filter((item) => item.type === "Cartao amarelo" || item.type === "Cartao vermelho");

    if (cards.length) {
      aggregates.cardsMatches += 1;
      cards.forEach((card) => {
        const isForTeam = card.side === (match.venue === "Casa" ? "home" : "away");
        if (isForTeam) {
          if (card.type === "Cartao vermelho") {
            aggregates.redCards += 1;
          } else {
            aggregates.yellowCards += 1;
          }
        }
      });
    }

    if (goals.length) {
      aggregates.firstGoalMatches += 1;
      const teamSide = match.venue === "Casa" ? "home" : "away";
      const firstGoal = goals[0];
      if (firstGoal.side === teamSide) {
        aggregates.scoredFirst += 1;
        aggregates.ledFirstMatches += 1;
        if (match.result === "V") {
          aggregates.ledFirstWins += 1;
        }
      } else {
        aggregates.concededFirst += 1;
        aggregates.concededFirstMatches += 1;
        if (match.result !== "D") {
          aggregates.comebackMatches += 1;
        }
      }

      goals.forEach((goal) => {
        const bucket = minuteBucket(goal.minuteValue || 0);
        if (goal.side === teamSide) {
          aggregates.goalsForByBucket[bucket] += 1;
          aggregates.totalGoalsForTimed += 1;
          if ((goal.minuteValue || 0) > 45) {
            aggregates.secondHalfGoalsFor += 1;
          }
        } else {
          aggregates.goalsAgainstByBucket[bucket] += 1;
        }
      });
    }
  });

  const metrics = {
    pointsPct: percent(sample.points, sample.total * 3),
    homePointsPct: percent(sample.home.points, sample.home.matches * 3),
    awayPointsPct: percent(sample.away.points, sample.away.matches * 3),
    goalsForAvg: average(sample.goalsFor, sample.total),
    goalsAgainstAvg: average(sample.goalsAgainst, sample.total),
    scoredPct: percent(sample.scoredMatches, sample.total),
    concededPct: percent(sample.concededMatches, sample.total),
    cleanSheetPct: percent(sample.cleanSheets, sample.total),
    over15Pct: percent(aggregates.over15, sample.total),
    over25Pct: percent(aggregates.over25, sample.total),
    over35Pct: percent(aggregates.over35, sample.total),
    bttsPct: percent(aggregates.btts, sample.total),
    shotsAvg: average(aggregates.shotsFor, sample.advancedMatches),
    shotsAgainstAvg: average(aggregates.shotsAgainst, sample.advancedMatches),
    onTargetAvg: average(aggregates.onTargetFor, sample.advancedMatches),
    onTargetAgainstAvg: average(aggregates.onTargetAgainst, sample.advancedMatches),
    shotsInsideAvg: average(aggregates.insideBoxFor, sample.advancedMatches),
    shotsInsideShare: aggregates.shotsFor ? average((aggregates.insideBoxFor / aggregates.shotsFor) * 100, 1) : null,
    shotAccuracy: aggregates.shotsFor ? average((aggregates.onTargetFor / aggregates.shotsFor) * 100, 1) : null,
    cornersForAvg: average(aggregates.cornersFor, sample.advancedMatches),
    cornersAgainstAvg: average(aggregates.cornersAgainst, sample.advancedMatches),
    possessionAvg: average(aggregates.possession, aggregates.possessionMatches),
    passesAccuracyAvg: average(aggregates.passesAccuracy, aggregates.passesAccuracyMatches),
    cardsAvg: average(aggregates.yellowCards + aggregates.redCards, Math.max(sample.timingMatches, 0)),
    scoredFirstPct: percent(aggregates.scoredFirst, aggregates.firstGoalMatches),
    concededFirstPct: percent(aggregates.concededFirst, aggregates.firstGoalMatches),
    ledFirstWinPct: percent(aggregates.ledFirstWins, aggregates.ledFirstMatches),
    comebackPct: percent(aggregates.comebackMatches, aggregates.concededFirstMatches),
    goalMomentsForTop: topBucketLabel(aggregates.goalsForByBucket),
    goalMomentsAgainstTop: topBucketLabel(aggregates.goalsAgainstByBucket),
    goalMomentsFor: aggregates.goalsForByBucket,
    goalMomentsAgainst: aggregates.goalsAgainstByBucket,
    secondHalfGoalShare: percent(aggregates.secondHalfGoalsFor, aggregates.totalGoalsForTimed),
    openGamePct: percent(aggregates.over25, sample.total)
  };

  const sections = buildSections(metrics, sample);
  const premium = buildPremiumEngine(metrics, sample);

  return {
    team: {
      id: teamId,
      name: teamName,
      badge: teamBadge,
      competition: competition || sampleMatches[0]?.competition || "Futebol"
    },
    sample,
    metrics,
    sections,
    recentMatches: sampleMatches,
    smartSummary: sections.summary,
    styleNotes: buildStyleNotes(metrics),
    strengths: buildStrengths(metrics, sample),
    weaknesses: buildWeaknesses(metrics, sample),
    attention: buildAttentionNotes(metrics),
    premium,
    metadata: {
      dayWindow: DAY_WINDOW,
      competition: competition || sampleMatches[0]?.competition || "Futebol",
      advancedCoverage: sample.advancedMatches,
      timingCoverage: sample.timingMatches,
      formLine: calcForm(sampleMatches.map((item) => item.result))
    }
  };
}

export async function fetchTeamRecentMatches({
  teamId,
  teamName,
  leagueId = "",
  season = "",
  referenceDate,
  excludeEventId = "",
  sampleSize = 10
}) {
  if (!teamName) {
    throw new Error("Time nao informado.");
  }

  const [calendarEvents, seasonEvents, previousEvents] = await Promise.all([
    fetchRecentWindow(referenceDate),
    fetchSeasonEvents(leagueId, season),
    fetchPreviousTeamEvents(teamId)
  ]);

  return buildUniqueEvents(calendarEvents, seasonEvents, previousEvents)
    .filter((event) => {
      const side = matchTeamSide(event, teamId, teamName);
      return side && resolveStatus(event.strStatus) === "finished" && String(event.idEvent) !== String(excludeEventId);
    })
    .sort((left, right) => eventDateValue(right) - eventDateValue(left))
    .map((event) => {
      const side = matchTeamSide(event, teamId, teamName);
      return mapRecentMatch(event, side, teamName);
    })
    .slice(0, sampleSize);
}

export async function fetchTeamUpcomingMatches({
  teamId,
  teamName,
  sampleSize = 10
}) {
  if (!teamId || !teamName) {
    throw new Error("Time nao informado.");
  }

  const upcomingEvents = await fetchUpcomingTeamEvents(teamId);

  return upcomingEvents
    .filter((event) => {
      const side = matchTeamSide(event, teamId, teamName);
      return side && resolveStatus(event.strStatus) === "upcoming";
    })
    .sort((left, right) => eventDateValue(left) - eventDateValue(right))
    .map((event) => {
      const side = matchTeamSide(event, teamId, teamName);
      return mapScheduledMatch(event, side, teamName);
    })
    .slice(0, sampleSize);
}

export async function fetchCompetitionStandings({
  leagueId,
  season = "",
  referenceDate,
  focusTeamIds = [],
  focusTeamNames = []
}) {
  const [seasonEvents, calendarEvents] = await Promise.all([
    fetchSeasonEvents(leagueId, season),
    fetchRecentWindow(referenceDate, 35)
  ]);

  const sourceEvents = seasonEvents.length ? seasonEvents : calendarEvents.filter((event) => String(event.idLeague || "") === String(leagueId || ""));
  const standingsMap = new Map();
  const focusNamesNormalized = focusTeamNames.map((item) => normalize(item));

  const ensureTeam = (id, name, badgeUrl) => {
    const key = String(id || name || "").trim();
    if (!key) return null;

    if (!standingsMap.has(key)) {
      standingsMap.set(key, {
        key,
        teamId: id || "",
        teamName: name || "Time",
        badge: badgeUrl || "",
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0
      });
    }

    const team = standingsMap.get(key);
    team.badge ||= badgeUrl || "";
    team.teamId ||= id || "";
    return team;
  };

  sourceEvents
    .filter((event) => resolveStatus(event.strStatus) === "finished")
    .forEach((event) => {
      const homeScore = toNumber(event.intHomeScore);
      const awayScore = toNumber(event.intAwayScore);
      if (homeScore === null || awayScore === null) return;

      const home = ensureTeam(event.idHomeTeam || "", event.strHomeTeam || "", event.strHomeTeamBadge || "");
      const away = ensureTeam(event.idAwayTeam || "", event.strAwayTeam || "", event.strAwayTeamBadge || "");
      if (!home || !away) return;

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        home.wins += 1;
        away.losses += 1;
        home.points += 3;
      } else if (homeScore < awayScore) {
        away.wins += 1;
        home.losses += 1;
        away.points += 3;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  return Array.from(standingsMap.values())
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
      highlight:
        focusTeamIds.some((id) => id && String(id) === String(team.teamId)) ||
        focusNamesNormalized.includes(normalize(team.teamName))
    }))
    .sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName)
    )
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

export function describeAnalysisWindow(bundle, requestedSampleSize) {
  if (!bundle) {
    return "Sem base carregada.";
  }

  const parts = [
    `${bundle.sample.total} jogos encontrados`,
    `${bundle.metadata.advancedCoverage} com estatisticas avancadas`,
    `${bundle.metadata.timingCoverage} com timeline`,
    `janela de ${bundle.metadata.dayWindow} dias`
  ];

  if (bundle.sample.total < requestedSampleSize) {
    parts.unshift(`A amostra nao atingiu os ${requestedSampleSize} jogos pedidos`);
  }

  return parts.join(" • ");
}
