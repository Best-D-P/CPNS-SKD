function getActiveUserFilterName() {
  if (loggedUser && loggedUser.nama) return loggedUser.nama.trim();
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

function saveAttemptToHistory(attemptRecord) {
  const history = getExamHistory();
  history.unshift(attemptRecord);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 150)));
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

  countBadge.textContent = `${filtered.length} Sesi`;
  listEl.replaceChildren();

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "col-span-full text-xs text-slate-500 py-2";
    empty.textContent = "Belum ada riwayat sesi tersimpan untuk review.";
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach((item, idx) => {
    const urutanLabel = idx === 0 ? "Terbaru (Sesudah)" : `Sebelumnya #${filtered.length - idx}`;
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3";

    const info = document.createElement("div");
    info.innerHTML = `
      <div class="text-xs font-extrabold text-slate-800">${urutanLabel} • Skor ${item.total}</div>
      <div class="text-[11px] text-slate-500">TWK ${item.twk} | TIU ${item.tiu} | TKP ${item.tkp} • ${item.status_pg}</div>
      <div class="text-[10px] text-slate-400">${item.waktuLabel || ""}</div>
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shrink-0";
    btn.textContent = "Review";
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
    ? `Ujian Sebelumnya — ${activeName}`
    : "Ujian Sebelumnya (Semua Sesi Tersimpan)";
  countEl.textContent = `${userSessions.length} Sesi`;
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
      <div class="text-[11px] text-slate-500">TWK ${item.twk} | TIU ${item.tiu} | TKP ${item.tkp} • ${escapeHtml(item.status_pg)}</div>
      <div class="text-[10px] text-slate-400">${escapeHtml(item.waktuLabel || "")}</div>
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0";
    btn.textContent = "Review";
    btn.onclick = () => loadAttemptIntoReview(item.id);

    card.append(info, btn);
    listEl.appendChild(card);
  });
}

function renderUserScoreTrendChart() {
  const chartBox = document.getElementById("userScoreTrendChart");
  const badgeEl = document.getElementById("trendChartBadge");
  if (!chartBox || !badgeEl) return;

  const sessionsChronological = getFilteredUserSessions().slice().reverse();
  badgeEl.textContent = `${sessionsChronological.length} Sesi`;

  if (sessionsChronological.length < 2) {
    chartBox.innerHTML = `
      <div class="text-xs text-slate-500 text-center py-4">
        ${sessionsChronological.length === 0
          ? "Belum ada data ujian untuk menampilkan grafik tren."
          : `Skor 1 sesi tercatat (${sessionsChronological[0].total}). Selesaikan minimal 1 sesi lagi untuk melihat grafik tren perkembangan.`}
      </div>
    `;
    return;
  }

  const width = 420;
  const height = 130;
  const padX = 32;
  const padY = 18;
  const maxVal = 550;

  const pts = sessionsChronological.map((s, idx) => {
    const x = padX + (idx / (sessionsChronological.length - 1)) * (width - padX * 2);
    const score = Math.max(0, Math.min(maxVal, Number(s.total || 0)));
    const y = height - padY - (score / maxVal) * (height - padY * 2);
    return { x, y, score, label: `#${idx + 1}` };
  });

  const polylineStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const circlesHtml = pts.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="1.5" />
    <text x="${p.x.toFixed(1)}" y="${Math.max(10, p.y - 7).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="bold" fill="#1e293b">${p.score}</text>
    <text x="${p.x.toFixed(1)}" y="${height - 3}" text-anchor="middle" font-size="9" fill="#64748b">${p.label}</text>
  `).join("");

  chartBox.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-32">
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="#cbd5e1" stroke-width="1" />
      <line x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}" stroke="#e2e8f0" stroke-dasharray="3" stroke-width="1" />
      <polyline fill="none" stroke="#2563eb" stroke-width="2.5" points="${polylineStr}" />
      ${circlesHtml}
    </svg>
  `;
}

function setDashboardScope(scope) {
  dashboardScope = scope;
  const allBtn = document.getElementById("scopeAllBtn");
  const mineBtn = document.getElementById("scopeMineBtn");
  if (scope === "MINE") {
    mineBtn.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white";
    allBtn.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200";
  } else {
    allBtn.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white";
    mineBtn.className = "px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200";
  }
  renderDashboardTable();
}

function setDashboardTop10Mode() {
  dashboardTop10Only = !dashboardTop10Only;
  const btn = document.getElementById("scopeTop10Btn");
  if (btn) {
    btn.className = dashboardTop10Only
      ? "px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white"
      : "px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200";
  }
  renderDashboardTable();
}

async function openDashboard() {
  showScreen("dashboard");
}

