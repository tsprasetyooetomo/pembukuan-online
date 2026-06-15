// ================================================================
// JARING PENGANGKAP ERROR GLOBAL (PASTE DI BARIS PALING ATAS NO 1)
// ================================================================
process.on("uncaughtException", (err) => {
  console.error("🔥 CRITICAL ERROR TERDETEKSI:", err.stack || err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 JANJI ERROR TERDETEKSI di:", promise, "alasan:", reason);
});

// ================================================================
// SERVER.JS - BACKEND PEMBUKUAN (SQLITE) - OPTIMIZED FOR RAILWAY
// ================================================================
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3"); // Pindahkan deklarasi ke atas
const app = express();

// ================================================================
// CORS & MIDDLEWARE (Harus diletakkan di atas sebelum Route)
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

// Membuka akses file statis langsung dari folder utama (root) tempat file js/css berada
app.use(express.static(path.join(__dirname)));

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

// ==========================================================
// ROUTE UTAMA (MENGGUNAKAN STANDAR EXPRESS YANG AMAN)
// ==========================================================
app.get("/", (req, res) => {
  try {
    // DISESUAIKAN: Menggunakan telaga_pembukuan.html sesuai nama file asli Anda
    const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
    res.sendFile(htmlPath);
  } catch (error) {
    console.error("❌ Gagal memuat halaman HTML:", error);
    res.status(500).send("Gagal memuat halaman pembukuan");
  }
});

// ================================================================
// INISIALISASI DATABASE & PENGHIDUPAN SERVER (URUTAN AMAN)
// ================================================================
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "pembukuan.db")
  : path.join(__dirname, "pembukuan.db");

let db;

