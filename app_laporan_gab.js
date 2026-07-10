PANEL_MAP.rlRekaps = renderRLRekapGabungan;

function renderRLRekapGabungan() {
  if (typeof window._rlGabFilterMasa === "undefined") {
    var d = new Date();
    var bln = ("0" + (d.getMonth() + 1)).slice(-2);
    window._rlGabFilterMasa = bln + "-" + d.getFullYear();
  }

  var partMasa = window._rlGabFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];
  var inputMonthValue = filterTahunFull + "-" + filterBulan;

  // PERBAIKAN: Tag area_grafik_rlgab dan canvas yang tidak dipakai di halaman utama sudah dihapus
  var htmlLaporan =
    '<div id="area_cetak_rlgab" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:visible;">' +
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
    '<button type="button" class="btn btn-s" style="font-size:.75rem; padding:4px 12px; background:#6f42c1; border-color:#6f42c1; color:#fff;" onclick="lihatGrafikRLGabungan()"><i class="fa-solid fa-chart-line"></i> Lihat Grafik</button>' +
    "</div>" +
    "</div>" +
    '<div id="tempat_tabel_rlgab" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data. <i>(Klik nama cabang untuk melihat RL Lebar 12 Bulan)</i></p>' +
    "</div>";

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
    // 1. AMBIL MASTER GOLONGAN
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namaGol || m.nama || "").trim();
        if (kode) mapMasterGol[kode] = nama;
      });
    }

    // 2. AMBIL MASTER CABANG
    var rawMasterCab = await db.getAll("cabang");
    var mapMasterCab = {};
    var setValidCabang = new Set();

    if (rawMasterCab) {
      var arrMasterCab = Array.isArray(rawMasterCab)
        ? rawMasterCab
        : Object.values(rawMasterCab);
      arrMasterCab.forEach(function (c) {
        var kode = String(c.kode_cabang || c.kode || c.cab || "").trim();
        var nama = String(c.nama_cabang || c.nama || c.cabang || "").trim();
        if (kode && nama) {
          mapMasterCab[kode] = nama;
          setValidCabang.add(kode);
        }
      });
    }

    // 3. AMBIL DATA GOLONGAN TAHUNAN
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];
    var dataByCabang = {};

    // 4. PROSES DATA
    rawdatagolongan.forEach(function (g) {
      var kodeGol = String(g.gol || g.golongan || "").trim();
      var cabangData = String(g.cabang || g.cab || g.kode_cabang || "").trim();
      var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

      if (!setValidCabang.has(cabangData)) return;

      if (kodeGol >= 300 && kodeGol < 700 && masaData === kodemasadicari) {
        if (!dataByCabang[cabangData]) dataByCabang[cabangData] = {};
        if (!dataByCabang[cabangData][kodeGol])
          dataByCabang[cabangData][kodeGol] = 0;
        var saldoAkhir = +(g.db || 0) - +(g.cr || 0);
        dataByCabang[cabangData][kodeGol] += saldoAkhir;
      }
    });

    // 5. SUSUN BARIS DAN KOLOM TABEL
    var daftarCabang = Object.keys(dataByCabang).sort();
    var setKodeGol = new Set();
    daftarCabang.forEach(function (cab) {
      Object.keys(dataByCabang[cab]).forEach(function (gol) {
        setKodeGol.add(gol);
      });
    });

    var arrKodeGol = Array.from(setKodeGol).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });

    // Hilangkan golongan yang totalnya 0
    arrKodeGol = arrKodeGol.filter(function (kodeGol) {
      var totalSemuaCabang = 0;
      daftarCabang.forEach(function (cab) {
        totalSemuaCabang += dataByCabang[cab][kodeGol] || 0;
      });
      return totalSemuaCabang !== 0;
    });

    window._rlGabunganData = {
      daftarCabang,
      arrKodeGol,
      dataByCabang,
      mapMasterGol,
      mapMasterCab,
    };

    // Render UI
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

    area.innerHTML = generateHTMLRLGabungan(
      daftarCabang,
      arrKodeGol,
      dataByCabang,
      mapMasterGol,
      mapMasterCab,
      false,
    );

    // PERBAIKAN: Baris renderGrafikRLGabungan DIHAPUS. Tabel muncul, grafik TIDAK muncul saat ini.
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
    d.mapMasterCab,
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
  mapMasterCab,
  isForExcel,
) {
  var html =
    '<div id="area_tabel_gabungan" style="width: 100%; overflow-x: auto; border: 1px solid #131010;"><table border="1" style="width:100%; min-width: 600px; border-collapse: collapse; text-align:left; color:#000; border: 1px solid #000;">';
  html += '<thead style="background:#f4f4f4; font-weight:bold;"><tr>';
  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000;">GOL</th>';
  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000;">NAMA GOLONGAN</th>';

  daftarCabang.forEach(function (cab) {
    var namaTampil = mapMasterCab[cab] || cab;
    if (!isForExcel) {
      html +=
        '<th style="padding:10px; border:1px solid #000; text-align:center; background-color:#000000;"><span class="link-cabang-rl" style="color:#00D2FF; text-decoration:underline; cursor:pointer;" onclick="tampilkanRLPerCabangSD(\'' +
        cab.replace(/'/g, "\\'") +
        "')\">" +
        namaTampil +
        "</span></th>";
    } else {
      html +=
        '<th style="padding:10px; border:1px solid #000; text-align:center; background-color:#d9e1f2;">' +
        namaTampil +
        "</th>";
    }
  });

  // PERBAIKAN: Bug CSS double style dan typo 'centre' sudah diperbaiki
  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000; text-align:center; background-color:#d9e1f2; color:#00D2FF; font-weight:bold;">TOTAL</th>';
  html += "</tr><tr></tr></thead><tbody>";

  var currentDigit = null;
  var mapSumPerDigit = {};

  arrKodeGol.forEach(function (kodeGol) {
    var digit = kodeGol.charAt(0);
    var namaGol = mapMasterGol[kodeGol] || "-";

    if (currentDigit !== null && digit !== currentDigit) {
      html += buatBarisSubtotalGabungan(
        currentDigit,
        daftarCabang,
        dataByCabang,
        mapSumPerDigit,
        isForExcel,
      );
      if (currentDigit === "4")
        html += hitungBarisLaba(
          "LABA KOTOR",
          "3",
          "4",
          undefined,
          undefined,
          daftarCabang,
          dataByCabang,
          "#4a4a4a",
          isForExcel,
        );
      else if (currentDigit === "5")
        html += hitungBarisLaba(
          "LABA SETELAH BY. ADM & UMUM",
          "3",
          "4",
          "5",
          undefined,
          daftarCabang,
          dataByCabang,
          "#4a4a4a",
          isForExcel,
        );
      else if (currentDigit === "6")
        html += hitungBarisLaba(
          "LABA / RUGI BERSIH",
          "3",
          "4",
          "5",
          "6",
          daftarCabang,
          dataByCabang,
          "#4a4a4a",
          isForExcel,
        );
      mapSumPerDigit = {};
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

    daftarCabang.forEach(function (cab) {
      var saldo = dataByCabang[cab][kodeGol] || 0;
      totalRow += saldo;
      if (!mapSumPerDigit[cab]) mapSumPerDigit[cab] = 0;
      mapSumPerDigit[cab] += saldo;
      var xNum = isForExcel ? ' x:num="' + saldo + '"' : "";
      var colorStyle = saldo < 0 ? "color: red;" : "";
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; ' +
        colorStyle +
        '"' +
        xNum +
        ">" +
        formatUang(saldo) +
        "</td>";
    });

    var xNumTotal = isForExcel ? ' x:num="' + totalRow + '"' : "";
    var colorTotal = totalRow < 0 ? "color: red;" : "";
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; font-weight:bold; ' +
      colorTotal +
      '"' +
      xNumTotal +
      ">" +
      formatUang(totalRow) +
      "</td>";
    html += "</tr>";
  });

  if (currentDigit !== null) {
    html += buatBarisSubtotalGabungan(
      currentDigit,
      daftarCabang,
      dataByCabang,
      mapSumPerDigit,
      isForExcel,
    );
    if (currentDigit === "6")
      html += hitungBarisLaba(
        "LABA / RUGI BERSIH",
        "3",
        "4",
        "5",
        "6",
        daftarCabang,
        dataByCabang,
        "#4a4a4a",
        isForExcel,
      );
  }
  html += "</tbody></table></div>";
  return html;
}

function buatBarisSubtotalGabungan(
  digit,
  daftarCabang,
  dataByCabang,
  mapSumPerDigit,
  isForExcel,
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
  var bgColor = digit === "3" ? "#1f7a43" : "#0d6efd";
  var totalSub = 0;
  html +=
    '<tr style="font-weight:bold; background-color:' +
    bgColor +
    '; color:#ffffff;">';
  html +=
    '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right; color:#ffffff;">' +
    ketSubtotal +
    "</td>";
  daftarCabang.forEach(function (cab) {
    var saldo = mapSumPerDigit[cab] || 0;
    totalSub += saldo;
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:#ffffff;"' +
      (isForExcel ? ' x:num="' + saldo + '"' : "") +
      ">" +
      formatUang(saldo) +
      "</td>";
  });
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; background-color:' +
    bgColor +
    '; color:#ffffff; font-weight:bold;"' +
    (isForExcel ? ' x:num="' + totalSub + '"' : "") +
    ">" +
    formatUang(totalSub) +
    "</td>";
  html += "</tr>";
  return html;
}

function hitungBarisLaba(
  namaBaris,
  digit1,
  digit2,
  digit3,
  digit4,
  daftarCabang,
  dataByCabang,
  bgColor,
  isForExcel,
) {
  var html = "",
    totalLaba = 0;
  html +=
    '<tr style="font-weight:bold; background-color:' +
    bgColor +
    '; color:#ffffff;">';
  html +=
    '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right; color:#ffffff;">' +
    namaBaris +
    "</td>";
  daftarCabang.forEach(function (cab) {
    var saldoCab = 0;
    [digit1, digit2, digit3, digit4]
      .filter((d) => d !== undefined)
      .forEach(function (dig) {
        Object.keys(dataByCabang[cab] || {}).forEach(function (kodeGol) {
          if (String(kodeGol).charAt(0) === dig)
            saldoCab += dataByCabang[cab][kodeGol];
        });
      });
    totalLaba += saldoCab;
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:#ffffff;"' +
      (isForExcel ? ' x:num="' + saldoCab + '"' : "") +
      ">" +
      formatUang(saldoCab) +
      "</td>";
  });
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; background-color:' +
    bgColor +
    '; color:#ffffff; font-weight:bold;"' +
    (isForExcel ? ' x:num="' + totalLaba + '"' : "") +
    ">" +
    formatUang(totalLaba) +
    "</td>";
  html += "</tr>";
  return html;
}

function kembaliKeRLGabungan() {
  var area = document.getElementById("tempat_tabel_rlgab");
  if (area && window._rlGabunganData) {
    var d = window._rlGabunganData;
    area.innerHTML = generateHTMLRLGabungan(
      d.daftarCabang,
      d.arrKodeGol,
      d.dataByCabang,
      d.mapMasterGol,
      d.mapMasterCab,
      false,
    );
  }
}

async function tampilkanRLPerCabangSD(kodeCabang) {
  if (!window._rlGabFilterMasa) return;
  var namaCab =
    window._rlGabunganData && window._rlGabunganData.mapMasterCab[kodeCabang]
      ? window._rlGabunganData.mapMasterCab[kodeCabang]
      : kodeCabang;
  var partMasa = window._rlGabFilterMasa.split("-");
  var filterTahunFull = partMasa[1];

  var area = document.getElementById("tempat_tabel_rlgab");
  if (area)
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted); background:#000; border-radius:8px;"><span class="spinner"></span> Memuat RL Lebar 12 Bulan...</div>';

  try {
    var namastoregolbackup = "golongan" + filterTahunFull;
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

    for (let b = 1; b <= 12; b++) {
      let blnStr = ("0" + b).slice(-2);
      let duaDigitTahun = String(filterTahunFull).slice(-2);
      let kodeMasa = blnStr + duaDigitTahun;
      let dataBulanIni = rawdatagolongan.filter((g) => {
        let kodeGol = parseInt(g.gol || g.golongan || 0, 10);
        return (
          kodeGol >= 300 &&
          kodeGol < 700 &&
          String(g.masa || g.periode || g.kode_masa || "").trim() ===
            kodeMasa &&
          String(g.cabang || g.cab || g.kode_cabang || "").trim() === kodeCabang
        );
      });

      dataBulanIni.forEach((item) => {
        let kodeGol = String(item.gol || item.golongan || "");
        if (!mapGolongan[kodeGol]) {
          mapGolongan[kodeGol] = {
            gol: kodeGol,
            namaGol: item.namaGol || item.nama_golongan || "",
            cabang: kodeCabang,
            bulan: {},
            total: 0,
          };
          for (let x = 1; x <= 12; x++)
            mapGolongan[kodeGol].bulan[("0" + x).slice(-2)] = 0;
        }
        let saldoAkhir = Number((item.db || 0) - (item.cr || 0));
        mapGolongan[kodeGol].bulan[blnStr] = saldoAkhir;
        mapGolongan[kodeGol].total += saldoAkhir;
      });
    }

    let listGol = Object.values(mapGolongan)
      .filter((g) => g.total !== 0)
      .sort((a, b) => parseInt(a.gol) - parseInt(b.gol));
    if (listGol.length === 0) {
      area.innerHTML =
        '<div style="padding:3rem;text-align:center;color:#888; background:#000; border-radius:8px;">Data kosong untuk cabang ini di tahun ' +
        filterTahunFull +
        "</div>";
      return;
    }

    let html =
      '<div style="margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center;"><h4 style="margin:0; color:#fff; font-size:1.1rem;">RL Lebar: ' +
      namaCab +
      " - Tahun " +
      filterTahunFull +
      '</h4><button class="btn btn-b" style="background:#333; color:#fff; border:1px solid #555; font-size:.8rem; padding:5px 15px;" onclick="kembaliKeRLGabungan()"><i class="fa-solid fa-arrow-left"></i> Kembali ke RL Gabungan</button></div>';

    html +=
      '<div style="overflow-x:auto; border:1px solid #444; border-radius:8px;"><table border="1" style="width:100%;border-collapse:collapse;color:#fff;border:1px solid #444;background:#000; min-width:1200px;">';
    html +=
      '<thead><tr style="background:#1a1a1a;font-weight:bold;color:#fff;"><th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;">GOL</th><th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;">NAMA GOLONGAN</th><th colspan="12" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:center;">BULAN</th><th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:right;">TOTAL YTD</th></tr><tr style="background:#1a1a1a;font-weight:bold;color:#fff;text-align:center">';
    namaBulan.forEach(
      (nb) =>
        (html +=
          '<th style="padding:6px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:center">' +
          nb +
          "</th>"),
    );
    html += "</tr></thead><tbody>";

    let currentDigit = null;
    let subTotalPerBulan = {},
      akumulasiLabaRugiPerBulan = {};
    for (let b = 1; b <= 12; b++) {
      let bsInit = ("0" + b).slice(-2);
      subTotalPerBulan[bsInit] = 0;
      akumulasiLabaRugiPerBulan[bsInit] = 0;
    }

    function buatBarisKeterangan(teks) {
      html +=
        '<tr><td colspan="15" style="padding:8px;border:1px solid #444;font-weight:bold;background:#111;color:#fff;text-align:left;">' +
        teks +
        "</td></tr>";
    }

    function buatBarisSubtotal(teks, arrBulan, total, warnaBg, doubleTop) {
      let topBorder = doubleTop ? "border-top:3px double #fff;" : "";
      html +=
        '<tr style="background:' +
        warnaBg +
        ';font-weight:bold;"><td colspan="2" style="padding:8px;border:1px solid #444;text-align:right;' +
        topBorder +
        'color:#fff;">' +
        teks +
        "</td>";
      for (let b = 1; b <= 12; b++) {
        let blnStr = ("0" + b).slice(-2);
        let val = arrBulan[blnStr] || 0;
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
        "</td></tr>";
    }

    function prosesAkumulasiYTD(digitSekarang, subTotalBulan) {
      for (let b = 1; b <= 12; b++) {
        let bsLaba = ("0" + b).slice(-2);
        let nilaiBulanIni = subTotalBulan[bsLaba] || 0;
        akumulasiLabaRugiPerBulan[bsLaba] =
          digitSekarang === "3"
            ? nilaiBulanIni
            : akumulasiLabaRugiPerBulan[bsLaba] + nilaiBulanIni;
      }
    }

    for (let i = 0; i < listGol.length; i++) {
      let item = listGol[i];
      let digit = String(parseInt(item.gol, 10)).charAt(0);

      if (currentDigit !== null && digit !== currentDigit) {
        let arrSub = {},
          totalSub = 0;
        for (let b = 1; b <= 12; b++) {
          let bs = ("0" + b).slice(-2);
          arrSub[bs] = subTotalPerBulan[bs];
          totalSub += subTotalPerBulan[bs];
        }
        let ket = "SUBTOTAL " + currentDigit + "xx";
        if (currentDigit === "3") ket = "PENJUALAN BERSIH";
        if (currentDigit === "4") ket = "TOTAL HPP";
        if (currentDigit === "5") ket = "TOTAL BY ADM & UMUM";
        if (currentDigit === "6") ket = "TOTAL BEBAN LAINNYA";
        buatBarisSubtotal(ket, arrSub, totalSub, "#1b5e20", false);
        prosesAkumulasiYTD(currentDigit, subTotalPerBulan);
        for (let b = 1; b <= 12; b++) subTotalPerBulan[("0" + b).slice(-2)] = 0;
      }

      if (currentDigit !== digit) {
        if (digit === "3") buatBarisKeterangan("PENJUALAN");
        if (digit === "4") buatBarisKeterangan("HARGA POKOK PENJUALAN (HPP)");
        if (digit === "5") buatBarisKeterangan("BIAYA ADMINISTRASI & UMUM");
        if (digit === "6") buatBarisKeterangan("BEBAN LAINNYA");
      }

      currentDigit = digit;
      html += "<tr>";
      html += `<td onclick="lihatDetilTransaksiRLLebar('${item.gol}', 'YTD${filterTahunFull}', '${kodeCabang}')" style="padding:6px;border:1px solid #3e0a93;cursor:pointer;color:#4da3ff;font-weight:bold;text-decoration:underline;">${item.gol}</td><td style="padding:6px;border:1px solid #444;color:#fff;text-align: left;">${item.namaGol}</td>`;
      for (let b = 1; b <= 12; b++) {
        let bs = ("0" + b).slice(-2);
        let rawVal =
          item.bulan && item.bulan[bs] !== undefined ? item.bulan[bs] : 0;
        let val = num(rawVal);
        if (!subTotalPerBulan[bs]) subTotalPerBulan[bs] = 0;
        subTotalPerBulan[bs] += val;
        html += `<td style="padding:6px;border:1px solid #444;text-align:right;color:${val >= 0 ? "#fff" : "#ffc107"}">${val !== 0 ? formatUang(val) : ""}</td>`;
      }
      html += `<td style="padding:6px;border:1px solid #444;text-align:right;font-weight:bold;color:${item.total >= 0 ? "#fff" : "#ff6b6b"}">${formatUang(item.total)}</td></tr>`;
    }

    if (currentDigit !== null) {
      let arrSubAkhir = {},
        totalSubAkhir = 0;
      for (let b = 1; b <= 12; b++) {
        let bs = ("0" + b).slice(-2);
        arrSubAkhir[bs] = subTotalPerBulan[bs];
        totalSubAkhir += subTotalPerBulan[bs];
      }
      let ketAkhir = "SUBTOTAL " + currentDigit + "xx";
      if (currentDigit === "3") ketAkhir = "PENJUALAN BERSIH";
      if (currentDigit === "4") ketAkhir = "TOTAL HPP";
      if (currentDigit === "5") ketAkhir = "TOTAL BY ADM & UMUM";
      if (currentDigit === "6") ketAkhir = "TOTAL BEBAN LAINNYA";
      buatBarisSubtotal(ketAkhir, arrSubAkhir, totalSubAkhir, "#1b5e20", false);
      prosesAkumulasiYTD(currentDigit, subTotalPerBulan);
    }

    html +=
      '<tr><td colspan="15" style="border:1px solid #444;padding:4px;background-color:#ffc107;"></td></tr>';
    let arrTotalBulan = {},
      grandTotal = 0;
    for (let b = 1; b <= 12; b++) {
      let bs = ("0" + b).slice(-2);
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
  } catch (error) {
    console.error("Error load detail RL Cabang:", error);
    if (area)
      area.innerHTML =
        '<div style="padding:2rem; text-align:center; color:red; background:#000; border-radius:8px;">Gagal memuat data: ' +
        error.message +
        "</div>";
  }
}

function lihatDetilTransaksiRLLebar(noPerkiraan, masa, cabang) {
  let tahunFull = masa.replace("YTD", "");
  let namaStore = "transaksi" + tahunFull;
  let popupId = "popup_transaksi_" + Date.now();
  let cabFilter = String(cabang || "")
    .trim()
    .toUpperCase();
  if (cabFilter === "PUSAT") cabFilter = "00";

  let popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:50%; max-width:700px; max-height:90vh; background:#000; border:2px solid #4da3ff; box-shadow:0 0 20px rgba(77, 163, 255, 0.5); z-index:10001; display:flex; flex-direction:column; border-radius:8px;"><div style="padding:12px; background:#1a1a1a; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; border-radius:8px 8px 0 0;"><strong style="font-size:0.9rem; color:#4da3ff;">Detil Transaksi YTD: ' +
    noPerkiraan +
    " | Cabang: " +
    cabFilter +
    "</strong><button onclick=\"document.getElementById('" +
    popupId +
    '\').remove()" style="background:none; border:none; font-size:1.5rem; line-height:1; cursor:pointer; color:#fff;">&times;</button></div><div id="' +
    popupId +
    '_body" style="padding:10px; overflow-y:auto; flex:1; font-size:0.8rem; color:#fff;"><div style="text-align:center; padding:20px; color:#888;">Loading data transaksi 12 bulan...</div></div></div>';

  document.body.insertAdjacentHTML("beforeend", popupHtml);
  let container = document.getElementById(popupId + "_body");

  db.getAll(namaStore)
    .then(function (rawData) {
      let listTrans = Array.isArray(rawData) ? rawData : [];
      let duaDigitTahun = tahunFull.substring(2, 4);
      let setMasaValid = new Set();
      for (let b = 1; b <= 12; b++)
        setMasaValid.add(("0" + b).slice(-2) + duaDigitTahun);

      let prefixNoPerkiraan = String(noPerkiraan || "")
        .trim()
        .substring(0, 3);

      let detilTrans = listTrans.filter(function (t) {
        let tNo = String(t.noperkiraan || "").trim();
        let tCab = String(t.cabang || "")
          .trim()
          .toUpperCase();
        let tMasa = String(t.masa || "").trim();
        let cocokPerkiraan = tNo.substring(0, 3) === prefixNoPerkiraan;
        let cocokMasa = setMasaValid.has(tMasa);
        let cocokCabang =
          cabFilter === "ALL" || cabFilter === "" ? true : tCab === cabFilter;
        return cocokPerkiraan && cocokMasa && cocokCabang;
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:20px; color:#ffc107;">Data tidak ditemukan.<br><br><small>Dicari No Perkiraan (3 digit depan): ' +
          prefixNoPerkiraan +
          " | Tahun: " +
          tahunFull +
          " | Cabang Kode: " +
          cabFilter +
          "</small></div>";
        return;
      }

      detilTrans.sort(function (a, b) {
        let masaA = String(a.masa || ""),
          masaB = String(b.masa || "");
        if (masaA !== masaB) return masaA.localeCompare(masaB);
        return String(a.tanggal || "").localeCompare(String(b.tanggal || ""));
      });

      function ambilTanggalSaja(rawTgl) {
        if (!rawTgl) return "-";
        let strTgl = String(rawTgl).trim();
        let parts = strTgl.split(" ");
        if (parts.length >= 3 && !isNaN(parts[2])) return parts[2];
        if (strTgl.indexOf("/") > -1)
          return strTgl.split(" ")[0].split("/")[0] || "-";
        if (strTgl.indexOf("-") > -1 && strTgl.indexOf("T") > -1)
          return new Date(strTgl).getDate() || "-";
        return "-";
      }

      let tableHtml =
        '<div style="overflow-x:auto; background-color:#000000; color:#ffffff;"><table style="width:100%; border-collapse:collapse; font-size:0.75rem; min-width:500px; background-color:#000000; color:#ffffff;"><thead style="background:#1a1a1a; position:sticky; top:0; color:#ffffff;"><tr><th style="border:1px solid #444; padding:5px;">MASA</th><th style="border:1px solid #444; padding:5px;">TGL</th><th style="border:1px solid #444; padding:5px;">NOREFF</th><th style="border:1px solid #444; padding:5px;">DESC</th><th style="border:1px solid #444; padding:5px; text-align:right;">DEBET</th><th style="border:1px solid #444; padding:5px; text-align:right;">KREDIT</th></tr></thead><tbody>';
      let totalDb = 0,
        totalCr = 0;

      detilTrans.forEach(function (t) {
        let dbVal = num(t.db || 0),
          crVal = num(t.cr || 0);
        totalDb += dbVal;
        totalCr += crVal;
        tableHtml +=
          "<tr>" +
          '<td style="border:1px solid #444; padding:4px; text-align:center; color:#4da3ff;">' +
          (t.masa || "-") +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px; text-align:center;">' +
          ambilTanggalSaja(t.tanggal) +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          (t.noreff || "-") +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          (t.desc || "-") +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px; text-align:right;">' +
          formatUang(dbVal) +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px; text-align:right;">' +
          formatUang(crVal) +
          "</td></tr>";
      });

      tableHtml +=
        '<tr style="background:#1b5e20; font-weight:bold;"><td colspan="4" style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">TOTAL YTD</td><td style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">' +
        formatUang(totalDb) +
        '</td><td style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">' +
        formatUang(totalCr) +
        "</td></tr></tbody></table></div>";
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

// ==========================================
// FUNGSI GRAFIK (JENDELA BARU)
// ==========================================
async function renderGrafikRLGabungan(
  daftarCabang,
  dataByCabang,
  mapMasterCab,
) {
  if (typeof Chart === "undefined") {
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    script.onload = function () {
      gambarChartNow(daftarCabang, dataByCabang, mapMasterCab);
    };
    document.head.appendChild(script);
  } else {
    gambarChartNow(daftarCabang, dataByCabang, mapMasterCab);
  }
}

function gambarChartNow(daftarCabang, dataByCabang, mapMasterCab) {
  var labels = daftarCabang.map(function (cab) {
    return mapMasterCab[cab] || cab;
  });

  function hitungSubTotalPerCabang(digitTarget, isPenjualan) {
    return daftarCabang.map(function (cab) {
      var total = 0;
      Object.keys(dataByCabang[cab] || {}).forEach(function (kodeGol) {
        if (String(kodeGol).charAt(0) === digitTarget) {
          total += dataByCabang[cab][kodeGol];
        }
      });
      if (isPenjualan) total = total * -1;
      return total;
    });
  }

  var dataPenjualan = hitungSubTotalPerCabang("3", true);
  var dataHPP = hitungSubTotalPerCabang("4", false);
  var dataAdmUmum = hitungSubTotalPerCabang("5", false);
  var dataLain2 = hitungSubTotalPerCabang("6", false);

  var dataRL = dataPenjualan.map(function (val, index) {
    return val - dataHPP[index] - dataAdmUmum[index] - dataLain2[index];
  });

  // 1. Buka jendela baru
  var lebar = 900,
    tinggi = 600;
  var kiri = (screen.width - lebar) / 2,
    atas = (screen.height - tinggi) / 2;

  var winGrafik = window.open(
    "",
    "GrafikRLCabang",
    "width=" +
      lebar +
      ",height=" +
      tinggi +
      ",top=" +
      atas +
      ",left=" +
      kiri +
      ",resizable=yes,scrollbars=yes",
  );

  if (!winGrafik) {
    alert("Mohon izinkan pop-up pada browser Anda untuk melihat grafik.");
    return;
  }

  // 2. Isi struktur HTML dan panggil pustaka Chart.js di jendela baru
  winGrafik.document.open();
  winGrafik.document
    .write(`<!DOCTYPE html><html><head><title>Grafik R/L Gabungan Per Cabang</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <style>body{margin:0;padding:20px;font-family:sans-serif;background-color:#f8f9fa;} .container{width:100%;height:calc(100vh - 40px);background:#ffffff;padding:15px;box-sizing:border-box;border-radius:8px;box-shadow:0 0 10px rgba(0,0,0,0.1);}</style>
    </head><body><div class="container"><canvas id="chart_rlgab_cabang_baru"></canvas></div></body></html>`);
  winGrafik.document.close();

  // 3. Gambar chart setelah jendela baru selesai dimuat
  winGrafik.onload = function () {
    var ctx = winGrafik.document
      .getElementById("chart_rlgab_cabang_baru")
      .getContext("2d");
    var formatUangLokal =
      typeof formatUang === "function"
        ? formatUang
        : function (val) {
            return val.toLocaleString("id-ID");
          };

    new winGrafik.Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "PENJUALAN BERSIH",
            data: dataPenjualan,
            borderColor: "#1f7a43",
            backgroundColor: "rgba(31, 122, 67, 0.7)",
            borderWidth: 1,
          },
          {
            label: "TOTAL HPP",
            data: dataHPP,
            borderColor: "#0d6efd",
            backgroundColor: "rgba(13, 110, 253, 0.7)",
            borderWidth: 1,
          },
          {
            label: "TOTAL BY. ADM & UMUM",
            data: dataAdmUmum,
            borderColor: "#dc3545",
            backgroundColor: "rgba(220, 53, 69, 0.7)",
            borderWidth: 1,
          },
          {
            label: "TOTAL PEND & BY LAIN2",
            data: dataLain2,
            borderColor: "#ffc107",
            backgroundColor: "rgba(255, 193, 7, 0.7)",
            borderWidth: 1,
          },
          {
            label: "LABA / RUGI BERSIH (RL)",
            data: dataRL,
            borderColor: "#B8860B",
            backgroundColor: "rgba(255, 215, 0, 0.7)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#333", font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (context) =>
                context.dataset.label +
                ": " +
                formatUangLokal(context.parsed.y),
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: "#333",
              callback: (value) => formatUangLokal(value),
            },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          x: { ticks: { color: "#333" }, grid: { display: false } },
        },
      },
    });
  };
}

// ==========================================
// FUNGSI AKSI TOMBOL LIHAT GRAFIK
// ==========================================
function lihatGrafikRLGabungan() {
  if (
    !window._rlGabunganData ||
    !window._rlGabunganData.daftarCabang ||
    window._rlGabunganData.daftarCabang.length === 0
  ) {
    if (typeof toast === "function")
      toast("Silakan klik 'Terapkan' terlebih dahulu untuk memuat data", "wrn");
    return;
  }

  // Ambil data lalu kirim ke fungsi pembuka jendela baru
  var d = window._rlGabunganData;
  renderGrafikRLGabungan(d.daftarCabang, d.dataByCabang, d.mapMasterCab);
}

PANEL_MAP.arusKas = renderArusKasGabungan;
function renderArusKasGabungan() {
  if (typeof window._rlGabFilterMasa === "undefined") {
    var d = new Date();
    var bln = ("0" + (d.getMonth() + 1)).slice(-2);
    window._rlGabFilterMasa = bln + "-" + d.getFullYear();
  }

  var partMasa = window._rlGabFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];
  var inputMonthValue = filterTahunFull + "-" + filterBulan;

  // PERBAIKAN: Tag area_grafik_rlgab dan canvas yang tidak dipakai di halaman utama sudah dihapus
  var htmlLaporan =
    '<div id="area_cetak_rlgab" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:visible;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan Arus Kas Gabungan (Semua Cabang)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    '<div style="font-size:.8rem; font-weight:bold; color:var(--fg);">🔍 PILIHAN TAMPILAN:</div>' +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Masa:</label>' +
    '<input type="month" id="filter_aruskas_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiArusKasGabungan()">Terapkan</button>' +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadExcelArusKasGabungan()"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    "</div>" +
    "</div>" +
    '<div id="tempat_tabel_rlgab" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data. <i>(Klik nama cabang untuk melihat RL Lebar 12 Bulan)</i></p>' +
    "</div>";

  return htmlLaporan;
}
// ==========================================
// FUNGSI DOWNLOAD KE EXCEL
// ==========================================
function downloadExcelArusKasGabungan() {
  if (!window._rlGabunganData || !window._rlGabFilterMasa) {
    if (typeof toast === "function")
      toast("Tidak ada data untuk diunduh", "err");
    return;
  }

  var data = window._rlGabunganData;
  var htmlExcel = generateHTMLArusKasGabungan(
    data.daftarCabang,
    data.arrKodeGol,
    data.dataByCabang,
    data.mapMasterGol,
    data.mapMasterCab,
    true, // <-- isForExcel = true
    window._rlGabTotalSaldoAwal || {},
    window._rlGabMapPerkiraan || [],
  );

  // Buat full HTML wrapper untuk Excel
  var fullHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>Arus Kas Gabungan</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        table { border-collapse: collapse; mso-number-format:"\\@"; }
        td, th { mso-number-format:"\\@"; padding: 5px; border: 1px solid #000; }
        .num { mso-number-format:"#,##0.00"; text-align: right; }
        th { background-color: #f4f4f4; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2 style="text-align:center;">LAPORAN ARUS KAS GABUNGAN</h2>
      <h3 style="text-align:center;">Masa: ${window._rlGabFilterMasa}</h3>
      ${htmlExcel}
    </body>
    </html>
  `;

  // Download file
  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download =
    "ArusKas_Gabungan_" + window._rlGabFilterMasa.replace(/-/g, "") + ".xls";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  if (typeof toast === "function") toast("File Excel berhasil diunduh!", "ok");
}

// ==========================================
// FUNGSI ARUS KAS PER BULAN (Per Cabang)
// ==========================================
async function tampilkanArusKasPerCabangSD(kodeCabang) {
  if (!window._rlGabFilterMasa) {
    if (typeof toast === "function") toast("Data belum dimuat", "err");
    return;
  }

  var areaTabel = document.getElementById("tempat_tabel_rlgab");

  if (areaTabel) {
    areaTabel.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 Memuat data cabang ' +
      kodeCabang +
      "...</div>";
  }

  try {
    var valmasa = window._rlGabFilterMasa; // format: "MM-YYYY"
    var part = valmasa.split("-");
    var filtertahunfull = part[0];
    var filterbulan = part[1];
    var duadigittahunbelakang = filtertahunfull.substring(2, 4);
    var kodemasadicari = filterbulan + duadigittahunbelakang;
    var namastoregolbackup = "golongan" + filtertahunfull;

    // DAFTAR BULAN UNTUK KOLOM (Dari Januari sampai bulan filter)
    var bulanLabels = [
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
    var bulanFilterInt = parseInt(filterbulan, 10);
    var arrBulan = [];
    for (var i = 1; i <= bulanFilterInt; i++) {
      arrBulan.push({
        kode: (i < 10 ? "0" + i : "" + i) + duadigittahunbelakang,
        label: bulanLabels[i],
        angka: i,
      });
    }

    // 1. AMBIL MASTER GOLONGAN
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namaGol || m.nama || "").trim();
        if (kode) mapMasterGol[kode] = nama;
      });
    }

    // 2. AMBIL MASTER CABANG
    var rawMasterCab = await db.getAll("cabang");
    var mapMasterCab = {};
    if (rawMasterCab) {
      var arrMasterCab = Array.isArray(rawMasterCab)
        ? rawMasterCab
        : Object.values(rawMasterCab);
      arrMasterCab.forEach(function (c) {
        var kode = String(c.kode_cabang || c.kode || c.cab || "").trim();
        var nama = String(c.nama_cabang || c.nama || c.cabang || "").trim();
        if (kode && nama) mapMasterCab[kode] = nama;
      });
    }

    // 3. AMBIL DATA GOLONGAN TAHUNAN
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    // 4. SUSUN STRUKTUR DATA PER BULAN
    // Format: dataPerBulan[golongan][kodeMasa] = saldo
    var dataPerBulan = {};
    var setKodeGol = new Set();

    rawdatagolongan.forEach(function (g) {
      var kodeGol = String(g.gol || g.golongan || "").trim();
      var cabangData = String(g.cabang || g.cab || g.kode_cabang || "").trim();
      var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

      // FILTER HANYA UNTUK CABANG YANG DIPILIH
      if (cabangData !== kodeCabang) return;

      // HANYA GOLONGAN ARUS KAS (102 < x < 300)
      if (parseInt(kodeGol) <= 102 || parseInt(kodeGol) >= 300) return;

      // PASTIKAN MASANYA MASIH DALAM TAHUN YANG SAMA DAN TIDAK MELEBIHI BULAN FILTER
      if (masaData > kodemasadicari) return;
      if (masaData.slice(-2) !== duadigittahunbelakang) return;

      setKodeGol.add(kodeGol);

      if (!dataPerBulan[kodeGol]) dataPerBulan[kodeGol] = {};
      if (!dataPerBulan[kodeGol][masaData]) dataPerBulan[kodeGol][masaData] = 0;

      var saldoAkhir = -+(g.db || 0) + (g.cr || 0);
      dataPerBulan[kodeGol][masaData] += saldoAkhir;
    });

    var arrKodeGol = Array.from(setKodeGol).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });

    // 5. HITUNG SALDO AWAL KAS (Golongan 100-102 di bulan Januari)
    var kodemasasebelumnya = "01" + duadigittahunbelakang;
    var totalSaldoAwal = 0;

    rawdatagolongan.forEach(function (s) {
      var kodeGol = String(s.gol || s.golongan || "").trim();
      var cabangData = String(s.cabang || s.cab || s.kode_cabang || "").trim();
      var masaData = String(s.masa || s.periode || s.kode_masa || "").trim();

      if (cabangData !== kodeCabang) return;
      if (parseInt(kodeGol) > 102) return; // Hanya Kas/Bank
      if (masaData === kodemasasebelumnya) {
        totalSaldoAwal += +(s.awal || 0);
      }
    });

    // 6. AMBIL MUTASI KAS/BANK PER BULAN (Golongan 100-102)
    var namaStorePerkTahun = "perkiraan" + filtertahunfull;
    var sumberData =
      typeof DBCache !== "undefined" &&
      DBCache[namaStorePerkTahun] &&
      Array.isArray(DBCache[namaStorePerkTahun])
        ? DBCache[namaStorePerkTahun]
        : [];

    if (sumberData.length === 0) {
      try {
        var rawPerkTahun = await db.getAll(namaStorePerkTahun);
        if (rawPerkTahun) {
          sumberData = Array.isArray(rawPerkTahun)
            ? rawPerkTahun
            : Object.values(rawPerkTahun);
          if (typeof DBCache === "undefined") window.DBCache = {};
          DBCache[namaStorePerkTahun] = sumberData;
        }
      } catch (e) {
        console.log("Gagal ambil master perkiraan tahun");
      }
    }

    // Kelompokkan saldo kas per bulan
    var mapKasPerBulan = {};
    arrBulan.forEach(function (b) {
      mapKasPerBulan[b.kode] = 0;
    });

    sumberData.forEach(function (mp) {
      var nPerk = String(mp.noPerk || "").trim();
      var nMasa = String(mp.masa || mp.periode || mp.kode_masa || "").trim();
      var nSaldo = mp.hasOwnProperty("akhir")
        ? parseFloat(mp.akhir)
        : parseFloat(mp.saldoAkhir || mp.saldo_akhir || 0);
      var nCabang = String(
        mp.cabang || mp.cab || mp.kode_cabang || "GABUNGAN",
      ).trim();

      var perkBersih = nPerk.replace(/[^0-9]/g, "");
      if (perkBersih.length === 0) return;
      var kepalaPerk = perkBersih.substring(0, 3);

      if (
        (kepalaPerk === "100" ||
          kepalaPerk === "101" ||
          kepalaPerk === "102") &&
        nCabang === kodeCabang
      ) {
        if (mapKasPerBulan.hasOwnProperty(nMasa)) {
          mapKasPerBulan[nMasa] += nSaldo;
        }
      }
    });

    // Simpan untuk keperluan download Excel
    window._rlPerCabangData = {
      kodeCabang: kodeCabang,
      arrKodeGol: arrKodeGol,
      arrBulan: arrBulan,
      dataPerBulan: dataPerBulan,
      mapMasterGol: mapMasterGol,
      mapMasterCab: mapMasterCab,
      totalSaldoAwal: totalSaldoAwal,
      mapKasPerBulan: mapKasPerBulan,
      filterMasa: valmasa,
    };

    // 7. RENDER HTML TABLE
    var namaCabTampil = mapMasterCab[kodeCabang] || kodeCabang;
    var htmlOutput = "";

    // Tombol Aksi
    htmlOutput +=
      '<div style="display:flex; gap:10px; margin-bottom:15px; align-items:center; flex-wrap:wrap;">';
    htmlOutput +=
      '<button onclick="kembaliKeGabungan()" style="padding:8px 16px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">⬅ Kembali</button>';
    htmlOutput +=
      '<button onclick="downloadExcelArusKasPerCabangBulanan()" style="padding:8px 16px; background:#198754; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📥 Download Excel</button>';
    htmlOutput +=
      '<span style="font-weight:bold; font-size:1.1rem; color:#004085;">ARUS KAS PER BULAN - CABANG: ' +
      namaCabTampil +
      " | TAHUN: " +
      filtertahunfull +
      "</span>";
    htmlOutput += "</div>";

    // Membuat Tabel Baru Khusus Per Bulan
    htmlOutput +=
      '<div style="overflow-x:auto; border:1px solid #ccc; border-radius:5px;">';
    htmlOutput +=
      '<table class="table table-bordered table-sm" style="font-size:0.85rem; margin-bottom:0; white-space:nowrap;">';

    // THEAD
    htmlOutput += '<thead class="table-dark text-center"><tr>';
    htmlOutput +=
      '<th style="min-width:250px; text-align:left;">Uraian Arus Kas</th>';
    arrBulan.forEach(function (b) {
      htmlOutput += '<th style="min-width:120px;">' + b.label + "</th>";
    });
    htmlOutput +=
      '<th style="min-width:120px; background:#ffc107 !important; color:#000 !important;">TOTAL</th>';
    htmlOutput += "</tr></thead>";

    // TBODY
    htmlOutput += "<tbody>";

    // Baris Saldo Awal Kas
    htmlOutput += '<tr style="font-weight:bold; background-color:#e9ecef;">';
    htmlOutput += "<td>Saldo Awal Kas & Bank</td>";
    htmlOutput += "<td>" + formatRupiah(totalSaldoAwal) + "</td>";
    for (var i = 1; i < arrBulan.length; i++) {
      htmlOutput += '<td style="color:#aaa;">-</td>';
    }
    htmlOutput +=
      '<td style="background:#fff3cd;">' +
      formatRupiah(totalSaldoAwal) +
      "</td>";
    htmlOutput += "</tr>";

    // Baris Golongan Arus Kas
    arrKodeGol.forEach(function (kodeGol) {
      var namaGol = mapMasterGol[kodeGol] || "GOL " + kodeGol;
      var totalGol = 0;

      htmlOutput += "<tr>";
      htmlOutput +=
        '<td style="padding-left:20px;">' + kodeGol + " - " + namaGol + "</td>";

      arrBulan.forEach(function (b) {
        var val =
          dataPerBulan[kodeGol] && dataPerBulan[kodeGol][b.kode]
            ? dataPerBulan[kodeGol][b.kode]
            : 0;
        totalGol += val;
        htmlOutput += '<td class="text-end">' + formatRupiah(val) + "</td>";
      });

      htmlOutput +=
        '<td class="text-end" style="font-weight:bold; background:#fff3cd;">' +
        formatRupiah(totalGol) +
        "</td>";
      htmlOutput += "</tr>";
    });

    // Baris Saldo Akhir Kas Per Bulan
    htmlOutput +=
      '<tr style="font-weight:bold; background-color:#d1e7dd; border-top:2px solid #000;">';
    htmlOutput += "<td>Saldo Akhir Kas & Bank</td>";

    var totalAkhirKeseluruhan = 0;
    var saldoBerjalan = totalSaldoAwal;

    arrBulan.forEach(function (b, index) {
      // Saldo Berjalan = Saldo Awal + Total Arus Kas (Gol > 102) + Mutasi Kas itu sendiri (Gol 100-102)
      // Catatan: Jika Gol 100-102 sudah masuk ke dataPerBulan, maka cukup jumlahkan semua gol.
      // Namun karena di filter AWAL kita skip gol 100-102, kita tambahkan mapKasPerBulan secara terpisah.

      var totalArusBulanIni = 0;
      arrKodeGol.forEach(function (gol) {
        totalArusBulanIni +=
          dataPerBulan[gol] && dataPerBulan[gol][b.kode]
            ? dataPerBulan[gol][b.kode]
            : 0;
      });

      var mutasiKasBulanIni = mapKasPerBulan[b.kode] || 0;

      // Logika penjumlahan disesuaikan dengan bagaimana system anda menghitung arus kas
      saldoBerjalan = saldoBerjalan + totalArusBulanIni;
      totalAkhirKeseluruhan = saldoBerjalan;

      htmlOutput +=
        '<td class="text-end">' + formatRupiah(saldoBerjalan) + "</td>";
    });

    htmlOutput +=
      '<td class="text-end" style="background:#fff3cd; font-size:1rem;">' +
      formatRupiah(totalAkhirKeseluruhan) +
      "</td>";
    htmlOutput += "</tr>";

    htmlOutput += "</tbody></table></div>";

    if (areaTabel) {
      areaTabel.innerHTML = htmlOutput;
    }
  } catch (error) {
    console.error("❌ Gagal memuat RL Per Cabang:", error);
    if (areaTabel)
      areaTabel.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}

// Helper format Rupiah (Jika belum ada di file Anda)
function formatRupiah(angka) {
  if (isNaN(angka)) return "0";
  var number = parseFloat(angka);
  var formatted = number.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,");
  return formatted;
}
// ==========================================
// FUNGSI KEMBALI KE GABUNGAN
// ==========================================
function kembaliKeGabungan() {
  if (window._rlGabunganData) {
    var data = window._rlGabunganData;
    var areaTabel = document.getElementById("tempat_tabel_rlgab");
    if (areaTabel) {
      // Tombol download gabungan
      var htmlTombol =
        '<div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">';
      htmlTombol +=
        '<button onclick="downloadExcelArusKasGabungan()" style="padding:8px 16px; background:#198754; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📥 Download Excel Gabungan</button>';
      htmlTombol +=
        '<span style="font-weight:bold; font-size:1.1rem; color:#004085;">ARUS KAS GABUNGAN - MASA: ' +
        window._rlGabFilterMasa +
        "</span>";
      htmlTombol += "</div>";

      areaTabel.innerHTML =
        htmlTombol +
        generateHTMLArusKasGabungan(
          data.daftarCabang,
          data.arrKodeGol,
          data.dataByCabang,
          data.mapMasterGol,
          data.mapMasterCab,
          false,
          window._rlGabTotalSaldoAwal || {},
          window._rlGabMapPerkiraan || [],
        );
    }
  } else {
    // Jika data belum ada, panggil ulang fungsi utama
    terapkanOpsiArusKasGabungan();
  }
}

// ==========================================
// FUNGSI DOWNLOAD EXCEL PER CABANG
// ==========================================
function downloadExcelArusKasPerCabang() {
  if (!window._rlPerCabangData) {
    if (typeof toast === "function")
      toast("Tidak ada data untuk diunduh", "err");
    return;
  }

  var data = window._rlPerCabangData;
  var htmlExcel = generateHTMLArusKasGabungan(
    data.daftarCabang,
    data.arrKodeGol,
    data.dataByCabang,
    data.mapMasterGol,
    data.mapMasterCab,
    true,
    data.totalSaldoAwalByCabang,
    data.mapPerkiraanDifilter,
  );

  var namaCab = data.mapMasterCab[data.kodeCabang] || data.kodeCabang;

  var fullHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>Arus Kas ${namaCab}</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        table { border-collapse: collapse; mso-number-format:"\\@"; }
        td, th { mso-number-format:"\\@"; padding: 5px; border: 1px solid #000; }
        .num { mso-number-format:"#,##0.00"; text-align: right; }
        th { background-color: #f4f4f4; font-weight: bold; }
      </style>
    </head>
    <body>
      <h2 style="text-align:center;">LAPORAN ARUS KAS PER BULAN</h2>
      <h3 style="text-align:center;">Cabang: ${namaCab} (${data.kodeCabang})</h3>
      <h3 style="text-align:center;">Masa: ${data.filterMasa}</h3>
      ${htmlExcel}
    </body>
    </html>
  `;

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download =
    "ArusKas_" +
    namaCab.replace(/\s+/g, "_") +
    "_" +
    data.filterMasa.replace(/-/g, "") +
    ".xls";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  if (typeof toast === "function") toast("File Excel berhasil diunduh!", "ok");
}

// ==========================================
// FUNGSI UTAMA (UPDATE - SIMPAN DATA GLOBAL)
// ==========================================
async function terapkanOpsiArusKasGabungan() {
  var inputmasa = document.getElementById("filter_aruskas_masa");
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
    // 1. AMBIL MASTER GOLONGAN
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namaGol || m.nama || "").trim();
        if (kode) mapMasterGol[kode] = nama;
      });
    }

    // 2. AMBIL MASTER CABANG
    var rawMasterCab = await db.getAll("cabang");
    var mapMasterCab = {};
    var setValidCabang = new Set();
    if (rawMasterCab) {
      var arrMasterCab = Array.isArray(rawMasterCab)
        ? rawMasterCab
        : Object.values(rawMasterCab);
      arrMasterCab.forEach(function (c) {
        var kode = String(c.kode_cabang || c.kode || c.cab || "").trim();
        var nama = String(c.nama_cabang || c.nama || c.cabang || "").trim();
        if (kode && nama) {
          mapMasterCab[kode] = nama;
          setValidCabang.add(kode);
        }
      });
    }

    // 3. AMBIL DATA GOLONGAN TAHUNAN
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];
    var dataByCabang = {};

    // 4. PROSES DATA
    var tahunDicari = kodemasadicari.slice(-2);

    rawdatagolongan.forEach(function (g) {
      var kodeGol = String(g.gol || g.golongan || "").trim();
      var cabangData = String(g.cabang || g.cab || g.kode_cabang || "").trim();
      var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

      if (!setValidCabang.has(cabangData)) return;

      var tahunData = masaData.slice(-2);

      if (
        kodeGol > 102 &&
        kodeGol < 300 &&
        tahunData === tahunDicari &&
        masaData <= kodemasadicari
      ) {
        if (!dataByCabang[cabangData]) dataByCabang[cabangData] = {};
        if (!dataByCabang[cabangData][kodeGol])
          dataByCabang[cabangData][kodeGol] = 0;

        var saldoAkhir = -+(g.db || 0) + (g.cr || 0);
        dataByCabang[cabangData][kodeGol] += saldoAkhir;
      }
    });

    // 5. SUSUN BARIS DAN KOLOM TABEL
    var daftarCabang = Object.keys(dataByCabang).sort();
    var setKodeGol = new Set();
    daftarCabang.forEach(function (cab) {
      Object.keys(dataByCabang[cab]).forEach(function (gol) {
        setKodeGol.add(gol);
      });
    });
    var arrKodeGol = Array.from(setKodeGol).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });
    arrKodeGol = arrKodeGol.filter(function (kodeGol) {
      var totalSemuaCabang = 0;
      daftarCabang.forEach(function (cab) {
        totalSemuaCabang += dataByCabang[cab][kodeGol] || 0;
      });
      return totalSemuaCabang !== 0;
    });

    // 6. HITUNG TOTAL SALDO AWAL
    var tahunInt = parseInt(filtertahunfull);
    var tahunDuaDigit = String(tahunInt).substring(2, 4);
    var kodemasasebelumnya = "01" + tahunDuaDigit;
    var totalSaldoAwalByCabang = {};

    if (rawdatagolongan && rawdatagolongan.length > 0) {
      rawdatagolongan.forEach(function (s) {
        var kodeGol = String(s.gol || s.golongan || "").trim();
        var cabangData = String(
          s.cabang || s.cab || s.kode_cabang || "",
        ).trim();
        var masaData = String(s.masa || s.periode || s.kode_masa || "").trim();

        if (!setValidCabang.has(cabangData)) return;

        if (parseInt(kodeGol) < 103 && masaData === kodemasasebelumnya) {
          if (totalSaldoAwalByCabang[cabangData] === undefined) {
            totalSaldoAwalByCabang[cabangData] = 0;
          }
          totalSaldoAwalByCabang[cabangData] += +(s.awal || 0);
        }
      });
    }

    // 7. AMBIL & FILTER DATA KAS/BANK
    var namaStorePerkTahun = "perkiraan" + filtertahunfull;
    var sumberData =
      typeof DBCache !== "undefined" &&
      DBCache[namaStorePerkTahun] &&
      Array.isArray(DBCache[namaStorePerkTahun])
        ? DBCache[namaStorePerkTahun]
        : [];

    if (sumberData.length === 0) {
      try {
        var rawPerkTahun = await db.getAll(namaStorePerkTahun);
        if (rawPerkTahun) {
          sumberData = Array.isArray(rawPerkTahun)
            ? rawPerkTahun
            : Object.values(rawPerkTahun);
          if (typeof DBCache === "undefined") window.DBCache = {};
          DBCache[namaStorePerkTahun] = sumberData;
        }
      } catch (e) {
        console.log("Gagal ambil master perkiraan tahun");
      }
    }

    var mapPerkiraanDifilter = sumberData
      .filter(function (mp) {
        var nPerk = String(mp.noPerk || "").trim();
        var nNama = String(mp.desc || mp.namaPerkiraan || "").trim();
        var nMasa = String(mp.masa || mp.periode || mp.kode_masa || "").trim();
        var nSaldo = mp.hasOwnProperty("akhir")
          ? parseFloat(mp.akhir)
          : parseFloat(mp.saldoAkhir || mp.saldo_akhir || 0);
        var nCabang = String(
          mp.cabang || mp.cab || mp.kode_cabang || "GABUNGAN",
        ).trim();
        var perkBersih = nPerk.replace(/[^0-9]/g, "");
        if (perkBersih.length === 0) return false;
        var kepalaPerk = perkBersih.substring(0, 3);
        return (
          (kepalaPerk === "100" ||
            kepalaPerk === "101" ||
            kepalaPerk === "102") &&
          nMasa === kodemasadicari
        );
      })
      .map(function (mp) {
        var nPerk = String(mp.noPerk || "").trim();
        var nNama = String(mp.desc || mp.namaPerkiraan || "").trim();
        var nMasa = String(mp.masa || mp.periode || mp.kode_masa || "").trim();
        var nSaldo = mp.hasOwnProperty("akhir")
          ? parseFloat(mp.akhir)
          : parseFloat(mp.saldoAkhir || mp.saldo_akhir || 0);
        var nCabang = String(
          mp.cabang || mp.cab || mp.kode_cabang || "GABUNGAN",
        ).trim();
        var perkBersih = nPerk.replace(/[^0-9]/g, "");
        var kepalaPerk = perkBersih.substring(0, 3);
        return {
          noPerk: nPerk,
          nama: nNama,
          masa: nMasa,
          saldo: nSaldo,
          cabang: nCabang,
          golongan: kepalaPerk,
        };
      });

    // ✅ SIMPAN DATA KE GLOBAL untuk fungsi lain
    window._rlGabunganData = {
      daftarCabang,
      arrKodeGol,
      dataByCabang,
      mapMasterGol,
      mapMasterCab,
    };
    window._rlGabTotalSaldoAwal = totalSaldoAwalByCabang;
    window._rlGabMapPerkiraan = mapPerkiraanDifilter;

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

    // Tombol download di atas tabel
    var htmlTombol =
      '<div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">';
    htmlTombol +=
      // '<button onclick="downloadExcelArusKasGabungan()" style="padding:8px 16px; background:#198754; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📥 Download Excel Gabungan</button>';
      htmlTombol +=
        // '<span style="font-weight:bold; font-size:1.1rem; color:#004085;">ARUS KAS GABUNGAN - MASA: ' +
        window._rlGabFilterMasa + "</span>";
    htmlTombol += "</div>";

    area.innerHTML =
      htmlTombol +
      generateHTMLArusKasGabungan(
        daftarCabang,
        arrKodeGol,
        dataByCabang,
        mapMasterGol,
        mapMasterCab,
        false,
        totalSaldoAwalByCabang,
        mapPerkiraanDifilter,
      );
  } catch (error) {
    console.error("❌ Gagal total RL Gabungan:", error);
    if (area)
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}

