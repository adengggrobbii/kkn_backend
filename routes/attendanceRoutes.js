const express = require('express');
const router = express.Router();
const {
  submitAttendance,
  getAttendanceLogs,
  exportAttendanceExcel,
  deleteAttendanceLog,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public route to submit attendance/logbook + upload single image proof
router.post('/', upload.single('foto'), submitAttendance);

// Protected Admin Routes
router.get('/', protect, getAttendanceLogs);
router.get('/export', protect, exportAttendanceExcel);
router.delete('/:id', protect, deleteAttendanceLog);

module.exports = router;
