const express = require("express");
const router = express.Router();

const { requireAuth: auth } = require("../middlewares/auth");
const requireRole = require("../middlewares/role");

const r = require("../controller/restaurants.controller");

router.get("/", auth, r.listRestaurants); // list active (all=true зөвхөн admin)
router.post("/", auth, requireRole("admin"), r.createRestaurant);
router.put("/:id", auth, requireRole("admin"), r.updateRestaurant);
router.delete("/:id", auth, requireRole("admin"), r.deleteRestaurantSoft);

module.exports = router;
