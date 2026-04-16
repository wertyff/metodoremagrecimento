const state = {
  token: localStorage.getItem("mi_platform_token") || "",
  session: null,
  home: null,
  searchResults: [],
  selectedTeam: null,
  selectedMatch: null,
  detailTab: "resumo",
  authTab: "login"
};

const refs = {
  authBtn: document.getElementById("authBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  sessionCard: document.getElementById("sessionCard"),
  sessionPill: document.getElementById("sessionPill"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  updatedAtText: document.getElementById("updatedAtText"),
  highlightsGrid: document.getElementById("highlightsGrid"),
  liveList: document.getElementById("liveList"),
  upcomingList: document.getElementById("upcomingList"),
  finishedList: document.getElementById("finishedList"),
  competitionsWrap: document.getElementById("competitionsWrap"),
  liveCountPill: document.getElementById("liveCountPill"),
  upcomingCountPill: document.getElementById("upcomingCountPill"),
  finishedCountPill: document.getElementById("finishedCountPill"),
  kpiHighlights: document.getElementById("kpiHighlights"),
  kpiLive: document.getElementById("kpiLive"),
  kpiCompetitions: document.getElementById("kpiCompetitions"),
  authDialog: document.getElementById("authDialog"),
  closeAuthDialog: document.getElementById("closeAuthDialog"),
  authMessage: document.getElementById("authMessage"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  detailDialog: document.getElementById("detailDialog"),
  detailContent: document.getElementById("detailContent"),
  closeDetailDialog: document.getElementById("closeDetailDialog")
};

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  return headers;
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: apiHeaders(options.headers || {})
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Falha na requisicao.");
  }
  return payload;
}

function saveToken(token) {
  state.token = token || "";
  if (state.token) {
    localStorage.setItem("mi_platform_token", state.token);
  } else {
    localStorage.removeItem("mi_platform_token");
  }
}

function openAuthDialog(tab = "login") {
  state.authTab = tab;
  refs.authMessage.textContent = "";
  syncAuthTabs();
  refs.authDialog.showModal();
}

function closeAuthDialog() {
  refs.authDialog.close();
}

function syncAuthTabs() {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    const active = button.dataset.authTab === state.authTab;
    button.classList.toggle("active", active);
  });
  refs.loginForm.classList.toggle("hidden", state.authTab !== "login");
  refs.registerForm.classList.toggle("hidden", state.authTab !== "register");
}

function badgeImage(src, alt) {
  return src
    ? `<img class="team-badge" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`
    : `<div class="team-badge">${escapeHtml((alt || "?").slice(0, 2))}</div>`;
}

function miniBadge(src, alt) {
  return src
    ? `<img class="mini-badge-image" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`
    : `<div class="mini-badge-image">${escapeHtml((alt || "?").slice(0, 2))}</div>`;
}

function resultBadge(result) {
  if (result === "V") return `<span class="status-pill">${result}</span>`;
  if (result === "D") return `<span class="status-pill danger">${result}</span>`;
  return `<span class="status-pill subtle">${result || "-"}</span>`;
}

function renderSessionCard() {
  const access = state.session;
  if (!access?.authenticated) {
    refs.sessionPill.textContent = "Visitante";
    refs.authBtn.textContent = "Entrar";
    refs.sessionCard.innerHTML = `
      <div class="result-card">
        <strong>Conta free</strong>
        <p class="muted small">Entre para salvar preferências e liberar a parte premium real.</p>
        <div class="detail-tabs">
          <button class="primary-btn" data-open-auth="login" type="button">Fazer login</button>
          <button class="ghost-btn" data-open-auth="register" type="button">Criar conta</button>
        </div>
      </div>
    `;
    return;
  }

  const premium = access.premium || {};
  refs.sessionPill.textContent = premium.accessLevel === "premium" ? "Premium" : "Free";
  refs.authBtn.textContent = "Minha conta";
  refs.sessionCard.innerHTML = `
    <div class="result-card">
      <strong>${escapeHtml(access.user?.name || "Conta")}</strong>
      <p class="muted small">${escapeHtml(access.user?.email || "")}</p>
      <p class="muted small">Plano: ${escapeHtml(premium.planTitle || "Match Intelligence PRO")} • ${escapeHtml(premium.statusLabel || "Inativa")}</p>
      <div class="detail-tabs">
        ${premium.accessLevel === "premium"
          ? `<button class="ghost-btn" data-refresh-premium type="button">Atualizar premium</button>`
          : `<button class="premium-btn" data-start-premium type="button">Virar premium</button>`}
        <button class="ghost-btn" data-logout type="button">Sair</button>
      </div>
    </div>
  `;
}

