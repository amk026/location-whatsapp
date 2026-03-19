// server.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const fs = require("fs"); // <-- ADD THIS LINE
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  }),
);

// ---------- IN‑MEMORY CONFIGURATION ----------
// Initialize from environment variables (or use defaults)
let config = {
  whatsappNumber: process.env.DEFAULT_WHATSAPP_NUMBER || "",
  centreLat: parseFloat(process.env.DEFAULT_LAT) || 40.7128,
  centreLon: parseFloat(process.env.DEFAULT_LON) || -74.006,
};

// Helper: read config (simply returns the current object)
function readConfig() {
  return config;
}

// Helper: write config (updates the in‑memory object)
function writeConfig(newConfig) {
  config = newConfig;
}

// ---------- PUBLIC ROUTES ----------

// Serve the public page with injected centre coordinates
app.get("/", (req, res) => {
  const currentConfig = readConfig();
  let html = fs.readFileSync(
    path.join(__dirname, "public", "index.html"),
    "utf8",
  );
  // Replace placeholders with actual values
  html = html.replace("{{CENTRE_LAT}}", currentConfig.centreLat);
  html = html.replace("{{CENTRE_LON}}", currentConfig.centreLon);
  res.send(html);
});

// API endpoint to get the current WhatsApp number
app.get("/api/whatsapp-number", (req, res) => {
  const currentConfig = readConfig();
  res.json({ number: currentConfig.whatsappNumber });
});

// Serve static files (CSS, JS, images) – placed AFTER the custom '/' route
app.use(express.static(path.join(__dirname, "public")));

// ---------- ADMIN ROUTES ----------

// Admin login page (simple form)
app.get("/admin", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Login</title>
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <div class="container">
                <h1>Admin Login</h1>
                <form action="/admin/login" method="POST">
                    <input type="text" name="username" placeholder="Username" required>
                    <input type="password" name="password" placeholder="Password" required>
                    <button type="submit">Login</button>
                </form>
                ${req.query.error ? '<p class="error">Invalid credentials</p>' : ""}
            </div>
        </body>
        </html>
    `);
});

// Handle login POST
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;
    res.redirect("/admin/dashboard.html");
  } else {
    res.redirect("/admin?error=1");
  }
});

// Admin dashboard (protected)
app.get("/admin/dashboard.html", (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect("/admin");
  }
  const currentConfig = readConfig();
  let html = fs.readFileSync(
    path.join(__dirname, "public", "admin", "dashboard.html"),
    "utf8",
  );
  // Replace placeholders with current values
  html = html.replace("{{WHATSAPP_NUMBER}}", currentConfig.whatsappNumber);
  html = html.replace("{{CENTRE_LAT}}", currentConfig.centreLat);
  html = html.replace("{{CENTRE_LON}}", currentConfig.centreLon);

  // Inject success/error messages if present
  const success = req.query.success
    ? '<p class="success">Settings updated successfully!</p>'
    : "";
  const error = req.query.error
    ? '<p class="error">Invalid input. Please check the values.</p>'
    : "";
  html = html.replace("{{MESSAGES}}", success + error);

  res.send(html);
});

// Handle settings update
app.post("/admin/update-settings", (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect("/admin");
  }

  const { whatsappNumber, centreLat, centreLon } = req.body;

  // Validate inputs
  const lat = parseFloat(centreLat);
  const lon = parseFloat(centreLon);
  if (
    !whatsappNumber ||
    isNaN(lat) ||
    isNaN(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return res.redirect("/admin/dashboard.html?error=1");
  }

  // Update in‑memory config
  const newConfig = {
    whatsappNumber: whatsappNumber.trim(),
    centreLat: lat,
    centreLon: lon,
  };
  writeConfig(newConfig);

  res.redirect("/admin/dashboard.html?success=1");
});

// Logout
app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin");
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
