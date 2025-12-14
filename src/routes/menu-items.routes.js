const express = require("express");
const router = express.Router();

const { requireAuth: auth } = require("../middlewares/auth");
const requireRole = require("../middlewares/role"); // requireRole("admin") хэлбэрээр ажилладаг гэж үзлээ
const ctrl = require("../controller/menuItems.controller");

const { upload } = require("../services/upload"); // upload.js байршуулсан газартаа тааруул

// PUBLIC
router.get("/", ctrl.list);
router.get("/:id", ctrl.detail);

// ADMIN ONLY + upload
router.post("/", auth, requireRole("admin"), upload.single("image"), ctrl.create);
router.put("/:id", auth, requireRole("admin"), upload.single("image"), ctrl.update);
router.delete("/:id", auth, requireRole("admin"), ctrl.remove);

module.exports = router; // 🔥 ЭНЭ ЗААВАЛ
