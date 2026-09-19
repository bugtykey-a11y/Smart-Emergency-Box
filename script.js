"use strict";

// API is the only data source. Never put database passwords or MQTT credentials here.
// Change endpoints/configuration in api-config.js, or adjust normalizeDashboard()
// when the backend team's response format is finalized.
const API = Object.freeze({
  baseUrl: "./api",
  deviceId: "seb-001",
  pollIntervalMs: 5000,
  timeoutMs: 8000,
  staleAfterMs: 30000,
  ...window.SMART_BOX_CONFIG,
  endpoints: { dashboard: "/dashboard.php", history: "/sensor-history.php",
    commands: "/commands.php", acknowledge: "/notifications-acknowledge.php",
    ...window.SMART_BOX_CONFIG?.endpoints }
});
const $ = (id) => document.getElementById(id);
const SYSTEM_STATUSES = ["NORMAL", "WARNING", "EMERGENCY", "OFFLINE"];
const SENSOR_STATUSES = ["NORMAL", "WARNING", "EMERGENCY", "UNKNOWN"];
const HARDWARE = [
  ["esp32", "ESP32", "bi-cpu"], ["dht22", "DHT22", "bi-thermometer-half"],
  ["mq2", "MQ-2 Gas Sensor", "bi-cloud-haze2"], ["water", "Water Sensor", "bi-water"],
  ["oled", "OLED Display", "bi-display"], ["buzzer", "Buzzer", "bi-volume-up"]
];
const state = { snapshot: null, connection: "waiting", error: "", busy: false,
  polling: false, range: "1h", historyVersion: 0, pendingAction: null };
let chart, modal, toast, pollTimer;

document.addEventListener("DOMContentLoaded", initializeDashboard);
window.addEventListener("pagehide", () => clearTimeout(pollTimer));

function initializeDashboard() {
  initializeMobileLayout();
  if (!window.bootstrap) {
    $("connectionMessage").textContent = "Bootstrap failed to load. Check your internet connection and reload.";
    return;
  }
  modal = new bootstrap.Modal($("confirmationModal"));
  toast = new bootstrap.Toast($("systemToast"), { delay: 5000 });
  bindEvents();
  initializeChart();
  updateDashboard();
  if (location.protocol === "file:") {
    state.connection = "error";
    state.error = "Open this dashboard through Apache/XAMPP, not file://, to connect to the API.";
    updateDashboard();
    return;
  }
  refreshDashboard();
  fetchSensorHistory();
}

// Move the same controls in the DOM so phone reading/tab order matches the layout.
// Restoring at the anchor keeps the desktop Bootstrap grid exactly as before.
function initializeMobileLayout() {
  const panelColumn = document.querySelector(".emergency-panel").parentElement;
  const originalPosition = document.createComment("Emergency control desktop position");
  panelColumn.before(originalPosition);
  const phoneScreen = window.matchMedia("(max-width: 767.98px)");
  const applyLayout = () => {
    if (phoneScreen.matches) $("mobileEmergencySlot").append(panelColumn);
    else originalPosition.after(panelColumn);
  };
  phoneScreen.addEventListener("change", applyLayout);
  applyLayout();
}

function bindEvents() {
  document.querySelectorAll("[data-action]").forEach((button) =>
    button.addEventListener("click", () => requestAction(button.dataset.action)));
  $("gasDetectionToggle").addEventListener("change", (event) => {
    const enabled = event.target.checked;
    event.target.checked = state.snapshot?.gasDetectionEnabled === true;
    requestAction(enabled ? "enableGas" : "disableGas");
  });
  $("confirmActionButton").addEventListener("click", executePendingAction);
  $("confirmationModal").addEventListener("hidden.bs.modal", () => { state.pendingAction = null; });
  $("refreshConnection").addEventListener("click", () => {
    refreshDashboard();
    fetchSensorHistory();
  });
  $("clearNotifications").addEventListener("click", acknowledgeNotifications);
  document.querySelectorAll("[data-range]").forEach((button) =>
    button.addEventListener("click", () => {
      state.range = button.dataset.range;
      document.querySelectorAll("[data-range]").forEach((item) =>
        item.classList.toggle("active", item === button));
      fetchSensorHistory();
    }));
}

