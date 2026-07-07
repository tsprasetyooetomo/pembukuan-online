/* globals getCabangOpts, lookupCabangLabel, uid, esc, fmtN, num, openModal, closeModal, showConfirm, toast, bulkInit, bulkBarHTML, bulkBarHTMLCustom, bulkGetIds, bulkGetKey, crudActions, wrapTable, buildTable, refreshCache, currentPanel, DBCache, db */

/* ---------- GLOBAL VIEW LIMIT ---------- */
var _viewLimit = 20;

function setViewLimit(val) {
  _viewLimit = parseInt(val, 10) || 20;
  safeRenderCurrentPanel();
}

function getLimitOptsHTML() {
  var limits = [10, 20, 50, 100, 99999];
  var labels = ["10", "20", "50", "100", "Semua"];
  var html =
    '<select style="font-size:.72rem;padding:2px 4px;border-radius:4px;border:1px solid var(--brd);background:var(--bg);color:var(--fg);cursor:pointer" onchange="setViewLimit(this.value)">';

  for (var i = 0; i < limits.length; i++) {
    var selected = _viewLimit === limits[i] ? " selected" : "";
    html +=
      '<option value="' +
      limits[i] +
      '"' +
      selected +
      ">" +
      labels[i] +
      "</option>";
  }
  html += "</select>";
  return html;
}

/* ---------- GLOBAL FILTER STATE ---------- */
if (typeof currentCabang === "undefined") {
  var currentCabang = "SEMUA";
}

function filterByCabang(rawData) {
  var list = Array.isArray(rawData) ? rawData : [];
  if (currentCabang === "SEMUA" || currentCabang === "") return list;

  return list.filter(function (item) {
    return (
      String(item.cabang || "").toLowerCase() ===
      String(currentCabang || "").toLowerCase()
    );
  });
}

/* ---------- FUNGSI SAFE RENDER ---------- */
async function safeRenderCurrentPanel() {
  try {
    console.log("🔄 Memulai render ulang panel: " + currentPanel);
    var activePanel = document.querySelector(".pnl.active");
    if (!activePanel || !currentPanel) return;

    var renderFn = PANEL_MAP[currentPanel];
    if (typeof renderFn === "function") {
      var newHtml = await renderFn();
      activePanel.innerHTML = newHtml;
      console.log("✅ Render ulang panel SELESAI");
      console.log("Navigate ke 5: " + currentPanel);
    }
  } catch (err) {
    console.error("Gagal render ulang panel:", err);
  }
}

