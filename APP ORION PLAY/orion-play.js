const storageKeys = {
  profile: "orion-play-profile",
  favorites: "orion-play-favorites",
  history: "orion-play-history",
  settings: "orion-play-settings",
  notifications: "orion-play-notifications"
};

const contentCatalog = [
  {
    id: "movie-shadow-code",
    title: "Shadow Code",
    type: "movies",
    label: "Filme em destaque",
    genres: ["Thriller", "Tecnologia"],
    rating: 4.8,
    duration: "2h 04min",
    maturity: "16+",
    description:
      "Uma analista de seguranca descobre uma rede invisivel que manipula resultados de apostas, streaming e poder global.",
    hero: "linear-gradient(135deg, rgba(22, 32, 56, 0.2), rgba(255, 93, 108, 0.72), rgba(82, 233, 255, 0.18))",
    badge: "Novo",
    source: "Premiere Originals",
    trendingRank: 1
  },
  {
    id: "series-last-stand",
    title: "Last Stand: Rio",
    type: "series",
    label: "Serie premium",
    genres: ["Acao", "Crime"],
    rating: 4.7,
    duration: "8 episodios",
    maturity: "18+",
    description:
      "Uma equipe fora do protocolo tenta impedir uma guerra urbana enquanto a cidade inteira vira palco de transmissao em tempo real.",
    hero: "linear-gradient(145deg, rgba(82, 233, 255, 0.16), rgba(11, 15, 24, 0.14), rgba(255, 93, 108, 0.76))",
    badge: "Top serie",
    source: "Orion Originals",
    trendingRank: 2
  },
  {
    id: "live-final-cup",
    title: "Final Continental",
    type: "football",
    label: "Ao vivo agora",
    genres: ["Futebol", "Decisao"],
    rating: 4.9,
    duration: "2o tempo",
    maturity: "Livre",
    description:
      "Cobertura premium com estatisticas em tempo real, escalacoes e alertas minuto a minuto para a grande decisao da noite.",
    hero: "linear-gradient(135deg, rgba(82, 233, 255, 0.26), rgba(6, 11, 22, 0.1), rgba(255, 93, 108, 0.66))",
    badge: "Ao vivo",
    source: "Canal Sports 1",
    isLive: true,
    scoreboard: "2 x 1",
    teams: ["Aurora FC", "Capital City"],
    minute: "73'",
    trendingRank: 3
  },
  {
    id: "channel-sports-plus",
    title: "Sports+ HD",
    type: "channels",
    label: "Canal em alta",
    genres: ["Canal", "Esportes"],
    rating: 4.6,
    duration: "24h",
    maturity: "Livre",
    description:
      "Canal com transmissao continua de programas esportivos, mesa redonda, analises taticas e agenda ao vivo.",
    hero: "linear-gradient(145deg, rgba(255, 93, 108, 0.18), rgba(82, 233, 255, 0.46))",
    badge: "Canal",
    source: "Rede oficial",
    isLive: true,
    trendingRank: 4
  },
  {
    id: "sports-night-fight",
    title: "Night Fight Arena",
    type: "sports",
    label: "Evento esportivo",
    genres: ["Combate", "Ao vivo"],
    rating: 4.5,
    duration: "Comeca 22:00",
    maturity: "14+",
    description:
      "Card principal com cobertura em alta definicao, card preliminar, favoritos e acompanhamento do evento principal.",
    hero: "linear-gradient(135deg, rgba(255, 93, 108, 0.72), rgba(10, 16, 31, 0.1), rgba(82, 233, 255, 0.2))",
    badge: "Hoje",
    source: "Live Combat"
  },
  {
    id: "movie-pulse-drive",
    title: "Pulse Drive",
    type: "movies",
    label: "Sci-fi",
    genres: ["Ficcao", "Acao"],
    rating: 4.4,
    duration: "1h 56min",
    maturity: "14+",
    description:
      "Uma piloto de elite precisa atravessar um corredor orbital enquanto cada decisao altera o destino da humanidade.",
    hero: "linear-gradient(145deg, rgba(82, 233, 255, 0.45), rgba(10, 18, 34, 0.12), rgba(72, 92, 255, 0.74))",
    badge: "Dublado",
    source: "Cinema Max"
  },
  {
    id: "series-gold-line",
    title: "Gold Line FC",
    type: "series",
    label: "Drama esportivo",
    genres: ["Drama", "Futebol"],
    rating: 4.3,
    duration: "10 episodios",
    maturity: "12+",
    description:
      "Uma jovem presidente tenta reerguer um clube falido enquanto a cidade exige resultados imediatos dentro e fora do campo.",
    hero: "linear-gradient(145deg, rgba(255, 209, 102, 0.28), rgba(11, 18, 34, 0.12), rgba(82, 233, 255, 0.42))",
    badge: "Emocionante",
    source: "Orion Originals"
  },
  {
    id: "football-brasil-night",
    title: "Noite do Brasileirao",
    type: "football",
    label: "Rodada de hoje",
    genres: ["Futebol", "Liga nacional"],
    rating: 4.7,
    duration: "3 jogos",
    maturity: "Livre",
    description:
      "Painel rapido com os principais confrontos da rodada, provaveis escalacoes, alertas de inicio e onde assistir.",
    hero: "linear-gradient(135deg, rgba(10, 16, 28, 0.08), rgba(44, 201, 141, 0.54), rgba(255, 93, 108, 0.42))",
    badge: "Agenda",
    source: "Futebol Agora"
  },
  {
    id: "channel-premium-football",
    title: "Arena Futebol 24h",
    type: "channels",
    label: "Canal de futebol",
    genres: ["Canal", "Futebol"],
    rating: 4.8,
    duration: "24h",
    maturity: "Livre",
    description:
      "Noticias, analise tatica, cobertura de bastidores, central do mercado e programacao dedicada ao futebol o dia inteiro.",
    hero: "linear-gradient(135deg, rgba(255, 209, 102, 0.32), rgba(11, 17, 31, 0.12), rgba(255, 93, 108, 0.62))",
    badge: "Premium",
    source: "Arena Sports"
  },
  {
    id: "sports-ultimate-weekend",
    title: "Ultimate Weekend",
    type: "sports",
    label: "Esportes ao vivo",
    genres: ["Multiesportes", "Weekend"],
    rating: 4.2,
    duration: "Sab e dom",
    maturity: "Livre",
    description:
      "Do tenis ao automobilismo, acompanhe os grandes eventos do fim de semana em uma grade dinamica e organizada.",
    hero: "linear-gradient(145deg, rgba(72, 92, 255, 0.62), rgba(11, 16, 30, 0.12), rgba(82, 233, 255, 0.28))",
    badge: "Curadoria",
    source: "Weekend Live"
  }
];

