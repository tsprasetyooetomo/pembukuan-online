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

  // Render Form Awal
  return `<div class="flt">
      <div class="fg"><label>Tgl Awal</label><input type="date" id="fk_tgl_awal" value="${defaultStart}" onchange="refreshKasHarian()"></div>
      <div class="fg"><label>Tgl Akhir</label><input type="date" id="fk_tgl_akhir" value="${today}" onchange="refreshKasHarian()"></div>
      <div class="fg"><label>Cabang</label><select id="fk_cabang" onchange="refreshKasHarian()">${getCabangOpts("")}</select></div>
      <div class="fg"><label>KodeBank/Kas</label><select id="fk_kodebank" onchange="refreshKasHarian()"><option value="">Semua</option></select></div>
      <!-- TAMBAHAN: TOMBOL EXPORT -->
      <div class="fg" style="display:flex; align-items:flex-end; padding-bottom:2px;">
        <button class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportKasHarian()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> Export XLS</button>
      </div>
      <div class="fg" style="display:flex; align-items:flex-end; padding-bottom:2px;">
        <button class="btn btn-s" style="background-color:#d93025;color:#fff;" 
                onclick="tutupBukuHarian()">
          <i class="fa-solid fa-save"></i> Tutup Buku / Simpan Saldo
        </button>
      </div>
    </div>
    <div id="kasHarianTbl"></div>`;
}

async function tutupBukuHarian() {
  // 1. Ambil parameter dari filter UI
  var tglAwal = $("fk_tgl_awal").value;
  var tglAkhir = $("fk_tgl_akhir").value;
  var cab = $("fk_cabang").value || "Pusat";
  var selectedChar = $("fk_kodebank").value;
  var activeGroup = localStorage.getItem("group") || "TLGA"; // ✅ Tambahkan filter group agar data konsisten

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
async function refreshKasHarian() {
  var tglAwal = $("fk_tgl_awal").value;
  var tglAkhir = $("fk_tgl_akhir").value;
  var cab = $("fk_cabang").value;

  // --- KODE DROPDOWN KODE BANK ---
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
        c === " " || c === "" ? "(Spasi) - " + textPenj : c + " - " + textPenj;
      return `<option value="${esc(c)}">${esc(label)}</option>`;
    })
    .join("");

  var ddDigit = $("fk_kodebank");
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

  var selectedChar = $("fk_kodebank").value;

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
      currentCr = 0;
    } else if (typeIndicator === "kk") {
      currentDb = 0;
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
        cabang: t.cabang || "Pusat", // ✅ Simpan info cabang di grup
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

  // =========================================================================
  // ✅ PANGGIL getSaldoAwalClient (READ SALDO_HARIAN)
  // =========================================================================
  var saldoAwalMaster = 0;
  if (selectedChar !== "") {
    saldoAwalMaster = await getSaldoAwalClient(cab, selectedChar, tglAwal);
  }

  var rows = [],
    runBal = saldoAwalMaster,
    totalDb = 0,
    totalCr = 0;
  var lastDate = null;

  // --- 5. LOOPING TABEL ---
  groupedData.forEach(function (t) {
    if (lastDate !== null && lastDate !== t.tanggal) {
      rows.push(["", "", "", "", "", "", "", "", ""]); // Tambah kolom kosong untuk separator tanggal
    }
    lastDate = t.tanggal;
    var saldoAwalRow = runBal;
    runBal += t.db - t.cr;

    // Cari label cabang yang cantik
    //var cabangLabel = lookupCabangLabel(t.cabang) || t.cabang || "Pusat";
    var cabangLabel = t.cabang || "-";

    //var viewBtnHtml = `<button type="button" class="btn btn-s btn-a" style="padding:2px 6px;" onclick="showDetailReff('${esc(t.noreff)}')"><i class="fa-solid fa-eye"></i> View</button>`;
    var viewBtnHtml = `<button type="button" class="btn btn-s btn-a" style="padding:2px 6px;" onclick="showDetailReff('${esc(t.noreff)}', '${esc(t.cabang)}')"><i class="fa-solid fa-eye"></i> View</button>`;
    rows.push([
      t.tanggal,
      esc(t.dariKePada).substring(0, 25),
      esc(t.noreff),
      fmtN(saldoAwalRow),
      fmtN(t.db),
      fmtN(t.cr),
      fmtN(runBal),
      esc(cabangLabel), // ✅ TAMBAHKAN KOLOM CABANG DI SINI
      viewBtnHtml,
    ]);
    totalDb += t.db;
    totalCr += t.cr;
  });

  DATA_KAS_AKTIF.saldoAwalMaster = saldoAwalMaster;
  DATA_KAS_AKTIF.groupedData = groupedData;

  var foot = [
    "",
    "",
    "",
    groupedData.length + " ref unik",
    fmtN(totalDb),
    fmtN(totalCr),
    fmtN(totalDb - totalCr),
    "", // ✅ Footer kolom Cabang kosong
    "", // Footer kolom Aksi kosong
  ];

  // ✅ UPDATE HEADER TABEL
  var headers = [
    "Tanggal",
    "Dari/Kepada",
    "No Ref (Unik)",
    "Awal",
    "Debit",
    "Kredit",
    "Akhir",
    "Cabang", // ✅ HEADER CABANG DITAMBAHKAN DI SINI
    "Aksi",
  ];

  $("kasHarianTbl").innerHTML = wrapTable(
    buildTable(headers, rows, {
      numCols: [3, 4, 5, 6],
      foot: foot,
      emptyMsg: "Tidak ada data",
    }),
  );
}

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

  return `<div class="flt">
      <div class="fg">
        <label>Periode</label>
        <select id="fi_periode" onchange="refreshInputHarian()">
          <option value="bulan">Bulanan</option>
          <option value="tahun">Tahunan</option>
        </select>
      </div>
      <div class="fg"><label>Bulan/Tahun</label><input type="month" id="fi_bulan" value="${today}" onchange="refreshInputHarian()"></div>
      <div class="fg"><label>Cabang</label><select id="fi_cabang" onchange="refreshInputHarian()">${getCabangOpts("")}</select></div>
      <div class="fg"><label>Kode Trans</label><input type="text" id="fi_ktrans" class="in" placeholder="Semua" oninput="refreshInputHarian()"></div>
      <div class="fg"><label>Min. Nilai</label><input type="number" id="fi_nilai" class="in" value="0" oninput="refreshInputHarian()"></div>
      <div class="fg">
        <label>Golongan</label>
        <select id="fi_gol" onchange="refreshInputHarian()">
          <option value="">Semua</option>
          <!-- Opsi golongan bisa diisi dinamis jika ada master datanya -->
        </select>
      </div>
      <div class="fg" style="display:flex; align-items:flex-end; padding-bottom:2px;">
        <button class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportInputHarian()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> Export XLS</button>
      </div>
    </div>
    <div id="inputHarianTbl"></div>`;
}

