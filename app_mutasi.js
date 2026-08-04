/* ================================================================
   app_mutasi.js — MUTASI TRANSAKSI + PRINT
   ================================================================ */

/* globals getCabangOpts, lookupCabangLabel, uid, esc, fmtN, num, 
   openModal, closeModal, showConfirm, toast, buildTable, 
   refreshCache, DBCache, db */

PANEL_MAP.mutasi = renderMutasi;
AFTER_RENDER.mutasi = initMutasiState;

/* ---------- State ---------- */
// 🌟 PERBAIKAN UTAMA: Tambahkan cabang & group di Session agar semua fungsi membaca sumber yang sama
var _mutSession = { noreff: "", cabang: "", group: "", isLocked: false };

var _mutHandlers = {
  cab: null,
  kb: null,
  tgl: null,
  bulan: null,
  tahun: null,
  filterCabList: null,
};

/* ================================================================
   GENERATOR OPTIONS
   ================================================================ */
function generateKbOpts(cabang, activeGroup, selectedKb) {
  var opts = '<option value="">-- Pilih --</option>';
  var list = Array.isArray(DBCache.kodeBank) ? DBCache.kodeBank : [];

  var filtered = list.filter(function (kb) {
    var matchCabang =
      String(kb.cabang || "").toLowerCase() ===
      String(cabang || "").toLowerCase();
    var matchGroup = (kb.group || "TLGA") === activeGroup;
    return matchCabang && matchGroup;
  });

  for (var i = 0; i < filtered.length; i++) {
    var kb = filtered[i];
    var val = kb.kodebank || "";
    var label = val + " — " + (kb.penjelasan || "");
    var sel = val === (selectedKb || "") ? " selected" : "";
    opts +=
      '<option value="' + esc(val) + '"' + sel + ">" + esc(label) + "</option>";
  }

  if (filtered.length === 0)
    opts =
      '<option value="">Tidak ada Kode Bank untuk Cabang & Group ini</option>';
  return opts;
}

function generatePerkOpts(cabangKode, activeGroup, selectedNoper) {
  var data = Array.isArray(DBCache.perkiraan) ? DBCache.perkiraan : [];

  var filtered = data.filter(function (p) {
    var matchCabang =
      String(p.cabang || "")
        .trim()
        .toLowerCase() ===
      String(cabangKode || "")
        .trim()
        .toLowerCase();
    var matchGroup = (p.group || "TLGA") === activeGroup;
    return matchCabang && matchGroup;
  });

  filtered.sort(function (a, b) {
    return String(a.noPerk || "").localeCompare(
      String(b.noPerk || ""),
      undefined,
      { numeric: true },
    );
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
        esc(p.desc || p.nama_akun || "") +
        "</option>"
      );
    })
    .join("");

  if (filtered.length === 0)
    return '<option value="">Tidak ada No Perkiraan untuk Cabang & Group ini</option>';
  return '<option value="">-- Pilih No Perkiraan --</option>' + opts;
}

