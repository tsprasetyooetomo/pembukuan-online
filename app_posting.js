// Letakkan di paling atas file app_posting.js atau di file config/core Anda
if (typeof dbcache === "undefined") {
  var dbcache = {
    postedmonths: [],
    transaksi: [],
    perkiraan: [],
  };
}

/* ================================================================
   app_posting.js — POSTING (GABUNGAN BULAN & TAHUN)
   ================================================================ */

/* globals getCabangOpts, uid, esc, fmtN, num, openModal, closeModal, showConfirm, toast, bulkInit, bulkBarHTML, bulkGetIds, bulkGetKey, crudActions, buildTable, refreshCache, navigate, currentPanel, DBCache, db */

/* ---------- Registrasi Panel Utama ---------- */
// Hapus PANEL_MAP.postBulan dan PANEL_MAP.postTahun yang lama
// Ganti dengan satu panel baru ini
PANEL_MAP.posting = renderPosting;

/* ---------- Render Form Posting ---------- */
/* ---------- Render Form Posting (UPDATE: CABANG TERURUT) ---------- */
function renderPosting() {
  var todayMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  var currentYear = new Date().getFullYear().toString();

  // ✅ 1. SIAPKAN OPSI CABANG (DENGAN SORTING)
  var cabs = Array.isArray(DBCache.cabang) ? DBCache.cabang : [];

  // Sort Ascending berdasarkan Kode Cabang
  cabs.sort(function (a, b) {
    var ka = String(a.kode || "");
    var kb = String(b.kode || "");
    return ka.localeCompare(kb);
  });

  // Generate HTML Option
  var cabOpts = '<option value="">-- Semua Cabang --</option>';
  cabs.forEach(function (c) {
    cabOpts += `<option value="${esc(c.kode)}">${esc(c.kode)} — ${esc(c.nama || "")}</option>`;
  });
  // ✅ AKHIR SORTING CABANG

  return `
    <div class="flt">
      <!-- Pilihan Tipe Periode -->
      <div class="fg">
        <label>Tipe Periode</label>
        <select id="fp_tipe" class="in" onchange="togglePostInput()">
          <option value="bulan">Bulanan</option>
          <option value="tahun">Tahunan</option>
        </select>
      </div>

      <!-- Input Bulan (Default Muncul) -->
      <div class="fg" id="wrap_bulan">
        <label>Periode (Bulan) <span class="req">*</span></label>
        <input type="month" id="fp_value_bulan" class="in" value="${todayMonth}">
      </div>

      <!-- Input Tahun (Default Tersembunyi) -->
      <div class="fg" id="wrap_tahun" style="display:none">
        <label>Periode (Tahun) <span class="req">*</span></label>
        <input type="number" id="fp_value_tahun" class="in" value="${currentYear}" min="2000" max="2100">
      </div>

      <!-- Filter Cabang -->
      <div class="fg">
        <label>Cabang</label>
        <select id="fp_cabang" class="in">${cabOpts}</select>
      </div>
    </div>

    <!-- Area Info Hasil -->
    <div id="postInfo" style="margin-bottom:.8rem"></div>

    <!-- Tombol Aksi -->
    <button class="btn btn-a" onclick="doPosting()">
      <i class="fa-solid fa-stamp"></i> Proses Posting
    </button>

    <!-- Wadah 1: Tempat Tabel Pratinjau (Sebelum Posting) -->
    <div id="tempat_tabel_preview" style="margin-top:1rem;"></div>

    <!-- Wadah 2: Tempat Tabel Laporan Hasil Cetak/Excel (Setelah Sukses Posting) -->
    <div id="tempat_tabel_hasil" style="margin-top:1rem;"></div>
`;
}
/* ---------- Helper: Toggle Input (Bulan/Tahun) ---------- */
function togglePostInput() {
  var tipe = $("fp_tipe").value;
  if (tipe === "bulan") {
    $("wrap_bulan").style.display = "block";
    $("wrap_tahun").style.display = "none";
  } else {
    $("wrap_bulan").style.display = "none";
    $("wrap_tahun").style.display = "block";
  }
}

