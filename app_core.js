/* ====================================================================
   AUTO LOG CAPTURE - MENYELAMATKAN HISTORI CONSOLE SEBELUM RELOAD
   ==================================================================== */
(function () {
  var _logHistory = [];
  var maxLogs = 500; // Batasi supaya tidak terlalu berat

  // 1. Menyadap semua fungsi console
  var originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    trace: console.trace.bind(console),
  };

  function captureLog(args, type) {
    try {
      var msg = Array.prototype.slice
        .call(args)
        .map(function (a) {
          if (a instanceof Error)
            return "[Error] " + a.message + "\n" + a.stack;
          if (typeof a === "object") {
            try {
              return JSON.stringify(a, null, 2);
            } catch (e) {
              return String(a);
            }
          }
          return String(a);
        })
        .join(" | ");

      _logHistory.push(
        "[" +
          new Date().toLocaleTimeString() +
          "] [" +
          type.toUpperCase() +
          "] " +
          msg,
      );

      // Jika sebelumnya ada console.trace, tangkap stack-nya
      if (type === "trace") {
        try {
          throw new Error("Stack Trace");
        } catch (e) {
          _logHistory.push(e.stack.split("\n").slice(2).join("\n"));
        }
      }

      if (_logHistory.length > maxLogs) _logHistory.shift();
    } catch (e) {}
  }

  console.log = function () {
    captureLog(arguments, "log");
    originalConsole.log.apply(console, arguments);
  };
  console.error = function () {
    captureLog(arguments, "error");
    originalConsole.error.apply(console, arguments);
  };
  console.warn = function () {
    captureLog(arguments, "warn");
    originalConsole.warn.apply(console, arguments);
  };
  console.info = function () {
    captureLog(arguments, "info");
    originalConsole.info.apply(console, arguments);
  };
  console.trace = function () {
    captureLog(arguments, "trace");
    originalConsole.trace.apply(console, arguments);
  };

  // 2. Fungsi untuk memaksa download file TXT
  function forceDownloadLog() {
    if (_logHistory.length === 0) return;

    var textContent = "===== AUTO DEBUG CAPTURE =====\n";
    textContent += "Waktu Ambil: " + new Date().toLocaleString() + "\n";
    textContent += "Total Log: " + _logHistory.length + "\n";
    textContent += "=================================\n\n";
    textContent += _logHistory.join("\n\n");

    var blob = new Blob([textContent], { type: "text/plain" });
    var url = URL.createObjectURL(blob);

    // ✅ SOLUSI: Gunakan trik iFrame tersembunyi atau langsung ubah lokasi unduhan
    // agar browser tahu ini murni unduhan file, BUKAN navigasi pindah halaman.
    var a = document.createElement("a");
    a.href = url;
    //a.download = "debug_history_.txt";
    a.style.display = "none";
    a.target = "_blank"; // PENTING: Buka di latar belakang agar tidak mengganggu halaman utama

    document.body.appendChild(a);
    a.click();

    // Berikan jeda sedikit sebelum menghapus elemen agar unduhan sukses di latar belakang
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // 3. MENGHAMPIRAN SAAT HALAMAN HENDAK REFRESH / CRASH / PINDAH
  window.addEventListener("beforeunload", function (e) {
    originalConsole.error(
      "⚠️ HALAMAN HENDAK DI-RELOAD/CRASH! Menyelamatkan log ke TXT...",
    );
    forceDownloadLog();
  });

  // 4. TAMBAHAN: Menangkap Error Javascript Global yang tidak tertangkap (unhandled exception)
  window.addEventListener("error", function (event) {
    var errMsg = event.message;
    var errSrc =
      event.filename + " (Baris: " + event.lineno + ":" + event.colno + ")";
    _logHistory.push(
      "[" +
        new Date().toLocaleTimeString() +
        "] [FATAL ERROR] " +
        errMsg +
        " di " +
        errSrc,
    );
    originalConsole.error("💥 FATAL ERROR TERTANGKAP:", errMsg, "di", errSrc);
  });

  window.addEventListener("unhandledrejection", function (event) {
    _logHistory.push(
      "[" +
        new Date().toLocaleTimeString() +
        "] [PROMISE ERROR] " +
        event.reason,
    );
    originalConsole.error("🚨 PROMISE ERROR TERTANGKAP:", event.reason);
  });

  // Info di console bahwa sniper sudah aktif
  originalConsole.info(
    "🎯 Sniper Debug aktif. Semua log akan diselamatkan ke TXT jika halaman crash/reload.",
  );
})();

/* ================================================================
   app_core.js — FIXED VERSION
   ================================================================ */

/* ---------- Inject CSS untuk Bulk Delete ---------- */
(function () {
  var s = document.createElement("style");
  s.textContent =
    ".bulk-bar{display:none;align-items:center;justify-content:space-between;padding:.6rem .9rem;margin-bottom:.7rem;background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(245,158,11,.05));border:1px solid rgba(245,158,11,.25);border-radius:var(--r,10px);backdrop-filter:blur(6px);animation:bulkIn .25s ease;position:sticky;top:0;z-index:10}" +
    "@keyframes bulkIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}" +
    ".bulk-bar-left{display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--fg)}" +
    ".bulk-bar-left strong{color:var(--accent);font-size:1rem;font-weight:700;min-width:1.5rem;text-align:center}" +
    ".bulk-bar-right{display:flex;align-items:center;gap:.4rem}" +
    ".bulk-cb,.bulk-all-cb{cursor:pointer;accent-color:var(--accent);width:16px;height:16px;border-radius:3px;transition:transform .15s ease}" +
    ".bulk-cb:hover,.bulk-all-cb:hover{transform:scale(1.2)}" +
    "tbody tr.row-checked{background:rgba(245,158,11,.07)!important}";
  document.head.appendChild(s);
})();

/* ---------- Event delegation untuk checkbox ---------- */
document.addEventListener("change", function (e) {
  if (e.target.classList && e.target.classList.contains("bulk-cb")) {
    var tr = e.target.closest("tr");
    if (tr) tr.classList.toggle("row-checked", e.target.checked);
    bulkToggle(e.target.dataset.store, e.target.dataset.id, e.target.checked);
  }
  if (e.target.classList && e.target.classList.contains("bulk-all-cb")) {
    var store = e.target.dataset.store;
    var key = bulkGetKey(store);
    if (!_bulkSelected[key] || !_bulkStoreMap[key]) return;
    if (e.target.checked) {
      _bulkStoreMap[key].ids.forEach(function (id) {
        _bulkSelected[key].add(id);
      });
    } else {
      _bulkSelected[key].clear();
    }
    var cbs = document.querySelectorAll('.bulk-cb[data-store="' + store + '"]');
    cbs.forEach(function (cb) {
      cb.checked = e.target.checked;
      var row = cb.closest("tr");
      if (row) row.classList.toggle("row-checked", e.target.checked);
    });
    bulkUpdateUI(store);
  }
});

/* ================================================================
   UTILITAS DASAR
   ================================================================ */
function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substr(2, 12) +
    Math.random().toString(36).substr(2, 12)
  );
}
function num(v) {
  return parseFloat(v) || 0;
}
function fmtN(n) {
  return num(n).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
function esc(s) {
  var d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}
// ✅ KODE BARU (Aman, memberikan objek tiruan kosong jika elemen tidak ada di layar)
function $(id) {
  var el = document.getElementById(id);
  if (!el) {
    // Jika elemen tidak ada, kembalikan objek tiruan agar .value atau .disabled tidak memicu crash
    return {
      value: "",
      disabled: false,
      style: {},
      classList: { add: function () {}, remove: function () {} },
    };
  }
  return el;
}

function toast(m, t) {
  t = t || "inf";
  var ic = {
    ok: "fa-circle-check",
    err: "fa-circle-xmark",
    inf: "fa-circle-info",
    wrn: "fa-triangle-exclamation",
  };
  var e = document.createElement("div");
  e.className = "toast toast-" + t;
  e.innerHTML = '<i class="fa-solid ' + ic[t] + '"></i><span>' + m + "</span>";
  $("toasts").appendChild(e);
  setTimeout(function () {
    e.classList.add("out");
    setTimeout(function () {
      e.remove();
    }, 250);
  }, 3000);
}

/**
 * Fungsi untuk menyalin isi tabel HTML ke Clipboard agar bisa di-paste ke Excel
 * @param {string} tableId - ID dari elemen <table>
 */
function copyTableToExcel(tableId) {
  var table = document.getElementById(tableId);
  if (!table) {
    toast("Tabel tidak ditemukan", "err");
    return;
  }

  var rows = table.querySelectorAll("tr");
  var excelString = "";

  for (var i = 0; i < rows.length; i++) {
    var cols = rows[i].querySelectorAll("td, th");
    var rowArray = [];

    for (var j = 0; j < cols.length; j++) {
      var text = cols[j].innerText.replace(/\n/g, " ").trim();

      // ✅ SOLUSI: Tambahkan tanda petik tunggal di depan teks
      // Ini memaksa Excel membaca sel tersebut sebagai TEKS (Bukan Angka)
      // Catatan: Header (th) biasanya tidak perlu diberi tanda petik
      if (cols[j].tagName === "TH") {
        rowArray.push(text);
      } else {
        rowArray.push("'" + text);
      }
    }

    excelString += rowArray.join("\t") + "\n";
  }

  // Salin ke clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(excelString)
      .then(function () {
        toast(
          "✅ Data berhasil disalin sebagai TEKS! (Tidak akan berubah di Excel)",
          "ok",
        );
      })
      .catch(function () {
        fallbackCopy(excelString);
      });
  } else {
    fallbackCopy(excelString);
  }
}

// Fallback untuk browser lama / HTTP (bukan HTTPS)
function fallbackCopy(text) {
  var textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    toast("✅ Data berhasil disalin! Buka Excel lalu Ctrl+V.", "ok");
  } catch (err) {
    toast("Gagal menyalin data", "err");
  }
  document.body.removeChild(textarea);
}

setInterval(function () {
  var d = new Date();
  $("clockEl").textContent =
    d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}, 1000);

function openModal(title, bodyHTML, footHTML) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = bodyHTML;
  $("modalFoot").innerHTML = footHTML || "";
  $("modalOv").classList.add("show");

  // Perbesar ukuran elemen modal
  var modalEl =
    document.querySelector(".modal") || document.getElementById("modal");
  if (modalEl) {
    modalEl.style.width = "90%"; // Fleksibel di layar kecil
    modalEl.style.maxWidth = "1000px"; // Batas lebar maksimal di layar besar
  }
}

function closeModal() {
  // Gunakan document.getElementById asli jika mau akses classList
  var modalOv = document.getElementById("modalOv");
  if (modalOv) modalOv.classList.remove("show");
}

// ✅ AMAN: Gunakan document.getElementById asli, bungkus dengan IF agar tidak crash
// jika elemen tidak ada di halaman tertentu (misal: laporan.html)
document.addEventListener("DOMContentLoaded", function () {
  var mc = document.getElementById("modalClose");
  if (mc) mc.onclick = closeModal;

  var mo = document.getElementById("modalOv");
  if (mo)
    mo.addEventListener("click", function (e) {
      if (e.target === mo) closeModal();
    });

  var mt = document.getElementById("mobToggle");
  if (mt)
    mt.onclick = function () {
      var sb = document.getElementById("sidebar");
      if (sb) sb.classList.toggle("open");
    };
});
/* ================================================================
   DATABASE CACHE
   ================================================================ */
