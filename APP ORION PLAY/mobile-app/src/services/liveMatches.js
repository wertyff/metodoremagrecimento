import {
  featuredMatchId as fallbackFeaturedMatchId,
  matches as fallbackMatches,
  notificationsSeed as fallbackNotifications
} from "../data/catalog";

const API_BASE = "https://www.thesportsdb.com/api/v1/json/123";
const WINDOW_OFFSETS = [-1, 0, 1];
const teamBadgeCache = new Map();

export const MATCH_CATEGORY_ORDER = ["professional", "u20", "u17", "womens", "national"];
export const MATCH_CATEGORY_LABELS = {
  professional: "Profissional",
  u20: "Sub-20",
  u17: "Sub-17",
  womens: "Feminino",
  national: "Seleções"
};

const STATUS_MAP = {
  upcoming: new Set(["not started", "ns", "tbd", "postponed", "cancelled", "canceled", "delayed"]),
  finished: new Set(["match finished", "ft", "full time", "after extra time", "aet", "after penalties", "pen"])
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function teamCacheKey(teamId, teamName) {
  if (teamId) {
    return `id:${teamId}`;
  }

  return `name:${normalize(teamName)}`;
}

async function fetchJson(url, errorMessage) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json();
}

async function resolveTeamBadge(teamId, teamName) {
  const cacheKey = teamCacheKey(teamId, teamName);
  if (teamBadgeCache.has(cacheKey)) {
    return teamBadgeCache.get(cacheKey);
  }

  const promise = (async () => {
    if (teamId) {
      try {
        const payload = await fetchJson(`${API_BASE}/lookupteam.php?id=${teamId}`, "Falha ao carregar time.");
        const badge = payload.teams?.[0]?.strBadge || "";
        if (badge) {
          return badge;
        }
      } catch {}
    }

    if (teamName) {
      try {
        const payload = await fetchJson(`${API_BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`, "Falha ao buscar time.");
        const exactTeam =
          (payload.teams || []).find((item) => normalize(item.strTeam) === normalize(teamName)) ||
          payload.teams?.[0];
        return exactTeam?.strBadge || "";
      } catch {}
    }

    return "";
  })();

  teamBadgeCache.set(cacheKey, promise);
  const badge = await promise;

  if (badge && teamId) {
    teamBadgeCache.set(`id:${teamId}`, Promise.resolve(badge));
  }

  if (badge && teamName) {
    teamBadgeCache.set(`name:${normalize(teamName)}`, Promise.resolve(badge));
  }

  return badge;
}

async function enrichMatchesWithBadges(matches) {
  const tasks = matches.map(async (match) => {
    const [homeBadge, awayBadge] = await Promise.all([
      match.homeBadge || resolveTeamBadge(match.homeTeamId, match.homeTeam),
      match.awayBadge || resolveTeamBadge(match.awayTeamId, match.awayTeam)
    ]);

    return {
      ...match,
      homeBadge: homeBadge || match.homeBadge || "",
      awayBadge: awayBadge || match.awayBadge || ""
    };
  });

  return Promise.all(tasks);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function offsetDate(baseDate, offset) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + offset);
  return formatDateKey(nextDate);
}

function kickoffLabel(rawTime) {
  return String(rawTime || "00:00:00").slice(0, 5);
}

function resolveStatus(rawStatus) {
  const value = normalize(rawStatus);

  if (!value || STATUS_MAP.upcoming.has(value)) {
    return "upcoming";
  }

  if (STATUS_MAP.finished.has(value)) {
    return "finished";
  }

  return "live";
}

function minuteLabel(rawStatus, status) {
  if (status === "finished") {
    return "Encerrado";
  }

  if (status === "upcoming") {
    return null;
  }

  return String(rawStatus || "Ao vivo")
    .replace("Match Finished", "Encerrado")
    .replace("Not Started", "Em breve");
}

function classifyMatchCategory(competition, homeTeam, awayTeam) {
  const text = normalize(`${competition} ${homeTeam} ${awayTeam}`);

  if (/(sub[- ]?20|\bu20\b|under 20)/.test(text)) {
    return "u20";
  }

  if (/(sub[- ]?17|\bu17\b|under 17)/.test(text)) {
    return "u17";
  }

  if (/(women|womens|female|feminino|femenino|ladies|fem\b)/.test(text)) {
    return "womens";
  }

  if (/(selec|selecao|national team|world cup|copa america|euro\b|nations league|qualif|friendly international)/.test(text)) {
    return "national";
  }

  return "professional";
}

