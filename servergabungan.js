const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;

// Middleware Gabungan
app.use(cors());
app.use(express.static(__dirname));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// 1. Load dan Tempelkan Route Karyawan (database.db)
const setupPembukuan = require("./serverlokal");
setupPembukuan(app);

// 2. Load dan Tempelkan Route Pembukuan (pembukuan_lokal.db)
const setupKaryawan = require("./serverkaryawan");
setupKaryawan(app);

// Route Utama
app.get("/", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "pembukuan_telaga.html"));
  } catch (error) {
    res.status(500).send("Gagal memuat halaman: " + error.message);
  }
});
app.get("/health", (req, res) => res.send("OK"));

// Jalankan Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server Gabungan berjalan di http://localhost:${PORT}`);
});
