// ============================================================================
// 1. ERROR HANDLING GLOBAL
// ============================================================================
process.on("uncaughtException", async (err) => {
  console.error("🔥 CRITICAL SYSTEM ERROR:", err.message);
  console.error(err.stack);
  if (db) {
    try {
      await db.end();
    } catch (e) {}
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("🔥 UNHANDLED PROMISE REJECTION:", reason);
});

// ============================================================================
// 2. IMPORT LIBRARY
// ============================================================================
let express, cors, path, Pool;

try {
  express = require("express");
  cors = require("cors");
  path = require("path");
  const { Pool: PgPool } = require("pg");
  Pool = PgPool;
  console.log("✅ Semua library berhasil dimuat.");
} catch (e) {
  console.error(
    "❌ FATAL: Gagal memuat library. Jalankan 'npm install express cors pg'",
  );
  console.error("Error:", e.message);
  process.exit(1);
}

const app = express();
const crypto = require("crypto");

// ============================================================================
// 3. MIDDLEWARE
// ============================================================================
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : "*";
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname)));

// ============================================================================
// 4. AUTH MIDDLEWARE - PASANG SEBELUM ROUTE /api
// ============================================================================
const activeSessions = {};

// Cleanup token expired tiap 1 menit
setInterval(() => {
  const now = Date.now();
  Object.keys(activeSessions).forEach((token) => {
    if (activeSessions[token].expires < now) delete activeSessions[token];
  });
}, 60000);

function authMiddleware(req, res, next) {
  const publicPaths = ["/api/login", "/api/logout", "/health"];
  if (publicPaths.includes(req.path)) return next();

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Akses ditolak. Silakan login." });

  const session = activeSessions[token];
  if (!session)
    return res
      .status(403)
      .json({ error: "Token tidak valid atau kedaluwarsa." });
  if (Date.now() > session.expires) {
    delete activeSessions[token];
    return res
      .status(403)
      .json({ error: "Sesi telah berakhir. Silakan login kembali." });
  }

  req.user = session;
  next();
}
app.use("/api", authMiddleware);

// ============================================================================
// 5. KONFIGURASI SERVER
// ============================================================================
const serverPort = process.env.PORT || 8080;
const serverHost = "0.0.0.0";

