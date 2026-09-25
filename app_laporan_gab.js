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

  // ==========================================
  // CEK LEVEL USER: PUSAT ATAU BUKAN?
  // ==========================================
  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";

  var activeGroup = localStorage.getItem("group") || "TLGA";
  console.log(
    "🎨 [RL Gabungan Render] Level User:",
    isPusat ? "PUSAT" : userCabang,
    "| Group Default:",
    activeGroup,
  );

  // ==========================================
  // SIAPKAN DROPDOWN GROUP (HANYA UNTUK PUSAT)
  // ==========================================
  var groupUiHtml = "";
  if (isPusat) {
    groupUiHtml =
      '<div style="display:flex; align-items:center; gap:5px;">' +
      '<label style="font-size:.75rem; color:var(--muted);">Filter Group:</label>' +
      '<select id="filter_rlgab_group" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; font-weight:bold;">';

    // Ambil daftar group dari cache master
    var listGroup = DBCache.groupproject || [];
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
    // JIKA BUKAN PUSAT: TAMPILKAN TEKS MATI (HIDDEN DROPDOWN)
    groupUiHtml =
      '<div style="font-size:.8rem; color:var(--muted);">Group: <span style="color:var(--accent); font-weight:bold;">' +
      esc(activeGroup) +
      "</span></div>";
  }

  var htmlLaporan =
    '<div id="area_cetak_rlgab" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:visible;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan RL Rekap Gabungan (Semua Cabang)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    // MASUKKAN HTML GROUP YANG SUDAH DIKONDISIKAN DI SINI
    groupUiHtml +
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

  // ==========================================
  // 1. SIMPAN GROUP YANG DIPILIH
  // ==========================================
  var groupDropdown = document.getElementById("filter_rlgab_group");
  var activeGroup = localStorage.getItem("activeGroup") || "TLGA";

  if (groupDropdown) {
    activeGroup = groupDropdown.value;
    localStorage.setItem("activeGroup", activeGroup);
  }

  console.log(
    "🟢 [RL Gabungan Proses] Tombol Terapkan diklik. Group:",
    activeGroup,
  );

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
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 Memuat data gabungan cabang group: ' +
      esc(activeGroup) +
      "...</div>";
  }

  try {
    console.log("📡 Mengambil data Master Golongan...");
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        // Ekstrak JSON jika perlu
        if ((!m.gol || !m.namagol) && m.data) {
          try {
            m = Object.assign({}, m, JSON.parse(m.data));
          } catch (e) {}
        }
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namagol || m.nama || "").trim();
        if (kode) mapMasterGol[kode] = nama;
      });
    }

    console.log("📡 Mengambil data Master Cabang...");
    var rawMasterCab = await db.getAll("cabang");
    var mapMasterCab = {};
    var daftarCabang = []; // ✅ PERUBAHAN: Kolom langsung diambil dari sini!

    if (rawMasterCab) {
      var arrMasterCab = Array.isArray(rawMasterCab)
        ? rawMasterCab
        : Object.values(rawMasterCab);
      arrMasterCab.forEach(function (c) {
        // Ekstrak JSON jika perlu
        if ((!c.kode || !c.nama) && c.data) {
          try {
            c = Object.assign({}, c, JSON.parse(c.data));
          } catch (e) {}
        }

        var kode = String(c.kode_cabang || c.kode || c.cab || "").trim();
        var nama = String(c.nama_cabang || c.nama || c.cabang || "").trim();
        var cabGroup = String(c.group || "").trim();

        // ✅ LOGIKA BARU: Hanya ambil cabang yang sesuai Group-nya
        if (cabGroup === activeGroup && kode && nama) {
          mapMasterCab[kode] = nama;
          daftarCabang.push(kode); // Masukkan ke array kolom
        }
      });
    }

    // Urutkan kode cabang (misal: 00, 01, 02...)
    daftarCabang.sort();

    console.log(
      "📡 Mengambil data Golongan Tahunan:",
      namastoregolbackup,
      "| Masa:",
      kodemasadicari,
    );
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    var dataByCabang = {};

    // Inisialisasi array untuk semua cabang yang sudah difilter di atas (agar yang 0 rupiah tetap muncul)
    daftarCabang.forEach(function (cab) {
      dataByCabang[cab] = {};
    });

    rawdatagolongan.forEach(function (g) {
      // Ekstrak JSON jika data fisik kosong
      if ((!g.gol || !g.cabang || !g.masa) && g.data) {
        try {
          g = Object.assign({}, g, JSON.parse(g.data));
        } catch (e) {}
      }

      var kodeGol = String(g.gol || g.golongan || "").trim();
      var cabangData = String(g.cabang || g.cab || g.kode_cabang || "").trim();
      var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();
      var groupData = String(g.group || "").trim();

      if (!groupData) groupData = "TLGA"; // Fallback group lama

      // ✅ LOGIKA BARU: Hanya proses jika cabangnya ADA di daftar kolom (yang sudah difilter by group)
      if (!dataByCabang.hasOwnProperty(cabangData)) return;
      if (groupData !== activeGroup) return;

      if (kodeGol >= 300 && kodeGol < 700 && masaData === kodemasadicari) {
        if (!dataByCabang[cabangData][kodeGol])
          dataByCabang[cabangData][kodeGol] = 0;
        var saldoAkhir = +(g.db || 0) - +(g.cr || 0);
        dataByCabang[cabangData][kodeGol] += saldoAkhir;
      }
    });

    console.log("✅ Selesai filter. Total kolom cabang:", daftarCabang.length);

    var setKodeGol = new Set();
    daftarCabang.forEach(function (cab) {
      Object.keys(dataByCabang[cab]).forEach(function (gol) {
        setKodeGol.add(gol);
      });
    });

    var arrKodeGol = Array.from(setKodeGol).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });

    // Hapus baris golongan yang TOTALNYA 0 di semua cabang
    arrKodeGol = arrKodeGol.filter(function (kodeGol) {
      var totalSemuaCabang = 0;
      daftarCabang.forEach(function (cab) {
        totalSemuaCabang += dataByCabang[cab][kodeGol] || 0;
      });
      return totalSemuaCabang !== 0;
    });

    // SIMPAN KE GLOBAL
    window._rlGabunganData = {
      daftarCabang,
      arrKodeGol,
      dataByCabang,
      mapMasterGol,
      mapMasterCab,
      activeGroup,
    };

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
  var activeGroupLabel = d.activeGroup || "TLGA"; // ✅ TAMBAHAN OPSI GROUP

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
    `<h2 style="text-align:center;">LAPORAN RL REKAP GABUNGAN</h2><h3 style="text-align:center;">Group: ${activeGroupLabel} | Masa: ${window._rlGabFilterMasa}</h3>` +
    htmlContent +
    `</body></html>`;

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  // ✅ TAMBAHAN OPSI GROUP: MASUKKAN GROUP KE FILENAME EXCEL
  a.download =
    "Laporan_RL_Gabungan_Group_" +
    activeGroupLabel +
    "_" +
    (window._rlGabFilterMasa || "Export") +
    ".xls";
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

    // --- TAMBAHAN: AMBIL BULAN DARI GLOBAL UNTUK DIBAWA KE PARAMETER ---
    var ambilMasa = window._rlGabFilterMasa
      ? window._rlGabFilterMasa.split("-")
      : ["", ""];
    var bulanParam = ambilMasa[0] || "12"; // Ambil bagian bulan (misal "05"), kalau kosong isi "12"
    // --------------------------------------------------------------------

    if (!isForExcel) {
      html +=
        '<th style="padding:10px; border:1px solid #000; text-align:center; background-color:#000000;"><span class="link-cabang-rl" style="color:#00D2FF; text-decoration:underline; cursor:pointer;" onclick="tampilkanRLPerCabangSD(\'' +
        cab.replace(/'/g, "\\'") +
        "', '" +
        bulanParam +
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
        formatRupiah(saldo) +
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
      formatRupiah(totalRow) +
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
      formatRupiah(saldo) +
      "</td>";
  });
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; background-color:' +
    bgColor +
    '; color:#ffffff; font-weight:bold;"' +
    (isForExcel ? ' x:num="' + totalSub + '"' : "") +
    ">" +
    formatRupiah(totalSub) +
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
      formatRupiah(saldoCab) +
      "</td>";
  });
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; background-color:' +
    bgColor +
    '; color:#ffffff; font-weight:bold;"' +
    (isForExcel ? ' x:num="' + totalLaba + '"' : "") +
    ">" +
    formatRupiah(totalLaba) +
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