const liveAlerts = [
  { id: "notif-1", title: "Gol na Final Continental", message: "Aurora FC ampliou para 2 a 1. Abrir central ao vivo agora?", time: "Agora" },
  { id: "notif-2", title: "Novo episodio liberado", message: "Last Stand: Rio recebeu o episodio 08 com final da temporada.", time: "12 min" },
  { id: "notif-3", title: "Sua lista foi atualizada", message: "Incluimos 6 novos titulos recomendados com base no que voce viu.", time: "1 h" }
];

const defaultSettings = {
  notifications: true,
  autoplay: true,
  dataSaver: false,
  sportsAlerts: true
};

const state = {
  currentView: "home",
  filter: "all",
  search: "",
  authMode: "login",
  profile: null,
  favorites: [],
  history: [],
  settings: { ...defaultSettings },
  notifications: [...liveAlerts]
};

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initials(name) {
  return String(name || "Visitante")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatType(type) {
  return { movies: "Filme", series: "Serie", sports: "Esporte", football: "Futebol", channels: "Canal" }[type] || "Conteudo";
}

function getContentById(id) {
  return contentCatalog.find((item) => item.id === id) || null;
}

function isFavorite(id) {
  return state.favorites.includes(id);
}

function getProgress(id) {
  const entry = state.history.find((item) => item.id === id);
  return entry ? entry.progress : 0;
}

function saveCollections() {
  writeStorage(storageKeys.profile, state.profile);
  writeStorage(storageKeys.favorites, state.favorites);
  writeStorage(storageKeys.history, state.history);
  writeStorage(storageKeys.settings, state.settings);
  writeStorage(storageKeys.notifications, state.notifications);
}

function filteredCatalog() {
  return contentCatalog.filter((item) => {
    const matchesFilter = state.filter === "all" ? true : item.type === state.filter;
    const haystack = `${item.title} ${item.label} ${item.description} ${item.genres.join(" ")}`.toLowerCase();
    const matchesSearch = state.search ? haystack.includes(state.search.toLowerCase()) : true;
    return matchesFilter && matchesSearch;
  });
}

function heroContent() {
  return state.filter !== "all" ? filteredCatalog()[0] || contentCatalog[0] : contentCatalog[0];
}

function cardMarkup(item) {
  return `
    <article class="card-poster" style="background:${item.hero}">
      <span class="mini-badge">${escapeHtml(item.badge || formatType(item.type))}</span>
      <div class="card-copy">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="meta-row">
          <span>${escapeHtml(formatType(item.type))}</span>
          <span class="dot"></span>
          <span>${escapeHtml(item.duration)}</span>
        </div>
        <button class="card-action" data-open-details="${item.id}" type="button">Abrir</button>
      </div>
    </article>
  `;
}

function sectionMarkup(title, subtitle, body) {
  return `
    <section class="section-card">
      <div class="section-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </div>
      ${body}
    </section>
  `;
}

function renderHero() {
  const item = heroContent();
  const hero = qs("[data-hero]");
  if (!hero || !item) return;

  hero.innerHTML = `
    <div class="hero-visual" style="background:${item.hero}"></div>
    <div class="hero-copy">
      <span class="eyebrow">${escapeHtml(item.label)}</span>
      <h1>${escapeHtml(item.title)}</h1>
      <p class="hero-subcopy">${escapeHtml(item.description)}</p>
      <div class="hero-meta">
        <span class="hero-pill">${escapeHtml(formatType(item.type))}</span>
        <span class="hero-pill ${item.isLive ? "is-live" : ""}">${escapeHtml(item.isLive ? "Ao vivo" : item.duration)}</span>
        <span class="hero-pill">${escapeHtml(String(item.rating))}</span>
      </div>
      <div class="hero-actions">
        <button class="primary-button" data-watch-now="${item.id}" type="button">Assistir agora</button>
        <button class="secondary-button" data-open-details="${item.id}" type="button">Ver detalhes</button>
      </div>
    </div>
  `;
}

function renderHomeView() {
  const trending = [...contentCatalog].sort((a, b) => (a.trendingRank || 99) - (b.trendingRank || 99)).slice(0, 5);
  const continueWatching = state.history.slice(0, 3);
  const liveNow = contentCatalog.filter((item) => item.isLive).slice(0, 4);
  const movies = contentCatalog.filter((item) => item.type === "movies").slice(0, 6);
  const series = contentCatalog.filter((item) => item.type === "series").slice(0, 6);

  const continueMarkup = continueWatching.length
    ? continueWatching
        .map((entry) => {
          const item = getContentById(entry.id);
          return item
            ? `
              <article class="hero-strip" style="background:${item.hero}">
                <span class="section-tag">${escapeHtml(formatType(item.type))}</span>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.description)}</p>
                <div class="progress-track"><div class="progress-bar" style="width:${entry.progress}%"></div></div>
                <div class="progress-label">
                  <span>${entry.progress}% assistido</span>
                  <button class="text-button" data-watch-now="${item.id}" type="button">Continuar</button>
                </div>
              </article>
            `
            : "";
        })
        .join("")
    : `
      <div class="empty-card">
        <strong>Nada em andamento ainda</strong>
        <span class="muted">Quando voce iniciar um conteudo, ele aparece aqui para continuar depois.</span>
      </div>
    `;

  return `
    <section class="promo-card">
      <div class="section-head">
        <div>
          <span class="eyebrow">Curadoria premium</span>
          <h2>Seu app com cara de plataforma grande</h2>
        </div>
      </div>
      <p class="hero-subcopy">
        Banners fortes, descoberta rapida, player moderno, futebol ao vivo, canais e favoritos sincronizados.
      </p>
      <div class="hero-actions">
        <button class="primary-button" data-view-shortcut="discover" type="button">Explorar catalogo</button>
        <button class="secondary-button" data-view-shortcut="live" type="button">Ver esportes ao vivo</button>
      </div>
    </section>
    ${sectionMarkup("Continuar assistindo", "Volte exatamente de onde parou", `<div class="list-stack">${continueMarkup}</div>`)}
    ${sectionMarkup("Em alta agora", "Filmes, series, futebol e canais em destaque", `<div class="horizontal-list">${trending.map(cardMarkup).join("")}</div>`)}
    ${sectionMarkup("Ao vivo e agora", "Partidas, canais e eventos com alertas em tempo real", `<div class="horizontal-list">${liveNow.map(cardMarkup).join("")}</div>`)}
    ${sectionMarkup("Filmes premium", "Destaques cinematograficos para abrir a noite", `<div class="horizontal-list">${movies.map(cardMarkup).join("")}</div>`)}
    ${sectionMarkup("Series para maratonar", "Titulos fortes com visual e ritmo de plataforma top", `<div class="horizontal-list">${series.map(cardMarkup).join("")}</div>`)}
  `;
}

function renderDiscoverView() {
  const results = filteredCatalog();
  return sectionMarkup(
    "Explorar",
    `${results.length} resultados combinando com sua busca e filtros`,
    `<div class="grid-two">${
      results.map(cardMarkup).join("") ||
      `<div class="empty-card" style="grid-column:1 / -1"><strong>Nenhum conteudo encontrado</strong><span class="muted">Tente outra busca ou remova alguns filtros para ver mais opcoes.</span></div>`
    }</div>`
  );
}

function renderLiveView() {
  const liveItems = contentCatalog.filter((item) => ["sports", "football", "channels"].includes(item.type));
  const topMatches = contentCatalog.filter((item) => item.type === "football").slice(0, 3);

  return `
    ${sectionMarkup("Ao vivo", "Esportes, canais e futebol em destaque", `<div class="grid-two">${liveItems.map(cardMarkup).join("")}</div>`)}
    ${sectionMarkup(
      "Top jogos de futebol",
      "Confrontos com maior interesse agora",
      `<div class="top-ranking-list">${topMatches
        .map(
          (item, index) => `
            <article class="top-ranking-card">
              <span class="rank-badge">${index + 1}</span>
              <div>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.description)}</p>
              </div>
              <button class="secondary-button" data-watch-now="${item.id}" type="button">Ver</button>
            </article>
          `
        )
        .join("")}</div>`
    )}
  `;
}

function renderLibraryView() {
  const favoriteItems = state.favorites.map(getContentById).filter(Boolean);
  const recentItems = state.history.map((entry) => getContentById(entry.id)).filter(Boolean);

  return `
    <section class="profile-card">
      <div class="mini-user">
        <span class="avatar">${escapeHtml(initials(state.profile?.name))}</span>
        <div>
          <h2>${escapeHtml(state.profile?.name || "Modo visitante")}</h2>
          <p>${escapeHtml(state.profile?.email || "Entre para sincronizar favoritos e historico")}</p>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><span>Favoritos</span><strong>${state.favorites.length}</strong></div>
        <div class="stat-card"><span>Historico</span><strong>${state.history.length}</strong></div>
        <div class="stat-card"><span>Alertas</span><strong>${state.notifications.length}</strong></div>
      </div>
    </section>
    ${sectionMarkup(
      "Favoritos",
      "Seus titulos e canais salvos",
      `<div class="grid-two">${
        favoriteItems.map(cardMarkup).join("") ||
        `<div class="empty-card" style="grid-column:1 / -1"><strong>Sua lista ainda esta vazia</strong><span class="muted">Use o botao de salvar nos cards para montar sua selecao favorita.</span></div>`
      }</div>`
    )}
    ${sectionMarkup(
      "Historico recente",
      "Volte para o que voce abriu por ultimo",
      `<div class="horizontal-list">${
        recentItems.map(cardMarkup).join("") ||
        `<div class="empty-card"><strong>Sem historico ainda</strong><span class="muted">Ao assistir algum conteudo, ele aparece aqui automaticamente.</span></div>`
      }</div>`
    )}
  `;
}

function settingMarkup(key, title, text) {
  return `
    <div class="setting-row">
      <div class="setting-copy">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </div>
      <button class="toggle ${state.settings[key] ? "is-on" : ""}" data-toggle-setting="${key}" type="button" aria-label="${escapeHtml(title)}"></button>
    </div>
  `;
}

function renderProfileView() {
  return `
    <section class="profile-card">
      <div class="mini-user">
        <span class="avatar">${escapeHtml(initials(state.profile?.name))}</span>
        <div>
          <span class="eyebrow">Perfil</span>
          <h2>${escapeHtml(state.profile?.name || "Visitante")}</h2>
          <p>${escapeHtml(state.profile?.email || "Modo visitante ativo")}</p>
        </div>
      </div>
      <div class="library-highlight">
        <strong>Identidade visual</strong>
        <p>Dark premium, destaque em coral energico e ciano eletrico, com foco em velocidade, esportes e descoberta.</p>
      </div>
    </section>
    <section class="setting-card">
      <div class="section-head">
        <div>
          <h2>Configuracoes</h2>
          <p>Controle sua experiencia no app</p>
        </div>
      </div>
      <div class="settings-list">
        ${settingMarkup("notifications", "Notificacoes gerais", "Receber avisos de novos titulos e alertas importantes")}
        ${settingMarkup("sportsAlerts", "Alertas esportivos", "Partidas iniciando, gols, intervalos e eventos ao vivo")}
        ${settingMarkup("autoplay", "Autoplay no player", "Avancar automaticamente para o proximo conteudo recomendado")}
        ${settingMarkup("dataSaver", "Economia de dados", "Reduzir animacoes e priorizar carregamento mais leve")}
      </div>
    </section>
    <section class="promo-card">
      <span class="eyebrow">Pronto para crescer</span>
      <h2>Base organizada para virar Android e iPhone.</h2>
      <p class="hero-subcopy">
        Estrutura mobile-first com componentes reutilizaveis, dados editaveis e fluxo claro para futura integracao com backend real.
      </p>
      <div class="hero-actions">
        <button class="secondary-button" data-open-auth type="button">Editar conta</button>
      </div>
    </section>
  `;
}

function renderNotifications() {
  const list = qs("[data-notification-list]");
  if (!list) return;

  list.innerHTML = state.notifications
    .map(
      (item) => `
        <article class="notification-card">
          <span class="eyebrow">${escapeHtml(item.time)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.message)}</p>
        </article>
      `
    )
    .join("");
}

function renderView() {
  const container = qs("[data-view-container]");
  if (!container) return;

  container.innerHTML = {
    home: renderHomeView(),
    discover: renderDiscoverView(),
    live: renderLiveView(),
    library: renderLibraryView(),
    profile: renderProfileView()
  }[state.currentView];

  qsa("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-view") === state.currentView);
  });
}

