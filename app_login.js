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
    // console.log("datauser :", data);
    // debugger;

    if (data.success) {
      // ✅ PERBAIKAN 3: Simpan ke localStorage cukup 1x di sini saja (tidak perlu duplikat)
      localStorage.setItem("token", data.token);
      localStorage.setItem("nama", data.user.nama);
      localStorage.setItem("cabang", data.user.kode_cabang);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("group", data.user.group);
      // localStorage.setItem("role", "ADMIN");

      if (typeof toast === "function") {
        toast("Login Berhasil! Cabang: " + data.user.kode_cabang, "ok");
      } else {
        alert("Login Berhasil! Cabang: " + data.user.kode_cabang);
      }

      // Sembunyikan login box
      document.getElementById("loginBox").style.display = "none";
      // ↓↓↓ TAMBAHKAN INI ↓↓↓
      if (data.user.role === "Viewer") {
        setTimeout(function () {
          window.location.href = "laporan.html";
        }, 500);
        return;
      }
      // ↑↑↑ SAMPAI SINI ↑↑↑
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

function doLogout() {
  // 1. Hapus semua data session dari localStorage
  localStorage.removeItem("token");
  localStorage.removeItem("nama");
  localStorage.removeItem("cabang");
  localStorage.removeItem("role");
  localStorage.removeItem("group");

  
  // 2. Tampilkan notifikasi toast (jika fungsi toast ada)
  if (typeof toast === "function") {
    toast("Berhasil logout, mengalihkan ke Dashboard...", "ok");
  }

  // 3. LANGSUNG ARAHKAN KE INDEX.HTML (DASHBOARD)
  // Kita tidak perlu sembunyikan sidebar atau reload lagi,
  // karena halaman akan langsung berpindah total.
  setTimeout(() => {
    window.location.href = "index.html";
  }, 800); // Diberi delay 0.8 detik agar toast "Berhasil logout"nya terlihat dulu
}
