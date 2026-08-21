// ============================================
// RENDER UI LAPORAN SALES GABUNGAN
// ============================================
PANEL_MAP.lapsales = renderSalesGabungan;

function renderSalesGabungan() {
  if (typeof window._salesGabFilterMasa === "undefined") {
    var d = new Date();
    var bln = ("0" + (d.getMonth() + 1)).slice(-2);
    window._salesGabFilterMasa = bln + "-" + d.getFullYear();
  }

  var partMasa = window._salesGabFilterMasa.split("-");
  var filterBulan = partMasa[0];
  var filterTahunFull = partMasa[1];
  var inputMonthValue = filterTahunFull + "-" + filterBulan;

  // ==========================================
  // CEK LEVEL USER: PUSAT ATAU BUKAN?
  // ==========================================
  var userCabang = localStorage.getItem("cabang") || "";
  var isPusat =
    !userCabang || userCabang.toUpperCase() === "PUSAT" || userCabang === "00";

  var activeGroup = localStorage.getItem("activeGroup") || "TLGA";
  console.log(
    "🎨 [Sales Gabungan Render] Level User:",
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
      '<select id="filter_salesgab_group" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem; font-weight:bold;">';

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
    groupUiHtml =
      '<div style="font-size:.8rem; color:var(--muted);">Group: <span style="color:var(--accent); font-weight:bold;">' +
      esc(activeGroup) +
      "</span></div>";
  }

  // ==========================================
  // SIAPKAN DROPDOWN NOPER
  // ==========================================
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

  var noperOptionsHtml =
    '<option value="">ALL (Semua Noper)</option>' +
    '<option value="blank">Tanpa Noper (Blank)</option>';

  listNoperKhusus.forEach(function (item) {
    noperOptionsHtml +=
      '<option value="' +
      item.NOPER +
      '">' +
      item.NOPER +
      " (" +
      item.PENJELASAN +
      ")</option>";
  });

  var noperFilterHtml =
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Noper:</label>' +
    '<select id="filter_salesgab_noper" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    noperOptionsHtml +
    "</select></div>";

  // ==========================================
  // SIAPKAN DROPDOWN JENIS LAPORAN
  // ==========================================
  var jenisOptionsHtml =
    '<option value="noper">Per Noper</option>' +
    '<option value="menu">Per Menu (Detail)</option>' +
    '<option value="noper_dan_menu">Noper + Menu Tanpa Noper</option>';

  var jenisFilterHtml =
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Jenis:</label>' +
    '<select id="filter_salesgab_jenis" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    jenisOptionsHtml +
    "</select></div>";

  var htmlLaporan =
    '<div id="area_cetak_salesgab" style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd); width:100%; max-width:100%; box-sizing:border-box; display:block; overflow:visible;">' +
    '<div style="text-align:center; width:100%; max-width:100%; box-sizing:border-box;">' +
    '<h3 style="margin:0 0 .8rem 0; color:var(--fg);">Laporan Sales Rekap Gabungan (Semua Cabang)</h3>' +
    '<div class="no-print" style="background:var(--bg2); border:1px solid var(--brd); padding:12px; border-radius:6px; display:inline-flex; gap:12px; align-items:center; flex-wrap:wrap; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom:1rem; margin-left:auto; margin-right:auto;">' +
    groupUiHtml +
    noperFilterHtml +
    jenisFilterHtml +
    '<div style="display:flex; align-items:center; gap:5px;">' +
    '<label style="font-size:.75rem; color:var(--muted);">Masa:</label>' +
    '<input type="month" id="filter_salesgab_masa" value="' +
    inputMonthValue +
    '" style="padding:4px 8px; border-radius:4px; border:1px solid var(--brd); background:var(--card); color:var(--fg); font-size:.8rem;">' +
    "</div>" +
    '<button type="button" class="btn btn-g" style="font-size:.75rem; padding:4px 12px;" onclick="terapkanOpsiSalesGabungan()">Terapkan</button>' +
    '<button type="button" class="btn btn-b" style="font-size:.75rem; padding:4px 12px; background:#217346; border-color:#217346;" onclick="downloadSalesGabunganExcel()"><i class="fa-solid fa-file-excel"></i> Download Excel</button>' +
    '<button type="button" class="btn btn-s" style="font-size:.75rem; padding:4px 12px; background:#6f42c1; border-color:#6f42c1; color:#fff;" onclick="lihatGrafikSalesGabungan()"><i class="fa-solid fa-chart-bar"></i> Grafik</button>' +
    "</div>" +
    "</div>" +
    '<div id="tempat_tabel_salesgab" style="width:100%; display:block; text-align:left; box-sizing:border-box;"></div>' +
    '<p class="no-print" style="font-size:.8rem; color:var(--muted); margin-top:.5rem; margin-bottom:0;">Silakan klik tombol <b>Terapkan</b> untuk memuat data. <i>(Klik nama cabang untuk melihat detail per menu)</i></p>' +
    "</div>";

  return htmlLaporan;
}

