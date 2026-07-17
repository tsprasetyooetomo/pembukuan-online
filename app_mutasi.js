/* ================================================================
   app_mutasi.js — MUTASI TRANSAKSI + PRINT
   ================================================================ */

/* globals getCabangOpts, lookupCabangLabel, uid, esc, fmtN, num, 
   openModal, closeModal, showConfirm, toast, buildTable, 
   refreshCache, DBCache, db */

PANEL_MAP.mutasi = renderMutasi;
AFTER_RENDER.mutasi = initMutasiState;

/* ---------- State ---------- */
var _mutSession = { noreff: "", isLocked: false };

var _mutHandlers = {
  cab: null,
  kb: null,
  tgl: null,
  bulan: null,
  tahun: null,
  filterCabList: null, // ✅ DARI FILE BARU
};

/* ================================================================
   GENERATOR OPTIONS
   ================================================================ */

function generateKbOpts(cabang, selectedKb) {
  var opts = '<option value="">-- Pilih --</option>';
  var list = Array.isArray(DBCache.kodeBank) ? DBCache.kodeBank : [];

  var filtered = list.filter(function (kb) {
    return (
      String(kb.cabang || "").toLowerCase() ===
      String(cabang || "").toLowerCase()
    );
  });

  if (filtered.length === 0 && list.length > 0) filtered = list;

  for (var i = 0; i < filtered.length; i++) {
    var kb = filtered[i];
    var val = kb.kodebank || "";
    var label = val + " — " + (kb.penjelasan || "");
    var sel = val === (selectedKb || "") ? " selected" : "";
    opts +=
      '<option value="' + esc(val) + '"' + sel + ">" + esc(label) + "</option>";
  }

  if (filtered.length === 0)
    opts = '<option value="">Tidak ada Kode Bank</option>';
  return opts;
}

function generatePerkOpts(cabangKode, selectedNoper) {
  var data = Array.isArray(DBCache.perkiraan) ? DBCache.perkiraan : [];

  var filtered = data.filter(function (p) {
    return (
      String(p.cabang || "")
        .trim()
        .toLowerCase() ===
      String(cabangKode || "")
        .trim()
        .toLowerCase()
    );
  });

  if (filtered.length === 0 && data.length > 0) filtered = data;

  filtered.sort(function (a, b) {
    return (parseInt(a.noPerk) || 0) - (parseInt(b.noPerk) || 0);
  });

  var opts = filtered
    .map(function (p) {
      var sel = p.noPerk === selectedNoper ? " selected" : "";
      return (
        '<option value="' +
        esc(p.noPerk) +
        '"' +
        sel +
        ">" +
        esc(p.noPerk) +
        " — " +
        esc(p.desc || "") +
        "</option>"
      );
    })
    .join("");

  return '<option value="">-- Pilih No Perkiraan --</option>' + opts;
}

function generateBulanOpts(selectedBulan) {
  var now = new Date();
  var defaultBulan = selectedBulan || String(now.getMonth() + 1);

  var opts = '<option value="">-- Bulan --</option>';
  for (var m = 1; m <= 12; m++) {
    var val = String(m);
    var sel = val === defaultBulan ? " selected" : "";
    opts += '<option value="' + val + '"' + sel + ">" + val + "</option>";
  }
  return opts;
}

function generateTahunOpts(selectedTahun) {
  var now = new Date();
  var tahunSekarang = now.getFullYear();
  var defaultTahun = selectedTahun || String(tahunSekarang);

  var opts = '<option value="">-- Tahun --</option>';
  for (var y = 2016; y <= tahunSekarang; y++) {
    var sel = String(y) === defaultTahun ? " selected" : "";
    opts += '<option value="' + y + '"' + sel + ">" + y + "</option>";
  }
  return opts;
}

function populateKodeBankOpts(cabangKode) {
  var el = $("m_kb");
  if (!el) return;
  el.innerHTML = generateKbOpts(cabangKode, el.value);
}

function populatePerkiraanOpts(cabangKode) {
  var el = $("d_perk");
  if (!el) return;
  el.innerHTML = generatePerkOpts(cabangKode, el.value);
}

function generateNoreff(kodeBank, tanggal, cabangKode) {
  if (!kodeBank || !tanggal) return "";

  var cab = cabangKode || "Pusat";

  // ✅ DARI FILE BARU: 1. Standarisasi format Kode Bank (harus tepat 4 karakter)
  var kb = kodeBank.padEnd(4, " ").substring(0, 4);

  // ✅ DARI FILE BARU: 2. Olah data Tanggal untuk mendapatkan Bulan dan Tahun (Format: MMTT)
  var dt = new Date(tanggal);
  var bln = String(dt.getMonth() + 1).padStart(2, "0");
  var thn = String(dt.getFullYear()).substring(2);
  var blnThnTarget = bln + thn;

  // ✅ DARI FILE BARU: 3. Bangun Prefix untuk Transaksi Baru
  var currentPrefix = kb + blnThnTarget;

  var nextUrut = 1;

  // ✅ DARI FILE BARU: 4. AMBIL DATA TRANSAKSI DI BULAN DAN CABANG YANG SAMA
  var dataRaw = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  var activeList = dataRaw.filter(function (t) {
    if (!t.noreff || !t.tanggal) return false;

    if (String(t.cabang || "Pusat") !== String(cab)) return false;

    var dataBln = t.tanggal.substring(5, 7);
    var dataThn = t.tanggal.substring(0, 4);
    if (dataBln !== bln || dataThn !== String(dt.getFullYear())) return false;

    return true;
  });

  // ✅ DARI FILE BARU: 5. FIX SORTING: URUTKAN MURNI BERDASARKAN 4 DIGIT ANGKA PALING KANAN
  activeList.sort(function (a, b) {
    var numA =
      parseInt((a.noreff || "").substring((a.noreff || "").length - 4), 10) ||
      0;
    var numB =
      parseInt((b.noreff || "").substring((b.noreff || "").length - 4), 10) ||
      0;
    return numA - numB;
  });

  // ✅ DARI FILE BARU: 6. AMBIL BARIS PALING AKHIR (ANGKA TERBESAR DI LIST)
  if (activeList.length > 0) {
    var notaTerakhir = activeList[activeList.length - 1];
    var lastNoreff = notaTerakhir.noreff || "";

    if (lastNoreff.length >= 4) {
      var lastUrutStr = lastNoreff.substring(lastNoreff.length - 4);
      var lastUrutByte = parseInt(lastUrutStr, 10) || 0;

      nextUrut = lastUrutByte + 1;
    }
  }

  // ✅ DARI FILE BARU: 7. Kembalikan Nomor Referensi Baru
  return currentPrefix + String(nextUrut).padStart(4, "0");
}

function renderMutasi() {
  var today = new Date().toISOString().split("T")[0];

  var firstCab = "";
  if (DBCache.cabang && DBCache.cabang.length > 0) {
    firstCab = DBCache.cabang[0].kode || DBCache.cabang[0].nama || "Pusat";
  }

  var kbOpts = generateKbOpts(firstCab, "");
  var perkOpts = generatePerkOpts(firstCab, "");
  var bulanOpts = generateBulanOpts("");
  var tahunOpts = generateTahunOpts("");

  // ✅ DARI FILE BARU: Generate Opsi Cabang (Sort by Kode + Tampil Nama)
  var cabFilterOpts = '<option value="">-- Semua Cabang --</option>';

  if (DBCache.cabang && Array.isArray(DBCache.cabang)) {
    var sortedList = [...DBCache.cabang];

    sortedList.sort(function (a, b) {
      var ka = String(a.kode || "");
      var kb = String(b.kode || "");
      return ka.localeCompare(kb);
    });

    sortedList.forEach(function (c) {
      var kode = c.kode || "";
      var nama = c.nama || "";
      var label = kode + (nama ? " — " + nama : "");

      cabFilterOpts +=
        '<option value="' + esc(kode) + '">' + esc(label) + "</option>";
    });
  }
  return (
    "<style>" +
    ".pnl.active { display: block !important; height: auto !important; overflow: visible !important; }" +
    "#mutDetilTbl { max-height: 500px !important; overflow-y: auto !important; border: 1px solid var(--brd); border-radius: 6px; }" +
    "#mutDetilTbl thead th { position: sticky; top: 0; background: var(--bg2); z-index: 5; }" +
    "#mutNoreffList { max-height: 300px !important; overflow-y: auto !important; }" +
    "</style>" +
    '<div style="padding:.8rem;background:var(--bg2);border:1px solid var(--brd);border-radius:10px;margin-bottom:1rem">' +
    /* BARIS JUDUL UTAMA */
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">' +
    '<div style="font-size:.8rem;font-weight:700;color:var(--accent)">' +
    '<i class="fa-solid fa-file-circle-plus"></i> Header Transaksi' +
    "</div>" +
    '<div style="display:flex;align-items:center;gap:.5rem">' +
    '<div style="font-size:.75rem;font-weight:700;color:var(--accent)">' +
    '<i class="fa-solid fa-clock-rotate-left"></i> Riwayat' +
    "</div>" +
    '<button type="button" class="btn btn-sm" style="font-size:.65rem;padding:2px 6px" onclick="resetToNewTransaction()">' +
    '<i class="fa-solid fa-plus"></i> Baru' +
    "</button>" +
    "</div>" +
    "</div>" +
    /* BARIS ISI (AWAL FLEXBOX) */
    '<div style="display:flex;gap:1rem">' +
    /* KOLOM KIRI */
    '<div style="flex:3">' +
    '<div style="display:flex;gap:.5rem;margin-bottom:.5rem">' +
    '<div class="fg" style="flex:1"><label>Cabang</label><select id="m_cab" class="in">' +
    getCabangOpts(firstCab) +
    "</select></div>" +
    '<div class="fg" style="flex:1"><label>Kode Bank</label><select id="m_kb" class="in">' +
    kbOpts +
    "</select></div>" +
    '<div class="fg" style="flex:1"><label>Tanggal</label><input id="m_tgl" type="date" class="in" value="' +
    esc(today) +
    '"></div>' +
    '<div class="fg" style="flex:1"><label>No Ref</label><input id="m_noref" class="in" readonly style="background:var(--bg);opacity:.8"></div>' +
    "</div>" +
    '<div style="display:flex;gap:.5rem;margin-bottom:.5rem">' +
    '<div class="fg" style="flex:2"><label>Dari / Kepada <span class="req">*</span></label><input id="m_dkp" class="in" placeholder="Nama pihak terkait"></div>' +
    '<div class="fg" style="flex:1"><label>Nominal / Rp</label><input id="m_nominal" class="in" readonly style="background:var(--bg);font-weight:700;color:var(--success)" value="0"></div>' +
    "</div>" +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'transaksi\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllDataMutasi(\'transaksi\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    /* FORM DETIL */
    '<div style="margin-top:.8rem;padding-top:.8rem;border-top:1px dashed var(--brd)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">' +
    '<div style="font-size:.8rem;font-weight:700;color:var(--info)"><i class="fa-solid fa-list-ol"></i> Tambah Detil Jurnal</div>' +
    '<button type="button" class="btn btn-sm" style="background:var(--info);color:#fff;font-size:.7rem;padding:3px 10px" onclick="printMutasi()"><i class="fa-solid fa-print"></i> Print</button>' +
    "</div>" +
    '<div style="display:flex;gap:.5rem;align-items:flex-end">' +
    '<div class="fg" style="flex:2;margin-bottom:0"><label>No Perkiraan <span class="req">*</span></label><select id="d_perk" class="in">' +
    perkOpts +
    "</select></div>" +
    '<div class="fg" style="flex:3;margin-bottom:0"><label>Penjelasan <span class="req">*</span></label><input id="d_penjelasan" class="in" placeholder="Keterangan transaksi"></div>' +
    '<div class="fg" style="flex:1;margin-bottom:0"><label>Rp <span class="req">*</span></label><input type="number" id="d_rp" class="in" placeholder="0"></div>' +
    '<button class="btn btn-a" onclick="SafeaddDetil()" style="margin-bottom:2px"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div>" +
    "</div>" +
    "</div>" /* TUTUP KOLOM KIRI */ +
    /* KOLOM KANAN */
    '<div style="flex:1;border-left:1px solid var(--brd);padding-left:.8rem;display:flex;flex-direction:column;box-sizing:border-box">' +
    '<div style="margin-bottom:.4rem">' +
    '<div class="fg" style="margin-bottom:0"><label style="font-size:.65rem">Filter Cabang List</label><select id="filter_cabang_list" class="in" style="font-size:.75rem">' +
    cabFilterOpts +
    "</select></div>" +
    "</div>" +
    '<div style="display:flex;gap:.4rem;margin-bottom:.4rem">' +
    '<div class="fg" style="flex:1;margin-bottom:0"><label style="font-size:.65rem">Bulan</label><select id="filter_bulan" class="in" style="font-size:.75rem;padding:3px 5px">' +
    bulanOpts +
    "</select></div>" +
    '<div class="fg" style="flex:1;margin-bottom:0"><label style="font-size:.65rem">Tahun</label><select id="filter_tahun" class="in" style="font-size:.75rem;padding:3px 5px">' +
    tahunOpts +
    "</select></div>" +
    "</div>" +
    '<div id="mutNoreffList" style="height:180px;overflow-y:auto;font-size:.8rem;background:var(--bg);border:1px solid var(--brd);border-radius:6px">' +
    '<div style="padding:1rem;color:var(--muted);text-align:center">Memuat data...</div>' +
    "</div>" +
    '<div id="mutNoreffCount" style="font-size:.65rem;color:var(--muted);margin-top:.3rem;text-align:right"></div>' +
    "</div>" /* TUTUP KOLOM KANAN */ +
    "</div>" /* 💡 KUNCI PERBAIKAN: Menutup 'baris isi' agar tabel detail tidak masuk layout flexbox kesamping */ +
    /* TABEL DETIL (SEKARANG SUDAH DI BAWAH) */
    "<style>" +
    "#mutDetilTbl { display: block !important; width: 100% !important; max-height: 450px !important; overflow-y: auto !important; border: 1px solid var(--brd); border-radius: 6px; }" +
    "#mutDetilTbl th { position: sticky !important; top: 0 !important; background: var(--bg2) !important; z-index: 2; }" +
    "</style>" +
    '<div style="font-size:.85rem;font-weight:700;margin-top:1rem;margin-bottom:.4rem">Riwayat Detil Transaksi</div>' +
    '<div id="mutDetilTbl" class="tw"></div>' +
    "</div>" /* TUTUP UTAMA CONTAINER */
  );
}