/* ---------- GLOBAL EXPORT TO EXCEL (CSV) ---------- */
async function exportTableToExcel(storeName, fileNamePrefix) {
  console.log("📊 Memulai export " + storeName + "...");
  var rawData = DBCache[storeName] || [];
  if (!rawData.length) {
    return toast("Tidak ada data untuk di-export", "err");
  }

  var data = rawData;
  if (storeName !== "cabang") {
    data = rawData.filter(function (r) {
      return currentCabang === "SEMUA" || r.cabang === currentCabang;
    });
  }

  if (data.length === 0) {
    return toast("Tidak ada data pada filter ini untuk di-export", "err");
  }

  var csvContent = "";
  var headers = [];
  var footer = [];

  if (storeName === "golongan") {
    headers = [
      "Gol",
      "Nama Golongan",
      "Awal",
      "Debit",
      "Kredit",
      "Akhir",
      "Cabang",
    ];
    csvContent += headers.join(",") + "\n";
    var totalDb = 0;
    var totalCr = 0;
    data.forEach(function (r) {
      var ak = num(r.awal) + num(r.db) - num(r.cr);
      totalDb += num(r.db);
      totalCr += num(r.cr);
      var row = [
        '"' + (r.gol || "") + '"',
        '"' + (r.namaGol || "") + '"',
        fmtN(r.awal),
        fmtN(r.db),
        fmtN(r.cr),
        fmtN(ak),
        '"' + lookupCabangLabel(r.cabang) + '"',
      ];
      csvContent += row.join(",") + "\n";
    });
    footer = ["", "", "", fmtN(totalDb), fmtN(totalCr), "", ""];
  } else if (storeName === "perkiraan") {
    headers = [
      "Gol",
      "No Perkiraan",
      "Deskripsi",
      "Awal",
      "Debit",
      "Kredit",
      "Akhir",
      "Cabang",
    ];
    csvContent += headers.join(",") + "\n";
    var totalAwal = 0;
    var totalDb = 0;
    var totalCr = 0;
    data.forEach(function (r) {
      var ak = num(r.awal) + num(r.db) - num(r.cr);
      totalAwal += num(r.awal);
      totalDb += num(r.db);
      totalCr += num(r.cr);
      var row = [
        '"' + (r.gol || "") + '"',
        '"' + (r.noPerk || "") + '"',
        '"' + (r.desc || "") + '"',
        fmtN(r.awal),
        fmtN(r.db),
        fmtN(r.cr),
        fmtN(ak),
        '"' + lookupCabangLabel(r.cabang) + '"',
      ];
      csvContent += row.join(",") + "\n";
    });
    footer = [
      "",
      "",
      "",
      fmtN(totalAwal),
      fmtN(totalDb),
      fmtN(totalCr),
      "",
      "",
    ];
  } else if (storeName === "kodeBank") {
    headers = [
      "Kode Bank",
      "Penjelasan",
      "No Perkiraan",
      "Jml Transaksi",
      "Cabang",
    ];
    csvContent += headers.join(",") + "\n";

    function countRef(kode) {
      var tc = 0;
      (DBCache.transaksi || []).forEach(function (t) {
        if (t.kodeBank === kode) tc++;
      });
      return tc;
    }
    function lookupPerk(noper) {
      if (!noper) return "-";
      var p = (DBCache.perkiraan || []).find(function (x) {
        return x.noPerk === noper;
      });
      return p ? p.noPerk + " — " + p.desc : noper;
    }

    var totalTrans = 0;
    data.forEach(function (r) {
      var jml = countRef(r.kodebank);
      totalTrans += jml;
      var row = [
        '"' + (r.kodebank || "") + '"',
        '"' + (r.penjelasan || "-") + '"',
        '"' + lookupPerk(r.noper) + '"',
        jml,
        '"' + lookupCabangLabel(r.cabang) + '"',
      ];
      csvContent += row.join(",") + "\n";
    });
    footer = [data.length + " kode", "-", "-", totalTrans, "-"];
  } else if (storeName === "cabang") {
    headers = ["Kode Cabang", "Nama Cabang"];
    csvContent += headers.join(",") + "\n";
    data.forEach(function (r) {
      var row = ['"' + (r.kode || "") + '"', '"' + (r.nama || "") + '"'];
      csvContent += row.join(",") + "\n";
    });
    footer = [];
  }

  if (footer.length > 0) {
    csvContent += footer.join(",") + "\n";
  }

  var blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.setAttribute("href", url);
  var suffix = storeName === "cabang" ? "" : "_" + currentCabang;
  link.setAttribute("download", fileNamePrefix + suffix + ".csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("Data berhasil di-export!", "ok");
}

/* ---------- Golongan Perkiraan ---------- */
PANEL_MAP.gol = renderGol;

async function renderGol() {
  var rawData = DBCache.golongan || [];
  var data = filterByCabang(rawData);

  // 👈 TAMBAHKAN PROSES SORTING BERTINGKAT DI SINI
  // Urutkan berdasarkan Cabang, lalu berdasarkan Golongan
  data.sort(function (a, b) {
    var cabangA = String(a.cabang || "");
    var cabangB = String(b.cabang || "");

    // 1. Bandingkan Kode Cabang terlebih dahulu
    var compareCabang = cabangA.localeCompare(cabangB, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    // 2. Jika Kode Cabang berbeda, langsung kembalikan hasil perbandingan cabang
    if (compareCabang !== 0) {
      return compareCabang;
    }

    // 3. Jika Kode Cabang SAMA, urutkan berdasarkan Kode Golongan
    var golA = String(a.gol || "");
    var golB = String(b.gol || "");
    return golA.localeCompare(golB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("golongan", ids);
  var dataLimit = data.slice(0, _viewLimit);
  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });
  var rows = dataLimit.map(function (r) {
    var ak = num(r.awal) + num(r.db) - num(r.cr);
    return [
      r.gol,
      r.namaGol,
      fmtN(r.awal),
      fmtN(r.db),
      fmtN(r.cr),
      '<span class="tag tag-akhir">' + fmtN(ak) + "</span>",
      lookupCabangLabel(r.cabang),
    ];
  });
  var foot = [
    "",
    "",
    "",
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.db);
      }, 0),
    ),
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.cr);
      }, 0),
    ),
    "",
    "",
  ];
  return (
    bulkBarHTML("golongan", "GOlongan") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Cabang: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record" +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'golongan\', \'Data_Golongan\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'golongan\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'golongan\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    '<button type="button" class="btn btn-a" onclick="formGol()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div></div>" +
    wrapTable(
      buildTable(
        ["Gol", "Nama Golongan", "Awal", "Debit", "Kredit", "Akhir", "Cabang"],
        rows,
        {
          numCols: [2, 3, 4, 5],
          foot: foot,
          bulkStore: "golongan",
          bulkIds: idsLimit,
          actions: function (r, i) {
            return crudActions(dataLimit[i].id, "golongan");
          },
          emptyMsg: "Belum ada golongan",
        },
      ),
    )
  );
}

function formGol(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.golongan || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};
  var html =
    '<div class="fg"><label>Cabang</label><select id="fGolCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts(data.cabang) +
    "</select></div>" +
    '<div class="fg"><label>Kode Golongan</label><input id="fGolKode" class="in" value="' +
    esc(data.gol || "") +
    '"></div>' +
    '<div class="fg"><label>Nama Golongan</label><input id="fGolNama" class="in" value="' +
    esc(data.namaGol || "") +
    '"></div>' +
    '<div class="fg"><label>Saldo Awal</label><input id="fGolAwal" type="number" class="in" value="' +
    esc(data.awal || 0) +
    '"></div>';
  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveGol(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Golongan" : "Tambah Golongan", html, foot);
}

async function saveGol(id) {
  try {
    var cabang = $("fGolCab").value;
    var gol = $("fGolKode").value.trim();
    var namaGol = $("fGolNama").value.trim();
    var awal = num($("fGolAwal").value);
    if (!gol || !namaGol) return toast("Kode dan Nama wajib diisi", "err");

    if (id) {
      var r = await db.get("golongan", id);
      if (r) {
        var updated = Object.assign({}, r, {
          gol: gol,
          namaGol: namaGol,
          awal: awal,
          cabang: cabang,
        });
        await db.put("golongan", updated);

        // MANUAL CACHE UPDATE (PENGGANTI refreshCache)
        var idx = DBCache.golongan.findIndex((x) => x.id === id);
        if (idx !== -1) DBCache.golongan[idx] = updated;
      }
    } else {
      var newId = uid();
      var newObj = {
        id: newId,
        gol: gol,
        namaGol: namaGol,
        awal: awal,
        db: 0,
        cr: 0,
        cabang: cabang,
      };
      await db.add("golongan", newObj);

      // MANUAL CACHE UPDATE (PENGGANTI refreshCache)
      DBCache.golongan.push(newObj);
    }

    // await refreshCache("golongan"); // DIHAPUS UNTUK MENCEGAH RELOAD/RESET
    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
  }
}

