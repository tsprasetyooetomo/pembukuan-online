// ================================================================
// JARING PENGANGKAP ERROR GLOBAL (PASTE DI BARIS PALING ATAS NO 1)
// ================================================================
process.on("uncaughtException", (err) => {
  console.error("🔥 CRITICAL ERROR TERDETEKSI:", err.stack || err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 JANJI ERROR TERDETEKSI di:", promise, "alasan:", reason);
});

// ================================================================
// SERVER.JS - BACKEND PEMBUKUAN (SQLITE) - OPTIMIZED FOR RAILWAY
// ================================================================
const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");
const app = express();

// ================================================================
// CORS & MIDDLEWARE
// ================================================================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Menyajikan file statis (JS, CSS, Gambar) dari folder root
app.use(express.static(path.join(__dirname)));

// ================================================================
// KONFIGURASI DATABASE & TABEL
// ================================================================
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "pembukuan.db")
  : path.join(__dirname, "pembukuan.db");

let db;

try {
  // 1. Hubungkan Database
  db = new Database(dbPath);
  console.log("✅ Database Pembukuan SQLite terkoneksi di:", dbPath);

  // 2. Fungsi Helper untuk Inisialisasi Tabel (Auto-Schema)
  const initTable = (tableName) => {
    // Cek apakah tabel sudah ada
    const check = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName);

    if (!check) {
      if (tableName.match(/\d{4}$/)) {
        // Tabel Tahunan (misal: transaksi2024): Butuh kolom masa & cabang
        console.log(`🛠️ Membuat tabel tahunan: ${tableName}`);
        db.prepare(
          `CREATE TABLE ${tableName} (
            id TEXT PRIMARY KEY,
            masa TEXT,
            cabang TEXT,
            data TEXT NOT NULL
          )`,
        ).run();
      } else {
        // Tabel Master (misal: users, golongan): Cukup id & data
        console.log(`🛠️ Membuat tabel master: ${tableName}`);
        db.prepare(
          `CREATE TABLE ${tableName} (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
          )`,
        ).run();
      }
    } else {
      // Opsional: Validasi kolom jika tabel sudah ada untuk memastikan kompatibilitas
      // (Disini kita skip agar tidak merusak DB lama user)
    }
  };

  // 3. Inisialisasi Tabel Master dari Whitelist
  const ALLOWED_TABLES = [
    "golongan",
    "perkiraan",
    "transaksi",
    "users",
    "formatRL",
    "formatNeraca",
    "postedMonths",
    "kodeBank",
    "cabang",
    "detiltransaksi",
    "saldo_harian",
  ];

  ALLOWED_TABLES.forEach(initTable);
  console.log("✅ Seluruh tabel master berhasil diperiksa.");
} catch (err) {
  console.error("❌ Gagal menginisialisasi Sistem Aplikasi:", err.message);
  process.exit(1);
}

// ================================================================
// FUNGSI VALIDASI KEAMANAN
// ================================================================
function isValidTable(name) {
  if (!name) return false;
  // Izinkan tabel master
  const ALLOWED_TABLES = [
    "golongan",
    "perkiraan",
    "transaksi",
    "users",
    "formatRL",
    "formatNeraca",
    "postedMonths",
    "kodeBank",
    "cabang",
    "detiltransaksi",
    "saldo_harian",
  ];

  if (ALLOWED_TABLES.includes(name)) return true;

  // Izinkan tabel tahunan (berakhiran 4 digit angka)
  if (/\d{4}$/.test(name)) {
    const baseName = name.replace(/\d{4}$/, "");
    if (ALLOWED_TABLES.includes(baseName)) return true;
  }

  // Izinkan tabel backup (diawali backup_)
  if (name.startsWith("backup_")) return true;

  return false;
}

// ==========================================================
// ROUTE UTAMA
// ==========================================================
app.get("/", (req, res) => {
  try {
    // Pastikan nama file HTML sesuai dengan yang Anda miliki
    const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
    res.sendFile(htmlPath);
  } catch (error) {
    res.status(500).send("Gagal memuat halaman pembukuan");
  }
});

// =========================================================================
// API ROUTE: RESET DATA POSTING
// =========================================================================
app.post("/api/reset-posting", (req, res) => {
  try {
    const { masa, cabang } = req.body;

    if (!masa || !cabang) {
      return res.status(400).json({
        success: false,
        message: "Parameter masa dan cabang wajib dikirim.",
      });
    }

    // Ambil tahun dari masa (Format MMYY -> YYYY)
    const duaDigitTahun = masa.toString().slice(-2);
    const tahun = "20" + duaDigitTahun;

    const tabelPerkiraan = `perkiraan${tahun}`;
    const tabelGolongan = `golongan${tahun}`;
    const tabelTransaksi = `transaksi${tahun}`;

    const tablesToReset = [tabelPerkiraan, tabelGolongan, tabelTransaksi];
    const results = [];

    tablesToReset.forEach((table) => {
      try {
        // Gunakan transaksi untuk kecepatan dan keamanan
        const stmt = db.prepare(
          `DELETE FROM ${table} WHERE masa = ? AND cabang = ?`,
        );
        const info = stmt.run(masa, cabang);
        results.push({ table, deleted: info.changes });
        console.log(`✅ Reset ${table}: ${info.changes} baris dihapus.`);
      } catch (err) {
        console.error(`⚠️ Gagal reset ${table}:`, err.message);
        // Lanjutkan proses tabel lain meski ada yang gagal
      }
    });

    res.json({
      success: true,
      message: `Proses reset selesai untuk periode ${masa} cabang ${cabang}.`,
      details: results,
    });
  } catch (error) {
    console.error("🚨 Error reset posting:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server saat mereset data.",
    });
  }
});

