"use strict";

/* =====================================================
   PART 1: DATA AND HELPER FUNCTIONS
   All the data of the app is stored in ONE object
   called "data". We save it in the browser's
   localStorage so it stays after the page is closed.
   ===================================================== */
let data = {
  goal: 0,        // yearly goal number
  resources: [],  // books, PDFs, newspapers, LeetCode sets
  quotes: [],     // saved quotes
  tasks: [],      // pending assignments
  notes: ""       // notepad text
};

let currentFilter = "all";   // which shelf is visible: all / reading / completed / wishlist

// Names shown on the cards
const typeNames = { book: "Physical Book", pdf: "PDF", newspaper: "Newspaper", leetcode: "LeetCode Set" };
const unitNames = { book: "pages", pdf: "pages", newspaper: "issues", leetcode: "problems" };

// Short name for document.getElementById
function $(id) {
  return document.getElementById(id);
}

// Save data to localStorage (localStorage only stores text, so we use JSON.stringify)
function saveData() {
  localStorage.setItem("studysphereData", JSON.stringify(data));
}

// Load data from localStorage (JSON.parse turns the text back into an object)
function loadData() {
  const saved = localStorage.getItem("studysphereData");
  if (saved) {
    data = JSON.parse(saved);
  }
}

// Makes user text safe before putting it inside HTML
function safe(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Today's date as text like 2026-11-18 ("en-CA" is the locale that gives this format)
function today() {
  return new Date().toLocaleDateString("en-CA");
}

// Number of days from today until a date (negative = date is in the past)
function daysLeft(date) {
  return Math.round((new Date(date) - new Date(today())) / 86400000);   // 86400000 ms = 1 day
}

// Redraw every part of the page
function showAll() {
  showGoal();
  showShelves();
  fillDropdown();
  showQuotes();
  showTasks();
}

/* =====================================================
   PART 2: ANNUAL GOAL
   ===================================================== */
function showGoal() {
  // count resources on the Completed shelf
  const completed = data.resources.filter(r => r.shelf === "completed").length;

  let percent = 0;
  if (data.goal > 0) {
    percent = Math.min(100, Math.round((completed / data.goal) * 100));
  }

  $("goal-count").textContent = data.goal;
  $("goal-completed").textContent = completed;
  $("goal-remaining").textContent = Math.max(data.goal - completed, 0);
  $("goal-bar").value = percent;
  $("goal-percent").textContent = percent + "%";
}

$("goal-form").addEventListener("submit", function (event) {
  event.preventDefault();   // stop the page from reloading

  const goal = Number($("goal-input").value);

  // validation
  if (!Number.isInteger(goal) || goal < 1 || goal > 1000) {
    $("goal-error").textContent = "Enter a whole number from 1 to 1000.";
    return;
  }

  data.goal = goal;
  saveData();
  $("goal-error").textContent = "";
  showGoal();
});

$("goal-clear").addEventListener("click", function () {
  data.goal = 0;
  $("goal-input").value = "";
  $("goal-error").textContent = "";
  saveData();
  showGoal();
});

/* =====================================================
   PART 3: ADD RESOURCE
   ===================================================== */
$("resource-form").addEventListener("submit", function (event) {
  event.preventDefault();

  // read the values from the form
  const title = $("title").value.trim();
  const type = $("type").value;
  const author = $("author").value.trim();
  let shelf = $("shelf").value;
  const total = Number($("total").value);
  let current = Number($("current").value);

  // validation: show a message and stop if something is wrong
  if (title.length < 2) {
    $("resource-error").textContent = "Title must be at least 2 characters.";
    return;
  }
  if (type === "") {
    $("resource-error").textContent = "Please select a type.";
    return;
  }
  if (author.length < 2) {
    $("resource-error").textContent = "Please enter the author or creator.";
    return;
  }
  if (!Number.isInteger(total) || total < 1) {
    $("resource-error").textContent = "Total must be a whole number of at least 1.";
    return;
  }
  if (!Number.isInteger(current) || current < 0 || current > total) {
    $("resource-error").textContent = "Done so far must be between 0 and the total.";
    return;
  }
  const duplicate = data.resources.some(r => r.title.toLowerCase() === title.toLowerCase() && r.type === type);
  if (duplicate) {
    $("resource-error").textContent = "This resource is already in your library.";
    return;
  }

  // keep the shelf and progress consistent
  if (shelf === "completed") {
    current = total;
  } else if (shelf === "wishlist") {
    current = 0;
  } else if (current === total) {
    shelf = "completed";
  }

  // add to the list
  data.resources.push({
    id: Date.now(),   // a unique number for each resource
    title: title,
    type: type,
    author: author,
    shelf: shelf,
    total: total,
    current: current
  });

  saveData();
  $("resource-error").textContent = "";
  $("resource-form").reset();
  showAll();
});

/* =====================================================
   PART 4: SHELVES (Reading / Completed / Wishlist)
   ===================================================== */

// Builds the HTML of one resource card
function makeCard(r) {
  const percent = Math.round((r.current / r.total) * 100);

  return `
    <div class="card">
      <h4>${safe(r.title)}</h4>
      <small>${typeNames[r.type]} | By ${safe(r.author)}</small>
      <p>${r.current} / ${r.total} ${unitNames[r.type]} (${percent}%)</p>

      <input type="range" min="0" max="${r.total}" value="${r.current}"
             onchange="updateProgress(${r.id}, this.value)">

      <div class="card-bottom">
        <select onchange="moveResource(${r.id}, this.value)">
          <option value="reading" ${r.shelf === "reading" ? "selected" : ""}>Reading</option>
          <option value="completed" ${r.shelf === "completed" ? "selected" : ""}>Completed</option>
          <option value="wishlist" ${r.shelf === "wishlist" ? "selected" : ""}>Wishlist</option>
        </select>
        <button class="delete-btn" onclick="deleteResource(${r.id})">Delete</button>
      </div>
    </div>`;
}

// Fills the three shelves with cards
function showShelves() {
  const shelves = ["reading", "completed", "wishlist"];

  shelves.forEach(function (shelf) {
    const items = data.resources.filter(r => r.shelf === shelf);

    let html = "";
    items.forEach(function (r) {
      html += makeCard(r);
    });
    if (items.length === 0) {
      html = '<p class="empty">Nothing on this shelf yet.</p>';
    }

    $(shelf + "-list").innerHTML = html;
    $(shelf + "-count").textContent = items.length;

    // show or hide the shelf depending on the selected filter
    if (currentFilter === "all" || currentFilter === shelf) {
      $("shelf-" + shelf).style.display = "block";
    } else {
      $("shelf-" + shelf).style.display = "none";
    }
  });
}

// Filter buttons
const filterButtons = document.querySelectorAll(".filter");
filterButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    currentFilter = button.dataset.filter;   // reads data-filter="..." from the HTML

    filterButtons.forEach(b => b.classList.remove("active"));
    button.classList.add("active");

    showShelves();
  });
});

