const mongoose = require('mongoose');

const documentationSchema = new mongoose.Schema(
  {
    hariKe: {
      type: Number,
      required: [true, 'Hari ke-X wajib diisi'],
      min: [1, 'Hari ke-X minimal bernilai 1'],
    },
    tanggal: {
      type: Date,
      required: [true, 'Tanggal kegiatan wajib diisi'],
    },
    judul: {
      type: String,
      required: [true, 'Judul kegiatan wajib diisi'],
      trim: true,
    },
    deskripsi: {
      type: String,
      required: [true, 'Deskripsi kegiatan wajib diisi'],
    },
    foto: {
      type: String,
      required: [true, 'Foto dokumentasi wajib diunggah'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Documentation', documentationSchema);