// Single HTTP adapter: timeout, cookies, JSON errors, no automatic POST retries.
async function apiRequest(endpoint, { method = "GET", query = {}, body, requestId } = {}) {
  const url = new URL(API.baseUrl.replace(/\/$/, "") + endpoint, location.href);
  url.searchParams.set("deviceId", API.deviceId);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API.timeoutMs);
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (requestId) headers["Idempotency-Key"] = requestId;
  // Backend should render a session-bound CSRF token into this meta tag.
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  try {
    const response = await fetch(url, { method, headers, credentials: "same-origin",
      cache: "no-store", signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}) });
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error(`API returned non-JSON data (HTTP ${response.status}).`); }
    if (!response.ok || payload?.success !== true) {
      throw new Error(typeof payload?.error?.message === "string"
        ? payload.error.message : `API request failed (HTTP ${response.status}).`);
    }
    return payload.data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("API timed out. No device action has been confirmed.");
    throw error;
  } finally { clearTimeout(timer); }
}

async function fetchSensorData() {
  return normalizeDashboard(await apiRequest(API.endpoints.dashboard));
}

async function refreshDashboard() {
  if (state.polling || location.protocol === "file:") return;
  clearTimeout(pollTimer);
  state.polling = true;
  $("refreshConnection").disabled = true;
  try {
    state.snapshot = await fetchSensorData();
    state.connection = "connected";
    state.error = "";
  } catch (error) {
    state.connection = "error";
    state.error = error.message;
    // Keep the last snapshot internally, but never present old readings as live.
  } finally {
    state.polling = false;
    $("refreshConnection").disabled = false;
    updateDashboard();
    pollTimer = setTimeout(refreshDashboard, API.pollIntervalMs);
  }
}

// Validate API types instead of interpreting strings such as "false" as true.
function normalizeDashboard(data) {
  if (!data || typeof data !== "object" || data.deviceId !== API.deviceId ||
      !SYSTEM_STATUSES.includes(data.systemStatus) ||
      !Array.isArray(data.devices) || !Array.isArray(data.alerts) ||
      !Array.isArray(data.notifications)) throw new Error("Invalid dashboard API response.");
  ["deviceOnline", "gasDetectionEnabled", "buzzerActive", "alarmSilenced"].forEach((key) => {
    if (typeof data[key] !== "boolean") throw new Error(`Invalid API field: ${key}.`);
  });
  if (data.buzzerActive && data.alarmSilenced) throw new Error("Conflicting buzzer status.");
  if (!data.sensors || typeof data.sensors !== "object") throw new Error("Missing sensors in API response.");
  ["temperature", "humidity", "gas"].forEach((key) => {
    const sensor = data.sensors[key];
    if (!sensor || !(sensor.value === null || (typeof sensor.value === "number" &&
        Number.isFinite(sensor.value))) || !SENSOR_STATUSES.includes(sensor.status)) {
      throw new Error(`Invalid sensor data: ${key}.`);
    }
    if ((sensor.value === null && sensor.status !== "UNKNOWN") ||
        (sensor.value !== null && (sensor.status === "UNKNOWN" ||
        (key === "humidity" && (sensor.value < 0 || sensor.value > 100)) ||
        (key === "gas" && sensor.value < 0)))) throw new Error(`Invalid sensor value: ${key}.`);
  });
  if (!data.sensors.water || ![true, false, null].includes(data.sensors.water.detected)) {
    throw new Error("Invalid water sensor data.");
  }
  if (!validDate(data.updatedAt)) throw new Error("Invalid updatedAt timestamp.");
  if (!data.gasScale || !Number.isFinite(data.gasScale.warning) ||
      !Number.isFinite(data.gasScale.emergency) || !Number.isFinite(data.gasScale.max) ||
      !(0 < data.gasScale.warning && data.gasScale.warning < data.gasScale.emergency &&
        data.gasScale.emergency < data.gasScale.max)) throw new Error("Invalid gas scale.");
  if (!data.devices.every((item) => item && typeof item.id === "string" &&
      ["Online", "Working", "Disabled", "Offline", "Error", "Standby", "Active", "Silenced", "Unknown"].includes(item.status))) {
    throw new Error("Invalid hardware statuses.");
  }
  if (!data.alerts.every((item) => item && typeof item.event === "string" &&
      validDate(item.createdAt) && ["INFO", "WARNING", "EMERGENCY"].includes(item.type) &&
      ["Active", "Acknowledged", "Resolved"].includes(item.status))) throw new Error("Invalid alert history.");
  if (!data.notifications.every((item) => item && typeof item.id === "string" &&
      typeof item.message === "string" && typeof item.read === "boolean" &&
      validDate(item.createdAt) && ["INFO", "WARNING", "EMERGENCY"].includes(item.type))) {
    throw new Error("Invalid notifications.");
  }
  return data;
}