// ============================================
// PROSES TERAPKAN OPSI SALES GABUNGAN
// ============================================
async function terapkanOpsiSalesGabungan() {
  var inputmasa = document.getElementById("filter_salesgab_masa");
  if (!inputmasa) return;

  var valmasa = inputmasa.value;
  if (!valmasa) {
    if (typeof toast === "function")
      toast("Silakan pilih masa terlebih dahulu", "err");
    return;
  }

  // ==========================================
  // 1. AMBIL SEMUA FILTER
  // ==========================================
  var groupDropdown = document.getElementById("filter_salesgab_group");
  var activeGroup = localStorage.getItem("activeGroup") || "TLGA";
  if (groupDropdown) {
    activeGroup = groupDropdown.value;
    localStorage.setItem("activeGroup", activeGroup);
  }

  var noperDropdown = document.getElementById("filter_salesgab_noper");
  var activeNoper = noperDropdown ? noperDropdown.value : "";

  var jenisDropdown = document.getElementById("filter_salesgab_jenis");
  var activeJenis = jenisDropdown ? jenisDropdown.value : "noper";

  console.log(
    "🟢 [Sales Gabungan Proses] Group:",
    activeGroup,
    "| Noper:",
    activeNoper,
    "| Jenis:",
    activeJenis,
  );

  closeModal();

  var part = valmasa.split("-");
  var filtertahunfull = part[0];
  var filterbulan = part[1];
  var duadigittahun = filtertahunfull.substring(2, 4);

  window._salesGabFilterMasa = filterbulan + "-" + filtertahunfull;
  var kodemasadicari = filterbulan + duadigittahun;

  var area = document.getElementById("tempat_tabel_salesgab");
  if (area) {
    area.innerHTML =
      '<div style="padding:3rem; text-align:center; color:var(--muted);"><span class="spinner"></span> 🔍 Memuat data sales gabungan cabang group: ' +
      esc(activeGroup) +
      "...</div>";
  }

  try {
    // ==========================================
    // 2. AMBIL MASTER CABANG
    // ==========================================
    console.log("📡 Mengambil data Master Cabang...");
    var rawMasterCab = await db.getAll("cabang");
    var mapMasterCab = {};
    var daftarCabang = [];

    if (rawMasterCab) {
      var arrMasterCab = Array.isArray(rawMasterCab)
        ? rawMasterCab
        : Object.values(rawMasterCab);
      arrMasterCab.forEach(function (c) {
        if ((!c.kode || !c.nama) && c.data) {
          try {
            c = Object.assign({}, c, JSON.parse(c.data));
          } catch (e) {}
        }
        var kode = String(c.kode_cabang || c.kode || c.cab || "").trim();
        var nama = String(c.nama_cabang || c.nama || c.cabang || "").trim();
        var cabGroup = String(c.group || "").trim();

        // Hanya ambil cabang yang sesuai Group-nya
        if (cabGroup === activeGroup && kode && nama) {
          mapMasterCab[kode] = nama;
          daftarCabang.push(kode);
        }
      });
    }
    daftarCabang.sort();
    console.log("✅ Cabang yang difilter:", daftarCabang.length, "cabang");

    // ==========================================
    // 3. AMBIL MASTER MENU (UNTUK REFERENSI NAMA/SATUAN)
    // ==========================================
    console.log("📡 Mengambil data Master Menu...");
    var rawMasterMenu = await db.getAll("daftarmenu");
    var mapMasterMenu = {};

    if (rawMasterMenu) {
      var arrMasterMenu = Array.isArray(rawMasterMenu)
        ? rawMasterMenu
        : Object.values(rawMasterMenu);
      arrMasterMenu.forEach(function (m) {
        if ((!m.kode || !m.nama) && m.data) {
          try {
            m = Object.assign({}, m, JSON.parse(m.data));
          } catch (e) {}
        }
        var kode = String(m.kode || m.kodemenu || m.KODE || "").trim();
        var nama = String(
          m.nama || m.namamenu || m.nama_menu || m.NAMAMENU || "",
        ).trim();
        var satuan = String(m.satuan || m.SATUAN || "").trim();
        var noper = String(m.noper || m.no_per || m.NOPER || "").trim();
        if (kode) {
          mapMasterMenu[kode] = { nama: nama, satuan: satuan, noper: noper };
        }
      });
    }

    // ==========================================
    // 4. AMBIL DATA SALES & PROSES
    // ==========================================
    console.log("📡 Mengambil data Sales...");
    var rawSales = await db.getAll("datasales");

    // Inisialisasi struktur data per cabang
    var dataByCabang = {};
    daftarCabang.forEach(function (cab) {
      dataByCabang[cab] = {};
    });

    if (rawSales) {
      var arrSales = Array.isArray(rawSales)
        ? rawSales
        : Object.values(rawSales);
      arrSales.forEach(function (s) {
        if ((!s.kode || !s.cabang) && s.data) {
          try {
            s = Object.assign({}, s, JSON.parse(s.data));
          } catch (e) {}
        }

        var cabang = String(s.cabang || "").trim();
        var masa = String(s.masa || s.ma || s.MA || "").trim();
        var group = String(s.group || "").trim();
        var noper = String(s.noper || s.no_per || s.NOPER || "").trim();
        var kodemenu = String(s.kodemenu || s.kode || s.KODE || "").trim();
        var namamenu = String(
          s.namamenu || s.namaMenu || s.nama_menu || s.NAMAMENU || "",
        ).trim();
        var satuan = String(s.satuan || s.SATUAN || "").trim();

        // Cek referensi master menu jika nama/satuan kosong
        if (mapMasterMenu[kodemenu]) {
          if (!namamenu) namamenu = mapMasterMenu[kodemenu].nama;
          if (!satuan) satuan = mapMasterMenu[kodemenu].satuan;
          if (!noper) noper = mapMasterMenu[kodemenu].noper;
        }

        var qty = +(s.qty || s.QTY || 0);
        var amount = +(s.amount || s.AMOUNT || s.total || 0);

        // Filter: hanya cabang yang ada di daftar
        if (!dataByCabang.hasOwnProperty(cabang)) return;
        // Filter: hanya group yang aktif
        if (group !== activeGroup) return;
        // Filter: hanya masa yang dipilih
        if (masa !== kodemasadicari) return;

        // Filter Noper
        if (activeNoper === "blank") {
          if (noper !== "" && noper !== "-") return;
        } else if (activeNoper !== "") {
          if (noper.toUpperCase() !== activeNoper.toUpperCase()) return;
        }

        // Tentukan key berdasarkan jenis laporan
        var hasNoper = noper && noper !== "" && noper !== "-";
        var key, displayName, satuanItem;

        if (activeJenis === "noper") {
          // Kelompokkan berdasarkan NOPER saja
          if (!hasNoper) return; // Skip yang tidak punya noper
          key = "NOPER:" + noper.toUpperCase();
          displayName = noper.toUpperCase();
          satuanItem = "-";
        } else if (activeJenis === "menu") {
          // Kelompokkan berdasarkan KODE MENU
          key = "MENU:" + kodemenu;
          displayName = namamenu || kodemenu;
          satuanItem = satuan || "-";
        } else {
          // NOPER + MENU (yang tanpa noper masuk ke menu)
          if (hasNoper) {
            key = "NOPER:" + noper.toUpperCase();
            displayName = noper.toUpperCase();
            satuanItem = "-";
          } else {
            key = "MENU:" + kodemenu;
            displayName = namamenu || kodemenu;
            satuanItem = satuan || "-";
          }
        }

        // Akumulasi data
        if (!dataByCabang[cabang][key]) {
          dataByCabang[cabang][key] = {
            qty: 0,
            amount: 0,
            name: displayName,
            satuan: satuanItem,
            type: key.startsWith("NOPER:") ? "noper" : "menu",
          };
        }
        dataByCabang[cabang][key].qty += qty;
        dataByCabang[cabang][key].amount += amount;
      });
    }

    // ==========================================
    // 5. KUMPULKAN KEY UNIK & HAPUS YANG TOTAL 0
    // ==========================================
    var setKeys = new Set();
    daftarCabang.forEach(function (cab) {
      Object.keys(dataByCabang[cab]).forEach(function (key) {
        setKeys.add(key);
      });
    });

    var arrKeys = Array.from(setKeys).sort();

    // Hapus baris yang total amount-nya 0 di semua cabang
    arrKeys = arrKeys.filter(function (key) {
      var totalAmount = 0;
      daftarCabang.forEach(function (cab) {
        totalAmount += (dataByCabang[cab][key] || {}).amount || 0;
      });
      return totalAmount !== 0;
    });

    // Pisahkan NOPER dan MENU untuk header
    var arrNoper = arrKeys.filter(function (k) {
      return k.startsWith("NOPER:");
    });
    var arrMenu = arrKeys.filter(function (k) {
      return k.startsWith("MENU:");
    });

    console.log(
      "✅ Selesai proses. Noper:",
      arrNoper.length,
      "| Menu:",
      arrMenu.length,
    );

    // ==========================================
    // 6. SIMPAN KE GLOBAL & RENDER
    // ==========================================
    window._salesGabunganData = {
      daftarCabang,
      arrNoper,
      arrMenu,
      dataByCabang,
      mapMasterCab,
      mapMasterMenu,
      activeGroup,
      activeNoper,
      activeJenis,
    };

    var outerArea = document.getElementById("area_cetak_salesgab");
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

    area.innerHTML = generateHTMLSalesGabungan(
      daftarCabang,
      arrNoper,
      arrMenu,
      dataByCabang,
      mapMasterCab,
      false,
      activeJenis,
    );
  } catch (error) {
    console.error("❌ Gagal total Sales Gabungan:", error);
    if (area) {
      area.innerHTML =
        '<div style="padding:3rem; text-align:center; color:darkred;">Error: ' +
        error.message +
        "</div>";
    }
  }
}

