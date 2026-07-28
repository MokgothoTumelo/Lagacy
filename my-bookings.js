const ALL_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"];

function getBookings() {
  try { return JSON.parse(localStorage.getItem("barberBookings") || "{}"); }
  catch { return {}; }
}
function saveBookings(d) { localStorage.setItem("barberBookings", JSON.stringify(d)); }

function getMine() {
  try { return JSON.parse(localStorage.getItem("myBarberBookings") || "[]"); }
  catch { return []; }
}
function saveMine(list) { localStorage.setItem("myBarberBookings", JSON.stringify(list)); }

function fmtDate(d) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "short", year: "numeric", month: "short", day: "numeric"
    });
  } catch { return d; }
}

function isUpcoming(b) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Future date → upcoming
  if (b.date > today) return true;

  // Past date → past (will be cleaned later)
  if (b.date < today) return false;

  // Same day → check the time
  const [hours, minutes] = b.time.split(":").map(Number);
  const appointment = new Date();
  appointment.setHours(hours, minutes, 0, 0);

  return now < appointment; // still upcoming only if current time is before the slot
}

/* ===== Delete bookings whose date has already passed ===== */
function cleanPastBookings() {
  const today = new Date().toISOString().split("T")[0];
  let mine = getMine();
  const past = mine.filter(b => b.date < today);

  if (past.length === 0) return;

  // Remove from My Bookings
  mine = mine.filter(b => b.date >= today);
  saveMine(mine);

  // Free the slots in global bookings
  const all = getBookings();
  past.forEach(b => {
    if (all[b.date]) {
      all[b.date] = all[b.date].filter(x => x.id !== b.id);
      if (all[b.date].length === 0) delete all[b.date];
    }
  });
  saveBookings(all);
}

function render() {
  // Clean past bookings every time the page loads
  cleanPastBookings();

  const listEl = document.getElementById("bookingsList");
  const emptyEl = document.getElementById("emptyState");
  let mine = getMine().sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));

  if (mine.length === 0) {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  listEl.innerHTML = mine.map(b => {
    const upcoming = isUpcoming(b);
    return `
      <article class="booking-card ${upcoming ? "" : "past"}">
        <div class="booking-top">
          <div>
            <div class="booking-cut">${b.cut}</div>
            <div class="booking-when">${fmtDate(b.date)} • ${b.time}</div>
          </div>
          <span class="booking-badge ${upcoming ? "ok" : "muted"}">${upcoming ? "Upcoming" : "Past"}</span>
        </div>
        <ul class="booking-meta">
          <li><strong>Name:</strong> ${b.name}</li>
          <li><strong>Type:</strong> ${b.type}</li>
          ${b.type === "House Call" ? `<li><strong>Address:</strong> ${b.address}</li>` : ""}
          <li><strong>Phone:</strong> ${b.phone}</li>
        </ul>
        ${upcoming ? `
        <div class="booking-actions">
          <button class="nav-btn ghost" data-action="reschedule" data-id="${b.id}">Reschedule</button>
          <button class="nav-btn danger" data-action="cancel" data-id="${b.id}">Cancel</button>
        </div>` : ""}
      </article>
    `;
  }).join("");

  listEl.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (action === "cancel") cancelBooking(id);
      else if (action === "reschedule") openReschedule(id);
    });
  });
}

function cancelBooking(id) {
  const mine = getMine();
  const b = mine.find(x => x.id === id);
  if (!b) return;
  if (!confirm(`Cancel ${b.cut} on ${fmtDate(b.date)} at ${b.time}?`)) return;

  // remove from global bookings (frees the slot)
  const all = getBookings();
  if (all[b.date]) {
    all[b.date] = all[b.date].filter(x => x.id !== id);
    if (all[b.date].length === 0) delete all[b.date];
    saveBookings(all);
  }
  // remove from mine
  saveMine(mine.filter(x => x.id !== id));
  render();
}

// Reschedule modal logic
let currentRescheduleId = null;

function openReschedule(id) {
  const mine = getMine();
  const b = mine.find(x => x.id === id);
  if (!b) return;
  currentRescheduleId = id;

  document.getElementById("modalSummary").textContent =
    `${b.cut} — currently ${fmtDate(b.date)} at ${b.time}`;
  const newDate = document.getElementById("newDate");
  newDate.value = b.date;
  newDate.min = new Date().toISOString().split("T")[0];
  document.getElementById("modalError").textContent = "";

  renderNewSlots(b.date, b.time, id);

  newDate.onchange = () => {
    renderNewSlots(newDate.value, null, id);
  };

  document.getElementById("rescheduleModal").style.display = "flex";
}

let chosenNewSlot = null;
function renderNewSlots(date, preselect, excludeId) {
  chosenNewSlot = preselect || null;
  const container = document.getElementById("newSlots");
  const all = getBookings();
  const taken = (all[date] || []).filter(x => x.id !== excludeId).map(x => x.time);

  container.innerHTML = ALL_SLOTS.map(t => {
    const isTaken = taken.includes(t);
    const sel = t === chosenNewSlot ? "selected" : "";
    return `<div class="slot ${sel}" data-time="${t}" ${isTaken ? 'style="display:none"' : ""}>${t}</div>`;
  }).join("");

  container.querySelectorAll(".slot").forEach(s => {
    s.addEventListener("click", () => {
      chosenNewSlot = s.getAttribute("data-time");
      container.querySelectorAll(".slot").forEach(x => x.classList.remove("selected"));
      s.classList.add("selected");
    });
  });
}

function closeReschedule() {
  document.getElementById("rescheduleModal").style.display = "none";
  currentRescheduleId = null;
  chosenNewSlot = null;
}

function confirmReschedule() {
  const id = currentRescheduleId;
  if (!id) return;
  const newDate = document.getElementById("newDate").value;
  const errEl = document.getElementById("modalError");
  errEl.textContent = "";

  if (!newDate) { errEl.textContent = "Pick a date."; return; }
  if (!chosenNewSlot) { errEl.textContent = "Pick a time slot."; return; }

  const mine = getMine();
  const b = mine.find(x => x.id === id);
  if (!b) return;

  const all = getBookings();
  const taken = (all[newDate] || []).filter(x => x.id !== id).map(x => x.time);
  if (taken.includes(chosenNewSlot)) {
    errEl.textContent = "That slot was just taken. Pick another.";
    renderNewSlots(newDate, null, id);
    return;
  }

  // remove old entry from global
  if (all[b.date]) {
    all[b.date] = all[b.date].filter(x => x.id !== id);
    if (all[b.date].length === 0) delete all[b.date];
  }
  // insert new entry
  if (!all[newDate]) all[newDate] = [];
  all[newDate].push({
    id, name: b.name, time: chosenNewSlot, cut: b.cut, type: b.type,
    phone: b.phone, address: b.address
  });
  saveBookings(all);

  // update mine
  b.date = newDate;
  b.time = chosenNewSlot;
  saveMine(mine);

  closeReschedule();
  render();
}

document.getElementById("cancelReschedule").addEventListener("click", closeReschedule);
document.getElementById("confirmReschedule").addEventListener("click", confirmReschedule);
document.getElementById("rescheduleModal").addEventListener("click", (e) => {
  if (e.target.id === "rescheduleModal") closeReschedule();
});

render();