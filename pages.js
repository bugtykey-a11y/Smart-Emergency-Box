"use strict";

// These pages read the existing dashboard endpoint. Settings need a separate backend API before editing is enabled.
const config = window.SMART_BOX_CONFIG || {};
const page = document.getElementById("pageContent").dataset.page;
const storageKey = "smart-emergency-box-language";
let language = localStorage.getItem(storageKey) === "th" ? "th" : "en";
let snapshot = null;
let loadError = "";
let filter = "all";
let loading = false;
let hasLoaded = false;

const labels = {
  en: {
    dashboard: "Dashboard", history: "History", devices: "Devices", cameras: "CCTV Monitor", notifications: "Notifications", settings: "Settings", help: "Emergency guide",
    historyIntro: "Recent events supplied by the dashboard API.", historyLimit: "The current API returns up to 30 recent alerts. Full searchable history needs a backend endpoint.",
    devicesIntro: "Latest reported status of the ESP32 and connected modules.", notificationsIntro: "Recent notifications supplied by the dashboard API.",
    settingsIntro: "Current device thresholds and mobile notification setup.", settingsPending: "Settings are read only until the backend provides a settings API. Changing these values here would not change the alarm on the device.",
    channelsPending: "Mobile delivery requires a backend service and recipient setup. No delivery channel is configured from this page yet.",
    noData: "No data received from the API.", apiError: "Unable to load API data", stale: "Last device update is old. Treat these readings as unavailable.",
    all: "All", info: "Info", warning: "Warning", emergency: "Emergency", unread: "Unread", read: "Read",
    type: "Type", status: "Status", date: "Date / time", event: "Event", device: "Device", lastUpdate: "Last update", online: "Online", offline: "Offline",
    gasWarning: "Gas warning threshold", gasEmergency: "Gas emergency threshold", gasMax: "Gas scale maximum", deviceId: "Device ID",
    channels: "Mobile notification channels", line: "LINE Messaging API", telegram: "Telegram Bot", push: "Web push / Firebase",
    notConfigured: "Awaiting backend setup", currentValues: "Current values", modules: "Hardware modules", empty: "No records in the latest API response.",
    loading: "Loading data…", refresh: "Refresh", retry: "Try again", connected: "API connected", unavailable: "API unavailable", updated: "Last received", details: "View details", close: "Close",
    helpIntro: "Evacuation information and essential safety instructions. This guide remains available without an API connection.",
    assemblyTitle: "Assembly point", assemblyDemo: "DEMONSTRATION DATA — replace this plan and location with verified information for the actual building.",
    assemblyName: "Assembly Point A — North parking area", assemblyRouteTitle: "Recommended evacuation route",
    assemblyRoute: "Leave the control room through the east emergency exit, follow the green route past the reception area, then continue to the open north parking area.",
    mapTitle: "Example evacuation plan", mapYouAreHere: "YOU ARE HERE", mapControl: "Control room", mapReception: "Reception", mapExit: "Emergency exit", mapAssembly: "Assembly Point A", mapLift: "DO NOT USE LIFT", mapSmoke: "AVOID SMOKE AREA",
    avoidTitle: "Do not use during evacuation", avoid1: "Do not use lifts. Use the marked fire escape stairs.", avoid2: "Do not enter the simulated smoke area or return to collect belongings.", avoid3: "Do not block fire lanes or leave the assembly point until attendance is checked.",
    contactTitle: "Thailand emergency contacts", fireContact: "Fire and public disaster", policeContact: "Emergency police", medicalContact: "Emergency medical service", callLabel: "Call",
    extinguisherTitle: "How to use a fire extinguisher", extinguisherWarning: "Only attempt a small, early-stage fire when you have the correct extinguisher and a clear escape route behind you. If smoke increases, the fire spreads, or you are unsure: evacuate, close the door if safe, and call 199.",
    passP: "PULL", passPDetail: "Pull the safety pin.", passA: "AIM", passADetail: "Aim the nozzle at the base of the fire.", passS1: "SQUEEZE", passS1Detail: "Squeeze the operating lever slowly.", passS2: "SWEEP", passS2Detail: "Sweep from side to side at the base of the fire.",
    exitRule: "Keep the exit behind you at all times. If one extinguisher cannot control the fire, evacuate immediately.", sourceLabel: "Official emergency-number references"
  },
  th: {
    dashboard: "ภาพรวม", history: "ประวัติ", devices: "อุปกรณ์", cameras: "กล้องเฝ้าระวัง", notifications: "การแจ้งเตือน", settings: "ตั้งค่า", help: "คู่มือฉุกเฉิน",
    historyIntro: "เหตุการณ์ล่าสุดที่ได้รับจาก API ของ Dashboard", historyLimit: "API ปัจจุบันส่งเหตุการณ์ล่าสุดได้สูงสุด 30 รายการ การค้นหาประวัติทั้งหมดต้องมี endpoint ฝั่ง backend เพิ่ม",
    devicesIntro: "สถานะล่าสุดของ ESP32 และอุปกรณ์ที่เชื่อมต่อ", notificationsIntro: "การแจ้งเตือนล่าสุดจาก API ของ Dashboard",
    settingsIntro: "ค่าเกณฑ์ปัจจุบันและการตั้งค่าแจ้งเตือนเข้ามือถือ", settingsPending: "หน้านี้แสดงค่าอย่างเดียวจนกว่าจะมี API สำหรับบันทึก การเปลี่ยนค่าบนหน้าเว็บเพียงอย่างเดียวไม่เปลี่ยนการเตือนของอุปกรณ์",
    channelsPending: "การส่งแจ้งเตือนไปมือถือจำเป็นต้องมีบริการฝั่ง backend และข้อมูลผู้รับ ตอนนี้ยังตั้งค่าช่องทางผ่านหน้านี้ไม่ได้",
    noData: "ยังไม่ได้รับข้อมูลจาก API", apiError: "โหลดข้อมูล API ไม่สำเร็จ", stale: "ข้อมูลล่าสุดจากอุปกรณ์เก่าเกินไป โปรดอย่าใช้เป็นสถานะปัจจุบัน",
    all: "ทั้งหมด", info: "ข้อมูล", warning: "เตือน", emergency: "ฉุกเฉิน", unread: "ยังไม่อ่าน", read: "อ่านแล้ว",
    type: "ประเภท", status: "สถานะ", date: "วัน / เวลา", event: "เหตุการณ์", device: "อุปกรณ์", lastUpdate: "อัปเดตล่าสุด", online: "ออนไลน์", offline: "ออฟไลน์",
    gasWarning: "ค่าแก๊สระดับเตือน", gasEmergency: "ค่าแก๊สระดับฉุกเฉิน", gasMax: "ค่าสูงสุดของสเกลแก๊ส", deviceId: "รหัสอุปกรณ์",
    channels: "ช่องทางแจ้งเตือนมือถือ", line: "LINE Messaging API", telegram: "Telegram Bot", push: "Web push / Firebase",
    notConfigured: "รอระบบหลังบ้าน", currentValues: "ค่าปัจจุบัน", modules: "อุปกรณ์ภายใน", empty: "ไม่มีรายการในข้อมูลล่าสุดจาก API",
    loading: "กำลังโหลดข้อมูล…", refresh: "รีเฟรช", retry: "ลองอีกครั้ง", connected: "เชื่อมต่อ API แล้ว", unavailable: "API ไม่พร้อมใช้งาน", updated: "ข้อมูลที่ได้รับล่าสุด", details: "ดูรายละเอียด", close: "ปิด",
    helpIntro: "ข้อมูลการอพยพและคำแนะนำด้านความปลอดภัยที่จำเป็น หน้านี้เปิดอ่านได้แม้ API ไม่ทำงาน",
    assemblyTitle: "จุดรวมพล", assemblyDemo: "ข้อมูลจำลอง — ต้องเปลี่ยนแผนผังและสถานที่นี้เป็นข้อมูลที่ผ่านการตรวจสอบของอาคารจริงก่อนใช้งาน",
    assemblyName: "จุดรวมพล A — ลานจอดรถด้านทิศเหนือ", assemblyRouteTitle: "เส้นทางอพยพที่แนะนำ",
    assemblyRoute: "ออกจากห้องควบคุมทางประตูฉุกเฉินด้านตะวันออก เดินตามเส้นทางสีเขียวผ่านโถงต้อนรับ แล้วไปยังลานจอดรถโล่งด้านทิศเหนือ",
    mapTitle: "ตัวอย่างแผนผังอพยพ", mapYouAreHere: "คุณอยู่ที่นี่", mapControl: "ห้องควบคุม", mapReception: "โถงต้อนรับ", mapExit: "ทางออกฉุกเฉิน", mapAssembly: "จุดรวมพล A", mapLift: "ห้ามใช้ลิฟต์", mapSmoke: "ห้ามผ่านพื้นที่มีควัน",
    avoidTitle: "จุดห้ามใช้ระหว่างอพยพ", avoid1: "ห้ามใช้ลิฟต์ ให้ใช้บันไดหนีไฟตามป้ายเท่านั้น", avoid2: "ห้ามผ่านพื้นที่จำลองที่มีควัน และห้ามย้อนกลับไปเก็บสิ่งของ", avoid3: "ห้ามกีดขวางทางรถฉุกเฉินหรือออกจากจุดรวมพลก่อนตรวจสอบจำนวนคน",
    contactTitle: "เบอร์ติดต่อฉุกเฉินในประเทศไทย", fireContact: "แจ้งเหตุเพลิงไหม้และสาธารณภัย", policeContact: "เหตุด่วนเหตุร้าย", medicalContact: "การแพทย์ฉุกเฉิน", callLabel: "โทร",
    extinguisherTitle: "วิธีใช้ถังดับเพลิง", extinguisherWarning: "ใช้กับไฟระยะแรกที่มีขนาดเล็กเท่านั้น ต้องเลือกถังให้ถูกประเภทและมีทางหนีอยู่ด้านหลัง หากควันเพิ่ม ไฟลุกลาม หรือไม่มั่นใจ ให้อพยพ ปิดประตูเมื่อทำได้อย่างปลอดภัย และโทร 199",
    passP: "PULL — ดึง", passPDetail: "ดึงสลักนิรภัยออก", passA: "AIM — เล็ง", passADetail: "เล็งหัวฉีดไปที่ฐานของไฟ", passS1: "SQUEEZE — บีบ", passS1Detail: "บีบคันบีบอย่างช้า ๆ", passS2: "SWEEP — ส่าย", passS2Detail: "ส่ายหัวฉีดซ้าย–ขวาบริเวณฐานของไฟ",
    exitRule: "ให้ทางออกอยู่ด้านหลังตัวคุณเสมอ หากถังหนึ่งถังไม่สามารถควบคุมไฟได้ ให้อพยพทันที", sourceLabel: "แหล่งอ้างอิงหมายเลขฉุกเฉินจากหน่วยงานรัฐ"
  }
};