/* ---------- No Perkiraan ---------- */
PANEL_MAP.perk = renderPerk;

async function renderPerk() {
  var rawData = DBCache.perkiraan || [];

  // --- 1. FILTER ---
  var data = filterByCabang(rawData);

  // ✅ DEBUG 1: Cek Berapa banyak data yang kena filter cabang
  console.log("🔍 DEBUG 1 (Raw):", rawData.length);
  console.log("🔍 DEBUG 2 (Filter Cabang):", data.length);

  // --- 2. SORTING ---
  data.sort(function (a, b) {
    var cabangA = String(a.cabang || "");
    var cabangB = String(b.cabang || "");

    var compareCabang = cabangA.localeCompare(cabangB, undefined, {
      numeric: true,
      sensitivity: "base",
    });

    if (compareCabang !== 0) {
      return compareCabang;
    }

    var noPerkA = String(a.noPerk || "");
    var noPerkB = String(b.noPerk || "");
    return noPerkA.localeCompare(noPerkB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("perkiraan", ids);

  // --- 3. LIMIT (BATAS TAMPILAN) ---
  var dataLimit = data.slice(0, _viewLimit);
  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });

  // ✅ DEBUG 3: Cek Berapa banyak data yang masuk ke limit
  console.log("🔍 DEBUG 3 (Limit terpotong):", dataLimit.length);
  console.log("🔍 DEBUG 4 (Nilai _viewLimit):", _viewLimit);

  // --- 4. RENDER BARIS (Dengan Proteksi Error) ---
  var rows = dataLimit.map(function (r, index) {
    try {
      var ak = num(r.awal) + num(r.db) - num(r.cr);

      return [
        r.gol,
        r.noPerk,
        r.desc,
        fmtN(r.awal),
        fmtN(r.db),
        fmtN(r.cr),
        '<span class="tag tag-akhir">' + fmtN(ak) + "</span>",
        lookupCabangLabel(r.cabang),
      ];
    } catch (err) {
      console.error("❌ ERROR DI BARIS " + index + " (ID: " + r.id + "):", err);
      return ["Error", "Error", "Error", 0, 0, 0, 0, "-"];
    }
  });

  // --- 5. FOOTER (TOTAL) ---
  var foot = [
    "",
    "",
    "",
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.awal);
      }, 0),
    ),
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.db);
      }, 0),
    ),
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.cr);
      }, 0),
    ),
    "",
    "",
  ];

  // --- 6. RETURN HTML ---
  return (
    bulkBarHTML("perkiraan", "Perkiraan") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Cabang: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record" +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'perkiraan\', \'Data_Perkiraan\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'perkiraan\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'perkiraan\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    '<button type="button" class="btn btn-a" onclick="formPerk()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div></div>" +
    wrapTable(
      buildTable(
        [
          "Gol",
          "No Perkiraan",
          "Deskripsi",
          "Awal",
          "Debit",
          "Kredit",
          "Akhir",
          "Cabang",
        ],
        rows,
        {
          numCols: [3, 4, 5, 6],
          foot: foot,
          bulkStore: "perkiraan",
          bulkIds: idsLimit,
          actions: function (r, i) {
            return crudActions(dataLimit[i].id, "perkiraan");
          },
          emptyMsg: "Belum ada perkiraan",
        },
      ),
    )
  );
}

function formPerk(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.perkiraan || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};
  var html =
    '<div class="fg"><label>Cabang</label><select id="fPerkCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts(data.cabang) +
    "</select></div>" +
    '<div class="fg"><label>Golongan</label><input id="fPerkGol" class="in" value="' +
    esc(data.gol || "") +
    '"></div>' +
    '<div class="fg"><label>No Perkiraan</label><input id="fPerkNo" class="in" value="' +
    esc(data.noPerk || "") +
    '"></div>' +
    '<div class="fg"><label>Deskripsi</label><input id="fPerkDesc" class="in" value="' +
    esc(data.desc || "") +
    '"></div>' +
    '<div class="fg"><label>Saldo Awal</label><input id="fPerkAwal" type="number" class="in" value="' +
    esc(data.awal || 0) +
    '"></div>';
  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="savePerk(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Perkiraan" : "Tambah Perkiraan", html, foot);
}

