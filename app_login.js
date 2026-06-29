async function loginSystem() {
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, password: p }),
  });

  const data = await res.json();

  if (data.success) {
    // SIMPAN TOKEN KE LOCALSTORAGE
    localStorage.setItem("token", data.token);
    localStorage.setItem("nama", data.user.nama);
    localStorage.setItem("cabang", data.user.kode_cabang);

    alert("Login Berhasil! Cabang: " + data.user.kode_cabang);
    // Sembunyikan form login, tampilkan menu aplikasi...
  } else {
    alert("Gagal: " + data.message);
  }
}
async function loadTransaksi() {
  const token = localStorage.getItem("token"); // WAJIB AMBIL TOKEN

  if (!token) {
    alert("Anda belum login!");
    return;
  }

  const res = await fetch("/api/data/transaksi2024", {
    method: "GET",
    headers: {
      Authorization: "Bearer " + token, // <-- WAJIB KIRIM TOKEN SETIAP PANGGIL API
    },
  });

  const dataTransaksi = await res.json();

  console.log(dataTransaksi);
  // Data yang keluar di sini PASTI hanya yang cabang "00" milik TAMARIA
}
// Tambahkan ini di blok <script> paling bawah pada file HTML Anda
function doLogout() {
  // 1. Hapus semua data autentikasi dari localStorage
  localStorage.removeItem("token");
  localStorage.removeItem("nama");
  localStorage.removeItem("cabang");

  // Opsional: Jika menggunakan library Supabase Client secara langsung, panggil juga:
  // if (typeof supabase !== 'undefined') supabase.auth.signOut();

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
