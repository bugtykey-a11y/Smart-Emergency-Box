# Smart Emergency Box — คู่มือเชื่อมหน้าบ้านกับหลังบ้าน

เอกสารนี้เป็น **API contract ที่เสนอไว้รอทีมหลังบ้านยืนยัน** ไม่ใช่โครงสร้างตารางจริง
หน้าบ้านไม่เชื่อม MySQL/MariaDB โดยตรง และไม่มี PHP/SQL/MQTT Broker ในชุดนี้
Backend ต้องอ่านฐานข้อมูล รับสถานะ ESP32 และส่งคำสั่งไปอุปกรณ์เอง

## เริ่มใช้งานบน XAMPP

1. วาง index.html, style.css, script.js, api-config.js ในโฟลเดอร์
   เช่น C:\xampp\htdocs\SmartEmergencyBox
2. เปิด Apache แล้วเข้า http://localhost/SmartEmergencyBox/
3. ให้ทีมหลังบ้านสร้าง endpoints ตามตารางด้านล่าง หรือแก้ชื่อใน api-config.js
4. ตั้ง deviceId ให้ตรงกับอุปกรณ์จริง และ baseUrl ให้ตรงกับ API
5. เมื่อยังไม่มี API หน้าเว็บจะแสดงรอข้อมูล/เชื่อมต่อไม่ได้ ไม่สร้างค่าทดแทน

ห้ามเปิดด้วย file:// สำหรับการเชื่อม API ควรให้ frontend และ backend อยู่ origin เดียวกัน
ถ้าใช้เครื่องคนละเครื่อง ให้ใช้ IP/hostname ของเครื่อง server ไม่ใช่ localhost ของมือถือ
ถ้าต้องใช้คนละ origin ต้องจัดการ CORS และ authentication ใน backend ให้เหมาะสม
โค้ดปัจจุบันใช้ session cookies แบบ same-origin ไม่ได้เตรียมการล็อกอินไว้ให้

## ไฟล์ที่ต้องปรับเมื่อหลังบ้านพร้อม

- api-config.js: baseUrl, deviceId, endpoints, pollIntervalMs, timeoutMs, staleAfterMs
- script.js / normalizeDashboard(): จับคู่ชื่อ field ถ้ารูปแบบ JSON ของเพื่อนแตกต่าง
- script.js / fetchSensorHistory(): จับคู่รูปแบบข้อมูลกราฟ

ไม่มีรหัสผ่านฐานข้อมูล, API secret หรือ MQTT password ใน frontend
ค่า threshold และสถานะจริงมาจาก backend/ESP32 ไม่ได้ตัดสินใจที่ browser

## Endpoints ที่เสนอ

ทุก endpoint รับ query deviceId รวมถึง POST; POST body มี deviceId ด้วย ต้องตรวจว่าตรงกัน

| Method | Path ใต้ baseUrl | หน้าที่ |
|---|---|---|
| GET | /dashboard.php?deviceId=seb-001 | snapshot, hardware, alerts, notifications |
| GET | /sensor-history.php?deviceId=seb-001&range=1h | ข้อมูลกราฟจากฐานข้อมูล |
| POST | /commands.php?deviceId=seb-001 | ขอส่งคำสั่งให้ ESP32 |
| POST | /notifications-acknowledge.php?deviceId=seb-001 | ทำเครื่องหมาย notification ว่าอ่านแล้ว |

GET ถูกเรียกทุก 5 วินาทีสำหรับ dashboard แบบไม่ซ้อน request
กราฟโหลดเมื่อเปิดหน้า เปลี่ยนช่วงเวลา หรือกด Refresh connection เท่านั้น
range รองรับ 1h, 6h, 24h, 7d; backend ควร aggregate/จำกัดจำนวน points ให้เหมาะสม
alert history แสดงล่าสุดไม่เกิน 30 รายการ; notifications แสดงล่าสุดไม่เกิน 12 รายการ
ให้ backend เรียง alerts/notifications ใหม่สุดก่อน

ทุก response ต้องเป็น JSON พร้อม Content-Type: application/json และ envelope:

```json
{ "success": true, "data": {} }
```

เมื่อผิดพลาด ใช้ HTTP status ที่เหมาะสม (400/401/403/409/500 เป็นต้น):

```json
{ "success": false, "error": { "code": "UNSAFE_TO_RESET", "message": "Reset blocked: danger is still active." } }
```

ห้ามส่ง PHP warning/HTML ปนใน JSON และห้ามใช้ HTTP 200 กับข้อความ success
ทั้งที่คำสั่งถูกปฏิเสธ

## GET dashboard — รูปแบบ data

ตัวอย่างต่อไปนี้เป็นคำอธิบาย contract เท่านั้น ไม่ได้ถูกโหลดเป็นข้อมูลจำลองในหน้าเว็บ
timestamp ในระบบจริงต้องเปลี่ยนเป็นเวลาที่ ESP32 ส่งข้อมูลล่าสุด

