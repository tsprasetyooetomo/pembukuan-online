// ============================================================================
// 1. JARING PENGANGKAP ERROR GLOBAL (PASTE DI BARIS PALING ATAS NO 1)
// ============================================================================
process.on("uncaughtException", (err) => {
  console.error("🔥 CRITICAL ERROR TERDETEKSI:", err.stack || err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 JANJI ERROR TERDETEKSI di:", promise, "alasan:", reason);
});

// ============================================================================
// 2. IMPORT LIBRARY UTAMA (TIDAK BOLEH DOUBLE DI BAWAH)
// ============================================================================
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const app = express();

// ============================================================================
// 3. CORS & MIDDLEWARE
// ============================================================================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Menyajikan file statis (.js, .css, gambar) langsung dari folder root utama
app.use(express.static(path.join(__dirname)));

// ============================================================================
// 4. WHITELIST TABEL & FUNGSI VALIDASI
// ============================================================================
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

// ============================================================================
// 5. ROUTE UTAMA (MENGGUNAKAN STANDAR EXPRESS YANG AMAN)
// ============================================================================
app.get("/", (req, res) => {
  try {
    // Sesuai konfirmasi: membaca pembukuan_telaga.html di folder root
    const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
    res.sendFile(htmlPath);
  } catch (error) {
    console.error("❌ Gagal memuat halaman HTML:", error);
    res.status(500).send("Gagal memuat halaman pembukuan");
  }
});

// ============================================================================
// 6. INISIALISASI DATABASE & PENGHIDUPAN SERVER (URUTAN TERKUNCI AMAN)
// ============================================================================
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "pembukuan.db")
  : path.join(__dirname, "pembukuan.db");

let db;

