// ================================================================
// SERVER.JS - BACKEND PEMBUKUAN (SQLITE) — VERSI DIPERBAIKI
// ================================================================
const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// ================================================================
// MIDDLEWARE
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
app.use(express.static(path.join(__dirname, "public")));

// ================================================================
// WHITELIST TABEL (Keamanan)
// ================================================================
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
  return ALLOWED_TABLES.includes(name);
}

// ================================================================
// SETUP DATABASE SQLITE (better-sqlite3 — Synchronous)
// ================================================================
const dbPath = path.join(__dirname, "pembukuan.db");
const db = new Database(dbPath);

console.log("✅ Database Pembukuan SQLite terkoneksi.");

// Aktifkan WAL mode untuk performa lebih baik
db.pragma("journal_mode = WAL");

// Buat tabel master kalau belum ada (format: id TEXT, data TEXT)
ALLOWED_TABLES.forEach((tableName) => {
  db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`);
});

// ================================================================
// HELPER: Auto-create tabel tahunan jika belum ada
// ================================================================
function ensureTableExists(tableName) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )`);
}

// ================================================================
// CONTOH ROUTE
// ================================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pembukuan_telaga.html"));
});

// ================================================================
// RESET DATA POSTING (3 TABEL SEKALIGUS)
// ================================================================
app.post("/api/reset-posting", (req, res) => {
  try {
    const { masa, cabang } = req.body;

    if (!masa || !cabang) {
      return res.status(400).json({
        success: false,
        message: "Parameter masa dan cabang wajib dikirim.",
      });
    }

    const duaDigitTahun = masa.toString().slice(-2);
    const tahun = "20" + duaDigitTahun;

    const tabelPerkiraan = `perkiraan${tahun}`;
    const tabelGolongan = `golongan${tahun}`;
    const tabelTransaksi = `transaksi${tahun}`;

    const queries = [
      {
        table: tabelPerkiraan,
        sql: `DELETE FROM ${tabelPerkiraan} WHERE json_extract(data, '$.masa') = ? AND json_extract(data, '$.cabang') = ?`,
      },
      {
        table: tabelGolongan,
        sql: `DELETE FROM ${tabelGolongan} WHERE json_extract(data, '$.masa') = ? AND json_extract(data, '$.cabang') = ?`,
      },
      {
        table: tabelTransaksi,
        sql: `DELETE FROM ${tabelTransaksi} WHERE json_extract(data, '$.masa') = ? AND json_extract(data, '$.cabang') = ?`,
      },
    ];

    // Gunakan transaksi better-sqlite3
    const deleteTransaction = db.transaction(() => {
      const results = [];
      for (const q of queries) {
        ensureTableExists(q.table);
        const info = db.prepare(q.sql).run(masa, cabang);
        console.log(
          `✅ Hapus ${q.table} (Masa: ${masa}, Cabang: ${cabang}): ${info.changes} baris terhapus.`,
        );
        results.push({ table: q.table, deleted: info.changes });
      }
      return results;
    });

    const results = deleteTransaction();

    res.json({
      success: true,
      message: `Data periode ${masa} cabang ${cabang} berhasil direset di 3 tabel.`,
      results,
    });
  } catch (error) {
    console.error("🚨 Error reset posting:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server saat mereset data.",
    });
  }
});

