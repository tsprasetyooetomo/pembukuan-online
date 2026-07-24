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

app.use(express.json({ limit: "50mb" })); // <--- Tambahkan limit ini
app.use(express.urlencoded({ extended: true, limit: "50mb" })); // <--- Tambahkan limit ini
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

      // 1. Cek keberadaan tabel (Gunakan LOWER agar kebal huruf kapital)
      const checkQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND LOWER(table_name) = LOWER($1));`;
      const resCheck = await db.query(checkQuery, [lowerTableName]);
      const tableExists = resCheck.rows[0].exists;

      // Sanitasi nama tabel untuk mencegah SQL Injection
      const safeTable = '"' + lowerTableName.replace(/"/g, '""') + '"';

      // Daftar tabel master murni (Butuh Cabang & Group, Tanpa Masa)
      const masterTables = [
        "users",
        "formatrl",
        "formatneraca",
        "kodebank",
        "golongan",
        "perkiraan",
        "cabang",
      ];

      if (!tableExists) {
        console.log(`🛠️ Membuat tabel baru di Supabase: ${lowerTableName}`);

        if (lowerTableName === "groupproject") {
          // KONDISI A: groupproject hanya 2 kolom
          await db.query(
            `CREATE TABLE ${safeTable} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`,
          );
          console.log(
            `⚡ Tabel super master ${lowerTableName} dibuat minimalis (2 kolom).`,
          );
        } else if (lowerTableName === "cabang") {
          // KONDISI B: cabang hanya ditambah kolom group (tanpa kolom cabang)
          await db.query(
            `CREATE TABLE ${safeTable} (id TEXT PRIMARY KEY, "group" TEXT, data TEXT NOT NULL)`,
          );
          await db.query(`CREATE INDEX ON ${safeTable} ("group")`);
          console.log(`⚡ Tabel ${lowerTableName} dibuat dengan filter group.`);
        } else if (masterTables.includes(lowerTableName)) {
          // KONDISI C: Tabel master umum (users, perkiraan, golongan, dll) butuh cabang & group
          await db.query(
            `CREATE TABLE ${safeTable} (id TEXT PRIMARY KEY, cabang TEXT, "group" TEXT, data TEXT NOT NULL)`,
          );
          await db.query(`CREATE INDEX ON ${safeTable} (cabang, "group")`);
          console.log(
            `⚡ Tabel master ${lowerTableName} dibuat dengan filter cabang & group.`,
          );
        } else {
          // KONDISI D: Tabel transaksi reguler & Tabel tahunan dinamis (transaksi2024, transaksi2026, dll)
          // Lengkap dengan MASA, CABANG, dan GROUP
          await db.query(
            `CREATE TABLE ${safeTable} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, data TEXT NOT NULL)`,
          );
          await db.query(
            `CREATE INDEX ON ${safeTable} (masa, cabang, "group")`,
          );
          console.log(
            `⚡ Tabel operasional/tahunan ${lowerTableName} dibuat lengkap dengan kolom dimensi.`,
          );
        }
        console.log(`✅ Tabel ${lowerTableName} berhasil dibuat.`);
      } else {
        // 2. Jika tabel sudah ada, cek kolom yang kurang (MIGRASI STRUKTUR FISIK)
        // Gunakan LOWER(table_name) agar kebal huruf besar/kecil di database
        const colCheck = await db.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND LOWER(table_name) = LOWER($1) AND column_name IN ('masa', 'cabang', 'group')`,
          [lowerTableName],
        );

        const existingCols = colCheck.rows.map((r) => r.column_name);
        let columnAdded = false;

        // Aturan Kolom 'masa': Hanya untuk tabel operasional & tahunan (BUKAN tabel master)
        if (
          !existingCols.includes("masa") &&
          !masterTables.includes(lowerTableName) &&
          lowerTableName !== "groupproject"
        ) {
          await db.query(`ALTER TABLE ${safeTable} ADD COLUMN masa TEXT`);
          console.log(`➕ Kolom 'masa' ditambahkan ke tabel ${lowerTableName}`);
          columnAdded = true;
        }

        // Aturan Kolom 'cabang': Untuk semua tabel KECUALI tabel cabang dan groupproject
        if (
          !existingCols.includes("cabang") &&
          lowerTableName !== "cabang" &&
          lowerTableName !== "groupproject"
        ) {
          await db.query(`ALTER TABLE ${safeTable} ADD COLUMN cabang TEXT`);
          console.log(
            `➕ Kolom 'cabang' ditambahkan ke tabel ${lowerTableName}`,
          );
          columnAdded = true;
        }

        // Aturan Kolom 'group': Untuk semua tabel KECUALI groupproject
        if (
          !existingCols.includes("group") &&
          lowerTableName !== "groupproject"
        ) {
          await db.query(`ALTER TABLE ${safeTable} ADD COLUMN "group" TEXT`);
          console.log(
            `➕ Kolom 'group' ditambahkan ke tabel ${lowerTableName}`,
          );
          columnAdded = true;
        }

        // Jika ada kolom baru yang disuntikkan, pastikan INDEX-nya terbuat otomatis
        if (columnAdded) {
          const indexName = `idx_${lowerTableName}_dimensi`;

          if (lowerTableName === "cabang") {
            await db.query(
              `CREATE INDEX IF NOT EXISTS "${indexName}" ON ${safeTable} ("group")`,
            );
          } else if (lowerTableName !== "groupproject") {
            const indexCols = masterTables.includes(lowerTableName)
              ? `cabang, "group"`
              : `masa, cabang, "group"`;
            await db.query(
              `CREATE INDEX IF NOT EXISTS "${indexName}" ON ${safeTable} (${indexCols})`,
            );
          }
          console.log(`⚡ Index susulan ${indexName} dipastikan tersedia.`);
        }
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
          const safeTable = '"' + lowerTableName.replace(/"/g, '""') + '"'; // Tambah safeTable

          // ✅ SUDAH PAKAI KOLOM FISIK (Ini sudah benar dan super cepat)
          await client.query(
            `DELETE FROM ${safeTable} WHERE masa = $1 AND cabang = $2`,
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
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"'; // Tambah safeTable
    let sql = `DELETE FROM ${safeTable}`;
    let params = [];
    let paramIndex = 1;

    // ✅ LOGIKA KHUSUS UNTUK MUTASI KASIR (Menggabungkan Fisik & JSON untuk tanggal)
    if (lowerStoreName === "mutasikasir") {
      let conditions = [];

      // 1. Filter Noreff (Tetap di JSON karena tidak ada kolom fisik noreff)
      if (req.body.noreff) {
        conditions.push(`CAST(data AS jsonb)->>'noreff' = $${paramIndex++}`);
        params.push(req.body.noreff);
      }

      // 2. Filter Cabang -> PAKAI KOLOM FISIK SEKARANG
      if (cabang) {
        conditions.push(`cabang = $${paramIndex++}`);
        params.push(cabang);
      }

      // 3. Filter Group -> PAKAI KOLOM FISIK SEKARANG
      if (req.body.group) {
        conditions.push(`"group" = $${paramIndex++}`);
        params.push(req.body.group);
      }

      // 4. Filter Tahun & Bulan (Tetap di JSON karena kolom fisiknya 'masa' bukan 'tanggal')
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
    // ✅ LOGIKA UNTUK TABEL TAHUNAN (Golongan, Perkiraan, Transaksi) -> LEBIH SEDERHANA
    else {
      // Karena semua tabel sudah pasti punya kolom fisik 'masa' dan 'cabang' (berdasarkan initTable Anda)
      if (masa && cabang) {
        sql += ` WHERE masa = $${paramIndex++} AND cabang = $${paramIndex++}`;
        params = [masa, cabang];

        // Opsional: Tambah filter group jika dikirim dari frontend
        if (req.body.group) {
          sql += ` AND "group" = $${paramIndex++}`;
          params.push(req.body.group);
        }
      } else if (cabang) {
        // Jika hanya filter cabang saja
        sql += ` WHERE cabang = $${paramIndex++}`;
        params = [cabang];
      }
    }

    const info = await db.query(sql, params);
    res.json({ success: true, changes: info.rowCount || 0 });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 3. GET ALL DATA (DIEKSTREM OPTIMASI UNTUK KECEPATAN)
app.get("/api/data/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });

  try {
    const { storeName } = req.params;
    const filterCabang = req.query.cabang;
    const filterGroup = req.query.group;
    const filterMasa = req.query.masa; // ✅ SARAN: Tangkap parameter masa juga dari frontend

    if (!isValidTable(storeName)) {
      return res.status(400).json({ error: "Invalid Table" });
    }

    const lowerStoreName = storeName.toLowerCase();
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"';

    let whereClause = "";
    let params = [];
    let paramIndex = 1;

    // 1. Filter Cabang -> PAKAI KOLOM FISIK (Index akan bekerja 100%)
    if (
      filterCabang &&
      filterCabang.trim() !== "" &&
      filterCabang.toUpperCase() !== "PUSAT"
    ) {
      if (!/^[a-zA-Z0-9\-_ ]+$/.test(filterCabang)) {
        return res.status(400).json({ error: "Kode cabang tidak valid" });
      }
      whereClause = `cabang = $${paramIndex++}`;
      params.push(filterCabang);
    }

    // 2. Filter Group -> PAKAI KOLOM FISIK (Index akan bekerja 100%)
    if (filterGroup && filterGroup.trim() !== "") {
      if (!/^[a-zA-Z0-9\-_ ]+$/.test(filterGroup)) {
        return res.status(400).json({ error: "Kode group tidak valid" });
      }

      const groupCondition = `"group" = $${paramIndex++}`;
      params.push(filterGroup);

      if (whereClause === "") {
        whereClause = groupCondition;
      } else {
        whereClause += " AND " + groupCondition;
      }
    }

    // ✅ 3. (BONUS) Filter Masa -> PAKAI KOLOM FISIK
    if (filterMasa && filterMasa.trim() !== "") {
      const masaCondition = `masa = $${paramIndex++}`;
      params.push(filterMasa);

      if (whereClause === "") {
        whereClause = masaCondition;
      } else {
        whereClause += " AND " + masaCondition;
      }
    }

    // 4. Eksekusi Query SQL
    let sql = `SELECT data FROM ${safeTable}`;
    if (whereClause !== "") {
      sql += ` WHERE ${whereClause}`;
    }

    var result = await db.query(sql, params);
    console.log(
      `⚡ FAST SQL Fetch | Tabel ${lowerStoreName} | Cabang: ${filterCabang || "ALL"} | Group: ${filterGroup || "ALL"} | Masa: ${filterMasa || "ALL"} | Ditemukan: ${result.rows.length} baris`,
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
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"'; // Tambah safeTable

    const result = await db.query(
      `SELECT data FROM ${safeTable} WHERE id = $1`,
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

// 5. POST DATA (CONTOH PERUBAHAN)
app.post("/api/data/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const data = req.body;
    if (!data.id) return res.status(400).json({ error: "ID Required" });

    const lowerStoreName = storeName.toLowerCase();
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"';

    // LOGIKA BARU: Isi kolom fisiknya ambil dari JSON yang dikirim frontend
    await db.query(
      `INSERT INTO ${safeTable} (id, masa, cabang, "group", data) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (id) DO UPDATE SET 
         masa = EXCLUDED.masa, 
         cabang = EXCLUDED.cabang, 
         "group" = EXCLUDED."group", 
         data = EXCLUDED.data`,
      [
        data.id,
        data.masa || null,
        data.cabang || null,
        data.group || null,
        JSON.stringify(data),
      ],
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
    const lowerStoreName = storeName.toLowerCase();
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"'; // Tambahkan keamanan

    if (!isValidTable(lowerStoreName)) {
      return res.status(400).json({ error: "Invalid Table" });
    }

    const result = await db.query(
      `SELECT data FROM ${safeTable} WHERE id = $1`,
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

    // ✅ UBAH QUERY UPDATE-NYA MENJADI INI:
    await db.query(
      `UPDATE ${safeTable} SET masa = $1, cabang = $2, "group" = $3, data = $4 WHERE id = $5`,
      [
        merged.masa || null,
        merged.cabang || null,
        merged.group || null,
        JSON.stringify(merged),
        id,
      ],
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

    const lowerStoreName = storeName.toLowerCase();
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"'; // Tambahkan safeTable

    // 1. Ambil data lama (jika ada) untuk di-merge
    const result = await db.query(
      `SELECT data FROM ${safeTable} WHERE id = $1`,
      [data.id],
    );
    const row = result.rows[0];

    // 2. Proses Merge (Gabungkan data lama dengan data baru dari frontend)
    let merged = row
      ? {
          ...(typeof row.data === "string" ? JSON.parse(row.data) : row.data),
          ...data,
        }
      : data;

    // 3. SIMPAN DENGAN KOLOM FISIK BARU
    await db.query(
      `INSERT INTO ${safeTable} (id, masa, cabang, "group", data) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (id) DO UPDATE SET 
         masa = EXCLUDED.masa, 
         cabang = EXCLUDED.cabang, 
         "group" = EXCLUDED."group", 
         data = EXCLUDED.data`,
      [
        merged.id,
        merged.masa || null,
        merged.cabang || null,
        merged.group || null,
        JSON.stringify(merged),
      ],
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
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"'; // ✅ Tambah Safe Table

    await db.query(`DELETE FROM ${safeTable} WHERE id = $1`, [id]);
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
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"'; // ✅ Tambah Safe Table

    await db.query(`DELETE FROM ${safeTable}`);
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
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"'; // ✅ Tambah Safe Table

    const result = await db.query(
      `SELECT COUNT(id) as total FROM ${safeTable}`,
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
        const safeTable = '"' + lowerTableName.replace(/"/g, '""') + '"'; // ✅ Tambah Safe Table

        const result = await db.query(`SELECT data FROM ${safeTable}`);
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

// ====================================================================
// 12. BATCH (DIEKSTREM OPTIMASI - MENGGUNAKAN KOLOM FISIK)
// ====================================================================
app.post("/api/batch/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName } = req.params;
    const data = req.body;
    if (!Array.isArray(data))
      return res.json({ success: true, message: "No data" });

    const lowerStoreName = storeName.toLowerCase();
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"';

    const checkQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`;
    const resCheck = await db.query(checkQuery, [lowerStoreName]);
    const tableExists = resCheck.rows[0].exists;

    if (!tableExists && storeName.match(/\d{4}$/)) {
      console.log(`🛠️ Auto-create tabel tahunan: ${lowerStoreName}`);
      await db.query(
        `CREATE TABLE ${safeTable} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, data TEXT NOT NULL)`,
      );
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // ✅ QUERY BARU: Sudah memasukkan masa, cabang, dan group ke kolom fisik
      const queryText = `INSERT INTO ${safeTable} (id, masa, cabang, "group", data) 
                         VALUES ($1, $2, $3, $4, $5) 
                         ON CONFLICT (id) DO UPDATE SET 
                           masa = EXCLUDED.masa, 
                           cabang = EXCLUDED.cabang, 
                           "group" = EXCLUDED."group", 
                           data = EXCLUDED.data`;

      for (const item of data) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${lowerStoreName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // ✅ PARAMETER BARU: Urutannya harus sama dengan VALUES ($1, $2, $3, $4, $5)
        await client.query(queryText, [
          id,
          item.masa || null,
          item.cabang || null,
          item.group || null,
          JSON.stringify(item),
        ]);
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

// ====================================================================
// 13. SAVE BATCH (DIEKSTREM OPTIMASI - MENGGUNAKAN KOLOM FISIK)
// ====================================================================
app.post("/api/save-batch", async (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName, data } = req.body;
    if (!storeName || !Array.isArray(data)) return res.json({ success: true });
    const lowerStoreName = storeName.toLowerCase();
    const safeTable = '"' + lowerStoreName.replace(/"/g, '""') + '"';

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // ✅ QUERY BARU
      const queryText = `INSERT INTO ${safeTable} (id, masa, cabang, "group", data) 
                         VALUES ($1, $2, $3, $4, $5) 
                         ON CONFLICT (id) DO UPDATE SET 
                           masa = EXCLUDED.masa, 
                           cabang = EXCLUDED.cabang, 
                           "group" = EXCLUDED."group", 
                           data = EXCLUDED.data`;

      for (const item of data) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${lowerStoreName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // ✅ PARAMETER BARU
        await client.query(queryText, [
          id,
          item.masa || null,
          item.cabang || null,
          item.group || null,
          JSON.stringify(item),
        ]);
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
    const { tanggalAwal, tanggalAkhir } = req.body;
    if (!tanggalAwal || !tanggalAkhir)
      return res.status(400).json({ error: "Date Required" });

    const safeTable = '"saldo_harian"'; // ✅ Tambah Safe Table

    // ✅ LOGIKA BARU: Hapus berdasarkan rentang tanggal di dalam format JSON
    const sql = `DELETE FROM ${safeTable} WHERE CAST(data AS jsonb)->>'tanggal' >= $1 AND CAST(data AS jsonb)->>'tanggal' <= $2`;
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

    // ✅ UBAH: Tambah kolom cabang saat insert
    await db.query(
      `INSERT INTO "saldo_harian" (id, cabang, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET cabang = EXCLUDED.cabang, data = EXCLUDED.data`,
      [id, cabang || null, jsonData],
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
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

    // ✅ UBAH: Pakai kolom fisik cabang & group, JSON hanya untuk tanggal
    const sql = `
      DELETE FROM "saldokasir" 
      WHERE cabang = $1 
        AND "group" = $2 
        AND CAST(data AS jsonb)->>'tanggal' >= $3 
        AND CAST(data AS jsonb)->>'tanggal' <= $4
    `;

    await db.query(sql, [
      cabang,
      group.trim().toUpperCase(),
      tanggalAwal,
      tanggalAkhir,
    ]);

    res.json({ message: "Range saldo kasir berhasil dihapus" });
  } catch (err) {
    console.error("ERROR CLEAR RANGE:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 16. ENDPOINT IMPOR FOXPRO (.DBF) - OPTIMASI KOLOM FISIK
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

        const ensureTableExists = async (tableName) => {
          const safeTable = '"' + tableName.replace(/"/g, '""') + '"';
          await client.query(`
            CREATE TABLE IF NOT EXISTS ${safeTable} (
              id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, data TEXT NOT NULL
            );
          `);
        };

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

          send(8, "Menyiapkan tabel database...");
          await ensureTableExists(`golongan${tahun}`);
          await ensureTableExists(`perkiraan${tahun}`);
          await ensureTableExists(`transaksi${tahun}`);

          // ✅ UBAH: HAPUS DATA LAMA PAKAI KOLOM FISIK (Super Cepat)
          send(9, "Menghapus data lama bulan ini...");
          const queryHapus = (tabel) => {
            const safeTable = '"' + tabel + tahun + '"';
            return `DELETE FROM ${safeTable} WHERE masa = $1 AND cabang = $2 AND "group" = $3`;
          };
          await client.query(queryHapus("golongan"), [
            masa,
            cabang,
            group || "TLGA",
          ]);
          await client.query(queryHapus("perkiraan"), [
            masa,
            cabang,
            group || "TLGA",
          ]);
          await client.query(queryHapus("transaksi"), [
            masa,
            cabang,
            group || "TLGA",
          ]);

          // ✅ FUNGSI HELPER INSERT BARU (Mengisi Kolom Fisik)
          const insertBatchWithCols = async (tableName, rows, mapperFn) => {
            if (rows.length === 0) return 0;
            const safeTable = '"' + tableName + '"';
            let q = `INSERT INTO ${safeTable} (id, masa, cabang, "group", data) VALUES `;
            let v = [],
              p = [];

            rows.forEach((r, i) => {
              const id = crypto.randomUUID();
              const base = i * 5; // ✅ Karena ada 5 parameter ($1 s/d $5)
              p.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
              );

              const jsonData = mapperFn(r, id);
              v.push(
                id,
                jsonData.masa,
                jsonData.cabang,
                jsonData.group,
                JSON.stringify(jsonData),
              );
            });

            if (p.length > 0) {
              q +=
                p.join(", ") +
                ' ON CONFLICT (id) DO UPDATE SET masa = EXCLUDED.masa, cabang = EXCLUDED.cabang, "group" = EXCLUDED."group", data = EXCLUDED.data';
              await client.query(q, v);
            }
            return p.length;
          };

          // ==========================================
          // 1. PROSES CDG -> golongan_2026
          // ==========================================
          if (fileCdg) {
            send(10, "Membaca file CDG...");
            const rows = Dbf.read(fileCdg)?.rows || [];
            totalSaved += await insertBatchWithCols(
              `golongan${tahun}`,
              rows,
              (r, id) => ({
                id: id,
                masa: masa,
                cabang: cabang,
                group: group || "TLGA",
                gol: String(r.GOLACCT || r.gol || "").trim(),
                namaGol: String(r.PJLSAN || r.namaGol || "").trim(),
                tipe: String(r.TIPE || r.tipe || "Golongan").trim(),
                awal: Number(r.AWAL || r.awal || 0),
                db: Number(r.DB || r.db || 0),
                cr: Number(r.CR || r.cr || 0),
                akhir: Number(r.AKHIR || r.akhir || 0),
              }),
            );
            send(25, `CDG selesai`);
          }

          // ==========================================
          // 2. PROSES CDD -> perkiraan_2026
          // ==========================================
          if (fileCdd) {
            send(35, "Membaca file CDD...");
            const rows = Dbf.read(fileCdd)?.rows || [];
            totalSaved += await insertBatchWithCols(
              `perkiraan${tahun}`,
              rows,
              (r, id) => ({
                id: id,
                masa: masa,
                cabang: cabang,
                group: group || "TLGA",
                gol: String(r.GOL || r.gol || "").trim(),
                noPerk: String(r.SUBACCT || r.noPerk || "").trim(),
                desc: String(r.PJLSAN || r.desc || "").trim(),
                tipe: String(r.TIPE || r.tipe || "Perkiraan").trim(),
                awal: Number(r.AWAL || r.awal || 0),
                db: Number(r.DB || r.db || 0),
                cr: Number(r.CR || r.cr || 0),
                akhir: Number(r.AKHIR || r.akhir || 0),
              }),
            );
            send(55, `CDD selesai`);
          }

          // ==========================================
          // 3. PROSES DET -> transaksi_2026
          // ==========================================
          if (fileDet) {
            send(65, "Membaca file DET...");
            const rows = Dbf.read(fileDet)?.rows || [];
            totalSaved += await insertBatchWithCols(
              `transaksi${tahun}`,
              rows,
              (r, id) => ({
                id: id + "_" + String(r.NO || r.no || 0).trim(),
                masa: masa,
                cabang: cabang,
                group: group || "TLGA",
                noreff: String(r.REFF || r.noreff || "").trim(),
                tanggal: fixDate(r.DATE || r.tanggal),
                kodeBank: String(r.REFF || r.noreff || "")
                  .trim()
                  .substring(3, 4),
                dariKePada: String(r.DARIKEPADA || r.dariKePada || "").trim(),
                noperkiraan: String(r.NOACCT || r.noperkiraan || "").trim(),
                desc: String(r.DESC || r.desc || "").trim(),
                total: Number(r.DB || r.db || 0) + Number(r.CR || r.cr || 0),
                db: Number(r.DB || r.db || 0),
                cr: Number(r.CR || r.cr || 0),
                kodeTrans: String(r.KODETRANS || r.kodeTrans || "").trim(),
              }),
            );
            send(85, `DET selesai`);
          }

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
// 18. ENDPOINT IMPOR MUTASI KASIR ONLINE (OPTIMASI KOLOM FISIK)
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
        const { cabang, hapus_tahun, hapus_bulan, group } = fields;
        const fileDbf = files["file_dbf"];

        if (!fileDbf) {
          send(100, "File DBF tidak ditemukan", { success: false });
          return res.end();
        }
        if (!cabang) {
          send(100, "Parameter cabang tidak ada", { success: false });
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

        const crypto = require("crypto");
        const client = await db.connect();
        const groupFinal = group || "TLGA";

        // ✅ UBAH: HAPUS DATA LAMA PAKAI KOLOM FISIK (Super Cepat)
        if (hapus_tahun || hapus_bulan) {
          send(20, "Menghapus data lama di database...");
          let sql = `DELETE FROM "mutasikasir" WHERE cabang = $1 AND "group" = $2`;
          let params = [cabang, groupFinal];

          // Karena kolom fisiknya 'masa', kita harus hitung masa dari tahun & bulan yang diinput
          if (hapus_tahun && hapus_bulan) {
            const masaHapus =
              hapus_bulan.padStart(2, "0") + hapus_tahun.slice(-2);
            sql += ` AND masa = $3`;
            params.push(masaHapus);
          } else if (hapus_tahun) {
            sql += ` AND masa LIKE $3`;
            params.push(`%${hapus_tahun.slice(-2)}`);
          }

          await client.query(sql, params);
          send(25, "Data lama berhasil dihapus");
        } else {
          send(25, "Mode tambah data (tidak menghapus yang lama)");
        }

        send(30, "Memproses data...");
        const noreffMap = {};
        let lastParsedFormat = "MDY";

        const validRecords = records.filter(
          (row) => Number(row.RUPIAH || 0) > 0,
        );
        send(
          40,
          `${validRecords.length} data valid ditemukan, mulai menyimpan...`,
        );

        try {
          await client.query("BEGIN");
          let savedCount = 0,
            errorCount = 0;
          const batchSize = 500;
          const totalBatches = Math.ceil(validRecords.length / batchSize);

          for (let i = 0; i < validRecords.length; i += batchSize) {
            const batch = validRecords.slice(i, i + batchSize);

            // ✅ UBAH QUERY: Pakai Kolom Fisik
            let queryText = `INSERT INTO "mutasikasir" (id, masa, cabang, "group", data) VALUES `;
            let values = [];
            let placeholders = [];

            for (const row of batch) {
              try {
                if (!row) {
                  errorCount++;
                  continue;
                }

                const getStr = (val) =>
                  val !== undefined && val !== null ? String(val).trim() : "";
                const getNum = (val) =>
                  val !== undefined && val !== null ? Number(val) : 0;

                const tglDbf = getStr(row.TANGGAL);
                const descRaw = getStr(row.PENJELASAN);
                const totalRaw = getNum(row.RUPIAH);
                const total = Math.abs(totalRaw);
                const kodeTrans = getStr(row.KODE).toUpperCase();

                if (!tglDbf || !kodeTrans || total === 0) {
                  errorCount++;
                  continue;
                }

                const desc = descRaw.toUpperCase().replace(/"/g, "'");

                let tanggalFix = "";

                // 1. Prioritas Utama: Jika library sudah mengubahnya jadi Objek Date
                if (row.TANGGAL instanceof Date) {
                  let yyyy = row.TANGGAL.getFullYear();
                  // WAJIB + 1 karena JavaScript bulan 0 = Januari, 11 = Desember
                  let mm = String(row.TANGGAL.getMonth() + 1).padStart(2, "0");
                  let dd = String(row.TANGGAL.getDate()).padStart(2, "0");

                  // Validasi tahun jangan sampai 1970 (Invalid Date)
                  if (yyyy > 2000) {
                    tanggalFix = `${yyyy}-${mm}-${dd}`;
                  }
                }
                // 2. Cadangan: Jika ternyata ada data yang lolos berupa String (MM/DD/YYYY)
                else {
                  const tglStr = String(row.TANGGAL || "")
                    .trim()
                    .replace(/[-]/g, "/")
                    .replace(/[^0-9\/]/g, "");
                  if (tglStr.includes("/")) {
                    let parts = tglStr.split("/");
                    if (parts.length === 3) {
                      let mm = parts[0].padStart(2, "0");
                      let dd = parts[1].padStart(2, "0");
                      let yyyy =
                        parts[2].length === 2 ? "20" + parts[2] : parts[2];

                      if (
                        parseInt(mm) >= 1 &&
                        parseInt(mm) <= 12 &&
                        parseInt(dd) >= 1 &&
                        parseInt(dd) <= 31
                      ) {
                        tanggalFix = `${yyyy}-${mm}-${dd}`;
                      }
                    }
                  }
                }

                // Jika setelah dua proses di atas tetap kosong, tolak baris ini
                if (!tanggalFix) {
                  errorCount++;
                  continue;
                }
                const cabShort = (cabang || "PUSAT")
                  .substring(0, 3)
                  .toUpperCase();
                const noreffKey = `${cabShort}_${tanggalFix}`;
                if (!noreffMap[noreffKey]) {
                  noreffMap[noreffKey] =
                    `KASIR-${cabShort}-${tanggalFix}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
                }

                const id = crypto.randomUUID();
                let nilaiDb = 0,
                  nilaiCr = 0;
                if (
                  ["PJ", "TK", "KT"].some((k) => kodeTrans.startsWith(k)) ||
                  totalRaw > 0
                ) {
                  nilaiDb = total;
                } else {
                  nilaiCr = total;
                }

                // Hitung masa dari tanggal yang sudah difix (format: YYYY-MM-DD -> MMYY)
                const masaFix =
                  tanggalFix.substring(5, 7) + tanggalFix.substring(2, 4);

                const jsonData = {
                  id,
                  noreff: noreffMap[noreffKey],
                  tanggal: tanggalFix,

                  kodeTrans,
                  noperkiraan: "",
                  desc,
                  total,
                  db: nilaiDb,
                  cr: nilaiCr,
                  masa: masaFix,
                  cabang: cabang, // Pastikan ini tetap masuk ke JSON
                  group: groupFinal, // Pastikan ini tetap masuk ke JSON
                };

                // ✅ UBAH BASE INDEX: Karena sekarang ada 5 kolom (id, masa, cabang, group, data)
                const base = values.length;
                placeholders.push(
                  `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
                );
                values.push(
                  id,
                  masaFix,
                  cabang,
                  groupFinal,
                  JSON.stringify(jsonData),
                );
              } catch (errPerBaris) {
                errorCount++;
                console.warn(
                  "Gagal mapping baris karena: ",
                  errPerBaris.message,
                );
              }
            }

            if (placeholders.length > 0) {
              queryText +=
                placeholders.join(", ") +
                ` ON CONFLICT (id) DO UPDATE SET masa = EXCLUDED.masa, cabang = EXCLUDED.cabang, "group" = EXCLUDED."group", data = EXCLUDED.data`;
              try {
                await client.query(queryText, values);
              } catch (errDb) {
                throw new Error("Postgres Error: " + errDb.message);
              }
            }

            savedCount += placeholders.length;
            const currentBatch = Math.floor(i / batchSize) + 1;
            const pct = 40 + Math.round((currentBatch / totalBatches) * 60);

            try {
              send(
                pct,
                `Menyimpan ke database... (${savedCount} data berhasil masuk)`,
              );
            } catch (errStream) {
              console.log("Stream terputus, tapi data tetap disimpan.");
            }
          }

          await client.query("COMMIT");
          try {
            send(
              100,
              `Sukses! ${savedCount} data kasir cabang ${cabang} tersimpan`,
              { success: true },
            );
            res.end();
          } catch (errEndStream) {
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

app.post("/api/migrasi-kolom-fisik", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });

  const secretKey = req.query.secret;
  if (secretKey !== "ubahdata2024") {
    return res.status(403).json({ error: "Akses ditolak! Butuh secret key." });
  }

  // 1. SET HEADER UNTUK SERVER-SENT EVENTS (SSE) AGAR BISA DIBACA FRONT-END ASYNCHRONOUSLY
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Fungsi pembantu untuk mengirim log terstruktur ke front-end
  const sendProgress = (status, message, table = "", percent = 0) => {
    res.write(
      `data: ${JSON.stringify({ status, message, table, percent })}\n\n`,
    );
  };

  try {
    sendProgress(
      "start",
      "🚀 Memulai migrasi data lama dengan sistem Batch (Cicilan)...",
    );

    const tablesToMigrate = [
      "golongan",
      "perkiraan",
      "transaksi",
      "mutasikasir",
      "saldo_harian",
      "saldokasirawal",
      "users",
      "kodebank",
      "cabang",
    ];

    const BATCH_SIZE = 500;

    for (const tableName of tablesToMigrate) {
      const dynamicTables = ALLOWED_TABLES.filter(
        (t) =>
          t.toLowerCase().startsWith(tableName.toLowerCase()) &&
          t.toLowerCase() !== tableName.toLowerCase(),
      );

      const tablesToProcess = [tableName, ...dynamicTables];

      for (const tName of tablesToProcess) {
        const lowerTName = tName.toLowerCase();
        const safeTable = '"' + lowerTName.replace(/"/g, '""') + '"';

        try {
          // Cek kolom fisik yang tersedia (Gunakan LOWER agar kebal huruf kapital)
          const colCheck = await db.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_schema = 'public' AND LOWER(table_name) = LOWER($1) AND column_name IN ('cabang', 'masa', 'group')`,
            [lowerTName],
          );

          const existingCols = colCheck.rows.map((r) => r.column_name);

          if (existingCols.length === 0) {
            sendProgress(
              "skip",
              `ℹ️ Ditandai skip (tidak punya kolom fisik)`,
              lowerTName,
              100,
            );
            continue;
          }

          // Hitung total baris yang perlu dimigrasi
          let whereClause = [];
          if (existingCols.includes("masa")) whereClause.push("masa IS NULL");
          if (existingCols.includes("cabang"))
            whereClause.push("cabang IS NULL");
          if (existingCols.includes("group"))
            whereClause.push('"group" IS NULL');

          const countQuery = `SELECT COUNT(*) FROM ${safeTable} WHERE ${whereClause.join(" OR ")}`;
          const countRes = await db.query(countQuery);
          const totalToMigrate = parseInt(countRes.rows[0].count);

          if (totalToMigrate === 0) {
            sendProgress(
              "success",
              `✅ Sudah aman (0 baris perlu migrasi)`,
              lowerTName,
              100,
            );
            continue;
          }

          sendProgress(
            "processing",
            `⏳ Menemukan ${totalToMigrate} baris data lama yang perlu dicicil...`,
            lowerTName,
            0,
          );

          let offset = 0;
          let totalUpdated = 0;

          // Loop Cicilan Data
          while (offset < totalToMigrate) {
            const selectQuery = `SELECT id, data FROM ${safeTable} WHERE ${whereClause.join(" OR ")} LIMIT ${BATCH_SIZE}`;
            const result = await db.query(selectQuery);

            if (result.rows.length === 0) break;

            const client = await db.connect();
            try {
              await client.query("BEGIN");

              for (const row of result.rows) {
                const jsonData =
                  typeof row.data === "string"
                    ? JSON.parse(row.data)
                    : row.data;
                const updateFields = [];
                const queryValues = [];
                let paramIndex = 1;

                if (existingCols.includes("masa")) {
                  updateFields.push(`masa = $${paramIndex++}`);
                  queryValues.push(jsonData.masa || null);
                }
                if (existingCols.includes("cabang")) {
                  updateFields.push(`cabang = $${paramIndex++}`);
                  queryValues.push(
                    jsonData.cabang || jsonData.kode_cabang || null,
                  );
                }
                if (existingCols.includes("group")) {
                  updateFields.push(`"group" = $${paramIndex++}`);
                  queryValues.push(jsonData.group || null);
                }

                if (updateFields.length > 0) {
                  queryValues.push(row.id);
                  const updateQuery = `UPDATE ${safeTable} SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`;
                  await client.query(updateQuery, queryValues);
                  totalUpdated++;
                }
              }
              await client.query("COMMIT");
            } catch (txErr) {
              await client.query("ROLLBACK");
              sendProgress(
                "error",
                `❌ Gagal pada cicilan data: ${txErr.message}`,
                lowerTName,
              );
              throw txErr;
            } finally {
              client.release();
            }

            // HITUNG PERSENTASE PROGRESS PER TABEL
            const currentPercent = Math.min(
              Math.round((totalUpdated / totalToMigrate) * 100),
              100,
            );
            sendProgress(
              "progress",
              `Memproses ${totalUpdated} / ${totalToMigrate} baris...`,
              lowerTName,
              currentPercent,
            );

            if (result.rows.length < BATCH_SIZE) break;
          }

          sendProgress(
            "success",
            `🎉 Selesai migrasi total ${totalUpdated} baris`,
            lowerTName,
            100,
          );
        } catch (err) {
          sendProgress(
            "error",
            `❌ Penghentian paksa tabel: ${err.message}`,
            tName,
          );
        }
      }
    }

    sendProgress("done", "🎉 SEMUA PROSES MIGRASI BATCH SELESAI!");
    res.end();
  } catch (e) {
    res.write(
      `data: ${JSON.stringify({ status: "fatal", message: "Error Utama: " + e.message })}\n\n`,
    );
    res.end();
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});
