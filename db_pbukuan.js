/* ================================================================
   db.js — DATABASE WRAPPER (FIXED VERSION)
   ================================================================ */

// Konfigurasi URL Backend (Hanya dipakai di Browser)
//const API_BASE_URL = "http://127.0.0.1:3000";
// YANG BENAR (Otomatis mengikuti domain tempat web dibuka):
const API_BASE_URL = window.location.origin;
let _importSukses = 0;

class PembukuanDB {
  constructor(dbFilePath) {
    this.db = null;
    // this.dbFilePath = dbFilePath || "./pembukuan.db";

    this.dbFilePath =
      dbFilePath || "D:/karyawan-backend/db_pbukuan/pembukuan.db";
    this._putCount = 0;

    // Definisi Skema Tabel
    this.stores = [
      { name: "golongan" },
      { name: "perkiraan" },
      { name: "transaksi" },
      { name: "users" },
      { name: "formatRL" },
      { name: "formatNeraca" },
      { name: "postedMonths" },
      { name: "kodeBank" },
      { name: "cabang" },
      { name: "detiltransaksi" },
      { name: "groupproject" }, // <-- TAMBAHKAN INI
      { name: "saldoKasir" },
      { name: "mutasikasir" },
      { name: "saldokasirawal" },
      { name: "saldo_harian" },
    ];
  }

  // ================================================== //
  // LOGIKA SERVER (NODE.JS - SQLITE)
  // ================================================== //
  _openServer() {
    var sqlite3 = require("sqlite3").verbose();
    var self = this;

    // Ambil path yang sudah mendukung Railway Volume
    const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "pembukuan.db")
      : path.join(__dirname, "pembukuan.db");

