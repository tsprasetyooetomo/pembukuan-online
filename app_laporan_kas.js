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

  // Ambil group aktif dari session browser untuk dilempar ke parameter getGroupOpts
  var activeGroupSession = localStorage.getItem("group") || "";

  // 2. Render UI Filter - Semua dropdown dan tombol dipaksa lurus horizontal sejajar satu baris
  return `<div class="flt" style="display: flex; flex-direction: row; flex-wrap: nowrap !important; gap: .6rem; align-items: flex-end; justify-content: flex-start; height: auto !important; padding: .6rem; min-height: 45px; overflow-x: auto; width: 100%;">
      
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Tgl Awal</label>
        <input type="date" id="fkh_tgl_awal" value="${defaultStart}" onchange="if(APP_PAGINATION_STATE?.kasHarian) APP_PAGINATION_STATE.kasHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
      </div>
      
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Tgl Akhir</label>
        <input type="date" id="fkh_tgl_akhir" value="${today}" onchange="if(APP_PAGINATION_STATE?.kasHarian) APP_PAGINATION_STATE.kasHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
      </div>
      
      <!-- 🌟 ELEMEN GROUP: SEKARANG 100% DINAMIS MENGGUNAKAN FUNGSI getGroupOpts() ANDA -->
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Group</label>
        <select id="fkh_group" onchange="if(APP_PAGINATION_STATE?.kasHarian) APP_PAGINATION_STATE.kasHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
          ${getGroupOpts(activeGroupSession)}
        </select>
      </div>

      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Cabang</label>
        <select id="fkh_cabang" onchange="if(APP_PAGINATION_STATE?.kasHarian) APP_PAGINATION_STATE.kasHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
          ${getCabangOpts("")}
        </select>
      </div>
      
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 130px; min-width: 110px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">KodeBank/Kas</label>
        <select id="fkh_kodebank" onchange="if(APP_PAGINATION_STATE?.kasHarian) APP_PAGINATION_STATE.kasHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
          <option value="">Semua</option>
        </select>
      </div>
      
      <!-- TOMBOL TERAPKAN MANUAL -->
      <div class="fg" style="flex: 0 0 auto;">
        <button class="btn btn-b" style="background-color: #0284c7 !important; color: #fff !important; border-color: #0284c7 !important; padding: 0 .8rem; border-radius: 4px; font-size: .75rem; font-weight: bold; cursor: pointer; white-space: nowrap; height: 32px; display: flex; align-items: center; gap: 4px;" onclick="refreshKasHarian(false)" title="Terapkan Filter">
          <i class="fa-solid fa-filter"></i> Terapkan
        </button>
      </div>

      <!-- TOMBOL EXPORT -->
      <div class="fg" style="flex: 0 0 auto;">
        <button class="btn btn-s" style="background-color: #107c41 !important; color: #fff !important; border-color: #107c41 !important; padding: 0 .8rem; border-radius: 4px; font-size: .75rem; font-weight: bold; cursor: pointer; white-space: nowrap; height: 32px; display: flex; align-items: center; gap: 4px;" onclick="exportKasHarian()" title="Download Excel/CSV">
          <i class="fa-solid fa-file-excel"></i> Export XLS
        </button>
      </div>
      
      <!-- TOMBOL TUTUP BUKU -->
      <div class="fg" style="flex: 0 0 auto;">
        <button class="btn btn-s" style="background-color: #8e24aa !important; color: #fff !important; border-color: #8e24aa !important; padding: 0 .8rem; border-radius: 4px; font-size: .75rem; font-weight: bold; cursor: pointer; white-space: nowrap; height: 32px; display: flex; align-items: center; gap: 4px;" onclick="tutupBukuHarian()">
          <i class="fa-solid fa-save"></i> Tutup Buku / Simpan Saldo
        </button>
      </div>
    </div>
    <div id="kasHarianTbl"></div>
    <div id="kasHarianPagination" style="margin-top:12px; display:flex; justify-content:center; align-items:center; gap:5px;"></div>
  `;
}

