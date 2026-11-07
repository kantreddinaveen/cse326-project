"use strict";

/* ==========================================================
   PART 1: DATA (state), STORAGE AND HELPER FUNCTIONS
   ========================================================== */
const STORAGE_KEY = "readingTrackerData";
const MEDIA = { book: "Physical Book", pdf: "PDF", youtube: "YouTube Playlist", newspaper: "Newspaper", leetcode: "LeetCode Set" };
const UNITS = { book: "pages", pdf: "pages", youtube: "videos", newspaper: "issues", leetcode: "problems" };
const SHELVES = ["reading", "completed", "wishlist"];

// "state" is the single object that holds ALL the data of the app.
let state = { goal: 0, resources: [], quotes: [], deadlines: [], tasks: [], notes: "" };
let currentFilter = "all";

const $ = (id) => document.getElementById(id);               // short name for getElementById
const setMessage = (id, text) => { $(id).textContent = text; }; // show / clear a message

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) state = Object.assign(state, saved);
  } catch (error) { /* storage blocked or empty: start fresh */ }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* ignore */ }
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function todayMidnight() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function daysUntil(dateText) {                                // negative number = date is in the past
  return Math.round((new Date(dateText + "T00:00:00") - todayMidnight()) / 86400000);
}
function percentOf(resource) { return Math.round((resource.current / resource.total) * 100); }
function progressText(resource, current) {
  return current + " / " + resource.total + " " + UNITS[resource.media] + " (" + Math.round((current / resource.total) * 100) + "%)";
}
function findResource(id) { return state.resources.find((r) => r.id === id); }

/* ==========================================================
   PART 2: ANNUAL GOAL DASHBOARD
   ========================================================== */
function renderGoal() {
  const done = state.resources.filter((r) => r.shelf === "completed").length;
  const goal = state.goal;
  const percent = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  $("goal-target-count").textContent = goal;
  $("goal-completed-count").textContent = done;
  $("goal-remaining-count").textContent = Math.max(goal - done, 0);
  $("goal-progress-bar").value = percent;
  $("goal-progress-percent").textContent = percent + "%";
  $("goal-status-message").textContent = goal === 0 ? "No goal set yet."
    : done >= goal ? "Goal achieved! Great work."
    : "Keep going: " + (goal - done) + " more to reach your goal.";
}

$("goal-form").addEventListener("submit", (event) => {
  event.preventDefault();                                     // stop the page from reloading
  const text = $("goal-input").value.trim();
  const number = Number(text);
  if (text === "") { setMessage("goal-error-message", "Please enter a goal number."); return; }
  if (!Number.isInteger(number) || number < 1 || number > 1000) {
    setMessage("goal-error-message", "Goal must be a whole number from 1 to 1000."); return;
  }
  state.goal = number; saveState();
  setMessage("goal-error-message", ""); renderGoal();
});
$("goal-reset-button").addEventListener("click", () => {
  state.goal = 0; $("goal-input").value = "";
  saveState(); setMessage("goal-error-message", ""); renderGoal();
});

/* ==========================================================
   PART 3: ADD RESOURCE FORM (with validation)
   ========================================================== */
$("resource-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("resource-title-input").value.trim();
  const media = $("resource-media-select").value;
  const creator = $("resource-creator-input").value.trim();
  const shelf = $("resource-shelf-select").value;
  const total = Number($("resource-total-input").value);
  let current = Number($("resource-current-input").value || 0);
  const due = $("resource-due-input").value;

  if (title.length < 2) return setMessage("resource-error-message", "Title must be at least 2 characters.");
  if (media === "") return setMessage("resource-error-message", "Please select a media type.");
  if (creator.length < 2) return setMessage("resource-error-message", "Please enter the author or creator.");
  if (!Number.isInteger(total) || total < 1) return setMessage("resource-error-message", "Total units must be a whole number of at least 1.");
  if (!Number.isInteger(current) || current < 0 || current > total) return setMessage("resource-error-message", "Current progress must be between 0 and the total units.");
  if (state.resources.some((r) => r.title.toLowerCase() === title.toLowerCase() && r.media === media))
    return setMessage("resource-error-message", "This resource is already in your library.");

  if (shelf === "completed") current = total;                 // finished means 100%
  if (shelf === "wishlist") current = 0;                      // not started yet
  state.resources.push({ id: newId(), title, media, creator, shelf, total, current, due });
  saveState(); setMessage("resource-error-message", "");
  $("resource-form").reset();
  renderAll();
});

