const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Comment = require('../models/Comment');

// Lokasi penyimpanan lokal sebagai fallback jika MongoDB Atlas offline / tidak tersambung
const dataDir = path.join(__dirname, '../data');
const localFilePath = path.join(dataDir, 'comments.json');

// Pastikan direktori data dan file comments.json tersedia
const ensureLocalFile = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(localFilePath)) {
    fs.writeFileSync(localFilePath, JSON.stringify([]), 'utf-8');
  }
};

const readLocalComments = () => {
  try {
    ensureLocalFile();
    const raw = fs.readFileSync(localFilePath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading local comments.json:', err);
    return [];
  }
};

const writeLocalComments = (comments) => {
  try {
    ensureLocalFile();
    fs.writeFileSync(localFilePath, JSON.stringify(comments, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local comments.json:', err);
  }
};

// Cek apakah koneksi MongoDB aktif
const isMongoConnected = () => mongoose.connection.readyState === 1;

// @desc    Get all public comments
// @route   GET /api/comments
// @access  Public
const getComments = async (req, res) => {
  try {
    if (isMongoConnected()) {
      const comments = await Comment.find().sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        count: comments.length,
        data: comments,
        source: 'mongodb',
      });
    } else {
      // Fallback lokal jika MongoDB belum tersambung
      const comments = readLocalComments();
      return res.status(200).json({
        success: true,
        count: comments.length,
        data: comments,
        source: 'local_storage',
      });
    }
  } catch (error) {
    console.warn('MongoDB query failed, falling back to local storage:', error.message);
    const comments = readLocalComments();
    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments,
      source: 'local_storage_fallback',
    });
  }
};

// @desc    Create a new comment
// @route   POST /api/comments
// @access  Public
const createComment = async (req, res) => {
  try {
    const { nama, role, pesan } = req.body;

    if (!nama || !pesan) {
      return res.status(400).json({
        success: false,
        message: 'Nama dan isi pesan komentar wajib diisi',
      });
    }

    const trimmedNama = nama.trim();
    const trimmedRole = role ? role.trim() : 'Pengunjung / Umum';
    const trimmedPesan = pesan.trim();

    let newComment = null;

    if (isMongoConnected()) {
      try {
        newComment = await Comment.create({
          nama: trimmedNama,
          role: trimmedRole,
          pesan: trimmedPesan,
        });
      } catch (dbErr) {
        console.warn('Gagal menyimpan ke MongoDB, mengalihkan ke local storage:', dbErr.message);
      }
    }

    // Jika MongoDB offline atau gagal, simpan ke file lokal JSON
    if (!newComment) {
      const localComments = readLocalComments();
      newComment = {
        _id: new mongoose.Types.ObjectId().toString(),
        nama: trimmedNama,
        role: trimmedRole,
        pesan: trimmedPesan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Simpan di paling atas (terbaru)
      localComments.unshift(newComment);
      writeLocalComments(localComments);
    } else {
      // Sinkronisasi salinan ke file lokal
      const localComments = readLocalComments();
      localComments.unshift(newComment.toObject ? newComment.toObject() : newComment);
      writeLocalComments(localComments);
    }

    res.status(201).json({
      success: true,
      message: 'Komentar berhasil dikirim!',
      data: newComment,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengirim komentar',
      error: error.message,
    });
  }
};

// @desc    Delete a comment (Admin only)
// @route   DELETE /api/comments/:id
// @access  Private/Admin
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMongoConnected()) {
      try {
        await Comment.findByIdAndDelete(id);
      } catch (dbErr) {
        console.warn('Gagal menghapus dari MongoDB:', dbErr.message);
      }
    }

    // Hapus juga dari penyimpanan lokal
    const localComments = readLocalComments();
    const filtered = localComments.filter((c) => String(c._id) !== String(id));
    writeLocalComments(filtered);

    res.status(200).json({
      success: true,
      message: 'Komentar berhasil dihapus',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus komentar',
      error: error.message,
    });
  }
};

module.exports = {
  getComments,
  createComment,
  deleteComment,
};
