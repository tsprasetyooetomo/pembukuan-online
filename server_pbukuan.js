// ============================================================================
// 1. ERROR HANDLING GLOBAL (PALING ATAS)
// ============================================================================
process.on("uncaughtException", (err) => {
  console.error("🔥 CRITICAL SYSTEM ERROR:", err.message);
  console.error(err.stack);
  // Biarkan proses tetap berjalan sebentar agar log terkirim, lalu mati
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason) => {
  console.error("🔥 UNHANDLED PROMISE REJECTION:", reason);
});

// ============================================================================
// 2. IMPORT LIBRARY (DENGAN PENGECEKAN CRASH)
// ============================================================================
let express, cors, path, Database;

try {
  express = require("express");
  cors = require("cors");
  path = require("path");
  Database = require("better-sqlite3");
  console.log("✅ Semua library berhasil dimuat.");
} catch (e) {
  console.error(
    "❌ FATAL: Gagal memuat library. Pastikan 'npm install' sudah dijalankan.",
  );
  console.error("Error:", e.message);
  process.exit(1);
}

const app = express();

// ============================================================================
// 3. MIDDLEWARE
// ============================================================================
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname)));

// ============================================================================
// 4. KONFIGURASI SERVER & START (PALING PENTING: DAHULUKAN)
// ============================================================================

const serverPort = 3000;
const serverHost = "0.0.0.0";

try {
  app.listen(Number(serverPort), serverHost, () => {
    console.log(
      `🚀 SERVER SUKSES START DI: http://${serverHost}:${serverPort}`,
    );
    console.log("⏳ Menunggu inisialisasi database...");
  });
} catch (err) {
  console.error("❌ Gagal menjalankan server:", err.message);
  process.exit(1);
}

// ============================================================================
// 5. LOGIC APLIKASI (DATABASE & ROUTES)
// ============================================================================

// Definisi Tabel
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

function isValidTable(name) {
  if (!name) return false;
  if (ALLOWED_TABLES.includes(name)) return true;
  if (/\d{4}$/.test(name)) {
    const baseName = name.replace(/\d{4}$/, "");
    if (ALLOWED_TABLES.includes(baseName)) return true;
  }
  if (name.startsWith("backup_")) return true;
  return false;
}

// Route Utama (Health Check)
app.get("/", (req, res) => {
  try {
    const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
    res.sendFile(htmlPath);
  } catch (error) {
    res.status(500).send("Gagal memuat halaman pembukuan: " + error.message);
  }
});

// Inisialisasi Database
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "pembukuan.db")
  : path.join(__dirname, "pembukuan.db");

let db;

