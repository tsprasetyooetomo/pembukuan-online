// ============================================================================
// IMPORT YANG WAJIB ADA DI PALING ATAS
// ============================================================================
const express = require("express");
const path = require("path");
const { Pool } = require("pg");

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
    const { storeName, masa, cabang, tahun, bulan } = req.body; // ✅ Tambahkan tahun & bulan
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
    const filterCabang = req.query.cabang; // Tangkap parameter ?cabang=XX dari frontend

    if (!isValidTable(storeName)) {
      return res.status(400).json({ error: "Invalid Table" });
    }
    console.log("cabang:", filterCabang);

    const lowerStoreName = storeName.toLowerCase();

    // 2. Daftar tabel yang memiliki kolom cabang di dalam objek JSON-nya
    const tabelWajibFilter = [
      "golongan",
      "perkiraan",
      "transaksi",
      "users",
      "formatrl",
      "formatneraca",
      "postedmonths",
      "kodebank",
      "cabang",
      "detiltransaksi",
      "saldo_harian",
      "saldokasir",
      "mutasikasir",
    ];

    let result;

    // ✅ LOGIKA BARU:
    // Jika filterCabang kosong ("") atau berisi kata "PUSAT", maka AMBIL SEMUA DATA
    if (
      !filterCabang ||
      filterCabang.trim() === "" ||
      filterCabang.toUpperCase() === "PUSAT"
    ) {
      result = await db.query(`SELECT data FROM ${lowerStoreName}`);
      console.log(
        `System: SQL Fetch SEMUA DATA (PUSAT/TANPA CABANG) | Tabel ${lowerStoreName} | Ditemukan: ${result.rows.length} baris`,
      );
    } else if (tabelWajibFilter.includes(lowerStoreName)) {
      // Selain itu (misalnya: 01, 02, 03, termasuk 00), maka DIFILTER

      if (!/^[a-zA-Z0-9\-_ ]+$/.test(filterCabang)) {
        return res.status(400).json({ error: "Kode cabang tidak valid" });
      }

      const queryStr = `
        SELECT data FROM ${lowerStoreName} 
        WHERE data LIKE $1 OR data LIKE $2 OR data LIKE $3 OR data LIKE $4
      `;

      // Contoh filterCabang = "03"
      const param1 = `%"cabang":"${filterCabang}"%`; // Tanpa spasi
      const param2 = `%"cabang": "${filterCabang}"%`; // Dengan spasi
      const param3 = `%"kode_cabang":"${filterCabang}"%`; // Tanpa spasi
      const param4 = `%"kode_cabang": "${filterCabang}"%`; // Dengan spasi

      result = await db.query(queryStr, [param1, param2, param3, param4]);

      console.log(
        `System: SQL Fetch TERFILTER cabang ${filterCabang} | Tabel ${lowerStoreName} | Ditemukan: ${result.rows.length} baris`,
      );
    } else {
      // Jika tabel tidak masuk daftar wajib filter (misal tabel lain di masa depan)
      result = await db.query(`SELECT data FROM ${lowerStoreName}`);
      console.log(
        `System: SQL Fetch SEMUA DATA (TABEL BIASA) | Tabel ${lowerStoreName} | Ditemukan: ${result.rows.length} baris`,
      );
    }

    // Parsing semua baris dari database ke format JSON Objek
    const allData = result.rows.map((r) =>
      typeof r.data === "string" ? JSON.parse(r.data) : r.data,
    );

    // Kirim langsung hasil data ke frontend
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

          // Batch insert + kirim progress tiap batch
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
                  const crypto = require("crypto");
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

              // Kirim progress tiap batch
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
        const { cabang, hapus_tahun, hapus_bulan } = fields;
        const fileDbf = files["file_dbf"];

        if (!fileDbf) {
          send(100, "File DBF tidak ditemukan", { success: false });
          return res.end();
        }

        send(5, "Membaca file DBF di server...");
        const { Dbf } = require("dbf-reader");
        const records = Dbf.read(fileDbf)?.rows || [];
        send(15, `DBF terbaca: ${records.length} baris`);

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
        send(30, "Memproses data...");
        const crypto = require("crypto");

        // ✅ DICT UNTUK MENYIMPAN NOREFF BERDASARKAN TANGGAL & CABANG
        const noreffMap = {};

        // Filter baris valid (total > 0) agar tidak membuang resource
        const validRecords = records.filter((row) => {
          const getNum = (val) =>
            val !== undefined && val !== null ? Number(val) : 0;
          return getNum(row.N_RUPIAH_) > 0;
        });

        send(
          40,
          `${validRecords.length} data valid ditemukan, mulai menyimpan...`,
        );

        // 3. INSERT KE DATABASE
        const client = await db.connect();
        try {
          await client.query("BEGIN");

          let savedCount = 0;
          const batchSize = 500;
          const totalBatches = Math.ceil(validRecords.length / batchSize);

          for (let i = 0; i < validRecords.length; i += batchSize) {
            const batch = validRecords.slice(i, i + batchSize);
            let queryText = `INSERT INTO mutasikasir (id, data) VALUES `;
            let values = [];
            let placeholders = [];

            batch.forEach((row) => {
              const getStr = (val) =>
                val !== undefined && val !== null ? String(val).trim() : "";
              const getNum = (val) =>
                val !== undefined && val !== null ? Number(val) : 0;

              const kodeTrans = getStr(row.N_KODE_).toUpperCase();
              const desc = getStr(row.PENJELASAN).toUpperCase();
              const total = getNum(row.N_RUPIAH_);
              const cabDBF = getStr(row.N_CABANG_) || cabang;

              // Format Tanggal
              // Format Tanggal (UNIVERSAL PARSER)
              let tglStr = getStr(row.TANGGAL);
              let tanggalFix = new Date().toISOString().split("T")[0]; // Default hari ini

              if (tglStr) {
                // 1. Coba bersihkan jika ada karakter aneh (seperti hasil convert Excel/DBF aneh)
                let cleanTgl = tglStr.replace(/[^0-9\-\/]/g, "").trim();

                let parsedDate;

                if (cleanTgl.length === 8 && !isNaN(cleanTgl)) {
                  // Jika formatnya 20260106
                  parsedDate = new Date(
                    cleanTgl.substring(0, 4) +
                      "-" +
                      cleanTgl.substring(4, 6) +
                      "-" +
                      cleanTgl.substring(6, 8),
                  );
                } else if (cleanTgl.includes("-") || cleanTgl.includes("/")) {
                  // Jika formatnya 2026-01-06 atau 2026/01/06
                  parsedDate = new Date(cleanTgl.replace(/\//g, "-"));
                } else {
                  // Fallback: Biarkan JavaScript yang mengartikan string aslinya (menangani format Tue Jan 06...)
                  parsedDate = new Date(tglStr);
                }

                // Validasi apakah hasil parse benar-benar tanggal yang valid
                if (!isNaN(parsedDate.getTime())) {
                  // Gunakan toISOString() untuk memastikan hasilnya PASTI "YYYY-MM-DD"
                  tanggalFix = parsedDate.toISOString().split("T")[0];
                }
              }
              const cabShort = (cabDBF || "PUSAT")
                .substring(0, 3)
                .toUpperCase();

              // ✅ LOGIKA NOREFF: Buat key unik dari Tanggal + Cabang
              const noreffKey = `${cabShort}_${tanggalFix}`;

              // Jika noreff untuk tanggal & cabang ini BELUM pernah dibuat, buat baru
              if (!noreffMap[noreffKey]) {
                const randomStr = Math.random()
                  .toString(36)
                  .substr(2, 4)
                  .toUpperCase();
                noreffMap[noreffKey] =
                  `KASIR-${cabShort}-${tanggalFix}-${randomStr}`;
              }

              // Ambil noreff yang sudah pernah dibuat (atau baru saja dibuat)
              const noreff = noreffMap[noreffKey];

              // Buat ID unik tetap berbeda untuk setiap baris
              const id = crypto.randomUUID();

              const jsonData = JSON.stringify({
                id,
                noreff: noreff, // <-- Ini yang jadi sama jika tanggalnya sama
                tanggal: tanggalFix,
                cabang: cabDBF,
                kodeTrans: kodeTrans, // <-- Diembalikan lagi ke aslinya dari DBF
                noperkiraan: "",
                desc: desc,
                total: total,
                db: total,
                cr: 0,
              });

              const base = values.length;
              placeholders.push(`($${base + 1}, $${base + 2})`);
              values.push(id, jsonData);
            });

            if (placeholders.length > 0) {
              queryText += placeholders.join(", ");
              queryText += ` ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
              await client.query(queryText, values);
            }

            savedCount += batch.length;
            const currentBatch = Math.floor(i / batchSize) + 1;
            const pct = 40 + Math.round((currentBatch / totalBatches) * 60);

            send(
              pct,
              `Menyimpan ke Supabase... (${savedCount}/${validRecords.length} data)`,
            );
          }

          await client.query("COMMIT");
          send(
            100,
            `Sukses! ${savedCount} data kasir cabang ${cabang} tersimpan`,
            { success: true },
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
// JALANKAN SERVER - WAJIB DI PALING BAWAH
// ============================================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});
