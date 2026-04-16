import {
  fetchCompetitionStandings,
  fetchTeamAnalysis
} from "./teamInsights";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function average(total, count) {
  if (!count) return null;
  return Number((total / count).toFixed(1));
}

function roundScore(value) {
  return Math.round(Number(value || 0));
}

function formatAverage(value) {
  return value === null || value === undefined ? "sem base" : String(Number(value).toFixed(1)).replace(".", ",");
}

function formatPercent(value) {
  return value === null || value === undefined ? "sem base" : `${roundScore(value)}%`;
}

function meanDefined(values) {
  const valid = values.filter((value) => typeof value === "number" && !Number.isNaN(value));
  if (!valid.length) return null;
  return average(valid.reduce((sum, value) => sum + value, 0), valid.length);
}

function decimalOddFromProbability(probability) {
  if (probability === null || probability === undefined || probability <= 0) {
    return null;
  }

  return Number((100 / Math.max(probability, 1)).toFixed(2));
}

function confidenceLabel(score) {
  if (score >= 82) return "Alta";
  if (score >= 66) return "Media";
  return "Baixa";
}

function classifyMarketBucket(score) {
  if (score >= 72) return "approved";
  if (score >= 58) return "doubtful";
  return "discarded";
}

function sumMomentRange(momentMap, buckets) {
  return (momentMap || [])
    .filter((item) => buckets.includes(item.bucket))
    .reduce(
      (acc, item) => {
        acc.scored += item.scored || 0;
        acc.conceded += item.conceded || 0;
        return acc;
      },
      { scored: 0, conceded: 0 }
    );
}

function buildConfrontMarket(label, probability, rationale, type, side = "match") {
  const roundedProbability = roundScore(probability);
  const confidenceScore = roundScore(
    clamp(
      (roundedProbability * 0.72) +
        (type === "goals" ? 9 : 6) +
        (type === "corners" ? 4 : 0) +
        (type === "cards" ? 3 : 0)
    )
  );

  return {
    label,
    type,
    side,
    probability: roundedProbability,
    confidenceScore,
    confidence: confidenceLabel(confidenceScore),
    bucket: classifyMarketBucket(confidenceScore),
    projectedOdd: decimalOddFromProbability(roundedProbability),
    rationale
  };
}

