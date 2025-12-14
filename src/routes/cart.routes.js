const express = require("express");
const router = express.Router();

const cartController = require("../controller/cart.controller");
const { requireAuth } = require("../middlewares/auth");

// add to cart
router.post("/", requireAuth, cartController.addToCart);

// view cart
router.get("/", requireAuth, cartController.viewCart);

// update quantity
router.put("/:menuItemId", requireAuth, cartController.updateQty);

// remove item
router.delete("/:menuItemId", requireAuth, cartController.removeItem);

module.exports = router;