function renderMatchStack(items, target, statusClass = "") {
  if (!items.length) {
    target.innerHTML = `<div class="result-card"><p class="muted small">Sem jogos nesta faixa agora.</p></div>`;
    return;
  }

  target.innerHTML = items.slice(0, 12).map((match) => `
    <article class="stack-card ${statusClass} ${match.status === "live" ? "live" : ""}" data-match-id="${escapeHtml(match.id)}">
      <div class="competition-head">
        <strong>${escapeHtml(match.competition)}</strong>
        <span class="muted tiny">${escapeHtml(match.dateLabel)} • ${escapeHtml(match.time)}</span>
      </div>
      <div class="match-line">
        <div class="team-line">${miniBadge(match.homeBadge, match.homeTeam)}<div class="team-meta"><strong>${escapeHtml(match.homeTeam)}</strong></div></div>
        <div class="compact-score">${match.homeScore ?? "-"} x ${match.awayScore ?? "-"}</div>
        <div class="team-line" style="justify-content:flex-end"><div class="team-meta" style="text-align:right"><strong>${escapeHtml(match.awayTeam)}</strong></div>${miniBadge(match.awayBadge, match.awayTeam)}</div>
      </div>
      <span class="match-minute ${match.status === "live" ? "live" : ""}">${escapeHtml(match.minute)}</span>
    </article>
  `).join("");
}

