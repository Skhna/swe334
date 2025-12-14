const pool = require("../db");

exports.createFromCart = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { delivery_address, notes, phone } = req.body;

    if (!delivery_address) {
      return res.status(400).json({ message: "delivery_address required" });
    }

    // orders table дээр phone column байхгүй байгаа (танай screenshot-д)
    // Тиймээс 2 сонголт:
    // A) notes дотор phone-г хавсаргах
    const finalNotes = phone ? `${notes ? notes + " | " : ""}phone:${phone}` : (notes || null);

    await client.query("BEGIN");

    const cart = await client.query("SELECT id FROM carts WHERE user_id=$1", [userId]);
    if (!cart.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cart is empty" });
    }
    const cartId = cart.rows[0].id;

    const items = await client.query(
      `
      SELECT
        ci.menu_item_id,
        ci.quantity,
        ci.unit_price,
        (ci.quantity * ci.unit_price) AS line_total,
        mi.name AS item_name_snapshot,
        mi.restaurant_id,
        mi.is_available
      FROM cart_items ci
      JOIN menu_items mi ON mi.id = ci.menu_item_id
      WHERE ci.cart_id = $1
      `,
      [cartId]
    );

    if (items.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cart is empty" });
    }

    // available шалгана
    const notAvail = items.rows.find(x => !x.is_available);
    if (notAvail) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Some items are not available" });
    }

    // orders.restaurant_id NOT NULL тул: cart дахь бүх item нэг restaurant байх ёстой
    const restaurantIds = [...new Set(items.rows.map(x => String(x.restaurant_id)))];
    if (restaurantIds.length !== 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cart must contain items from one restaurant only" });
    }
    const restaurantId = items.rows[0].restaurant_id;

    const totalAmount = items.rows.reduce((sum, x) => sum + Number(x.line_total), 0);

    const order = await client.query(
      `
      INSERT INTO orders(user_id, restaurant_id, delivery_address, notes, total_amount)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [userId, restaurantId, delivery_address, finalNotes, totalAmount]
    );

    const orderId = order.rows[0].id;

    // order_items insert (snapshot, line_total)
    for (const it of items.rows) {
      await client.query(
        `
        INSERT INTO order_items(order_id, menu_item_id, item_name_snapshot, unit_price, quantity, line_total)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          orderId,
          it.menu_item_id,
          it.item_name_snapshot,
          it.unit_price,
          it.quantity,
          it.line_total,
        ]
      );
    }

    // cart clear
    await client.query("DELETE FROM cart_items WHERE cart_id=$1", [cartId]);

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Order created",
      order: order.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE ORDER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

// 🟢 User өөрийн бүх захиалга
exports.myOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const r = await pool.query(
      `SELECT *
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("MY ORDERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 🟢 Order detail + items
exports.myOrderDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const o = await pool.query(
      `SELECT *
       FROM orders
       WHERE id=$1 AND user_id=$2`,
      [orderId, userId]
    );
    if (!o.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const items = await pool.query(
      `SELECT *
       FROM order_items
       WHERE order_id=$1`,
      [orderId]
    );

    res.json({
      order: o.rows[0],
      items: items.rows
    });
  } catch (err) {
    console.error("ORDER DETAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 🟢 Cancel order (only if pending)
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const o = await pool.query(
      `SELECT * FROM orders WHERE id=$1 AND user_id=$2`,
      [orderId, userId]
    );

    if (!o.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = o.rows[0];

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    if (order.status === "paid" || order.status === "confirmed") {
      return res.status(400).json({ message: "Cannot cancel a paid order" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ message: `Cannot cancel order with status: ${order.status}` });
    }

    const updated = await pool.query(
      `UPDATE orders SET status='cancelled' WHERE id=$1 RETURNING *`,
      [orderId]
    );

    res.json({ message: "Order cancelled", order: updated.rows[0] });
  } catch (err) {
    console.error("CANCEL ORDER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