try {
  // 1. Hubungkan Database terlebih dahulu
  db = new Database(dbPath, { verbose: console.log });
  console.log("✅ Database Pembukuan SQLite terkoneksi di:", dbPath);

  // 2. Buat tabel-tabel sampai selesai seluruhnya
  ALLOWED_TABLES.forEach((tableName) => {
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `,
    ).run();
  });
  console.log("✅ Seluruh tabel database berhasil diperiksa/dibuat.");

  // 3. JALANKAN SERVER HANYA JIKA DATABASE SUDAH SIAP TOTAL
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

// Helper Promise untuk db.run
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // 'this' mengandung properti 'changes'
    });
  });

// PASANG INI SEBAGAI GANTINYA:
const dbAll = (sql, params = []) => db.prepare(sql).all(params);

// =========================================================================
// API ROUTE: KOSONGKAN DATA TAHUNAN DI SQLITE (SESUAI STRUKTUR KEY-VALUE)
// =========================================================================
// ========================================================
// ENDPOINT: RESET DATA POSTING (3 TABEL SEKALIGUS)
// ========================================================
app.post("/api/reset-posting", async (req, res) => {
  try {
    const { masa, cabang } = req.body;
    // ✅ HANYA CEK & PRINT KE CONSOLE TERMINAL, TIDAK EKSEKUSI DATABASE
    console.log("===============================================");
    console.log("🔍 DIAGNOSTIK RESET POSTING BERJALAN");
    console.log(
      "1. Tipe Data Masa  :",
      typeof masa,
      "| Isi:",
      JSON.stringify(masa),
    );
    console.log(
      "2. Tipe Data Cabang:",
      typeof cabang,
      "| Isi:",
      JSON.stringify(cabang),
    );
    // Validasi dasar
    if (!masa || !cabang) {
      return res.status(400).json({
        success: false,
        message: "Parameter masa dan cabang wajib dikirim.",
      });
    }

    // Ambil 4 digit tahun dari masa (Format masa: "MMYY", misal "0524")
    // Jika format masa Anda "YYYY-MM", sesuaikan logika pengambilan tahunnya.
    const duaDigitTahun = masa.toString().slice(-2);
    const tahun = "20" + duaDigitTahun; // Asumsi tahun 2000-an

    // Nama tabel dinamis berdasarkan tahun
    const tabelPerkiraan = `perkiraan${tahun}`;
    const tabelGolongan = `golongan${tahun}`;
    const tabelTransaksi = `transaksi${tahun}`;

    // Array untuk menyimpan promise query agar bisa jalan paralel/berurutan
    const queries = [
      {
        table: tabelPerkiraan,
        sql: `DELETE FROM ${tabelPerkiraan} WHERE "masa" = ? AND "cabang" = ?`,
      },
      {
        table: tabelGolongan,
        sql: `DELETE FROM ${tabelGolongan} WHERE "masa" = ? AND "cabang" = ?`,
      },
      {
        table: tabelTransaksi,
        sql: `DELETE FROM ${tabelTransaksi} WHERE "masa" = ? AND "cabang" = ?`,
      },
    ];

    // Eksekusi semua query DELETE
    for (let q of queries) {
      await new Promise((resolve, reject) => {
        db.run(q.sql, [masa, cabang], function (err) {
          if (err) {
            console.error(`Gagal hapus tabel ${q.table}:`, err.message);
            reject(err);
          } else {
            console.log(
              `✅ Hapus ${q.table} (Masa: ${masa}, Cabang: ${cabang}): ${this.changes} baris terhapus.`,
            );
            resolve();
          }
        });
      });
    }

    res.json({
      success: true,
      message: `Data periode ${masa} cabang ${cabang} berhasil direset di 3 tabel.`,
    });
  } catch (error) {
    console.error("🚨 Error reset posting:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server saat mereset data.",
    });
  }
});
app.post("/api/clear-all-data", (req, res) => {
  try {
    const { storeName, masa, cabang } = req.body;

    if (!storeName) {
      return res
        .status(400)
        .json({ success: false, message: "Nama data tidak dikirim!" });
    }

    const tabelInduk = storeName.replace(/[0-9]/g, "").trim().toLowerCase();

    if (!isValidTable(tabelInduk)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak! Tabel '${tabelInduk}' tidak dikenal.`,
      });
    }

    const mengandungTahun = /\d+/.test(storeName);
    let sqlDelete = `DELETE FROM ${storeName}`;
    let params = [];

    // 🌟 1. JIKA MENGANDUNG TAHUN, CEK STRUKTUR KOLOM TABEL ASLI DI SQLITE
    if (mengandungTahun) {
      const sqlCheckColumns = `PRAGMA table_info(${storeName})`;

      // FORMAT BARU BETTER-SQLITE3 (Langsung ambil baris data tanpa callback)
      const rows = db.prepare(sqlCheckColumns).all();

      // Jika tabel belum ada di database, anggap sukses/bersih dan lewati
      if (!rows || rows.length === 0) {
        console.warn(`⚠️ Tabel '${storeName}' belum ada, dianggap bersih.`);
        return res.json({
          success: true,
          message: "Bersih (Tabel belum ada).",
          changes: 0,
        });
      }

      // Ambil daftar nama kolom asli dari tabel
      const daftarKolom = rows.map((row) => row.name.toLowerCase());
      const punyaKolomMasa = daftarKolom.includes("masa");
      const punyaKolomCabang = daftarKolom.includes("cabang");

      // 🌟 LOGIKA PENCEGATAN: Jika query butuh filter tapi kolomnya tidak ada di tabel, LEWATI
      if (
        tabelInduk.includes("transaksi") ||
        tabelInduk.includes("perkiraan") ||
        tabelInduk.includes("golongan")
      ) {
        if (!punyaKolomMasa || !punyaKolomCabang) {
          console.log(
            `ℹ️ [SKIP] Tabel '${storeName}' dilewati karena tidak memiliki kolom 'masa' atau 'cabang' di SQLite.`,
          );
          return res.json({
            success: true,
            message: `Tabel '${storeName}' dilewati otomatis (struktur kolom tidak sesuai filter).`,
            changes: 0,
          });
        }

        // Lanjutkan jika kolom lengkap, pastikan juga parameter input dari frontend tidak kosong
        if (masa && cabang) {
          sqlDelete = `DELETE FROM ${storeName} WHERE masa = ? AND cabang = ?`;
          params = [masa, cabang];
          console.log(
            `🗑️ Menjalankan SQL Spesifik: ${sqlDelete} dengan params: [${masa}, ${cabang}]`,
          );
        } else {
          console.log(
            `ℹ️ [SKIP] Tabel '${storeName}' dilewati karena parameter input 'masa' atau 'cabang' kosong.`,
          );
          return res.json({
            success: true,
            message: "Dilewati (Parameter kosong).",
            changes: 0,
          });
        }
      }
    } else {
      // Jika tidak mengandung tahun (Tabel Master biasa), langsung hapus total tanpa cek kolom
      console.log(`🗑️ Menjalankan SQL Total: ${sqlDelete}`);
    }

    // Eksekusi Hapus secara langsung (Menggantikan fungsi jalankanEksekusiDelete lama Anda jika diperlukan)
    // Jika Anda masih ingin memakai fungsi jalankanEksekusiDelete bawaan Anda, pastikan fungsinya juga sudah diubah ke format better-sqlite3
    const info = db.prepare(sqlDelete).run(params);
    return res.json({
      success: true,
      message: `Data pada tabel '${storeName}' berhasil dibersihkan.`,
      changes: info.changes,
    });
  } catch (fatalError) {
    console.error("🚨 Fatal Error di API Clear Data:", fatalError.message);
    return res
      .status(500)
      .json({ success: false, message: "Server Crash: " + fatalError.message });
  }
});

