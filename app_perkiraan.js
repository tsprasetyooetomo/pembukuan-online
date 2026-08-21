/* globals getCabangOpts, lookupCabangLabel, uid, esc, fmtN, num, openModal, closeModal, showConfirm, toast, bulkInit, bulkBarHTML, bulkBarHTMLCustom, bulkGetIds, bulkGetKey, crudActions, wrapTable, buildTable, refreshCache, currentPanel, DBCache, db */
// Letakkan di paling atas file JS
var _activeGroupFilter = "";
var _activeCabangFilter = "";
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
var _golSort = { col: -1, dir: "asc" };
var _golPage = 1;

function sortGol(colIndex) {
  if (_golSort.col === colIndex) {
    _golSort.dir = _golSort.dir === "asc" ? "desc" : "asc";
  } else {
    _golSort.col = colIndex;
    _golSort.dir = "asc";
  }
  _golPage = 1;
  var html = renderGol();
  $("contentArea").innerHTML = '<div class="pnl active">' + html + "</div>";
}

function goToGolPage(page) {
  _golPage = page;

  // Cek apakah aplikasi Anda punya fungsi render panel aktif secara global, contoh:
  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
  } else {
    // Jika manual, pastikan struktur elemen pembungkusnya konsisten
    var html = renderGol();
    var area = $("contentArea");
    if (area) {
      area.innerHTML = '<div class="pnl active">' + html + "</div>";
    }
  }
}

function renderGol() {
  var rawData = DBCache.golongan || [];
  var data = filterByCabang(rawData);

  var activeGroup =
    typeof getActiveGroupFilter === "function" ? getActiveGroupFilter() : "";
  if (activeGroup) {
    data = data.filter(function (r) {
      return (r.group || "") === activeGroup;
    });
  }

  // ==========================================
  // 🔥 SORTING DINAMIS
  // ==========================================
  if (_golSort.col >= 0) {
    var sortCol = _golSort.col;
    var sortDir = _golSort.dir;

    data.sort(function (a, b) {
      var valA, valB;
      switch (sortCol) {
        case 0:
          valA = String(a.gol || "").toLowerCase();
          valB = String(b.gol || "").toLowerCase();
          break;
        case 1:
          valA = String(a.namagol || "").toLowerCase();
          valB = String(b.namagol || "").toLowerCase();
          break;
        case 2:
          valA = +(a.awal || 0);
          valB = +(b.awal || 0);
          break;
        case 3:
          valA = +(a.db || 0);
          valB = +(b.db || 0);
          break;
        case 4:
          valA = +(a.cr || 0);
          valB = +(b.cr || 0);
          break;
        case 5:
          valA = +(a.awal || 0) + +(a.db || 0) - +(a.cr || 0);
          valB = +(b.awal || 0) + +(b.db || 0) - +(b.cr || 0);
          break;
        case 6:
          valA = String(a.group || "").toLowerCase();
          valB = String(b.group || "").toLowerCase();
          break;
        case 7:
          valA = String(a.cabang || "").toLowerCase();
          valB = String(b.cabang || "").toLowerCase();
          break;
        default:
          return 0;
      }
      var result;
      if (typeof valA === "number") {
        result = valA - valB;
      } else {
        result = valA.localeCompare(valB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      return sortDir === "desc" ? -result : result;
    });
  }

  // ==========================================
  // 🚀 PAGINATION
  // ==========================================
  var totalData = data.length;
  var totalPages = Math.ceil(totalData / _viewLimit) || 1;
  if (_golPage > totalPages) _golPage = totalPages;
  if (_golPage < 1) _golPage = 1;

  var startIndex = (_golPage - 1) * _viewLimit;
  var endIndex = startIndex + _viewLimit;
  var dataLimit = data.slice(startIndex, endIndex);

  var showStart = totalData === 0 ? 0 : startIndex + 1;
  var showEnd = Math.min(endIndex, totalData);

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("golongan", ids);

  var idsLimit = dataLimit.map(function (r) {
    return r.id;
  });

  var rows = dataLimit.map(function (r) {
    var ak = num(r.awal) + num(r.db) - num(r.cr);
    return [
      r.gol,
      r.namagol,
      fmtN(r.awal),
      fmtN(r.db),
      fmtN(r.cr),
      '<span class="tag tag-akhir">' + fmtN(ak) + "</span>",
      r.group || "-",
      lookupCabangLabel(r.cabang),
    ];
  });

  var foot = [
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
    "",
  ];

  // ==========================================
  // PAGINATION HTML
  // ==========================================
  var paginationHTML = "";
  if (totalData > 0) {
    paginationHTML =
      '<div style="display:flex;align-items:center;gap:.7rem;margin-top:.7rem;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="font-size:.8rem;color:var(--muted)">Menampilkan <b>' +
      showStart +
      " - " +
      showEnd +
      "</b> dari <b>" +
      totalData +
      "</b> record (Hal. " +
      _golPage +
      "/" +
      totalPages +
      ")</div>" +
      '<div style="display:flex;gap:.4rem;align-items:center">' +
      '<button type="button" class="btn btn-inf" onclick="goToGolPage(' +
      (_golPage - 1) +
      ')" ' +
      (_golPage <= 1 ? 'disabled style="opacity:.5;cursor:not-allowed"' : "") +
      '><i class="fa-solid fa-arrow-left"></i> Prev</button>' +
      '<button type="button" class="btn btn-inf" onclick="goToGolPage(' +
      (_golPage + 1) +
      ')" ' +
      (_golPage >= totalPages
        ? 'disabled style="opacity:.5;cursor:not-allowed"'
        : "") +
      '>Next <i class="fa-solid fa-arrow-right"></i></button>' +
      "</div></div>";
  }

  // ==========================================
  // FILTER INLINE
  // ==========================================
  var listGroup = DBCache.groupproject || [];
  var htmlSelectGroup =
    '<select id="inlineGroupSelect" style="font-size:.72rem;padding:2px 4px;border-radius:4px;border:1px solid var(--brd);background:var(--bg);color:var(--fg);cursor:pointer" onchange="inlineChangeGroup(this.value)">';
  htmlSelectGroup +=
    '<option value=""' +
    (activeGroup === "" ? " selected" : "") +
    ">SEMUA GROUP</option>";
  for (var i = 0; i < listGroup.length; i++) {
    var g = listGroup[i];
    var valG = typeof g === "object" ? g.kode || g.id : g;
    var txtG =
      typeof g === "object"
        ? g.kode && g.nama
          ? g.kode + " - " + g.nama
          : g.nama || g.kode
        : g;
    htmlSelectGroup +=
      '<option value="' +
      valG +
      '"' +
      (activeGroup === valG ? " selected" : "") +
      ">" +
      txtG +
      "</option>";
  }
  htmlSelectGroup += "</select>";

  var activeCabang =
    typeof getActiveCabangFilter === "function" ? getActiveCabangFilter() : "";
  var listCabang = DBCache.cabang || [];
  var htmlSelectCabang =
    '<select id="inlineCabangSelect" class="in" onchange="inlineChangeCabang(this.value)">';
  htmlSelectCabang += '<option value="">-- Pilih Cabang --</option>';
  for (var j = 0; j < listCabang.length; j++) {
    var c = listCabang[j];
    var kodeC = String(c.kode || c.KODE || c.kode_cabang || "").trim();
    var namaC = String(c.nama || c.NAMA || c.nama_cabang || "-").trim();
    var groupC = String(c.group || c.GROUP || c.kode_group || "").trim();
    if (!kodeC) continue;
    if (activeGroup && activeGroup !== groupC) continue;
    htmlSelectCabang +=
      '<option value="' +
      esc(kodeC) +
      '"' +
      (String(activeCabang) === String(kodeC) ? " selected" : "") +
      ">" +
      esc(kodeC + " - " + namaC) +
      "</option>";
  }
  htmlSelectCabang += "</select>";

  // ==========================================
  // 🔥 HEADER SORT + TABLE + CHECKBOX
  // ==========================================
  var headerLabels = [
    "Gol",
    "Nama Golongan",
    "Awal",
    "Debit",
    "Kredit",
    "Akhir",
    "Group",
    "Cabang",
  ];
  var numCols = [2, 3, 4, 5];

  var tableHtml =
    '<table style="width:100%;border-collapse:collapse;"><thead><tr>';

  // ✅ CHECKBOX HEADER
  tableHtml +=
    '<th style="padding:8px;border:1px solid var(--brd);width:35px;text-align:center;">' +
    '<input type="checkbox" onchange="toggleBulkAll(\'golongan\', this.checked)" title="Pilih Semua">' +
    "</th>";

  headerLabels.forEach(function (label, idx) {
    var isActive = _golSort.col === idx;
    var icon = "";
    if (isActive) {
      icon =
        _golSort.dir === "asc"
          ? ' <i class="fa-solid fa-sort-up" style="color:var(--accent);"></i>'
          : ' <i class="fa-solid fa-sort-down" style="color:var(--accent);"></i>';
    } else {
      icon =
        ' <i class="fa-solid fa-sort" style="color:var(--muted);opacity:.4;"></i>';
    }
    var bgStyle = isActive
      ? "background:var(--bg2);color:var(--accent);font-weight:bold;"
      : "";
    tableHtml +=
      '<th style="' +
      bgStyle +
      'padding:8px;border:1px solid var(--brd);white-space:nowrap;cursor:pointer;user-select:none;" onclick="sortGol(' +
      idx +
      ')">' +
      label +
      icon +
      "</th>";
  });
  tableHtml +=
    '<th style="padding:8px;border:1px solid var(--brd);">Aksi</th></tr></thead><tbody>';

  if (rows.length === 0) {
    tableHtml +=
      '<tr><td colspan="' +
      (headerLabels.length + 2) +
      '" style="padding:2rem;text-align:center;color:var(--muted);">Belum ada golongan</td></tr>';
  } else {
    rows.forEach(function (row, i) {
      tableHtml += "<tr>";

      // ✅ CHECKBOX PER BARIS
      tableHtml +=
        '<td style="padding:6px 8px;border:1px solid var(--brd);text-align:center;">' +
        '<input type="checkbox" class="bulk-check" data-store="golongan" data-id="' +
        dataLimit[i].id +
        '">' +
        "</td>";

      row.forEach(function (cell, ci) {
        var align = numCols.includes(ci) ? "text-align:right;" : "";
        tableHtml +=
          '<td style="padding:6px 8px;border:1px solid var(--brd);font-size:.85rem;' +
          align +
          '">' +
          cell +
          "</td>";
      });
      tableHtml +=
        '<td style="padding:6px 8px;border:1px solid var(--brd);">' +
        crudActions(dataLimit[i].id, "golongan") +
        "</td>";
      tableHtml += "</tr>";
    });
  }

  // FOOTER
  tableHtml += '<tr style="background:var(--bg2);font-weight:bold;">';
  tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
  foot.forEach(function (cell, ci) {
    var align = numCols.includes(ci) ? "text-align:right;" : "";
    tableHtml +=
      '<td style="padding:8px;border:1px solid var(--brd);' +
      align +
      '">' +
      cell +
      "</td>";
  });
  tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
  tableHtml += "</tr>";

  tableHtml += "</tbody></table>";

  return (
    bulkBarHTML("golongan", "Golongan") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
    '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
    "Filter Group: " +
    htmlSelectGroup +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Filter Cabang: " +
    htmlSelectCabang +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    " dari " +
    data.length +
    " record" +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'golongan\', \'Data_Golongan\')"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'golongan\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'golongan\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    '<button type="button" class="btn btn-a" onclick="formGol()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div></div>" +
    wrapTable(tableHtml) +
    paginationHTML
  );
}

// --- TAMBAHKAN 2 FUNGSI GLOBAL INI DI BAWAHNYA ---

function inlineChangeGroup(val) {
  if (typeof setActiveGroupFilter === "function") setActiveGroupFilter(val);
  if (typeof setActiveCabangFilter === "function") setActiveCabangFilter(""); // Reset cabang saat group ganti

  // Refresh dropdown cabang langsung tanpa render ulang seluruh halaman (lebih cepat)
  var cabSelect = document.getElementById("inlineCabangSelect");
  if (cabSelect) {
    var listCabang = DBCache.cabang || [];
    var html = '<option value="">-- Pilih Cabang --</option>';
    for (var j = 0; j < listCabang.length; j++) {
      var c = listCabang[j];
      var kodeC = String(c.kode || c.KODE || c.kode_cabang || "").trim();
      var namaC = String(c.nama || c.NAMA || c.nama_cabang || "-").trim();
      var groupC = String(c.group || c.GROUP || c.kode_group || "").trim();
      if (!kodeC) continue;
      if (val && val !== groupC) continue;
      html +=
        '<option value="' +
        esc(kodeC) +
        '">' +
        esc(kodeC + " - " + namaC) +
        "</option>";
    }
    cabSelect.innerHTML = html;
  }

  safeRenderCurrentPanel(); // Render tabelnya
}

function inlineChangeCabang(val) {
  if (typeof setActiveCabangFilter === "function") setActiveCabangFilter(val);
  safeRenderCurrentPanel(); // Render tabelnya
}

function formGol(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.golongan || []).find(function (d) {
        return String(d.id) === String(id);
      }) || {}
    : {};

  var cabangVal = data.cabang || data.CABANG || data.kode_cabang || "";
  var groupVal = data.group || data.GROUP || "";
  var golVal = data.gol || data.GOL || "";
  var namaGolVal = data.namagol || data.NAMAGOL || data.nama_gol || "";
  var awalVal = data.awal !== undefined ? data.awal : data.AWAL || 0;

  var html =
    '<div class="fg"><label>Cabang</label><select id="fGolCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts(cabangVal) +
    "</select></div>" +
    '<div class="fg"><label>Group</label><select id="fGolGroup" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getGroupOpts(groupVal || "") +
    "</select></div>" +
    '<div class="fg"><label>Kode Golongan</label><input id="fGolKode" class="in" value="' +
    esc(golVal) +
    '"></div>' +
    '<div class="fg"><label>Nama Golongan</label><input id="fGolNama" class="in" value="' +
    esc(namaGolVal) +
    '"></div>' +
    // PERBAIKAN: esc() dihilangkan dari type="number" agar tidak error di browser
    '<div class="fg"><label>Saldo Awal</label><input id="fGolAwal" type="number" class="in" value="' +
    awalVal +
    '"></div>';

  // PERBAIKAN: Tambahkan tag <form> agar e.preventDefault() di saveGol bekerja sempurna
  var foot =
    "<form onsubmit=\"saveGol(event, '" +
    (id || "") +
    "')\">" +
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="submit" class="btn btn-a">' + // Diubah jadi type="submit"
    (isEdit ? "Update" : "Simpan") +
    "</button>" +
    "</form>";

  openModal(isEdit ? "Edit Golongan" : "Tambah Golongan", html, foot);
}

async function saveGol(e, id) {
  // Ini sekarang berguna karena ada <form onsubmit> di atas
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fGolCab").value;
    var group = $("fGolGroup").value;
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
          group: group,
        });
        await db.put("golongan", updated);

        var idx = DBCache.golongan.findIndex((x) => x.id === id);
        if (idx !== -1) DBCache.golongan[idx] = updated;
      }
    } else {
      let newId = uid(); // PERBAIKAN: pakai let agar tidak keluar scope else
      let newObj = {
        // PERBAIKAN: pakai let
        id: newId,
        gol: gol,
        namaGol: namaGol,
        awal: awal,
        db: 0,
        cr: 0,
        cabang: cabang,
        group: group,
      };
      await db.add("golongan", newObj);
      DBCache.golongan.push(newObj);
    }

    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
  }
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

