/* ================================================================
   app_laporan.js — NERACA, DETIL NERACA, RL REKAP, RL DETIL,
                    BUKU BESAR, EXPORT XLS
   ================================================================ */
// ==================================================
// ✅ FUNGSI KEAMANAN GLOBAL (LETAKAN DI PALING ATAS)
// ==================================================
function getActiveGroup() {
  var role = (localStorage.getItem("role") || "").trim().toUpperCase();
  var group = (localStorage.getItem("group") || "TLGA").trim().toUpperCase();

  // Jika role ADMIN, kembalikan penanda khusus "ALL_GROUP"
  // (Nanti di kode filter, "ALL_GROUP" akan dianggap LOLOS semua filter)
  if (role === "ADMIN") {
    return "ALL_GROUP";
  }

  // Jika bukan admin, kembalikan group miliknya saja
  // Pengaman: Jika groupnya kosong atau undefined, kembalikan default (TLGA)
  if (!group || group === "UNDEFINED" || group === "") {
    return "TLGA";
  }

  return group;
}

// ==================================================
// FUNGSI GLOBAL: MEMBUAT DROPDOWN GROUP SESUAI ROLE
// ==================================================
function generateGroupDropdownHtml(selectedValue) {
  var role = (localStorage.getItem("role") || "").trim().toUpperCase();
  var activeGroup = getActiveGroup();

  // ✅ PENGAMAN: Jika DBCache belum siap, amankan agar tidak error
  if (typeof DBCache === "undefined" || !DBCache.groupproject) {
    return (
      '<select id="filter_group_role" disabled style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;"><option>' +
      activeGroup +
      "</option></select>"
    );
  }

  var isDisabled = role !== "ADMIN";

  var html =
    '<select id="filter_group_role" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;"';

  if (isDisabled) {
    html += ' disabled title="Hanya Admin yang bisa mengubah Group">';
  } else {
    html += ">";
  }

  // Opsi PERTAMA: Group Aktif dari LocalStorage
  html +=
    '<option value="' + activeGroup + '" selected>' + activeGroup + "</option>";

  // Jika ADMIN, tambahkan opsi lainnya dari DBCache.groupproject
  if (role === "ADMIN") {
    var uniqueGroups = new Set();

    DBCache.groupproject.forEach(function (item) {
      var g = "";

      // ✅ PERBAIKAN: FLEKSIBEL MEMBACA DATA (BAIK OBJECT MAUPUN STRING)
      if (typeof item === "object" && item !== null) {
        g = String(item.kode || item.groupproject || item.nama || "")
          .trim()
          .toUpperCase();
      } else if (typeof item === "string") {
        g = item.trim().toUpperCase();
      }

      // Masukkan ke set jika valid dan bukan "ID" asal / bukan group yang sudah aktif
      if (g && g !== activeGroup && g !== "UNDEFINED" && g !== "ID") {
        uniqueGroups.add(g);
      }
    });

    // Urutkan abjad
    var arrGroups = Array.from(uniqueGroups).sort();
    arrGroups.forEach(function (g) {
      var sel = g === selectedValue ? "selected" : "";
      html += '<option value="' + g + '" ' + sel + ">" + g + "</option>";
    });
  }

  html += "</select>";
  return html;
}

/* ---------- Neraca ---------- */
PANEL_MAP.neraca = renderNeraca;

// ✅ FUNGSI ME-REFRESH HALAMAN KETIKA TOMBOL TERAPKAN DIKLIK
// =====================================================================
// 🌟 1. FUNGSI UTAMA: RENDERING LAPORAN NERACA BERBASIS DATA BACKUP
// =====================================================================

