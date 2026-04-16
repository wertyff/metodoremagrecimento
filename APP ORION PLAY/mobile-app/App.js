import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { colors, radius, spacing } from "./src/theme";
import {
  createPremiumRewardedAd,
  InlineBannerAd,
  initializeAds,
  PREMIUM_AD_UNLOCK_MS,
  REWARDED_EVENTS
} from "./src/services/adMob";
import {
  fetchLiveMatchesWindow,
  fetchMatchBroadcasts,
  fetchMatchLineup,
  fetchMatchStats,
  fetchMatchTimeline,
  getFallbackBundle,
  getTodayKey,
  MATCH_CATEGORY_LABELS,
  MATCH_CATEGORY_ORDER
} from "./src/services/liveMatches";
import {
  fetchPlatformHomeBundle,
  fetchPlatformMatchBundle,
  fetchPlatformTeamBundle,
  searchPlatformTeams
} from "./src/services/platformSports";
import {
  describeAnalysisWindow,
  fetchCompetitionStandings,
  fetchTeamAnalysis,
  fetchTeamRecentMatches,
  fetchTeamUpcomingMatches
} from "./src/services/teamInsights";
import { fetchMatchIntelligence } from "./src/services/matchIntelligence";
import {
  fetchPlayerProfile,
  fetchTeamRoster,
  PLAYER_CATEGORY_LABELS,
  PLAYER_CATEGORY_ORDER,
  searchPlayers,
  searchTeams
} from "./src/services/players";
import { BETRADAR_DEMO_MATCH_ID, buildBetradarLmtHtml } from "./src/services/betradarLmt";
import {
  AUTH_API_BASE_URL,
  fetchRemotePremiumStatus,
  loadRemoteAuthUser,
  loginRemoteAccount,
  logoutRemoteAccount,
  registerRemoteAccount,
  requestRemotePasswordReset,
  resetRemotePassword,
  startRemotePremiumSubscription,
  updateRemoteAccountProfile
} from "./src/services/remoteAuth";

const STORAGE_KEY = "orion-football-state-v2";
const PREMIUM_UNLOCK_STORAGE_KEY = "match-intelligence-premium-ad-unlock-v1";
const tabs = [
  ["home", "Home", "home-outline", "home"],
  ["categories", "Categorias", "grid-outline", "grid"],
  ["games", "Jogos", "football-outline", "football"],
  ["players", "Jogadores", "people-outline", "people"],
  ["favorites", "Favoritos", "bookmark-outline", "bookmark"],
  ["alerts", "Alertas", "notifications-outline", "notifications"],
  ["profile", "Perfil", "person-outline", "person"]
];
const matchDetailTabs = [
  ["summary", "Resumo"],
  ["results", "Resultados"],
  ["calendar", "Calendario"],
  ["classification", "Classificacao"],
  ["players", "Elenco"],
  ["h2h", "H2H"],
  ["analysis", "Analise"],
  ["premium", "Premium"],
  ["traits", "Caracteristicas"],
  ["stats", "Estatisticas"],
  ["events", "Eventos"],
  ["tv", "Transmissao"],
  ["lineups", "Escalacoes"],
  ["tracker", "Tracker"]
];
const teamCenterTabs = [
  ["summary", "Resumo"],
  ["results", "Resultados"],
  ["calendar", "Calendario"],
  ["classification", "Classificacao"],
  ["roster", "Elenco"]
];

const defaultSettings = { alerts: true, liveGoals: true, kickoff: true, dataSaver: false };
const matchCategoryGroups = [
  { key: "professional", label: "Profissional", categories: ["professional"] },
  { key: "base", label: "Base", categories: ["u20", "u17"] },
  { key: "womens", label: "Feminino", categories: ["womens"] },
  { key: "national", label: "SeleÃ§Ãµes", categories: ["national"] }
];

const LIVE_REFRESH_INTERVAL_MS = 10000;
const DEFAULT_REFRESH_INTERVAL_MS = 30000;
const CLOCK_TICK_MS = 1000;
const DETAIL_LIVE_REFRESH_INTERVAL_MS = 3000;
const DETAIL_IDLE_REFRESH_INTERVAL_MS = 20000;

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const dateLabel = (value) => String(value || "").split("-").reverse().slice(0, 2).join("/");
const badge = (name) => name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const syncLabel = (isoString) =>
  isoString
    ? new Date(isoString).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "offline";
const formatDateTime = (isoString) =>
  isoString
    ? new Date(isoString).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "agora";
const formatCurrencyBr = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
const formatPremiumFrequency = (subscription) => {
  if (!subscription) return "mensal";
  const amount = formatCurrencyBr(subscription.amount);
  const frequency = subscription.frequency || 1;
  const unit =
    subscription.frequencyType === "days"
      ? "dia"
      : subscription.frequencyType === "years"
        ? "ano"
        : "mes";

  return `${amount} a cada ${frequency} ${unit}${frequency > 1 ? "es" : ""}`;
};

const tone = (status) =>
  status === "live"
    ? { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.28)", text: "#FFE1E1", label: "AO VIVO" }
    : status === "finished"
      ? { bg: "rgba(255,255,255,0.08)", border: colors.line, text: colors.text, label: "ENCERRADO" }
      : { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.22)", text: "#D9FFE5", label: "EM BREVE" };

const categoryTone = (category) => {
  if (category === "u20" || category === "u17") {
    return {
      badgeBg: "rgba(245,158,11,0.14)",
      badgeBorder: "rgba(245,158,11,0.28)",
      badgeText: "#FDE68A",
      cardBg: "rgba(245,158,11,0.08)",
      cardBorder: "rgba(245,158,11,0.22)"
    };
  }

  if (category === "womens") {
    return {
      badgeBg: "rgba(236,72,153,0.14)",
      badgeBorder: "rgba(236,72,153,0.28)",
      badgeText: "#FBCFE8",
      cardBg: "rgba(236,72,153,0.08)",
      cardBorder: "rgba(236,72,153,0.22)"
    };
  }

  if (category === "national") {
    return {
      badgeBg: "rgba(59,130,246,0.14)",
      badgeBorder: "rgba(59,130,246,0.28)",
      badgeText: "#DBEAFE",
      cardBg: "rgba(59,130,246,0.08)",
      cardBorder: "rgba(59,130,246,0.22)"
    };
  }

  return {
    badgeBg: "rgba(34,197,94,0.12)",
    badgeBorder: "rgba(34,197,94,0.24)",
    badgeText: colors.text,
    cardBg: "rgba(255,255,255,0.05)",
    cardBorder: colors.line
  };
};

function groupMatches(list) {
  const grouped = list.reduce((acc, match) => {
    acc[match.date] ??= {};
    acc[match.date][match.competition] ??= [];
    acc[match.date][match.competition].push(match);
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, competitions]) => ({
      date,
      competitions: Object.entries(competitions).map(([competition, competitionMatches]) => ({
        competition,
        matches: competitionMatches.sort((a, b) => a.kickoff.localeCompare(b.kickoff))
      }))
    }));
}

const SEARCH_CATEGORY_ORDER = ["professional", "u20", "u17", "womens", "national"];
const HOME_STREAM_TABS = [
  ["featured", "Destaques"],
  ["live", "Ao vivo"],
  ["upcoming", "Proximos"]
];
const HIGH_VISIBILITY_KEYWORDS = [
  "flamengo", "corinthians", "palmeiras", "sao paulo", "santos", "vasco", "gremio", "internacional",
  "real madrid", "barcelona", "atletico madrid", "manchester united", "manchester city", "liverpool",
  "chelsea", "arsenal", "tottenham", "psg", "paris saint-germain", "bayern", "borussia",
  "juventus", "milan", "inter", "napoli", "roma", "benfica", "porto", "sporting",
  "river plate", "boca juniors", "independiente", "cruzeiro", "atletico mineiro", "botafogo"
];
const HIGH_VISIBILITY_COMPETITIONS = [
  "libertadores", "champions", "premier league", "la liga", "serie a", "bundesliga",
  "ligue 1", "europa league", "conference league", "brasileirao", "copa do brasil"
];

