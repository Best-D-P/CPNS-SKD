let fullTrendSeriesMode = "ALL";
let focusTrendSeriesMode = "ALL";

function formatShortDate(raw) {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isFocusOrDrillMode(modeStr) {
  const m = String(modeStr || "").toLowerCase();
  return m.includes("fokus") || m.includes("ulangi");
}

function getActiveUserFilterName() {
  if (typeof loggedUser !== "undefined" && loggedUser && loggedUser.nama) {
    return loggedUser.nama.trim();
  }
  const inputVal = (document.getElementById("participantNameInput")?.value || "").trim();
  return inputVal;
}

function getExamHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function getBackupExamHistory() {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function updateRestoreHistoryButtons() {
  const hasBackup = getBackupExamHistory().length > 0;
  document.querySelectorAll(".restore-history-btn").forEach(btn => {
    btn.classList.toggle("hidden", !hasBackup);
  });
}

function saveAttemptToHistory(attemptRecord) {
  const history = getExamHistory();
  history.unshift(attemptRecord);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 150)));
}

function clearLocalExamHistory() {
  const current = getExamHistory();
  if (!current.length) {
    alert("Riwayat lokal memang sudah kosong.");
    updateRestoreHistoryButtons();
    return;
  }
  if (!confirm("Hapus riwayat ujian lokal di browser ini? Cadangan sementara akan disimpan agar bisa dipulihkan jika terlanjur terhapus.")) {
    return;
  }

  localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify(current.slice(0, 150)));
  localStorage.removeItem(HISTORY_STORAGE_KEY);

  updateRestoreHistoryButtons();
  renderAttemptHistory();
  renderDashboardUserPreviousExams();
  renderUserScoreTrendChart();
  refreshDashboardData();
}

function restoreClearedExamHistory() {
  const backup = getBackupExamHistory();
  if (!backup.length) {
    alert("Tidak ada cadangan riwayat lokal yang bisa dipulihkan.");
    return;
  }

  const existing = getExamHistory();
  const merged = [...existing];
  const seenIds = new Set(existing.map(x => x.id));

  backup.forEach(item => {
    if (item && item.id && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      merged.push(item);
    }
  });

  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(merged.slice(0, 150)));
  localStorage.removeItem(BACKUP_HISTORY_STORAGE_KEY);

  updateRestoreHistoryButtons();
  renderAttemptHistory();
  renderDashboardUserPreviousExams();
  renderUserScoreTrendChart();
  refreshDashboardData();
  alert("Berhasil mengembalikan " + backup.length + " sesi riwayat ujian lokal.");
}

function mapRekapRowToSession(rec, idx) {
  const keyPart = `${normalizeAccountKey(rec.nama)}_${rec.total}_${String(rec.waktu || idx).replace(/\W+/g, "")}`;
  return {
    id: `db_${keyPart}`, nama: rec.nama \vert{}\vert{} "Peserta", formasi: rec.formasi \vert{}\vert{} "-", instansi: rec.instansi \vert{}\vert{} "-", mode: rec.mode \vert{}\vert{} "Reguler", twk: Number(rec.twk \vert{}\vert{} 0), tiu: Number(rec.tiu \vert{}\vert{} 0), tkp: Number(rec.tkp \vert{}\vert{} 0), total: Number(rec.total \vert{}\vert{} 0), status_pg: rec.status_pg \vert{}\vert{} "-", warning: rec.warning \vert{}\vert{} "Normal", waktuLabel: formatShortDate(rec.waktu), questions: [], answers: [], durations: [], fromDatabase: true }; }  async function syncHistoryFromDatabaseIfEmpty() { const localHistory = getExamHistory(); if (localHistory.length > 0) return localHistory; if (!GOOGLE_SCRIPT_URL \vert{}\vert{} GOOGLE_SCRIPT_URL.includes("TEMPEL_URL")) return [];  try { const res = await fetch(`${GOOGLE_SCRIPT_URL}?mode=rekap`);
    const json = await res.json();
    if (json && json.status === "sukses" && Array.isArray(json.rekap) && json.rekap.length > 0) {
      const seenIds = new Set();
      const mapped = [];
      json.rekap.slice().reverse().forEach((r, i) => {
        const item = mapRekapRowToSession(r, i);
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          mapped.push(item);
        }
      });
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(mapped.slice(0, 150)));
      return mapped;
    }
  } catch (err) {
    console.warn("Gagal memuat riwayat dari database:", err);
  }
  return [];
}

