<?php
/**
 * notifications-acknowledge.php
 *
 * API สำหรับทำเครื่องหมายว่า notification ถูกผู้ใช้อ่านหรือรับทราบแล้ว
 * หน้าที่หลัก:
 * - รับ deviceId และรายการ IDs ของ notification จาก HTTP POST
 * - ตรวจสอบว่า notification เหล่านั้นเป็นของอุปกรณ์ที่ระบุ
 * - อัปเดตข้อมูลในฐานข้อมูล เช่น is_read หรือ acknowledged_at
 * - ตอบผลการอัปเดตกลับในรูปแบบ JSON
 */
