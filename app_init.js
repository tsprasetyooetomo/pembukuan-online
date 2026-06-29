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
function buildSidebar() {
  const sbBody = document.getElementById("sbBody");
  if (!sbBody) return;

  // 1. Ambil role user dari localStorage (Default ke VIEWER jika tidak ada)
  const userRole = (localStorage.getItem("role") || "VIEWER").toUpperCase();

  // 2. Gunakan array data MENUS asli milik Anda
  var MENUS = [
    {
      group: "PERKIRAAN",
      icon: "fa-sitemap",
      items: [
        { id: "gol", label: "Golongan Perkiraan", icon: "fa-layer-group" },
        { id: "perk", label: "No Perkiraan", icon: "fa-list-ol" },
        { id: "cbg", label: "Cabang", icon: "fa-code-branch" },
        { id: "kode", label: "Kode Bank/Kas", icon: "fa-building-columns" },
        { id: "saldoKasir", label: "Saldo Kasir", icon: "fa-building-columns" },
      ],
    },
    {
      group: "MUTASI",
      icon: "fa-right-left",
      items: [
        {
          id: "mutasikasir",
          label: "Mutasi Harian Kasir",
          icon: "fa-right-left",
        },
        { id: "mutasi", label: "Mutasi Transaksi", icon: "fa-right-left" },
      ],
    },
    {
      group: "LAPORAN KAS",
      icon: "fa-cash-register",
      items: [
        { id: "kaskasir", label: "Kas Harian Kasir", icon: "fa-calendar-day" },
        { id: "kasHarian", label: "Kas Harian", icon: "fa-calendar-day" },
        { id: "inputHarian", label: "Input Harian", icon: "fa-keyboard" },
      ],
    },
    {
      group: "POSTING",
      icon: "fa-stamp",
      items: [
        { id: "posting", label: "Posting Periode", icon: "fa-calendar-check" },
      ],
    },
    {
      group: "LAPORAN KEUANGAN",
      icon: "fa-chart-pie",
      items: [
        { id: "neraca", label: "Neraca", icon: "fa-scale-balanced" },
        { id: "detilNeraca", label: "Detil Neraca", icon: "fa-table-list" },
        { id: "rlRekap", label: "RL Rekap Bulanan", icon: "fa-chart-bar" },
        { id: "rlDetil", label: "RL Detil Bulanan", icon: "fa-bars-staggered" },
        { id: "rlLebar", label: "RL Rekap 1-12", icon: "fa-bars-staggered" },
        { id: "bukuBesar", label: "Buku Besar", icon: "fa-book" },
        { id: "expXls", label: "Export XLS", icon: "fa-file-excel" },
      ],
    },
    {
      group: "LAPORAN KEUANGAN GABUNGAN",
      icon: "fa-chart-pie",
      items: [
        { id: "neracas", label: "Neraca", icon: "fa-scale-balanced" },
        { id: "detilNeracas", label: "Detil Neraca", icon: "fa-table-list" },
        { id: "rlRekaps", label: "RL Rekap Bulanan", icon: "fa-chart-bar" },
        {
          id: "rlDetils",
          label: "RL Detil Bulanan",
          icon: "fa-bars-staggered",
        },
        { id: "rlLebars", label: "RL Rekap 1-12", icon: "fa-bars-staggered" },
        { id: "bukuBesars", label: "Buku Besar", icon: "fa-book" },
        { id: "expXlss", label: "Export XLS", icon: "fa-file-excel" },
      ],
    },
    {
      group: "UTILITY",
      icon: "fa-wrench",
      items: [
        { id: "dbInfo", label: "Database", icon: "fa-database" },
        {
          id: "importFoxpro",
          label: "Import FoxPro Online",
          icon: "fa-cloud-arrow-up",
        },
      ],
    },
    {
      group: "USER",
      icon: "fa-users",
      items: [
        { id: "userMgmt", label: "Manajemen User", icon: "fa-user-gear" },
      ],
    },
  ];

  let htmlMenu = "";

  // 3. PROSES STRUKTUR MENU BERDASARKAN HAK AKSES ROLE
  MENUS.forEach((grp) => {
    let itemsBolehTampil = [];

    if (userRole === "ADMIN") {
      // Admin bisa melihat semuanya tanpa terkecuali
      itemsBolehTampil = grp.items;
    } else if (userRole === "AKUNTING") {
      // Akunting: Boleh lihat Perkiraan, Mutasi, Laporan Kas, Laporan Keuangan, Posting
      // ⚠️ Grup UTILITY & USER di-hide total
      if (
        ![
          "UTILITY",
          "LAPORAN KEUANGAN",
          "LAPORAN KEUANGAN GABUNGAN",
          "USER",
        ].includes(grp.group)
      ) {
        itemsBolehTampil = grp.items;
      }
    } else if (userRole === "KASIR") {
      // Kasir: Hanya Saldo Kasir, Mutasi Harian Kasir, Kas Harian Kasir, Laporan Saldo Kasir
      itemsBolehTampil = grp.items.filter((item) =>
        ["saldoKasir", "mutasikasir", "kaskasir"].includes(item.id),
      );
    } else if (userRole === "VIEWER") {
      // Viewer: Hanya menu Laporan Keuangan Gabungan saja
      if (grp.group === "LAPORAN KEUANGAN GABUNGAN") {
        itemsBolehTampil = grp.items;
      }
    }

    // 4. JIKA GRUP MEMILIKI ITEM YANG BOLEH TAMPIL, GAMBAR KE HTML SIDEBAR
    if (itemsBolehTampil.length > 0) {
      htmlMenu += `
        <div class="sb-group-wrapper">
          <div class="sb-group-title">
            <i class="fa-solid ${grp.icon}"></i> <span>${grp.group}</span>
          </div>
          <ul class="sb-menu-list">
      `;

      itemsBolehTampil.forEach((item) => {
        htmlMenu += `
          <li class="sb-menu-item" onclick="navigate('${item.id}')" id="menu-${item.id}">
            <i class="fa-solid ${item.icon}"></i>
            <span>${item.label}</span>
          </li>
        `;
      });

      htmlMenu += `
          </ul>
        </div>
      `;
    }
  });

  sbBody.innerHTML = htmlMenu;
}

init();
