const path = require("path");

module.exports = (app) => {
  // ============================================================================
  // IMPORT YANG WAJIB ADA DI PALING ATAS
  // ============================================================================
  ///const express = require("express");
  //const path = require("path");

  // 🔴 PERBAIKAN 1: HAPUS BARIS "const { Pool } = require("pg");" KARENA TIDAK DIPAKAI

  // Inisialisasi Express
  //const app = express();

  // ============================================
  // TAMBAHKAN INI - Untuk melayani file CSS & JS
  // ============================================
  //app.use(express.static(__dirname));

  // Middleware wajib untuk membaca body request
  // app.use(express.json({ limit: "50mb" }));
  //app.use(express.urlencoded({ extended: true }));

  // ✅ TAMBAHKAN BARIS INI UNTUK MENGIZINKAN CORS
  const cors = require("cors");
  app.use(cors());

  // ============================================================================
  // 5. LOGIC APLIKASI (ROUTES & DATABASE)
  // ============================================================================

  // Definisi Tabel (Tetap biarkan seperti ini tidak apa-apa)
  const ALLOWED_TABLES = [
    "golongan",
    "perkiraan",
    "transaksi",
    "users",
    "kodebank",
    "cabang",
    "groupproject",
    "saldoKasir",
    "mutasikasir",
    "saldokasirawal",
    "saldopembukuan",
    "listreffkasir",
    "listrefftransaksi",
    "datasales",
    "daftarmenu",
    "hppmenu",
    "daftarbahan",
  ];

  // 🛠️ PERBAIKAN: Buat daftar tabel versi huruf kecil semua untuk pencocokan yang aman
  const LOWER_ALLOWED_TABLES = ALLOWED_TABLES.map((t) => t.toLowerCase());

  function isValidTable(name) {
    if (!name) return false;
    const lowerName = name.toLowerCase();
    if (LOWER_ALLOWED_TABLES.includes(lowerName)) return true;
    if (/\d{4}$/.test(lowerName)) {
      const baseName = lowerName.replace(/\d{4}$/, "");
      if (LOWER_ALLOWED_TABLES.includes(baseName)) return true;
    }
    if (lowerName.startsWith("backup_")) return true;
    return false;
  }

  // Route Utama (Otomatis buka HTML)
  app.get("/", (req, res) => {
    try {
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
  // API ROUTE: LOGIN SYSTEM
  // ============================================================================
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res
          .status(400)
          .json({ success: false, message: "Username & password kosong" });
      }

      const Database = require("better-sqlite3");
      const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));
      let userDitemukan = null;
      let groupData = null;

      try {
        // 1. Cari user di database berdasarkan username (Pakai LOWER agar selalu cocok)
        const sql = `SELECT * FROM users WHERE LOWER(username) = LOWER(?)`;
        userDitemukan = conn.prepare(sql).get(username);

        // 2. Jika user ditemukan, ambil data group-nya dari tabel groupproject
        if (userDitemukan) {
          const userGroupKey = userDitemukan.group || userDitemukan.kode_group;
          if (userGroupKey) {
            const sqlGroup = `SELECT * FROM groupproject WHERE id = ? OR kode = ?`;
            groupData = conn.prepare(sqlGroup).get(userGroupKey, userGroupKey);
          }
        }
      } finally {
        conn.close();
      }

      if (!userDitemukan)
        return res
          .status(401)
          .json({ success: false, message: "Username tidak terdaftar" });

      // 👉 PERUBAHAN 2: Hanya pakai metode .trim() yang aman, HAPUS pengecekan kedua
      const dbPass = String(userDitemukan.password || "").trim();
      const inputPass = String(password || "").trim();

      if (dbPass !== inputPass)
        return res
          .status(401)
          .json({ success: false, message: "Password salah" });

      // ✅ Sertakan informasi gambar atau data group pada objek balasan
      return res.json({
        success: true,
        token: "jwt_" + userDitemukan.username + "_" + Date.now(),
        user: {
          nama: userDitemukan.nama || userDitemukan.username,
          kode_cabang:
            userDitemukan.kode_cabang || userDitemukan.cabang || "Pusat",
          role: userDitemukan.role || "ADMIN",
          group: userDitemukan.group || "",
          gambar_group: groupData
            ? groupData.gambar || groupData.logo || ""
            : "",
        },
      });
    } catch (error) {
      console.error("🔥 ERROR LOGIN:", error.message);
      res
        .status(500)
        .json({ success: false, message: "Error Server: " + error.message });
    }
  });

  app.get("/app", (req, res) => {
    try {
      const htmlPath = path.join(__dirname, "pembukuan_telaga.html");
      res.sendFile(htmlPath);
    } catch (error) {
      res.status(500).send("Gagal memuat halaman pembukuan: " + error.message);
    }
  });

  // ============================================================================
  // 6. INISIALISASI DATABASE (SQLite)
  // ============================================================================
  let db;
  let rawDb; // 🔴 PERBAIKAN 2: Pindahkan deklarasi rawDb ke atas agar bisa diakses global

  try {
    console.log("📂 Mempersiapkan Database Lokal (SQLite)...");
    const Database = require("better-sqlite3");
    const dbFilePath = path.join(__dirname, "pembukuan_lokal.db");

    rawDb = new Database(dbFilePath); // Gunakan variabel global
    rawDb.pragma("journal_mode = WAL");
    rawDb.pragma("foreign_keys = ON");
    console.log("✅ Database Lokal Berhasil Terhubung!");

    db = {
      raw: rawDb,
      query: async function (sql, params = []) {
        try {
          const stmt = rawDb.prepare(sql);
          let rows = params.length > 0 ? stmt.all(...params) : stmt.all();
          if (
            sql.trim().toUpperCase().startsWith("SELECT COUNT(") ||
            sql.trim().toUpperCase().startsWith("SELECT EXISTS(")
          ) {
            return { rows: rows, rowCount: rows.length };
          }
          const isModify = /^[\s]*(DELETE|UPDATE|INSERT|CREATE|DROP)/i.test(
            sql,
          );
          if (isModify) return { rows: [], rowCount: rawDb.changes };
          return { rows: rows, rowCount: rows.length };
        } catch (err) {
          console.error("❌ SQL Error:", sql, err.message);
          throw err;
        }
      },
      connect: async function () {
        return { query: this.query.bind(this), release: function () {} };
      },
    };

    // --- LOGIKA PEMBUATAN TABEL ---
    const TABLE_STRUCTURES = {
      groupproject: "id TEXT PRIMARY KEY, kode TEXT,nama TEXT,gambar TEXT",
      cabang: 'id TEXT PRIMARY KEY, kode TEXT,nama TEXT, "group" TEXT',
      golongan:
        'id TEXT PRIMARY KEY, gol TEXT,namagol TEXT, cabang TEXT, "group" TEXT,awal REAL,db REAL,cr REAL,akhir REAL',
      perkiraan:
        'id TEXT PRIMARY KEY,  cabang TEXT, "group" TEXT,gol TEXT,noper TEXT,penjelasan TEXT,awal REAL,db REAL,cr REAL,akhir REAL',
      kodebank:
        'id TEXT PRIMARY KEY, kode TEXT,desc TEXT,noper TEXT,tgl_awal DATE,awal, cabang TEXT, "group" TEXT',
      saldokasirawal:
        'id TEXT PRIMARY KEY, tanggal DATE,saldo REAL, cabang TEXT, "group" TEXT',
      saldokas:
        'id TEXT PRIMARY KEY, tanggal DATE,noreff TEXT,awal REAL,db REAL,cr REAL,akhir REAL, cabang TEXT, "group" TEXT',
      saldopembukuan:
        'id TEXT PRIMARY KEY, tanggal DATE,kodetrans TEXT,saldo REAL, masa TEXT,cabang TEXT, "group" TEXT',
      users:
        'id TEXT PRIMARY KEY, username TEXT,nama TEXT,role TEXT,password TEXT, cabang TEXT, "group" TEXT',
      listreffkasir:
        'id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, noreff TEXT, total REAL',
      listrefftransaksi:
        'id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, tanggal DATE, noreff TEXT, total REAL, darikepada TEXT',
      daftarmenu:
        'id TEXT PRIMARY KEY,  cabang TEXT, "group" TEXT, kodemenu TEXT, namamenu TEXT, satuan TEXT, noper TEXT, kodehppmenu TEXT, sawal REAL, masuk REAL, keluar REAL, sakhir REAL, qtyawal REAL, qtymasuk REAL, qtykeluar REAL, qtyakhir REAL',
      hppmenu:
        'id TEXT PRIMARY KEY, cabang TEXT, "group" TEXT, kodehppmenu TEXT, namamenu TEXT, satuan TEXT, noper TEXT, qty REAL',
      daftarbahan:
        'id TEXT PRIMARY KEY,  cabang TEXT, "group" TEXT, kodebahan TEXT, namabahan TEXT, satuan TEXT, noper TEXT, harga REAL, sawal REAL, masuk REAL, keluar REAL, sakhir REAL',
      transaksi:
        'id TEXT PRIMARY KEY,  tanggal DATE, noreff TEXT, noper TEXT, penjelasan TEXT, db REAL, cr REAL, masa TEXT, cabang TEXT, "group" TEXT',
      datasales:
        'id TEXT PRIMARY KEY,  cabang TEXT, "group" TEXT, masa TEXT,kodemenu TEXT, namamenu TEXT, satuan TEXT, qty REAL,total REAL,noper TEXT, kodebersama TEXT',
      mutasikasir:
        'id TEXT PRIMARY KEY,  tanggal DATE, noreff TEXT, kode TEXT, penjelasan TEXT, total REAL, cabang TEXT, "group" TEXT',
    };

    const initTable = (tableName) => {
      try {
        const lowerTableName = tableName.toLowerCase();
        const tableExists = rawDb
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          )
          .get(lowerTableName);

        if (!tableExists) {
          console.log(`🛠️ Membuat tabel: ${lowerTableName}`);
          let sqlCreate = "";
          if (TABLE_STRUCTURES[lowerTableName]) {
            sqlCreate = `CREATE TABLE ${lowerTableName} (${TABLE_STRUCTURES[lowerTableName]})`;
          } else if (lowerTableName.match(/\d{4}$/)) {
            sqlCreate = `CREATE TABLE ${lowerTableName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, data TEXT NOT NULL)`;
          } else {
            sqlCreate = `CREATE TABLE ${lowerTableName} (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, data TEXT NOT NULL)`;
          }
          rawDb.exec(sqlCreate);
        } else {
          if (
            lowerTableName === "transaksi" ||
            lowerTableName === "mutasikasir"
          ) {
            const columns = rawDb
              .prepare(`PRAGMA table_info(${lowerTableName})`)
              .all();
            if (!columns.some((col) => col.name === "noreff")) {
              console.log(
                `🔹 Menambahkan kolom 'noreff' ke tabel lama: ${lowerTableName}`,
              );
              rawDb.exec(
                `ALTER TABLE ${lowerTableName} ADD COLUMN noreff TEXT;`,
              );
            }
          }
          if (
            lowerTableName === "listreffkasir" ||
            lowerTableName === "listrefftransaksi"
          ) {
            const columns = rawDb
              .prepare(`PRAGMA table_info(${lowerTableName})`)
              .all();
            if (!columns.some((col) => col.name === "noreff")) {
              console.log(
                `🔹 Menambahkan kolom 'noreff' ke tabel referensi lama: ${lowerTableName}`,
              );
              rawDb.exec(
                `ALTER TABLE ${lowerTableName} ADD COLUMN noreff TEXT;`,
              );
            }
            if (!columns.some((col) => col.name === "masa")) {
              console.log(
                `🔹 Menambahkan kolom 'masa' ke tabel referensi lama: ${lowerTableName}`,
              );
              rawDb.exec(`ALTER TABLE ${lowerTableName} ADD COLUMN masa TEXT;`);
            }
          }
          if (lowerTableName === "datasales") {
            const columns = rawDb
              .prepare(`PRAGMA table_info(${lowerTableName})`)
              .all();
            if (!columns.some((col) => col.name === "kodebersama")) {
              console.log(
                `🔹 Menambahkan kolom 'kodebersama' ke tabel lama: ${lowerTableName}`,
              );
              rawDb.exec(
                `ALTER TABLE ${lowerTableName} ADD COLUMN kodebersama TEXT;`,
              );
            }
          }

          if (lowerTableName === "groupproject") {
            const columns = rawDb
              .prepare(`PRAGMA table_info(${lowerTableName})`)
              .all();
            if (!columns.some((col) => col.name === "gambar")) {
              console.log(
                `🔹 Menambahkan kolom 'gambar' ke tabel lama: ${lowerTableName}`,
              );
              rawDb.exec(
                `ALTER TABLE ${lowerTableName} ADD COLUMN gambar TEXT;`,
              );
            }
          }

          // 👆 SELESAI TAMBAHAN 👆
        }
      } catch (e) {
        console.error(`⚠️ Gagal init/migrasi tabel ${tableName}:`, e.message);
      }
    };

    for (const table of ALLOWED_TABLES) {
      initTable(table);
    }
    console.log("🚀 Sistem Siap!");
  } catch (err) {
    console.error("❌ Error Database:", err.message);
  }

  // ============================================================================
  // 7. EKSPOR MODULE (UNTUK KEBUTUHAN INJECT/LAINNYA)
  // ============================================================================
  // 🔴 PERBAIKAN 3: Gunakan variabel rawDb yang SUDAH DIBUKA di atas, JANGAN buka dua kali!
  module.exports = db;
  module.exports.rawDb = rawDb;
  // --- API ROUTES ---

  // ========================================================
  // MAGIC ADAPTER: Menyamarikan SQLite agar bisa dipakai seperti PostgreSQL
  // ========================================================
  const originalDb = db;

  const proxyDb = new Proxy(originalDb, {
    get(target, prop) {
      if (prop === "rawDb") {
        return rawDb; // 🌟 Amankan ekspor rawDb agar bisa diakses modul lain
      }

      if (prop === "query") {
        return function (sql, params = []) {
          try {
            const stmt = rawDb.prepare(sql);
            const trimmedSql = sql.trim().toUpperCase();

            // Deteksi apakah ini query modifikasi (INSERT, UPDATE, DELETE, dll)
            const isModify = /^[\s]*(DELETE|UPDATE|INSERT|CREATE|DROP)/i.test(
              trimmedSql,
            );

            if (isModify) {
              const info = params.length > 0 ? stmt.run(...params) : stmt.run();
              return { rows: [], rowCount: info.changes };
            }

            // Jika query SELECT biasa
            const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
            return { rows: rows, rowCount: rows.length };
          } catch (err) {
            console.error("❌ Proxy SQL Error:", sql, err.message);
            throw err;
          }
        };
      }

      if (prop === "connect") {
        return async () => {
          return {
            query: async (sql, params) => proxyDb.query(sql, params),
            release: () => {},
          };
        };
      }
      return target[prop];
    },
  });

  // Timpa export db dengan versi proxy-nya, sertakan juga rawDb secara aman
  module.exports = proxyDb;
  module.exports.rawDb = rawDb;

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
              `DELETE FROM ${lowerTableName} WHERE masa = ? AND cabang = ?`,
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

  // 4. GET BY ID
  app.get("/api/data/:storeName/:id", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB Error" });
    try {
      const { storeName, id } = req.params;
      if (!isValidTable(storeName))
        return res.status(400).json({ error: "Invalid Table" });

      const lowerStoreName = storeName.toLowerCase();

      // ✅ Langsung ambil semua kolom fisik berdasarkan ID
      const result = await db.query(
        `SELECT * FROM "${lowerStoreName}" WHERE id = ?`,
        [id],
      );

      const row = result.rows[0];
      if (row) {
        res.json(row); // Langsung kirim objek fisik, tidak perlu JSON.parse lagi
      } else {
        res.status(404).json({ error: "Not Found" });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. CLEAR ALL DATA (Saya pindahkan ke urutan bawah supaya rapi)
  app.post("/api/clear-all-data", async (req, res) => {
    try {
      const { storeName, masa, cabang, tahun, bulan, group } = req.body;
      let groupParam = group || req.body.groupParam || "";
      if (groupParam === "-") groupParam = "";
      const masaRef = req.body.masaRef || masa || null;

      const cekTabelValid = (table) => {
        const daftarTabelAman = [
          "transaksi",
          "mutasikasir",
          "kodebank",
          "saldokasir",
          "golongan",
          "perkiraan",
          "listreffkasir",
          "listrefftransaksi",
          "datasales",
          "daftarmenu",
          "saldopembukuan",
        ];
        return daftarTabelAman.includes(table.toLowerCase());
      };

      if (!storeName || !cekTabelValid(storeName)) {
        return res.status(403).json({
          success: false,
          message: "Tabel tidak valid atau tidak diizinkan",
        });
      }

      const lowerStoreName = storeName.toLowerCase();

      const Database = require("better-sqlite3");
      const path = require("path");
      const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));

      try {
        let deletedCount = 0;
        const isAllCabang = !cabang || cabang === "ALL" || cabang === "";
        const isAllGroup = !groupParam || groupParam === "";

        // =======================================================================
        // 1. LOGIKA KHUSUS MUTASI KASIR (FISIK)
        // =======================================================================
        if (lowerStoreName === "mutasikasir") {
          let sql = `DELETE FROM ${lowerStoreName} WHERE 1=1`;
          let params = [];

          if (req.body.noreff) {
            sql += ` AND noreff = ?`;
            params.push(req.body.noreff);
          }

          if (!isAllCabang) {
            sql += ` AND (cabang = ? OR kode_cabang = ?)`;
            params.push(cabang, cabang);
          }

          if (!isAllGroup) {
            sql += ` AND UPPER("group") = ?`;
            params.push(groupParam.toUpperCase());
          }

          if (tahun && tahun !== "") {
            if (bulan && bulan !== "") {
              sql += ` AND (tanggal LIKE ?)`;
              params.push(`${tahun}-${bulan}%`);
            } else {
              sql += ` AND (tanggal LIKE ?)`;
              params.push(`${tahun}-%`);
            }
          }

          const info = conn.prepare(sql).run(...params);
          deletedCount = info.changes;

          // PEMBERSIHAN LISTREFKASIR (FISIK)
          let sqlRef = "DELETE FROM listreffkasir WHERE 1=1";
          let paramsRef = [];

          if (!isAllGroup) {
            sqlRef += ' AND UPPER("group") = ?';
            paramsRef.push(groupParam.toUpperCase());
          }
          if (!isAllCabang) {
            sqlRef += " AND cabang = ?";
            paramsRef.push(cabang);
          }
          if (tahun || bulan || masaRef) {
            if (tahun && bulan) {
              const formatMasaNormal = `${bulan}${String(tahun).substring(2, 4)}`;
              sqlRef += " AND (masa = ? OR tanggal LIKE ? OR noreff LIKE ?)";
              paramsRef.push(
                formatMasaNormal,
                `${tahun}-${bulan}%`,
                `%-${tahun}-${bulan}-%`,
              );
            } else if (tahun) {
              const shortYear = String(tahun).substring(2, 4);
              sqlRef += " AND (masa LIKE ? OR tanggal LIKE ? OR noreff LIKE ?)";
              paramsRef.push(`%${shortYear}`, `${tahun}-%`, `%-${tahun}-%`);
            }
          }

          try {
            const infoRef = conn.prepare(sqlRef).run(...paramsRef);
            console.log(
              `✅ BERHASIL DIHAPUS: ${infoRef.changes} baris data listreffkasir terhapus.`,
            );
          } catch (refErr) {
            console.error("⚠️ Gagal clear listreffkasir:", refErr.message);
          }
        }

        // =======================================================================
        // 2. LOGIKA UNTUK TABEL MASTER FISIK (golongan, perkiraan, kodebank, dll)
        // =======================================================================
        else if (
          [
            "golongan",
            "perkiraan",
            "kodebank",
            "daftarmenu",
            "saldokasir",
            "datasales",
          ].includes(lowerStoreName)
        ) {
          let sql = `DELETE FROM ${lowerStoreName} WHERE 1=1`;
          let params = [];

          if (!isAllCabang) {
            sql += ` AND cabang = ?`;
            params.push(cabang);
          }

          if (!isAllGroup) {
            sql += ` AND "group" = ?`;
            params.push(groupParam);
          }

          const info = conn.prepare(sql).run(...params);
          deletedCount = info.changes;
        }

        // =======================================================================
        // 3. LOGIKA UNTUK TABEL TRANSAKSI & LAINNYA YANG MEMILIKI MASA
        // =======================================================================
        else {
          let sql = `DELETE FROM ${lowerStoreName} WHERE 1=1`;
          let params = [];

          if (masa && masa !== "") {
            sql += ` AND masa = ?`;
            params.push(masa);
          } else if (tahun && tahun !== "") {
            sql += ` AND masa LIKE ?`;
            params.push(`%${String(tahun).slice(-2)}`);
          }

          if (!isAllCabang) {
            sql += ` AND cabang = ?`;
            params.push(cabang);
          }

          if (!isAllGroup) {
            sql += ` AND "group" = ?`;
            params.push(groupParam);
          }

          const info = conn.prepare(sql).run(...params);
          deletedCount = info.changes;

          // PEMBERSIHAN LISTREFFTRANSAKSI
          if (lowerStoreName === "transaksi") {
            let sqlRef = `DELETE FROM listrefftransaksi WHERE 1=1`;
            let paramsRef = [];

            if (!isAllGroup) {
              sqlRef += ` AND "group" = ?`;
              paramsRef.push(groupParam);
            }

            if (!isAllCabang) {
              sqlRef += ` AND cabang = ?`;
              paramsRef.push(cabang);
            }

            if (masaRef && String(masaRef).length === 4) {
              sqlRef += ` AND masa = ?`;
              paramsRef.push(masaRef);
            } else if (tahun && tahun !== "") {
              const shortYear = String(tahun).slice(-2);
              sqlRef += ` AND masa LIKE ?`;
              paramsRef.push(`%${shortYear}`);
            }

            try {
              const infoRef = conn.prepare(sqlRef).run(...paramsRef);
              console.log(
                `✅ listrefftransaksi dibersihkan. Baris terhapus: ${infoRef.changes}`,
              );
            } catch (refErr) {
              console.error(
                `⚠️ Gagal clear listrefftransaksi:`,
                refErr.message,
              );
            }
          }
        }

        res.status(200).json({ success: true, changes: deletedCount });
      } finally {
        conn.close();
      }
    } catch (e) {
      console.error("❌ GAGAL CLEAR DATA:", e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });
  // 3. GET ALL DATA
  app.get("/api/data/:storeName", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB Error" });

    try {
      const { storeName } = req.params;
      const filterCabang = req.query.cabang;

      const userRole = (
        req.headers["x-user-role"] ||
        req.query.role ||
        ""
      ).toUpperCase();
      const userGroup =
        req.headers["x-user-group"] || req.query.userGroup || "";
      let filterGroup = req.query.group;

      if (userRole !== "ADMIN") {
        if (userGroup && userGroup.trim() !== "") filterGroup = userGroup;
      } else {
        if (filterGroup && filterGroup.toUpperCase() === "PUSAT")
          filterGroup = null;
      }

      if (!isValidTable(storeName)) {
        return res.status(400).json({ error: "Invalid Table" });
      }

      const lowerStoreName = storeName.toLowerCase();
      let clauses = [];
      let params = [];

      // Filter Group (Untuk Semua Tabel Fisik)
      // Filter Group (Untuk Semua Tabel Fisik, KECUALI groupproject)
      if (filterGroup && filterGroup.trim() !== "") {
        if (!/^[a-zA-Z0-9\-_ ]+$/.test(filterGroup)) {
          return res.status(400).json({ error: "Kode group tidak valid" });
        }

        // Pengecualian: Tabel groupproject tidak memiliki kolom "group"
        if (lowerStoreName !== "groupproject") {
          clauses.push(`"group" = ?`);
          params.push(filterGroup);
        }
      }

      // Filter Cabang (Kecuali tabel yang memang tidak punya cabang)
      const tabelTanpaCabang = [
        "groupproject",
        "listreffkasir",
        "listrefftransaksi",
        "formatrl",
        "formatneraca",
        "postedmonths",
      ];
      if (!tabelTanpaCabang.includes(lowerStoreName)) {
        if (
          filterCabang &&
          filterCabang.trim() !== "" &&
          filterCabang.toUpperCase() !== "PUSAT"
        ) {
          if (!/^[a-zA-Z0-9\-_ ]+$/.test(filterCabang)) {
            return res.status(400).json({ error: "Kode cabang tidak valid" });
          }
          clauses.push(`cabang = ?`);
          params.push(filterCabang);
        }
      }

      // ✅ QUERY FISIK MUTLAK (Tidak ada lagi if/else yang nyangkut ke SELECT data)
      let sql = `SELECT * FROM "${lowerStoreName}"`;
      if (clauses.length > 0) {
        sql += ` WHERE ` + clauses.join(" AND ");
      }

      var result = await db.query(sql, params);

      const sanitizeRow = (row) => {
        const clean = {};
        for (const key in row) {
          const val = row[key];
          clean[key] =
            val === null || val === undefined
              ? ""
              : typeof val === "object"
                ? JSON.stringify(val)
                : String(val);
        }
        return clean;
      };

      let allData = result.rows.map(sanitizeRow);
      res.json(allData);
    } catch (e) {
      console.error("🔥 ERROR FETCH DATA API:", e.message);
      res.status(500).json({ error: e.message });
    }
  });
  // 5. POST DATA
  app.post("/api/data/:storeName", async (req, res) => {
    try {
      const { storeName } = req.params;
      if (!isValidTable(storeName))
        return res.status(400).json({ error: "Invalid Table" });

      const data = req.body;
      if (!data.id) return res.status(400).json({ error: "ID Required" });

      const lowerStoreName = storeName.toLowerCase();
      const Database = require("better-sqlite3");
      const path = require("path");
      const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));

      try {
        // Ambil daftar kolom yang BENAR-BENAR ada di database
        const tableInfo = conn.pragma(`table_info("${lowerStoreName}")`);
        const validCols = {};
        tableInfo.forEach((col) => {
          validCols[col.name] = true;
        });

        // Saring data dari frontend, hanya ambil yang kolomnya ada di database
        const keys = Object.keys(data).filter(
          (k) => k !== "id" && validCols[k] === true,
        );

        if (keys.length === 0) {
          return res.status(400).json({ error: "Tidak ada kolom valid" });
        }

        const values = keys.map((k) =>
          data[k] === undefined ? null : data[k],
        );

        // Gabungkan id dan kolom lainnya
        const allKeys = ["id", ...keys];
        const allValues = [data.id, ...values];

        // Buat query aman
        const columns = allKeys
          .map((k) => (k === "group" ? '"group"' : `[${k}]`))
          .join(", ");
        const placeholders = allKeys.map(() => "?").join(", ");

        const sql = `INSERT OR REPLACE INTO [${lowerStoreName}] (${columns}) VALUES (${placeholders})`;

        conn.prepare(sql).run(...allValues);

        res.status(201).json({ message: "Created", success: true });
      } finally {
        conn.close();
      }
    } catch (e) {
      console.error("❌ GAGAL SIMPAN DATA:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // HELPER UNTUK EKSEKUSI UPDATE
  // ==========================================

  // 6. PUT DATA (BY ID)

  app.put("/api/data/:storeName/:id", async (req, res) => {
    try {
      const { storeName, id } = req.params;
      const lowerStoreName = storeName.toLowerCase();

      if (!isValidTable(lowerStoreName)) {
        return res.status(400).json({ error: "Invalid Table" });
      }

      const data = req.body;
      // Hapus id dari body jika ada, agar tidak diupdate (id adalah parameter URL)
      if (data.id) delete data.id;

      // ==========================================
      // 🛠️ KEAMANAN: CEK FISIK DATABASE & GUNAKAN BETTER-SQLITE3
      // ==========================================
      const Database = require("better-sqlite3");
      const path = require("path");
      const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));

      try {
        // 1. Ambil daftar kolom fisik yang BENAR-BENAR ada di database
        const tableInfo = conn.pragma(`table_info("${lowerStoreName}")`);
        const validColumns = new Set(
          tableInfo.map((col) => col.name.toLowerCase()),
        );

        // 2. Normalisasi huruf kecil & Filter hanya kolom yang valid (buang 'awal', 'tgl_awal', dll)
        const finalData = {};
        for (const key in data) {
          const lowKey = key.toLowerCase();
          if (validColumns.has(lowKey)) {
            finalData[lowKey] = data[key];
          }
        }

        const keys = Object.keys(finalData);
        if (keys.length === 0) {
          return res
            .status(400)
            .json({ error: "Tidak ada kolom valid untuk diupdate" });
        }

        // 3. Bangun query dinamis aman
        const setClause = keys
          .map((k) => (k === "group" ? `"group" = ?` : `\`${k}\` = ?`))
          .join(", ");
        const values = keys.map((k) =>
          finalData[k] === undefined ? null : finalData[k],
        );

        const sql = `UPDATE "${lowerStoreName}" SET ${setClause} WHERE id = ?`;

        // Gunakan .prepare().run() khusus better-sqlite3
        conn.prepare(sql).run(...values, id);

        res.json({ message: "Updated" });
      } finally {
        conn.close();
      }
    } catch (e) {
      console.error("❌ GAGAL UPDATE DATA:", e.message);
      res.status(500).json({ error: e.message });
    }
  });
  // LETAKKAN INI SEBELUM route put biasa

  // 7. PUT UPSERT
  app.put("/api/data/:storeName", async (req, res) => {
    if (!db) return res.status(500).json({ error: "DB Error" });

    try {
      const { storeName } = req.params;
      const lowerStoreName = storeName.toLowerCase();

      if (!isValidTable(lowerStoreName)) {
        return res.status(400).json({ error: "Invalid Table" });
      }

      const data = req.body;

      if (Array.isArray(data)) {
        return res.status(400).json({ error: "Use batch endpoint for array" });
      }

      if (!data.id) {
        return res.status(400).json({ error: "ID Required" });
      }

      const updates = {};
      for (const [key, value] of Object.entries(data)) {
        if (key === "id") continue;
        if (lowerStoreName === "datasales" && key === "kode") continue;
        if (lowerStoreName === "datasales" && key.toLowerCase() === "amount") {
          continue;
        }
        if (value !== undefined) updates[key] = value;
      }

      if (Object.keys(updates).length === 0) {
        return res.json({ message: "No fields to update" });
      }

      const col = (k) => (k === "group" ? `"${k}"` : `\`${k}\``);
      const keys = Object.keys(updates);
      const values = keys.map((k) => updates[k]);
      const updateSet = keys.map((k) => `${col(k)} = ?`).join(", ");

      const sql = `
      UPDATE \`${lowerStoreName}\` 
      SET ${updateSet}
      WHERE id = ?
    `;

      // ==========================================
      // 🛠️ PERBAIKAN: Gunakan better-sqlite3 langsung
      // ==========================================
      const Database = require("better-sqlite3");
      const path = require("path");
      const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));

      let affected = 0;
      try {
        const stmt = conn.prepare(sql);
        const info = stmt.run([...values, data.id]);
        affected = info.changes || 0;
      } finally {
        conn.close();
      }

      if (affected === 0) {
        return res.status(404).json({ error: "Data not found" });
      }

      res.json({ message: "Updated", rowsAffected: affected });
    } catch (e) {
      console.error("❌ GAGAL UPDATE:", e.message);
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

      // Ditambahkan tanda kutip backtick (`) di nama tabel untuk keamanan (terutama untuk tabel seperti golongan2024)
      await db.query(
        `DELETE FROM "${lowerStoreName}" WHERE id = ? RETURNING *`,
        [id],
      );

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

      // Ditambahkan tanda kutip backtick (`) di nama tabel
      await db.exec(`DELETE FROM "${storeName.toLowerCase()}"`);
      res.json({ success: true, message: "Cleared" });
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

      // Ditambahkan tanda kutip backtick (`) di nama tabel
      const result = await db.query(
        `SELECT COUNT(id) as total FROM "${lowerStoreName}"`,
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
          // ✅ Diubah ke SELECT * karena sudah tabel fisik
          const result = await db.query(`SELECT * FROM "${lowerTableName}"`);
          backupData[t] = result.rows; // Langsung kirim objek fisik, tidak perlu JSON.parse lagi
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
  // 12. BATCH (SUPER FAST + BUGFIX VERSION)
  app.post("/api/batch/:storeName", async (req, res) => {
    try {
      const { storeName } = req.params;
      const data = req.body;

      if (!Array.isArray(data) || data.length === 0) {
        return res.json({ success: true, message: "No data" });
      }

      const lowerStoreName = storeName.toLowerCase();

      if (!/^[a-zA-Z0-9_]+$/.test(lowerStoreName)) {
        return res
          .status(400)
          .json({ success: false, message: "Nama store tidak valid" });
      }

      const Database = require("better-sqlite3");
      const path = require("path");
      const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));

      try {
        // 1. PASTIKAN TABEL LISTREFF DAN KOLOMNYA SEMPURNA
        conn.exec(
          `CREATE TABLE IF NOT EXISTS listrefftransaksi (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, tanggal DATE, noreff TEXT, total REAL, darikepada TEXT)`,
        );

        // ✅ FIX BUG 2: Penyuntikan case-insensitive (GROUP vs group)
        const fixCols = (colName, colType) => {
          const info = conn.pragma(`table_info(listrefftransaksi)`);
          if (
            !info.some((c) => c.name.toLowerCase() === colName.toLowerCase())
          ) {
            try {
              conn.exec(
                `ALTER TABLE listrefftransaksi ADD COLUMN "${colName}" ${colType}`,
              );
            } catch (e) {}
          }
        };
        fixCols("group", "TEXT");
        fixCols("darikepada", "TEXT");
        fixCols("total", "REAL");

        conn.exec(
          `CREATE INDEX IF NOT EXISTS idx_reff_seeker ON listrefftransaksi(noreff, masa, cabang)`,
        );

        const stmtCekGroupCabang = conn.prepare(
          `SELECT "group" FROM cabang WHERE id = ? OR kode = ? LIMIT 1`,
        );

        let stmtCariNoper = null;
        if (lowerStoreName === "datasales") {
          stmtCariNoper = conn.prepare(
            `SELECT noper FROM daftarmenu WHERE kodemenu = ? AND cabang = ? AND "group" = ? LIMIT 1`,
          );
        }

        // 2. SIAPKAN QUERY DINAMIS
        const tableInfo = conn.pragma(`table_info(\`${lowerStoreName}\`)`);
        const validColumnsSet = new Set(
          tableInfo.map((col) => col.name.toLowerCase()),
        );

        const dbColumns = [...validColumnsSet].filter((c) => c !== "id");
        const sqlColumns = dbColumns
          .map((c) => (c === "group" ? `"${c}"` : `\`${c}\``))
          .join(", ");
        const placeholders = dbColumns.map(() => "?").join(", ");

        const sql = `INSERT OR REPLACE INTO \`${lowerStoreName}\` (\`id\`, ${sqlColumns}) VALUES (?, ${placeholders})`;
        const stmt = conn.prepare(sql);
        const chunkSize = 10000;

        // ✅ 1. TAMBAHKAN STATEMENT DELETE UNTUK DATASALES
        let stmtDeleteSales = null;
        if (lowerStoreName === "datasales") {
          stmtDeleteSales = conn.prepare(
            `DELETE FROM datasales WHERE masa = ? AND cabang = ? AND "group" = ?`,
          );
        }

        // ✅ 2. TAMBAHKAN STATEMENT AUTO-INSERT KE DAFTARMENU
        let stmtInsertMenu = null;
        if (lowerStoreName === "datasales") {
          stmtInsertMenu = conn.prepare(
            `INSERT OR IGNORE INTO daftarmenu (id, kodemenu, namamenu, cabang, "group") VALUES (?, ?, ?, ?, ?)`,
          );
        }

        const executeChunkTransaction = conn.transaction((chunkItems) => {
          // VFP SEEK INDEX hanya dipakai jika ini memang listrefftransaksi
          const seekIndex = new Set();
          if (lowerStoreName === "listrefftransaksi") {
            const existingData = conn
              .prepare(
                `SELECT noreff || '_' || masa || '_' || cabang as key FROM listrefftransaksi`,
              )
              .all();
            existingData.forEach((row) => seekIndex.add(row.key));
          }

          // Set untuk menghindari eksekusi DELETE berulang kali di dalam 1 chunk untuk kombinasi yang sama
          const deletedCombos = new Set();

          for (const item of chunkItems) {
            const id =
              item.id ||
              `${lowerStoreName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const cabang = item.cabang || item.kode_cabang || item.CABANG || "";

            let groupVal = "";
            if (cabang) {
              try {
                const cabangRow = stmtCekGroupCabang.get(cabang, cabang);
                if (
                  cabangRow &&
                  cabangRow.group &&
                  cabangRow.group !== "undefined"
                ) {
                  groupVal = cabangRow.group;
                }
              } catch (e) {}
            }

            if (!groupVal) {
              groupVal = item.group || item.GROUP || "";
            }

            if (
              !groupVal ||
              groupVal === "undefined" ||
              groupVal.trim() === ""
            ) {
              groupVal = "TLGA";
            }

            const noreff = item.noreff || item.NOREFF || item.no_reff || "";
            const tanggalVal =
              item.tanggal || item.TANGGAL || item.date || item.DATE || "";

            let masa = item.masa || item.MASA || "";
            if (!masa && tanggalVal) {
              let tglStr = String(tanggalVal).trim();
              if (tglStr.includes("T")) tglStr = tglStr.split("T")[0];
              let tglRaw = tglStr.replace(/\//g, "-");
              const parts = tglRaw.split("-");
              if (parts.length === 3) {
                if (parts[0].length === 4)
                  masa = parts[1] + parts[0].substring(2, 4);
                else if (parts[2].length === 4)
                  masa = parts[1] + parts[2].substring(2, 4);
              }
            }
            if (!masa || masa.length !== 4 || masa.includes("undefined"))
              masa = "";

            if (lowerStoreName === "listrefftransaksi") {
              if (noreff && masa && cabang) {
                const keyToSeek = `${noreff}_${masa}_${cabang}`;
                if (seekIndex.has(keyToSeek)) continue;
                else seekIndex.add(keyToSeek);
              }
            }

            // ===================================================
            // ✅ EKSEKUSI DELETE DATASALES (HAPUS DATA LAMA)
            // ===================================================
            if (lowerStoreName === "datasales" && masa && cabang && groupVal) {
              const delKey = `${masa}_${cabang}_${groupVal}`;
              if (!deletedCombos.has(delKey)) {
                try {
                  stmtDeleteSales.run(masa, cabang, groupVal);
                  deletedCombos.add(delKey); // Tandai sudah dihapus supaya tidak query DELETE lagi untuk data selanjutnya di chunk yang sama
                } catch (e) {}
              }
            }

            let finalItem = {
              ...item,
              id,
              group: groupVal,
              cabang: cabang,
              noreff: noreff,
              tanggal: tanggalVal,
              masa: masa,
              noper:
                item.noper || item.NOPER || item.no_per || item.noacct || "",
              penjelasan:
                item.penjelasan ||
                item.PENJELASAN ||
                item.desc ||
                item.DESC ||
                "",
            };
            delete finalItem._compositeKey;
            delete finalItem._finalId;

            // ===================================================
            // ✅ LOGIKA CEK & AUTO-INSERT DAFTARMENU
            // ===================================================
            if (lowerStoreName === "datasales") {
              let foundNoper = "";
              const kodeMenuCari = String(
                item.kodemenu || item.kode || "",
              ).trim();
              const namaMenuCari = String(
                item.namamenu || item.namaMenu || item.nama_menu || "",
              ).trim();

              if (kodeMenuCari) {
                try {
                  const rowMenu = stmtCariNoper.get(
                    kodeMenuCari,
                    cabang,
                    groupVal,
                  );

                  if (rowMenu) {
                    foundNoper = rowMenu.noper;
                  } else {
                    // ✅ JIKA TIDAK ADA DI DAFTARMENU, LANGSUNG BUATKAN BARU
                    try {
                      const idMenu = `daftarmenu_${kodeMenuCari}_${cabang}_${groupVal}`;
                      stmtInsertMenu.run(
                        idMenu,
                        kodeMenuCari,
                        namaMenuCari || "-",
                        cabang,
                        groupVal,
                      );

                      // Setelah diinsert, ambil ulang noper-nya (jika ada trigger default atau langsung set kosong)
                      const rowMenuBaru = stmtCariNoper.get(
                        kodeMenuCari,
                        cabang,
                        groupVal,
                      );
                      if (rowMenuBaru) foundNoper = rowMenuBaru.noper;
                    } catch (e) {
                      console.log("Gagal auto-insert daftarmenu:", e.message);
                    }
                  }
                } catch (e) {}
              }
              finalItem.noper = foundNoper;
            }

            const itemLookup = {};
            for (const k in finalItem) {
              itemLookup[k.toLowerCase()] = finalItem[k];
            }

            const values = dbColumns.map((col) => {
              const val = itemLookup[col];
              return val !== undefined && val !== null ? val : null;
            });

            stmt.run(id, ...values);
          }
        });

        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          executeChunkTransaction(chunk);
        }

        console.log(`✅ Sukses memproses batch tabel ${lowerStoreName}`);
        res.json({ success: true, count: data.length });
      } finally {
        conn.close();
      }
    } catch (e) {
      console.error("❌ GAGAL BATCH INSERT:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 12.A BATCH (SUPER FAST + BUGFIX VERSION)
  app.post("/api/batch2/:storeName", async (req, res) => {
    try {
      const { storeName } = req.params;
      const data = req.body;

      if (!Array.isArray(data) || data.length === 0) {
        return res.json({ success: true, message: "No data" });
      }

      const lowerStoreName = storeName.toLowerCase();

      if (!/^[a-zA-Z0-9_]+$/.test(lowerStoreName)) {
        return res
          .status(400)
          .json({ success: false, message: "Nama store tidak valid" });
      }

      const Database = require("better-sqlite3");
      const path = require("path");
      const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));

      try {
        // 1. PASTIKAN TABEL LISTREFF DAN KOLOMNYA SEMPURNA
        conn.exec(
          `CREATE TABLE IF NOT EXISTS listrefftransaksi (id TEXT PRIMARY KEY, masa TEXT, cabang TEXT, "group" TEXT, tanggal DATE, noreff TEXT, total REAL, darikepada TEXT)`,
        );

        const fixCols = (colName, colType) => {
          const info = conn.pragma(`table_info(listrefftransaksi)`);
          if (
            !info.some((c) => c.name.toLowerCase() === colName.toLowerCase())
          ) {
            try {
              conn.exec(
                `ALTER TABLE listrefftransaksi ADD COLUMN "${colName}" ${colType}`,
              );
            } catch (e) {}
          }
        };
        fixCols("group", "TEXT");
        fixCols("darikepada", "TEXT");
        fixCols("total", "REAL");

        conn.exec(
          `CREATE INDEX IF NOT EXISTS idx_reff_seeker ON listrefftransaksi(noreff, masa, cabang)`,
        );

        const stmtCekGroupCabang = conn.prepare(
          `SELECT "group" FROM cabang WHERE id = ? OR kode = ? LIMIT 1`,
        );

        let stmtCariNoper = null;
        if (lowerStoreName === "datasales") {
          stmtCariNoper = conn.prepare(
            `SELECT noper FROM daftarmenu WHERE kodemenu = ? AND cabang = ? AND "group" = ? LIMIT 1`,
          );
        }

        // 2. SIAPKAN QUERY DINAMIS
        const tableInfo = conn.pragma(`table_info(\`${lowerStoreName}\`)`);
        const validColumnsSet = new Set(
          tableInfo.map((col) => col.name.toLowerCase()),
        );
        const dbColumns = [...validColumnsSet].filter((c) => c !== "id");

        const sqlColumns = dbColumns
          .map((c) => (c === "group" ? `"${c}"` : `\`${c}\``))
          .join(", ");
        const placeholders = dbColumns.map(() => "?").join(", ");
        const sql = `INSERT OR REPLACE INTO \`${lowerStoreName}\` (\`id\`, ${sqlColumns}) VALUES (?, ${placeholders})`;
        const stmt = conn.prepare(sql);

        // ✅ PERBAIKAN: Buat Seek Index SEKALI SAJA di luar transaksi (Hemat RAM & CPU)
        let seekIndex = null;
        if (lowerStoreName === "listrefftransaksi") {
          seekIndex = new Set();
          const existingData = conn
            .prepare(
              `SELECT noreff || '_' || masa || '_' || cabang as key FROM listrefftransaksi`,
            )
            .all();
          existingData.forEach((row) => seekIndex.add(row.key));
        }

        const chunkSize = 10000;

        const executeChunkTransaction = conn.transaction((chunkItems) => {
          for (const item of chunkItems) {
            const id =
              item.id ||
              `${lowerStoreName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const cabang = item.cabang || item.kode_cabang || item.CABANG || "";

            // LOGIKA GROUP: WAJIB AMBIL DARI MASTER CABANG
            let groupVal = "";
            if (cabang) {
              try {
                const cabangRow = stmtCekGroupCabang.get(cabang, cabang);
                if (
                  cabangRow &&
                  cabangRow.group &&
                  cabangRow.group !== "undefined"
                ) {
                  groupVal = cabangRow.group;
                }
              } catch (e) {}
            }
            if (!groupVal) groupVal = item.group || item.GROUP || "";
            if (!groupVal || groupVal === "undefined" || groupVal.trim() === "")
              groupVal = "TLGA";

            const noreff = item.noreff || item.NOREFF || item.no_reff || "";
            const tanggalVal =
              item.tanggal || item.TANGGAL || item.date || item.DATE || "";

            let masa = item.masa || item.MASA || "";
            if (!masa && tanggalVal) {
              let tglStr = String(tanggalVal).trim();
              if (tglStr.includes("T")) tglStr = tglStr.split("T")[0];
              let tglRaw = tglStr.replace(/\//g, "-");
              const parts = tglRaw.split("-");
              if (parts.length === 3) {
                if (parts[0].length === 4)
                  masa = parts[1] + parts[0].substring(2, 4);
                else if (parts[2].length === 4)
                  masa = parts[1] + parts[2].substring(2, 4);
              }
            }
            if (!masa || masa.length !== 4 || masa.includes("undefined"))
              masa = "";

            // VFP SEEK: Skip jika data listreff sudah ada
            if (lowerStoreName === "listrefftransaksi" && seekIndex) {
              if (noreff && masa && cabang) {
                const keyToSeek = `${noreff}_${masa}_${cabang}`;
                if (seekIndex.has(keyToSeek)) continue;
                else seekIndex.add(keyToSeek); // Tambah ke index agar data duplikat dalam 1 batch juga di-skip
              }
            }

            let finalItem = {
              ...item,
              id,
              group: groupVal,
              cabang: cabang,
              noreff: noreff,
              tanggal: tanggalVal,
              masa: masa,
              noper:
                item.noper || item.NOPER || item.no_per || item.noacct || "",
              penjelasan:
                item.penjelasan ||
                item.PENJELASAN ||
                item.desc ||
                item.DESC ||
                "",
            };
            delete finalItem._compositeKey;
            delete finalItem._finalId;

            if (lowerStoreName === "datasales") {
              let foundNoper = "";
              const kodeMenuCari = String(
                item.kodemenu || item.kode || "",
              ).trim();
              if (kodeMenuCari) {
                try {
                  const rowMenu = stmtCariNoper.get(
                    kodeMenuCari,
                    cabang,
                    groupVal,
                  );
                  if (rowMenu) foundNoper = rowMenu.noper;
                } catch (e) {}
              }
              finalItem.noper = foundNoper;
            }

            // ✅ PERBAIKAN: Mapping case-insensitive yang lebih ringan
            const itemLookup = {};
            for (const k in finalItem) {
              itemLookup[k.toLowerCase()] = finalItem[k];
            }

            // String kosong tetap string kosong (tidak jadi NULL)
            const values = dbColumns.map((col) => {
              const val = itemLookup[col];
              return val !== undefined && val !== null ? val : null;
            });

            stmt.run(id, ...values);
          }
        });

        // Eksekusi per chunk
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          executeChunkTransaction(chunk);
        }

        console.log(
          `✅ Sukses memproses batch tabel ${lowerStoreName} sebanyak ${data.length} data`,
        );
        res.json({ success: true, count: data.length });
      } finally {
        conn.close();
      }
    } catch (e) {
      console.error("❌ GAGAL BATCH INSERT:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 13. SAVE BATCH
  app.post("/api/save-batch", async (req, res) => {
    try {
      const { storeName, data } = req.body;
      if (!storeName || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Format data atau storeName tidak valid",
        });
      }

      // Keamanan: Hapus karakter aneh
      const lowerStoreName = storeName.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (!lowerStoreName) {
        return res
          .status(400)
          .json({ success: false, message: "Nama tabel tidak valid" });
      }

      const targetMasa = data[0].masa || "0000";
      const targetCabang = data[0].cabang || "00";
      const targetGroup = data[0].group || "TLGA";

      const Database = require("better-sqlite3");
      const path = require("path");
      const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));

      try {
        // 1. Tentukan struktur kolom dari data yang akan dimasukkan (termasuk 'id')
        const sampleItem = { ...data[0] };
        if (!sampleItem.id) sampleItem.id = "placeholder_id";

        const filteredKeys = Object.keys(sampleItem).filter(
          (k) => k.toLowerCase() !== "id",
        );
        const columnDefinitions = filteredKeys
          .map((k) => `"${k}" TEXT`)
          .join(", ");

        const createTableQuery = `
        CREATE TABLE IF NOT EXISTS "${lowerStoreName}" (
          id TEXT PRIMARY KEY,
          ${columnDefinitions}
        );
      `;
        conn.exec(createTableQuery);

        // Gunakan transaksi untuk performa dan keamanan data
        const executeTransaction = conn.transaction(() => {
          // 2. HAPUS DATA LAMA
          const deleteQuery = `
          DELETE FROM "${lowerStoreName}" 
          WHERE "masa" = ? AND "cabang" = ? AND "group" = ?
        `;
          const deleteStmt = conn.prepare(deleteQuery);
          deleteStmt.run(targetMasa, targetCabang, targetGroup);

          // 3. BULK INSERT DENGAN ID KUSTOM
          const columns = [`"id"`, ...filteredKeys.map((k) => `"${k}"`)];
          const columnsStr = columns.join(", ");
          const rowPlaceholders = columns.map(() => "?").join(", ");

          const insertStmt = conn.prepare(`
          INSERT INTO "${lowerStoreName}" (${columnsStr}) 
          VALUES (${rowPlaceholders})
        `);

          for (let i = 0; i < data.length; i++) {
            const item = data[i];

            const cabangId = String(item.cabang || targetCabang || "00").trim();
            const masaId = String(item.masa || targetMasa || "0000").trim();
            const norut = String(i + 1).padStart(4, "0");

            let id = "";

            // 🛠️ PEMBUATAN ID KUSTOM BERDASARKAN JENIS TABEL
            if (lowerStoreName.startsWith("golongan")) {
              // Format Golongan: "CDG_" + KODECABANG + "_" + MASA + "_" + KODEGOL + "_" + NORUT
              const kodeGol = String(item.gol || item.kode || "GOL").replace(
                /[^a-zA-Z0-9]/g,
                "",
              );
              id = `CDG_${cabangId}_${masaId}_${kodeGol}_${norut}`;
            } else if (lowerStoreName.startsWith("perkiraan")) {
              // Format Perkiraan: "CDD_" + KODECABANG + "_" + MASA + "_" + GOL + "_" + RIGHT(NOPER, 4) + "_" + NORUT
              const golVal = String(item.gol || "000").replace(
                /[^a-zA-Z0-9]/g,
                "",
              );
              const noPerkFull = String(
                item.noPerk || item.noperkiraan || item.noper || "0000",
              ).replace(/[^a-zA-Z0-9]/g, "");
              const rightNoper4 =
                noPerkFull.length >= 4
                  ? noPerkFull.slice(-4)
                  : noPerkFull.padStart(4, "0");

              id = `CDD_${cabangId}_${masaId}_${golVal}_${rightNoper4}_${norut}`;
            } else if (lowerStoreName.startsWith("transaksi")) {
              // Format Transaksi: Random UUID ala a5ae0fbc-9e68-4bb3-93e6-1f41520922bc_40
              const randomUuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
                /[xy]/g,
                function (c) {
                  var r = (Math.random() * 16) | 0,
                    v = c == "x" ? r : (r & 0x3) | 0x8;
                  return v.toString(16);
                },
              );
              const randomNum = Math.floor(Math.random() * 90) + 10; // 2 digit random di akhir
              id = `${randomUuid}_${randomNum}`;
            } else {
              // Fallback umum
              const uniqueKey = item.id || `row_${i}`;
              id = `GEN_${cabangId}_${masaId}_${uniqueKey}_${norut}`;
            }

            const rowValues = [id];
            for (const key of filteredKeys) {
              rowValues.push(
                item[key] !== undefined && item[key] !== null
                  ? item[key]
                  : null,
              );
            }

            insertStmt.run(...rowValues);
          }
        });

        executeTransaction();

        res.json({ success: true, message: "Batch saved successfully" });
      } finally {
        conn.close();
      }
    } catch (e) {
      console.error("Error Server Save Batch:", e.message);
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

      // ✅ Diubah ke kolom fisik (Menghapus syntax jsonb postgresql yang error di sqlite)
      const sql = `DELETE FROM saldo_harian WHERE tanggal >= ? AND tanggal <= ?`;
      await db.query(sql, [tanggalAwal, tanggalAkhir]);

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

      // ✅ Diubah ke kolom fisik langsung
      await db.query(
        `INSERT INTO saldo_harian (id, cabang, char4, tanggal, saldo_akhir) 
       VALUES (?, ?, ?, ?, ?) 
       ON CONFLICT (id) DO UPDATE SET cabang = EXCLUDED.cabang, char4 = EXCLUDED.char4, tanggal = EXCLUDED.tanggal, saldo_akhir = EXCLUDED.saldo_akhir`,
        [id, cabang || "", char4 || "", tanggal, Number(saldo_akhir) || 0],
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  // ============================================================================
  // 16. ENDPOINT IMPOR FOXPRO (.DBF) - SUDAH DISIAPKAN UNTUK FISIK
  // ============================================================================
  app.post("/api/impor-foxpro-online", (req, res) => {
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
        const Database = require("better-sqlite3");
        const path = require("path");
        const fs = require("fs");
        const crypto = require("crypto");

        const dbPath = path.join(__dirname, "pembukuan_lokal.db");
        const isNewDatabase = !fs.existsSync(dbPath);
        const conn = new Database(dbPath);

        try {
          const { kode_cabang, tahun } = fields;
          const group = fields.group || "TLGA";

          const fileCdg = files["file_cdg"];
          const fileCdd = files["file_cdd"];
          const fileDet = files["file_det"];

          if (!fileCdg || !fileCdd) {
            send(100, "File CDG atau CDD tidak ditemukan", { success: false });
            conn.close();
            return res.end();
          }

          send(5, `Mulai impor tahun ${tahun} cabang ${kode_cabang}`);

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

          send(58, "Memverifikasi struktur tabel lokal...");

          // 1. BUAT TABEL DENGAN STRUKTUR KOLOM FISIK
          conn.exec(
            `CREATE TABLE IF NOT EXISTS "${tableGolongan}" (id TEXT PRIMARY KEY, gol TEXT, namagol TEXT, awal REAL, db REAL, cr REAL, akhir REAL, masa TEXT, cabang TEXT, "group" TEXT)`,
          );
          conn.exec(
            `CREATE TABLE IF NOT EXISTS "${tablePerkiraan}" (id TEXT PRIMARY KEY, gol TEXT, noper TEXT, penjelasan TEXT, awal REAL, db REAL, cr REAL, akhir REAL, masa TEXT, cabang TEXT, "group" TEXT)`,
          );
          conn.exec(
            `CREATE TABLE IF NOT EXISTS "${tableTransaksi}" (id TEXT PRIMARY KEY, tanggal DATE, noreff TEXT, noper TEXT, penjelasan TEXT, db REAL, cr REAL, masa TEXT, cabang TEXT, "group" TEXT)`,
          );

          // SUNTIKAN KOLOM SECARA DINAMIS JIKA DATABASE LAMA
          if (!isNewDatabase) {
            const checkAndAddColumn = (tableName, columnName, columnType) => {
              const tableInfo = conn.pragma(`table_info("${tableName}")`);
              const existingColumns = new Set(tableInfo.map((col) => col.name));
              if (!existingColumns.has(columnName)) {
                try {
                  conn.exec(
                    `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`,
                  );
                } catch (err) {}
              }
            };

            [tableGolongan, tablePerkiraan, tableTransaksi].forEach((tbl) => {
              checkAndAddColumn(tbl, "masa", "TEXT");
              checkAndAddColumn(tbl, "cabang", "TEXT");
              checkAndAddColumn(tbl, "group", "TEXT");
            });
            checkAndAddColumn(tableGolongan, "gol", "TEXT");
            checkAndAddColumn(tableGolongan, "namagol", "TEXT");
            checkAndAddColumn(tableGolongan, "awal", "REAL");
            checkAndAddColumn(tableGolongan, "akhir", "REAL");
            checkAndAddColumn(tablePerkiraan, "gol", "TEXT");
            checkAndAddColumn(tablePerkiraan, "noper", "TEXT");
            checkAndAddColumn(tablePerkiraan, "penjelasan", "TEXT");
            checkAndAddColumn(tablePerkiraan, "awal", "REAL");
            checkAndAddColumn(tablePerkiraan, "akhir", "REAL");
            checkAndAddColumn(tableTransaksi, "tanggal", "DATE");
            checkAndAddColumn(tableTransaksi, "noreff", "TEXT");
            checkAndAddColumn(tableTransaksi, "noper", "TEXT");
            checkAndAddColumn(tableTransaksi, "penjelasan", "TEXT");
          }

          // 2. BUAT INDEX
          conn.exec(
            `CREATE INDEX IF NOT EXISTS idx_${tableGolongan}_filter ON "${tableGolongan}"(masa, cabang)`,
          );
          conn.exec(
            `CREATE INDEX IF NOT EXISTS idx_${tablePerkiraan}_filter ON "${tablePerkiraan}"(masa, cabang)`,
          );
          conn.exec(
            `CREATE INDEX IF NOT EXISTS idx_${tableTransaksi}_filter ON "${tableTransaksi}"(masa, cabang)`,
          );

          // 3. TRANSAKSI IMPOR MASSAL
          // 3. TRANSAKSI IMPOR MASSAL
          const runMigration = conn.transaction(() => {
            const getStr = (val) =>
              val !== undefined && val !== null ? String(val).trim() : "";
            const getNum = (val) =>
              val !== undefined && val !== null ? Number(val) : 0;

            const batchInsert = (
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

              const checkData = conn
                .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
                .get();
              const tableHasData = checkData && checkData.count > 0;
              const deleteStmt = conn.prepare(
                `DELETE FROM "${tableName}" WHERE masa = ? AND cabang = ?`,
              );

              let insertStmt;
              if (typePrefix === "CDG") {
                insertStmt = conn.prepare(
                  `INSERT INTO "${tableName}" (id, gol, namagol, awal, db, cr, akhir, masa, cabang, [group]) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET gol=EXCLUDED.gol, namagol=EXCLUDED.namagol, awal=EXCLUDED.awal, db=EXCLUDED.db, cr=EXCLUDED.cr, akhir=EXCLUDED.akhir, masa=EXCLUDED.masa, cabang=EXCLUDED.cabang, [group]=EXCLUDED.[group]`,
                );
              } else if (typePrefix === "CDD") {
                insertStmt = conn.prepare(
                  `INSERT INTO "${tableName}" (id, gol, noper, penjelasan, awal, db, cr, akhir, masa, cabang, [group]) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET gol=EXCLUDED.gol, noper=EXCLUDED.noper, penjelasan=EXCLUDED.penjelasan, awal=EXCLUDED.awal, db=EXCLUDED.db, cr=EXCLUDED.cr, akhir=EXCLUDED.akhir, masa=EXCLUDED.masa, cabang=EXCLUDED.cabang, [group]=EXCLUDED.[group]`,
                );
              } else if (typePrefix === "DET") {
                insertStmt = conn.prepare(
                  `INSERT INTO "${tableName}" (id, tanggal, noreff, noper, penjelasan, db, cr, masa, cabang, [group]) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tanggal=EXCLUDED.tanggal, noreff=EXCLUDED.noreff, noper=EXCLUDED.noper, penjelasan=EXCLUDED.penjelasan, db=EXCLUDED.db, cr=EXCLUDED.cr, masa=EXCLUDED.masa, cabang=EXCLUDED.cabang, [group]=EXCLUDED.[group]`,
                );
              }

              const clearedCache = new Set();

              for (let i = 0; i < dataArray.length; i += batchSize) {
                const batch = dataArray.slice(i, i + batchSize);
                batch.forEach((row, index) => {
                  let tanggalRaw = "";
                  let rawDate = row.DATE || row.TANGGAL;

                  if (rawDate) {
                    if (rawDate instanceof Date) {
                      let dObj = new Date(rawDate.getTime());

                      // 🛠️ Mengurangi tanggal sebesar 30 hari secara langsung
                      dObj.setUTCDate(dObj.getUTCDate() - 30);

                      let year = dObj.getUTCFullYear();
                      let month = String(dObj.getUTCMonth() + 1).padStart(
                        2,
                        "0",
                      );
                      let day = String(dObj.getUTCDate()).padStart(2, "0");
                      tanggalRaw = `${year}-${month}-${day}`;
                    } else {
                      tanggalRaw = String(rawDate).trim().substring(0, 10);
                    }
                  }

                  let computedMasa = fields.masa || ""; // 🔒 Kunci mutlak ikut form
                  // Parsing tanggal hanya berlaku untuk CDG dan CDD, TIDAK untuk DET
                  if (typePrefix !== "DET" && tanggalRaw) {
                    const parts = tanggalRaw.split(/[-/]/);
                    if (parts.length === 3) {
                      if (parts[0].length === 4)
                        computedMasa = parts[1] + parts[0].substring(2, 4);
                      else if (parts[2].length === 4)
                        computedMasa = parts[1] + parts[2].substring(2, 4);
                    } else if (tanggalRaw.length === 8 && !isNaN(tanggalRaw)) {
                      computedMasa =
                        tanggalRaw.substring(4, 6) + tanggalRaw.substring(2, 4);
                    }
                  }

                  let currentCabang = kode_cabang;
                  let customId = "";

                  if (typePrefix === "CDG") {
                    currentCabang = getStr(row.REST) || kode_cabang;
                    customId = `CDG_${currentCabang}_${computedMasa}_${getStr(row.GOLACCT) || "X"}_${i + index}`;
                    if (!isNewDatabase && tableHasData) {
                      const cacheKey = `${computedMasa}_${currentCabang}`;
                      if (!clearedCache.has(cacheKey)) {
                        deleteStmt.run(computedMasa, currentCabang);
                        clearedCache.add(cacheKey);
                      }
                    }
                    insertStmt.run(
                      customId,
                      getStr(row.GOLACCT),
                      getStr(row.PJLSAN),
                      getNum(row.AWAL),
                      getNum(row.DB),
                      getNum(row.CR),
                      getNum(row.AKHIR),
                      computedMasa,
                      currentCabang,
                      group,
                    );
                  } else if (typePrefix === "CDD") {
                    currentCabang = getStr(row.REST) || kode_cabang;
                    customId = `CDD_${currentCabang}_${computedMasa}_${getStr(row.SUBACCT).replace(/\./g, "_") || "X"}_${i + index}`;
                    if (!isNewDatabase && tableHasData) {
                      const cacheKey = `${computedMasa}_${currentCabang}`;
                      if (!clearedCache.has(cacheKey)) {
                        deleteStmt.run(computedMasa, currentCabang);
                        clearedCache.add(cacheKey);
                      }
                    }
                    insertStmt.run(
                      customId,
                      getStr(row.GOLACCT),
                      getStr(row.SUBACCT),
                      getStr(row.PJLSAN),
                      getNum(row.AWAL),
                      getNum(row.DB),
                      getNum(row.CR),
                      getNum(row.AKHIR),
                      computedMasa,
                      currentCabang,
                      group,
                    );
                  } else if (typePrefix === "DET") {
                    currentCabang = getStr(row.KODE) || kode_cabang;
                    customId = `${crypto.randomUUID()}_${i + index}`;

                    // Pastikan masa untuk DET murni menggunakan input form tanpa diubah-ubah
                    computedMasa = fields.masa || "";

                    if (!isNewDatabase && tableHasData) {
                      const cacheKey = `${computedMasa}_${currentCabang}`;
                      if (!clearedCache.has(cacheKey)) {
                        deleteStmt.run(computedMasa, currentCabang);
                        clearedCache.add(cacheKey);
                      }
                    }
                    insertStmt.run(
                      customId,
                      tanggalRaw,
                      getStr(row.REFF),
                      getStr(row.NOACCT),
                      getStr(row.DESC),
                      getNum(row.DB),
                      getNum(row.CR),
                      computedMasa,
                      currentCabang,
                      group,
                    );
                  }
                  totalInserted++;
                });

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

            // 🔍 TAMPILKAN DATA DET DI CONSOLE SEBELUM MASUK DATABASE
            console.log("=== ISI DATA DET MENTAH DARI FILE DBF ===");
            console.log("Total baris DET:", dataDet.length);
            console.log(
              "Contoh 5 baris pertama:",
              JSON.stringify(dataDet.slice(0, 5), null, 2),
            );

            const countCdg = batchInsert(tableGolongan, dataCdg, "CDG", 60, 75);
            const countCdd = batchInsert(
              tablePerkiraan,
              dataCdd,
              "CDD",
              75,
              90,
            );
            const countDet = batchInsert(
              tableTransaksi,
              dataDet,
              "DET",
              90,
              98,
            );

            return { countCdg, countCdd, countDet };
          });

          const resultSummary = runMigration();

          send(
            100,
            `Sukses! Golongan:${resultSummary.countCdg} Perkiraan:${resultSummary.countCdd} Transaksi:${resultSummary.countDet}`,
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
          console.error("❌ GAGAL IMPOR FOXPRO:", txError.message);
          send(100, "Gagal simpan DB: " + txError.message, { success: false });
          res.end();
        } finally {
          conn.close();
        }
      });

      req.pipe(bb);
    } catch (error) {
      send(100, "Error: " + error.message, { success: false });
      res.end();
    }
  });

  // ============================================================================
  // 18. ENDPOINT IMPOR MUTASI KASIR ONLINE (SUDAH DIFISIKKAN)
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
        const Database = require("better-sqlite3");
        const path = require("path");
        const crypto = require("crypto");
        const conn = new Database(path.join(__dirname, "pembukuan_lokal.db"));

        try {
          const { cabang, hapus_tahun, hapus_bulan, group } = fields;
          const fileDbf = files["file_dbf"];

          if (!fileDbf) {
            send(100, "File DBF tidak ditemukan", { success: false });
            conn.close();
            return res.end();
          }

          send(5, "Membaca file DBF di server...");
          const { Dbf } = require("dbf-reader");
          const records = Dbf.read(fileDbf)?.rows || [];
          send(15, `DBF terbaca: ${records.length} baris`);

          if (records.length === 0) {
            send(100, "File DBF kosong", { success: false });
            conn.close();
            return res.end();
          }

          if (!cabang) {
            send(100, "Parameter cabang tidak ada", { success: false });
            conn.close();
            return res.end();
          }

          // ✅ 1. HAPUS DATA LAMA LANGSUNG DARI KOLOM FISIK (Bukan json_extract)
          if (hapus_tahun || hapus_bulan) {
            send(20, "Menghapus data lama di database...");
            const cabShort = (cabang || "PUSAT").substring(0, 3).toUpperCase();
            let norefPrefix = `KASIR-${cabShort}-`;
            if (hapus_tahun && hapus_bulan) {
              norefPrefix += `${hapus_tahun}-${hapus_bulan}`;
            } else if (hapus_tahun) {
              norefPrefix += `${hapus_tahun}`;
            }

            // ✅ DIPERBAIKI: Menggunakan kolom fisik 'noreff'
            conn
              .prepare(`DELETE FROM mutasikasir WHERE noreff LIKE ?`)
              .run(`${norefPrefix}%`);
            send(25, "Data lama berhasil dihapus");
          } else {
            send(25, "Mode tambah data (tidak menghapus yang lama)");
          }

          send(30, "Memproses data...");
          const noreffMap = {};

          const validRecords = records.filter(
            (row) => Number(row.N_RUPIAH_) > 0,
          );
          send(
            40,
            `${validRecords.length} data valid ditemukan, mulai menyimpan...`,
          );

          // ✅ 2. GANTI db.connect() MENJADI TRANSAKSI better-sqlite3
          const importTx = conn.transaction(() => {
            let savedCount = 0;
            const batchSize = 500;
            const totalBatches = Math.ceil(validRecords.length / batchSize);

            // ✅ DIPERBAIKI: Query insert langsung ke kolom fisik mutasikasir
            const insertStmt = conn.prepare(`
            INSERT OR REPLACE INTO mutasikasir 
            (id, noreff, tanggal, cabang, "group", kodeTrans, noperkiraan, penjelasan, total, db, cr) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

            for (let i = 0; i < validRecords.length; i += batchSize) {
              const batch = validRecords.slice(i, i + batchSize);

              batch.forEach((row) => {
                const getStr = (val) =>
                  val !== undefined && val !== null ? String(val).trim() : "";
                const getNum = (val) =>
                  val !== undefined && val !== null ? Number(val) : 0;

                const kodeTrans = getStr(row.N_KODE_).toUpperCase();
                const desc = getStr(row.PENJELASAN).toUpperCase();
                const total = getNum(row.N_RUPIAH_);
                const cabDBF = getStr(row.N_CABANG_) || cabang;

                let tglStr = getStr(row.TANGGAL);
                let tanggalFix = new Date().toISOString().split("T")[0];

                if (tglStr) {
                  let cleanTgl = tglStr.replace(/[^0-9\-\/]/g, "").trim();
                  let parsedDate;
                  if (cleanTgl.length === 8 && !isNaN(cleanTgl)) {
                    parsedDate = new Date(
                      cleanTgl.substring(0, 4) +
                        "-" +
                        cleanTgl.substring(4, 6) +
                        "-" +
                        cleanTgl.substring(6, 8),
                    );
                  } else if (cleanTgl.includes("-") || cleanTgl.includes("/")) {
                    parsedDate = new Date(cleanTgl.replace(/\//g, "-"));
                  } else {
                    parsedDate = new Date(tglStr);
                  }
                  if (!isNaN(parsedDate.getTime())) {
                    tanggalFix = parsedDate.toISOString().split("T")[0];
                  }
                }

                const cabShort = (cabDBF || "PUSAT")
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

                let nilaiDb = 0;
                let nilaiCr = 0;
                if (
                  kodeTrans.startsWith("PJ") ||
                  kodeTrans.startsWith("TK") ||
                  kodeTrans.startsWith("KT")
                ) {
                  nilaiDb = total;
                } else if (
                  kodeTrans.startsWith("BE") ||
                  kodeTrans.startsWith("CS") ||
                  kodeTrans.startsWith("KK") ||
                  kodeTrans.startsWith("SK")
                ) {
                  nilaiCr = total;
                } else {
                  nilaiDb = total;
                }

                // ✅ DIPERBAIKI: Langsung kirim ke kolom fisik, TIDAK pakai JSON.stringify
                insertStmt.run(
                  id,
                  noreff,
                  tanggalFix,
                  cabDBF,
                  group || "TLGA",
                  kodeTrans,
                  "",
                  desc,
                  total,
                  nilaiDb,
                  nilaiCr,
                );
                savedCount++;
              });

              const currentBatch = Math.floor(i / batchSize) + 1;
              const pct = 40 + Math.round((currentBatch / totalBatches) * 60);
              send(
                pct,
                `Menyimpan ke Database Lokal... (${savedCount}/${validRecords.length} data)`,
              );
            }
            return savedCount;
          });

          const totalSaved = importTx();

          send(
            100,
            `Sukses! ${totalSaved} data kasir cabang ${cabang} tersimpan`,
            { success: true },
          );
          res.end();
        } catch (innerErr) {
          console.error("❌ GAGAL IMPOR KASIR:", innerErr.message);
          send(100, "Error: " + innerErr.message, { success: false });
          res.end();
        } finally {
          conn.close();
        }
      });

      req.pipe(bb);
    } catch (error) {
      send(100, "Error: " + error.message, { success: false });
      res.end();
    }
  });

  // Di file route backend Anda, tambahkan ini:
  app.get("/api/data/transaksi/seek", async (req, res) => {
    const { noreff, cabang, group } = req.query;

    // LOMPAT LANGSUNG KE DATABASE MENGGUNAKAN WHERE
    // Ini jauh lebih cepat daripada memfilter ribuan baris di JavaScript
    const query = `
        SELECT * FROM transaksi 
        WHERE noreff = '${noreff}' 
        AND cabang = '${cabang}' 
        AND group = '${group}'
    `;

    // Eksekusi query dan kirim hasilnya
    // db.query(query).then(data => res.json(data));
  });

  // ============================================================================
  // JALANKAN SERVER - WAJIB DI PALING BAWAH
  // ============================================================================
  //const PORT = process.env.PORT || 3000;

  //app.listen(PORT, () => {
  //  console.log(`🚀 Server berjalan di port ${PORT}`);
  //});
};
