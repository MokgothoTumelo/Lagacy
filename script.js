// DOM Elements
const dateInput = document.getElementById("date");
const nameInput = document.getElementById("clientName");
const phoneInput = document.getElementById("clientPhone");
const form = document.getElementById("bookingForm");
const errorEl = document.getElementById("error");
const messageEl = document.getElementById("message");
const addressSection = document.getElementById("addressSection");
const streetAddressInput = document.getElementById("streetAddress");
const citySuburbInput = document.getElementById("citySuburb");
const postalCodeInput = document.getElementById("postalCode");

const WHATSAPP_NUMBER = "27673666047";

// State
let selectedCut = "";
let selectedType = "";
let selectedSlot = null;
let currentStep = 1;

// Storage functions
function getBookings() {
  try {
    return JSON.parse(localStorage.getItem("barberBookings") || "{}");
  } catch {
    return {};
  }
}

function saveBookings(data) {
  localStorage.setItem("barberBookings", JSON.stringify(data));
}

// Track this device's own bookings (for My Bookings page)
function addToMyBookings(entry) {
  try {
    const list = JSON.parse(localStorage.getItem("myBarberBookings") || "[]");
    list.push(entry);
    localStorage.setItem("myBarberBookings", JSON.stringify(list));
  } catch {
    localStorage.setItem("myBarberBookings", JSON.stringify([entry]));
  }
}

function getFullAddress() {
  const street = streetAddressInput?.value.trim() || "";
  const city = citySuburbInput?.value.trim() || "";
  const postal = postalCodeInput?.value.trim() || "";
  return [street, city, postal].filter(p => p !== "").join(", ") || "Not provided";
}

function sendWhatsAppMessage(bookingDetails) {
  let addressLine = "";
  if (bookingDetails.type === "House Call" && bookingDetails.address && bookingDetails.address !== "Not provided") {
    addressLine = `%0A📍 *Address:* ${encodeURIComponent(bookingDetails.address)}`;
  }
  
  const message = `*LEGACY BARBER - NEW BOOKING* %0A%0A` +
    ` *Client:* ${encodeURIComponent(bookingDetails.name)}%0A` +
    ` *Date:* ${bookingDetails.date}%0A` +
    ` *Time:* ${bookingDetails.time}%0A` +
    ` *Cut:* ${bookingDetails.cut}%0A` +
    ` *Type:* ${bookingDetails.type}${addressLine}%0A` +
    ` *Contact:* ${bookingDetails.phone || "Not provided"}%0A%0A` +
    `*Walk in a king, walk out sharper!* `;
  
  const barberWhatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  window.open(barberWhatsappUrl, "_blank");
}

// Update available slots based on selected date
function updateAvailableSlots() {
  const date = dateInput.value;
  const allSlots = document.querySelectorAll("#slots .slot");
  
  if (!date) {
    allSlots.forEach(slot => {
      slot.style.display = "";
      slot.classList.remove("selected");
    });
    selectedSlot = null;
    return;
  }
  
  const bookings = getBookings();
  const takenSlots = (bookings[date] || []).map(b => b.time);
  
  allSlots.forEach(slot => {
    const time = slot.getAttribute("data-time");
    if (takenSlots.includes(time)) {
      slot.style.display = "none";
      if (selectedSlot === time) {
        selectedSlot = null;
        slot.classList.remove("selected");
      }
    } else {
      slot.style.display = "";
    }
  });
  
  renderSlotSelection();
}

function renderSlotSelection() {
  const allSlots = document.querySelectorAll("#slots .slot");
  allSlots.forEach(slot => {
    const time = slot.getAttribute("data-time");
    if (selectedSlot === time) {
      slot.classList.add("selected");
    } else {
      slot.classList.remove("selected");
    }
  });
}

// Update booking summary
function updateBookingSummary() {
  const date = dateInput.value;
  const name = nameInput.value.trim();
  const summaryEl = document.getElementById("summaryDetails");
  
  if (!summaryEl) return;
  
  const items = [];
  if (date) items.push({ label: "Date", value: new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", year: "numeric", month: "short", day: "numeric"
  })});
  if (selectedCut) items.push({ label: "Cut", value: selectedCut });
  if (selectedSlot) items.push({ label: "Time", value: selectedSlot });
  if (selectedType) items.push({ label: "Type", value: selectedType });
  if (name) items.push({ label: "Name", value: name });
  
  summaryEl.innerHTML = items.map(item => `
    <div class="booking-summary-item">
      <span class="label">${item.label}</span>
      <span class="value">${item.value}</span>
    </div>
  `).join("");
  
  if (items.length === 0) {
    summaryEl.innerHTML = '<p style="color: var(--muted); font-size: 14px;">Complete the steps above to see your summary.</p>';
  }
}

