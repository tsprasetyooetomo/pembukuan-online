// ================================================================
// SERVER.JS - BACKEND PEMBUKUAN (SQLITE) - OPTIMIZED FOR RAILWAY
// ================================================================
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs"); // <-- SUDAH DITAMBAHKAN AGAR TIDAK ERROR
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
app.use(express.static(path.join(__dirname, "public")));

// ==========================================================
// JALANKAN SERVER NYA
// ==========================================================
const serverPort = process.env.PORT || 3000;
const serverHost = "0.0.0.0";

app.listen(Number(serverPort), serverHost, () => {
  console.log(
    `🚀 Server Express aktif di host ${serverHost} port ${serverPort}!`,
  );
});

// ==========================================================
// ROUTE UTAMA (MENGGUNAKAN STANDAR EXPRESS YANG AMAN)
// ==========================================================
app.get("/", (req, res) => {
  try {
    const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
    // Menggunakan res.sendFile adalah cara terbaik Express untuk memuat HTML
    res.sendFile(htmlPath);
  } catch (error) {
    console.error("❌ Gagal memuat halaman HTML:", error);
    res.status(500).send("Gagal memuat halaman pembukuan");
  }
});

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
// INISIALISASI DATABASE (BETTER-SQLITE3)
// ================================================================
const Database = require("better-sqlite3");

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "pembukuan.db")
  : path.join(__dirname, "pembukuan.db");

let db;

try {
  db = new Database(dbPath, { verbose: console.log });
  console.log("✅ Database Pembukuan SQLite terkoneksi di:", dbPath);

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
} catch (err) {
  console.error("❌ Gagal menginisialisasi Database:", err.message);
}

// Helper Promise untuk db.run
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // 'this' mengandung properti 'changes'
    });
  });

// Helper Promise untuk db.all
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

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

      db.all(sqlCheckColumns, [], function (pragmaErr, rows) {
        if (pragmaErr) {
          console.error(
            `🚨 Gagal membaca struktur tabel [${storeName}]:`,
            pragmaErr.message,
          );
          return res
            .status(500)
            .json({ success: false, message: pragmaErr.message });
        }

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

        // 🌟 LOGIKA PENCEGATAN BARU: Jika query butuh filter tapi kolomnya tidak ada di tabel, LEWATI
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

        // Eksekusi Hapus setelah pengecekan kolom aman (di dalam callback pragma)
        jalankanEksekusiDelete(sqlDelete, params, storeName, res);
      });
    } else {
      // Jika tidak mengandung tahun (Tabel Master biasa), langsung hapus total tanpa cek kolom
      console.log(`🗑️ Menjalankan SQL Total: ${sqlDelete}`);
      jalankanEksekusiDelete(sqlDelete, params, storeName, res);
    }
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
app.get("/api/data/:storeName", async (req, res) => {
  const { storeName } = req.params;

  // 1. Cek apakah tabel diawali dengan kata "backup_"
  const isBackupTable = String(storeName).startsWith("backup_");

  // 2. Cek apakah nama tabel berakhiran angka tahun 4 digit (Contoh: golongan2026, perkiraan2026)
  const isYearlyTable = /\d{4}$/.test(String(storeName));

  // Jika tidak memenuhi kriteria dinamis DAN tidak terdaftar di isValidTable, baru tolak (400)
  if (!isBackupTable && !isYearlyTable && !isValidTable(storeName)) {
    return res.status(400).json({ error: "Tabel tidak valid" });
  }

  try {
    const rows = await dbAll(`SELECT data FROM ${storeName}`);
    res.json(rows.map((row) => JSON.parse(row.data)));
  } catch (error) {
    // Jika fisik tabel tahunan/backup tersebut belum pernah dibuat di database SQLite/MySQL,
    // kembalikan array kosong [] agar aplikasi browser tidak crash/mogok eror 400/500
    if (
      error.message.includes("no such table") ||
      error.message.includes("doesn't exist")
    ) {
      return res.json([]);
    }

    res.status(500).json({ error: error.message });
  }
});

