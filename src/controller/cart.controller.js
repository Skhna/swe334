const pool = require("../db");

// user_id дээр cart байхгүй бол үүсгэнэ
async function getOrCreateCartId(userId) {
  const found = await pool.query("SELECT id FROM carts WHERE user_id=$1", [userId]);
  if (found.rows.length) return found.rows[0].id;

  const created = await pool.query(
    "INSERT INTO carts(user_id) VALUES($1) RETURNING id",
    [userId]
  );
  return created.rows[0].id;
}

exports.addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { menu_item_id, quantity } = req.body;

    const qty = parseInt(quantity ?? 1, 10);
    if (!menu_item_id) return res.status(400).json({ message: "menu_item_id required" });
    if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ message: "quantity must be > 0" });

    // menu item exists + available
    const m = await pool.query(
      "SELECT id, price, is_available FROM menu_items WHERE id=$1",
      [menu_item_id]
    );
    if (!m.rows.length) return res.status(404).json({ message: "Menu item not found" });
    if (!m.rows[0].is_available) return res.status(400).json({ message: "Menu item is not available" });

    const cartId = await getOrCreateCartId(userId);

    // cart_items unique(cart_id, menu_item_id) байгаа тул upsert
    const r = await pool.query(
      `
      INSERT INTO cart_items(cart_id, menu_item_id, quantity, unit_price)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (cart_id, menu_item_id)
      DO UPDATE SET
        quantity = cart_items.quantity + EXCLUDED.quantity,
        unit_price = EXCLUDED.unit_price,
        updated_at = now()
      RETURNING *
      `,
      [cartId, menu_item_id, qty, m.rows[0].price]
    );

    return res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("ADD TO CART ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.viewCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const c = await pool.query("SELECT id FROM carts WHERE user_id=$1", [userId]);
    if (!c.rows.length) return res.json({ cart_id: null, items: [], total_amount: 0 });

    const cartId = c.rows[0].id;

    const items = await pool.query(
      `
      SELECT
        ci.menu_item_id,
        ci.quantity,
        ci.unit_price,
        (ci.quantity * ci.unit_price) AS line_total,
        mi.name,
        mi.image_path,
        mi.restaurant_id,
        mi.category_id
      FROM cart_items ci
      JOIN menu_items mi ON mi.id = ci.menu_item_id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at DESC
      `,
      [cartId]
    );

    const total = items.rows.reduce((sum, x) => sum + Number(x.line_total), 0);

    return res.json({ cart_id: cartId, items: items.rows, total_amount: total });
  } catch (err) {
    console.error("VIEW CART ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateQty = async (req, res) => {
  try {
    const userId = req.user.id;
    const menuItemId = req.params.menuItemId;
    const { quantity } = req.body;

    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: "quantity must be > 0" });
    }

    const c = await pool.query("SELECT id FROM carts WHERE user_id=$1", [userId]);
    if (!c.rows.length) return res.status(404).json({ message: "Cart not found" });

    const cartId = c.rows[0].id;

    const r = await pool.query(
      `
      UPDATE cart_items
      SET quantity=$1, updated_at=now()
      WHERE cart_id=$2 AND menu_item_id=$3
      RETURNING *
      `,
      [qty, cartId, menuItemId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "Item not found in cart" });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error("UPDATE QTY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const menuItemId = req.params.menuItemId;

    const c = await pool.query("SELECT id FROM carts WHERE user_id=$1", [userId]);
    if (!c.rows.length) return res.status(404).json({ message: "Cart not found" });

    const cartId = c.rows[0].id;

    const r = await pool.query(
      "DELETE FROM cart_items WHERE cart_id=$1 AND menu_item_id=$2 RETURNING id",
      [cartId, menuItemId]
    );

    if (!r.rows.length) return res.status(404).json({ message: "Item not found in cart" });
    return res.json({ message: "Removed" });
  } catch (err) {
    console.error("REMOVE ITEM ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
