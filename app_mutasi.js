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

/* ================================================================
   POPULATE KE DOM
   ================================================================ */

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

/* ================================================================
   GENERATE NO REF
   ================================================================ */
function generateNoreff(kodeBank, tanggal, cabangKode) {
  if (!kodeBank || !tanggal) return "";

  var cab = cabangKode || "Pusat";

  // 1. Standarisasi format Kode Bank (harus tepat 4 karakter, misal "bp-c" atau "kk- ")
  var kb = kodeBank.padEnd(4, " ").substring(0, 4);

  // 2. Olah data Tanggal untuk mendapatkan Bulan dan Tahun (Format: MMTT, misal "0426")
  var dt = new Date(tanggal);
  var bln = String(dt.getMonth() + 1).padStart(2, "0");
  var thn = String(dt.getFullYear()).substring(2);
  var blnThnTarget = bln + thn; // Hasil: "0426"

  // 3. Bangun Prefix untuk Transaksi Baru Anda (Contoh: "kk- 0426")
  var currentPrefix = kb + blnThnTarget;

  var nextUrut = 1; // Default jika belum ada transaksi di bulan tersebut

  // 4. AMBIL DATA TRANSAKSI DI BULAN DAN CABANG YANG SAMA
  var dataRaw = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  var activeList = dataRaw.filter(function (t) {
    if (!t.noreff || !t.tanggal) return false;

    // Validasi Cabang
    if (String(t.cabang || "Pusat") !== String(cab)) return false;

    // Validasi Bulan dan Tahun (Mencari yang sama-sama bulan April 2026)
    var dataBln = t.tanggal.substring(5, 7);
    var dataThn = t.tanggal.substring(0, 4);
    if (dataBln !== bln || dataThn !== String(dt.getFullYear())) return false;

    return true;
  });

  // 5. 🛠️ FIX SORTING: URUTKAN MURNI BERDASARKAN 4 DIGIT ANGKA PALING KANAN
  // Mengabaikan kode bank di depan agar "bp-n" dan "kk- " menyatu urutan angkanya
  activeList.sort(function (a, b) {
    var numA =
      parseInt((a.noreff || "").substring((a.noreff || "").length - 4), 10) ||
      0;
    var numB =
      parseInt((b.noreff || "").substring((b.noreff || "").length - 4), 10) ||
      0;
    return numA - numB; // Urut dari angka terkecil ke angka terbesar (Ascending)
  });

  // 6. AMBIL BARIS PALING AKHIR (ANGKA TERBESAR DI LIST) UNTUK DITAMBAH 1
  if (activeList.length > 0) {
    var notaTerakhir = activeList[activeList.length - 1]; // Mengambil baris terbawah hasil sort angka
    var lastNoreff = notaTerakhir.noreff || "";

    if (lastNoreff.length >= 4) {
      // Potong 4 digit angka paling kanan (Mencegah angka tahun '26' ikut terambil)
      var lastUrutStr = lastNoreff.substring(lastNoreff.length - 4);
      var lastUrutByte = parseInt(lastUrutStr, 10) || 0;

      // Nomor urut baru adalah angka terakhir + 1
      nextUrut = lastUrutByte + 1;
    }
  }

  // 7. Kembalikan Nomor Referensi Baru dengan format 4 Digit Nomor Urut
  // Hasil gabungan: "kk- 0426" + "0211" = "kk- 04260211"
  return currentPrefix + String(nextUrut).padStart(4, "0");
}

