const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const isMongoConnected = () => mongoose.connection.readyState === 1;

// ─────────────────────────────────────────────
// Helper: format tanggal ke string Indonesia
// ─────────────────────────────────────────────
const formatTanggalIndo = (date) => {
  return new Date(date).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ─────────────────────────────────────────────
// Helper: kelompokkan records berdasarkan tanggal
// ─────────────────────────────────────────────
const groupByDate = (records) => {
  const groups = {};
  // Urutkan dari tanggal terlama ke terbaru
  const sorted = [...records].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  sorted.forEach((record) => {
    const key = new Date(record.tanggal).toISOString().split('T')[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  });
  return groups;
};

// ─────────────────────────────────────────────
// Buat workbook Excel dengan pengelompokan per hari
// ─────────────────────────────────────────────
const createStyledWorkbook = (records) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Rekap Absen KKN');

  // Lebar kolom
  worksheet.columns = [
    { key: 'no',       width: 6  },
    { key: 'nim',      width: 22 },
    { key: 'nama',     width: 32 },
    { key: 'kelompok', width: 30 },
    { key: 'tanggal',  width: 22 },
    { key: 'status',   width: 18 },
  ];

  // ── Judul Laporan ─────────────────────────────
  worksheet.addRow([]); // baris 1 kosong
  const titleRow = worksheet.addRow(['REKAPITULASI KEHADIRAN MAHASISWA KKN DESA ULOK MUKTI']);
  worksheet.mergeCells('A2:F2');
  titleRow.getCell(1).font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF1E3A8A' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 32;

  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const subRow = worksheet.addRow([`Diunduh pada: ${dateStr}`]);
  worksheet.mergeCells('A3:F3');
  subRow.getCell(1).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  subRow.getCell(1).alignment = { horizontal: 'center' };
  subRow.height = 18;

  worksheet.addRow([]); // baris 4 kosong

  // ── Header Kolom ──────────────────────────────
  const headerRow = worksheet.addRow([
    'No', 'NIM', 'Nama Lengkap', 'Kelompok / Desa', 'Tanggal', 'Status Kehadiran',
  ]);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.font      = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border    = {
      top:    { style: 'medium', color: { argb: 'FF1E3A8A' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      left:   { style: 'thin',   color: { argb: 'FF93C5FD' } },
      right:  { style: 'thin',   color: { argb: 'FF93C5FD' } },
    };
  });

  // ── Data Dikelompokkan Per Hari ───────────────
  const groups = groupByDate(records);

  Object.keys(groups).forEach((dateKey) => {
    const dayRecords = groups[dateKey];
    const dayLabel   = formatTanggalIndo(dateKey);
    const hadirCount = dayRecords.filter(r => r.status === 'Hadir').length;
    const izinCount  = dayRecords.filter(r => r.status === 'Izin').length;
    const sakitCount = dayRecords.filter(r => r.status === 'Sakit').length;

    // Baris pemisah / header hari
    const dayRow = worksheet.addRow([
      `📅  ${dayLabel}`,
      '', '', '',
      `Hadir: ${hadirCount}  |  Izin: ${izinCount}  |  Sakit: ${sakitCount}`,
      `Total: ${dayRecords.length} mhs`,
    ]);
    worksheet.mergeCells(`A${dayRow.number}:D${dayRow.number}`);
    dayRow.height = 22;
    dayRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C8A' } };
      cell.font      = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'left' : 'center',
        indent: colNumber === 1 ? 1 : 0,
      };
    });

    // Baris data mahasiswa untuk hari ini
    dayRecords.forEach((record, idx) => {
      const formattedDate = new Date(record.tanggal).toLocaleDateString('id-ID', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });

      const row = worksheet.addRow([
        idx + 1,           // nomor urut reset tiap hari
        record.nim,
        record.nama,
        record.kelompok,
        formattedDate,
        record.status,
      ]);
      row.height = 22;

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'left',   vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left',   vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

      // Warna status
      const statusCell = row.getCell(6);
      if (record.status === 'Hadir') {
        statusCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } };
      } else if (record.status === 'Izin') {
        statusCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB45309' } };
      } else if (record.status === 'Sakit') {
        statusCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
      }

      // Zebra stripe + border
      const isEven = idx % 2 === 0;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber !== 6) {
          cell.font = { name: 'Arial', size: 10 };
        }
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
        }
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    // Baris kosong pemisah antar hari
    worksheet.addRow([]);
  });

  return workbook;
};