function buildComparisonSection(homeBundle, awayBundle) {
  const homeMetrics = homeBundle.metrics;
  const awayMetrics = awayBundle.metrics;
  const homePremium = homeBundle.premium;
  const awayPremium = awayBundle.premium;

  const homeLate = sumMomentRange(homePremium.momentMap, ["61-75", "76-90+"]);
  const awayLate = sumMomentRange(awayPremium.momentMap, ["61-75", "76-90+"]);

  return {
    attackVsDefense: `O mandante chega com media de ${formatAverage(homeMetrics.goalsForAvg)} gol e ${formatAverage(homeMetrics.shotsAvg)} finalizacoes, enquanto o visitante sofre ${formatAverage(awayMetrics.goalsAgainstAvg)} gol e cede ${formatAverage(awayMetrics.shotsAgainstAvg)} finalizacoes. Do outro lado, o visitante marca ${formatAverage(awayMetrics.goalsForAvg)} e encontra um mandante que sofre ${formatAverage(homeMetrics.goalsAgainstAvg)} por jogo.`,
    moments: `Nos minutos finais, o mandante soma ${homeLate.scored} gol(s) marcado(s) e ${homeLate.conceded} sofrido(s), contra ${awayLate.scored}/${awayLate.conceded} do visitante. Isso ajuda a medir quem cresce ou afunda na reta final.`,
    btts: `Ambas marcam aparece em ${formatPercent(homeMetrics.bttsPct)} da amostra do mandante e ${formatPercent(awayMetrics.bttsPct)} na do visitante. O encaixe real depende de o mandante marcar em ${formatPercent(homeMetrics.scoredPct)} e o visitante em ${formatPercent(awayMetrics.scoredPct)}.`,
    goalLines: `Over 1.5 bate em ${formatPercent(homeMetrics.over15Pct)} para o mandante e ${formatPercent(awayMetrics.over15Pct)} para o visitante. Over 2.5 aparece em ${formatPercent(homeMetrics.over25Pct)} e ${formatPercent(awayMetrics.over25Pct)}; under 3.5 fica protegido quando os overs de cada lado nao explodem ao mesmo tempo.`,
    corners: homeMetrics.cornersForAvg !== null && awayMetrics.cornersForAvg !== null
      ? `A soma das medias de escanteios produz ${formatAverage((homeMetrics.cornersForAvg || 0) + (awayMetrics.cornersForAvg || 0) + (homeMetrics.cornersAgainstAvg || 0) + (awayMetrics.cornersAgainstAvg || 0))} eventos de canto por jogo considerando a pressao dos dois lados.`
      : "A base atual nao trouxe escanteios suficientes dos dois lados para fechar uma leitura forte.",
    shots: homeMetrics.shotsAvg !== null && awayMetrics.shotsAvg !== null
      ? `O volume ofensivo combinado aponta ${formatAverage((homeMetrics.shotsAvg || 0) + (awayMetrics.shotsAvg || 0))} finalizacoes por jogo, com ${formatAverage((homeMetrics.onTargetAvg || 0) + (awayMetrics.onTargetAvg || 0))} no alvo.`
      : "Finalizacoes avancadas ainda estao incompletas para um comparativo cheio.",
    possession: homeMetrics.possessionAvg !== null && awayMetrics.possessionAvg !== null
      ? `O mandante trabalha com ${formatAverage(homeMetrics.possessionAvg)}% de posse e o visitante com ${formatAverage(awayMetrics.possessionAvg)}%. Isso mostra quem tende a ditar o ritmo e quem aceita mais transicao.`
      : "Posse de bola ainda nao tem base suficiente dos dois lados.",
    discipline: homeMetrics.cardsAvg !== null && awayMetrics.cardsAvg !== null
      ? `A intensidade disciplinar combina ${formatAverage((homeMetrics.cardsAvg || 0) + (awayMetrics.cardsAvg || 0))} cartoes por jogo na amostra com timeline.`
      : "A leitura de cartoes ainda nao tem cobertura completa dos dois lados.",
    handicap: `No score inteligente, o mandante tem ${homePremium.overallScore} pontos contra ${awayPremium.overallScore} do visitante. A diferenca de ${Math.abs(homePremium.overallScore - awayPremium.overallScore)} pontos sugere ${homePremium.overallScore >= awayPremium.overallScore ? "vantagem real do mandante" : "vantagem real do visitante"}, mas nao necessariamente valor em linha agressiva.`
  };
}