function getCabangOpts2(selectedId, filterGroup) {
  var cabangs = DBCache.cabang || [];

  // PELACAK 2: Pastikan DBCache.cabang isinya apa
  console.log(">>> getCabangOpts2 jalan. Jumlah data cabang:", cabangs.length);

  var html = '<option value="">-- Pilih Cabang --</option>';

  cabangs.forEach(function (c) {
    var kode = String(c.kode || c.KODE || c.kode_cabang || "").trim();
    var nama = String(c.nama || c.NAMA || c.nama_cabang || "-").trim();
    var groupCabang = String(c.group || c.GROUP || c.kode_group || "").trim();

    // PELACAK 3: Cek isi per cabang
    console.log(
      "Cabang:",
      nama,
      "| Group di DB:",
      groupCabang,
      "| Filter:",
      filterGroup,
    );

    if (!kode) return;

    if (filterGroup && String(filterGroup).trim() !== groupCabang) {
      return;
    }

    var label = kode + " - " + nama;
    var isSelected =
      String(selectedId || "") === String(kode) ? " selected" : "";

    html +=
      '<option value="' +
      esc(kode) +
      '"' +
      isSelected +
      ">" +
      esc(label) +
      "</option>";
  });

  return html;
}

/* ---------- No Perkiraan ---------- */
PANEL_MAP.perk = renderPerk;
var _perkSort = { col: -1, dir: "asc" };
var _perkPage = 1;

function sortPerk(colIndex) {
  if (_perkSort.col === colIndex) {
    _perkSort.dir = _perkSort.dir === "asc" ? "desc" : "asc";
  } else {
    _perkSort.col = colIndex;
    _perkSort.dir = "asc";
  }
  _perkPage = 1;
  var html = renderPerk();
  $("contentArea").innerHTML = '<div class="pnl active">' + html + "</div>";
}

function goToPerkPage(page) {
  _perkPage = page;

  // Cek apakah aplikasi Anda punya fungsi render panel aktif secara global, contoh:
  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
  } else {
    // Jika manual, pastikan struktur elemen pembungkusnya konsisten
    var html = renderPerk();
    var area = $("contentArea");
    if (area) {
      area.innerHTML = '<div class="pnl active">' + html + "</div>";
    }
  }
}