function initMutasiState() {
  _mutSession = { noreff: "", isLocked: false };

  var cabEl = $("m_cab");
  var kbEl = $("m_kb");
  var tglEl = $("m_tgl");
  var bulanEl = $("filter_bulan");
  var tahunEl = $("filter_tahun");
  var filterCabListEl = $("filter_cabang_list"); // ✅ DARI FILE BARU

  if (!cabEl) return;

  if (_mutHandlers.cab) cabEl.removeEventListener("change", _mutHandlers.cab);
  if (_mutHandlers.kb) kbEl.removeEventListener("change", _mutHandlers.kb);
  if (_mutHandlers.tgl) tglEl.removeEventListener("change", _mutHandlers.tgl);
  if (_mutHandlers.bulan)
    bulanEl.removeEventListener("change", _mutHandlers.bulan);
  if (_mutHandlers.tahun)
    tahunEl.removeEventListener("change", _mutHandlers.tahun);
  // ✅ DARI FILE BARU: Cleanup event listener filter cabang
  if (_mutHandlers.filterCabList && filterCabListEl)
    filterCabListEl.removeEventListener("change", _mutHandlers.filterCabList);

  _mutHandlers.cab = onCabangChange;
  _mutHandlers.kb = onKbChange;
  _mutHandlers.tgl = onHeaderChange;
  _mutHandlers.bulan = onFilterChange;
  _mutHandlers.tahun = onFilterChange;
  _mutHandlers.filterCabList = renderNoreffList; // ✅ DARI FILE BARU

  cabEl.addEventListener("change", _mutHandlers.cab);
  kbEl.addEventListener("change", _mutHandlers.kb);
  tglEl.addEventListener("change", _mutHandlers.tgl);
  bulanEl.addEventListener("change", _mutHandlers.bulan);
  tahunEl.addEventListener("change", _mutHandlers.tahun);

  // ✅ DARI FILE BARU: Pasang event listener baru
  if (filterCabListEl)
    filterCabListEl.addEventListener("change", _mutHandlers.filterCabList);

  ["d_penjelasan", "d_rp"].forEach(function (id) {
    var el = $(id);
    if (el)
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          SafeaddDetil();
        }
      });
  });

  onHeaderChange();
  renderDetilTable();
  renderNoreffList();
  updateMutasiSummary();
  // ✅ Tambahin ini biar bisa scroll
  setTimeout(() => {
    document.body.style.overflowY = "auto";
    document.documentElement.style.overflowY = "auto";
    const pnl = document.querySelector(".pnl.active");
    if (pnl) pnl.style.overflowY = "auto";
  }, 100);
}

function onCabangChange() {
  var cab = $("m_cab").value;
  populateKodeBankOpts(cab);
  populatePerkiraanOpts(cab);

  _mutSession = { noreff: "", isLocked: false };
  $("m_kb").disabled = false;
  $("m_tgl").disabled = false;
  $("m_cab").disabled = false;
  $("m_noref").value = "";
  $("m_nominal").value = "0";

  renderDetilTable();
  renderNoreffList();
  updateMutasiSummary();
}

function onKbChange() {
  if (_mutSession.isLocked) {
    toast("Header terkunci karena sudah ada detil.", "wrn");
    return;
  }
  onHeaderChange();
}

function onHeaderChange() {
  if (_mutSession.isLocked) return;

  var kb = $("m_kb").value;
  var tgl = $("m_tgl").value;
  var cab = $("m_cab").value;

  var newNoref = generateNoreff(kb, tgl, cab);
  $("m_noref").value = newNoref;
  _mutSession.noreff = newNoref;

  updateMutasiSummary();
}

function onFilterChange() {
  renderNoreffList();
}

function _mutUnlockHeader() {
  _mutSession.isLocked = false;
  try {
    if ($("m_cab")) $("m_cab").disabled = false;
  } catch (e) {}
  try {
    if ($("m_kb")) $("m_kb").disabled = false;
  } catch (e) {}
  try {
    if ($("m_tgl")) $("m_tgl").disabled = false;
  } catch (e) {}
}

function editDetil(id) {
  var d = DBCache.transaksi.find(function (t) {
    return t.id === id;
  });
  if (!d) return;

  var activeCab = $("m_cab").value;
  var perkOpts = generatePerkOpts(activeCab, d.noperkiraan);

  openModal(
    "Edit Detil Jurnal",
    '<div class="fg"><label>No Perkiraan</label><select id="ed_perk">' +
      perkOpts +
      "</select></div>" +
      '<div class="fg"><label>Penjelasan</label><input id="ed_penjelasan" value="' +
      esc(d.desc) +
      '"></div>' +
      '<div class="fg"><label>Rp</label><input type="number" id="ed_rp" value="' +
      d.total +
      '"></div>',
    '<button class="btn btn-g" onclick="closeModal()">Batal</button>' +
      '<button class="btn btn-a" onclick="event.preventDefault(); event.stopPropagation();saveEditDetil(\'' +
      id +
      "')\">Update</button>",
  );
}

function updateMutasiSummary() {
  var noreff = _mutSession.noreff;
  if (!noreff) return;

  var totalDb = 0,
    totalCr = 0;
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  transaksi.forEach(function (t) {
    if (t.noreff === noreff) {
      totalDb += num(t.db) || 0;
      totalCr += num(t.cr) || 0;
    }
  });
}

function resetToNewTransaction() {
  _mutSession = { noreff: "", isLocked: false };

  $("m_cab").disabled = false;
  $("m_kb").disabled = false;
  $("m_tgl").disabled = false;

  $("m_noref").value = "";
  $("m_dkp").value = "";
  $("m_nominal").value = "0";

  onHeaderChange();
  renderDetilTable();
  renderNoreffList();
  updateMutasiSummary();
}

function terbilang(n) {
  if (!n || n === 0) return "Nol";

  var angka = Math.abs(Math.floor(n));
  var satuan = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];
  var hasil = "";

  if (angka < 12) {
    hasil = satuan[angka];
  } else if (angka < 20) {
    hasil = satuan[angka - 10] + " Belas";
  } else if (angka < 100) {
    hasil =
      terbilang(Math.floor(angka / 10)) +
      " Puluh" +
      (angka % 10 ? " " + satuan[angka % 10] : "");
  } else if (angka < 200) {
    hasil = "Seratus" + (angka % 100 ? " " + terbilang(angka % 100) : "");
  } else if (angka < 1000) {
    hasil =
      terbilang(Math.floor(angka / 100)) +
      " Ratus" +
      (angka % 100 ? " " + terbilang(angka % 100) : "");
  } else if (angka < 2000) {
    hasil = "Seribu" + (angka % 1000 ? " " + terbilang(angka % 1000) : "");
  } else if (angka < 1000000) {
    hasil =
      terbilang(Math.floor(angka / 1000)) +
      " Ribu" +
      (angka % 1000 ? " " + terbilang(angka % 1000) : "");
  } else if (angka < 1000000000) {
    hasil =
      terbilang(Math.floor(angka / 1000000)) +
      " Juta" +
      (angka % 1000000 ? " " + terbilang(angka % 1000000) : "");
  } else if (angka < 1000000000000) {
    hasil =
      terbilang(Math.floor(angka / 1000000000)) +
      " Miliar" +
      (angka % 1000000000 ? " " + terbilang(angka % 1000000000) : "");
  }

  return n < 0 ? "Minus " + hasil : hasil;
}

function showConfirm1(message, onYes) {
  var footerHtml =
    '<button class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button class="btn btn-r" id="btnConfirmAction">Ya, Lanjutkan</button>';

  openModal(
    "Konfirmasi",
    '<div style="font-size:0.9rem">' + esc(message) + "</div>",
    footerHtml,
  );

  setTimeout(function () {
    var btnYes = document.getElementById("btnConfirmAction");
    if (btnYes) {
      btnYes.onclick = function () {
        closeModal();
        if (typeof onYes === "function") {
          onYes();
        }
      };
    }
  }, 50);
}

// ✅ DARI FILE BARU: FUNGSI LENGKAP clearAllDataMutasi (DENGAN FILTER MODAL & BATCH)
async function clearAllDataMutasi(storeName) {
  var labelMap = {
    transaksi: "Transaksi",
  };
  var label = labelMap[storeName] || storeName;

  var tahunSekarang = new Date().getFullYear();
  var opsiTahunHtml = "";
  for (var i = 0; i < 3; i++) {
    var thn = tahunSekarang - i;
    opsiTahunHtml += `<option value="${thn}">${thn}</option>`;
  }

  var daftarBulan = [
    { v: "01", n: "Januari" },
    { v: "02", n: "Februari" },
    { v: "03", n: "Maret" },
    { v: "04", n: "April" },
    { v: "05", n: "Mei" },
    { v: "06", n: "Juni" },
    { v: "07", n: "Juli" },
    { v: "08", n: "Agustus" },
    { v: "09", n: "September" },
    { v: "10", n: "Oktober" },
    { v: "11", n: "November" },
    { v: "12", n: "Desember" },
  ];
  var opsiBulanHtml = daftarBulan
    .map(function (b) {
      return `<option value="${b.v}">${b.n}</option>`;
    })
    .join("");

  var cabFilterOpts = '<option value="">-- Semua Cabang --</option>';
  if (DBCache.cabang && Array.isArray(DBCache.cabang)) {
    var sortedList = [...DBCache.cabang];
    sortedList.sort(function (a, b) {
      return String(a.kode || "").localeCompare(String(b.kode || ""));
    });
    cabFilterOpts += sortedList
      .map(function (c) {
        var displayNama = c.nama ? ` (${c.nama})` : "";
        return `<option value="${c.kode}">${c.kode}${displayNama}</option>`;
      })
      .join("");
  }

  openModal(
    "Filter Hapus Data " + label,
    `<div class="confirm-box" style="padding: .5rem">
      <div style="margin-bottom: 1rem; font-size: .85rem; color: var(--muted)">
        Silakan pilih kriteria data mutasi yang ingin dihapus secara permanen.
      </div>
      
      <div style="display: flex; flex-direction: column; gap: .8rem; margin-bottom: 1.5rem">
        <div>
          <label style="display:block; font-size:.8rem; margin-bottom:.3rem; font-weight:bold">Bulan</label>
          <select id="del_bulan" style="width:100%; padding:.5rem; border-radius:6px; border:1px solid var(--brd); background:var(--bg2); color:inherit">
            <option value="">-- Semua Bulan --</option>
            ${opsiBulanHtml}
          </select>
        </div>
        
        <div>
          <label style="display:block; font-size:.8rem; margin-bottom:.3rem; font-weight:bold">Tahun</label>
          <select id="del_tahun" style="width:100%; padding:.5rem; border-radius:6px; border:1px solid var(--brd); background:var(--bg2); color:inherit">
            <option value="">-- Semua Tahun --</option>
            ${opsiTahunHtml}
          </select>
        </div>
        
        <div>
          <label style="display:block; font-size:.8rem; margin-bottom:.3rem; font-weight:bold">Kode Cabang</label>
          <select id="del_cabang" style="width:100%; padding:.5rem; border-radius:6px; border:1px solid var(--brd); background:var(--bg2); color:inherit">
            ${cabFilterOpts}
          </select>
        </div>
      </div>

      <div class="cb-btns" style="display:flex; justify-content:flex-end; gap:.5rem">
        <button class="btn btn-g" onclick="closeModal()">Batal</button>
        <button class="btn btn-r" id="btnKonfirmasiHapus"><i class="fa-solid fa-trash-can"></i> Hapus Data</button>
      </div>
    </div>`,
  );

  document.getElementById("btnKonfirmasiHapus").onclick = async function () {
    var bln = document.getElementById("del_bulan").value;
    var thn = document.getElementById("del_tahun").value;
    var cbg = document.getElementById("del_cabang").value;

    var infoFilter = `\nBulan: ${bln || "Semua"}\nTahun: ${thn || "Semua"}\nCabang: ${cbg || "Semua"}`;

    if (
      !confirm(
        "PERINGATAN!\n\nData " +
          label +
          " dengan kriteria berikut akan dihapus secara permanen:" +
          infoFilter +
          "\n\nLanjutkan?",
      )
    ) {
      return;
    }

    closeModal();

    try {
      var allData = await db.getAll(storeName);

      var dataDipertahankan = [];
      var dataDihapusCount = 0;

      for (var item of allData) {
        var cocokBulan = !bln || item.bulan == bln;
        var cocokTahun = !thn || item.tahun == thn;
        var cocokCabang = !cbg || item.kodeCabang == cbg;

        if (cocokBulan && cocokTahun && cocokCabang) {
          dataDihapusCount++;
        } else {
          dataDipertahankan.push(item);
        }
      }

      await db.clear(storeName);

      if (dataDipertahankan.length > 0) {
        if (typeof db.batch === "function") {
          await db.batch(storeName, dataDipertahankan);
        } else if (
          db[storeName] &&
          typeof db[storeName].bulkPut === "function"
        ) {
          await db[storeName].bulkPut(dataDipertahankan);
        } else {
          for (var dataAman of dataDipertahankan) {
            await db.put(storeName, dataAman);
          }
        }
      }

      if (DBCache[storeName]) {
        DBCache[storeName] = dataDipertahankan;
      }

      toast(`${dataDihapusCount} data ${label} berhasil dihapus`, "ok");
      safeRenderCurrentPanel();
    } catch (err) {
      toast("Gagal memproses penghapusan data: " + err.message, "err");
    }
  };
}