/* ==========================================================
   PART 4: VIRTUAL SHELVES (cards cloned from <template>)
   ========================================================== */
function buildResourceCard(resource) {
  const node = $("resource-card-template").content.cloneNode(true);   // copy the hidden blueprint
  node.querySelector(".resource-card").dataset.resourceId = resource.id;
  node.querySelector(".resource-title").textContent = resource.title;
  const badge = node.querySelector(".resource-media-badge");
  badge.textContent = MEDIA[resource.media]; badge.classList.add("media-" + resource.media);
  node.querySelector(".resource-creator").textContent = "By " + resource.creator;

  const dueLine = node.querySelector(".resource-due");
  if (resource.due) {
    const time = node.querySelector(".resource-due-date");
    time.textContent = resource.due; time.dateTime = resource.due;
    if (resource.shelf !== "completed" && daysUntil(resource.due) < 0) dueLine.classList.add("overdue");
  } else { dueLine.hidden = true; }

  // Page progress slider: "input" fires while dragging, "change" fires on release
  const slider = node.querySelector(".progress-slider");
  const output = node.querySelector(".progress-output");
  slider.value = percentOf(resource);
  output.textContent = progressText(resource, resource.current);
  slider.addEventListener("input", () => {
    output.textContent = progressText(resource, Math.round((slider.value / 100) * resource.total));
  });
  slider.addEventListener("change", () => {
    resource.current = Math.round((slider.value / 100) * resource.total);
    if (resource.current >= resource.total) resource.shelf = "completed";          // auto-finish
    else if (resource.shelf !== "reading") resource.shelf = "reading";              // auto-start
    saveState(); renderAll();
  });

  const moveSelect = node.querySelector(".move-shelf-select");
  moveSelect.value = resource.shelf;
  moveSelect.addEventListener("change", () => {
    resource.shelf = moveSelect.value;
    if (resource.shelf === "completed") resource.current = resource.total;
    else if (resource.shelf === "wishlist") resource.current = 0;
    else if (resource.current >= resource.total) resource.current = 0;
    saveState(); renderAll();
  });

  node.querySelector(".delete-resource-button").addEventListener("click", () => {
    if (!confirm("Delete \"" + resource.title + "\"? Saved quotes will be kept.")) return;
    state.resources = state.resources.filter((r) => r.id !== resource.id);
    saveState(); renderAll();
  });
  return node;
}

function renderShelves() {
  SHELVES.forEach((shelf) => {
    const list = $(shelf + "-list");
    list.innerHTML = "";
    const items = state.resources.filter((r) => r.shelf === shelf);
    items.forEach((r) => list.appendChild(buildResourceCard(r)));
    $("shelf-" + shelf + "-count").textContent = items.length;
    $(shelf + "-empty-message").hidden = items.length > 0;
    $("shelf-" + shelf).hidden = !(currentFilter === "all" || currentFilter === shelf);
  });
}

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach((b) => b.classList.toggle("active", b === button));
    renderShelves();
  });
});

function fillResourceSelect(selectId) {                       // keeps option 0, rebuilds the rest
  const select = $(selectId);
  const previous = select.value;
  select.length = 1;
  state.resources.forEach((r) => {
    const option = document.createElement("option");
    option.value = r.id; option.textContent = r.title;
    select.appendChild(option);
  });
  select.value = previous;
}

/* ==========================================================
   PART 5: PERMANENT QUOTE LOG
   ========================================================== */