/* ================================================================
   RENDER MUTASI
   ================================================================ */
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

  // --- Opsi Cabang untuk Filter List (Default Semua) ---
  // --- PERBAIKAN: Generate Opsi Cabang (Sort by Kode + Tampil Nama) ---
  var cabFilterOpts = '<option value="">-- Semua Cabang --</option>';

  if (DBCache.cabang && Array.isArray(DBCache.cabang)) {
    // 1. Clone array agar tidak merusak urutan asli di cache
    var sortedList = [...DBCache.cabang];

    // 2. Sorting ASCENDING berdasarkan KODE CABANG
    sortedList.sort(function (a, b) {
      var ka = String(a.kode || "");
      var kb = String(b.kode || "");
      return ka.localeCompare(kb); // Mengurutkan A-Z
    });

    // 3. Loop dan buat HTML Option
    sortedList.forEach(function (c) {
      var kode = c.kode || "";
      var nama = c.nama || "";
      // Tampilan di dropdown: "001 — Jakarta"
      var label = kode + (nama ? " — " + nama : "");

      cabFilterOpts +=
        '<option value="' + esc(kode) + '">' + esc(label) + "</option>";
    });
  }
  return (
    "<style>" +
    ".pnl.active { height: auto !important; max-height: none !important; overflow: visible !important; }" +
    "#contentArea { height: auto !important; max-height: none !important; overflow: visible !important; }" +
    "body, html { overflow-y: auto !important; height: auto !important; }" +
    "</style>" +
    '<div style="padding:.8rem;background:var(--bg2);border:1px solid var(--brd);border-radius:10px;margin-bottom:1rem">' +
    '<div style="padding:.8rem;background:var(--bg2);border:1px solid var(--brd);border-radius:10px;margin-bottom:1rem">' +
    /* ✅ BARIS JUDUL UTAMA (SEKARANG SEJAJAR: JUDUL + RIWAYAT & BARU) */
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">' +
    '<div style="font-size:.8rem;font-weight:700;color:var(--accent)">' +
    '<i class="fa-solid fa-file-circle-plus"></i> Header Transaksi' +
    "</div>" +
    /* Riwayat & Baru diletakkan di ujung kanan baris judul utama */
    '<div style="display:flex;align-items:center;gap:.5rem">' +
    '<div style="font-size:.75rem;font-weight:700;color:var(--accent)">' +
    '<i class="fa-solid fa-clock-rotate-left"></i> Riwayat' +
    "</div>" +
    '<button type="button" class="btn btn-sm" style="font-size:.65rem;padding:2px 6px" onclick="resetToNewTransaction()">' +
    '<i class="fa-solid fa-plus"></i> Baru' +
    "</button>" +
    "</div>" +
    "</div>" +
    /* BARIS ISI */
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
    /* No Ref kembali normal menggunakan label standar di atasnya */
    '<div class="fg" style="flex:1"><label>No Ref</label><input id="m_noref" class="in" readonly style="background:var(--bg);opacity:.8"></div>' +
    "</div>" +
    '<div style="display:flex;gap:.5rem;margin-bottom:.5rem">' +
    '<div class="fg" style="flex:2"><label>Dari / Kepada <span class="req">*</span></label>' +
    '<input id="m_dkp" class="in" placeholder="Nama pihak terkait"></div>' +
    '<div class="fg" style="flex:1"><label>Nominal / Rp</label>' +
    '<input id="m_nominal" class="in" readonly style="background:var(--bg);font-weight:700;color:var(--success)" value="0"></div>' +
    "</div>" +
    '<button type="button" class="btn btn-inf" onclick="openDBFImportModal(\'transaksi\')"><i class="fa-solid fa-file-import"></i> Import DBF</button>' +
    '<button type="button" class="btn btn-r" onclick="clearAllDataMutasi(\'transaksi\')"><i class="fa-solid fa-trash-can"></i> Kosongkan Semua</button>' +
    /* FORM DETIL */
    '<div style="margin-top:.8rem;padding-top:.8rem;border-top:1px dashed var(--brd)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">' +
    '<div style="font-size:.8rem;font-weight:700;color:var(--info)">' +
    '<i class="fa-solid fa-list-ol"></i> Tambah Detil Jurnal' +
    "</div>" +
    '<button type="button" class="btn btn-sm" style="background:var(--info);color:#fff;font-size:.7rem;padding:3px 10px" onclick="printMutasi()">' +
    '<i class="fa-solid fa-print"></i> Print' +
    "</button>" +
    "</div>" +
    '<div style="display:flex;gap:.5rem;align-items:flex-end">' +
    '<div class="fg" style="flex:2;margin-bottom:0"><label>No Perkiraan <span class="req">*</span></label>' +
    '<select id="d_perk" class="in">' +
    perkOpts +
    "</select></div>" +
    '<div class="fg" style="flex:3;margin-bottom:0"><label>Penjelasan <span class="req">*</span></label>' +
    '<input id="d_penjelasan" class="in" placeholder="Keterangan transaksi"></div>' +
    '<div class="fg" style="flex:1;margin-bottom:0"><label>Rp <span class="req">*</span></label>' +
    '<input type="number" id="d_rp" class="in" placeholder="0"></div>' +
    '<button class="btn btn-a" onclick="SafeaddDetil()" style="margin-bottom:2px">' +
    '<i class="fa-solid fa-plus"></i> Tambah</button>' +
    "</div>" +
    "</div>" +
    "</div>" +
    /* KOLOM KANAN */
    '<div style="flex:1;border-left:1px solid var(--brd);padding-left:.8rem;display:flex;flex-direction:column">' +
    /* ✅ POSISI BARU: Filter Cabang List Pindah ke Puncak Kolom Kanan */
    '<div style="margin-bottom:.4rem">' +
    '<div class="fg" style="margin-bottom:0">' +
    '<label style="font-size:.65rem">Filter Cabang List</label>' +
    '<select id="filter_cabang_list" class="in" style="font-size:.75rem">' +
    cabFilterOpts +
    "</select></div>" +
    "</div>" +
    /* FILTER BULAN & TAHUN */
    '<div style="display:flex;gap:.4rem;margin-bottom:.4rem">' +
    '<div class="fg" style="flex:1;margin-bottom:0">' +
    '<label style="font-size:.65rem">Bulan</label>' +
    '<select id="filter_bulan" class="in" style="font-size:.75rem;padding:3px 5px">' +
    bulanOpts +
    "</select></div>" +
    '<div class="fg" style="flex:1;margin-bottom:0">' +
    '<label style="font-size:.65rem">Tahun</label>' +
    '<select id="filter_tahun" class="in" style="font-size:.75rem;padding:3px 5px">' +
    tahunOpts +
    "</select></div>" +
    "</div>" +
    /* LIST NO REFF BLOCK */
    '<div id="mutNoreffList" style="flex:1;overflow-y:auto;max-height:180px;font-size:.8rem;background:var(--bg);border:1px solid var(--brd);border-radius:6px">' +
    '<div style="padding:1rem;color:var(--muted);text-align:center">Memuat data...</div>' +
    "</div>" +
    '<div id="mutNoreffCount" style="font-size:.65rem;color:var(--muted);margin-top:.3rem;text-align:right"></div>' +
    "</div>" +
    "</div>" +
    "</div>" +
    /* TABEL DETIL */
    "<style>" +
    "#mutDetilTbl { display: block !important; max-height: 450px !important; overflow-y: auto !important; border: 1px solid var(--brd); border-radius: 6px; }" +
    "#mutDetilTbl table { width: 100% !important; border-collapse: collapse !important; }" +
    "#mutDetilTbl th { position: sticky !important; top: 0 !important; background: var(--bg2) !important; z-index: 2; }" +
    "</style>" +
    '<div style="font-size:.85rem;font-weight:700;margin-bottom:.4rem">Riwayat Detil Transaksi</div>' +
    '<div id="mutDetilTbl" class="tw"></div>'
  );
}