```json
{
  "success": true,
  "data": {
    "deviceId": "seb-001",
    "updatedAt": "2026-09-17T03:20:00Z",
    "deviceOnline": true,
    "systemStatus": "NORMAL",
    "gasDetectionEnabled": true,
    "buzzerActive": false,
    "alarmSilenced": false,
    "uptimePercent": null,
    "gasScale": { "warning": 2000, "emergency": 3500, "max": 5000 },
    "sensors": {
      "temperature": { "value": 28.5, "status": "NORMAL" },
      "humidity": { "value": 65, "status": "NORMAL" },
      "gas": { "value": 1800, "status": "NORMAL" },
      "water": { "detected": false }
    },
    "devices": [
      { "id": "esp32", "status": "Online" },
      { "id": "dht22", "status": "Working" },
      { "id": "mq2", "status": "Working" },
      { "id": "water", "status": "Working" },
      { "id": "oled", "status": "Working" },
      { "id": "buzzer", "status": "Standby" }
    ],
    "alerts": [],
    "notifications": []
  }
}
```

ข้อกำหนด:

- Boolean ต้องเป็น true/false จริง ไม่ใช่ "true"/"false", 0/1 หรือ "0"/"1"
  PHP ควร cast ประเภทข้อมูลก่อน json_encode
- ค่าตัวเลขต้องเป็น number ไม่ใช่ string; humidity อยู่ระหว่าง 0–100, gas ไม่ติดลบ
- Sensor อ่านไม่ได้ให้ value: null, status: "UNKNOWN"; water ให้ detected: null
- Sensor status: NORMAL / WARNING / EMERGENCY / UNKNOWN
- systemStatus: NORMAL / WARNING / EMERGENCY / OFFLINE (เป็นสถานะที่ backend/ESP32 ยืนยัน)
- hardware status: Online / Working / Disabled / Offline / Error / Standby / Active / Silenced / Unknown
- buzzerActive และ alarmSilenced ห้ามเป็น true พร้อมกัน
- gasScale ต้อง 0 < warning < emergency < max และเป็นค่าจริงที่อุปกรณ์ใช้
- หน้าบ้านแสดงแก๊สเป็น ppm; ถ้า ESP32 ส่งค่า ADC ดิบ ต้องเปลี่ยนหน่วย/scale ใน UI
  อย่าติดป้าย ppm ให้ค่า ADC ที่ยังไม่ผ่านการแปลง/สอบเทียบ
- updatedAt ต้องเป็น ISO 8601 พร้อม timezone (Z หรือ +07:00)
  และเป็นเวลาของ telemetry ล่าสุด **ไม่ใช่เวลาที่เรียก API**
- เมื่อ telemetry เก่ากว่า staleAfterMs (เริ่มต้น 30 วินาที) หรือ API ล้มเหลว
  จะแสดง UNKNOWN/ไม่แสดงค่าปัจจุบัน และปิด controls
- เวลาเครื่อง ESP32/backend/client ควรตรงกัน; เวลาที่อยู่ในอนาคตเกิน 5 วินาทีจะไม่ถือว่า fresh
- backend ต้องตรวจ heartbeat/LWT และคืน deviceOnline: false เมื่อ ESP32 หลุด
  แม้ฐานข้อมูลยังมีแถวล่าสุดอยู่ ห้ามอนุมาน Online จากการมีข้อมูลใน DB
- uptimePercent เป็น number 0–100 หรือ null; ถ้ายังไม่ได้คำนวณจริงให้ null
- ฟิลด์ devices, alerts, notifications ต้องมีเสมอ ถ้าไม่มีให้ []

alert หนึ่งรายการ:

```json
{
  "id": "alert-123",
  "createdAt": "2026-09-17T03:20:00Z",
  "event": "High gas level",
  "type": "EMERGENCY",
  "status": "Active"
}
```

type: INFO / WARNING / EMERGENCY; status: Active / Acknowledged / Resolved

notification หนึ่งรายการ:

```json
{
  "id": "notification-123",
  "createdAt": "2026-09-17T03:20:00Z",
  "message": "Dangerous gas level detected.",
  "type": "EMERGENCY",
  "read": false
}
```

## GET sensor-history — รูปแบบ data

```json
{
  "success": true,
  "data": {
    "points": [
      {
        "recordedAt": "2026-09-17T03:20:00Z",
        "temperature": 28.5,
        "humidity": 65,
        "gas": 1800
      }
    ]
  }
}
```

คืน points: [] เมื่อไม่มีข้อมูล ไม่สร้างค่าศูนย์หรือสุ่มค่าแทน
แต่ละค่าที่ขาดหายให้ null เพื่อให้กราฟเว้นช่องว่าง
recordedAt ต้องเป็น ISO 8601 พร้อม timezone

## POST commands — รูปแบบ body

```json
{
  "deviceId": "seb-001",
  "command": "SET_GAS_DETECTION",
  "parameters": { "enabled": false },
  "requestId": "unique-request-id"
}
```