async function savePerk(id) {
  try {
    var cabang = $("fPerkCab").value;
    var gol = $("fPerkGol").value.trim();
    var noPerk = $("fPerkNo").value.trim();
    var desc = $("fPerkDesc").value.trim();
    var awal = num($("fPerkAwal").value);
    if (!noPerk || !desc)
      return toast("No Perkiraan dan Deskripsi wajib diisi", "err");
    if (!cabang) return toast("Cabang wajib dipilih", "err");
    // PINDAHKAN VALIDASI DUPLIKAT KE DALAM BLOK "IF (!ID)"
    if (!id) {
      var dupPerk = (DBCache.perkiraan || []).find(function (p) {
        return p.noPerk === noPerk && (p.cabang || "Pusat") === cabang;
      });

      if (dupPerk) {
        return toast(
          'No Perkiraan "' + noPerk + '" sudah ada di cabang ini',
          "wrn",
        );
      }
    }

    if (id) {
      var r = await db.get("perkiraan", id);
      if (r) {
        var updated = Object.assign({}, r, {
          gol: gol,
          noPerk: noPerk,
          desc: desc,
          awal: awal,
          cabang: cabang,
        });
        await db.put("perkiraan", updated);
        // MANUAL CACHE UPDATE
        var idx = DBCache.perkiraan.findIndex((x) => x.id === id);
        if (idx !== -1) DBCache.perkiraan[idx] = updated;
      }
    } else {
      var newId = uid();
      var newObj = {
        id: newId,
        gol: gol,
        noPerk: noPerk,
        desc: desc,
        awal: awal,
        db: 0,
        cr: 0,
        cabang: cabang,
      };
      await db.add("perkiraan", newObj);
      // MANUAL CACHE UPDATE
      DBCache.perkiraan.push(newObj);
    }

    // await refreshCache("perkiraan"); // DIHAPUS
    closeModal();
    toast(id ? "Diperbarui" : "Ditambahkan", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
  }
}

/* ---------- Kode Bank/Kas ---------- */
PANEL_MAP.kode = renderKodeBank;

async function renderKodeBank() {
  var rawData = DBCache.kodeBank || [];
  var data = filterByCabang(rawData);

  data.sort(function (a, b) {
    var cabangA = String(a.cabang || "");
    var cabangB = String(b.cabang || "");
    return cabangA.localeCompare(cabangB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("kodeBank", ids);

  var dataLimit = data.slice(0, _viewLimit);
  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });

  console.log("Navigate ke 1: " + currentPanel);

  function countRef(kode) {
    var tc = 0;
    (DBCache.transaksi || []).forEach(function (t) {
      if (t.kodeBank === kode) tc++;
    });
    return tc;
  }
  function lookupPerk(noper) {
    if (!noper) return "-";
    var p = (DBCache.perkiraan || []).find(function (x) {
      return x.noPerk === noper;
    });
    return p
      ? esc(p.noPerk + " — " + p.desc)
      : '<span style="color:var(--accent)">⚠ ' + esc(noper) + "</span>";
  }

  var rows = dataLimit.map(function (r) {
    return [
      r.kodebank,
      r.penjelasan || "-",
      lookupPerk(r.noper),
      '<span style="color:var(--success)">' + countRef(r.kodebank) + "</span>",
      lookupCabangLabel(r.cabang),
    ];
  });
  var totalTrans = data.reduce(function (s, r) {
    return s + countRef(r.kodebank);
  }, 0);
  var foot = [
    data.length + " kode",
    "-",
    "-",
    '<span style="color:var(--success)">' + totalTrans + "</span>",
    "-",
  ];
  return (
    bulkBarHTML("kodeBank", "kodeBank") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Cabang: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record" +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'kodeBank\', \'Data_KodeBank\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'kodeBank\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'kodeBank\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    '<button type="button" class="btn btn-a" onclick="formKodeBank()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div></div>" +
    wrapTable(
      buildTable(
        [
          "Kode Bank/Kas",
          "Penjelasan",
          "No Perkiraan",
          "Jml Transaksi",
          "Cabang",
        ],
        rows,
        {
          foot: foot,
          bulkStore: "kodeBank",
          bulkIds: idsLimit,
          actions: function (r, i) {
            return crudActions(dataLimit[i].id, "kodeBank");
          },
          emptyMsg: "Belum ada kode bank/kas",
        },
      ),
    )
  );
}
function formKodeBank(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.kodeBank || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};

  var html =
    '<div class="fg"><label>Cabang</label><select id="fKbCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts(data.cabang) +
    "</select></div>" +
    '<div class="fg"><label>Kode Bank</label><input id="fKbKode" class="in" value="' +
    esc(data.kodebank || "") +
    '"></div>' +
    '<div class="fg"><label>Penjelasan</label><input id="fKbPenjelasan" class="in" value="' +
    esc(data.penjelasan || "") +
    '"></div>' +
    '<div class="fg"><label>No Perkiraan</label><input id="fKbNoper" class="in" value="' +
    esc(data.noper || "") +
    '"></div>' +
    '<div class="fg"><label>Saldo Awal</label><input id="fKbAwal" type="number" class="in" value="' +
    esc(data.awal || 0) +
    '"></div>' +
    /* ✅ TAMBAHAN: INPUT TANGGAL SALDO AWAL */
    '<div class="fg"><label>Tgl Saldo Awal</label><input id="fKbTglAwal" type="date" class="in" value="' +
    esc(data.tgl_awal || "") +
    '"></div>';

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveKodeBank(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Kode Bank" : "Tambah Kode Bank", html, foot);
}

async function saveKodeBank(e, editId) {
  // ✅ 1. Kunci browser agar tidak memicu hard refresh bawaan
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fKbCab").value;
    var kodebank = $("fKbKode").value.trim();
    var penjelasan = $("fKbPenjelasan").value.trim();
    var noper = $("fKbNoper").value.trim();
    var awal = num($("fKbAwal").value);
    var tgl_awal = $("fKbTglAwal").value;

    if (!kodebank || !penjelasan || !noper) {
      console.warn("Validasi gagal: Field tidak lengkap");
      return toast("Semua field wajib diisi", "err");
    }

    if (editId) {
      console.log("Menjalankan Mode EDIT untuk ID:", editId);

      // Ambal data lama dari IndexedDB lokal browser
      var r = await db.get("kodeBank", editId);
      if (r) {
        var updated = Object.assign({}, r, {
          kodebank: kodebank,
          penjelasan: penjelasan,
          noper: noper,
          cabang: cabang,
          awal: awal,
          tgl_awal: tgl_awal,
        });

        // ✅ 2. TEMBAK KE BACKEND SERVER (Menyimpan permanen di file SQLite Drive D)
        var response = await fetch(
          API_BASE_URL + "/api/data/kodeBank/" + editId,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          },
        );

        if (!response.ok) {
          var errJson = await response.json();
          throw new Error(errJson.error || "Gagal update ke server backend");
        }

        // ✅ 3. Sinkronisasi data ke IndexedDB browser agar tetap sama
        await db.put("kodeBank", updated);

        // ✅ 4. Perbarui data cache layar (DBCache)
        var idx = DBCache.kodeBank.findIndex((x) => x.id === editId);
        if (idx !== -1) {
          DBCache.kodeBank[idx] = updated;
          console.log("✅ Cache sukses diperbarui");
        }
      } else {
        console.error("Data lama tidak ditemukan di DB!");
      }
    } else {
      console.log("Menjalankan Mode BARU");
      var newId = uid();
      var newObj = {
        id: newId,
        kodebank: kodebank,
        penjelasan: penjelasan,
        noper: noper,
        cabang: cabang,
        awal: awal,
        tgl_awal: tgl_awal,
      };

      // ✅ 5. TEMBAK DATA BARU KE BACKEND SERVER (Jika backend Anda mendukung POST rute dinamis ini)
      var response = await fetch(API_BASE_URL + "/api/data/kodeBank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newObj),
      });

      if (!response.ok) {
        var errJson = await response.json();
        throw new Error(
          errJson.error || "Gagal tambah data baru ke server backend",
        );
      }

      // ✅ 6. Sinkronisasi data baru ke IndexedDB dan DBCache browser
      await db.add("kodeBank", newObj);
      DBCache.kodeBank.push(newObj);
      console.log("✅ Data baru sukses ditambahkan");
    }

    // ✅ 7. Eksekusi visual update secara mulus tanpa mengganggu siklus browser
    setTimeout(async function () {
      console.log("Menutup modal...");
      closeModal();

      toast(editId ? "Diperbarui" : "Ditambahkan", "ok");

      // Render ulang isi tabel komponen secara instan tanpa lompat halaman/dashboard
      if (typeof renderCurrentPanel === "function") {
        await renderCurrentPanel();
      } else if (typeof safeRenderCurrentPanel === "function") {
        await safeRenderCurrentPanel();
      }
    }, 100);
  } catch (err) {
    console.error("❌ ERROR TERDETEKSI:", err);
    toast("Gagal simpan: " + err.message, "err");
  }
}

