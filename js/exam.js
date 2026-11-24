function saveExamSessionToStorage() {
  if (!isExamActive) return;
  try {
    const snapshot = {
      participantName,
      appliedFormation,
      appliedInstitution,
      examModeLabel,
      examStartedAt,
      examEndTime,
      currentIndex,
      currentFilter,
      questionBank,
      userAnswers,
      doubtFlags
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("Gagal menyimpan sesi ke localStorage:", err);
  }
}

function clearExamSessionFromStorage() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {}
}

function enterExamWorkspaceUI() {
  document.getElementById("setupScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.add("hidden");
  document.getElementById("dashboardScreen").classList.add("hidden");
  document.getElementById("reviewSection").classList.add("hidden");
  document.getElementById("examScreen").classList.remove("hidden");

  document.getElementById("navHeaderControls").classList.add("hidden");
  const headerCtrl = document.getElementById("examHeaderControls");
  headerCtrl.classList.remove("hidden");
  headerCtrl.classList.add("flex");

  document.getElementById("headerParticipantName").textContent = `${participantName} • ${appliedInstitution}`;
  document.getElementById("headerExamMode").textContent = `${appliedFormation} (${examModeLabel})`;
}

function tryRestoreExamSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;

    const snap = JSON.parse(raw);
    if (
      !snap ||
      !Array.isArray(snap.questionBank) ||
      snap.questionBank.length === 0 ||
      !snap.examEndTime
    ) {
      clearExamSessionFromStorage();
      return false;
    }

    const secsLeft = Math.floor((Number(snap.examEndTime) - Date.now()) / 1000);

    participantName = snap.participantName || "Peserta Umum";
    appliedFormation = snap.appliedFormation || "-";
    appliedInstitution = snap.appliedInstitution || "Kementerian Pertahanan";
    examModeLabel = snap.examModeLabel || "Reguler (100 Menit)";
    examStartedAt = Number(snap.examStartedAt) || Date.now();
    examEndTime = Number(snap.examEndTime);
    questionBank = snap.questionBank;
    userAnswers = Array.isArray(snap.userAnswers)
      ? snap.userAnswers
      : new Array(questionBank.length).fill(null);
    doubtFlags = Array.isArray(snap.doubtFlags)
      ? snap.doubtFlags
      : new Array(questionBank.length).fill(false);
    currentIndex = Math.min(Math.max(Number(snap.currentIndex) || 0, 0), questionBank.length - 1);
    currentFilter = snap.currentFilter || "ALL";

    if (secsLeft <= 0) {
      remainingSeconds = 0;
      isExamActive = false;
      clearExamSessionFromStorage();
      alert("Waktu ujian yang sedang berjalan telah habis saat halaman dimuat ulang. Hasil akan dikumpulkan otomatis.");
      finishExam();
      return true;
    }

    const shouldResume = confirm(
      `Ditemukan sesi ujian aktif atas nama "${participantName}" dengan sisa waktu ${Math.floor(secsLeft / 60)} menit ${secsLeft % 60} detik.\n\n` +
      "Klik OK untuk MELANJUTKAN ujian dari soal terakhir, atau Batal untuk memulai ulang dari awal."
    );

    if (!shouldResume) {
      clearExamSessionFromStorage();
      return false;
    }

    remainingSeconds = secsLeft;
    isExamActive = true;
    enterExamWorkspaceUI();
    filterNav(currentFilter);
    renderQuestion();
    renderGrid();
    startTimer();
    return true;
  } catch (err) {
    clearExamSessionFromStorage();
    return false;
  }
}

function resetAndRestartFromSetup() {
  clearInterval(timerInterval);
  isExamActive = false;
  clearExamSessionFromStorage();
  document.getElementById("reviewSection").classList.add("hidden");
  showScreen("setup");
}

