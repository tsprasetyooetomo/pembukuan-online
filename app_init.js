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

    // Ambil elemen jam dan tanggal (Sesuaikan ID-nya dengan HTML Anda)
    const elemenJam = document.getElementById("jam");
    const elemenTanggal = document.getElementById("tanggal");

    if (!token) {
      // JIKA BELUM LOGIN / SAAT HALAMAN BARU DIBUKA:

      // A. Tampilkan box login saja
      if (loginBox) loginBox.style.display = "block";

      // B. SEMBUNYIKAN TOTAL elemen UI lainnya agar bersih
      if (sidebar) sidebar.classList.add("hidden-menu");
      if (tbTitle) tbTitle.style.display = "none";

      // 🟢 SEMBUNYIKAN JAM & TANGGAL
      const clockEl =
        document.getElementById("clockEl") ||
        document.querySelector("clockEl") ||
        document.querySelector(".clockEl");
      if (clockEl) clockEl.style.display = "none";

      // Sembunyikan tombol logout yang sudah diberi ID kemarin
      const btnLogout = document.getElementById("btnLogout");
      if (btnLogout) btnLogout.style.display = "none";

      // Matikan overlay loading default agar form login langsung terlihat
      document.getElementById("loadingOv").style.display = "none";
      console.log(
        "Auth: Token tidak ditemukan. Menghentikan init aplikasi untuk login.",
      );
      return; // 🛑 STOP DI SINI. Jangan lanjut load database/sidebar.
    }

    // ========================================================================
    // JIKA SUDAH LOGIN, LANJUTKAN PROSES BERIKUTNYA & TAMPILKAN KEMBALI UI-NYA:
    // ========================================================================
    if (loginBox) loginBox.style.display = "none";

    // Munculkan kembali judul, jam, dan tanggal karena user berhak melihatnya
    if (tbTitle) tbTitle.style.display = "block";
    if (elemenJam) elemenJam.style.display = "block";
    if (elemenTanggal) elemenTanggal.style.display = "block";

    const namaUser = localStorage.getItem("nama") || "User";
    const cabangUser = localStorage.getItem("cabang") || "--";

    if (tbTitle) {
      tbTitle.innerHTML = `<i class="fa-solid fa-database"></i> Cabang: ${cabangUser} (${namaUser})`;
    }

    // 2. Buka koneksi database IndexedDB bawaan aplikasi Anda
    await initDB();

    // 3. Jalankan migrasi saldo awal tepat setelah database terkoneksi
    await migrasiSaldoAwalKodeBank();

    // 4. Muat seluruh data IndexedDB ke dalam variabel memori global (DBCache)
    await refreshCache();

    // 5. Bangun UI & Navigasi panel utama
    buildSidebar();
    document.getElementById("loadingOv").style.display = "none";

    console.log("Navigate ke 3: " + currentPanel);
    navigate(currentPanel);
  } catch (err) {
    // ... Penanganan jika IndexedDB gagal
  }
}
// Jalankan entry point aplikasi
init();
