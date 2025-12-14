require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const restaurantsRoutes = require("./routes/restaurants.routes");
const categoriesRoutes = require("./routes/categories.routes");
const menuItemsRoutes = require("./routes/menu-items.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/orders.routes");
const paymentsRoutes = require("./routes/payments.routes");
const errorLogger = require("./middlewares/errorLogger");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/api/restaurants", restaurantsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/menu-items", menuItemsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/admin", require("./routes/admin.orders.routes"));
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

app.get("/", (req, res) => res.send("Food Delivery API running ✅"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler (must be last)
app.use(errorLogger);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