function dataIsFresh() {
  if (state.connection !== "connected" || !state.snapshot) return false;
  const age = Date.now() - Date.parse(state.snapshot.updatedAt);
  return age >= -5000 && age <= API.staleAfterMs;
}
function controlsAvailable() {
  return dataIsFresh() && state.snapshot.deviceOnline && !state.busy;
}

function updateDashboard() {
  updateSystemStatus();
  updateSensorCards();
  updateGasMonitor();
  updateBuzzerStatus();
  renderDevices();
  renderAlertHistory();
  updateNotifications();
  updateConnection();
  document.querySelectorAll("[data-action]").forEach((button) => { button.disabled = !controlsAvailable(); });
  $("gasDetectionToggle").disabled = !controlsAvailable();
  $("gasDetectionToggle").checked = state.snapshot?.gasDetectionEnabled === true;
  $("confirmActionButton").disabled = !controlsAvailable();
}

function updateSystemStatus() {
  const fresh = dataIsFresh(), data = state.snapshot;
  const status = fresh ? (data.deviceOnline ? data.systemStatus : "OFFLINE") : "UNKNOWN";
  const descriptions = {
    NORMAL: ["bi-shield-check", "System is operating normally."],
    WARNING: ["bi-exclamation-triangle", "Warning detected. Please check the system."],
    EMERGENCY: ["bi-radioactive", "EMERGENCY! Dangerous condition detected. Leave the area immediately."],
    OFFLINE: ["bi-wifi-off", "ESP32 is offline. Device control is unavailable."],
    UNKNOWN: ["bi-cloud-slash", data ? "Live data unavailable. Current safety cannot be confirmed." : "Waiting for backend data. Safety status has not been confirmed."]
  };
  $("systemStatusCard").className = `status-hero status-${status === "UNKNOWN" ? "offline" : status.toLowerCase()}`;
  $("systemStatusTitle").textContent = status === "UNKNOWN" ? (data ? "DATA UNAVAILABLE" : "WAITING FOR DATA") : status;
  $("systemStatusIcon").className = `bi ${descriptions[status][0]}`;
  $("systemStatusMessage").textContent = descriptions[status][1] +
    (!fresh && data?.systemStatus === "EMERGENCY" ? " Last reported status: EMERGENCY — do not assume the area is safe." : "");
  $("monitoringCount").textContent = fresh && data.deviceOnline
    ? `${data.devices.filter((item) => ["dht22", "mq2", "water"].includes(item.id) && item.status === "Working").length} sensor modules active` : "—";
}

function updateSensorCards() {
  const usable = dataIsFresh() && state.snapshot.deviceOnline;
  const sensors = state.snapshot?.sensors;
  ["temperature", "humidity", "gas"].forEach((key) => {
    const disabled = key === "gas" && usable && !state.snapshot.gasDetectionEnabled;
    const sensor = sensors?.[key], value = usable && !disabled ? sensor.value : null;
    $(key + "Value").textContent = value === null ? "—" : key === "temperature" ? value.toFixed(1) : value.toLocaleString();
    setBadge($(key + "Badge"), disabled ? "DISABLED" : usable ? sensor.status : "UNKNOWN");
  });
  const water = usable ? sensors.water.detected : null;
  $("waterValue").textContent = water === null ? "Unknown" : water ? "Water Detected" : "Dry";
  setBadge($("waterBadge"), water === null ? "UNKNOWN" : water ? "WARNING" : "DRY", water === false ? "normal" : undefined);
  $("gasCard").classList.toggle("disabled", usable && !state.snapshot.gasDetectionEnabled);
  document.querySelectorAll(".sensor-time").forEach((item) => {
    item.textContent = usable ? `Updated ${formatDateTime(state.snapshot.updatedAt)}` : "No live reading";
  });
}

