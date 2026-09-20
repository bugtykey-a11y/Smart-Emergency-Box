<?php
/**
 * dashboard.php
 *
 * API สำหรับส่งข้อมูลสถานะล่าสุดของ Smart Emergency Box ไปยังหน้า Dashboard
 * หน้าที่หลัก:
 * - รับ deviceId จาก query string
 * - อ่านข้อมูลล่าสุดของเซนเซอร์และอุปกรณ์จากฐานข้อมูล
 * - ส่งสถานะระบบ, alerts และ notifications ล่าสุดกลับในรูปแบบ JSON
 *
 * หน้าเว็บเรียกไฟล์นี้เป็นระยะ (ปัจจุบันทุก 5 วินาที) ผ่าน script.js
 */