/* ---------- Clear All Data Server Lokal SQLite ---------- */
async function clearAllData(storeName) {
  var labelMap = {
    golongan: "Golongan",
    perkiraan: "No Perkiraan",
    bank: "Kode Bank",
    kodeBank: "Kode Bank",
  };

  var kataDasar = storeName.replace(/[0-9]/g, "");
  var label = labelMap[storeName] || labelMap[kataDasar] || storeName;

  if (
    !confirm(
      "PERINGATAN!\n\nSemua data '" +
        label +
        "' di SERVER LOKAL akan dihapus secara permanen.\n\nLanjutkan?",
    )
  ) {
    return;
  }

  try {
    // 1. TEMBAK API EXPRESS PORT 3000 UNTUK MENGHAPUS DATA DI SQLITE SERVER
    var urlApiExpress = "http://localhost:3000/api/clear-all-data";

    var response = await fetch(urlApiExpress, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storeName: storeName }), // Kirim nama tabel dinamis tahunannya
    });

    var resResult = await response.json();

    if (!response.ok || !resResult.success) {
      throw new Error(resResult.message || "Gagal merespon server.");
    }

    // 2. KOSONGKAN SEKEJAP CACHE RAM DI BROWSER AGAR SINKRON
    if (DBCache[storeName]) DBCache[storeName] = [];
    if (DBCache[kataDasar]) DBCache[kataDasar] = [];
    if (typeof hasilUpdateLaporan !== "undefined") hasilUpdateLaporan = [];
    if (typeof hasilUpdateLaporangol !== "undefined")
      hasilUpdateLaporangol = [];

    toast(
      "Sukses! Data " + label + " di database SQLite berhasil dikosongkan",
      "ok",
    );

    // 3. PAKSA REFRESH LAYAR VISUAL
    setTimeout(function () {
      window.location.reload();
    }, 800);
  } catch (err) {
    console.error("Gagal menghapus data server:", err);
    toast("Gagal menghapus data server: " + err.message, "err");
  }
}

/* ---------- Cabang ---------- */
PANEL_MAP.cbg = renderCabang;

