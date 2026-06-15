/* ================================================================
   APP_ROLLOVER.JS — FITUR CARRY-FORWARD (AKUMULASI SALDO)
   ================================================================ */

/* globals getCabangOpts, uid, esc, fmtN, num, openModal, closeModal, showConfirm, toast, refreshCache, DBCache, db */

PANEL_MAP.rollOver = renderRollOver;

function renderRollOver() {
  var currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Persiapan Opsi Cabang (Diurutkan)
  var cabs = Array.isArray(DBCache.cabang) ? DBCache.cabang : [];
  cabs.sort(function (a, b) {
    return String(a.kode || "").localeCompare(String(b.kode || ""));
  });

  var cabOpts = '<option value="">-- Pilih Cabang --</option>';
  cabs.forEach(function (c) {
    cabOpts += `<option value="${esc(c.kode)}">${esc(c.kode)} — ${esc(c.nama || "")}</option>`;
  });

  return `
    <div style="padding:1rem; border:1px solid var(--brd); border-radius:10px; background:var(--bg2); margin-bottom:1rem;">
      <div style="font-size:1rem; font-weight:700; color:var(--accent); margin-bottom:1rem;">
        <i class="fa-solid fa-calendar-check"></i> Proses Akhir Bulan (Roll-Over)
      </div>
      
      <div class="flt">
        <div class="fg">
          <label>Periode Target <span class="req">*</span></label>
          <input type="month" id="ro_bulan" class="in" value="${currentMonthStr}">
        </div>
        <div class="fg">
          <label>Cabang <span class="req">*</span></label>
          <select id="ro_cabang" class="in">${cabOpts}</select>
        </div>
        <div class="fg">
          <label>Mulai Transaksi</label>
          <input type="date" id="ro_tanggal" class="in" value="${currentMonthStr}-01">
        </div>
        <div class="fg" style="display:flex; align-items:flex-end;">
          <button class="btn btn-a" onclick="doProcessRollOver()">
            <i class="fa-solid fa-calculator"></i> Hitung & Ekspor
          </button>
        </div>
      </div>
      
      <div style="margin-top:.5rem; font-size:.75rem; color:var(--muted); background:var(--bg); padding:.5rem; border-radius:4px;">
        <i class="fa-solid fa-circle-info"></i> 
        Sistem akan mengecek saldo bulan sebelumnya (dari field Masa), 
        menambahkan transaksi bulan ini, dan membuat file baru.
      </div>

      <div id="roStatus" style="margin-top:1rem; font-size:0.9rem; color:var(--muted);"></div>
    </div>
  `;
}