// Called when the slider is moved
function updateProgress(id, value) {
  const r = data.resources.find(item => item.id === id);
  r.current = Number(value);

  if (r.current === r.total) {
    r.shelf = "completed";   // finished
  } else {
    r.shelf = "reading";
  }

  saveData();
  showAll();
}

// Called when the shelf dropdown on a card is changed
function moveResource(id, shelf) {
  const r = data.resources.find(item => item.id === id);
  r.shelf = shelf;

  if (shelf === "completed") {
    r.current = r.total;
  } else if (shelf === "wishlist") {
    r.current = 0;
  } else if (r.current === r.total) {
    r.current = 0;   // moved back to Reading, so start again
  }

  saveData();
  showAll();
}

// Called when the Delete button on a card is clicked
function deleteResource(id) {
  if (!confirm("Delete this resource?")) {
    return;
  }
  data.resources = data.resources.filter(r => r.id !== id);
  saveData();
  showAll();
}

/* =====================================================
   PART 5: QUOTE LOG
   ===================================================== */

// Puts all resource titles into the dropdown of the quote form
function fillDropdown() {
  const select = $("quote-resource");
  const selected = select.value;   // remember the current choice

  let html = '<option value="">Select a resource</option>';
  data.resources.forEach(function (r) {
    html += `<option value="${r.id}">${safe(r.title)}</option>`;
  });

  select.innerHTML = html;
  select.value = selected;
}