// Helper: Jika gPerks belum ada di file core Anda, definisikan di sini
if (typeof gPerks === "undefined") {
  window.gPerks = function (kodeGol, listPerkiraan) {
    if (!listPerkiraan || !Array.isArray(listPerkiraan)) return 0;
    return listPerkiraan.reduce(function (total, item) {
      // Normalisasi nomor perkiraan
      var noPerk = String(item.noPerk || item.noperkiraan || "").trim();
      // Cek apakah nomor perkiraan diawali dengan Kode Golongan
      if (noPerk.startsWith(String(kodeGol))) {
        // Jumlahkan saldo akhir (pastikan properti 'akhir' ada)
        return total + num(item.akhir || 0);
      }
      return total;
    }, 0);
  };
}
function renderNeraca() {
  if (typeof window._neracaFilterCabang === "undefined") {
    window._neracaFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "PUSAT";
  }

  if (typeof window._neracaFilterMasa === "undefined") {
    var d = new Date();
    var bln = ("0" + (d.getMonth() + 1)).slice(-2);
    window._neracaFilterMasa = bln + "-" + d.getFullYear();
  }

  var partMasa = window._neracaFilterMasa.split("-");
  var inputMonthValue = partMasa[1] + "-" + partMasa[0];

  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";
  var activeGroup = localStorage.getItem("group") || "TLGA";

  // 1. DROPDOWN GROUP
  var groupUiHtml = "";
  if (isPusat) {
    // 📍 Gunakan gantiGroupLaporan agar dropdown cabang ikut ter-update
    groupUiHtml =
      '<div style="display:flex; align-items:center; gap:5px;">' +
      '<label style="font-size:.75rem; color:var(--muted);">Filter Group:</label>' +
      '<select id="filter_neraca_group" onchange="gantiGroupLaporan(\'neraca\', \'renderNeraca\')" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; font-weight:bold;">';

    var listGroup =
      (typeof DBCache !== "undefined" && DBCache.groupproject) || [];
    if (listGroup.length === 0) {
      groupUiHtml += '<option value="TLGA">TLGA</option>';
    } else {
      listGroup.forEach(function (g) {
        var val = String(g.kode || g.nama || g.group || "").trim();
        var label = (g.kode ? g.kode + " - " : "") + (g.nama || g.group || val);
        if (!val) return;
        groupUiHtml +=
          '<option value="' +
          esc(val) +
          '"' +
          (val === activeGroup ? " selected" : "") +
          ">" +
          esc(label) +
          "</option>";
      });
    }
    groupUiHtml += "</select></div>";
  } else {
    groupUiHtml =
      '<div style="font-size:.8rem; color:var(--muted);">Group: <span style="color:var(--accent); font-weight:bold;">' +
      esc(activeGroup) +
      "</span></div>";
  }

  // 2. DROPDOWN CABANG
  function generateCabangOptions() {
    var rawCabang = (typeof DBCache !== "undefined" && DBCache.cabang) || [];
    var daftarCabangObj = [];

    rawCabang.forEach(function (c) {
      var id = (c.kode || c.cabang || "").trim();
      var nama = (c.nama || id || "Tanpa Nama").trim();
      var groupCabang = (c.group || "").trim().toUpperCase();

      if (id && (activeGroup === "ALL_GROUP" || groupCabang === activeGroup)) {
        daftarCabangObj.push({ id: id, nama: nama });
      }
    });

    daftarCabangObj.sort(function (a, b) {
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    var adaPusat = daftarCabangObj.some(function (item) {
      return item.id.toUpperCase() === "PUSAT" || item.id === "00";
    });

    // 📍 Pengaman: Jika cabang kosong / belum ada PUSAT, masukkan PUSAT secara bawaan
    if (!adaPusat) {
      daftarCabangObj.unshift({ id: "PUSAT", nama: "PUSAT (SEMUA CABANG)" });
    }

    var kodeDefault = (window._neracaFilterCabang || "PUSAT").toUpperCase();
    return daftarCabangObj
      .map(function (item) {
        var sel = item.id.toUpperCase() === kodeDefault ? "selected" : "";
        return (
          '<option value="' +
          item.id +
          '" ' +
          sel +
          ">" +
          item.id +
          " - " +
          item.nama.toUpperCase() +
          "</option>"
        );
      })
      .join("");
  }

  var opsiCabangHtml = generateCabangOptions();

  // 3. HTML PANEL & WADAH TABEL
  var htmlLaporan =
    '<div id="area_cetak_neraca" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan Neraca</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:1rem;">' +
    groupUiHtml +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Masa:</label>' +
    '<input type="month" id="filter_neraca_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Cabang:</label>' +
    '<select id="filter_neraca_cabang" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; min-width:120px;">' +
    opsiCabangHtml +
    "</select>" +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiNeraca()">Tampilkan Data</button>' +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadNeracaExcel()"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    "</div>" +
    '<div class="table-responsive-container" style="width:100%; height:380px; max-height:380px; overflow:auto; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box;">' +
    "<style>" +
    "#tempat_tabel_preview table { width: 100% !important; min-width: 1000px !important; border-collapse: collapse !important; table-layout: auto !important; }" +
    "#tempat_tabel_preview th { padding: 8px 10px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; text-align:left; }" +
    "#tempat_tabel_preview td { padding: 6px 10px !important; border: 1px solid var(--brd); font-size:0.85rem; }" +
    "</style>" +
    '<div id="tempat_tabel_preview" style="width:100%; display:block; text-align:left;"></div>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem;">Klik tombol Tampilkan Data untuk memuat detail perkiraan.</p>' +
    "</div></div>";

  return htmlLaporan;
}

// =========================================================================
// FUNGSI UTAMA: TAMPILKAN NERACA
// =========================================================================
async function terapkanOpsiNeraca() {
  var inputmasa = document.getElementById("filter_neraca_masa");
  var selectcabang = document.getElementById("filter_neraca_cabang");
  var selectgroup = document.getElementById("filter_neraca_group");

  if (!inputmasa || !selectcabang) {
    console.warn("Elemen filter belum ditemukan.");
    return;
  }

  if (selectgroup && selectgroup.value) {
    localStorage.setItem("group", selectgroup.value);
  }

  var valmasa = inputmasa.value;
  var valcabang = selectcabang.value;

  if (!valmasa) {
    if (typeof toast === "function")
      toast("silakan pilih masa/periode terlebih dahulu", "err");
    return;
  }

  if (typeof closeModal === "function") closeModal();
  var part = valmasa.split("-");
  var filtertahunfull = part[0];
  var filterbulan = part[1];
  var duadigittahunbelakang = filtertahunfull.substring(2, 4);

  window._neracaFilterMasa = filterbulan + "-" + filtertahunfull;
  window._neracaFilterCabang = valcabang;
  window._neracaModeBackup = true;

  var kodemasadicari = filterbulan + duadigittahunbelakang;
  var namastoregolbackup = "golongan" + filtertahunfull;

  // 📍 Prioritaskan wadah tabel #tempat_tabel_preview
  var area =
    document.getElementById("tempat_tabel_preview") ||
    document.getElementById("contentarea");

  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 memuat data golongan...</div>';
  }

  try {
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    var activeGroup =
      (selectgroup ? selectgroup.value : "") ||
      localStorage.getItem("group") ||
      (typeof getActiveGroup === "function" ? getActiveGroup() : "TLGA");

    activeGroup = String(activeGroup).trim().toUpperCase();
    if (activeGroup === "UNDEFINED" || !activeGroup) {
      activeGroup = "TLGA";
    }

    // FILTER DATA
    window.golterfilter = rawdatagolongan
      .filter(function (g) {
        var kodeGolongan = parseInt(
          g.gol || g.golongan || g.kode_golongan || 0,
          10,
        );
        var cocokGolongan = kodeGolongan < 300;
        var cocokGroup =
          String(g.group || "")
            .trim()
            .toUpperCase() === activeGroup;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

        var cocokCabang =
          valcabang === "PUSAT" ||
          valcabang === "ALL" ||
          valcabang === "" ||
          cabangData === valcabang;

        var nilaiAwal = parseFloat(g.awal || 0);
        var nilaiDb = parseFloat(g.db || g.debit || 0);
        var nilaiCr = parseFloat(g.cr || g.kredit || 0);
        var adaNilai = nilaiAwal !== 0 || nilaiDb !== 0 || nilaiCr !== 0;

        return (
          cocokGolongan &&
          cocokGroup &&
          masaData === kodemasadicari &&
          cocokCabang &&
          adaNilai
        );
      })
      .sort(function (a, b) {
        var golA = parseInt(a.gol || a.golongan || a.kode_golongan || 0, 10);
        var golB = parseInt(b.gol || b.golongan || b.kode_golongan || 0, 10);
        return golA - golB;
      });

    if (golterfilter.length === 0) {
      if (area) {
        area.innerHTML =
          '<div style="padding:3rem; text-align:center; color:var(--muted); font-size: 0.95rem;">🔍 Data benar-benar kosong atau tidak ditemukan untuk filter ini.</div>';
      }
      return;
    }

    var headers = ["gol", "namaGol", "masa", "akhir", "cabang"];
    var html = "";

    var subAwal = 0,
      subDb = 0,
      subCr = 0;
    var currentGolPrefix = "";

    html +=
      '<div style="width: 100%; overflow-x: auto; border: 1px solid #ddd;">';
    html +=
      '<table border="1" style="width:100%; min-width: 600px; border-collapse: collapse; text-align:left; color:#000000; border: 1px solid #000;">';
    html += '<thead style="background:#f4f4f4; font-weight:bold;"><tr>';
    headers.forEach(function (h) {
      var labelHeader = h === "namaGol" ? "NAMA GOLONGAN" : h.toUpperCase();
      html +=
        '<th style="padding:10px; border:1px solid #000; font-size: 0.85rem;">' +
        labelHeader +
        "</th>";
    });
    html += "</tr></thead><tbody>";

    golterfilter.forEach(function (item) {
      var kodeGol = parseInt(
        item.gol || item.golongan || item.kode_golongan || 0,
        10,
      );
      var itemPrefix = String(kodeGol).charAt(0);
      var nilaiAwal = parseFloat(item.awal || 0);
      var nilaiDb = parseFloat(item.db || item.debit || 0);
      var nilaiCr = parseFloat(item.cr || item.kredit || 0);

      if (currentGolPrefix !== "" && itemPrefix !== currentGolPrefix) {
        var labelSub =
          currentGolPrefix === "1"
            ? "TOTAL AKTIVA 1XX"
            : "TOTAL KEWAJIBAN & EKUITAS " + currentGolPrefix + "XX";
        html +=
          '<tr style="font-size:0.85rem; font-weight:bold; background:#ffffff; color:#000000;">';
        html +=
          '<td colspan="3" style="padding:10px; border:1px solid #000;">' +
          labelSub +
          "</td>";
        html +=
          '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap;">' +
          formatUang(subAwal + subDb - subCr) +
          "</td>";
        html += '<td style="padding:2px; border:1px solid #000;"></td></tr>';
        subAwal = 0;
        subDb = 0;
        subCr = 0;
      }

      currentGolPrefix = itemPrefix;
      subAwal += nilaiAwal;
      subDb += nilaiDb;
      subCr += nilaiCr;

      html += '<tr style="font-size: 0.85rem;">';
      headers.forEach(function (h) {
        var val = "";
        var styleTambahan = "";

        if (h === "gol") {
          val =
            item.gol !== undefined
              ? item.gol
              : item.golongan !== undefined
                ? item.golongan
                : "";
          styleTambahan =
            "cursor: pointer; color: green; font-weight: bold; text-decoration: underline;";
        } else if (h === "namaGol") {
          val = item.namagol !== undefined ? item.namagol : "";
        } else if (h === "masa") {
          val = item.masa !== undefined ? item.masa : "";
        } else if (h === "akhir") {
          val =
            item.akhir !== undefined
              ? item.akhir
              : nilaiAwal + nilaiDb - nilaiCr;
          val = formatUang(val);
          styleTambahan =
            "text-align: right; font-weight: bold; white-space: nowrap;";
        } else if (h === "cabang") {
          val =
            item.cabang !== undefined
              ? item.cabang
              : item.kode_cabang !== undefined
                ? item.kode_cabang
                : "";
        }

        if (h !== "akhir" && h !== "gol")
          styleTambahan = "white-space: nowrap;";

        if (h === "gol") {
          html +=
            "<td onclick=\"lihatDetilPerkiraan('" +
            val +
            "', '" +
            kodemasadicari +
            "', '" +
            valcabang +
            '\')" style="padding:10px; border:1px solid #000; ' +
            styleTambahan +
            '">' +
            val +
            "</td>";
        } else {
          html +=
            '<td style="padding:10px; border:1px solid #000; ' +
            styleTambahan +
            '">' +
            val +
            "</td>";
        }
      });
      html += "</tr>";
    });

    if (currentGolPrefix !== "") {
      var labelSubAkhir =
        currentGolPrefix === "1"
          ? "TOTAL AKTIVA 1XX"
          : "TOTAL KEWAJIBAN & EKUITAS " + currentGolPrefix + "XX";
      html +=
        '<tr style="font-size:0.85rem; font-weight:bold; background:#ffffff; color:#000000;">';
      html +=
        '<td colspan="3" style="padding:10px; border:1px solid #000;">' +
        labelSubAkhir +
        "</td>";
      html +=
        '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap;">' +
        formatUang(subAwal + subDb - subCr) +
        "</td>";
      html += '<td style="padding:2px; border:1px solid #000;"></td></tr>';
    }

    var totalAwal = golterfilter.reduce(
      (sum, i) => sum + (parseFloat(i.awal || 0) || 0),
      0,
    );
    var totalDb = golterfilter.reduce(
      (sum, i) => sum + (parseFloat(i.db || i.debit || 0) || 0),
      0,
    );
    var totalCr = golterfilter.reduce(
      (sum, i) => sum + (parseFloat(i.cr || i.kredit || 0) || 0),
      0,
    );

    html +=
      '<tr style="font-size:0.85rem; font-weight:bold; background:#ffffff; color:#000000;">';
    html +=
      '<td colspan="3" style="padding:10px; border:1px solid #000;">TOTAL NERACA</td>';
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap;">' +
      formatUang(totalAwal + totalDb - totalCr) +
      "</td>";
    html += '<td style="padding:10px; border:1px solid #000;"></td></tr>';

    html += "</tbody></table></div>";
    area.innerHTML = html;
  } catch (error) {
    console.error("❌ Gagal total:", error);
    if (area) {
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Terjadi kesalahan sistem: ' +
        error.message +
        "</div>";
    }
  }
}

// =========================================================================
// FUNGSI LIHAT DETIL TRANSAKSI (BUKU BESAR)
// =========================================================================
function lihatDetilTransaksi(noPerkiraan, masa, cabang) {
  var duadigittahun = masa.substring(2, 4);
  var tahun = "20" + duadigittahun;
  var namaStore = "transaksi" + tahun;

  // ✅ PERBAIKAN 1: PENGAMAN KATA "UNDEFINED"
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA"; // Default cadangan

  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var popupId = "popup_transaksi_" + Date.now();

  var popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:50%; max-width:700px; max-height:90vh; background:#000; border:2px solid #4da3ff; box-shadow:0 0 20px rgba(77, 163, 255, 0.5); z-index:10001; display:flex; flex-direction:column; border-radius:8px;">' +
    '<div style="padding:12px; background:#1a1a1a; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; border-radius:8px 8px 0 0;">' +
    '<strong style="font-size:0.9rem; color:#4da3ff;">Detil Transaksi  ' +
    noPerkiraan +
    ' <small style="color:#888;">(Group: ' +
    activeGroup + // Sekarang akan menulis "TLGA" dengan benar
    ")</small>" +
    "</strong>" +
    "<button onclick=\"document.getElementById('" +
    popupId +
    '\').remove()" style="background:none; border:none; font-size:1.5rem; line-height:1; cursor:pointer; color:#555;">&times;</button>' +
    "</div>" +
    '<div id="' +
    popupId +
    '_body" style="padding:10px; overflow-y:auto; flex:1; font-size:0.8rem;">' +
    '<div style="text-align:center; padding:20px; color:#666;">Loading...</div>' +
    "</div>" +
    "</div>";

  document.body.insertAdjacentHTML("beforeend", popupHtml);
  var container = document.getElementById(popupId + "_body");

  db.getAll(namaStore)
    .then(function (rawData) {
      var listTrans = Array.isArray(rawData) ? rawData : [];
      var masaCari = masa;

      var cabInput = String(cabang || "")
        .trim()
        .toUpperCase();

      var detilTrans = listTrans.filter(function (t) {
        var tNo = String(t.noper || "").trim();
        var tCab = String(t.cabang || "")
          .trim()
          .toUpperCase();
        var tMasa = String(t.masa || "").trim();

        // ✅ PERBAIKAN 2: LOGIKA PUSAT (SEMUA CABANG)
        // Jika PUSAT atau ALL, maka tampilkan semua cabang. Jika bukan, samakan dengan data.
        var cocokCabang =
          cabInput === "PUSAT" ||
          cabInput === "ALL" ||
          cabInput === "" ||
          tCab === cabInput;

        // Filter Group di database transaksi
        var tGroup = String(t.group || "")
          .trim()
          .toUpperCase();
        var cocokGroup = tGroup === activeGroup;

        return (
          tNo === noPerkiraan && tMasa === masaCari && cocokCabang && cocokGroup
        );
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:20px; color:orange;">' +
          "Data tidak ditemukan.<br><br>" +
          "<small>Dicari No Perkiraan: " +
          noPerkiraan +
          " | Group: " +
          activeGroup +
          " | Masa: " +
          masaCari +
          " | Cabang Terpilih: " +
          cabInput +
          "</small>" +
          "</div>";
        return;
      }

      var tableHtml =
        '<div style="overflow-x:auto; background-color:#000000; color:#ffffff;">' +
        '<table style="width:100%; border-collapse:collapse; font-size:0.75rem; min-width:500px; background-color:#000000; color:#ffffff;">' +
        '<thead style="background:#1a1a1a; position:sticky; top:0; color:#ffffff;"><tr>' +
        '<th style="border:1px solid #444; padding:5px;">TANGGAL</th>' +
        '<th style="border:1px solid #444; padding:5px;">NOREFF</th>' +
        '<th style="border:1px solid #444; padding:5px;">DESC</th>' +
        '<th style="border:1px solid #444; padding:5px; text-align:right;">DEBET</th>' +
        '<th style="border:1px solid #444; padding:5px; text-align:right;">KREDIT</th>' +
        "</tr></thead><tbody>";

      var totalDb = 0;
      var totalCr = 0;

      detilTrans.forEach(function (t) {
        var tgl = t.tanggal || "-";
        var ref = t.noreff || "-";
        var ket = t.penjelasan || "-";
        var dbVal = num(t.db || 0);
        var crVal = num(t.cr || 0);

        totalDb += dbVal;
        totalCr += crVal;

        tableHtml +=
          "<tr>" +
          '<td style="border:1px solid #ddd; padding:4px;">' +
          tgl +
          "</td>" +
          '<td style="border:1px solid #ddd; padding:4px;">' +
          ref +
          "</td>" +
          '<td style="border:1px solid #ddd; padding:4px;">' +
          ket +
          "</td>" +
          '<td style="border:1px solid #ddd; padding:4px; text-align:right;">' +
          fmtN(dbVal) +
          "</td>" +
          '<td style="border:1px solid #ddd; padding:4px; text-align:right;">' +
          fmtN(crVal) +
          "</td>" +
          "</tr>";
      });

      tableHtml +=
        '<tr style="background:#f4f4f4; font-weight:bold;">' +
        '<td colspan="3" style="border:1px solid #ccc; padding:5px; text-align:right; color:#000;">TOTAL</td>' +
        '<td style="border:1px solid #ccc; padding:5px; text-align:right; color:#000;">' +
        fmtN(totalDb) +
        "</td>" +
        '<td style="border:1px solid #ccc; padding:5px; text-align:right; color:#000;">' +
        fmtN(totalCr) +
        "</td>" +
        "</tr>";

      tableHtml += "</tbody></table></div>";
      container.innerHTML = tableHtml;
    })
    .catch(function (err) {
      console.error(err);
      container.innerHTML =
        '<div style="text-align:center; padding:20px; color:red;">Error: ' +
        err.message +
        "</div>";
    });
}
function downloadNeracaExcel() {
  if (!window.golterfilter || window.golterfilter.length === 0) {
    if (typeof toast === "function") toast("Tidak ada data tabel.", "err");
    return;
  }

  var area = document.getElementById("tempat_tabel_preview");
  var table = area ? area.querySelector("table") : null;

  if (!table) {
    if (typeof toast === "function") toast("Belum ada data tabel.", "err");
    return;
  }

  try {
    var tableClone = table.cloneNode(true);

    // Ambil parameter data untuk judul laporan
    var masa = window._neracaFilterMasa || "Semua";
    // Cari elemen nama cabang dari filter UI, sesuaikan ID elemen jika berbeda (misal: "fk_cabang" atau "filter_cabang")
    var namaCabang = document.getElementById("fk_cabang")
      ? document.getElementById("fk_cabang").value
      : window._neracaFilterCabang || "Pusat";
    var activeGroupLabel = localStorage.getItem("group") || "TLGA";

    // ✅ TINGKATKAN EXCEL: Sisipkan Judul Laporan di baris paling atas tabel kloning
    var tbody = tableClone.querySelector("tbody") || tableClone;
    var firstRow = tableClone.rows[0];

    // Hitung total kolom tabel asli untuk menggabungkan kolom judul (colspan)
    var totalKolom = firstRow ? firstRow.cells.length : 5;

    // Buat element penampung baris judul baru
    var headerContainer = document.createElement("tr");
    headerContainer.innerHTML = `
      <td colspan="${totalKolom}" style="font-weight:bold; font-size:16px; text-align:left; border:none; padding:5px 0;">
        LAPORAN NERACA ${namaCabang.toUpperCase()}
      </td>
    `;

    var periodContainer = document.createElement("tr");
    periodContainer.innerHTML = `
      <td colspan="${totalKolom}" style="font-weight:bold; font-size:12px; text-align:left; border:none; padding:3px 0 15px 0;">
        PERIODE: ${masa.toUpperCase()} | GROUP: ${activeGroupLabel.toUpperCase()}
      </td>
    `;

    // Sisipkan judul di baris paling depan (sebelum content header tabel utama)
    tableClone.insertBefore(periodContainer, tableClone.firstChild);
    tableClone.insertBefore(headerContainer, tableClone.firstChild);

    // Looping baris tabel asli (indeks otomatis bergeser karena ada baris judul baru di atas)
    for (var i = 0; i < tableClone.rows.length; i++) {
      var row = tableClone.rows[i];

      // Lewati pembersihan format untuk 2 baris judul yang baru saja kita tambahkan
      if (i < 2) continue;

      for (var j = 0; j < row.cells.length; j++) {
        row.cells[j].removeAttribute("onclick");
      }

      if (row.cells.length >= 5) {
        var cellMasa = row.cells[2];
        var textMasa = cellMasa.innerText || cellMasa.textContent;
        cellMasa.innerHTML = '<span style="color:white;">\'</span>' + textMasa;
        cellMasa.setAttribute(
          "style",
          "mso-number-format:\\@; " + (cellMasa.getAttribute("style") || ""),
        );

        var cellCabang = row.cells[4];
        var textCabang = cellCabang.innerText || cellCabang.textContent;
        cellCabang.innerHTML =
          '<span style="color:white;">\'</span>' + textCabang;
        cellCabang.setAttribute(
          "style",
          "mso-number-format:\\@; " + (cellCabang.getAttribute("style") || ""),
        );

        var cellSaldo = row.cells[3];
        var textSaldo = cellSaldo.innerText || cellSaldo.textContent;
        var nilaiAngka = textSaldo.replace(/\./g, "").replace(/,/g, ".");
        var numVal = parseFloat(nilaiAngka);

        if (!isNaN(numVal)) {
          cellSaldo.setAttribute("x:num", numVal);
          cellSaldo.setAttribute(
            "style",
            "mso-number-format:#\\.##0; text-align:right; " +
              (cellSaldo.getAttribute("style") || ""),
          );
        }
      }
    }

    var htmlContent = tableClone.outerHTML;
    var blob = new Blob(["\ufeff", htmlContent], {
      type: "application/vnd.ms-excel",
    });

    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;

    var fileMasa = masa.replace(/[^a-zA-Z0-9\-]/g, "_");
    a.download =
      "Laporan_Neraca_" + fileMasa + "_Group_" + activeGroupLabel + ".xls";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof toast === "function")
      toast("File Excel berhasil diunduh.", "success");
  } catch (err) {
    console.error(err);
    if (typeof toast === "function") toast("Gagal download.", "err");
  }
}
async function lihatDetilPerkiraan(kodeGol, masa, cabang) {
  var duadigittahun = masa.substring(2, 4);
  var tahunAktif = "20" + duadigittahun;
  var namaStoreBackup = "perkiraan" + tahunAktif;
  var kodeMasa = masa;

  // ✅ PERBAIKAN 1: PENGAMAN KATA "UNDEFINED"
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA"; // Default cadangan

  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  if (typeof openModal === "function") {
    openModal(
      "Detil Perkiraan: " + kodeGol,
      '<div style="text-align:center; padding:2rem;"><span class="spinner"></span><br>Memuat data...</div>',
      "",
    );
  } else {
    // Jika tidak ada modal (mode Viewer), gunakan alert biasa
    alert("Fitur ini hanya tersedia di halaman utama (Admin).");
    return;
  }

  try {
    var rawData = await db.getAll(namaStoreBackup);
    var listPerkiraan = Array.isArray(rawData) ? rawData : [];

    var detilFilter = listPerkiraan.filter(function (p) {
      var noPerk = String(p.noper || p.noperkiraan || "").trim();
      var prefixGol = noPerk.substring(0, 3);

      var masaData = String(p.masa || p.periode || p.kode_masa || "").trim();
      var cabangData = String(p.cabang || p.cab || p.kode_cabang || "").trim();

      var cocokGolMasa =
        prefixGol === String(kodeGol).trim() && masaData === masa;

      // ✅ PERBAIKAN 2: LOGIKA PUSAT (SEMUA CABANG)
      var cabangUpper = String(cabang).trim().toUpperCase();
      var cocokCabang =
        cabangUpper === "PUSAT" ||
        cabangUpper === "ALL" ||
        cabangUpper === "" ||
        cabangData === String(cabang).trim();

      // Filter Group di database perkiraan
      var groupData = String(p.group || "")
        .trim()
        .toUpperCase();
      var cocokGroup = groupData === activeGroup;

      return cocokGolMasa && cocokCabang && cocokGroup;
    });

    if (detilFilter.length === 0) {
      $("modalBody").innerHTML =
        '<div style="text-align:center; padding:1rem; color:var(--muted);">Tidak ada data perkiraan untuk Golongan ' +
        kodeGol +
        " di tahun " +
        tahunAktif +
        " untuk Group: " +
        activeGroup + // Sekarang ini akan menulis "TLGA" bukan "undefined"
        ".</div>";

      setTimeout(function () {
        var modalEl =
          document.querySelector(".modal") || document.getElementById("modal");
        if (modalEl) {
          modalEl.style.top = "20px";
          modalEl.style.left = "20px";
          modalEl.style.transform = "none";
          modalEl.style.maxWidth = "45%";
          modalEl.style.width = "600px";
        }
      }, 50);
      return;
    }

    var htmlTable =
      '<div style="max-height:500px; overflow-y:auto; border:1px solid var(--brd);">' +
      '<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">' +
      "<thead>" +
      '<tr style="background:var(--bg2); font-weight:bold; position:sticky; top:0; z-index:5;">' +
      '<th style="border:1px solid #ccc; padding:8px;">GOL</th>' +
      '<th style="border:1px solid #ccc; padding:8px;">NO PERKIRAAN</th>' +
      '<th style="border:1px solid #ccc; padding:8px;">NAMA PERKIRAAN</th>' +
      '<th style="border:1px solid #ccc; padding:8px; text-align:right;">AWAL</th>' +
      '<th style="border:1px solid #ccc; padding:8px; text-align:right;">DEBET</th>' +
      '<th style="border:1px solid #ccc; padding:8px; text-align:right;">KREDIT</th>' +
      '<th style="border:1px solid #ccc; padding:8px; text-align:right;">AKHIR</th>' +
      "</tr>" +
      "</thead>" +
      "<tbody>";

    detilFilter.forEach(function (row) {
      var g = row.gol || row.golongan || "";
      var no = row.noper || row.noperkiraan || "";
      var nm = row.penjelasan || row.nama || "";
      var aw = num(row.awal || 0);
      var db = num(row.db || 0);
      var cr = num(row.cr || 0);
      var ak = aw + db - cr;

      htmlTable +=
        "<tr>" +
        '<td style="border:1px solid #ccc; padding:6px;">' +
        g +
        "</td>" +
        "<td onclick=\"lihatDetilTransaksi('" +
        no +
        "', '" +
        kodeMasa +
        "', '" +
        cabang +
        "')\" " +
        'style="border:1px solid #ccc; padding:6px; cursor:pointer; color:green; font-weight:bold; text-decoration:underline;">' +
        no +
        "</td>" +
        '<td style="border:1px solid #ccc; padding:6px;">' +
        nm +
        "</td>" +
        '<td style="border:1px solid #ccc; padding:6px; text-align:right;">' +
        fmtN(aw) +
        "</td>" +
        '<td style="border:1px solid #ccc; padding:6px; text-align:right;">' +
        fmtN(db) +
        "</td>" +
        '<td style="border:1px solid #ccc; padding:6px; text-align:right;">' +
        fmtN(cr) +
        "</td>" +
        '<td style="border:1px solid #ccc; padding:6px; text-align:right; font-weight:bold;">' +
        fmtN(ak) +
        "</td>" +
        "</tr>";
    });

    htmlTable += "</tbody></table></div>";

    $("modalBody").innerHTML = htmlTable;
    $("modalFoot").innerHTML =
      '<button class="btn btn-g" onclick="closeModal()">Tutup</button>';

    setTimeout(function () {
      var modalEl =
        document.querySelector(".modal") || document.getElementById("modal");
      if (modalEl) {
        modalEl.style.position = "fixed";
        modalEl.style.top = "20px";
        modalEl.style.left = "20px";
        modalEl.style.right = "auto";
        modalEl.style.margin = "0";
        modalEl.style.transform = "none";
        modalEl.style.maxWidth = "45%";
        modalEl.style.width = "600px";
        modalEl.style.zIndex = "10000";
      }
    }, 50);
  } catch (error) {
    console.error(error);
    $("modalBody").innerHTML =
      '<div style="color:red; text-align:center;">Gagal memuat data: ' +
      error.message +
      "</div>";
  }
}

/* ---------- Detil Neraca ---------- */
PANEL_MAP.detilNeraca = renderDetilNeraca;
// TAMBAHKAN PARAMETER "group" DI SINI
// =========================================================================
// 1. RENDER ANTARMUKA DETIL NERACA (SINKRON - TANPA ASYNC)
// =========================================================================
function renderDetilNeraca(kodemasa, kodeCabang, group) {
  // 1. PENGAMAN JIKA PARAMETER TIDAK TERKIRIM
  if (!kodemasa) kodemasa = window._neracaFilterMasa || "";
  if (!kodeCabang) kodeCabang = window._neracaFilterCabang || "PUSAT";

  // Konversi format masa (dari "MM-YYYY" jadi "MMYY") untuk pencarian DB
  var partMasa = kodemasa.split("-");
  var inputMonthValue = "";
  var kodemasadicari = "";

  if (partMasa.length === 2) {
    var filterBulan = partMasa[0];
    var filterTahunFull = partMasa[1];
    kodemasadicari = filterBulan + filterTahunFull.substring(2, 4);
    inputMonthValue = filterTahunFull + "-" + filterBulan;
  } else {
    kodemasadicari = kodemasa;
    inputMonthValue = kodemasa;
  }

  // ==========================================
  // CEK LEVEL USER: PUSAT ATAU BUKAN?
  // ==========================================
  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";

  // 2. PENGAMAN GROUP UNDEFINED
  var activeGroup = "TLGA";
  if (
    group &&
    group.trim() !== "" &&
    group.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = group.trim().toUpperCase();
  } else {
    activeGroup = localStorage.getItem("group") || "TLGA";
  }

  // ==========================================
  // SIAPKAN DROPDOWN GROUP (HANYA UNTUK PUSAT)
  // ==========================================
  var groupUiHtml = "";
  if (isPusat) {
    groupUiHtml =
      '<div style="display:flex; align-items:center; gap:5px;">' +
      '<label style="font-size:.75rem; color:var(--muted);">Filter Group:</label>' +
      '<select id="filter_neraca_detil_group" onchange="gantiGroupLaporan(\'neraca_detil\', \'renderDetilNeraca\')" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; font-weight:bold;">';

    var listGroup =
      (typeof DBCache !== "undefined" && DBCache.groupproject) || [];
    if (listGroup.length === 0) {
      groupUiHtml += '<option value="TLGA">TLGA</option>';
    } else {
      listGroup.forEach(function (g) {
        var val = String(g.kode || g.nama || g.group || "").trim();
        var label = (g.kode ? g.kode + " - " : "") + (g.nama || g.group || val);
        if (!val) return;
        groupUiHtml +=
          '<option value="' +
          esc(val) +
          '"' +
          (val === activeGroup ? " selected" : "") +
          ">" +
          esc(label) +
          "</option>";
      });
    }

    groupUiHtml += "</select></div>";
  } else {
    groupUiHtml =
      '<div style="font-size:.8rem; color:var(--muted);">Group: <span style="color:var(--accent); font-weight:bold;">' +
      esc(activeGroup) +
      "</span></div>";
  }

  // 3. SIAPKAN OPSI CABANG (SESUAI GROUP AKTIF)
  var rawCabang = (typeof DBCache !== "undefined" && DBCache.cabang) || [];
  var daftarCabangObj = [];
  rawCabang.forEach(function (c) {
    var id = (c.kode || c.cabang || "").trim();
    var nama = (c.nama || id || "Tanpa Nama").trim();
    var groupCabang = (c.group || "").trim().toUpperCase();
    if (id && (activeGroup === "ALL_GROUP" || groupCabang === activeGroup)) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });
  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  var adaPusat = daftarCabangObj.some(function (item) {
    return item.id.toUpperCase() === "PUSAT" || item.id === "00";
  });
  if (!adaPusat) {
    daftarCabangObj.unshift({
      id: "PUSAT",
      nama: "PUSAT (SEMUA CABANG)",
    });
  }

  var kodeDefault = (kodeCabang || "PUSAT").toUpperCase();
  var opsiCabangHtml = daftarCabangObj
    .map(function (item) {
      var sel = item.id.toUpperCase() === kodeDefault ? " selected" : "";
      return (
        '<option value="' +
        item.id +
        '"' +
        sel +
        ">" +
        item.id +
        " - " +
        item.nama.toUpperCase() +
        "</option>"
      );
    })
    .join("");

  // 4. RENDER HTML ANTARMUKA
  var htmlLaporan =
    '<div id="area_cetak_neraca_detil" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan Detil Neraca (Perkiraan)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:1rem;">' +
    groupUiHtml +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Masa:</label>' +
    '<input type="month" id="filter_neraca_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Cabang:</label>' +
    '<select id="filter_neraca_cabang" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; min-width:120px;">' +
    opsiCabangHtml +
    "</select>" +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiDetilNeraca()">Tampilkan Data</button>' +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadDetilNeracaExcel()"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    "</div>" +
    '<div class="table-responsive-container" style="width:100%; height:380px; max-height:380px; overflow:auto; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box;">' +
    "<style>" +
    "#tempat_tabel_preview table { width: 100% !important; min-width: 1000px !important; border-collapse: collapse !important; table-layout: auto !important; }" +
    "#tempat_tabel_preview th { padding: 8px 10px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; text-align:left; }" +
    "#tempat_tabel_preview td { padding: 6px 10px !important; border: 1px solid var(--brd); font-size:0.85rem; }" +
    "</style>" +
    '<div id="tempat_tabel_preview" style="width:100%; display:block; text-align:left;">' +
    '<p style="padding:2rem; text-align:center; color:var(--muted);">Klik tombol "Tampilkan Data" untuk memuat detail perkiraan.</p>' +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>";

  return htmlLaporan;
}

// =========================================================================
// 2. FUNGSI EKSEKUSI TAMPILKAN DETIL NERACA
// =========================================================================
async function terapkanOpsiDetilNeraca() {
  var inputmasa = document.getElementById("filter_neraca_masa");
  var selectcabang = document.getElementById("filter_neraca_cabang");
  var selectgroup = document.getElementById("filter_neraca_detil_group");

  if (!inputmasa || !selectcabang) {
    console.warn("Elemen filter belum ditemukan.");
    return;
  }

  // SIMPAN GROUP TERPILIK KE LOCALSTORAGE
  if (selectgroup && selectgroup.value) {
    localStorage.setItem("group", selectgroup.value);
  }

  var valmasa = inputmasa.value; // Format: YYYY-MM
  var valcabang = selectcabang.value;

  if (!valmasa) {
    if (typeof toast === "function")
      toast("Silakan pilih masa/periode terlebih dahulu", "err");
    return;
  }

  if (typeof closeModal === "function") closeModal();

  // Parsing Tanggal
  var part = valmasa.split("-");
  var filtertahunfull = part[0];
  var filterbulan = part[1];
  var duadigittahunbelakang = filtertahunfull.substring(2, 4);
  var kodemasadicari = filterbulan + duadigittahunbelakang; // Format: MMYY

  var namaStorePerkiraan = "perkiraan" + filtertahunfull;

  window._neracaFilterMasa = filterbulan + "-" + filtertahunfull;
  window._neracaFilterCabang = valcabang;

  var area =
    document.getElementById("tempat_tabel_preview") ||
    document.getElementById("contentarea");

  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 memuat data perkiraan...</div>';
  }

  try {
    var resPerkiraan = await db.getAll(namaStorePerkiraan);
    var rawDataPerkiraan = resPerkiraan
      ? Array.isArray(resPerkiraan)
        ? resPerkiraan
        : Object.values(resPerkiraan)
      : [];

    var activeGroup =
      (selectgroup ? selectgroup.value : "") ||
      localStorage.getItem("group") ||
      (typeof getActiveGroup === "function" ? getActiveGroup() : "TLGA");

    activeGroup = String(activeGroup).trim().toUpperCase();
    if (activeGroup === "UNDEFINED" || !activeGroup) {
      activeGroup = "TLGA";
    }

    // Filter Data Perkiraan
    let detilTerfilter = rawDataPerkiraan
      .filter(function (p) {
        var kodeGol = parseInt(p.gol || p.golongan || 0, 10);
        var cocokGolongan = kodeGol < 300;

        var cocokGroup =
          String(p.group || "")
            .trim()
            .toUpperCase() === activeGroup;

        var cabangData = String(p.cabang || p.cab || "").trim();
        var masaData = String(p.masa || p.periode || "").trim();

        var cocokCabang =
          valcabang === "PUSAT" ||
          valcabang === "ALL" ||
          valcabang === "" ||
          cabangData === valcabang;
        var cocokMasa = masaData === kodemasadicari;

        var nilaiAwal = parseFloat(p.awal || 0);
        var nilaiDb = parseFloat(p.db || 0);
        var nilaiCr = parseFloat(p.cr || 0);
        var adaNilai = nilaiAwal !== 0 || nilaiDb !== 0 || nilaiCr !== 0;

        return (
          cocokGolongan && cocokGroup && cocokMasa && cocokCabang && adaNilai
        );
      })
      .sort(function (a, b) {
        var perA = String(a.noper || a.noPerk || "");
        var perB = String(b.noper || b.noPerk || "");
        return perA.localeCompare(perB, undefined, { numeric: true });
      });

    if (detilTerfilter.length === 0) {
      if (area) {
        area.innerHTML =
          '<div style="padding:3rem; text-align:center; color:var(--muted);">Tidak ada data perkiraan ditemukan untuk filter ini.</div>';
      }
      return;
    }

    window._detilNeracaData = detilTerfilter;

    var html = "";
    var subAwal = 0,
      subDb = 0,
      subCr = 0;
    var totalAwal = 0,
      totalDb = 0,
      totalCr = 0;
    var current3DigitPrefix = "";

    html += '<div style="width: 100%; overflow-x: auto;">';
    html +=
      '<table border="1" style="width:100%; min-width: 800px; border-collapse: collapse; text-align:left; color:#000; border: 1px solid #000;">';

    html += '<thead style="background:#eee; font-weight:bold;"><tr>';
    html +=
      '<th style="padding:8px; border:1px solid #000;">NO. PERKIRAAN</th>';
    html +=
      '<th style="padding:8px; border:1px solid #000;">NAMA PERKIRAAN</th>';
    html +=
      '<th style="padding:8px; border:1px solid #000; text-align:right;">SALDO AWAL</th>';
    html +=
      '<th style="padding:8px; border:1px solid #000; text-align:right;">DEBET</th>';
    html +=
      '<th style="padding:8px; border:1px solid #000; text-align:right;">KREDIT</th>';
    html +=
      '<th style="padding:8px; border:1px solid #000; text-align:right;">SALDO AKHIR</th>';
    html +=
      '<th style="padding:8px; border:1px solid #000; text-align:center;">AKSI</th>';
    html += "</tr></thead><tbody>";

    detilTerfilter.forEach(function (item) {
      var noPerk = item.noper || item.noPerk || "";
      var item3DigitPrefix = String(noPerk).substring(0, 3);

      var nilaiAwal = parseFloat(item.awal || 0);
      var nilaiDb = parseFloat(item.db || 0);
      var nilaiCr = parseFloat(item.cr || 0);
      var nilaiAkhir = nilaiAwal + nilaiDb - nilaiCr;

      if (
        current3DigitPrefix !== "" &&
        item3DigitPrefix !== current3DigitPrefix
      ) {
        html += '<tr style="font-weight:bold; background:#f9f9f9;">';
        html +=
          '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right; color:blue;">TOTAL KELOMPOK ' +
          current3DigitPrefix +
          "</td>";
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
          formatUang(subAwal) +
          "</td>";
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
          formatUang(subDb) +
          "</td>";
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
          formatUang(subCr) +
          "</td>";
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
          formatUang(subAwal + subDb - subCr) +
          "</td>";
        html += '<td style="padding:2px; border:1px solid #000;"></td></tr>';
        subAwal = 0;
        subDb = 0;
        subCr = 0;
      }

      current3DigitPrefix = item3DigitPrefix;
      subAwal += nilaiAwal;
      subDb += nilaiDb;
      subCr += nilaiCr;
      totalAwal += nilaiAwal;
      totalDb += nilaiDb;
      totalCr += nilaiCr;

      html += "<tr>";
      html +=
        "<td onclick=\"lihatBukuBesar('" +
        noPerk +
        "', '" +
        kodemasadicari +
        "', '" +
        valcabang +
        '\')" style="padding:6px; border:1px solid #000; cursor:pointer; color:green; text-decoration:underline; font-weight:bold;">' +
        noPerk +
        "</td>";
      html +=
        '<td style="padding:6px; border:1px solid #000;">' +
        (item.penjelasan || item.nama || "-") +
        "</td>";
      html +=
        '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
        formatUang(nilaiAwal) +
        "</td>";
      html +=
        '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
        formatUang(nilaiDb) +
        "</td>";
      html +=
        '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
        formatUang(nilaiCr) +
        "</td>";
      html +=
        '<td style="padding:6px; border:1px solid #000; text-align:right; font-weight:bold;">' +
        formatUang(nilaiAkhir) +
        "</td>";
      html +=
        '<td style="padding:4px; border:1px solid #000; text-align:center;">';
      html +=
        '<button type="button" class="btn btn-g" style="font-size:0.7rem; padding:2px 8px;" onclick="lihatBukuBesar(\'' +
        noPerk +
        "', '" +
        kodemasadicari +
        "', '" +
        valcabang +
        "')\">🔍</button>";
      html += "</td></tr>";
    });

    if (current3DigitPrefix !== "") {
      html += '<tr style="font-weight:bold; background:#f9f9f9;">';
      html +=
        '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right; color:blue;">TOTAL KELOMPOK ' +
        current3DigitPrefix +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
        formatUang(subAwal) +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
        formatUang(subDb) +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
        formatUang(subCr) +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
        formatUang(subAwal + subDb - subCr) +
        "</td>";
      html += '<td style="padding:2px; border:1px solid #000;"></td></tr>';
    }

    html += '<tr style="font-weight:bold; background:#e6f7ff;">';
    html +=
      '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right; color:red;">GRAND TOTAL DETIL NERACA</td>';
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:red;">' +
      formatUang(totalAwal) +
      "</td>";
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:red;">' +
      formatUang(totalDb) +
      "</td>";
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:red;">' +
      formatUang(totalCr) +
      "</td>";
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:red;">' +
      formatUang(totalAwal + totalDb - totalCr) +
      "</td>";
    html += '<td style="padding:2px; border:1px solid #000;"></td></tr>';

    html += "</tbody></table></div>";

    if (area) area.innerHTML = html;
  } catch (err) {
    console.error(err);
    if (area) {
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:red;">Terjadi kesalahan saat memproses data: ' +
        err.message +
        "</div>";
    }
  }
}

