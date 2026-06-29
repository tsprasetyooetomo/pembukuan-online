/* ================================================================
   app_init.js — ENTRY POINT (UPDATED WITH AUTH CHECK)
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
    // 1. Cek status login terlebih dahulu sebelum memproses data/UI
    const token = localStorage.getItem("token");
    const loginBox = document.getElementById("loginBox");
    const sidebar = document.getElementById("sidebar");
    const tbTitle = document.getElementById("tbTitle");

    if (!token) {
      // JIKA BELUM LOGIN:
      // Tampilkan box login
      if (loginBox) loginBox.style.display = "block";

      // Sembunyikan sidebar utama dengan class bawaan css Anda
      if (sidebar) sidebar.classList.add("hidden-menu");

      // Ubah judul bar atas menjadi instruksi login
      if (tbTitle) {
        tbTitle.innerHTML = `<i class="fa-solid fa-lock"></i> Silakan Login Terlebih Dahulu`;
      }

      // Matikan overlay loading default agar form login terlihat
      document.getElementById("loadingOv").style.display = "none";
      console.log(
        "Auth: Token tidak ditemukan. Menghentikan init aplikasi untuk login.",
      );
      return; // 🛑 STOP DI SINI. Jangan lanjut load database/sidebar.
    }

    // JIKA SUDAH LOGIN, LANJUTKAN PROSES BERIKUTNYA:
    if (loginBox) loginBox.style.display = "none";

    const namaUser = localStorage.getItem("nama") || "User";
    const cabangUser = localStorage.getItem("cabang") || "--";

    if (tbTitle) {
      tbTitle.innerHTML = `<i class="fa-solid fa-database"></i> Cabang: ${cabangUser} (${namaUser})`;
    }

    // 2. Buka koneksi database IndexedDB bawaan aplikasi Anda
    await initDB();

    // 3. ✅ Jalankan migrasi saldo awal tepat setelah database terkoneksi
    await migrasiSaldoAwalKodeBank();

    // 4. Muat seluruh data IndexedDB ke dalam variabel memori global (DBCache)
    await refreshCache();

    // 5. Bangun UI & Navigasi panel utama
    buildSidebar();
    document.getElementById("loadingOv").style.display = "none";

    console.log("Navigate ke 3: " + currentPanel);
    navigate(currentPanel);
  } catch (err) {
    // Penanganan jika IndexedDB atau proses sinkronisasi gagal
    document.getElementById("loadingOv").innerHTML =
      '<span style="color:var(--danger);display:flex;align-items:center;gap:.5rem;flex-direction:column;max-width:350px;text-align:center">' +
      '<i class="fa-solid fa-circle-xmark" style="font-size:2rem"></i>' +
      '<div style="font-size:.9rem;font-weight:600">Gagal Membuka Database</div>' +
      '<div style="font-size:.76rem;color:var(--muted);line-height:1.5">' +
      (err.message || err) +
      "</div>" +
      '<button class="btn btn-g" style="margin-top:.8rem" onclick="location.reload()"><i class="fa-solid fa-rotate-right"></i> Coba Lagi</button></span>';
    console.error("Init error:", err);
  }
}

// Jalankan entry point aplikasi
init();