async function refreshDashboardData() {
  const infoEl = document.getElementById("dashboardSourceInfo");
  infoEl.textContent = "Mengambil data rekap skor peserta...";
  renderDashboardUserPreviousExams();
  renderUserScoreTrendChart();

  const localRecords = getExamHistory().map(h => ({
    waktu: h.waktuLabel || "-",
    nama: h.nama || "Peserta",
    formasi: h.formasi || "-",
    instansi: h.instansi || "-",
    mode: h.mode || "-",
    twk: Number(h.twk || 0),
    tiu: Number(h.tiu || 0),
    tkp: Number(h.tkp || 0),
    total: Number(h.total || 0),
    status_pg: h.status_pg || "-",
    warning: h.warning || "Normal"
  }));

  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("TEMPEL_URL")) {
    dashboardRecords = localRecords;
    infoEl.textContent = `Menampilkan ${dashboardRecords.length} data lokal (browser ini).`;
    renderDashboardTable();
    return;
  }

  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?mode=rekap`);
    const json = await res.json();
    if (json.status === "sukses" && Array.isArray(json.rekap) && json.rekap.length > 0) {
      dashboardRecords = json.rekap.slice().reverse();
      infoEl.textContent = `Sumber: Google Sheets (${dashboardRecords.length} data tercatat).`;
    } else {
      dashboardRecords = localRecords;
      infoEl.textContent = `Menampilkan ${dashboardRecords.length} data lokal.`;
    }
  } catch (err) {
    dashboardRecords = localRecords;
    infoEl.textContent = `Mode offline/lokal (${dashboardRecords.length} data tersimpan di browser).`;
  }

  renderDashboardTable();
}

function renderDashboardTable() {
  const qText = (document.getElementById("dashboardSearchInput")?.value || "").trim().toLowerCase();
  const pgFilter = document.getElementById("dashboardFilterPg")?.value || "ALL";
  const activeName = getActiveUserFilterName();

  const filtered = dashboardRecords.filter(rec => {
    if (dashboardScope === "MINE") {
      if (!activeName || normalizeAccountKey(rec.nama) !== normalizeAccountKey(activeName)) {
        return false;
      }
    }
    const matchPg = pgFilter === "ALL" || rec.status_pg === pgFilter;
    const hay = `${rec.nama} ${rec.formasi} ${rec.instansi}`.toLowerCase();
    const matchText = !qText || hay.includes(qText);
    return matchPg && matchText;
  });

  const sortedRows = filtered
    .slice()
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0));

  const rowsToDisplay = dashboardTop10Only
    ? sortedRows.slice(0, 10)
    : sortedRows;

  const totalAttempts = rowsToDisplay.length;
  const highestScore = totalAttempts > 0 ? Math.max(...rowsToDisplay.map(r => Number(r.total || 0))) : 0;
  const avgScore = totalAttempts > 0
    ? Math.round(rowsToDisplay.reduce((acc, r) => acc + Number(r.total || 0), 0) / totalAttempts)
    : 0;
  const passCount = rowsToDisplay.filter(r => r.status_pg === "LULUS PG").length;

  document.getElementById("dashTotalAttempts").textContent = totalAttempts;
  document.getElementById("dashHighestScore").textContent = highestScore;
  document.getElementById("dashAverageScore").textContent = avgScore;
  document.getElementById("dashPassCount").textContent = passCount;

  const tbody = document.getElementById("dashboardTableBody");
  tbody.replaceChildren();

  if (rowsToDisplay.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" class="py-6 px-4 text-center text-slate-500">Belum ada data skor peserta yang sesuai filter.</td>`;
    tbody.appendChild(tr);
    return;
  }

  rowsToDisplay.forEach((rec, i) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50";
    const isPass = rec.status_pg === "LULUS PG";
    const badgeClass = isPass
      ? "bg-emerald-100 text-emerald-800"
      : "bg-rose-100 text-rose-800";
    const rankNum = i + 1;
    const rankBadge = rankNum <= 3
      ? `<span class="ml-1 inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Top #${rankNum}</span>`
      : "";

    tr.innerHTML = `
      <td class="py-2.5 px-3 font-semibold text-slate-500">${rankNum}</td>
      <td class="py-2.5 px-3 font-bold text-slate-800">${escapeHtml(rec.nama)}${rankBadge}</td>
      <td class="py-2.5 px-3 text-slate-600">
        <div class="font-medium text-slate-800">${escapeHtml(rec.formasi)}</div>
        <div class="text-xs text-slate-500">${escapeHtml(rec.instansi)}</div>
      </td>
      <td class="py-2.5 px-3 text-center font-semibold">${rec.twk}</td>
      <td class="py-2.5 px-3 text-center font-semibold">${rec.tiu}</td>
      <td class="py-2.5 px-3 text-center font-semibold">${rec.tkp}</td>
      <td class="py-2.5 px-3 text-center font-extrabold text-blue-700">${rec.total}</td>
      <td class="py-2.5 px-3 text-center">
        <span class="text-xs font-bold px-2 py-0.5 rounded ${badgeClass}">${escapeHtml(rec.status_pg)}</span>
      </td>
      <td class="py-2.5 px-3 text-xs text-slate-500">${escapeHtml(rec.waktu)}</td>
    `;
    tbody.appendChild(tr);
  });
}
