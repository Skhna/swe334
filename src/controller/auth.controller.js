const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const crypto = require("crypto");
const { sendOTPEmail } = require("../services/mailer");

// JWT config (safe fallback)
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function isValidEmail(email) {
  return typeof email === "string" && /\S+@\S+\.\S+/.test(email);
}

exports.register = async (req, res) => {
  try {
    const { username, email, password, address, phone } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "username, email, password are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check existing email
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (username, email, password_hash, role, address, phone)
      VALUES ($1, $2, $3, 'user', $4, $5)
      RETURNING id, username, email, role, address, phone, is_email_verified
      `,
      [username, email, password_hash, address ?? null, phone ?? null]
    );

    const user = result.rows[0];

    // ✅ Standard: register дээр token БУЦААХГҮЙ
    return res.status(201).json({ user });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const result = await pool.query(
      `
      SELECT id, email, password_hash, role
      FROM users
      WHERE email=$1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // ✅ ЗӨВХӨН TOKEN
    const token = signToken(user);

    return res.json({ token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
  
};

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digit
}

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required" });

    // user байгаа эсэх (security: байхгүй ч OK буцааж болно)
    const u = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (u.rows.length === 0) {
      return res.json({ message: "If the email exists, OTP has been sent" });
    }

    // өмнөх reset_password OTP-г used болгоё (optional)
    await pool.query(
      `UPDATE otps SET used=true
       WHERE email=$1 AND purpose='reset_password' AND used=false`,
      [email]
    );

    const otp = generateOTP();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // ✅ table чинь (email, code, purpose, expires_at, used, created_at)
    await pool.query(
      `INSERT INTO otps (email, code, purpose, expires_at, used)
       VALUES ($1, $2, 'reset_password', $3, false)`,
      [email, otp, expires_at]
    );

    await sendOTPEmail(email, otp); // nodemailer

    return res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    const r = await pool.query(
      `SELECT id, code, expires_at, used
       FROM otps
       WHERE email=$1 AND purpose='reset_password'
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (r.rows.length === 0) return res.status(400).json({ message: "OTP not found" });

    const row = r.rows[0];

    if (row.used) return res.status(400).json({ message: "OTP already used" });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: "OTP expired" });

    if (String(otp) !== String(row.code)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // нэг ашиглаад дуусдаг болгоё
    await pool.query(`UPDATE otps SET used=true WHERE id=$1`, [row.id]);

    return res.json({ message: "OTP verified" });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "email, otp, newPassword are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // 1) хамгийн сүүлийн OTP-г авна
    const r = await pool.query(
      `SELECT id, code, expires_at, used
       FROM otps
       WHERE email=$1 AND purpose='reset_password'
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (r.rows.length === 0) return res.status(400).json({ message: "OTP not found" });

    const row = r.rows[0];

    if (row.used) return res.status(400).json({ message: "OTP already used" });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: "OTP expired" });

    // 2) OTP таарч байгаа эсэх
    if (String(row.code) !== String(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // 3) хэрэглэгч байгаа эсэх (email-аар)
    const u = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (u.rows.length === 0) return res.status(404).json({ message: "User not found" });

    // 4) password update
    const newHash = await bcrypt.hash(String(newPassword), 10);
    await pool.query("UPDATE users SET password_hash=$1 WHERE email=$2", [newHash, email]);

    // 5) OTP used болгох
    await pool.query("UPDATE otps SET used=true WHERE id=$1", [row.id]);

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


