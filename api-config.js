"use strict";

// Public frontend configuration only — never add database passwords/API secrets.
// When served from http://localhost/SmartEmergencyBox/index.html,
// "./api" points to http://localhost/SmartEmergencyBox/api/.
window.SMART_BOX_CONFIG = {
  baseUrl: "./api",
  deviceId: "seb-001",
  pollIntervalMs: 5000,
  timeoutMs: 8000,
  staleAfterMs: 30000,
  endpoints: {
    dashboard: "/dashboard.php",
    history: "/sensor-history.php",
    commands: "/commands.php",
    acknowledge: "/notifications-acknowledge.php"
  }
};