async function SafeaddDetil() {
  var noreff = _mutSession.noreff || $("m_noref").value;
  if (!noreff)
    return toast("Isi Kode Bank & Tanggal di header terlebih dahulu", "err");

  var noper = $("d_perk").value;
  var penjelasan = $("d_penjelasan").value.trim();
  var rp = num($("d_rp").value);

  if (!noper || !penjelasan || rp <= 0)
    return toast("No Perkiraan, Penjelasan, dan Rp wajib diisi!", "err");

  // ✅ AMBIL NILAI GROUP DARI LOCALSTORAGE
  var activeGroup = localStorage.getItem("group") || "TLGA";

  _mutSession.isLocked = true;
  $("m_cab").disabled = true;
  $("m_kb").disabled = true;
  $("m_tgl").disabled = true;

  try {
    var newDetil = {
      id: uid(),
      noreff: noreff,
      tanggal: $("m_tgl").value,
      kodeBank: $("m_kb").value,
      cabang: $("m_cab").value,
      dariKePada: $("m_dkp").value.trim(),
      noperkiraan: noper,
      desc: penjelasan,
      total: rp,
      db: rp,
      cr: 0,
      kodeTrans: "",
      group: activeGroup, // ✅ GROUP DIMASUKKAN
    };

    // ✅ GANTI db.add DENGAN fetch KE SUPABASE
    await fetch(window.location.origin + "/api/data/transaksi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDetil),
    });

    if (!DBCache.transaksi) DBCache.transaksi = [];
    DBCache.transaksi.push(newDetil);

    $("d_perk").value = "";
    $("d_penjelasan").value = "";
    $("d_rp").value = "";
    $("d_penjelasan").focus();
    renderDetilTable();
    updateHeaderNominal();
    renderNoreffList();
    updateMutasiSummary();
    toast("Detil ditambahkan ke Server", "ok");
  } catch (error) {
    console.error("Gagal menyimpan detil:", error);
    toast("Gagal simpan: " + (error.message || "Kesalahan database"), "err");
    _mutSession.isLocked = false;
    $("m_cab").disabled = false;
    $("m_kb").disabled = false;
    $("m_tgl").disabled = false;
  }
}

async function saveEditDetil(id) {
  var dataLama = DBCache.transaksi
    ? DBCache.transaksi.find(function (t) {
        return t.id === id;
      })
    : null;
  if (!dataLama) return toast("Data tidak ditemukan di cache!", "err");

  var noper = $("ed_perk").value;
  var penjelasan = $("ed_penjelasan").value.trim();
  var rp = num($("ed_rp").value);

  if (!noper || !penjelasan || rp <= 0)
    return toast("Field wajib tidak boleh kosong!", "err");

  // ✅ AMBIL NILAI GROUP DARI LOCALSTORAGE
  var activeGroup = localStorage.getItem("group") || "TLGA";

  try {
    var objUpdate = Object.assign({}, dataLama, {
      noperkiraan: noper,
      desc: penjelasan,
      total: rp,
      db: rp,
      group: activeGroup, // ✅ PASTIKAN GROUP SELALU TERUPDATE
    });

    // ✅ GANTI db.get/db.put DENGAN fetch KE SUPABASE
    await fetch(window.location.origin + "/api/data/transaksi/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(objUpdate),
    });

    // Update cache lokal
    var idx = DBCache.transaksi.findIndex((t) => t.id === id);
    if (idx !== -1) DBCache.transaksi[idx] = objUpdate;

    closeModal();
    renderDetilTable();
    updateHeaderNominal();
    renderNoreffList();
    updateMutasiSummary();
    toast("Detil diperbarui di Server", "ok");
  } catch (error) {
    toast("Gagal update: " + error.message, "err");
  }
}

async function hapusDetil(id) {
  if (!confirm("Yakin hapus detil ini?")) return;

  // ✅ AMBIL NILAI GROUP DARI LOCALSTORAGE
  var activeGroup = localStorage.getItem("group") || "TLGA";

  try {
    // ✅ GANTI db.del DENGAN fetch KE SUPABASE
    await fetch(window.location.origin + "/api/data/transaksi/" + id, {
      method: "DELETE",
    });

    if (Array.isArray(DBCache.transaksi)) {
      DBCache.transaksi = DBCache.transaksi.filter(function (t) {
        return t.id !== id;
      });
    }

    var sisaDetil = (DBCache.transaksi || []).filter(function (t) {
      return (
        t.noreff === _mutSession.noreff && (t.group || "TLGA") === activeGroup
      ); // ✅ CEK GROUP SAAT HITUNG SISA
    }).length;

    if (sisaDetil === 0) {
      _mutSession.isLocked = false;
      if ($("m_cab")) $("m_cab").disabled = false;
      if ($("m_kb")) $("m_kb").disabled = false;
      if ($("m_tgl")) $("m_tgl").disabled = false;
      if ($("m_nominal")) $("m_nominal").value = "0";
    }

    renderDetilTable();
    updateMutasiSummary();
    toast("Detil transaksi berhasil dihapus.", "ok");
  } catch (error) {
    console.error("Gagal saat mencoba menghapus detil:", error);
    toast("Gagal menghapus: " + error.message, "err");
  }
}

function updateHeaderNominal() {
  var noreff = _mutSession.noreff;
  if (!noreff) return;
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ AMBIL GROUP
  var totalRp = 0;
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];
  transaksi.forEach(function (t) {
    if (t.noreff === noreff && (t.group || "TLGA") === activeGroup)
      totalRp += num(t.total); // ✅ FILTER GROUP
  });
  $("m_nominal").value = fmtN(totalRp);
}

function renderDetilTable() {
  var noreff = _mutSession.noreff;
  var activeCab = $("m_cab") ? $("m_cab").value : "";
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ AMBIL GROUP
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  var detilData = [];
  if (noreff && activeCab) {
    detilData = transaksi.filter(function (t) {
      return (
        t.noreff === noreff &&
        String(t.cabang || "") === String(activeCab) &&
        (t.group || "TLGA") === activeGroup
      ); // ✅ FILTER GROUP
    });
  }

  detilData.sort(function (a, b) {
    return b.id.localeCompare(a.id);
  });
  var tblEl = $("mutDetilTbl");
  if (!tblEl) return;

  if (!detilData.length) {
    tblEl.innerHTML =
      '<div class="empty-msg"><i class="fa-solid fa-inbox"></i> Belum ada detil untuk No Ref: ' +
      esc(noreff || "...") +
      " (Cabang: " +
      esc(activeCab) +
      ")" +
      "</div>";
    return;
  }

  var rows = detilData.map(function (r) {
    return [
      r.tanggal || "-",
      esc(r.noperkiraan || "-"),
      esc(r.desc || "-"),
      '<span style="font-weight:600">' + fmtN(r.total) + "</span>",
      '<span style="font-size:.75rem;color:var(--muted)">' +
        esc(r.noreff) +
        "</span>",
      '<span style="font-weight:600; color:var(--accent)">' +
        esc(r.cabang || "-") +
        "</span>",
      '<button class="btn btn-g btn-sm" onclick="editDetil(\'' +
        r.id +
        '\')"><i class="fa-solid fa-pen"></i></button> ' +
        '<button type="button" class="btn btn-r btn-sm" onclick="event.preventDefault(); event.stopPropagation(); hapusDetil(\'' +
        r.id +
        "'); return false;\"><i class='fa-solid fa-trash'></i></button>",
    ];
  });

  var headers = [
    "Tanggal",
    "No Acct",
    "Penjelasan",
    "Rp",
    "No Referensi",
    "Cabang",
    "Aksi",
  ];
  tblEl.innerHTML =
    '<div class="ts"><table>' +
    buildTable(headers, rows, { numCols: [3] }) +
    "</table></div>";
}

function renderNoreffList() {
  var box = $("mutNoreffList");
  var countBox = $("mutNoreffCount");
  if (!box) return;
  var filterCabang = $("filter_cabang_list")
    ? $("filter_cabang_list").value
    : "";
  var filterBulan = $("filter_bulan") ? $("filter_bulan").value : "";
  var filterTahun = $("filter_tahun") ? $("filter_tahun").value : "";
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ AMBIL GROUP

  var data = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];
  var filtered = data.filter(function (t) {
    if (!t.noreff || !t.tanggal) return false;
    if ((t.group || "TLGA") !== activeGroup) return false; // ✅ FILTER GROUP
    if (filterCabang && String(t.cabang || "") !== String(filterCabang))
      return false;
    if (filterBulan) {
      var dataBulan = t.tanggal.substring(5, 7);
      var userBulan = filterBulan.padStart(2, "0");
      if (dataBulan !== userBulan) return false;
    }
    if (filterTahun && t.tanggal.substring(0, 4) !== filterTahun) return false;
    return true;
  });

  if (filtered.length === 0) {
    box.innerHTML =
      '<div style="padding:.8rem;color:var(--muted);text-align:center;font-size:.75rem"><i class="fa-solid fa-filter-circle-xmark"></i> Tidak ada data<br><small>Group: ' +
      esc(activeGroup) +
      " | Cabang: " +
      esc(filterCabang || "Semua") +
      " | Bulan: " +
      esc(filterBulan || "Semua") +
      " | Tahun: " +
      esc(filterTahun || "Semua") +
      "</small></div>";
    if (countBox) countBox.textContent = "";
    return;
  }

  var uniqueNoreff = {};
  filtered.forEach(function (t) {
    if (t.noreff && !uniqueNoreff[t.noreff]) {
      uniqueNoreff[t.noreff] = {
        tanggal: t.tanggal || "-",
        jumlahDetil: 0,
        totalRp: 0,
        cabang: t.cabang || "-",
      };
    }
    if (uniqueNoreff[t.noreff]) {
      uniqueNoreff[t.noreff].jumlahDetil++;
      uniqueNoreff[t.noreff].totalRp += num(t.total);
    }
  });

  var arrNoreff = Object.keys(uniqueNoreff).map(function (noreff) {
    return Object.assign({ noreff: noreff }, uniqueNoreff[noreff]);
  });
  arrNoreff.sort(function (a, b) {
    var suffixA = String(a.noreff || "").slice(-8);
    var suffixB = String(b.noreff || "").slice(-8);
    return suffixA.localeCompare(suffixB, undefined, { numeric: true });
  });

  var html =
    '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2);position:sticky;top:0;z-index:1"><th style="padding:4px;text-align:left;font-size:.65rem">No Ref</th><th style="padding:4px;text-align:center;font-size:.65rem;width:30px">D</th><th style="padding:4px;text-align:right;font-size:.65rem;width:65px">Total</th></tr></thead><tbody>';
  arrNoreff.forEach(function (item) {
    var isActive = item.noreff === _mutSession.noreff;
    var rowStyle =
      "cursor:pointer;border-bottom:1px solid var(--brd);transition:background .15s;";
    if (isActive)
      rowStyle += "background:var(--accent);color:#fff;font-weight:600;";
    html +=
      '<tr style="' +
      rowStyle +
      '" onclick="onNoreffClicked(\'' +
      esc(item.noreff) +
      "')\" " +
      (isActive ? 'data-active="1"' : "") +
      ">";

    html +=
      '<td style="padding:4px;font-size:.7rem;font-family:monospace">' +
      esc(item.noreff) +
      (item.cabang
        ? ' <small style="opacity:0.7">(' + esc(item.cabang) + ")</small>"
        : "") +
      "</td>";
    html +=
      '<td style="padding:4px;font-size:.65rem;text-align:center">' +
      item.jumlahDetil +
      "</td>";
    html +=
      '<td style="padding:4px;font-size:.7rem;text-align:right;font-weight:600">' +
      fmtN(item.totalRp) +
      "</td></tr>";
  });
  html += "</tbody></table>";
  box.innerHTML = html;
  if (countBox) countBox.textContent = arrNoreff.length + " transaksi";
}

