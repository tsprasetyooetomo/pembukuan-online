// ============================================================================
// 1. ERROR HANDLING GLOBAL
// ============================================================================
process.on("uncaughtException", (err) => {
  console.error("🔥 CRITICAL SYSTEM ERROR:", err.message);
  console.error(err.stack);
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason) => {
  console.error("🔥 UNHANDLED PROMISE REJECTION:", reason);
});

// ============================================================================
// 2. IMPORT LIBRARY
// ============================================================================
let express, cors, path, Pool, multer, DBFFile, fs;

try {
  express = require("express");
  cors = require("cors");
  path = require("path");
  fs = require("fs");
  const { Pool: PgPool } = require("pg");
  Pool = PgPool;
  multer = require("multer");
  DBFFile = require("dbffile").DBFFile;
  console.log("✅ Semua library berhasil dimuat.");
} catch (e) {
  console.error("❌ FATAL: npm install pg multer dbffile");
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
// 4. KONFIGURASI SERVER
// ============================================================================
const serverPort = process.env.PORT || 8080;
const serverHost = "0.0.0.0";

const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Koneksi Postgres - ambil dari ENV Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

app.listen(Number(serverPort), serverHost, () => {
  console.log(`🚀 SERVER SUKSES START DI PORT: ${serverPort}`);
  console.log("⏳ Database siap...");
});

// ============================================================================
// 5. HELPER: BIKIN TABEL DINAMIS
// ============================================================================
async function createTableIfNotExists(tableName, fields) {
  const cols = fields
    .map((f) => {
      let type = "TEXT";
      if (f.type === "N") type = "NUMERIC";
      if (f.type === "D") type = "DATE";
      if (f.type === "L") type = "BOOLEAN";
      return `"${f.name}" ${type}`;
    })
    .join(", ");

  const sql = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
      kode_cabang TEXT,
      bulan TEXT,
      masa TEXT,
      tahun TEXT,
      ${cols}
    )
  `;
  await pool.query(sql);
}

// ============================================================================
// 6. ROUTE IMPOR FOXPRO
// ============================================================================
app.post(
  "/api/impor-foxpro-online",
  upload.fields([
    { name: "file_cdg", maxCount: 1 },
    { name: "file_cdd", maxCount: 1 },
  ]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { kode_cabang, tahun, bulan, masa } = req.body;
      if (!req.files.file_cdg || !req.files.file_cdd) {
        return res
          .status(400)
          .json({ success: false, message: "File CDG/CDD wajib ada" });
      }

      const fileCdg = req.files.file_cdg[0];
      const fileCdd = req.files.file_cdd[0];

      console.log(
        `📥 Proses: Cabang ${kode_cabang}, Bulan ${bulan}, Tahun ${tahun}`,
      );

      // 1. Baca DBF
      const dbfCdg = await DBFFile.open(fileCdg.path);
      const recordsCdg = await dbfCdg.readRecords();

      const dbfCdd = await DBFFile.open(fileCdd.path);
      const recordsCdd = await dbfCdd.readRecords();

      // 2. Bikin tabel golongan2026 & perkiraan2026
      const tableGolongan = `golongan${tahun}`;
      const tablePerkiraan = `perkiraan${tahun}`;

      await createTableIfNotExists(tableGolongan, dbfCdg.fields);
      await createTableIfNotExists(tablePerkiraan, dbfCdd.fields);

      // 3. Insert CDG
      if (recordsCdg.length > 0) {
        const cols = [
          "kode_cabang",
          "bulan",
          "masa",
          "tahun",
          ...dbfCdg.fields.map((f) => `"${f.name}"`),
        ];
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");

        await client.query("BEGIN");
        for (const row of recordsCdg) {
          const values = [
            kode_cabang,
            bulan,
            masa,
            tahun,
            ...dbfCdg.fields.map((f) => row[f.name]),
          ];
          await client.query(
            `INSERT INTO "${tableGolongan}" (${cols.join(",")}) VALUES (${placeholders})`,
            values,
          );
        }
        await client.query("COMMIT");
      }

      // 4. Insert CDD
      if (recordsCdd.length > 0) {
        const cols = [
          "kode_cabang",
          "bulan",
          "masa",
          "tahun",
          ...dbfCdd.fields.map((f) => `"${f.name}"`),
        ];
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");

        await client.query("BEGIN");
        for (const row of recordsCdd) {
          const values = [
            kode_cabang,
            bulan,
            masa,
            tahun,
            ...dbfCdd.fields.map((f) => row[f.name]),
          ];
          await client.query(
            `INSERT INTO "${tablePerkiraan}" (${cols.join(",")}) VALUES (${placeholders})`,
            values,
          );
        }
        await client.query("COMMIT");
      }

      // 5. Hapus file temp
      fs.unlinkSync(fileCdg.path);
      fs.unlinkSync(fileCdd.path);

      res.json({
        success: true,
        message: `Bulan ${bulan} berhasil diimpor ke Postgres`,
        tabel_golongan: tableGolongan,
        tabel_perkiraan: tablePerkiraan,
        total_golongan: recordsCdg.length,
        total_perkiraan: recordsCdd.length,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("🔥 Error impor:", err);
      res.status(500).json({ success: false, message: err.message });
    } finally {
      client.release();
    }
  },
);

// ============================================================================
// 6. DEFINISI TABEL LAIN
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

// Route Utama (Health Check) -> SEKARANG MENGGUNAKAN EXPRESS
//app.get("/", (req, res) => {
// res.send(`
//  <h1>✅ Sistem Pembukuan Online</h1>
// <p>Server Express berjalan dan Database Terhubung.</p>
// <p>Status: OK</p>
//`);
//});
// Route Utama (Otomatis buka HTML)
app.get("/", (req, res) => {
  try {
    // Arahkan langsung ke file HTML utama
    const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
    res.sendFile(htmlPath);
  } catch (error) {
    res.status(500).send("Gagal memuat halaman: " + error.message);
  }
});
app.get("/health", (req, res) => {
  res.send("OK");
});

// Route Serve HTML (Jika file ada)
app.get("/app", (req, res) => {
  try {
    const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
    res.sendFile(htmlPath);
  } catch (error) {
    res.status(500).send("Gagal memuat halaman pembukuan: " + error.message);
  }
});

// ============================================================================
// 6. INISIALISASI DATABASE SUPABASE
// ============================================================================

let connectionString = process.env.DATABASE_URL;
const manualSupabaseUrl =
  "postgresql://postgres.ortjujcvgjtfikeygbxi:supabase252118@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

if (!connectionString) {
  console.log("⚠️ Railway Gagal kirim Variabel. Menggunakan URL Manual...");
  connectionString = manualSupabaseUrl;
}

let db;

try {
  if (!connectionString) {
    throw new Error(
      "❌ FATAL DATABASE ERROR: Variabel DATABASE_URL tidak ditemukan!",
    );
  }

  console.log("📂 Menghubungkan ke Cloud Database Supabase...");
  console.log(
    "🔗 Connection String:",
    connectionString.replace(/:[^:@]+@/, ":****@"),
  );

  db = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  db.query("SELECT NOW()", (err, res) => {
    if (err) console.error("❌ Gagal koneksi awal ke DB:", err.message);
    else console.log("✅ Database Supabase Berhasil Terhubung!");
  });

  const initTable = async (tableName) => {
    try {
      const lowerTableName = tableName.toLowerCase();
      const checkQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`;
      const resCheck = await db.query(checkQuery, [lowerTableName]);
      const tableExists = resCheck.rows[0].exists;

      if (!tableExists) {
        console.log(`🛠️ Membuat tabel baru di Supabase: ${lowerTableName}`);
        if (tableName.match(/\d{4}$/)) {
          await db.query(
            `CREATE TABLE ${lowerTableName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data TEXT NOT NULL)`,
          );
        } else {
          await db.query(
            `CREATE TABLE ${lowerTableName} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
          );
        }
        console.log(`✅ Tabel ${lowerTableName} berhasil dibuat.`);
      } else {
        console.log(`ℹ️ Tabel ${lowerTableName} sudah ada.`);
      }
    } catch (e) {
      console.error(`⚠️ Gagal init tabel ${tableName}:`, e.message);
    }
  };

  (async () => {
    try {
      for (const table of ALLOWED_TABLES) {
        await initTable(table);
      }
      console.log("🚀 Sistem Siap!");
    } catch (loopErr) {
      console.error("❌ Gagal menjalankan loop tabel:", loopErr.message);
    }
  })();
} catch (err) {
  console.error(err.message);
}

