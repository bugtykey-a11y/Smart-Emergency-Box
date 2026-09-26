"use strict";

const LONGDO_LANGUAGE_KEY = "smart-emergency-box-language";
const CAMERA_CENTER = Object.freeze({ lat: 13.7563, lon: 100.5018 });
const CAMERA_FEED_URL_PATTERN = /(?:iticfoundation\.org|mjpeg2?\.php|[?&]camid=)/i;
const cameraState = { language: localStorage.getItem(LONGDO_LANGUAGE_KEY) === "en" ? "en" : "th", map: null, cameras: true, traffic: false, events: false, viewerFocus: null, viewerMedia: null, viewerMediaPlaceholder: null };
const CAMERA_COPY = {
  th: {
    dashboard: "ภาพรวม", history: "ประวัติ", devices: "อุปกรณ์", cameras: "กล้องเฝ้าระวัง", notifications: "การแจ้งเตือน", settings: "ตั้งค่า", help: "คู่มือฉุกเฉิน", more: "เมนูเพิ่มเติม",
    eyebrow: "ติดตามสถานการณ์", title: "กล้องเฝ้าระวัง", intro: "ติดตามภาพจากกล้องจราจรและเหตุการณ์บนแผนที่ Longdo", waiting: "รอโหลดแผนที่", ready: "แผนที่พร้อมใช้งาน", error: "โหลดแผนที่ไม่สำเร็จ",
    camera: "กล้อง CCTV", traffic: "สภาพจราจร", events: "เหตุการณ์", reset: "กลับไปกรุงเทพฯ", searchTitle: "ค้นหาพื้นที่", searchHint: "ค้นหาจังหวัด อำเภอ ถนน หรือสถานที่ เช่น สมุทรสาคร", searchLabel: "ชื่อพื้นที่หรือสถานที่", searchPlaceholder: "เช่น สมุทรสาคร", searchButton: "ค้นหา", searchResults: "ผลการค้นหา", searchClose: "ปิดผลการค้นหา", searchEmpty: "กรุณาระบุพื้นที่ที่ต้องการค้นหา", searching: "กำลังค้นหา…",
    missingTitle: "ยังไม่ได้ตั้งค่า Longdo API Key", missingDetail: "ใส่ Key ใหม่ในไฟล์ longdo-config.local.js แล้วเปิดหน้านี้ผ่าน XAMPP",
    fileTitle: "ต้องเปิดผ่านเว็บเซิร์ฟเวอร์", fileDetail: "เปิดโปรเจกต์ผ่าน http://localhost โดยใช้ XAMPP ไม่ใช่เปิดไฟล์ HTML โดยตรง", loadTitle: "ไม่สามารถโหลด Longdo Map ได้", loadDetail: "ตรวจสอบ API Key, Authorized Domains และการเชื่อมต่ออินเทอร์เน็ต แล้วรีเฟรชอีกครั้ง",
    helpTitle: "วิธีดูภาพกล้อง", steps: ["ซูมหรือเลื่อนแผนที่ไปยังพื้นที่ที่ต้องการ", "กดหมุดรูปกล้องบนแผนที่", "คลิกภาพกล้องเพื่อขยายและดูแบบเต็มหน้าจอ"], noticeTitle: "หมายเหตุ", notice: "กล้องบางจุดอาจออฟไลน์ ภาพค้าง หรือไม่รองรับในเบราว์เซอร์ขณะนั้น", source: "เอกสาร Longdo Map API v3",
    viewerTitle: "ภาพกล้อง CCTV", viewerHint: "กด Esc หรือปุ่มปิดเพื่อกลับไปยังแผนที่", viewerFullscreen: "เต็มหน้าจอ", viewerExitFullscreen: "ออกจากเต็มหน้าจอ", viewerClose: "ปิดภาพขยาย", viewerAlt: "ภาพจากกล้อง CCTV ที่เลือก", viewerErrorTitle: "ไม่สามารถโหลดภาพกล้องได้", viewerErrorDetail: "กล้องอาจออฟไลน์หรือเซิร์ฟเวอร์ต้นทางไม่ตอบสนอง กรุณาลองกล้องจุดอื่น", viewerImageTitle: "คลิกเพื่อขยายภาพกล้อง"
  },
  en: {
    dashboard: "Dashboard", history: "History", devices: "Devices", cameras: "CCTV Monitor", notifications: "Notifications", settings: "Settings", help: "Emergency guide", more: "More",
    eyebrow: "SITUATION MONITORING", title: "CCTV Monitor", intro: "Monitor traffic cameras and incidents on the Longdo map.", waiting: "Waiting for map", ready: "Map ready", error: "Map unavailable",
    camera: "CCTV cameras", traffic: "Traffic", events: "Incidents", reset: "Return to Bangkok", searchTitle: "Search area", searchHint: "Search for a province, district, road or place, such as Samut Sakhon.", searchLabel: "Area or place name", searchPlaceholder: "e.g. Samut Sakhon", searchButton: "Search", searchResults: "Search results", searchClose: "Close search results", searchEmpty: "Enter an area to search.", searching: "Searching…",
    missingTitle: "Longdo API Key is not configured", missingDetail: "Add the new key to longdo-config.local.js, then open this page through XAMPP.",
    fileTitle: "A web server is required", fileDetail: "Open the project through http://localhost with XAMPP instead of opening the HTML file directly.", loadTitle: "Longdo Map could not be loaded", loadDetail: "Check the API Key, authorized domains and internet connection, then refresh the page.",
    helpTitle: "How to view a camera", steps: ["Pan or zoom to the area you want to inspect.", "Select a camera marker on the map.", "Select the camera image to enlarge it or view it fullscreen."], noticeTitle: "Note", notice: "Some cameras may be offline, stale or temporarily unsupported by the browser.", source: "Longdo Map API v3 documentation",
    viewerTitle: "CCTV camera image", viewerHint: "Press Esc or Close to return to the map.", viewerFullscreen: "Fullscreen", viewerExitFullscreen: "Exit fullscreen", viewerClose: "Close enlarged image", viewerAlt: "Selected CCTV camera image", viewerErrorTitle: "Camera image unavailable", viewerErrorDetail: "The camera may be offline or its source server may not be responding. Try another camera.", viewerImageTitle: "Select to enlarge camera image"
  }
};
const cameraElement = (id) => document.getElementById(id);

