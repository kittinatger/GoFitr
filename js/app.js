(function () {
  "use strict";

  const USERS_KEY = "gofitr_users_v1";
  const SESSION_KEY = "gofitr_session_v1";

  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

  const defaultData = () => ({
    workouts: [],   // { id, date: 'YYYY-MM-DD', exercise, sets: [{reps, weight}], notes }
    bodyWeight: [], // { id, date, weight }
    unit: "kg",
  });

  let currentUser = null;
  let authMode = null; // "local" | "github"
  let data = defaultData();
  let charts = { progress: null, weight: null };

  // ---------- Accounts (local only — no server, no cross-device sync) ----------
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getSession() {
    return localStorage.getItem(SESSION_KEY);
  }

  function setSession(userKey) {
    localStorage.setItem(SESSION_KEY, userKey);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function randomSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    return sha256Hex(salt + ":" + password);
  }

  function storageKeyFor(userKey) {
    return "gofitr_data_v1:" + userKey;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(storageKeyFor(currentUser));
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultData(), parsed);
    } catch (e) {
      console.error("Failed to load data, starting fresh.", e);
      return defaultData();
    }
  }

  function saveData() {
    localStorage.setItem(storageKeyFor(currentUser), JSON.stringify(data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function dateKey(d) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  function todayStr() {
    return dateKey(new Date());
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ---------- Navigation ----------
  function showView(view) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-" + view).classList.add("active");
    document.querySelectorAll(".nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.view === view);
    });
    if (view === "dashboard") renderDashboard();
    if (view === "history") renderHistory();
    if (view === "progress") renderProgress();
    if (view === "weight") renderWeight();
    if (view === "log") prepLogForm();
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });
  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.goto));
  });

  // ---------- Exercise list helpers ----------
  function allExerciseNames() {
    const set = new Set(data.workouts.map(w => w.exercise));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function refreshExerciseOptions() {
    const names = allExerciseNames();

    const datalist = document.getElementById("exercise-options");
    datalist.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join("");

    const filterSel = document.getElementById("filter-exercise");
    const prevFilter = filterSel.value;
    filterSel.innerHTML = `<option value="">All exercises</option>` +
      names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    filterSel.value = names.includes(prevFilter) ? prevFilter : "";

    const progSel = document.getElementById("progress-exercise");
    const prevProg = progSel.value;
    progSel.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    if (names.includes(prevProg)) progSel.value = prevProg;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // ---------- Log Workout ----------
  function prepLogForm() {
    document.getElementById("log-date").value = todayStr();
    refreshExerciseOptions();
  }

  function addSetRow(reps = "", weight = "") {
    const container = document.getElementById("sets-container");
    const idx = container.children.length + 1;
    const row = document.createElement("div");
    row.className = "set-row";
    row.innerHTML = `
      <div class="set-index">${idx}</div>
      <input type="number" class="set-reps" placeholder="Reps" min="0" value="${reps}">
      <input type="number" class="set-weight" placeholder="Weight (${data.unit})" min="0" step="0.5" value="${weight}">
      <button type="button" class="set-remove" title="Remove set">${ICON_X}</button>
    `;
    row.querySelector(".set-remove").addEventListener("click", () => {
      row.remove();
      renumberSets();
    });
    container.appendChild(row);
  }

  function renumberSets() {
    document.querySelectorAll("#sets-container .set-row").forEach((row, i) => {
      row.querySelector(".set-index").textContent = i + 1;
    });
  }

  document.getElementById("add-set-btn").addEventListener("click", () => addSetRow());

  document.getElementById("log-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("log-date").value;
    const exercise = document.getElementById("log-exercise").value.trim();
    const notes = document.getElementById("log-notes").value.trim();

    const sets = [];
    document.querySelectorAll("#sets-container .set-row").forEach(row => {
      const reps = parseFloat(row.querySelector(".set-reps").value);
      const weight = parseFloat(row.querySelector(".set-weight").value);
      if (!isNaN(reps) && reps > 0) {
        sets.push({ reps, weight: isNaN(weight) ? 0 : weight });
      }
    });

    if (!exercise) { toast("Enter an exercise name"); return; }
    if (sets.length === 0) { toast("Add at least one set"); return; }

    data.workouts.push({ id: uid(), date, exercise, sets, notes });
    saveData();
    toast("Workout saved");

    e.target.reset();
    document.getElementById("sets-container").innerHTML = "";
    addSetRow();
    document.getElementById("log-date").value = todayStr();
    refreshExerciseOptions();
    showView("dashboard");
  });

  // ---------- Dashboard ----------
  function volumeOf(workout) {
    return workout.sets.reduce((sum, s) => sum + (s.reps * s.weight), 0);
  }

  function startOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Monday start
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function computeStreak() {
    const days = new Set(data.workouts.map(w => w.date));
    let streak = 0;
    let cursor = new Date(todayStr() + "T00:00:00");
    // allow today to be empty and still count yesterday's streak
    if (!days.has(todayStr())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (true) {
      const key = dateKey(cursor);
      if (days.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function renderDashboard() {
    document.getElementById("today-date").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    document.getElementById("stat-streak").innerHTML = `${computeStreak()}<span class="stat-unit">days</span>`;

    const weekStart = startOfWeek(new Date());
    const weekWorkouts = data.workouts.filter(w => new Date(w.date + "T00:00:00") >= weekStart);
    document.getElementById("stat-week-count").textContent = weekWorkouts.length;

    const weekVolume = weekWorkouts.reduce((sum, w) => sum + volumeOf(w), 0);
    document.getElementById("stat-week-volume").innerHTML =
      `${Math.round(weekVolume).toLocaleString()}<span class="stat-unit">${data.unit}</span>`;

    document.getElementById("stat-total").textContent = data.workouts.length;

    const recent = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date) || 0).slice(0, 6);
    const container = document.getElementById("recent-workouts");
    if (recent.length === 0) {
      container.innerHTML = `<p class="empty-state">No workouts yet — log your first session!</p>`;
    } else {
      container.innerHTML = recent.map(w => workoutCardHtml(w)).join("");
      attachWorkoutCardHandlers(container);
    }
  }

  function workoutCardHtml(w) {
    const setsHtml = w.sets.map(s => `<span class="set-chip">${s.reps} × ${s.weight}${data.unit}</span>`).join("");
    return `
      <div class="workout-card" data-id="${w.id}">
        <div class="workout-card-header">
          <span class="workout-exercise">${escapeHtml(w.exercise)}</span>
          <span class="workout-date">${formatDate(w.date)}</span>
        </div>
        <div class="workout-sets">${setsHtml}</div>
        ${w.notes ? `<div class="workout-notes">${escapeHtml(w.notes)}</div>` : ""}
        <div class="workout-actions">
          <button class="btn-icon delete-workout" title="Delete">${ICON_TRASH}</button>
        </div>
      </div>
    `;
  }

  function attachWorkoutCardHandlers(container) {
    container.querySelectorAll(".delete-workout").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const card = e.target.closest(".workout-card");
        const id = card.dataset.id;
        if (confirm("Delete this workout entry?")) {
          data.workouts = data.workouts.filter(w => w.id !== id);
          saveData();
          renderDashboard();
          renderHistory();
          renderProgress();
        }
      });
    });
  }

  // ---------- History ----------
  function renderHistory() {
    refreshExerciseOptions();
    const filter = document.getElementById("filter-exercise").value;
    let list = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date));
    if (filter) list = list.filter(w => w.exercise === filter);

    const container = document.getElementById("history-list");
    const empty = document.getElementById("history-empty");

    if (list.length === 0) {
      container.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    let html = "";
    let lastDate = null;
    for (const w of list) {
      if (w.date !== lastDate) {
        html += `<div class="history-day-label">${formatDate(w.date)}</div>`;
        lastDate = w.date;
      }
      html += workoutCardHtml(w);
    }
    container.innerHTML = html;
    attachWorkoutCardHandlers(container);
  }

  document.getElementById("filter-exercise").addEventListener("change", renderHistory);

  // ---------- Progress ----------
  function renderProgress() {
    refreshExerciseOptions();
    const sel = document.getElementById("progress-exercise");
    const names = allExerciseNames();
    const empty = document.getElementById("progress-empty");
    const canvas = document.getElementById("progress-chart");

    if (names.length === 0) {
      empty.style.display = "block";
      empty.textContent = "Log a workout to start tracking progress.";
      canvas.style.display = "none";
      renderPRs();
      return;
    }
    canvas.style.display = "block";

    const exercise = sel.value || names[0];
    sel.value = exercise;

    const entries = data.workouts
      .filter(w => w.exercise === exercise)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (entries.length === 0) {
      empty.style.display = "block";
      empty.textContent = "No entries for this exercise yet.";
      canvas.style.display = "none";
      renderPRs();
      return;
    }
    empty.style.display = "none";
    canvas.style.display = "block";

    const labels = entries.map(w => formatDate(w.date));
    const maxWeights = entries.map(w => Math.max(...w.sets.map(s => s.weight)));
    const volumes = entries.map(w => volumeOf(w));

    if (charts.progress) charts.progress.destroy();
    charts.progress = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `Max Weight (${data.unit})`,
            data: maxWeights,
            borderColor: "#6ee7b7",
            backgroundColor: "rgba(110,231,183,0.15)",
            tension: 0.3,
            yAxisID: "y",
            fill: true,
          },
          {
            label: `Volume (${data.unit})`,
            data: volumes,
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96,165,250,0.1)",
            tension: 0.3,
            yAxisID: "y1",
            fill: true,
          }
        ]
      },
      options: chartOptions(true)
    });

    renderPRs();
  }

  function chartOptions(dualAxis) {
    const opts = {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#e8eaed" } },
      },
      scales: {
        x: { ticks: { color: "#8b93a3" }, grid: { color: "#2a2f3a" } },
        y: { ticks: { color: "#8b93a3" }, grid: { color: "#2a2f3a" }, position: "left" },
      }
    };
    if (dualAxis) {
      opts.scales.y1 = { ticks: { color: "#8b93a3" }, grid: { display: false }, position: "right" };
    }
    return opts;
  }

  function renderPRs() {
    const container = document.getElementById("pr-list");
    const names = allExerciseNames();
    if (names.length === 0) {
      container.innerHTML = `<p class="empty-state">No records yet.</p>`;
      return;
    }
    const cards = names.map(name => {
      const entries = data.workouts.filter(w => w.exercise === name);
      let best = 0;
      entries.forEach(w => w.sets.forEach(s => { if (s.weight > best) best = s.weight; }));
      return `
        <div class="pr-card">
          <div class="pr-exercise">${escapeHtml(name)}</div>
          <div class="pr-value">${best}${data.unit}</div>
        </div>
      `;
    });
    container.innerHTML = cards.join("");
  }

  document.getElementById("progress-exercise").addEventListener("change", renderProgress);

  // ---------- Body Weight ----------
  function prepWeightForm() {
    document.getElementById("weight-date").value = todayStr();
  }

  document.getElementById("weight-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("weight-date").value;
    const weight = parseFloat(document.getElementById("weight-value").value);
    if (isNaN(weight) || weight <= 0) { toast("Enter a valid weight"); return; }

    data.bodyWeight.push({ id: uid(), date, weight });
    saveData();
    toast("Weight logged");
    e.target.reset();
    prepWeightForm();
    renderWeight();
  });

  function renderWeight() {
    prepWeightForm();
    document.querySelectorAll(".unit-label").forEach(el => el.textContent = data.unit);

    const entries = [...data.bodyWeight].sort((a, b) => a.date.localeCompare(b.date));
    const empty = document.getElementById("weight-empty");
    const canvas = document.getElementById("weight-chart");

    if (entries.length === 0) {
      empty.style.display = "block";
      canvas.style.display = "none";
    } else {
      empty.style.display = "none";
      canvas.style.display = "block";
      if (charts.weight) charts.weight.destroy();
      charts.weight = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels: entries.map(e => formatDate(e.date)),
          datasets: [{
            label: `Weight (${data.unit})`,
            data: entries.map(e => e.weight),
            borderColor: "#6ee7b7",
            backgroundColor: "rgba(110,231,183,0.15)",
            tension: 0.3,
            fill: true,
          }]
        },
        options: chartOptions(false)
      });
    }

    const list = document.getElementById("weight-list");
    const sortedDesc = [...data.bodyWeight].sort((a, b) => b.date.localeCompare(a.date));
    list.innerHTML = sortedDesc.map(e => `
      <div class="weight-row" data-id="${e.id}">
        <span>${formatDate(e.date)}</span>
        <span>${e.weight} ${data.unit}</span>
        <button class="btn-icon delete-weight" title="Delete">${ICON_TRASH}</button>
      </div>
    `).join("");

    list.querySelectorAll(".delete-weight").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const row = e.target.closest(".weight-row");
        const id = row.dataset.id;
        data.bodyWeight = data.bodyWeight.filter(w => w.id !== id);
        saveData();
        renderWeight();
      });
    });
  }

  // ---------- Settings ----------
  function syncUnitRadios() {
    document.querySelectorAll('input[name="unit"]').forEach(radio => {
      radio.checked = radio.value === data.unit;
    });
  }

  document.querySelectorAll('input[name="unit"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        data.unit = e.target.value;
        saveData();
        toast(`Units set to ${data.unit}`);
      }
    });
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gofitr-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.workouts)) throw new Error("Invalid file");
        data = Object.assign(defaultData(), parsed);
        saveData();
        toast("Data imported");
        showView("dashboard");
      } catch (err) {
        toast("Import failed: invalid file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("clear-btn").addEventListener("click", () => {
    if (confirm("This will permanently delete all workouts and body weight entries. Continue?")) {
      data = defaultData();
      saveData();
      toast("All data cleared");
      showView("dashboard");
    }
  });

  // ---------- Auth ----------
  function showAuthScreen() {
    document.getElementById("app-shell").classList.add("hidden");
    document.getElementById("auth-screen").classList.remove("hidden");
  }

  function bootApp(userKey, meta) {
    meta = meta || {};
    currentUser = userKey;
    authMode = meta.mode || "local";
    data = loadData();
    charts = { progress: null, weight: null };

    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");

    const users = getUsers();
    document.getElementById("account-username").textContent =
      meta.displayName || (users[userKey] && users[userKey].username) || userKey;

    document.getElementById("sets-container").innerHTML = "";
    addSetRow();
    prepLogForm();
    syncUnitRadios();
    renderDashboard();
  }

  function setAuthMode(mode) {
    const isLogin = mode === "login";
    document.getElementById("login-form").classList.toggle("active", isLogin);
    document.getElementById("signup-form").classList.toggle("active", !isLogin);
    document.getElementById("auth-switch-login").classList.toggle("hidden", !isLogin);
    document.getElementById("auth-switch-signup").classList.toggle("hidden", isLogin);
    document.getElementById("auth-title").textContent = isLogin ? "Welcome back" : "Create your account";
    document.getElementById("auth-subtitle").textContent = isLogin
      ? "Log in to keep tracking your progress."
      : "Set up a free local account to get started.";
    document.getElementById("login-error").textContent = "";
    document.getElementById("signup-error").textContent = "";
  }

  document.querySelectorAll("[data-auth]").forEach(btn => {
    btn.addEventListener("click", () => setAuthMode(btn.dataset.auth));
  });

  document.querySelectorAll(".input-toggle-visibility").forEach(btn => {
    btn.innerHTML = ICON_EYE;
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.innerHTML = showing ? ICON_EYE : ICON_EYE_OFF;
      btn.title = showing ? "Show password" : "Hide password";
      btn.setAttribute("aria-label", btn.title);
    });
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";

    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    const key = username.toLowerCase();

    const users = getUsers();
    const user = users[key];
    if (!user) { errorEl.textContent = "No account found with that username."; return; }

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.hash) { errorEl.textContent = "Incorrect password."; return; }

    setSession(key);
    e.target.reset();
    bootApp(key, { mode: "local", displayName: user.username });
  });

  document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("signup-error");
    errorEl.textContent = "";

    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-password-confirm").value;
    const key = username.toLowerCase();

    if (username.length < 3) { errorEl.textContent = "Username must be at least 3 characters."; return; }
    if (password.length < 6) { errorEl.textContent = "Password must be at least 6 characters."; return; }
    if (password !== confirmPassword) { errorEl.textContent = "Passwords do not match."; return; }

    const users = getUsers();
    if (users[key]) { errorEl.textContent = "That username is already taken."; return; }

    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    users[key] = { username, salt, hash, createdAt: new Date().toISOString() };
    saveUsers(users);

    setSession(key);
    e.target.reset();
    bootApp(key, { mode: "local", displayName: username });
  });

  document.getElementById("github-login-btn").addEventListener("click", () => {
    window.location.href = "/api/auth/github/login";
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    if (authMode === "github") {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      } catch (e) {
        // ignore — the client-side session state is cleared below regardless
      }
    }
    clearSession();
    currentUser = null;
    authMode = null;
    document.getElementById("login-form").reset();
    document.getElementById("signup-form").reset();
    setAuthMode("login");
    showAuthScreen();
  });

  // ---------- Init ----------
  (async function init() {
    try {
      const resp = await fetch("/api/me", { credentials: "same-origin" });
      if (resp.ok) {
        const json = await resp.json();
        if (json.authenticated && json.user && json.user.login) {
          bootApp("github:" + json.user.login, {
            mode: "github",
            displayName: json.user.name || json.user.login,
          });
          return;
        }
      }
    } catch (e) {
      // /api/me isn't available (e.g. local static preview with no serverless
      // functions) — fall back to the local username/password session below.
    }

    const session = getSession();
    const users = getUsers();
    if (session && users[session]) {
      bootApp(session, { mode: "local", displayName: users[session].username });
    } else {
      showAuthScreen();
    }
  })();
})();
