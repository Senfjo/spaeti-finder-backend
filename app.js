// ℹ️ Gets access to environment variables/settings
// https://www.npmjs.com/package/dotenv
require("dotenv").config();

// ℹ️ Connects to the database
require("./db");

// Handles http requests (express is node js framework)
// https://www.npmjs.com/package/express
const express = require("express");

const app = express();

const { isAuthenticated } = require("./middleware/jwt.middleware");

// ℹ️ This function is getting exported from the config folder. It runs most pieces of middleware
require("./config")(app);

// 👇 Start handling routes here
const indexRoutes = require("./routes/index.routes");
const usersRoutes = require("./routes/users.routes");
const spaetisRoutes = require("./routes/spaetis.routes");
const ratingsRoutes = require("./routes/ratings.routes");
const authRoutes = require("./routes/auth.routes");
const ticketRoutes = require("./routes/ticket.routes")

app.use("/api", indexRoutes);
app.use("/users", usersRoutes);
app.use("/spaetis", spaetisRoutes);
app.use("/ratings", ratingsRoutes);
app.use("/auth", authRoutes);
app.use("/tickets", ticketRoutes)

// ❗ To handle errors. Routes that don't exist or errors that you handle in specific routes
require("./error-handling")(app);

module.exports = app;
