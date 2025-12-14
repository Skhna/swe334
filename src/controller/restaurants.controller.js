const pool = require("../db");

// GET /api/restaurants?all=true (admin only for all=true)
exports.listRestaurants = async (req, res) => {
  try {
    const all = String(req.query.all || "").toLowerCase() === "true";

    if (all && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    const q = all
      ? `SELECT id, owner_user_id, name, description, address, phone, image_path,
                is_active, created_at, updated_at
         FROM restaurants
         ORDER BY id DESC`
      : `SELECT id, owner_user_id, name, description, address, phone, image_path,
                is_active, created_at, updated_at
         FROM restaurants
         WHERE is_active=true
         ORDER BY id DESC`;

    const r = await pool.query(q);
    return res.json(r.rows);
  } catch (err) {
    console.error("LIST RESTAURANTS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/restaurants (admin)
exports.createRestaurant = async (req, res) => {
  try {
    const { owner_user_id, name, description, address, phone, image_path } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    // owner_user_id optional (nullable)
    const ownerId = owner_user_id === undefined || owner_user_id === null || owner_user_id === ""
      ? null
      : Number(owner_user_id);

    if (ownerId !== null && Number.isNaN(ownerId)) {
      return res.status(400).json({ message: "owner_user_id must be a number or null" });
    }

    const r = await pool.query(
      `INSERT INTO restaurants (owner_user_id, name, description, address, phone, image_path)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, owner_user_id, name, description, address, phone, image_path,
                 is_active, created_at, updated_at`,
      [
        ownerId,
        String(name).trim(),
        description ?? null,
        address ?? null,
        phone ?? null,
        image_path ?? null,
      ]
    );

    return res.status(201).json(r.rows[0]);
  } catch (err) {
    // owner_user_id FK зөрчвөл
    if (err.code === "23503") {
      return res.status(400).json({ message: "owner_user_id not found in users" });
    }
    console.error("CREATE RESTAURANT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/restaurants/:id (admin)
exports.updateRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const { owner_user_id, name, description, address, phone, image_path, is_active } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (owner_user_id !== undefined) {
      const ownerId =
        owner_user_id === null || owner_user_id === "" ? null : Number(owner_user_id);
      if (ownerId !== null && Number.isNaN(ownerId)) {
        return res.status(400).json({ message: "owner_user_id must be a number or null" });
      }
      fields.push(`owner_user_id=$${idx++}`);
      values.push(ownerId);
    }

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: "name cannot be empty" });
      fields.push(`name=$${idx++}`);
      values.push(String(name).trim());
    }

    if (description !== undefined) {
      fields.push(`description=$${idx++}`);
      values.push(description ?? null);
    }

    if (address !== undefined) {
      fields.push(`address=$${idx++}`);
      values.push(address ?? null);
    }

    if (phone !== undefined) {
      fields.push(`phone=$${idx++}`);
      values.push(phone ?? null);
    }

    if (image_path !== undefined) {
      fields.push(`image_path=$${idx++}`);
      values.push(image_path ?? null);
    }

    if (is_active !== undefined) {
      fields.push(`is_active=$${idx++}`);
      values.push(Boolean(is_active));
    }

    if (fields.length === 0) return res.status(400).json({ message: "Nothing to update" });

    fields.push(`updated_at=now()`);

    values.push(id);

    const r = await pool.query(
      `UPDATE restaurants
       SET ${fields.join(", ")}
       WHERE id=$${idx}
       RETURNING id, owner_user_id, name, description, address, phone, image_path,
                 is_active, created_at, updated_at`,
      values
    );

    if (r.rows.length === 0) return res.status(404).json({ message: "Restaurant not found" });

    return res.json(r.rows[0]);
  } catch (err) {
    if (err.code === "23503") {
      return res.status(400).json({ message: "owner_user_id not found in users" });
    }
    console.error("UPDATE RESTAURANT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/restaurants/:id (admin) => soft delete
exports.deleteRestaurantSoft = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const r = await pool.query(
      `UPDATE restaurants
       SET is_active=false, updated_at=now()
       WHERE id=$1
       RETURNING id, owner_user_id, name, is_active, updated_at`,
      [id]
    );

    if (r.rows.length === 0) return res.status(404).json({ message: "Restaurant not found" });

    return res.json({ message: "Restaurant deactivated", restaurant: r.rows[0] });
  } catch (err) {
    console.error("DELETE RESTAURANT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