function startExam() {
  const nameVal = document.getElementById("participantNameInput").value.trim();
  const formationVal = document.getElementById("appliedFormationInput").value.trim();
  const institutionVal = document.getElementById("appliedInstitutionInput").value.trim();

  if (!nameVal) {
    alert("Silakan isi Nama Lengkap Peserta terlebih dahulu sebelum memulai ujian.");
    document.getElementById("participantNameInput").focus();
    return;
  }

  const profanityHits = findProfanityInName(nameVal);
  if (profanityHits.length > 0) {
    validateNameInputRealtime();
    alert(
      "⛔ NAMA DITOLAK:\n" +
      `Nama mengandung kata kasar/penghinaan (${profanityHits.join(", ")}). ` +
      "Ujian tidak dapat dimulai sebelum nama diganti dengan nama yang wajar dan sopan."
    );
    document.getElementById("participantNameInput").focus();
    return;
  }

  if (!formationVal) {
    alert("Silakan ketik Formasi yang Dilamar terlebih dahulu.");
    document.getElementById("appliedFormationInput").focus();
    return;
  }

  const formationProfanity = findProfanityInName(formationVal);
  if (formationProfanity.length > 0) {
    validateFormationInputRealtime();
    alert(
      "⛔ FORMASI DITOLAK:\n" +
      `Formasi yang dilamar mengandung kata kasar/penghinaan (${formationProfanity.join(", ")}). ` +
      "Silakan perbaiki sebelum memulai ujian."
    );
    document.getElementById("appliedFormationInput").focus();
    return;
  }

  if (!institutionVal) {
    alert("Silakan ketik Instansi yang Dilamar terlebih dahulu.");
    document.getElementById("appliedInstitutionInput").focus();
    return;
  }

  const institutionProfanity = findProfanityInName(institutionVal);
  if (institutionProfanity.length > 0) {
    validateInstitutionInputRealtime();
    alert(
      "⛔ INSTANSI DITOLAK:\n" +
      `Instansi yang dilamar mengandung kata kasar/penghinaan (${institutionProfanity.join(", ")}). ` +
      "Silakan perbaiki sebelum memulai ujian."
    );
    document.getElementById("appliedInstitutionInput").focus();
    return;
  }

  const inputIssues = checkInputAnomalyPreview(nameVal, formationVal, institutionVal);
  if (inputIssues.length > 0) {
    alert(
      "⚠️ PERINGATAN DATA TIDAK WAJAR:\n" +
      inputIssues.map(item => "• " + item).join("\n") +
      "\n\nSistem akan tetap mencatat aktivitas, perangkat, IP publik, dan menandai data ini sebagai WARNING pada rekap."
    );
  }

  participantName = nameVal;
  appliedFormation = formationVal;
  appliedInstitution = institutionVal;
  examStartedAt = Date.now();
  isExamActive = true;

  const durationMinutes = parseInt(document.getElementById("durationSelect").value, 10);
  const orderMode = document.getElementById("orderSelect").value;
  const focusMode = document.getElementById("subtestFocusSelect")?.value || "ALL";
  examModeLabel = durationMinutes === 130 ? "Disabilitas (130 Menit)" : "Reguler (100 Menit)";
  remainingSeconds = durationMinutes * 60;
  examEndTime = Date.now() + remainingSeconds * 1000;

  const defaultBank = buildDefaultQuestionBank();

  function buildSubtestQuota(subtest, targetCount) {
    const sheetItems = questionBank.filter(q => q.subtest === subtest);
    const fallbackItems = defaultBank.filter(q => q.subtest === subtest);

    const seenTexts = new Set();
    const uniqueSheet = [];
    for (const item of sheetItems) {
      const key = String(item.question || "").trim().toLowerCase();
      if (key && !seenTexts.has(key)) {
        seenTexts.add(key);
        uniqueSheet.push({ ...item });
      }
    }

    let selected = orderMode === "shuffled" ? shuffleArray(uniqueSheet) : [...uniqueSheet];
    if (selected.length > targetCount) {
      selected = selected.slice(0, targetCount);
    }

    if (selected.length < targetCount) {
      const extraPool = orderMode === "shuffled" ? shuffleArray(fallbackItems) : [...fallbackItems];
      for (const fb of extraPool) {
        if (selected.length >= targetCount) break;
        const key = String(fb.question || "").trim().toLowerCase();
        if (!seenTexts.has(key)) {
          seenTexts.add(key);
          selected.push({ ...fb });
        }
      }
      let idx = 0;
      while (selected.length < targetCount && extraPool.length > 0) {
        selected.push({ ...extraPool[idx % extraPool.length] });
        idx++;
      }
    }

    return orderMode === "shuffled" ? shuffleArray(selected) : selected;
  }

  if (focusMode === "TWK") {
    questionBank = buildSubtestQuota("TWK", 30).map((item, idx) => ({
      ...item,
      id: idx + 1
    }));
    examModeLabel = `${examModeLabel} • Fokus TWK (30 Soal)`;
  } else if (focusMode === "TIU") {
    questionBank = buildSubtestQuota("TIU", 35).map((item, idx) => ({
      ...item,
      id: idx + 1
    }));
    examModeLabel = `${examModeLabel} • Fokus TIU (35 Soal)`;
  } else if (focusMode === "TKP") {
    questionBank = buildSubtestQuota("TKP", 45).map((item, idx) => ({
      ...item,
      id: idx + 1
    }));
    examModeLabel = `${examModeLabel} • Fokus TKP (45 Soal)`;
  } else {
    const twk = buildSubtestQuota("TWK", 30);
    const tiu = buildSubtestQuota("TIU", 35);
    const tkp = buildSubtestQuota("TKP", 45);

    questionBank = [...twk, ...tiu, ...tkp].map((item, idx) => ({
      ...item,
      id: idx + 1
    }));
  }

  userAnswers = new Array(questionBank.length).fill(null);
  doubtFlags = new Array(questionBank.length).fill(false);
  currentIndex = 0;
  currentFilter = "ALL";

  enterExamWorkspaceUI();
  saveExamSessionToStorage();
  renderQuestion();
  renderGrid();
  startTimer();
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingSeconds = Math.max(0, Math.floor((examEndTime - Date.now()) / 1000));
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      alert("Waktu ujian telah habis! Jawaban Anda akan dikumpulkan secara otomatis.");
      finishExam();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const el = document.getElementById("timerDisplay");
  el.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  if (remainingSeconds <= 300) {
    el.classList.remove("text-emerald-400");
    el.classList.add("text-rose-400");
  } else {
    el.classList.remove("text-rose-400");
    el.classList.add("text-emerald-400");
  }
}