async function tampilkanRLPerCabangSD(kodeCabang, bulanDariKlik) {
  if (!window._rlGabFilterMasa) return;

  var activeGroup =
    window._rlGabunganData && window._rlGabunganData.activeGroup
      ? window._rlGabunganData.activeGroup
      : localStorage.getItem("group") || "TLGA";

  var namaCab =
    window._rlGabunganData && window._rlGabunganData.mapMasterCab[kodeCabang]
      ? window._rlGabunganData.mapMasterCab[kodeCabang]
      : kodeCabang;

  var partMasa = window._rlGabFilterMasa.split("-");
  var filterTahunFull = partMasa[1];

  // AMBIL BULAN (SUDAH BENAR)
  var bulanDipilih = bulanDariKlik
    ? parseInt(bulanDariKlik)
    : window._rlGabFilterBulan
      ? parseInt(window._rlGabFilterBulan)
      : 12;
  var namaBulanFull = [
    "",
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];
  var teksBulan =
    bulanDipilih === 12 ? "" : " SD BULAN " + namaBulanFull[bulanDipilih];

  var area = document.getElementById("tempat_tabel_rlgab");
  if (area)
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted); background:#000; border-radius:8px;"><span class="spinner"></span> Memuat RL Lebar' +
      teksBulan +
      "...</div>";

  try {
    var namastoregolbackup = "golongan" + filterTahunFull;
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    // 1. POTONG NAMA BULAN SESUAI PILIHAN
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
    ].slice(0, bulanDipilih);

    _tmpMapGolonganForChart = {};

    for (let b = 1; b <= 12; b++) {
      // 2. SKIP DATA JIKA LEBIH DARI BULAN YANG DIPILIH
      if (b > bulanDipilih) continue;

      let blnStr = ("0" + b).slice(-2);
      let duaDigitTahun = String(filterTahunFull).slice(-2);
      let kodeMasa = blnStr + duaDigitTahun;

      let dataBulanIni = rawdatagolongan.filter((g) => {
        let kodeGol = parseInt(g.gol || g.golongan || 0, 10);
        let cabangData = String(
          g.cabang || g.cab || g.kode_cabang || "",
        ).trim();
        let groupData = String(g.group || "").trim();
        let cocokGroup = groupData === activeGroup;

        return (
          kodeGol >= 300 &&
          kodeGol < 700 &&
          cocokGroup &&
          String(g.masa || g.periode || g.kode_masa || "").trim() ===
            kodeMasa &&
          cabangData === kodeCabang
        );
      });

      dataBulanIni.forEach((item) => {
        let kodeGol = String(item.gol || item.golongan || "");

        if (!_tmpMapGolonganForChart[kodeGol]) {
          _tmpMapGolonganForChart[kodeGol] = {
            gol: kodeGol,
            namaGol: item.namagol || item.nama_golongan || "",
            cabang: kodeCabang,
            bulan: {},
            total: 0,
          };
          for (let x = 1; x <= 12; x++)
            _tmpMapGolonganForChart[kodeGol].bulan[("0" + x).slice(-2)] = 0;
        }
        let saldoAkhir = Number((item.db || 0) - (item.cr || 0));
        _tmpMapGolonganForChart[kodeGol].bulan[blnStr] = saldoAkhir;
        _tmpMapGolonganForChart[kodeGol].total += saldoAkhir;
      });
    }

    let listGol = Object.values(_tmpMapGolonganForChart)
      .filter((g) => g.total !== 0)
      .sort((a, b) => parseInt(a.gol) - parseInt(b.gol));

    if (listGol.length === 0) {
      area.innerHTML =
        '<div style="padding:3rem;text-align:center;color:#888; background:#000; border-radius:8px;">Data kosong untuk cabang & group ini di tahun ' +
        filterTahunFull +
        teksBulan +
        "</div>";
      return;
    }

    let html =
      '<div style="margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
      '<h4 style="margin:0; color:#fff; font-size:1.1rem;">RL Lebar: ' +
      namaCab +
      " | Group: " +
      activeGroup +
      " - Tahun " +
      filterTahunFull +
      teksBulan + // TAMBAHKAN TEKS BULAN DI JUDUL
      "</h4>" +
      '<div style="display:flex; gap:8px;">' +
      '<button class="btn" style="background:#0284c7; color:#fff; border:1px solid #0369a1; font-size:.8rem; padding:5px 15px; cursor:pointer;" onclick="gambarChartRLPerCabang([\'' +
      kodeCabang +
      "'], _tmpMapGolonganForChart, window._rlGabunganData.mapMasterCab)\">" +
      '<i class="fa-solid fa-chart-line"></i> Grafik Tren HPP' +
      "</button>" +
      '<button class="btn btn-g" style="background:#1b5e20; color:#fff; border:1px solid #2e7d32; font-size:.8rem; padding:5px 15px; cursor:pointer;" onclick="downloadRLLebarExcel(\'' +
      encodeURIComponent(namaCab) +
      "', '" +
      encodeURIComponent(filterTahunFull) +
      "', '" +
      encodeURIComponent(activeGroup) +
      "', true)\">" +
      '<i class="fa-solid fa-file-excel"></i> Download Excel' +
      "</button>" +
      '<button class="btn btn-w" style="background-color:#ed7d31; color:#fff; border:1px solid #c55a11; font-size:.8rem; padding:5px 15px; cursor:pointer; font-weight:bold;" onclick="tampilkanVersusSD(\'' +
      encodeURIComponent(kodeCabang) +
      "', '" +
      encodeURIComponent(activeGroup) +
      "')\">" +
      '<i class="fa-solid fa-scale-balanced"></i> Lihat HPP vs Sales' +
      "</button>" +
      // KIRIM PARAMETER bulanDipilih KE TOMBOL DETIL
      '<button class="btn" style="background:#7c3aed; color:#fff; border:1px solid #6d28d9; font-size:.8rem; padding:5px 15px; cursor:pointer; font-weight:bold;" onclick="tampilkanRLPerCabangDetil(\'' +
      kodeCabang +
      "', '" +
      bulanDipilih +
      "')\">" +
      '<i class="fa-solid fa-list-check"></i> RL Detil Perkiraan' +
      "</button>" +
      '<button class="btn btn-b" style="background:#333; color:#fff; border:1px solid #555; font-size:.8rem; padding:5px 15px; cursor:pointer;" onclick="kembaliKeRLGabungan()">' +
      '<i class="fa-solid fa-arrow-left"></i> Kembali ke RL Gabungan' +
      "</button>" +
      "</div>" +
      "</div>";

    html +=
      '<div style="overflow-x:auto; border:1px solid #444; border-radius:8px;"><table border="1" style="width:100%;border-collapse:collapse;color:#fff;border:1px solid #444;background:#000; min-width:1200px;">';

    // 3. UBAH COLSPAN MENJADI DINAMIS
    html +=
      '<thead><tr style="background:#1a1a1a;font-weight:bold;color:#fff;"><th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;">GOL</th><th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;">NAMA GOLONGAN</th><th colspan="' +
      bulanDipilih +
      '" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:center;">BULAN</th><th rowspan="2" style="padding:8px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:right;">TOTAL YTD</th></tr><tr style="background:#1a1a1a;font-weight:bold;color:#fff;text-align:center">';

    namaBulan.forEach(function (nb) {
      html +=
        '<th style="padding:6px;border:1px solid #444;background:#1a1a1a;color:#fff;text-align:center">' +
        nb +
        "</th>";
    });

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
      // 4. UBAH COLSPAN MENJADI DINAMIS
      html +=
        '<tr><td colspan="' +
        (bulanDipilih + 3) +
        '" style="padding:8px;border:1px solid #444;font-weight:bold;background:#111;color:#fff;text-align:left;">' +
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

      // 5. UBAH BATAS PERULANGAN SUBTOTAL
      for (let b = 1; b <= bulanDipilih; b++) {
        let blnStr = ("0" + b).slice(-2);
        let val = arrBulan[blnStr] || 0;
        html +=
          '<td style="padding:8px;border:1px solid #444;text-align:right;color:' +
          (val >= 0 ? "#fff" : "#ffcdd2") +
          ";" +
          topBorder +
          '">' +
          formatRupiah(val) +
          "</td>";
      }
      html +=
        '<td style="padding:8px;border:1px solid #444;text-align:right;color:' +
        (total >= 0 ? "#fff" : "#ffcdd2") +
        ";" +
        topBorder +
        '">' +
        formatRupiah(total) +
        "</td></tr>";
    }

    function prosesAkumulasiYTD(digitSekarang, subTotalBulan) {
      // 6. UBAH BATAS PERULANGAN AKUMULASI
      for (let b = 1; b <= bulanDipilih; b++) {
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
        // 7. UBAH BATAS PERULANGAN DETAIL
        for (let b = 1; b <= bulanDipilih; b++) {
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

      // 8. UBAH BATAS PERULANGAN KOLOM BULAN
      for (let b = 1; b <= bulanDipilih; b++) {
        let bs = ("0" + b).slice(-2);
        let rawVal =
          item.bulan && item.bulan[bs] !== undefined ? item.bulan[bs] : 0;
        let val = num(rawVal);
        if (!subTotalPerBulan[bs]) subTotalPerBulan[bs] = 0;
        subTotalPerBulan[bs] += val;
        html += `<td style="padding:6px;border:1px solid #444;text-align:right;color:${val >= 0 ? "#fff" : "#ffc107"}">${val !== 0 ? formatRupiah(val) : ""}</td>`;
      }
      html += `<td style="padding:6px;border:1px solid #444;text-align:right;font-weight:bold;color:${item.total >= 0 ? "#fff" : "#ff6b6b"}">${formatRupiah(item.total)}</td></tr>`;
    }

    if (currentDigit !== null) {
      let arrSubAkhir = {},
        totalSubAkhir = 0;
      // 9. UBAH BATAS PERULANGAN AKHIR
      for (let b = 1; b <= bulanDipilih; b++) {
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

    // 10. UBAH COLSPAN GARIS KUNING MENJADI DINAMIS
    html +=
      '<tr><td colspan="' +
      (bulanDipilih + 3) +
      '" style="border:1px solid #444;padding:4px;background-color:#ffc107;"></td></tr>';

    let arrTotalBulan = {},
      grandTotal = 0;
    // 11. UBAH BATAS PERULANGAN GRAND TOTAL
    for (let b = 1; b <= bulanDipilih; b++) {
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

async function downloadRLLebarExcel(namaCabang, tahun, group) {
  var area = document.getElementById("tempat_tabel_rlgab");
  if (!area) return;

  var tabelElement = area.querySelector("table");
  if (!tabelElement) {
    if (typeof toast === "function") {
      toast("Tidak ada data tabel untuk didownload", "err");
    } else {
      alert("Tidak ada data tabel untuk didownload");
    }
    return;
  }

  // 1. Bersihkan nama cabang dari URL encoding dan karakter khusus HTML
  var namaCabangBersih = namaCabang;
  try {
    namaCabangBersih = decodeURIComponent(namaCabang);
  } catch (e) {
    console.error("Gagal decode nama cabang:", e);
  }

  // Hapus tag HTML jika ada (misal hasil dari fungsi esc)
  namaCabangBersih = namaCabangBersih.replace(/<\/?[^>]+(>|$)/g, "");
  // Ganti spasi, tanda kutip, koma, atau karakter non-alphanumeric lainnya menjadi underscore "_"
  var safeNamaCabang = namaCabangBersih
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_");

  // Clone tabel asli agar manipulasi cetak tidak merusak tampilan layar
  var cloneTabel = tabelElement.cloneNode(true);

  // Ganti warna teks link detail agar hitam/gelap di Excel supaya mudah dibaca
  var linkCells = cloneTabel.querySelectorAll("td[onclick]");
  linkCells.forEach(function (td) {
    td.style.color = "#0000FF";
    td.style.textDecoration = "underline";
    td.removeAttribute("onclick");
  });

  var htmlContent = cloneTabel.outerHTML;

  // Susun struktur dokumen HTML Spreadsheet XML
  var fullHtml =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head>` +
    `<meta charset="UTF-8">` +
    `<!--[if gte mso 9]>` +
    `<xml>` +
    `<x:ExcelWorkbook>` +
    `<x:ExcelWorksheets>` +
    `<x:ExcelWorksheet>` +
    `<x:Name>RL Lebar 12 Bln</x:Name>` +
    `<x:WorksheetOptions>` +
    `<x:DisplayGridlines/>` +
    `</x:WorksheetOptions>` +
    `</x:ExcelWorksheet>` +
    `</x:ExcelWorksheets>` +
    `</x:ExcelWorkbook>` +
    `</xml>` +
    `<![endif]-->` +
    `<style>` +
    `  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }` +
    `  th { background-color: #1a1a1a !important; color: #ffffff !important; border: 1px solid #444444; text-align: center; font-weight: bold; padding: 6px; }` +
    `  td { border: 1px solid #444444; padding: 5px; }` +
    `  .subtotal { background-color: #1b5e20 !important; color: #ffffff !important; font-weight: bold; }` +
    `</style>` +
    `</head>` +
    `<body>` +
    `  <h2 style="text-align:center; font-family: Arial, sans-serif; margin-bottom: 2px;">LAPORAN LABA RUGI LEBAR 12 BULAN</h2>` +
    `  <h3 style="text-align:center; font-family: Arial, sans-serif; margin-top: 0; margin-bottom: 20px;">Cabang: ${namaCabangBersih} | Group: ${group} | Tahun: ${tahun}</h3>` +
    `  ${htmlContent}` +
    `</body>` +
    `</html>`;

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;

  // Nama file dijamin bersih tanpa ada karakter % atau spasi ganda
  a.download =
    "RL_Lebar_" + safeNamaCabang + "_Group_" + group + "_" + tahun + ".xls";

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof toast === "function") {
    toast("File Excel RL Lebar sedang didownload...", "ok");
  }
}
function generateHTMLRLPercabangSD(
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
        formatRupiah(saldo) +
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
      formatRupiah(totalRow) +
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
async function tampilkanRLPerCabangDetil(kodeCabang, bulanDariKlik) {
  if (!window._rlGabFilterMasa) {
    alert("Filter masa/periode belum dipilih!");
    return;
  }

  var activeGroup =
    window._rlGabunganData && window._rlGabunganData.activeGroup
      ? window._rlGabunganData.activeGroup
      : localStorage.getItem("group") || "TLGA";

  var namaCab =
    window._rlGabunganData &&
    window._rlGabunganData.mapMasterCab &&
    window._rlGabunganData.mapMasterCab[kodeCabang]
      ? window._rlGabunganData.mapMasterCab[kodeCabang]
      : kodeCabang;

  var partMasa = window._rlGabFilterMasa.split("-");
  var filterTahunFull = partMasa[1];

  // --- AMBIL BULAN YANG BENAR (HANYA SATU KALI) ---
  var bulanDipilih = bulanDariKlik
    ? parseInt(bulanDariKlik)
    : window._rlGabFilterBulan
      ? parseInt(window._rlGabFilterBulan)
      : 12;
  // -----------------------------------------------

  var namaBulanFull = [
    "",
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];
  var teksBulanLoading =
    bulanDipilih === 12 ? "" : " SD BULAN " + namaBulanFull[bulanDipilih];

  // 1. Langsung buka Window Baru terlebih dahulu (Cegah Popup Blocker)
  var win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up diblokir browser! Harap izinkan Pop-up untuk situs ini.");
    return;
  }

  // Tampilan Loading Awal
  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Memuat RL Detail - ${namaCab}</title>
        <style>
          body { background: #121212; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .spinner { border: 4px solid rgba(255,255,255,0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: #00D2FF; animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div style="text-align:center;">
          <div class="spinner" style="margin:0 auto 15px;"></div>
          <div>Memuat Data Perkiraan RL ${namaCab} (${filterTahunFull}${teksBulanLoading})...</div>
        </div>
      </body>
    </html>
  `);
  win.document.close();

  try {
    // 2. Ambil data dari IndexedDB
    var namaStorePerkiraan = "perkiraan" + filterTahunFull;
    var resPerkiraan = await db.getAll(namaStorePerkiraan);

    var rawDataPerkiraan = resPerkiraan
      ? Array.isArray(resPerkiraan)
        ? resPerkiraan
        : Object.values(resPerkiraan)
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
    ].slice(0, bulanDipilih);

    var tmpMap = {};

    rawDataPerkiraan.forEach((p) => {
      let noPerkFull = String(p.noPerk || p.noper || p.gol || "").trim();
      let kodeKepala = parseInt(noPerkFull.substring(0, 1), 10);

      let cabangData = String(p.cabang || p.cab || "")
        .trim()
        .toUpperCase();
      let targetCabangKode = String(kodeCabang).trim().toUpperCase();
      let targetCabangNama = String(namaCab).trim().toUpperCase();

      let cocokCabang =
        cabangData === targetCabangKode || cabangData === targetCabangNama;
      let groupData = String(p.group || "")
        .trim()
        .toUpperCase();
      let cocokGroup = groupData === String(activeGroup).trim().toUpperCase();

      if (kodeKepala >= 3 && kodeKepala <= 6 && cocokCabang && cocokGroup) {
        let namaPerkiraan =
          p.penjelasan || p.namaGol || p.nama || "Perkiraan " + noPerkFull;

        if (!tmpMap[noPerkFull]) {
          tmpMap[noPerkFull] = {
            noper: noPerkFull,
            namaGol: namaPerkiraan,
            bulan: {},
            total: 0,
          };
          for (let x = 1; x <= 12; x++)
            tmpMap[noPerkFull].bulan[("0" + x).slice(-2)] = 0;
        }

        let masaStr = String(p.masa || "").trim();
        let blnStr = masaStr.substring(0, 2);
        let intBln = parseInt(blnStr, 10);

        // ---> PERBAIKAN PENTING: Hanya proses jika bulan <= bulanDipilih <---
        if (blnStr && intBln >= 1 && intBln <= bulanDipilih) {
          let mutasiBulan = Number(p.db || 0) - Number(p.cr || 0);
          tmpMap[noPerkFull].bulan[blnStr] += mutasiBulan;
          tmpMap[noPerkFull].total += mutasiBulan;
        }
        // -------------------------------------------------------------------
      }
    });

    let listPerkiraan = Object.values(tmpMap)
      .filter((g) => g.total !== 0)
      .sort((a, b) => parseFloat(a.noper) - parseFloat(b.noper));

    var teksJudulBulan =
      bulanDipilih === 12 ? "" : ` SD BULAN ${namaBulanFull[bulanDipilih]}`;

    // 3. Generate Dokumen HTML Utuh
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>RL Detail Perkiraan - ${namaCab}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          body { background: #000; color: #fff; font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif; padding: 20px; margin: 0; }
          .no-print { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 10px; flex-wrap: wrap; }
          .btn { padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem; color: #fff; display: inline-flex; align-items: center; gap: 6px; }
          .btn-print { background: #0284c7; }
          .btn-close { background: #dc2626; }
          table { width: 100%; border-collapse: collapse; min-width: 1250px; font-size: 0.85rem; }
          th, td { border: 1px solid #444; padding: 6px 8px; }
          th { background: #1a1a1a; color: #fff; text-align: center; }
          tr.subtotal { background: #1b5e20; font-weight: bold; }
          tr.header-group { background: #111; color: #00D2FF; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          @media print {
            .no-print { display: none !important; }
            body { background: #fff; color: #000; padding: 0; }
            th, td { border: 1px solid #000 !important; color: #000 !important; }
            th { background: #f2f2f2 !important; }
            tr.subtotal { background: #e2e2e2 !important; color: #000 !important; }
            tr.header-group { background: #f9f9f9 !important; color: #000 !important; }
          }
        </style>
        <script>
        var currentBulan =${bulanDipilih}

          function triggerVersusBukaTab(cab, group) {
            if (window.opener && typeof window.opener.bukaVersusBukaTab === 'function') {
              window.opener.bukaVersusBukaTab(cab, group, currentBulan);
            } else {
              alert('Tidak dapat terhubung ke halaman utama untuk mengambil data.');
            }
          }
        </script>
      </head>
      <body>
        <div class="no-print">
          <h3 style="margin:0; color:#00D2FF;">RL Detail Perkiraan: ${namaCab} | Group: ${activeGroup} - Tahun ${filterTahunFull}${teksJudulBulan}</h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" style="background:#ed7d31; border:1px solid #c55a11;" onclick="triggerVersusBukaTab('${kodeCabang}', '${activeGroup}')">
              <i class="fa-solid fa-scale-balanced"></i> HPP Detil vs Sales Detil
            </button>
            <button class="btn" style="background:#1b5e20; border:1px solid #2e7d32;" 
              onclick="if(window.opener && window.opener.downloadRLExceldetil){ window.opener.downloadRLExceldetil(window, '${namaCab}', '${filterTahunFull}', '${activeGroup}', ${bulanDipilih}); } else { alert('Fungsi Export tidak ditemukan!'); }">
              <i class="fa-solid fa-file-excel"></i> Export Excel
            </button>
            <button class="btn btn-print" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak / PDF</button>
            <button class="btn btn-close" onclick="window.close()"><i class="fa-solid fa-xmark"></i> Tutup</button>
          </div>
        </div>
        
        <div style="overflow-x:auto;" id="tabel_rlcabdetil">
          <table>
            <thead>
              <tr>
                <th rowspan="2">NO.PERK</th>
                <th rowspan="2" style="min-width:200px; text-align:left;">NAMA PERKIRAAN</th>
                <th colspan="${bulanDipilih}">BULAN</th>
                <th rowspan="2">TOTAL YTD</th>
              </tr>
              <tr>
                ${namaBulan.map((b) => `<th>${b}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
    `;

    if (listPerkiraan.length === 0) {
      htmlContent += `
        <tr>
          <td colspan="${bulanDipilih + 3}" class="text-center" style="padding: 30px; color: #ff6b6b;">
            Data Perkiraan Tidak Ditemukan untuk cabang ${namaCab} (${kodeCabang}) & group ${activeGroup} pada tahun ${filterTahunFull}.
          </td>
        </tr>
      `;
    } else {
      let currentDigit = null;
      let subTotalPerBulan = {};
      let akumulasiLabaRugiPerBulan = {};
      let salesBulanVersus = Array(12).fill(0);
      let hppBulanVersus = Array(12).fill(0);

      for (let b = 1; b <= 12; b++) {
        subTotalPerBulan[("0" + b).slice(-2)] = 0;
        akumulasiLabaRugiPerBulan[("0" + b).slice(-2)] = 0;
      }

      function formatRupiahWindow(val) {
        if (!val || val === 0) return "";
        return new Intl.NumberFormat("id-ID").format(val);
      }

      listPerkiraan.forEach((item) => {
        let digit = String(item.noper).charAt(0);

        if (currentDigit !== null && digit !== currentDigit) {
          let ket = "SUBTOTAL " + currentDigit + "xxxxx";
          if (currentDigit === "3") ket = "PENJUALAN BERSIH";
          if (currentDigit === "4") ket = "TOTAL HPP";
          if (currentDigit === "5") ket = "TOTAL BIAYA ADM & UMUM";
          if (currentDigit === "6") ket = "TOTAL BEBAN LAINNYA";

          let totalSub = 0;
          htmlContent += `<tr class="subtotal"><td colspan="2" class="text-right">${ket}</td>`;

          for (let b = 1; b <= bulanDipilih; b++) {
            let bs = ("0" + b).slice(-2);
            let val = subTotalPerBulan[bs];
            totalSub += val;

            if (currentDigit === "3") salesBulanVersus[b - 1] += val;
            if (currentDigit === "4") hppBulanVersus[b - 1] += val;

            akumulasiLabaRugiPerBulan[bs] =
              currentDigit === "3" ? val : akumulasiLabaRugiPerBulan[bs] + val;
            htmlContent += `<td class="text-right">${formatRupiahWindow(val)}</td>`;
            subTotalPerBulan[bs] = 0;
          }
          htmlContent += `<td class="text-right">${formatRupiahWindow(totalSub)}</td></tr>`;
        }

        if (currentDigit !== digit) {
          let labelHeader = "";
          if (digit === "3") labelHeader = "3. PENJUALAN";
          if (digit === "4") labelHeader = "4. HARGA POKOK PENJUALAN (HPP)";
          if (digit === "5") labelHeader = "5. BIAYA ADMINISTRASI & UMUM";
          if (digit === "6") labelHeader = "6. BEBAN LAINNYA";
          htmlContent += `<tr class="header-group"><td colspan="${bulanDipilih + 3}">${labelHeader}</td></tr>`;
        }

        currentDigit = digit;

        htmlContent += `<tr><td class="text-center" style="color:#4da3ff; font-weight:bold;">${item.noper}</td><td>${item.namaGol}</td>`;

        for (let b = 1; b <= bulanDipilih; b++) {
          let bs = ("0" + b).slice(-2);
          let val = item.bulan[bs] || 0;
          subTotalPerBulan[bs] += val;
          htmlContent += `<td class="text-right" style="color:${val < 0 ? "#ffc107" : "#fff"}">${formatRupiahWindow(val)}</td>`;
        }
        htmlContent += `<td class="text-right" style="font-weight:bold; color:${item.total < 0 ? "#ff6b6b" : "#fff"}">${formatRupiahWindow(item.total)}</td></tr>`;
      });

      if (currentDigit !== null) {
        let ket = "SUBTOTAL " + currentDigit + "xxxxx";
        if (currentDigit === "3") ket = "PENJUALAN BERSIH";
        if (currentDigit === "4") ket = "TOTAL HPP";

        let totalSub = 0;
        htmlContent += `<tr class="subtotal"><td colspan="2" class="text-right">${ket}</td>`;

        for (let b = 1; b <= bulanDipilih; b++) {
          let bs = ("0" + b).slice(-2);
          let val = subTotalPerBulan[bs];
          totalSub += val;

          if (currentDigit === "3") salesBulanVersus[b - 1] += val;
          if (currentDigit === "4") hppBulanVersus[b - 1] += val;

          akumulasiLabaRugiPerBulan[bs] =
            currentDigit === "3" ? val : akumulasiLabaRugiPerBulan[bs] + val;
          htmlContent += `<td class="text-right">${formatRupiahWindow(val)}</td>`;
        }
        htmlContent += `<td class="text-right">${formatRupiahWindow(totalSub)}</td></tr>`;
      }

      let grandTotal = 0;
      htmlContent += `<tr style="background:#ffc107;"><td colspan="${bulanDipilih + 3}" style="padding:2px;"></td></tr>`;
      htmlContent += `<tr class="subtotal" style="border-top: 3px double #fff;"><td colspan="2" class="text-right">LABA / RUGI BERSIH YTD</td>`;

      for (let b = 1; b <= bulanDipilih; b++) {
        let bs = ("0" + b).slice(-2);
        let val = akumulasiLabaRugiPerBulan[bs];
        grandTotal += val;
        htmlContent += `<td class="text-right">${formatRupiahWindow(val)}</td>`;
      }
      htmlContent += `<td class="text-right">${formatRupiahWindow(grandTotal)}</td></tr>`;
    }

    htmlContent += `
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(htmlContent);
    win.document.close();
  } catch (err) {
    console.error("Gagal memuat window RL Detail:", err);
    if (win && !win.closed) {
      win.document.body.innerHTML = `<div style="color:red; padding:30px; font-family:sans-serif;">Gagal memuat data: ${err.message}</div>`;
    }
  }
}

// ==========================================
// FUNGSI EXPORT EXCEL (JUGA SUDAH DIFILTER)
// ==========================================
function downloadRLExceldetil(win, namaCabang, tahun, group, bulanDipilih) {
  try {
    var targetDoc = win && win.document ? win.document : document;
    var area =
      targetDoc.getElementById("tabel_rlcabdetil") ||
      targetDoc.querySelector("#tabel_rlcabdetil");
    var tabelElement = area
      ? area.tagName === "TABLE"
        ? area
        : area.querySelector("table")
      : null;

    if (!tabelElement) tabelElement = targetDoc.querySelector("table");
    if (!tabelElement) {
      alert("Tabel RL Detail (#tabel_rlcabdetil) tidak ditemukan!");
      return;
    }

    var namaCabangBersih = String(namaCabang || "").replace(
      /<\/?[^>]+(>|$)/g,
      "",
    );
    var groupBersih = String(group || "").replace(/<\/?[^>]+(>|$)/g, "");
    var tahunBersih = String(tahun || "").replace(/<\/?[^>]+(>|$)/g, "");
    var safeNamaCabang = namaCabangBersih
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");

    // --- TAMBAHAN FILTER BULAN ---
    bulanDipilih = bulanDipilih || 12;
    var namaBulanFull = [
      "",
      "JANUARI",
      "FEBRUARI",
      "MARET",
      "APRIL",
      "MEI",
      "JUNI",
      "JULI",
      "AGUSTUS",
      "SEPTEMBER",
      "OKTOBER",
      "NOVEMBER",
      "DESEMBER",
    ];
    var teksBulanExcel =
      bulanDipilih === 12 ? "" : ` SD BULAN ${namaBulanFull[bulanDipilih]}`;
    // --------------------------------

    var cloneTabel = tabelElement.cloneNode(true);
    cloneTabel
      .querySelectorAll("button, input, .no-print")
      .forEach((el) => el.remove());
    cloneTabel
      .querySelectorAll("td[onclick], th[onclick]")
      .forEach((el) => el.removeAttribute("onclick"));

    var allRows = cloneTabel.querySelectorAll("tr");
    allRows.forEach(function (tr) {
      var ths = tr.querySelectorAll("th");
      ths.forEach(function (th) {
        th.setAttribute("bgcolor", "#1A1A1A");
        th.style.cssText =
          'background-color: #1A1A1A; color: #00D2FF; font-weight: bold; border: 1px solid #444444; text-align: center; mso-number-format:"\\@";';
      });

      if (ths.length > 0) return;

      var isSubtotal = tr.classList.contains("subtotal");
      var isHeaderGroup = tr.classList.contains("header-group");
      var cells = tr.querySelectorAll("td");
      if (cells.length === 0) return;

      cells.forEach(function (td, index) {
        var teksAsli = td.textContent ? td.textContent.trim() : "";

        if (isHeaderGroup) {
          td.setAttribute("bgcolor", "#111111");
          td.style.cssText =
            'background-color: #111111; color: #00D2FF; font-weight: bold; border: 1px solid #444444; mso-number-format:"\\@";';
          return;
        }

        if (isSubtotal) {
          td.setAttribute("bgcolor", "#1B5E20");
          td.style.cssText =
            "background-color: #1B5E20; color: #FFFFFF; font-weight: bold; border: 1px solid #444444;";
          if (index >= 2 && teksAsli !== "") {
            var angkaPolos = teksAsli.replace(/\./g, "").replace(/,/g, "");
            if (!isNaN(angkaPolos) && angkaPolos !== "") {
              td.style.cssText +=
                ' text-align: right; mso-number-format:"#,##0";';
              td.textContent = angkaPolos;
            }
          }
          return;
        }

        var styleBase =
          "background-color: #000000; color: #FFFFFF; border: 1px solid #444444;";
        td.setAttribute("bgcolor", "#000000");

        if (index === 0) {
          td.style.cssText =
            styleBase +
            ' text-align: center; font-weight: bold; color: #4DA3FF; mso-number-format:"\\@";';
          if (td.childNodes.length > 0 && td.childNodes[0].nodeType === 3) {
            td.childNodes[0].nodeValue = "'" + td.childNodes[0].nodeValue;
          }
        } else if (index === 1) {
          td.style.cssText =
            styleBase + ' text-align: left; mso-number-format:"\\@";';
        } else {
          if (teksAsli !== "") {
            var angkaPolos = teksAsli.replace(/\./g, "").replace(/,/g, "");
            if (!isNaN(angkaPolos) && angkaPolos !== "") {
              td.style.cssText =
                styleBase + ' text-align: right; mso-number-format:"#,##0";';
              td.textContent = angkaPolos;
            } else {
              td.style.cssText =
                styleBase + ' text-align: right; mso-number-format:"\\@";';
            }
          } else {
            td.style.cssText = styleBase;
          }
        }
      });
    });

    var htmlContent = cloneTabel.outerHTML;

    var fullHtml =
      `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
      `<head><meta charset="UTF-8">` +
      `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>` +
      `<x:Name>RL Detail SD Bulan ${bulanDipilih}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>` +
      `</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->` +
      `<style>` +
      `  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; width: 100%; background-color: #000000; color: #FFFFFF; }` +
      `  th { background-color: #1A1A1A; color: #00D2FF; border: 1px solid #444444; text-align: center; font-weight: bold; padding: 6px; }` +
      `  td { background-color: #000000; color: #FFFFFF; border: 1px solid #444444; padding: 5px; }` +
      `  .subtotal { background-color: #1B5E20 !important; color: #FFFFFF !important; font-weight: bold; }` +
      `  .header-group { background-color: #111111 !important; color: #00D2FF !important; font-weight: bold; }` +
      `</style></head>` +
      `<body style="background-color: #000000;">` +
      `  <h2 style="text-align:center; font-family: Arial, sans-serif; color: #00D2FF;">LAPORAN LABA RUGI DETAIL PERKIRAAN</h2>` +
      `  <h4 style="text-align:center; font-family: Arial, sans-serif; color: #FFFFFF;">Cabang: ${namaCabangBersih} | Group: ${groupBersih} | Tahun: ${tahunBersih}${teksBulanExcel}</h4>` +
      `  ${htmlContent}` +
      `</body></html>`;

    var blob = new Blob([fullHtml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = `RL_Detail_${safeNamaCabang}_Group_${groupBersih}_SD_Bln_${bulanDipilih}_${tahunBersih}.xls`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Gagal mendownload Excel:", err);
    alert("Terjadi kesalahan saat mengunduh Excel: " + err.message);
  }
}

// ==========================================
// 🛠️ FUNGSI HELPER: FORMAT PERSEN
// ==========================================
function formatPersen(num) {
  if (num === 0) return "0.00%";
  return num.toFixed(2).replace(".", ",") + "%";
}
function lihatDetilTransaksiRLLebar(noPerkiraan, masa, cabang) {
  let tahunFull = masa.replace("YTD", "");
  let namaStore = "transaksi" + tahunFull;
  let popupId = "popup_transaksi_" + Date.now();
  let cabFilter = String(cabang || "")
    .trim()
    .toUpperCase();
  if (cabFilter === "PUSAT") cabFilter = "00";

  let activeGroup =
    window._rlGabunganData && window._rlGabunganData.activeGroup
      ? window._rlGabunganData.activeGroup
      : localStorage.getItem("group") || "TLGA";

  let popupHtml =
    '<div id="' +
    popupId +
    '" style="position:fixed; top:20px; right:20px; width:50%; max-width:700px; max-height:90vh; background:#000; border:2px solid #4da3ff; box-shadow:0 0 20px rgba(77, 163, 255, 0.5); z-index:10001; display:flex; flex-direction:column; border-radius:8px;"><div style="padding:12px; background:#1a1a1a; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; border-radius:8px 8px 0 0;"><strong style="font-size:0.9rem; color:#4da3ff;">Detil Transaksi YTD: ' +
    noPerkiraan +
    " | Cabang: " +
    cabFilter +
    " | Group: " +
    activeGroup +
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
        let tNo = String(t.noper || "").trim();
        let tCab = String(t.cabang || "")
          .trim()
          .toUpperCase();
        let tMasa = String(t.masa || "").trim();

        let tGroup = String(t.group || "").trim();
        let cocokGroup = tGroup === activeGroup;

        let cocokPerkiraan = tNo.substring(0, 3) === prefixNoPerkiraan;
        let cocokMasa = setMasaValid.has(tMasa);
        let cocokCabang =
          cabFilter === "ALL" || cabFilter === "" ? true : tCab === cabFilter;

        return cocokPerkiraan && cocokMasa && cocokCabang && cocokGroup;
      });

      if (detilTrans.length === 0) {
        container.innerHTML =
          '<div style="text-align:center; padding:20px; color:#ffc107;">Data tidak ditemukan.<br><br><small>Dicari No Perkiraan (3 digit depan): ' +
          prefixNoPerkiraan +
          " | Tahun: " +
          tahunFull +
          " | Cabang Kode: " +
          cabFilter +
          " | Group: " +
          activeGroup +
          "</small></div>";
        return;
      }

      detilTrans.sort(function (a, b) {
        let masaA = String(a.masa || ""),
          masaB = String(b.masa || "");
        if (masaA !== masaB) return masaA.localeCompare(masaB);
        return String(a.tanggal || "").localeCompare(String(b.tanggal || ""));
      });

      let tableHtml =
        '<div style="overflow-x:auto; background-color:#000000; color:#ffffff;"><table style="width:100%; border-collapse:collapse; font-size:0.75rem; min-width:500px; background-color:#000000; color:#ffffff;"><thead style="background:#1a1a1a; position:sticky; top:0; color:#ffffff;"><tr><th style="border:1px solid #444; padding:5px;">MASA</th><th style="border:1px solid #444; padding:5px;">TGL</th><th style="border:1px solid #444; padding:5px;">NOREFF</th><th style="border:1px solid #444; padding:5px;">DESC</th><th style="border:1px solid #444; padding:5px; text-align:right;">DEBET</th><th style="border:1px solid #444; padding:5px; text-align:right;">KREDIT</th></tr></thead><tbody>';
      let totalDb = 0,
        totalCr = 0;
      let currentMasa = null;
      let subTotalDbMasa = 0;
      let subTotalCrMasa = 0;

      detilTrans.forEach(function (t, index) {
        let masaT = String(t.masa || "-");
        let dbVal = num(t.db || 0),
          crVal = num(t.cr || 0);

        // Jika berganti masa (dan bukan baris pertama), cetak subtotal masa sebelumnya
        if (currentMasa !== null && currentMasa !== masaT) {
          tableHtml +=
            '<tr style="background:#113f21; font-weight:bold;"><td colspan="4" style="border:1px solid #444; padding:4px; text-align:right; color:#a3d9a5;">SUBTOTAL MASA ' +
            currentMasa +
            '</td><td style="border:1px solid #444; padding:4px; text-align:right; color:#a3d9a5;">' +
            formatRupiah(subTotalDbMasa) +
            '</td><td style="border:1px solid #444; padding:4px; text-align:right; color:#a3d9a5;">' +
            formatRupiah(subTotalCrMasa) +
            "</td></tr>";

          // Reset subtotal untuk masa baru
          subTotalDbMasa = 0;
          subTotalCrMasa = 0;
        }

        currentMasa = masaT;
        subTotalDbMasa += dbVal;
        subTotalCrMasa += crVal;

        totalDb += dbVal;
        totalCr += crVal;

        tableHtml +=
          "<tr>" +
          '<td style="border:1px solid #444; padding:4px; text-align:center; color:#4da3ff;">' +
          masaT +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px; text-align:center;">' +
          t.tanggal +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          (t.noreff || "-") +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px;">' +
          (t.penjelasan || "-") +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px; text-align:right;">' +
          formatRupiah(dbVal) +
          "</td>" +
          '<td style="border:1px solid #444; padding:4px; text-align:right;">' +
          formatRupiah(crVal) +
          "</td></tr>";

        // Jika ini adalah baris terakhir dari seluruh transaksi, tampilkan subtotal masa terakhir
        if (index === detilTrans.length - 1) {
          tableHtml +=
            '<tr style="background:#113f21; font-weight:bold;"><td colspan="4" style="border:1px solid #444; padding:4px; text-align:right; color:#a3d9a5;">SUBTOTAL MASA ' +
            currentMasa +
            '</td><td style="border:1px solid #444; padding:4px; text-align:right; color:#a3d9a5;">' +
            formatRupiah(subTotalDbMasa) +
            '</td><td style="border:1px solid #444; padding:4px; text-align:right; color:#a3d9a5;">' +
            formatRupiah(subTotalCrMasa) +
            "</td></tr>";
        }
      });

      tableHtml +=
        '<tr style="background:#1b5e20; font-weight:bold;"><td colspan="4" style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">TOTAL YTD</td><td style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">' +
        formatRupiah(totalDb) +
        '</td><td style="border:1px solid #444; padding:5px; text-align:right; color:#fff;">' +
        formatRupiah(totalCr) +
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

  function hitungSubTotalPerCabang(digitTarget) {
    return daftarCabang.map(function (cab) {
      var total = 0;
      Object.keys(dataByCabang[cab] || {}).forEach(function (kodeGol) {
        if (String(kodeGol).charAt(0) === digitTarget) {
          total += dataByCabang[cab][kodeGol];
        }
      });
      return total;
    });
  }

  var dataPenjualan = hitungSubTotalPerCabang("3");
  var dataHPP = hitungSubTotalPerCabang("4");
  var dataAdmUmum = hitungSubTotalPerCabang("5");
  var dataLain2 = hitungSubTotalPerCabang("6");

  var dataRL = dataPenjualan.map(function (val, index) {
    var penjualanBersih = Math.abs(val);
    return (
      penjualanBersih - dataHPP[index] - dataAdmUmum[index] - dataLain2[index]
    );
  });

  var lebar = 1200,
    tinggi = 650;
  var kiri = (screen.width - lebar) / 2,
    atas = (screen.height - tinggi) / 2;

  var winGrafik = window.open(
    "",
    "GrafikRLCabangBarDonut",
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

  winGrafik.document.open();
  winGrafik.document.write(
    `<!DOCTYPE html><html><head><title>Grafik R/L Gabungan Per Cabang</title><script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"><\/script><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { background: #0b0f19; color: #fff; font-family: 'Segoe UI', sans-serif; overflow: hidden; } .header { text-align: center; padding: 12px 20px; background: linear-gradient(135deg, #141c2e 0%, #0f1623 100%); border-bottom: 1px solid #1c2844; display: flex; justify-content: center; align-items: center; gap: 25px; } .header h2 { font-size: 1.1rem; color: #f59e0b; } .legend-box { display: flex; gap: 15px; flex-wrap: wrap; } .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #8899b0; } .legend-dot { width: 10px; height: 10px; border-radius: 2px; } .charts-container { display: flex; width: 100%; height: calc(100vh - 50px); } #chartBar { width: 65%; height: 100%; border-right: 1px solid #1c2844; } #chartDonut { width: 35%; height: 100%; }</style></head><body><div class="header"><h2>Laba Rugi Gabungan</h2><div class="legend-box"><div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div>PENJUALAN</div><div class="legend-item"><div class="legend-dot" style="background:#3b82f6"></div>HPP</div><div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>BY. ADM & UMUM</div><div class="legend-item"><div class="legend-dot" style="background:#facc15"></div>BY. LAINNYA</div><div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>LABA/RUGI</div></div></div><div class="charts-container"><div id="chartBar"></div><div id="chartDonut"></div></div></body></html>`,
  );
  winGrafik.document.close();

  winGrafik.onload = function () {
    var formatRupiahLokal =
      typeof formatUang === "function"
        ? formatUang
        : function (val) {
            return val.toLocaleString("id-ID");
          };
    var barDom = winGrafik.document.getElementById("chartBar");
    var donutDom = winGrafik.document.getElementById("chartDonut");
    var barChart = winGrafik.echarts.init(barDom, "dark");
    var donutChart = winGrafik.echarts.init(donutDom, "dark");
    var warna = {
      penjualan: "#22c55e",
      hpp: "#3b82f6",
      adm: "#ef4444",
      lain: "#facc15",
      laba: "#f59e0b",
    };

    var optionBar = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "#1c2844",
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: function (params) {
          var tip = "<b>" + params[0].name + "</b><br/>";
          params.forEach(function (p) {
            var val = p.seriesName === "PENJUALAN" ? -p.value : p.value;
            tip +=
              '<span style="display:inline-block;margin-right:5px;border-radius:2px;width:10px;height:10px;background-color:' +
              p.color +
              ';"></span>' +
              p.seriesName +
              ": <b>" +
              formatRupiahLokal(val) +
              "</b><br/>";
          });
          return tip;
        },
      },
      legend: { show: false },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        top: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          color: "#8899b0",
          fontSize: 10,
          rotate: labels.length > 6 ? 30 : 0,
        },
        axisLine: { lineStyle: { color: "#1c2844" } },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#8899b0",
          fontSize: 10,
          formatter: function (val) {
            return formatRupiahLokal(val);
          },
        },
        splitLine: { lineStyle: { color: "#1c2844", type: "dashed" } },
      },
      series: [
        {
          name: "PENJUALAN",
          type: "bar",
          data: dataPenjualan.map(function (v) {
            return Math.abs(v);
          }),
          itemStyle: { color: warna.penjualan, borderRadius: [2, 2, 0, 0] },
          barMaxWidth: 20,
        },
        {
          name: "HPP",
          type: "bar",
          data: dataHPP,
          itemStyle: { color: warna.hpp, borderRadius: [2, 2, 0, 0] },
          barMaxWidth: 20,
        },
        {
          name: "BY. ADM & UMUM",
          type: "bar",
          data: dataAdmUmum,
          itemStyle: { color: warna.adm, borderRadius: [2, 2, 0, 0] },
          barMaxWidth: 20,
        },
        {
          name: "BY. LAINNYA",
          type: "bar",
          data: dataLain2,
          itemStyle: { color: warna.lain, borderRadius: [2, 2, 0, 0] },
          barMaxWidth: 20,
        },
        {
          name: "LABA/RUGI",
          type: "bar",
          data: dataRL,
          itemStyle: {
            color: function (params) {
              return params.value >= 0 ? warna.laba : "#ef4444";
            },
            borderRadius: [2, 2, 0, 0],
          },
          barMaxWidth: 20,
        },
      ],
    };

    var totalPenjualan = dataPenjualan.reduce(function (a, b) {
      return a + Math.abs(b);
    }, 0);
    var totalHPP = dataHPP.reduce(function (a, b) {
      return a + Math.abs(b);
    }, 0);
    var totalAdm = dataAdmUmum.reduce(function (a, b) {
      return a + Math.abs(b);
    }, 0);
    var totalLain = dataLain2.reduce(function (a, b) {
      return a + Math.abs(b);
    }, 0);
    var totalRL = dataRL.reduce(function (a, b) {
      return a + b;
    }, 0);

    var optionDonut = {
      title: {
        text: "Komposisi\nGabungan",
        left: "center",
        top: "center",
        textStyle: {
          color: "#fff",
          fontSize: 14,
          fontWeight: "normal",
          lineHeight: 20,
        },
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderColor: "#1c2844",
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: function (params) {
          var val = params.name === "PENJUALAN" ? -params.value : params.value;
          return (
            "<b>" +
            params.name +
            "</b><br/>Nilai: " +
            formatRupiahLokal(val) +
            " (" +
            params.percent +
            "%)"
          );
        },
      },
      series: [
        {
          type: "pie",
          radius: ["45%", "70%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 5,
            borderColor: "#0b0f19",
            borderWidth: 2,
          },
          label: {
            show: true,
            color: "#8899b0",
            fontSize: 11,
            formatter: "{b}\n{d}%",
          },
          labelLine: { lineStyle: { color: "#1c2844" } },
          emphasis: {
            label: {
              show: true,
              fontSize: 13,
              fontWeight: "bold",
              color: "#fff",
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
          data: [
            {
              value: totalPenjualan,
              name: "PENJUALAN",
              itemStyle: { color: warna.penjualan },
            },
            { value: totalHPP, name: "HPP", itemStyle: { color: warna.hpp } },
            {
              value: totalAdm,
              name: "BY. ADM & UMUM",
              itemStyle: { color: warna.adm },
            },
            {
              value: totalLain,
              name: "BY. LAINNYA",
              itemStyle: { color: warna.lain },
            },
            {
              value: Math.abs(totalRL),
              name: totalRL >= 0 ? "LABA BERSIH" : "RUGI BERSIH",
              itemStyle: { color: totalRL >= 0 ? warna.laba : "#ef4444" },
            },
          ],
        },
      ],
    };

    barChart.setOption(optionBar);
    donutChart.setOption(optionDonut);
    winGrafik.addEventListener("resize", function () {
      barChart.resize();
      donutChart.resize();
    });
  };
}
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

