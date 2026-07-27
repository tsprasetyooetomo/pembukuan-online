// =========================================================================
// 1. GLOBAL STATE PAGINATION (Sudah Sesuai)
// =========================================================================
var APP_PAGINATION_STATE = {
  kasir: {
    current: 1,
    size: 20,
    func: "refreshSaldoKasir",
    target: "kasirPagination",
  },
  inputHarian: {
    current: 1,
    size: 20,
    func: "refreshInputHarian",
    target: "inputHarianPagination",
  },
  kasHarian: {
    current: 1,
    size: 20,
    func: "refreshKasHarian",
    target: "kasHarianPagination",
  },
};

/* ================================================================
   app_laporan_kas.js — KAS HARIAN & INPUT HARIAN
   ================================================================ */

/* globals getCabangOpts, lookupCabangLabel, uid, esc, fmtN, num, openModal, closeModal, showConfirm, toast, bulkInit, bulkBarHTML, bulkGetIds, bulkGetKey, crudActions, buildTable, refreshCache, navigate, currentPanel, DBCache, db */

/* ---------- Kas Harian ---------- */
PANEL_MAP.kasHarian = renderKasHarian;
AFTER_RENDER.kasHarian = refreshKasHarian;
// Wadah global untuk menyimpan data kas harian yang sedang aktif di layar
let DATA_KAS_AKTIF = {
  saldoAwalMaster: 0,
  groupedData: [],
};

function renderKasHarian() {
  // Set Tanggal Hari Ini untuk Tanggal Akhir
  var today = new Date().toISOString().slice(0, 10);
  // Set 1 Bulan ke belakang untuk Tanggal Awal (Default)
  var lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  var defaultStart = lastMonth.toISOString().slice(0, 10);

  // 1. Reset nomor halaman kas harian ke angka 1 saat menu dibuka pertama kali
  if (APP_PAGINATION_STATE && APP_PAGINATION_STATE.kasHarian) {
    APP_PAGINATION_STATE.kasHarian.current = 1;
  }

  // 2. Gunakan ID unik (fkh_...) dan tambahkan reset halaman pada setiap event onchange sebelum refresh dilakukan
  return `<div class="flt">
      <div class="fg"><label>Tgl Awal</label><input type="date" id="fkh_tgl_awal" value="${defaultStart}" onchange="APP_PAGINATION_STATE.kasHarian.current = 1; refreshKasHarian()"></div>
      <div class="fg"><label>Tgl Akhir</label><input type="date" id="fkh_tgl_akhir" value="${today}" onchange="APP_PAGINATION_STATE.kasHarian.current = 1; refreshKasHarian()"></div>
      <div class="fg"><label>Cabang</label><select id="fkh_cabang" onchange="APP_PAGINATION_STATE.kasHarian.current = 1; refreshKasHarian()">${getCabangOpts("")}</select></div>
      <div class="fg"><label>KodeBank/Kas</label><select id="fkh_kodebank" onchange="APP_PAGINATION_STATE.kasHarian.current = 1; refreshKasHarian()"><option value="">Semua</option></select></div>
      
      <!-- TOMBOL EXPORT -->
      <div class="fg" style="display:flex; align-items:flex-end; padding-bottom:2px;">
        <button class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportKasHarian()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> Export XLS</button>
      </div>
      <div class="fg" style="display:flex; align-items:flex-end; padding-bottom:2px;">
        <button class="btn btn-s" style="background-color:#d93025;color:#fff;" onclick="tutupBukuHarian()">
          <i class="fa-solid fa-save"></i> Tutup Buku / Simpan Saldo
        </button>
      </div>
    </div>
    <div id="kasHarianTbl"></div>
    
    <!-- Wadah tempat tombol navigasi angka halaman digambar oleh sistem -->
    <div id="kasHarianPagination" style="margin-top:12px; display:flex; justify-content:center; align-items:center; gap:5px;"></div>
  `;
}

async function tutupBukuHarian() {
  // 1. Ambil parameter dari filter UI
  var tglAwal = $("fk_tgl_awal").value;
  var tglAkhir = $("fk_tgl_akhir").value;
  var cab = $("fk_cabang").value || "Pusat";
  var selectedChar = $("fk_kodebank").value;
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ Tambahkan filter group agar data konsisten

  console.log(activeGroup);

  if (!selectedChar) {
    if (typeof toast === "function") toast("Pilih Kode Bank/Kas dulu!", "wrn");
    else alert("Pilih Kode Bank/Kas dulu!");
    return;
  }

  // 2. Konfirmasi tindakan pengguna terlebih dahulu
  var ok = confirm(
    `Tutup buku dan perbarui saldo harian?\nPeriode: ${tglAwal} s/d ${tglAkhir}`,
  );
  if (!ok) return;

  // 3. GENERATE SELURUH TANGGAL & HITUNG SALDO PER HARI (DAILY LOOP)
  var daftarSaldoHarian = [];
  var dateStart = new Date(tglAwal);
  var dateEnd = new Date(tglAkhir);

  // Ambil saldo awal mutlak untuk tanggal awal proses
  var runningSaldo = await getSaldoAwalClient(cab, selectedChar, tglAwal);

  // ✅ PERBAIKAN BUG LOOP TANGGAL: Gunakan variabel penanda baru agar tidak merusak objek dateStart asli
  for (var d = new Date(dateStart); d <= dateEnd; d.setDate(d.getDate() + 1)) {
    // ✅ PERBAIKAN TANGGAL ACUAN: Gunakan d.getFullYear() dsb. agar terhindar dari bug timezone minus 1 hari akibat toISOString()
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var tglLoop = yyyy + "-" + mm + "-" + dd;

    // Ambil transaksi khusus untuk tanggal hari berjalan ini
    var transaksiHariIni = (
      Array.isArray(DBCache.transaksi) ? DBCache.transaksi : []
    ).filter(function (t) {
      if (t.tanggal !== tglLoop) return false;
      var tCab = t.cabang || "Pusat";
      if (cab && tCab !== cab) return false;

      // ✅ Tambahkan validasi kecocokan group data
      if ((t.group || "TLGA") !== activeGroup) return false;

      var tReff = t.noreff || "";
      var tChar = tReff.length >= 4 ? tReff.charAt(3) : " ";
      return tChar === selectedChar;
    });

    // Hitung mutasi di hari tersebut
    var mutasiHariIni = 0;
    transaksiHariIni.forEach(function (t) {
      var type = (t.noreff || "").substring(0, 2).toLowerCase();
      var amt = num(t.db) || num(t.cr) || num(t.nominal) || 0;
      if (type === "kp") mutasiHariIni += amt;
      else if (type === "kk") mutasiHariIni -= amt;
      else mutasiHariIni += num(t.db) - num(t.cr);
    });

    // Akumulasikan saldo akhir untuk hari berjalan ini
    runningSaldo = runningSaldo + mutasiHariIni;

    daftarSaldoHarian.push({
      tanggal: tglLoop,
      saldoAkhir: runningSaldo,
    });
  }

  // 4. KIRIM DATA KE FUNGSI DATABASE UTAMA
  var hasil = await simpanSnapshotSaldo(
    cab,
    selectedChar,
    tglAwal,
    tglAkhir,
    daftarSaldoHarian,
  );

  if (hasil) {
    if (typeof toast === "function")
      toast(
        "Seluruh data saldo harian periode tersebut berhasil diperbarui!",
        "ok",
      );
    else
      alert("Seluruh data saldo harian periode tersebut berhasil diperbarui!");
    if (typeof refreshKasHarian === "function") refreshKasHarian();
  } else {
    if (typeof toast === "function")
      toast("Gagal memperbarui saldo. Periksa log konsol.", "err");
    else alert("Gagal memperbarui saldo. Periksa log konsol.");
  }
}

async function simpanSnapshotSaldo(
  cabang,
  char4,
  tanggalAwal,
  tanggalAkhir,
  daftarSaldo,
) {
  try {
    const kodeCabang = cabang || "Pusat";
    const kodeChar = char4 || " ";
    const activeGroup = localStorage.getItem("group") || "TLGA";

    console.log("=== MEMULAI ANALISIS PROSES SIMPAN ===");
    console.log(
      "Jumlah baris data terdeteksi:",
      daftarSaldo ? daftarSaldo.length : 0,
    );

    // Endpoint Clear Range
    await fetch(API_BASE_URL + "/api/saldo-harian/clear-range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cabang: kodeCabang,
        char4: kodeChar,
        tanggalAwal: tanggalAwal,
        tanggalAkhir: tanggalAkhir,
        masa: masaFix,
        group: activeGroup, // ✅ Sertakan parameter group saat clear data lama
      }),
    });

    // ✅ PERBAIKAN PAYLOAD: Sesuaikan mapping ID agar unik per group dan gunakan schema document store yang sama dengan POST sebelumnya jika disimpan dalam satu kolom data
    const dataSiapSimpan = daftarSaldo.map((item) => {
      const payloadRaw = {
        id: `${kodeCabang}_${kodeChar}_${activeGroup}_${item.tanggal}`, // ✅ Tambah unsur group di primary key
        cabang: kodeCabang,
        char4: kodeChar,
        tanggal: item.tanggal,
        saldo_akhir: item.saldoAkhir,
        group: activeGroup,
      };

      // Catatan: Jika backend /api/batch/saldo_harian mengharapkan format {id, data: JSON}, gunakan penyesuaian di bawah ini.
      // Namun jika tabel Anda kolomnya bertipe reguler/flat (bukan JSONB), struktur payloadRaw langsung di bawah ini sudah benar:
      return payloadRaw;
    });

    console.log(
      "Jumlah data setelah diformat siap kirim:",
      dataSiapSimpan.length,
    );

    var response = await fetch(API_BASE_URL + `/api/batch/saldo_harian`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataSiapSimpan),
    });

    if (!response.ok) return false;
    return await response.json();
  } catch (error) {
    console.error("Gagal total pada simpanSnapshotSaldo:", error);
    return false;
  }
}

