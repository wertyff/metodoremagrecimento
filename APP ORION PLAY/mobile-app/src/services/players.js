const API_BASE = "https://www.thesportsdb.com/api/v1/json/123";

export const PLAYER_CATEGORY_ORDER = ["professional", "u20", "u17", "womens", "national"];
export const PLAYER_CATEGORY_LABELS = {
  professional: "Profissional",
  u20: "Sub-20",
  u17: "Sub-17",
  womens: "Feminino",
  national: "Seleções"
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function encodeQuery(value) {
  return encodeURIComponent(String(value || "").trim());
}

function computeAge(dateBorn) {
  if (!dateBorn) return null;
  const today = new Date();
  const born = new Date(dateBorn);
  if (Number.isNaN(born.getTime())) return null;

  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }

  return age;
}

function classifyPlayerCategory(player) {
  const text = normalize(`${player.strTeam || ""} ${player.strDescriptionEN || ""} ${player.strPlayer || ""}`);

  if (/(sub[- ]?20|\bu20\b|under 20)/.test(text)) {
    return "u20";
  }

  if (/(sub[- ]?17|\bu17\b|under 17)/.test(text)) {
    return "u17";
  }

  if (/(women|womens|female|feminino|femenino|ladies|fem\b)/.test(text)) {
    return "womens";
  }

  if (/(selec|national|argentina|brazil|brasil|france|england|spain|portugal)/.test(text) && !player.strTeam) {
    return "national";
  }

  return "professional";
}

function mapPlayer(player) {
  const category = classifyPlayerCategory(player);
  return {
    id: player.idPlayer,
    name: player.strPlayer || "Jogador",
    team: player.strTeam || "Sem time",
    position: player.strPosition || "Posição não informada",
    nationality: player.strNationality || "Nacionalidade não informada",
    photo: player.strThumb || player.strCutout || player.strRender || "",
    cutout: player.strCutout || "",
    description: player.strDescriptionPT || player.strDescriptionEN || "",
    number: player.strNumber || "",
    age: computeAge(player.dateBorn),
    height: player.strHeight || "",
    weight: player.strWeight || "",
    dateBorn: player.dateBorn || "",
    gender: player.strGender || "",
    status: player.strStatus || "",
    role: player.strPosition || "",
    category,
    categoryLabel: PLAYER_CATEGORY_LABELS[category],
    raw: player
  };
}

export async function searchPlayers(query) {
  if (!String(query || "").trim()) {
    return [];
  }

  const response = await fetch(`${API_BASE}/searchplayers.php?p=${encodeQuery(query)}`);
  if (!response.ok) {
    throw new Error("Falha ao buscar jogadores.");
  }

  const payload = await response.json();
  return (payload.player || []).map(mapPlayer);
}

export async function fetchPlayerProfile(playerId) {
  const response = await fetch(`${API_BASE}/lookupplayer.php?id=${encodeQuery(playerId)}`);
  if (!response.ok) {
    throw new Error("Falha ao carregar perfil do jogador.");
  }

  const payload = await response.json();
  const player = payload.players?.[0];
  return player ? mapPlayer(player) : null;
}

export async function searchTeams(query) {
  if (!String(query || "").trim()) {
    return [];
  }

  const response = await fetch(`${API_BASE}/searchteams.php?t=${encodeQuery(query)}`);
  if (!response.ok) {
    throw new Error("Falha ao buscar times.");
  }

  const payload = await response.json();
  return (payload.teams || []).map((team) => ({
    id: team.idTeam,
    name: team.strTeam,
    league: team.strLeague || "",
    badge: team.strBadge || ""
  }));
}

export async function fetchTeamRoster(teamId) {
  const response = await fetch(`${API_BASE}/lookup_all_players.php?id=${encodeQuery(teamId)}`);
  if (!response.ok) {
    throw new Error("Falha ao carregar elenco.");
  }

  const payload = await response.json();
  return (payload.player || []).map(mapPlayer);
}