async function refreshInputHarian() {
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

  // 🛠️ PERBAIKAN: Ambil data langsung dari db karena DBCache.transaksi sudah kosong/dihapus
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
        num(t.total) || num(t.db || 0) || num(t.cr || 0) || num(t.nominal || 0);
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
        var akunTransaksi = t.noperkiraan || t.noPerkiraan || t.kodeTrans || "";
        return gp.indexOf(akunTransaksi) !== -1;
      });
    } else {
      data = [];
    }
  }

  // --- 6. URUTKAN DATA KRONOLOGIS BERDASARKAN TANGGAL ---
  data.sort(function (a, b) {
    var dateComp = (a.tanggal || "").localeCompare(b.tanggal || "");
    if (dateComp !== 0) return dateComp;
    return (a.id || "").localeCompare(b.id || "");
  });

  // Kolom akumulasi untuk hitung total di footer
  var sumTotal = 0,
    sumDb = 0,
    sumCr = 0;

  // --- 7. PETAKAN DATA KE BARIS TABEL (7 KOLOM DENGAN LOGIKA DEBET/KREDIT BARU) ---
  var rows = data.map(function (r) {
    var keyRef = r.noreff || "";
    var indicator = keyRef.charAt(1).toLowerCase(); // Ambil digit ke-2 dari No Ref

    var currentDb = 0;
    var currentCr = 0;

    // Ambil nominal asli transaksi
    var rawAmount =
      num(r.total) || num(r.db || 0) || num(r.cr || 0) || num(r.nominal || 0);

    // 🛠️ ATURAN BARU SINKRONISASI AKUNTANSI INPUTAN
    if (indicator === "p") {
      currentCr = rawAmount; // Digit ke-2 'p' masuk Kredit
      currentDb = 0;
    } else if (indicator === "k") {
      currentDb = rawAmount; // Digit ke-2 'k' masuk Debet
      currentCr = 0;
    } else {
      // Fallback jika tidak mengandung p atau k
      currentDb = num(r.db || 0);
      currentCr = num(r.cr || 0);
    }

    // Akumulasi nilai untuk baris footer
    sumTotal += rawAmount;
    sumDb += currentDb;
    sumCr += currentCr;

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

  // --- 8. SUSUN TOTAL FOOTER (8 KOLOM) ---
  var foot = [
    "",
    "",
    "",
    "",
    fmtN(sumTotal), // Total Nominal (Indeks 3)
    fmtN(sumDb), // Total Debet (Indeks 4)
    fmtN(sumCr), // Total Kredit (Indeks 5)
    "",
  ];

  // --- 9. RENDER KE ELEMEN DOM (7 KOLOM UTUH) ---
  var tblContainer = $("inputHarianTbl");
  if (tblContainer) {
    // ✅ PERBAIKAN PADA BARIS 811 (Isi kembali nilai array untuk numCols)
    tblContainer.innerHTML = wrapTable(
      buildTable(
        ["Tanggal", "No Ref", "No Acct", "Desc", "Total", "DB", "CR", "Cabang"],
        rows,
        { numCols: [4, 5, 6], foot: foot, emptyMsg: "Tidak ada data" },
      ),
    );
  }
}

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

function renderLaporanSaldoKasir() {
  // Set Tanggal Hari Ini untuk Tanggal Akhir
  var today = new Date().toISOString().slice(0, 10);
  // Set 1 Bulan ke belakang untuk Tanggal Awal (Default)
  var lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  var defaultStart = lastMonth.toISOString().slice(0, 10);

  // Render Form Awal
  return `<div class="flt">
      <div class="fg"><label>Tgl Awal</label><input type="date" id="fk_tgl_awal" value="${defaultStart}"></div>
      <div class="fg"><label>Tgl Akhir</label><input type="date" id="fk_tgl_akhir" value="${today}"></div>
      <div class="fg"><label>Cabang</label><select id="fk_cabang">${getCabangOpts("")}</select></div>
      
      <!-- DIV KHUSUS UNTUK TOMBOL AKSI -->
      <div class="fg" style="display:flex; align-items:flex-end; gap:5px; padding-bottom:2px;">
        <button type="button" class="btn btn-g" style="font-size:.8rem; padding:4px 12px;" onclick="refreshSaldoKasir()">Terapkan</button>
        <button type="button" class="btn btn-a" style="font-size:.8rem; padding:4px 12px; background:#d93025; border-color:#d93025;" onclick="postingSaldoKasir()"><i class="fa-solid fa-upload"></i> Posting</button>
        <button type="button" class="btn btn-s" style="background-color:#107c41;color:#fff;border-color:#107c41" onclick="exportSaldoKasir()" title="Download Excel/CSV"><i class="fa-solid fa-file-excel"></i> XLS</button>
      </div>
    </div>
    <div id="kasirTbl"></div>`;
}

/* ---------- FUNGSI AMBIL SALDO AWAL DARI TABEL saldokasir ---------- */
async function getSaldoAwalKasir(cabang, tglAwal) {
  // Langsung ambil dari memory (DBCache), karena data SUDAH difilter cabang & group oleh serverold.js
  var dataSaldo = DBCache.saldoKasir || [];
  var dataSaldoAwal = DBCache.saldokasirawal || [];

  // 1. Cari di saldoKasir (Urutkan ASC dulu, lalu ambil yang paling mendekati tglAwal)
  dataSaldo.sort(function (a, b) {
    return (a.tgl_awal || "").localeCompare(b.tgl_awal || "");
  });
  var found = dataSaldo.filter(function (s) {
    return s.tgl_awal <= tglAwal;
  });

  if (found.length > 0) {
    return num(found[found.length - 1].akhir || 0); // Ambil index terakhir (yang tanggalnya paling besar tapi masih <= tglAwal)
  }

  // 2. Fallback Cari di saldoKasirawal
  dataSaldoAwal.sort(function (a, b) {
    return (a.tgl_awal || "").localeCompare(b.tgl_awal || "");
  });
  var foundAwal = dataSaldoAwal.filter(function (s) {
    return s.tgl_awal <= tglAwal;
  });

  if (foundAwal.length > 0) {
    return num(foundAwal[foundAwal.length - 1].akhir || 0);
  }

  // 3. Jika tidak ada sama sekali
  return 0;
}

/* ---------- FUNGSI REFRESH & RENDER TABEL ---------- */
async function refreshSaldoKasir() {
  var tglAwal = $("fk_tgl_awal").value;
  var tglAkhir = $("fk_tgl_akhir").value;
  var cab = $("fk_cabang").value;

  // =========================================================================
  // 1. LOGIKA FALLBACK PENCARIAN SALDO AWAL (CASCADE)
  // =========================================================================
  var saldoAwalMaster = await getSaldoAwalKasir(cab, tglAwal);

  // Cek apakah ketemu di tabel "saldokasir"

  // Cek apakah ketemu di tabel "saldokasir"
  if (
    saldoAwalMaster === null ||
    saldoAwalMaster === undefined ||
    isNaN(saldoAwalMaster)
  ) {
    console.log("🔍 Tidak ketemu di saldokasir, mencari ke saldokasirawal...");

    try {
      // KODE BARU YANG DIPERBAIKI:
      var rawSaldoRawal = await db.getAll("saldokasirawal");
      var arrSaldoRawal = rawSaldoRawal
        ? Array.isArray(rawSaldoRawal)
          ? rawSaldoRawal
          : Object.values(rawSaldoRawal)
        : [];

      // ✅ AMBIL GROUP AKTIF
      var activeGroup = localStorage.getItem("group") || "TLGA";

      // ✅ FILTER: CABANG, GROUP, DAN TANGGAL HARUS SESUAI
      var dataCocok = arrSaldoRawal.filter(function (s) {
        var cabData = String(s.cabang || "").trim();
        var tglData = String(s.tanggal || s.tgl_awal || "").trim();
        var groupData = String(s.group || "").trim(); // <- Tambahkan pengecekan Group

        return (
          cabData === cab && groupData === activeGroup && tglData <= tglAwal
        );
      });

      if (dataCocok.length > 0) {
        // Urutkan dari tanggal terbesar ke terkecil
        dataCocok.sort(function (a, b) {
          var tglA = a.tanggal || a.tgl_awal || "";
          var tglB = b.tanggal || b.tgl_awal || "";
          return tglB.localeCompare(tglA); // Descending
        });

        // Ambil data paling terakhir (paling mendekati tanggal awal filter)
        var saldoTerakhir = dataCocok[0];

        // Ambil nilai akhirnya
        saldoAwalMaster = num(
          saldoTerakhir.akhir ||
            saldoTerakhir.saldo ||
            saldoTerakhir.saldo_akhir ||
            0,
        );

        console.log(
          "✅ Ditemukan saldo di saldokasirawal (Group: " + activeGroup + "): ",
          saldoAwalMaster,
        );
      } else {
        // Jika di saldokasirawal juga kosong
        saldoAwalMaster = 0;
        console.warn(
          "⚠️ Saldo awal TIDAK DITEMUKAN di saldokasir maupun saldokasirawal untuk Group: " +
            activeGroup +
            ". Menggunakan 0.",
        );
      }
    } catch (err) {
      console.error("Error membaca saldokasirawal:", err);
      saldoAwalMaster = 0;
    }

    // Tampilkan peringatan ke kasir jika saldo awalnya 0
    if (saldoAwalMaster === 0) {
      if (typeof toast === "function") {
        toast(
          "Saldo awal Rp 0 (Tidak ditemukan di riwayat untuk group ini). Pastikan data sudah di-Posting.",
          "wrn",
        );
      }
    }
  }
  // 2. AMBIL DATA MUTASI DARI TABEL mutasikasir
  var filteredData = (DBCache.mutasikasir || []).filter(function (t) {
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

    return true;
  });

  // 3. GROUPING DATA BERDASARKAN NOREFF
  // (Sisa kode di bawah ini TIDAK PERLU DIUBAH, biarkan tetap seperti semula)
  var groupedMap = {};
  filteredData.forEach(function (t) {
    var keyRef = t.noreff || t.id || "-";
    var typeIndicator = keyRef.substring(0, 2).toUpperCase();

    if (!groupedMap[keyRef]) {
      groupedMap[keyRef] = {
        tanggal: t.tanggal || "-",
        noreff: keyRef,
        db: 0,
        cr: 0,
      };
    }

    var valDb = num(t.db || 0);
    var valCr = num(t.cr || 0);
    var valNominal = num(t.nominal || 0);

    if (valDb === 0 && valCr === 0 && valNominal > 0) {
      if (
        typeIndicator === "PJ" ||
        typeIndicator === "TK" ||
        typeIndicator === "KT"
      ) {
        valDb = valNominal;
      } else {
        valCr = valNominal;
      }
    }

    groupedMap[keyRef].db += valDb;
    groupedMap[keyRef].cr += valCr;
  });

  var groupedData = Object.values(groupedMap);
  groupedData.sort(function (a, b) {
    var dateComp = (a.tanggal || "").localeCompare(b.tanggal || "");
    if (dateComp !== 0) return dateComp;
    return (a.noreff || "").localeCompare(b.noreff || "");
  });

  var rows = [];
  var runBal = saldoAwalMaster;
  var totalDb = 0;
  var totalCr = 0;
  var lastDate = null;

  groupedData.forEach(function (t) {
    if (lastDate !== null && lastDate !== t.tanggal) {
      rows.push(["", "", "", "", "", ""]);
    }
    lastDate = t.tanggal;

    var saldoAwalRow = runBal;
    runBal += t.db - t.cr;

    rows.push([
      t.tanggal,
      esc(t.noreff),
      fmtN(saldoAwalRow),
      fmtN(t.db),
      fmtN(t.cr),
      fmtN(runBal),
    ]);

    totalDb += t.db;
    totalCr += t.cr;
  });

  DATA_KASIR_AKTIF.saldoAwalMaster = saldoAwalMaster;
  DATA_KASIR_AKTIF.groupedData = groupedData;

  var foot = [
    "",
    groupedData.length + " No Ref",
    "",
    fmtN(totalDb),
    fmtN(totalCr),
    fmtN(totalDb - totalCr),
  ];

  var headers = [
    "Tanggal",
    "No Ref",
    "Saldo Awal",
    "Debit (PJ/TK/KT)",
    "Kredit (BE/CS/KK/SK)",
    "Saldo Akhir",
  ];

  var areaTbl = $("kasirTbl");
  if (areaTbl) {
    areaTbl.innerHTML = wrapTable(
      buildTable(headers, rows, {
        numCols: [2, 3, 4, 5],
        foot: foot,
        emptyMsg: "Tidak ada data mutasi kasir untuk periode ini",
      }),
    );
  }
}
async function postingSaldoKasir() {
  // 1. Ambil parameter dari filter UI
  var tglAwal = $("fk_tgl_awal").value;
  var tglAkhir = $("fk_tgl_akhir").value;
  var cab = $("fk_cabang").value || "Pusat";

  if (!tglAwal || !tglAkhir) {
    if (typeof toast === "function")
      toast("Pilih tanggal awal dan akhir terlebih dahulu", "err");
    else alert("Pilih tanggal awal dan akhir terlebih dahulu");
    return;
  }

  // Cek apakah ada data yang sedang ditampilkan di layar
  if (
    !DATA_KASIR_AKTIF.groupedData ||
    DATA_KASIR_AKTIF.groupedData.length === 0
  ) {
    if (typeof toast === "function")
      toast(
        "Tidak ada data yang bisa di-posting. Klik Terapkan terlebih dahulu.",
        "wrn",
      );
    else
      alert(
        "Tidak ada data yang bisa di-posting. Klik Terapkan terlebih dahulu.",
      );
    return;
  }

  // 2. Konfirmasi ke user
  var confirmMsg =
    "POSTING SALDO KASIR HARIAN\n\nCabang: " +
    cab +
    "\nPeriode: " +
    tglAwal +
    " s/d " +
    tglAkhir +
    "\n\nData harian yang tampil di layar akan disimpan ke Database Saldo Kasir.\nLanjutkan?";
  var ok = confirm(confirmMsg);
  if (!ok) return;

  try {
    // 3. Siapkan variabel untuk menampung data yang akan dikirim
    var arrDataUntukDisimpan = [];
    var baseUrl = window.location.origin + "/api/data/saldokasir"; // Target API saldokasir

    // 4. LOOPING DATA YANG TAMPIL DI LAYAR (HARIAN)
    DATA_KASIR_AKTIF.groupedData.forEach(function (t) {
      // Pastikan datanya memiliki tanggal
      var tglTransaksi = t.tanggal || t.tgl;
      if (!tglTransaksi) return;

      // Bersihkan format tanggal jika perlu (ambil format YYYY-MM-DD saja)
      if (tglTransaksi.indexOf(" ") > -1)
        tglTransaksi = tglTransaksi.split(" ")[0];

      // Susun objek data harian baru
      var objHarian = {
        id: "POST_KASIR_" + cab + "_" + tglTransaksi + "_" + uid(), // ID Unik
        cabang: cab,
        tanggal: tglTransaksi, // Tanggal harian
        tgl_awal: tglTransaksi, // Di map ke tgl_awal supaya kompatibel dengan fungsi getSaldoAwalKasir nanti
        db: t.db || 0,
        cr: t.cr || 0,
        akhir: (t.db || 0) - (t.cr || 0), // Saldo per harian
        awal: 0,
        group: localStorage.getItem("group") || "TLGA", // Catatan tambahan: sertakan group
      };

      arrDataUntukDisimpan.push(objHarian);
    });

    if (arrDataUntukDisimpan.length === 0) {
      if (typeof toast === "function")
        toast("Tidak ada data valid yang bisa diproses.", "wrn");
      return;
    }

    // Tampilkan pesan proses
    if (typeof toast === "function")
      toast(
        "Menyimpan " + arrDataUntukDisimpan.length + " data harian...",
        "inf",
      );

    // 5. KIRIM KE SERVER SUPABASE SECARA PARALEL MENGGUNAKAN BATCH ATAU LOOP FETCH
    // Kita kirim satu per satu dengan Promise.all agar cepat
    var berhasilDisimpan = 0;
    var gagalDisimpan = 0;

    await Promise.all(
      arrDataUntukDisimpan.map(function (item) {
        return fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        })
          .then(function (res) {
            if (!res.ok) throw new Error("Server error");
            berhasilDisimpan++;
          })
          .catch(function (e) {
            gagalDisimpan++;
            console.error("Gagal simpan data tgl:", item.tanggal, e);
          });
      }),
    );

    // 6. UPDATE CACHE DBCache LOKAL (Agar UI langsung berubah tanpa reload halaman)
    if (!DBCache.saldokasir) DBCache.saldokasir = [];
    arrDataUntukDisimpan.forEach(function (item) {
      DBCache.saldokasir.push(item);
    });

    // 7. SUKSES
    var pesanSukses =
      "Posting Berhasil!\n" +
      berhasilDisimpan +
      " data harian tersimpan di Saldo Kasir." +
      (gagalDisimpan > 0 ? " (" + gagalDisimpan + " gagal)" : "");

    if (typeof toast === "function") {
      toast(pesanSukses, "ok");
    } else {
      alert(pesanSukses);
    }
  } catch (err) {
    console.error("❌ Gagal Posting Saldo Kasir:", err);
    if (typeof toast === "function") {
      toast("Gagal posting: " + err.message, "err");
    } else {
      alert("Gagal posting: " + err.message);
    }
  }
}
/* ---------- FUNGSI EXPORT KASIR ---------- */
function exportSaldoKasir() {
  var groupedData = DATA_KASIR_AKTIF.groupedData;
  var saldoAwalMaster = DATA_KASIR_AKTIF.saldoAwalMaster;

  if (!groupedData || groupedData.length === 0) {
    alert(
      "Tidak ada data di layar yang bisa di-export! Silakan pilih filter data terlebih dahulu.",
    );
    return;
  }

  var tglAwal = $("fk_tgl_awal").value;
  var tglAkhir = $("fk_tgl_akhir").value;
  var cab = $("fk_cabang").value;

  // BANGUN CSV / EXCEL
  var csvContent = "Tanggal;Keterangan;No Ref;Awal;Debit;Kredit;Akhir\r\n";
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
    var dbVal = num(t.db || 0);
    var crVal = num(t.cr || 0);
    runBal += dbVal - crVal;

    var cleanKet = (t.keterangan || t.desc || t.dariKePada || "").replace(
      /;/g,
      ",",
    );
    var cleanReff = (t.noreff || t.id || "").replace(/;/g, ",");

    csvContent +=
      (t.tanggal || "-") +
      ";" +
      cleanKet +
      ";" +
      cleanReff +
      ";" +
      saldoAwalRow +
      ";" +
      dbVal +
      ";" +
      crVal +
      ";" +
      runBal +
      "\r\n";

    totalDb += dbVal;
    totalCr += crVal;
  });

  csvContent +=
    ";;TOTAL;" +
    groupedData.length +
    " ref;" +
    totalDb +
    ";" +
    totalCr +
    ";" +
    (totalDb - totalCr) +
    "\r\n";

  // DOWNLOAD FILE
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);
  var namaFile =
    "Laporan_Saldo_Kasir_" +
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
    toast("Laporan Saldo Kasir berhasil diunduh.");
  }
}
