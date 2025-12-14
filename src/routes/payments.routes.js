// src/routes/payments.routes.js
const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middlewares/auth");
const payments = require("../controller/payments.controller");

// Payment харах (user өөрийн order дээрээ)
router.get("/:orderId", requireAuth, payments.getPaymentByOrder);

// Төлбөр төлөх (user өөрийн order дээрээ)
router.post("/:orderId/pay", requireAuth, payments.payOrder);

module.exports = router;
