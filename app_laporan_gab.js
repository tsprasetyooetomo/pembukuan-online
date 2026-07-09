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
    '<input type="month" id="filter_rlgab_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiArusKasGabungan()">Terapkan</button>' +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadArusKasGabunganExcel()"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    '<button type="button" class="btn btn-s" style="font-size:.75rem; padding:4px 12px; background:#6f42c1; border-color:#6f42c1; color:#fff;" onclick="lihatGrafikAruskasGabungan()"><i class="fa-solid fa-chart-line"></i> Lihat Grafik</button>' +
    "</div>" +
    "</div>" +
    '<div id="tempat_tabel_rlgab" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data. <i>(Klik nama cabang untuk melihat RL Lebar 12 Bulan)</i></p>' +
    "</div>";

  return htmlLaporan;
}

async function terapkanOpsiArusKasGabungan() {
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

      if (kodeGol > 102 && kodeGol < 300 && masaData === kodemasadicari) {
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

    area.innerHTML = generateHTMLArusKasGabungan(
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
function generateHTMLArusKasGabungan(
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

  html +=
    '<th rowspan="2" style="padding:10px; border:1px solid #000; text-align:center; background-color:#d9e1f2; color:#00D2FF; font-weight:bold;">TOTAL</th>';
  html += "</tr><tr></tr></thead><tbody>";

  // ==========================================
  // LOGIKA BARU: KELOMPOKAN BERDASARKAN NILAI DB-CR
  // ==========================================

  var arrPemasukan = []; // Untuk nilai DB - CR < 0
  var arrPengeluaran = []; // Untuk nilai DB - CR > 0

  // 1. Hitung Total Setiap Golongan di SEMUA Cabang, lalu pisahkan ke 2 array
  arrKodeGol.forEach(function (kodeGol) {
    var totalSemuaCabang = 0;
    daftarCabang.forEach(function (cab) {
      totalSemuaCabang += dataByCabang[cab][kodeGol] || 0;
    });

    if (totalSemuaCabang < 0) {
      arrPemasukan.push(kodeGol);
    } else if (totalSemuaCabang > 0) {
      arrPengeluaran.push(kodeGol);
    }
  });

  // Helper Function: Membuat Baris Subtotal
  function buatBarisSubtotal(namaGroup, arrGroupGol) {
    var htmlSub =
      '<tr style="font-weight:bold; background-color:#ffffff !important; color:#0d6efd !important;">' +
      // Kunci warna biru (#0d6efd) langsung di tag TD tulisan SUBTOTAL agar tidak hilang
      '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right; color:#0d6efd !important; background-color:#ffffff !important;">SUBTOTAL ' +
      namaGroup +
      "</td>";
    var grandTotal = 0;

    daftarCabang.forEach(function (cab) {
      var totalCab = 0;
      arrGroupGol.forEach(function (gol) {
        totalCab += dataByCabang[cab][gol] || 0;
      });
      grandTotal += totalCab;

      htmlSub +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; color:#0d6efd !important;">' +
        formatUang(totalCab) +
        "</td>";
    });

    htmlSub +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:#0d6efd !important;">' +
      formatUang(grandTotal) +
      "</td></tr>";
    return htmlSub;
  }

  // Helper Function: Membuat Baris Data
  function buatBarisData(kodeGol) {
    var namaGol = mapMasterGol[kodeGol] || "-";
    var htmlRow = '<tr style="font-size: 0.85rem;">';
    htmlRow +=
      '<td style="padding:8px; border:1px solid #000; text-align:center; font-weight:bold;">' +
      kodeGol +
      "</td>";
    htmlRow +=
      '<td style="padding:8px; border:1px solid #000;">' + namaGol + "</td>";

    var totalRow = 0;
    daftarCabang.forEach(function (cab) {
      var saldo = dataByCabang[cab][kodeGol] || 0;
      totalRow += saldo;
      var xNum = isForExcel ? ' x:num="' + saldo + '"' : "";
      var colorStyle = saldo < 0 ? "color: red;" : "";
      htmlRow +=
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
    htmlRow +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; font-weight:bold; ' +
      colorTotal +
      '"' +
      xNumTotal +
      ">" +
      formatUang(totalRow) +
      "</td>";
    htmlRow += "</tr>";
    return htmlRow;
  }

  // 2. RENDER KELOMPOK PEMASUKAN
  if (arrPemasukan.length > 0) {
    html +=
      "<tr><td colspan='" +
      (daftarCabang.length + 3) +
      "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#d1e7dd; color:#0f5132;'>PEMASUKAN</td></tr>";
    arrPemasukan.forEach(function (kodeGol) {
      html += buatBarisData(kodeGol);
    });
    html += buatBarisSubtotal("PEMASUKAN", arrPemasukan);
  }

  // 3. RENDER KELOMPOK PENGELUARAN
  if (arrPengeluaran.length > 0) {
    html +=
      "<tr><td colspan='" +
      (daftarCabang.length + 3) +
      "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#f8d7da; color:#842029;'>PENGELUARAN</td></tr>";
    arrPengeluaran.forEach(function (kodeGol) {
      html += buatBarisData(kodeGol);
    });
    html += buatBarisSubtotal("PENGELUARAN", arrPengeluaran);
  }

  // 4. HITUNG DAN RENDER LABA / RUGI BERSIH
  if (arrPemasukan.length > 0 || arrPengeluaran.length > 0) {
    var totalPemasukan = 0;
    var totalPengeluaran = 0;

    arrPemasukan.forEach(function (gol) {
      daftarCabang.forEach(function (cab) {
        totalPemasukan += dataByCabang[cab][gol] || 0;
      });
    });

    arrPengeluaran.forEach(function (gol) {
      daftarCabang.forEach(function (cab) {
        totalPengeluaran += dataByCabang[cab][gol] || 0;
      });
    });

    var labaRugiBersih = totalPemasukan + totalPengeluaran;
    var namaHasil = labaRugiBersih >= 0 ? "SELISIH" : "SELISIH";
    var bgColor = labaRugiBersih >= 0 ? "#198754" : "#dc3545";
    var txtColor = "#ffffff";

    html +=
      "<tr style='background-color:" +
      bgColor +
      "; color:" +
      txtColor +
      "; font-weight:bold; font-size:1rem;'>";
    html +=
      '<td colspan="2" style="padding:10px; border:1px solid #000; text-align:right;">' +
      namaHasil +
      "</td>";

    // Hitung per cabang untuk kolom Laba/Rugi
    daftarCabang.forEach(function (cab) {
      var lrCab = 0;
      arrPemasukan.forEach(function (gol) {
        lrCab += dataByCabang[cab][gol] || 0;
      });
      arrPengeluaran.forEach(function (gol) {
        lrCab += dataByCabang[cab][gol] || 0;
      });
      var xNum = isForExcel ? ' x:num="' + lrCab + '"' : "";
      html +=
        '<td style="padding:10px; border:1px solid #000; text-align:right;"' +
        xNum +
        ">" +
        formatUang(lrCab) +
        "</td>";
    });

    var xNumTotal = isForExcel ? ' x:num="' + labaRugiBersih + '"' : "";
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right;"' +
      xNumTotal +
      ">" +
      formatUang(labaRugiBersih) +
      "</td>";
    html += "</tr>";
  }

  html += "</tbody></table></div>";
  return html;
}

function buatBarisSubtotalArusKas(
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

function hitungBarisArusKas(
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

async function downloadArusKasGabunganExcel() {
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