function onNoreffClicked(noreffTarget) {
  if (noreffTarget === _mutSession.noreff) return;
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ AMBIL GROUP

  var headerData = DBCache.transaksi.find(function (t) {
    return t.noreff === noreffTarget && (t.group || "TLGA") === activeGroup; // ✅ FILTER GROUP
  });
  if (!headerData) return;

  _mutSession.noreff = noreffTarget;
  _mutSession.isLocked = true;
  $("m_noref").value = noreffTarget;
  $("m_tgl").value = headerData.tanggal || "";
  $("m_cab").value = headerData.cabang || "";
  $("m_kb").value = headerData.kodeBank || "";
  $("m_dkp").value = headerData.dariKePada || "";
  $("m_cab").disabled = true;
  $("m_kb").disabled = true;
  $("m_tgl").disabled = true;
  populateKodeBankOpts(headerData.cabang);
  populatePerkiraanOpts(headerData.cabang);
  updateHeaderNominal();
  renderDetilTable();
  renderNoreffList();
  updateMutasiSummary();
}

function printMutasi() {
  var noreff = _mutSession.noreff || $("m_noref").value;
  if (!noreff)
    return toast(
      "Pilih transaksi terlebih dahulu (klik No Ref di riwayat)",
      "wrn",
    );

  var activeGroup = localStorage.getItem("group") || "TLGA";
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  var detilData = transaksi.filter(function (t) {
    return t.noreff === noreff && (t.group || "TLGA") === activeGroup;
  });

  if (detilData.length === 0)
    return toast("Tidak ada detil untuk No Ref & Group ini", "wrn");

  var header = detilData[0];
  var cabangLabel = lookupCabangLabel(header.cabang) || header.cabang || "-";
  var tanggal = header.tanggal || "-";
  var kodeBank = header.kodeBank || "-";
  var dariKePada = header.dariKePada || "-";

  var totalRp = 0;
  detilData.forEach(function (t) {
    totalRp += num(t.total);
  });

  var kbList = Array.isArray(DBCache.kodeBank) ? DBCache.kodeBank : [];
  var kbData = kbList.find(function (k) {
    return k.kodebank === kodeBank;
  });
  var kbPenjelasan = kbData ? kbData.penjelasan : "";

  var printHtml =
    "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Print Mutasi - " +
    esc(noreff) +
    "</title>" +
    "<style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Courier New', Courier, monospace; font-size: 12px; padding: 15px; color: #000; } .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; } .header h2 { font-size: 16px; margin-bottom: 4px; } .header p { font-size: 12px; color: #000; font-weight: bold; } .info-grid { display: grid; grid-template-columns: 130px 1fr; gap: 3px 10px; margin-bottom: 15px; font-size: 12px; } .info-grid .label { font-weight: bold; } table { width: 100%; border-collapse: collapse; margin-bottom: 15px; } th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; font-size: 11px; } th { background: #eee; font-weight: bold; text-align: center; } td.rp { text-align: right; font-family: 'Courier New', monospace; } td.center { text-align: center; } .total-row { font-weight: bold; background: #f5f5f5; } .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #000; font-size: 10px; color: #555; display: flex; justify-content: space-between; } .footer .sign { text-align: center; width: 150px; } .footer .sign .line { margin-top: 50px; border-bottom: 1px solid #000; } @media print { body { padding: 0; } }</style></head><body>" +
    '<div class="header"><h2>MUTASI TRANSAKSI</h2><p>Cabang: ' +
    esc(cabangLabel) +
    "</p></div>" +
    '<div class="info-grid">' +
    '<div class="label">No Referensi</div><div>: ' +
    esc(noreff) +
    "</div>" +
    '<div class="label">Kode Bank</div><div>: ' +
    esc(kodeBank) +
    (kbPenjelasan ? " (" + esc(kbPenjelasan) + ")" : "") +
    "</div>" +
    '<div class="label">Tanggal</div><div>: ' +
    esc(tanggal) +
    "</div>" +
    '<div class="label">Dari / Kepada</div><div>: ' +
    esc(dariKePada) +
    "</div>" +
    '<div class="label">Group</div><div>: ' +
    esc(activeGroup) +
    "</div>" +
    "</div>" +
    "<table><thead><tr><th style='width:40px'>No</th><th style='width:100px'>No Perkiraan</th><th>Penjelasan</th><th style='width:140px'>Rp</th></tr></thead><tbody>";

  detilData.forEach(function (d, idx) {
    printHtml +=
      "<tr><td class='center'>" +
      (idx + 1) +
      "</td><td>" +
      esc(d.noperkiraan || "-") +
      "</td><td>" +
      esc(d.desc || "-") +
      "</td><td class='rp'>" +
      fmtN(d.total) +
      "</td></tr>";
  });

  printHtml +=
    "<tr class='total-row'><td colspan='3' style='text-align:right'>TOTAL</td><td class='rp'>" +
    fmtN(totalRp) +
    "</td></tr></tbody></table>";
  printHtml +=
    "<div style='margin-bottom:15px;font-size:11px'><strong>Terbilang:</strong> " +
    terbilang(totalRp) +
    " Rupiah</div>";
  printHtml +=
    "<div class='footer'><div class='sign'>Dibuat oleh,<br><br><br><div class='line'></div></div><div class='sign'>Diperiksa oleh,<br><br><br><div class='line'></div></div><div class='sign'>Disetujui oleh,<br><br><br><div class='line'></div></div></div></body></html>";

  var printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow)
    return toast("Pop-up diblokir. Izinkan pop-up untuk print.", "err");

  printWindow.document.write(printHtml);
  printWindow.document.close();

  // ✅ PERBAIKAN: Jalankan print langsung dengan jeda timeout tanpa mengandalkan window.onload
  setTimeout(function () {
    printWindow.print();
  }, 500);
}

/* ================================================================
   MUTASI KASIR (CUSTOM RENDER, FORM, SAVE, PRINT)
   =/* ================================================================
   MUTASI KASIR (INPUT EXCEL DI ATAS, DATA DI BAWAH, RIWAYAT KANAN)
   ================================================================ */
PANEL_MAP.mutasikasir = renderMutasiKasir;
AFTER_RENDER.mutasikasir = initMutasiKasirState;
function generateKasirKodeOpts(selectedKode) {
  var kodeList = ["PJ", "BE", "CS", "KK", "KL", "TK", "SK", "KT"];
  var opts = '<option value="">-- Pilih --</option>';
  for (var i = 0; i < kodeList.length; i++) {
    var sel = kodeList[i] === selectedKode ? " selected" : "";
    opts +=
      '<option value="' +
      kodeList[i] +
      '"' +
      sel +
      ">" +
      kodeList[i] +
      "</option>";
  }
  return opts;
}

