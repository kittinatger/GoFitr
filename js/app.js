(function () {
  "use strict";

  const USERS_KEY = "gofitr_users_v1";
  const SESSION_KEY = "gofitr_session_v1";

  // Google/Apple/GitHub go through Clerk (the publishable key is public,
  // safe to ship — it's paired with the script tag's
  // data-clerk-publishable-key in index.html).
  const CLERK_PUBLISHABLE_KEY = "pk_test_c2FmZS1haXJlZGFsZS05MTc3LmNsZXJrLmFjY291bnRzLmRldiQ";

  // Clerk's script tag loads with `async`, so it may not have finished
  // fetching/executing by the time this file runs — poll briefly for
  // window.Clerk instead of assuming it's there yet.
  function waitForClerk(timeoutMs) {
    return new Promise((resolve) => {
      if (window.Clerk) { resolve(window.Clerk); return; }
      if (!CLERK_PUBLISHABLE_KEY) { resolve(null); return; }
      const started = Date.now();
      const iv = setInterval(() => {
        if (window.Clerk || Date.now() - started > timeoutMs) {
          clearInterval(iv);
          resolve(window.Clerk || null);
        }
      }, 50);
    });
  }

  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
  const ICON_DUMBBELL = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="9" width="3" height="6" rx="1"/><rect x="20" y="9" width="3" height="6" rx="1"/><rect x="4" y="10" width="2" height="4"/><rect x="18" y="10" width="2" height="4"/><rect x="6" y="11" width="12" height="2"/></svg>';
  const ICON_SCALE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><circle cx="12" cy="12" r="3"></circle></svg>';
  const ICON_FOOD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7c-1.2-1.8-3.2-2.6-5-2 0 2 1 3.6 2.8 4.6"></path><path d="M12 8.5c-4 0-6.8 3-6.8 6.8 0 3.7 2.6 6.7 5.6 6.7.9 0 1.6-.4 2.2-.4.6 0 1.3.4 2.2.4 3 0 5.6-3 5.6-6.7 0-3.1-1.9-5-4.4-5.9"></path></svg>';
  const ICON_STAR_OUTLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
  const ICON_STAR_FILLED = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';

  const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

  const defaultData = () => ({
    workouts: [],   // { id, date: 'YYYY-MM-DD', exercise, sets: [{reps, weight}], notes }
    bodyWeight: [], // { id, date, weight }
    nutrition: [],  // { id, date, meal, name, calories, protein, carbs, fat }
    calorieGoal: 2000,
    proteinGoal: 0,
    carbsGoal: 0,
    fatGoal: 0,
    weightGoal: 0,
    unit: "kg",
    weekStart: "monday",
    mealNames: { Breakfast: "", Lunch: "", Dinner: "", Snacks: "" },
    customFoods: [], // { id, name, kcal100, protein100, carbs100, fat100, createdAt }
    savedFoods: [],  // { id, name, brand, kcal100, protein100, carbs100, fat100, savedAt }
    savedMeals: [],  // { id, name, items: [{name, calories, protein, carbs, fat}], createdAt }
    theme: "lime-dark",
    themeAuto: true,
    themeDark: "lime-dark",
    themeLight: "lime-light",
    showMacroCards: true,
    compactFoodList: false,
    heightUnit: "cm",
    bodyMeasureUnit: "cm",
    tempUnit: "c",
    glucoseUnit: "mgdl",
    sex: "male",
    distanceUnit: "km",
    speedUnit: "kmh",
    paceUnit: "minkm",
    elevationUnit: "m",
    energyUnit: "kcal",
    fluidUnit: "ml",
    servingUnit: "g",
    macroDisplay: "g",
    dateFormat: "dmy",
    timeFormat: "24h",
    healthDisclaimerShown: false,
  });

  let currentUser = null;
  let authMode = null; // "local" | "clerk"
  let data = defaultData();
  let charts = { progress: null, weight: null };
  let nutritionViewDate = null;
  let activeFoodMeal = null;
  let activeFoodBase = null; // { kcal100, protein100, carbs100, fat100 } for the Manual tab's own serving-scale field
  let activeFoodProduct = null; // full normalized product shown on the food detail page
  let activeFoodDetailServing = 100;
  let activeFoodFilter = "all";
  let activeFoodCategory = "All";
  let pendingReturnMeal = null;

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

  function showConfirm(message) {
    const overlay = document.getElementById("confirm-overlay");
    const messageEl = document.getElementById("confirm-message");
    const okBtn = document.getElementById("confirm-ok");
    const cancelBtn = document.getElementById("confirm-cancel");

    messageEl.textContent = message;
    overlay.classList.add("show");

    return new Promise(resolve => {
      function cleanup(result) {
        overlay.classList.remove("show");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        overlay.removeEventListener("click", onOverlayClick);
        document.removeEventListener("keydown", onKeydown);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }
      function onKeydown(e) { if (e.key === "Escape") cleanup(false); }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("click", onOverlayClick);
      document.addEventListener("keydown", onKeydown);
    });
  }

  // ---------- Navigation ----------
  const MAIN_VIEWS = new Set(["dashboard","history","progress","weight","nutrition","settings"]);
  let _prevView = null;

  function showView(view) {
    const prev = _prevView;
    const goingDeep = !MAIN_VIEWS.has(view);
    const comingBack = prev && !MAIN_VIEWS.has(prev) && MAIN_VIEWS.has(view);
    const subToSub   = prev && !MAIN_VIEWS.has(prev) && !MAIN_VIEWS.has(view);
    const animClass  = comingBack               ? "anim-slide-left"
                     : (goingDeep || subToSub)  ? "anim-slide-right"
                     : "anim-fade";
    _prevView = view;

    document.querySelectorAll(".view").forEach(v => {
      v.classList.remove("active","anim-slide-right","anim-slide-left","anim-fade");
    });
    const el = document.getElementById("view-" + view);
    el.classList.add("active", animClass);
    el.scrollTop = 0;

    document.querySelectorAll(".nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.view === view);
    });
    if (view === "dashboard") renderDashboard();
    if (view === "history") renderHistory();
    if (view === "progress") renderProgress();
    if (view === "weight") renderWeight();
    if (view === "nutrition") renderNutrition();
    if (view === "settings") renderSettings();
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
    document.getElementById("log-exercise").value = "";
    const lbl = document.getElementById("exercise-picker-label");
    lbl.textContent = "Select exercise...";
    lbl.classList.add("exercise-picker-placeholder");
    refreshExerciseOptions();
  }

  // ---------- Exercise Picker ----------
  let activeMuscleFiler = "All";

  function renderExercisePicker() {
    const db = (window.GOFITR_EXERCISE_DATABASE || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const query = (document.getElementById("exercise-search").value || "").trim().toLowerCase();
    let items = activeMuscleFiler === "All" ? db : db.filter(e => e.muscle === activeMuscleFiler);
    if (query) items = items.filter(e => e.name.toLowerCase().includes(query));

    const infoIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

    const customRow = query && !items.find(e => e.name.toLowerCase() === query)
      ? `<div class="exercise-row exercise-row--custom">`
        + `<button type="button" class="exercise-row-select" data-name="${escapeHtml(query)}">`
        + `<div class="exercise-row-info"><span class="exercise-row-name">Use "${escapeHtml(query)}"</span>`
        + `<span class="exercise-row-muscle">Custom exercise</span></div></button></div>`
      : "";

    let html = customRow;
    let lastLetter = null;
    for (const ex of items) {
      const letter = ex.name[0].toUpperCase();
      if (letter !== lastLetter) {
        html += `<div class="exercise-letter-header">${letter}</div>`;
        lastLetter = letter;
      }
      html += `<div class="exercise-row">`
        + `<button type="button" class="exercise-row-select" data-name="${escapeHtml(ex.name)}">`
        + `<div class="exercise-row-info"><span class="exercise-row-name">${escapeHtml(ex.name)}</span>`
        + `<span class="exercise-row-muscle">${escapeHtml(ex.muscle)}</span></div></button>`
        + `<button type="button" class="exercise-row-info-btn" data-name="${escapeHtml(ex.name)}" title="About this exercise">${infoIcon}</button>`
        + `</div>`;
    }
    if (!html) html = `<p class="empty-state" style="padding:24px 16px;">No exercises found.</p>`;

    const list = document.getElementById("exercise-picker-list");
    list.innerHTML = html;
    list.querySelectorAll(".exercise-row-select").forEach(btn => {
      btn.addEventListener("click", () => selectExercise(btn.dataset.name));
    });
    list.querySelectorAll(".exercise-row-info-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const ex = (window.GOFITR_EXERCISE_DATABASE || []).find(e => e.name === btn.dataset.name)
          || { name: btn.dataset.name, muscle: "Custom", equipment: "—", desc: "" };
        showExerciseInfo(ex);
      });
    });
  }

  function selectExercise(name) {
    document.getElementById("log-exercise").value = name;
    const lbl = document.getElementById("exercise-picker-label");
    lbl.textContent = name;
    lbl.classList.remove("exercise-picker-placeholder");
    showView("log");
  }

  function showExerciseInfo(ex) {
    document.getElementById("exercise-info-name").textContent = ex.name;
    document.getElementById("exercise-info-muscle").textContent = ex.muscle;
    document.getElementById("exercise-info-equipment").textContent = ex.equipment;
    document.getElementById("exercise-info-desc").textContent = ex.desc || "";
    document.getElementById("exercise-info-select").onclick = () => selectExercise(ex.name);
    showFoodPage("view-exercise-info");
  }

  document.getElementById("exercise-info-back").addEventListener("click", () => showFoodPage("view-exercise-picker"));

  document.getElementById("exercise-picker-trigger").addEventListener("click", () => {
    activeMuscleFiler = "All";
    document.getElementById("exercise-search").value = "";
    document.querySelectorAll(".exercise-muscle-chip").forEach(c => c.classList.toggle("active", c.dataset.muscle === "All"));
    renderExercisePicker();
    showView("exercise-picker");
  });

  document.getElementById("exercise-picker-back").addEventListener("click", () => showView("log"));

  document.getElementById("exercise-search").addEventListener("input", renderExercisePicker);

  document.getElementById("exercise-muscle-chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".exercise-muscle-chip");
    if (!chip) return;
    activeMuscleFiler = chip.dataset.muscle;
    document.querySelectorAll(".exercise-muscle-chip").forEach(c => c.classList.toggle("active", c === chip));
    renderExercisePicker();
  });

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
      row.classList.add("removing");
      row.addEventListener("animationend", () => {
        row.remove();
        renumberSets();
      }, { once: true });
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
    prepLogForm();
    showView("history");
  });

  // ---------- Dashboard ----------
  function volumeOf(workout) {
    return workout.sets.reduce((sum, s) => sum + (s.reps * s.weight), 0);
  }

  function startOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const offset = (data.weekStart === "sunday") ? 0 : 1;
    const diff = (day === 0 ? -7 + offset : offset) - day;
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

    const streak = computeStreak();
    document.getElementById("stat-streak").textContent = streak;
    const ring = document.getElementById("streak-ring");
    const circumference = 2 * Math.PI * 52;
    const fraction = Math.min(streak, 7) / 7;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference * (1 - fraction));

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
        <div class="workout-icon">${ICON_DUMBBELL}</div>
        <div class="workout-body">
          <div class="workout-card-header">
            <span class="workout-exercise">${escapeHtml(w.exercise)}</span>
            <span class="workout-date">${formatDate(w.date)}</span>
          </div>
          <div class="workout-sets">${setsHtml}</div>
          ${w.notes ? `<div class="workout-notes">${escapeHtml(w.notes)}</div>` : ""}
        </div>
        <div class="workout-actions">
          <button class="btn-icon delete-workout" title="Delete">${ICON_TRASH}</button>
        </div>
      </div>
    `;
  }

  function attachWorkoutCardHandlers(container) {
    container.querySelectorAll(".delete-workout").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const card = e.target.closest(".workout-card");
        const id = card.dataset.id;
        const ok = await showConfirm("Delete this workout entry? This can't be undone.");
        if (!ok) return;
        card.classList.add("removing");
        card.addEventListener("animationend", () => {
          data.workouts = data.workouts.filter(w => w.id !== id);
          saveData();
          renderDashboard();
          renderHistory();
          renderProgress();
        }, { once: true });
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
            borderColor: "#d7ff3d",
            backgroundColor: "rgba(215,255,61,0.14)",
            tension: 0.3,
            yAxisID: "y",
            fill: true,
          },
          {
            label: `Volume (${data.unit})`,
            data: volumes,
            borderColor: "#ff6b57",
            backgroundColor: "rgba(255,107,87,0.1)",
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
        legend: { labels: { color: "#f3f4ec", font: { family: "'Plus Jakarta Sans', sans-serif" } } },
      },
      scales: {
        x: { ticks: { color: "#8a8f7e" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#8a8f7e" }, grid: { color: "rgba(255,255,255,0.06)" }, position: "left" },
      }
    };
    if (dualAxis) {
      opts.scales.y1 = { ticks: { color: "#8a8f7e" }, grid: { display: false }, position: "right" };
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
            borderColor: "#d7ff3d",
            backgroundColor: "rgba(215,255,61,0.14)",
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
        <div class="weight-icon">${ICON_SCALE}</div>
        <div class="weight-row-body">
          <span class="weight-row-date">${formatDate(e.date)}</span>
          <span class="weight-row-value">${e.weight} ${data.unit}</span>
        </div>
        <button class="btn-icon delete-weight" title="Delete">${ICON_TRASH}</button>
      </div>
    `).join("");

    list.querySelectorAll(".delete-weight").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const row = e.target.closest(".weight-row");
        const id = row.dataset.id;
        const ok = await showConfirm("Delete this body weight entry?");
        if (!ok) return;
        row.classList.add("removing");
        row.addEventListener("animationend", () => {
          data.bodyWeight = data.bodyWeight.filter(w => w.id !== id);
          saveData();
          renderWeight();
        }, { once: true });
      });
    });
  }

  // ---------- Nutrition ----------
  function nutritionDateLabel(dateStr) {
    if (dateStr === todayStr()) return "Today";
    const yesterday = new Date(todayStr() + "T00:00:00");
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === dateKey(yesterday)) return "Yesterday";
    return formatDate(dateStr);
  }

  function shiftNutritionDate(deltaDays) {
    const d = new Date(nutritionViewDate + "T00:00:00");
    d.setDate(d.getDate() + deltaDays);
    nutritionViewDate = dateKey(d);
    renderNutrition();
  }

  document.getElementById("nutrition-prev-day").addEventListener("click", () => shiftNutritionDate(-1));
  document.getElementById("nutrition-next-day").addEventListener("click", () => shiftNutritionDate(1));

  function foodItemHtml(item) {
    const macroParts = [];
    if (item.protein) macroParts.push(`${item.protein}g protein`);
    if (item.carbs) macroParts.push(`${item.carbs}g carbs`);
    if (item.fat) macroParts.push(`${item.fat}g fat`);
    return `
      <div class="food-item" data-id="${item.id}">
        <div class="food-icon">${ICON_FOOD}</div>
        <div class="food-item-body">
          <div class="food-item-name">${escapeHtml(item.name)}</div>
          ${macroParts.length ? `<div class="food-item-macros">${macroParts.join(" · ")}</div>` : ""}
        </div>
        <div class="food-item-calories">${Math.round(item.calories)} kcal</div>
        <button class="btn-icon delete-food" title="Delete">${ICON_TRASH}</button>
      </div>
    `;
  }

  function renderNutrition() {
    if (!nutritionViewDate) nutritionViewDate = todayStr();
    document.getElementById("nutrition-date-label").textContent = nutritionDateLabel(nutritionViewDate);

    const entries = data.nutrition.filter(n => n.date === nutritionViewDate);

    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    entries.forEach(e => {
      totalCalories += e.calories || 0;
      totalProtein += e.protein || 0;
      totalCarbs += e.carbs || 0;
      totalFat += e.fat || 0;
    });

    MEALS.forEach(meal => {
      const heading = document.querySelector(`[data-meal-heading="${meal}"]`);
      if (heading) heading.textContent = displayMealName(meal);
      const list = document.querySelector(`.food-list[data-meal-list="${meal}"]`);
      const mealEntries = entries.filter(e => e.meal === meal);
      if (mealEntries.length === 0) {
        list.innerHTML = `<p class="empty-state" style="padding:14px 0;">No items yet.</p>`;
      } else {
        list.innerHTML = mealEntries.map(foodItemHtml).join("");
        list.querySelectorAll(".delete-food").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            const row = e.target.closest(".food-item");
            const id = row.dataset.id;
            const ok = await showConfirm("Delete this food entry?");
            if (!ok) return;
            row.classList.add("removing");
            row.addEventListener("animationend", () => {
              data.nutrition = data.nutrition.filter(n => n.id !== id);
              saveData();
              renderNutrition();
            }, { once: true });
          });
        });
      }
    });

    const goal = data.calorieGoal || 2000;
    document.getElementById("stat-calories").textContent = Math.round(totalCalories);
    document.getElementById("calorie-ring-label").textContent = `of ${goal} kcal`;

    function macroHtml(value, goalVal) {
      const rounded = Math.round(value);
      if (goalVal > 0) return `${rounded}<span class="stat-unit">/ ${goalVal}g</span>`;
      return `${rounded}<span class="stat-unit">g</span>`;
    }
    document.getElementById("stat-protein").innerHTML = macroHtml(totalProtein, data.proteinGoal);
    document.getElementById("stat-carbs").innerHTML   = macroHtml(totalCarbs,   data.carbsGoal);
    document.getElementById("stat-fat").innerHTML     = macroHtml(totalFat,     data.fatGoal);

    const ring = document.getElementById("calorie-ring");
    const circumference = 2 * Math.PI * 52;
    const fraction = goal > 0 ? Math.min(totalCalories / goal, 1) : 0;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference * (1 - fraction));
  }

  // Add Food / Add Custom Food / Create Meal are real full-page views (like
  // Nutrition, Dashboard, etc.) rather than centered popups — a fixed
  // centered overlay was unreliable on iPad Safari. Switching between them
  // just swaps which .view is active, same mechanism as the sidebar nav.
  const FOOD_VIEWS = ["view-nutrition","view-food","view-food-detail","view-custom-food","view-meal-builder","view-exercise-picker","view-exercise-info"];
  function showFoodPage(id) {
    FOOD_VIEWS.forEach(v => document.getElementById(v).classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  function openFoodModal(meal) {
    activeFoodMeal = meal;
    activeFoodBase = null;
    document.getElementById("food-dialog-meal").textContent = "— " + meal;
    document.getElementById("food-form").reset();
    document.getElementById("food-serving").value = 100;
    setFoodSourceTab("manual");
    document.getElementById("all-foods-search").value = "";
    setFoodFilter("all");
    showFoodPage("view-food");
    document.getElementById("food-name").focus();
  }

  function closeFoodModal() {
    document.getElementById("view-food").classList.remove("active");
    document.getElementById("all-foods-list").innerHTML = "";
    activeFoodMeal = null;
  }

  function reopenFoodModal(filter) {
    document.getElementById("food-dialog-meal").textContent = "— " + activeFoodMeal;
    showFoodPage("view-food");
    setFoodSourceTab("search");
    setFoodFilter(filter);
  }

  function setFoodSourceTab(source) {
    document.querySelectorAll(".food-source-tab").forEach(t => t.classList.toggle("active", t.dataset.source === source));
    document.querySelectorAll(".food-source-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === source));
  }

  document.querySelectorAll(".food-source-tab").forEach(tab => {
    tab.addEventListener("click", () => setFoodSourceTab(tab.dataset.source));
  });

  function round1(n) { return Math.round(n * 10) / 10; }

  function applyServingScale() {
    if (!activeFoodBase) return;
    const serving = parseFloat(document.getElementById("food-serving").value) || 0;
    const factor = serving / 100;
    document.getElementById("food-calories").value = Math.round(activeFoodBase.kcal100 * factor);
    document.getElementById("food-protein").value = round1(activeFoodBase.protein100 * factor);
    document.getElementById("food-carbs").value = round1(activeFoodBase.carbs100 * factor);
    document.getElementById("food-fat").value = round1(activeFoodBase.fat100 * factor);
  }

  document.getElementById("food-serving").addEventListener("input", applyServingScale);

  // ---------- Food detail page ----------
  // Shown whenever a concrete food is picked (My Foods, Saved Foods) — a
  // fuller view of that specific food (meal type, serving, macros,
  // micronutrients) before it's actually logged. Manual entry skips this
  // since there's no stored food object to show details for.
  const MICRO_FIELDS = [
    { key: "vitaminA", label: "Vitamin A", unit: "mcg" },
    { key: "vitaminC", label: "Vitamin C", unit: "mg" },
    { key: "vitaminD", label: "Vitamin D", unit: "mcg" },
    { key: "vitaminE", label: "Vitamin E", unit: "mg" },
    { key: "vitaminK", label: "Vitamin K", unit: "mcg" },
    { key: "vitaminB1", label: "Vitamin B1", unit: "mg" },
    { key: "vitaminB2", label: "Vitamin B2", unit: "mg" },
    { key: "vitaminB3", label: "Vitamin B3", unit: "mg" },
    { key: "vitaminB5", label: "Vitamin B5", unit: "mg" },
    { key: "vitaminB6", label: "Vitamin B6", unit: "mg" },
    { key: "vitaminB12", label: "Vitamin B12", unit: "mcg" },
    { key: "calcium", label: "Calcium", unit: "mg" },
    { key: "iron", label: "Iron", unit: "mg" },
    { key: "magnesium", label: "Magnesium", unit: "mg" },
    { key: "phosphorus", label: "Phosphorus", unit: "mg" },
    { key: "potassium", label: "Potassium", unit: "mg" },
    { key: "sodium", label: "Sodium", unit: "mg" },
    { key: "zinc", label: "Zinc", unit: "mg" },
    { key: "copper", label: "Copper", unit: "mg" },
    { key: "manganese", label: "Manganese", unit: "mg" },
  ];

  function showFoodDetail(product) {
    activeFoodProduct = {
      name: product.name || "Unknown food",
      kcal100: product.kcal100 || 0,
      protein100: product.protein100 || 0,
      carbs100: product.carbs100 || 0,
      fat100: product.fat100 || 0,
      micros100: product.micros100 || {},
    };
    activeFoodDetailServing = 100;
    document.getElementById("food-detail-name").textContent = activeFoodProduct.name;
    document.getElementById("food-detail-serving").value = 100;
    renderFoodDetailMealButtons();
    renderFoodDetailStar();
    renderFoodDetailMacros();
    showFoodPage("view-food-detail");
  }

  function renderFoodDetailMealButtons() {
    document.querySelectorAll(".food-detail-meal-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.meal === activeFoodMeal);
    });
  }

  function renderFoodDetailStar() {
    const starred = isFoodSaved(activeFoodProduct);
    const btn = document.getElementById("food-detail-star-btn");
    btn.classList.toggle("starred", starred);
    btn.innerHTML = starred ? ICON_STAR_FILLED : ICON_STAR_OUTLINE;
    btn.title = starred ? "Remove bookmark" : "Save for later";
  }

  function renderFoodDetailMacros() {
    const factor = activeFoodDetailServing / 100;
    const p = activeFoodProduct;
    document.getElementById("food-detail-calories").textContent = Math.round(p.kcal100 * factor);
    document.getElementById("food-detail-protein").textContent = round1(p.protein100 * factor) + "g";
    document.getElementById("food-detail-carbs").textContent = round1(p.carbs100 * factor) + "g";
    document.getElementById("food-detail-fat").textContent = round1(p.fat100 * factor) + "g";

    const m = p.micros100 || {};
    document.getElementById("food-detail-transfat").textContent = round1((m.transFat || 0) * factor) + "g";
    document.getElementById("food-detail-satfat").textContent = round1((m.saturatedFat || 0) * factor) + "g";
    document.getElementById("food-detail-fiber").textContent = round1((m.fiber || 0) * factor) + "g";

    document.getElementById("food-detail-micros").innerHTML = MICRO_FIELDS.map(f => {
      const val = round1((m[f.key] || 0) * factor);
      return `<div class="food-detail-macro-line"><span>${f.label}</span><span>${val}${f.unit}</span></div>`;
    }).join("");
  }

  // ---------- Shared food-row rendering (My Foods, Saved Foods) ----------
  function foodKey(item) {
    return (item.name || "").trim().toLowerCase();
  }

  function isFoodSaved(item) {
    return data.savedFoods.some(f => foodKey(f) === foodKey(item));
  }

  function toggleSavedFood(item) {
    const key = foodKey(item);
    const idx = data.savedFoods.findIndex(f => foodKey(f) === key);
    if (idx !== -1) {
      data.savedFoods.splice(idx, 1);
    } else {
      data.savedFoods.push({
        id: uid(),
        name: item.name,
        brand: item.brand || "",
        kcal100: item.kcal100 || 0,
        protein100: item.protein100 || 0,
        carbs100: item.carbs100 || 0,
        fat100: item.fat100 || 0,
        savedAt: new Date().toISOString(),
      });
    }
    saveData();
  }

  function foodRowHtml(item, i, opts) {
    opts = opts || {};
    const metaBits = [];
    if (item.brand) metaBits.push(escapeHtml(item.brand));
    metaBits.push(`${Math.round(item.kcal100 || 0)} kcal/100g`);
    const starred = isFoodSaved(item);
    const trailingBtn = opts.deletable
      ? `<button type="button" class="food-star-btn food-row-delete" data-index="${i}" title="Delete">${ICON_TRASH}</button>`
      : `<button type="button" class="food-star-btn ${starred ? "starred" : ""}" data-index="${i}" title="${starred ? "Remove bookmark" : "Save for later"}">${starred ? ICON_STAR_FILLED : ICON_STAR_OUTLINE}</button>`;
    return `
      <div class="food-search-result">
        <button type="button" class="food-search-result-main" data-index="${i}">
          <span class="food-search-result-name">${escapeHtml(item.name)}</span>
          <span class="food-search-result-meta">
            ${metaBits.join(" · ")}
            ${item.source ? `<span class="food-source-badge">${escapeHtml(item.source)}</span>` : ""}
          </span>
        </button>
        ${trailingBtn}
      </div>
    `;
  }

  function wireFoodRows(container, items, opts) {
    opts = opts || {};
    container.querySelectorAll(".food-search-result-main").forEach(btn => {
      const item = items[Number(btn.dataset.index)];
      btn.addEventListener("click", () => {
        if (opts.onSelect) opts.onSelect(item);
        else showFoodDetail(item);
      });
    });
    if (opts.deletable) {
      container.querySelectorAll(".food-row-delete").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const item = items[Number(btn.dataset.index)];
          const ok = await showConfirm(`Delete "${item.name}"?`);
          if (!ok) return;
          opts.onDelete(item);
        });
      });
    } else {
      container.querySelectorAll(".food-star-btn:not(.food-row-delete)").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const item = items[Number(btn.dataset.index)];
          toggleSavedFood(item);
          renderActiveFoodFilterPanel();
        });
      });
    }
  }

  // ---------- Filter chips: All Foods / My Foods / My Meals / Saved Foods ----------
  function setFoodFilter(filter) {
    activeFoodFilter = filter;
    document.querySelectorAll(".food-filter-chip").forEach(c => c.classList.toggle("active", c.dataset.filter === filter));
    document.querySelectorAll(".food-filter-panel").forEach(p => p.classList.toggle("active", p.dataset.filterPanel === filter));
    renderActiveFoodFilterPanel();
  }

  document.querySelectorAll(".food-filter-chip").forEach(chip => {
    chip.addEventListener("click", () => setFoodFilter(chip.dataset.filter));
  });

  function renderActiveFoodFilterPanel() {
    if (activeFoodFilter === "all") renderAllFoods();
    else if (activeFoodFilter === "mine") renderMyFoods();
    else if (activeFoodFilter === "meals") renderMyMeals();
    else if (activeFoodFilter === "saved") renderSavedFoods();
  }

  // ---------- Built-in common-foods database (js/food-database.js) ----------
  function renderAllFoods() {
    const container = document.getElementById("all-foods-list");
    const database = window.GOFITR_FOOD_DATABASE || [];
    const query = (document.getElementById("all-foods-search").value || "").trim().toLowerCase();
    let items = database;
    if (activeFoodCategory !== "All") {
      items = items.filter(item => item.category === activeFoodCategory);
    }
    if (query) {
      items = items.filter(item => item.name.toLowerCase().includes(query));
    }
    if (items.length === 0) {
      container.innerHTML = `<p class="empty-state" style="padding:14px 0;">No foods found.</p>`;
      return;
    }
    const MAX = 50;
    const shown = items.slice(0, MAX);
    const overflow = items.length > MAX;
    container.innerHTML = shown.map((item, i) => foodRowHtml(item, i)).join("") +
      (overflow ? `<p class="empty-state" style="padding:10px 0;font-size:0.8rem;">Showing ${MAX} of ${items.length} — search to filter</p>` : "");
    wireFoodRows(container, shown, { onSelect: (item) => showFoodDetail(item) });
  }

  document.querySelectorAll(".food-category-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      activeFoodCategory = chip.dataset.category;
      document.querySelectorAll(".food-category-chip").forEach(c => c.classList.toggle("active", c === chip));
      renderAllFoods();
    });
  });

  document.getElementById("all-foods-search").addEventListener("input", renderAllFoods);

  function renderMyFoods() {
    const container = document.getElementById("my-foods-list");
    if (data.customFoods.length === 0) {
      container.innerHTML = `<p class="empty-state" style="padding:14px 0;">No custom foods yet.</p>`;
      return;
    }
    container.innerHTML = data.customFoods.map((f, i) => foodRowHtml(f, i, { deletable: true })).join("");
    wireFoodRows(container, data.customFoods, {
      onSelect: (item) => showFoodDetail(item),
      deletable: true,
      onDelete: (item) => {
        data.customFoods = data.customFoods.filter(f => f.id !== item.id);
        saveData();
        renderMyFoods();
      },
    });
  }

  function renderSavedFoods() {
    const container = document.getElementById("saved-foods-list");
    if (data.savedFoods.length === 0) {
      container.innerHTML = `<p class="empty-state" style="padding:14px 0;">No saved foods yet. Tap the star on any food to bookmark it.</p>`;
      return;
    }
    container.innerHTML = data.savedFoods.map((f, i) => foodRowHtml(f, i)).join("");
    wireFoodRows(container, data.savedFoods, {
      onSelect: (item) => showFoodDetail(item),
    });
  }

  function mealRowHtml(meal, i) {
    const totalCal = meal.items.reduce((sum, it) => sum + (it.calories || 0), 0);
    return `
      <div class="food-search-result">
        <button type="button" class="food-search-result-main" data-index="${i}">
          <span class="food-search-result-name">${escapeHtml(meal.name)}</span>
          <span class="food-search-result-meta">${meal.items.length} item${meal.items.length === 1 ? "" : "s"} · ${Math.round(totalCal)} kcal total</span>
        </button>
        <button type="button" class="food-star-btn food-row-delete" data-index="${i}" title="Delete meal">${ICON_TRASH}</button>
      </div>
    `;
  }

  function renderMyMeals() {
    const container = document.getElementById("my-meals-list");
    if (data.savedMeals.length === 0) {
      container.innerHTML = `<p class="empty-state" style="padding:14px 0;">No saved meals yet.</p>`;
      return;
    }
    container.innerHTML = data.savedMeals.map(mealRowHtml).join("");
    container.querySelectorAll(".food-search-result-main").forEach(btn => {
      btn.addEventListener("click", () => applyMeal(data.savedMeals[Number(btn.dataset.index)]));
    });
    container.querySelectorAll(".food-row-delete").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const meal = data.savedMeals[Number(btn.dataset.index)];
        const ok = await showConfirm(`Delete meal "${meal.name}"?`);
        if (!ok) return;
        data.savedMeals = data.savedMeals.filter(m => m.id !== meal.id);
        saveData();
        renderMyMeals();
      });
    });
  }

  function applyMeal(meal) {
    const dateForEntry = nutritionViewDate || todayStr();
    meal.items.forEach(item => {
      data.nutrition.push({
        id: uid(),
        date: dateForEntry,
        meal: activeFoodMeal,
        name: item.name,
        calories: item.calories || 0,
        protein: item.protein || 0,
        carbs: item.carbs || 0,
        fat: item.fat || 0,
      });
    });
    saveData();
    closeFoodModal();
    showFoodPage("view-nutrition");
    renderNutrition();
    toast(`Added ${meal.items.length} item${meal.items.length === 1 ? "" : "s"} from "${meal.name}"`);
  }

  document.querySelectorAll(".add-food-btn").forEach(btn => {
    btn.addEventListener("click", () => openFoodModal(btn.dataset.meal));
  });

  function cancelFoodModal() {
    closeFoodModal();
    showFoodPage("view-nutrition");
  }

  document.getElementById("food-cancel").addEventListener("click", cancelFoodModal);
  document.getElementById("food-page-back").addEventListener("click", cancelFoodModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("view-food").classList.contains("active")) {
      cancelFoodModal();
    }
  });

  document.querySelectorAll(".food-detail-meal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFoodMeal = btn.dataset.meal;
      renderFoodDetailMealButtons();
    });
  });

  document.getElementById("food-detail-serving").addEventListener("input", (e) => {
    activeFoodDetailServing = parseFloat(e.target.value) || 0;
    renderFoodDetailMacros();
  });

  document.getElementById("food-detail-star-btn").addEventListener("click", () => {
    toggleSavedFood(activeFoodProduct);
    renderFoodDetailStar();
  });

  function returnToFoodSearch() {
    document.getElementById("view-food-detail").classList.remove("active");
    reopenFoodModal(activeFoodFilter);
  }

  document.getElementById("food-detail-back").addEventListener("click", returnToFoodSearch);
  document.getElementById("food-detail-cancel").addEventListener("click", returnToFoodSearch);

  document.getElementById("food-detail-add-btn").addEventListener("click", () => {
    if (!activeFoodMeal) { toast("Pick a meal type first"); return; }
    const factor = activeFoodDetailServing / 100;
    const p = activeFoodProduct;
    const m = p.micros100 || {};
    const micros = {};
    MICRO_FIELDS.forEach(f => { micros[f.key] = round1((m[f.key] || 0) * factor); });

    data.nutrition.push({
      id: uid(),
      date: nutritionViewDate || todayStr(),
      meal: activeFoodMeal,
      name: p.name,
      calories: Math.round(p.kcal100 * factor),
      protein: round1(p.protein100 * factor),
      carbs: round1(p.carbs100 * factor),
      fat: round1(p.fat100 * factor),
      transFat: round1((m.transFat || 0) * factor),
      saturatedFat: round1((m.saturatedFat || 0) * factor),
      fiber: round1((m.fiber || 0) * factor),
      micros,
    });
    saveData();
    toast("Food added");
    document.getElementById("view-food-detail").classList.remove("active");
    closeFoodModal();
    showFoodPage("view-nutrition");
    renderNutrition();
  });

  document.getElementById("food-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("food-name").value.trim();
    const calories = parseFloat(document.getElementById("food-calories").value);
    const protein = parseFloat(document.getElementById("food-protein").value) || 0;
    const carbs = parseFloat(document.getElementById("food-carbs").value) || 0;
    const fat = parseFloat(document.getElementById("food-fat").value) || 0;

    if (!name) { toast("Enter a food name"); return; }
    if (isNaN(calories) || calories < 0) { toast("Enter valid calories"); return; }

    data.nutrition.push({
      id: uid(),
      date: nutritionViewDate || todayStr(),
      meal: activeFoodMeal,
      name, calories, protein, carbs, fat,
    });
    saveData();
    toast("Food added");
    closeFoodModal();
    showFoodPage("view-nutrition");
    renderNutrition();
  });

  document.getElementById("food-save-btn").addEventListener("click", () => {
    const name = document.getElementById("food-name").value.trim();
    const calories = parseFloat(document.getElementById("food-calories").value);
    if (!name || isNaN(calories)) { toast("Fill in a name and calories first"); return; }
    const serving = parseFloat(document.getElementById("food-serving").value) || 100;
    const protein = parseFloat(document.getElementById("food-protein").value) || 0;
    const carbs = parseFloat(document.getElementById("food-carbs").value) || 0;
    const fat = parseFloat(document.getElementById("food-fat").value) || 0;
    const factor = 100 / serving;
    const item = {
      name,
      brand: "",
      kcal100: Math.round(calories * factor),
      protein100: round1(protein * factor),
      carbs100: round1(carbs * factor),
      fat100: round1(fat * factor),
    };
    toggleSavedFood(item);
    toast(isFoodSaved(item) ? "Saved for later" : "Removed from saved");
  });

  // ---------- Custom foods (My Foods) ----------
  function openCustomFoodModal(returnMeal) {
    pendingReturnMeal = returnMeal;
    document.getElementById("custom-food-form").reset();
    document.getElementById("custom-food-serving").value = 100;
    showFoodPage("view-custom-food");
    document.getElementById("custom-food-name").focus();
  }

  function closeCustomFoodModal() {
    document.getElementById("view-custom-food").classList.remove("active");
  }

  document.getElementById("food-quick-add-btn").addEventListener("click", () => {
    const returnMeal = activeFoodMeal;
    closeFoodModal();
    openCustomFoodModal(returnMeal);
  });

  document.getElementById("add-custom-food-btn").addEventListener("click", () => {
    const returnMeal = activeFoodMeal;
    closeFoodModal();
    openCustomFoodModal(returnMeal);
  });

  document.getElementById("custom-food-cancel").addEventListener("click", () => {
    closeCustomFoodModal();
    activeFoodMeal = pendingReturnMeal;
    reopenFoodModal("mine");
  });

  document.getElementById("custom-food-page-back").addEventListener("click", () => {
    closeCustomFoodModal();
    activeFoodMeal = pendingReturnMeal;
    reopenFoodModal("mine");
  });

  document.getElementById("custom-food-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("custom-food-name").value.trim();
    const serving = parseFloat(document.getElementById("custom-food-serving").value) || 100;
    const calories = parseFloat(document.getElementById("custom-food-calories").value);
    const protein = parseFloat(document.getElementById("custom-food-protein").value) || 0;
    const carbs = parseFloat(document.getElementById("custom-food-carbs").value) || 0;
    const fat = parseFloat(document.getElementById("custom-food-fat").value) || 0;

    if (!name) { toast("Enter a food name"); return; }
    if (isNaN(calories) || calories < 0) { toast("Enter valid calories"); return; }

    const factor = 100 / serving;
    data.customFoods.push({
      id: uid(),
      name,
      kcal100: Math.round(calories * factor),
      protein100: round1(protein * factor),
      carbs100: round1(carbs * factor),
      fat100: round1(fat * factor),
      createdAt: new Date().toISOString(),
    });
    saveData();
    toast("Custom food saved");
    closeCustomFoodModal();
    activeFoodMeal = pendingReturnMeal;
    reopenFoodModal("mine");
  });

  // ---------- Meal builder (My Meals) ----------
  function addMealItemRow() {
    const container = document.getElementById("meal-items-container");
    const row = document.createElement("div");
    row.className = "meal-item-row";
    row.innerHTML = `
      <input type="text" class="meal-item-name" placeholder="Food name">
      <div class="meal-item-macros">
        <input type="number" class="meal-item-calories" placeholder="kcal" min="0">
        <input type="number" class="meal-item-protein" placeholder="P g" min="0" step="0.1">
        <input type="number" class="meal-item-carbs" placeholder="C g" min="0" step="0.1">
        <input type="number" class="meal-item-fat" placeholder="F g" min="0" step="0.1">
        <button type="button" class="meal-item-remove" title="Remove">${ICON_X}</button>
      </div>
    `;
    row.querySelector(".meal-item-remove").addEventListener("click", () => {
      row.classList.add("removing");
      row.addEventListener("animationend", () => row.remove(), { once: true });
    });
    container.appendChild(row);
  }

  function openMealBuilder(returnMeal) {
    pendingReturnMeal = returnMeal;
    document.getElementById("meal-name-input").value = "";
    document.getElementById("meal-items-container").innerHTML = "";
    addMealItemRow();
    showFoodPage("view-meal-builder");
  }

  function closeMealBuilder() {
    document.getElementById("view-meal-builder").classList.remove("active");
  }

  document.getElementById("create-meal-btn").addEventListener("click", () => {
    const returnMeal = activeFoodMeal;
    closeFoodModal();
    openMealBuilder(returnMeal);
  });

  document.getElementById("meal-add-item-btn").addEventListener("click", addMealItemRow);

  document.getElementById("meal-builder-cancel").addEventListener("click", () => {
    closeMealBuilder();
    activeFoodMeal = pendingReturnMeal;
    reopenFoodModal("meals");
  });

  document.getElementById("meal-builder-page-back").addEventListener("click", () => {
    closeMealBuilder();
    activeFoodMeal = pendingReturnMeal;
    reopenFoodModal("meals");
  });

  document.getElementById("meal-builder-save").addEventListener("click", () => {
    const name = document.getElementById("meal-name-input").value.trim();
    const rows = Array.from(document.querySelectorAll("#meal-items-container .meal-item-row"));
    const items = rows.map(row => ({
      name: row.querySelector(".meal-item-name").value.trim(),
      calories: parseFloat(row.querySelector(".meal-item-calories").value) || 0,
      protein: parseFloat(row.querySelector(".meal-item-protein").value) || 0,
      carbs: parseFloat(row.querySelector(".meal-item-carbs").value) || 0,
      fat: parseFloat(row.querySelector(".meal-item-fat").value) || 0,
    })).filter(it => it.name);

    if (!name) { toast("Enter a meal name"); return; }
    if (items.length === 0) { toast("Add at least one item with a name"); return; }

    data.savedMeals.push({ id: uid(), name, items, createdAt: new Date().toISOString() });
    saveData();
    toast("Meal saved");
    closeMealBuilder();
    activeFoodMeal = pendingReturnMeal;
    reopenFoodModal("meals");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.getElementById("view-custom-food").classList.contains("active")) {
      closeCustomFoodModal();
      activeFoodMeal = pendingReturnMeal;
      reopenFoodModal("mine");
    } else if (document.getElementById("view-meal-builder").classList.contains("active")) {
      closeMealBuilder();
      activeFoodMeal = pendingReturnMeal;
      reopenFoodModal("meals");
    }
  });


  // ---------- CSV import utilities ----------
  function splitCSVRow(row) {
    const result = [];
    let cur = "", inQ = false;
    for (const ch of row) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const headers = splitCSVRow(lines[0]);
    return lines.slice(1).filter(l => l.trim()).map(l => {
      const vals = splitCSVRow(l);
      return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i] ?? ""]));
    });
  }

  function importFromStrong(csv) {
    const rows = parseCSV(csv);
    const groups = {};
    for (const r of rows) {
      const date = (r["Date"] || "").slice(0, 10);
      const exercise = (r["Exercise Name"] || "").trim();
      const reps = parseInt(r["Reps"]);
      const weight = parseFloat(r["Weight"]) || 0;
      if (!date || !exercise || !reps) continue;
      const key = `${date}|${exercise}`;
      if (!groups[key]) groups[key] = { date, exercise, sets: [], notes: (r["Workout Notes"] || "").trim() };
      groups[key].sets.push({ reps, weight });
    }
    let added = 0;
    for (const g of Object.values(groups)) {
      const exists = data.workouts.some(w => w.date === g.date && w.exercise === g.exercise);
      if (!exists) { data.workouts.push({ id: uid(), ...g }); added++; }
    }
    if (added > 0) saveData();
    return added;
  }

  function importFromHevy(csv) {
    const rows = parseCSV(csv);
    const groups = {};
    for (const r of rows) {
      const date = (r["start_time"] || "").slice(0, 10);
      const exercise = (r["exercise_title"] || "").trim();
      const reps = parseInt(r["reps"]);
      let weight = parseFloat(r["weight_kg"]) || 0;
      if (data.unit === "lb") weight = Math.round(weight * 2.20462 * 10) / 10;
      if (!date || !exercise || !reps) continue;
      const key = `${date}|${exercise}`;
      if (!groups[key]) groups[key] = { date, exercise, sets: [], notes: (r["exercise_notes"] || "").trim() };
      groups[key].sets.push({ reps, weight });
    }
    let added = 0;
    for (const g of Object.values(groups)) {
      const exists = data.workouts.some(w => w.date === g.date && w.exercise === g.exercise);
      if (!exists) { data.workouts.push({ id: uid(), ...g }); added++; }
    }
    if (added > 0) saveData();
    return added;
  }

  function importFromLiftoff(csv) {
    const rows = parseCSV(csv);
    const groups = {};
    for (const r of rows) {
      // Liftoff CSV columns: Date, Workout, Exercise, Set, Reps, Weight, Notes
      const date = (r["Date"] || "").slice(0, 10);
      const exercise = (r["Exercise"] || r["Exercise Name"] || "").trim();
      const reps = parseInt(r["Reps"]);
      const weight = parseFloat(r["Weight"]) || 0;
      if (!date || !exercise || !reps) continue;
      const key = `${date}|${exercise}`;
      if (!groups[key]) groups[key] = { date, exercise, sets: [], notes: (r["Notes"] || r["Workout Notes"] || "").trim() };
      groups[key].sets.push({ reps, weight });
    }
    let added = 0;
    for (const g of Object.values(groups)) {
      const exists = data.workouts.some(w => w.date === g.date && w.exercise === g.exercise);
      if (!exists) { data.workouts.push({ id: uid(), ...g }); added++; }
    }
    if (added > 0) saveData();
    return added;
  }

  // ---------- Settings ----------
  function displayMealName(meal) {
    return (data.mealNames && data.mealNames[meal]) || meal;
  }

  function renderSettings() {
    const unitsVal = document.getElementById("units-row-value");
    if (unitsVal) unitsVal.textContent = data.unit || "kg";
    document.getElementById("calorie-goal-input").value = data.calorieGoal || 2000;
    document.getElementById("protein-goal-input").value = data.proteinGoal || 0;
    document.getElementById("carbs-goal-input").value = data.carbsGoal || 0;
    document.getElementById("fat-goal-input").value = data.fatGoal || 0;
    document.getElementById("weight-goal-input").value = data.weightGoal || 0;
    document.getElementById("weight-goal-label").textContent = `Target body weight (${data.unit || "kg"})`;
    renderConnectedAccounts();
  }

  const OAUTH_PROVIDERS = [
    { strategy: "oauth_google",  label: "Google",  icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>` },
    { strategy: "oauth_apple",   label: "Apple",   icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>` },
    { strategy: "oauth_github",  label: "GitHub",  icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>` },
  ];

  async function renderConnectedAccounts() {
    const list = document.getElementById("connected-accounts-list");
    if (!list) return;

    const cpSection = document.getElementById("change-password-section");
    const cpPanel = document.getElementById("change-password-panel");
    const showCp = authMode === "local";
    if (cpSection) cpSection.style.display = showCp ? "" : "none";
    if (cpPanel) cpPanel.style.display = showCp ? "" : "none";

    if (authMode === "local") {
      list.innerHTML = `<div class="connected-account-row connected-account-row--active">
        <span class="connected-account-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
        <span class="connected-account-label">Username &amp; Password</span>
        <span class="connected-account-status connected-account-status--on">Connected</span>
      </div>`;
      return;
    }

    if (authMode !== "clerk" || !window.Clerk || !window.Clerk.user) {
      list.innerHTML = "";
      return;
    }
    const user = window.Clerk.user;
    const linked = new Set(user.externalAccounts.map(a => a.provider));

    list.innerHTML = OAUTH_PROVIDERS.map(p => {
      const connected = linked.has(p.strategy.replace("oauth_", ""));
      return `<div class="connected-account-row ${connected ? "connected-account-row--active" : ""}">
        <span class="connected-account-icon">${p.icon}</span>
        <span class="connected-account-label">${p.label}</span>
        ${connected
          ? `<span class="connected-account-status connected-account-status--on">Connected</span>`
          : `<button class="btn btn-ghost btn-sm" data-connect="${p.strategy}">Connect</button>`}
      </div>`;
    }).join(`<div class="connected-account-divider"></div>`);

    list.querySelectorAll("[data-connect]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const strategy = btn.dataset.connect;
        try {
          const extAccount = await window.Clerk.user.createExternalAccount({
            strategy,
            redirectUrl: window.location.href,
          });
          window.location.href = extAccount.verification.externalVerificationRedirectURL;
        } catch (e) {
          toast("Could not connect account. Try again.");
        }
      });
    });
  }

  function renderStatistics() {
    const el = document.getElementById("statistics-content");
    if (!el) return;

    const workouts = data.workouts || [];
    const unit = data.unit || "kg";

    // Overview
    const totalWorkouts = workouts.length;
    const users = getUsers();
    const userRec = users[currentUser];
    const joinedDate = userRec && userRec.createdAt
      ? new Date(userRec.createdAt).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })
      : (workouts.length ? new Date(workouts.reduce((a,b) => a.date < b.date ? a : b).date).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }) : "—");

    const exerciseCounts = {};
    let totalVolume = 0, totalReps = 0;
    workouts.forEach(w => {
      exerciseCounts[w.exercise] = (exerciseCounts[w.exercise] || 0) + 1;
      (w.sets || []).forEach(s => {
        totalReps += (s.reps || 0);
        totalVolume += (s.reps || 0) * (s.weight || 0);
      });
    });
    const favoriteExercise = Object.entries(exerciseCounts).sort((a,b) => b[1]-a[1])[0];
    const avgVolume = totalWorkouts ? (totalVolume / totalWorkouts) : 0;
    const avgReps = totalWorkouts ? Math.round(totalReps / totalWorkouts) : 0;

    // Workout ratio: days with workouts / days since first workout
    let workoutRatioHtml = `<div class="stat-coming-soon">Workout Ratio <span class="coming-soon-tag">Soon</span></div>`;
    if (workouts.length >= 2) {
      const dates = new Set(workouts.map(w => w.date));
      const first = new Date(workouts.reduce((a,b) => a.date < b.date ? a : b).date);
      const daysSince = Math.max(1, Math.round((Date.now() - first) / 86400000));
      const ratio = ((dates.size / daysSince) * 100).toFixed(1);
      workoutRatioHtml = `<div class="stat-row"><span class="stat-label">Workout Ratio</span><span class="stat-value">${ratio}%</span></div>`;
    }

    const exerciseRows = Object.entries(exerciseCounts)
      .sort((a,b) => b[1]-a[1])
      .map(([name, count]) => `<div class="stat-row"><span class="stat-label">${name}</span><span class="stat-value">${count}</span></div>`)
      .join("");

    el.innerHTML = `
      <div class="panel">
        <div class="panel-header"><h2>Overview</h2></div>
        <div class="stat-row"><span class="stat-label">Joined</span><span class="stat-value">${joinedDate}</span></div>
        <div class="stat-row"><span class="stat-label">Total Workouts</span><span class="stat-value">${totalWorkouts}</span></div>
        <div class="stat-row"><span class="stat-label">Favorite Exercise</span><span class="stat-value">${favoriteExercise ? favoriteExercise[0] : "—"}</span></div>
        <div class="stat-row"><span class="stat-label">Total Nutrition Logs</span><span class="stat-value">${(data.nutrition || []).length}</span></div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Chronometry</h2></div>
        <div class="stat-coming-soon">Average Workout Duration <span class="coming-soon-tag">Soon</span></div>
        <div class="stat-coming-soon">Longest Workout Duration <span class="coming-soon-tag">Soon</span></div>
        ${workoutRatioHtml}
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Metrics</h2></div>
        <div class="stat-row"><span class="stat-label">Total Volume</span><span class="stat-value">${Math.round(totalVolume).toLocaleString()} ${unit}</span></div>
        <div class="stat-row"><span class="stat-label">Average Volume</span><span class="stat-value">${avgVolume.toFixed(1)} ${unit}</span></div>
        <div class="stat-row"><span class="stat-label">Total Reps</span><span class="stat-value">${totalReps.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-label">Average Reps</span><span class="stat-value">${avgReps}</span></div>
      </div>
      ${exerciseRows ? `<div class="panel">
        <div class="panel-header"><h2>Exercise Counter</h2></div>
        ${exerciseRows}
      </div>` : ""}
    `;
  }

  // ---------- Profile sub-page ----------
  // ── Theme catalogue ────────────────────────────────────────────────────
  // THEME_FAMILIES: shown when Auto is ON — picking one sets both dark+light slots.
  // Special themes have no light variant; picking one sets both slots to the dark id.
  const THEME_FAMILIES = [
    { id:"lime",       name:"Lime",        dark:"lime-dark",       light:"lime-light",      bg:"#0b0c08", accent:"#d7ff3d", category:"Color Themes" },
    { id:"cherry",     name:"Cherry",      dark:"cherry-dark",     light:"cherry-light",    bg:"#100808", accent:"#ff4d6d", category:"Color Themes" },
    { id:"blueberry",  name:"Blueberry",   dark:"blueberry-dark",  light:"blueberry-light", bg:"#080b12", accent:"#7b9fff", category:"Color Themes" },
    { id:"aqua",       name:"Aqua",        dark:"aqua-dark",       light:"aqua-light",      bg:"#08100f", accent:"#00e5c8", category:"Color Themes" },
    { id:"amber",      name:"Amber",       dark:"amber-dark",      light:"amber-light",     bg:"#100d04", accent:"#ffb800", category:"Color Themes" },
    { id:"rose",       name:"Rose",        dark:"rose-dark",       light:"rose-light",      bg:"#100810", accent:"#ff70c0", category:"Color Themes" },
    { id:"grape",      name:"Grape",       dark:"grape-dark",      light:"grape-light",     bg:"#0c0810", accent:"#c084fc", category:"Color Themes" },
    { id:"mono",       name:"Monochrome",  dark:"mono-dark",       light:"mono-light",      bg:"#0a0a0a", accent:"#e0e0e0", category:"Color Themes" },
    { id:"retro",      name:"Retro",       dark:"retro",           light:"retro",           bg:"#1a1800", accent:"#f5d000", category:"Special" },
    { id:"neon",       name:"Neon Rider",  dark:"neon",            light:"neon",            bg:"#0a0015", accent:"#ff00ff", category:"Special" },
    { id:"midnight",   name:"Midnight",    dark:"midnight",        light:"midnight",        bg:"#050508", accent:"#00b4ff", category:"Special" },
    { id:"forest",     name:"Forest",      dark:"forest",          light:"forest",          bg:"#080f08", accent:"#70e060", category:"Special" },
  ];

  // THEMES: shown when Auto is OFF — individual dark/light choices.
  const THEMES = [
    { id:"lime-dark",       name:"Lime Dark",       bg:"#0b0c08", accent:"#d7ff3d", category:"Color Themes" },
    { id:"lime-light",      name:"Lime Light",      bg:"#f5f8e8", accent:"#8aaa00", isLight:true, category:"Color Themes" },
    { id:"cherry-dark",     name:"Cherry Dark",     bg:"#100808", accent:"#ff4d6d", category:"Color Themes" },
    { id:"cherry-light",    name:"Cherry Light",    bg:"#fff0f0", accent:"#cc1a35", isLight:true, category:"Color Themes" },
    { id:"blueberry-dark",  name:"Blueberry Dark",  bg:"#080b12", accent:"#7b9fff", category:"Color Themes" },
    { id:"blueberry-light", name:"Blueberry Light", bg:"#f0f3ff", accent:"#3357e0", isLight:true, category:"Color Themes" },
    { id:"aqua-dark",       name:"Aqua Dark",       bg:"#08100f", accent:"#00e5c8", category:"Color Themes" },
    { id:"aqua-light",      name:"Aqua Light",      bg:"#effffc", accent:"#007a6a", isLight:true, category:"Color Themes" },
    { id:"amber-dark",      name:"Amber Dark",      bg:"#100d04", accent:"#ffb800", category:"Color Themes" },
    { id:"amber-light",     name:"Amber Light",     bg:"#fffbe8", accent:"#b07800", isLight:true, category:"Color Themes" },
    { id:"rose-dark",       name:"Rose Dark",       bg:"#100810", accent:"#ff70c0", category:"Color Themes" },
    { id:"rose-light",      name:"Rose Light",      bg:"#fff0f8", accent:"#c0006a", isLight:true, category:"Color Themes" },
    { id:"grape-dark",      name:"Grape Dark",      bg:"#0c0810", accent:"#c084fc", category:"Color Themes" },
    { id:"grape-light",     name:"Grape Light",     bg:"#f5f0ff", accent:"#7c22d0", isLight:true, category:"Color Themes" },
    { id:"mono-dark",       name:"Monochrome Dark", bg:"#0a0a0a", accent:"#e0e0e0", category:"Color Themes" },
    { id:"mono-light",      name:"Monochrome Light",bg:"#f5f5f5", accent:"#333333", isLight:true, category:"Color Themes" },
    { id:"retro",    name:"Retro",      bg:"#1a1800", accent:"#f5d000", category:"Special" },
    { id:"neon",     name:"Neon Rider", bg:"#0a0015", accent:"#ff00ff", category:"Special" },
    { id:"midnight", name:"Midnight",   bg:"#050508", accent:"#00b4ff", category:"Special" },
    { id:"forest",   name:"Forest",     bg:"#080f08", accent:"#70e060", category:"Special" },
  ];

  function applyTheme(id) {
    const html = document.documentElement;
    html.classList.add("theme-transitioning");
    html.setAttribute("data-theme", id || "lime-dark");
    clearTimeout(applyTheme._t);
    applyTheme._t = setTimeout(() => html.classList.remove("theme-transitioning"), 420);
  }

  function resolveTheme() {
    if (!data.themeAuto) return data.theme || "lime-dark";
    const h = new Date().getHours();
    return (h >= 6 && h < 20) ? (data.themeLight || "lime-light") : (data.themeDark || "lime-dark");
  }

  function buildThemeSwatch(id, bg, accent, isLight) {
    const stroke = isLight ? ` stroke="#ccc" stroke-width="1"` : "";
    return `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
      <clipPath id="lh-${id}"><path d="M18,18 m-18,0 a18,18 0 0,1 36,0 z"/></clipPath>
      <clipPath id="rh-${id}"><path d="M18,18 m-18,0 a18,18 0 0,0 36,0 z"/></clipPath>
      <circle cx="18" cy="18" r="18" clip-path="url(#lh-${id})" fill="${bg}"/>
      <circle cx="18" cy="18" r="18" clip-path="url(#rh-${id})" fill="${accent}"/>
      <circle cx="18" cy="18" r="17.5" fill="none"${stroke}/>
    </svg>`;
  }

  function buildThemeRows(items, isActiveFn, onClickFn, container) {
    const panelEl = document.createElement("div");
    panelEl.className = "panel panel-rows";
    items.forEach((item, idx) => {
      if (idx > 0) {
        const div = document.createElement("div");
        div.className = "settings-row-divider";
        panelEl.appendChild(div);
      }
      const row = document.createElement("div");
      row.className = "settings-row";
      row.style.cursor = "pointer";
      const isActive = isActiveFn(item);
      row.innerHTML = `
        <span class="settings-row-icon theme-swatch">${buildThemeSwatch(item.id, item.bg, item.accent, item.isLight)}</span>
        <span class="settings-row-label">${item.name}</span>
        <svg class="theme-check ${isActive ? "visible" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      row.addEventListener("click", () => onClickFn(item));
      panelEl.appendChild(row);
    });
    container.appendChild(panelEl);
  }

  function renderThemes() {
    const container = document.getElementById("themes-content");
    container.innerHTML = "";

    // Auto toggle
    const autoSection = document.createElement("div");
    autoSection.style.cssText = "padding:16px 16px 0;";
    const autoPanel = document.createElement("div");
    autoPanel.className = "panel";
    autoPanel.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;";
    autoPanel.innerHTML = `
      <div>
        <div style="font-size:0.9rem;font-weight:600;color:var(--text);">Auto (time of day)</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Light 6 AM–8 PM · Dark 8 PM–6 AM</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="theme-auto-toggle" ${data.themeAuto ? "checked" : ""}>
        <span class="slider"></span>
      </label>`;
    autoSection.appendChild(autoPanel);
    container.appendChild(autoSection);
    document.getElementById("theme-auto-toggle").addEventListener("change", (e) => {
      data.themeAuto = e.target.checked;
      // When switching to manual, seed data.theme from current resolved theme
      if (!data.themeAuto) data.theme = resolveTheme();
      saveData();
      applyTheme(resolveTheme());
      renderThemes();
    });

    if (data.themeAuto) {
      // AUTO mode: show theme families (one row per colour family)
      // Active = family whose dark matches data.themeDark
      const isActiveFn = (f) => f.dark === (data.themeDark || "lime-dark");
      const onClickFn = (f) => {
        data.themeDark  = f.dark;
        data.themeLight = f.light;
        saveData();
        applyTheme(resolveTheme());
        renderThemes();
      };
      const categories = ["Color Themes", "Special"];
      for (const cat of categories) {
        const items = THEME_FAMILIES.filter(f => f.category === cat);
        const sec = document.createElement("div");
        sec.style.cssText = "padding:16px 16px 0;";
        sec.innerHTML = `<p class="settings-section-label" style="margin-bottom:8px;">${cat}</p>`;
        buildThemeRows(items, isActiveFn, onClickFn, sec);
        container.appendChild(sec);
      }
    } else {
      // MANUAL mode: show all individual dark/light themes
      const isActiveFn = (t) => t.id === (data.theme || "lime-dark");
      const onClickFn = (t) => {
        data.theme = t.id;
        saveData();
        applyTheme(t.id);
        renderThemes();
      };
      const categories = ["Color Themes", "Special"];
      for (const cat of categories) {
        const items = THEMES.filter(t => t.category === cat);
        const sec = document.createElement("div");
        sec.style.cssText = "padding:16px 16px 0;";
        sec.innerHTML = `<p class="settings-section-label" style="margin-bottom:8px;">${cat}</p>`;
        buildThemeRows(items, isActiveFn, onClickFn, sec);
        container.appendChild(sec);
      }
    }

    // Disclaimer
    const disclaimer = document.createElement("div");
    disclaimer.style.cssText = "padding:16px 16px 24px;";
    disclaimer.innerHTML = `
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;display:flex;gap:10px;align-items:flex-start;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p style="font-size:0.75rem;color:var(--text-muted);line-height:1.5;margin:0;">
          <strong style="color:var(--text);font-weight:600;">Themes are cosmetic only.</strong> They change the app's visual style and are stored locally on your device. They are not synced between devices. All themes are free.
        </p>
      </div>`;
    container.appendChild(disclaimer);
  }

  function renderUnits() {
    const container = document.getElementById("units-content");
    if (!container) return;
    container.innerHTML = "";

    function makeSegRow(label, key, opts) {
      const row = document.createElement("div");
      row.className = "units-row";
      const lbl = document.createElement("span");
      lbl.className = "units-row-label";
      lbl.textContent = label;
      const seg = document.createElement("div");
      seg.className = "units-seg";
      opts.forEach(opt => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "units-seg-btn" + (data[key] === opt.value ? " active" : "");
        btn.textContent = opt.label;
        btn.addEventListener("click", () => {
          data[key] = opt.value;
          saveData();
          const unitsVal = document.getElementById("units-row-value");
          if (unitsVal) unitsVal.textContent = data.unit || "kg";
          if (key === "unit") renderWeight();
          renderUnits();
        });
        seg.appendChild(btn);
      });
      row.appendChild(lbl);
      row.appendChild(seg);
      return row;
    }

    const sections = [
      {
        label: "Body",
        rows: [
          { label: "Weight",            key: "unit",            opts: [{value:"kg",label:"Kg"},{value:"lb",label:"Lbs"}] },
          { label: "Height",            key: "heightUnit",      opts: [{value:"cm",label:"Cm"},{value:"in",label:"In"}] },
          { label: "Body Measurements", key: "bodyMeasureUnit", opts: [{value:"cm",label:"Cm"},{value:"in",label:"In"}] },
          { label: "Temperature",       key: "tempUnit",        opts: [{value:"c",label:"°C"},{value:"f",label:"°F"}] },
          { label: "Blood Glucose",     key: "glucoseUnit",     opts: [{value:"mgdl",label:"mg/dL"},{value:"mmol",label:"mmol/L"}] },
          { label: "Sex",               key: "sex",             opts: [{value:"male",label:"Male"},{value:"female",label:"Female"}] },
        ],
      },
      {
        label: "Activity",
        rows: [
          { label: "Distance",          key: "distanceUnit",    opts: [{value:"km",label:"Km"},{value:"mi",label:"Mi"}] },
          { label: "Speed",             key: "speedUnit",       opts: [{value:"kmh",label:"km/h"},{value:"mph",label:"mph"}] },
          { label: "Pace",              key: "paceUnit",        opts: [{value:"minkm",label:"min/km"},{value:"minmi",label:"min/mi"}] },
          { label: "Elevation",         key: "elevationUnit",   opts: [{value:"m",label:"m"},{value:"ft",label:"ft"}] },
        ],
      },
      {
        label: "Nutrition",
        rows: [
          { label: "Energy",            key: "energyUnit",      opts: [{value:"kcal",label:"kcal"},{value:"kj",label:"kJ"}] },
          { label: "Fluid",             key: "fluidUnit",       opts: [{value:"ml",label:"ml"},{value:"floz",label:"fl oz"}] },
          { label: "Serving Size",      key: "servingUnit",     opts: [{value:"g",label:"g"},{value:"oz",label:"oz"}] },
          { label: "Macros Display",    key: "macroDisplay",    opts: [{value:"g",label:"g"},{value:"pct",label:"%"}] },
        ],
      },
      {
        label: "Display",
        rows: [
          { label: "Date Format",       key: "dateFormat",      opts: [{value:"dmy",label:"DD/MM"},{value:"mdy",label:"MM/DD"},{value:"ymd",label:"YY/MM/DD"}] },
          { label: "Time",              key: "timeFormat",      opts: [{value:"24h",label:"24h"},{value:"12h",label:"12h"}] },
        ],
      },
    ];

    sections.forEach(sec => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "padding:16px 16px 0;";
      wrap.innerHTML = `<p class="settings-section-label" style="margin-top:0;margin-bottom:8px;">${sec.label}</p>`;
      const panel = document.createElement("div");
      panel.className = "panel";
      panel.style.cssText = "padding:0;overflow:hidden;";
      sec.rows.forEach((r, i) => {
        if (i > 0) {
          const div = document.createElement("div");
          div.className = "settings-row-divider";
          div.style.margin = "0 20px";
          panel.appendChild(div);
        }
        panel.appendChild(makeSegRow(r.label, r.key, r.opts));
      });
      wrap.appendChild(panel);
      container.appendChild(wrap);
    });

    const note = document.createElement("div");
    note.style.cssText = "padding:0 16px 8px;";
    note.innerHTML = `<div class="disclaimer-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="disclaimer-banner-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>Blood glucose and body measurements logged here are personal records only and are not interpreted medically. Consult your healthcare provider if readings concern you.</span></div>`;
    container.appendChild(note);

    const spacer = document.createElement("div");
    spacer.style.height = "16px";
    container.appendChild(spacer);
  }

  function renderCalendar() {
    const container = document.getElementById("calendar-content");
    if (!container) return;
    container.innerHTML = "";

    const current = data.weekStart || "monday";

    function buildMiniCal(startDay) {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startOffset = startDay === "sunday" ? firstDay : (firstDay === 0 ? 6 : firstDay - 1);
      const monthName = today.toLocaleString("default", { month: "long" });
      const dayHeaders = startDay === "sunday"
        ? ["Su","Mo","Tu","We","Th","Fr","Sa"]
        : ["Mo","Tu","We","Th","Fr","Sa","Su"];

      let cells = "";
      for (let i = 0; i < startOffset; i++) cells += `<div class="mini-cal-cell"></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === today.getDate();
        cells += `<div class="mini-cal-cell${isToday ? " mini-cal-today" : ""}">${d}</div>`;
      }
      return `
        <div class="mini-cal">
          <div class="mini-cal-header">${monthName} ${year}</div>
          <div class="mini-cal-grid">
            ${dayHeaders.map(h => `<div class="mini-cal-day-head">${h}</div>`).join("")}
            ${cells}
          </div>
        </div>`;
    }

    const sec = document.createElement("div");
    sec.style.cssText = "padding:16px 16px 0;";
    sec.innerHTML = `<p class="settings-section-label" style="margin-top:0;margin-bottom:8px;">Start Week On</p>`;
    const panel = document.createElement("div");
    panel.className = "panel panel-rows";
    const opts = [
      { value: "sunday", label: "Sunday" },
      { value: "monday", label: "Monday" },
    ];
    opts.forEach((opt, i) => {
      if (i > 0) {
        const div = document.createElement("div");
        div.className = "settings-row-divider";
        panel.appendChild(div);
      }
      const row = document.createElement("div");
      row.className = "settings-row";
      row.style.cursor = "pointer";
      const checked = opt.value === current;
      row.innerHTML = `
        <span class="settings-row-label" style="font-weight:${checked ? 600 : 400};">${opt.label}</span>
        <svg class="theme-check ${checked ? "visible" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      row.addEventListener("click", () => {
        data.weekStart = opt.value;
        saveData();
        renderCalendar();
      });
      panel.appendChild(row);
    });
    sec.appendChild(panel);
    container.appendChild(sec);

    const calWrap = document.createElement("div");
    calWrap.style.cssText = "padding:16px;";
    calWrap.innerHTML = buildMiniCal(current);
    container.appendChild(calWrap);
  }

  function renderHealthDisclaimer() {
    const container = document.getElementById("health-disclaimer-content");
    if (!container) return;
    container.innerHTML = `
      <div class="view-content">
        <div class="panel" style="margin-bottom:16px;">
          <p style="font-size:1rem;font-weight:700;margin:0 0 10px;">Health &amp; Medical Disclaimer</p>
          <p class="subtitle" style="margin:0 0 10px;">Last updated: September 2026</p>
          <p class="subtitle" style="margin:0 0 12px;">GoFitr is a general-purpose fitness and nutrition tracking tool designed for informational and personal record-keeping purposes only. It is <strong>not</strong> a medical device, clinical tool, or substitute for professional medical advice.</p>
          <p class="subtitle" style="margin:0 0 12px;"><strong>Not Medical Advice.</strong> Nothing in GoFitr — including calorie estimates, macro targets, weight trends, blood glucose readings, or any other data — constitutes medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before making changes to your diet, exercise routine, or health management plan.</p>
          <p class="subtitle" style="margin:0 0 12px;"><strong>Calorie &amp; Nutrition Data.</strong> Calorie and nutrient values are estimates based on publicly available food databases. Individual metabolism, preparation methods, and portion sizes vary. Do not use GoFitr as your sole source of nutritional guidance, especially if you have a medical condition such as diabetes, an eating disorder, heart disease, or kidney disease.</p>
          <p class="subtitle" style="margin:0 0 12px;"><strong>Exercise &amp; Physical Activity.</strong> Exercise tracking is for logging purposes only. Consult a doctor or certified fitness professional before beginning any new exercise programme, particularly if you have cardiovascular conditions, joint problems, or any chronic illness.</p>
          <p class="subtitle" style="margin:0 0 12px;"><strong>Blood Glucose &amp; Health Metrics.</strong> Any health metrics you log (blood glucose, body measurements, etc.) are personal records for your reference only. GoFitr does not analyse, interpret, or flag these values medically. If your readings are outside normal ranges, contact your healthcare provider immediately.</p>
          <p class="subtitle" style="margin:0 0 12px;"><strong>Weight Management.</strong> Weight goals set in GoFitr are personal targets only. Extremely low-calorie diets or aggressive weight-loss strategies can be dangerous. Seek professional guidance for any medically supervised weight-management programme.</p>
          <p class="subtitle" style="margin:0 0 12px;"><strong>Data Accuracy.</strong> GoFitr relies on data you enter manually. We cannot guarantee the accuracy of third-party food databases. Always cross-reference critical nutritional information with verified sources.</p>
          <p class="subtitle" style="margin:0 0 12px;"><strong>Emergency Situations.</strong> GoFitr is not designed for emergency health situations. If you are experiencing a medical emergency, call your local emergency services immediately.</p>
          <p class="subtitle" style="margin:0 0 12px;"><strong>Age Restriction.</strong> GoFitr is intended for users aged 16 and over. If you are younger, please use the app only with parental or guardian supervision.</p>
          <p class="subtitle" style="margin:0;">By using GoFitr you acknowledge that you have read and understood this disclaimer and agree to use the app at your own risk.</p>
        </div>
        <div class="panel" style="margin-bottom:16px;">
          <p style="font-weight:600;margin:0 0 6px;">Questions or Concerns?</p>
          <p class="subtitle" style="margin:0;">If you have questions about your health data or GoFitr's features, contact us at <a href="mailto:kittinatg@gmail.com" style="color:var(--lime);">kittinatg@gmail.com</a>.</p>
        </div>
      </div>
    `;
  }

  function renderOtherPrefs() {
    const container = document.getElementById("other-prefs-content");
    if (!container) return;
    container.innerHTML = "";

    function makeToggleSection(title, items) {
      const sec = document.createElement("div");
      sec.style.cssText = "padding:16px 16px 0;";
      sec.innerHTML = `<p class="settings-section-label" style="margin-top:0;margin-bottom:8px;">${title}</p>`;
      const panel = document.createElement("div");
      panel.className = "panel";
      items.forEach((item, i) => {
        if (i > 0) {
          const div = document.createElement("div");
          div.className = "settings-row-divider";
          panel.appendChild(div);
        }
        const row = document.createElement("div");
        row.className = "settings-row";
        row.style.cssText = "align-items:flex-start;gap:12px;";
        row.innerHTML = `
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.875rem;font-weight:600;color:${item.disabled ? "var(--text-muted)" : "var(--text)"};">${item.label}${item.disabled ? ' <span class="coming-soon-tag">Soon</span>' : ""}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${item.desc}</div>
          </div>
          <label class="toggle-switch" style="${item.disabled ? "opacity:0.4;pointer-events:none;" : ""}">
            <input type="checkbox" ${item.checked ? "checked" : ""} ${item.disabled ? "disabled" : ""} data-key="${item.key}">
            <span class="slider"></span>
          </label>`;
        if (!item.disabled) {
          row.querySelector("input").addEventListener("change", (e) => {
            data[item.key] = e.target.checked;
            saveData();
            if (item.key === "showMacroCards") renderNutrition();
          });
        }
        panel.appendChild(row);
      });
      sec.appendChild(panel);
      container.appendChild(sec);
    }

    makeToggleSection("App Layout", [
      { key: "showMacroCards", label: "Show Macro Cards", desc: "Display protein, carbs and fat cards on the nutrition screen.", checked: data.showMacroCards !== false },
      { key: "compactFoodList", label: "Compact Food List", desc: "Show food items in a smaller, denser list style.", checked: !!data.compactFoodList },
    ]);

    makeToggleSection("Calories", [
      { key: "_calBurned", label: "Track Calories Burned", desc: "Your workouts will adjust your daily calorie goal.", checked: false, disabled: true },
    ]);

    // Meal Labels
    const mealSec = document.createElement("div");
    mealSec.style.cssText = "padding:16px;";
    const mn = data.mealNames || {};
    mealSec.innerHTML = `
      <p class="settings-section-label" style="margin-top:0;margin-bottom:8px;">Meal Labels</p>
      <div class="panel" style="gap:14px;display:flex;flex-direction:column;">
        <p class="subtitle" style="margin:0;">Rename your meal slots. Leave blank to keep the default name.</p>
        <div class="form-row">
          <div class="form-field grow"><label for="meal-label-breakfast">Breakfast</label><input type="text" id="meal-label-breakfast" placeholder="Breakfast" maxlength="30" value="${mn.Breakfast || ""}"></div>
          <div class="form-field grow"><label for="meal-label-lunch">Lunch</label><input type="text" id="meal-label-lunch" placeholder="Lunch" maxlength="30" value="${mn.Lunch || ""}"></div>
        </div>
        <div class="form-row">
          <div class="form-field grow"><label for="meal-label-dinner">Dinner</label><input type="text" id="meal-label-dinner" placeholder="Dinner" maxlength="30" value="${mn.Dinner || ""}"></div>
          <div class="form-field grow"><label for="meal-label-snacks">Snacks</label><input type="text" id="meal-label-snacks" placeholder="Snacks" maxlength="30" value="${mn.Snacks || ""}"></div>
        </div>
        <button class="btn btn-primary btn-sm" id="save-meal-labels-btn" style="align-self:flex-start;">Save Labels</button>
      </div>`;
    container.appendChild(mealSec);
    document.getElementById("save-meal-labels-btn").addEventListener("click", () => {
      data.mealNames = {
        Breakfast: document.getElementById("meal-label-breakfast").value.trim(),
        Lunch: document.getElementById("meal-label-lunch").value.trim(),
        Dinner: document.getElementById("meal-label-dinner").value.trim(),
        Snacks: document.getElementById("meal-label-snacks").value.trim(),
      };
      saveData();
      renderNutrition();
      toast("Meal labels saved");
    });
  }

  // Border: value is just the ring colour (or "none" / "rainbow")
  const BORDER_PRESETS = [
    { label: "None",    value: "none",    swatch: null },
    { label: "Blue",    value: "#2196f3", swatch: "#2196f3" },
    { label: "Gold",    value: "#FFD700", swatch: "#FFD700" },
    { label: "Coral",   value: "#ff6b57", swatch: "#ff6b57" },
    { label: "Green",   value: "#4caf50", swatch: "#4caf50" },
    { label: "Purple",  value: "#9c27b0", swatch: "#9c27b0" },
    { label: "White",   value: "#ffffff", swatch: "#ffffff" },
    { label: "Rainbow", value: "rainbow", swatch: "linear-gradient(135deg,#f06,#fa0,#0f9,#09f,#f06)" },
  ];

  const BANNER_PRESETS = [
    { label: "Blue",    value: "linear-gradient(135deg,#1a237e,#42a5f5)" },
    { label: "Sunset",  value: "linear-gradient(135deg,#f06,#fa0)" },
    { label: "Forest",  value: "linear-gradient(135deg,#1b5e20,#66bb6a)" },
    { label: "Dusk",    value: "linear-gradient(135deg,#4a148c,#f06292)" },
    { label: "Ocean",   value: "linear-gradient(135deg,#006064,#00e5ff)" },
    { label: "Lava",    value: "linear-gradient(135deg,#bf360c,#ffcc02)" },
    { label: "Night",   value: "linear-gradient(135deg,#212121,#546e7a)" },
    { label: "Aurora",  value: "linear-gradient(135deg,#00695c,#7e57c2,#42a5f5)" },
  ];

  const TITLE_COLORS = ["#4caf50","#2196f3","#FFD700","var(--coral)","#9c27b0","#ff5722","#00bcd4","#e91e63"];

  // Holds pending changes until Save is clicked
  let profileDraft = {};

  function profileApplyToCard(rec) {
    const displayName = rec.displayName || rec.username || currentUser;
    // For Clerk users strip the "clerk:" prefix from the storage key
    let usernameLabel = rec.username || currentUser;
    if (usernameLabel.startsWith("clerk:")) {
      // Always use stored username (never leak email/phone from Clerk)
      usernameLabel = rec.username && !rec.username.startsWith("clerk:")
        ? rec.username
        : (getUsers()[currentUser]?.username || "user");
    }
    document.getElementById("profile-card-name").textContent = displayName;
    document.getElementById("profile-card-username").textContent = "@" + usernameLabel;

    // Avatar
    const avatarEl = document.getElementById("profile-avatar-display");
    if (rec.avatar) {
      avatarEl.innerHTML = `<img src="${rec.avatar}" alt="Avatar">`;
    } else {
      avatarEl.textContent = (displayName[0] || "?").toUpperCase();
    }

    // Border — use box-shadow rings so no sizing/overflow issues
    const wrapEl = document.getElementById("profile-avatar-wrap");
    const gap = "var(--bg-card)";
    if (rec.border && rec.border !== "none") {
      if (rec.border === "rainbow") {
        // Stacked box-shadow rings approximate a rainbow band
        wrapEl.style.boxShadow = `0 0 0 3px ${gap}, 0 0 0 5px #f06, 0 0 0 7px #fa0, 0 0 0 9px #4caf50, 0 0 0 11px #2196f3`;
      } else {
        wrapEl.style.boxShadow = `0 0 0 3px ${gap}, 0 0 0 6px ${rec.border}`;
      }
    } else {
      wrapEl.style.boxShadow = `0 0 0 3px ${gap}`;
    }
    // Never put a CSS border on the wrap — it shrinks the inner area
    wrapEl.style.border = "none";

    // Banner
    const bannerEl = document.getElementById("profile-banner-display");
    if (rec.banner) {
      if (rec.banner.startsWith("data:")) {
        bannerEl.style.background = `url(${rec.banner}) center/cover no-repeat`;
      } else {
        bannerEl.style.background = rec.banner;
      }
      bannerEl.classList.remove("profile-banner--none");
    } else {
      bannerEl.style.removeProperty("background");
      bannerEl.classList.add("profile-banner--none");
    }

    // Title
    const titleEl = document.getElementById("profile-card-title");
    if (rec.title && rec.title.text) {
      titleEl.textContent = rec.title.text;
      titleEl.style.color = rec.title.color || "var(--accent)";
      titleEl.style.display = "";
    } else {
      titleEl.style.display = "none";
    }
  }

  function renderProfile() {
    const users = getUsers();
    const userRec = users[currentUser] || {};
    profileDraft = {};

    const isClerk = authMode === "clerk";
    const usernameInput = document.getElementById("profile-username-input");
    const usernameHint  = document.getElementById("profile-username-hint");

    if (isClerk) {
      // Show the stored random username; Clerk users can change it freely
      usernameInput.value    = userRec.username || generateRandomUsername();
      usernameInput.disabled = false;
      usernameInput.style.opacity = "1";
      usernameHint.textContent = "This username is not linked to your social account.";
      usernameHint.style.color = "var(--muted)";
    } else {
      usernameInput.value    = userRec.username || currentUser;
      usernameInput.disabled = false;
      usernameInput.style.opacity = "";
      usernameHint.textContent = "";
    }

    document.getElementById("profile-display-name").value = userRec.displayName || userRec.username || currentUser;
    document.getElementById("profile-bio").value          = userRec.bio || "";
    document.getElementById("profile-title-text").value   = userRec.title?.text || "";

    profileApplyToCard(userRec);
    profileBuildSwatches(userRec);
    profileClosePicker();
  }

  function profileBuildSwatches(userRec) {
    // Border swatches
    const borderContainer = document.getElementById("profile-border-swatches");
    borderContainer.innerHTML = "";
    BORDER_PRESETS.forEach(p => {
      const btn = document.createElement("button");
      btn.className = "profile-swatch" + (((profileDraft.border ?? userRec.border) === p.value) ? " selected" : "");
      btn.title = p.label;
      if (p.value === "none") {
        btn.style.background = "var(--bg-elevated)";
        btn.style.border = "2px dashed var(--text-muted)";
      } else {
        btn.style.background = p.swatch;
        btn.style.border = "none";
      }
      btn.addEventListener("click", () => {
        profileDraft.border = p.value;
        const merged = Object.assign({}, getUsers()[currentUser] || {}, profileDraft);
        profileApplyToCard(merged);
        profileBuildSwatches(merged);
      });
      borderContainer.appendChild(btn);
    });

    // Banner swatches
    const bannerContainer = document.getElementById("profile-banner-swatches");
    bannerContainer.innerHTML = "";
    BANNER_PRESETS.forEach(p => {
      const btn = document.createElement("button");
      btn.className = "profile-banner-swatch" + (((profileDraft.banner ?? userRec.banner) === p.value) ? " selected" : "");
      btn.title = p.label;
      btn.style.background = p.value;
      btn.style.border = "2px solid transparent";
      btn.addEventListener("click", () => {
        profileDraft.banner = p.value;
        const merged = Object.assign({}, getUsers()[currentUser] || {}, profileDraft);
        profileApplyToCard(merged);
        profileBuildSwatches(merged);
      });
      bannerContainer.appendChild(btn);
    });

    // Title color swatches
    const titleColorContainer = document.getElementById("profile-title-colors");
    titleColorContainer.innerHTML = "";
    const currentTitleColor = profileDraft.title?.color ?? userRec.title?.color ?? TITLE_COLORS[0];
    TITLE_COLORS.forEach(color => {
      const btn = document.createElement("button");
      btn.className = "profile-swatch" + (currentTitleColor === color ? " selected" : "");
      btn.title = color;
      btn.style.background = color.startsWith("var") ? "var(--coral)" : color;
      btn.style.border = "none";
      btn.addEventListener("click", () => {
        if (!profileDraft.title) profileDraft.title = { text: "", color: TITLE_COLORS[0] };
        profileDraft.title.color = color;
        const text = document.getElementById("profile-title-text").value.trim();
        profileDraft.title.text = text;
        const merged = Object.assign({}, getUsers()[currentUser] || {}, profileDraft);
        profileApplyToCard(merged);
        profileBuildSwatches(merged);
      });
      titleColorContainer.appendChild(btn);
    });
  }

  function profileClosePicker() {
    ["picture","title","border","banner"].forEach(k => {
      document.getElementById("profile-picker-" + k).style.display = "none";
      document.getElementById("profile-" + k + "-btn").classList.remove("active");
    });
  }

  function profileTogglePicker(key) {
    const picker = document.getElementById("profile-picker-" + key);
    const isOpen = picker.style.display !== "none";
    profileClosePicker();
    if (!isOpen) {
      picker.style.display = "flex";
      document.getElementById("profile-" + key + "-btn").classList.add("active");
    }
  }

  document.getElementById("profile-picture-btn").addEventListener("click", () => profileTogglePicker("picture"));
  document.getElementById("profile-title-btn").addEventListener("click",   () => profileTogglePicker("title"));
  document.getElementById("profile-border-btn").addEventListener("click",  () => profileTogglePicker("border"));
  document.getElementById("profile-banner-btn").addEventListener("click",  () => profileTogglePicker("banner"));

  // Picture picker actions
  document.getElementById("profile-avatar-upload-btn").addEventListener("click", () => document.getElementById("profile-avatar-file").click());
  document.getElementById("profile-avatar-clear-btn").addEventListener("click", () => {
    profileDraft.avatar = null;
    const avatarEl = document.getElementById("profile-avatar-display");
    const users = getUsers();
    const userRec = Object.assign({}, users[currentUser] || {}, profileDraft);
    const dn = userRec.displayName || userRec.username || currentUser;
    avatarEl.textContent = (dn[0] || "?").toUpperCase();
    avatarEl.innerHTML = (dn[0] || "?").toUpperCase();
  });
  document.getElementById("profile-avatar-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast("Image must be under 3 MB"); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      profileDraft.avatar = ev.target.result;
      const merged = Object.assign({}, getUsers()[currentUser] || {}, profileDraft);
      profileApplyToCard(merged);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  // Banner upload
  document.getElementById("profile-banner-upload-btn").addEventListener("click", () => document.getElementById("profile-banner-file").click());
  document.getElementById("profile-banner-clear-btn").addEventListener("click", () => {
    profileDraft.banner = null;
    const bannerEl = document.getElementById("profile-banner-display");
    bannerEl.style.removeProperty("background");
    bannerEl.classList.add("profile-banner--none");
    profileBuildSwatches(Object.assign({}, getUsers()[currentUser] || {}, profileDraft));
  });
  document.getElementById("profile-banner-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast("Image must be under 3 MB"); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      profileDraft.banner = ev.target.result;
      document.getElementById("profile-banner-display").style.background = `url(${ev.target.result}) center/cover no-repeat`;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  });

  // Title text live preview
  document.getElementById("profile-title-text").addEventListener("input", (e) => {
    const text = e.target.value.trim();
    if (!profileDraft.title) profileDraft.title = { text: "", color: TITLE_COLORS[0] };
    profileDraft.title.text = text;
    const merged = Object.assign({}, getUsers()[currentUser] || {}, profileDraft);
    profileApplyToCard(merged);
  });

  // Display name live preview
  document.getElementById("profile-display-name").addEventListener("input", (e) => {
    const val = e.target.value.trim();
    const userRec = getUsers()[currentUser] || {};
    document.getElementById("profile-card-name").textContent = val || userRec.username || currentUser;
    const avatarEl = document.getElementById("profile-avatar-display");
    if (!avatarEl.querySelector("img") && !(profileDraft.avatar)) {
      avatarEl.textContent = (val[0] || (userRec.username || "?")[0]).toUpperCase();
    }
  });

  // Username hint (validate on input)
  document.getElementById("profile-username-input").addEventListener("input", (e) => {
    const val = e.target.value.trim().toLowerCase();
    const hintEl = document.getElementById("profile-username-hint");
    if (!val) { hintEl.textContent = ""; return; }
    if (!/^[a-z0-9_]{3,30}$/.test(val)) {
      hintEl.textContent = "3–30 chars, letters, numbers, underscores only.";
      hintEl.style.color = "var(--coral)";
    } else if (val !== (getUsers()[currentUser]?.username || currentUser)) {
      const taken = !!getUsers()[val];
      hintEl.textContent = taken ? "Username already taken." : "Username available.";
      hintEl.style.color = taken ? "var(--coral)" : "#4caf50";
    } else {
      hintEl.textContent = "";
    }
    document.getElementById("profile-card-username").textContent = "@" + val;
  });

  document.getElementById("profile-row").addEventListener("click", () => {
    renderProfile();
    showView("profile");
  });
  document.getElementById("profile-back").addEventListener("click", () => showView("settings"));

  document.getElementById("profile-save").addEventListener("click", async () => {
    const isClerk     = authMode === "clerk";
    const displayName = document.getElementById("profile-display-name").value.trim();
    const bio         = document.getElementById("profile-bio").value.trim();
    const titleText   = document.getElementById("profile-title-text").value.trim();

    const users  = getUsers();
    const oldKey = currentUser;
    const oldRec = users[oldKey] || {};

    const newUsernameRaw = document.getElementById("profile-username-input").value.trim();
    const newUsername = newUsernameRaw.toLowerCase();
    if (!newUsername || !/^[a-z0-9_]{3,30}$/.test(newUsername)) {
      toast("Invalid username — 3–30 chars, letters/numbers/underscores."); return;
    }

    if (!isClerk) {
      // Local users: username is the storage key — must migrate if changed
      if (newUsername !== oldKey) {
        if (users[newUsername]) { toast("Username already taken."); return; }
        users[newUsername] = Object.assign({}, oldRec, { username: newUsername });
        delete users[oldKey];
        const oldDataRaw = localStorage.getItem(`gofitr_data_${oldKey}`);
        if (oldDataRaw) {
          localStorage.setItem(`gofitr_data_${newUsername}`, oldDataRaw);
          localStorage.removeItem(`gofitr_data_${oldKey}`);
        }
        saveUsers(users);
        setSession(newUsername);
        currentUser = newUsername;
      }
    }

    // Save all fields
    const rec = users[currentUser] || {};
    rec.username = isClerk ? newUsername : currentUser;
    rec.displayName = displayName || rec.username || currentUser;
    rec.bio         = bio;

    // Title
    if (titleText) {
      const titleColor = profileDraft.title?.color ?? oldRec.title?.color ?? TITLE_COLORS[0];
      rec.title = { text: titleText, color: titleColor };
    } else {
      rec.title = null;
    }

    // Avatar / border / banner from draft
    if ("avatar" in profileDraft) rec.avatar = profileDraft.avatar;
    if ("border" in profileDraft) rec.border = profileDraft.border;
    if ("banner" in profileDraft) rec.banner = profileDraft.banner;

    users[currentUser] = rec;
    saveUsers(users);
    profileDraft = {};

    // Update Settings header
    const shownName = rec.displayName;
    document.getElementById("account-username").textContent = shownName;
    const accUn = document.getElementById("accounts-username");
    if (accUn) accUn.textContent = shownName;

    toast("Profile saved");
    showView("settings");
  });

  document.getElementById("statistics-row").addEventListener("click", () => {
    renderStatistics();
    showView("statistics");
  });
  document.getElementById("statistics-back").addEventListener("click", () => showView("settings"));

  document.getElementById("connections-row").addEventListener("click", () => showView("connections"));
  document.getElementById("connections-back").addEventListener("click", () => showView("settings"));
  document.getElementById("accounts-row").addEventListener("click", () => { renderConnectedAccounts(); showView("accounts"); });
  document.getElementById("accounts-back").addEventListener("click", () => showView("settings"));
  document.getElementById("themes-row").addEventListener("click", () => { renderThemes(); showView("themes"); });
  document.getElementById("themes-back").addEventListener("click", () => showView("settings"));
  document.getElementById("units-row").addEventListener("click", () => { renderUnits(); showView("units"); });
  document.getElementById("units-back").addEventListener("click", () => showView("settings"));
  document.getElementById("calendar-row").addEventListener("click", () => { renderCalendar(); showView("calendar"); });
  document.getElementById("calendar-back").addEventListener("click", () => showView("settings"));
  document.getElementById("other-prefs-row").addEventListener("click", () => { renderOtherPrefs(); showView("other-prefs"); });
  document.getElementById("other-prefs-back").addEventListener("click", () => showView("settings"));
  document.getElementById("health-disclaimer-row").addEventListener("click", () => { renderHealthDisclaimer(); showView("health-disclaimer"); });
  document.getElementById("health-disclaimer-back").addEventListener("click", () => showView("settings"));

  document.getElementById("disclaimer-modal-accept").addEventListener("click", () => {
    data.healthDisclaimerShown = true;
    saveData();
    document.getElementById("disclaimer-modal").classList.remove("show");
  });

  function goalInputHandler(field, inputId) {
    document.getElementById(inputId).addEventListener("change", (e) => {
      const value = parseFloat(e.target.value);
      data[field] = isNaN(value) || value < 0 ? 0 : value;
      e.target.value = data[field];
      saveData();
    });
  }
  goalInputHandler("calorieGoal", "calorie-goal-input");
  goalInputHandler("proteinGoal", "protein-goal-input");
  goalInputHandler("carbsGoal", "carbs-goal-input");
  goalInputHandler("fatGoal", "fat-goal-input");
  goalInputHandler("weightGoal", "weight-goal-input");

  // Nutrition page quick-edit macro goals
  document.getElementById("nutrition-edit-goals-btn").addEventListener("click", () => {
    document.getElementById("mg-calories").value = data.calorieGoal || 2000;
    document.getElementById("mg-protein").value  = data.proteinGoal || 0;
    document.getElementById("mg-carbs").value    = data.carbsGoal || 0;
    document.getElementById("mg-fat").value      = data.fatGoal || 0;
    document.getElementById("macro-goals-overlay").classList.add("show");
  });
  document.getElementById("macro-goals-cancel").addEventListener("click", () => {
    document.getElementById("macro-goals-overlay").classList.remove("show");
  });
  document.getElementById("macro-goals-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove("show");
  });
  document.getElementById("macro-goals-save").addEventListener("click", () => {
    const parse = (id, fallback) => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) || v < 0 ? fallback : v; };
    data.calorieGoal = parse("mg-calories", 2000);
    data.proteinGoal = parse("mg-protein", 0);
    data.carbsGoal   = parse("mg-carbs", 0);
    data.fatGoal     = parse("mg-fat", 0);
    // sync settings inputs too
    document.getElementById("calorie-goal-input").value = data.calorieGoal;
    document.getElementById("protein-goal-input").value = data.proteinGoal;
    document.getElementById("carbs-goal-input").value   = data.carbsGoal;
    document.getElementById("fat-goal-input").value     = data.fatGoal;
    saveData();
    renderNutrition();
    document.getElementById("macro-goals-overlay").classList.remove("show");
  });

  // Change password (in Accounts sub-page)
  document.getElementById("change-password-submit").addEventListener("click", async () => {
    const currentPw = document.getElementById("cp-current").value;
    const newPw = document.getElementById("cp-new").value;
    const confirmPw = document.getElementById("cp-confirm").value;
    if (!currentPw || !newPw) { toast("Fill in all fields"); return; }
    if (newPw !== confirmPw) { toast("Passwords do not match"); return; }
    if (newPw.length < 6) { toast("Password must be at least 6 characters"); return; }
    const users = getUsers();
    const user = users[currentUser];
    if (!user) { toast("Account not found"); return; }
    const hash = await hashPassword(currentPw, user.salt);
    if (hash !== user.hash) { toast("Current password is incorrect"); return; }
    users[currentUser].hash = await hashPassword(newPw, user.salt);
    saveUsers(users);
    document.getElementById("cp-current").value = "";
    document.getElementById("cp-new").value = "";
    document.getElementById("cp-confirm").value = "";
    toast("Password changed");
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
        showView("nutrition");
      } catch (err) {
        toast("Import failed: invalid file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("import-strong-btn").addEventListener("click", () =>
    document.getElementById("import-strong-file").click());
  document.getElementById("import-strong-file").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const added = importFromStrong(text);
      toast(`Imported ${added} workout(s) from Strong`);
      if (added > 0) renderDashboard();
    } catch { toast("Import failed: invalid Strong CSV"); }
    e.target.value = "";
  });

  document.getElementById("import-hevy-btn").addEventListener("click", () =>
    document.getElementById("import-hevy-file").click());
  document.getElementById("import-hevy-file").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const added = importFromHevy(text);
      toast(`Imported ${added} workout(s) from Hevy`);
      if (added > 0) renderDashboard();
    } catch { toast("Import failed: invalid Hevy CSV"); }
    e.target.value = "";
  });

  document.getElementById("import-liftoff-btn").addEventListener("click", () =>
    document.getElementById("import-liftoff-file").click());
  document.getElementById("import-liftoff-file").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const added = importFromLiftoff(text);
      toast(`Imported ${added} workout(s) from Liftoff`);
      if (added > 0) renderDashboard();
    } catch { toast("Import failed: invalid Liftoff CSV"); }
    e.target.value = "";
  });

  document.getElementById("clear-btn").addEventListener("click", async () => {
    const ok = await showConfirm("This will permanently delete all your data (workouts, nutrition logs, body weight, custom foods, saved meals). Continue?");
    if (!ok) return;
    data = defaultData();
    saveData();
    toast("All data cleared");
    showView("nutrition");
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
    // One-time migration: set auto+lime for all existing accounts
    if (!data.themeMigrated) {
      data.themeAuto   = true;
      data.themeDark   = "lime-dark";
      data.themeLight  = "lime-light";
      data.theme       = "lime-dark";
      data.themeMigrated = true;
      saveData();
    }
    applyTheme(resolveTheme());
    charts = { progress: null, weight: null };

    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");

    const users = getUsers();
    const userRec = users[userKey] || {};
    const displayName = userRec.displayName || meta.displayName || userRec.username || userKey;
    // Persist displayName from signup into user record if not yet stored
    if (meta.displayName && !userRec.displayName) {
      userRec.displayName = meta.displayName;
      users[userKey] = userRec;
      saveUsers(users);
    }
    document.getElementById("account-username").textContent = displayName;
    const accUn = document.getElementById("accounts-username");
    if (accUn) accUn.textContent = displayName;

    document.getElementById("sets-container").innerHTML = "";
    addSetRow();
    prepLogForm();
    renderSettings();
    nutritionViewDate = todayStr();
    renderNutrition();

    if (!data.healthDisclaimerShown) {
      setTimeout(() => document.getElementById("disclaimer-modal").classList.add("show"), 400);
    }
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

  function clerkSignIn(strategy) {
    if (!window.Clerk) {
      toast("Social login isn't configured yet.");
      return;
    }
    window.Clerk.client.signIn
      .authenticateWithRedirect({
        strategy,
        redirectUrl: window.location.origin,
        redirectUrlComplete: window.location.origin,
      })
      .catch(() => toast("Could not start sign-in. Is this provider enabled in Clerk?"));
  }

  document.getElementById("google-login-btn").addEventListener("click", () => clerkSignIn("oauth_google"));
  document.getElementById("apple-login-btn").addEventListener("click", () => clerkSignIn("oauth_apple"));
  document.getElementById("github-login-btn").addEventListener("click", () => clerkSignIn("oauth_github"));

  document.getElementById("logout-btn").addEventListener("click", async () => {
    if (authMode === "clerk" && window.Clerk) {
      try {
        await window.Clerk.signOut();
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

  document.getElementById("delete-account-btn").addEventListener("click", async () => {
    const ok = await showConfirm("Permanently delete your account and all data? This cannot be undone.");
    if (!ok) return;
    if (authMode === "clerk" && window.Clerk && window.Clerk.user) {
      try { await window.Clerk.user.delete(); } catch (e) { /* ignore */ }
    }
    const users = getUsers();
    if (currentUser && users[currentUser]) {
      delete users[currentUser];
      saveUsers(users);
    }
    try { localStorage.removeItem(`gofitr_data_${currentUser}`); } catch (e) { /* ignore */ }
    clearSession();
    currentUser = null;
    authMode = null;
    document.getElementById("login-form").reset();
    document.getElementById("signup-form").reset();
    setAuthMode("login");
    showAuthScreen();
    toast("Account deleted");
  });

  // ---------- Pull to refresh ----------
  // Standard pull-down-at-the-top gesture. Releasing past the threshold does
  // a normal refresh; holding there for 5s instead does a "hard" refresh
  // (clears any Cache API entries and reloads with a cache-busting param —
  // as close to a hard reload as a webpage can trigger on itself, since
  // browsers don't expose true Ctrl+Shift+R behavior to page scripts).
  (function initPullToRefresh() {
    const PTR_THRESHOLD = 70;
    const PTR_MAX = 120;
    const PTR_HOLD_MS = 5000;
    const HIDDEN_Y = -70;
    const VISIBLE_Y = 12;

    const indicator = document.getElementById("pull-refresh-indicator");
    const iconWrap = document.getElementById("pull-refresh-icon-wrap");
    const ring = document.getElementById("pull-refresh-ring-progress");
    const arrow = document.getElementById("pull-refresh-arrow");
    const label = document.getElementById("pull-refresh-label");
    const ringCircumference = 2 * Math.PI * 16;

    let tracking = false;
    let armed = false;
    let fired = false;
    let startY = 0;
    let holdTimeout = null;
    let holdInterval = null;

    function getScrollTop() {
      return window.scrollY || document.documentElement.scrollTop || 0;
    }

    function anyModalOpen() {
      const confirmOverlay = document.getElementById("confirm-overlay");
      const foodViewActive = ["view-food", "view-custom-food", "view-meal-builder"].some(
        id => document.getElementById(id).classList.contains("active")
      );
      return (confirmOverlay && confirmOverlay.classList.contains("show")) || foodViewActive;
    }

    function clearHoldTimers() {
      if (holdTimeout) { clearTimeout(holdTimeout); holdTimeout = null; }
      if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
      iconWrap.classList.remove("holding");
    }

    function setPosition(y, animated) {
      indicator.classList.toggle("animated", !!animated);
      indicator.style.transform = `translateX(-50%) translateY(${y}px)`;
    }

    function resetIndicator() {
      tracking = false;
      armed = false;
      clearHoldTimers();
      indicator.classList.remove("refreshing");
      setPosition(HIDDEN_Y, true);
      arrow.style.transform = "";
      label.textContent = "Pull to refresh";
    }

    function startHoldTimer() {
      const holdStart = Date.now();
      ring.style.strokeDasharray = String(ringCircumference);
      ring.style.strokeDashoffset = String(ringCircumference);
      iconWrap.classList.add("holding");

      holdInterval = setInterval(() => {
        const frac = Math.min((Date.now() - holdStart) / PTR_HOLD_MS, 1);
        ring.style.strokeDashoffset = String(ringCircumference * (1 - frac));
      }, 50);

      holdTimeout = setTimeout(() => {
        fired = true;
        triggerRefresh(true);
      }, PTR_HOLD_MS);
    }

    async function hardRefresh() {
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) {
        // Nothing to clear.
      }
      const url = new URL(window.location.href);
      url.searchParams.set("_hard", Date.now().toString());
      window.location.href = url.toString();
    }

    function triggerRefresh(hard) {
      clearHoldTimers();
      indicator.classList.add("refreshing", "animated");
      setPosition(VISIBLE_Y, true);
      label.textContent = hard ? "Hard refreshing…" : "Refreshing…";
      if (hard) {
        hardRefresh();
      } else {
        setTimeout(() => window.location.reload(), 200);
      }
    }

    function updateIndicator(deltaY) {
      const clamped = Math.min(deltaY, PTR_MAX);
      const progress = Math.min(clamped / PTR_THRESHOLD, 1);
      setPosition(HIDDEN_Y + (VISIBLE_Y - HIDDEN_Y) * progress, false);
      arrow.style.transform = `rotate(${progress * 180}deg)`;

      if (clamped >= PTR_THRESHOLD) {
        if (!armed) {
          armed = true;
          label.textContent = "Release to refresh, hold for hard refresh";
          startHoldTimer();
        }
      } else if (armed) {
        armed = false;
        clearHoldTimers();
        label.textContent = "Pull to refresh";
      } else {
        label.textContent = "Pull to refresh";
      }
    }

    window.addEventListener("touchstart", (e) => {
      if (getScrollTop() > 0 || anyModalOpen() || e.touches.length !== 1) return;
      tracking = true;
      armed = false;
      fired = false;
      startY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (!tracking || fired) return;
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY <= 0 || getScrollTop() > 0) {
        resetIndicator();
        tracking = false;
        return;
      }
      e.preventDefault();
      updateIndicator(deltaY);
    }, { passive: false });

    function onTouchEnd() {
      if (!tracking) return;
      tracking = false;
      if (fired) return;
      if (armed) {
        triggerRefresh(false);
      } else {
        resetIndicator();
      }
    }

    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
  })();

  function generateRandomUsername() {
    const adj = ["Agile","Bold","Brave","Calm","Cool","Daring","Elite","Epic","Fast","Fierce",
                 "Flash","Iron","Lean","Mighty","Noble","Power","Quick","Sharp","Sleek","Solid",
                 "Swift","Ultra","Wild","Zen"];
    const ani = ["Bear","Cheetah","Cobra","Crane","Eagle","Falcon","Fox","Hawk","Jaguar","Lion",
                 "Lynx","Panda","Panther","Penguin","Phoenix","Raven","Shark","Tiger","Viper","Wolf"];
    const a = adj[Math.floor(Math.random() * adj.length)];
    const b = ani[Math.floor(Math.random() * ani.length)];
    const n = Math.floor(Math.random() * 90) + 10;
    return a + b + n;
  }

  function bootClerkUser(user) {
    const displayName = user.fullName || user.username || "GoFitr User";
    const key = "clerk:" + user.id;
    // On first sign-in, assign a random privacy-safe username
    const users = getUsers();
    if (!users[key] || !users[key].username) {
      if (!users[key]) users[key] = {};
      users[key].username = generateRandomUsername();
      users[key].displayName = users[key].displayName || displayName;
      saveUsers(users);
    }
    bootApp(key, { mode: "clerk", displayName });
  }

  // ---------- Init ----------
  (async function init() {
    const clerk = await waitForClerk(3000);
    if (clerk) {
      try {
        await clerk.load();

        // Returning from a provider's redirect (e.g. after "Continue with
        // Google") lands back here with Clerk's completion params in the
        // URL — handleRedirectCallback() is what actually finishes
        // establishing the session from those params. Only call it when
        // those params are actually present: calling it unconditionally on
        // every load can pick up a stale/incomplete sign-up attempt (e.g.
        // one still missing a required field) and bounce the user off to
        // Clerk's hosted Account Portal even on a normal visit.
        const hasPendingClerkRedirect = /[?&]__clerk/.test(window.location.search)
          || /__clerk/.test(window.location.hash);
        if (hasPendingClerkRedirect) {
          try {
            await clerk.handleRedirectCallback();
          } catch (e) {
            // Nothing to complete, or it failed — fall through to local below.
          }
        }

        if (clerk.user) {
          clerk.addListener(({ user }) => {
            if (user && !currentUser) bootClerkUser(user);
          });
          bootClerkUser(clerk.user);
          return;
        }
        clerk.addListener(({ user }) => {
          if (user && !currentUser) bootClerkUser(user);
        });
      } catch (e) {
        // fall back to local below.
      }
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