var DBCache = {};
async function refreshCache() {
  try {
    const cabangSaya = localStorage.getItem("cabang") || "";
    console.log("Cache: Memuat data secara paralel untuk cabang:", cabangSaya);

    const baseUrl = window.location.origin + "/api/data/";

    // 🚀 KELOMPOK 1: Data Master INDUK (WAJIB GLOBAL, TIDAK BOLEH DIFILTER)
    // Kita pakai fetch() murni untuk mem-bypass kode lama di db_pbukuan.js
    // Supaya daftar User & Daftar Cabang selalu lengkap untuk dropdown.
    const [
      users,
      formatRL,
      formatNeraca,
      postedMonths,
      allCabang,
      groupproject,
    ] = await Promise.all([
      fetch(baseUrl + "users").then((r) => r.json()),
      fetch(baseUrl + "formatRL").then((r) => r.json()),
      fetch(baseUrl + "formatNeraca").then((r) => r.json()),
      fetch(baseUrl + "postedMonths").then((r) => r.json()),
      fetch(baseUrl + "cabang").then((r) => r.json()),
      fetch(baseUrl + "groupproject").then((r) => r.json()),
    ]);

    // Simpan Master Induk
    DBCache.users = users;
    DBCache.formatRL = formatRL;
    DBCache.formatNeraca = formatNeraca;
    DBCache.postedMonths = postedMonths;
    DBCache.groupproject = groupproject;

    // ✅ LOGIKA FILTER DROPDOWN CABANG
    if (
      cabangSaya &&
      cabangSaya !== "PUSAT" &&
      cabangSaya.toUpperCase() !== "PUSAT"
    ) {
      // Jika BUKAN Pusat (misal 05), kunci dropdown hanya ke cabangnya sendiri
      DBCache.cabang = allCabang.filter(
        (c) => String(c.kode) === String(cabangSaya),
      );
    } else {
      // Jika Pusat (00), tampilkan semua cabang
      DBCache.cabang = allCabang;
    }
    // 🚀 KELOMPOK 2: Data Operasional/Transaksi (DIFILTER SESUAI CABANG USER)
    // Golongan, Perkiraan, dll tetap memakai db.getAll karena kodenya sudah benar
    // 🚀 KELOMPOK 2: Data Operasional (DIFILTER CABANG + GROUP SECARA OPTIMAL DI SERVER)
    // Ambil group aktif dari localStorage (default: "TLGA" jika belum ada)
    const activeGroup = localStorage.getItem("activeGroup") || "TLGA";

    // Gunakan fetch murni agar kita bisa menyisipkan parameter &group=...
    // dan memanfaatkan kecepatan filter yang sudah dibuat di serverold.js
    const [
      golongan,
      perkiraan,
      kodeBank,
      saldoKasir,
      saldokasirawal,
      mutasikasir,
      saldo_harian,
    ] = await Promise.all([
      fetch(
        `${baseUrl}golongan?cabang=${cabangSaya}&group=${activeGroup}`,
      ).then((r) => r.json()),
      fetch(
        `${baseUrl}perkiraan?cabang=${cabangSaya}&group=${activeGroup}`,
      ).then((r) => r.json()),
      fetch(
        `${baseUrl}kodeBank?cabang=${cabangSaya}&group=${activeGroup}`,
      ).then((r) => r.json()),
      fetch(
        `${baseUrl}saldoKasir?cabang=${cabangSaya}&group=${activeGroup}`,
      ).then((r) => r.json()),
      fetch(
        `${baseUrl}saldokasirawal?cabang=${cabangSaya}&group=${activeGroup}`,
      ).then((r) => r.json()),
      fetch(
        `${baseUrl}mutasikasir?cabang=${cabangSaya}&group=${activeGroup}`,
      ).then((r) => r.json()),
      fetch(
        `${baseUrl}saldo_harian?cabang=${cabangSaya}&group=${activeGroup}`,
      ).then((r) => r.json()),
    ]);

    // Simpan Data Operasional
    DBCache.golongan = golongan;
    DBCache.perkiraan = perkiraan;
    DBCache.kodeBank = kodeBank;
    DBCache.saldoKasir = saldoKasir;
    DBCache.saldokasirawal = saldokasirawal;

    DBCache.mutasikasir = mutasikasir;
    DBCache.saldo_harian = saldo_harian;
    // ========================================================
    // 🚀 1. AUTO-INJECTOR KE MEMORY (Agar tampilan langsung TLGA)
    // ========================================================
    var targetTables = [
      "golongan",
      "perkiraan",
      "kodeBank",
      "cabang",
      "saldokasir",
      "saldokasirawal",
      "mutasikasir",
      "saldo_harian",
    ];

    var needDbUpdate = []; // Array untuk menampung data yang perlu diupdate ke server

    targetTables.forEach(function (tableName) {
      if (DBCache[tableName] && Array.isArray(DBCache[tableName])) {
        DBCache[tableName].forEach(function (row) {
          // Jika belum punya group, set ke "TLGA" di memory
          if (
            typeof row.group === "undefined" ||
            row.group === null ||
            row.group === ""
          ) {
            row.group = "TLGA";

            // Masukkan ke antrian untuk dikirim ke database
            needDbUpdate.push({ store: tableName, id: row.id, data: row });
          }

          // Untuk mutasi kasir
          if (tableName === "mutasikasir" && Array.isArray(row.detil)) {
            row.detil.forEach(function (det) {
              if (
                typeof det.group === "undefined" ||
                det.group === null ||
                det.group === ""
              ) {
                det.group = "TLGA";
              }
            });
          }
        });
      }
    });

    // ========================================================
    // 🚀 2. AUTO-SYNC KE DATABASE SECARA BERTAHAP (AMAN DARI CRASH)
    // ========================================================
    if (needDbUpdate.length > 0) {
      console.log(
        "⏳ Menemukan " +
          needDbUpdate.length +
          " data tanpa group. Memperbarui database secara bertahap...",
      );

      var batchSize = 25; // Kirim 25 data per gelombang agar browser tidak crash
      var updatedCount = 0;

      for (var i = 0; i < needDbUpdate.length; i += batchSize) {
        var batch = needDbUpdate.slice(i, i + batchSize);

        // Proses 25 data secara paralel, lalu tunggu sampai selesai
        await Promise.all(
          batch.map(function (item) {
            return fetch(
              API_BASE_URL + "/api/data/" + item.store + "/" + item.id,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item.data),
              },
            )
              .then(function () {
                updatedCount++;
              })
              .catch(function (e) {
                console.error(
                  "Gagal update group untuk ID: " + item.id,
                  e.message,
                );
              });
          }),
        );

        // Beri jeda 100ms sebelum gelombang berikutnya, supaya server & browser bisa bernafas
        if (i + batchSize < needDbUpdate.length) {
          await new Promise(function (resolve) {
            setTimeout(resolve, 100);
          });
        }
      }

      console.log(
        "✅ Berhasil menyuntikkan 'TLGA' ke " +
          updatedCount +
          " data di Database Supabase.",
      );
    }

    console.log(
      "✅ Cache master berhasil dimuat. Data cabang ditemukan:",
      DBCache.cabang.length,
    );
  } catch (error) {
    console.error("❌ Gagal memuat cache master:", error);
  }
}

async function refreshCache2(onlyStore) {
  if (onlyStore) {
    DBCache[onlyStore] = await db.getAll(onlyStore);
    return;
  }
}

/* ================================================================
   BULK DELETE — State & Helpers
   ================================================================ */
var _bulkSelected = {};
var _bulkStoreMap = {};

function bulkGetKey(store) {
  return "bulk_" + store + "_" + currentPanel;
}
function bulkCleanup(store) {
  var key = bulkGetKey(store);
  delete _bulkSelected[key];
  delete _bulkStoreMap[key];
}
function bulkInit(store, idList) {
  var key = bulkGetKey(store);
  _bulkSelected[key] = new Set();
  _bulkStoreMap[key] = { store: store, ids: idList };
  bulkUpdateUI(store);
}
function bulkToggle(store, id, checked) {
  var key = bulkGetKey(store);
  if (!_bulkSelected[key]) return;
  if (checked) _bulkSelected[key].add(id);
  else _bulkSelected[key].delete(id);
  bulkUpdateUI(store);
}
function bulkToggleAll(store, checked) {
  var key = bulkGetKey(store);
  if (!_bulkSelected[key] || !_bulkStoreMap[key]) return;
  if (checked)
    _bulkStoreMap[key].ids.forEach(function (id) {
      _bulkSelected[key].add(id);
    });
  else _bulkSelected[key].clear();
  var allCb = document.querySelector(
    '.bulk-all-cb[data-store="' + store + '"]',
  );
  if (allCb) {
    allCb.checked = checked;
    allCb.indeterminate = false;
  }
  var cbs = document.querySelectorAll('.bulk-cb[data-store="' + store + '"]');
  cbs.forEach(function (cb) {
    cb.checked = checked;
    var tr = cb.closest("tr");
    if (tr) tr.classList.toggle("row-checked", checked);
  });
  bulkUpdateUI(store);
}
function bulkGetCount(store) {
  var key = bulkGetKey(store);
  return _bulkSelected[key] ? _bulkSelected[key].size : 0;
}
function bulkGetIds(store) {
  var key = bulkGetKey(store);
  return _bulkSelected[key] ? Array.from(_bulkSelected[key]) : [];
}
function bulkIsAllSelected(store) {
  var key = bulkGetKey(store);
  if (!_bulkSelected[key] || !_bulkStoreMap[key]) return false;
  return (
    _bulkSelected[key].size === _bulkStoreMap[key].ids.length &&
    _bulkStoreMap[key].ids.length > 0
  );
}
function bulkIsIndeterminate(store) {
  var key = bulkGetKey(store);
  if (!_bulkSelected[key] || !_bulkStoreMap[key]) return false;
  var cnt = _bulkSelected[key].size;
  return cnt > 0 && cnt < _bulkStoreMap[key].ids.length;
}
function bulkUpdateUI(store) {
  var cnt = bulkGetCount(store);
  var bar = $("bulkBar_" + store);
  var allCb = document.querySelector(
    '.bulk-all-cb[data-store="' + store + '"]',
  );
  if (bar) {
    if (cnt > 0) {
      bar.style.display = "flex";
      $("bulkCount_" + store).textContent = cnt;
    } else {
      bar.style.display = "none";
    }
  }
  if (allCb) {
    allCb.checked = bulkIsAllSelected(store);
    allCb.indeterminate = bulkIsIndeterminate(store);
  }
}
function bulkShowConfirm(store) {
  var ids = bulkGetIds(store);
  var labelMap = {
    golongan: "Golongan",
    perkiraan: "Perkiraan",
    transaksi: "Transaksi",
    formatRL: "Format RL",
    formatNeraca: "Format Neraca",
    users: "User",
    kodeBank: "Kode Bank",
    cabang: "Cabang",
    saldoKasirAwal: "saldoKasirAwal",
    groupproject: "Group Project",
  };
  var storeLabel = labelMap[store] || store;
  openModal(
    "Konfirmasi Hapus Masal",
    '<div class="confirm-box"><div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1rem;padding:.8rem;background:rgba(220,53,69,.1);border:1px solid rgba(220,53,69,.3);border-radius:8px"><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);font-size:1.3rem"></i><div><strong style="color:var(--danger)">Hapus ' +
      ids.length +
      " data " +
      storeLabel +
      '?</strong><div style="font-size:.78rem;color:var(--muted);margin-top:.2rem">Tindakan ini tidak dapat dibatalkan</div></div></div><div style="max-height:180px;overflow-y:auto;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:.5rem;font-size:.74rem;font-family:JetBrains Mono,monospace;color:var(--muted)">' +
      ids
        .map(function (id, i) {
          return (
            '<div style="padding:.2rem .4rem;border-bottom:1px solid var(--brd)">' +
            (i + 1) +
            ". " +
            esc(id) +
            "</div>"
          );
        })
        .join("") +
      '</div><div class="cb-btns" style="margin-top:1rem"><button class="btn btn-g" onclick="closeModal()">Batal</button><button class="btn btn-r" onclick="doBulkDelete(\'' +
      store +
      '\')"><i class="fa-solid fa-trash-can"></i> Ya, Hapus ' +
      ids.length +
      " Data</button></div></div>",
  );
}
async function doBulkDelete(store) {
  var ids = bulkGetIds(store);
  if (!ids.length) {
    closeModal();
    return;
  }
  var cnt = 0;
  for (var i = 0; i < ids.length; i++) {
    try {
      await db.del(store, ids[i]);
      cnt++;
    } catch (e) {}
  }
  bulkCleanup(store);
  closeModal();
  toast(cnt + " data berhasil dihapus", "ok");
  navigate(currentPanel);
}
function bulkBarHTML(store, storeLabel) {
  return (
    '<div id="bulkBar_' +
    store +
    '" class="bulk-bar" style="display:none"><div class="bulk-bar-left"><i class="fa-solid fa-square-check" style="color:var(--accent)"></i><span><strong id="bulkCount_' +
    store +
    '">0</strong> data ' +
    storeLabel +
    ' dipilih</span></div><div class="bulk-bar-right"><button class="btn btn-g btn-sm" onclick="bulkToggleAll(\'' +
    store +
    '\',false)"><i class="fa-solid fa-xmark"></i> Batal Pilih</button><button class="btn btn-r btn-sm" onclick="bulkShowConfirm(\'' +
    store +
    '\')"><i class="fa-solid fa-trash-can"></i> Hapus Terpilih</button></div></div>'
  );
}
function bulkBarHTMLCustom(store, storeLabel, deleteFn) {
  return (
    '<div id="bulkBar_' +
    store +
    '" class="bulk-bar" style="display:none"><div class="bulk-bar-left"><i class="fa-solid fa-square-check" style="color:var(--accent)"></i><span><strong id="bulkCount_' +
    store +
    '">0</strong> data ' +
    storeLabel +
    ' dipilih</span></div><div class="bulk-bar-right"><button class="btn btn-g btn-sm" onclick="bulkToggleAll(\'' +
    store +
    '\',false)"><i class="fa-solid fa-xmark"></i> Batal Pilih</button><button class="btn btn-r btn-sm" onclick="' +
    deleteFn +
    '"><i class="fa-solid fa-trash-can"></i> Hapus Terpilih</button></div></div>'
  );
}

/* ================================================================
   SIDEBAR & NAVIGASI
   ================================================================ */
var MENUS = [
  {
    group: "PERKIRAAN",
    icon: "fa-sitemap",
    items: [
      { id: "gol", label: "Golongan Perkiraan", icon: "fa-layer-group" },
      { id: "perk", label: "No Perkiraan", icon: "fa-list-ol" },
      { id: "cbg", label: "Cabang", icon: "fa-code-branch" },
      { id: "kode", label: "Kode Bank/Kas", icon: "fa-building-columns" },
      {
        id: "saldoKasirAwal",
        label: "Saldo Kasir",
        icon: "fa-building-columns",
      },
      { id: "group", label: "Group", icon: "fa-network-wired" },
    ],
  },
  {
    group: "MUTASI",
    icon: "fa-right-left",
    items: [
      {
        id: "mutasikasir",
        label: "Mutasi Harian Kasir",
        icon: "fa-right-left",
      },
      { id: "mutasi", label: "Mutasi Transaksi", icon: "fa-right-left" },
    ],
  },
  {
    group: "LAPORAN KAS",
    icon: "fa-cash-register",
    items: [
      { id: "saldoKasir", label: "Kas Harian Kasir", icon: "fa-calendar-day" },
      { id: "kasHarian", label: "Kas Pembukuan", icon: "fa-calendar-day" },
      { id: "inputHarian", label: "Input Harian", icon: "fa-keyboard" },
    ],
  },
  {
    group: "POSTING",
    icon: "fa-stamp",
    items: [
      // Hapus postBulan dan postTahun
      // Tambahkan posting (menu baru gabungan)
      { id: "posting", label: "Posting Periode", icon: "fa-calendar-check" },
    ],
  },

  {
    group: "LAPORAN KEUANGAN",
    icon: "fa-chart-pie",
    items: [
      { id: "neraca", label: "Neraca", icon: "fa-scale-balanced" },
      { id: "detilNeraca", label: "Detil Neraca", icon: "fa-table-list" },
      { id: "rlRekap", label: "RL Rekap Bulanan", icon: "fa-arrow-trend-down" },
      { id: "rlDetil", label: "RL Detil Bulanan", icon: "fa-bars-staggered" },
      { id: "rlLebar", label: "RL Rekap 1-12", icon: "fa-bars-staggered" },
      { id: "bukuBesar", label: "Buku Besar", icon: "fa-book" },
      //  { id: "expXls", label: "Export XLS", icon: "fa-file-excel" },
    ],
  },
  {
    group: "LAPORAN KEUANGAN GABUNGAN",
    icon: "fa-chart-pie",
    items: [
      {
        id: "rlRekaps",
        label: "RL Rekap Bulanan",
        icon: "fa-arrow-trend-down",
      },

      {
        id: "neraca",
        label: "Laporan Neraca",
        icon: "fa-scale-balanced",
      },

      { id: "arusKas", label: "Arus Kas Gabungan", icon: "fa-money-bill-wave" },
      { id: "Omset", label: "Detil Omset Per Menu", icon: "fa-bars-staggered" },
    ],
  },
  {
    group: "UTILITY",
    icon: "fa-wrench",
    items: [
      // { id: "importD", label: "Import Data", icon: "fa-file-import" },
      //  { id: "fmtRL", label: "Format RL", icon: "fa-file-contract" },
      //  { id: "fmtNeraca", label: "Format Neraca", icon: "fa-file-contract" },
      { id: "dbInfo", label: "Database", icon: "fa-database" },
      {
        id: "importFoxpro",
        label: "Import FoxPro Online",
        icon: "fa-cloud-arrow-up",
      },
      {
        id: "migrasiFisik",
        label: "Migrasi Kolom Fisik",
        icon: "fa-arrows-spin",
      },
    ],
  },
  {
    group: "USER",
    icon: "fa-users",
    items: [{ id: "userMgmt", label: "Manajemen User", icon: "fa-user-gear" }],
  },
];

