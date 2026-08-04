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

  var headers = [];
  var footer = [];
  var tableRows = ""; // Akan diisi tag <tr> HTML

  // ==========================================
  // 1. SUSUN HEADER HTML
  // ==========================================
  var headerHTML = function (hArray) {
    return (
      "<tr style='background-color:#2f5496;color:#ffffff;font-weight:bold;'>" +
      hArray.map((h) => "<td>" + h + "</td>").join("") +
      "</tr>"
    );
  };

  // ==========================================
  // 2. LOGIKA DINAMIS MILIKMU (TIDAK DIUBAH, HANYA DIUBAH FORMAT OUTPUT-NYA)
  // ==========================================
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
    var totalDb = 0,
      totalCr = 0;

    data.forEach(function (r) {
      var ak = num(r.awal) + num(r.db) - num(r.cr);
      totalDb += num(r.db);
      totalCr += num(r.cr);
      tableRows +=
        "<tr>" +
        "<td style='mso-number-format:\"\\@\";'>" +
        (r.gol || "") +
        "</td>" +
        "<td>" +
        (r.namaGol || "") +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        num(r.awal) +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        num(r.db) +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        num(r.cr) +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        ak +
        "</td>" +
        "<td>" +
        lookupCabangLabel(r.cabang) +
        "</td>" +
        "</tr>";
    });
    footer = ["", "", "", totalDb, totalCr, "", ""];
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
    var totalAwal = 0,
      totalDb = 0,
      totalCr = 0;

    data.forEach(function (r) {
      var ak = num(r.awal) + num(r.db) - num(r.cr);
      totalAwal += num(r.awal);
      totalDb += num(r.db);
      totalCr += num(r.cr);
      tableRows +=
        "<tr>" +
        "<td style='mso-number-format:\"\\@\";'>" +
        (r.gol || "") +
        "</td>" +
        "<td style='mso-number-format:\"\\@\";'>" +
        (r.noPerk || "") +
        "</td>" +
        "<td>" +
        (r.desc || "") +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        num(r.awal) +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        num(r.db) +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        num(r.cr) +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        ak +
        "</td>" +
        "<td>" +
        lookupCabangLabel(r.cabang) +
        "</td>" +
        "</tr>";
    });
    footer = ["", "", "", totalAwal, totalDb, totalCr, "", ""];
  } else if (storeName === "kodeBank") {
    headers = [
      "Kode Bank",
      "Penjelasan",
      "No Perkiraan",
      "Jml Transaksi",
      "Cabang",
    ];

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
      tableRows +=
        "<tr>" +
        "<td style='mso-number-format:\"\\@\";'>" +
        (r.kodebank || "") +
        "</td>" +
        "<td>" +
        (r.penjelasan || "-") +
        "</td>" +
        "<td>" +
        lookupPerk(r.noper) +
        "</td>" +
        "<td style='mso-number-format:\"#,##0\";'>" +
        jml +
        "</td>" +
        "<td>" +
        lookupCabangLabel(r.cabang) +
        "</td>" +
        "</tr>";
    });
    footer = [data.length + " kode", "-", "-", totalTrans, "-"];
  } else if (storeName === "cabang") {
    headers = ["Kode Cabang", "Nama Cabang"];
    data.forEach(function (r) {
      tableRows +=
        "<tr>" +
        "<td style='mso-number-format:\"\\@\";'>" +
        (r.kode || "") +
        "</td>" +
        "<td>" +
        (r.nama || "") +
        "</td>" +
        "</tr>";
    });
    footer = [];
  }

  // ==========================================
  // 3. SUSUN FOOTER HTML
  // ==========================================
  var footerHTML = "";
  if (footer.length > 0) {
    footerHTML =
      "<tr style='background-color:#d9e2f3;font-weight:bold;'>" +
      footer
        .map((f) => "<td style='mso-number-format:\"#,##0\";'>" + f + "</td>")
        .join("") +
      "</tr>";
  }

  // ==========================================
  // 4. GABUNGKAN MENJADI TEMPLATE HTML EXCEL
  // ==========================================
  var htmlTemplate = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="UTF-8">
    <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>${storeName}</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
    </xml><![endif]-->
  </head>
  <body>
    <table border="1" style="border-collapse:collapse; width:100%;">
      <thead>${headerHTML(headers)}</thead>
      <tbody>${tableRows}</tbody>
      <tfoot>${footerHTML}</tfoot>
    </table>
  </body>
  </html>`;

  // ==========================================
  // 5. DOWNLOAD FILE
  // ==========================================
  var blob = new Blob([htmlTemplate], {
    type: "application/vnd.ms-excel", // Tipe ini wajib agar Excel membaca sebagai tabel, bukan teks
  });

  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.setAttribute("href", url);
  var suffix = storeName === "cabang" ? "" : "_" + currentCabang;
  link.setAttribute("download", fileNamePrefix + suffix + ".xls");

  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  toast("Data berhasil di-export ke format tabel Excel!", "ok");
}
/* ---------- Golongan Perkiraan ---------- */
PANEL_MAP.gol = renderGol;
async function renderGol() {
  var rawData = DBCache.golongan || [];
  var data = filterByCabang(rawData);

  // --- 1. FILTER GROUP ---
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    data = data.filter(function (r) {
      return (r.group || "") === activeGroup;
    });
  }

  // --- 2. SORTING BERTINGKAT (Cabang -> Group -> Golongan) ---
  data.sort(function (a, b) {
    var cabangA = String(a.cabang || "");
    var cabangB = String(b.cabang || "");
    var compareCabang = cabangA.localeCompare(cabangB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (compareCabang !== 0) return compareCabang;

    var groupA = String(a.group || "");
    var groupB = String(b.group || "");
    var compareGroup = groupA.localeCompare(groupB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (compareGroup !== 0) return compareGroup;

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
      r.group || "-", // <-- KOLOM GROUP DITAMBAHKAN
      lookupCabangLabel(r.cabang),
    ];
  });

  // Sesuaikan jumlah footer (sekarang ada 8 kolom)
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
    "", // Footer Group
    "", // Footer Cabang
  ];

  return (
    bulkBarHTML("golongan", "Golongan") + // Typo "GOlongan" saya perbaiki jadi "Golongan"
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Cabang: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Filter Group: " +
    getGroupFilterHTML() + // <-- FILTER GROUP DITAMBAHKAN
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
        [
          "Gol",
          "Nama Golongan",
          "Awal",
          "Debit",
          "Kredit",
          "Akhir",
          "Group",
          "Cabang",
        ], // Header Group ditambahkan
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
    '<div class="fg"><label>Group</label><select id="fGolGroup" class="in"' + // <-- INPUT GROUP DITAMBAHKAN
    (isEdit ? " disabled" : "") +
    ">" +
    getGroupOpts(data.group) +
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

// ✅ PERBAIKAN: Ditambahkan "e" di parameter untuk cegah Error 500
async function saveGol(e, id) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fGolCab").value;
    var group = $("fGolGroup").value; // <-- AMBIL NILAI GROUP
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
          group: group, // <-- GROUP DIMASUKKAN KE UPDATE
        });
        await db.put("golongan", updated);

        // MANUAL CACHE UPDATE
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
        group: group, // <-- GROUP DIMASUKKAN KE OBJEK BARU
      };
      await db.add("golongan", newObj);

      // MANUAL CACHE UPDATE
      DBCache.golongan.push(newObj);
    }

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

  // --- 1. FILTER (CABANG & GROUP) ---
  var data = filterByCabang(rawData); // Fungsi filterByCabang diasumsikan sudah ada
  var activeGroup = getActiveGroupFilter(); // Fungsi helper untuk ambil nilai filter group (bisa diganti sesuai sistem Anda)

  if (activeGroup) {
    data = data.filter(function (r) {
      return (r.group || "") === activeGroup;
    });
  }

  // ✅ DEBUG: Cek Filter
  console.log("🔍 DEBUG (Raw):", rawData.length);
  console.log("🔍 DEBUG (Filter Cabang & Group):", data.length);

  // --- 2. SORTING ---
  data.sort(function (a, b) {
    var cabangA = String(a.cabang || "");
    var cabangB = String(b.cabang || "");
    var compareCabang = cabangA.localeCompare(cabangB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (compareCabang !== 0) return compareCabang;

    // Urutkan berdasarkan Group jika ada
    var groupA = String(a.group || "");
    var groupB = String(b.group || "");
    var compareGroup = groupA.localeCompare(groupB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (compareGroup !== 0) return compareGroup;

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

  // --- 4. RENDER BARIS ---
  var rows = dataLimit.map(function (r, index) {
    try {
      var ak = num(r.awal) + num(r.db) - num(r.cr);
      return [
        r.gol,
        r.noperk,
        r.desc,
        fmtN(r.awal),
        fmtN(r.db),
        fmtN(r.cr),
        '<span class="tag tag-akhir">' + fmtN(ak) + "</span>",
        r.group || "-", // Kolom Group ditambahkan
        lookupCabangLabel(r.cabang),
      ];
    } catch (err) {
      console.error("❌ ERROR DI BARIS " + index + " (ID: " + r.id + "):", err);
      return ["Error", "Error", "Error", 0, 0, 0, 0, "-", "-"];
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
    "", // Disesuaikan dengan jumlah kolom (9 kolom)
  ];

  // --- 6. RETURN HTML ---
  return (
    bulkBarHTML("perkiraan", "Perkiraan") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Cabang: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Filter Group: " +
    getGroupFilterHTML() + // <-- TAMBAHKAN INI
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
          "Group",
          "Cabang",
        ], // Header kolom ditambah
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
    '<div class="fg"><label>Group</label><select id="fPerkGroup" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" + // <-- TAMBAHKAN INPUT GROUP
    getGroupOpts(data.group) + // Fungsi helper untuk generate <option> Group
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

async function savePerk(e, id) {
  // Tambahkan 'e' di parameter agar sesuai dengan onclick="savePerk(event, ...)"
  try {
    var cabang = $("fPerkCab").value;
    var group = $("fPerkGroup").value; // <-- AMBIL NILAI GROUP
    var gol = $("fPerkGol").value.trim();
    var noPerk = $("fPerkNo").value.trim();
    var desc = $("fPerkDesc").value.trim();
    var awal = num($("fPerkAwal").value);

    if (!noPerk || !desc)
      return toast("No Perkiraan dan Deskripsi wajib diisi", "err");
    if (!cabang) return toast("Cabang wajib dipilih", "err");
    // if (!group) return toast("Group wajib dipilih", "err"); // (Hapus komentar ini jika Group juga wajib)

    // VALIDASI DUPLIKAT (No Perk + Cabang + Group)
    if (!id) {
      var dupPerk = (DBCache.perkiraan || []).find(function (p) {
        return (
          p.noPerk === noPerk &&
          (p.cabang || "Pusat") === cabang &&
          (p.group || "") === group
        );
      });

      if (dupPerk) {
        return toast(
          'No Perkiraan "' + noPerk + '" untuk Group & Cabang ini sudah ada',
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
          group: group, // <-- SIMPAN GROUP
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
        group: group, // <-- SIMPAN GROUP
      };
      await db.add("perkiraan", newObj);
      // MANUAL CACHE UPDATE
      DBCache.perkiraan.push(newObj);
    }

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

  // --- 1. FILTER (CABANG & GROUP) ---
  var data = filterByCabang(rawData);
  var activeGroup = getActiveGroupFilter();

  if (activeGroup) {
    data = data.filter(function (r) {
      return (r.group || "") === activeGroup;
    });
  }

  // --- 2. SORTING ---
  data.sort(function (a, b) {
    var cabangA = String(a.cabang || "");
    var cabangB = String(b.cabang || "");
    var compareCabang = cabangA.localeCompare(cabangB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (compareCabang !== 0) return compareCabang;

    // Urutkan berdasarkan Group
    var groupA = String(a.group || "");
    var groupB = String(b.group || "");
    var compareGroup = groupA.localeCompare(groupB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (compareGroup !== 0) return compareGroup;

    var kodeA = String(a.kodebank || "");
    var kodeB = String(b.kodebank || "");
    return kodeA.localeCompare(kodeB, undefined, {
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

  // --- 3. RENDER BARIS ---
  var rows = dataLimit.map(function (r) {
    return [
      r.kodebank,
      r.penjelasan || "-",
      lookupPerk(r.noper),
      '<span style="color:var(--success)">' + countRef(r.kodebank) + "</span>",
      r.group || "-", // <-- KOLOM GROUP DITAMBAHKAN
      lookupCabangLabel(r.cabang),
    ];
  });

  // --- 4. FOOTER (TOTAL) ---
  var totalTrans = data.reduce(function (s, r) {
    return s + countRef(r.kodebank);
  }, 0);
  var foot = [
    data.length + " kode",
    "-",
    "-",
    '<span style="color:var(--success)">' + totalTrans + "</span>",
    "-", // Footer Kolom Group
    "-", // Footer Kolom Cabang
  ];

  // --- 5. RETURN HTML ---
  return (
    bulkBarHTML("kodeBank", "kodeBank") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Cabang: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Filter Group: " +
    getGroupFilterHTML() + // <-- DROPDOWN FILTER GROUP DITAMBAHKAN
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
          "Group", // <-- HEADER KOLOM GROUP DITAMBAHKAN
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
    '<div class="fg"><label>Group</label><select id="fKbGroup" class="in"' + // <-- INPUT GROUP DITAMBAHKAN
    (isEdit ? " disabled" : "") +
    ">" +
    getGroupOpts(data.group) +
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
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fKbCab").value;
    var group = $("fKbGroup").value; // <-- AMBIL NILAI GROUP
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

      var r = await db.get("kodeBank", editId);
      if (r) {
        var updated = Object.assign({}, r, {
          kodebank: kodebank,
          penjelasan: penjelasan,
          noper: noper,
          cabang: cabang,
          group: group, // <-- GROUP DIMASUKKAN KE UPDATE
          awal: awal,
          tgl_awal: tgl_awal,
        });

        // TEMBAK KE BACKEND SERVER
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

        // Sinkronisasi ke IndexedDB & Cache
        await db.put("kodeBank", updated);
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
        group: group, // <-- GROUP DIMASUKKAN KE OBJEK BARU
        awal: awal,
        tgl_awal: tgl_awal,
      };

      // TEMBAK DATA BARU KE BACKEND SERVER
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

      // Sinkronisasi ke IndexedDB & Cache
      await db.add("kodeBank", newObj);
      DBCache.kodeBank.push(newObj);
      console.log("✅ Data baru sukses ditambahkan");
    }

    // Eksekusi visual update
    setTimeout(async function () {
      console.log("Menutup modal...");
      closeModal();
      toast(editId ? "Diperbarui" : "Ditambahkan", "ok");

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
function getGroupFilterHTML() {
  var list = DBCache.groupproject || [];
  var active = getActiveGroupFilter();
  var html =
    '<select style="font-size:.72rem;padding:2px 4px;border-radius:4px;border:1px solid var(--brd);background:var(--bg);color:var(--fg);cursor:pointer" onchange="changeGroupFilter(this.value)">';

  var selectedAll = active === "" ? " selected" : "";
  html += '<option value=""' + selectedAll + ">SEMUA GROUP</option>";

  for (var i = 0; i < list.length; i++) {
    var g = list[i];

    // Nilai yang dikirim/disimpan (Gunakan kode, jika tidak ada baru gunakan id)
    var val = typeof g === "object" ? g.kode || g.id : g;

    // Tampilan teks: KODE - NAMA (Contoh: TLGA - TELAGA)
    var txt =
      typeof g === "object"
        ? g.kode && g.nama
          ? g.kode + " - " + g.nama
          : g.nama || g.kode
        : g;

    var selected = active === val ? " selected" : "";
    html += '<option value="' + val + '"' + selected + ">" + txt + "</option>";
  }
  html += "</select>";
  return html;
}

function getGroupOpts(selectedId) {
  var groups = DBCache.groupproject || [];
  var html = '<option value="">-- Pilih Group --</option>';
  groups.forEach(function (g) {
    // Ambil data kode dan nama
    var groupKode = g.kode || "";
    var groupNama = g.nama || "-";

    // Gabungkan teks untuk tampilan (Contoh: TLGA - TELAGA)
    var labelTeks = groupKode ? groupKode + " - " + groupNama : groupNama;

    html +=
      '<option value="' +
      esc(groupKode) + // Menggunakan KODE sebagai value yang disimpan
      '"' +
      ((selectedId || "") === groupKode ? " selected" : "") + // Pengecekan aktif berdasarkan kode
      ">" +
      esc(labelTeks) + // Menampilkan KODE dan NAMA
      "</option>";
  });
  return html;
}

function getActiveGroupFilter() {
  // Sesuaikan selector ini jika struktur HTML filter Anda berbeda
  var el = document.querySelector('[onchange="applyFilterAndRender()"]');
  // Jika ada dua select (Cabang & Group), lebih aman pakai ID.
  // Contoh jika diberi ID: return document.getElementById('filterGroup') ? document.getElementById('filterGroup').value : "";
  return el ? el.value : "";
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
  var rawData = DBCache.cabang || [];

  // --- 1. FILTER GROUP ---
  var data = rawData;
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    data = data.filter(function (r) {
      return (r.group || "") === activeGroup;
    });
  }

  // --- 2. SORTING (Group, lalu Kode Cabang) ---
  data.sort(function (a, b) {
    var groupA = String(a.group || "");
    var groupB = String(b.group || "");
    var compareGroup = groupA.localeCompare(groupB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (compareGroup !== 0) return compareGroup;

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
    return [
      r.kode || "-",
      r.nama || "-",
      r.group || "-", // <-- KOLOM GROUP DITAMBAHKAN
    ];
  });

  return (
    bulkBarHTML("cabang", "Cabang") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Group: " +
    getGroupFilterHTML() + // <-- FILTER GROUP DITAMBAHKAN
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record" +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'cabang\', \'Data_Cabang\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-a" onclick="formCabang()"><i class="fa-solid fa-plus"></i> Tambah Cabang</button>' +
    "</div>" +
    "</div>" +
    wrapTable(
      buildTable(
        ["Kode Cabang", "Nama Cabang", "Group"], // Header Group ditambahkan
        rows,
        {
          bulkStore: "cabang",
          bulkIds: idsLimit,
          actions: function (r, i) {
            return crudActions(dataLimit[i].id, "cabang");
          },
          emptyMsg: "Belum ada data cabang",
        },
      ),
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
    '<div class="fg"><label>Group</label><select id="fCabGroup" class="in"' + // <-- INPUT GROUP DITAMBAHKAN
    (isEdit ? " disabled" : "") +
    ">" +
    getGroupOpts(data.group) +
    "</select></div>" +
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
  if (e && e.preventDefault) e.preventDefault(); // Pencegahan Error 500

  try {
    var group = $("fCabGroup").value; // <-- AMBIL NILAI GROUP
    var kode = $("fCabKode").value.trim();
    var nama = $("fCabNama").value.trim();

    if (kode.length === 1 && !isNaN(kode)) {
      kode = "0" + kode;
    }

    if (!kode || !nama) return toast("Kode dan Nama wajib diisi", "err");

    if (id) {
      // MODE EDIT (UPDATE)
      var r = await db.get("cabang", id);
      if (r) {
        var updated = Object.assign({}, r, {
          id: id,
          kode: kode,
          nama: nama,
          group: group, // <-- GROUP DIMASUKKAN KE UPDATE
        });
        await db.put("cabang", updated);

        // MANUAL CACHE UPDATE
        var idx = DBCache.cabang.findIndex((x) => x.id === id);
        if (idx !== -1) DBCache.cabang[idx] = updated;
      }
    } else {
      // MODE TAMBAH BARU
      var newId = uid();
      var newObj = {
        id: newId,
        kode: kode,
        nama: nama,
        group: group, // <-- GROUP DIMASUKKAN KE OBJEK BARU
      };
      await db.add("cabang", newObj);

      // MANUAL CACHE UPDATE
      DBCache.cabang.push(newObj);
    }

    // await refreshCache(); // SUDAH DIHAPUS (Dialihkan ke manual cache di atas)
    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
    console.error(err);
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

PANEL_MAP.saldoKasirAwal = renderSaldoKasirAwal;

// ========================================================
// ========================================================
// 1. RENDER SALDO KASIR AWAL
async function renderSaldoKasirAwal() {
  var rawData = DBCache.saldokasirawal || [];
  var data = filterByCabang(rawData);

  // --- 1. FILTER GROUP ---
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    data = data.filter(function (r) {
      return (r.group || "") === activeGroup;
    });
  }

  // --- 2. SORTING (Group -> Tanggal Terbaru) ---
  data.sort(function (a, b) {
    var groupA = String(a.group || "");
    var groupB = String(b.group || "");
    var compareGroup = groupA.localeCompare(groupB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (compareGroup !== 0) return compareGroup;

    var tglA = a.tgl_awal || "";
    var tglB = b.tgl_awal || "";
    if (tglA < tglB) return 1;
    if (tglA > tglB) return -1;
    return 0;
  });

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("saldoKasirAwal", ids);

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
    return [
      r.cabang || "-",
      r.nama_cabang || "-",
      r.group || "-", // <-- MENGIKUTI RENDER CABANG
      formatTgl(r.tgl_awal),
      formatUang(r.akhir || 0),
    ];
  });

  var totalSaldo = data.reduce(function (s, r) {
    return s + (num(r.akhir) || 0);
  }, 0);

  var foot = [
    "Total: " + data.length + " record",
    "-",
    "-",
    "-",
    '<span style="font-weight:bold;">' + formatUang(totalSaldo) + "</span>",
  ];

  return (
    bulkBarHTML("saldoKasirAwal", "saldoKasirAwal") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Group: " +
    getGroupFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record" +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'saldoKasirAwal\', \'Data_SaldoKasirAwal\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'saldoKasirAwal\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'saldoKasirAwal\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    '<button type="button" class="btn btn-a" onclick="formSaldoKasirAwal()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div></div>" +
    wrapTable(
      buildTable(
        ["Cabang", "Nama Cabang", "Group", "Tanggal", "Saldo Awal"],
        rows,
        {
          foot: foot,
          bulkStore: "saldoKasirAwal",
          bulkIds: idsLimit,
          actions: function (r, i) {
            return crudActions(dataLimit[i].id, "saldokasirawal");
          },
          emptyMsg: "Belum ada data Saldo Kasir awal",
        },
      ),
    )
  );
}
function formSaldoKasirAwal(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.saldokasirawal || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};

  var displaySaldo = isEdit ? data.akhir || 0 : 0;

  var html =
    '<div class="fg"><label>Cabang</label>' +
    '<select id="fSkCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts(data.cabang) +
    "</select></div>" +
    '<div class="fg"><label>Group</label>' + // <-- INPUT GROUP DITAMBAHKAN
    '<select id="fSkGroup" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getGroupOpts(data.group) +
    "</select></div>" +
    '<div class="fg"><label>Tanggal Saldo</label><input id="fSkTgl" type="date" class="in" value="' +
    esc(data.tgl_awal || "") +
    '"></div>' +
    '<div class="fg"><label>Saldo</label><input id="fSkAwal" type="number" class="in" value="' +
    esc(displaySaldo) +
    '"></div>';

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveSaldoKasirAwal(event, \'' +
    esc(id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Saldo Kasir" : "Tambah Saldo Kasir", html, foot);
}

async function saveSaldoKasirAwal(e, editId) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabangEl = $("fSkCab");
    var cabang = cabangEl ? cabangEl.value : "";

    var nama_cabang =
      cabangEl && cabangEl.options[cabangEl.selectedIndex]
        ? cabangEl.options[cabangEl.selectedIndex].text
        : "";
    if (nama_cabang.includes(" - ")) {
      nama_cabang = nama_cabang.split(" - ")[1];
    }

    // --- AMBIL DATA GROUP ---
    var groupEl = $("fSkGroup");
    var group = groupEl ? groupEl.value : "";
    var nama_group =
      groupEl && groupEl.options[groupEl.selectedIndex]
        ? groupEl.options[groupEl.selectedIndex].text
        : "";
    if (nama_group.includes(" - ")) {
      nama_group = nama_group.split(" - ")[1];
    }

    var tgl_awal = $("fSkTgl") ? $("fSkTgl").value : "";
    var akhir = num($("fSkAwal") ? $("fSkAwal").value : 0);

    var awal = 0;
    var vdb = 0;
    var vcr = 0;

    if (!cabang) return toast("Cabang wajib dipilih", "err");
    if (!tgl_awal) return toast("Tanggal wajib diisi", "err");

    if (editId) {
      var r = await db.get("saldokasirawal", editId);
      if (r) {
        var updated = Object.assign({}, r, {
          cabang: cabang,
          nama_cabang: nama_cabang,
          group: group, // <-- GROUP DIMASUKKAN KE UPDATE
          nama_group: nama_group, // <-- NAMA GROUP DISIMPAN
          tgl_awal: tgl_awal,
          db: vdb,
          cr: vcr,
          akhir: akhir,
          awal: awal,
        });

        var response = await fetch(
          API_BASE_URL + "/api/data/saldokasirawal/" + editId,
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

        await db.put("saldokasirawal", updated);

        var idx = DBCache.saldokasirawal.findIndex((x) => x.id === editId);
        if (idx !== -1) {
          DBCache.saldokasirawal[idx] = updated;
        }
      } else {
        throw new Error("Data lama tidak ditemukan di DB lokal!");
      }
    } else {
      var newId = uid();
      var newObj = {
        id: newId,
        cabang: cabang,
        nama_cabang: nama_cabang,
        group: group, // <-- GROUP DIMASUKKAN KE OBJEK BARU
        nama_group: nama_group, // <-- NAMA GROUP DISIMPAN
        tgl_awal: tgl_awal,
        db: vdb,
        cr: vcr,
        akhir: akhir,
        awal: awal,
      };

      var response = await fetch(API_BASE_URL + "/api/data/saldokasirawal", {
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

      await db.add("saldokasirawal", newObj);
      DBCache.saldokasirawal.push(newObj);
    }

    setTimeout(async function () {
      closeModal();
      toast(editId ? "Diperbarui" : "Ditambahkan", "ok");

      if (typeof renderCurrentPanel === "function") {
        await renderCurrentPanel();
      } else if (typeof safeRenderCurrentPanel === "function") {
        await safeRenderCurrentPanel();
      }
    }, 100);
  } catch (err) {
    console.error("❌ ERROR TERDETEKTI:", err);
    toast("Gagal simpan: " + err.message, "err");
  }
}
PANEL_MAP.group = renderGroup;

async function renderGroup() {
  var data = DBCache.groupproject || [];
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
  bulkInit("group", ids);

  var dataLimit = data.slice(0, _viewLimit);
  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });

  var rows = dataLimit.map(function (r) {
    return [r.kode || "-", r.nama || "-"];
  });

  return (
    bulkBarHTML("groupproject", "Group Project") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem">Tampilkan ' +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'group\', \'Data_Group\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-a" onclick="formGroup()"><i class="fa-solid fa-plus"></i> Tambah Group</button>' +
    "</div>" +
    "</div>" +
    wrapTable(
      buildTable(["Kode Group", "Nama Group"], rows, {
        bulkStore: "groupproject",
        bulkIds: idsLimit,
        actions: function (r, i) {
          return crudActions(dataLimit[i].id, "group");
        },
        emptyMsg: "Belum ada data group",
      }),
    )
  );
}

function formGroup(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.groupproject || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};

  var html =
    '<div class="fg"><label>Kode Group</label><input id="fGrpKode" class="in" value="' +
    esc(data.kode || "") +
    '"></div>' +
    '<div class="fg"><label>Nama Group</label><input id="fGrpNama" class="in" value="' +
    esc(data.nama || "") +
    '"></div>';

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveGroup(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Group" : "Tambah Group", html, foot);
}

async function saveGroup(e, id) {
  try {
    var kode = $("fGrpKode").value.trim();
    var nama = $("fGrpNama").value.trim();
    if (kode.length === 1 && !isNaN(kode)) {
      kode = "0" + kode;
    }
    // Pastikan input terisi
    if (!kode || !nama) return toast("Kode dan Nama wajib diisi", "err");

    if (id) {
      // MODE EDIT (UPDATE)
      var r = await db.get("groupproject", id);
      if (r) {
        await db.put(
          "groupproject",
          Object.assign({}, r, { id: id, kode: kode, nama: nama }),
        );
      }
    } else {
      // MODE TAMBAH BARU
      await db.add("groupproject", { id: uid(), kode: kode, nama: nama });
    }

    await refreshCache();
    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
    console.error(err);
  }
}
PANEL_MAP.sales = renderSales;
var _currentPage = 1; // <--- TAMBAHKAN INI
// ========================================================
// 🌟 FUNGSI BARU: REFRESH SALES (Opsional, jika ingin force fetch dari Server)
// ========================================================
// Gunakan ini jika Anda ingin memaksa ambil data terbaru dari database server,
// melewati cache yang ada di memori (DBCache).

async function renderSales() {
  var rawData = DBCache.datasales || [];
  var data = filterByCabang(rawData);

  // --- 1. FILTER GROUP ---
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    data = data.filter(function (r) {
      return (r.group || "") === activeGroup;
    });
  }

  // --- 2. SORTING BERTINGKAT ---
  // --- 2. SORTING BERTINGKAT (Cabang -> Group -> Masa -> Kode Menu) ---
  data.sort(function (a, b) {
    var cabangA = String(a.cabang || ""),
      cabangB = String(b.cabang || "");
    var cCabang = cabangA.localeCompare(cabangB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (cCabang !== 0) return cCabang;

    var groupA = String(a.group || ""),
      groupB = String(b.group || "");
    var cGroup = groupA.localeCompare(groupB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (cGroup !== 0) return cGroup;

    // 🔥 1. LOGIKA BARU: SORT BY MASA (Urutkan dari masa terlama ke terbaru)
    var masaA = String(a.masa || a.ma || a.MA || "");
    var masaB = String(b.masa || b.ma || b.MA || "");
    var cMasa = masaA.localeCompare(masaB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (cMasa !== 0) return cMasa; // Jika masa berbeda, langsung urutkan berdasarkan masa

    // 2. Fallback terakhir jika Cabang, Group, dan Masa sama, urutkan berdasarkan Kode Menu
    var kodeA = String(a.kode || a.KODE || a.kodemenu || ""),
      kodeB = String(b.kode || b.KODE || b.kodemenu || "");
    return kodeA.localeCompare(kodeB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  // ==========================================
  // 🚀 LOGIKA PAGINATION SEJATI (PANAH KIRI/KANAN)
  // ==========================================
  var totalData = data.length;
  var totalPages = Math.ceil(totalData / _viewLimit) || 1; // Hitung total halaman

  // Pastikan halaman saat ini tidak melampaui total halaman (misal saat data di-filter berkurang)
  if (_currentPage > totalPages) _currentPage = totalPages;
  if (_currentPage < 1) _currentPage = 1;

  var startIndex = (_currentPage - 1) * _viewLimit;
  var endIndex = startIndex + _viewLimit;

  // Potong data SESUAI HALAMAN SAAT INI
  var dataLimit = data.slice(startIndex, endIndex);

  // Info untuk ditampilkan di UI (Contoh: "Menampilkan 51 - 100 dari 250")
  var showStart = totalData === 0 ? 0 : startIndex + 1;
  var showEnd = Math.min(endIndex, totalData);

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("datasales", ids);

  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });

  var rows = dataLimit.map(function (r) {
    return [
      r.kodemenu || r.kode || r.KODE || "-",
      r.namamenu || r.namaMenu || r.nama_menu || r.NAMAMENU || "-",
      r.satuan || r.SATUAN || "-",
      fmtN(r.qty || r.QTY || 0),
      fmtN(r.amount || r.AMOUNT || r.total || 0),
      r.masa || r.ma || r.MA || "-",
      r.group === "undefined" || !r.group ? "-" : r.group,
      lookupCabangLabel(r.cabang),
    ];
  });

  // Footer Total (Tetap menghitung dari SELURUH data, bukan hanya yang terlihat)
  var foot = [
    "",
    "TOTAL:",
    "",
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.qty || r.QTY);
      }, 0),
    ),
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.amount || r.AMOUNT || r.total);
      }, 0),
    ),
    "",
    "",
    "",
  ];

  // ==========================================
  // 🚀 MEMBUAT TOMBOL PANAH KIRI & KANAN
  // ==========================================
  var paginationHTML = "";
  if (totalData > 0) {
    paginationHTML =
      '<div style="display:flex;align-items:center;gap:.7rem;margin-top:.7rem;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="font-size:.8rem;color:var(--muted)">' +
      "Menampilkan <b>" +
      showStart +
      " - " +
      showEnd +
      "</b> dari <b>" +
      totalData +
      "</b> record (Hal. " +
      _currentPage +
      "/" +
      totalPages +
      ")" +
      "</div>" +
      '<div style="display:flex;gap:.4rem;align-items:center">' +
      '<button type="button" class="btn btn-inf" onclick="goToSalesPage(' +
      (_currentPage - 1) +
      ')" ' +
      (_currentPage <= 1
        ? 'disabled style="opacity:.5;cursor:not-allowed"'
        : "") +
      '><i class="fa-solid fa-arrow-left"></i> Prev</button>' +
      '<button type="button" class="btn btn-inf" onclick="goToSalesPage(' +
      (_currentPage + 1) +
      ')" ' +
      (_currentPage >= totalPages
        ? 'disabled style="opacity:.5;cursor:not-allowed"'
        : "") +
      '>Next <i class="fa-solid fa-arrow-right"></i></button>' +
      "</div>" +
      "</div>";
  }

  return (
    bulkBarHTML("datasales", "Sales") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Cabang: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Filter Group: " +
    getGroupFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() + // Jika user ganti limit (misal 50 ke 100), akan otomatis reset ke halaman 1
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-inf" onclick="refreshSales()" title="Refresh data dari server"><i class="fa-solid fa-rotate"></i> Refresh</button>' +
    // <-- KODE BARU -->
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportSalesToXLS()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'datasales\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'datasales\')"><i class="fa-solid fa-trash-can"></i> Kosongkan</button>' +
    '<button type="button" class="btn btn-a" onclick="formSales()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div>" +
    "</div>" +
    wrapTable(
      buildTable(
        [
          "Kode",
          "Nama Menu",
          "Satuan",
          "QTY",
          "Amount",
          "MA",
          "Group",
          "Cabang",
        ],
        rows,
        {
          numCols: [3, 4],
          foot: foot,
          bulkStore: "datasales",
          bulkIds: idsLimit,
          actions: function (r, i) {
            return crudActions(dataLimit[i].id, "datasales");
          },
          emptyMsg: "Belum ada data sales",
        },
      ),
    ) +
    // 🌟 TARUH TOMBOL PAGINATION DI BAWAH TABLE
    paginationHTML
  );
}

async function refreshSales() {
  try {
    toast("Memperbarui data Sales...", "inf");
    var baseUrl = window.location.origin + "/api/data/";
    var cabangSaya = localStorage.getItem("cabang") || "";
    var activeGroup = localStorage.getItem("activeGroup") || "TLGA";

    // 🟢 KOREKSI: Paksa lowercase .toLowerCase() agar tidak memicu Error 400 Bad Request di server
    var cleanCabang = cabangSaya.toLowerCase();

    var queryParams = "";
    if (cleanCabang !== "pusat") {
      queryParams = `?cabang=${cleanCabang}&group=${activeGroup}`;
    } else {
      queryParams = `?cabang=pusat&group=${activeGroup}`;
    }

    var response = await fetch(baseUrl + "datasales" + queryParams);
    if (!response.ok) throw new Error("Gagal mengambil data dari server");

    var freshData = await response.json();

    // Update cache di memori
    DBCache.datasales = freshData;

    // Render ulang tampilan
    if (typeof safeRenderCurrentPanel === "function") {
      safeRenderCurrentPanel();
    }
    toast("Data Sales berhasil diperbarui!", "ok");
  } catch (err) {
    toast("Error refresh sales: " + err.message, "err");
  }
}

// ==========================================
// 🚀 FUNGSI NAVIGASI PAGINATION
// ==========================================
function goToSalesPage(pageNum) {
  _currentPage = pageNum;
  safeRenderCurrentPanel(); // Re-render panel sales untuk menampilkan data halaman baru
}

// (Opsional) Jika getLimitOptsHTML() milik Anda tidak otomatis reset halaman saat diubah,
// Anda bisa tambahkan ini di event onchange dropdown limit-nya:
function changeSalesLimit(newLimit) {
  _viewLimit = parseInt(newLimit) || 50;
  _currentPage = 1; // Reset ke halaman 1 saat limit berubah
  safeRenderCurrentPanel();
}

function formSales(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.datasales || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};

  var html =
    '<div class="fg"><label>Cabang</label><select id="fSalesCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts(data.cabang) +
    "</select></div>" +
    '<div class="fg"><label>Group</label><select id="fSalesGroup" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getGroupOpts(data.group) +
    "</select></div>" +
    '<div class="fg"><label>Kode</label><input id="fSalesKode" class="in" value="' +
    esc(data.kode || data.KODE || data.kodemenu || "") +
    '"></div>' + // 🟢 fallback kodemenu
    '<div class="fg"><label>Nama Menu</label><input id="fSalesNama" class="in" value="' +
    esc(data.namaMenu || data.nama_menu || data.namamenu || data.nama || "") +
    '"></div>' + // 🟢 fallback namamenu
    '<div class="fg"><label>Satuan</label><input id="fSalesSatuan" class="in" value="' +
    esc(data.satuan || data.SATUAN || "") +
    '"></div>' +
    '<div class="fg"><label>QTY</label><input id="fSalesQty" type="number" class="in" value="' +
    esc(data.qty || data.QTY || 0) +
    '"></div>' +
    '<div class="fg"><label>Amount</label><input id="fSalesAmount" type="number" class="in" value="' +
    esc(data.total || data.TOTAL || 0) +
    '"></div>' +
    '<div class="fg"><label>MA (Masa)</label><input id="fSalesMa" class="in" maxlength="4" placeholder="Contoh: 0825" value="' +
    esc(data.ma || data.MA || data.masa || "") +
    '"></div>';

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveSales(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Sales" : "Tambah Sales", html, foot);
}

async function saveSales(e, id) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fSalesCab").value;
    var group = $("fSalesGroup").value;
    var kode = $("fSalesKode").value.trim();
    var namaMenu = $("fSalesNama").value.trim();
    var satuan = $("fSalesSatuan").value.trim();
    var qty = num($("fSalesQty").value);
    var amount = num($("fSalesAmount").value);
    var ma = $("fSalesMa").value.trim();

    if (!kode || !namaMenu)
      return toast("Kode dan Nama Menu wajib diisi", "err");

    if (id) {
      var r = await db.get("datasales", id);
      if (r) {
        var updated = Object.assign({}, r, {
          kode: kode,
          namaMenu: namaMenu,
          satuan: satuan,
          qty: qty,
          amount: amount,
          ma: ma,
          cabang: cabang,
          group: group,
        });
        await db.put("datasales", updated);
        var idx = DBCache.datasales.findIndex((x) => x.id === id);
        if (idx !== -1) DBCache.datasales[idx] = updated;
      }
    } else {
      var newId = uid();
      var newObj = {
        id: newId,
        kode: kode,
        namaMenu: namaMenu,
        satuan: satuan,
        qty: qty,
        amount: amount,
        ma: ma,
        cabang: cabang,
        group: group,
      };
      await db.add("datasales", newObj);
      DBCache.datasales.push(newObj);
    }

    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel(); // Ini sudah bertindak sebagai "Refresh Tampilan"
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
  }
}
// ==========================================
// 🚀 FUNGSI EXPORT KHUSUS DATA SALES KE XLS
// ==========================================

// ==========================================
// 🚀 EXPORT SALES KE XLS (FORMAT TABEL ASLI)
// ==========================================
function exportSalesToXLS() {
  var rawData = DBCache.datasales || [];
  var data = filterByCabang(rawData);
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) data = data.filter((r) => (r.group || "") === activeGroup);

  if (data.length === 0)
    return toast("Tidak ada data Sales untuk di-export.", "err");

  // 1. Bangun Template HTML Tabel
  var html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sales</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
  <body>
    <table border="1" style="border-collapse:collapse;">
      <thead>
        <tr style="background-color:#2f5496;color:#ffffff;font-weight:bold;">
          <td>Kode</td><td>Nama Menu</td><td>Satuan</td><td>QTY</td><td>Amount</td><td>MA</td><td>Group</td><td>Cabang</td>
        </tr>
      </thead>
      <tbody>`;

  // 2. Masukkan Data Baris per Baris
  data.forEach(function (r) {
    html += `<tr>
      <td style="mso-number-format:'\\@';">${r.kodemenu || r.kode || ""}</td>
      <td>${r.namamenu || r.namaMenu || ""}</td>
      <td>${r.satuan || ""}</td>
      <td style="mso-number-format:'#,##0';">${r.qty || 0}</td>
      <td style="mso-number-format:'#,##0';">${r.amount || r.total || 0}</td>
      <td style="mso-number-format:'\\@';">${r.masa || r.ma || ""}</td>
      <td>${r.group || ""}</td>
      <td>${lookupCabangLabel(r.cabang)}</td>
    </tr>`;
  });

  // 3. Tambahkan Baris TOTAL
  var totalQty = data.reduce((s, r) => s + num(r.qty || 0), 0);
  var totalAmount = data.reduce((s, r) => s + num(r.amount || r.total || 0), 0);

  html += `<tr style="background-color:#d9e2f3;font-weight:bold;">
    <td></td><td>TOTAL</td><td></td>
    <td style="mso-number-format:'#,##0';">${totalQty}</td>
    <td style="mso-number-format:'#,##0';">${totalAmount}</td>
    <td></td><td></td><td></td>
  </tr>`;

  html += `</tbody></table></body></html>`;

  // 4. Trigger Download File
  var blob = new Blob([html], { type: "application/vnd.ms-excel" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download =
    "Laporan_Sales_" + new Date().toISOString().slice(0, 10) + ".xls";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("Berhasil mengunduh file Excel!", "ok");
}

// ==========================================
// 🚀 EXPORT DAFTAR MENU KE XLS (FORMAT TABEL ASLI)
// ==========================================
function exportDaftarMenuToXLS() {
  var rawData = DBCache.daftarmenu || [];
  var data = filterByCabang(rawData);
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) data = data.filter((r) => (r.group || "") === activeGroup);

  if (data.length === 0)
    return toast("Tidak ada data Daftar Menu untuk di-export.", "err");

  // 1. Bangun Template HTML Tabel
  var html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Daftar Menu</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
  <body>
    <table border="1" style="border-collapse:collapse;">
      <thead>
        <tr style="background-color:#2f5496;color:#ffffff;font-weight:bold;">
         <td>Cabang</td><td>Group</td><td>Kode Menu</td><td>Nama Menu</td><td>Satuan/td><td>S.Awal</td><td>Masuk</td><td>Keluar</td><td>S.Akhir</td>
        </tr>
      </thead>
      <tbody>`;

  // 2. Masukkan Data Baris per Baris
  data.forEach(function (r) {
    html += `<tr>
    
      <td>${lookupCabangLabel(r.cabang)}</td>
      <td>${r.group || ""}</td>
      <td style="mso-number-format:'\\@';">${r.kodemenu || ""}</td>
      <td>${r.namamenu || r.namaMenu || ""}</td>
      <td>${r.satuan || r.SATUAN || ""}</td>
      <td style="mso-number-format:'#,##0';">${r.sawal || 0}</td>
      <td style="mso-number-format:'#,##0';">${r.masuk || 0}</td>
      <td style="mso-number-format:'#,##0';">${r.keluar || 0}</td>
      <td style="mso-number-format:'#,##0';">${r.sakhir || 0}</td>
    </tr>`;
  });

  // 3. Tambahkan Baris TOTAL
  html += `<tr style="background-color:#d9e2f3;font-weight:bold;">
  <td></td><td></td><td></td><td>TOTAL</td><td></td>


    <td style="mso-number-format:'#,##0';">${data.reduce((s, r) => s + num(r.sawal || 0), 0)}</td>
    <td style="mso-number-format:'#,##0';">${data.reduce((s, r) => s + num(r.masuk || 0), 0)}</td>
    <td style="mso-number-format:'#,##0';">${data.reduce((s, r) => s + num(r.keluar || 0), 0)}</td>
    <td style="mso-number-format:'#,##0';">${data.reduce((s, r) => s + num(r.sakhir || 0), 0)}</td>
  </tr>`;

  html += `</tbody></table></body></html>`;

  // 4. Trigger Download File
  var blob = new Blob([html], { type: "application/vnd.ms-excel" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download =
    "Laporan_Daftar_Menu_" + new Date().toISOString().slice(0, 10) + ".xls";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("Berhasil mengunduh file Excel!", "ok");
}
PANEL_MAP.daftarmenu = renderDaftarMenu;
var _currentPage = 1; // Variabel global untuk pagination (pastikan tidak bentrok jika ada panel lain)

// ========================================================
// 🌟 FUNGSI BARU: REFRESH DAFTAR MENU
// ========================================================
async function refreshDaftarMenu() {
  try {
    toast("Memperbarui data Daftar Menu...", "inf");
    var baseUrl = window.location.origin + "/api/data/";
    var cabangSaya = localStorage.getItem("cabang") || "";
    var activeGroup = localStorage.getItem("activeGroup") || "TLGA";

    // 🟢 Paksa lowercase agar tidak memicu Error 400 di server
    var cleanCabang = cabangSaya.toLowerCase();

    var queryParams = "";
    if (cleanCabang !== "pusat") {
      queryParams = `?cabang=${cleanCabang}&group=${activeGroup}`;
    } else {
      queryParams = `?cabang=pusat&group=${activeGroup}`;
    }

    var response = await fetch(baseUrl + "daftarmenu" + queryParams); // Sesuaikan endpoint API jika berbeda
    if (!response.ok) throw new Error("Gagal mengambil data dari server");

    var freshData = await response.json();

    // Update cache di memori (Sesuaikan nama cache jika beda, misal: DBCache.daftarmenu)
    DBCache.daftarmenu = freshData;

    if (typeof safeRenderCurrentPanel === "function") {
      safeRenderCurrentPanel();
    }
    toast("Data Daftar Menu berhasil diperbarui!", "ok");
  } catch (err) {
    toast("Error refresh daftar menu: " + err.message, "err");
  }
}

async function renderDaftarMenu() {
  var rawData = DBCache.daftarmenu || [];
  var data = filterByCabang(rawData);

  // --- 1. FILTER GROUP ---
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    data = data.filter(function (r) {
      return (r.group || "") === activeGroup;
    });
  }

  // --- 2. SORTING BERTINGKAT (Cabang -> Group -> Kode Menu) ---
  data.sort(function (a, b) {
    var cabangA = String(a.cabang || ""),
      cabangB = String(b.cabang || "");
    var cCabang = cabangA.localeCompare(cabangB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (cCabang !== 0) return cCabang;

    var groupA = String(a.group || ""),
      groupB = String(b.group || "");
    var cGroup = groupA.localeCompare(groupB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (cGroup !== 0) return cGroup;

    var kodeA = String(a.kodemenu || a.kode || a.KODE || "");
    var kodeB = String(b.kodemenu || b.kode || b.KODE || "");
    return kodeA.localeCompare(kodeB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  // ==========================================
  // 🚀 LOGIKA PAGINATION SEJATI
  // ==========================================
  var totalData = data.length;
  var totalPages = Math.ceil(totalData / _viewLimit) || 1;

  if (_currentPage > totalPages) _currentPage = totalPages;
  if (_currentPage < 1) _currentPage = 1;

  var startIndex = (_currentPage - 1) * _viewLimit;
  var endIndex = startIndex + _viewLimit;
  var dataLimit = data.slice(startIndex, endIndex);

  var showStart = totalData === 0 ? 0 : startIndex + 1;
  var showEnd = Math.min(endIndex, totalData);

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("daftarmenu", ids);

  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });

  // ==========================================
  // 🚀 PEMBUATAN BARIS TABEL (SUDAH DISESUAIKAN: ID & DATA DIHAPUS)
  // ==========================================
  var rows = dataLimit.map(function (r) {
    return [
      lookupCabangLabel(r.cabang), // 0. Cabang
      r.group === "undefined" || !r.group ? "-" : r.group, // 1. Group
      r.kodemenu || r.kode || r.KODE || "-", // 2. Kode Menu
      r.namamenu || r.namaMenu || r.nama_menu || "-", // 3. Nama Menu
      r.satuan || r.Satuan || "-",
      fmtN(r.sawal || r.stok_awal || 0), // 4. Stok Awal
      fmtN(r.masuk || 0), // 5. Masuk
      fmtN(r.keluar || 0), // 6. Keluar
      fmtN(r.sakhir || r.stok_akhir || 0), // 7. Stok Akhir
    ];
  });

  // ==========================================
  // FOOTER TOTAL (SUDAH DISESUAIKAN JUMLAHNYA MENJADI 8 ELEMEN)
  // ==========================================
  var foot = [
    "", // Cabang
    "", // Group
    "TOTAL:", // Kode Menu
    "", // Nama Menu
    "", //Satuan
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.sawal || r.stok_awal);
      }, 0),
    ), // S.Awal
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.masuk);
      }, 0),
    ), // Masuk
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.keluar);
      }, 0),
    ), // Keluar
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.sakhir || r.stok_akhir);
      }, 0),
    ), // S.Akhir
  ];

  // ==========================================
  // HTML PAGINATION
  // ==========================================
  var paginationHTML = "";
  if (totalData > 0) {
    paginationHTML =
      '<div style="display:flex;align-items:center;gap:.7rem;margin-top:.7rem;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="font-size:.8rem;color:var(--muted)">' +
      "Menampilkan <b>" +
      showStart +
      " - " +
      showEnd +
      "</b> dari <b>" +
      totalData +
      "</b> record (Hal. " +
      _currentPage +
      "/" +
      totalPages +
      ")" +
      "</div>" +
      '<div style="display:flex;gap:.4rem;align-items:center">' +
      '<button type="button" class="btn btn-inf" onclick="goToDaftarMenuPage(' +
      (_currentPage - 1) +
      ')" ' +
      (_currentPage <= 1
        ? 'disabled style="opacity:.5;cursor:not-allowed"'
        : "") +
      '><i class="fa-solid fa-arrow-left"></i> Prev</button>' +
      '<button type="button" class="btn btn-inf" onclick="goToDaftarMenuPage(' +
      (_currentPage + 1) +
      ')" ' +
      (_currentPage >= totalPages
        ? 'disabled style="opacity:.5;cursor:not-allowed"'
        : "") +
      '>Next <i class="fa-solid fa-arrow-right"></i></button>' +
      "</div>" +
      "</div>";
  }

  return (
    bulkBarHTML("daftarmenu", "Daftar Menu") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Cabang: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Filter Group: " +
    getGroupFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-inf" onclick="refreshDaftarMenu()" title="Refresh data dari server"><i class="fa-solid fa-rotate"></i> Refresh</button>' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportDaftarMenuToXLS()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'daftarmenu\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'daftarmenu\')"><i class="fa-solid fa-trash-can"></i> Kosongkan</button>' +
    '<button type="button" class="btn btn-a" onclick="formDaftarMenu()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    '<button type="button" class="btn btn-w" style="background-color:#ed7d31;color:#fff;border-color:#ed7d31" onclick="importDaftarMenuFromSales()" title="Ambil data dari tabel Sales"><i class="fa-solid fa-file-import"></i> Import dari Sales</button>' +
    "</div>" +
    "</div>" +
    wrapTable(
      buildTable(
        [
          "Cabang",
          "Group",
          "Kode Menu",
          "Nama Menu",
          "Satuan",
          "S.Awal",
          "Masuk",
          "Keluar",
          "S.Akhir",
        ],
        rows,
        {
          numCols: [5, 6, 7, 8], // 🚀 PERBAIKAN: Index kolom angka disesuaikan karena ID & Data dihapus
          foot: foot,
          bulkStore: "daftarmenu",
          bulkIds: idsLimit,
          actions: function (r, i) {
            return crudActions(dataLimit[i].id, "daftarmenu");
          },
          emptyMsg: "Belum ada data daftar menu",
        },
      ),
    ) +
    paginationHTML
  );
}

// ==========================================
// 🚀 FUNGSI NAVIGASI PAGINATION
// ==========================================
function goToDaftarMenuPage(pageNum) {
  _currentPage = pageNum;
  safeRenderCurrentPanel();
}

function changeDaftarMenuLimit(newLimit) {
  _viewLimit = parseInt(newLimit) || 50;
  _currentPage = 1;
  safeRenderCurrentPanel();
}

// ==========================================
// 🚀 FORM INPUT UNTUK DAFTAR MENU
// ==========================================
function formDaftarMenu(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.daftarmenu || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};

  var html =
    '<div class="fg"><label>Cabang</label><select id="fDmCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts(data.cabang) +
    "</select></div>" +
    '<div class="fg"><label>Group</label><select id="fDmGroup" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getGroupOpts(data.group) +
    "</select></div>" +
    '<div class="fg"><label>Data (Tanggal)</label><input id="fDmData" type="date" class="in" value="' +
    esc(data.data || data.tanggal || "") +
    '"></div>' +
    '<div class="fg"><label>Kode Menu</label><input id="fDmKode" class="in" value="' +
    esc(data.kodemenu || data.kode || "") +
    '"></div>' +
    '<div class="fg"><label>Nama Menu</label><input id="fDmNama" class="in" value="' +
    esc(data.namamenu || data.namaMenu || "") +
    '"></div>' +
    '<div class="fg"><label>Stok Awal</label><input id="fDmSawal" type="number" class="in" value="' +
    esc(data.sawal || data.stok_awal || 0) +
    '"></div>' +
    '<div class="fg"><label>Masuk</label><input id="fDmMasuk" type="number" class="in" value="' +
    esc(data.masuk || 0) +
    '"></div>' +
    '<div class="fg"><label>Keluar</label><input id="fDmKeluar" type="number" class="in" value="' +
    esc(data.keluar || 0) +
    '"></div>' +
    '<div class="fg"><label>Stok Akhir</label><input id="fDmSakhir" type="number" class="in" value="' +
    esc(data.sakhir || data.stok_akhir || 0) +
    '"></div>';

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveDaftarMenu(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Daftar Menu" : "Tambah Daftar Menu", html, foot);
}

async function saveDaftarMenu(e, id) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fDmCab").value;
    var group = $("fDmGroup").value;
    var dataField = $("fDmData").value;
    var kodemenu = $("fDmKode").value.trim();
    var namamenu = $("fDmNama").value.trim();
    var sawal = num($("fDmSawal").value);
    var masuk = num($("fDmMasuk").value);
    var keluar = num($("fDmKeluar").value);
    var sakhir = num($("fDmSakhir").value);

    if (!kodemenu || !namamenu)
      return toast("Kode Menu dan Nama Menu wajib diisi", "err");

    if (id) {
      var r = await db.get("daftarmenu", id);
      if (r) {
        var updated = Object.assign({}, r, {
          cabang: cabang,
          group: group,
          data: dataField,
          kodemenu: kodemenu,
          namamenu: namamenu,
          sawal: sawal,
          masuk: masuk,
          keluar: keluar,
          sakhir: sakhir,
        });
        await db.put("daftarmenu", updated);
        var idx = DBCache.daftarmenu.findIndex((x) => x.id === id);
        if (idx !== -1) DBCache.daftarmenu[idx] = updated;
      }
    } else {
      var newId = uid();
      var newObj = {
        id: newId,
        cabang: cabang,
        group: group,
        data: dataField,
        kodemenu: kodemenu,
        namamenu: namamenu,
        sawal: sawal,
        masuk: masuk,
        keluar: keluar,
        sakhir: sakhir,
      };
      await db.add("daftarmenu", newObj);
      DBCache.daftarmenu.push(newObj);
    }

    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
  }
}

// ==========================================
// 🚀 FUNGSI IMPORT DATA DAFTAR MENU DARI SALES
// ==========================================

async function importDaftarMenuFromSales() {
  var sourceData = DBCache.datasales || [];

  if (sourceData.length === 0) {
    return toast("Data Sales kosong, tidak ada yang bisa di-import.", "err");
  }

  // Tampilkan konfirmasi terlebih dahulu ke user
  var isConfirm = confirm(
    "Import identitas unik dari " +
      sourceData.length +
      " data Sales?\n\n" +
      "Data yang diambil:\n" +
      "- Kode Menu\n" +
      "- Nama Menu\n" +
      "- Cabang\n" +
      "- Group\n\n" +
      "Kolom Stok (Awal, Masuk, Keluar, Akhir) akan diisi 0.",
  );

  if (!isConfirm) return;

  try {
    toast("Sedang memproses import data...", "inf");
    var successCount = 0;
    var duplicateCount = 0;

    for (var i = 0; i < sourceData.length; i++) {
      var sales = sourceData[i];

      // Ambil hanya data unik yang diminta
      var kodemenu = String(
        sales.kodemenu || sales.kode || sales.KODE || "",
      ).trim();
      var namamenu = String(
        sales.namamenu || sales.namaMenu || sales.nama_menu || "",
      ).trim();
      var cabang = sales.cabang || "";
      var group = sales.group || "";

      // Lewati jika kodemenu kosong (karena ini penanda unik utama)
      if (!kodemenu) continue;

      // Cek apakah kombinasi UNIK (Kode + Cabang + Group) sudah ada di Daftar Menu
      var isExist = (DBCache.daftarmenu || []).find(function (dm) {
        return (
          String(dm.kodemenu || dm.kode || "").trim() === kodemenu &&
          dm.cabang === cabang &&
          dm.group === group
        );
      });

      if (isExist) {
        duplicateCount++; // Sudah ada, lewati
        continue;
      }

      // Buat objek Daftar Menu baru
      var newMenuObj = {
        // id: uid(),
        //  data: "", // Dikosongkan, bisa diisi manual nanti
        cabang: cabang,
        group: group,
        kodemenu: kodemenu,
        namamenu: namamenu,
        sawal: 0, // Diisi 0
        masuk: 0, // Diisi 0
        keluar: 0, // Diisi 0
        sakhir: 0, // Diisi 0
      };

      // Simpan ke IndexedDB
      await db.add("daftarmenu", newMenuObj);

      // Masukkan ke Cache agar langsung terlihat tanpa refresh server
      if (!DBCache.daftarmenu) DBCache.daftarmenu = [];
      DBCache.daftarmenu.push(newMenuObj);

      successCount++;
    }

    // Render ulang tampilan langsung
    if (typeof safeRenderCurrentPanel === "function") {
      safeRenderCurrentPanel();
    }

    // Tampilkan notifikasi hasil
    var msg = "Berhasil import " + successCount + " identitas menu baru.";
    if (duplicateCount > 0) {
      msg += " (" + duplicateCount + " data dilewati karena sudah ada).";
    }
    toast(msg, "ok");
  } catch (err) {
    toast("Gagal import dari Sales: " + err.message, "err");
  }
}

PANEL_MAP.salesmenu = renderSalesAndMenu;

// Variabel global pagination terpisah agar tidak saling bentrok saat klik Next/Prev
var _pageSales = 1;
var _pageMenu = 1;

// ========================================================
// 🚀 RENDER GABUNGAN: SALES & DAFTAR MENU SEKALIGUS
// ========================================================
function renderSalesAndMenu() {
  // Kumpulkan data mentah untuk kedua tabel
  var rawSales = DBCache.datasales || [];
  var rawMenu = DBCache.daftarmenu || [];

  var salesData = filterByCabang(rawSales);
  var menuData = filterByCabang(rawMenu);

  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    salesData = salesData.filter((r) => (r.group || "") === activeGroup);
    menuData = menuData.filter((r) => (r.group || "") === activeGroup);
  }

  // Sortir Data Sales (Cabang -> Group -> Masa -> Kode)
  salesData.sort((a, b) => {
    var c = String(a.cabang || "").localeCompare(
      String(b.cabang || ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    );
    if (c !== 0) return c;
    c = String(a.group || "").localeCompare(String(b.group || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (c !== 0) return c;
    c = String(a.masa || a.ma || "").localeCompare(
      String(b.masa || b.ma || ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    );
    if (c !== 0) return c;
    return String(a.kode || "").localeCompare(String(b.kode || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  // Sortir Data Menu (Cabang -> Group -> Kode Menu)
  menuData.sort((a, b) => {
    var c = String(a.cabang || "").localeCompare(
      String(b.cabang || ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    );
    if (c !== 0) return c;
    c = String(a.group || "").localeCompare(String(b.group || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (c !== 0) return c;
    return String(a.kodemenu || "").localeCompare(
      String(b.kodemenu || ""),
      undefined,
      { numeric: true, sensitivity: "base" },
    );
  });

  // Bangun UI Masing-Masing Tabel
  var salesUI = buildSalesTableUI(salesData);
  var menuUI = buildMenuTableUI(menuData);

  // Return Layout Utama (Menggunakan CSS Grid 2 Kolom)
  return (
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.9rem;font-weight:bold;color:var(--txt)">Laporan Gabungan Sales & Daftar Menu</div>' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter: " +
    getCabangFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    getGroupFilterHTML() +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    "</div>" +
    "</div>" +
    // CONTAINER GRID (2 Kolom di PC, 1 Kolom di HP)
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">' +
    // 🔴 KOLOM KIRI: SALES
    '<div style="background:var(--card);padding:1rem;border-radius:8px;border:1px solid var(--brd);min-width:0;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem;flex-wrap:wrap;gap:.5rem">' +
    '<h3 style="margin:0;color:var(--primary)">Tabel Sales</h3>' +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-inf" onclick="refreshSales()"><i class="fa-solid fa-rotate"></i></button>' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportSalesToXLS()"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-a" onclick="formSales()"><i class="fa-solid fa-plus"></i></button>' +
    "</div>" +
    "</div>" +
    salesUI +
    "</div>" +
    // 🔵 KOLOM KANAN: DAFTAR MENU
    '<div style="background:var(--card);padding:1rem;border-radius:8px;border:1px solid var(--brd);min-width:0;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.8rem;flex-wrap:wrap;gap:.5rem">' +
    '<h3 style="margin:0;color:var(--primary)">Tabel Daftar Menu</h3>' +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-inf" onclick="refreshDaftarMenu()"><i class="fa-solid fa-rotate"></i></button>' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportDaftarMenuToXLS()"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-a" onclick="formDaftarMenu()"><i class="fa-solid fa-plus"></i></button>' +
    "</div>" +
    "</div>" +
    menuUI +
    "</div>" +
    // RESPONSIF: Pakai 1 kolom jika layar kurang dari 900px
    '<style>@media(max-width:900px){ div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr !important;} }</style>' +
    "</div>"
  );
}

// ==========================================
// 🛠️ SUB-FUNGSI: BUILDER UI SALES
// ==========================================
function buildSalesTableUI(data) {
  var totalData = data.length;
  var totalPages = Math.ceil(totalData / _viewLimit) || 1;
  if (_pageSales > totalPages) _pageSales = totalPages;
  if (_pageSales < 1) _pageSales = 1;

  var start = (_pageSales - 1) * _viewLimit;
  var end = start + _viewLimit;
  var dataLimit = data.slice(start, end);
  var showStart = totalData === 0 ? 0 : start + 1;
  var showEnd = Math.min(end, totalData);

  var rows = dataLimit.map((r) => [
    r.kodemenu || r.kode || "-",
    r.namamenu || r.namaMenu || "-",
    r.satuan || "-",
    fmtN(r.qty || 0),
    fmtN(r.amount || r.total || 0),
    r.masa || r.ma || "-",
    r.group || "-",
    lookupCabangLabel(r.cabang),
  ]);

  var foot = [
    "",
    "TOTAL:",
    "",
    fmtN(data.reduce((s, r) => s + num(r.qty || 0), 0)),
    fmtN(data.reduce((s, r) => s + num(r.amount || r.total || 0), 0)),
    "",
    "",
    "",
  ];

  var pagHTML =
    totalData > 0
      ? '<div style="display:flex;align-items:center;gap:.5rem;margin-top:.7rem;justify-content:space-between;font-size:.8rem;color:var(--muted)">' +
        "<span><b>" +
        showStart +
        " - " +
        showEnd +
        "</b> dari <b>" +
        totalData +
        "</b> (Hal " +
        _pageSales +
        "/" +
        totalPages +
        ")</span>" +
        '<div style="display:flex;gap:.3rem">' +
        '<button class="btn btn-inf" style="padding:.2rem .5rem;font-size:.75rem" onclick="_pageSales--;safeRenderCurrentPanel()" ' +
        (_pageSales <= 1
          ? 'disabled style="opacity:.5;cursor:not-allowed;padding:.2rem .5rem;font-size:.75rem"'
          : "") +
        '><i class="fa-solid fa-arrow-left"></i></button>' +
        '<button class="btn btn-inf" style="padding:.2rem .5rem;font-size:.75rem" onclick="_pageSales++;safeRenderCurrentPanel()" ' +
        (_pageSales >= totalPages
          ? 'disabled style="opacity:.5;cursor:not-allowed;padding:.2rem .5rem;font-size:.75rem"'
          : "") +
        '><i class="fa-solid fa-arrow-right"></i></button>' +
        "</div>" +
        "</div>"
      : "";

  return (
    wrapTable(
      buildTable(
        ["Kode", "Nama Menu", "Sat", "QTY", "Amount", "MA", "Group", "Cabang"],
        rows,
        {
          numCols: [3, 4],
          foot: foot,
          bulkStore: "datasales",
          bulkIds: dataLimit.map((r) => r.id),
          actions: (r, i) => crudActions(dataLimit[i].id, "datasales"),
          emptyMsg: "Belum ada data sales",
        },
      ),
    ) + pagHTML
  );
}

// ==========================================
// 🛠️ SUB-FUNGSI: BUILDER UI DAFTAR MENU
// ==========================================
function buildMenuTableUI(data) {
  var totalData = data.length;
  var totalPages = Math.ceil(totalData / _viewLimit) || 1;
  if (_pageMenu > totalPages) _pageMenu = totalPages;
  if (_pageMenu < 1) _pageMenu = 1;

  var start = (_pageMenu - 1) * _viewLimit;
  var end = start + _viewLimit;
  var dataLimit = data.slice(start, end);
  var showStart = totalData === 0 ? 0 : start + 1;
  var showEnd = Math.min(end, totalData);

  var rows = dataLimit.map((r) => [
    r.id || "-",
    r.data || r.tanggal || "-",
    lookupCabangLabel(r.cabang),
    r.group || "-",
    r.kodemenu || "-",
    r.namamenu || r.namaMenu || "-",
    fmtN(r.sawal || 0),
    fmtN(r.masuk || 0),
    fmtN(r.keluar || 0),
    fmtN(r.sakhir || 0),
  ]);

  var foot = [
    "",
    "",
    "",
    "",
    "TOTAL:",
    "",
    fmtN(data.reduce((s, r) => s + num(r.sawal || 0), 0)),
    fmtN(data.reduce((s, r) => s + num(r.masuk || 0), 0)),
    fmtN(data.reduce((s, r) => s + num(r.keluar || 0), 0)),
    fmtN(data.reduce((s, r) => s + num(r.sakhir || 0), 0)),
  ];

  var pagHTML =
    totalData > 0
      ? '<div style="display:flex;align-items:center;gap:.5rem;margin-top:.7rem;justify-content:space-between;font-size:.8rem;color:var(--muted)">' +
        "<span><b>" +
        showStart +
        " - " +
        showEnd +
        "</b> dari <b>" +
        totalData +
        "</b> (Hal " +
        _pageMenu +
        "/" +
        totalPages +
        ")</span>" +
        '<div style="display:flex;gap:.3rem">' +
        '<button class="btn btn-inf" style="padding:.2rem .5rem;font-size:.75rem" onclick="_pageMenu--;safeRenderCurrentPanel()" ' +
        (_pageMenu <= 1
          ? 'disabled style="opacity:.5;cursor:not-allowed;padding:.2rem .5rem;font-size:.75rem"'
          : "") +
        '><i class="fa-solid fa-arrow-left"></i></button>' +
        '<button class="btn btn-inf" style="padding:.2rem .5rem;font-size:.75rem" onclick="_pageMenu++;safeRenderCurrentPanel()" ' +
        (_pageMenu >= totalPages
          ? 'disabled style="opacity:.5;cursor:not-allowed;padding:.2rem .5rem;font-size:.75rem"'
          : "") +
        '><i class="fa-solid fa-arrow-right"></i></button>' +
        "</div>" +
        "</div>"
      : "";

  return (
    wrapTable(
      buildTable(
        [
          "ID",
          "Data",
          "Cabang",
          "Group",
          "Kode",
          "Nama Menu",
          "S.Awal",
          "Masuk",
          "Keluar",
          "S.Akhir",
        ],
        rows,
        {
          numCols: [6, 7, 8, 9],
          foot: foot,
          bulkStore: "daftarmenu",
          bulkIds: dataLimit.map((r) => r.id),
          actions: (r, i) => crudActions(dataLimit[i].id, "daftarmenu"),
          emptyMsg: "Belum ada data daftar menu",
        },
      ),
    ) + pagHTML
  );
}