function renderAll() {
  renderHero();
  renderView();
  renderNotifications();
}

function openDetails(id) {
  const item = getContentById(id);
  const sheet = qs("[data-details-sheet]");
  const content = qs("[data-details-content]");
  if (!item || !sheet || !content) return;

  content.innerHTML = `
    <div class="content-sheet-top">
      <div>
        <span class="eyebrow">${escapeHtml(item.label)}</span>
        <h2>${escapeHtml(item.title)}</h2>
      </div>
      <button class="icon-button" data-close-details type="button" aria-label="Fechar detalhes">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z"/></svg>
      </button>
    </div>
    <div class="detail-cover" style="background:${item.hero}">
      <span class="mini-badge">${escapeHtml(item.badge || formatType(item.type))}</span>
      <div class="detail-cover-copy"><span class="section-tag">${escapeHtml(item.source)}</span></div>
    </div>
    <div class="detail-copy">
      <div class="meta-row">
        <span>${escapeHtml(formatType(item.type))}</span>
        <span class="dot"></span>
        <span>${escapeHtml(item.duration)}</span>
        <span class="dot"></span>
        <span>${escapeHtml(String(item.rating))}</span>
        <span class="dot"></span>
        <span>${escapeHtml(item.maturity)}</span>
      </div>
      <p class="detail-description">${escapeHtml(item.description)}</p>
      <div class="detail-grid">
        <div class="detail-info-card"><strong>Categoria</strong><span>${escapeHtml(item.genres.join(" / "))}</span></div>
        <div class="detail-info-card"><strong>Avaliacao</strong><span>${escapeHtml(String(item.rating))} / 5</span></div>
      </div>
      <div class="detail-actions">
        <button class="primary-button" data-watch-now="${item.id}" type="button">Assistir</button>
        <button class="secondary-button" data-toggle-favorite="${item.id}" type="button">${isFavorite(item.id) ? "Remover favorito" : "Salvar favorito"}</button>
      </div>
    </div>
  `;

  sheet.classList.remove("hidden");
}