// ============================================
// GENERATE HTML TABLE SALES GABUNGAN
// ============================================
function generateHTMLSalesGabungan(
  daftarCabang,
  arrNoper,
  arrMenu,
  dataByCabang,
  mapMasterCab,
  isForExcel,
  activeJenis,
) {
  var html =
    '<div id="area_tabel_salesgab" style="width:100%; overflow-x:auto;">';

  // ==========================================
  // TABEL 1: REKAP NOPER (jika ada)
  // ==========================================
  if (arrNoper.length > 0) {
    html +=
      '<h4 style="margin:10px 0 5px 0; color:' +
      (isForExcel ? "#000" : "var(--fg)") +
      ';">📋 REKAP PER NOPER</h4>';
    html += buatTabelSalesGab(
      daftarCabang,
      arrNoper,
      dataByCabang,
      mapMasterCab,
      isForExcel,
      "amount",
      "NOPER",
    );
    html += buatTabelSalesGab(
      daftarCabang,
      arrNoper,
      dataByCabang,
      mapMasterCab,
      isForExcel,
      "qty",
      "NOPER (QTY)",
    );
  }

  // ==========================================
  // TABEL 2: REKAP MENU (jika ada)
  // ==========================================
  if (arrMenu.length > 0) {
    html +=
      '<h4 style="margin:20px 0 5px 0; color:' +
      (isForExcel ? "#000" : "var(--fg)") +
      ';">🍽️ REKAP PER MENU (Tanpa Noper)</h4>';
    html += buatTabelSalesGab(
      daftarCabang,
      arrMenu,
      dataByCabang,
      mapMasterCab,
      isForExcel,
      "amount",
      "MENU",
    );
    html += buatTabelSalesGab(
      daftarCabang,
      arrMenu,
      dataByCabang,
      mapMasterCab,
      isForExcel,
      "qty",
      "MENU (QTY)",
    );
  }

  html += "</div>";
  return html;
}

