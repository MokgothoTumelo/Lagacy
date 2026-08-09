// --- HELPER: Get unique device ID ---
function getDeviceId() {
  let deviceId = localStorage.getItem("legacy_device_id");
  if (!deviceId) {
    deviceId = "device_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("legacy_device_id", deviceId);
  }
  return deviceId;
}

// --- FETCH BOOKINGS FROM CLOUD ---
async function getMyBookings() {
  try {
    const deviceId = getDeviceId();
    // Query Firestore for all bookings where 'deviceId' matches this phone
    const snapshot = await db.collection("bookings")
      .where("deviceId", "==", deviceId)
      .orderBy("date", "asc")
      .get();

    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });
    return bookings;
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return [];
  }
}

// --- UPDATE (Reschedule) A BOOKING ---
async function updateBookingInCloud(docId, newDate, newTime) {
  try {
    await db.collection("bookings").doc(docId).update({
      date: newDate,
      time: newTime
    });
    return true;
  } catch (error) {
    console.error("Error updating booking:", error);
    return false;
  }
}

// --- DELETE A BOOKING ---
async function deleteBookingInCloud(docId) {
  try {
    await db.collection("bookings").doc(docId).delete();
    return true;
  } catch (error) {
    console.error("Error deleting booking:", error);
    return false;
  }
}

// --- UI RENDERING ---
const ALL_SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"];

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
  if (b.date > today) return true;
  if (b.date < today) return false;
  const [hours, minutes] = b.time.split(":").map(Number);
  const appointment = new Date();
  appointment.setHours(hours, minutes, 0, 0);
  return now < appointment;
}

async function render() {
  const listEl = document.getElementById("bookingsList");
  const emptyEl = document.getElementById("emptyState");

  const mine = await getMyBookings();
  mine.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));

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
          <button class="nav-btn ghost" data-action="reschedule" data-docid="${b.id}" data-current-date="${b.date}" data-current-time="${b.time}">Reschedule</button>
          <button class="nav-btn danger" data-action="cancel" data-docid="${b.id}">Cancel</button>
        </div>` : ""}
      </article>
    `;
  }).join("");

  listEl.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const docId = btn.getAttribute("data-docid");
      const action = btn.getAttribute("data-action");
      const date = btn.getAttribute("data-current-date");
      const time = btn.getAttribute("data-current-time");

      if (action === "cancel") await cancelBooking(docId);
      else if (action === "reschedule") openReschedule(docId, date, time);
    });
  });
}

async function cancelBooking(docId) {
  if (!confirm("Are you sure you want to cancel this appointment?")) return;
  const success = await deleteBookingInCloud(docId);
  if(success) render();
  else alert("Failed to cancel. Please try again.");
}

// --- RESCHEDULE MODAL LOGIC ---
let currentRescheduleDocId = null;
let chosenNewSlot = null;

function openReschedule(docId, currentDate, currentTime) {
  currentRescheduleDocId = docId;
  document.getElementById("modalSummary").textContent =
    `Rescheduling booking currently set for ${fmtDate(currentDate)} at ${currentTime}`;

  const newDate = document.getElementById("newDate");
  newDate.value = currentDate;
  newDate.min = new Date().toISOString().split("T")[0];
  document.getElementById("modalError").textContent = "";

  renderNewSlots(currentDate, currentTime, docId);

  newDate.onchange = () => {
    renderNewSlots(newDate.value, null, docId);
  };

  document.getElementById("rescheduleModal").style.display = "flex";
}

async function renderNewSlots(date, preselect, excludeDocId) {
  chosenNewSlot = preselect || null;
  const container = document.getElementById("newSlots");

  const snapshot = await db.collection("bookings")
    .where("date", "==", date)
    .get();

  const taken = snapshot.docs
    .filter(doc => doc.id !== excludeDocId)
    .map(doc => doc.data().time);

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

async function confirmReschedule() {
  const docId = currentRescheduleDocId;
  if (!docId) return;
  const newDate = document.getElementById("newDate").value;
  const errEl = document.getElementById("modalError");
  errEl.textContent = "";

  if (!newDate) { errEl.textContent = "Pick a date."; return; }
  if (!chosenNewSlot) { errEl.textContent = "Pick a time slot."; return; }

  const snapshot = await db.collection("bookings")
    .where("date", "==", newDate)
    .get();
  const taken = snapshot.docs
    .filter(doc => doc.id !== docId)
    .map(doc => doc.data().time);

  if (taken.includes(chosenNewSlot)) {
    errEl.textContent = "That slot was just taken. Pick another.";
    renderNewSlots(newDate, null, docId);
    return;
  }

  const success = await updateBookingInCloud(docId, newDate, chosenNewSlot);
  if (success) {
    closeReschedule();
    render();
  } else {
    errEl.textContent = "Failed to reschedule. Try again.";
  }
}

function closeReschedule() {
  document.getElementById("rescheduleModal").style.display = "none";
  currentRescheduleDocId = null;
  chosenNewSlot = null;
}

document.getElementById("cancelReschedule").addEventListener("click", closeReschedule);
document.getElementById("confirmReschedule").addEventListener("click", confirmReschedule);
document.getElementById("rescheduleModal").addEventListener("click", (e) => {
  if (e.target.id === "rescheduleModal") closeReschedule();
});

// --- INIT ---
render();