// Step navigation
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".form-step").forEach(el => {
    el.style.display = el.getAttribute("data-step") == step ? "block" : "none";
  });
  
  document.querySelectorAll(".progress-step").forEach(el => {
    const stepNum = parseInt(el.getAttribute("data-step"));
    el.classList.remove("active", "completed");
    if (stepNum === step) el.classList.add("active");
    else if (stepNum < step) el.classList.add("completed");
  });
  
  updateBookingSummary();
}

// Handle cut selection
function initCutSelection() {
  const cutOptions = document.querySelectorAll("#cuts .option");
  cutOptions.forEach(option => {
    option.addEventListener("click", () => {
      cutOptions.forEach(opt => opt.classList.remove("active"));
      option.classList.add("active");
      selectedCut = option.getAttribute("data-cut");
      errorEl.textContent = "";
      updateBookingSummary();
    });
  });
}

// Handle type selection with address + maps toggle
function initTypeSelection() {
  const typeOptions = document.querySelectorAll("#types .option");
  const shopMap = document.getElementById("shopMapSection");
  const houseMap = document.getElementById("houseCallMapSection");

  typeOptions.forEach(option => {
    option.addEventListener("click", () => {
      typeOptions.forEach(opt => opt.classList.remove("active"));
      option.classList.add("active");
      selectedType = option.getAttribute("data-type");
      errorEl.textContent = "";
      
      if (selectedType === "House Call") {
        addressSection.style.display = "block";
        if (shopMap) shopMap.style.display = "none";
        if (houseMap) houseMap.style.display = "block";
      } else {
        addressSection.style.display = "none";
        if (shopMap) shopMap.style.display = "block";
        if (houseMap) houseMap.style.display = "none";
        
        if (streetAddressInput) streetAddressInput.value = "";
        if (citySuburbInput) citySuburbInput.value = "";
        if (postalCodeInput) postalCodeInput.value = "";
      }
      updateBookingSummary();
    });
  });
}

// Handle slot selection
function attachSlotEvents() {
  const slots = document.querySelectorAll("#slots .slot");
  slots.forEach(slot => {
    slot.removeEventListener("click", slot._listener);
    const handler = () => {
      const date = dateInput.value;
      if (!date) {
        errorEl.textContent = "Please pick a date first.";
        return;
      }
      
      const time = slot.getAttribute("data-time");
      const bookings = getBookings();
      const takenSlots = (bookings[date] || []).map(b => b.time);
      
      if (takenSlots.includes(time)) {
        errorEl.textContent = "This time slot is already booked.";
        return;
      }
      
      if (selectedSlot === time) {
        selectedSlot = null;
        slot.classList.remove("selected");
      } else {
        selectedSlot = time;
        document.querySelectorAll("#slots .slot").forEach(s => s.classList.remove("selected"));
        slot.classList.add("selected");
      }
      errorEl.textContent = "";
      updateBookingSummary();
    };
    slot.addEventListener("click", handler);
    slot._listener = handler;
  });
}

// Validate address for house call
function validateHouseCallAddress() {
  if (selectedType !== "House Call") return true;
  
  const street = streetAddressInput?.value.trim();
  const city = citySuburbInput?.value.trim();
  
  if (!street) {
    errorEl.textContent = "Please provide your street address for the house call.";
    return false;
  }
  if (!city) {
    errorEl.textContent = "Please provide your city or suburb for the house call.";
    return false;
  }
  return true;
}

// Reset form state
function resetFormState() {
  selectedCut = "";
  selectedType = "";
  selectedSlot = null;
  
  document.querySelectorAll("#cuts .option").forEach(opt => opt.classList.remove("active"));
  document.querySelectorAll("#types .option").forEach(opt => opt.classList.remove("active"));
  document.querySelectorAll("#slots .slot").forEach(slot => slot.classList.remove("selected"));
  
  addressSection.style.display = "none";
  const shopMap = document.getElementById("shopMapSection");
  const houseMap = document.getElementById("houseCallMapSection");
  if (shopMap) shopMap.style.display = "none";
  if (houseMap) houseMap.style.display = "none";
  
  if (streetAddressInput) {
    streetAddressInput.value = "";
    citySuburbInput.value = "";
    postalCodeInput.value = "";
  }
  
  dateInput.value = "";
  nameInput.value = "";
  phoneInput.value = "";
  
  goToStep(1);
  updateAvailableSlots();
  attachSlotEvents();
}