function closeDetails() {
  qs("[data-details-sheet]")?.classList.add("hidden");
}

function registerHistory(id, progressOverride) {
  const current = state.history.find((entry) => entry.id === id);
  const nextProgress = progressOverride || Math.min((current?.progress || 12) + 18, 100);
  state.history = [
    { id, progress: nextProgress, updatedAt: new Date().toISOString() },
    ...state.history.filter((entry) => entry.id !== id)
  ].slice(0, 12);
  saveCollections();
}

function openPlayer(id) {
  const item = getContentById(id);
  const sheet = qs("[data-player-sheet]");
  const content = qs("[data-player-content]");
  if (!item || !sheet || !content) return;

  registerHistory(id);

  content.innerHTML = `
    <div class="content-sheet-top">
      <div>
        <span class="eyebrow">Player premium</span>
        <h2>${escapeHtml(item.title)}</h2>
      </div>
      <button class="icon-button" data-close-player type="button" aria-label="Fechar player">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z"/></svg>
      </button>
    </div>
    <div class="player-stage" style="background:${item.hero}">
      <div class="play-orb">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>
      </div>
      <div class="player-overlay-copy">
        <div class="player-topline">
          <span>${escapeHtml(item.source)}</span>
          <span>${escapeHtml(item.isLive ? "Sinal ao vivo" : "Preview premium")}</span>
        </div>
        <div class="live-score">
          <span class="live-pill">${escapeHtml(item.isLive ? "Ao vivo" : "Player")}</span>
          ${item.scoreboard ? `<strong>${escapeHtml(item.scoreboard)}</strong>` : ""}
        </div>
        ${
          item.teams
            ? `<div class="match-meta"><span>${escapeHtml(item.teams[0])}</span><span>${escapeHtml(item.minute || "")}</span><span>${escapeHtml(item.teams[1])}</span></div>`
            : `<div class="match-meta"><span>${escapeHtml(item.genres.join(" / "))}</span><span>${escapeHtml(item.duration)}</span></div>`
        }
      </div>
    </div>
    <div class="progress-track"><div class="progress-bar" style="width:${getProgress(id)}%"></div></div>
    <div class="progress-label"><span>${getProgress(id)}% da sessao simulada</span><span>${escapeHtml(item.label)}</span></div>
    <div class="player-controls">
      <button class="control-pill" data-advance-progress="${item.id}" type="button">Avancar 12%</button>
      <button class="control-pill" data-toggle-favorite="${item.id}" type="button">${isFavorite(item.id) ? "Favoritado" : "Salvar"}</button>
      <button class="control-pill" data-open-details="${item.id}" type="button">Informacoes</button>
    </div>
  `;

  closeDetails();
  sheet.classList.remove("hidden");
}