// ============================================
// BUAT TABEL SALES GABUNGAN (REUSABLE)
// ============================================
function buatTabelSalesGab(
  daftarCabang,
  arrKeys,
  dataByCabang,
  mapMasterCab,
  isForExcel,
  valueType,
  tableTitle,
) {
  var isAmount = valueType === "amount";
  var colSpan = daftarCabang.length + 3;

  var html =
    '<table border="1" style="width:100%; min-width:600px; border-collapse:collapse; text-align:left; color:#000; border:1px solid #000; margin-bottom:15px;">';

  // HEADER
  html += '<thead style="background:#f4f4f4; font-weight:bold;"><tr>';
  html +=
    '<th rowspan="2" style="padding:8px; border:1px solid #000; width:50px;">NO</th>';
  html +=
    '<th rowspan="2" style="padding:8px; border:1px solid #000; min-width:150px;">' +
    tableTitle +
    "</th>";

  daftarCabang.forEach(function (cab) {
    var namaTampil = mapMasterCab[cab] || cab;
    if (isForExcel) {
      html +=
        '<th style="padding:8px; border:1px solid #000; text-align:center; background-color:#d9e1f2;">' +
        namaTampil +
        "</th>";
    } else {
      html +=
        '<th style="padding:8px; border:1px solid #000; text-align:center; background-color:#1a1a2e;">' +
        '<span style="color:#00D2FF; text-decoration:underline; cursor:pointer; font-size:.75rem;" onclick="tampilkanDetailSalesCabang(\'' +
        cab.replace(/'/g, "\\'") +
        "')\">" +
        namaTampil +
        "</span></th>";
    }
  });

  html +=
    '<th rowspan="2" style="padding:8px; border:1px solid #000; text-align:center; background-color:#d9e1f2; color:#00D2FF; font-weight:bold; min-width:120px;">TOTAL</th>';
  html += "</tr><tr></tr></thead><tbody>";

  var grandTotal = 0;
  var no = 1;

  // ==========================================
  // BARIS DATA
  // ==========================================
  arrKeys.forEach(function (key) {
    var totalRow = 0;
    var itemInfo = null;

    // Ambil info dari cabang pertama yang punya data
    for (var i = 0; i < daftarCabang.length; i++) {
      if (dataByCabang[daftarCabang[i]][key]) {
        itemInfo = dataByCabang[daftarCabang[i]][key];
        break;
      }
    }

    var kode = key.replace("NOPER:", "").replace("MENU:", "");
    var nama = itemInfo ? itemInfo.name : "-";
    var satuan = itemInfo ? itemInfo.satuan : "";

    html += '<tr style="font-size:0.82rem;">';
    html +=
      '<td style="padding:5px 8px; border:1px solid #000; text-align:center;">' +
      no++ +
      "</td>";
    html +=
      '<td style="padding:5px 8px; border:1px solid #000;">' +
      esc(nama) +
      (satuan && satuan !== "-" && !isAmount
        ? ' <span style="font-size:.7rem;color:#666;">(' +
          esc(satuan) +
          ")</span>"
        : "") +
      "</td>";

    daftarCabang.forEach(function (cab) {
      var val = (dataByCabang[cab][key] || {})[valueType] || 0;
      totalRow += val;

      var xNum = isForExcel ? ' x:num="' + val + '"' : "";
      var colorStyle = isAmount && val < 0 ? "color:red;" : "";
      var displayVal = isAmount ? formatRupiah(val) : fmtN(val);

      html +=
        '<td style="padding:5px 8px; border:1px solid #000; text-align:right; ' +
        colorStyle +
        '"' +
        xNum +
        ">" +
        displayVal +
        "</td>";
    });

    grandTotal += totalRow;
    var xNumTotal = isForExcel ? ' x:num="' + totalRow + '"' : "";
    var colorTotal = isAmount && totalRow < 0 ? "color:red;" : "";
    var displayTotal = isAmount ? formatRupiah(totalRow) : fmtN(totalRow);

    html +=
      '<td style="padding:5px 8px; border:1px solid #000; text-align:right; font-weight:bold; ' +
      colorTotal +
      '"' +
      xNumTotal +
      ">" +
      displayTotal +
      "</td>";
    html += "</tr>";
  });

  // ==========================================
  // BARIS GRAND TOTAL
  // ==========================================
  html +=
    '<tr style="background:#e9ecef; font-weight:bold; font-size:.85rem;">';
  html +=
    '<td colspan="2" style="padding:8px; border:1px solid #000; text-align:right;">GRAND TOTAL ' +
    (isAmount ? "AMOUNT" : "QTY") +
    "</td>";

  daftarCabang.forEach(function (cab) {
    var cabTotal = 0;
    arrKeys.forEach(function (key) {
      cabTotal += (dataByCabang[cab][key] || {})[valueType] || 0;
    });
    var xNum = isForExcel ? ' x:num="' + cabTotal + '"' : "";
    var displayVal = isAmount ? formatRupiah(cabTotal) : fmtN(cabTotal);
    html +=
      '<td style="padding:8px; border:1px solid #000; text-align:right;' +
      xNum +
      '">' +
      displayVal +
      "</td>";
  });

  var xNumGrand = isForExcel ? ' x:num="' + grandTotal + '"' : "";
  var displayGrand = isAmount ? formatRupiah(grandTotal) : fmtN(grandTotal);
  html +=
    '<td style="padding:8px; border:1px solid #000; text-align:right; color:#00D2FF;' +
    xNumGrand +
    '">' +
    displayGrand +
    "</td>";
  html += "</tr>";

  html += "</tbody></table>";
  return html;
}

// ============================================
// DOWNLOAD EXCEL SALES GABUNGAN
// ============================================
async function downloadSalesGabunganExcel() {
  if (
    !window._salesGabunganData ||
    (window._salesGabunganData.arrNoper.length === 0 &&
      window._salesGabunganData.arrMenu.length === 0)
  ) {
    if (typeof toast === "function")
      toast("Tidak ada data Sales Gabungan untuk didownload", "err");
    return;
  }

  var d = window._salesGabunganData;
  var activeGroupLabel = d.activeGroup || "TLGA";
  var activeNoperLabel = d.activeNoper || "ALL";
  var activeJenisLabel =
    d.activeJenis === "noper"
      ? "Per Noper"
      : d.activeJenis === "menu"
        ? "Per Menu"
        : "Noper + Menu";

  var htmlContent = generateHTMLSalesGabungan(
    d.daftarCabang,
    d.arrNoper,
    d.arrMenu,
    d.dataByCabang,
    d.mapMasterCab,
    true,
    d.activeJenis,
  );

  var fullHtml =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    "<head><meta charset='UTF-8'>" +
    "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sales Gabungan</x:Name>" +
    "<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
    "</head><body>" +
    "<h2 style='text-align:center;'>LAPORAN SALES REKAP GABUNGAN</h2>" +
    "<h3 style='text-align:center;'>Group: " +
    activeGroupLabel +
    " | Jenis: " +
    activeJenisLabel +
    " | Noper: " +
    activeNoperLabel +
    " | Masa: " +
    (window._salesGabFilterMasa || "-") +
    "</h3>" +
    htmlContent +
    "</body></html>";

  var blob = new Blob([fullHtml], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "Laporan_Sales_Gabungan_" +
    activeGroupLabel +
    "_" +
    (window._salesGabFilterMasa || "Export") +
    ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof toast === "function")
    toast("File Excel Sales Gabungan sedang didownload...", "ok");
}

// ============================================
// LIHAT GRAFIK SALES GABUNGAN (Opsional)
// ============================================
function lihatGrafikSalesGabungan() {
  if (
    !window._salesGabunganData ||
    (window._salesGabunganData.arrNoper.length === 0 &&
      window._salesGabunganData.arrMenu.length === 0)
  ) {
    if (typeof toast === "function")
      toast("Silakan klik Terapkan terlebih dahulu", "err");
    return;
  }

  var d = window._salesGabunganData;
  var arrKeys = d.arrNoper.concat(d.arrMenu);
  var labels = [];
  var dataAmount = [];

  arrKeys.forEach(function (key) {
    var nama = "-";
    for (var i = 0; i < d.daftarCabang.length; i++) {
      if (d.dataByCabang[d.daftarCabang[i]][key]) {
        nama = d.dataByCabang[d.daftarCabang[i]][key].name;
        break;
      }
    }
    labels.push(nama);

    var total = 0;
    d.daftarCabang.forEach(function (cab) {
      total += (d.dataByCabang[cab][key] || {}).amount || 0;
    });
    dataAmount.push(total);
  });

  // Tampilkan grafik sederhana (menggunakan canvas atau alert sementara)
  var grafikHtml =
    '<div style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd);">' +
    "<h3>📊 Grafik Sales Gabungan</h3>" +
    "<div style='width:100%; height:400px;'><canvas id='chartSalesGab'></canvas></div>" +
    '<button type="button" class="btn btn-inf" onclick="navigate(currentPanel, true)">Tutup Grafik</button>' +
    "</div>";

  var area = document.getElementById("tempat_tabel_salesgab");
  if (area) area.innerHTML = grafikHtml;

  // Render chart jika Chart.js tersedia
  setTimeout(function () {
    var ctx = document.getElementById("chartSalesGab");
    if (ctx && typeof Chart !== "undefined") {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Total Amount",
              data: dataAmount,
              backgroundColor: "rgba(0, 210, 255, 0.6)",
              borderColor: "#00D2FF",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true },
          },
        },
      });
    } else if (ctx) {
      // Fallback: tampilkan teks jika Chart.js tidak ada
      var textData = labels
        .map(function (l, i) {
          return l + ": " + formatRupiah(dataAmount[i]);
        })
        .join("\n");
      ctx.parentElement.innerHTML =
        '<pre style="text-align:left; padding:1rem; background:#f5f5f5; border-radius:8px; overflow:auto; max-height:400px;">' +
        textData +
        "</pre>";
    }
  }, 100);
}

