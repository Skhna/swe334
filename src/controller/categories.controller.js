const pool = require("../db");

exports.listCategories = async (req, res) => {
  try {
    const all = String(req.query.all || "").toLowerCase() === "true";

    if (all && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    const q = all
      ? `SELECT id, name, is_active, created_at, updated_at
         FROM category
         ORDER BY id DESC`
      : `SELECT id, name, is_active, created_at, updated_at
         FROM category
         WHERE is_active=true
         ORDER BY id DESC`;

    const r = await pool.query(q);
    return res.json(r.rows);
  } catch (err) {
    console.error("LIST CATEGORIES ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    const r = await pool.query(
      `INSERT INTO category (name)
       VALUES ($1)
       RETURNING id, name, is_active, created_at, updated_at`,
      [String(name).trim()]
    );

    return res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Category name already exists" });
    }
    console.error("CREATE CATEGORY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, is_active } = req.body;

    if (!id) return res.status(400).json({ message: "Invalid id" });

    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: "name cannot be empty" });
      fields.push(`name=$${idx++}`);
      values.push(String(name).trim());
    }

    if (is_active !== undefined) {
      fields.push(`is_active=$${idx++}`);
      values.push(Boolean(is_active));
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    fields.push(`updated_at=now()`);

    values.push(id);

    const r = await pool.query(
      `UPDATE category
       SET ${fields.join(", ")}
       WHERE id=$${idx}
       RETURNING id, name, is_active, created_at, updated_at`,
      values
    );

    if (r.rows.length === 0) return res.status(404).json({ message: "Category not found" });

    return res.json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Category name already exists" });
    }
    console.error("UPDATE CATEGORY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/categories/:id (admin) => soft delete
exports.deleteCategorySoft = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const r = await pool.query(
      `UPDATE category
       SET is_active=false, updated_at=now()
       WHERE id=$1
       RETURNING id, name, is_active, created_at, updated_at`,
      [id]
    );

    if (r.rows.length === 0) return res.status(404).json({ message: "Category not found" });

    return res.json({ message: "Category deactivated", category: r.rows[0] });
  } catch (err) {
    console.error("DELETE CATEGORY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
