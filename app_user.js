/* ================================================================
   app_user.js — MANAJEMEN USER
   ================================================================ */

PANEL_MAP.userMgmt = renderUser;

async function renderUser() {
  var data = DBCache.users;
  var ids = data.map(function (r) {
    return r.id;
  });
  bulkInit("users", ids);
  var rows = data.map(function (r) {
    var roleTag =
      r.role === "Admin"
        ? '<span class="tag tag-db">Admin</span>'
        : r.role === "Kasir"
          ? '<span class="tag tag-cr">Kasir</span>'
          : r.role === "Akunting"
            ? '<span class="tag tag-cr">Akunting</span>'
            : '<span class="tag tag-awal">Viewer</span>';
    return [
      r.username,
      r.nama,
      roleTag,
      r.cabang || "Pusat",
      data.length > 1
        ? crudActions(r.id, "users")
        : "<button class=\"btn btn-g btn-sm\" onclick=\"editRow('users','" +
          r.id +
          '\')"><i class="fa-solid fa-pen"></i></button>',
    ];
  });
  return (
    bulkBarHTML("users", "User") +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem">' +
    '<div style="font-size:.82rem;color:var(--muted)">' +
    data.length +
    " user</div>" +
    '<button class="btn btn-a" onclick="formUser()"><i class="fa-solid fa-user-plus"></i> Tambah User</button></div>' +
    wrapTable(
      buildTable(["Username", "Nama", "Role", "Cabang", "Aksi"], rows, {
        bulkStore: "users",
        bulkIds: ids,
        actions: function (r, i) {
          return crudActions(data[i].id, "users");
        },

        emptyMsg: "Belum ada user",
      }),
    )
  );
}

function formUser(editId) {
  var d = editId
    ? DBCache.users.find(function (r) {
        return r.id === editId;
      })
    : null;

  // Ambil data cabang lama, jika data baru default-nya adalah "Pusat"
  var selectedCabang = d ? d.cabang || "Pusat" : "Pusat";

  openModal(
    d ? "Edit User" : "Tambah User",
    '<div class="f-row"><div class="fg"><label>Username <span class="req">*</span></label>' +
      '<input id="f_uUser" value="' +
      (d ? esc(d.username) : "") +
      '"' +
      (d ? ' readonly style="opacity:.5"' : "") +
      "></div>" +
      '<div class="fg"><label>Nama Lengkap <span class="req">*</span></label><input id="f_uNama" value="' +
      (d ? esc(d.nama) : "") +
      '"></div></div>' +
      '<div class="f-row"><div class="fg"><label>Role</label><select id="f_uRole">' +
      "<option" +
      (d && d.role === "Admin" ? " selected" : "") +
      ">Admin</option>" +
      // 🛠️ PENAMBAHAN ROLE AKUNTING:
      "<option" +
      (d && d.role === "Akunting" ? " selected" : "") +
      ">Akunting</option>" +
      "<option" +
      (d && d.role === "Kasir" ? " selected" : "") +
      ">Kasir</option>" +
      "<option" +
      (d && d.role === "Manager" ? " selected" : "") +
      ">Manager</option>" +
      "<option" +
      (d && d.role === "Viewer" ? " selected" : "") +
      ">Viewer</option></select></div>" +
      // 🛠️ PERBAIKAN: Menggunakan getCabangOpts() agar dropdown otomatis dinamis
      '<div class="fg"><label>Cabang</label><select id="f_uCabang">' +
      getCabangOpts(selectedCabang) +
      "</select></div></div>" +
      '<div class="fg"><label>Password ' +
      (d ? "(kosongkan jika tidak diubah)" : '<span class="req">*</span>') +
      "</label>" +
      '<input type="password" id="f_uPass" placeholder="' +
      (d ? "tidak diubah" : "Password") +
      '"></div>' +
      (d
        ? '<div style="margin-top:.3rem;font-size:.68rem;color:var(--muted)">User dibuat: <span style="color:var(--fg)">' +
          esc(d.username) +
          "</span></div>"
        : ""),
    '<button class="btn btn-g" onclick="closeModal()">Batal</button><button class="btn btn-a" onclick="saveUser(\'' +
      (editId || "") +
      "')\">Simpan</button>",
  );
}

async function saveUser(editId) {
  var username = $("f_uUser").value.trim(),
    nama = $("f_uNama").value.trim(),
    role = $("f_uRole").value,
    cabang = $("f_uCabang").value.trim(),
    password = $("f_uPass").value;

  if (!username || !nama) {
    toast("Username dan Nama wajib", "err");
    return;
  }
  if (!editId && !password) {
    toast("Password wajib untuk user baru", "err");
    return;
  }

  if (editId) {
    var r = await db.get("users", editId);
    if (r) {
      Object.assign(r, { nama: nama, role: role, cabang: cabang });
      if (password) r.password = password;
      await db.put("users", r);
    }
  } else {
    /* Cek duplikat username */
    var dup = DBCache.users.find(function (u) {
      return u.username === username;
    });
    if (dup) {
      toast('Username "' + username + '" sudah digunakan', "err");
      return;
    }
    await db.add("users", {
      id: uid(),
      username: username,
      nama: nama,
      role: role,
      cabang: cabang,
      password: password,
    });
  }
  closeModal();
  toast(editId ? "User diperbarui" : "User ditambahkan", "ok");
  await refreshCache();
  navigate(currentPanel);
}
