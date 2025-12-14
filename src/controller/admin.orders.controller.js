const pool = require("../db");

// 1. Бүх order
exports.getAllOrders = async (req, res) => {
  const q = `
    SELECT o.*, u.email
    FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `;
  const r = await pool.query(q);
  res.json(r.rows);
};
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = [
    "pending",
    "confirmed",
    "preparing",
    "on_the_way",
    "delivered",
    "cancelled"
  ];

  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const r = await pool.query(
    `UPDATE orders
     SET status=$1, updated_at=now()
     WHERE id=$2
     RETURNING *`,
    [status, id]
  );

  if (!r.rows.length) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.json({
    message: "Order status updated",
    order: r.rows[0]
  });
};
exports.getCancelledOrders = async (req, res) => {
  const r = await pool.query(
    "SELECT * FROM orders WHERE status='cancelled' ORDER BY updated_at DESC"
  );
  res.json(r.rows);
};