function buildMarketPool(homeBundle, awayBundle) {
  const home = homeBundle.metrics;
  const away = awayBundle.metrics;
  const homePremium = homeBundle.premium;
  const awayPremium = awayBundle.premium;
  const markets = [];

  const totalGoalsAvg = meanDefined([
    (home.goalsForAvg || 0) + (home.goalsAgainstAvg || 0),
    (away.goalsForAvg || 0) + (away.goalsAgainstAvg || 0)
  ]);

  const over15Probability = meanDefined([home.over15Pct, away.over15Pct, home.scoredPct, away.scoredPct]);
  if (over15Probability !== null) {
    markets.push(
      buildConfrontMarket(
        "Over 1.5 gols",
        clamp(over15Probability),
        `O mandante bate over 1.5 em ${formatPercent(home.over15Pct)} e o visitante em ${formatPercent(away.over15Pct)}. Ambos marcam com frequencia razoavel e a media combinada gira em ${formatAverage(totalGoalsAvg)} gols.`,
        "goals"
      )
    );
  }

  const over25Probability = meanDefined([home.over25Pct, away.over25Pct, home.bttsPct, away.bttsPct]);
  if (over25Probability !== null) {
    markets.push(
      buildConfrontMarket(
        "Over 2.5 gols",
        clamp(over25Probability),
        `O mercado depende de repeticao de jogo aberto. O mandante traz ${formatPercent(home.over25Pct)} de over 2.5 e o visitante ${formatPercent(away.over25Pct)}, com ambas marcam em ${formatPercent(home.bttsPct)} e ${formatPercent(away.bttsPct)}.`,
        "goals"
      )
    );
  }

  const under35Probability = meanDefined([
    home.over35Pct !== null ? 100 - home.over35Pct : null,
    away.over35Pct !== null ? 100 - away.over35Pct : null,
    home.cleanSheetPct,
    away.cleanSheetPct
  ]);
  if (under35Probability !== null) {
    markets.push(
      buildConfrontMarket(
        "Under 3.5 gols",
        clamp(under35Probability),
        `A protecao de under 3.5 ganha base quando os jogos acima de 3.5 nao se repetem. O mandante segura ${formatPercent(home.over35Pct !== null ? 100 - home.over35Pct : null)} de under 3.5 e o visitante ${formatPercent(away.over35Pct !== null ? 100 - away.over35Pct : null)}.`,
        "goals"
      )
    );
  }

  const bttsProbability = meanDefined([home.bttsPct, away.bttsPct, home.scoredPct, away.scoredPct, home.concededPct, away.concededPct]);
  if (bttsProbability !== null) {
    markets.push(
      buildConfrontMarket(
        "Ambas marcam - Sim",
        clamp(bttsProbability),
        `A combinacao depende de os dois lados marcarem com repeticao e tambem sofrerem. O mandante marca em ${formatPercent(home.scoredPct)} e sofre em ${formatPercent(home.concededPct)}; o visitante marca em ${formatPercent(away.scoredPct)} e sofre em ${formatPercent(away.concededPct)}.`,
        "goals"
      )
    );
  }

  const secondHalfGoalProbability = meanDefined([
    home.secondHalfGoalShare,
    away.secondHalfGoalShare,
    homePremium.momentMap.find((item) => item.bucket === "61-75")?.intensity,
    awayPremium.momentMap.find((item) => item.bucket === "76-90+")?.intensity
  ]);
  if (secondHalfGoalProbability !== null) {
    markets.push(
      buildConfrontMarket(
        "Gol no 2o tempo",
        clamp(secondHalfGoalProbability),
        `Os dois times concentram parte importante da producao depois do intervalo. O mandante gera ${formatPercent(home.secondHalfGoalShare)} dos gols no 2o tempo e o visitante ${formatPercent(away.secondHalfGoalShare)}.`,
        "goals"
      )
    );
  }

  const homeDoubleChanceProbability = meanDefined([
    home.pointsPct,
    home.homePointsPct,
    100 - away.awayPointsPct,
    homePremium.overallScore,
    100 - awayPremium.subscores.defense
  ]);
  if (homeDoubleChanceProbability !== null) {
    markets.push(
      buildConfrontMarket(
        `${homeBundle.team.name} ou empate`,
        clamp(homeDoubleChanceProbability),
        `O mandante sustenta ${formatPercent(home.homePointsPct)} dos pontos em casa, enquanto o visitante fora cai para ${formatPercent(away.awayPointsPct)}. O score inteligente favorece o mandante em ${homePremium.overallScore} x ${awayPremium.overallScore}.`,
        "result",
        "home"
      )
    );
  }

  const awayDoubleChanceProbability = meanDefined([
    away.pointsPct,
    away.awayPointsPct,
    100 - home.homePointsPct,
    awayPremium.overallScore,
    100 - homePremium.subscores.defense
  ]);
  if (awayDoubleChanceProbability !== null) {
    markets.push(
      buildConfrontMarket(
        `${awayBundle.team.name} ou empate`,
        clamp(awayDoubleChanceProbability),
        `O visitante fora soma ${formatPercent(away.awayPointsPct)} dos pontos e encara um mandante que nao domina todos os jogos em casa. A leitura so sobe quando o score do visitante realmente se aproxima ou supera o do mandante.`,
        "result",
        "away"
      )
    );
  }

  const cornersProbability = meanDefined([
    home.cornersForAvg !== null && home.cornersAgainstAvg !== null ? clamp(((home.cornersForAvg + home.cornersAgainstAvg) / 10) * 100) : null,
    away.cornersForAvg !== null && away.cornersAgainstAvg !== null ? clamp(((away.cornersForAvg + away.cornersAgainstAvg) / 10) * 100) : null
  ]);
  if (cornersProbability !== null) {
    markets.push(
      buildConfrontMarket(
        "Over 8.5 escanteios",
        clamp(cornersProbability),
        `Os jogos do mandante geram ${formatAverage((home.cornersForAvg || 0) + (home.cornersAgainstAvg || 0))} cantos em media, e os do visitante ${formatAverage((away.cornersForAvg || 0) + (away.cornersAgainstAvg || 0))}.`,
        "corners"
      )
    );
  }

  const cardsProbability = meanDefined([
    home.cardsAvg !== null ? clamp(home.cardsAvg * 24) : null,
    away.cardsAvg !== null ? clamp(away.cardsAvg * 24) : null
  ]);
  if (cardsProbability !== null) {
    markets.push(
      buildConfrontMarket(
        "Over 3.5 cartoes",
        clamp(cardsProbability),
        `A amostra com timeline aponta ${formatAverage(home.cardsAvg)} cartoes por jogo do mandante e ${formatAverage(away.cardsAvg)} do visitante.`,
        "cards"
      )
    );
  }

  const shotsProbability = meanDefined([
    home.shotsAvg !== null ? clamp((home.shotsAvg / 14) * 100) : null,
    away.shotsAvg !== null ? clamp((away.shotsAvg / 14) * 100) : null,
    home.onTargetAvg !== null ? clamp((home.onTargetAvg / 5) * 100) : null,
    away.onTargetAvg !== null ? clamp((away.onTargetAvg / 5) * 100) : null
  ]);
  if (shotsProbability !== null) {
    markets.push(
      buildConfrontMarket(
        "Over finalizacoes no jogo",
        clamp(shotsProbability),
        `O volume ofensivo soma ${formatAverage((home.shotsAvg || 0) + (away.shotsAvg || 0))} finalizacoes e ${formatAverage((home.onTargetAvg || 0) + (away.onTargetAvg || 0))} no alvo por partida na amostra avancada.`,
        "shots"
      )
    );
  }

  return markets
    .map((market) => {
      const coverageBoost =
        (homeBundle.sample.total >= 8 ? 3 : -4) +
        (awayBundle.sample.total >= 8 ? 3 : -4);
      const confidenceScore = roundScore(clamp(market.confidenceScore + coverageBoost));

      return {
        ...market,
        confidenceScore,
        confidence: confidenceLabel(confidenceScore),
        bucket: classifyMarketBucket(confidenceScore)
      };
    })
    .sort((left, right) => right.confidenceScore - left.confidenceScore || right.probability - left.probability);
}