function applyCameraLanguage() {
  const copy = CAMERA_COPY[cameraState.language];
  document.documentElement.lang = cameraState.language;
  document.title = `${copy.title} — Smart Emergency Box`;
  document.querySelectorAll("[data-page-label]").forEach((link) => { link.textContent = copy[link.dataset.pageLabel]; });
  document.querySelector("[data-page-menu-label]").textContent = copy.more;
  cameraElement("cameraEyebrow").textContent = copy.eyebrow;
  cameraElement("cameraPageTitle").textContent = copy.title;
  cameraElement("cameraIntro").textContent = copy.intro;
  cameraElement("cameraToggleLabel").textContent = copy.camera;
  cameraElement("trafficToggleLabel").textContent = copy.traffic;
  cameraElement("eventsToggleLabel").textContent = copy.events;
  cameraElement("resetMapLabel").textContent = copy.reset;
  cameraElement("cameraSearchTitle").textContent = copy.searchTitle;
  cameraElement("cameraSearchHint").textContent = copy.searchHint;
  cameraElement("cameraSearchLabel").textContent = copy.searchLabel;
  cameraElement("cameraSearchInput").placeholder = copy.searchPlaceholder;
  cameraElement("cameraSearchButton").textContent = copy.searchButton;
  cameraElement("cameraSearchResultsTitle").textContent = copy.searchResults;
  cameraElement("cameraSearchClose").setAttribute("aria-label", copy.searchClose);
  cameraElement("cameraSearchClose").title = copy.searchClose;
  cameraElement("cameraHelpTitle").textContent = copy.helpTitle;
  cameraElement("cameraHelpSteps").innerHTML = copy.steps.map((step) => `<li>${step}</li>`).join("");
  cameraElement("cameraNoticeTitle").textContent = copy.noticeTitle;
  cameraElement("cameraNoticeText").textContent = copy.notice;
  cameraElement("cameraSourceLink").textContent = copy.source;
  cameraElement("cameraViewerTitle").textContent = copy.viewerTitle;
  cameraElement("cameraViewerHint").textContent = copy.viewerHint;
  cameraElement("cameraViewerFullscreenLabel").textContent = document.fullscreenElement ? copy.viewerExitFullscreen : copy.viewerFullscreen;
  cameraElement("cameraViewerClose").setAttribute("aria-label", copy.viewerClose);
  cameraElement("cameraViewerClose").title = copy.viewerClose;
  cameraElement("cameraViewerImage").alt = copy.viewerAlt;
  cameraElement("cameraViewerErrorTitle").textContent = copy.viewerErrorTitle;
  cameraElement("cameraViewerErrorDetail").textContent = copy.viewerErrorDetail;
  cameraElement("languageToggle").textContent = cameraState.language === "th" ? "EN" : "ไทย";
  cameraState.map?.Search.language(cameraState.language);
  const stateClass = cameraElement("cameraApiState").classList;
  cameraElement("cameraApiState").querySelector("span").textContent = stateClass.contains("ready") ? copy.ready : stateClass.contains("error") ? copy.error : copy.waiting;
}