function loadAttemptIntoReview(attemptId) {
  const history = getExamHistory();
  const found = history.find(h => h.id === attemptId);
  if (!found) return;

  if (!Array.isArray(found.questions) || found.questions.length === 0) {
    alert(
      `Sesi ${found.nama} (${found.waktuLabel || "-"}) berasal dari rekap database — Total Skor: ${found.total} ` +
      `(TWK ${found.twk} \vert{} TIU${found.tiu} | TKP ${found.tkp} •${found.status_pg}). ` +
      "Rincian pembahasan per butir soal hanya tersimpan untuk sesi yang dikerjakan di browser ini."
    );
    return;
  }

  reviewQuestions = found.questions;
  reviewAnswers = Array.isArray(found.answers) ? found.answers : [];
  reviewDurations = Array.isArray(found.durations) ? found.durations : [];
  reviewOnlyWeakMode = false;
  reviewMetaLabel = `Sesi ${found.nama} (${found.waktuLabel || ""}) — Total Skor: ${found.total}`;

  const sec = document.getElementById("reviewSection");
  sec.classList.remove("hidden");
  document.getElementById("reviewSectionTitle").textContent = "Pembahasan & Jawaban Sesi Terpilih";
  document.getElementById("reviewSessionSubtitle").textContent = reviewMetaLabel;
  if (typeof populateReviewCategoryFilter === "function") {
    populateReviewCategoryFilter(reviewQuestions);
  }
  if (typeof updateWeakFilterButtonUI === "function") {
    updateWeakFilterButtonUI();
  }
  if (typeof renderReview === "function") {
    renderReview("ALL");
  }
  sec.scrollIntoView({ behavior: "smooth" });
}

