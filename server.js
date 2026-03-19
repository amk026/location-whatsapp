// server.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for Render's HTTPS forwarding)
app.set("trust proxy", 1);

// Middleware
app.use(express.urlencoded({ extended: true }));

// Session configuration – works on Render (HTTPS)
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true on Render
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  }),
);

// ---------- IN‑MEMORY CONFIGURATION (EPHEMERAL) ----------
// Initialised from environment variables (or defaults)
let config = {
  whatsappNumber: process.env.DEFAULT_WHATSAPP_NUMBER || "",
  centreLat: parseFloat(process.env.DEFAULT_LAT) || 40.7128,
  centreLon: parseFloat(process.env.DEFAULT_LON) || -74.006,
};

function readConfig() {
  return config;
}

function writeConfig(newConfig) {
  config = newConfig;
}

// ---------- PUBLIC ROUTES ----------
app.get("/", (req, res) => {
  const currentConfig = readConfig();
  let html = require("fs").readFileSync(
    path.join(__dirname, "public", "index.html"),
    "utf8",
  );
  html = html.replace("{{CENTRE_LAT}}", currentConfig.centreLat);
  html = html.replace("{{CENTRE_LON}}", currentConfig.centreLon);
  res.send(html);
});

app.get("/api/whatsapp-number", (req, res) => {
  const currentConfig = readConfig();
  res.json({ number: currentConfig.whatsappNumber });
});

// ---------- ADMIN ROUTES ----------
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

app.get("/admin/dashboard.html", (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect("/admin");
  }
  const currentConfig = readConfig();
  let html = require("fs").readFileSync(
    path.join(__dirname, "public", "admin", "dashboard.html"),
    "utf8",
  );
  html = html.replace("{{WHATSAPP_NUMBER}}", currentConfig.whatsappNumber);
  html = html.replace("{{CENTRE_LAT}}", currentConfig.centreLat);
  html = html.replace("{{CENTRE_LON}}", currentConfig.centreLon);

  const success = req.query.success
    ? '<p class="success">Settings updated successfully!</p>'
    : "";
  const error = req.query.error
    ? '<p class="error">Invalid input. Please check the values.</p>'
    : "";
  html = html.replace("{{MESSAGES}}", success + error);

  res.send(html);
});

app.post("/admin/update-settings", (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect("/admin");
  }

  const { whatsappNumber, centreLat, centreLon } = req.body;

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

  const newConfig = {
    whatsappNumber: whatsappNumber.trim(),
    centreLat: lat,
    centreLon: lon,
  };
  writeConfig(newConfig);

  res.redirect("/admin/dashboard.html?success=1");
});

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin");
  });
});

// ---------- STATIC FILES (serve after all custom routes) ----------
app.use(express.static(path.join(__dirname, "public")));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