/* ---------- logika utama posting ---------- */
async function doPosting() {
  var tipe = $("fp_tipe").value;
  var cab = $("fp_cabang").value; // Mengambil kode cabang (misal: "00", "01")
  var periode = "";
  var prefixid = "";

  // 1. Validasi & Ambil Nilai Periode
  if (tipe === "bulan") {
    periode = $("fp_value_bulan").value;
    if (!periode) {
      toast("pilih bulan terlebih dahulu", "err");
      return;
    }
    prefixid = "m_";
  } else {
    periode = $("fp_value_tahun").value;
    if (!periode || periode.length !== 4) {
      toast("tahun tidak valid", "err");
      return;
    }
    prefixid = "y_";
  }

  var postid = prefixid + periode;
  var kodeCabangCari = cab ? cab.toString().trim() : "";

  // 2. Ambil Master Perkiraan Global & Filter Berdasarkan Kode Cabang Baku
  var semuaPerkiraan = (await db.getAll("perkiraan")) || [];
  var perks = semuaPerkiraan.filter(function (p) {
    if (!kodeCabangCari) return true;
    var cabPerk = p.cabang ? p.cabang.toString().trim() : "";
    return cabPerk === kodeCabangCari;
  });

  if (!perks.length) {
    toast(
      "Tidak ada data perkiraan untuk kode cabang '" + (cab || "Semua") + "'",
      "wrn",
    );
    return;
  }

  // 3. Ambil & Filter Data Transaksi Berdasarkan Periode dan Kode Cabang
  var semuaTransaksi = (await db.getAll("transaksi")) || [];
  var dataTransaksiBulanIni = semuaTransaksi.filter(function (t) {
    if (!t.tanggal) return false;
    var teksTanggal =
      t.tanggal instanceof Date
        ? t.tanggal.toISOString().split("T")[0]
        : t.tanggal.toString().replace(/\//g, "-").trim();
    var tanggalCari = periode.toString().replace(/\//g, "-").trim();
    if (!teksTanggal.startsWith(tanggalCari)) return false;

    var cabTrans = t.cabang ? t.cabang.toString().trim() : "";
    if (kodeCabangCari && cabTrans !== kodeCabangCari) return false;
    return true;
  });

  // Simpan data ke variabel global untuk proses eksekusi simpan (tombol hijau) nanti
  dataSiapPosting = dataTransaksiBulanIni;
  periodeSiapPosting = periode;
  cabSiapPosting = cab;
  postIDSiapPosting = postid;
  tipeSiapPosting = tipe;

  // 4. Hitung Agregasi Angka Mutasi dari Transaksi Bulan Ini (Berdasarkan t.kodetrans)
  var mutasiMap = {};
  dataTransaksiBulanIni.forEach(function (t) {
    var kTrans = t.kodetrans ? t.kodetrans.toString().trim() : "";
    if (!kTrans) return;
    if (!mutasiMap[kTrans]) {
      mutasiMap[kTrans] = { db: 0, cr: 0 };
    }
    mutasiMap[kTrans].db += num(t.db);
    mutasiMap[kTrans].cr += num(t.cr);
  });

  // 5. Susun Baris Data Pratinjau Murni dari Perks dengan Properti Baku
  var listPreview = [];
  perks.forEach(function (p) {
    var nomorAkun = p.noPerk ? p.noPerk.toString().trim() : "";
    var saldoAwal = num(p.awal);

    // Ambil nilai mutasi jika ada transaksi bulan ini yang cocok kodenya
    var mDebet = 0;
    var mKredit = 0;
    if (mutasiMap[nomorAkun]) {
      mDebet = mutasiMap[nomorAkun].db;
      mKredit = mutasiMap[nomorAkun].cr;
    }

    var saldoAkhir = saldoAwal + mDebet - mKredit;

    listPreview.push({
      gol: p.gol || nomorAkun.substring(0, 3),
      //nomor: p.noperk,
      nomor: nomorAkun,
      nama: p.desc || "Tanpa Nama",
      awal: saldoAwal,
      debit: mDebet,
      kredit: mKredit,
      akhir: saldoAkhir,
      cabang: p.cabang || "",
    });
  });

  // 6. Urutkan daftar pratinjau berdasarkan nomor perkiraan secara alfabetis (A-Z)
  listPreview.sort(function (a, b) {
    if (a.nomor < b.nomor) return -1;
    if (a.nomor > b.nomor) return 1;
    return 0;
  });

  // Bersihkan layar tabel hasil lama jika ada
  if ($("tempat_tabel_hasil")) $("tempat_tabel_hasil").innerHTML = "";

  // 7. Tampilkan tabel pratinjau ke halaman HTML
  tampilkanTabelPreview(listPreview);
  //eksekusiSimpanPosting();
}

function tampilkanTabelPreview(data) {
  var container = $("tempat_tabel_preview");
  if (!container) return;

  //var html =
  // "<div style='background:#e6f2ff; padding:10px; border-left:5px solid #007bff; font-family:sans-serif; font-size:14px; font-weight:bold; margin-top:15px;'>📋 DAFTAR PRATINJAU POSTING PERKIRAAN CABANG</div>";
  // Kontainer scroll tinggi maksimal 380px dengan sticky header
  var html =
    "<div style='max-height: 250px; overflow-y: auto; border: 1px solid #ccc; margin-top: 5px; position: relative;'>";
  html +=
    "<table border='1' style='border-collapse:collapse; width:100%; font-family:sans-serif; font-size:13px; border:none;'>";

  html +=
    "<thead style='background-color:#e6f2ff; position: sticky; top: 0; z-index: 2; box-shadow: 0 2px 2px -1px rgba(0,0,0,0.4);'>";
  html += "<tr>";
  html += "<th style='padding:8px; background-color:#e6f2ff;'>Gol</th>";
  html +=
    "<th style='padding:8px; background-color:#e6f2ff;'>No Perkiraan</th>";
  html +=
    "<th style='padding:8px; background-color:#e6f2ff;'>Nama Perkiraan</th>";
  html += "<th style='padding:8px; background-color:#e6f2ff;'>Awal</th>";
  html += "<th style='padding:8px; background-color:#e6f2ff;'>Debit</th>";
  html += "<th style='padding:8px; background-color:#e6f2ff;'>Kredit</th>";
  html += "<th style='padding:8px; background-color:#e6f2ff;'>Akhir</th>";
  html += "<th style='padding:8px; background-color:#e6f2ff;'>Cabang</th>";
  html += "</tr>";
  html += "</thead><tbody>";

  data.forEach(function (row) {
    html += "<tr>";
    html += "<td style='padding:6px; text-align:center;'>" + row.gol + "</td>";
    html +=
      "<td style='padding:6px; font-weight:bold; color:#0056b3;'>" +
      row.nomor +
      "</td>";
    html += "<td style='padding:6px;'>" + row.nama + "</td>";
    html +=
      "<td style='padding:6px; text-align:right;'>Rp " +
      Number(row.awal).toLocaleString() +
      "</td>";
    html +=
      "<td style='padding:6px; text-align:right; color:green;'>+Rp " +
      Number(row.debit).toLocaleString() +
      "</td>";
    html +=
      "<td style='padding:6px; text-align:right; color:red;'>-Rp " +
      Number(row.kredit).toLocaleString() +
      "</td>";
    html +=
      "<td style='padding:6px; text-align:right;'>Rp " +
      Number(row.akhir).toLocaleString() +
      "</td>";
    html +=
      "<td style='padding:6px; text-align:center;'>" + row.cabang + "</td>";
    html += "</tr>";
  });

  html += "</tbody></table>";
  html += "</div>";

  // Area tombol kontrol di bawah tabel gulir
  html +=
    "<div style='margin-top:15px; margin-bottom:20px; display:flex; gap:10px;'>";
  html +=
    "<button onclick='eksekusiSimpanPosting()' style='padding:8px 16px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;'>✅ Konfirmasi & Jalankan Posting</button>";
  html +=
    "<button onclick='batalkanPosting()' style='padding:8px 16px; background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;'>❌ Batalkan</button>";
  html += "</div>";

  container.innerHTML = html;
  container.scrollIntoView({ behavior: "smooth" });
}

function batalkanPosting() {
  $("tempat_tabel_preview").innerHTML = "";
  toast("Proses posting dibatalkan", "wrn");
}
async function eksekusiSimpanPosting() {
  // 1. Ambil Parameter Waktu & Tahun Proses (4 digit)
  var tahunProses = periodeSiapPosting.substring(0, 4);
  var bulanProses = periodeSiapPosting.substring(5, 7);
  var duaDigitTahunBelakang = tahunProses.substring(2, 4);
  var nilaiMasaBaku = bulanProses + duaDigitTahunBelakang;
  var cab = $("fp_cabang").value;

  var storeGolDinamis = "golongan" + tahunProses;
  var storePerkDinamis = "perkiraan" + tahunProses;
  var storeTransDinamis = "transaksi" + tahunProses;

  var namaFilePerkiraan = "perkiraan" + tahunProses;
  var namaFileGolongan = "golongan" + tahunProses;

  // --- SUNTIKKAN PROGRESS BAR DAN WADAH SCROLL HASIL BARU ---
  $("tempat_tabel_preview").innerHTML =
    '<div id="progress_posting_container" style="margin: 20px auto; max-width: 500px; padding: 20px; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); opacity: 1; transition: opacity 0.5s ease;">' +
    '<div style="font-weight: bold; margin-bottom: 10px; color: #333; text-align: center;">Memproses Data Posting: <span id="text_progress">0%</span></div>' +
    '<div style="width: 100%; background: #eee; height: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #ccc;">' +
    '<div id="bar_progress" style="width: 0%; height: 100%; background: #2196F3; transition: width 0.1s;"></div>' +
    "</div>" +
    "</div>" +
    '<div id="wadah_hasil_scroll" style="display: none; max-height: 400px; overflow-y: auto; border: 1px solid #ccc; border-radius: 6px; margin-top: 15px; background: #fff; padding: 5px;">' +
    '<div id="tempat_tabel_aktual"></div>' +
    "</div>";

  var pContainer = $("progress_posting_container");
  var pText = $("text_progress");
  var pBar = $("bar_progress");

  async function updateVisualProgress(persen) {
    if (pText) pText.innerText = persen + "%";
    if (pBar) pBar.style.width = persen + "%";
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
  }

  // AMBIL MASTER PERKIRAAN & GOLONGAN
  var rawPerkiraan = (await db.getAll("perkiraan")) || [];
  var masterPerkiraan = rawPerkiraan.filter(function (p) {
    if (!cab) return true;
    var cabPerk = p.cabang ? p.cabang.toString().trim() : "";
    return cabPerk === cab;
  });

  var rawGolongan = (await db.getAll("golongan")) || [];
  var masterGolongan = rawGolongan.filter(function (g) {
    if (!cab) return true;
    var cabGol = g.cabang ? g.cabang.toString().trim() : "";
    return cabGol === cab;
  });

  var perksDinamis = masterPerkiraan;
  var rawGolDinamis = masterGolongan;
  var rawPerkDinamis = masterPerkiraan;

  // =========================================================================
  // 1.5. PROSES DUPLIKASI & AGRGASI PER NOREFF (SESUAI REQUEST)
  // =========================================================================

  // A. SORTING DATA Siap Posting berdasarkan noreff
  // Agar noreff yang sama berdampingan, memudahkan perhitungan akumulasi
  dataSiapPosting.sort(function (a, b) {
    var noreffA = (a.noreff || "").toString().trim();
    var noreffB = (b.noreff || "").toString().trim();
    // Sort ASCENDING (A-Z)
    return noreffA.localeCompare(noreffB);
  });

  // Variabel untuk menampung hasil duplikasi
  var duplikasiTransaksi = [];

  // Variabel Penampung Sementara untuk Looping
  var noreffSekarang = "";
  var totalNilaiReff = 0; // Akumulasi nilai untuk noreff saat ini
  var tanggalReff = ""; // Mengambil tanggal dari transaksi pertama noreff tsb
  var kodeBankVar = ""; // Variabel penampung kode bank (jika perlu disimpan)
  var dariKpdVar = ""; // Variabel penampung darikpd (jika perlu disimpan)
  var cabangVar = "";

  // 1. Ambil semua nilai noreff dari dataSiapPosting
  var semuaReff = dataSiapPosting.map(function (item) {
    return item.noreff;
  });

  // 2. Buat menjadi unik (jika ada 4 atau 6 reff yang sama, hanya dihitung 1)
  var setReffUnik = new Set(semuaReff);
  var jumlahReffUnik = setReffUnik.size; // Ini yang menghasilkan angka 1, 2, dst.

  // 3. Ambil jumlah data dari duplikasiTransaksi

  // B. LOOPING DATA
  for (var i = 0; i < dataSiapPosting.length; i++) {
    var t = dataSiapPosting[i];
    var noreffLoop = (t.noreff || "").toString();
    tanggalReff = t.tanggal || ""; // Ambil tanggal awal noreff ini
    cabangVar = t.cabang || "";
    // Cek apakah noreff berubah ATAU ini adalah baris pertama
    if (noreffLoop !== noreffSekarang) {
      // --- JIKA NOREFF BERUBAH, PROSES SEBELUMNYA (KECUALI BARIS PERTAMA) ---
      if (noreffSekarang !== "") {
        // 1. Cari Nomor Perkiraan Lawan di Master Kode Bank

        // Ambil 4 digit pertama dari noreffSekarang untuk pencarian
        // Cek apakah noreff berawalan "KK-" atau "KP-"
        var isNoreffKhusus =
          noreffSekarang.indexOf("KK-") === 0 ||
          noreffSekarang.indexOf("KP-") === 0;

        // Logika: Jika khusus (KK/KP) ambil 3 digit awal, SELAIN ITU ambil 4 digit awal
        // Kita gunakan Math.max(3, 4) atau 4 tergantung kondisi, tapi cara mudahnya seperti ini:

        var digit4Bank = isNoreffKhusus
          ? noreffSekarang.substring(0, 3) // Jika KK-/KP-, ambil 3 digit (misal: "KK-")
          : noreffSekarang.substring(0, 4); // Selain itu, ambil 4 digit

        var dataBankMaster = (DBCache.kodeBank || []).find(function (b) {
          var idBankMaster = (b.kodebank || b.id || "")
            .toString()
            .toUpperCase();
          var cabangBankMaster = (b.cabang || b.kodeCabang || "")
            .toString()
            .toUpperCase();
          //.trim();
          var targetCabang = cab.toString().toUpperCase();
          //.trim();

          // Cek kecocokan ID Bank (4 digit) dan Cabang
          return (
            idBankMaster === digit4Bank && cabangBankMaster === targetCabang
          );
        });

        // Ambil No Perkiraan dari hasil pencarian
        var noPerkLawan = "";
        if (dataBankMaster) {
          noPerkLawan =
            dataBankMaster.noper ||
            dataBankMaster.noperkiraan ||
            dataBankMaster.norek ||
            "";
        } else {
          // Fallback jika tidak ketemu di master
          noPerkLawan = "BANK-" + digit4Bank;
        }

        // 2. Buat Transaksi Duplikat
        // Request: Nilainya adalah akumulasi (totalNilaiReff)
        // Kita tentukan posisi DB/CR berdasarkan logika asli atau request spesifik.
        // Di sini saya asumsikan "totalnilai" adalah mutasi bersih.
        // Jika Anda ingin masuk ke salah satu sisi, kita butuh info apakah ini DB atau CR.
        // Karena request menyebut "totalnilai reff", saya masukkan ke sisi DEBET sebagai default.
        // (Jika perlu dibalik/logika khusus, bisa disesuaikan di sini).

        var jurnalDuplikat = {
          noreff: noreffSekarang, // Var noreff
          tgl: tanggalReff, // Var date = tanggal
          noperkiraan: noPerkLawan, // Var kodebank = NoPerk dari tabel
          dariKpd: dariKpdVar, // Var darikpd
          desc:
            "Transaksi No Reff " + noreffSekarang + " tanggal :" + tanggalReff, // Var desc sesuai format
          db: totalNilaiReff, // Total nilai akumulasi
          cr: 0, // 0 karena totalnya sudah dimasukkan ke db (sesuaikan jika perlu)
          cabang: cabangVar,
        };

        duplikasiTransaksi.push(jurnalDuplikat);
      }

      // --- RESET / INISIALISASI UNTUK NOREFF BARU ---
      // "setiap perubahan no reff var totalnilai di nolkan sebelum ditambahkan nilai db/cr berikutnya"
      noreffSekarang = noreffLoop;
      totalNilaiReff = 0; // DI-NOLKAN
      // tanggalReff = t.tgl || ""; // Ambil tanggal awal noreff ini
      kodeBankVar = "";
      dariKpdVar = t.dariKpd || "";
      cabangVar = "";
    }

    // TAMBAH NILAI DB/CR KE VARIABEL TOTAL
    // Request: "tambahkan nilai db/cr datasiapposting"
    // Disini kita akumulasikan Debet dan Kredit menjadi satu nilai total (Mutasi Bruto)
    totalNilaiReff += num(t.db || 0) + num(t.cr || 0);
  }

  // --- PROSES NOREFF TERAKHIR (Karena loop berakhir, item terakhir belum diproses di dalam blok if) ---
  if (noreffSekarang !== "") {
    var digit4BankAkhir =
      noreffSekarang.length >= 4
        ? noreffSekarang.substring(0, 4)
        : noreffSekarang;
    var dataBankMasterAkhir = (DBCache.kodeBank || []).find(function (b) {
      var idBankMaster = (b.kodebank || b.id || "").toString().toUpperCase();
      var cabangBankMaster = (b.cabang || b.kodeCabang || "")
        .toString()
        .toUpperCase()
        .trim();
      return (
        idBankMaster === digit4BankAkhir &&
        cabangBankMaster === cab.toString().toUpperCase().trim()
      );
    });
    var noPerkLawanAkhir = dataBankMasterAkhir
      ? dataBankMasterAkhir.noper || dataBankMasterAkhir.noperkiraan || ""
      : "BANK-" + digit4BankAkhir;

    duplikasiTransaksi.push({
      noreff: noreffSekarang,
      tgl: tanggalReff,
      noperkiraan: noPerkLawanAkhir,
      dariKpd: dariKpdVar,
      desc: "Transaksi No Reff " + noreffSekarang + " tanggal :" + tanggalReff,
      db: totalNilaiReff,
      cr: 0,
      cabang: cabangVar,
    });
  }
  //console.log(duplikasiTransaksi);

  var jumlahDuplikasiTransaksi = duplikasiTransaksi.length;

  // Tampilkan ke console untuk pengecekan
  console.log("=== DETAIL PERHITUNGAN REFF ===");
  console.log("Jumlah Reff Unik dari dataSiapPosting:", jumlahReffUnik);
  console.log("Jumlah Data di duplikasiTransaksi:", jumlahDuplikasiTransaksi);

  // 4. Bandingkan nilainya sesuai logika Anda
  if (jumlahReffUnik !== jumlahDuplikasiTransaksi) {
    // Hitung selisihnya jika jumlahnya tidak sama
    var selisihData = Math.abs(jumlahDuplikasiTransaksi - jumlahReffUnik);

    alert(
      "Peringatan: Jumlah referensi unik (" +
        jumlahReffUnik +
        ") tidak sama dengan jumlah duplikasi transaksi (" +
        jumlahDuplikasiTransaksi +
        ")!",
    );
  }

  // =========================================================================
  // 2. PROSES HAPUS DATA LAMA (RESET)
  // =========================================================================
  try {
    console.log(
      "Menghapus data lama untuk Masa: " + nilaiMasaBaku + ", Cabang: " + cab,
    );
    var urlApiReset = "http://localhost:3000/api/reset-posting";
    var res = await fetch(urlApiReset, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masa: nilaiMasaBaku, cabang: cab }),
    });
    var resResult = await res.json();
    if (!res.ok || !resResult.success) {
      throw new Error(resResult.message || "Gagal menghapus data lama");
    }
    if (typeof DBCache !== "undefined") {
      if (DBCache[storePerkDinamis]) DBCache[storePerkDinamis] = [];
      if (DBCache[storeGolDinamis]) DBCache[storeGolDinamis] = [];
      if (DBCache[storeTransDinamis]) DBCache[storeTransDinamis] = [];
      if (DBCache["perkiraan"]) DBCache["perkiraan"] = [];
      if (DBCache["golongan"]) DBCache["golongan"] = [];
      if (DBCache["transaksi"]) DBCache["transaksi"] = [];
    }
    console.log("✅ Pembersihan data spesifik selesai.");
  } catch (err) {
    console.error("Detail Error:", err);
    alert("GAGAL RESET DATA: " + err.message);
    return;
  }

  // 3. LOGIKA AGREGASI TRANSAKSI (DIGIT KE-4 SEBAGAI KUNCI BANK)
  var agg = {};
  perksDinamis.forEach(function (p) {
    var nomorAkun = (p.noPerk || "").toString().trim();
    agg[nomorAkun] = {
      db: 0,
      cr: 0,
      desc: p.desc || "",
      awal: num(p.awal || 0),
      masa: nilaiMasaBaku,
    };
  });

  dataSiapPosting.forEach(function (t) {
    var nomorAkunUtama = t.noperkiraan ? t.noperkiraan.toString().trim() : "";
    if (!nomorAkunUtama) return;

    var duaDigitNoreff = t.noreff
      ? t.noreff.toString().substring(0, 2).toUpperCase()
      : "";
    var nominalMurni = num(t.db || t.cr || t.total || 0);

    if (!agg[nomorAkunUtama]) {
      console.warn(
        "Peringatan: Akun " +
          nomorAkunUtama +
          " tidak ditemukan di Master Cabang ini. Dibuat otomatis.",
      );
      agg[nomorAkunUtama] = {
        db: 0,
        cr: 0,
        desc: t.desc || "",
        masa: nilaiMasaBaku,
      };
    }

    if (duaDigitNoreff.indexOf("P") !== -1) {
      agg[nomorAkunUtama].cr += nominalMurni;
    } else if (duaDigitNoreff.indexOf("K") !== -1) {
      agg[nomorAkunUtama].db += nominalMurni;
    } else {
      agg[nomorAkunUtama].db += num(t.db || 0);
      agg[nomorAkunUtama].cr += num(t.cr || 0);
    }

    var digitBankProses = "";
    if (t.noreff) {
      var cekDuaHurufDepan = t.noreff.toString().substring(0, 2).toUpperCase();
      if (cekDuaHurufDepan === "KP" || cekDuaHurufDepan === "KK") {
        digitBankProses = t.noreff.toString().substring(0, 3);
      } else {
        digitBankProses = t.noreff.toString().substring(0, 4);
      }
    }

    if (digitBankProses) {
      var dataBankMaster = (DBCache.kodeBank || []).find(function (b) {
        var idBankMaster = (b.kodebank || b.id || "").toString().toUpperCase();
        var cabangBankMaster = (b.cabang || b.kodeCabang || "")
          .toString()
          .toUpperCase()
          .trim();
        var targetDigitBank = digitBankProses.toString().toUpperCase();
        var targetCabang = cab.toString().toUpperCase().trim();
        return (
          idBankMaster === targetDigitBank && cabangBankMaster === targetCabang
        );
      });

      var akunLawanBank = dataBankMaster
        ? dataBankMaster.noper ||
          dataBankMaster.noperkiraan ||
          dataBankMaster.norek ||
          ""
        : "";

      var nomorAkunLawan = akunLawanBank
        ? akunLawanBank.toString().trim()
        : "BANK-" + digitBankProses.trim();

      if (!agg[nomorAkunLawan]) {
        agg[nomorAkunLawan] = {
          db: 0,
          cr: 0,
          desc: dataBankMaster
            ? dataBankMaster.penjelasan || dataBankMaster.desc || ""
            : digitBankProses.trim(),
          masa: nilaiMasaBaku,
        };
      }

      if (duaDigitNoreff.indexOf("P") !== -1) {
        agg[nomorAkunLawan].db += nominalMurni;
      } else if (duaDigitNoreff.indexOf("K") !== -1) {
        agg[nomorAkunLawan].cr += nominalMurni;
      } else {
        agg[nomorAkunLawan].cr += num(t.db || 0);
        agg[nomorAkunLawan].db += num(t.cr || 0);
      }
    }
  });

  // =========================================================================
  // 3.5. LOGIKA HITUNG RETENSI LABA (HANYA MENGHITUNG NILAI)
  // =========================================================================
  var totalNetIncomeRL = 0;
  console.log("Step 3.5: Menghitung nilai Retensi Laba (No Perk > 299)...");

  // Loop seluruh agg untuk menghitung total Laba/Rugi sementara
  Object.keys(agg).forEach(function (k) {
    // Bersihkan format nomor akun untuk perbandingan angka
    var kClean = k.toString().trim();
    var nomorAkunNum = parseFloat(kClean);
    // TAMBAHKAN INI UNTUK CEK

    if (!isNaN(nomorAkunNum) && nomorAkunNum > 299) {
      var dbVal = agg[k].db || 0;
      var crVal = agg[k].cr || 0;
      // Kalkulasi: Debet - Kredit
      totalNetIncomeRL += dbVal - crVal;
    }
  });

  console.log(
    "Step 3.5 Selesai. Nilai RL (Net) yang akan ditambahkan ke 299: " +
      totalNetIncomeRL,
  );

  // =========================================================================
  // 4. PROSES PENAMBAHAN SALDO & UPDATE FIELD MASA (DI SINI PENGECEKAN 299)
  // =========================================================================
  var keysAgg = Object.keys(agg);
  var totalLangkah = keysAgg.length + dataSiapPosting.length;
  var langkahSekarang = 0;
  var hasilUpdateLaporan = [];
  var hasilUpdateLaporangol = [];

  // Flag untuk memastikan RL hanya ditambahkan sekali jika loop menemukan 299
  var rlTelahDitambahkan = false;

  for (var i = 0; i < keysAgg.length; i++) {
    var nomorAkun = keysAgg[i];
    var nilaiMutasi = agg[nomorAkun];
    var cleanStr = function (s) {
      return String(s || "")
        .replace(/\s+/g, "")
        .trim();
    };

    // --- LOGIKA KHUSUS: JIKA INI ADALAH AKUN 299.0000 ---
    var noTargetRL = "299.0000";
    var isAkunRL = cleanStr(nomorAkun) === cleanStr(noTargetRL);

    if (isAkunRL) {
      // 1. Jika belum ditambahkan, masukkan nilai RL
      if (!rlTelahDitambahkan) {
        // Tentukan Posisi (Debet/Kredit)
        // Positif = Kredit (Laba), Negatif = Debet (Rugi/Absolut)
        // 1. KONDISI UNTUNG (Total Bernilai NEGATIF)
        if (totalNetIncomeRL < 0) {
          // Kita pakai Math.abs() agar yang masuk database adalah angka POSITIF
          // Agar saldo kreditnya bertambah (misal +400)
          nilaiMutasi.cr += Math.abs(totalNetIncomeRL);

          console.log(
            ">> Akun 299: Menambahkan LABA (Kredit): " +
              Math.abs(totalNetIncomeRL),
          );
        }
        // 2. KONDISI RUGI (Total Bernilai POSITIF)
        else if (totalNetIncomeRL > 0) {
          // Nilai RL sudah positif, langsung masukkan ke Debet
          // Agar saldo debetnya bertambah (misal +400)
          nilaiMutasi.db += totalNetIncomeRL;

          console.log(
            ">> Akun 299: Menambahkan RUGI (Debet): " + totalNetIncomeRL,
          );
        }

        rlTelahDitambahkan = true; // Tandai sudah diproses
      }

      // 2. Cek keberadaan di Master (perksDinamis)
      var masterRL = perksDinamis.find(function (p) {
        return (
          cleanStr(p.noPerk || p.noperkiraan || p.id || "") ===
          cleanStr(noTargetRL)
        );
      });

      // 3. Jika TIDAK ADA di Master, Buat Objek Baru
      if (!masterRL) {
        console.log(">> Akun 299 tidak ada di Master. Membuat otomatis...");
        masterRL = {
          id: noTargetRL,
          noPerk: noTargetRL,
          desc: "RL Berjalan", // Sesuai request
          awal: 0,
          db: 0,
          cr: 0,
          cabang: cab || "01",
        };
        // Masukkan ke array master agar tidak error saat mencari di loop ini/bulan depan
        perksDinamis.push(masterRL);
      }
    }
    // -----------------------------------------------------

    // PROSES NORMAL UPDATE PERKIRAAN
    var pkDinamis = perksDinamis.find(function (p) {
      var noPerkTarget = p.noPerk || p.noperkiraan || p.id || "";
      return cleanStr(noPerkTarget) === cleanStr(nomorAkun);
    });

    // Jika ternyata masih kosong (fallback generic, biasanya tertangani di atas atau awal)
    if (!pkDinamis) {
      pkDinamis = {
        id: nomorAkun,
        noPerk: nomorAkun,
        desc: nilaiMutasi.desc || "Perkiraan Baru " + nomorAkun,
        awal: 0,
        db: 0,
        cr: 0,
        cabang: cab || "01",
      };
      perksDinamis.push(pkDinamis);
    }

    var nilaiAwalMurni = num(pkDinamis.awal || 0);

    // Update Saldo Akhir di RAM Master
    pkDinamis.db = num(pkDinamis.db || 0) + nilaiMutasi.db;
    pkDinamis.cr = num(pkDinamis.cr || 0) + nilaiMutasi.cr;
    pkDinamis.masa = nilaiMasaBaku;

    var noRekLaporan = pkDinamis.noPerk || nomorAkun;
    var nilaiAkhirHitung = nilaiAwalMurni + nilaiMutasi.db - nilaiMutasi.cr;

    var perkEksis = hasilUpdateLaporan.find(function (item) {
      return (
        (item.noPerk || "").toString().trim() ===
        (noRekLaporan || "").toString().trim()
      );
    });

    if (perkEksis) {
      perkEksis.db += nilaiMutasi.db;
      perkEksis.cr += nilaiMutasi.cr;
      perkEksis.akhir = perkEksis.awal + perkEksis.db - perkEksis.cr;
    } else {
      hasilUpdateLaporan.push({
        gol: String(noRekLaporan).substring(0, 3),
        noPerk: noRekLaporan,
        desc: pkDinamis.desc,
        tipe: "Perkiraan",
        masa: nilaiMasaBaku,
        awal: nilaiAwalMurni,
        db: nilaiMutasi.db,
        cr: nilaiMutasi.cr,
        akhir: nilaiAkhirHitung,
        cabang: cab,
      });
    }

    // =========================================================================
    // 5. UPDATE GOLONGAN TAHUNAN (DISECURE)
    // =========================================================================
    if (noRekLaporan) {
      var rawNoRek = cleanStr(noRekLaporan);
      if (rawNoRek.length >= 3) {
        var kodeGol = rawNoRek.substring(0, 3);

        var golDinamis = (rawGolDinamis || []).find(function (g) {
          var idGolMaster = g.gol || g.kode || g.id || "";
          return cleanStr(idGolMaster) === cleanStr(kodeGol);
        });

        if (golDinamis) {
          var golAwalMurni = num(golDinamis.awal || 0);
          golDinamis.db = num(golDinamis.db || 0) + nilaiMutasi.db;
          golDinamis.cr = num(golDinamis.cr || 0) + nilaiMutasi.cr;
          golDinamis.masa = nilaiMasaBaku;

          var golAkhirHitung = golAwalMurni + nilaiMutasi.db - nilaiMutasi.cr;
          var targetKodeGol = golDinamis.gol || kodeGol;

          var golEksis = hasilUpdateLaporangol.find(function (item) {
            return (
              (item.gol || "").toString().trim() ===
              (targetKodeGol || "").toString().trim()
            );
          });

          if (golEksis) {
            golEksis.db += num(nilaiMutasi.db || 0);
            golEksis.cr += num(nilaiMutasi.cr || 0);
            golEksis.akhir = golEksis.awal + golEksis.db - golEksis.cr;
          } else {
            hasilUpdateLaporangol.push({
              gol: targetKodeGol,
              namaGol: golDinamis.namaGol || "Golongan " + kodeGol,
              tipe: "Golongan",
              masa: nilaiMasaBaku,
              awal: golAwalMurni,
              db: nilaiMutasi.db,
              cr: nilaiMutasi.cr,
              akhir: golAkhirHitung,
              cabang: cab,
            });
          }
        }
      }
    }

    langkahSekarang++;
    var persenSatu = Math.round((langkahSekarang / totalLangkah) * 100);
    await updateVisualProgress(persenSatu);
  }

  // PROSES FILTER GOLONGAN
  hasilUpdateLaporangol = hasilUpdateLaporangol.filter(function (item) {
    var totalAktivitas =
      Number(item.awal || 0) + Number(item.db || 0) + Number(item.cr || 0);
    return totalAktivitas !== 0;
  });

  // PROSES FILTER PERKIRAAN
  hasilUpdateLaporan = hasilUpdateLaporan.filter(function (item) {
    var totalAktivitasPerk =
      Number(item.awal || 0) + Number(item.db || 0) + Number(item.cr || 0);
    return totalAktivitasPerk !== 0;
  });

  // =========================================================================
  // 6. PROSES SIMPAN KE DATABASE (BATCH PROCESS)
  // =========================================================================
  // C. TAMBAHKAN DUPLIKASI KE DATA UTAMA
  dataSiapPosting = dataSiapPosting.concat(duplikasiTransaksi);

  console.log("✅ Duplikasi Rekening Koran Selesai.");
  console.table(duplikasiTransaksi);

  try {
    // --- A. SIMPAN DATA PERKIRAAN (BATCH) ---
    console.log("Menyimpan data Perkiraan...");
    var resPerk = await fetch("http://localhost:3000/api/save-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeName: storePerkDinamis,
        data: hasilUpdateLaporan,
      }),
    });
    if (!resPerk.ok) throw new Error("Gagal menyimpan batch Perkiraan");
    await updateVisualProgress(30);

    // --- B. SIMPAN DATA GOLONGAN (BATCH) ---
    console.log("Menyimpan data Golongan...");
    console.log("=== ISI DATA GOLONGAN YANG DIKIRIM KE BACKEND ===");
    console.table(hasilUpdateLaporangol);
    var resGol = await fetch("http://localhost:3000/api/save-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeName: storeGolDinamis,
        data: hasilUpdateLaporangol,
      }),
    });
    if (!resGol.ok) throw new Error("Gagal menyimpan batch Golongan");
    await updateVisualProgress(60);

    // --- C. SIMPAN DATA TRANSAKSI (BATCH) ---
    console.log("Menyimpan data Transaksi...");
    var transaksiDenganMasa = dataSiapPosting.map(function (itemTrans) {
      itemTrans.masa = nilaiMasaBaku;
      return itemTrans;
    });

    var resTrans = await fetch("http://localhost:3000/api/save-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeName: storeTransDinamis,
        data: transaksiDenganMasa,
      }),
    });

    if (!resTrans.ok) throw new Error("Gagal menyimpan batch Transaksi");
    await updateVisualProgress(100);

    console.log("💥 Semua data berhasil diposting ke SQLite!");
    toast("Sukses memposting data ke server!", "ok");
  } catch (err) {
    console.error("🚨 Gagal posting data:", err);
    toast("Gagal posting: " + err.message, "err");
  }

  // --- 8. PROSES FADE-OUT PROGRESS & ATUR SCROLL TAMPILAN HASIL ---
  if (pContainer) {
    pContainer.style.opacity = "0";
    await new Promise(function (resolve) {
      setTimeout(resolve, 500);
    });
    pContainer.style.display = "none";
  }

  var wScroll = $("wadah_hasil_scroll");
  if (wScroll) wScroll.style.display = "block";

  if (hasilUpdateLaporan.length === 0) {
    $("tempat_tabel_aktual").innerHTML =
      '<div style="padding: 20px; text-align: center; color: #ff5722; font-weight: bold; background: #fff3e0;">' +
      "Hasil postingan tidak menghasilkan mutasi angka atau saldo pada periode ini." +
      "</div>";
  } else {
    // --- SORTING ---
    hasilUpdateLaporan.sort(function (a, b) {
      var nomorA = String(a.noPerk || "").trim();
      var nomorB = String(b.noPerk || "").trim();
      return nomorA.localeCompare(nomorB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    hasilUpdateLaporangol.sort(function (a, b) {
      var nomorA = String(a.gol || "").trim();
      var nomorB = String(b.gol || "").trim();
      return nomorA.localeCompare(nomorB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    var targetAsli = $("tempat_tabel_preview");
    if (targetAsli) targetAsli.id = "tempat_tabel_preview_disabled";
    var targetAktual = $("tempat_tabel_aktual");
    if (targetAktual) targetAktual.id = "tempat_tabel_preview";

    tampilkanTabelHasil(hasilUpdateLaporan, hasilUpdateLaporangol);

    var targetBaru = $("tempat_tabel_preview");
    if (targetBaru) targetBaru.id = "tempat_tabel_aktual";
    var targetLama = $("tempat_tabel_preview_disabled");
    if (targetLama) targetLama.id = "tempat_tabel_preview";

    var namaCabangBersih = String(cab || "SemuaCabang")
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "");
  }

  toast("Sukses posting tahunan " + tahunProses, "ok");
}

function tampilkanTabelHasil(dataLaporan, dataLaporangol) {
  var targetElemen = $("tempat_tabel_preview");
  if (!targetElemen) return;

  // 1. HITUNG TOTAL DEBET & KREDIT MURNI (DARI TIPE PERKIRAAN)
  var totalDebetSemua = 0;
  var totalKreditSemua = 0;
  for (var k = 0; k < dataLaporan.length; k++) {
    if (dataLaporan[k].tipe === "Perkiraan") {
      totalDebetSemua += parseFloat(dataLaporan[k].db || 0);
      totalKreditSemua += parseFloat(dataLaporan[k].cr || 0);
    }
  }

  // Amankan data golongan dari parameter kedua (cadangan array kosong jika tidak terkirim)
  var dataGolongan = dataLaporangol || [];

  // 2. BUAT STRUKTUR CONTAINER UTAMA (RESPONSIF FLEXBOX)
  var containerHtml =
    '<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #111; border: 1px solid #333; border-radius: 6px; padding: 12px 15px; margin-bottom: 15px; color: #fff; font-family: sans-serif;">' +
    '<div style="font-weight: bold; font-size: 14px; color: #2196F3;">📊 RINGKASAN MUTASI POSTING</div>' +
    '<div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 14px; font-weight: bold;">' +
    '<div>TOTAL DEBET: <span style="color: #4caf50; margin-left: 5px;">Rp ' +
    formatUang(totalDebetSemua) +
    "</span></div>" +
    '<div style="border-left: 1px solid #444; padding-left: 15px;">TOTAL KREDIT: <span style="color: #f44336; margin-left: 5px;">Rp ' +
    formatUang(totalKreditSemua) +
    "</span></div>" +
    "</div>" +
    "</div>" +
    '<div style="margin-bottom: 15px; display: flex; gap: 10px;">' +
    '<button id="btn_lihat_perkiraan" style="padding: 8px 16px; background: #2196F3; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s; font-size: 13px;">Lihat Perkiraan</button>' +
    '<button id="btn_lihat_golongan" style="padding: 8px 16px; background: #333; color: #ccc; border: 1px solid #555; border-radius: 4px; font-weight: bold; cursor: pointer; transition: all 0.2s; font-size: 13px;">Lihat Golongan</button>' +
    "</div>" +
    '<div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #333; border-radius: 6px; background: #1e1e1e;">' +
    '<div id="isi_tabel_konten"></div>' +
    "</div>";

  targetElemen.innerHTML = containerHtml;

  // 3. FUNGSI INTERNAL UNTUK MERENDER ISI TABEL SECARA DINAMIS
  function renderKontenTabel(listData, tipeFilter) {
    var htmlTabel =
      '<table style="width:100%; min-width: 800px; border-collapse: collapse; font-size: 13px; text-align: left; background: #1e1e1e; color: #fff;">' +
      '<thead style="background: #111; border-bottom: 2px solid #444;">' +
      "<tr>" +
      '<th style="padding: 10px 8px; border: 1px solid #333; color: #bbb;">Nomor</th>' +
      '<th style="padding: 10px 8px; border: 1px solid #333; color: #bbb;">Nama Akun</th>' +
      '<th style="padding: 10px 8px; border: 1px solid #333; color: #bbb;">Tipe</th>' +
      '<th style="padding: 10px 8px; border: 1px solid #333; color: #bbb;">Masa</th>' +
      '<th style="padding: 10px 8px; border: 1px solid #333; text-align: right; color: #bbb;">Saldo Awal</th>' +
      '<th style="padding: 10px 8px; border: 1px solid #333; text-align: right; color: #bbb;">Debet</th>' +
      '<th style="padding: 10px 8px; border: 1px solid #333; text-align: right; color: #bbb;">Kredit</th>' +
      '<th style="padding: 10px 8px; border: 1px solid #333; text-align: right; color: #bbb;">Akhir</th>' +
      '<th style="padding: 10px 8px; border: 1px solid #333; text-align: center; color: #bbb;">Cbg</th>' +
      "</tr>" +
      "</thead>" +
      "<tbody>";

    var barisTercetak = 0;
    for (var i = 0; i < listData.length; i++) {
      var d = listData[i];

      // Saring baris berdasarkan menu aktif
      if (d.tipe !== tipeFilter) continue;
      barisTercetak++;

      var bgRow =
        d.tipe === "Golongan" ? "background: #252525" : "background: #1e1e1e;";

      // 🌟 SOLUSI TOTAL: Menentukan field berdasarkan parameter tipeFilter yang aktif
      var textNomor = tipeFilter === "Perkiraan" ? d.noPerk : d.gol;
      var textNama = tipeFilter === "Perkiraan" ? d.desc : d.namaGol;

      htmlTabel +=
        '<tr style="' +
        bgRow +
        ' border-bottom: 1px solid #333;">' +
        '<td style="padding: 8px 6px; border: 1px solid #333; color: #fff; font-family: monospace;">' +
        (textNomor || "-") +
        "</td>" +
        '<td style="padding: 8px 6px; border: 1px solid #333; color: #fff;">' +
        (textNama || "-") +
        "</td>" +
        '<td style="padding: 8px 6px; border: 1px solid #333; color: #aaa; font-size: 11px;">' +
        d.tipe +
        "</td>" +
        '<td style="padding: 8px 6px; border: 1px solid #333; color: #fff; text-align: center;">' +
        (d.masa || "-") +
        "</td>" +
        '<td style="padding: 8px 6px; border: 1px solid #333; text-align: right; color: #fff;">' +
        formatUang(d.awal) +
        "</td>" +
        '<td style="padding: 8px 6px; border: 1px solid #333; text-align: right; color: #4caf50;">' +
        formatUang(d.db) +
        "</td>" +
        '<td style="padding: 8px 6px; border: 1px solid #333; text-align: right; color: #f44336;">' +
        formatUang(d.cr) +
        "</td>" +
        '<td style="padding: 8px 6px; border: 1px solid #333; text-align: right; color: #fff;">' +
        formatUang(d.akhir) +
        "</td>" +
        '<td style="padding: 8px 6px; border: 1px solid #333; text-align: center; color: #fff; font-size: 11px;">' +
        (d.cabang || "-") +
        "</td>" +
        "</tr>";
    }

    if (barisTercetak === 0) {
      htmlTabel +=
        '<tr><td colspan="9" style="padding: 30px; text-align: center; color: #aaa; background: #1e1e1e;">Tidak ada data ' +
        tipeFilter +
        "</td></tr>";
    }

    htmlTabel += "</tbody></table>";

    var wadahKonten = $("isi_tabel_konten");
    if (wadahKonten) wadahKonten.innerHTML = htmlTabel;
  }

  // 4. ATUR EVENT KLIK TOMBOL NAVIGATION SWITCHING
  var btnPerkiraan = $("btn_lihat_perkiraan");
  var btnGolongan = $("btn_lihat_golongan");

  if (btnPerkiraan && btnGolongan) {
    btnPerkiraan.onclick = function () {
      btnPerkiraan.style.background = "#2196F3";
      btnPerkiraan.style.color = "#fff";
      btnPerkiraan.style.border = "none";

      btnGolongan.style.background = "#333";
      btnGolongan.style.color = "#ccc";
      btnGolongan.style.border = "1px solid #555";

      renderKontenTabel(dataLaporan, "Perkiraan");
    };

    btnGolongan.onclick = function () {
      btnGolongan.style.background = "#00e676";
      btnGolongan.style.color = "#000";
      btnGolongan.style.border = "none";

      btnPerkiraan.style.background = "#333";
      btnPerkiraan.style.color = "#ccc";
      btnPerkiraan.style.border = "1px solid #555";

      renderKontenTabel(dataGolongan, "Golongan");
    };
  }

  // Default pertama kali muncul: Tampilkan halaman Perkiraan terlebih dahulu
  renderKontenTabel(dataLaporan, "Perkiraan");
}

function formatUang(angka) {
  var n = parseFloat(angka || 0);
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