function closePlayer() {
  qs("[data-player-sheet]")?.classList.add("hidden");
}

function toggleFavorite(id) {
  if (isFavorite(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
  } else {
    state.favorites = [id, ...state.favorites.filter((item) => item !== id)];
  }

  saveCollections();
  renderAll();
}

function openNotifications() {
  qs("[data-notifications-sheet]")?.classList.remove("hidden");
}

function closeNotifications() {
  qs("[data-notifications-sheet]")?.classList.add("hidden");
}

function setAuthMode(mode) {
  state.authMode = mode;
  qsa("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-auth-mode") === mode);
  });

  const nameField = qs("#auth-name")?.closest(".field-stack");
  if (nameField) {
    nameField.classList.toggle("hidden", mode === "login");
  }

  const submit = qs("[data-auth-submit]");
  if (submit) {
    submit.textContent = mode === "login" ? "Entrar agora" : "Criar conta";
  }
}

function openAuthSheet() {
  qs("[data-auth-sheet]")?.classList.remove("hidden");
  setAuthMode(state.authMode);
}

function closeAuthSheet() {
  qs("[data-auth-sheet]")?.classList.add("hidden");
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const feedback = qs("[data-auth-feedback]");
  const name = qs("#auth-name")?.value.trim() || "Visitante";
  const email = qs("#auth-email")?.value.trim().toLowerCase() || "";
  const password = qs("#auth-password")?.value.trim() || "";

  if (!email || !password || (state.authMode === "register" && !name)) {
    if (feedback) {
      feedback.textContent = "Preencha os campos obrigatorios para continuar.";
      feedback.classList.remove("hidden");
    }
    return;
  }

  state.profile = {
    name: state.authMode === "login" ? name || email.split("@")[0] : name,
    email
  };
  saveCollections();

  if (feedback) {
    feedback.classList.add("hidden");
  }

  closeAuthSheet();
  renderAll();
}

function handleDocumentClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const view = button.getAttribute("data-view");
  const shortcut = button.getAttribute("data-view-shortcut");
  const detailsId = button.getAttribute("data-open-details");
  const watchId = button.getAttribute("data-watch-now");
  const favoriteId = button.getAttribute("data-toggle-favorite");
  const settingKey = button.getAttribute("data-toggle-setting");
  const advanceId = button.getAttribute("data-advance-progress");
  const authMode = button.getAttribute("data-auth-mode");

  if (view || shortcut) {
    state.currentView = view || shortcut;
    renderAll();
    return;
  }
  if (detailsId) return openDetails(detailsId);
  if (watchId) return openPlayer(watchId);
  if (favoriteId) return toggleFavorite(favoriteId);

  if (settingKey) {
    state.settings[settingKey] = !state.settings[settingKey];
    saveCollections();
    renderAll();
    return;
  }

  if (advanceId) {
    registerHistory(advanceId, Math.min(getProgress(advanceId) + 12, 100));
    openPlayer(advanceId);
    renderAll();
    return;
  }

  if (authMode) return setAuthMode(authMode);
  if (button.hasAttribute("data-close-details")) return closeDetails();
  if (button.hasAttribute("data-close-player")) {
    closePlayer();
    return renderAll();
  }
  if (button.hasAttribute("data-open-notifications")) return openNotifications();
  if (button.hasAttribute("data-close-notifications")) return closeNotifications();
  if (button.hasAttribute("data-open-auth")) return openAuthSheet();
  if (button.hasAttribute("data-auth-skip")) return closeAuthSheet();
}

function bindInputs() {
  qs("[data-search-input]")?.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderAll();
  });

  qsa("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.getAttribute("data-filter") || "all";
      qsa("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderAll();
    });
  });

  qs("[data-auth-form]")?.addEventListener("submit", handleAuthSubmit);
}

function bootState() {
  state.profile = readStorage(storageKeys.profile, null);
  state.favorites = readStorage(storageKeys.favorites, []);
  state.history = readStorage(storageKeys.history, [
    { id: "series-last-stand", progress: 36, updatedAt: new Date().toISOString() },
    { id: "movie-pulse-drive", progress: 62, updatedAt: new Date().toISOString() }
  ]);
  state.settings = readStorage(storageKeys.settings, { ...defaultSettings });
  state.notifications = readStorage(storageKeys.notifications, [...liveAlerts]);
}

function init() {
  bootState();
  bindInputs();
  document.addEventListener("click", handleDocumentClick);
  renderAll();

  if (!state.profile) {
    openAuthSheet();
  }
}

init();