function renderMutasiKasir() {
  // ✅ PERBAIKAN 1: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroupLabel = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroupLabel = rawGroup.trim().toUpperCase();
  }

  var today = new Date().toISOString().split("T")[0];

  // ✅ PERBAIKAN 2: FILTER DROPDOWN CABANG HANYA YANG SESUAI GROUP AKTIF (MENGGANTIKAN getCabangOpts)
  var rawCabang = DBCache.cabang || [];
  var daftarCabangObj = [];
  rawCabang.forEach(function (c) {
    var id = (c.kode || c.cabang || "").trim();
    var nama = (c.nama || id || "Tanpa Nama").trim();
    var groupCabang = (c.group || "").trim().toUpperCase();
    if (id && groupCabang === activeGroupLabel) {
      daftarCabangObj.push({ id: id, nama: nama });
    }
  });
  daftarCabangObj.sort(function (a, b) {
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  var firstCab = daftarCabangObj.length > 0 ? daftarCabangObj[0].id : "PUSAT";

  var opsiCabangHtml = "";
  daftarCabangObj.forEach(function (item) {
    var sel = item.id === firstCab ? " selected" : "";
    opsiCabangHtml +=
      '<option value="' +
      item.id +
      '"' +
      sel +
      ">" +
      item.id +
      " - " +
      item.nama.toUpperCase() +
      "</option>";
  });

  var html =
    "<style>" +
    ".pnl.active { display: block !important; height: auto !important; overflow: visible !important; }" +
    ".tbl-excel { width: 100%; border-collapse: collapse; border: 1px solid var(--brd); border-radius: 6px; overflow: hidden; }" +
    ".tbl-excel th, .tbl-excel td { border: 1px solid var(--brd); padding: 6px 8px; font-size: .8rem; }" +
    ".tbl-excel thead th { background: var(--bg2); text-align: center; }" +
    ".tbl-excel .row-input td { background: rgba(245, 158, 11, 0.05); border-top: 2px dashed var(--accent); }" +
    ".tbl-excel select, .tbl-excel input { width: 100%; border: none; background: transparent; font-size: .8rem; color: var(--fg); padding: 2px; outline: none; }" +
    ".tbl-excel select:focus, .tbl-excel input:focus { background: var(--bg); border-radius: 4px; }" +
    ".col-kode { width: 80px; text-align: center; }" +
    ".col-rp { width: 140px; text-align: right; }" +
    ".col-aksi { width: 90px; text-align: center; }" +
    "#mutKasirDetilTbl { max-height: 400px; overflow-y: auto; border: 1px solid var(--brd); border-radius: 6px; }" +
    "#mutKasirNoreffList { max-height: 450px !important; overflow-y: auto !important; }" +
    "</style>" +
    '<div style="padding:.8rem;background:var(--bg2);border:1px solid var(--brd);border-radius:10px;margin-bottom:1rem">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">' +
    // ✅ TAMPILKAN GROUP DI JUDUL
    '<div style="font-size:.8rem;font-weight:700;color:var(--accent)"><i class="fa-solid fa-file-circle-plus"></i> Transaksi Kasir | <span style="color:var(--muted); font-weight:400;">GROUP: ' +
    activeGroupLabel +
    "</span></div>" +
    '<div style="display:flex; gap:.4rem; align-items:center;">' +
    '<button type="button" class="btn btn-sm" style="font-size:.65rem;padding:2px 6px" onclick="resetKasirNewTransaction()"><i class="fa-solid fa-plus"></i> Tambah Header Baru</button>' +
    '<button type="button" class="btn btn-sm btn-inf" style="font-size:.65rem;padding:2px 6px" onclick="printMutasiKasir()"><i class="fa-solid fa-print"></i> Print & Simpan</button>' +
    '<button type="button" class="btn btn-sm" style="font-size:.65rem;padding:2px 6px; background:#f59e0b; border-color:#f59e0b; color:#fff;" onclick="promptHapusSeReffKasir()"><i class="fa-solid fa-layer-group"></i> Hapus Se-Reff</button>' +
    "</div></div>" +
    '<div style="display:flex;gap:1rem"><div style="flex:3">' +
    '<div style="display:flex;gap:.5rem;margin-bottom:.5rem">' +
    '<div class="fg" style="flex:1"><label>Cabang</label><select id="mk_cab" class="in">' +
    opsiCabangHtml + // ✅ GANTI DENGAN OPSI YANG SUDAH DIFILTER GROUP
    "</select></div>" +
    '<div class="fg" style="flex:1"><label>Tanggal</label><input id="mk_tgl" type="date" class="in" value="' +
    esc(today) +
    '"></div>' +
    '<div class="fg" style="flex:1"><label>No Ref</label><input id="mk_noref" class="in" readonly style="background:var(--bg);opacity:.8"></div>' +
    '<div class="fg" style="flex:1"><label>Total Rp</label><input id="mk_nominal" class="in" readonly style="background:var(--bg);font-weight:700;color:var(--success)" value="0"></div></div>' +
    '<div style="display:flex;gap:.5rem;margin-bottom:.5rem">' +
    '<div class="fg" style="flex:1"><label>Saldo Awal (Otomatis)</label><input id="mk_saldo_awal" class="in" readonly style="background:var(--bg);color:var(--accent);font-weight:700;" value="Mencari..."></div>' +
    '<div class="fg" style="flex:1"><label>Saldo Akhir (Auto-Hitung)</label><input id="mk_saldo_akhir" class="in" readonly style="background:var(--bg);color:var(--danger);font-weight:700;" value="0"></div></div>' +
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.3rem;">' +
    '<div style="font-size:.85rem;font-weight:700">Riwayat Detil Transaksi Kasir</div>' +
    '<div style="display:flex; gap:.4rem;">' +
    '<button type="button" class="btn btn-sm" style="font-size:.65rem;padding:2px 6px; background:#6366f1; border-color:#6366f1; color:#fff;" onclick="promptImportKasirDBF()"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-sm" style="font-size:.6rem;padding:2px 8px; background:#ef4444; border-color:#ef4444; color:#fff;" onclick="executeHapusMutasiPerCabang()"><i class="fa-solid fa-broom"></i> Kosongkan Data</button>' +
    "</div></div>" +
    '<div style="margin-top:.8rem;"><table class="tbl-excel"><thead><tr><th class="col-kode">Kode</th><th>Penjelasan</th><th class="col-rp">Rp</th><th class="col-aksi">Aksi</th></tr></thead><tbody>' +
    '<tr class="row-input"><td><select id="mk_kode">' +
    generateKasirKodeOpts("") +
    '</select></td><td><input type="text" id="mk_penjelasan" placeholder="Ketik penjelasan lalu tekan Enter..."></td><td><input type="number" id="mk_rp" placeholder="0"></td>' +
    '<td style="text-align:center;"><button class="btn btn-a btn-sm" onclick="addKasirDetil()" style="width:100%;"><i class="fa-solid fa-plus"></i> Tambah</button></td></tr>' +
    "</tbody></table></div>" +
    '<div id="mutKasirDetilTbl" class="tw"></div></div>' +
    '<div style="flex:1;border-left:1px solid var(--brd);padding-left:.8rem;display:flex;flex-direction:column;box-sizing:border-box">' +
    '<div class="fg" style="margin-bottom:.4rem"><label style="font-size:.65rem">Cabang</label><select id="mk_filter_cab" class="in" style="font-size:.75rem;padding:3px 5px">' +
    opsiCabangHtml + // ✅ GANTI DENGAN OPSI YANG SUDAH DIFILTER GROUP
    "</select></div>" +
    '<div style="display:flex;gap:.4rem;margin-bottom:.4rem"><div class="fg" style="flex:1;margin-bottom:0"><label style="font-size:.65rem">Bulan</label><select id="mk_filter_bulan" class="in" style="font-size:.75rem;padding:3px 5px">' +
    generateBulanOpts("") +
    "</select></div>" +
    '<div class="fg" style="flex:1;margin-bottom:0"><label style="font-size:.65rem">Tahun</label><select id="mk_filter_tahun" class="in" style="font-size:.75rem;padding:3px 5px">' +
    generateTahunOpts("") +
    "</select></div></div>" +
    '<div id="mutKasirNoreffList" style="height:180px;overflow-y:auto;font-size:.8rem;background:var(--bg);border:1px solid var(--brd);border-radius:6px"><div style="padding:1rem;color:var(--muted);text-align:center">Memuat data...</div></div></div></div></div>';

  setTimeout(function () {
    if ($("mk_filter_cab"))
      $("mk_filter_cab").onchange = function () {
        renderKasirNoreffList();
      };
    if ($("mk_filter_bulan"))
      $("mk_filter_bulan").onchange = function () {
        renderKasirNoreffList();
      };
    if ($("mk_filter_tahun"))
      $("mk_filter_tahun").onchange = function () {
        renderKasirNoreffList();
      };
  }, 100);

  return html;
}

function initMutasiKasirState() {
  _kasirSession = { noreff: "", isLocked: false };
  var cabEl = $("mk_cab");
  var tglEl = $("mk_tgl");
  if (!cabEl) return;
  cabEl.addEventListener("change", onKasirCabangChange);
  tglEl.addEventListener("change", onKasirHeaderChange);
  $("mk_filter_bulan").addEventListener("change", renderKasirNoreffList);
  $("mk_filter_tahun").addEventListener("change", renderKasirNoreffList);
  ["mk_penjelasan", "mk_rp"].forEach(function (id) {
    var el = $(id);
    if (el)
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addKasirDetil();
        }
      });
  });
  onKasirHeaderChange();
  renderKasirDetilTable();
  renderKasirNoreffList();
}

function onKasirCabangChange() {
  _kasirSession = { noreff: "", isLocked: false };
  $("mk_tgl").disabled = false;
  $("mk_cab").disabled = false;
  onKasirHeaderChange();
}

async function onKasirHeaderChange() {
  if (_kasirSession.isLocked) return;
  var cab = $("mk_cab").value;
  var tgl = $("mk_tgl").value;
  var newNoref =
    "KASIR-" +
    (cab || "PUSAT").substring(0, 3).toUpperCase() +
    "-" +
    tgl +
    "-" +
    Math.random().toString(36).substr(2, 4).toUpperCase();
  $("mk_noref").value = newNoref;
  _kasirSession.noreff = newNoref;
  await hitungSaldoOtomatis();
}

// ✅ FUNGSI HITUNG DB/CR & UPDATE TAMPILAN (DITAMBAH FILTER GROUP)
async function hitungSaldoOtomatis() {
  var cab = $("mk_cab").value;
  var tgl = $("mk_tgl").value;
  var noreff = _kasirSession.noreff;

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  $("mk_saldo_awal").value = "Mencari...";
  var saldoAwal = await cariSaldoAwalKasir(cab, tgl);
  $("mk_saldo_awal").value = fmtN(saldoAwal);

  var data = Array.isArray(DBCache.mutasikasir) ? DBCache.mutasikasir : [];
  var detilNoreff = data.filter(function (t) {
    var tGroup = String(t.group || "")
      .trim()
      .toUpperCase();
    return (
      t.noreff === noreff && (t.tanggal || "") === tgl && tGroup === activeGroup
    );
  });

  var totalDB = 0;
  var totalCR = 0;
  detilNoreff.forEach(function (trx) {
    var kode = (trx.kodeTrans || "").toUpperCase();
    var nominal = num(trx.total || 0);
    if (kode === "PJ" || kode === "TK" || kode === "KT") {
      totalDB += nominal;
    } else {
      totalCR += nominal;
    }
  });

  var saldoAkhir = saldoAwal + totalDB - totalCR;
  $("mk_saldo_akhir").value = fmtN(saldoAkhir);
}

async function addKasirDetil() {
  var noreff = _kasirSession.noreff;
  var kode = $("mk_kode").value.toUpperCase();
  var penjelasan = $("mk_penjelasan").value.trim().toUpperCase();
  var rp = num($("mk_rp").value);
  if (!kode || !penjelasan || rp <= 0)
    return toast("Kode, Penjelasan, dan Rp wajib diisi!", "err");

  _kasirSession.isLocked = true;
  $("mk_cab").disabled = true;
  $("mk_tgl").disabled = true;

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  try {
    var newDetil = {
      id: uid(),
      noreff: noreff,
      tanggal: $("mk_tgl").value,
      cabang: $("mk_cab").value,
      kodeTrans: kode,
      noperkiraan: "",
      desc: penjelasan,
      total: rp,
      db: rp,
      cr: 0,
      group: activeGroup,
    };

    await fetch(window.location.origin + "/api/data/mutasikasir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDetil),
    });

    if (!DBCache.mutasikasir) DBCache.mutasikasir = [];
    DBCache.mutasikasir.push(newDetil);

    $("mk_kode").value = "";
    $("mk_penjelasan").value = "";
    $("mk_rp").value = "";
    $("mk_kode").focus();
    renderKasirDetilTable();
    updateKasirHeaderNominal();
    await hitungSaldoOtomatis();
    renderKasirNoreffList();
    toast("Detil kasir ditambahkan", "ok");
  } catch (error) {
    toast("Gagal simpan: " + error.message, "err");
    _kasirSession.isLocked = false;
    $("mk_cab").disabled = false;
    $("mk_tgl").disabled = false;
  }
}

function updateKasirHeaderNominal() {
  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var totalRp = 0;
  var data = DBCache.mutasikasir || [];
  data.forEach(function (t) {
    var tGroup = String(t.group || "")
      .trim()
      .toUpperCase();
    if (t.noreff === _kasirSession.noreff && tGroup === activeGroup) {
      totalRp += num(t.total);
    }
  });
  $("mk_nominal").value = fmtN(totalRp);
}

function renderKasirDetilTable() {
  var noreff = _kasirSession.noreff;

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var tblEl = $("mutKasirDetilTbl");
  if (!tblEl) return;
  var data = Array.isArray(DBCache.mutasikasir) ? DBCache.mutasikasir : [];

  var detilData = data.filter(function (t) {
    var tGroup = String(t.group || "")
      .trim()
      .toUpperCase();
    return t.noreff === noreff && tGroup === activeGroup;
  });

  var html =
    '<table class="tbl-excel"><thead><tr><th class="col-kode">Kode</th><th>Penjelasan</th><th class="col-rp">Rp</th><th class="col-aksi">Aksi</th></tr></thead><tbody>';
  if (!detilData.length) {
    html +=
      '<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:1rem;"><i class="fa-solid fa-inbox"></i> Belum ada detil</td></tr>';
  } else {
    detilData.forEach(function (r) {
      html +=
        "<tr><td style='text-align:center; font-weight:600; color:var(--accent);'>" +
        esc(r.kodeTrans || "-") +
        "</td><td>" +
        esc(r.desc || "-") +
        "</td><td style='text-align:right; font-weight:600;'>" +
        fmtN(r.total) +
        "</td><td style='text-align:center; white-space:nowrap;'><button class='btn btn-g btn-sm' onclick=\"editKasirDetil('" +
        r.id +
        "')\"><i class='fa-solid fa-pen'></i></button> <button type='button' class='btn btn-r btn-sm' onclick=\"hapusKasirDetil('" +
        r.id +
        "')\"><i class='fa-solid fa-trash'></i></button></td></tr>";
    });
  }
  html += "</tbody></table>";
  tblEl.innerHTML = html;
}

async function hapusKasirDetil(id) {
  if (!confirm("Yakin hapus detil ini?")) return;

  await fetch(window.location.origin + "/api/data/mutasikasir/" + id, {
    method: "DELETE",
  });

  if (DBCache.mutasikasir) {
    DBCache.mutasikasir = DBCache.mutasikasir.filter(function (t) {
      return t.id !== id;
    });
  }

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var sisa = (DBCache.mutasikasir || []).filter(function (t) {
    var tGroup = String(t.group || "")
      .trim()
      .toUpperCase();
    return t.noreff === _kasirSession.noreff && tGroup === activeGroup;
  }).length;

  if (sisa === 0) {
    _kasirSession.isLocked = false;
    $("mk_cab").disabled = false;
    $("mk_tgl").disabled = false;
    $("mk_nominal").value = "0";
  }
  renderKasirDetilTable();
  updateKasirHeaderNominal();
  await hitungSaldoOtomatis();
  renderKasirNoreffList();
}
// ✅ FUNGSI PENCARIAN SALDO AWAL KE MUNDUR KHUSUS KASIR (SUDAH DIFIX GROUP NYA)
async function cariSaldoAwalKasir(cabang, tanggalPilih) {
  if (!cabang || !tanggalPilih) return 0;

  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  // ✅ 1. CEK CACHE DULU
  // Pastikan pengecekan cache-nya pakai huruf kecil 'saldokasir' (sesuai posting)
  if (!DBCache.saldokasir || DBCache.saldokasir.length === 0) {
    console.log("📦 Cache saldo kasir kosong, mengambil data dari server...");
    try {
      // ✅ 2. PANGGIL ENDPOINT GENERIC ANDA (Nama tabel jadi saldo_kasir)
      // Kita kirim cabang & group sebagai parameter query
      var url =
        API_BASE_URL +
        "/api/data/saldo_kasir?cabang=" +
        encodeURIComponent(cabang) +
        "&group=" +
        encodeURIComponent(activeGroup);

      var res = await fetch(url);

      if (res.ok) {
        var json = await res.json();

        // ✅ 3. BONGKAR FORMAT JSONB DARI BACKEND ANDA
        // Karena backend SELECT data FROM..., hasilnya bisa jadi [{data: {...}}] atau langsung [{...}]
        var parsedData = json.map(function (item) {
          // Jika bungkusannya ada properti "data", maka ambil isinya
          if (item && item.data && typeof item.data === "object") {
            return item.data;
          }
          return item; // Jika sudah flat, langsung return
        });

        // Masukkan yang sudah dibongkar ke cache
        DBCache.saldokasir = parsedData;
        console.log(
          "✅ Berhasil mengambil " +
            parsedData.length +
            " data saldo kasir ke cache",
        );
      } else {
        console.error("Gagal load data dari server, status:", res.status);
      }
    } catch (e) {
      console.error("Gagal mengambil data saldo kasir dari server:", e);
    }
  }

  // ✅ 4. FILTER DARI CACHE YANG SUDAH DI-BONGKAR
  var dataSk = (DBCache.saldokasir || []).filter(function (item) {
    var groupItem = String(item.group || "")
      .trim()
      .toUpperCase();
    return (item.cabang || "") === cabang && groupItem === activeGroup;
  });

  var tglTarget = new Date(tanggalPilih);
  tglTarget.setDate(tglTarget.getDate() - 1);
  var maxIterasi = 365;

  for (var i = 0; i < maxIterasi; i++) {
    var tglStr = tglTarget.toISOString().split("T")[0];
    var cocok = dataSk.find(function (sk) {
      return (sk.tanggal || "") === tglStr;
    });

    if (cocok) {
      console.log(
        "✅ Saldo kasir awal ditemukan di tanggal " + tglStr,
        "| Nilai:",
        cocok.saldo_akhir,
      );
      return num(cocok.saldo_akhir) || 0;
    }

    tglTarget.setDate(tglTarget.getDate() - 1);
  }

  console.warn(
    "⚠️ Saldo awal kasir tidak ditemukan untuk cab:",
    cabang,
    "tgl:",
    tanggalPilih,
  );
  return 0;
}