var _tmpMapGolonganForChart = {};

function gambarChartRLPerCabang(daftarCabang, mapGolongan, mapMasterCab) {
  var seriesGrafik = [];
  var catatanKakiPenjualan = {};
  var namaBulanFull = [
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

  // =========================================================================
  // 1. AMBIL BATAS BULAN YANG DIPILIH
  // =========================================================================
  var partMasa = window._rlGabFilterMasa.split("-");
  var bulanPilihan = Number(partMasa[0]);
  var tahunPilihan = partMasa[1];

  // Potong array bulan hanya sampai bulan yang dipilih
  var rentangBulanX = namaBulanFull.slice(0, bulanPilihan);

  daftarCabang.forEach(function (cab) {
    var namaCabangAsli = mapMasterCab[cab] || cab;
    var mapDataHPP = {};

    // Loop 12 bulan (karena datanya memang 12 bulan)
    for (let b = 1; b <= 12; b++) {
      var blnStr = ("0" + b).slice(-2);
      var totalPenjualan = 0;

      Object.keys(mapGolongan).forEach(function (kodeGol) {
        var itemData = mapGolongan[kodeGol];
        var digitDepan = String(kodeGol).charAt(0);

        var nilaiSaldo = 0;
        if (
          itemData &&
          itemData.bulan &&
          itemData.bulan[blnStr] !== undefined
        ) {
          nilaiSaldo = num(itemData.bulan[blnStr]);
        }

        if (digitDepan === "3") {
          totalPenjualan += nilaiSaldo;
        } else if (digitDepan === "4") {
          // Simpan objek lengkapnya (termasuk namaGol) agar bisa dipakai saat membuat series
          if (!mapDataHPP[kodeGol])
            mapDataHPP[kodeGol] = { nama: itemData.namaGol || "-", data: [] };
          mapDataHPP[kodeGol].data.push(nilaiSaldo);
        }
      });

      // Simpan penjualan positif untuk catatan kaki
      catatanKakiPenjualan[b] =
        (catatanKakiPenjualan[b] || 0) + totalPenjualan * -1;
    }

    // --- BUAT GARIS HPP TERPERINCI (MENGGUNAKAN NAMA GOLONGAN) ---
    Object.keys(mapDataHPP).forEach(function (kodeHPP) {
      var objHPP = mapDataHPP[kodeHPP];

      // 🔥 POTONG DATA HPP: Ambil hanya array dari index 0 sampai bulanPilihan
      var dataHPPTerpotong = objHPP.data.slice(0, bulanPilihan);

      var adaDataHPP = dataHPPTerpotong.some(function (val) {
        return val !== 0;
      });

      if (adaDataHPP) {
        seriesGrafik.push({
          // ✅ PERUBAHAN: Nama series diambil dari namaGol (ex: "Ayam") + kode (ex: "401")
          name: objHPP.nama + " (" + kodeHPP + ")",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: dataHPPTerpotong,
          lineStyle: { width: 2 },
          emphasis: { focus: "series" },
        });
      }
    });
  });

  // =========================================================================
  // 2. SIAPKAN CATATAN KAKI (JUGA DIPOTONG SESUAI BULAN)
  // =========================================================================
  var footnotes = [];
  for (let i = 1; i <= bulanPilihan; i++) {
    var valPenj = catatanKakiPenjualan[i] || 0;
    footnotes.push("Penj: Rp " + Number(valPenj).toLocaleString("id-ID"));
  }

  // =========================================================================
  // 3. BUKA POPUP
  // =========================================================================
  var lebarLayarMaksimal = window.screen.availWidth;
  var tinggiLayarMaksimal = window.screen.availHeight;
  var lebar = Math.floor(lebarLayarMaksimal / 2);
  var tinggi = tinggiLayarMaksimal - 60;
  var kiri = lebar;
  var atas = 0;

  var winGrafik = window.open(
    "",
    "GrafikRLLebarPerCabang",
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
    alert("Mohon izinkan pop-up pada browser Anda.");
    return;
  }

  winGrafik.document.open();
  winGrafik.document.write(`<!DOCTYPE html><html><head>
  <title>Rincian Tren HPP s/d Bulan Pilihan</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; } 
    body { background: #0b0f19; color: #fff; font-family: 'Segoe UI', sans-serif; padding: 15px; overflow-y: auto; } 
    .header-container { text-align: center; margin-bottom: 15px; padding: 10px; background: #0f1623; border: 1px solid #1c2844; border-radius: 6px; }
    .header-container h2 { font-size: 1.15rem; color: #f59e0b; }
    .header-container p { font-size: 0.78rem; color: #8899b0; margin-top: 3px; }
    #canvasChart { width: 100%; height: 85vh; background: #0f1623; border: 1px solid #1c2844; border-radius: 8px; padding: 12px; }
    .loading-text { color: #f59e0b; text-align: center; margin-top: 50px; font-size: 1.2rem; }
  </style></head>
  <body>
    <div class="header-container">
      <h2>Tren Rincian HPP Komponen</h2>
      <p>Analisis Akumulatif Januari s/d ${rentangBulanX[rentangBulanX.length - 1]} ${tahunPilihan}</p>
    </div>
    <div id="canvasChart"><div class="loading-text">Memuat Grafik...</div></div>
    
    <script>
      function waitEcharts(cb) {
        if (typeof echarts !== "undefined") { cb(); return; }
        setTimeout(function() { waitEcharts(cb); }, 100);
      }

      waitEcharts(function() {
        var domTarget = document.getElementById("canvasChart");
        domTarget.innerHTML = ""; 
        var lineChart = echarts.init(domTarget, "dark");

        var formatMataUang = function (val) {
          return "Rp " + Number(val).toLocaleString("id-ID");
        };

        var optionLine = {
          backgroundColor: "#0f1623",
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "cross", label: { backgroundColor: "#141c2e" } },
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            borderColor: "#1c2844",
            textStyle: { color: "#fff", fontSize: 11 },
            formatter: function (params) {
              var tip = "<b>Bulan: " + params[0].name + "</b><br/>";
              params.sort((a, b) => b.value - a.value);
              params.forEach(function (p) {
                tip += '<span style="display:inline-block;margin-right:5px;border-radius:50%;width:8px;height:8px;background-color:' + p.color + ';"></span>' + p.seriesName + ': <b style="color:' + p.color + '">' + formatMataUang(p.value) + '</b><br/>';
              });
              return tip;
            },
          },
          legend: { 
            type: "scroll", 
            bottom: 0, 
            // ✅ PERUBAHAN: Legenda dibuat lebih lebar agar teks panjang tidak kepotong
            width: "90%", 
            itemWidth: 20, 
            itemHeight: 10,
            textStyle: { color: "#8899b0", fontSize: 10 }
          },
          grid: { 
            left: "4%", right: "4%", bottom: "20%", top: "6%", containLabel: true 
          },
          xAxis: {
            type: "category",
            boundaryGap: false,
            data: ${JSON.stringify(rentangBulanX)},
            axisLabel: { 
              color: "#8899b0", 
              fontSize: 11, 
              fontWeight: "bold",
              formatter: function (value, index) {
                return '{title|' + value + '}\\n{foot|' + ${JSON.stringify(footnotes)}[index] + '}';
              },
              rich: {
                title: { color: '#fff', lineHeight: 18 },
                foot: { color: '#f59e0b', fontSize: 9, lineHeight: 14 }
              }
            },
            axisLine: { lineStyle: { color: "#1c2844" } },
            axisTick: { alignWithLabel: true, lineStyle: { color: "#1c2844" } } 
          },
          yAxis: {
            type: "value",
            min: 'dataMin', 
            axisLabel: {
              color: "#8899b0", fontSize: 10,
              formatter: function (v) {
                if (Math.abs(v) >= 1000000000) return (v / 1000000000).toFixed(1) + ' M';
                if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1) + ' Jt';
                if (Math.abs(v) >= 1000) return (v / 1000).toFixed(0) + ' Rb';
                return v.toLocaleString("id-ID");
              },
            },
            splitLine: { lineStyle: { color: "#1c2844", type: "dashed" } },
          },
          series: ${JSON.stringify(seriesGrafik)}
        };

        lineChart.setOption(optionLine);
        window.addEventListener("resize", function () { lineChart.resize(); });
      });
    <\/script>
  </body></html>`);
  winGrafik.document.close();
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

  // ==========================================
  // CEK LEVEL USER: PUSAT ATAU BUKAN?
  // ==========================================
  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";

  var activeGroup = localStorage.getItem("group") || "TLGA";
  console.log(
    "🎨 [Arus Kas Render] Level User:",
    isPusat ? "PUSAT" : userCabang,
    "| Group Default:",
    activeGroup,
  );

  // ==========================================
  // SIAPKAN DROPDOWN GROUP (HANYA UNTUK PUSAT)
  // ==========================================
  var groupUiHtml = "";
  if (isPusat) {
    groupUiHtml =
      '<div style="display:flex; align-items:center; gap:5px;">' +
      '<label style="font-size:.75rem; color:var(--muted);">Filter Group:</label>' +
      '<select id="filter_aruskas_group" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; font-weight:bold;">';

    var listGroup = DBCache.groupproject || [];
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
    // JIKA BUKAN PUSAT: TAMPILKAN TEKS MATI (HIDDEN DROPDOWN)
    groupUiHtml =
      '<div style="font-size:.8rem; color:var(--muted);">Group: <span style="color:var(--accent); font-weight:bold;">' +
      esc(activeGroup) +
      "</span></div>";
  }

  var htmlLaporan =
    '<div id="area_cetak_rlgab" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:visible;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan Arus Kas Gabungan (Semua Cabang)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    // MASUKKAN HTML GROUP YANG SUDAH DIKONDISIKAN DI SINI
    groupUiHtml +
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
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data. <i>(Klik nama cabang untuk melihat Arus Kas Lebar 12 Bulan)</i></p>' +
    "</div>";

  return htmlLaporan;
}

async function terapkanOpsiArusKasGabungan() {
  var inputmasa = document.getElementById("filter_aruskas_masa");
  if (!inputmasa) return;
  var valmasa = inputmasa.value;
  if (!valmasa) {
    if (typeof toast === "function")
      toast("Silakan pilih masa terlebih dahulu", "err");
    return;
  }

  // ==========================================
  // 1. SIMPAN GROUP YANG DIPILIH
  // ==========================================
  var groupDropdown = document.getElementById("filter_aruskas_group");
  if (groupDropdown) {
    var selectedGroup = groupDropdown.value;
    localStorage.setItem("group", selectedGroup);
  }

  var activeGroup = localStorage.getItem("group") || "TLGA";
  console.log(
    "🟢 [Arus Kas Proses] Tombol Terapkan diklik. Group yang akan dipakai:",
    activeGroup,
  );

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
    console.log("📡 [Arus Kas Proses] Mengambil data Master Golongan...");
    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namagol || m.nama || "").trim();
        if (kode) mapMasterGol[kode] = nama;
      });
    }

    console.log("📡 [Arus Kas Proses] Mengambil data Master Cabang...");
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

    console.log(
      "📡 [Arus Kas Proses] Mengambil data Golongan Tahunan:",
      namastoregolbackup,
      "| Mencari Tahun:",
      duadigittahunbelakang,
      "| Group:",
      activeGroup,
    );
    var resgolbackup = await db.getAll(namastoregolbackup);
    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    window._debugDataByCabang = {};
    var dataByCabang = window._debugDataByCabang;
    var tahunDicari = kodemasadicari.slice(-2);

    rawdatagolongan.forEach(function (g) {
      var kodeGol = String(g.gol || g.golongan || "").trim();
      var cabangData = String(g.cabang || g.cab || g.kode_cabang || "").trim();
      var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

      if (!setValidCabang.has(cabangData)) return;
      if (String(g.group || "").trim() !== activeGroup) return;

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

        // ✅ DIPASTIKAN MENJADI ANGKA (FLOAT) SUPAYA TIDAK JADI STRING
        var valDb = parseFloat(g.db) || 0;
        var valCr = parseFloat(g.cr) || 0;
        var saldoAkhir = -valDb + valCr;

        dataByCabang[cabangData][kodeGol] += saldoAkhir;
      }
    });

    var daftarCabang = Object.keys(dataByCabang).sort();
    console.log(
      "✅ [Arus Kas Proses] Selesai filter. Cabang yang dapat data:",
      daftarCabang.length,
      "cabang",
    );

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
        totalSemuaCabang +=
          (dataByCabang[cab] && dataByCabang[cab][kodeGol]) || 0;
      });
      return totalSemuaCabang !== 0;
    });

    // BUAT SALDO AWAL
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
        if (String(s.group || "").trim() !== activeGroup) return;

        if (parseInt(kodeGol) < 103 && masaData === kodemasasebelumnya) {
          if (totalSaldoAwalByCabang[cabangData] === undefined)
            totalSaldoAwalByCabang[cabangData] = 0;
          totalSaldoAwalByCabang[cabangData] += parseFloat(s.awal) || 0;
        }
      });
    }

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
        var nPerk = String(mp.noper || "").trim();
        var nMasa = String(mp.masa || mp.periode || mp.kode_masa || "").trim();
        var perkBersih = nPerk.replace(/[^0-9]/g, "");
        if (perkBersih.length === 0) return false;
        var kepalaPerk = perkBersih.substring(0, 3);

        if (String(mp.group || "").trim() !== activeGroup) return false;

        return (
          (kepalaPerk === "100" ||
            kepalaPerk === "101" ||
            kepalaPerk === "102") &&
          nMasa === kodemasadicari
        );
      })
      .map(function (mp) {
        var nPerk = String(mp.noper || "").trim();
        var nNama = String(mp.penjelasan || mp.namaPerkiraan || "").trim();
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

    console.log(mapPerkiraanDifilter);

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

    var htmlTombol =
      '<div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">';
    htmlTombol +=
      '<span style="font-weight:bold; font-size:1.1rem; color:#004085;">ARUS KAS GABUNGAN - MASA: ' +
      window._rlGabFilterMasa +
      "</span>";
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
        activeGroup,
      );
  } catch (error) {
    console.error("❌ Gagal total Arus Kas Gabungan:", error);
    if (area)
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}

// ==========================================
// FUNGSI GENERATE HTML (DENGAN PENGAMAN)
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
  activeGroupLabel,
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
      totalSemuaCabang +=
        (dataByCabang[cab] && dataByCabang[cab][kodeGol]) || 0;
    });
    if (totalSemuaCabang > 0) arrPemasukan.push(kodeGol);
    else if (totalSemuaCabang < 0) arrPengeluaran.push(kodeGol);
  });

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
          totalCab += (dataByCabang[cab] && dataByCabang[cab][key]) || 0;
        });
      }
      grandTotal += totalCab;
      htmlSub +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; color:' +
        color +
        ' !important; background-color:#f8f9fa !important;">' +
        formatRupiah(totalCab) +
        "</td>";
    });
    htmlSub +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:' +
      color +
      ' !important; background-color:#f8f9fa !important;">' +
      formatRupiah(grandTotal) +
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
      // ✅ AMAN DARI ERROR 'undefined' JIKA CABANG KOSONG
      var saldo =
        dataByCabang[cab] && dataByCabang[cab][key]
          ? dataByCabang[cab][key]
          : 0;

      totalRow += saldo;
      var xNum = isForExcel ? ' x:num="' + saldo + '"' : "";
      htmlRow +=
        '<td style="padding:8px; border:1px solid #000; text-align:right;"' +
        xNum +
        ">" +
        formatRupiah(saldo) +
        "</td>";
    });

    var xNumTotal = isForExcel ? ' x:num="' + totalRow + '"' : "";
    htmlRow +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; font-weight:bold;"' +
      xNumTotal +
      ">" +
      formatRupiah(totalRow) +
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
          grandTotal += (dataByCabang[cab] && dataByCabang[cab][key]) || 0;
        });
      }
    });
    return grandTotal;
  }

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
      formatRupiah(saCab) +
      "</td>";
  });
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; font-weight:bold;">' +
    formatRupiah(saTotalGlobal) +
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
      stCab += (dataByCabang[cab] && dataByCabang[cab][g]) || 0;
    });
    stPemTotal += stCab;
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right; color:#0f5132 !important; background-color:#f8f9fa !important;">' +
      formatRupiah(stCab) +
      "</td>";
  });
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; color:#0f5132 !important; background-color:#f8f9fa !important;">' +
    formatRupiah(stPemTotal) +
    "</td></tr>";

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
      selCab += (dataByCabang[cab] && dataByCabang[cab][g]) || 0;
    });
    arrPengeluaran.forEach(function (g) {
      selCab += (dataByCabang[cab] && dataByCabang[cab][g]) || 0;
    });
    selGrandTotal += selCab;
    html +=
      '<td style="padding:10px; border:1px solid #000; text-align:right;">' +
      formatRupiah(selCab) +
      "</td>";
  });
  html +=
    '<td style="padding:10px; border:1px solid #000; text-align:right;">' +
    formatRupiah(selGrandTotal) +
    "</td></tr>";

  html +=
    '<tr><td colspan="' +
    (daftarCabang.length + 3) +
    '" style="height:15px; border:none; background:transparent;"></td></tr>';

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
          formatRupiah(saldo) +
          "</td>";
      });
      html +=
        '<td style="padding:8px; border:1px solid #000; text-align:right; font-weight:bold;">' +
        formatRupiah(totalRow) +
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

  var totalKasBankG = hitungTotalGlobal(mapPerkiraanDifilter, "kasbank", true);
  var grandTotalAkhir = selGrandTotal + totalKasBankG;

  html +=
    "<tr style='background-color:#343a40; color:#fff; font-weight:bold; font-size:1.1rem;'><td colspan='2' style='padding:12px; border:1px solid #000; text-align:right;'>TOTAL AKHIR</td>";
  var gtGrandTotal = 0;
  daftarCabang.forEach(function (cab) {
    var gtCab = totalSaldoAwalByCabang[cab] || 0;
    arrPemasukan.forEach(function (g) {
      gtCab += (dataByCabang[cab] && dataByCabang[cab][g]) || 0;
    });
    arrPengeluaran.forEach(function (g) {
      gtCab += (dataByCabang[cab] && dataByCabang[cab][g]) || 0;
    });
    mapPerkiraanDifilter.forEach(function (item) {
      if (item.cabang === cab) gtCab -= item.saldo || 0;
    });
    gtGrandTotal += gtCab;
    html +=
      '<td style="padding:12px; border:1px solid #000; text-align:right;">' +
      formatRupiah(gtCab) +
      "</td>";
  });
  html +=
    '<td style="padding:12px; border:1px solid #000; text-align:right;">' +
    formatRupiah(gtGrandTotal) +
    "</td></tr>";

  html += "</tbody></table></div>";
  return html;
}

