const Documentation = require('../models/Documentation');
const path = require('path');
const fs = require('fs');

// @desc    Create new documentation entry (Admin Only)
// @route   POST /api/documentation
// @access  Private (Admin Only)
const createDocumentation = async (req, res) => {
  try {
    const { hariKe, tanggal, judul, deskripsi } = req.body;

    if (!hariKe || !tanggal || !judul || !deskripsi) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Foto dokumentasi wajib diunggah' });
    }

    // Create file path
    const host = req.get('host');
    const protocol = req.protocol;
    const fotoPath = `${protocol}://${host}/uploads/${req.file.filename}`;

    const newDoc = await Documentation.create({
      hariKe: Number(hariKe),
      tanggal: new Date(tanggal),
      judul,
      deskripsi,
      foto: fotoPath,
    });

    res.status(201).json({
      success: true,
      message: 'Dokumentasi berhasil diunggah!',
      data: newDoc,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

// @desc    Get all documentation entries sorted by hariKe ascending
// @route   GET /api/documentation
// @access  Public
const getAllDocumentation = async (req, res) => {
  try {
    const docs = await Documentation.find({}).sort({ hariKe: 1 });
    res.json({ success: true, count: docs.length, data: docs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

// @desc    Delete a documentation entry
// @route   DELETE /api/documentation/:id
// @access  Private (Admin Only)
const deleteDocumentation = async (req, res) => {
  try {
    const doc = await Documentation.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Dokumentasi tidak ditemukan' });
    }

    // Delete image file from disk if it exists
    if (doc.foto) {
      const filename = doc.foto.split('/').pop();
      const filePath = path.join(__dirname, '../uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await doc.deleteOne();

    res.json({ success: true, message: 'Dokumentasi berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

module.exports = {
  createDocumentation,
  getAllDocumentation,
  deleteDocumentation,
};