function renderPerk() {
  var rawData = DBCache.perkiraan || [];

  // Bungkus data dengan original index agar pemetaan aman
  var rawDataWithIndex = rawData.map(function (r, idx) {
    return { item: r, originalIndex: idx + 1 };
  });

  // Filter Cabang
  var dataFiltered = rawDataWithIndex.filter(function (obj) {
    return filterByCabang([obj.item]).length > 0;
  });

  // Filter Group
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    dataFiltered = dataFiltered.filter(function (obj) {
      return (obj.item.group || "") === activeGroup;
    });
  }

  // ==========================================
  // 🔥 SORTING DINAMIS
  // ==========================================
  if (_perkSort.col >= 0) {
    var sortCol = _perkSort.col;
    var sortDir = _perkSort.dir;

    dataFiltered.sort(function (aObj, bObj) {
      var a = aObj.item,
        b = bObj.item;
      var valA, valB;

      switch (sortCol) {
        case 0:
          valA = String(a.gol || "").toLowerCase();
          valB = String(b.gol || "").toLowerCase();
          break;
        case 1:
          valA = String(a.noper || "").toLowerCase();
          valB = String(b.noper || "").toLowerCase();
          break;
        case 2:
          valA = String(a.penjelasan || "").toLowerCase();
          valB = String(b.penjelasan || "").toLowerCase();
          break;
        case 3:
          valA = +(a.awal || 0);
          valB = +(b.awal || 0);
          break;
        case 4:
          valA = +(a.db || 0);
          valB = +(b.db || 0);
          break;
        case 5:
          valA = +(a.cr || 0);
          valB = +(b.cr || 0);
          break;
        case 6:
          valA = +(a.awal || 0) + +(a.db || 0) - +(a.cr || 0);
          valB = +(b.awal || 0) + +(b.db || 0) - +(b.cr || 0);
          break;
        case 7:
          valA = String(a.group || "").toLowerCase();
          valB = String(b.group || "").toLowerCase();
          break;
        case 8:
          valA = String(a.cabang || "").toLowerCase();
          valB = String(b.cabang || "").toLowerCase();
          break;
        default:
          return 0;
      }

      var result;
      if (typeof valA === "number") {
        result = valA - valB;
      } else {
        result = valA.localeCompare(valB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      return sortDir === "desc" ? -result : result;
    });
  }

  var data = dataFiltered.map(function (obj) {
    return obj.item;
  });

  // ==========================================
  // 🚀 PAGINATION
  // ==========================================
  var totalData = data.length;
  var totalPages = Math.ceil(totalData / _viewLimit) || 1;

  if (_perkPage > totalPages) {
    _perkPage = totalPages;
  }
  if (_perkPage < 1) {
    _perkPage = 1;
  }

  var startIndex = (_perkPage - 1) * _viewLimit;
  var endIndex = startIndex + _viewLimit;
  var dataLimitMapped = dataFiltered.slice(startIndex, endIndex);

  var showStart = totalData === 0 ? 0 : startIndex + 1;
  var showEnd = Math.min(endIndex, totalData);

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("perkiraan", ids);

  var idsLimit = dataLimitMapped.map(function (obj) {
    return obj.item.id;
  });

  var rows = dataLimitMapped.map(function (obj) {
    var r = obj.item;
    var ak = num(r.awal) + num(r.db) - num(r.cr);
    return [
      r.gol,
      r.noper,
      r.penjelasan,
      fmtN(r.awal),
      fmtN(r.db),
      fmtN(r.cr),
      '<span class="tag tag-akhir">' + fmtN(ak) + "</span>",
      r.group || "-",
      lookupCabangLabel(r.cabang),
    ];
  });

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
    "",
  ];

  var paginationHTML = "";
  if (totalData > 0) {
    paginationHTML =
      '<div style="display:flex;align-items:center;gap:.7rem;margin-top:.7rem;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="font-size:.8rem;color:var(--muted)">Menampilkan <b>' +
      showStart +
      " - " +
      showEnd +
      "</b> dari <b>" +
      totalData +
      "</b> record (Hal. " +
      _perkPage +
      "/" +
      totalPages +
      ")</div>" +
      '<div style="display:flex;gap:.4rem;align-items:center">' +
      '<button type="button" class="btn btn-inf" onclick="goToPerkPage(' +
      (_perkPage - 1) +
      ')" ' +
      (_perkPage <= 1 ? 'disabled style="opacity:.5;cursor:not-allowed"' : "") +
      '><i class="fa-solid fa-arrow-left"></i> Prev</button>' +
      '<button type="button" class="btn btn-inf" onclick="goToPerkPage(' +
      (_perkPage + 1) +
      ')" ' +
      (_perkPage >= totalPages
        ? 'disabled style="opacity:.5;cursor:not-allowed"'
        : "") +
      '>Next <i class="fa-solid fa-arrow-right"></i></button>' +
      "</div></div>";
  }

  // ==========================================
  // 🔥 HEADER SORT + TABLE + CHECKBOX
  // ==========================================
  var headerLabels = [
    "Gol",
    "No Perkiraan",
    "Deskripsi",
    "Awal",
    "Debit",
    "Kredit",
    "Akhir",
    "Group",
    "Cabang",
  ];
  var numCols = [3, 4, 5, 6];

  var tableHtml =
    '<table style="width:100%;border-collapse:collapse;"><thead><tr>';

  // ✅ Checkbox Header (Select All)
  tableHtml +=
    '<th style="padding:8px;border:1px solid var(--brd);width:35px;text-align:center;">' +
    '<input type="checkbox" onchange="toggleBulkAll(\'perkiraan\', this.checked)" title="Pilih Semua">' +
    "</th>";

  headerLabels.forEach(function (label, idx) {
    var isActive = _perkSort.col === idx;
    var icon = "";
    if (isActive) {
      icon =
        _perkSort.dir === "asc"
          ? ' <i class="fa-solid fa-sort-up" style="color:var(--accent);"></i>'
          : ' <i class="fa-solid fa-sort-down" style="color:var(--accent);"></i>';
    } else {
      icon =
        ' <i class="fa-solid fa-sort" style="color:var(--muted);opacity:.4;"></i>';
    }
    var bgStyle = isActive
      ? "background:var(--bg2);color:var(--accent);font-weight:bold;"
      : "";
    tableHtml +=
      '<th style="' +
      bgStyle +
      'padding:8px;border:1px solid var(--brd);white-space:nowrap;cursor:pointer;user-select:none;" onclick="sortPerk(' +
      idx +
      ')">' +
      label +
      icon +
      "</th>";
  });
  tableHtml +=
    '<th style="padding:8px;border:1px solid var(--brd);">Aksi</th></tr></thead><tbody>';

  if (rows.length === 0) {
    tableHtml +=
      '<tr><td colspan="' +
      (headerLabels.length + 2) +
      '" style="padding:2rem;text-align:center;color:var(--muted);">Belum ada perkiraan</td></tr>';
  } else {
    rows.forEach(function (row, i) {
      tableHtml += "<tr>";

      // ✅ Checkbox per baris
      tableHtml +=
        '<td style="padding:6px 8px;border:1px solid var(--brd);text-align:center;">' +
        '<input type="checkbox" class="bulk-check" data-store="perkiraan" data-id="' +
        dataLimitMapped[i].item.id +
        '">' +
        "</td>";

      row.forEach(function (cell, ci) {
        var align = numCols.includes(ci) ? "text-align:right;" : "";
        tableHtml +=
          '<td style="padding:6px 8px;border:1px solid var(--brd);font-size:.85rem;' +
          align +
          '">' +
          cell +
          "</td>";
      });
      tableHtml +=
        '<td style="padding:6px 8px;border:1px solid var(--brd);">' +
        crudActions(dataLimitMapped[i].item.id, "perkiraan") +
        "</td>";
      tableHtml += "</tr>";
    });
  }

  // Footer Row
  tableHtml += '<tr style="background:var(--bg2);font-weight:bold;">';
  tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>'; // Kosong untuk checkbox footer
  foot.forEach(function (cell, ci) {
    var align = numCols.includes(ci) ? "text-align:right;" : "";
    tableHtml +=
      '<td style="padding:8px;border:1px solid var(--brd);' +
      align +
      '">' +
      cell +
      "</td>";
  });
  tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
  tableHtml += "</tr>";

  tableHtml += "</tbody></table>";

  return (
    bulkBarHTML("perkiraan", "Perkiraan") +
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
    " dari " +
    data.length +
    " record" +
    "</div>" +
    '<div style="display:flex;gap:.4rem">' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'perkiraan\', \'Data_Perkiraan\')"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'perkiraan\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'perkiraan\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    '<button type="button" class="btn btn-a" onclick="formPerk()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div></div>" +
    wrapTable(tableHtml) +
    paginationHTML
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
    esc(data.noper || "") +
    '"></div>' +
    '<div class="fg"><label>Deskripsi</label><input id="fPerkDesc" class="in" value="' +
    esc(data.penjelasan || "") +
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
          noper: noPerk,
          penjelasan: desc,
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
        noper: noPerk,
        penjelasan: desc,
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
if (typeof _currentPageKodeBank === "undefined") var _currentPageKodeBank = 1;
var _kodeBankSort = { col: -1, dir: "asc" };

// --- 1. FUNGSI SORTING HEADER TABEL KODE BANK ---
function sortKodeBank(colIndex) {
  if (_kodeBankSort.col === colIndex) {
    _kodeBankSort.dir = _kodeBankSort.dir === "asc" ? "desc" : "asc";
  } else {
    _kodeBankSort.col = colIndex;
    _kodeBankSort.dir = "asc";
  }
  _currentPageKodeBank = 1;

  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
  } else {
    renderKodeBank().then(function (html) {
      var area =
        document.getElementById("contentArea") ||
        document.querySelector(".pnl.active");
      if (area) area.innerHTML = '<div class="pnl active">' + html + "</div>";
    });
  }
}

// --- 2. FUNGSI UTAMA RENDER KODE BANK ---
async function renderKodeBank() {
  try {
    var rawData = DBCache.kodeBank || [];

    // --- FILTER (CABANG & GROUP) ---
    var data = filterByCabang(rawData);
    var activeGroup = getActiveGroupFilter();

    if (activeGroup) {
      data = data.filter(function (r) {
        return (r.group || "") === activeGroup;
      });
    }

    // Bungkus dengan index asli agar pemetaan aman saat di-sort
    var dataWithIndex = data.map(function (r, idx) {
      return { item: r, originalIndex: idx + 1 };
    });

    // --- SORTING DINAMIS ---
    if (_kodeBankSort.col >= 0) {
      var sortCol = _kodeBankSort.col;
      var sortDir = _kodeBankSort.dir;

      dataWithIndex.sort(function (aObj, bObj) {
        var a = aObj.item,
          b = bObj.item;
        var valA, valB;

        function countRefSort(kode) {
          var tc = 0;
          (DBCache.transaksi || []).forEach(function (t) {
            if (t.kodeBank === kode) tc++;
          });
          return tc;
        }

        switch (sortCol) {
          case 0:
            valA = String(a.kode || "").toLowerCase();
            valB = String(b.kode || "").toLowerCase();
            break;
          case 1:
            valA = String(a.desc || "").toLowerCase();
            valB = String(b.desc || "").toLowerCase();
            break;
          case 2:
            valA = String(a.noper || "").toLowerCase();
            valB = String(b.noper || "").toLowerCase();
            break;
          case 3:
            valA = countRefSort(a.kode || a.kodebank);
            valB = countRefSort(b.kode || b.kodebank);
            break;
          case 4:
            valA = String(a.group || "").toLowerCase();
            valB = String(b.group || "").toLowerCase();
            break;
          case 5:
            valA = String(lookupCabangLabel(a.cabang) || "").toLowerCase();
            valB = String(lookupCabangLabel(b.cabang) || "").toLowerCase();
            break;
          default:
            return 0;
        }

        var result;
        if (typeof valA === "number") {
          result = valA - valB;
        } else {
          result = valA.localeCompare(valB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
        return sortDir === "desc" ? -result : result;
      });
    }

    var sortedData = dataWithIndex.map(function (obj) {
      return obj.item;
    });

    var allIds = sortedData.map(function (r) {
      return r.id;
    });
    bulkInit("kodeBank", allIds);

    // --- LOGIKA PAGINATION ---
    var limit =
      typeof _viewLimit !== "undefined" && _viewLimit ? num(_viewLimit) : 50;
    var totalRecords = sortedData.length;
    var totalPages = Math.ceil(totalRecords / limit) || 1;

    if (_currentPageKodeBank > totalPages) _currentPageKodeBank = totalPages;
    if (_currentPageKodeBank < 1) _currentPageKodeBank = 1;

    var startIndex = (_currentPageKodeBank - 1) * limit;
    var endIndex = startIndex + limit;

    var dataLimitMapped = dataWithIndex.slice(startIndex, endIndex);
    var dataLimit = dataLimitMapped.map(function (obj) {
      return obj.item;
    });
    var idsLimit = dataLimit.map(function (r) {
      return r.id;
    });

    var showStart = totalRecords === 0 ? 0 : startIndex + 1;
    var showEnd = Math.min(endIndex, totalRecords);

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

    // --- RENDER BARIS ---
    var rows = dataLimit.map(function (r) {
      return [
        r.kode,
        r.desc || "-",
        lookupPerk(r.noper),
        '<span style="color:var(--success)">' +
          countRef(r.kode || r.kodebank) +
          "</span>",
        r.group || "-",
        lookupCabangLabel(r.cabang),
      ];
    });

    // --- FOOTER (TOTAL) ---
    var totalTrans = sortedData.reduce(function (s, r) {
      return s + countRef(r.kode || r.kodebank);
    }, 0);

    var foot = [
      sortedData.length + " kode",
      "-",
      "-",
      '<span style="color:var(--success)">' + totalTrans + "</span>",
      "-",
      "-",
    ];

    // --- PEMBUATAN HEADER TABEL MANUAL DENGAN SORT & CHECKBOX ---
    var headerLabels = [
      "Kode Bank/Kas",
      "Penjelasan",
      "No Perkiraan",
      "Jml Transaksi",
      "Group",
      "Cabang",
    ];
    var numCols = [3]; // Kolom jumlah transaksi rata kanan

    var tableHtml =
      '<table style="width:100%;border-collapse:collapse;"><thead><tr>';

    // Checkbox Header (Select All)
    tableHtml +=
      '<th style="padding:8px;border:1px solid var(--brd);width:35px;text-align:center;">' +
      '<input type="checkbox" onchange="toggleBulkAll(\'kodeBank\', this.checked)" title="Pilih Semua">' +
      "</th>";

    headerLabels.forEach(function (label, idx) {
      var isActive = _kodeBankSort.col === idx;
      var icon = "";
      if (isActive) {
        icon =
          _kodeBankSort.dir === "asc"
            ? ' <i class="fa-solid fa-sort-up" style="color:var(--accent);"></i>'
            : ' <i class="fa-solid fa-sort-down" style="color:var(--accent);"></i>';
      } else {
        icon =
          ' <i class="fa-solid fa-sort" style="color:var(--muted);opacity:.4;"></i>';
      }
      var bgStyle = isActive
        ? "background:var(--bg2);color:var(--accent);font-weight:bold;"
        : "";

      tableHtml +=
        '<th style="' +
        bgStyle +
        'padding:8px;border:1px solid var(--brd);white-space:nowrap;cursor:pointer;user-select:none;" onclick="sortKodeBank(' +
        idx +
        ')">' +
        label +
        icon +
        "</th>";
    });
    tableHtml +=
      '<th style="padding:8px;border:1px solid var(--brd);">Aksi</th></tr></thead><tbody>';

    if (rows.length === 0) {
      tableHtml +=
        '<tr><td colspan="' +
        (headerLabels.length + 2) +
        '" style="padding:2rem;text-align:center;color:var(--muted);">Belum ada kode bank/kas</td></tr>';
    } else {
      rows.forEach(function (row, i) {
        tableHtml += "<tr>";

        // Checkbox per baris
        tableHtml +=
          '<td style="padding:6px 8px;border:1px solid var(--brd);text-align:center;">' +
          '<input type="checkbox" class="bulk-check" data-store="kodeBank" data-id="' +
          dataLimit[i].id +
          '">' +
          "</td>";

        row.forEach(function (cell, ci) {
          var align = numCols.includes(ci) ? "text-align:right;" : "";
          tableHtml +=
            '<td style="padding:6px 8px;border:1px solid var(--brd);font-size:.85rem;' +
            align +
            '">' +
            cell +
            "</td>";
        });

        tableHtml +=
          '<td style="padding:6px 8px;border:1px solid var(--brd);">' +
          crudActions(dataLimit[i].id, "kodeBank") +
          "</td>";
        tableHtml += "</tr>";
      });
    }

    // Baris Footer Total
    tableHtml += '<tr style="background:var(--bg2);font-weight:bold;">';
    tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
    foot.forEach(function (cell, ci) {
      var align = numCols.includes(ci) ? "text-align:right;" : "";
      tableHtml +=
        '<td style="padding:8px;border:1px solid var(--brd);' +
        align +
        '">' +
        cell +
        "</td>";
    });
    tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
    tableHtml += "</tr></tbody></table>";

    // --- PAGINATION HTML ---
    var paginationHTML = "";
    if (totalRecords > 0) {
      paginationHTML =
        '<div style="display:flex;align-items:center;gap:.7rem;margin-top:.7rem;justify-content:space-between;flex-wrap:wrap">' +
        '<div style="font-size:.8rem;color:var(--muted)">Menampilkan <b>' +
        showStart +
        " - " +
        showEnd +
        "</b> dari <b>" +
        totalRecords +
        "</b> record (Hal. " +
        _currentPageKodeBank +
        "/" +
        totalPages +
        ")</div>" +
        '<div style="display:flex;gap:.4rem;align-items:center">' +
        '<button type="button" class="btn btn-inf" onclick="changePageKodeBank(' +
        (_currentPageKodeBank - 1) +
        ')" ' +
        (_currentPageKodeBank <= 1
          ? 'disabled style="opacity:.5;cursor:not-allowed"'
          : "") +
        '><i class="fa-solid fa-arrow-left"></i> Prev</button>' +
        '<button type="button" class="btn btn-inf" onclick="changePageKodeBank(' +
        (_currentPageKodeBank + 1) +
        ')" ' +
        (_currentPageKodeBank >= totalPages
          ? 'disabled style="opacity:.5;cursor:not-allowed"'
          : "") +
        '>Next <i class="fa-solid fa-arrow-right"></i></button>' +
        "</div></div>";
    }

    // --- 5. RETURN HTML ---
    return (
      bulkBarHTML("kodeBank", "kodeBank") +
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
      " dari " +
      totalRecords +
      " record" +
      "</div>" +
      '<div style="display:flex;gap:.4rem">' +
      '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'kodeBank\', \'Data_KodeBank\')" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
      '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'kodeBank\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
      '<button type="button" class="btn btn-r" onclick="clearAllData(\'kodeBank\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
      '<button type="button" class="btn btn-a" onclick="formKodeBank()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
      "</div></div>" +
      wrapTable(tableHtml) +
      paginationHTML
    );
  } catch (error) {
    console.error("CRASH PADA RENDER KODE BANK:", error);
    return (
      '<div style="color:red;padding:1rem;">Gagal memuat tabel: ' +
      error.message +
      "</div>"
    );
  }
}

// --- 3. FUNGSI UNTUK PINDAH HALAMAN KODE BANK ---
function changePageKodeBank(targetPage) {
  _currentPageKodeBank = targetPage;

  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
    return;
  }

  var appContainer = null;
  var possibleIds = [
    "main-content",
    "app-content",
    "content-area",
    "page-content",
    "view-content",
    "contentArea",
  ];

  for (var i = 0; i < possibleIds.length; i++) {
    var el = document.getElementById(possibleIds[i]);
    if (el && el.innerHTML.indexOf("kodeBank") !== -1) {
      appContainer = el;
      break;
    }
  }

  if (!appContainer) {
    var allDivs = document.getElementsByTagName("div");
    for (var j = 0; j < allDivs.length; j++) {
      if (
        allDivs[j].innerHTML.indexOf("kodeBank") !== -1 &&
        allDivs[j].children.length > 3
      ) {
        appContainer = allDivs[j];
        break;
      }
    }
  }

  if (appContainer) {
    renderKodeBank().then(function (html) {
      appContainer.innerHTML = '<div class="pnl active">' + html + "</div>";
    });
  } else {
    console.error(
      "Tidak bisa menemukan container untuk merender halaman kode bank.",
    );
  }
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
    esc(data.kode || "") +
    '"></div>' +
    '<div class="fg"><label>Penjelasan</label><input id="fKbPenjelasan" class="in" value="' +
    esc(data.desc || "") +
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
          kode: kodebank,
          desc: penjelasan,
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
        kode: kodebank,
        desc: penjelasan,
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
    datasales: "Data Sales",
    daftarmenu: "Daftar Menu",
    saldopembukuan: "Saldo Pembukuan",
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
      r.kode || r.KODE || "-", // Mengambil properti 'kode'
      r.nama || r.NAMA || "-", // Mengambil properti 'nama'
      r.group || r.GROUP || "-", // Mengambil properti 'group'
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

  // Cari data berdasarkan ID (dipaksa String agar aman)
  var data = isEdit
    ? (DBCache.cabang || []).find(function (d) {
        return String(d.id) === String(id);
      }) || {}
    : {};

  // ✅ PERBAIKAN SUPER PENTING: Jika kode/nama kosong di level luar, ambil dari dalam kolom 'data'
  if ((!data.kode || !data.nama) && data.data) {
    try {
      var parsedData = JSON.parse(data.data);
      // Gabungkan hasil pecahan ke dalam variabel data
      data = Object.assign({}, data, parsedData);
    } catch (e) {
      console.error("Gagal parse data cabang:", e);
    }
  }

  var html =
    '<div class="fg"><label>Group</label><select id="fCabGroup" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getGroupOpts(data.group || "") +
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
// Pastikan variabel global untuk penampung sort sales sudah ada
if (typeof _salesSort === "undefined") var _salesSort = { col: -1, dir: "asc" };

// --- 1. FUNGSI SORTING HEADER SALES ---
function sortSales(colIndex) {
  if (_salesSort.col === colIndex) {
    _salesSort.dir = _salesSort.dir === "asc" ? "desc" : "asc";
  } else {
    _salesSort.col = colIndex;
    _salesSort.dir = "asc";
  }
  _currentPage = 1;

  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
  } else {
    renderSales().then(function (html) {
      var area =
        document.getElementById("contentArea") ||
        document.querySelector(".pnl.active");
      if (area) area.innerHTML = '<div class="pnl active">' + html + "</div>";
    });
  }
}

// --- 2. FUNGSI UTAMA RENDER SALES ---
async function renderSales() {
  var rawData = DBCache.datasales || [];

  // Bungkus data dengan original index dan pastikan properti fisik 'kodebersama' ada
  var rawDataWithIndex = rawData.map(function (r, idx) {
    // 🔥 Inisialisasi fisik properti jika belum ada di objek data asli
    if (typeof r.kodebersama === "undefined") {
      r.kodebersama = r.kode_bersama || r.KODEBERSAMA || "";
    }
    return { item: r, originalIndex: idx + 1 };
  });

  // Filter Cabang
  var dataFiltered = rawDataWithIndex.filter(function (obj) {
    return filterByCabang([obj.item]).length > 0;
  });

  // Filter Group
  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    dataFiltered = dataFiltered.filter(function (obj) {
      return (obj.item.group || "") === activeGroup;
    });
  }

  // Filter Noper
  var noperSelect = document.getElementById("filterNoper");
  var activeNoper = noperSelect ? noperSelect.value : "";

  if (activeNoper === "blank") {
    dataFiltered = dataFiltered.filter(function (obj) {
      var noper = String(
        obj.item.noper || obj.item.no_per || obj.item.NOPER || "",
      ).trim();
      return noper === "" || noper === "-";
    });
  } else if (activeNoper !== "") {
    dataFiltered = dataFiltered.filter(function (obj) {
      var noper = String(
        obj.item.noper || obj.item.no_per || obj.item.NOPER || "",
      ).trim();
      return noper.toUpperCase() === activeNoper.toUpperCase();
    });
  }

  // ==========================================
  // 🔥 SORTING DINAMIS
  // ==========================================
  if (_salesSort.col >= 0) {
    var sortCol = _salesSort.col;
    var sortDir = _salesSort.dir;

    dataFiltered.sort(function (aObj, bObj) {
      var a = aObj.item,
        b = bObj.item;
      var valA, valB;

      switch (sortCol) {
        case 0: // No. Per
          valA = String(a.noper || a.no_per || a.NOPER || "").toLowerCase();
          valB = String(b.noper || b.no_per || b.NOPER || "").toLowerCase();
          break;
        case 1: // Kode Menu
          valA = String(a.kodemenu || a.kode || a.KODE || "").toLowerCase();
          valB = String(b.kodemenu || b.kode || b.KODE || "").toLowerCase();
          break;
        case 2: // Nama Menu
          valA = String(
            a.namamenu || a.namaMenu || a.nama_menu || a.NAMAMENU || "",
          ).toLowerCase();
          valB = String(
            b.namamenu || b.namaMenu || b.nama_menu || b.NAMAMENU || "",
          ).toLowerCase();
          break;
        case 3: // Kode Bersama (Fisik)
          valA = String(a.kodebersama || "").toLowerCase();
          valB = String(b.kodebersama || "").toLowerCase();
          break;
        case 4: // Satuan
          valA = String(a.satuan || a.SATUAN || "").toLowerCase();
          valB = String(b.satuan || b.SATUAN || "").toLowerCase();
          break;
        case 5: // QTY
          valA = +(a.qty || a.QTY || 0);
          valB = +(b.qty || b.QTY || 0);
          break;
        case 6: // Amount
          valA = +(a.amount || a.AMOUNT || a.total || 0);
          valB = +(b.amount || b.AMOUNT || b.total || 0);
          break;
        case 7: // MA (Masa)
          valA = String(a.masa || a.ma || a.MA || "").toLowerCase();
          valB = String(b.masa || b.ma || b.MA || "").toLowerCase();
          break;
        case 8: // Group
          valA = String(a.group || "").toLowerCase();
          valB = String(b.group || "").toLowerCase();
          break;
        case 9: // Cabang
          valA = String(a.cabang || "").toLowerCase();
          valB = String(b.cabang || "").toLowerCase();
          break;
        default:
          return 0;
      }

      var result;
      if (typeof valA === "number") {
        result = valA - valB;
      } else {
        result = valA.localeCompare(valB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      return sortDir === "desc" ? -result : result;
    });
  }

  var data = dataFiltered.map(function (obj) {
    return obj.item;
  });

  // ==========================================
  // 🚀 PAGINATION
  // ==========================================
  var totalData = data.length;
  var limit =
    typeof _viewLimit !== "undefined" && _viewLimit ? num(_viewLimit) : 50;
  var totalPages = Math.ceil(totalData / limit) || 1;

  if (_currentPage > totalPages) _currentPage = totalPages;
  if (_currentPage < 1) _currentPage = 1;

  var startIndex = (_currentPage - 1) * limit;
  var endIndex = startIndex + limit;
  var dataLimitMapped = dataFiltered.slice(startIndex, endIndex);

  var showStart = totalData === 0 ? 0 : startIndex + 1;
  var showEnd = Math.min(endIndex, totalData);

  var allIds = data.map(function (r) {
    return r.id;
  });
  bulkInit("datasales", allIds);

  var rows = dataLimitMapped.map(function (obj) {
    var r = obj.item;
    return [
      r.noper || r.no_per || r.NOPER || "-",
      r.kodemenu || r.kode || r.KODE || "-",
      r.namamenu || r.namaMenu || r.nama_menu || r.NAMAMENU || "-",
      r.kodebersama || "-", // ⬅️ Menampilkan data fisik kodebersama
      r.satuan || r.SATUAN || "-",
      fmtN(r.qty || r.QTY || 0),
      fmtN(r.amount || r.AMOUNT || r.total || 0),
      r.masa || r.ma || r.MA || "-",
      r.group === "undefined" || !r.group ? "-" : r.group,
      lookupCabangLabel(r.cabang),
    ];
  });

  var foot = [
    "",
    "",
    "TOTAL:",
    "",
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

  var paginationHTML = "";
  if (totalData > 0) {
    paginationHTML =
      '<div style="display:flex;align-items:center;gap:.7rem;margin-top:.7rem;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="font-size:.8rem;color:var(--muted)">Menampilkan <b>' +
      showStart +
      " - " +
      showEnd +
      "</b> dari <b>" +
      totalData +
      "</b> record (Hal. " +
      _currentPage +
      "/" +
      totalPages +
      ")</div>" +
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
      "</div></div>";
  }

  // Filter Noper Options
  var listNoperKhusus = [
    { NOPER: "COFFEBREAK", PENJELASAN: "COFFEBREAK" },
    { NOPER: "KBGGULING", PENJELASAN: "KBGGULING" },
    { NOPER: "NASIKOTAK", PENJELASAN: "NASIKOTAK" },
    { NOPER: "NASIKUNING", PENJELASAN: "NASIKUNING" },
    { NOPER: "TUMPENG", PENJELASAN: "TUMPENG" },
    { NOPER: "PAKET4", PENJELASAN: "PAKET4" },
    { NOPER: "PAKET8", PENJELASAN: "PAKET8" },
    { NOPER: "PAMER", PENJELASAN: "PAKET MEETING" },
    { NOPER: "PRAS", PENJELASAN: "PRASMANAN" },
    { NOPER: "LAIN", PENJELASAN: "LAIN" },
    { NOPER: "SNACK", PENJELASAN: "SNACK" },
    { NOPER: "SNACKB", PENJELASAN: "SNACKB" },
  ];

  var noperOptionsHTML =
    '<option value="" ' +
    (activeNoper === "" ? "selected" : "") +
    ">ALL (Semua Noper)</option>" +
    '<option value="blank" ' +
    (activeNoper === "blank" ? "selected" : "") +
    ">Tanpa Noper (Blank)</option>";

  listNoperKhusus.forEach(function (item) {
    var isSel =
      activeNoper.toUpperCase() === item.NOPER.toUpperCase() ? "selected" : "";
    noperOptionsHTML +=
      '<option value="' +
      item.NOPER +
      '" ' +
      isSel +
      ">" +
      item.NOPER +
      " (" +
      item.PENJELASAN +
      ")</option>";
  });

  var noperFilterHTML =
    '<select id="filterNoper" class="form-control" style="display:inline-block;width:auto;padding:2px 6px;font-size:0.8rem;" onchange="renderSales()">' +
    noperOptionsHTML +
    "</select>";

  var headerLabels = [
    "No. Per",
    "Kode",
    "Nama Menu",
    "Kode Bersama",
    "Satuan",
    "QTY",
    "Amount",
    "MA",
    "Group",
    "Cabang",
  ];
  var numCols = [5, 6]; // Index QTY & Amount

  var tableHtml =
    '<table style="width:100%;border-collapse:collapse;"><thead><tr>';

  // Checkbox Header
  tableHtml +=
    '<th style="padding:8px;border:1px solid var(--brd);width:35px;text-align:center;">' +
    '<input type="checkbox" onchange="toggleBulkAll(\'datasales\', this.checked)" title="Pilih Semua">' +
    "</th>";

  headerLabels.forEach(function (label, idx) {
    var isActive = _salesSort.col === idx;
    var icon = "";
    if (isActive) {
      icon =
        _salesSort.dir === "asc"
          ? ' <i class="fa-solid fa-sort-up" style="color:var(--accent);"></i>'
          : ' <i class="fa-solid fa-sort-down" style="color:var(--accent);"></i>';
    } else {
      icon =
        ' <i class="fa-solid fa-sort" style="color:var(--muted);opacity:.4;"></i>';
    }
    var bgStyle = isActive
      ? "background:var(--bg2);color:var(--accent);font-weight:bold;"
      : "";
    tableHtml +=
      '<th style="' +
      bgStyle +
      'padding:8px;border:1px solid var(--brd);white-space:nowrap;cursor:pointer;user-select:none;" onclick="sortSales(' +
      idx +
      ')">' +
      label +
      icon +
      "</th>";
  });
  tableHtml +=
    '<th style="padding:8px;border:1px solid var(--brd);">Aksi</th></tr></thead><tbody>';

  if (rows.length === 0) {
    tableHtml +=
      '<tr><td colspan="' +
      (headerLabels.length + 2) +
      '" style="padding:2rem;text-align:center;color:var(--muted);">Belum ada data sales</td></tr>';
  } else {
    rows.forEach(function (row, i) {
      tableHtml += "<tr>";
      tableHtml +=
        '<td style="padding:6px 8px;border:1px solid var(--brd);text-align:center;">' +
        '<input type="checkbox" class="bulk-check" data-store="datasales" data-id="' +
        dataLimitMapped[i].item.id +
        '">' +
        "</td>";

      row.forEach(function (cell, ci) {
        var align = numCols.includes(ci) ? "text-align:right;" : "";
        tableHtml +=
          '<td style="padding:6px 8px;border:1px solid var(--brd);font-size:.85rem;' +
          align +
          '">' +
          cell +
          "</td>";
      });
      tableHtml +=
        '<td style="padding:6px 8px;border:1px solid var(--brd);">' +
        crudActions(dataLimitMapped[i].item.id, "datasales") +
        "</td>";
      tableHtml += "</tr>";
    });
  }

  // Footer Total
  tableHtml += '<tr style="background:var(--bg2);font-weight:bold;">';
  tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
  foot.forEach(function (cell, ci) {
    var align = numCols.includes(ci) ? "text-align:right;" : "";
    tableHtml +=
      '<td style="padding:8px;border:1px solid var(--brd);' +
      align +
      '">' +
      cell +
      "</td>";
  });
  tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
  tableHtml += "</tr></tbody></table>";

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
    "Noper: " +
    noperFilterHTML +
    '<span style="margin:0 5px;color:var(--brd)">|</span>' +
    "Tampilkan " +
    getLimitOptsHTML() +
    "</div>" +
    '<div style="display:flex;gap:.4rem;flex-wrap:wrap;">' +
    '<button type="button" class="btn btn-inf" onclick="refreshSales()" title="Refresh data dari server"><i class="fa-solid fa-rotate"></i> Refresh</button>' +
    '<button type="button" class="btn btn-inf" style="background-color:#595959;color:#fff;border-color:#595959" onclick="cekNoperSalesDariDaftarMenu()" title="Cek dan ambil noper dari daftar menu untuk sales yang kosong"><i class="fa-solid fa-magnifying-glass"></i> Cek Noper Kosong</button>' +
    '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportSalesToXLS()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'datasales\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllData(\'datasales\')"><i class="fa-solid fa-trash-can"></i> Kosongkan</button>' +
    '<button type="button" class="btn btn-a" onclick="formSales()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    '<button type="button" class="btn btn-inf" style="background-color:#d97706;color:#fff;border-color:#d97706" onclick="openUpdateKodeBersamaModal()" title="Update Kode Bersama untuk baris yang dipilih"><i class="fa-solid fa-pen-to-square"></i> Update Kode Bersama</button>' +
    "</div>" +
    "</div>" +
    wrapTable(tableHtml) +
    paginationHTML
  );
}

// --- 3. FUNGSI UNTUK PINDAH HALAMAN SALES ---
function goToSalesPage(targetPage) {
  _currentPage = targetPage;

  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
    return;
  }

  var appContainer = null;
  var possibleIds = [
    "main-content",
    "app-content",
    "content-area",
    "page-content",
    "view-content",
    "contentArea",
  ];

  for (var i = 0; i < possibleIds.length; i++) {
    var el = document.getElementById(possibleIds[i]);
    if (
      el &&
      (el.innerHTML.indexOf("datasales") !== -1 ||
        el.innerHTML.indexOf("Sales") !== -1)
    ) {
      appContainer = el;
      break;
    }
  }

  if (!appContainer) {
    var allDivs = document.getElementsByTagName("div");
    for (var j = 0; j < allDivs.length; j++) {
      if (
        allDivs[j].innerHTML.indexOf("Sales") !== -1 &&
        allDivs[j].children.length > 3
      ) {
        appContainer = allDivs[j];
        break;
      }
    }
  }

  if (appContainer) {
    renderSales().then(function (html) {
      appContainer.innerHTML = '<div class="pnl active">' + html + "</div>";
    });
  } else {
    console.error(
      "Tidak bisa menemukan container untuk merender halaman sales.",
    );
  }
}
// --- BUKA MODAL UPDATE KODE BERSAMA ---
function openUpdateKodeBersamaModal() {
  // Ambil ID data sales yang dicentang via sistem bulk
  var selectedIds = [];
  if (typeof _bulkStoreSelection !== "undefined" && _bulkStoreSelection["datasales"]) {
    selectedIds = Array.from(_bulkStoreSelection["datasales"]);
  } else {
    // Fallback manual ceklis DOM
    var checkboxes = document.querySelectorAll('.bulk-check[data-store="datasales"]:checked');
    checkboxes.forEach(function (cb) {
      selectedIds.push(cb.getAttribute("data-id"));
    });
  }

  if (selectedIds.length === 0) {
    alert("Silakan centang/pilih minimal satu baris sales terlebih dahulu!");
    return;
  }

  var rawData = DBCache.datasales || [];
  
  // Kumpulkan unique kodemenu dari baris yang dipilih
  var uniqueKodeMenu = [];
  rawData.forEach(function (r) {
    if (selectedIds.includes(String(r.id))) {
      var kMenu = String(r.kodemenu || r.kode || r.KODE || "").trim();
      if (kMenu && !uniqueKodeMenu.includes(kMenu)) {
        uniqueKodeMenu.push(kMenu);
      }
    }
  });

  // Buat HTML untuk daftar kode menu unik yang terpilih
  var kodeMenuHtml = uniqueKodeMenu.length > 0 
    ? uniqueKodeMenu.map(function(k) { return '<span class="badge" style="background:var(--bg2);color:var(--accent);padding:3px 8px;margin:2px;border:1px solid var(--brd);border-radius:4px;display:inline-block;">' + esc(k) + '</span>'; }).join(" ")
    : '<i style="color:var(--muted)">Tidak ada kode menu terdeteksi</i>';

  // Buat elemen kontainer modal pop-up secara dinamis jika belum ada
  var modalId = "modalUpdateKodeBersama";
  var existingModal = document.getElementById(modalId);
  if (existingModal) existingModal.remove();

  var modalHtml = 
    '<div id="' + modalId + '" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:9999;">' +
      '<div style="background:var(--card);padding:1.5rem;border-radius:var(--r);border:1px solid var(--brd);width:90%;max-width:450px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">' +
        '<h3 style="margin-top:0;margin-bottom:1rem;color:var(--fg);font-size:1.1rem;"><i class="fa-solid fa-pen-to-square"></i> Update Kode Bersama</h3>' +
        '<div style="margin-bottom:.8rem;font-size:.85rem;color:var(--muted);">Baris terpilih: <b>' + selectedIds.length + ' item</b></div>' +
        '<div style="margin-bottom:1rem;font-size:.85rem;">' +
          '<label style="display:block;margin-bottom:.3rem;font-weight:bold;color:var(--fg);">Kode Menu Unik Terdeteksi:</label>' +
          '<div style="max-height:100px;overflow-y:auto;padding:6px;border:1px solid var(--brd);border-radius:4px;background:var(--bg);">' + kodeMenuHtml + '</div>' +
        '</div>' +
        '<div style="margin-bottom:1.2rem;">' +
          '<label style="display:block;margin-bottom:.3rem;font-weight:bold;color:var(--fg);">Nilai Kode Bersama Baru:</label>' +
          '<input type="text" id="input_new_kodebersama" class="form-control" placeholder="Masukkan nilai kode bersama..." style="width:100%;padding:6px 10px;box-sizing:border-box;">' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:.5rem;">' +
          '<button type="button" class="btn btn-inf" style="background:#6c757d;border-color:#6c757d;color:#fff;" onclick="document.getElementById(\'' + modalId + '\').remove()">Batal</button>' +
          '<button type="button" class="btn btn-a" onclick="executeSaveKodeBersama()">Simpan Perubahan</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Simpan selectedIds ke window sementara agar bisa diakses fungsi simpan
  window._tempSelectedSalesIds = selectedIds;
}

// --- EKsekusi PENYIMPANAN KODE BERSAMA ---
function executeSaveKodeBersama() {
  var newVal = document.getElementById("input_new_kodebersama").value.trim();
  var selectedIds = window._tempSelectedSalesIds || [];

  if (selectedIds.length === 0) {
    alert("Tidak ada data yang dipilih.");
    return;
  }

  var rawData = DBCache.datasales || [];
  var updatedCount = 0;

  // Update data secara lokal di cache
  rawData.forEach(function (r) {
    if (selectedIds.includes(String(r.id))) {
      r.kodebersama = newVal;
      updatedCount++;
    }
  });

  // Tutup modal
  var modal = document.getElementById("modalUpdateKodeBersama");
  if (modal) modal.remove();

  // Trigger simpan database / sinkronisasi jika aplikasi Anda menyediakannya (misal sync/save function)
  if (typeof saveDBStore === "function") {
    saveDBStore("datasales");
  } else if (typeof syncDataToServer === "function") {
    syncDataToServer("datasales");
  }

  // Refresh tampilan tabel sales
  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
  } else if (typeof renderSales === "function") {
    renderSales().then(function (html) {
      var area = document.getElementById("contentArea") || document.querySelector(".pnl.active");
      if (area) area.innerHTML = '<div class="pnl active">' + html + '</div>';
    });
  }

  alert("Berhasil memperbarui " + updatedCount + " data sales dengan Kode Bersama: " + (newVal || "(Kosong)"));
}
// 🌟 FUNGSI PENDUKUNG UNTUK MENGECEK DAN MENGISI NOPER SALES DARI DAFTAR MENU
function cekNoperSalesDariDaftarMenu() {
  var salesData = DBCache.datasales || DBCache.sales || [];
  var menuData = DBCache.daftarmenu || [];

  if (salesData.length === 0) {
    return toast("Tidak ada data sales untuk diperiksa.", "err");
  }

  var updatedCount = 0;

  salesData.forEach(function (sale) {
    var currentNoper = String(
      sale.noper || sale.no_per || sale.NOPER || "",
    ).trim();

    // Hanya periksa baris sales yang noper-nya kosong, strip (-), atau belum ada
    if (
      currentNoper === "" ||
      currentNoper === "-" ||
      currentNoper === "undefined"
    ) {
      var saleKode = String(sale.kodemenu || sale.kode || sale.KODE || "")
        .trim()
        .toUpperCase();
      var saleCabang = String(sale.cabang || "").trim();
      var saleGroup = String(sale.group || "")
        .trim()
        .toUpperCase();

      if (!saleKode) return; // Lewati jika kode menu sales kosong

      var matchedMenu = null;

      // 1. Prioritas Utama: Cari yang cocok Cabang + Group + Kode Menu
      matchedMenu = menuData.find(function (menu) {
        var menuKode = String(menu.kodemenu || menu.kode || menu.KODE || "")
          .trim()
          .toUpperCase();
        var menuCabang = String(menu.cabang || "").trim();
        var menuGroup = String(menu.group || "")
          .trim()
          .toUpperCase();
        return (
          menuKode === saleKode &&
          menuCabang === saleCabang &&
          menuGroup === saleGroup
        );
      });

      // 2. Fallback Pertama: Jika tidak ketemu, coba cocokkan Cabang + Kode Menu saja (mengabaikan group)
      if (!matchedMenu) {
        matchedMenu = menuData.find(function (menu) {
          var menuKode = String(menu.kodemenu || menu.kode || menu.KODE || "")
            .trim()
            .toUpperCase();
          var menuCabang = String(menu.cabang || "").trim();
          return menuKode === saleKode && menuCabang === saleCabang;
        });
      }

      // 3. Fallback Terakhir: Jika masih tidak ketemu, coba cocokkan berdasarkan Kode Menu saja
      if (!matchedMenu) {
        matchedMenu = menuData.find(function (menu) {
          var menuKode = String(menu.kodemenu || menu.kode || menu.KODE || "")
            .trim()
            .toUpperCase();
          return menuKode === saleKode;
        });
      }

      // Jika ditemukan padanannya di daftar menu dan memiliki noper
      if (matchedMenu) {
        var foundNoper = String(
          matchedMenu.noper || matchedMenu.NOPER || matchedMenu.no_per || "",
        ).trim();
        if (foundNoper && foundNoper !== "-" && foundNoper !== "undefined") {
          sale.noper = foundNoper;
          updatedCount++;
        }
      }
    }
  });

  if (updatedCount > 0) {
    if (typeof saveDataCache === "function") {
      // Tunggu sampai proses simpan ke server benar-benar selesai
      saveDataCache("datasales").then(async () => {
        // 🔄 TARIK ULANG DATA TERBARU DARI SERVER KE DBCACHE
        await refreshSalesDataSilent(); // Atau panggil fungsi fetch ulang khusus sales

        toast(
          "Berhasil memperbarui " +
            updatedCount +
            " data sales yang kosong noper-nya!",
          "ok",
        );

        // Render ulang tabel sales supaya layar sinkron dengan database
        if (typeof renderSales === "function") {
          document.getElementById("container-utama").innerHTML =
            await renderSales(); // Sesuaikan wadah render Anda
        }
      });
    }
  } else {
    toast("Tidak ada data sales kosong yang cocok dengan daftar menu.", "info");
  }
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

async function saveDataCache(tableName) {
  try {
    // Pastikan tabel yang dikirim sesuai
    if (!tableName) {
      console.warn("Nama tabel tidak ditentukan untuk disimpan.");
      return;
    }

    // Ubah URL mengarah ke endpoint batch server Anda: /api/batch/:storeName
    var baseUrl = window.location.origin + "/api/batch/";
    var payload = DBCache[tableName]; // Mengambil array data dari DBCache (misal: DBCache.datasales)

    if (!Array.isArray(payload)) {
      throw new Error("Data yang akan disimpan bukan berupa array.");
    }

    if (typeof toast === "function") {
      toast("Menyimpan perubahan ke server...", "inf");
    }

    var response = await fetch(baseUrl + tableName, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        "Gagal menyimpan data ke server (Status: " + response.status + ")",
      );
    }

    var result = await response.json();
    console.log("✅ Berhasil menyimpan batch data ke server:", result);

    if (typeof toast === "function") {
      toast("Data berhasil disimpan secara permanen!", "ok");
    }
  } catch (err) {
    console.error("❌ Gagal menyimpan cache:", err);
    if (typeof toast === "function") {
      toast("Error menyimpan data: " + err.message, "err");
    }
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
    '"></div>' +
    '<div class="fg"><label>Nama Menu</label><input id="fSalesNama" class="in" value="' +
    esc(data.namaMenu || data.nama_menu || data.namamenu || data.nama || "") +
    '"></div>' +
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
    '"></div>' +
    // 🌟 TAMBAHKAN INPUT NO PERKIRAAN DI SINI
    '<div class="fg"><label>No.Perkiraan</label><input id="fSalesNoper" class="in" placeholder="Contoh: 402.0001" value="' +
    esc(data.noper || "") +
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

    // 🌟 1. TAMBAHKAN BARIS INI UNTUK MENANGKAP NO PER
    var noper = $("fSalesNoper").value.trim();

    if (!kode || !namaMenu)
      return toast("Kode dan Nama Menu wajib diisi", "err");

    if (id) {
      var r = await db.get("datasales", id);
      if (r) {
        var updated = Object.assign({}, r, {
          kode: kode,
          kodemenu: kode, // 🟢 Biar kolom fisik 'kodemenu' di DB juga keisi
          namaMenu: namaMenu,
          namamenu: namaMenu, // 🟢 Biar kolom fisik 'namamenu' di DB juga keisi
          satuan: satuan,
          qty: qty,
          total: amount, // 🟢 Map ke 'total' karena di DB fisiknya memakai 'total'
          amount: amount,
          ma: ma,
          masa: ma, // 🟢 Map ke 'masa' biar kolom fisik keisi
          cabang: cabang,
          group: group,
          noper: noper, // 🌟 2. MASUKKAN NOPER KE SINI
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
        kodemenu: kode, // 🟢 Sinkronisasi ke kolom fisik DB
        namaMenu: namaMenu,
        namamenu: namaMenu, // 🟢 Sinkronisasi ke kolom fisik DB
        satuan: satuan,
        qty: qty,
        total: amount, // 🟢 Sinkronisasi ke kolom fisik DB
        amount: amount,
        ma: ma,
        masa: ma, // 🟢 Sinkronisasi ke kolom fisik DB
        cabang: cabang,
        group: group,
        noper: noper, // 🌟 3. MASUKKAN NOPER KE SINI
      };
      await db.add("datasales", newObj);
      DBCache.datasales.push(newObj);
    }

    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
  }
}

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
         <td>Cabang</td><td>Group</td><td>Kode Menu</td><td>Nama Menu</td><td>Satuan</td><td>Noper</td><td>KodeHppMenu</td><td>S.Awal</td><td>Masuk</td><td>Keluar</td><td>S.Akhir</td>
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
      <td style="mso-number-format:'\\@';">${r.noper || r.NOPER || ""}</td>
      <td style="mso-number-format:'\\@';">${r.kodehppmenu || ""}</td>
      <td style="mso-number-format:'#,##0';">${r.sawal || 0}</td>
      <td style="mso-number-format:'#,##0';">${r.masuk || 0}</td>
      <td style="mso-number-format:'#,##0';">${r.keluar || 0}</td>
      <td style="mso-number-format:'#,##0';">${r.sakhir || 0}</td>
    </tr>`;
  });

  // 3. Tambahkan Baris TOTAL
  html += `<tr style="background-color:#d9e2f3;font-weight:bold;">
    <td></td><td></td><td></td><td></td><td></td><td>TOTAL</td><td></td>
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
// ✅ BARU
var _daftarMenuSort = { col: -1, dir: "asc" };

function sortDaftarMenu(colIndex) {
  if (_daftarMenuSort.col === colIndex) {
    _daftarMenuSort.dir = _daftarMenuSort.dir === "asc" ? "desc" : "asc";
  } else {
    _daftarMenuSort.col = colIndex;
    _daftarMenuSort.dir = "asc";
  }
  _currentPage = 1;
  var html = renderDaftarMenu(); // ✅
  $("contentArea").innerHTML = '<div class="pnl active">' + html + "</div>"; // ✅
}

function renderDaftarMenu() {
  var rawData = DBCache.daftarmenu || [];

  var rawDataWithIndex = rawData.map(function (r, idx) {
    return { item: r, originalIndex: idx + 1 };
  });

  var dataFiltered = rawDataWithIndex.filter(function (obj) {
    return filterByCabang([obj.item]).length > 0;
  });

  var activeGroup = getActiveGroupFilter();
  if (activeGroup) {
    dataFiltered = dataFiltered.filter(function (obj) {
      return (obj.item.group || "") === activeGroup;
    });
  }

  var noperSelect = document.getElementById("filterNoperDaftarMenu");
  var activeNoper = noperSelect ? noperSelect.value : "";

  if (activeNoper === "blank") {
    dataFiltered = dataFiltered.filter(function (obj) {
      var noper = String(
        obj.item.noper || obj.item.no_per || obj.item.NOPER || "",
      ).trim();
      return noper === "" || noper === "-";
    });
  } else if (activeNoper !== "") {
    dataFiltered = dataFiltered.filter(function (obj) {
      var noper = String(
        obj.item.noper || obj.item.no_per || obj.item.NOPER || "",
      ).trim();
      return noper.toUpperCase() === activeNoper.toUpperCase();
    });
  }

  // ==========================================
  // 🔥 SORTING DINAMIS
  // ==========================================
  if (_daftarMenuSort.col >= 0) {
    var sortCol = _daftarMenuSort.col;
    var sortDir = _daftarMenuSort.dir;

    dataFiltered.sort(function (aObj, bObj) {
      var a = aObj.item,
        b = bObj.item;
      var valA, valB;

      switch (sortCol) {
        case 0:
          valA = String(a.cabang || "").toLowerCase();
          valB = String(b.cabang || "").toLowerCase();
          break;
        case 1:
          valA = String(a.group || "").toLowerCase();
          valB = String(b.group || "").toLowerCase();
          break;
        case 2:
          valA = String(a.kodemenu || a.kode || a.KODE || "").toLowerCase();
          valB = String(b.kodemenu || b.kode || b.KODE || "").toLowerCase();
          break;
        case 3:
          valA = String(
            a.namamenu || a.namaMenu || a.nama_menu || "",
          ).toLowerCase();
          valB = String(
            b.namamenu || b.namaMenu || b.nama_menu || "",
          ).toLowerCase();
          break;
        case 4:
          valA = String(a.satuan || a.Satuan || "").toLowerCase();
          valB = String(b.satuan || b.Satuan || "").toLowerCase();
          break;
        case 5:
          valA = String(a.noper || "").toLowerCase();
          valB = String(b.noper || "").toLowerCase();
          break;
        case 6:
          valA = String(a.kodehppmenu || "").toLowerCase();
          valB = String(b.kodehppmenu || "").toLowerCase();
          break;
        case 7:
          valA = +(a.sawal || a.stok_awal || 0);
          valB = +(b.sawal || b.stok_awal || 0);
          break;
        case 8:
          valA = +(a.masuk || 0);
          valB = +(b.masuk || 0);
          break;
        case 9:
          valA = +(a.keluar || 0);
          valB = +(b.keluar || 0);
          break;
        case 10:
          valA = +(a.sakhir || a.stok_akhir || 0);
          valB = +(b.sakhir || b.stok_akhir || 0);
          break;
        default:
          return 0;
      }

      var result;
      if (typeof valA === "number") {
        result = valA - valB;
      } else {
        result = valA.localeCompare(valB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }
      return sortDir === "desc" ? -result : result;
    });
  }

  var data = dataFiltered.map(function (obj) {
    return obj.item;
  });

  var totalData = data.length;
  var totalPages = Math.ceil(totalData / _viewLimit) || 1;
  if (_currentPage > totalPages) _currentPage = totalPages;
  if (_currentPage < 1) _currentPage = 1;

  var startIndex = (_currentPage - 1) * _viewLimit;
  var endIndex = startIndex + _viewLimit;
  var dataLimitMapped = dataFiltered.slice(startIndex, endIndex);

  var showStart = totalData === 0 ? 0 : startIndex + 1;
  var showEnd = Math.min(endIndex, totalData);

  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("daftarmenu", ids);

  var idsLimit = dataLimitMapped.map(function (obj) {
    return obj.item.id;
  });

  var rows = dataLimitMapped.map(function (obj) {
    var r = obj.item;
    return [
      lookupCabangLabel(r.cabang),
      r.group === "undefined" || !r.group ? "-" : r.group,
      r.kodemenu || r.kode || r.KODE || "-",
      r.namamenu || r.namaMenu || r.nama_menu || "-",
      r.satuan || r.Satuan || "-",
      r.noper || "-",
      r.kodehppmenu || "-",
      fmtN(r.sawal || r.stok_awal || 0),
      fmtN(r.masuk || 0),
      fmtN(r.keluar || 0),
      fmtN(r.sakhir || r.stok_akhir || 0),
    ];
  });

  var foot = [
    "",
    "",
    "TOTAL:",
    "",
    "",
    "",
    "",
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.sawal || r.stok_awal);
      }, 0),
    ),
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.masuk);
      }, 0),
    ),
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.keluar);
      }, 0),
    ),
    fmtN(
      data.reduce(function (s, r) {
        return s + num(r.sakhir || r.stok_akhir);
      }, 0),
    ),
  ];

  var paginationHTML = "";
  if (totalData > 0) {
    paginationHTML =
      '<div style="display:flex;align-items:center;gap:.7rem;margin-top:.7rem;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="font-size:.8rem;color:var(--muted)">Menampilkan <b>' +
      showStart +
      " - " +
      showEnd +
      "</b> dari <b>" +
      totalData +
      "</b> record (Hal. " +
      _currentPage +
      "/" +
      totalPages +
      ")</div>" +
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
      "</div></div>";
  }

  var listNoperKhusus = [
    { NOPER: "COFFEBREAK", PENJELASAN: "COFFEBREAK" },
    { NOPER: "KBGGULING", PENJELASAN: "KBGGULING" },
    { NOPER: "NASIKOTAK", PENJELASAN: "NASIKOTAK" },
    { NOPER: "NASIKUNING", PENJELASAN: "NASIKUNING" },
    { NOPER: "TUMPENG", PENJELASAN: "TUMPENG" },
    { NOPER: "PAKET4", PENJELASAN: "PAKET4" },
    { NOPER: "PAKET8", PENJELASAN: "PAKET8" },
    { NOPER: "PAMER", PENJELASAN: "PAKET MEETING" },
    { NOPER: "PRAS", PENJELASAN: "PRASMANAN" },
    { NOPER: "LAIN", PENJELASAN: "LAIN" },
    { NOPER: "SNACK", PENJELASAN: "SNACK" },
    { NOPER: "SNACKB", PENJELASAN: "SNACKB" },
  ];

  var noperOptionsHTML =
    '<option value="" ' +
    (activeNoper === "" ? "selected" : "") +
    ">Semua Noper (All)</option>" +
    '<option value="blank" ' +
    (activeNoper === "blank" ? "selected" : "") +
    ">Tanpa Noper (Blank)</option>";

  listNoperKhusus.forEach(function (item) {
    var isSel =
      activeNoper.toUpperCase() === item.NOPER.toUpperCase() ? "selected" : "";
    noperOptionsHTML +=
      '<option value="' +
      item.NOPER +
      '" ' +
      isSel +
      ">" +
      item.NOPER +
      " (" +
      item.PENJELASAN +
      ")</option>";
  });

  var noperFilterHTML =
    '<select id="filterNoperDaftarMenu" class="form-control" style="display:inline-block;width:auto;padding:2px 6px;font-size:0.8rem;" onchange="renderDaftarMenu()">' +
    noperOptionsHTML +
    "</select>";

  // ==========================================
  // 🔥 HEADER SORT + TABLE SENDIRI
  // ==========================================
  var headerLabels = [
    "Cabang",
    "Group",
    "Kode Menu",
    "Nama Menu",
    "Satuan",
    "Noper",
    "KodeHppMenu",
    "Rp.Awal",
    "Masuk",
    "Keluar",
    "Rp.Akhir",
  ];
  var numCols = [7, 8, 9, 10];

  var tableHtml =
    '<table style="width:100%;border-collapse:collapse;"><thead><tr>';

  // ✅ Pastikan ada checkbox header
  tableHtml +=
    '<th style="padding:8px;border:1px solid var(--brd);width:35px;text-align:center;">' +
    '<input type="checkbox" onchange="toggleBulkAll(\'daftarmenu\', this.checked)" title="Pilih Semua">' +
    "</th>";

  headerLabels.forEach(function (label, idx) {
    var isActive = _daftarMenuSort.col === idx;
    var icon = "";
    if (isActive) {
      icon =
        _daftarMenuSort.dir === "asc"
          ? ' <i class="fa-solid fa-sort-up" style="color:var(--accent);"></i>'
          : ' <i class="fa-solid fa-sort-down" style="color:var(--accent);"></i>';
    } else {
      icon =
        ' <i class="fa-solid fa-sort" style="color:var(--muted);opacity:.4;"></i>';
    }
    var bgStyle = isActive
      ? "background:var(--bg2);color:var(--accent);font-weight:bold;"
      : "";
    tableHtml +=
      '<th style="' +
      bgStyle +
      'padding:8px;border:1px solid var(--brd);white-space:nowrap;cursor:pointer;user-select:none;" onclick="sortDaftarMenu(' +
      idx +
      ')">' +
      label +
      icon +
      "</th>";
  });
  tableHtml +=
    '<th style="padding:8px;border:1px solid var(--brd);">Aksi</th></tr></thead><tbody>';

  if (rows.length === 0) {
    tableHtml +=
      '<tr><td colspan="' +
      (headerLabels.length + 1) +
      '" style="padding:2rem;text-align:center;color:var(--muted);">Belum ada data daftar menu</td></tr>';
  } else {
    rows.forEach(function (row, i) {
      tableHtml += "<tr>";
      tableHtml +=
        '<td style="padding:6px 8px;border:1px solid var(--brd);text-align:center;">' +
        '<input type="checkbox" class="bulk-check" data-store="daftarmenu" data-id="' +
        dataLimitMapped[i].item.id +
        '">' +
        "</td>";

      row.forEach(function (cell, ci) {
        var align = numCols.includes(ci) ? "text-align:right;" : "";
        tableHtml +=
          '<td style="padding:6px 8px;border:1px solid var(--brd);font-size:.85rem;' +
          align +
          '">' +
          cell +
          "</td>";
      });
      tableHtml +=
        '<td style="padding:6px 8px;border:1px solid var(--brd);">' +
        crudActions(dataLimitMapped[i].item.id, "daftarmenu") +
        "</td>";
      tableHtml += "</tr>";
    });
  }

  tableHtml += '<tr style="background:var(--bg2);font-weight:bold;">';
  foot.forEach(function (cell, ci) {
    var align = numCols.includes(ci) ? "text-align:right;" : "";
    tableHtml +=
      '<td style="padding:8px;border:1px solid var(--brd);' +
      align +
      '">' +
      cell +
      "</td>";
  });
  tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
  tableHtml += "</tr>";

  tableHtml += "</tbody></table>";

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
    "Noper: " +
    noperFilterHTML +
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
    "</div></div>" +
    wrapTable(tableHtml) +
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

