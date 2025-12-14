// src/controller/payments.controller.js
const pool = require("../db");

// order_status enum-д чинь яг ямар утгууд байгаагаас хамаараад эднийг тааруулна
const ORDER_PAID_STATUS = process.env.ORDER_PAID_STATUS || "confirmed"; // ж: "paid" байж болно
const ORDER_CANCEL_STATUS = process.env.ORDER_CANCEL_STATUS || "cancelled"; // хэрэглэх бол

exports.getPaymentByOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    // order нь тухайн хэрэглэгчийнх мөн үү
    const o = await pool.query(
      "SELECT id, user_id, total_amount, status FROM orders WHERE id=$1",
      [orderId]
    );
    if (!o.rows.length) return res.status(404).json({ message: "Order not found" });
    if (Number(o.rows[0].user_id) !== Number(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const p = await pool.query(
      "SELECT * FROM payment WHERE order_id=$1",
      [orderId]
    );

    return res.json({
      order: o.rows[0],
      payment: p.rows[0] || null,
    });
  } catch (err) {
    console.error("GET PAYMENT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.payOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const orderId = Number(req.params.orderId);
    const { method } = req.body; // "CARD" эсвэл "COD"

    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }
    if (!method || !["CARD", "COD"].includes(method)) {
      return res.status(400).json({ message: "method must be CARD or COD" });
    }

    await client.query("BEGIN");

    // order lock (race condition-оос хамгаална)
    const o = await client.query(
      "SELECT id, user_id, total_amount, status FROM orders WHERE id=$1 FOR UPDATE",
      [orderId]
    );

    if (!o.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Order not found" });
    }
    if (Number(o.rows[0].user_id) !== Number(userId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Forbidden" });
    }

    // payment lock
    let p = await client.query(
      "SELECT * FROM payment WHERE order_id=$1 FOR UPDATE",
      [orderId]
    );

    // байхгүй бол pending payment үүсгэнэ
    if (!p.rows.length) {
      p = await client.query(
        `INSERT INTO payment(order_id, method, status, amount)
         VALUES ($1, $2, 'pending', $3)
         RETURNING *`,
        [orderId, method, o.rows[0].total_amount]
      );
    }

    const payment = p.rows[0];

    if (payment.status === "paid") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Already paid" });
    }

    // Төлөх үед amount-ыг order.total_amount-тай тааруулж шинэчилж болно
    const updatedPay = await client.query(
      `UPDATE payment
       SET status='paid', method=$1, amount=$2
       WHERE order_id=$3 AND status='pending'
       RETURNING *`,
      [method, o.rows[0].total_amount, orderId]
    );

    if (!updatedPay.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Payment is not payable" });
    }

    // order статус шинэчлэх (enum тохирох ёстой)
    const updatedOrder = await client.query(
      `UPDATE orders
       SET status=$1, updated_at=now()
       WHERE id=$2
       RETURNING *`,
      [ORDER_PAID_STATUS, orderId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Payment successful",
      order: updatedOrder.rows[0],
      payment: updatedPay.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");

    // enum value байхгүй үед энд унадаг (invalid input value for enum)
    console.error("PAY ORDER ERROR:", err);
    return res.status(500).json({
      message: "Server error",
      hint: "If this happened after updating order status, check your orders.status enum values.",
    });
  } finally {
    client.release();
  }
};