$("quote-form").addEventListener("submit", function (event) {
  event.preventDefault();

  const resource = data.resources.find(r => r.id === Number($("quote-resource").value));
  const text = $("quote-text").value.trim();
  const page = $("quote-page").value.trim();

  // validation
  if (!resource) {
    $("quote-error").textContent = "Please select a resource.";
    return;
  }
  if (text.length < 5) {
    $("quote-error").textContent = "Quote must be at least 5 characters.";
    return;
  }
  if (page === "") {
    $("quote-error").textContent = "Please enter the page number.";
    return;
  }

  // unshift adds the new quote at the START of the list
  data.quotes.unshift({ id: Date.now(), title: resource.title, text: text, page: page });

  saveData();
  $("quote-error").textContent = "";
  $("quote-form").reset();
  showQuotes();
});

function showQuotes() {
  let html = "";

  data.quotes.forEach(function (q) {
    html += `
      <div class="quote">
        <p>&ldquo;${safe(q.text)}&rdquo;</p>
        <small>From ${safe(q.title)}, page ${safe(q.page)}</small>
        <button class="delete-btn" onclick="deleteQuote(${q.id})">Delete</button>
      </div>`;
  });

  if (data.quotes.length === 0) {
    html = '<p class="empty">No quotes saved yet.</p>';
  }

  $("quote-list").innerHTML = html;
}

function deleteQuote(id) {
  data.quotes = data.quotes.filter(q => q.id !== id);
  saveData();
  showQuotes();
}

/* =====================================================
   PART 6: PENDING ASSIGNMENTS
   ===================================================== */
$("task-form").addEventListener("submit", function (event) {
  event.preventDefault();

  const title = $("task-title").value.trim();
  const date = $("task-date").value;
  const priority = $("task-priority").value;

  // validation
  if (title.length < 3) {
    $("task-error").textContent = "Assignment name must be at least 3 characters.";
    return;
  }
  if (date === "") {
    $("task-error").textContent = "Please choose a deadline.";
    return;
  }
  if (date < today()) {   // dates in this format can be compared like text
    $("task-error").textContent = "The deadline cannot be in the past.";
    return;
  }
  const duplicate = data.tasks.some(t => t.title.toLowerCase() === title.toLowerCase() && t.date === date);
  if (duplicate) {
    $("task-error").textContent = "You already added this assignment for that date.";
    return;
  }

  data.tasks.push({ id: Date.now(), title: title, date: date, priority: priority, done: false });

  saveData();
  $("task-error").textContent = "";
  $("task-form").reset();
  showTasks();
});

function showTasks() {
  // sort: pending first, then the nearest deadline first
  const sorted = data.tasks.slice().sort(function (a, b) {
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    return a.date.localeCompare(b.date);
  });

  let html = "";
  sorted.forEach(function (t) {
    let note = "";
    let late = false;

    if (!t.done) {
      const days = daysLeft(t.date);
      if (days < 0) {
        note = "Overdue by " + Math.abs(days) + " day(s)";
        late = true;
      } else if (days === 0) {
        note = "Due today";
      } else {
        note = days + " day(s) left";
      }
    }

    html += `
      <div class="task ${t.done ? "done" : ""} ${late ? "late" : ""}">
        <input type="checkbox" ${t.done ? "checked" : ""} onchange="toggleTask(${t.id})">
        <span class="task-name">${safe(t.title)}</span>
        <span class="priority priority-${t.priority}">${t.priority}</span>
        <small>${t.date} ${note}</small>
        <button class="delete-btn" onclick="deleteTask(${t.id})">Delete</button>
      </div>`;
  });

  if (data.tasks.length === 0) {
    html = '<p class="empty">No assignments yet. Add one above.</p>';
  }

  $("task-list").innerHTML = html;
  $("task-pending").textContent = data.tasks.filter(t => !t.done).length;
}

// Tick / untick the checkbox
function toggleTask(id) {
  const t = data.tasks.find(item => item.id === id);
  t.done = !t.done;
  saveData();
  showTasks();
}

function deleteTask(id) {
  data.tasks = data.tasks.filter(t => t.id !== id);
  saveData();
  showTasks();
}

/* =====================================================
   PART 7: NOTEPAD
   ===================================================== */
$("notes-save").addEventListener("click", function () {
  data.notes = $("notes-text").value;
  saveData();
  $("notes-message").textContent = "Notes saved.";
});

$("notes-clear").addEventListener("click", function () {
  data.notes = "";
  $("notes-text").value = "";
  saveData();
  $("notes-message").textContent = "Notes cleared.";
});

/* =====================================================
   PART 8: START THE APP
   ===================================================== */
loadData();
$("goal-input").value = data.goal > 0 ? data.goal : "";
$("notes-text").value = data.notes;
showAll();
