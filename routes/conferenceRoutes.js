const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const { createConference, getAllConferences, updateConference, deleteConference, addSession, assignPaperToSession } = require('../controllers/conferenceController');

// Create Conference (Secretary only)
router.post(
    '/',
    authMiddleware,
    requireRole('Secretary'),
    createConference
);

// Get All Conferences (Authenticated users)
router.get(
    '/',
    authMiddleware,
    getAllConferences
);

// Update Conference (Secretary only)
router.put(
    '/:id',
    authMiddleware,
    requireRole('Secretary'),
    updateConference
);

// Delete Conference (Secretary only)
router.delete(
    '/:id',
    authMiddleware,
    requireRole('Secretary'),
    deleteConference
);

// Add a session to a conference (Secretary only)
router.post(
    '/:id/sessions',
    authMiddleware,
    requireRole('Secretary'),
    addSession
);

// Assign a paper to a session (Secretary only)
router.put(
    '/:id/sessions/:sessionId/papers',
    authMiddleware,
    requireRole('Secretary'),
    assignPaperToSession
);

module.exports = router;