function renderKasirNoreffList() {
  var box = $("mutKasirNoreffList");
  var countBox = $("mutKasirNoreffCount");
  if (!box) return;
  var filterCabang = $("mk_filter_cab") ? $("mk_filter_cab").value : "";
  var filterBulan = $("mk_filter_bulan") ? $("mk_filter_bulan").value : "";
  var filterTahun = $("mk_filter_tahun") ? $("mk_filter_tahun").value : "";

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var data = Array.isArray(DBCache.mutasikasir) ? DBCache.mutasikasir : [];
  var safeBulan = filterBulan ? filterBulan.padStart(2, "0") : "";

  var filtered = data.filter(function (t) {
    var d = t.data || t;
    if (!d.noreff || !d.tanggal) return false;
    if (typeof d.tanggal !== "string" || d.tanggal.length < 7) return false;

    var dGroup = String(d.group || "")
      .trim()
      .toUpperCase();
    if (dGroup !== activeGroup) return false;

    var ym = d.tanggal.substring(0, 7);
    if (filterCabang !== "" && String(d.cabang || "") !== String(filterCabang))
      return false;
    if (safeBulan && filterTahun) return ym === filterTahun + "-" + safeBulan;
    if (safeBulan) return ym.substring(5, 7) === safeBulan;
    if (filterTahun) return ym.substring(0, 4) === filterTahun;
    return true;
  });

  if (filtered.length === 0) {
    box.innerHTML =
      '<div style="padding:.8rem;color:var(--muted);text-align:center;font-size:.75rem"><i class="fa-solid fa-filter-circle-xmark"></i> Tidak ada data<br><small>Group: ' +
      esc(activeGroup) +
      " | Cabang: " +
      esc(filterCabang || "Semua") +
      " | Bulan: " +
      esc(filterBulan || "Semua") +
      " | Tahun: " +
      esc(filterTahun || "Semua") +
      "</small></div>";
    if (countBox) countBox.textContent = "";
    return;
  }

  var uniqueNoreff = {};
  filtered.forEach(function (t) {
    var d = t.data || t;
    if (d.noreff && !uniqueNoreff[d.noreff]) {
      uniqueNoreff[d.noreff] = {
        tanggal: d.tanggal || "-",
        jumlahDetil: 0,
        totalRp: 0,
        cabang: d.cabang || "-",
      };
    }
    if (uniqueNoreff[d.noreff]) {
      uniqueNoreff[d.noreff].jumlahDetil++;
      uniqueNoreff[d.noreff].totalRp += num(d.total);
    }
  });

  var arrNoreff = Object.keys(uniqueNoreff).map(function (noreff) {
    return Object.assign({ noreff: noreff }, uniqueNoreff[noreff]);
  });
  arrNoreff.sort(function (a, b) {
    var suffixA = String(a.noreff || "").slice(-8);
    var suffixB = String(b.noreff || "").slice(-8);
    return suffixA.localeCompare(suffixB, undefined, { numeric: true });
  });

  var html =
    '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2);position:sticky;top:0;z-index:1"><th style="padding:4px;text-align:left;font-size:.65rem">No Ref</th><th style="padding:4px;text-align:center;font-size:.65rem;width:30px">D</th><th style="padding:4px;text-align:right;font-size:.65rem;width:65px">Total</th></tr></thead><tbody>';
  arrNoreff.forEach(function (item) {
    var isActive = item.noreff === _kasirSession.noreff;
    var rowStyle =
      "cursor:pointer;border-bottom:1px solid var(--brd);transition:background .15s;";
    if (isActive)
      rowStyle += "background:var(--accent);color:#fff;font-weight:600;";
    html +=
      '<tr style="' +
      rowStyle +
      '" onclick="onKasirNoreffClicked(\'' +
      esc(item.noreff).replace(/'/g, "\\'") +
      "')\" " +
      (isActive ? 'data-active="1"' : "") +
      ">";
    html +=
      '<td style="padding:4px;font-size:.7rem;font-family:monospace">' +
      esc(item.noreff) +
      (item.cabang
        ? ' <small style="opacity:0.7">(' + esc(item.cabang) + ")</small>"
        : "") +
      "</td>";
    html +=
      '<td style="padding:4px;font-size:.65rem;text-align:center">' +
      item.jumlahDetil +
      "</td>";
    html +=
      '<td style="padding:4px;font-size:.7rem;text-align:right;font-weight:600">' +
      fmtN(item.totalRp) +
      "</td></tr>";
  });
  html += "</tbody></table>";
  box.innerHTML = html;
  if (countBox) countBox.textContent = arrNoreff.length + " kasir";
}

function onKasirNoreffClicked(noreffTarget) {
  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var data = DBCache.mutasikasir || [];
  var headerData = data.find(function (t) {
    var tGroup = String(t.group || "")
      .trim()
      .toUpperCase();
    return t.noreff === noreffTarget && tGroup === activeGroup;
  });
  if (!headerData) return;

  _kasirSession.noreff = noreffTarget;
  _kasirSession.isLocked = true;
  $("mk_noref").value = noreffTarget;
  $("mk_tgl").value = headerData.tanggal || "";
  $("mk_cab").value = headerData.cabang || "";
  $("mk_cab").disabled = true;
  $("mk_tgl").disabled = true;
  updateKasirHeaderNominal();
  hitungSaldoOtomatis();
  renderKasirDetilTable();
  renderKasirNoreffList();
}

function resetKasirNewTransaction() {
  _kasirSession = { noreff: "", isLocked: false };
  $("mk_cab").disabled = false;
  $("mk_tgl").disabled = false;
  $("mk_nominal").value = "0";
  onKasirHeaderChange();
  renderKasirDetilTable();
  renderKasirNoreffList();
}
/* ================================================================
   PRINT MUTASI KASIR & SIMPAN SALDO OTOMATIS
   ================================================================ */
async function printMutasiKasir() {
  var noreff = _kasirSession.noreff;
  if (!noreff) return toast("Pilih transaksi terlebih dahulu", "wrn");

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var data = Array.isArray(DBCache.mutasikasir) ? DBCache.mutasikasir : [];

  // ✅ DITAMBAH .toUpperCase() AGAR KONSISTEN
  var detilData = data.filter(function (t) {
    var noreffCocok = t.noreff === noreff;
    var groupCocok =
      String(t.group || "")
        .trim()
        .toUpperCase() === activeGroup;
    return noreffCocok && groupCocok;
  });

  if (detilData.length === 0)
    return toast("Tidak ada detil untuk No Ref & Group ini", "wrn");

  var header = detilData[0];
  var cabangLabel = lookupCabangLabel(header.cabang) || header.cabang || "-";
  var tanggal = header.tanggal || "-";
  var cabang = header.cabang || "Pusat";

  // 1. Kelompokkan data berdasarkan kode
  var dataKode = { BE: [], PJ: [], CS: [], KK: [], KT: [], TK: [], LAIN: [] };
  var totalBE = 0,
    totalPJ = 0,
    totalCS = 0,
    totalKK = 0,
    totalKT = 0,
    totalTK = 0;

  detilData.forEach(function (t) {
    var k = t.kodeTrans || "";
    var nominal = num(t.total);
    if (k === "BE") {
      dataKode.BE.push(t);
      totalBE += nominal;
    } else if (k === "PJ") {
      dataKode.PJ.push(t);
      totalPJ += nominal;
    } else if (k === "CS") {
      dataKode.CS.push(t);
      totalCS += nominal;
    } else if (k === "KK") {
      dataKode.KK.push(t);
      totalKK += nominal;
    } else if (k === "KT") {
      dataKode.KT.push(t);
      totalKT += nominal;
    } else if (k === "TK") {
      dataKode.TK.push(t);
      totalTK += nominal;
    } else {
      dataKode.LAIN.push(t);
    }
  });

  var saldoAwalKasir = 0;
  var saldoAkhirKasir = 0;

  var saldoAwalEl = $("mk_saldo_awal");
  var saldoAkhirEl = $("mk_saldo_akhir");

  if (saldoAwalEl && saldoAwalEl.value && saldoAwalEl.value !== "Mencari...") {
    saldoAwalKasir = num(String(saldoAwalEl.value).replace(/\./g, ""));
  }
  if (saldoAkhirEl && saldoAkhirEl.value) {
    saldoAkhirKasir = num(String(saldoAkhirEl.value).replace(/\./g, ""));
  }

  var totalDB = totalPJ + totalTK + totalKT;
  var totalCR = totalBE + totalCS + totalKK;
  dataKode.LAIN.forEach(function (l) {
    totalCR += num(l.total);
  });

  // 4. SIMPAN HASIL PERHITUNGAN KE SERVER SUPABASE
  try {
    var existingSaldo = (DBCache.saldoKasir || []).find(function (s) {
      var sGroup = String(s.group || "")
        .trim()
        .toUpperCase();
      return (
        (s.cabang || "") === cabang &&
        (s.tgl_awal || "") === tanggal &&
        sGroup === activeGroup
      );
    });

    var objSaldo = {
      cabang: cabang,
      tgl_awal: tanggal,
      awal: saldoAwalKasir,
      db: totalDB,
      cr: totalCR,
      akhir: saldoAkhirKasir,
      group: activeGroup,
    };

    if (existingSaldo) {
      objSaldo.id = existingSaldo.id;
      await fetch(
        window.location.origin + "/api/data/saldoKasir/" + existingSaldo.id,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(objSaldo),
        },
      );
      var idx = DBCache.saldoKasir.findIndex((s) => s.id === existingSaldo.id);
      if (idx !== -1) DBCache.saldoKasir[idx] = objSaldo;
    } else {
      objSaldo.id = uid();
      await fetch(window.location.origin + "/api/data/saldoKasir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objSaldo),
      });
      if (!DBCache.saldoKasir) DBCache.saldoKasir = [];
      DBCache.saldoKasir.push(objSaldo);
    }
    console.log("✅ Saldo kasir berhasil disimpan ke Supabase:", objSaldo);
  } catch (errSaldo) {
    console.error("Gagal simpan saldo kasir:", errSaldo);
    toast("Peringatan: Gagal simpan saldo ke database server", "wrn");
  }

  // 5. Lanjut Format Rupiah & HTML Print
  function fmtRp(val) {
    return num(val).toLocaleString("id-ID");
  }

  function rowHtml(kodeArr) {
    var html = "";
    kodeArr.forEach(function (d) {
      html +=
        "<tr><td style='padding-left:20px;'>" +
        esc(d.desc || "-") +
        "</td><td style='text-align:right'>" +
        fmtRp(d.total) +
        "</td></tr>";
    });
    return html;
  }

  var penjualanTunai = totalPJ - totalCS;
  var saldoTersedia = saldoAwalKasir + penjualanTunai + totalTK;
  var saldoKas = saldoTersedia - totalBE;

  var printHtml =
    "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Print Kasir - " +
    esc(noreff) +
    "</title>" +
    "<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:15px;color:#000}" +
    "h2{text-align:center;margin-bottom:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px}" +
    "th,td{padding:4px 4px;text-align:left}td.rp{text-align:right}.bold{font-weight:bold}.total{border-top:1px solid #000;border-bottom:1px solid #000;font-weight:bold}</style></head><body>" +
    "<h2>LAPORAN KAS HARIAN KASIR</h2>" +
    "<p>Cabang : " +
    esc(cabangLabel) +
    "<br>Tanggal : " +
    esc(tanggal) +
    "<br>No Ref : " +
    esc(noreff) +
    "<br>Group : " +
    esc(activeGroup) +
    "</p><hr>" +
    "<table>" +
    "<tr class='bold'><td>BELANJA</td><td style='text-align:right'>Rp</td></tr>" +
    rowHtml(dataKode.BE) +
    "<tr style='font-weight:bold; border-top:1px solid #000;'><td>TOTAL BELANJA</td><td style='text-align:right'>" +
    fmtRp(totalBE) +
    "</td></tr>" +
    "<tr><td colspan='2'>&nbsp;</td></tr>" +
    "<tr class='bold'><td>(+)</td><td style='text-align:right'>Rp</td></tr>" +
    rowHtml(dataKode.PJ) +
    "<tr><td colspan='2'>&nbsp;</td></tr>" +
    "<tr class='bold'><td>(-)</td><td style='text-align:right'>Rp</td></tr>" +
    rowHtml(dataKode.CS) +
    "<tr class='total'><td>PENJUALAN TUNAI</td><td style='text-align:right; border-top: 1px solid #000;'>" +
    fmtRp(penjualanTunai) +
    "</td></tr>" +
    "<tr class='bold'><td>SALDO AWAL</td><td style='text-align:right;'>" +
    fmtRp(saldoAwalKasir) +
    "</td></tr>" +
    rowHtml(dataKode.TK) +
    "<tr class='bold' style='border-top: 1px solid #000;'><td>SALDO KAS TERSEDIA</td><td style='text-align:right'>" +
    fmtRp(saldoTersedia) +
    "</td></tr>" +
    "<tr class='total'><td>SALDO KAS</td><td style='text-align:right'>" +
    fmtRp(saldoKas) +
    "</td></tr>" +
    "<tr class='bold'><td>KOREKSI(+)</td><td style='text-align:right'>Rp</td></tr>" +
    rowHtml(dataKode.KT) +
    "<tr><td colspan='1'>&nbsp;</td></tr>" +
    "<tr class='bold'><td>KOREKSI(-)</td><td style='text-align:right'>Rp</td></tr>" +
    rowHtml(dataKode.KK) +
    "<tr class='total'><td>SALDO AKHIR KAS</td><td style='text-align:right; border-top: 1px solid #000;'>" +
    fmtRp(saldoAkhirKasir) +
    "</td></tr>" +
    "</table></body></html>";

  var printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow)
    return toast("Pop-up diblokir. Izinkan pop-up untuk print.", "err");

  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.onload = function () {
    setTimeout(function () {
      printWindow.print();
    }, 300);
  };
}

