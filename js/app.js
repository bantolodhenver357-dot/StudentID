
/* School ID Maker - Main Application */

const $ = id => document.getElementById(id);

const toast = message => {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(
    () => element.classList.remove("show"),
    2600
  );
};

function showView(name) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active");
  });

  $(name + "View").classList.add("active");

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  $("pageTitle").textContent =
    name === "designer"
      ? "ID Designer"
      : name === "templates"
        ? "ID Templates"
        : "Student Records";

  $("sidebar").classList.remove("open");

  if (name === "templates") {
    renderTemplates();
  }
}

/* NAVIGATION */

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

$("mobileMenu").onclick = () => {
  $("sidebar").classList.toggle("open");
};

$("newStudentBtn").onclick = () => {
  showView("designer");
  $("studentForm").reset();
  $("photoUpload").value = "";
  $("signatureUpload").value = "";
  $("photoTools").classList.add("hidden");
  syncStudentDetails();

  toast("Ready for a new student ID.");
};

/* FRONT / BACK */

document.querySelectorAll(".segment").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".segment").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    IDCardEditor.setSide(button.dataset.side);
    refreshProperties();
  };
});

/* STUDENT INFORMATION */

function syncStudentDetails() {
  const value = id => $(id).value.trim();

  IDCardEditor.applyInfo({
    name: value("studentName"),
    course: value("course"),
    number: value("studentNumber"),
    year: value("schoolYear"),
    birthdate: value("birthdate"),
    contact: value("contact"),
    address: value("address"),
    emergency: value("emergency")
  });
}

[
  "studentName",
  "course",
  "studentNumber",
  "schoolYear",
  "birthdate",
  "contact",
  "address",
  "emergency"
].forEach(id => {
  $(id).addEventListener("input", syncStudentDetails);
});

$("applyInfoBtn").onclick = () => {
  syncStudentDetails();
  toast("Student details applied to the ID.");
};

$("clearFormBtn").onclick = () => {
  setTimeout(() => {
    syncStudentDetails();
    toast("Form cleared.");
  }, 0);
};

/* STUDENT PHOTO */

$("photoUpload").onchange = async event => {
  const file = event.target.files[0];

  if (!file) return;

  try {
    await IDCardEditor.addPhoto(file);

    $("photoTools").classList.remove("hidden");
    $("photoZoom").value = 1;

    toast("Photo added. Drag it on the card to position.");
  } catch (error) {
    console.error(error);
    toast("Unable to load the photo.");
  }
};

$("photoZoom").oninput = event => {
  IDCardEditor.setPhotoZoom(event.target.value);
};

$("rotatePhotoBtn").onclick = () => {
  IDCardEditor.rotatePhoto();
};

$("resetPhotoBtn").onclick = () => {
  IDCardEditor.resetPhoto();
  $("photoZoom").value = 1;
};

/* SIGNATURE */

$("signatureUpload").onchange = event => {
  const file = event.target.files[0];

  if (file) {
    IDCardEditor.addSignature(file);
    toast("Signature added.");
  }
};

/* ADD LAYERS */

$("addTextBtn").onclick = () => {
  IDCardEditor.addText();
  refreshProperties();
};

$("addPhotoFrameBtn").onclick = () => {
  IDCardEditor.addPhotoFrame();
  refreshProperties();
};

/* LAYER LIST */

function refreshLayers() {
  const list = $("layerList");
  list.innerHTML = "";

  const layers = IDCardEditor.state.layers[
    IDCardEditor.state.side
  ];

  layers.forEach(layer => {
    const row = document.createElement("div");

    row.className =
      "layer-row" +
      (IDCardEditor.state.selectedId === layer.id
        ? " selected"
        : "");

    row.dataset.layerId = layer.id;

    const pick = document.createElement("button");
    pick.className = "layer-pick";

    pick.textContent =
      (layer.type === "text"
        ? "T"
        : layer.type === "photo"
          ? "▣"
          : "✎") +
      "  " +
      layer.name;

    pick.onclick = () => {
      IDCardEditor.state.selectedId = layer.id;
      IDCardEditor.draw();
      refreshProperties();
    };

    const visibility = document.createElement("button");
    visibility.type = "button";
    visibility.className = "layer-visibility-btn";

    visibility.title =
      layer.visible === false ? "Show layer" : "Hide layer";

    const eye = document.createElement("span");
    eye.className = "material-symbols-rounded";

    eye.textContent =
      layer.visible === false
        ? "visibility_off"
        : "visibility";

    visibility.append(eye);

    if (layer.visible === false) {
      visibility.classList.add("is-hidden");
      row.style.opacity = "0.5";
    }

    visibility.onclick = async () => {
      layer.visible = layer.visible === false ? true : false;

      await IDCardEditor.persist();
      IDCardEditor.draw();
      refreshLayers();
    };

    const lock = document.createElement("button");
    lock.className = "layer-lock";
    lock.textContent = layer.locked ? "🔒" : "🔓";
    lock.title = "Lock/unlock";

    lock.onclick = async () => {
      layer.locked = !layer.locked;

      await IDCardEditor.persist();
      refreshLayers();
      refreshProperties();
    };

    row.append(pick, visibility, lock);
    list.append(row);
  });
}