function updateGasMonitor() {
  const data = state.snapshot, usable = dataIsFresh() && data.deviceOnline;
  const enabled = usable && data.gasDetectionEnabled && data.sensors.gas.value !== null;
  $("gasEnabledContent").classList.toggle("d-none", !enabled);
  $("gasDisabledContent").classList.toggle("d-none", enabled);
  $("gasDetectionLabel").textContent = !usable ? "Unknown" : data.gasDetectionEnabled ? "Active" : "Disabled";
  $("gasDetectionLabel").style.color = !usable ? "#94a3b8" : data.gasDetectionEnabled ? "#86efac" : "#fca5a5";
  $("gasDisabledContent").querySelector("strong").textContent = usable && !data.gasDetectionEnabled
    ? "Gas Detection is currently disabled." : "Gas readings are unavailable.";
  $("gasDisabledContent").querySelector("span").textContent = usable && !data.gasDetectionEnabled
    ? "Gas monitoring is disabled. Other sensors remain active." : "Waiting for fresh sensor data from the backend.";
  if (!enabled) return;
  const { gas } = data.sensors, scale = data.gasScale;
  $("gaugeValue").textContent = gas.value.toLocaleString() + " ppm";
  setBadge($("gaugeStatus"), gas.status);
  $("gasMarker").style.left = `${Math.min(100, gas.value / scale.max * 100)}%`;
  document.querySelector(".gauge-normal").style.width = `${scale.warning / scale.max * 100}%`;
  document.querySelector(".gauge-warning").style.width = `${(scale.emergency - scale.warning) / scale.max * 100}%`;
  document.querySelector(".gauge-emergency").style.width = `${(scale.max - scale.emergency) / scale.max * 100}%`;
  document.querySelectorAll(".gauge-labels span").forEach((item, index) => {
    item.textContent = [0, scale.warning, scale.emergency, scale.max][index].toLocaleString();
  });
  const messages = { NORMAL: "Gas level is normal", WARNING: "Gas leak detected",
    EMERGENCY: "Dangerous gas level — leave the area immediately", UNKNOWN: "Gas status unknown" };
  $("gasMessage").className = `gas-message ${gas.status.toLowerCase()}`;
  $("gasMessage").querySelector("strong").textContent = messages[gas.status];
  $("gasMessage").querySelector("small").textContent = "Status reported by the device/backend.";
}

function updateBuzzerStatus() {
  const data = state.snapshot, usable = dataIsFresh() && data.deviceOnline;
  const active = usable && data.buzzerActive, silenced = usable && data.alarmSilenced;
  const label = !usable ? "UNKNOWN" : active ? "ON — ACTIVE" : silenced ? "ALARM SILENCED" : "STANDBY";
  $("buzzerStatus").textContent = label;
  $("heroBuzzerStatus").textContent = label;
  $("heroBuzzerStatus").className = active ? "text-danger" : silenced ? "text-warning" : usable ? "text-success" : "text-secondary";
  $("buzzerIndicator").className = `buzzer-indicator ${active ? "active" : silenced ? "silenced" : ""}`;
  $("buzzerDescription").textContent = !usable ? "Awaiting device confirmation" : active
    ? "Device reports buzzer ON" : silenced ? "Sensors remain active; only buzzer is muted" : "Device reports buzzer OFF";
}

function updateConnection() {
  const data = state.snapshot, fresh = dataIsFresh();
  $("deviceStatusText").textContent = fresh ? (data.deviceOnline ? "Online" : "Offline") : "Unknown";
  $("connectionPill").classList.toggle("offline", !fresh || !data.deviceOnline);
  $("topLastUpdated").textContent = data ? formatDateTime(data.updatedAt) : "—";
  $("mobileSensorUpdated").textContent = fresh && data.deviceOnline
    ? `Updated ${formatDateTime(data.updatedAt)}` : "No live reading";
  $("connectionStatus").textContent = state.connection === "error" ? "API unavailable" :
    state.connection === "waiting" ? "Waiting for API" : !fresh ? "Sensor data is stale" : "API connected";
  $("connectionMessage").textContent = state.error || (!fresh
    ? "Controls are disabled until fresh device data is received." : "Live data refreshes automatically. Commands require device confirmation.");
  $("apiDeviceId").textContent = API.deviceId;
  $("liveDataLabel").textContent = fresh && data.deviceOnline ? "Live data" : "No live data";
  document.querySelector(".live-label").classList.toggle("inactive", !fresh || !data.deviceOnline);
  $("commandMessage").textContent = state.busy ? "Sending command — waiting for backend acceptance…" :
    !controlsAvailable() ? "Controls unavailable: connect to the API and receive fresh online device data." :
    "Commands are sent to the backend. Status changes only when reported by the device.";
}