function buildTicket(topBets) {
  if (!topBets.length) {
    return null;
  }

  const candidates = [];

  for (let i = 0; i < topBets.length; i += 1) {
    for (let j = i + 1; j < topBets.length; j += 1) {
      const pair = [topBets[i], topBets[j]];
      const projectedOdd = Number((pair[0].projectedOdd * pair[1].projectedOdd).toFixed(2));
      const confidence = roundScore(meanDefined(pair.map((item) => item.confidenceScore)) || 0);
      candidates.push({
        picks: pair,
        projectedOdd,
        confidence,
        inRange: projectedOdd >= 2 && projectedOdd <= 3
      });
    }
  }

  for (let i = 0; i < topBets.length; i += 1) {
    for (let j = i + 1; j < topBets.length; j += 1) {
      for (let k = j + 1; k < topBets.length; k += 1) {
        const triple = [topBets[i], topBets[j], topBets[k]];
        const projectedOdd = Number((triple[0].projectedOdd * triple[1].projectedOdd * triple[2].projectedOdd).toFixed(2));
        const confidence = roundScore(meanDefined(triple.map((item) => item.confidenceScore)) || 0);
        candidates.push({
          picks: triple,
          projectedOdd,
          confidence,
          inRange: projectedOdd >= 2 && projectedOdd <= 3
        });
      }
    }
  }

  const sorted = candidates.sort((left, right) => {
    if (left.inRange !== right.inRange) return left.inRange ? -1 : 1;
    const leftDistance = Math.abs(left.projectedOdd - 2.4);
    const rightDistance = Math.abs(right.projectedOdd - 2.4);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return right.confidence - left.confidence;
  });

  const best = sorted[0];
  if (!best) return null;

  return {
    picks: best.picks,
    projectedOdd: best.projectedOdd,
    confidence: best.confidence,
    risk: best.confidence >= 80 ? "Baixo" : best.confidence >= 68 ? "Controlado" : "Moderado",
    rationale: best.inRange
      ? `Combinacao montada para ficar na faixa de odd-modelo ${best.projectedOdd}, priorizando confianca media de ${best.confidence}%.`
      : `Nenhuma combinacao ficou exatamente entre 2.0 e 3.0, entao a engine priorizou a composicao de menor risco com odd-modelo ${best.projectedOdd}.`
  };
}