function renderQuestion() {
  const q = questionBank[currentIndex];
  if (!q) return;

  document.getElementById("questionSubtestBadge").textContent = q.subtest;
  document.getElementById("questionCategoryLabel").textContent = q.category;
  document.getElementById("questionNumberTitle").textContent =
    `Soal No. ${currentIndex + 1} dari ${questionBank.length}`;
  document.getElementById("questionText").textContent = q.question;

  const mediaBox = document.getElementById("questionMedia");
  const safeMedia = sanitizeQuestionMedia(q.svg);
  if (safeMedia) {
    mediaBox.innerHTML = safeMedia;
    mediaBox.classList.remove("hidden");
  } else {
    mediaBox.replaceChildren();
    mediaBox.classList.add("hidden");
  }

  const container = document.getElementById("optionsContainer");
  container.replaceChildren();

  q.options.forEach((optText, idx) => {
    const isSelected = userAnswers[currentIndex] === idx;
    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = `w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3 ${
      isSelected
        ? "bg-blue-50 border-blue-600 ring-1 ring-blue-600"
        : "bg-white border-slate-200 hover:bg-slate-50"
    }`;
    btn.onclick = () => selectOption(idx);

    const letter = document.createElement("span");
    letter.className = `w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
      isSelected
        ? "bg-blue-600 text-white"
        : "bg-slate-100 text-slate-700"
    }`;
    letter.textContent = ["A", "B", "C", "D", "E"][idx] || String(idx + 1);

    const optionText = document.createElement("span");
    optionText.className = "text-sm text-slate-800 pt-0.5";
    optionText.textContent = optText;

    btn.append(letter, optionText);
    container.appendChild(btn);
  });

  document.getElementById("prevBtn").disabled = currentIndex === 0;

  const answeredCount = userAnswers.filter(answer => answer !== null).length;
  document.getElementById("answeredCounter").textContent =
    `${answeredCount} / ${questionBank.length} Dijawab`;
}

function selectOption(optIdx) {
  const q = questionBank[currentIndex];
  if (!q || !Array.isArray(q.options) || optIdx < 0 || optIdx >= q.options.length) return;
  userAnswers[currentIndex] = optIdx;
  saveExamSessionToStorage();
  renderQuestion();
  renderGrid();
}

function toggleDoubt() {
  doubtFlags[currentIndex] = !doubtFlags[currentIndex];
  saveExamSessionToStorage();
  renderGrid();
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    saveExamSessionToStorage();
    renderQuestion();
    renderGrid();
  }
}

function saveAndNext() {
  if (currentIndex < questionBank.length - 1) {
    currentIndex++;
    saveExamSessionToStorage();
    renderQuestion();
    renderGrid();
  } else {
    confirmFinishExam();
  }
}

function filterNav(subtest) {
  currentFilter = subtest;
  document.querySelectorAll(".nav-filter-btn").forEach(btn => {
    if (btn.dataset.filter === subtest) {
      btn.className = "nav-filter-btn flex-1 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-white";
    } else {
      btn.className = "nav-filter-btn flex-1 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700";
    }
  });
  if (isExamActive) saveExamSessionToStorage();
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById("questionGrid");
  grid.innerHTML = "";
  questionBank.forEach((q, idx) => {
    if (currentFilter !== "ALL" && q.subtest !== currentFilter) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = idx + 1;
    btn.onclick = () => {
      currentIndex = idx;
      saveExamSessionToStorage();
      renderQuestion();
      renderGrid();
    };

    let colorClass = "bg-rose-500 text-white";
    if (doubtFlags[idx]) {
      colorClass = "bg-amber-400 text-slate-900";
    } else if (userAnswers[idx] !== null) {
      colorClass = "bg-emerald-500 text-white";
    }

    const activeRing = idx === currentIndex ? "ring-2 ring-offset-1 ring-blue-600 scale-105" : "";
    btn.className = `h-8 rounded-lg text-xs font-bold transition ${colorClass} ${activeRing}`;
    grid.appendChild(btn);
  });
}

function confirmFinishExam() {
  const unanswered = userAnswers.filter(a => a === null).length;
  const msg = unanswered > 0
    ? `Masih ada ${unanswered} soal yang belum dijawab. Apakah Anda yakin ingin mengakhiri ujian sekarang?`
    : "Apakah Anda yakin ingin mengakhiri ujian dan melihat hasil nilai Anda?";
  if (confirm(msg)) {
    finishExam();
  }
}

async function getPublicIpAddress() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal
    });
    if (!res.ok) return "Tidak terdeteksi";
    const json = await res.json();
    return json.ip ? String(json.ip).trim() : "Tidak terdeteksi";
  } catch (err) {
    return "Tidak terdeteksi";
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseDeviceInfo() {
  const ua = navigator.userAgent || "Unknown";

  let os = "OS Lainnya";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser Lainnya";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  const isMobile = /Mobile|