function setCameraMessage(kind) {
  const copy = CAMERA_COPY[cameraState.language];
  const content = kind === "file" ? [copy.fileTitle, copy.fileDetail] : kind === "load" ? [copy.loadTitle, copy.loadDetail] : [copy.missingTitle, copy.missingDetail];
  cameraElement("cameraMessageTitle").textContent = content[0];
  cameraElement("cameraMessageDetail").textContent = content[1];
  cameraElement("cameraMapMessage").classList.remove("d-none");
  cameraElement("cameraApiState").className = "camera-api-state error";
  cameraElement("cameraApiState").querySelector("span").textContent = copy.error;
}

function setToolState(button, active) { button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); }

function setSearchOpen(open) {
  const popover = cameraElement("cameraSearchPopover");
  popover.hidden = !open;
  cameraElement("cameraSearchInput").setAttribute("aria-expanded", String(open));
}

function closeCameraSearch({ clearInput = false, restoreFocus = false } = {}) {
  setSearchOpen(false);
  cameraElement("cameraSearchResults").replaceChildren();
  if (clearInput) cameraElement("cameraSearchInput").value = "";
  if (restoreFocus) cameraElement("cameraSearchInput").focus();
}

function isCameraFeedImage(image) {
  if (!(image instanceof HTMLImageElement) || !image.closest("#cameraMap")) return false;
  const bounds = image.getBoundingClientRect();
  return bounds.width >= 180 && bounds.height >= 100;
}

function getCameraFeedTarget(target) {
  const element = target instanceof Element ? target : target?.parentElement;
  if (!element?.closest("#cameraMap")) return null;
  const link = element.closest("a[href]");
  const linkedSource = link?.href || "";
  const mediaSelector = "img, video, iframe[src], object[data], embed[src]";
  const mediaElement = element.closest(mediaSelector) || link?.querySelector(mediaSelector);
  const mediaSource = mediaElement?.currentSrc || mediaElement?.src || mediaElement?.data || "";
  const isRecognizedLink = linkedSource && CAMERA_FEED_URL_PATTERN.test(linkedSource);
  const isRecognizedMedia = mediaSource && CAMERA_FEED_URL_PATTERN.test(mediaSource);
  const isLargeImage = mediaElement instanceof HTMLImageElement && isCameraFeedImage(mediaElement);
  if (!isRecognizedLink && !isRecognizedMedia && !isLargeImage) return null;
  return { source: mediaSource || linkedSource, focusTarget: link || mediaElement, mediaElement: mediaElement || (isRecognizedLink ? link : null) };
}

function markCameraFeedImages(root = cameraElement("cameraMap")) {
  root.querySelectorAll("img").forEach((image) => {
    if (!isCameraFeedImage(image)) return;
    image.classList.add("expandable-camera-image");
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-label", CAMERA_COPY[cameraState.language].viewerImageTitle);
    image.title = CAMERA_COPY[cameraState.language].viewerImageTitle;
  });
  root.querySelectorAll("a[href]").forEach((link) => {
    if (!CAMERA_FEED_URL_PATTERN.test(link.href)) return;
    link.classList.add("expandable-camera-link");
    link.setAttribute("aria-label", CAMERA_COPY[cameraState.language].viewerImageTitle);
    link.title = CAMERA_COPY[cameraState.language].viewerImageTitle;
  });
}