function paletteFor(competition, status) {
  if (status === "live") {
    return ["#EF4444", "#7F1D1D", "#111827"];
  }

  if (status === "finished") {
    return ["#334155", "#0F172A", "#111827"];
  }

  const palettes = [
    ["#22C55E", "#0F766E", "#111827"],
    ["#3B82F6", "#1D4ED8", "#111827"],
    ["#F59E0B", "#B45309", "#111827"],
    ["#A855F7", "#6D28D9", "#111827"],
    ["#EC4899", "#9D174D", "#111827"]
  ];

  const seed = String(competition || "")
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);

  return palettes[seed % palettes.length];
}

function stageLabel(event) {
  if (event.intRound) {
    return `Rodada ${event.intRound}`;
  }

  if (event.strSeason) {
    return `Temporada ${event.strSeason}`;
  }

  return "Partida do dia";
}

function mapEventToMatch(event) {
  const status = resolveStatus(event.strStatus);
  const category = classifyMatchCategory(event.strLeague, event.strHomeTeam, event.strAwayTeam);

  return {
    id: event.idEvent,
    leagueId: event.idLeague || "",
    season: event.strSeason || "",
    date: event.dateEvent,
    kickoff: kickoffLabel(event.strTime),
    competition: event.strLeague || "Futebol",
    stage: stageLabel(event),
    status,
    homeTeam: event.strHomeTeam || "Mandante",
    awayTeam: event.strAwayTeam || "Visitante",
    homeScore: event.intHomeScore ?? null,
    awayScore: event.intAwayScore ?? null,
    minute: minuteLabel(event.strStatus, status),
    venue: event.strVenue || "Local nao informado",
    country: event.strCountry || "Agenda global",
    homeTeamId: event.idHomeTeam || "",
    awayTeamId: event.idAwayTeam || "",
    homeBadge: event.strHomeTeamBadge || "",
    awayBadge: event.strAwayTeamBadge || "",
    category,
    categoryLabel: MATCH_CATEGORY_LABELS[category],
    betradarMatchId: null,
    source: "live",
    sourceLabel: "TheSportsDB",
    colors: paletteFor(event.strLeague || "Futebol", status)
  };
}

function sortMatches(left, right) {
  const byDate = left.date.localeCompare(right.date);
  if (byDate !== 0) return byDate;

  const byKickoff = left.kickoff.localeCompare(right.kickoff);
  if (byKickoff !== 0) return byKickoff;

  return left.competition.localeCompare(right.competition);
}

function pickFeatured(matches, todayKey) {
  return (
    matches.find((item) => item.status === "live")?.id ||
    matches.find((item) => item.date === todayKey && item.status === "upcoming")?.id ||
    matches.find((item) => item.date === todayKey)?.id ||
    matches[0]?.id ||
    fallbackFeaturedMatchId
  );
}

function buildNotifications(matches, todayKey) {
  const items = [];
  const liveMatch = matches.find((item) => item.status === "live");
  const nextMatch = matches.find((item) => item.date === todayKey && item.status === "upcoming");
  const finishedMatch = matches.find((item) => item.date === todayKey && item.status === "finished");

  if (liveMatch) {
    items.push({
      id: `live-${liveMatch.id}`,
      title: `${liveMatch.homeTeam} x ${liveMatch.awayTeam}`,
      body: `${liveMatch.competition} em andamento com placar ${liveMatch.homeScore ?? 0} x ${liveMatch.awayScore ?? 0}.`,
      time: "Agora",
      kind: "live"
    });
  }

  if (nextMatch) {
    items.push({
      id: `next-${nextMatch.id}`,
      title: "Proximo jogo confirmado",
      body: `${nextMatch.homeTeam} x ${nextMatch.awayTeam} comeca as ${nextMatch.kickoff} em ${nextMatch.competition}.`,
      time: "Hoje",
      kind: "kickoff"
    });
  }

  if (finishedMatch) {
    items.push({
      id: `finished-${finishedMatch.id}`,
      title: "Resultado encerrado",
      body: `${finishedMatch.homeTeam} ${finishedMatch.homeScore ?? 0} x ${finishedMatch.awayScore ?? 0} ${finishedMatch.awayTeam} por ${finishedMatch.competition}.`,
      time: "Hoje",
      kind: "result"
    });
  }

  return items.length ? items : fallbackNotifications;
}