function editKasirDetil(idYangDiedit) {
  if (!DBCache.mutasikasir) return;
  var dataLama = DBCache.mutasikasir.find(function (item) {
    return item.id === idYangDiedit;
  });
  if (!dataLama) return toast("Data tidak ditemukan!", "err");

  openModal(
    "Edit Detil Kasir",
    '<div class="fg"><label>Kode</label><input id="ed_mk_kode" value="' +
      esc(dataLama.kodeTrans || "") +
      '"></div>' +
      '<div class="fg"><label>Penjelasan</label><input id="ed_mk_penjelasan" value="' +
      esc(dataLama.desc || "") +
      '"></div>' +
      '<div class="fg"><label>Rp</label><input type="number" id="ed_mk_rp" value="' +
      dataLama.total +
      '"></div>',
    '<button class="btn btn-g" onclick="closeModal()">Batal</button>' +
      '<button class="btn btn-a" onclick="event.preventDefault(); event.stopPropagation(); simpanPerubahanKasirDetil(\'' +
      idYangDiedit +
      "')\">Update</button>",
  );
}

async function simpanPerubahanKasirDetil(idYangDiedit) {
  if (!DBCache.mutasikasir) return toast("Cache mutasi kosong!", "err");

  var dataLama = DBCache.mutasikasir.find(function (item) {
    return item.id === idYangDiedit;
  });
  if (!dataLama) return toast("Data tidak ditemukan di cache!", "err");

  var kode = $("ed_mk_kode").value.toUpperCase();
  var penjelasan = $("ed_mk_penjelasan").value.trim().toUpperCase();
  var rp = num($("ed_mk_rp").value);

  if (!kode || !penjelasan || rp <= 0)
    return toast("Kode, Penjelasan, dan Rp wajib diisi!", "err");

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  try {
    var objUpdate = Object.assign({}, dataLama, {
      kodeTrans: kode,
      desc: penjelasan,
      total: rp,
      db: rp,
      group: activeGroup,
    });

    await fetch(
      window.location.origin + "/api/data/mutasikasir/" + idYangDiedit,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objUpdate),
      },
    );

    var idx = DBCache.mutasikasir.findIndex((item) => item.id === idYangDiedit);
    if (idx !== -1) DBCache.mutasikasir[idx] = objUpdate;

    closeModal();
    renderKasirDetilTable();
    updateKasirHeaderNominal();
    await hitungSaldoOtomatis();
    renderKasirNoreffList();
    toast("Detil kasir berhasil diperbarui di Server", "ok");
  } catch (error) {
    toast("Gagal edit: " + error.message, "err");
  }
}

function promptHapusSeReffKasir() {
  var noreffAktif = _kasirSession.noreff;

  var html =
    '<div class="fg">' +
    "<label>Masukkan No Reff yang ingin dihapus:</label>" +
    '<input id="inputCariReffKasir" class="in" placeholder="Contoh: KASIR-00-..." style="margin-top:.5rem; font-weight:bold; font-size:1rem;" value="' +
    esc(noreffAktif) +
    '">' +
    "</div>" +
    '<div id="previewReffKasirContainer" style="margin-top:1rem; display:none;"></div>';

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button type="button" class="btn btn-r" id="btnExecHapusReffKasir" onclick="executeHapusSeReffKasir()" disabled><i class="fa-solid fa-trash-can"></i> Hapus Data</button>';

  openModal("Hapus Transaksi Kasir Berdasarkan No Reff", html, foot);

  setTimeout(function () {
    var inputEl = $("inputCariReffKasir");
    if (inputEl) {
      inputEl.focus();
      inputEl.select();

      inputEl.oninput = function () {
        var val = inputEl.value.trim();
        var container = $("previewReffKasirContainer");
        var btnExec = $("btnExecHapusReffKasir");

        if (!val) {
          container.style.display = "none";
          btnExec.disabled = true;
          return;
        }

        var dataStore = Array.isArray(DBCache.mutasikasir)
          ? DBCache.mutasikasir
          : [];
        var dataCocok = dataStore.filter(function (item) {
          return (item.noreff || "").toLowerCase() === val.toLowerCase();
        });

        if (dataCocok.length > 0) {
          btnExec.disabled = false;
          container.style.display = "block";

          var totalNominal = dataCocok.reduce(function (sum, d) {
            return sum + num(d.total || 0);
          }, 0);

          var listHtml = dataCocok
            .map(function (d, i) {
              return (
                '<div style="padding:.4rem .5rem; border-bottom:1px solid var(--brd); font-size:.75rem; display:flex; justify-content:space-between;">' +
                "<span>" +
                (d.kodeTrans || "-") +
                " - " +
                esc(d.desc || "-") +
                "</span>" +
                '<span style="color:var(--accent); font-weight:bold;">' +
                formatUang(d.total || 0) +
                "</span></div>"
              );
            })
            .join("");

          container.innerHTML =
            '<div style="padding:.6rem; background:rgba(245,158,11,.1); border:1px solid rgba(245,158,11,.3); border-radius:8px; margin-bottom:.5rem; font-size:.8rem; color:var(--fg);">' +
            "<strong>🔍 Ditemukan: " +
            dataCocok.length +
            " transaksi</strong> (Total: <strong>" +
            formatUang(totalNominal) +
            "</strong>)</div>" +
            '<div style="max-height:200px; overflow-y:auto; background:var(--bg2); border:1px solid var(--brd); border-radius:8px; padding:.5rem; font-family:JetBrains Mono, monospace;">' +
            listHtml +
            "</div>";
        } else {
          btnExec.disabled = true;
          container.style.display = "block";
          container.innerHTML =
            '<div style="color:var(--muted); font-size:.8rem; text-align:center; padding:1rem;">Tidak ada transaksi dengan No Reff ini.</div>';
        }
      };
    }
  }, 100);
}

async function executeHapusSeReffKasir() {
  var val = $("inputCariReffKasir").value.trim();
  if (!val) return toast("No Reff kosong", "err");

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  try {
    console.log(
      "🗑️ [Hapus Reff] Mencoba menghapus Noreff:",
      val,
      "| Group:",
      activeGroup,
    );

    var response = await fetch("/api/clear-all-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeName: "mutasikasir",
        noreff: val,
        group: activeGroup,
      }),
    });

    var result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal menghubungi server");
    }

    var dataStore = Array.isArray(DBCache.mutasikasir)
      ? DBCache.mutasikasir
      : [];

    DBCache.mutasikasir = dataStore.filter(function (item) {
      var noreffCocok = (item.noreff || "").toLowerCase() === val.toLowerCase();
      // ✅ DITAMBAH .toUpperCase() AGAR KONSISTEN
      var groupCocok =
        String(item.group || "")
          .trim()
          .toUpperCase() === activeGroup;

      // Kembalikan false (artinya hapus) HANYA jika keduanya cocok
      return !(noreffCocok && groupCocok);
    });

    closeModal();
    toast(
      `✅ Berhasil menghapus ${result.changes || 0} data se-Reff ${val} (Group: ${activeGroup}) dari Server!`,
      "ok",
    );

    if (val.toLowerCase() === _kasirSession.noreff.toLowerCase()) {
      resetKasirNewTransaction();
    } else {
      renderKasirDetilTable();
      updateKasirHeaderNominal();
      await hitungSaldoOtomatis();

      if (typeof buildGroupedNoreff === "function") {
        buildGroupedNoreff();
      }
      renderKasirNoreffList();
    }
  } catch (err) {
    closeModal();
    toast("Gagal menghapus: " + err.message, "err");
  }
}
// ✅ FUNGSI POPUP HAPUS DATA MUTASI KASIR PER CABANG

