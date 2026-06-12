/* ================================================================
   app_init.js — ENTRY POINT
   ================================================================ */

window.addEventListener("unhandledrejection", function (e) {
  e.preventDefault();
  console.error("🚨 PROMISE ERROR DITANGKAP:", e.reason);
  alert("PROMISE ERROR: " + (e.reason.message || e.reason));
});

// ✅ FUNGSI MIGRASI OTOMATIS: Menyuntikkan field 'awal' bernilai 0 untuk data bank lama

async function migrasiSaldoAwalKodeBank() {
  try {
    var allKB = await db.getAll("kodeBank");

    for (var i = 0; i < allKB.length; i++) {
      var item = allKB[i];
      var changed = false;

      if (item.awal === undefined) {
        item.awal = 0;
        changed = true;
      }

      /* ✅ TAMBAHAN MIGRASI: Jika tanggal saldo awal kosong, isi dengan tanggal default */
      if (item.tgl_awal === undefined) {
        item.tgl_awal = "2026-01-01"; // Silakan sesuaikan tanggal buku awal aplikasi Anda
        changed = true;
      }

      if (changed) {
        await db.put("kodeBank", item);
      }
    }
    console.log("System: Migrasi skema saldo awal & tanggal kodeBank selesai.");
  } catch (e) {
    console.error("System Error (Migration Failed):", e);
  }
}

async function init() {
  try {
    // 1. Buka koneksi database IndexedDB bawaan aplikasi Anda
    await initDB();

    // 2. ✅ DISISIPKAN DI SINI: Jalankan migrasi saldo awal tepat setelah database terkoneksi
    await migrasiSaldoAwalKodeBank();

    // 3. Muat seluruh data IndexedDB ke dalam variabel memori global (DBCache)
    await refreshCache();

    buildSidebar();
    $("loadingOv").style.display = "none";
    console.log("Navigate ke 3: " + currentPanel);
    navigate(currentPanel);
    //navigate("kode");
  } catch (err) {
    $("loadingOv").innerHTML =
      '<span style="color:var(--danger);display:flex;align-items:center;gap:.5rem;flex-direction:column;max-width:350px;text-align:center">' +
      '<i class="fa-solid fa-circle-xmark" style="font-size:2rem"></i>' +
      '<div style="font-size:.9rem;font-weight:600">Gagal Membuka Database</div>' +
      '<div style="font-size:.76rem;color:var(--muted);line-height:1.5">' +
      esc(err.message) +
      "</div>" +
       '<button class="btn btn-g" style="margin-top:.8rem" onclick="location.reload()"><i class="fa-solid fa-rotate-right"></i> Coba Lagi</button></span>';
      console.error("Init error:", err);
  }
}

init();
