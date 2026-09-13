const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    nama: {
      type: String,
      required: [true, 'Nama wajib diisi'],
      trim: true,
      maxlength: [80, 'Nama maksimal 80 karakter'],
    },
    role: {
      type: String,
      default: 'Pengunjung / Umum',
      trim: true,
    },
    pesan: {
      type: String,
      required: [true, 'Pesan atau komentar wajib diisi'],
      trim: true,
      maxlength: [1000, 'Pesan maksimal 1000 karakter'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Comment', commentSchema);