function lihatBukuBesar(noPerkiraan, masa, cabang) {
  // Parsing Tahun
  var duadigittahun = masa.substring(2, 4);
  var tahun = "20" + duadigittahun;
  var namaStoreTransaksi = "transaksi" + tahun;
  var namaStorePerkiraan = "perkiraan" + tahun; // Untuk mengambil saldo awal

  // ✅ PERBAIKAN 1: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var popupId = "popup_bukubesar_" + Date.now();

  // HTML Popup
  var popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:55%; max-width:700px; max-height:90vh; background:white; border:1px solid #aaa; box-shadow:0 5px 15px rgba(0,0,0,0.5); z-index:10001; display:flex; flex-direction:column; border-radius:6px;">' +
    '<div style="padding:10px 15px; background:#333; color:white; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center; border-radius:6px 6px 0 0;">' +
    "<div>" +
    '<strong style="font-size:0.95rem;">Buku Besar: ' +
    noPerkiraan +
    "</strong><br>" +
    '<span style="font-size:0.75rem; opacity:0.8;">Group: <b>' +
    activeGroup +
    "</b> | Cabang: " +
    cabang.toUpperCase() +
    " | Masa: " +
    masa +
    "</span>" +
    "</div>" +
    "<button onclick=\"document.getElementById('" +
    popupId +
    '\').remove()" style="background:none; border:none; font-size:1.5rem; line-height:1; cursor:pointer; color:white;">&times;</button>' +
    "</div>" +
    '<div id="' +
    popupId +
    '_body" style="padding:0; overflow-y:auto; flex:1; font-size:0.8rem; background:#fff;">' +
    '<div style="text-align:center; padding:20px; color:#666;">Memuat data awal & transaksi...</div>' +
    "</div>" +
    "</div>";

  document.body.insertAdjacentHTML("beforeend", popupHtml);
  var container = document.getElementById(popupId + "_body");

  // ✅ PERBAIKAN 3: AMBIL SALDO AWAL DARI TABEL PERKIRAAN DULU
  db.getAll(namaStorePerkiraan)
    .then(function (rawPerkiraan) {
      var listPerkiraan = Array.isArray(rawPerkiraan) ? rawPerkiraan : [];
      var cabInput = String(cabang || "")
        .trim()
        .toUpperCase();

      var saldoAwal = 0;
      listPerkiraan.forEach(function (p) {
        var pNo = String(p.noper || p.noperkiraan || "").trim();
        var pCab = String(p.cabang || p.kode_cabang || "")
          .trim()
          .toUpperCase();
        var pMasa = String(p.masa || p.periode || "").trim();
        var pGroup = String(p.group || "")
          .trim()
          .toUpperCase();

        var cocokNo = pNo === noPerkiraan;
        var cocokMasa = pMasa === masa;
        // ✅ PERBAIKAN 2: JIKA PUSAT, AMBIL SEMUA CABANG
        var cocokCab =
          cabInput === "PUSAT" ||
          cabInput === "ALL" ||
          cabInput === "" ||
          pCab === cabInput;
        var cocokGroup = pGroup === activeGroup;

        if (cocokNo && cocokMasa && cocokCab && cocokGroup) {
          saldoAwal += parseFloat(p.awal || 0);
        }
      });

      // LANJUT AMBIL DATA TRANSAKSI
      return db.getAll(namaStoreTransaksi).then(function (rawData) {
        var listTrans = Array.isArray(rawData) ? rawData : [];

        // Filter Transaksi
        var detilTrans = listTrans.filter(function (t) {
          var tNo = String(t.noper || "").trim();
          var tCab = String(t.cabang || t.kode_cabang || "")
            .trim()
            .toUpperCase();
          var tMasa = String(t.masa || t.periode || "").trim();
          var tGroup = String(t.group || "")
            .trim()
            .toUpperCase();

          var cocokCabang =
            cabInput === "PUSAT" ||
            cabInput === "ALL" ||
            cabInput === "" ||
            tCab === cabInput;
          var cocokGroup = tGroup === activeGroup;

          return (
            tNo === noPerkiraan && tMasa === masa && cocokCabang && cocokGroup
          );
        });

        if (detilTrans.length === 0 && saldoAwal === 0) {
          container.innerHTML =
            '<div style="text-align:center; padding:30px; color:#777;">' +
            "Tidak ada transaksi & saldo awal untuk akun ini.<br><br>" +
            "<small>No. Perkiraan: " +
            noPerkiraan +
            " | Group: " +
            activeGroup +
            " | Masa: " +
            masa +
            " | Cabang Terpilih: " +
            cabInput +
            "</small>" +
            "</div>";
          return;
        }

        // Sort Transaksi Berdasarkan Tanggal
        detilTrans.sort(function (a, b) {
          return (a.tanggal || "").localeCompare(b.tanggal || "");
        });

        // Render Tabel Transaksi
        var tableHtml =
          '<div style="overflow-x:auto; padding:10px;">' +
          '<table style="width:100%; border-collapse:collapse; font-size:0.8rem; min-width:500px;">' +
          '<thead style="background:#eee; position:sticky; top:0; border-bottom:2px solid #333;"><tr>' +
          '<th style="padding:8px; text-align:left;">TANGGAL</th>' +
          '<th style="padding:8px; text-align:left;">NO. REFF</th>' +
          '<th style="padding:8px; text-align:left;">URAIAN</th>' +
          '<th style="padding:8px; text-align:right;">DEBET</th>' +
          '<th style="padding:8px; text-align:right;">KREDIT</th>' +
          '<th style="padding:8px; text-align:right;">SALDO</th>' +
          "</tr></thead><tbody>";

        var totalDb = 0;
        var totalCr = 0;

        // ✅ GUNAKAN saldoAwal SEBAGAI SALDO BERJALAN AWAL
        var saldoBerjalan = saldoAwal;

        // Tampilkan Baris Saldo Awal
        if (saldoAwal !== 0) {
          tableHtml +=
            '<tr style="font-weight:bold; background:#fffcce;">' +
            '<td colspan="3" style="padding:6px; border-bottom:1px solid #eee; color: #333;">SALDO AWAL</td>' +
            '<td style="padding:6px; border-bottom:1px solid #eee; text-align:right; color: #333;">-</td>' +
            '<td style="padding:6px; border-bottom:1px solid #eee; text-align:right; color: #333;">-</td>' +
            '<td style="padding:6px; border-bottom:1px solid #eee; text-align:right; color: #333;">' +
            fmtN(saldoBerjalan) +
            "</td>" +
            "</tr>";
        }

        detilTrans.forEach(function (t) {
          var tgl = t.tanggal || "-";
          var ref = t.noreff || "-";
          var ket = t.penjelasan || "-";
          var dbVal = num(t.db || 0);
          var crVal = num(t.cr || 0);

          totalDb += dbVal;
          totalCr += crVal;

          // Hitung Saldo Berjalan
          saldoBerjalan = saldoBerjalan + dbVal - crVal;

          tableHtml +=
            "<tr>" +
            '<td style="padding:6px; border-bottom:1px solid #eee;color: #000;">' +
            tgl +
            "</td>" +
            '<td style="padding:6px; border-bottom:1px solid #eee;color: #000; mso-number-format:\\@;">' +
            ref +
            "</td>" +
            '<td style="padding:6px; border-bottom:1px solid #eee;color: #000;">' +
            ket +
            "</td>" +
            '<td style="padding:6px; border-bottom:1px solid #eee; color: #000;text-align:right;">' +
            fmtN(dbVal) +
            "</td>" +
            '<td style="padding:6px; border-bottom:1px solid #eee;color: #000; text-align:right;">' +
            fmtN(crVal) +
            "</td>" +
            '<td style="padding:6px; border-bottom:1px solid #eee; color: #000;text-align:right; font-weight:bold;">' +
            fmtN(saldoBerjalan) +
            "</td>" +
            "</tr>";
        });

        // Footer Total
        tableHtml +=
          '<tr style="background:#f4f4f4; font-weight:bold; border-top:2px solid #333;">' +
          '<td colspan="3" style="padding:8px; text-align:right;">TOTAL PERIODE INI</td>' +
          '<td style="padding:8px; text-align:right;color:blue;">' +
          fmtN(totalDb) +
          "</td>" +
          '<td style="padding:8px; text-align:right;color:blue;">' +
          fmtN(totalCr) +
          "</td>" +
          '<td style="padding:8px; text-align:right; color:red;">SALDO AKHIR: ' +
          fmtN(saldoBerjalan) +
          "</td>" +
          "</tr>";

        tableHtml += "</tbody></table></div>";
        container.innerHTML = tableHtml;
      }); // End db.getAll transaksi
    })
    .catch(function (err) {
      console.error(err);
      container.innerHTML =
        '<div style="text-align:center; padding:20px; color:red;">Error: ' +
        err.message +
        "</div>";
    });
}

async function downloadDetilNeracaExcel() {
  // ✅ PERBAIKAN 1: GANTI ID KONTAINER MENJADI "tempat_tabel_preview" (SESUAI FUNGSI TERAPKAN)
  var area = document.getElementById("tempat_tabel_preview");
  var table = area ? area.querySelector("table") : null;

  if (!table) {
    if (typeof toast === "function")
      toast("Tidak ada data tabel untuk didownload.", "err");
    return;
  }

  try {
    var tableClone = table.cloneNode(true);

    // Hapus Kolom Aksi (Kolom terakhir)
    for (var i = 0; i < tableClone.rows.length; i++) {
      var row = tableClone.rows[i];
      if (row.cells.length > 6) {
        row.deleteCell(-1);
      }
    }

    // Tambahkan tanda petik (') di depan No Perkiraan agar Excel tidak salah baca jadi angka
    for (var i = 1; i < tableClone.rows.length; i++) {
      var row = tableClone.rows[i];
      if (row.cells.length > 0) {
        var cellNoPerk = row.cells[0];
        var textPerk = cellNoPerk.innerText || cellNoPerk.textContent;
        var textPerkExcel = '<span style="color:white;">\'</span>' + textPerk;
        cellNoPerk.innerHTML = textPerkExcel;
        cellNoPerk.setAttribute(
          "style",
          "mso-number-format:\\@; " + (cellNoPerk.getAttribute("style") || ""),
        );
      }
    }

    if (tableClone.rows.length > 0) {
      tableClone.rows[0].cells[0].setAttribute(
        "style",
        "mso-number-format:\\@; " +
          (tableClone.rows[0].cells[0].getAttribute("style") || ""),
      );
    }

    var htmlContent = tableClone.outerHTML;
    var blob = new Blob(["\ufeff", htmlContent], {
      type: "application/vnd.ms-excel",
    });

    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var masa = (window._neracaFilterMasa || "Semua").replace(
      /[^a-zA-Z0-9\-]/g,
      "_",
    );

    // ✅ PERBAIKAN 2: PENGAMAN GROUP UNDEFINED DI NAMA FILE
    var rawGroup = localStorage.getItem("group");
    var activeGroupLabel = "TLGA";
    if (
      rawGroup &&
      rawGroup.trim() !== "" &&
      rawGroup.trim().toUpperCase() !== "UNDEFINED"
    ) {
      activeGroupLabel = rawGroup.trim().toUpperCase();
    }

    a.download = "Neraca_Detil_" + masa + "_Group_" + activeGroupLabel + ".xls";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof toast === "function")
      toast("File Excel Neraca Detil sedang didownload...", "ok");
  } catch (err) {
    console.error(err);
    if (typeof toast === "function") toast("Gagal download.", "err");
  }
}
/* ---------- RL Rekap ---------- */
PANEL_MAP.rlRekap = renderRLRekap;

