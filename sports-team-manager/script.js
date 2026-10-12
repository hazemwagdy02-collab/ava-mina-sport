const ENTRY_FEE = 5;
const MAX_ENTRIES = 50;

const STORAGE_KEYS = {
  tournament: "avaMinaTournament",
  reports: "avaMinaReports",
  theme: "avaMinaTheme",
};

let tournament = null;
let reports = { tournament: null };
let viewHistory = [];
let activeWinnerContext = null;
let toastTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36).slice(-5)}`;
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shuffleArray(arr) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function formatDate(value) {
  if (!value) return "بدون تاريخ";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2500);
}

function showView(viewId, options = {}) {
  const active = $(".view.active");
  if (active && active.id !== viewId && options.pushHistory !== false) {
    viewHistory.push(active.id);
  }

  $$(".view").forEach(view => view.classList.remove("active"));
  const nextView = document.getElementById(viewId);
  if (!nextView) return;
  nextView.classList.add("active");

  const title = nextView.dataset.title || "إدارة الدوري";
  $("#pageTitle").textContent = title;
  $("#backBtn").classList.toggle("hidden", viewId === "homeView");

  if (viewId === "homeView") renderHome();
  if (viewId === "tournamentView") renderTournament();
  if (viewId === "reportsView") renderReports();

  $$(".bottom-nav button").forEach(btn => btn.classList.remove("active"));
  let navTarget = viewId;
  if (viewId === "tournamentSetupView" || (viewId === "reportDetailView" && $("#reportDetail")?.dataset.type === "tournament")) {
    navTarget = "tournamentView";
  }
  const btn = $(`.bottom-nav button[data-nav="${navTarget}"]`);
  if (btn) btn.classList.add("active");
}

function goBack() {
  const previous = viewHistory.pop();
  showView(previous || "homeView", { pushHistory: false });
}

function renderHome() {
  // الصفحة الرئيسية بسيطة عمدًا: زر واحد فقط لإنشاء الدوري.
}

function makeDynamicRow(type, value = "") {
  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = `
    <input type="text" maxlength="60" placeholder="${type === "player" ? "اسم اللاعب" : "الاسم"}" value="${escapeHTML(value)}" autocomplete="off" />
    <button class="remove-row-btn" type="button" aria-label="حذف">🗑️</button>`;

  row.querySelector("input").addEventListener("input", () => updateSetupCounters(type));
  row.querySelector(".remove-row-btn").addEventListener("click", () => {
    const container = $("#playersInputs");
    if (container.children.length === 1) {
      row.querySelector("input").value = "";
    } else {
      row.remove();
    }
    updateSetupCounters(type);
  });

  return row;
}

function addPlayer() {
  const container = $("#playersInputs");
  if (container.children.length >= MAX_ENTRIES) {
    showToast("الحد الأقصى 50 لاعبًا");
    return;
  }
  container.appendChild(makeDynamicRow("player"));
  container.lastElementChild.querySelector("input").focus();
  updateSetupCounters("player");
}

function removePlayer(index) {
  const rows = $$("#playersInputs .dynamic-row");
  if (rows[index]) rows[index].querySelector(".remove-row-btn").click();
}

function getInputValues(containerSelector) {
  return $$(containerSelector + " input")
    .map(input => input.value.trim())
    .filter(Boolean);
}

function updateSetupCounters(type) {
  if (type !== "player") return;
  const count = getInputValues("#playersInputs").length;
  $("#playerCountBadge").textContent = `${count} / ${MAX_ENTRIES}`;
  $("#tournamentPlayerCount").textContent = count;
  $("#tournamentTotalFees").textContent = `${count * ENTRY_FEE} جنيه`;
}

function prepareTournamentSetup() {
  $("#tournamentName").value = "";
  $("#tournamentDate").value = "";
  $("#playersInputs").innerHTML = "";
  $("#playersInputs").appendChild(makeDynamicRow("player"));
  updateSetupCounters("player");
  showView("tournamentSetupView");
}

function createTournament() {
  const names = getInputValues("#playersInputs");
  if (names.length < 2) {
    showToast("أدخل لاعبين على الأقل لإنشاء الدوري");
    return;
  }

  const normalized = names.map(n => n.toLowerCase());
  if (new Set(normalized).size !== names.length) {
    showToast("يوجد أسماء لاعبين مكررة");
    return;
  }

  const players = names.map(name => ({ id: uid("p"), name }));
  tournament = {
    id: uid("tournament"),
    name: $("#tournamentName").value.trim(),
    date: $("#tournamentDate").value,
    players,
    rounds: [],
    champion: null,
    entryFee: ENTRY_FEE,
    totalMoney: players.length * ENTRY_FEE,
    createdAt: new Date().toISOString(),
  };

  const shuffledIds = shuffleArray(players.map(player => player.id));
  tournament.rounds.push(createKnockoutRound(shuffledIds, 0, null));
  saveTournament();
  showView("tournamentView");
  showToast("تم إنشاء قرعة الدوري");
}

function nextPowerOfTwo(n) {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

function getRoundName(participantCount) {
  const size = nextPowerOfTwo(participantCount);
  if (size <= 2) return "النهائي";
  if (size === 4) return "نصف النهائي";
  if (size === 8) return "ربع النهائي";
  if (size === 16) return "دور الـ16";
  if (size === 32) return "دور الـ32";
  return `دور الـ${size}`;
}

function createKnockoutRound(participantIds, roundIndex, recentByePlayerId) {
  let ordered = [...participantIds];

  if (recentByePlayerId && ordered.includes(recentByePlayerId)) {
    ordered = [recentByePlayerId, ...ordered.filter(id => id !== recentByePlayerId)];
  }

  let byePlayerId = null;
  if (ordered.length % 2 === 1) {
    const candidates = ordered.filter(id => id !== recentByePlayerId);
    const pool = candidates.length ? candidates : ordered;
    byePlayerId = pool[Math.floor(Math.random() * pool.length)];
    ordered = ordered.filter(id => id !== byePlayerId);
  }

  const matches = [];
  for (let i = 0; i < ordered.length; i += 2) {
    matches.push({
      id: uid("match"),
      player1Id: ordered[i],
      player2Id: ordered[i + 1],
      winnerId: null,
      status: "pending",
      bye: false,
    });
  }

  if (byePlayerId) {
    matches.push({
      id: uid("match"),
      player1Id: byePlayerId,
      player2Id: null,
      winnerId: byePlayerId,
      status: "done",
      bye: true,
    });
  }

  return {
    id: uid("round"),
    index: roundIndex,
    name: getRoundName(participantIds.length),
    participantCount: participantIds.length,
    byePlayerId,
    matches,
  };
}

function findPlayer(playerId) {
  return tournament?.players.find(player => player.id === playerId) || null;
}

function roundIsComplete(round) {
  return round.matches.every(match => !!match.winnerId);
}

function syncTournamentProgressFrom(roundIndex) {
  tournament.rounds = tournament.rounds.slice(0, roundIndex + 1);
  tournament.champion = null;

  const round = tournament.rounds[roundIndex];
  if (!round || !roundIsComplete(round)) {
    saveTournament();
    return;
  }

  const winners = round.matches.map(match => match.winnerId);
  if (winners.length === 1) {
    tournament.champion = winners[0];
    saveTournament();
    return;
  }

  tournament.rounds.push(createKnockoutRound(winners, roundIndex + 1, round.byePlayerId));
  saveTournament();
}

function selectWinner(roundIndex, matchId, winnerId, options = {}) {
  const round = tournament?.rounds?.[roundIndex];
  if (!round) return;

  const match = round.matches.find(item => item.id === matchId);
  if (!match || match.bye) return;
  if (![match.player1Id, match.player2Id].includes(winnerId)) return;

  const hasDownstream = tournament.rounds.length > roundIndex + 1;
  if (hasDownstream && !options.skipConfirm) {
    const ok = confirm("تعديل هذه النتيجة سيعيد إنشاء الأدوار التالية ويحذف نتائجها الحالية. هل تريد المتابعة؟");
    if (!ok) return;
  }

  match.winnerId = winnerId;
  match.status = "done";
  syncTournamentProgressFrom(roundIndex);
  closeWinnerSheet();
  renderTournament();
}

function resetMatchResult(roundIndex, matchId) {
  const round = tournament?.rounds?.[roundIndex];
  const match = round?.matches.find(item => item.id === matchId);
  if (!match || match.bye) return;

  if (tournament.rounds.length > roundIndex + 1) {
    const ok = confirm("سيتم حذف نتائج الأدوار التالية لإعادة ربط القرعة بشكل صحيح. هل تريد المتابعة؟");
    if (!ok) return;
  }

  match.winnerId = null;
  match.status = "pending";
  tournament.rounds = tournament.rounds.slice(0, roundIndex + 1);
  tournament.champion = null;
  saveTournament();
  renderTournament();
  showToast("يمكنك الآن اختيار الفائز من جديد");
}

function openWinnerSheet(roundIndex, matchId, selectedPlayerId) {
  const round = tournament?.rounds?.[roundIndex];
  const match = round?.matches.find(item => item.id === matchId);
  if (!match || match.bye) return;

  const selected = findPlayer(selectedPlayerId);
  const opponentId = match.player1Id === selectedPlayerId ? match.player2Id : match.player1Id;
  const opponent = findPlayer(opponentId);

  activeWinnerContext = { roundIndex, matchId, selectedPlayerId, opponentId };
  $("#winnerSheetContent").innerHTML = `
    <div class="sheet-title">
      <h3>${escapeHTML(selected?.name || "اللاعب")}</h3>
      <p>اختر النتيجة أمام ${escapeHTML(opponent?.name || "الخصم")}</p>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-success btn-xl" data-sheet-action="win">✅ فوز — يتأهل ${escapeHTML(selected?.name || "")}</button>
      <button class="btn btn-danger-soft btn-xl" data-sheet-action="eliminate">❌ إقصاء — يتأهل ${escapeHTML(opponent?.name || "")}</button>
      <button class="btn btn-ghost btn-xl" data-sheet-action="close">إلغاء</button>
    </div>`;

  $("#bottomSheetBackdrop").classList.remove("hidden");
  $("#winnerSheet").classList.remove("hidden");
}

function closeWinnerSheet() {
  activeWinnerContext = null;
  $("#bottomSheetBackdrop").classList.add("hidden");
  $("#winnerSheet").classList.add("hidden");
}

function renderTournament() {
  const header = $("#tournamentHeader");
  const progress = $("#tournamentProgress");
  const container = $("#tournamentRounds");

  if (!tournament) {
    header.innerHTML = `
      <div class="title-row">
        <div class="activity-icon">🏆</div>
        <div>
          <h2>لا يوجد دوري حالي</h2>
          <p>أنشئ دوريًا جديدًا للبدء.</p>
        </div>
      </div>
      <button class="btn btn-primary full" style="margin-top:14px" data-action="new-tournament">إنشاء دوري</button>`;
    progress.innerHTML = "";
    container.innerHTML = "";
    return;
  }

  const champion = tournament.champion ? findPlayer(tournament.champion) : null;
  header.innerHTML = `
    <div class="title-row">
      <div class="activity-icon">🏆</div>
      <div>
        <h2>${escapeHTML(tournament.name || "الدوري")}</h2>
        <p>${formatDate(tournament.date)}</p>
      </div>
    </div>
    <div class="summary-chips">
      <span class="summary-chip"><strong>${tournament.players.length}</strong> لاعب</span>
      <span class="summary-chip"><strong>${tournament.totalMoney}</strong> جنيه</span>
      <span class="summary-chip">${champion ? `البطل: <strong>${escapeHTML(champion.name)}</strong>` : "قيد التقدم"}</span>
    </div>`;

  const currentRoundIndex = tournament.champion
    ? tournament.rounds.length - 1
    : tournament.rounds.findIndex(round => !roundIsComplete(round));

  progress.innerHTML = tournament.rounds.map((round, index) => {
    const done = roundIsComplete(round);
    const cls = done ? "done" : (index === currentRoundIndex ? "current" : "");
    return `<span class="progress-step ${cls}">${escapeHTML(round.name)}</span>`;
  }).join("");

  const roundsHTML = tournament.rounds.map((round, roundIndex) => {
    const normalMatches = round.matches.filter(match => !match.bye);
    const byeMatch = round.matches.find(match => match.bye);
    return `
      <section class="round-card">
        <header>
          <h3>${escapeHTML(round.name)}</h3>
          <span>${round.participantCount} مشارك</span>
        </header>
        <div class="matches-list">
          ${normalMatches.map((match, matchNumber) => renderTournamentMatch(match, roundIndex, matchNumber + 1)).join("")}
          ${byeMatch ? renderByeMatch(byeMatch) : ""}
        </div>
      </section>`;
  }).join("");

  const championHTML = champion ? `
    <section class="champion-card">
      <div class="confetti"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="trophy">🏆</div>
      <h3>بطل الدوري</h3>
      <strong>${escapeHTML(champion.name)}</strong>
    </section>` : "";

  container.innerHTML = roundsHTML + championHTML;
}

function renderTournamentMatch(match, roundIndex, matchNumber) {
  const player1 = findPlayer(match.player1Id);
  const player2 = findPlayer(match.player2Id);
  const done = !!match.winnerId;
  const p1Winner = match.winnerId === match.player1Id;
  const p2Winner = match.winnerId === match.player2Id;

  return `
    <article class="match-card ${done ? "done" : ""}">
      <div class="match-label"><span>مباراة ${matchNumber}</span><span>${done ? "✅ انتهت" : "⏳ لم تبدأ"}</span></div>
      <button class="match-player ${p1Winner ? "winner" : done ? "loser" : ""}" data-pick-winner="${player1?.id}" data-round-index="${roundIndex}" data-match-id="${match.id}" ${done ? "disabled" : ""}>
        <strong>${escapeHTML(player1?.name || "—")}</strong>
        <span class="player-state">${p1Winner ? "✅ متأهل" : done ? "❌ تم الإقصاء" : "اختيار"}</span>
      </button>
      <div class="vs">VS</div>
      <button class="match-player ${p2Winner ? "winner" : done ? "loser" : ""}" data-pick-winner="${player2?.id}" data-round-index="${roundIndex}" data-match-id="${match.id}" ${done ? "disabled" : ""}>
        <strong>${escapeHTML(player2?.name || "—")}</strong>
        <span class="player-state">${p2Winner ? "✅ متأهل" : done ? "❌ تم الإقصاء" : "اختيار"}</span>
      </button>
      ${done ? `<button class="edit-result" data-edit-match="${match.id}" data-round-index="${roundIndex}">تعديل النتيجة</button>` : ""}
    </article>`;
}

function renderByeMatch(match) {
  const player = findPlayer(match.player1Id);
  return `
    <article class="match-card bye">
      <div class="match-label"><span>تأهل مباشر</span><span>BYE</span></div>
      <div class="bye-player">
        <strong>${escapeHTML(player?.name || "—")}</strong>
        <span>متأهل تلقائيًا ✅</span>
      </div>
    </article>`;
}

function saveTournament() {
  if (tournament) saveJSON(STORAGE_KEYS.tournament, tournament);
}

function loadTournament() {
  tournament = loadJSON(STORAGE_KEYS.tournament, null);
  return tournament;
}

function resetTournament() {
  if (!tournament) return;
  const ok = confirm("هل تريد حذف الدوري الحالي وكل نتائجه؟");
  if (!ok) return;
  tournament = null;
  localStorage.removeItem(STORAGE_KEYS.tournament);
  renderHome();
  showView("homeView");
  showToast("تم حذف الدوري");
}

function generateTournamentReport() {
  if (!tournament) return null;

  const championName = tournament.champion ? findPlayer(tournament.champion)?.name || null : null;
  const report = {
    type: "tournament",
    generatedAt: new Date().toISOString(),
    name: tournament.name || "دوري بدون اسم",
    date: tournament.date,
    participants: tournament.players.length,
    entryFee: tournament.entryFee,
    totalMoney: tournament.totalMoney,
    matchCount: tournament.players.length - 1,
    champion: championName,
    players: tournament.players.map(player => player.name),
  };

  reports.tournament = report;
  saveJSON(STORAGE_KEYS.reports, reports);
  return report;
}

function renderReports() {
  reports = loadJSON(STORAGE_KEYS.reports, reports || { tournament: null });
  const report = reports.tournament;

  $("#reportsList").innerHTML = report ? `
    <article class="report-card">
      <h3>🏆 ${escapeHTML(report.name)}</h3>
      <p>${report.participants} لاعب • ${report.champion ? `البطل: ${escapeHTML(report.champion)}` : "الدوري لم يكتمل وقت التقرير"}</p>
      <button class="btn btn-secondary" data-open-report="tournament">فتح التقرير</button>
    </article>` : `
    <article class="report-card empty">
      لا يوجد تقرير دوري محفوظ حتى الآن.
    </article>`;
}

function openReport(report) {
  if (!report) return;
  const detail = $("#reportDetail");
  detail.dataset.type = report.type;
  detail.innerHTML = renderTournamentReport(report);
  showView("reportDetailView");
}

function renderTournamentReport(report) {
  return `
    <div class="report-sheet">
      <section class="report-title">
        <div class="big-icon">🏆</div>
        <h2>تقرير ${escapeHTML(report.name)}</h2>
        <p>${formatDate(report.date)}</p>
      </section>

      <section class="report-section">
        <h3>ملخص الدوري</h3>
        <div class="report-kv">
          <div><span>عدد المشاركين</span><strong>${report.participants}</strong></div>
          <div><span>رسوم الفرد</span><strong>${report.entryFee} جنيه</strong></div>
          <div><span>إجمالي الاشتراكات</span><strong>${report.totalMoney} جنيه</strong></div>
          <div><span>عدد المباريات</span><strong>${report.matchCount}</strong></div>
          <div><span>البطل</span><strong>${report.champion ? `🏆 ${escapeHTML(report.champion)}` : "لم يُحسم بعد"}</strong></div>
          <div><span>تاريخ التقرير</span><strong>${formatDate(report.generatedAt)}</strong></div>
        </div>
      </section>

      <section class="report-section">
        <h3>قائمة اللاعبين</h3>
        <div class="report-list-items">
          ${report.players.map((player, index) => `<div class="report-list-item">${index + 1}. ${escapeHTML(player)}</div>`).join("")}
        </div>
      </section>
    </div>`;
}

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  $("#themeBtn").textContent = theme === "light" ? "🌙" : "☀️";
  saveJSON(STORAGE_KEYS.theme, theme);
}

function toggleTheme() {
  applyTheme(document.body.classList.contains("light") ? "dark" : "light");
}

document.addEventListener("click", event => {
  const actionEl = event.target.closest("[data-action]");
  if (actionEl) {
    const action = actionEl.dataset.action;

    if (action === "new-tournament") {
      if (tournament && !confirm("يوجد دوري محفوظ حاليًا. إنشاء دوري جديد سيستبدله. هل تريد المتابعة؟")) return;
      prepareTournamentSetup();
    }
    if (action === "resume-tournament") {
      if (!tournament) {
        prepareTournamentSetup();
      } else {
        showView("tournamentView");
      }
    }
    if (action === "reset-tournament") resetTournament();
    if (action === "tournament-report") {
      const report = generateTournamentReport();
      if (!report) {
        showToast("لا يوجد دوري لإنشاء تقرير له");
        return;
      }
      openReport(report);
    }
  }

  const nav = event.target.closest("[data-nav]");
  if (nav) {
    const target = nav.dataset.nav;
    if (target === "tournamentView" && !tournament) prepareTournamentSetup();
    else showView(target);
  }

  const pick = event.target.closest("[data-pick-winner]");
  if (pick && !pick.disabled) {
    openWinnerSheet(Number(pick.dataset.roundIndex), pick.dataset.matchId, pick.dataset.pickWinner);
  }

  const edit = event.target.closest("[data-edit-match]");
  if (edit) {
    resetMatchResult(Number(edit.dataset.roundIndex), edit.dataset.editMatch);
  }

  const openSavedReport = event.target.closest("[data-open-report]");
  if (openSavedReport) {
    const report = reports[openSavedReport.dataset.openReport];
    if (report) openReport(report);
  }

  const sheetAction = event.target.closest("[data-sheet-action]");
  if (sheetAction && activeWinnerContext) {
    const { roundIndex, matchId, selectedPlayerId, opponentId } = activeWinnerContext;
    if (sheetAction.dataset.sheetAction === "win") selectWinner(roundIndex, matchId, selectedPlayerId);
    if (sheetAction.dataset.sheetAction === "eliminate") selectWinner(roundIndex, matchId, opponentId);
    if (sheetAction.dataset.sheetAction === "close") closeWinnerSheet();
  }
});

$("#addPlayerBtn").addEventListener("click", addPlayer);
$("#createTournamentBtn").addEventListener("click", createTournament);
$("#themeBtn").addEventListener("click", toggleTheme);
$("#backBtn").addEventListener("click", goBack);
$("#bottomSheetBackdrop").addEventListener("click", closeWinnerSheet);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeWinnerSheet();
});

(function init() {
  reports = loadJSON(STORAGE_KEYS.reports, { tournament: null }) || { tournament: null };
  loadTournament();
  applyTheme(loadJSON(STORAGE_KEYS.theme, "dark") || "dark");
  renderHome();
  showView("homeView", { pushHistory: false });
})();

window.appDebug = {
  addPlayer,
  removePlayer,
  shuffleArray,
  createTournament,
  createKnockoutRound,
  selectWinner,
  generateTournamentReport,
  loadTournament,
  saveTournament,
  resetTournament,
};
