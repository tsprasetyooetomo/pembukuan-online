/* ================================================================
   app_posting.js — POSTING ALUR BARU (EXCEL COPY-PASTE FRIENDLY + DOWNLOAD)
   ================================================================ */

// Fallback fungsi formatRp jika belum ada di file lain
if (typeof formatRp === "undefined") {
  function formatRp(angka) {
    var n = parseFloat(angka) || 0;
    return n.toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

PANEL_MAP.posting = renderPosting;

function renderPosting() {
  var todayMonth = new Date().toISOString().slice(0, 7);
  var currentYear = new Date().getFullYear().toString();

  var cabs = Array.isArray(DBCache.cabang) ? DBCache.cabang : [];
  cabs.sort(function (a, b) {
    return String(a.kode || "").localeCompare(String(b.kode || ""));
  });

  var cabOpts = '<option value="">-- Semua Cabang --</option>';
  cabs.forEach(function (c) {
    cabOpts += `<option value="${esc(c.kode)}">${esc(c.kode)} — ${esc(c.nama || "")}</option>`;
  });

  var groups = Array.isArray(DBCache.group) ? DBCache.group : ["TLGA"];
  var groupOpts = "";
  groups.forEach(function (g) {
    groupOpts += `<option value="${esc(g)}">${esc(g)}</option>`;
  });

  return `
    <div class="flt">
      <div class="fg">
        <label>Tipe Periode</label>
        <select id="fp_tipe" class="in" onchange="togglePostInput()">
          <option value="bulan">Bulanan</option>
          <option value="tahun">Tahunan</option>
        </select>
      </div>

      <div class="fg" id="wrap_bulan">
        <label>Periode (Bulan) <span class="req">*</span></label>
        <input type="month" id="fp_value_bulan" class="in" value="${todayMonth}">
      </div>

      <div class="fg" id="wrap_tahun" style="display:none">
        <label>Periode (Tahun) <span class="req">*</span></label>
        <input type="number" id="fp_value_tahun" class="in" value="${currentYear}" min="2000" max="2100">
      </div>

      <div class="fg">
        <label>Cabang</label>
        <select id="fp_cabang" class="in">${cabOpts}</select>
      </div>

      <div class="fg">
        <label>Group</label>
        <select id="fp_group" class="in">${groupOpts}</select>
      </div>
    </div>

    <div style="margin-top:1rem; display:flex; gap:10px;">
      <button class="btn btn-b" onclick="doPreviewPosting()">
        <i class="fa-solid fa-eye"></i> Tampilkan Preview
      </button>
      <button class="btn btn-a" id="btn_posting_final" style="display:none;" onclick="doPostingAlurBaru()">
        <i class="fa-solid fa-stamp"></i> Konfirmasi & Jalankan Posting
      </button>
    </div>

    <div id="tempat_tabel_preview" style="margin-top:1rem;"></div>
    <div id="tempat_tabel_hasil" style="margin-top:1rem;"></div>
`;
}

function togglePostInput() {
  var tipe = $("fp_tipe").value;
  if (tipe === "bulan") {
    $("wrap_bulan").style.display = "block";
    $("wrap_tahun").style.display = "none";
  } else {
    $("wrap_bulan").style.display = "none";
    $("wrap_tahun").style.display = "block";
  }
  $("btn_posting_final").style.display = "none";
  $("tempat_tabel_preview").innerHTML = "";
}

/* ================================================================
   FUNGSI HITUNG UTAMA
   =============================================================== */
async function hitungDataPosting() {
  var tipe = $("fp_tipe").value;
  var cabangPilih = $("fp_cabang").value.trim();
  var groupPilih = $("fp_group").value.trim() || "TLGA";
  var periode = "";

  if (tipe === "bulan") {
    periode = $("fp_value_bulan").value;
    if (!periode) throw new Error("Pilih bulan terlebih dahulu!");
  } else {
    periode = $("fp_value_tahun").value;
    if (!periode || periode.length !== 4) throw new Error("Tahun tidak valid!");
  }

  var tahunProses = periode.substring(0, 4);
  var bulanProses = tipe === "bulan" ? periode.substring(5, 7) : "12";
  var nilaiMasaBaku = bulanProses + tahunProses.substring(2, 4);
  var isBulanPertama = tipe === "bulan" && bulanProses === "01";

  var namaTabelTrans = "transaksi" + tahunProses;
  var namaTabelPerk = "perkiraan" + tahunProses;
  var namaTabelGol = "golongan" + tahunProses;

  var semuaTransaksi = (await db.getAll("transaksi")) || [];
  var semuaListReff = (await db.getAll("listrefftransaksi")) || [];

  var transTerpilih = semuaTransaksi.filter(function (t) {
    var tglStr = String(t.tanggal || t.tgl || "").replace(/\//g, "-");
    return (
      tglStr.startsWith(periode) &&
      (!cabangPilih || String(t.cabang || "").trim() === cabangPilih) &&
      String(t.group || "TLGA").trim() === groupPilih
    );
  });

  var listReffTerpilih = semuaListReff.filter(function (r) {
    var rTgl = String(r.tanggal || r.tgl || "").replace(/\//g, "-");
    return (
      rTgl.startsWith(periode) &&
      (!cabangPilih || String(r.cabang || "").trim() === cabangPilih) &&
      String(r.group || "TLGA").trim() === groupPilih
    );
  });

  var mutasiListReffBaru = [];
  listReffTerpilih.forEach(function (ref) {
    var noReffVal = String(ref.noreff || ref.no_reff || "").trim();
    var tglVal = ref.tanggal || ref.tgl || periode + "-01";
    var hurufKedua =
      noReffVal.length >= 2 ? noReffVal.substring(1, 2).toUpperCase() : "";
    var nilaiRp = num(ref.total || ref.db || ref.cr || 0);
    var dbVal = 0,
      crVal = 0;

    if (hurufKedua === "K") crVal = nilaiRp;
    else if (hurufKedua === "P") dbVal = nilaiRp;

    var digitKeTiga = noReffVal.charAt(3); // Ingat: charAt(3) adalah karakter ke-4 (indeks ke-3)

    var masterKodeBank = (DBCache.kodeBank || []).find(function (b) {
      var kodeTarget = String(b.kode || b.id || "")
        .trim()
        .toUpperCase();
      var digitClean = String(digitKeTiga || "")
        .trim()
        .toUpperCase();

      // Jika digit ketiga adalah spasi, bypass (true), jika tidak cocokkan kodenya
      var isKodeSama =
        digitClean === "" || digitClean === " "
          ? true
          : kodeTarget === digitClean;

      var isCabangSama =
        !cabangPilih ||
        String(b.cabang || "")
          .trim()
          .toUpperCase() === cabangPilih.toUpperCase();

      var isGroupSama =
        String(b.group || "TLGA")
          .trim()
          .toUpperCase() === groupPilih.toUpperCase();

      return isKodeSama && isCabangSama && isGroupSama;
    });

    var noPerkLawan = masterKodeBank
      ? masterKodeBank.noper || masterKodeBank.noperkiraan || ""
      : "";

    mutasiListReffBaru.push({
      noreff: noReffVal,
      tanggal: tglVal,
      tgl: tglVal,
      masa: nilaiMasaBaku,
      cabang: cabangPilih || ref.cabang || "",
      group: groupPilih,
      noperkiraan: noPerkLawan,
      noper: noPerkLawan,
      penjelasan: "Mutasi transaksi kas/Bank tgl " + tglVal,
      desc: "Mutasi transaksi kas/Bank tgl " + tglVal,
      db: dbVal,
      cr: crVal,
      total: nilaiRp,
    });
  });

  var transPlusTahun = transTerpilih.concat(mutasiListReffBaru);

  var perkMaster = [],
    golMaster = [];

  if (isBulanPertama) {
    var thnSebelum = String(parseInt(tahunProses) - 1);
    var namaTabelPerkSebelum = "perkiraan" + thnSebelum;
    var namaTabelGolSebelum = "golongan" + thnSebelum;
    var masaSebelum = "12" + thnSebelum.substring(2, 4);

    var perkThnLalu = (await db.getAll(namaTabelPerkSebelum)) || [];
    var golThnLalu = (await db.getAll(namaTabelGolSebelum)) || [];

    perkMaster = perkThnLalu.filter(function (p) {
      return (
        String(p.masa || "").trim() === masaSebelum &&
        (!cabangPilih || String(p.cabang || "").trim() === cabangPilih) &&
        String(p.group || "TLGA").trim() === groupPilih
      );
    });
    golMaster = golThnLalu.filter(function (g) {
      return (
        String(g.masa || "").trim() === masaSebelum &&
        (!cabangPilih || String(g.cabang || "").trim() === cabangPilih) &&
        String(g.group || "TLGA").trim() === groupPilih
      );
    });

    if (perkMaster.length === 0)
      perkMaster = perkThnLalu.filter(function (p) {
        return (
          (!cabangPilih || String(p.cabang || "").trim() === cabangPilih) &&
          String(p.group || "TLGA").trim() === groupPilih
        );
      });
    if (golMaster.length === 0)
      golMaster = golThnLalu.filter(function (g) {
        return (
          (!cabangPilih || String(g.cabang || "").trim() === cabangPilih) &&
          String(g.group || "TLGA").trim() === groupPilih
        );
      });
  } else {
    var bulanSebelum = String(parseInt(bulanProses) - 1).padStart(2, "0");
    var masaSebelum = bulanSebelum + tahunProses.substring(2, 4);

    var perkBulanLalu = (await db.getAll(namaTabelPerk)) || [];
    var golBulanLalu = (await db.getAll(namaTabelGol)) || [];

    perkMaster = perkBulanLalu.filter(function (p) {
      return (
        String(p.masa || "").trim() === masaSebelum &&
        (!cabangPilih || String(p.cabang || "").trim() === cabangPilih) &&
        String(p.group || "TLGA").trim() === groupPilih
      );
    });
    golMaster = golBulanLalu.filter(function (g) {
      return (
        String(g.masa || "").trim() === masaSebelum &&
        (!cabangPilih || String(g.cabang || "").trim() === cabangPilih) &&
        String(g.group || "TLGA").trim() === groupPilih
      );
    });

    if (perkMaster.length === 0)
      perkMaster = perkBulanLalu.filter(function (p) {
        return (
          (!cabangPilih || String(p.cabang || "").trim() === cabangPilih) &&
          String(p.group || "TLGA").trim() === groupPilih
        );
      });
    if (golMaster.length === 0)
      golMaster = golBulanLalu.filter(function (g) {
        return (
          (!cabangPilih || String(g.cabang || "").trim() === cabangPilih) &&
          String(g.group || "TLGA").trim() === groupPilih
        );
      });
  }

  var perk2026 = JSON.parse(JSON.stringify(perkMaster));
  var gol2026 = JSON.parse(JSON.stringify(golMaster));

  perk2026.forEach(function (p) {
    p.awal = num(p.akhir || 0);
    p.db = 0;
    p.cr = 0;
  });
  gol2026.forEach(function (g) {
    g.awal = num(g.akhir || 0);
    g.db = 0;
    g.cr = 0;
  });

  transPlusTahun.forEach(function (tr) {
    var noperTr = String(tr.noperkiraan || tr.noper || "").trim();
    var valDb = num(tr.db);
    var valCr = num(tr.cr);
    var penjelasanTr = tr.penjelasan || tr.desc || "-";

    // Ambil data cabang dan group dari transaksi (sesuaikan propertinya jika berbeda, misal: tr.cabang, tr.group)
    var cabangTr = tr.cabang || cabangPilih || "";
    var groupTr = tr.group || groupPilih || "TLGA";

    // ==========================================
    // 1. PENGECEKAN & PENAMBAHAN KE MASTER PERKIRAAN
    // ==========================================
    var targetPerk = perk2026.find(function (p) {
      return (
        String(p.noPerk || p.noperkiraan || p.noper || "").trim() === noperTr
      );
    });

    if (targetPerk) {
      // Jika sudah ada, akumulasikan nilainya
      targetPerk.db = num(targetPerk.db) + valDb;
      targetPerk.cr = num(targetPerk.cr) + valCr;
    } else if (noperTr !== "") {
      // Jika TIDAK ADA, tambahkan ke master perk2026 (termasuk cabang & group)
      perk2026.push({
        noPerk: noperTr,
        penjelasan: penjelasanTr,
        cabang: cabangTr,
        group: groupTr,
        awal: 0,
        db: valDb,
        cr: valCr,
        akhir: valDb - valCr,
      });
    }

    // ==========================================
    // 2. PENGECEKAN & PENAMBAHAN KE MASTER GOLONGAN
    // ==========================================
    if (noperTr.length >= 3) {
      var kodeGolTr = noperTr.substring(0, 3);
      var targetGol = gol2026.find(function (g) {
        return String(g.gol || g.kode || "").trim() === kodeGolTr;
      });

      if (targetGol) {
        // Jika golongan sudah ada, akumulasikan nilainya
        targetGol.db = num(targetGol.db) + valDb;
        targetGol.cr = num(targetGol.cr) + valCr;
      } else {
        // Jika TIDAK ADA, tambahkan golongan baru (termasuk cabang & group)
        gol2026.push({
          gol: kodeGolTr,
          namagol: penjelasanTr,
          cabang: cabangTr,
          group: groupTr,
          awal: 0,
          db: valDb,
          cr: valCr,
          akhir: valDb - valCr,
        });
      }
    }
  });

  var totalNetRL = 0;
  perk2026.forEach(function (p) {
    var akunNum = parseFloat(
      String(p.noPerk || p.noperkiraan || p.noper || "").trim(),
    );
    if (!isNaN(akunNum) && akunNum > 299) totalNetRL += num(p.db) - num(p.cr);
  });

  var targetAkunRL = "299.0000",
    targetGolRL = "299",
    tanggalAkhirBulan = periode + "-28";

  var akunPerkRL = perk2026.find(function (p) {
    return String(p.noper || p.noperkiraan || "").trim() === targetAkunRL;
  });
  if (!akunPerkRL) {
    akunPerkRL = {
      noper: targetAkunRL,
      namaPerk: "RL Berjalan",
      desc: "RL Berjalan",
      awal: 0,
      db: 0,
      cr: 0,
      akhir: 0,
      masa: nilaiMasaBaku,
      cabang: cabangPilih || "01",
      group: groupPilih,
    };
    perk2026.push(akunPerkRL);
  }

  var akunGolRL = gol2026.find(function (g) {
    return String(g.gol || "").trim() === targetGolRL;
  });
  if (!akunGolRL) {
    akunGolRL = {
      gol: targetGolRL,
      namaGol: "RL Berjalan",
      awal: 0,
      db: 0,
      cr: 0,
      akhir: 0,
      masa: nilaiMasaBaku,
      cabang: cabangPilih || "01",
      group: groupPilih,
    };
    gol2026.push(akunGolRL);
  }

  var transRLBaru = {
    noreff: "RL-" + nilaiMasaBaku,
    tanggal: tanggalAkhirBulan,
    tgl: tanggalAkhirBulan,
    masa: nilaiMasaBaku,
    cabang: cabangPilih || "",
    group: groupPilih,
    noperkiraan: targetAkunRL,
    noper: targetAkunRL,
    penjelasan: "RL berjalan bulan " + bulanProses,
    desc: "RL berjalan bulan " + bulanProses,
    db: 0,
    cr: 0,
    total: Math.abs(totalNetRL),
  };

  if (totalNetRL < 0) {
    akunPerkRL.db += Math.abs(totalNetRL);
    akunGolRL.db += Math.abs(totalNetRL);
    transRLBaru.db = Math.abs(totalNetRL);
  } else if (totalNetRL > 0) {
    akunPerkRL.cr += totalNetRL;
    akunGolRL.cr += totalNetRL;
    transRLBaru.cr = totalNetRL;
  }

  perk2026.forEach(function (p) {
    p.akhir = num(p.awal) + num(p.db) - num(p.cr);
    p.masa = nilaiMasaBaku;
    if (cabangPilih) p.cabang = cabangPilih;
    p.group = groupPilih;
  });
  gol2026.forEach(function (g) {
    g.akhir = num(g.awal) + num(g.db) - num(g.cr);
    g.masa = nilaiMasaBaku;
    if (cabangPilih) g.cabang = cabangPilih;
    g.group = groupPilih;
  });

  transPlusTahun.push(transRLBaru);

  return {
    periode,
    tahunProses,
    bulanProses,
    nilaiMasaBaku,
    isBulanPertama,
    namaTabelTrans,
    namaTabelPerk,
    namaTabelGol,
    perk2026,
    gol2026,
    transPlusTahun,
  };
}

/* ================================================================
   TAMPILKAN PREVIEW (TAB VIEW + DOWNLOAD EXCEL)
   =============================================================== */
function renderPreviewTab(data) {
  var infoText = data.isBulanPertama
    ? '<span style="color:red;">* Saldo awal diambil dari Saldo Akhir Tahun Sebelumnya</span>'
    : '<span style="color:blue;">* Saldo awal diambil dari Saldo Akhir Masa ' +
      String(parseInt(data.bulanProses) - 1).padStart(2, "0") +
      "</span>";

  var html = `
    <div style="background:#eef2f5; padding:10px; border-radius:6px; margin-bottom:15px; font-size:14px;">
      <strong>Preview Posting Periode: ${data.periode} (Masa: ${data.nilaiMasaBaku})</strong><br>
      ${infoText}
      <div style="margin-top:8px; font-size:11px; color:#666;">
        <i class="fa-solid fa-circle-info"></i> Tips: Blok tabel di bawah lalu <b>Ctrl+C</b>, buka Excel lalu <b>Ctrl+V</b> untuk paste rapi.
      </div>
    </div>
    
    <div style="display:flex; gap:8px; margin-bottom:15px; flex-wrap:wrap;">
      <button class="btn btn-b tab-btn active" onclick="switchTab('perk', this)">Lihat Perkiraan</button>
      <button class="btn btn-b tab-btn" onclick="switchTab('gol', this)">Lihat Golongan</button>
      <button class="btn btn-b tab-btn" onclick="switchTab('trans', this)">Lihat Transaksi</button>
      <button class="btn btn-a" onclick="downloadToExcel()" style="margin-left:auto;">
        <i class="fa-solid fa-file-excel"></i> Download .xls
      </button>
    </div>

    <div id="tab_content" style="overflow:auto; max-height:450px; border:1px solid #ccc; border-radius:4px;"></div>
  `;

  $("tempat_tabel_preview").innerHTML = html;
  switchTab("perk", document.querySelector(".tab-btn.active"));
}

function switchTab(type, btnElement) {
  document.querySelectorAll(".tab-btn").forEach(function (b) {
    b.classList.remove("active");
  });
  if (btnElement) btnElement.classList.add("active");

  var data = window._tempPostData;
  var fmt = function (v) {
    return formatRp(num(v));
  };
  var contentHtml = "";

  var bs =
    "border:1px solid #000; color:#000 !important; background-color:#fff !important; padding:8px 10px;";

  if (type === "perk") {
    var totalAwal = 0,
      totalDb = 0,
      totalCr = 0,
      totalAkhir = 0;
    var filtered = data.perk2026.filter(function (p) {
      return num(p.awal) + num(p.db) + num(p.cr) !== 0;
    });

    filtered.sort(function (a, b) {
      var noperA = String(a.noPerk || a.noperkiraan || a.noper || "");
      var noperB = String(b.noPerk || b.noperkiraan || b.noper || "");
      return noperA.localeCompare(noperB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    contentHtml = `<table id="tbl_preview" style="width:100%; min-width:900px; border-collapse:collapse; text-align:left; ${bs} font-size:0.85rem;">
      <thead style="background:#f4f4f4 !important; color:#000 !important; font-weight:bold;">
        <tr>
          <th style="${bs} text-align:center;">NO PERKIRAAN</th>
          <th style="${bs}">KETERANGAN</th>
          <th style="${bs} text-align:right;">SALDO AWAL</th>
          <th style="${bs} text-align:right;">DEBET</th>
          <th style="${bs} text-align:right;">KREDIT</th>
          <th style="${bs} text-align:right;">SALDO AKHIR</th>
        </tr>
      </thead>
      <tbody>`;

    filtered.forEach(function (p) {
      var awal = num(p.awal),
        db = num(p.db),
        cr = num(p.cr),
        akhir = num(p.akhir);
      totalAwal += awal;
      totalDb += db;
      totalCr += cr;
      totalAkhir += akhir;

      // ✅ DITAMBAHKAN: Tanda kutip satu (') di depan noper
      var noperTampil = "'" + esc(p.noPerk || p.noperkiraan || p.noper || "-");

      contentHtml += `<tr>
        <td style="${bs} text-align:center; color:green !important; font-weight:bold;">${noperTampil}</td>
        <td style="${bs} white-space:nowrap;">${esc(p.penjelasan || p.desc || p.nama || "-")}</td>
        <td style="${bs} text-align:right; white-space:nowrap;">${fmt(awal)}</td>
        <td style="${bs} text-align:right; white-space:nowrap;">${fmt(db)}</td>
        <td style="${bs} text-align:right; white-space:nowrap;">${fmt(cr)}</td>
        <td style="${bs} text-align:right; font-weight:bold; white-space:nowrap;">${fmt(akhir)}</td>
      </tr>`;
    });

    contentHtml += `<tr style="font-weight:bold; background:#e9ecef !important; color:#000 !important;">
      <td colspan="2" style="${bs} text-align:center; border-top:3px double #000 !important;">TOTAL PERKIRAAN</td>
      <td style="${bs} text-align:right; border-top:3px double #000 !important;">${fmt(totalAwal)}</td>
      <td style="${bs} text-align:right; border-top:3px double #000 !important;">${fmt(totalDb)}</td>
      <td style="${bs} text-align:right; border-top:3px double #000 !important;">${fmt(totalCr)}</td>
      <td style="${bs} text-align:right; border-top:3px double #000 !important;">${fmt(totalAkhir)}</td>
    </tr></tbody></table>`;
  } else if (type === "gol") {
    var totalAwal = 0,
      totalDb = 0,
      totalCr = 0,
      totalAkhir = 0;

    var filtered = data.gol2026.filter(function (g) {
      return num(g.awal) + num(g.db) + num(g.cr) !== 0;
    });

    filtered.sort(function (a, b) {
      var golA = String(a.gol || a.kode || "");
      var golB = String(b.gol || b.kode || "");
      return golA.localeCompare(golB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    contentHtml = `<table id="tbl_preview" style="width:100%; min-width:900px; border-collapse:collapse; text-align:left; ${bs} font-size:0.85rem;">
      <thead style="background:#f4f4f4 !important; color:#000 !important; font-weight:bold;">
        <tr>
          <th style="${bs} text-align:center;">GOL</th>
          <th style="${bs}">NAMA GOLONGAN</th>
          <th style="${bs} text-align:right;">SALDO AWAL</th>
          <th style="${bs} text-align:right;">DEBET</th>
          <th style="${bs} text-align:right;">KREDIT</th>
          <th style="${bs} text-align:right;">SALDO AKHIR</th>
          <th style="${bs} text-align:center;">MASA</th>
          <th style="${bs} text-align:center;">CAB</th>
          <th style="${bs} text-align:center;">GROUP</th>
        </tr>
      </thead>
      <tbody>`;

    filtered.forEach(function (g) {
      var awal = num(g.awal),
        db = num(g.db),
        cr = num(g.cr),
        akhir = num(g.akhir);

      totalAwal += awal;
      totalDb += db;
      totalCr += cr;
      totalAkhir += akhir;

      var kodeGol = esc(g.gol || g.kode || "-");
      var namaGol = esc(g.namagol || g.namaGol || g.nama || "-");
      var masaVal = esc(g.masa || "-");
      var cabangVal = esc(g.cabang || g.cab || "-");
      var groupVal = esc(g.group || "-");

      contentHtml += `<tr>
        <td style="${bs} text-align:center; color:green !important; font-weight:bold;">${kodeGol}</td>
        <td style="${bs} white-space:nowrap;">${namaGol}</td>
        <td style="${bs} text-align:right; white-space:nowrap;">${fmt(awal)}</td>
        <td style="${bs} text-align:right; white-space:nowrap;">${fmt(db)}</td>
        <td style="${bs} text-align:right; white-space:nowrap;">${fmt(cr)}</td>
        <td style="${bs} text-align:right; font-weight:bold; white-space:nowrap;">${fmt(akhir)}</td>
        <td style="${bs} text-align:center; white-space:nowrap;">${masaVal}</td>
        <td style="${bs} text-align:center; white-space:nowrap;">${cabangVal}</td>
        <td style="${bs} text-align:center; white-space:nowrap;">${groupVal}</td>
      </tr>`;
    });

    contentHtml += `<tr style="font-weight:bold; background:#e9ecef !important; color:#000 !important;">
      <td colspan="2" style="${bs} text-align:center; border-top:3px double #000 !important;">TOTAL GOLONGAN</td>
      <td style="${bs} text-align:right; border-top:3px double #000 !important;">${fmt(totalAwal)}</td>
      <td style="${bs} text-align:right; border-top:3px double #000 !important;">${fmt(totalDb)}</td>
      <td style="${bs} text-align:right; border-top:3px double #000 !important;">${fmt(totalCr)}</td>
      <td style="${bs} text-align:right; border-top:3px double #000 !important;">${fmt(totalAkhir)}</td>
      <td colspan="3" style="${bs} border-top:3px double #000 !important;"></td>
    </tr></tbody></table>`;
  } else if (type === "trans") {
    var filtered = data.transPlusTahun.filter(function (t) {
      return num(t.db) !== 0 || num(t.cr) !== 0;
    });

    filtered.sort(function (a, b) {
      var tglA = String(a.tanggal || a.tgl || "");
      var tglB = String(b.tanggal || b.tgl || "");
      return tglA.localeCompare(tglB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    contentHtml = `<table id="tbl_preview" style="width:100%; min-width:900px; border-collapse:collapse; text-align:left; ${bs} font-size:0.85rem;">
      <thead style="background:#f4f4f4 !important; color:#000 !important; font-weight:bold;">
        <tr>
          <th style="${bs}">TGL</th>
          <th style="${bs}">NO REFF</th>
          <th style="${bs}">NO PERK</th>
          <th style="${bs}">KETERANGAN</th>
          <th style="${bs} text-align:right;">DEBET</th>
          <th style="${bs} text-align:right;">KREDIT</th>
        </tr>
      </thead>
      <tbody>`;

    filtered.forEach(function (t) {
      // ✅ DITAMBAHKAN: Tanda kutip satu (') di depan noper transaksi
      var noperTrans = "'" + esc(t.noperkiraan || t.noper);

      contentHtml += `<tr>
        <td style="${bs} white-space:nowrap;">${esc(t.tanggal || t.tgl)}</td>
        <td style="${bs} white-space:nowrap;">${esc(t.noreff)}</td>
        <td style="${bs} text-align:center; color:green !important; font-weight:bold;">${noperTrans}</td>
        <td style="${bs} white-space:nowrap;">${esc(t.penjelasan || t.desc || "-")}</td>
        <td style="${bs} text-align:right; white-space:nowrap;">${fmt(t.db)}</td>
        <td style="${bs} text-align:right; white-space:nowrap;">${fmt(t.cr)}</td>
      </tr>`;
    });
    contentHtml += `</tbody></table>`;
  }

  $("tab_content").innerHTML = contentHtml;
}
/* ================================================================
   FUNGSI DOWNLOAD KE EXCEL ASLI (.XLS)
   =============================================================== */
function downloadToExcel() {
  var table = document.getElementById("tbl_preview");
  if (!table) return toast("Tidak ada tabel yang bisa didownload", "err");

  // Clone tabel untuk menghilangkan CSS warna supaya bersih di Excel
  var cloneTable = table.cloneNode(true);
  cloneTable.removeAttribute("style");
  cloneTable.setAttribute("border", "1");
  cloneTable.setAttribute("cellpadding", "4");
  cloneTable.querySelectorAll("thead, tr, th, td").forEach(function (el) {
    el.removeAttribute("style");
    el.setAttribute("border", "1");
  });

  var html =
    (html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Posting Data</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
  <body>${cloneTable.outerHTML}</body></html>`);

  // Konversi ke Base64 dan trigger download
  var blob = new Blob([html], { type: "application/vnd.ms-excel" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "Preview_Posting_" +
    (window._tempPostData ? window._tempPostData.periode : "data") +
    ".xls";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast("File Excel berhasil didownload!", "ok");
}

/* ================================================================
   TOMBOL PREVIEW & POSTING
   =============================================================== */
async function doPreviewPosting() {
  $("tempat_tabel_preview").innerHTML =
    "<div class='loading'>Menghitung data posting...</div>";
  $("btn_posting_final").style.display = "none";

  try {
    window._tempPostData = await hitungDataPosting();
    renderPreviewTab(window._tempPostData);
    $("btn_posting_final").style.display = "inline-flex";
    toast("Preview berhasil dihitung.", "ok");
  } catch (err) {
    console.error(err);
    toast(err.message, "err");
    $("tempat_tabel_preview").innerHTML = "";
  }
}

async function doPostingAlurBaru() {
  if (!window._tempPostData) {
    return toast("Silakan klik 'Tampilkan Preview' terlebih dahulu!", "err");
  }

  var data = window._tempPostData;
  toast("Menyimpan data ke server...", "ok");

  // 1. Siapkan payload untuk masing-masing tabel (dengan copy array baru agar tidak mutate data asli)
  var payloads = [
    {
      name: "Perkiraan",
      body: {
        storeName: data.namaTabelPerk,
        data: data.perk2026,
      },
    },
    {
      name: "Golongan",
      body: {
        storeName: data.namaTabelGol,
        data: data.gol2026,
      },
    },
    {
      name: "Transaksi",
      body: {
        storeName: data.namaTabelTrans,
        // Mengembalikan object baru instead of mutate existing item
        data: data.transPlusTahun.map(function (item) {
          return { ...item, masa: data.nilaiMasaBaku };
        }),
      },
    },
  ];

  // 2. Fungsi helper untuk melakukan fetch + validasi status HTTP
  async function saveData(payload) {
    var response = await fetch("http://localhost:3000/api/save-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.body),
    });

    // Jika server mengembalikan status 4xx atau 5xx, anggap gagal
    if (!response.ok) {
      throw new Error(
        `Gagal simpan ${payload.name} (Status: ${response.status})`,
      );
    }
    return response.json(); // Bisa di-parse atau langsung return response tergantung kebutuhan backend Anda
  }

  try {
    // 3. Eksekusi ketiga request SECARA PARALEL
    // Promise.allSettled akan menunggu semuanya selesai, meskipun ada yang gagal
    var results = await Promise.allSettled(payloads.map(saveData));

    // 4. Evaluasi hasil
    var gagal = results.filter((r) => r.status === "rejected");

    if (gagal.length > 0) {
      // Jika ada yang gagal, kumpulkan pesan errornya
      var pesanError = gagal.map((g) => g.reason.message).join("; ");
      throw new Error(pesanError);
    }

    // 5. Jika semua sukses
    toast("Sukses memposting periode " + data.periode, "ok");
    $("btn_posting_final").style.display = "none";
    window._tempPostData = null;
    $("tempat_tabel_preview").innerHTML = "";

    // Navigasi ke blank
    if (typeof renderBlank === "function") {
      renderBlank();
    } else if (
      typeof PANEL_MAP !== "undefined" &&
      typeof PANEL_MAP.blank === "function"
    ) {
      PANEL_MAP.blank();
    } else {
      location.hash = "#blank";
    }
  } catch (err) {
    console.error("Gagal Posting:", err);
    toast("Gagal memproses posting: " + err.message, "err");

    // CATATAN PENTING:
    // Karena di sini ada yang gagal, data di server mungkin 'setengah jadi'.
    // Disarankan di backend Anda memiliki mekanisme rollback,
    // atau kirim flag 'isDraft=true' terlebih dahulu, lalu update jadi 'final=true' jika ketiga request sukses.
  }
}