function requestAction(action) {
  if (!controlsAvailable()) return;
  const copy = {
    emergency: ["Activate Emergency Mode?", "Send an emergency command to the ESP32. The dashboard will wait for the device-reported status.", "Send Emergency", true],
    silence: ["Silence the alarm?", "Mute only the buzzer. Sensors must continue monitoring and alert status will not be reset.", "Silence Alarm", false],
    reset: ["Reset acknowledged alerts?", "The backend and ESP32 must verify that all readings are safe before allowing reset.", "Reset Alert", false],
    enableGas: ["Enable Gas Detection?", "Resume gas monitoring on the ESP32.", "Enable Detection", false],
    disableGas: ["Disable Gas Detection?", "Disabling gas detection will stop gas leak monitoring. Other sensors must remain active.", "Disable Detection", true]
  }[action];
  if (!copy) return;
  state.pendingAction = action;
  $("confirmationTitle").textContent = copy[0];
  $("confirmationMessage").textContent = copy[1];
  $("confirmActionButton").textContent = copy[2];
  $("confirmActionButton").className = `btn ${copy[3] ? "btn-danger" : "btn-primary"}`;
  $("confirmationIcon").className = `modal-symbol ${copy[3] ? "danger" : ""}`;
  modal.show();
}

async function executePendingAction() {
  const action = state.pendingAction;
  if (!action || !controlsAvailable()) { modal.hide(); return; }
  state.pendingAction = null;
  modal.hide();
  if (action === "emergency") await activateEmergency();
  if (action === "silence") await silenceAlarm();
  if (action === "reset") await resetAlert();
  if (action === "enableGas" || action === "disableGas") await toggleGasDetection(action === "enableGas");
}
async function activateEmergency() { return sendCommand("EMERGENCY"); }
async function silenceAlarm() { return sendCommand("SILENCE_ALARM"); }
async function resetAlert() { return sendCommand("RESET_ALERT"); }
async function toggleGasDetection(enabled) { return sendCommand("SET_GAS_DETECTION", { enabled }); }

async function sendCommand(command, parameters = {}) {
  if (!controlsAvailable()) return;
  state.busy = true;
  updateDashboard();
  try {
    const requestId = createRequestId();
    const result = await apiRequest(API.endpoints.commands, { method: "POST", requestId,
      body: { deviceId: API.deviceId, command, parameters, requestId } });
    if (!result || typeof result.commandId !== "string" || result.status !== "accepted") {
      throw new Error("Invalid command response. Device execution is not confirmed.");
    }
    showToast(`Command accepted (${result.commandId}). Await device confirmation; this does not confirm execution.`);
    // No optimistic sensor/buzzer changes or fabricated local history entries.
    await refreshDashboard();
  } catch (error) {
    showToast(`${error.message} A failed response may still mean the command was received. Check device status before resending.`);
  } finally { state.busy = false; updateDashboard(); }
}

async function acknowledgeNotifications() {
  if (!dataIsFresh() || state.busy) return;
  const ids = state.snapshot.notifications.filter((item) => !item.read).map((item) => item.id);
  if (!ids.length) return;
  state.busy = true;
  updateDashboard();
  try {
    await apiRequest(API.endpoints.acknowledge, { method: "POST",
      body: { deviceId: API.deviceId, ids } });
    await refreshDashboard();
  } catch (error) { showToast(error.message); }
  finally { state.busy = false; updateDashboard(); }
}

function renderAlertHistory() {
  const items = state.snapshot?.alerts || [];
  $("recordCount").textContent = `${items.length} records${!dataIsFresh() && items.length ? " · last received" : ""}`;
  $("alertHistoryBody").innerHTML = items.length ? items.slice(0, 30).map((item) =>
    `<tr><td>${escapeHtml(formatDateTime(item.createdAt))}</td><td><span class="event-icon"><i class="bi ${typeIcon(item.type)}"></i></span>${escapeHtml(item.event)}</td><td><span class="type-pill ${item.type.toLowerCase()}">${item.type}</span></td><td><span class="event-status ${item.status.toLowerCase()}">${item.status}</span></td></tr>`).join("")
    : '<tr><td colspan="4" class="text-center py-4 text-secondary">No alert history received from the backend.</td></tr>';
}