// =========================================================================
// FUNGSI RENDER AWAL RL REKAP (UI Only - Tidak Load Data)
// =========================================================================
// =========================================================================
// 1. RENDER ANTARMUKA RL REKAP (SINKRON - TANPA ASYNC)
// =========================================================================
function renderRLRekap() {
  // A. SIAPKAN NILAI DEFAULT SAAT PERTAMA KALI DIBUKA
  if (typeof window._rlRekapFilterCabang === "undefined") {
    window._rlRekapFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "PUSAT";
  }

  if (typeof window._rlRekapFilterMasa === "undefined") {
    var d = new Date();
    var bln = ("0" + (d.getMonth() + 1)).slice(-2);
    window._rlRekapFilterMasa = bln + "-" + d.getFullYear();
  }

  // Pecah Masa untuk kebutuhan format Input HTML
  var partMasa = window._rlRekapFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];
  var inputMonthValue = filterTahunFull + "-" + filterBulan;

  // ==========================================
  // CEK LEVEL USER: PUSAT ATAU BUKAN?
  // ==========================================
  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";

  var activeGroup = localStorage.getItem("group") || "TLGA";

  // ==========================================
  // SIAPKAN DROPDOWN GROUP (HANYA UNTUK PUSAT)
  // ==========================================
  var groupUiHtml = "";
  if (isPusat) {
    groupUiHtml =
      '<div style="display:flex; align-items:center; gap:5px;">' +
      '<label style="font-size:.75rem; color:var(--muted);">Filter Group:</label>' +
      '<select id="filter_rlrekap_group" onchange="gantiGroupLaporan(\'rlrekap\', \'renderRLRekap\')" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; font-weight:bold;">';

    var listGroup =
      (typeof DBCache !== "undefined" && DBCache.groupproject) || [];
    if (listGroup.length === 0) {
      groupUiHtml += '<option value="TLGA">TLGA</option>';
    } else {
      listGroup.forEach(function (g) {
        var val = String(g.kode || g.nama || g.group || "").trim();
        var label = (g.kode ? g.kode + " - " : "") + (g.nama || g.group || val);
        if (!val) return;
        groupUiHtml +=
          '<option value="' +
          esc(val) +
          '"' +
          (val === activeGroup ? " selected" : "") +
          ">" +
          esc(label) +
          "</option>";
      });
    }

    groupUiHtml += "</select></div>";
  } else {
    groupUiHtml =
      '<div style="font-size:.8rem; color:var(--muted);">Group: <span style="color:var(--accent); font-weight:bold;">' +
      esc(activeGroup) +
      "</span></div>";
  }

  // ==========================================
  // FILTER DROPDOWN CABANG SESUAI GROUP AKTIF
  // ==========================================
  var rawCabang = (typeof DBCache !== "undefined" && DBCache.cabang) || [];
  var daftarCabangObj = [];

  rawCabang.forEach(function (c) {
    var id = (c.kode || c.cabang || "").trim();
    var nama = (c.nama || id || "Tanpa Nama").trim();
    var groupCabang = (c.group || "").trim().toUpperCase();

    if (id && (activeGroup === "ALL_GROUP" || groupCabang === activeGroup)) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  // Pastikan opsi PUSAT selalu ada di paling atas
  var adaPusat = daftarCabangObj.some(function (item) {
    return item.id.toUpperCase() === "PUSAT" || item.id === "00";
  });
  if (!adaPusat) {
    daftarCabangObj.unshift({
      id: "PUSAT",
      nama: "PUSAT (SEMUA CABANG)",
    });
  }

  var kodeDefault = (window._rlRekapFilterCabang || "PUSAT").toUpperCase();

  var opsiCabangHtml = daftarCabangObj
    .map(function (item) {
      var sel = item.id.toUpperCase() === kodeDefault ? " selected" : "";
      return (
        '<option value="' +
        item.id +
        '" ' +
        sel +
        ">" +
        item.id +
        " - " +
        item.nama.toUpperCase() +
        "</option>"
      );
    })
    .join("");

  // C. RENDER HTML ANTARMUKA KOSONG
  var htmlLaporan =
    '<div id="area_cetak_rlrekap" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan RL Rekap </h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem;">' +
    groupUiHtml +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Masa:</label>' +
    '<input type="month" id="filter_rlrekap_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Cabang:</label>' +
    '<select id="filter_rlrekap_cabang" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; min-width:120px;">' +
    opsiCabangHtml +
    "</select>" +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiRLRekap()">Terapkan</button>' +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadRLRekapExcel()"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    "</div>" +
    '<div class="table-responsive-container" style="width:100%; max-width:100%; height:380px; max-height:380px; overflow:auto; display:block; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box; margin:0 auto; clear:both;">' +
    "<style>" +
    "#tempat_tabel_rlrekap table { width: 100% !important; min-width: 900px !important; border-collapse: collapse !important; table-layout: auto !important; margin:0 !important; }" +
    "#tempat_tabel_rlrekap th { padding: 8px 12px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; }" +
    "#tempat_tabel_rlrekap td { padding: 8px 12px !important; white-space: nowrap !important; border: 1px solid var(--brd); }" +
    "</style>" +
    '<div id="tempat_tabel_rlrekap" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data RL Rekap.</p>' +
    "</div>" +
    "</div>";

  return htmlLaporan;
}

// =========================================================================
// 2. FUNGSI EKSEKUSI TAMPILKAN DATA RL REKAP
// =========================================================================
async function terapkanOpsiRLRekap() {
  var inputmasa = document.getElementById("filter_rlrekap_masa");
  var selectcabang = document.getElementById("filter_rlrekap_cabang");
  var selectgroup = document.getElementById("filter_rlrekap_group");

  if (!inputmasa || !selectcabang) return;

  // SIMPAN GROUP TERPILIH KE LOCALSTORAGE
  if (selectgroup && selectgroup.value) {
    localStorage.setItem("group", selectgroup.value);
  }

  var valmasa = inputmasa.value;
  var valcabang = selectcabang.value;

  if (!valmasa) {
    if (typeof toast === "function")
      toast("Silakan pilih masa terlebih dahulu", "err");
    return;
  }

  if (typeof closeModal === "function") closeModal();

  var part = valmasa.split("-");
  var filtertahunfull = part[0];
  var filterbulan = part[1];
  var duadigittahunbelakang = filtertahunfull.substring(2, 4);

  window._rlRekapFilterMasa = filterbulan + "-" + filtertahunfull;
  window._rlRekapFilterCabang = valcabang;

  var kodemasadicari = filterbulan + duadigittahunbelakang;
  var namastoregolbackup = "golongan" + filtertahunfull;

  var area = document.getElementById("tempat_tabel_rlrekap");
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 Memuat data master & menghitung akumulasi...</div>';
  }

  try {
    var activeGroup =
      (selectgroup ? selectgroup.value : "") ||
      localStorage.getItem("group") ||
      (typeof getActiveGroup === "function" ? getActiveGroup() : "TLGA");

    activeGroup = String(activeGroup).trim().toUpperCase();
    if (activeGroup === "UNDEFINED" || !activeGroup) {
      activeGroup = "TLGA";
    }

    // 1. AMBIL DATA MASTER GOLONGAN
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};

    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namagol || m.nama || "").trim();
        var cabangMaster = String(m.cabang || "").trim();
        var groupMaster = String(m.group || "")
          .trim()
          .toUpperCase();

        var cocokCabang =
          valcabang === "PUSAT" ||
          valcabang === "ALL" ||
          valcabang === "" ||
          cabangMaster === valcabang;

        if (kode && cocokCabang && groupMaster === activeGroup) {
          mapMasterGol[kode] = nama;
        }
      });
    }

    // 2. AMBIL DATA BACKUP
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    // 3. Filter data HANYA untuk bulan yang dipilih
    var golBulanIni = rawdatagolongan
      .filter(function (g) {
        var kodeGolongan = parseInt(
          g.gol || g.golongan || g.kode_golongan || 0,
          10,
        );
        var cocokGolongan = kodeGolongan >= 300 && kodeGolongan < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        var cocokGroup =
          String(g.group || "")
            .trim()
            .toUpperCase() === activeGroup;

        var cocokCabang =
          valcabang === "PUSAT" ||
          valcabang === "ALL" ||
          valcabang === "" ||
          cabangData === valcabang;

        return (
          cocokGolongan &&
          cocokGroup &&
          masaData === kodemasadicari &&
          cocokCabang
        );
      })
      .sort(function (a, b) {
        return (
          parseInt(a.gol || a.golongan || 0, 10) -
          parseInt(b.gol || b.golongan || 0, 10)
        );
      });

    // 4. Hitung AKUMULASI SD BULAN LALU
    var mapAkmBulanLalu = {};
    if (parseInt(filterbulan, 10) > 1) {
      var dataSelainBulanIni = rawdatagolongan.filter(function (g) {
        var kodeGolongan = parseInt(g.gol || g.golongan || 0, 10);
        var cocokGolongan = kodeGolongan >= 300 && kodeGolongan < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        var tahunMasa = masaData.substring(2, 6);
        var bulanMasa = masaData.substring(0, 2);
        var cocokGroup =
          String(g.group || "")
            .trim()
            .toUpperCase() === activeGroup;

        var cocokCabang =
          valcabang === "PUSAT" ||
          valcabang === "ALL" ||
          valcabang === "" ||
          cabangData === valcabang;

        return (
          cocokGolongan &&
          cocokGroup &&
          cocokCabang &&
          tahunMasa === duadigittahunbelakang &&
          parseInt(bulanMasa, 10) < parseInt(filterbulan, 10)
        );
      });

      dataSelainBulanIni.forEach(function (g) {
        var kodeGol = String(g.gol || g.golongan || "");
        var saldo = +(g.db || 0) - +(g.cr || 0);
        if (!mapAkmBulanLalu[kodeGol]) mapAkmBulanLalu[kodeGol] = 0;
        mapAkmBulanLalu[kodeGol] += saldo;
      });
    }

    if (golBulanIni.length === 0) {
      if (area)
        area.innerHTML =
          '<div style="padding:3rem; text-align:center; color:var(--muted);">🔍 Data RL Rekap kosong / tidak ada saldo untuk Group: <b>' +
          activeGroup +
          "</b></div>";
      return;
    }

    // 5. GABUNGKAN DATA
    var finalData = golBulanIni
      .map(function (item) {
        var kodeGol = String(item.gol || item.golongan || "");
        var akmLalu = mapAkmBulanLalu[kodeGol] || 0;
        var bulanIni = +(item.db || 0) - +(item.cr || 0);
        var saldoTotal = bulanIni + akmLalu;
        return {
          ...item,
          namaGol: mapMasterGol[kodeGol] || item.namaGol || "-",
          akmBulanLalu: akmLalu,
          _saldoTotal: saldoTotal,
        };
      })
      .filter(function (item) {
        return item._saldoTotal !== 0;
      });

    window.golterfilterrl = finalData;

    var html = "";
    var outerArea = document.getElementById("area_cetak_rlrekap");
    if (outerArea) {
      outerArea.style.height = "auto";
      outerArea.style.maxHeight = "none";
      outerArea.style.overflow = "visible";
    }
    if (area) {
      area.style.overflowY = "visible";
      area.style.maxHeight = "none";
      area.style.height = "auto";
    }

    html += generateHTMLRLRekap(
      finalData,
      kodemasadicari,
      valcabang,
      false,
      activeGroup,
    );
    area.innerHTML = html;
  } catch (error) {
    console.error("❌ Gagal total RL Rekap:", error);
    if (area)
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}

