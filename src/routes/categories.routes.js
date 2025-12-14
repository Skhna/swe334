const express = require("express");
const router = express.Router();

const { requireAuth: auth } = require("../middlewares/auth");
const requireRole = require("../middlewares/role"); // requireRole("admin")

const c = require("../controller/categories.controller");

router.get("/", auth, c.listCategories); // list active (all=true зөвхөн admin)
router.post("/", auth, requireRole("admin"), c.createCategory);
router.put("/:id", auth, requireRole("admin"), c.updateCategory);
router.delete("/:id", auth, requireRole("admin"), c.deleteCategorySoft);

module.exports = router;
