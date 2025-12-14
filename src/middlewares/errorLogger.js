const pool = require("../db");

module.exports = (err, req, res, next) => {
  // Log error to database
  pool.query(
    `
    INSERT INTO logs (error_type, message, endpoint, user_id)
    VALUES ($1, $2, $3, $4)
    `,
    [
      err.name || "Error",
      err.message || "Unknown error",
      req.originalUrl,
      req.user ? req.user.id : null
    ]
  ).catch(logErr => {
    console.error("❌ Failed to save log:", logErr);
  });

  // Send error response
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error"
  });
};
