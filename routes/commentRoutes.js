const express = require('express');
const router = express.Router();
const {
  getComments,
  createComment,
  deleteComment,
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

// Public routes: view comments and submit comments
router.get('/', getComments);
router.post('/', createComment);

// Protected Admin route: delete comment
router.delete('/:id', protect, deleteComment);

module.exports = router;