    return new Promise(function (resolve, reject) {
      self.db = new sqlite3.Database(self.dbFilePath, function (err) {
        if (err) return reject(err);
        self.db.run("PRAGMA journal_mode = WAL;");
        self.db.serialize(function () {
          self.stores.forEach(function (store) {
            // 1. Buat Tabel
            self.db.run(
              "CREATE TABLE IF NOT EXISTS " +
                store.name +
                " (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
            );

            // 2. Tambah Kolom & Index Individual
            store.cols.forEach(function (col) {
              // Abaikan error jika kolom sudah ada
              self.db.run(
                "ALTER TABLE " +
                  store.name +
                  " ADD COLUMN " +
                  col.name +
                  " TEXT",
                function () {},
              );

              var u = col.unique ? "UNIQUE " : "";
              self.db.run(
                "CREATE " +
                  u +
                  "INDEX IF NOT EXISTS idx_" +
                  store.name +
                  "_" +
                  col.name +
                  " ON " +
                  store.name +
                  " (" +
                  col.name +
                  ")",
              );
            });

            // 3. Tambah Composite Unique Index (Jika ada)
            if (store.uniqueGroup && store.uniqueGroup.length > 0) {
              var uCols = store.uniqueGroup.join(", ");
              var idxName =
                "idx_" + store.name + "_" + store.uniqueGroup.join("_");
              self.db.run(
                "CREATE UNIQUE INDEX IF NOT EXISTS " +
                  idxName +
                  " ON " +
                  store.name +
                  " (" +
                  uCols +
                  ")",
                function () {},
              );
            }
          });
          resolve(self.db);
        });
      });
    });
  }

  _extractCols(storeName, dataObj) {
    var s = this.stores.find(function (x) {
      return x.name === storeName;
    });
    if (!s) return {};
    var c = {};
    s.cols.forEach(function (col) {
      if (dataObj[col.name] !== undefined)
        c[col.name] = String(dataObj[col.name]);
    });
    return c;
  }

  _run(sql, p) {
    return new Promise(
      function (resolve, reject) {
        this.db.run(sql, p, function (err) {
          if (err) reject(err);
          else resolve(this);
        });
      }.bind(this),
    );
  }

  // Helper untuk mengambil data kolom untuk batch insert
  _getColumnsAndValues(storeName, data) {
    var c = this._extractCols(storeName, data);
    var cn = Object.keys(c);
    var cv = Object.values(c);
    return { cn, cv };
  }

  _addServer(storeName, data) {
    if (!data.id) throw new Error("Data harus memiliki properti 'id'");
    var js = JSON.stringify(data);
    var { cn, cv } = this._getColumnsAndValues(storeName, data);

    var ph = cn
      .map(function () {
        return "?";
      })
      .join(", ");
    var sql = "INSERT INTO " + storeName + " (id, data";
    if (cn.length > 0) sql += ", " + cn.join(", ");
    sql += ") VALUES (?, ?";
    if (cn.length > 0) sql += ", " + ph + ")";

    return this._run(sql, [data.id, js].concat(cv));
  }

  _putServer(storeName, data) {
    if (!data.id) throw new Error("Data harus memiliki properti 'id'");
    var js = JSON.stringify(data);
    var { cn, cv } = this._getColumnsAndValues(storeName, data);

    var ph = cn
      .map(function () {
        return "?";
      })
      .join(", ");

    // PERBAIKAN: Gunakan INSERT OR REPLACE INTO agar tidak memicu error UNIQUE constraint
    var sql = "INSERT OR REPLACE INTO " + storeName + " (id, data";
    if (cn.length > 0) sql += ", " + cn.join(", ");
    sql += ") VALUES (?, ?";
    if (cn.length > 0) sql += ", " + ph + ")";

    return this._run(sql, [data.id, js].concat(cv));
  }

  _getServer(storeName, id) {
    var self = this;
    return new Promise(function (resolve, reject) {
      self.db.get(
        "SELECT data FROM " + storeName + " WHERE id = ?",
        [id],
        function (err, row) {
          if (err) reject(err);
          else if (row) resolve(JSON.parse(row.data));
          else resolve(null);
        },
      );
    });
  }

  _getAllServer(storeName) {
    var self = this;
    return new Promise(function (resolve, reject) {
      self.db.all("SELECT data FROM " + storeName, [], function (err, rows) {
        if (err) reject(err);
        else
          resolve(
            rows.map(function (row) {
              return JSON.parse(row.data);
            }),
          );
      });
    });
  }

  _delServer(storeName, id) {
    return this._run("DELETE FROM " + storeName + " WHERE id = ?", [id]);
  }

  _clearServer(storeName) {
    return this._run("DELETE FROM " + storeName, []);
  }

  _countServer(storeName) {
    var self = this;
    return new Promise(function (resolve, reject) {
      self.db.get(
        "SELECT COUNT(id) as total FROM " + storeName,
        [],
        function (err, row) {
          if (err) reject(err);
          else resolve(row.total);
        },
      );
    });
  }

  // -------------------------------------------------- //
  //  BATCH IMPORT - SERVER (DIPERBAIKI)               //
  // -------------------------------------------------- //
  _batchServer(storeName, dataArray) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!Array.isArray(dataArray)) {
        return reject(new Error("Data harus berupa array"));
      }

      var success = 0,
        error = 0;

      self.db.serialize(function () {
        self.db.run("BEGIN TRANSACTION");

        var pending = dataArray.length;
        if (pending === 0) {
          self.db.run("COMMIT");
          return resolve({ success: 0, error: 0, total: 0 });
        }

        dataArray.forEach(function (record, idx) {
          if (!record.id) {
            error++;
            pending--;
            if (pending === 0) finishTransaction();
            return;
          }

          // Ekstrak kolom dinamis agar saldo_harian terisi dengan benar
          var js = JSON.stringify(record);
          var { cn, cv } = self._getColumnsAndValues(storeName, record);

          // Bangun Query SQL Dinamis
          // Contoh: INSERT OR REPLACE INTO saldo_harian (id, data, cabang, char4, ...) VALUES (?,?,?,?...)
          var ph = cn
            .map(function () {
              return "?";
            })
            .join(", ");
          var sql = "INSERT OR REPLACE INTO " + storeName + " (id, data";
          if (cn.length > 0) sql += ", " + cn.join(", ");
          sql += ") VALUES (?, ?";
          if (cn.length > 0) sql += ", " + ph + ")";

          var params = [record.id, js].concat(cv);

          self.db.run(sql, params, function (err) {
            if (err) {
              error++;
              console.warn("Batch error baris " + (idx + 1) + ":", err.message);
            } else {
              success++;
            }
            pending--;
            if (pending === 0) finishTransaction();
          });
        });

        function finishTransaction() {
          self.db.run("COMMIT", function (commitErr) {
            if (commitErr) {
              self.db.run("ROLLBACK");
              reject(commitErr);
            } else {
              resolve({
                success: success,
                error: error,
                total: dataArray.length,
              });
            }
          });
        }
      });
    });
  }

  // -------------------------------------------------- //
  //  FUNGSI KHUSUS SALDO HARIAN (SERVER)              //
  // -------------------------------------------------- //
  putSaldoHarian(cabang, char4, tanggal, saldoAkhir) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var id = (cabang || "Pusat") + "_" + (char4 || " ") + "_" + tanggal;
      var dataObj = {
        id: id,
        cabang: cabang || "Pusat",
        char4: char4 || " ",
        tanggal: tanggal,
        saldo_akhir: Number(saldoAkhir || 0),
      };
      var dataStr = JSON.stringify(dataObj);

      // Gunakan _putServer logic secara manual untuk memastikan kolom terisi
      var query = `
        INSERT OR REPLACE INTO saldo_harian (id, data, cabang, char4, tanggal, saldo_akhir) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      self.db.run(
        query,
        [
          id,
          dataStr,
          dataObj.cabang,
          dataObj.char4,
          dataObj.tanggal,
          dataObj.saldo_akhir,
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ success: true, id: id });
        },
      );
    });
  }

  getSaldoAwalEfisien(cabang, char4, tanggalAwal) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var cab = cabang || "Pusat";
      var c4 = char4 || " ";
      var query = `
        SELECT saldo_akhir FROM saldo_harian 
        WHERE cabang = ? AND char4 = ? AND tanggal < ? 
        ORDER BY tanggal DESC 
        LIMIT 1
      `;
      self.db.get(query, [cab, c4, tanggalAwal], function (err, row) {
        if (err) return reject(err);
        if (row) {
          resolve(Number(row.saldo_akhir || 0));
        } else {
          // Jika tidak ada riwayat saldo harian, cek saldo awal master di tabel kodeBank
          var masterQuery = `
            SELECT data FROM kodeBank 
            WHERE cabang = ? AND (substr(kodebank, 4, 1) = ? OR (? = ' ' AND length(kodebank) < 4))
            LIMIT 1
          `;
          self.db.get(
            masterQuery,
            [cab, c4, c4],
            function (errMaster, masterRow) {
              if (errMaster) return reject(errMaster);
              if (masterRow) {
                var bankData = JSON.parse(masterRow.data);
                resolve(Number(bankData.awal || 0));
              } else {
                resolve(0);
              }
            },
          );
        }
      });
    });
  }

  // ================================================== //
  // LOGIKA BROWSER (FETCH API)
  // ================================================== //
  _openBrowser() {
    return fetch(API_BASE_URL + "/api/data/users")
      .then(function () {})
      .catch(function () {
        throw new Error("Server tidak terhubung");
      });
  }

  _putBrowser(s, d) {
    return fetch(API_BASE_URL + "/api/data/" + s, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    })
      .then(function (res) {
        var contentType = res.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") !== -1) {
          return res.json();
        } else {
          return res.text().then(function (text) {
            console.warn("Server mengembalikan non-JSON:", text);
            return {};
          });
        }
      })
      .catch(function (err) {
        console.error("Gagal menghubungi server:", err);
        return {};
      });
  }

  _addBrowser(s, d) {
    return fetch(API_BASE_URL + "/api/data/" + s, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    })
      .then(function (res) {
        var contentType = res.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") !== -1) {
          return res.json();
        } else {
          return res.text().then(function (text) {
            console.warn("Server mengembalikan non-JSON:", text);
            return {};
          });
        }
      })
      .catch(function (err) {
        console.error("Gagal menghubungi server:", err);
        return {};
      });
  }

  _getBrowser(s, id) {
    return fetch(API_BASE_URL + "/api/data/" + s + "/" + id).then(function (r) {
      return r.json();
    });
  }

  // ✅ KODE BARU (Bisa menerima 1 atau 2 parameter)
  _getAllBrowser(s, cabangParam) {
    // ✅ TAMBAHKAN 3 BARIS INI UNTUK MENGHENTIKAN ERROR 400
    if (s === "saldokasirawal") {
      return Promise.resolve([]);
    }

    // 1. Tentukan filter cabang
    let cabang = "";
    if (
      cabangParam !== undefined &&
      cabangParam !== null &&
      cabangParam !== ""
    ) {
      cabang = cabangParam;
    } else {
      cabang = localStorage.getItem("cabang") || "";
    }

    // Jika PUSAT atau kosong, hapus filternya (biar backend kirim semua data)
    if (!cabang || cabang.toUpperCase() === "PUSAT") {
      cabang = "";
    }

    // ✅ 2. AMBIL FILTER GROUP DARI LOCALSTORAGE
    let group = localStorage.getItem("group") || "";

    // 3. Bangun URL (DITAMBAHKAN LOGIKA PARAMETER GROUP)
    let url = API_BASE_URL + "/api/data/" + s;
    let params = [];

    if (cabang && cabang !== "undefined") {
      params.push("cabang=" + cabang);
    }

    // Jika group-nya ada (misal: "TLGA"), tambahkan ke parameter URL
    if (group && group !== "undefined" && group.trim() !== "") {
      params.push("group=" + group);
    }

    // Gabungkan parameter dengan tanda "?"
    if (params.length > 0) {
      url += "?" + params.join("&");
    }

    // 4. Fetch data
    return fetch(url).then(function (r) {
      return r.json();
    });
  }

  _delBrowser(s, id) {
    return fetch(API_BASE_URL + "/api/data/" + s + "/" + id, {
      method: "DELETE",
    });
  }

  _clearBrowser(s) {
    return fetch(API_BASE_URL + "/api/data/" + s, { method: "DELETE" });
  }

  _countBrowser(s) {
    return fetch(API_BASE_URL + "/api/count/" + s).then(function (r) {
      return r.json();
    });
  }

  _backupBrowser() {
    return fetch(API_BASE_URL + "/api/backup")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        return JSON.stringify(d, null, 2);
      });
  }

  _restoreBrowser(js) {
    return fetch(API_BASE_URL + "/api/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: js,
    });
  }

  _batchBrowser(storeName, dataArray) {
    return fetch(API_BASE_URL + "/api/batch/" + storeName, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataArray),
    }).then(function (res) {
      if (!res.ok) {
        return res
          .json()
          .then(function (err) {
            throw new Error(err.error || "HTTP " + res.status);
          })
          .catch(function (e) {
            if (e.message && e.message.startsWith("HTTP")) throw e;
            throw new Error("HTTP " + res.status);
          });
      }
      return res.json();
    });
  }
}

// ================================================== //
// DETEKSI OTOMATIS LINGKUNGAN & EXPORT
// ================================================== //

if (typeof module !== "undefined" && module.exports) {
  // --- ENVIRONMENT: SERVER (NODE.JS) ---
  PembukuanDB.prototype.open = PembukuanDB.prototype._openServer;
  PembukuanDB.prototype.add = PembukuanDB.prototype._addServer;
  PembukuanDB.prototype.put = PembukuanDB.prototype._putServer;
  PembukuanDB.prototype.get = PembukuanDB.prototype._getServer;
  PembukuanDB.prototype.getAll = PembukuanDB.prototype._getAllServer;
  PembukuanDB.prototype.del = PembukuanDB.prototype._delServer;
  PembukuanDB.prototype.clear = PembukuanDB.prototype._clearServer;
  PembukuanDB.prototype.count = PembukuanDB.prototype._countServer;
  PembukuanDB.prototype.batch = PembukuanDB.prototype._batchServer;

  module.exports = PembukuanDB;
} else {
  // --- ENVIRONMENT: BROWSER ---
  PembukuanDB.prototype.open = PembukuanDB.prototype._openBrowser;
  PembukuanDB.prototype.add = PembukuanDB.prototype._addBrowser;
  PembukuanDB.prototype.put = PembukuanDB.prototype._putBrowser;
  PembukuanDB.prototype.get = PembukuanDB.prototype._getBrowser;
  PembukuanDB.prototype.getAll = PembukuanDB.prototype._getAllBrowser;
  PembukuanDB.prototype.del = PembukuanDB.prototype._delBrowser;
  PembukuanDB.prototype.clear = PembukuanDB.prototype._clearBrowser;
  PembukuanDB.prototype.count = PembukuanDB.prototype._countBrowser;
  PembukuanDB.prototype.backup = PembukuanDB.prototype._backupBrowser;
  PembukuanDB.prototype.restore = PembukuanDB.prototype._restoreBrowser;
  PembukuanDB.prototype.batch = PembukuanDB.prototype._batchBrowser;

  // Inisialisasi Otomatis di Browser
  var db = new PembukuanDB();

  // Helper global init (opsional, dipanggil di script HTML)
  window.initDB = async function () {
    try {
      await db.open();
      console.log("Database Browser Terhubung");
    } catch (e) {
      console.error(e);
    }
  };
}