/* ---------- LOGIKA UTAMA PROSES ROLL-OVER (CARRY FORWARD) ---------- */
async function doProcessRollOver() {
  var bulanInput = $("ro_bulan").value; // Format: YYYY-MM
  var cabang = $("ro_cabang").value;
  var tglMulai = $("ro_tanggal").value;
  var statusEl = $("roStatus");

  // 1. VALIDASI INPUT
  if (!bulanInput) {
    toast("Pilih Periode Target terlebih dahulu", "err");
    return;
  }
  if (!cabang) {
    toast("Pilih Cabang terlebih dahulu", "err");
    return;
  }

  // Pecah Bulan & Tahun
  var parts = bulanInput.split("-");
  var thn = parts[0];
  var bln = parts[1];
  var yy = String(thn).slice(-2); // 2 digit belakang tahun

  // Tentukan MASA Target (MMYY)
  var masaTarget = bln + yy;

  // Hitung MASA Bulan Sebelumnya
  var dateTarget = new Date(thn, parseInt(bln) - 1, 1); // Kurangi 1 bulan
  var prevThn = dateTarget.getFullYear();
  var prevBln = String(dateTarget.getMonth() + 1).padStart(2, "0");
  var prevYY = String(prevThn).slice(-2);
  var masaPrev = prevBln + prevYY;

  statusEl.innerHTML = `<span class="spinner"></span> Memproses Masa: ${masaTarget} (Membawa saldo dari ${masaPrev})...`;

  try {
    // 2. AMBIL DATA DASAR (BASE DATA) DARI BULAN LALU
    // Kita cari di store 'rollover_history'
    var logKeyPrev = cabang + "_" + masaPrev;
    var prevHistory = null;

    try {
      prevHistory = await db.get("rollover_history", logKeyPrev);
    } catch (e) {
      console.log("Tidak ada riwayat bulan sebelumnya, mulai dari 0.");
    }

    // Siapkan Map untuk menampung saldo berjalan
    var mapGol = {}; // Key: Golongan -> { db, cr }
    var mapNoper = {}; // Key: NoPerk -> { db, cr }

    // --- 2A. ISI DARI BULAN LALU (JIKA ADA) ---
    if (prevHistory && prevHistory.data) {
      // Load saldo akhir bulan lalu sebagai saldo awal bulan ini
      if (prevHistory.data.golongan) {
        prevHistory.data.golongan.forEach(function (g) {
          mapGol[g.gol] = {
            db: num(g.db),
            cr: num(g.cr),
            nama: g.namaGol || g.nama,
            awal: num(g.db) - num(g.cr), // Saldo awal untuk referensi
          };
        });
      }
      if (prevHistory.data.perkiraan) {
        prevHistory.data.perkiraan.forEach(function (p) {
          mapNoper[p.noPerk] = {
            db: num(p.db),
            cr: num(p.cr),
            nama: p.desc,
            gol: p.gol,
          };
        });
      }
    } else {
      // JIKA TIDAK ADA RIWAYAT (Bulan Pertama), Coba Ambil dari Master untuk Saldo Awal
      // Opsional: Anda bisa mengisi mapGol dan mapNoper dari DBCache.golongan & DBCache.perkiraan
      // Untuk sekarang kita mulai dari 0 jika tidak ada riwayat, kecuali ada field 'awal' di master.
      // (Logika fallback master bisa ditambahkan di sini jika perlu)
    }

    // 3. AMBIL TRANSAKSI BULAN INI
    // Kita filter transaksi sesuai Cabang dan Tanggal
    var dataMutasi = (DBCache.transaksi || []).filter(function (t) {
      var tCab = t.cabang || "Pusat";
      var tTgl = t.tanggal || "";
      // Filter sesuai tanggal yang dipilih dan bulan target
      return tCab === cabang && tTgl >= tglMulai && tTgl.startsWith(bulanInput);
    });

    if (dataMutasi.length === 0) {
      toast("Tidak ada transaksi pada periode ini", "wrn");
      statusEl.innerHTML = "";
      return;
    }

    // 4. PROSES TRANSAKSI (AGREGASI)
    dataMutasi.forEach(function (t) {
      var noPerk = t.noperkiraan || "";
      var noreff = t.noreff || "";
      var amount = num(t.total) || num(t.db) || num(t.cr) || 0;

      // Logika Noreff Digit ke-2
      // k = Debet, p = Kredit
      var char2 = noreff.length >= 2 ? noreff.charAt(1).toLowerCase() : "";

      var transDb = 0;
      var transCr = 0;

      if (char2 === "k") {
        transDb = amount;
      } else if (char2 === "p") {
        transCr = amount;
      } else {
        // Fallback jika tidak ada k/p (gunakan nilai asli db/cr)
        transDb = num(t.db) || 0;
        transCr = num(t.cr) || 0;
      }

      // --- UPDATE PERKIRAAN (NOPER) ---
      if (!mapNoper[noPerk]) {
        // Cari data master untuk mengambil info Golongan jika belum ada di map
        var masterP = DBCache.perkiraan.find(function (x) {
          return x.noPerk === noPerk;
        });
        mapNoper[noPerk] = {
          db: 0,
          cr: 0,
          nama: masterP ? masterP.desc : "-",
          gol: masterP ? masterP.gol : "-",
        };
      }
      mapNoper[noPerk].db += transDb;
      mapNoper[noPerk].cr += transCr;

      // --- UPDATE GOLONGAN ---
      // Cara: Mencocokkan 3 digit pertama no perkiraan
      var kodeGol = noPerk.substring(0, 3);

      if (!mapGol[kodeGol]) {
        // Cari nama golongan dari master jika perlu
        var masterG = DBCache.golongan.find(function (x) {
          return x.gol === kodeGol;
        });
        mapGol[kodeGol] = {
          db: 0,
          cr: 0,
          nama: masterG ? masterG.namaGol : "-",
        };
      }
      mapGol[kodeGol].db += transDb;
      mapGol[kodeGol].cr += transCr;
    });

    // 5. PERSIAPAN DATA UNTUK EKSPOR
    // Kita ubah Map menjadi Array dan tambahkan field 'masa'

    var arrGol = Object.keys(mapGol).map(function (k) {
      return {
        masa: masaTarget, // ✅ Field Masa ditambahkan
        gol: k,
        namaGol: mapGol[k].nama,
        db: mapGol[k].db,
        cr: mapGol[k].cr,
        cabang: cabang,
      };
    });

    var arrNoper = Object.keys(mapNoper).map(function (k) {
      return {
        masa: masaTarget, // ✅ Field Masa ditambahkan
        noPerk: k,
        desc: mapNoper[k].nama,
        gol: mapNoper[k].gol,
        db: mapNoper[k].db,
        cr: mapNoper[k].cr,
        cabang: cabang,
      };
    });

    // Persiapan Data Transaksi (Hanya perlu ditambah field masa/kolom kosong sesuai kebutuhan)
    var arrMutasi = dataMutasi.map(function (t) {
      return {
        masa: masaTarget, // Penanda masa transaksi
        tanggal: t.tanggal,
        noreff: t.noreff,
        noperkiraan: t.noperkiraan,
        desc: t.desc,
        db: t.db,
        cr: t.cr,
        cabang: t.cabang,
        kodeBank: t.kodeBank,
        dariKePada: t.dariKePada,
      };
    });

    // 6. EKSPOR KE FILE CSV
    // Nama File sesuai request: gol[KodeCabang][YY], noper[KodeCabang][YY], mutasi[KodeCabang][YY]
    var fileGol = "gol" + cabang + yy;
    var fileNoper = "noper" + cabang + yy;
    var fileMutasi = "mutasi" + cabang + yy;

    downloadCSV(fileGol, arrGol, [
      "masa",
      "gol",
      "namaGol",
      "db",
      "cr",
      "cabang",
    ]);
    downloadCSV(fileNoper, arrNoper, [
      "masa",
      "noPerk",
      "desc",
      "gol",
      "db",
      "cr",
      "cabang",
    ]);
    downloadCSV(fileMutasi, arrMutasi, [
      "masa",
      "tanggal",
      "noreff",
      "noperkiraan",
      "desc",
      "db",
      "cr",
      "cabang",
      "kodeBank",
      "dariKePada",
    ]);

    // 7. SIMPAN RIWAYAT (SNAPSHOT) AGAR BULAN DEPAN BISA DIBACA
    // Kita simpan seluruh hasil perhitungan (golongan + perkiraan) ke database
    var logKeyTarget = cabang + "_" + masaTarget;
    await db.put("rollover_history", {
      id: logKeyTarget,
      cabang: cabang,
      masa: masaTarget,
      waktu: new Date().toLocaleString(),
      data: {
        golongan: arrGol,
        perkiraan: arrNoper,
      },
    });

    toast("Proses Roll-Over Selesai!", "ok");
    statusEl.innerHTML = `
      <div style="color:var(--success)">
        ✅ Berhasil diproses untuk Masa <b>${masaTarget}</b>.<br>
        File yang dibuat:<br>
        1. <b>${fileGol}.csv</b><br>
        2. <b>${fileNoper}.csv</b><br>
        3. <b>${fileMutasi}.csv</b><br>
        <small>Saldo bulan depan akan dimulai dari saldo akhir bulan ini.</small>
      </div>
    `;
  } catch (err) {
    console.error(err);
    toast("Gagal memproses: " + err.message, "err");
    statusEl.innerHTML = "";
  }
}

/* ---------- HELPER: DOWNLOAD CSV ---------- */
function downloadCSV(filename, data, headers) {
  if (!data || data.length === 0) return;

  // Header CSV
  var csvContent = headers.join(";") + "\r\n";

  // Isi Data
  data.forEach(function (row) {
    var rowStr = headers
      .map(function (h) {
        var val = row[h];
        if (val === undefined || val === null) return "";
        if (typeof val === "object") return JSON.stringify(val);
        // Bersihkan karakter koma
        return String(val).replace(/;/g, ",");
      })
      .join(";");
    csvContent += rowStr + "\r\n";
  });

  // Trigger Download
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename + ".csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
