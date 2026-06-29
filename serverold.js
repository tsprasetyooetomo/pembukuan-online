// ============================================================================
// 1. ERROR HANDLING GLOBAL (PALING ATAS)
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
let express, cors, path, Pool, crypto;

try {
  express = require("express");
  cors = require("cors");
  path = require("path");
  const { Pool: PgPool } = require("pg");
  Pool = PgPool;
  crypto = require("crypto");
  console.log("✅ Semua library berhasil dimuat.");
} catch (e) {
  console.error(
    "❌ FATAL: Gagal memuat library. Pastikan 'npm install pg' sudah dijalankan.",
  );
  console.error("Error:", e.message);
  process.exit(1);
}

const app = express();

// ============================================================================
// 3. MIDDLEWARE EXPRESS DASAR (WAJIB DI ATAS SEMUA ROUTE)
// ============================================================================
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname)));

// ============================================================================
// 4. INISIALISASI DATABASE SUPABASE (DB HARUS ADA SEBELUM ROUTE)
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
  if (!connectionString)
    throw new Error(
      "❌ FATAL DATABASE ERROR: Variabel DATABASE_URL tidak ditemukan!",
    );
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
} catch (err) {
  console.error(err.message);
}

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

// ============================================================================
// 5. SISTEM LOGIN & AUTHORIZATION (WAJIB DI ATAS ROUTE API)
// ============================================================================
const activeSessions = {};

function authMiddleware(req, res, next) {
  if (
    req.originalUrl === "/api/login" ||
    req.originalUrl === "/api/logout" ||
    req.originalUrl === "/health" ||
    req.originalUrl === "/" ||
    req.originalUrl === "/app" ||
    req.originalUrl.startsWith("/api/impor-foxpro-online")
  ) {
    return next();
  }

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

// Pasang middleware auth KESEMUA route /api
app.use("/api", authMiddleware);

// ENDPOINT LOGIN
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

    const user =
      typeof result.rows[0].data === "string"
        ? JSON.parse(result.rows[0].data)
        : result.rows[0].data;

    if (user.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Password salah" });
    }

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

// ENDPOINT LOGOUT
app.post("/api/logout", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token) delete activeSessions[token];
  res.json({ success: true, message: "Logout berhasil" });
});

// ============================================================================
// 6. ROUTE APLIKASI & HTML
// ============================================================================
app.get("/", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "pembukuan_telaga.html"));
  } catch (error) {
    res.status(500).send("Gagal memuat halaman: " + error.message);
  }
});

app.get("/health", (req, res) => {
  res.send("OK");
});

app.get("/app", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "pembukuan_telaga.html"));
  } catch (error) {
    res.status(500).send("Gagal memuat halaman pembukuan: " + error.message);
  }
});

// ============================================================================
// 7. API ROUTES (SEMUANYA SUDAH LEWAT AUTH MIDDLEWARE)
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

// 3. GET ALL DATA (FILTER CABANG)
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
      sql += ` WHERE data::text LIKE $1`;
      params.push(`%"cabang":"${req.user.cabang}"%`);
    }
    const result = await db.query(sql, params);
    const parsedData = result.rows
      .map((r) => {
        try {
          return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
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

// 15. SNAPSHOT SALDO
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
    res.status(500).json({ error: e.message });
  }
});