/* PROPERTIES */

function refreshProperties() {
  const layer = IDCardEditor.selected();
  const hasSelection = !!layer;

  $("noSelection").classList.toggle("hidden", hasSelection);
  $("properties").classList.toggle("hidden", !hasSelection);

  if (!layer) {
    refreshLayers();
    return;
  }

  $("selectedName").textContent = layer.name;

  $("propX").value = Math.round(
    layer.type === "text" ? layer.x - layer.w / 2 : layer.x
  );

  $("propY").value = Math.round(
    layer.type === "text" ? layer.y - layer.h / 2 : layer.y
  );

  $("propW").value = Math.round(layer.w);
  $("propH").value = Math.round(layer.h);
  $("propLabel").value = layer.name;

  const isText = layer.type === "text";

  $("fontSizeRow").classList.toggle("hidden", !isText);
  $("colorRow").classList.toggle("hidden", !isText);
  $("alignRow").classList.toggle("hidden", !isText);

  if (isText) {
    $("propFont").value = layer.font || 24;
    $("propColor").value = layer.color || "#111111";
    $("propAlign").value = layer.align || "left";
  }

  $("lockLayer").textContent = layer.locked
    ? "🔓 Unlock position"
    : "🔒 Lock position";

  refreshLayers();
}

function updateSelected(patch) {
  const layer = IDCardEditor.selected();

  if (layer) {
    IDCardEditor.update(layer.id, patch);
    refreshLayers();
  }
}

["propX", "propY", "propW", "propH"].forEach(id => {
  $(id).onchange = () => {
    const layer = IDCardEditor.selected();

    if (!layer) return;

    const x = Number($("propX").value);
    const y = Number($("propY").value);
    const w = Math.max(10, Number($("propW").value));
    const h = Math.max(10, Number($("propH").value));

    IDCardEditor.update(
      layer.id,
      layer.type === "text"
        ? { x: x + w / 2, y: y + h / 2, w, h }
        : { x, y, w, h }
    );

    refreshProperties();
  };
});

$("propFont").onchange = () => {
  updateSelected({ font: Number($("propFont").value) });
};

$("propColor").oninput = () => {
  updateSelected({ color: $("propColor").value });
};

$("propAlign").onchange = () => {
  updateSelected({ align: $("propAlign").value });
};

$("propLabel").onchange = () => {
  updateSelected({ name: $("propLabel").value });
  refreshProperties();
};

$("lockLayer").onclick = () => {
  const layer = IDCardEditor.selected();

  if (layer) {
    IDCardEditor.update(layer.id, {
      locked: !layer.locked
    });

    refreshProperties();
  }
};

$("deleteLayer").onclick = () => {
  const layer = IDCardEditor.selected();

  if (layer && confirm("Delete this layer?")) {
    IDCardEditor.remove(layer.id);
    refreshProperties();
  }
};

window.addEventListener("editor-selection", refreshProperties);

window.addEventListener("editor-change", () => {
  const layer = IDCardEditor.selected();

  if (!layer) return;

  $("propX").value = Math.round(
    layer.type === "text" ? layer.x - layer.w / 2 : layer.x
  );

  $("propY").value = Math.round(
    layer.type === "text" ? layer.y - layer.h / 2 : layer.y
  );
});

/* ZOOM */

$("zoomIn").onclick = () => {
  IDCardEditor.setZoom(IDCardEditor.state.zoom + 0.1);
};

$("zoomOut").onclick = () => {
  IDCardEditor.setZoom(IDCardEditor.state.zoom - 0.1);
};

$("fitCanvas").onclick = () => {
  IDCardEditor.setZoom(1);
};

/* PREVIEW */

$("previewBtn").onclick = () => {
  const front = IDCardEditor.imageData("front");
  const back = IDCardEditor.imageData("back");

  $("frontPreviewCanvas").getContext("2d").drawImage(front, 0, 0);
  $("backPreviewCanvas").getContext("2d").drawImage(back, 0, 0);

  $("previewModal").classList.remove("hidden");
};

/* MODAL CLOSE */

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    const modal = $(button.dataset.close);

    if (modal) modal.classList.add("hidden");
  });
});

document.querySelectorAll(".modal-backdrop").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.classList.add("hidden");
    }
  });
});