async function renderCabang() {
  var data = DBCache.cabang || [];
  data.sort(function (a, b) {
    var kodeA = String(a.kode || "");
    var kodeB = String(b.kode || "");
    return kodeA.localeCompare(kodeB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("cabang", ids);

  var dataLimit = data.slice(0, _viewLimit);
  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });

  var rows = dataLimit.map(function (r) {
    return [r.kode || "-", r.nama || "-"];
  });

  return (
    bulkBarHTML("cabang", "Cabang") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem">Tampilkan ' +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'cabang\', \'Data_Cabang\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-a" onclick="formCabang()"><i class="fa-solid fa-plus"></i> Tambah Cabang</button>' +
    "</div>" +
    "</div>" +
    wrapTable(
      buildTable(["Kode Cabang", "Nama Cabang"], rows, {
        bulkStore: "cabang",
        bulkIds: idsLimit,
        actions: function (r, i) {
          return crudActions(dataLimit[i].id, "cabang");
        },
        emptyMsg: "Belum ada data cabang",
      }),
    )
  );
}

function formCabang(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.cabang || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};

  var html =
    '<div class="fg"><label>Kode Cabang</label><input id="fCabKode" class="in" value="' +
    esc(data.kode || "") +
    '"></div>' +
    '<div class="fg"><label>Nama Cabang</label><input id="fCabNama" class="in" value="' +
    esc(data.nama || "") +
    '"></div>';

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveCabang(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Cabang" : "Tambah Cabang", html, foot);
}

async function saveCabang(e, id) {
  try {
    var kode = $("fCabKode").value.trim();
    var nama = $("fCabNama").value.trim();
    if (kode.length === 1 && !isNaN(kode)) {
      kode = "0" + kode;
    }
    // Pastikan input terisi
    if (!kode || !nama) return toast("Kode dan Nama wajib diisi", "err");

    if (id) {
      // MODE EDIT (UPDATE)
      var r = await db.get("cabang", id);
      if (r) {
        // PERBAIKAN DISINI:
        // Selalu sertakan 'id' secara eksplisit agar tidak hilang
        await db.put(
          "cabang",
          Object.assign({}, r, { id: id, kode: kode, nama: nama }),
          // Perhatikan saya tambahkan: { id: id, ... }
        );
      }
    } else {
      // MODE TAMBAH BARU
      // Pastikan 'id' yang dibuat unik
      await db.add("cabang", { id: uid(), kode: kode, nama: nama });
    }

    await refreshCache();
    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
    console.error(err); // Tambahkan ini untuk debug di console browser
  }
}
/* ---------- Tambahan Filter Cabang ---------- */
function changeCabangFilter(val) {
  currentCabang = val;
  safeRenderCurrentPanel();
}

function getCabangFilterHTML() {
  var list = DBCache.cabang || [];
  var html =
    '<select style="font-size:.72rem;padding:2px 4px;border-radius:4px;border:1px solid var(--brd);background:var(--bg);color:var(--fg);cursor:pointer" onchange="changeCabangFilter(this.value)">';
  var selectedAll = currentCabang === "SEMUA" ? " selected" : "";
  html += '<option value="SEMUA"' + selectedAll + ">SEMUA CABANG</option>";
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var val = typeof c === "object" ? c.kode || c.id : c;
    var txt = typeof c === "object" ? c.nama || c.label : c;
    var selected = currentCabang === val ? " selected" : "";
    html += '<option value="' + val + '"' + selected + ">" + txt + "</option>";
  }
  html += "</select>";
  return html;
}

PANEL_MAP.saldoKasir = renderSaldoKasir;
// ========================================================
// 1. RENDER SALDO KASIR (Termasuk Pencarian Saldo Awal Otomatis)
// ========================================================
async function renderSaldoKasir() {
  var rawData = DBCache.saldoKasir || [];
  var data = filterByCabang(rawData);

  data.sort(function (a, b) {
    var tglA = a.tgl_awal || "";
    var tglB = b.tgl_awal || "";
    if (tglA < tglB) return 1;
    if (tglA > tglB) return -1;
    return 0;
  });

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("saldoKasir", ids);

  var dataLimit = data.slice(0, _viewLimit);
  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });

  function formatTgl(str) {
    if (!str) return "-";
    var d = str.split("-");
    if (d.length === 3) return d[2] + "/" + d[1] + "/" + d[0];
    return str;
  }

  var rows = dataLimit.map(function (r) {
    return [r.cabang || "-", formatTgl(r.tgl_awal), formatUang(r.akhir || 0)];
  });

  var totalSaldo = data.reduce(function (s, r) {
    return s + (num(r.akhir) || 0);
  }, 0);

  var foot = [
    "Total: " + data.length + " record",
    "-",
    '<span style="font-weight:bold;">' + formatUang(totalSaldo) + "</span>",
  ];

  // ✅ PENCARIAN SALDO AWAL OTOMATIS UNTUK DITAMPILKAN DI HEADER
  var myCabang = localStorage.getItem("cabang") || "";
  var todayStr = new Date().toISOString().split("T")[0]; // Hari ini format YYYY-MM-DD
  var saldoAwalTampil = await cariSaldoAwalKeMundur(myCabang, todayStr);
  var saldoAwalHtml =
    typeof saldoAwalTampil === "number"
      ? '<div style="background:rgba(16,124,65,0.1); border:1px solid rgba(16,124,65,0.3); color:#107c41; padding:8px 15px; border-radius:8px; font-weight:bold; font-size:.9rem;">Saldo Awal Terakhir: ' +
        formatUang(saldoAwalTampil) +
        "</div>"
      : "";

  return (
    saldoAwalHtml + // Tampilkan di bagian paling atas
    bulkBarHTML("saldoKasir", "saldoKasir") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Tampilkan " +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record" +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'saldoKasir\', \'Data_SaldoKasir\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'saldoKasir\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'saldoKasir\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    // ✅ TAMBAHKAN TOMBOL INI (Warna Oranye, Diletakkan sebelum tombol Tambah)
    '<button type="button" class="btn btn-s" style="background:#f59e0b;color:#fff;border-color:#f59e0b" onclick="promptHapusSeReff(\'saldoKasir\')"><i class="fa-solid fa-layer-group"></i> Hapus Se-Reff</button>' +
    '<button type="button" class="btn btn-a" onclick="formSaldoKasir()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div></div>" +
    wrapTable(
      buildTable(["Cabang", "Tanggal", "Saldo Akhir"], rows, {
        foot: foot,
        bulkStore: "saldoKasir",
        bulkIds: idsLimit,
        actions: function (r, i) {
          var id = dataLimit[i].id;
          return (
            '<button type="button" class="btn btn-y" onclick="formSaldoKasir(\'' +
            id +
            '\')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>' +
            '<button type="button" class="btn btn-r" onclick="deleteData(\'saldoKasir\', \'' +
            id +
            '\')" title="Hapus"><i class="fa-solid fa-trash"></i></button>'
          );
        },
        emptyMsg: "Belum ada data Saldo Kasir",
      }),
    )
  );
}