async function downloadRLRekapExcel() {
  if (!window.golterfilterrl || window.golterfilterrl.length === 0) {
    if (typeof toast === "function")
      toast("Tidak ada data RL Rekap untuk didownload", "err");
    return;
  }

  // ✅ PERBAIKAN 7: PENGAMAN GROUP UNDEFINED UNTUK NAMA FILE EXCEL
  var rawGroup = localStorage.getItem("group");
  var activeGroupLabel = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroupLabel = rawGroup.trim().toUpperCase();
  }

  var htmlContent = generateHTMLRLRekap(
    window.golterfilterrl,
    window._rlRekapFilterMasa,
    window._rlRekapFilterCabang,
    true,
    activeGroupLabel,
  );

  var fullHtml =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>RL Rekap</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>` +
    htmlContent +
    `</body></html>`;

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "Laporan_RL_Rekap_" +
    (window._rlRekapFilterMasa || "Export") +
    "_Group_" +
    activeGroupLabel +
    ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof toast === "function")
    toast("File Excel RL Rekap sedang didownload...", "ok");
}

function generateHTMLRLRekap(
  dataRL,
  kodemasadicari,
  valcabang,
  isForExcel,
  activeGroupLabel,
) {
  var html = "";
  if (!isForExcel) {
    html +=
      '<div style="margin-bottom:.7rem; font-size:.78rem; color: var(--muted);">3xx = Penjualan &bull; 4xx = HPP &bull; 5xx = By Adm & Umum &bull; 6xx = Beban Lainnya</div>';
  }

  html +=
    '<div style="width: 100%; overflow-x: auto; border: 1px solid #ddd;">';
  html +=
    '<table border="1" style="width:100%; min-width: 900px; border-collapse: collapse; text-align:left; color:#000; border: 1px solid #000;">';

  html += '<thead style="background:#f4f4f4; font-weight:bold;"><tr>';
  html += '<th style="padding:10px; border:1px solid #000;">GOL</th>';
  html += '<th style="padding:10px; border:1px solid #000;">NAMA GOLONGAN</th>';
  html += '<th style="padding:10px; border:1px solid #000;">MASA</th>';
  html +=
    '<th style="padding:10px; border:1px solid #000; text-align:right;">BULAN INI</th>';
  html +=
    '<th style="padding:10px; border:1px solid #000; text-align:right;">AKM SD BLN LALU</th>';
  html +=
    '<th style="padding:10px; border:1px solid #000; text-align:right;">SALDO AKHIR</th>';
  html += '<th style="padding:10px; border:1px solid #000;">CABANG</th>';
  html += "</tr></thead><tbody>";

  var currentDigit = null;
  var sumBulanIni = 0,
    sumAkmLalu = 0,
    sumAkhir = 0;
  var subtotals = {};

  function buatBarisKeterangan(teks) {
    html +=
      "<tr><td colspan='7' style='padding:10px; border:1px solid #000; font-weight:bold; background-color:#e9ecef; color:#000; font-size: 0.9rem;'>" +
      teks +
      "</td></tr>";
  }

  function buatBarisSubtotal(
    teks,
    nBulanIni,
    nAkmLalu,
    nAkhir,
    warnaBg,
    isDoubleTop,
  ) {
    var topBorder = isDoubleTop ? "border-top: 3px double #000;" : "";
    var warnaFont = nAkhir >= 0 ? "green" : "red";
    var xNumAttr = isForExcel ? ' x:num="' + nAkhir + '"' : "";

    html += "<tr>";
    html +=
      '<td colspan="3" style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; background-color:' +
      warnaBg +
      "; color:#000; " +
      topBorder +
      '">' +
      teks +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; background-color:' +
      warnaBg +
      "; color:#000; " +
      topBorder +
      '">' +
      (nBulanIni !== 0 ? formatUang(nBulanIni) : "-") +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; background-color:' +
      warnaBg +
      "; color:#000; " +
      topBorder +
      '">' +
      (nAkmLalu !== 0 ? formatUang(nAkmLalu) : "-") +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; white-space:nowrap; background-color:' +
      warnaBg +
      "; color:" +
      warnaFont +
      "; " +
      topBorder +
      '"' +
      xNumAttr +
      ">" +
      formatUang(nAkhir) +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; background-color:' +
      warnaBg +
      "; color:#000; " +
      topBorder +
      '"></td>';
    html += "</tr>";
  }

  // Fungsi bantuan untuk mengambil data subtotals agar kode tidak berulang
  function getSub(digit) {
    return subtotals[digit] || { bulanIni: 0, akmLalu: 0, akhir: 0 };
  }

  for (var i = 0; i < dataRL.length; i++) {
    var item = dataRL[i];
    var kodeGol = parseInt(item.gol || item.golongan || 0, 10);
    var itemDigit = String(kodeGol).charAt(0);

    var valBulanIni = num(item.db || 0) - num(item.cr || 0);
    var valAkmLalu = num(item.akmBulanLalu || 0);
    var valAkhir = valBulanIni + valAkmLalu;

    if (currentDigit !== null && itemDigit !== currentDigit) {
      subtotals[currentDigit] = {
        bulanIni: sumBulanIni,
        akmLalu: sumAkmLalu,
        akhir: sumAkhir,
      };

      var ketSubtotal = "SUBTOTAL GOLONGAN " + currentDigit + "xx";
      if (currentDigit === "3") ketSubtotal = "PENJUALAN BERSIH";
      if (currentDigit === "4") ketSubtotal = "TOTAL HPP";
      if (currentDigit === "5") ketSubtotal = "TOTAL BY ADM & UMUM";
      if (currentDigit === "6") ketSubtotal = "TOTAL BEBAN LAINNYA";

      buatBarisSubtotal(
        ketSubtotal,
        sumBulanIni,
        sumAkmLalu,
        sumAkhir,
        "#fff3cd",
        false,
      );

      if (currentDigit === "3") {
        html +=
          "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
      } else if (currentDigit === "4") {
        var g3 = getSub("3");
        buatBarisSubtotal(
          "LABA KOTOR (Penjualan Bersih - HPP)",
          g3.bulanIni + sumBulanIni,
          g3.akmLalu + sumAkmLalu,
          g3.akhir + sumAkhir,
          "#d4edda",
          false,
        );
        html +=
          "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
      } else if (currentDigit === "5") {
        var g3 = getSub("3"),
          g4 = getSub("4");
        buatBarisSubtotal(
          "LABA / RUGI SETELAH BY ADM & UMUM",
          g3.bulanIni + g4.bulanIni + sumBulanIni,
          g3.akmLalu + g4.akmLalu + sumAkmLalu,
          g3.akhir + g4.akhir + sumAkhir,
          "#c3e6cb",
          false,
        );
        html +=
          "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
      } else if (currentDigit === "6") {
        var g3 = getSub("3"),
          g4 = getSub("4"),
          g5 = getSub("5");
        buatBarisSubtotal(
          "LABA / RUGI SETELAH BEBAN LAINNYA",
          g3.bulanIni + g4.bulanIni + g5.bulanIni + sumBulanIni,
          g3.akmLalu + g4.akmLalu + g5.akmLalu + sumAkmLalu,
          g3.akhir + g4.akhir + g5.akhir + sumAkhir,
          "#cce5ff",
          false,
        );
        html +=
          "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
      }

      sumBulanIni = 0;
      sumAkmLalu = 0;
      sumAkhir = 0;
    }

    if (currentDigit !== itemDigit) {
      if (itemDigit === "3") buatBarisKeterangan("PENJUALAN");
      if (itemDigit === "4") buatBarisKeterangan("HARGA POKOK PENJUALAN (HPP)");
      if (itemDigit === "5") buatBarisKeterangan("BIAYA ADMINISTRASI & UMUM");
      if (itemDigit === "6") buatBarisKeterangan("BEBAN LAINNYA");
    }

    currentDigit = itemDigit;
    sumBulanIni += valBulanIni;
    sumAkmLalu += valAkmLalu;
    sumAkhir += valAkhir;

    html += '<tr style="font-size: 0.85rem;">';
    var golVal =
      item.gol !== undefined
        ? item.gol
        : item.golongan !== undefined
          ? item.golongan
          : "";

    if (isForExcel) {
      html +=
        '<td style="padding:10px; border:1px solid #000; text-align:center; color:green font-weight:bold;">' +
        golVal +
        "</td>";
    } else {
      html +=
        "<td onclick=\"lihatDetilPerkiraan('" +
        golVal +
        "', '" +
        kodemasadicari +
        "', '" +
        valcabang +
        "')\" style='padding:10px; border:1px solid #000; cursor:pointer; color:green font-weight:bold; text-decoration:underline;'>" +
        golVal +
        "</td>";
    }

    html +=
      '<td style="padding:10px; border:1px solid #000; white-space:nowrap;">' +
      (item.namaGol || "") +
      "</td>";

    var textMasa = item.masa || "";
    if (isForExcel)
      textMasa = '<span style="color:white;">\'</span>' + textMasa;
    html +=
      '<td style="padding:10px; border:1px solid #000; white-space:nowrap;">' +
      textMasa +
      "</td>";

    var xNumIni = isForExcel ? ' x:num="' + valBulanIni + '"' : "";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap;"' +
      xNumIni +
      ">" +
      formatUang(valBulanIni) +
      "</td>";

    var xNumAkm = isForExcel ? ' x:num="' + valAkmLalu + '"' : "";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap;"' +
      xNumAkm +
      ">" +
      (valAkmLalu !== 0 ? formatUang(valAkmLalu) : "-") +
      "</td>";

    var xNumAkhir = isForExcel ? ' x:num="' + valAkhir + '"' : "";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; white-space:nowrap;"' +
      xNumAkhir +
      ">" +
      formatUang(valAkhir) +
      "</td>";

    var textCabang = item.cabang || item.kode_cabang || "";
    if (isForExcel)
      textCabang = '<span style="color:white;">\'</span>' + textCabang;
    html +=
      '<td style="padding:10px; border:1px solid #000; white-space:nowrap;">' +
      textCabang +
      "</td>";
    html += "</tr>";
  }

  // ✅ SUBTOTAL DIGIT TERAKHIR (SUDAH DIPERBAIKI KONSISTENSI 3 KOLOMNYA)
  if (currentDigit !== null) {
    subtotals[currentDigit] = {
      bulanIni: sumBulanIni,
      akmLalu: sumAkmLalu,
      akhir: sumAkhir,
    };

    var ketAkhir = "SUBTOTAL GOLONGAN " + currentDigit + "xx";
    if (currentDigit === "3") ketAkhir = "PENJUALAN BERSIH";
    if (currentDigit === "4") ketAkhir = "TOTAL HPP";
    if (currentDigit === "5") ketAkhir = "TOTAL BY ADM & UMUM";
    if (currentDigit === "6") ketAkhir = "TOTAL BEBAN LAINNYA";

    buatBarisSubtotal(
      ketAkhir,
      sumBulanIni,
      sumAkmLalu,
      sumAkhir,
      "#fff3cd",
      false,
    );

    // Logika setelah golongan terakhir selesai
    if (currentDigit === "4") {
      var g3 = getSub("3");
      buatBarisSubtotal(
        "LABA KOTOR (Penjualan Bersih - HPP)",
        g3.bulanIni + sumBulanIni,
        g3.akmLalu + sumAkmLalu,
        g3.akhir + sumAkhir,
        "#d4edda",
        false,
      );
      html +=
        "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
    } else if (currentDigit === "5") {
      var g3 = getSub("3"),
        g4 = getSub("4");
      buatBarisSubtotal(
        "LABA / RUGI SETELAH BY ADM & UMUM",
        g3.bulanIni + g4.bulanIni + sumBulanIni,
        g3.akmLalu + g4.akmLalu + sumAkmLalu,
        g3.akhir + g4.akhir + sumAkhir,
        "#c3e6cb",
        false,
      );
      html +=
        "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
    } else if (currentDigit === "6") {
      var g3 = getSub("3"),
        g4 = getSub("4"),
        g5 = getSub("5");
      buatBarisSubtotal(
        "LABA / RUGI SETELAH BEBAN LAINNYA",
        g3.bulanIni + g4.bulanIni + g5.bulanIni + sumBulanIni,
        g3.akmLalu + g4.akmLalu + g5.akmLalu + sumAkmLalu,
        g3.akhir + g4.akhir + g5.akhir + sumAkhir,
        "#cce5ff",
        false,
      );
      html +=
        "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
    }
  }

  // ✅ LABA RUGI BERSIH (SUDAH DIPERBAIKI KONSISTENSI 3 KOLOMNYA)
  var g3 = getSub("3"),
    g4 = getSub("4"),
    g5 = getSub("5"),
    g6 = getSub("6");
  var lrBulanIni = g3.bulanIni + g4.bulanIni + g5.bulanIni + g6.bulanIni;
  var lrAkmLalu = g3.akmLalu + g4.akmLalu + g5.akmLalu + g6.akmLalu;
  var lrAkhir = g3.akhir + g4.akhir + g5.akhir + g6.akhir;

  html +=
    "<tr><td colspan='7' style='border:1px solid #000; padding:6px; background-color:#fff;'></td></tr>";
  buatBarisSubtotal(
    "LABA / RUGI BERSIH",
    lrBulanIni,
    lrAkmLalu,
    lrAkhir,
    "#d1e7dd",
    true,
  );

  // ✅ TAMBAHKAN INFORMASI GROUP DI FOOTER JIKA INI UNTUK EXCEL
  if (isForExcel && activeGroupLabel) {
    html +=
      "<tr><td colspan='7' style='padding:10px; border:none; font-size:11px; color:#555; text-align:left;'>Group: " +
      activeGroupLabel +
      "</td></tr>";
  }

  html += "</tbody></table></div>";
  return html;
}
/* ---------- RL Detil ---------- */
PANEL_MAP.rlDetil = renderRLDetil;

// =========================================================================
// 1. FUNGSI RENDER ANTARMUKA RL DETIL (KOSONG)
// =========================================================================
// =========================================================================
// 1. RENDER ANTARMUKA RL DETIL (SINKRON - TANPA ASYNC)
// =========================================================================
function renderRLDetil() {
  if (typeof window._rlDetilFilterCabang === "undefined") {
    window._rlDetilFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "PUSAT";
  }
  if (typeof window._rlDetilFilterMasa === "undefined") {
    var d = new Date();
    var bln = ("0" + (d.getMonth() + 1)).slice(-2);
    window._rlDetilFilterMasa = bln + "-" + d.getFullYear();
  }

  var partMasa = window._rlDetilFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];
  var inputMonthValue = filterTahunFull + "-" + filterBulan;

  // ==========================================
  // CEK LEVEL USER: PUSAT ATAU BUKAN?
  // ==========================================
  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";

  var activeGroup = localStorage.getItem("group") || "TLGA";

  // ==========================================
  // SIAPKAN DROPDOWN GROUP (HANYA UNTUK PUSAT)
  // ==========================================
  var groupUiHtml = "";
  if (isPusat) {
    groupUiHtml =
      '<div style="display:flex; align-items:center; gap:5px;">' +
      '<label style="font-size:.75rem; color:var(--muted);">Filter Group:</label>' +
      '<select id="filter_rldetil_group" onchange="gantiGroupLaporan(\'rldetil\', \'renderRLDetil\')" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; font-weight:bold;">';

    var listGroup =
      (typeof DBCache !== "undefined" && DBCache.groupproject) || [];
    if (listGroup.length === 0) {
      groupUiHtml += '<option value="TLGA">TLGA</option>';
    } else {
      listGroup.forEach(function (g) {
        var val = String(g.kode || g.nama || g.group || "").trim();
        var label = (g.kode ? g.kode + " - " : "") + (g.nama || g.group || val);
        if (!val) return;
        groupUiHtml +=
          '<option value="' +
          esc(val) +
          '"' +
          (val === activeGroup ? " selected" : "") +
          ">" +
          esc(label) +
          "</option>";
      });
    }

    groupUiHtml += "</select></div>";
  } else {
    groupUiHtml =
      '<div style="font-size:.8rem; color:var(--muted);">Group: <span style="color:var(--accent); font-weight:bold;">' +
      esc(activeGroup) +
      "</span></div>";
  }

  // ==========================================
  // FILTER DROPDOWN CABANG HANYA YANG SESUAI GROUP AKTIF
  // ==========================================
  var rawCabang = (typeof DBCache !== "undefined" && DBCache.cabang) || [];
  var daftarCabangObj = [];
  rawCabang.forEach(function (c) {
    var id = (c.kode || c.cabang || "").trim();
    var nama = (c.nama || id || "Tanpa Nama").trim();
    var groupCabang = (c.group || "").trim().toUpperCase();

    if (id && (activeGroup === "ALL_GROUP" || groupCabang === activeGroup)) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  // Pastikan opsi PUSAT selalu ada di paling atas
  var adaPusat = daftarCabangObj.some(function (item) {
    return item.id.toUpperCase() === "PUSAT" || item.id === "00";
  });
  if (!adaPusat) {
    daftarCabangObj.unshift({
      id: "PUSAT",
      nama: "PUSAT (SEMUA CABANG)",
    });
  }

  var kodeDefault = (window._rlDetilFilterCabang || "PUSAT").toUpperCase();

  var opsiCabangHtml = daftarCabangObj
    .map(function (item) {
      var sel = item.id.toUpperCase() === kodeDefault ? " selected" : "";
      return (
        '<option value="' +
        item.id +
        '" ' +
        sel +
        ">" +
        item.id +
        " - " +
        item.nama.toUpperCase() +
        "</option>"
      );
    })
    .join("");

  var htmlLaporan =
    '<div id="area_cetak_rldetil" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan RL Detil (Rugi Laba Rinci)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    groupUiHtml +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Masa:</label>' +
    '<input type="month" id="filter_rldetil_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Cabang:</label>' +
    '<select id="filter_rldetil_cabang" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; min-width:120px;">' +
    opsiCabangHtml +
    "</select>" +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiRLDetil()">Terapkan</button>' +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadRLDetilExcel()"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    "</div>" +
    '<div class="table-responsive-container" style="width:100%; max-width:100%; height:380px; max-height:380px; overflow:auto; display:block; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box; margin:0 auto; clear:both;">' +
    "<style>" +
    "#tempat_tabel_rldetil table { width: 100% !important; min-width: 900px !important; border-collapse: collapse !important; table-layout: auto !important; margin:0 !important; }" +
    "#tempat_tabel_rldetil th { padding: 8px 12px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; }" +
    "#tempat_tabel_rldetil td { padding: 8px 12px !important; white-space: nowrap !important; border: 1px solid var(--brd); }" +
    "</style>" +
    '<div id="tempat_tabel_rldetil" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data RL Detil.</p>' +
    "</div></div>";

  return htmlLaporan;
}

// =========================================================================
// 2. FUNGSI EKSEKUSI TAMPILKAN DATA RL DETIL
// =========================================================================
async function terapkanOpsiRLDetil() {
  var inputmasa = document.getElementById("filter_rldetil_masa");
  var selectcabang = document.getElementById("filter_rldetil_cabang");
  var selectgroup = document.getElementById("filter_rldetil_group");

  if (!inputmasa || !selectcabang) return;

  // SIMPAN GROUP TERPILIH KE LOCALSTORAGE
  if (selectgroup && selectgroup.value) {
    localStorage.setItem("group", selectgroup.value);
  }

  var valmasa = inputmasa.value;
  var valcabang = selectcabang.value;
  if (!valmasa) {
    if (typeof toast === "function")
      toast("Silakan pilih masa terlebih dahulu", "err");
    return;
  }
  if (typeof closeModal === "function") closeModal();

  var part = valmasa.split("-");
  var filtertahunfull = part[0];
  var filterbulan = part[1];
  var duadigittahunbelakang = filtertahunfull.substring(2, 4);

  window._rlDetilFilterMasa = filterbulan + "-" + filtertahunfull;
  window._rlDetilFilterCabang = valcabang;

  var kodemasadicari = filterbulan + duadigittahunbelakang;
  var namastoregolbackup = "perkiraan" + filtertahunfull;

  var area = document.getElementById("tempat_tabel_rldetil");
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 Memuat data master & menghitung akumulasi...</div>';
  }

  try {
    var activeGroup =
      (selectgroup ? selectgroup.value : "") ||
      localStorage.getItem("group") ||
      (typeof getActiveGroup === "function" ? getActiveGroup() : "TLGA");

    activeGroup = String(activeGroup).trim().toUpperCase();
    if (activeGroup === "UNDEFINED" || !activeGroup) {
      activeGroup = "TLGA";
    }

    // 1. AMBIL MASTER
    var rawMasterGol = await db.getAll("perkiraan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.noper || m.kode_perkiraan || "").trim();
        var nama = String(m.penjelasan || m.nama || "").trim();
        var cabangMaster = String(m.cabang || "").trim();
        var groupMaster = String(m.group || "")
          .trim()
          .toUpperCase();

        var cocokCabang =
          valcabang === "PUSAT" ||
          valcabang === "ALL" ||
          valcabang === "" ||
          cabangMaster === valcabang;

        if (kode && cocokCabang && groupMaster === activeGroup) {
          mapMasterGol[kode] = nama;
        }
      });
    }

    // 2. AMBIL BACKUP
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    // 3. Filter Bulan Ini
    var golBulanIni = rawdatagolongan
      .filter(function (g) {
        var kodeGolongan = parseInt(g.noper || g.kode_perkiraan || 0, 10);
        var cocokGolongan = kodeGolongan >= 300 && kodeGolongan < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        var cocokGroup =
          String(g.group || "")
            .trim()
            .toUpperCase() === activeGroup;

        var cocokCabang =
          valcabang === "PUSAT" ||
          valcabang === "ALL" ||
          valcabang === "" ||
          cabangData === valcabang;

        return (
          cocokGolongan &&
          cocokGroup &&
          masaData === kodemasadicari &&
          cocokCabang
        );
      })
      .sort(function (a, b) {
        return (
          parseInt(a.noPerk || a.kode_perkiraan || 0, 10) -
          parseInt(b.noPerk || b.kode_perkiraan || 0, 10)
        );
      });

    // 4. Hitung AKUMULASI SD BULAN LALU
    var mapAkmBulanLalu = {};
    if (parseInt(filterbulan, 10) > 1) {
      var dataSelainBulanIni = rawdatagolongan.filter(function (g) {
        var kodeGolongan = parseInt(g.noper || g.kode_perkiraan || 0, 10);
        var cocokGolongan = kodeGolongan >= 300 && kodeGolongan < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        var tahunMasa = masaData.substring(2, 6);
        var bulanMasa = masaData.substring(0, 2);
        var cocokGroup =
          String(g.group || "")
            .trim()
            .toUpperCase() === activeGroup;

        var cocokCabang =
          valcabang === "PUSAT" ||
          valcabang === "ALL" ||
          valcabang === "" ||
          cabangData === valcabang;

        return (
          cocokGolongan &&
          cocokGroup &&
          cocokCabang &&
          tahunMasa === duadigittahunbelakang &&
          parseInt(bulanMasa, 10) < parseInt(filterbulan, 10)
        );
      });
      dataSelainBulanIni.forEach(function (g) {
        var kodeGol = String(g.noper || g.kode_perkiraan || "");
        var saldo = +(g.db || 0) - +(g.cr || 0);
        if (!mapAkmBulanLalu[kodeGol]) mapAkmBulanLalu[kodeGol] = 0;
        mapAkmBulanLalu[kodeGol] += saldo;
      });
    }

    if (golBulanIni.length === 0) {
      if (area)
        area.innerHTML =
          '<div style="padding:3rem;text-align:center;color:var(--muted);">🔍 Data RL Detil kosong / tidak ada saldo untuk Group: <b>' +
          activeGroup +
          "</b></div>";
      return;
    }

    // 5. GABUNGKAN & FILTER SALDO 0
    var finalData = golBulanIni
      .map(function (item) {
        var kodeGol = String(item.noper || item.kode_perkiraan || "");
        var akmLalu = mapAkmBulanLalu[kodeGol] || 0;
        var bulanIni = +(item.db || 0) - +(item.cr || 0);
        var saldoTotal = bulanIni + akmLalu;
        return {
          ...item,
          namaPerkiraan: mapMasterGol[kodeGol] || item.desc || item.nama || "-",
          akmBulanLalu: akmLalu,
          _saldoTotal: saldoTotal,
        };
      })
      .filter(function (item) {
        return item._saldoTotal !== 0;
      });

    window.golterfilterrl = finalData;

    var html = "";
    var outerArea = document.getElementById("area_cetak_rldetil");
    if (outerArea) {
      outerArea.style.height = "auto";
      outerArea.style.maxHeight = "none";
      outerArea.style.overflow = "visible";
    }
    if (area) {
      area.style.overflowY = "visible";
      area.style.maxHeight = "none";
      area.style.height = "auto";
    }

    html += generateHTMLRLDetil(
      finalData,
      kodemasadicari,
      valcabang,
      false,
      activeGroup,
    );
    area.innerHTML = html;
  } catch (error) {
    console.error("❌ Gagal total RL Detil:", error);
    if (area)
      area.innerHTML =
        '<div style="padding:3rem;text-align:center;color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}

async function downloadRLDetilExcel() {
  if (!window.golterfilterrl || window.golterfilterrl.length === 0) {
    if (typeof toast === "function")
      toast("Tidak ada data RL Detil untuk didownload", "err");
    return;
  }

  // ✅ PERBAIKAN 7: PENGAMAN GROUP UNDEFINED UNTUK EXCEL
  var rawGroup = localStorage.getItem("group");
  var activeGroupLabel = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroupLabel = rawGroup.trim().toUpperCase();
  }

  var htmlContent = generateHTMLRLDetil(
    window.golterfilterrl,
    window._rlDetilFilterMasa,
    window._rlDetilFilterCabang,
    true,
    activeGroupLabel,
  );
  var fullHtml =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>RL Detil</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>` +
    htmlContent +
    `</body></html>`;

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "Laporan_RL_Detil_" +
    (window._rlDetilFilterMasa || "Export") +
    "_Group_" +
    activeGroupLabel +
    ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof toast === "function")
    toast("File Excel RL Detil sedang didownload...", "ok");
}