function buildSidebar() {
  var h = "";
  MENUS.forEach(function (g, gi) {
    h +=
      '<div class="sb-grp"><div class="sb-grp-t" data-gi="' +
      gi +
      '">' +
      g.group +
      '<i class="fa-solid fa-chevron-down arr"></i></div><div class="sb-grp-items" data-gi="' +
      gi +
      '">';
    g.items.forEach(function (it) {
      h +=
        '<div class="sb-item" data-id="' +
        it.id +
        '"><i class="fa-solid ' +
        it.icon +
        '"></i>' +
        it.label +
        "</div>";
    });
    h += "</div></div>";
  });
  $("sbBody").innerHTML = h;
  document.querySelectorAll(".sb-grp-t").forEach(function (el) {
    el.onclick = function () {
      el.classList.toggle("collapsed");
      document
        .querySelector('.sb-grp-items[data-gi="' + el.dataset.gi + '"]')
        .classList.toggle("collapsed");
    };
  });
  document.querySelectorAll(".sb-item").forEach(function (el) {
    el.onclick = function () {
      // _lockNavigate = false; // 🔓 BUKA KUNCI SAAT USER KLIK MENU
      navigate(el.dataset.id);
    };
  });
}

var currentPanel = "blank";
//var currentPanel = "kode";
var PANEL_MAP = {};
var AFTER_RENDER = {};

PANEL_MAP["migrasiFisik"] = async function renderMigrasiFisik() {
  return `
    <div style="font-family: sans-serif; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      <div style="display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">
        <i class="fa-solid fa-arrows-spin fa-spin" style="font-size: 24px; color: #007bff; --fa-animation-duration: 3s;"></i>
        <h2 style="margin: 0; font-size: 18px; color: #333;">Utility: Sinkronisasi Struktur Kolom Fisik</h2>
      </div>

      <p style="color: #666; font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
        Fitur ini berguna untuk mengurai data dimensi dari kolom JSON <code>data</code> (seperti masa, cabang, dan group) ke dalam bentuk struktur kolom database fisik Supabase demi mengoptimalkan kecepatan pencarian laporan keuangan secara signifikan.
      </p>
      
      <div style="margin-bottom: 25px;">
        <button id="btnMulaiMigrasi" style="padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s; font-size: 13px;">
          <i class="fas fa-play" style="margin-right: 8px;"></i> Mulai Jalankan Migrasi Batch
        </button>
      </div>

      <!-- Progress Area -->
      <div id="panelProgress" style="display: none; background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #e9ecef;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 8px;">
          <span>Status Kerja: <span id="txtNamaTabel" style="color: #007bff;">-</span></span>
          <span id="txtPersen">0%</span>
        </div>
        
        <!-- Batang Progress -->
        <div style="width: 100%; background: #dee2e6; height: 14px; border-radius: 7px; overflow: hidden; margin-bottom: 15px;">
          <div id="barPersen" style="width: 0%; background: #28a745; height: 100%; transition: width 0.3s ease;"></div>
        </div>

        <!-- Tampilan Log Hitam Ala Terminal -->
        <div id="boxLogTerminal" style="background: #1e1e1e; color: #39ff14; font-family: monospace; padding: 12px; border-radius: 4px; height: 180px; overflow-y: auto; font-size: 11px; line-height: 1.6; white-space: pre-wrap;"></div>
      </div>
    </div>
  `;
};