// 16. ENDPOINT IMPOR FOXPRO
app.post("/api/impor-foxpro-online", async (req, res) => {
  if (!db) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(
      `data: ${JSON.stringify({ percent: 100, message: "Database tidak terkoneksi", success: false })}\n\n`,
    );
    return res.end();
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const send = (percent, msg, extra = {}) => {
    res.write(
      `data: ${JSON.stringify({ percent, message: msg, ...extra })}\n\n`,
    );
  };
  try {
    const busboy = require("busboy");
    const bb = busboy({ headers: req.headers });
    const files = {};
    const fields = {};
    bb.on("file", (name, file) => {
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        files[name] = Buffer.concat(chunks);
      });
    });
    bb.on("field", (name, val) => {
      fields[name] = val;
    });
    bb.on("finish", async () => {
      try {
        const { kode_cabang, tahun, bulan, masa } = fields;
        const fileCdg = files["file_cdg"];
        const fileCdd = files["file_cdd"];
        const fileDet = files["file_det"];
        if (!fileCdg || !fileCdd) {
          send(100, "File CDG atau CDD tidak ditemukan", { success: false });
          return res.end();
        }
        send(5, `Mulai impor masa ${masa} cabang ${kode_cabang}`);
        const { Dbf } = require("dbf-reader");
        send(10, "Baca file CDG...");
        const dataCdg = Dbf.read(fileCdg)?.rows || [];
        send(20, `CDG terbaca: ${dataCdg.length} record`);
        send(25, "Baca file CDD...");
        const dataCdd = Dbf.read(fileCdd)?.rows || [];
        send(40, `CDD terbaca: ${dataCdd.length} record`);
        let dataDet = [];
        if (fileDet) {
          send(45, "Baca file DET...");
          dataDet = Dbf.read(fileDet)?.rows || [];
          send(55, `DET terbaca: ${dataDet.length} record`);
        }
        const tableGolongan = `golongan${tahun}`.toLowerCase();
        const tablePerkiraan = `perkiraan${tahun}`.toLowerCase();
        const tableTransaksi = `transaksi${tahun}`.toLowerCase();
        const client = await db.connect();
        try {
          await client.query("BEGIN");
          const ensureTableExists = async (tableName) => {
            const checkQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`;
            const resCheck = await client.query(checkQuery, [tableName]);
            if (!resCheck.rows[0].exists) {
              send(58, `Buat tabel ${tableName}...`);
              await client.query(
                `CREATE TABLE ${tableName} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
              );
            }
          };
          await ensureTableExists(tableGolongan);
          await ensureTableExists(tablePerkiraan);
          await ensureTableExists(tableTransaksi);
          const batchInsert = async (
            tableName,
            dataArray,
            typePrefix,
            startPct,
            endPct,
          ) => {
            if (dataArray.length === 0) return 0;
            const batchSize = 500;
            let totalInserted = 0;
            const totalBatch = Math.ceil(dataArray.length / batchSize);
            await client.query(
              `DELETE FROM ${tableName} WHERE data LIKE $1 AND data LIKE $2`,
              [`%"masa":"${masa}"%`, `%"cabang":"${kode_cabang}"%`],
            );
            send(startPct, `Hapus data lama ${typePrefix}...`);
            for (let i = 0; i < dataArray.length; i += batchSize) {
              const batch = dataArray.slice(i, i + batchSize);
              let queryText = `INSERT INTO ${tableName} (id, data) VALUES `;
              let values = [];
              let placeholders = [];
              batch.forEach((row, index) => {
                let mappedData = {};
                let customId = "";
                const getStr = (val) =>
                  val !== undefined && val !== null ? String(val).trim() : "";
                const getNum = (val) =>
                  val !== undefined && val !== null ? Number(val) : 0;
                if (typePrefix === "CDG") {
                  mappedData = {
                    gol: getStr(row.GOLACCT),
                    namaGol: getStr(row.PJLSAN),
                    tipe: "Golongan",
                    masa: masa,
                    awal: getNum(row.AWAL),
                    db: getNum(row.DB),
                    cr: getNum(row.CR),
                    akhir: getNum(row.AKHIR),
                    cabang: getStr(row.REST) || kode_cabang,
                  };
                  customId = `CDG_${mappedData.cabang}_${masa}_${mappedData.gol || "X"}_${i + index}`;
                } else if (typePrefix === "CDD") {
                  mappedData = {
                    gol: getStr(row.GOLACCT),
                    noPerk: getStr(row.SUBACCT),
                    desc: getStr(row.PJLSAN),
                    tipe: "Perkiraan",
                    masa: masa,
                    awal: getNum(row.AWAL),
                    db: getNum(row.DB),
                    cr: getNum(row.CR),
                    akhir: getNum(row.AKHIR),
                    cabang: getStr(row.REST) || kode_cabang,
                  };
                  const cleanNoPerk =
                    mappedData.noPerk.replace(/\./g, "_") || "X";
                  customId = `CDD_${mappedData.cabang}_${masa}_${cleanNoPerk}_${i + index}`;
                } else if (typePrefix === "DET") {
                  const dbVal = getNum(row.DB);
                  const crVal = getNum(row.CR);
                  customId = `${crypto.randomUUID()}_${i + index}`;
                  mappedData = {
                    id: customId,
                    noreff: getStr(row.REFF),
                    tanggal: getStr(row.DATE),
                    kodeBank: "",
                    cabang: getStr(row.KODE) || kode_cabang,
                    dariKePada: "BANK",
                    noperkiraan: getStr(row.NOACCT),
                    desc: getStr(row.DESC),
                    total: dbVal + crVal,
                    db: dbVal,
                    cr: crVal,
                    kodeTrans: "",
                    masa: masa,
                  };
                }
                const base = index * 2;
                placeholders.push(`($${base + 1}, $${base + 2})`);
                values.push(customId, JSON.stringify(mappedData));
              });
              queryText += placeholders.join(", ");
              queryText += ` ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
              await client.query(queryText, values);
              totalInserted += batch.length;
              const currentBatch = Math.floor(i / batchSize) + 1;
              const pct =
                startPct + ((endPct - startPct) * currentBatch) / totalBatch;
              send(
                Math.round(pct),
                `Insert ${typePrefix}: ${totalInserted}/${dataArray.length}`,
              );
            }
            return totalInserted;
          };
          send(60, "Mulai insert database...");
          const countCdg = await batchInsert(
            tableGolongan,
            dataCdg,
            "CDG",
            60,
            75,
          );
          const countCdd = await batchInsert(
            tablePerkiraan,
            dataCdd,
            "CDD",
            75,
            90,
          );
          const countDet = await batchInsert(
            tableTransaksi,
            dataDet,
            "DET",
            90,
            98,
          );
          await client.query("COMMIT");
          send(
            100,
            `Sukses! Golongan:${countCdg} Perkiraan:${countCdd} Transaksi:${countDet}`,
            {
              success: true,
              tables: {
                golongan: tableGolongan,
                perkiraan: tablePerkiraan,
                transaksi: tableTransaksi,
              },
            },
          );
          res.end();
        } catch (txError) {
          await client.query("ROLLBACK");
          send(100, "Gagal simpan DB: " + txError.message, { success: false });
          res.end();
        } finally {
          client.release();
        }
      } catch (innerErr) {
        send(100, "Error: " + innerErr.message, { success: false });
        res.end();
      }
    });
    req.pipe(bb);
  } catch (error) {
    send(100, "Error: " + error.message, { success: false });
    res.end();
  }
});

// ============================================================================
// 8. START SERVER
// ============================================================================
const serverPort = process.env.PORT || 8080;
const serverHost = "0.0.0.0";

(async () => {
  try {
    for (const table of ALLOWED_TABLES) {
      const lowerTableName = table.toLowerCase();
      const checkQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`;
      const resCheck = await db.query(checkQuery, [lowerTableName]);
      if (!resCheck.rows[0].exists) {
        console.log(`🛠️ Membuat tabel baru di Supabase: ${lowerTableName}`);
        if (table.match(/\d{4}$/)) {
          await db.query(
            `CREATE TABLE ${lowerTableName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, data TEXT NOT NULL)`,
          );
        } else {
          await db.query(
            `CREATE TABLE ${lowerTableName} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
          );
        }
        console.log(`✅ Tabel ${lowerTableName} berhasil dibuat.`);
      }
    }
  } catch (loopErr) {
    console.error("❌ Gagal menjalankan loop tabel:", loopErr.message);
  }
})();

try {
  app.listen(Number(serverPort), serverHost, () => {
    console.log(`🚀 SERVER SUKSES START DI PORT: ${serverPort}`);
  });
} catch (err) {
  console.error("❌ Gagal menjalankan server:", err.message);
  process.exit(1);
}

module.exports = db;
// KURUNG } NGANGGUR TELAH DIHAPUS
