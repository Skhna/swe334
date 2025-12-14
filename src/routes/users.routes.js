const express = require("express");
const router = express.Router();
const { requireAuth: auth } = require("../middlewares/auth");
const requireRole = require("../middlewares/role");
const pool = require("../db");

// ✅ Admin л бүх user харна
router.get("/", auth, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, role, address, phone, is_email_verified, created_at
       FROM users
       ORDER BY id`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