/* STUDENT RECORDS */

let records = [];

async function loadRecords() {
  records = await IDB.get("records") || [];
  renderRecords();
}

function renderRecords() {
  const query = $("recordSearch").value.toLowerCase();
  const list = $("recordsList");

  list.innerHTML = "";

  const found = records.filter(record =>
    (
      (record.name || "") + " " +
      (record.number || "")
    ).toLowerCase().includes(query)
  );

  if (!found.length) {
    list.innerHTML =
      '<div class="empty-state">No matching student records.</div>';
    return;
  }

  found.forEach(record => {
    const row = document.createElement("div");
    row.className = "record-row";

    const info = document.createElement("div");

    const strong = document.createElement("strong");
    strong.textContent = record.name || "Unnamed student";

    const small = document.createElement("small");
    small.textContent =
      (record.number || "No ID number") +
      " · " +
      (record.course || "No course");

    info.append(strong, small);

    const actions = document.createElement("div");
    actions.className = "record-actions";

    const load = document.createElement("button");
    load.className = "btn btn-quiet";
    load.textContent = "Load";

    load.onclick = () => {
      IDCardEditor.importLayers(record.layers);

      $("studentName").value = record.name || "";
      $("course").value = record.course || "";
      $("studentNumber").value = record.number || "";
      $("schoolYear").value = record.year || "";
      $("birthdate").value = record.birthdate || "";
      $("contact").value = record.contact || "";
      $("address").value = record.address || "";
      $("emergency").value = record.emergency || "";

      syncStudentDetails();
      showView("designer");

      toast("Student record loaded.");
    };

    const del = document.createElement("button");
    del.className = "btn btn-danger-quiet";
    del.textContent = "Delete";

    del.onclick = async () => {
      if (!confirm("Delete this saved record?")) return;

      records = records.filter(item => item.id !== record.id);

      await IDB.put("records", records);
      renderRecords();

      toast("Student record deleted.");
    };

    actions.append(load, del);
    row.append(info, actions);
    list.append(row);
  });
}

$("recordSearch").oninput = renderRecords;

$("saveRecordBtn").onclick = async () => {
  const name = $("studentName").value.trim();

  if (!name) {
    toast("Enter a student name before saving.");
    return;
  }

  const record = {
    id: Date.now(),
    name,
    course: $("course").value,
    number: $("studentNumber").value,
    year: $("schoolYear").value,
    birthdate: $("birthdate").value,
    contact: $("contact").value,
    address: $("address").value,
    emergency: $("emergency").value,
    layers: IDCardEditor.exportLayerData(),
    savedAt: new Date().toISOString()
  };

  records = records.filter(item =>
    item.number !== record.number || !record.number
  );

  records.unshift(record);

  await IDB.put("records", records);
  renderRecords();

  toast("Student ID record saved on this device.");
};

/* TEMPLATE LIBRARY */

const TEMPLATE_KEY = "saved-templates";

let savedTemplates = [];

async function loadTemplates() {
  savedTemplates = await IDB.get(TEMPLATE_KEY) || [];
  renderTemplates();
}