// ==========================================
// 2. KEMUDIAN GUNAKAN DI DALAM FUNGSI formDaftarMenu
// ==========================================
function formDaftarMenu(id) {
  var isEdit = !!id;
  var data = isEdit
    ? (DBCache.daftarmenu || []).find(function (d) {
        return d.id === id;
      }) || {}
    : {};

  var currentCabang =
    data.cabang ||
    (document.getElementById("fDmCab")
      ? document.getElementById("fDmCab").value
      : "");
  var currentGroup =
    data.group ||
    (document.getElementById("fDmGroup")
      ? document.getElementById("fDmGroup").value
      : "");

  var currentNoper = data.noper || "";

  // 1. Ambil opsi noper bawaan yang sudah ada
  var noperOptionsHTML = generatePerkOpts(
    currentCabang,
    currentGroup,
    currentNoper,
  );

  // 2. Daftar Noper Khusus (sesuai struktur NOPER dan PENJELASAN)
  var listNoperKhusus = [
    { NOPER: "COFFEBREAK", PENJELASAN: "COFFEBREAK" },
    { NOPER: "KBGGULING", PENJELASAN: "KBGGULING" },
    { NOPER: "NASIKOTAK", PENJELASAN: "NASIKOTAK" },
    { NOPER: "NASIKUNING", PENJELASAN: "NASIKUNING" },
    { NOPER: "TUMPENG", PENJELASAN: "TUMPENG" },
    { NOPER: "PAKET4", PENJELASAN: "PAKET4" },
    { NOPER: "PAKET8", PENJELASAN: "PAKET8" },
    { NOPER: "PAMER", PENJELASAN: "PAKET MEETING" },
    { NOPER: "PRAS", PENJELASAN: "PRASMANAN" },
    { NOPER: "LAIN", PENJELASAN: "LAIN" },
    { NOPER: "SNACK", PENJELASAN: "SNACK" },
    { NOPER: "SNACKB", PENJELASAN: "SNACKB" },
  ];

  // 3. Tambahkan ke dalam grup pilihan select
  var tambahanHTML = '<optgroup label="--- Noper Khusus ---">';
  listNoperKhusus.forEach(function (item) {
    var isSel =
      currentNoper.toUpperCase() === item.NOPER.toUpperCase() ? "selected" : "";
    tambahanHTML +=
      '<option value="' +
      item.NOPER +
      '" ' +
      isSel +
      ">" +
      item.NOPER +
      " (" +
      item.PENJELASAN +
      ")</option>";
  });
  tambahanHTML += "</optgroup>";

  // Sisipkan ke tag select noper
  if (noperOptionsHTML.indexOf("</select>") !== -1) {
    noperOptionsHTML = noperOptionsHTML.replace(
      "</select>",
      tambahanHTML + "</select>",
    );
  } else {
    noperOptionsHTML += tambahanHTML;
  }

  var html =
    '<div class="fg"><label>Cabang</label><select id="fDmCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ' onchange="updatePerkiraanOptions()">' +
    getCabangOpts(data.cabang) +
    "</select></div>" +
    '<div class="fg"><label>Group</label><select id="fDmGroup" class="in"' +
    (isEdit ? " disabled" : "") +
    ' onchange="updatePerkiraanOptions()">' +
    getGroupOpts(data.group) +
    "</select></div>" +
    '<div class="fg"><label>Data (Tanggal/JSON)</label><input id="fDmData" type="date" class="in" value="' +
    esc(data.data || data.tanggal || "") +
    '"></div>' +
    '<div class="fg"><label>Kode Menu</label><input id="fDmKode" class="in" value="' +
    esc(data.kodemenu || data.kode || "") +
    '"></div>' +
    '<div class="fg"><label>Nama Menu</label><input id="fDmNama" class="in" value="' +
    esc(data.namamenu || data.namaMenu || "") +
    '"></div>' +
    '<div class="fg"><label>Satuan</label><input id="fDmSatuan" class="in" value="' +
    esc(data.satuan || "") +
    '"></div>' +
    '<div class="fg"><label>No Perkiraan (Noper)</label><select id="fDmNoper" class="in">' +
    noperOptionsHTML +
    "</select></div>" +
    '<div class="fg"><label>Kode HPP Menu</label><input id="fDmKodeHpp" class="in" value="' +
    esc(data.kodehppmenu || "") +
    '"></div>' +
    '<div style="display:flex; gap:.5rem;">' +
    '<div class="fg" style="flex:1;"><label>Stok Awal</label><input id="fDmSawal" type="number" class="in" value="' +
    esc(data.sawal || 0) +
    '"></div>' +
    '<div class="fg" style="flex:1;"><label>Qty Awal</label><input id="fDmQtyAwal" type="number" class="in" value="' +
    esc(data.qtyawal || 0) +
    '"></div>' +
    "</div>" +
    '<div style="display:flex; gap:.5rem;">' +
    '<div class="fg" style="flex:1;"><label>Masuk</label><input id="fDmMasuk" type="number" class="in" value="' +
    esc(data.masuk || 0) +
    '"></div>' +
    '<div class="fg" style="flex:1;"><label>Qty Masuk</label><input id="fDmQtyMasuk" type="number" class="in" value="' +
    esc(data.qtymasuk || 0) +
    '"></div>' +
    "</div>" +
    '<div style="display:flex; gap:.5rem;">' +
    '<div class="fg" style="flex:1;"><label>Keluar</label><input id="fDmKeluar" type="number" class="in" value="' +
    esc(data.keluar || 0) +
    '"></div>' +
    '<div class="fg" style="flex:1;"><label>Qty Keluar</label><input id="fDmQtyKeluar" type="number" class="in" value="' +
    esc(data.qtykeluar || 0) +
    '"></div>' +
    "</div>" +
    '<div style="display:flex; gap:.5rem;">' +
    '<div class="fg" style="flex:1;"><label>Stok Akhir</label><input id="fDmSakhir" type="number" class="in" value="' +
    esc(data.sakhir || 0) +
    '"></div>' +
    '<div class="fg" style="flex:1;"><label>Qty Akhir</label><input id="fDmQtyAkhir" type="number" class="in" value="' +
    esc(data.qtyakhir || 0) +
    '"></div>' +
    "</div>";

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveDaftarMenu(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(isEdit ? "Edit Daftar Menu" : "Tambah Daftar Menu", html, foot);
}

// 🌟 FUNGSI TAMBAHAN: Otomatis memperbarui isi dropdown No Perkiraan saat Cabang/Group diubah (Mode Tambah Baru)
function updatePerkiraanOptions() {
  var cabEl = document.getElementById("fDmCab");
  var grpEl = document.getElementById("fDmGroup");
  var nopEl = document.getElementById("fDmNoper");

  if (cabEl && grpEl && nopEl) {
    nopEl.innerHTML = generatePerkOpts(cabEl.value, grpEl.value, "");
  }
}

async function saveDaftarMenu(e, id) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fDmCab").value;
    var group = $("fDmGroup").value;
    var dataField = $("fDmData").value;
    var kodemenu = $("fDmKode").value.trim();
    var namamenu = $("fDmNama").value.trim();
    var satuan = $("fDmSatuan") ? $("fDmSatuan").value.trim() : "";
    var noper = $("fDmNoper") ? $("fDmNoper").value.trim() : "";
    var kodehppmenu = $("fDmKodeHpp") ? $("fDmKodeHpp").value.trim() : "";
    var sawal = num($("fDmSawal").value);
    var masuk = num($("fDmMasuk").value);
    var keluar = num($("fDmKeluar").value);
    var sakhir = num($("fDmSakhir").value);

    if (!kodemenu || !namamenu)
      return toast("Kode Menu dan Nama Menu wajib diisi", "err");
    // Sebelum dikirim ke API/db, cetak dulu data yang akan dikirim
    console.log("Data yang dikirim ke server:", {
      id: id,
      cabang: cabang,
      group: group,
      satuan: satuan,
      noper: noper,
      kodehppmenu: kodehppmenu,
    });

    if (id) {
      // 1. Ambil data lama dari database
      var r = await db.get("daftarmenu", id);
      if (r) {
        // 2. Gabungkan data lama dengan inputan baru yang diperbarui
        var updated = Object.assign({}, r, {
          cabang: cabang,
          group: group,
          data: dataField,
          kodemenu: kodemenu,
          namamenu: namamenu,
          satuan: satuan,
          noper: noper,
          kodehppmenu: kodehppmenu,
          sawal: sawal,
          masuk: masuk,
          keluar: keluar,
          sakhir: sakhir,
        });

        // 3. Simpan ke database IndexedDB
        await db.put("daftarmenu", updated);

        // 4. 🔥 PERBARUI CACHE LOKAL SECARA LANGSUNG
        if (!DBCache.daftarmenu) DBCache.daftarmenu = [];
        var idx = DBCache.daftarmenu.findIndex((x) => x.id === id);
        if (idx !== -1) {
          DBCache.daftarmenu[idx] = updated;
        } else {
          DBCache.daftarmenu.push(updated);
        }
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
        satuan: satuan,
        noper: noper,
        kodehppmenu: kodehppmenu,
        sawal: sawal,
        masuk: masuk,
        keluar: keluar,
        sakhir: sakhir,
      };

      // Simpan data baru ke IndexedDB
      await db.add("daftarmenu", newObj);

      // Masukkan ke cache lokal
      if (!DBCache.daftarmenu) DBCache.daftarmenu = [];
      DBCache.daftarmenu.push(newObj);
    }

    // Tutup modal form
    if (typeof closeModal === "function") closeModal();

    toast("Data berhasil disimpan!", "ok");

    // 🔥 5. PAKSA RENDER ULANG PANEL AKTIF AGAR DATA TERBARU LANGSUNG MUNCUL
    if (typeof safeRenderCurrentPanel === "function") {
      safeRenderCurrentPanel();
    } else if (typeof renderDaftarMenu === "function") {
      document.getElementById("main-content").innerHTML =
        await renderDaftarMenu();
    }
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
        id: uid(), // 🔥 WAJIB AKTIF: SQLite butuh PRIMARY KEY
        data: "{}", // 🔥 WAJIB AKTIF: Skema Anda meminta TEXT NOT NULL
        cabang: cabang,
        group: group,
        kodemenu: kodemenu,
        namamenu: namamenu,
        satuan: "", // 🌟 Tambah kolom baru sesuai skema
        noper: "", // 🌟 Tambah kolom baru sesuai skema
        kodehppmenu: "", // 🌟 Tambah kolom baru sesuai skema
        sawal: 0,
        masuk: 0,
        keluar: 0,
        sakhir: 0,
        qtyawal: 0, // 🌟 Tambah kolom baru sesuai skema
        qtymasuk: 0, // 🌟 Tambah kolom baru sesuai skema
        qtykeluar: 0, // 🌟 Tambah kolom baru sesuai skema
        qtyakhir: 0, // 🌟 Tambah kolom baru sesuai skema
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
PANEL_MAP.saldoPbk = renderSaldoPembukuan;
// Pastikan variabel halaman aktif ini didefinisikan secara global di luar fungsi jika belum ada
if (typeof _currentPage === "undefined") var _currentPage = 1;
var _saldoSort = { col: -1, dir: "asc" };

// --- 1. FUNGSI SORTING HEADER TABEL ---
function sortSaldoPembukuan(colIndex) {
  if (_saldoSort.col === colIndex) {
    _saldoSort.dir = _saldoSort.dir === "asc" ? "desc" : "asc";
  } else {
    _saldoSort.col = colIndex;
    _saldoSort.dir = "asc";
  }
  _currentPage = 1;

  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
  } else {
    renderSaldoPembukuan().then(function (html) {
      var area =
        document.getElementById("contentArea") ||
        document.querySelector(".pnl.active");
      if (area) area.innerHTML = '<div class="pnl active">' + html + "</div>";
    });
  }
}

