import { AUTH_API_BASE_URL } from "./remoteAuth";
import { getFallbackBundle, getTodayKey, MATCH_CATEGORY_LABELS } from "./liveMatches";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function visibilityScore(match) {
  let score = Number(match.visibilityScore || 0);
  if (match.status === "live") score += 20;
  return score;
}

function classifyCategory(match) {
  const text = normalize(`${match.competition} ${match.homeTeam} ${match.awayTeam}`);
  if (/(sub[- ]?20|\bu20\b|under 20)/.test(text)) return "u20";
  if (/(sub[- ]?17|\bu17\b|under 17)/.test(text)) return "u17";
  if (/(women|womens|female|feminino|femenino|ladies|fem\b)/.test(text)) return "womens";
  if (/(selec|national team|world cup|copa america|euro\b|nations league|qualif|friendly international)/.test(text)) return "national";
  return "professional";
}

function paletteFor(status) {
  if (status === "live") return ["#EF4444", "#7F1D1D", "#111827"];
  if (status === "finished") return ["#334155", "#0F172A", "#111827"];
  return ["#22C55E", "#0F766E", "#111827"];
}

function dateLabelFromPlatform(value) {
  if (!value) return "";
  if (String(value).includes("/")) return String(value);
  return String(value).split("-").reverse().slice(0, 2).join("/");
}

function mapResultVenue(label) {
  const normalized = normalize(label);
  if (normalized === "casa" || normalized === "home") return "Casa";
  if (normalized === "fora" || normalized === "away") return "Fora";
  return label || "";
}

function formatPlatformStatLabel(label) {
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

function mapPlatformMatch(match) {
  const category = classifyCategory(match);
  return {
    id: String(match.id || ""),
    leagueId: match.leagueId || "",
    season: match.season || "",
    date: match.date || "",
    kickoff: match.time || "",
    competition: match.competition || "Futebol",
    stage: match.stage || "Partida",
    status: match.status || "upcoming",
    homeTeam: match.homeTeam || "Mandante",
    awayTeam: match.awayTeam || "Visitante",
    homeScore: match.homeScore ?? null,
    awayScore: match.awayScore ?? null,
    minute: match.minute || "Em breve",
    venue: match.venue || "Local nao informado",
    country: match.country || "Agenda global",
    homeTeamId: match.homeTeamId || "",
    awayTeamId: match.awayTeamId || "",
    homeBadge: match.homeBadge || "",
    awayBadge: match.awayBadge || "",
    category,
    categoryLabel: MATCH_CATEGORY_LABELS[category],
    betradarMatchId: null,
    source: "platform",
    sourceLabel: "Match Intelligence Platform",
    colors: paletteFor(match.status || "upcoming"),
    visibilityScore: visibilityScore(match)
  };
}

export async function fetchPlatformHomeBundle() {
  const response = await fetch(`${AUTH_API_BASE_URL}/api/platform/home`);
  if (!response.ok) {
    throw new Error("Falha ao carregar a plataforma esportiva.");
  }

  const payload = await response.json();
  const matches = (payload.highlights || [])
    .concat(payload.live || [], payload.upcoming || [], payload.finished || [])
    .reduce((acc, match) => {
      if (!acc.some((item) => String(item.id) === String(match.id))) {
        acc.push(mapPlatformMatch(match));
      }
      return acc;
    }, [])
    .sort((left, right) =>
      left.date.localeCompare(right.date) ||
      left.kickoff.localeCompare(right.kickoff) ||
      right.visibilityScore - left.visibilityScore
    );

  const todayKey = payload.highlights?.[0]?.date || getTodayKey();
  const featuredMatchId =
    matches.find((item) => item.status === "live")?.id ||
    matches.find((item) => item.date === todayKey && item.status === "upcoming")?.id ||
    matches[0]?.id ||
    null;

  return {
    matches,
    featuredMatchId,
    notifications: [],
    todayKey,
    source: "platform",
    syncedAt: payload.updatedAt || new Date().toISOString()
  };
}

export async function fetchPlatformTeamBundle(teamId) {
  const response = await fetch(`${AUTH_API_BASE_URL}/api/platform/team/${encodeURIComponent(teamId)}`);
  if (!response.ok) {
    throw new Error("Falha ao carregar o time na plataforma.");
  }

  const payload = await response.json();
  return {
    provider: payload.provider || "platform",
    team: payload.team || null,
    recentMatches: (payload.recentMatches || []).map((item) => ({
      id: item.id,
      competition: item.competition,
      stage: item.stage,
      date: item.date,
      dateLabel: dateLabelFromPlatform(item.date),
      kickoff: item.time || "",
      opponent: item.opponent,
      opponentBadge: item.opponentBadge || "",
      venue: item.isHome ? "Casa" : "Fora",
      scored: item.teamScore ?? 0,
      conceded: item.opponentScore ?? 0,
      result: item.result || "E",
      team: item.team,
      teamBadge: item.teamBadge || ""
    })),
    upcomingMatches: (payload.upcomingMatches || []).map((item) => ({
      id: item.id,
      competition: item.competition,
      stage: item.stage,
      date: item.date,
      dateLabel: dateLabelFromPlatform(item.date),
      kickoff: item.time || "",
      opponent: item.opponent,
      opponentBadge: item.opponentBadge || "",
      venue: item.isHome ? "Casa" : "Fora",
      team: item.team,
      teamBadge: item.teamBadge || ""
    })),
    standings: payload.standings || [],
    squad: (payload.squad || []).map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      number: player.number,
      nationality: player.nationality,
      photo: player.photo || "",
      team: payload.team?.name || "Time"
    }))
  };
}