// ─────────────────────────────────────────────
// Update file Excel lokal di folder backend
// ─────────────────────────────────────────────
const updateLocalExcelFile = async () => {
  try {
    const allRecords = await Attendance.find({ kelompok: { $regex: 'Ulok Mukti', $options: 'i' } });
    const workbook   = createStyledWorkbook(allRecords);
    const filePath   = path.join(__dirname, '../rekap_absen_kkn.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`File Excel diperbarui: ${filePath}`);
  } catch (error) {
    console.error('Gagal memperbarui file Excel lokal:', error);
  }
};

// ─────────────────────────────────────────────
// @desc   Kirim absensi mahasiswa
// @route  POST /api/attendance
// @access Public
// ─────────────────────────────────────────────
const submitAttendance = async (req, res) => {
  try {
    const { nim, nama, kelompok, tanggal, status } = req.body;

    if (!nim || !nama || !kelompok) {
      return res.status(400).json({ success: false, message: 'NIM, Nama, dan Kelompok wajib diisi' });
    }

    const newAttendance = await Attendance.create({
      nim,
      nama,
      kelompok,
      tanggal: tanggal ? new Date(tanggal) : new Date(),
      status: status || 'Hadir',
      foto: '',
    });

    // Perbarui file Excel lokal secara otomatis
    await updateLocalExcelFile();

    res.status(201).json({
      success: true,
      message: 'Absensi berhasil dikirim!',
      data: newAttendance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

// ─────────────────────────────────────────────
// @desc   Ambil semua data absensi (dengan filter)
// @route  GET /api/attendance
// @access Private (Admin)
// ─────────────────────────────────────────────
const getAttendanceLogs = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const { search, kelompok, status, startDate, endDate } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { nama: { $regex: search, $options: 'i' } },
        { nim:  { $regex: search, $options: 'i' } },
      ];
    }
    if (kelompok) {
      query.kelompok = { $regex: kelompok, $options: 'i' };
    }
    if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      query.tanggal = {};
      if (startDate) query.tanggal.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.tanggal.$lte = end;
      }
    }

    const logs = await Attendance.find(query).sort({ tanggal: 1, createdAt: 1 });
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

// ─────────────────────────────────────────────
// @desc   Ekspor Excel untuk diunduh admin
// @route  GET /api/attendance/export
// @access Private (Admin)
// ─────────────────────────────────────────────
const exportAttendanceExcel = async (req, res) => {
  try {
    const allRecords = await Attendance.find({ kelompok: { $regex: 'Ulok Mukti', $options: 'i' } });
    const workbook   = createStyledWorkbook(allRecords);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=rekap_absen_kkn_${new Date().toISOString().split('T')[0]}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Gagal membuat file Excel: ' + error.message });
  }
};

// ─────────────────────────────────────────────
// @desc   Hapus satu data absensi
// @route  DELETE /api/attendance/:id
// @access Private (Admin)
// ─────────────────────────────────────────────
const deleteAttendanceLog = async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan' });
    }

    await record.deleteOne();

    // Perbarui file Excel lokal setelah penghapusan
    await updateLocalExcelFile();

    res.json({ success: true, message: 'Data absensi berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

module.exports = {
  submitAttendance,
  getAttendanceLogs,
  exportAttendanceExcel,
  deleteAttendanceLog,
};