async function tutupBukuHarian() {
  // 🌟 FIX 1: Ambil data filter secara dinamis dari elemen fkh_...
  var tglAwal = $("fkh_tgl_awal").value;
  var tglAkhir = $("fkh_tgl_akhir").value;
  var cab = $("fkh_cabang").value || "Pusat";
  var selectedChar = $("fkh_kodebank").value;

  // 🔥 PERBAIKAN UTAMA: Ambil nilai Group dari dropdown HTML layar, fallback ke localStorage jika element belum siap
  var activeGroup = $("fkh_group")
    ? $("fkh_group").value
    : localStorage.getItem("group") || "TLGA";

  if (!selectedChar) {
    if (typeof toast === "function") toast("Pilih Kode Bank/Kas dulu!", "wrn");
    else alert("Pilih Kode Bank/Kas dulu!");
    return;
  }

  var ok = confirm(
    `Tutup buku dan perbarui saldo harian?\nPeriode: ${tglAwal} s/d ${tglAkhir}\nGroup: ${activeGroup}\nKode Bank/Kas: ${selectedChar}`,
  );
  if (!ok) return;

  try {
    if (typeof toast === "function")
      toast("Menarik data jurnal transaksi dari server...", "info");

    // Ambil data transaksi spesifik berdasarkan rentang waktu, cabang, dan group akuntansi aktif dari dropdown layar
    var responseTrx = await fetch(
      `/api/data/transaksi?cabang=${encodeURIComponent(cab)}&group=${activeGroup}`,
    );
    if (responseTrx.ok) {
      DBCache.transaksi = await responseTrx.json();
    }
  } catch (err) {
    console.error("Gagal menarik data transaksi pembukuan untuk saldo:", err);
  }

  var daftarSaldoHarian = [];
  var dateStart = new Date(tglAwal);
  var dateEnd = new Date(tglAkhir);

  // Ambil saldo awal mutlak untuk tanggal awal proses
  var runningSaldo = await getSaldoAwalClient(cab, selectedChar, tglAwal);

  // Loop tanggal harian
  for (var d = new Date(dateStart); d <= dateEnd; d.setDate(d.getDate() + 1)) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var tglLoop = yyyy + "-" + mm + "-" + dd;

    var transaksiHariIni = (
      Array.isArray(DBCache.transaksi) ? DBCache.transaksi : []
    ).filter(function (t) {
      if (t.tanggal !== tglLoop) return false;
      var tCab = t.cabang || "Pusat";
      if (cab && tCab !== cab) return false;

      // Validasi kecocokan group data secara dinamis
      if ((t.group || "TLGA") !== activeGroup) return false;

      var tReff = t.noreff || "";
      return tReff.toUpperCase().startsWith(String(selectedChar).toUpperCase());
    });

    // Hitung mutasi di hari tersebut
    var mutasiHariIni = 0;
    transaksiHariIni.forEach(function (t) {
      var keyRef = (t.noreff || "").toLowerCase();
      var amt = num(t.total) || num(t.db || 0) || num(t.cr || 0);

      if (keyRef.includes("kasir") || keyRef.charAt(1) === "p") {
        if (keyRef.includes("k-")) mutasiHariIni += amt;
        else if (keyRef.includes("p-")) mutasiHariIni -= amt;
        else mutasiHariIni += num(t.db || 0) - num(t.cr || 0);
      } else {
        mutasiHariIni += num(t.db || 0) - num(t.cr || 0);
      }
    });

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

    if (typeof refreshKasHarian === "function") refreshKasHarian(false);
  } else {
    if (typeof toast === "function")
      toast("Gagal memperbarui saldo. Periksa log konsol backend Anda.", "err");
    else alert("Gagal memperbarui saldo. Periksa log konsol backend Anda.");
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

    // 🔥 PERBAIKAN UTAMA: Ambil nilai Group dari dropdown HTML layar agar sinkron saat penyimpanan database batch
    const activeGroup = $("fkh_group")
      ? $("fkh_group").value
      : localStorage.getItem("group") || "TLGA";

    var partsMasa = String(tanggalAwal).split("-");
    const calculatedMasaSnapshot = partsMasa[1] + partsMasa[0].substring(2, 4);

    console.log("=== MEMULAI PROSES SIMPAN SALDO HARIAN ===");

    // 1. Bersihkan range lama di backend
    await fetch(window.location.origin + "/api/saldo-harian/clear-range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cabang: kodeCabang,
        char4: kodeChar,
        tanggalAwal: tanggalAwal,
        tanggalAkhir: tanggalAkhir,
        masa: calculatedMasaSnapshot,
        group: activeGroup, // Dikirim secara dinamis
      }),
    });

    // 2. Petakan payload data murni sesuai skema kolom database SQLite
    const dataSiapSimpan = daftarSaldo.map((item) => {
      return {
        id: `${kodeCabang}_${kodeChar}_${activeGroup}_${item.tanggal}`,
        cabang: kodeCabang,
        char4: kodeChar,
        tanggal: item.tanggal,
        saldo_akhir: item.saldoAkhir,
        group: activeGroup,
        masa: calculatedMasaSnapshot,
      };
    });

    // 3. Tembak massal ke batch API
    var response = await fetch(
      window.location.origin + `/api/batch/saldo_harian`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataSiapSimpan),
      },
    );

    if (!response.ok) return false;
    return await response.json();
  } catch (error) {
    console.error("Gagal total pada simpanSnapshotSaldo:", error);
    return false;
  }
}