/* ================================================================
   INIT STATE
   ================================================================ */

function initMutasiState() {
  _mutSession = { noreff: "", isLocked: false };

  var cabEl = $("m_cab");
  var kbEl = $("m_kb");
  var tglEl = $("m_tgl");
  var bulanEl = $("filter_bulan");
  var tahunEl = $("filter_tahun");
  var filterCabListEl = $("filter_cabang_list"); // ✅ Ambil elemen baru

  if (!cabEl) return;

  if (_mutHandlers.cab) cabEl.removeEventListener("change", _mutHandlers.cab);
  if (_mutHandlers.kb) kbEl.removeEventListener("change", _mutHandlers.kb);
  if (_mutHandlers.tgl) tglEl.removeEventListener("change", _mutHandlers.tgl);
  if (_mutHandlers.bulan)
    bulanEl.removeEventListener("change", _mutHandlers.bulan);
  if (_mutHandlers.tahun)
    tahunEl.removeEventListener("change", _mutHandlers.tahun);
  // ✅ Cleanup event listener filter cabang jika ada
  if (_mutHandlers.filterCabList && filterCabListEl)
    filterCabListEl.removeEventListener("change", _mutHandlers.filterCabList);

  _mutHandlers.cab = onCabangChange;
  _mutHandlers.kb = onKbChange;
  _mutHandlers.tgl = onHeaderChange;
  _mutHandlers.bulan = onFilterChange;
  _mutHandlers.tahun = onFilterChange;
  _mutHandlers.filterCabList = renderNoreffList; // ✅ Handler baru

  cabEl.addEventListener("change", _mutHandlers.cab);
  kbEl.addEventListener("change", _mutHandlers.kb);
  tglEl.addEventListener("change", _mutHandlers.tgl);
  bulanEl.addEventListener("change", _mutHandlers.bulan);
  tahunEl.addEventListener("change", _mutHandlers.tahun);

  // ✅ Pasang event listener baru
  if (filterCabListEl)
    filterCabListEl.addEventListener("change", _mutHandlers.filterCabList);

  // Cegah Enter di input detil
  ["d_penjelasan", "d_rp"].forEach((id) => {
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
  renderNoreffList(); // Akan membaca nilai default dari filter_cabang_list
  updateMutasiSummary();
}

/* ================================================================
   EVENT HANDLERS
   ================================================================ */

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

/* ================================================================
   TAMBAH DETIL
   ================================================================ */
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
async function SafeaddDetil() {
  var noreff = _mutSession.noreff || $("m_noref").value;
  if (!noreff)
    return toast("Isi Kode Bank & Tanggal di header terlebih dahulu", "err");

  var noper = $("d_perk").value;
  var penjelasan = $("d_penjelasan").value.trim();
  var rp = num($("d_rp").value);

  if (!noper || !penjelasan || rp <= 0)
    return toast("No Perkiraan, Penjelasan, dan Rp wajib diisi!", "err");

  _mutSession.isLocked = true;
  $("m_cab").disabled = true;
  $("m_kb").disabled = true;
  $("m_tgl").disabled = true;

  try {
    await db.add("transaksi", {
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
    });

    await refreshCache("transaksi");

    $("d_perk").value = "";
    $("d_penjelasan").value = "";
    $("d_rp").value = "";
    $("d_penjelasan").focus();

    renderDetilTable();
    updateHeaderNominal();
    renderNoreffList();
    updateMutasiSummary();
    toast("Detil ditambahkan", "ok");
  } catch (error) {
    console.error("Gagal menyimpan detil:", error);
    toast("Gagal simpan: " + (error.message || "Kesalahan database"), "err");

    _mutSession.isLocked = false;
    $("m_cab").disabled = false;
    $("m_kb").disabled = false;
    $("m_tgl").disabled = false;
  }
}

/* ================================================================
   EDIT / HAPUS DETIL
   ================================================================ */

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

async function saveEditDetil(id) {
  var r = await db.get("transaksi", id);
  if (!r) return;

  var noper = $("ed_perk").value;
  var penjelasan = $("ed_penjelasan").value.trim();
  var rp = num($("ed_rp").value);

  if (!noper || !penjelasan || rp <= 0)
    return toast("Field wajib tidak boleh kosong!", "err");

  await db.put(
    "transaksi",
    Object.assign({}, r, {
      noperkiraan: noper,
      desc: penjelasan,
      total: rp,
      db: rp,
    }),
  );

  closeModal();
  await refreshCache("transaksi"); // di app_core
  renderDetilTable(); //app_mutasi
  updateHeaderNominal(); //app_mutasi
  renderNoreffList(); //app_mutasi
  updateMutasiSummary(); //app_mutasi
  toast("Detil diperbarui", "ok");
}
async function hapusDetil(id) {
  var isYes = confirm("Yakin hapus detil ini?");
  if (!isYes) return;

  try {
    await db.del("transaksi", id);

    // Update memori cache internal secara manual
    if (Array.isArray(DBCache.transaksi)) {
      DBCache.transaksi = DBCache.transaksi.filter(function (t) {
        return t.id !== id;
      });
    }

    var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];
    var sisaDetil = transaksi.filter(function (t) {
      return t.noreff === _mutSession.noreff;
    }).length;

    if (sisaDetil === 0) {
      _mutSession.isLocked = false;
      if ($("m_cab")) $("m_cab").disabled = false;
      if ($("m_kb")) $("m_kb").disabled = false;
      if ($("m_tgl")) $("m_tgl").disabled = false;
      if ($("m_nominal")) $("m_nominal").value = "0";
    }

    // Pemicu gambar ulang layar yang menghancurkan elemen via innerHTML
    if (typeof renderDetilTable === "function") renderDetilTable();
    if (typeof refreshKasHarian === "function") refreshKasHarian();

    toast("Detil transaksi berhasil dihapus.");

    // =========================================================================
    // ✅ KUNCI PAMUNGKAS: PAKSA BROWSER BERHENTI MELAKUKAN RELOAD SENSITIF
    // =========================================================================
    window.stop(); // 🔒 Mengunci browser agar tidak melompat ke dashboard/reload penuh!
    return false;
  } catch (error) {
    console.error("Gagal saat mencoba menghapus detil:", error);
    alert("Terjadi kesalahan sistem saat menghapus data.");
  }
}

/* ================================================================
   UPDATE NOMINAL HEADER
   ================================================================ */

function updateHeaderNominal() {
  var noreff = _mutSession.noreff;
  if (!noreff) return;

  var totalRp = 0;
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];
  transaksi.forEach(function (t) {
    if (t.noreff === noreff) totalRp += num(t.total);
  });
  $("m_nominal").value = fmtN(totalRp);
}

