const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Documentation = require('../models/Documentation');

const dataDir = path.join(__dirname, '../data');
const localDocsFile = path.join(dataDir, 'documentation.json');

const ensureLocalDocs = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(localDocsFile)) {
    fs.writeFileSync(localDocsFile, JSON.stringify([]), 'utf-8');
  }
};

const readLocalDocs = () => {
  try {
    ensureLocalDocs();
    const raw = fs.readFileSync(localDocsFile, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading local documentation.json:', err);
    return [];
  }
};

const writeLocalDocs = (docs) => {
  try {
    ensureLocalDocs();
    fs.writeFileSync(localDocsFile, JSON.stringify(docs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local documentation.json:', err);
  }
};

const isMongoConnected = () => mongoose.connection.readyState === 1;

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

    let newDoc = null;

    if (isMongoConnected()) {
      try {
        newDoc = await Documentation.create({
          hariKe: Number(hariKe),
          tanggal: new Date(tanggal),
          judul,
          deskripsi,
          foto: fotoPath,
        });
      } catch (dbErr) {
        console.warn('MongoDB create doc error, using local fallback:', dbErr.message);
      }
    }

    if (!newDoc) {
      const localDocs = readLocalDocs();
      newDoc = {
        _id: new mongoose.Types.ObjectId().toString(),
        hariKe: Number(hariKe),
        tanggal: new Date(tanggal).toISOString(),
        judul,
        deskripsi,
        foto: fotoPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localDocs.push(newDoc);
      // Sort by hariKe ascending
      localDocs.sort((a, b) => Number(a.hariKe) - Number(b.hariKe));
      writeLocalDocs(localDocs);
    } else {
      const localDocs = readLocalDocs();
      localDocs.push(newDoc.toObject ? newDoc.toObject() : newDoc);
      localDocs.sort((a, b) => Number(a.hariKe) - Number(b.hariKe));
      writeLocalDocs(localDocs);
    }

    res.status(201).json({
      success: true,
      message: 'Dokumentasi berhasil diunggah!',
      data: newDoc,
    });
  } catch (error) {
    console.error('Create documentation error:', error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

// @desc    Get all documentation entries sorted by hariKe ascending
// @route   GET /api/documentation
// @access  Public
const getAllDocumentation = async (req, res) => {
  try {
    if (isMongoConnected()) {
      try {
        const docs = await Documentation.find({}).sort({ hariKe: 1 });
        return res.json({ success: true, count: docs.length, data: docs });
      } catch (dbErr) {
        console.warn('MongoDB getAllDocumentation error:', dbErr.message);
      }
    }

    const localDocs = readLocalDocs();
    localDocs.sort((a, b) => Number(a.hariKe) - Number(b.hariKe));
    res.json({ success: true, count: localDocs.length, data: localDocs });
  } catch (error) {
    console.error('getAllDocumentation error:', error);
    const localDocs = readLocalDocs();
    res.json({ success: true, count: localDocs.length, data: localDocs });
  }
};

// @desc    Delete a documentation entry
// @route   DELETE /api/documentation/:id
// @access  Private (Admin Only)
const deleteDocumentation = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMongoConnected()) {
      try {
        const doc = await Documentation.findById(id);
        if (doc) {
          if (doc.foto) {
            const filename = doc.foto.split('/').pop();
            const filePath = path.join(__dirname, '../uploads', filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
          await doc.deleteOne();
        }
      } catch (dbErr) {
        console.warn('MongoDB deleteDoc error:', dbErr.message);
      }
    }

    // Hapus juga dari penyimpanan lokal
    const localDocs = readLocalDocs();
    const target = localDocs.find((d) => String(d._id) === String(id));
    if (target && target.foto) {
      const filename = target.foto.split('/').pop();
      const filePath = path.join(__dirname, '../uploads', filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
    const filtered = localDocs.filter((d) => String(d._id) !== String(id));
    writeLocalDocs(filtered);

    res.json({ success: true, message: 'Dokumentasi berhasil dihapus' });
  } catch (error) {
    console.error('deleteDocumentation error:', error);
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
};

module.exports = {
  createDocumentation,
  getAllDocumentation,
  deleteDocumentation,
};