// ================================================================
// CLEAR ALL DATA (Dengan Cek Struktur Kolom)
// ================================================================
app.post("/api/clear-all-data", (req, res) => {
  try {
    const { storeName, masa, cabang } = req.body;

    if (!storeName) {
      return res
        .status(400)
        .json({ success: false, message: "Nama data tidak dikirim!" });
    }

    const tabelInduk = storeName.replace(/[0-9]/g, "").trim().toLowerCase();

    // Cek tabel dinamis (backup_ atau berakhiran tahun)
    const isBackupTable = String(storeName).startsWith("backup_");
    const isYearlyTable = /\d{4}$/.test(String(storeName));

    if (!isBackupTable && !isYearlyTable && !isValidTable(tabelInduk)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak! Tabel '${tabelInduk}' tidak dikenal.`,
      });
    }

    ensureTableExists(storeName);

    let sqlDelete;
    let params = [];

    if (isYearlyTable || isBackupTable) {
      // Cek apakah tabel punya kolom masa & cabang di dalam JSON data
      if (masa && cabang) {
        sqlDelete = `DELETE FROM ${storeName} WHERE json_extract(data, '$.masa') = ? AND json_extract(data, '$.cabang') = ?`;
        params = [masa, cabang];
        console.log(
          `🗑️ SQL Spesifik: ${sqlDelete} params: [${masa}, ${cabang}]`,
        );
      } else {
        // Jika tidak ada filter, hapus semua
        sqlDelete = `DELETE FROM ${storeName}`;
        console.log(`🗑️ SQL Total (tanpa filter): ${sqlDelete}`);
      }
    } else {
      sqlDelete = `DELETE FROM ${storeName}`;
      console.log(`🗑️ SQL Total (tabel master): ${sqlDelete}`);
    }

    const info = db.prepare(sqlDelete).run(...params);

    console.log(`💥 Sukses hapus ${info.changes} baris dari '${storeName}'`);
    res.json({
      success: true,
      message: "Sukses dikosongkan.",
      changes: info.changes,
    });
  } catch (error) {
    console.error("🚨 Error clear data:", error.message);
    if (error.message.includes("no such table")) {
      return res.json({ success: true, message: "Bersih.", changes: 0 });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// GET: Ambil semua data dari tabel
// ================================================================
app.get("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;

  const isBackupTable = String(storeName).startsWith("backup_");
  const isYearlyTable = /\d{4}$/.test(String(storeName));

  if (!isBackupTable && !isYearlyTable && !isValidTable(storeName)) {
    return res.status(400).json({ error: "Tabel tidak valid" });
  }

  try {
    ensureTableExists(storeName);
    const rows = db.prepare(`SELECT data FROM ${storeName}`).all();
    res.json(rows.map((row) => JSON.parse(row.data)));
  } catch (error) {
    if (error.message.includes("no such table")) {
      return res.json([]);
    }
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// GET: Ambil 1 data
// ================================================================
app.get("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

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

// ================================================================
// POST: Tambah data baru
// ================================================================
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

// ================================================================
// PUT: Update data (gabung data lama + baru)
// ================================================================
app.put("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const newData = req.body;
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);

    let mergedData;
    if (row) {
      const oldData = JSON.parse(row.data);
      mergedData = { ...oldData, ...newData };
    } else {
      mergedData = newData;
    }
    mergedData.id = id;

    db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    ).run(id, JSON.stringify(mergedData));

    res.json({ message: "Berhasil diupdate tanpa kehilangan data lama" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// PUT tanpa ID: Upsert
// ================================================================
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

    let mergedData;
    if (row) {
      const oldData = JSON.parse(row.data);
      mergedData = { ...oldData, ...newData };
    } else {
      mergedData = newData;
    }

    db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    ).run(newData.id, JSON.stringify(mergedData));

    res.json({ message: "Berhasil disimpan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// DELETE: Hapus 1 data
// ================================================================
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

// ================================================================
// DELETE: Kosongkan tabel
// ================================================================
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

// ================================================================
// GET: Hitung jumlah data
// ================================================================
app.get("/api/count/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const row = db.prepare(`SELECT COUNT(id) as total FROM ${storeName}`).get();
    res.json(row.total);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// GET: Backup database
// ================================================================
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

// ================================================================
// POST: Hapus saldo harian dalam rentang tanggal
// ================================================================
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

    const info = db
      .prepare(sql)
      .run(kodeCabang, kodeChar, tanggalAwal, tanggalAkhir);

    res.json({
      message: `Data lama rentang ${tanggalAwal} s/d ${tanggalAkhir} berhasil dibersihkan. (${info.changes} baris)`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// POST: Simpan saldo harian
// ================================================================
app.post("/api/saldo-harian", (req, res) => {
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;

    if (!tanggal) {
      return res.status(400).json({ error: "Tanggal wajib diisi" });
    }

    const idUnik = `saldo_${cabang || "Pusat"}_${char4 || ""}_${tanggal}`;
    const dataObj = { id: idUnik, cabang, char4, tanggal, saldo_akhir };

    db.prepare(
      `INSERT OR REPLACE INTO saldo_harian (id, data) VALUES (?, ?)`,
    ).run(idUnik, JSON.stringify(dataObj));

    res.json({ success: true, message: "Snapshot saldo berhasil disimpan" });
  } catch (error) {
    console.error("Error API saldo-harian:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// BATCH IMPORT (/api/batch/:storeName)
// ================================================================
app.post("/api/batch/:storeName", (req, res) => {
  const { storeName } = req.params;
  const data = req.body;

  if (!storeName) {
    return res
      .status(400)
      .json({ success: false, message: "Nama tabel wajib diisi." });
  }

  if (!Array.isArray(data) || data.length === 0) {
    return res.json({
      success: true,
      message: "Data kosong, dilewati.",
      changes: 0,
    });
  }

  try {
    ensureTableExists(storeName);

    const insert = db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    );

    const batchInsert = db.transaction((items) => {
      let errorCount = 0;
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          const idUnik =
            item.id ||
            item.noPerk ||
            item.gol ||
            item.nomor ||
            `${storeName}_${i}`;
          insert.run(idUnik, JSON.stringify(item));
        } catch (rowErr) {
          console.error(`🚨 Baris ke-${i} gagal:`, rowErr.message);
          errorCount++;
        }
      }
      return errorCount;
    });

    const errorCount = batchInsert(data);

    console.log(
      `💥 [SUKSES] Batch [${storeName}]: ${data.length} data, Error: ${errorCount}`,
    );
    res.json({
      success: true,
      message: `Berhasil menyimpan ${data.length} data.`,
      total: data.length,
      errorCount,
    });
  } catch (error) {
    console.error("🚨 Batch error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// SAVE BATCH (/api/save-batch)
// ================================================================
app.post("/api/save-batch", (req, res) => {
  const { storeName, data } = req.body;

  if (!storeName || !Array.isArray(data) || data.length === 0) {
    return res.json({
      success: true,
      message: "Data kosong, dilewati.",
      changes: 0,
    });
  }

  try {
    ensureTableExists(storeName);

    const insert = db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    );

    const batchInsert = db.transaction((items) => {
      let errorCount = 0;
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          const idUnik =
            item.id ||
            item.noPerk ||
            item.gol ||
            item.nomor ||
            `${storeName}_${i}`;
          insert.run(idUnik, JSON.stringify(item));
        } catch (rowErr) {
          console.error(`🚨 Baris ke-${i} gagal:`, rowErr.message);
          errorCount++;
        }
      }
      return errorCount;
    });

    const errorCount = batchInsert(data);

    console.log(
      `💥 [SUKSES] Save-batch [${storeName}]: ${data.length} data, Error: ${errorCount}`,
    );
    res.json({
      success: true,
      message: `Berhasil menyimpan ${data.length} data.`,
      errorCount,
    });
  } catch (error) {
    console.error("🚨 Save-batch error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// START SERVER
// ================================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running di http://localhost:${PORT}`);
});