/* ================================================================
   RENDER TABEL DETIL
   ================================================================ */

/* ================================================================
   RENDER TABEL DETIL (FIXED: ADA KOLOM CABANG & FILTER KETAT)
   ================================================================ */

function renderDetilTable() {
  var noreff = _mutSession.noreff;
  var activeCab = $("m_cab") ? $("m_cab").value : ""; // Ambil cabang aktif dari header
  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  // FILTER KETAT: Harus Sama Noreff DAN Sama Cabang
  var detilData = [];
  if (noreff && activeCab) {
    detilData = transaksi.filter(function (t) {
      return (
        t.noreff === noreff && String(t.cabang || "") === String(activeCab)
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
      '<span style="font-weight:600">' + fmtN(r.total) + "</span>",
      '<span style="font-size:.75rem;color:var(--muted)">' +
        esc(r.noreff) +
        "</span>",
      // 🎯 DATA KOLOM CABANG
      '<span style="font-weight:600; color:var(--accent)">' +
        esc(r.cabang || "-") +
        "</span>",
      '<button class="btn btn-g btn-sm" onclick="editDetil(\'' +
        r.id +
        '\')"><i class="fa-solid fa-pen"></i></button> ' +
        '<button type="button" class="btn btn-r btn-sm" onclick="event.preventDefault(); event.stopPropagation(); hapusDetil(\'' +
        r.id +
        "'); return false;\">" +
        '<i class="fa-solid fa-trash"></i>' +
        "</button>",
    ];
  });

  // 🎯 HEADER TABEL: Saya tambahkan "Cabang" di urutan ke-6 (sebelum Aksi)
  var headers = [
    "Tanggal",
    "No Acct",
    "Penjelasan",
    "Rp",
    "No Referensi",
    "Cabang", // <--- Header Cabang ditambahkan di sini
    "Aksi",
  ];

  tblEl.innerHTML =
    '<div class="ts"><table>' +
    buildTable(headers, rows, {
      numCols: [3], // Kolom Rp (index 3) rata kanan
    }) +
    "</table></div>";
}
/* ================================================================
   RENDER RIWAYAT NO REF
   ================================================================ */
/* ================================================================
   RENDER RIWAYAT NO REF (FIXED: FILTER CABANG & URUTAN)
   ================================================================ */

/* ================================================================
   RENDER RIWAYAT NO REF (FIXED: FILTER CABANG & URUTAN DIGIT BELAKANG)
   ================================================================ */

function renderNoreffList() {
  var box = $("mutNoreffList");
  var countBox = $("mutNoreffCount");
  if (!box) return;

  var data = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];

  // ✅ BACA NILAI FILTER DARI DROPDOWN
  var filterCabang = $("filter_cabang_list")
    ? $("filter_cabang_list").value
    : "";
  var filterBulan = $("filter_bulan") ? $("filter_bulan").value : "";
  var filterTahun = $("filter_tahun") ? $("filter_tahun").value : "";

  // ✅ LOGIKA FILTER LEBIH KETAT
  var filtered = data.filter(function (t) {
    if (!t.noreff || !t.tanggal) return false;

    // 1. Filter Cabang (Jika dropdown dipilih)
    if (filterCabang && String(t.cabang || "") !== String(filterCabang))
      return false;

    // 2. Filter Bulan
    if (filterBulan) {
      var dataBulan = t.tanggal.substring(5, 7);
      var userBulan = filterBulan.padStart(2, "0");
      if (dataBulan !== userBulan) return false;
    }

    // 3. Filter Tahun
    if (filterTahun && t.tanggal.substring(0, 4) !== filterTahun) return false;

    return true;
  });

  if (filtered.length === 0) {
    box.innerHTML =
      '<div style="padding:.8rem;color:var(--muted);text-align:center;font-size:.75rem">' +
      '<i class="fa-solid fa-filter-circle-xmark"></i> Tidak ada data' +
      "<br><small>Cabang: " +
      esc(filterCabang || "Semua") +
      " | Bulan: " +
      esc(filterBulan || "Semua") +
      " | Tahun: " +
      esc(filterTahun || "Semua") +
      "</small></div>";
    if (countBox) countBox.textContent = "";
    return;
  }

  // Grouping data berdasarkan Noreff untuk ditampilkan di list
  var uniqueNoreff = {};
  filtered.forEach(function (t) {
    if (t.noreff && !uniqueNoreff[t.noreff]) {
      uniqueNoreff[t.noreff] = {
        tanggal: t.tanggal || "-",
        jumlahDetil: 0,
        totalRp: 0,
        cabang: t.cabang || "-", // Simpan info cabang di grup
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
    // Ambil 8 digit terakhir dari nomor referensi
    var suffixA = String(a.noreff || "").slice(-8);
    var suffixB = String(b.noreff || "").slice(-8);

    // TUKAR POSISI: suffixA di depan, suffixB di dalam kurung agar urut dari kecil ke besar 🎯
    return suffixA.localeCompare(suffixB, undefined, { numeric: true });
  });

  // Bangun HTML List
  var html = '<table style="width:100%;border-collapse:collapse">';
  html +=
    '<thead><tr style="background:var(--bg2);position:sticky;top:0;z-index:1">';
  html +=
    '<th style="padding:4px;text-align:left;font-size:.65rem">No Ref</th>';
  html +=
    '<th style="padding:4px;text-align:center;font-size:.65rem;width:30px">D</th>';
  html +=
    '<th style="padding:4px;text-align:right;font-size:.65rem;width:65px">Total</th>';
  html += "</tr></thead><tbody>";

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
      (isActive ? ' data-active="1"' : "") +
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
      "</td>";
    html += "</tr>";
  });

  html += "</tbody></table>";
  box.innerHTML = html;

  if (countBox) countBox.textContent = arrNoreff.length + " transaksi";
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

/* ================================================================
   EVENT: NO REF DIKLIK
   ================================================================ */

function onNoreffClicked(noreffTarget) {
  if (noreffTarget === _mutSession.noreff) return;

  var headerData = DBCache.transaksi.find(function (t) {
    return t.noreff === noreffTarget;
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

/* ================================================================
   RESET
   ================================================================ */

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

/* ================================================================
   ✅ PRINT MUTASI
   ================================================================ */
/* ================================================================
   ✅ PRINT MUTASI (KOREKSI LAYOUT)
   ================================================================ */

function printMutasi() {
  var noreff = _mutSession.noreff || $("m_noref").value;

  if (!noreff) {
    return toast(
      "Pilih transaksi terlebih dahulu (klik No Ref di riwayat)",
      "wrn",
    );
  }

  var transaksi = Array.isArray(DBCache.transaksi) ? DBCache.transaksi : [];
  var detilData = transaksi.filter(function (t) {
    return t.noreff === noreff;
  });

  if (detilData.length === 0) {
    return toast("Tidak ada detil untuk No Ref ini", "wrn");
  }

  // Ambil data header dari detil pertama
  var header = detilData[0];
  var cabangLabel = lookupCabangLabel(header.cabang) || header.cabang || "-";
  var tanggal = header.tanggal || "-";
  var kodeBank = header.kodeBank || "-";
  var dariKePada = header.dariKePada || "-";

  // Hitung total
  var totalRp = 0;
  detilData.forEach(function (t) {
    totalRp += num(t.total);
  });

  // Cari penjelasan kode bank
  var kbList = Array.isArray(DBCache.kodeBank) ? DBCache.kodeBank : [];
  var kbData = kbList.find(function (k) {
    return k.kodebank === kodeBank;
  });
  var kbPenjelasan = kbData ? kbData.penjelasan : "";

  // ✅ Bangun HTML untuk print
  var printHtml =
    "<!DOCTYPE html>" +
    "<html><head>" +
    '<meta charset="UTF-8">' +
    "<title>Print Mutasi - " +
    esc(noreff) +
    "</title>" +
    "<style>" +
    "* { margin: 0; padding: 0; box-sizing: border-box; }" +
    'body { font-family: "Courier New", Courier, monospace; font-size: 12px; padding: 15px; color: #000; }' +
    ".header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }" +
    ".header h2 { font-size: 16px; margin-bottom: 4px; }" +
    ".header p { font-size: 12px; color: #000; font-weight: bold; }" +
    ".info-grid { display: grid; grid-template-columns: 130px 1fr; gap: 3px 10px; margin-bottom: 15px; font-size: 12px; }" +
    ".info-grid .label { font-weight: bold; }" +
    "table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }" +
    "th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; font-size: 11px; }" +
    "th { background: #eee; font-weight: bold; text-align: center; }" +
    'td.rp { text-align: right; font-family: "Courier New", monospace; }' +
    "td.center { text-align: center; }" +
    ".total-row { font-weight: bold; background: #f5f5f5; }" +
    ".footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #000; font-size: 10px; color: #555; display: flex; justify-content: space-between; }" +
    ".footer .sign { text-align: center; width: 150px; }" +
    ".footer .sign .line { margin-top: 50px; border-bottom: 1px solid #000; }" +
    "@media print { body { padding: 0; } }" +
    "</style>" +
    "</head><body>" +
    /* ✅ === KOP SURAT: CABANG DI ATAS === */
    '<div class="header">' +
    "<h2>MUTASI TRANSAKSI</h2>" +
    "<p>Cabang: " +
    esc(cabangLabel) +
    "</p>" +
    "</div>" +
    /* ✅ === INFO HEADER: NO REF DI BARIS PERTAMA === */
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
    "</div>" +
    /* === TABEL DETIL === */
    "<table>" +
    "<thead>" +
    "<tr>" +
    '<th style="width:40px">No</th>' +
    '<th style="width:100px">No Perkiraan</th>' +
    "<th>Penjelasan</th>" +
    '<th style="width:140px">Rp</th>' +
    "</tr>" +
    "</thead>" +
    "<tbody>";

  // Isi baris detil
  detilData.forEach(function (d, idx) {
    printHtml +=
      "<tr>" +
      '<td class="center">' +
      (idx + 1) +
      "</td>" +
      "<td>" +
      esc(d.noperkiraan || "-") +
      "</td>" +
      "<td>" +
      esc(d.desc || "-") +
      "</td>" +
      '<td class="rp">' +
      fmtN(d.total) +
      "</td>" +
      "</tr>";
  });

  // Baris total
  printHtml +=
    '<tr class="total-row">' +
    '<td colspan="3" style="text-align:right">TOTAL</td>' +
    '<td class="rp">' +
    fmtN(totalRp) +
    "</td>" +
    "</tr>" +
    "</tbody>" +
    "</table>" +
    /* === TERBILANG === */
    '<div style="margin-bottom:15px;font-size:11px">' +
    "<strong>Terbilang:</strong> " +
    terbilang(totalRp) +
    " Rupiah" +
    "</div>" +
    /* === TANDA TANGAN === */
    '<div class="footer">' +
    '<div class="sign">' +
    "Dibuat oleh,<br><br><br>" +
    '<div class="line"></div>' +
    "</div>" +
    '<div class="sign">' +
    "Diperiksa oleh,<br><br><br>" +
    '<div class="line"></div>' +
    "</div>" +
    '<div class="sign">' +
    "Disetujui oleh,<br><br><br>" +
    '<div class="line"></div>' +
    "</div>" +
    "</div>" +
    "</body></html>";

  // Buka window print
  var printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) {
    return toast("Pop-up diblokir. Izinkan pop-up untuk print.", "err");
  }

  printWindow.document.write(printHtml);
  printWindow.document.close();

  printWindow.onload = function () {
    setTimeout(function () {
      printWindow.print();
    }, 300);
  };
}

/* ================================================================
   FUNGSI TERBILANG (SUPPORT SAMPAI MILIAR)
   ================================================================ */

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
  // Buat tombol footer: Batal dan Ya
  var footerHtml =
    '<button class="btn btn-g" onclick="closeModal()">Batal</button>' +
    '<button class="btn btn-r" id="btnConfirmAction">Ya, Lanjutkan</button>';

  // Buka modal standard
  openModal(
    "Konfirmasi",
    '<div style="font-size:0.9rem">' + esc(message) + "</div>",
    footerHtml,
  );

  // Tunggu sebentar agar DOM ter-render, lalu pasang event klik ke tombol "Ya"
  setTimeout(function () {
    var btnYes = document.getElementById("btnConfirmAction");
    if (btnYes) {
      btnYes.onclick = function () {
        closeModal(); // Tutup modal
        if (typeof onYes === "function") {
          onYes(); // Jalankan aksi hapus
        }
      };
    }
  }, 50);
}
async function clearAllDataMutasi(storeName) {
  var labelMap = {
    transaksi: "Transaksi",
  };
  var label = labelMap[storeName] || storeName;

  // 1. GENERATE DAFTAR TAHUN SECARA DINAMIS (3 tahun terakhir)
  var tahunSekarang = new Date().getFullYear();
  var opsiTahunHtml = "";
  for (var i = 0; i < 3; i++) {
    var thn = tahunSekarang - i;
    opsiTahunHtml += `<option value="${thn}">${thn}</option>`;
  }

  // 2. DAFTAR BULAN
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

  // 3. DAFTAR CABANG (DARI KODE ANDA)
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

  // 4. TAMPILKAN MODAL FORMULIR FILTER
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

  // 5. EVENT HANDLER SAAT TOMBOL HAPUS DI KLIK (MENGGUNAKAN TRIK DB.BATCH / PUT)
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
      // Ambil seluruh data dari database
      var allData = await db.getAll(storeName);

      var dataDipertahankan = [];
      var dataDihapusCount = 0;

      // Filter data di dalam memori JavaScript
      for (var item of allData) {
        var cocokBulan = !bln || item.bulan == bln;
        var cocokTahun = !thn || item.tahun == thn;
        var cocokCabang = !cbg || item.kodeCabang == cbg;

        if (cocokBulan && cocokTahun && cocokCabang) {
          dataDihapusCount++; // Hitung jumlah data yang dibuang
        } else {
          dataDipertahankan.push(item); // Amankan data yang tidak memenuhi kriteria hapus
        }
      }

      // LANGKAH AMAN: Bersihkan seluruh tabel menggunakan fungsi bawaan asli Anda
      await db.clear(storeName);

      // Masukkan kembali data yang selamat ke database menggunakan fungsi batch bawaan impor Anda
      if (dataDipertahankan.length > 0) {
        if (typeof db.batch === "function") {
          await db.batch(storeName, dataDipertahankan);
        } else if (
          db[storeName] &&
          typeof db[storeName].bulkPut === "function"
        ) {
          await db[storeName].bulkPut(dataDipertahankan);
        } else {
          // Fallback satu per satu jika tidak ada fungsi bulk/batch
          for (var dataAman of dataDipertahankan) {
            await db.put(storeName, dataAman);
          }
        }
      }

      // Sinkronisasi data cache internal agar layar langsung terupdate bersih
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

async function clearAllDataMutasi2(storeName) {
  var labelMap = {
    golongan: "Golongan",
    perkiraan: "No Perkiraan",
    kodeBank: "Kode Bank",
    transaksi: "Transaksi",
  };
  var label = labelMap[storeName] || storeName;
  if (
    !confirm(
      "PERINGATAN!\n\nSemua data " +
        label +
        " akan dihapus secara permanen.\n\nLanjutkan?",
    )
  )
    return;
  try {
    await db.clear(storeName);
    // MANUAL CACHE UPDATE
    if (DBCache[storeName]) {
      DBCache[storeName] = [];
    }
    // await refreshCache(storeName); // DIHAPUS
    toast("Semua data " + label + " berhasil dikosongkan", "ok");
    safeRenderCurrentPanel();
  } catch (err) {
    toast("Gagal mengosongkan data: " + err.message, "err");
  }
}