function exportLocalHistoryToCsv() {
  const history = getExamHistory();
  if (!history.length) {
    alert("Belum ada riwayat ujian lokal untuk diunduh.");
    return;
  }

  const headers = ["Waktu", "Nama", "Formasi", "Instansi", "Mode", "TWK", "TIU", "TKP", "Total", "Status PG", "Warning"];
  const escapeCsv = (val) => {
    const s = String(val ?? "").replace(/"/g, '""');
    return `"${s}"`; };  const lines = [ headers.map(escapeCsv).join(","), ...history.map(h => [ h.waktuLabel \vert{}\vert{} "-", h.nama \vert{}\vert{} "-", h.formasi \vert{}\vert{} "-", h.instansi \vert{}\vert{} "-", h.mode \vert{}\vert{} "-", Number(h.twk \vert{}\vert{} 0), Number(h.tiu \vert{}\vert{} 0), Number(h.tkp \vert{}\vert{} 0), Number(h.total \vert{}\vert{} 0), h.status_pg \vert{}\vert{} "-", h.warning \vert{}\vert{} "Normal" ].map(escapeCsv).join(",")) ];  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `riwayat_cat_skd_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getFilteredUserSessions() {
  const allHistory = getExamHistory();
  const activeName = getActiveUserFilterName();
  return activeName
    ? allHistory.filter(item => normalizeAccountKey(item.nama) === normalizeAccountKey(activeName))
    : allHistory;
}

function renderAttemptHistory() {
  const filtered = getFilteredUserSessions();
  const listEl = document.getElementById("attemptHistoryList");
  const countBadge = document.getElementById("historyCountBadge");
  if (!listEl || !countBadge) return;

  countBadge.textContent = `${filtered.length} Sesi`; listEl.replaceChildren();  if (filtered.length === 0) { const empty = document.createElement("div"); empty.className = "col-span-full text-xs text-slate-500 py-2"; empty.textContent = "Belum ada riwayat sesi tersimpan untuk review."; listEl.appendChild(empty); return; }  filtered.forEach((item, idx) => { const urutanLabel = idx === 0 ? "Terbaru (Sesudah)" : `Sebelumnya #${filtered.length - idx}`;
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3";

    const info = document.createElement("div");
    info.innerHTML = `
      <div class="text-xs font-extrabold text-slate-800">${urutanLabel} • Skor ${item.total}</div>
      <div class="text-[11px] text-slate-500">TWK ${item.twk} \vert{} TIU${item.tiu} | TKP ${item.tkp} •${item.status_pg}</div>
      <div class="text-[10px] text-slate-400">${escapeHtml(item.mode \vert{}\vert{} "")} • ${escapeHtml(item.waktuLabel || "")}</div>
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shrink-0";
    btn.textContent = item.fromDatabase ? "Detail" : "Review";
    btn.onclick = () => loadAttemptIntoReview(item.id);

    card.append(info, btn);
    listEl.appendChild(card);
  });
}

function renderDashboardUserPreviousExams() {
  const titleEl = document.getElementById("dashUserHistoryTitle");
  const countEl = document.getElementById("dashUserHistoryCount");
  const listEl = document.getElementById("dashUserHistoryList");
  if (!titleEl || !countEl || !listEl) return;

  const activeName = getActiveUserFilterName();
  const userSessions = getFilteredUserSessions();

  titleEl.textContent = activeName
    ? `Ujian Sebelumnya — ${activeName}` : "Ujian Sebelumnya (Semua Sesi Tersimpan)"; countEl.textContent = `${userSessions.length} Sesi`;
  listEl.replaceChildren();

  if (userSessions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "col-span-full text-xs text-slate-600 py-1";
    empty.textContent = activeName
      ? `Belum ada sesi ujian tersimpan untuk "${activeName}".`
      : "Belum ada sesi ujian tersimpan.";
    listEl.appendChild(empty);
    return;
  }

  userSessions.forEach((item, idx) => {
    const label = idx === 0 ? "Ujian Terakhir" : `Ujian Sebelumnya #${userSessions.length - idx}`;
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2.5";

    const info = document.createElement("div");
    info.innerHTML = `
      <div class="text-xs font-extrabold text-slate-800">${escapeHtml(label)} • Skor ${item.total}</div>
      <div class="text-[11px] text-slate-500">TWK ${item.twk} \vert{} TIU${item.tiu} | TKP ${item.tkp} •${escapeHtml(item.status_pg)}</div>
      <div class="text-[10px] text-slate-400">${escapeHtml(item.waktuLabel || "")}</div>
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0";
    btn.textContent = item.fromDatabase ? "Detail" : "Review";
    btn.onclick = () => loadAttemptIntoReview(item.id);

    card.append(info, btn);
    listEl.appendChild(card);
  });
}

function setFullTrendSeriesMode(mode) {
  fullTrendSeriesMode = mode || "ALL";
  renderUserScoreTrendChart();
}

function setFocusTrendSeriesMode(mode) {
  focusTrendSeriesMode = mode || "ALL";
  renderUserScoreTrendChart();
}

function renderSingleTrendGroup(containerEl, sessionsChronological, seriesMode, onSelectFnName, showPgLine, emptyText) {
  if (!containerEl) return;

  if (sessionsChronological.length < 2) {
    const single = sessionsChronological[0];
    containerEl.innerHTML = `
      <div class="text-xs text-slate-500 text-center py-4">
        ${!single
          ? emptyText
          : `1 sesi tercatat (Tot ${single.total} • TWK ${single.twk} | TIU ${single.tiu} | TKP ${single.tkp}). Tambah 1 sesi lagi untuk grafik tren.`}
      </div>
    `;
    return;
  }

  const width = 420;
  const height = 135;
  const padX = 28;
  const padTop = 16;
  const padBottom = 20;
  const plotHeight = height - padTop - padBottom;
  const totalPgThreshold = 311;
  const pgY = padTop + plotHeight - (totalPgThreshold / 550) * plotHeight;

  const seriesMeta = [
    { key: "total", max: 550, color: "#2563eb", show: seriesMode === "ALL" || seriesMode === "TOTAL" },
    { key: "twk", max: 150, color: "#7c3aed", show: seriesMode === "ALL" || seriesMode === "TWK" },
    { key: "tiu", max: 175, color: "#0d9488", show: seriesMode === "ALL" || seriesMode === "TIU" },
    { key: "tkp", max: 225, color: "#ea580c", show: seriesMode === "ALL" || seriesMode === "TKP" }
  ];

  const getX = (idx) => padX + (idx / (sessionsChronological.length - 1)) * (width - padX * 2);
  const getY = (val, max) => {
    const clamped = Math.max(0, Math.min(max, Number(val || 0)));
    return padTop + plotHeight - (clamped / max) * plotHeight;
  };

  const xLabelsHtml = sessionsChronological.map((_, idx) => {
    const x = getX(idx);
    return `<text x="${x.toFixed(1)}" y="${height - 4}" text-anchor="middle" font-size="8.5" fill="#64748b">#${idx + 1}</text>`;
  }).join("");

  const seriesSvgHtml = seriesMeta
    .filter(sr => sr.show)
    .map(sr => {
      const pts = sessionsChronological.map((s, idx) => {
        const rawVal = Number(s[sr.key] || 0);
        return {
          x: getX(idx),
          y: getY(rawVal, sr.max),
          val: rawVal
        };
      });

      const polylineStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const showPointLabels = seriesMode !== "ALL" || sr.key === "total";

      const pointsHtml = pts.map(p => {
        const labelHtml = showPointLabels
          ? `<text x="${p.x.toFixed(1)}" y="${Math.max(10, p.y - 5).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="bold" fill="${sr.color}">${p.val}</text>`
          : "";
        return `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" fill="${sr.color}" stroke="#ffffff" stroke-width="1.2" />
          ${labelHtml}
        `;
      }).join("");

      return `
        <polyline fill="none" stroke="${sr.color}" stroke-width="${sr.key === "total" ? "2.2" : "1.7"}" points="${polylineStr}" />
        ${pointsHtml}
      `;
    }).join("");

  const pgLineHtml = showPgLine && (seriesMode === "ALL" || seriesMode === "TOTAL")
    ? `
      <line x1="${padX}" y1="${pgY.toFixed(1)}" x2="${width - padX}" y2="${pgY.toFixed(1)}" stroke="#10b981" stroke-dasharray="4" stroke-width="1" />
      <text x="${width - padX}" y="${(pgY - 3).toFixed(1)}" text-anchor="end" font-size="7.5" font-weight="bold" fill="#059669">PG >= 311</text>
    `
    : "";

  const latest = sessionsChronological[sessionsChronological.length - 1];
  const btnCls = (m) => seriesMode === m
    ? "px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white"
    : "px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200";

  containerEl.innerHTML = `
    <div class="w-full space-y-1">
      <div class="flex flex-wrap items-center justify-between gap-1">
        <div class="flex flex-wrap items-center gap-1">
          <button type="button" onclick="${onSelectFnName}('ALL')" class="${btnCls("ALL")}">Semua</button>
          <button type="button" onclick="${onSelectFnName}('TOTAL')" class="${btnCls("TOTAL")}">Total</button>
          <button type="button" onclick="${onSelectFnName}('TWK')" class="${btnCls("TWK")}">TWK</button>
          <button type="button" onclick="${onSelectFnName}('TIU')" class="${btnCls("TIU")}">TIU</button>
          <button type="button" onclick="${onSelectFnName}('TKP')" class="${btnCls("TKP")}">TKP</button>
        </div>
        <div class="text-[10px] font-semibold text-slate-600">
          Terakhir: <span class="text-blue-700 font-bold">Tot ${latest.total}</span> •
          <span class="text-violet-700 font-bold">TWK ${latest.twk}</span> •
          <span class="text-teal-700 font-bold">TIU ${latest.tiu}</span> •
          <span class="text-orange-700 font-bold">TKP ${latest.tkp}</span>
        </div>
      </div>

      <svg viewBox="0 0 ${width}${height}" class="w-full h-32">
        <line x1="${padX}" y1="${padTop + plotHeight}" x2="${width - padX}" y2="${padTop + plotHeight}" stroke="#cbd5e1" stroke-width="1" />
        ${pgLineHtml}
        ${seriesSvgHtml}${xLabelsHtml}
      </svg>

      <div class="flex flex-wrap items-center justify-center gap-2.5 text-[10px] font-semibold text-slate-600">
        <span class="inline-flex items-center gap-1"><span class="w-2.5 h-0.5 bg-blue-600 inline-block"></span> Total</span>
        <span class="inline-flex items-center gap-1"><span class="w-2.5 h-0.5 bg-violet-600 inline-block"></span> TWK</span>
        <span class="inline-flex items-center gap-1"><span class="w-2.5 h-0.5 bg-teal-600 inline-block"></span> TIU</span>
        <span class="inline-flex items-center gap-1"><span class="w-2.5 h-0.5 bg-orange-600 inline-block"></span> TKP</span>
      </div>
    </div>
  `;
}