module.exports = db;

// --- API ROUTES ---

// 1. RESET POSTING
app.post("/api/reset-posting", async (req, res) => {
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
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const t of tables) {
        try {
          const lowerTableName = t.toLowerCase();
          await client.query(
            `DELETE FROM ${lowerTableName} WHERE masa = $1 AND cabang = $2`,
            [masa, cabang],
          );
        } catch (e) {}
      }
      await client.query("COMMIT");
    } catch (transactionError) {
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      client.release();
    }
    res.json({ success: true, message: "Reset selesai" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 2. CLEAR ALL DATA
app.post("/api/clear-all-data", async (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName, masa, cabang } = req.body;
    if (!storeName || !isValidTable(storeName))
      return res
        .status(403)
        .json({ success: false, message: "Tabel tidak valid" });
    const lowerStoreName = storeName.toLowerCase();
    let sql = `DELETE FROM ${lowerStoreName}`;
    let params = [];
    const colCheckQuery = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'masa';`;
    const colResult = await db.query(colCheckQuery, [lowerStoreName]);
    const hasMasa = colResult.rows.length > 0;
    if (hasMasa && masa && cabang) {
      sql += ` WHERE masa = $1 AND cabang = $2`;
      params = [masa, cabang];
    }
    const info = await db.query(sql, params);
    res.json({ success: true, changes: info.rowCount || 0 });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 3. GET ALL DATA
app.get("/api/data/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const lowerStoreName = storeName.toLowerCase();
    const result = await db.query(`SELECT data FROM ${lowerStoreName}`);
    res.json(
      result.rows.map((r) =>
        typeof r.data === "string" ? JSON.parse(r.data) : r.data,
      ),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. GET BY ID
app.get("/api/data/:storeName/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const lowerStoreName = storeName.toLowerCase();
    const result = await db.query(
      `SELECT data FROM ${lowerStoreName} WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (row) {
      const parsedData =
        typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      res.json(parsedData);
    } else {
      res.status(404).json({ error: "Not Found" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. POST DATA
app.post("/api/data/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const data = req.body;
    if (!data.id) return res.status(400).json({ error: "ID Required" });
    const lowerStoreName = storeName.toLowerCase();
    await db.query(
      `INSERT INTO ${lowerStoreName} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [data.id, JSON.stringify(data)],
    );
    res.status(201).json({ message: "Created" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. PUT DATA (BY ID)
app.put("/api/data/:storeName/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const lowerStoreName = storeName.toLowerCase();
    const result = await db.query(
      `SELECT data FROM ${lowerStoreName} WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    let merged = row
      ? {
          ...(typeof row.data === "string" ? JSON.parse(row.data) : row.data),
          ...req.body,
        }
      : req.body;
    merged.id = id;
    await db.query(`UPDATE ${lowerStoreName} SET data = $1 WHERE id = $2`, [
      JSON.stringify(merged),
      id,
    ]);
    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. PUT UPSERT
app.put("/api/data/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const data = req.body;
    if (!data.id) return res.status(400).json({ error: "ID Required" });
    const lowerStoreName = storeName.toLowerCase();
    const result = await db.query(
      `SELECT data FROM ${lowerStoreName} WHERE id = $1`,
      [data.id],
    );
    const row = result.rows[0];
    let merged = row
      ? {
          ...(typeof row.data === "string" ? JSON.parse(row.data) : row.data),
          ...data,
        }
      : data;
    await db.query(
      `INSERT INTO ${lowerStoreName} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [data.id, JSON.stringify(merged)],
    );
    res.json({ message: "Upserted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8. DELETE ONE
app.delete("/api/data/:storeName/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const lowerStoreName = storeName.toLowerCase();
    await db.query(`DELETE FROM ${lowerStoreName} WHERE id = $1`, [id]);
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 9. DELETE ALL
app.delete("/api/data/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const lowerStoreName = storeName.toLowerCase();
    await db.query(`DELETE FROM ${lowerStoreName}`);
    res.json({ message: "Cleared" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 10. COUNT
app.get("/api/count/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const lowerStoreName = storeName.toLowerCase();
    const result = await db.query(
      `SELECT COUNT(id) as total FROM ${lowerStoreName}`,
    );
    const row = result.rows[0];
    res.json(row ? Number(row.total) : 0);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 11. BACKUP
app.get("/api/backup", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    let backupData = {};
    for (const t of ALLOWED_TABLES) {
      try {
        const lowerTableName = t.toLowerCase();
        const result = await db.query(`SELECT data FROM ${lowerTableName}`);
        backupData[t] = result.rows.map((r) =>
          typeof r.data === "string" ? JSON.parse(r.data) : r.data,
        );
      } catch (e) {
        console.warn(`⚠️ Gagal backup tabel ${t}:`, e.message);
        backupData[t] = [];
      }
    }
    res.setHeader("Content-Disposition", "attachment; filename=backup.json");
    res.json(backupData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 12. BATCH
app.post("/api/batch/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName } = req.params;
    const data = req.body;
    if (!Array.isArray(data))
      return res.json({ success: true, message: "No data" });
    const lowerStoreName = storeName.toLowerCase();

    const checkQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`;
    const resCheck = await db.query(checkQuery, [lowerStoreName]);
    const tableExists = resCheck.rows[0].exists;

    if (!tableExists && storeName.match(/\d{4}$/)) {
      console.log(`🛠️ Auto-create tabel tahunan: ${lowerStoreName}`);
      await db.query(
        `CREATE TABLE ${lowerStoreName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data TEXT NOT NULL)`,
      );
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const queryText = `INSERT INTO ${lowerStoreName} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
      for (const item of data) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${lowerStoreName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await client.query(queryText, [id, JSON.stringify(item)]);
      }
      await client.query("COMMIT");
    } catch (transactionError) {
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      client.release();
    }
    res.json({ success: true, count: data.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 13. SAVE BATCH
app.post("/api/save-batch", async (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName, data } = req.body;
    if (!storeName || !Array.isArray(data)) return res.json({ success: true });
    const lowerStoreName = storeName.toLowerCase();

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const queryText = `INSERT INTO ${lowerStoreName} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
      for (const item of data) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${lowerStoreName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await client.query(queryText, [id, JSON.stringify(item)]);
      }
      await client.query("COMMIT");
    } catch (transactionError) {
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      client.release();
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 14. SALDO HARIAN CLEAR RANGE
app.post("/api/saldo-harian/clear-range", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { cabang, char4, tanggalAwal, tanggalAkhir } = req.body;
    if (!tanggalAwal || !tanggalAkhir)
      return res.status(400).json({ error: "Date Required" });
    const sql = `DELETE FROM saldo_harian WHERE data->>'cabang' = $1 AND data->>'char4' = $2 AND data->>'tanggal' BETWEEN $3 AND $4`;
    await db.query(sql, [
      cabang || "Pusat",
      char4 || " ",
      tanggalAwal,
      tanggalAkhir,
    ]);
    res.json({ message: "Cleared" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 15. SNAPSHOT SALDO (DIPERBAIKI)
app.post("/api/saldo-harian", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;
    if (!tanggal) return res.status(400).json({ error: "Date Required" });
    const id = `${cabang}_${char4}_${tanggal}`;
    const jsonData = JSON.stringify({ cabang, char4, tanggal, saldo_akhir });

    await db.query(
      `INSERT INTO saldo_harian (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [id, jsonData],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message }); // DIPERBAIKI: Kurung tutup yang benar
  }
});
