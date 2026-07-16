/* ================================================================
   app_laporan.js — NERACA, DETIL NERACA, RL REKAP, RL DETIL,
                    BUKU BESAR, EXPORT XLS
   ================================================================ */

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
async function renderNeraca() {
  // 1. SIAPKAN NILAI DEFAULT SAAT PERTAMA KALI DIBUKA
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
    window._neracaFilterMasa = bln + "-" + d.getFullYear(); // "MM-YYYY"
  }

  // Pecah Masa untuk kebutuhan format Input HTML (YYYY-MM)
  var partMasa = window._neracaFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];
  var inputMonthValue = filterTahunFull + "-" + filterBulan;

  // 2. AMBIL GROUP AKTIF DARI LOCALSTORAGE (DENGAN PENGAMAN "UNDEFINED")
  var rawGroup = localStorage.getItem("group");
  var groupAktif = "TLGA"; // Default cadangan

  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    groupAktif = rawGroup.trim().toUpperCase();
  }

  // 3. PROSES & SARING DAFTAR CABANG BERDASARKAN GROUP
  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = [];

  rawCabang.forEach(function (c) {
    var id = (c.kode || "").trim();
    var nama = (c.nama || id || "Tanpa Nama").trim();
    var groupCabang = (c.group || "").trim().toUpperCase();

    // HANYA MASUKKAN JIKA: Id valid, dan Group cabang sama dengan Group yang aktif
    if (id && groupCabang === groupAktif) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  // Urutkan cabang berdasarkan ID secara alfabetis/numerik
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
      nama: "PUSAT (SEMUA GROUP " + groupAktif + ")",
    });
  }

  var kodeDefault = (window._neracaFilterCabang || "PUSAT").toUpperCase();

  // BUAT OPSI DROPDOWN (SELALU BISA DIKLIK / TERBUKA)
  var opsiCabangHtml = daftarCabangObj
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

  // 4. RENDER HTML ANTARMUKA
  var htmlLaporan =
    '<div id="area_cetak_neraca" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan Neraca</h3>' +
    // --- FILTER PANEL ---
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:1rem;">' +
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 GROUP: <span style="color:var(--accent);">' +
    groupAktif +
    "</span> | PILIHAN TAMPILAN:</div>" +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Masa:</label>' +
    '<input type="month" id="filter_neraca_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Cabang:</label>' +
    // TIDAK ADA ATRIBUT DISABLED DI SINI
    '<select id="filter_neraca_cabang" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; min-width:120px;">' +
    opsiCabangHtml +
    "</select>" +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiNeraca()">' +
    "Tampilkan Data" +
    "</button>" +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadNeracaExcel()">' +
    '<i class="fa-solid fa-file-excel"></i> Download Excel' +
    "</button>" +
    "</div>" +
    // --- WADAH SCROLL TABEL ---
    '<div class="table-responsive-container" style="width:100%; height:380px; max-height:380px; overflow:auto; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box;">' +
    "<style>" +
    "#tempat_tabel_preview table { width: 100% !important; min-width: 1000px !important; border-collapse: collapse !important; table-layout: auto !important; }" +
    "#tempat_tabel_preview th { padding: 8px 10px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; text-align:left; }" +
    "#tempat_tabel_preview td { padding: 6px 10px !important; border: 1px solid var(--brd); font-size:0.85rem; }" +
    "</style>" +
    '<div id="tempat_tabel_preview" style="width:100%; display:block; text-align:left;"></div>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem;">Klik tombol Tampilkan Data untuk memuat detail perkiraan.</p>' +
    "</div>" +
    "</div>";

  return htmlLaporan;
}

// Fungsi awal untuk memuat isi cabang default dari cache
function initOpsiCabangNeraca() {
  var selectCabang = document.getElementById("filter_neraca_cabang");
  if (!selectCabang) return;

  var rawCabang = DBCache.cabang || [];
  var kodeDefault = (window._neracaFilterCabang || "PUSAT").toUpperCase();

  var html = "";
  rawCabang.forEach(function (c) {
    var id = (c.cabang || c.kode || "").trim();
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim();
    if (id) {
      var sel = id.toUpperCase() === kodeDefault ? "selected" : "";
      html +=
        '<option value="' +
        id +
        '" ' +
        sel +
        ">" +
        nama.toUpperCase() +
        "</option>";
    }
  });

  if (!html) {
    html = '<option value="PUSAT">PUSAT</option>';
  }
  selectCabang.innerHTML = html;

  // Jalankan pengecekan jika nilai bawaannya/default-nya adalah PUSAT
  handleCabangChange(selectCabang.value);
}

