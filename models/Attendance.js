const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    nim: {
      type: String,
      required: [true, 'NIM wajib diisi'],
      trim: true,
    },
    nama: {
      type: String,
      required: [true, 'Nama lengkap wajib diisi'],
      trim: true,
    },
    kelompok: {
      type: String,
      required: [true, 'Kelompok/Desa KKN wajib diisi'],
      trim: true,
    },
    tanggal: {
      type: Date,
      required: [true, 'Tanggal logbook wajib diisi'],
      default: Date.now,
    },
    status: {
      type: String,
      required: [true, 'Status kehadiran wajib diisi'],
      enum: ['Hadir', 'Izin', 'Sakit'],
      default: 'Hadir',
    },
    foto: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Attendance', attendanceSchema);