// ========================================================
// 2. FUNGSI PENCARIAN SALDO AWAL KE MUNDUR (CORE LOGIC)
// ========================================================
async function cariSaldoAwalKeMundur(cabang, tanggalPilih) {
  if (!cabang || !tanggalPilih) return 0;

  // 1. Ambil semua data saldoKasir untuk cabang ini (sudah difilter di cache)
  var dataSk = (DBCache.saldoKasir || []).filter(function (item) {
    return (item.cabang || "") === cabang;
  });

  // 2. Ubah tanggal pilih ke objek Date
  var tglTarget = new Date(tanggalPilih);
  tglTarget.setDate(tglTarget.getDate() - 1); // Kurangi 1 hari (mencari hari sebelumnya)

  var maxIterasi = 365; // Maksimal mencari mundur 1 tahun ke belakang
  var ditemukan = false;
  var saldoAwal = 0;
  var tglDitemukan = "";

  // 3. Looping mengurangi tanggal sampai ketemu
  for (var i = 0; i < maxIterasi; i++) {
    var tglStr = tglTarget.toISOString().split("T")[0]; // Format kembali ke YYYY-MM-DD

    // Cari di array apakah ada yang tanggalnya sama
    var cocok = dataSk.find(function (sk) {
      return (sk.tgl_awal || "") === tglStr;
    });

    if (cocok) {
      saldoAwal = num(cocok.akhir) || 0;
      tglDitemukan = tglStr;
      ditemukan = true;
      console.log(
        `✅ Saldo awal ditemukan di tanggal ${tglStr} sebesar ${saldoAwal}`,
      );
      break; // Berhenti mencari
    }

    // Jika belum ketemu, kurangi lagi 1 hari
    tglTarget.setDate(tglTarget.getDate() - 1);
  }

  if (!ditemukan) {
    console.log(
      "⚠️ Tidak ditemukan saldo di tanggal sebelumnya. Menggunakan 0.",
    );
  }

  return saldoAwal;
}

// ========================================================
// 3. FORM SALDO KASIR (Dengan Pemicu Pencarian Otomatis)
// ========================================================
function formSaldoKasir(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.saldoKasir || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};

  var displaySaldo = isEdit ? data.akhir || 0 : 0;

  var html =
    '<div class="fg"><label>Cabang</label><select id="fSkCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts(data.cabang) +
    "</select></div>" +
    '<div class="fg"><label>Tanggal Saldo</label><input id="fSkTgl" type="date" class="in" value="' +
    esc(data.tgl_awal || "") +
    '" onchange="onTglSaldoChange()">' + // ✅ TRIGGER PENCARIAN OTOMATIS
    "</div>" +
    '<div class="fg"><label>Saldo Awal (Otomatis)</label><input id="fSkAwalAuto" type="text" class="in" value="0" disabled style="background:#f0f0f0; color:#333; font-weight:bold;"></div>' +
    '<div class="fg"><label>Saldo yang Disimpan</label><input id="fSkAkhir" type="number" class="in" value="' +
    esc(displaySaldo) +
    '" title="Isi saldo akhir terbaru untuk tanggal ini"></div>';

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveSaldoKasir(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Saldo Kasir" : "Tambah Saldo Kasir", html, foot);

  // Jika edit, panggil sekali saat form dibuka
  if (isEdit) {
    setTimeout(function () {
      onTglSaldoChange();
    }, 50);
  }
}

// ✅ FUNGSI YANG DIPANGGIL SAAT TANGGAL DIUBAH
async function onTglSaldoChange() {
  var cabang = $("fSkCab").value;
  var tglPilih = $("fSkTgl").value;

  if (!cabang || !tglPilih) return;

  // Tampilkan loading kecil di input
  $("fSkAwalAuto").value = "Mencari...";

  // Cari saldo ke mundur
  var saldo = await cariSaldoAwalKeMundur(cabang, tglPilih);

  // Tampilkan hasilnya
  $("fSkAwalAuto").value = formatUang(saldo);
}

