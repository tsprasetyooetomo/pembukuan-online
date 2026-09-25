// =================================================================
// KARYAWAN_TELAGA.JS (FINAL VERSION - 3 ROLES: USER, ADMIN, MANAJER)
// =================================================================

// ================================================== //
// --- GLOBAL VARIABLES ---
// ================================================== //
let tableKaryawan, tableGaji, tableMutasi, tableCabang, tableUser;
let tableLaporanKaryawan,
  tableLaporanGaji,
  tableLaporanMutasi,
  tableLaporanCabang;
let tableHitGaji, tableAbsen;

let currentUserRole = "";
let allKaryawanData = [];
let allCabangData = [];
let allGajiData = [];
let allAbsenData = [];
let allMutasiData = [];
let allUsers = [];

let employeesToImport = [];
let salariesToImport = [];
let absenToImport = [];

let videoWajah, overlayWajah, streamWajah;
let isModelLoaded = false;

// ✅ TAMBAHKAN INI: Variabel untuk menyimpan data yang sudah difilter (dipakai oleh Laporan)
let visibleKaryawanData = [];
let visibleGajiData = [];
let visibleMutasiData = [];
let visibleAbsenData = [];
// ================================================== //
// --- UTILITY FUNCTIONS ---
// ================================================== //
function generateId() {
  return "_" + Math.random().toString(36).substr(2, 9);
}

function formatRupiah(angka) {
  if (!angka) return "0";
  let num = Number(String(angka).replace(/\./g, ""));
  if (isNaN(num)) return "0";
  return num.toLocaleString("id-ID");
}

