const AppImporFoxpro = {
  API_URL: window.location.origin + "/api/impor-foxpro-online",
  files: { cdg: null, cdd: null },

  getHTML() {
    let opsiCabang = `<option value="" disabled selected>-- Pilih Cabang --</option>`;
    if (typeof DBCache !== "undefined" && DBCache.cabang?.length > 0) {
      DBCache.cabang.forEach((c) => {
        let kode = c.kode_cabang || c.kode || c.rest || "";
        let nama = c.nama_cabang || c.nama || "";
        if (kode)
          opsiCabang += `<option value="${kode}">${kode} - ${nama}</option>`;
      });
    }

    let opsiTahun = `<option value="" disabled selected>-- Pilih Tahun --</option>`;
    for (let y = 2020; y <= 2030; y++) {
      opsiTahun += `<option value="${y}">${y}</option>`;
    }

    return `
      <div style="max-width: 700px; margin: 1rem auto; padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); max-height: 90vh; overflow-y: auto;">
        <h2 style="margin-bottom: 1rem; font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; color: #fff; display: flex; align-items: center; gap: 0.75rem; position: sticky; top: 0; background: rgba(20,20,30,0.95); padding: 1rem 0; z-index: 10;">
          <i class="fa-solid fa-folder-open" style="color: #3b82f6;"></i> Impor DBF 1 Tahun
        </h2>

        <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 2rem;">
          Format file: <b style="color:#60a5fa">CDG/KDD + KODE + BULAN + TAHUN.dbf</b><br>
          Contoh: <b style="color:#10b981">CDG000126.dbf</b> = Cabang 00, Bulan 01, Tahun 2026
        </p>

        <form id="formImporFoxpro">
          <div style="margin-bottom: 2rem;">
            <label style="display: block; color: #151414; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Kode Cabang</label>
            <select id="impCabang" required style="width: 100%; padding: 0.75rem; background: #000; border: 1px solid #333; border-radius: 4px; color: #ffffff; font-family: 'JetBrains Mono', monospace; cursor: pointer;">
              ${opsiCabang}
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #151414; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Tahun</label>
            <select id="impTahun" required style="width: 100%; padding: 0.75rem; background: #000; border: 1px solid #333; border-radius: 4px; color: #ffffff; font-family: 'JetBrains Mono', monospace; cursor: pointer;">
              ${opsiTahun}
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem;">Pilih Folder</label>
            <div style="position: relative; border: 2px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 2rem; text-align: center; background: rgba(0,0,0,0.1);">
              <input type="file" id="folderInput" webkitdirectory directory multiple required style="position: absolute; inset: 0; opacity: 0; cursor: pointer;">
              <div id="labelFolder" style="color: #94a3b8;">
                <i class="fa-solid fa-folder" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; color: #fbbf24;"></i>
                Klik untuk pilih folder
              </div>
            </div>
          </div>

          <div id="statusBox" style="display: none; margin-bottom: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.8rem;">
            <div id="statusCdg" style="margin-bottom: 0.5rem; color: #ef4444;"></div>
            <div id="statusCdd" style="color: #ef4444;"></div>
            <div id="infoMasa" style="margin-top: 0.75rem; color: #60a5fa; display: none;"></div>
          </div>

          <button type="submit" id="btnSubmit" disabled style="width: 100%; padding: 0.9rem; background: #3b82f6; border: none; border-radius: 4px; color: #fff; font-weight: 600; opacity: 0.5; cursor: not-allowed;">
            <i class="fa-solid fa-cloud-arrow-up"></i> Proses & Upload
          </button>
        </form>
      </div>
    `;
  },

  initEvents() {
    document
      .getElementById("folderInput")
      .addEventListener("change", (e) => this.scanFolder(e));
    document
      .getElementById("impCabang")
      .addEventListener("change", () => this.validate());
    document
      .getElementById("impTahun")
      .addEventListener("change", () => this.validate());
    document
      .getElementById("formImporFoxpro")
      .addEventListener("submit", (e) => this.submit(e));
  },

  parseName(fileName) {
    const n = fileName.toUpperCase().replace(".DBF", "");
    const m = n.match(/^(CDG|CDD)(\d{2})(\d{2})(\d{2})$/);
    if (!m) return null;
    return {
      type: m[1],
      kode: m[2],
      bulan: m[3],
      tahun2digit: m[4],
    };
  },

  scanFolder(e) {
    const files = Array.from(e.target.files);
    this.files = { cdg: null, cdd: null };

    files.forEach((f) => {
      const p = this.parseName(f.name);
      if (!p) return;
      if (p.type === "CDG" && !this.files.cdg)
        this.files.cdg = { file: f, info: p };
      if (p.type === "CDD" && !this.files.cdd)
        this.files.cdd = { file: f, info: p };
    });

    document.getElementById("statusBox").style.display = "block";
    document.getElementById("labelFolder").innerHTML = `
      <i class="fa-solid fa-folder-check" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; color: #10b981;"></i>
      ${files[0]?.webkitRelativePath.split("/")[0] || "Folder"}<br>
      <small>${files.length} file</small>
    `;

    this.validate();
  },

  validate() {
    const kode = document.getElementById("impCabang").value;
    const tahun4 = document.getElementById("impTahun").value;
    const tahun2 = tahun4.slice(-2);

    const boxCdg = document.getElementById("statusCdg");
    const boxCdd = document.getElementById("statusCdd");
    const infoMasa = document.getElementById("infoMasa");
    const btn = document.getElementById("btnSubmit");

    // Cari file yang cocok
    this.files.cdg = null;
    this.files.cdd = null;

    const inputFiles = document.getElementById("folderInput").files;
    if (inputFiles) {
      Array.from(inputFiles).forEach((f) => {
        const p = this.parseName(f.name);
        if (!p) return;
        if (p.type === "CDG" && p.kode === kode && p.tahun2digit === tahun2) {
          this.files.cdg = { file: f, info: p };
        }
        if (p.type === "CDD" && p.kode === kode && p.tahun2digit === tahun2) {
          this.files.cdd = { file: f, info: p };
        }
      });
    }

    let ok = true;

    if (this.files.cdg) {
      boxCdg.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981"></i> ${this.files.cdg.file.name} → Cabang ${this.files.cdg.info.kode}, Bulan ${this.files.cdg.info.bulan}, Tahun 20${this.files.cdg.info.tahun2digit}`;
      ok = true;
    } else {
      boxCdg.innerHTML = `<i class="fa-solid fa-xmark"></i> CDG${kode}**${tahun2}.dbf tidak ditemukan`;
      ok = false;
    }

    if (this.files.cdd) {
      boxCdd.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981"></i> ${this.files.cdd.file.name} → Cabang ${this.files.cdd.info.kode}, Bulan ${this.files.cdd.info.bulan}, Tahun 20${this.files.cdd.info.tahun2digit}`;
      ok = ok && true;
    } else {
      boxCdd.innerHTML = `<i class="fa-solid fa-xmark"></i> CDD${kode}**${tahun2}.dbf tidak ditemukan`;
      ok = false;
    }

    if (this.files.cdg || this.files.cdd) {
      const info = this.files.cdg?.info || this.files.cdd?.info;
      infoMasa.style.display = "block";
      infoMasa.innerHTML = `<i class="fa-solid fa-info-circle"></i> Filter: Cabang ${kode} | Tahun ${tahun4} | File dicari: **${tahun2}.dbf`;
    }

    btn.disabled = !ok;
    btn.style.opacity = ok ? "1" : "0.5";
    btn.style.cursor = ok ? "pointer" : "not-allowed";
  },

  async submit(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmit");
    const loading = document.getElementById("loadingOv");
    const kode = document.getElementById("impCabang").value;
    const tahun4 = document.getElementById("impTahun").value;
    const info = this.files.cdg.info;

    const fd = new FormData();
    fd.append("kode_cabang", kode);
    fd.append("tahun", tahun4);
    fd.append("bulan", info.bulan);
    fd.append("masa", info.bulan + info.tahun2digit);
    fd.append("file_cdg", this.files.cdg.file);
    fd.append("file_cdd", this.files.cdd.file);

    try {
      loading?.classList.add("show");
      btn.disabled = true;

      const res = await fetch(this.API_URL, { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(`Sukses! Masa ${info.bulan}/${tahun4} cabang ${kode} terupload`);
        navigate?.("importFoxpro");
      } else {
        throw new Error(data.message || "Gagal upload");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      loading?.classList.remove("show");
      btn.disabled = false;
    }
  },
};

if (typeof PANEL_MAP !== "undefined")
  PANEL_MAP["importFoxpro"] = () => AppImporFoxpro.getHTML();
if (typeof AFTER_RENDER !== "undefined")
  AFTER_RENDER["importFoxpro"] = () => AppImporFoxpro.initEvents();