// --- 2. FUNGSI UTAMA RENDER SALDO PEMBUKUAN ---
async function renderSaldoPembukuan() {
  try {
    var rawData = DBCache.saldopembukuan || [];
    if (rawData.length === 0 && typeof db !== "undefined" && db.getAll) {
      rawData = await db.getAll("saldopembukuan");
      DBCache.saldopembukuan = rawData;
    }

    var data = filterByCabang(rawData);

    // Filter Group
    var activeGroup = getActiveGroupFilter();
    if (activeGroup) {
      data = data.filter(function (r) {
        return (r.group || "") === activeGroup;
      });
    }

    // Bungkus dengan index asli agar pemetaan aman
    var dataWithIndex = data.map(function (r, idx) {
      return { item: r, originalIndex: idx + 1 };
    });

    // Sorting Dinamis
    if (_saldoSort.col >= 0) {
      var sortCol = _saldoSort.col;
      var sortDir = _saldoSort.dir;

      dataWithIndex.sort(function (aObj, bObj) {
        var a = aObj.item,
          b = bObj.item;
        var valA, valB;

        switch (sortCol) {
          case 0:
            valA = String(a.tanggal || "").toLowerCase();
            valB = String(b.tanggal || "").toLowerCase();
            break;
          case 1:
            valA = String(a.kodetrans || "").toLowerCase();
            valB = String(b.kodetrans || "").toLowerCase();
            break;
          case 2:
            valA = +(a.saldo || 0);
            valB = +(b.saldo || 0);
            break;
          case 3:
            valA =
              +(a.akhir !== undefined && a.akhir !== ""
                ? a.akhir
                : num(a.awal) + num(a.db) - num(a.cr)) || 0;
            valB =
              +(b.akhir !== undefined && b.akhir !== ""
                ? b.akhir
                : num(b.awal) + num(b.db) - num(b.cr)) || 0;
            break;
          case 4:
            valA = String(a.masa || "").toLowerCase();
            valB = String(b.masa || "").toLowerCase();
            break;
          case 5:
            valA = String(lookupCabangLabel(a.cabang) || "").toLowerCase();
            valB = String(lookupCabangLabel(b.cabang) || "").toLowerCase();
            break;
          case 6:
            valA = String(a.group || "").toLowerCase();
            valB = String(b.group || "").toLowerCase();
            break;
          default:
            return 0;
        }

        var result;
        if (typeof valA === "number") {
          result = valA - valB;
        } else {
          result = valA.localeCompare(valB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
        return sortDir === "desc" ? -result : result;
      });
    }

    var sortedData = dataWithIndex.map(function (obj) {
      return obj.item;
    });

    var allIds = sortedData.map(function (r) {
      return r.id;
    });
    bulkInit("saldopembukuan", allIds);

    // Logika Pagination
    var limit =
      typeof _viewLimit !== "undefined" && _viewLimit ? num(_viewLimit) : 50;
    var totalRecords = sortedData.length;
    var totalPages = Math.ceil(totalRecords / limit) || 1;

    if (_currentPage > totalPages) _currentPage = totalPages;
    if (_currentPage < 1) _currentPage = 1;

    var startIndex = (_currentPage - 1) * limit;
    var endIndex = startIndex + limit;

    var dataLimitMapped = dataWithIndex.slice(startIndex, endIndex);
    var dataLimit = dataLimitMapped.map(function (obj) {
      return obj.item;
    });

    var showStart = totalRecords === 0 ? 0 : startIndex + 1;
    var showEnd = Math.min(endIndex, totalRecords);

    var rows = dataLimit.map(function (r) {
      var ak =
        r.akhir !== undefined && r.akhir !== ""
          ? num(r.akhir)
          : num(r.awal) + num(r.db) - num(r.cr);
      return [
        r.tanggal || "-",
        r.kodetrans || "-",
        fmtN(r.saldo),
        '<span class="tag tag-akhir">' + fmtN(ak) + "</span>",
        r.masa || "-",
        lookupCabangLabel(r.cabang),
        r.group || "-",
      ];
    });

    var pageSaldoTotal = dataLimit.reduce(function (s, r) {
      return s + num(r.saldo);
    }, 0);

    var foot = ["", "", fmtN(pageSaldoTotal), "", "", "", ""];

    // Pembuatan Header Tabel & Checkbox
    var headerLabels = [
      "Tanggal",
      "Kode Trans",
      "Saldo",
      "Akhir",
      "Masa",
      "Cabang",
      "Group",
    ];
    var numCols = [2, 3];

    var tableHtml =
      '<table style="width:100%;border-collapse:collapse;"><thead><tr>';

    // Checkbox Header (Select All)
    tableHtml +=
      '<th style="padding:8px;border:1px solid var(--brd);width:35px;text-align:center;">' +
      '<input type="checkbox" onchange="toggleBulkAll(\'saldopembukuan\', this.checked)" title="Pilih Semua">' +
      "</th>";

    headerLabels.forEach(function (label, idx) {
      var isActive = _saldoSort.col === idx;
      var icon = "";
      if (isActive) {
        icon =
          _saldoSort.dir === "asc"
            ? ' <i class="fa-solid fa-sort-up" style="color:var(--accent);"></i>'
            : ' <i class="fa-solid fa-sort-down" style="color:var(--accent);"></i>';
      } else {
        icon =
          ' <i class="fa-solid fa-sort" style="color:var(--muted);opacity:.4;"></i>';
      }
      var bgStyle = isActive
        ? "background:var(--bg2);color:var(--accent);font-weight:bold;"
        : "";

      tableHtml +=
        '<th style="' +
        bgStyle +
        'padding:8px;border:1px solid var(--brd);white-space:nowrap;cursor:pointer;user-select:none;" onclick="sortSaldoPembukuan(' +
        idx +
        ')">' +
        label +
        icon +
        "</th>";
    });
    tableHtml +=
      '<th style="padding:8px;border:1px solid var(--brd);">Aksi</th></tr></thead><tbody>';

    if (rows.length === 0) {
      tableHtml +=
        '<tr><td colspan="' +
        (headerLabels.length + 2) +
        '" style="padding:2rem;text-align:center;color:var(--muted);">Belum ada data Saldo Pembukuan</td></tr>';
    } else {
      rows.forEach(function (row, i) {
        tableHtml += "<tr>";
        tableHtml +=
          '<td style="padding:6px 8px;border:1px solid var(--brd);text-align:center;">' +
          '<input type="checkbox" class="bulk-check" data-store="saldopembukuan" data-id="' +
          dataLimit[i].id +
          '">' +
          "</td>";

        row.forEach(function (cell, ci) {
          var align = numCols.includes(ci) ? "text-align:right;" : "";
          tableHtml +=
            '<td style="padding:6px 8px;border:1px solid var(--brd);font-size:.85rem;' +
            align +
            '">' +
            cell +
            "</td>";
        });

        tableHtml +=
          '<td style="padding:6px 8px;border:1px solid var(--brd);">' +
          crudActions(dataLimit[i].id, "saldopembukuan") +
          "</td>";
        tableHtml += "</tr>";
      });
    }

    // Footer Row
    tableHtml += '<tr style="background:var(--bg2);font-weight:bold;">';
    tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
    foot.forEach(function (cell, ci) {
      var align = numCols.includes(ci) ? "text-align:right;" : "";
      tableHtml +=
        '<td style="padding:8px;border:1px solid var(--brd);' +
        align +
        '">' +
        cell +
        "</td>";
    });
    tableHtml += '<td style="padding:8px;border:1px solid var(--brd);"></td>';
    tableHtml += "</tr></tbody></table>";

    // Pagination HTML
    var paginationHTML = "";
    if (totalRecords > 0) {
      paginationHTML =
        '<div style="display:flex;align-items:center;gap:.7rem;margin-top:.7rem;justify-content:space-between;flex-wrap:wrap">' +
        '<div style="font-size:.8rem;color:var(--muted)">Menampilkan <b>' +
        showStart +
        " - " +
        showEnd +
        "</b> dari <b>" +
        totalRecords +
        "</b> record (Hal. " +
        _currentPage +
        "/" +
        totalPages +
        ")</div>" +
        '<div style="display:flex;gap:.4rem;align-items:center">' +
        '<button type="button" class="btn btn-inf" onclick="changePagePembukuan(' +
        (_currentPage - 1) +
        ')" ' +
        (_currentPage <= 1
          ? 'disabled style="opacity:.5;cursor:not-allowed"'
          : "") +
        '><i class="fa-solid fa-arrow-left"></i> Prev</button>' +
        '<button type="button" class="btn btn-inf" onclick="changePagePembukuan(' +
        (_currentPage + 1) +
        ')" ' +
        (_currentPage >= totalPages
          ? 'disabled style="opacity:.5;cursor:not-allowed"'
          : "") +
        '>Next <i class="fa-solid fa-arrow-right"></i></button>' +
        "</div></div>";
    }

    // Render Final Layout
    var htmlResult =
      bulkBarHTML("saldopembukuan", "Saldo Pembukuan") +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;flex-wrap:wrap;gap:.5rem">' +
      '<div style="font-size:.82rem;color:var(--muted);display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">' +
      "Filter Group: " +
      getGroupFilterHTML() +
      '<span style="margin:0 5px;color:var(--brd)">|</span>' +
      "Filter Cabang: " +
      getCabangFilterHTML() +
      '<span style="margin:0 5px;color:var(--brd)">|</span>' +
      "Tampilkan " +
      getLimitOptsHTML() +
      " dari " +
      totalRecords +
      " record" +
      "</div>" +
      '<div style="display:flex;gap:.4rem">' +
      '<button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportTableToExcel(\'saldopembukuan\', \'Data_Saldo_Pembukuan\')" title="Download Excel"><i class="fa-solid fa-file-excel"></i> XLS</button>' +
      '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'saldopembukuan\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
      '<button type="button" class="btn btn-r" onclick="clearAllData(\'saldopembukuan\')"><i class="fa-solid fa-trash-can"></i> Kosongkan</button>' +
      '<button type="button" class="btn btn-a" onclick="formSaldoPembukuan()"><i class="fa-solid fa-plus"></i> Tambah</button>' +
      "</div></div>" +
      wrapTable(tableHtml) +
      paginationHTML;

    return htmlResult;
  } catch (error) {
    console.error("CRASH PADA RENDER SALDO:", error);
    return (
      '<div style="color:red;padding:1rem;">Gagal memuat tabel: ' +
      error.message +
      "</div>"
    );
  }
}

// --- 3. FUNGSI UNTUK PINDAH HALAMAN (PREV / NEXT) ---
function changePagePembukuan(targetPage) {
  _currentPage = targetPage;

  if (typeof safeRenderCurrentPanel === "function") {
    safeRenderCurrentPanel();
    return;
  }

  var appContainer = null;
  var possibleIds = [
    "main-content",
    "app-content",
    "content-area",
    "page-content",
    "view-content",
    "contentArea",
  ];

  for (var i = 0; i < possibleIds.length; i++) {
    var el = document.getElementById(possibleIds[i]);
    if (el && el.innerHTML.indexOf("Saldo Pembukuan") !== -1) {
      appContainer = el;
      break;
    }
  }

  if (!appContainer) {
    var allDivs = document.getElementsByTagName("div");
    for (var j = 0; j < allDivs.length; j++) {
      if (
        allDivs[j].innerHTML.indexOf("Saldo Pembukuan") !== -1 &&
        allDivs[j].children.length > 3
      ) {
        appContainer = allDivs[j];
        break;
      }
    }
  }

  if (appContainer) {
    renderSaldoPembukuan().then(function (html) {
      appContainer.innerHTML = '<div class="pnl active">' + html + "</div>";
    });
  } else {
    console.error(
      "Tidak bisa menemukan container untuk merender halaman pembukuan.",
    );
  }
}

function formSaldoPembukuan(id) {
  var isEdit = !!id;

  // Ambil data dengan pencarian yang aman
  var data = isEdit
    ? (DBCache.saldopembukuan || []).find(function (d) {
        return String(d.id) === String(id);
      }) || {}
    : {};

  // Antisipasi properti huruf besar/kecil dari database/cache
  var groupVal = data.group || data.GROUP || "";
  var cabangVal = data.cabang || data.CABANG || data.kode_cabang || "";
  var tanggalVal = data.tanggal || data.TANGGAL || "";
  var kodetransVal = data.kodetrans || data.KODETRANS || "";
  var awalVal = data.awal !== undefined ? data.awal : data.AWAL || 0;
  var masaVal = data.masa || data.MASA || "";

  // HTML dengan posisi Group di atas Cabang
  // Menambahkan atribut onchange="updateCabangOptions(this.value)" pada select Group
  var html =
    '<div class="fg"><label>Group</label><select id="fSpGroup" class="in"' +
    (isEdit ? " disabled" : "") +
    ' onchange="updateCabangOptions(this.value)">' +
    getGroupOpts(groupVal) +
    "</select></div>" +
    '<div class="fg"><label>Cabang</label><select id="fSpCab" class="in"' +
    (isEdit ? " disabled" : "") +
    ">" +
    getCabangOpts2(cabangVal, groupVal) + // Mengirim parameter groupVal ke fungsi opsi cabang
    "</select></div>" +
    '<div class="fg"><label>Tanggal</label><input id="fSpTgl" type="date" class="in" value="' +
    esc(tanggalVal) +
    '"' +
    (isEdit ? " disabled" : "") +
    "></div>" +
    '<div class="fg"><label>Masa</label><input id="fSpMasa" class="in" value="' +
    esc(masaVal) +
    '"></div>' +
    '<div class="fg"><label>Kode Transaksi</label><input id="fSpKodetrans" class="in" value="' +
    esc(kodetransVal) +
    '"></div>' +
    '<div style="display:flex; gap:.5rem;">' +
    '<div class="fg" style="flex:1;"><label>Saldo Awal</label><input id="fSpAwal" type="number" class="in" value="' +
    esc(awalVal) +
    '"></div>' +
    "</div>";

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-a" onclick="saveSaldoPembukuan(event, \'' +
    (id || "") +
    "')\">" +
    (isEdit ? "Update" : "Simpan") +
    "</button>";

  openModal(
    isEdit ? "Edit Saldo Pembukuan" : "Tambah Saldo Pembukuan",
    html,
    foot,
  );
}

/**
 * Fungsi tambahan untuk memperbarui dropdown Cabang secara dinamis saat Group diubah
 * @param {string} selectedGroup - Nilai group yang dipilih
 */
function updateCabangOptions(selectedGroup) {
  var cabSelect = document.getElementById("fSpCab");
  if (cabSelect) {
    // Memanggil ulang fungsi getCabangOpts dengan filter group terbaru
    // Parameter kedua kosong ("") karena ini adalah input baru/perubahan input, bukan data edit
    cabSelect.innerHTML = getCabangOpts2("", selectedGroup);
  }
}

async function saveSaldoPembukuan(e, id) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    var cabang = $("fSpCab").value;
    var group = $("fSpGroup").value;
    var tanggal = $("fSpTgl").value;
    var masa = $("fSpMasa").value.trim();
    var kodetrans = $("fSpKodetrans").value.trim();
    var awal = num($("fSpAwal").value);

    if (id) {
      var r = await db.get("saldopembukuan", id);
      if (r) {
        var updated = Object.assign({}, r, {
          tanggal: tanggal,
          kodetrans: kodetrans,
          saldo: awal,
          db: db,
          cr: cr,
          akhir: akhir,
          masa: masa,
          cabang: cabang,
          group: group,
        });
        await db.put("saldopembukuan", updated);

        // MANUAL CACHE UPDATE
        var idx = DBCache.saldopembukuan.findIndex((x) => x.id === id);
        if (idx !== -1) DBCache.saldopembukuan[idx] = updated;
      }
    } else {
      var newId = uid();
      var newObj = {
        id: newId,
        tanggal: tanggal,
        kodetrans: kodetrans,
        saldo: saldo,
        masa: masa,
        cabang: cabang,
        group: group,
      };
      await db.add("saldopembukuan", newObj);

      // MANUAL CACHE UPDATE
      DBCache.saldopembukuan.push(newObj);
    }

    closeModal();
    toast("Tersimpan!", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal simpan: " + err.message, "err");
  }
}