try {
  console.log("📂 Menghubungkan Database:", dbPath);
  const isDebug = process.env.DEBUG === "1"; // Aktifkan jika ada Variable DEBUG=1
  db = new Database(dbPath, { verbose: isDebug ? console.log : undefined });
  // db = new Database(dbPath, { verbose: console.log }); // Verbose untuk debug

  const initTable = (tableName) => {
    try {
      const check = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(tableName);
      if (!check) {
        console.log(`🛠️ Membuat tabel: ${tableName}`);
        if (tableName.match(/\d{4}$/)) {
          db.prepare(
            `CREATE TABLE ${tableName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data TEXT NOT NULL)`,
          ).run();
        } else {
          db.prepare(
            `CREATE TABLE ${tableName} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
          ).run();
        }
      }
    } catch (e) {
      console.error(`⚠️ Gagal init tabel ${tableName}:`, e.message);
    }
  };

  ALLOWED_TABLES.forEach(initTable);
  console.log("✅ Inisialisasi Database Selesai.");
} catch (err) {
  console.error("❌ FATAL DATABASE ERROR:", err.message);
  console.error("Aplikasi akan tetap berjalan tanpa database (Mode Error).");
  // Jangan exit(1), biarkan server hidup agar user bisa lihat error
}

// ============================================================================
// 6. API ROUTES (WRAPPER TRY-CATCH)
// ============================================================================

// RESET POSTING
app.post("/api/reset-posting", (req, res) => {
  if (!db)
    return res
      .status(500)
      .json({ success: false, message: "Database tidak terkoneksi" });
  try {
    const { masa, cabang } = req.body;
    if (!masa || !cabang)
      return res
        .status(400)
        .json({ success: false, message: "Parameter wajib" });

    const tahun = "20" + masa.toString().slice(-2);
    const tables = [
      `perkiraan${tahun}`,
      `golongan${tahun}`,
      `transaksi${tahun}`,
    ];

    db.transaction(() => {
      tables.forEach((t) => {
        try {
          db.prepare(`DELETE FROM ${t} WHERE masa = ? AND cabang = ?`).run(
            masa,
            cabang,
          );
        } catch (e) {}
      });
    })();

    res.json({ success: true, message: "Reset selesai" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// CLEAR ALL DATA
app.post("/api/clear-all-data", (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName, masa, cabang } = req.body;
    if (!storeName || !isValidTable(storeName))
      return res
        .status(403)
        .json({ success: false, message: "Tabel tidak valid" });

    let sql = `DELETE FROM ${storeName}`;
    let params = [];

    // Cek apakah perlu filter tahunan
    const cols = db.prepare(`PRAGMA table_info(${storeName})`).all();
    const hasMasa = cols.some((c) => c.name === "masa");

    if (hasMasa && masa && cabang) {
      sql += ` WHERE masa = ? AND cabang = ?`;
      params = [masa, cabang];
    }

    const info = db.prepare(sql).run(params);
    res.json({ success: true, changes: info.changes });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET ALL DATA
app.get("/api/data/:storeName", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const rows = db.prepare(`SELECT data FROM ${storeName}`).all();
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET BY ID
app.get("/api/data/:storeName/:id", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);
    if (row) res.json(JSON.parse(row.data));
    else res.status(404).json({ error: "Not Found" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST DATA
app.post("/api/data/:storeName", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const data = req.body;
    if (!data.id) return res.status(400).json({ error: "ID Required" });

    db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    ).run(data.id, JSON.stringify(data));
    res.status(201).json({ message: "Created" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT DATA (BY ID)
app.put("/api/data/:storeName/:id", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });

    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);
    let merged = row ? { ...JSON.parse(row.data), ...req.body } : req.body;
    merged.id = id;

    db.prepare(`UPDATE ${storeName} SET data = ? WHERE id = ?`).run(
      JSON.stringify(merged),
      id,
    );
    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT UPSERT
app.put("/api/data/:storeName", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const data = req.body;
    if (!data.id) return res.status(400).json({ error: "ID Required" });

    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(data.id);
    let merged = row ? { ...JSON.parse(row.data), ...data } : data;

    db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    ).run(data.id, JSON.stringify(merged));
    res.json({ message: "Upserted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE ONE
app.delete("/api/data/:storeName/:id", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    db.prepare(`DELETE FROM ${storeName} WHERE id = ?`).run(id);
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE ALL
app.delete("/api/data/:storeName", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    db.prepare(`DELETE FROM ${storeName}`).run();
    res.json({ message: "Cleared" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// COUNT
app.get("/api/count/:storeName", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const row = db.prepare(`SELECT COUNT(id) as total FROM ${storeName}`).get();
    res.json(row ? row.total : 0);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// BACKUP
app.get("/api/backup", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    let backupData = {};
    ALLOWED_TABLES.forEach((t) => {
      try {
        backupData[t] = db
          .prepare(`SELECT data FROM ${t}`)
          .all()
          .map((r) => JSON.parse(r.data));
      } catch (e) {}
    });
    res.setHeader("Content-Disposition", "attachment; filename=backup.json");
    res.json(backupData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// BATCH
app.post("/api/batch/:storeName", (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName } = req.params;
    const data = req.body;
    if (!Array.isArray(data))
      return res.json({ success: true, message: "No data" });

    // Auto create tabel tahunan jika belum ada
    const check = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(storeName);
    if (!check && storeName.match(/\d{4}$/)) {
      db.prepare(
        `CREATE TABLE ${storeName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data TEXT NOT NULL)`,
      ).run();
    }

    const insert = db.transaction((items) => {
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
      );
      items.forEach((item) => {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${storeName}_${Date.now()}`;
        stmt.run(id, JSON.stringify(item));
      });
    });
    insert(data);
    res.json({ success: true, count: data.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// SAVE BATCH
app.post("/api/save-batch", (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName, data } = req.body;
    if (!storeName || !Array.isArray(data)) return res.json({ success: true });

    const insert = db.transaction((items) => {
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
      );
      items.forEach((item) => {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${storeName}_${Date.now()}`;
        stmt.run(id, JSON.stringify(item));
      });
    });
    insert(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// SALDO HARIAN RANGE
app.post("/api/saldo-harian/clear-range", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { cabang, char4, tanggalAwal, tanggalAkhir } = req.body;
    if (!tanggalAwal || !tanggalAkhir)
      return res.status(400).json({ error: "Date Required" });
    const sql = `DELETE FROM saldo_harian WHERE json_extract(data, '$.cabang') = ? AND json_extract(data, '$.char4') = ? AND json_extract(data, '$.tanggal') BETWEEN ? AND ?`;
    db.prepare(sql).run(
      cabang || "Pusat",
      char4 || " ",
      tanggalAwal,
      tanggalAkhir,
    );
    res.json({ message: "Cleared" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SNAPSHOT SALDO
app.post("/api/saldo-harian", (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;
    if (!tanggal) return res.status(400).json({ error: "Date Required" });
    const id = `${cabang}_${char4}_${tanggal}`;
    db.prepare(
      `INSERT OR REPLACE INTO saldo_harian (id, data) VALUES (?, ?)`,
    ).run(id, JSON.stringify({ cabang, char4, tanggal, saldo_akhir }));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
