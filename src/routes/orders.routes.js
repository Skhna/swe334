const express = require("express");
const router = express.Router();

const ordersController = require("../controller/orders.controller");
const { requireAuth } = require("../middlewares/auth");

// USER
router.post("/", requireAuth, ordersController.createFromCart);
router.get("/", requireAuth, ordersController.myOrders);
router.get("/:id", requireAuth, ordersController.myOrderDetail);
router.put("/:id/cancel", requireAuth, ordersController.cancelOrder);

module.exports = router;