// FUNGSI GENERATOR HTML
function generateHTMLRLDetil(
  dataRL,
  kodemasadicari,
  valcabang,
  isForExcel,
  activeGroupLabel,
) {
  var html = "";

  // ✅ TAMBAHAN: JUDUL LAPORAN KHUSUS UNTUK EXCEL
  // ✅ PERBAIKAN: JUDUL LAPORAN KHUSUS UNTUK EXCEL
  if (isForExcel) {
    // Pecah berdasarkan strip (karena formatnya "06-2024")
    var partPeriode = String(kodemasadicari || "").split("-");
    var blnAngka = partPeriode[0] || "";
    var thnFull = partPeriode[1] || ""; // Langsung ambil "2024" utuh

    var namaBulan = "";
    var arrBulan = [
      "",
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
    if (parseInt(blnAngka) > 0 && parseInt(blnAngka) <= 12) {
      namaBulan = arrBulan[parseInt(blnAngka)];
    }
    // Gabungkan menjadi "Juni 2024"
    var periokeText =
      namaBulan && thnFull ? namaBulan + " " + thnFull : kodemasadicari || "-";

    html +=
      '<div style="text-align:center; margin-bottom:15px; font-family:Arial, sans-serif;">';
    html +=
      '<h2 style="margin:0 0 5px 0; font-size:16pt;">LAPORAN RUGI LABA DETIL</h2>';
    html +=
      '<p style="margin:0 0 3px 0; font-size:11pt;">Periode: <b>' +
      periokeText +
      "</b></p>";
    html +=
      '<p style="margin:0 0 3px 0; font-size:11pt;">Cabang: <b>' +
      (valcabang === "PUSAT" ? "PUSAT (SEMUA)" : valcabang) +
      "</b> | Group: <b>" +
      (activeGroupLabel || "-") +
      "</b></p>";
    html += "</div>";
  } else {
    // Tampilan Web
    html +=
      '<div style="margin-bottom:.7rem; font-size:.78rem; color: var(--muted);">3xx = Penjualan &bull; 4xx = HPP &bull; 5xx = By Adm & Umum &bull; 6xx = Beban Lainnya | <b style="color:var(--accent)">GROUP: ' +
      (activeGroupLabel || "-") +
      "</b></div>";
  }

  // Lanjutan kode lama Anda di bawah ini TIDAK PERLU DIUBAH
  html +=
    '<div style="width: 100%; overflow-x: auto; border: 1px solid #ddd;">';
  // ... (kode selanjutnya tetap sama)
  html +=
    '<table border="1" style="width:100%; min-width: 900px; border-collapse: collapse; text-align:left; color:#000; border: 1px solid #000;">';
  html += '<thead style="background:#f4f4f4; font-weight:bold;"><tr>';
  html += '<th style="padding:10px; border:1px solid #000;">PERKIRAAN</th>';
  html +=
    '<th style="padding:10px; border:1px solid #000;">NAMA PERKIRAAN</th>';
  html += '<th style="padding:10px; border:1px solid #000;">MASA</th>';
  html +=
    '<th style="padding:10px; border:1px solid #000; text-align:right;">BULAN INI</th>';
  html +=
    '<th style="padding:10px; border:1px solid #000; text-align:right;">AKM SD BLN LALU</th>';
  html +=
    '<th style="padding:10px; border:1px solid #000; text-align:right;">SALDO AKHIR</th>';
  html += '<th style="padding:10px; border:1px solid #000;">CABANG</th>';
  html += "</tr></thead><tbody>";

  var currentDigit = null;
  var sumBulanIni = 0,
    sumAkmLalu = 0,
    sumAkhir = 0;
  var subtotals = {};

  function buatBarisKeterangan(teks) {
    html +=
      "<tr><td colspan='7' style='padding:10px; border:1px solid #000; font-weight:bold; background-color:#e9ecef; color:#000; font-size: 0.9rem;'>" +
      teks +
      "</td></tr>";
  }

  function buatBarisSubtotal(
    teks,
    nBulanIni,
    nAkmLalu,
    nAkhir,
    warnaBg,
    isDoubleTop,
  ) {
    var topBorder = isDoubleTop ? "border-top: 3px double #000;" : "";
    var warnaFont = nAkhir >= 0 ? "green" : "red";
    var xNumAttr = isForExcel ? ' x:num="' + nAkhir + '"' : "";
    html += "<tr>";
    html +=
      '<td colspan="3" style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; background-color:' +
      warnaBg +
      "; color:#000; " +
      topBorder +
      '">' +
      teks +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; background-color:' +
      warnaBg +
      "; color:#000; " +
      topBorder +
      '">' +
      (nBulanIni !== 0 ? formatUang(nBulanIni) : "-") +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; background-color:' +
      warnaBg +
      "; color:#000; " +
      topBorder +
      '">' +
      (nAkmLalu !== 0 ? formatUang(nAkmLalu) : "-") +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; white-space:nowrap; background-color:' +
      warnaBg +
      "; color:" +
      warnaFont +
      "; " +
      topBorder +
      '"' +
      xNumAttr +
      ">" +
      formatUang(nAkhir) +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; background-color:' +
      warnaBg +
      "; color:#000; " +
      topBorder +
      '"></td>';
    html += "</tr>";
  }

  function getSub(digit) {
    return subtotals[digit] || { bulanIni: 0, akmLalu: 0, akhir: 0 };
  }

  for (var i = 0; i < dataRL.length; i++) {
    var item = dataRL[i];
    var kodeGol = parseInt(item.noper || item.kode_perkiraan || 0, 10);
    var itemDigit = String(kodeGol).charAt(0);

    var valBulanIni = num(item.db || 0) - num(item.cr || 0);
    var valAkmLalu = num(item.akmBulanLalu || 0);
    var valAkhir = valBulanIni + valAkmLalu;

    if (currentDigit !== null && itemDigit !== currentDigit) {
      subtotals[currentDigit] = {
        bulanIni: sumBulanIni,
        akmLalu: sumAkmLalu,
        akhir: sumAkhir,
      };
      var ketSubtotal = "SUBTOTAL GOLONGAN " + currentDigit + "xx";
      if (currentDigit === "3") ketSubtotal = "PENJUALAN BERSIH";
      if (currentDigit === "4") ketSubtotal = "TOTAL HPP";
      if (currentDigit === "5") ketSubtotal = "TOTAL BY ADM & UMUM";
      if (currentDigit === "6") ketSubtotal = "TOTAL BEBAN LAINNYA";
      buatBarisSubtotal(
        ketSubtotal,
        sumBulanIni,
        sumAkmLalu,
        sumAkhir,
        "#fff3cd",
        false,
      );

      if (currentDigit === "3") {
        html +=
          "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
      } else if (currentDigit === "4") {
        var g3 = getSub("3");
        buatBarisSubtotal(
          "LABA KOTOR (Penjualan Bersih - HPP)",
          g3.bulanIni + sumBulanIni,
          g3.akmLalu + sumAkmLalu,
          g3.akhir + sumAkhir,
          "#d4edda",
          false,
        );
        html +=
          "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
      } else if (currentDigit === "5") {
        var g3 = getSub("3"),
          g4 = getSub("4");
        buatBarisSubtotal(
          "LABA / RUGI SETELAH BY ADM & UMUM",
          g3.bulanIni + g4.bulanIni + sumBulanIni,
          g3.akmLalu + g4.akmLalu + sumAkmLalu,
          g3.akhir + g4.akhir + sumAkhir,
          "#c3e6cb",
          false,
        );
        html +=
          "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
      } else if (currentDigit === "6") {
        var g3 = getSub("3"),
          g4 = getSub("4"),
          g5 = getSub("5");
        buatBarisSubtotal(
          "LABA / RUGI SETELAH BEBAN LAINNYA",
          g3.bulanIni + g4.bulanIni + g5.bulanIni + sumBulanIni,
          g3.akmLalu + g4.akmLalu + g5.akmLalu + sumAkmLalu,
          g3.akhir + g4.akhir + g5.akhir + sumAkhir,
          "#cce5ff",
          false,
        );
        html +=
          "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
      }
      sumBulanIni = 0;
      sumAkmLalu = 0;
      sumAkhir = 0;
    }

    if (currentDigit !== itemDigit) {
      if (itemDigit === "3") buatBarisKeterangan("PENJUALAN");
      if (itemDigit === "4") buatBarisKeterangan("HARGA POKOK PENJUALAN (HPP)");
      if (itemDigit === "5") buatBarisKeterangan("BIAYA ADMINISTRASI & UMUM");
      if (itemDigit === "6") buatBarisKeterangan("BEBAN LAINNYA");
    }

    currentDigit = itemDigit;
    sumBulanIni += valBulanIni;
    sumAkmLalu += valAkmLalu;
    sumAkhir += valAkhir;

    html += '<tr style="font-size: 0.85rem;">';
    var golVal =
      item.noper !== undefined
        ? item.noper
        : item.kode_perkiraan !== undefined
          ? item.kode_perkiraan
          : "";
    if (isForExcel) {
      // Ditambahkan mso-number-format:"\@" agar Excel membaca sebagai TEKS,
      // ditambah tanda kutip ' sebagai fallback jika user membuka di LibreOffice/CsvReader lain
      html +=
        "<td style=\"padding:10px; border:1px solid #000; text-align:center; font-weight:bold; mso-number-format:'\\@';\">'" +
        golVal +
        "</td>";
    } else {
      html +=
        "<td onclick=\"lihatDetilTransaksi('" +
        golVal +
        "', '" +
        kodemasadicari +
        "', '" +
        valcabang +
        "')\" style='padding:10px; border:1px solid #000; cursor:pointer; color:var(--accent); font-weight:bold; text-decoration:underline;'>" +
        golVal +
        "</td>";
    }
    html +=
      '<td style="padding:10px; border:1px solid #000; white-space:nowrap;">' +
      (item.penjelasan || "-") +
      "</td>";

    var textMasa = item.masa || "";
    if (isForExcel)
      textMasa = '<span style="color:white;">\'</span>' + textMasa;
    html +=
      '<td style="padding:10px; border:1px solid #000; white-space:nowrap;">' +
      textMasa +
      "</td>";

    var xNumIni = isForExcel ? ' x:num="' + valBulanIni + '"' : "";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap;"' +
      xNumIni +
      ">" +
      formatUang(valBulanIni) +
      "</td>";

    var xNumAkm = isForExcel ? ' x:num="' + valAkmLalu + '"' : "";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap;"' +
      xNumAkm +
      ">" +
      (valAkmLalu !== 0 ? formatUang(valAkmLalu) : "-") +
      "</td>";

    var xNumAkhir = isForExcel ? ' x:num="' + valAkhir + '"' : "";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; font-weight:bold; white-space:nowrap;"' +
      xNumAkhir +
      ">" +
      formatUang(valAkhir) +
      "</td>";

    var textCabang = item.cabang || item.kode_cabang || "";
    if (isForExcel)
      textCabang = '<span style="color:white;">\'</span>' + textCabang;
    html +=
      '<td style="padding:10px; border:1px solid #000; white-space:nowrap;">' +
      textCabang +
      "</td>";
    html += "</tr>";
  }

  // SUBTOTAL DIGIT TERAKHIR
  if (currentDigit !== null) {
    subtotals[currentDigit] = {
      bulanIni: sumBulanIni,
      akmLalu: sumAkmLalu,
      akhir: sumAkhir,
    };
    var ketAkhir = "SUBTOTAL GOLONGAN " + currentDigit + "xx";
    if (currentDigit === "3") ketAkhir = "PENJUALAN BERSIH";
    if (currentDigit === "4") ketAkhir = "TOTAL HPP";
    if (currentDigit === "5") ketAkhir = "TOTAL BY ADM & UMUM";
    if (currentDigit === "6") ketAkhir = "TOTAL BEBAN LAINNYA";
    buatBarisSubtotal(
      ketAkhir,
      sumBulanIni,
      sumAkmLalu,
      sumAkhir,
      "#fff3cd",
      false,
    );

    if (currentDigit === "4") {
      var g3 = getSub("3");
      buatBarisSubtotal(
        "LABA KOTOR (Penjualan Bersih - HPP)",
        g3.bulanIni + sumBulanIni,
        g3.akmLalu + sumAkmLalu,
        g3.akhir + sumAkhir,
        "#d4edda",
        false,
      );
      html +=
        "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
    } else if (currentDigit === "5") {
      var g3 = getSub("3"),
        g4 = getSub("4");
      buatBarisSubtotal(
        "LABA / RUGI SETELAH BY ADM & UMUM",
        g3.bulanIni + g4.bulanIni + sumBulanIni,
        g3.akmLalu + g4.akmLalu + sumAkmLalu,
        g3.akhir + g4.akhir + sumAkhir,
        "#c3e6cb",
        false,
      );
      html +=
        "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
    } else if (currentDigit === "6") {
      var g3 = getSub("3"),
        g4 = getSub("4"),
        g5 = getSub("5");
      buatBarisSubtotal(
        "LABA / RUGI SETELAH BEBAN LAINNYA",
        g3.bulanIni + g4.bulanIni + g5.bulanIni + sumBulanIni,
        g3.akmLalu + g4.akmLalu + g5.akmLalu + sumAkmLalu,
        g3.akhir + g4.akhir + g5.akhir + sumAkhir,
        "#cce5ff",
        false,
      );
      html +=
        "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
    }
  }

  // LABA RUGI BERSIH
  var g3 = getSub("3"),
    g4 = getSub("4"),
    g5 = getSub("5"),
    g6 = getSub("6");
  var lrBulanIni = g3.bulanIni + g4.bulanIni + g5.bulanIni + g6.bulanIni;
  var lrAkmLalu = g3.akmLalu + g4.akmLalu + g5.akmLalu + g6.akmLalu;
  var lrAkhir = g3.akhir + g4.akhir + g5.akhir + g6.akhir;

  html +=
    "<tr><td colspan='7' style='border:1px solid #000; padding:6px; background-color:#fff;'></td></tr>";
  var lrText = isForExcel
    ? "LABA / RUGI BERSIH (GROUP: " + activeGroupLabel + ")"
    : "LABA / RUGI BERSIH";
  buatBarisSubtotal(lrText, lrBulanIni, lrAkmLalu, lrAkhir, "#d1e7dd", true);

  html += "</tbody></table></div>";
  return html;
}
/* ---------- Buku Besar ---------- */
PANEL_MAP.bukuBesar = renderBukuBesar;
AFTER_RENDER.bukuBesar = refreshBukuBesar;
// =========================================================================
// 1. RENDER ANTARMUKA BUKU BESAR
// =========================================================================
function renderBukuBesar() {
  // ==========================================
  // CEK LEVEL USER: PUSAT ATAU BUKAN?
  // ==========================================
  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";

  var activeGroup = localStorage.getItem("group") || "TLGA";

  // ==========================================
  // SIAPKAN DROPDOWN GROUP DENGAN ONCHANGE LOKAL (TIDAK KE DASHBOARD)
  // ==========================================
  var groupUiHtml = "";
  if (isPusat) {
    // 🌟 PERUBAHAN UTAMA: onchange diganti ke fungsi lokal updateCabangBukuBesar()
    groupUiHtml =
      '<select id="filter_bukubesar_group" onchange="updateCabangBukuBesar()" style="padding:6px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.85rem; font-weight:bold; height:38px;">';

    var listGroup =
      (typeof DBCache !== "undefined" && DBCache.groupproject) || [];
    if (listGroup.length === 0) {
      groupUiHtml += '<option value="TLGA">TLGA</option>';
    } else {
      listGroup.forEach(function (g) {
        var val = String(g.kode || g.nama || g.group || "").trim();
        var label = (g.kode ? g.kode + " - " : "") + (g.nama || g.group || val);
        if (!val) return;
        groupUiHtml +=
          '<option value="' +
          esc(val) +
          '"' +
          (val === activeGroup ? " selected" : "") +
          ">" +
          esc(label) +
          "</option>";
      });
    }

    groupUiHtml += "</select>";
  } else {
    groupUiHtml =
      '<input type="text" value="' +
      esc(activeGroup) +
      '" readonly style="padding:6px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--bg2); color:var(--accent); font-size:.85rem; font-weight:bold; height:38px; width:100%;">';
  }

  // ==========================================
  // BACA CABANG DARI LOCALSTORAGE
  // ==========================================
  var selectedCabang = localStorage.getItem("bb_cabang") || "";

  // ==========================================
  // FILTER DROPDOWN CABANG SESUAI GROUP AKTIF
  // ==========================================
  var rawCabang = (typeof DBCache !== "undefined" && DBCache.cabang) || [];
  var daftarCabangObj = [];
  rawCabang.forEach(function (c) {
    var id = (c.kode || c.cabang || "").trim();
    var nama = (c.nama || id || "Tanpa Nama").trim();
    var groupCabang = (c.group || "").trim().toUpperCase();

    if (id && (activeGroup === "ALL_GROUP" || groupCabang === activeGroup)) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  var opsiCabangHtml =
    '<option value="">-- Pilih Cabang --</option><option value="ALL">SEMUA CABANG</option>';
  daftarCabangObj.forEach(function (item) {
    opsiCabangHtml +=
      '<option value="' +
      item.id +
      '"' +
      (item.id === selectedCabang ? " selected" : "") +
      ">" +
      item.id +
      " - " +
      item.nama.toUpperCase() +
      "</option>";
  });

  if (
    selectedCabang &&
    selectedCabang !== "ALL" &&
    !daftarCabangObj.find(function (c) {
      return c.id === selectedCabang;
    })
  ) {
    localStorage.removeItem("bb_cabang");
    selectedCabang = "";
  }

  // ==========================================
  // FILTER DROPDOWN PERKIRAAN SESUAI GROUP & CABANG AKTIF
  // ==========================================
  var rawPerkiraan =
    (typeof DBCache !== "undefined" && DBCache.perkiraan) || [];
  var opts = '<option value="">-- Pilih --</option>';

  rawPerkiraan.forEach(function (p) {
    var groupPerk = String(p.group || "")
      .trim()
      .toUpperCase();
    var cabangPerk = String(p.cabang || "")
      .trim()
      .toUpperCase();

    var matchGroup = activeGroup === "ALL_GROUP" || groupPerk === activeGroup;
    var matchCabang =
      !selectedCabang ||
      selectedCabang === "ALL" ||
      cabangPerk === selectedCabang;

    if (matchGroup && matchCabang) {
      var nomorPerkiraan = String(p.noperk || p.noper || "").trim();

      opts +=
        '<option value="' +
        (p.id || nomorPerkiraan) +
        '" data-cabang="' +
        (p.cabang || "") +
        '" data-noperk="' +
        nomorPerkiraan +
        '">' +
        esc(nomorPerkiraan) +
        " - " +
        esc(p.desc || p.nama || p.penjelasan || "") +
        "</option>";
    }
  });

  var styleGrid =
    "display:grid; grid-template-columns: auto auto auto auto auto; gap:12px; align-items:end; justify-content:start;";

  return (
    '<div style="background:var(--bg2); border:1px solid var(--brd); padding:15px; border-radius:8px; margin-bottom:1rem;">' +
    '<div style="' +
    styleGrid +
    '">' +
    // KOLOM 1: GROUP
    '<div><label style="display:block; font-size:.8rem; font-weight:bold; color:var(--fg); margin-bottom:4px;">Group</label>' +
    groupUiHtml +
    "</div>" +
    // KOLOM 2: CABANG
    '<div><label style="display:block; font-size:.8rem; color:var(--fg); margin-bottom:4px;">Cabang</label><select id="bb_cabang" onchange="simpanCabangBb()" style="padding:6px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.85rem; height:38px; min-width:160px;">' +
    opsiCabangHtml +
    "</select></div>" +
    // KOLOM 3: NO PERKIRAAN
    '<div><label style="display:block; font-size:.8rem; color:var(--fg); margin-bottom:4px;">No Perkiraan <span style="color:red;">*</span></label><select id="bb_perk" style="padding:6px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.85rem; height:38px; min-width:180px; max-width:260px;">' +
    opts +
    "</select></div>" +
    // KOLOM 4: MASA DARI
    '<div><label style="display:block; font-size:.8rem; color:var(--fg); margin-bottom:4px;">Masa Dari (MMYY)</label><input type="text" id="bb_masa_dari" placeholder="0524" maxlength="4" style="padding:6px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); text-transform:uppercase; width:90px; height:38px; font-size:.85rem;"></div>' +
    // KOLOM 5: MASA SAMPAI
    '<div><label style="display:block; font-size:.8rem; color:var(--fg); margin-bottom:4px;">Masa S/D (MMYY)</label><input type="text" id="bb_masa_sampai" placeholder="0824" maxlength="4" style="padding:6px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); text-transform:uppercase; width:90px; height:38px; font-size:.85rem;"></div>' +
    "</div>" +
    '<div style="margin-top:12px; display:flex; gap:8px;">' +
    '<button type="button" class="btn btn-g" onclick="refreshBukuBesar()" style="padding:6px 16px; font-size:.85rem;">Terapkan</button>' +
    '<button type="button" class="btn btn-b" onclick="downloadBukuBesarExcel()" style="background:#217346; border-color:#217346; padding:6px 16px; font-size:.85rem;"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    "</div>" +
    "</div>" +
    '<div id="bukuBesarTbl" style="margin-top:0;"></div>'
  );
}

// =========================================================================
// FUNGSI BARU: UPDATE CABANG & PERKIRAAN KETIKA GROUP DIGANTI (TANPA PINDAH HALAMAN)
// =========================================================================
window.updateCabangBukuBesar = function () {
  var selGroup = document.getElementById("filter_bukubesar_group");
  var selectCabang = document.getElementById("bb_cabang");
  if (!selGroup || !selectCabang) return;

  var activeGroup = selGroup.value;

  // Simpan group aktif & reset cabang sebelumnya ke localStorage
  localStorage.setItem("group", activeGroup);
  localStorage.removeItem("bb_cabang");

  // Ambil ulang data cabang berdasarkan group baru
  var rawCabang = (typeof DBCache !== "undefined" && DBCache.cabang) || [];
  var daftarCabangObj = [];
  rawCabang.forEach(function (c) {
    var id = (c.kode || c.cabang || "").trim();
    var nama = (c.nama || id || "Tanpa Nama").trim();
    var groupCabang = (c.group || "").trim().toUpperCase();

    if (id && (activeGroup === "ALL_GROUP" || groupCabang === activeGroup)) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  // Susun ulang opsi HTML untuk dropdown cabang
  var opsiCabangHtml =
    '<option value="">-- Pilih Cabang --</option><option value="ALL">SEMUA CABANG</option>';
  daftarCabangObj.forEach(function (item) {
    opsiCabangHtml +=
      '<option value="' +
      item.id +
      '">' +
      item.id +
      " - " +
      item.nama.toUpperCase() +
      "</option>";
  });

  // Timpa isi dropdown cabang secara instan
  selectCabang.innerHTML = opsiCabangHtml;

  // Update juga opsi perkiraan agar ikut tersaring bersih
  window.updatePerkiraanOptions();

  // Kosongkan tabel hasil jika ada
  var areaTbl = document.getElementById("bukuBesarTbl");
  if (areaTbl) {
    areaTbl.innerHTML =
      '<div class="empty-msg"><i class="fa-solid fa-search"></i> Silakan pilih cabang dan no perkiraan</div>';
  }
};

window.simpanCabangBb = function () {
  var elCabang = document.getElementById("bb_cabang");
  if (elCabang) {
    localStorage.setItem("bb_cabang", elCabang.value);
  }
  window.updatePerkiraanOptions();
};

window.updatePerkiraanOptions = function () {
  var elCabang = document.getElementById("bb_cabang");
  var selectPerk = document.getElementById("bb_perk");
  var selGroup = document.getElementById("filter_bukubesar_group");
  if (!elCabang || !selectPerk) return;

  var valcabang = elCabang.value;
  var activeGroup =
    (selGroup ? selGroup.value : "") || localStorage.getItem("group") || "TLGA";
  var rawPerkiraan =
    (typeof DBCache !== "undefined" && DBCache.perkiraan) || [];

  var filteredOptions = [];
  rawPerkiraan.forEach(function (p) {
    var groupPerk = String(p.group || "")
      .trim()
      .toUpperCase();
    var cabangPerk = String(p.cabang || "")
      .trim()
      .toUpperCase();

    var matchGroup = activeGroup === "ALL_GROUP" || groupPerk === activeGroup;
    var matchCabang =
      !valcabang || valcabang === "ALL" || cabangPerk === valcabang;

    if (matchGroup && matchCabang) {
      var nomorPerkiraan = String(p.noperk || p.noper || "").trim();
      var opt = document.createElement("option");
      opt.value = p.id || nomorPerkiraan;
      opt.setAttribute("data-cabang", p.cabang || "");
      opt.setAttribute("data-noperk", nomorPerkiraan);
      opt.textContent =
        nomorPerkiraan + " - " + (p.desc || p.nama || p.penjelasan || "");
      filteredOptions.push(opt);
    }
  });

  filteredOptions.sort(function (a, b) {
    return a.textContent.localeCompare(b.textContent, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  selectPerk.innerHTML = '<option value="">-- Pilih --</option>';
  filteredOptions.forEach(function (opt) {
    selectPerk.appendChild(opt);
  });
};

// State Global Pagination
window._bbPagination = {
  currentPage: 1,
  pageSize: 20,
};

// =========================================================================
// 3. FUNGSI EKSEKUSI REFRESH BUKU BESAR
// =========================================================================
async function refreshBukuBesar(page) {
  if (typeof page === "number") {
    window._bbPagination.currentPage = page;
  } else {
    window._bbPagination.currentPage = 1;
  }

  var elCabang = document.getElementById("bb_cabang") || $("bb_cabang");
  var elPerk = document.getElementById("bb_perk") || $("bb_perk");
  var elMasaDari = document.getElementById("bb_masa_dari") || $("bb_masa_dari");
  var elMasaSampai =
    document.getElementById("bb_masa_sampai") || $("bb_masa_sampai");
  var elGroup = document.getElementById("filter_bukubesar_group");

  var cabang = elCabang ? elCabang.value : "";
  var pid = elPerk ? elPerk.value : "";
  var masaDari = elMasaDari ? elMasaDari.value : "";
  var masaSampai = elMasaSampai ? elMasaSampai.value : "";

  var areaTbl = document.getElementById("bukuBesarTbl") || $("bukuBesarTbl");

  if (!pid) {
    if (areaTbl) {
      areaTbl.innerHTML =
        '<div class="empty-msg"><i class="fa-solid fa-search"></i> Pilih cabang dan no perkiraan</div>';
    }
    return;
  }

  // SIMPAN GROUP TERPILIH KE LOCALSTORAGE
  if (elGroup && elGroup.value) {
    localStorage.setItem("group", elGroup.value);
  }

  var pk = await db.get("perkiraan", pid);
  if (!pk) return;

  var activeGroup =
    (elGroup ? elGroup.value : "") ||
    localStorage.getItem("group") ||
    (typeof getActiveGroup === "function" ? getActiveGroup() : "TLGA");

  activeGroup = String(activeGroup).trim().toUpperCase();
  if (activeGroup === "UNDEFINED" || !activeGroup) {
    activeGroup = "TLGA";
  }

  window._bbCurrentData = {
    cabang: cabang,
    masaDari: masaDari,
    masaSampai: masaSampai,
    perkiraan: pk,
    group: activeGroup,
  };

  function getTahunFromMasa(kode4digit) {
    if (!kode4digit || kode4digit.length < 4) return null;
    var yy = kode4digit.substring(2, 4);
    return parseInt("20" + yy, 10);
  }

  var tahunMulai = masaDari ? getTahunFromMasa(masaDari) : null;
  var tahunAkhir = masaSampai ? getTahunFromMasa(masaSampai) : null;

  if (!tahunMulai && !tahunAkhir) {
    var tahunNow = new Date().getFullYear();
    tahunMulai = tahunNow;
    tahunAkhir = tahunNow;
  } else if (!tahunAkhir) {
    tahunAkhir = tahunMulai;
  } else if (!tahunMulai) {
    tahunMulai = tahunAkhir;
  }

  if (areaTbl) {
    areaTbl.innerHTML =
      '<div class="empty-msg"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i> Mengambil data transaksi multi-tahun...</div>';
  }
  await new Promise((resolve) => setTimeout(resolve, 50));

  var tahunPromises = [];
  var th = tahunMulai;
  while (th <= tahunAkhir) {
    var namaStore = "transaksi" + th;
    tahunPromises.push(db.getAll(namaStore));
    th++;
  }

  var allTransactions = [];
  try {
    var results = await Promise.all(tahunPromises);
    results.forEach(function (rawData) {
      var listTh = Array.isArray(rawData) ? rawData : Object.values(rawData);
      allTransactions = allTransactions.concat(listTh);
    });
  } catch (err) {
    console.error("Gagal mengambil data salah satu tahun:", err);
    return;
  }

  if (areaTbl) {
    areaTbl.innerHTML =
      '<div class="empty-msg"><i class="fa-solid fa-calculator fa-spin" style="margin-right:8px;"></i> Menyusun ' +
      allTransactions.length +
      " data transaksi...</div>";
  }
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 1. FILTER DATA TRANSAKSI
  var data = allTransactions.filter(function (t) {
    var tNoPerk = String(t.noper || "").trim();
    var pNoPerk = String(pk.noperk || pk.noper || "").trim();
    if (tNoPerk !== pNoPerk) return false;

    if (cabang && cabang !== "ALL" && t.cabang !== cabang) return false;

    var masaData = String(t.masa || "").trim();
    var validMasa = true;
    if (masaDari && masaData < masaDari) validMasa = false;
    if (masaSampai && masaData > masaSampai) validMasa = false;
    if (!validMasa) return false;

    var cocokGroup =
      String(t.group || "")
        .trim()
        .toUpperCase() === activeGroup;
    if (!cocokGroup) return false;

    return true;
  });

  function formatTglTransaksi(str) {
    if (!str) return "-";
    if (str instanceof Date) {
      var dd = String(str.getDate()).padStart(2, "0");
      var mm = String(str.getMonth() + 1).padStart(2, "0");
      var yyyy = str.getFullYear();
      return dd + "/" + mm + "/" + yyyy;
    }
    var d = new Date(str);
    if (isNaN(d.getTime())) return "-";
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yyyy = d.getFullYear();
    return dd + "/" + mm + "/" + yyyy;
  }

  // 2. URUTKAN DATA
  data.sort(function (a, b) {
    var masaA = String(a.masa || "").trim();
    var masaB = String(b.masa || "").trim();
    if (masaA < masaB) return -1;
    if (masaA > masaB) return 1;
    var dA = a.tanggal;
    var dB = b.tanggal;
    var timeA = dA instanceof Date ? dA.getTime() : new Date(dA).getTime();
    var timeB = dB instanceof Date ? dB.getTime() : new Date(dB).getTime();
    if (isNaN(timeA)) timeA = 0;
    if (isNaN(timeB)) timeB = 0;
    return timeA - timeB;
  });

  // 3. LOGIKA HITUNG PAGINATION
  var totalData = data.length;
  var pageSize = (window._bbPagination && window._bbPagination.pageSize) || 20;
  var totalPages = Math.ceil(totalData / pageSize) || 1;
  var currentPage = window._bbPagination.currentPage;

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  window._bbPagination.currentPage = currentPage;

  var startIndex = (currentPage - 1) * pageSize;
  var endIndex = Math.min(startIndex + pageSize, totalData);

  var pageData = data.slice(startIndex, endIndex);

  // 4. SALDO BAWAAN DARI HALAMAN SEBELUMNYA
  var prevSal = num(pk.awal);
  for (var i = 0; i < startIndex; i++) {
    prevSal += num(data[i].db) - num(data[i].cr);
  }

  // 5. MAP BARIS TABEL HALAMAN AKTIF
  var runningSal = prevSal;
  var rows = pageData.map(function (t) {
    runningSal += num(t.db) - num(t.cr);
    return [
      formatTglTransaksi(t.tanggal),
      t.noreff || "-",
      (t.penjelasan || "-").substring(0, 30),
      fmtN(t.db) || "-",
      fmtN(t.cr) || "-",
      '<span class="tag tag-akhir">' + fmtN(runningSal) + "</span>",
    ];
  });

  // BARIS SALDO AWAL / BAWAAN
  if (currentPage === 1) {
    rows.unshift([
      "Saldo Awal",
      "",
      "",
      "-",
      "-",
      '<span class="tag tag-awal">' + fmtN(pk.awal) + "</span>",
    ]);
  } else {
    rows.unshift([
      "Saldo Bawaan (Hal " + (currentPage - 1) + ")",
      "",
      "",
      "-",
      "-",
      '<span class="tag tag-awal">' + fmtN(prevSal) + "</span>",
    ]);
  }

  // FOOTER TOTAL
  var pageDb = pageData.reduce(function (s, t) {
    return s + num(t.db);
  }, 0);
  var pageCr = pageData.reduce(function (s, t) {
    return s + num(t.cr);
  }, 0);

  var foot = [
    "TOTAL HALAMAN INI",
    "",
    "",
    fmtN(pageDb),
    fmtN(pageCr),
    '<span class="tag tag-akhir">' + fmtN(runningSal) + "</span>",
  ];

  window._bbExcelReady = {
    rows: rows,
    foot: foot,
    pk: pk,
    cabang: cabang,
    masaDari: masaDari,
    masaSampai: masaSampai,
    tahunMulai: tahunMulai,
    group: activeGroup,
  };

  var labelMasa = "";
  if (masaDari && masaSampai) labelMasa = masaDari + " s/d " + masaSampai;
  else if (masaDari) labelMasa = "Dari " + masaDari;
  else if (masaSampai) labelMasa = "S/d " + masaSampai;
  else labelMasa = "Semua (" + tahunMulai + ")";

  // 6. UI NAVIGASI PAGINATION
  var paginationHtml =
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:8px 0; border-top:1px solid var(--brd); font-size:.85rem;">' +
    "<div>Menampilkan <b>" +
    (totalData > 0 ? startIndex + 1 : 0) +
    " - " +
    endIndex +
    "</b> dari <b>" +
    totalData +
    "</b> Transaksi</div>" +
    '<div style="display:flex; gap:6px; align-items:center;">' +
    '<button type="button" class="btn" style="padding:4px 10px; font-size:.8rem;" onclick="refreshBukuBesar(' +
    (currentPage - 1) +
    ')" ' +
    (currentPage <= 1
      ? 'disabled style="opacity:.5; cursor:not-allowed;"'
      : "") +
    '><i class="fa-solid fa-chevron-left"></i> Prev</button>' +
    "<span> Hal <b>" +
    currentPage +
    "</b> / " +
    totalPages +
    " </span>" +
    '<button type="button" class="btn" style="padding:4px 10px; font-size:.8rem;" onclick="refreshBukuBesar(' +
    (currentPage + 1) +
    ')" ' +
    (currentPage >= totalPages
      ? 'disabled style="opacity:.5; cursor:not-allowed;"'
      : "") +
    '>Next <i class="fa-solid fa-chevron-right"></i></button>' +
    "</div>" +
    "</div>";

  // RENDER HASIL KE DOM
  if (areaTbl) {
    areaTbl.innerHTML =
      '<div style="margin-bottom:.5rem; display:flex; justify-content:space-between; align-items:center; font-size:.82rem;font-weight:600">' +
      "<div>" +
      esc(pk.gol || "") +
      " - " +
      esc(pk.noperk || pk.noper || "") +
      " - " +
      esc(pk.desc || pk.nama || pk.penjelasan || "") +
      "</div>" +
      '<div style="color:var(--muted);">Periode: ' +
      labelMasa +
      " | Cabang: " +
      (cabang === "ALL" ? "Semua" : cabang) +
      " | <span style='color:var(--accent);font-weight:bold;'>GROUP: " +
      activeGroup +
      "</span></div>" +
      "</div>" +
      wrapTable(
        buildTable(
          ["Tanggal", "No Ref", "Keterangan", "Debit", "Kredit", "Saldo"],
          rows,
          {
            numCols: [3, 4, 5],
            foot: foot,
            emptyMsg: "Tidak ada transaksi untuk group ini",
          },
        ),
      ) +
      paginationHtml;
  }
}
function gantiGroupLaporan(prefix, renderFn) {
  var selGroup = document.getElementById("filter_" + prefix + "_group");
  if (selGroup) {
    localStorage.setItem("group", selGroup.value);
  }

  // JIKA YANG DIGANTI ADALAH BUKU BESAR, BERSIHKAN PILIHAN CABANG & PERKIRAAN LAMA
  if (prefix === "bukubesar") {
    localStorage.removeItem("bb_cabang"); // Reset penyimpanan cabang agar tidak bentrok antar group
  }

  var areaUtama = document.getElementById(
    "area_cetak_" + prefix,
  )?.parentElement;
  if (areaUtama && typeof window[renderFn] === "function") {
    areaUtama.innerHTML = window[renderFn]();

    // Kosongkan juga tabel hasil pencarian sebelumnya agar bersih dari data group lain
    var areaTbl = document.getElementById("bukuBesarTbl");
    if (areaTbl) {
      areaTbl.innerHTML =
        '<div class="empty-msg"><i class="fa-solid fa-search"></i> Silakan pilih cabang dan no perkiraan kembali</div>';
    }
  }
}

async function downloadBukuBesarExcel() {
  if (!window._bbExcelReady) {
    toast(
      "Silakan klik 'Terapkan' terlebih dahulu untuk menampilkan data.",
      "err",
    );
    return;
  }

  var r = window._bbExcelReady;
  var pk = r.pk;
  var cabang = r.cabang;
  var rows = r.rows;
  var foot = r.foot;
  var activeGroup = r.group || "TLGA";

  // Ambil nomor perkiraan yang aman (support noperk & noPerk)
  var noperkFull = pk.noperk || pk.noPerk || pk.noperkiraan || "";

  // 1. SUSUN HEADER TABEL (6 KOLOM PAS)
  var html =
    '<table border="1" style="border-collapse:collapse; font-family:Arial, sans-serif;">';
  html +=
    '<tr style="background:#f4f4f4; font-weight:bold; text-align:center;">';
  html += '<td style="padding:8px; border:1px solid #000;">TANGGAL</td>';
  html += '<td style="padding:8px; border:1px solid #000;">NO REFF</td>';
  html += '<td style="padding:8px; border:1px solid #000;">KETERANGAN</td>';
  html += '<td style="padding:8px; border:1px solid #000;">DEBIT</td>';
  html += '<td style="padding:8px; border:1px solid #000;">KREDIT</td>';
  html += '<td style="padding:8px; border:1px solid #000;">SALDO</td>';
  html += "</tr>";

  // 2. SUSUN DATA TRANSAKSI (6 KOLOM)
  rows.forEach(function (row) {
    html += "<tr>";

    // Cek apakah baris ini merupakan Saldo Awal / Saldo Bawaan
    var isSaldoRow = String(row[0]).indexOf("Saldo") !== -1;

    // Kolom 0: Tanggal / Saldo Awal
    html +=
      "<td style=\"padding:6px; border:1px solid #000; mso-number-format:'\\@';" +
      (isSaldoRow
        ? "font-style:italic; font-weight:bold;"
        : "text-align:center;") +
      '">' +
      (row[0] || "") + // 🌟 Langsung pakai row[0] tanpa re-format Date lagi
      "</td>";

    // Kolom 1: No Ref
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:center;">' +
      (row[1] || "") +
      "</td>";

    // Kolom 2: Keterangan
    html +=
      '<td style="padding:6px; border:1px solid #000;">' +
      (row[2] || "") +
      "</td>";

    // Kolom 3: Debit
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
      (row[3] || "") +
      "</td>";

    // Kolom 4: Kredit
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
      (row[4] || "") +
      "</td>";

    // Kolom 5: Saldo (Bersihkan tag HTML <span> jika ada)
    var saldoText = String(row[5] || "").replace(/<[^>]*>?/gm, "");
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right; font-weight:bold;">' +
      saldoText +
      "</td>";

    html += "</tr>";
  });

  // 3. SUSUN FOOTER TOTAL (6 KOLOM PAS)
  html += '<tr style="font-weight:bold; background:#f9f9f9;">';
  html +=
    '<td colspan="3" style="padding:8px; border:1px solid #000; text-align:right;">' +
    (foot[0] || "TOTAL") +
    "</td>";
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    (foot[3] || "") +
    "</td>";
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    (foot[4] || "") +
    "</td>";

  var footSaldoText = String(foot[5] || "").replace(/<[^>]*>?/gm, "");
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    footSaldoText +
    "</td>";
  html += "</tr></table>";

  // 4. JUDUL & INFORMASI HEADER LAPORAN
  var labelMasaExl = "";
  if (r.masaDari && r.masaSampai)
    labelMasaExl = r.masaDari + " s/d " + r.masaSampai;
  else if (r.masaDari) labelMasaExl = "Dari " + r.masaDari;
  else if (r.masaSampai) labelMasaExl = "S/d " + r.masaSampai;
  else labelMasaExl = "Semua (" + r.tahunMulai + ")";

  var infoAkun =
    "<h3>Buku Besar: " +
    noperkFull +
    " - " +
    (pk.desc || pk.nama || "") +
    "</h3>";
  infoAkun +=
    "<p>Cabang: " +
    (cabang === "ALL" ? "Semua" : cabang) +
    " | Periode: " +
    labelMasaExl +
    " | <b>Group: " +
    activeGroup +
    "</b></p>";

  var fullHtml =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Buku Besar</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>' +
    "<body>" +
    infoAkun +
    html +
    "</body></html>";

  // 5. PROCESS DOWNLOAD FILE
  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "BukuBesar_" +
    noperkFull +
    "_" +
    labelMasaExl.replace(/\s+/g, "_") +
    "_Group_" +
    activeGroup +
    ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast("File Excel berhasil diunduh.", "success");
}
/* ---------- ekspor ke xls---------- */

PANEL_MAP.rlLebar = renderRLLebar;
// =========================================================================
// 1. RENDER ANTARMUKA RL LEBAR (SINKRON - TANPA ASYNC)
// =========================================================================
function renderRLLebar() {
  if (typeof window._rlLebarFilterCabang === "undefined") {
    window._rlLebarFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "PUSAT";
  }

  if (typeof window._rlLebarFilterTahun === "undefined") {
    window._rlLebarFilterTahun = new Date().getFullYear();
  }

  // ==========================================
  // CEK LEVEL USER: PUSAT ATAU BUKAN?
  // ==========================================
  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";

  var activeGroup = localStorage.getItem("group") || "TLGA";

  // ==========================================
  // SIAPKAN DROPDOWN GROUP (HANYA UNTUK PUSAT)
  // ==========================================
  var groupUiHtml = "";
  if (isPusat) {
    groupUiHtml =
      '<div style="display:flex; align-items:center; gap:5px;">' +
      '<label style="font-size:.75rem; color:#ccc;">Filter Group:</label>' +
      '<select id="filter_rllebar_group" onchange="gantiGroupLaporan(\'rllebar\', \'renderRLLebar\')" style="padding:4px 8px; border:1px solid #555; background:#000; color:#fff; font-size:.8rem; font-weight:bold;">';

    var listGroup =
      (typeof DBCache !== "undefined" && DBCache.groupproject) || [];
    if (listGroup.length === 0) {
      groupUiHtml += '<option value="TLGA">TLGA</option>';
    } else {
      listGroup.forEach(function (g) {
        var val = String(g.kode || g.nama || g.group || "").trim();
        var label = (g.kode ? g.kode + " - " : "") + (g.nama || g.group || val);
        if (!val) return;
        groupUiHtml +=
          '<option value="' +
          esc(val) +
          '"' +
          (val === activeGroup ? " selected" : "") +
          ">" +
          esc(label) +
          "</option>";
      });
    }

    groupUiHtml += "</select></div>";
  } else {
    groupUiHtml =
      '<div style="font-size:.8rem; color:#ccc;">Group: <span style="color:#4da3ff; font-weight:bold;">' +
      esc(activeGroup) +
      "</span></div>";
  }

  // ==========================================
  // SIAPKAN DROPDOWN CABANG SESUAI GROUP AKTIF
  // ==========================================
  var rawCabang = (typeof DBCache !== "undefined" && DBCache.cabang) || [];
  var daftarCabangObj = [];
  rawCabang.forEach(function (c) {
    var id = (c.cabang || c.kode || "").trim();
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim();
    var groupCabang = (c.group || "").trim().toUpperCase();

    if (id && (activeGroup === "ALL_GROUP" || groupCabang === activeGroup)) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  var adaPusat = daftarCabangObj.some(function (item) {
    return item.id.toUpperCase() === "PUSAT" || item.id === "00";
  });
  if (!adaPusat) {
    daftarCabangObj.unshift({
      id: "PUSAT",
      nama: "PUSAT (SEMUA CABANG)",
    });
  }

  var kodeDefault = (window._rlLebarFilterCabang || "PUSAT").toUpperCase();
  var opsiCabangHtml = daftarCabangObj
    .map(function (item) {
      var sel = item.id.toUpperCase() === kodeDefault ? " selected" : "";
      return (
        '<option value="' +
        item.id +
        '" ' +
        sel +
        ">" +
        item.id +
        " - " +
        item.nama.toUpperCase() +
        "</option>"
      );
    })
    .join("");

  var opsiTahunHtml = "";
  for (var y = 2020; y <= 2030; y++) {
    var selTahun = y == window._rlLebarFilterTahun ? " selected" : "";
    opsiTahunHtml +=
      '<option value="' + y + '"' + selTahun + ">" + y + "</option>";
  }

  var htmlLaporan =
    '<div id="area_cetak_rllebar" style="background:#000; padding:1rem; border-radius:var(--r); border:1px solid #333; height:550px; max-height:550px; width:100%; overflow:hidden;">' +
    '<div style="text-align:center; color:#fff;">' +
    '<h3 style="margin:0 0 0.8rem 0; color:#fff;">Laporan RL Lebar Bulanan - Tahun ' +
    window._rlLebarFilterTahun +
    "</h3>" +
    '<div class="no-print" style="background:#111; border:1px solid #333; padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:1rem; color:#fff;">' +
    groupUiHtml +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:#ccc;">Tahun:</label>' +
    '<select id="filter_rllebar_tahun" style="padding:4px 8px; border:1px solid #555; background:#000; color:#fff;">' +
    opsiTahunHtml +
    "</select></div>" +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:#ccc;">Cabang:</label>' +
    '<select id="filter_rllebar_cabang" style="padding:4px 8px; border:1px solid #555; background:#000; color:#fff; min-width:120px;">' +
    opsiCabangHtml +
    "</select></div>" +
    '<button type="button" class="btn btn-g" style="background:#333; color:#fff; border:1px solid #555;" onclick="terapkanOpsiRLLebar()">Terapkan</button>' +
    '<button type="button" class="btn btn-b" style="background:#0a3d0a; color:#fff; border:1px solid #1a5c1a;" onclick="downloadRLLebarExcel()"><i class="fa-solid fa-file-excel"></i> Excel</button>' +
    "</div>" +
    '<div class="table-responsive-container" style="width:100%; height:380px; overflow:auto; border:1px solid #333; background:#000;">' +
    "<style>" +
    "#tempat_tabel_rllebar table{width:100%!important;min-width:1400px!important;border-collapse:collapse!important;background:#000;color:#fff;}" +
    "#tempat_tabel_rllebar th{padding:6px 8px!important;background:#1a1a1a!important;color:#fff!important;white-space:nowrap!important;border:1px solid #444!important;position:sticky!important;top:0;z-index:10;font-size:.75rem;}" +
    "#tempat_tabel_rllebar td{padding:6px 8px!important;white-space:nowrap!important;border:1px solid #333!important;font-size:.75rem;color:#fff!important;}" +
    "#tempat_tabel_rllebar tr:hover td{background:#1a1a1a!important;}" +
    "#tempat_tabel_rllebar td a{color:#4da3ff!important;}" +
    "</style>" +
    '<div id="tempat_tabel_rllebar" style="color:#fff;"></div>' +
    "</div></div></div>";

  return htmlLaporan;
}

// =========================================================================
// 2. FUNGSI EKSEKUSI TAMPILKAN DATA RL LEBAR
// =========================================================================
async function terapkanOpsiRLLebar() {
  var selectTahun = document.getElementById("filter_rllebar_tahun");
  var selectCabang = document.getElementById("filter_rllebar_cabang");
  var selectGroup = document.getElementById("filter_rllebar_group");

  if (!selectTahun || !selectCabang) return;

  // SIMPAN GROUP TERPILIH KE LOCALSTORAGE
  if (selectGroup && selectGroup.value) {
    localStorage.setItem("group", selectGroup.value);
  }

  var valTahun = selectTahun.value;
  var valCabang = selectCabang.value;
  window._rlLebarFilterTahun = valTahun;
  window._rlLebarFilterCabang = valCabang;

  var activeGroup =
    (selectGroup ? selectGroup.value : "") ||
    localStorage.getItem("group") ||
    (typeof getActiveGroup === "function" ? getActiveGroup() : "TLGA");

  activeGroup = String(activeGroup).trim().toUpperCase();
  if (activeGroup === "UNDEFINED" || !activeGroup) {
    activeGroup = "TLGA";
  }

  var area = document.getElementById("tempat_tabel_rllebar");
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem;text-align:center;"><span class="spinner"></span> Loading 12 bulan...</div>';
  }

  try {
    var namastoregolbackup = "golongan" + valTahun;
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    var namaBulan = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MEI",
      "JUN",
      "JUL",
      "AGS",
      "SEP",
      "OKT",
      "NOV",
      "DES",
    ];
    var mapGolongan = {};

    for (var bln = 1; bln <= 12; bln++) {
      var blnStr = ("0" + bln).slice(-2);
      var duaDigitTahun = String(valTahun).slice(-2);
      var kodeMasa = blnStr + duaDigitTahun;

      var dataBulanIni = rawdatagolongan.filter(function (g) {
        var kodeGol = parseInt(g.gol || g.golongan || 0, 10);
        var cocokGol = kodeGol >= 300 && kodeGol < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

        var cocokGroup =
          String(g.group || "")
            .trim()
            .toUpperCase() === activeGroup;

        var cocokCabang =
          valCabang === "PUSAT" ||
          valCabang === "ALL" ||
          valCabang === "" ||
          cabangData === valCabang;

        return cocokGol && cocokGroup && masaData === kodeMasa && cocokCabang;
      });

      dataBulanIni.forEach(function (item) {
        var kodeGol = String(item.gol || item.golongan || "");
        var namaGol = item.namagol || item.namaGol || item.nama_golongan || "";
        var saldoAkhir = Number((item.db || 0) - (item.cr || 0));

        if (!mapGolongan[kodeGol]) {
          mapGolongan[kodeGol] = {
            gol: kodeGol,
            namaGol: namaGol,
            cabang: valCabang,
            bulan: {},
            total: 0,
          };
          for (var b = 1; b <= 12; b++) {
            mapGolongan[kodeGol].bulan[("0" + b).slice(-2)] = 0;
          }
        }
        mapGolongan[kodeGol].bulan[blnStr] = saldoAkhir;
        mapGolongan[kodeGol].total += saldoAkhir;
      });
    }

    var listGol = Object.values(mapGolongan)
      .filter(function (g) {
        return g.total !== 0;
      })
      .sort(function (a, b) {
        return parseInt(a.gol, 10) - parseInt(b.gol, 10);
      });

    if (listGol.length === 0) {
      if (area) {
        area.innerHTML =
          '<div style="padding:3rem;text-align:center;color:#888;">Data kosong untuk Group: <b>' +
          activeGroup +
          "</b></div>";
      }
      return;
    }

    var html =
      '<div style="margin-bottom:.5rem;font-size:.78rem;color:#aaa;">3xx=Penjualan | 4xx=HPP | 5xx=By Adm | 6xx=Beban Lain | Group: <span style="color:#4da3ff;font-weight:bold">' +
      activeGroup +
      "</span> | Tahun: " +
      valTahun +
      "</div>";
    html +=
      '<div style="overflow-x:auto;border:1px solid #444;"><table border="1" style="width:100%;border-collapse:collapse;color:#fff;border:1px solid #444;background:#000;">';

    html +=
      '<thead><tr style="background:#1a1a1a;font-weight:bold;color:#fff;">';
    html +=
      '<th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;">GOL</th>';
    html +=
      '<th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;">NAMA GOLONGAN</th>';
    html +=
      '<th colspan="12" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:center;">BULAN</th>';
    html +=
      '<th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:right;">TOTAL YTD</th>';
    html +=
      '<th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;">CABANG</th>';
    html +=
      '</tr><tr style="background:#1a1a1a;font-weight:bold;color:#fff;text-align:center">';

    namaBulan.forEach(function (nb) {
      html +=
        '<th style="padding:6px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:center">' +
        nb +
        "</th>";
    });
    html += "</tr></thead><tbody>";

    var currentDigit = null;
    var subTotalPerBulan = {};
    var akumulasiLabaRugiPerBulan = {};

    for (var b = 1; b <= 12; b++) {
      var bsInit = ("0" + b).slice(-2);
      subTotalPerBulan[bsInit] = 0;
      akumulasiLabaRugiPerBulan[bsInit] = 0;
    }

    function buatBarisKeterangan(teks) {
      html +=
        '<tr><td colspan="16" style="padding:8px;border:1px solid #444;font-weight:bold;background:#111;color:#fff;text-align:left;">' +
        teks +
        "</td></tr>";
    }

    function buatBarisSubtotal(teks, arrBulan, total, warnaBg, doubleTop) {
      var topBorder = doubleTop ? "border-top:3px double #fff;" : "";
      html += '<tr style="background:' + warnaBg + ';font-weight:bold;">';
      html +=
        '<td colspan="2" style="padding:8px;border:1px solid #444;text-align:right;' +
        topBorder +
        'color:#fff;">' +
        teks +
        "</td>";
      for (var b = 1; b <= 12; b++) {
        var blnStr = ("0" + b).slice(-2);
        var val = arrBulan[blnStr] || 0;
        html +=
          '<td style="padding:8px;border:1px solid #444;text-align:right;color:' +
          (val >= 0 ? "#fff" : "#ffcdd2") +
          ";" +
          topBorder +
          '">' +
          formatUang(val) +
          "</td>";
      }
      html +=
        '<td style="padding:8px;border:1px solid #444;text-align:right;color:' +
        (total >= 0 ? "#fff" : "#ffcdd2") +
        ";" +
        topBorder +
        '">' +
        formatUang(total) +
        "</td>";
      html +=
        '<td style="padding:8px;border:1px solid #444;' +
        topBorder +
        'color:#fff;"></td></tr>';
    }

    function prosesAkumulasiYTD(digitSekarang, subTotalBulan) {
      for (var b = 1; b <= 12; b++) {
        var bsLaba = ("0" + b).slice(-2);
        var nilaiBulanIni = subTotalBulan[bsLaba] || 0;
        if (digitSekarang === "3") {
          akumulasiLabaRugiPerBulan[bsLaba] = nilaiBulanIni;
        } else {
          akumulasiLabaRugiPerBulan[bsLaba] += nilaiBulanIni;
        }
      }
    }

    for (var i = 0; i < listGol.length; i++) {
      var item = listGol[i];
      var kodeGol = parseInt(item.gol, 10);
      var digit = String(kodeGol).charAt(0);

      if (currentDigit !== null && digit !== currentDigit) {
        var arrSub = {};
        var totalSub = 0;
        for (var b = 1; b <= 12; b++) {
          var bs = ("0" + b).slice(-2);
          arrSub[bs] = subTotalPerBulan[bs];
          totalSub += subTotalPerBulan[bs];
        }

        var ket = "SUBTOTAL " + currentDigit + "xx";
        if (currentDigit === "3") ket = "PENJUALAN BERSIH";
        if (currentDigit === "4") ket = "TOTAL HPP";
        if (currentDigit === "5") ket = "TOTAL BY ADM & UMUM";
        if (currentDigit === "6") ket = "TOTAL BEBAN LAINNYA";

        buatBarisSubtotal(ket, arrSub, totalSub, "#1b5e20", false);
        prosesAkumulasiYTD(currentDigit, subTotalPerBulan);

        for (var b = 1; b <= 12; b++) {
          subTotalPerBulan[("0" + b).slice(-2)] = 0;
        }
      }

      if (currentDigit !== digit) {
        if (digit === "3") buatBarisKeterangan("PENJUALAN");
        if (digit === "4") buatBarisKeterangan("HARGA POKOK PENJUALAN (HPP)");
        if (digit === "5") buatBarisKeterangan("BIAYA ADMINISTRASI & UMUM");
        if (digit === "6") buatBarisKeterangan("BEBAN LAINNYA");
      }

      currentDigit = digit;
      html += "<tr>";
      html +=
        "<td onclick=\"lihatDetTransRLLebar('" +
        item.gol +
        "', 'YTD" +
        valTahun +
        "', '" +
        valCabang +
        '\')" style="padding:6px;border:1px solid #3e0a93;cursor:pointer;color:#4da3ff;font-weight:bold;text-decoration:underline;">' +
        item.gol +
        "</td>";
      html +=
        '<td style="padding:6px;border:1px solid #444;color:#fff;text-align: left;">' +
        esc(item.namaGol) +
        "</td>";

      for (var b = 1; b <= 12; b++) {
        var bs = ("0" + b).slice(-2);
        var rawVal =
          item.bulan && item.bulan[bs] !== undefined ? item.bulan[bs] : 0;
        var val = num(rawVal);

        if (!subTotalPerBulan[bs]) subTotalPerBulan[bs] = 0;
        subTotalPerBulan[bs] += val;

        html +=
          '<td style="padding:6px;border:1px solid #444;text-align:right;color:' +
          (val >= 0 ? "#fff" : "#ffc107") +
          '">' +
          (val !== 0 ? formatUang(val) : "") +
          "</td>";
      }

      html +=
        '<td style="padding:6px;border:1px solid #444;text-align:right;font-weight:bold;color:' +
        (item.total >= 0 ? "#fff" : "#ff6b6b") +
        '">' +
        formatUang(item.total) +
        "</td>";
      html +=
        '<td style="padding:6px;border:1px solid #444;color:#fff;">' +
        esc(item.cabang) +
        "</td></tr>";
    }

    if (currentDigit !== null) {
      var arrSubAkhir = {};
      var totalSubAkhir = 0;
      for (var b = 1; b <= 12; b++) {
        var bs = ("0" + b).slice(-2);
        arrSubAkhir[bs] = subTotalPerBulan[bs];
        totalSubAkhir += subTotalPerBulan[bs];
      }

      var ketAkhir = "SUBTOTAL " + currentDigit + "xx";
      if (currentDigit === "3") ketAkhir = "PENJUALAN BERSIH";
      if (currentDigit === "4") ketAkhir = "TOTAL HPP";
      if (currentDigit === "5") ketAkhir = "TOTAL BY ADM & UMUM";
      if (currentDigit === "6") ketAkhir = "TOTAL BEBAN LAINNYA";

      buatBarisSubtotal(ketAkhir, arrSubAkhir, totalSubAkhir, "#1b5e20", false);
      prosesAkumulasiYTD(currentDigit, subTotalPerBulan);
    }

    html +=
      '<tr><td colspan="16" style="border:1px solid #444;padding:4px;background-color:#ffc107;"></td></tr>';
    var arrTotalBulan = {};
    var grandTotal = 0;
    for (var b = 1; b <= 12; b++) {
      var bs = ("0" + b).slice(-2);
      arrTotalBulan[bs] = akumulasiLabaRugiPerBulan[bs];
      grandTotal += akumulasiLabaRugiPerBulan[bs];
    }

    buatBarisSubtotal(
      "LABA / RUGI BERSIH YTD",
      arrTotalBulan,
      grandTotal,
      "#1b5e20",
      true,
    );
    html += "</tbody></table></div>";
    if (area) area.innerHTML = html;
  } catch (e) {
    console.error(e);
    if (area) {
      area.innerHTML =
        '<div style="padding:3rem;text-align:center;color:#ff6b6b;">Error: ' +
        e.message +
        "</div>";
    }
  }
}

function lihatDetTransRLLebar(noPerkiraan, masa, cabang) {
  // ==========================================
  // 1. OLAH MASA: HANYA AMBIL 2 DIGIT TERAKHIR SEBAGAI TAHUN
  // ==========================================
  var masaStr = String(masa || "").trim();
  var duaDigitTahun = masaStr.slice(-2); // Misal: "24" -> "24", atau "2024" -> "24"

  // Jika ternyata yang dikirim adalah 4 digit tahun penuh (misal "2024"), ambil 4 digit untuk nama store
  var tahunFull =
    masaStr.length >= 4 ? masaStr.slice(-4) : "20" + duaDigitTahun;
  var namaStore = "transaksi" + tahunFull;

  console.log(
    "🎨 [Detil RL] Masa Asli:",
    masa,
    "| Dua Digit Tahun:",
    duaDigitTahun,
    "| Store:",
    namaStore,
  );

  // ==========================================
  // 2. AMBIL GROUP AKTIF
  // ==========================================
  var activeGroup = (localStorage.getItem("group") || "TLGA")
    .trim()
    .toUpperCase();

  var popupId = "popup_transaksi_" + Date.now();

  var cabFilter = String(cabang || "")
    .trim()
    .toUpperCase();
  if (cabFilter === "PUSAT") cabFilter = "00";

  var popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:50%; max-width:700px; max-height:90vh; background:#000; border:2px solid #4da3ff; box-shadow:0 0 20px rgba(77, 163, 255, 0.5); z-index:10001; display:flex; flex-direction:column; border-radius:8px;">' +
    '<div style="padding:12px; background:#1a1a1a; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; border-radius:8px 8px 0 0;">' +
    '<strong style="font-size:0.9rem; color:#4da3ff;">Detil Transaksi YTD: ' +
    esc(noPerkiraan) +
    " | Tahun: " +
    esc(tahunFull) +
    " | Group: " +
    esc(activeGroup) +
    " | Cabang: " +
    esc(cabFilter) +
    "</strong>" +
    "<button onclick=\"document.getElementById('" +
    popupId +
    '\').remove()" style="background:none; border:none; font-size:1.5rem; line-height:1; cursor:pointer; color:#fff;">&times;</button>' +
    "</div>" +
    '<div id="' +
    popupId +
    '_body" style="padding:10px; overflow-y:auto; flex:1; font-size:0.8rem; color:#fff;">' +
    '<div style="text-align:center; padding:20px; color:#888;">Loading data transaksi...</div>' +
    "</div></div>";

  document.body.insertAdjacentHTML("beforeend", popupHtml);
  var container = document.getElementById(popupId + "_body");

  db.getAll(namaStore)
    .then(function (rawData) {
      var listTrans = Array.isArray(rawData) ? rawData : [];
      var targetNoPerk = String(noPerkiraan || "")
        .trim()
        .toUpperCase();
      var prefix3Digit = targetNoPerk.substring(0, 3);

      var detilTrans = listTrans.filter(function (t) {
        var tNo = String(t.noper || t.noperkiraan || t.noPerk || "")
          .trim()
          .toUpperCase();
        var tCab = String(t.cabang || t.cab || "")
          .trim()
          .toUpperCase();
        var tMasa = String(t.masa || "").trim();
        var tGroup = String(t.group || "")
          .trim()
          .toUpperCase();

        // A. CEK PERKIRAAN
        var cocokPerkiraan =
          tNo === targetNoPerk || tNo.substring(0, 3) === prefix3Digit;

        // B. CEK TAHUN (YTD) -> Cek apakah 2 digit terakhir masa di DB sama dengan 2 digit tahun yang dicari
        var cocokMasa = tMasa.length >= 2 && tMasa.endsWith(duaDigitTahun);

        // C. CEK CABANG
        var cocokCabang = true;
        if (cabFilter !== "ALL" && cabFilter !== "") {
          cocokCabang =
            tCab === cabFilter ||
            (cabFilter === "00" && (tCab === "00" || tCab === "PUSAT")) ||
            (cabFilter === "PUSAT" && (tCab === "00" || tCab === "PUSAT"));
        }

        // D. CEK GROUP
        var cocokGroup = activeGroup === "ALL_GROUP" || tGroup === activeGroup;

        return cocokPerkiraan && cocokMasa && cocokCabang && cocokGroup;
      });

      // ==========================================
      // JIKA DATA TIDAK DITEMUKAN (DEBUG MODE)
      // ==========================================
      if (detilTrans.length === 0) {
        var debugHtml =
          '<div style="text-align:left; padding:15px; color:#ffc107; font-size:0.8rem; background:#111; border:1px solid #444; border-radius:5px;">';
        debugHtml +=
          '<b style="color:#ff6b6b; font-size:1rem;">🔍 MODE DEBUG DATABASE</b><br><br>';
        debugHtml +=
          "Total data di store <b>" +
          namaStore +
          "</b>: " +
          listTrans.length +
          " baris.<br>";
        debugHtml +=
          "Dicari Noper/Prefix: <b>" +
          esc(targetNoPerk) +
          "</b> | Akhiran Tahun: <b>" +
          duaDigitTahun +
          "</b> | Cabang: <b>" +
          esc(cabFilter) +
          "</b> | Group: <b>" +
          esc(activeGroup) +
          "</b>";
        debugHtml += '<hr style="border-color:#444;">';

        if (listTrans.length === 0) {
          debugHtml +=
            '<span style="color:red;">DATABASE KOSONG! Store ' +
            namaStore +
            " tidak berisi data.</span>";
        } else {
          debugHtml +=
            "<b>5 Data Pertama di Database (Perhatikan penulisan kolom):</b><br><br>";
          debugHtml +=
            '<table border="1" style="width:100%; border-collapse:collapse; font-size:0.75rem; color:#fff; background:#000;">';
          debugHtml +=
            '<tr style="background:#333;"><th>NOPER</th><th>MASA</th><th>CABANG</th><th>GROUP</th><th>DB</th><th>CR</th></tr>';

          var sampelData = listTrans.slice(0, 5);
          for (var s = 0; s < sampelData.length; s++) {
            var d = sampelData[s];
            debugHtml += "<tr>";
            debugHtml +=
              '<td style="color:#4da3ff;">' +
              String(d.noper || d.noperkiraan || "-") +
              "</td>";
            debugHtml += "<td>" + String(d.masa || "-") + "</td>";
            debugHtml += "<td>" + String(d.cabang || d.cab || "-") + "</td>";
            debugHtml += "<td>" + String(d.group || "-") + "</td>";
            debugHtml +=
              '<td style="text-align:right;">' + fmtN(d.db || 0) + "</td>";
            debugHtml +=
              '<td style="text-align:right;">' + fmtN(d.cr || 0) + "</td>";
            debugHtml += "</tr>";
          }
          debugHtml += "</table>";
        }
        debugHtml += "</div>";
        container.innerHTML = debugHtml;
        return;
      }

      // ==========================================
      // RENDER TABEL TRANSAKSI
      // ==========================================
      detilTrans.sort(function (a, b) {
        var masaA = String(a.masa || "");
        var masaB = String(b.masa || "");
        if (masaA !== masaB) return masaA.localeCompare(masaB);
        return String(a.tanggal || "").localeCompare(String(b.tanggal || ""));
      });

      var tableHtml =
        '<div style="overflow-x:auto; background-color:#000000; color:#ffffff;">' +
        '<table style="width:100%; border-collapse:collapse; font-size:0.75rem; min-width:500px; background-color:#000000; color:#ffffff;">' +
        '<thead style="background:#1a1a1a; position:sticky; top:0; color:#ffffff;"><tr>' +
        '<th style="border:1px solid #444; padding:5px;">MASA</th>' +
        '<th style="border:1px solid #444; padding:5px;">TANGGAL</th>' +
        '<th style="border:1px solid #444; padding:5px;">NOREFF</th>' +
        '<th style="border:1px solid #444; padding:5px;">DESC</th>' +
        '<th style="border:1px solid #444; padding:5px; text-align:right;">DEBET</th>' +
        '<th style="border:1px solid #444; padding:5px; text-align:right;">KREDIT</th>' +
        "</tr></thead><tbody>";

      var totalDb = 0;
      var totalCr = 0;

      detilTrans.forEach(function (t) {
        var msa = t.masa || "-";
        // 🔴 PERUBAHAN DI SINI: Potong string tanggal hanya untuk mengambil bagian Tanggal saja (10 karakter pertama)
        var tglRaw = String(t.tanggal || "-");
        var tgl = tglRaw === "-" ? "-" : tglRaw.substring(0, 10);

        var ref = t.noreff || "-";
        var ket = t.penjelasan || t.desc || "-";
        var dbVal = num(t.db || 0);
        var crVal = num(t.cr || 0);

        totalDb += dbVal;
        totalCr += crVal;

        tableHtml +=
          "<tr>" +
          '<td style="border:1px solid #444; padding:4px; text-align:center; color:#4da3ff;">' +
          esc(msa) +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          esc(tgl) +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          esc(ref) +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          esc(ket) +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px; text-align:right;">' +
          fmtN(dbVal) +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px; text-align:right;">' +
          fmtN(crVal) +
          "</td>" +
          "</tr>";
      });

      tableHtml +=
        '<tr style="background:#1b5e20; font-weight:bold;">' +
        '<td colspan="4" style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">TOTAL YTD</td>' +
        '<td style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">' +
        fmtN(totalDb) +
        "</td>" +
        '<td style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">' +
        fmtN(totalCr) +
        "</td>" +
        "</tr>";

      tableHtml += "</tbody></table></div>";
      container.innerHTML = tableHtml;
    })
    .catch(function (err) {
      container.innerHTML =
        '<div style="text-align:center; padding:20px; color:#ff6b6b;">Error Database: ' +
        esc(err.message) +
        "</div>";
    });
}
