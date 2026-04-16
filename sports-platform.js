const path = require("path");

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const PRIORITY_COMPETITIONS = [
  "Brazilian Serie A",
  "Brasileirao Betano",
  "Serie A Brazil",
  "Serie A",
  "Premier League",
  "La Liga",
  "Copa Libertadores",
  "CONMEBOL Libertadores",
  "Champions League",
  "UEFA Champions League"
];
const COMPETITION_PRIORITY_RULES = [
  { name: "brazilian serie a", country: "brazil", score: 180 },
  { name: "brasileirao betano", country: "brazil", score: 180 },
  { name: "serie a", country: "brazil", score: 180, requireExact: true },
  { name: "premier league", country: "england", score: 170, requireExact: true },
  { name: "la liga", country: "spain", score: 166, requireExact: true },
  { name: "copa libertadores", country: "world", score: 162 },
  { name: "conmebol libertadores", country: "world", score: 162 },
  { name: "champions league", country: "world", score: 158 },
  { name: "uefa champions league", country: "world", score: 158 }
];
const HIGHLIGHT_LEAGUES = [
  "Brazilian Serie A",
  "Brasileirao Betano",
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Champions League",
  "Europa League",
  "Copa Libertadores",
  "Copa Sudamericana",
  "Copa do Brasil",
  "Brasileiro Serie B"
];
const BIG_CLUBS = [
  "Flamengo", "Palmeiras", "Corinthians", "Sao Paulo", "Santos", "Cruzeiro",
  "Atletico Mineiro", "Botafogo", "Gremio", "Internacional", "Vasco", "Bahia",
  "Fortaleza", "Chelsea", "Arsenal", "Liverpool", "Manchester City",
  "Manchester United", "Barcelona", "Real Madrid", "Atletico Madrid",
  "Juventus", "Milan", "Inter", "Bayern", "Borussia Dortmund", "PSG",
  "Benfica", "Porto", "Sporting", "River Plate", "Boca Juniors"
];