// ==========================================

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
  var activeGroupLabel = localStorage.getItem("group") || "TLGA"; // ✅ TAMBAHAN OPSI GROUP

  var htmlExcel = generateHTMLArusKasGabungan(
    data.daftarCabang,
    data.arrKodeGol,
    data.dataByCabang,
    data.mapMasterGol,
    data.mapMasterCab,
    true,
    window._rlGabTotalSaldoAwal || {},
    window._rlGabMapPerkiraan || [],
    activeGroupLabel, // ✅ KIRIM KE GENERATOR
  );

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
      <h3 style="text-align:center;">Group: ${activeGroupLabel} | Masa: ${window._rlGabFilterMasa}</h3>
      ${htmlExcel}
    </body>
    </html>
  `;

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  // ✅ TAMBAHAN OPSI GROUP: MASUKKAN GROUP KE NAMA FILE
  link.download =
    "ArusKas_Gabungan_Group_" +
    activeGroupLabel +
    "_" +
    window._rlGabFilterMasa.replace(/-/g, "") +
    ".xls";
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
    var activeGroup = localStorage.getItem("group") || "TLGA";
    var valmasa = window._rlGabFilterMasa;
    var part = valmasa.split("-");
    var filterbulan = part[0].trim();
    var filtertahunfull = part[1].trim();
    var duadigittahunbelakang = filtertahunfull.substring(2, 4);
    var kodemasadicari = filterbulan + duadigittahunbelakang;
    var namastoregolbackup = "golongan" + filtertahunfull;

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

    var rawMasterGol = await db.getAll("golongan");
    var mapMasterGol = {};
    if (rawMasterGol) {
      var arrMasterGol = Array.isArray(rawMasterGol)
        ? rawMasterGol
        : Object.values(rawMasterGol);
      arrMasterGol.forEach(function (m) {
        var kode = String(m.gol || m.kode_gol || "").trim();
        var nama = String(m.namagol || m.nama || m.nama_golongan || "").trim();
        if (kode) {
          mapMasterGol[kode] = nama;
          mapMasterGol[Number(kode)] = nama;
          mapMasterGol[String(kode)] = nama;
        }
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

    var resgolbackup = [];
    try {
      resgolbackup = await db.getAll(namastoregolbackup);
    } catch (errDb) {
      try {
        resgolbackup = await db.getAll("golongan");
      } catch (e) {
        console.error("Gagal ambil data golongan:", e);
      }
    }

    var rawdatagolongan = resgolbackup
      ? Array.isArray(resgolbackup)
        ? resgolbackup
        : Object.values(resgolbackup)
      : [];

    var dataPerBulan = {};
    var setKodeGol = new Set();

    rawdatagolongan.forEach(function (g) {
      var kodeGol = String(g.gol || g.golongan || "").trim();
      var cabangData = String(g.cabang || g.cab || g.kode_cabang || "").trim();
      var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

      if (cabangData !== kodeCabang) return;
      if (parseInt(kodeGol) <= 102 || parseInt(kodeGol) >= 300) return;
      if (masaData > kodemasadicari) return;
      if (masaData.slice(-2) !== duadigittahunbelakang) return;
      if (String(g.group || "").trim() !== activeGroup) return;

      setKodeGol.add(kodeGol);
      if (!dataPerBulan[kodeGol]) dataPerBulan[kodeGol] = {};
      if (!dataPerBulan[kodeGol][masaData]) dataPerBulan[kodeGol][masaData] = 0;

      var valDb = parseFloat(g.db) || 0;
      var valCr = parseFloat(g.cr) || 0;
      var saldoAkhir = -valDb + valCr;

      dataPerBulan[kodeGol][masaData] += saldoAkhir;
    });

    var arrKodeGol = Array.from(setKodeGol).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });

    var arrPemasukan = [];
    var arrPengeluaran = [];

    arrKodeGol.forEach(function (kodeGol) {
      var totalSemuaBulan = 0;
      arrBulan.forEach(function (b) {
        totalSemuaBulan +=
          (dataPerBulan[kodeGol] && dataPerBulan[kodeGol][b.kode]) || 0;
      });

      if (totalSemuaBulan === 0) return;

      if (totalSemuaBulan > 0) arrPemasukan.push(kodeGol);
      else arrPengeluaran.push(kodeGol);
    });

    function getSaldoAwalKasBankBulan(kodeMasaBulan) {
      var totalAwalBulan = 0;
      rawdatagolongan.forEach(function (s) {
        var kodeGol = String(s.gol || s.golongan || "").trim();
        var cabangData = String(
          s.cabang || s.cab || s.kode_cabang || "",
        ).trim();
        var masaData = String(s.masa || s.periode || s.kode_masa || "").trim();

        if (cabangData !== kodeCabang) return;
        if (parseInt(kodeGol) > 102) return;
        if (String(s.group || "").trim() !== activeGroup) return;
        if (masaData !== kodeMasaBulan) return;

        totalAwalBulan += parseFloat(s.awal) || 0;
      });
      return totalAwalBulan;
    }

    var namaCabTampil = mapMasterCab[kodeCabang] || kodeCabang;
    var htmlOutput = "";
    htmlOutput +=
      '<div style="display:flex; gap:10px; margin-bottom:15px; align-items:center; flex-wrap:wrap; justify-content:space-between;">';

    htmlOutput += '<div style="display:flex; gap:10px; align-items:center;">';
    htmlOutput +=
      '<button onclick="kembaliKeGabungan()" style="padding:8px 16px; background:#6c757d; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">⬅ Kembali</button>';
    htmlOutput +=
      '<span style="font-weight:bold; font-size:1.1rem; color:#004085;">ARUS KAS PER BULAN - CABANG: ' +
      namaCabTampil +
      " | TAHUN: " +
      filtertahunfull +
      "</span>";
    htmlOutput += "</div>";

    htmlOutput +=
      "<button onclick=\"exportTabelArusKasXLS('tabelArusKasCabang', 'Arus_Kas_" +
      kodeCabang +
      "_" +
      filtertahunfull +
      '\')" style="padding:8px 16px; background:#198754; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📥 Export ke XLS</button>';
    htmlOutput += "</div>";

    htmlOutput +=
      '<div style="overflow-x:auto; border:1px solid #ccc; border-radius:5px;">';
    htmlOutput +=
      '<table id="tabelArusKasCabang" class="table table-bordered table-sm" style="font-size:0.85rem; margin-bottom:0; white-space:nowrap;">';

    htmlOutput += "<thead>";
    htmlOutput +=
      '<tr><th colspan="' +
      (arrBulan.length + 2) +
      '" style="text-align:center; font-size:1.1rem; background-color:#f8f9fa; color:#000; padding:10px;">LAPORAN ARUS KAS PER BULAN</th></tr>';
    htmlOutput +=
      '<tr><th colspan="' +
      (arrBulan.length + 2) +
      '" style="text-align:center; font-size:1rem; background-color:#f8f9fa; color:#000; padding:5px;">CABANG: ' +
      namaCabTampil +
      " | TAHUN: " +
      filtertahunfull +
      "</th></tr>";
    htmlOutput +=
      '<tr><th colspan="' +
      (arrBulan.length + 2) +
      '" style="background-color:#fff; border:none; height:10px;"></th></tr>';
    htmlOutput += "</thead>";

    htmlOutput += '<thead class="table-dark text-center"><tr>';
    htmlOutput +=
      '<th style="min-width:250px; text-align:left;background:#28a745; color:#fff;">Uraian Arus Kas</th>';
    arrBulan.forEach(function (b) {
      htmlOutput +=
        '<th style="min-width:120px; text-align:centre;background:#28a745; color:#fff">' +
        b.label +
        "</th>";
    });
    htmlOutput +=
      '<th style="min-width:120px; text-align:centre; background:#28a745 !important; color:#fff !important;">TOTAL</th>';
    htmlOutput += "</tr></thead><tbody>";

    // Pemasukan Section
    if (arrPemasukan.length > 0) {
      htmlOutput +=
        "<tr><td colspan='" +
        (arrBulan.length + 2) +
        "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#d1e7dd; color:#0f5132;'>PEMASUKAN</td></tr>";

      // Saldo Awal Kas & Bank (background warna hanya sampai kolom TOTAL saja menggunakan background transparent untuk kolom bulanan atau styling spesifik)
      htmlOutput +=
        '<tr style="font-weight:bold;"><td style="background-color:#ff8c00; color:#fff;">Saldo Awal Kas & Bank</td>';

      arrBulan.forEach(function (b) {
        var valSaldoAwalBulanIni = getSaldoAwalKasBankBulan(b.kode);
        htmlOutput +=
          '<td style="text-align:right !important;background-color:#ff8c00;" class="text-end">' +
          formatRupiah(valSaldoAwalBulanIni) +
          "</td>";
      });

      var kodeMasaBulanPertama = arrBulan.length > 0 ? arrBulan[0].kode : "";
      var saldoAwalBulan1Total = getSaldoAwalKasBankBulan(kodeMasaBulanPertama);
      htmlOutput +=
        '<td style="text-align:right !important; background:#ff8c00; color:#fff; font-weight:bold;" class="text-end">' +
        formatRupiah(saldoAwalBulan1Total) +
        "</td></tr>";

      arrPemasukan.forEach(function (kodeGol) {
        var namaGol =
          mapMasterGol[kodeGol] ||
          mapMasterGol[String(kodeGol)] ||
          mapMasterGol[Number(kodeGol)] ||
          "GOL " + kodeGol;
        var totalGol = 0;
        htmlOutput +=
          "<tr><td style='padding-left:20px;'>" +
          kodeGol +
          " - " +
          namaGol +
          "</td>";
        arrBulan.forEach(function (b) {
          var val =
            dataPerBulan[kodeGol] && dataPerBulan[kodeGol][b.kode]
              ? dataPerBulan[kodeGol][b.kode]
              : 0;
          totalGol += val;
          htmlOutput +=
            '<td style="text-align:right !important;" class="text-end">' +
            formatRupiah(val) +
            "</td>";
        });
        htmlOutput +=
          '<td style="text-align:right !important; font-weight:bold; background:#000; color:#fff;" class="text-end">' +
          formatRupiah(totalGol) +
          "</td></tr>";
      });

      // Subtotal Pemasukan
      htmlOutput +=
        '<tr style="font-weight:bold; border-top:1.5px solid #000;"><td style="background-color:#ff8c00; color:#fff;">SUBTOTAL PEMASUKAN</td>';
      var totalSubPemasukanAll = 0;
      arrBulan.forEach(function (b) {
        var subBulan = 0;
        arrPemasukan.forEach(function (kodeGol) {
          subBulan +=
            (dataPerBulan[kodeGol] && dataPerBulan[kodeGol][b.kode]) || 0;
        });
        totalSubPemasukanAll += subBulan;
        htmlOutput +=
          '<td style="text-align:right !important;background-color:#ff8c00" class="text-end">' +
          formatRupiah(subBulan) +
          "</td>";
      });
      htmlOutput +=
        '<td style="text-align:right !important; background:#ff8c00; color:#fff;" class="text-end">' +
        formatRupiah(totalSubPemasukanAll) +
        "</td></tr>";
    }

    // Pengeluaran Section
    if (arrPengeluaran.length > 0) {
      htmlOutput +=
        "<tr><td colspan='" +
        (arrBulan.length + 2) +
        "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#f8d7da; color:#842029;'>PENGELUARAN</td></tr>";
      arrPengeluaran.forEach(function (kodeGol) {
        var namaGol =
          mapMasterGol[kodeGol] ||
          mapMasterGol[String(kodeGol)] ||
          mapMasterGol[Number(kodeGol)] ||
          "GOL " + kodeGol;
        var totalGol = 0;
        htmlOutput +=
          "<tr><td style='padding-left:20px;'>" +
          kodeGol +
          " - " +
          namaGol +
          "</td>";
        arrBulan.forEach(function (b) {
          var val =
            dataPerBulan[kodeGol] && dataPerBulan[kodeGol][b.kode]
              ? dataPerBulan[kodeGol][b.kode]
              : 0;
          totalGol += val;
          htmlOutput +=
            '<td style="text-align:right !important;" class="text-end">' +
            formatRupiah(val) +
            "</td>";
        });
        htmlOutput +=
          '<td style="text-align:right !important; font-weight:bold; background:#000; color:#fff;" class="text-end">' +
          formatRupiah(totalGol) +
          "</td></tr>";
      });

      // Subtotal Pengeluaran
      htmlOutput +=
        '<tr style="font-weight:bold; border-top:1.5px solid #000;"><td style="background-color:#ff8c00; color:#fff;">SUBTOTAL PENGELUARAN</td>';
      var totalSubPengeluaranAll = 0;
      arrBulan.forEach(function (b) {
        var subBulan = 0;
        arrPengeluaran.forEach(function (kodeGol) {
          subBulan +=
            (dataPerBulan[kodeGol] && dataPerBulan[kodeGol][b.kode]) || 0;
        });
        totalSubPengeluaranAll += subBulan;
        htmlOutput +=
          '<td style="text-align:right !important;background-color:#ff8c00;" class="text-end">' +
          formatRupiah(subBulan) +
          "</td>";
      });
      htmlOutput +=
        '<td style="text-align:right !important; background:#ff8c00; color:#fff;" class="text-end">' +
        formatRupiah(totalSubPengeluaranAll) +
        "</td></tr>";
    }

    // Saldo Akhir Kas & Bank
    htmlOutput +=
      '<tr style="font-weight:bold; border-top:2px solid #000;"><td style="background-color:#28a745; color:#fff;">Saldo Akhir Kas & Bank</td>';
    var totalAkhirKeseluruhan = 0;

    arrBulan.forEach(function (b) {
      var saldoAwalBulanIni = getSaldoAwalKasBankBulan(b.kode);
      var totalArusBulanIni = 0;
      arrKodeGol.forEach(function (gol) {
        totalArusBulanIni +=
          dataPerBulan[gol] && dataPerBulan[gol][b.kode]
            ? dataPerBulan[gol][b.kode]
            : 0;
      });

      var saldoAkhirBulanIni = saldoAwalBulanIni + totalArusBulanIni;
      totalAkhirKeseluruhan = saldoAkhirBulanIni;

      htmlOutput +=
        '<td style="text-align:right !important;background:#28a745; color:#fff;" class="text-end">' +
        formatRupiah(saldoAkhirBulanIni) +
        "</td>";
    });
    htmlOutput +=
      '<td style="text-align:right !important; background:#28a745; color:#fff; font-size:1rem;" class="text-end">' +
      formatRupiah(totalAkhirKeseluruhan) +
      "</td></tr>";

    // --- RINCIAN DATA KAS DAN BANK (KODE GOL < 103) ---
    var setKasBank = new Set();
    rawdatagolongan.forEach(function (g) {
      var kodeGol = String(g.gol || g.golongan || "").trim();
      var cabangData = String(g.cabang || g.cab || g.kode_cabang || "").trim();
      var masaData = String(g.masa || g.periode || g.kode_masa || "").trim();

      if (cabangData !== kodeCabang) return;
      if (parseInt(kodeGol) >= 103) return;
      if (masaData > kodemasadicari) return;
      if (masaData.slice(-2) !== duadigittahunbelakang) return;
      if (String(g.group || "").trim() !== activeGroup) return;

      setKasBank.add(kodeGol);
    });

    var arrKasBank = Array.from(setKasBank).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });

    if (arrKasBank.length > 0) {
      htmlOutput +=
        "<tr><td colspan='" +
        (arrBulan.length + 2) +
        "' style='padding:8px; border:1px solid #000; font-weight:bold; background-color:#e2efe5; color:#000;'>RINCIAN DATA KAS DAN BANK</td></tr>";

      var totalKeseluruhanKasBank = 0;
      var arrSubtotalPerBulanKas = new Array(arrBulan.length).fill(0);
      var kodeMasaBulanTerakhir =
        arrBulan.length > 0 ? arrBulan[arrBulan.length - 1].kode : "";

      arrKasBank.forEach(function (kodeGol) {
        var namaGol =
          mapMasterGol[kodeGol] ||
          mapMasterGol[String(kodeGol)] ||
          mapMasterGol[Number(kodeGol)] ||
          "GOL " + kodeGol;

        var totalBarisKas = 0;
        var saldoAkhirBulanTerakhirBaris = 0;

        htmlOutput +=
          "<tr><td style='padding-left:20px;'>" +
          kodeGol +
          " - " +
          namaGol +
          "</td>";

        arrBulan.forEach(function (b, indexBulan) {
          var saldoAkhirBulanKas = 0;
          rawdatagolongan.forEach(function (g) {
            var gGol = String(g.gol || g.golongan || "").trim();
            var gCab = String(g.cabang || g.cab || g.kode_cabang || "").trim();
            var gMasa = String(g.masa || g.periode || g.kode_masa || "").trim();
            if (
              gCab === kodeCabang &&
              gGol === kodeGol &&
              gMasa === b.kode &&
              String(g.group || "").trim() === activeGroup
            ) {
              saldoAkhirBulanKas += parseFloat(g.akhir) || 0;
            }
          });
          totalBarisKas += saldoAkhirBulanKas;
          arrSubtotalPerBulanKas[indexBulan] += saldoAkhirBulanKas;

          if (b.kode === kodeMasaBulanTerakhir) {
            saldoAkhirBulanTerakhirBaris = saldoAkhirBulanKas;
          }

          htmlOutput +=
            '<td style="text-align:right !important;" class="text-end">' +
            formatRupiah(saldoAkhirBulanKas) +
            "</td>";
        });

        totalKeseluruhanKasBank += saldoAkhirBulanTerakhirBaris;
        htmlOutput +=
          '<td style="text-align:right !important; font-weight:bold; background:#000; color:#fff;" class="text-end">' +
          formatRupiah(saldoAkhirBulanTerakhirBaris) +
          "</td></tr>";
      });

      htmlOutput +=
        '<tr style="font-weight:bold; border-top:1.5px solid #000;"><td style="background-color:#28a745; color:#fff;">SUBTOTAL RINCIAN KAS DAN BANK</td>';

      var subtotalBulanTerakhirKas =
        arrSubtotalPerBulanKas.length > 0
          ? arrSubtotalPerBulanKas[arrSubtotalPerBulanKas.length - 1]
          : 0;

      arrSubtotalPerBulanKas.forEach(function (subVal) {
        htmlOutput +=
          '<td style="text-align:right !important;background:#28a745; color:#fff;" class="text-end">' +
          formatRupiah(subVal) +
          "</td>";
      });
      htmlOutput +=
        '<td style="text-align:right !important; background:#28a745; color:#fff;" class="text-end">' +
        formatRupiah(subtotalBulanTerakhirKas) +
        "</td></tr>";
    }

    htmlOutput += "</tbody></table></div>";
    if (areaTabel) areaTabel.innerHTML = htmlOutput;
  } catch (error) {
    console.error("❌ Gagal memuat Arus Kas Per Cabang:", error);
    if (areaTabel)
      areaTabel.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
  }
}

function exportTabelArusKasXLS(idTabel, namaFile) {
  var elementTable = document.getElementById(idTabel);
  if (!elementTable) {
    if (typeof toast === "function") toast("Tabel tidak ditemukan", "err");
    return;
  }

  var html = elementTable.outerHTML;
  var url = "data:application/vnd.ms-excel," + encodeURIComponent(html);
  var downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = (namaFile || "laporan") + ".xls";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

function formatRupiah(angka) {
  if (isNaN(angka)) return "0";
  var number = Math.round(parseFloat(angka)); // Membulatkan ke angka bulat terdekat
  var formatted = number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return formatted;
}

function kembaliKeGabungan() {
  if (window._rlGabunganData) {
    var data = window._rlGabunganData;
    var areaTabel = document.getElementById("tempat_tabel_rlgab");
    if (areaTabel) {
      var htmlTombol =
        '<div style="display:flex; gap:10px; margin-bottom:15px; align-items:center;">';
      htmlTombol +=
        '<button onclick="downloadExcelArusKasGabungan()" style="padding:8px 16px; background:#198754; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📥 Download Excel Gabungan</button>';
      htmlTombol +=
        '<span style="font-weight:bold; font-size:1.1rem; color:#004085;">ARUS KAS GABUNGAN - MASA: ' +
        window._rlGabFilterMasa +
        "</span>";
      htmlTombol += "</div>";
      var activeGroupLabel = localStorage.getItem("group") || "TLGA"; // ✅
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
          activeGroupLabel,
        );
    }
  } else {
    terapkanOpsiArusKasGabungan();
  }
}

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
    data.activeGroupLabel,
  );
  var namaCab = data.mapMasterCab[data.kodeCabang] || data.kodeCabang;

  var fullHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Arus Kas ${namaCab}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    <style>table { border-collapse: collapse; mso-number-format:"\\@"; } td, th { mso-number-format:"\\@"; padding: 5px; border: 1px solid #000; } .num { mso-number-format:"#,##0.00"; text-align: right; } th { background-color: #f4f4f4; font-weight: bold; }</style>
    </head><body>
      <h2 style="text-align:center;">LAPORAN ARUS KAS PER BULAN</h2>
      <h3 style="text-align:center;">Cabang: ${namaCab} (${data.kodeCabang})</h3>
      <h3 style="text-align:center;">Masa: ${data.filterMasa}</h3>
      ${htmlExcel}
    </body></html>`;

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
// 🚀 FUNGSI PERANTARA: SIAPKAN DATA MASTER CABANG, LALU EKSEKUSI TABLE VERSUS
// ==========================================
async function tampilkanVersusSD(encodedCab, encodedGroup) {
  var cab = decodeURIComponent(encodedCab);
  var group = decodeURIComponent(encodedGroup);
  var filterTahunFull = window._rlGabFilterMasa.split("-")[1];
  var duaDigitTahun = String(filterTahunFull).slice(-2);

  // --- LOGIKA LAZY LOAD DATASALES ---
  // Jika cache global kosong, atau cache khusus cabang ini belum ada
  // --- LOGIKA LAZY LOAD DATASALES (OPTIMAL & AMAN) ---
  if (!DBCache.datasales) {
    DBCache.datasales = {}; // Wadah cache per-cabang
  }

  var cacheKey = cab + "_" + group;

  // Cek apakah data sudah ada atau sedang dimuat
  if (!DBCache.datasales[cacheKey]) {
    toast("Mengambil data sales cabang " + cab + "...", "inf");
    try {
      // Sanitasi yang lebih longgar jika nama cabang menggunakan titik (.) atau koma (,)
      // Sesuaikan dengan karakter yang benar-benar ada pada data Anda.
      var safeCab = (cab || "").trim();
      var safeGroup = (group || "").trim();

      var urlSales = `/api/data/datasales?cabang=${encodeURIComponent(safeCab)}&group=${encodeURIComponent(safeGroup)}`;

      var response = await fetch(urlSales);
      if (!response.ok) {
        let errText = await response.text();
        throw new Error(errText || "Server Error: " + response.status);
      }

      var rawData = await response.json();
      DBCache.datasales[cacheKey] = Array.isArray(rawData) ? rawData : [];

      toast("Data sales cabang " + cab + " berhasil dimuat.", "ok");
    } catch (err) {
      console.error("Gagal load data sales:", err);
      return toast("Gagal mengambil data sales: " + err.message, "err");
    }
  }

  var rawSales = DBCache.datasales[cacheKey] || [];
  // --- AKHIR LOGIKA LAZY LOAD ---

  toast("Memproses perbandingan RL vs Data Sales...", "inf");

  var listGol = Object.values(_tmpMapGolonganForChart)
    .filter((g) => g.total !== 0)
    .sort((a, b) => parseInt(a.gol) - parseInt(b.gol));

  if (listGol.length === 0)
    return toast("Tidak ada data RL untuk dibandingkan.", "err");

  // HAPUS BARIS INI KARENA SUDAH DIDEKLARASI DI ATAS:
  // var rawSales = DBCache.datasales || [];

  var filteredSales = rawSales.filter(
    (s) =>
      s.cabang === cab &&
      (s.group || "TLGA") === group &&
      s.noper &&
      String(s.noper).trim() !== "",
  );

  var namaCab = window._rlGabunganData.mapMasterCab[cab] || cab;
  var namaBulan = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];

  // Hanya Kepala 3 dan 4
  var configKepala = {
    3: { title: "PENJUALAN", subtotalName: "Penjualan Bersih", bg: "#004d40" },
    4: {
      title: "HARGA POKOK PENJUALAN (HPP)",
      subtotalName: "Total HPP",
      bg: "#b71c1c",
    },
  };

  // Noper tambahan non-RL beserta Mapping Nama Perkiraannya
  var listNoperTambahan = [
    { kode: "COFFEBREAK", nama: "COFFEBREAK" },
    { kode: "KBGGULING", nama: "KBGGULING" },
    { kode: "NASIKOTAK", nama: "NASIKOTAK" },
    { kode: "NASIKUNING", nama: "NASIKUNING" },
    { kode: "TUMPENG", nama: "TUMPENG" },
    { kode: "PAKET4", nama: "PAKET4" },
    { kode: "PAKET8", nama: "PAKET8" },
    { kode: "PAMER", nama: "PAKET MEETING" },
    { kode: "PRAS", nama: "PRASMANAN" },
    { kode: "SEAFOOD", nama: "SEAFOOD" },
    { kode: "LAIN", nama: "LAIN" },
    { kode: "SNACK", nama: "SNACK" },
    { kode: "SNACKB", nama: "SNACKB" },
  ];

  // Helper untuk hitung persentase (Sales / RL * 100)
  function formatPersen(valSales, valRL) {
    if (!valRL || valRL === 0) return "0%";
    let pct = (valSales / valRL) * 100;
    return pct.toFixed(1) + "%";
  }

  // Helper: Generate 12 kolom bulanan (RL, Sales, Selisih, %, Spasi)
  function generate12Cols(accRL, accSales, isBold, isCalc, customSelisihArray) {
    let cols = "";
    let fw = isBold ? "font-weight:bold;" : "";
    let bgCalc = isCalc ? "background:#263238;" : "";

    for (let b = 0; b < 12; b++) {
      let valRL = accRL[b] || 0;
      let valSales = accSales[b] || 0;

      // Jika ada custom selisih (misal untuk TOTAL SALES), gunakan itu; jika tidak, hitung RL - Sales
      let selisih = customSelisihArray
        ? customSelisihArray[b]
        : valRL - valSales;
      let pct = formatPersen(valSales, valRL);

      let colorRL = valRL > 0 ? "#fff" : valRL < 0 ? "#ffcdd2" : "#fff";
      let colorSales =
        valSales > 0 ? "#bbdefb" : valSales < 0 ? "#ffcdd2" : "#fff";
      let colorSelisih =
        selisih < 0 ? "#ffcdd2" : selisih > 0 ? "#c8e6c9" : "#fff";

      cols += `<td style="padding:6px;border:1px solid #444;text-align:right;color:${colorRL};${fw}${bgCalc}">${valRL !== 0 ? formatRupiah(valRL) : ""}</td>`;
      cols += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#0d1b2a;color:${colorSales};${fw}${bgCalc}">${valSales !== 0 ? formatRupiah(valSales) : ""}</td>`;
      cols += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#1a1a1a;color:${colorSelisih};${fw}${bgCalc}">${selisih !== 0 ? formatRupiah(selisih) : ""}</td>`;
      cols += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#2d3748;color:#00D2FF;${fw}${bgCalc}">${pct}</td>`;
      cols += `<td style="padding:4px;border:1px solid #000;background:#000;width:15px;"></td>`;
    }
    return cols;
  }

  // Helper Total Akhir
  function generateTotalCol(totalRL) {
    return `<td style="padding:8px;border:1px solid #444;text-align:right;font-weight:bold;background:#1b5e20;color:#fff;">${formatRupiah(totalRL)}</td>`;
  }

  var html = `
  <div style="margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
    <h4 style="margin:0; color:#00D2FF; font-size:1.1rem;">Perbandingan RL vs Sales: ${namaCab} | Group: ${group} - Tahun ${filterTahunFull}</h4>
    <div style="display:flex; gap:10px;">
      <button onclick="exportToExcel()" style="padding:8px 15px; background:#16a34a; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">📥 Export ke Excel</button>
      <button onclick="window.print()" style="padding:8px 15px; background:#0284c7; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">🖨️ Cetak / Print</button>
    </div>
  </div>
  
  <div style="overflow-x:auto; border:1px solid #444; border-radius:8px;">
    <table id="tableVersus" border="1" style="width:100%;border-collapse:collapse;color:#fff;background:#000; min-width:1600px; font-size:.85rem;">
      <thead>
        <tr style="background:#1a1a1a;font-weight:bold;">
          <th rowspan="2" style="padding:8px;border:1px solid #444; min-width:80px;">No.Perk</th>
          <th rowspan="2" style="padding:8px;border:1px solid #444; min-width:220px; text-align:left;">KETERANGAN</th>
          ${namaBulan.map((bln) => `<th colspan="4" style="padding:8px;border:1px solid #444;text-align:center;background:#1e293b;color:#00D2FF;">${bln}</th><th rowspan="2" style="padding:4px;border:1px solid #000;background:#000;width:15px;"></th>`).join("")}
          <th rowspan="2" style="padding:8px;border:1px solid #444;text-align:right;background:#1b5e20; min-width:110px;">TOTAL RL</th>
        </tr>
        <tr style="background:#1a1a1a;font-weight:bold;text-align:center;">
          ${namaBulan.map(() => `<th style="padding:6px;border:1px solid #444;">RL</th><th style="padding:6px;border:1px solid #444;">SL</th><th style="padding:6px;border:1px solid #444;">SLH</th><th style="padding:6px;border:1px solid #444;color:#00D2FF;">%</th>`).join("")}
        </tr>
      </thead>
      <tbody>`;

  var groupedData = {};
  listGol.forEach((item) => {
    var kepala = item.gol.substring(0, 1);
    if (kepala === "3" || kepala === "4") {
      if (!groupedData[kepala]) groupedData[kepala] = [];
      groupedData[kepala].push(item);
    }
  });

  var grandTotalRL = 0;
  var sumPenjualanRL = new Array(12).fill(0);
  var sumPenjualanSales = new Array(12).fill(0);
  var sumHppRL = new Array(12).fill(0);
  var sumHppSales = new Array(12).fill(0);

  var urutanKepala = Object.keys(configKepala);

  urutanKepala.forEach((kepala) => {
    var items = groupedData[kepala] || [];
    if (items.length === 0) return;

    var cfg = configKepala[kepala];

    var accKepalaRL = new Array(12).fill(0);
    var accKepalaSales = new Array(12).fill(0);

    // BARIS JUDUL KELOMPOK
    html += `<tr style="background:${cfg.bg};"><td colspan="2" style="padding:8px;border:1px solid #444;font-weight:bold;color:#fff;">${kepala}. ${cfg.title}</td>`;
    html += `<td colspan="60" style="padding:0;border:1px solid ${cfg.bg};background:${cfg.bg};"></td>`;
    html += `<td style="padding:0;border:1px solid ${cfg.bg};background:${cfg.bg};"></td></tr>`;

    var totalKepalaRL = 0;

    // LOOPING DATA RL (KEPALA 3 & 4)
    items.forEach((item) => {
      var digit3 = item.gol.substring(0, 3);
      var rowRL = 0;
      var arrRL = new Array(12).fill(0);
      var arrSales = new Array(12).fill(0);

      html += `<tr><td style="padding:6px;border:1px solid #444;color:#4da3ff;font-weight:bold;">${digit3}</td>`;
      html += `<td style="padding:6px;border:1px solid #444; min-width:220px;">${item.namaGol}</td>`;

      for (let b = 1; b <= 12; b++) {
        let blnStr = ("0" + b).slice(-2);
        let saldoRL = item.bulan[blnStr] || 0;
        rowRL += saldoRL;
        arrRL[b - 1] = saldoRL;

        let salesBulanIni = 0;
        filteredSales.forEach((s) => {
          let noperSales = String(s.noper).trim().substring(0, 3);
          let masaSales = String(s.masa || s.ma || "").trim();
          if (noperSales === digit3 && masaSales === blnStr + duaDigitTahun) {
            salesBulanIni += num(s.amount || s.total || 0);
          }
        });
        arrSales[b - 1] = salesBulanIni;

        let selisih = saldoRL - salesBulanIni;
        let pct = formatPersen(salesBulanIni, saldoRL);
        let colorRL = saldoRL >= 0 ? "#fff" : "#ffcdd2";
        let colorSales = salesBulanIni > 0 ? "#bbdefb" : "#fff";
        let colorSelisih =
          selisih < 0 ? "#ffcdd2" : selisih > 0 ? "#c8e6c9" : "#fff";

        html += `<td style="padding:6px;border:1px solid #444;text-align:right;color:${colorRL}">${saldoRL !== 0 ? formatRupiah(saldoRL) : ""}</td>`;
        html += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#0d1b2a;color:${colorSales}">${salesBulanIni !== 0 ? formatRupiah(salesBulanIni) : ""}</td>`;
        html += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#1a1a1a;color:${colorSelisih};font-weight:bold;">${selisih !== 0 ? formatRupiah(selisih) : ""}</td>`;
        html += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#2d3748;color:#00D2FF;">${pct}</td>`;
        html += `<td style="padding:4px;border:1px solid #000;background:#000;width:15px;"></td>`;
      }

      for (let i = 0; i < 12; i++) {
        accKepalaRL[i] += arrRL[i];
        accKepalaSales[i] += arrSales[i];
      }

      totalKepalaRL += rowRL;
      html += generateTotalCol(rowRL);
      html += `</tr>`;
    });

    // BARIS SUBTOTAL KELOMPOK
    html += `<tr style="border-top:2px solid #fff; background:#111;">`;
    html += `<td colspan="2" style="padding:8px;border:1px solid #444;text-align:right;font-weight:bold;color:#fff;">${cfg.subtotalName}</td>`;
    html += generate12Cols(accKepalaRL, accKepalaSales, true, false);
    html += generateTotalCol(totalKepalaRL);
    html += `</tr>`;

    grandTotalRL += totalKepalaRL;

    if (kepala === "3") {
      sumPenjualanRL = accKepalaRL.slice();
      sumPenjualanSales = accKepalaSales.slice();
    }
    if (kepala === "4") {
      sumHppRL = accKepalaRL.slice();
      sumHppSales = accKepalaSales.slice();
    }
  });

  // BARIS TAMBAHAN NOPER KHUSUS (RL = 0)
  html += `<tr style="background:#312e81;"><td colspan="2" style="padding:8px;border:1px solid #444;font-weight:bold;color:#fff;">ITEM TAMBAHAN SALES</td>`;
  html += `<td colspan="60" style="padding:0;border:1px solid #312e81;background:#312e81;"></td>`;
  html += `<td style="padding:0;border:1px solid #312e81;background:#312e81;"></td></tr>`;

  var accExtraSales = new Array(12).fill(0);
  var accExtraRL = new Array(12).fill(0); // bernilai 0

  listNoperTambahan.forEach((itemExtra) => {
    html += `<tr><td style="padding:6px;border:1px solid #444;color:#a5b4fc;font-weight:bold;">${itemExtra.kode}</td>`;
    html += `<td style="padding:6px;border:1px solid #444; min-width:220px;">${itemExtra.nama}</td>`;

    for (let b = 1; b <= 12; b++) {
      let blnStr = ("0" + b).slice(-2);
      let salesBulanIni = 0;

      filteredSales.forEach((s) => {
        let noperSales = String(s.noper).trim().toUpperCase();
        let masaSales = String(s.masa || s.ma || "").trim();
        if (
          noperSales === itemExtra.kode &&
          masaSales === blnStr + duaDigitTahun
        ) {
          salesBulanIni += num(s.amount || s.total || 0);
        }
      });

      accExtraSales[b - 1] += salesBulanIni;
      let selisih = 0 - salesBulanIni;
      let colorSales = salesBulanIni > 0 ? "#bbdefb" : "#fff";
      let colorSelisih = selisih < 0 ? "#ffcdd2" : "#fff";

      html += `<td style="padding:6px;border:1px solid #444;text-align:right;color:#fff;"></td>`;
      html += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#0d1b2a;color:${colorSales}">${salesBulanIni !== 0 ? formatRupiah(salesBulanIni) : ""}</td>`;
      html += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#1a1a1a;color:${colorSelisih};font-weight:bold;">${selisih !== 0 ? formatRupiah(selisih) : ""}</td>`;
      html += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#2d3748;color:#00D2FF;">0%</td>`;
      html += `<td style="padding:4px;border:1px solid #000;background:#000;width:15px;"></td>`;
    }

    html += generateTotalCol(0);
    html += `</tr>`;
  });

  // BARIS SUBTOTAL ITEM TAMBAHAN
  html += `<tr style="border-top:2px solid #fff; background:#1e1b4b;">`;
  html += `<td colspan="2" style="padding:8px;border:1px solid #444;text-align:right;font-weight:bold;color:#a5b4fc;">Subtotal Item Tambahan</td>`;
  html += generate12Cols(accExtraRL, accExtraSales, true, false);
  html += generateTotalCol(0);
  html += `</tr>`;

  // BARIS TOTAL SALES (SEUAI DENGAN PERBAIKAN REVISI TERBARU)
  var combinedTotalSalesRL = new Array(12).fill(0); // RL = 0
  var combinedTotalSalesSales = new Array(12).fill(0); // Sales HPP + Sales Tambahan
  var customSelisihTotalSales = new Array(12).fill(0); // Selisih HPP + Selisih Tambahan

  for (let i = 0; i < 12; i++) {
    // 1. Sales Total = Subtotal Sales HPP + Subtotal Sales Tambahan
    combinedTotalSalesSales[i] = sumHppSales[i] + accExtraSales[i];

    // 2. Selisih HPP = sumHppRL[i] - sumHppSales[i]
    let selisihHpp = sumHppRL[i] - sumHppSales[i];

    // 3. Selisih Tambahan = 0 - accExtraSales[i]
    let selisihTambahan = 0 - accExtraSales[i];

    // 4. Custom Selisih = Selisih HPP + Selisih Tambahan
    customSelisihTotalSales[i] = selisihHpp + selisihTambahan;
  }

  html += `<tr style="border-bottom:3px double #00D2FF; background:#111;">`;
  html += `<td colspan="2" style="padding:10px;border:1px solid #444;font-weight:bold;color:#00D2FF; font-size:1rem;">TOTAL SALES</td>`;
  html += generate12Cols(
    combinedTotalSalesRL,
    combinedTotalSalesSales,
    true,
    true,
    customSelisihTotalSales,
  );
  html += generateTotalCol(0);
  html += `</tr>`;

  // BARIS GRAND TOTAL RL
  html += `<tr style="border-top:3px double #fff; font-weight:bold; background:#2c3e50;">
    <td colspan="2" style="padding:10px;border:1px solid #444;text-align:right;">GRAND TOTAL RL</td>
    <td colspan="60" style="padding:10px;border:1px solid #444;text-align:right;background:#1b5e20;color:#fff;">${formatRupiah(grandTotalRL)}</td>
    <td style="padding:10px;border:1px solid #444;text-align:right;background:#1b5e20;color:#fff;">${formatRupiah(grandTotalRL)}</td>
  </tr>`;

  html += `</tbody></table></div>`;

  // Buka Window Baru dengan Fitur Export
  var fullHTML = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Laporan RL vs Sales - ${namaCab}</title>
  <style>body{font-family:'Segoe UI',Tahoma,sans-serif;background:#121212;color:#e0e0e0;padding:20px;margin:0;} @media print{body{background:#fff;color:#000;} table{border-color:#000 !important;} td,th{color:#000 !important; background-color:#fff !important;}}</style></head>
  <body>${html}
  <script>
    function formatRupiah(num){if(isNaN(num))return"0";return Math.abs(num).toLocaleString('id-ID');}
    function exportToExcel() {
      var table = document.getElementById("tableVersus");
      var html = table.outerHTML;
      var url = 'data:application/vnd.ms-excel,' + encodeURIComponent(html);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'Laporan_RL_vs_Sales_${namaCab}.xls';
      link.click();
    }
  </script>
  </body></html>`;

  var newWindow = window.open("", "_blank");
  if (newWindow) {
    newWindow.document.open();
    newWindow.document.write(fullHTML);
    newWindow.document.close();
    toast("Tab perbandingan berhasil dibuka!", "ok");
  } else {
    toast("Gagal membuka tab baru. Izinkan popup browser.", "err");
  }
}
// ==========================================
// FUNGSI UTAMA: BUKA VERSUS DI TAB BARU
// ==========================================
async function bukaVersusBukaTab(kodeCabang, activeGroup, bulanDariKlik) {
  var cab = String(kodeCabang || "").trim();
  var group = String(activeGroup || "").trim();

  if (!window._rlGabFilterMasa) {
    if (typeof toast === "function")
      toast("Filter masa/periode belum dipilih!", "err");
    else alert("Filter masa/periode belum dipilih!");
    return;
  }

  var partMasa = window._rlGabFilterMasa.split("-");
  var filterTahunFull = partMasa[1];
  var duaDigitTahun = String(filterTahunFull).slice(-2);

  // --- TAMBAHAN FILTER BULAN ---
  var bulanDipilih = bulanDariKlik
    ? parseInt(bulanDariKlik)
    : window._rlGabFilterBulan
      ? parseInt(window._rlGabFilterBulan)
      : 12;
  var namaBulanFull = [
    "",
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];
  var teksBulanToast =
    bulanDipilih === 12 ? "" : " SD BULAN " + namaBulanFull[bulanDipilih];
  // --------------------------------

  if (typeof toast === "function") {
    toast(
      "Memproses perbandingan HPP Detil vs Sales Detil (" +
        filterTahunFull +
        teksBulanToast +
        ")...",
      "inf",
    );
  }

  try {
    var namaStorePerkiraan = "perkiraan" + filterTahunFull;
    var resPerkiraan = await db.getAll(namaStorePerkiraan);
    var rawDataPerkiraan = resPerkiraan
      ? Array.isArray(resPerkiraan)
        ? resPerkiraan
        : Object.values(resPerkiraan)
      : [];

    if (rawDataPerkiraan.length === 0) {
      if (typeof toast === "function")
        toast(
          "Data Perkiraan " + filterTahunFull + " kosong di database lokal.",
          "err",
        );
      return;
    }

    var namaCab =
      window._rlGabunganData && window._rlGabunganData.mapMasterCab
        ? window._rlGabunganData.mapMasterCab[cab] || cab
        : cab;

    var tmpMapDetil = prosesDataPerkiraan(
      rawDataPerkiraan,
      cab,
      namaCab,
      group,
    );

    var listPerkiraan = Object.values(tmpMapDetil)
      .filter((g) => g.total !== 0)
      .sort((a, b) => parseFloat(a.noper) - parseFloat(b.noper));

    if (listPerkiraan.length === 0) {
      if (typeof toast === "function")
        toast("Tidak ada transaksi HPP / Penjualan untuk cabang ini.", "err");
      return;
    }

    var rawSales = await getSalesDataWithCache(cab, group);
    var filteredSales = rawSales.filter(
      (s) => s.noper && String(s.noper).trim() !== "",
    );
    var salesIndex = buatSalesIndex(filteredSales, duaDigitTahun);

    // --- TAMBAHAN FILTER BULAN: KIRIM PARAMETER bulanDipilih ---
    var html = generateTableHTML(
      listPerkiraan,
      salesIndex,
      namaCab,
      group,
      filterTahunFull,
      duaDigitTahun,
      cab,
      bulanDipilih, // <-- PARAMETER BARU
    );

    var fullHTML = generateFullPageHTML(
      html,
      namaCab,
      cab,
      group,
      filterTahunFull,
      bulanDipilih, // <-- PARAMETER BARU (Jika fungsi ini butuh, jika tidak hapus baris ini)
    );
    // ---------------------------------------------------------

    var newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(fullHTML);
      newWindow.document.close();
      if (typeof toast === "function")
        toast("Tab perbandingan HPP vs Sales Detil berhasil dibuka!", "ok");
    } else {
      if (typeof toast === "function")
        toast("Gagal membuka tab baru. Izinkan popup browser.", "err");
    }
  } catch (err) {
    console.error("Error pada bukaVersusBukaTab:", err);
    if (typeof toast === "function")
      toast("Terjadi kesalahan: " + err.message, "err");
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function prosesDataPerkiraan(rawDataPerkiraan, cab, namaCab, group) {
  var tmpMapDetil = {};
  var targetCabangKode = String(cab).trim().toUpperCase();
  var targetCabangNama = String(namaCab).trim().toUpperCase();
  var targetGroup = String(group).trim().toUpperCase();

  rawDataPerkiraan.forEach((p) => {
    let noPerkFull = String(p.noPerk || p.noper || p.gol || "").trim();
    let kodeKepala = parseInt(noPerkFull.substring(0, 1), 10);
    let cabangData = String(p.cabang || p.cab || "")
      .trim()
      .toUpperCase();
    let groupData = String(p.group || "")
      .trim()
      .toUpperCase();

    let cocokCabang =
      cabangData === targetCabangKode || cabangData === targetCabangNama;
    let cocokGroup = groupData === targetGroup;

    if ((kodeKepala === 3 || kodeKepala === 4) && cocokCabang && cocokGroup) {
      let namaPerkiraan =
        p.penjelasan || p.namaGol || p.nama || "Perkiraan " + noPerkFull;

      if (!tmpMapDetil[noPerkFull]) {
        tmpMapDetil[noPerkFull] = {
          noper: noPerkFull,
          namaGol: namaPerkiraan,
          kepala: kodeKepala,
          bulan: {},
          total: 0,
        };
        for (let x = 1; x <= 12; x++) {
          tmpMapDetil[noPerkFull].bulan[("0" + x).slice(-2)] = 0;
        }
      }

      let masaStr = String(p.masa || "").trim();
      let blnStr = masaStr.substring(0, 2);
      let bulanNum = parseInt(blnStr, 10);

      if (bulanNum >= 1 && bulanNum <= 12) {
        let mutasiBulan = Number(p.db || 0) - Number(p.cr || 0);
        tmpMapDetil[noPerkFull].bulan[blnStr] += mutasiBulan;
        tmpMapDetil[noPerkFull].total += mutasiBulan;
      }
    }
  });

  return tmpMapDetil;
}

async function getSalesDataWithCache(cab, group) {
  if (typeof DBCache === "undefined") window.DBCache = {};
  if (!DBCache.datasales) DBCache.datasales = {};

  var cacheKey = cab + "_" + group;

  if (
    !DBCache.datasales[cacheKey] ||
    DBCache.datasales[cacheKey].length === 0
  ) {
    if (typeof toast === "function")
      toast("Mengambil data sales cabang " + cab + "...", "inf");

    var urlSales = `/api/data/datasales?cabang=${encodeURIComponent(cab)}&group=${encodeURIComponent(group)}`;
    var response = await fetch(urlSales);

    if (!response.ok) throw new Error("Server Error: " + response.status);

    var rawData = await response.json();
    DBCache.datasales[cacheKey] = Array.isArray(rawData) ? rawData : [];
  }

  return DBCache.datasales[cacheKey] || [];
}

function buatSalesIndex(filteredSales, duaDigitTahun) {
  var index = {};
  filteredSales.forEach((s) => {
    let noperSales = String(s.noper || "").trim();
    let masaSales = String(s.masa || s.ma || "").trim();
    let key = noperSales + "_" + masaSales;
    if (!index[key]) index[key] = 0;
    index[key] += Number(s.amount || s.total || 0);
  });
  return index;
}

function formatPersen(valSales, valRL) {
  if (!valRL || valRL === 0) return "0%";
  return ((valSales / valRL) * 100).toFixed(1) + "%";
}

function generateTotalCol(totalRL) {
  return `<td style="padding:8px;border:1px solid #444;text-align:right;font-weight:bold;background:#1b5e20;color:#fff;mso-number-format:'\\@';">${formatRupiah(totalRL)}</td>`;
}

function parseTanggalSimple(rawTgl) {
  if (!rawTgl) return "-";
  try {
    if (rawTgl instanceof Date) return isNaN(rawTgl) ? "-" : rawTgl.getDate();
    var d = new Date(rawTgl);
    if (!isNaN(d.getTime())) return d.getDate();
    var str = String(rawTgl);
    var parts = str.split(/[-\/]/);
    return parts[2] || parts[0] || "-";
  } catch (e) {
    return "-";
  }
}
// TAMBAHKAN PARAMETER "bulanDipilih" (berupa angka 1-12)
function generateTableHTML(
  listPerkiraan,
  salesIndex,
  namaCab,
  group,
  filterTahunFull,
  duaDigitTahun,
  cab,
  bulanDipilih, // <-- PARAMETER BARU
) {
  // Jika tidak ada bulan yang dipilih, defaultnya 12 (Desember / Full Year)
  var batasBulan = bulanDipilih ? parseInt(bulanDipilih) : 12;
  var namaBulanFull = [
    "",
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];

  // Potong array nama bulan sesuai bulan yang dipilih
  var namaBulan = namaBulanFull.slice(1).slice(0, batasBulan);

  var configKepala = {
    3: { title: "PENJUALAN", subtotalName: "Penjualan Bersih", bg: "#004d40" },
    4: {
      title: "HARGA POKOK PENJUALAN (HPP)",
      subtotalName: "Total HPP",
      bg: "#b71c1c",
    },
  };

  var listNoperTambahan = [
    { kode: "COFFEBREAK", nama: "COFFEBREAK" },
    { kode: "KBGGULING", nama: "KBGGULING" },
    { kode: "NASIKOTAK", nama: "NASIKOTAK" },
    { kode: "NASIKUNING", nama: "NASIKUNING" },
    { kode: "TUMPENG", nama: "TUMPENG" },
    { kode: "PAKET4", nama: "PAKET4" },
    { kode: "PAKET8", nama: "PAKET8" },
    { kode: "PAMER", nama: "PAKET MEETING" },
    { kode: "PRAS", nama: "PRASMANAN" },
    { kode: "SEAFOOD", nama: "SEAFOOD" },
    { kode: "LAIN", nama: "LAIN" },
    { kode: "SNACK", nama: "SNACK" },
    { kode: "SNACKB", nama: "SNACKB" },
  ];

  var teksBulanJudul =
    batasBulan === 12 ? "" : " SD BULAN " + namaBulanFull[batasBulan];

  var judulLaporan =
    "Perbandingan HPP Detil vs Sales Detil: " +
    namaCab +
    " | Group: " +
    group +
    teksBulanJudul +
    " " +
    filterTahunFull;

  var html = `
    <div style="margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <h4 id="judulLaporan" style="margin:0; color:#00D2FF; font-size:1.1rem;">${judulLaporan}</h4>
      <div style="display:flex; gap:10px;">
        <button id="btnExportDetilXLS" style="padding:8px 15px; background:#16a34a; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">📥 Export ke Excel</button>
        <button onclick="window.print()" style="padding:8px 15px; background:#0284c7; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">🖨️ Cetak / Print</button>
      </div>
    </div>
    <div style="overflow-x:auto; border:1px solid #444; border-radius:8px;">
      <table id="tableVersusDetil" border="1" style="width:100%;border-collapse:collapse;color:#fff;background:#000; min-width:1600px; font-size:.85rem;">
        <thead>
          <tr style='background:#1a1a1a;font-weight:bold;'>
            <th rowspan="2" style="padding:8px;border:1px solid #444; min-width:90px;">No.Perk</th>
            <th rowspan="2" style="padding:8px;border:1px solid #444; min-width:220px; text-align:left;">NAMA PERKIRAAN</th>
            ${namaBulan
              .map(
                (bln) => `
              <th colspan="4" style="padding:8px;border:1px solid #444;text-align:center;background:#1e293b;color:#00D2FF;">${bln}</th>
              <th rowspan="2" style="padding:4px;border:1px solid #000;background:#000;width:15px;"></th>
            `,
              )
              .join("")}
            <th rowspan="2" style="padding:8px;border:1px solid #444;text-align:right;background:#1b5e20; min-width:110px;">TOTAL RL</th>
          </tr>
          <tr style="background:#1a1a1a;font-weight:bold;text-align:center;">
            ${namaBulan
              .map(
                () => `
              <th style="padding:6px;border:1px solid #444;">BELI</th>
              <th style="padding:6px;border:1px solid #444;">JUAL</th>
              <th style="padding:6px;border:1px solid #444;">SELISIH</th>
              <th style="padding:6px;border:1px solid #444;color:#00D2FF;">%</th>
            `,
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
  `;

  var groupedData = {};
  listPerkiraan.forEach((item) => {
    if (!groupedData[item.kepala]) groupedData[item.kepala] = [];
    groupedData[item.kepala].push(item);
  });

  var grandTotalRL = 0;
  var sumPenjualanRL = new Array(12).fill(0);
  var sumPenjualanSales = new Array(12).fill(0);
  var sumHppRL = new Array(12).fill(0);
  var sumHppSales = new Array(12).fill(0);

  [3, 4].forEach((kepala) => {
    var items = groupedData[kepala] || [];
    if (items.length === 0) return;

    var cfg = configKepala[kepala];
    var accKepalaRL = new Array(12).fill(0);
    var accKepalaSales = new Array(12).fill(0);
    var totalKepalaRL = 0;

    html += `
      <tr style="background:${cfg.bg};">
        <td colspan="2" style="padding:8px;border:1px solid #444;font-weight:bold;color:#fff;">${kepala}. ${cfg.title}</td>
        <td colspan="${batasBulan * 5}" style="padding:0;border:1px solid ${cfg.bg};background:${cfg.bg};"></td>
        <td style="padding:0;border:1px solid ${cfg.bg};background:${cfg.bg};"></td>
      </tr>
    `;

    items.forEach((item) => {
      var noperDetil = String(item.noper).trim();
      var rowRL = 0;
      var arrRL = new Array(12).fill(0);
      var arrSales = new Array(12).fill(0);

      var onclickAction = `showDetailMenu('${noperDetil}', '${encodeURIComponent(item.namaGol)}', '${encodeURIComponent(cab)}', '${encodeURIComponent(group)}', '${filterTahunFull}')`;

      html += `
        <tr>
          <td style="padding:6px;border:1px solid #444;color:#4da3ff;font-weight:bold;cursor:pointer;text-decoration:underline;mso-number-format:'\\@';" onclick="${onclickAction}" title="Klik untuk lihat detail">${noperDetil}</td>
          <td style="padding:6px;border:1px solid #444;color:#e0e0e0;">${item.namaGol}</td>
      `;

      for (let b = 1; b <= batasBulan; b++) {
        let blnStr = ("0" + b).slice(-2);
        let saldoRL = item.bulan[blnStr] || 0;

        // FILTER SALES: Hanya ambil sales bulan yang dipilih
        let salesKey = noperDetil + "_" + blnStr + duaDigitTahun;
        let salesBulanIni = salesIndex[salesKey] || 0;

        // TOTAL RL: Hanya akumulasi sampai bulan yang dipilih
        rowRL += saldoRL;
        arrRL[b - 1] = saldoRL;
        arrSales[b - 1] = salesBulanIni;

        let selisih = saldoRL - salesBulanIni;
        let pct = formatPersen(salesBulanIni, saldoRL);

        let colorRL = saldoRL >= 0 ? "#fff" : "#ffcdd2";
        let colorSales = salesBulanIni > 0 ? "#bbdefb" : "#fff";
        let colorSelisih =
          selisih < 0 ? "#ffcdd2" : selisih > 0 ? "#c8e6c9" : "#fff";

        html += `
          <td style="padding:6px;border:1px solid #444;text-align:right;color:${colorRL};">${saldoRL !== 0 ? formatRupiah(saldoRL) : ""}</td>
          <td style="padding:6px;border:1px solid #444;text-align:right;background:#0d1b2a;color:${colorSales};">${salesBulanIni !== 0 ? formatRupiah(salesBulanIni) : ""}</td>
          <td style="padding:6px;border:1px solid #444;text-align:right;background:#1a1a1a;color:${colorSelisih};font-weight:bold;">${selisih !== 0 ? formatRupiah(selisih) : ""}</td>
          <td style="padding:6px;border:1px solid #444;text-align:right;background:#2d3748;color:#00D2FF;">${pct}</td>
          <td style="padding:4px;border:1px solid #000;background:#000;width:15px;"></td>
        `;
      }

      for (let i = 0; i < 12; i++) {
        accKepalaRL[i] += arrRL[i];
        accKepalaSales[i] += arrSales[i];
      }
      totalKepalaRL += rowRL;

      html += generateTotalCol(rowRL) + "</tr>";
    });

    html += `
      <tr style="border-top:2px solid #fff; background:#111;">
        <td colspan="2" style="padding:8px;border:1px solid #444;text-align:right;font-weight:bold;color:#fff;">${cfg.subtotalName}</td>
        ${generate12Cols(accKepalaRL, accKepalaSales, true, false, undefined, batasBulan)}
        ${generateTotalCol(totalKepalaRL)}
      </tr>
    `;

    grandTotalRL += totalKepalaRL;

    if (kepala === 3) {
      sumPenjualanRL = accKepalaRL.slice();
      sumPenjualanSales = accKepalaSales.slice();
    }
    if (kepala === 4) {
      sumHppRL = accKepalaRL.slice();
      sumHppSales = accKepalaSales.slice();
    }
  });

  // Item Tambahan Sales
  html += `
    <tr style="background:#312e81;">
      <td colspan="2" style="padding:8px;border:1px solid #444;font-weight:bold;color:#fff;">ITEM TAMBAHAN SALES</td>
      <td colspan="${batasBulan * 5}" style="padding:0;border:1px solid #312e81;background:#312e81;"></td>
      <td style="padding:0;border:1px solid #312e81;background:#312e81;"></td>
    </tr>
  `;

  var accExtraSales = new Array(12).fill(0);

  listNoperTambahan.forEach((itemExtra) => {
    var onclickActionExtra = `showDetailMenu('${itemExtra.kode}', '${encodeURIComponent(itemExtra.nama)}', '${encodeURIComponent(cab)}', '${encodeURIComponent(group)}', '${filterTahunFull}')`;

    html += `
      <tr>
        <td style="padding:6px;border:1px solid #444;color:#a5b4fc;font-weight:bold;cursor:pointer;text-decoration:underline;mso-number-format:'\\@';" onclick="${onclickActionExtra}" title="Klik untuk lihat detail">${itemExtra.kode}</td>
        <td style="padding:6px;border:1px solid #444; min-width:220px;color:#e0e0e0;">${itemExtra.nama}</td>
    `;

    for (let b = 1; b <= batasBulan; b++) {
      let blnStr = ("0" + b).slice(-2);
      let salesKey = itemExtra.kode + "_" + blnStr + duaDigitTahun;
      let salesBulanIni = salesIndex[salesKey] || 0;

      accExtraSales[b - 1] += salesBulanIni;
      let selisih = 0 - salesBulanIni;
      let colorSales = salesBulanIni > 0 ? "#bbdefb" : "#fff";
      let colorSelisih = selisih < 0 ? "#ffcdd2" : "#fff";

      html += `
        <td style="padding:6px;border:1px solid #444;text-align:right;color:#fff;"></td>
        <td style="padding:6px;border:1px solid #444;text-align:right;background:#0d1b2a;color:${colorSales};">${salesBulanIni !== 0 ? formatRupiah(salesBulanIni) : ""}</td>
        <td style="padding:6px;border:1px solid #444;text-align:right;background:#1a1a1a;color:${colorSelisih};font-weight:bold;">${selisih !== 0 ? formatRupiah(selisih) : ""}</td>
        <td style="padding:6px;border:1px solid #444;text-align:right;background:#2d3748;color:#00D2FF;">0%</td>
        <td style="padding:4px;border:1px solid #000;background:#000;width:15px;"></td>
      `;
    }
    html += generateTotalCol(0) + "</tr>";
  });

  var accExtraRL = new Array(12).fill(0);
  html += `
    <tr style="border-top:2px solid #fff; background:#1e1b4b;">
      <td colspan="2" style="padding:8px;border:1px solid #444;text-align:right;font-weight:bold;color:#a5b4fc;">Subtotal Item Tambahan</td>
      ${generate12Cols(accExtraRL, accExtraSales, true, false, undefined, batasBulan)}
      ${generateTotalCol(0)}
    </tr>
  `;

  var combinedTotalSalesRL = new Array(12).fill(0);
  var combinedTotalSalesSales = new Array(12).fill(0);
  var customSelisihTotalSales = new Array(12).fill(0);

  for (let i = 0; i < 12; i++) {
    combinedTotalSalesSales[i] = sumHppSales[i] + accExtraSales[i];
    customSelisihTotalSales[i] =
      sumHppRL[i] - sumHppSales[i] + (0 - accExtraSales[i]);
  }

  html += `
    <tr style="border-bottom:3px double #00D2FF; background:#111;">
      <td colspan="2" style="padding:10px;border:1px solid #444;font-weight:bold;color:#00D2FF; font-size:1rem;">TOTAL SALES</td>
      ${generate12Cols(combinedTotalSalesRL, combinedTotalSalesSales, true, true, customSelisihTotalSales, batasBulan)}
      ${generateTotalCol(0)}
    </tr>
    <tr style="border-top:3px double #fff; font-weight:bold; background:#2c3e50;">
      <td colspan="2" style="padding:10px;border:1px solid #444;text-align:right;">GRAND TOTAL RL</td>
      <td colspan="${batasBulan * 5}" style="padding:10px;border:1px solid #444;text-align:right;background:#1b5e20;color:#fff;">${formatRupiah(grandTotalRL)}</td>
      <td style="padding:10px;border:1px solid #444;text-align:right;background:#1b5e20;color:#fff;">${formatRupiah(grandTotalRL)}</td>
    </tr>
  `;

  html += "</tbody></table></div>";

  // LOGIC EXPORT EXCEL (Dinamis sesuai batasBulan)
  var namaFileExcel =
    "Versus_HPP_vs_Sales_Detil" +
    (batasBulan === 12 ? "" : "_SD_Bln_" + batasBulan) +
    ".xls";

  html += `
    <script>
      setTimeout(function() {
        var btn = document.getElementById("btnExportDetilXLS");
        if (btn) {
          btn.addEventListener("click", function(e) {
            e.preventDefault();
            
            var table = document.getElementById("tableVersusDetil");
            if (!table) { alert("Tabel tidak ditemukan!"); return; }

            var judulEl = document.getElementById("judulLaporan");
            var judul = judulEl ? judulEl.textContent.trim() : "Perbandingan HPP vs Sales Detil";

            var clone = table.cloneNode(true);
            var rows = clone.querySelectorAll("tr");

            rows.forEach(function (tr) {
              var cells = tr.querySelectorAll("td, th");
              cells.forEach(function (cell) {
                var teks = cell.textContent.trim();
                if (!teks || teks === "-") return;

                if (teks.includes("%")) {
                  cell.style.cssText += " mso-number-format:'\\\\@'; text-align: right;";
                  return;
                }

                if (teks.match(/\\./g) || teks.match(/[a-zA-Z]/g)) {
                  cell.textContent = "'" + teks; 
                  cell.style.cssText += " mso-number-format:'\\\\@'; text-align: left;";
                  return;
                }

                if (teks.includes(".")) {
                  var angkaTanpaTitik = teks.replace(/\\./g, "").replace(/-/g, "");
                  if (!isNaN(angkaTanpaTitik) && angkaTanpaTitik !== "") {
                    var isNegatif = teks.startsWith("-");
                    cell.textContent = isNegatif ? "-" + angkaTanpaTitik : angkaTanpaTitik;
                    cell.style.cssText += " mso-number-format:'#,##0'; text-align: right;";
                    return;
                  }
                }

                var isNegatif = teks.startsWith("-");
                var angkaPolos = teks.replace(/,/g, "").replace(/-/g, "");

                if (!isNaN(angkaPolos) && angkaPolos !== "") {
                  cell.textContent = isNegatif ? "-" + angkaPolos : angkaPolos;
                  cell.style.cssText += " mso-number-format:'#,##0'; text-align: right;";
                } else {
                  cell.style.cssText += " mso-number-format:'\\\\@';";
                }
              });
            });

            var headerJudul = '<tr><td colspan="7" style="font-size:16px;font-weight:bold;text-align:center;mso-number-format:\\'\\\\@\\';">' + judul + '</td></tr>';
            var tbody = clone.querySelector("tbody");
            if (tbody) tbody.insertAdjacentHTML("afterbegin", headerJudul);

            var wrapperHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Versus Detil</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>' + clone.outerHTML + '</body></html>';

            try {
              var blob = new Blob([wrapperHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
              var url = URL.createObjectURL(blob);
              var link = document.createElement("a");
              link.href = url;
              link.download = "${namaFileExcel}";
              link.style.display = "none";
              document.body.appendChild(link);
              link.click();
              setTimeout(function () {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }, 250);
            } catch (err) {
              alert("Gagal export: " + err.message);
            }
          });
        }
      }, 100);
    <\/script>
  `;

  return html;
}
function generate12Cols(
  accRL,
  accSales,
  isBold,
  isCalc,
  customSelisihArray,
  batasBulan,
) {
  // TAMBAHAN: Fallback jika batasBulan tidak dikirim
  batasBulan = batasBulan || 12;

  let cols = "";
  let fw = isBold ? "font-weight:bold;" : "";
  let bgCalc = isCalc ? "background:#263238;" : "";
  let fmtTxt = "mso-number-format:'\\@';";

  // PERBAIKAN: Ubah batas 12 menjadi batasBulan
  for (let b = 0; b < batasBulan; b++) {
    let valRL = accRL[b] || 0;
    let valSales = accSales[b] || 0;
    let selisih = customSelisihArray ? customSelisihArray[b] : valRL - valSales;
    let pct = formatPersen(valSales, valRL);

    let colorRL = valRL > 0 ? "#fff" : valRL < 0 ? "#ffcdd2" : "#fff";
    let colorSales =
      valSales > 0 ? "#bbdefb" : valSales < 0 ? "#ffcdd2" : "#fff";
    let colorSelisih =
      selisih < 0 ? "#ffcdd2" : selisih > 0 ? "#c8e6c9" : "#fff";

    cols += `<td style="padding:6px;border:1px solid #444;text-align:right;color:${colorRL};${fw}${bgCalc}${fmtTxt}">${valRL !== 0 ? formatRupiah(valRL) : ""}</td>`;
    cols += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#0d1b2a;color:${colorSales};${fw}${bgCalc}${fmtTxt}">${valSales !== 0 ? formatRupiah(valSales) : ""}</td>`;
    cols += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#1a1a1a;color:${colorSelisih};${fw}${bgCalc}${fmtTxt}">${selisih !== 0 ? formatRupiah(selisih) : ""}</td>`;
    cols += `<td style="padding:6px;border:1px solid #444;text-align:right;background:#2d3748;color:#00D2FF;${fw}${bgCalc}">${pct}</td>`;
    cols += `<td style="padding:4px;border:1px solid #000;background:#000;width:15px;"></td>`;
  }
  return cols;
}

// ==========================================
// GENERATE FULL HTML (termasuk semua script untuk tab baru)
// ==========================================

function generateFullPageHTML(html, namaCab, cab, group, filterTahunFull) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>HPP vs Sales Detil - ${namaCab}</title>
  <style>
    body { font-family:"Segoe UI",Tahoma,sans-serif; background:#121212; color:#e0e0e0; padding:20px; margin:0; }
    .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 12px; }
    .btn-tutup { background: #e53e3e; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem; }
    .btn-tutup:hover { background: #c53030; }
    @media print { 
      body { background:#fff; color:#000; } 
      .btn-tutup { display: none; }
      table { border-color:#000 !important; } 
      td,th { color:#000 !important; background-color:#fff !important; } 
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <h2 style="margin: 0; color: #00D2FF; font-size: 1.2rem;">Perbandingan HPP Detil vs Sales Detil</h2>
      <p style="margin: 5px 0 0 0; color: #aaa; font-size: 0.85rem;">Cabang: <b>${namaCab} (${cab})</b> | Group: <b>${group}</b> | Tahun: <b>${filterTahunFull}</b></p>
    </div>
    <button class="btn-tutup" onclick="window.close()">✕ Tutup Tab</button>
  </div>

  <div>
    ${html}
  </div>

  <script>
    ${getScriptForNewTab()}
  <\/script>
</body>
</html>`;
}

// ==========================================
// SCRIPT LENGKAP UNTUK TAB BARU
// ==========================================
function getScriptForNewTab() {
  return `
    var namaBulanArr = ["JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI","JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"];

    // ==========================================
    // POPUP MENU PILIHAN
    // ==========================================
    function showDetailMenu(noper, namaPerk, cabang, group, tahun) {
      var menuId = "menuPilihanDetail";
      var existing = document.getElementById(menuId);
      if (existing) existing.remove();

      var menuHtml = \`
        <div id="\${menuId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:99999;font-family:'Segoe UI',sans-serif;">
          <div style="background:#1e1e1e;color:#fff;padding:25px;border-radius:12px;width:380px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.6);border:2px solid #00D2FF;text-align:center;">
            <h3 style="margin:0 0 8px 0;color:#00D2FF;font-size:1.1rem;">Pilih Detail Data</h3>
            <p style="margin:0 0 20px 0;color:#aaa;font-size:0.9rem;">[\${noper}] \${decodeURIComponent(namaPerk)}</p>
            
            <button onclick="document.getElementById('\${menuId}').remove(); showSalesDetailModal('\${noper}', '\${namaPerk}', '\${cabang}', '\${group}', '\${tahun}')" style="width:100%;padding:12px;margin-bottom:10px;background:linear-gradient(135deg,#0d47a1,#1565c0);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              📊 DATA SALES<br>
              <span style="font-size:0.75rem;font-weight:normal;opacity:0.8;">Rekap per bulan berdasarkan kode menu</span>
            </button>
            
            <button onclick="document.getElementById('\${menuId}').remove(); showTransDetailModal('\${noper}', '\${namaPerk}', '\${cabang}', '\${group}', '\${tahun}')" style="width:100%;padding:12px;margin-bottom:10px;background:linear-gradient(135deg,#4a148c,#7b1fa2);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              📋 DATA TRANSAKSI<br>
              <span style="font-size:0.75rem;font-weight:normal;opacity:0.8;">Detail transaksi harian (Rp DB-CR)</span>
            </button>

            <button onclick="document.getElementById('\${menuId}').remove(); showCombinedDetailModal('\${noper}', '\${namaPerk}', '\${cabang}', '\${group}', '\${tahun}')" style="width:100%;padding:12px;margin-bottom:15px;background:linear-gradient(135deg,#0369a1,#7e22ce);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              📋 📊 LIHAT BERDAMPINGAN<br>
              <span style="font-size:0.75rem;font-weight:normal;opacity:0.8;">Detail transaksi + Sales harian</span>
            </button>
 
            <button onclick="document.getElementById('\${menuId}').remove()" style="width:100%;padding:10px;background:#333;color:#aaa;border:1px solid #555;border-radius:8px;cursor:pointer;font-size:0.9rem;">✕ Batal</button>
          </div>
        </div>
      \`;
      document.body.insertAdjacentHTML("beforeend", menuHtml);
    }

    // ==========================================
    // POPUP 1: DATA SALES
    // ==========================================
    async function showSalesDetailModal(noper, namaPerk, cabang, group, tahun) {
      var modalId = "modalSalesDetail";
      var existingModal = document.getElementById(modalId);
      if (existingModal) existingModal.remove();

      var duaDigitThn = String(tahun).slice(-2);

      var modalHtml = \`
        <div id="\${modalId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Segoe UI',sans-serif;padding:15px;box-sizing:border-box;">
          <div style="background:#0d1b2a;color:#fff;padding:18px;border-radius:8px;width:100%;max-width:1000px;box-shadow:0 4px 15px rgba(0,0,0,0.5);border:2px solid #1565c0;display:flex;flex-direction:column;max-height:88vh;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1565c0;padding-bottom:10px;margin-bottom:12px;flex-shrink:0;">
              <h3 style="margin:0;color:#42a5f5;font-size:1rem;">📊 DATA SALES: [\${noper}] \${decodeURIComponent(namaPerk)}</h3>
              <div style="display:flex;gap:8px;align-items:center;">
                <button id="btnExcelSales" onclick="exportTableToExcelMain('tableSalesDetail', 'Sales_\${noper}', '\${decodeURIComponent(namaPerk)}')" style="padding:5px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:0.75rem;display:none;">📥 Excel</button>
                <button onclick="document.getElementById('\${modalId}').remove()" style="background:#e53e3e;border:none;color:#fff;font-size:0.9rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">Tutup &times;</button>
              </div>
            </div>
            <div style="font-size:0.85rem;margin-bottom:10px;color:#90caf9;flex-shrink:0;">Cabang: <b>\${decodeURIComponent(cabang)}</b> | Group: <b>\${decodeURIComponent(group)}</b> | Tahun: <b>\${tahun}</b></div>
            <div style="flex-grow:1;overflow-y:auto;min-height:0;">
              <table id="tableSalesDetail" style="width:100%;border-collapse:collapse;font-size:0.8rem;" border="1">
                <thead>
                  <tr style="background:#1565c0;color:#fff;">
                    <th style="padding:8px;border:1px solid #444;text-align:center;width:8%;">Masa</th>
                    <th style="padding:8px;border:1px solid #444;text-align:left;width:15%;">Kode Menu</th>
                    <th style="padding:8px;border:1px solid #444;text-align:left;width:30%;">Nama Menu</th>
                    <th style="padding:8px;border:1px solid #444;text-align:center;width:8%;">Qty</th>
                    <th style="padding:8px;border:1px solid #444;text-align:center;width:10%;">Satuan</th>
                    <th style="padding:8px;border:1px solid #444;text-align:right;width:15%;">Amount</th>
                    <th style="padding:8px;border:1px solid #444;text-align:right;width:14%;">Total Bulan</th>
                  </tr>
                </thead>
                <tbody id="salesContentBody">
                  <tr><td colspan="7" style="text-align:center;padding:20px;color:#90caf9;">⏳ Memuat data sales...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      \`;
      document.body.insertAdjacentHTML("beforeend", modalHtml);

      try {
        var response = await fetch("/api/data/datasales?cabang=" + encodeURIComponent(cabang) + "&group=" + encodeURIComponent(group));
        var apiData = response.ok ? await response.json() : [];
        var list = Array.isArray(apiData) ? apiData : [];
        var filtered = list.filter(s => String(s.noper || "").trim() === String(noper).trim());
        var tbody = document.getElementById("salesContentBody");

        if (filtered.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#ff8a80;">Tidak ada data sales untuk noper ini</td></tr>';
          return;
        }

        var groupedByMonth = {};
        for (let i = 1; i <= 12; i++) groupedByMonth[("0" + i).slice(-2)] = [];
        filtered.forEach(item => {
          let masa = String(item.masa || item.ma || "").trim();
          let blnKey = masa.substring(0, 2);
          if (groupedByMonth[blnKey]) groupedByMonth[blnKey].push(item);
        });

        var rowsContent = "";
        var grandTotal = 0;
        var grandQty = 0;

        for (let i = 1; i <= 12; i++) {
          let blnKey = ("0" + i).slice(-2);
          let items = groupedByMonth[blnKey];
          if (items.length === 0) continue;

          let totalBulan = 0;
          let totalQtyBulan = 0;
          items.forEach(item => {
            totalBulan += Number(item.amount || item.total || 0);
            totalQtyBulan += Number(item.qty || item.quantity || 0);
          });
          grandTotal += totalBulan;
          grandQty += totalQtyBulan;

          rowsContent += \`
            <tr style="background:#0d47a1;font-weight:bold;color:#bbdefb;">
              <td style="padding:8px;border:1px solid #444;text-align:center;" rowspan="\${items.length + 2}">\${blnKey}\${duaDigitThn}</td>
              <td colspan="4" style="padding:8px;border:1px solid #444;">📦 \${namaBulanArr[i-1]} \${tahun}</td>
              <td style="padding:8px;border:1px solid #444;text-align:right;"></td>
              <td style="padding:8px;border:1px solid #444;text-align:right;color:#4fc3f7;">\${totalBulan.toLocaleString("id-ID")}</td>
            </tr>
          \`;

          items.forEach((item, idx) => {
            let kodeMenu = item.kodemenu || item.kode_menu || item.code || "-";
            let namaMenu = item.namamenu || item.nama_menu || item.ket || item.keterangan || "-";
            let qty = Number(item.qty || item.quantity || 0);
            let satuan = item.satuan || item.unit || "-";
            let amount = Number(item.amount || item.total || 0);
            let bg = idx % 2 === 0 ? "#0a1929" : "#0d1b2a";

            rowsContent += \`
              <tr style="background:\${bg};">
                <td style="padding:6px;border:1px solid #444;color:#64b5f6;">\${kodeMenu}</td>
                <td style="padding:6px;border:1px solid #444;">\${namaMenu}</td>
                <td style="padding:6px;border:1px solid #444;text-align:center;">\${qty || "-"}</td>
                <td style="padding:6px;border:1px solid #444;text-align:center;">\${satuan}</td>
                <td style="padding:6px;border:1px solid #444;text-align:right;">\${amount.toLocaleString("id-ID")}</td>
                <td style="padding:6px;border:1px solid #444;"></td>
              </tr>
            \`;
          });

          rowsContent += \`
            <tr style="background:#112240;font-weight:bold;color:#90caf9;border-top:1px dashed #555;">
              <td colspan="2" style="padding:6px 8px;border:1px solid #444;text-align:right;">SUBTOTAL \${namaBulanArr[i-1]}:</td>
              <td style="padding:6px 8px;border:1px solid #444;text-align:center;">\${totalQtyBulan !== 0 ? totalQtyBulan.toLocaleString("id-ID") : "-"}</td>
              <td style="padding:6px 8px;border:1px solid #444;text-align:center;">-</td>
              <td style="padding:6px 8px;border:1px solid #444;text-align:right;color:#4fc3f7;">\${totalBulan !== 0 ? totalBulan.toLocaleString("id-ID") : "-"}</td>
              <td style="padding:6px 8px;border:1px solid #444;"></td>
            </tr>
          \`;
        }

        rowsContent += \`
          <tr style="background:#1565c0;font-weight:bold;border-top:3px double #fff;">
            <td colspan="3" style="padding:10px;border:1px solid #444;text-align:right;">GRAND TOTAL SALES</td>
            <td style="padding:10px;border:1px solid #444;text-align:center;color:#bbdefb;">\${grandQty !== 0 ? grandQty.toLocaleString("id-ID") : "-"}</td>
            <td style="padding:10px;border:1px solid #444;text-align:center;">-</td>
            <td style="padding:10px;border:1px solid #444;text-align:right;color:#4fc3f7;font-size:1.1rem;">\${grandTotal.toLocaleString("id-ID")}</td>
            <td style="padding:10px;border:1px solid #444;text-align:right;"></td>
          </tr>
        \`;

        tbody.innerHTML = rowsContent;
        document.getElementById("btnExcelSales").style.display = "inline-block";

      } catch (err) {
        console.error(err);
        document.getElementById("salesContentBody").innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#ff8a80;">Gagal memuat: ' + err.message + '</td></tr>';
      }
    }

    // ==========================================
    // POPUP 2: DATA TRANSAKSI (Rp DB-CR)
    // ==========================================
    async function showTransDetailModal(noper, namaPerk, cabang, group, tahun) {
      var modalId = "modalTransDetail";
      var existingModal = document.getElementById(modalId);
      if (existingModal) existingModal.remove();

      var duaDigitThn = String(tahun).slice(-2);

      var modalHtml = \`
        <div id="\${modalId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Segoe UI',sans-serif;padding:15px;box-sizing:border-box;">
          <div style="background:#1a0033;color:#fff;padding:18px;border-radius:8px;width:100%;max-width:900px;box-shadow:0 4px 15px rgba(0,0,0,0.5);border:2px solid #7b1fa2;display:flex;flex-direction:column;max-height:88vh;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #7b1fa2;padding-bottom:10px;margin-bottom:12px;flex-shrink:0;">
              <h3 style="margin:0;color:#ce93d8;font-size:1rem;">📋 DATA TRANSAKSI: [\${noper}] \${decodeURIComponent(namaPerk)}</h3>
              <div style="display:flex;gap:8px;align-items:center;">
                <button id="btnExcelTrans" onclick="exportTableToExcelMain('tableTransDetail', 'Transaksi_\${noper}', '\${decodeURIComponent(namaPerk)}')" style="padding:5px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:0.75rem;display:none;">📥 Excel</button>
                <button onclick="document.getElementById('\${modalId}').remove()" style="background:#e53e3e;border:none;color:#fff;font-size:0.9rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">Tutup &times;</button>
              </div>
            </div>
            <div style="font-size:0.85rem;margin-bottom:10px;color:#ce93d8;flex-shrink:0;">Cabang: <b>\${decodeURIComponent(cabang)}</b> | Group: <b>\${decodeURIComponent(group)}</b> | Tahun: <b>\${tahun}</b></div>
            <div style="flex-grow:1;overflow-y:auto;min-height:0;">
              <table id="tableTransDetail" style="width:100%;border-collapse:collapse;font-size:0.8rem;" border="1">
                <thead>
                  <tr style="background:#4a148c;color:#e1bee7;">
                    <th style="padding:8px;border:1px solid #444;text-align:center;width:10%;">Tanggal</th>
                    <th style="padding:8px;border:1px solid #444;text-align:center;width:12%;">No.Reff</th>
                    <th style="padding:8px;border:1px solid #444;text-align:center;width:10%;">No.Perk</th>
                    <th style="padding:8px;border:1px solid #444;text-align:left;width:33%;">Penjelasan</th>
                    <th style="padding:8px;border:1px solid #444;text-align:center;width:10%;">Cabang</th>
                    <th style="padding:8px;border:1px solid #444;text-align:right;width:25%;">Rp (DB - CR)</th>
                  </tr>
                </thead>
                <tbody id="transContentBody">
                  <tr><td colspan="6" style="text-align:center;padding:20px;color:#ce93d8;">⏳ Memuat data transaksi...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      \`;
      document.body.insertAdjacentHTML("beforeend", modalHtml);

      try {
        var response = await fetch("/api/data/transaksi?cabang=" + encodeURIComponent(cabang) + "&group=" + encodeURIComponent(group) + "&noper=" + encodeURIComponent(noper) + "&tahun=" + tahun);
        var apiData = response.ok ? await response.json() : [];
        var list = Array.isArray(apiData) ? apiData : [];

        var filtered = list.filter((t) => {
          let tNoper = String(t.noper || t.noPerk || "").trim();
          let tCabang = String(t.cabang || t.cab || "").trim().toUpperCase();
          let tGroup = String(t.group || "").trim().toUpperCase();
          
          let tTahun = "";
          let rawTgl = t.tanggal || t.tgl;
          if (rawTgl) {
            let d = new Date(rawTgl);
            if (!isNaN(d.getTime())) tTahun = String(d.getFullYear());
          }
          if (!tTahun && t.tahun) tTahun = String(t.tahun);

          return (
            tNoper === String(noper).trim() &&
            tCabang === String(cabang).trim().toUpperCase() &&
            tGroup === String(group).trim().toUpperCase() &&
            (!tTahun || tTahun === String(tahun))
          );
        });

        var tbody = document.getElementById("transContentBody");

        if (filtered.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#f48fb1;">Tidak ada data transaksi untuk noper ini</td></tr>';
          return;
        }

        filtered.sort((a, b) => new Date(a.tanggal || a.tgl || 0) - new Date(b.tanggal || b.tgl || 0));

        var groupedByMonth = {};
        for (let i = 1; i <= 12; i++) groupedByMonth[("0" + i).slice(-2)] = [];
        filtered.forEach(item => {
          let masa = String(item.masa || item.ma || "").trim();
          let blnKey = masa.substring(0, 2);
          if (groupedByMonth[blnKey]) groupedByMonth[blnKey].push(item);
        });

        var rowsContent = "";
        var grandTotalSelisih = 0;

        for (let i = 1; i <= 12; i++) {
          let blnKey = ("0" + i).slice(-2);
          let items = groupedByMonth[blnKey];
          if (items.length === 0) continue;

          let totalSelisihBulan = 0;
          items.forEach(item => {
            let dbVal = Number(item.db || item.debet || item.debit || 0);
            let crVal = Number(item.cr || item.kredit || item.credit || 0);
            totalSelisihBulan += (dbVal - crVal);
          });
          grandTotalSelisih += totalSelisihBulan;

          rowsContent += \`
            <tr style="background:#4a148c;font-weight:bold;color:#e1bee7;">
              <td colspan="5" style="padding:8px;border:1px solid #444;">📅 SUBTOTAL \${namaBulanArr[i-1]} \${tahun} (\${blnKey}\${duaDigitThn}) — \${items.length} transaksi</td>
              <td style="padding:8px;border:1px solid #444;text-align:right;color:\${totalSelisihBulan >= 0 ? '#81c784' : '#ef9a9a'};">\${totalSelisihBulan !== 0 ? totalSelisihBulan.toLocaleString("id-ID") : "-"}</td>
            </tr>
          \`;

          items.forEach((item, idx) => {
            let tgl = formatTanggal(item.tanggal || item.tgl);
            let noreff = item.noreff || item.no_reff || item.ref || "-";
            let noperItem = item.noper || item.noPerk || item.gol || "-";
            let penjelasan = item.penjelasan || item.keterangan || item.ket || "-";
            let cabangItem = item.cabang || item.cab || "-";
            let dbVal = Number(item.db || item.debet || item.debit || 0);
            let crVal = Number(item.cr || item.kredit || item.credit || 0);
            let selisihBaris = dbVal - crVal;
            let bg = idx % 2 === 0 ? "#1a0033" : "#220044";
            let colorSelisih = selisihBaris >= 0 ? "#81c784" : "#ef9a9a";

            rowsContent += \`
              <tr style="background:\${bg};">
                <td style="padding:6px;border:1px solid #444;text-align:center;color:#ce93d8;white-space:nowrap;">\${tgl}</td>
                <td style="padding:6px;border:1px solid #444;text-align:center;color:#b39ddb;white-space:nowrap;">\${noreff}</td>
                <td style="padding:6px;border:1px solid #444;text-align:center;color:#ba68c8;">\${noperItem}</td>
                <td style="padding:6px;border:1px solid #444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="\${penjelasan}">\${penjelasan}</td>
                <td style="padding:6px;border:1px solid #444;text-align:center;color:#b39ddb;">\${cabangItem}</td>
                <td style="padding:6px;border:1px solid #444;text-align:right;color:\${colorSelisih};">\${selisihBaris !== 0 ? selisihBaris.toLocaleString("id-ID") : "-"}</td>
              </tr>
            \`;
          });
        }

        rowsContent += \`
          <tr style="background:#4a148c;font-weight:bold;border-top:3px double #fff;">
            <td colspan="5" style="padding:10px;border:1px solid #444;text-align:right;">GRAND TOTAL (DB - CR)</td>
            <td style="padding:10px;border:1px solid #444;text-align:right;color:\${grandTotalSelisih >= 0 ? '#81c784' : '#ef9a9a'};font-size:1.1rem;">\${grandTotalSelisih !== 0 ? grandTotalSelisih.toLocaleString("id-ID") : "-"}</td>
          </tr>
        \`;

        tbody.innerHTML = rowsContent;
        document.getElementById("btnExcelTrans").style.display = "inline-block";

      } catch (err) {
        console.error(err);
        document.getElementById("transContentBody").innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#f48fb1;">Gagal memuat: ' + err.message + '</td></tr>';
      }
    }

    // ==========================================
    // POPUP 3: LIHAT BERDAMPINGAN (COMBINED)
    // ==========================================
    async function showCombinedDetailModal(noper, namaPerk, cabang, group, tahun) {
      var modalId = "modalCombinedDetail";
      var existingModal = document.getElementById(modalId);
      if (existingModal) existingModal.remove();

      var duaDigitThn = String(tahun).slice(-2);

      var modalHtml = \`
        <div id="\${modalId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Segoe UI',sans-serif;padding:10px;box-sizing:border-box;">
          <div style="background:#0f172a;color:#fff;padding:15px;border-radius:10px;width:100%;max-width:1450px;box-shadow:0 10px 30px rgba(0,0,0,0.7);border:2px solid #38bdf8;display:flex;flex-direction:column;max-height:92vh;">
            
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #334155;padding-bottom:8px;margin-bottom:10px;flex-shrink:0;">
              <h3 style="margin:0;color:#38bdf8;font-size:1.1rem;">📊📋 DETAIL BERDAMPINGAN: [\${noper}] \${decodeURIComponent(namaPerk)}</h3>
              <button onclick="document.getElementById('\${modalId}').remove()" style="background:#ef4444;border:none;color:#fff;font-size:0.9rem;padding:5px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">Tutup &times;</button>
            </div>
            
            <div style="font-size:0.85rem;margin-bottom:10px;color:#94a3b8;flex-shrink:0;">
              Cabang: <b>\${decodeURIComponent(cabang)}</b> | Group: <b>\${decodeURIComponent(group)}</b> | Tahun: <b>\${tahun}</b>
            </div>

            <div style="display:grid;grid-template-columns: 1fr 1fr;gap:12px;flex-grow:1;overflow:hidden;min-height:0;">
              
              <!-- KIRI: TRANSAKSI (Rp DB-CR dengan Subtotal Bulan) -->
              <div style="background:#1a0033;border:1px solid #7b1fa2;border-radius:8px;display:flex;flex-direction:column;padding:10px;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-shrink:0;">
                  <h4 style="margin:0;color:#ce93d8;font-size:0.95rem;">📋 DATA TRANSAKSI (Rp DB - CR)</h4>
                  <button id="btnExcelTransCombined" onclick="exportTableToExcelMain('tableTransCombined', 'Transaksi_\${noper}', '\${decodeURIComponent(namaPerk)}')" style="padding:4px 8px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:0.7rem;display:none;">📥 Excel</button>
                </div>
                <div style="flex-grow:1;overflow-y:auto;min-height:0;">
                  <table id="tableTransCombined" style="width:100%;border-collapse:collapse;font-size:0.75rem;" border="1">
                    <thead>
                      <tr style="background:#4a148c;color:#e1bee7;">
                        <th style="padding:6px;border:1px solid #444;text-align:center;">Tgl</th>
                        <th style="padding:6px;border:1px solid #444;text-align:center;">No.Reff</th>
                        <th style="padding:6px;border:1px solid #444;text-align:left;">Penjelasan</th>
                        <th style="padding:6px;border:1px solid #444;text-align:right;">Rp (DB - CR)</th>
                      </tr>
                    </thead>
                    <tbody id="transCombinedBody">
                      <tr><td colspan="4" style="text-align:center;padding:15px;color:#ce93d8;">⏳ Memuat transaksi...</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- KANAN: SALES (Dengan Subtotal Bulan) -->
              <div style="background:#0d1b2a;border:1px solid #1565c0;border-radius:8px;display:flex;flex-direction:column;padding:10px;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-shrink:0;">
                  <h4 style="margin:0;color:#90caf9;font-size:0.95rem;">📊 DATA SALES (REKAP BULANAN)</h4>
                  <button id="btnExcelSalesCombined" onclick="exportTableToExcelMain('tableSalesCombined', 'Sales_\${noper}', '\${decodeURIComponent(namaPerk)}')" style="padding:4px 8px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:0.7rem;display:none;">📥 Excel</button>
                </div>
                <div style="flex-grow:1;overflow-y:auto;min-height:0;">
                  <table id="tableSalesCombined" style="width:100%;border-collapse:collapse;font-size:0.75rem;" border="1">
                    <thead>
                      <tr style="background:#1565c0;color:#fff;">
                        <th style="padding:6px;border:1px solid #444;text-align:center;">Masa</th>
                        <th style="padding:6px;border:1px solid #444;text-align:left;">Nama Menu</th>
                        <th style="padding:6px;border:1px solid #444;text-align:left;">Satuan</th>
                        <th style="padding:6px;border:1px solid #444;text-align:center;">Qty</th>
                        <th style="padding:6px;border:1px solid #444;text-align:right;">Amount</th>
                
                      </tr>
                    </thead>
                    <tbody id="salesCombinedBody">
                      <tr><td colspan="5" style="text-align:center;padding:15px;color:#90caf9;">⏳ Memuat sales...</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      \`;
      document.body.insertAdjacentHTML("beforeend", modalHtml);

      // Fetch Transaksi Kombinasi (Rp DB-CR + Subtotal Bulan)
      try {
        var resTrans = await fetch("/api/data/transaksi?cabang=" + encodeURIComponent(cabang) + "&group=" + encodeURIComponent(group) + "&noper=" + encodeURIComponent(noper) + "&tahun=" + tahun);
        var transData = resTrans.ok ? await resTrans.json() : [];
        var listTrans = Array.isArray(transData) ? transData : [];
     
        var filteredTrans = listTrans.filter((t) => {
          let tNoper = String(t.noper || t.noPerk || "").trim();
          let tCabang = String(t.cabang || t.cab || "").trim().toUpperCase();
          let tGroup = String(t.group || "").trim().toUpperCase();
          
          let tTahun = "";
          let rawTgl = t.tanggal || t.tgl;
          if (rawTgl) {
            let d = new Date(rawTgl);
            if (!isNaN(d.getTime())) {
              tTahun = String(d.getFullYear());
            }
          }
          if (!tTahun && t.tahun) {
            tTahun = String(t.tahun);
          }

          return (
            tNoper === String(noper).trim() &&
            tCabang === String(cabang).trim().toUpperCase() &&
            tGroup === String(group).trim().toUpperCase() &&
            (!tTahun || tTahun === String(tahun))
          );
        });

        var transBody = document.getElementById("transCombinedBody");
        if (filteredTrans.length === 0) {
          transBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:15px;color:#f48fb1;">Tidak ada data transaksi</td></tr>';
        } else {
          filteredTrans.sort((a, b) => new Date(a.tanggal || a.tgl || 0) - new Date(b.tanggal || b.tgl || 0));

          var groupedByMonthTrans = {};
          for (let i = 1; i <= 12; i++) groupedByMonthTrans[("0" + i).slice(-2)] = [];
          filteredTrans.forEach(item => {
            let masa = String(item.masa || item.ma || "").trim();
            let blnKey = masa.substring(0, 2);
            if (groupedByMonthTrans[blnKey]) groupedByMonthTrans[blnKey].push(item);
          });

          var transRows = "";
          var grandTotalSelisihCombined = 0;

          for (let i = 1; i <= 12; i++) {
            let blnKey = ("0" + i).slice(-2);
            let items = groupedByMonthTrans[blnKey];
            if (items.length === 0) continue;

            let subtotalBulan = 0;
            items.forEach(item => {
              let dbVal = Number(item.db || item.debet || item.debit || 0);
              let crVal = Number(item.cr || item.kredit || item.credit || 0);
              subtotalBulan += (dbVal - crVal);
            });
            grandTotalSelisihCombined += subtotalBulan;

            transRows += \`
              <tr style="background:#4a148c;font-weight:bold;color:#e1bee7;">
                <td colspan="3" style="padding:5px;border:1px solid #444;">📅 SUBTOTAL \${namaBulanArr[i-1]} \${tahun} (\${blnKey}\${duaDigitThn})</td>
                <td style="padding:5px;border:1px solid #444;text-align:right;color:\${subtotalBulan >= 0 ? '#81c784' : '#ef9a9a'};">\${subtotalBulan !== 0 ? subtotalBulan.toLocaleString("id-ID") : "-"}</td>
              </tr>
            \`;

            items.forEach((item, idx) => {
              let tgl = formatTanggal(item.tanggal || item.tgl);
              let noreff = item.noreff || item.no_reff || item.ref || "-";
              let penjelasan = item.penjelasan || item.keterangan || item.ket || "-";
              let dbVal = Number(item.db || item.debet || item.debit || 0);
              let crVal = Number(item.cr || item.kredit || item.credit || 0);
              let selisih = dbVal - crVal;
              let bg = idx % 2 === 0 ? "#1a0033" : "#220044";
              let colorSelisih = selisih >= 0 ? "#81c784" : "#ef9a9a";

              transRows += \`
                <tr style="background:\${bg};">
                  <td style="padding:5px;border:1px solid #444;text-align:center;color:#ce93d8;">\${tgl}</td>
                  <td style="padding:5px;border:1px solid #444;text-align:center;color:#b39ddb;">\${noreff}</td>
                  <td style="padding:5px;border:1px solid #444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="\${penjelasan}">\${penjelasan}</td>
                  <td style="padding:5px;border:1px solid #444;text-align:right;color:\${colorSelisih};">\${selisih !== 0 ? selisih.toLocaleString("id-ID") : "-"}</td>
                </tr>
              \`;
            });
          }

          transRows += \`
            <tr style="background:#4a148c;font-weight:bold;border-top:2px solid #fff;">
              <td colspan="3" style="padding:6px;border:1px solid #444;text-align:right;">GRAND TOTAL (DB - CR)</td>
              <td style="padding:6px;border:1px solid #444;text-align:right;color:\${grandTotalSelisihCombined >= 0 ? '#81c784' : '#ef9a9a'};">\${grandTotalSelisihCombined.toLocaleString("id-ID")}</td>
            </tr>
          \`;
          transBody.innerHTML = transRows;
          document.getElementById("btnExcelTransCombined").style.display = "inline-block";
        }
      } catch(e) {
        document.getElementById("transCombinedBody").innerHTML = '<tr><td colspan="4" style="text-align:center;padding:15px;color:#f48fb1;">Gagal memuat</td></tr>';
      }

      // Fetch Sales Kombinasi (Dengan Subtotal Bulan)
      try {
        var resSales = await fetch("/api/data/datasales?cabang=" + encodeURIComponent(cabang) + "&group=" + encodeURIComponent(group));
        var salesData = resSales.ok ? await resSales.json() : [];
        var listSales = Array.isArray(salesData) ? salesData : [];
        var filteredSales = listSales.filter(s => String(s.noper || "").trim() === String(noper).trim());

        var salesBody = document.getElementById("salesCombinedBody");
        if (filteredSales.length === 0) {
          salesBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:15px;color:#ff8a80;">Tidak ada data sales</td></tr>';
        } else {
          var groupedByMonthSales = {};
          for (let i = 1; i <= 12; i++) groupedByMonthSales[("0" + i).slice(-2)] = [];
          filteredSales.forEach(item => {
            let masa = String(item.masa || item.ma || "").trim();
            let blnKey = masa.substring(0, 2);
            if (groupedByMonthSales[blnKey]) groupedByMonthSales[blnKey].push(item);
          });

          var salesRows = "";
          var grandTotSales = 0, grandQtySales = 0;

          for (let i = 1; i <= 12; i++) {
            let blnKey = ("0" + i).slice(-2);
            let items = groupedByMonthSales[blnKey];
            if (items.length === 0) continue;

            let subtotalBulanAmount = 0;
            let subtotalBulanQty = 0;
            items.forEach(item => {
              subtotalBulanAmount += Number(item.amount || item.total || 0);
              subtotalBulanQty += Number(item.qty || item.quantity || 0);
            });
            grandTotSales += subtotalBulanAmount;
            grandQtySales += subtotalBulanQty;

       

            salesRows += \`
              <tr style="background:#0d47a1;font-weight:bold;color:#bbdefb;">
                <td colspan="3" style="padding:5px;border:1px solid #444;">📦 SUBTOTAL \${namaBulanArr[i-1]} \${tahun} (\${blnKey}\${duaDigitThn})</td>
                <td style="padding:5px;border:1px solid #444;text-align:center;">\${subtotalBulanQty !== 0 ? subtotalBulanQty.toLocaleString("id-ID") : "-"}</td>
                <td style="padding:5px;border:1px solid #444;text-align:right;color:#4fc3f7;">\${subtotalBulanAmount.toLocaleString("id-ID")}</td>
              </tr>
            \`;

            items.forEach((item, idx) => {
              let masa = String(item.masa || item.ma || "").trim();
              let namaMenu = item.namamenu || item.nama_menu || item.ket || item.keterangan || "-";
              let qty = Number(item.qty || item.quantity || 0);
              let satuan = item.satuan || item.unit || "-";
              let amount = Number(item.amount || item.total || 0);
              let bg = idx % 2 === 0 ? "#0a1929" : "#0d1b2a";

              salesRows += \`
                <tr style="background:\${bg};">
                  <td style="padding:5px;border:1px solid #444;text-align:center;color:#64b5f6;">\${masa}</td>
                  <td style="padding:5px;border:1px solid #444;">\${namaMenu}</td>
                  <td style="padding:5px;border:1px solid #444;">\${satuan}</td>
                  <td style="padding:5px;border:1px solid #444;text-align:center;">\${qty || "-"}</td>
                  <td style="padding:5px;border:1px solid #444;text-align:right;">\${amount.toLocaleString("id-ID")}</td>
                </tr>
              \`;
            });
          }

          salesRows += \`
            <tr style="background:#1565c0;font-weight:bold;border-top:2px solid #fff;">
              <td colspan="3" style="padding:6px;border:1px solid #444;text-align:right;">GRAND TOTAL</td>
              <td style="padding:6px;border:1px solid #444;text-align:center;">\${grandQtySales.toLocaleString("id-ID")}</td>
              <td style="padding:6px;border:1px solid #444;text-align:right;color:#4fc3f7;">\${grandTotSales.toLocaleString("id-ID")}</td>
            </tr>
          \`;
          salesBody.innerHTML = salesRows;
          document.getElementById("btnExcelSalesCombined").style.display = "inline-block";
        }
      } catch(e) {
        document.getElementById("salesCombinedBody").innerHTML = '<tr><td colspan="5" style="text-align:center;padding:15px;color:#ff8a80;">Gagal memuat</td></tr>';
      }
    }

    // ==========================================
    // HELPER & EXPORT EXCEL UMUM
    // ==========================================
    function formatTanggal(rawTgl) {
      if (!rawTgl) return "-";
      try {
        var d = new Date(rawTgl);
        if (!isNaN(d.getTime())) {
          return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
        }
        var str = String(rawTgl);
        var parts = str.split(/[-\\/]/);
        if (parts.length >= 3) {
          return String(parseInt(parts[2])).padStart(2, "0") + "/" + String(parseInt(parts[1])).padStart(2, "0");
        }
        return str.substring(0, 5);
      } catch (e) {
        return "-";
      }
    }

    function exportTableToExcelMain(tableId, fileName, title) {
      var table = document.getElementById(tableId);
      if (!table) return alert("Tabel tidak ditemukan!");

      var clone = table.cloneNode(true);
      clone.querySelectorAll("tr").forEach(function (tr) {
        tr.querySelectorAll("td, th").forEach(function (cell) {
          var teks = cell.textContent.trim();
          if (!teks || teks === "-") return;
          var angkaPolos = teks.replace(/[.,]/g, "").replace(/-/g, "");
          if (!isNaN(angkaPolos) && angkaPolos !== "" && angkaPolos.length <= 4 && !/[a-zA-Z]/.test(teks)) {
            cell.textContent = angkaPolos;
            cell.style.cssText += "mso-number-format:'#,##0';text-align:right;";
          } else {
            cell.textContent = "'" + teks + "'";
            cell.style.cssText += "mso-number-format:'\\\\@';";
          }
        });
      });

      var headerJudul = '<tr><td colspan="6" style="font-size:14px;font-weight:bold;text-align:center;">' + title + '</td></tr>';
      var tbody = clone.querySelector("tbody");
      if (tbody) tbody.insertAdjacentHTML("afterbegin", headerJudul);

      var wrapperHtml = '<html xmlns:o="urn:schemas-microsoft-com:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>' + clone.outerHTML + '</body></html>';
      var blob = new Blob([wrapperHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = fileName + ".xls";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 100);
    }
  `;
}
// ==========================================
// FUNGSI UNTUK HALAMAN UTAMA
// ==========================================

// Popup Menu Pilihan (Halaman Utama)
function showDetailMenu(noper, namaPerk, cabang, group, tahun) {
  var menuId = "menuPilihanDetail";
  var existing = document.getElementById(menuId);
  if (existing) existing.remove();

  var menuHtml = `
    <div id="${menuId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:99999;">
      <div style="background:#1e1e1e;color:#fff;padding:25px;border-radius:12px;width:380px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.6);border:2px solid #00D2FF;text-align:center;">
        <h3 style="margin:0 0 8px 0;color:#00D2FF;font-size:1.1rem;">Pilih Detail Data</h3>
        <p style="margin:0 0 20px 0;color:#aaa;font-size:0.9rem;">[${noper}] ${decodeURIComponent(namaPerk)}</p>
        
        <button onclick="document.getElementById('${menuId}').remove(); showSalesDetailModal('${noper}', '${namaPerk}', '${cabang}', '${group}', '${tahun}')" 
          style="width:100%;padding:12px;margin-bottom:10px;background:linear-gradient(135deg,#0d47a1,#1565c0);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;">
          📊 DATA SALEsS<br>
          <span style="font-size:0.75rem;font-weight:normal;opacity:0.8;">Rekap per bulan berdasarkan kode menu</span>
        </button>
        
        <button onclick="document.getElementById('${menuId}').remove(); showTransDetailModal('${noper}', '${namaPerk}', '${cabang}', '${group}', '${tahun}')" 
          style="width:100%;padding:12px;margin-bottom:10px;background:linear-gradient(135deg,#4a148c,#7b1fa2);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;">
          📋 DATA TRANSAKSI<br>
          <span style="font-size:0.75rem;font-weight:normal;opacity:0.8;">Detail transaksi harian lengkap</span>
        </button>
        
        <button onclick="document.getElementById('${menuId}').remove(); showCombinedDetailModal('${noper}', '${namaPerk}', '${cabang}', '${group}', '${tahun}')" 
          style="width:100%;padding:12px;margin-bottom:10px;background:linear-gradient(135deg,#0369a1,#7e22ce);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;">
          📋📊 LIHAT BERDAMPINGAN<br>
          <span style="font-size:0.75rem;font-weight:normal;opacity:0.8;">Detail transaksi harian dan sales</span>
        </button>

        <button onclick="document.getElementById('${menuId}').remove()" 
          style="width:100%;padding:10px;background:#333;color:#aaa;border:1px solid #555;border-radius:8px;cursor:pointer;font-size:0.9rem;">
          ✕ Batal
        </button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", menuHtml);
}

// Popup 1: DATA SALES (Halaman Utama)
function showSalesDetailModal(noper, namaPerk, cabang, group, tahun) {
  var modalId = "modalSalesDetail";
  var existingModal = document.getElementById(modalId);
  if (existingModal) existingModal.remove();

  var duaDigitThn = String(tahun).slice(-2);

  var modalHtml = `
    <div id="${modalId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Segoe UI',sans-serif;padding:15px;box-sizing:border-box;">
      <div style="background:#0d1b2a;color:#fff;padding:18px;border-radius:8px;width:100%;max-width:1000px;box-shadow:0 4px 15px rgba(0,0,0,0.5);border:2px solid #1565c0;display:flex;flex-direction:column;max-height:88vh;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1565c0;padding-bottom:10px;margin-bottom:12px;flex-shrink:0;">
          <h3 style="margin:0;color:#42a5f5;font-size:1rem;">📊 DATA SALES: [${noper}] ${decodeURIComponent(namaPerk)}</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="btnExcelSales" onclick="exportSalesToExcelMain('${noper}', '${namaPerk}')" style="padding:5px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:0.75rem;display:none;">📥 Excel</button>
            <button onclick="document.getElementById('${modalId}').remove()" style="background:#e53e3e;border:none;color:#fff;font-size:0.9rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">Tutup &times;</button>
          </div>
        </div>
        <div style="font-size:0.85rem;margin-bottom:10px;color:#90caf9;flex-shrink:0;">Cabang: <b>${decodeURIComponent(cabang)}</b> | Group: <b>${decodeURIComponent(group)}</b> | Tahun: <b>${tahun}</b></div>
        <div style="flex-grow:1;overflow-y:auto;min-height:0;">
          <table id="tableSalesDetail" style="width:100%;border-collapse:collapse;font-size:0.8rem;" border="1">
            <thead>
              <tr style="background:#1565c0;color:#fff;">
                <th style="padding:8px;border:1px solid #444;text-align:center;width:8%;">Masa</th>
                <th style="padding:8px;border:1px solid #444;text-align:left;width:15%;">Kode Menu</th>
                <th style="padding:8px;border:1px solid #444;text-align:left;width:30%;">Nama Menu</th>
                <th style="padding:8px;border:1px solid #444;text-align:center;width:8%;">Qty</th>
                <th style="padding:8px;border:1px solid #444;text-align:center;width:10%;">Satuan</th>
                <th style="padding:8px;border:1px solid #444;text-align:right;width:15%;">Amount</th>
                <th style="padding:8px;border:1px solid #444;text-align:right;width:14%;">Total Bulan</th>
              </tr>
            </thead>
            <tbody id="salesContentBody">
              <tr><td colspan="7" style="text-align:center;padding:20px;color:#90caf9;">⏳ Memuat data sales...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  fetch(
    "/api/data/datasales?cabang=" +
      encodeURIComponent(cabang) +
      "&group=" +
      encodeURIComponent(group),
  )
    .then((res) => (res.ok ? res.json() : []))
    .then((apiData) => {
      var list = Array.isArray(apiData) ? apiData : [];
      var filtered = list.filter(
        (s) => String(s.noper || "").trim() === String(noper).trim(),
      );
      var tbody = document.getElementById("salesContentBody");

      if (filtered.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="7" style="text-align:center;padding:20px;color:#ff8a80;">Tidak ada data sales untuk noper ini</td></tr>';
        return;
      }

      var groupedByMonth = {};
      for (let i = 1; i <= 12; i++) groupedByMonth[("0" + i).slice(-2)] = [];
      filtered.forEach((item) => {
        let masa = String(item.masa || item.ma || "").trim();
        let blnKey = masa.substring(0, 2);
        if (groupedByMonth[blnKey]) groupedByMonth[blnKey].push(item);
      });

      var arrNamaBulan = [
        "JANUARI",
        "FEBRUARI",
        "MARET",
        "APRIL",
        "MEI",
        "JUNI",
        "JULI",
        "AGUSTUS",
        "SEPTEMBER",
        "OKTOBER",
        "NOVEMBER",
        "DESEMBER",
      ];
      var rowsContent = "";
      var grandTotal = 0;
      var grandQty = 0; // ✅ Tambah grand total qty

      for (let i = 1; i <= 12; i++) {
        let blnKey = ("0" + i).slice(-2);
        let items = groupedByMonth[blnKey];
        if (items.length === 0) continue;

        let totalBulan = 0;
        let totalQtyBulan = 0;

        items.forEach((item) => {
          totalBulan += Number(item.amount || item.total || 0);
          totalQtyBulan += Number(item.qty || item.quantity || 0);
        });
        grandTotal += totalBulan;
        grandQty += totalQtyBulan; // ✅ Akumulasi grand qty

        // ✅ FIX: rowspan diubah jadi +2
        rowsContent += `
          <tr style="background:#0d47a1;font-weight:bold;color:#bbdefb;">
            <td style="padding:8px;border:1px solid #444;text-align:center;" rowspan="${items.length + 2}">${blnKey}${duaDigitThn}</td>
            <td colspan="4" style="padding:8px;border:1px solid #444;">📦 ${arrNamaBulan[i - 1]} ${tahun}</td>
            <td style="padding:8px;border:1px solid #444;text-align:right;"></td>
            <td style="padding:8px;border:1px solid #444;text-align:right;color:#4fc3f7;">${totalBulan.toLocaleString("id-ID")}</td>
          </tr>
        `;

        items.forEach((item, idx) => {
          let kodeMenu = item.kodemenu || item.kode_menu || item.code || "-";
          let namaMenu =
            item.namamenu ||
            item.nama_menu ||
            item.ket ||
            item.keterangan ||
            "-";
          let qty = Number(item.qty || item.quantity || 0);
          let satuan = item.satuan || item.unit || "-";
          let amount = Number(item.amount || item.total || 0);
          let bg = idx % 2 === 0 ? "#0a1929" : "#0d1b2a";

          rowsContent += `
            <tr style="background:${bg};">
              <td style="padding:6px;border:1px solid #444;color:#64b5f6;">${kodeMenu}</td>
              <td style="padding:6px;border:1px solid #444;">${namaMenu}</td>
              <td style="padding:6px;border:1px solid #444;text-align:center;">${qty || "-"}</td>
              <td style="padding:6px;border:1px solid #444;text-align:center;">${satuan}</td>
              <td style="padding:6px;border:1px solid #444;text-align:right;">${amount.toLocaleString("id-ID")}</td>
              <td style="padding:6px;border:1px solid #444;"></td>
            </tr>
          `;
        });

        // ✅ FIX: namaBulanArr → arrNamaBulan
        rowsContent += `
          <tr style="background:#112240;font-weight:bold;color:#90caf9;border-top:1px dashed #555;">
            <td colspan="2" style="padding:6px 8px;border:1px solid #444;text-align:right;">TOTAL ${arrNamaBulan[i - 1]}:</td>
            <td style="padding:6px 8px;border:1px solid #444;text-align:center;">${totalQtyBulan !== 0 ? totalQtyBulan.toLocaleString("id-ID") : "-"}</td>
            <td style="padding:6px 8px;border:1px solid #444;text-align:center;">-</td>
            <td style="padding:6px 8px;border:1px solid #444;text-align:right;color:#4fc3f7;">${totalBulan !== 0 ? totalBulan.toLocaleString("id-ID") : "-"}</td>
            <td style="padding:6px 8px;border:1px solid #444;"></td>
          </tr>
        `;
      }

      // ✅ Grand total dengan qty
      rowsContent += `
        <tr style="background:#1565c0;font-weight:bold;border-top:3px double #fff;">
          <td colspan="3" style="padding:10px;border:1px solid #444;text-align:right;">GRAND TOTAL SALES</td>
          <td style="padding:10px;border:1px solid #444;text-align:center;color:#bbdefb;">${grandQty !== 0 ? grandQty.toLocaleString("id-ID") : "-"}</td>
          <td style="padding:10px;border:1px solid #444;text-align:center;">-</td>
          <td style="padding:10px;border:1px solid #444;text-align:right;color:#4fc3f7;font-size:1.1rem;">${grandTotal.toLocaleString("id-ID")}</td>
          <td style="padding:10px;border:1px solid #444;text-align:right;"></td>
        </tr>
      `;

      tbody.innerHTML = rowsContent;
      document.getElementById("btnExcelSales").style.display = "inline-block";
    })
    .catch((err) => {
      console.error(err);
      document.getElementById("salesContentBody").innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:20px;color:#ff8a80;">Gagal memuat: ' +
        err.message +
        "</td></tr>";
    });
}

// Popup 2: DATA TRANSAKSI (Halaman Utama - menggunakan db.getAll)
function showTransDetailModal(noper, namaPerk, cabang, group, tahun) {
  var modalId = "modalTransDetail";
  var existingModal = document.getElementById(modalId);
  if (existingModal) existingModal.remove();

  var duaDigitThn = String(tahun).slice(-2);

  var modalHtml = `
    <div id="${modalId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Segoe UI',sans-serif;padding:15px;box-sizing:border-box;">
      <div style="background:#1a0033;color:#fff;padding:18px;border-radius:8px;width:100%;max-width:900px;box-shadow:0 4px 15px rgba(0,0,0,0.5);border:2px solid #7b1fa2;display:flex;flex-direction:column;max-height:88vh;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #7b1fa2;padding-bottom:10px;margin-bottom:12px;flex-shrink:0;">
          <h3 style="margin:0;color:#ce93d8;font-size:1rem;">📋 DATA TRANSAKSI: [${noper}] ${decodeURIComponent(namaPerk)}</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="btnExcelTrans" onclick="exportTransToExcelMain('${noper}', '${namaPerk}')" style="padding:5px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:0.75rem;display:none;">📥 Excel</button>
            <button onclick="document.getElementById('${modalId}').remove()" style="background:#e53e3e;border:none;color:#fff;font-size:0.9rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">Tutup &times;</button>
          </div>
        </div>
        <div style="font-size:0.85rem;margin-bottom:10px;color:#ce93d8;flex-shrink:0;">Cabang: <b>${decodeURIComponent(cabang)}</b> | Group: <b>${decodeURIComponent(group)}</b> | Tahun: <b>${tahun}</b></div>
        <div style="flex-grow:1;overflow-y:auto;min-height:0;">
          <table id="tableTransDetail" style="width:100%;border-collapse:collapse;font-size:0.8rem;" border="1">
            <thead>
              <tr style="background:#4a148c;color:#e1bee7;">
                <th style="padding:8px;border:1px solid #444;text-align:center;width:10%;">Tanggal</th>
                <th style="padding:8px;border:1px solid #444;text-align:center;width:12%;">No.Reff</th>
                <th style="padding:8px;border:1px solid #444;text-align:center;width:10%;">No.Perk</th>
                <th style="padding:8px;border:1px solid #444;text-align:left;width:35%;">Penjelasan</th>
                <th style="padding:8px;border:1px solid #444;text-align:center;width:10%;">Cabang</th>
                <th style="padding:8px;border:1px solid #444;text-align:right;width:11%;">Debet</th>
                <th style="padding:8px;border:1px solid #444;text-align:right;width:11%;">Kredit</th>
              </tr>
            </thead>
            <tbody id="transContentBody">
              <tr><td colspan="7" style="text-align:center;padding:20px;color:#ce93d8;">⏳ Memuat data transaksi...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Ambil dari IndexedDB (halaman utama punya akses db)
  var storeName = "transaksi" + tahun;

  (typeof db !== "undefined" && db.getAll
    ? db
        .getAll(storeName)
        .then((res) =>
          res ? (Array.isArray(res) ? res : Object.values(res)) : [],
        )
    : Promise.resolve([])
  )
    .then((transData) => {
      var filtered = transData.filter((t) => {
        let tNoper = String(t.noper || t.noPerk || "").trim();
        let tCabang = String(t.cabang || t.cab || "")
          .trim()
          .toUpperCase();
        let tGroup = String(t.group || "")
          .trim()
          .toUpperCase();

        // Ambil tahun dari tanggal transaksi jika ada, atau pastikan properti tahun cocok
        let tTahun = "";
        let rawTgl = t.tanggal || t.tgl;
        if (rawTgl) {
          let d = new Date(rawTgl);
          if (!isNaN(d.getTime())) {
            tTahun = String(d.getFullYear());
          }
        }
        if (!tTahun && t.tahun) {
          tTahun = String(t.tahun);
        }

        return (
          tNoper === String(noper).trim() &&
          tCabang === String(cabang).trim().toUpperCase() &&
          tGroup === String(group).trim().toUpperCase() &&
          (!tTahun || tTahun === String(tahun)) // ✅ Validasi tambahan agar tahunnya klop
        );
      });
      var tbody = document.getElementById("transContentBody");

      if (filtered.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="7" style="text-align:center;padding:20px;color:#f48fb1;">Tidak ada data transaksi untuk noper ini</td></tr>';
        return;
      }

      // Sort by tanggal
      filtered.sort(
        (a, b) =>
          new Date(a.tanggal || a.tgl || 0) - new Date(b.tanggal || b.tgl || 0),
      );

      var arrNamaBulan = [
        "JANUARI",
        "FEBRUARI",
        "MARET",
        "APRIL",
        "MEI",
        "JUNI",
        "JULI",
        "AGUSTUS",
        "SEPTEMBER",
        "OKTOBER",
        "NOVEMBER",
        "DESEMBER",
      ];

      // Group by bulan
      var groupedByMonth = {};
      for (let i = 1; i <= 12; i++) groupedByMonth[("0" + i).slice(-2)] = [];
      filtered.forEach((item) => {
        let masa = String(item.masa || item.ma || "").trim();
        let blnKey = masa.substring(0, 2);
        if (groupedByMonth[blnKey]) groupedByMonth[blnKey].push(item);
      });

      var rowsContent = "";
      var grandTotalDb = 0;
      var grandTotalCr = 0;

      for (let i = 1; i <= 12; i++) {
        let blnKey = ("0" + i).slice(-2);
        let items = groupedByMonth[blnKey];
        if (items.length === 0) continue;

        let totalDb = 0;
        let totalCr = 0;
        items.forEach((item) => {
          totalDb += Number(item.db || item.debet || item.debit || 0);
          totalCr += Number(item.cr || item.kredit || item.credit || 0);
        });
        grandTotalDb += totalDb;
        grandTotalCr += totalCr;

        // Header bulan
        rowsContent += `
          <tr style="background:#4a148c;font-weight:bold;color:#e1bee7;">
            <td colspan="4" style="padding:8px;border:1px solid #444;">📅 ${arrNamaBulan[i - 1]} ${tahun} (${blnKey}${duaDigitThn}) — ${items.length} transaksi</td>
            <td style="padding:8px;border:1px solid #444;text-align:center;"></td>
            <td style="padding:8px;border:1px solid #444;text-align:right;color:#81c784;">${totalDb !== 0 ? totalDb.toLocaleString("id-ID") : "-"}</td>
            <td style="padding:8px;border:1px solid #444;text-align:right;color:#ef9a9a;">${totalCr !== 0 ? totalCr.toLocaleString("id-ID") : "-"}</td>
          </tr>
        `;

        // Detail per transaksi
        items.forEach((item, idx) => {
          let tgl = formatTanggal(item.tanggal || item.tgl);
          let noreff = item.noreff || item.no_reff || item.ref || "-";
          let noperItem = item.noper || item.noPerk || item.gol || "-";
          let penjelasan =
            item.penjelasan || item.keterangan || item.ket || "-";
          let cabangItem = item.cabang || item.cab || "-";
          let dbVal = Number(item.db || item.debet || item.debit || 0);
          let crVal = Number(item.cr || item.kredit || item.credit || 0);

          let bg = idx % 2 === 0 ? "#1a0033" : "#220044";
          let colorDb = dbVal > 0 ? "#81c784" : "#888";
          let colorCr = crVal > 0 ? "#ef9a9a" : "#888";

          rowsContent += `
            <tr style="background:${bg};">
              <td style="padding:6px;border:1px solid #444;text-align:center;color:#ce93d8;white-space:nowrap;">${tgl}</td>
              <td style="padding:6px;border:1px solid #444;text-align:center;color:#b39ddb;white-space:nowrap;">${noreff}</td>
              <td style="padding:6px;border:1px solid #444;text-align:center;color:#ba68c8;">${noperItem}</td>
              <td style="padding:6px;border:1px solid #444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${penjelasan}">${penjelasan}</td>
              <td style="padding:6px;border:1px solid #444;text-align:center;color:#b39ddb;">${cabangItem}</td>
              <td style="padding:6px;border:1px solid #444;text-align:right;color:${colorDb};">${dbVal !== 0 ? dbVal.toLocaleString("id-ID") : "-"}</td>
              <td style="padding:6px;border:1px solid #444;text-align:right;color:${colorCr};">${crVal !== 0 ? crVal.toLocaleString("id-ID") : "-"}</td>
            </tr>
          `;
        });
      }

      // Grand total
      rowsContent += `
        <tr style="background:#4a148c;font-weight:bold;border-top:3px double #fff;">
          <td colspan="5" style="padding:10px;border:1px solid #444;text-align:right;">GRAND TOTAL</td>
          <td style="padding:10px;border:1px solid #444;text-align:right;color:#81c784;font-size:1.1rem;">${grandTotalDb !== 0 ? grandTotalDb.toLocaleString("id-ID") : "-"}</td>
          <td style="padding:10px;border:1px solid #444;text-align:right;color:#ef9a9a;font-size:1.1rem;">${grandTotalCr !== 0 ? grandTotalCr.toLocaleString("id-ID") : "-"}</td>
        </tr>
      `;

      tbody.innerHTML = rowsContent;
      document.getElementById("btnExcelTrans").style.display = "inline-block";
    })
    .catch((err) => {
      console.error(err);
      document.getElementById("transContentBody").innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:20px;color:#f48fb1;">Gagal memuat: ' +
        err.message +
        "</td></tr>";
    });
}

// ==========================================
// POPUP GABUNGAN: DATA TRANSAKSI & SALES (SIDE-BY-SIDE)
// ==========================================
function showCombinedDetailModal(noper, namaPerk, cabang, group, tahun) {
  var modalId = "modalCombinedDetail";
  var existingModal = document.getElementById(modalId);
  if (existingModal) existingModal.remove();

  var duaDigitThn = String(tahun).slice(-2);

  var modalHtml = `
    <div id="${modalId}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:9999;font-family:'Segoe UI',sans-serif;padding:10px;box-sizing:border-box;">
      <div style="background:#0f172a;color:#fff;padding:15px;border-radius:10px;width:100%;max-width:1450px;box-shadow:0 10px 30px rgba(0,0,0,0.7);border:2px solid #38bdf8;display:flex;flex-direction:column;max-height:92vh;">
        
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #334155;padding-bottom:8px;margin-bottom:10px;flex-shrink:0;">
          <h3 style="margin:0;color:#38bdf8;font-size:1.1rem;">📊📋 DETAIL DATA BERDAMPINGAN: [${noper}] ${decodeURIComponent(namaPerk)}</h3>
          <button onclick="document.getElementById('${modalId}').remove()" style="background:#ef4444;border:none;color:#fff;font-size:0.9rem;padding:5px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">Tutup &times;</button>
        </div>
        
        <div style="font-size:0.85rem;margin-bottom:10px;color:#94a3b8;flex-shrink:0;">
          Cabang: <b>${decodeURIComponent(cabang)}</b> | Group: <b>${decodeURIComponent(group)}</b> | Tahun: <b>${tahun}</b>
        </div>

        <div style="display:grid;grid-template-columns: 1fr 1fr;gap:12px;flex-grow:1;overflow:hidden;min-height:0;">
          
          <!-- KIRI: DATA TRANSAKSI (Rp DB-CR) -->
          <div style="background:#1a0033;border:1px solid #7b1fa2;border-radius:8px;display:flex;flex-direction:column;padding:10px;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-shrink:0;">
              <h4 style="margin:0;color:#ce93d8;font-size:0.95rem;">📋 DATA TRANSAKSI (Rp DB - CR)</h4>
              <button id="btnExcelTransCombined" onclick="exportTransToExcelMain('${noper}', '${namaPerk}')" style="padding:4px 8px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:0.7rem;display:none;">📥 Excel</button>
            </div>
            <div style="flex-grow:1;overflow-y:auto;min-height:0;">
              <table id="tableTransDetail" style="width:100%;border-collapse:collapse;font-size:0.75rem;" border="1">
                <thead>
                  <tr style="background:#4a148c;color:#e1bee7;">
                    <th style="padding:6px;border:1px solid #444;text-align:center;">Tgl</th>
                    <th style="padding:6px;border:1px solid #444;text-align:center;">No.Reff</th>
                    <th style="padding:6px;border:1px solid #444;text-align:left;">Penjelasan</th>
                    <th style="padding:6px;border:1px solid #444;text-align:right;">Rp (DB - CR)</th>
                  </tr>
                </thead>
                <tbody id="transContentBody">
                  <tr><td colspan="4" style="text-align:center;padding:15px;color:#ce93d8;">⏳ Memuat transaksi...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- KANAN: DATA SALES -->
          <div style="background:#0d1b2a;border:1px solid #1565c0;border-radius:8px;display:flex;flex-direction:column;padding:10px;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-shrink:0;">
              <h4 style="margin:0;color:#90caf9;font-size:0.95rem;">📊 DATA SALES (REKAP BULANAN)</h4>
              <button id="btnExcelSalesCombined" onclick="exportSalesToExcelMain('${noper}', '${namaPerk}')" style="padding:4px 8px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:0.7rem;display:none;">📥 Excel</button>
            </div>
            <div style="flex-grow:1;overflow-y:auto;min-height:0;">
              <table id="tableSalesDetail" style="width:100%;border-collapse:collapse;font-size:0.75rem;" border="1">
                <thead>
                  <tr style="background:#1565c0;color:#fff;">
                    <th style="padding:6px;border:1px solid #444;text-align:center;">Masa</th>
                    <th style="padding:6px;border:1px solid #444;text-align:left;">Nama Menu</th>
                    <th style="padding:6px;border:1px solid #444;text-align:left;">Satuan</th>
                    <th style="padding:6px;border:1px solid #444;text-align:center;">Qty</th>
                    <th style="padding:6px;border:1px solid #444;text-align:right;">Amount</th>
              
                  </tr>
                </thead>
                <tbody id="salesContentBody">
                  <tr><td colspan="5" style="text-align:center;padding:15px;color:#90caf9;">⏳ Memuat sales...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  var namaBulanArr = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];

  var storeName = "transaksi" + tahun;
  (typeof db !== "undefined" && db.getAll
    ? db
        .getAll(storeName)
        .then((res) =>
          res ? (Array.isArray(res) ? res : Object.values(res)) : [],
        )
    : Promise.resolve([])
  )
    .then((transData) => {
      var filteredTrans = transData.filter((t) => {
        let tNoper = String(t.noper || t.noPerk || "").trim();
        let tCabang = String(t.cabang || t.cab || "")
          .trim()
          .toUpperCase();
        let tGroup = String(t.group || "")
          .trim()
          .toUpperCase();

        let tTahun = "";
        let rawTgl = t.tanggal || t.tgl;
        if (rawTgl) {
          let d = new Date(rawTgl);
          if (!isNaN(d.getTime())) {
            tTahun = String(d.getFullYear());
          }
        }
        if (!tTahun && t.tahun) {
          tTahun = String(t.tahun);
        }

        return (
          tNoper === String(noper).trim() &&
          tCabang === String(cabang).trim().toUpperCase() &&
          tGroup === String(group).trim().toUpperCase() &&
          (!tTahun || tTahun === String(tahun))
        );
      });

      var transTbody = document.getElementById("transContentBody");
      if (filteredTrans.length === 0) {
        transTbody.innerHTML =
          '<tr><td colspan="4" style="text-align:center;padding:15px;color:#f48fb1;">Tidak ada data transaksi</td></tr>';
      } else {
        filteredTrans.sort(
          (a, b) =>
            new Date(a.tanggal || a.tgl || 0) -
            new Date(b.tanggal || b.tgl || 0),
        );

        var groupedByMonthTrans = {};
        for (let i = 1; i <= 12; i++)
          groupedByMonthTrans[("0" + i).slice(-2)] = [];
        filteredTrans.forEach((item) => {
          let masa = String(item.masa || item.ma || "").trim();
          let blnKey = masa.substring(0, 2);
          if (groupedByMonthTrans[blnKey])
            groupedByMonthTrans[blnKey].push(item);
        });

        var transRows = "";
        var grandTotalSelisih = 0;

        for (let i = 1; i <= 12; i++) {
          let blnKey = ("0" + i).slice(-2);
          let items = groupedByMonthTrans[blnKey];
          if (items.length === 0) continue;

          let subtotalBulan = 0;
          items.forEach((item) => {
            let dbVal = Number(item.db || item.debet || item.debit || 0);
            let crVal = Number(item.cr || item.kredit || item.credit || 0);
            subtotalBulan += dbVal - crVal;
          });
          grandTotalSelisih += subtotalBulan;

          transRows += `
            <tr style="background:#4a148c;font-weight:bold;color:#e1bee7;">
              <td colspan="3" style="padding:5px;border:1px solid #444;">📅 SUBTOTAL ${namaBulanArr[i - 1]} ${tahun} (${blnKey}${duaDigitThn})</td>
              <td style="padding:5px;border:1px solid #444;text-align:right;color:${subtotalBulan >= 0 ? "#81c784" : "#ef9a9a"};">${subtotalBulan !== 0 ? subtotalBulan.toLocaleString("id-ID") : "-"}</td>
            </tr>
          `;

          items.forEach((item, idx) => {
            let tgl = formatTanggal(item.tanggal || item.tgl);
            let noreff = item.noreff || item.no_reff || item.ref || "-";
            let penjelasan =
              item.penjelasan || item.keterangan || item.ket || "-";
            let dbVal = Number(item.db || item.debet || item.debit || 0);
            let crVal = Number(item.cr || item.kredit || item.credit || 0);
            let selisihBaris = dbVal - crVal;
            let bg = idx % 2 === 0 ? "#1a0033" : "#220044";
            let colorSelisih = selisihBaris >= 0 ? "#81c784" : "#ef9a9a";

            transRows += `
              <tr style="background:${bg};">
                <td style="padding:5px;border:1px solid #444;text-align:center;color:#ce93d8;">${tgl}</td>
                <td style="padding:5px;border:1px solid #444;text-align:center;color:#b39ddb;">${noreff}</td>
                <td style="padding:5px;border:1px solid #444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${penjelasan}">${penjelasan}</td>
                <td style="padding:5px;border:1px solid #444;text-align:right;color:${colorSelisih};">${selisihBaris !== 0 ? selisihBaris.toLocaleString("id-ID") : "-"}</td>
              </tr>
            `;
          });
        }

        transRows += `
          <tr style="background:#4a148c;font-weight:bold;border-top:2px solid #fff;">
            <td colspan="3" style="padding:6px;border:1px solid #444;text-align:right;">GRAND TOTAL (DB - CR)</td>
            <td style="padding:6px;border:1px solid #444;text-align:right;color:${grandTotalSelisih >= 0 ? "#81c784" : "#ef9a9a"};">${grandTotalSelisih.toLocaleString("id-ID")}</td>
          </tr>
        `;
        transTbody.innerHTML = transRows;
        document.getElementById("btnExcelTransCombined").style.display =
          "inline-block";
      }
    })
    .catch((err) => {
      document.getElementById("transContentBody").innerHTML =
        '<tr><td colspan="4" style="text-align:center;padding:15px;color:#f48fb1;">Gagal memuat</td></tr>';
    });

  fetch(
    "/api/data/datasales?cabang=" +
      encodeURIComponent(cabang) +
      "&group=" +
      encodeURIComponent(group),
  )
    .then((res) => (res.ok ? res.json() : []))
    .then((apiData) => {
      var list = Array.isArray(apiData) ? apiData : [];
      var filteredSales = list.filter(
        (s) => String(s.noper || "").trim() === String(noper).trim(),
      );
      var salesTbody = document.getElementById("salesContentBody");

      if (filteredSales.length === 0) {
        salesTbody.innerHTML =
          '<tr><td colspan="5" style="text-align:center;padding:15px;color:#ff8a80;">Tidak ada data sales</td></tr>';
      } else {
        var groupedByMonthSales = {};
        for (let i = 1; i <= 12; i++)
          groupedByMonthSales[("0" + i).slice(-2)] = [];
        filteredSales.forEach((item) => {
          let masa = String(item.masa || item.ma || "").trim();
          let blnKey = masa.substring(0, 2);
          if (groupedByMonthSales[blnKey])
            groupedByMonthSales[blnKey].push(item);
        });

        var salesRows = "";
        var grandTotSales = 0,
          grandQtySales = 0;

        for (let i = 1; i <= 12; i++) {
          let blnKey = ("0" + i).slice(-2);
          let items = groupedByMonthSales[blnKey];
          if (items.length === 0) continue;

          let subtotalBulanAmount = 0;
          let subtotalBulanQty = 0;
          items.forEach((item) => {
            subtotalBulanAmount += Number(item.amount || item.total || 0);
            subtotalBulanQty += Number(item.qty || item.quantity || 0);
          });
          grandTotSales += subtotalBulanAmount;
          grandQtySales += subtotalBulanQty;

          salesRows += `
              <tr style="background:#0d47a1;font-weight:bold;color:#bbdefb;">
                <td colspan="3" style="padding:5px;border:1px solid #444;">📦 SUBTOTAL ${namaBulanArr[i - 1]} ${tahun} (${blnKey}${duaDigitThn})</td>
                <td style="padding:5px;border:1px solid #444;text-align:center;">${subtotalBulanQty !== 0 ? subtotalBulanQty.toLocaleString("id-ID") : "-"}</td>
                <td style="padding:5px;border:1px solid #444;text-align:right;color:#4fc3f7;">${subtotalBulanAmount.toLocaleString("id-ID")}</td>
              </tr>
            `;

          items.forEach((item, idx) => {
            let masa = String(item.masa || item.ma || "").trim();
            let namaMenu =
              item.namamenu ||
              item.nama_menu ||
              item.ket ||
              item.keterangan ||
              "-";
            let qty = Number(item.qty || item.quantity || 0);
            let satuan = item.satuan || item.unit || "-";
            let amount = Number(item.amount || item.total || 0);
            let bg = idx % 2 === 0 ? "#0a1929" : "#0d1b2a";

            salesRows += `
              <tr style="background:${bg};">
                <td style="padding:5px;border:1px solid #444;text-align:center;color:#64b5f6;">${masa}</td>
                <td style="padding:5px;border:1px solid #444;">${namaMenu}</td>
                <td style="padding:5px;border:1px solid #444;">${satuan}</td>
                <td style="padding:5px;border:1px solid #444;text-align:center;">${qty || "-"}</td>
                <td style="padding:5px;border:1px solid #444;text-align:right;">${amount.toLocaleString("id-ID")}</td>
              </tr>
            `;
          });
        }

        salesRows += `
          <tr style="background:#1565c0;font-weight:bold;border-top:2px solid #fff;">
            <td colspan="3" style="padding:6px;border:1px solid #444;text-align:right;">GRAND TOTAL</td>
            <td style="padding:6px;border:1px solid #444;text-align:center;">${grandQtySales.toLocaleString("id-ID")}</td>
            <td style="padding:6px;border:1px solid #444;text-align:right;color:#4fc3f7;">${grandTotSales.toLocaleString("id-ID")}</td>
          </tr>
        `;
        salesTbody.innerHTML = salesRows;
        document.getElementById("btnExcelSalesCombined").style.display =
          "inline-block";
      }
    })
    .catch((err) => {
      document.getElementById("salesContentBody").innerHTML =
        '<tr><td colspan="5" style="text-align:center;padding:15px;color:#ff8a80;">Gagal memuat</td></tr>';
    });
}

// Helper: Format tanggal ke DD/MM
function formatTanggal(rawTgl) {
  if (!rawTgl) return "-";
  try {
    if (rawTgl instanceof Date) {
      return isNaN(rawTgl)
        ? "-"
        : String(rawTgl.getDate()).padStart(2, "0") +
            "/" +
            String(rawTgl.getMonth() + 1).padStart(2, "0");
    }
    var d = new Date(rawTgl);
    if (!isNaN(d.getTime())) {
      return (
        String(d.getDate()).padStart(2, "0") +
        "/" +
        String(d.getMonth() + 1).padStart(2, "0")
      );
    }
    // Fallback: coba parse manual
    var str = String(rawTgl);
    var parts = str.split(/[-\/]/);
    if (parts.length >= 3) {
      return (
        String(parseInt(parts[2])).padStart(2, "0") +
        "/" +
        String(parseInt(parts[1])).padStart(2, "0")
      );
    }
    return str.substring(0, 5);
  } catch (e) {
    return "-";
  }
}
// ==========================================
// EXPORT EXCEL UNTUK HALAMAN UTAMA
// ==========================================
function exportSalesToExcelMain(noper, namaPerk) {
  exportTableToExcelMain(
    "tableSalesDetail",
    "Sales_" + noper,
    decodeURIComponent(namaPerk),
  );
}

function exportTransToExcelMain(noper, namaPerk) {
  exportTableToExcelMain(
    "tableTransDetail",
    "Transaksi_" + noper,
    decodeURIComponent(namaPerk),
  );
}

function exportTableToExcelMain(tableId, fileName, title) {
  var table = document.getElementById(tableId);
  if (!table) return alert("Tabel tidak ditemukan!");

  var clone = table.cloneNode(true);
  var rows = clone.querySelectorAll("tr");

  rows.forEach(function (tr) {
    var cells = tr.querySelectorAll("td, th");
    cells.forEach(function (cell) {
      var teks = cell.textContent.trim();
      if (!teks || teks === "-") return;

      var angkaPolos = teks.replace(/[.,]/g, "").replace(/-/g, "");

      // ✅ Kondisi: hanya angka murni, noper/nama/tanggal dianggap sebagai text
      if (
        !isNaN(angkaPolos) &&
        angkaPolos !== "" &&
        angkaPolos.length > 0 &&
        angkaPolos.length <= 4 &&
        !/[a-zA-Z]/.test(teks)
      ) {
        // Angka pendek: 123, 4500, 100, 99
        cell.textContent = angkaPolos;
        cell.style.cssText += "mso-number-format:'#,##0';text-align:right;";
      } else {
        // Noper, nama, tanggal, persen, dll
        cell.textContent = "'" + teks + "'";
        cell.style.cssText += "mso-number-format:'\\\\@';";
      }
    });
  });

  var headerJudul =
    '<tr><td colspan="10" style="font-size:14px;font-weight:bold;text-align:center;">' +
    title +
    "</td></tr>";
  var tbody = clone.querySelector("tbody");
  if (tbody) tbody.insertAdjacentHTML("afterbegin", headerJudul);

  var wrapperHtml =
    '<html xmlns:o="urn:schemas-microsoft-com:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>' +
    clone.outerHTML +
    "</body></html>";
  var blob = new Blob([wrapperHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = fileName + ".xls";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 100);
}