function updateNotifications() {
  const items = state.snapshot?.notifications || [];
  const unread = items.filter((item) => !item.read);
  $("notificationBadge").textContent = unread.length;
  $("notificationBadge").classList.toggle("d-none", !unread.length);
  $("clearNotifications").disabled = !dataIsFresh() || state.busy || !unread.length;
  $("notificationList").innerHTML = items.length ? items.slice(0, 12).map((item) =>
    `<div class="notification-item"><i class="bi ${typeIcon(item.type)}"></i><div><strong>${escapeHtml(item.message)}</strong><small>${escapeHtml(formatDateTime(item.createdAt))} · ${item.read ? "Read" : "Unread"}</small></div></div>`).join("")
    : '<div class="empty-notification">No notifications received.</div>';
}

function renderDevices() {
  const fresh = dataIsFresh();
  $("deviceList").innerHTML = HARDWARE.map(([id, name, icon]) => {
    const status = fresh ? state.snapshot.devices.find((item) => item.id === id)?.status || "Unknown" : "Unknown";
    return `<div class="device-row"><i class="bi ${icon}"></i><span>${name}</span><strong class="device-state ${status.toLowerCase()}">${status}</strong></div>`;
  }).join("");
  const uptime = fresh ? state.snapshot.uptimePercent : null;
  $("uptime").textContent = typeof uptime === "number" && Number.isFinite(uptime) && uptime >= 0 && uptime <= 100 ? `${uptime}%` : "—";
}

function initializeChart() {
  if (!window.Chart) { $("chartState").textContent = "Chart.js failed to load. Check your internet connection."; return; }
  chart = new Chart($("environmentChart"), {
    type: "line",
    data: { labels: [], datasets: [
      { label: "Temperature °C", data: [], borderColor: "#fb923c", yAxisID: "y" },
      { label: "Humidity %", data: [], borderColor: "#60a5fa", yAxisID: "y" },
      { label: "Gas ppm", data: [], borderColor: "#c084fc", yAxisID: "gas" }
    ].map((item) => ({ ...item, tension: .3, borderWidth: 2, pointRadius: 0, spanGaps: false })) },
    options: { responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: "#94a3b8", usePointStyle: true, font: { size: 12 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#94a3b8", maxTicksLimit: 7 } },
        y: { grid: { color: "rgba(148,163,184,.08)" }, ticks: { color: "#94a3b8" } },
        gas: { position: "right", min: 0, grid: { display: false }, ticks: { color: "#94a3b8" } }
      }
    }
  });
}

async function fetchSensorHistory() {
  if (!chart || location.protocol === "file:") return;
  const version = ++state.historyVersion, range = state.range;
  $("chartState").textContent = "Loading sensor history…";
  chart.data.labels = [];
  chart.data.datasets.forEach((item) => { item.data = []; });
  chart.update("none");
  try {
    const data = await apiRequest(API.endpoints.history, { query: { range } });
    if (!data || !Array.isArray(data.points) || !data.points.every((point) =>
      point && validDate(point.recordedAt) && ["temperature", "humidity", "gas"].every((key) =>
        point[key] === null || (typeof point[key] === "number" && Number.isFinite(point[key]))))) {
      throw new Error("Invalid sensor history API response.");
    }
    if (version !== state.historyVersion) return; // Ignore slower responses for old ranges.
    const points = [...data.points].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
    chart.data.labels = points.map((point) => formatChartTime(point.recordedAt, range));
    ["temperature", "humidity", "gas"].forEach((key, index) => {
      chart.data.datasets[index].data = points.map((point) => point[key]);
    });
    chart.update();
    $("chartState").textContent = points.length ? `Database history · ${points.length} readings · refreshed ${formatDateTime(new Date())}` : "No sensor history for this time range.";
  } catch (error) {
    if (version === state.historyVersion) $("chartState").textContent = `History unavailable: ${error.message}`;
  }
}

function setBadge(element, text, style = text.toLowerCase()) {
  element.textContent = text;
  element.className = `sensor-badge ${style}`;
}
function showToast(message) { $("toastMessage").textContent = message; toast.show(); }
function validDate(value) { return typeof value === "string" && /T.*(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)); }
function formatDateTime(value) { return new Date(value).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function formatChartTime(value, range) { return new Date(value).toLocaleString("th-TH", { ...(range === "7d" ? { day: "2-digit", month: "short" } : {}), hour: "2-digit", minute: "2-digit" }); }
function typeIcon(type) { return type === "EMERGENCY" ? "bi-radioactive" : type === "WARNING" ? "bi-exclamation-triangle-fill" : "bi-info-circle-fill"; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function createRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