// ========================================================
// 4. SAVE SALDO KASIR (Menghitung DB/CR Transaksi)
// ========================================================
async function saveSaldoKasir(e, editId) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fSkCab").value;
    var tgl_awal = $("fSkTgl").value;
    var akhirInput = num($("fSkAkhir").value);

    if (!tgl_awal) return toast("Tanggal wajib diisi", "err");

    // 1. Cari Saldo Awal dari tanggal sebelumnya
    var saldoAwal = await cariSaldoAwalKeMundur(cabang, tgl_awal);

    // 2. Ambil data transaksi kasir (mutasikasir) di tanggal ini
    var trxHariIni = (DBCache.mutasikasir || []).filter(function (t) {
      return (t.cabang || "") === cabang && (t.tanggal || "") === tgl_awal;
    });

    // 3. Hitung DB dan CR berdasarkan KODE TRANSAKSI
    var totalDB = 0;
    var totalCR = 0;

    trxHariIni.forEach(function (trx) {
      var kode = (trx.kodeTrans || trx.kode || "").toUpperCase();
      var nominal = num(trx.total || trx.nominal || 0);

      if (["PJ", "TK", "KT"].indexOf(kode) !== -1) {
        totalDB += nominal; // Masuk ke Debit
      } else {
        totalCR += nominal; // Selain itu masuk ke Kredit
      }
    });

    // 4. Hitung Saldo Akhir (Untuk disimpan ke tabel saldoKasir)
    // Rumus: Saldo Awal + DB - CR
    var saldoAkhirFix = saldoAwal + totalDB - totalCR;

    // 5. Siapkan objek yang akan disimpan
    var objSave = {
      cabang: cabang,
      tgl_awal: tgl_awal,
      awal: saldoAwal, // Saldo dari hari sebelumnya
      db: totalDB, // Total kode PJ, TK, KT hari ini
      cr: totalCR, // Total kode lainnya hari ini
      akhir: saldoAkhirFix, // HASIL AKHIR YANG DISIMPAN
    };

    // 6. Eksekusi ke Database (Tambah atau Update)
    if (editId) {
      objSave.id = editId;
      var response = await fetch(
        API_BASE_URL + "/api/data/saldoKasir/" + editId,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(objSave),
        },
      );

      if (!response.ok) {
        var errJson = await response.json();
        throw new Error(errJson.error || "Gagal update ke server backend");
      }

      var idx = DBCache.saldoKasir.findIndex((x) => x.id === editId);
      if (idx !== -1) DBCache.saldoKasir[idx] = objSave;
    } else {
      objSave.id = uid();

      var response = await fetch(API_BASE_URL + "/api/data/saldoKasir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objSave),
      });

      if (!response.ok) {
        var errJson = await response.json();
        throw new Error(
          errJson.error || "Gagal tambah data baru ke server backend",
        );
      }

      DBCache.saldoKasir.push(objSave);
    }

    setTimeout(async function () {
      closeModal();
      toast(
        "Tersimpan! (DB:" +
          formatUang(totalDB) +
          ", CR:" +
          formatUang(totalCR) +
          " | Akhir: " +
          formatUang(saldoAkhirFix) +
          ")",
        "ok",
      );

      if (typeof renderCurrentPanel === "function") {
        await renderCurrentPanel();
      } else if (typeof safeRenderCurrentPanel === "function") {
        await safeRenderCurrentPanel();
      }
    }, 100);
  } catch (err) {
    console.error("❌ ERROR TERDETEKSI:", err);
    toast("Gagal simpan: " + err.message, "err");
  }
}
// ========================================================
// FUNGSI HAPUS SEKALIGUS BERDASARKAN NOREFF
// ========================================================
async function deleteByNoReff(storeName, noreff) {
  if (!noreff) {
    return toast("Tidak ada No Reff yang dipilih", "err");
  }

  // 1. Cari semua data di cache yang memiliki noreff sama
  var dataStore = DBCache[storeName] || [];
  var dataHapus = dataStore.filter(function (item) {
    return (item.noreff || "") === noreff;
  });

  if (dataHapus.length === 0) {
    return toast("Data tidak ditemukan di cache", "err");
  }

  // 2. Tampilkan Modal Konfirmasi
  var listHtml = dataHapus
    .map(function (d, i) {
      return (
        '<div style="padding:.3rem .5rem; border-bottom:1px solid var(--brd); font-size:.75rem; display:flex; justify-content:space-between;">' +
        "<span>" +
        (i + 1) +
        ". " +
        esc(d.noperkiraan || d.desc || d.id) +
        "</span>" +
        '<span style="color:var(--accent); font-weight:bold;">' +
        formatUang(d.total || d.db || 0) +
        "</span>" +
        "</div>"
      );
    })
    .join("");

  var totalNominal = dataHapus.reduce(function (sum, d) {
    return sum + num(d.total || d.db || 0);
  }, 0);

  openModal(
    "Hapus Transaksi Se-Reff",
    '<div class="confirm-box">' +
      '<div style="padding:.8rem; background:rgba(220,53,69,.1); border:1px solid rgba(220,53,69,.3); border-radius:8px; margin-bottom:1rem; display:flex; align-items:center; gap:.6rem;">' +
      '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger); font-size:1.2rem;"></i>' +
      "<div>" +
      '<strong style="color:var(--danger)">Hapus ' +
      dataHapus.length +
      " data dengan No Reff: " +
      noreff +
      "?</strong>" +
      '<div style="font-size:.78rem; color:var(--muted); margin-top:.2rem;">Total Nilai: <strong>' +
      formatUang(totalNominal) +
      "</strong></div>" +
      "</div></div>" +
      '<div style="max-height:200px; overflow-y:auto; background:var(--bg2); border:1px solid var(--brd); border-radius:8px; padding:.5rem; font-family:JetBrains Mono, monospace;">' +
      listHtml +
      "</div>" +
      '<div class="cb-btns" style="margin-top:1rem;">' +
      '<button class="btn btn-g" onclick="closeModal()">Batal</button>' +
      '<button class="btn btn-r" onclick="executeDeleteNoReff(\'' +
      storeName +
      "', '" +
      esc(noreff) +
      '\')"><i class="fa-solid fa-trash-can"></i> Ya, Hapus Semua (' +
      dataHapus.length +
      ")</button>" +
      "</div></div>",
  );
}

// Fungsi Eksekusi Penghapusan yang Sesungguhnya
async function executeDeleteNoReff(storeName, noreff) {
  try {
    var dataStore = DBCache[storeName] || [];
    var dataHapus = dataStore.filter(function (item) {
      return (item.noreff || "") === noreff;
    });

    var berhasilHapus = 0;
    var gagalHapus = 0;

    // Looping hapus satu per satu ke server
    for (var i = 0; i < dataHapus.length; i++) {
      try {
        await db.del(storeName, dataHapus[i].id);
        berhasilHapus++;
      } catch (err) {
        console.error("Gagal hapus ID:", dataHapus[i].id, err);
        gagalHapus++;
      }
    }

    // Bersihkan data dari DBCache
    DBCache[storeName] = dataStore.filter(function (item) {
      return (item.noreff || "") !== noreff;
    });

    closeModal();

    var msg = "Berhasil dihapus: " + berhasilHapus + " data.";
    if (gagalHapus > 0) msg += " (Gagal: " + gagalHapus + ")";

    toast(msg, gagalHapus > 0 ? "wrn" : "ok");

    // Refresh tampilan tabel
    if (typeof renderCurrentPanel === "function") {
      await renderCurrentPanel();
    } else if (typeof safeRenderCurrentPanel === "function") {
      await safeRenderCurrentPanel();
    } else {
      navigate(currentPanel);
    }
  } catch (err) {
    closeModal();
    toast("Gagal menghapus: " + err.message, "err");
  }
}
