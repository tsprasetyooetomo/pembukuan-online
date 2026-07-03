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

  // UBAH: height dan maxHeight dihapus, overflow dijadikan visible agar bisa menyesuaikan tinggi
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
    "</div>" +
    // UBAH: Area ini menjadi dinamis (bisa menampung tabel gabungan atau rl lebar)
    '<div id="tempat_tabel_rlgab" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    '<div id="area_grafik_rlgab" class="no-print" style="width:100%; max-width:1000px; height:400px; margin:2rem auto 0 auto; background:var(--bg2); border:1px solid var(--brd); border-radius:var(--r); padding:1rem; box-sizing:border-box; display:none;">' +
    '<canvas id="chart_rlgab_cabang"></canvas>' +
    "</div>" +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data. <i>(Klik nama cabang untuk melihat RL Lebar 12 Bulan)</i></p>' +
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

    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

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
        var saldoAkhir = +(g.db || 0) - +(g.cr || 0);
        dataByCabang[cabangData][kodeGol] += saldoAkhir;
      }
    });

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

    window._rlGabunganData = {
      daftarCabang: daftarCabang,
      arrKodeGol: arrKodeGol,
      dataByCabang: dataByCabang,
      mapMasterGol: mapMasterGol,
      mapMasterCab: mapMasterCab,
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
      mapMasterCab,
      false,
    );
    area.innerHTML = html;

    renderGrafikRLGabungan(daftarCabang, dataByCabang, mapMasterCab);
  } catch (error) {
    console.error("❌ Gagal total RL Gabungan:", error);
    if (area)
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}

async function renderGrafikRLGabungan(
  daftarCabang,
  dataByCabang,
  mapMasterCab,
) {
  var areaGrafik = document.getElementById("area_grafik_rlgab");
  if (!areaGrafik) return;

  if (typeof Chart === "undefined") {
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js";
    script.onload = function () {
      gambarChartNow(daftarCabang, dataByCabang, mapMasterCab, areaGrafik);
    };
    document.head.appendChild(script);
  } else {
    gambarChartNow(daftarCabang, dataByCabang, mapMasterCab, areaGrafik);
  }
}

