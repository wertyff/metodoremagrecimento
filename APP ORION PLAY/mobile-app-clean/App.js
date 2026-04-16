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
import {
  AdEventType,
  BannerAd,
  RewardedAdEventType
} from "react-native-google-mobile-ads";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { colors, radius, spacing } from "./src/theme";
import {
  createPremiumRewardedAd,
  getBannerUnitId,
  initializeAds,
  INLINE_BANNER_SIZE,
  PREMIUM_AD_UNLOCK_MS
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
import { describeAnalysisWindow, fetchTeamAnalysis } from "./src/services/teamInsights";
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
  ["analysis", "Analise"],
  ["premium", "Premium"],
  ["traits", "Caracteristicas"],
  ["players", "Jogadores"],
  ["stats", "Estatisticas"],
  ["events", "Eventos"],
  ["tv", "Transmissao"],
  ["lineups", "Escalacoes"],
  ["tracker", "Tracker"]
];

const defaultSettings = { alerts: true, liveGoals: true, kickoff: true, dataSaver: false };
const matchCategoryGroups = [
  { key: "professional", label: "Profissional", categories: ["professional"] },
  { key: "base", label: "Base", categories: ["u20", "u17"] },
  { key: "womens", label: "Feminino", categories: ["womens"] },
  { key: "national", label: "Seleções", categories: ["national"] }
];

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