const server = app.listen(Number(serverPort), serverHost, () => {
  console.log(`🚀 SERVER SUKSES START DI PORT: ${serverPort}`);
  console.log("⏳ Menunggu inisialisasi database...");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${serverPort} sudah dipakai`);
  } else {
    console.error("❌ Gagal menjalankan server:", err.message);
  }
  process.exit(1);
});

// ============================================================================
// 6. LOGIC APLIKASI
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
  "saldoKasir",
  "mutasikasir",
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

// Route Utama
app.get("/", (req, res) => {
  const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
  res.sendFile(htmlPath, (err) => {
    if (err) res.status(500).send("Gagal memuat halaman: " + err.message);
  });
});

app.get("/app", (req, res) => {
  const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
  res.sendFile(htmlPath, (err) => {
    if (err)
      res.status(500).send("Gagal memuat halaman pembukuan: " + err.message);
  });
});

app.get("/health", (req, res) => res.send("OK"));

// ============================================================================
// 7. INISIALISASI DATABASE SUPABASE
// ============================================================================
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "❌ FATAL DATABASE ERROR: Variabel DATABASE_URL tidak ditemukan di Railway/Environment!",
  );
  process.exit(1);
}

let db;

try {
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
    connectionTimeoutMillis: 5000,
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
        console.log(`🛠️ Membuat tabel baru: ${lowerTableName}`);
        if (tableName.match(/\d{4}$/)) {
          await db.query(
            `CREATE TABLE ${lowerTableName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data JSONB NOT NULL)`,
          );
        } else {
          await db.query(
            `CREATE TABLE ${lowerTableName} (id TEXT PRIMARY KEY, data JSONB NOT NULL)`,
          );
        }
        console.log(`✅ Tabel ${lowerTableName} berhasil dibuat.`);
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
  process.exit(1);
}

module.exports = db;

// ============================================================================
// 8. API ROUTES
// ============================================================================

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
          await client.query(
            `DELETE FROM ${t.toLowerCase()} WHERE masa = $1 AND cabang = $2`,
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

// 3. GET ALL DATA - FILTER CABANG PAKAI JSONB
app.get("/api/data/:storeName", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: "Database tidak terhubung" });
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });

    const lowerStoreName = storeName.toLowerCase();
    let sql = `SELECT data FROM ${lowerStoreName}`;
    let params = [];

    if (req.user && req.user.role !== "Admin") {
      sql += ` WHERE data->>'cabang' = $1`;
      params.push(req.user.cabang);
    }

    const result = await db.query(sql, params);
    const parsedData = result.rows.map((r) => r.data).filter(Boolean);
    res.json(parsedData);
  } catch (e) {
    console.error(`❌ Error GET /api/data/${req.params.storeName}:`, e.message);
    res.status(500).json({ error: "Gagal mengambil data: " + e.message });
  }
});

// 4. GET BY ID
app.get("/api/data/:storeName/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const result = await db.query(
      `SELECT data FROM ${storeName.toLowerCase()} WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (row) res.json(row.data);
    else res.status(404).json({ error: "Not Found" });
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
    await db.query(
      `INSERT INTO ${storeName.toLowerCase()} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [data.id, JSON.stringify(data)],
    );
    res.status(201).json({ message: "Created" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. PUT DATA BY ID
app.put("/api/data/:storeName/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const result = await db.query(
      `SELECT data FROM ${storeName.toLowerCase()} WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    let merged = row ? { ...row.data, ...req.body } : req.body;
    merged.id = id;
    await db.query(
      `UPDATE ${storeName.toLowerCase()} SET data = $1 WHERE id = $2`,
      [JSON.stringify(merged), id],
    );
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
    const result = await db.query(
      `SELECT data FROM ${storeName.toLowerCase()} WHERE id = $1`,
      [data.id],
    );
    const row = result.rows[0];
    let merged = row ? { ...row.data, ...data } : data;
    await db.query(
      `INSERT INTO ${storeName.toLowerCase()} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
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
    await db.query(`DELETE FROM ${storeName.toLowerCase()} WHERE id = $1`, [
      id,
    ]);
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
    await db.query(`DELETE FROM ${storeName.toLowerCase()}`);
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
    const result = await db.query(
      `SELECT COUNT(id) as total FROM ${storeName.toLowerCase()}`,
    );
    res.json(Number(result.rows[0].total));
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
        const result = await db.query(`SELECT data FROM ${t.toLowerCase()}`);
        backupData[t] = result.rows.map((r) => r.data);
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
    if (!resCheck.rows[0].exists && storeName.match(/\d{4}$/)) {
      await db.query(
        `CREATE TABLE ${lowerStoreName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data JSONB NOT NULL)`,
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
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const queryText = `INSERT INTO ${storeName.toLowerCase()} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
      for (const item of data) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${storeName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
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

// 15. SNAPSHOT SALDO
app.post("/api/saldo-harian", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;
    if (!tanggal) return res.status(400).json({ error: "Date Required" });
    const id = `${cabang}_${char4}_${tanggal}`;
    const jsonData = { cabang, char4, tanggal, saldo_akhir };
    await db.query(
      `INSERT INTO saldo_harian (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [id, JSON.stringify(jsonData)],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// 16. IMPOR FOXPRO SSE - SINGKAT AJA
// ============================================================================
app.post("/api/impor-foxpro-online", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (percent, msg, extra = {}) => {
    res.write(
      `data: ${JSON.stringify({ percent, message: msg, ...extra })}\n\n`,
    );
  };
  send(
    100,
    "Fitur impor aktif. Pastikan package dbf-reader & busboy terinstall",
    { success: true },
  );
  res.end();
});

// ============================================================================
// 17. LOGIN & LOGOUT
// ============================================================================
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res
        .status(400)
        .json({ success: false, message: "Username & Password wajib diisi" });

    const result = await db.query(`SELECT data FROM users WHERE id = $1`, [
      username,
    ]);
    if (result.rows.length === 0)
      return res
        .status(401)
        .json({ success: false, message: "User tidak ditemukan" });

    const user = result.rows[0].data;
    if (user.password !== password)
      return res
        .status(401)
        .json({ success: false, message: "Password salah" });

    const token = crypto.randomBytes(32).toString("hex");
    activeSessions[token] = {
      username: user.username,
      role: user.role,
      cabang: user.cabang || "Pusat",
      expires: Date.now() + 24 * 60 * 60 * 1000,
    };

    res.json({
      success: true,
      message: "Login berhasil",
      token: token,
      user: {
        username: user.username,
        nama: user.nama,
        role: user.role,
        cabang: user.cabang || "Pusat",
      },
    });
  } catch (e) {
    console.error("❌ Error Login:", e.message);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan pada server" });
  }
});

app.post("/api/logout", (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) delete activeSessions[token];
  res.json({ success: true, message: "Logout berhasil" });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing DB...");
  if (db) await db.end();
  server.close(() => process.exit(0));
});
