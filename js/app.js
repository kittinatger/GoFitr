(function () {
  "use strict";

  const USERS_KEY = "gofitr_users_v1";
  const SESSION_KEY = "gofitr_session_v1";

  const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  const ICON_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
  const ICON_DUMBBELL = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="9" width="3" height="6" rx="1"/><rect x="20" y="9" width="3" height="6" rx="1"/><rect x="4" y="10" width="2" height="4"/><rect x="18" y="10" width="2" height="4"/><rect x="6" y="11" width="12" height="2"/></svg>';
  const ICON_SCALE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><circle cx="12" cy="12" r="3"></circle></svg>';
  const ICON_FOOD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7c-1.2-1.8-3.2-2.6-5-2 0 2 1 3.6 2.8 4.6"></path><path d="M12 8.5c-4 0-6.8 3-6.8 6.8 0 3.7 2.6 6.7 5.6 6.7.9 0 1.6-.4 2.2-.4.6 0 1.3.4 2.2.4 3 0 5.6-3 5.6-6.7 0-3.1-1.9-5-4.4-5.9"></path></svg>';

  const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

  const defaultData = () => ({
    workouts: [],   // { id, date: 'YYYY-MM-DD', exercise, sets: [{reps, weight}], notes }
    bodyWeight: [], // { id, date, weight }
    nutrition: [],  // { id, date, meal, name, calories, protein, carbs, fat }
    calorieGoal: 2000,
    unit: "kg",
  });

  let currentUser = null;
  let authMode = null; // "local" | "github"
  let data = defaultData();
  let charts = { progress: null, weight: null };
  let nutritionViewDate = null;
  let activeFoodMeal = null;
  let activeFoodBase = null; // { kcal100, protein100, carbs100, fat100 } when filled from search/barcode
  let html5QrCodeInstance = null;
  let barcodeScanning = false;

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
    if (view === "nutrition") renderNutrition();
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
    document.getElementById("log-date").value = todayStr();
    refreshExerciseOptions();
    showView("nutrition");
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
    document.getElementById("stat-protein").innerHTML = `${Math.round(totalProtein)}<span class="stat-unit">g</span>`;
    document.getElementById("stat-carbs").innerHTML = `${Math.round(totalCarbs)}<span class="stat-unit">g</span>`;
    document.getElementById("stat-fat").innerHTML = `${Math.round(totalFat)}<span class="stat-unit">g</span>`;

    const ring = document.getElementById("calorie-ring");
    const circumference = 2 * Math.PI * 52;
    const fraction = goal > 0 ? Math.min(totalCalories / goal, 1) : 0;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference * (1 - fraction));
  }

  function openFoodModal(meal) {
    activeFoodMeal = meal;
    activeFoodBase = null;
    document.getElementById("food-dialog-meal").textContent = "— " + meal;
    document.getElementById("food-form").reset();
    document.getElementById("food-serving").value = 100;
    document.getElementById("food-search-input").value = "";
    document.getElementById("food-search-results").innerHTML = "";
    document.getElementById("barcode-status").textContent = "Point your camera at a barcode.";
    setFoodSourceTab("manual");
    document.getElementById("food-overlay").classList.add("show");
    document.getElementById("food-name").focus();
  }

  function closeFoodModal() {
    stopBarcodeScanner();
    document.getElementById("food-overlay").classList.remove("show");
    activeFoodMeal = null;
  }

  function setFoodSourceTab(source) {
    document.querySelectorAll(".food-source-tab").forEach(t => t.classList.toggle("active", t.dataset.source === source));
    document.querySelectorAll(".food-source-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === source));
    if (source === "barcode") {
      startBarcodeScanner();
    } else {
      stopBarcodeScanner();
    }
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

  function applyFoodProduct(product) {
    const n = product.nutriments || {};
    activeFoodBase = {
      kcal100: n["energy-kcal_100g"] || 0,
      protein100: n["proteins_100g"] || 0,
      carbs100: n["carbohydrates_100g"] || 0,
      fat100: n["fat_100g"] || 0,
    };
    document.getElementById("food-name").value = product.product_name || "Unknown food";
    document.getElementById("food-serving").value = 100;
    applyServingScale();
    setFoodSourceTab("manual");
  }

  // ---------- Open Food Facts (public, free, no API key) ----------
  async function searchFoodDatabase(query) {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=15&fields=product_name,brands,nutriments`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Search request failed");
    const json = await resp.json();
    return (json.products || []).filter(p => p.product_name && p.nutriments && p.nutriments["energy-kcal_100g"] != null);
  }

  async function lookupBarcode(code) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Lookup request failed");
    const json = await resp.json();
    if (json.status !== 1 || !json.product) throw new Error("Product not found");
    return json.product;
  }

  function renderSearchResults(products) {
    const container = document.getElementById("food-search-results");
    if (products.length === 0) {
      container.innerHTML = `<p class="empty-state" style="padding:14px 0;">No results found.</p>`;
      return;
    }
    container.innerHTML = products.map((p, i) => `
      <button type="button" class="food-search-result" data-index="${i}">
        <span class="food-search-result-name">${escapeHtml(p.product_name)}</span>
        <span class="food-search-result-meta">${p.brands ? escapeHtml(p.brands) + " · " : ""}${Math.round(p.nutriments["energy-kcal_100g"])} kcal/100g</span>
      </button>
    `).join("");
    container.querySelectorAll(".food-search-result").forEach(btn => {
      btn.addEventListener("click", () => applyFoodProduct(products[Number(btn.dataset.index)]));
    });
  }

  async function doFoodSearch() {
    const q = document.getElementById("food-search-input").value.trim();
    if (!q) return;
    const container = document.getElementById("food-search-results");
    container.innerHTML = `<p class="empty-state" style="padding:14px 0;">Searching…</p>`;
    try {
      const products = await searchFoodDatabase(q);
      renderSearchResults(products);
    } catch (e) {
      container.innerHTML = `<p class="empty-state" style="padding:14px 0;">Search failed. Check your connection.</p>`;
    }
  }

  document.getElementById("food-search-btn").addEventListener("click", doFoodSearch);
  document.getElementById("food-search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); doFoodSearch(); }
  });

  async function handleBarcodeDetected(code) {
    document.getElementById("barcode-status").textContent = "Looking up " + code + "…";
    try {
      const product = await lookupBarcode(code);
      stopBarcodeScanner();
      applyFoodProduct(product);
      toast("Product found");
    } catch (e) {
      document.getElementById("barcode-status").textContent = "No match for that barcode. Try again or use search.";
      barcodeScanning = true;
    }
  }

  function startBarcodeScanner() {
    if (typeof Html5Qrcode === "undefined") {
      document.getElementById("barcode-status").textContent = "Barcode scanner failed to load.";
      return;
    }
    document.getElementById("barcode-status").textContent = "Point your camera at a barcode…";
    html5QrCodeInstance = new Html5Qrcode("barcode-reader-region");
    barcodeScanning = true;
    html5QrCodeInstance.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        if (!barcodeScanning) return;
        barcodeScanning = false;
        handleBarcodeDetected(decodedText);
      },
      () => {}
    ).catch(err => {
      document.getElementById("barcode-status").textContent = "Could not access camera. " + err;
    });
  }

  function stopBarcodeScanner() {
    barcodeScanning = false;
    if (html5QrCodeInstance) {
      const instance = html5QrCodeInstance;
      html5QrCodeInstance = null;
      try {
        const result = instance.stop();
        if (result && typeof result.then === "function") {
          result.then(() => instance.clear()).catch(() => {});
        }
      } catch (e) {
        // Scanner never actually started (e.g. camera permission denied) — nothing to stop.
      }
    }
  }

  document.querySelectorAll(".add-food-btn").forEach(btn => {
    btn.addEventListener("click", () => openFoodModal(btn.dataset.meal));
  });

  document.getElementById("food-cancel").addEventListener("click", closeFoodModal);

  document.getElementById("food-overlay").addEventListener("click", (e) => {
    if (e.target.id === "food-overlay") closeFoodModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("food-overlay").classList.contains("show")) {
      closeFoodModal();
    }
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
    renderNutrition();
  });

  document.getElementById("calorie-goal-input").addEventListener("change", (e) => {
    const value = parseFloat(e.target.value);
    data.calorieGoal = isNaN(value) || value <= 0 ? 2000 : value;
    e.target.value = data.calorieGoal;
    saveData();
    toast("Calorie goal updated");
  });

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
        showView("nutrition");
      } catch (err) {
        toast("Import failed: invalid file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("clear-btn").addEventListener("click", async () => {
    const ok = await showConfirm("This will permanently delete all workouts and body weight entries. Continue?");
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
    nutritionViewDate = todayStr();
    document.getElementById("calorie-goal-input").value = data.calorieGoal || 2000;
    renderNutrition();
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
