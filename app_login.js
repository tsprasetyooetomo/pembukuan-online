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

    const data = await res.json();

    if (data.success) {
      // 1. SIMPAN TOKEN KE LOCALSTORAGE
      localStorage.setItem("token", data.token);
      localStorage.setItem("nama", data.user.nama);
      localStorage.setItem("cabang", data.user.kode_cabang);

      if (typeof toast === "function") {
        toast("Login Berhasil! Cabang: " + data.user.kode_cabang, "ok");
      } else {
        alert("Login Berhasil! Cabang: " + data.user.kode_cabang);
      }

      // 2. HUBUNGKAN KE UI HTML: Sembunyikan box login & muat ulang aplikasi
      document.getElementById("loginBox").style.display = "none";

      if (typeof refreshApp === "function") {
        refreshApp();
      } else {
        window.location.reload();
      }
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
  // 1. Hapus semua data autentikasi dari localStorage
  localStorage.removeItem("token");
  localStorage.removeItem("nama");
  localStorage.removeItem("cabang");

  // 2. Berikan notifikasi jika fungsi toast tersedia
  if (typeof toast === "function") {
    toast("Berhasil logout, mengalihkan...", "ok");
  } else {
    alert("Logout Berhasil!");
  }

  // 3. Muat ulang halaman untuk mengembalikan ke tampilan login awal
  setTimeout(() => {
    window.location.reload();
  }, 500);
}
