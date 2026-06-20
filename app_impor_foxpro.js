const AppImporFoxpro = {
  API_URL: window.location.origin + "/api/impor-foxpro-online",
  selectedFiles: { cdg: null, cdd: null },

  getHTML() {
    let opsiCabang = `<option value="" disabled selected>-- Pilih Cabang --</option>`;
    if (
      typeof DBCache !== "undefined" &&
      DBCache.cabang &&
      DBCache.cabang.length > 0
    ) {
      DBCache.cabang.forEach((c) => {
        let kode = c.kode_cabang || c.kode || c.rest || "";
        let nama = c.nama_cabang || c.nama || "";
        if (kode) {
          opsiCabang += `<option value="${kode}">${kode} - ${nama}</option>`;
        }
      });
    } else {
      opsiCabang += `<option value="" disabled>Data cabang kosong / belum dimuat</option>`;
    }

    return `
      <div class="card" style="max-width: 700px; margin: 1rem auto; padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); max-height: 90vh; overflow-y: auto;">
        <h2 style="margin-bottom: 1.5rem; font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; color: #fff; display: flex; align-items: center; gap: 0.75rem; position: sticky; top: 0; background: rgba(20,20,30,0.95); padding: 1rem 0; z-index: 10;">
          <i class="fa-solid fa-folder-open" style="color: #3b82f6;"></i> Impor DBF FoxPro dari Folder
        </h2>

        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5;">
          Pilih 1 folder yang berisi file DBF. Sistem otomatis cari file <span style="color:#60a5fa">cdg*.dbf</span> dan <span style="color:#60a5fa">cdd*.dbf</span>. Masa 01-12 diproses otomatis.
        </p>

        <form id="formImporFoxpro">
          <!-- Tahun -->
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Tahun Periode</label>
            <input type="number" id="impPeriode" placeholder="2026" required min="2000" max="2099"
              style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'JetBrains Mono', monospace;">
            <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.25rem; display: block;">Akan diproses masa 01 sampai 12</small>
          </div>

          <!-- Cabang -->
          <div style="margin-bottom: 2rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Kode Cabang</label>
            <select id="impCabang" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'JetBrains Mono', monospace; cursor: pointer;">
              ${opsiCabang}
            </select>
          </div>

          <!-- Folder Picker -->
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Pilih Folder DBF</label>
            <div style="position: relative; border: 2px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 2rem; text-align: center; background: rgba(0,0,0,0.1); cursor: pointer;">
              <input type="file" id="folderInput" webkitdirectory directory multiple required
                style="position: absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
              <div id="labelFolder" style="color: #94a3b8; font-size: 0.9rem;">
                <i class="fa-solid fa-folder" style="font-size: 2.5rem; margin-bottom: 0.75rem; display:block; color: #fbbf24;"></i>
                Klik untuk pilih folder<br>
                <small style="font-size: 0.75rem;">Folder harus berisi cdg*.dbf dan cdd*.dbf</small>
              </div>
            </div>
          </div>

          <!-- Status File -->
          <div id="fileStatus" style="display: none; margin-bottom: 2rem; padding: 1rem; border-radius: 4px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);">
            <div style="color: #fff; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.75rem;">Status File:</div>
            <div id="statusCdg" style="color: #ef4444; font-size: 0.8rem; margin-bottom: 0.5rem;">
              <i class="fa-solid fa-xmark"></i> cdg*.dbf: Belum ditemukan
            </div>
            <div id="statusCdd" style="color: #ef4444; font-size: 0.8rem;">
              <i class="fa-solid fa-xmark"></i> cdd*.dbf: Belum ditemukan
            </div>
          </div>

          <div id="progressInfo" style="display: none; margin-bottom: 1.5rem; padding: 1rem; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 4px; color: #60a5fa; font-size: 0.85rem;">
            <i class="fa-solid fa-circle-info"></i> Siap proses 12 masa: 01-12
          </div>

          <button type="submit" id="btnSubmitImpor" disabled style="width: 100%; padding: 0.9rem; background: #3b82f6; border: none; border-radius: 4px; color: #fff; font-weight: 600; cursor: not-allowed; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 1rem; opacity: 0.5;">
            <i class="fa-solid fa-cloud-arrow-up"></i> Kirim & Proses Otomatis
          </button>
        </form>
      </div>
    `;
  },

  initEvents() {
    const form = document.getElementById("formImporFoxpro");
    const folderInput = document.getElementById("folderInput");
    const impPeriode = document.getElementById("impPeriode");

    folderInput.addEventListener("change", (e) => this.handleFolderSelect(e));

    if (impPeriode) {
      impPeriode.addEventListener("input", () => {
        document.getElementById("progressInfo").style.display =
          impPeriode.value.length === 4 ? "block" : "none";
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => this.handleFormSubmit(e));
    }
  },

  handleFolderSelect(event) {
    const files = Array.from(event.target.files);
    const labelFolder = document.getElementById("labelFolder");
    const fileStatus = document.getElementById("fileStatus");
    const statusCdg = document.getElementById("statusCdg");
    const statusCdd = document.getElementById("statusCdd");
    const btnSubmit = document.getElementById("btnSubmitImpor");

    this.selectedFiles = { cdg: null, cdd: null };

    // Cari file cdg*.dbf dan cdd*.dbf
    files.forEach((file) => {
      const name = file.name.toLowerCase();
      if (name.startsWith("cdg") && name.endsWith(".dbf")) {
        this.selectedFiles.cdg = file;
      }
      if (name.startsWith("cdd") && name.endsWith(".dbf")) {
        this.selectedFiles.cdd = file;
      }
    });

    fileStatus.style.display = "block";

    // Update status CDG
    if (this.selectedFiles.cdg) {
      statusCdg.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> cdg*.dbf: ${this.selectedFiles.cdg.name}`;
      statusCdg.style.color = "#10b981";
    } else {
      statusCdg.innerHTML = `<i class="fa-solid fa-xmark"></i> cdg*.dbf: Tidak ditemukan`;
      statusCdg.style.color = "#ef4444";
    }

    // Update status CDD
    if (this.selectedFiles.cdd) {
      statusCdd.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> cdd*.dbf: ${this.selectedFiles.cdd.name}`;
      statusCdd.style.color = "#10b981";
    } else {
      statusCdd.innerHTML = `<i class="fa-solid fa-xmark"></i> cdd*.dbf: Tidak ditemukan`;
      statusCdd.style.color = "#ef4444";
    }

    // Update label folder
    if (files.length > 0) {
      const folderName = files[0].webkitRelativePath.split("/")[0];
      labelFolder.innerHTML = `
        <i class="fa-solid fa-folder-check" style="font-size: 2.5rem; margin-bottom: 0.75rem; display:block; color: #10b981;"></i>
        <span style="color: #fff; font-weight: 500;">${folderName}</span><br>
        <small style="font-size: 0.75rem; color: #94a3b8;">${files.length} file terdeteksi</small>
      `;
    }

    // Enable button kalau kedua file ketemu
    if (this.selectedFiles.cdg && this.selectedFiles.cdd) {
      btnSubmit.disabled = false;
      btnSubmit.style.opacity = "1";
      btnSubmit.style.cursor = "pointer";
    } else {
      btnSubmit.disabled = true;
      btnSubmit.style.opacity = "0.5";
      btnSubmit.style.cursor = "not-allowed";
    }
  },

  async handleFormSubmit(event) {
    event.preventDefault();

    const btnSubmit = document.getElementById("btnSubmitImpor");
    const loadingOv = document.getElementById("loadingOv");
    const periode = document.getElementById("impPeriode").value.trim();
    const kodeCabang = document.getElementById("impCabang").value;

    if (periode.length !== 4) {
      alert("Tahun harus 4 digit");
      return;
    }

    if (!this.selectedFiles.cdg || !this.selectedFiles.cdd) {
      alert("Folder harus berisi file cdg*.dbf dan cdd*.dbf");
      return;
    }

    const formData = new FormData();
    formData.append("periode", periode);
    formData.append("kode_cabang", kodeCabang);
    formData.append("file_cdg", this.selectedFiles.cdg);
    formData.append("file_cdd", this.selectedFiles.cdd);
    formData.append("auto_masa", "true");

    try {
      if (loadingOv) {
        loadingOv.querySelector("span").innerHTML =
          `<span class="spinner"></span> Memproses 12 masa dari folder...`;
        loadingOv.classList.add("show");
      }

      btnSubmit.disabled = true;
      btnSubmit.style.opacity = "0.5";

      const response = await fetch(this.API_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(
          `Sukses! ${result.total_masa || 12} masa berhasil diproses dari folder.`,
        );
        if (typeof navigate === "function") {
          navigate("importFoxpro");
        }
      } else {
        throw new Error(
          result.message || result.error || "Gagal sinkronisasi.",
        );
      }
    } catch (err) {
      console.error("Proses terhenti:", err);
      alert("Gagal:\n" + err.message);
    } finally {
      if (loadingOv) loadingOv.classList.remove("show");
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = "1";
      }
    }
  },
};

if (typeof PANEL_MAP !== "undefined") {
  PANEL_MAP["importFoxpro"] = async function () {
    return AppImporFoxpro.getHTML();
  };
}
if (typeof AFTER_RENDER !== "undefined") {
  AFTER_RENDER["importFoxpro"] = function () {
    AppImporFoxpro.initEvents();
  };
}