/* ---------- FUNGSI EXPORT KAS HARIAN ---------- */
function exportKasHarian() {
  // 1. Ambil data langsung dari wadah global hasil render layar
  var groupedData = DATA_KAS_AKTIF.groupedData;
  var saldoAwalMaster = DATA_KAS_AKTIF.saldoAwalMaster;

  // 2. Validasi jika data di layar masih kosong
  if (!groupedData || groupedData.length === 0) {
    alert(
      "Tidak ada data di layar yang bisa di-export! Silakan refresh atau pilih filter data terlebih dahulu.",
    );
    return;
  }

  // 3. Ambil parameter tanggal dan cabang hanya untuk penamaan file
  var tglAwal = $("fk_tgl_awal").value;
  var tglAkhir = $("fk_tgl_akhir").value;
  var cab = $("fk_cabang").value;

  // --- 4. BANGUN CSV / EXCEL ---
  var csvContent =
    "Tanggal;Dari/Kepada;No Ref (Unik);Awal;Debit;Kredit;Akhir\r\n";
  var runBal = saldoAwalMaster;
  var totalDb = 0;
  var totalCr = 0;
  var lastDate = null;

  groupedData.forEach(function (t) {
    if (lastDate !== null && lastDate !== t.tanggal) {
      csvContent += ";;;;;;\r\n"; // Baris pemisah antar tanggal
    }
    lastDate = t.tanggal;
    var saldoAwalRow = runBal;
    runBal += t.db - t.cr;
    var cleanDariKe = (t.dariKePada || "").replace(/;/g, ",");
    var cleanReff = (t.noreff || "").replace(/;/g, ",");

    csvContent +=
      t.tanggal +
      ";" +
      cleanDariKe +
      ";" +
      cleanReff +
      ";" +
      saldoAwalRow +
      ";" +
      t.db +
      ";" +
      t.cr +
      ";" +
      runBal +
      "\r\n";

    totalDb += t.db;
    totalCr += t.cr;
  });

  // Baris Total Akumulasi
  csvContent +=
    ";;TOTAL NYA;" +
    groupedData.length +
    " ref;" +
    totalDb +
    ";" +
    totalCr +
    ";" +
    (totalDb - totalCr) +
    "\r\n";

  // --- 5. DOWNLOAD FILE ---
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);
  var namaFile =
    "Laporan_Kas_Harian_" +
    (cab || "Semua") +
    "_" +
    tglAwal +
    "_to_" +
    tglAkhir +
    ".csv";

  link.setAttribute("href", url);
  link.setAttribute("download", namaFile);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof toast === "function") {
    toast("Laporan kas berhasil diunduh.");
  } else {
    alert("Laporan kas berhasil diunduh.");
  }
}
// Pastikan variabel global penampung data kas aktif Anda sudah siap
window.DATA_KAS_AKTIF = window.DATA_KAS_AKTIF || {};

async function refreshKasHarian(isSwitchPage = false) {
  // 1. Validasi Element fisik
  if (
    !$("fkh_tgl_awal") ||
    !$("fkh_tgl_akhir") ||
    !$("fkh_cabang") ||
    !$("fkh_kodebank")
  ) {
    return;
  }

  var tglAwal = $("fkh_tgl_awal").value;
  var tglAkhir = $("fkh_tgl_akhir").value;
  var cab = $("fkh_cabang").value;

  // =========================================================================
  // 🌟 FIX LOGIKA OPTIMASI DROPDOWN BANK
  // Hanya buat ulang daftar dropdown JIKA user mengubah filter utama (bukan saat ganti halaman)
  // =========================================================================
  if (!isSwitchPage) {
    var filteredBanks = DBCache.kodeBank.filter(function (b) {
      if (!cab) return true;
      var bankCabang = b.cabang || "Pusat";
      return bankCabang === cab;
    });

    var digitMap = {};
    filteredBanks.forEach(function (b) {
      var fullKode = b.kodebank || "";
      var char4 = fullKode.length >= 4 ? fullKode.charAt(3) : " ";
      var penj = b.penjelasan || "Bank " + char4;
      if (!digitMap[char4]) digitMap[char4] = [];
      if (digitMap[char4].indexOf(penj) === -1) digitMap[char4].push(penj);
    });

    var uniqueDigits = Object.keys(digitMap).sort();
    var newOpts = uniqueDigits
      .map(function (c) {
        var textPenj = digitMap[c].join(", ");
        var label =
          c === " " || c === ""
            ? "(Spasi) - " + textPenj
            : c + " - " + textPenj;
        return `<option value="${esc(c)}">${esc(label)}</option>`;
      })
      .join("");

    var ddDigit = $("fkh_kodebank");
    if (ddDigit) {
      var oldVal = ddDigit.value;
      ddDigit.innerHTML = '<option value="">Semua</option>' + newOpts;
      var isValid = false;
      if (oldVal !== "") {
        for (var i = 0; i < ddDigit.options.length; i++) {
          if (ddDigit.options[i].value === oldVal) isValid = true;
        }
      }
      ddDigit.value = isValid ? oldVal : "";
    }
  }

  var selectedChar = $("fkh_kodebank").value;

  // --- 2. FILTER DATA TRANSAKSI ---
  var filteredData = DBCache.transaksi.filter(function (t) {
    var isDateOk = true;
    if (tglAwal && tglAkhir) {
      isDateOk = t.tanggal && t.tanggal >= tglAwal && t.tanggal <= tglAkhir;
    } else if (tglAwal) {
      isDateOk = t.tanggal && t.tanggal >= tglAwal;
    } else if (tglAkhir) {
      isDateOk = t.tanggal && t.tanggal <= tglAkhir;
    }
    if (!isDateOk) return false;
    var transCab = t.cabang || "Pusat";
    if (cab && transCab !== cab) return false;
    if (selectedChar !== "") {
      var transReff = t.noreff || "";
      var transChar4 = transReff.length >= 4 ? transReff.charAt(3) : " ";
      if (transChar4 !== selectedChar) return false;
    }
    return true;
  });

  // --- 3. GROUPING DATA ---
  var groupedMap = {};
  filteredData.forEach(function (t) {
    var keyRef = t.noreff || "-";
    var typeIndicator = keyRef.substring(0, 2).toLowerCase();
    var currentDb = 0,
      currentCr = 0;
    var rawAmount =
      num(t.db || 0) ||
      num(t.cr || 0) ||
      num(t.nominal || 0) ||
      num(t.jumlah || 0);

    if (typeIndicator === "kp") {
      currentDb = rawAmount;
    } else if (typeIndicator === "kk") {
      currentCr = rawAmount;
    } else {
      currentDb = num(t.db || 0);
      currentCr = num(t.cr || 0);
    }

    if (!groupedMap[keyRef]) {
      groupedMap[keyRef] = {
        tanggal: t.tanggal || "-",
        dariKePada: t.dariKePada || t.keterangan || "UMUM",
        noreff: keyRef,
        db: 0,
        cr: 0,
        cabang: t.cabang || "Pusat",
      };
    }
    groupedMap[keyRef].db += currentDb;
    groupedMap[keyRef].cr += currentCr;
  });

  var groupedData = Object.values(groupedMap);
  groupedData.sort(function (a, b) {
    var dateComp = a.tanggal.localeCompare(b.tanggal);
    if (dateComp !== 0) return dateComp;
    var suffixA = a.noreff.substring(Math.max(0, a.noreff.length - 8));
    var suffixB = b.noreff.substring(Math.max(0, b.noreff.length - 8));
    return suffixA.localeCompare(suffixB);
  });

  // --- 4. AMBIL SALDO AWAL CLIENT ---
  var saldoAwalMaster = 0;
  if (selectedChar !== "") {
    saldoAwalMaster = await getSaldoAwalClient(cab, selectedChar, tglAwal);
  }

  var rows = [],
    runBal = saldoAwalMaster,
    totalDb = 0,
    totalCr = 0;
  var lastDate = null;

  // --- 5. LOOPING DATA KRONOLOGIS KE ROW TABEL ---
  groupedData.forEach(function (t) {
    // Tambah pemisah visual jika tanggal berganti
    if (lastDate !== null && lastDate !== t.tanggal) {
      rows.push(["", "", "", "", "", "", "", "", ""]);
    }
    lastDate = t.tanggal;
    var saldoAwalRow = runBal;
    runBal += t.db - t.cr;

    var cabangLabel = t.cabang || "-";
    var viewBtnHtml = `<button type="button" class="btn btn-s btn-a" style="padding:2px 6px;" onclick="showDetailReff('${esc(t.noreff)}', '${esc(t.cabang)}')"><i class="fa-solid fa-eye"></i> View</button>`;

    rows.push([
      t.tanggal,
      esc(t.dariKePada).substring(0, 25),
      esc(t.noreff),
      fmtN(saldoAwalRow),
      fmtN(t.db),
      fmtN(t.cr),
      fmtN(runBal),
      esc(cabangLabel),
      viewBtnHtml,
    ]);
    totalDb += t.db;
    totalCr += t.cr;
  });

  // Simpan data state aktif ke global
  DATA_KAS_AKTIF.saldoAwalMaster = saldoAwalMaster;
  DATA_KAS_AKTIF.groupedData = groupedData;

  // Susun Header & Footer Tabel UI
  var headers = [
    "Tanggal",
    "Dari/Kepada",
    "No Ref (Unik)",
    "Awal",
    "Debit",
    "Kredit",
    "Akhir",
    "Cabang",
    "Aksi",
  ];
  var foot = [
    "",
    "",
    "",
    groupedData.length + " ref unik",
    fmtN(totalDb),
    fmtN(totalCr),
    fmtN(totalDb - totalCr),
    "",
    "",
  ];

  // =========================================================================
  // 🌟 AMBIL DATA HALAMAN AKTIF & SLICE DENGAN BENAR
  // =========================================================================
  var tblContainer = $("kasHarianTbl");
  if (tblContainer) {
    const currentPage = APP_PAGINATION_STATE.kasHarian.current || 1;
    const pageSize = APP_PAGINATION_STATE.kasHarian.size || 20;

    const startIndex = (currentPage - 1) * pageSize;
    const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

    // Render Tabel Utama dengan baris terpotong
    tblContainer.innerHTML = wrapTable(
      buildTable(headers, paginatedRows, {
        numCols: [4, 5, 6],
        foot: foot,
        emptyMsg: "Tidak ada data",
      }),
    );

    // 🌟 RENDER NAVIGASI TOMBOL ANGKA DI BAWAH TABEL
    renderPagination("kasHarian", rows.length);
  }
}

