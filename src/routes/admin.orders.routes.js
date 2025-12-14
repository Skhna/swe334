const express = require("express");
const router = express.Router();

const ctrl = require("../controller/admin.orders.controller");
const { requireAuth } = require("../middlewares/auth");
const requireRole = require("../middlewares/role");

router.get("/orders", requireAuth, requireRole("admin"), ctrl.getAllOrders);
router.put("/orders/:id/status", requireAuth, requireRole("admin"), ctrl.updateOrderStatus);
router.get("/orders/cancelled", requireAuth, requireRole("admin"), ctrl.getCancelledOrders);

module.exports = router;
