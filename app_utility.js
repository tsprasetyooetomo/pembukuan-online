/* globals getCabangOpts, lookupCabangLabel, uid, esc, fmtN, num, openModal, closeModal, showConfirm, toast, bulkInit, bulkBarHTML, bulkBarHTMLCustom, bulkGetIds, bulkGetKey, crudActions, wrapTable, buildTable, refreshCache, currentPanel, DBCache, db, XLSX */

/* ================================================================
   app_utility.js — IMPORT TRANSAKSI, FORMAT RL, FORMAT NERACA, DATABASE INFO
   ================================================================ */

/* ---------- Import Data Transaksi (XLS/CSV) ---------- */
PANEL_MAP.importD = renderImport;

function renderImport() {
  return (
    '<div style="max-width:600px">' +
    '<div style="background:var(--card);border:1px solid var(--brd);border-radius:var(--r);padding:1.2rem;margin-bottom:1rem">' +
    '<h3 style="font-size:.9rem;margin-bottom:.5rem"><i class="fa-solid fa-file-excel" style="color:var(--info)"></i> Import Transaksi</h3>' +
    '<div style="margin-bottom:1rem;font-size:.8rem;color:var(--fg)">Import data detil transaksi harian/mutasi bank.</div>' +
    '<div class="fg"><label>File Excel / CSV</label><input type="file" id="imp_file" accept=".xlsx,.xls,.csv" style="font-size:.8rem;color:var(--fg)"></div>' +
    '<div class="fg"><label style="display:flex;align-items:center;gap:.4rem;cursor:pointer"><input type="checkbox" id="imp_skipDup" checked style="accent-color:var(--accent)"> Lewati jika duplikat (Tanggal + No Reff)</label></div>' +
    '<div style="margin-top:.8rem"><button class="btn btn-a" onclick="doImport()"><i class="fa-solid fa-upload"></i> Proses Import</button></div></div>' +
    '<div style="background:var(--card);border:1px solid var(--brd);border-radius:var(--r);padding:1rem;font-size:.72rem;color:var(--muted);font-family:JetBrains Mono,monospace;line-height:1.8">' +
    '<div style="font-size:.78rem;font-weight:600;color:var(--fg);margin-bottom:.5rem">Format Kolom Wajib Header:</div>' +
    '<div><span class="tag tag-cr">Transaksi</span> tanggal, noreff, kodeBank, kodeTrans, dariKePada, desc, total, db, cr, cabang</div>' +
    '<div style="margin-top:4px">* Kolom "cabang" bersifat opsional (default: Pusat)</div></div></div>'
  );
}