function normalizeClubIdentity(name) {
  return normalize(name)
    .replace(/\b(sub[\s-]?20|u[\s-]?20|under[\s-]?20)\b/g, "")
    .replace(/\b(sub[\s-]?17|u[\s-]?17|under[\s-]?17)\b/g, "")
    .replace(/\b(feminino|feminina|women'?s?|ladies|fem)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyTeamSearchCategory(team) {
  const text = normalize(`${team.name || ""} ${team.league || ""}`);

  if (/(sub[\s-]?20|\bu20\b|under[\s-]?20)/.test(text)) {
    return "u20";
  }

  if (/(sub[\s-]?17|\bu17\b|under[\s-]?17)/.test(text)) {
    return "u17";
  }

  if (/(women|womens|female|feminino|femenino|ladies|fem\b)/.test(text)) {
    return "womens";
  }

  if (/(selection|selec|national team|olympic team|u-?23|u23)/.test(text)) {
    return "national";
  }

  return "professional";
}

function matchesTeamIdentity(match, teamName) {
  const target = normalizeClubIdentity(teamName);
  if (!target) return false;

  return [match.homeTeam, match.awayTeam].some((name) => {
    const base = normalizeClubIdentity(name);
    const normalizedName = normalize(name);
    return (
      base === target ||
      normalizedName === target ||
      normalizedName.includes(target) ||
      target.includes(base)
    );
  });
}

function searchMatchesClub(match, query) {
  const normalizedQuery = normalize(query).trim();
  if (!normalizedQuery) return true;

  const terms = [
    match.homeTeam,
    match.awayTeam,
    match.competition,
    match.stage,
    match.categoryLabel || "",
    normalizeClubIdentity(match.homeTeam),
    normalizeClubIdentity(match.awayTeam)
  ];

  return normalize(terms.join(" ")).includes(normalizedQuery);
}

function buildSearchClubResults(list, query) {
  const normalizedQuery = normalize(query).trim();
  if (!normalizedQuery) return [];

  const clubs = new Map();

  list.forEach((match) => {
    [
      { name: match.homeTeam, badgeUrl: match.homeBadge },
      { name: match.awayTeam, badgeUrl: match.awayBadge }
    ].forEach((team) => {
      const normalizedName = normalize(team.name);
      const normalizedBase = normalizeClubIdentity(team.name);
      const matched = normalizedName.includes(normalizedQuery) || normalizedBase.includes(normalizedQuery);
      if (!matched) return;

      const key = normalizedBase || normalizedName;
      if (!clubs.has(key)) {
        clubs.set(key, {
          key,
          name: team.name,
          baseName: team.name,
          badgeUrl: team.badgeUrl,
          categories: new Set(),
          matches: []
        });
      }

      const club = clubs.get(key);
      club.baseName = club.baseName.length <= team.name.length ? club.baseName : team.name;
      club.badgeUrl ||= team.badgeUrl;
      club.categories.add(match.category || "professional");
      if (!club.matches.some((item) => item.id === match.id)) {
        club.matches.push(match);
      }
    });
  });

  return Array.from(clubs.values())
    .map((club) => ({
      ...club,
      name: club.baseName,
      categories: SEARCH_CATEGORY_ORDER.filter((category) => club.categories.has(category)),
      matches: club.matches
        .slice()
        .sort((a, b) => {
          const statusWeight = (value) => value === "live" ? 0 : value === "upcoming" ? 1 : 2;
          return (
            statusWeight(a.status) - statusWeight(b.status) ||
            a.date.localeCompare(b.date) ||
            a.kickoff.localeCompare(b.kickoff)
          );
        })
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function competitionGroupList(list) {
  const groups = list.reduce((acc, match) => {
    const key = `${match.competition}|||${match.country || ""}`;
    acc[key] ??= {
      key,
      competition: match.competition,
      country: match.country || "",
      matches: []
    };
    acc[key].matches.push(match);
    return acc;
  }, {});

  return Object.values(groups)
    .map((group) => ({
      ...group,
      matches: group.matches.slice().sort((a, b) =>
        (a.status === "live" ? 0 : a.status === "upcoming" ? 1 : 2) -
          (b.status === "live" ? 0 : b.status === "upcoming" ? 1 : 2) ||
        a.date.localeCompare(b.date) ||
        a.kickoff.localeCompare(b.kickoff)
      )
    }))
    .sort((a, b) => a.competition.localeCompare(b.competition));
}

function visibilityScore(match) {
  const text = normalize(`${match.homeTeam} ${match.awayTeam} ${match.competition}`);
  let score = 0;
  HIGH_VISIBILITY_KEYWORDS.forEach((keyword) => {
    if (text.includes(keyword)) score += 8;
  });
  HIGH_VISIBILITY_COMPETITIONS.forEach((keyword) => {
    if (text.includes(keyword)) score += 10;
  });
  if (match.status === "live") score += 14;
  if (match.category === "professional") score += 6;
  if (match.country === "Brazil" || match.country === "Brasil") score += 4;
  return score;
}

function AppShell() {
  const fallbackBundle = useMemo(() => getFallbackBundle(), []);
  const livePulse = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [search, setSearch] = useState("");
  const [homeStreamTab, setHomeStreamTab] = useState("featured");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [profileName, setProfileName] = useState("Visitante");
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedTeamCard, setSelectedTeamCard] = useState(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerCategoryFilter, setPlayerCategoryFilter] = useState("all");
  const [playerResults, setPlayerResults] = useState([]);
  const [teamSearchResults, setTeamSearchResults] = useState([]);
  const [loadingTeamSearch, setLoadingTeamSearch] = useState(false);
  const [teamSearchError, setTeamSearchError] = useState("");
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [selectedRosterTeam, setSelectedRosterTeam] = useState("all");
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [matchBundle, setMatchBundle] = useState(fallbackBundle);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [clockNow, setClockNow] = useState(Date.now());
  const [nextAutoRefreshAt, setNextAutoRefreshAt] = useState(Date.now() + DEFAULT_REFRESH_INTERVAL_MS);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    resetToken: ""
  });
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [adsReady, setAdsReady] = useState(false);
  const [premiumUnlockUntil, setPremiumUnlockUntil] = useState(0);
  const [rewardedReady, setRewardedReady] = useState(false);
  const [rewardedLoading, setRewardedLoading] = useState(false);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState("");
  const [premiumError, setPremiumError] = useState("");
  const rewardedRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) {
          setHistory(fallbackBundle.featuredMatchId ? [fallbackBundle.featuredMatchId] : []);
          return;
        }

        const saved = JSON.parse(raw);
        setFavorites(saved.favorites || []);
        setHistory(saved.history || []);
        setSettings(saved.settings || defaultSettings);
        setProfileName(saved.profileName || "Visitante");
      })
      .finally(() => setReady(true));
  }, [fallbackBundle.featuredMatchId]);

  useEffect(() => {
    AsyncStorage.getItem(PREMIUM_UNLOCK_STORAGE_KEY)
      .then((raw) => {
        const timestamp = Number(raw || 0);
        if (timestamp > Date.now()) {
          setPremiumUnlockUntil(timestamp);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    loadRemoteAuthUser()
      .then((user) => {
        if (!active) return;
        setAuthUser(user);
        if (user) {
          setAuthForm((current) => ({
            ...current,
            name: user.name || "",
            email: user.email || "",
            password: "",
            confirmPassword: "",
            resetToken: ""
          }));
        }
      })
      .finally(() => {
        if (active) {
          setAuthReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    initializeAds()
      .then(() => {
        if (active) {
          setAdsReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setAdsReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!adsReady) {
      return undefined;
    }

    const rewarded = createPremiumRewardedAd();
    rewardedRef.current = rewarded;
    setRewardedReady(false);
    setRewardedLoading(true);

    const unsubscribeLoaded = rewarded.addAdEventListener(
      REWARDED_EVENTS.loaded,
      () => {
        setRewardedReady(true);
        setRewardedLoading(false);
      }
    );
    const unsubscribeReward = rewarded.addAdEventListener(
      REWARDED_EVENTS.earnedReward,
      async () => {
        const unlockUntil = Date.now() + PREMIUM_AD_UNLOCK_MS;
        setPremiumUnlockUntil(unlockUntil);
        setPremiumMessage(`Analise PRO liberada por anuncio ate ${formatDateTime(unlockUntil)}.`);
        setPremiumError("");
        await AsyncStorage.setItem(PREMIUM_UNLOCK_STORAGE_KEY, String(unlockUntil));
      }
    );
    const unsubscribeClosed = rewarded.addAdEventListener(REWARDED_EVENTS.closed, () => {
      setRewardedReady(false);
      setRewardedLoading(true);
      rewarded.load();
    });
    const unsubscribeError = rewarded.addAdEventListener(REWARDED_EVENTS.error, () => {
      setRewardedReady(false);
      setRewardedLoading(false);
    });

    rewarded.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeReward();
      unsubscribeClosed();
      unsubscribeError();
      rewardedRef.current = null;
    };
  }, [adsReady]);

  useEffect(() => {
    if (authUser?.name) {
      setProfileName(authUser.name);
    }
  }, [authUser]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [livePulse]);

  const premiumSubscription = authUser?.premium || null;
  const premiumAccess =
    premiumSubscription?.accessLevel === "premium" ||
    premiumUnlockUntil > Date.now();
  const allMatches = matchBundle.matches;
  const liveMatches = allMatches.filter((item) => item.status === "live");
  const autoRefreshIntervalMs = liveMatches.length ? LIVE_REFRESH_INTERVAL_MS : DEFAULT_REFRESH_INTERVAL_MS;
  const nextAutoRefreshSeconds = Math.max(1, Math.ceil((nextAutoRefreshAt - clockNow) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setClockNow(Date.now());
    }, CLOCK_TICK_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    const applyResetUrl = (url) => {
      if (!url || !active) return;
      const tokenMatch = url.match(/[?&]token=([^&]+)/i);
      const emailMatch = url.match(/[?&]email=([^&]+)/i);

      if (!tokenMatch) return;

      setActiveTab("profile");
      setAuthMode("reset");
      setAuthError("");
      setAuthMessage("Token de recuperacao detectado. Agora escolha sua nova senha.");
      setAuthForm((current) => ({
        ...current,
        email: emailMatch ? decodeURIComponent(emailMatch[1]) : current.email,
        resetToken: decodeURIComponent(tokenMatch[1] || ""),
        password: "",
        confirmPassword: ""
      }));
    };

    Linking.getInitialURL().then(applyResetUrl).catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => applyResetUrl(url));

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ favorites, history, settings, profileName })
    ).catch(() => {});
  }, [favorites, history, profileName, ready, settings]);

  async function syncMatches(silent = false, nextDelayMs = autoRefreshIntervalMs) {
    if (!silent) {
      setLoadingMatches(true);
    }

    try {
      const liveBundle = await fetchPlatformHomeBundle().catch(() => fetchLiveMatchesWindow());
      setMatchBundle(liveBundle);
      setSyncError("");
    } catch (error) {
      setMatchBundle((current) => (current.matches.length ? current : fallbackBundle));
      setSyncError("Dados em tempo real indisponiveis no momento.");
    } finally {
      setLoadingMatches(false);
      const refreshedAt = Date.now();
      setClockNow(refreshedAt);
      setNextAutoRefreshAt(refreshedAt + nextDelayMs);
    }
  }

  useEffect(() => {
    let active = true;

    const load = async () => {
      setNextAutoRefreshAt(Date.now() + autoRefreshIntervalMs);
      await syncMatches(false, autoRefreshIntervalMs);
    };

    load();
    const interval = setInterval(() => {
      if (!active) return;
      syncMatches(true, autoRefreshIntervalMs);
    }, autoRefreshIntervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fallbackBundle, autoRefreshIntervalMs]);

  const todayKey = matchBundle.todayKey || getTodayKey();
  const featured = allMatches.find((item) => item.id === matchBundle.featuredMatchId) || allMatches[0];
  const categories = ["all", ...MATCH_CATEGORY_ORDER];
  const competitions = ["all", ...new Set(allMatches.map((item) => item.competition))];
  const dates = ["all", ...new Set(allMatches.map((item) => item.date))];
  const teams = ["all", ...new Set(allMatches.flatMap((item) => [item.homeTeam, item.awayTeam]))];
  const hasSearch = search.trim().length > 0;

  const filtered = useMemo(() => {
    return allMatches.filter((match) => {
      const matchesCategory = categoryFilter === "all" || match.category === categoryFilter;
      const matchesCompetition = competitionFilter === "all" || match.competition === competitionFilter;
      const matchesDate = dateFilter === "all" || match.date === dateFilter;
      const matchesTeam = teamFilter === "all" || match.homeTeam === teamFilter || match.awayTeam === teamFilter;
      const matchesSearch = searchMatchesClub(match, search);
      return matchesCategory && matchesCompetition && matchesDate && matchesTeam && matchesSearch;
    });
  }, [allMatches, categoryFilter, competitionFilter, dateFilter, search, teamFilter]);

  const todayMatches = allMatches.filter((item) => item.date === todayKey);
  const highVisibilityMatches = allMatches
    .slice()
    .sort((a, b) => visibilityScore(b) - visibilityScore(a) || a.date.localeCompare(b.date) || a.kickoff.localeCompare(b.kickoff))
    .slice(0, 10);
  const professionalMatches = todayMatches.filter((item) => item.category === "professional");
  const baseMatches = todayMatches.filter((item) => ["u20", "u17"].includes(item.category));
  const womensMatches = todayMatches.filter((item) => item.category === "womens");
  const nationalMatches = todayMatches.filter((item) => item.category === "national");
  const nextMatches = allMatches.filter((item) => item.date >= todayKey && item.status === "upcoming").slice(0, 8);
  const finishedMatches = allMatches.filter((item) => item.date === todayKey && item.status === "finished").slice(0, 8);
  const liveMatchesByVisibility = liveMatches
    .slice()
    .sort((a, b) => visibilityScore(b) - visibilityScore(a))
    .slice(0, 10);
  const upcomingMatchesByVisibility = allMatches
    .filter((item) => item.status === "upcoming")
    .slice()
    .sort((a, b) => visibilityScore(b) - visibilityScore(a) || a.date.localeCompare(b.date) || a.kickoff.localeCompare(b.kickoff))
    .slice(0, 10);
  const allCompetitionSections = useMemo(() => competitionGroupList(allMatches), [allMatches]);
  const grouped = groupMatches(filtered);
  const clubSearchResults = useMemo(() => buildSearchClubResults(allMatches, search), [allMatches, search]);
  const favoriteMatches = allMatches.filter((item) => favorites.includes(item.id));
  const recentMatches = history.map((id) => allMatches.find((item) => item.id === id)).filter(Boolean);
  const selectedMatch = allMatches.find((item) => item.id === selectedMatchId) || null;
  const playerCategories = ["all", ...PLAYER_CATEGORY_ORDER];
  const rosterTeams = ["all", ...new Set(allMatches.flatMap((item) => [item.homeTeam, item.awayTeam]))];

  const filteredPlayerResults = useMemo(() => {
    return playerResults.filter((player) => playerCategoryFilter === "all" || player.category === playerCategoryFilter);
  }, [playerCategoryFilter, playerResults]);

  const filteredRosterPlayers = useMemo(() => {
    return rosterPlayers.filter((player) => playerCategoryFilter === "all" || player.category === playerCategoryFilter);
  }, [playerCategoryFilter, rosterPlayers]);

  useEffect(() => {
    let active = true;

    if (search.trim().length < 2) {
      setTeamSearchResults([]);
      setTeamSearchError("");
      setLoadingTeamSearch(false);
      return () => {
        active = false;
      };
    }

    setLoadingTeamSearch(true);
    setTeamSearchError("");

    const timeout = setTimeout(() => {
      searchPlatformTeams(search).catch(() => searchTeams(search))
        .then((teamsFound) => {
          if (!active) return;
          setTeamSearchResults(teamsFound);
          if (!teamsFound.length) {
            setTeamSearchError("Nenhum time encontrado na base global.");
          }
        })
        .catch(() => {
          if (!active) return;
          setTeamSearchResults([]);
          setTeamSearchError("Nao foi possivel buscar os times do mundo agora.");
        })
        .finally(() => {
          if (active) {
            setLoadingTeamSearch(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search]);

  useEffect(() => {
    let active = true;

    if (playerQuery.trim().length < 2) {
      setPlayerResults([]);
      setPlayerError("");
      setLoadingPlayers(false);
      return () => {
        active = false;
      };
    }

    setLoadingPlayers(true);
    setPlayerError("");

    const timeout = setTimeout(() => {
      searchPlayers(playerQuery)
        .then((players) => {
          if (!active) return;
          setPlayerResults(players);
          if (!players.length) {
            setPlayerError("Nenhum atleta encontrado nessa busca.");
          }
        })
        .catch(() => {
          if (!active) return;
          setPlayerError("Nao foi possivel buscar atletas agora.");
        })
        .finally(() => {
          if (active) {
            setLoadingPlayers(false);
          }
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [playerQuery]);

  useEffect(() => {
    let active = true;

    if (selectedRosterTeam === "all") {
      setRosterPlayers([]);
      setRosterError("");
      setLoadingRoster(false);
      return () => {
        active = false;
      };
    }

    setLoadingRoster(true);
    setRosterError("");

    searchTeams(selectedRosterTeam)
      .then(async (teamsFound) => {
        if (!teamsFound.length) {
          throw new Error("time");
        }

        const exactTeam =
          teamsFound.find((team) => normalize(team.name) === normalize(selectedRosterTeam)) ||
          teamsFound[0];

        const roster = await fetchTeamRoster(exactTeam.id);
        if (!active) return;
        setRosterPlayers(roster);
        if (!roster.length) {
          setRosterError("Esse time ainda nao tem elenco detalhado na base.");
        }
      })
      .catch(() => {
        if (!active) return;
        setRosterPlayers([]);
        setRosterError("Nao foi possivel carregar o elenco desse time agora.");
      })
      .finally(() => {
        if (active) {
          setLoadingRoster(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedRosterTeam]);

  const openMatch = (match) => {
    setHistory((current) => [match.id, ...current.filter((id) => id !== match.id)].slice(0, 10));
    setSelectedMatchId(match.id);
  };

  const openTeamCenter = (team) => {
    setSelectedTeamCard(team);
  };

  const toggleFavorite = (id) => {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]);
  };

  const updateAuthField = (field, value) => {
    setAuthForm((current) => ({ ...current, [field]: value }));
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setAuthError("");
    setAuthMessage("");
    setAuthForm((current) => ({
      name: mode === "register" ? current.name : "",
      email: current.email,
      password: "",
      confirmPassword: "",
      resetToken: mode === "reset" ? current.resetToken : ""
    }));
  };

  const handleAuthSubmit = async () => {
    setAuthSubmitting(true);
    setAuthError("");
    setAuthMessage("");

    try {
      let user = null;

      if (authMode === "login") {
        user = await loginRemoteAccount({
          email: authForm.email,
          password: authForm.password
        });
      } else if (authMode === "register") {
        user = await registerRemoteAccount({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
          confirmPassword: authForm.confirmPassword
        });
      } else if (authMode === "forgot") {
        const response = await requestRemotePasswordReset({
          email: authForm.email
        });
        setAuthMessage(response.message || "Se existir uma conta com esse e-mail, enviamos a recuperacao.");
        setAuthForm((current) => ({
          ...current,
          password: "",
          confirmPassword: ""
        }));
        return;
      } else if (authMode === "reset") {
        user = await resetRemotePassword({
          email: authForm.email,
          token: authForm.resetToken,
          password: authForm.password,
          confirmPassword: authForm.confirmPassword
        });
      }

      setAuthUser(user);
      if (user) {
        setProfileName(user.name);
        setAuthForm({
          name: user.name,
          email: user.email,
          password: "",
          confirmPassword: "",
          resetToken: ""
        });
        setAuthMode("login");
      }
      setAuthMessage(
        authMode === "login"
          ? "Login realizado com sucesso."
          : authMode === "register"
            ? "Conta criada com sucesso."
            : "Senha redefinida com sucesso."
      );
    } catch (error) {
      setAuthError(error?.message || "Nao foi possivel acessar sua conta agora.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleProfileSave = async () => {
    setAuthSubmitting(true);
    setAuthError("");
    setAuthMessage("");

    try {
      const user = await updateRemoteAccountProfile({ name: profileName });
      setAuthUser(user);
      setAuthForm((current) => ({
        ...current,
        name: user.name,
        email: user.email
      }));
      setAuthMessage("Perfil atualizado com sucesso.");
    } catch (error) {
      setAuthError(error?.message || "Nao foi possivel salvar o perfil agora.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setAuthSubmitting(true);
    setAuthError("");
    setAuthMessage("");

    try {
      await logoutRemoteAccount();
      setAuthUser(null);
      setProfileName("Visitante");
      setAuthMode("login");
      setAuthForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        resetToken: ""
      });
      setAuthMessage("Sessao encerrada.");
    } catch (error) {
      setAuthError(error?.message || "Nao foi possivel sair agora.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleStartPremium = async () => {
    if (!authUser) {
      setActiveTab("profile");
      setAuthError("Entre primeiro para iniciar a assinatura premium.");
      return;
    }

    setPremiumBusy(true);
    setPremiumError("");
    setPremiumMessage("");

    try {
      const payload = await startRemotePremiumSubscription();
      setAuthUser(payload.user);
      setPremiumMessage(
        payload.subscription?.accessLevel === "premium"
          ? "Sua assinatura premium ja esta ativa."
          : "Abrimos a cobranca premium no Mercado Pago. Depois de aprovar, volte ao app e toque em Atualizar premium."
      );

      if (payload.checkoutUrl) {
        await Linking.openURL(payload.checkoutUrl);
      } else if (payload.subscription?.accessLevel !== "premium") {
        throw new Error("O Mercado Pago nao retornou a URL da assinatura premium.");
      }
    } catch (error) {
      setPremiumError(error?.message || "Nao foi possivel iniciar a assinatura premium agora.");
    } finally {
      setPremiumBusy(false);
    }
  };

  const handleRefreshPremium = async () => {
    if (!authUser) {
      setActiveTab("profile");
      setAuthError("Entre primeiro para atualizar a assinatura premium.");
      return;
    }

    setPremiumBusy(true);
    setPremiumError("");
    setPremiumMessage("");

    try {
      const payload = await fetchRemotePremiumStatus();
      setAuthUser(payload.user);
      setPremiumMessage(
        payload.subscription?.accessLevel === "premium"
          ? "Premium confirmado na sua conta."
          : payload.warning || "Status atualizado. Se o pagamento acabou de ser feito, aguarde alguns instantes e tente de novo."
      );
    } catch (error) {
      setPremiumError(error?.message || "Nao foi possivel atualizar o premium agora.");
    } finally {
      setPremiumBusy(false);
    }
  };

  const handleRewardedUnlock = async () => {
    if (!rewardedRef.current || !rewardedReady) {
      setPremiumError("O anuncio recompensado ainda nao carregou. Tente de novo em alguns segundos.");
      return;
    }

    setPremiumError("");
    setPremiumMessage("");

    try {
      await rewardedRef.current.show();
    } catch {
      setPremiumError("Nao foi possivel abrir o anuncio agora.");
    }
  };

  const renderMatch = (match, highlightLive = false) => {
    const currentTone = tone(match.status);
    const matchTone = categoryTone(match.category);
    const showKickoffAsMain = match.status === "upcoming";
    const primaryCenterText = showKickoffAsMain ? match.kickoff : `${match.homeScore ?? 0} x ${match.awayScore ?? 0}`;
    const secondaryCenterText = showKickoffAsMain ? "Horario do Brasil" : `${dateLabel(match.date)} â€¢ ${match.kickoff}`;
    const livePulseStyle = {
      opacity: livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }),
      transform: [{ scaleX: livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }]
    };

    return (
      <Pressable
        key={match.id}
        style={[
          styles.card,
          { backgroundColor: matchTone.cardBg, borderColor: matchTone.cardBorder },
          highlightLive && styles.liveCard
        ]}
        onPress={() => openMatch(match)}
      >
        {match.status === "live" && (
          <Animated.View style={[styles.livePulseBar, livePulseStyle]} />
        )}
        <View style={styles.matchCardTop}>
          <View style={styles.matchCardLeagueWrap}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{match.competition}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: matchTone.badgeBg, borderColor: matchTone.badgeBorder }]}>
                <Text style={[styles.categoryBadgeText, { color: matchTone.badgeText }]}>{match.categoryLabel || "Profissional"}</Text>
              </View>
            </View>
            <View style={styles.matchMetaRow}>
              <View style={styles.matchMetaPill}>
                <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                <Text style={styles.matchMetaPillText}>{dateLabel(match.date)}</Text>
              </View>
              <View style={styles.matchMetaPill}>
                <Ionicons name="time-outline" size={12} color={colors.muted} />
                <Text style={styles.matchMetaPillText}>{match.kickoff}</Text>
              </View>
              <Text style={styles.matchStageText} numberOfLines={1}>{match.stage}</Text>
            </View>
          </View>
          <Pressable style={styles.iconWrap} onPress={() => toggleFavorite(match.id)}>
            <Ionicons
              name={favorites.includes(match.id) ? "bookmark" : "bookmark-outline"}
              size={18}
              color={favorites.includes(match.id) ? colors.gold : colors.text}
            />
          </Pressable>
        </View>

        <View style={styles.matchBoard}>
          <Team name={match.homeTeam} badgeUrl={match.homeBadge} side="left" />
          <View style={[styles.scoreWrap, showKickoffAsMain ? styles.scoreWrapUpcoming : styles.scoreWrapResult]}>
            {!showKickoffAsMain && <Text style={styles.scoreDivider}>PLACAR</Text>}
            <Text style={[styles.scoreText, showKickoffAsMain && styles.scoreTextUpcoming]}>
              {primaryCenterText}
            </Text>
            <Text style={styles.scoreSubtext}>{secondaryCenterText}</Text>
          </View>
          <Team name={match.awayTeam} badgeUrl={match.awayBadge} side="right" />
        </View>

        <View style={styles.matchCardBottom}>
          <View style={styles.matchStatusCluster}>
            <View style={[styles.statusBadge, { backgroundColor: currentTone.bg, borderColor: currentTone.border }]}>
              <Text style={[styles.statusText, { color: currentTone.text }]}>{currentTone.label}</Text>
            </View>
            {match.status === "live" && !!match.minute && (
              <View style={styles.liveMinuteBadge}>
                <Text style={styles.liveMinuteText}>{match.minute}</Text>
              </View>
            )}
          </View>
          <View style={styles.matchLocationWrap}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text style={styles.channel} numberOfLines={1}>{match.country || match.venue || match.sourceLabel}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderSearchClubCard = (club) => {
      const live = club.matches.filter((match) => match.status === "live");
      const upcoming = club.matches.filter((match) => match.status === "upcoming");
      const finished = club.matches.filter((match) => match.status === "finished");

      const renderCompactResult = (match) => {
        const currentTone = tone(match.status);
        return (
          <Pressable key={match.id} style={styles.compactResultRow} onPress={() => openMatch(match)}>
            <View style={styles.compactResultMeta}>
              <Text style={styles.compactResultTime}>{dateLabel(match.date)} • {match.kickoff}</Text>
              <Text style={styles.compactResultCompetition} numberOfLines={1}>{match.competition}</Text>
            </View>

            <View style={styles.compactResultTeams}>
              <Text style={styles.compactResultTeam} numberOfLines={1}>{match.homeTeam}</Text>
              <Text style={styles.compactResultTeam} numberOfLines={1}>{match.awayTeam}</Text>
            </View>

            <View style={styles.compactResultScoreWrap}>
              <Text style={styles.compactResultScore}>
                {match.status === "upcoming" ? match.kickoff : `${match.homeScore ?? 0} x ${match.awayScore ?? 0}`}
              </Text>
              <View style={[styles.compactResultStatusPill, { backgroundColor: currentTone.bg, borderColor: currentTone.border }]}>
                <Text style={[styles.compactResultStatusText, { color: currentTone.text }]}>
                  {match.status === "live" ? `${currentTone.label}${match.minute ? ` ${match.minute}` : ""}` : currentTone.label}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      };

      const renderClubBlock = (title, matches, accentStyle) => (
        <View style={styles.clubSearchSection}>
          <View style={styles.clubSearchSectionHeader}>
            <Text style={styles.clubSearchSectionTitle}>{title}</Text>
            <View style={[styles.clubSearchSectionCount, accentStyle]}>
              <Text style={styles.clubSearchSectionCountText}>{matches.length}</Text>
            </View>
          </View>
          {matches.length ? matches.slice(0, 6).map(renderCompactResult) : <Empty title={`Sem jogos ${title.toLowerCase()}`} body="Quando houver partidas nessa faixa, elas aparecem aqui." />}
        </View>
      );

      return (
        <View key={club.key} style={styles.clubSearchCard}>
          <View style={styles.clubSearchHeader}>
            <View style={styles.clubSearchIdentity}>
              <View style={styles.clubSearchBadge}>
                {club.badgeUrl ? (
                  <Image source={{ uri: club.badgeUrl }} style={styles.clubSearchBadgeImage} />
                ) : (
                  <Text style={styles.clubSearchBadgeText}>{badge(club.name)}</Text>
                )}
              </View>
              <View style={styles.clubSearchCopy}>
                <Text style={styles.clubSearchTitle}>{club.name}</Text>
                <Text style={styles.clubSearchMeta}>
                  {club.matches.length} jogo{club.matches.length > 1 ? "s" : ""} encontrado{club.matches.length > 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubSearchChips}>
              {club.categories.map((category) => (
                <View key={`${club.key}-${category}`} style={styles.clubSearchChipStrong}>
                  <Text style={styles.clubSearchChipStrongText}>{MATCH_CATEGORY_LABELS[category] || category}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.clubSearchMatches}>
            {renderClubBlock("Ao vivo", live, styles.clubSearchSectionCountLive)}
            {renderClubBlock("Em breve", upcoming, styles.clubSearchSectionCountUpcoming)}
            {renderClubBlock("Encerrado", finished, styles.clubSearchSectionCountFinished)}
          </View>
        </View>
      );
  };

  const renderTeamSearchCard = (team) => {
    const category = classifyTeamSearchCategory(team);
    const relatedMatchesCount = allMatches.filter((match) => matchesTeamIdentity(match, team.name)).length;

    return (
    <Pressable key={`${team.id}-${team.name}`} style={styles.globalTeamCard} onPress={() => openTeamCenter(team)}>
      <View style={styles.globalTeamIdentity}>
        <View style={styles.globalTeamBadge}>
          {team.badge ? (
            <Image source={{ uri: team.badge }} style={styles.globalTeamBadgeImage} resizeMode="contain" />
          ) : (
            <Text style={styles.globalTeamBadgeText}>{badge(team.name)}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.globalTeamTitleRow}>
            <Text style={styles.globalTeamName}>{team.name}</Text>
            <View style={styles.globalTeamCategoryChip}>
              <Text style={styles.globalTeamCategoryChipText}>{MATCH_CATEGORY_LABELS[category] || "Profissional"}</Text>
            </View>
          </View>
          <Text style={styles.globalTeamLeague}>{team.league || "Liga nao informada"}</Text>
          <Text style={styles.globalTeamMeta}>
            {relatedMatchesCount ? `${relatedMatchesCount} jogo${relatedMatchesCount > 1 ? "s" : ""} do dia encontrado${relatedMatchesCount > 1 ? "s" : ""}` : "Time global encontrado na base"}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
  };

  const homePrimaryMatches =
    homeStreamTab === "live"
      ? liveMatchesByVisibility
      : homeStreamTab === "upcoming"
        ? upcomingMatchesByVisibility
        : highVisibilityMatches;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <LinearGradient colors={["#07111F", "#081523", "#050B14"]} style={StyleSheet.absoluteFillObject} />

          <View style={styles.container}>
          <View style={styles.topBar}>
            <View style={styles.topBarGlow} />
            <View style={styles.topMetaRow}>
              <View style={styles.topMetaBadge}>
                <Ionicons name="pulse-outline" size={13} color="#CFFFE1" />
                <Text style={styles.topMetaBadgeText}>Painel de partidas reais</Text>
              </View>
              <View style={styles.topMetaBadgeMuted}>
                <Ionicons name="sparkles-outline" size={12} color="#9FD9FF" />
                <Text style={styles.topMetaBadgeMutedText}>Atualizacao continua</Text>
              </View>
            </View>

            <View style={styles.topHeroRow}>
              <View style={styles.brandRow}>
                <BrandMark />
                <View style={{ flex: 1 }}>
                  <Text style={styles.brandEyebrow}>MATCH INTELLIGENCE</Text>
                  <Text style={styles.brandTitle}>Radar premium de jogos</Text>
                  <Text style={styles.brandSub}>
                    {matchBundle.source === "live"
                      ? "Jogos reais do dia, atualizados varias vezes ao longo do dia."
                      : "Somente dados reais. Quando a fonte responder, a agenda aparece aqui."}
                  </Text>
                </View>
              </View>

              <View style={styles.topHeroAside}>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePillText}>
                    {matchBundle.source === "live" ? `${liveMatches.length} ao vivo` : "sem feed ao vivo"}
                  </Text>
                </View>

                <Pressable style={styles.syncButton} onPress={() => syncMatches()}>
                  {loadingMatches ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Ionicons name="refresh" size={16} color={colors.text} />
                  )}
                  <Text style={styles.syncButtonText}>Atualizar</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.topInsightRow}>
              <View style={styles.topInsightCard}>
                <Text style={styles.topInsightLabel}>Status da agenda</Text>
                <Text style={styles.topInsightValue}>{matchBundle.source === "live" ? "Fonte online ativa" : "Aguardando feed"}</Text>
              </View>
              <View style={styles.topInsightCard}>
                <Text style={styles.topInsightLabel}>Ultima sincronizacao</Text>
                <Text style={styles.topInsightValue}>{syncLabel(matchBundle.syncedAt)}</Text>
              </View>
              <View style={styles.topInsightCard}>
                <Text style={styles.topInsightLabel}>Proxima atualizacao</Text>
                <Text style={styles.topInsightValue}>{nextAutoRefreshSeconds}s</Text>
              </View>
            </View>

            <Text style={styles.syncNote}>
              {matchBundle.source === "live"
                ? `Ultima atualizacao ${syncLabel(matchBundle.syncedAt)} - proxima em ${nextAutoRefreshSeconds}s`
                : `Sem dados em tempo real agora. Nova tentativa em ${nextAutoRefreshSeconds}s.`}
            </Text>
            {!!syncError && <Text style={styles.errorNote}>{syncError}</Text>}
          </View>

          <View style={styles.search}>
            <Feather name="search" size={18} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar time, jogo ou campeonato"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {activeTab === "home" && (
              <>
                {hasSearch ? (
                  <>
                    <Section title={`Times encontrados para "${search}"`}>
                      {loadingTeamSearch ? (
                        <View style={styles.statsLoading}>
                          <Text style={styles.alertBody}>Buscando times reais na base global...</Text>
                        </View>
                      ) : teamSearchResults.length ? (
                        teamSearchResults.map((team) => renderTeamSearchCard(team))
                      ) : (
                        <Empty title="Nenhum time encontrado" body={teamSearchError || "Tente pelo nome principal do clube."} />
                      )}
                    </Section>
                    <Section title="Resultados por clube">
                      {clubSearchResults.length ? (
                        clubSearchResults.map((club) => renderSearchClubCard(club))
                      ) : (
                        <Empty title="Nenhum clube encontrado" body="Tente buscar pelo nome principal do time, como Cruzeiro, Santos ou Corinthians." />
                      )}
                    </Section>
                  </>
                ) : featured ? (
                  <LinearGradient colors={featured.colors} style={styles.hero}>
                    <Text style={styles.heroTag}>{featured.competition}</Text>
                    <View style={styles.matchRow}>
                      <Team name={featured.homeTeam} badgeUrl={featured.homeBadge} strong />
                      <Text style={styles.heroVs}>vs</Text>
                      <Team name={featured.awayTeam} badgeUrl={featured.awayBadge} strong />
                    </View>
                    <Text style={styles.heroScore}>
                      {featured.status === "upcoming" ? featured.kickoff : `${featured.homeScore ?? 0} x ${featured.awayScore ?? 0}`}
                    </Text>
                    <Text style={styles.heroMeta}>{dateLabel(featured.date)} - {featured.stage} - {featured.country || featured.venue}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.heroEmpty}>
                    <Text style={styles.sectionTitle}>Sem jogos em tempo real</Text>
                    <Text style={styles.alertBody}>Quando a fonte online responder com partidas reais, elas aparecem aqui.</Text>
                  </View>
                )}

                <View style={styles.metrics}>
                  <Metric label="Ao vivo" value={liveMatches.length} />
                  <Metric label="Hoje" value={todayMatches.length} />
                  <Metric label="Competicoes" value={competitions.length - 1} />
                </View>

                  {adsReady && <InlineAdBanner placement="home" />}

                  {!hasSearch && <Section title="Radar principal">
                    <View style={styles.homeStreamTabs}>
                    {HOME_STREAM_TABS.map(([key, label]) => {
                      const active = homeStreamTab === key;
                      return (
                        <Pressable key={key} style={[styles.homeStreamTab, active && styles.homeStreamTabActive]} onPress={() => setHomeStreamTab(key)}>
                          <Text style={[styles.homeStreamTabText, active && styles.homeStreamTabTextActive]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                    </View>
                    {homePrimaryMatches.length ? homePrimaryMatches.map((item) => renderMatch(item, item.status === "live")) : <Empty title="Sem jogos em destaque" body="Quando a agenda trouxer confrontos fortes, eles aparecem aqui." />}
                  </Section>}

                  {!hasSearch && (
                    <View style={styles.homeStatusStack}>
                      <Section title="Ao vivo">
                        <View style={[styles.homeStatusShelf, styles.homeStatusShelfLive]}>
                          <View style={styles.homeStatusShelfHeader}>
                            <View style={[styles.homeStatusPill, styles.homeStatusPillLive]}>
                              <View style={styles.liveDot} />
                              <Text style={styles.homeStatusPillText}>Ao vivo</Text>
                            </View>
                            <Text style={styles.homeStatusShelfCount}>{liveMatchesByVisibility.length} jogos</Text>
                          </View>
                          {liveMatchesByVisibility.length ? liveMatchesByVisibility.map((item) => renderMatch(item, true)) : <Empty title="Sem jogos ao vivo" body="Quando houver partidas em andamento, elas aparecem aqui primeiro." />}
                        </View>
                      </Section>

                      <Section title="Em breve">
                        <View style={[styles.homeStatusShelf, styles.homeStatusShelfUpcoming]}>
                          <View style={styles.homeStatusShelfHeader}>
                            <View style={[styles.homeStatusPill, styles.homeStatusPillUpcoming]}>
                              <Ionicons name="time-outline" size={13} color="#D8FFE5" />
                              <Text style={styles.homeStatusPillText}>Em breve</Text>
                            </View>
                            <Text style={styles.homeStatusShelfCount}>{nextMatches.length} jogos</Text>
                          </View>
                          {nextMatches.length ? nextMatches.map((item) => renderMatch(item)) : <Empty title="Sem jogos programados" body="Os proximos confrontos do dia aparecem aqui." />}
                        </View>
                      </Section>

                      <Section title="Encerrados">
                        <View style={[styles.homeStatusShelf, styles.homeStatusShelfFinished]}>
                          <View style={styles.homeStatusShelfHeader}>
                            <View style={[styles.homeStatusPill, styles.homeStatusPillFinished]}>
                              <Ionicons name="checkmark-done-outline" size={13} color="#E2E8F0" />
                              <Text style={styles.homeStatusPillText}>Encerrados</Text>
                            </View>
                            <Text style={styles.homeStatusShelfCount}>{finishedMatches.length} jogos</Text>
                          </View>
                          {finishedMatches.length ? finishedMatches.map((item) => renderMatch(item)) : <Empty title="Sem jogos encerrados" body="Quando partidas forem finalizadas, elas ficam listadas aqui." />}
                        </View>
                      </Section>
                    </View>
                  )}

                  {!hasSearch && <Section title="Campeonatos do mundo">
                  {allCompetitionSections.length ? allCompetitionSections.map((group) => (
                    <View key={group.key} style={styles.competitionWorldBlock}>
                      <View style={styles.rowBetween}>
                        <View>
                          <Text style={styles.competitionWorldTitle}>{group.competition}</Text>
                          <Text style={styles.cardMeta}>{group.country || "Competicao internacional"}</Text>
                        </View>
                        <Text style={styles.cardMeta}>{group.matches.length} jogos</Text>
                      </View>
                      {group.matches.map((item) => renderMatch(item, item.status === "live"))}
                    </View>
                  )) : <Empty title="Sem campeonatos carregados" body="Quando a agenda real responder, os campeonatos aparecem aqui." />}
                </Section>}
              </>
            )}

            {activeTab === "categories" && (
              <>
                <Section title="Categorias">
                  {matchCategoryGroups.map((group) => {
                    const groupMatches = allMatches.filter((item) => group.categories.includes(item.category));
                    return (
                      <View key={group.key} style={styles.categoryPanel}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.sectionTitleSmall}>{group.label}</Text>
                          <Text style={styles.cardMeta}>{groupMatches.length} jogos</Text>
                        </View>
                        <Text style={styles.alertBody}>Navegue pelas partidas dessa categoria e acompanhe o dia por tipo de competiÃ§Ã£o.</Text>
                        {groupMatches.slice(0, 3).map((item) => renderMatch(item))}
                        {!groupMatches.length && <Empty title={`Sem jogos em ${group.label}`} body="Quando a agenda trouxer jogos dessa categoria, eles aparecem aqui." />}
                      </View>
                    );
                  })}
                </Section>
              </>
            )}

            {activeTab === "games" && (
              <>
                <Section title="Filtros">
                  <View style={styles.filterHeaderCard}>
                    <Text style={styles.filterHeaderTitle}>Painel profissional de filtros</Text>
                    <Text style={styles.filterHeaderBody}>Refine categoria, campeonato, data e time para navegar como app grande de placar.</Text>
                  </View>
                  <FilterRow label="Categoria" values={categories} selected={categoryFilter} onSelect={setCategoryFilter} format={(value) => value === "all" ? "Todas" : MATCH_CATEGORY_LABELS[value] || value} />
                  <FilterRow label="Campeonato" values={competitions} selected={competitionFilter} onSelect={setCompetitionFilter} format={(value) => value === "all" ? "Todos" : value} />
                  <FilterRow label="Data" values={dates} selected={dateFilter} onSelect={setDateFilter} format={(value) => value === "all" ? "Todas" : dateLabel(value)} />
                  <FilterRow label="Time" values={teams} selected={teamFilter} onSelect={setTeamFilter} format={(value) => value === "all" ? "Todos" : value} />
                </Section>

                {adsReady && <InlineAdBanner placement="games" />}

                {hasSearch && (
                  <Section title="Times do mundo">
                    {loadingTeamSearch ? (
                      <View style={styles.statsLoading}>
                        <Text style={styles.alertBody}>Buscando times reais na base global...</Text>
                      </View>
                    ) : teamSearchResults.length ? (
                      teamSearchResults.map((team) => renderTeamSearchCard(team))
                    ) : (
                      <Empty title="Sem times globais" body={teamSearchError || "Digite pelo menos 2 letras para buscar clubes do mundo inteiro."} />
                    )}
                  </Section>
                )}

                {hasSearch && (
                  <Section title="Clubes encontrados">
                    {clubSearchResults.length ? (
                      clubSearchResults.map((club) => renderSearchClubCard(club))
                    ) : (
                      <Empty title="Nenhum clube encontrado" body="A busca precisa bater com o nome do time para separar profissional, base e feminino." />
                    )}
                  </Section>
                )}

                <Section title={`Lista de jogos (${filtered.length})`}>
                  {grouped.length ? grouped.map((group) => (
                    <View key={group.date} style={styles.group}>
                      <Text style={styles.groupDate}>{dateLabel(group.date)}</Text>
                      {group.competitions.map((competition) => (
                        <View key={`${group.date}-${competition.competition}`} style={styles.competitionBlock}>
                          <Text style={styles.competitionTitle}>{competition.competition}</Text>
                          {competition.matches.map((match) => renderMatch(match))}
                        </View>
                      ))}
                    </View>
                  )) : <Empty title="Nada encontrado" body="Ajuste os filtros ou a busca para ver mais jogos." />}
                </Section>
              </>
            )}

            {activeTab === "players" && (
              <>
                <Section title="Busca global de atletas">
                  <View style={styles.searchInline}>
                    <Feather name="search" size={18} color={colors.muted} />
                    <TextInput
                      value={playerQuery}
                      onChangeText={setPlayerQuery}
                      placeholder="Buscar jogador, tecnico ou membro do elenco"
                      placeholderTextColor={colors.muted}
                      style={styles.searchInput}
                    />
                  </View>
                  <FilterRow
                    label="Categoria do atleta"
                    values={playerCategories}
                    selected={playerCategoryFilter}
                    onSelect={setPlayerCategoryFilter}
                    format={(value) => value === "all" ? "Todas" : PLAYER_CATEGORY_LABELS[value] || value}
                  />

                  {loadingPlayers ? (
                    <View style={styles.playersLoading}>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={styles.cardMeta}>Buscando atletas...</Text>
                    </View>
                  ) : filteredPlayerResults.length ? (
                    filteredPlayerResults.map((player) => (
                      <PlayerCard key={player.id} player={player} onPress={() => setSelectedPlayerId(player.id)} />
                    ))
                  ) : (
                    <Empty
                      title="Busca de atletas"
                      body={playerQuery.trim().length < 2 ? "Digite pelo menos 2 letras para iniciar a busca global." : playerError || "Nenhum atleta encontrado."}
                    />
                  )}
                </Section>

                <Section title="Elenco por time">
                  <FilterRow
                    label="Time"
                    values={rosterTeams}
                    selected={selectedRosterTeam}
                    onSelect={setSelectedRosterTeam}
                    format={(value) => value === "all" ? "Selecione um time" : value}
                  />

                  {loadingRoster ? (
                    <View style={styles.playersLoading}>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={styles.cardMeta}>Buscando elenco do time...</Text>
                    </View>
                  ) : filteredRosterPlayers.length ? (
                    filteredRosterPlayers.map((player) => (
                      <PlayerCard key={`roster-${player.id}`} player={player} onPress={() => setSelectedPlayerId(player.id)} compact />
                    ))
                  ) : (
                    <Empty
                      title="Elenco por time"
                      body={selectedRosterTeam === "all" ? "Escolha um time acima para abrir o elenco completo." : rosterError || "Sem elenco detalhado para esse time."}
                    />
                  )}
                </Section>

                <Section title="Estrutura pronta">
                  <Future title="Sub-17" body="Categoria preparada para filtros e perfis quando a base do fornecedor trouxer esses atletas." />
                  <Future title="Sub-20" body="Ja estruturado no fluxo principal de categorias e jogadores." />
                  <Future title="Feminino" body="Filtro pronto para ativar assim que a fonte entregar a identificaÃ§Ã£o do elenco." />
                  <Future title="SeleÃ§Ãµes" body="Base preparada para atletas ligados a seleÃ§Ãµes nacionais." />
                </Section>
              </>
            )}

            {activeTab === "favorites" && (
              <>
                <Section title="Favoritos">
                  {favoriteMatches.length ? favoriteMatches.map((item) => renderMatch(item)) : <Empty title="Nenhum favorito" body="Salve jogos para acompanhar mais rapido depois." />}
                </Section>
                <Section title="Vistos recentemente">
                  {recentMatches.length ? recentMatches.map((item) => renderMatch(item)) : <Empty title="Sem historico" body="Ao abrir um jogo ele aparece aqui." />}
                </Section>
              </>
            )}

            {activeTab === "alerts" && (
              <>
                <Section title="Alertas">
                  {matchBundle.notifications.map((item) => (
                    <View key={item.id} style={styles.alert}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardMeta}>{item.time}</Text>
                      </View>
                      <Text style={styles.alertBody}>{item.body}</Text>
                    </View>
                  ))}
                </Section>
                <Section title="Preparado para depois">
                  <Future title="Estatisticas" body="Estrutura pronta para posse, finalizacoes e mais dados da partida." />
                  <Future title="Notificacoes" body="Base pronta para push de gol, inicio, intervalo e fim de jogo." />
                  <Future title="Area VIP" body="Espaco reservado para beneficios premium e alertas especiais." />
                </Section>
              </>
            )}

            {activeTab === "profile" && (
              <>
                <Section title="Conta">
                  {!authReady ? (
                    <View style={styles.playersLoading}>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={styles.cardMeta}>Carregando conta...</Text>
                    </View>
                  ) : authUser ? (
                    <>
                      <LinearGradient colors={["rgba(34,197,94,0.16)", "rgba(56,189,248,0.08)"]} style={styles.profileHero}>
                        <View style={styles.profileHeroTop}>
                          <View style={styles.profileCard}>
                            <View style={styles.profileBadge}>
                              <Text style={styles.profileBadgeText}>{badge(authUser.name || authUser.email)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.profileHeroEyebrow}>CONTA MATCH INTELLIGENCE</Text>
                              <Text style={styles.profileHeroName}>{authUser.name}</Text>
                              <Text style={styles.profileEmail}>{authUser.email}</Text>
                            </View>
                          </View>
                          <View style={styles.profileHeroStatus}>
                            <Ionicons name="shield-checkmark" size={16} color="#D8FFE5" />
                            <Text style={styles.profileHeroStatusText}>Sessao ativa</Text>
                          </View>
                        </View>

                        <View style={styles.profileHeroStats}>
                          <View style={styles.profileHeroStatCard}>
                            <Text style={styles.profileHeroStatValue}>{favorites.length}</Text>
                            <Text style={styles.profileHeroStatLabel}>Favoritos</Text>
                          </View>
                          <View style={styles.profileHeroStatCard}>
                            <Text style={styles.profileHeroStatValue}>{history.length}</Text>
                            <Text style={styles.profileHeroStatLabel}>Vistos</Text>
                          </View>
                          <View style={styles.profileHeroStatCard}>
                            <Text style={styles.profileHeroStatValue}>{premiumAccess ? "PRO" : "FREE"}</Text>
                            <Text style={styles.profileHeroStatLabel}>Plano</Text>
                          </View>
                        </View>
                      </LinearGradient>

                      <PremiumSubscriptionCard
                        subscription={premiumSubscription}
                        busy={premiumBusy}
                        onStart={handleStartPremium}
                        onRefresh={handleRefreshPremium}
                      />

                      <View style={styles.profilePanel}>
                        <Text style={styles.profilePanelTitle}>Dados da conta</Text>
                        <Text style={styles.profilePanelBody}>Ajuste seu nome exibido, confira o e-mail conectado e mantenha seu perfil pronto para sincronizacao entre aparelhos.</Text>

                        <Text style={styles.inputLabel}>Nome exibido</Text>
                        <TextInput
                          value={profileName}
                          onChangeText={setProfileName}
                          placeholder="Seu nome"
                          placeholderTextColor={colors.muted}
                          style={styles.input}
                        />

                        <Text style={styles.inputLabel}>E-mail da conta</Text>
                        <View style={styles.readonlyField}>
                          <Text style={styles.readonlyFieldText}>{authUser.email}</Text>
                        </View>

                        {!!premiumError && <Text style={styles.authFeedbackError}>{premiumError}</Text>}
                        {!!premiumMessage && <Text style={styles.authFeedbackSuccess}>{premiumMessage}</Text>}
                        {!!authError && <Text style={styles.authFeedbackError}>{authError}</Text>}
                        {!!authMessage && <Text style={styles.authFeedbackSuccess}>{authMessage}</Text>}

                        <View style={styles.actionRow}>
                          <Pressable style={styles.primaryButton} onPress={handleProfileSave} disabled={authSubmitting}>
                            {authSubmitting ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.primaryButtonText}>Salvar perfil</Text>}
                          </Pressable>
                          <Pressable style={styles.secondaryButton} onPress={handleLogout} disabled={authSubmitting}>
                            <Text style={styles.secondaryButtonText}>Sair</Text>
                          </Pressable>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <LinearGradient colors={["rgba(34,197,94,0.12)", "rgba(56,189,248,0.06)"]} style={styles.authHero}>
                        <View style={styles.authHeroIcon}>
                          <Ionicons name="shield-checkmark-outline" size={20} color="#D8FFE5" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.authHeroTitle}>Sua conta Match Intelligence</Text>
                          <Text style={styles.authHeroBody}>
                            Entre para salvar favoritos, manter a sessao, sincronizar premium e acompanhar seu perfil em qualquer aparelho.
                          </Text>
                        </View>
                      </LinearGradient>

                      <View style={styles.authFeatureRow}>
                        <View style={styles.authFeatureCard}>
                          <Ionicons name="bookmark-outline" size={16} color="#9FD9FF" />
                          <Text style={styles.authFeatureTitle}>Favoritos sincronizados</Text>
                          <Text style={styles.authFeatureBody}>Guarde jogos e acompanhe mais rapido em qualquer aparelho.</Text>
                        </View>
                        <View style={styles.authFeatureCard}>
                          <Ionicons name="diamond-outline" size={16} color="#86EFAC" />
                          <Text style={styles.authFeatureTitle}>Premium conectado</Text>
                          <Text style={styles.authFeatureBody}>Ative analises exclusivas e mantenha o acesso sempre salvo.</Text>
                        </View>
                      </View>

                      <View style={styles.authModeRow}>
                        <Pressable style={[styles.authModeButton, authMode === "login" && styles.authModeButtonActive]} onPress={() => switchAuthMode("login")}>
                          <Text style={[styles.authModeText, authMode === "login" && styles.authModeTextActive]}>Login</Text>
                        </Pressable>
                        <Pressable style={[styles.authModeButton, authMode === "register" && styles.authModeButtonActive]} onPress={() => switchAuthMode("register")}>
                          <Text style={[styles.authModeText, authMode === "register" && styles.authModeTextActive]}>Cadastro</Text>
                        </Pressable>
                        <Pressable style={[styles.authModeButton, authMode === "forgot" && styles.authModeButtonActive]} onPress={() => switchAuthMode("forgot")}>
                          <Text style={[styles.authModeText, authMode === "forgot" && styles.authModeTextActive]}>Recuperar</Text>
                        </Pressable>
                        <Pressable style={[styles.authModeButton, authMode === "reset" && styles.authModeButtonActive]} onPress={() => switchAuthMode("reset")}>
                          <Text style={[styles.authModeText, authMode === "reset" && styles.authModeTextActive]}>Token</Text>
                        </Pressable>
                      </View>

                      {authMode === "register" && (
                        <>
                          <Text style={styles.inputLabel}>Nome completo</Text>
                          <TextInput
                            value={authForm.name}
                            onChangeText={(value) => updateAuthField("name", value)}
                            placeholder="Seu nome completo"
                            placeholderTextColor={colors.muted}
                            style={styles.input}
                          />
                        </>
                      )}

                      <Text style={styles.inputLabel}>E-mail</Text>
                      <TextInput
                        value={authForm.email}
                        onChangeText={(value) => updateAuthField("email", value)}
                        placeholder="voce@email.com"
                        placeholderTextColor={colors.muted}
                        style={styles.input}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />

                      {authMode === "reset" && (
                        <>
                          <Text style={styles.inputLabel}>Token de recuperacao</Text>
                          <TextInput
                            value={authForm.resetToken}
                            onChangeText={(value) => updateAuthField("resetToken", value.toUpperCase())}
                            placeholder="Codigo recebido por e-mail"
                            placeholderTextColor={colors.muted}
                            style={styles.input}
                            autoCapitalize="none"
                          />
                        </>
                      )}

                      {authMode !== "forgot" && (
                        <>
                          <Text style={styles.inputLabel}>{authMode === "reset" ? "Nova senha" : "Senha"}</Text>
                          <TextInput
                            value={authForm.password}
                            onChangeText={(value) => updateAuthField("password", value)}
                            placeholder={authMode === "reset" ? "Nova senha" : "Sua senha"}
                            placeholderTextColor={colors.muted}
                            style={styles.input}
                            autoCapitalize="none"
                            secureTextEntry
                          />
                        </>
                      )}

                      {(authMode === "register" || authMode === "reset") && (
                        <>
                          <Text style={styles.inputLabel}>Confirmar senha</Text>
                          <TextInput
                            value={authForm.confirmPassword}
                            onChangeText={(value) => updateAuthField("confirmPassword", value)}
                            placeholder="Repita sua senha"
                            placeholderTextColor={colors.muted}
                            style={styles.input}
                            autoCapitalize="none"
                            secureTextEntry
                          />
                        </>
                      )}

                      {!!authError && <Text style={styles.authFeedbackError}>{authError}</Text>}
                      {!!authMessage && <Text style={styles.authFeedbackSuccess}>{authMessage}</Text>}

                      <Pressable style={styles.primaryButton} onPress={handleAuthSubmit} disabled={authSubmitting}>
                        {authSubmitting ? (
                          <ActivityIndicator size="small" color={colors.text} />
                        ) : (
                          <Text style={styles.primaryButtonText}>
                            {authMode === "login"
                              ? "Entrar na conta"
                              : authMode === "register"
                                ? "Criar conta"
                                : authMode === "forgot"
                                  ? "Enviar recuperacao"
                                  : "Redefinir senha"}
                          </Text>
                        )}
                      </Pressable>

                      <View style={styles.authFooterRow}>
                        <View style={styles.authServerPill}>
                          <Ionicons name="server-outline" size={13} color={colors.muted} />
                          <Text style={styles.authServerPillText}>{AUTH_API_BASE_URL.replace(/^https?:\/\//, "")}</Text>
                        </View>
                        <Text style={styles.authFooterHint}>Conta real conectada ao servidor.</Text>
                      </View>
                    </>
                  )}
                </Section>
                {authUser ? (
                  <Section title="Configuracoes">
                    <Setting title="Alertas gerais" subtitle="Avisos importantes do app" value={settings.alerts} onToggle={() => setSettings((current) => ({ ...current, alerts: !current.alerts }))} />
                    <Setting title="Gols ao vivo" subtitle="Destacar eventos das partidas em andamento" value={settings.liveGoals} onToggle={() => setSettings((current) => ({ ...current, liveGoals: !current.liveGoals }))} />
                    <Setting title="Lembrete de inicio" subtitle="Avisar quando o jogo estiver perto de comecar" value={settings.kickoff} onToggle={() => setSettings((current) => ({ ...current, kickoff: !current.kickoff }))} />
                    <Setting title="Economia de dados" subtitle="Menos efeitos e carregamento mais leve" value={settings.dataSaver} onToggle={() => setSettings((current) => ({ ...current, dataSaver: !current.dataSaver }))} />
                  </Section>
                ) : (
                  <Section title="Acesso protegido">
                    <View style={styles.lockedPanel}>
                      <View style={styles.lockedPanelHeader}>
                        <View style={styles.lockedPanelIcon}>
                          <Ionicons name="lock-closed-outline" size={18} color="#FDE68A" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>Entre para liberar seu perfil</Text>
                          <Text style={styles.alertBody}>
                            Depois do login, o app salva sua sessao, habilita o perfil e mantem suas preferencias ligadas a conta local.
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Section>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.tabs}>
            {tabs.map(([key, label, icon, activeIcon]) => {
              const active = activeTab === key;
              return (
                <Pressable key={key} style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveTab(key)}>
                  <View style={[styles.tabIconShell, active && styles.tabIconShellActive]}>
                    <Ionicons name={active ? activeIcon : icon} size={18} color={active ? colors.text : colors.muted} />
                  </View>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                  {active && <View style={styles.tabActiveGlow} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        <MatchModal
          match={selectedMatch}
          favorite={favorites.includes(selectedMatch?.id)}
          onClose={() => setSelectedMatchId(null)}
          onFavorite={() => selectedMatch && toggleFavorite(selectedMatch.id)}
          onRefreshMatch={() => syncMatches(true)}
          premiumAccess={premiumAccess}
          premiumUnlockUntil={premiumUnlockUntil}
          premiumSubscription={premiumSubscription}
          premiumBusy={premiumBusy}
          onStartPremium={handleStartPremium}
          onRefreshPremium={handleRefreshPremium}
          onUnlockWithAd={handleRewardedUnlock}
          rewardedReady={rewardedReady}
          rewardedLoading={rewardedLoading}
        />
        <TeamCenterModal
          team={selectedTeamCard}
          allMatches={allMatches}
          onClose={() => setSelectedTeamCard(null)}
          onOpenMatch={(match) => {
            setSelectedTeamCard(null);
            openMatch(match);
          }}
        />
        <PlayerProfileModal playerId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Team({ name, badgeUrl, strong, side = "center" }) {
  return (
    <View style={[styles.team, side === "left" && styles.teamLeft, side === "right" && styles.teamRight]}>
      <View style={[styles.teamBadge, strong && styles.teamBadgeStrong]}>
        {badgeUrl ? (
          <Image source={{ uri: badgeUrl }} style={[styles.teamBadgeImage, strong && styles.teamBadgeImageStrong]} resizeMode="contain" />
        ) : (
          <Text style={[styles.teamBadgeText, strong && styles.teamBadgeTextStrong]}>{badge(name)}</Text>
        )}
      </View>
      <Text style={[styles.teamName, strong && styles.teamNameStrong, side === "left" && styles.teamNameLeft, side === "right" && styles.teamNameRight]} numberOfLines={2}>{name}</Text>
    </View>
  );
}

function Metric({ label, value }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function Section({ title, children }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.sectionBody}>{children}</View></View>;
}

function FilterRow({ label, values, selected, onSelect, format }) {
  return (
    <View style={styles.filterWrap}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {values.map((value) => {
          const active = selected === value;
          return (
            <Pressable key={`${label}-${value}`} style={[styles.chip, active && styles.chipActive]} onPress={() => onSelect(value)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{format(value)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Future({ title, body }) {
  return <View style={styles.future}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.alertBody}>{body}</Text></View>;
}

function Setting({ title, subtitle, value, onToggle }) {
  return (
    <View style={styles.setting}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardMeta}>{subtitle}</Text>
      </View>
      <Switch
        trackColor={{ false: "#20324A", true: "rgba(34,197,94,0.45)" }}
        thumbColor={value ? colors.green : "#F4F8FF"}
        value={value}
        onValueChange={onToggle}
      />
    </View>
  );
}

function InlineAdBanner({ placement }) {
  return (
    <View style={styles.inlineAdShell}>
      <Text style={styles.inlineAdLabel}>Publicidade</Text>
      <View style={styles.inlineAdFrame}>
        <InlineBannerAd placement={placement} />
      </View>
    </View>
  );
}

function PremiumSubscriptionCard({ subscription, busy, onStart, onRefresh }) {
  if (!subscription) {
    return null;
  }

  const active = subscription.accessLevel === "premium";
  const pending = subscription.accessLevel === "pending";

  return (
    <View
      style={[
        styles.premiumAccountCard,
        active && styles.premiumAccountCardActive,
        pending && styles.premiumAccountCardPending
      ]}
    >
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.premiumAccountEyebrow}>Monetizacao</Text>
          <Text style={styles.premiumAccountTitle}>Assinatura Premium</Text>
        </View>
        <View
          style={[
            styles.marketConfidenceBadge,
            active
              ? styles.premiumStatusBadgeActive
              : pending
                ? styles.premiumStatusBadgePending
                : styles.premiumStatusBadgeFree
          ]}
        >
          <Text
            style={[
              styles.marketConfidenceText,
              active
                ? styles.premiumStatusTextActive
                : pending
                  ? styles.premiumStatusTextPending
                  : styles.premiumStatusTextFree
            ]}
          >
            {subscription.statusLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.alertBody}>
        {subscription.planTitle} â€¢ {formatPremiumFrequency(subscription)}
      </Text>
      <Text style={styles.cardMeta}>
        {active
          ? `Premium ativo${subscription.nextBillingDate ? ` â€¢ proxima cobranca ${formatDateTime(subscription.nextBillingDate)}` : ""}`
          : pending
            ? "Pagamento em andamento. Depois de aprovar no Mercado Pago, volte aqui e atualize."
            : "Assine para liberar mercados completos, historico VIP e alertas premium."}
      </Text>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryButton} onPress={onStart} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.primaryButtonText}>{active ? "Gerenciar assinatura" : "Assinar Premium"}</Text>}
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onRefresh} disabled={busy}>
          <Text style={styles.secondaryButtonText}>Atualizar premium</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Empty({ title = "Nenhum item aqui", body = "Assim que houver jogos ou selecoes salvas, eles aparecem aqui." }) {
  return <View style={styles.empty}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.alertBody}>{body}</Text></View>;
}

function formResultTone(result) {
  if (result === "V") {
    return { bg: "rgba(34,197,94,0.16)", border: "rgba(34,197,94,0.3)", text: "#D8FFE5" };
  }

  if (result === "E") {
    return { bg: "rgba(245,158,11,0.16)", border: "rgba(245,158,11,0.3)", text: "#FDE68A" };
  }

  return { bg: "rgba(239,68,68,0.16)", border: "rgba(239,68,68,0.3)", text: "#FFE1E1" };
}

function PlayerCard({ player, onPress, compact = false }) {
  return (
    <Pressable style={[styles.playerCard, compact && styles.playerCardCompact]} onPress={onPress}>
      <View style={styles.playerMedia}>
        {player.photo ? (
          <Image source={{ uri: player.photo }} style={styles.playerThumb} resizeMode="cover" />
        ) : (
          <View style={styles.playerThumbFallback}>
            <Text style={styles.playerThumbFallbackText}>{badge(player.name)}</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{player.name}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{player.categoryLabel}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>{player.team}</Text>
        <Text style={styles.alertBody}>{player.position} â€¢ {player.nationality}{player.age ? ` â€¢ ${player.age} anos` : ""}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function TeamCenterModal({ team, allMatches, onClose, onOpenMatch }) {
  const [activeTab, setActiveTab] = useState("summary");
  const [platformTeamBundle, setPlatformTeamBundle] = useState(null);
  const [platformTeamLoading, setPlatformTeamLoading] = useState(false);
  const [platformTeamError, setPlatformTeamError] = useState("");
  const [teamRecent, setTeamRecent] = useState([]);
  const [teamRecentLoading, setTeamRecentLoading] = useState(false);
  const [teamRecentError, setTeamRecentError] = useState("");
  const [standingsRows, setStandingsRows] = useState([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState("");
  const [teamRoster, setTeamRoster] = useState([]);
  const [teamRosterLoading, setTeamRosterLoading] = useState(false);
  const [teamRosterError, setTeamRosterError] = useState("");

  const teamMatches = useMemo(() => {
    if (!team) return [];
    return allMatches
      .filter((match) => matchesTeamIdentity(match, team.name))
      .slice()
      .sort((a, b) => {
        const statusWeight = (value) => (value === "live" ? 0 : value === "upcoming" ? 1 : 2);
        return (
          statusWeight(a.status) - statusWeight(b.status) ||
          a.date.localeCompare(b.date) ||
          a.kickoff.localeCompare(b.kickoff)
        );
      });
  }, [allMatches, team]);

  const liveTeamMatches = teamMatches.filter((match) => match.status === "live");
  const upcomingTeamMatches = teamMatches.filter((match) => match.status === "upcoming");
  const finishedTeamMatches = teamMatches.filter((match) => match.status === "finished");
  const focusMatch = liveTeamMatches[0] || upcomingTeamMatches[0] || finishedTeamMatches[0] || null;
  const teamCategory = team ? classifyTeamSearchCategory(team) : "professional";
  const platformRecentMatches = platformTeamBundle?.recentMatches || [];
  const platformUpcomingMatches = platformTeamBundle?.upcomingMatches || [];
  const fallbackRecentMatches = finishedTeamMatches.map((item) => {
    const isHome = normalizeClubIdentity(item.homeTeam) === normalizeClubIdentity(team?.name);
    return {
      id: item.id,
      date: item.date,
      competition: item.competition,
      opponent: isHome ? item.awayTeam : item.homeTeam,
      teamScore: isHome ? item.homeScore ?? 0 : item.awayScore ?? 0,
      opponentScore: isHome ? item.awayScore ?? 0 : item.homeScore ?? 0,
      result:
        (isHome ? item.homeScore ?? 0 : item.awayScore ?? 0) > (isHome ? item.awayScore ?? 0 : item.homeScore ?? 0)
          ? "V"
          : (isHome ? item.homeScore ?? 0 : item.awayScore ?? 0) < (isHome ? item.awayScore ?? 0 : item.homeScore ?? 0)
            ? "D"
            : "E"
    };
  });
  const fallbackUpcomingMatches = upcomingTeamMatches.map((item) => {
    const isHome = normalizeClubIdentity(item.homeTeam) === normalizeClubIdentity(team?.name);
    return {
      id: item.id,
      dateLabel: dateLabel(item.date),
      kickoff: item.kickoff,
      opponent: isHome ? item.awayTeam : item.homeTeam,
      competition: item.competition,
      venue: isHome ? "Casa" : "Fora"
    };
  });
  const effectiveRecentMatches = platformRecentMatches.length ? platformRecentMatches : fallbackRecentMatches;
  const effectiveUpcomingMatches = platformUpcomingMatches.length ? platformUpcomingMatches : fallbackUpcomingMatches;
  const effectiveStandingsRows = platformTeamBundle?.standings?.length ? platformTeamBundle.standings : standingsRows;
  const effectiveRoster = platformTeamBundle?.squad?.length ? platformTeamBundle.squad : teamRoster;

  useEffect(() => {
    setActiveTab("summary");
    setPlatformTeamBundle(null);
    setPlatformTeamError("");
    setTeamRecent([]);
    setTeamRecentError("");
    setStandingsRows([]);
    setStandingsError("");
    setTeamRoster([]);
    setTeamRosterError("");
  }, [team?.id, team?.name]);

  useEffect(() => {
    let active = true;

    if (!team?.name) {
      return () => {
        active = false;
      };
    }

    setPlatformTeamLoading(true);
    setPlatformTeamError("");

    async function loadPlatformTeam() {
      let teamId = team.id;
      if (!teamId) {
        const found = await searchPlatformTeams(team.name);
        const exact = found.find((item) => normalize(item.name) === normalize(team.name)) || found[0];
        teamId = exact?.id;
      }

      if (!teamId) {
        throw new Error("team");
      }

      const payload = await fetchPlatformTeamBundle(teamId);
      if (!active) return;
      setPlatformTeamBundle(payload);
    }

    loadPlatformTeam()
      .catch(() => {
        if (!active) return;
        setPlatformTeamBundle(null);
        setPlatformTeamError("Ainda nao foi possivel carregar o centro completo desse time na plataforma.");
      })
      .finally(() => {
        if (active) {
          setPlatformTeamLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [team?.id, team?.name]);

  useEffect(() => {
    let active = true;

    if (!team || activeTab !== "classification" || !focusMatch) {
      return () => {
        active = false;
      };
    }

    setStandingsLoading(true);
    setStandingsError("");
    fetchCompetitionStandings({
      leagueId: focusMatch.leagueId,
      season: focusMatch.season,
      referenceDate: focusMatch.date,
      focusTeamIds: [team.id, focusMatch.homeTeamId, focusMatch.awayTeamId].filter(Boolean),
      focusTeamNames: [team.name, focusMatch.homeTeam, focusMatch.awayTeam].filter(Boolean)
    })
      .then((rows) => {
        if (!active) return;
        setStandingsRows(rows);
      })
      .catch(() => {
        if (!active) return;
        setStandingsRows([]);
        setStandingsError("Nao foi possivel carregar a classificacao real agora.");
      })
      .finally(() => {
        if (active) {
          setStandingsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab, focusMatch, team]);

  useEffect(() => {
    let active = true;

    if (!team || activeTab !== "roster") {
      return () => {
        active = false;
      };
    }

    setTeamRosterLoading(true);
    setTeamRosterError("");
    fetchTeamRoster(team.id)
      .then((rows) => {
        if (!active) return;
        setTeamRoster(rows);
      })
      .catch(() => {
        if (!active) return;
        setTeamRoster([]);
        setTeamRosterError("Nao foi possivel carregar o elenco desse time agora.");
      })
      .finally(() => {
        if (active) {
          setTeamRosterLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab, team]);

  if (!team) return null;

  const renderTeamScheduleRow = (match) => {
    const currentTone = tone(match.status);
    const teamIsHome = normalizeClubIdentity(match.homeTeam) === normalizeClubIdentity(team.name);
    const opponent = teamIsHome ? match.awayTeam : match.homeTeam;
    return (
      <Pressable key={`${team.name}-${match.id}`} style={styles.teamCenterMatchRow} onPress={() => onOpenMatch(match)}>
        <View style={styles.teamCenterMatchMeta}>
          <Text style={styles.teamCenterMatchCompetition} numberOfLines={1}>{match.competition}</Text>
          <Text style={styles.teamCenterMatchDate}>{dateLabel(match.date)} • {match.kickoff}</Text>
        </View>
        <View style={styles.teamCenterMatchTeams}>
          <Text style={styles.teamCenterMatchTeamSelf} numberOfLines={1}>{team.name}</Text>
          <Text style={styles.teamCenterMatchVs}>x</Text>
          <Text style={styles.teamCenterMatchTeamOpponent} numberOfLines={1}>{opponent}</Text>
        </View>
        <View style={styles.teamCenterMatchRight}>
          <Text style={styles.teamCenterMatchScore}>
            {match.status === "upcoming" ? match.kickoff : `${match.homeScore ?? 0} x ${match.awayScore ?? 0}`}
          </Text>
          <View style={[styles.compactResultStatusPill, { backgroundColor: currentTone.bg, borderColor: currentTone.border }]}>
            <Text style={[styles.compactResultStatusText, { color: currentTone.text }]}>
              {currentTone.label}{match.status === "live" && match.minute ? ` ${match.minute}` : ""}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderRecentRow = (item) => (
    <View key={`${item.id}-${item.date}`} style={styles.recentRow}>
      <View style={styles.recentDateWrap}>
        <Text style={styles.recentDate}>{dateLabel(item.date)}</Text>
        <Text style={styles.recentDateMeta}>{item.competition}</Text>
      </View>
      <View style={styles.recentTeamsWrap}>
        <Text style={styles.recentOpponent} numberOfLines={1}>{team.name}</Text>
        <Text style={styles.recentOpponent} numberOfLines={1}>{item.opponent}</Text>
      </View>
      <View style={styles.recentScoreWrap}>
        <Text style={styles.recentScore}>{item.teamScore} x {item.opponentScore}</Text>
        <View style={[
          styles.recentResultPill,
          item.result === "V" ? styles.recentResultPillWin : item.result === "D" ? styles.recentResultPillLoss : styles.recentResultPillDraw
        ]}>
          <Text style={styles.recentResultText}>{item.result}</Text>
        </View>
      </View>
    </View>
  );

  const renderCalendarRow = (item) => (
    <View key={`${item.id}-${item.dateLabel}-${item.kickoff}`} style={styles.calendarRow}>
      <View style={styles.calendarRowMeta}>
        <Text style={styles.calendarRowDate}>{item.dateLabel}</Text>
        <Text style={styles.calendarRowTime}>{item.kickoff}</Text>
      </View>
      <View style={styles.calendarRowMain}>
        <Text style={styles.calendarRowOpponent} numberOfLines={1}>{item.opponent}</Text>
        <Text style={styles.calendarRowCompetition} numberOfLines={1}>{item.competition}</Text>
      </View>
      <View style={styles.calendarRowVenuePill}>
        <Text style={styles.calendarRowVenueText}>{item.venue}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBack}>
        <View style={[styles.modal, styles.teamCenterModal]}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.rowBetween}>
              <View style={styles.teamCenterHeader}>
                <View style={styles.teamCenterBadge}>
                  {team.badge ? (
                    <Image source={{ uri: team.badge }} style={styles.teamCenterBadgeImage} resizeMode="contain" />
                  ) : (
                    <Text style={styles.teamCenterBadgeText}>{badge(team.name)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{team.name}</Text>
                  <Text style={styles.cardMeta}>{team.league || "Liga nao informada"}</Text>
                </View>
              </View>
              <Pressable style={styles.iconWrap} onPress={onClose}>
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.teamCenterChipRow}>
              <View style={styles.teamCenterHeroChip}>
                <Text style={styles.teamCenterHeroChipText}>{MATCH_CATEGORY_LABELS[teamCategory] || "Profissional"}</Text>
              </View>
              <View style={styles.teamCenterHeroChipMuted}>
                <Text style={styles.teamCenterHeroChipMutedText}>
                  {(liveTeamMatches.length + effectiveUpcomingMatches.length + effectiveRecentMatches.length) || teamMatches.length} jogos encontrados
                </Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailTabs}>
              {teamCenterTabs.map(([key, label]) => {
                const active = activeTab === key;
                return (
                  <Pressable key={key} style={[styles.detailTab, active && styles.detailTabActive]} onPress={() => setActiveTab(key)}>
                    <Text style={[styles.detailTabText, active && styles.detailTabTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {activeTab === "summary" && (
              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Resumo do clube</Text>
                <View style={styles.teamCenterBlock}>
                  <Text style={styles.teamCenterBlockTitle}>Visao geral</Text>
                  <View style={styles.teamCenterSummaryGrid}>
                    <View style={styles.teamCenterSummaryCard}>
                      <Text style={styles.teamCenterSummaryValue}>{liveTeamMatches.length}</Text>
                      <Text style={styles.teamCenterSummaryLabel}>Ao vivo</Text>
                    </View>
                    <View style={styles.teamCenterSummaryCard}>
                      <Text style={styles.teamCenterSummaryValue}>{upcomingTeamMatches.length}</Text>
                      <Text style={styles.teamCenterSummaryLabel}>Proximos</Text>
                    </View>
                    <View style={styles.teamCenterSummaryCard}>
                      <Text style={styles.teamCenterSummaryValue}>{finishedTeamMatches.length}</Text>
                      <Text style={styles.teamCenterSummaryLabel}>Encerrados</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.teamCenterBlock}>
                  <Text style={styles.teamCenterBlockTitle}>Jogo principal</Text>
                  {focusMatch ? renderTeamScheduleRow(focusMatch) : <Empty title="Sem jogo principal" body="Ainda nao ha confronto carregado para esse time." />}
                </View>
              </View>
            )}

            {activeTab === "results" && (
              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Ultimos resultados</Text>
                <View style={styles.teamCenterBlock}>
                  {platformTeamLoading && !effectiveRecentMatches.length ? (
                    <View style={styles.statsLoading}>
                      <Text style={styles.alertBody}>Carregando ultimos resultados do time...</Text>
                    </View>
                  ) : effectiveRecentMatches.length ? (
                    effectiveRecentMatches.map(renderRecentRow)
                  ) : (
                    <Empty title="Sem resultados carregados" body={platformTeamError || "A base atual ainda nao trouxe jogos encerrados para esse time."} />
                  )}
                </View>
              </View>
            )}

            {activeTab === "calendar" && (
              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Calendario</Text>
                <View style={styles.teamCenterBlock}>
                  <Text style={styles.teamCenterBlockTitle}>Ao vivo</Text>
                  {liveTeamMatches.length ? liveTeamMatches.map(renderTeamScheduleRow) : <Empty title="Sem jogo ao vivo" body="Quando esse time estiver ao vivo, ele aparece aqui." />}
                </View>
                <View style={styles.teamCenterBlock}>
                  <Text style={styles.teamCenterBlockTitle}>Proximos jogos</Text>
                  {platformTeamLoading && !effectiveUpcomingMatches.length ? (
                    <View style={styles.statsLoading}>
                      <Text style={styles.alertBody}>Carregando calendario do time...</Text>
                    </View>
                  ) : effectiveUpcomingMatches.length ? (
                    effectiveUpcomingMatches.slice(0, 12).map(renderCalendarRow)
                  ) : (
                    <Empty title="Sem calendario carregado" body={platformTeamError || "A base atual ainda nao trouxe novos compromissos desse time."} />
                  )}
                </View>
              </View>
            )}

            {activeTab === "classification" && (
              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Classificacao</Text>
                <View style={styles.teamCenterBlock}>
                  {standingsLoading ? (
                    <View style={styles.statsLoading}>
                      <Text style={styles.alertBody}>Montando tabela real da competicao...</Text>
                    </View>
                  ) : effectiveStandingsRows.length ? (
                    <View style={styles.tableWrap}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellRank]}>#</Text>
                        <Text style={[styles.tableHeaderCell, styles.tableHeaderCellTeam]}>Time</Text>
                        <Text style={styles.tableHeaderCell}>PJ</Text>
                        <Text style={styles.tableHeaderCell}>V</Text>
                        <Text style={styles.tableHeaderCell}>E</Text>
                        <Text style={styles.tableHeaderCell}>D</Text>
                        <Text style={styles.tableHeaderCell}>SG</Text>
                        <Text style={styles.tableHeaderCell}>PTS</Text>
                      </View>
                      {effectiveStandingsRows.slice(0, 16).map((row) => (
                        <View key={`${row.teamId || row.teamName}-${row.rank}`} style={[styles.tableRow, row.highlight && styles.tableRowHighlight]}>
                          <Text style={[styles.tableCell, styles.tableCellRank]}>{row.rank}</Text>
                          <View style={[styles.tableCellTeamWrap, styles.tableCellTeam]}>
                            <View style={styles.tableTeamBadge}>
                              {row.badge ? <Image source={{ uri: row.badge }} style={styles.tableTeamBadgeImage} resizeMode="contain" /> : <Text style={styles.tableTeamBadgeText}>{badge(row.teamName)}</Text>}
                            </View>
                            <Text style={styles.tableTeamName} numberOfLines={1}>{row.teamName}</Text>
                          </View>
                          <Text style={styles.tableCell}>{row.played}</Text>
                          <Text style={styles.tableCell}>{row.wins}</Text>
                          <Text style={styles.tableCell}>{row.draws}</Text>
                          <Text style={styles.tableCell}>{row.losses}</Text>
                          <Text style={styles.tableCell}>{row.goalDifference}</Text>
                          <Text style={[styles.tableCell, styles.tableCellPoints]}>{row.points}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Empty title="Classificacao indisponivel" body={standingsError || "A base atual nao retornou tabela suficiente para esse time."} />
                  )}
                </View>
              </View>
            )}

            {activeTab === "roster" && (
              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Elenco</Text>
                <View style={styles.teamCenterBlock}>
                  <TeamPlayersPanel team={team} roster={effectiveRoster} lineups={[]} loading={teamRosterLoading || platformTeamLoading} error={teamRosterError || platformTeamError} />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PlayerProfileModal({ playerId, onClose }) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!playerId) {
      setPlayer(null);
      setLoading(false);
      setError("");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");
    setPlayer(null);

    fetchPlayerProfile(playerId)
      .then((profile) => {
        if (!active) return;
        setPlayer(profile);
        if (!profile) {
          setError("Perfil do atleta nao encontrado.");
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Nao foi possivel abrir o perfil agora.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [playerId]);

  if (!playerId) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.modalBack}>
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rowBetween}>
            <Text style={styles.modalTitle}>Perfil do atleta</Text>
            <Pressable style={styles.iconWrap} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.playersLoading}>
              <ActivityIndicator size="small" color={colors.text} />
              <Text style={styles.cardMeta}>Carregando perfil...</Text>
            </View>
          ) : player ? (
            <>
              <View style={styles.playerProfileHeader}>
                {player.photo ? (
                  <Image source={{ uri: player.photo }} style={styles.playerProfileImage} resizeMode="cover" />
                ) : (
                  <View style={styles.playerProfileFallback}>
                    <Text style={styles.playerProfileFallbackText}>{badge(player.name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerProfileName}>{player.name}</Text>
                  <Text style={styles.cardMeta}>{player.team}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{player.categoryLabel}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoGrid}>
                <Info label="Posicao" value={player.position} />
                <Info label="Nacionalidade" value={player.nationality} />
                <Info label="Idade" value={player.age ? `${player.age} anos` : "Nao informado"} />
                <Info label="Numero" value={player.number || "Nao informado"} />
                <Info label="Altura" value={player.height || "Nao informado"} />
                <Info label="Peso" value={player.weight || "Nao informado"} />
              </View>

              <Section title="Dados do atleta">
                <SummaryRow label="Status" homeValue={player.status || "Ativo"} awayValue={player.gender || "Nao informado"} />
                <SummaryRow label="Data de nascimento" homeValue={player.dateBorn || "Nao informado"} awayValue={player.role || "Nao informado"} />
              </Section>

              <Section title="Descricao">
                <Text style={styles.alertBody}>{player.description || "Sem descricao detalhada para esse atleta."}</Text>
              </Section>
            </>
          ) : (
            <Empty title="Perfil indisponivel" body={error || "Nao foi possivel abrir o perfil desse atleta."} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function statText(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function statFlexPair(homeValue, awayValue) {
  const homeNumber = typeof homeValue === "number" ? homeValue : Number.parseFloat(String(homeValue).replace(",", "."));
  const awayNumber = typeof awayValue === "number" ? awayValue : Number.parseFloat(String(awayValue).replace(",", "."));

  if (!Number.isFinite(homeNumber) || !Number.isFinite(awayNumber) || (homeNumber === 0 && awayNumber === 0)) {
    return { homeFlex: 1, awayFlex: 1 };
  }

  const total = homeNumber + awayNumber;
  return {
    homeFlex: Math.max(homeNumber / total, 0.12),
    awayFlex: Math.max(awayNumber / total, 0.12)
  };
}

function StatComparison({ stat }) {
  const { homeFlex, awayFlex } = statFlexPair(stat.homeValue, stat.awayValue);

  return (
    <View style={styles.statCard}>
      <View style={styles.statRowTop}>
        <Text style={styles.statValue}>{statText(stat.homeValue)}</Text>
        <Text style={styles.statLabel}>{stat.label}</Text>
        <Text style={styles.statValue}>{statText(stat.awayValue)}</Text>
      </View>
      <View style={styles.statBars}>
        <View style={[styles.statBarHome, { flex: homeFlex }]} />
        <View style={styles.statBarGap} />
        <View style={[styles.statBarAway, { flex: awayFlex }]} />
      </View>
    </View>
  );
}

function findStat(stats, labels) {
  return stats.find((item) => labels.includes(item.rawLabel) || labels.includes(item.label));
}

function numericStatValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).replace("%", "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricStat(key, label, homeValue, awayValue) {
  return { key, label, homeValue, awayValue };
}

function liveMetricMap(stats) {
  return Object.fromEntries(stats.map((item) => [item.key, item]));
}

function dominanceRatio(homeValue, awayValue) {
  const home = numericStatValue(homeValue) || 0;
  const away = numericStatValue(awayValue) || 0;
  const total = home + away;

  if (!total) {
    return { home: 0.5, away: 0.5 };
  }

  return {
    home: Math.max(home / total, 0.08),
    away: Math.max(away / total, 0.08)
  };
}

function compactLiveStats(stats) {
  const possession = findStat(stats, ["Ball Possession", "Posse de bola"]);
  const attacks = findStat(stats, ["Attacks", "Dangerous Attacks", "Total Shots", "Finalizacoes"]);
  const corners = findStat(stats, ["Corner Kicks", "Escanteios"]);
  const yellowCards = findStat(stats, ["Yellow Cards", "Cartoes amarelos"]);
  const redCards = findStat(stats, ["Red Cards", "Cartoes vermelhos"]);
  const shotsOnGoal = findStat(stats, ["Shots on Goal", "Chutes no gol"]);
  const totalShots = findStat(stats, ["Total Shots", "Finalizacoes"]);
  const shotsInsideBox = findStat(stats, ["Shots insidebox", "Chutes na area"]);

  const homePressure = Math.round(
    (numericStatValue(shotsOnGoal?.homeValue) || 0) * 4 +
    (numericStatValue(totalShots?.homeValue) || 0) * 1.5 +
    (numericStatValue(shotsInsideBox?.homeValue) || 0) * 2 +
    (numericStatValue(corners?.homeValue) || 0) * 1.5 +
    (numericStatValue(possession?.homeValue) || 0) * 0.18
  );

  const awayPressure = Math.round(
    (numericStatValue(shotsOnGoal?.awayValue) || 0) * 4 +
    (numericStatValue(totalShots?.awayValue) || 0) * 1.5 +
    (numericStatValue(shotsInsideBox?.awayValue) || 0) * 2 +
    (numericStatValue(corners?.awayValue) || 0) * 1.5 +
    (numericStatValue(possession?.awayValue) || 0) * 0.18
  );

  const homeCards = (numericStatValue(yellowCards?.homeValue) || 0) + (numericStatValue(redCards?.homeValue) || 0);
  const awayCards = (numericStatValue(yellowCards?.awayValue) || 0) + (numericStatValue(redCards?.awayValue) || 0);

  return [
    metricStat("possession", "Posse", possession?.homeValue ?? null, possession?.awayValue ?? null),
    metricStat("pressure", "Pressao", homePressure || null, awayPressure || null),
    metricStat("attacks", "Ataques", attacks?.homeValue ?? null, attacks?.awayValue ?? null),
    metricStat("corners", "Escanteios", corners?.homeValue ?? null, corners?.awayValue ?? null),
    metricStat("cards", "Cartoes", homeCards || null, awayCards || null)
  ].filter((item) => item.homeValue !== null || item.awayValue !== null);
}

function eventAccent(type) {
  if (type === "Gol") return { bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.26)", text: "#D8FFE5", icon: "football" };
  if (type === "Cartao amarelo") return { bg: "rgba(250,204,21,0.14)", border: "rgba(250,204,21,0.28)", text: "#FEF3C7", icon: "square" };
  if (type === "Cartao vermelho") return { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.28)", text: "#FFE1E1", icon: "square" };
  return { bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.26)", text: "#DBEAFE", icon: "flash" };
}

function MiniPitch({ match, stats }) {
  const metricMap = liveMetricMap(stats);
  const pressureRatio = dominanceRatio(metricMap.pressure?.homeValue, metricMap.pressure?.awayValue);
  const attacksRatio = dominanceRatio(metricMap.attacks?.homeValue, metricMap.attacks?.awayValue);
  const possessionRatio = dominanceRatio(metricMap.possession?.homeValue, metricMap.possession?.awayValue);

  return (
    <View style={styles.pitchCard}>
      <View style={styles.pitch}>
        <View style={[styles.pitchDominanceLeft, { flex: pressureRatio.home }]} />
        <View style={[styles.pitchDominanceRight, { flex: pressureRatio.away }]} />
        <View style={styles.pitchOverlay}>
          <View style={styles.pitchCenterLine} />
          <View style={styles.pitchCircle} />
          <View style={styles.pitchBoxLeft} />
          <View style={styles.pitchBoxRight} />
          <View style={[styles.pitchAttackLaneLeft, { opacity: 0.18 + attacksRatio.home * 0.55 }]} />
          <View style={[styles.pitchAttackLaneRight, { opacity: 0.18 + attacksRatio.away * 0.55 }]} />
          <View style={[styles.pitchPossessionDot, { left: `${possessionRatio.home * 82}%` }]} />
        </View>
      </View>
      <View style={styles.pitchLegend}>
        <Text style={styles.pitchLegendText}>{match.homeTeam}</Text>
        <Text style={styles.pitchLegendText}>pressao / ataque</Text>
        <Text style={[styles.pitchLegendText, styles.pitchLegendRight]}>{match.awayTeam}</Text>
      </View>
    </View>
  );
}

function LivePulsePanel({ match, stats, timeline }) {
  const compactStats = compactLiveStats(stats);
  const latestEvent = timeline.length ? timeline[timeline.length - 1] : null;
  const accent = latestEvent ? eventAccent(latestEvent.type) : null;
  const eventPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!latestEvent?.id) return;

    eventPulse.setValue(0);
    Animated.sequence([
      Animated.timing(eventPulse, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(eventPulse, {
        toValue: 0.35,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }, [latestEvent?.id, eventPulse]);

  if (!compactStats.length && !latestEvent) {
    return null;
  }

  const animatedScale = eventPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02]
  });

  const animatedGlow = eventPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.16]
  });

  return (
    <View style={styles.livePulseWrap}>
      <MiniPitch match={match} stats={compactStats} />

      {compactStats.length ? (
        <View style={styles.livePulseStats}>
          {compactStats.map(({ key, label, homeValue, awayValue }) => (
            <View key={key} style={styles.livePulseStatCard}>
              <Text style={styles.livePulseStatValue}>{statText(homeValue)}</Text>
              <Text style={styles.livePulseStatLabel}>{label}</Text>
              <Text style={[styles.livePulseStatValue, styles.livePulseStatValueRight]}>{statText(awayValue)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {latestEvent ? (
        <Animated.View
          style={[
            styles.livePulseEvent,
            {
              backgroundColor: accent.bg,
              borderColor: accent.border,
              transform: [{ scale: animatedScale }],
              shadowOpacity: animatedGlow
            }
          ]}
        >
          <View style={styles.livePulseEventIcon}>
            <Ionicons name={accent.icon} size={14} color={accent.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.livePulseEventTitle, { color: accent.text }]}>
              {latestEvent.minute} - {latestEvent.type}
            </Text>
            <Text style={styles.livePulseEventBody}>
              {latestEvent.player} â€¢ {latestEvent.team}
            </Text>
          </View>
          <Text style={styles.livePulseEventScore}>
            {match.homeScore ?? 0} x {match.awayScore ?? 0}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function DetailTabBar({ activeTab, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailTabs}>
      {matchDetailTabs.map(([key, label]) => {
        const active = activeTab === key;
        return (
          <Pressable key={key} style={[styles.detailTab, active && styles.detailTabActive]} onPress={() => onChange(key)}>
            <Text style={[styles.detailTabText, active && styles.detailTabTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SummaryRow({ label, homeValue, awayValue }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryValue}>{statText(homeValue)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, styles.summaryValueRight]}>{statText(awayValue)}</Text>
    </View>
  );
}

function TimelineItem({ item }) {
  const homeSide = item.side === "home";
  return (
    <View style={[styles.timelineCard, homeSide ? styles.timelineHome : styles.timelineAway]}>
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineMinute}>{item.minute}</Text>
        <Text style={styles.timelineType}>{item.type}</Text>
      </View>
      <Text style={styles.timelinePlayer}>{item.player}</Text>
      {!!item.assist && <Text style={styles.timelineAssist}>Assistencia: {item.assist}</Text>}
      <Text style={styles.timelineMeta}>{item.team}</Text>
      {!!item.comment && <Text style={styles.timelineComment}>{item.comment}</Text>}
    </View>
  );
}

function BroadcastCard({ item }) {
  return (
    <View style={styles.broadcastCard}>
      <View style={styles.broadcastTextWrap}>
        <Text style={styles.cardTitle}>{item.channel}</Text>
        <Text style={styles.cardMeta}>{item.country}</Text>
      </View>
      {item.logo ? <Image source={{ uri: item.logo }} style={styles.broadcastLogo} resizeMode="contain" /> : null}
    </View>
  );
}

function teamViewFromSide(match, side) {
  if (!match) return null;

  const isHome = side === "home";
  return {
    side,
    id: isHome ? match.homeTeamId : match.awayTeamId,
    name: isHome ? match.homeTeam : match.awayTeam,
    badge: isHome ? match.homeBadge : match.awayBadge,
    competition: match.competition
  };
}

function TeamScopeSwitcher({ match, activeSide, onChange }) {
  const options = [
    { key: "home", label: match.homeTeam, badge: match.homeBadge },
    { key: "away", label: match.awayTeam, badge: match.awayBadge }
  ];

  return (
    <View style={styles.teamScopeSwitcher}>
      {options.map((option) => {
        const active = activeSide === option.key;
        return (
          <Pressable
            key={option.key}
            style={[styles.teamScopeChip, active && styles.teamScopeChipActive]}
            onPress={() => onChange(option.key)}
          >
            <View style={[styles.teamScopeBadge, active && styles.teamScopeBadgeActive]}>
              {option.badge ? (
                <Image source={{ uri: option.badge }} style={styles.teamScopeBadgeImage} resizeMode="contain" />
              ) : (
                <Text style={styles.teamScopeBadgeText}>{badge(option.label)}</Text>
              )}
            </View>
            <Text style={[styles.teamScopeText, active && styles.teamScopeTextActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SampleWindowSelector({ value, onChange }) {
  const options = [5, 10];
  return (
    <View style={styles.sampleSelector}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            style={[styles.sampleChip, active && styles.sampleChipActive]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.sampleChipText, active && styles.sampleChipTextActive]}>
              Ultimos {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ResultPill({ result }) {
  const toneMap = {
    V: { bg: "rgba(34,197,94,0.16)", border: "rgba(34,197,94,0.26)", text: "#D8FFE5" },
    E: { bg: "rgba(250,204,21,0.16)", border: "rgba(250,204,21,0.26)", text: "#FEF3C7" },
    D: { bg: "rgba(239,68,68,0.16)", border: "rgba(239,68,68,0.26)", text: "#FFE1E1" }
  };
  const currentTone = toneMap[result] || toneMap.E;

  return (
    <View style={[styles.resultPill, { backgroundColor: currentTone.bg, borderColor: currentTone.border }]}>
      <Text style={[styles.resultPillText, { color: currentTone.text }]}>{result}</Text>
    </View>
  );
}

function MatchTrendStrip({ analysis }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchTrendStrip}>
      {analysis.recentMatches.map((item) => (
        <View key={`${item.id}-${item.date}`} style={styles.matchTrendCard}>
          <View style={styles.rowBetween}>
            <ResultPill result={item.result} />
            <Text style={styles.cardMeta}>{item.dateLabel}</Text>
          </View>
          <Text style={styles.trendOpponent} numberOfLines={1}>{item.opponent}</Text>
          <Text style={styles.cardMeta}>{item.venue} â€¢ {item.competition}</Text>
          <Text style={styles.trendScore}>{item.scored} x {item.conceded}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function AnalysisMetricCard({ label, value, hint, accent = "green" }) {
  return (
    <View style={[
      styles.analysisMetricCard,
      accent === "blue" && styles.analysisMetricCardBlue,
      accent === "gold" && styles.analysisMetricCardGold
    ]}>
      <Text style={styles.analysisMetricLabel}>{label}</Text>
      <Text style={styles.analysisMetricValue}>{value}</Text>
      {!!hint && <Text style={styles.analysisMetricHint}>{hint}</Text>}
    </View>
  );
}

function NarrativeCard({ title, body, icon, accent = colors.cyan }) {
  return (
    <View style={styles.narrativeCard}>
      <View style={[styles.narrativeIcon, { borderColor: `${accent}55`, backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.narrativeTitle}>{title}</Text>
        <Text style={styles.narrativeBody}>{body}</Text>
      </View>
    </View>
  );
}

function InsightList({ title, icon, accent, items, empty }) {
  return (
    <View style={styles.insightPanel}>
      <View style={styles.insightHeader}>
        <View style={[styles.narrativeIcon, { borderColor: `${accent}55`, backgroundColor: `${accent}22` }]}>
          <Ionicons name={icon} size={15} color={accent} />
        </View>
        <Text style={styles.insightTitle}>{title}</Text>
      </View>
      {items.length ? (
        items.map((item, index) => (
          <View key={`${title}-${index}`} style={styles.insightBulletRow}>
            <View style={[styles.insightDot, { backgroundColor: accent }]} />
            <Text style={styles.insightText}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.alertBody}>{empty}</Text>
      )}
    </View>
  );
}

function TeamAnalysisPanel({ analysis, requestedSampleSize }) {
  return (
    <View style={styles.teamAnalysisWrap}>
      <View style={styles.teamAnalysisHero}>
        <View style={styles.teamAnalysisHeroTop}>
          <View style={styles.teamAnalysisNameRow}>
            <View style={styles.teamAnalysisBadge}>
              {analysis.team.badge ? (
                <Image source={{ uri: analysis.team.badge }} style={styles.teamAnalysisBadgeImage} resizeMode="contain" />
              ) : (
                <Text style={styles.teamAnalysisBadgeText}>{badge(analysis.team.name)}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.teamAnalysisName}>{analysis.team.name}</Text>
              <Text style={styles.cardMeta}>{analysis.team.competition}</Text>
            </View>
          </View>
          <View style={styles.teamWindowTag}>
            <Text style={styles.teamWindowTagText}>{analysis.sample.total} jogos</Text>
          </View>
        </View>

        <Text style={styles.teamAnalysisSummary}>{analysis.smartSummary}</Text>
        <Text style={styles.teamAnalysisFootnote}>{describeAnalysisWindow(analysis, requestedSampleSize)}</Text>
      </View>

      <View style={styles.analysisMetricGrid}>
        <AnalysisMetricCard label="Aproveitamento" value={formatPercent(analysis.metrics.pointsPct)} hint={`${analysis.sample.points}/${analysis.sample.total * 3} pontos`} />
        <AnalysisMetricCard label="Media de gols" value={formatAverage(analysis.metrics.goalsForAvg)} hint={`sofre ${formatAverage(analysis.metrics.goalsAgainstAvg)}`} accent="blue" />
        <AnalysisMetricCard label="BTTS" value={formatPercent(analysis.metrics.bttsPct)} hint={`over 2.5 ${formatPercent(analysis.metrics.over25Pct)}`} accent="gold" />
        <AnalysisMetricCard label="Forma" value={`${analysis.sample.wins}-${analysis.sample.draws}-${analysis.sample.losses}`} hint={analysis.metadata.formLine.replaceAll(" â€¢ ", " / ")} />
      </View>

      <MatchTrendStrip analysis={analysis} />

      <NarrativeCard title="Resumo inteligente" body={analysis.sections.summary} icon="sparkles-outline" accent="#22C55E" />
      <NarrativeCard title="Desempenho" body={analysis.sections.performance} icon="pulse-outline" accent="#38BDF8" />
      <NarrativeCard title="Gols" body={analysis.sections.goals} icon="football-outline" accent="#F59E0B" />
      <NarrativeCard title="Ataque" body={analysis.sections.attack} icon="flash-outline" accent="#14B8A6" />
      <NarrativeCard title="Defesa" body={analysis.sections.defense} icon="shield-checkmark-outline" accent="#818CF8" />
      <NarrativeCard title="Escanteios" body={analysis.sections.corners} icon="flag-outline" accent="#F97316" />
      <NarrativeCard title="Cartoes" body={analysis.sections.cards} icon="albums-outline" accent="#FACC15" />
    </View>
  );
}

function buildScopedTraits(analysis, scope) {
  const scopeLabel = scope === "home" ? "casa" : "fora";
  const scopeLabelTitle = scope === "home" ? "Casa" : "Fora";
  const sampleBucket = analysis?.sample?.[scope] || { wins: 0, draws: 0, losses: 0, matches: 0, points: 0 };
  const pointsPct = scope === "home" ? analysis?.metrics?.homePointsPct : analysis?.metrics?.awayPointsPct;
  const venueMatches = (analysis?.recentMatches || []).filter((item) => item.venue === scopeLabelTitle);

  const strengths = [];
  const weaknesses = [];
  const style = [];
  const attention = [];

  if (sampleBucket.matches) {
    if (pointsPct >= 60) {
      strengths.push(`Recorte de ${scopeLabel}: ${sampleBucket.wins}V ${sampleBucket.draws}E ${sampleBucket.losses}D com ${formatPercent(pointsPct)} de aproveitamento.`);
    }
    if (sampleBucket.losses === 0 && sampleBucket.matches >= 3) {
      strengths.push(`Ainda nao perdeu nesse recorte nos ultimos ${sampleBucket.matches} jogos analisados.`);
    }
    if (pointsPct <= 40) {
      weaknesses.push(`Rendimento de ${scopeLabel} abaixo do ideal: ${sampleBucket.wins}V ${sampleBucket.draws}E ${sampleBucket.losses}D e so ${formatPercent(pointsPct)} dos pontos.`);
    }
    if (sampleBucket.wins === 0 && sampleBucket.matches >= 3) {
      weaknesses.push(`Ainda nao venceu nesse recorte recente, o que reduz a confianca no mando/contexto atual.`);
    }
  }

  if (venueMatches.length) {
    const avgGoalsFor = venueMatches.reduce((sum, item) => sum + Number(item.scored || 0), 0) / venueMatches.length;
    const avgGoalsAgainst = venueMatches.reduce((sum, item) => sum + Number(item.conceded || 0), 0) / venueMatches.length;
    const openGames = venueMatches.filter((item) => Number(item.scored || 0) + Number(item.conceded || 0) >= 3).length;
    const scoredFirstCount = venueMatches.filter((item) => item.result === "V" && Number(item.scored || 0) > 0).length;

    if (avgGoalsFor >= 1.5) {
      style.push(`No recorte ${scopeLabel}, o time produz ${formatAverage(avgGoalsFor)} gols por jogo e mantem agressividade ofensiva.`);
    } else if (avgGoalsFor <= 0.9) {
      style.push(`No recorte ${scopeLabel}, o ataque cai para ${formatAverage(avgGoalsFor)} gol por jogo e tende a criar menos.`);
    }

    if (avgGoalsAgainst >= 1.4) {
      weaknesses.push(`Nesse contexto, a defesa sofre ${formatAverage(avgGoalsAgainst)} gols por jogo, sinal de vulnerabilidade recorrente.`);
    } else if (avgGoalsAgainst <= 0.9) {
      strengths.push(`Defensivamente responde melhor ${scopeLabel}: so ${formatAverage(avgGoalsAgainst)} gol sofrido por jogo.`);
    }

    if (openGames / venueMatches.length >= 0.6) {
      attention.push(`Os jogos nesse recorte costumam abrir mais: over 2.5 apareceu em ${formatPercent((openGames / venueMatches.length) * 100)} das partidas recentes.`);
    } else if (openGames / venueMatches.length <= 0.3) {
      attention.push(`Os jogos nesse recorte tendem a ser mais controlados, com baixa frequencia de placares abertos.`);
    }

    if (scoredFirstCount >= Math.max(2, Math.ceil(venueMatches.length / 2))) {
      strengths.push(`Costuma assumir vantagem mais cedo ${scopeLabel}, com bom volume de partidas vencidas apos marcar.`);
    }
  }

  if (!style.length) {
    style.push(`Sem base avancada suficiente para cravar um estilo dominante apenas no recorte ${scopeLabel}.`);
  }

  if (!attention.length) {
    attention.push(`Sem gatilho temporal forte no recorte ${scopeLabel}; o melhor e usar esse painel junto com os resultados e a forma recente.`);
  }

  if (!strengths.length) {
    strengths.push(`Sem caracteristica muito forte isolada no recorte ${scopeLabel} dentro da amostra atual.`);
  }

  if (!weaknesses.length) {
    weaknesses.push(`Sem fragilidade dominante no recorte ${scopeLabel} dentro da amostra atual.`);
  }

  return {
    label: scopeLabelTitle,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    style: style.slice(0, 3),
    attention: attention.slice(0, 3)
  };
}

function TraitsColumn({ label, items, accent, empty, locked = false }) {
  if (locked) {
    return (
      <View style={styles.traitsColumnCard}>
        <View style={styles.traitsColumnHeader}>
          <Text style={styles.traitsColumnLabel}>{label}</Text>
          <View style={styles.traitsPremiumBadge}>
            <Ionicons name="lock-closed-outline" size={12} color="#FDE68A" />
            <Text style={styles.traitsPremiumBadgeText}>Premium</Text>
          </View>
        </View>
        <View style={styles.traitsLockedCard}>
          <Ionicons name="lock-closed" size={18} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.traitsLockedTitle}>Comparativo {label.toLowerCase()} exclusivo</Text>
            <Text style={styles.traitsLockedBody}>
              Desbloqueie os recortes premium para ver leitura de mando, padroes de casa/fora e sinais mais fortes do confronto.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.traitsColumnCard}>
      <View style={styles.traitsColumnHeader}>
        <Text style={styles.traitsColumnLabel}>{label}</Text>
        <View style={[styles.traitsScopeDot, { backgroundColor: accent }]} />
      </View>
      {items.length ? (
        items.map((item, index) => (
          <View key={`${label}-${index}`} style={styles.traitsBulletRow}>
            <View style={styles.traitsLineWrap}>
              <View style={[styles.traitsBulletDot, { borderColor: accent }]} />
              <View style={[styles.traitsBulletLine, { backgroundColor: `${accent}55` }]} />
            </View>
            <Text style={styles.traitsBulletText}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.alertBody}>{empty}</Text>
      )}
    </View>
  );
}

function TraitSection({ title, accent, totalItems, scopedItems, totalLabel, scopedLabel, empty, unlocked }) {
  return (
    <View style={styles.traitsSectionCard}>
      <Text style={styles.traitsSectionTitle}>{title}</Text>
      <View style={styles.traitsColumnsGrid}>
        <TraitsColumn label={totalLabel} items={totalItems} accent={accent} empty={empty} />
        <TraitsColumn label={scopedLabel} items={scopedItems} accent={accent} empty={empty} locked={!unlocked} />
      </View>
    </View>
  );
}

function TeamTraitsPanel({ analysis, unlocked }) {
  const [scope, setScope] = useState("home");
  const scopedTraits = useMemo(() => buildScopedTraits(analysis, scope), [analysis, scope]);

  return (
    <View style={styles.teamTraitsWrap}>
      <View style={styles.traitsHero}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.traitsEyebrow}>Caracteristicas do time</Text>
            <Text style={styles.teamAnalysisSummary}>
              Leitura de padroes reais da amostra, com comparativo geral gratuito e recorte premium por mando.
            </Text>
          </View>
          <View style={styles.sampleSelector}>
            <Pressable style={[styles.sampleChip, scope === "home" && styles.sampleChipActive]} onPress={() => setScope("home")}>
              <Text style={[styles.sampleChipText, scope === "home" && styles.sampleChipTextActive]}>Casa</Text>
            </Pressable>
            <Pressable style={[styles.sampleChip, scope === "away" && styles.sampleChipActive]} onPress={() => setScope("away")}>
              <Text style={[styles.sampleChipText, scope === "away" && styles.sampleChipTextActive]}>Fora</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <TraitSection
        title="Pontos fortes"
        accent="#22C55E"
        totalItems={analysis.strengths}
        scopedItems={scopedTraits.strengths}
        totalLabel="Todos"
        scopedLabel={scopedTraits.label}
        empty="Nenhum ponto forte estatisticamente forte apareceu na amostra atual."
        unlocked={unlocked}
      />
      <TraitSection
        title="Pontos fracos"
        accent="#EF4444"
        totalItems={analysis.weaknesses}
        scopedItems={scopedTraits.weaknesses}
        totalLabel="Todos"
        scopedLabel={scopedTraits.label}
        empty="A amostra atual nao mostrou fragilidades recorrentes fortes."
        unlocked={unlocked}
      />
      <TraitSection
        title="Estilo de jogo"
        accent="#38BDF8"
        totalItems={analysis.styleNotes}
        scopedItems={scopedTraits.style}
        totalLabel="Todos"
        scopedLabel={scopedTraits.label}
        empty="Sem base suficiente para definir o estilo."
        unlocked={unlocked}
      />
      <TraitSection
        title="Momentos de atencao"
        accent="#F59E0B"
        totalItems={analysis.attention}
        scopedItems={scopedTraits.attention}
        totalLabel="Todos"
        scopedLabel={scopedTraits.label}
        empty="Sem base temporal suficiente para destacar momentos."
        unlocked={unlocked}
      />
    </View>
  );
}

function marketConfidenceTone(confidence) {
  if (confidence === "Alta") return { bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.26)", text: "#D8FFE5" };
  if (confidence === "Media") return { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.26)", text: "#FDE68A" };
  return { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.26)", text: "#FFE1E1" };
}

function MatchIntelligencePanel({
  intelligence,
  premiumAccess,
  adUnlockUntil,
  premiumSubscription,
  premiumBusy,
  onStartPremium,
  onRefreshPremium,
  onUnlockWithAd,
  rewardedReady,
  rewardedLoading
}) {
  if (!intelligence) {
    return (
      <View style={styles.statsLoading}>
        <Text style={styles.alertBody}>A engine ainda nao conseguiu cruzar os dois lados com base suficiente.</Text>
      </View>
    );
  }

  const unlocked = premiumAccess || Date.now() < Number(adUnlockUntil || 0);
  const approvedMarkets = unlocked ? intelligence.markets.approved : intelligence.markets.approved.slice(0, 2);
  const doubtfulMarkets = unlocked ? intelligence.markets.doubtful : intelligence.markets.doubtful.slice(0, 1);
  const discardedMarkets = unlocked ? intelligence.markets.discarded : intelligence.markets.discarded.slice(0, 1);
  const topBets = unlocked ? intelligence.topBets : intelligence.topBets.slice(0, 1);
  const ticketPicks = unlocked ? intelligence.ticket?.picks || [] : (intelligence.ticket?.picks || []).slice(0, 2);

  const renderMarketCard = (market, toneAccent) => {
    const toneColor = marketConfidenceTone(market.confidence);

    return (
      <View key={`${market.label}-${market.side}`} style={[styles.marketCard, toneAccent && styles.marketCardStrong]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{market.label}</Text>
          <View style={[styles.marketConfidenceBadge, { backgroundColor: toneColor.bg, borderColor: toneColor.border }]}>
            <Text style={[styles.marketConfidenceText, { color: toneColor.text }]}>{market.confidence}</Text>
          </View>
        </View>
        <View style={styles.marketMetaRow}>
          <Text style={styles.marketProbability}>{market.probability}%</Text>
          <View style={styles.marketMetaChip}>
            <Text style={styles.marketMetaChipText}>Odd-modelo {market.projectedOdd || "--"}</Text>
          </View>
          <View style={styles.marketMetaChip}>
            <Text style={styles.marketMetaChipText}>Confianca {market.confidenceScore}%</Text>
          </View>
        </View>
        <Text style={styles.alertBody}>{market.rationale}</Text>
      </View>
    );
  };

  return (
    <View style={styles.premiumWrap}>
      <LinearGradient colors={["rgba(56,189,248,0.16)", "rgba(34,197,94,0.10)", "rgba(8,19,34,0.92)"]} style={styles.premiumHero}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumEyebrow}>Analise PRO do confronto</Text>
            <Text style={styles.premiumTitle}>IA de confronto com base real</Text>
            <Text style={styles.teamAnalysisSummary}>{intelligence.executiveSummary}</Text>
          </View>
          <View style={styles.premiumScoreBadge}>
            <Text style={styles.premiumScoreValue}>{intelligence.confidence.score}</Text>
            <Text style={styles.premiumScoreTier}>{intelligence.confidence.label}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.analysisMetricGrid}>
        <AnalysisMetricCard label={intelligence.home.team.name} value={String(intelligence.home.premium.overallScore)} hint={intelligence.home.premium.tier} />
        <AnalysisMetricCard label={intelligence.away.team.name} value={String(intelligence.away.premium.overallScore)} hint={intelligence.away.premium.tier} accent="blue" />
        <AnalysisMetricCard label="Mercados aprovados" value={String(intelligence.markets.approved.length)} hint={`janela ${intelligence.generatedFrom.sampleSize} jogos`} accent="gold" />
        <AnalysisMetricCard label="Bilhete alvo" value={intelligence.ticket ? String(intelligence.ticket.projectedOdd) : "--"} hint={intelligence.ticket ? intelligence.ticket.risk : "sem combinacao"} />
      </View>

      <NarrativeCard title="Resumo executivo" body={intelligence.executiveSummary} icon="sparkles-outline" accent="#38BDF8" />
      <NarrativeCard title="Confiabilidade do confronto" body={`${intelligence.confidence.label}: ${intelligence.confidence.reason}`} icon="shield-checkmark-outline" accent="#22C55E" />

      <InsightList
        title={`Mandante - ${intelligence.home.team.name}`}
        icon="home-outline"
        accent="#22C55E"
        items={[
          intelligence.home.sections.summary,
          intelligence.home.sections.performance,
          intelligence.home.sections.goals,
          intelligence.home.sections.attack,
          intelligence.home.sections.defense,
          intelligence.home.sections.corners,
          intelligence.home.sections.cards
        ]}
        empty="Sem base suficiente para o mandante."
      />

      <InsightList
        title={`Visitante - ${intelligence.away.team.name}`}
        icon="airplane-outline"
        accent="#60A5FA"
        items={[
          intelligence.away.sections.summary,
          intelligence.away.sections.performance,
          intelligence.away.sections.goals,
          intelligence.away.sections.attack,
          intelligence.away.sections.defense,
          intelligence.away.sections.corners,
          intelligence.away.sections.cards
        ]}
        empty="Sem base suficiente para o visitante."
      />

      <InsightList
        title="Comparacao do confronto"
        icon="git-compare-outline"
        accent="#A78BFA"
        items={[
          intelligence.comparison.attackVsDefense,
          intelligence.comparison.moments,
          intelligence.comparison.btts,
          intelligence.comparison.goalLines,
          intelligence.comparison.corners,
          intelligence.comparison.shots,
          intelligence.comparison.possession,
          intelligence.comparison.discipline,
          intelligence.comparison.handicap
        ]}
        empty="Sem comparativo suficiente."
      />

      <InsightList title="Leitura do confronto" icon="eye-outline" accent="#F59E0B" items={intelligence.reading} empty="Sem leitura confiavel." />

      <View style={styles.insightPanel}>
        <View style={styles.insightHeader}>
          <View style={[styles.narrativeIcon, { borderColor: "#22C55E55", backgroundColor: "#22C55E22" }]}>
            <Ionicons name="checkmark-done-outline" size={15} color="#22C55E" />
          </View>
          <Text style={styles.insightTitle}>Mercados aprovados</Text>
        </View>
        <View style={styles.premiumMarkets}>
          {approvedMarkets.length ? approvedMarkets.map((market) => renderMarketCard(market, true)) : <Text style={styles.alertBody}>Nenhum mercado forte o bastante para aprovar.</Text>}
        </View>
      </View>

      <View style={styles.insightPanel}>
        <View style={styles.insightHeader}>
          <View style={[styles.narrativeIcon, { borderColor: "#F59E0B55", backgroundColor: "#F59E0B22" }]}>
            <Ionicons name="help-outline" size={15} color="#F59E0B" />
          </View>
          <Text style={styles.insightTitle}>Mercados duvidosos</Text>
        </View>
        <View style={styles.premiumMarkets}>
          {doubtfulMarkets.length ? doubtfulMarkets.map((market) => renderMarketCard(market)) : <Text style={styles.alertBody}>Nenhum mercado ficou na zona cinza nesta leitura.</Text>}
        </View>
      </View>

      <View style={styles.insightPanel}>
        <View style={styles.insightHeader}>
          <View style={[styles.narrativeIcon, { borderColor: "#EF444455", backgroundColor: "#EF444422" }]}>
            <Ionicons name="close-outline" size={15} color="#EF4444" />
          </View>
          <Text style={styles.insightTitle}>Mercados descartados</Text>
        </View>
        <View style={styles.premiumMarkets}>
          {discardedMarkets.length ? discardedMarkets.map((market) => renderMarketCard(market)) : <Text style={styles.alertBody}>Nao houve descarte relevante nesta amostra.</Text>}
        </View>
      </View>

      <View style={styles.insightPanel}>
        <View style={styles.insightHeader}>
          <View style={[styles.narrativeIcon, { borderColor: "#38BDF855", backgroundColor: "#38BDF822" }]}>
            <Ionicons name="trophy-outline" size={15} color="#38BDF8" />
          </View>
          <Text style={styles.insightTitle}>Top 3 apostas</Text>
        </View>
        <View style={styles.premiumMarkets}>
          {topBets.length ? topBets.map((market) => renderMarketCard(market, true)) : <Text style={styles.alertBody}>Sem apostas aprovadas com base suficiente.</Text>}
        </View>
      </View>

      <View style={styles.ticketCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.premiumEyebrow}>Bilhete pronto</Text>
            <Text style={styles.narrativeTitle}>Odd-modelo alvo 2.0 a 3.0</Text>
          </View>
          <View style={styles.ticketBadge}>
            <Text style={styles.ticketBadgeText}>{intelligence.ticket ? intelligence.ticket.projectedOdd : "--"}</Text>
          </View>
        </View>
        {ticketPicks.length ? (
          <View style={styles.ticketPickList}>
            {ticketPicks.map((pick, index) => (
              <View key={`${pick.label}-${index}`} style={styles.ticketPickRow}>
                <View style={styles.ticketPickIndex}>
                  <Text style={styles.ticketPickIndexText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{pick.label}</Text>
                  <Text style={styles.cardMeta}>{pick.confidenceScore}% de confianca • odd-modelo {pick.projectedOdd}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.alertBody}>Ainda nao foi possivel montar uma combinacao de menor risco com os dados atuais.</Text>
        )}
        <Text style={styles.alertBody}>{intelligence.ticket?.rationale || intelligence.conclusion}</Text>
      </View>

      <View style={styles.premiumUpsellCard}>
        <Text style={styles.premiumUpsellEyebrow}>Monetizacao</Text>
        <Text style={styles.premiumUpsellTitle}>
          {unlocked ? "Analise PRO liberada" : "Desbloqueie a IA completa do confronto"}
        </Text>
        <Text style={styles.alertBody}>
          {unlocked
            ? premiumSubscription?.accessLevel === "premium"
              ? "Sua conta premium esta ativa. Continue usando para abrir comparativos completos, ticket pronto e ranking automatico."
              : `Desbloqueio por anuncio ativo ate ${formatDateTime(adUnlockUntil)}.`
            : "A versao gratuita mostra um preview dos mercados. Assine no Mercado Pago ou veja um anuncio recompensado para liberar a leitura completa do confronto."}
        </Text>

        <View style={styles.premiumActionColumn}>
          <Pressable style={styles.primaryButton} onPress={onStartPremium} disabled={premiumBusy}>
            {premiumBusy ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.primaryButtonText}>{premiumSubscription?.accessLevel === "premium" ? "Gerenciar Premium" : "Assinar com Mercado Pago"}</Text>}
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton} onPress={onRefreshPremium} disabled={premiumBusy}>
              <Text style={styles.secondaryButtonText}>Atualizar premium</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, (!rewardedReady || rewardedLoading) && styles.secondaryButtonDisabled]}
              onPress={onUnlockWithAd}
              disabled={!rewardedReady || rewardedLoading}
            >
              {rewardedLoading ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.secondaryButtonText}>{unlocked ? "Recarregar bonus" : "Ver anuncio"}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function PremiumAnalysisPanel({
  analysis,
  premiumAccess,
  adUnlockUntil,
  premiumSubscription,
  premiumBusy,
  onStartPremium,
  onRefreshPremium,
  onUnlockWithAd,
  rewardedReady,
  rewardedLoading
}) {
  const premium = analysis.premium;

  if (!premium) {
    return (
      <View style={styles.statsLoading}>
        <Text style={styles.alertBody}>A engine premium ainda nao encontrou base suficiente para esse time.</Text>
      </View>
    );
  }

  const unlocked = premiumAccess || Date.now() < Number(adUnlockUntil || 0);
  const visiblePatterns = unlocked ? premium.hiddenPatterns : premium.hiddenPatterns.slice(0, 2);
  const visibleMarkets = unlocked ? premium.markets : premium.markets.slice(0, 2);

  return (
    <View style={styles.premiumWrap}>
      <LinearGradient colors={["rgba(56,189,248,0.16)", "rgba(34,197,94,0.10)", "rgba(8,19,34,0.92)"]} style={styles.premiumHero}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.premiumEyebrow}>Analise PRO</Text>
            <Text style={styles.premiumTitle}>Score inteligente do time</Text>
          </View>
          <View style={styles.premiumScoreBadge}>
            <Text style={styles.premiumScoreValue}>{premium.overallScore}</Text>
            <Text style={styles.premiumScoreTier}>{premium.tier}</Text>
          </View>
        </View>
        <Text style={styles.teamAnalysisSummary}>{premium.reason}</Text>
      </LinearGradient>

      <View style={styles.analysisMetricGrid}>
        <AnalysisMetricCard label="Forma" value={String(premium.subscores.form)} hint="peso 25%" />
        <AnalysisMetricCard label="Ataque" value={String(premium.subscores.attack)} hint="peso 20%" accent="blue" />
        <AnalysisMetricCard label="Defesa" value={String(premium.subscores.defense)} hint="peso 20%" />
        <AnalysisMetricCard label="Pressao" value={String(premium.subscores.pressure)} hint={premium.pressureLabel} accent="gold" />
      </View>

      <NarrativeCard title="DNA do time" body={`${premium.dna.label}: ${premium.dna.reason}`} icon="flask-outline" accent="#38BDF8" />
      <NarrativeCard title="Raio-x de pressao" body={`Leitura mental: ${premium.pressureLabel}. Dominio atual: ${premium.domain}.`} icon="pulse-outline" accent="#F59E0B" />
      <NarrativeCard title="Confiabilidade" body={`${premium.reliability.label}: ${premium.reliability.reason}`} icon="shield-checkmark-outline" accent="#22C55E" />

      <View style={styles.insightPanel}>
        <View style={styles.insightHeader}>
          <View style={[styles.narrativeIcon, { borderColor: "#818CF855", backgroundColor: "#818CF822" }]}>
            <Ionicons name="time-outline" size={15} color="#A5B4FC" />
          </View>
          <Text style={styles.insightTitle}>Mapa de momentos</Text>
        </View>
        <View style={styles.momentGrid}>
          {premium.momentMap.map((item) => (
            <View key={item.bucket} style={styles.momentCard}>
              <Text style={styles.momentBucket}>{item.bucket}</Text>
              <Text style={styles.momentLine}>Marca: {item.scored}</Text>
              <Text style={styles.momentLine}>Sofre: {item.conceded}</Text>
              <Text style={styles.cardMeta}>Intensidade {item.intensity}</Text>
            </View>
          ))}
        </View>
      </View>

      <InsightList title="Padroes ocultos" icon="eye-outline" accent="#A78BFA" items={visiblePatterns} empty="A amostra atual nao revelou um padrao oculto forte o bastante." />

      <View style={styles.insightPanel}>
        <View style={styles.insightHeader}>
          <View style={[styles.narrativeIcon, { borderColor: "#22C55E55", backgroundColor: "#22C55E22" }]}>
            <Ionicons name="trending-up-outline" size={15} color="#22C55E" />
          </View>
          <Text style={styles.insightTitle}>Mercados sugeridos</Text>
        </View>
        <View style={styles.premiumMarkets}>
          {visibleMarkets.map((market) => {
            const tone = marketConfidenceTone(market.confidence);

            return (
              <View key={market.label} style={styles.marketCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{market.label}</Text>
                  <View style={[styles.marketConfidenceBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <Text style={[styles.marketConfidenceText, { color: tone.text }]}>{market.confidence}</Text>
                  </View>
                </View>
                <Text style={styles.marketProbability}>{market.probability}%</Text>
                <Text style={styles.alertBody}>{market.explanation}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.premiumUpsellCard}>
        <Text style={styles.premiumUpsellEyebrow}>Monetizacao</Text>
        <Text style={styles.premiumUpsellTitle}>
          {unlocked ? "Analise PRO liberada" : "Desbloqueie a Analise PRO completa"}
        </Text>
        <Text style={styles.alertBody}>
          {unlocked
            ? premiumSubscription?.accessLevel === "premium"
              ? "Sua conta premium esta ativa. Continue usando para abrir mercados completos, historico VIP e comparativos avancados."
              : `Desbloqueio por anuncio ativo ate ${formatDateTime(adUnlockUntil)}.`
            : "A versao gratuita mostra um preview. Assine no Mercado Pago ou veja um anuncio recompensado para liberar mercados completos por algumas horas."}
        </Text>

        <View style={styles.premiumActionColumn}>
          <Pressable style={styles.primaryButton} onPress={onStartPremium} disabled={premiumBusy}>
            {premiumBusy ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.primaryButtonText}>{premiumSubscription?.accessLevel === "premium" ? "Gerenciar Premium" : "Assinar com Mercado Pago"}</Text>}
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryButton} onPress={onRefreshPremium} disabled={premiumBusy}>
              <Text style={styles.secondaryButtonText}>Atualizar premium</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, (!rewardedReady || rewardedLoading) && styles.secondaryButtonDisabled]}
              onPress={onUnlockWithAd}
              disabled={!rewardedReady || rewardedLoading}
            >
              {rewardedLoading ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.secondaryButtonText}>{unlocked ? "Recarregar bonus" : "Ver anuncio"}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function positionGroup(position) {
  const normalized = normalize(position);
  if (/(goleiro|goalkeeper|keeper)/.test(normalized)) return "Goleiros";
  if (/(defender|zagueiro|lateral|back)/.test(normalized)) return "Defensores";
  if (/(midfielder|meia|volante|winger)/.test(normalized)) return "Meias";
  if (/(forward|atacante|striker|centre-forward|center-forward)/.test(normalized)) return "Atacantes";
  return "Outros";
}

function rosterLineupStatus(player, lineupNames) {
  return lineupNames.has(normalize(player.name)) ? "Titular" : "Elenco";
}

function TeamPlayersPanel({ team, roster, lineups, loading, error }) {
  const lineupNames = useMemo(() => {
    return new Set(
      (lineups || [])
        .filter((item) => normalize(item.strTeam || "") === normalize(team.name))
        .map((item) => normalize(item.strPlayer))
        .filter(Boolean)
    );
  }, [lineups, team.name]);

  const groupedRoster = useMemo(() => {
    return roster.reduce((acc, player) => {
      const group = positionGroup(player.position);
      acc[group] ??= [];
      acc[group].push(player);
      return acc;
    }, {});
  }, [roster]);

  if (loading) {
    return (
      <View style={styles.statsLoading}>
        <Text style={styles.alertBody}>Carregando elenco e situacao dos jogadores...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.statsLoading}>
        <Text style={styles.alertBody}>{error}</Text>
      </View>
    );
  }

  if (!roster.length) {
    return (
      <View style={styles.statsLoading}>
        <Text style={styles.alertBody}>Esse time ainda nao tem elenco detalhado suficiente na fonte atual.</Text>
      </View>
    );
  }

  return (
    <View style={styles.teamPlayersWrap}>
      <View style={styles.analysisMetricGrid}>
        <AnalysisMetricCard label="Jogadores" value={String(roster.length)} hint="elenco encontrado" />
        <AnalysisMetricCard label="Titulares" value={String(lineupNames.size || 0)} hint="confirmados na escalacao atual" accent="blue" />
      </View>

      <View style={styles.insightPanel}>
        <View style={styles.insightHeader}>
          <View style={[styles.narrativeIcon, { borderColor: "#22C55E55", backgroundColor: "#22C55E22" }]}>
            <Ionicons name="people-outline" size={15} color="#22C55E" />
          </View>
          <Text style={styles.insightTitle}>Legenda da equipe</Text>
        </View>
        <View style={styles.insightBulletRow}>
          <View style={[styles.statusTinyDot, { backgroundColor: "#22C55E" }]} />
          <Text style={styles.insightText}>Titular: jogador encontrado na escalacao atual da partida.</Text>
        </View>
        <View style={styles.insightBulletRow}>
          <View style={[styles.statusTinyDot, { backgroundColor: "#64748B" }]} />
          <Text style={styles.insightText}>Elenco: atleta do plantel atual sem confirmacao na escalacao desta partida.</Text>
        </View>
      </View>

      {Object.entries(groupedRoster).map(([group, players]) => (
        <View key={group} style={styles.rosterGroup}>
          <Text style={styles.rosterGroupTitle}>{group}</Text>
          {players.map((player) => {
            const playerStatus = rosterLineupStatus(player, lineupNames);
            const playerStatusActive = playerStatus === "Titular";

            return (
              <View key={`${team.name}-${player.id}`} style={styles.rosterPlayerCard}>
                <View style={styles.rosterPlayerMain}>
                  <View style={styles.rosterPlayerAvatar}>
                    {player.photo ? (
                      <Image source={{ uri: player.photo }} style={styles.rosterPlayerAvatarImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.rosterPlayerAvatarText}>{badge(player.name)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rosterPlayerName}>{player.name}</Text>
                    <Text style={styles.cardMeta}>
                      {player.position || "Posicao nao informada"} â€¢ {player.nationality || "Sem nacionalidade"}
                    </Text>
                  </View>
                </View>
                <View style={[styles.rosterStatusBadge, playerStatusActive && styles.rosterStatusBadgeActive]}>
                  <Text style={[styles.rosterStatusText, playerStatusActive && styles.rosterStatusTextActive]}>
                    {playerStatus}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function BetradarTrackerCard({ match }) {
  const trackerMatchId = match?.betradarMatchId || null;

  if (!trackerMatchId) {
    return (
      <View style={styles.trackerEmpty}>
        <Text style={styles.cardTitle}>Tracker Betradar pronto para integrar</Text>
        <Text style={styles.alertBody}>
          VocÃª jÃ¡ conseguiu o pacote do LMT. Para abrir o mapa correto em cada partida, agora sÃ³ falta ligar o jogo do app ao `matchId` do Betradar.
        </Text>
        <View style={styles.infoGrid}>
          <Info label="Status" value="Estrutura pronta" />
          <Info label="Demo ID" value={BETRADAR_DEMO_MATCH_ID} />
          <Info label="Partida atual" value={match?.id || "Nao informada"} />
          <Info label="Betradar ID" value="Aguardando mapeamento" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.trackerCard}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: buildBetradarLmtHtml(trackerMatchId) }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.trackerWebview}
      />
    </View>
  );
}

function MatchModal({
  match,
  favorite,
  onClose,
  onFavorite,
  onRefreshMatch,
  premiumAccess,
  premiumUnlockUntil,
  premiumSubscription,
  premiumBusy,
  onStartPremium,
  onRefreshPremium,
  onUnlockWithAd,
  rewardedReady,
  rewardedLoading
}) {
  const [detailTab, setDetailTab] = useState("summary");
  const [resultsScope, setResultsScope] = useState("total");
  const [analysisSide, setAnalysisSide] = useState("home");
  const [sampleSize, setSampleSize] = useState(10);
  const [platformMatchBundle, setPlatformMatchBundle] = useState(null);
  const [stats, setStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [timeline, setTimeline] = useState([]);
  const [timelineError, setTimelineError] = useState("");
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastsError, setBroadcastsError] = useState("");
  const [lineups, setLineups] = useState([]);
  const [lineupsError, setLineupsError] = useState("");
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [analysisCache, setAnalysisCache] = useState({});
  const [analysisLoadingKey, setAnalysisLoadingKey] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [matchIntelligenceCache, setMatchIntelligenceCache] = useState({});
  const [matchIntelligenceLoadingKey, setMatchIntelligenceLoadingKey] = useState("");
  const [matchIntelligenceError, setMatchIntelligenceError] = useState("");
  const [rosterCache, setRosterCache] = useState({});
  const [rosterLoadingKey, setRosterLoadingKey] = useState("");
  const [rosterError, setRosterError] = useState("");
  const [recentBundle, setRecentBundle] = useState({ home: [], away: [] });
  const [calendarBundle, setCalendarBundle] = useState({ home: [], away: [] });
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [standingsRows, setStandingsRows] = useState([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [standingsError, setStandingsError] = useState("");

  useEffect(() => {
    let active = true;

    if (!match?.id) {
      setDetailTab("summary");
      setResultsScope("total");
      setAnalysisSide("home");
      setSampleSize(10);
      setPlatformMatchBundle(null);
      setStats([]);
      setStatsError("");
      setLoadingStats(false);
      setTimeline([]);
      setTimelineError("");
      setBroadcasts([]);
      setBroadcastsError("");
      setLineups([]);
      setLineupsError("");
      setLoadingExtras(false);
      setAnalysisCache({});
      setAnalysisLoadingKey("");
      setAnalysisError("");
      setMatchIntelligenceCache({});
      setMatchIntelligenceLoadingKey("");
      setMatchIntelligenceError("");
      setRosterCache({});
      setRosterLoadingKey("");
      setRosterError("");
      setRecentBundle({ home: [], away: [] });
      setCalendarBundle({ home: [], away: [] });
      setResultsLoading(false);
      setResultsError("");
      setCalendarLoading(false);
      setCalendarError("");
      setStandingsRows([]);
      setStandingsLoading(false);
      setStandingsError("");
      return () => {
        active = false;
      };
    }

    async function loadMatchDetails(reset = false) {
      if (reset) {
        setDetailTab("summary");
        setResultsScope("total");
        setAnalysisSide("home");
        setSampleSize(10);
        setPlatformMatchBundle(null);
        setStats([]);
        setStatsError("");
        setTimeline([]);
        setTimelineError("");
        setBroadcasts([]);
        setBroadcastsError("");
        setLineups([]);
        setLineupsError("");
        setAnalysisCache({});
        setAnalysisLoadingKey("");
        setAnalysisError("");
        setMatchIntelligenceCache({});
        setMatchIntelligenceLoadingKey("");
        setMatchIntelligenceError("");
        setRosterCache({});
        setRosterLoadingKey("");
        setRosterError("");
        setRecentBundle({ home: [], away: [] });
        setCalendarBundle({ home: [], away: [] });
        setResultsLoading(false);
        setResultsError("");
        setCalendarLoading(false);
        setCalendarError("");
        setStandingsRows([]);
        setStandingsLoading(false);
        setStandingsError("");
      }

      setLoadingStats(true);
      setLoadingExtras(true);

      let platformLoaded = false;
      let platformTimeline = [];

      try {
        const platform = await fetchPlatformMatchBundle(match.id);
        if (active) {
          platformLoaded = true;
          setPlatformMatchBundle(platform);
          setStats(platform.stats || []);
          setStatsError(platform.stats?.length ? "" : "Ainda nao chegaram estatisticas completas para esta partida.");
          platformTimeline = platform.timeline || [];
          setTimeline(platformTimeline);
          setTimelineError(platformTimeline.length ? "" : "Sem eventos detalhados para esta partida.");
          setRecentBundle({ home: platform.homeRecent || [], away: platform.awayRecent || [] });
          setCalendarBundle({ home: platform.homeUpcoming || [], away: platform.awayUpcoming || [] });
          setStandingsRows(platform.standings || []);
          setResultsError(platform.homeRecent?.length || platform.awayRecent?.length ? "" : "Nao foi possivel carregar os ultimos resultados reais dos dois times agora.");
          setCalendarError(platform.homeUpcoming?.length || platform.awayUpcoming?.length ? "" : "Nao foi possivel carregar o calendario real dos dois times agora.");
          setStandingsError(platform.standings?.length ? "" : "Classificacao indisponivel para essa competicao neste momento.");
        }
      } catch (_error) {
        if (active) {
          setPlatformMatchBundle(null);
        }
      }

      if (!platformLoaded) {
        try {
          const items = await fetchMatchStats(match.id);
          if (active) {
            setStats(items);
            setStatsError(items.length ? "" : "Ainda nao chegaram estatisticas completas para esta partida.");
          }
        } catch (error) {
          if (active) {
            setStatsError("Ainda nao chegaram estatisticas completas para esta partida.");
          }
        }
      }

      if (active) {
        setLoadingStats(false);
      }

      const results = await Promise.allSettled([
        platformLoaded ? Promise.resolve(platformTimeline) : fetchMatchTimeline(match.id),
        fetchMatchBroadcasts(match.id),
        fetchMatchLineup(match.id)
      ]);

      if (!active) return;

      const [timelineResult, broadcastsResult, lineupsResult] = results;

      if (timelineResult.status === "fulfilled") {
        setTimeline(timelineResult.value);
        setTimelineError(timelineResult.value.length ? "" : "Sem eventos detalhados para esta partida.");
      } else {
        setTimelineError("Sem eventos detalhados para esta partida.");
      }

      if (broadcastsResult.status === "fulfilled") {
        setBroadcasts(broadcastsResult.value);
        setBroadcastsError(broadcastsResult.value.length ? "" : "Sem canais cadastrados para esta partida.");
      } else {
        setBroadcastsError("Sem canais cadastrados para esta partida.");
      }

      if (lineupsResult.status === "fulfilled") {
        setLineups(lineupsResult.value);
        setLineupsError(lineupsResult.value.length ? "" : "Escalacoes ainda nao publicadas pela fonte.");
      } else {
        setLineupsError("Escalacoes ainda nao publicadas pela fonte.");
      }

      setLoadingExtras(false);
    }

    loadMatchDetails(true);

    const intervalMs = match.status === "live" ? DETAIL_LIVE_REFRESH_INTERVAL_MS : DETAIL_IDLE_REFRESH_INTERVAL_MS;
    const interval = setInterval(() => {
      if (!active) return;
      onRefreshMatch?.();
      loadMatchDetails(false);
    }, intervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [match?.id, match?.status]);

  const selectedTeam = match ? teamViewFromSide(match, analysisSide) : null;
  const analysisKey = match ? `${match.id}-${analysisSide}-${sampleSize}` : "";
  const matchIntelligenceKey = match ? `${match.id}-${sampleSize}` : "";
  const rosterKey = match ? `${match.id}-${analysisSide}` : "";
  const analysisBundle = analysisCache[analysisKey] || null;
  const matchIntelligence = matchIntelligenceCache[matchIntelligenceKey] || null;
  const teamRoster = rosterCache[rosterKey] || [];
  const currentTone = match ? tone(match.status) : tone("upcoming");
  const homeResults = recentBundle.home || [];
  const awayResults = recentBundle.away || [];
  const homeCalendar = calendarBundle.home || [];
  const awayCalendar = calendarBundle.away || [];
  const homeResultsScope = resultsScope === "total" ? homeResults : homeResults.filter((item) => resultsScope === "home" ? item.venue === "Casa" : true);
  const awayResultsScope = resultsScope === "total" ? awayResults : awayResults.filter((item) => resultsScope === "away" ? item.venue === "Fora" : true);

  useEffect(() => {
    let active = true;

    if (!match?.id || !selectedTeam || !["analysis", "traits"].includes(detailTab)) {
      return () => {
        active = false;
      };
    }

    if (analysisCache[analysisKey] || analysisLoadingKey === analysisKey) {
      return () => {
        active = false;
      };
    }

    setAnalysisLoadingKey(analysisKey);
    setAnalysisError("");

    fetchTeamAnalysis({
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      teamBadge: selectedTeam.badge,
      leagueId: match.leagueId,
      competition: match.competition,
      season: match.season,
      referenceDate: match.date,
      excludeEventId: match.id,
      sampleSize
    })
      .then((bundle) => {
        if (!active) return;
        setAnalysisCache((current) => ({ ...current, [analysisKey]: bundle }));
      })
      .catch(() => {
        if (!active) return;
        setAnalysisError("Nao foi possivel montar a analise avancada desse time com a base atual.");
      })
      .finally(() => {
        if (active) {
          setAnalysisLoadingKey("");
        }
      });

    return () => {
      active = false;
    };
  }, [analysisCache, analysisKey, analysisLoadingKey, detailTab, match?.competition, match?.date, match?.id, match?.leagueId, sampleSize, selectedTeam]);

  useEffect(() => {
    let active = true;

    if (!match?.id || detailTab !== "premium") {
      return () => {
        active = false;
      };
    }

    if (matchIntelligenceCache[matchIntelligenceKey] || matchIntelligenceLoadingKey === matchIntelligenceKey) {
      return () => {
        active = false;
      };
    }

    setMatchIntelligenceLoadingKey(matchIntelligenceKey);
    setMatchIntelligenceError("");

    fetchMatchIntelligence({
      match,
      sampleSize
    })
      .then((bundle) => {
        if (!active) return;
        setMatchIntelligenceCache((current) => ({ ...current, [matchIntelligenceKey]: bundle }));
      })
      .catch(() => {
        if (!active) return;
        setMatchIntelligenceError("Nao foi possivel cruzar os ultimos jogos dos dois times com a base atual.");
      })
      .finally(() => {
        if (active) {
          setMatchIntelligenceLoadingKey("");
        }
      });

    return () => {
      active = false;
    };
  }, [detailTab, match, matchIntelligenceCache, matchIntelligenceKey, matchIntelligenceLoadingKey, sampleSize]);

  useEffect(() => {
    let active = true;

    if (!match?.id || !selectedTeam || detailTab !== "players") {
      return () => {
        active = false;
      };
    }

    if (rosterCache[rosterKey] || rosterLoadingKey === rosterKey) {
      return () => {
        active = false;
      };
    }

    setRosterLoadingKey(rosterKey);
    setRosterError("");

    async function loadRoster() {
      let teamId = selectedTeam.id;
      if (!teamId) {
        const teamsFound = await searchPlatformTeams(selectedTeam.name).catch(() => searchTeams(selectedTeam.name));
        const exactTeam =
          teamsFound.find((item) => normalize(item.name) === normalize(selectedTeam.name)) ||
          teamsFound[0];
        teamId = exactTeam?.id;
      }

      if (!teamId) {
        throw new Error("roster");
      }

      const roster = await fetchTeamRoster(teamId);
      if (!active) return;
      setRosterCache((current) => ({ ...current, [rosterKey]: roster }));
    }

    loadRoster()
      .catch(() => {
        if (!active) return;
        setRosterError("Nao foi possivel carregar o elenco detalhado desse time agora.");
      })
      .finally(() => {
        if (active) {
          setRosterLoadingKey("");
        }
      });

    return () => {
      active = false;
    };
  }, [detailTab, match?.id, rosterCache, rosterKey, rosterLoadingKey, selectedTeam]);

  useEffect(() => {
    let active = true;

    if (!match?.id || !["results", "classification", "h2h"].includes(detailTab)) {
      return () => {
        active = false;
      };
    }

    setResultsLoading(true);
    setResultsError("");
    setStandingsLoading(true);
    setStandingsError("");

    if (platformMatchBundle) {
      setRecentBundle({
        home: platformMatchBundle.homeRecent || [],
        away: platformMatchBundle.awayRecent || []
      });
      setStandingsRows(platformMatchBundle.standings || []);
      setResultsError(
        platformMatchBundle.homeRecent?.length || platformMatchBundle.awayRecent?.length
          ? ""
          : "Nao foi possivel carregar os ultimos resultados reais dos dois times agora."
      );
      setStandingsError(
        platformMatchBundle.standings?.length
          ? ""
          : "Classificacao indisponivel para essa competicao neste momento."
      );
      setResultsLoading(false);
      setStandingsLoading(false);
      return () => {
        active = false;
      };
    }

    Promise.allSettled([
      fetchTeamRecentMatches({
        teamId: match.homeTeamId,
        teamName: match.homeTeam,
        leagueId: match.leagueId,
        season: match.season,
        referenceDate: match.date,
        excludeEventId: match.id,
        sampleSize: 20
      }),
      fetchTeamRecentMatches({
        teamId: match.awayTeamId,
        teamName: match.awayTeam,
        leagueId: match.leagueId,
        season: match.season,
        referenceDate: match.date,
        excludeEventId: match.id,
        sampleSize: 20
      }),
      fetchCompetitionStandings({
        leagueId: match.leagueId,
        season: match.season,
        referenceDate: match.date,
        focusTeamIds: [match.homeTeamId, match.awayTeamId],
        focusTeamNames: [match.homeTeam, match.awayTeam]
      })
    ]).then(([homeResult, awayResult, standingsResult]) => {
      if (!active) return;

      if (homeResult.status === "fulfilled" || awayResult.status === "fulfilled") {
        setRecentBundle({
          home: homeResult.status === "fulfilled" ? homeResult.value : [],
          away: awayResult.status === "fulfilled" ? awayResult.value : []
        });
        setResultsError("");
      } else {
        setRecentBundle({ home: [], away: [] });
        setResultsError("Nao foi possivel carregar os ultimos resultados reais dos dois times agora.");
      }

      if (standingsResult.status === "fulfilled" && standingsResult.value.length) {
        setStandingsRows(standingsResult.value);
        setStandingsError("");
      } else {
        setStandingsRows([]);
        setStandingsError("Classificacao indisponivel para essa competicao neste momento.");
      }

      setResultsLoading(false);
      setStandingsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [detailTab, match?.awayTeam, match?.awayTeamId, match?.date, match?.homeTeam, match?.homeTeamId, match?.id, match?.leagueId, match?.season, platformMatchBundle]);

  useEffect(() => {
    let active = true;

    if (!match?.id || detailTab !== "calendar") {
      return () => {
        active = false;
      };
    }

    setCalendarLoading(true);
    setCalendarError("");

    if (platformMatchBundle) {
      setCalendarBundle({
        home: platformMatchBundle.homeUpcoming || [],
        away: platformMatchBundle.awayUpcoming || []
      });
      setCalendarError(
        platformMatchBundle.homeUpcoming?.length || platformMatchBundle.awayUpcoming?.length
          ? ""
          : "Nao foi possivel carregar o calendario real dos dois times agora."
      );
      setCalendarLoading(false);
      return () => {
        active = false;
      };
    }

    Promise.allSettled([
      fetchTeamUpcomingMatches({
        teamId: match.homeTeamId,
        teamName: match.homeTeam,
        sampleSize: 10
      }),
      fetchTeamUpcomingMatches({
        teamId: match.awayTeamId,
        teamName: match.awayTeam,
        sampleSize: 10
      })
    ]).then(([homeResult, awayResult]) => {
      if (!active) return;

      if (homeResult.status === "fulfilled" || awayResult.status === "fulfilled") {
        setCalendarBundle({
          home: homeResult.status === "fulfilled" ? homeResult.value : [],
          away: awayResult.status === "fulfilled" ? awayResult.value : []
        });
        setCalendarError("");
      } else {
        setCalendarBundle({ home: [], away: [] });
        setCalendarError("Nao foi possivel carregar o calendario real dos dois times agora.");
      }

      setCalendarLoading(false);
    });

    return () => {
      active = false;
    };
  }, [detailTab, match?.awayTeam, match?.awayTeamId, match?.homeTeam, match?.homeTeamId, match?.id, platformMatchBundle]);

  if (!match) return null;

  const renderRecentRow = (item, sideLabel) => {
    const resultTone = formResultTone(item.result);
    return (
      <View key={`${sideLabel}-${item.id}`} style={styles.recentRow}>
        <View style={styles.recentDateWrap}>
          <Text style={styles.recentDate}>{item.dateLabel}</Text>
          <Text style={styles.recentDateMeta}>{item.competition}</Text>
        </View>
        <View style={styles.recentTeamsWrap}>
          <Text style={styles.recentOpponent} numberOfLines={1}>{item.opponent}</Text>
          <Text style={styles.recentVenue}>{item.venue}</Text>
        </View>
        <View style={styles.recentScoreWrap}>
          <Text style={styles.recentScore}>{item.scored} x {item.conceded}</Text>
          <View style={[styles.recentResultPill, { backgroundColor: resultTone.bg, borderColor: resultTone.border }]}>
            <Text style={[styles.recentResultText, { color: resultTone.text }]}>{item.result}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderH2HRow = (item) => (
    <View key={`h2h-${item.id}-${item.date}`} style={styles.recentRow}>
      <View style={styles.recentDateWrap}>
        <Text style={styles.recentDate}>{item.dateLabel || item.date}</Text>
        <Text style={styles.recentDateMeta}>{item.competition}</Text>
      </View>
      <View style={styles.recentTeamsWrap}>
        <Text style={styles.recentOpponent} numberOfLines={1}>{item.homeTeam}</Text>
        <Text style={styles.recentOpponent} numberOfLines={1}>{item.awayTeam}</Text>
      </View>
      <View style={styles.recentScoreWrap}>
        <Text style={styles.recentScore}>{item.homeScore} x {item.awayScore}</Text>
      </View>
    </View>
  );

  const renderCalendarRow = (item, sideLabel) => (
    <View key={`${sideLabel}-${item.id}`} style={styles.calendarRow}>
      <View style={styles.calendarRowMeta}>
        <Text style={styles.calendarRowDate}>{item.dateLabel}</Text>
        <Text style={styles.calendarRowTime}>{item.kickoff}</Text>
      </View>
      <View style={styles.calendarRowMain}>
        <Text style={styles.calendarRowOpponent} numberOfLines={1}>{item.opponent}</Text>
        <Text style={styles.calendarRowCompetition} numberOfLines={1}>{item.competition}</Text>
      </View>
      <View style={styles.calendarRowVenuePill}>
        <Text style={styles.calendarRowVenueText}>{item.venue}</Text>
      </View>
    </View>
  );

  const h2hRows = platformMatchBundle?.h2h?.matches?.length
    ? platformMatchBundle.h2h.matches.slice(0, 8)
    : recentBundle.home
        .filter((item) => normalize(item.opponent) === normalize(match.awayTeam))
        .slice(0, 8);
  const h2hHomeWins = platformMatchBundle?.h2h?.summary?.homeWins ?? h2hRows.filter((item) => item.result === "V").length;
  const h2hDraws = platformMatchBundle?.h2h?.summary?.draws ?? h2hRows.filter((item) => item.result === "E").length;
  const h2hAwayWins = platformMatchBundle?.h2h?.summary?.awayWins ?? h2hRows.filter((item) => item.result === "D").length;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.modalBack}>
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rowBetween}>
            <View style={styles.matchModalEyebrow}>
              <View style={[styles.statusBadge, { backgroundColor: currentTone.bg, borderColor: currentTone.border }]}>
                <Text style={[styles.statusText, { color: currentTone.text }]}>
                  {currentTone.label}{match.status === "live" && match.minute ? ` ${match.minute}` : ""}
                </Text>
              </View>
              <Text style={styles.matchModalBreadcrumb}>
                Futebol • {match.country || "Internacional"} • {match.competition}
              </Text>
            </View>
            <Pressable style={styles.iconWrap} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.matchHeroCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.matchHeroCompetition}>{match.competition}</Text>
                <Text style={styles.matchHeroStage}>{match.stage || "Confronto principal"}</Text>
              </View>
              <View style={styles.matchHeroTimePill}>
                <Ionicons name="time-outline" size={13} color={colors.text} />
                <Text style={styles.matchHeroTimeText}>{dateLabel(match.date)} • {match.kickoff}</Text>
              </View>
            </View>

            <View style={styles.matchHeroTeams}>
              <Team name={match.homeTeam} badgeUrl={match.homeBadge} strong />
              <View style={styles.matchHeroScoreWrap}>
                <Text style={styles.matchHeroScore}>
                  {match.status === "upcoming" ? "--" : `${match.homeScore ?? 0} x ${match.awayScore ?? 0}`}
                </Text>
                <Text style={styles.matchHeroScoreMeta}>
                  {match.status === "upcoming" ? "Pre-jogo" : "Placar ao vivo"}
                </Text>
              </View>
              <Team name={match.awayTeam} badgeUrl={match.awayBadge} strong />
            </View>

            <View style={styles.matchHeroFooter}>
              <View style={styles.matchHeroFooterPill}>
                <Ionicons name="location-outline" size={13} color={colors.muted} />
                <Text style={styles.matchHeroFooterText}>{match.venue || "Local nao informado"}</Text>
              </View>
              <View style={styles.matchHeroFooterPill}>
                <Ionicons name="shield-outline" size={13} color={colors.muted} />
                <Text style={styles.matchHeroFooterText}>{match.categoryLabel || "Profissional"}</Text>
              </View>
            </View>
          </View>

          {(match.status === "live" || match.status === "finished") ? (
            <LivePulsePanel match={match} stats={stats} timeline={timeline} />
          ) : null}

          <View style={styles.infoGrid}>
            <Info label="Categoria" value={match.categoryLabel || "Profissional"} />
            <Info label="Campeonato" value={match.competition} />
            <Info label="Fase" value={match.stage} />
            <Info label="Horario" value={`${dateLabel(match.date)} - ${match.kickoff}`} />
            <Info label="Local" value={match.venue} />
            <Info label="Pais" value={match.country || "Nao informado"} />
            <Info label="Origem" value={match.sourceLabel} />
          </View>

          <DetailTabBar activeTab={detailTab} onChange={setDetailTab} />

          <View style={styles.h2hQuickCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.h2hQuickTitle}>Confrontos diretos reais</Text>
              <Text style={styles.h2hQuickMeta}>{h2hRows.length ? `${h2hRows.length} jogos` : "Sem base direta"}</Text>
            </View>
            {h2hRows.length ? (
              <>
                <View style={styles.h2hQuickScoreboard}>
                  <View style={styles.h2hQuickStat}>
                    <Text style={styles.h2hQuickValue}>{h2hHomeWins}</Text>
                    <Text style={styles.h2hQuickLabel}>{match.homeTeam}</Text>
                  </View>
                  <View style={styles.h2hQuickDivider}>
                    <Text style={styles.h2hQuickDividerText}>{h2hDraws} empates</Text>
                  </View>
                  <View style={styles.h2hQuickStat}>
                    <Text style={styles.h2hQuickValue}>{h2hAwayWins}</Text>
                    <Text style={styles.h2hQuickLabel}>{match.awayTeam}</Text>
                  </View>
                </View>
                <Text style={styles.h2hQuickHint}>Abra a aba H2H para ver os confrontos jogo a jogo.</Text>
              </>
            ) : (
              <Text style={styles.h2hQuickHint}>Ainda nao existem confrontos suficientes carregados entre esses dois times na base atual.</Text>
            )}
          </View>

          {detailTab === "results" && (
            <View style={styles.statsSection}>
              <View style={styles.resultsScopeRow}>
                <Pressable style={[styles.resultsScopeChip, resultsScope === "total" && styles.resultsScopeChipActive]} onPress={() => setResultsScope("total")}>
                  <Text style={[styles.resultsScopeText, resultsScope === "total" && styles.resultsScopeTextActive]}>Total</Text>
                </Pressable>
                <Pressable style={[styles.resultsScopeChip, resultsScope === "home" && styles.resultsScopeChipActive]} onPress={() => setResultsScope("home")}>
                  <Text style={[styles.resultsScopeText, resultsScope === "home" && styles.resultsScopeTextActive]}>{match.homeTeam} casa</Text>
                </Pressable>
                <Pressable style={[styles.resultsScopeChip, resultsScope === "away" && styles.resultsScopeChipActive]} onPress={() => setResultsScope("away")}>
                  <Text style={[styles.resultsScopeText, resultsScope === "away" && styles.resultsScopeTextActive]}>{match.awayTeam} fora</Text>
                </Pressable>
              </View>

              {resultsLoading ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Carregando resultados reais dos dois times...</Text>
                </View>
              ) : resultsError ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{resultsError}</Text>
                </View>
              ) : (
                <View style={styles.resultsPanelsWrap}>
                  <View style={styles.resultsPanel}>
                    <Text style={styles.resultsPanelTitle}>Ultimos jogos: {match.homeTeam}</Text>
                    {homeResultsScope.length ? homeResultsScope.map((item) => renderRecentRow(item, "home")) : <Empty title="Sem jogos encontrados" body="Nao ha partidas suficientes nesse recorte." />}
                  </View>
                  <View style={styles.resultsPanel}>
                    <Text style={styles.resultsPanelTitle}>Ultimos jogos: {match.awayTeam}</Text>
                    {awayResultsScope.length ? awayResultsScope.map((item) => renderRecentRow(item, "away")) : <Empty title="Sem jogos encontrados" body="Nao ha partidas suficientes nesse recorte." />}
                  </View>
                </View>
              )}
            </View>
          )}

          {detailTab === "calendar" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Calendario dos times</Text>
              {calendarLoading ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Buscando proximos jogos reais dos dois times...</Text>
                </View>
              ) : calendarError ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{calendarError}</Text>
                </View>
              ) : (
                <View style={styles.resultsPanelsWrap}>
                  <View style={styles.resultsPanel}>
                    <Text style={styles.resultsPanelTitle}>Proximos: {match.homeTeam}</Text>
                    {homeCalendar.length ? homeCalendar.map((item) => renderCalendarRow(item, "home-calendar")) : <Empty title="Sem agenda carregada" body="A base atual nao retornou os proximos jogos desse time." />}
                  </View>
                  <View style={styles.resultsPanel}>
                    <Text style={styles.resultsPanelTitle}>Proximos: {match.awayTeam}</Text>
                    {awayCalendar.length ? awayCalendar.map((item) => renderCalendarRow(item, "away-calendar")) : <Empty title="Sem agenda carregada" body="A base atual nao retornou os proximos jogos desse time." />}
                  </View>
                </View>
              )}
            </View>
          )}

          {detailTab === "h2h" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Confrontos diretos</Text>
              {resultsLoading ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Buscando confrontos diretos reais...</Text>
                </View>
              ) : h2hRows.length ? (
                <View style={styles.resultsPanel}>
                  <Text style={styles.resultsPanelTitle}>{match.homeTeam} x {match.awayTeam}</Text>
                  {platformMatchBundle?.h2h?.matches?.length
                    ? h2hRows.map((item) => renderH2HRow(item))
                    : h2hRows.map((item) => renderRecentRow(item, "h2h"))}
                </View>
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Nao encontramos confrontos diretos suficientes entre esses times nessa base agora.</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "classification" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Classificacao</Text>
              {standingsLoading ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Montando tabela real da competicao...</Text>
                </View>
              ) : standingsError ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{standingsError}</Text>
                </View>
              ) : (
                <View style={styles.tableWrap}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellRank]}>#</Text>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderCellTeam]}>Time</Text>
                    <Text style={styles.tableHeaderCell}>PJ</Text>
                    <Text style={styles.tableHeaderCell}>V</Text>
                    <Text style={styles.tableHeaderCell}>E</Text>
                    <Text style={styles.tableHeaderCell}>D</Text>
                    <Text style={styles.tableHeaderCell}>SG</Text>
                    <Text style={styles.tableHeaderCell}>PTS</Text>
                  </View>

                  {standingsRows.slice(0, 16).map((row) => (
                    <View key={`${row.teamId || row.teamName}-${row.rank}`} style={[styles.tableRow, row.highlight && styles.tableRowHighlight]}>
                      <Text style={[styles.tableCell, styles.tableCellRank]}>{row.rank}</Text>
                      <View style={[styles.tableCellTeamWrap, styles.tableCellTeam]}>
                        <View style={styles.tableTeamBadge}>
                          {row.badge ? <Image source={{ uri: row.badge }} style={styles.tableTeamBadgeImage} resizeMode="contain" /> : <Text style={styles.tableTeamBadgeText}>{badge(row.teamName)}</Text>}
                        </View>
                        <Text style={styles.tableTeamName} numberOfLines={1}>{row.teamName}</Text>
                      </View>
                      <Text style={styles.tableCell}>{row.played}</Text>
                      <Text style={styles.tableCell}>{row.wins}</Text>
                      <Text style={styles.tableCell}>{row.draws}</Text>
                      <Text style={styles.tableCell}>{row.losses}</Text>
                      <Text style={styles.tableCell}>{row.goalDifference}</Text>
                      <Text style={[styles.tableCell, styles.tableCellPoints]}>{row.points}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {["analysis", "traits", "players"].includes(detailTab) ? (
            <>
              <TeamScopeSwitcher match={match} activeSide={analysisSide} onChange={setAnalysisSide} />
              {(detailTab === "analysis" || detailTab === "traits") ? (
                <View style={styles.analysisControlBar}>
                  <Text style={styles.cardMeta}>Base estatistica</Text>
                  <SampleWindowSelector value={sampleSize} onChange={setSampleSize} />
                </View>
              ) : null}
            </>
          ) : null}

          {detailTab === "premium" ? (
            <View style={styles.analysisControlBar}>
              <Text style={styles.cardMeta}>Janela do confronto</Text>
              <SampleWindowSelector value={sampleSize} onChange={setSampleSize} />
            </View>
          ) : null}

          {detailTab === "summary" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Resumo da partida</Text>
              <View style={styles.summaryGrid}>
                <Info label="Mandante" value={match.homeTeam} />
                <Info label="Visitante" value={match.awayTeam} />
                <Info label="Placar" value={match.status === "upcoming" ? "Aguardando inicio" : `${match.homeScore ?? 0} x ${match.awayScore ?? 0}`} />
                <Info label="Status" value={currentTone.label} />
              </View>
              {stats.slice(0, 6).map((stat) => (
                <SummaryRow key={`summary-${stat.key}`} label={stat.label} homeValue={stat.homeValue} awayValue={stat.awayValue} />
              ))}
              {!stats.length && !loadingStats && (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Resumo avancado ainda nao disponivel para esta partida.</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "analysis" && (
            <View style={styles.statsSection}>
              <View style={styles.rowBetween}>
                <Text style={styles.statsTitle}>Analise profunda do time</Text>
                {analysisLoadingKey === analysisKey && <ActivityIndicator size="small" color={colors.text} />}
              </View>

              {analysisLoadingKey === analysisKey && !analysisBundle ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Montando leitura estatistica dos ultimos jogos disponiveis...</Text>
                </View>
              ) : analysisBundle ? (
                <TeamAnalysisPanel analysis={analysisBundle} requestedSampleSize={sampleSize} />
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{analysisError || "Sem base suficiente para montar a analise desse time agora."}</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "premium" && (
            <View style={styles.statsSection}>
              <View style={styles.rowBetween}>
                <Text style={styles.statsTitle}>Match Intelligence Engine</Text>
                {matchIntelligenceLoadingKey === matchIntelligenceKey && <ActivityIndicator size="small" color={colors.text} />}
              </View>

              {matchIntelligenceLoadingKey === matchIntelligenceKey && !matchIntelligence ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Calculando confronto completo, score de confianca, mercados e bilhete...</Text>
                </View>
              ) : matchIntelligence ? (
                <MatchIntelligencePanel
                  intelligence={matchIntelligence}
                  premiumAccess={premiumAccess}
                  adUnlockUntil={premiumUnlockUntil}
                  premiumSubscription={premiumSubscription}
                  premiumBusy={premiumBusy}
                  onStartPremium={handleStartPremium}
                  onRefreshPremium={handleRefreshPremium}
                  onUnlockWithAd={handleRewardedUnlock}
                  rewardedReady={rewardedReady}
                  rewardedLoading={rewardedLoading}
                />
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{matchIntelligenceError || "Sem base suficiente para abrir a analise premium do confronto agora."}</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "traits" && (
            <View style={styles.statsSection}>
              <View style={styles.rowBetween}>
                <Text style={styles.statsTitle}>Caracteristicas do time</Text>
                {analysisLoadingKey === analysisKey && <ActivityIndicator size="small" color={colors.text} />}
              </View>

              {analysisLoadingKey === analysisKey && !analysisBundle ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Levantando pontos fortes, pontos fracos e estilo de jogo...</Text>
                </View>
              ) : analysisBundle ? (
                <TeamTraitsPanel analysis={analysisBundle} unlocked={premiumAccess} />
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{analysisError || "Sem base suficiente para caracterizar esse time agora."}</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "players" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Elenco do confronto</Text>
              <TeamPlayersPanel
                team={selectedTeam}
                roster={teamRoster}
                lineups={lineups}
                loading={rosterLoadingKey === rosterKey}
                error={rosterError}
              />
            </View>
          )}

          {detailTab === "stats" && (
            <View style={styles.statsSection}>
              <View style={styles.rowBetween}>
                <Text style={styles.statsTitle}>Estatisticas completas</Text>
                {(loadingStats || loadingExtras) && <ActivityIndicator size="small" color={colors.text} />}
              </View>

              <View style={styles.statTeamsHeader}>
                <Text style={styles.statTeamName}>{match.homeTeam}</Text>
                <Text style={styles.statTeamCenter}>Comparativo</Text>
                <Text style={[styles.statTeamName, styles.statTeamNameRight]}>{match.awayTeam}</Text>
              </View>

              {loadingStats ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Buscando dados completos da partida...</Text>
                </View>
              ) : stats.length ? (
                stats.map((stat) => <StatComparison key={stat.key} stat={stat} />)
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{statsError || "Nenhuma estatistica detalhada disponivel para este jogo."}</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "events" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Eventos da partida</Text>
              {loadingExtras ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Buscando lances importantes...</Text>
                </View>
              ) : timeline.length ? (
                timeline.map((item) => <TimelineItem key={item.id} item={item} />)
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{timelineError || "Sem eventos detalhados para esta partida."}</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "tv" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Transmissao</Text>
              {loadingExtras ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Buscando canais disponiveis...</Text>
                </View>
              ) : broadcasts.length ? (
                broadcasts.map((item) => <BroadcastCard key={item.id} item={item} />)
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{broadcastsError || "Sem canais cadastrados para esta partida."}</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "lineups" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Escalacoes</Text>
              {loadingExtras ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Buscando escalacoes dos times...</Text>
                </View>
              ) : lineups.length ? (
                lineups.map((item, index) => (
                  <View key={`${item.idLineup || item.strPlayer || index}`} style={styles.timelineCard}>
                    <Text style={styles.timelinePlayer}>{item.strPlayer || "Jogador"}</Text>
                    <Text style={styles.timelineMeta}>{item.strTeam || item.strPosition || "Escalacao"}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{lineupsError || "Escalacoes ainda nao publicadas pela fonte."}</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "tracker" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Live Match Tracker</Text>
              <BetradarTrackerCard match={match} />
            </View>
          )}

          <Pressable style={styles.favoriteAction} onPress={onFavorite}>
            <Ionicons name={favorite ? "bookmark" : "bookmark-outline"} size={18} color={favorite ? colors.gold : colors.text} />
            <Text style={styles.favoriteActionText}>{favorite ? "Remover dos favoritos" : "Salvar nos favoritos"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Info({ label, value }) {
  return <View style={styles.info}><Text style={styles.cardMeta}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function BrandMark({ size = 52 }) {
  const inset = Math.round(size * 0.12);
  const radiusSize = Math.round(size * 0.32);
  const coreSize = Math.round(size * 0.38);
  const nodeSize = Math.max(6, Math.round(size * 0.12));
  const innerRadius = Math.round(size * 0.22);

  return (
    <LinearGradient colors={["#34D399", "#0F766E", "#0B1220"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.brandMark, { width: size, height: size, borderRadius: radiusSize }]}>
      <View style={[styles.brandGlow, { top: -size * 0.18, left: -size * 0.06, width: size * 0.7, height: size * 0.45, borderRadius: size }]} />
      <View style={[styles.brandInset, { top: inset, right: inset, bottom: inset, left: inset, borderRadius: innerRadius }]}>
        <View style={[styles.brandHorizontalLine, { top: inset + coreSize * 0.35 }]} />
        <View style={[styles.brandVerticalLine, { left: size * 0.5 - 0.5 }]} />
        <View style={[styles.brandOrbit, { width: coreSize + 10, height: coreSize + 10, borderRadius: coreSize }]} />
        <View style={[styles.brandCore, { width: coreSize, height: coreSize, borderRadius: coreSize / 2 }]}>
          <Ionicons name="football" size={Math.round(size * 0.28)} color="#F8FFFC" />
        </View>
        <View style={[styles.brandNode, { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2, top: inset - 2, left: size * 0.5 - nodeSize / 2, backgroundColor: "#A7F3D0" }]} />
        <View style={[styles.brandNode, { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2, top: size * 0.5 - nodeSize / 2, right: inset - 1, backgroundColor: "#60A5FA" }]} />
        <View style={[styles.brandNode, { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2, bottom: inset - 1, left: inset + 2, backgroundColor: "#FDE68A" }]} />
      </View>
    </LinearGradient>
  );
}

export default function App() {
  return <AppShell />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing.screen },
  topBar: { marginTop: 8, marginBottom: 16, gap: 14, padding: 18, borderRadius: 30, backgroundColor: "rgba(10,21,37,0.90)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden", shadowColor: "#020617", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  topBarGlow: { position: "absolute", top: -42, right: -8, width: 180, height: 180, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.10)" },
  topMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  topMetaBadge: { minHeight: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.22)", flexDirection: "row", alignItems: "center", gap: 8 },
  topMetaBadgeText: { color: "#D8FFE5", fontSize: 11, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
  topMetaBadgeMuted: { minHeight: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 8 },
  topMetaBadgeMutedText: { color: "#C9E7FF", fontSize: 11, fontWeight: "800" },
  topHeroRow: { flexDirection: "row", gap: 14, alignItems: "stretch", justifyContent: "space-between", flexWrap: "wrap" },
  brandRow: { flexDirection: "row", gap: 14, alignItems: "center", flex: 1, minWidth: 260 },
  brandMark: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    shadowColor: "#22C55E",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  brandGlow: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  brandInset: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(4,14,24,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  brandHorizontalLine: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  brandVerticalLine: {
    position: "absolute",
    top: 8,
    bottom: 8,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  brandOrbit: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  brandCore: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6,20,31,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)"
  },
  brandNode: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(4,14,24,0.55)"
  },
  brandEyebrow: { color: "#8BCEFF", fontSize: 10, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 },
  brandTitle: { color: colors.text, fontSize: 26, fontWeight: "900" },
  brandSub: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 4, maxWidth: 540 },
  topHeroAside: { minWidth: 190, gap: 10, alignItems: "flex-end", justifyContent: "space-between" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  livePill: { alignSelf: "flex-start", minHeight: 42, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(239,68,68,0.16)", borderWidth: 1, borderColor: "rgba(239,68,68,0.32)", flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#EF4444", shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.live },
  livePillText: { color: "#FFE1E1", fontSize: 12, fontWeight: "900" },
  syncButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start" },
  syncButtonText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  topInsightRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  topInsightCard: { flex: 1, minWidth: 128, padding: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  topInsightLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  topInsightValue: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 6 },
  syncNote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  errorNote: { color: "#FCA5A5", fontSize: 12, lineHeight: 18 },
  homeStatusStack: { gap: 14 },
  homeStatusShelf: { gap: 10, padding: 14, borderRadius: radius.xl, borderWidth: 1 },
  homeStatusShelfLive: { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.20)" },
  homeStatusShelfUpcoming: { backgroundColor: "rgba(34,197,94,0.06)", borderColor: "rgba(34,197,94,0.18)" },
  homeStatusShelfFinished: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: colors.line },
  homeStatusShelfHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  homeStatusPill: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  homeStatusPillLive: { backgroundColor: "rgba(239,68,68,0.16)", borderColor: "rgba(239,68,68,0.28)" },
  homeStatusPillUpcoming: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.24)" },
  homeStatusPillFinished: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: colors.line },
  homeStatusPillText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  homeStatusShelfCount: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  clubSearchCard: { gap: 12, padding: 14, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  clubSearchHeader: { gap: 12 },
  clubSearchIdentity: { flexDirection: "row", alignItems: "center", gap: 12 },
  clubSearchBadge: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  clubSearchBadgeImage: { width: 34, height: 34 },
  clubSearchBadgeText: { color: colors.text, fontSize: 14, fontWeight: "900" },
  clubSearchCopy: { flex: 1, gap: 3 },
  clubSearchTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  clubSearchMeta: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  clubSearchChips: { gap: 8, paddingRight: 4 },
  clubSearchChip: { minHeight: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.10)", borderWidth: 1, borderColor: "rgba(56,189,248,0.20)", alignItems: "center", justifyContent: "center" },
  clubSearchChipText: { color: "#DBEAFE", fontSize: 11, fontWeight: "900" },
  clubSearchMatches: { gap: 10 },
  clubSearchChipStrong: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.16)", borderWidth: 1, borderColor: "rgba(34,197,94,0.30)", alignItems: "center", justifyContent: "center", shadowColor: "#22C55E", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  clubSearchChipStrongText: { color: "#D8FFE5", fontSize: 11, fontWeight: "900", letterSpacing: 0.2 },
  clubSearchSection: { gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: "rgba(8,19,34,0.54)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  clubSearchSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  clubSearchSectionTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  clubSearchSectionCount: { minWidth: 28, minHeight: 28, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  clubSearchSectionCountLive: { backgroundColor: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.28)" },
  clubSearchSectionCountUpcoming: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.24)" },
  clubSearchSectionCountFinished: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: colors.line },
  clubSearchSectionCountText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  compactResultRow: { minHeight: 64, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10 },
  compactResultMeta: { width: 94, gap: 3 },
  compactResultTime: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  compactResultCompetition: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  compactResultTeams: { flex: 1, gap: 4 },
  compactResultTeam: { color: colors.text, fontSize: 12, fontWeight: "800" },
  compactResultScoreWrap: { width: 92, alignItems: "flex-end", gap: 4 },
  compactResultScore: { color: colors.text, fontSize: 16, fontWeight: "900", textAlign: "right" },
  compactResultStatusPill: { minHeight: 22, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  compactResultStatusText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  globalTeamCard: { minHeight: 86, padding: 14, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  globalTeamIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  globalTeamBadge: { width: 54, height: 54, borderRadius: 17, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  globalTeamBadgeImage: { width: 40, height: 40 },
  globalTeamBadgeText: { color: colors.text, fontSize: 15, fontWeight: "900" },
  globalTeamTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  globalTeamName: { color: colors.text, fontSize: 16, fontWeight: "900", flexShrink: 1 },
  globalTeamLeague: { color: "#9FD9FF", fontSize: 12, fontWeight: "700", marginTop: 4 },
  globalTeamMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  globalTeamCategoryChip: { minHeight: 24, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.14)", borderWidth: 1, borderColor: "rgba(56,189,248,0.28)", alignItems: "center", justifyContent: "center" },
  globalTeamCategoryChipText: { color: "#DBEAFE", fontSize: 10, fontWeight: "900" },
  homeStreamTabs: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  homeStreamTab: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  homeStreamTabActive: { backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.26)" },
  homeStreamTabText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  homeStreamTabTextActive: { color: colors.text },
  competitionWorldBlock: { gap: 12, padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  competitionWorldTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  filterHeaderCard: { padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(56,189,248,0.08)", borderWidth: 1, borderColor: "rgba(56,189,248,0.18)" },
  filterHeaderTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  filterHeaderBody: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  teamCenterModal: { maxHeight: "92%" },
  teamCenterHeader: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  teamCenterBadge: { width: 70, height: 70, borderRadius: 24, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  teamCenterBadgeImage: { width: 52, height: 52 },
  teamCenterBadgeText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  teamCenterChipRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  teamCenterHeroChip: { minHeight: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.14)", borderWidth: 1, borderColor: "rgba(34,197,94,0.28)", alignItems: "center", justifyContent: "center" },
  teamCenterHeroChipText: { color: "#D8FFE5", fontSize: 11, fontWeight: "900" },
  teamCenterHeroChipMuted: { minHeight: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  teamCenterHeroChipMutedText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  teamCenterBlock: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  teamCenterBlockTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  teamCenterBlockSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: -2 },
  teamCenterSummaryGrid: { flexDirection: "row", gap: 10 },
  teamCenterSummaryCard: { flex: 1, minHeight: 82, padding: 12, borderRadius: radius.lg, backgroundColor: "rgba(8,19,34,0.58)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", gap: 6 },
  teamCenterSummaryValue: { color: colors.text, fontSize: 24, fontWeight: "900" },
  teamCenterSummaryLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  teamCenterMatchRow: { minHeight: 74, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 12 },
  teamCenterMatchMeta: { width: 112, gap: 4 },
  teamCenterMatchCompetition: { color: colors.text, fontSize: 12, fontWeight: "800" },
  teamCenterMatchDate: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  teamCenterMatchTeams: { flex: 1, gap: 4, alignItems: "center" },
  teamCenterMatchTeamSelf: { color: colors.text, fontSize: 13, fontWeight: "900", textAlign: "center" },
  teamCenterMatchVs: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  teamCenterMatchTeamOpponent: { color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "center" },
  teamCenterMatchRight: { width: 118, alignItems: "flex-end", gap: 6 },
  teamCenterMatchScore: { color: colors.text, fontSize: 16, fontWeight: "900" },
  resultsScopeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  resultsScopeChip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  resultsScopeChipActive: { backgroundColor: "rgba(236,72,153,0.16)", borderColor: "rgba(236,72,153,0.28)" },
  resultsScopeText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  resultsScopeTextActive: { color: colors.text },
  resultsPanelsWrap: { gap: 12 },
  resultsPanel: { gap: 10, padding: 14, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  resultsPanelTitle: { color: colors.text, fontSize: 14, fontWeight: "900", textTransform: "uppercase" },
  recentRow: { minHeight: 68, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10 },
  recentDateWrap: { width: 86, gap: 3 },
  recentDate: { color: colors.text, fontSize: 12, fontWeight: "800" },
  recentDateMeta: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  recentTeamsWrap: { flex: 1, gap: 4 },
  recentOpponent: { color: colors.text, fontSize: 13, fontWeight: "800" },
  recentVenue: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  recentScoreWrap: { width: 74, alignItems: "flex-end", gap: 6 },
  recentScore: { color: colors.text, fontSize: 16, fontWeight: "900" },
  recentResultPill: { minWidth: 28, minHeight: 24, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  recentResultPillWin: { backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.28)" },
  recentResultPillLoss: { backgroundColor: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.28)" },
  recentResultPillDraw: { backgroundColor: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.28)" },
  recentResultText: { fontSize: 10, fontWeight: "900" },
  calendarRow: { minHeight: 68, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10 },
  calendarRowMeta: { width: 82, gap: 4 },
  calendarRowDate: { color: colors.text, fontSize: 12, fontWeight: "800" },
  calendarRowTime: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  calendarRowMain: { flex: 1, gap: 4 },
  calendarRowOpponent: { color: colors.text, fontSize: 13, fontWeight: "800" },
  calendarRowCompetition: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  calendarRowVenuePill: { minHeight: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.12)", borderWidth: 1, borderColor: "rgba(56,189,248,0.24)", alignItems: "center", justifyContent: "center" },
  calendarRowVenueText: { color: "#DBEAFE", fontSize: 10, fontWeight: "900" },
  tableWrap: { gap: 8, padding: 14, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  tableHeaderRow: { minHeight: 34, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  tableHeaderCell: { width: 32, color: colors.muted, fontSize: 11, fontWeight: "900", textAlign: "center" },
  tableHeaderCellRank: { width: 24 },
  tableHeaderCellTeam: { flex: 1, textAlign: "left" },
  tableRow: { minHeight: 54, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  tableRowHighlight: { backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 14 },
  tableCell: { width: 32, color: colors.text, fontSize: 12, fontWeight: "800", textAlign: "center" },
  tableCellRank: { width: 24 },
  tableCellTeam: { flex: 1 },
  tableCellPoints: { color: "#D8FFE5", fontWeight: "900" },
  tableCellTeamWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  tableTeamBadge: { width: 28, height: 28, borderRadius: 10, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tableTeamBadgeImage: { width: 20, height: 20 },
  tableTeamBadgeText: { color: colors.text, fontSize: 9, fontWeight: "900" },
  tableTeamName: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "800" },
  search: { minHeight: 54, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  searchInline: { minHeight: 54, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  content: { gap: spacing.block, paddingBottom: 120 },
  hero: { borderRadius: radius.xl, padding: 22, gap: 14 },
  heroEmpty: { borderRadius: radius.xl, padding: 22, gap: 10, backgroundColor: "rgba(14,26,42,0.94)", borderWidth: 1, borderColor: colors.line },
  heroTag: { color: "#EAF7EF", fontSize: 12, fontWeight: "800" },
  heroVs: { color: colors.text, fontSize: 16, fontWeight: "800" },
  heroScore: { color: colors.text, fontSize: 34, fontWeight: "900", textAlign: "center" },
  heroMeta: { color: "#EBF4FF", fontSize: 13, textAlign: "center" },
  metrics: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, padding: 16, borderRadius: radius.lg, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  categoryPanel: { gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  livePulseWrap: { gap: 10 },
  pitchCard: { gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  pitch: { height: 132, borderRadius: 20, overflow: "hidden", backgroundColor: "#0E3B2B", flexDirection: "row" },
  pitchDominanceLeft: { backgroundColor: "rgba(34,197,94,0.16)" },
  pitchDominanceRight: { backgroundColor: "rgba(59,130,246,0.16)" },
  pitchOverlay: { ...StyleSheet.absoluteFillObject },
  pitchCenterLine: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, marginLeft: -1, backgroundColor: "rgba(255,255,255,0.22)" },
  pitchCircle: { position: "absolute", top: "50%", left: "50%", width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.26)" },
  pitchBoxLeft: { position: "absolute", top: 24, bottom: 24, left: 0, width: "18%", borderWidth: 2, borderLeftWidth: 0, borderColor: "rgba(255,255,255,0.24)" },
  pitchBoxRight: { position: "absolute", top: 24, bottom: 24, right: 0, width: "18%", borderWidth: 2, borderRightWidth: 0, borderColor: "rgba(255,255,255,0.24)" },
  pitchAttackLaneLeft: { position: "absolute", top: 18, bottom: 18, left: "11%", width: "26%", borderRadius: 999, backgroundColor: "#22C55E" },
  pitchAttackLaneRight: { position: "absolute", top: 18, bottom: 18, right: "11%", width: "26%", borderRadius: 999, backgroundColor: "#3B82F6" },
  pitchPossessionDot: { position: "absolute", top: "50%", width: 12, height: 12, marginTop: -6, marginLeft: -6, borderRadius: 999, backgroundColor: "#FFFFFF", shadowColor: "#FFFFFF", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  pitchLegend: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pitchLegendText: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: "700" },
  pitchLegendRight: { textAlign: "right" },
  livePulseStats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  livePulseStatCard: { width: "48%", minHeight: 58, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  livePulseStatValue: { minWidth: 26, color: colors.text, fontSize: 15, fontWeight: "900" },
  livePulseStatValueRight: { textAlign: "right" },
  livePulseStatLabel: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  livePulseEvent: { minHeight: 56, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000000", shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  livePulseEventIcon: { width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  livePulseEventTitle: { fontSize: 12, fontWeight: "900" },
  livePulseEventBody: { color: colors.text, fontSize: 12, marginTop: 2 },
  livePulseEventScore: { color: colors.text, fontSize: 16, fontWeight: "900" },
  teamScopeSwitcher: { flexDirection: "row", gap: 10 },
  teamScopeChip: { flex: 1, minHeight: 52, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10 },
  teamScopeChipActive: { backgroundColor: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.28)" },
  teamScopeBadge: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  teamScopeBadgeActive: { backgroundColor: "rgba(255,255,255,0.12)" },
  teamScopeBadgeImage: { width: 24, height: 24 },
  teamScopeBadgeText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  teamScopeText: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: "800" },
  teamScopeTextActive: { color: colors.text },
  analysisControlBar: { gap: 8 },
  sampleSelector: { flexDirection: "row", gap: 8 },
  sampleChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  sampleChipActive: { backgroundColor: "rgba(56,189,248,0.14)", borderColor: "rgba(56,189,248,0.26)" },
  sampleChipText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  sampleChipTextActive: { color: colors.text },
  resultPill: { minWidth: 30, minHeight: 24, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  resultPillText: { fontSize: 11, fontWeight: "900" },
  matchTrendStrip: { gap: 10, paddingRight: 4 },
  matchTrendCard: { width: 132, padding: 12, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, gap: 8 },
  trendOpponent: { color: colors.text, fontSize: 13, fontWeight: "800" },
  trendScore: { color: colors.text, fontSize: 20, fontWeight: "900" },
  analysisMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  analysisMetricCard: { width: "48%", padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(34,197,94,0.10)", borderWidth: 1, borderColor: "rgba(34,197,94,0.18)", gap: 6 },
  analysisMetricCardBlue: { backgroundColor: "rgba(56,189,248,0.10)", borderColor: "rgba(56,189,248,0.18)" },
  analysisMetricCardGold: { backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.18)" },
  analysisMetricLabel: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  analysisMetricValue: { color: colors.text, fontSize: 22, fontWeight: "900" },
  analysisMetricHint: { color: colors.text, fontSize: 12, lineHeight: 17, opacity: 0.88 },
  premiumWrap: { gap: 12 },
  premiumHero: { gap: 12, padding: 16, borderRadius: radius.xl, borderWidth: 1, borderColor: "rgba(56,189,248,0.18)" },
  premiumEyebrow: { color: "#7DD3FC", fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  premiumTitle: { color: colors.text, fontSize: 22, fontWeight: "900", marginTop: 4 },
  premiumScoreBadge: { minWidth: 84, minHeight: 84, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: colors.line },
  premiumScoreValue: { color: colors.text, fontSize: 28, fontWeight: "900" },
  premiumScoreTier: { color: "#D8FFE5", fontSize: 11, fontWeight: "900", marginTop: 2 },
  narrativeCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  narrativeIcon: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  narrativeTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  narrativeBody: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 4, opacity: 0.92 },
  insightPanel: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  insightHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  insightTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  insightBulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  insightDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6 },
  insightText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19, opacity: 0.92 },
  momentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  momentCard: { width: "31%", padding: 12, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, gap: 4 },
  momentBucket: { color: colors.text, fontSize: 13, fontWeight: "900" },
  momentLine: { color: colors.text, fontSize: 12, fontWeight: "700" },
  premiumMarkets: { gap: 10 },
  marketCard: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  marketCardStrong: { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.20)" },
  marketProbability: { color: colors.text, fontSize: 26, fontWeight: "900" },
  marketMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  marketMetaChip: { minHeight: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  marketMetaChipText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  marketConfidenceBadge: { minHeight: 28, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  marketConfidenceText: { fontSize: 11, fontWeight: "900" },
  ticketCard: { gap: 12, padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(56,189,248,0.10)", borderWidth: 1, borderColor: "rgba(56,189,248,0.20)" },
  ticketBadge: { minWidth: 78, minHeight: 56, paddingHorizontal: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  ticketBadgeText: { color: colors.text, fontSize: 22, fontWeight: "900" },
  ticketPickList: { gap: 10 },
  ticketPickRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  ticketPickIndex: { width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.16)", borderWidth: 1, borderColor: "rgba(34,197,94,0.26)", alignItems: "center", justifyContent: "center" },
  ticketPickIndexText: { color: "#D8FFE5", fontSize: 12, fontWeight: "900" },
  premiumUpsellCard: { gap: 8, padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(245,158,11,0.10)", borderWidth: 1, borderColor: "rgba(245,158,11,0.22)" },
  premiumUpsellEyebrow: { color: "#FDE68A", fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  premiumUpsellTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  premiumActionColumn: { gap: 10, marginTop: 6 },
  teamAnalysisWrap: { gap: 12 },
  teamAnalysisHero: { gap: 10, padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(8,19,34,0.92)", borderWidth: 1, borderColor: colors.line },
  teamAnalysisHeroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  teamAnalysisNameRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  teamAnalysisBadge: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  teamAnalysisBadgeImage: { width: 34, height: 34 },
  teamAnalysisBadgeText: { color: colors.text, fontSize: 15, fontWeight: "900" },
  teamAnalysisName: { color: colors.text, fontSize: 20, fontWeight: "900" },
  teamAnalysisSummary: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: "700" },
  teamAnalysisFootnote: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  teamWindowTag: { minHeight: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.14)", borderWidth: 1, borderColor: "rgba(56,189,248,0.24)", alignItems: "center", justifyContent: "center" },
  teamWindowTagText: { color: "#DBEAFE", fontSize: 11, fontWeight: "900" },
  teamTraitsWrap: { gap: 12 },
  traitsHero: { gap: 10, padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(8,19,34,0.92)", borderWidth: 1, borderColor: colors.line },
  traitsEyebrow: { color: "#FDE68A", fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 },
  traitsSectionCard: { gap: 12, padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  traitsSectionTitle: { color: colors.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  traitsColumnsGrid: { gap: 12 },
  traitsColumnCard: { gap: 10, flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(8,19,34,0.62)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  traitsColumnHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  traitsColumnLabel: { color: colors.text, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  traitsScopeDot: { width: 10, height: 10, borderRadius: 999 },
  traitsBulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  traitsLineWrap: { width: 16, alignItems: "center" },
  traitsBulletDot: { width: 10, height: 10, borderRadius: 999, borderWidth: 2, backgroundColor: "#0F172A", marginTop: 4 },
  traitsBulletLine: { width: 2, flex: 1, minHeight: 34, marginTop: 2, borderRadius: 999 },
  traitsBulletText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20, opacity: 0.94 },
  traitsPremiumBadge: { minHeight: 24, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.24)", flexDirection: "row", alignItems: "center", gap: 6 },
  traitsPremiumBadgeText: { color: "#FDE68A", fontSize: 10, fontWeight: "900" },
  traitsLockedCard: { minHeight: 94, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.18)", flexDirection: "row", alignItems: "flex-start", gap: 12 },
  traitsLockedTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  traitsLockedBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  teamPlayersWrap: { gap: 12 },
  statusTinyDot: { width: 10, height: 10, borderRadius: 999, marginTop: 4 },
  rosterGroup: { gap: 10 },
  rosterGroupTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  rosterPlayerCard: { minHeight: 70, padding: 12, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rosterPlayerMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  rosterPlayerAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#12263A", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  rosterPlayerAvatarImage: { width: 44, height: 44 },
  rosterPlayerAvatarText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  rosterPlayerName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  rosterStatusBadge: { minHeight: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(100,116,139,0.16)", borderWidth: 1, borderColor: "rgba(100,116,139,0.28)", alignItems: "center", justifyContent: "center" },
  rosterStatusBadgeActive: { backgroundColor: "rgba(34,197,94,0.16)", borderColor: "rgba(34,197,94,0.28)" },
  rosterStatusText: { color: "#CBD5E1", fontSize: 11, fontWeight: "900" },
  rosterStatusTextActive: { color: "#D8FFE5" },
  section: { borderRadius: radius.xl, padding: 18, backgroundColor: "rgba(14,26,42,0.94)", borderWidth: 1, borderColor: colors.line, gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: "900" },
  sectionTitleSmall: { color: colors.text, fontSize: 17, fontWeight: "900" },
  sectionBody: { gap: 12 },
  card: { borderRadius: radius.lg, padding: 16, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, gap: 14, overflow: "hidden" },
  liveCard: { backgroundColor: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.34)", borderLeftWidth: 4, borderLeftColor: "#FF4D5E", shadowColor: "#EF4444", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  livePulseBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: "#FF4D5E" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  cardMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  matchCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  matchCardLeagueWrap: { flex: 1, gap: 6 },
  matchMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  matchMetaPill: { minHeight: 24, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 6 },
  matchMetaPillText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  matchStageText: { color: colors.muted, fontSize: 11, fontWeight: "700", flexShrink: 1 },
  categoryBadge: { minHeight: 24, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.24)", alignItems: "center", justifyContent: "center" },
  categoryBadgeText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  iconWrap: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  matchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  matchBoard: { minHeight: 92, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: "rgba(8,19,34,0.52)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center", gap: 12 },
  team: { flex: 1, alignItems: "center", gap: 10 },
  teamLeft: { alignItems: "flex-start" },
  teamRight: { alignItems: "flex-end" },
  teamBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: "#000000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  teamBadgeStrong: { width: 64, height: 64, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)" },
  teamBadgeImage: { width: 38, height: 38 },
  teamBadgeImageStrong: { width: 44, height: 44 },
  teamBadgeText: { color: colors.text, fontSize: 15, fontWeight: "900" },
  teamBadgeTextStrong: { fontSize: 18 },
  teamName: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: "800", textAlign: "center" },
  teamNameLeft: { textAlign: "left" },
  teamNameRight: { textAlign: "right" },
  teamNameStrong: { fontSize: 15 },
  scoreWrap: { minWidth: 96, alignItems: "center", justifyContent: "center", gap: 2 },
  scoreWrapUpcoming: { minWidth: 104 },
  scoreWrapResult: { minWidth: 96 },
  scoreDivider: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  scoreText: { color: colors.text, fontSize: 27, fontWeight: "900" },
  scoreTextUpcoming: { fontSize: 24 },
  scoreSubtext: { color: colors.muted, fontSize: 10, fontWeight: "700", textAlign: "center" },
  statusBadge: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  matchCardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  matchStatusCluster: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  liveMinuteBadge: { minHeight: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(239,68,68,0.16)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)", alignItems: "center", justifyContent: "center" },
  liveMinuteText: { color: "#FFE1E1", fontSize: 10, fontWeight: "900" },
  matchLocationWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  channel: { color: colors.muted, fontSize: 12, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  filterWrap: { gap: 8 },
  filterLabel: { color: colors.text, fontSize: 13, fontWeight: "800" },
  chips: { gap: 10, paddingRight: 4 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.24)" },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.text },
  group: { gap: 12 },
  groupDate: { color: colors.text, fontSize: 16, fontWeight: "900" },
  competitionBlock: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  competitionTitle: { color: colors.cyan, fontSize: 14, fontWeight: "800" },
  alert: { padding: 16, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  alertBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  inlineAdShell: { gap: 8 },
  inlineAdLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  inlineAdFrame: { alignItems: "center", justifyContent: "center", borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: colors.line, paddingVertical: 8, overflow: "hidden" },
  future: { padding: 16, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  playersLoading: { minHeight: 72, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  playerCard: { minHeight: 88, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 12 },
  playerCardCompact: { minHeight: 78 },
  playerMedia: { width: 58, alignItems: "center", justifyContent: "center" },
  playerThumb: { width: 54, height: 54, borderRadius: 16, backgroundColor: "#12263A" },
  playerThumbFallback: { width: 54, height: 54, borderRadius: 16, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  playerThumbFallbackText: { color: colors.text, fontSize: 15, fontWeight: "900" },
  playerProfileHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  playerProfileImage: { width: 96, height: 96, borderRadius: 26, backgroundColor: "#12263A" },
  playerProfileFallback: { width: 96, height: 96, borderRadius: 26, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  playerProfileFallbackText: { color: colors.text, fontSize: 24, fontWeight: "900" },
  playerProfileName: { color: colors.text, fontSize: 22, fontWeight: "900" },
  inputLabel: { color: colors.text, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 52, borderRadius: 16, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, color: colors.text, marginTop: 8 },
  readonlyField: { minHeight: 52, borderRadius: 16, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, justifyContent: "center", marginTop: 8 },
  readonlyFieldText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  profileHero: { gap: 16, padding: 18, borderRadius: radius.xl, borderWidth: 1, borderColor: "rgba(34,197,94,0.22)" },
  profileHeroTop: { flexDirection: "row", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", flex: 1, minWidth: 260 },
  profileHeroEyebrow: { color: "#9FD9FF", fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  profileHeroName: { color: colors.text, fontSize: 22, fontWeight: "900" },
  profileHeroStatus: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.24)", flexDirection: "row", alignItems: "center", gap: 8 },
  profileHeroStatusText: { color: "#D8FFE5", fontSize: 11, fontWeight: "900" },
  profileHeroStats: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  profileHeroStatCard: { flex: 1, minWidth: 92, padding: 12, borderRadius: 18, backgroundColor: "rgba(4,14,24,0.24)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  profileHeroStatValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  profileHeroStatLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 4 },
  premiumAccountCard: { gap: 8, padding: 16, borderRadius: radius.lg, backgroundColor: "rgba(34,197,94,0.08)", borderWidth: 1, borderColor: "rgba(34,197,94,0.18)" },
  premiumAccountCardActive: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.26)" },
  premiumAccountCardPending: { backgroundColor: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.26)" },
  premiumAccountEyebrow: { color: "#86EFAC", fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  premiumAccountTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
  premiumStatusBadgeActive: { backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.26)" },
  premiumStatusBadgePending: { backgroundColor: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.26)" },
  premiumStatusBadgeFree: { backgroundColor: "rgba(100,116,139,0.16)", borderColor: "rgba(100,116,139,0.28)" },
  premiumStatusTextActive: { color: "#D8FFE5" },
  premiumStatusTextPending: { color: "#FDE68A" },
  premiumStatusTextFree: { color: "#CBD5E1" },
  profileBadge: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: colors.line },
  profileBadgeText: { color: colors.text, fontSize: 16, fontWeight: "900" },
  profileEmail: { color: "#9FD9FF", fontSize: 13, fontWeight: "700", marginTop: 2 },
  profilePanel: { gap: 12, padding: 18, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  profilePanelTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  profilePanelBody: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  authHero: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16, borderRadius: radius.xl, borderWidth: 1, borderColor: "rgba(34,197,94,0.22)" },
  authHeroIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  authHeroTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  authHeroBody: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 4, opacity: 0.9 },
  authFeatureRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  authFeatureCard: { flex: 1, minWidth: 180, padding: 14, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, gap: 8 },
  authFeatureTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
  authFeatureBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  authModeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  authModeButton: { width: "48%", minHeight: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  authModeButtonActive: { backgroundColor: "rgba(34,197,94,0.16)", borderColor: "rgba(34,197,94,0.32)", shadowColor: "#22C55E", shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  authModeText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  authModeTextActive: { color: colors.text },
  authFeedbackError: { color: "#FCA5A5", fontSize: 13, fontWeight: "700" },
  authFeedbackSuccess: { color: "#86EFAC", fontSize: 13, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 12 },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, flex: 1, shadowColor: "#22C55E", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  primaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  secondaryButtonDisabled: { opacity: 0.55 },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  authFooterRow: { gap: 10, marginTop: 2 },
  authServerPill: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  authServerPillText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  authFooterHint: { color: colors.muted, fontSize: 12 },
  lockedPanel: { padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.22)" },
  lockedPanelHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  lockedPanelIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.2)", alignItems: "center", justifyContent: "center" },
  setting: { flexDirection: "row", alignItems: "center", gap: 14 },
  empty: { padding: 16, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  tabs: { position: "absolute", left: spacing.screen, right: spacing.screen, bottom: 18, borderRadius: 28, padding: 10, backgroundColor: "rgba(7,17,31,0.98)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  tab: { flex: 1, minHeight: 62, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 6, position: "relative", overflow: "hidden" },
  tabIconShell: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  tabIconShellActive: { backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.24)" },
  tabActive: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  tabActiveGlow: { position: "absolute", top: 0, width: 36, height: 3, borderRadius: 999, backgroundColor: "#22C55E" },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
  tabTextActive: { color: colors.text },
  modalBack: { flex: 1, backgroundColor: "rgba(4,9,16,0.78)", justifyContent: "flex-end", padding: 16 },
  modal: { maxHeight: "88%", borderRadius: radius.xl, backgroundColor: "#0B1727", borderWidth: 1, borderColor: colors.line },
  modalContent: { padding: 20, gap: 16 },
  modalTitle: { color: colors.text, fontSize: 24, fontWeight: "900" },
  matchModalEyebrow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  matchModalBreadcrumb: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.2, flexShrink: 1 },
  matchHeroCard: { gap: 16, padding: 18, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line, shadowColor: "#000000", shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  matchHeroCompetition: { color: colors.text, fontSize: 22, fontWeight: "900" },
  matchHeroStage: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  matchHeroTimePill: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(56,189,248,0.12)", borderWidth: 1, borderColor: "rgba(56,189,248,0.24)", flexDirection: "row", alignItems: "center", gap: 8 },
  matchHeroTimeText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  matchHeroTeams: { flexDirection: "row", alignItems: "center", gap: 14 },
  matchHeroScoreWrap: { minWidth: 128, alignItems: "center", justifyContent: "center", gap: 6 },
  matchHeroScore: { color: colors.text, fontSize: 34, fontWeight: "900" },
  matchHeroScoreMeta: { color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  matchHeroFooter: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  matchHeroFooterPill: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 8 },
  matchHeroFooterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  info: { width: "48%", padding: 14, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  infoValue: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "700", marginTop: 8 },
  statsSection: { gap: 12 },
  statsTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  detailTabs: { gap: 10, paddingRight: 4, paddingVertical: 2 },
  detailTab: { minHeight: 42, paddingHorizontal: 16, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", shadowColor: "#000000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  detailTabActive: { backgroundColor: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.28)" },
  detailTabText: { color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.2 },
  detailTabTextActive: { color: colors.text },
  h2hQuickCard: { gap: 12, padding: 16, borderRadius: radius.xl, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  h2hQuickTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  h2hQuickMeta: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  h2hQuickScoreboard: { flexDirection: "row", alignItems: "center", gap: 10 },
  h2hQuickStat: { flex: 1, minHeight: 72, padding: 12, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", gap: 6 },
  h2hQuickValue: { color: colors.text, fontSize: 24, fontWeight: "900" },
  h2hQuickLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "center" },
  h2hQuickDivider: { minWidth: 92, alignItems: "center", justifyContent: "center" },
  h2hQuickDividerText: { color: colors.muted, fontSize: 12, fontWeight: "900", textAlign: "center" },
  h2hQuickHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  summaryValue: { minWidth: 46, color: colors.text, fontSize: 16, fontWeight: "900" },
  summaryValueRight: { textAlign: "right" },
  summaryLabel: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: "700", textAlign: "center" },
  statTeamsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statTeamName: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "800" },
  statTeamCenter: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  statTeamNameRight: { textAlign: "right" },
  statsLoading: { padding: 16, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  statCard: { gap: 8, padding: 14, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  statRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statValue: { minWidth: 44, color: colors.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  statLabel: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: "700", textAlign: "center" },
  statBars: { flexDirection: "row", alignItems: "center", minHeight: 10 },
  statBarHome: { minHeight: 10, borderRadius: 999, backgroundColor: "#22C55E" },
  statBarGap: { width: 8 },
  statBarAway: { minHeight: 10, borderRadius: 999, backgroundColor: "#3B82F6" },
  timelineCard: { gap: 6, padding: 14, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  timelineHome: { borderLeftWidth: 3, borderLeftColor: "#22C55E" },
  timelineAway: { borderLeftWidth: 3, borderLeftColor: "#3B82F6" },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  timelineMinute: { color: colors.text, fontSize: 14, fontWeight: "900" },
  timelineType: { color: colors.cyan, fontSize: 12, fontWeight: "800" },
  timelinePlayer: { color: colors.text, fontSize: 15, fontWeight: "800" },
  timelineAssist: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  timelineMeta: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  timelineComment: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  broadcastCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  broadcastTextWrap: { flex: 1 },
  broadcastLogo: { width: 72, height: 32 },
  trackerCard: { minHeight: 640, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#07111F", borderWidth: 1, borderColor: colors.line },
  trackerWebview: { minHeight: 640, backgroundColor: "#07111F" },
  trackerEmpty: { gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  favoriteAction: { minHeight: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  favoriteActionText: { color: colors.text, fontWeight: "800" }
});