async function executeHapusMutasiPerCabang() {
  var label = "Mutasi Kasir";

  var tahunSekarang = new Date().getFullYear();
  var opsiTahunHtml = "";
  for (var i = 0; i < 3; i++) {
    var thn = tahunSekarang - i;
    opsiTahunHtml += `<option value="${thn}">${thn}</option>`;
  }

  var daftarBulan = [
    { v: "01", n: "Januari" },
    { v: "02", n: "Februari" },
    { v: "03", n: "Maret" },
    { v: "04", n: "April" },
    { v: "05", n: "Mei" },
    { v: "06", n: "Juni" },
    { v: "07", n: "Juli" },
    { v: "08", n: "Agustus" },
    { v: "09", n: "September" },
    { v: "10", n: "Oktober" },
    { v: "11", n: "November" },
    { v: "12", n: "Desember" },
  ];
  var opsiBulanHtml = daftarBulan
    .map(function (b) {
      return `<option value="${b.v}">${b.n}</option>`;
    })
    .join("");

  var cabFilterOpts = '<option value="">-- Semua Cabang --</option>';
  if (DBCache.cabang && Array.isArray(DBCache.cabang)) {
    var sortedList = [...DBCache.cabang];
    sortedList.sort(function (a, b) {
      return String(a.kode || "").localeCompare(String(b.kode || ""));
    });
    cabFilterOpts += sortedList
      .map(function (c) {
        var displayNama = c.nama ? ` (${c.nama})` : "";
        return `<option value="${c.kode}">${c.kode}${displayNama}</option>`;
      })
      .join("");
  }

  // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
  var rawGroup = localStorage.getItem("group");
  var activeGroupLabel = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroupLabel = rawGroup.trim().toUpperCase();
  }

  var daftarGroup = ["TLGA", "TLTA", "KBJ", "SBI"];
  var opsiGroupHtml = daftarGroup
    .map(function (g) {
      var sel = g === activeGroupLabel ? "selected" : "";
      return `<option value="${g}" ${sel}>${g}</option>`;
    })
    .join("");

  openModal(
    "Filter Hapus Data " + label,
    `<div class="confirm-box" style="padding: .5rem">
      <div style="margin-bottom: 1rem; font-size: .85rem; color: var(--muted)">
        Data yang dihapus akan langsung terhapus dari Database Server.
      </div>
      
      <div style="display: flex; flex-direction: column; gap: .8rem; margin-bottom: 1.5rem">
        <div>
          <label style="display:block; font-size:.8rem; margin-bottom:.3rem; font-weight:bold">Group</label>
          <select id="del_group" style="width:100%; padding:.5rem; border-radius:6px; border:1px solid var(--brd); background:var(--bg2); color:inherit">
            ${opsiGroupHtml}
          </select>
        </div>

        <div>
          <label style="display:block; font-size:.8rem; margin-bottom:.3rem; font-weight:bold">Bulan</label>
          <select id="del_bulan" style="width:100%; padding:.5rem; border-radius:6px; border:1px solid var(--brd); background:var(--bg2); color:inherit">
            <option value="">-- Semua Bulan --</option>
            ${opsiBulanHtml}
          </select>
        </div>
        
        <div>
          <label style="display:block; font-size:.8rem; margin-bottom:.3rem; font-weight:bold">Tahun</label>
          <select id="del_tahun" style="width:100%; padding:.5rem; border-radius:6px; border:1px solid var(--brd); background:var(--bg2); color:inherit">
            <option value="">-- Semua Tahun --</option>
            ${opsiTahunHtml}
          </select>
        </div>
        
        <div>
          <label style="display:block; font-size:.8rem; margin-bottom:.3rem; font-weight:bold">Kode Cabang</label>
          <select id="del_cabang" style="width:100%; padding:.5rem; border-radius:6px; border:1px solid var(--brd); background:var(--bg2); color:inherit">
            ${cabFilterOpts}
          </select>
        </div>
      </div>

      <div class="cb-btns" style="display:flex; justify-content:flex-end; gap:.5rem">
        <button class="btn btn-g" onclick="closeModal()">Batal</button>
        <button class="btn btn-r" id="btnKonfirmasiHapusMutasi"><i class="fa-solid fa-trash-can"></i> Hapus Data</button>
      </div>
    </div>`,
  );

  document.getElementById("btnKonfirmasiHapusMutasi").onclick =
    async function () {
      var grp = document.getElementById("del_group").value;
      var bln = document.getElementById("del_bulan").value;
      var thn = document.getElementById("del_tahun").value;
      var cbg = document.getElementById("del_cabang").value;

      if (!cbg) return toast("Kode Cabang wajib dipilih!", "err");

      var infoFilter = `\nGroup: ${grp}\nBulan: ${bln || "Semua"}\nTahun: ${thn || "Semua"}\nCabang: ${cbg}`;

      if (
        !confirm(
          "PERINGATAN!\n\nData " +
            label +
            " dengan kriteria berikut akan dihapus permanen dari Server:" +
            infoFilter +
            "\n\nLanjutkan?",
        )
      )
        return;

      closeModal();
      toast("Menghubungi server untuk menghapus data...", "inf");

      try {
        var response = await fetch("/api/clear-all-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeName: "mutasikasir",
            cabang: cbg,
            tahun: thn,
            bulan: bln,
            group: grp,
          }),
        });

        var result = await response.json();
        if (!response.ok || !result.success)
          throw new Error(result.message || "Gagal menghubungi server");

        var dataDipertahankan = [];
        var allData = DBCache.mutasikasir || [];

        for (var i = 0; i < allData.length; i++) {
          var item = allData[i];
          var cocokCabang = item.cabang === cbg;
          var cocokGroup =
            String(item.group || "")
              .trim()
              .toUpperCase() === grp.toUpperCase();

          var cocokTahun = true;
          if (thn) cocokTahun = item.tanggal && item.tanggal.startsWith(thn);

          var cocokBulan = true;
          if (thn && bln)
            cocokBulan =
              item.tanggal && item.tanggal.startsWith(thn + "-" + bln);

          if (cocokCabang && cocokGroup && cocokTahun && cocokBulan) {
            // Dihapus (tidak masuk array)
          } else {
            dataDipertahankan.push(item);
          }
        }

        DBCache.mutasikasir = dataDipertahankan;

        renderKasirDetilTable();
        updateKasirHeaderNominal();
        await hitungSaldoOtomatis();

        if (typeof buildGroupedNoreff === "function") buildGroupedNoreff();
        renderKasirNoreffList();

        toast(
          `✅ Berhasil menghapus ${result.changes} data ${label} dari Server`,
          "ok",
        );
      } catch (err) {
        console.error(err);
        toast("Gagal memproses penghapusan: " + err.message, "err");
      }
    };
}

// ✅ OBJEK LOGIKA IMPORT DBF KASIR (SERVER-SIDE)
const AppImporKasirDBF = {
  API_URL: window.location.origin + "/api/impor-mutasikasir-online",

  getHTML() {
    let opsiCabang = `<option value="" disabled selected>-- Pilih Cabang --</option>`;
    if (typeof DBCache !== "undefined" && DBCache.cabang?.length > 0) {
      DBCache.cabang.forEach((c) => {
        let kode = c.kode_cabang || c.kode || "";
        let nama = c.nama_cabang || c.nama || "";
        if (kode)
          opsiCabang += `<option value="${kode}">${kode} - ${nama}</option>`;
      });
    }

    let opsiTahun = `<option value="">-- Semua Tahun --</option>`;
    let tahunSekarang = new Date().getFullYear();
    for (let y = tahunSekarang; y >= tahunSekarang - 3; y--) {
      opsiTahun += `<option value="${y}">${y}</option>`;
    }

    let opsiBulan = `<option value="">-- Semua Bulan --</option>`;
    const daftarBulan = [
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
    daftarBulan.forEach((b, i) => {
      let val = String(i + 1).padStart(2, "0");
      opsiBulan += `<option value="${val}">${b}</option>`;
    });

    // ✅ PERBAIKAN: PENGAMAN GROUP UNDEFINED
    let rawGroup = localStorage.getItem("group");
    let activeGroupLabel = "TLGA";
    if (
      rawGroup &&
      rawGroup.trim() !== "" &&
      rawGroup.trim().toUpperCase() !== "UNDEFINED"
    ) {
      activeGroupLabel = rawGroup.trim().toUpperCase();
    }

    let daftarGroup = ["TLGA", "TLTA", "KBJ", "SBI"];
    let opsiGroupHtml = daftarGroup
      .map((g) => {
        let sel = g === activeGroupLabel ? "selected" : "";
        return `<option value="${g}" ${sel}>${g}</option>`;
      })
      .join("");

    return `
      <div style="max-width: 500px; padding: 1rem;">
        <div style="margin-bottom: 1rem; font-size:.85rem; color:var(--muted); background:rgba(0,0,0,0.2); padding:.5rem; border-radius:6px;">
          <i class="fa-solid fa-circle-info"></i> Proses import akan berjalan di Server.
        </div>

        <form id="formImporKasirDbf">
          <div class="fg" style="margin-bottom: 1rem;">
            <label>Cabang Tujuan</label>
            <select id="impKasirCab" required class="in">${opsiCabang}</select>
          </div>

          <div class="fg" style="margin-bottom: 1rem;">
            <label>Group Data</label>
            <select id="impKasirGroup" required class="in">${opsiGroupHtml}</select>
          </div>

          <div style="display:flex; gap:.5rem; margin-bottom: 1rem;">
            <div class="fg" style="flex:1; margin-bottom:0">
              <label>Hapus Tahun</label>
              <select id="impKasirThn" class="in">${opsiTahun}</select>
            </div>
            <div class="fg" style="flex:1; margin-bottom:0">
              <label>Hapus Bulan</label>
              <select id="impKasirBln" class="in">${opsiBulan}</select>
            </div>
          </div>
          
          <div class="fg" style="margin-bottom: 1.5rem;">
            <label>Pilih File DBF</label>
            <div style="border: 2px dashed var(--brd); border-radius: 6px; padding: 1.5rem; text-align: center; position:relative; margin-top:.3rem;">
              <input type="file" id="fileDbfKasir" accept=".dbf" required style="position:absolute; inset:0; opacity:0; cursor:pointer;">
              <div id="labelDbfKasir" style="color: var(--muted);">
                <i class="fa-solid fa-file-circle-plus" style="font-size: 2rem; display:block; margin-bottom:.5rem;"></i>
                Klik untuk pilih file .DBF
              </div>
            </div>
          </div>

          <div id="kasirProgressBox" style="display:none; margin-bottom:1.5rem">
            <div style="background:var(--bg);border-radius:8px;height:24px;overflow:hidden;border:1px solid var(--brd);position:relative">
              <div id="kasirProgressBar" style="width:0%;height:100%;background:linear-gradient(90deg,var(--accent),#10b981);transition:width 0.3s;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.75rem"></div>
            </div>
            <div id="kasirProgressText" style="font-size:.8rem;color:var(--muted);margin-top:.3rem;text-align:center">Menunggu...</div>
          </div>

          <div style="display:flex; gap:.5rem; justify-content:flex-end;">
            <button type="button" class="btn btn-g" onclick="closeModal()">Batal</button>
            <button type="submit" id="btnSubmitKasir" class="btn btn-a" style="padding:.5rem 1.5rem;">
              <i class="fa-solid fa-cloud-arrow-up"></i> Upload & Import
            </button>
          </div>
        </form>
      </div>
    `;
  },

  initEvents() {
    const fileInput = document.getElementById("fileDbfKasir");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const label = document.getElementById("labelDbfKasir");
        if (e.target.files.length > 0) {
          label.innerHTML = `<i class="fa-solid fa-file-check" style="font-size: 2rem; display:block; margin-bottom:.5rem; color:var(--success);"></i>${e.target.files[0].name}`;
        }
      });
    }

    const form = document.getElementById("formImporKasirDbf");
    if (form) {
      form.addEventListener("submit", (e) => this.submit(e));
    }
  },

  async submit(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmitKasir");
    const progressBox = document.getElementById("kasirProgressBox");
    const progressBar = document.getElementById("kasirProgressBar");
    const progressText = document.getElementById("kasirProgressText");

    const cabang = document.getElementById("impKasirCab")?.value;
    const groupVal = document.getElementById("impKasirGroup")?.value;
    const hapusThn = document.getElementById("impKasirThn")?.value || "";
    const hapusBln = document.getElementById("impKasirBln")?.value || "";
    const fileDbf = document.getElementById("fileDbfKasir")?.files[0];

    if (!cabang || !fileDbf || !groupVal)
      return toast("Cabang, Group, dan File wajib diisi!", "err");
    if (hapusBln && !hapusThn)
      return toast("Jika pilih bulan, tahun wajib dipilih!", "err");

    try {
      btn.disabled = true;
      btn.innerText = "Memproses...";
      progressBox.style.display = "block";
      progressBar.style.width = "0%";
      progressBar.style.background =
        "linear-gradient(90deg,var(--accent),#10b981)";
      progressText.textContent = "Menghubungi server...";

      const fd = new FormData();
      fd.append("cabang", cabang);
      fd.append("group", groupVal);
      if (hapusThn) fd.append("hapus_tahun", hapusThn);
      if (hapusBln) fd.append("hapus_bulan", hapusBln);
      fd.append("file_dbf", fileDbf);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", this.API_URL);

        let lastLine = "";
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 3) {
            const lines = xhr.responseText.split("\n\n");
            const newLine = lines[lines.length - 2];

            if (
              newLine &&
              newLine.startsWith("data: ") &&
              newLine !== lastLine
            ) {
              lastLine = newLine;
              try {
                const data = JSON.parse(newLine.replace("data: ", ""));

                progressBar.style.width = data.percent + "%";
                progressBar.textContent = data.percent + "%";
                progressText.textContent = data.message;

                if (data.percent === 100) {
                  if (!data.success) {
                    reject(new Error(data.message));
                  } else {
                    resolve(data);
                  }
                }
              } catch (err) {}
            }
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(fd);
      });

      toast("✅ Import DBF Kasir berhasil di Server!", "ok");
      closeModal();

      if (typeof fetchInitialData === "function") await fetchInitialData();

      renderKasirDetilTable();
      updateKasirHeaderNominal();
      await hitungSaldoOtomatis();
      if (typeof buildGroupedNoreff === "function") buildGroupedNoreff();
      renderKasirNoreffList();
    } catch (err) {
      toast("Error: " + err.message, "err");
      progressBar.style.background = "var(--danger)";
      progressText.textContent = "Gagal: " + err.message;
    } finally {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fa-solid fa-cloud-arrow-up"></i> Upload & Import';
    }
  },
};

function promptImportKasirDBF() {
  if (typeof openModal === "function") {
    openModal("Impor DBF Mutasi Kasir (Server)", AppImporKasirDBF.getHTML());
    setTimeout(() => AppImporKasirDBF.initEvents(), 50);
  } else {
    toast("Fungsi Modal tidak ditemukan", "err");
  }
}