// 🌟 FUNGSI PEMBANTU UTAMAKAN EKSEKUSI AGAR KODE TIDAK DOUBLE
function jalankanEksekusiDelete(sqlDelete, params, storeName, res) {
  db.run(sqlDelete, params, function (err) {
    if (err) {
      console.error(`🚨 Gagal hapus data [${storeName}]:`, err.message);
      if (err.message.includes("no such table")) {
        return res.json({ success: true, message: "Bersih.", changes: 0 });
      }
      return res.status(500).json({ success: false, message: err.message });
    }

    console.log(`💥 Sukses hapus ${this.changes} baris dari '${storeName}'`);
    res.json({
      success: true,
      message: "Sukses dikosongkan.",
      changes: this.changes,
    });
  });
}

// ✅ KODE REVISI BACKEND: MENDUKUNG TABEL UTAMA, AWALAN BACKUP_, DAN AKHIRAN TAHUN DINAMIS
// ================================================================
// ROUTE GET DATA (SUDAH DIPERBAIKI TOTAL UNTUK BETTER-SQLITE3)
// ================================================================
app.get("/api/data/:storeName", (req, res) => {
  // <-- Hapus kata 'async'
  const { storeName } = req.params;

  // 1. Cek apakah tabel diawali dengan kata "backup_"
  const isBackupTable = String(storeName).startsWith("backup_");

  // 2. Cek apakah nama tabel berakhiran angka tahun 4 digit
  const isYearlyTable = /\d{4}$/.test(String(storeName));

  // Jika tidak memenuhi kriteria dinamis DAN tidak terdaftar di isValidTable, baru tolak (400)
  if (!isBackupTable && !isYearlyTable && !isValidTable(storeName)) {
    return res.status(400).json({ error: "Tabel tidak valid" });
  }

  try {
    // FORMAT BARU BETTER-SQLITE3: Langsung ambil data secara sinkronus tanpa await/dbAll
    const rows = db.prepare(`SELECT data FROM ${storeName}`).all();

    res.json(rows.map((row) => JSON.parse(row.data)));
  } catch (error) {
    // Jika fisik tabel tahunan/backup tersebut belum pernah dibuat di database SQLite,
    // kembalikan array kosong [] agar aplikasi browser tidak crash/mogok eror
    if (
      error.message.includes("no such table") ||
      error.message.includes("doesn't exist")
    ) {
      return res.json([]);
    }

    console.error(
      `🚨 Gagal mengambil data dari tabel ${storeName}:`,
      error.message,
    );
    res.status(500).json({ error: error.message });
  }
});

// GET: Ambil 1 data
// ================================================================
// ROUTE GET DATA BY ID (SUDAH DIPERBAIKI UNTUK BETTER-SQLITE3)
// ================================================================
app.get("/api/data/:storeName/:id", (req, res) => {
  // <-- Kata 'async' dihapus
  const { storeName, id } = req.params;

  if (!isValidTable(storeName)) {
    return res.status(400).json({ error: "Tabel tidak valid" });
  }

  try {
    // Menggunakan .get() karena hanya mengambil 1 data spesifik berdasarkan ID
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);

    if (row) {
      res.json(JSON.parse(row.data));
    } else {
      res.status(404).json({ error: "Data tidak ditemukan" });
    }
  } catch (error) {
    console.error(
      `🚨 Error ambil data ID ${id} di tabel ${storeName}:`,
      error.message,
    );
    res.status(500).json({ error: error.message });
  }
});