AFTER_RENDER["migrasiFisik"] = function initMigrasiFisikUI() {
  const btn = document.getElementById("btnMulaiMigrasi");
  if (!btn) return;

  btn.addEventListener("click", async function () {
    const panel = document.getElementById("panelProgress");
    const txtTabel = document.getElementById("txtNamaTabel");
    const txtPersen = document.getElementById("txtPersen");
    const bar = document.getElementById("barPersen");
    const terminal = document.getElementById("boxLogTerminal");

    // Kunci tombol agar tidak memicu dobel request
    btn.disabled = true;
    btn.style.background = "#6c757d";
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Memproses Data...`;

    panel.style.display = "block";
    terminal.innerHTML = "🔌 Menyambungkan ke server Railway...\n";

    try {
      const response = await fetch(
        "/api/migrasi-kolom-fisik?secret=ubahdata2024",
        {
          method: "POST",
        },
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = JSON.parse(line.replace("data: ", ""));

            // 1. Update terminal teks
            terminal.innerHTML += `> ${payload.message}\n`;
            terminal.scrollTop = terminal.scrollHeight;

            // 2. Update Informasi tabel operasional
            if (payload.table) {
              txtTabel.innerText = payload.table.toUpperCase();
            }

            // 3. Update grafik batang persentase
            if (payload.percent !== undefined) {
              txtPersen.innerText = `${payload.percent}%`;
              bar.style.width = `${payload.percent}%`;
            }

            // 4. Selesai sempurna
            if (payload.status === "done") {
              btn.innerHTML = `<i class="fas fa-check"></i> Selesai Sukses`;
              btn.style.background = "#28a745";
              terminal.innerHTML += `\n[FINISH] Hubungan diputus secara aman. Database sudah sinkron.\n`;

              if (typeof toast === "function") {
                toast("Migrasi kolom fisik selesai!", "ok");
              } else {
                alert(
                  "🎉 Sukses! Seluruh data transaksi & master berhasil dimigrasi ke kolom fisik.",
                );
              }
            }
          }
        }
      }
    } catch (err) {
      terminal.innerHTML += `\n🔴 ERROR KONEKSI: ${err.message}\n`;
      btn.disabled = false;
      btn.style.background = "#007bff";
      btn.innerHTML = `<i class="fas fa-play"></i> Coba Ulangi Migrasi`;
    }
  });
};

async function navigate(id) {
  // 1. Bersihkan seleksi (ini jangan dihapus)
  [
    "golongan",
    "perkiraan",
    "transaksi",
    "formatRL",
    "formatNeraca",
    "users",
    "kodeBank",
    "saldoKasir",
    "saldoKasirAwal",
    "cabang",
  ].forEach(function (s) {
    bulkCleanup(s);
  });

  // 2. Refresh data MASTER (ringan)
  await refreshCache();

  // ✅ 3. LOGIKA BARU: Cek apakah halaman ini butuh Transaksi?
  var menusButuhTransaksi = [
    "mutasi",
    "inputHarian",
    "bukuBesar",
    "kasHarian",
    "neraca",
    "rlRekap",
    "rlDetil",
    "rlLebar",
    "detilNeraca",
  ];

  if (menusButuhTransaksi.includes(id)) {
    // 🌟 SEKARANG: Cukup muat data Indeks Referensi yang super ringan untuk panel kanan
    if (!DBCache.listrefftransaksi) {
      console.log(
        "⏳ Memuat indeks riwayat referensi transaksi (Sangat Ringan)...",
      );
      DBCache.listrefftransaksi = await db.getAll("listrefftransaksi");
    }

    // Matikan pemuat massal seluruh isi tabel transaksi. Set sebagai array kosong dulu.
    DBCache.transaksi = [];
  } else {
    // ♻️ Tetap bersihkan cache saat pindah menu agar RAM komputer pengguna selalu lega
    if (DBCache.transaksi) delete DBCache.transaksi;
    if (DBCache.listrefftransaksi) delete DBCache.listrefftransaksi;
  }

  // ... Lanjutkan kode navigate yang lama di bawah ini ...
  currentPanel = id;

  document.querySelectorAll(".sb-item").forEach(function (el) {
    el.classList.toggle("active", el.dataset.id === id);
  });

  var m = MENUS.flatMap(function (g) {
    return g.items;
  }).find(function (x) {
    return x.id === id;
  });

  const namaUser = localStorage.getItem("nama") || "User";
  const cabangUser = localStorage.getItem("cabang") || "--";

  $("tbTitle").innerHTML =
    '<i class="fa-solid ' +
    (m ? m.icon : "fa-home") +
    '"></i> ' +
    (m ? m.label : "Dashboard") +
    " <span style=\"font-size:0.7rem; opacity:0.7; margin-left:10px; font-family:'JetBrains Mono',monospace;\">| " +
    namaUser +
    " - Cab." +
    cabangUser +
    "</span>";

  $("sidebar").classList.remove("open");

  var C = $("contentArea");
  var fn = PANEL_MAP[id] || renderBlank;

  console.log("Navigate ke: " + id + " | Fungsi: " + (fn ? fn.name : "N/A"));

  var html = await fn();
  C.innerHTML = '<div class="pnl active">' + html + "</div>";

  if (AFTER_RENDER[id]) setTimeout(AFTER_RENDER[id], 30);
}

/* ================================================================
   GENERIC TABLE BUILDER
   ================================================================ */
function buildTable(headers, rows, opts) {
  opts = opts || {};
  var numCols = opts.numCols || [],
    foot = opts.foot,
    emptyMsg = opts.emptyMsg || "Belum ada data",
    actions = opts.actions,
    bulkStore = opts.bulkStore || null,
    bulkIds = opts.bulkIds || null;
  // Di dalam fungsi buildTable Anda, ubah bagian return awal menjadi:
  var tableId = opts.id ? ' id="' + opts.id + '"' : "";
  if (!rows.length) {
    return (
      '<div class="empty-msg"><i class="fa-solid fa-inbox"></i> ' +
      emptyMsg +
      "</div>"
    );
  }

  var h = "<table" + tableId + "><thead><tr>";

  //if (!rows.length)
  //  return (
  //   '<div class="empty-msg"><i class="fa-solid fa-inbox"></i>' +
  //   emptyMsg +
  //   "</div>"
  //  );

  if (bulkStore)
    h +=
      '<th style="width:40px;text-align:center"><input type="checkbox" class="bulk-all-cb" data-store="' +
      bulkStore +
      '"></th>';
  if (actions) h += '<th style="width:80px">Aksi</th>';
  headers.forEach(function (hd, i) {
    h +=
      "<th" +
      (numCols.indexOf(i) !== -1 ? ' class="num"' : "") +
      ">" +
      hd +
      "</th>";
  });
  h += "</tr></thead><tbody>";
  rows.forEach(function (row, ri) {
    h += "<tr>";
    if (bulkStore && bulkIds && bulkIds[ri]) {
      h +=
        '<td style="text-align:center"><input type="checkbox" class="bulk-cb" data-store="' +
        bulkStore +
        '" data-id="' +
        esc(bulkIds[ri]) +
        '"></td>';
    }
    if (actions)
      h += '<td style="white-space:nowrap">' + actions(row, ri) + "</td>";
    row.forEach(function (cell, ci) {
      h +=
        "<td" +
        (numCols.indexOf(ci) !== -1 ? ' class="num"' : "") +
        ' title="' +
        esc(cell) +
        '">' +
        cell +
        "</td>";
    });
    h += "</tr>";
  });
  h += "</tbody>";
  if (foot) {
    h += "<tfoot><tr>";
    if (bulkStore) h += "<td></td>";
    if (actions) h += "<td></td>";
    foot.forEach(function (c, i) {
      h +=
        "<td" +
        (numCols.indexOf(i) !== -1 ? ' class="num"' : "") +
        ">" +
        c +
        "</td>";
    });
    h += "</tr></tfoot>";
  }
  return h;
}
function wrapTable(html) {
  return (
    '<div class="tw"><div class="ts"><table>' + html + "</table></div></div>"
  );
}

/* ================================================================
   CRUD HELPERS
   ================================================================ */
function crudActions(id, dk) {
  return (
    '<button class="btn btn-g btn-sm" onclick="editRow(\'' +
    dk +
    "','" +
    esc(id) +
    '\')"><i class="fa-solid fa-pen"></i></button><button class="btn btn-r btn-sm" onclick="deleteRow(\'' +
    dk +
    "','" +
    esc(id) +
    '\')"><i class="fa-solid fa-trash"></i></button>'
  );
}
function gPerks(gol, perks) {
  return perks
    .filter(function (p) {
      return p.gol === gol;
    })
    .reduce(function (s, p) {
      return s + num(p.awal) + num(p.db) - num(p.cr);
    }, 0);
}
async function deleteRow(store, id) {
  openModal(
    "Konfirmasi",
    '<div class="confirm-box"><p>Yakin hapus data ini?</p><div class="cb-btns"><button class="btn btn-g" onclick="closeModal()">Batal</button><button class="btn btn-r" onclick="doDelete(\'' +
      store +
      "','" +
      esc(id) +
      "')\">Hapus</button></div></div>",
  );
}
async function doDelete(store, id) {
  await db.del(store, id);
  closeModal();
  toast("Data dihapus", "ok");
  navigate(currentPanel);
}
async function editRow(dk, id) {
  DBCache[dk] = await db.getAll(dk);
  if (dk === "golongan") formGol(id);
  else if (dk === "perkiraan") formPerk(id);
  else if (dk === "transaksi") formTrans(id);
  else if (dk === "users") formUser(id);
  else if (dk === "formatRL") formFmtRL(id);
  else if (dk === "formatNeraca") formFmtNeraca(id);
  else if (dk === "kodeBank") formKodeBank(id);
  else if (dk === "cabang") formCabang(id);
  else if (dk === "saldokasirawal") formSaldoKasirAwal(id);
}

/* ================================================================
   DASHBOARD FALLBACK
   ================================================================ */
async function renderDashboard() {
  var tg = await db.count("golongan"),
    tp = await db.count("perkiraan"),
    tt = await db.count("transaksi"),
    tu = await db.count("users"),
    tk = await db.count("kodeBank");

  return (
    '<div class="stat-row"><div class="stat-c"><div class="sv">' +
    tg +
    '</div><div class="sl">Golongan</div></div><div class="stat-c"><div class="sv">' +
    tp +
    '</div><div class="sl">Perkiraan</div></div><div class="stat-c"><div class="sv">' +
    tt +
    '</div><div class="sl">Transaksi</div></div><div class="stat-c"><div class="sv">' +
    tk +
    '</div><div class="sl">Kode Bank</div></div><div class="stat-c"><div class="sv">' +
    tu +
    '</div><div class="sl">User</div></div></div><div style="background:var(--card);border:1px solid var(--brd);border-radius:var(--r);padding:.7rem .9rem;font-size:.78rem;color:var(--muted)"><i class="fa-solid fa-database" style="color:var(--success)"></i> Data tersimpan di <strong style="color:var(--fg)">IndexedDB</strong></div>'
  );
}

/* ================================================================
   IMPORT DBF
   ================================================================ */
var _dbfParsed = null;
var _readyToImport = []; // ✅ FIX #3: akan di-reset di previewMappedData()
var _importFilter = {
  year: "",
  month: "",
  cabang: "",
};
// ✅ TAMBAHKAN INI
var _importOptions = {
  deleteAll: false,
};

var DBF_ENCODINGS = [
  { value: "auto", label: "Auto-detect" },
  { value: "utf-8", label: "UTF-8" },
  { value: "windows-1252", label: "Windows-1252 (Latin-1)" },
  { value: "cp437", label: "CP437 (DOS US)" },
  { value: "cp850", label: "CP850 (DOS Multilingual)" },
  { value: "iso-8859-1", label: "ISO-8859-1" },
];

var DBF_TARGETS = {
  golongan: [
    { key: "gol", label: "Kode Golongan", required: true },
    { key: "namaGol", label: "Nama Golongan", required: true },
    { key: "awal", label: "Saldo Awal", required: false },
    { key: "cabang", label: "Cabang", required: false },
  ],
  perkiraan: [
    { key: "gol", label: "Golongan", required: true },
    { key: "noPerk", label: "No Perkiraan", required: true },
    { key: "desc", label: "Deskripsi", required: true },
    { key: "awal", label: "Saldo Awal", required: false },
    { key: "cabang", label: "Cabang", required: false },
  ],
  kodeBank: [
    { key: "kodebank", label: "Kodebank", required: true },
    { key: "penjelasan", label: "Penjelasan", required: true },
    { key: "noper", label: "No Perkiraan", required: true },
    { key: "cabang", label: "Cabang", required: true },
  ],
  // ✅ TAMBAHKAN INI/
  transaksi: [
    { key: "tanggal", label: "Tanggal", required: true },
    { key: "noacct", label: "No Perkiraan", required: true },
    { key: "nopinj", label: "KodeTrans", required: false },
    { key: "darike", label: "Dari Kepada", required: true },
    { key: "desc", label: "Penjelasan", required: false },
    { key: "kodegab", label: "No Reff", required: true },
    { key: "total", label: "Total", required: true },
    { key: "qty", label: "Debit", required: false },
    { key: "harga", label: "Kredit", required: false },
    { key: "rest", label: "KodeCbg", required: true },
  ],
  mutasikasir: [
    { key: "noreff", label: "Noref", required: false },
    { key: "tanggal", label: "Tanggal", required: false },
    { key: "cabang", label: "Cabang", required: false },
    { key: "kodeTrans", label: "Kode Transaksi", required: false },
    { key: "noperkiraan", label: "No Perkiraan", required: false },
    { key: "desc", label: "Penjelasan", required: false },
    { key: "total", label: "Total", required: false },
    { key: "db", label: "Db", required: false },
    { key: "cr", label: "Cr", required: false },
  ],
};
function getImportKey(storeName, obj) {
  var cab = String(obj.cabang || obj.rest || "Pusat").trim();
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ AMBIL GROUP UNTUK KUNCI KOMPOSIT

  // LOGIKA HITUNG MASA (MMYY) UNTUK TRANSAKSI DAN MUTASI KASIR
  var tanggalRaw = String(obj.tanggal || "").trim();
  var computedMasa = "";
  if (tanggalRaw) {
    var parts = tanggalRaw.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        computedMasa = parts[1] + parts[0].substring(2, 4);
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        computedMasa = parts[1] + parts[2].substring(2, 4);
      }
    } else if (tanggalRaw.length === 8 && !isNaN(tanggalRaw)) {
      // YYYYMMDD
      computedMasa = tanggalRaw.substring(4, 6) + tanggalRaw.substring(2, 4);
    }
  }

  switch (storeName) {
    case "golongan":
      return String(obj.gol || "").trim() + "|" + cab + "|" + activeGroup;
    case "perkiraan":
      return String(obj.noPerk || "").trim() + "|" + cab + "|" + activeGroup;
    case "kodeBank":
      return String(obj.kodebank || "").trim() + "|" + cab + "|" + activeGroup;
    case "transaksi":
      // ✅ FIX: Kunci Komposit Transaksi lengkap dengan Masa, Cabang, dan Group
      return (
        String(obj.tanggal || "").trim() +
        "#" +
        String(obj.noacct || obj.noperkiraan || "").trim() +
        "#" +
        String(obj.kodegab || obj.noreff || "").trim() +
        "#" +
        String(obj.total || "").trim() +
        "#" +
        computedMasa +
        "#" +
        cab +
        "#" +
        activeGroup
      );
    case "mutasikasir":
      // ✅ TAMBAHAN: Kunci Komposit khusus Mutasi Kasir (Noref + KodeTrans + NoPerk + Total + Masa + Cabang + Group)
      return (
        String(obj.noreff || "").trim() +
        "#" +
        String(obj.kodeTrans || "").trim() +
        "#" +
        String(obj.noperkiraan || "").trim() +
        "#" +
        String(obj.total || "").trim() +
        "#" +
        computedMasa +
        "#" +
        cab +
        "#" +
        activeGroup
      );
    default:
      return uid();
  }
}
function isDuplicateInDB(storeName, obj, compositeKey) {
  var list = DBCache[storeName] || [];
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ AMBIL GROUP AKTIF USER

  if (!Array.isArray(list)) {
    console.warn(
      "DBCache." + storeName + " bukan array! Dkonversi ke array kosong.",
    );
    list = [];
  }

  // ✅ 1. VALIDASI DATA GANDA TRANSAKSI DAN MUTASI KASIR (MENGGUNAKAN KEY KOMPOSIT '#')
  if (storeName === "transaksi" || storeName === "mutasikasir") {
    var parts = compositeKey.split("#");

    if (storeName === "transaksi") {
      var tgl = parts[0];
      var perk = parts[1];
      var ref = parts[2];
      var tot = parts[3];
      var masa = parts[4];
      var cab = parts[5] || "Pusat";

      return list.some(function (k) {
        return (
          String(k.tanggal || "").trim() === tgl &&
          String(k.noperkiraan || k.noacct || "").trim() === perk &&
          String(k.noreff || k.kodegab || "").trim() === ref &&
          String(k.total || "").trim() === tot &&
          String(k.cabang || "Pusat")
            .trim()
            .toLowerCase() === cab.toLowerCase() &&
          String(k.masa || "").trim() === masa &&
          (k.group || "TLGA") === activeGroup
        );
      });
    } else {
      // mutasikasir
      var refKasir = parts[0];
      var transKasir = parts[1];
      var perkKasir = parts[2];
      var totKasir = parts[3];
      var masaKasir = parts[4];
      var cabKasir = parts[5] || "Pusat";

      return list.some(function (k) {
        return (
          String(k.noreff || "").trim() === refKasir &&
          String(k.kodeTrans || "").trim() === transKasir &&
          String(k.noperkiraan || "").trim() === perkKasir &&
          String(k.total || "").trim() === totKasir &&
          String(k.cabang || "Pusat")
            .trim()
            .toLowerCase() === cabKasir.toLowerCase() &&
          String(k.masa || "").trim() === masaKasir &&
          (k.group || "TLGA") === activeGroup
        );
      });
    }
  }

  // VALIDASI UNTUK REFRESH DATA MASTER LAINNYA
  var partsOld = compositeKey.split("|");
  var left = partsOld[0];
  var cabOld = partsOld[1] || "Pusat";

  switch (storeName) {
    case "golongan":
      return list.some(function (k) {
        return (
          String(k.gol || "").trim() === left &&
          String(k.cabang || "Pusat").trim() === cabOld &&
          (k.group || "TLGA") === activeGroup
        );
      });
    case "perkiraan":
      return list.some(function (k) {
        return (
          String(k.noPerk || "").trim() === left &&
          String(k.cabang || "Pusat").trim() === cabOld &&
          (k.group || "TLGA") === activeGroup
        );
      });
    case "kodeBank":
      return list.some(function (k) {
        return (
          String(k.kodebank || "").trim() === left &&
          String(k.cabang || "Pusat").trim() === cabOld &&
          (k.group || "TLGA") === activeGroup
        );
      });
    default:
      return false;
  }
}

/* ================================================================
   MAPPER: Mengubah Key DBF (noacct, rest, dll) ke Key Aplikasi (noperkiraan, cabang, dll)
   ================================================================ */
function mapTransaksiKeys(obj) {
  var activeGroup = localStorage.getItem("group") || "TLGA";

  // 1. Mapping No Perkiraan
  if (obj.noacct !== undefined) {
    obj.noperkiraan = String(obj.noacct).trim();
    delete obj.noacct;
  }

  // 2. Mapping Kode Cabang
  if (obj.rest !== undefined) {
    obj.cabang = String(obj.rest).trim();
    delete obj.rest;
  }

  // 3. Mapping No Reff / Kode Gabungan
  if (obj.kodegab !== undefined) {
    obj.noreff = String(obj.kodegab).trim();
    delete obj.kodegab;
  }

  // 4. Mapping Dari / Kepada
  if (obj.darike !== undefined) {
    obj.dariKePada = String(obj.darike).trim();
    delete obj.darike;
  }

  // 5. Mapping Kode Transaksi
  if (obj.nopinj !== undefined) {
    obj.kodeTrans = String(obj.nopinj).trim();
    delete obj.nopinj;
  }

  // 6. Mapping Debit & Kredit
  if (obj.qty !== undefined) {
    obj.db = num(obj.qty);
    delete obj.qty;
  }
  if (obj.harga !== undefined) {
    obj.cr = num(obj.harga);
    delete obj.harga;
  }

  // ✅ HITUNG MASA SECARA OTOMATIS BERDASARKAN TANGGAL DBF
  var tanggalRaw = String(obj.tanggal || "").trim();
  var computedMasa = "";
  if (tanggalRaw) {
    var parts = tanggalRaw.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        computedMasa = parts[1] + parts[0].substring(2, 4);
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        computedMasa = parts[1] + parts[2].substring(2, 4);
      }
    } else if (tanggalRaw.length === 8 && !isNaN(tanggalRaw)) {
      // YYYYMMDD
      computedMasa = tanggalRaw.substring(4, 6) + tanggalRaw.substring(2, 4);
    }
  }

  // Pastikan nilai default jika kosong
  obj.noperkiraan = obj.noperkiraan || "";
  obj.cabang = obj.cabang || "Pusat";
  obj.noreff = obj.noreff || "";
  obj.dariKePada = obj.dariKePada || "";
  obj.desc = obj.desc || "";
  obj.db = obj.db || 0;
  obj.cr = obj.cr || 0;

  // ✅ SUNTIK KOLOM MASA DAN GROUP KE OBJEK
  obj.masa = computedMasa;
  obj.group = activeGroup;

  return obj;
}
function openDBFImportModal(storeName) {
  var encOpts = DBF_ENCODINGS.map(function (e) {
    return (
      '<option value="' +
      e.value +
      '"' +
      (e.value === "auto" ? " selected" : "") +
      ">" +
      e.label +
      "</option>"
    );
  }).join("");

  // OPSI TAHUN
  var yearOpts = "";
  var currentYear = new Date().getFullYear();
  for (var y = currentYear - 5; y <= currentYear + 2; y++) {
    yearOpts += '<option value="' + y + '">' + y + "</option>";
  }

  // OPSI BULAN
  var monthOpts = "";
  var months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  monthOpts += '<option value="">SEMUA BULAN</option>';
  months.forEach(function (m, i) {
    monthOpts += '<option value="' + (i + 1) + '">' + m + "</option>";
  });

  // OPSI CABANG
  var cabangOpts = "";
  if (DBCache.cabang && DBCache.cabang.length) {
    cabangOpts += '<option value="">SEMUA CABANG</option>';

    DBCache.cabang.sort(function (a, b) {
      var valA = String(a.kode || a.nama || "").toLowerCase();
      var valB = String(b.kode || b.nama || "").toLowerCase();
      return valA.localeCompare(valB);
    });

    DBCache.cabang.forEach(function (c) {
      var val = c.kode || c.nama;
      var label = (c.kode ? c.kode + " - " : "") + (c.nama || "");
      cabangOpts +=
        '<option value="' + esc(val) + '">' + esc(label) + "</option>";
    });
  } else {
    cabangOpts = '<option value="">-- Tidak ada data cabang --</option>';
  }

  // 🌟 OPSI GROUP: DIKUNCI MAJU MENGGUNAKAN STRUKTUR DATA groupproject
  var groupOpts = "";
  var defaultGroup = localStorage.getItem("group") || "TLGA";
  var groupList = DBCache.groupproject || [];

  groupOpts += '<option value="">SEMUA GROUP</option>';

  // Lakukan pengurutan (sorting) A-Z data groupproject berdasarkan kode/nama
  groupList.sort(function (a, b) {
    var valA = String(
      typeof a === "object" ? a.kode || a.nama || "" : a,
    ).toLowerCase();
    var valB = String(
      typeof b === "object" ? b.kode || b.nama || "" : b,
    ).toLowerCase();
    return valA.localeCompare(valB);
  });

  var uniqueGroups = [];
  for (var i = 0; i < groupList.length; i++) {
    var g = groupList[i];

    // Ambil Nilai Value (Kode / ID) sesuai fungsi getGroupFilterHTML Anda
    var val = typeof g === "object" ? g.kode || g.id : g;
    val = String(val || "").trim();

    // Bentuk Label Teks Tampilan (KODE - NAMA)
    var txt =
      typeof g === "object"
        ? g.kode && g.nama
          ? g.kode + " - " + g.nama
          : g.nama || g.kode
        : g;

    if (val && uniqueGroups.indexOf(val) === -1) {
      uniqueGroups.push(val);
      var sel = val === defaultGroup ? " selected" : "";
      groupOpts +=
        '<option value="' + esc(val) + '"' + sel + ">" + esc(txt) + "</option>";
    }
  }

  // Fallback pengaman jika tabel groupproject kosong melompong di sistem database lokal
  if (uniqueGroups.length === 0) {
    groupOpts +=
      '<option value="TLGA"' +
      (defaultGroup === "TLGA" ? " selected" : "") +
      ">TLGA - TELAGA</option>" +
      '<option value="CORE"' +
      (defaultGroup === "CORE" ? " selected" : "") +
      ">CORE - INTI</option>" +
      '<option value="KSPM"' +
      (defaultGroup === "KSPM" ? " selected" : "") +
      ">KSPM - KOPERASI</option>";
  }

  // HTML FILTER KHUSUS TRANSAKSI & MUTASI KASIR
  var extraFiltersHtml = "";
  if (
    storeName === "transaksi" ||
    storeName === "golongan" ||
    storeName === "perkiraan" ||
    storeName === "kodeBank" ||
    storeName === "mutasikasir"
  ) {
    extraFiltersHtml =
      '<div style="display:grid; grid-template-columns: 1fr 1fr; gap: .5rem; margin-top:.5rem; padding:.8rem; background:rgba(0,0,0,0.02); border-left: 3px solid var(--accent); border-radius: 0 8px 8px 0;">' +
      (storeName === "transaksi" || storeName === "mutasikasir"
        ? '<div class="fg"><label style="font-size:.75rem; font-weight:600; color:var(--fg)">Tahun</label><select id="importYear" style="font-size:.8rem"><option value="">SEMUA</option>' +
          yearOpts +
          "</select></div>" +
          '<div class="fg"><label style="font-size:.75rem; font-weight:600; color:var(--fg)">Bulan</label><select id="importMonth" style="font-size:.8rem">' +
          monthOpts +
          "</select></div>"
        : "") +
      '<div class="fg"><label style="font-size:.75rem; font-weight:600; color:var(--fg)">Cabang</label><select id="importCabang" style="font-size:.8rem">' +
      cabangOpts +
      "</select></div>" +
      '<div class="fg"><label style="font-size:.75rem; font-weight:600; color:var(--fg)">Group</label><select id="importGroup" style="font-size:.8rem">' +
      groupOpts +
      "</select></div>" +
      "</div>";
  }

  var titleMap = {
    golongan: "Golongan Perkiraan",
    perkiraan: "No Perkiraan",
    kodeBank: "Kode Bank",
    transaksi: "Transaksi",
    mutasikasir: "Mutasi Kasir",
  };

  openModal(
    "Import dari DBF — " + (titleMap[storeName] || storeName),
    '<div id="dbfImportArea">' +
      '<div class="fg"><label>File DBF (.dbf)</label><input type="file" id="dbfFile" accept=".dbf,.DBF" style="font-size:.8rem;color:var(--fg)"></div>' +
      '<div class="fg"><label>Encoding File</label><select id="dbfEncoding">' +
      encOpts +
      "</select></div>" +
      extraFiltersHtml +
      '<div id="dbfStatus" style="margin-top:.5rem"></div>' +
      "</div>",
    "",
  );

  setTimeout(function () {
    var inp = $("dbfFile");
    if (inp)
      inp.onchange = function () {
        if (inp.files.length) handleDBFRead(inp.files[0], storeName);
      };
  }, 50);
}

function detectDBFEncoding(buffer) {
  var langByte = new Uint8Array(buffer);
  var langId = buffer.byteLength > 29 ? langByte[29] : 0;
  var headerSize = langByte[8] | (langByte[9] << 8);
  for (
    var i = headerSize;
    i < Math.min(buffer.byteLength, headerSize + 2000);
    i++
  ) {
    if (langByte[i] > 127) return "windows-1252";
  }
  if (langId === 0x01) return "cp437";
  if (langId === 0x02) return "cp850";
  if (langId === 0x03) return "cp1252";
  return "utf-8";
}

function decodeDBFText(bytes, encoding) {
  try {
    var str = new TextDecoder(encoding).decode(bytes);
    return str.replace(/\0/g, "").trim();
  } catch (e) {
    var str = new TextDecoder("utf-8").decode(bytes);
    return str.replace(/\0/g, "").trim();
  }
}

function parseDBFNumber(rawBytes) {
  var str = "";
  for (var i = 0; i < rawBytes.length; i++) {
    if (rawBytes[i] === 0) break;
    str += String.fromCharCode(rawBytes[i]);
  }
  str = str.trim().replace(/,/g, ".");
  if (/[0-9.]-?[0-9]*E[+-]?[0-9]+$/i.test(str)) {
    var val = parseFloat(str);
    return isNaN(val) ? 0 : val;
  }
  str = str.replace(/[^0-9.\-]/g, "");
  if (str === "" || str === "-" || str === ".") return 0;
  var val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

function reparseDBFWithEncoding(buffer, encoding) {
  var bytes = new Uint8Array(buffer);
  var numRecords =
    bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  var headerSize = bytes[8] | (bytes[9] << 8);
  var recordSize = bytes[10] | (bytes[11] << 8);
  var fields = [],
    offset = 32;
  while (offset < headerSize - 1) {
    var nameBytes = bytes.slice(offset, offset + 11);
    var name = decodeDBFText(nameBytes, encoding).replace(/\0+$/g, "").trim();
    var type = String.fromCharCode(bytes[offset + 11]);
    var length = bytes[offset + 16],
      decimal = bytes[offset + 17];
    if (name === "" || type.charCodeAt(0) === 13) break;
    fields.push({ name: name, type: type, length: length, decimal: decimal });
    offset += 32;
  }
  var records = [],
    dataStart = headerSize;
  for (var i = 0; i < numRecords; i++) {
    var recStart = dataStart + i * recordSize;
    if (recStart + recordSize > buffer.byteLength) break;
    if (bytes[recStart] === 0x2a) continue;
    var record = {},
      fieldOffset = recStart + 1;
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f],
        rawBytes = bytes.slice(fieldOffset, fieldOffset + field.length);
      fieldOffset += field.length;
      if (field.type === "N" || field.type === "F")
        record[field.name] = parseDBFNumber(rawBytes);
      else if (field.type === "D") {
        var dateStr = decodeDBFText(rawBytes, encoding).trim();
        if (
          dateStr.length === 8 &&
          dateStr !== "00000000" &&
          dateStr !== "        "
        )
          record[field.name] =
            dateStr.substring(0, 4) +
            "-" +
            dateStr.substring(4, 6) +
            "-" +
            dateStr.substring(6, 8);
        else record[field.name] = "";
      } else if (field.type === "L") {
        var lChar = String.fromCharCode(rawBytes[0]).toUpperCase().trim();
        record[field.name] =
          lChar === "T" || lChar === "Y" || lChar === "1"
            ? true
            : lChar === "F" || lChar === "N" || lChar === "0"
              ? false
              : null;
      } else record[field.name] = decodeDBFText(rawBytes, encoding).trim();
    }
    records.push(record);
  }
  return {
    version: bytes[0],
    numRecords: numRecords,
    fields: fields,
    records: records,
    encoding: encoding === "auto" ? detectDBFEncoding(buffer) : encoding,
    totalInFile: numRecords,
    skippedDeleted: numRecords - records.length,
  };
}

/* ✅ FIX #1 & #5: previewDBF sekarang menerima storeName, dan code-nya reachable */
function previewDBF(parsed, storeName) {
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ AMBIL GROUP AKTIF USER

  return parsed.records.slice(0, 8).map(function (rec) {
    var cells = parsed.fields.map(function (f) {
      var v = rec[f.name];
      if (v === undefined || v === null) return "";
      if (typeof v === "number") return fmtN(v);
      if (typeof v === "boolean") return v ? "Ya" : "Tidak";
      return String(v);
    });

    var targets = DBF_TARGETS[storeName] || [];
    var mockObj = {};

    targets.forEach(function (t) {
      var matched = parsed.fields.find(function (f) {
        var fn = f.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        var kl = t.key.toLowerCase().replace(/[^a-z0-9]/g, "");
        return fn === kl;
      });
      if (matched) {
        var val = rec[matched.name];
        if (val !== undefined && val !== null) {
          val = String(val).replace(/\0/g, "").trim();
          if (val !== "") mockObj[t.key] = val;
        }
      }
    });

    // ✅ FIX: Ambil field dinamis khusus untuk kebutuhan hitung 'masa' & 'cabang' di getImportKey
    // Cari field tanggal asli FoxPro dari objek rekaman mentah
    var tglField = parsed.fields.find(function (f) {
      var fn = f.name.toLowerCase();
      return (
        fn === "tanggal" || fn === "tgl" || fn === "date" || fn === "trx_date"
      );
    });
    if (tglField && rec[tglField.name]) {
      mockObj.tanggal = String(rec[tglField.name]).replace(/\0/g, "").trim();
    }

    var cbgField = parsed.fields.find(function (f) {
      var fn = f.name.toLowerCase();
      return (
        fn === "cabang" || fn === "rest" || fn === "kode" || fn === "branch"
      );
    });
    if (cbgField && rec[cbgField.name]) {
      mockObj.cabang = String(rec[cbgField.name]).replace(/\0/g, "").trim();
    }

    mockObj.cabang = mockObj.cabang || "Pusat";
    mockObj.group = activeGroup; // ✅ SUNTIK GROUP KE MOCK UNTUK PRATINJAU KUNCI

    cells.push(
      '<span style="color:var(--accent);font-weight:600">' +
        getImportKey(storeName, mockObj) +
        "</span>",
    );

    return cells;
  });
}

function smartAutoMap(targets, fields) {
  var autoMap = {};
  targets.forEach(function (t) {
    autoMap[t.key] = null;
  });

  // ✅ PENYELARASAN KAMUS KATA KUNCI PEMETAAN OTOMATIS FOXPRO -> APLIKASI
  var keywordMap = {
    gol: ["gol", "golongan", "group", "golacct", "kd_gol"],
    namaGol: ["namagol", "nama", "keterangan", "uraian"],
    noPerk: [
      "noperk",
      "no_perk",
      "perkiraan",
      "account",
      "rekening",
      "norek",
      "subacct",
      "noacct",
    ],
    desc: ["deskripsi", "keterangan", "uraian", "ket", "pjlsan", "desc"],
    awal: ["awal", "saldo", "saldoawal", "saldo_awal"],
    akhir: ["akhir", "saldoakhir"],
    kodebank: ["kodebank", "kode_bank", "kdbank", "idtrans"],
    penjelasan: ["penjelasan", "pjlsan", "desc"],
    noper: ["noper", "no_perk", "noperkiraan", "noacct"],
    cabang: ["cabang", "branch", "unit", "rest", "kode"], // ✅ Tambah kata kunci 'kode'
    kodeTrans: ["kodeTrans", "kodetrans", "nopinj", "nopinjam"], // ✅ Selaraskan dengan field nopinj FoxPro Anda
    noreff: [
      "noreff",
      "no_ref",
      "ref",
      "voucher",
      "bukti",
      "no_bukti",
      "kodegab",
    ],
    dariKePada: [
      "darike",
      "dari_kepada",
      "pihak",
      "terkait",
      "customer",
      "supplier",
    ],
    tanggal: ["tanggal", "tgl", "date", "trx_date"],
    total: ["total", "nominal", "jumlah", "rp", "amount", "nilai"],
    db: ["debit", "db", "masuk", "debet", "qty"],
    cr: ["kredit", "cr", "keluar", "harga"],
  };

  targets.forEach(function (t) {
    var kl = t.key.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (var i = 0; i < fields.length; i++) {
      var fn = fields[i].name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (fn === kl) {
        autoMap[t.key] = i;
        return;
      }
    }
  });

  targets.forEach(function (t) {
    if (autoMap[t.key] !== null) return;
    var keywords = keywordMap[t.key] || [];
    for (var i = 0; i < fields.length; i++) {
      var fn = fields[i].name.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (var k = 0; k < keywords.length; k++) {
        if (fn === keywords[k]) {
          autoMap[t.key] = i;
          return;
        }
      }
    }
  });

  if (autoMap.awal === null) {
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].type === "N" || fields[i].type === "F") {
        var used = false;
        for (var k in autoMap) {
          if (autoMap[k] === i) {
            used = true;
            break;
          }
        }
        if (!used) {
          autoMap.awal = i;
          break;
        }
      }
    }
  }

  var usedPos = {};
  for (var k in autoMap) {
    if (autoMap[k] !== null) usedPos[autoMap[k]] = k;
  }
  if (autoMap.gol === null && fields.length >= 1 && !usedPos[0])
    autoMap.gol = 0;
  if (autoMap.noPerk === null && fields.length >= 2 && !usedPos[1])
    autoMap.noPerk = 1;
  if (autoMap.namaGol === null && fields.length >= 2 && !usedPos[1])
    autoMap.namaGol = 1;
  if (autoMap.desc === null && fields.length >= 3 && !usedPos[2])
    autoMap.desc = 2;

  return autoMap;
}

function safeSet(id, prop, val) {
  var el = $(id);
  if (el) el[prop] = val;
  return el;
}

async function handleDBFRead(file, storeName) {
  if (
    !safeSet(
      "dbfStatus",
      "innerHTML",
      '<div style="display:flex;align-items:center;gap:.5rem"><span class="spinner"></span> <span>Membaca file: <strong id="dbf_pct">0%</strong></span></div>',
    )
  )
    return;

  try {
    // --- PROSES MEMBACA FILE DENGAN PERSENTASE PROGRESS ---
    var buffer = await new Promise(function (resolve, reject) {
      var reader = new FileReader();

      // Event ini berjalan terus-menerus selama file sedang dibaca
      reader.onprogress = function (e) {
        if (e.lengthComputable) {
          var persen = Math.round((e.loaded / e.total) * 100);
          var pctEl = document.getElementById("dbf_pct");
          if (pctEl) {
            pctEl.textContent = persen + "%";
          }
        }
      };

      reader.onload = function (e) {
        resolve(e.target.result); // Selesai membaca, kirim hasilnya
      };

      reader.onerror = function (e) {
        reject(new Error("Gagal membaca file DBF"));
      };

      reader.readAsArrayBuffer(file);
    });

    // Ambil encoding pilihan user
    var encoding = $("dbfEncoding") ? $("dbfEncoding").value : "auto";

    // Kirim data buffer yang sudah selesai dibaca ke parser bawaan Anda
    _dbfParsed = reparseDBFWithEncoding(buffer, encoding);

    if (!_dbfParsed.records.length) {
      safeSet(
        "dbfStatus",
        "innerHTML",
        '<span style="color:var(--danger)">Tidak ada record valid</span>',
      );
      return;
    }

    var targets = DBF_TARGETS[storeName];
    if (!targets) {
      safeSet(
        "dbfStatus",
        "innerHTML",
        '<span style="color:var(--danger)">Konfigurasi DBF_TARGETS untuk "' +
          storeName +
          '" tidak ditemukan</span>',
      );
      return;
    }

    var autoMap = smartAutoMap(targets, _dbfParsed.fields);
    // ✅ FIX #5: kirim storeName sebagai argumen kedua
    var preview = previewDBF(_dbfParsed, storeName);

    var fOpts = _dbfParsed.fields
      .map(function (f, i) {
        var tl =
          { N: "Angka", F: "Float", C: "Teks", D: "Tanggal", L: "Logika" }[
            f.type
          ] || f.type;
        return (
          '<option value="' +
          i +
          '">' +
          esc(f.name) +
          " (" +
          tl +
          "/" +
          f.length +
          ")</option>"
        );
      })
      .join("");

    var skipOpt = '<option value="-1">-- Lewati --</option>';
    var mappingRows = "";
    targets.forEach(function (t) {
      var selVal = autoMap[t.key] !== null ? autoMap[t.key] : "-1";
      var isReq = t.required ? ' <span class="req">*</span>' : "";
      var conf =
        autoMap[t.key] !== null
          ? ' <span style="font-size:.68rem;color:var(--success)">&#10003;</span>'
          : t.required
            ? ' <span style="font-size:.68rem;color:var(--danger)">&#10007;</span>'
            : "";
      mappingRows +=
        '<div class="f-row"><div class="fg" style="min-width:140px"><label>' +
        t.label +
        isReq +
        conf +
        '</label></div><div class="fg" style="flex:1"><select id="map_' +
        t.key +
        '">' +
        skipOpt +
        fOpts +
        "</select></div></div>";
    });

    var previewHdr =
      _dbfParsed.fields
        .map(function (f) {
          return (
            "<th>" +
            esc(f.name) +
            '<br><span style="font-size:.6rem;color:var(--muted)">' +
            f.type +
            "/" +
            f.length +
            "</span></th>"
          );
        })
        .join("") +
      '<th style="background:rgba(245,158,11,.1)">Composite Key</th>';

    var previewBody = preview
      .map(function (row) {
        return (
          "<tr>" +
          row
            .map(function (c) {
              return "<td>" + esc(c) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");

    var infoHtml =
      '<div class="stat-row"><div class="stat-c"><div class="sv">' +
      _dbfParsed.totalInFile +
      '</div><div class="sl">Total</div></div><div class="stat-c"><div class="sv" style="color:var(--success)">' +
      _dbfParsed.records.length +
      '</div><div class="sl">Valid</div></div><div class="stat-c"><div class="sv">' +
      _dbfParsed.fields.length +
      '</div><div class="sl">Field</div></div><div class="stat-c"><div class="sv">' +
      _dbfParsed.encoding +
      '</div><div class="sl">Encoding</div></div></div>';

    var titleMap2 = {
      golongan: "Golongan",
      perkiraan: "Perkiraan",
      kodeBank: "Kode Bank",
    };
    safeSet(
      "modalTitle",
      "textContent",
      "Mapping Field — " + (titleMap2[storeName] || storeName),
    );

    // ✅ SIMPAN NILAI FILTER KE VARIABEL GLOBAL
    var yearEl = $("importYear");
    var monthEl = $("importMonth");
    var cabangEl = $("importCabang");

    if (yearEl) _importFilter.year = yearEl.value.trim();
    if (monthEl) _importFilter.month = monthEl.value.trim();
    if (cabangEl) _importFilter.cabang = cabangEl.value.trim();

    safeSet(
      "dbfImportArea",
      "innerHTML",
      infoHtml +
        '<div style="margin-bottom:.8rem;font-size:.76rem;color:var(--muted)">Preview ' +
        Math.min(8, _dbfParsed.records.length) +
        " baris:</div>" +
        wrapTable(
          "<thead><tr>" +
            previewHdr +
            "</tr></thead><tbody>" +
            previewBody +
            "</tbody>",
        ) +
        '<div style="margin-top:1rem;padding:.8rem;background:var(--bg2);border:1px solid var(--brd);border-radius:10px"><div style="font-size:.78rem;font-weight:600;margin-bottom:.6rem">Pemetaan Field</div>' +
        mappingRows +
        "</div>" +
        '<div style="margin-top:1rem;display:flex;justify-content:flex-end;gap:.5rem"><button class="btn btn-g" onclick="closeModal()">Batal</button><button class="btn btn-a" onclick="previewMappedData(\'' +
        storeName +
        '\')"><i class="fa-solid fa-eye"></i> Lihat Preview Key & Status</button></div>' +
        '<div id="mappedPreviewArea" style="margin-top:1rem"></div>',
    );

    targets.forEach(function (t) {
      var sel = $("map_" + t.key);
      if (sel) sel.value = autoMap[t.key] !== null ? autoMap[t.key] : "-1";
    });
  } catch (err) {
    safeSet(
      "dbfStatus",
      "innerHTML",
      '<span style="color:var(--danger)">Gagal: ' +
        esc(err.message) +
        "</span>",
    );
  }
}

/* ================================================================
   GLOBAL HELPER: DROPDOWN CABANG
   ================================================================ */
// 🛠️ PERBAIKAN: Tambahkan parameter targetGroup
function getCabangOpts(selectedVal, targetGroup) {
  var cabangs = DBCache.cabang || [];

  // 🛠️ FILTER UTAMA: Jika targetGroup diisi, saring cabang yang memiliki group yang cocok saja
  if (targetGroup) {
    cabangs = cabangs.filter(function (c) {
      // Menyamakan format teks ke huruf besar (Uppercase) agar pencocokan akurat
      return (
        String(c.group || "").toUpperCase() ===
        String(targetGroup).toUpperCase()
      );
    });
  }

  var html = '<option value="">-- Pilih Cabang --</option>';
  var found = false;

  cabangs.forEach(function (c) {
    var val = c.kode || c.nama;
    var label = (c.kode ? c.kode + " - " : "") + (c.nama || "");
    var isSelected = val === selectedVal;
    if (isSelected) found = true;
    html +=
      '<option value="' +
      esc(val) +
      '"' +
      (isSelected ? " selected" : "") +
      ">" +
      esc(label) +
      "</option>";
  });

  if (selectedVal && !found)
    html +=
      '<option value="' +
      esc(selectedVal) +
      '" selected>' +
      esc(selectedVal) +
      " (Data Lama)</option>";
  return html;
}

function reloadCabangDropdown() {
  // Ambil group aktif dari localStorage, default ke TLGA jika kosong
  var currentGroup = localStorage.getItem("group") || "TLGA";

  // 1. Update Dropdown Cabang di Form Input Utama (Kolom Kiri)
  var mCabSelect = $("m_cab");
  if (mCabSelect) {
    var selectedLeft = mCabSelect.value; // Simpan nilai lama agar tidak ter-reset jika masih satu group
    mCabSelect.innerHTML = getCabangOpts(selectedLeft, currentGroup);
  }

  // 2. Update Dropdown Filter Cabang di Sidebar Riwayat (Kolom Kanan)
  var filterCabSelect = $("filter_cabang_list");
  if (filterCabSelect) {
    // Generate opsi khusus untuk filter sidebar (menyertakan opsi "-- Pilih Cabang --" di atas)
    filterCabSelect.innerHTML = getCabangOpts("", currentGroup);
    filterCabSelect.value = ""; // Reset ke default agar filter aman dari data group sebelumnya
  }
}

function lookupCabangLabel(kode) {
  if (!kode) return "-";
  var c = (DBCache.cabang || []).find(function (x) {
    return x.kode === kode || x.nama === kode;
  });
  return c ? esc(c.kode + " - " + c.nama) : esc(kode);
}

/* ================================================================
   POPUP HASIL IMPORT
   ================================================================ */
function showResultPopup(success, skip, error, errorMsgs) {
  // ✅ 1. ANTI-DUPLIKASI: Hapus popup lama jika kebetulan masih menggantung di layar
  var oldPopup = document.getElementById("resultPopup");
  if (oldPopup) oldPopup.remove();

  var popup = document.createElement("div");
  popup.id = "resultPopup";
  popup.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;animation:bulkIn .25s ease";

  // Fungsi penutup popup yang aman
  var closePopup = function () {
    popup.remove();
    if (typeof navigate === "function" && typeof currentPanel !== "undefined") {
      navigate(currentPanel);
    }
  };

  popup.onclick = function (e) {
    if (e.target === popup) closePopup();
  };

  var icon = error > 0 ? "fa-triangle-exclamation" : "fa-circle-check";
  var color = error > 0 ? "var(--warn)" : "var(--success)";

  // Detail error jika ada
  var errorDetailHtml = "";
  if (errorMsgs && errorMsgs.length > 0) {
    errorDetailHtml =
      '<div style="margin-top:.8rem;max-height:150px;overflow-y:auto;background:rgba(220,53,69,.05);border:1px solid rgba(220,53,69,.2);border-radius:8px;padding:.6rem;font-size:.72rem;font-family:JetBrains Mono,monospace;color:var(--danger);text-align:left">' +
      errorMsgs
        .map(function (msg) {
          return (
            '<div style="padding:.2rem 0;border-bottom:1px solid rgba(220,53,69,.1)">• ' +
            esc(msg) +
            "</div>"
          );
        })
        .join("") +
      "</div>";
  }

  var box = document.createElement("div");
  box.style.cssText =
    "background:var(--bg);border:1px solid var(--brd);border-radius:var(--r);padding:1.5rem;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:initial";

  box.innerHTML =
    '<div style="text-align:center;margin-bottom:1.2rem">' +
    '<i class="fa-solid ' +
    icon +
    '" style="font-size:3rem;color:' +
    color +
    '"></i>' +
    '<div style="font-size:1.1rem;font-weight:700;margin-top:.8rem;color:var(--fg)">Import Selesai</div></div>' +
    '<div style="background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:1rem;margin-bottom:1rem">' +
    '<div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--brd)">' +
    '<span style="color:var(--muted)">Berhasil</span>' +
    '<strong style="color:var(--success)">' +
    success +
    " data</strong></div>" +
    (skip > 0
      ? '<div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--brd)"><span style="color:var(--muted)">Dilewati</span><strong style="color:var(--warn)">' +
        skip +
        " data</strong></div>"
      : "") +
    (error > 0
      ? '<div style="display:flex;justify-content:space-between;padding:.4rem 0"><span style="color:var(--muted)">Gagal</span><strong style="color:var(--danger)">' +
        error +
        " data</strong></div>"
      : "") +
    "</div>" +
    errorDetailHtml +
    '<button id="btnFinishPopup" class="btn btn-a" style="width:100%;justify-content:center">' +
    '<i class="fa-solid fa-arrows-rotate"></i> Selesai & Refresh</button>';

  popup.appendChild(box);
  document.body.appendChild(popup);

  // ✅ 2. PERBAIKAN AKSI KLIK: Ikat fungsi secara terpisah menggunakan addEventListener
  var btn = document.getElementById("btnFinishPopup");
  if (btn) {
    btn.addEventListener("click", closePopup);
  }
}

/* ================================================================
   IMPORT DBF - STAY DI HALAMAN (TANPA MODAL, TANPA NAVIGATE)
   ================================================================ */
function previewMappedData(storeName) {
  var targets = DBF_TARGETS[storeName];
  if (!targets || !_dbfParsed || !_dbfParsed.records.length) {
    toast("Tidak ada data untuk di-preview", "err");
    return;
  }
  // PREPARASI INDEX
  var existingTransKeys = new Set();

  // ✅ TAMBAHKAN CEK INI: Jangan proses jika transaksi belum ada di memori
  // (Atau biarkan kosong jika import berjalan di awal sebelum buka menu transaksi)
  if (storeName === "transaksi" && DBCache.transaksi) {
    DBCache.transaksi.forEach(function (t) {
      var k = getImportKey("transaksi", t);
      existingTransKeys.add(k);
    });
  }
  _readyToImport = [];
  var map = {};
  targets.forEach(function (t) {
    var sel = $("map_" + t.key);
    if (sel && parseInt(sel.value) >= 0) map[t.key] = parseInt(sel.value);
  });

  var reqMiss = targets.filter(function (t) {
    return t.required && map[t.key] === undefined;
  });
  if (reqMiss.length) {
    toast(
      "Field wajib belum dipetakan: " +
        reqMiss
          .map(function (r) {
            return r.label;
          })
          .join(", "),
      "err",
    );
    return;
  }

  // PREPARASI INDEX
  var existingTransKeys = new Set();
  if (storeName === "transaksi" && DBCache.transaksi) {
    DBCache.transaksi.forEach(function (t) {
      var k = getImportKey("transaksi", t);
      existingTransKeys.add(k);
    });
  }

  var dupDB = 0,
    dupBatch = 0,
    invalid = 0,
    valid = 0;
  var skippedWrongYear = 0;
  var skippedWrongMonth = 0;
  var skippedWrongCabang = 0;

  var importedKeys = new Set();
  var filterYear = _importFilter.year || "";
  var filterMonth = _importFilter.month || "";
  var filterCabang = _importFilter.cabang || "";
  console.log("Cabang kosong terdeteksi, :", filterCabang);

  // --- LOOP 1: ANALISA DATA ---
  for (var i = 0; i < _dbfParsed.records.length; i++) {
    var row = _dbfParsed.records[i];
    var obj = {};
    targets.forEach(function (t) {
      if (map[t.key] !== undefined) {
        var fieldName = _dbfParsed.fields[map[t.key]].name;
        var val = row[fieldName];
        if (val !== undefined && val !== null) {
          val = String(val).replace(/\0/g, "").trim();
          if (val !== "") obj[t.key] = val;
        }
      }
    });

    // ✅ SOLUSI: Ubah nama key dari DBF (noacct, rest, dll) ke Key Aplikasi (noperkiraan, cabang, dll)
    obj = mapTransaksiKeys(obj);

    // 🌟 UTAMA: Isi data kosong ke selectedCabang SEBELUM filter berjalan
    // (Karena sudah di-map, obj.rest sudah menjadi obj.cabang)
    var cabangData = String(obj.cabang || "").trim();
    if ((cabangData === "" || cabangData === "Pusat") && filterCabang) {
      obj.cabang = filterCabang;
    } else {
      obj.cabang = cabangData === "" ? "Pusat" : cabangData;
    }

    // FILTER
    var skipThisRecord = false;
    if (storeName === "transaksi" && filterYear !== "") {
      var recYear = obj.tanggal ? obj.tanggal.substring(0, 4) : "";
      if (recYear !== filterYear) {
        skippedWrongYear++;
        skipThisRecord = true;
      }
    }

    if (!skipThisRecord && storeName === "transaksi" && filterMonth !== "") {
      var recMonth =
        obj.tanggal && obj.tanggal.length >= 7
          ? obj.tanggal.substring(5, 7)
          : "";
      if (parseInt(recMonth) !== parseInt(filterMonth)) {
        skippedWrongMonth++;
        skipThisRecord = true;
      }
    }
    if (!skipThisRecord && storeName === "transaksi" && filterCabang !== "") {
      if (obj.cabang !== filterCabang) {
        skippedWrongCabang++;
        skipThisRecord = true;
      }
    }
    if (skipThisRecord) continue;

    var compositeKey = getImportKey(storeName, obj);

    var isReqValid = true;

    targets.forEach(function (t) {
      // ✅ 1. LOGIKA BARU: Isi Cabang Otomatis Jika Kosong
      if (t.key === "cabang") {
        // ✅ PERBAIKAN: Cek juga jika string kosong ("") atau spasi ("   ")
        if (
          (!obj.cabang || obj.cabang.toString().trim() === "") &&
          typeof _importFilter !== "undefined" &&
          _importFilter.cabang
        ) {
          obj.cabang = _importFilter.cabang; // Isi otomatis dengan pilihan dropdown

          // (Opsional) Log untuk memastikan kode berjalan
          console.log("Cabang kosong terdeteksi, diisi otomatis:", obj.cabang);
        }
      }

      // ✅ 2. LOGIKA VALIDASI LAMA (Cek field wajib lainnya)
      if (t.required && t.key !== "cabang") {
        if (!obj[t.key]) {
          // Gunakan solusi "isi default" agar data tidak jadi invalid
          obj[t.key] = t.type === "number" ? 0 : "";
        }
      }
    });
    // =========================================================================
    // 🛠️ FIX: PENGECOALIAN DUPLIKAT INTERNAL UNTUK MUTASIKASIR
    // =========================================================================
    if (!isReqValid) {
      invalid++;
    } else if (storeName === "transaksi") {
      // Logika untuk store transaksi (Tetap seperti bawaan Anda)
      if (existingTransKeys.has(compositeKey)) {
        dupDB++;
      } else if (importedKeys.has(compositeKey)) {
        dupBatch++;
      } else {
        valid++;
        importedKeys.add(compositeKey);
        obj._compositeKey = compositeKey;
        _readyToImport.push(obj);
      }
    } else {
      // Logika untuk store selain transaksi (Termasuk mutasikasir)
      if (isDuplicateInDB(storeName, obj, compositeKey)) {
        dupDB++;
      }
      // 🌟 KONDISI PENGECUALIAN: Jika storeName adalah 'mutasikasir', LEWATKAN sensor dupBatch
      else if (storeName !== "mutasikasir" && importedKeys.has(compositeKey)) {
        dupBatch++;
      } else {
        // Data otomatis lolos sebagai VALID jika berupa 'mutasikasir'
        // walaupun compositeKey-nya kembar di dalam file DBF
        valid++;
        importedKeys.add(compositeKey);
        obj._compositeKey = compositeKey;
        _readyToImport.push(obj);
      }
    }
  }
  console.log("Cabang kosong terdeteksi, diisi otomatis111:", obj.cabang);
  // Salin ini tepat di atas baris "// --- LOOP 2: RENDER PREVIEW ---"
  console.log("=== ANALISIS KEHILANGAN DATA IMPORT ===");
  console.log("Total Asli File DBF:", _dbfParsed.records.length);
  console.log("1. Gagal karena Salah Tahun:", skippedWrongYear);
  console.log("2. Gagal karena Salah Bulan:", skippedWrongMonth);
  console.log("3. Gagal karena Salah Cabang:", skippedWrongCabang);
  console.log("4. Gagal karena Duplikat di DB Aplikasi:", dupDB);
  console.log("5. Gagal karena Duplikat di Internal File DBF:", dupBatch);
  console.log("6. Total Data Lolos (Valid):", valid);

  // --- LOOP 2: RENDER PREVIEW ---
  var previewRows = [];
  var LIMIT_PREVIEW = 50;
  for (var j = 0; j < Math.min(_readyToImport.length, LIMIT_PREVIEW); j++) {
    var obj = _readyToImport[j];
    var finalId = obj.id ? obj.id : uid() + "_" + j;
    obj._finalId = finalId;

    var cells = ['<span style="color:var(--muted)">' + (j + 1) + "</span>"];
    cells.push(
      '<span style="font-family:JetBrains Mono,monospace;font-size:.7rem;color:var(--muted)">' +
        esc(finalId) +
        "</span>",
    );
    targets.forEach(function (t) {
      cells.push(esc(obj[t.key] || "-"));
    });
    cells.push(
      '<span style="font-family:JetBrains Mono,monospace;font-size:.75rem;font-weight:600;color:var(--accent)">' +
        esc(obj._compositeKey) +
        "</span>",
    );
    previewRows.push(cells);
  }

  var hdrCells = ["No", "ID Sistem"];
  targets.forEach(function (t) {
    hdrCells.push(t.label);
  });
  hdrCells.push("Key Unik");

  var previewEl = $("mappedPreviewArea");
  if (!previewEl) return;

  // ✅ TOMBOL STATIS (KEMBALI KE IMPORT BIASA)
  previewEl.innerHTML =
    '<div class="stat-row" style="margin-bottom:.8rem">' +
    '<div class="stat-c"><div class="sv" style="color:var(--success)">' +
    valid +
    '</div><div class="sl">Siap Import</div></div>' +
    (skippedWrongYear > 0 || skippedWrongMonth > 0 || skippedWrongCabang > 0
      ? '<div class="stat-c"><div class="sv" style="color:var(--muted)">' +
        (skippedWrongYear + skippedWrongMonth + skippedWrongCabang) +
        '</div><div class="sl">Difilter (Tgl/Cbg)</div></div>'
      : "") +
    '<div class="stat-c"><div class="sv" style="color:var(--warn)">' +
    (dupDB + dupBatch) +
    '</div><div class="sl">Skip (Duplikat)</div></div>' +
    (invalid > 0
      ? '<div class="stat-c"><div class="sv" style="color:var(--danger)">' +
        invalid +
        '</div><div class="sl">Kurang Field</div></div>'
      : "") +
    '<div class="stat-c"><div class="sv">' +
    _dbfParsed.records.length +
    '</div><div class="sl">Total File</div></div></div>' +
    '<div style="margin-bottom:.5rem; text-align:right;">' +
    '<button type="button" class="btn btn-b" style="font-size:.8rem; padding:.4rem .8rem;" onclick="copyTableToExcel(\'previewTable\')"><i class="fa-solid fa-file-excel"></i> Copy Preview ke Excel</button></div>' +
    '<div id="previewTableWrap">' +
    wrapTable(
      buildTable(hdrCells, previewRows, {
        emptyMsg: "Tidak ada data",
        id: "previewTable",
      }),
    ) +
    "</div>" +
    (valid > 0
      ? '<div style="margin-top:1rem;display:flex;justify-content:flex-end;gap:.5rem">' +
        '<button type="button" class="btn btn-g" onclick="closeModal(); navigate(currentPanel);">Tutup</button>' +
        // ✅ TOMBOL IMPORT BIASA
        '<button type="button" class="btn btn-a" id="btnFinalImport"><i class="fa-solid fa-upload"></i> Import ' +
        valid +
        " Data</button>" +
        "</div>"
      : '<div style="margin-top:1rem;text-align:right"><button type="button" class="btn btn-g" onclick="closeModal(); navigate(currentPanel);">Tutup</button></div>');

  // Event Listener (Langsung Import)
  var btnImport = document.getElementById("btnFinalImport");
  if (btnImport) {
    btnImport.onclick = function (e) {
      e.preventDefault();
      closeModal();
      executeDBFImport(storeName);
    };
  }
}
async function executeDBFImport(storeName) {
  if (!_readyToImport.length) {
    toast("Tidak ada data", "err");
    return;
  }

  var selectedYear =
    typeof _importFilter !== "undefined" && _importFilter.year
      ? _importFilter.year
      : "";
  var selectedMonth =
    typeof _importFilter !== "undefined" && _importFilter.month
      ? _importFilter.month
      : "";
  var selectedCabang =
    typeof _importFilter !== "undefined" && _importFilter.cabang
      ? _importFilter.cabang
      : "";

  var selectedGroup =
    typeof _importFilter !== "undefined" && _importFilter.group
      ? _importFilter.group
      : "";

  // Sempurnakan format bulan pilihan user agar selalu 2 digit (misal: "5" -> "05")
  if (selectedMonth && selectedMonth.length === 1) {
    selectedMonth = "0" + selectedMonth;
  }

  var C = $("contentArea");
  if (C) {
    C.innerHTML =
      '<div class="pnl active" style="padding:2rem;text-align:center"><span class="spinner"></span><br><br>Mengirim ' +
      _readyToImport.length +
      " data ke server...</div>";
  }

  try {
    var targets = DBF_TARGETS[storeName] || [];

    // PENAMPUNG MAP UNTUK MENGUNCI 1 NOREFF PER TANGGAL (KHUSUS MUTASI KASIR)
    var kasirNoreffMap = {};
    // PENAMPUNG MAP UNTUK KASIR & TRANSAKSI

    var transaksiNoreffMap = {};
    var cleanData = _readyToImport.map(function (obj, i) {
      var clean = {};

      // ✅ 1. SALIN DULU SEMUA DATA ASLI
      Object.assign(clean, obj);

      // ✅ 2. TETAPKAN ID UNIK
      clean.id = obj._finalId || obj.id || uid() + "_" + i;

      // ✅ 3. ISI KOLOM FISIK WAJIB (cabang, masa, DAN GROUP)
      if (selectedCabang) {
        clean.cabang = selectedCabang;
        clean.kode_cabang = selectedCabang;
      }

      if (selectedGroup !== undefined) {
        clean.group = selectedGroup;
      }

      // ✅ 4. HITUNG MASA
      var rawDate = String(
        clean.tanggal || obj.tanggal || obj.DATE || "",
      ).trim();
      if (rawDate && rawDate.length >= 8) {
        if (rawDate.includes("-")) {
          var dateParts = rawDate.split("-");
          clean.masa = dateParts[1] + dateParts[0].substring(2, 4);
        } else if (!isNaN(rawDate)) {
          clean.masa = rawDate.substring(4, 6) + rawDate.substring(2, 4);
        }
      }
      if (!clean.masa) {
        clean.masa = "";
      }

      // ✅ 5. PETAKAN DBF_TARGETS
      targets.forEach(function (t) {
        var val = obj[t.key];
        if (val !== undefined && val !== null) {
          clean[t.key] = val;
        } else if (clean[t.key] === undefined) {
          clean[t.key] = "";
        }
      });

      // ✅ 6. STANDARISASI ANGKA
      var numericFields = ["awal", "db", "cr", "akhir", "total"];
      numericFields.forEach(function (field) {
        if (clean[field] !== undefined) {
          clean[field] = Number(clean[field]) || 0;
        }
      });

      if ((clean.rest === undefined || clean.rest === "") && clean.cabang) {
        clean.rest = clean.cabang;
      }
      // ... (Tahap 1 s/d 6 tetap sama)

      // ✅ 7. BERSIHKAN STRING KORBAN TARGETS (Kecuali kolom ID dan NOREFF)
      for (var key in clean) {
        if (clean.hasOwnProperty(key)) {
          if (clean[key] === "") {
            if (numericFields.indexOf(key) !== -1) {
              clean[key] = null;
            }
          }
        }
      }

      // 🌟 ✅ 8. FORCE GENERATE NOREFF (Letakkan di PALING BAWAH sebelum return)
      var tglRaw = String(clean.tanggal || obj.tanggal || "").trim();
      // Pastikan lowercase untuk mempermudah pengecekan string
      var currentStore = String(storeName || "").toLowerCase();
      var cbgKode = String(clean.cabang || obj.cabang || "00")
        .trim()
        .toUpperCase();
      var tglClean =
        tglRaw && tglRaw !== "undefined" && tglRaw !== ""
          ? tglRaw.replace(/[/]/g, "-")
          : new Date().toISOString().split("T")[0];

      if (currentStore === "mutasikasir") {
        if (!kasirNoreffMap[tglClean]) {
          var randomId =
            typeof uid === "function"
              ? uid().substring(0, 4).toUpperCase()
              : Math.random().toString(36).substring(2, 6).toUpperCase();
          kasirNoreffMap[tglClean] =
            "KASIR-" + cbgKode + "-" + tglClean + "-" + randomId;
        }
        // Force Overwrite: Kunci nilainya di sini agar tidak bisa diubah targets
        clean.noreff = kasirNoreffMap[tglClean];
      } else if (storeName === "transaksi") {
        var existingNoreff = clean.noreff || obj.noreff || obj.NOREFF || "";
        if (existingNoreff) {
          // 🔥 PERBAIKAN: Gunakan Composite Key (Noreff + Cabang) agar yang sama tapi beda cabang tidak saling menimpa
          var cbgTrxMap = String(clean.cabang || "00").trim();
          var mapKey = existingNoreff + "_" + cbgTrxMap;

          transaksiNoreffMap[mapKey] = {
            noreff: existingNoreff,
            tanggal: tglClean,
            cabang: cbgTrxMap,
          };
          clean.noreff = existingNoreff;
        } else {
          clean.noreff = "";
        }
      }

      // 🔍 DEBUG FINAL: Pastikan sebelum keluar dari map, objek clean memegang noreff
      if (currentStore === "mutasikasir" || currentStore === "transaksi") {
        console.log(
          "➡️ [MAP OUT] Table:",
          currentStore,
          "ID:",
          clean.id,
          "Noreff:",
          clean.noreff,
        );
      }

      return clean;
    });

    console.log("Hasil akhir data bersih:", cleanData);

    // =========================================================================
    // 🌟 PERBAIKAN STRATEGIS: CHUNKING DATA (MENCEGAH ERROR 502 / TIMEOUT)
    // =========================================================================
    var sukses = 0;
    var gagal = 0;
    var errors = [];

    // Tentukan ukuran maksimal pengiriman (500 data per request sangat ideal)
    var chunkSize = 500;

    for (var chunkIdx = 0; chunkIdx < cleanData.length; chunkIdx += chunkSize) {
      // Potong data dari index saat ini sampai batas chunkSize
      var chunk = cleanData.slice(chunkIdx, chunkIdx + chunkSize);

      // Update UI spinner agar user tahu prosesnya sedang berjalan bertahap
      if (C) {
        var progressKe = Math.min(chunkIdx + chunkSize, cleanData.length);
        C.innerHTML =
          '<div class="pnl active" style="padding:2rem;text-align:center">' +
          '<span class="spinner"></span><br><br>' +
          "Mengirim data ke server... (" +
          progressKe +
          "/" +
          cleanData.length +
          ")</div>";
      }
      // Eksekusi Import Massal secara bertahap ke Database
      var result = await db.batch(storeName, chunk);

      // ✅ AKUMULASI HASIL SUKSES (DIKUNCI AMAN DARI SEGALA FORMAT RESPON SERVER)
      if (result) {
        if (typeof result.Total === "number") {
          sukses += result.Total;
        } else if (typeof result.total === "number") {
          sukses += result.total;
        } else if (typeof result.success === "number") {
          sukses += result.success;
        } else if (typeof result.count === "number") {
          // ✅ TAMBAHAN: format { count: 50 }
          sukses += result.count;
        } else if (typeof result.insertedCount === "number") {
          // ✅ TAMBAHAN: format mongodb/supabase
          sukses += result.insertedCount;
        } else if (result.inserted) {
          sukses += result.inserted;
        } else if (Array.isArray(result)) {
          sukses += result.length;
        } else if (result.data && Array.isArray(result.data)) {
          // ✅ TAMBAHAN: format { data: [...] }
          sukses += result.data.length;
        } else if (result.success === true || result.status === "success") {
          // ✅ FALLBACK DARURAT: Jika server hanya merespon true tanpa angka,
          // gunakan panjang data chunk yang baru saja dikirim agar angka tidak 0
          sukses += chunk.length;
        }
      }

      // Akumulasikan hasil gagal dari tiap batch
      if (result && typeof result.error === "number") {
        gagal += result.error;
      }

      // Gabungkan pesan error jika ada
      if (result && Array.isArray(result.errorMsg)) {
        errors = errors.concat(result.errorMsg);
      }
    }

    // =========================================================================
    // 🌟 SELESAI CHUNKING: SIMPAN REFF UNIK KE TABEL TARGET MASING-MASING
    // =========================================================================
    if (gagal === 0 && sukses > 0) {
      var listReffData = [];
      var targetReffTable = "";

      var calculatedMasa = "";
      if (selectedMonth && selectedYear) {
        var shortYear = String(selectedYear).substring(2, 4);
        calculatedMasa = selectedMonth + shortYear;
      }

      // Ambil group aktif dari localStorage sebagai cadangan utama yang pasti valid
      var activeGroupSession = localStorage.getItem("group") || "TLGA";

      if (storeName === "mutasikasir") {
        targetReffTable = "listreffkasir";

        // 🔥 AMANKAN NILAI GROUP KHUSUS KASIR
        var grpKasir = selectedGroup;
        if (
          !grpKasir ||
          grpKasir === "undefined" ||
          String(grpKasir).trim() === "undefined"
        ) {
          grpKasir = activeGroupSession;
        }

        for (var tgl in kasirNoreffMap) {
          listReffData.push({
            id:
              typeof uid === "function"
                ? uid()
                : "REF_" + Math.random().toString(36).substring(2, 9),
            tanggal: tgl,
            noreff: kasirNoreffMap[tgl],
            masa: calculatedMasa || "",
            cabang: selectedCabang || null,
            group: grpKasir, // ✅ Dipastikan berisi string grup riil (contoh: "TLGA")
            created_at: new Date().toISOString(),
          });
        }
      } else if (storeName === "transaksi") {
        targetReffTable = "listrefftransaksi";

        for (var mapKey in transaksiNoreffMap) {
          // Ambil objek data yang sudah lengkap (noreff, tanggal, cabang) dari Map
          var reffDetail = transaksiNoreffMap[mapKey];

          listReffData.push({
            id:
              typeof uid === "function"
                ? uid()
                : "REF_" + Math.random().toString(36).substring(2, 9),
            tanggal: reffDetail.tanggal, // Ambil tanggal spesifik cabang ini
            noreff: reffDetail.noreff, // Ambil noreff-nya
            masa: calculatedMasa || "",
            cabang: reffDetail.cabang || selectedCabang || "00", // Ambil cabang spesifik
            group: selectedGroup || activeGroupSession,
            created_at: new Date().toISOString(),
          });
        }
      }
      if (targetReffTable && listReffData.length > 0) {
        console.log(
          "Menyimpan daftar referensi ke " + targetReffTable + ":",
          listReffData,
        );
        await db.batch(targetReffTable, listReffData);
      }
    }
    // =========================================================================

    // =========================================================================

    var icon = gagal > 0 ? "fa-triangle-exclamation" : "fa-circle-check";
    var color = gagal > 0 ? "var(--warn)" : "var(--success)";

    var errorDetailHtml = "";
    if (errors && errors.length > 0) {
      errorDetailHtml =
        '<div style="margin-top:1rem;max-height:200px;overflow-y:auto;background:rgba(220,53,69,.05);border:1px solid rgba(220,53,69,.2);border-radius:8px;padding:.8rem;font-size:.75rem;font-family:JetBrains Mono,monospace;color:var(--danger);text-align:left">' +
        errors
          .map(function (msg) {
            return (
              '<div style="padding:.3rem 0;border-bottom:1px solid rgba(220,53,69,.1)">• ' +
              esc(msg) +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    }

    if (C) {
      C.innerHTML =
        '<div class="pnl active" style="max-width:500px;margin:3rem auto;text-align:center">' +
        '<div style="background:var(--card);border:1px solid var(--brd);border-radius:var(--r);padding:2rem;box-shadow:0 10px 30px rgba(0,0,0,.1)">' +
        '<i class="fa-solid ' +
        icon +
        '" style="font-size:4rem;color:' +
        color +
        '"></i>' +
        '<h2 style="margin:1rem 0 0.5rem;color:var(--fg)">Import Selesai</h2>' +
        '<div style="background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:1rem;margin:1.5rem 0;text-align:left">' +
        '<div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--brd)">' +
        '<span style="color:var(--muted)">Berhasil Disimpan</span>' +
        '<strong style="color:var(--success);font-size:1.1rem">' +
        sukses +
        " data</strong>" +
        "</div>" +
        (gagal > 0
          ? '<div style="display:flex;justify-content:space-between;padding:.5rem 0">' +
            '<span style="color:var(--muted)">Gagal (Duplikat/Error)</span>' +
            '<strong style="color:var(--danger);font-size:1.1rem">' +
            gagal +
            " data</strong>" +
            "</div>"
          : "") +
        "</div>" +
        errorDetailHtml +
        '<button type="button" class="btn btn-a" style="width:100%;justify-content:center;margin-top:1.5rem" id="btnSelesaiImport">' +
        '<i class="fa-solid fa-arrows-rotate"></i> Kembali ke Menu Utama' +
        "</button>" +
        "</div></div>";

      document
        .getElementById("btnSelesaiImport")
        .addEventListener("click", function () {
          navigate(currentPanel);
        });
    }

    await refreshCache();
    _readyToImport = [];
    if (typeof _importOptions !== "undefined") _importOptions.deleteAll = false;
  } catch (err) {
    console.error("❌ Error:", err);
    if (C) {
      C.innerHTML =
        '<div class="pnl active" style="max-width:500px;margin:3rem auto;text-align:center">' +
        '<div style="background:var(--card);border:1px solid var(--brd);border-radius:var(--r);padding:2rem">' +
        '<i class="fa-solid fa-circle-xmark" style="font-size:4rem;color:var(--danger)"></i>' +
        '<h2 style="margin:1rem 0 0.5rem;color:var(--danger)">Import Gagal</h2>' +
        '<p style="color:var(--muted)">' +
        esc(err.message) +
        "</p>" +
        '<button type="button" class="btn btn-a" style="width:100%;justify-content:center;margin-top:1.5rem" onclick="navigate(currentPanel)">' +
        '<i class="fa-solid fa-arrow-left"></i> Kembali' +
        "</button>" +
        "</div></div>";
    }
  }
}

async function renderBlank() {
  return (
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;color:var(--muted);text-align:center">' +
    '<div style="width:100%;max-width:320px;margin:0 auto 1.5rem;border-radius:var(--r);overflow:hidden;border:1px solid var(--brd);box-shadow:0 8px 15px rgba(0,0,0,0.3)">' +
    '<img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj1_607fFAeCzBA7I18ydSQZ0fhQYjn87ATZdJazbNolpMIcksTW0m_Wzz_5naOAU6VqgkbCj_QhY5BiZ5mV5Lr7ONK1rjZgfsThbXj389wj2wIVM43AlCS_VgCjKASh8v4cETtnbb3R6Oz/s320/image_sendbinary250.asp.jpeg" style="width:100%;height:260px;object-fit:cover;display:block;" alt="Logo Telaga">' +
    "</div>" +
    '<div style="font-size:1.2rem;font-weight:600;color:var(--fg);margin-bottom:.5rem">Selamat Datang di Pembukuan Telaga</div>' +
    '<div style="font-size:.85rem;max-width:400px;line-height:1.6">Pilih menu di sebelah kiri untuk mulai mengelola data perkiraan, transaksi, atau laporan keuangan.</div>' +
    "</div>"
  );
}
PANEL_MAP.blank = renderBlank; // Tambahkan baris ini
/* ---------- GLOBAL CONFIRM DIALOG ---------- */
/* ================================================================
   REGISTRASI PANEL MAP (PENTING!)
   ================================================================ */

// Registrasi halaman Import Data
// Buat fungsi render sederhana untuk halaman Import
function renderImport() {
  return (
    '<div style="padding:2rem;max-width:800px;margin:0 auto">' +
    '<h2 style="margin-bottom:1.5rem;border-bottom:1px solid var(--brd);padding-bottom:.5rem">Utility Import Database</h2>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem">' +
    // Tombol Import Golongan
    '<div style="background:var(--bg);border:1px solid var(--brd);padding:1.5rem;border-radius:10px;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.05)">' +
    '<i class="fa-solid fa-layer-group" style="font-size:2.5rem;color:var(--accent);margin-bottom:1rem"></i>' +
    '<h3 style="margin-bottom:.5rem">Golongan</h3>' +
    '<p style="color:var(--muted);font-size:.85rem;margin-bottom:1rem">Import data master Golongan Perkiraan dari file DBF.</p>' +
    '<button class="btn btn-a" onclick="openDBFImportModal(\'golongan\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    "</div>" +
    // Tombol Import Perkiraan
    '<div style="background:var(--bg);border:1px solid var(--brd);padding:1.5rem;border-radius:10px;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.05)">' +
    '<i class="fa-solid fa-list-ol" style="font-size:2.5rem;color:var(--accent);margin-bottom:1rem"></i>' +
    '<h3 style="margin-bottom:.5rem">Perkiraan</h3>' +
    '<p style="color:var(--muted);font-size:.85rem;margin-bottom:1rem">Import daftar Nomor Perkiraan (COA) dari file DBF.</p>' +
    '<button class="btn btn-a" onclick="openDBFImportModal(\'perkiraan\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    "</div>" +
    // Tombol Import Transaksi
    '<div style="background:var(--bg);border:1px solid var(--brd);padding:1.5rem;border-radius:10px;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.05)">' +
    '<i class="fa-solid fa-money-bill-transfer" style="font-size:2.5rem;color:var(--accent);margin-bottom:1rem"></i>' +
    '<h3 style="margin-bottom:.5rem">Transaksi</h3>' +
    '<p style="color:var(--muted);font-size:.85rem;margin-bottom:1rem">Import mutasi transaksi harian/bulanan.</p>' +
    '<button class="btn btn-a" onclick="openDBFImportModal(\'transaksi\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    "</div>" +
    // Tombol Import Kode Bank
    '<div style="background:var(--bg);border:1px solid var(--brd);padding:1.5rem;border-radius:10px;text-align:center;box-shadow:0 2px 5px rgba(0,0,0,0.05)">' +
    '<i class="fa-solid fa-building-columns" style="font-size:2.5rem;color:var(--accent);margin-bottom:1rem"></i>' +
    '<h3 style="margin-bottom:.5rem">Kode Bank</h3>' +
    '<p style="color:var(--muted);font-size:.85rem;margin-bottom:1rem">Import master Kode Bank/Kas.</p>' +
    '<button class="btn btn-a" onclick="openDBFImportModal(\'kodeBank\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    "</div>" +
    "</div></div>"
  );
}
PANEL_MAP.importD = renderImport;

// ========================================================
// 🔧 FUNGSI INJECT MASSAL SEKALI PAKAI (BUAT DATA LAMA)
// Panggil fungsi ini sekali lewat Console Browser (F12),
// lalu hapus fungsinya setelah selesai.
// ========================================================
// ========================================================
// 🔧 FUNGSI INJECT MASSAL (VERSI ADA PROGRESSNYA)
// ========================================================
async function injectGroupMassalKeTahunan() {
  console.log("🚀 MEMULAI INJECT MASSAL GROUP 'TLGA' KE TABEL TAHUNAN...");
  toast("Proses inject dimulai, lihat Console (F12) untuk progress.", "wrn");

  var baseUrl = window.location.origin + "/api/data/";
  var tahunList = ["2022"];
  var tabelList = ["golongan", "perkiraan", "transaksi"];

  var totalDisuntik = 0;
  var batchSize = 300;

  for (var t = 0; t < tahunList.length; t++) {
    var tahun = tahunList[t];

    for (var i = 0; i < tabelList.length; i++) {
      var namaTabel = tabelList[i] + tahun;

      try {
        var response = await fetch(baseUrl + namaTabel);
        if (!response.ok) continue;

        var data = await response.json();
        var needUpdate = [];

        data.forEach(function (row, index) {
          if (
            typeof row.group === "undefined" ||
            row.group === null ||
            row.group === ""
          ) {
            row.group = "TLGA";

            // ✅ REKONSTRUKSI ID KARENA ID TIDAK ADA DI DALAM JSON
            if (!row.id) {
              if (namaTabel.startsWith("golongan")) {
                row.id =
                  "CDG_" +
                  (row.cabang || "") +
                  "_" +
                  (row.masa || "") +
                  "_" +
                  (row.gol || "X") +
                  "_" +
                  index;
              } else if (namaTabel.startsWith("perkiraan")) {
                var cleanNoPerk = (row.noPerk || "X").replace(/\./g, "_");
                row.id =
                  "CDD_" +
                  (row.cabang || "") +
                  "_" +
                  (row.masa || "") +
                  "_" +
                  cleanNoPerk +
                  "_" +
                  index;
              } else if (namaTabel.startsWith("transaksi")) {
                if (!row.id)
                  row.id =
                    "DET_" +
                    index +
                    "_" +
                    Math.random().toString(36).substr(2, 5);
              }
            }

            needUpdate.push(row);
          }
        });

        if (needUpdate.length > 0) {
          console.log(
            `📦 ${namaTabel}: Ditemukan ${needUpdate.length} data. Mulai mengirim...`,
          );

          for (var b = 0; b < needUpdate.length; b += batchSize) {
            var batch = needUpdate.slice(b, b + batchSize);

            await Promise.all(
              batch.map(function (item) {
                // PASTIKAN ID TIDAK UNDEFINED SEBELUM DIKIRIM
                if (!item.id) return Promise.resolve();

                return fetch(baseUrl + namaTabel + "/" + item.id, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(item),
                }).catch(function (e) {
                  console.error("Gagal ID:", item.id);
                });
              }),
            );

            var prosesSekarang = Math.min(b + batchSize, needUpdate.length);
            console.log(
              `   ⏳ ${namaTabel} Progress: ${prosesSekarang} / ${needUpdate.length}`,
            );

            if (b + batchSize < needUpdate.length) {
              await new Promise(function (resolve) {
                setTimeout(resolve, 100);
              });
            }
          }

          totalDisuntik += needUpdate.length;
          console.log(`   ✅ ${namaTabel} SELESAI.\n`);
        } else {
          console.log(`✅ ${namaTabel}: Sudah aman (0 data perlu diubah).`);
        }
      } catch (error) {
        console.error(`❌ Error di ${namaTabel}:`, error.message);
      }
    }
  }

  console.log("==================================================");
  console.log("🎉 SELESAI! Total data tersuntik: " + totalDisuntik);
  console.log("==================================================");
  toast("Inject massal SELESAI! Total: " + totalDisuntik + " data.", "ok");
}
// Fungsi untuk menangkap event perubahan dropdown Group
function changeGroupFilter(selectedGroup) {
  // Untuk sementara kita kosongkan saja agar tidak error.
  // Nanti bisa diisi logika untuk memfilter tabel.
  console.log("Group dipilih:", selectedGroup);
}