try {
  // Hubungkan Database terlebih dahulu
  db = new Database(dbPath, { verbose: console.log });
  console.log("✅ Database Pembukuan SQLite terkoneksi di:", dbPath);

  // Fungsi Helper Auto-Schema Dinamis
  const initTable = (tableName) => {
    const check = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName);
    if (!check) {
      if (tableName.match(/\d{4}$/)) {
        console.log(`🛠️ Membuat tabel tahunan: ${tableName}`);
        db.prepare(
          `CREATE TABLE ${tableName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data TEXT NOT NULL)`,
        ).run();
      } else {
        console.log(`🛠️ Membuat tabel master: ${tableName}`);
        db.prepare(
          `CREATE TABLE ${tableName} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
        ).run();
      }
    }
  };

  // Jalankan pemeriksaan tabel master
  ALLOWED_TABLES.forEach(initTable);
  console.log("✅ Seluruh tabel master berhasil diperiksa.");

  // TENTUKAN PORT DAN JALANKAN SERVER SEBAGAI PROSES TERAKHIR DI BLOK INI
  const serverPort = process.env.PORT || 3000;
  const serverHost = "0.0.0.0";

  app.listen(Number(serverPort), serverHost, () => {
    console.log(
      `🚀 Server Express aktif di host ${serverHost} port ${serverPort}!`,
    );
  });
} catch (err) {
  console.error("❌ Gagal menginisialisasi Sistem Aplikasi:", err.message);
  process.exit(1);
}

// ============================================================================
// 7. HELPER SINKRONUS PENGGANTI PROMISE LAMA (ANTI-CRASH)
// ============================================================================
const dbRun = (sql, params = []) => db.prepare(sql).run(params);
const dbAll = (sql, params = []) => db.prepare(sql).all(params);

// ============================================================================
// 8. DATA CRUD API ROUTES (SEMUANYA SINKRONUS BETTER-SQLITE3)
// ============================================================================

// RESET POSTING
app.post("/api/reset-posting", (req, res) => {
  try {
    const { masa, cabang } = req.body;
    if (!masa || !cabang)
      return res
        .status(400)
        .json({ success: false, message: "Parameter wajib dikirim." });

    const duaDigitTahun = masa.toString().slice(-2);
    const tahun = "20" + duaDigitTahun;

    const queries = [
      {
        table: `perkiraan${tahun}`,
        sql: `DELETE FROM perkiraan${tahun} WHERE "masa" = ? AND "cabang" = ?`,
      },
      {
        table: `golongan${tahun}`,
        sql: `DELETE FROM golongan${tahun} WHERE "masa" = ? AND "cabang" = ?`,
      },
      {
        table: `transaksi${tahun}`,
        sql: `DELETE FROM transaksi${tahun} WHERE "masa" = ? AND "cabang" = ?`,
      },
    ];

    db.transaction(() => {
      for (let q of queries) {
        db.prepare(q.sql).run(masa, cabang);
      }
    })();

    res.json({
      success: true,
      message: `Data periode ${masa} cabang ${cabang} berhasil direset.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CLEAR ALL DATA
app.post("/api/clear-all-data", (req, res) => {
  try {
    const { storeName, masa, cabang } = req.body;
    if (!storeName)
      return res
        .status(400)
        .json({ success: false, message: "Nama data tidak dikirim!" });

    const tabelInduk = storeName.replace(/[0-9]/g, "").trim().toLowerCase();
    if (!isValidTable(tabelInduk))
      return res
        .status(403)
        .json({ success: false, message: `Akses ditolak!` });

    let sqlDelete = `DELETE FROM ${storeName}`;
    let params = [];

    if (/\d+/.test(storeName)) {
      const rows = db.prepare(`PRAGMA table_info(${storeName})`).all();
      if (!rows || rows.length === 0)
        return res.json({ success: true, changes: 0 });

      const daftarKolom = rows.map((row) => row.name.toLowerCase());
      if (
        tabelInduk.includes("transaksi") ||
        tabelInduk.includes("perkiraan") ||
        tabelInduk.includes("golongan")
      ) {
        if (!daftarKolom.includes("masa") || !daftarKolom.includes("cabang"))
          return res.json({ success: true, changes: 0 });
        if (masa && cabang) {
          sqlDelete = `DELETE FROM ${storeName} WHERE masa = ? AND cabang = ?`;
          params = [masa, cabang];
        } else {
          return res.json({ success: true, changes: 0 });
        }
      }
    }

    const info = db.prepare(sqlDelete).run(params);
    return res.json({
      success: true,
      message: "Data dibersihkan.",
      changes: info.changes,
    });
  } catch (fatalError) {
    return res
      .status(500)
      .json({ success: false, message: fatalError.message });
  }
});

// GET ALL DATA
app.get("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    const rows = db.prepare(`SELECT data FROM ${storeName}`).all();
    res.json(rows.map((row) => JSON.parse(row.data)));
  } catch (error) {
    if (error.message.includes("no such table")) return res.json([]);
    res.status(500).json({ error: error.message });
  }
});

// GET DATA BY ID
app.get("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);
    if (row) res.json(JSON.parse(row.data));
    else res.status(404).json({ error: "Data tidak ditemukan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST DATA BARU
app.post("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    const data = req.body;
    if (!data.id)
      return res.status(400).json({ error: "Properti 'id' wajib ada" });
    db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    ).run(data.id, JSON.stringify(data));
    res.status(201).json({ message: "Berhasil ditambahkan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT DATA BY ID
app.put("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    const newData = req.body;
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);
    let mergedData = row ? { ...JSON.parse(row.data), ...newData } : newData;
    mergedData.id = id;
    db.prepare(`UPDATE ${storeName} SET data = ? WHERE id = ?`).run(
      JSON.stringify(mergedData),
      id,
    );
    res.json({ message: "Berhasil diupdate" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT UPSERT
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
    let mergedData = row ? { ...JSON.parse(row.data), ...newData } : newData;
    db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    ).run(newData.id, JSON.stringify(mergedData));
    res.json({ message: "Berhasil disimpan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE 1 DATA
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

// DELETE KOSONGKAN TABEL
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

// COUNT DATA
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

// BACKUP DATABASE JSON
app.get("/api/backup", (req, res) => {
  try {
    let backupData = {};
    for (const table of ALLOWED_TABLES) {
      const rows = db.prepare(`SELECT data FROM ${table}`).all();
      backupData[table] = rows.map((row) => JSON.parse(row.data));
    }
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=backup_pembukuan.json",
    );
    res.json(backupData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CLEAR RANGE SALDO HARIAN
app.post("/api/saldo-harian/clear-range", (req, res) => {
  try {
    const { cabang, char4, tanggalAwal, tanggalAkhir } = req.body;
    if (!tanggalAwal || !tanggalAkhir)
      return res.status(400).json({ error: "Tanggal wajib diisi" });
    const sql = `DELETE FROM saldo_harian WHERE json_extract(data, '$.cabang') = ? AND json_extract(data, '$.char4') = ? AND json_extract(data, '$.tanggal') BETWEEN ? AND ?;`;
    db.prepare(sql).run(
      cabang || "Pusat",
      char4 || " ",
      tanggalAwal,
      tanggalAkhir,
    );
    res.json({ message: "Data lama dibersihkan." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BATCH DATA PARAMS URL
app.post("/api/batch/:storeName", (req, res) => {
  const { storeName } = req.params;
  const data = req.body;
  if (!Array.isArray(data) || data.length === 0)
    return res.json({ success: true, message: "Data kosong." });
  try {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    );
    const jumlahError = db.transaction((items) => {
      let errorCounter = 0;
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          const idUnik =
            item.id ||
            item.noPerk ||
            item.gol ||
            item.nomor ||
            `${storeName}_${i}`;
          stmt.run(idUnik, JSON.stringify(item));
        } catch (e) {
          errorCounter++;
        }
      }
      return errorCounter;
    })(data);
    return res.json({
      success: true,
      total: data.length,
      errorCount: jumlahError,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// SAVE BATCH BODY
app.post("/api/save-batch", (req, res) => {
  const { storeName, data } = req.body;
  if (!storeName || !Array.isArray(data) || data.length === 0)
    return res.json({ success: true, changes: 0 });
  try {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    );
    const jumlahError = db.transaction((items) => {
      let errorCounter = 0;
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          const idUnik =
            item.id ||
            item.noPerk ||
            item.gol ||
            item.nomor ||
            `${storeName}_${i}`;
          stmt.run(idUnik, JSON.stringify(item));
        } catch (e) {
          errorCounter++;
        }
      }
      return errorCounter;
    })(data);
    return res.json({ success: true, errorCount: jumlahError });
  } catch (loopErr) {
    return res.status(500).json({ success: false, message: loopErr.message });
  }
});

// SNAPSHOT SALDO HARIAN
app.post("/api/saldo-harian", (req, res) => {
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;
    if (!tanggal) return res.status(400).json({ error: "Tanggal wajib diisi" });
    const id = `${cabang}_${char4}_${tanggal}`;
    db.prepare(
      `INSERT OR REPLACE INTO saldo_harian (id, data) VALUES (?, ?)`,
    ).run(id, JSON.stringify({ cabang, char4, tanggal, saldo_akhir }));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