function gambarChartNow(daftarCabang, dataByCabang, mapMasterCab, areaGrafik) {
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
      if (isPenjualan) {
        total = total * -1;
      }
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

  areaGrafik.style.display = "block";
  var ctx = document.getElementById("chart_rlgab_cabang").getContext("2d");

  if (window.myRlGabChart) {
    window.myRlGabChart.destroy();
  }

  window.myRlGabChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "PENJUALAN BERSIH",
          data: dataPenjualan,
          borderColor: "#1f7a43",
          backgroundColor: "rgba(31, 122, 67, 0.1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
        },
        {
          label: "TOTAL HPP",
          data: dataHPP,
          borderColor: "#0d6efd",
          backgroundColor: "rgba(13, 110, 253, 0.1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
        },
        {
          label: "TOTAL BY. ADM & UMUM",
          data: dataAdmUmum,
          borderColor: "#dc3545",
          backgroundColor: "rgba(220, 53, 69, 0.1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
        },
        {
          label: "TOTAL PEND & BY LAIN2",
          data: dataLain2,
          borderColor: "#ffc107",
          backgroundColor: "rgba(255, 193, 7, 0.1)",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
        },
        {
          label: "LABA / RUGI BERSIH (RL)",
          data: dataRL,
          borderColor: "#FFD700",
          backgroundColor: "rgba(255, 215, 0, 0.2)",
          borderWidth: 4,
          borderDash: [5, 5],
          tension: 0.3,
          fill: false,
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
            label: function (context) {
              return (
                context.dataset.label + ": " + formatUang(context.parsed.y)
              );
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            color: "#333",
            callback: function (value) {
              return formatUang(value);
            },
          },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
        x: { ticks: { color: "#333" }, grid: { display: false } },
      },
    },
  });
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
        '<th style="padding:10px; border:1px solid #000; text-align:center; background-color:#d9e1f2;"><span class="link-cabang-rl" onclick="tampilkanRLPerCabangSD(\'' +
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
    '<th rowspan="2" style="padding:10px; border:1px solid #000; text-align:right; background-color:#d9e1f2; font-weight:bold;">TOTAL</th>';
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
      if (currentDigit === "4") {
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
      } else if (currentDigit === "5") {
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
      } else if (currentDigit === "6") {
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
    if (currentDigit === "6") {
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
  var html = "";
  var totalLaba = 0;
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
    var arrDigit = [digit1, digit2, digit3, digit4].filter(function (d) {
      return d !== undefined;
    });
    arrDigit.forEach(function (dig) {
      Object.keys(dataByCabang[cab] || {}).forEach(function (kodeGol) {
        if (String(kodeGol).charAt(0) === dig) {
          saldoCab += dataByCabang[cab][kodeGol];
        }
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

// ==========================================
// FUNGSI BARU: KEMBALIKAN KE TAMPILAN GABUNGAN
// ==========================================
function kembaliKeRLGabungan() {
  var area = document.getElementById("tempat_tabel_rlgab");
  var grafik = document.getElementById("area_grafik_rlgab");

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
  if (grafik) {
    grafik.style.display = "block"; // Tampilkan kembali grafiknya
  }
}

// ==========================================
// FUNGSI DETAIL: DITAMPILKAN DI ATAS, LEBAR, TANPA POPUP
// ==========================================
async function tampilkanRLPerCabangSD(kodeCabang) {
  if (!window._rlGabFilterMasa) return;

  var namaCab = kodeCabang;
  if (
    window._rlGabunganData &&
    window._rlGabunganData.mapMasterCab[kodeCabang]
  ) {
    namaCab = window._rlGabunganData.mapMasterCab[kodeCabang];
  }

  var partMasa = window._rlGabFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];

  var area = document.getElementById("tempat_tabel_rlgab");
  var grafik = document.getElementById("area_grafik_rlgab");

  // Sembunyikan grafik sementara
  if (grafik) grafik.style.display = "none";

  // Tampilkan Loading di area yang sama
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted); background:#000; border-radius:8px;"><span class="spinner"></span> Memuat RL Lebar 12 Bulan...</div>';
  }

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

    for (var bln = 1; bln <= 12; bln++) {
      var blnStr = ("0" + bln).slice(-2);
      var duaDigitTahun = String(filterTahunFull).slice(-2);
      var kodeMasa = blnStr + duaDigitTahun;

      var dataBulanIni = rawdatagolongan.filter((g) => {
        var kodeGol = parseInt(g.gol || g.golongan || 0, 10);
        var cocokGol = kodeGol >= 300 && kodeGol < 700;
        var cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
        return cocokGol && masaData === kodeMasa && cabangData === kodeCabang;
      });

      dataBulanIni.forEach((item) => {
        var kodeGol = String(item.gol || item.golongan || "");
        var namaGol = item.namaGol || item.nama_golongan || "";
        var saldoAkhir = Number((item.db || 0) - (item.cr || 0));

        if (!mapGolongan[kodeGol]) {
          mapGolongan[kodeGol] = {
            gol: kodeGol,
            namaGol: namaGol,
            cabang: kodeCabang,
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
        '<div style="padding:3rem;text-align:center;color:#888; background:#000; border-radius:8px;">Data kosong untuk cabang ini di tahun ' +
        filterTahunFull +
        "</div>";
      return;
    }

    // TAMBAHAN: Header dengan tombol kembali
    var html =
      '<div style="margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center;">' +
      '<h4 style="margin:0; color:#fff; font-size:1.1rem;">RL Lebar: ' +
      namaCab +
      " - Tahun " +
      filterTahunFull +
      "</h4>" +
      '<button class="btn btn-b" style="background:#333; color:#fff; border:1px solid #555; font-size:.8rem; padding:5px 15px;" onclick="kembaliKeRLGabungan()"><i class="fa-solid fa-arrow-left"></i> Kembali ke RL Gabungan</button>' +
      "</div>";

    html +=
      '<div style="overflow-x:auto; border:1px solid #444; border-radius:8px;"><table border="1" style="width:100%;border-collapse:collapse;color:#fff;border:1px solid #444;background:#000; min-width:1200px;">';

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
        '<tr><td colspan="15" style="padding:8px;border:1px solid #444;font-weight:bold;background:#111;color:#fff;text-align:left;">' +
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
        "</td></tr>";
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
      html += `<td onclick="lihatDetilTransaksiRLLebar('${item.gol}', 'YTD${filterTahunFull}', '${kodeCabang}')" style="padding:6px;border:1px solid #3e0a93;cursor:pointer;color:#4da3ff;font-weight:bold;text-decoration:underline;">${item.gol}</td>
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

      html += `<td style="padding:6px;border:1px solid #444;text-align:right;font-weight:bold;color:${item.total >= 0 ? "#fff" : "#ff6b6b"}">${formatUang(item.total)}</td></tr>`;
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
      '<tr><td colspan="15" style="border:1px solid #444;padding:4px;background-color:#ffc107;"></td></tr>';
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

    // Render langsung di area utama
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

// ==========================================
// FUNGSI DETAIL TRANSAKSI TETAP MENGGUNAKAN POPUP KEcil
// ==========================================
function lihatDetilTransaksiRLLebar(noPerkiraan, masa, cabang) {
  // 1. Parse tahun dari format "YTD2024"
  var tahunFull = masa.replace("YTD", ""); // Hasil: "2024"
  var namaStore = "transaksi" + tahunFull;

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

      // 2. Siapkan array 12 bulan untuk mencocokkan (0101 s/d 1224 jika tahun 2024)
      var duaDigitTahun = tahunFull.substring(2, 4);
      var setMasaValid = new Set();
      for (var b = 1; b <= 12; b++) {
        var blnStr = ("0" + b).slice(-2);
        setMasaValid.add(blnStr + duaDigitTahun); // Contoh: "0124", "0224", dst...
      }

      // 3. Ambil 3 digit depan no perkiraan
      var prefixNoPerkiraan = String(noPerkiraan || "")
        .trim()
        .substring(0, 3);

      // 4. Filter Data
      var detilTrans = listTrans.filter(function (t) {
        var tNo = String(t.noperkiraan || "").trim();
        var tCab = String(t.cabang || "")
          .trim()
          .toUpperCase();
        var tMasa = String(t.masa || "").trim();

        var tNoPrefix = tNo.substring(0, 3);
        var cocokPerkiraan = tNoPrefix === prefixNoPerkiraan;

        // Cek apakah masanya ada di dalam 12 bulan tahun tersebut
        var cocokMasa = setMasaValid.has(tMasa);

        var cocokCabang = true;
        if (cabFilter !== "ALL" && cabFilter !== "") {
          cocokCabang = tCab === cabFilter;
        }

        return cocokPerkiraan && cocokMasa && cocokCabang;
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:20px; color:#ffc107;">' +
          "Data tidak ditemukan.<br><br>" +
          "<small>Dicari No Perkiraan (3 digit depan): " +
          prefixNoPerkiraan +
          " | Tahun: " +
          tahunFull +
          " | Cabang Kode: " +
          cabFilter +
          "</small>" +
          "</div>";
        return;
      }

      // Urutkan berdasarkan masa dan tanggal agar kronologis
      detilTrans.sort(function (a, b) {
        var masaA = String(a.masa || "");
        var masaB = String(b.masa || "");
        if (masaA !== masaB) return masaA.localeCompare(masaB);
        return String(a.tanggal || "").localeCompare(String(b.tanggal || ""));
      });
      // ✅ FUNGSI BARU: Parser untuk mengambil HANYA ANGKA TANGGAL
      // ✅ FUNGSI BARU: Parser untuk mengambil HANYA ANGKA TANGGAL
      function ambilTanggalSaja(rawTgl) {
        if (!rawTgl) return "-";
        var strTgl = String(rawTgl).trim();

        // ✅ 1. Jika format "Mon Feb 23 2026 00:00:00 GMT+0" (Format Date JS)
        // Split pakai spasi, tanggalnya ada di urutan ke-3 (index 2)
        var parts = strTgl.split(" ");
        if (parts.length >= 3 && !isNaN(parts[2])) {
          return parts[2]; // Akan mengembalikan "23"
        }

        // 2. Jika format "Senin, 15/01/2024 10:30:00" atau "15/01/2024 10:30:00"
        if (strTgl.indexOf("/") > -1) {
          var partsSlash = strTgl.split(" ")[0];
          var tglParts = partsSlash.split("/");
          return tglParts[0] || "-";
        }

        // 3. Jika format ISO "2024-01-15T10:30:00.000Z"
        if (strTgl.indexOf("-") > -1 && strTgl.indexOf("T") > -1) {
          var dateObj = new Date(strTgl);
          return dateObj.getDate() || "-";
        }

        return "-";
      }

      // 5. Render Tabel
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