function sanitize(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ================================================== //
// --- API CLIENT ---
// ================================================== //
//const API_BASE_URL = "http://localhost:3000/api";
//const API_BASE_URL = window.location.origin + "/api";

// Otomatis mendeteksi apakah Anda membuka dari laptop (localhost) atau dari HP (menggunakan IP komputer)
const API_BASE_URL = `http://${window.location.hostname}:3000/api`;
class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    // === TAMBAHKAN CONSOLE DI SINI UTK TAU URL NYA ===
    console.log("=== API REQUEST URL ===");
    console.log("Endpoint yang diminta:", endpoint);
    console.log("URL Lengkap yang di-fetch:", url);
    // ===============================================

    const config = {
      headers: { "Content-Type": "application/json" },
      ...options,
    };
    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const text = await response.text();
        if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
          throw new Error(`Server Error. Status: ${response.status}`);
        }
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || `Error HTTP: ${response.status}`);
        } catch (e) {
          throw new Error(
            e.message || `Server merespons dengan status ${response.status}`,
          );
        }
      }
      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      console.error("API Request Failed:", endpoint, error);
      throw error;
    }
  }

  async getKaryawan() {
    return this.request("/karyawan");
  }
  async getKaryawanById(id) {
    return this.request(`/karyawan/${id}`);
  }
  async createKaryawan(data) {
    return this.request("/karyawan", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  async updateKaryawan(id, data) {
    return this.request(`/karyawan/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
  async deleteKaryawan(id) {
    return this.request(`/karyawan/${id}`, { method: "DELETE" });
  }

  async getGaji() {
    return this.request("/gaji");
  }
  async createGaji(data) {
    return this.request("/gaji", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  async updateGaji(id, data) {
    return this.request(`/gaji/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
  async deleteGaji(id) {
    return this.request(`/gaji/${id}`, { method: "DELETE" });
  }

  async getMutasi() {
    return this.request("/mutasi");
  }
  async createMutasi(data) {
    return this.request("/mutasi", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  async updateMutasi(id, data) {
    return this.request(`/mutasi/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
  async deleteMutasi(id) {
    return this.request(`/mutasi/${id}`, { method: "DELETE" });
  }

  async getCabang() {
    return this.request("/cabang");
  }
  async createCabang(data) {
    return this.request("/cabang", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  async updateCabang(id, data) {
    return this.request(`/cabang/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
  async deleteCabang(id) {
    return this.request(`/cabang/${id}`, { method: "DELETE" });
  }

  async getHitAbsen() {
    return this.request("/hitgaji");
  }
  async createHitAbsen(data) {
    return this.request("/hitgaji", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  async updateHitAbsen(id, data) {
    return this.request(`/hitgaji/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
  async deleteHitAbsen(id) {
    return this.request(`/hitgaji/${id}`, { method: "DELETE" });
  }
  async deleteAllHitGaji() {
    return this.request("/hitgaji", { method: "DELETE" });
  }

  async getUsers() {
    return this.request("/userkaryawan");
  }
  async createUser(data) {
    return this.request("/userkaryawan", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  async updateUser(id, data) {
    return this.request(`/userkaryawan/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }
  async deleteUser(id) {
    return this.request(`/userkaryawan/${id}`, { method: "DELETE" });
  }

  async login2(data) {
    return this.request("/login2", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}
const api = new ApiClient();

// ================================================== //
// --- ROLE RESTRICTIONS (3 LEVELS) ---
// ================================================== //
function applyRoleRestrictions() {
  // Definisi akses tab per role
  const tabAccess = {
    "#karyawan-tab": ["Admin", "Manajer"],
    "#gaji-tab": ["Manajer"],
    "#mutasi-tab": ["Manajer"],
    "#cabang-tab": ["Manajer"],
    "#laporan-tab": ["Admin", "Manajer"],
    "#hitgaji-tab": ["Manajer"],
    "#hitabsen-tab": ["User", "Admin", "Manajer"],
    "#user-tab": ["Manajer"],
    "#face-tab": ["User", "Admin", "Manajer"],
  };

  Object.keys(tabAccess).forEach((tabId) => {
    const $tab = $(tabId);
    if (tabAccess[tabId].includes(currentUserRole)) {
      $tab.parent().show();
    } else {
      $tab.parent().hide();
      $tab.removeClass("active");
      $($tab.attr("data-bs-target")).removeClass("show active");
    }
  });

  // Tentukan tab default yang aktif saat pertama kali masuk
  let defaultTab = "#hitabsen-tab";
  if (currentUserRole === "Admin" || currentUserRole === "Manajer")
    defaultTab = "#karyawan-tab";

  $(defaultTab).addClass("active");
  $($(defaultTab).attr("data-bs-target")).addClass("show active");

  // Tombol Hapus Memory (Hanya Manajer)
  $(".profile-info")
    .find('button[title="Hapus semua data dari memori"]')
    .toggle(currentUserRole === "Manajer");

  // Blokir tombol Hapus untuk User
  if (currentUserRole === "User") {
    $(document)
      .off("click", ".btn-danger")
      .on("click", ".btn-danger", function (e) {
        e.preventDefault();
        e.stopPropagation();
        alert("Akses ditolak. Hanya Admin/Manajer yang bisa menghapus data.");
      });
  } else {
    $(document).off("click", ".btn-danger");
  }
}

// ================================================== //
// --- LOGIN & LOGOUT ---
// ================================================== //
$(document).ready(async function () {
  if (localStorage.getItem("isLoggedIn") === "true") {
    currentUserRole = localStorage.getItem("userRole");
    $("#currentUser").text(
      `${localStorage.getItem("userName")} (${currentUserRole})`,
    );
    $("#loginScreen").hide();
    $("#mainApp").show();
    await initializeApp();
    switchToDefaultTab();
  }

  $("#loginForm").on("submit", async function (e) {
    e.preventDefault();
    const username = $("#username").val().trim();
    const password = $("#password").val();
    const role = $("#role").val();

    try {
      const res = await api.login2({ username, password, role });

      // === TAMBAHKAN CONSOLE DI SINI ===
      console.log("=== DATA LOGIN BERHASIL ===");
      console.log("Objek Respons Server (res):", res);
      console.log("Cabang yang terbuka (userCbg):", res.cbg);
      console.log("Role Pengguna:", role);
      console.log("Username:", username);
      // =================================
      currentUserRole = role;
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userRole", role);
      localStorage.setItem("userName", username);
      localStorage.setItem("userCbg", res.cbg || "");

      $("#currentUser").text(`${username} (${role})`);
      $("#loginScreen").hide();
      $("#mainApp").show();
      await initializeApp();
      switchToDefaultTab();
    } catch (error) {
      alert("Login Gagal: " + error.message);
    }
  });

  $("#btnTogglePassword").on("click", function () {
    const input = $("#password");
    const icon = $(this).find("i");
    if (input.attr("type") === "password") {
      input.attr("type", "text");
      icon.removeClass("fa-eye").addClass("fa-eye-slash");
    } else {
      input.attr("type", "password");
      icon.removeClass("fa-eye-slash").addClass("fa-eye");
    }
  });
});

function switchToDefaultTab() {
  let targetTab = "#hitabsen-tab";
  if (currentUserRole === "Admin" || currentUserRole === "Manajer")
    targetTab = "#karyawan-tab";
  $(targetTab).tab("show");
}

function logout() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
  localStorage.removeItem("userCbg");
  if (typeof toast === "function") {
    toast("Berhasil logout, mengalihkan ke Dashboard...", "ok");
  }

  setTimeout(() => {
    window.location.href = "index.html";
  }, 800);
}

// ================================================== //
// --- INITIALIZE APP ---
// ================================================== //
async function initializeApp() {
  applyRoleRestrictions();
  initializeDataTables();
  setupFormSubmits();
  setupEventListeners();
  setupHitGajiFormSubmit();
  setupUserFormAndTable();
  setupImportListeners();
  setupReportListeners();
  await loadDataToTables();
  await populateSelectOptions();
  applyRoleRestrictions();
}

// ================================================== //
// --- DATATABLES INITIALIZATION ---
// ================================================== //
function initializeDataTables() {
  const opts = {
    responsive: true,
    autoWidth: false,
    pageLength: 25,
    language: {
      search: "Cari:",
      lengthMenu: "Tampilkan _MENU_ data",
      info: "Menampilkan _START_ - _END_ dari _TOTAL_",
      emptyTable: "Belum ada data",
      zeroRecords: "Tidak ditemukan",
      paginate: {
        first: "Pertama",
        last: "Terakhir",
        next: ">>",
        previous: "<<",
      },
    },
  };

  tableKaryawan = $("#tableKaryawan").DataTable({
    ...opts,
    columnDefs: [{ targets: 0, className: "col-numerator" }],
  });
  tableGaji = $("#tableGaji").DataTable({
    ...opts,
    columnDefs: [{ targets: 0, className: "col-numerator" }],
  });
  tableMutasi = $("#tableMutasi").DataTable(opts);
  tableCabang = $("#tableCabang").DataTable({
    ...opts,
    columnDefs: [{ targets: 0, className: "col-numerator" }],
  });
  tableLaporanKaryawan = $("#tableLaporanKaryawan").DataTable({
    ...opts,
    columnDefs: [
      { targets: 0, width: "30px", className: "text-center" },
      { targets: 1, width: "60px", className: "text-center", orderable: false },
    ],
  });
  tableLaporanGaji = $("#tableLaporanGaji").DataTable({
    ...opts,
    columnDefs: [
      { targets: 0, width: "30px", className: "text-center" },
      { targets: [4, 5, 6, 7, 8, 9, 11], className: "text-end" },
    ],
  });
  tableLaporanMutasi = $("#tableLaporanMutasi").DataTable({
    ...opts,
    columnDefs: [{ targets: 0, width: "30px", className: "text-center" }],
  });
  tableLaporanCabang = $("#tableLaporanCabang").DataTable({
    ...opts,
    columnDefs: [{ targets: 0, className: "col-numerator" }],
  });
  tableHitGaji = $("#tableHitGaji").DataTable({
    ...opts,
    columnDefs: [
      { targets: [4, 5, 6, 7, 8, 9, 10, 11], className: "text-end" },
    ],
  });
  tableAbsen = $("#tableAbsen").DataTable({
    ...opts,
    columnDefs: [{ targets: 0, className: "col-numerator" }],
  });
  tableUser = $("#tableUser").DataTable(opts);
}

// ================================================== //
// --- DATA LOADING (DENGAN FILTER CABANG OTOMATIS) ---
// ================================================== //
async function loadDataToTables() {
  try {
    const results = await Promise.allSettled([
      api.getKaryawan(),
      api.getGaji(),
      api.getMutasi(),
      api.getCabang(),
      api.getHitAbsen(),
      api.getUsers(),
    ]);

    allKaryawanData = results[0].status === "fulfilled" ? results[0].value : [];
    allGajiData = results[1].status === "fulfilled" ? results[1].value : [];
    allMutasiData = results[2].status === "fulfilled" ? results[2].value : [];
    allCabangData = results[3].status === "fulfilled" ? results[3].value : [];
    allAbsenData = results[4].status === "fulfilled" ? results[4].value : [];
    allUsers = results[5].status === "fulfilled" ? results[5].value : [];

    // ================================================== //
    // LOGIKA FILTER DATA BERDASARKAN ROLE & CABANG
    // ================================================== //
    // ... bagian atas loadDataToTables ...

    // ================================================== //
    // LOGIKA FILTER DATA BERDASARKAN ROLE & CABANG
    // ================================================== //
    const userCbg = localStorage.getItem("userCbg");
    let visibleKaryawan = allKaryawanData;
    let visibleGaji = allGajiData;
    let visibleMutasi = allMutasiData;
    let visibleAbsen = allAbsenData;

    // Jika BUKAN Manajer, filter data berdasarkan cabang user
    if (currentUserRole !== "Manajer" && userCbg) {
      visibleKaryawan = allKaryawanData.filter(
        (k) => k.cabangPenempatan === userCbg,
      );
      const allowedNiks = new Set(visibleKaryawan.map((k) => k.nik));
      visibleGaji = allGajiData.filter((g) => allowedNiks.has(g.nik));
      visibleMutasi = allMutasiData.filter((m) => allowedNiks.has(m.nik));
      visibleAbsen = allAbsenData.filter((h) => allowedNiks.has(h.nik));
    }

    // Simpan untuk Tab Laporan (Lama)
    visibleKaryawanData = visibleKaryawan;
    visibleGajiData = visibleGaji;
    visibleMutasiData = visibleMutasi;
    visibleAbsenData = visibleAbsen;

    // ✅ UPDATE: Simpan juga untuk Tab Karyawan (Awal) - Biar bisa difilter manual
    visibleKaryawanDataawal = visibleKaryawan;
    // ================================================== //

    try {
      // --- RENDER TABLE KARYAWAN (TAB AWAL) ---
      // Kita mengosongkan tabel dulu, lalu nanti diisi ulang oleh fungsi filter baru atau render default
      tableKaryawan.clear();

      // Panggil fungsi render/filter baru untuk tab awal
      tampilkanLaporanKaryawanawal();
    } catch (e) {
      console.error("Render Karyawan Error:", e.message);
    }

    // ... sisa kode loadDataToTables (Gaji, Mutasi, dll) tetap sama ...

    try {
      populateGajiFilters();
      renderGajiTable(visibleGaji);
    } catch (e) {
      console.error("Render Gaji Error:", e.message);
    }

    try {
      tableMutasi
        .clear()
        .rows.add(
          visibleMutasi.map((m) => {
            const k = visibleKaryawan.find((x) => x.nik === m.nik);
            return [
              sanitize(m.nik),
              k ? sanitize(k.nama) : "N/A",
              sanitize(m.cabangAsal),
              sanitize(m.cabangPindah),
              sanitize(m.tanggalMutasi),
              `<button class="btn btn-sm btn-warning" onclick="editMutasi('${m.id}')"><i class="fas fa-edit"></i></button>
           <button class="btn btn-sm btn-danger" onclick="deleteMutasi('${m.id}')"><i class="fas fa-trash"></i></button>`,
            ];
          }),
        )
        .draw();
    } catch (e) {
      console.error("Render Mutasi Error:", e.message);
    }

    try {
      tableCabang
        .clear()
        .rows.add(
          allCabangData.map((c, i) => [
            // Cabang selalu tampil semua untuk Manajer
            i + 1,
            sanitize(c.namaCabang),
            sanitize(c.alamatCabang),
            sanitize(c.kodeCbg),
            `<button class="btn btn-sm btn-warning" onclick="editCabang('${c.id}')"><i class="fas fa-edit"></i></button>
         <button class="btn btn-sm btn-danger" onclick="deleteCabang('${c.id}')"><i class="fas fa-trash"></i></button>`,
          ]),
        )
        .draw();
    } catch (e) {
      console.error("Render Cabang Error:", e.message);
    }

    try {
      populateHitGajiFilters();
      renderHitGajiTable(visibleAbsen);
    } catch (e) {
      console.error("Render HitGaji Error:", e.message);
    }
    try {
      populateAbsenFilters();
      renderAbsenTable(visibleAbsen);
    } catch (e) {
      console.error("Render Absen Error:", e.message);
    }
    try {
      renderUserTable();
    } catch (e) {
      console.error("Render User Error:", e.message);
    }
  } catch (error) {
    console.error("Fatal Error loadDataToTables:", error);
    alert(
      "Gagal memuat data. Pastikan server berjalan.\nError: " + error.message,
    );
  }
}

// ================================================== //
// --- POPULATE SELECT OPTIONS ---
// ================================================== //
async function populateSelectOptions() {
  try {
    // ========================================== //
    // ✅ LOGIKA DROPDOWN CABANG BERDASARKAN ROLE
    // ========================================== //
    const userCbg = localStorage.getItem("userCbg");

    // Tentukan cabang mana yang boleh dilihat di dropdown
    let allowedCabangs = allCabangData; // Default: Semua cabang (untuk Manajer)

    if (currentUserRole !== "Manajer" && userCbg) {
      // Jika User/Admin, filter hanya cabang miliknya saja
      allowedCabangs = allCabangData.filter((cb) => cb.kodeCbg === userCbg);
    }

    // Daftar ID select yang wajib diisi cabang (Form Karyawan, Mutasi, Gaji, dll)
    const cabangSelects = [
      "#cabangPenempatan",
      "#cabangAsal",
      "#cabangPindah",
      "#cbgGaji",
      "#cbgHitGaji",
      "#userCbg",
      "#m_cabang",
    ];

    cabangSelects.forEach((sel) => {
      const $s = $(sel);
      $s.find("option:not(:first)").remove(); // Kosongkan dulu

      // Isi dropdown hanya dengan cabang yang diizinkan
      allowedCabangs.forEach((cb) => {
        $s.append(new Option(sanitize(cb.namaCabang), cb.kodeCbg));
      });

      // Jika User/Admin, langsung pilih otomatis & kunci (disable)
      if (currentUserRole !== "Manajer" && userCbg) {
        $s.val(userCbg).prop("disabled", true);
      } else {
        // Jika Manajer, pastikan dropdown terbuka
        $s.prop("disabled", false);
      }
    });

    // --- FILTER DI LAPORAN & TABEL ---
    const filterCabangSelects = [
      "#filterLapCabang",
      "#filterLapGajiCabang",
      "#filterLapCabangawal", // <--- Tambahan ini
    ];
    // const filterCabangSelects = ["#filterLapCabang", "#filterLapGajiCabang"];
    filterCabangSelects.forEach((sel) => {
      const $s = $(sel);
      $s.find("option:not(:first)").remove();
      allowedCabangs.forEach((cb) =>
        $s.append(new Option(sanitize(cb.namaCabang), cb.kodeCbg)),
      );
    });
    // --- FILTER DI LAPORAN & TABEL ---

    // ✅ UPDATE: Tambahkan ID filter baru ke dalam array ini

    filterCabangSelects.forEach((sel) => {
      const $s = $(sel);
      $s.find("option:not(:first)").remove();
      allowedCabangs.forEach((cb) =>
        $s.append(new Option(sanitize(cb.namaCabang), cb.kodeCbg)),
      );
    });

    // --- FILTER JABATAN ---

    // ✅ PERBAIKAN: Variabel $fj sudah ada di kode asli Anda, biarkan saja.
    const $fj = $("#filterLapJabatan");

    // ✅ TAMBAHKAN INI: Variabel baru untuk filter awal
    const $fjAwal = $("#filterLapJabatanawal");

    // Kosongkan option keduanya
    $fj.find("option:not(:first)").remove();
    $fjAwal.find("option:not(:first)").remove();

    // Isi option keduanya
    [...new Set(allKaryawanData.map((k) => k.jabatan).filter(Boolean))].forEach(
      (j) => {
        $fj.append(new Option(j, j));
        $fjAwal.append(new Option(j, j)); // <--- Isi filter awal juga
      },
    );
    // Jika User/Admin, sembunyikan filter bar (karena tidak ada pilihan lain)
    if (currentUserRole !== "Manajer") {
      $(".filter-bar").hide();
    } else {
      $(".filter-bar").show();
    }

    // --- FILTER JABATAN (Tetap tampil semua) ---
    // const $fj = $("#filterLapJabatan");
    $fj.find("option:not(:first)").remove();
    [...new Set(allKaryawanData.map((k) => k.jabatan).filter(Boolean))].forEach(
      (j) => $fj.append(new Option(j, j)),
    );

    // --- DROPDOWN KARYAWAN (NIK) ---
    function populateNik(targetId, data) {
      const $t = $(targetId);
      $t.find("option:not(:first)").remove();
      $t.prop("selectedIndex", 0);
      data.forEach((k) =>
        $t.append(new Option(`${k.nik} - ${k.nama} - ${k.status}`, k.nik)),
      );
    }

    const $mn = $("#mutasiNik");
    $mn.find("option:not(:first)").remove();
    // Untuk dropdown Mutasi, User/Admin hanya boleh pilih karyawan dari cabangnya sendiri
    let karyawanForMutasi = allKaryawanData;
    if (currentUserRole !== "Manajer" && userCbg) {
      karyawanForMutasi = allKaryawanData.filter(
        (k) => k.cabangPenempatan === userCbg,
      );
    }
    karyawanForMutasi.forEach((k) =>
      $mn.append(new Option(`${k.nik} - ${k.nama} - ${k.status}`, k.nik)),
    );

    // --- EVENT DROPDOWN CABANG UNTUK FILTER KARYAWAN DI FORM GAJI ---
    $("#cbgGaji")
      .off("change")
      .on("change", function () {
        const c = $(this).val();
        let dataFilter = allKaryawanData;
        if (c)
          dataFilter = allKaryawanData.filter((k) => k.cabangPenempatan === c);
        populateNik("#gajiNik", dataFilter);
        $("#statusGaji").val("");
        $("#gajiCabang").val("");
      });

    $("#cbgHitGaji")
      .off("change")
      .on("change", function () {
        const c = $(this).val();
        let dataFilter = allKaryawanData;
        if (c)
          dataFilter = allKaryawanData.filter((k) => k.cabangPenempatan === c);
        populateNik("#gajiHitNik", dataFilter);
        $("#hitstatus").val("");
        $("#hitcabang").val("");
      });

    // Trigger awal
    $("#cbgGaji").trigger("change");
    $("#cbgHitGaji").trigger("change");
  } catch (error) {
    console.error("Gagal mengisi dropdown:", error);
  }
}

// ================================================== //
// --- FORM SUBMITS ---
// ================================================== //
function setupFormSubmits() {
  $("#formKaryawan").on("submit", async function (e) {
    e.preventDefault();
    try {
      const id = $("#karyawanId").val();
      const data = {
        id: id || generateId(),
        nik: $("#nik").val().trim(),
        nama: $("#nama").val().trim(),
        nikname: $("#nikname").val().trim(),
        alamat: $("#alamat").val().trim(),
        status: $("#status").val(),
        lulusan: $("#lulusan").val(),
        jabatan: $("#jabatan").val().trim(),
        cabangPenempatan: $("#cabangPenempatan").val(),
        tanggalMasuk: $("#tanggalMasuk").val(),
        kis: $("#kis").val(),
        idkaryawan: $("#idkaryawan").val().trim(),
        fotoUrl: $("#imgPreview").data("url") || "",
      };
      if (!data.nik || !data.nama) return alert("NIK dan Nama wajib diisi!");
      if (id) await api.updateKaryawan(id, data);
      else await api.createKaryawan(data);
      resetKaryawanForm();
      await loadDataToTables();
      await populateSelectOptions();
      alert("Data Karyawan berhasil disimpan!");
    } catch (error) {
      alert("Gagal menyimpan data: " + error.message);
    }
  });

  $("#formGaji").on("submit", async function (e) {
    e.preventDefault();
    try {
      const id = $("#gajiId").val();
      const data = {
        id: id || generateId(),
        nik: $("#gajiNik").val(),
        gajiPokok: Number($("#gajiPokok").val()) || 0,
        tjabatan: Number($("#tjabatan").val()) || 0,
        tbeasiswa: Number($("#tbeasiswa").val()) || 0,
        tkontrakan: Number($("#tkontrakan").val()) || 0,
        tpph: Number($("#tpph").val()) || 0,
        bpjsKes: $("#bpjsKes").val(),
        bpjsTk: $("#bpjsTk").val(),
      };
      if (id) await api.updateGaji(id, data);
      else await api.createGaji(data);
      resetGajiForm();
      await loadDataToTables();
      alert("Data Gaji berhasil disimpan!");
    } catch (error) {
      alert("Gagal menyimpan data: " + error.message);
    }
  });

  $("#formMutasi").on("submit", async function (e) {
    e.preventDefault();
    try {
      const id = $("#mutasiId").val();
      const data = {
        id: id || generateId(),
        nik: $("#mutasiNik").val(),
        cabangAsal: $("#cabangAsal").val(),
        cabangPindah: $("#cabangPindah").val(),
        tanggalMutasi: $("#tanggalMutasi").val(),
        alasanMutasi: $("#alasanMutasi").val().trim(),
      };
      if (!data.nik || !data.cabangAsal || !data.cabangPindah)
        return alert("NIK, Cabang Asal, dan Tujuan wajib diisi!");
      if (id) await api.updateMutasi(id, data);
      else await api.createMutasi(data);
      resetMutasiForm();
      await loadDataToTables();
      alert("Data Mutasi berhasil disimpan!");
    } catch (error) {
      alert("Gagal menyimpan data: " + error.message);
    }
  });

  // Kompresi Foto Cabang
  $("#fotoInputCabang").on("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        const img = new Image();
        img.src = ev.target.result;
        img.onload = function () {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const maxW = 800;
          let w = img.width,
            h = img.height;
          if (w > maxW) {
            h = (maxW / w) * h;
            w = maxW;
          }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const comp = canvas.toDataURL("image/jpeg", 0.7);
          $("#imgPreviewCabang").attr("src", comp).data("url", comp);
        };
      };
      reader.readAsDataURL(file);
    }
  });

  $("#formCabang").on("submit", async function (e) {
    e.preventDefault();
    try {
      const id = $("#cabangId").val();
      const data = {
        id: id || generateId(),
        namaCabang: $("#namaCabang").val().trim(),
        alamatCabang: $("#alamatCabang").val().trim(),
        kodeCbg: $("#kodeCbg").val().trim(),
        fotoUrl: $("#imgPreviewCabang").data("url") || "",
      };
      if (!data.namaCabang || !data.kodeCbg)
        return alert("Nama & Kode Cabang wajib diisi!");
      if (id) await api.updateCabang(id, data);
      else await api.createCabang(data);
      resetCabangForm();
      await loadDataToTables();
      await populateSelectOptions();
      alert("Data Cabang berhasil disimpan!");
    } catch (error) {
      alert("Gagal menyimpan data: " + error.message);
    }
  });
}

// ================================================== //
// --- EVENT LISTENERS ---
// ================================================== //
function setupEventListeners() {
  $("#fotoInput").on("change", function (ev) {
    const file = ev.target.files[0];
    const $p = $("#imgPreview");
    if (file) {
      const r = new FileReader();
      r.onload = (e) =>
        $p.attr("src", e.target.result).data("url", e.target.result);
      r.readAsDataURL(file);
    } else {
      $p.attr(
        "src",
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=",
      ).removeData("url");
    }
  });

  $("#gajiNik").on("change", function () {
    const k = allKaryawanData.find((x) => x.nik === $(this).val());
    if (k) {
      $("#statusGaji").val(k.status);
      $("#gajiCabang").val(k.cabangPenempatan);
    } else {
      $("#statusGaji").val("");
      $("#gajiCabang").val("");
    }
  });

  $("#gajiHitNik").on("change", function () {
    const nik = $(this).val();
    const k = allKaryawanData.find((x) => x.nik === nik);
    const g = allGajiData.find((x) => x.nik === nik);
    if (k) {
      $("#hitstatus").val(k.status);
      $("#hitcabang").val(k.cabangPenempatan);
    } else {
      $("#hitstatus").val("");
      $("#hitcabang").val("");
    }
    if (g) {
      $("#hitgapok").val(g.gajiPokok);
      $("#hitjabatan").val(g.tjabatan);
      $("#hitbeasiswa").val(g.tbeasiswa);
      $("#hitkontrakan").val(g.tkontrakan);
    } else {
      $("#hitgapok, #hitjabatan, #hitbeasiswa, #hitkontrakan").val(0);
    }
  });

  $("#mutasiNik").on("change", function () {
    const k = allKaryawanData.find((x) => x.nik === $(this).val());
    if (k) {
      $("#mutasiNama").val(k.nama);
      $("#cabangAsal").val(k.cabangPenempatan);
    } else {
      $("#mutasiNama").val("");
      $("#cabangAsal").val("");
    }
  });

  $(document).on("click", ".img-zoom", function () {
    const s = $(this).data("src");
    if (s) {
      $("#modalImageSrc").attr("src", s);
      $("#photoModal").modal("show");
    }
  });
}

// ================================================== //
// --- HIT GAJI FORM ---
// ================================================== //
function setupHitGajiFormSubmit() {
  $("#hitformGaji").on("submit", async function (e) {
    e.preventDefault();
    try {
      const id = $("#hitgajiId").val();
      const data = {
        id: id || generateId(),
        nik: $("#gajiHitNik").val(),
        gajiPokok: Number($("#hitgapok").val()) || 0,
        tjabatan: Number($("#hitjabatan").val()) || 0,
        tbeasiswa: Number($("#hitbeasiswa").val()) || 0,
        tkontrakan: Number($("#hitkontrakan").val()) || 0,
        bonus: Number($("#hitbonus").val()) || 0,
        tabsen: Number($("#hitabsen").val()) || 0,
        tkasbon: Number($("#hitkasbon").val()) || 0,
        tmasa: $("#hitmasa").val().trim(),
        thari: Number($("#hithari").val()) || 0,
        tpph: 0,
        bpjsKes: "Tidak",
        bpjsTk: "Tidak",
      };
      if (!data.nik) return alert("Pilih karyawan terlebih dahulu!");
      if (id) await api.updateHitAbsen(id, data);
      else await api.createHitAbsen(data);
      resetHitGajiForm();
      await loadDataToTables();
      alert("Data perhitungan gaji berhasil disimpan!");
    } catch (error) {
      alert("Gagal menyimpan data: " + error.message);
    }
  });
}

// ================================================== //
// --- USER MANAGEMENT ---
// ================================================== //
function setupUserFormAndTable() {
  $("#formUser")
    .off("submit")
    .on("submit", async function (e) {
      e.preventDefault();
      try {
        const id = $("#userId").val();
        const data = {
          username: $("#userName").val().trim(),
          password: $("#userPassword").val(),
          role: $("#userRole").val(),
          cbg: $("#userCbg").val(),
        };
        if (!data.username || (!data.password && !id) || !data.role)
          return alert(
            "Username, Password (untuk baru), dan Role wajib diisi!",
          );
        if (id) await api.updateUser(id, data);
        else await api.createUser(data);
        resetUserForm();
        await loadDataToTables();
        alert("User berhasil disimpan!");
      } catch (error) {
        alert("Gagal: " + error.message);
      }
    });
}

function renderUserTable() {
  if (!tableUser) return;
  tableUser
    .clear()
    .rows.add(
      allUsers.map((u, i) => [
        i + 1,
        sanitize(u.username),
        "••••••••",
        sanitize(u.role),
        sanitize(u.cbg || "-"),
        `<button class="btn btn-sm btn-warning" onclick="editUser('${u.id}')"><i class="fas fa-edit"></i></button>
     <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>`,
      ]),
    )
    .draw();
}

async function editUser(id) {
  const u = allUsers.find((x) => x.id === id);
  if (u) {
    $("#userId").val(u.id);
    $("#userName").val(u.username);
    $("#userPassword").val("");
    $("#userRole").val(u.role);
    $("#userCbg").val(u.cbg || "");
  }
}
async function deleteUser(id) {
  if (confirm("Yakin hapus user ini?")) {
    try {
      await api.deleteUser(id);
      await loadDataToTables();
    } catch (e) {
      alert("Gagal: " + e.message);
    }
  }
}
function resetUserForm() {
  $("#formUser")[0].reset();
  $("#userId").val("");
}

// ================================================== //
// --- TABLE RENDERERS & FILTERS ---
// ================================================== //
function renderGajiTable(data) {
  tableGaji
    .clear()
    .rows.add(
      data.map((g, i) => {
        const gp = Number(g.gajiPokok) || 0;
        const tj = Number(g.tjabatan) || 0;
        const tot = gp + tj;
        const k = allKaryawanData.find((x) => x.nik === g.nik);
        return [
          i + 1,
          sanitize(g.nik),
          k ? sanitize(k.nama).toUpperCase() : "N/A",
          k ? sanitize(k.cabangPenempatan) : "-",
          formatRupiah(gp),
          formatRupiah(tj),
          formatRupiah(tot),
          `Kes: ${g.bpjsKes || "-"}, TK: ${g.bpjsTk || "-"}`,
          `<button class="btn btn-sm btn-warning" onclick="editGaji('${g.id}')"><i class="fas fa-edit"></i></button>
       <button class="btn btn-sm btn-danger" onclick="deleteGaji('${g.id}')"><i class="fas fa-trash"></i></button>`,
        ];
      }),
    )
    .draw();
}
function populateGajiFilters() {
  const $f = $("#filterGajiCabang");
  $f.find("option:not(:first)").remove();
  [
    ...new Set(allKaryawanData.map((k) => k.cabangPenempatan).filter(Boolean)),
  ].forEach((c) => $f.append(new Option(c, c)));
}
window.applyFilterGaji = function () {
  const c = $("#filterGajiCabang").val();
  renderGajiTable(
    !c
      ? allGajiData
      : allGajiData.filter((g) => {
          const k = allKaryawanData.find((x) => x.nik === g.nik);
          return k && k.cabangPenempatan === c;
        }),
  );
};

function populateHitGajiFilters() {
  const $c = $("#filterHitCabang");
  const $m = $("#filterHitMasa");
  $c.find("option:not(:first)").remove();
  $m.find("option:not(:first)").remove();
  allCabangData.forEach((cb) =>
    $c.append(new Option(cb.namaCabang, cb.kodeCbg)),
  );
  [...new Set(allAbsenData.map((h) => h.tmasa).filter(Boolean))]
    .sort()
    .forEach((m) => $m.append(new Option(m, m)));
}
window.applyFilterHitGaji = function () {
  let fd = allAbsenData;
  const c = $("#filterHitCabang").val(),
    m = $("#filterHitMasa").val();
  if (c)
    fd = fd.filter((h) => {
      const k = allKaryawanData.find((x) => x.nik === h.nik);
      return k && k.cabangPenempatan === c;
    });
  if (m) fd = fd.filter((h) => h.tmasa === m);
  renderHitGajiTable(fd);
};

function renderHitGajiTable(data) {
  tableHitGaji
    .clear()
    .rows.add(
      data.map((h, i) => {
        const k = allKaryawanData.find((x) => x.nik === h.nik);
        const tot =
          (Number(h.gajiPokok) || 0) +
          (Number(h.tjabatan) || 0) +
          (Number(h.tbeasiswa) || 0) +
          (Number(h.tkontrakan) || 0) +
          (Number(h.bonus) || 0) +
          (Number(h.tabsen) || 0) -
          (Number(h.tkasbon) || 0);
        return [
          i + 1,
          k ? sanitize(k.nama) : "N/A",
          k ? sanitize(k.cabangPenempatan) : "-",
          h.thari || 0,
          formatRupiah(h.gajiPokok),
          formatRupiah(h.tjabatan),
          formatRupiah(h.tkontrakan),
          formatRupiah(h.tbeasiswa),
          formatRupiah(h.bonus),
          formatRupiah(h.tabsen),
          formatRupiah(h.tkasbon),
          formatRupiah(tot),
          sanitize(h.tmasa || "-"),
          `<button class="btn btn-sm btn-warning" onclick="editHitGaji('${h.id}')"><i class="fas fa-edit"></i></button>
       <button class="btn btn-sm btn-danger" onclick="deleteHitGaji('${h.id}')"><i class="fas fa-trash"></i></button>`,
        ];
      }),
    )
    .draw();
}

function populateAbsenFilters() {
  const $c = $("#filterAbsen");
  const $m = $("#filterMasa");
  $c.find("option:not(:first)").remove();
  $m.find("option:not(:first)").remove();
  allCabangData.forEach((cb) =>
    $c.append(new Option(cb.namaCabang, cb.kodeCbg)),
  );
  [...new Set(allAbsenData.map((h) => h.tmasa).filter(Boolean))]
    .sort()
    .forEach((m) => $m.append(new Option(m, m)));
}
window.applyFilterAbsen = function () {
  let fd = allAbsenData;
  const c = $("#filterAbsen").val(),
    m = $("#filterMasa").val();
  if (c)
    fd = fd.filter((h) => {
      const k = allKaryawanData.find((x) => x.nik === h.nik);
      return k && k.cabangPenempatan === c;
    });
  if (m) fd = fd.filter((h) => h.tmasa === m);
  renderAbsenTable(fd);
};

function renderAbsenTable(data) {
  tableAbsen
    .clear()
    .rows.add(
      data.map((h, i) => {
        const k = allKaryawanData.find((x) => x.nik === h.nik);
        return [
          i + 1,
          k ? sanitize(k.nama) : "N/A",
          k ? sanitize(k.cabangPenempatan) : "-",
          h.thari || 0,
          sanitize(h.tmasa || "-"),
          `<button class="btn btn-sm btn-warning" onclick="editHitGaji('${h.id}')"><i class="fas fa-edit"></i></button>
       <button class="btn btn-sm btn-danger" onclick="deleteHitGaji('${h.id}')"><i class="fas fa-trash"></i></button>`,
        ];
      }),
    )
    .draw();
}

// ================================================== //
// --- EDIT & DELETE FUNCTIONS ---
// ================================================== //
async function editKaryawan(id) {
  try {
    const k = await api.getKaryawanById(id);
    if (k) {
      $("#karyawanId").val(k.id);
      $("#nik").val(k.nik);
      $("#nama").val(k.nama);
      $("#nikname").val(k.nikname);
      $("#alamat").val(k.alamat);
      $("#status").val(k.status);
      $("#lulusan").val(k.lulusan);
      $("#jabatan").val(k.jabatan);
      $("#cabangPenempatan").val(k.cabangPenempatan);
      $("#tanggalMasuk").val(k.tanggalMasuk);
      $("#kis").val(k.kis);
      $("#idkaryawan").val(k.idkaryawan || "");
      if (k.fotoUrl)
        $("#imgPreview").attr("src", k.fotoUrl).data("url", k.fotoUrl);
      else
        $("#imgPreview")
          .attr(
            "src",
            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=",
          )
          .removeData("url");
      $("#karyawan-tab").click();
      $("html, body").animate({ scrollTop: 0 }, "slow");
    }
  } catch (e) {
    alert("Gagal: " + e.message);
  }
}
async function deleteKaryawan(id) {
  if (confirm("Yakin hapus karyawan ini?")) {
    try {
      await api.deleteKaryawan(id);
      await loadDataToTables();
      await populateSelectOptions();
    } catch (e) {
      alert("Gagal: " + e.message);
    }
  }
}

async function editGaji(id) {
  try {
    const g = allGajiData.find((x) => x.id === id);
    if (g) {
      const k = allKaryawanData.find((x) => x.nik === g.nik);
      if (k) {
        $("#gajiCabang").val(k.cabangPenempatan);
        $("#statusGaji").val(k.status);
        $("#cbgGaji").val(k.cabangPenempatan);
      }
      $("#gajiId").val(g.id);
      $("#gajiNik").val(g.nik).trigger("change");
      $("#gajiPokok").val(g.gajiPokok);
      $("#tjabatan").val(g.tjabatan);
      $("#tbeasiswa").val(g.tbeasiswa);
      $("#tkontrakan").val(g.tkontrakan);
      $("#tpph").val(g.tpph);
      $("#bpjsKes").val(g.bpjsKes);
      $("#bpjsTk").val(g.bpjsTk);
      $("#gajiNik, #statusGaji, #gajiCabang, #cbgGaji").prop("disabled", true);
      $("#gaji-tab").click();
      $("html, body").animate({ scrollTop: 0 }, "slow");
    }
  } catch (e) {
    alert("Gagal: " + e.message);
  }
}
async function deleteGaji(id) {
  if (confirm("Yakin hapus gaji ini?")) {
    try {
      await api.deleteGaji(id);
      await loadDataToTables();
    } catch (e) {
      alert("Gagal: " + e.message);
    }
  }
}
window.tambahGaji = async function () {
  resetGajiForm();
  if (currentUserRole === "Manajer")
    $("#gajiNik, #statusGaji, #gajiCabang, #cbgGaji").prop("disabled", false);
  $("#cbgGaji").trigger("change");
  $("#gaji-tab").click();
  $("html, body").animate({ scrollTop: 0 }, "slow");
};

async function editMutasi(id) {
  try {
    const m = allMutasiData.find((x) => x.id === id);
    if (m) {
      $("#mutasiId").val(m.id);
      $("#mutasiNik").val(m.nik).trigger("change");
      $("#cabangPindah").val(m.cabangPindah);
      $("#tanggalMutasi").val(m.tanggalMutasi);
      $("#alasanMutasi").val(m.alasanMutasi);
      $("#mutasi-tab").click();
      $("html, body").animate({ scrollTop: 0 }, "slow");
    }
  } catch (e) {
    alert("Gagal: " + e.message);
  }
}
async function deleteMutasi(id) {
  if (confirm("Yakin hapus mutasi ini?")) {
    try {
      await api.deleteMutasi(id);
      await loadDataToTables();
    } catch (e) {
      alert("Gagal: " + e.message);
    }
  }
}

async function editCabang(id) {
  try {
    const c = allCabangData.find((x) => x.id === id);
    if (c) {
      $("#cabangId").val(c.id);
      $("#namaCabang").val(c.namaCabang);
      $("#alamatCabang").val(c.alamatCabang);
      $("#kodeCbg").val(c.kodeCbg);
      if (c.fotoUrl)
        $("#imgPreviewCabang").attr("src", c.fotoUrl).data("url", c.fotoUrl);
      else
        $("#imgPreviewCabang")
          .attr(
            "src",
            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=",
          )
          .removeData("url");
      $("#cabang-tab").click();
      $("html, body").animate({ scrollTop: 0 }, "slow");
    }
  } catch (e) {
    alert("Gagal: " + e.message);
  }
}
async function deleteCabang(id) {
  if (confirm("Yakin hapus cabang ini?")) {
    try {
      await api.deleteCabang(id);
      await loadDataToTables();
      await populateSelectOptions();
    } catch (e) {
      alert("Gagal: " + e.message);
    }
  }
}

async function editHitGaji(id) {
  try {
    const h = allAbsenData.find((x) => x.id === id);
    if (h) {
      const k = allKaryawanData.find((x) => x.nik === h.nik);
      const g = allGajiData.find((x) => x.nik === h.nik);
      if (k) {
        $("#hitcabang").val(k.cabangPenempatan);
        $("#hitstatus").val(k.status);
        $("#cbgHitGaji").val(k.cabangPenempatan);
      }
      if (g) {
        $("#hitgapok").val(g.gajiPokok);
        $("#hitjabatan").val(g.tjabatan);
        $("#hitbeasiswa").val(g.tbeasiswa);
        $("#hitkontrakan").val(g.tkontrakan);
      }
      $("#hitgajiId").val(h.id);
      $("#gajiHitNik").val(h.nik).trigger("change");
      $("#hithari").val(h.thari || 0);
      $("#hitbonus").val(h.bonus || 0);
      $("#hitabsen").val(h.tabsen || 0);
      $("#hitkasbon").val(h.tkasbon || 0);
      $("#hitmasa").val(h.tmasa || "");
      $("#gajiHitNik, #hitstatus, #hitcabang, #hitmasa").prop("disabled", true);
      $("#hitgaji-tab").click();
      $("html, body").animate({ scrollTop: 0 }, "slow");
    }
  } catch (e) {
    alert("Gagal: " + e.message);
  }
}
async function deleteHitGaji(id) {
  if (confirm("Yakin hapus hitungan gaji ini?")) {
    try {
      await api.deleteHitAbsen(id);
      await loadDataToTables();
    } catch (e) {
      alert("Gagal: " + e.message);
    }
  }
}

window.tambahHitGaji = function () {
  resetHitGajiForm();
  if (currentUserRole === "Manajer")
    $("#gajiHitNik, #hitstatus, #hitcabang, #cbgHitGaji").prop(
      "disabled",
      false,
    );
  $("#cbgHitGaji").trigger("change");
  $("#hitgaji-tab").click();
  $("html, body").animate({ scrollTop: 0 }, "slow");
};
window.deleteAllHitGaji = async function () {
  if (!confirm("Hapus SEMUA data hitungan gaji?")) return;
  try {
    await api.deleteAllHitGaji();
    allAbsenData = [];
    tableHitGaji.clear().draw();
    alert("Berhasil dihapus.");
  } catch (e) {
    alert("Gagal: " + e.message);
  }
};
window.deleteAllAbsen = async function () {
  if (!confirm("Hapus SEMUA data absen?")) return;
  try {
    await api.deleteAllHitGaji();
    allAbsenData = [];
    tableAbsen.clear().draw();
    alert("Berhasil dihapus.");
  } catch (e) {
    alert("Gagal: " + e.message);
  }
};

// ================================================== //
// --- RESET FORMS ---
// ================================================== //
const noImgSvg =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=";
function resetKaryawanForm() {
  $("#formKaryawan")[0].reset();
  $("#karyawanId").val("");
  $("#imgPreview").attr("src", noImgSvg).removeData("url");
  $("#fotoInput").val("");
}
function resetGajiForm() {
  $("#formGaji")[0].reset();
  $("#gajiId").val("");
  $("#gajiCabang").val("");
  $("#statusGaji").val("");
}
function resetMutasiForm() {
  $("#formMutasi")[0].reset();
  $("#mutasiId").val("");
  $("#mutasiNama").val("");
}
function resetCabangForm() {
  $("#formCabang")[0].reset();
  $("#cabangId").val("");
  $("#imgPreviewCabang").attr("src", noImgSvg).removeData("url");
  $("#fotoInputCabang").val("");
}
function resetHitGajiForm() {
  $("#hitformGaji")[0].reset();
  $("#hitgajiId").val("");
  $("#gajiHitNik, #hitstatus, #hitcabang, #cbgHitGaji, #hitmasa").prop(
    "disabled",
    false,
  );
  $("#hitgapok, #hitjabatan, #hitbeasiswa, #hitkontrakan").val(0);
}

// ================================================== //
// --- EXPORT, PRINT, CLEAR DATA ---
// ================================================== //
window.exportToExcel = function (id, name) {
  const t = document.getElementById(id);
  if (!t) return;
  XLSX.writeFile(
    XLSX.utils.table_to_book(t.cloneNode(true), { sheet: "Sheet1" }),
    name + ".xlsx",
  );
};
window.printReport = function (id) {
  const c = document.getElementById(id);
  if (!c) return;
  const w = window.open("", "", "h=700,w=900");
  w.document.write(
    "<html><head><style>body{font-family:Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:4px}th{background:#333;color:#fff;-webkit-print-color-adjust:exact}.btn{display:none}</style></head><body>" +
      c.innerHTML +
      "</body></html>",
  );
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 500);
};
window.clearDataInMemory = function () {
  if (!confirm("HAPUS SEMUA DATA DARI MEMORI?")) return;
  allKaryawanData = [];
  allCabangData = [];
  allGajiData = [];
  allAbsenData = [];
  allMutasiData = [];
  tableKaryawan.clear().draw();
  tableGaji.clear().draw();
  tableMutasi.clear().draw();
  tableCabang.clear().draw();
  tableHitGaji.clear().draw();
  tableAbsen.clear().draw();
  alert("Data di memori dikosongkan.");
};

// ================================================== //
// --- IMPORT EXCEL FUNCTIONS ---
// ================================================== //
function setupImportListeners() {
  $("#btnPreviewImport").on("click", handleFileRead);
  $("#btnConfirmImport").on("click", handleFinalImport);
  $("#btnCancelImport").on("click", cancelImport);
  $("#btnPreviewGajiImport").on("click", handleGajiFileRead);
  $("#btnConfirmGajiImport").on("click", handleFinalGajiImport);
  $("#btnCancelGajiImport").on("click", cancelGajiImport);
  $("#btnPreviewDataAbsen").on("click", handleAbsenFileRead);
  $("#btnConfirmDataAbsen").on("click", handleFinalAbsenImport);
  $("#btnCancelDataAbsen").on("click", cancelAbsenImport);
  $("#btnPreviewAbsen").on("click", handleAbsenRead);
  $("#btnConfirmAbsen").on("click", handleAbsenImport);
  $("#btnCancelAbsen").on("click", batalAbsenImport);
}
function setupReportListeners() {
  $('button[data-bs-toggle="pill"]').on("shown.bs.tab", function (e) {
    const t = $(e.target).attr("data-bs-target");
    if (t === "#pills-karyawan") tampilkanLaporanKaryawan();
    else if (t === "#pills-gaji") loadLaporanGaji();
    else if (t === "#pills-mutasi") loadLaporanMutasi();
    else if (t === "#pills-cabang") loadLaporanCabang();
  });
}

function readExcel(inputId) {
  return new Promise((res, rej) => {
    const f = $(`#${inputId}`)[0].files[0];
    if (!f) return rej("Pilih file");
    const r = new FileReader();
    r.onload = (e) =>
      res(
        XLSX.utils.sheet_to_json(
          XLSX.read(new Uint8Array(e.target.result), { type: "array" }).Sheets[
            XLSX.read(new Uint8Array(e.target.result), { type: "array" })
              .SheetNames[0]
          ],
        ),
      );
    r.onerror = rej;
    r.readAsArrayBuffer(f);
  });
}

async function handleFileRead() {
  try {
    const d = await readExcel("fileKaryawanInput");
    if (!d.length) return alert("Kosong");
    if (!("nik" in d[0]) || !("nama" in d[0]))
      return alert("Kolom wajib: nik, nama");
    const niks = new Set(allKaryawanData.map((k) => k.nik));
    const prev = d.map((e) => ({ ...e, isDup: niks.has(String(e.nik)) }));
    const $tb = $("#previewTable tbody").empty();
    prev.forEach((e) =>
      $tb.append(
        `<tr class="${e.isDup ? "table-secondary" : "table-success"}"><td>${sanitize(e.nik)}</td><td>${sanitize(e.nama)}</td><td>${sanitize(e.nikname || "-")}</td><td>${sanitize(e.alamat || "-")}</td><td>${sanitize(e.status || "-")}</td><td>${sanitize(e.cabang || "-")}</td><td>${sanitize(e.jabatan || "-")}</td><td>${sanitize(e.tanggalMasuk || "-")}</td><td>${sanitize(e.lulusan || "-")}</td><td><strong>${e.isDup ? "Duplikat" : "Baru"}</strong></td></tr>`,
      ),
    );
    employeesToImport = prev.filter((e) => !e.isDup);
    $("#previewContainer").show();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
async function handleFinalImport() {
  if (!employeesToImport.length) return alert("Tidak ada baru");
  const b = $("#btnConfirmImport").prop("disabled", true).text("Import...");
  try {
    for (const e of employeesToImport)
      await api.createKaryawan({
        id: generateId(),
        nik: String(e.nik),
        nama: e.nama,
        nikname: e.nikname || "",
        alamat: e.alamat || "",
        status: e.status || "TK/0",
        lulusan: e.lulusan || "SMA",
        jabatan: e.jabatan || "",
        cabangPenempatan: e.cabang || "",
        tanggalMasuk: e.tanggalMasuk || "",
        kis: "NONE",
        fotoUrl: "",
      });
    alert("Berhasil import");
    await loadDataToTables();
    await populateSelectOptions();
  } catch (e) {
    alert("Gagal: " + e.message);
  } finally {
    b.prop("disabled", false).text("Ya, Import Data");
    cancelImport();
  }
}
function cancelImport() {
  $("#previewContainer").hide();
  employeesToImport = [];
  $("#fileKaryawanInput").val("");
}

async function handleGajiFileRead() {
  try {
    const d = await readExcel("fileGajiInput");
    if (!d.length || !("nik" in d[0])) return alert("Kolom NIK wajib");
    const $tb = $("#previewGajiTable tbody").empty();
    const valid = d.filter((g) => {
      const k = allKaryawanData.find((x) => x.nik === String(g.nik));
      $tb.append(
        `<tr class="${k ? "table-success" : "table-danger"}"><td>${sanitize(g.nik)}</td><td>${k ? sanitize(k.nama) : "N/A"}</td><td>${g.gajiPokok || 0}</td><td>${g.tjabatan || 0}</td><td>${g.tbeasiswa || 0}</td><td>${g.tkontrakan || 0}</td><td>${g.tpph || 0}</td><td>${g.bpjsKes || "-"}</td><td>${g.bpjsTk || "-"}</td><td><strong>${k ? "Valid" : "Error"}</strong></td></tr>`,
      );
      return !!k;
    });
    salariesToImport = valid;
    $("#previewGajiContainer").show();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
async function handleFinalGajiImport() {
  if (!salariesToImport.length) return alert("Tidak valid");
  const b = $("#btnConfirmGajiImport").prop("disabled", true).text("Proses...");
  try {
    for (const g of salariesToImport) {
      const ex = allGajiData.find((x) => x.nik === String(g.nik));
      const p = {
        id: ex ? ex.id : generateId(),
        nik: String(g.nik),
        gajiPokok: Number(g.gajiPokok) || 0,
        tjabatan: Number(g.tjabatan) || 0,
        tbeasiswa: Number(g.tbeasiswa) || 0,
        tkontrakan: Number(g.tkontrakan) || 0,
        tpph: Number(g.tpph) || 0,
        bpjsKes: g.bpjsKes || "Tidak",
        bpjsTk: g.bpjsTk || "Tidak",
      };
      if (ex) await api.updateGaji(ex.id, p);
      else await api.createGaji(p);
    }
    alert("Berhasil");
    await loadDataToTables();
  } catch (e) {
    alert("Gagal: " + e.message);
  } finally {
    b.prop("disabled", false).text("Ya, Import Data");
    cancelGajiImport();
  }
}
function cancelGajiImport() {
  $("#previewGajiContainer").hide();
  salariesToImport = [];
  $("#fileGajiInput").val("");
}

async function handleAbsenFileRead() {
  try {
    const d = await readExcel("fileDataAbsen");
    if (!d.length || !("nik" in d[0])) return alert("Kolom NIK wajib");
    const $tb = $("#previewAbsenTable tbody").empty();
    const valid = d.filter((g) => {
      const k = allKaryawanData.find((x) => x.nik === String(g.nik));
      const gj = allGajiData.find((x) => x.nik === String(g.nik));
      const gp = gj ? Number(gj.gajiPokok) || 0 : 0,
        tj = gj ? Number(gj.tjabatan) || 0 : 0,
        tb = gj ? Number(gj.tbeasiswa) || 0 : 0,
        tk = gj ? Number(gj.tkontrakan) || 0 : 0;
      const th = Number(g.absen) || 0,
        ta = Math.round(gp / 30) * th,
        kas = Number(g.kasbon) || 0;
      const tot = gp + tj + tb + tk + ta - kas;
      $tb.append(
        `<tr class="${k ? "table-success" : "table-danger"}"><td>${sanitize(g.nik)}</td><td>${k ? sanitize(k.nama) : "N/A"}</td><td>${th}</td><td>${formatRupiah(gp)}</td><td>${formatRupiah(tj)}</td><td>${formatRupiah(tb)}</td><td>${formatRupiah(tk)}</td><td>${formatRupiah(ta)}</td><td>${formatRupiah(tot)}</td><td>${sanitize(g.masa || "-")}</td><td>${sanitize(k ? k.cabangPenempatan : "-")}</td></tr>`,
      );
      if (k)
        return {
          ...g,
          namaKaryawan: k.nama,
          gajiPokok: gp,
          tjabatan: tj,
          tbeasiswa: tb,
          tkontrakan: tk,
          tabsen: ta,
          thari: th,
          tkasbon: kas,
          tmasa: g.masa,
        };
      return false;
    });
    absenToImport = valid.filter(Boolean);
    $("#previewAbsenContainer").show();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
async function handleFinalAbsenImport() {
  if (!absenToImport.length) return alert("Tidak valid");
  const b = $("#btnConfirmDataAbsen").prop("disabled", true).text("Proses...");
  try {
    for (const g of absenToImport) {
      const ex = allAbsenData.find((x) => x.nik === String(g.nik));
      const p = {
        id: ex ? ex.id : generateId(),
        nik: String(g.nik),
        gajiPokok: g.gajiPokok,
        tjabatan: g.tjabatan,
        tbeasiswa: g.tbeasiswa,
        tkontrakan: g.tkontrakan,
        tkasbon: g.tkasbon,
        tabsen: g.tabsen,
        tmasa: g.tmasa,
        thari: g.thari,
        tpph: 0,
        bpjsKes: "Tidak",
        bpjsTk: "Tidak",
      };
      if (ex) await api.updateHitAbsen(ex.id, p);
      else await api.createHitAbsen(p);
    }
    alert("Berhasil");
    await loadDataToTables();
  } catch (e) {
    alert("Gagal: " + e.message);
  } finally {
    b.prop("disabled", false).text("Ya, Import Data");
    cancelAbsenImport();
  }
}
function cancelAbsenImport() {
  $("#previewAbsenContainer").hide();
  absenToImport = [];
  $("#fileDataAbsen").val("");
}

async function handleAbsenRead() {
  try {
    const d = await readExcel("absenToImport");
    if (!d.length || !("nik" in d[0])) return alert("Kolom NIK wajib");
    const $tb = $("#previewAbsenTable2 tbody").empty();
    const valid = d.filter((g) => {
      const k = allKaryawanData.find((x) => x.nik === String(g.nik));
      $tb.append(
        `<tr class="${k ? "table-success" : "table-danger"}"><td>${sanitize(g.nik)}</td><td>${k ? sanitize(k.nama) : "N/A"}</td><td>${Number(g.absen) || 0}</td><td>${sanitize(g.masa || "-")}</td><td>${k ? sanitize(k.cabangPenempatan) : "-"}</td></tr>`,
      );
      if (k)
        return {
          ...g,
          namaKaryawan: k.nama,
          thari: Number(g.absen) || 0,
          tmasa: g.masa || "",
          cbg: k.cabangPenempatan,
        };
      return false;
    });
    absenToImport = valid.filter(Boolean);
    $("#previewAbsenContainer2").show();
  } catch (e) {
    alert("Error: " + e.message);
  }
}
async function handleAbsenImport() {
  if (!absenToImport.length) return alert("Tidak valid");
  const b = $("#btnConfirmAbsen").prop("disabled", true).text("Proses...");
  try {
    for (const i of absenToImport) {
      const ex = allAbsenData.find(
        (x) => x.nik === String(i.nik) && x.tmasa === i.tmasa,
      );
      const p = {
        id: ex ? ex.id : generateId(),
        nik: String(i.nik),
        tmasa: i.tmasa,
        thari: i.thari,
      };
      if (ex) await api.updateHitAbsen(ex.id, p);
      else await api.createHitAbsen(p);
    }
    alert("Berhasil");
    await loadDataToTables();
  } catch (e) {
    alert("Gagal: " + e.message);
  } finally {
    b.prop("disabled", false).text("Ya, Kirim Data");
    batalAbsenImport();
  }
}
function batalAbsenImport() {
  $("#previewAbsenContainer2").hide();
  absenToImport = [];
  $("#absenToImport").val("");
}

// ================================================== //
// --- LAPORAN PLACEHOLDERS (Dipanggil dari HTML) ---
// ================================================== //
// ================================================== //
// --- LAPORAN RENDERERS (DIFILTER OTOMATIS) ---
// ================================================== //
window.tampilkanLaporanKaryawan = function () {
  let dataRender = visibleKaryawanData;
  const fJabatan = $("#filterLapJabatan").val();
  const fCabang = $("#filterLapCabang").val();

  if (fJabatan) dataRender = dataRender.filter((k) => k.jabatan === fJabatan);
  if (fCabang && currentUserRole === "Manajer")
    dataRender = dataRender.filter((k) => k.cabangPenempatan === fCabang);

  tableLaporanKaryawan
    .clear()
    .rows.add(
      dataRender.map((k, i) => [
        i + 1,
        `<img src="${k.fotoUrl || noImgSvg}" class="img-zoom" data-src="${k.fotoUrl || noImgSvg}" style="width:45px;height:55px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid #e0e0e0">`,
        sanitize(k.nik),
        sanitize(k.nama),
        sanitize(k.alamat),
        sanitize(k.jabatan),
        sanitize(k.cabangPenempatan),
        sanitize(k.status),
        sanitize(k.tanggalMasuk),
        sanitize(k.lulusan),
        sanitize(k.kis),
      ]),
    )
    .draw();
};

// ================================================== //
// --- FUNGSI FILTER TAB DATA KARYAWAN (AWAL) ---
// ================================================== //
window.tampilkanLaporanKaryawanawal = function () {
  // Ambil data yang sudah difilter berdasarkan Role
  let dataRender = visibleKaryawanDataawal;

  // Ambil nilai dari filter ID BARU
  const fJabatan = $("#filterLapJabatanawal").val();
  const fCabang = $("#filterLapCabangawal").val();

  // Logika Filter Manual
  if (fJabatan) {
    dataRender = dataRender.filter((k) => k.jabatan === fJabatan);
  }

  if (fCabang) {
    // Jika Manajer, filter sesuai pilihan dropdown
    // Jika User, biasanya dropdown sudah terkunci, tapi kita tetap filter untuk keamanan
    dataRender = dataRender.filter((k) => k.cabangPenempatan === fCabang);
  }

  // Render ke Table Karyawan (tableKaryawan)
  tableKaryawan
    .clear()
    .rows.add(
      dataRender.map((k, i) => [
        i + 1,
        sanitize(k.nik),
        sanitize(k.nama),
        sanitize(k.nikname),
        sanitize(k.alamat),
        sanitize(k.cabangPenempatan),
        sanitize(k.jabatan),
        sanitize(k.status),
        sanitize(k.kis),
        `<button class="btn btn-sm btn-warning" onclick="editKaryawan('${k.id}')"><i class="fas fa-edit"></i></button>
         <button class="btn btn-sm btn-danger" onclick="deleteKaryawan('${k.id}')"><i class="fas fa-trash"></i></button>`,
      ]),
    )
    .draw();
};

window.loadLaporanGaji = function () {
  let dataRender = visibleGajiData;
  const fCabang = $("#filterLapGajiCabang").val();

  if (fCabang && currentUserRole === "Manajer") {
    dataRender = dataRender.filter((g) => {
      const k = allKaryawanData.find((x) => x.nik === g.nik);
      return k && k.cabangPenempatan === fCabang;
    });
  }

  tableLaporanGaji
    .clear()
    .rows.add(
      dataRender.map((g, i) => {
        const k = allKaryawanData.find((x) => x.nik === g.nik);
        const gp = Number(g.gajiPokok) || 0,
          tj = Number(g.tjabatan) || 0,
          tb = Number(g.tbeasiswa) || 0,
          tk = Number(g.tkontrakan) || 0;
        const tot = gp + tj + tb + tk;
        return [
          i + 1,
          k ? sanitize(k.nama).toUpperCase() : "N/A",
          k ? sanitize(k.cabangPenempatan) : "-",
          formatRupiah(gp),
          formatRupiah(tj),
          formatRupiah(tb),
          formatRupiah(tk),
          0,
          0,
          0,
          0,
          formatRupiah(tot),
          "-",
        ];
      }),
    )
    .draw();
};

window.loadLaporanMutasi = function () {
  tableLaporanMutasi
    .clear()
    .rows.add(
      visibleMutasiData.map((m, i) => {
        const k = allKaryawanData.find((x) => x.nik === m.nik);
        return [
          i + 1,
          sanitize(m.nik),
          k ? sanitize(k.nama) : "N/A",
          sanitize(m.cabangAsal),
          sanitize(m.cabangPindah),
          sanitize(m.tanggalMutasi),
          sanitize(m.alasanMutasi || "-"),
        ];
      }),
    )
    .draw();
};

window.loadLaporanCabang = function () {
  // Manajer lihat semua cabang, Admin/User tetap lihat semua daftar cabang (untuk referensi dropdown)
  tableLaporanCabang
    .clear()
    .rows.add(
      allCabangData.map((c, i) => [
        i + 1,
        sanitize(c.namaCabang),
        sanitize(c.alamatCabang),
        sanitize(c.kodeCbg),
      ]),
    )
    .draw();
};

// ================================================== //
// --- FACE RECOGNITION ---
// ================================================== //
async function initFaceRecognition() {
  if (isModelLoaded) return;
  videoWajah = document.getElementById("videoWajah");
  const statusEl = document.getElementById("statusWajah");
  const btnAbsen = document.getElementById("btnAbsenWajah");
  const btnNew = document.getElementById("btnNewkaryawan");

  try {
    statusEl.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i> Memuat Model AI...';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]);
    isModelLoaded = true;
    streamWajah = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 320, facingMode: "user" },
    });
    videoWajah.srcObject = streamWajah;

    statusEl.className = "alert alert-success mt-3";
    statusEl.innerHTML =
      '<i class="fas fa-check-circle me-1"></i> Kamera Aktif. Model Siap.';
    btnAbsen.disabled = false;
    btnNew.disabled = false;

    btnAbsen.addEventListener("click", processAbsensiWajah);

    btnNew.addEventListener("click", async () => {
      statusEl.innerHTML =
        '<i class="fas fa-spinner fa-spin me-1"></i> Memproses Wajah...';
      const det = await faceapi
        .detectSingleFace(
          videoWajah,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.4,
          }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (det) {
        const c = document.createElement("canvas");
        c.width = videoWajah.videoWidth;
        c.height = videoWajah.videoHeight;
        const ctx = c.getContext("2d");
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoWajah, 0, 0);
        document.getElementById("m_tgl_masuk").value = new Date()
          .toISOString()
          .split("T")[0];
        document.getElementById("imgPreviewModal").src =
          c.toDataURL("image/jpeg");
        document.getElementById("faceDescriptorModal").value = JSON.stringify(
          Array.from(det.descriptor),
        );
        new bootstrap.Modal(
          document.getElementById("modalKaryawanBaru"),
        ).show();
        statusEl.innerHTML =
          '<i class="fas fa-check-circle me-1"></i> Kamera Aktif.';
      } else {
        alert("Wajah tidak terdeteksi.");
        statusEl.innerHTML =
          '<i class="fas fa-check-circle me-1"></i> Kamera Aktif.';
      }
    });

    document.getElementById("btnSimpanKaryawanModal").onclick =
      async function () {
        const nik = document.getElementById("m_nik").value.trim(),
          nama = document.getElementById("m_nama").value.trim();
        if (!nik || !nama) return alert("NIK dan Nama wajib diisi!");
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        try {
          const res = await api.request("/tambah-karyawan", {
            method: "POST",
            body: JSON.stringify({
              id: generateId(),
              nik,
              nama,
              nikname: document.getElementById("m_nikname").value.trim(),
              status: document.getElementById("m_status").value,
              lulusan: document.getElementById("m_lulusan").value,
              alamat: document.getElementById("m_alamat").value.trim(),
              jabatan: document.getElementById("m_jabatan").value.trim(),
              cabangPenempatan: document.getElementById("m_cabang").value,
              tanggalMasuk: document.getElementById("m_tgl_masuk").value,
              kis: "NONE",
              fotoUrl: document.getElementById("imgPreviewModal").src,
              idkaryawan: document.getElementById("m_idkaryawan").value.trim(),
              descriptor: document.getElementById("faceDescriptorModal").value,
            }),
          });
          if (res.success) {
            alert("Berhasil disimpan!");
            bootstrap.Modal.getInstance(
              document.getElementById("modalKaryawanBaru"),
            ).hide();
            await loadDataToTables();
            await populateSelectOptions();
          } else alert("Gagal: " + (res.error || ""));
        } catch (e) {
          alert("Error: " + e.message);
        } finally {
          this.disabled = false;
          this.innerHTML = '<i class="fas fa-save me-1"></i> Simpan Karyawan';
        }
      };
  } catch (e) {
    console.error("Face Init Error:", e);
    statusEl.className = "alert alert-danger mt-3";
    statusEl.innerHTML = `<i class="fas fa-times-circle me-1"></i> Gagal: ${e.message}`;
  }
}

async function processAbsensiWajah() {
  if (!isModelLoaded) return alert("Model belum siap!");
  const statusEl = document.getElementById("statusWajah");
  const btn = document.getElementById("btnAbsenWajah");
  btn.disabled = true;
  statusEl.className = "alert alert-info mt-3";
  statusEl.innerHTML =
    '<i class="fas fa-spinner fa-spin me-1"></i> Mendeteksi...';
  try {
    const det = await faceapi
      .detectSingleFace(
        videoWajah,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.4,
        }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!det) {
      statusEl.className = "alert alert-warning mt-3";
      statusEl.innerHTML =
        '<i class="fas fa-exclamation-triangle me-1"></i> Wajah tidak terdeteksi.';
      btn.disabled = false;
      return;
    }
    statusEl.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i> Mencocokkan...';
    const res = await api.request("/absen-wajah", {
      method: "POST",
      body: JSON.stringify({ descriptor: Array.from(det.descriptor) }),
    });
    if (res?.success) {
      statusEl.className = "alert alert-success mt-3";
      statusEl.innerHTML = `<i class="fas fa-check-circle me-1"></i> Absen Berhasil!<br><strong>Nama:</strong> ${res.nama}<br><strong>NIK:</strong> ${res.nik}<br><strong>Jam:</strong> ${res.waktu}`;
    } else {
      statusEl.className = "alert alert-danger mt-3";
      statusEl.innerHTML = `<i class="fas fa-times-circle me-1"></i> ${res?.message || "Tidak dikenali."}`;
    }
  } catch (e) {
    statusEl.className = "alert alert-danger mt-3";
    statusEl.innerHTML = `<i class="fas fa-times-circle me-1"></i> Error: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
}
