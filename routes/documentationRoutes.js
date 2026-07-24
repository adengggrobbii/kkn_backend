const express = require('express');
const router = express.Router();
const {
  createDocumentation,
  getAllDocumentation,
  deleteDocumentation,
} = require('../controllers/documentationController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public route to view timeline/gallery
router.get('/', getAllDocumentation);

// Protected Admin Routes to manage gallery
router.post('/', protect, upload.single('foto'), createDocumentation);
router.delete('/:id', protect, deleteDocumentation);

module.exports = router;