// =========================================================================
// API ROUTE: CLEAR ALL DATA
// =========================================================================
app.post("/api/clear-all-data", (req, res) => {
  try {
    const { storeName, masa, cabang } = req.body;

    if (!storeName) {
      return res
        .status(400)
        .json({ success: false, message: "Nama data tidak dikirim!" });
    }

    if (!isValidTable(storeName)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak! Tabel '${storeName}' tidak dikenal.`,
      });
    }

    const isYearly = /\d+/.test(storeName);
    let sql = `DELETE FROM ${storeName}`;
    let params = [];

    if (isYearly) {
      // Cek keberadaan kolom 'masa' dan 'cabang' di tabel tahunan
      const cols = db.prepare(`PRAGMA table_info(${storeName})`).all();
      const colNames = cols.map((c) => c.name);

      // Jika tabel transaksi/perkiraan tahunan dan memiliki kolom filter
      if (colNames.includes("masa") && colNames.includes("cabang")) {
        if (masa && cabang) {
          sql += ` WHERE masa = ? AND cabang = ?`;
          params = [masa, cabang];
          console.log(`🗑️ Filtered Delete: ${storeName} (${masa}, ${cabang})`);
        } else {
          console.log(
            `⚠️ Clear ${storeName}: Filter kosong, membatalkan hapus total.`,
          );
          return res.json({
            success: true,
            message: "Dibatalkan (Parameter filter kosong)",
            changes: 0,
          });
        }
      } else {
        console.log(`🗑️ Total Delete (No Cols): ${storeName}`);
      }
    } else {
      console.log(`🗑️ Total Delete (Master): ${storeName}`);
    }

    const info = db.prepare(sql).run(params);
    return res.json({
      success: true,
      message: `Data tabel '${storeName}' berhasil dibersihkan.`,
      changes: info.changes,
    });
  } catch (fatalError) {
    console.error("🚨 Fatal Error di API Clear Data:", fatalError.message);
    return res
      .status(500)
      .json({ success: false, message: "Server Crash: " + fatalError.message });
  }
});

// ================================================================
// ROUTE CRUD DATA (GET, POST, PUT, DELETE)
// ================================================================

// GET: Semua data
app.get("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;

  if (!isValidTable(storeName)) {
    return res.status(400).json({ error: "Tabel tidak valid" });
  }

  try {
    const rows = db.prepare(`SELECT data FROM ${storeName}`).all();
    res.json(rows.map((row) => JSON.parse(row.data)));
  } catch (error) {
    if (error.message.includes("no such table")) {
      return res.json([]);
    }
    console.error(`🚨 Gagal ambil data ${storeName}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET: Data by ID
app.get("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;

  if (!isValidTable(storeName)) {
    return res.status(400).json({ error: "Tabel tidak valid" });
  }

  try {
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);
    if (row) {
      res.json(JSON.parse(row.data));
    } else {
      res.status(404).json({ error: "Data tidak ditemukan" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Tambah Data Baru
app.post("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    const data = req.body;
    if (!data.id)
      return res.status(400).json({ error: "Properti 'id' wajib ada" });

    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    );
    stmt.run(data.id, JSON.stringify(data));

    res.status(201).json({ message: "Berhasil ditambahkan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT: Update Data (Merge)
app.put("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const newData = req.body;
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);

    let mergedData = {};
    if (row) {
      const oldData = JSON.parse(row.data);
      mergedData = { ...oldData, ...newData };
    } else {
      mergedData = newData;
    }
    mergedData.id = id;

    const stmt = db.prepare(`UPDATE ${storeName} SET data = ? WHERE id = ?`);
    stmt.run(JSON.stringify(mergedData), id);

    res.json({ message: "Berhasil diupdate" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT: Upsert (Tanpa ID di URL)
app.put("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const newData = req.body;
    if (!newData.id)
      return res.status(400).json({ error: "Properti 'id' wajib ada" });

    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(newData.id);
    let mergedData = {};

    if (row) {
      const oldData = JSON.parse(row.data);
      mergedData = { ...oldData, ...newData };
    } else {
      mergedData = newData;
    }

    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    );
    stmt.run(newData.id, JSON.stringify(mergedData));

    res.json({ message: "Berhasil disimpan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Hapus 1 Data
app.delete("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    db.prepare(`DELETE FROM ${storeName} WHERE id = ?`).run(id);
    res.json({ message: "Berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Kosongkan Tabel
app.delete("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    db.prepare(`DELETE FROM ${storeName}`).run();
    res.json({ message: "Tabel berhasil dikosongkan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Hitung Jumlah Data
app.get("/api/count/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const row = db.prepare(`SELECT COUNT(id) as total FROM ${storeName}`).get();
    res.json(row ? row.total : 0);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Backup Database
app.get("/api/backup", (req, res) => {
  try {
    let backupData = {};
    const ALLOWED_TABLES = [
      "golongan",
      "perkiraan",
      "transaksi",
      "users",
      "formatRL",
      "formatNeraca",
      "postedMonths",
      "kodeBank",
      "cabang",
      "detiltransaksi",
      "saldo_harian",
    ];

    ALLOWED_TABLES.forEach((table) => {
      const rows = db.prepare(`SELECT data FROM ${table}`).all();
      backupData[table] = rows.map((row) => JSON.parse(row.data));
    });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=backup_pembukuan.json",
    );
    res.json(backupData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Clear Range Saldo Harian
app.post("/api/saldo-harian/clear-range", (req, res) => {
  try {
    const { cabang, char4, tanggalAwal, tanggalAkhir } = req.body;

    if (!tanggalAwal || !tanggalAkhir) {
      return res
        .status(400)
        .json({ error: "Tanggal awal dan akhir wajib diisi" });
    }

    const kodeCabang = cabang || "Pusat";
    const kodeChar = char4 || " ";

    const sql = `
      DELETE FROM saldo_harian 
      WHERE json_extract(data, '$.cabang') = ? 
        AND json_extract(data, '$.char4') = ?
        AND json_extract(data, '$.tanggal') BETWEEN ? AND ?
    `;

    db.prepare(sql).run(kodeCabang, kodeChar, tanggalAwal, tanggalAkhir);
    res.json({
      message: `Data rentang ${tanggalAwal} s/d ${tanggalAkhir} berhasil dibersihkan.`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// BATCH PROCESSING
// ================================================================

// Batch 1: Via URL Params
app.post("/api/batch/:storeName", (req, res) => {
  const storeName = req.params.storeName;
  const data = req.body;

  if (!storeName) {
    return res
      .status(400)
      .json({ success: false, message: "Nama tabel wajib diisi." });
  }

  if (!Array.isArray(data) || data.length === 0) {
    return res.json({ success: true, message: "Data kosong.", changes: 0 });
  }

  console.log(`📝 Batch Process: ${storeName} (${data.length} items)`);

  try {
    // Pastikan tabel ada sebelum batch (Auto-create jika tahunan)
    const check = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(storeName);
    if (!check) {
      if (storeName.match(/\d{4}$/)) {
        db.prepare(
          `CREATE TABLE ${storeName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data TEXT NOT NULL)`,
        ).run();
      } else {
        return res.status(400).json({
          success: false,
          message: "Tabel tidak dikenal dan belum dibuat.",
        });
      }
    }

    const insertMany = db.transaction((items) => {
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
      );
      for (const item of items) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${storeName}_${Math.random().toString(36).substr(2, 9)}`;
        stmt.run(id, JSON.stringify(item));
      }
    });

    insertMany(data);
    return res.json({
      success: true,
      message: `Berhasil menyimpan ${data.length} data.`,
    });
  } catch (err) {
    console.error("Batch Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Batch 2: Via Body JSON
app.post("/api/save-batch", (req, res) => {
  const { storeName, data } = req.body;

  if (!storeName || !Array.isArray(data) || data.length === 0) {
    return res.json({ success: true, message: "Data kosong.", changes: 0 });
  }

  try {
    const insertMany = db.transaction((items) => {
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
      );
      for (const item of items) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${storeName}_${Math.random().toString(36).substr(2, 9)}`;
        stmt.run(id, JSON.stringify(item));
      }
    });

    insertMany(data);
    return res.json({
      success: true,
      message: `Berhasil menyimpan ${data.length} data.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST: Simpan Saldo Harian
app.post("/api/saldo-harian", (req, res) => {
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;
    if (!tanggal) return res.status(400).json({ error: "Tanggal wajib diisi" });

    const id = `${cabang}_${char4}_${tanggal}`;
    const dataJson = JSON.stringify({ cabang, char4, tanggal, saldo_akhir });

    db.prepare(
      `INSERT OR REPLACE INTO saldo_harian (id, data) VALUES (?, ?)`,
    ).run(id, dataJson);
    res.json({ success: true, message: "Snapshot saldo berhasil disimpan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// START SERVER
// ================================================================
const serverPort = process.env.PORT || 3000;
const serverHost = "0.0.0.0";

app.listen(Number(serverPort), serverHost, () => {
  console.log(
    `🚀 Server Express aktif di host ${serverHost} port ${serverPort}!`,
  );
});
