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

// =========================================================================
// FUNGSI RENDER AWAL (UI Only - Tidak Load Data)
// =========================================================================
function renderNeraca() {
  // A. SIAPKAN NILAI DEFAULT SAAT PERTAMA KALI DIBUKA
  if (typeof window._neracaFilterCabang === "undefined") {
    // Cek cabang aktif, jika tidak ada default ke "Pusat"
    window._neracaFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "Pusat";
  }

  if (typeof window._neracaFilterMasa === "undefined") {
    var d = new Date();
    var bln = ("0" + (d.getMonth() + 1)).slice(-2);
    // Format "MM-YYYY"
    window._neracaFilterMasa = bln + "-" + d.getFullYear();
  }

  if (typeof window._neracaModeBackup === "undefined") {
    window._neracaModeBackup = false;
  }

  // Pecah Masa untuk kebutuhan format Input HTML
  // Input: "05-2026" -> Output: "2026-05"
  var partMasa = window._neracaFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];

  // Format input value untuk type="month" (harus YYYY-MM)
  var inputMonthValue = filterTahunFull + "-" + filterBulan;

  // B. SIAPKAN OPSI DROPDOWN CABANG
  // B. SIAPKAN OPSI DROPDOWN CABANG
  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = []; // Menyimpan object {id, nama}

  rawCabang.forEach(function (c) {
    // 1. Cari ID (Kode) - Prioritas kolom 'cabang', jika kosong cek 'kode'
    var id = (c.cabang || c.kode || "").trim();

    // 2. Cari Nama Tampilan - Prioritas kolom 'nama', jika kosong pakai ID saja
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim();

    // 3. Masukkan ke list hanya jika ID-nya ada (supaya tidak kosong)
    if (id) {
      daftarCabangObj.push({
        id: id, // Contoh: "00"
        nama: nama, // Contoh: "TELAGA BEKASI"
      });
    }
  });

  // Sort Cabang berdasarkan ID
  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  // Jika kosong total, isi default "PUSAT"
  if (daftarCabangObj.length === 0) {
    daftarCabangObj.push({ id: "PUSAT", nama: "PUSAT" });
  }

  // Tentukan mana yang selected
  var kodeDefault = window._neracaFilterCabang;
  if (!kodeDefault) kodeDefault = daftarCabangObj[0].id; // Ambil ID pertama sebagai default

  // Buat HTML
  var opsiCabangHtml = daftarCabangObj
    .map(function (item) {
      var sel =
        item.id.toLowerCase() === kodeDefault.toLowerCase() ? "selected" : "";

      // 👉 Value = ID ("00"), Teks = NAMA ("TELAGA BEKASI")
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

  // C. RENDER HTML ANTARMUKA KOSONG (Siap Menunggu Input)
  // Kita tidak render tabel data di sini, hanya filter formnya
  var htmlLaporan =
    // 🌟 1. FRAME UTAMA: Diubah ke display: block dengan batas tinggi tetap dan overflow disembunyikan
    '<div id="area_cetak_neraca" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    // --- JUDUL ---
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan Neraca</h3>' +
    // --- FILTER PANEL ---
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 PILIHAN TAMPILAN:</div>' +
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
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiNeraca()">' +
    "Terapkan" +
    "</button>" +
    // ✅ TAMBAHKAN TOMBOL DOWNLOAD INI
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadNeracaExcel()">' +
    '<i class="fa-solid fa-file-excel"></i> Download Excel' +
    "</button>" +
    "</div>" +
    // 🌟 2. WADAH SCROLL UTAMA: Menggunakan tinggi kalkulasi pasti agar scroll vertikal/horizontal aktif total
    '<div class="table-responsive-container" style="width:100%; max-width:100%; height:380px; max-height:380px; overflow:auto; display:block; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box; margin:0 auto; clear:both;">' +
    "<style>" +
    // min-width 900px memaksa tabel melebar ke samping sehingga scroll horizontal AKTIF
    "#tempat_tabel_preview table { width: 100% !important; min-width: 900px !important; border-collapse: collapse !important; table-layout: auto !important; margin:0 !important; }" +
    // position sticky memaksa judul kolom tetap membeku di atas saat di-scroll ke bawah
    "#tempat_tabel_preview th { padding: 8px 12px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; }" +
    "#tempat_tabel_preview td { padding: 8px 12px !important; white-space: nowrap !important; border: 1px solid var(--brd); }" +
    "</style>" +
    '<div id="tempat_tabel_preview" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data.</p>' +
    "</div>" +
    "</div>";

  return htmlLaporan;
}

// ✅ PERBAIKAN: Mengubah 'sync' menjadi 'async' agar await berfungsi
// =========================================================================
// FUNGSI UTAMA: TAMPILKAN NERACA (Mengambil & Filter Data Golongan)
// =========================================================================
async function terapkanOpsiNeraca() {
  // 1. Ambil input dari user

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
  // 2. Parsing tanggal
  var part = valmasa.split("-");
  var filtertahunfull = part[0];
  var filterbulan = part[1];
  var duadigittahunbelakang = filtertahunfull.substring(2, 4);

  window._neracafiltermasa = filterbulan + "-" + filtertahunfull;
  window._neracafiltercabang = valcabang;
  window._neracamodebackup = true;

  var kodemasadicari = filterbulan + duadigittahunbelakang;
  var namastoregolbackup = "golongan" + filtertahunfull;

  // Cari kontainer penampung
  var area =
    document.getElementById("contentarea") ||
    document.getElementById("tempat_tabel_preview");

  // 🔄 LANGSUNG BERSIHKAN LAYAR SEJAK AWAL (Tampilkan Loading)
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 memuat data golongan...</div>';
  }

  try {
    // 3. Ambil data dari database
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    // ===================================================
    // 4. LOGIKA FILTER DIAGNOSTIK (MEMAKSA DATA TETAP MUNCUL)
    // ===================================================
    window.golterfilter = rawdatagolongan
      .filter(function (g) {
        var kodeGolongan = parseInt(
          g.gol || g.golongan || g.kode_golongan || 0,
          10,
        );
        var cocokGolongan = kodeGolongan < 300;

        // Ambil nilai asli dari objek database untuk kita periksa
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        var cocokCabang =
          valcabang === "ALL" || valcabang === "" || cabangData === valcabang;

        // ✅ AMBIL NILAI DB DAN CR
        var nilaiDb = parseFloat(g.db || g.debit || 0);
        var nilaiCr = parseFloat(g.cr || g.kredit || 0);
        var nilaiAwal = parseFloat(g.awal || 0);
        // ✅ SYARAT BARU: DB dan CR tidak boleh 0 (<> 0)
        var adaNilai = nilaiAwal + nilaiDb + nilaiCr !== 0;

        // 🔍 PRINT DIAGNOSTIK KE CONSOLE (Tekan F12 untuk melihat ini)
        // console.log("=== DIAGNOSTIK DATA ===");
        // console.log(
        //  "Masa di DB:",
        //   "'" + masaData + "'",
        //  "VS Yang Dicari:",
        //  "'" + kodemasadicari + "'",
        // );
        //  console.log(
        //  "Cabang di DB:",
        //  "'" + cabangData + "'",
        //  "VS Yang Dicari:",
        //   "'" + valcabang + "'",
        // );

        // KITA BYPASS DULU: Kembalikan true agar data tidak hilang dari tabel saat ditonton

        return (
          cocokGolongan &&
          masaData === kodemasadicari &&
          cabangData === valcabang &&
          adaNilai // ← Tambahkan syarat ini di sini
        );
      })
      .sort(function (a, b) {
        var golA = parseInt(a.gol || a.golongan || a.kode_golongan || 0, 10);
        var golB = parseInt(b.gol || b.golongan || b.kode_golongan || 0, 10);
        return golA - golB;
      });

    console.log("📊 Jumlah baris yang dipaksa muncul:", golterfilter.length);

    if (golterfilter.length === 0) {
      if (area) {
        area.innerHTML =
          '<div style="padding:3rem; text-align:center; color:var(--muted); font-size: 0.95rem;">🔍 Data benar-benar kosong di database.</div>';
      }
      return;
    }

    // 5. Tentukan kolom manual
    var headers = ["gol", "namaGol", "masa", "akhir", "cabang"];

    // 6. Jalankan Render HTML Judul & Tabel Baru
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

    var labelCabang = String(valcabang).trim().toUpperCase();
    if (labelCabang === "ALL" || !labelCabang) {
      labelCabang = "SEMUA CABANG";
    }
    var subAwal = 0;
    var subDb = 0;
    var subCr = 0;
    var currentGolPrefix = ""; // Untuk mendeteksi perubahan golongan (1 ke 2)

    // Tabel Laporan
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
    golterfilter.forEach(function (item) {
      html += '<tr style="font-size: 0.85rem;">';
      headers.forEach(function (h) {
        var val = "";
        var styleTambahan = "";
        var kodeGol = parseInt(
          item.gol || item.golongan || item.kode_golongan || 0,
          10,
        );
        var itemPrefix = String(kodeGol).charAt(0);

        var nilaiAwal = parseFloat(item.awal || 0);
        var nilaiDb = parseFloat(item.db || item.debit || 0);
        var nilaiCr = parseFloat(item.cr || item.kredit || 0);

        // ✅ CEK PERPINDAHAN GOLONGAN (Dari 1 ke 2)
        if (currentGolPrefix !== "" && itemPrefix !== currentGolPrefix) {
          // Jika berpindah, sisipkan baris Subtotal untuk golongan sebelumnya

          html +=
            '<tr style="font-size:0.85rem; font-weight:bold; background:#ffffff; color:#000000;">';
          html +=
            '<td colspan="3" style="padding:10px; border:1px solid #000; color:#000000;">TOTAL AKTIVA' +
            currentGolPrefix +
            "</td>";
          html +=
            '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap; color:#000000;">' +
            formatUang(subAwal + subDb - subCr) +
            "</td>";

          html += '<td style="padding:2px; border:1px solid #000;"></td>';

          html += "</tr>";

          // Reset subtotal untuk golongan baru
          subAwal = 0;
          subDb = 0;
          subCr = 0;
        }

        // Update prefix golongan saat ini
        currentGolPrefix = itemPrefix;

        // ✅ AKUMULASIKAN KE SUBTOTAL
        subAwal += nilaiAwal;
        subDb += nilaiDb;
        subCr += nilaiCr;

        if (h === "gol") {
          val =
            item.gol !== undefined
              ? item.gol
              : item.golongan !== undefined
                ? item.golongan
                : "";
          // ✅ TAMBAHKAN STYLE LINK DAN EVENT ONCLICK DI SINI
          styleTambahan =
            "cursor: pointer; color: blue; font-weight: bold; text-decoration: underline;";
        } else if (h === "namaGol")
          val = item.namaGol !== undefined ? item.namaGol : "";
        else if (h === "masa") val = item.masa !== undefined ? item.masa : "";
        else if (h === "akhir") {
          val = item.akhir !== undefined ? item.akhir : 0;
          val = formatUang(val);
          styleTambahan =
            "text-align: right; font-weight: bold; white-space: nowrap;";
        } else if (h === "cabang")
          val =
            item.cabang !== undefined
              ? item.cabang
              : item.kode_cabang !== undefined
                ? item.kode_cabang
                : "";

        if (h !== "akhir" && h !== "gol")
          styleTambahan = "white-space: nowrap;";

        // ✅ JIKA KOLOM GOL, TAMBAHKAN ONCLICK
        // ✅ JIKA KOLOM GOL, TAMBAHKAN ONCLICK + KIRIM MASA & CABANG
        if (h === "gol") {
          html +=
            "<td onclick=\"lihatDetilPerkiraan('" +
            val +
            "', '" +
            kodemasadicari + // ← kirim masa (format: "MMYY")
            "', '" +
            valcabang + // ← kirim kode cabang (misal: "01" atau "ALL")
            '\')" style="padding:10px; border:1px solid #000; ' +
            styleTambahan +
            '">' +
            val +
            "</td>";
        } else {
          // Kolom lain biasa
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

    // ✅ SUBTOTAL UNTUK GOLONGAN TERAKHIR (Golongan 2)
    // Karena loop sudah selesai, subtotal golongan 2 belum dicetak, maka cetak sekarang
    if (currentGolPrefix !== "") {
      html +=
        '<tr style="font-size:0.85rem; font-weight:bold; background:#ffffff; color:#000000;">';
      html +=
        '<td colspan="3" style="padding:10px; border:1px solid #000; color:#000000;">TOTAL AKTIVA' +
        currentGolPrefix +
        "</td>";
      html +=
        '<td style="padding:10px; border:1px solid #000; text-align:right; white-space:nowrap; color:#000000;">' +
        formatUang(subAwal + subDb - subCr) +
        "</td>";

      html += '<td style="padding:2px; border:1px solid #000;"></td>';
      html += "</tr>";
    }

    // ✅ TOTAL KESELURUHAN NERACA (Background putih, tulisan hitam pekat)
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

    // Tampilkan tabel baru menggantikan teks loading
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

function lihatDetilTransaksi(noPerkiraan, masa, cabang) {
  // ← TAMBAH PARAMETER cabang

  // 1. Parsing Tahun dari format MMYY (karena dikirim dari lihatDetilPerkiraan sudah bentuk MMYY)
  var duadigittahun = masa.substring(2, 4);
  var tahun = "20" + duadigittahun;
  var namaStore = "transaksi" + tahun;

  var popupId = "popup_transaksi_" + Date.now();

  // ✅ CEK NILAI TERIMA
  console.log("📥 [TERIMA] Masa:", masa, "| Cabang:", cabang);

  var popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:45%; max-width:650px; max-height:90vh; background:white; border:1px solid #aaa; box-shadow:0 5px 15px rgba(0,0,0,0.5); z-index:10001; display:flex; flex-direction:column; border-radius:6px;">' +
    '<div style="padding:10px; background:#f0f0f0; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center; border-radius:6px 6px 0 0;">' +
    '<strong style="font-size:0.9rem; color:#333;">Detil Transaksi: ' +
    noPerkiraan +
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

      // Masa sudah dalam format MMYY, jadi langsung gunakan
      var masaCari = masa;
      console.log("🔢 [HASIL] Masa Dicari di DB:", masaCari);

      // ✅ GUNAKAN PARAMETER CABANG YANG DITERIMA DARI ONCLICK
      var cabInput = String(cabang || "")
        .trim()
        .toUpperCase();

      // ✅ PERBAIKAN LOGIKA MAPPING CABANG
      var cabFilter = cabInput;
      if (cabInput === "PUSAT") {
        cabFilter = "00"; // Jika user pilih PUSAT, cari kode 00
      }

      console.log(
        "🔍 Mencori Cabang Input:",
        cabInput,
        "-> Dikonversi ke Kode DB:",
        cabFilter,
      );

      // Filter Data
      var detilTrans = listTrans.filter(function (t) {
        var tNo = String(t.noperkiraan || "").trim();
        var tCab = String(t.cabang || "")
          .trim()
          .toUpperCase(); // Pastikan uppercase
        var tMasa = String(t.masa || "").trim();

        // ✅ LOGIKA CABANG: Jika "ALL", abaikan filter cabang. Jika spesifik, harus cocok.
        var cocokCabang = true;
        if (cabFilter !== "ALL" && cabFilter !== "") {
          cocokCabang = tCab === cabFilter;
        }

        return tNo === noPerkiraan && tMasa === masaCari && cocokCabang;
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:20px; color:orange;">' +
          "Data tidak ditemukan.<br><br>" +
          "<small>Dicari No Perkiraan: " +
          noPerkiraan +
          " | Masa: " +
          masaCari +
          " | Cabang Kode: " +
          cabFilter +
          "</small>" +
          "</div>";
        return;
      }

      // Render Tabel
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

      // ✅ TAMBAHAN: Baris Total di bawah tabel
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
  // 1. Pastikan data mentah ada
  if (!window.golterfilter || window.golterfilter.length === 0) {
    if (typeof toast === "function") toast("Tidak ada data tabel.", "err");
    return;
  }

  // 2. Ambil elemen tabel yang tampil di layar
  var area = document.getElementById("tempat_tabel_preview");
  var table = area ? area.querySelector("table") : null;

  if (!table) {
    if (typeof toast === "function") toast("Belum ada data tabel.", "err");
    return;
  }

  try {
    // 3. Clone tabel agar tampilan web tidak berubah
    var tableClone = table.cloneNode(true);

    // 4. Loop semua baris untuk memformat sel
    for (var i = 0; i < tableClone.rows.length; i++) {
      var row = tableClone.rows[i];

      // Hapus event handler onclick jika ada (agar bersih di Excel)
      for (var j = 0; j < row.cells.length; j++) {
        row.cells[j].removeAttribute("onclick");
      }

      // Cek Jumlah Kolom: [0]GOL, [1]NAMA, [2]MASA, [3]SALDO, [4]CABANG
      if (row.cells.length >= 5) {
        // --- PROSES KOLOM MASA (Index 2) ---
        var cellMasa = row.cells[2];
        var textMasa = cellMasa.innerText || cellMasa.textContent;
        cellMasa.innerHTML = '<span style="color:white;">\'</span>' + textMasa;
        cellMasa.setAttribute(
          "style",
          "mso-number-format:\\@; " + (cellMasa.getAttribute("style") || ""),
        );

        // --- PROSES KOLOM CABANG (Index 4) ---
        var cellCabang = row.cells[4];
        var textCabang = cellCabang.innerText || cellCabang.textContent;
        cellCabang.innerHTML =
          '<span style="color:white;">\'</span>' + textCabang;
        cellCabang.setAttribute(
          "style",
          "mso-number-format:\\@; " + (cellCabang.getAttribute("style") || ""),
        );

        // --- PROSES KOLOM ANGKA (SALDO AKHIR - Index 3) ---
        var cellSaldo = row.cells[3];
        var textSaldo = cellSaldo.innerText || cellSaldo.textContent;
        // Bersihkan format mata uang (titik ribuan)
        var nilaiAngka = textSaldo.replace(/\./g, "").replace(/,/g, ".");
        var numVal = parseFloat(nilaiAngka);

        if (!isNaN(numVal)) {
          // Set atribut x:num agar Excel tahu ini angka
          cellSaldo.setAttribute("x:num", numVal);
          // ✅ PERBAIKAN DI SINI: Menambahkan tanda kurung ( ) setelah setAttribute
          cellSaldo.setAttribute(
            "style",
            "mso-number-format:#\.##0; text-align:right; " +
              (cellSaldo.getAttribute("style") || ""),
          );
        }
      }
    }

    // 5. Proses Download
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
    a.download = "Laporan_Neraca_" + masa + ".xls";

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
  // ← tambah parameter masa & cabang

  // 1. Ambil Tahun dari parameter masa yang dikirim
  var duadigittahun = masa.substring(2, 4);
  var tahunAktif = "20" + duadigittahun;
  var namaStoreBackup = "perkiraan" + tahunAktif;
  var kodeMasa = masa;

  // 2. Tampilkan Loading
  openModal(
    "Detil Perkiraan: " + kodeGol,
    '<div style="text-align:center; padding:2rem;"><span class="spinner"></span><br>Memuat data...</div>',
    "",
  );

  try {
    // 3. Ambil Data
    var rawData = await db.getAll(namaStoreBackup);
    var listPerkiraan = Array.isArray(rawData) ? rawData : [];

    // 4. Filter Data (Golongan + Masa + Cabang)
    var detilFilter = listPerkiraan.filter(function (p) {
      var noPerk = String(p.noPerk || p.noperkiraan || "").trim();
      var prefixGol = noPerk.substring(0, 3);

      var masaData = String(p.masa || p.periode || p.kode_masa || "").trim();
      var cabangData = String(p.cabang || p.cab || p.kode_cabang || "").trim();

      // ✅ Filter berdasarkan Golongan DAN Masa
      var cocokGolMasa =
        prefixGol === String(kodeGol).trim() && masaData === masa;

      // ✅ Jika user memilih "ALL" / kosong di filter utama, tampilkan semua cabang
      //    Jika memilih cabang tertentu (misal "01"), filter cabangnya
      var cocokCabang = true;
      var cabangUpper = String(cabang).trim().toUpperCase();
      if (cabangUpper !== "ALL" && cabangUpper !== "") {
        cocokCabang = cabangData === String(cabang).trim();
      }

      return cocokGolMasa && cocokCabang;
    });

    // ... Sisanya tetap sama (kode render tabel HTML) ...
    // 5. Render Tabel jika ada data
    if (detilFilter.length === 0) {
      $("modalBody").innerHTML =
        '<div style="text-align:center; padding:1rem; color:var(--muted);">Tidak ada data perkiraan untuk Golongan ' +
        kodeGol +
        " di tahun " +
        tahunAktif +
        ".</div>";

      // Atur posisi tetap meski kosong
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

    // Bangun HTML Tabel
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
        // ✅ TOMBOL KLIK PADA NOMOR PERKIRAAN + KIRIM MASA & CABANG
        "<td onclick=\"lihatDetilTransaksi('" +
        no +
        "', '" +
        kodeMasa +
        "', '" +
        cabang + // ← tambahkan parameter cabang di sini
        "')\" " +
        'style="border:1px solid #ccc; padding:6px; cursor:pointer; color:blue; font-weight:bold; text-decoration:underline;">' +
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

    // Tampilkan ke Modal Body
    $("modalBody").innerHTML = htmlTable;

    // Footer Tombol Tutup
    $("modalFoot").innerHTML =
      '<button class="btn btn-g" onclick="closeModal()">Tutup</button>';

    // ✅ 6. ATUR POSISI POPUP (KIRI ATAS)
    // ✅ 6. ATUR POSISI POPUP (KIRI ATAS)
    setTimeout(function () {
      var modalEl =
        document.querySelector(".modal") || document.getElementById("modal");
      if (modalEl) {
        modalEl.style.position = "fixed";

        // 1. POSISI KE KIRI
        modalEl.style.top = "20px";
        modalEl.style.left = "20px"; // Menempel 20px dari kiri
        modalEl.style.right = "auto"; // ← PENTING: Reset right agar tidak konflik
        modalEl.style.margin = "0"; // ← PENTING: Hapus margin auto dari CSS bawaan
        modalEl.style.transform = "none"; // ← PENTING: Matikan transformasi tengah

        // 2. Atur ukuran agar tidak terlalu lebar
        modalEl.style.maxWidth = "45%";
        modalEl.style.width = "600px";

        modalEl.style.zIndex = "10000"; // Pastikan di atas elemen lain
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
// Fungsi Global untuk Download Excel

/* ---------- Detil Neraca ---------- */
PANEL_MAP.detilNeraca = renderDetilNeraca;

// =========================================================================
// FUNGSI RENDER DETIL NERACA (SUMBER DATA: PERKIRAAN BACKUP)
// =========================================================================
async function renderDetilNeraca() {
  // 1. SIAPKAN NILAI DEFAULT SAAT PERTAMA KALI DIBUKA
  if (typeof window._neracaFilterCabang === "undefined") {
    window._neracaFilterCabang =
      typeof currentCabang !== "undefined" &&
      currentCabang !== "SEMUA" &&
      currentCabang !== ""
        ? currentCabang
        : "Pusat";
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

  // 2. SIAPKAN OPSI DROPDOWN CABANG
  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = [];

  rawCabang.forEach(function (c) {
    var id = (c.cabang || c.kode || "").trim();
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim();
    if (id) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });

  // Sort Cabang
  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  if (daftarCabangObj.length === 0) {
    daftarCabangObj.push({ id: "PUSAT", nama: "PUSAT" });
  }

  var kodeDefault = window._neracaFilterCabang;
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

  // 3. RENDER HTML ANTARMUKA (FILTER & WADAH TABEL)
  var htmlLaporan =
    '<div id="area_cetak_neraca" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan Neraca (Detil Perkiraan)</h3>' +
    // --- FILTER PANEL ---
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:1rem;">' +
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 PILIHAN TAMPILAN:</div>' +
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
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiDetilNeraca()">' +
    "Tampilkan Data" +
    "</button>" +
    // ✅ TAMBAHKAN TOMBOL DOWNLOAD INI
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadNeracaDetilExcel()">' +
    '<i class="fa-solid fa-file-excel"></i> Download Excel' +
    "</button>" +
    "</div>" +
    // --- WADAH SCROLL TABEL ---
    '<div class="table-responsive-container" style="width:100%; height:380px; max-height:380px; overflow:auto; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box;">' +
    "<style>" +
    "#tempat_tabel_neraca_detil table { width: 100% !important; min-width: 1000px !important; border-collapse: collapse !important; table-layout: auto !important; }" +
    "#tempat_tabel_neraca_detil th { padding: 8px 10px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; text-align:left; }" +
    "#tempat_tabel_neraca_detil td { padding: 6px 10px !important; border: 1px solid var(--brd); font-size:0.85rem; }" +
    "</style>" +
    '<div id="tempat_tabel_neraca_detil" style="width:100%; display:block; text-align:left;"></div>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem;">Klik tombol Tampilkan Data untuk memuat detail perkiraan.</p>' +
    "</div>" +
    "</div>";

  return htmlLaporan;
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

        var cabangData = String(p.cabang || "").trim();
        var masaData = String(p.masa || "").trim();

        var cocokCabang =
          valcabang === "ALL" || valcabang === "" || cabangData === valcabang;
        var cocokMasa = masaData === kodemasadicari;

        var nilaiAwal = parseFloat(p.awal || 0);
        var nilaiDb = parseFloat(p.db || 0);
        var nilaiCr = parseFloat(p.cr || 0);
        var adaNilai = nilaiAwal + nilaiDb + nilaiCr !== 0;

        return cocokGolongan && cocokMasa && cocokCabang && adaNilai;
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
        'style="padding:6px; border:1px solid #000; cursor:pointer; color:blue; text-decoration:underline; font-weight:bold;">' +
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

// =========================================================================
// FUNGSI LIHAT BUKU BESAR (MODIFIKASI DARI lihatDetilTransaksi)
// Menerima: noPerkiraan, masa (format MMYY), cabang
// =========================================================================
function lihatBukuBesar(noPerkiraan, masa, cabang) {
  // Parsing Tahun
  var duadigittahun = masa.substring(2, 4);
  var tahun = "20" + duadigittahun;
  var namaStore = "transaksi" + tahun;

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
    '<span style="font-size:0.75rem; opacity:0.8;">Cabang: ' +
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

        return tNo === noPerkiraan && tMasa === masa && cocokCabang;
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:30px; color:#777;">' +
          "Tidak ada transaksi untuk akun ini.<br><br>" +
          "<small>No. Perkiraan: " +
          noPerkiraan +
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
          '<td style="padding:6px; border-bottom:1px solid #eee;color: #000;">' +
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
    // Kita loop semua baris (termasuk header) dan hapus cell di index terakhir
    for (var i = 0; i < tableClone.rows.length; i++) {
      var row = tableClone.rows[i];
      // Cek apakah baris ini memiliki cukup kolom (index 6 adalah kolom Aksi)
      if (row.cells.length > 6) {
        row.deleteCell(-1); // -1 artinya hapus sel paling belakang
      }
    }
    for (var i = 1; i < tableClone.rows.length; i++) {
      var row = tableClone.rows[i];
      if (row.cells.length > 0) {
        var cellNoPerk = row.cells[0];
        var textPerk = cellNoPerk.innerText || cellNoPerk.textContent;

        // --- MODIFIKASI: Tambah Petik Satu di Depan ---
        // Kita bungkus petik satu dalam span berwarna putih agar di layar Excel terlihat hilang,
        // tapi Excel tetap membacanya sebagai force text.
        var textPerkExcel = '<span style="color:white;">\'</span>' + textPerk;

        cellNoPerk.innerHTML = textPerkExcel;
        cellNoPerk.setAttribute(
          "style",
          "mso-number-format:\\@; " + (cellNoPerk.getAttribute("style") || ""),
        );
      }
    }

    // Format Header
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
    a.download = "Neraca_Detil_" + masa + ".xls";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  // C. RENDER HTML ANTARMUKA KOSONG
  var htmlLaporan =
    '<div id="area_cetak_rlrekap" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    // --- JUDUL ---
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan RL Rekap (Pendapatan & Beban)</h3>' +
    // --- FILTER PANEL ---
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 PILIHAN TAMPILAN:</div>' +
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
    // ✅ TAMBAHKAN TOMBOL DOWNLOAD EXCEL
    // '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadRLDetilExcel()">' +
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
    // ✅ 1. AMBIL DATA MASTER GOLONGAN (UNTUK NAMA)
    // ✅ 1. AMBIL DATA MASTER GOLONGAN (DIFILTER CABANG)
    // Gunakan nama store master yang benar (kemungkinan besar "golongan" tanpa tahun)
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};

    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namaGol || m.nama || "").trim();

        // ✅ Ambil kode cabang dari datanya
        var cabangMaster = String(m.cabang || "").trim();

        // ✅ FILTER: Hanya masukkan ke dictionary jika cabangnya cocok dengan yang dipilih user
        if (kode && cabangMaster === valcabang) {
          mapMasterGol[kode] = nama;
        }
      });
    }
    console.table(mapMasterGol);
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

        var saldoAkhir = +(g.db || 0) - +(g.cr || 0);

        return (
          cocokGolongan &&
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

        return (
          cocokGolongan &&
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
          '<div style="padding:3rem; text-align:center; color:var(--muted);">🔍 Data RL Rekap kosong / tidak ada saldo.</div>';
      return;
    }

    // ✅ 5. GABUNGKAN: Backup + Nama dari Master + Akumulasi Bulan Lalu
    var finalData = golBulanIni
      .map(function (item) {
        var kodeGol = String(item.gol || item.golongan || "");
        var akmLalu = mapAkmBulanLalu[kodeGol] || 0;

        // Hitung saldo bulan ini
        var bulanIni = +(item.db || 0) - +(item.cr || 0);

        // Hitung Saldo Total
        var saldoTotal = bulanIni + akmLalu;

        return {
          ...item,
          namaGol: mapMasterGol[kodeGol] || item.namaGol || "-",
          akmBulanLalu: akmLalu,
          // Simpan sementara untuk di-filter
          _saldoTotal: saldoTotal,
        };
      })
      // ✅ FILTER DI SINI: Buang baris jika Total Saldo Akhirnya NOL
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

    html += generateHTMLRLRekap(finalData, kodemasadicari, valcabang, false);
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
  var htmlContent = generateHTMLRLRekap(
    window.golterfilterrl,
    window._rlRekapFilterMasa,
    window._rlRekapFilterCabang,
    true,
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
    "Laporan_RL_Rekap_" + (window._rlRekapFilterMasa || "Export") + ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof toast === "function")
    toast("File Excel RL Rekap sedang didownload...", "ok");
}

// ✅ FUNGSI GENERATOR HTML YANG SUDAH DIPERBAIKI (DIGABUNGKAN UNTUK WEB & EXCEL)
// ✅ FUNGSI GENERATOR HTML YANG SUDAH DIPERBAIKI SEPENUHNYA
function generateHTMLRLRekap(dataRL, kodemasadicari, valcabang, isForExcel) {
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
        '<td style="padding:10px; border:1px solid #000; text-align:center; font-weight:bold;">' +
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
        "')\" style='padding:10px; border:1px solid #000; cursor:pointer; color:blue; font-weight:bold; text-decoration:underline;'>" +
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

  html += "</tbody></table></div>";
  return html;
}
/* ---------- RL Detil ---------- */
PANEL_MAP.rlDetil = renderRLDetil;

// =========================================================================
// 1. FUNGSI RENDER ANTARMUKA RL DETIL (KOSONG)
// =========================================================================
function renderRLDetil() {
  // A. SIAPKAN NILAI DEFAULT
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

  // B. SIAPKAN OPSI DROPDOWN CABANG (Sama seperti RL Rekap)
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

  // C. RENDER HTML
  var htmlLaporan =
    '<div id="area_cetak_rldetil" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan RL Detil (Neraca - Aset & Kewajiban)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 PILIHAN TAMPILAN:</div>' +
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
  var namastoregolbackup = "perkiraan" + filtertahunfull; // Store nilai backup

  var area = document.getElementById("tempat_tabel_rldetil");
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 Memuat data master perkiraan & menghitung akumulasi...</div>';
  }

  try {
    // ✅ 1. AMBIL DATA MASTER PERKIRAAN (UNTUK NAMA)
    // Sesuaikan "perkiraan_master" dengan nama asli store master di DB Anda
    // ✅ 1. AMBIL DATA MASTER PERKIRAAN (DIFILTER CABANG)
    var rawMasterPerk = await db.getAll("perkiraan"); // Sesuaikan nama store master-nya
    var mapMasterPerk = {};
    console.log("Jumlah total data mentah perkiraan:", rawmasterkiraan.length);
    if (rawMasterPerk) {
      var arrMasterPerk = Array.isArray(rawMasterPerk)
        ? rawMasterPerk
        : Object.values(rawMasterPerk);
      arrMasterPerk.forEach(function (m) {
        var kode = String(m.perkiraan || m.kode_perkiraan || "").trim();
        var nama = String(m.namaPerkiraan || m.nama || "").trim();

        // ✅ Ambil kode cabang dari datanya
        var cabangMaster = String(m.cabang || "").trim();

        // ✅ FILTER: Hanya masukkan ke dictionary jika cabangnya cocok
        if (kode && cabangMaster === valcabang) {
          mapMasterPerk[kode] = nama;
        }
      });
    }
    // ✅ 2. AMBIL DATA BACKUP PERKIRAAN (UNTUK NILAI DB & CR)
    var resgolbackup = await db.getAll(namastoregolbackup);

    var rawdataperkiraan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    // 3. Filter data HANYA untuk bulan yang dipilih
    var perkBulanIni = rawdataperkiraan
      .filter(function (g) {
        var kodePerkiraan = parseInt(
          g.perkiraan || g.kode_perkiraan || g.kode || 0,
          10,
        );
        var cocokPerkiraan = kodePerkiraan > 0 && kodePerkiraan < 300; // Hanya dibawah 300
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

        var saldoAkhir = +(g.db || 0) - +(g.cr || 0);

        return (
          cocokPerkiraan &&
          masaData === kodemasadicari &&
          cabangData === valcabang
        );
      })
      .sort(function (a, b) {
        return (
          parseInt(a.perkiraan || a.kode_perkiraan || 0, 10) -
          parseInt(b.perkiraan || b.kode_perkiraan || 0, 10)
        );
      });
    console.log("Jumlah total data mentah perkiraan:", perkbulanini.length);

    // 4. Hitung AKUMULASI SD BULAN LALU
    var mapAkmBulanLalu = {};
    if (parseInt(filterbulan) > 1) {
      var dataSelainBulanIni = rawdataperkiraan.filter(function (g) {
        var kodePerkiraan = parseInt(g.perkiraan || g.kode_perkiraan || 0, 10);
        var cocokPerkiraan = kodePerkiraan > 0 && kodePerkiraan < 300;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        var tahunMasa = masaData.substring(2, 6);
        var bulanMasa = masaData.substring(0, 2);

        return (
          cocokPerkiraan &&
          cabangData === valcabang &&
          tahunMasa === duadigittahunbelakang &&
          parseInt(bulanMasa) < parseInt(filterbulan)
        );
      });

      dataSelainBulanIni.forEach(function (g) {
        var kodePerk = String(g.perkiraan || g.kode_perkiraan || "");
        var saldo = +(g.db || 0) - +(g.cr || 0);
        if (!mapAkmBulanLalu[kodePerk]) mapAkmBulanLalu[kodePerk] = 0;
        mapAkmBulanLalu[kodePerk] += saldo;
      });
    }

    if (perkBulanIni.length === 0) {
      if (area)
        area.innerHTML =
          '<div style="padding:3rem; text-align:center; color:var(--muted);">🔍 Data RL Detil kosong / tidak ada saldo.</div>';
      return;
    }

    // ✅ 5. GABUNGKAN: Data Backup + Nama dari Master + Akumulasi Bulan Lalu
    var finalData = perkBulanIni
      .map(function (item) {
        // ⬇️ BEDANYA DI SINI: pakai "perkiraan" atau "kode_perkiraan"
        var kodePerk = String(
          item.perkiraan || item.kode_perkiraan || item.kode || "",
        );
        var akmLalu = mapAkmBulanLalu[kodePerk] || 0;

        // Hitung saldo bulan ini
        var bulanIni = +(item.db || 0) - +(item.cr || 0);

        // Hitung Saldo Total
        var saldoTotal = bulanIni + akmLalu;

        return {
          ...item,
          // ⬇️ BEDANYA DI SINI: pakai "mapMasterPerk" dan "namaPerkiraan"
          namaPerkiraan:
            mapMasterPerk[kodePerk] || item.namaPerkiraan || item.nama || "-",
          akmBulanLalu: akmLalu,
          // Simpan sementara untuk di-filter
          _saldoTotal: saldoTotal,
        };
      })
      // ✅ FILTER DI SINI: Buang baris jika Total Saldo Akhirnya NOL
      .filter(function (item) {
        return item._saldoTotal !== 0;
      });

    window.perkterfilterrl = finalData;

    window.perkterfilterrl = finalData; // Disimpan global untuk keperluan Excel

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

    html += generateHTMLRLDetil(finalData, kodemasadicari, valcabang, false);
    area.innerHTML = html;
  } catch (error) {
    console.error("❌ Gagal total RL Detil:", error);
    if (area)
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}
async function downloadRLDetilExcel() {
  if (!window.perkterfilterrl || window.perkterfilterrl.length === 0) {
    if (typeof toast === "function")
      toast("Tidak ada data RL Detil untuk didownload", "err");
    return;
  }
  var htmlContent = generateHTMLRLDetil(
    window.perkterfilterrl,
    window._rlDetilFilterMasa,
    window._rlDetilFilterCabang,
    true,
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
    "Laporan_RL_Detil_" + (window._rlDetilFilterMasa || "Export") + ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof toast === "function")
    toast("File Excel RL Detil sedang didownload...", "ok");
}
function generateHTMLRLDetil(dataRL, kodemasadicari, valcabang, isForExcel) {
  var html = "";
  if (!isForExcel) {
    html +=
      '<div style="margin-bottom:.7rem; font-size:.78rem; color: var(--muted);">1xx = Aset / Harta &bull; 2xx = Kewajiban / Hutang</div>';
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
    // ✅ AMBIL NAMA FIELD PERKIRAAN
    var kodePerk = parseInt(
      item.perkiraan || item.kode_perkiraan || item.kode || 0,
      10,
    );
    var itemDigit = String(kodePerk).charAt(0);

    var valBulanIni = num(item.db || 0) - num(item.cr || 0);
    var valAkmLalu = num(item.akmBulanLalu || 0);
    var valAkhir = valBulanIni + valAkmLalu;

    if (currentDigit !== null && itemDigit !== currentDigit) {
      subtotals[currentDigit] = {
        bulanIni: sumBulanIni,
        akmLalu: sumAkmLalu,
        akhir: sumAkhir,
      };

      var ketSubtotal = "SUBTOTAL PERKIRAAN " + currentDigit + "xx";
      if (currentDigit === "1") ketSubtotal = "TOTAL ASET (HARTA)";
      if (currentDigit === "2") ketSubtotal = "TOTAL KEWAJIBAN (HUTANG)";

      buatBarisSubtotal(
        ketSubtotal,
        sumBulanIni,
        sumAkmLalu,
        sumAkhir,
        "#fff3cd",
        false,
      );
      html +=
        "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";

      sumBulanIni = 0;
      sumAkmLalu = 0;
      sumAkhir = 0;
    }

    if (currentDigit !== itemDigit) {
      if (itemDigit === "1") buatBarisKeterangan("ASET / HARTA");
      if (itemDigit === "2") buatBarisKeterangan("KEWAJIBAN / HUTANG");
    }

    currentDigit = itemDigit;
    sumBulanIni += valBulanIni;
    sumAkmLalu += valAkmLalu;
    sumAkhir += valAkhir;

    html += '<tr style="font-size: 0.85rem;">';
    var perkVal =
      item.perkiraan !== undefined
        ? item.perkiraan
        : item.kode_perkiraan !== undefined
          ? item.kode_perkiraan
          : item.kode;

    // ✅ TIDAK ADA ONCLICK KARENA INI DETIL TERENDAH
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:center; font-weight:bold;">' +
      perkVal +
      "</td>";

    // ✅ AMBIL NAMA PERKIRAAN
    html +=
      '<td style="padding:10px; border:1px solid #000; white-space:nowrap;">' +
      (item.namaPerkiraan || item.nama || "") +
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
    var ketAkhir = "SUBTOTAL PERKIRAAN " + currentDigit + "xx";
    if (currentDigit === "1") ketAkhir = "TOTAL ASET (HARTA)";
    if (currentDigit === "2") ketAkhir = "TOTAL KEWAJIBAN (HUTANG)";

    buatBarisSubtotal(
      ketAkhir,
      sumBulanIni,
      sumAkmLalu,
      sumAkhir,
      "#fff3cd",
      false,
    );
    html +=
      "<tr><td colspan='7' style='border:1px solid #000; padding:4px; background-color:#fff;'></td></tr>";
  }

  // ✅ SELISIH NERACA (ASET - KEWAJIBAN)
  var d1 = getSub("1"),
    d2 = getSub("2");
  var selisihBulanIni = d1.bulanIni - d2.bulanIni;
  var selisihAkmLalu = d1.akmLalu - d2.akmLalu;
  var selisihAkhir = d1.akhir - d2.akhir;

  html +=
    "<tr><td colspan='7' style='border:1px solid #000; padding:6px; background-color:#fff;'></td></tr>";
  buatBarisSubtotal(
    "SELISIH NERACA (ASET - KEWAJIBAN)",
    selisihBulanIni,
    selisihAkmLalu,
    selisihAkhir,
    "#d1e7dd",
    true,
  );

  html += "</tbody></table></div>";
  return html;
}
/* ---------- Buku Besar ---------- */
PANEL_MAP.bukuBesar = renderBukuBesar;
AFTER_RENDER.bukuBesar = refreshBukuBesar;
function renderBukuBesar() {
  // 1. SIAPKAN OPSI DROPDOWN CABANG
  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = [];

  rawCabang.forEach(function (c) {
    var id = (c.cabang || c.kode || "").trim(); // Kode Cabang (untuk Value)
    var nama = (c.nama || c.cabang || "Tanpa Nama").trim(); // Nama Cabang (untuk Tampilan)
    if (id) {
      daftarCabangObj.push({
        id: id, // Ini yang jadi Value
        nama: nama, // Ini yang jadi Teks Tampilan
      });
    }
  });

  // ✅ URUTKAN BERDASARKAN KODE CABANG (Numeric: 00, 01, 02, 10)
  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  // ✅ TAMPILKAN NAMA, VALUE ADALAH KODE
  var opsiCabangHtml = '<option value="ALL">SEMUA CABANG</option>';
  daftarCabangObj.forEach(function (item) {
    opsiCabangHtml +=
      // value=Kode, Teks=Nama
      '<option value="' +
      item.id +
      '">' +
      item.nama.toUpperCase() +
      "</option>";
  });

  // 2. SIAPKAN OPSI DROPDOWN PERKIRAAN
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
    // Filter Panel
    '<div class="flt" style="align-items: flex-end;">' +
    // Cabang
    '<div class="fg"><label>Cabang</label><select id="bb_cabang" onchange="updatePerkiraanOptions()"><option value="">-- Pilih Cabang --</option>' +
    opsiCabangHtml +
    "</select></div>" +
    // Perkiraan
    '<div class="fg"><label>No Perkiraan <span class="req">*</span></label><select id="bb_perk"><option value="">-- Pilih --</option>' +
    opts +
    "</select></div>" +
    // Masa Dari
    '<div class="fg"><label>Masa Dari (MMYY)</label><input type="text" id="bb_masa_dari" placeholder="0524" maxlength="4" style="text-transform:uppercase; width:100px;"></div>' +
    // Masa S/D
    '<div class="fg"><label>Masa S/D (MMYY)</label><input type="text" id="bb_masa_sampai" placeholder="0824" maxlength="4" style="text-transform:uppercase; width:100px;"></div>' +
    // Tombol Terapkan
    '<div class="fg"><label>&nbsp;</label><button type="button" class="btn btn-g" onclick="refreshBukuBesar()" style="padding:6px 12px;">Terapkan</button></div>' +
    // Tombol Excel
    '<div class="fg"><label>&nbsp;</label><button type="button" class="btn btn-b" onclick="downloadBukuBesarExcel()" style="background:#217346; border-color:#217346; padding:6px 12px;"><i class="fa-solid fa-file-excel"></i> Excel</button></div>' +
    "</div>" +
    // Wadah Tabel
    '<div id="bukuBesarTbl" style="margin-top:1rem;"></div>'
  );
}

window.updatePerkiraanOptions = function () {
  var valcabang = $("bb_cabang").value;
  var selectPerk = $("bb_perk");
  var options = selectPerk.querySelectorAll("option");
  selectPerk.innerHTML = '<option value="">-- Pilih --</option>';
  options.forEach(function (opt) {
    if (opt.value === "") return;
    var cabangPerk = opt.getAttribute("data-cabang") || "";
    if (valcabang === "ALL" || cabangPerk === valcabang) {
      selectPerk.appendChild(opt.cloneNode(true));
    }
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

  window._bbCurrentData = {
    cabang: cabang,
    masaDari: masaDari,
    masaSampai: masaSampai,
    perkiraan: pk,
  };

  var allTransactions = [];

  // Fungsi ambil tahun dari format MMYY (0226 -> 2026)
  function getTahunFromMasa(kode4digit) {
    if (!kode4digit || kode4digit.length < 2) return null;
    var yy = kode4digit.substring(2, 4);
    return "20" + yy;
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

  // Loop ambil data dari Backup per tahun
  for (var th = tahunMulai; th <= tahunAkhir; th++) {
    var namaStore = "transaksi" + th;
    try {
      var rawData = await db.getAll(namaStore);
      var listTh = Array.isArray(rawData) ? rawData : Object.values(rawData);
      allTransactions = allTransactions.concat(listTh);
    } catch (e) {
      console.log("Tabel " + namaStore + " tidak ditemukan.");
    }
  }

  // ============================================================
  // FILTER DATA (SESUAI INFO: noperkiraan & masa format 4 digit)
  // ============================================================
  var data = allTransactions.filter(function (t) {
    // ✅ PERBAIKAN 1: Gunakan kolom 'noperkiraan' untuk cek No Perkiraan
    var tNoPerk = String(t.noperkiraan || "").trim();
    var pNoPerk = String(pk.noPerk).trim();

    if (tNoPerk !== pNoPerk) return false;

    // Filter 2: Cabang
    if (cabang && cabang !== "ALL" && t.cabang !== cabang) return false;

    // ✅ PERBAIKAN 2: Filter Masa
    // Karena format di DB adalah "0226" (4 digit), kita bisa bandingkan langsung string-nya.
    var masaData = String(t.masa || "").trim();

    var validMasa = true;

    if (masaDari) {
      // Cek apakah masa data >= masa dari
      // Contoh: "0326" >= "0226" -> True
      if (masaData < masaDari) validMasa = false;
    }

    if (masaSampai) {
      // Cek apakah masa data <= masa sampai
      // Contoh: "0426" <= "0526" -> True
      if (masaData > masaSampai) validMasa = false;
    }

    if (!validMasa) return false;

    return true;
  });

  // Sort by Tanggal
  data.sort(function (a, b) {
    return (a.tanggal || "").localeCompare(b.tanggal || "");
  });

  var sal = num(pk.awal);
  var rows = data.map(function (t) {
    sal += num(t.db) - num(t.cr);
    return [
      t.tanggal || "-",
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

  var labelMasa = "";
  if (masaDari && masaSampai) labelMasa = masaDari + " s/d " + masaSampai;
  else if (masaDari) labelMasa = "Dari " + masaDari;
  else if (masaSampai) labelMasa = "S/d " + masaSampai;
  else labelMasa = "Semua (" + tahunMulai + ")";

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
    "</div>" +
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
          emptyMsg: "Tidak ada transaksi",
        },
      ),
    );
}
//=======================================================================
// FUNGSI DOWNLOAD EXCEL BUKU BESAR
// =========================================================================
async function downloadBukuBesarExcel() {
  if (!window._bbCurrentData) {
    toast("Tidak ada data untuk didownload", "err");
    return;
  }

  var pk = window._bbCurrentData.perkiraan;
  var cabang = window._bbCurrentData.cabang;
  var masaDari = window._bbCurrentData.masaDari;
  var masaSampai = window._bbCurrentData.masaSampai;

  // ============================================================
  // 1. AMBIL DATA DARI BACKUP (Sama Logic dengan Refresh)
  // ============================================================
  var allTransactions = [];

  function getTahunFromMasa(kode4digit) {
    if (!kode4digit || kode4digit.length < 2) return null;
    var yy = kode4digit.substring(2, 4);
    return "20" + yy;
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

  for (var th = tahunMulai; th <= tahunAkhir; th++) {
    var namaStore = "transaksi" + th;
    try {
      var rawData = await db.getAll(namaStore); // Karena ini di dalam fungsi async, await bekerja
      var listTh = Array.isArray(rawData) ? rawData : Object.values(rawData);
      allTransactions = allTransactions.concat(listTh);
    } catch (e) {
      console.log("Tabel " + namaStore + " tidak ditemukan saat download.");
    }
  }

  // ============================================================
  // 2. FILTER DATA (Sama dengan Refresh)
  // ============================================================
  var data = allTransactions.filter(function (t) {
    // ✅ GUNAKAN noperkiraan
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

    return true;
  });

  data.sort(function (a, b) {
    return (a.tanggal || "").localeCompare(b.tanggal || "");
  });

  // ============================================================
  // 3. SUSUN HTML EXCEL
  // ============================================================
  var sal = num(pk.awal);
  var html =
    '<table border="1" style="border-collapse:collapse; font-family:Arial, sans-serif;">';

  // Header
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

  // Baris Saldo Awal
  html += "<tr>";
  html +=
    '<td style="padding:6px; border:1px solid #000; font-style:italic;">Saldo Awal</td>';
  html += '<td style="padding:6px; border:1px solid #000;"></td>';
  html += '<td style="padding:6px; border:1px solid #000;"></td>';
  html += '<td style="padding:6px; border:1px solid #000;"></td>';
  html += '<td style="padding:6px; border:1px solid #000;"></td>';
  html += '<td style="padding:6px; border:1px solid #000;">-</td>';
  html +=
    '<td style="padding:6px; border:1px solid #000; text-align:right; font-weight:bold;">' +
    fmtN(sal) +
    "</td>";
  html += "</tr>";

  var totalDb = 0;
  var totalCr = 0;

  data.forEach(function (t) {
    var dbVal = num(t.db);
    var crVal = num(t.cr);
    sal += dbVal - crVal;
    totalDb += dbVal;
    totalCr += crVal;

    html += "<tr>";
    html +=
      '<td style="padding:6px; border:1px solid #000;">' +
      (t.tanggal || "-") +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000;">' +
      '<span style="color:white;">\'</span>' +
      (t.noreff || "-") +
      "</td>"; // No Reff Text
    html +=
      '<td style="padding:6px; border:1px solid #000;">' +
      (t.dariKePada || "-") +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000;">' +
      (t.desc || "-") +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
      fmtN(dbVal) +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right;">' +
      fmtN(crVal) +
      "</td>";
    html +=
      '<td style="padding:6px; border:1px solid #000; text-align:right; font-weight:bold;">' +
      fmtN(sal) +
      "</td>";
    html += "</tr>";
  });

  // Total
  html += '<tr style="font-weight:bold; background:#f9f9f9;">';
  html +=
    '<td colspan="4" style="padding:8px; border:1px solid #000; text-align:right;">TOTAL PERIODE INI</td>';
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    fmtN(totalDb) +
    "</td>";
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    fmtN(totalCr) +
    "</td>";
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
    fmtN(num(pk.awal) + totalDb - totalCr) +
    "</td>";
  html += "</tr>";
  html += "</table>";

  // Info Akun di Excel
  var labelMasaExl = "";
  if (masaDari && masaSampai) labelMasaExl = masaDari + " s/d " + masaSampai;
  else if (masaDari) labelMasaExl = "Dari " + masaDari;
  else if (masaSampai) labelMasaExl = "S/d " + masaSampai;
  else labelMasaExl = "Semua (" + tahunMulai + ")";

  var infoAkun = "<h3>Buku Besar: " + pk.noPerk + " - " + pk.desc + "</h3>";
  infoAkun +=
    "<p>Cabang: " +
    (cabang === "ALL" ? "Semua" : cabang) +
    " | Periode: " +
    labelMasaExl +
    "</p>";

  var fullHtml =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Buku Besar</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    </head>
    <body>` +
    infoAkun +
    html +
    `</body></html>`;

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "BukuBesar_" + pk.noPerk + "_" + labelMasaExl.replace(/\s+/g, "_") + ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof toast === "function")
    toast("File Excel berhasil diunduh.", "success");
}
/* ---------- Export XLS ---------- */
PANEL_MAP.expXls = renderExpXls;

async function renderExpXls() {
  var opts = DBCache.perkiraan
    .map(function (p) {
      return (
        '<option value="' +
        p.id +
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
    '<div style="max-width:500px"><div style="background:var(--card);border:1px solid var(--brd);border-radius:var(--r);padding:1.2rem">' +
    '<h3 style="font-size:.9rem;margin-bottom:.8rem"><i class="fa-solid fa-file-excel" style="color:var(--success)"></i> Export ke Excel</h3>' +
    '<div class="fg"><label>Jenis Laporan</label><select id="ex_type" onchange="toggleExpOpts()">' +
    '<option value="perkiraan">Perkiraan</option><option value="transaksi">Transaksi</option>' +
    '<option value="bukuBesar">Buku Besar</option><option value="neraca">Neraca</option>' +
    '<option value="detilNeraca">Detil Neraca</option><option value="rlRekap">RL Rekap</option><option value="rlDetil">RL Detil</option></select></div>' +
    '<div id="ex_perkOpts" class="fg" style="display:none"><label>No Perkiraan</label><select id="ex_perk"><option value="">-- Pilih --</option>' +
    opts +
    "</select></div>" +
    '<div style="margin-top:.8rem"><button class="btn btn-a" onclick="doExportXls()"><i class="fa-solid fa-download"></i> Download</button></div></div></div>'
  );
}
function toggleExpOpts() {
  $("ex_perkOpts").style.display =
    $("ex_type").value === "bukuBesar" ? "block" : "none";
}
async function doExportXls() {
  var type = $("ex_type").value,
    wb = XLSX.utils.book_new();
  if (type === "perkiraan") {
    var d = [
      ["Gol", "No Perk", "Desc", "Awal", "DB", "CR", "Akhir", "Cabang"],
    ].concat(
      DBCache.perkiraan.map(function (p) {
        return [
          p.gol,
          p.noPerk,
          p.desc,
          p.awal,
          p.db,
          p.cr,
          num(p.awal) + num(p.db) - num(p.cr),
          p.cabang,
        ];
      }),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), "Perkiraan");
  } else if (type === "transaksi") {
    var d = [
      [
        "Tanggal",
        "No Ref",
        "Kode Bank",
        "Kode Trans",
        "Dari/Kepada",
        "Desc",
        "Total",
        "DB",
        "CR",
        "Cabang",
      ],
    ].concat(
      DBCache.transaksi.map(function (t) {
        return [
          t.tanggal,
          t.noreff,
          t.kodeBank,
          t.kodeTrans,
          t.dariKePada,
          t.desc,
          t.total,
          t.db,
          t.cr,
          t.cabang,
        ];
      }),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), "Transaksi");
  } else if (type === "bukuBesar") {
    var pk = await db.get("perkiraan", $("ex_perk").value);
    if (!pk) {
      toast("Pilih perkiraan", "err");
      return;
    }
    var data = DBCache.transaksi
      .filter(function (t) {
        return t.kodeTrans === pk.noPerk;
      })
      .sort(function (a, b) {
        return (a.tanggal || "").localeCompare(b.tanggal || "");
      });
    var d = [
      [pk.gol + " - " + pk.noPerk + " - " + pk.desc],
      [],
      ["Tanggal", "No Ref", "Dari/Kepada", "Desc", "DB", "CR", "Saldo"],
      ["Saldo Awal", "", "", "", "", "-", pk.awal],
    ];
    var s = num(pk.awal);
    data.forEach(function (t) {
      s += num(t.db) - num(t.cr);
      d.push([t.tanggal, t.noreff, t.dariKePada, t.desc, t.db, t.cr, s]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), "Buku Besar");
  } else if (type === "neraca") {
    var gols = DBCache.golongan,
      perks = DBCache.perkiraan;
    var d = [["NERACA"], [], ["AKTIVA"], ["Gol", "Nama", "Saldo"]];
    var tAk = 0;
    gols
      .filter(function (g) {
        return g.gol.startsWith("1");
      })
      .forEach(function (g) {
        var t = gPerks(g.gol, perks);
        d.push([g.gol, g.namaGol, t]);
        tAk += t;
      });
    d.push(["", "TOTAL AKTIVA", tAk], [], ["PASIVA"], ["Gol", "Nama", "Saldo"]);
    var tP = 0;
    gols
      .filter(function (g) {
        return g.gol.startsWith("2") || g.gol.startsWith("3");
      })
      .forEach(function (g) {
        var t = gPerks(g.gol, perks);
        d.push([g.gol, g.namaGol, t]);
        tP += t;
      });
    d.push(["", "TOTAL PASIVA", tP]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), "Neraca");
  } else if (type === "detilNeraca") {
    var d = [
      ["DETIL NERACA"],
      [],
      ["Gol", "No Perk", "Desc", "Awal", "DB", "CR", "Akhir"],
    ].concat(
      DBCache.perkiraan.map(function (p) {
        return [
          p.gol,
          p.noPerk,
          p.desc,
          p.awal,
          p.db,
          p.cr,
          num(p.awal) + num(p.db) - num(p.cr),
        ];
      }),
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(d),
      "Detil Neraca",
    );
  } else if (type === "rlRekap") {
    var d = [
      ["RL REKAP"],
      [],
      ["Gol", "Desc", "Akumulasi", "Bulan Ini"],
    ].concat(
      DBCache.golongan
        .filter(function (g) {
          return g.gol.startsWith("4") || g.gol.startsWith("5");
        })
        .map(function (g) {
          return [g.gol, g.namaGol, gPerks(g.gol, DBCache.perkiraan), "-"];
        }),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), "RL Rekap");
  } else if (type === "rlDetil") {
    var d = [
      ["RL DETIL"],
      [],
      ["Gol", "No Perk", "Desc", "Akumulasi", "Bulan Ini"],
    ].concat(
      DBCache.perkiraan
        .filter(function (p) {
          return p.gol.startsWith("4") || p.gol.startsWith("5");
        })
        .map(function (p) {
          return [
            p.gol,
            p.noPerk,
            p.desc,
            num(p.awal) + num(p.db) - num(p.cr),
            "-",
          ];
        }),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d), "RL Detil");
  }
  XLSX.writeFile(
    wb,
    "laporan_" + type + "_" + new Date().toISOString().split("T")[0] + ".xlsx",
  );
  toast("Excel berhasil diunduh", "ok");
}

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
  var htmlLaporan =
    '<div id="area_cetak_rllebar" style="background:#000; padding:1rem; border-radius:var(--r); border:1px solid #333; height:550px; max-height:550px; width:100%; overflow:hidden;">' +
    '<div style="text-align:center; color:#fff;">' +
    '<h3 style="margin:0 0.8rem 0; color:#fff;">Laporan RL Lebar Bulanan - Tahun ' +
    window._rlLebarFilterTahun +
    "</h3>" +
    '<div class="no-print" style="background:#111; border:1px solid #333; padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:1rem; color:#fff;">' +
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
        return cocokGol && masaData === kodeMasa && cabangData === valCabang;
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
        '<div style="padding:3rem;text-align:center;color:#888;">Data kosong</div>';
      return;
    }

    var html =
      '<div style="margin-bottom:.5rem;font-size:.78rem;color:#aaa;">3xx=Penjualan | 4xx=HPP | 5xx=By Adm | 6xx=Beban Lain | Tahun: ' +
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

    // Inisialisasi awal
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

    // FUNGSI BARU: Untuk menghitung YTD secara benar (bertahap)
    function prosesAkumulasiYTD(digitSekarang, subTotalBulan) {
      for (var b = 1; b <= 12; b++) {
        var bsLaba = ("0" + b).slice(-2);
        var nilaiBulanIni = subTotalBulan[bsLaba] || 0;

        // Pendapatan (3xx) di database biasanya sudah Positif. Untuk Laba/Rugi jadikan Negatif.
        // Beban (4,5,6xx) di database biasanya sudah Negatif. Biarkan apa adanya (Positifkan di sini).
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

      // Jika ganti golongan baru (misal dari 3xx ke 4xx)
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

        // 🔥 PANGGIL FUNGSI YTD YANG SUDAH DIPERBAIKI
        prosesAkumulasiYTD(currentDigit, subTotalPerBulan);

        // Reset subTotal untuk digit selanjutnya
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

    // Subtotal untuk digit TERAKHIR (di luar loop)
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

      // 🔥 PANGGIL FUNGSI YTD UNTUK DIGIT TERAKHIR
      prosesAkumulasiYTD(currentDigit, subTotalPerBulan);
    }

    // LABA RUGI BERSIH YTD
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
  // ← TAMBAH PARAMETER cabang

  // 1. Parsing Tahun dari format MMYY (karena dikirim dari lihatDetilPerkiraan sudah bentuk MMYY)
  var duadigittahun = masa.substring(2, 4);
  var tahun = "20" + duadigittahun;
  var namaStore = "transaksi" + tahun;

  var popupId = "popup_transaksi_" + Date.now();

  // ✅ CEK NILAI TERIMA
  console.log("📥 [TERIMA] Masa:", masa, "| Cabang:", cabang);

  var popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:45%; max-width:650px; max-height:90vh; background:white; border:1px solid #aaa; box-shadow:0 5px 15px rgba(0,0,0,0.5); z-index:10001; display:flex; flex-direction:column; border-radius:6px;">' +
    '<div style="padding:10px; background:#f0f0f0; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; align-items:center; border-radius:6px 6px 0 0;">' +
    '<strong style="font-size:0.9rem; color:#333;">Detil Transaksi: ' +
    noPerkiraan +
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

      // Masa sudah dalam format MMYY, jadi langsung gunakan
      var masaCari = masa;
      console.log("🔢 [HASIL] Masa Dicari di DB:", masaCari);

      // ✅ GUNAKAN PARAMETER CABANG YANG DITERIMA DARI ONCLICK
      var cabInput = String(cabang || "")
        .trim()
        .toUpperCase();

      // ✅ PERBAIKAN LOGIKA MAPPING CABANG
      var cabFilter = cabInput;
      if (cabInput === "PUSAT") {
        cabFilter = "00"; // Jika user pilih PUSAT, cari kode 00
      }

      console.log(
        "🔍 Mencori Cabang Input:",
        cabInput,
        "-> Dikonversi ke Kode DB:",
        cabFilter,
      );

      // Filter Data
      var detilTrans = listTrans.filter(function (t) {
        var tNo = String(t.noperkiraan || "").trim();
        var tCab = String(t.cabang || "")
          .trim()
          .toUpperCase(); // Pastikan uppercase
        var tMasa = String(t.masa || "").trim();

        // ✅ LOGIKA CABANG: Jika "ALL", abaikan filter cabang. Jika spesifik, harus cocok.
        var cocokCabang = true;
        if (cabFilter !== "ALL" && cabFilter !== "") {
          cocokCabang = tCab === cabFilter;
        }

        return tNo === noPerkiraan && tMasa === masaCari && cocokCabang;
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:20px; color:orange;">' +
          "Data tidak ditemukan.<br><br>" +
          "<small>Dicari No Perkiraan: " +
          noPerkiraan +
          " | Masa: " +
          masaCari +
          " | Cabang Kode: " +
          cabFilter +
          "</small>" +
          "</div>";
        return;
      }

      // Render Tabel
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

      // ✅ TAMBAHAN: Baris Total di bawah tabel
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