// POST: Tambah data baru
app.post("/api/data/:storeName", async (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    const data = req.body;
    if (!data.id)
      return res.status(400).json({ error: "Properti 'id' wajib ada" });

    await dbRun(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
      [data.id, JSON.stringify(data)],
    );
    res.status(201).json({ message: "Berhasil ditambahkan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ROUTE CRUD DATA (SUDAH DIMIGRASIKAN TOTAL KE FORMAT SINKRONUS BETTER-SQLITE3)
// ============================================================================

// 1. PUT: Update data (dengan ID di URL) - AMAN DARI OVERWRITE DATA LAMA
app.put("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const newData = req.body;

    // Ambil 1 baris data lama menggunakan .get() secara langsung
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(id);

    let mergedData = {};
    if (row) {
      const oldData = JSON.parse(row.data);
      // GABUNGKAN: Data lama + Data baru yang diubah
      mergedData = { ...oldData, ...newData };
    } else {
      mergedData = newData;
    }

    // Kunci agar ID internal JSON tidak hilang atau berubah
    mergedData.id = id;

    // Simpan kembali data yang sudah digabungkan menggunakan .run()
    db.prepare(`UPDATE ${storeName} SET data = ? WHERE id = ?`).run(
      JSON.stringify(mergedData),
      id,
    );

    res.json({ message: "Berhasil diupdate tanpa kehilangan data lama" });
  } catch (error) {
    console.error(`🚨 Error PUT BY ID di tabel ${storeName}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 2. PUT tanpa ID: Upsert (AMAN DARI OVERWRITE DATA LAMA)
app.put("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const newData = req.body;
    if (!newData.id)
      return res.status(400).json({ error: "Properti 'id' wajib ada" });

    // Ambil data lama terlebih dahulu untuk mengecek apakah ID sudah terdaftar
    const row = db
      .prepare(`SELECT data FROM ${storeName} WHERE id = ?`)
      .get(newData.id);

    let mergedData = {};
    if (row) {
      const oldData = JSON.parse(row.data);
      mergedData = { ...oldData, ...newData };
    } else {
      mergedData = newData;
    }

    // Gunakan INSERT OR REPLACE untuk menyimpan hasil penggabungan data secara utuh
    db.prepare(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
    ).run(newData.id, JSON.stringify(mergedData));

    res.json({ message: "Berhasil disimpan" });
  } catch (error) {
    console.error(`🚨 Error PUT UPSERT di tabel ${storeName}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. DELETE: Hapus 1 data
app.delete("/api/data/:storeName/:id", (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    db.prepare(`DELETE FROM ${storeName} WHERE id = ?`).run(id);
    res.json({ message: "Berhasil dihapus" });
  } catch (error) {
    console.error(`🚨 Error DELETE ID di tabel ${storeName}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4. DELETE: Kosongkan tabel
app.delete("/api/data/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    db.prepare(`DELETE FROM ${storeName}`).run();
    res.json({ message: "Tabel berhasil dikosongkan" });
  } catch (error) {
    console.error(`🚨 Error CLEAR TABLE di tabel ${storeName}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 5. GET: Hitung jumlah data
app.get("/api/count/:storeName", (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const row = db.prepare(`SELECT COUNT(id) as total FROM ${storeName}`).get();
    res.json(row ? row.total : 0);
  } catch (error) {
    console.error(`🚨 Error COUNT DATA di tabel ${storeName}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 6. GET: Backup database
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
    console.error("🚨 Error BACKEND BACKUP DATABASE:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 7. POST: Hapus data saldo harian dalam rentang tanggal tertentu sebelum ditimpa
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

    db.prepare(sql).run(kodeCabang, kodeChar, tanggalAwal, tanggalAkhir);

    res.json({
      message: `Data lama rentang ${tanggalAwal} s/d ${tanggalAkhir} berhasil dibersihkan.`,
    });
  } catch (error) {
    console.error("🚨 Error CLEAR RANGE saldo harian:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// BATCH IMPORT (Hanya 1 definisi, dengan Logika Akurat)
// ================================================================
// =========================================================================
// ============================================================================
// ROUTE BATCH PROCESSING & SALDO HARIAN (OPTIMIZED FOR BETTER-SQLITE3)
// ============================================================================

// 1. POST: Batch data dengan storeName di URL
app.post("/api/batch/:storeName", (req, res) => {
  const storeName = req.params.storeName;
  const data = req.body;

  if (!storeName) {
    return res
      .status(400)
      .json({ success: false, message: "Nama tabel wajib diisi di URL." });
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.warn(
      `ℹ️ [SKIP] Data untuk tabel '${storeName}' kosong atau bukan array.`,
    );
    return res.json({
      success: true,
      message: "Data kosong, dilewati.",
      changes: 0,
    });
  }

  console.log(`\n📝 Menjalankan SQL Batch untuk tabel [${storeName}]`);

  try {
    const sqlInsert = `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`;
    const stmt = db.prepare(sqlInsert);

    // BATCH TRANSACTION: better-sqlite3 mengunci performa super cepat secara otomatis
    const jalankanBatch = db.transaction((items) => {
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
        } catch (rowErr) {
          console.error(
            `🚨 Baris ke-${i} Gagal masuk ke [${storeName}]:`,
            rowErr.message,
          );
          errorCounter++;
        }
      }
      return errorCounter;
    });

    // Eksekusi transaksi massal
    const jumlahError = jalankanBatch(data);

    console.log(
      `💥 [SUKSES] Selesai Batch [${storeName}]. Total: ${data.length}, Error: ${jumlahError}`,
    );
    return res.json({
      success: true,
      message: `Berhasil menyimpan ${data.length} data.`,
      total: data.length,
      errorCount: jumlahError,
    });
  } catch (err) {
    console.error(`🚨 Gagal memproses SQL Batch [${storeName}]:`, err.message);
    return res
      .status(500)
      .json({ success: false, message: `SQLite Error: ${err.message}` });
  }
});

// 2. POST: Batch data dengan body request (save-batch)
app.post("/api/save-batch", (req, res) => {
  const { storeName, data } = req.body;

  if (!storeName || !Array.isArray(data) || data.length === 0) {
    console.warn(`ℹ️ [SKIP] Data untuk tabel '${storeName}' kosong.`);
    return res.json({
      success: true,
      message: "Data kosong, dilewati.",
      changes: 0,
    });
  }

  console.log(`=== DATA YANG DITERIMA UNTUK TABEL [${storeName}] ===`);
  console.table(data);

  try {
    const sqlInsert = `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`;
    const stmt = db.prepare(sqlInsert);

    const jalankanBatch = db.transaction((items) => {
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
        } catch (rowErr) {
          console.error(
            `🚨 Baris ke-${i} Gagal masuk ke [${storeName}]:`,
            rowErr.message,
          );
          errorCounter++;
        }
      }
      return errorCounter;
    });

    const jumlahError = jalankanBatch(data);

    console.log(
      `💥 [SUKSES MODEL 2 FIELD] Berhasil menyimpan ${data.length} data JSON ke tabel [${storeName}]. Error: ${jumlahError}`,
    );
    return res.json({
      success: true,
      message: `Berhasil menyimpan ${data.length} data.`,
      errorCount: jumlahError,
    });
  } catch (loopErr) {
    console.error("🚨 Gagal memproses transaksi data batch:", loopErr.message);
    return res.status(500).json({ success: false, message: loopErr.message });
  }
});

// 3. POST: Menyimpan data snapshot saldo harian
app.post("/api/saldo-harian", (req, res) => {
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;

    if (!tanggal) {
      return res.status(400).json({ error: "Tanggal wajib diisi" });
    }

    const id = `${cabang}_${char4}_${tanggal}`;
    const dataJson = JSON.stringify({ cabang, char4, tanggal, saldo_akhir });

    // FORMAT BARU SINKRONUS: Langsung prepare dan run dalam satu kali jalan
    db.prepare(
      `INSERT OR REPLACE INTO saldo_harian (id, data) VALUES (?, ?)`,
    ).run(id, dataJson);

    res.json({ success: true, message: "Snapshot saldo berhasil disimpan" });
  } catch (error) {
    console.error("🚨 Error API saldo-harian:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// START SERVER
// ================================================================

// 2. Beri izin browser untuk mengunduh file skrip pendukung (db_pbukuan.js, app_core.js, dll.)
// Jika file-file JS Anda berada di folder yang sama dengan server_pbukuan.js, gunakan kode ini:
app.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, filename);

  if (fs.existsSync(filePath)) {
    // Otomatis deteksi tipe file (.js atau .css) agar browser tidak memblokir
    if (filename.endsWith(".js")) res.type("js");
    if (filename.endsWith(".css")) res.type("css");

    res.send(fs.readFileSync(filePath));
  } else {
    res.status(404).send("File tidak ditemukan");
  }
});
