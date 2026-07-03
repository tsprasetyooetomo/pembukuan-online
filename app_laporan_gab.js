PANEL_MAP.rlRekaps = renderRLRekapGabungan;

function renderRLRekapGabungan() {
  // A. SIAPKAN NILAI DEFAULT SAAT PERTAMA KALI DIBUKA
  if (typeof window._rlGabFilterMasa === "undefined") {
    var d = new Date();
    var bln = ("0" + (d.getMonth() + 1)).slice(-2);
    window._rlGabFilterMasa = bln + "-" + d.getFullYear();
  }

  var partMasa = window._rlGabFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];
  var inputMonthValue = filterTahunFull + "-" + filterBulan;

  // C. RENDER HTML ANTARMUKA (TANPA DROPDOWN CABANG)
  var htmlLaporan =
    '<div id="area_cetak_rlgab" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); height:550px; max-height:550px; width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:hidden;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan RL Rekap Gabungan (Semua Cabang)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 PILIHAN TAMPILAN:</div>' +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Masa:</label>' +
    '<input type="month" id="filter_rlgab_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiRLGabungan()">Terapkan</button>' +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadRLGabunganExcel()"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    "</div>" +
    '<div class="table-responsive-container" style="width:100%; max-width:100%; height:380px; max-height:380px; overflow:auto; display:block; border-radius:4px; border:1px solid var(--brd); background:var(--card); box-sizing:border-box; margin:0 auto; clear:both;">' +
    "<style>" +
    "#tempat_tabel_rlgab table { width: 100% !important; min-width: 600px !important; border-collapse: collapse !important; table-layout: auto !important; margin:0 !important; }" +
    "#tempat_tabel_rlgab th { padding: 8px 12px !important; background: var(--bg2); white-space: nowrap !important; border: 1px solid var(--brd); position: sticky !important; top: 0; z-index: 10; }" +
    "#tempat_tabel_rlgab td { padding: 8px 12px !important; white-space: nowrap !important; border: 1px solid var(--brd); }" +
    "</style>" +
    '<div id="tempat_tabel_rlgab" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data RL Gabungan.</p>' +
    "</div></div>";

  return htmlLaporan;
}
async function terapkanOpsiRLGabungan() {
  var inputmasa = document.getElementById("filter_rlgab_masa");
  if (!inputmasa) return;

  var valmasa = inputmasa.value;
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

  window._rlGabFilterMasa = filterbulan + "-" + filtertahunfull;
  var kodemasadicari = filterbulan + duadigittahunbelakang;
  var namastoregolbackup = "golongan" + filtertahunfull;

  var area = document.getElementById("tempat_tabel_rlgab");
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 Memuat data gabungan semua cabang...</div>';
  }

  try {
    // 1. AMBIL MASTER (TANPA FILTER CABANG)
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namaGol || m.nama || "").trim();
        if (kode) mapMasterGol[kode] = nama; // Ambil semua nama, meski beda cabang biasanya namanya sama
      });
    }

    // 2. AMBIL DATA BACKUP TANPA FILTER CABANG
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    // 3. KELOMPOKKAN DATA BERDASARKAN CABANG
    var dataByCabang = {};
    rawdatagolongan.forEach(function (g) {
      var kodeGol = String(g.gol || g.golongan || "").trim();
      var cabangData = String(
        g.cabang || g.cab || g.kode_cabang || "TANPA CABANG",
      ).trim();
      var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

      if (kodeGol >= 300 && kodeGol < 700 && masaData === kodemasadicari) {
        if (!dataByCabang[cabangData]) dataByCabang[cabangData] = {};
        if (!dataByCabang[cabangData][kodeGol])
          dataByCabang[cabangData][kodeGol] = 0;

        // Langsung hitung Saldo Akhir (Db - Cr)
        var saldoAkhir = +(g.db || 0) - +(g.cr || 0);
        dataByCabang[cabangData][kodeGol] += saldoAkhir;
      }
    });

    // 4. SUSUN STRUKTUR DATA UNTUK TABLE (Horisontal)
    var daftarCabang = Object.keys(dataByCabang).sort();

    // Kumpulkan semua kode gol unik dari semua cabang
    var setKodeGol = new Set();
    daftarCabang.forEach(function (cab) {
      Object.keys(dataByCabang[cab]).forEach(function (gol) {
        setKodeGol.add(gol);
      });
    });
    var arrKodeGol = Array.from(setKodeGol).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });

    // Simpan untuk keperluan excel
    window._rlGabunganData = {
      daftarCabang: daftarCabang,
      arrKodeGol: arrKodeGol,
      dataByCabang: dataByCabang,
      mapMasterGol: mapMasterGol,
    };

    var html = "";
    var outerArea = document.getElementById("area_cetak_rlgab");
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

    html += generateHTMLRLGabungan(
      daftarCabang,
      arrKodeGol,
      dataByCabang,
      mapMasterGol,
      false,
    );
    area.innerHTML = html;
  } catch (error) {
    console.error("❌ Gagal total RL Gabungan:", error);
    if (area)
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}
async function downloadRLGabunganExcel() {
  if (
    !window._rlGabunganData ||
    window._rlGabunganData.arrKodeGol.length === 0
  ) {
    if (typeof toast === "function")
      toast("Tidak ada data RL Gabungan untuk didownload", "err");
    return;
  }
  var d = window._rlGabunganData;
  var htmlContent = generateHTMLRLGabungan(
    d.daftarCabang,
    d.arrKodeGol,
    d.dataByCabang,
    d.mapMasterGol,
    true,
  );
  var fullHtml =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>RL Gabungan</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>` +
    htmlContent +
    `</body></html>`;
  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "Laporan_RL_Gabungan_" + (window._rlGabFilterMasa || "Export") + ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof toast === "function")
    toast("File Excel RL Gabungan sedang didownload...", "ok");
}
function generateHTMLRLGabungan(
  daftarCabang,
  arrKodeGol,
  dataByCabang,
  mapMasterGol,
  isForExcel,
) {
  var html = "";
  html +=
    '<div style="width: 100%; overflow-x: auto; border: 1px solid #ddd;">';
  html +=
    '<table border="1" style="width:100%; min-width: 600px; border-collapse: collapse; text-align:left; color:#000; border: 1px solid #000;">';

  // 1. HEADER ATAS (NAMA CABANG)
  html += '<thead style="background:#f4f4f4; font-weight:bold;"><tr>';
  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000;">GOL</th>';
  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000;">NAMA GOLONGAN</th>';

  daftarCabang.forEach(function (cab) {
    html +=
      '<th style="padding:10px; border:1px solid #000; text-align:right; background-color:#d9e1f2;">' +
      cab +
      "</th>";
  });

  // Tambah Kolom Total
  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000; text-align:right; background-color:#000000; color:#ffffff;">TOTAL</th>';

  html += "</tr><tr></tr></thead><tbody>";

  var currentDigit = null;
  var mapSumPerDigit = {}; // Untuk menghitung subtotal per digit golongan

  // 2. ISI BARIS DATA
  arrKodeGol.forEach(function (kodeGol) {
    var digit = kodeGol.charAt(0);
    var namaGol = mapMasterGol[kodeGol] || "-";

    // Buat baris pemisah golongan
    if (currentDigit !== null && digit !== currentDigit) {
      html += buatBarisSubtotalGabungan(
        currentDigit,
        daftarCabang,
        dataByCabang,
        mapSumPerDigit,
      );
      mapSumPerDigit = {}; // Reset hitungan untuk digit baru
    }
    if (currentDigit !== digit) {
      var namaHeader =
        digit === "3"
          ? "PENJUALAN"
          : digit === "4"
            ? "HPP"
            : digit === "5"
              ? "BY ADM & UMUM"
              : "BEBAN LAINNYA";
      html +=
        "<tr><td colspan='" +
        (daftarCabang.length + 3) +
        "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#e9ecef;'>" +
        namaHeader +
        "</td></tr>";
    }

    currentDigit = digit;
    var totalRow = 0;

    html += '<tr style="font-size: 0.85rem;">';
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:center; font-weight:bold;">' +
      kodeGol +
      "</td>";
    html +=
      '<td style="padding:8px; border:1px solid #000;">' + namaGol + "</td>";

    // Looping isi saldo tiap cabang
    daftarCabang.forEach(function (cab) {
      var saldo = dataByCabang[cab][kodeGol] || 0;
      totalRow += saldo;

      // Simpan untuk keperluan subtotal
      if (!mapSumPerDigit[cab]) mapSumPerDigit[cab] = 0;
      mapSumPerDigit[cab] += saldo;

      var xNum = isForExcel ? ' x:num="' + saldo + '"' : "";
      var colorStyle = saldo < 0 ? "color:red;" : "";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; ' +
        colorStyle +
        '"' +
        xNum +
        ">" +
        formatUang(saldo) +
        "</td>";
    });

    // Kolom Total Akhir
    var xNumTotal = isForExcel ? ' x:num="' + totalRow + '"' : "";
    var colorTotal =
      totalRow < 0 ? "color:red; font-weight:bold;" : "font-weight:bold;";
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; background-color:#fff2cc; ' +
      colorTotal +
      '"' +
      xNumTotal +
      ">" +
      formatUang(totalRow) +
      "</td>";

    html += "</tr>";
  });

  // 3. SUBTOTAL GOLONGAN TERAKHIR
  if (currentDigit !== null) {
    html += buatBarisSubtotalGabungan(
      currentDigit,
      daftarCabang,
      dataByCabang,
      mapSumPerDigit,
    );
  }

  html += "</tbody></table></div>";
  return html;
}

// FUNGSI BANTUAN UNTUK Membuat Baris Subtotal
function buatBarisSubtotalGabungan(
  digit,
  daftarCabang,
  dataByCabang,
  mapSumPerDigit,
) {
  var html = "";
  var ketSubtotal =
    digit === "3"
      ? "PENJUALAN BERSIH"
      : digit === "4"
        ? "TOTAL HPP"
        : digit === "5"
          ? "TOTAL BY ADM & UMUM"
          : "TOTAL BEBAN LAINNYA";

  var totalSub = 0;
  html += '<tr style="font-weight:bold; background-color:#fff3cd;">';
  html +=
    '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right;">' +
    ketSubtotal +
    "</td>";

  daftarCabang.forEach(function (cab) {
    var saldo = mapSumPerDigit[cab] || 0;
    totalSub += saldo;
    var colorStyle = saldo < 0 ? "color:red;" : "";
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; ' +
      colorStyle +
      '">' +
      formatUang(saldo) +
      "</td>";
  });

  var colorTotalSub = totalSub < 0 ? "color:red;" : "";
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; background-color:#fff2cc; ' +
    colorTotalSub +
    '">' +
    formatUang(totalSub) +
    "</td>";
  html += "</tr>";

  return html;
}