function AppShell() {
  const fallbackBundle = useMemo(() => getFallbackBundle(), []);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [profileName, setProfileName] = useState("Visitante");
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerCategoryFilter, setPlayerCategoryFilter] = useState("all");
  const [playerResults, setPlayerResults] = useState([]);
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
      RewardedAdEventType.LOADED,
      () => {
        setRewardedReady(true);
        setRewardedLoading(false);
      }
    );
    const unsubscribeReward = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      async () => {
        const unlockUntil = Date.now() + PREMIUM_AD_UNLOCK_MS;
        setPremiumUnlockUntil(unlockUntil);
        setPremiumMessage(`Analise PRO liberada por anuncio ate ${formatDateTime(unlockUntil)}.`);
        setPremiumError("");
        await AsyncStorage.setItem(PREMIUM_UNLOCK_STORAGE_KEY, String(unlockUntil));
      }
    );
    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setRewardedReady(false);
      setRewardedLoading(true);
      rewarded.load();
    });
    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
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

  const premiumSubscription = authUser?.premium || null;
  const premiumAccess =
    premiumSubscription?.accessLevel === "premium" ||
    premiumUnlockUntil > Date.now();

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

  async function syncMatches(silent = false) {
    if (!silent) {
      setLoadingMatches(true);
    }

    try {
      const liveBundle = await fetchLiveMatchesWindow();
      setMatchBundle(liveBundle);
      setSyncError("");
    } catch (error) {
      setMatchBundle((current) => (current.matches.length ? current : fallbackBundle));
      setSyncError("Sem conexao com a agenda online. Mostrando base local.");
    } finally {
      setLoadingMatches(false);
    }
  }

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const liveBundle = await fetchLiveMatchesWindow();
        if (!active) return;
        setMatchBundle(liveBundle);
        setSyncError("");
      } catch (error) {
        if (!active) return;
        setMatchBundle(fallbackBundle);
        setSyncError("Sem conexao com a agenda online. Mostrando base local.");
      } finally {
        if (active) {
          setLoadingMatches(false);
        }
      }
    };

    load();
    const interval = setInterval(() => {
      if (!active) return;
      syncMatches(true);
    }, 180000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fallbackBundle]);

  const allMatches = matchBundle.matches;
  const todayKey = matchBundle.todayKey || getTodayKey();
  const featured = allMatches.find((item) => item.id === matchBundle.featuredMatchId) || allMatches[0];
  const categories = ["all", ...MATCH_CATEGORY_ORDER];
  const competitions = ["all", ...new Set(allMatches.map((item) => item.competition))];
  const dates = ["all", ...new Set(allMatches.map((item) => item.date))];
  const teams = ["all", ...new Set(allMatches.flatMap((item) => [item.homeTeam, item.awayTeam]))];

  const filtered = useMemo(() => {
    return allMatches.filter((match) => {
      const matchesCategory = categoryFilter === "all" || match.category === categoryFilter;
      const matchesCompetition = competitionFilter === "all" || match.competition === competitionFilter;
      const matchesDate = dateFilter === "all" || match.date === dateFilter;
      const matchesTeam = teamFilter === "all" || match.homeTeam === teamFilter || match.awayTeam === teamFilter;
      const matchesSearch = !search.trim() || normalize(
        `${match.homeTeam} ${match.awayTeam} ${match.competition} ${match.stage} ${match.categoryLabel || ""}`
      ).includes(normalize(search));
      return matchesCategory && matchesCompetition && matchesDate && matchesTeam && matchesSearch;
    });
  }, [allMatches, categoryFilter, competitionFilter, dateFilter, search, teamFilter]);

  const liveMatches = allMatches.filter((item) => item.status === "live");
  const todayMatches = allMatches.filter((item) => item.date === todayKey);
  const professionalMatches = todayMatches.filter((item) => item.category === "professional");
  const baseMatches = todayMatches.filter((item) => ["u20", "u17"].includes(item.category));
  const womensMatches = todayMatches.filter((item) => item.category === "womens");
  const nationalMatches = todayMatches.filter((item) => item.category === "national");
  const nextMatches = allMatches.filter((item) => item.date >= todayKey && item.status === "upcoming").slice(0, 8);
  const finishedMatches = allMatches.filter((item) => item.date === todayKey && item.status === "finished").slice(0, 8);
  const grouped = groupMatches(filtered);
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
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{match.competition}</Text>
              <View style={[styles.categoryBadge, { backgroundColor: matchTone.badgeBg, borderColor: matchTone.badgeBorder }]}>
                <Text style={[styles.categoryBadgeText, { color: matchTone.badgeText }]}>{match.categoryLabel || "Profissional"}</Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>{dateLabel(match.date)} - {match.kickoff} - {match.stage}</Text>
          </View>
          <Pressable style={styles.iconWrap} onPress={() => toggleFavorite(match.id)}>
            <Ionicons
              name={favorites.includes(match.id) ? "bookmark" : "bookmark-outline"}
              size={18}
              color={favorites.includes(match.id) ? colors.gold : colors.text}
            />
          </Pressable>
        </View>

        <View style={styles.matchRow}>
          <Team name={match.homeTeam} badgeUrl={match.homeBadge} />
          <View style={styles.scoreWrap}>
            <Text style={styles.scoreText}>
              {match.status === "upcoming" ? match.kickoff : `${match.homeScore ?? 0} x ${match.awayScore ?? 0}`}
            </Text>
          </View>
          <Team name={match.awayTeam} badgeUrl={match.awayBadge} />
        </View>

        <View style={styles.rowBetween}>
          <View style={[styles.statusBadge, { backgroundColor: currentTone.bg, borderColor: currentTone.border }]}>
            <Text style={[styles.statusText, { color: currentTone.text }]}>
              {currentTone.label}{match.status === "live" && match.minute ? ` ${match.minute}` : ""}
            </Text>
          </View>
          <Text style={styles.channel}>{match.country || match.venue || match.sourceLabel}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="light" />
        <LinearGradient colors={["#07111F", "#081523", "#050B14"]} style={StyleSheet.absoluteFillObject} />

        <View style={styles.container}>
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <LinearGradient colors={["#22C55E", "#0F766E"]} style={styles.brandIcon}>
                <Ionicons name="football" size={22} color={colors.text} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.brandTitle}>Match Intelligence</Text>
                <Text style={styles.brandSub}>
                  {matchBundle.source === "live"
                    ? "Jogos reais do dia, atualizados varias vezes ao longo do dia."
                    : "Agenda offline ativa. Atualize quando voltar a internet."}
                </Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>
                  {matchBundle.source === "live" ? `${liveMatches.length} ao vivo` : "modo offline"}
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

            <Text style={styles.syncNote}>
              {matchBundle.source === "live"
                ? `Ultima atualizacao ${syncLabel(matchBundle.syncedAt)}`
                : "Sem internet no momento. Base local em uso."}
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
                {featured ? (
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
                    <Text style={styles.sectionTitle}>Sem jogos no momento</Text>
                    <Text style={styles.alertBody}>Assim que a agenda do dia chegar, ela aparece aqui.</Text>
                  </View>
                )}

                <View style={styles.metrics}>
                  <Metric label="Ao vivo" value={liveMatches.length} />
                  <Metric label="Hoje" value={todayMatches.length} />
                  <Metric label="Competicoes" value={competitions.length - 1} />
                </View>

                {adsReady && <InlineAdBanner placement="home" />}

                <Section title="Profissional">
                  {professionalMatches.length ? professionalMatches.map((item) => renderMatch(item)) : <Empty title="Sem jogos profissionais" body="Nenhum jogo profissional encontrado para hoje." />}
                </Section>

                <Section title="Base">
                  {baseMatches.length ? baseMatches.map((item) => renderMatch(item)) : <Empty title="Sem jogos de base" body="Nenhum jogo de base encontrado para hoje." />}
                </Section>

                <Section title="Feminino">
                  {womensMatches.length ? womensMatches.map((item) => renderMatch(item)) : <Empty title="Sem jogos femininos" body="Nenhum jogo feminino encontrado para hoje." />}
                </Section>

                <Section title="Seleções">
                  {nationalMatches.length ? nationalMatches.map((item) => renderMatch(item)) : <Empty title="Sem jogos de seleções" body="Nenhum jogo de seleções encontrado para hoje." />}
                </Section>

                <Section title="Jogos ao vivo">
                  {liveMatches.length ? liveMatches.map((item) => renderMatch(item, true)) : <Empty title="Nada ao vivo" body="Assim que uma partida iniciar ela aparece aqui." />}
                </Section>

                <Section title="Proximos jogos">
                  {nextMatches.length ? nextMatches.map((item) => renderMatch(item)) : <Empty title="Sem proximos jogos" body="Nao ha partidas agendadas na janela atual." />}
                </Section>
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
                        <Text style={styles.alertBody}>Navegue pelas partidas dessa categoria e acompanhe o dia por tipo de competição.</Text>
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
                  <FilterRow label="Categoria" values={categories} selected={categoryFilter} onSelect={setCategoryFilter} format={(value) => value === "all" ? "Todas" : MATCH_CATEGORY_LABELS[value] || value} />
                  <FilterRow label="Campeonato" values={competitions} selected={competitionFilter} onSelect={setCompetitionFilter} format={(value) => value === "all" ? "Todos" : value} />
                  <FilterRow label="Data" values={dates} selected={dateFilter} onSelect={setDateFilter} format={(value) => value === "all" ? "Todas" : dateLabel(value)} />
                  <FilterRow label="Time" values={teams} selected={teamFilter} onSelect={setTeamFilter} format={(value) => value === "all" ? "Todos" : value} />
                </Section>

                {adsReady && <InlineAdBanner placement="games" />}

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
                  <Future title="Feminino" body="Filtro pronto para ativar assim que a fonte entregar a identificação do elenco." />
                  <Future title="Seleções" body="Base preparada para atletas ligados a seleções nacionais." />
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
                      <View style={styles.profileCard}>
                        <View style={styles.profileBadge}>
                          <Text style={styles.profileBadgeText}>{badge(authUser.name || authUser.email)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{authUser.name}</Text>
                          <Text style={styles.profileEmail}>{authUser.email}</Text>
                          <Text style={styles.cardMeta}>Conta ativa neste aparelho.</Text>
                        </View>
                      </View>

                      <PremiumSubscriptionCard
                        subscription={premiumSubscription}
                        busy={premiumBusy}
                        onStart={handleStartPremium}
                        onRefresh={handleRefreshPremium}
                      />

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
                    </>
                  ) : (
                    <>
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

                      <Text style={styles.cardMeta}>
                        Conta real conectada ao servidor em {AUTH_API_BASE_URL.replace(/^https?:\/\//, "")}.
                      </Text>
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
                      <Text style={styles.cardTitle}>Entre para liberar seu perfil</Text>
                      <Text style={styles.alertBody}>
                        Depois do login, o app salva sua sessao, habilita o perfil e mantem suas preferencias ligadas a conta local.
                      </Text>
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
                  <Ionicons name={active ? activeIcon : icon} size={20} color={active ? colors.text : colors.muted} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
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
        <PlayerProfileModal playerId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Team({ name, badgeUrl, strong }) {
  return (
    <View style={styles.team}>
      <View style={[styles.teamBadge, strong && styles.teamBadgeStrong]}>
        {badgeUrl ? (
          <Image source={{ uri: badgeUrl }} style={[styles.teamBadgeImage, strong && styles.teamBadgeImageStrong]} resizeMode="contain" />
        ) : (
          <Text style={[styles.teamBadgeText, strong && styles.teamBadgeTextStrong]}>{badge(name)}</Text>
        )}
      </View>
      <Text style={[styles.teamName, strong && styles.teamNameStrong]} numberOfLines={2}>{name}</Text>
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
  const unitId = getBannerUnitId(placement);

  return (
    <View style={styles.inlineAdShell}>
      <Text style={styles.inlineAdLabel}>Publicidade</Text>
      <View style={styles.inlineAdFrame}>
        <BannerAd
          unitId={unitId}
          size={INLINE_BANNER_SIZE}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
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
        {subscription.planTitle} • {formatPremiumFrequency(subscription)}
      </Text>
      <Text style={styles.cardMeta}>
        {active
          ? `Premium ativo${subscription.nextBillingDate ? ` • proxima cobranca ${formatDateTime(subscription.nextBillingDate)}` : ""}`
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
        <Text style={styles.alertBody}>{player.position} • {player.nationality}{player.age ? ` • ${player.age} anos` : ""}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
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
              {latestEvent.player} • {latestEvent.team}
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
          <Text style={styles.cardMeta}>{item.venue} • {item.competition}</Text>
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
        <AnalysisMetricCard label="Forma" value={`${analysis.sample.wins}-${analysis.sample.draws}-${analysis.sample.losses}`} hint={analysis.metadata.formLine.replaceAll(" • ", " / ")} />
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

function TeamTraitsPanel({ analysis }) {
  return (
    <View style={styles.teamTraitsWrap}>
      <InsightList title="Pontos fortes" icon="arrow-up-circle-outline" accent="#22C55E" items={analysis.strengths} empty="Nenhum ponto forte estatisticamente forte apareceu na amostra atual." />
      <InsightList title="Pontos fracos" icon="alert-circle-outline" accent="#EF4444" items={analysis.weaknesses} empty="A amostra atual nao mostrou fragilidades recorrentes fortes." />
      <InsightList title="Estilo de jogo" icon="git-network-outline" accent="#38BDF8" items={analysis.styleNotes} empty="Sem base suficiente para definir o estilo." />
      <InsightList title="Momentos de atencao" icon="time-outline" accent="#F59E0B" items={analysis.attention} empty="Sem base temporal suficiente para destacar momentos." />
    </View>
  );
}

function marketConfidenceTone(confidence) {
  if (confidence === "Alta") return { bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.26)", text: "#D8FFE5" };
  if (confidence === "Media") return { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.26)", text: "#FDE68A" };
  return { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.26)", text: "#FFE1E1" };
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
                      {player.position || "Posicao nao informada"} • {player.nationality || "Sem nacionalidade"}
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
          Você já conseguiu o pacote do LMT. Para abrir o mapa correto em cada partida, agora só falta ligar o jogo do app ao `matchId` do Betradar.
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
  const [analysisSide, setAnalysisSide] = useState("home");
  const [sampleSize, setSampleSize] = useState(10);
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
  const [rosterCache, setRosterCache] = useState({});
  const [rosterLoadingKey, setRosterLoadingKey] = useState("");
  const [rosterError, setRosterError] = useState("");

  useEffect(() => {
    let active = true;

    if (!match?.id) {
      setDetailTab("summary");
      setAnalysisSide("home");
      setSampleSize(10);
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
      setRosterCache({});
      setRosterLoadingKey("");
      setRosterError("");
      return () => {
        active = false;
      };
    }

    async function loadMatchDetails(reset = false) {
      if (reset) {
        setDetailTab("summary");
        setAnalysisSide("home");
        setSampleSize(10);
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
        setRosterCache({});
        setRosterLoadingKey("");
        setRosterError("");
      }

      setLoadingStats(true);
      setLoadingExtras(true);

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
      } finally {
        if (active) {
          setLoadingStats(false);
        }
      }

      const results = await Promise.allSettled([
        fetchMatchTimeline(match.id),
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

    const intervalMs = match.status === "live" ? 15000 : 60000;
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
  const rosterKey = match ? `${match.id}-${analysisSide}` : "";
  const analysisBundle = analysisCache[analysisKey] || null;
  const teamRoster = rosterCache[rosterKey] || [];
  const currentTone = match ? tone(match.status) : tone("upcoming");

  useEffect(() => {
    let active = true;

    if (!match?.id || !selectedTeam || !["analysis", "premium", "traits"].includes(detailTab)) {
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
        const teamsFound = await searchTeams(selectedTeam.name);
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

  if (!match) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.modalBack}>
        <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rowBetween}>
            <View style={[styles.statusBadge, { backgroundColor: currentTone.bg, borderColor: currentTone.border }]}>
              <Text style={[styles.statusText, { color: currentTone.text }]}>
                {currentTone.label}{match.status === "live" && match.minute ? ` ${match.minute}` : ""}
              </Text>
            </View>
            <Pressable style={styles.iconWrap} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.modalTitle}>{match.competition}</Text>

          <View style={styles.matchRow}>
            <Team name={match.homeTeam} badgeUrl={match.homeBadge} strong />
            <View style={styles.scoreWrap}>
              <Text style={styles.scoreText}>
                {match.status === "upcoming" ? "--" : `${match.homeScore ?? 0} x ${match.awayScore ?? 0}`}
              </Text>
              <Text style={styles.cardMeta}>{match.kickoff}</Text>
            </View>
            <Team name={match.awayTeam} badgeUrl={match.awayBadge} strong />
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

          {["analysis", "premium", "traits", "players"].includes(detailTab) ? (
            <>
              <TeamScopeSwitcher match={match} activeSide={analysisSide} onChange={setAnalysisSide} />
              {(detailTab === "analysis" || detailTab === "premium" || detailTab === "traits") ? (
                <View style={styles.analysisControlBar}>
                  <Text style={styles.cardMeta}>Base estatistica</Text>
                  <SampleWindowSelector value={sampleSize} onChange={setSampleSize} />
                </View>
              ) : null}
            </>
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
                {analysisLoadingKey === analysisKey && <ActivityIndicator size="small" color={colors.text} />}
              </View>

              {analysisLoadingKey === analysisKey && !analysisBundle ? (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>Calculando score, DNA, confiabilidade e mercados premium...</Text>
                </View>
              ) : analysisBundle ? (
                <PremiumAnalysisPanel
                  analysis={analysisBundle}
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
                  <Text style={styles.alertBody}>{analysisError || "Sem base suficiente para abrir a analise premium agora."}</Text>
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
                <TeamTraitsPanel analysis={analysisBundle} />
              ) : (
                <View style={styles.statsLoading}>
                  <Text style={styles.alertBody}>{analysisError || "Sem base suficiente para caracterizar esse time agora."}</Text>
                </View>
              )}
            </View>
          )}

          {detailTab === "players" && (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>Jogadores e elenco</Text>
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

export default function App() {
  return <AppShell />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing.screen },
  topBar: { marginTop: 8, marginBottom: 16, gap: 10 },
  brandRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  brandIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: colors.text, fontSize: 21, fontWeight: "900" },
  brandSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  livePill: { alignSelf: "flex-start", minHeight: 38, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(239,68,68,0.14)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.live },
  livePillText: { color: "#FFE1E1", fontSize: 12, fontWeight: "800" },
  syncButton: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  syncButtonText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  syncNote: { color: colors.muted, fontSize: 12 },
  errorNote: { color: "#FCA5A5", fontSize: 12, lineHeight: 18 },
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
  marketProbability: { color: colors.text, fontSize: 26, fontWeight: "900" },
  marketConfidenceBadge: { minHeight: 28, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  marketConfidenceText: { fontSize: 11, fontWeight: "900" },
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
  card: { borderRadius: radius.lg, padding: 16, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line, gap: 14 },
  liveCard: { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.22)" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  cardMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  categoryBadge: { minHeight: 24, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.24)", alignItems: "center", justifyContent: "center" },
  categoryBadgeText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  iconWrap: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  matchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  team: { flex: 1, alignItems: "center", gap: 8 },
  teamBadge: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#17324E", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  teamBadgeStrong: { width: 64, height: 64, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)" },
  teamBadgeImage: { width: 34, height: 34 },
  teamBadgeImageStrong: { width: 44, height: 44 },
  teamBadgeText: { color: colors.text, fontSize: 15, fontWeight: "900" },
  teamBadgeTextStrong: { fontSize: 18 },
  teamName: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: "700", textAlign: "center" },
  teamNameStrong: { fontSize: 15 },
  scoreWrap: { minWidth: 76, alignItems: "center" },
  scoreText: { color: colors.text, fontSize: 25, fontWeight: "900" },
  statusBadge: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
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
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: "rgba(56,189,248,0.10)", borderWidth: 1, borderColor: "rgba(56,189,248,0.22)" },
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
  authModeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  authModeButton: { width: "48%", minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  authModeButtonActive: { backgroundColor: "rgba(34,197,94,0.16)", borderColor: "rgba(34,197,94,0.32)" },
  authModeText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  authModeTextActive: { color: colors.text },
  authFeedbackError: { color: "#FCA5A5", fontSize: 13, fontWeight: "700" },
  authFeedbackSuccess: { color: "#86EFAC", fontSize: 13, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 12 },
  primaryButton: { minHeight: 50, borderRadius: 16, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, flex: 1 },
  primaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 50, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  secondaryButtonDisabled: { opacity: 0.55 },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  lockedPanel: { padding: 16, borderRadius: radius.lg, backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.22)" },
  setting: { flexDirection: "row", alignItems: "center", gap: 14 },
  empty: { padding: 16, borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: colors.line },
  tabs: { position: "absolute", left: spacing.screen, right: spacing.screen, bottom: 18, borderRadius: 26, padding: 10, backgroundColor: "rgba(7,17,31,0.96)", borderWidth: 1, borderColor: colors.line, flexDirection: "row" },
  tab: { flex: 1, minHeight: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 4 },
  tabActive: { backgroundColor: "rgba(255,255,255,0.08)" },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: colors.text },
  modalBack: { flex: 1, backgroundColor: "rgba(4,9,16,0.78)", justifyContent: "flex-end", padding: 16 },
  modal: { maxHeight: "88%", borderRadius: radius.xl, backgroundColor: "#0B1727", borderWidth: 1, borderColor: colors.line },
  modalContent: { padding: 20, gap: 16 },
  modalTitle: { color: colors.text, fontSize: 24, fontWeight: "900" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  info: { width: "48%", padding: 14, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.line },
  infoValue: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "700", marginTop: 8 },
  statsSection: { gap: 12 },
  statsTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  detailTabs: { gap: 10, paddingRight: 4 },
  detailTab: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  detailTabActive: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.24)" },
  detailTabText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  detailTabTextActive: { color: colors.text },
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