const names = { esp32: "ESP32", dht22: "DHT22", mq2: "MQ-2 Gas Sensor", water: "Water Sensor", oled: "OLED Display", buzzer: "Buzzer" };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const dateText = (value) => new Date(value).toLocaleString(language === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
const note = (value) => `<p class="secondary-note" role="status">${escapeHtml(value)}</p>`;
const row = (title, detail, status) => `<div class="secondary-row"><div><span>${escapeHtml(title)}</span><small>${escapeHtml(detail)}</small></div><strong>${escapeHtml(status)}</strong></div>`;

async function loadSnapshot() {
  if (page === "help" || loading) return;
  loading = true;
  render();
  if (location.protocol === "file:") { loadError = "Open through Apache/XAMPP to reach the API."; loading = false; hasLoaded = true; render(); return; }
  const endpoint = config.endpoints?.dashboard || "/dashboard.php";
  const url = new URL((config.baseUrl || "./api").replace(/\/$/, "") + endpoint, location.href);
  url.searchParams.set("deviceId", config.deviceId || "seb-001");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 8000);
  try {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal });
    const body = await response.json();
    if (!response.ok || body?.success !== true || !body.data || body.data.deviceId !== (config.deviceId || "seb-001") || !Array.isArray(body.data.alerts) ||
        !Array.isArray(body.data.notifications) || !Array.isArray(body.data.devices)) throw new Error(body?.error?.message || "Invalid API response");
    snapshot = body.data;
    loadError = "";
  } catch (error) { snapshot = null; loadError = error.name === "AbortError" ? "Request timed out" : error.message; }
  finally { clearTimeout(timeout); }
  loading = false;
  hasLoaded = true;
  render();
}