$("quote-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const resource = findResource($("quote-resource-select").value);
  const text = $("quote-text-input").value.trim();
  const citation = $("quote-citation-input").value.trim();
  const location = $("quote-location-input").value.trim();
  if (!resource) return setMessage("quote-error-message", "Please select a resource.");
  if (text.length < 5) return setMessage("quote-error-message", "Quote must be at least 5 characters.");
  if (citation === "") return setMessage("quote-error-message", "Please enter a citation.");
  if (location === "") return setMessage("quote-error-message", "Please enter a page number or timestamp.");
  state.quotes.unshift({ id: newId(), resourceTitle: resource.title, text, citation, location, savedAt: new Date().toLocaleString() });
  saveState(); setMessage("quote-error-message", "");
  $("quote-form").reset(); renderQuotes();
});

function renderQuotes() {
  const list = $("quotes-list");
  list.innerHTML = "";
  state.quotes.forEach((q) => {
    const node = $("quote-item-template").content.cloneNode(true);
    node.querySelector(".quote-item").dataset.quoteId = q.id;
    node.querySelector(".quote-text").textContent = "\u201C" + q.text + "\u201D";
    node.querySelector(".quote-citation").textContent = q.citation;
    node.querySelector(".quote-location").textContent = "@ " + q.location;
    node.querySelector(".quote-resource-name").textContent = "from " + q.resourceTitle;
    node.querySelector(".quote-timestamp").textContent = "saved " + q.savedAt;
    node.querySelector(".delete-quote-button").addEventListener("click", () => {
      state.quotes = state.quotes.filter((x) => x.id !== q.id);
      saveState(); renderQuotes();
    });
    list.appendChild(node);
  });
  $("quotes-empty-message").hidden = state.quotes.length > 0;
}

/* ==========================================================
   PART 6: STUDY CALENDAR (deadlines with countdown)
   ========================================================== */
$("deadline-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("deadline-title-input").value.trim();
  const resource = findResource($("deadline-resource-select").value);
  const date = $("deadline-date-input").value;
  if (title.length < 3) return setMessage("deadline-error-message", "Deadline title must be at least 3 characters.");
  if (date === "") return setMessage("deadline-error-message", "Please choose a target date.");
  if (daysUntil(date) < 0) return setMessage("deadline-error-message", "The target date cannot be in the past.");
  state.deadlines.push({ id: newId(), title, date, resourceTitle: resource ? resource.title : "" });
  saveState(); setMessage("deadline-error-message", "");
  $("deadline-form").reset(); renderDeadlines();
});

function renderDeadlines() {
  const list = $("deadline-list");
  list.innerHTML = "";
  [...state.deadlines].sort((a, b) => a.date.localeCompare(b.date)).forEach((d) => {
    const node = $("deadline-item-template").content.cloneNode(true);
    const days = daysUntil(d.date);
    node.querySelector(".deadline-item").dataset.deadlineId = d.id;
    if (days < 0) node.querySelector(".deadline-item").classList.add("overdue");
    node.querySelector(".deadline-title").textContent = d.title;
    const time = node.querySelector(".deadline-date");
    time.textContent = d.date; time.dateTime = d.date;
    node.querySelector(".deadline-resource").textContent = d.resourceTitle ? "Resource: " + d.resourceTitle : "";
    node.querySelector(".deadline-countdown").textContent =
      days < 0 ? "Overdue by " + Math.abs(days) + " day(s)" : days === 0 ? "Due today" : days + " day(s) left";
    node.querySelector(".delete-deadline-button").addEventListener("click", () => {
      state.deadlines = state.deadlines.filter((x) => x.id !== d.id);
      saveState(); renderDeadlines();
    });
    list.appendChild(node);
  });
  $("deadline-empty-message").hidden = state.deadlines.length > 0;
}

/* ==========================================================
   PART 7: PENDING ASSIGNMENTS CHECKLIST
   ========================================================== */
$("task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("task-title-input").value.trim();
  const priority = $("task-priority-select").value;
  if (title.length < 3) return setMessage("task-error-message", "Task must be at least 3 characters.");
  state.tasks.push({ id: newId(), title, priority, done: false });
  saveState(); setMessage("task-error-message", "");
  $("task-title-input").value = ""; renderTasks();
});