// Fungsi inti: jika memilih PUSAT, filter opsi dropdown hanya untuk cabang dengan Group yang sama
function handleCabangChange(valCabang) {
  if (valCabang.toUpperCase() === "PUSAT" || valCabang === "00") {
    var selectCabang = document.getElementById("filter_neraca_cabang");
    var rawCabang = DBCache.cabang || [];
    var groupAktif = (localStorage.getItem("group") || "TLGA")
      .trim()
      .toUpperCase();

    // Saring cabang yang memiliki kesamaan group
    var cabangSatuGroup = rawCabang.filter(function (c) {
      var groupCabang = (c.group || c.kode_group || "").trim().toUpperCase();
      return groupCabang === groupAktif;
    });

    if (cabangSatuGroup.length > 0) {
      var html = "";
      // Tetap masukkan pilihan PUSAT di baris paling atas sebagai penanda aktif
      html +=
        '<option value="' +
        valCabang +
        '" selected>PUSAT (SEMUA GROUP ' +
        groupAktif +
        ")</option>";

      cabangSatuGroup.forEach(function (c) {
        var id = (c.cabang || c.kode || "").trim();
        var nama = (c.nama || c.cabang || "Tanpa Nama").trim();
        // Hindari duplikasi baris pusat
        if (id && id.toUpperCase() !== "PUSAT" && id !== "00") {
          html +=
            '<option value="' + id + '">' + nama.toUpperCase() + "</option>";
        }
      });

      selectCabang.innerHTML = html;
    }
  }
}
// =========================================================================
// FUNGSI UTAMA: TAMPILKAN NERACA
// =========================================================================
async function terapkanOpsiNeraca() {
  var inputmasa = document.getElementById("filter_neraca_masa");
  var selectcabang = document.getElementById("filter_neraca_cabang");

  if (!inputmasa || !selectcabang) {
    console.warn("Elemen filter belum ditemukan.");
    return;
  }

  var valmasa = inputmasa.value;
  var valcabang = selectcabang.value;

  if (!valmasa) {
    if (typeof toast === "function")
      toast("silakan pilih masa/periode terlebih dahulu", "err");
    return;
  }

  closeModal();
  var part = valmasa.split("-");
  var filtertahunfull = part[0];
  var filterbulan = part[1];
  var duadigittahunbelakang = filtertahunfull.substring(2, 4);

  window._neracaFilterMasa = filterbulan + "-" + filtertahunfull;
  window._neracaFilterCabang = valcabang;
  window._neracaModeBackup = true;

  var kodemasadicari = filterbulan + duadigittahunbelakang;
  var namastoregolbackup = "golongan" + filtertahunfull;

  var area =
    document.getElementById("contentarea") ||
    document.getElementById("tempat_tabel_preview");

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

    // --- PERBAIKAN 1: PENGAMAN GROUP UNDEFINED ---
    var rawGroup = localStorage.getItem("group");
    var activeGroup = "TLGA";
    if (
      rawGroup &&
      rawGroup.trim() !== "" &&
      rawGroup.trim().toUpperCase() !== "UNDEFINED"
    ) {
      activeGroup = rawGroup.trim().toUpperCase();
    }

    // Filter Data
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

        // --- PERBAIKAN 2: MENANGKAPI PILIHAN "PUSAT" UNTUK MENAMPILKAN SEMUA CABANG ---
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

    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";

    if (area) {
      area.style.overflowY = "visible";
      area.style.maxHeight = "none";
      area.style.height = "auto";
    }

    var subAwal = 0,
      subDb = 0,
      subCr = 0;
    var currentGolPrefix = "";

    html +=
      '<div style="width: 100%; overflow-x: auto; border: 1px solid #ddd; -webkit-overflow-scrolling: touch;">';
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
    html += "</tr></thead>";
    html += "<tbody>";

    // --- PERBAIKAN 3: MEMPERBAIKI STRUKTUR HTML TABLE YANG RUSAK ---
    golterfilter.forEach(function (item) {
      var kodeGol = parseInt(
        item.gol || item.golongan || item.kode_golongan || 0,
        10,
      );
      var itemPrefix = String(kodeGol).charAt(0);
      var nilaiAwal = parseFloat(item.awal || 0);
      var nilaiDb = parseFloat(item.db || item.debit || 0);
      var nilaiCr = parseFloat(item.cr || item.kredit || 0);

      // CEK SUBTOTAL DI LUAR LOOP KOLOM (BUKAN DI DALAM headers.forEach)
      if (currentGolPrefix !== "" && itemPrefix !== currentGolPrefix) {
        html +=
          '<tr style="font-size:0.85rem; font-weight:bold; background:#ffffff; color:#000000;">';
        html +=
          '<td colspan="3" style="padding:10px; border:1px solid #000; color:#000000;">TOTAL AKTIVA ' +
          currentGolPrefix +
          "XX</td>";
        html +=
          '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap; color:#000000;">' +
          formatUang(subAwal + subDb - subCr) +
          "</td>";
        html += '<td style="padding:2px; border:1px solid #000;"></td>';
        html += "</tr>";
        subAwal = 0;
        subDb = 0;
        subCr = 0;
      }

      currentGolPrefix = itemPrefix;
      subAwal += nilaiAwal;
      subDb += nilaiDb;
      subCr += nilaiCr;

      // MULAI BUAT BARIS (<tr>) UNTUK DATA ISI
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
          val = item.namaGol !== undefined ? item.namaGol : "";
        } else if (h === "masa") {
          val = item.masa !== undefined ? item.masa : "";
        } else if (h === "akhir") {
          // Jika field akhir tidak ada di DB, hitung manual dari awal+db-cr
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

      html += "</tr>"; // TUTUP BARIS ISI
    });

    // SUBTOTAL TERAKHIR
    if (currentGolPrefix !== "") {
      html +=
        '<tr style="font-size:0.85rem; font-weight:bold; background:#ffffff; color:#000000;">';
      html +=
        '<td colspan="3" style="padding:10px; border:1px solid #000; color:#000000;">TOTAL AKTIVA ' +
        currentGolPrefix +
        "XX</td>";
      html +=
        '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap; color:#000000;">' +
        formatUang(subAwal + subDb - subCr) +
        "</td>";
      html += '<td style="padding:2px; border:1px solid #000;"></td>';
      html += "</tr>";
    }

    // GRAND TOTAL
    var totalAwal = golterfilter.reduce(function (sum, item) {
      return sum + (parseFloat(item.awal || 0) || 0);
    }, 0);
    var totalDb = golterfilter.reduce(function (sum, item) {
      return sum + (parseFloat(item.db || item.debit || 0) || 0);
    }, 0);
    var totalCr = golterfilter.reduce(function (sum, item) {
      return sum + (parseFloat(item.cr || item.kredit || 0) || 0);
    }, 0);

    html +=
      '<tr style="font-size:0.85rem; font-weight:bold; background:#ffffff; color:#000000;">';
    html +=
      '<td colspan="3" style="padding:10px; border:1px solid #000; color:#000000;">TOTAL NERACA</td>';
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap; color:#000000;">' +
      formatUang(totalAwal + totalDb - totalCr) +
      "</td>";
    html +=
      '<td style="padding:10px; border:1px solid #000; color:#000000;"></td>';
    html += "</tr>";

    html += "</tbody></table>";
    html += "</div>";

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

  // ✅ TAMBAHAN GROUP: AMBIL GROUP AKTIF
  var activeGroup = localStorage.getItem("group") || "TLGA";

  var popupId = "popup_transaksi_" + Date.now();

  var popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:45%; max-width:650px; max-height:90vh; background:white; border:1px solid #aaa; box-shadow:0 5px 15px rgba(0,0,0,0.5); z-index:10001; display:flex; flex-direction:column; border-radius:6px;">' +
    '<div style="padding:10px; background:#f0f0f0; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center; border-radius:6px 6px 0 0;">' +
    // ✅ TAMBAHAN GROUP: TAMPILKAN DI JUDUL POPUP
    '<strong style="font-size:0.9rem; color:#333;">Detil Transaksi: ' +
    noPerkiraan +
    ' <small style="color:#888;">(Group: ' +
    activeGroup +
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
      var cabFilter = cabInput;
      if (cabInput === "PUSAT") cabFilter = "00";

      var detilTrans = listTrans.filter(function (t) {
        var tNo = String(t.noperkiraan || "").trim();
        var tCab = String(t.cabang || "")
          .trim()
          .toUpperCase();
        var tMasa = String(t.masa || "").trim();

        var cocokCabang = true;
        if (cabFilter !== "ALL" && cabFilter !== "") {
          cocokCabang = tCab === cabFilter;
        }

        // ✅ TAMBAHAN GROUP: FILTER GROUP DI DATABASE TRANSAKSI
        var tGroup = String(t.group || "").trim();
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
          " | Cabang Kode: " +
          cabFilter +
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
        var ket = t.desc || "-";
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
        '<td colspan="3" style="border:1px solid #ccc; padding:5px; text-align:right;">TOTAL</td>' +
        '<td style="border:1px solid #ccc; padding:5px; text-align:right;">' +
        fmtN(totalDb) +
        "</td>" +
        '<td style="border:1px solid #ccc; padding:5px; text-align:right;">' +
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

// =========================================================================
// FUNGSI LIHAT DETIL PERKIRAAN (DARI KLIK GOLONGAN)
// =========================================================================
async function lihatDetilPerkiraan(kodeGol, masa, cabang) {
  var duadigittahun = masa.substring(2, 4);
  var tahunAktif = "20" + duadigittahun;
  var namaStoreBackup = "perkiraan" + tahunAktif;
  var kodeMasa = masa;

  // ✅ TAMBAHAN GROUP: AMBIL GROUP AKTIF
  var activeGroup = localStorage.getItem("group") || "TLGA";

  openModal(
    "Detil Perkiraan: " + kodeGol,
    '<div style="text-align:center; padding:2rem;"><span class="spinner"></span><br>Memuat data...</div>',
    "",
  );

  try {
    var rawData = await db.getAll(namaStoreBackup);
    var listPerkiraan = Array.isArray(rawData) ? rawData : [];

    var detilFilter = listPerkiraan.filter(function (p) {
      var noPerk = String(p.noPerk || p.noperkiraan || "").trim();
      var prefixGol = noPerk.substring(0, 3);

      var masaData = String(p.masa || p.periode || p.kode_masa || "").trim();
      var cabangData = String(p.cabang || p.cab || p.kode_cabang || "").trim();

      var cocokGolMasa =
        prefixGol === String(kodeGol).trim() && masaData === masa;

      var cocokCabang = true;
      var cabangUpper = String(cabang).trim().toUpperCase();
      if (cabangUpper !== "ALL" && cabangUpper !== "") {
        cocokCabang = cabangData === String(cabang).trim();
      }

      // ✅ TAMBAHAN GROUP: FILTER GROUP DI DATABASE PERKIRAAN
      var groupData = String(p.group || "").trim();
      var cocokGroup = groupData === activeGroup;

      return cocokGolMasa && cocokCabang && cocokGroup; // Tambahkan cocokGroup di sini
    });

    if (detilFilter.length === 0) {
      $("modalBody").innerHTML =
        '<div style="text-align:center; padding:1rem; color:var(--muted);">Tidak ada data perkiraan untuk Golongan ' +
        kodeGol +
        " di tahun " +
        tahunAktif +
        " untuk Group: " +
        activeGroup +
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
      var no = row.noPerk || row.noperkiraan || "";
      var nm = row.desc || row.nama || "";
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

// =========================================================================
// FUNGSI RENDER DETIL NERACA (SUMBER DATA: PERKIRAAN BACKUP)
// =========================================================================
function downloadNeracaDetilExcel() {
  // 1. Validasi keberadaan wadah tabel preview
  var area = document.getElementById("tempat_tabel_neraca_detil");
  var table = area ? area.querySelector("table") : null;

  if (!table) {
    if (typeof toast === "function")
      toast(
        "Belum ada data tabel yang ditampilkan. Klik Tampilkan Data terlebih dahulu.",
        "wrn",
      );
    else
      alert(
        "Belum ada data tabel yang ditampilkan. Klik Tampilkan Data terlebih dahulu.",
      );
    return;
  }

  try {
    // 2. Kloning tabel agar tidak merusak tampilan UI asli di layar
    var tableClone = table.cloneNode(true);

    // Ambil parameter filter untuk judul laporan
    var masa = window._neracaFilterMasa || "Semua";

    // Ambil nama teks cabang yang sedang terpilih dari dropdown filter
    var selectCabang = document.getElementById("filter_neraca_cabang");
    var namaCabang =
      selectCabang && selectCabang.options[selectCabang.selectedIndex]
        ? selectCabang.options[selectCabang.selectedIndex].text
        : window._neracaFilterCabang || "Pusat";

    var activeGroupLabel = localStorage.getItem("group") || "TLGA";

    // 3. Hitung jumlah kolom tabel asli untuk kebutuhan colspan judul
    var firstRow = tableClone.rows[0];
    var totalKolom = firstRow ? firstRow.cells.length : 5;

    // 4. Buat baris Judul Laporan & Periode Masa
    var headerRow = document.createElement("tr");
    headerRow.innerHTML =
      '<td colspan="' +
      totalKolom +
      '" style="font-weight:bold; font-size:16px; text-align:left; border:none; padding:5px 0;">LAPORAN NERACA ' +
      namaCabang.toUpperCase() +
      "</td>";

    var periodRow = document.createElement("tr");
    periodRow.innerHTML =
      '<td colspan="' +
      totalKolom +
      '" style="font-weight:bold; font-size:12px; text-align:left; border:none; padding:3px 0 15px 0;">PERIODE: ' +
      masa.toUpperCase() +
      " | GROUP: " +
      activeGroupLabel.toUpperCase() +
      "</td>";

    // Sisipkan judul ke bagian paling atas tabel kloning
    tableClone.insertBefore(periodRow, tableClone.firstChild);
    tableClone.insertBefore(headerRow, tableClone.firstChild);

    // 5. Bersihkan atribut interaktif dan rapikan format kolom data di Excel
    for (var i = 0; i < tableClone.rows.length; i++) {
      var row = tableClone.rows[i];

      // Lewati format pembersihan untuk 2 baris judul teratas
      if (i < 2) continue;

      for (var j = 0; j < row.cells.length; j++) {
        var cell = row.cells[j];
        cell.removeAttribute("onclick"); // Hapus event click sisa DOM

        // Cari tahu apakah cell ini berisi angka saldo berdasarkan kelas/posisi (biasanya text-align right atau angka bernilai)
        var textAlign =
          cell.style.textAlign || cell.getAttribute("align") || "";
        var textValue = (cell.innerText || cell.textContent || "").trim();

        // Deteksi format mata uang Indonesia (menggunakan titik ribuan)
        if (
          textAlign === "right" ||
          /^-?\d+(\.\d{3})*(,\d+)?$/.test(textValue)
        ) {
          var nilaiAngka = textValue.replace(/\./g, "").replace(/,/g, ".");
          var numVal = parseFloat(nilaiAngka);

          if (!isNaN(numVal)) {
            cell.setAttribute("x:num", numVal);
            cell.setAttribute(
              "style",
              "mso-number-format:#\\.##0; text-align:right; color:#000;",
            );
          }
        } else {
          // Jadikan format teks biasa untuk No Perkiraan atau Kode agar nol di depan tidak hilang
          cell.setAttribute(
            "style",
            "mso-number-format:\\@; text-align:left; color:#000;",
          );
        }
      }
    }

    // 6. Proses pembuatan file Excel Blob (.xls)
    var htmlContent = tableClone.outerHTML;
    var blob = new Blob(["\ufeff", htmlContent], {
      type: "application/vnd.ms-excel",
    });
    var url = URL.createObjectURL(blob);

    // Buat link download otomatis
    var a = document.createElement("a");
    a.href = url;

    var fileMasa = masa.replace(/[^a-zA-Z0-9\-]/g, "_");
    a.download =
      "Laporan_Neraca_Detil_" +
      fileMasa +
      "_Group_" +
      activeGroupLabel +
      ".xls";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof toast === "function")
      toast("File Excel detail berhasil diunduh.", "success");
  } catch (err) {
    console.error("Gagal download excel detail:", err);
    if (typeof toast === "function")
      toast("Gagal memproses file Excel.", "err");
  }
}

// =========================================================================
// FUNGSI UTAMA: TAMPILKAN DETIL NERACA (AMBIL DATA PERKIRAAN)
// =========================================================================

async function terapkanOpsiDetilNeraca() {
  var inputmasa = document.getElementById("filter_neraca_masa");
  var selectcabang = document.getElementById("filter_neraca_cabang");

  if (!inputmasa || !selectcabang) {
    console.warn("Elemen filter belum ditemukan.");
    return;
  }

  var valmasa = inputmasa.value; // Format: YYYY-MM
  var valcabang = selectcabang.value;

  if (!valmasa) {
    if (typeof toast === "function")
      toast("Silakan pilih masa/periode terlebih dahulu", "err");
    return;
  }

  closeModal();

  // Parsing Tanggal
  var part = valmasa.split("-");
  var filtertahunfull = part[0];
  var filterbulan = part[1];
  var duadigittahunbelakang = filtertahunfull.substring(2, 4);
  var kodemasadicari = filterbulan + duadigittahunbelakang; // Format: MMYY

  // Nama Store Tabel Perkiraan
  var namaStorePerkiraan = "perkiraan" + filtertahunfull;

  // Update Global Variable
  window._neracaFilterMasa = filterbulan + "-" + filtertahunfull;
  window._neracaFilterCabang = valcabang;

  // Cari Kontainer
  var area = document.getElementById("tempat_tabel_neraca_detil");

  // Tampilkan Loading
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 memuat data perkiraan...</div>';
  }

  try {
    // 1. Ambil Data Perkiraan dari Tabel Backup
    var resPerkiraan = await db.getAll(namaStorePerkiraan);
    var rawDataPerkiraan = resPerkiraan
      ? Array.isArray(resPerkiraan)
        ? resPerkiraan
        : Object.values(resPerkiraan)
      : [];

    // 2. Filter Data Perkiraan
    let detilTerfilter = rawDataPerkiraan
      .filter(function (p) {
        var kodeGol = parseInt(p.gol || p.golongan || 0, 10);
        var cocokGolongan = kodeGol < 300;
        var activeGroup = localStorage.getItem("group") || "TLGA";
        var cocokGroup = String(p.group || "").trim() === activeGroup;

        var cabangData = String(p.cabang || "").trim();
        var masaData = String(p.masa || "").trim();

        var cocokCabang =
          valcabang === "ALL" || valcabang === "" || cabangData === valcabang;
        var cocokMasa = masaData === kodemasadicari;

        var nilaiAwal = parseFloat(p.awal || 0);
        var nilaiDb = parseFloat(p.db || 0);
        var nilaiCr = parseFloat(p.cr || 0);
        var adaNilai = nilaiAwal + nilaiDb + nilaiCr !== 0;

        return (
          cocokGolongan && cocokGroup && cocokMasa && cocokCabang && adaNilai
        );
      })
      .sort(function (a, b) {
        // Urutkan berdasarkan No Perkiraan agar subtotal kelompok 3 digit berurutan rapi
        var perA = String(a.noPerk || "");
        var perB = String(b.noPerk || "");
        return perA.localeCompare(perB, undefined, { numeric: true });
      });

    if (detilTerfilter.length === 0) {
      if (area) {
        area.innerHTML =
          '<div style="padding:3rem; text-align:center; color:var(--muted);">Tidak ada data perkiraan ditemukan.</div>';
      }
      return;
    }

    window._detilNeracaData = detilTerfilter;

    // 3. Render Tabel
    var html = "";
    var subAwal = 0,
      subDb = 0,
      subCr = 0;
    var totalAwal = 0,
      totalDb = 0,
      totalCr = 0;
    var current3DigitPrefix = ""; // Mengganti nama variabel untuk melacak 3 digit kelompok

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
      var noPerk = item.noPerk || "";
      // Mengambil 3 digit pertama dari No Perkiraan sebagai dasar kelompok subtotal
      var item3DigitPrefix = String(noPerk).substring(0, 3);

      var nilaiAwal = parseFloat(item.awal || 0);
      var nilaiDb = parseFloat(item.db || 0);
      var nilaiCr = parseFloat(item.cr || 0);
      var nilaiAkhir = nilaiAwal + nilaiDb - nilaiCr;

      // Cek perpindahan Kelompok 3 Digit untuk cetak Subtotal
      if (
        current3DigitPrefix !== "" &&
        item3DigitPrefix !== current3DigitPrefix
      ) {
        html += '<tr style="font-weight:bold; background:#f9f9f9;">';
        html +=
          '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right;color:blue;">TOTAL KELOMPOK ' +
          current3DigitPrefix +
          "</td>";
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right;color:blue;">' +
          formatUang(subAwal) +
          "</td>";
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right;color:blue;">' +
          formatUang(subDb) +
          "</td>";
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right;color:blue;">' +
          formatUang(subCr) +
          "</td>";
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
          formatUang(subAwal + subDb - subCr) +
          "</td>";
        html += '<td style="padding:2px; border:1px solid #000;"></td></tr>';

        // Reset nilai akumulasi subtotal
        subAwal = 0;
        subDb = 0;
        subCr = 0;
      }

      // Perbarui pelacak prefix dan tambahkan ke subtotal & total
      current3DigitPrefix = item3DigitPrefix;
      subAwal += nilaiAwal;
      subDb += nilaiDb;
      subCr += nilaiCr;

      totalAwal += nilaiAwal;
      totalDb += nilaiDb;
      totalCr += nilaiCr;

      // Render Baris Data Akun
      html += "<tr>";
      html +=
        "<td onclick=\"lihatBukuBesar('" +
        noPerk +
        "', '" +
        kodemasadicari +
        "', '" +
        valcabang +
        "')\" " +
        'style="padding:6px; border:1px solid #000; cursor:pointer; color:green text-decoration:underline; font-weight:bold;">' +
        noPerk +
        "</td>";
      html +=
        '<td style="padding:6px; border:1px solid #000;">' +
        item.desc +
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

    // Cetak Subtotal Terakhir (Kelompok 3 digit paling ujung sebelum Grand Total)
    if (current3DigitPrefix !== "") {
      html += '<tr style="font-weight:bold; background:#f9f9f9;">';
      html +=
        '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right;color:blue;">TOTAL KELOMPOK ' +
        current3DigitPrefix +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right;color:blue;">' +
        formatUang(subAwal) +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right;color:blue;">' +
        formatUang(subDb) +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right;color:blue;">' +
        formatUang(subCr) +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; color:blue;">' +
        formatUang(subAwal + subDb - subCr) +
        "</td>";
      html += '<td style="padding:2px; border:1px solid #000;"></td></tr>';
    }

    // Cetak Grand Total (Opsional, agar laporan neraca lengkap)
    html += '<tr style="font-weight:bold; background:#e6f7ff;">';
    html +=
      '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right;color:red;">GRAND TOTAL AKTIVA</td>';
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right;color:red;">' +
      formatUang(totalAwal) +
      "</td>";
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right;color:red;">' +
      formatUang(totalDb) +
      "</td>";
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right;color:red;">' +
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
        '<div style="padding:3rem; text-align:center; color:red;">Terjadi kesalahan saat memproses data.</div>';
    }
  }
}

function lihatBukuBesar(noPerkiraan, masa, cabang) {
  // Parsing Tahun
  var duadigittahun = masa.substring(2, 4);
  var tahun = "20" + duadigittahun;
  var namaStore = "transaksi" + tahun;

  // ✅ 1. AMBIL LABEL GROUP AKTIF
  var activeGroup = localStorage.getItem("group") || "TLGA";

  var popupId = "popup_bukubesar_" + Date.now();

  // HTML Popup (✅ 2. Tambahkan Keterangan Group di Judul Popup)
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
    '<div style="text-align:center; padding:20px; color:#666;">Memuat transaksi...</div>' +
    "</div>" +
    "</div>";

  document.body.insertAdjacentHTML("beforeend", popupHtml);
  var container = document.getElementById(popupId + "_body");

  // Ambil Data Transaksi
  db.getAll(namaStore)
    .then(function (rawData) {
      var listTrans = Array.isArray(rawData) ? rawData : [];

      // Normalisasi Filter Cabang
      var cabFilter = String(cabang || "")
        .trim()
        .toUpperCase();
      if (cabFilter === "PUSAT") cabFilter = "00";

      // Filter Transaksi
      var detilTrans = listTrans.filter(function (t) {
        var tNo = String(t.noperkiraan || "").trim();
        var tCab = String(t.cabang || "")
          .trim()
          .toUpperCase();
        var tMasa = String(t.masa || "").trim();

        var cocokCabang =
          cabFilter === "ALL" || cabFilter === "" || tCab === cabFilter;

        // ✅ 3. TAMBAHKAN FILTER GROUP DI DATA TRANSAKSI
        var tGroup = String(t.group || "").trim();
        var cocokGroup = tGroup === activeGroup;

        return (
          tNo === noPerkiraan && tMasa === masa && cocokCabang && cocokGroup
        );
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:30px; color:#777;">' +
          "Tidak ada transaksi untuk akun ini.<br><br>" +
          "<small>No. Perkiraan: " +
          noPerkiraan +
          " | Group: " +
          activeGroup +
          " | Masa: " +
          masa +
          " | Cabang: " +
          cabFilter +
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
      var saldoBerjalan = 0;

      detilTrans.forEach(function (t) {
        var tgl = t.tanggal || "-";
        var ref = t.noreff || "-";
        var ket = t.desc || t.keterangan || "-";
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
          // ✅ 4. TAMBAHKAN mso-number-format DI NO REFF AGAR TIDAK KESALAH FORMAT ANGKA
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
        '<td style="padding:8px; text-align:right; color:blue;">' +
        fmtN(totalDb - totalCr) +
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

async function downloadNeracaDetilExcel() {
  var area = document.getElementById("tempat_tabel_neraca_detil");
  var table = area ? area.querySelector("table") : null;

  if (!table) {
    if (typeof toast === "function") toast("Tidak ada data tabel.", "err");
    return;
  }

  try {
    var tableClone = table.cloneNode(true);
    // 2. Hapus Kolom Aksi (Kolom terakhir)
    for (var i = 0; i < tableClone.rows.length; i++) {
      var row = tableClone.rows[i];
      if (row.cells.length > 6) {
        row.deleteCell(-1);
      }
    }
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

    // ✅ PERBAIKAN: TAMBAHKAN NAMA GROUP DI FILENAME EXCEL
    var activeGroupLabel = localStorage.getItem("group") || "TLGA";
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
function renderRLRekap() {
  // A. SIAPKAN NILAI DEFAULT SAAT PERTAMA KALI DIBUKA
  if (typeof window._rlRekapFilterCabang === "undefined") {
    window._rlRekapFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "Pusat";
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

  // B. SIAPKAN OPSI DROPDOWN CABANG
  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = [];

  rawCabang.forEach(function (c) {
    var id = (c.cabang || c.kode || "").trim();
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim();
    if (id) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  if (daftarCabangObj.length === 0) {
    daftarCabangObj.push({ id: "PUSAT", nama: "PUSAT" });
  }

  var kodeDefault = window._rlRekapFilterCabang;
  if (!kodeDefault) kodeDefault = daftarCabangObj[0].id;

  var opsiCabangHtml = daftarCabangObj
    .map(function (item) {
      var sel =
        item.id.toLowerCase() === kodeDefault.toLowerCase() ? "selected" : "";
      return (
        '<option value="' +
        item.id +
        '" ' +
        sel +
        ">" +
        item.nama.toUpperCase() +
        "</option>"
      );
    })
    .join("");

  // ✅ 1. AMBIL LABEL GROUP AKTIF
  var activeGroupLabel = localStorage.getItem("group") || "TLGA";

  // C. RENDER HTML ANTARMUKA KOSONG
  var htmlLaporan =
    '<div id="area_cetak_rlrekap" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    // --- JUDUL ---
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan RL Rekap </h3>' +
    // --- FILTER PANEL ---
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem;">' +
    // ✅ 2. TAMPILKAN GROUP DI JUDUL FILTER
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 GROUP: <span style="color:var(--accent);">' +
    activeGroupLabel +
    "</span> | PILIHAN TAMPILAN:</div>" +
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
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiRLRekap()">' +
    "Terapkan" +
    "</button>" +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadRLRekapExcel()">' +
    '<i class="fa-solid fa-file-excel"></i> Download Excel' +
    "</button>" +
    "</div>" +
    // --- WADAH SCROLL UTAMA ---
    '<div class="table-responsive-container" style="width:100%; max-width:100%; height:380px; max-height:380px; overflow:auto; display:block; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box; margin:0 auto; clear:both;">' +
    "<style>" +
    "#tempat_tabel_rlrekap table { width: 100% !important; min-width: 900px !important; border-collapse: collapse !important; table-layout: auto !important; margin:0 !important; }" +
    "#tempat_tabel_rlrekap th { padding: 8px 12px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; }" +
    "#tempat_tabel_rlrekap td { padding: 8px 12px !important; white-space: nowrap !important; border: 1px solid var(--brd); " +
    "</style>" +
    '<div id="tempat_tabel_rlrekap" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data RL Rekap.</p>' +
    "</div>" +
    "</div>";

  return htmlLaporan;
}

async function terapkanOpsiRLRekap() {
  var inputmasa = document.getElementById("filter_rlrekap_masa");
  var selectcabang = document.getElementById("filter_rlrekap_cabang");

  if (!inputmasa || !selectcabang) return;

  var valmasa = inputmasa.value;
  var valcabang = selectcabang.value;

  if (!valmasa) {
    if (typeof toast === "function")
      toast("Silakan pilih masa terlebih dahulu", "err");
    return;
  }
  closeModal();
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
    // ✅ 3. SIAPKAN FILTER GROUP
    var activeGroup = localStorage.getItem("group") || "TLGA";

    // ✅ 1. AMBIL DATA MASTER GOLONGAN (DIFILTER CABANG & GROUP)
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};

    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namaGol || m.nama || "").trim();
        var cabangMaster = String(m.cabang || "").trim();

        // ✅ 4. FILTER MASTER JUGA BERDASARKAN GROUP
        var groupMaster = String(m.group || "").trim();

        if (kode && cabangMaster === valcabang && groupMaster === activeGroup) {
          mapMasterGol[kode] = nama;
        }
      });
    }

    // ✅ 2. AMBIL DATA BACKUP (UNTUK NILAI DB & CR)
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

        // ✅ 5. FILTER GROUP DI DATA BACKUP
        var cocokGroup = String(g.group || "").trim() === activeGroup;

        return (
          cocokGolongan &&
          cocokGroup &&
          masaData === kodemasadicari &&
          cabangData === valcabang
        );
      })
      .sort(function (a, b) {
        return (
          parseInt(a.gol || a.golongan || 0, 10) -
          parseInt(b.gol || b.golongan || 0, 10)
        );
      });

    // 4. Hitung AKUMULASI SD BULAN LALU secara dinamis dari seluruh data tahun ini
    var mapAkmBulanLalu = {};
    if (parseInt(filterbulan) > 1) {
      var dataSelainBulanIni = rawdatagolongan.filter(function (g) {
        var kodeGolongan = parseInt(g.gol || g.golongan || 0, 10);
        var cocokGolongan = kodeGolongan >= 300 && kodeGolongan < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        var tahunMasa = masaData.substring(2, 6);
        var bulanMasa = masaData.substring(0, 2);

        // ✅ 6. FILTER GROUP DI DATA AKUMULASI LALU
        var cocokGroup = String(g.group || "").trim() === activeGroup;

        return (
          cocokGolongan &&
          cocokGroup &&
          cabangData === valcabang &&
          tahunMasa === duadigittahunbelakang &&
          parseInt(bulanMasa) < parseInt(filterbulan)
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

    // ✅ 5. GABUNGKAN: Backup + Nama dari Master + Akumulasi Bulan Lalu
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

    // ✅ 7. KIRIM activeGroup KE GENERATOR HTML UNTUK DITAMPILKAN DI FOOTER EXCEL
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
  // ✅ AMBIL GROUP UNTUK EXCEL
  var activeGroupLabel = localStorage.getItem("group") || "TLGA";

  var htmlContent = generateHTMLRLRekap(
    window.golterfilterrl,
    window._rlRekapFilterMasa,
    window._rlRekapFilterCabang,
    true,
    activeGroupLabel, // ✅ KIRIM KE GENERATOR
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
  // ✅ TAMBAHKAN GROUP DI NAMA FILE EXCEL
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
function renderRLDetil() {
  if (typeof window._rlDetilFilterCabang === "undefined") {
    window._rlDetilFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "Pusat";
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

  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = [];
  rawCabang.forEach(function (c) {
    var id = (c.cabang || c.kode || "").trim();
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim();
    if (id) daftarCabangObj.push({ id: id, nama: nama });
  });
  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
  if (daftarCabangObj.length === 0)
    daftarCabangObj.push({ id: "PUSAT", nama: "PUSAT" });

  var kodeDefault = window._rlDetilFilterCabang;
  if (!kodeDefault) kodeDefault = daftarCabangObj[0].id;

  var opsiCabangHtml = daftarCabangObj
    .map(function (item) {
      var sel =
        item.id.toLowerCase() === kodeDefault.toLowerCase() ? "selected" : "";
      return (
        '<option value="' +
        item.id +
        '" ' +
        sel +
        ">" +
        item.nama.toUpperCase() +
        "</option>"
      );
    })
    .join("");

  // ✅ 1. AMBIL LABEL GROUP AKTIF
  var activeGroupLabel = localStorage.getItem("group") || "TLGA";

  var htmlLaporan =
    '<div id="area_cetak_rldetil" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan RL Detil (Rugi Laba Rinci)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    // ✅ 2. TAMPILKAN GROUP DI JUDUL FILTER
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 GROUP: <span style="color:var(--accent);">' +
    activeGroupLabel +
    "</span> | PILIHAN TAMPILAN:</div>" +
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

async function terapkanOpsiRLDetil() {
  var inputmasa = document.getElementById("filter_rldetil_masa");
  var selectcabang = document.getElementById("filter_rldetil_cabang");
  if (!inputmasa || !selectcabang) return;

  var valmasa = inputmasa.value;
  var valcabang = selectcabang.value;
  if (!valmasa) {
    if (typeof toast === "function")
      toast("Silakan pilih masa terlebih dahulu", "err");
    return;
  }
  closeModal();
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
    // ✅ 3. SIAPKAN FILTER GROUP
    var activeGroup = localStorage.getItem("group") || "TLGA";

    // 1. AMBIL MASTER
    var rawMasterGol = await db.getAll("perkiraan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.noPerk || m.kode_perkiraan || "").trim();
        var nama = String(m.desc || m.nama || "").trim();
        var cabangMaster = String(m.cabang || "").trim();
        // ✅ 4. FILTER MASTER JUGA BERDASARKAN GROUP
        var groupMaster = String(m.group || "").trim();
        if (kode && cabangMaster === valcabang && groupMaster === activeGroup) {
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
        var kodeGolongan = parseInt(g.noPerk || g.kode_perkiraan || 0, 10);
        var cocokGolongan = kodeGolongan >= 300 && kodeGolongan < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

        // ✅ 5. FILTER GROUP DI DATA BACKUP
        var cocokGroup = String(g.group || "").trim() === activeGroup;

        return (
          cocokGolongan &&
          cocokGroup &&
          masaData === kodemasadicari &&
          cabangData === valcabang
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
    if (parseInt(filterbulan) > 1) {
      var dataSelainBulanIni = rawdatagolongan.filter(function (g) {
        var kodeGolongan = parseInt(g.noPerk || g.kode_perkiraan || 0, 10);
        var cocokGolongan = kodeGolongan >= 300 && kodeGolongan < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        var tahunMasa = masaData.substring(2, 6);
        var bulanMasa = masaData.substring(0, 2);

        // ✅ 6. FILTER GROUP DI DATA AKUMULASI LALU
        var cocokGroup = String(g.group || "").trim() === activeGroup;

        return (
          cocokGolongan &&
          cocokGroup &&
          cabangData === valcabang &&
          tahunMasa === duadigittahunbelakang &&
          parseInt(bulanMasa) < parseInt(filterbulan)
        );
      });
      dataSelainBulanIni.forEach(function (g) {
        var kodeGol = String(g.noPerk || g.kode_perkiraan || "");
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
        var kodeGol = String(item.noPerk || item.kode_perkiraan || "");
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

    // ✅ 7. KIRIM activeGroup KE GENERATOR HTML UNTUK DITAMPILKAN DI FOOTER EXCEL
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
  var activeGroupLabel = localStorage.getItem("group") || "TLGA"; // ✅ AMBIL GROUP UNTUK EXCEL

  var htmlContent = generateHTMLRLDetil(
    window.golterfilterrl,
    window._rlDetilFilterMasa,
    window._rlDetilFilterCabang,
    true,
    activeGroupLabel, // ✅ KIRIM KE GENERATOR
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
    ".xls"; // ✅ TAMBAHKAN GROUP DI NAMA FILE EXCEL
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof toast === "function")
    toast("File Excel RL Detil sedang didownload...", "ok");
}

// ✅ Nama fungsi sudah diperbaiki (tanpa huruf p di belakang)
function generateHTMLRLDetil(
  dataRL,
  kodemasadicari,
  valcabang,
  isForExcel,
  activeGroupLabel,
) {
  var html = "";
  if (!isForExcel) {
    // ✅ TAMPILKAN GROUP DI INFO ATAS TABEL
    html +=
      '<div style="margin-bottom:.7rem; font-size:.78rem; color: var(--muted);">3xx = Penjualan &bull; 4xx = HPP &bull; 5xx = By Adm & Umum &bull; 6xx = Beban Lainnya | <b style="color:var(--accent)">GROUP: ' +
      (activeGroupLabel || "-") +
      "</b></div>";
  }
  html +=
    '<div style="width: 100%; overflow-x: auto; border: 1px solid #ddd;">';
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
    var kodeGol = parseInt(item.noPerk || item.kode_perkiraan || 0, 10);
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
      item.noPerk !== undefined
        ? item.noPerk
        : item.kode_perkiraan !== undefined
          ? item.kode_perkiraan
          : "";

    if (isForExcel) {
      html +=
        '<td style="padding:10px; border:1px solid #000; text-align:center; font-weight:bold;">' +
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
        "')\" style='padding:10px; border:1px solid #000; cursor:pointer; color:yelow; font-weight:bold; text-decoration:underline;'>" +
        golVal +
        "</td>";
    }

    html +=
      '<td style="padding:10px; border:1px solid #000; white-space:nowrap;">' +
      (item.desc || "-") +
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

  // ✅ TAMPILKAN GROUP DI BARIS LABA RUGI BERSIH
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

function renderBukuBesar() {
  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = [];

  rawCabang.forEach(function (c) {
    var id = (c.cabang || c.kode || "").trim();
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim();
    if (id) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  var opsiCabangHtml = '<option value="ALL">SEMUA CABANG</option>';
  daftarCabangObj.forEach(function (item) {
    opsiCabangHtml +=
      '<option value="' +
      item.id +
      '">' +
      item.nama.toUpperCase() +
      "</option>";
  });

  var opts = DBCache.perkiraan
    .map(function (p) {
      return (
        '<option value="' +
        p.id +
        '" data-cabang="' +
        (p.cabang || "") +
        '" data-noperk="' +
        (p.noPerk || "") +
        '">' +
        esc(p.gol) +
        " - " +
        esc(p.noPerk) +
        " - " +
        esc(p.desc) +
        "</option>"
      );
    })
    .join("");

  return (
    '<div class="flt" style="align-items: flex-end;">' +
    '<div class="fg"><label>Cabang</label><select id="bb_cabang" onchange="updatePerkiraanOptions()"><option value="">-- Pilih Cabang --</option>' +
    opsiCabangHtml +
    "</select></div>" +
    '<div class="fg"><label>No Perkiraan <span class="req">*</span></label><select id="bb_perk"><option value="">-- Pilih --</option>' +
    opts +
    "</select></div>" +
    '<div class="fg"><label>Masa Dari (MMYY)</label><input type="text" id="bb_masa_dari" placeholder="0524" maxlength="4" style="text-transform:uppercase; width:100px;"></div>' +
    '<div class="fg"><label>Masa S/D (MMYY)</label><input type="text" id="bb_masa_sampai" placeholder="0824" maxlength="4" style="text-transform:uppercase; width:100px;"></div>' +
    '<div class="fg"><label>&nbsp;</label><button type="button" class="btn btn-g" onclick="refreshBukuBesar()" style="padding:6px 12px;">Terapkan</button></div>' +
    '<div class="fg"><label>&nbsp;</label><button type="button" class="btn btn-b" onclick="downloadBukuBesarExcel()" style="background:#217346; border-color:#217346; padding:6px 12px;"><i class="fa-solid fa-file-excel"></i> Excel</button></div>' +
    "</div>" +
    '<div id="bukuBesarTbl" style="margin-top:1rem;"></div>'
  );
}

window.updatePerkiraanOptions = function () {
  var valcabang = $("bb_cabang").value;
  var selectPerk = $("bb_perk");
  var options = selectPerk.querySelectorAll("option");

  var filteredOptions = [];
  options.forEach(function (opt) {
    if (opt.value === "") return;
    var cabangPerk = opt.getAttribute("data-cabang") || "";
    if (valcabang === "ALL" || cabangPerk === valcabang) {
      filteredOptions.push(opt.cloneNode(true));
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

async function refreshBukuBesar() {
  var cabang = $("bb_cabang").value || "";
  var pid = $("bb_perk").value;
  var masaDari = $("bb_masa_dari").value;
  var masaSampai = $("bb_masa_sampai").value;

  if (!pid) {
    $("bukuBesarTbl").innerHTML =
      '<div class="empty-msg"><i class="fa-solid fa-search"></i>Pilih cabang dan no perkiraan</div>';
    return;
  }

  var pk = await db.get("perkiraan", pid);
  if (!pk) return;

  // ✅ 1. AMBIL GROUP AKTIF
  var activeGroup = localStorage.getItem("group") || "TLGA";

  window._bbCurrentData = {
    cabang: cabang,
    masaDari: masaDari,
    masaSampai: masaSampai,
    perkiraan: pk,
    group: activeGroup, // Simpan group untuk keperluan Excel
  };

  var allTransactions = [];

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

  // HAPUS KODE LOOP LAMA ANDA, GANTI DENGAN INI:

  // ✅ 1. Tampilkan pesan awal (Hanya sekali, biarkan spinner berputar bebas)
  $("bukuBesarTbl").innerHTML =
    '<div class="empty-msg"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i> Mengambil data transaksi multi-tahun...</div>';

  // Beri jeda 50ms biar UI sempat render spinner
  await new Promise((resolve) => setTimeout(resolve, 50));

  // ✅ 2. Kumpulkan semua tahun ke dalam array Promise (Paralel Super Cepat)
  var tahunPromises = [];
  var th = tahunMulai;
  while (th <= tahunAkhir) {
    var namaStore = "transaksi" + th;
    // Kita kumpulkan promise-nya, DILARANG langsung await di sini
    tahunPromises.push(db.getAll(namaStore));
    th++;
  }

  // ✅ 3. Eksekusi semua pengambilan data secara BERSAMAAN (Bebas Freeze)
  try {
    var results = await Promise.all(tahunPromises);

    // ✅ 4. Gabungkan hasilnya setelah semua selesai
    var allTransactions = [];
    results.forEach(function (rawData) {
      var listTh = Array.isArray(rawData) ? rawData : Object.values(rawData);
      allTransactions = allTransactions.concat(listTh);
    });
  } catch (err) {
    console.error("Gagal mengambil data salah satu tahun:", err);
  }

  // ✅ 5. Ubah UI menjadi "Menyusun data..." (Sekali lagi, setelah data lengkap)
  $("bukuBesarTbl").innerHTML =
    '<div class="empty-msg"><i class="fa-solid fa-calculator fa-spin" style="margin-right:8px;"></i> Menyusun ' +
    allTransactions.length +
    " data transaksi...</div>";

  // Beri jeda 50ms lagi biar UI berubah sebelum masuk ke proses sorting/filter berat
  await new Promise((resolve) => setTimeout(resolve, 50));

  // ============================================================
  // KODE FILTER DATA DI BAWAH TETAP PERSIS (TIDAK PERLU DIUBAH)
  // ============================================================
  var data = allTransactions.filter(function (t) {
    // ... kode filter tetap sama di bawah sini ...
    var tNoPerk = String(t.noperkiraan || "").trim();
    var pNoPerk = String(pk.noPerk).trim();

    if (tNoPerk !== pNoPerk) return false;

    if (cabang && cabang !== "ALL" && t.cabang !== cabang) return false;

    var masaData = String(t.masa || "").trim();
    var validMasa = true;

    if (masaDari) {
      if (masaData < masaDari) validMasa = false;
    }

    if (masaSampai) {
      if (masaData > masaSampai) validMasa = false;
    }

    if (!validMasa) return false;

    // ✅ 2. TAMBAHKAN FILTER GROUP
    var cocokGroup = String(t.group || "").trim() === activeGroup;
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

  var sal = num(pk.awal);
  var rows = data.map(function (t) {
    sal += num(t.db) - num(t.cr);
    return [
      formatTglTransaksi(t.tanggal),
      t.noreff || "-",
      t.dariKePada || "-",
      (t.desc || "-").substring(0, 30),
      fmtN(t.db) || "-",
      fmtN(t.cr) || "-",
      '<span class="tag tag-akhir">' + fmtN(sal) + "</span>",
    ];
  });

  rows.unshift([
    "Saldo Awal",
    "",
    "",
    "",
    "",
    "-",
    '<span class="tag tag-awal">' + fmtN(pk.awal) + "</span>",
  ]);

  var tDb = data.reduce(function (s, t) {
    return s + num(t.db);
  }, 0);
  var tCr = data.reduce(function (s, t) {
    return s + num(t.cr);
  }, 0);
  var foot = [
    "",
    "TOTAL",
    "",
    "",
    fmtN(tDb),
    fmtN(tCr),
    '<span class="tag tag-akhir">' + fmtN(num(pk.awal) + tDb - tCr) + "</span>",
  ];

  window._bbExcelReady = {
    rows: rows,
    foot: foot,
    pk: pk,
    cabang: cabang,
    masaDari: masaDari,
    masaSampai: masaSampai,
    tahunMulai: tahunMulai,
    group: activeGroup, // ✅ 3. KIRIM KE EXCEL
  };

  var labelMasa = "";
  if (masaDari && masaSampai) labelMasa = masaDari + " s/d " + masaSampai;
  else if (masaDari) labelMasa = "Dari " + masaDari;
  else if (masaSampai) labelMasa = "S/d " + masaSampai;
  else labelMasa = "Semua (" + tahunMulai + ")";

  // ✅ 4. TAMPILKAN GROUP DI JUDUL TABEL
  $("bukuBesarTbl").innerHTML =
    '<div style="margin-bottom:.5rem; display:flex; justify-content:space-between; align-items:center; font-size:.82rem;font-weight:600">' +
    "<div>" +
    esc(pk.gol) +
    " - " +
    esc(pk.noPerk) +
    " - " +
    esc(pk.desc) +
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
        [
          "Tanggal",
          "No Ref",
          "Dari/Kepada",
          "Keterangan",
          "Debit",
          "Kredit",
          "Saldo",
        ],
        rows,
        {
          numCols: [4, 5, 6],
          foot: foot,
          emptyMsg: "Tidak ada transaksi untuk group ini",
        },
      ),
    );
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

  var html =
    '<table border="1" style="border-collapse:collapse; font-family:Arial, sans-serif;">';

  html +=
    '<tr style="background:#f4f4f4; font-weight:bold; text-align:center;">';
  html += '<td style="padding:8px; border:1px solid #000;">TANGGAL</td>';
  html += '<td style="padding:8px; border:1px solid #000;">NO REFF</td>';
  html += '<td style="padding:8px; border:1px solid #000;">DARI/KEPADA</td>';
  html += '<td style="padding:8px; border:1px solid #000;">KETERANGAN</td>';
  html += '<td style="padding:8px; border:1px solid #000;">DEBET</td>';
  html += '<td style="padding:8px; border:1px solid #000;">KREDIT</td>';
  html += '<td style="padding:8px; border:1px solid #000;">SALDO</td>';
  html += "</tr>";

  rows.forEach(function (row) {
    html += "<tr>";
    var isSaldoAwal = row[0] === "Saldo Awal";

    html +=
      "<td style=\"padding:6px; border:1px solid #000; mso-number-format:'\\@';" +
      (isSaldoAwal ? "font-style:italic;" : "text-align:center;") +
      '">' +
      (isSaldoAwal ? row[0] : formatTglTransaksi(row[0])) +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000;">' +
      (row[1] || "") +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000;">' +
      (row[2] || "") +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000;">' +
      (row[3] || "") +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
      (row[4] || "") +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
      (row[5] || "") +
      "</td>";

    var saldoText = row[6];
    if (typeof saldoText === "string") {
      saldoText = saldoText.replace(/<[^>]*>?/gm, "");
    }

    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right; font-weight:bold;">' +
      saldoText +
      "</td>";
    html += "</tr>";
  });

  html += '<tr style="font-weight:bold; background:#f9f9f9;">';
  html +=
    '<td colspan="4" style="padding:8px; border:1px solid #000; text-align:right;">' +
    (foot[1] || "TOTAL") +
    "</td>";
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    (foot[4] || "") +
    "</td>";
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    (foot[5] || "") +
    "</td>";

  var footSaldoText = String(foot[6] || "").replace(/<[^>]*>?/gm, "");
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    footSaldoText +
    "</td>";
  html += "</tr>";
  html += "</table>";

  var labelMasaExl = "";
  if (r.masaDari && r.masaSampai)
    labelMasaExl = r.masaDari + " s/d " + r.masaSampai;
  else if (r.masaDari) labelMasaExl = "Dari " + r.masaDari;
  else if (r.masaSampai) labelMasaExl = "S/d " + r.masaSampai;
  else labelMasaExl = "Semua (" + r.tahunMulai + ")";

  var infoAkun = "<h3>Buku Besar: " + pk.noPerk + " - " + pk.desc + "</h3>";
  infoAkun +=
    "<p>Cabang: " +
    (cabang === "ALL" ? "Semua" : cabang) +
    " | Periode: " +
    labelMasaExl +
    " | <b>Group: " +
    activeGroup +
    "</b></p>";

  // ✅ PERBAIKAN: Menghapus Backtick (``) dan menggantinya dengan tanda petik ('')
  var fullHtml =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="UTF-8">' +
    "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Buku Besar</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
    "</head>" +
    "<body>" +
    infoAkun +
    html +
    "</body></html>";

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "BukuBesar_" +
    pk.noPerk +
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

function renderRLLebar() {
  if (typeof window._rlLebarFilterCabang === "undefined") {
    window._rlLebarFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "Pusat";
  }

  if (typeof window._rlLebarFilterTahun === "undefined") {
    window._rlLebarFilterTahun = new Date().getFullYear();
  }

  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = [];
  rawCabang.forEach(function (c) {
    var id = (c.cabang || c.kode || "").trim();
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim();
    if (id) daftarCabangObj.push({ id: id, nama: nama });
  });
  daftarCabangObj.sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
  if (daftarCabangObj.length === 0)
    daftarCabangObj.push({ id: "PUSAT", nama: "PUSAT" });

  var kodeDefault = window._rlLebarFilterCabang || daftarCabangObj[0].id;
  var opsiCabangHtml = daftarCabangObj
    .map((item) => {
      var sel =
        item.id.toLowerCase() === kodeDefault.toLowerCase() ? "selected" : "";
      return (
        '<option value="' +
        item.id +
        '" ' +
        sel +
        ">" +
        item.nama.toUpperCase() +
        "</option>"
      );
    })
    .join("");

  var opsiTahunHtml = "";
  for (var y = 2020; y <= 2030; y++) {
    var sel = y == window._rlLebarFilterTahun ? "selected" : "";
    opsiTahunHtml += '<option value="' + y + '" ' + sel + ">" + y + "</option>";
  }

  // ✅ 1. AMBIL LABEL GROUP AKTIF
  var activeGroupLabel = localStorage.getItem("group") || "TLGA";

  var htmlLaporan =
    '<div id="area_cetak_rllebar" style="background:#000; padding:1rem; border-radius:var(--r); border:1px solid #333; height:550px; max-height:550px; width:100%; overflow:hidden;">' +
    '<div style="text-align:center; color:#fff;">' +
    '<h3 style="margin:0 0.8rem 0; color:#fff;">Laporan RL Lebar Bulanan - Tahun ' +
    window._rlLebarFilterTahun +
    "</h3>" +
    '<div class="no-print" style="background:#111; border:1px solid #333; padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:1rem; color:#fff;">' +
    // ✅ 2. TAMPILKAN GROUP DI JUDUL FILTER
    '<div style="font-size:.8rem; font-weight:bold; color:#4da3ff; margin-right:10px;">GROUP: ' +
    activeGroupLabel +
    "</div>" +
    '<label style="font-size:.75rem; color:#ccc;">Tahun:</label>' +
    '<select id="filter_rllebar_tahun" style="padding:4px 8px; border:1px solid #555; background:#000; color:#fff;">' +
    opsiTahunHtml +
    "</select>" +
    '<label style="font-size:.75rem; color:#ccc;">Cabang:</label>' +
    '<select id="filter_rllebar_cabang" style="padding:4px 8px; border:1px solid #555; background:#000; color:#fff; min-width:120px;">' +
    opsiCabangHtml +
    "</select>" +
    '<button class="btn btn-g" style="background:#333; color:#fff; border:1px solid #555;" onclick="terapkanOpsiRLLebar()">Terapkan</button>' +
    '<button class="btn btn-b" style="background:#0a3d0a; color:#fff; border:1px solid #1a5c1a;" onclick="downloadRLLebarExcel()"><i class="fa-solid fa-file-excel"></i> Excel</button>' +
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

async function terapkanOpsiRLLebar() {
  var selectTahun = document.getElementById("filter_rllebar_tahun");
  var selectCabang = document.getElementById("filter_rllebar_cabang");
  if (!selectTahun || !selectCabang) return;

  var valTahun = selectTahun.value;
  var valCabang = selectCabang.value;
  window._rlLebarFilterTahun = valTahun;
  window._rlLebarFilterCabang = valCabang;

  var area = document.getElementById("tempat_tabel_rllebar");
  area.innerHTML =
    '<div style="padding:3rem;text-align:center;"><span class="spinner"></span> Loading 12 bulan...</div>';

  try {
    var namastoregolbackup = "golongan" + valTahun;
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    // ✅ 3. SIAPKAN FILTER GROUP UNTUK DATA 12 BULAN
    var activeGroup = localStorage.getItem("group") || "TLGA";

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

      var dataBulanIni = rawdatagolongan.filter((g) => {
        var kodeGol = parseInt(g.gol || g.golongan || 0, 10);
        var cocokGol = kodeGol >= 300 && kodeGol < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

        // ✅ 4. LOGIKA FILTER GROUP
        var cocokGroup = String(g.group || "").trim() === activeGroup;

        return (
          cocokGol &&
          cocokGroup &&
          masaData === kodeMasa &&
          cabangData === valCabang
        );
      });

      dataBulanIni.forEach((item) => {
        var kodeGol = String(item.gol || item.golongan || "");
        var namaGol = item.namaGol || item.nama_golongan || "";
        var saldoAkhir = Number((item.db || 0) - (item.cr || 0));

        if (!mapGolongan[kodeGol]) {
          mapGolongan[kodeGol] = {
            gol: kodeGol,
            namaGol: namaGol,
            cabang: valCabang,
            bulan: {},
            total: 0,
          };
          for (var b = 1; b <= 12; b++)
            mapGolongan[kodeGol].bulan[("0" + b).slice(-2)] = 0;
        }
        mapGolongan[kodeGol].bulan[blnStr] = saldoAkhir;
        mapGolongan[kodeGol].total += saldoAkhir;
      });
    }

    var listGol = Object.values(mapGolongan)
      .filter((g) => g.total !== 0)
      .sort((a, b) => parseInt(a.gol) - parseInt(b.gol));

    if (listGol.length === 0) {
      area.innerHTML =
        '<div style="padding:3rem;text-align:center;color:#888;">Data kosong untuk Group: ' +
        activeGroup +
        "</div>";
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

    namaBulan.forEach(
      (nb) =>
        (html +=
          '<th style="padding:6px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:center">' +
          nb +
          "</th>"),
    );
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

        for (var b = 1; b <= 12; b++) subTotalPerBulan[("0" + b).slice(-2)] = 0;
      }

      if (currentDigit !== digit) {
        if (digit === "3") buatBarisKeterangan("PENJUALAN");
        if (digit === "4") buatBarisKeterangan("HARGA POKOK PENJUALAN (HPP)");
        if (digit === "5") buatBarisKeterangan("BIAYA ADMINISTRASI & UMUM");
        if (digit === "6") buatBarisKeterangan("BEBAN LAINNYA");
      }

      currentDigit = digit;
      html += "<tr>";
      html += `<td onclick="lihatDetilTransaksiRLLebar('${item.gol}', 'YTD${valTahun}', '${valCabang}')" style="padding:6px;border:1px solid #3e0a93;cursor:pointer;color:#4da3ff;font-weight:bold;text-decoration:underline;">${item.gol}</td>
      <td style="padding:6px;border:1px solid #444;color:#fff;text-align: left;">${item.namaGol}</td>`;

      for (var b = 1; b <= 12; b++) {
        var bs = ("0" + b).slice(-2);
        var rawVal =
          item.bulan && item.bulan[bs] !== undefined ? item.bulan[bs] : 0;
        var val = num(rawVal);

        if (!subTotalPerBulan[bs]) subTotalPerBulan[bs] = 0;
        subTotalPerBulan[bs] += val;

        html += `<td style="padding:6px;border:1px solid #444;text-align:right;color:${val >= 0 ? "#fff" : "#ffc107"}">${val !== 0 ? formatUang(val) : ""}</td>`;
      }

      html += `<td style="padding:6px;border:1px solid #444;text-align:right;font-weight:bold;color:${item.total >= 0 ? "#fff" : "#ff6b6b"}">${formatUang(item.total)}</td>
      <td style="padding:6px;border:1px solid #444;color:#fff;">${item.cabang}</td></tr>`;
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
    area.innerHTML = html;
  } catch (e) {
    console.error(e);
    area.innerHTML =
      '<div style="padding:3rem;text-align:center;color:#ff6b6b;">Error: ' +
      e.message +
      "</div>";
  }
}

function lihatDetilTransaksiRLLebar(noPerkiraan, masa, cabang) {
  var tahunFull = masa.replace("YTD", "");
  var namaStore = "transaksi" + tahunFull;

  // ✅ 5. AMBIL GROUP UNTUK FILTER DETIL TRANSAKSI
  var activeGroup = localStorage.getItem("group") || "TLGA";

  var popupId = "popup_transaksi_" + Date.now();

  var cabFilter = String(cabang || "")
    .trim()
    .toUpperCase();
  if (cabFilter === "PUSAT") {
    cabFilter = "00";
  }

  var popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:50%; max-width:700px; max-height:90vh; background:#000; border:2px solid #4da3ff; box-shadow:0 0 20px rgba(77, 163, 255, 0.5); z-index:10001; display:flex; flex-direction:column; border-radius:8px;">' +
    '<div style="padding:12px; background:#1a1a1a; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; border-radius:8px 8px 0 0;">' +
    '<strong style="font-size:0.9rem; color:#4da3ff;">Detil Transaksi YTD: ' +
    noPerkiraan +
    " | Group: " +
    activeGroup +
    " | Cabang: " +
    cabFilter +
    "</strong>" +
    "<button onclick=\"document.getElementById('" +
    popupId +
    '\').remove()" style="background:none; border:none; font-size:1.5rem; line-height:1; cursor:pointer; color:#fff;">&times;</button>' +
    "</div>" +
    '<div id="' +
    popupId +
    '_body" style="padding:10px; overflow-y:auto; flex:1; font-size:0.8rem; color:#fff;">' +
    '<div style="text-align:center; padding:20px; color:#888;">Loading data transaksi 12 bulan...</div>' +
    "</div></div>";

  document.body.insertAdjacentHTML("beforeend", popupHtml);
  var container = document.getElementById(popupId + "_body");

  db.getAll(namaStore)
    .then(function (rawData) {
      var listTrans = Array.isArray(rawData) ? rawData : [];

      var duaDigitTahun = tahunFull.substring(2, 4);
      var setMasaValid = new Set();
      for (var b = 1; b <= 12; b++) {
        var blnStr = ("0" + b).slice(-2);
        setMasaValid.add(blnStr + duaDigitTahun);
      }

      var prefixNoPerkiraan = String(noPerkiraan || "")
        .trim()
        .substring(0, 3);

      var detilTrans = listTrans.filter(function (t) {
        var tNo = String(t.noperkiraan || "").trim();
        var tCab = String(t.cabang || "")
          .trim()
          .toUpperCase();
        var tMasa = String(t.masa || "").trim();

        var tNoPrefix = tNo.substring(0, 3);
        var cocokPerkiraan = tNoPrefix === prefixNoPerkiraan;
        var cocokMasa = setMasaValid.has(tMasa);

        var cocokCabang = true;
        if (cabFilter !== "ALL" && cabFilter !== "") {
          cocokCabang = tCab === cabFilter;
        }

        // ✅ 6. SISIPKAN FILTER GROUP DI DETIL TRANSAKSI
        var cocokGroup = String(t.group || "").trim() === activeGroup;

        return cocokPerkiraan && cocokMasa && cocokCabang && cocokGroup;
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:20px; color:#ffc107;">' +
          "Data tidak ditemukan.<br><br>" +
          "<small>Dicari No Perkiraan: " +
          prefixNoPerkiraan +
          " | Tahun: " +
          tahunFull +
          " | Group: " +
          activeGroup +
          " | Cabang: " +
          cabFilter +
          "</small>" +
          "</div>";
        return;
      }

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
        var tgl = t.tanggal || "-";
        var ref = t.noreff || "-";
        var ket = t.desc || "-";
        var dbVal = num(t.db || 0);
        var crVal = num(t.cr || 0);

        totalDb += dbVal;
        totalCr += crVal;

        tableHtml +=
          "<tr>" +
          '<td style="border:1px solid #444; padding:4px; text-align:center; color:#4da3ff;">' +
          msa +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          tgl +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          ref +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          ket +
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
      console.error(err);
      container.innerHTML =
        '<div style="text-align:center; padding:20px; color:#ff6b6b;">Error: ' +
        err.message +
        "</div>";
    });
}
