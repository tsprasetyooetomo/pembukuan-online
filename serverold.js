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
let express, cors, path, Pool; // 💡 Database diganti menjadi Pool bawaan library 'pg'

try {
  express = require("express");
  cors = require("cors");
  path = require("path");
  const { Pool: PgPool } = require("pg"); // 💡 Menggunakan driver pg untuk PostgreSQL Supabase
  Pool = PgPool;
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
// 3. MIDDLEWARE
// ============================================================================
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname)));

// ============================================================================
// 4. KONFIGURASI SERVER & START (PALING PENTING: DAHULUKAN)
// ============================================================================

const serverPort = process.env.PORT || 3000; // 💡 Tips Tambahan: Railway mewajibkan penggunaan process.env.PORT agar aplikasi tidak Crash
const serverHost = "0.0.0.0";

try {
  app.listen(Number(serverPort), serverHost, () => {
    console.log(`🚀 SERVER SUKSES START DI PORT: ${serverPort}`);
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

// ============================================================================
// 6. INISIALISASI DATABASE SUPABASE POSTGRESQL
// ============================================================================
const connectionString = process.env.DATABASE_URL;
let db;

try {
  if (!connectionString) {
    throw new Error(
      "Variabel DATABASE_URL tidak ditemukan di lingkungan server!",
    );
  }

  console.log("📂 Menghubungkan ke Cloud Database Supabase...");
  db = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }, // Wajib aktif agar koneksi cloud aman
  });

  // Fungsi pembuat tabel otomatis standar PostgreSQL (Menggunakan Async)
  const initTable = async (tableName) => {
    try {
      const lowerTableName = tableName.toLowerCase();

      // Jalankan query cek tabel di PostgreSQL
      const checkQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `;
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
      }
    } catch (e) {
      console.error(`⚠️ Gagal init tabel ${tableName}:`, e.message);
    }
  };

  // Menjalankan loop inisialisasi tabel secara asinkronus teratur
  (async () => {
    try {
      for (const table of ALLOWED_TABLES) {
        await initTable(table);
      }
      console.log("✅ Inisialisasi Database Supabase Selesai.");
    } catch (loopErr) {
      console.error("❌ Gagal menjalankan loop tabel:", loopErr.message);
    }
  })();
} catch (err) {
  console.error("❌ FATAL DATABASE ERROR:", err.message);
  console.error("Aplikasi akan tetap berjalan tanpa database (Mode Error).");
}

// ============================================================================
// 6. API ROUTES (WRAPPER TRY-CATCH)
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

    // Buka koneksi client khusus untuk mengelola transaksi berkelompok
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      for (const t of tables) {
        try {
          const lowerTableName = t.toLowerCase();
          // Di PostgreSQL gunakan parameter $1 dan $2
          await client.query(
            `DELETE FROM ${lowerTableName} WHERE masa = $1 AND cabang = $2`,
            [masa, cabang],
          );
        } catch (e) {
          // Abaikan jika ada satu tabel tahunan yang belum terbentuk
        }
      }

      await client.query("COMMIT");
    } catch (transactionError) {
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      client.release(); // Wajib kembalikan slot koneksi ke pool
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

    // Mengganti PRAGMA table_info SQLite dengan standar information_schema PostgreSQL
    const colCheckQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'masa';
    `;
    const colResult = await db.query(colCheckQuery, [lowerStoreName]);
    const hasMasa = colResult.rows.length > 0;

    if (hasMasa && masa && cabang) {
      sql += ` WHERE masa = $1 AND cabang = $2`;
      params = [masa, cabang];
    }

    const info = await db.query(sql, params);

    // PostgreSQL mengembalikan jumlah baris terhapus di properti .rowCount (pengganti .changes)
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
      result.rows.map((r) => {
        return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
      }),
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
    const row = result.rows[0]; // Ambil indeks ke-0 (baris pertama)

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

    // Menggunakan ON CONFLICT sebagai pengganti INSERT OR REPLACE
    await db.query(
      `INSERT INTO ${lowerStoreName} (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [data.id, JSON.stringify(data)],
    );

    res.status(201).json({ message: "Created" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 1. PUT DATA (BY ID) - UPDATE DATA JIKA ID SUDAH ADA
app.put("/api/data/:storeName/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });

    const lowerStoreName = storeName.toLowerCase();

    // Ambil data lama untuk digabungkan (merge)
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

    // Lakukan UPDATE standar PostgreSQL
    await db.query(`UPDATE ${lowerStoreName} SET data = $1 WHERE id = $2`, [
      JSON.stringify(merged),
      id,
    ]);

    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. PUT UPSERT - TIMPA ATAU BUAT DATA BARU
app.put("/api/data/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });
    const data = req.body;
    if (!data.id) return res.status(400).json({ error: "ID Required" });

    const lowerStoreName = storeName.toLowerCase();

    // Ambil data lama untuk digabungkan (merge)
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

    // Gunakan ON CONFLICT untuk fitur Upsert PostgreSQL
    await db.query(
      `INSERT INTO ${lowerStoreName} (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [data.id, JSON.stringify(merged)],
    );

    res.json({ message: "Upserted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. DELETE ONE - HAPUS SATU BARIS DATA
app.delete("/api/data/:storeName/:id", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName, id } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });

    const lowerStoreName = storeName.toLowerCase();

    // Jalankan perintah DELETE PostgreSQL dengan parameter $1
    await db.query(`DELETE FROM ${lowerStoreName} WHERE id = $1`, [id]);

    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. DELETE ALL - KOSONGKAN SELURUH ISI TABEL
app.delete("/api/data/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });

    const lowerStoreName = storeName.toLowerCase();

    // Jalankan perintah TRUNCATE atau DELETE tanpa parameter
    await db.query(`DELETE FROM ${lowerStoreName}`);

    res.json({ message: "Cleared" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// COUNT
// 1. Pastikan ada kata kunci 'async' sebelum (req, res)
app.get("/api/count/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { storeName } = req.params;
    if (!isValidTable(storeName))
      return res.status(400).json({ error: "Invalid Table" });

    // 2. Ubah nama tabel menjadi huruf kecil sesuai standar PostgreSQL
    const lowerStoreName = storeName.toLowerCase();

    // 3. Jalankan query hitung data secara asinkronus
    const result = await db.query(
      `SELECT COUNT(id) as total FROM ${lowerStoreName}`,
    );

    // 4. Di PostgreSQL, hasil query selalu berada di dalam array .rows
    const row = result.rows[0];

    // 5. Kembalikan jumlah totalnya (konversi ke tipe angka/Number karena pg mengembalikan string untuk COUNT)
    res.json(row ? Number(row.total) : 0);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// BACKUP
// 1. Tambahkan kata kunci 'async' sebelum (req, res)
app.get("/api/backup", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    let backupData = {};

    // 2. Gunakan 'for...of' sebagai pengganti '.forEach' agar bisa menggunakan 'await' di dalamnya
    for (const t of ALLOWED_TABLES) {
      try {
        const lowerTableName = t.toLowerCase();

        // 3. Ambil data menggunakan await db.query()
        const result = await db.query(`SELECT data FROM ${lowerTableName}`);

        // 4. Map data dari array .rows bawaan PostgreSQL
        backupData[t] = result.rows.map((r) => {
          // Jika data di PostgreSQL sudah otomatis berformat Object/JSON, langsung kembalikan r.data
          // Jika tipenya masih teks string, gunakan JSON.parse(r.data)
          return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
        });
      } catch (e) {
        // Jika ada tabel yang belum terbentuk di database, lewati ke tabel berikutnya
        console.warn(
          `⚠️ Gagal backup tabel ${t}, kemungkinan belum dibuat:`,
          e.message,
        );
        backupData[t] = [];
      }
    }

    res.setHeader("Content-Disposition", "attachment; filename=backup.json");
    res.json(backupData);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// BATCH
// 1. Tambahkan kata kunci 'async' sebelum (req, res)
app.post("/api/batch/:storeName", async (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName } = req.params;
    const data = req.body;
    if (!Array.isArray(data))
      return res.json({ success: true, message: "No data" });

    const lowerStoreName = storeName.toLowerCase();

    // 2. Cek apakah tabel sudah ada di PostgreSQL Supabase
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      );
    `;
    const resCheck = await db.query(checkQuery, [lowerStoreName]);
    const tableExists = resCheck.rows[0].exists;

    // 3. Auto create tabel tahunan jika belum ada
    if (!tableExists && storeName.match(/\d{4}$/)) {
      console.log(
        `🛠️ Auto-create tabel tahunan baru di Supabase: ${lowerStoreName}`,
      );
      await db.query(`
        CREATE TABLE ${lowerStoreName} (
          id TEXT PRIMARY KEY, 
          masa TEXT, 
          cabang TEXT, 
          data TEXT NOT NULL
        )
      `);
    }

    // 4. Buka koneksi client khusus dari pool untuk mengelola transaksi berkelompok
    const client = await db.connect();

    try {
      // Mulai Transaksi PostgreSQL
      await client.query("BEGIN");

      const queryText = `
        INSERT INTO ${lowerStoreName} (id, data) 
        VALUES ($1, $2)
        ON CONFLICT (id) 
        DO UPDATE SET data = EXCLUDED.data
      `;

      for (const item of data) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${lowerStoreName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const jsonData = JSON.stringify(item);

        await client.query(queryText, [id, jsonData]);
      }

      // Jika sukses semua, simpan permanen
      await client.query("COMMIT");
    } catch (transactionError) {
      // Jika ada satu saja yang gagal, batalkan semua antrean data dalam batch ini
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      // Wajib kembalikan slot koneksi ke pool agar database tidak crash/penuh
      client.release();
    }

    res.json({ success: true, count: data.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// SAVE BATCH
// 1. Tambahkan kata kunci 'async' sebelum (req, res)
app.post("/api/save-batch", async (req, res) => {
  if (!db) return res.status(500).json({ success: false, message: "DB Error" });
  try {
    const { storeName, data } = req.body;
    if (!storeName || !Array.isArray(data)) return res.json({ success: true });

    const lowerStoreName = storeName.toLowerCase();

    // 2. Buka koneksi client khusus dari pool untuk mengelola transaksi berkelompok
    const client = await db.connect();

    try {
      // Mulai Transaksi (Sama seperti db.transaction di SQLite)
      await client.query("BEGIN");

      // Siapkan Query dasar PostgreSQL Upsert
      const queryText = `
        INSERT INTO ${lowerStoreName} (id, data) 
        VALUES ($1, $2)
        ON CONFLICT (id) 
        DO UPDATE SET data = EXCLUDED.data
      `;

      // Lakukan perulangan untuk mengeksekusi semua data satu per satu
      for (const item of data) {
        const id =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${lowerStoreName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`; // Ditambah random string agar ID unik jika proses terlalu cepat

        const jsonData = JSON.stringify(item);

        // Jalankan perintah insert menggunakan client transaksi
        await client.query(queryText, [id, jsonData]);
      }

      // Jika semua data berhasil di-insert tanpa error, simpan permanen ke database
      await client.query("COMMIT");
    } catch (transactionError) {
      // Jika ada satu saja file yang error, batalkan semua perubahan (Rollback)
      await client.query("ROLLBACK");
      throw transactionError; // Lempar error ke blok catch utama di bawah
    } finally {
      // Wajib lepaskan koneksi client kembali ke pool agar server tidak hang/penuh
      client.release();
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 1. Tambahkan kata 'async' sebelum (req, res)
app.post("/api/saldo-harian/clear-range", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { cabang, char4, tanggalAwal, tanggalAkhir } = req.body;
    if (!tanggalAwal || !tanggalAkhir)
      return res.status(400).json({ error: "Date Required" });

    // 2. Gunakan operator '->>' milik PostgreSQL untuk membaca properti di dalam kolom JSON
    const sql = `
      DELETE FROM saldo_harian 
      WHERE data->>'cabang' = $1 
        AND data->>'char4' = $2 
        AND data->>'tanggal' BETWEEN $3 AND $4
    `;

    // 3. Masukkan variabel ke dalam satu Array terurut
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

// SNAPSHOT SALDO
// 1. Tambahkan kata 'async' sebelum (req, res)
app.post("/api/saldo-harian", async (req, res) => {
  if (!db) return res.status(500).json({ error: "DB Error" });
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;
    if (!tanggal) return res.status(400).json({ error: "Date Required" });
    const id = `${cabang}_${char4}_${tanggal}`;

    // Data yang akan disimpan ke kolom JSON
    const jsonData = JSON.stringify({ cabang, char4, tanggal, saldo_akhir });

    // 2. Gunakan query standar PostgreSQL Upsert ($1 dan $2 sebagai parameter)
    await db.query(
      `INSERT INTO saldo_harian (id, data) 
       VALUES ($1, $2)
       ON CONFLICT (id) 
       DO UPDATE SET data = EXCLUDED.data`,
      [id, jsonData],
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