export async function fetchPlatformMatchBundle(matchId) {
  const response = await fetch(`${AUTH_API_BASE_URL}/api/platform/match/${encodeURIComponent(matchId)}`);
  if (!response.ok) {
    throw new Error("Falha ao carregar o jogo na plataforma.");
  }

  const payload = await response.json();
  return {
    provider: payload.provider || "platform",
    access: payload.access || null,
    match: mapPlatformMatch(payload.match || {}),
    stats: (payload.stats || []).map((item) => ({
      key: item.key,
      label: formatPlatformStatLabel(item.label),
      rawLabel: item.label,
      homeValue: item.homeValue,
      awayValue: item.awayValue
    })),
    timeline: (payload.timeline || []).map((item) => ({
      id: item.id,
      minute: item.minute || "-",
      minuteValue: item.minuteValue ?? 0,
      team: item.team || "",
      side: item.side || "home",
      player: item.player || "Jogador",
      assist: item.assist || "",
      type: item.type || "Evento",
      detail: item.detail || "",
      comment: item.comment || ""
    })),
    standings: payload.standings || [],
    h2h: payload.h2h || { summary: { homeWins: 0, awayWins: 0, draws: 0 }, matches: [] },
    homeRecent: (payload.homeRecent || []).map((item) => ({
      id: item.id,
      competition: item.competition,
      stage: item.stage,
      date: item.date,
      dateLabel: dateLabelFromPlatform(item.date),
      kickoff: item.time || "",
      opponent: item.opponent,
      opponentBadge: item.opponentBadge || "",
      venue: item.isHome ? "Casa" : "Fora",
      scored: item.teamScore ?? 0,
      conceded: item.opponentScore ?? 0,
      result: item.result || "E"
    })),
    awayRecent: (payload.awayRecent || []).map((item) => ({
      id: item.id,
      competition: item.competition,
      stage: item.stage,
      date: item.date,
      dateLabel: dateLabelFromPlatform(item.date),
      kickoff: item.time || "",
      opponent: item.opponent,
      opponentBadge: item.opponentBadge || "",
      venue: item.isHome ? "Casa" : "Fora",
      scored: item.teamScore ?? 0,
      conceded: item.opponentScore ?? 0,
      result: item.result || "E"
    })),
    homeUpcoming: (payload.homeUpcoming || []).map((item) => ({
      id: item.id,
      competition: item.competition,
      stage: item.stage,
      date: item.date,
      dateLabel: dateLabelFromPlatform(item.date),
      kickoff: item.time || "",
      opponent: item.opponent,
      opponentBadge: item.opponentBadge || "",
      venue: item.isHome ? "Casa" : "Fora"
    })),
    awayUpcoming: (payload.awayUpcoming || []).map((item) => ({
      id: item.id,
      competition: item.competition,
      stage: item.stage,
      date: item.date,
      dateLabel: dateLabelFromPlatform(item.date),
      kickoff: item.time || "",
      opponent: item.opponent,
      opponentBadge: item.opponentBadge || "",
      venue: item.isHome ? "Casa" : "Fora"
    })),
    traits: payload.traits || null,
    marketStats: payload.marketStats || null
  };
}

export async function searchPlatformTeams(query) {
  if (!String(query || "").trim()) {
    return [];
  }

  const response = await fetch(`${AUTH_API_BASE_URL}/api/platform/search?q=${encodeURIComponent(String(query).trim())}`);
  if (!response.ok) {
    throw new Error("Falha ao buscar times na plataforma.");
  }

  const payload = await response.json();
  return (payload.results || []).map((team) => ({
    id: team.id,
    name: team.name,
    league: team.league || team.country || "",
    badge: team.badge || ""
  }));
}

export function getPlatformFallbackBundle() {
  return getFallbackBundle();
}