function buildExecutiveSummary(match, homeBundle, awayBundle, approvedMarkets) {
  const homePremium = homeBundle.premium;
  const awayPremium = awayBundle.premium;
  const strongerSide = homePremium.overallScore >= awayPremium.overallScore ? homeBundle.team.name : awayBundle.team.name;
  const scoreGap = Math.abs(homePremium.overallScore - awayPremium.overallScore);

  return `Confronto entre ${match.homeTeam} e ${match.awayTeam} com base real dos ultimos ${homeBundle.sample.total} jogos do mandante e ${awayBundle.sample.total} do visitante. A vantagem estatistica atual aponta para ${strongerSide}, com gap de ${scoreGap} pontos no score inteligente. Os mercados mais limpos hoje sao ${approvedMarkets.slice(0, 3).map((item) => item.label).join(", ") || "nenhum mercado forte o suficiente"}.`;
}

export async function fetchMatchIntelligence({
  match,
  sampleSize = 10
}) {
  if (!match?.id) {
    throw new Error("Partida nao informada.");
  }

  const [homeBundle, awayBundle, standings] = await Promise.all([
    fetchTeamAnalysis({
      teamId: match.homeTeamId,
      teamName: match.homeTeam,
      teamBadge: match.homeBadge,
      leagueId: match.leagueId,
      competition: match.competition,
      season: match.season,
      referenceDate: match.date,
      excludeEventId: match.id,
      sampleSize
    }),
    fetchTeamAnalysis({
      teamId: match.awayTeamId,
      teamName: match.awayTeam,
      teamBadge: match.awayBadge,
      leagueId: match.leagueId,
      competition: match.competition,
      season: match.season,
      referenceDate: match.date,
      excludeEventId: match.id,
      sampleSize
    }),
    fetchCompetitionStandings({
      leagueId: match.leagueId,
      season: match.season,
      referenceDate: match.date,
      focusTeamIds: [match.homeTeamId, match.awayTeamId],
      focusTeamNames: [match.homeTeam, match.awayTeam]
    }).catch(() => [])
  ]);

  const comparison = buildComparisonSection(homeBundle, awayBundle);
  const marketPool = buildMarketPool(homeBundle, awayBundle);
  const approvedMarkets = marketPool.filter((item) => item.bucket === "approved");
  const doubtfulMarkets = marketPool.filter((item) => item.bucket === "doubtful");
  const discardedMarkets = marketPool.filter((item) => item.bucket === "discarded");
  const topBets = approvedMarkets.slice(0, 3);
  const ticket = buildTicket(topBets);
  const matchConfidence = roundScore(meanDefined(topBets.map((item) => item.confidenceScore)) || meanDefined(marketPool.map((item) => item.confidenceScore)) || 0);

  const reading = [
    comparison.attackVsDefense,
    comparison.goalLines,
    comparison.corners,
    comparison.discipline,
    comparison.handicap
  ];

  const conclusion = topBets.length
    ? `A leitura final aprova ${topBets.length} mercado(s) com sustentacao estatistica real. O foco deve ficar em ${topBets.map((item) => item.label).join(", ")}. Mercados sem repeticao suficiente foram mantidos como duvidosos ou descartados.`
    : "Nao ha base estatistica forte o bastante para aprovar apostas com seguranca neste confronto. O correto aqui e descartar o jogo ate entrar mais dado real.";

  return {
    match: {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      competition: match.competition,
      stage: match.stage || "",
      date: match.date,
      kickoff: match.kickoff
    },
    generatedFrom: {
      sampleSize,
      homeSample: homeBundle.sample.total,
      awaySample: awayBundle.sample.total,
      standingsRows: standings.length
    },
    confidence: {
      score: matchConfidence,
      label: confidenceLabel(matchConfidence),
      reason: "A confianca combina cobertura de amostra, repeticao dos mercados aprovados e consistencia dos dois lados."
    },
    executiveSummary: buildExecutiveSummary(match, homeBundle, awayBundle, approvedMarkets),
    home: homeBundle,
    away: awayBundle,
    standings,
    comparison,
    reading,
    markets: {
      approved: approvedMarkets,
      doubtful: doubtfulMarkets,
      discarded: discardedMarkets
    },
    topBets,
    ticket,
    conclusion
  };
}