// GET: Ambil 1 data
app.get("/api/data/:storeName/:id", async (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    const rows = await dbAll(`SELECT data FROM ${storeName} WHERE id = ?`, [
      id,
    ]);
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].data));
    } else {
      res.status(404).json({ error: "Data tidak ditemukan" });
    }
  } catch (error) {
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

// PUT: Update data (dengan ID di URL) - AMAN DARI OVERWRITE DATA LAMA
app.put("/api/data/:storeName/:id", async (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const newData = req.body;

    // 1. Ambil data lama menggunakan dbAll
    const rows = await dbAll(`SELECT data FROM ${storeName} WHERE id = ?`, [
      id,
    ]);

    let mergedData = {};
    if (rows && rows.length > 0) {
      // ✅ PERBAIKAN: Gunakan rows[0].data karena dbAll mengembalikan array
      const oldData = JSON.parse(rows[0].data);
      // 2. GABUNGKAN: Data lama + Data baru yang diubah
      mergedData = { ...oldData, ...newData };
    } else {
      // Jika data belum ada di DB, gunakan data baru langsung
      mergedData = newData;
    }

    // 3. Kunci agar ID internal JSON tidak hilang atau berubah
    mergedData.id = id;

    // 4. Simpan kembali data yang sudah digabungkan utuh ke database
    await dbRun(`UPDATE ${storeName} SET data = ? WHERE id = ?`, [
      JSON.stringify(mergedData),
      id,
    ]);

    res.json({ message: "Berhasil diupdate tanpa kehilangan data lama" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT tanpa ID: Upsert (AMAN DARI OVERWRITE DATA LAMA)
app.put("/api/data/:storeName", async (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });

  try {
    const newData = req.body;
    if (!newData.id)
      return res.status(400).json({ error: "Properti 'id' wajib ada" });

    // 1. Ambil data lama terlebih dahulu untuk mengecek apakah ID sudah terdaftar
    const rows = await dbAll(`SELECT data FROM ${storeName} WHERE id = ?`, [
      newData.id,
    ]);

    let mergedData = {};
    if (rows && rows.length > 0) {
      // ✅ PERBAIKAN: Jika ID sudah ada, gabungkan data agar data lama tidak hangus
      const oldData = JSON.parse(rows[0].data);
      mergedData = { ...oldData, ...newData };
    } else {
      // Jika benar-benar data baru, gunakan data baru langsung
      mergedData = newData;
    }

    // 2. Gunakan INSERT OR REPLACE untuk menyimpan hasil penggabungan data secara utuh
    await dbRun(
      `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`,
      [newData.id, JSON.stringify(mergedData)],
    );

    res.json({ message: "Berhasil disimpan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Hapus 1 data
app.delete("/api/data/:storeName/:id", async (req, res) => {
  const { storeName, id } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    await dbRun(`DELETE FROM ${storeName} WHERE id = ?`, [id]);
    res.json({ message: "Berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Kosongkan tabel
app.delete("/api/data/:storeName", async (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    await dbRun(`DELETE FROM ${storeName}`);
    res.json({ message: "Tabel berhasil dikosongkan" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Hitung jumlah data
app.get("/api/count/:storeName", async (req, res) => {
  const { storeName } = req.params;
  if (!isValidTable(storeName))
    return res.status(400).json({ error: "Tabel tidak valid" });
  try {
    const rows = await dbAll(`SELECT COUNT(id) as total FROM ${storeName}`);
    res.json(rows[0].total);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Backup database
app.get("/api/backup", async (req, res) => {
  try {
    let backupData = {};
    for (const table of ALLOWED_TABLES) {
      const rows = await dbAll(`SELECT data FROM ${table}`);
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

// POST: Hapus data saldo harian dalam rentang tanggal tertentu sebelum ditimpa
app.post("/api/saldo-harian/clear-range", async (req, res) => {
  try {
    const { cabang, char4, tanggalAwal, tanggalAkhir } = req.body;

    if (!tanggalAwal || !tanggalAkhir) {
      return res
        .status(400)
        .json({ error: "Tanggal awal dan akhir wajib diisi" });
    }

    const kodeCabang = cabang || "Pusat";
    const kodeChar = char4 || " ";

    // Query untuk menghapus data lama berdasarkan rentang tanggal di kolom JSON data
    const sql = `
      DELETE FROM saldo_harian 
      WHERE json_extract(data, '$.cabang') = ? 
        AND json_extract(data, '$.char4') = ?
        AND json_extract(data, '$.tanggal') BETWEEN ? AND ?
    `;

    await dbRun(sql, [kodeCabang, kodeChar, tanggalAwal, tanggalAkhir]);

    res.json({
      message: `Data lama rentang ${tanggalAwal} s/d ${tanggalAkhir} berhasil dibersihkan.`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// BATCH IMPORT (Hanya 1 definisi, dengan Logika Akurat)
// ================================================================
// =========================================================================
app.post("/api/batch/:storeName", (req, res) => {
  // 1. Ambil parameter nama tabel dari URL
  const storeName = req.params.storeName;

  // 2. Ambil data body (diasumsikan langsung Array)
  const data = req.body;

  // 3. Validasi Input
  if (!storeName) {
    return res.status(400).json({
      success: false,
      message: "Nama tabel (storeName) wajib diisi di URL.",
    });
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

  // 4. Siapkan Query SQL (Model 2 Field: id dan data_json)
  // Kita menggunakan INSERT OR REPLACE agar jika ID sama, data diupdate
  const sqlInsert = `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`;

  console.log(
    `\n📝 Menjalankan SQL Batch (Format Lama) untuk tabel [${storeName}]`,
  );

  let isResponseSent = false;
  let jumlahError = 0; // Counter untuk menghitung baris gagal

  // 5. Eksekusi Transaksi
  db.serialize(() => {
    // Mulai Transaksi
    db.run("BEGIN TRANSACTION", (err) => {
      if (err && !isResponseSent) {
        isResponseSent = true;
        console.error("🚨 Gagal BEGIN TRANSACTION:", err.message);
        return res.status(500).json({
          success: false,
          message: "Gagal memulai transaksi: " + err.message,
        });
      }
    });

    // Persiapkan Statement
    const stmt = db.prepare(sqlInsert, function (prepErr) {
      if (prepErr && !isResponseSent) {
        isResponseSent = true;
        console.error(
          `🚨 [SQLITE ERROR] Gagal prepare statement untuk tabel '${storeName}':`,
          prepErr.message,
        );
        db.run("ROLLBACK");
        return res.status(500).json({
          success: false,
          message: `SQLite Error: ${prepErr.message}`,
        });
      }
    });

    if (isResponseSent) return;

    // Looping Data dan Insert
    for (let i = 0; i < data.length; i++) {
      const item = data[i];

      // Tentukan ID Unik (Fallback jika item tidak punya field id)
      const idUnik =
        item.id || item.noPerk || item.gol || item.nomor || `${storeName}_${i}`;

      // Ubah Object Item menjadi String JSON untuk kolom 'data'
      const stringDataJson = JSON.stringify(item);

      // Jalankan Insert Per Baris
      stmt.run([idUnik, stringDataJson], function (rowErr) {
        if (rowErr) {
          console.error(
            `🚨 Baris ke-${i} Gagal masuk ke [${storeName}]:`,
            rowErr.message,
          );
          jumlahError++; // Catat error
        }
      });
    }

    // Selesaikan Statement
    stmt.finalize();

    // Commit Transaksi
    db.run("COMMIT", (commitErr) => {
      if (isResponseSent) return;

      if (commitErr) {
        isResponseSent = true;
        console.error("🚨 Gagal melakukan COMMIT:", commitErr.message);
        db.run("ROLLBACK");
        return res.status(500).json({
          success: false,
          message: "Gagal menyimpan data: " + commitErr.message,
        });
      }

      // Sukses
      isResponseSent = true;
      console.log(
        `💥 [SUKSES] Selesai Batch [${storeName}]. Total: ${data.length}, Error: ${jumlahError}`,
      );

      return res.json({
        success: true,
        message: `Berhasil menyimpan ${data.length} data.`,
        total: data.length,
        errorCount: jumlahError, // Opsional: kirim jumlah error ke frontend
      });
    });
  });
});
// ✅ KODE REVISI FINAL BACKEND: MATIKAN BLOKADE 400 & AUTO-CREATE TABEL 2 FIELD (id, data)
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

  // ✅ 1. UBAH MENJADI INSERT OR REPLACE INTO
  const sqlInsert = `INSERT OR REPLACE INTO ${storeName} (id, data) VALUES (?, ?)`;
  // 🟢 TAMBAHKAN DI SINI UNTUK MELIHAT DATA UTUH DI TERMINAL
  console.log(`=== DATA YANG DITERIMA UNTUK TABEL [${storeName}] ===`);
  console.table(data); // Menampilkan data berbentuk tabel di terminal (jika Node.js mendukung struktur objeknya)

  let isResponseSent = false;
  let jumlahError = 0;

  // ✅ 2. TAMBAHKAN ASYNC PADA CALLBACK SERIALIZE
  db.serialize(async () => {
    db.run("BEGIN TRANSACTION", (err) => {
      if (err && !isResponseSent) {
        isResponseSent = true;
        console.error("🚨 Gagal BEGIN TRANSACTION:", err.message);
        return res
          .status(500)
          .json({ success: false, message: "Gagal transaksi: " + err.message });
      }
    });

    const stmt = db.prepare(sqlInsert, function (prepErr) {
      if (prepErr && !isResponseSent) {
        isResponseSent = true;
        console.error(
          `🚨 [SQLITE ERROR] Tabel '${storeName}' gagal dipersiapkan:`,
          prepErr.message,
        );
        db.run("ROLLBACK");
        return res.status(500).json({
          success: false,
          message: `SQLite Menolak: ${prepErr.message}`,
        });
      }
    });

    if (isResponseSent) return;

    try {
      // ✅ 3. GUNAKAN AWAIT PROMISE AGAR ITERASI BERJALAN SINKRON PER BARIS
      for (let i = 0; i < data.length; i++) {
        const item = data[i];

        // Tentukan ID unik
        const idUnik =
          item.id ||
          item.noPerk ||
          item.gol ||
          item.nomor ||
          `${storeName}_${i}`;
        const stringDataJson = JSON.stringify(item);

        await new Promise((resolve) => {
          stmt.run([idUnik, stringDataJson], function (rowErr) {
            if (rowErr) {
              console.error(
                `🚨 Baris ke-${i} Gagal masuk ke [${storeName}]:`,
                rowErr.message,
              );
              jumlahError++;
            }
            resolve(); // Tetap lanjut ke baris berikutnya
          });
        });
      }

      stmt.finalize();

      db.run("COMMIT", (commitErr) => {
        if (isResponseSent) return;

        if (commitErr) {
          isResponseSent = true;
          console.error("🚨 Gagal melakukan COMMIT:", commitErr.message);
          db.run("ROLLBACK");
          return res.status(500).json({
            success: false,
            message: "Gagal simpan final: " + commitErr.message,
          });
        }

        isResponseSent = true;
        console.log(
          `💥 [SUKSES MODEL 2 FIELD] Berhasil menyimpan ${data.length} data JSON ke tabel [${storeName}]. Error: ${jumlahError}`,
        );
        return res.json({
          success: true,
          message: `Berhasil menyimpan ${data.length} data.`,
          errorCount: jumlahError,
        });
      });
    } catch (loopErr) {
      if (!isResponseSent) {
        isResponseSent = true;
        db.run("ROLLBACK");
        console.error("🚨 Gagal memproses perulangan data:", loopErr.message);
        return res
          .status(500)
          .json({ success: false, message: loopErr.message });
      }
    }
  });
});

// --- TAMBAHKAN INI DI SERVER (server.js atau api.js) ---

// --- KODE PERBAIKAN ---
app.post("/api/saldo-harian", async function (req, res) {
  try {
    const { cabang, char4, tanggal, saldo_akhir } = req.body;

    if (!tanggal) {
      return res.status(400).json({ error: "Tanggal wajib diisi" });
    }

    // Kita gunakan ID unik berdasarkan kombinasi cabang, char4, dan tanggal
    const id = `${cabang}_${char4}_${tanggal}`;
    const dataJson = JSON.stringify({ cabang, char4, tanggal, saldo_akhir });

    // Gunakan helper dbRun atau query langsung
    await dbRun(
      `INSERT OR REPLACE INTO saldo_harian (id, data) VALUES (?, ?)`,
      [id, dataJson],
    );

    res.json({ success: true, message: "Snapshot saldo berhasil disimpan" });
  } catch (error) {
    console.error("Error API saldo-harian:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// START SERVER
// ================================================================

// --- KODE BARU ---
const PORT = process.env.PORT || 3000; // Gunakan env Railway, fallback ke 3000 jika lokal
// 1. Amankan rute utama untuk membaca file HTML pembukuan Anda
app.get("/", (req, res) => {
  res.type("html");
  res.send(
    fs.readFileSync(path.join(__dirname, "telaga_pembukuan.html"), "utf8"),
  );
});

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