// ============================================
// DETAIL SALES PER CABANG (KLIK NAMA CABANG)
// ============================================
function tampilkanDetailSalesCabang(kodeCabang) {
  if (!window._salesGabunganData) return;

  var d = window._salesGabunganData;
  var namaCabang = d.mapMasterCab[kodeCabang] || kodeCabang;
  var dataCab = d.dataByCabang[kodeCabang] || {};
  var arrKeys = d.arrNoper.concat(d.arrMenu);

  var html =
    '<div style="background:var(--card); padding:1rem; border-radius:var(--r); border:1px solid var(--brd);">' +
    "<h3>📋 Detail Sales Cabang: " +
    esc(namaCabang) +
    "</h3>" +
    "<p style='color:var(--muted); font-size:.8rem;'>Masa: " +
    (window._salesGabFilterMasa || "-") +
    " | Group: " +
    (d.activeGroup || "-") +
    "</p>" +
    '<table border="1" style="width:100%; border-collapse:collapse; margin-top:1rem;">' +
    "<thead style='background:#f4f4f4;'><tr>" +
    "<th style='padding:8px; border:1px solid #000;'>Noper / Menu</th>" +
    "<th style='padding:8px; border:1px solid #000; text-align:right;'>QTY</th>" +
    "<th style='padding:8px; border:1px solid #000; text-align:right;'>Amount</th>" +
    "</tr></thead><tbody>";

  var totalQty = 0,
    totalAmount = 0;

  arrKeys.forEach(function (key) {
    var item = dataCab[key];
    if (!item) return;
    totalQty += item.qty;
    totalAmount += item.amount;
    html +=
      "<tr><td style='padding:6px 8px; border:1px solid #000;'>" +
      esc(item.name) +
      "</td>" +
      "<td style='padding:6px 8px; border:1px solid #000; text-align:right;'>" +
      fmtN(item.qty) +
      "</td>" +
      "<td style='padding:6px 8px; border:1px solid #000; text-align:right;'>" +
      formatRupiah(item.amount) +
      "</td></tr>";
  });

  html +=
    "<tr style='background:#e9ecef; font-weight:bold;'><td style='padding:8px; border:1px solid #000; text-align:right;'>TOTAL</td>" +
    "<td style='padding:8px; border:1px solid #000; text-align:right;'>" +
    fmtN(totalQty) +
    "</td>" +
    "<td style='padding:8px; border:1px solid #000; text-align:right; color:#00D2FF;'>" +
    formatRupiah(totalAmount) +
    "</td></tr>";

  html +=
    "</tbody></table>" +
    '<button type="button" class="btn btn-inf" style="margin-top:1rem;" onclick="terapkanOpsiSalesGabungan()">← Kembali ke Gabungan</button>' +
    "</div>";

  var area = document.getElementById("tempat_tabel_salesgab");
  if (area) area.innerHTML = html;
}
