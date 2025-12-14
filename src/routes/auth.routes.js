const express = require("express");
const router = express.Router();
const authController = require("../controller/auth.controller");
const { requireAuth: auth } = require("../middlewares/auth");

router.get("/ping", (req, res) => res.json({ ok: true }));
router.get("/me", auth, (req, res) => res.json({ ok: true, user: req.user }));

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-otp", authController.verifyOtp);
router.post("/reset-password", authController.resetPassword);

module.exports = router;