| command | parameters | เงื่อนไขที่ backend/ESP32 ต้องบังคับ |
|---|---|---|
| EMERGENCY | {} | เปิด emergency mode และ Buzzer |
| SILENCE_ALARM | {} | ปิดเฉพาะ Buzzer ไม่ปิด Sensor/ไม่ Reset |
| RESET_ALERT | {} | อนุญาตเมื่อ Sensor ทุกตัวปลอดภัยเท่านั้น |
| SET_GAS_DETECTION | { "enabled": true/false } | เปลี่ยนเฉพาะการตรวจแก๊ส Sensor อื่นยังทำงาน |

HTTP 202 หรือ 200 เมื่อรับคำสั่งเข้าคิว:

```json
{ "success": true, "data": { "commandId": "cmd-123", "status": "accepted" } }
```

accepted หมายถึง backend รับคำสั่งแล้ว **ไม่ใช่ ESP32 ทำงานสำเร็จ**
UI ไม่เปลี่ยน Buzzer/Sensor และไม่เพิ่ม alert history เองจากการกดปุ่ม
สถานะบน Dashboard จะเปลี่ยนเมื่อ GET dashboard คืนสถานะที่อุปกรณ์รายงานจริง
Backend ควรบันทึกคำสั่ง, device acknowledgment, สถานะ failed/expired และ alert ลง DB
ถ้ายังรอ ESP32 ให้แสดงเป็น event/notification ได้ แต่ห้ามปลอมสถานะอุปกรณ์

Idempotency-Key header มีค่าเดียวกับ requestId ใน body
Backend ต้อง deduplicate ID เดิม, ส่งผลเดิมกลับ, ตรวจสิทธิ์อุปกรณ์,
กำหนด TTL ของคำสั่ง และไม่ replay คำสั่งเก่าหลัง ESP32 reconnect
หาก timeout หน้าบ้านไม่ส่ง POST ซ้ำอัตโนมัติ เพราะอาจรับคำสั่งไปแล้ว
ถ้าไม่ส่งผ่าน backend ไป ESP32 จริง ให้ปฏิเสธคำสั่ง อย่าตอบ accepted ลอย ๆ

## POST notifications-acknowledge — รูปแบบ body

```json
{ "deviceId": "seb-001", "ids": ["notification-123"] }
```

response: { "success": true, "data": {} }
ทำเครื่องหมาย read: true เท่านั้น ไม่ลบ alert ไม่เปลี่ยนสถานะฉุกเฉิน
ควร idempotent เพื่อให้รับ ID ที่อ่านแล้วซ้ำได้

## สิ่งที่ต้องอยู่ฝั่งหลังบ้าน/ESP32

- DB connection, SQL prepared statements, validation, permission checks และ audit log
- คำสั่งฉุกเฉินต้องผ่าน authentication/authorization และ CSRF protection
  apiRequest() รองรับ X-CSRF-Token จาก meta[name="csrf-token"] ที่ backend render
  ไม่มี token/authentication implementation ในชุด frontend นี้
- ห้ามถือว่า Confirmation Modal เป็นกลไกความปลอดภัยฝั่ง server
- ESP32 ต้องตรวจอันตรายและเปิด Buzzer เองได้แม้เครือข่ายล่ม
- เมื่อ Silence แล้วอันตรายยังอยู่ การ re-arm ต้องจัดการที่ ESP32/backend
- ปิด Gas Detection ต้องหยุดประมวลผล/alert แก๊สจริงที่ ESP32/backend
  ไม่ใช่แค่ซ่อน Card บนเว็บ
- Reset ต้องปฏิเสธเมื่อแก๊สยัง WARNING/EMERGENCY, พบน้ำ,
  Sensor อื่นผิดปกติ/อ่านไม่ได้ หรือข้อมูลไม่สด ไม่ใช่เชื่อการตรวจใน browser
- XAMPP ในเครื่องใช้พัฒนา/สาธิตเท่านั้น ต้องจัดการ HTTPS, secrets และ auth ก่อนใช้งานจริง

## รายการตรวจเมื่อ API พร้อม

1. ค่า Sensor, hardware, timestamp และกราฟตรงกับฐานข้อมูล/ESP32
2. Gas WARNING ไม่เปิดเสียงเอง, Gas EMERGENCY เปิดเสียงที่อุปกรณ์จริง
3. Silence เปลี่ยนเสียงจริง แต่ Sensor/status ยังทำงาน
4. Reset ขณะยังมีอันตรายถูก backend ปฏิเสธ และหน้าเว็บไม่เปลี่ยนสถานะหลอก
5. ปิด Gas Detection จริงแล้ว Water/Temperature/Humidity ยังทำงาน
6. แยก API ล่ม, ESP32 Offline และ telemetry เก่าได้โดยไม่แสดง NORMAL
7. double-click ไม่ส่งซ้อน, backend deduplicate requestId ได้
8. notification read และ alert history เปลี่ยนจาก DB ไม่ใช่หน่วยความจำในหน้าเว็บ
