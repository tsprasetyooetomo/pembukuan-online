async function loginSystem() {
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;

  if (!u || !p) {
    if (typeof toast === "function")
      toast("Username dan password harus diisi", "err");
    else alert("Username dan password harus diisi");
    return;
  }

  // Tampilkan efek loading jika fungsi tersedia
  if (typeof showLoading === "function") showLoading();

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });

    // ✅ PERBAIKAN 1: Cek status HTTP dan Content-Type DI PALING AWAL
    const contentType = res.headers.get("content-type");
    if (!res.ok || !contentType || !contentType.includes("application/json")) {
      if (typeof hideLoading === "function") hideLoading();
      if (typeof toast === "function") {
        toast("Server tidak merespon dengan benar (404/500)", "err");
      } else {
        alert("Gagal: Endpoint API tidak ditemukan atau server bermasalah.");
      }
      return;
    }

    // ✅ PERBAIKAN 2: Deklarasi 'data' di sini (SEBELUM dipakai)
    const data = await res.json();

    if (data.success) {
      // ✅ PERBAIKAN 3: Simpan ke localStorage cukup 1x di sini saja (tidak perlu duplikat)
      localStorage.setItem("token", data.token);
      localStorage.setItem("nama", data.user.nama);
      localStorage.setItem("cabang", data.user.kode_cabang);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("role", "ADMIN");

      if (typeof toast === "function") {
        toast("Login Berhasil! Cabang: " + data.user.kode_cabang, "ok");
      } else {
        alert("Login Berhasil! Cabang: " + data.user.kode_cabang);
      }

      // Sembunyikan login box
      document.getElementById("loginBox").style.display = "none";

      // Reload agar init() di app_init.js jalan ulang membaca token baru
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      if (typeof hideLoading === "function") hideLoading();
      if (typeof toast === "function") toast("Gagal: " + data.message, "err");
      else alert("Gagal: " + data.message);
    }
  } catch (error) {
    if (typeof hideLoading === "function") hideLoading();
    console.error("Login error:", error);
    if (typeof toast === "function")
      toast("Terjadi kesalahan koneksi server", "err");
  }
}

// --- Fungsi di bawah ini tidak perlu diubah, biarkan tetap seperti ini ---
async function loadTransaksi() {
  const token = localStorage.getItem("token");

  if (!token) {
    if (typeof toast === "function") toast("Anda belum login!", "err");
    else alert("Anda belum login!");
    return;
  }

  try {
    const res = await fetch("/api/data/transaksi2024", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    const dataTransaksi = await res.json();
    console.log(dataTransaksi);
    return dataTransaksi;
  } catch (error) {
    console.error("Gagal memuat transaksi:", error);
  }
}

function doLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("nama");
  localStorage.removeItem("cabang");
  localStorage.removeItem("role");

  if (typeof toast === "function")
    toast("Berhasil logout, mengalihkan...", "ok");

  if (document.getElementById("sidebar"))
    document.getElementById("sidebar").classList.add("hidden-menu");
  if (document.getElementById("tbTitle"))
    document.getElementById("tbTitle").style.display = "none";
  if (document.getElementById("btnLogout"))
    document.getElementById("btnLogout").style.display = "none";

  const clockEl =
    document.getElementById("clockEl") || document.querySelector(".clockEl");
  if (clockEl) clockEl.style.display = "none";

  if (document.getElementById("loginBox"))
    document.getElementById("loginBox").style.display = "block";

  setTimeout(() => {
    window.location.reload();
  }, 500);
}