function createSportsPlatform(options = {}) {
  const cache = new Map();
  const theSportsDbBase = String(
    process.env.THESPORTSDB_BASE_URL || "https://www.thesportsdb.com/api/v1/json/123"
  ).replace(/\/$/, "");
  const sportmonksBase = String(
    process.env.SPORTSMONKS_BASE_URL || "https://api.sportmonks.com/v3/football"
  ).replace(/\/$/, "");
  const apiFootballBase = String(
    process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io"
  ).replace(/\/$/, "");
  const sportmonksToken =
    process.env.SPORTSMONKS_TOKEN || process.env.SPORTS_API_KEY || "";
  const apiFootballKey = process.env.API_FOOTBALL_KEY || "";
  const configuredProvider = String(
    process.env.SPORTS_PROVIDER || "thesportsdb"
  )
    .trim()
    .toLowerCase();
  const activeProvider =
    configuredProvider === "sportmonks" && sportmonksToken
      ? "sportmonks"
      : configuredProvider === "api-football" && apiFootballKey
        ? "api-football"
      : "thesportsdb";

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number.parseFloat(String(value).replace(",", ".").replace("%", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function average(total, count, digits = 1) {
    if (!count) return null;
    const factor = 10 ** digits;
    return Math.round((total / count) * factor) / factor;
  }

  function percent(value, total, digits = 0) {
    if (!total) return null;
    const factor = 10 ** digits;
    return Math.round((value / total) * 100 * factor) / factor;
  }

  function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  function cacheSet(key, value, ttlMs) {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  async function fetchJsonCached(url, ttlMs = 60000, fallbackValue = null) {
    const cached = cacheGet(url);
    if (cached) return cached;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Falha ao buscar ${url}`);
      }

      const payload = await response.json();
      return cacheSet(url, payload, ttlMs);
    } catch (error) {
      if (fallbackValue !== null) {
        return fallbackValue;
      }
      throw error;
    }
  }

  async function fetchSportmonksJson(endpoint, params = {}, ttlMs = 60000, fallbackValue = null) {
    if (!sportmonksToken) {
      if (fallbackValue !== null) return fallbackValue;
      throw new Error("SPORTSMONKS_TOKEN nao configurado.");
    }

    const url = new URL(
      endpoint.startsWith("http") ? endpoint : `${sportmonksBase}${endpoint}`
    );

    url.searchParams.set("api_token", sportmonksToken);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      url.searchParams.set(key, String(value));
    });

    return fetchJsonCached(url.toString(), ttlMs, fallbackValue);
  }

  async function fetchApiFootballJson(endpoint, params = {}, ttlMs = 60000, fallbackValue = null) {
    if (!apiFootballKey) {
      if (fallbackValue !== null) return fallbackValue;
      throw new Error("API_FOOTBALL_KEY nao configurado.");
    }

    const url = new URL(
      endpoint.startsWith("http") ? endpoint : `${apiFootballBase}${endpoint}`
    );

    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      url.searchParams.set(key, String(value));
    });

    const cacheKey = url.toString();
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(url.toString(), {
        headers: {
          "x-apisports-key": apiFootballKey
        }
      });

      if (!response.ok) {
        throw new Error(`Falha ao buscar ${url.toString()}`);
      }

      const payload = await response.json();
      return cacheSet(cacheKey, payload, ttlMs);
    } catch (error) {
      if (fallbackValue !== null) {
        return fallbackValue;
      }
      throw error;
    }
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function buildOffsetDate(offset) {
    const current = new Date();
    current.setDate(current.getDate() + offset);
    return formatDateKey(current);
  }

  function formatDatePartsInTimeZone(date, timeZone = BRAZIL_TIME_ZONE) {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const parts = formatter.formatToParts(date).reduce((acc, item) => {
      if (item.type !== "literal") {
        acc[item.type] = item.value;
      }
      return acc;
    }, {});

    return {
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      dateLabel: `${parts.day}/${parts.month}`,
      timeLabel: `${parts.hour}:${parts.minute}`
    };
  }

  function parseEventKickoff(event) {
    if (event?.fixture?.timestamp) {
      const parsedFromTimestamp = new Date(Number(event.fixture.timestamp) * 1000);
      if (!Number.isNaN(parsedFromTimestamp.getTime())) return parsedFromTimestamp;
    }

    const fixtureDate = String(event?.fixture?.date || "").trim();
    if (fixtureDate) {
      const parsed = new Date(fixtureDate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (event?.starting_at_timestamp) {
      const parsedFromTimestamp = new Date(Number(event.starting_at_timestamp) * 1000);
      if (!Number.isNaN(parsedFromTimestamp.getTime())) return parsedFromTimestamp;
    }

    const startingAt = String(event?.starting_at || "").trim();
    if (startingAt) {
      const normalizedStartingAt = startingAt.replace(" ", "T");
      const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedStartingAt);
      const parsed = new Date(hasZone ? normalizedStartingAt : `${normalizedStartingAt}Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const timestamp = String(event?.strTimestamp || "").trim();
    if (timestamp) {
      const normalizedTimestamp = timestamp.replace(" ", "T");
      const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedTimestamp);
      const parsed = new Date(hasZone ? normalizedTimestamp : `${normalizedTimestamp}Z`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const dateValue = String(event?.dateEvent || "").trim();
    if (!dateValue) return null;

    const safeTime = String(event?.strTime || "00:00:00").slice(0, 8) || "00:00:00";
    const parsed = new Date(`${dateValue}T${safeTime}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function resolveStatus(rawStatus) {
    const value = normalize(rawStatus);
    if (
      !value ||
      [
        "not started",
        "ns",
        "tbd",
        "postponed",
        "cancelled",
        "canceled",
        "delayed",
        "scheduled",
        "not_started",
        "upcoming",
        "ns",
        "tbd",
        "pst",
        "canc",
        "abd",
        "awd",
        "wo"
      ].includes(value)
    ) {
      return "upcoming";
    }
    if (
      [
        "match finished",
        "ft",
        "full time",
        "after extra time",
        "aet",
        "after penalties",
        "pen",
        "finished",
        "complete",
        "ended",
        "ft"
      ].includes(value) ||
      value.includes("finished")
    ) {
      return "finished";
    }
    return "live";
  }

  function inferCategory(text, gender = "") {
    const value = normalize(`${text} ${gender}`);
    if (/(sub[- ]?20|\bu20\b|under 20)/.test(value)) return "Sub-20";
    if (/(sub[- ]?17|\bu17\b|under 17)/.test(value)) return "Sub-17";
    if (/(women|womens|female|feminino|femenino|ladies|fem\b)/.test(value)) return "Feminino";
    if (/(national team|selec|world cup|copa america|euro\b|nations league)/.test(value)) return "Selecao";
    return "Profissional";
  }

  function isApiFootballFixture(event) {
    return Boolean(event?.fixture?.id || event?.teams?.home || event?.league?.season);
  }

  function getApiFootballHomeTeam(event) {
    return event?.teams?.home || null;
  }

  function getApiFootballAwayTeam(event) {
    return event?.teams?.away || null;
  }

  function getApiFootballGoals(event, side) {
    return toNumber(event?.goals?.[side]);
  }

  function getApiFootballMinute(event) {
    return toNumber(event?.fixture?.status?.elapsed) ?? null;
  }

  function getApiFootballStageLabel(event) {
    if (event?.league?.round) return event.league.round;
    if (event?.league?.season) return String(event.league.season);
    return "Partida";
  }

  function getSportmonksStateLabel(fixture) {
    return (
      fixture?.state?.developer_name ||
      fixture?.state?.name ||
      fixture?.state?.short_name ||
      ""
    );
  }

  function getSportmonksParticipant(fixture, side) {
    const participants = Array.isArray(fixture?.participants) ? fixture.participants : [];
    const expected = side === "home" ? ["home", "localteam"] : ["away", "visitorteam", "visitor"];
    const exact = participants.find((item) =>
      expected.includes(normalize(item?.meta?.location || item?.location || item?.score?.participant))
    );
    if (exact) return exact;
    return side === "home" ? participants[0] || null : participants[1] || participants[0] || null;
  }

  function getSportmonksCurrentGoals(fixture, side) {
    const participant = getSportmonksParticipant(fixture, side);
    if (!participant) return null;

    const participantId = String(participant.id || "");
    const scores = Array.isArray(fixture?.scores) ? fixture.scores : [];
    const preferred = [
      "current",
      "ft",
      "fulltime",
      "full_time",
      "2nd_half",
      "2nd half",
      "penalty_shootout",
      "penalties",
      "aet"
    ];

    const scoreEntry = preferred
      .map((label) =>
        scores.find((score) => {
          const description = normalize(score?.description || "");
          const entrySide = normalize(score?.score?.participant || "");
          return (
            (participantId ? String(score?.participant_id || "") === participantId : entrySide === side) &&
            (description === label || description.includes(label))
          );
        })
      )
      .find(Boolean);

    if (scoreEntry) {
      return toNumber(scoreEntry?.score?.goals);
    }

    return null;
  }

  function getSportmonksMinute(fixture) {
    const candidates = [
      fixture?.minute,
      fixture?.current_minute,
      fixture?.time?.minute,
      fixture?.metadata?.minute
    ];

    for (const candidate of candidates) {
      const value = toNumber(candidate);
      if (value !== null) return Math.round(value);
    }

    return null;
  }

  function getSportmonksStageLabel(fixture) {
    if (fixture?.round?.name) return fixture.round.name;
    if (fixture?.stage?.name) return fixture.stage.name;
    if (fixture?.leg) return `Perna ${fixture.leg}`;
    if (fixture?.season?.name) return fixture.season.name;
    return "Partida";
  }

  function inferVisibilityScoreFromValues(competition, teams, status, country = "") {
    let score = 0;
    const competitionKey = normalize(competition);
    const teamKey = normalize(teams);
    const countryKey = normalize(country);

    for (const rule of COMPETITION_PRIORITY_RULES) {
      const expectedCountry = normalize(rule.country || "");
      const nameMatches = rule.requireExact
        ? competitionKey === normalize(rule.name)
        : competitionKey.includes(normalize(rule.name));
      if (
        nameMatches &&
        (!expectedCountry || countryKey.includes(expectedCountry))
      ) {
        score += rule.score;
      }
    }

    if (HIGHLIGHT_LEAGUES.some((item) => normalize(competition).includes(normalize(item)))) score += 45;
    BIG_CLUBS.forEach((club) => {
      if (normalize(teams).includes(normalize(club))) score += 12;
    });
    if (/(u17|u19|u20|u21|u23|sub-|under |\bres\b|reserve|reserves|ii\b| b\b|women|feminino|femenino)/.test(`${competitionKey} ${teamKey}`)) {
      score -= 65;
    }
    if (status === "live") score += 25;
    if (status === "upcoming") score += 8;
    return score;
  }

  function mapEventToMatch(event) {
    if (isApiFootballFixture(event)) {
      const status = resolveStatus(
        event?.fixture?.status?.short || event?.fixture?.status?.long || ""
      );
      const kickoff = parseEventKickoff(event);
      const kickoffParts = kickoff
        ? formatDatePartsInTimeZone(kickoff)
        : { dateKey: "", dateLabel: "", timeLabel: "" };
      const home = getApiFootballHomeTeam(event);
      const away = getApiFootballAwayTeam(event);
      const competition = event?.league?.name || "Futebol";
      const homeTeam = home?.name || "Mandante";
      const awayTeam = away?.name || "Visitante";
      const minute = getApiFootballMinute(event);

      return {
        id: String(event?.fixture?.id || event?.id || ""),
        competition,
        season: String(event?.league?.season || ""),
        stage: getApiFootballStageLabel(event),
        date: kickoffParts.dateKey,
        dateLabel: kickoffParts.dateLabel,
        time: kickoffParts.timeLabel,
        status,
        minute:
          status === "finished"
            ? "Encerrado"
            : status === "upcoming"
              ? "Em breve"
              : minute !== null
                ? `${minute}'`
                : "Ao vivo",
        visibilityScore: inferVisibilityScoreFromValues(
          competition,
          `${homeTeam} ${awayTeam}`,
          status,
          event?.league?.country || ""
        ),
        country: event?.league?.country || "",
        leagueId: String(event?.league?.id || ""),
        seasonId: String(event?.league?.season || ""),
        homeTeamId: String(home?.id || ""),
        awayTeamId: String(away?.id || ""),
        homeTeam,
        awayTeam,
        homeBadge: home?.logo || "",
        awayBadge: away?.logo || "",
        homeScore: getApiFootballGoals(event, "home"),
        awayScore: getApiFootballGoals(event, "away"),
        venue: event?.fixture?.venue?.name || "",
        provider: "api-football"
      };
    }

    if (event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)) {
      const status = resolveStatus(getSportmonksStateLabel(event));
      const kickoff = parseEventKickoff(event);
      const kickoffParts = kickoff
        ? formatDatePartsInTimeZone(kickoff)
        : { dateKey: "", dateLabel: "", timeLabel: "" };
      const home = getSportmonksParticipant(event, "home");
      const away = getSportmonksParticipant(event, "away");
      const competition = event?.league?.name || "Futebol";
      const homeTeam = home?.name || "Mandante";
      const awayTeam = away?.name || "Visitante";
      const minute = getSportmonksMinute(event);

      return {
        id: String(event?.id || ""),
        competition,
        season: event?.season?.name || String(event?.season_id || ""),
        stage: getSportmonksStageLabel(event),
        date: kickoffParts.dateKey,
        dateLabel: kickoffParts.dateLabel,
        time: kickoffParts.timeLabel,
        status,
        minute:
          status === "finished"
            ? "Encerrado"
            : status === "upcoming"
              ? "Em breve"
              : minute !== null
                ? `${minute}'`
                : "Ao vivo",
        visibilityScore: inferVisibilityScoreFromValues(
          competition,
          `${homeTeam} ${awayTeam}`,
          status,
          event?.league?.country?.name || event?.country?.name || ""
        ),
        country: event?.league?.country?.name || event?.country?.name || "",
        leagueId: String(event?.league_id || event?.league?.id || ""),
        seasonId: String(event?.season_id || event?.season?.id || ""),
        homeTeamId: String(home?.id || ""),
        awayTeamId: String(away?.id || ""),
        homeTeam,
        awayTeam,
        homeBadge: home?.image_path || "",
        awayBadge: away?.image_path || "",
        homeScore: getSportmonksCurrentGoals(event, "home"),
        awayScore: getSportmonksCurrentGoals(event, "away"),
        venue: event?.venue?.name || "",
        provider: "sportmonks"
      };
    }

    const status = resolveStatus(event?.strStatus);
    const kickoff = parseEventKickoff(event);
    const kickoffParts = kickoff
      ? formatDatePartsInTimeZone(kickoff)
      : {
          dateKey: event?.dateEvent || "",
          dateLabel: String(event?.dateEvent || ""),
          timeLabel: String(event?.strTime || "").slice(0, 5)
        };

    return {
      id: String(event?.idEvent || ""),
      competition: event?.strLeague || "Futebol",
      season: event?.strSeason || "",
      stage: event?.intRound ? `Rodada ${event.intRound}` : event?.strSeason || "Partida",
      date: kickoffParts.dateKey,
      dateLabel: kickoffParts.dateLabel,
      time: kickoffParts.timeLabel,
      status,
      minute: status === "finished" ? "Encerrado" : status === "upcoming" ? "Em breve" : String(event?.strStatus || "Ao vivo"),
      visibilityScore: inferVisibilityScoreFromValues(
        event?.strLeague || "Futebol",
        `${event?.strHomeTeam || ""} ${event?.strAwayTeam || ""}`,
        status,
        event?.strCountry || ""
      ),
      country: event?.strCountry || "",
      leagueId: String(event?.idLeague || ""),
      homeTeamId: String(event?.idHomeTeam || ""),
      awayTeamId: String(event?.idAwayTeam || ""),
      homeTeam: event?.strHomeTeam || "Mandante",
      awayTeam: event?.strAwayTeam || "Visitante",
      homeBadge: event?.strHomeTeamBadge || "",
      awayBadge: event?.strAwayTeamBadge || "",
      homeScore: toNumber(event?.intHomeScore),
      awayScore: toNumber(event?.intAwayScore),
      venue: event?.strVenue || "",
      provider: "thesportsdb"
    };
  }

  function dedupeById(items, keyName = "id") {
    const seen = new Set();
    return items.filter((item) => {
      const key = String(item?.[keyName] || item?.fixture?.id || item?.idEvent || item?.idTeam || item?.team?.id || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function fetchEventsByDate(dateKey) {
    if (activeProvider === "sportmonks") {
      const payload = await fetchSportmonksJson(
        `/fixtures/date/${encodeURIComponent(dateKey)}`,
        {
          include: "participants;league;league.country;season;stage;round;venue;state;scores",
          per_page: 50,
          order: "asc"
        },
        30000,
        { data: [] }
      );
      return Array.isArray(payload?.data) ? payload.data : [];
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/fixtures",
        { date: dateKey, timezone: BRAZIL_TIME_ZONE },
        30000,
        { response: [] }
      );
      return Array.isArray(payload?.response) ? payload.response : [];
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/eventsday.php?d=${dateKey}&s=Soccer`, 30000, { events: [] });
    return payload.events || [];
  }

  async function fetchInplayEvents() {
    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/fixtures",
        { live: "all", timezone: BRAZIL_TIME_ZONE },
        10000,
        { response: [] }
      );
      return Array.isArray(payload?.response) ? payload.response : [];
    }

    if (activeProvider !== "sportmonks") return [];

    const payload = await fetchSportmonksJson(
      "/livescores/inplay",
      {
        include: "participants;league;league.country;season;stage;round;venue;state;scores"
      },
      10000,
      { data: [] }
    );

    return Array.isArray(payload?.data) ? payload.data : [];
  }

  async function fetchHomeFeed() {
    const dateKeys = [buildOffsetDate(-1), buildOffsetDate(0), buildOffsetDate(1)];
    const [eventGroups, inplayEvents] = await Promise.all([
      Promise.all(dateKeys.map((dateKey) => fetchEventsByDate(dateKey))),
      fetchInplayEvents()
    ]);
    const matches = dedupeById([...inplayEvents, ...eventGroups.flat()].map(mapEventToMatch));

    const live = matches.filter((match) => match.status === "live").sort((a, b) => b.visibilityScore - a.visibilityScore);
    const upcoming = matches.filter((match) => match.status === "upcoming").sort((a, b) => b.visibilityScore - a.visibilityScore);
    const finished = matches.filter((match) => match.status === "finished").sort((a, b) => b.visibilityScore - a.visibilityScore);

    const competitions = Array.from(matches.reduce((acc, match) => {
      const key = `${match.leagueId || "league"}-${match.competition}-${match.season || "season"}`;
      if (!acc.has(key)) {
        acc.set(key, {
          key,
          competition: match.competition,
          season: match.season,
          country: match.country,
          leagueId: match.leagueId,
          matches: []
        });
      }
      acc.get(key).matches.push(match);
      return acc;
    }, new Map()).values())
      .map((group) => ({
        ...group,
        matches: group.matches.sort((a, b) => {
          if (a.status === "live" && b.status !== "live") return -1;
          if (a.status !== "live" && b.status === "live") return 1;
          return b.visibilityScore - a.visibilityScore;
        })
      }))
      .sort((a, b) => {
        const leftScore = Math.max(...a.matches.map((item) => item.visibilityScore));
        const rightScore = Math.max(...b.matches.map((item) => item.visibilityScore));
        return rightScore - leftScore || a.competition.localeCompare(b.competition);
      });

    return {
      updatedAt: new Date().toISOString(),
      highlights: [...live, ...upcoming, ...finished].slice(0, 12),
      live,
      upcoming,
      finished,
      competitions
    };
  }

  async function searchTeams(query) {
    if (activeProvider === "sportmonks") {
      const payload = await fetchSportmonksJson(
        `/teams/search/${encodeURIComponent(query)}`,
        { include: "country;venue", per_page: 25 },
        300000,
        { data: [] }
      );
      const teams = Array.isArray(payload?.data) ? payload.data : [];
      return dedupeById(teams.map((team) => ({
        id: String(team.id || ""),
        name: team.name || "Time",
        badge: team.image_path || "",
        country: team.country?.name || "",
        league: "",
        category: inferCategory(`${team.name || ""} ${team.type || ""}`, team.gender || ""),
        stadium: team.venue?.name || ""
      })));
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/teams",
        { search: query },
        300000,
        { response: [] }
      );
      const teams = Array.isArray(payload?.response) ? payload.response : [];
      return dedupeById(teams.map((entry) => ({
        id: String(entry?.team?.id || ""),
        name: entry?.team?.name || "Time",
        badge: entry?.team?.logo || "",
        country: entry?.team?.country || "",
        league: "",
        category: inferCategory(`${entry?.team?.name || ""} ${entry?.team?.code || ""}`),
        stadium: entry?.venue?.name || ""
      })));
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/searchteams.php?t=${encodeURIComponent(query)}`, 300000, { teams: [] });
    return dedupeById((payload.teams || []).map((team) => ({
      id: String(team.idTeam || ""),
      name: team.strTeam || "Time",
      badge: team.strBadge || "",
      country: team.strCountry || "",
      league: team.strLeague || "",
      category: inferCategory(`${team.strTeam || ""} ${team.strLeague || ""}`, team.strGender || ""),
      stadium: team.strStadium || ""
    })));
  }

  async function fetchEventLookup(eventId) {
    if (activeProvider === "sportmonks") {
      const payload = await fetchSportmonksJson(
        `/fixtures/${encodeURIComponent(eventId)}`,
        {
          include:
            "participants;league;league.country;season;stage;round;venue;state;scores;statistics;timeline;events;lineups"
        },
        60000,
        { data: null }
      );
      return payload?.data || null;
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/fixtures",
        { id: eventId, timezone: BRAZIL_TIME_ZONE },
        60000,
        { response: [] }
      );
      return payload?.response?.[0] || null;
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/lookupevent.php?id=${encodeURIComponent(eventId)}`, 60000, { events: [] });
    return payload.events?.[0] || null;
  }

  async function fetchTeamLookup(teamId) {
    if (activeProvider === "sportmonks") {
      const payload = await fetchSportmonksJson(
        `/teams/${encodeURIComponent(teamId)}`,
        {
          include:
            "country;venue;players;latest;latest.participants;latest.league;latest.season;latest.stage;latest.round;latest.state;latest.scores;upcoming;upcoming.participants;upcoming.league;upcoming.season;upcoming.stage;upcoming.round;upcoming.state;activeSeasons"
        },
        600000,
        { data: null }
      );
      return payload?.data || null;
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/teams",
        { id: teamId },
        600000,
        { response: [] }
      );
      return payload?.response?.[0] || null;
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/lookupteam.php?id=${encodeURIComponent(teamId)}`, 1800000, { teams: [] });
    return payload.teams?.[0] || null;
  }

  async function fetchTeamPlayers(teamId) {
    if (activeProvider === "sportmonks") {
      const team = await fetchTeamLookup(teamId);
      return Array.isArray(team?.players) ? team.players : [];
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/players/squads",
        { team: teamId },
        600000,
        { response: [] }
      );
      return payload?.response?.[0]?.players || [];
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/lookup_all_players.php?id=${encodeURIComponent(teamId)}`, 600000, { player: [] });
    return payload.player || [];
  }

  async function fetchPreviousTeamEvents(teamId) {
    if (activeProvider === "sportmonks") {
      const team = await fetchTeamLookup(teamId);
      return Array.isArray(team?.latest) ? team.latest : [];
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/fixtures",
        { team: teamId, last: 10, timezone: BRAZIL_TIME_ZONE },
        90000,
        { response: [] }
      );
      return Array.isArray(payload?.response) ? payload.response : [];
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/eventslast.php?id=${encodeURIComponent(teamId)}`, 90000, { results: [] });
    return payload.results || [];
  }

  async function fetchUpcomingTeamEvents(teamId) {
    if (activeProvider === "sportmonks") {
      const team = await fetchTeamLookup(teamId);
      return Array.isArray(team?.upcoming) ? team.upcoming : [];
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/fixtures",
        { team: teamId, next: 10, timezone: BRAZIL_TIME_ZONE },
        90000,
        { response: [] }
      );
      return Array.isArray(payload?.response) ? payload.response : [];
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/eventsnext.php?id=${encodeURIComponent(teamId)}`, 90000, { events: [] });
    return payload.events || [];
  }

  async function fetchSeasonEvents(leagueId, season) {
    if (activeProvider === "sportmonks") return [];
    if (activeProvider === "api-football") return [];
    if (!leagueId || !season) return [];
    const payload = await fetchJsonCached(`${theSportsDbBase}/eventsseason.php?id=${encodeURIComponent(leagueId)}&s=${encodeURIComponent(season)}`, 300000, { events: [] });
    return payload.events || [];
  }

  async function fetchEventStats(eventId) {
    if (activeProvider === "sportmonks") {
      const fixture = await fetchEventLookup(eventId);
      const stats = Array.isArray(fixture?.statistics) ? fixture.statistics : [];

      return stats
        .map((item, index) => {
          const values = Array.isArray(item?.data) ? item.data : item?.values || [];
          const home = values.find((entry) => normalize(entry?.location || entry?.participant || entry?.value?.participant) === "home");
          const away = values.find((entry) => normalize(entry?.location || entry?.participant || entry?.value?.participant) === "away");
          const label =
            item?.type?.name ||
            item?.type?.developer_name ||
            item?.name ||
            item?.label ||
            `Stat ${index + 1}`;

          const homeValue =
            toNumber(home?.value?.total) ??
            toNumber(home?.value?.value) ??
            toNumber(home?.value) ??
            toNumber(home?.data);
          const awayValue =
            toNumber(away?.value?.total) ??
            toNumber(away?.value?.value) ??
            toNumber(away?.value) ??
            toNumber(away?.data);

          return {
            key: item?.id || `${label}-${index}`,
            label,
            homeValue,
            awayValue
          };
        })
        .filter((item) => item.homeValue !== null || item.awayValue !== null);
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/fixtures/statistics",
        { fixture: eventId },
        60000,
        { response: [] }
      );
      const rows = Array.isArray(payload?.response) ? payload.response : [];
      const home = rows.find((item) => normalize(item?.team?.name) && item?.team);
      const away = rows.find((item, index) => index === 1) || null;
      const labels = new Map();

      rows.forEach((row, sideIndex) => {
        const entries = Array.isArray(row?.statistics) ? row.statistics : [];
        entries.forEach((entry) => {
          const key = entry?.type || `Stat-${labels.size + 1}`;
          if (!labels.has(key)) {
            labels.set(key, {
              key,
              label: key,
              homeValue: null,
              awayValue: null
            });
          }
          const target = labels.get(key);
          const numericValue = toNumber(entry?.value);
          if (sideIndex === 0) target.homeValue = numericValue;
          if (sideIndex === 1) target.awayValue = numericValue;
        });
      });

      return Array.from(labels.values()).filter((item) => item.homeValue !== null || item.awayValue !== null);
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/lookupeventstats.php?id=${encodeURIComponent(eventId)}`, 60000, { eventstats: [] });
    return (payload.eventstats || []).map((item) => ({
      key: item.idStatistic || `${item.strStat}-${item.intHome}-${item.intAway}`,
      label: item.strStat || "Stat",
      homeValue: toNumber(item.intHome),
      awayValue: toNumber(item.intAway)
    }));
  }

  async function fetchTimeline(eventId) {
    if (activeProvider === "sportmonks") {
      const fixture = await fetchEventLookup(eventId);
      const events = Array.isArray(fixture?.events) ? fixture.events : [];

      return events
        .map((item, index) => ({
          id: item?.id || `${item?.minute || "0"}-${index}`,
          minute: item?.minute ? `${item.minute}'` : "-",
          minuteValue: toNumber(item?.minute) || 0,
          team: item?.participant?.name || "",
          side:
            normalize(item?.participant?.meta?.location || item?.participant?.location || item?.location) === "home"
              ? "home"
              : "away",
          type:
            item?.type?.name ||
            item?.type?.developer_name ||
            item?.detail ||
            "Evento",
          player: item?.player?.display_name || item?.player?.name || "Jogador"
        }))
        .sort((a, b) => a.minuteValue - b.minuteValue);
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/fixtures/events",
        { fixture: eventId },
        60000,
        { response: [] }
      );
      return (payload?.response || [])
        .map((item, index) => ({
          id: item?.time?.elapsed ? `${item.time.elapsed}-${index}` : `${index}`,
          minute: item?.time?.elapsed ? `${item.time.elapsed}'` : "-",
          minuteValue: toNumber(item?.time?.elapsed) || 0,
          team: item?.team?.name || "",
          side: index === 0 ? "home" : "away",
          type: item?.type || item?.detail || "Evento",
          player: item?.player?.name || item?.assist?.name || "Jogador"
        }))
        .sort((a, b) => a.minuteValue - b.minuteValue);
    }

    const payload = await fetchJsonCached(`${theSportsDbBase}/lookuptimeline.php?id=${encodeURIComponent(eventId)}`, 60000, { timeline: [] });
    return (payload.timeline || []).map((item) => ({
      id: item.idTimeline || `${item.strTimeline}-${item.intTime}-${item.strPlayer}`,
      minute: item.intTime ? `${item.intTime}'` : "-",
      minuteValue: toNumber(item.intTime) || 0,
      team: item.strTeam || "",
      side: item.strHome === "Yes" ? "home" : "away",
      type: item.strTimelineDetail || item.strTimeline || "Evento",
      player: item.strPlayer || "Jogador"
    }));
  }

  function determineTeamSide(event, teamId, teamName) {
    if (isApiFootballFixture(event)) {
      const home = getApiFootballHomeTeam(event);
      const away = getApiFootballAwayTeam(event);
      if (teamId && String(home?.id || "") === String(teamId)) return "home";
      if (teamId && String(away?.id || "") === String(teamId)) return "away";
      if (normalize(home?.name) === normalize(teamName)) return "home";
      if (normalize(away?.name) === normalize(teamName)) return "away";
      return "";
    }

    if (event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)) {
      const home = getSportmonksParticipant(event, "home");
      const away = getSportmonksParticipant(event, "away");
      if (teamId && String(home?.id || "") === String(teamId)) return "home";
      if (teamId && String(away?.id || "") === String(teamId)) return "away";
      if (normalize(home?.name) === normalize(teamName)) return "home";
      if (normalize(away?.name) === normalize(teamName)) return "away";
      return "";
    }

    if (teamId && String(event?.idHomeTeam || "") === String(teamId)) return "home";
    if (teamId && String(event?.idAwayTeam || "") === String(teamId)) return "away";
    if (normalize(event?.strHomeTeam) === normalize(teamName)) return "home";
    if (normalize(event?.strAwayTeam) === normalize(teamName)) return "away";
    return "";
  }

  function mapRecentMatch(event, teamId, teamName) {
    const teamSide = determineTeamSide(event, teamId, teamName);
    if (!teamSide) return null;
    const teamIsHome = teamSide === "home";
    const home = isApiFootballFixture(event)
      ? getApiFootballHomeTeam(event)
      : event?.starting_at
        ? getSportmonksParticipant(event, "home")
        : null;
    const away = isApiFootballFixture(event)
      ? getApiFootballAwayTeam(event)
      : event?.starting_at
        ? getSportmonksParticipant(event, "away")
        : null;
    const teamScore = isApiFootballFixture(event)
      ? getApiFootballGoals(event, teamIsHome ? "home" : "away") || 0
      : event?.starting_at
      ? getSportmonksCurrentGoals(event, teamIsHome ? "home" : "away") || 0
      : toNumber(teamIsHome ? event.intHomeScore : event.intAwayScore) || 0;
    const opponentScore = isApiFootballFixture(event)
      ? getApiFootballGoals(event, teamIsHome ? "away" : "home") || 0
      : event?.starting_at
      ? getSportmonksCurrentGoals(event, teamIsHome ? "away" : "home") || 0
      : toNumber(teamIsHome ? event.intAwayScore : event.intHomeScore) || 0;
    const kickoff = parseEventKickoff(event);
    const parts = kickoff ? formatDatePartsInTimeZone(kickoff) : { dateLabel: String(event.dateEvent || ""), timeLabel: String(event.strTime || "").slice(0, 5) };

    return {
      id: String(event.idEvent || event.id || event?.fixture?.id || ""),
      competition: event.strLeague || event?.league?.name || "Futebol",
      stage:
        isApiFootballFixture(event)
          ? getApiFootballStageLabel(event)
          : event?.starting_at
          ? getSportmonksStageLabel(event)
          : event.intRound
            ? `Rodada ${event.intRound}`
            : event.strSeason || "Partida",
      date: parts.dateLabel,
      time: parts.timeLabel,
      team: teamIsHome ? home?.name || event.strHomeTeam : away?.name || event.strAwayTeam,
      opponent: teamIsHome ? away?.name || event.strAwayTeam : home?.name || event.strHomeTeam,
      teamBadge: teamIsHome ? home?.image_path || home?.logo || event.strHomeTeamBadge || "" : away?.image_path || away?.logo || event.strAwayTeamBadge || "",
      opponentBadge: teamIsHome ? away?.image_path || away?.logo || event.strAwayTeamBadge || "" : home?.image_path || home?.logo || event.strHomeTeamBadge || "",
      isHome: teamIsHome,
      teamScore,
      opponentScore,
      scoreLine: `${teamScore} x ${opponentScore}`,
      result: teamScore > opponentScore ? "V" : teamScore < opponentScore ? "D" : "E",
      status: resolveStatus(event.strStatus || event?.fixture?.status?.short)
    };
  }

  function mapUpcomingMatch(event, teamId, teamName) {
    const teamSide = determineTeamSide(event, teamId, teamName);
    if (!teamSide) return null;
    const teamIsHome = teamSide === "home";
    const kickoff = parseEventKickoff(event);
    const parts = kickoff ? formatDatePartsInTimeZone(kickoff) : { dateLabel: String(event.dateEvent || ""), timeLabel: String(event.strTime || "").slice(0, 5) };
    const home = isApiFootballFixture(event)
      ? getApiFootballHomeTeam(event)
      : event?.starting_at
        ? getSportmonksParticipant(event, "home")
        : null;
    const away = isApiFootballFixture(event)
      ? getApiFootballAwayTeam(event)
      : event?.starting_at
        ? getSportmonksParticipant(event, "away")
        : null;

    return {
      id: String(event.idEvent || event.id || event?.fixture?.id || ""),
      competition: event.strLeague || event?.league?.name || "Futebol",
      stage:
        isApiFootballFixture(event)
          ? getApiFootballStageLabel(event)
          : event?.starting_at
          ? getSportmonksStageLabel(event)
          : event.intRound
            ? `Rodada ${event.intRound}`
            : event.strSeason || "Partida",
      date: parts.dateLabel,
      time: parts.timeLabel,
      team: teamIsHome ? home?.name || event.strHomeTeam : away?.name || event.strAwayTeam,
      opponent: teamIsHome ? away?.name || event.strAwayTeam : home?.name || event.strHomeTeam,
      teamBadge: teamIsHome ? home?.image_path || home?.logo || event.strHomeTeamBadge || "" : away?.image_path || away?.logo || event.strAwayTeamBadge || "",
      opponentBadge: teamIsHome ? away?.image_path || away?.logo || event.strAwayTeamBadge || "" : home?.image_path || home?.logo || event.strHomeTeamBadge || "",
      isHome: teamIsHome,
      venue: event.strVenue || event?.venue?.name || event?.fixture?.venue?.name || ""
    };
  }

  function buildStandings(events, focusTeamIds = []) {
    const standingsMap = new Map();

    function ensureTeam(id, name, badge) {
      const key = String(id || name || "").trim();
      if (!key) return null;
      if (!standingsMap.has(key)) {
        standingsMap.set(key, {
          key,
          teamId: String(id || ""),
          teamName: name || "Time",
          badge: badge || "",
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
      if (!team.badge && badge) team.badge = badge;
      return team;
    }

    events.filter((event) => resolveStatus(event.strStatus) === "finished").forEach((event) => {
      const homeScore = toNumber(event.intHomeScore);
      const awayScore = toNumber(event.intAwayScore);
      if (homeScore === null || awayScore === null) return;

      const home = ensureTeam(event.idHomeTeam, event.strHomeTeam, event.strHomeTeamBadge);
      const away = ensureTeam(event.idAwayTeam, event.strAwayTeam, event.strAwayTeamBadge);
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
        highlight: focusTeamIds.some((item) => item && String(item) === String(team.teamId))
      }))
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamName.localeCompare(b.teamName))
      .map((team, index) => ({ ...team, rank: index + 1 }));
  }

  async function fetchSeasonStandings(seasonId) {
    if (!seasonId) return [];

    if (activeProvider === "sportmonks") {
      const payload = await fetchSportmonksJson(
        `/standings/seasons/${encodeURIComponent(seasonId)}`,
        { include: "participant" },
        120000,
        { data: [] }
      );
      return Array.isArray(payload?.data) ? payload.data : [];
    }

    if (activeProvider === "api-football") {
      return [];
    }

    return [];
  }

  async function fetchCompetitionStandings(leagueId, season, seasonId = "") {
    if (activeProvider === "sportmonks") {
      return fetchSeasonStandings(seasonId);
    }

    if (activeProvider === "api-football") {
      if (!leagueId || !season) return [];
      const payload = await fetchApiFootballJson(
        "/standings",
        { league: leagueId, season },
        120000,
        { response: [] }
      );
      return payload?.response?.[0]?.league?.standings?.flat?.() || [];
    }

    return fetchSeasonEvents(leagueId, season);
  }

  function buildStandingsFromSportmonks(rows, focusTeamIds = []) {
    return rows
      .map((row, index) => ({
        rank: toNumber(row?.position) || index + 1,
        teamId: String(row?.participant_id || row?.participant?.id || ""),
        teamName: row?.participant?.name || "Time",
        badge: row?.participant?.image_path || "",
        played: toNumber(row?.details?.matches_played) || toNumber(row?.games_played) || 0,
        wins: toNumber(row?.details?.wins) || 0,
        draws: toNumber(row?.details?.draws) || 0,
        losses: toNumber(row?.details?.lost) || toNumber(row?.details?.losses) || 0,
        goalsFor: toNumber(row?.details?.goals_scored) || 0,
        goalsAgainst: toNumber(row?.details?.goals_against) || 0,
        goalDifference:
          toNumber(row?.details?.goal_difference) ??
          ((toNumber(row?.details?.goals_scored) || 0) - (toNumber(row?.details?.goals_against) || 0)),
        points: toNumber(row?.points) || 0,
        highlight: focusTeamIds.some((item) => item && String(item) === String(row?.participant_id || row?.participant?.id || ""))
      }))
      .sort((a, b) => a.rank - b.rank || b.points - a.points || a.teamName.localeCompare(b.teamName));
  }

  function buildStandingsFromApiFootball(rows, focusTeamIds = []) {
    return (rows || [])
      .map((row, index) => ({
        rank: toNumber(row?.rank) || index + 1,
        teamId: String(row?.team?.id || ""),
        teamName: row?.team?.name || "Time",
        badge: row?.team?.logo || "",
        played: toNumber(row?.all?.played) || 0,
        wins: toNumber(row?.all?.win) || 0,
        draws: toNumber(row?.all?.draw) || 0,
        losses: toNumber(row?.all?.lose) || 0,
        goalsFor: toNumber(row?.all?.goals?.for) || 0,
        goalsAgainst: toNumber(row?.all?.goals?.against) || 0,
        goalDifference: toNumber(row?.goalsDiff) || 0,
        points: toNumber(row?.points) || 0,
        highlight: focusTeamIds.some((item) => item && String(item) === String(row?.team?.id || ""))
      }))
      .sort((a, b) => a.rank - b.rank || b.points - a.points || a.teamName.localeCompare(b.teamName));
  }

  function computeLineStats(matches) {
    const sample = matches.length;
    const stats = matches.reduce((acc, match) => {
      const totalGoals = (match.teamScore || 0) + (match.opponentScore || 0);
      acc.goalsFor += match.teamScore || 0;
      acc.goalsAgainst += match.opponentScore || 0;
      acc.wins += match.result === "V" ? 1 : 0;
      acc.draws += match.result === "E" ? 1 : 0;
      acc.losses += match.result === "D" ? 1 : 0;
      acc.btts += (match.teamScore || 0) > 0 && (match.opponentScore || 0) > 0 ? 1 : 0;
      acc.over15 += totalGoals > 1 ? 1 : 0;
      acc.over25 += totalGoals > 2 ? 1 : 0;
      acc.under35 += totalGoals < 4 ? 1 : 0;
      acc.cleanSheets += (match.opponentScore || 0) === 0 ? 1 : 0;
      acc.failedToScore += (match.teamScore || 0) === 0 ? 1 : 0;
      return acc;
    }, { goalsFor: 0, goalsAgainst: 0, wins: 0, draws: 0, losses: 0, btts: 0, over15: 0, over25: 0, under35: 0, cleanSheets: 0, failedToScore: 0 });

    return {
      sample,
      ...stats,
      goalsForAvg: average(stats.goalsFor, sample),
      goalsAgainstAvg: average(stats.goalsAgainst, sample),
      bttsPct: percent(stats.btts, sample),
      over15Pct: percent(stats.over15, sample),
      over25Pct: percent(stats.over25, sample),
      under35Pct: percent(stats.under35, sample),
      cleanSheetPct: percent(stats.cleanSheets, sample),
      failedToScorePct: percent(stats.failedToScore, sample)
    };
  }

  function buildTraitSections(matches, emptyLabel = "Sem caracteristicas importantes") {
    const stats = computeLineStats(matches);
    const strengths = [];
    const weaknesses = [];
    const style = [];
    const alerts = [];

    if (stats.over25Pct !== null && stats.over25Pct >= 65) {
      strengths.push({ title: "Tendencia de over 2.5 gols", body: `${stats.over25Pct}% da amostra passou de 2.5 gols.` });
    }
    if (stats.under35Pct !== null && stats.under35Pct >= 70) {
      strengths.push({ title: "Jogo controlado abaixo de 3.5", body: `${stats.under35Pct}% da amostra ficou abaixo de 3.5 gols.` });
    }
    if (stats.cleanSheetPct !== null && stats.cleanSheetPct >= 40) {
      strengths.push({ title: "Boa taxa de clean sheet", body: `${stats.cleanSheetPct}% dos jogos terminaram sem sofrer gol.` });
    }
    if (stats.goalsAgainstAvg !== null && stats.goalsAgainstAvg >= 1.6) {
      weaknesses.push({ title: "Defesa vulneravel", body: `Sofre em media ${stats.goalsAgainstAvg} gol por jogo.` });
    }
    if (stats.failedToScorePct !== null && stats.failedToScorePct >= 35) {
      weaknesses.push({ title: "Oscilacao ofensiva", body: `Passou em branco em ${stats.failedToScorePct}% da amostra.` });
    }
    if (stats.bttsPct !== null && stats.bttsPct >= 60) {
      style.push({ title: "Perfil de ambos marcam", body: `BTTS apareceu em ${stats.bttsPct}% dos jogos recentes.` });
    }
    if (stats.goalsForAvg !== null && stats.goalsAgainstAvg !== null) {
      style.push({
        title: stats.goalsForAvg >= stats.goalsAgainstAvg ? "Ataque mais forte que a defesa" : "Time reativo e exposto",
        body: `Media de ${stats.goalsForAvg || 0} gol marcado e ${stats.goalsAgainstAvg || 0} sofrido.`
      });
    }
    if (stats.losses >= 4) {
      alerts.push({ title: "Recorte com derrota frequente", body: `${stats.losses} derrota(s) na amostra recente.` });
    }
    if (stats.over25Pct !== null && stats.over25Pct >= 65 && stats.cleanSheetPct !== null && stats.cleanSheetPct < 20) {
      alerts.push({ title: "Jogo tende a abrir quando sofre pressao", body: "A combinacao de poucos clean sheets com over alto indica partidas abertas." });
    }

    return {
      strengths: strengths.length ? strengths : [{ title: emptyLabel, body: "" }],
      weaknesses: weaknesses.length ? weaknesses : [{ title: emptyLabel, body: "" }],
      style: style.length ? style : [{ title: emptyLabel, body: "" }],
      alerts: alerts.length ? alerts : [{ title: emptyLabel, body: "" }],
      metrics: stats
    };
  }

  function buildH2H(events, homeTeamId, awayTeamId) {
    const matches = dedupeById(events)
      .filter((event) =>
        resolveStatus(
          isApiFootballFixture(event)
            ? event?.fixture?.status?.short || event?.fixture?.status?.long
            : event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)
            ? getSportmonksStateLabel(event)
            : event.strStatus
        ) === "finished"
      )
      .filter((event) => {
        const homeId = String(
          isApiFootballFixture(event)
            ? getApiFootballHomeTeam(event)?.id || ""
            : event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)
            ? getSportmonksParticipant(event, "home")?.id || ""
            : event.idHomeTeam || ""
        );
        const awayId = String(
          isApiFootballFixture(event)
            ? getApiFootballAwayTeam(event)?.id || ""
            : event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)
            ? getSportmonksParticipant(event, "away")?.id || ""
            : event.idAwayTeam || ""
        );
        return (
          (homeId === String(homeTeamId) && awayId === String(awayTeamId)) ||
          (homeId === String(awayTeamId) && awayId === String(homeTeamId))
        );
      })
      .sort((a, b) => (parseEventKickoff(b)?.getTime() || 0) - (parseEventKickoff(a)?.getTime() || 0));

    const summary = matches.reduce((acc, event) => {
      const homeScore =
        isApiFootballFixture(event)
          ? getApiFootballGoals(event, "home") || 0
          : event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)
          ? getSportmonksCurrentGoals(event, "home") || 0
          : toNumber(event.intHomeScore) || 0;
      const awayScore =
        isApiFootballFixture(event)
          ? getApiFootballGoals(event, "away") || 0
          : event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)
          ? getSportmonksCurrentGoals(event, "away") || 0
          : toNumber(event.intAwayScore) || 0;
      if (homeScore === awayScore) {
        acc.draws += 1;
      } else {
        const winnerId = homeScore > awayScore
          ? String(
              isApiFootballFixture(event)
                ? getApiFootballHomeTeam(event)?.id || ""
                : event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)
                ? getSportmonksParticipant(event, "home")?.id || ""
                : event.idHomeTeam || ""
            )
          : String(
              isApiFootballFixture(event)
                ? getApiFootballAwayTeam(event)?.id || ""
                : event?.starting_at || event?.starting_at_timestamp || Array.isArray(event?.participants)
                ? getSportmonksParticipant(event, "away")?.id || ""
                : event.idAwayTeam || ""
            );
        if (winnerId === String(homeTeamId)) acc.homeWins += 1;
        if (winnerId === String(awayTeamId)) acc.awayWins += 1;
      }
      return acc;
    }, { homeWins: 0, awayWins: 0, draws: 0 });

    return {
      summary,
      matches: matches.slice(0, 10).map((event) => {
        const kickoff = parseEventKickoff(event);
        const parts = kickoff ? formatDatePartsInTimeZone(kickoff) : { dateLabel: String(event.dateEvent || ""), timeLabel: String(event.strTime || "").slice(0, 5) };
        const home = isApiFootballFixture(event)
          ? getApiFootballHomeTeam(event)
          : event?.starting_at
            ? getSportmonksParticipant(event, "home")
            : null;
        const away = isApiFootballFixture(event)
          ? getApiFootballAwayTeam(event)
          : event?.starting_at
            ? getSportmonksParticipant(event, "away")
            : null;
        return {
          id: String(event.idEvent || event.id || event?.fixture?.id || ""),
          competition: event.strLeague || event?.league?.name || "Futebol",
          date: parts.dateLabel,
          time: parts.timeLabel,
          homeTeam: home?.name || event.strHomeTeam || "Mandante",
          awayTeam: away?.name || event.strAwayTeam || "Visitante",
          homeBadge: home?.image_path || home?.logo || event.strHomeTeamBadge || "",
          awayBadge: away?.image_path || away?.logo || event.strAwayTeamBadge || "",
          homeScore: isApiFootballFixture(event) ? getApiFootballGoals(event, "home") || 0 : event?.starting_at ? getSportmonksCurrentGoals(event, "home") || 0 : toNumber(event.intHomeScore) || 0,
          awayScore: isApiFootballFixture(event) ? getApiFootballGoals(event, "away") || 0 : event?.starting_at ? getSportmonksCurrentGoals(event, "away") || 0 : toNumber(event.intAwayScore) || 0
        };
      })
    };
  }

  async function fetchHeadToHeadFixtures(homeTeamId, awayTeamId) {
    if (!homeTeamId || !awayTeamId) return [];

    if (activeProvider === "sportmonks") {
      const payload = await fetchSportmonksJson(
        `/fixtures/head-to-head/${encodeURIComponent(homeTeamId)}/${encodeURIComponent(awayTeamId)}`,
        {
          include: "participants;league;season;stage;round;state;scores",
          per_page: 20,
          order: "desc"
        },
        120000,
        { data: [] }
      );
      return Array.isArray(payload?.data) ? payload.data : [];
    }

    if (activeProvider === "api-football") {
      const payload = await fetchApiFootballJson(
        "/fixtures/headtohead",
        {
          h2h: `${homeTeamId}-${awayTeamId}`,
          last: 10,
          timezone: BRAZIL_TIME_ZONE
        },
        120000,
        { response: [] }
      );
      return Array.isArray(payload?.response) ? payload.response : [];
    }

    return [];
  }

  function buildMarketStats(homeMatches, awayMatches) {
    const home = computeLineStats(homeMatches);
    const away = computeLineStats(awayMatches);
    return {
      goals: {
        freeRows: [
          { label: "Over 1.5", left: `${home.over15Pct ?? 0}%`, center: "base", right: `${away.over15Pct ?? 0}%` },
          { label: "Over 2.5", left: `${home.over25Pct ?? 0}%`, center: "base", right: `${away.over25Pct ?? 0}%` },
          { label: "Ambas marcam", left: `${home.bttsPct ?? 0}%`, center: "base", right: `${away.bttsPct ?? 0}%` }
        ],
        premiumRows: [
          { label: "Media de gols", left: String(home.goalsForAvg ?? "-"), center: "X", right: String(away.goalsForAvg ?? "-") },
          { label: "Clean sheet", left: `${home.cleanSheetPct ?? 0}%`, center: "X", right: `${away.cleanSheetPct ?? 0}%` },
          { label: "Falhou em marcar", left: `${home.failedToScorePct ?? 0}%`, center: "X", right: `${away.failedToScorePct ?? 0}%` }
        ]
      },
      corners: {
        freeRows: [
          { label: "Pressao ofensiva", left: home.over25Pct !== null ? `${Math.max(35, home.over25Pct - 8)}%` : "-", center: "estimado", right: away.over25Pct !== null ? `${Math.max(35, away.over25Pct - 8)}%` : "-" }
        ],
        premiumRows: [
          { label: "Time com mais corners", left: "Casa", center: "1X2", right: "Fora" },
          { label: "Primeiro escanteio", left: "Casa", center: "FS", right: "Fora" },
          { label: "Corrida 3 cantos", left: "premium", center: "lock", right: "premium" }
        ]
      },
      general: {
        freeRows: [
          { label: "Posse estimada", left: `${Math.min(60, 48 + Math.round((home.goalsForAvg || 0) * 3))}%`, center: "%", right: `${Math.min(60, 48 + Math.round((away.goalsForAvg || 0) * 3))}%` },
          { label: "Forma", left: `${home.wins}V ${home.draws}E ${home.losses}D`, center: "10 jogos", right: `${away.wins}V ${away.draws}E ${away.losses}D` }
        ],
        premiumRows: [
          { label: "Ataque", left: String(home.goalsForAvg ?? "-"), center: "media", right: String(away.goalsForAvg ?? "-") },
          { label: "Defesa", left: String(home.goalsAgainstAvg ?? "-"), center: "media", right: String(away.goalsAgainstAvg ?? "-") },
          { label: "Confianca", left: `${Math.max(48, (home.over15Pct || 50) + 8)}%`, center: "score", right: `${Math.max(48, (away.over15Pct || 50) + 8)}%` }
        ]
      }
    };
  }

  function getAccess(req) {
    if (typeof options.getAuthSessionFromRequest !== "function") {
      return { authenticated: false, user: null, premium: null, premiumAccess: false };
    }

    const auth = options.getAuthSessionFromRequest(req);
    const premium = auth && typeof options.buildPremiumSnapshot === "function"
      ? options.buildPremiumSnapshot(auth.user)
      : null;

    return {
      authenticated: Boolean(auth),
      user: auth?.user ? { id: auth.user.id, name: auth.user.name, email: auth.user.email } : null,
      premium: premium || null,
      premiumAccess: premium?.accessLevel === "premium"
    };
  }

  async function buildTeamPayload(teamId) {
    const team = await fetchTeamLookup(teamId);
    if (!team) return null;

    const [recentEvents, upcomingEvents, players] = await Promise.all([
      fetchPreviousTeamEvents(teamId),
      fetchUpcomingTeamEvents(teamId),
      fetchTeamPlayers(teamId)
    ]);

    const teamName = team.strTeam || team.name || team?.team?.name || "";
    const recentMatches = recentEvents.map((event) => mapRecentMatch(event, teamId, teamName)).filter(Boolean).slice(0, 10);
    const upcomingMatches = upcomingEvents.map((event) => mapUpcomingMatch(event, teamId, teamName)).filter(Boolean).slice(0, 10);
    const sampleEvent = recentEvents[0] || upcomingEvents[0] || null;
    const standings = await fetchCompetitionStandings(
      sampleEvent?.league?.id || sampleEvent?.idLeague || team?.league?.id || "",
      sampleEvent?.league?.season || sampleEvent?.strSeason || "",
      team?.activeSeasons?.[0]?.id || sampleEvent?.season_id || ""
    );

    return {
      team: {
        id: String(team.idTeam || team.id || team?.team?.id || teamId),
        name: team.strTeam || team.name || team?.team?.name || "Time",
        badge: team.strBadge || team.image_path || team?.team?.logo || "",
        league: team.strLeague || "",
        country: team.strCountry || team.country?.name || team?.team?.country || "",
        category: inferCategory(`${team.strTeam || team.name || team?.team?.name || ""} ${team.strLeague || team.type || team?.team?.code || ""}`, team.strGender || team.gender || ""),
        gender: team.strGender || team.gender || "",
        stadium: team.strStadium || team.venue?.name || team?.venue?.name || "",
        founded: team.intFormedYear || team.founded || team?.team?.founded || "",
        description: team.strDescriptionEN || team.strDescriptionPT || team.details || ""
      },
      recentMatches,
      upcomingMatches,
      standings:
        activeProvider === "sportmonks"
          ? buildStandingsFromSportmonks(standings, [teamId])
          : activeProvider === "api-football"
            ? buildStandingsFromApiFootball(standings, [teamId])
          : buildStandings(standings, [teamId]),
      squad: players.slice(0, 40).map((player) => ({
        id: String(player.idPlayer || player.id || player?.player?.id || ""),
        name: player.strPlayer || player.display_name || player.name || player?.player?.name || "Jogador",
        position: player.strPosition || player.position?.name || player?.position || "-",
        number: player.strNumber || player.jersey_number || player?.number || "",
        nationality: player.strNationality || player.nationality || player?.age || "",
        photo: player.strCutout || player.strThumb || player.image_path || player?.photo || ""
      }))
    };
  }

  async function buildMatchPayload(eventId, req) {
    const event = await fetchEventLookup(eventId);
    if (!event) return null;

    const access = getAccess(req);
    const homeTeamId = String(event.idHomeTeam || event?.teams?.home?.id || "");
    const awayTeamId = String(event.idAwayTeam || event?.teams?.away?.id || "");
    const leagueId = String(event.idLeague || event.league_id || event?.league?.id || "");
    const season = String(event.strSeason || event.season?.name || event?.league?.season || "");
    const seasonId = String(event.season_id || event.season?.id || event?.league?.season || "");

    const [stats, timeline, seasonEvents, homeLast, awayLast, homeNext, awayNext, headToHead] = await Promise.all([
      fetchEventStats(eventId),
      fetchTimeline(eventId),
      fetchCompetitionStandings(leagueId, season, seasonId),
      fetchPreviousTeamEvents(homeTeamId),
      fetchPreviousTeamEvents(awayTeamId),
      fetchUpcomingTeamEvents(homeTeamId),
      fetchUpcomingTeamEvents(awayTeamId),
      activeProvider === "sportmonks"
        ? fetchHeadToHeadFixtures(homeTeamId, awayTeamId)
        : Promise.resolve([])
    ]);

    const headerMatch = mapEventToMatch(event);
    const homeRecent = homeLast.map((item) => mapRecentMatch(item, homeTeamId, headerMatch.homeTeam)).filter(Boolean).slice(0, 10);
    const awayRecent = awayLast.map((item) => mapRecentMatch(item, awayTeamId, headerMatch.awayTeam)).filter(Boolean).slice(0, 10);
    const homeUpcoming = homeNext.map((item) => mapUpcomingMatch(item, homeTeamId, headerMatch.homeTeam)).filter(Boolean).slice(0, 10);
    const awayUpcoming = awayNext.map((item) => mapUpcomingMatch(item, awayTeamId, headerMatch.awayTeam)).filter(Boolean).slice(0, 10);
    const kickoff = parseEventKickoff(event);
    const parts = kickoff ? formatDatePartsInTimeZone(kickoff) : { dateLabel: String(event.dateEvent || ""), timeLabel: String(event.strTime || "").slice(0, 5) };

    return {
      access,
      match: {
        ...headerMatch,
        header: {
          competition: event.strLeague || event?.league?.name || "Futebol",
          season,
          stage:
            event?.starting_at
              ? getSportmonksStageLabel(event)
              : event.intRound
                ? `Rodada ${event.intRound}`
                : season || "Partida",
          date: parts.dateLabel,
          time: parts.timeLabel
        }
      },
      stats,
      timeline,
      standings:
        activeProvider === "sportmonks"
          ? buildStandingsFromSportmonks(seasonEvents, [homeTeamId, awayTeamId])
          : activeProvider === "api-football"
            ? buildStandingsFromApiFootball(seasonEvents, [homeTeamId, awayTeamId])
          : buildStandings(seasonEvents, [homeTeamId, awayTeamId]),
      h2h:
        activeProvider === "sportmonks"
          ? buildH2H(headToHead, homeTeamId, awayTeamId)
          : buildH2H([...seasonEvents, ...homeLast, ...awayLast], homeTeamId, awayTeamId),
      homeRecent,
      awayRecent,
      homeUpcoming,
      awayUpcoming,
      traits: {
        free: buildTraitSections([...homeRecent, ...awayRecent]),
        homeScope: buildTraitSections(homeRecent.filter((item) => item.isHome)),
        awayScope: buildTraitSections(awayRecent.filter((item) => !item.isHome))
      },
      marketStats: buildMarketStats(homeRecent, awayRecent)
    };
  }

  function register(app) {
    app.get("/estatisticas", (_req, res) => {
      res.sendFile(path.join(options.rootDir || process.cwd(), "plataforma.html"));
    });

    app.get("/api/platform/session", (req, res) => {
      res.json({ ...getAccess(req), provider: activeProvider });
    });

    app.get("/api/platform/home", async (req, res) => {
      try {
        res.json({ ...(await fetchHomeFeed()), access: getAccess(req), provider: activeProvider });
      } catch (error) {
        res.status(500).json({ error: error.message || "Falha ao carregar a home esportiva." });
      }
    });

    app.get("/api/platform/search", async (req, res) => {
      try {
        const query = String(req.query.q || "").trim();
        if (query.length < 2) {
          return res.json({ query, results: [] });
        }
        res.json({ query, results: await searchTeams(query), access: getAccess(req), provider: activeProvider });
      } catch (error) {
        res.status(500).json({ error: error.message || "Falha ao buscar times." });
      }
    });

    app.get("/api/platform/team/:teamId", async (req, res) => {
      try {
        const payload = await buildTeamPayload(String(req.params.teamId || ""));
        if (!payload) {
          return res.status(404).json({ error: "Time nao encontrado." });
        }
        res.json({ ...payload, access: getAccess(req), provider: activeProvider });
      } catch (error) {
        res.status(500).json({ error: error.message || "Falha ao carregar o time." });
      }
    });

    app.get("/api/platform/match/:eventId", async (req, res) => {
      try {
        const payload = await buildMatchPayload(String(req.params.eventId || ""), req);
        if (!payload) {
          return res.status(404).json({ error: "Jogo nao encontrado." });
        }
        res.json({ ...payload, provider: activeProvider });
      } catch (error) {
        res.status(500).json({ error: error.message || "Falha ao carregar o jogo." });
      }
    });
  }

  return { register };
}

module.exports = { createSportsPlatform };