function render() {
  const t = labels[language];
  document.documentElement.lang = language;
  document.title = `${t[page]} — Smart Emergency Box`;
  document.querySelectorAll("[data-page-label]").forEach((link) => { link.textContent = t[link.dataset.pageLabel]; });
  document.querySelectorAll("[data-page-menu-label]").forEach((label) => { label.textContent = language === "th" ? "เมนูเพิ่มเติม" : "More"; });
  document.getElementById("languageToggle").textContent = language === "en" ? "ไทย" : "EN";
  document.getElementById("languageToggle").setAttribute("aria-label", language === "en" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English");
  const intro = t[`${page}Intro`];
  let content = `<div class="secondary-heading"><div><h1>${t[page]}</h1><p class="secondary-intro">${intro}</p></div>${page === "help" ? "" : `<button id="refreshPage" class="secondary-refresh" type="button" ${loading ? "disabled" : ""}>${loading ? t.loading : loadError ? t.retry : t.refresh}</button>`}</div>`;
  if (page === "help") content += renderHelp(t);
  if (page === "history") content += renderHistory(t);
  if (page === "devices") content += renderDevices(t);
  if (page === "notifications") content += renderNotifications(t);
  if (page === "settings") content += renderSettings(t);
  document.getElementById("pageContent").innerHTML = content;
  const select = document.getElementById("recordFilter");
  if (select) select.addEventListener("change", (event) => { filter = event.target.value; render(); });
  document.getElementById("refreshPage")?.addEventListener("click", loadSnapshot);
  document.querySelectorAll("[data-alert-index]").forEach((button) => button.addEventListener("click", () => showAlertDetails(Number(button.dataset.alertIndex))));
  document.getElementById("closeDetails")?.addEventListener("click", () => document.getElementById("alertDetails").close());
  if (page === "help" && location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function dataNotice(t) {
  if (loading && !snapshot) return note(t.loading);
  if (loadError) return note(`${t.apiError}: ${loadError}`);
  if (!snapshot) return note(hasLoaded ? t.noData : t.loading);
  const age = Date.now() - Date.parse(snapshot.updatedAt);
  const state = !Number.isFinite(age) || age < -5000 || age > (config.staleAfterMs || 30000) || !snapshot.deviceOnline ? t.stale : t.connected;
  return note(`${state} · ${t.updated}: ${dateText(snapshot.updatedAt)}`);
}

function renderHistory(t) {
  const items = snapshot?.alerts || [];
  const visible = filter === "all" ? items : items.filter((item) => item.type === filter);
  return `${note(t.historyLimit)}${dataNotice(t)}<select class="secondary-filter" id="recordFilter" aria-label="${t.type}">
    <option value="all" ${filter === "all" ? "selected" : ""}>${t.all}</option>
    ${["INFO", "WARNING", "EMERGENCY"].map((type) => `<option value="${type}" ${filter === type ? "selected" : ""}>${t[type.toLowerCase()]}</option>`).join("")}
  </select><div class="secondary-list">${visible.length ? visible.map((item) => `<button class="secondary-row secondary-row-button" type="button" data-alert-index="${items.indexOf(item)}"><span><span>${escapeHtml(item.event)}</span><small>${escapeHtml(dateText(item.createdAt))} · ${escapeHtml(item.type)}</small></span><strong>${escapeHtml(item.status)} · ${t.details}</strong></button>`).join("") : !snapshot ? "" : note(t.empty)}</div>
  <dialog id="alertDetails" class="secondary-dialog" aria-labelledby="alertDetailsTitle"><h2 id="alertDetailsTitle"></h2><div id="alertDetailsBody"></div><button type="button" id="closeDetails" class="secondary-refresh">${t.close}</button></dialog>`;
}

function showAlertDetails(index) {
  const alert = snapshot?.alerts?.[index];
  if (!alert) return;
  const t = labels[language];
  document.getElementById("alertDetailsTitle").textContent = alert.event;
  document.getElementById("alertDetailsBody").innerHTML = `<p>${t.date}: ${escapeHtml(dateText(alert.createdAt))}</p><p>${t.type}: ${escapeHtml(alert.type)}</p><p>${t.status}: ${escapeHtml(alert.status)}</p><p>${t.deviceId}: ${escapeHtml(snapshot.deviceId || config.deviceId || "—")}</p>`;
  document.getElementById("alertDetails").showModal();
}

function renderHelp(t) {
  return `<nav class="guide-jump" aria-label="${t.help}"><a href="#assembly-point">${t.assemblyTitle}</a><a href="#fire-extinguisher">${t.extinguisherTitle}</a></nav>
  <section class="secondary-card guide-section assembly-guide" id="assembly-point">
    <div class="guide-title"><span class="guide-symbol" aria-hidden="true">📍</span><div><span class="guide-kicker">${t.assemblyTitle}</span><h2>${t.assemblyName}</h2></div></div>
    <p class="demo-warning">${t.assemblyDemo}</p>
    <div class="assembly-layout"><div><h3>${t.assemblyRouteTitle}</h3><p>${t.assemblyRoute}</p>
      <div class="evacuation-map" role="img" aria-label="${t.mapTitle}">
        <div class="map-room control"><strong>${t.mapControl}</strong><span class="you-marker">● ${t.mapYouAreHere}</span></div>
        <div class="map-room reception">${t.mapReception}</div><div class="map-room lift">✕ ${t.mapLift}</div>
        <div class="map-room smoke">⚠ ${t.mapSmoke}</div><div class="map-exit">${t.mapExit} →</div>
        <div class="route-line"><span>➜</span><span>➜</span><span>➜</span></div><div class="map-assembly"><span>◎</span><strong>${t.mapAssembly}</strong></div>
      </div></div>
      <aside class="avoid-card"><h3>${t.avoidTitle}</h3><ul><li>${t.avoid1}</li><li>${t.avoid2}</li><li>${t.avoid3}</li></ul></aside>
    </div>
    <h3 class="contact-heading">${t.contactTitle}</h3><div class="emergency-contacts">
      ${emergencyContact("199", t.fireContact, t.callLabel, "fire")}${emergencyContact("191", t.policeContact, t.callLabel, "police")}${emergencyContact("1669", t.medicalContact, t.callLabel, "medical")}
    </div>
  </section>
  <section class="secondary-card guide-section extinguisher-guide" id="fire-extinguisher">
    <div class="guide-title"><span class="guide-symbol" aria-hidden="true">🧯</span><div><span class="guide-kicker">PASS METHOD</span><h2>${t.extinguisherTitle}</h2></div></div>
    <p class="safety-warning">⚠ ${t.extinguisherWarning}</p>
    <div class="pass-grid">${passStep("P", t.passP, t.passPDetail)}${passStep("A", t.passA, t.passADetail)}${passStep("S", t.passS1, t.passS1Detail)}${passStep("S", t.passS2, t.passS2Detail)}</div>
    <p class="exit-rule">↩ ${t.exitRule}</p>
  </section>
  <p class="guide-sources">${t.sourceLabel}: <a href="https://thailand.prd.go.th/en/content/category/detail/id/2078/iid/382099" target="_blank" rel="noopener noreferrer">กรมประชาสัมพันธ์</a> · <a href="https://www.niems.go.th/1/News/Detail/1118?group=2" target="_blank" rel="noopener noreferrer">สถาบันการแพทย์ฉุกเฉินแห่งชาติ</a></p>`;
}

function emergencyContact(number, label, callLabel, type) {
  return `<a class="contact-card ${type}" href="tel:${number}" aria-label="${escapeHtml(callLabel)} ${number}: ${escapeHtml(label)}"><span>${escapeHtml(label)}</span><strong>${number}</strong><small>${escapeHtml(callLabel)} ${number}</small></a>`;
}

function passStep(letter, title, detail) {
  return `<article class="pass-step"><span>${letter}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div></article>`;
}

function renderDevices(t) {
  const items = snapshot?.devices || [];
  const age = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;
  const status = !snapshot || !Number.isFinite(age) || age > (config.staleAfterMs || 30000) ? t.unavailable : (snapshot.deviceOnline ? t.online : t.offline);
  return `${dataNotice(t)}<div class="secondary-grid"><section class="secondary-card"><h2>ESP32</h2>
    <p>${t.deviceId}: ${escapeHtml(snapshot?.deviceId || config.deviceId || "—")}</p>
    <p>${t.status}: ${status}</p><p>${t.lastUpdate}: ${snapshot?.updatedAt ? dateText(snapshot.updatedAt) : "—"}</p></section>
    <section class="secondary-card"><h2>${t.modules}</h2><div class="secondary-list">${items.length ? items.map((item) => row(names[item.id] || item.id, item.id, item.status)).join("") : note(t.empty)}</div></section></div>`;
}

function renderNotifications(t) {
  const items = snapshot?.notifications || [];
  const visible = filter === "all" ? items : items.filter((item) => filter === "unread" ? !item.read : item.read);
  return `${dataNotice(t)}<select class="secondary-filter" id="recordFilter" aria-label="${t.status}">
    <option value="all" ${filter === "all" ? "selected" : ""}>${t.all}</option>
    <option value="unread" ${filter === "unread" ? "selected" : ""}>${t.unread}</option>
    <option value="read" ${filter === "read" ? "selected" : ""}>${t.read}</option>
  </select><div class="secondary-list">${visible.length ? visible.map((item) => row(item.message, `${dateText(item.createdAt)} · ${item.type}`, item.read ? t.read : t.unread)).join("") : !snapshot ? "" : note(t.empty)}</div>`;
}

function renderSettings(t) {
  const scale = snapshot?.gasScale;
  const field = (label, value) => `<label>${label}</label><input value="${escapeHtml(value ?? "—")}" disabled>`;
  return `${note(t.settingsPending)}${dataNotice(t)}<div class="secondary-grid"><section class="secondary-card"><h2>${t.currentValues}</h2>
    ${field(t.deviceId, snapshot?.deviceId)}${field(t.gasWarning, scale?.warning)}
    ${field(t.gasEmergency, scale?.emergency)}${field(t.gasMax, scale?.max)}</section>
    <section class="secondary-card"><h2>${t.channels}</h2><p>${t.channelsPending}</p>
    ${[t.line, t.telegram, t.push].map((channel) => row(channel, "", t.notConfigured)).join("")}</section></div>`;
}

document.getElementById("languageToggle").addEventListener("click", () => {
  language = language === "en" ? "th" : "en";
  localStorage.setItem(storageKey, language);
  render();
});
render();
loadSnapshot();