// ==========================================
// FUNGSI GENERATE HTML (TETAP SAMA + X:NUM UNTUK EXCEL)
// ==========================================
function generateHTMLArusKasGabungan(
  daftarCabang,
  arrKodeGol,
  dataByCabang,
  mapMasterGol,
  mapMasterCab,
  isForExcel,
  totalSaldoAwalByCabang,
  mapPerkiraanDifilter,
) {
  var html =
    '<div id="area_tabel_gabungan" style="width: 100%; overflow-x: auto; border: 1px solid #131010;"><table border="1" style="width:100%; min-width: 600px; border-collapse: collapse; text-align:left; color:#000; border: 1px solid #000;">';
  html += '<thead style="background:#f4f4f4; font-weight:bold;"><tr>';
  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000;">GOL / NO PERK</th>';
  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000;">NAMA PERKIRAAN</th>';

  daftarCabang.forEach(function (cab) {
    var namaTampil = mapMasterCab[cab] || cab;
    if (!isForExcel) {
      html +=
        '<th style="padding:10px; border:1px solid #000; text-align:center; background-color:#000000;"><span class="link-cabang-rl" style="color:#00D2FF; text-decoration:underline; cursor:pointer;" onclick="tampilkanArusKasPerCabangSD(\'' +
        cab.replace(/'/g, "\\'") +
        "')\">" +
        namaTampil +
        "</span></th>";
    } else {
      html +=
        '<th style="padding:10px; border:1px solid #000; text-align:center; background-color:#d9e1f2;">' +
        namaTampil +
        "</th>";
    }
  });

  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000; text-align:center; background-color:#d9e1f2; color:#004085; font-weight:bold;">TOTAL</th>';
  html += "</tr><tr></tr></thead><tbody>";

  var arrPemasukan = [];
  var arrPengeluaran = [];

  arrKodeGol.forEach(function (kodeGol) {
    var totalSemuaCabang = 0;
    daftarCabang.forEach(function (cab) {
      totalSemuaCabang += dataByCabang[cab][kodeGol] || 0;
    });
    if (totalSemuaCabang > 0) arrPemasukan.push(kodeGol);
    else if (totalSemuaCabang < 0) arrPengeluaran.push(kodeGol);
  });

  // --- HELPER FUNCTIONS ---
  function buatBarisSubtotal(
    namaGroup,
    arrGroup,
    tipeHitung,
    customColor,
    isKasBank,
  ) {
    var color = customColor || "#0a58ca";
    var htmlSub =
      '<tr style="font-weight:bold; background-color:#f8f9fa !important;"><td colspan="2" style="padding:8px; border:1px solid #000; text-align:right; color:' +
      color +
      ' !important; background-color:#f8f9fa !important;">SUBTOTAL ' +
      namaGroup +
      "</td>";
    var grandTotal = 0;
    daftarCabang.forEach(function (cab) {
      var totalCab = 0;
      if (isKasBank) {
        arrGroup.forEach(function (item) {
          if (item.cabang === cab) totalCab += item.saldo || 0;
        });
      } else {
        arrGroup.forEach(function (key) {
          totalCab += dataByCabang[cab][key] || 0;
        });
      }
      grandTotal += totalCab;
      htmlSub +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; color:' +
        color +
        ' !important; background-color:#f8f9fa !important;">' +
        formatUang(totalCab) +
        "</td>";
    });
    htmlSub +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:' +
      color +
      ' !important; background-color:#f8f9fa !important;">' +
      formatUang(grandTotal) +
      "</td></tr>";
    return htmlSub;
  }

  function buatBarisData(key, tipeHitung) {
    var nama = mapMasterGol[key] || "-";
    var htmlRow = '<tr style="font-size: 0.85rem;">';
    htmlRow +=
      '<td style="padding:8px; border:1px solid #000; text-align:center; font-weight:bold;">' +
      key +
      "</td>";
    htmlRow +=
      '<td style="padding:8px; border:1px solid #000;">' + nama + "</td>";
    var totalRow = 0;
    daftarCabang.forEach(function (cab) {
      var saldo = dataByCabang[cab][key] || 0;
      totalRow += saldo;
      var xNum = isForExcel ? ' x:num="' + saldo + '"' : "";
      htmlRow +=
        '<td style="padding:8px; border:1px solid #000; text-align:right;"' +
        xNum +
        ">" +
        formatUang(saldo) +
        "</td>";
    });
    var xNumTotal = isForExcel ? ' x:num="' + totalRow + '"' : "";
    htmlRow +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; font-weight:bold;"' +
      xNumTotal +
      ">" +
      formatUang(totalRow) +
      "</td></tr>";
    return htmlRow;
  }

  function hitungTotalGlobal(arrGroup, tipeHitung, isKasBank) {
    var grandTotal = 0;
    daftarCabang.forEach(function (cab) {
      if (isKasBank) {
        arrGroup.forEach(function (item) {
          if (item.cabang === cab) grandTotal += item.saldo || 0;
        });
      } else {
        arrGroup.forEach(function (key) {
          grandTotal += dataByCabang[cab][key] || 0;
        });
      }
    });
    return grandTotal;
  }

  // ==========================================
  // 1. RENDER PEMASUKAN
  // ==========================================
  html +=
    "<tr><td colspan='" +
    (daftarCabang.length + 3) +
    "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#d1e7dd; color:#0f5132;'>PEMASUKAN</td></tr>";

  html +=
    '<tr style="font-size: 0.85rem; background-color:#000000; color:#ffffff;"><td style="padding:8px; border:1px solid #fff; text-align:center; font-weight:bold;">-</td><td style="padding:8px; border:1px solid #fff; font-weight:bold;">SALDO AWAL</td>';
  var saTotalGlobal = 0;
  daftarCabang.forEach(function (cab) {
    var saCab = totalSaldoAwalByCabang[cab] || 0;
    saTotalGlobal += saCab;
    var xNum = isForExcel ? ' x:num="' + saCab + '"' : "";
    html +=
      '<td style="padding:8px; border:1px solid #fff; text-align:right;"' +
      xNum +
      ">" +
      formatUang(saCab) +
      "</td>";
  });
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; font-weight:bold;">' +
    formatUang(saTotalGlobal) +
    "</td></tr>";

  if (arrPemasukan.length > 0) {
    arrPemasukan.forEach(function (key) {
      html += buatBarisData(key, "rl");
    });
  }

  var stPemTotal = 0;
  html +=
    '<tr style="font-weight:bold; background-color:#f8f9fa !important;"><td colspan="2" style="padding:8px; border:1px solid #000; text-align:right; color:#0f5132 !important; background-color:#f8f9fa !important;">SUBTOTAL PEMASUKAN</td>';
  daftarCabang.forEach(function (cab) {
    var stCab = totalSaldoAwalByCabang[cab] || 0;
    arrPemasukan.forEach(function (g) {
      stCab += dataByCabang[cab][g] || 0;
    });
    stPemTotal += stCab;
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:#0f5132 !important; background-color:#f8f9fa !important;">' +
      formatUang(stCab) +
      "</td>";
  });
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; color:#0f5132 !important; background-color:#f8f9fa !important;">' +
    formatUang(stPemTotal) +
    "</td></tr>";

  // ==========================================
  // 2. RENDER PENGELUARAN
  // ==========================================
  if (arrPengeluaran.length > 0) {
    html +=
      "<tr><td colspan='" +
      (daftarCabang.length + 3) +
      "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#f8d7da; color:#842029;'>PENGELUARAN</td></tr>";
    arrPengeluaran.forEach(function (key) {
      html += buatBarisData(key, "rl");
    });
    html += buatBarisSubtotal(
      "PENGELUARAN",
      arrPengeluaran,
      "rl",
      "#842029",
      false,
    );
  }

  // 3. SELISIH
  var totalPengeluaranG = hitungTotalGlobal(arrPengeluaran, "rl", false);
  var selisihGlobal = stPemTotal + totalPengeluaranG;
  var bgSelisih = selisihGlobal >= 0 ? "#198754" : "#dc3545";

  html +=
    "<tr style='background-color:" +
    bgSelisih +
    "; color:#fff;'><td colspan='2' style='padding:10px; border:1px solid #000; text-align:right;'>SELISIH</td>";
  var selGrandTotal = 0;
  daftarCabang.forEach(function (cab) {
    var selCab = totalSaldoAwalByCabang[cab] || 0;
    arrPemasukan.forEach(function (g) {
      selCab += dataByCabang[cab][g] || 0;
    });
    arrPengeluaran.forEach(function (g) {
      selCab += dataByCabang[cab][g] || 0;
    });
    selGrandTotal += selCab;
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right;">' +
      formatUang(selCab) +
      "</td>";
  });
  html +=
    '<td style="padding:10px; border:1px solid #000; text-align:right;">' +
    formatUang(selGrandTotal) +
    "</td></tr>";

  html +=
    '<tr><td colspan="' +
    (daftarCabang.length + 3) +
    '" style="height:15px; border:none; background:transparent;"></td></tr>';

  // ==========================================
  // 4. SALDO AKHIR KAS & BANK
  // ==========================================
  if (mapPerkiraanDifilter && mapPerkiraanDifilter.length > 0) {
    var mapNoPerkUnik = {};
    mapPerkiraanDifilter.forEach(function (item) {
      if (!mapNoPerkUnik[item.noPerk]) mapNoPerkUnik[item.noPerk] = item;
    });
    var arrNoPerkUnik = Object.keys(mapNoPerkUnik).sort();
    var adaDataKasBank = false;

    arrNoPerkUnik.forEach(function (noPerk) {
      var infoPerk = mapNoPerkUnik[noPerk];

      var totalRow = 0;
      daftarCabang.forEach(function (cab) {
        mapPerkiraanDifilter.forEach(function (item) {
          if (item.noPerk === noPerk && item.cabang === cab)
            totalRow += item.saldo || 0;
        });
      });

      if (totalRow === 0) return;

      if (!adaDataKasBank) {
        html +=
          "<tr><td colspan='" +
          (daftarCabang.length + 3) +
          "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#cce5ff; color:#004085;'>SALDO AKHIR KAS & BANK (NO PERK < 103)</td></tr>";
        adaDataKasBank = true;
      }

      html += '<tr style="font-size: 0.85rem;">';
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:center; font-weight:bold;">' +
        noPerk +
        "</td>";
      html +=
        '<td style="padding:8px; border:1px solid #000;">' +
        (infoPerk.nama || "-") +
        "</td>";

      totalRow = 0;
      daftarCabang.forEach(function (cab) {
        var saldo = 0;
        mapPerkiraanDifilter.forEach(function (item) {
          if (item.noPerk === noPerk && item.cabang === cab)
            saldo = item.saldo || 0;
        });
        totalRow += saldo;
        html +=
          '<td style="padding:8px; border:1px solid #000; text-align:right;">' +
          formatUang(saldo) +
          "</td>";
      });
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; font-weight:bold;">' +
        formatUang(totalRow) +
        "</td></tr>";
    });

    if (adaDataKasBank) {
      var subtotalKasBank = hitungTotalGlobal(
        mapPerkiraanDifilter,
        "kasbank",
        true,
      );
      if (subtotalKasBank !== 0) {
        html += buatBarisSubtotal(
          "KAS & BANK",
          mapPerkiraanDifilter,
          "kasbank",
          "#004085",
          true,
        );
      }
      html +=
        '<tr><td colspan="' +
        (daftarCabang.length + 3) +
        '" style="height:10px; border:none; background:transparent;"></td></tr>';
    }
  }

  // ==========================================
  // 5. GRAND TOTAL AKHIR
  // ==========================================
  var totalKasBankG = hitungTotalGlobal(mapPerkiraanDifilter, "kasbank", true);
  var grandTotalAkhir = selGrandTotal + totalKasBankG;

  html +=
    "<tr style='background-color:#343a40; color:#fff; font-weight:bold; font-size:1.1rem;'><td colspan='2' style='padding:12px; border:1px solid #000; text-align:right;'>TOTAL AKHIR</td>";
  var gtGrandTotal = 0;
  daftarCabang.forEach(function (cab) {
    var gtCab = totalSaldoAwalByCabang[cab] || 0;
    arrPemasukan.forEach(function (g) {
      gtCab += dataByCabang[cab][g] || 0;
    });
    arrPengeluaran.forEach(function (g) {
      gtCab += dataByCabang[cab][g] || 0;
    });

    mapPerkiraanDifilter.forEach(function (item) {
      if (item.cabang === cab) gtCab -= item.saldo || 0;
    });

    gtGrandTotal += gtCab;
    html +=
      '<td style="padding:12px; border:1px solid #000; text-align:right;">' +
      formatUang(gtCab) +
      "</td>";
  });
  html +=
    '<td style="padding:12px; border:1px solid #000; text-align:right;">' +
    formatUang(gtGrandTotal) +
    "</td></tr>";

  html += "</tbody></table></div>";
  return html;
}