// 🌟 MAKSURKAN KE SCOPE GLOBAL WINDOW AGAR BISA DIAKSES OLEH gantiHalamanUniversal
window.refreshKasHarian = refreshKasHarian;

// ====== FILE FRONTEND (Misal: kasharian.js atau app.js) ======
/* ---------- HELPER: AMBIL SALDO AWAL (READ SALDO_HARIAN) ---------- */
async function getSaldoAwalClient(cabang, tglAwal) {
  var cab = cabang || "Pusat";

  // 1. Pastikan data saldo_harian sudah ada di memori (DBCache)
  if (!DBCache.saldo_harian) {
    console.log("Fetching saldo_harian...");
    DBCache.saldo_harian = await db.getAll("saldo_harian");
  }

  // ✅ KEAMAN: Pastikan selalu berupa Array
  var rawSaldoHarian = Array.isArray(DBCache.saldo_harian)
    ? DBCache.saldo_harian
    : typeof DBCache.saldo_harian === "object"
      ? Object.values(DBCache.saldo_harian || {})
      : [];

  // 2. CARI SALDO TERAKHIR DI TABEL saldo_harian SEBELUM tglAwal
  var listSaldo = rawSaldoHarian.filter(function (s) {
    // Flexibilitas nama kolom cabang (kode_cabang atau cabang)
    var sCab = s.kode_cabang || s.cabang || "Pusat";
    if (sCab !== cab) return false;

    // Flexibilitas nama kolom tanggal (tgl_awal atau tanggal)
    var sTgl = s.tgl_awal || s.tanggal || "";
    // Cari yang tanggalnya sebelum tglAwal
    return sTgl < tglAwal;
  });

  // Urutkan dari tanggal terbesar ke terkecil (DESC)
  listSaldo.sort(function (a, b) {
    var tglA = a.tgl_awal || a.tanggal || "";
    var tglB = b.tgl_awal || b.tanggal || "";
    return tglB.localeCompare(tglA);
  });

  // Ambil data paling atas (paling mendekati tglAwal)
  if (listSaldo.length > 0) {
    var saldoTerakhir = listSaldo[0];
    // Flexibilitas nama kolom saldo akhir (saldo akhir, saldoakhir, atau akhir)
    return num(
      saldoTerakhir["saldo akhir"] ||
        saldoTerakhir.saldoakhir ||
        saldoTerakhir.akhir ||
        0,
    );
  }

  // 3. FALLBACK: Jika tidak ada riwayat di saldo_harian, ambil dari saldokasirawal
  if (!DBCache.saldokasirawal) {
    console.log("Fetching saldokasirawal...");
    DBCache.saldokasirawal = await db.getAll("saldokasirawal");
  }

  var listSaldoAwal = (DBCache.saldokasirawal || []).filter(function (s) {
    var sCab = s.kode_cabang || s.cabang || "Pusat";
    if (sCab !== cab) return false;

    var sTgl = s.tgl_awal || s.tanggal || "";
    return sTgl < tglAwal;
  });

  listSaldoAwal.sort(function (a, b) {
    var tglA = a.tgl_awal || a.tanggal || "";
    var tglB = b.tgl_awal || b.tanggal || "";
    return tglB.localeCompare(tglA);
  });

  if (listSaldoAwal.length > 0) {
    var saldoTerakhir = listSaldoAwal[0];
    return num(
      saldoTerakhir["saldo akhir"] ||
        saldoTerakhir.saldoakhir ||
        saldoTerakhir.akhir ||
        0,
    );
  }

  // Jika dari kedua tabel tidak ada, kembalikan 0
  return 0;
}
// --- FUNGSI MODAL RINCIAN (UPDATE: TAMBAH KOLOM CABANG & SUPPORT SEMUA CABANG) ---
// --- FUNGSI MODAL RINCIAN (VERSI SPESIFIK: MENGUNCI SESUAI BARIS YANG DIKLIK) ---
function showDetailReff(noReff, rowCabang) {
  // ✅ 1. TARGET CABANG DIAMBIL DARI BARIS YANG DIKLIK
  // Kita mengabaikan filter global ($("fk_cabang")) dan memakai parameter input fungsi ini.
  var targetCab = rowCabang || "Pusat";

  // ✅ 2. FILTER TRANSAKSI (STRICT: NO REF + CABANG BARIS)
  var detailData = DBCache.transaksi.filter(function (t) {
    // Cek No Ref
    if (t.noreff !== noReff) return false;

    // Cek Cabang: Harus sama persis dengan cabang di baris tabel yang diklik
    if (String(t.cabang || "Pusat") !== String(targetCab)) {
      return false;
    }

    return true;
  });

  if (detailData.length === 0) {
    alert("Detail transaksi tidak ditemukan untuk Cabang: " + targetCab);
    return;
  }

  // ✅ 3. BUILD TABEL HTML
  var subRows = detailData
    .map(function (t) {
      var noPerkiraan =
        t.noperkiraan || t.noPerkiraan || t.kodeAkun || t.akun || "-";
      var description = t.desc || t.keterangan || t.dariKePada || "-";

      // Ambil Label Cabang untuk tampilan yang lebih rapi di modal
      var cabangLabel = lookupCabangLabel(t.cabang) || t.cabang || "Pusat";

      return (
        "<tr>" +
        '<td style="padding:8px; border:1px solid #ddd;">' +
        esc(t.tanggal || "-") +
        "</td>" +
        '<td style="padding:8px; border:1px solid #ddd;">' +
        esc(noPerkiraan) +
        "</td>" +
        '<td style="padding:8px; border:1px solid #ddd;">' +
        esc(description) +
        "</td>" +
        '<td style="padding:8px; border:1px solid #ddd; text-align:right;">' +
        fmtN(num(t.db || 0)) +
        "</td>" +
        '<td style="padding:8px; border:1px solid #ddd; text-align:right;">' +
        fmtN(num(t.cr || 0)) +
        "</td>" +
        // Kolom Cabang di dalam detail
        '<td style="padding:8px; border:1px solid #ddd; font-weight:600; color:var(--accent);">' +
        esc(cabangLabel) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  var html =
    '<div style="font-family:sans-serif; width: 100%; overflow-x: auto;">' +
    '<table style="width:100%; border-collapse:collapse; margin-top:5px; font-size:14px;">' +
    "<thead>" +
    '<tr style="background:#f5f5f5; border-bottom:2px solid #ddd;">' +
    '<th style="padding:8px; text-align:left; border:1px solid #ddd; width:100px;">Tanggal</th>' +
    '<th style="padding:8px; text-align:left; border:1px solid #ddd; width:100px;">No Perkiraan</th>' +
    '<th style="padding:8px; text-align:left; border:1px solid #ddd;">Desc</th>' +
    '<th style="padding:8px; text-align:right; border:1px solid #ddd; width:110px;">Debet</th>' +
    '<th style="padding:8px; text-align:right; border:1px solid #ddd; width:110px;">Kredit</th>' +
    '<th style="padding:8px; text-align:left; border:1px solid #ddd; width:120px;">Cabang</th>' +
    "</tr>" +
    "</thead>" +
    "<tbody>" +
    subRows +
    "</tbody>" +
    "</table>" +
    "</div>";

  var foot =
    '<button type="button" class="btn btn-g" onclick="closeModal()">Tutup</button>';

  // Tampilkan Kode Cabang di Judul Modal agar jelas
  openModal("Rincian: " + noReff + " (" + targetCab + ")", html, foot);

  // Atur ukuran modal agar muat kolom cabang
  var modalFrame =
    document.querySelector(".modal-box") ||
    document.querySelector(".modal-content") ||
    document.querySelector("#modal");

  if (modalFrame) {
    modalFrame.style.width = "100%";
    modalFrame.style.maxWidth = "1000px";
  }
}

/* ---------- Input Harian Layout Panel ---------- */
PANEL_MAP.inputHarian = renderInputHarian;
AFTER_RENDER.inputHarian = refreshInputHarian;

function renderInputHarian() {
  var today = new Date().toISOString().slice(0, 7); // Format YYYY-MM untuk input month

  // 1. Reset nomor halaman ke angka 1 setiap kali menu utama dibuka pertama kali
  if (APP_PAGINATION_STATE && APP_PAGINATION_STATE.inputHarian) {
    APP_PAGINATION_STATE.inputHarian.current = 1;
  }

  // 2. Render UI Filter & Wadah Tabel + Pagination
  return `<div class="flt">
      <div class="fg">
        <label>Periode</label>
        <select id="fi_periode" onchange="APP_PAGINATION_STATE.inputHarian.current = 1; refreshInputHarian(false)">
          <option value="bulan">Bulanan</option>
          <option value="tahun">Tahunan</option>
        </select>
      </div>
      <div class="fg"><label>Bulan/Tahun</label><input type="month" id="fi_bulan" value="${today}" onchange="APP_PAGINATION_STATE.inputHarian.current = 1; refreshInputHarian(false)"></div>
      <div class="fg"><label>Cabang</label><select id="fi_cabang" onchange="APP_PAGINATION_STATE.inputHarian.current = 1; refreshInputHarian(false)">${getCabangOpts("")}</select></div>
      <div class="fg"><label>Kode Trans</label><input type="text" id="fi_ktrans" class="in" placeholder="Semua" oninput="APP_PAGINATION_STATE.inputHarian.current = 1; refreshInputHarian(false)"></div>
      <div class="fg"><label>Min. Nilai</label><input type="number" id="fi_nilai" class="in" value="0" oninput="APP_PAGINATION_STATE.inputHarian.current = 1; refreshInputHarian(false)"></div>
      <div class="fg">
        <label>Golongan</label>
        <select id="fi_gol" onchange="APP_PAGINATION_STATE.inputHarian.current = 1; refreshInputHarian(false)">
          <option value="">Semua</option>
        </select>
      </div>
      <div class="fg" style="display:flex; align-items:flex-end; padding-bottom:2px;">
        <button class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportInputHarian()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> Export XLS</button>
      </div>
    </div>
    <div id="inputHarianTbl"></div>
    
    <!-- 🌟 WADAH ELEMEN PAGINATION HARIAN DENGAN ID YANG SESUAI TARGET STATE -->
    <div id="inputHarianPagination" style="margin-top:12px; display:flex; justify-content:center; align-items:center; gap:5px;"></div>`;
}

// Pastikan variabel penampung cache global Anda sudah dideklarasikan di luar fungsi
var CACHE_INPUT_HARIAN_FILTERED = CACHE_INPUT_HARIAN_FILTERED || [];
var FOOTER_INPUT_HARIAN_TOTAL = FOOTER_INPUT_HARIAN_TOTAL || [];

async function refreshInputHarian(isSwitchPage = false) {
  if (
    !$("fi_periode") ||
    !$("fi_bulan") ||
    !$("fi_cabang") ||
    !$("fi_ktrans") ||
    !$("fi_nilai") ||
    !$("fi_gol")
  ) {
    return;
  }

  // 🌟 FIX LOGIKA OPTIMASI:
  // Jika variabel cache sudah ada isinya DAN parameter isSwitchPage bernilai true,
  // LANGSUNG LOMPAT KE TAHAP RENDER tanpa menyentuh IndexedDB lagi.
  if (isSwitchPage && CACHE_INPUT_HARIAN_FILTERED.length > 0) {
    // Lewati proses pembacaan DB, langsung lanjut ke bagian bawah (Render UI)
  } else {
    // 🌟 Jika isSwitchPage = false (Tombol Terapkan diklik / awal muat), lakukan filter ulang penuh
    var periode = $("fi_periode").value,
      bln = $("fi_bulan").value,
      cab = $("fi_cabang").value,
      ktrans = $("fi_ktrans").value,
      nilai = num($("fi_nilai").value),
      gol = $("fi_gol").value;

    // Ambil data langsung dari db IndexedDB
    var rawData = await db.getAll("transaksi");
    var data = (rawData || []).slice();

    // --- 1. FILTER PERIODE WAKTU ---
    if (periode === "bulan" && bln) {
      data = data.filter(function (t) {
        return t.tanggal && t.tanggal.startsWith(bln);
      });
    } else if (periode === "tahun" && bln) {
      var tahunSaja = bln.substring(0, 4);
      data = data.filter(function (t) {
        return t.tanggal && t.tanggal.startsWith(tahunSaja);
      });
    }

    // --- 2. FILTER KODE TRANSAKSI ---
    if (ktrans) {
      data = data.filter(function (t) {
        return t.kodeTrans === ktrans;
      });
    }

    // --- 3. FILTER CABANG ---
    if (cab) {
      data = data.filter(function (t) {
        return (t.cabang || "Pusat") === cab;
      });
    }

    // --- 4. FILTER NOMINAL NILAI ---
    if (nilai > 0) {
      data = data.filter(function (t) {
        var nilaiAktif =
          num(t.total) ||
          num(t.db || 0) ||
          num(t.cr || 0) ||
          num(t.nominal || 0);
        return nilaiAktif >= nilai;
      });
    }

    // --- 5. FILTER GOLONGAN PERKIRAAN ---
    if (gol) {
      var gp = DBCache.perkiraan
        .filter(function (p) {
          return p.gol === gol;
        })
        .map(function (p) {
          return p.noPerk || p.noperkiraan || p.kode_akun;
        });

      if (gp.length) {
        data = data.filter(function (t) {
          var akunTransaksi =
            t.noperkiraan || t.noPerkiraan || t.kodeTrans || "";
          return gp.indexOf(akunTransaksi) !== -1;
        });
      } else {
        data = [];
      }
    }

    // --- 6. URUTKAN DATA KRONOLOGIS ---
    data.sort(function (a, b) {
      var dateComp = (a.tanggal || "").localeCompare(b.tanggal || "");
      if (dateComp !== 0) return dateComp;
      return (a.id || "").localeCompare(b.id || "");
    });

    // Simpan hasil data terfilter ke memori agar bisa dipakai instan saat ganti halaman
    CACHE_INPUT_HARIAN_FILTERED = data;

    // Hitung akumulasi total di footer
    var sumTotal = 0,
      sumDb = 0,
      sumCr = 0;
    data.forEach(function (r) {
      var keyRef = r.noreff || "";
      var indicator = keyRef.charAt(1).toLowerCase();
      var rawAmount =
        num(r.total) || num(r.db || 0) || num(r.cr || 0) || num(r.nominal || 0);

      if (indicator === "p") {
        sumCr += rawAmount;
      } else if (indicator === "k") {
        sumDb += rawAmount;
      } else {
        sumDb += num(r.db || 0);
        sumCr += num(r.cr || 0);
      }
      sumTotal += rawAmount;
    });

    FOOTER_INPUT_HARIAN_TOTAL = [
      "",
      "",
      "",
      "",
      fmtN(sumTotal),
      fmtN(sumDb),
      fmtN(sumCr),
      "",
    ];
  }

  // =========================================================================
  // 🌟 PROSES PAGINATION LAZY RENDER (SANGAT CEPAT & RINGAN)
  // =========================================================================
  var tblContainer = $("inputHarianTbl");
  if (tblContainer) {
    const totalDataLength = CACHE_INPUT_HARIAN_FILTERED.length;

    // Ambil penanda indeks halaman aktif berdasarkan state universal harian
    const currentPage = APP_PAGINATION_STATE.inputHarian.current || 1;
    const pageSize = APP_PAGINATION_STATE.inputHarian.size || 20;

    const startIndex = (currentPage - 1) * pageSize;

    // Potong data objek mentah per halaman aktif
    const paginatedData = CACHE_INPUT_HARIAN_FILTERED.slice(
      startIndex,
      startIndex + pageSize,
    );

    // Pemetaan data hanya berjalan sebanyak 20 baris data aktif saja
    var paginatedRows = paginatedData.map(function (r) {
      var keyRef = r.noreff || "";
      var indicator = keyRef.charAt(1).toLowerCase();
      var currentDb = 0,
        currentCr = 0;
      var rawAmount =
        num(r.total) || num(r.db || 0) || num(r.cr || 0) || num(r.nominal || 0);

      if (indicator === "p") {
        currentCr = rawAmount;
      } else if (indicator === "k") {
        currentDb = rawAmount;
      } else {
        currentDb = num(r.db || 0);
        currentCr = num(r.cr || 0);
      }

      var isiDesc = r.desc || r.keterangan || "-";
      var acct = r.noperkiraan || "-";
      return [
        esc(r.tanggal || "-"),
        esc(keyRef || "-"),
        esc(acct || "-"),
        esc(isiDesc).substring(0, 25),
        fmtN(rawAmount),
        fmtN(currentDb),
        fmtN(currentCr),
        esc(lookupCabangLabel(r.cabang) || "Pusat"),
      ];
    });

    // Kirim data terpotong ke buildTable
    tblContainer.innerHTML = wrapTable(
      buildTable(
        ["Tanggal", "No Ref", "No Acct", "Desc", "Total", "DB", "CR", "Cabang"],
        paginatedRows,
        {
          numCols: [4, 5, 6],
          foot: FOOTER_INPUT_HARIAN_TOTAL,
          emptyMsg: "Tidak ada data",
        },
      ),
    );

    // Panggil fungsi render navigasi tombol halaman universal
    renderPagination("inputHarian", totalDataLength);
  }
}

// 🌟 DAFTARKAN KE GLOBAL WINDOW AGAR BISA DIAKSES OLEH gantiHalamanUniversal
window.refreshInputHarian = refreshInputHarian;
// 🌟 1. BUAT VARIABEL MEMORI LOKAL (Letakkan di luar fungsi / di bagian atas file)

function exportInputHarian() {
  if (
    !$("fi_periode") ||
    !$("fi_bulan") ||
    !$("fi_cabang") ||
    !$("fi_ktrans") ||
    !$("fi_nilai") ||
    !$("fi_gol")
  ) {
    return;
  }

  var periode = $("fi_periode").value,
    bln = $("fi_bulan").value,
    cab = $("fi_cabang").value,
    ktrans = $("fi_ktrans").value,
    nilai = num($("fi_nilai").value),
    gol = $("fi_gol").value;

  var data = DBCache.transaksi.slice();

  // --- 1. FILTER DATA (Sama persis dengan filter refresh tabel) ---
  if (periode === "bulan" && bln) {
    data = data.filter(function (t) {
      return t.tanggal && t.tanggal.startsWith(bln);
    });
  } else if (periode === "tahun" && bln) {
    var tahunSaja = bln.substring(0, 4);
    data = data.filter(function (t) {
      return t.tanggal && t.tanggal.startsWith(tahunSaja);
    });
  }

  if (ktrans) {
    data = data.filter(function (t) {
      return t.kodeTrans === ktrans;
    });
  }
  if (cab) {
    data = data.filter(function (t) {
      return (t.cabang || "Pusat") === cab;
    });
  }

  if (nilai > 0) {
    data = data.filter(function (t) {
      var nilaiAktif =
        num(t.total) || num(t.db || 0) || num(t.cr || 0) || num(t.nominal || 0);
      return nilaiAktif >= nilai;
    });
  }

  if (gol) {
    var gp = DBCache.perkiraan
      .filter(function (p) {
        return p.gol === gol;
      })
      .map(function (p) {
        return p.noPerk || p.noperkiraan || p.kode_akun;
      });
    if (gp.length) {
      data = data.filter(function (t) {
        var akunTransaksi = t.noperkiraan || t.noPerkiraan || t.kodeTrans || "";
        return gp.indexOf(akunTransaksi) !== -1;
      });
    } else {
      data = [];
    }
  }

  // --- 2. SORT DATA BERDASARKAN TANGGAL KRONOLOGIS ---
  data.sort(function (a, b) {
    var dateComp = (a.tanggal || "").localeCompare(b.tanggal || "");
    if (dateComp !== 0) return dateComp;
    return (a.id || "").localeCompare(b.id || "");
  });

  // --- 3. STRUKTURISASI DATA CSV EXCEL (7 KOLOM) ---
  var csvContent = "Tanggal;No Ref;Desc;Total;DB;CR;Cabang\r\n";

  var sumTotal = 0,
    sumDb = 0,
    sumCr = 0;

  data.forEach(function (r) {
    var keyRef = r.noreff || "";
    var indicator = keyRef.charAt(1).toLowerCase();

    var currentDb = 0;
    var currentCr = 0;
    var rawAmount =
      num(r.total) || num(r.db || 0) || r.cr || 0 || num(r.nominal || 0);

    // ATURAN AKUNTANSI TERBARU: p ke CR, k ke DB
    if (indicator === "p") {
      currentCr = rawAmount;
      currentDb = 0;
    } else if (indicator === "k") {
      currentDb = rawAmount;
      currentCr = 0;
    } else {
      currentDb = num(r.db || 0);
      currentCr = num(r.cr || 0);
    }

    sumTotal += rawAmount;
    sumDb += currentDb;
    sumCr += currentCr;

    var cleanDesc = (r.desc || r.keterangan || "-").replace(/;/g, ",");
    var labelCabang = (lookupCabangLabel(r.cabang) || "Pusat").replace(
      /;/g,
      ",",
    );

    csvContent +=
      (r.tanggal || "-") +
      ";" +
      keyRef +
      ";" +
      cleanDesc +
      ";" +
      rawAmount +
      ";" +
      currentDb +
      ";" +
      currentCr +
      ";" +
      labelCabang +
      "\r\n";
  });

  // Baris Total / Footer Spreadsheet
  csvContent +=
    ";;TOTAL NOMINAL;" + sumTotal + ";" + sumDb + ";" + sumCr + ";\r\n";

  // --- 4. PROSES UNDUH FILE ---
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);

  var namaFile =
    "Laporan_Input_Harian_" + (cab || "Semua") + "_" + bln + ".csv";

  link.setAttribute("href", url);
  link.setAttribute("download", namaFile);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof toast === "function")
    toast("Laporan input harian berhasil diunduh.");
}

PANEL_MAP.saldoKasir = renderLaporanSaldoKasir;

// Wadah global untuk menyimpan data kasir yang sedang aktif di layar
let DATA_KASIR_AKTIF = {
  saldoAwalMaster: 0,
  groupedData: [],
};
// Letakkan di baris global/paling atas file script Anda

function renderLaporanSaldoKasir() {
  var today = new Date().toISOString().slice(0, 10);
  var lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  var defaultStart = lastMonth.toISOString().slice(0, 10);

  // Pastikan state direset ke halaman 1 setiap kali menu laporan dibuka
  if (APP_PAGINATION_STATE && APP_PAGINATION_STATE.kasir) {
    APP_PAGINATION_STATE.kasir.current = 1;
  }

  return `<div class="flt">
      <div class="fg"><label>Tgl Awal</label><input type="date" id="fk_tgl_awal" value="${defaultStart}"></div>
      <div class="fg"><label>Tgl Akhir</label><input type="date" id="fk_tgl_akhir" value="${today}"></div>
      <div class="fg"><label>Cabang</label><select id="fk_cabang">${getCabangOpts("")}</select></div>
      
      <div class="fg" style="display:flex; align-items:flex-end; gap:5px; padding-bottom:2px;">
        <!-- 🌟 FIX: Tombol Terapkan diaktifkan kembali dan menggunakan STATE BARU -->
        <button type="button" class="btn btn-g" style="font-size:.8rem; padding:4px 12px;" onclick="APP_PAGINATION_STATE.kasir.current = 1; refreshSaldoKasir()">Terapkan</button>
        
        <button type="button" class="btn btn-a" style="font-size:.8rem; padding:4px 12px; background:#d93025; border-color:#d93025;" onclick="postingSaldoKasir()"><i class="fa-solid fa-upload"></i> Posting</button>
        <button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportSaldoKasir()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>
      </div>
    </div>
    <div id="kasirTbl"></div>
    <!-- 🌟 WADAH ELEMEN PAGINATION TOMBOL BARU -->
    <div id="kasirPagination" style="margin-top:12px; display:flex; justify-content:center; align-items:center; gap:5px;"></div>`;
}

/* ---------- FUNGSI AMBIL SALDO AWAL DARI TABEL saldokasir ---------- */
async function getSaldoAwalKasir(cabang, tglAwal, group) {
  // Langsung ambil dari memory (DBCache)
  var dataSaldo = DBCache.saldoKasir || [];
  var dataSaldoAwal = DBCache.saldokasirawal || [];

  // 1. Cari di saldoKasir (Urutkan ASC dulu, lalu ambil yang paling mendekati tglAwal)
  dataSaldo.sort(function (a, b) {
    return (a.tgl_awal || "").localeCompare(b.tgl_awal || "");
  });

  // ✅ TAMBAHKAN FILTER GROUP DI SINI
  var found = dataSaldo.filter(function (s) {
    // 🌟 Tambahkan pengecekan cabang agar data tidak bercampur dengan cabang lain
    var isCabangOk =
      !cabang || String(s.cabang || "").trim() === String(cabang).trim();
    var isGroupOk =
      !group || String(s.group || "").trim() === String(group).trim();
    return isCabangOk && isGroupOk && s.tgl_awal <= tglAwal;
  });

  if (found.length > 0) {
    return num(found[found.length - 1].akhir || 0); // Ambil index terakhir
  }

  // 2. Fallback Cari di saldoKasirawal
  dataSaldoAwal.sort(function (a, b) {
    return (a.tgl_awal || "").localeCompare(b.tgl_awal || "");
  });

  // ✅ TAMBAHKAN FILTER GROUP DI SINI JUGA
  var foundAwal = dataSaldoAwal.filter(function (s) {
    var isGroupOk =
      !group || String(s.group || "").trim() === String(group).trim();
    return isGroupOk && s.tgl_awal <= tglAwal;
  });

  if (foundAwal.length > 0) {
    return num(foundAwal[foundAwal.length - 1].akhir || 0);
  }

  // 3. Jika tidak ada sama sekali
  return 0;
}

/* ---------- FUNGSI REFRESH & RENDER TABEL ---------- */
async function refreshSaldoKasir() {
  const tglAwal = $("fk_tgl_awal")?.value || "";
  const tglAkhir = $("fk_tgl_akhir")?.value || "";
  const cab = $("fk_cabang")?.value || "";
  const activeGroup = localStorage.getItem("group") || "TLGA";

  // Validasi input tanggal wajib ada untuk membuat deret waktu
  if (!tglAwal || !tglAkhir) {
    if (typeof toast === "function")
      toast("Tanggal awal dan akhir harus diisi!", "wrn");
    return;
  }

  // =========================================================================
  // 1. AMBIL SALDO AWAL MASTER
  // =========================================================================
  let saldoAwalMaster = await getSaldoAwalKasir(cab, tglAwal, activeGroup);
  saldoAwalMaster = Number(saldoAwalMaster) || 0;

  if (saldoAwalMaster === 0 && typeof toast === "function") {
    toast(
      "Saldo awal Rp 0 (Tidak ditemukan di riwayat untuk group ini). Pastikan data sudah di-Posting.",
      "wrn",
    );
  }

  // =========================================================================
  // 2. AMBIL DATA MUTASI & FILTER SESUAI CABANG + GROUP
  // =========================================================================
  const filteredData = (DBCache.mutasikasir || []).filter((t) => {
    if (!t.tanggal || t.tanggal < tglAwal || t.tanggal > tglAkhir) return false;

    const transCab = t.cabang || "Pusat";
    if (cab && transCab !== cab) return false;

    const transGroup = t.group || "";
    if (activeGroup && transGroup.trim() !== activeGroup.trim()) return false;

    return true;
  });

  // =========================================================================
  // 3. GROUPING DATA BERDASARKAN TANGGAL + NOREFF (AGAR MULTI-REFF PER HARI AMAN)
  // =========================================================================
  const dbMap = {};
  filteredData.forEach((t) => {
    const tgl = t.tanggal;
    const keyRef = t.noreff || t.id || "-";
    const typeIndicator = (t.kodeTrans || "").toUpperCase().trim();

    if (!dbMap[tgl]) dbMap[tgl] = {};
    if (!dbMap[tgl][keyRef]) {
      dbMap[tgl][keyRef] = { db: 0, cr: 0 };
    }

    const nilaiDbAsli = num(t.db || 0);
    const valNominal = num(t.total || 0);
    const nilaiUang = nilaiDbAsli > 0 ? nilaiDbAsli : valNominal;

    // Aturan Akuntansi Akumulasi
    if (["PJ", "TK", "KT"].includes(typeIndicator)) {
      dbMap[tgl][keyRef].db += nilaiUang;
    } else {
      dbMap[tgl][keyRef].cr += nilaiUang;
    }
  });

  // =========================================================================
  // 4. GENERATE KALENDER KONTINU (HARI DEMI HARI) & SUSUN ROW TABEL
  // =========================================================================
  const rows = [];
  let runBal = saldoAwalMaster;
  let totalDb = 0;
  let totalCr = 0;

  // Buat objek Date penanda loop
  let currentDate = new Date(tglAwal);
  const endDate = new Date(tglAkhir);

  while (currentDate <= endDate) {
    const strDate = currentDate.toISOString().slice(0, 10);

    // Periksa apakah ada transaksi di tanggal ini pada database cache
    if (dbMap[strDate]) {
      // Jika ada transaksi, looping semua No Ref unik yang terjadi pada hari tersebut
      const refs = Object.keys(dbMap[strDate]).sort();

      refs.forEach((noreff) => {
        const currentDb = dbMap[strDate][noreff].db;
        const currentCr = dbMap[strDate][noreff].cr;
        const saldoAwalRow = runBal;

        runBal += currentDb - currentCr; // Hitung Running Balance akumulatif

        const aksiHtml = `<button class="btn btn-s" style="padding:2px 8px; font-size:.7rem;" onclick="viewDetailNoreff('${esc(noreff)}')"><i class="fa-solid fa-eye"></i> View</button>`;

        rows.push([
          strDate,
          esc(noreff),
          fmtN(saldoAwalRow),
          fmtN(currentDb),
          fmtN(currentCr),
          fmtN(runBal),
          aksiHtml,
        ]);

        totalDb += currentDb;
        totalCr += currentCr;
      });
    } else {
      // 🌟 UTAMA: Jika tidak ada transaksi sama sekali pada tanggal ini
      const saldoAwalRow = runBal; // Saldo awal hari ini = Saldo akhir hari sebelumnya

      rows.push([
        strDate,
        '<span style="color:#888; font-style:italic;">Tanpa Transaksi</span>',
        fmtN(saldoAwalRow),
        fmtN(0), // Nilai debit = 0
        fmtN(0), // Nilai kredit = 0
        fmtN(runBal), // Saldo akhir tetap sama
        "", // Tanpa tombol aksi karena datanya nihil
      ]);
    }

    // Melangkah ke hari berikutnya (Mencegah infinite loop)
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Simpan data state aktif ke global state penampung Anda
  DATA_KASIR_AKTIF.saldoAwalMaster = saldoAwalMaster;
  DATA_KASIR_AKTIF.groupedData = filteredData; // Menyimpan data murni terfilter

  // =========================================================================
  // 5. SETUP TAMPILAN TABEL UI & NAVIGASI PAGINATION
  // =========================================================================
  const headers = [
    "Tanggal",
    "No Ref",
    "Saldo Awal",
    "Debit (PJ/TK/KT)",
    "Credit (BE/CS/KK/SK)",
    "Saldo Akhir",
    "Aksi",
  ];
  const foot = [
    "",
    `${rows.length} Baris Kalender`,
    "",
    fmtN(totalDb),
    fmtN(totalCr),
    fmtN(saldoAwalMaster + totalDb - totalCr),
    "",
  ];

  const areaTbl = $("kasirTbl");
  if (areaTbl) {
    const currentPage = APP_PAGINATION_STATE.kasir.current || 1;
    const pageSize = APP_PAGINATION_STATE.kasir.size || 20;

    const startIndex = (currentPage - 1) * pageSize;
    const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

    // Render tabel utama menggunakan paginatedRows
    areaTbl.innerHTML = wrapTable(
      buildTable(headers, paginatedRows, {
        numCols: [4, 5, 6],
        foot: foot,
        emptyMsg: "Tidak ada data kalender dalam rentang waktu tersebut",
      }),
    );

    // Gambar ulang tombol navigasi halaman di bawahnya secara dinamis
    renderPagination("kasir", rows.length);
  }
}

// Daftarkan fungsi ke scope global window
window.refreshSaldoKasir = refreshSaldoKasir;

function viewDetailNoreff(noreff) {
  // Ambil data mentah dari cache berdasarkan noreff yang diklik
  var detailTransaksi = (DBCache.mutasikasir || []).filter(function (t) {
    return t.noreff === noreff;
  });

  if (detailTransaksi.length === 0) {
    alert("Detail transaksi tidak ditemukan di cache.");
    return;
  }

  // 1. Buat HTML isi tabelnya saja (Tanpa judul agar judul tidak ikut tergulung/scroll)
  var tableHtml = `
    <table border="1" cellpadding="5" style="width:100%; border-collapse:collapse; font-size:.85rem; border: 1px solid #333333;">
      <tr style="background:#1e1e1e; color:#ffffff; position:sticky; top:0; z-index:10;">
        <th style="border: 1px solid #333333;">Tanggal</th>
        <th style="border: 1px solid #333333;">Kode</th>
        <th style="border: 1px solid #333333;">Keterangan</th>
        <th style="border: 1px solid #333333; text-align:right;">Debit</th>
        <th style="border: 1px solid #333333; text-align:right;">Credit</th>
      </tr>
  `;

  detailTransaksi.forEach(function (d) {
    // 🌟 PERUBAHAN UTAMA: Deteksi indikator kodeTrans (Contoh: "BE", "PJ", "TK")
    var typeIndicator = (d.kodeTrans || "").toUpperCase().trim();

    // Ambil nilai angka (prioritas kolom db, jika 0 pakai kolom total)
    var nilaiDbAsli = num(d.db || 0);
    var valNominal = num(d.total || 0);
    var nilaiUang = nilaiDbAsli > 0 ? nilaiDbAsli : valNominal;

    var tampilDb = 0;
    var tampilCr = 0;

    // Pisahkan posisi nilai berdasarkan aturan kodeTrans resmi
    if (["PJ", "TK", "KT"].includes(typeIndicator)) {
      tampilDb = nilaiUang;
      tampilCr = 0;
    } else {
      tampilCr = nilaiUang;
      tampilDb = 0;
    }

    tableHtml += `
      <tr style="background:#121212; color:#e0e0e0;">
        <td style="border: 1px solid #333333;">${d.tanggal || "-"}</td>
        <td style="border: 1px solid #333333;">${d.kodeTrans || "-"}</td>
        <td style="border: 1px solid #333333;">${d.desc || "-"}</td>
        <!-- Cetak nilai sesuai hasil seleksi kodeTrans di atas -->
        <td style="border: 1px solid #333333; text-align:right; color:#4caf50;">${tampilDb > 0 ? fmtN(tampilDb) : "-"}</td>
        <td style="border: 1px solid #333333; text-align:right; color:#f44336;">${tampilCr > 0 ? fmtN(tampilCr) : "-"}</td>
      </tr>
    `;
  });
  tableHtml += `</table>`;

  // 2. Gabungkan struktur layout utama (Judul fixed di atas, Tabel di tengah bisa scroll, Tombol di bawah)
  var fullHtml = `
    <div style="color:#ffffff; background:#121212; display:flex; flex-direction:column; gap:10px;">
      <h4 style="margin:0; padding-bottom:5px; border-bottom:1px solid #333333; color:#ffffff;">Detail Transaksi: ${noreff}</h4>
      
      <!-- Area kontainer scroll khusus untuk tabel data -->
      <div style="max-height:300px; overflow-y:auto; padding-right:5px;">
        ${tableHtml}
      </div>
      
      <!-- Area bawah khusus tombol aksi (Terpisah dari scrollbar) -->
      <div style="display:flex; justify-content:flex-end; margin-top:5px; padding-top:10px; border-top:1px solid #333333;">
        <button onclick="document.getElementById('modal_view_temp') ? document.getElementById('modal_view_temp').remove() : (typeof closeModal === 'function' ? closeModal() : null)" 
                style="background:#333333; color:#ffffff; border:1px solid #444444; padding:6px 16px; border-radius:4px; cursor:pointer; font-size:.8rem; font-weight:600;"
                onmouseover="this.style.background='#444444'" 
                onmouseout="this.style.background='#333333'">
          Tutup
        </button>
      </div>
    </div>
  `;

  // Tampilkan menggunakan modal/popup
  if (typeof showModal === "function") {
    showModal("Detail " + noreff, fullHtml);
  } else {
    // Fallback: Buat modal layout box baru jika tidak ada fungsi showModal bawaan aplikasi
    var modalDiv = document.getElementById("modal_view_temp");
    if (modalDiv) modalDiv.remove(); // Hapus modal lama jika masih menggantung

    modalDiv = document.createElement("div");
    modalDiv.id = "modal_view_temp";
    modalDiv.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:9999;";
    modalDiv.innerHTML = `<div style="background:#121212; border: 1px solid #333333; padding:15px; border-radius:8px; width:650px; max-width:92%; box-shadow: 0 4px 25px rgba(0,0,0,0.6);">
      ${fullHtml}
    </div>`;
    document.body.appendChild(modalDiv);

    // Tutup modal jika area background transparan di luar box diklik
    modalDiv.addEventListener("click", function (e) {
      if (e.target === modalDiv) modalDiv.remove();
    });
  }
}

async function postingSaldoKasir() {
  // 1. Ambil parameter dari filter UI
  var tglAwal = $("fk_tgl_awal")?.value || "";
  var tglAkhir = $("fk_tgl_akhir")?.value || "";
  var cab = $("fk_cabang")?.value || "Pusat";

  if (!tglAwal || !tglAkhir) {
    if (typeof toast === "function")
      toast("Pilih tanggal awal dan akhir terlebih dahulu", "err");
    else alert("Pilih tanggal awal dan akhir terlebih dahulu");
    return;
  }

  // Pengaman Group dari Session / LocalStorage
  var rawGroup = localStorage.getItem("group");
  var activeGroup = "TLGA";
  if (
    rawGroup &&
    rawGroup.trim() !== "" &&
    rawGroup.trim().toUpperCase() !== "UNDEFINED"
  ) {
    activeGroup = rawGroup.trim().toUpperCase();
  }

  var confirmMsg =
    "POSTING SALDO KASIR HARIAN (KALENDER KONTINU)\n\n" +
    "Cabang: " +
    cab +
    "\n" +
    "Periode: " +
    tglAwal +
    " s/d " +
    tglAkhir +
    "\n" +
    "Group: " +
    activeGroup +
    "\n\n" +
    "Seluruh data harian (termasuk tanggal kosong tanpa transaksi) akan dikalkulasi ulang secara runtut dan disimpan ke Database.\nLanjutkan?";

  if (!confirm(confirmMsg)) return;

  try {
    // ====================================================================
    // 1. AMBIL ULANG DATA MUTASI & SALDO AWAL (SAMA SEPERTI REFRESH)
    // ====================================================================
    let saldoAwalMaster = await getSaldoAwalKasir(cab, tglAwal, activeGroup);
    saldoAwalMaster = Number(saldoAwalMaster) || 0;

    const filteredData = (DBCache.mutasikasir || []).filter((t) => {
      if (!t.tanggal || t.tanggal < tglAwal || t.tanggal > tglAkhir)
        return false;
      const transCab = t.cabang || "Pusat";
      if (cab && transCab !== cab) return false;
      const transGroup = t.group || "";
      if (activeGroup && transGroup.trim() !== activeGroup.trim()) return false;
      return true;
    });

    // Map Rekap Mutasi Berdasarkan Tanggal (Digabung untuk total harian)
    const dbMapHarian = {};
    filteredData.forEach((t) => {
      const tgl = t.tanggal;
      const typeIndicator = (t.kodeTrans || "").toUpperCase().trim();

      if (!dbMapHarian[tgl]) {
        dbMapHarian[tgl] = { db: 0, cr: 0 };
      }

      const nilaiDbAsli = num(t.db || 0);
      const valNominal = num(t.total || 0);
      const nilaiUang = nilaiDbAsli > 0 ? nilaiDbAsli : valNominal;

      if (["PJ", "TK", "KT"].includes(typeIndicator)) {
        dbMapHarian[tgl].db += nilaiUang;
      } else {
        dbMapHarian[tgl].cr += nilaiUang;
      }
    });

    // ====================================================================
    // 2. GENERATE KALENDER KONTINU UNTUK ARRAY DATA POSTING
    // ====================================================================
    var arrDataUntukDisimpan = [];
    let runBal = saldoAwalMaster;

    let currentDate = new Date(tglAwal);
    const endDate = new Date(tglAkhir);

    while (currentDate <= endDate) {
      const strDate = currentDate.toISOString().slice(0, 10);

      let dayDb = 0;
      let dayCr = 0;

      // Jika hari ini ada transaksi, ambil total mutasinya
      if (dbMapHarian[strDate]) {
        dayDb = dbMapHarian[strDate].db;
        dayCr = dbMapHarian[strDate].cr;
      }

      const awalHariIni = runBal;
      runBal += dayDb - dayCr; // Hitung akumulasi ke saldo akhir hari ini

      // Logika Masa Pembukuan (YYYY-MM-DD -> MMYY)
      var masaFix = strDate.substring(5, 7) + strDate.substring(2, 4);

      arrDataUntukDisimpan.push({
        id: `${cab}_${cab}_${activeGroup}_${strDate}`,
        masa: masaFix,
        cabang: cab,
        char4: cab,
        tanggal: strDate,
        db: dayDb,
        cr: dayCr,
        saldo_akhir: runBal,
        awal: awalHariIni,
        group: activeGroup,
      });

      // Maju 1 hari
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (arrDataUntukDisimpan.length === 0) {
      if (typeof toast === "function")
        toast("Tidak ada data rentang waktu kalender yang valid.", "wrn");
      return;
    }

    if (typeof toast === "function") {
      toast(
        "Menyimpan " +
          arrDataUntukDisimpan.length +
          " rekaman harian kontinu ke server...",
        "inf",
      );
    }

    // ====================================================================
    // 3. PROSES BERSIHKAN & BATC H SIMPAN KE SERVER VIA API
    // ====================================================================
    // Bersihkan range tanggal lama di server database terlebih dahulu
    await fetch(API_BASE_URL + "/api/saldo-kasir/clear-range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cabang: cab,
        tanggalAwal: tglAwal,
        tanggalAkhir: tglAkhir,
        group: activeGroup,
      }),
    });

    // Kirim batch simpan data baru
    var response = await fetch(API_BASE_URL + `/api/batch/saldokasir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arrDataUntukDisimpan),
    });

    if (!response.ok) {
      var errorData = null;
      try {
        errorData = await response.json();
      } catch (e) {}
      throw new Error(
        errorData?.message ||
          errorData?.msg ||
          "Server error " + response.status,
      );
    }

    // ====================================================================
    // 4. UPDATE LOCAL DBCACHE INDEXEDDB AGAR SYNCHRONOUS
    // ====================================================================
    if (!DBCache.saldokasir) DBCache.saldokasir = [];

    // Filter buang data lama dalam range di memori lokal agar tidak duplikat
    DBCache.saldokasir = DBCache.saldokasir.filter(function (item) {
      return !(
        item.cabang === cab &&
        item.group === activeGroup &&
        item.tanggal >= tglAwal &&
        item.tanggal <= tglAkhir
      );
    });

    // Inject data kalender kontinu yang baru masuk ke memori lokal
    arrDataUntukDisimpan.forEach(function (item) {
      DBCache.saldokasir.push(item);
    });

    // 5. SELESAI & REFRESH TAMPILAN SCREEN
    var pesanSukses =
      "Posting Berhasil!\n" +
      arrDataUntukDisimpan.length +
      " rekaman kalender harian aman tersimpan.";
    if (typeof toast === "function") toast(pesanSukses, "ok");
    else alert(pesanSukses);

    // Refresh otomatis layar kasir agar data running balance yang baru langsung tampil terkunci
    if (typeof refreshSaldoKasir === "function") refreshSaldoKasir();
  } catch (err) {
    console.error("❌ Gagal Posting Saldo Kasir:", err);
    if (typeof toast === "function")
      toast("Gagal posting: " + err.message, "err");
    else alert("Gagal posting: " + err.message);
  }
}

/* ---------- FUNGSI EXPORT KASIR ---------- */
function exportSaldoKasir() {
  // Ambil data acuan dari filter fisik di layar saat ini
  const tglAwal = $("fk_tgl_awal")?.value || "";
  const tglAkhir = $("fk_tgl_akhir")?.value || "";
  const cab = $("fk_cabang")?.value || "Semua";
  const activeGroup = localStorage.getItem("group") || "TLGA";

  if (!tglAwal || !tglAkhir) {
    alert("Tanggal awal dan akhir harus diisi sebelum melakukan export!");
    return;
  }

  const saldoAwalMaster = Number(DATA_KASIR_AKTIF.saldoAwalMaster) || 0;

  // Ambil ulang data terfilter untuk di-looping berdasarkan kalender kontinu
  const filteredData = (DBCache.mutasikasir || []).filter((t) => {
    if (!t.tanggal || t.tanggal < tglAwal || t.tanggal > tglAkhir) return false;

    const transCab = t.cabang || "Pusat";
    if ($("fk_cabang")?.value && transCab !== $("fk_cabang").value)
      return false;

    const transGroup = t.group || "";
    if (activeGroup && transGroup.trim() !== activeGroup.trim()) return false;

    return true;
  });

  // Susun Map Grouping Berdasarkan Tanggal + NoRef (Sama dengan fungsi refresh)
  const dbMap = {};
  filteredData.forEach((t) => {
    const tgl = t.tanggal;
    const keyRef = t.noreff || t.id || "-";
    const typeIndicator = (t.kodeTrans || "").toUpperCase().trim();

    if (!dbMap[tgl]) dbMap[tgl] = {};
    if (!dbMap[tgl][keyRef]) {
      dbMap[tgl][keyRef] = { db: 0, cr: 0 };
    }

    const nilaiDbAsli = num(t.db || 0);
    const valNominal = num(t.total || 0);
    const nilaiUang = nilaiDbAsli > 0 ? nilaiDbAsli : valNominal;

    if (["PJ", "TK", "KT"].includes(typeIndicator)) {
      dbMap[tgl][keyRef].db += nilaiUang;
    } else {
      dbMap[tgl][keyRef].cr += nilaiUang;
    }
  });

  // 🌟 UTAMA: Set Header BOM (\uFEFF) & Judul Kolom CSV
  var csvContent =
    "\uFEFFTanggal;No Ref;Saldo Awal;Debit;Kredit;Saldo Akhir\r\n";

  let runBal = saldoAwalMaster;
  let totalDb = 0;
  let totalCr = 0;
  let rowCount = 0;

  // Jalankan Loop Kalender Kontinu Hari demi Hari
  let currentDate = new Date(tglAwal);
  const endDate = new Date(tglAkhir);

  while (currentDate <= endDate) {
    const strDate = currentDate.toISOString().slice(0, 10);

    if (dbMap[strDate]) {
      const refs = Object.keys(dbMap[strDate]).sort();

      refs.forEach((noreff) => {
        const currentDb = dbMap[strDate][noreff].db;
        const currentCr = dbMap[strDate][noreff].cr;
        const saldoAwalRow = runBal;

        runBal += currentDb - currentCr;
        const cleanReff = noreff.replace(/;/g, ",");

        csvContent += `${strDate};${cleanReff};${saldoAwalRow};${currentDb};${currentCr};${runBal}\r\n`;

        totalDb += currentDb;
        totalCr += currentCr;
        rowCount++;
      });
    } else {
      // 🌟 Masukkan baris Tanpa Transaksi ke dalam file Excel agar konsisten
      const saldoAwalRow = runBal;
      csvContent += `${strDate};Tanpa Transaksi;${saldoAwalRow};0;0;${runBal}\r\n`;
      rowCount++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Baris Total Akhir Laporan
  var totalAkhirFinal = saldoAwalMaster + totalDb - totalCr;
  csvContent += `;;TOTAL;${totalDb};${totalCr};${totalAkhirFinal}\r\n`;

  // PROSES PROSES DOWNLOAD FILE CSV
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);
  var namaFile =
    "Laporan_SaldoKasir_" +
    cab.replace(/[^a-zA-Z0-9]/g, "_") +
    "_" +
    tglAwal +
    "_to_" +
    tglAkhir +
    ".csv";

  link.setAttribute("href", url);
  link.setAttribute("download", namaFile);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof toast === "function") {
    toast("Laporan Saldo Kasir Kontinu berhasil diunduh.");
  }
}

function renderPagination(moduleKey, totalItems) {
  var state = APP_PAGINATION_STATE[moduleKey];
  if (!state) return;

  // 🌟 FIX BUG: Otomatis mendeteksi selector ID murni tanpa tanda pagar '#'
  var areaPage = document.getElementById(state.target);
  if (!areaPage && typeof $ === "function") {
    // fallback jika state.target Anda menggunakan format '#id' di kemudian hari
    var elementJQuery = $(state.target);
    areaPage =
      elementJQuery && elementJQuery.length > 0 ? elementJQuery[0] : null;
  }

  if (!areaPage) return;

  var totalPages = Math.ceil(totalItems / state.size) || 1;

  // Jika hanya ada 1 halaman, kosongkan kontainer
  if (totalPages <= 1) {
    areaPage.innerHTML = "";
    return;
  }

  var current = state.current;
  var html = "";

  // 1. Tombol Back / Sebelumnya
  var disablePrev = current === 1 ? "disabled" : "";
  html += `<button class="btn btn-s" ${disablePrev} style="padding:4px 10px; font-size:.75rem;" onclick="gantiHalamanUniversal('${moduleKey}', ${current - 1})"><i class="fa-solid fa-angle-left"></i> Prev</button>`;

  // 2. Batasi Angka Halaman (Maksimal 5 tombol angka)
  var startPage = Math.max(1, current - 2);
  var endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

  for (var i = startPage; i <= endPage; i++) {
    var isActive = i === current;
    var bgStyle = isActive
      ? "background:#1e1e1e; color:#fff; font-weight:bold; border-color:#333;"
      : "background:#fff; color:#333;";
    html += `<button class="btn" style="padding:4px 10px; font-size:.75rem; ${bgStyle}" onclick="gantiHalamanUniversal('${moduleKey}', ${i})">${i}</button>`;
  }

  // 3. Tombol Next / Selanjutnya
  var disableNext = current === totalPages ? "disabled" : "";
  html += `<button class="btn btn-s" ${disableNext} style="padding:4px 10px; font-size:.75rem;" onclick="gantiHalamanUniversal('${moduleKey}', ${current + 1})">Next <i class="fa-solid fa-angle-right"></i></button>`;

  // 4. Informasi teks kecil pendukung
  html += `<span style="font-size:.75rem; margin-left:10px; color:#555;">Hal ${current} dari ${totalPages} (Total ${totalItems} baris)</span>`;

  areaPage.innerHTML = html;
}

// =========================================================================
// 4. FUNGSI TRIGGER PERPINDAHAN HALAMAN (Sudah Sesuai)
// =========================================================================
function gantiHalamanUniversal(moduleKey, targetPage) {
  APP_PAGINATION_STATE[moduleKey].current = targetPage;

  var namaFungsiRefresh = APP_PAGINATION_STATE[moduleKey].func;
  if (typeof window[namaFungsiRefresh] === "function") {
    window[namaFungsiRefresh]();
  }
}
