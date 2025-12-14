const pool = require("../db");

function toImagePath(req) {
  // multer file байгаа үед DB-д "/uploads/xxx.png" хэлбэрээр хадгална
  if (!req.file) return null;
  return `/uploads/${req.file.filename}`;
}

exports.create = async (req, res) => {
  try {
    const { restaurant_id, category_id, name, description, price } = req.body;
    if (!restaurant_id || !category_id || !name || !price) {
      return res.status(400).json({ message: "restaurant_id, category_id, name, price are required" });
    }

    const image_path = toImagePath(req);

    const r = await pool.query(
      `INSERT INTO menu_items (restaurant_id, category_id, name, description, price, image_path, is_available)
       VALUES ($1,$2,$3,$4,$5,$6,true)
       RETURNING *`,
      [restaurant_id, category_id, name, description || null, price, image_path]
    );

    return res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("MENU CREATE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.list = async (req, res) => {
  try {
    // query filter optional: restaurant_id, category_id
    const { restaurant_id, category_id } = req.query;

    const where = ["mi.is_available=true"];
    const values = [];
    if (restaurant_id) { values.push(restaurant_id); where.push(`mi.restaurant_id=$${values.length}`); }
    if (category_id) { values.push(category_id); where.push(`mi.category_id=$${values.length}`); }

    const q = `
      SELECT mi.*, r.name AS restaurant_name, c.name AS category_name
      FROM menu_items mi
      JOIN restaurants r ON r.id=mi.restaurant_id
      JOIN category c ON c.id=mi.category_id
      WHERE ${where.join(" AND ")}
      ORDER BY mi.created_at DESC
    `;
    const r = await pool.query(q, values);
    return res.json(r.rows);
  } catch (err) {
    console.error("MENU LIST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.detail = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `SELECT mi.*, r.name AS restaurant_name, c.name AS category_name
       FROM menu_items mi
       JOIN restaurants r ON r.id=mi.restaurant_id
       JOIN category c ON c.id=mi.category_id
       WHERE mi.id=$1 AND mi.is_available=true`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "Menu item not found" });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error("MENU DETAIL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurant_id, category_id, name, description, price, is_available } = req.body;

    const existing = await pool.query("SELECT * FROM menu_items WHERE id=$1", [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: "Menu item not found" });

    const old = existing.rows[0];
    const image_path = req.file ? toImagePath(req) : old.image_path;

    const r = await pool.query(
      `UPDATE menu_items
       SET restaurant_id=$1,
           category_id=$2,
           name=$3,
           description=$4,
           price=$5,
           image_path=$6,
           is_available=$7,
           updated_at=now()
       WHERE id=$8
       RETURNING *`,
      [
        restaurant_id ?? old.restaurant_id,
        category_id ?? old.category_id,
        name ?? old.name,
        description ?? old.description,
        price ?? old.price,
        image_path,
        is_available ?? old.is_available,
        id,
      ]
    );

    return res.json(r.rows[0]);
  } catch (err) {
    console.error("MENU UPDATE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    // soft delete
    const r = await pool.query(
      `UPDATE menu_items SET is_available=false, updated_at=now()
       WHERE id=$1
       RETURNING id`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: "Menu item not found" });

    return res.json({ message: "Deleted (soft)", id: r.rows[0].id });
  } catch (err) {
    console.error("MENU DELETE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