// Form submission
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    messageEl.innerHTML = "";

    const date = dateInput.value;
    const name = nameInput.value.trim();
    const phoneRaw = phoneInput.value.trim();

    if (!date) { errorEl.textContent = "Please pick a date."; return; }
    if (!selectedCut) { errorEl.textContent = "Please choose a haircut."; return; }
    if (!selectedSlot) { errorEl.textContent = "Please select a time slot."; return; }
    if (!selectedType) { errorEl.textContent = "Please choose an appointment type."; return; }
    if (!name) { errorEl.textContent = "Please enter your name."; return; }
    if (!validateHouseCallAddress()) return;

    const bookings = getBookings();
    const takenSlots = (bookings[date] || []).map(b => b.time);
    if (takenSlots.includes(selectedSlot)) {
      errorEl.textContent = "Sorry, this time slot was just taken. Please pick another.";
      updateAvailableSlots();
      attachSlotEvents();
      return;
    }

    let addressString = "";
    if (selectedType === "House Call") {
      addressString = getFullAddress();
    }

    const bookingId = "bk_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    if (!bookings[date]) bookings[date] = [];
    bookings[date].push({
      id: bookingId,
      name: name,
      time: selectedSlot,
      cut: selectedCut,
      type: selectedType,
      phone: phoneRaw || "Not provided",
      address: addressString || "Shop Visit - no address"
    });
    saveBookings(bookings);

    addToMyBookings({
      id: bookingId,
      date: date,
      name: name,
      time: selectedSlot,
      cut: selectedCut,
      type: selectedType,
      phone: phoneRaw || "Not provided",
      address: addressString || "Shop Visit - no address",
      createdAt: Date.now()
    });

    const bookingDetails = {
      name, date, time: selectedSlot, cut: selectedCut, type: selectedType,
      phone: phoneRaw || "Not provided",
      address: addressString || "Shop Visit - no address"
    };

    sendWhatsAppMessage(bookingDetails);

    let successMsg = `✓ Booked, ${name}! ${selectedCut} at ${selectedSlot} on ${new Date(date + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "short", year: "numeric", month: "short", day: "numeric"
    })}.`;
    if (selectedType === "House Call" && addressString && addressString !== "Not provided") {
      successMsg += `<br>📍 House call address: ${addressString}`;
    }
    successMsg += `<br>📱 WhatsApp notification sent to barber. We'll confirm shortly.<br><br><a href="my-bookings.html" style="color: var(--gold);">View My Bookings →</a>`;
    messageEl.innerHTML = successMsg;

    resetFormState();
  });

  // Step navigation buttons
  document.querySelectorAll(".step-next").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = parseInt(btn.getAttribute("data-next"));
      
      // Validate current step
      if (next === 2) {
        const date = dateInput.value;
        if (!date) { errorEl.textContent = "Please pick a date."; return; }
        if (!selectedCut) { errorEl.textContent = "Please choose a haircut."; return; }
      }
      if (next === 3) {
        const date = dateInput.value;
        if (!date) { errorEl.textContent = "Please pick a date."; return; }
        if (!selectedCut) { errorEl.textContent = "Please choose a haircut."; return; }
        if (!selectedSlot) { errorEl.textContent = "Please select a time slot."; return; }
        if (!selectedType) { errorEl.textContent = "Please choose an appointment type."; return; }
        if (selectedType === "House Call" && !validateHouseCallAddress()) return;
      }
      
      errorEl.textContent = "";
      goToStep(next);
    });
  });

  document.querySelectorAll(".step-prev").forEach(btn => {
    btn.addEventListener("click", () => {
      const prev = parseInt(btn.getAttribute("data-prev"));
      goToStep(prev);
    });
  });

  // Date change
  dateInput.addEventListener("change", () => {
    selectedSlot = null;
    updateAvailableSlots();
    attachSlotEvents();
    errorEl.textContent = "";
    updateBookingSummary();
  });

  // Name input change for summary
  nameInput.addEventListener("input", updateBookingSummary);
  phoneInput.addEventListener("input", updateBookingSummary);

  // Initialize
  const today = new Date().toISOString().split("T")[0];
  dateInput.min = today;

  function init() {
    initCutSelection();
    initTypeSelection();
    updateAvailableSlots();
    attachSlotEvents();
    goToStep(1);
  }
  init();
}

// ===== Hamburger menu =====
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");

if (hamburger && navLinks) {
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navLinks.classList.toggle("open");
  });

  // Close menu when a link is clicked
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("active");
      navLinks.classList.remove("open");
    });
  });
}