function renderUserScoreTrendChart() {
  const fullBox = document.getElementById("userFullTrendChart");
  const focusBox = document.getElementById("userFocusTrendChart");
  const fullBadge = document.getElementById("fullTrendBadge");
  const focusBadge = document.getElementById("focusTrendBadge");
  const pgSummaryEl = document.getElementById("trendPgSummary");
  if (!fullBox && !focusBox) return;

  const userSessions = getFilteredUserSessions().slice().reverse();
  const fullSessions = userSessions.filter(s => !isFocusOrDrillMode(s.mode));
  const focusSessions = userSessions.filter(s => isFocusOrDrillMode(s.mode));

  if (fullBadge) fullBadge.textContent = `${fullSessions.length} Sesi`; if (focusBadge) focusBadge.textContent = `${focusSessions.length} Sesi`;

  if (pgSummaryEl) {
    if (userSessions.length === 0) {
      pgSummaryEl.textContent = "PG Acuan: TWK >= 65 • TIU >= 80 • TKP >= 166 (Total >= 311)";
    } else {
      const avgTwk = Math.round(userSessions.reduce((a, b) => a + Number(b.twk || 0), 0) / userSessions.length);
      const avgTiu = Math.round(userSessions.reduce((a, b) => a + Number(b.tiu || 0), 0) / userSessions.length);
      const avgTkp = Math.round(userSessions.reduce((a, b) => a + Number(b.tkp || 0), 0) / userSessions.length);
      pgSummaryEl.textContent =
        `Rata-rata — TWK: ${avgTwk}/65 • TIU: ${avgTiu}/80 • T