function renderHome() {
  const data = state.home;
  if (!data) return;

  refs.kpiHighlights.textContent = String(data.highlights?.length || 0);
  refs.kpiLive.textContent = String(data.live?.length || 0);
  refs.kpiCompetitions.textContent = String(data.competitions?.length || 0);
  refs.liveCountPill.textContent = String(data.live?.length || 0);
  refs.upcomingCountPill.textContent = String(data.upcoming?.length || 0);
  refs.finishedCountPill.textContent = String(data.finished?.length || 0);

  const updatedAt = new Date(data.updatedAt);
  refs.updatedAtText.textContent = `Atualizado ${updatedAt.toLocaleDateString("pt-BR")} ${updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  refs.highlightsGrid.innerHTML = (data.highlights || []).map((match) => `
    <article class="highlight-card" data-match-id="${escapeHtml(match.id)}">
      <div class="highlight-head">
        <div>
          <p class="eyebrow">${escapeHtml(match.competition)}</p>
          <strong>${escapeHtml(match.stage)}</strong>
        </div>
        <span class="status-pill ${match.status === "live" ? "danger" : match.status === "finished" ? "subtle" : ""}">
          ${escapeHtml(match.minute)}
        </span>
      </div>
      <div class="match-line">
        <div class="team-line">${badgeImage(match.homeBadge, match.homeTeam)}<div class="team-meta"><strong>${escapeHtml(match.homeTeam)}</strong></div></div>
        <div class="score-block">${match.homeScore ?? "-"} x ${match.awayScore ?? "-"}<small>${escapeHtml(match.dateLabel)} • ${escapeHtml(match.time)}</small></div>
        <div class="team-line" style="justify-content:flex-end"><div class="team-meta" style="text-align:right"><strong>${escapeHtml(match.awayTeam)}</strong></div>${badgeImage(match.awayBadge, match.awayTeam)}</div>
      </div>
    </article>
  `).join("");

  renderMatchStack(data.live || [], refs.liveList, "live");
  renderMatchStack(data.upcoming || [], refs.upcomingList);
  renderMatchStack(data.finished || [], refs.finishedList);

  refs.competitionsWrap.innerHTML = (data.competitions || []).map((competition) => `
    <article class="competition-card">
      <div class="competition-head">
        <div>
          <p class="eyebrow">${escapeHtml(competition.country || "Mundo")}</p>
          <strong>${escapeHtml(competition.competition)}</strong>
        </div>
        <span class="muted tiny">${competition.matches.length} jogo(s)</span>
      </div>
      <div class="competition-matches">
        ${competition.matches.slice(0, 8).map((match) => `
          <div class="competition-match ${match.status === "live" ? "live" : ""}" data-match-id="${escapeHtml(match.id)}">
            <div class="muted small">${escapeHtml(match.time)}</div>
            <div class="compact-teams">
              <strong>${escapeHtml(match.homeTeam)}</strong>
              <strong>${escapeHtml(match.awayTeam)}</strong>
            </div>
            <div class="compact-score">${match.homeScore ?? "-"} x ${match.awayScore ?? "-"}</div>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

async function loadHome() {
  state.home = await apiFetch("/api/platform/home");
  renderHome();
}

let searchTimer = null;
function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const query = refs.searchInput.value.trim();
    if (query.length < 2) {
      refs.searchResults.innerHTML = "";
      return;
    }

    try {
      const payload = await apiFetch(`/api/platform/search?q=${encodeURIComponent(query)}`);
      state.searchResults = payload.results || [];
      refs.searchResults.innerHTML = state.searchResults.length
        ? state.searchResults.map((team) => `
            <article class="result-card" data-team-id="${escapeHtml(team.id)}">
              <div class="team-line">
                ${miniBadge(team.badge, team.name)}
                <div class="team-meta">
                  <strong>${escapeHtml(team.name)}</strong>
                  <span class="muted small">${escapeHtml(team.category)} • ${escapeHtml(team.league || team.country || "Futebol")}</span>
                </div>
              </div>
            </article>
          `).join("")
        : `<div class="result-card"><p class="muted small">Nenhum time encontrado.</p></div>`;
    } catch (error) {
      refs.searchResults.innerHTML = `<div class="result-card"><p class="muted small">${escapeHtml(error.message)}</p></div>`;
    }
  }, 280);
}

function premiumLockCard(title, body = "Entre no premium para liberar este bloco.") {
  return `
    <article class="premium-lock">
      <h4>${escapeHtml(title)}</h4>
      <p class="muted small">${escapeHtml(body)}</p>
      ${state.session?.authenticated
        ? `<button class="premium-btn" data-start-premium type="button">Destravar premium</button>`
        : `<button class="primary-btn" data-open-auth="login" type="button">Entrar para liberar</button>`}
    </article>
  `;
}

function renderTeamDetail(payload) {
  const { team, recentMatches, upcomingMatches, standings, squad, access } = payload;

  refs.detailContent.innerHTML = `
    <section class="detail-hero">
      <div class="hero-match">
        <div class="hero-match-head">
          <div>
            <p class="eyebrow">${escapeHtml(team.country || "Mundo")}</p>
            <h2>${escapeHtml(team.name)}</h2>
            <p class="muted small">${escapeHtml(team.category)} • ${escapeHtml(team.league || "Futebol")}</p>
          </div>
          <span class="status-pill ${access?.premiumAccess ? "" : "subtle"}">${access?.premiumAccess ? "Premium liberado" : "Modo free"}</span>
        </div>
        <div class="team-summary">
          <div class="team-line">${badgeImage(team.badge, team.name)}<div class="team-meta"><strong>${escapeHtml(team.name)}</strong><span class="muted small">${escapeHtml(team.stadium || "Sem estadio")}</span></div></div>
          <div class="overview-grid">
            <article class="result-card"><strong>Fundacao</strong><p class="muted small">${escapeHtml(team.founded || "-")}</p></article>
            <article class="result-card"><strong>Genero</strong><p class="muted small">${escapeHtml(team.gender || "Nao informado")}</p></article>
          </div>
        </div>
      </div>
      <div class="hero-match">
        <p class="eyebrow">Resumo</p>
        <p class="muted small">${escapeHtml((team.description || "Sem descricao detalhada na base atual.").slice(0, 520))}</p>
      </div>
    </section>

    <div class="detail-tabs">
      <button class="chip-btn active" data-team-tab="resumo" type="button">Resumo</button>
      <button class="chip-btn" data-team-tab="resultados" type="button">Resultados</button>
      <button class="chip-btn" data-team-tab="calendario" type="button">Calendario</button>
      <button class="chip-btn" data-team-tab="classificacao" type="button">Classificacao</button>
      <button class="chip-btn" data-team-tab="elenco" type="button">Elenco</button>
    </div>

    <div class="tabs-body">
      <section class="panel overview-panel" data-team-panel="resumo">
        <div class="overview-grid">
          <article class="result-card"><strong>Ultimos jogos</strong><p class="muted small">${recentMatches.length} registros recentes</p></article>
          <article class="result-card"><strong>Proximos jogos</strong><p class="muted small">${upcomingMatches.length} compromissos</p></article>
        </div>
      </section>

      <section class="panel hidden" data-team-panel="resultados">
        <div class="summary-list">
          ${recentMatches.map((match) => `
            <article class="h2h-row">
              <span>${escapeHtml(match.date)} ${escapeHtml(match.time)}</span>
              <strong>${escapeHtml(match.team)} ${match.scoreLine} ${escapeHtml(match.opponent)}</strong>
              ${resultBadge(match.result)}
            </article>
          `).join("") || `<p class="muted small">Sem jogos recentes.</p>`}
        </div>
      </section>

      <section class="panel hidden" data-team-panel="calendario">
        <div class="summary-list">
          ${upcomingMatches.map((match) => `
            <article class="h2h-row">
              <span>${escapeHtml(match.date)} ${escapeHtml(match.time)}</span>
              <strong>${escapeHtml(match.team)} x ${escapeHtml(match.opponent)}</strong>
              <span class="muted small">${escapeHtml(match.venue || "A definir")}</span>
            </article>
          `).join("") || `<p class="muted small">Sem jogos futuros na base atual.</p>`}
        </div>
      </section>

      <section class="panel hidden" data-team-panel="classificacao">
        <div class="summary-list">
          ${standings.slice(0, 12).map((row) => `
            <article class="standing-row">
              <span>#${row.rank}</span>
              ${miniBadge(row.badge, row.teamName)}
              <strong>${escapeHtml(row.teamName)}</strong>
              <span class="muted small">${row.points} pts • ${row.played}j • SG ${row.goalDifference}</span>
            </article>
          `).join("") || `<p class="muted small">Classificacao indisponivel para este recorte.</p>`}
        </div>
      </section>

      <section class="panel hidden" data-team-panel="elenco">
        <div class="squad-grid">
          ${squad.map((player) => `
            <article class="squad-card">
              <div class="squad-line">
                ${miniBadge(player.photo, player.name)}
                <div class="team-meta">
                  <strong>${escapeHtml(player.name)}</strong>
                  <span class="muted small">${escapeHtml(player.position || "-")} • ${escapeHtml(player.nationality || "-")}</span>
                </div>
              </div>
            </article>
          `).join("") || `<p class="muted small">Elenco indisponivel na base atual.</p>`}
        </div>
      </section>
    </div>
  `;

  refs.detailDialog.showModal();
}

function renderTraitColumn(title, items) {
  return `
    <article class="traits-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="summary-list">
        ${items.map((item) => `
          <div class="stat-row">
            <span>${escapeHtml(item.title)}</span>
            <strong>${escapeHtml(item.body || "")}</strong>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderMarketSection(title, data, premiumAccess) {
  return `
    <article class="market-card">
      <h4>${escapeHtml(title)}</h4>
      <div class="summary-list">
        ${data.freeRows.map((row) => `
          <div class="market-row">
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.left)}</strong>
            <span class="muted tiny">${escapeHtml(row.center)}</span>
            <strong>${escapeHtml(row.right)}</strong>
          </div>
        `).join("")}
      </div>
      ${premiumAccess
        ? `<div class="summary-list" style="margin-top:12px">${data.premiumRows.map((row) => `
            <div class="market-row">
              <span>${escapeHtml(row.label)}</span>
              <strong>${escapeHtml(row.left)}</strong>
              <span class="muted tiny">${escapeHtml(row.center)}</span>
              <strong>${escapeHtml(row.right)}</strong>
            </div>
          `).join("")}</div>`
        : premiumLockCard(`${title} premium`, "A parte detalhada deste mercado fica liberada somente na conta premium.")}
    </article>
  `;
}

function renderMatchDetail(payload) {
  const { match, stats, timeline, standings, h2h, homeRecent, awayRecent, homeUpcoming, awayUpcoming, traits, marketStats, access } = payload;
  const premiumAccess = Boolean(access?.premiumAccess);

  refs.detailContent.innerHTML = `
    <section class="detail-hero">
      <div class="hero-match">
        <div class="hero-match-head">
          <div>
            <p class="eyebrow">${escapeHtml(match.header.competition)}</p>
            <h2>${escapeHtml(match.header.stage)}</h2>
            <p class="muted small">${escapeHtml(match.header.date)} • ${escapeHtml(match.header.time)}</p>
          </div>
          <span class="status-pill ${match.status === "live" ? "danger" : match.status === "finished" ? "subtle" : ""}">${escapeHtml(match.minute)}</span>
        </div>
        <div class="hero-scoreline">
          <div class="hero-team">${badgeImage(match.homeBadge, match.homeTeam)}<strong>${escapeHtml(match.homeTeam)}</strong></div>
          <div class="hero-center-score"><strong>${match.homeScore ?? "-"} x ${match.awayScore ?? "-"}</strong><span class="muted small">${escapeHtml(match.header.competition)}</span></div>
          <div class="hero-team">${badgeImage(match.awayBadge, match.awayTeam)}<strong>${escapeHtml(match.awayTeam)}</strong></div>
        </div>
      </div>
      <div class="hero-match">
        <p class="eyebrow">Acesso</p>
        <h3>${premiumAccess ? "Premium ativo" : "Free ativo"}</h3>
        <p class="muted small">${premiumAccess ? "Caracteristicas casa/fora, mercados premium e blocos travados foram liberados." : "Voce esta vendo a camada free com estatisticas reais. A leitura premium continua bloqueada."}</p>
        ${premiumAccess ? "" : `<button class="premium-btn" data-start-premium type="button">Virar premium</button>`}
      </div>
    </section>

    <div class="detail-tabs">
      <button class="chip-btn active" data-match-tab="resumo" type="button">Resumo</button>
      <button class="chip-btn" data-match-tab="resultados" type="button">Resultados</button>
      <button class="chip-btn" data-match-tab="calendario" type="button">Calendario</button>
      <button class="chip-btn" data-match-tab="classificacao" type="button">Classificacao</button>
      <button class="chip-btn" data-match-tab="caracteristicas" type="button">Caracteristicas</button>
      <button class="chip-btn" data-match-tab="estatisticas" type="button">Estatisticas</button>
    </div>

    <div class="tabs-body">
      <section class="panel" data-match-panel="resumo">
        <div class="overview-grid">
          <article class="result-card"><strong>Confrontos diretos</strong><p class="muted small">${h2h.summary.homeWins} vit. casa • ${h2h.summary.draws} empates • ${h2h.summary.awayWins} vit. fora</p></article>
          <article class="result-card"><strong>Timeline</strong><p class="muted small">${timeline.length} eventos na linha do tempo</p></article>
        </div>
        <div class="summary-list" style="margin-top:14px">
          ${timeline.slice(0, 8).map((event) => `
            <article class="stat-row">
              <span>${escapeHtml(event.minute)}</span>
              <strong>${escapeHtml(event.team)} • ${escapeHtml(event.type)}</strong>
            </article>
          `).join("") || `<p class="muted small">Timeline indisponivel para esta partida.</p>`}
        </div>
      </section>

      <section class="panel hidden" data-match-panel="resultados">
        <div class="three-grid">
          <article class="result-card"><strong>Ultimos jogos: ${escapeHtml(match.homeTeam)}</strong></article>
          <article class="result-card"><strong>H2H</strong></article>
          <article class="result-card"><strong>Ultimos jogos: ${escapeHtml(match.awayTeam)}</strong></article>
        </div>
        <div class="three-grid">
          <div class="summary-list">${homeRecent.map((item) => `<article class="h2h-row"><span>${escapeHtml(item.date)}</span><strong>${escapeHtml(item.team)} ${item.scoreLine} ${escapeHtml(item.opponent)}</strong>${resultBadge(item.result)}</article>`).join("")}</div>
          <div class="summary-list">${h2h.matches.map((item) => `<article class="h2h-row"><span>${escapeHtml(item.date)}</span><strong>${escapeHtml(item.homeTeam)} ${item.homeScore} x ${item.awayScore} ${escapeHtml(item.awayTeam)}</strong></article>`).join("") || `<p class="muted small">Sem H2H suficiente.</p>`}</div>
          <div class="summary-list">${awayRecent.map((item) => `<article class="h2h-row"><span>${escapeHtml(item.date)}</span><strong>${escapeHtml(item.team)} ${item.scoreLine} ${escapeHtml(item.opponent)}</strong>${resultBadge(item.result)}</article>`).join("")}</div>
        </div>
      </section>

      <section class="panel hidden" data-match-panel="calendario">
        <div class="three-grid">
          <div class="summary-list">${homeUpcoming.map((item) => `<article class="h2h-row"><span>${escapeHtml(item.date)} ${escapeHtml(item.time)}</span><strong>${escapeHtml(item.team)} x ${escapeHtml(item.opponent)}</strong></article>`).join("") || `<p class="muted small">Sem proximos jogos.</p>`}</div>
          <div class="result-card"><strong>Agenda do confronto</strong><p class="muted small">Use esta aba para acompanhar o calendario dos dois times.</p></div>
          <div class="summary-list">${awayUpcoming.map((item) => `<article class="h2h-row"><span>${escapeHtml(item.date)} ${escapeHtml(item.time)}</span><strong>${escapeHtml(item.team)} x ${escapeHtml(item.opponent)}</strong></article>`).join("") || `<p class="muted small">Sem proximos jogos.</p>`}</div>
        </div>
      </section>

      <section class="panel hidden" data-match-panel="classificacao">
        <div class="summary-list">
          ${standings.slice(0, 16).map((row) => `
            <article class="standing-row">
              <span>#${row.rank}</span>
              ${miniBadge(row.badge, row.teamName)}
              <strong>${escapeHtml(row.teamName)}</strong>
              <span class="muted small">${row.points} pts • ${row.played}j • SG ${row.goalDifference}</span>
            </article>
          `).join("") || `<p class="muted small">Classificacao indisponivel para esta competicao.</p>`}
        </div>
      </section>

      <section class="panel hidden" data-match-panel="caracteristicas">
        <div class="traits-grid">
          ${renderTraitColumn("Pontos fortes", traits.free.strengths)}
          ${renderTraitColumn("Pontos fracos", traits.free.weaknesses)}
          ${renderTraitColumn("Estilo de jogo", traits.free.style)}
        </div>
        <div class="traits-grid" style="margin-top:14px">
          ${renderTraitColumn("Momentos de atencao", traits.free.alerts)}
          ${premiumAccess ? renderTraitColumn("Casa", traits.homeScope.strengths.concat(traits.homeScope.weaknesses)) : premiumLockCard("Leitura casa", "A visao casa/fora fica bloqueada na versao premium.")}
          ${premiumAccess ? renderTraitColumn("Fora", traits.awayScope.strengths.concat(traits.awayScope.weaknesses)) : premiumLockCard("Leitura fora", "A visao casa/fora fica bloqueada na versao premium.")}
        </div>
      </section>

      <section class="panel hidden" data-match-panel="estatisticas">
        <div class="stats-grid">
          <article class="market-card"><h4>Estatisticas da partida</h4><div class="summary-list">${stats.map((item) => `<div class="market-row"><span>${escapeHtml(item.label)}</span><strong>${item.homeValue ?? "-"}</strong><span class="muted tiny">x</span><strong>${item.awayValue ?? "-"}</strong></div>`).join("") || `<p class="muted small">Sem estatisticas detalhadas nesta partida.</p>`}</div></article>
          ${renderMarketSection("Gols", marketStats.goals, premiumAccess)}
          ${renderMarketSection("Escanteios", marketStats.corners, premiumAccess)}
        </div>
        <div class="market-grid" style="margin-top:14px">
          ${renderMarketSection("Geral", marketStats.general, premiumAccess)}
          ${premiumAccess ? `<article class="market-card"><h4>Odds</h4><p class="muted small">A fonte atual nao entrega odds reais de casa. O bloco premium deixa o espaco pronto para integrar uma API de odds forte sem inventar dado.</p></article>` : premiumLockCard("Odds premium", "Quando a API de odds entrar, este bloco sera liberado na conta premium.")}
          ${premiumAccess ? `<article class="market-card"><h4>Score de confianca</h4><div class="summary-list"><div class="market-row"><span>Mandante</span><strong>${Math.max(48, (traits.homeScope.metrics.over15Pct || 50) + 8)}%</strong></div><div class="market-row"><span>Visitante</span><strong>${Math.max(48, (traits.awayScope.metrics.over15Pct || 50) + 8)}%</strong></div></div></article>` : premiumLockCard("Score premium", "A pontuacao automatica de confianca fica dentro da camada premium.") }
        </div>
      </section>
    </div>
  `;

  refs.detailDialog.showModal();
}

function bindTeamTabs() {
  refs.detailContent.querySelectorAll("[data-team-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.teamTab;
      refs.detailContent.querySelectorAll("[data-team-tab]").forEach((item) => item.classList.toggle("active", item === button));
      refs.detailContent.querySelectorAll("[data-team-panel]").forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.teamPanel !== tab);
      });
    });
  });
}

function bindMatchTabs() {
  refs.detailContent.querySelectorAll("[data-match-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.matchTab;
      refs.detailContent.querySelectorAll("[data-match-tab]").forEach((item) => item.classList.toggle("active", item === button));
      refs.detailContent.querySelectorAll("[data-match-panel]").forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.matchPanel !== tab);
      });
    });
  });
}

async function openTeam(teamId) {
  const payload = await apiFetch(`/api/platform/team/${encodeURIComponent(teamId)}`);
  state.selectedTeam = payload;
  renderTeamDetail(payload);
  bindTeamTabs();
}

async function openMatch(matchId) {
  const payload = await apiFetch(`/api/platform/match/${encodeURIComponent(matchId)}`);
  state.selectedMatch = payload;
  renderMatchDetail(payload);
  bindMatchTabs();
}

async function refreshSession() {
  state.session = await apiFetch("/api/platform/session");
  renderSessionCard();
}

async function submitLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const payload = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    saveToken(payload.token);
    await refreshSession();
    closeAuthDialog();
  } catch (error) {
    refs.authMessage.textContent = error.message;
  }
}

async function submitRegister(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const payload = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    saveToken(payload.token);
    await refreshSession();
    closeAuthDialog();
  } catch (error) {
    refs.authMessage.textContent = error.message;
  }
}

async function startPremium() {
  if (!state.session?.authenticated) {
    openAuthDialog("login");
    return;
  }

  const payload = await apiFetch("/api/subscriptions/premium/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  if (payload.checkoutUrl) {
    window.open(payload.checkoutUrl, "_blank", "noopener");
  }
  await refreshSession();
}

function bindGlobalClicks() {
  document.addEventListener("click", async (event) => {
    const authTarget = event.target.closest("[data-open-auth]");
    if (authTarget) {
      openAuthDialog(authTarget.dataset.openAuth);
      return;
    }

    if (event.target.closest("[data-logout]")) {
      saveToken("");
      await refreshSession();
      return;
    }

    if (event.target.closest("[data-refresh-premium]")) {
      await refreshSession();
      return;
    }

    if (event.target.closest("[data-start-premium]")) {
      await startPremium();
      return;
    }

    const teamCard = event.target.closest("[data-team-id]");
    if (teamCard) {
      await openTeam(teamCard.dataset.teamId);
      return;
    }

    const matchCard = event.target.closest("[data-match-id]");
    if (matchCard) {
      await openMatch(matchCard.dataset.matchId);
    }
  });
}

async function init() {
  syncAuthTabs();
  refs.authBtn.addEventListener("click", () => {
    if (state.session?.authenticated) {
      openAuthDialog("login");
    } else {
      openAuthDialog("login");
    }
  });
  refs.refreshBtn.addEventListener("click", loadHome);
  refs.closeAuthDialog.addEventListener("click", closeAuthDialog);
  refs.closeDetailDialog.addEventListener("click", () => refs.detailDialog.close());
  refs.searchInput.addEventListener("input", scheduleSearch);
  refs.loginForm.addEventListener("submit", submitLogin);
  refs.registerForm.addEventListener("submit", submitRegister);
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authTab = button.dataset.authTab;
      refs.authMessage.textContent = "";
      syncAuthTabs();
    });
  });
  bindGlobalClicks();

  await refreshSession();
  await loadHome();
}

init().catch((error) => {
  refs.highlightsGrid.innerHTML = `<article class="result-card"><p class="muted small">${escapeHtml(error.message)}</p></article>`;
});