function normalizeFallbackMatch(match) {
  const category = classifyMatchCategory(match.competition, match.homeTeam, match.awayTeam);

  return {
    ...match,
    source: "fallback",
    sourceLabel: "Base local",
    homeBadge: match.homeBadge || "",
    awayBadge: match.awayBadge || "",
    country: match.country || "Base local",
    category,
    categoryLabel: MATCH_CATEGORY_LABELS[category],
    betradarMatchId: match.betradarMatchId || null
  };
}

export function getTodayKey(baseDate = new Date()) {
  return formatDateKey(baseDate);
}

export function getFallbackBundle(baseDate = new Date()) {
  const todayKey = getTodayKey(baseDate);
  const normalizedMatches = fallbackMatches.map(normalizeFallbackMatch).sort(sortMatches);

  return {
    matches: normalizedMatches,
    featuredMatchId: pickFeatured(normalizedMatches, todayKey),
    notifications: buildNotifications(normalizedMatches, todayKey),
    todayKey,
    source: "fallback",
    syncedAt: null
  };
}

export async function fetchLiveMatchesWindow(baseDate = new Date()) {
  const dates = WINDOW_OFFSETS.map((offset) => offsetDate(baseDate, offset));

  const responses = await Promise.all(
    dates.map(async (date) => {
      const payload = await fetchJson(`${API_BASE}/eventsday.php?d=${date}&s=Soccer`, `Falha ao carregar jogos de ${date}`);
      return payload.events || [];
    })
  );

  const todayKey = getTodayKey(baseDate);
  const mappedMatches = responses.flat().map(mapEventToMatch).sort(sortMatches);
  const matches = await enrichMatchesWithBadges(mappedMatches);

  return {
    matches,
    featuredMatchId: pickFeatured(matches, todayKey),
    notifications: buildNotifications(matches, todayKey),
    todayKey,
    source: "live",
    syncedAt: new Date().toISOString()
  };
}

function parseStatValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).replace(",", ".").trim();
  const numeric = Number(normalized);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return value;
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

export async function fetchMatchStats(eventId) {
  const response = await fetch(`${API_BASE}/lookupeventstats.php?id=${eventId}`);
  if (!response.ok) {
    throw new Error("Falha ao carregar estatisticas da partida.");
  }

  const payload = await response.json();
  return (payload.eventstats || []).map((item) => ({
    key: item.idStatistic || `${item.strStat}-${item.intHome}-${item.intAway}`,
    label: formatStatLabel(item.strStat),
    rawLabel: item.strStat,
    homeValue: parseStatValue(item.intHome),
    awayValue: parseStatValue(item.intAway)
  }));
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

export async function fetchMatchTimeline(eventId) {
  const response = await fetch(`${API_BASE}/lookuptimeline.php?id=${eventId}`);
  if (!response.ok) {
    throw new Error("Falha ao carregar eventos da partida.");
  }

  const payload = await response.json();
  return (payload.timeline || []).map((item) => ({
    id: item.idTimeline || `${item.strTimeline}-${item.intTime}-${item.strPlayer}`,
    minute: item.intTime ? `${item.intTime}'` : "-",
    team: item.strTeam || "",
    side: item.strHome === "Yes" ? "home" : "away",
    player: item.strPlayer || "Jogador",
    assist: item.strAssist || "",
    type: formatTimelineType(item.strTimeline, item.strTimelineDetail),
    detail: item.strTimelineDetail || "",
    comment: item.strComment || ""
  }));
}

export async function fetchMatchBroadcasts(eventId) {
  const response = await fetch(`${API_BASE}/lookuptv.php?id=${eventId}`);
  if (!response.ok) {
    throw new Error("Falha ao carregar transmissoes.");
  }

  const payload = await response.json();
  return (payload.tvevent || []).map((item) => ({
    id: item.id || `${item.strChannel}-${item.strCountry}`,
    channel: item.strChannel || "Canal",
    country: item.strCountry || "Internacional",
    logo: item.strLogo || ""
  }));
}

export async function fetchMatchLineup(eventId) {
  const response = await fetch(`${API_BASE}/lookuplineup.php?id=${eventId}`);
  if (!response.ok) {
    throw new Error("Falha ao carregar escalacoes.");
  }

  const payload = await response.json();
  return payload.lineup || [];
}