function generateBulanOpts(selectedBulan) {
  var now = new Date();
  var defaultBulan = selectedBulan
    ? String(selectedBulan).padStart(2, "0")
    : String(now.getMonth() + 1).padStart(2, "0");
  var daftarNamaBulan = [
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
  var opts = '<option value="">-- Bulan --</option>';
  for (var m = 1; m <= 12; m++) {
    var val = String(m).padStart(2, "0");
    var sel = val === defaultBulan ? " selected" : "";
    opts +=
      '<option value="' +
      val +
      '"' +
      sel +
      ">" +
      daftarNamaBulan[m - 1] +
      "</option>";
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
  var activeGroup = localStorage.getItem("group") || "TLGA";
  el.innerHTML = generateKbOpts(cabangKode, activeGroup, el.value);
}

function populatePerkiraanOpts(cabangKode) {
  var el = $("d_perk");
  if (!el) return;
  var activeGroup = localStorage.getItem("group") || "TLGA";
  el.innerHTML = generatePerkOpts(cabangKode, activeGroup, el.value);
}

function generateNoreff(kodeBank, tanggal, cabangKode) {
  if (!kodeBank || !tanggal) return "";
  var cab = cabangKode || "Pusat";
  var kb = kodeBank.padEnd(4, " ").substring(0, 4);
  var dt = new Date(tanggal);
  var bln = String(dt.getMonth() + 1).padStart(2, "0");
  var thn = String(dt.getFullYear()).substring(2);
  var blnThnTarget = bln + thn;

  var currentPrefix = kb + blnThnTarget;
  var nextUrut = 1;

  var dataRaw = Array.isArray(DBCache.listrefftransaksi)
    ? DBCache.listrefftransaksi
    : [];
  var activeList = dataRaw.filter(function (t) {
    if (!t.noreff || !t.masa) return false;
    if (String(t.cabang || "Pusat").toUpperCase() !== String(cab).toUpperCase())
      return false;
    if (t.masa !== blnThnTarget) return false;
    return true;
  });

  activeList.sort(function (a, b) {
    var numA =
      parseInt((a.noreff || "").substring((a.noreff || "").length - 4), 10) ||
      0;
    var numB =
      parseInt((b.noreff || "").substring((b.noreff || "").length - 4), 10) ||
      0;
    return numA - numB;
  });

  if (activeList.length > 0) {
    var notaTerakhir = activeList[activeList.length - 1];
    var lastNoreff = notaTerakhir.noreff || "";
    if (lastNoreff.length >= 4) {
      var lastUrutStr = lastNoreff.substring(lastNoreff.length - 4);
      var lastUrutByte = parseInt(lastUrutStr, 10) || 0;
      nextUrut = lastUrutByte + 1;
    }
  }

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

  var cabFilterOpts = '<option value="">-- Semua Cabang --</option>';
  if (DBCache.cabang && Array.isArray(DBCache.cabang)) {
    var sortedList = [...DBCache.cabang];
    sortedList.sort(function (a, b) {
      return String(a.kode || "").localeCompare(String(b.kode || ""));
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
    ".scrollable-form-container { max-height: 480px !important; overflow-y: auto !important; padding-right: .5rem; }" +
    ".sticky-sidebar-container { position: sticky !important; top: 0; height: fit-content; }" +
    "</style>" +
    '<div style="padding:.8rem;background:var(--bg2);border:1px solid var(--brd);border-radius:10px;margin-bottom:1rem">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">' +
    '<div style="font-size:.8rem;font-weight:700;color:var(--accent)"><i class="fa-solid fa-file-circle-plus"></i> Header Transaksi</div>' +
    '<div style="display:flex;align-items:center;gap:.5rem">' +
    '<div style="font-size:.75rem;font-weight:700;color:var(--accent)"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat</div>' +
    '<button type="button" class="btn btn-sm" style="font-size:.65rem;padding:2px 6px" onclick="resetToNewTransaction()"><i class="fa-solid fa-plus"></i> Baru</button>' +
    "</div></div>" +
    '<div style="display:flex;gap:1rem;align-items:flex-start">' +
    '<div style="flex:3" class="scrollable-form-container">' +
    '<div style="display:flex;gap:.5rem;margin-bottom:.5rem">' +
    '<div class="fg" style="flex:1"><label>Group <span class="req">*</span></label><select id="m_group" class="in" onchange="localStorage.setItem(\'group\', this.value); var fb = $(\'filter_group_list\'); if(fb) fb.value = this.value; reloadCabangDropdown(); renderNoreffList();">' +
    getGroupOpts(localStorage.getItem("group") || "TLGA") +
    "</select></div></div>" +
    '<div style="display:flex;gap:.5rem;margin-bottom:.5rem;align-items:flex-end">' +
    '<div class="fg" style="flex:1"><label>Cabang</label><select id="m_cab" class="in">' +
    getCabangOpts(
      typeof firstCab !== "undefined" ? firstCab : "",
      localStorage.getItem("group") || "TLGA",
    ) +
    "</select></div>" +
    '<div class="fg" style="flex:1"><label>Kode Bank</label><select id="m_kb" class="in">' +
    kbOpts +
    "</select></div>" +
    '<div class="fg" style="flex:1"><label>Tanggal</label><input id="m_tgl" type="date" class="in" value="' +
    esc(today) +
    '"></div>' +
    '<div class="fg" style="flex:1"><label>No Ref</label><input id="m_noref" class="in" readonly style="background:var(--bg);opacity:.8"></div></div>' +
    '<div style="display:flex;gap:.5rem;margin-bottom:.5rem;align-items:flex-end">' +
    '<div class="fg" style="flex:4;margin-bottom:0"><label>Dari / Kepada <span class="req">*</span></label><input id="m_dkp" class="in" placeholder="Nama pihak terkait"></div>' +
    '<div class="fg" style="flex:2;margin-bottom:0"><label>Nominal / Rp</label><input id="m_nominal" class="in" readonly style="background:var(--bg);font-weight:700;color:var(--success)" value="0"></div>' +
    '<div style="display:flex;gap:.3rem;flex:3">' +
    '<button type="button" class="btn btn-inf" style="flex:1;white-space:nowrap;padding:7px 8px;font-size:.7rem" onclick="openDBFImportModal(\'transaksi\')"><i class="fa-solid fa-file-import"></i> Import</button>' +
    '<button type="button" class="btn btn-r" style="flex:1;white-space:nowrap;padding:7px 8px;font-size:.7rem" onclick="clearAllDataMutasi(\'transaksi\')"><i class="fa-solid fa-trash-can"></i> Kosongkan</button>' +
    "</div></div>" +
    '<div style="margin-top:.8rem;padding-top:.8rem;border-top:1px dashed var(--brd)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">' +
    '<div style="font-size:.8rem;font-weight:700;color:var(--info)"><i class="fa-solid fa-list-ol"></i> Tambah Detil Jurnal</div>' +
    '<div style="display:flex;gap:.3rem">' +
    '<button type="button" class="btn btn-sm" style="background:var(--info);color:#fff;font-size:.7rem;padding:3px 10px" onclick="printMutasi()"><i class="fa-solid fa-print"></i> Print</button>' +
    '<button type="button" class="btn btn-sm btn-r" style="font-size:.7rem;padding:3px 10px" onclick="doDeleteSingleReff()"><i class="fa-solid fa-trash"></i> Hapus 1 Ref</button>' +
    "</div></div>" +
    '<div style="display:flex;gap:.5rem;align-items:flex-end">' +
    '<div class="fg" style="flex:2;margin-bottom:0"><label>No Perkiraan <span class="req">*</span></label><select id="d_perk" class="in">' +
    perkOpts +
    "</select></div>" +
    '<div class="fg" style="flex:3;margin-bottom:0"><label>Penjelasan <span class="req">*</span></label><input id="d_penjelasan" class="in" placeholder="Keterangan transaksi"></div>' +
    '<div class="fg" style="flex:1;margin-bottom:0"><label>Rp <span class="req">*</span></label><input type="number" id="d_rp" class="in" placeholder="0"></div>' +
    '<button class="btn btn-a" onclick="SafeaddDetil()" style="margin-bottom:2px"><i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div></div></div>" +
    '<div style="flex:1;border-left:1px solid var(--brd);padding-left:.8rem;display:flex;flex-direction:column;box-sizing:border-box" class="sticky-sidebar-container">' +
    '<div style="margin-bottom:.4rem"><div class="fg" style="margin-bottom:0"><label style="font-size:.65rem">Filter Group List</label><select id="filter_group_list" class="in" style="font-size:.75rem" onchange="localStorage.setItem(\'group\', this.value); var mg = $(\'m_group\'); if(mg) mg.value = this.value; reloadCabangDropdown(); renderNoreffList();">' +
    getGroupOpts(localStorage.getItem("group") || "TLGA") +
    "</select></div></div>" +
    '<div style="margin-bottom:.4rem"><div class="fg" style="margin-bottom:0"><label style="font-size:.65rem">Filter Cabang List</label><select id="filter_cabang_list" class="in" style="font-size:.75rem" onchange="renderNoreffList();">' +
    '<option value="">-- Semua Cabang --</option>' +
    getCabangOpts("", localStorage.getItem("group") || "TLGA") +
    "</select></div></div>" +
    '<div style="display:flex;gap:.4rem;margin-bottom:.4rem">' +
    '<div class="fg" style="flex:1;margin-bottom:0"><label style="font-size:.65rem">Bulan</label><select id="filter_bulan" class="in" style="font-size:.75rem;padding:3px 5px" onchange="renderNoreffList();">' +
    bulanOpts +
    "</select></div>" +
    '<div class="fg" style="flex:1;margin-bottom:0"><label style="font-size:.65rem">Tahun</label><select id="filter_tahun" class="in" style="font-size:.75rem;padding:3px 5px" onchange="renderNoreffList();">' +
    tahunOpts +
    "</select></div></div>" +
    '<div id="mutNoreffList" style="height:180px;overflow-y:auto;font-size:.8rem;background:var(--bg);border:1px solid var(--brd);border-radius:6px">' +
    '<div style="padding:1rem;color:var(--muted);text-align:center">Memuat data...</div></div>' +
    '<div id="mutNoreffCount" style="font-size:.65rem;color:var(--muted);margin-top:.3rem;text-align:right"></div>' +
    "</div></div>" +
    "<style>#mutDetilTbl { display: block !important; width: 100% !important; max-height: 450px !important; overflow-y: auto !important; border: 1px solid var(--brd); border-radius: 6px; }#mutDetilTbl th { position: sticky !important; top: 0 !important; background: var(--bg2) !important; z-index: 2; }</style>" +
    '<div style="font-size:.85rem;font-weight:700;margin-top:1rem;margin-bottom:.4rem">Riwayat Detil Transaksi</div>' +
    '<div id="mutDetilTbl" class="tw"></div></div>'
  );
}

function initMutasiState() {
  // 🌟 PERBAIKAN: Reset state lengkap
  _mutSession = { noreff: "", cabang: "", group: "", isLocked: false };

  var cabEl = $("m_cab");
  var kbEl = $("m_kb");
  var tglEl = $("m_tgl");
  var bulanEl = $("filter_bulan");
  var tahunEl = $("filter_tahun");
  var filterCabListEl = $("filter_cabang_list");

  if (!cabEl) return;

  if (_mutHandlers.cab) cabEl.removeEventListener("change", _mutHandlers.cab);
  if (_mutHandlers.kb) kbEl.removeEventListener("change", _mutHandlers.kb);
  if (_mutHandlers.tgl) tglEl.removeEventListener("change", _mutHandlers.tgl);
  if (_mutHandlers.bulan)
    bulanEl.removeEventListener("change", _mutHandlers.bulan);
  if (_mutHandlers.tahun)
    tahunEl.removeEventListener("change", _mutHandlers.tahun);
  if (_mutHandlers.filterCabList && filterCabListEl)
    filterCabListEl.removeEventListener("change", _mutHandlers.filterCabList);

  _mutHandlers.cab = onCabangChange;
  _mutHandlers.kb = onKbChange;
  _mutHandlers.tgl = onHeaderChange;
  _mutHandlers.bulan = onFilterChange;
  _mutHandlers.tahun = onFilterChange;
  _mutHandlers.filterCabList = onFilterChange;

  cabEl.addEventListener("change", _mutHandlers.cab);
  kbEl.addEventListener("change", _mutHandlers.kb);
  tglEl.addEventListener("change", _mutHandlers.tgl);
  bulanEl.addEventListener("change", _mutHandlers.bulan);
  tahunEl.addEventListener("change", _mutHandlers.tahun);
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
  _mutSession = { noreff: "", cabang: "", group: "", isLocked: false };
  $("m_kb").disabled = false;
  $("m_tgl").disabled = false;
  $("m_cab").disabled = false;
  $("m_noref").value = "";
  $("m_nominal").value = "0";
  renderDetilTable();
  updateMutasiSummary();
  onHeaderChange();
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
  if (kb && tgl && cab) {
    var newNoref = generateNoreff(kb, tgl, cab);
    $("m_noref").value = newNoref;
    _mutSession.noreff = newNoref;
    _mutSession.cabang = cab; // 🌟 Sync session saat bikin noreff baru
    _mutSession.group = localStorage.getItem("group") || "TLGA";
    updateMutasiSummary();
  }
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
  // 🌟 PERBAIKAN: Pakai _mutSession.cabang
  var activeGroup =
    _mutSession.group || localStorage.getItem("group") || "TLGA";
  var activeCab = _mutSession.cabang || ($("m_cab") ? $("m_cab").value : "");

  var transaksiList = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];
  var d = transaksiList.find(function (t) {
    return (
      t.id === id &&
      (t.group || "TLGA") === activeGroup &&
      String(t.cabang || "").toUpperCase() === String(activeCab).toUpperCase()
    );
  });

  if (!d)
    return toast(
      "Data tidak ditemukan atau Anda tidak memiliki akses ke cabang ini!",
      "err",
    );

  var perkOpts = generatePerkOpts(activeCab, d.noperkiraan);
  openModal(
    "Edit Detil Jurnal",
    '<div class="fg"><label>No Perkiraan</label><select id="ed_perk">' +
      perkOpts +
      "</select></div>" +
      '<div class="fg"><label>Penjelasan</label><input id="ed_penjelasan" value="' +
      esc(d.desc || d.keterangan || "") +
      '"></div>' +
      '<div class="fg"><label>Rp</label><input type="number" id="ed_rp" value="' +
      (d.total || d.db || 0) +
      '"></div>',
    '<button class="btn btn-g" onclick="closeModal()">Batal</button><button class="btn btn-a" onclick="event.preventDefault(); event.stopPropagation(); saveEditDetil(\'' +
      id +
      "')\">Update</button>",
  );
}

function updateMutasiSummary() {
  var noreff = _mutSession.noreff;
  if (!noreff) return;

  // 🌟 PERBAIKAN: Pakai _mutSession
  var activeGroup =
    _mutSession.group || localStorage.getItem("group") || "TLGA";
  var activeCabang = _mutSession.cabang || ($("m_cab") ? $("m_cab").value : "");

  var totalDb = 0,
    totalCr = 0;
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  transaksi.forEach(function (t) {
    if (
      t.noreff === noreff &&
      (t.group || "TLGA") === activeGroup &&
      String(t.cabang || "").toUpperCase() ===
        String(activeCabang).toUpperCase()
    ) {
      totalDb += num(t.db || t.total || 0);
      totalCr += num(t.cr || 0);
    }
  });

  if ($("m_total_db")) $("m_total_db").value = fmtN(totalDb);
  if ($("m_total_cr")) $("m_total_cr").value = fmtN(totalCr);
  if ($("m_selisih")) $("m_selisih").value = fmtN(Math.abs(totalDb - totalCr));
}

function resetToNewTransaction() {
  // 🌟 PERBAIKAN: Reset state lengkap
  _mutSession = { noreff: "", cabang: "", group: "", isLocked: false };

  if ($("m_cab")) $("m_cab").disabled = false;
  if ($("m_kb")) $("m_kb").disabled = false;
  if ($("m_tgl")) $("m_tgl").disabled = false;
  if ($("m_noref")) $("m_noref").value = "";
  if ($("m_dkp")) $("m_dkp").value = "";
  if ($("m_nominal")) $("m_nominal").value = "0";

  if (typeof onHeaderChange === "function") onHeaderChange();
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
  if (angka < 12) hasil = satuan[angka];
  else if (angka < 20) hasil = satuan[angka - 10] + " Belas";
  else if (angka < 100)
    hasil =
      terbilang(Math.floor(angka / 10)) +
      " Puluh" +
      (angka % 10 ? " " + satuan[angka % 10] : "");
  else if (angka < 200)
    hasil = "Seratus" + (angka % 100 ? " " + terbilang(angka % 100) : "");
  else if (angka < 1000)
    hasil =
      terbilang(Math.floor(angka / 100)) +
      " Ratus" +
      (angka % 100 ? " " + terbilang(angka % 100) : "");
  else if (angka < 2000)
    hasil = "Seribu" + (angka % 1000 ? " " + terbilang(angka % 1000) : "");
  else if (angka < 1000000)
    hasil =
      terbilang(Math.floor(angka / 1000)) +
      " Ribu" +
      (angka % 1000 ? " " + terbilang(angka % 1000) : "");
  else if (angka < 1000000000)
    hasil =
      terbilang(Math.floor(angka / 1000000)) +
      " Juta" +
      (angka % 1000000 ? " " + terbilang(angka % 1000000) : "");
  else if (angka < 1000000000000)
    hasil =
      terbilang(Math.floor(angka / 1000000000)) +
      " Miliar" +
      (angka % 1000000000 ? " " + terbilang(angka % 1000000000) : "");
  return n < 0 ? "Minus " + hasil : hasil;
}

function showConfirm1(message, onYes) {
  var footerHtml =
    '<button class="btn btn-g" onclick="closeModal()">Batal</button><button class="btn btn-r" id="btnConfirmAction">Ya, Lanjutkan</button>';
  openModal(
    "Konfirmasi",
    '<div style="font-size:0.9rem">' + esc(message) + "</div>",
    footerHtml,
  );
  setTimeout(function () {
    var btnYes = document.getElementById("btnConfirmAction");
    if (btnYes)
      btnYes.onclick = function () {
        closeModal();
        if (typeof onYes === "function") onYes();
      };
  }, 50);
}

async function SafeaddDetil() {
  var noreff = _mutSession.noreff || $("m_noref").value;
  var activeCabang = $("m_cab") ? $("m_cab").value : "";
  var activeGroup = localStorage.getItem("group") || "TLGA";

  if (!noreff || !activeCabang || !$("m_kb").value || !$("m_tgl").value) {
    return toast(
      "Isi data header (No Ref, Cabang, Kode Bank, Tanggal) secara lengkap terlebih dahulu",
      "err",
    );
  }

  var noper = $("d_perk").value;
  var penjelasan = $("d_penjelasan").value.trim();
  var rp = num($("d_rp").value);
  if (!noper || !penjelasan || rp <= 0)
    return toast("No Perkiraan, Penjelasan, dan Rp wajib diisi!", "err");

  _mutSession.isLocked = true;
  _mutSession.cabang = activeCabang; // 🌟 LOCK CABANG KE SESSION
  _mutSession.group = activeGroup; // 🌟 LOCK GROUP KE SESSION
  $("m_cab").disabled = true;
  $("m_kb").disabled = true;
  $("m_tgl").disabled = true;

  try {
    var rawDate = $("m_tgl").value;
    var calculatedMasa = "";
    if (rawDate && rawDate.includes("-")) {
      var parts = rawDate.split("-");
      calculatedMasa = parts[1] + parts[0].substring(2, 4);
    }

    var newDetil = {
      id: uid(),
      noreff: noreff,
      tanggal: rawDate,
      kodeBank: $("m_kb").value,
      cabang: activeCabang,
      dariKePada: $("m_dkp").value.trim(),
      noperkiraan: noper,
      desc: penjelasan,
      total: rp,
      db: rp,
      cr: 0,
      kodeTrans: "BM",
      group: activeGroup,
      masa: calculatedMasa,
    };

    await fetch(window.location.origin + "/api/data/transaksi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDetil),
    });
    if (!DBCache.transaksi) DBCache.transaksi = [];
    DBCache.transaksi.push(newDetil);

    if (!DBCache.listrefftransaksi) DBCache.listrefftransaksi = [];
    var isReffExist = DBCache.listrefftransaksi.some(function (r) {
      return (
        r.noreff === noreff &&
        (r.group || "TLGA") === activeGroup &&
        r.cabang === activeCabang
      );
    });

    if (!isReffExist) {
      var newReffObj = {
        id: "REF_" + Math.random().toString(36).substring(2, 9),
        noreff: noreff,
        masa: calculatedMasa,
        cabang: activeCabang,
        group: activeGroup,
      };
      await fetch(window.location.origin + "/api/data/listrefftransaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReffObj),
      });
      DBCache.listrefftransaksi.push(newReffObj);
    }

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
  var activeGroup =
    _mutSession.group || localStorage.getItem("group") || "TLGA";
  var activeCabang = _mutSession.cabang || ($("m_cab") ? $("m_cab").value : "");

  var dataLama = DBCache.transaksi
    ? DBCache.transaksi.find(function (t) {
        return (
          t.id === id &&
          (t.group || "TLGA") === activeGroup &&
          t.cabang === activeCabang
        );
      })
    : null;
  if (!dataLama)
    return toast(
      "Data tidak ditemukan atau Anda tidak memiliki akses ke data cabang ini!",
      "err",
    );

  var noper = $("ed_perk").value;
  var penjelasan = $("ed_penjelasan").value.trim();
  var rp = num($("ed_rp").value);
  if (!noper || !penjelasan || rp <= 0)
    return toast("Field wajib tidak boleh kosong!", "err");

  try {
    var objUpdate = Object.assign({}, dataLama, {
      noperkiraan: noper,
      desc: penjelasan,
      total: rp,
      db: rp,
      cabang: activeCabang,
      group: activeGroup,
    });
    await fetch(window.location.origin + "/api/data/transaksi/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(objUpdate),
    });
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

  // 🌟 PERBAIKAN: Pakai Session
  var activeGroup =
    _mutSession.group || localStorage.getItem("group") || "TLGA";
  var activeCabang = _mutSession.cabang || ($("m_cab") ? $("m_cab").value : "");
  var targetNoreff = _mutSession.noreff;

  try {
    await fetch(window.location.origin + "/api/data/transaksi/" + id, {
      method: "DELETE",
    });
    if (Array.isArray(DBCache.transaksi))
      DBCache.transaksi = DBCache.transaksi.filter(function (t) {
        return t.id !== id;
      });

    var sisaDetil = (DBCache.transaksi || []).filter(function (t) {
      return (
        t.noreff === targetNoreff &&
        (t.group || "TLGA") === activeGroup &&
        t.cabang === activeCabang
      );
    }).length;

    if (sisaDetil === 0) {
      _mutSession.isLocked = false;
      if ($("m_cab")) $("m_cab").disabled = false;
      if ($("m_kb")) $("m_kb").disabled = false;
      if ($("m_tgl")) $("m_tgl").disabled = false;
      if ($("m_nominal")) $("m_nominal").value = "0";

      var reffCacheList = Array.isArray(DBCache.listrefftransaksi)
        ? DBCache.listrefftransaksi
        : [];
      var reffTargetObj = reffCacheList.find(function (r) {
        return (
          r.noreff === targetNoreff &&
          (r.group || "TLGA") === activeGroup &&
          r.cabang === activeCabang
        );
      });

      if (reffTargetObj && reffTargetObj.id) {
        await fetch(
          window.location.origin +
            "/api/data/listrefftransaksi/" +
            reffTargetObj.id,
          { method: "DELETE" },
        );
        DBCache.listrefftransaksi = reffCacheList.filter(function (r) {
          return r.id !== reffTargetObj.id;
        });
      }
    }

    renderDetilTable();
    updateHeaderNominal();
    renderNoreffList();
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

  // 🌟 PERBAIKAN: Pakai Session
  var activeGroup =
    _mutSession.group || localStorage.getItem("group") || "TLGA";
  var activeCabang = _mutSession.cabang || ($("m_cab") ? $("m_cab").value : "");

  var totalRp = 0;
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];
  transaksi.forEach(function (t) {
    if (
      t.noreff === noreff &&
      (t.group || "TLGA") === activeGroup &&
      String(t.cabang || "") === String(activeCabang)
    ) {
      totalRp += num(t.total || t.db || 0);
    }
  });
  $("m_nominal").value = fmtN(totalRp);
}

function renderDetilTable() {
  var noreff = _mutSession.noreff;
  // 🌟 PERBAIKAN: Pakai Session
  var activeCab = _mutSession.cabang || ($("m_cab") ? $("m_cab").value : "");
  var activeGroup =
    _mutSession.group || localStorage.getItem("group") || "TLGA";
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  var detilData = [];
  if (noreff && activeCab) {
    detilData = transaksi.filter(function (t) {
      return (
        t.noreff === noreff &&
        String(t.cabang || "") === String(activeCab) &&
        (t.group || "TLGA") === activeGroup
      );
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
      '<span style="font-weight:600">' + fmtN(r.total || r.db || 0) + "</span>",
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
        '\'); return false;"><i class="fa-solid fa-trash"></i></button>',
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

// 🌟 FUNGSI TAMBAHAN UNTUK MENDUKUNG PERUBAHAN DIATAS (Jika belum ada di file lain)
function reloadCabangDropdown() {
  var group = localStorage.getItem("group") || "TLGA";
  if ($("m_cab")) $("m_cab").innerHTML = getCabangOpts("", group);
  if ($("filter_cabang_list"))
    $("filter_cabang_list").innerHTML =
      '<option value="">-- Semua Cabang --</option>' + getCabangOpts("", group);
}

// ✅ DARI FILE BARU: FUNGSI LENGKAP clearAllDataMutasi (DENGAN FILTER MODAL & BATCH)
async function clearAllDataMutasi(storeName) {
  var labelMap = {
    transaksi: "Transaksi",
    mutasikasir: "Mutasi Kasir", // Tambahkan label mutasikasir sekalian agar dinamis
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

    // 🔥 PERBAIKAN GROUP: Ambil dari localStorage aktif (Contoh: "TLGA") agar sinkron ke server
    var activeGroup = localStorage.getItem("group") || "TLGA";

    var calculatedMasaRef = "";
    if (bln && thn) {
      calculatedMasaRef = bln + String(thn).substring(2, 4);
    }

    var infoFilter = `\nBulan: ${bln || "Semua"}\nTahun: ${thn || "Semua"}\nCabang: ${cbg || "Semua"}\nGroup: ${activeGroup}${calculatedMasaRef ? "\nMasa Ref: " + calculatedMasaRef : ""}`;

    if (
      !confirm(
        "PERINGATAN!\n\nData " +
          label +
          " beserta Referensi Transaksi terkait dengan kriteria berikut akan dihapus secara permanen di Browser dan Server:" +
          infoFilter +
          "\n\nLanjutkan?",
      )
    ) {
      return;
    }

    closeModal();
    toast("Menghubungi server untuk menghapus data...", "inf");

    try {
      var formatMasa = thn && bln ? `${thn}-${bln}` : thn || "";

      // 1. PROSES SERVER: Kirim parameter hapus ke backend
      var serverResponse = await fetch("/api/clear-all-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeName: storeName,
          masa: formatMasa,
          cabang: cbg || "ALL",
          tahun: thn,
          bulan: bln,
          group: activeGroup, // 🔥 Diubah dari "TRANSAKSI" menjadi activeGroup ("TLGA")
          masaRef: calculatedMasaRef || null,
        }),
      });

      if (!serverResponse.ok) {
        var errData = await serverResponse.json();
        throw new Error(
          errData.message || "Gagal menghapus data di server database",
        );
      }

      var serverResult = await serverResponse.json();

      // 2. PROSES LOCAL BROWSER (IndexedDB untuk store utama)
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

      // 🌟 3. BERSIHKAN CACHE LOKAL BROWSER: listrefftransaksi
      // Mengubah filter agar mencocokkan logic penghapusan database backend secara akurat
      var targetCacheRef =
        storeName === "mutasikasir" ? "listreffkasir" : "listrefftransaksi";

      if (DBCache[targetCacheRef] && Array.isArray(DBCache[targetCacheRef])) {
        DBCache[targetCacheRef] = DBCache[targetCacheRef].filter(
          function (ref) {
            var cocokCabangRef = !cbg || ref.cabang === cbg;
            var cocokGroupRef =
              String(ref.group || "")
                .trim()
                .toUpperCase() === activeGroup.toUpperCase();

            var cocokMasaRef = true;
            if (calculatedMasaRef) {
              cocokMasaRef = ref.masa === calculatedMasaRef;
            } else if (thn) {
              var shortThn = String(thn).substring(2, 4);
              cocokMasaRef = ref.masa && ref.masa.endsWith(shortThn);
            }

            // Jika kriteria COCOK dengan filter hapus, return FALSE agar dibuang dari cache
            var isDataYangDihapus =
              cocokCabangRef && cocokGroupRef && cocokMasaRef;
            return !isDataYangDihapus;
          },
        );
      }

      toast(
        `${serverResult.changes || dataDihapusCount} data ${label} & tabel referensi berhasil dibersihkan`,
        "ok",
      );
      safeRenderCurrentPanel();
    } catch (err) {
      toast("Gagal memproses penghapusan data: " + err.message, "err");
    }
  };
}

async function renderNoreffList() {
  var box = $("mutNoreffList");
  var countBox = $("mutNoreffCount");
  if (!box) return;

  var filterCabang = $("filter_cabang_list")
    ? $("filter_cabang_list").value
    : "";
  var filterBulan = $("filter_bulan") ? $("filter_bulan").value : "";
  var filterTahun = $("filter_tahun") ? $("filter_tahun").value : "";
  var activeGroup = localStorage.getItem("group") || "TLGA";

  // 🔄 1. AMBIL DATA LANGSUNG DARI TABEL listrefftransaksi
  try {
    var response = await fetch(
      `/api/data/listrefftransaksi?cabang=${filterCabang}&group=${activeGroup}`,
    );
    if (response.ok) {
      DBCache.listrefftransaksi = await response.json();
    }
  } catch (err) {
    console.error("Gagal sinkronisasi data listrefftransaksi ke cache:", err);
  }

  var data = Array.isArray(DBCache.listrefftransaksi)
    ? DBCache.listrefftransaksi
    : [];

  // 🔍 2. PROSES FILTERING DATA BERDASARKAN PARAMETER FILTER AKTIF
  var filtered = data.filter(function (t) {
    if (!t.noreff) return false;

    // Validasi kecocokan Group
    if ((t.group || "TLGA") !== activeGroup) return false;

    // Filter Cabang (Mendukung "PUSAT", "", atau Null)
    if (filterCabang && filterCabang.toUpperCase() !== "PUSAT") {
      if (
        String(t.cabang || "").toUpperCase() !==
        String(filterCabang).toUpperCase()
      ) {
        return false;
      }
    }

    // Filter Berdasarkan Kolom 'masa' Fisik (Format: MMYY, Contoh: "0824")
    if (filterBulan || filterTahun) {
      var targetMasa = "";
      var userBln = filterBulan ? filterBulan.padStart(2, "0") : "";
      var userThn = filterTahun ? String(filterTahun).substring(2, 4) : "";

      if (t.masa && t.masa.length === 4) {
        var dataBln = t.masa.substring(0, 2);
        var dataThn = t.masa.substring(2, 4);

        if (userBln && dataBln !== userBln) return false;
        if (userThn && dataThn !== userThn) return false;
      } else {
        // Fallback jika kolom masa kosong tetapi ada properti tanggal pembantu di objek
        if (t.tanggal) {
          var fallbackBln = t.tanggal.substring(5, 7);
          var fallbackThn = t.tanggal.substring(0, 4);
          if (userBln && fallbackBln !== userBln) return false;
          if (filterTahun && fallbackThn !== filterTahun) return false;
        } else {
          return false; // Buang data jika tidak memiliki info waktu sama sekali
        }
      }
    }
    return true;
  });

  // JIKA HASIL FILTER KOSONG
  if (filtered.length === 0) {
    box.innerHTML =
      '<div style="padding:.8rem;color:var(--muted);text-align:center;font-size:.75rem"><i class="fa-solid fa-filter-circle-xmark"></i> Tidak ada data referensi<br><small>Group: ' +
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

  // 📊 3. URUTKAN DAFTAR REFERENSI
  filtered.sort(function (a, b) {
    var suffixA = String(a.noreff || "").slice(-8);
    var suffixB = String(b.noreff || "").slice(-8);
    return suffixA.localeCompare(suffixB, undefined, { numeric: true });
  });

  // 🖌️ 4. RENDER HTML TABLE TO FRONTEND
  // 🖌️ 4. RENDER HTML TABLE TO FRONTEND (Menggunakan Sistem Klik Mandiri)
  var html =
    '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2);position:sticky;top:0;z-index:1"><th style="padding:4px;text-align:left;font-size:.65rem">No Referensi Transaksi</th><th style="padding:4px;text-align:center;font-size:.65rem;width:45px">Masa</th><th style="padding:4px;text-align:right;font-size:.65rem;width:50px">Cabang</th></tr></thead><tbody>';

  filtered.forEach(function (item) {
    // Kita beri ID unik di setiap baris berdasarkan Noreff + Cabang
    //  var rowUniqueId = "row_" + (item.noreff || "") + "_" + (item.cabang || "");
    var rowUniqueId =
      "row_" +
      (item.noreff || "") +
      "_" +
      (item.cabang || "") +
      "_" +
      (item.group || "");

    // Style dasar (tanpa warna biru di sini)
    var rowStyle =
      "cursor:pointer;border-bottom:1px solid var(--brd);transition:background .15s;";

    // Parameter onclick: Selain menjalankan fungsi Anda, kita tambahkan script JS langsung
    // untuk menghapus warna semua baris lain, lalu mewarnai baris yang diklik.
    html +=
      '<tr id="' +
      rowUniqueId +
      '" style="' +
      rowStyle +
      "\" onclick=\"clearAllReffColors(); this.style.background='var(--accent)'; this.style.color='#fff'; this.style.fontWeight='600'; onNoreffClicked('" +
      esc(item.noreff) +
      "', '" +
      esc(item.cabang || "") +
      "')\" >";

    // Kolom 1: Nomor Referensi Fisik
    html +=
      '<td style="padding:4px;font-size:.7rem;font-family:monospace;font-weight:bold">' +
      esc(item.noreff) +
      "</td>";

    // Kolom 2: Kode Masa (MMYY)
    html +=
      '<td style="padding:4px;font-size:.65rem;text-align:center;color:var(--muted)">' +
      esc(item.masa || "-") +
      "</td>";

    // Kolom 3: Kode Cabang Fisik
    html +=
      '<td style="padding:4px;font-size:.65rem;text-align:right;font-weight:600;padding-right:8px">' +
      esc(item.cabang || "-") +
      "</td></tr>";
  });

  html += "</tbody></table>";
  box.innerHTML = html;

  if (countBox) countBox.textContent = filtered.length + " referensi";
}

// Tambahkan parameter clickedCabang dan clickedGroup
async function onNoreffClicked(noreffTarget, clickedCabang, clickedGroup) {
  if (
    noreffTarget === _mutSession.noreff &&
    _mutSession.cabang === clickedCabang &&
    _mutSession.group === clickedGroup
  ) {
    // <--- TAMBAHKAN INI
    return;
  }
  var cacheSource = Array.isArray(DBCache.listrefftransaksi)
    ? DBCache.listrefftransaksi
    : [];

  // 🔄 CARI DATA MENGGUNAKAN PATOKAN YANG PASTI (DARI KLIK LANGSUNG)
  var headerData = cacheSource.find(function (t) {
    return (
      t.noreff === noreffTarget &&
      String(t.cabang || "") === String(clickedCabang || "") && // Langsung cocokkan dengan yang diklik
      (t.group || "TLGA") === (clickedGroup || "TLGA")
    );
  });

  // Debug Log (Sekarang harusnya benar)
  if (headerData) {
    console.log("🟢 Data BENAR yang diklik:", {
      noreff: headerData.noreff,
      cabang: headerData.cabang,
      group: headerData.group,
    });
  } else {
    console.warn("⚠️ Data tidak ditemukan!");
  }

  if (!headerData) return;

  try {
    toast("Memuat detail jurnal...", "info");

    // 🌟 PASTIKAN FETCH JUGA MENGGUNAKAN CABANG YANG SAMA PERSIS
    var response = await fetch(
      `/api/data/transaksi?search=${encodeURIComponent(noreffTarget)}&cabang=${headerData.cabang}&group=${headerData.group}`,
    );
    // ... kode di bawahnya biarkan tetap sama ...

    if (response.ok) {
      // Ganti isi DBCache.transaksi murni hanya dengan baris detail milik nota aktif ini
      DBCache.transaksi = await response.json();
    } else {
      DBCache.transaksi = [];
    }
  } catch (err) {
    console.error("🔥 Gagal memuat data transaksi spesifik:", err);
    DBCache.transaksi = [];
  }

  // 📝 MASUKKAN DATA HEADER KE INPUT FORM LAYAR
  // 📝 MASUKKAN DATA HEADER KE INPUT FORM LAYAR
  _mutSession.noreff = noreffTarget;
  _mutSession.cabang = headerData.cabang;
  _mutSession.group = headerData.group || "TLGA"; // <--- TAMBAHKAN INI JUGA
  _mutSession.isLocked = true;

  $("m_noref").value = noreffTarget;
  $("m_tgl").value =
    headerData.tanggal ||
    (DBCache.transaksi[0] ? DBCache.transaksi[0].tanggal : "");
  $("m_cab").value = headerData.cabang || "";

  // Ambil kode bank dan dkp dari baris transaksi yang berhasil di-load jika di listreff kosong
  var firstRow = DBCache.transaksi[0] || {};
  $("m_kb").value = headerData.kodeBank || firstRow.kodeBank || "";
  $("m_dkp").value = headerData.dariKePada || firstRow.dariKePada || "";

  // Kunci form header agar tidak bisa diedit sembarangan
  $("m_cab").disabled = true;
  $("m_kb").disabled = true;
  $("m_tgl").disabled = true;

  // Kirim data cabang untuk memperbarui opsi dropdown bank & perkiraan
  populateKodeBankOpts(headerData.cabang);
  populatePerkiraanOpts(headerData.cabang);

  // 🔄 RE-RENDER ELEMEN LAYAR
  updateHeaderNominal();
  renderDetilTable(); // Menggambar baris detail jurnal yang baru di-fetch
  renderNoreffList(); // Berikan efek highlight aktif di panel riwayat kanan
  updateMutasiSummary(); // Hitung balance saldo debet/kredit untuk nota ini
}

function printMutasi() {
  var noreff = _mutSession.noreff || $("m_noref").value;
  if (!noreff)
    return toast(
      "Pilih transaksi terlebih dahulu (klik No Ref di riwayat)",
      "wrn",
    );

  // 🔄 PERBAIKAN: Ambil Group dan Cabang dari Session, BUKAN dari Form atau LocalStorage
  // Ini memastikan yang dicetak adalah data yang SEDANG DITAMPILKAN di layar,
  // walauapun form input keburu di-lock atau berubah.
  var activeGroup =
    _mutSession.group || localStorage.getItem("group") || "TLGA";
  var activeCabang = _mutSession.cabang || ($("m_cab") ? $("m_cab").value : "");

  // 📝 Detail baris jurnal TETAP diambil dari cache transaksi utama (untuk nominal & akun)
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  var detilData = transaksi.filter(function (t) {
    return (
      t.noreff === noreff &&
      (t.group || "TLGA") === activeGroup &&
      String(t.cabang || "").toUpperCase() ===
        String(activeCabang).toUpperCase()
    );
  });

  if (detilData.length === 0)
    return toast(
      "Tidak ada detil jurnal untuk No Ref, Group & Cabang ini",
      "wrn",
    );

  // 🌟 FIX HEADER: Ambil data header langsung dari nilai input FORM LAYAR AKTIF yang sedang dibuka
  var cabangLabel = lookupCabangLabel(activeCabang) || activeCabang || "-";
  var tanggal = $("m_tgl") ? $("m_tgl").value : "-";
  var kodeBank = $("m_kb") ? $("m_kb").value : "-";
  var dariKePada = $("m_dkp") ? $("m_dkp").value : "-";

  var totalRp = 0;
  detilData.forEach(function (t) {
    totalRp += num(t.total || t.db || t.cr || 0);
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
      esc(d.noperkiraan || d.noPerk || "-") +
      "</td><td>" +
      esc(d.desc || d.keterangan || "-") +
      "</td><td class='rp'>" +
      fmtN(d.total || d.db || d.cr || 0) +
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

  setTimeout(function () {
    printWindow.print();
  }, 500);
}
async function doDeleteSingleReff() {
  // 🔄 1. AMBIL 3 INDIKATOR UTAMA DARI SESSION
  var currentNoreff =
    (typeof _mutSession !== "undefined" ? _mutSession.noreff : null) || null;
  var currentCabang =
    (typeof _mutSession !== "undefined" ? _mutSession.cabang : null) || "";
  var currentGroup =
    (typeof _mutSession !== "undefined" ? _mutSession.group : null) || "TLGA";

  if (!currentNoreff) {
    toast(
      "Pilih data transaksi di tabel riwayat kanan terlebih dahulu!",
      "err",
    );
    return;
  }

  // Tambahkan info Cabang & Group di pesan konfirmasi agar user yakin menghapus data yang tepat
  if (
    !confirm(
      "Apakah Anda yakin ingin menghapus TOTAL data transaksi untuk:\n\nNo Ref : " +
        currentNoreff +
        "\nCabang : " +
        (currentCabang || "Semua") +
        "\nGroup  : " +
        currentGroup +
        "\n\n?",
    )
  ) {
    return;
  }

  try {
    toast("Sedang menghapus data mutasi...", "info");

    // 🔄 2. FILTER HAPUS DETAIL TRANSAKSI (Sesuai Noreff + Cabang + Group)
    var transaksiData = Array.isArray(DBCache.transaksi)
      ? DBCache.transaksi
      : [];
    var itemsToDelete = transaksiData.filter(function (t) {
      return (
        t.noreff === currentNoreff &&
        (t.group || "TLGA") === currentGroup &&
        String(t.cabang || "").toUpperCase() ===
          String(currentCabang || "").toUpperCase()
      );
    });

    // 3. HAPUS BARIS MUTASI UTAMA SATU PER SATU KE SERVER
    if (itemsToDelete.length > 0) {
      for (var i = 0; i < itemsToDelete.length; i++) {
        var targetId = itemsToDelete[i].id;
        var response = await fetch("/api/data/transaksi/" + targetId, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error(
            "Gagal menghapus detail baris mutasi ID: " + targetId,
          );
        }
      }
    }

    // 🌟 4. HAPUS KODE REFERENSI DARI TABEL listrefftransaksi (Sesuai Noreff + Cabang + Group)
    var reffCacheList = Array.isArray(DBCache.listrefftransaksi)
      ? DBCache.listrefftransaksi
      : [];
    var reffTargetObj = reffCacheList.find(function (r) {
      return (
        r.noreff === currentNoreff &&
        (r.group || "TLGA") === currentGroup &&
        String(r.cabang || "").toUpperCase() ===
          String(currentCabang || "").toUpperCase()
      );
    });

    if (reffTargetObj && reffTargetObj.id) {
      var deleteReffResponse = await fetch(
        "/api/data/listrefftransaksi/" + reffTargetObj.id,
        {
          method: "DELETE",
        },
      );
      if (!deleteReffResponse.ok) {
        console.warn(
          "⚠️ Gagal menghapus kunci referensi fisik di server, baris dilewati.",
        );
      }
    }

    // 🔄 5. MANUAL CACHE UPDATE (Hanya menghapus yang cocok di memory browser)
    DBCache.transaksi = transaksiData.filter(function (t) {
      return !(
        t.noreff === currentNoreff &&
        (t.group || "TLGA") === currentGroup &&
        String(t.cabang || "").toUpperCase() ===
          String(currentCabang || "").toUpperCase()
      );
    });

    DBCache.listrefftransaksi = reffCacheList.filter(function (r) {
      return !(
        r.noreff === currentNoreff &&
        (r.group || "TLGA") === currentGroup &&
        String(r.cabang || "").toUpperCase() ===
          String(currentCabang || "").toUpperCase()
      );
    });

    // 6. Kosongkan kembali form input layar
    if (typeof resetToNewTransaction === "function") {
      resetToNewTransaction();
    } else {
      if ($("m_noref")) $("m_noref").value = "";
      if ($("m_dkp")) $("m_dkp").value = "";
      if ($("m_nominal")) $("m_nominal").value = "0";
      if ($("mutDetilTbl")) $("mutDetilTbl").innerHTML = "";
    }

    // 7. Gambar ulang panel daftar riwayat di sebelah kanan layar
    if (typeof renderNoreffList === "function") {
      renderNoreffList();
    }

    toast(
      "Transaksi " +
        currentNoreff +
        " (Cabang " +
        (currentCabang || "-") +
        ") berhasil dihapus total!",
      "ok",
    );
  } catch (err) {
    console.error("🔥 GAGAL HAPUS 1 REFF TRANS:", err.message);
    toast("Gagal menghapus transaksi: " + err.message, "err");
  }
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
    // '<button type="button" class="btn btn-sm" style="font-size:.65rem;padding:2px 6px; background:#6366f1; border-color:#6366f1; color:#fff;" onclick="promptImportKasirDBF()"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'mutasikasir\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
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

  // ✅ PENGAMAN GROUP UNDEFINED
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
    // 🛠️ DEBUG 1: Cek isi elemen DOM HTML awal
    var elTgl = $("mk_tgl");
    var elCab = $("mk_cab");
    console.log(
      "🔍 [DEBUG DOM] Elemen Tanggal:",
      elTgl ? elTgl.value : "TIDAK DITEMUKAN",
    );
    console.log(
      "🔍 [DEBUG DOM] Elemen Cabang:",
      elCab ? elCab.value : "TIDAK DITEMUKAN",
    );

    var tanggalRaw = elTgl ? elTgl.value : "";
    var computedMasa = "";

    // ✅ EKSTRAKSI MASA YANG AMAN
    if (tanggalRaw && tanggalRaw.trim() !== "") {
      var d = new Date(tanggalRaw);
      if (!isNaN(d.getTime())) {
        var bulan = String(d.getMonth() + 1).padStart(2, "0");
        var tahun = String(d.getFullYear()).substring(2, 4);
        computedMasa = bulan + tahun;
      } else {
        // Jika format teks manual/string aneh, pecah paksa
        var parts = tanggalRaw.split(/[-/.]/);
        if (parts.length === 3) {
          // Cari bagian yang panjang karakternya 4 (Tahun)
          var blnIdx = 1; // Default asumsi tengah (YYYY-MM-DD atau DD-MM-YYYY)
          var thnVal = "";
          parts.forEach(function (p, idx) {
            if (p.length === 4) thnVal = p.substring(2, 4);
          });
          if (thnVal !== "") {
            var blnVal = String(parts[blnIdx]).padStart(2, "0");
            computedMasa = blnVal + thnVal;
          }
        }
      }
    }

    // 🚨 PENGAMAN DARURAT 1: Jika masa masih kosong/null, ambil bulan & tahun hari ini
    if (
      !computedMasa ||
      computedMasa.trim() === "" ||
      computedMasa.toUpperCase() === "NULL"
    ) {
      console.warn(
        "⚠️ [BACKUP] computedMasa null, menggunakan waktu sistem hari ini.",
      );
      var krisisDate = new Date();
      computedMasa =
        String(krisisDate.getMonth() + 1).padStart(2, "0") +
        String(krisisDate.getFullYear()).substring(2, 4);
    }

    // 🚨 PENGAMAN DARURAT 2: Jika cabang null/kosong, ambil dari session kasir atau beri tanda strip
    var finalCabang = elCab ? elCab.value : "";
    if (!finalCabang || finalCabang.trim() === "") {
      finalCabang = _kasirSession.cabang || "PUSAT";
      console.warn(
        "⚠️ [BACKUP] Cabang kosong, menggunakan fallback:",
        finalCabang,
      );
    }

    var newDetil = {
      id: uid(),
      noreff: noreff,
      tanggal: tanggalRaw || new Date().toISOString().split("T")[0], // Pengaman jika tanggal kosong
      kodeTrans: kode,
      noperkiraan: "",
      desc: penjelasan,
      total: rp,
      db: rp,
      cr: 0,

      // ✅ DATA DIJAMIN AMAN KARENA SUDAH MELEWATI VALIDASI STRIP & HARDSYNC DI ATAS
      masa: String(computedMasa),
      cabang: String(finalCabang),
      group: String(activeGroup),
    };

    // 🛠️ DEBUG 2: Lihat isi objek final sebelum dikirim ke API fetch Supabase
    console.log(
      "🚀 [PAYLOAD FINAL] Data yang dikirim ke Server:",
      JSON.stringify(newDetil, null, 2),
    );

    var response = await fetch(
      window.location.origin + "/api/data/mutasikasir",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDetil),
      },
    );

    // 🛠️ DEBUG 3: Cek respons balik dari API router lokal Anda
    if (!response.ok) {
      var errText = await response.text();
      throw new Error("Server API Error: " + errText);
    }

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
    console.error("🚨 [ERROR CRITICAL] Gagal total simpan detil:", error);
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
  cariSaldoAwalKasir();
  updateKasirHeaderNominal();
  hitungSaldoOtomatis();
  renderKasirDetilTable();
  renderKasirNoreffList();
}
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

  // ✅ PELINDUNG: BONGKAR JSONB JIKA MASIH TERBUNGKUS
  var cacheAsli = DBCache.saldoKasir || [];
  if (
    cacheAsli.length > 0 &&
    cacheAsli[0].data &&
    typeof cacheAsli[0].data === "object"
  ) {
    console.log("📦 Data cache masih terbungkus JSONB, membongkar...");
    cacheAsli = cacheAsli.map(function (item) {
      return item.data;
    });
    // Simpan yang sudah dibongkar agar tidak diproses lagi besok
    DBCache.saldokasir = cacheAsli;
  }
  //console.log(cacheAsli);
  // LANGSUNG AMBIL DARI CACHE YANG SUDAH PASTI FLAT
  var dataSk = cacheAsli.filter(function (item) {
    var groupItem = String(item.group || "")
      .trim()
      .toUpperCase();
    // Tambahkan .trim() di cabang kalau khawatir ada spasi
    return (
      (item.cabang || "").trim() === cabang.trim() && groupItem === activeGroup
    );
  });

  //console.log(dataSk);
  // 2. Optimasi: Ubah array menjadi Map berdasarkan tanggal
  var mapSaldo = {};
  dataSk.forEach(function (sk) {
    if (sk.tanggal) {
      mapSaldo[sk.tanggal] = sk.saldo_akhir;
    }
  });

  // 3. Set tanggal target ke H-1
  var tglTarget = new Date(tanggalPilih);
  tglTarget.setDate(tglTarget.getDate() - 1);
  var maxIterasi = 365;

  for (var i = 0; i < maxIterasi; i++) {
    var yyyy = tglTarget.getFullYear();
    var mm = String(tglTarget.getMonth() + 1).padStart(2, "0");
    var dd = String(tglTarget.getDate()).padStart(2, "0");
    var tglStr = yyyy + "-" + mm + "-" + dd;

    var saldoAkhirCocok = mapSaldo[tglStr];

    if (saldoAkhirCocok !== undefined) {
      console.log(
        "✅ Saldo kasir awal ditemukan di tanggal " + tglStr,
        "| Nilai:",
        saldoAkhirCocok,
      );
      return typeof num === "function"
        ? num(saldoAkhirCocok) || 0
        : Number(saldoAkhirCocok) || 0;
    }

    tglTarget.setDate(tglTarget.getDate() - 1);
  }

  console.log("❌ Saldo awal tidak ditemukan dalam 365 hari terakhir.");
  return 0;
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
      id: `${cabang}_${cabang}_${activeGroup}_${tanggal}`,
      cabang: cabang,
      char4: cabang,
      tanggal: tanggal,
      db: totalDB,
      cr: totalCR,
      saldo_akhir: saldoAkhirKasir,
      awal: saldoAwalKasir,
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

  // Catatan: CSS di dalam printHtml diubah agar teks pratinjau berwarna putih
  var printHtml =
    "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Print Kasir - " +
    esc(noreff) +
    "</title>" +
    "<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:15px;color:#fff}" +
    "h2{text-align:center;margin-bottom:10px}table{width:100%;border-collapse:collapse;margin-bottom:10px}" +
    "th,td{padding:4px 4px;text-align:left}td.rp{text-align:right}.bold{font-weight:bold}.total{border-top:1px solid #fff;border-bottom:1px solid #fff;font-weight:bold}</style></head><body>" +
    "<h2>LAPORAN KAS HARIAN KASIR</h2>" +
    "<p>Cabang : " +
    esc(cabangLabel) +
    "<br>Tanggal : " +
    esc(tanggal) +
    "<br>No Ref : " +
    esc(noreff) +
    "<br>Group : " +
    esc(activeGroup) +
    "</p><hr style='border-color:#555;'>" +
    "<table>" +
    "<tr class='bold'><td>BELANJA</td><td style='text-align:right'>Rp</td></tr>" +
    rowHtml(dataKode.BE) +
    "<tr style='font-weight:bold; border-top:1px solid #fff;'><td>TOTAL BELANJA</td><td style='text-align:right'>" +
    fmtRp(totalBE) +
    "</td></tr>" +
    "<tr><td colspan='2'>&nbsp;</td></tr>" +
    "<tr class='bold'><td>(+)</td><td style='text-align:right'>Rp</td></tr>" +
    rowHtml(dataKode.PJ) +
    "<tr><td colspan='2'>&nbsp;</td></tr>" +
    "<tr class='bold'><td>(-)</td><td style='text-align:right'>Rp</td></tr>" +
    rowHtml(dataKode.CS) +
    "<tr class='total'><td>PENJUALAN TUNAI</td><td style='text-align:right; border-top: 1px solid #fff;'>" +
    fmtRp(penjualanTunai) +
    "</td></tr>" +
    "<tr class='bold'><td>SALDO AWAL</td><td style='text-align:right;'>" +
    fmtRp(saldoAwalKasir) +
    "</td></tr>" +
    rowHtml(dataKode.TK) +
    "<tr class='bold' style='border-top: 1px solid #fff;'><td>SALDO KAS TERSEDIA</td><td style='text-align:right'>" +
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
    "<tr class='total'><td>SALDO AKHIR KAS</td><td style='text-align:right; border-top: 1px solid #fff;'>" +
    fmtRp(saldoAkhirKasir) +
    "</td></tr>" +
    "</table></body></html>";

  // --- MODAL DENGAN BACKGROUND HITAM & TULISAN PUTIH ---
  var modalDiv = document.createElement("div");
  modalDiv.id = "customPrintModal";
  modalDiv.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:99999; display:flex; justify-content:center; align-items:center; padding:20px;";

  modalDiv.innerHTML =
    "<div style='background:#1e1e1e; color:#ffffff; width:100%; max-width:500px; max-height:90vh; border-radius:8px; display:flex; flex-direction:column; box-shadow:0 4px 20px rgba(0,0,0,0.5); border:1px solid #333;'>" +
    "<div style='padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; font-weight:bold; font-size:14px; background:#252526; border-top-left-radius:8px; border-top-right-radius:8px; color:#ddd;'>" +
    "<span>Pratinjau Struk Kasir (Mode Gelap)</span>" +
    "</div>" +
    "<div id='printPreviewArea' style='padding:20px; overflow-y:auto; flex:1; background:#121212; border-bottom:1px solid #333;'>" +
    printHtml +
    "</div>" +
    "<div style='padding:15px; text-align:right; background:#252526; border-bottom-left-radius:8px; border-bottom-right-radius:8px;'>" +
    "<button id='btnCancelPrint' style='padding:8px 16px; margin-right:10px; border:1px solid #555; background:#333; color:#fff; border-radius:4px; cursor:pointer;'>Batal</button>" +
    "<button id='btnConfirmPrint' style='padding:8px 16px; border:none; background:#2eb85c; color:#fff; border-radius:4px; font-weight:bold; cursor:pointer;'>Cetak Sekarang</button>" +
    "</div>" +
    "</div>";

  document.body.appendChild(modalDiv);

  document.getElementById("btnCancelPrint").onclick = function () {
    document.body.removeChild(modalDiv);
    if (typeof toast === "function") toast("Pencetakan dibatalkan", "info");
  };

  document.getElementById("btnConfirmPrint").onclick = function () {
    document.body.removeChild(modalDiv);

    var printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      if (typeof toast === "function")
        toast("Pop-up diblokir. Izinkan pop-up untuk print.", "err");
      return;
    }

    // Mengembalikan warna teks ke hitam saat dicetak di kertas fisik agar terbaca printer thermal
    var cleanPrintHtml = printHtml
      .replace("color:#fff", "color:#000")
      .replace("border-top:1px solid #fff", "border-top:1px solid #000")
      .replace("border-bottom:1px solid #fff", "border-bottom:1px solid #000");

    printWindow.document.write(cleanPrintHtml);
    printWindow.document.close();
    printWindow.onload = function () {
      setTimeout(function () {
        printWindow.print();
      }, 300);
    };
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

    // ====================================================================
    // 1. CARI INFORMASI TANGGAL & CABANG DARI DATA YANG AKAN DIHAPUS
    // ====================================================================
    var dataStore = Array.isArray(DBCache.mutasikasir)
      ? DBCache.mutasikasir
      : [];
    var dataYangDihapus = dataStore.filter(function (item) {
      var noreffCocok = (item.noreff || "").toLowerCase() === val.toLowerCase();
      var groupCocok =
        String(item.group || "")
          .trim()
          .toUpperCase() === activeGroup;
      return noreffCocok && groupCocok;
    });

    if (dataYangDihapus.length === 0) {
      return toast("Data No Ref tidak ditemukan di cache lokal.", "wrn");
    }

    // Ambil tanggal dan cabang dari item pertama yang cocok
    var tanggalDihapus = dataYangDihapus[0].tanggal;
    var cabangDihapus = dataYangDihapus[0].cabang || "Pusat"; // Fallback pusat jika tidak ada

    // Jika tanggalnya ada jamnya (misal: 2024-01-01 10:00:00), potong jamnya
    if (tanggalDihapus && tanggalDihapus.indexOf(" ") > -1) {
      tanggalDihapus = tanggalDihapus.split(" ")[0];
    }

    // ====================================================================
    // 2. HAPUS DARI SERVER (MUTASIKASIR)
    // ====================================================================
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

    // ====================================================================
    // 3. HAPUS DARI SERVER (SALDOKASIR) BERDASARKAN TANGGAL YANG DITEMUKAN
    // ====================================================================
    console.log(
      "🔄 [Hapus Reff] Mereset saldokasir tanggal:",
      tanggalDihapus,
      "cabang:",
      cabangDihapus,
    );

    try {
      await fetch(API_BASE_URL + "/api/saldo-kasir/clear-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cabang: cabangDihapus,
          tanggalAwal: tanggalDihapus,
          tanggalAkhir: tanggalDihapus, // Hanya hapus saldo di tanggal tersebut
          group: activeGroup,
        }),
      });
    } catch (errSaldo) {
      console.warn(
        "Peringatan: Gagal mereset saldokasir, namun mutasi berhasil dihapus.",
        errSaldo,
      );
      // Tidak di-throw agar proses utama (hapus mutasi) tetap dianggap berhasil
    }

    // ====================================================================
    // 4. HAPUS DARI CACHE LOKAL (DBCache)
    // ====================================================================
    DBCache.mutasikasir = dataStore.filter(function (item) {
      var noreffCocok = (item.noreff || "").toLowerCase() === val.toLowerCase();
      var groupCocok =
        String(item.group || "")
          .trim()
          .toUpperCase() === activeGroup;
      return !(noreffCocok && groupCocok);
    });

    // Hapus juga cache saldokasir lokal yang terdampak (Opsional tapi direkomendasikan)
    if (DBCache.saldokasir) {
      DBCache.saldokasir = DBCache.saldokasir.filter(function (item) {
        var data = typeof item.data === "string" ? JSON.parse(item.data) : item;
        return !(
          data.tanggal === tanggalDihapus &&
          data.cabang === cabangDihapus &&
          data.group === activeGroup
        );
      });
    }

    closeModal();
    toast(
      `✅ Berhasil menghapus ${result.changes || 0} data se-Reff ${val} (Group: ${activeGroup}) dari Server! Saldo tanggal ${tanggalDihapus} di-reset.`,
      "ok",
    );

    // ====================================================================
    // 5. REFRESH LAYAR
    // ====================================================================
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

      // 🌟 Hitung parameter masa (MMYY) jika bulan dan tahun dipilih
      var calculatedMasa = "";
      if (bln && thn) {
        calculatedMasa = bln + String(thn).substring(2, 4);
      }

      var infoFilter = `\nGroup: ${grp}\nBulan: ${bln || "Semua"}\nTahun: ${thn || "Semua"}\nCabang: ${cbg}${calculatedMasa ? "\nMasa: " + calculatedMasa : ""}`;

      if (
        !confirm(
          "PERINGATAN!\n\nData " +
            label +
            " dan Referensi Kasir terkait dengan kriteria berikut akan dihapus permanen dari Server:" +
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
            masa: calculatedMasa || null, // 🌟 Kirim parameter masa ke backend
          }),
        });

        var result = await response.json();
        if (!response.ok || !result.success)
          throw new Error(result.message || "Gagal menghubungi server");

        // =========================================================================
        // 🌟 1. BERSIHKAN CACHE LOKAL: mutasikasir
        // =========================================================================
        var dataDipertahankan = [];
        var allData = DBCache.mutasikasir || [];

        for (var i = 0; i < allData.length; i++) {
          var item = allData[i];
          var cocokCabang = item.cabang === cbg;
          var cocokGroup =
            String(item.group || "")
              .trim()
              .toUpperCase() === grp.toUpperCase();
          var cocokTahun = thn
            ? item.tanggal && item.tanggal.startsWith(thn)
            : true;
          var cocokBulan =
            thn && bln
              ? item.tanggal && item.tanggal.startsWith(thn + "-" + bln)
              : true;

          if (cocokCabang && cocokGroup && cocokTahun && cocokBulan) {
            // Dihapus
          } else {
            dataDipertahankan.push(item);
          }
        }
        DBCache.mutasikasir = dataDipertahankan;

        // =========================================================================
        // 🌟 2. BERSIHKAN CACHE LOKAL: listreffkasir
        // =========================================================================
        if (DBCache.listreffkasir && Array.isArray(DBCache.listreffkasir)) {
          DBCache.listreffkasir = DBCache.listreffkasir.filter(function (ref) {
            var cocokCabangRef = ref.cabang === cbg;
            var cocokGroupRef =
              String(ref.group || "")
                .trim()
                .toUpperCase() === grp.toUpperCase();

            var cocokMasaRef = true;
            if (calculatedMasa) {
              cocokMasaRef = ref.masa === calculatedMasa;
            } else if (thn) {
              // Jika hanya pilih tahun, cek apakah 2 digit belakang masa cocok dengan 2 digit belakang tahun
              var shortThn = String(thn).substring(2, 4);
              cocokMasaRef = ref.masa && ref.masa.endsWith(shortThn);
            }

            // Jika semua kriteria cocok, kembalikan false (artinya dihapus dari cache)
            return !(cocokCabangRef && cocokGroupRef && cocokMasaRef);
          });
        }

        // Render ulang tampilan komponen UI
        renderKasirDetilTable();
        updateKasirHeaderNominal();
        await hitungSaldoOtomatis();

        if (typeof buildGroupedNoreff === "function") buildGroupedNoreff();
        renderKasirNoreffList();

        toast(
          `✅ Berhasil menghapus data ${label} dan Referensi terkait dari Server`,
          "ok",
        );
      } catch (err) {
        console.error(err);
        toast("Gagal memproses penghapusan: " + err.message, "err");
      }
    };
}

// ✅ OBJEK LOGIKA IMPORT DBF KASIR (SERVER-SIDE)
// Fungsi kecil untuk menghilangkan warna biru di semua baris listreff
function clearAllReffColors() {
  var table = document.querySelector("#mutNoreffList table tbody");
  if (!table) return;

  var rows = table.querySelectorAll("tr");
  for (var i = 0; i < rows.length; i++) {
    rows[i].style.background = "transparent";
    rows[i].style.color = "inherit";
    rows[i].style.fontWeight = "normal";
  }
}