function restoreCameraViewerMedia() {
  const media = cameraState.viewerMedia;
  const placeholder = cameraState.viewerMediaPlaceholder;
  if (media) {
    media.classList.remove("camera-viewer-live-media");
    if (placeholder?.isConnected) placeholder.replaceWith(media);
    else media.remove();
  }
  cameraElement("cameraViewerMediaHost").replaceChildren();
  cameraState.viewerMedia = null;
  cameraState.viewerMediaPlaceholder = null;
}

function openCameraViewer(source, focusTarget, mediaElement = null) {
  if (!source) return;
  cameraState.viewerFocus = focusTarget;
  cameraElement("cameraViewerError").hidden = true;
  restoreCameraViewerMedia();
  if (mediaElement?.parentNode) {
    const bounds = mediaElement.getBoundingClientRect();
    const placeholder = document.createElement("span");
    placeholder.className = "camera-feed-placeholder";
    placeholder.style.width = `${Math.max(bounds.width, 1)}px`;
    placeholder.style.height = `${Math.max(bounds.height, 1)}px`;
    mediaElement.parentNode.insertBefore(placeholder, mediaElement);
    cameraState.viewerMedia = mediaElement;
    cameraState.viewerMediaPlaceholder = placeholder;
    mediaElement.classList.add("camera-viewer-live-media");
    cameraElement("cameraViewerMediaHost").append(mediaElement);
    cameraElement("cameraViewerImage").hidden = true;
    cameraElement("cameraViewerImage").removeAttribute("src");
  } else {
    cameraElement("cameraViewerImage").hidden = false;
    cameraElement("cameraViewerImage").src = source;
  }
  cameraElement("cameraImageViewer").hidden = false;
  document.body.classList.add("camera-viewer-open");
  cameraElement("cameraViewerClose").focus();
}

async function closeCameraViewer() {
  if (document.fullscreenElement === cameraElement("cameraImageViewer")) await document.exitFullscreen().catch(() => {});
  cameraElement("cameraImageViewer").hidden = true;
  cameraElement("cameraViewerImage").removeAttribute("src");
  restoreCameraViewerMedia();
  document.body.classList.remove("camera-viewer-open");
  cameraState.viewerFocus?.focus?.();
  cameraState.viewerFocus = null;
}

function bindCameraViewer() {
  const mapElement = cameraElement("cameraMap");
  const viewer = cameraElement("cameraImageViewer");
  const openFromEvent = (event) => {
    const feed = getCameraFeedTarget(event.target);
    if (!feed) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openCameraViewer(feed.source, feed.focusTarget, feed.mediaElement);
  };
  mapElement.addEventListener("click", openFromEvent, true);
  mapElement.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && getCameraFeedTarget(event.target)) openFromEvent(event);
  }, true);
  new MutationObserver(() => window.requestAnimationFrame(() => markCameraFeedImages())).observe(mapElement, { childList: true, subtree: true });
  cameraElement("cameraViewerClose").addEventListener("click", closeCameraViewer);
  viewer.querySelector("[data-camera-viewer-close]").addEventListener("click", closeCameraViewer);
  cameraElement("cameraViewerImage").addEventListener("error", () => {
    cameraElement("cameraViewerImage").hidden = true;
    cameraElement("cameraViewerError").hidden = false;
  });
  cameraElement("cameraViewerFullscreen").addEventListener("click", async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewer.requestFullscreen();
  });
  document.addEventListener("fullscreenchange", applyCameraLanguage);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !viewer.hidden && !document.fullscreenElement) closeCameraViewer();
  });
}