function renderTasks() {
  const order = { high: 0, medium: 1, low: 2 };
  const list = $("task-list");
  list.innerHTML = "";
  // pending tasks first, then by priority
  [...state.tasks].sort((a, b) => a.done - b.done || order[a.priority] - order[b.priority]).forEach((t) => {
    const node = $("task-item-template").content.cloneNode(true);
    const item = node.querySelector(".task-item");
    item.dataset.taskId = t.id; item.classList.toggle("done", t.done);
    node.querySelector(".task-title").textContent = t.title;
    const badge = node.querySelector(".task-priority-badge");
    badge.textContent = t.priority; badge.classList.add("priority-" + t.priority);
    const box = node.querySelector(".task-checkbox");
    box.checked = t.done;
    box.addEventListener("change", () => { t.done = box.checked; saveState(); renderTasks(); });
    node.querySelector(".delete-task-button").addEventListener("click", () => {
      state.tasks = state.tasks.filter((x) => x.id !== t.id);
      saveState(); renderTasks();
    });
    list.appendChild(node);
  });
  $("task-pending-count").textContent = state.tasks.filter((t) => !t.done).length;
  $("task-empty-message").hidden = state.tasks.length > 0;
}

/* ==========================================================
   PART 8: ROUGH DRAFT NOTEPAD
   ========================================================== */
$("notepad-form").addEventListener("submit", (event) => event.preventDefault());
$("notepad-save-button").addEventListener("click", () => {
  state.notes = $("notepad-textarea").value;
  saveState(); setMessage("notepad-status-message", "Notes saved at " + new Date().toLocaleTimeString() + ".");
});
$("notepad-clear-button").addEventListener("click", () => {
  if (!confirm("Clear all notes?")) return;
  $("notepad-textarea").value = ""; state.notes = "";
  saveState(); setMessage("notepad-status-message", "Notes cleared.");
});

/* ==========================================================
   PART 9: POMODORO TIMER (setInterval counts down every second)
   ========================================================== */
const FOCUS_SECONDS = 25 * 60, BREAK_SECONDS = 5 * 60;
let timerMode = "focus", timeLeft = FOCUS_SECONDS, timerId = null;

function drawTimer() {
  const text = String(Math.floor(timeLeft / 60)).padStart(2, "0") + ":" + String(timeLeft % 60).padStart(2, "0");
  $("timer-display").textContent = text;
}
function stopTimer() { clearInterval(timerId); timerId = null; }
function tick() {
  timeLeft--;
  if (timeLeft <= 0) {                                        // session finished: switch mode
    stopTimer();
    if (timerMode === "focus") {
      timerMode = "break"; timeLeft = BREAK_SECONDS;
      $("timer-mode-label").textContent = "Break time";
      setMessage("timer-status-message", "Focus session complete! Press Start for a 5 minute break.");
    } else {
      timerMode = "focus"; timeLeft = FOCUS_SECONDS;
      $("timer-mode-label").textContent = "Focus session";
      setMessage("timer-status-message", "Break over. Ready to focus again.");
    }
  }
  drawTimer();
}
$("timer-start-button").addEventListener("click", () => {
  if (timerId !== null) return;                               // already running: do nothing
  timerId = setInterval(tick, 1000);
  setMessage("timer-status-message", timerMode === "focus" ? "Stay focused..." : "Relax and rest...");
});
$("timer-pause-button").addEventListener("click", () => {
  if (timerId === null) return;
  stopTimer(); setMessage("timer-status-message", "Timer paused.");
});
$("timer-reset-button").addEventListener("click", () => {
  stopTimer(); timerMode = "focus"; timeLeft = FOCUS_SECONDS;
  $("timer-mode-label").textContent = "Focus session";
  setMessage("timer-status-message", "Timer reset. Ready to focus."); drawTimer();
});

/* ==========================================================
   PART 10: START THE APP
   ========================================================== */
function renderAll() {
  renderShelves();
  fillResourceSelect("quote-resource-select");
  fillResourceSelect("deadline-resource-select");
  renderGoal();
}

loadState();
$("goal-input").value = state.goal > 0 ? state.goal : "";
$("notepad-textarea").value = state.notes;
renderAll(); renderQuotes(); renderDeadlines(); renderTasks(); drawTimer();