function exportKasHarian() {
  // 1. Ambil data langsung dari wadah global hasil render layar
  var groupedData = DATA_KAS_AKTIF ? DATA_KAS_AKTIF.groupedData : [];
  var saldoAwalMaster = DATA_KAS_AKTIF
    ? num(DATA_KAS_AKTIF.saldoAwalMaster)
    : 0;

  // 2. Validasi jika data di layar masih kosong
  if (!groupedData || groupedData.length === 0) {
    if (typeof toast === "function") {
      toast(
        "Tidak ada data di layar yang bisa di-export! Silakan klik Terapkan filter data terlebih dahulu.",
        "wrn",
      );
    } else {
      alert(
        "Tidak ada data di layar yang bisa di-export! Silakan klik Terapkan filter data terlebih dahulu.",
      );
    }
    return;
  }

  // 🌟 FIX 1: Ambil parameter filter secara akurat dari ID fkh_... (Termasuk Group baru)
  var tglAwal = $("fkh_tgl_awal") ? $("fkh_tgl_awal").value : "";
  var tglAkhir = $("fkh_tgl_akhir") ? $("fkh_tgl_akhir").value : "";
  var cab = $("fkh_cabang") ? $("fkh_cabang").value : "";
  var grp = $("fkh_group")
    ? $("fkh_group").value
    : localStorage.getItem("group") || "TLGA";

  // --- 3. BANGUN STRUKTUR SPREADSHEET ---
  // 🌟 FIX 2: SUNTIKKAN BOM \uFEFF di awal agar Excel otomatis memisahkan kolom titik koma (;) tanpa berantakan
  var csvContent =
    "\uFEFFTanggal;Dari/Kepada;No Ref (Unik);Awal;Debit;Kredit;Akhir\r\n";
  var runBal = saldoAwalMaster;
  var totalDb = 0;
  var totalCr = 0;
  var lastDate = null;

  groupedData.forEach(function (t) {
    if (lastDate !== null && lastDate !== t.tanggal) {
      csvContent += ";;;;;;\r\n"; // Baris kosong pemisah estetika antar tanggal laporan
    }
    lastDate = t.tanggal;
    var saldoAwalRow = runBal;

    // Akumulasi berjalan untuk kolom saldo awal dan akhir baris
    runBal += num(t.db) - num(t.cr);

    var cleanDariKe = (t.dariKePada || t.desc || "-").replace(/;/g, ",");
    var cleanReff = (t.noreff || "-").replace(/;/g, ",");

    csvContent +=
      (t.tanggal || "-") +
      ";" +
      cleanDariKe +
      ";" +
      cleanReff +
      ";" +
      saldoAwalRow +
      ";" +
      num(t.db) +
      ";" +
      num(t.cr) +
      ";" +
      runBal +
      "\r\n";

    totalDb += num(t.db);
    totalCr += num(t.cr);
  });

  // Baris Total Akumulasi spreadsheet di bagian paling bawah
  csvContent +=
    ";;TOTAL REKAPITULASI;" +
    groupedData.length +
    " ref;" +
    totalDb +
    ";" +
    totalCr +
    ";" +
    (totalDb - totalCr) +
    "\r\n";

  // --- 4. PROSES DOWNLOAD BLOB FILE CSV ---
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);

  // 🌟 FIX 3: Sertakan parameter nama Group (grp) ke dalam penamaan file spreadsheet
  var namaFile =
    "Laporan_Kas_Harian_" +
    (grp || "ALL") +
    "_" +
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
    toast("Laporan kas harian berhasil diunduh.", "ok");
  } else {
    alert("Laporan kas harian berhasil diunduh.");
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
    !$("fkh_kodebank") ||
    !$("fkh_group")
  ) {
    return;
  }

  var tglAwal = $("fkh_tgl_awal").value;
  var tglAkhir = $("fkh_tgl_akhir").value;
  var cab = $("fkh_cabang").value;

  // 🌟 FIX 1: Ambil nilai Group secara dinamis dari dropdown HTML layar
  var activeGroup = $("fkh_group").value;

  // =========================================================================
  // 🌟 OPTIMASI DROPDOWN BANK (Hanya dijalankan saat klik tombol Terapkan)
  // =========================================================================
  if (!isSwitchPage) {
    var bankList = Array.isArray(DBCache.kodeBank) ? DBCache.kodeBank : [];
    var filteredBanks = bankList.filter(function (b) {
      var matchCabang = !cab || (b.cabang || "Pusat") === cab;
      var matchGroup = (b.group || "TLGA") === activeGroup;
      return matchCabang && matchGroup;
    });

    var digitMap = {};
    filteredBanks.forEach(function (b) {
      var fullKode = b.kodebank || b.kode_bank || "";
      // Gunakan karakter ke-4 atau karakter terakhir sebagai penanda unik indeks
      var char4 =
        fullKode.length >= 4 ? fullKode.charAt(3) : fullKode.slice(-1) || " ";
      var penj = b.penjelasan || b.nama_bank || "Bank " + char4;
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
  var tblContainer = $("kasHarianTbl");

  // =========================================================================
  // 🌟 PROSES TARIK DATA & FILTERING (HANYA SAAT KLIK TOMBOL TERAPKAN)
  // =========================================================================
  if (!isSwitchPage) {
    if (tblContainer) {
      tblContainer.innerHTML =
        '<div style="padding:2rem; text-align:center;"><span class="spinner"></span><br>Sedang memuat rekapan kas dari server...</div>';
    }

    try {
      // 🌟 KUNCI LAZY LOADING: Tarik data mutasi spesifik dari server secara terarah
      var url = `/api/data/transaksi?group=${activeGroup}`;
      if (cab) url += `&cabang=${encodeURIComponent(cab)}`;

      var response = await fetch(url);
      if (!response.ok)
        throw new Error("Gagal mengunduh data jurnal dari server");

      var rawServerData = await response.json();
      var dataMutasi = Array.isArray(rawServerData) ? rawServerData : [];

      // --- A. FILTER RENTANG TANGGAL & KODE BANK INDEKS ---
      var filteredData = dataMutasi.filter(function (t) {
        var isDateOk = true;
        if (tglAwal && tglAkhir) {
          isDateOk = t.tanggal && t.tanggal >= tglAwal && t.tanggal <= tglAkhir;
        } else if (tglAwal) {
          isDateOk = t.tanggal && t.tanggal >= tglAwal;
        } else if (tglAkhir) {
          isDateOk = t.tanggal && t.tanggal <= tglAkhir;
        }
        if (!isDateOk) return false;

        // Cocokkan Kode Bank berdasarkan karakter indeks pemicu
        if (selectedChar !== "") {
          var transReff = t.noreff || "";
          var transChar4 = transReff.length >= 4 ? transReff.charAt(3) : " ";
          if (transChar4 !== selectedChar) return false;
        }
        return true;
      });

      // --- B. GROUPING DATA BERDASARKAN NOMOR REFERENSI (NOTAL) ---
      var groupedMap = {};
      filteredData.forEach(function (t) {
        var keyRef = t.noreff || "-";
        var typeIndicator = keyRef.substring(0, 2).toLowerCase();
        var currentDb = 0,
          currentCr = 0;
        var rawAmount = num(t.db || t.total || 0);

        if (keyRef.includes("kasir") || keyRef.charAt(1) === "p") {
          if (keyRef.includes("k-"))
            currentDb = rawAmount; // Masuk
          else if (keyRef.includes("p-"))
            currentCr = rawAmount; // Keluar
          else {
            currentDb = num(t.db || 0);
            currentCr = num(t.cr || 0);
          }
        } else {
          currentDb = num(t.db || 0);
          currentCr = num(t.cr || 0);
        }

        if (!groupedMap[keyRef]) {
          groupedMap[keyRef] = {
            tanggal: t.tanggal || "-",
            dariKePada: t.dariKePada || t.desc || t.keterangan || "UMUM",
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

      // Urutkan data secara kronologis tanggal dan nomor urut akhir nota
      groupedData.sort(function (a, b) {
        var dateComp = a.tanggal.localeCompare(b.tanggal);
        if (dateComp !== 0) return dateComp;
        var suffixA = a.noreff.substring(Math.max(0, a.noreff.length - 8));
        var suffixB = b.noreff.substring(Math.max(0, b.noreff.length - 8));
        return suffixA.localeCompare(suffixB);
      });

      // --- C. AMBIL SALDO AWAL SPREADSHEET ---
      var saldoAwalMaster = 0;
      if (selectedChar !== "") {
        saldoAwalMaster = await getSaldoAwalClient(cab, selectedChar, tglAwal);
      }

      // Simpan data olahan matang ke state global memori aktif halaman
      if (typeof DATA_KAS_AKTIF === "undefined") DATA_KAS_AKTIF = {};
      DATA_KAS_AKTIF.saldoAwalMaster = saldoAwalMaster;
      DATA_KAS_AKTIF.groupedData = groupedData;
    } catch (error) {
      console.error("🔥 Gagal memproses data kas harian:", error.message);
      if (tblContainer)
        tblContainer.innerHTML = `<div style="color:var(--accent); padding:2rem; text-align:center;">⚠️ Gagal memuat data kas: ${error.message}</div>`;
      return;
    }
  }

  // =========================================================================
  // 🌟 PROSES PAGINATION LAZY ROWS GENERATION (HANYA MEMBACA CACHE MATANG)
  // =========================================================================
  var finalGroupedData = DATA_KAS_AKTIF ? DATA_KAS_AKTIF.groupedData || [] : [];
  var finalSaldoMaster = DATA_KAS_AKTIF
    ? num(DATA_KAS_AKTIF.saldoAwalMaster)
    : 0;

  var rows = [],
    runBal = finalSaldoMaster,
    totalDb = 0,
    totalCr = 0;
  var lastDate = null;

  // Bangun seluruh struktur baris kronologis menggunakan data olahan di memori
  finalGroupedData.forEach(function (t) {
    if (lastDate !== null && lastDate !== t.tanggal) {
      rows.push(["", "", "", "", "", "", "", "", ""]); // Baris pemisah visual antar tanggal laporan
    }
    lastDate = t.tanggal;
    var saldoAwalRow = runBal;
    runBal += t.db - t.cr;

    var viewBtnHtml = `<button type="button" class="btn btn-s btn-a" style="padding:2px 6px;" onclick="showDetailReff('${esc(t.noreff)}', '${esc(t.cabang)}', '${esc(t.group)}')"><i class="fa-solid fa-eye"></i> View</button>`;

    rows.push([
      t.tanggal,
      esc(t.dariKePada).substring(0, 25),
      esc(t.noreff),
      fmtN(saldoAwalRow),
      fmtN(t.db),
      fmtN(t.cr),
      fmtN(runBal),
      esc(lookupCabangLabel(t.cabang) || "Pusat"),
      viewBtnHtml,
    ]);
    totalDb += t.db;
    totalCr += t.cr;
  });

  // Susun Footer rekapitulasi data tabel
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
    finalGroupedData.length + " ref unik",
    fmtN(totalDb),
    fmtN(totalCr),
    fmtN(totalDb - totalCr),
    "",
    "",
  ];

  // Ambil halaman pemotongan data aktif
  if (tblContainer) {
    const currentPage = APP_PAGINATION_STATE.kasHarian.current || 1;
    const pageSize = APP_PAGINATION_STATE.kasHarian.size || 20;
    const startIndex = (currentPage - 1) * pageSize;

    // Potong baris tabel murni hanya sebanyak 20 baris per halaman aktif layar monitor Anda
    const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

    tblContainer.innerHTML = wrapTable(
      buildTable(headers, paginatedRows, {
        numCols: [4, 5, 6],
        foot: foot,
        emptyMsg:
          "Tidak ada data kas. Silakan sesuaikan kriteria filter lalu klik Terapkan kembali.",
      }),
    );

    renderPagination("kasHarian", rows.length);
  }
}

// 🌟 MAKSURKAN KE SCOPE GLOBAL WINDOW AGAR BISA DIAKSES OLEH gantiHalamanUniversal
window.refreshKasHarian = refreshKasHarian;
async function getSaldoAwalClient(cabang, kodeBankKas, tglAwal) {
  var cab = cabang || "Pusat";

  // 🔥 AMBIL PARAMETER GROUP SECARA DINAMIS DARI LAYAR FORM KAS
  var activeGroup = $("fkh_group")
    ? $("fkh_group").value
    : localStorage.getItem("group") || "TLGA";

  // Karena kodeBankKas bisa berupa karakter tunggal indeks pemicu (Contoh: "A", "B", " "),
  // kita standarisasi parameternya agar query ke backend aman
  var charPenanda = kodeBankKas || " ";

  try {
    // 🌟 KUNCI UTAMA LAZY LOADING: Tarik saldo terakhir dari server murni berdasarkan kriteria spesifik
    // Query backend langsung menyaring Cabang, Kode Bank, Group, dan Tanggal sebelum hari berjalan
    var url = `/api/data/saldo_harian?cabang=${encodeURIComponent(cab)}&group=${activeGroup}`;
    var response = await fetch(url);

    if (response.ok) {
      var serverSaldoList = await response.json();
      var listSaldo = Array.isArray(serverSaldoList) ? serverServerList : [];

      // Saring data lokal di memori untuk tanggal sebelum tglAwal dan penanda karakter kode kas yang sama
      var filteredSaldo = listSaldo.filter(function (s) {
        var sChar = s.char4 || s.kode_bank || " ";
        var sTgl = s.tanggal || s.tgl_awal || "";
        return sChar === charPenanda && sTgl < tglAwal;
      });

      // Urutkan dari tanggal terbesar ke terkecil (DESC) untuk mengambil snapshot saldo paling dekat
      filteredSaldo.sort(function (a, b) {
        var tglA = a.tanggal || a.tgl_awal || "";
        var tglB = b.tanggal || b.tgl_awal || "";
        return tglB.localeCompare(tglA);
      });

      if (filteredSaldo.length > 0) {
        var saldoTerakhir = filteredSaldo[0];
        return num(saldoTerakhir.saldo_akhir || saldoTerakhir.saldoakhir || 0);
      }
    }
  } catch (err) {
    console.error(
      "⚠️ Gagal menarik data saldo harian dari server:",
      err.message,
    );
  }

  // 🌟 FALLBACK JALUR 2: Jika tidak ada riwayat di saldo_harian, fetch data dari saldokasirawal di server
  try {
    var urlAwal = `/api/data/saldokasirawal?cabang=${encodeURIComponent(cab)}&group=${activeGroup}`;
    var responseAwal = await fetch(urlAwal);

    if (responseAwal.ok) {
      var serverSaldoAwal = await responseAwal.json();
      var listSaldoAwal = Array.isArray(serverSaldoAwal) ? serverSaldoAwal : [];

      var filteredAwal = listSaldoAwal.filter(function (s) {
        var sChar = s.char4 || s.kode_bank || " ";
        var sTgl = s.tanggal || s.tgl_awal || "";
        return sChar === charPenanda && sTgl < tglAwal;
      });

      filteredAwal.sort(function (a, b) {
        var tglA = a.tanggal || a.tgl_awal || "";
        var tglB = b.tanggal || b.tgl_awal || "";
        return tglB.localeCompare(tglA);
      });

      if (filteredAwal.length > 0) {
        var saldoAwalRow = filteredAwal[0];
        return num(
          saldoAwalRow.saldo_akhir ||
            saldoAwalRow.saldoakhir ||
            saldoAwalRow.awal ||
            0,
        );
      }
    }
  } catch (errAwal) {
    console.error(
      "⚠️ Gagal menarik data saldo kasir awal dari server:",
      errAwal.message,
    );
  }

  // Jika dari kedua tabel di database server tidak ada riwayat sama sekali, kembalikan 0
  return 0;
}

// --- FUNGSI MODAL RINCIAN (VERSI SPESIFIK: FETCH DATA REAL-TIME SAAT DIKLIK) ---
async function showDetailReff(noreffTarget, clickedCabang, clickedGroup) {
  var targetCab = clickedCabang || "Pusat";

  // Memprioritaskan data group dari baris tabel, jika kosong baru ambil dari filter/localStorage
  var activeGroup =
    clickedGroup ||
    ($("fkh_group")
      ? $("fkh_group").value
      : localStorage.getItem("group") || "TLGA");

  try {
    if (typeof toast === "function")
      toast("Menarik rincian jurnal dari server...", "info");

    // 🌟 SEKARANG MENGIKUTI POLA FETCH ONNOREFFCLICKED SECARA PERSIS
    var response = await fetch(
      `/api/data/transaksi?search=${encodeURIComponent(noreffTarget)}&cabang=${targetCab}&group=${activeGroup}`,
    );

    if (!response.ok)
      throw new Error("Gagal mengunduh rincian detail transaksi");

    var detailData = await response.json();

    if (!detailData || detailData.length === 0) {
      alert(
        `Detail transaksi jurnal tidak ditemukan untuk No Ref: ${noreffTarget} (Cabang: ${targetCab})`,
      );
      return;
    }

    // 📝 3. BANGUN TABEL HTML KELAS DETAIL JURNAL MODAL
    var subRows = detailData
      .map(function (t) {
        var noPerkiraan = t.noperkiraan || t.noPerkiraan || t.kode_akun || "-";
        var description = t.desc || t.keterangan || "-";
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

    // Buka jendela layar modal rincian akuntansi kas
    openModal(
      "Rincian Jurnal: " + noreffTarget + " (" + targetCab + ")",
      html,
      foot,
    );

    // Sesuaikan lebar bingkai modal agar muat berbaris horizontal
    var modalFrame =
      document.querySelector(".modal-box") ||
      document.querySelector(".modal-content") ||
      document.querySelector("#modal");
    if (modalFrame) {
      modalFrame.style.width = "100%";
      modalFrame.style.maxWidth = "1000px";
    }
  } catch (error) {
    console.error("🔥 Gagal memuat modal rincian:", error.message);
    alert("Gagal memuat rincian detail: " + error.message);
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

  // Ambil group aktif dari session browser untuk dilempar ke parameter getGroupOpts
  var activeGroupSession = localStorage.getItem("group") || "";

  // 2. Render UI Filter dengan dropdown Group dinamis dari fungsi getGroupOpts()
  return `<div class="flt" style="display: flex; flex-direction: row; flex-wrap: nowrap !important; gap: .6rem; align-items: flex-end; justify-content: flex-start; height: auto !important; padding: .6rem; min-height: 45px; overflow-x: auto; width: 100%;">
      
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Periode</label>
        <select id="fi_periode" onchange="if(APP_PAGINATION_STATE?.inputHarian) APP_PAGINATION_STATE.inputHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
          <option value="bulan">Bulanan</option>
          <option value="tahun">Tahunan</option>
        </select>
      </div>
      
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Bulan/Tahun</label>
        <input type="month" id="fi_bulan" value="${today}" onchange="if(APP_PAGINATION_STATE?.inputHarian) APP_PAGINATION_STATE.inputHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
      </div>
      
      <!-- 🌟 ELEMEN GROUP: SEKARANG 100% DINAMIS MENGGUNAKAN FUNGSI getGroupOpts() ANDA -->
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Group</label>
        <select id="fi_group" onchange="if(APP_PAGINATION_STATE?.inputHarian) APP_PAGINATION_STATE.inputHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
          ${getGroupOpts(activeGroupSession)}
        </select>
      </div>

      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Cabang</label>
        <select id="fi_cabang" onchange="if(APP_PAGINATION_STATE?.inputHarian) APP_PAGINATION_STATE.inputHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
          ${getCabangOpts("")}
        </select>
      </div>
      
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 100px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Kode Trans</label>
        <input type="text" id="fi_ktrans" class="in" placeholder="Semua" onchange="if(APP_PAGINATION_STATE?.inputHarian) APP_PAGINATION_STATE.inputHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
      </div>
      
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 110px; min-width: 90px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Min. Nilai</label>
        <input type="number" id="fi_nilai" class="in" value="0" onchange="if(APP_PAGINATION_STATE?.inputHarian) APP_PAGINATION_STATE.inputHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
      </div>
      
      <div class="fg" style="display: flex; flex-direction: column; flex: 1 1 130px; min-width: 120px;">
        <label style="font-size: .75rem; font-weight: bold; margin-bottom: .2rem; white-space: nowrap;">Golongan</label>
        <select id="fi_gol" onchange="if(APP_PAGINATION_STATE?.inputHarian) APP_PAGINATION_STATE.inputHarian.current = 1;" style="width: 100%; padding: .4rem; border-radius: 4px; border: 1px solid var(--brd); background: var(--bg2); color: inherit; height: 32px; font-size: .75rem;">
          <option value="">Semua</option>
        </select>
      </div>
      
      <!-- TOMBOL TERAPKAN MANUAL -->
      <div class="fg" style="flex: 0 0 auto;">
        <button class="btn btn-b" style="background-color: var(--accent) !important; color: #fff !important; border-color: var(--accent) !important; padding: 0 .8rem; border-radius: 4px; font-size: .75rem; font-weight: bold; cursor: pointer; white-space: nowrap; height: 32px; display: flex; align-items: center; gap: 4px;" onclick="refreshInputHarian(false)" title="Terapkan Filter">
          <i class="fa-solid fa-filter"></i> Terapkan
        </button>
      </div>
      
      <!-- TOMBOL EXPORT -->
      <div class="fg" style="flex: 0 0 auto;">
        <button class="btn btn-s" style="background-color: #107c41 !important; color: #fff !important; border-color: #107c41 !important; padding: 0 .8rem; border-radius: 4px; font-size: .75rem; font-weight: bold; cursor: pointer; white-space: nowrap; height: 32px; display: flex; align-items: center; gap: 4px;" onclick="exportInputHarian()" title="Download Excel/CSV">
          <i class="fa-solid fa-file-excel"></i> Export XLS
        </button>
      </div>
    </div>
    <div id="inputHarianTbl"></div>
    <div id="inputHarianPagination" style="margin-top:12px; display:flex; justify-content:center; align-items:center; gap:5px;"></div>`;
}

var CACHE_INPUT_HARIAN_FILTERED = CACHE_INPUT_HARIAN_FILTERED || [];
var FOOTER_INPUT_HARIAN_TOTAL = FOOTER_INPUT_HARIAN_TOTAL || [];

async function refreshInputHarian(isSwitchPage = false) {
  // 🌟 FIX 1: Tambahkan validasi elemen fisik fi_group yang baru ke gerbang pengaman awal
  if (
    !$("fi_periode") ||
    !$("fi_bulan") ||
    !$("fi_cabang") ||
    !$("fi_ktrans") ||
    !$("fi_nilai") ||
    !$("fi_gol") ||
    !$("fi_group")
  ) {
    return;
  }

  // Jika hanya pindah halaman pagination, langsung gunakan data cache memori
  if (isSwitchPage && CACHE_INPUT_HARIAN_FILTERED.length > 0) {
    // Lewati proses fetch ke server, langsung lompat ke rendering UI di bawah
  } else {
    // Jika isSwitchPage = false (Tombol Terapkan diklik), tarik data segar dari server sesuai filter
    var periode = $("fi_periode").value,
      bln = $("fi_bulan").value,
      cab = $("fi_cabang").value,
      ktrans = $("fi_ktrans").value,
      nilai = num($("fi_nilai").value),
      gol = $("fi_gol").value;

    // 🌟 FIX 2: Ambil nilai Group secara dinamis dari dropdown HTML layar (#fi_group)
    var activeGroup = $("fi_group").value;

    // Ubah filter bulan/tahun YYYY-MM menjadi parameter masa MMYY
    var formatMasaParam = "";
    if (bln && bln.includes("-")) {
      var parts = bln.split("-");
      formatMasaParam = parts[1] + parts[0].substring(2, 4);
    }

    var tblContainer = $("inputHarianTbl");
    if (tblContainer && !isSwitchPage) {
      tblContainer.innerHTML =
        '<div style="padding:2rem; text-align:center;"><span class="spinner"></span><br>Sedang menarik data dari server...</div>';
    }

    try {
      // 🌟 KUNCI UTAMA: Ambil data On-Demand dari server backend menggunakan filter group dinamis
      var url = `/api/data/transaksi?group=${activeGroup}`;
      if (cab) url += `&cabang=${encodeURIComponent(cab)}`;
      if (ktrans) url += `&search=${encodeURIComponent(ktrans)}`;

      var response = await fetch(url);
      if (!response.ok) throw new Error("Gagal mengambil data dari server");

      var rawServerData = await response.json();
      var data = Array.isArray(rawServerData) ? rawServerData : [];

      // --- 1. FILTER PERIODE WAKTU (POST-SERVER SINKRONISASI) ---
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

      // --- 2. FILTER NOMINAL NILAI MINIMAL ---
      if (nilai > 0) {
        data = data.filter(function (t) {
          var nilaiAktif = num(t.total) || num(t.db || 0) || num(t.cr || 0);
          return nilaiAktif >= nilai;
        });
      }

      // --- 3. FILTER GOLONGAN PERKIRAAN INDEPENDEN ---
      if (gol) {
        var gp = (DBCache.perkiraan || [])
          .filter(function (p) {
            return p.gol === gol;
          })
          .map(function (p) {
            return p.noPerk || p.noperkiraan || p.kode_akun;
          });

        if (gp.length) {
          data = data.filter(function (t) {
            var akunTransaksi = t.noperkiraan || t.noPerkiraan || "";
            return gp.indexOf(akunTransaksi) !== -1;
          });
        } else {
          data = [];
        }
      }

      // --- 4. URUTKAN DATA KRONOLOGIS ---
      data.sort(function (a, b) {
        var dateComp = (a.tanggal || "").localeCompare(b.tanggal || "");
        if (dateComp !== 0) return dateComp;
        return (a.id || "").localeCompare(b.id || "");
      });

      // Simpan hasil data terfilter ke memori cache halaman
      CACHE_INPUT_HARIAN_FILTERED = data;

      // 📊 5. HITUNG AKUMULASI TOTAL DI FOOTER TABEL
      var sumTotal = 0,
        sumDb = 0,
        sumCr = 0;
      data.forEach(function (r) {
        var keyRef = r.noreff || "";
        var indicator = keyRef.charAt(1).toLowerCase();
        var rawAmount = num(r.total) || num(r.db || 0) || num(r.cr || 0);

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
    } catch (err) {
      console.error("🔥 Gagal memuat data input harian:", err.message);
      if (tblContainer)
        tblContainer.innerHTML = `<div style="color:var(--accent); padding:2rem; text-align:center;">⚠️ Gagal memuat data: ${err.message}</div>`;
      CACHE_INPUT_HARIAN_FILTERED = [];
      return;
    }
  }

  // =========================================================================
  // 🌟 PROSES PAGINATION LAZY RENDER (HANYA MENGGAMBAR BARIS AKTIF)
  // =========================================================================
  var tblContainer = $("inputHarianTbl");
  if (tblContainer) {
    const totalDataLength = CACHE_INPUT_HARIAN_FILTERED.length;

    const currentPage = APP_PAGINATION_STATE.inputHarian.current || 1;
    const pageSize = APP_PAGINATION_STATE.inputHarian.size || 20;
    const startIndex = (currentPage - 1) * pageSize;

    const paginatedData = CACHE_INPUT_HARIAN_FILTERED.slice(
      startIndex,
      startIndex + pageSize,
    );

    var paginatedRows = paginatedData.map(function (r) {
      var keyRef = r.noreff || "";
      var indicator = keyRef.charAt(1).toLowerCase();
      var currentDb = 0,
        currentCr = 0;
      var rawAmount = num(r.total) || num(r.db || 0) || num(r.cr || 0);

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

    tblContainer.innerHTML = wrapTable(
      buildTable(
        ["Tanggal", "No Ref", "No Acct", "Desc", "Total", "DB", "CR", "Cabang"],
        paginatedRows,
        {
          numCols: [4, 5, 6],
          foot: FOOTER_INPUT_HARIAN_TOTAL,
          emptyMsg:
            "Tidak ada data. Silakan sesuaikan kriteria filter lalu klik Terapkan kembali.",
        },
      ),
    );

    renderPagination("inputHarian", totalDataLength);
  }
}

// 🌟 DAFTARKAN KE GLOBAL WINDOW AGAR BISA DIAKSES OLEH gantiHalamanUniversal
window.refreshInputHarian = refreshInputHarian;

function exportInputHarian() {
  // 🌟 FIX UTAMA: Langsung ambil data yang sudah matang dan terfilter dari cache memori layar aktif
  var data = Array.isArray(CACHE_INPUT_HARIAN_FILTERED)
    ? CACHE_INPUT_HARIAN_FILTERED
    : [];

  if (data.length === 0) {
    return toast(
      "Tidak ada data aktif di tabel untuk di-export! Silakan klik Terapkan filter terlebih dahulu.",
      "wrn",
    );
  }

  var bln = $("fi_bulan") ? $("fi_bulan").value : "";
  var cab = $("fi_cabang") ? $("fi_cabang").value : "";

  // 🔥 PERBAIKAN: Ambil nilai Group dinamis dari dropdown HTML layar untuk penamaan file spreadsheet
  var grp = $("fi_group")
    ? $("fi_group").value
    : localStorage.getItem("group") || "TLGA";

  // --- 1. STRUKTURISASI DATA CSV EXCEL (8 KOLOM SINKRON) ---
  // Gunakan BOM UTF-8 (\uFEFF) agar Microsoft Excel langsung membaca tanda pemisah titik koma (;) secara otomatis tanpa berantakan
  var csvContent = "\uFEFFTanggal;No Ref;No Acct;Desc;Total;DB;CR;Cabang\r\n";

  var sumTotal = 0,
    sumDb = 0,
    sumCr = 0;

  data.forEach(function (r) {
    var keyRef = r.noreff || "";
    var indicator = keyRef.charAt(1).toLowerCase();

    var currentDb = 0;
    var currentCr = 0;
    var rawAmount = num(r.total) || num(r.db || 0) || num(r.cr || 0);

    // ATURAN AKUNTANSI SINKRON: p ke CR, k ke DB
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

    var acct = r.noperkiraan || r.noPerkiraan || "-";
    var cleanDesc = (r.desc || r.keterangan || "-").replace(/;/g, ",");
    var labelCabang = (lookupCabangLabel(r.cabang) || "Pusat").replace(
      /;/g,
      ",",
    );

    // Gabungkan baris data ke teks CSV spreadsheet
    csvContent +=
      (r.tanggal || "-") +
      ";" +
      keyRef +
      ";" +
      acct +
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
    ";;;TOTAL NOMINAL;" + sumTotal + ";" + sumDb + ";" + sumCr + ";\r\n";

  // --- 2. PROSES UNDUH FILE BLOB SPREADSHEET ---
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);

  // 🌟 FIX: Sertakan parameter nama Group (grp) ke dalam konstruksi penamaan file spreadsheet
  var namaFile =
    "Laporan_Input_Harian_" +
    (grp || "ALL") +
    "_" +
    (cab || "Semua") +
    "_" +
    bln +
    ".csv";

  link.setAttribute("href", url);
  link.setAttribute("download", namaFile);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof toast === "function") {
    toast("Laporan input harian berhasil diunduh.", "ok");
  }
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