function doImport() {
  var file = $("imp_file").files[0];
  var skipDup = $("imp_skipDup").checked;

  if (!file) {
    toast("Pilih file terlebih dahulu", "err");
    return;
  }

  var reader = new FileReader();
  reader.onload = async function (e) {
    try {
      // Membaca file Excel/CSV
      var wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

      var cnt = 0,
        skipped = 0;

      // Persiapan cek duplikat berdasarkan Tanggal + No Reff
      var existingKeys = {};
      if (skipDup) {
        DBCache.transaksi.forEach(function (x) {
          existingKeys[x.tanggal + "|" + x.noreff] = true;
        });
      }

      // Helper Functions
      function gv(keys) {
        for (var k = 0; k < keys.length; k++) {
          if (
            r[keys[k]] !== undefined &&
            r[keys[k]] !== null &&
            String(r[keys[k]]).trim() !== ""
          )
            return r[keys[k]];
        }
        return "";
      }

      function pn(v) {
        if (!v) return 0;
        var s = String(v)
          .trim()
          .replace(/\./g, "")
          .replace(/,/g, ".")
          .replace(/[^0-9.\-]/g, "");
        var n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      }

      function pd(v) {
        if (!v) return "";
        if (v instanceof Date && !isNaN(v.getTime()))
          return (
            v.getFullYear() +
            "-" +
            String(v.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(v.getDate()).padStart(2, "0")
          );
        var s = String(v).trim(),
          m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m)
          return (
            m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0")
          );
        return s;
      }

      function cs(v) {
        return v ? String(v).trim() : "";
      }

      // Loop setiap baris data
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];

        // --- PROSES KHUSUS TRANSAKSI ---
        var tanggal = pd(gv(["tanggal", "Tanggal", "tgl"])),
          noreff = cs(gv(["noreff", "no_reff", "NoRef"])),
          kodeBank = cs(gv(["kodeBank", "kode_bank", "Bank"])),
          kodeTrans = cs(gv(["kodeTrans", "kode_trans", "Kode"])),
          dariKePada = cs(gv(["dariKePada", "dari_ke_pada", "Pihak"])),
          desc = cs(gv(["desc", "deskripsi", "Keterangan", "Uraian"])),
          total = pn(gv(["total", "Total", "Nominal"])),
          db2 = pn(gv(["db", "debit", "Debet"])),
          cr2 = pn(gv(["cr", "kredit", "Kredit"])),
          cabang = cs(gv(["cabang", "Cabang", "Branch"])) || "Pusat";

        // Validasi Field Wajib
        if (!tanggal || !noreff || !kodeTrans) {
          skipped++; // Baris tidak lengkap dilewati
          continue;
        }

        var key = tanggal + "|" + noreff;
        if (skipDup && existingKeys[key]) {
          skipped++;
          continue;
        }

        existingKeys[key] = true;
        await db.add("transaksi", {
          id: uid(),
          tanggal: tanggal,
          noreff: noreff,
          kodeBank: kodeBank,
          kodeTrans: kodeTrans,
          dariKePada: dariKePada,
          desc: desc,
          total: total,
          db: db2,
          cr: cr2,
          cabang: cabang,
        });

        cnt++;
      }

      toast(
        cnt +
          " data transaksi berhasil diimport" +
          (skipped > 0 ? " (" + skipped + " dilewati/duplikat)" : ""),
        "ok",
      );
      $("imp_file").value = "";

      await refreshCache();
      navigate(currentPanel);
    } catch (err) {
      console.error(err);
      toast("Gagal import: " + err.message, "err");
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ---------- Format RL ---------- */
PANEL_MAP.fmtRL = renderFmtRL;

async function renderFmtRL() {
  var data = DBCache.formatRL;
  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("formatRL", ids);
  var rows = data.map(function (r) {
    return [r.gol, r.nama];
  });
  return (
    bulkBarHTML("formatRL", "Format RL") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem"><div style="font-size:.78rem;color:var(--muted)">Urutan tampilan RL</div>' +
    '<button class="btn btn-a" onclick="formFmtRL()"><i class="fa-solid fa-plus"></i> Tambah</button></div>' +
    wrapTable(
      buildTable(["Golongan", "Nama"], rows, {
        bulkStore: "formatRL",
        bulkIds: ids,
        actions: function (r, i) {
          return crudActions(data[i].id, "formatRL");
        },
        emptyMsg: "Belum ada format RL",
      }),
    )
  );
}

function formFmtRL(editId) {
  var d = editId
    ? DBCache.formatRL.find(function (r) {
        return r.id === editId;
      })
    : null;
  openModal(
    d ? "Edit Format RL" : "Tambah Format RL",
    '<div class="f-row"><div class="fg"><label>Golongan</label><input id="f_frGol" value="' +
      (d ? esc(d.gol) : "") +
      '"></div>' +
      '<div class="fg"><label>Nama</label><input id="f_frNama" value="' +
      (d ? esc(d.nama) : "") +
      '"></div></div>',
    '<button class="btn btn-g" onclick="closeModal()">Batal</button><button class="btn btn-a" onclick="saveFmtRL(\'' +
      (editId || "") +
      "')\">Simpan</button>",
  );
}

async function saveFmtRL(editId) {
  var gol = $("f_frGol").value.trim(),
    nama = $("f_frNama").value.trim();
  if (!gol || !nama) {
    toast("Wajib diisi", "err");
    return;
  }
  if (editId) {
    var r = await db.get("formatRL", editId);
    if (r)
      await db.put("formatRL", Object.assign({}, r, { gol: gol, nama: nama }));
  } else await db.add("formatRL", { id: uid(), gol: gol, nama: nama });
  closeModal();
  toast("Disimpan", "ok");
  navigate(currentPanel);
}

/* ---------- Format Neraca ---------- */
PANEL_MAP.fmtNeraca = renderFmtNeraca;

async function renderFmtNeraca() {
  var data = DBCache.formatNeraca;
  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("formatNeraca", ids);
  var rows = data.map(function (r) {
    return [r.gol, r.nama, r.sisi];
  });
  return (
    bulkBarHTML("formatNeraca", "Format Neraca") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem"><div style="font-size:.78rem;color:var(--muted)">Penempatan golongan di neraca</div>' +
    '<button class="btn btn-a" onclick="formFmtNeraca()"><i class="fa-solid fa-plus"></i> Tambah</button></div>' +
    wrapTable(
      buildTable(["Golongan", "Nama", "Sisi"], rows, {
        bulkStore: "formatNeraca",
        bulkIds: ids,
        actions: function (r, i) {
          return crudActions(data[i].id, "formatNeraca");
        },
        emptyMsg: "Belum ada format neraca",
      }),
    )
  );
}

function formFmtNeraca(editId) {
  var d = editId
    ? DBCache.formatNeraca.find(function (r) {
        return r.id === editId;
      })
    : null;
  openModal(
    d ? "Edit Format Neraca" : "Tambah Format Neraca",
    '<div class="f-row"><div class="fg"><label>Golongan</label><input id="f_fnGol" value="' +
      (d ? esc(d.gol) : "") +
      '"></div>' +
      '<div class="fg"><label>Nama</label><input id="f_fnNama" value="' +
      (d ? esc(d.nama) : "") +
      '"></div></div>' +
      '<div class="fg"><label>Sisi</label><select id="f_fnSisi"><option value="AKTIVA"' +
      (d && d.sisi === "AKTIVA" ? " selected" : "") +
      '>AKTIVA</option><option value="PASIVA"' +
      (d && d.sisi === "PASIVA" ? " selected" : "") +
      ">PASIVA</option></select></div>",
    '<button class="btn btn-g" onclick="closeModal()">Batal</button><button class="btn btn-a" onclick="saveFmtNeraca(\'' +
      (editId || "") +
      "')\">Simpan</button>",
  );
}

async function saveFmtNeraca(editId) {
  var gol = $("f_fnGol").value.trim(),
    nama = $("f_fnNama").value.trim(),
    sisi = $("f_fnSisi").value;
  if (!gol || !nama) {
    toast("Wajib diisi", "err");
    return;
  }
  if (editId) {
    var r = await db.get("formatNeraca", editId);
    if (r)
      await db.put(
        "formatNeraca",
        Object.assign({}, r, { gol: gol, nama: nama, sisi: sisi }),
      );
  } else
    await db.add("formatNeraca", {
      id: uid(),
      gol: gol,
      nama: nama,
      sisi: sisi,
    });
  closeModal();
  toast("Disimpan", "ok");
  navigate(currentPanel);
}

/* ---------- Database Info ---------- */
PANEL_MAP.dbInfo = renderDBInfo;
AFTER_RENDER.dbInfo = loadDBStats;

function renderDBInfo() {
  return (
    '<div class="db-info-card">' +
    '<h3><i class="fa-solid fa-database"></i> IndexedDB: PembukuanDB</h3>' +
    '<table class="db-tbl" id="dbStatsTbl"><tr><td>Memuat...</td><td>...</td></tr></table>' +
    '<div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">' +
    '<button class="btn btn-suc" onclick="doBackup()"><i class="fa-solid fa-download"></i> Backup Database</button>' +
    '<button class="btn btn-inf" onclick="$(\'restoreFile\').click()"><i class="fa-solid fa-upload"></i> Restore Database</button>' +
    '<input type="file" id="restoreFile" accept=".json" style="display:none" onchange="doRestore(event)">' +
    '<button class="btn btn-r" onclick="doClearAll()"><i class="fa-solid fa-trash-can"></i> Hapus Semua Data</button></div></div>' +
    '<div style="background:var(--card);border:1px solid var(--brd);border-radius:var(--r);padding:1rem;margin-top:.8rem">' +
    '<h4 style="font-size:.8rem;color:var(--muted);margin-bottom:.5rem">Tentang IndexedDB</h4>' +
    '<ul style="font-size:.74rem;color:var(--muted);line-height:1.8;padding-left:1rem">' +
    "<li>Database native browser — tidak perlu server</li>" +
    "<li>Kapasitas ratusan MB per origin</li>" +
    "<li>Transaksi ACID (atomic, consistent, isolated, durable)</li>" +
    "<li>Data persisten walau browser ditutup</li>" +
    "<li>Operasi asynchronous (non-blocking)</li>" +
    "<li>Support import DBF, Excel, dan hapus masal</li></ul></div>"
  );
}

async function loadDBStats() {
  var STORES = [
    "golongan",
    "perkiraan",
    "transaksi",
    "users",
    "formatRL",
    "formatNeraca",
    "postedMonths",
    "kodeBank",
  ];
  var html = "";
  for (var i = 0; i < STORES.length; i++) {
    var c = await db.count(STORES[i]);
    html += "<tr><td>" + STORES[i] + "</td><td>" + c + " record</td></tr>";
  }
  $("dbStatsTbl").innerHTML = html;
}

async function doBackup() {
  var json = await db.backup();
  var blob = new Blob([json], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download =
    "pembukuan_backup_" + new Date().toISOString().split("T")[0] + ".json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup berhasil diunduh", "ok");
}

function doRestore(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (ev) {
    window._restoreText = ev.target.result;
    openModal(
      "Konfirmasi Restore",
      '<div class="confirm-box"><p>Restore akan <strong style="color:var(--danger)">mengganti semua data</strong>. Lanjutkan?</p>' +
        '<div class="cb-btns"><button class="btn btn-g" onclick="closeModal()">Batal</button>' +
        '<button class="btn btn-r" onclick="confirmRestore()">Restore</button></div></div>',
    );
  };
  reader.readAsText(file);
  e.target.value = "";
}

async function confirmRestore() {
  try {
    await db.restore(window._restoreText);
    closeModal();
    toast("Database berhasil di-restore", "ok");
    await refreshCache();
    navigate(currentPanel);
  } catch (err) {
    toast("Gagal restore: " + err.message, "err");
  }
}

async function doClearAll() {
  openModal(
    "Konfirmasi Hapus Semua",
    '<div class="confirm-box">' +
      '<div style="padding:.8rem;background:rgba(220,53,69,.12);border:1px solid rgba(220,53,69,.3);border-radius:8px;margin-bottom:1rem">' +
      '<i class="fa-solid fa-skull-crossbones" style="color:var(--danger);font-size:1.5rem;display:block;margin-bottom:.5rem"></i>' +
      '<p><strong style="color:var(--danger)">HATI-HATI!</strong><br>Semua data akan dihapus permanen. User admin default akan dibuat ulang.</p></div>' +
      '<div class="cb-btns"><button class="btn btn-g" onclick="closeModal()">Batal</button>' +
      '<button class="btn btn-r" onclick="confirmClearAll()">Hapus Semua</button></div></div>',
  );
}

async function confirmClearAll() {
  var STORES = [
    "golongan",
    "perkiraan",
    "transaksi",
    "users",
    "formatRL",
    "formatNeraca",
    "postedMonths",
    "kodeBank",
  ];
  for (var i = 0; i < STORES.length; i++) await db.clear(STORES[i]);
  /* Buat user admin default */
  await db.add("users", {
    id: uid(),
    username: "admin",
    nama: "Administrator",
    role: "Admin",
    cabang: "Pusat",
    password: "admin",
  });
  closeModal();
  toast("Semua data dihapus, admin default dibuat", "ok");
  await refreshCache();
  navigate(currentPanel);
}
