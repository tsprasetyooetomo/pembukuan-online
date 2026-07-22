// ============================================================================
// IMPORT YANG WAJIB ADA DI PALING ATAS
// ============================================================================
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const { json } = require("stream/consumers");

// Inisialisasi Express
const app = express();
// ============================================
// TAMBAHKAN INI - Untuk melayani file CSS & JS
// ============================================
app.use(express.static(__dirname));

// Middleware wajib untuk membaca body request
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// 5. LOGIC APLIKASI (ROUTES & DATABASE)
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
  "groupproject",
  "saldoKasir",
  "mutasikasir",
  "saldokasirawal",
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

// ============================================================================
// API ROUTE: LOGIN SYSTEM (BACA DARI STRUKTUR KOLOM DATA JSON)
// ============================================================================
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Username & password kosong" });
    }

    // 1. Ambil semua baris dari tabel 'users' menggunakan variabel 'db' Anda
    const result = await db.query("SELECT data FROM users");

    let userDitemukan = null;

    // 2. Lakukan looping karena data disimpan di dalam objek kolom 'data'
    for (let i = 0; i < result.rows.length; i++) {
      // Pastikan data di-parse jika tipenya masih string teks, atau langsung dibaca jika tipe JSONB
      const rowData =
        typeof result.rows[i].data === "string"
          ? JSON.parse(result.rows[i].data)
          : result.rows[i].data;

      // Cocokkan username (abaikan huruf besar/kecil)
      if (
        rowData &&
        rowData.username &&
        rowData.username.toLowerCase() === username.toLowerCase()
      ) {
        userDitemukan = rowData;
        break;
      }
    }

    // 3. Cek apakah user ada
    if (!userDitemukan) {
      return res
        .status(401)
        .json({ success: false, message: "Username tidak terdaftar" });
    }

    // 4. Cocokkan password
    if (userDitemukan.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Password yang dimasukkan salah" });
    }

    // 5. Sukses! Kirim balik data untuk ditangkap oleh app_login.js frontend
    return res.json({
      success: true,
      token: "jwt_" + userDitemukan.username + "_" + Date.now(),
      user: {
        nama: userDitemukan.nama || userDitemukan.username,
        kode_cabang: userDitemukan.kode_cabang || userDitemukan.cabang || "00",
        role: userDitemukan.role || "ADMIN", // Jika di DB kosong, defaultnya ADMIN
      },
    });
  } catch (error) {
    console.error("🔥 ERROR LOGIN API:", error.message);
    res.status(500).json({
      success: false,
      message: "Terjadi error di serverold.js: " + error.message,
    });
  }
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
    const { storeName, masa, cabang, tahun, bulan } = req.body;

    if (!storeName || !isValidTable(storeName))
      return res
        .status(403)
        .json({ success: false, message: "Tabel tidak valid" });

    const lowerStoreName = storeName.toLowerCase();
    let sql = `DELETE FROM ${lowerStoreName}`;
    let params = [];

    // ✅ LOGIKA KHUSUS UNTUK MUTASI KASIR (AMAN UNTUK TEKS ATAU JSONB)
    if (lowerStoreName === "mutasikasir") {
      let conditions = [];
      let paramIndex = 1;

      // 1. Filter Noreff
      if (req.body.noreff) {
        conditions.push(`CAST(data AS jsonb)->>'noreff' = $${paramIndex++}`);
        params.push(req.body.noreff);
      }

      // 2. Filter Cabang
      if (cabang) {
        conditions.push(`CAST(data AS jsonb)->>'cabang' = $${paramIndex++}`);
        params.push(cabang);
      }

      // ✅ TAMBAHKAN FILTER GROUP (LETAKKAN DI SINI)
      if (req.body.group) {
        conditions.push(`CAST(data AS jsonb)->>'group' = $${paramIndex++}`);
        params.push(req.body.group);
      }

      // 3. Filter Tahun & Bulan
      if (tahun && tahun !== "") {
        if (bulan && bulan !== "") {
          conditions.push(
            `CAST(data AS jsonb)->>'tanggal' LIKE $${paramIndex++}`,
          );
          params.push(`${tahun}-${bulan}%`);
        } else {
          conditions.push(
            `CAST(data AS jsonb)->>'tanggal' LIKE $${paramIndex++}`,
          );
          params.push(`${tahun}%`);
        }
      }

      if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
      }
    }
    // LOGIKA LAMA UNTUK TABEL TAHUNAN (Golongan, Perkiraan, Transaksi)
    else {
      const colCheckQuery = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'masa';`;
      const colResult = await db.query(colCheckQuery, [lowerStoreName]);
      const hasMasa = colResult.rows.length > 0;
      if (hasMasa && masa && cabang) {
        sql += ` WHERE masa = $1 AND cabang = $2`;
        params = [masa, cabang];
      }
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
    const filterCabang = req.query.cabang;
    const filterGroup = req.query.group; // ✅ 1. TANGKAP PARAMETER GROUP DARI FRONTEND

    if (!isValidTable(storeName)) {
      return res.status(400).json({ error: "Invalid Table" });
    }

    const lowerStoreName = storeName.toLowerCase();

    // Tabel yang wajib difilter (TAMBAHKAN GROUP KE DALAM LOGIKA)
    // ==========================================
    // LOGIKA FILTER BARU (CABANG & GROUP BERDIRI SENDIRI)
    // ==========================================
    let whereClause = "";
    let params = [];
    let paramIndex = 1;

    // 1. Filter Cabang (Jika bukan PUSAT)
    if (
      filterCabang &&
      filterCabang.trim() !== "" &&
      filterCabang.toUpperCase() !== "PUSAT"
    ) {
      if (!/^[a-zA-Z0-9\-_ ]+$/.test(filterCabang)) {
        return res.status(400).json({ error: "Kode cabang tidak valid" });
      }
      whereClause = `(data LIKE $${paramIndex++} OR data LIKE $${paramIndex++} OR data LIKE $${paramIndex++} OR data LIKE $${paramIndex++})`;
      params.push(
        `%"cabang":"${filterCabang}"%`,
        `%"cabang": "${filterCabang}"%`,
        `%"kode_cabang":"${filterCabang}"%`,
        `%"kode_cabang": "${filterCabang}%`,
      );
    }

    // 2. Filter Group (Berlaku untuk SEMUA, termasuk PUSAT)
    if (filterGroup && filterGroup.trim() !== "") {
      if (!/^[a-zA-Z0-9\-_ ]+$/.test(filterGroup)) {
        return res.status(400).json({ error: "Kode group tidak valid" });
      }

      const groupCondition = `(data LIKE $${paramIndex++} OR data LIKE $${paramIndex++})`;
      params.push(`%"group":"${filterGroup}"%`, `%"group": "${filterGroup}%`);

      // Gabungkan dengan WHERE sebelumnya menggunakan AND
      if (whereClause === "") {
        whereClause = groupCondition;
      } else {
        whereClause += " AND " + groupCondition;
      }
    }

    // 3. Eksekusi Query SQL
    let sql = `SELECT data FROM ${lowerStoreName}`;
    if (whereClause !== "") {
      sql += ` WHERE ${whereClause}`;
    }

    var result = await db.query(sql, params);
    console.log(
      `System: SQL Fetch | Tabel ${lowerStoreName} | Cabang: ${filterCabang || "ALL"} | Group: ${filterGroup || "ALL"} | Ditemukan: ${result.rows.length} baris`,
    );

    // Parsing semua baris
    const allData = result.rows.map((r) =>
      typeof r.data === "string" ? JSON.parse(r.data) : r.data,
    );

    res.json(allData);
  } catch (e) {
    console.error("🔥 ERROR FETCH DATA API:", e.message);
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
    const lowerStoreName = storeName.toLowerCase(); // ✅ PINDAHKAN KE ATAS

    // ✅ CEK MENGGUNAKAN YANG SUDAH DI-LOWERCASE
    if (!isValidTable(lowerStoreName)) {
      return res.status(400).json({ error: "Invalid Table" });
    }

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
// PAKAI KODE INI:
app.post("/api/saldo-harian/clear-range", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { tanggalAwal, tanggalAkhir } = req.body; // ✅ Tidak pakai cabang & char4 lagi
    if (!tanggalAwal || !tanggalAkhir)
      return res.status(400).json({ error: "Date Required" });

    // ✅ LOGIKA BARU: Hapus berdasarkan rentang tanggal di dalam format JSON
    const sql = `DELETE FROM saldo_harian WHERE CAST(data AS jsonb)->>'tanggal' >= $1 AND CAST(data AS jsonb)->>'tanggal' <= $2`;
    await db.query(sql, [tanggalAwal, tanggalAkhir]);

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
// Tambahkan ini di file routing backend Anda (misalnya index.js atau app.js)
app.post("/api/saldo-kasir/clear-range", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });

  try {
    const { cabang, tanggalAwal, tanggalAkhir, group } = req.body;

    if (!cabang || !tanggalAwal || !tanggalAkhir || !group) {
      return res.status(400).json({ message: "Parameter tidak lengkap" });
    }

    const matchObj = JSON.stringify({
      cabang: cabang,
      group: group.trim().toUpperCase(),
    });

    // Perhatikan ada CAST() di setiap pemanggilan "data"
    const sql = `
      DELETE FROM saldokasir 
      WHERE CAST("data" AS jsonb) @> $1::jsonb 
        AND CAST("data" AS jsonb)->>'tanggal' >= $2 
        AND CAST("data" AS jsonb)->>'tanggal' <= $3
    `;

    await db.query(sql, [matchObj, tanggalAwal, tanggalAkhir]);

    res.json({ message: "Range saldo kasir berhasil dihapus (TEXT to JSONB)" });
  } catch (err) {
    console.error("ERROR TEXT JSON:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ============================================================================
// 16. ENDPOINT IMPOR FOXPRO (.DBF) - TANPA MULTER (PURE EXPRESS)
// ============================================================================
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

  // WAJIB HEADER SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // matiin buffer nginx Railway
  res.flushHeaders();

  const send = (percent, msg, extra = {}) => {
    res.write(
      `data: ${JSON.stringify({ percent, message: msg, ...extra })}\n\n`,
    );
    //res.flush(); // WAJIB biar langsung push ke browser
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
        const { kode_cabang: cabang, group, tahun, bulan, masa } = fields;
        const fileCdd = files["file_cdd"];
        const fileCdg = files["file_cdg"];
        const fileDet = files["file_det"];

        if (!fileCdd && !fileCdg && !fileDet) {
          send(100, "File CDG/CDD/DET tidak ditemukan", { success: false });
          return res.end();
        }

        send(5, `Mulai proses bulan ${bulan} (Masa ${masa})...`);
        const { Dbf } = require("dbf-reader");
        const crypto = require("crypto");
        const client = await db.connect();

        // ==========================================
        // FUNGSI BARU: UNTUK MEMBUAT TABEL JIKA BELUM ADA
        // ==========================================
        const ensureTableExists = async (tableName) => {
          await client.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
              id TEXT PRIMARY KEY,
              data TEXT NOT NULL
            );
          `);
        };

        // Helper khusus untuk format tanggal "Fri Feb 13 2026..." milik DET
        const fixDate = (val) => {
          if (!val) return null;
          if (val instanceof Date) return val.toISOString().split("T")[0];
          const str = String(val).trim();
          if (/^[A-Z][a-z]/.test(str)) {
            const d = new Date(str);
            return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
          }
          return null;
        };

        try {
          await client.query("BEGIN");
          let totalSaved = 0;

          // --- CEK & BUAT TABEL KE-3 TABLE TERLEBIH DAHULU ---
          send(8, "Menyiapkan tabel database...");
          await ensureTableExists(`golongan${tahun}`);
          await ensureTableExists(`perkiraan${tahun}`);
          await ensureTableExists(`transaksi${tahun}`);
          // Jika mutasikasir juga dynamic, tambahkan di sini. Jika sudah pasti ada, biarkan saja.
          // await ensureTableExists(`mutasikasir`)

          // ==========================================
          // 0. HAPUS DATA LAMA BERDASARKAN CABANG & MASA
          // ==========================================
          send(9, "Menghapus data lama bulan ini...");

          // Modifikasi query untuk memfilter cabang ($1) DAN masa ($2)
          const queryHapus = (tabel) =>
            `DELETE FROM ${tabel}${tahun} WHERE (data::jsonb)->>'cabang' = $1 AND (data::jsonb)->>'masa' = $2`;

          // Jalankan perintah dengan aman dengan mengirimkan array [cabang, masa]
          await client.query(queryHapus("golongan"), [cabang, masa]);
          await client.query(queryHapus("perkiraan"), [cabang, masa]);
          await client.query(queryHapus("transaksi"), [cabang, masa]);

          // ==========================================
          // 1. PROSES CDG -> golongan_2026
          // ==========================================
          if (fileCdg) {
            send(10, "Membaca file CDG...");
            const rows = Dbf.read(fileCdg)?.rows || [];
            if (rows.length > 0) {
              let q = `INSERT INTO golongan${tahun} (id, data) VALUES `;
              let v = [],
                p = [];
              rows.forEach((r, i) => {
                const id = crypto.randomUUID();
                const base = i * 2;
                p.push(`($${base + 1}, $${base + 2})`);
                v.push(
                  id,
                  JSON.stringify({
                    gol: String(r.GOLACCT || r.gol || "").trim(),
                    namaGol: String(r.PJLSAN || r.namaGol || "").trim(),
                    tipe: String(r.TIPE || r.tipe || "Golongan").trim(),
                    masa: masa,
                    awal: Number(r.AWAL || r.awal || 0),
                    db: Number(r.DB || r.db || 0),
                    cr: Number(r.CR || r.cr || 0),
                    akhir: Number(r.AKHIR || r.akhir || 0),
                    cabang: cabang,
                    group: group || "TLGA",
                  }),
                );
              });
              if (p.length > 0) {
                q +=
                  p.join(", ") +
                  " ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data";
                await client.query(q, v);
                totalSaved += p.length;
              }
              send(25, `CDG selesai: ${p.length} data Golongan`);
            }
          }

          // ==========================================
          // 2. PROSES CDD -> perkiraan_2026
          // ==========================================
          if (fileCdd) {
            send(35, "Membaca file CDD...");
            const rows = Dbf.read(fileCdd)?.rows || [];
            if (rows.length > 0) {
              let q = `INSERT INTO perkiraan${tahun} (id, data) VALUES `;
              let v = [],
                p = [];
              rows.forEach((r, i) => {
                const id = crypto.randomUUID();
                const base = i * 2;
                p.push(`($${base + 1}, $${base + 2})`);
                v.push(
                  id,
                  JSON.stringify({
                    gol: String(r.GOL || r.gol || "").trim(),
                    noPerk: String(r.SUBACCT || r.noPerk || "").trim(),
                    desc: String(r.PJLSAN || r.desc || "").trim(),
                    tipe: String(r.TIPE || r.tipe || "Perkiraan").trim(),
                    masa: masa,
                    awal: Number(r.AWAL || r.awal || 0),
                    db: Number(r.DB || r.db || 0),
                    cr: Number(r.CR || r.cr || 0),
                    akhir: Number(r.AKHIR || r.akhir || 0),
                    cabang: cabang,
                    group: group || "TLGA",
                  }),
                );
              });
              if (p.length > 0) {
                q +=
                  p.join(", ") +
                  " ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data";
                await client.query(q, v);
                totalSaved += p.length;
              }
              send(55, `CDD selesai: ${p.length} data Perkiraan`);
            }
          }

          // ==========================================
          // 3. PROSES DET -> transaksi_2026
          // ==========================================
          if (fileDet) {
            send(65, "Membaca file DET...");
            const rows = Dbf.read(fileDet)?.rows || [];
            if (rows.length > 0) {
              let q = `INSERT INTO transaksi${tahun} (id, data) VALUES `;
              let v = [],
                p = [];
              rows.forEach((r, i) => {
                const id = crypto.randomUUID();
                const base = i * 2;
                p.push(`($${base + 1}, $${base + 2})`);
                v.push(
                  id,
                  JSON.stringify({
                    id: id + "_" + String(r.NO || r.no || i).trim(),
                    noreff: String(r.REFF || r.noreff || "").trim(),
                    tanggal: fixDate(r.DATE || r.tanggal),
                    kodeBank: String(r.REFF || r.noreff || "")
                      .trim()
                      .substring(3, 4),

                    dariKePada: String(
                      r.DARIKEPADA || r.dariKePada || "",
                    ).trim(),
                    noperkiraan: String(r.NOACCT || r.noperkiraan || "").trim(),
                    desc: String(r.DESC || r.desc || "").trim(),
                    total:
                      Number(r.DB || r.db || 0) + Number(r.CR || r.cr || 0),
                    db: Number(r.DB || r.db || 0),
                    cr: Number(r.CR || r.cr || 0),

                    kodeTrans: String(r.KODETRANS || r.kodeTrans || "").trim(),
                    masa: masa,
                    cabang: cabang,
                    group: group || "TLGA",
                  }),
                );
              });
              if (p.length > 0) {
                q +=
                  p.join(", ") +
                  " ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data";
                await client.query(q, v);
                totalSaved += p.length;
              }
              send(85, `DET selesai: ${p.length} data Transaksi`);
            }
          }

          // ==========================================
          // SELESAI
          // ==========================================
          await client.query("COMMIT");
          send(100, `Sukses bulan ${bulan}! ${totalSaved} data tersimpan.`, {
            success: true,
          });
          res.end();
        } catch (txError) {
          await client.query("ROLLBACK");
          console.error("DETAIL ERROR DB:", txError);
          send(100, "Gagal simpan DB: " + (txError.detail || txError.message), {
            success: false,
          });
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
// 18. ENDPOINT IMPOR MUTASI KASIR ONLINE (SSE STREAMING PROGRESS)
// ============================================================================
app.post("/api/impor-mutasikasir-online", async (req, res) => {
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

  // WAJIB HEADER SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Matiin buffer Railway/Nginx
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
        const { cabang, hapus_tahun, hapus_bulan, group } = fields;
        const fileDbf = files["file_dbf"];

        if (!fileDbf) {
          send(100, "File DBF tidak ditemukan", { success: false });
          return res.end();
        }

        send(5, "Membaca file DBF di server...");
        const { Dbf } = require("dbf-reader");
        const records = Dbf.read(fileDbf)?.rows || [];
        send(15, `DBF terbaca: ${records.length} baris`);
        // ✅ DEBUG: Kirim 1 baris pertama DBF ke layar Browser untuk dicek
        if (records.length > 0) {
          send(
            32,
            "DEBUG ISI DBF BARIS PERTAMA: " + JSON.stringify(records[0]),
          );
        }

        if (records.length === 0) {
          send(100, "File DBF kosong", { success: false });
          return res.end();
        }

        if (!cabang) {
          send(100, "Parameter cabang tidak ada", { success: false });
          return res.end();
        }

        // 1. HAPUS DATA LAMA JIKA DIPILIH
        if (hapus_tahun || hapus_bulan) {
          send(20, "Menghapus data lama di database...");
          const cabShort = (cabang || "PUSAT").substring(0, 3).toUpperCase();
          let norefPrefix = `KASIR-${cabShort}-`;

          if (hapus_tahun && hapus_bulan) {
            norefPrefix += `${hapus_tahun}-${hapus_bulan}`;
          } else if (hapus_tahun) {
            norefPrefix += `${hapus_tahun}`;
          }

          let sql = `DELETE FROM mutasikasir WHERE CAST(data AS jsonb)->>'noreff' LIKE $1`;
          let params = [`${norefPrefix}%`];

          await db.query(sql, params);
          send(25, "Data lama berhasil dihapus");
        } else {
          send(25, "Mode tambah data (tidak menghapus yang lama)");
        }

        // 2. PROSES PARSE DATA (TANPA MENGURANGI JUMLAH BARIS)
        // 2. PROSES PARSE DATA
        send(30, "Memproses data...");
        const crypto = require("crypto");
        const noreffMap = {};

        // Filter baris valid (total > 0)
        const validRecords = records.filter((row) => {
          const getNum = (val) =>
            val !== undefined && val !== null ? Number(val) : 0;
          return getNum(row.N_RUPIAH_) > 0;
        });

        send(
          40,
          `${validRecords.length} data valid ditemukan, mulai menyimpan...`,
        );

        // 3. INSERT KE DATABASE (HANYA KE KOLOM id DAN data)
        // 3. INSERT KE DATABASE (FIX CASTING JSONB)
        const client = await db.connect();
        try {
          await client.query("BEGIN");

          let savedCount = 0;
          let errorCount = 0; // Menghitung baris yang error/diskip
          // ... (Kode bagian atas tetap sama)
          const batchSize = 500;
          const totalBatches = Math.ceil(validRecords.length / batchSize);

          for (let i = 0; i < validRecords.length; i += batchSize) {
            const batch = validRecords.slice(i, i + batchSize);

            let queryText = `INSERT INTO mutasikasir (id, data) VALUES `;
            let values = [];
            let placeholders = [];

            for (const row of batch) {
              try {
                if (!row) {
                  errorCount++;
                  continue;
                }

                // ==========================================
                // MAPPING LANGSUNG FIELD DBF FOXPRO
                // ==========================================
                const getStr = (val) =>
                  val !== undefined && val !== null ? String(val).trim() : "";
                const getNum = (val) =>
                  val !== undefined && val !== null ? Number(val) : 0;

                const tglDbf = getStr(row.TANGGAL);
                const descRaw = getStr(row.PENJELASAN);

                // Gunakan Math.abs() jika nilai pengeluaran di DBF berupa minus (-)
                // agar nilai nominalnya tetap menjadi positif saat disimpan ke JSON
                const totalRaw = getNum(row.RUPIAH);
                const total = Math.abs(totalRaw);

                const kodeTrans = getStr(row.KODE).toUpperCase();
                const cabDBF = cabang,

                // ✅ PENGAMAN UTAMA FIXED: Hanya skip jika kolom kritikal benar-benar kosong atau nominalnya 0
                if (!tglDbf || !kodeTrans || total === 0) {
                  errorCount++;
                  continue;
                }

                // Bersihkan Deskripsi
                const desc = descRaw.toUpperCase().replace(/"/g, "'");

                // 1. Ambil teks tanggal asli dari DBF dan bersihkan dari karakter aneh
                let cleanTgl = tglDbf.replace(/[^0-9\/]/g, "").trim();
                // 1. PARSING TANGGAL (SMART PARSER ANTI TERBALIK)
                let tanggalFix = "";
                let tglStr = "";

                if (row.TANGGAL instanceof Date) {
                  let mm = String(row.TANGGAL.getMonth() + 1).padStart(2, "0");
                  let dd = String(row.TANGGAL.getDate()).padStart(2, "0");
                  let yyyy = row.TANGGAL.getFullYear();
                  tanggalFix = `${yyyy}-${mm}-${dd}`;
                } else {
                  tglStr = String(row.TANGGAL || "").trim();
                  let cleanTgl = tglStr.replace(/[^0-9\/]/g, "");

                  if (cleanTgl.includes("/")) {
                    let parts = cleanTgl.split("/");
                    if (parts.length === 3) {
                      let part1 = parts[0].padStart(2, "0");
                      let part2 = parts[1].padStart(2, "0");
                      let yyyy =
                        parts[2].length === 2 ? "20" + parts[2] : parts[2];

                      let mm = "",
                        dd = "";

                      // Jika angka pertama > 12, pasti itu TANGGAL (Format DD/MM)
                      if (parseInt(part1) > 12) {
                        dd = part1;
                        mm = part2;
                      }
                      // Jika angka kedua > 12, pasti itu TANGGAL (Format MM/DD)
                      else if (parseInt(part2) > 12) {
                        mm = part1;
                        dd = part2;
                      }
                      // JIKA KEDUANYA < 12 (Misal 01/08/2024), GUNAKAN POLA DARI BARIS SEBELUMNYA
                      else {
                        if (lastParsedFormat === "DMY") {
                          dd = part1;
                          mm = part2;
                        } else {
                          mm = part1;
                          dd = part2; // Default tetap MM/DD
                        }
                      }

                      // SIMPAN POLA SAAT INI UNTUK MENJADI ACUAN BARIS SELANJUTNYA
                      lastParsedFormat = parseInt(part1) > 12 ? "DMY" : "MDY";

                      tanggalFix = `${yyyy}-${mm}-${dd}`;
                    }
                  }
                }

                if (!tanggalFix) continue;
                const cabFinal = cabDBF || cabang;
                const cabShort = (cabFinal || "PUSAT")
                  .substring(0, 3)
                  .toUpperCase();
                const noreffKey = `${cabShort}_${tanggalFix}`;

                if (!noreffMap[noreffKey]) {
                  const randomStr = Math.random()
                    .toString(36)
                    .substr(2, 4)
                    .toUpperCase();
                  noreffMap[noreffKey] =
                    `KASIR-${cabShort}-${tanggalFix}-${randomStr}`;
                }

                const noreff = noreffMap[noreffKey];
                const id = crypto.randomUUID();

                // Logika DB & CR berdasarkan nilai asli (apakah minus atau kode PJ/TK/KT)
                let nilaiDb = 0;
                let nilaiCr = 0;

                // Jika kode berawalan PJ/TK/KT atau nilai aslinya positif, masuk Debit
                if (
                  ["PJ", "TK", "KT"].some((k) => kodeTrans.startsWith(k)) ||
                  totalRaw > 0
                ) {
                  nilaiDb = total;
                } else {
                  nilaiCr = total;
                }

                const jsonData = {
                  id: id,
                  noreff: noreff,
                  tanggal: tanggalFix,
                  cabang: cabFinal,
                  group: group || "TLGA",
                  kodeTrans: kodeTrans,
                  noperkiraan: "",
                  desc: desc,
                  total: total,
                  db: nilaiDb,
                  cr: nilaiCr,
                };

                const base = values.length;
                placeholders.push(`($${base + 1}, $${base + 2})`);
                values.push(id, JSON.stringify(jsonData));
              } catch (errPerBaris) {
                errorCount++;
                // Ini akan menampilkan di log server bagian mana yang memicu error internal JavaScript
                console.warn(
                  "Gagal mapping baris karena: ",
                  errPerBaris.message,
                );
              }
            }

            // Eksekusi Batch
            // Eksekusi Batch
            if (placeholders.length > 0) {
              queryText += placeholders.join(", ");
              queryText += ` ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;

              // ✅ PENGAMAN: Tangkap error QUERY saja, lempar ke atas jika gagal
              try {
                await client.query(queryText, values);
              } catch (errDb) {
                throw new Error("Postgres Error: " + errDb.message);
              }
            }

            savedCount += placeholders.length;
            const currentBatch = Math.floor(i / batchSize) + 1;
            const pct = 40 + Math.round((currentBatch / totalBatches) * 60);

            // ✅ PENGAMAN: Cegah error jika koneksi SSE sudah terputus/tertutup browser
            try {
              send(
                pct,
                `Menyimpan ke Supabase... (${savedCount} data berhasil masuk)`,
              );
            } catch (errStream) {
              // Abaikan error stream, yang penting database sudah dapat datanya
              console.log("Stream terputus, tapi data tetap disimpan.");
            }
          }

          await client.query("COMMIT");

          // ✅ PENGAMAN TERAKHIR SAAT KIRIM SUKSES
          try {
            send(
              100,
              `Sukses! ${savedCount} data kasir cabang ${cabang} tersimpan`,
              { success: true },
            );
            res.end();
          } catch (errEndStream) {
            // Jika stream mati di detik terakhir, paksa tutup koneksi
            res.end();
          }
        } catch (txError) {
          await client.query("ROLLBACK");
          let pesanError =
            "Gagal simpan DB: " + (txError.detail || txError.message);
          console.error("DETAIL ERROR DB:", txError);

          try {
            send(100, pesanError, { success: false });
            res.end();
          } catch (e) {
            res.end();
          }
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
// JALANKAN SERVER - WAJIB DI PALING BAWAH
// ============================================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});
