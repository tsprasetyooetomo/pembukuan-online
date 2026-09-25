// =================================================================
// SERVERKARYAWAN.JS - DINAMIS CRUD MENGGUNAKAN BETTER-SQLITE3 & BCRYPT
// =================================================================

const path = require("path");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

module.exports = (app) => {
  // ================================================== //
  // --- 1. SETUP DATABASE SQLITE ---
  // ================================================== //

  // Inisialisasi database (otomatis membuat file database.db jika belum ada)
  const db = new Database("./database.db", { verbose: console.log });

  console.log("✅ Connected to SQLite database.");

  // Buat tabel-tabel menggunakan db.exec() karena bersifat sinkron
  db.exec(`
    CREATE TABLE IF NOT EXISTS karyawan (
      id TEXT PRIMARY KEY, nik TEXT UNIQUE, nama TEXT, nikname TEXT, alamat TEXT, 
      status TEXT, lulusan TEXT, jabatan TEXT, cabangPenempatan TEXT, 
      tanggalMasuk TEXT, kis TEXT, fotoUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS gaji (
      id TEXT PRIMARY KEY, nik TEXT, gajiPokok INTEGER, tjabatan INTEGER, 
      tbeasiswa INTEGER, tkontrakan INTEGER, tpph INTEGER, bpjsKes TEXT, bpjsTk TEXT
    );

    CREATE TABLE IF NOT EXISTS hitabsen (
      id TEXT PRIMARY KEY, nik TEXT, gajiPokok INTEGER, tjabatan INTEGER, 
      tbeasiswa INTEGER, tkontrakan INTEGER, tkasbon INTEGER, tabsen INTEGER, tbonus INTEGER, 
      tmasa TEXT, thari INTEGER, tpph INTEGER, bpjsKes TEXT, bpjsTk TEXT
    );

    CREATE TABLE IF NOT EXISTS mutasi (
      id TEXT PRIMARY KEY, nik TEXT, cabangAsal TEXT, cabangPindah TEXT, 
      tanggalMutasi TEXT, alasanMutasi TEXT
    );

       CREATE TABLE IF NOT EXISTS hitgaji (
      id TEXT PRIMARY KEY, nik TEXT, gajiPokok INTEGER, tjabatan INTEGER, 
      tbeasiswa INTEGER, tkontrakan INTEGER, tkasbon INTEGER, tabsen INTEGER, tbonus INTEGER, 
      tmasa TEXT, thari INTEGER, tpph INTEGER, bpjsKes TEXT, bpjsTk TEXT
    );


    CREATE TABLE IF NOT EXISTS cabang (
      id TEXT PRIMARY KEY, namaCabang TEXT UNIQUE, alamatCabang TEXT, kodeCbg TEXT, fotoUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS userkaryawan (
      id TEXT PRIMARY KEY, 
      username TEXT UNIQUE NOT NULL, 
      password TEXT NOT NULL, 
      role TEXT,
      cbg TEXT
    );
  `);

  // Helper: Generate ID sederhana
  const generateId = () => "_" + Math.random().toString(36).substr(2, 9);

  // ================================================== //
  // --- 2. API KHUSUS (LOGIN & USER KHUSUS) ---
  // ================================================== //

  // POST: Login
  app.post("/api/login2", async (req, res) => {
    try {
      const { username, password, role } = req.body;

      const stmt = db.prepare("SELECT * FROM userkaryawan WHERE username = ?");
      const user = stmt.get(username);

      if (!user) {
        return res.status(401).json({ error: "User tidak ditemukkkkkan" });
      }

      if (user.role !== role) {
        return res.status(401).json({ error: "Role tidak sesuai" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: "Password salah" });
      }

      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        cbg: user.cbg,
      });
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST: Tambah User Khusus (Karena butuh hashing password)
  app.post("/api/userkaryawan", async (req, res) => {
    try {
      const { username, password, role, cbg } = req.body;
      if (!username || !password || !role || !cbg) {
        return res.status(400).json({ error: "Data kurang lengkap" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const id = generateId();

      const stmt = db.prepare(
        "INSERT INTO userkaryawan (id, username, password, role, cbg) VALUES (?, ?, ?, ?, ?)",
      );
      stmt.run(id, username, hashedPassword, role, cbg);

      res.status(201).json({ id, username, role, cbg });
    } catch (err) {
      res.status(500).json({
        error: "Username mungkin sudah ada atau terjadi kesalahan server.",
      });
    }
  });

  // PUT: Update User Khusus (Hash password baru jika diisi)
  app.put("/api/userkaryawan/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role, cbg } = req.body;

      let result;
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare(
          "UPDATE userkaryawan SET username = ?, password = ?, role = ?, cbg = ? WHERE id = ?",
        );
        result = stmt.run(username, hashedPassword, role, cbg, id);
      } else {
        const stmt = db.prepare(
          "UPDATE userkaryawan SET username = ?, role = ?, cbg = ? WHERE id = ?",
        );
        result = stmt.run(username, role, cbg, id);
      }

      if (result.changes === 0)
        return res.status(404).json({ error: "User tidak ditemukan" });
      res.json({ message: "User updated" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ================================================== //
  // --- 3. RUTE DINAMIK / GENERIC CRUD UNTUK SEMUA TABEL ---
  // ================================================== //

  // Daftar tabel yang diizinkan untuk diakses secara dinamis demi keamanan
  const allowedTables = [
    "karyawan",
    "gaji",
    "hitgaji",
    "hitabsen",
    "mutasi",
    "cabang",
    "userkaryawan",
  ];

  const validateTable = (req, res, next) => {
    if (!allowedTables.includes(req.params.table)) {
      return res.status(400).json({ error: "Tabel tidak valid" });
    }
    next();
  };

  // 1. GET: Ambil semua data dari tabel tertentu
  app.get("/api/:table", validateTable, (req, res) => {
    try {
      const { table } = req.params;
      // Jika tabel userkaryawan, sembunyikan kolom password dari hasil query
      const query =
        table === "userkaryawan"
          ? "SELECT id, username, role, cbg FROM userkaryawan"
          : `SELECT * FROM ${table}`;

      const rows = db.prepare(query).all();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET: Ambil satu data berdasarkan ID dari tabel tertentu
  app.get("/api/:table/:id", validateTable, (req, res) => {
    try {
      const { table, id } = req.params;
      const query =
        table === "userkaryawan"
          ? "SELECT id, username, role, cbg FROM userkaryawan WHERE id = ?"
          : `SELECT * FROM ${table} WHERE id = ?`;

      const row = db.prepare(query).get(id);
      if (!row) return res.status(404).json({ error: "Data tidak ditemukan" });
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. POST: Tambah data baru ke tabel tertentu (Kecuali userkaryawan karena sudah ditangani terpisah di atas)
  app.post("/api/:table", validateTable, (req, res) => {
    try {
      const { table } = req.params;
      if (table === "userkaryawan") {
        return res
          .status(400)
          .json({ error: "Gunakan endpoint khusus userkaryawan untuk pendaftaran." });
      }

      let data = req.body;
      if (!data.id) {
        data.id = generateId();
      }

      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => "?").join(",");

      const sql = `INSERT INTO \({table} (\){keys.join(', ')}) VALUES (${placeholders})`;
      db.prepare(sql).run(...values);

      res.status(201).json({ message: "Berhasil disimpan", data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. PUT: Update data berdasarkan ID di tabel tertentu (Kecuali userkaryawan)
  app.put("/api/:table/:id", validateTable, (req, res) => {
    try {
      const { table, id } = req.params;
      if (table === "userkaryawan") {
        return res.status(400).json({
          error: "Gunakan endpoint khusus userkaryawan/:id untuk update user.",
        });
      }

      let data = req.body;
      delete data.id; // Pastikan id utama tidak ikut ter-update

      const keys = Object.keys(data);
      if (keys.length === 0)
        return res.status(400).json({ error: "Tidak ada data untuk diupdate" });

      const setClause = keys.map((key) => `${key} = ?`).join(", ");
      const values = [...Object.values(data), id];

      const sql = `UPDATE \({table} SET\){setClause} WHERE id = ?`;
      const result = db.prepare(sql).run(...values);

      if (result.changes === 0)
        return res.status(404).json({ error: "Data tidak ditemukan" });
      res.json({ message: "Berhasil diupdate" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. DELETE: Hapus data berdasarkan ID dari tabel tertentu
  app.delete("/api/:table/:id", validateTable, (req, res) => {
    try {
      const { table, id } = req.params;
      const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);

      if (result.changes === 0)
        return res.status(404).json({ error: "Data tidak ditemukan" });
      res.json({ message: "Berhasil dihapus" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Khusus Hapus Semua Data Hitabsen (Clear Tabel)
  app.delete("/api/hitgaji", (req, res) => {
    try {
      db.prepare("DELETE FROM hitabsen").run();
      res.json({ message: "Semua data hitabsen dihapus" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ================================================== //
  // --- 4. ALIAS RUTE TANPA /API/ (KOMPATIBILITAS LAMA) ---
  // ================================================== //
  app.get("/gaji", (req, res) =>
    res.json(db.prepare("SELECT * FROM gaji").all()),
  );
  app.get("/mutasi", (req, res) =>
    res.json(db.prepare("SELECT * FROM mutasi").all()),
  );
  app.get("/cabang", (req, res) =>
    res.json(db.prepare("SELECT * FROM cabang").all()),
  );
  app.get("/hitgaji", (req, res) =>
    res.json(db.prepare("SELECT * FROM hitabsen").all()),
  );
  app.get("/userkaryawan", (req, res) =>
    res.json(db.prepare("SELECT id, username, role, cbg FROM userkaryawan").all()),
  );
  app.get("/karyawan", (req, res) =>
    res.json(db.prepare("SELECT * FROM karyawan").all()),
  );
};