async function saveTemplates() {
  await IDB.put(TEMPLATE_KEY, savedTemplates);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/*
 * Add front and back artwork upload controls to the modal.
 * This keeps the existing index.html usable.
 */
function setupTemplateArtworkInputs() {
  const form = $("createTemplateForm");

  if ($("templateFrontArtwork")) return;

  const info = form.querySelector(".template-save-info");

  const uploadGroup = document.createElement("div");
  uploadGroup.className = "template-artwork-inputs";

  uploadGroup.innerHTML = `
    <label>
      Front ID artwork
      <input
        type="file"
        id="templateFrontArtwork"
        accept="image/*"
      >
    </label>

    <label>
      Back ID artwork
      <input
        type="file"
        id="templateBackArtwork"
        accept="image/*"
      >
    </label>

    <p class="hint">
      Upload clean front and back artwork. Leave a field empty
      to keep the artwork currently loaded in the designer.
    </p>
  `;

  form.insertBefore(uploadGroup, info);
}

function renderTemplates() {
  const library = $("templateLibrary");

  if (!library) return;

  library.innerHTML = "";

  if (!savedTemplates.length) {
    library.innerHTML = `
      <div class="empty-state">
        No saved templates yet. Click "Create New Template" to get started.
      </div>
    `;
    return;
  }

  savedTemplates.forEach(template => {
    const card = document.createElement("article");
    card.className = "saved-template";

    const front = template.artwork?.front || "";
    const back = template.artwork?.back || "";

    const frontPreview = front
      ? `<img src="${front}" alt="Front artwork">`
      : `<div class="template-no-preview">Front side</div>`;

    const backPreview = back
      ? `<img src="${back}" alt="Back artwork">`
      : `<div class="template-no-preview">Back side</div>`;

    card.innerHTML = `
      <div class="saved-template-preview">
        <div>${frontPreview}</div>
        <div>${backPreview}</div>
      </div>

      <div class="saved-template-details">
        <h3>${escapeHTML(template.title)}</h3>
        <small>
          Saved ${new Date(template.createdAt).toLocaleDateString()}
        </small>
      </div>

      <div class="saved-template-actions">
        <button class="btn btn-primary use-template" type="button">
          Use Template
        </button>

        <button class="btn btn-quiet rename-template" type="button">
          Rename
        </button>

        <button class="btn btn-danger-quiet delete-template" type="button">
          Delete
        </button>
      </div>
    `;

    card.querySelector(".use-template").onclick = async () => {
      if (
        !confirm(
          "Load this template? Your current canvas design will be replaced. Saved student records will remain unchanged."
        )
      ) return;

      try {
        await IDCardEditor.applySavedTemplate(template);

        syncStudentDetails();
        showView("designer");

        document.querySelectorAll(".segment").forEach(button => {
          button.classList.toggle(
            "active",
            button.dataset.side === "front"
          );
        });

        refreshProperties();

        toast("Template loaded successfully.");
      } catch (error) {
        console.error(error);
        toast("Unable to load this template.");
      }
    };

    card.querySelector(".rename-template").onclick = async () => {
      const title = prompt(
        "Enter a new template name:",
        template.title
      );

      if (title === null) return;

      const newTitle = title.trim();

      if (!newTitle) {
        toast("Template name cannot be empty.");
        return;
      }

      template.title = newTitle;
      template.updatedAt = new Date().toISOString();

      await saveTemplates();
      renderTemplates();

      toast("Template renamed.");
    };

    card.querySelector(".delete-template").onclick = async () => {
      if (!confirm(`Delete "${template.title}"? This cannot be undone.`)) {
        return;
      }

      savedTemplates = savedTemplates.filter(
        item => item.id !== template.id
      );

      await saveTemplates();
      renderTemplates();

      toast("Template deleted.");
    };

    library.append(card);
  });
}

/* OPEN CREATE TEMPLATE MODAL */

$("createTemplateBtn").onclick = () => {
  setupTemplateArtworkInputs();

  $("createTemplateForm").reset();
  $("createTemplateModal").classList.remove("hidden");
  $("templateTitle").focus();
};

/* SAVE COMPLETE TEMPLATE */

$("createTemplateForm").onsubmit = async event => {
  event.preventDefault();

  const title = $("templateTitle").value.trim();

  if (!title) {
    toast("Enter a template title.");
    return;
  }

  const frontFile = $("templateFrontArtwork").files[0];
  const backFile = $("templateBackArtwork").files[0];

  try {
    /*
     * Upload artwork if selected.
     * Otherwise, use artwork already stored in the designer.
     */
    if (frontFile) {
      await IDCardEditor.loadTemplate("front", frontFile);
    }

    if (backFile) {
      await IDCardEditor.loadTemplate("back", backFile);
    }

    const snapshot = await IDCardEditor.createTemplateSnapshot();

    const template = {
      id: "template-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 8),

      title,

      createdAt: new Date().toISOString(),

      updatedAt: new Date().toISOString(),

      artwork: snapshot.artwork,

      layers: snapshot.layers
    };

    savedTemplates.unshift(template);

    await saveTemplates();

    $("createTemplateModal").classList.add("hidden");

    renderTemplates();

    toast("Complete ID template saved successfully.");

  } catch (error) {
    console.error(error);
    toast("Unable to save the template. Please try again.");
  }
};

/* BACKUP */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("backupBtn").onclick = async () => {
  try {
    const blob = await IDCardEditor.backup();

    downloadBlob(blob, "school-id-maker-backup.json");

    toast("Backup downloaded.");
  } catch (error) {
    console.error(error);
    toast("Unable to create backup.");
  }
};

/* GLOBAL APP METHODS */

window.IDApp = {
  toast,
  downloadBlob,
  loadRecords
};

/* INITIALIZE */

(async () => {
  try {
    await IDCardEditor.restore();
    await loadRecords();
    await loadTemplates();

    setupTemplateArtworkInputs();

    refreshProperties();
    IDCardEditor.setZoom(1);

  } catch (error) {
    console.error("Initialization error:", error);
    toast("Some application data could not be loaded.");
  }
})();

/* SERVICE WORKER */

if (
  "serviceWorker" in navigator &&
  (
    location.protocol === "https:" ||
    location.hostname === "localhost"
  )
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(error => console.error("Service worker:", error));
  });
}