function bindCameraControls() {
  cameraElement("languageToggle").addEventListener("click", () => { cameraState.language = cameraState.language === "th" ? "en" : "th"; localStorage.setItem(LONGDO_LANGUAGE_KEY, cameraState.language); applyCameraLanguage(); });
  cameraElement("toggleCameras").addEventListener("click", () => { if (!cameraState.map) return; cameraState.cameras = !cameraState.cameras; cameraState.map.Overlays[cameraState.cameras ? "load" : "unload"](longdo.Overlays.cameras); setToolState(cameraElement("toggleCameras"), cameraState.cameras); });
  cameraElement("toggleEvents").addEventListener("click", () => { if (!cameraState.map) return; cameraState.events = !cameraState.events; cameraState.map.Overlays[cameraState.events ? "load" : "unload"](longdo.Overlays.events); setToolState(cameraElement("toggleEvents"), cameraState.events); });
  cameraElement("toggleTraffic").addEventListener("click", () => { if (!cameraState.map) return; cameraState.traffic = !cameraState.traffic; cameraState.map.Layers[cameraState.traffic ? "add" : "remove"](longdo.Layers.TRAFFIC); setToolState(cameraElement("toggleTraffic"), cameraState.traffic); });
  cameraElement("resetCameraMap").addEventListener("click", () => { if (!cameraState.map) return; cameraState.map.location(CAMERA_CENTER, true); cameraState.map.zoom(10, true); });
  cameraElement("cameraSearchClose").addEventListener("click", () => closeCameraSearch({ restoreFocus: true }));
  cameraElement("cameraSearchInput").addEventListener("input", (event) => {
    if (!event.currentTarget.value.trim()) closeCameraSearch();
  });
  cameraElement("cameraSearchInput").addEventListener("search", (event) => {
    if (!event.currentTarget.value.trim()) closeCameraSearch();
  });
  cameraElement("cameraSearchInput").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCameraSearch({ restoreFocus: true });
    }
  });
  cameraElement("cameraSearchResults").addEventListener("click", () => {
    // Let Longdo handle the selected result first, then remove the result panel.
    window.setTimeout(() => closeCameraSearch(), 80);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!cameraElement("cameraSearchPopover").hidden && !cameraElement("cameraSearchForm").contains(event.target) && !cameraElement("cameraSearchPopover").contains(event.target)) closeCameraSearch();
  });
  cameraElement("cameraSearchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!cameraState.map) return;
    const query = cameraElement("cameraSearchInput").value.trim();
    if (!query) {
      cameraElement("cameraSearchResults").innerHTML = `<p class="camera-search-empty">${CAMERA_COPY[cameraState.language].searchEmpty}</p>`;
      setSearchOpen(true);
      cameraElement("cameraSearchInput").focus();
      return;
    }
    cameraElement("cameraSearchResults").innerHTML = `<p class="camera-search-loading">${CAMERA_COPY[cameraState.language].searching}</p>`;
    setSearchOpen(true);
    cameraState.map.Search.search(query, { limit: 10 });
  });
}

function initializeLongdoMap() {
  const copy = CAMERA_COPY[cameraState.language];
  try {
    cameraState.map = new longdo.Map({ placeholder: cameraElement("cameraMap"), location: CAMERA_CENTER, zoom: 10, lastView: false });
    cameraState.map.Overlays.load(longdo.Overlays.cameras);
    cameraState.map.Search.placeholder(cameraElement("cameraSearchResults"));
    cameraState.map.Search.language(cameraState.language);
    cameraElement("cameraSearchInput").setAttribute("aria-controls", "cameraSearchPopover");
    cameraElement("cameraSearchInput").setAttribute("aria-expanded", "false");
    cameraElement("cameraSearchInput").disabled = false;
    cameraElement("cameraSearchButton").disabled = false;
    cameraElement("cameraMapMessage").classList.add("d-none");
    cameraElement("cameraApiState").className = "camera-api-state ready";
    cameraElement("cameraApiState").querySelector("span").textContent = copy.ready;
  } catch (error) { console.error("Longdo Map initialization failed", error); setCameraMessage("load"); }
}

function loadLongdoLibrary() {
  if (location.protocol === "file:") { setCameraMessage("file"); return; }
  const key = window.SMART_BOX_LONGDO?.apiKey?.trim();
  if (!key || key === "YOUR_LONGDO_API_KEY") { setCameraMessage("missing"); return; }
  const script = document.createElement("script");
  script.src = `https://api.longdo.com/map3/?key=${encodeURIComponent(key)}`;
  script.async = true;
  script.onload = initializeLongdoMap;
  script.onerror = () => setCameraMessage("load");
  document.head.append(script);
}

document.addEventListener("DOMContentLoaded", () => { applyCameraLanguage(); bindCameraControls(); bindCameraViewer(); loadLongdoLibrary(); });
