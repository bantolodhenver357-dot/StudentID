
/* School ID Maker - Canvas Editor */
const IDCardEditor = (() => {
  const canvas = document.getElementById("idCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const state = {
    side: "front",
    templates: { front: null, back: null },
    images: {},
    layers: { front: [], back: [] },
    selectedId: null,
    zoom: 1,
    photo: null,
    photoBase: null,
    drag: null,
    signature: null
  };

  let idCounter = 1;
  const uid = () => "layer-" + idCounter++;

  const clone = value => JSON.parse(JSON.stringify(value));

  // Save signature images separately from layer settings.
  async function saveLayerImage(id, data) {
    const saved = await IDB.get("layer-images") || {};
    saved[id] = data;
    await IDB.put("layer-images", saved);
  }

  async function removeLayerImage(id) {
    const saved = await IDB.get("layer-images") || {};
    delete saved[id];
    await IDB.put("layer-images", saved);
  }

  const defaultLayers = () => ({
    front: [
      {
        id: uid(), type: "text", name: "Student name",
        text: "STUDENT NAME", x: 318, y: 748,
        w: 520, h: 45, font: 29, color: "#fff000",
        align: "center", weight: "bold"
      },
      {
        id: uid(), type: "text", name: "Course",
        text: "COURSE / PROGRAM", x: 318, y: 812,
        w: 520, h: 38, font: 25, color: "#ffffff",
        align: "center", weight: "bold"
      },
      {
        id: uid(), type: "text", name: "Student number",
        text: "00000", x: 318, y: 890,
        w: 520, h: 42, font: 34, color: "#ffffff",
        align: "center", weight: "normal"
      },
      {
        id: uid(), type: "photo", name: "Student photo",
        x: 184, y: 208, w: 376, h: 470,
        fit: "cover", scale: 1, offsetX: 0,
        offsetY: 0, rotation: 0
      }
    ],

    back: [
      {
        id: uid(), type: "text", name: "School year",
        text: "SCHOOL YEAR", x: 455, y: 78,
        w: 280, h: 75, font: 25, color: "#111111",
        align: "center", weight: "bold"
      },
      {
        id: uid(), type: "text", name: "Birthdate",
        text: "Birthdate", x: 318, y: 160,
        w: 510, h: 35, font: 22, color: "#111111",
        align: "left", weight: "normal"
      },
      {
        id: uid(), type: "text", name: "Contact number",
        text: "Contact No.", x: 318, y: 220,
        w: 510, h: 35, font: 22, color: "#111111",
        align: "left", weight: "normal"
      },
      {
        id: uid(), type: "text", name: "Address",
        text: "Address", x: 318, y: 285,
        w: 510, h: 65, font: 21, color: "#111111",
        align: "left", weight: "bold"
      },
      {
        id: uid(), type: "text", name: "Emergency contact",
        text: "In case of emergency please contact:",
        x: 318, y: 575, w: 540, h: 70,
        font: 19, color: "#111111",
        align: "center", weight: "normal"
      }
    ]
  });

  state.layers = defaultLayers();

  function imageFrom(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src;
    });
  }

  function blobToData(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function roundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.clip();
  }

  function drawLayer(c, layer, selected = false) {
    c.save();

    if (layer.type === "text") {
      c.fillStyle = layer.color || "#111";
      c.textAlign = layer.align || "left";
      c.textBaseline = "middle";
      c.font =
        `${layer.weight || "normal"} ${layer.font || 24}px "DM Sans", Arial, sans-serif`;

      const lines = String(layer.text || "").split("\n");
      const lineHeight = (layer.font || 24) * 1.2;
      const startY = layer.y - ((lines.length - 1) * lineHeight / 2);

      lines.forEach((line, i) => {
        c.fillText(line, layer.x, startY + i * lineHeight, layer.w);
      });

    } else if (layer.type === "photo" || layer.type === "signature") {
      const im = state.images[layer.id];

      if (im) {
        c.save();

        if (layer.type === "photo") {
          roundedRect(
            c,
            layer.x,
            layer.y,
            layer.w,
            layer.h,
            Math.min(35, layer.radius ?? 24)
          );
        }

        const fitScale = layer.type === "photo"
          ? Math.max(layer.w / im.width, layer.h / im.height)
          : Math.min(layer.w / im.width, layer.h / im.height);

        const scale = fitScale * (layer.scale || 1);
        const dw = im.width * scale;
        const dh = im.height * scale;

        c.translate(
          layer.x + layer.w / 2 + (layer.offsetX || 0),
          layer.y + layer.h / 2 + (layer.offsetY || 0)
        );

        c.rotate((layer.rotation || 0) * Math.PI / 180);
        c.drawImage(im, -dw / 2, -dh / 2, dw, dh);
        c.restore();

      } else {
        c.fillStyle = "#e9eef6";
        c.fillRect(layer.x, layer.y, layer.w, layer.h);

        c.strokeStyle = "#9aabc2";
        c.setLineDash([8, 6]);
        c.strokeRect(layer.x, layer.y, layer.w, layer.h);
        c.setLineDash([]);

        c.fillStyle = "#65758d";
        c.font = "18px Arial";
        c.textAlign = "center";

        c.fillText(
          layer.type === "photo" ? "STUDENT PHOTO" : "SIGNATURE",
          layer.x + layer.w / 2,
          layer.y + layer.h / 2
        );
      }
    }

    if (selected) {
      c.strokeStyle = "#2470ff";
      c.lineWidth = 3;
      c.setLineDash([8, 5]);

      const b = layer.type === "text"
        ? {
            x: layer.x - layer.w / 2,
            y: layer.y - layer.h / 2,
            w: layer.w,
            h: layer.h
          }
        : {
            x: layer.x,
            y: layer.y,
            w: layer.w,
            h: layer.h
          };

      c.strokeRect(b.x, b.y, b.w, b.h);
      c.setLineDash([]);

      c.fillStyle = "#2470ff";
      c.fillRect(b.x + b.w - 7, b.y + b.h - 7, 14, 14);
    }

    c.restore();
  }

  function draw(target = canvas, opts = {}) {
    const c = target.getContext("2d");
    const side = opts.side || state.side;

    c.clearRect(0, 0, W, H);
    c.fillStyle = "#fff";
    c.fillRect(0, 0, W, H);

    const bg = state.templates[side];
    if (bg) c.drawImage(bg, 0, 0, W, H);

    state.layers[side].forEach(layer => {
      if (layer.visible === false) return;

      drawLayer(
        c,
        layer,
        !opts.clean &&
        layer.id === state.selectedId &&
        side === state.side
      );
    });
  }

  function selected() {
    return state.layers[state.side].find(
      layer => layer.id === state.selectedId
    ) || null;
  }

  function bounds(layer) {
    return layer.type === "text"
      ? {
          x: layer.x - layer.w / 2,
          y: layer.y - layer.h / 2,
          w: layer.w,
          h: layer.h
        }
      : {
          x: layer.x,
          y: layer.y,
          w: layer.w,
          h: layer.h
        };
  }

  function hit(x, y, layer) {
    if (layer.visible === false) return false;

    const b = bounds(layer);

    return (
      x >= b.x - 8 &&
      x <= b.x + b.w + 8 &&
      y >= b.y - 8 &&
      y <= b.y + b.h + 8
    );
  }

  function pointer(e) {
    const r = canvas.getBoundingClientRect();

    return {
      x: (e.clientX - r.left) * W / r.width,
      y: (e.clientY - r.top) * H / r.height
    };
  }

  canvas.addEventListener("pointerdown", e => {
    const p = pointer(e);
    const list = state.layers[state.side];

    const layer = [...list].reverse().find(
      item => hit(p.x, p.y, item)
    );

    state.selectedId = layer?.id || null;

    if (layer && !layer.locked) {
      const b = bounds(layer);

      state.drag = {
        id: layer.id,
        start: p,
        orig: {
          x: layer.x,
          y: layer.y,
          w: layer.w,
          h: layer.h,
          offsetX: layer.offsetX || 0,
          offsetY: layer.offsetY || 0
        },
        resize:
          p.x > b.x + b.w - 20 &&
          p.y > b.y + b.h - 20
      };
    }

    canvas.setPointerCapture(e.pointerId);
    draw();
    window.dispatchEvent(new Event("editor-selection"));
  });

  canvas.addEventListener("pointermove", e => {
    if (!state.drag) return;

    const p = pointer(e);
    const d = state.drag;

    const layer = state.layers[state.side].find(
      item => item.id === d.id
    );

    if (!layer) return;

    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;

    if (d.resize) {
      layer.w = Math.max(20, d.orig.w + dx);
      layer.h = Math.max(20, d.orig.h + dy);
    } else {
      layer.x = d.orig.x + dx;
      layer.y = d.orig.y + dy;
    }

    draw();
    window.dispatchEvent(new Event("editor-change"));
  });

  canvas.addEventListener("pointerup", async () => {
    if (state.drag) {
      state.drag = null;
      await persist();
    }
  });

  function setSide(side) {
    state.side = side;
    state.selectedId = null;
    draw();
    window.dispatchEvent(new Event("editor-selection"));
  }

  function setTemplate(side, img) {
    state.templates[side] = img;
    draw();
  }

  async function loadTemplate(side, file) {
    const data = await blobToData(file);
    const im = await imageFrom(data);

    state.templates[side] = im;
    await IDB.put("template-" + side, data);

    draw();
    return im;
  }

  async function restore() {
    for (const side of ["front", "back"]) {
      const data = await IDB.get("template-" + side);

      if (data) {
        state.templates[side] = await imageFrom(data);
      }
    }

    const saved = await IDB.get("layers");

    if (saved) {
      state.layers = saved;
    }

    const photo = await IDB.get("photo");

    if (photo) {
      state.photoBase = await imageFrom(photo);
      state.photo = state.photoBase;

      const layer = state.layers.front.find(
        item => item.type === "photo"
      );

      if (layer) {
        state.images[layer.id] = state.photo;
      }
    }

    // Restore saved signature images.
    const savedImages = await IDB.get("layer-images") || {};

    for (const [id, data] of Object.entries(savedImages)) {
      try {
        state.images[id] = await imageFrom(data);
      } catch (error) {
        console.error("Could not restore saved image:", id, error);
      }
    }

    draw();
  }

  async function addPhoto(file) {
    const data = await blobToData(file);
    const im = await imageFrom(data);

    state.photoBase = im;
    state.photo = im;

    let layer = state.layers.front.find(
      item => item.type === "photo"
    );

    if (!layer) {
      layer = {
        id: uid(),
        type: "photo",
        name: "Student photo",
        x: 184,
        y: 208,
        w: 376,
        h: 470,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0
      };

      state.layers.front.push(layer);
    }

    state.images[layer.id] = im;

    await IDB.put("photo", data);

    state.selectedId = layer.id;
    draw();

    window.dispatchEvent(new Event("editor-selection"));
    await persist();
  }

  async function addSignature(file) {
    try {
      const data = await blobToData(file);
      const im = await imageFrom(data);

      const layer = {
        id: uid(),
        type: "signature",
        name: "Signature",
        x: 150,
        y: 390,
        w: 330,
        h: 100,
        scale: 1
      };

      state.layers.back.push(layer);
      state.images[layer.id] = im;
      state.signature = im;
      state.selectedId = layer.id;

      // Save signature image for reload and cloud sync.
      await saveLayerImage(layer.id, data);

      await persist();

      draw();
      window.dispatchEvent(new Event("editor-selection"));

    } catch (error) {
      console.error("Signature upload failed:", error);
      window.IDApp?.toast?.("Unable to add signature.");
    }
  }

  function addText() {
    const layer = {
      id: uid(),
      type: "text",
      name: "New text",
      text: "EDIT THIS TEXT",
      x: W / 2,
      y: H / 2,
      w: 400,
      h: 45,
      font: 28,
      color: "#111111",
      align: "center",
      weight: "bold"
    };

    state.layers[state.side].push(layer);
    state.selectedId = layer.id;

    draw();
    window.dispatchEvent(new Event("editor-selection"));
    persist();
  }

  function addPhotoFrame() {
    const layer = {
      id: uid(),
      type: "photo",
      name: "Photo frame",
      x: 180,
      y: 200,
      w: 270,
      h: 340,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0
    };

    state.layers[state.side].push(layer);
    state.selectedId = layer.id;

    draw();
    window.dispatchEvent(new Event("editor-selection"));
    persist();
  }

  async function persist() {
    await IDB.put("layers", state.layers);
  }

  function update(id, patch) {
    const layer = state.layers[state.side].find(
      item => item.id === id
    );

    if (layer) {
      Object.assign(layer, patch);
      draw();
      persist();
    }
  }

  function remove(id) {
    state.layers[state.side] = state.layers[state.side].filter(
      item => item.id !== id
    );

    delete state.images[id];

    // Remove any saved image belonging to this layer.
    removeLayerImage(id).catch(error => {
      console.error("Could not remove saved layer image:", error);
    });

    state.selectedId = null;
    draw();
    persist();

    window.dispatchEvent(new Event("editor-selection"));
  }

  function setPhotoZoom(value) {
    const layer = state.layers.front.find(
      item => item.type === "photo"
    );

    if (layer) {
      layer.scale = Number(value);
      draw();
      persist();
    }
  }

  function rotatePhoto() {
    const layer = state.layers.front.find(
      item => item.type === "photo"
    );

    if (layer) {
      layer.rotation = (layer.rotation + 90) % 360;
      draw();
      persist();
    }
  }

  function resetPhoto() {
    const layer = state.layers.front.find(
      item => item.type === "photo"
    );

    if (layer) {
      layer.scale = 1;
      layer.offsetX = 0;
      layer.offsetY = 0;
      layer.rotation = 0;

      draw();
      persist();
    }
  }

  function imageData(side) {
    const output = document.createElement("canvas");
    output.width = W;
    output.height = H;

    draw(output, { side, clean: true });

    return output;
  }

  function applyInfo(data) {
    const front = state.layers.front;
    const back = state.layers.back;

    const set = (arr, name, value, placeholder = "") => {
      const layer = arr.find(item => item.name === name);

      if (layer) {
        layer.text = value && String(value).trim()
          ? String(value).trim()
          : placeholder;
      }
    };

    set(front, "Student name", data.name, "STUDENT NAME");
    set(front, "Course", data.course, "COURSE / PROGRAM");
    set(front, "Student number", data.number, "00000");

    set(back, "School year", data.year, "SCHOOL YEAR");
    set(back, "Birthdate", data.birthdate, "Birthdate");
    set(back, "Contact number", data.contact, "Contact No.");
    set(back, "Address", data.address, "Address");

    set(
      back,
      "Emergency contact",
      data.emergency,
      "In case of emergency please contact:"
    );

    draw();
    persist();
  }

  /*
   * Creates a reusable template snapshot.
   * Student-specific text is replaced with placeholders.
   * Actual photo and signature image data are never included.
   */
  async function createTemplateSnapshot() {
    const layers = clone(state.layers);

    const placeholders = {
      "Student name": "STUDENT NAME",
      "Course": "COURSE / PROGRAM",
      "Student number": "00000",
      "School year": "SCHOOL YEAR",
      "Birthdate": "Birthdate",
      "Contact number": "Contact No.",
      "Address": "Address",
      "Emergency contact": "In case of emergency please contact:"
    };

    ["front", "back"].forEach(side => {
      layers[side].forEach(layer => {
        if (layer.type === "text" &&
            Object.prototype.hasOwnProperty.call(placeholders, layer.name)) {
          layer.text = placeholders[layer.name];
        }
      });
    });

    return {
      artwork: {
        front: await IDB.get("template-front"),
        back: await IDB.get("template-back")
      },
      layers
    };
  }

  /*
   * Loads a saved template without deleting student records.
   * An already uploaded student photo is kept separate and
   * connected to the first photo frame in the new template.
   */
  async function applySavedTemplate(template) {
    if (!template || !template.layers || !template.artwork) {
      throw new Error("This template is incomplete.");
    }

    const nextLayers = clone(template.layers);

    for (const side of ["front", "back"]) {
      const data = template.artwork[side];

      if (data) {
        state.templates[side] = await imageFrom(data);
        await IDB.put("template-" + side, data);
      } else {
        state.templates[side] = null;
        await IDB.put("template-" + side, null);
      }
    }

    state.layers = nextLayers;
    state.images = {};

    if (state.photoBase) {
      const photoLayer = state.layers.front.find(
        item => item.type === "photo"
      );

      if (photoLayer) {
        state.images[photoLayer.id] = state.photoBase;
        state.photo = state.photoBase;
      }
    }

    state.side = "front";
    state.selectedId = null;
    state.drag = null;

    await persist();

    draw();
    window.dispatchEvent(new Event("editor-selection"));
  }

  async function backup() {
    const all = await IDB.all();

    return new Blob(
      [JSON.stringify(all)],
      { type: "application/json" }
    );
  }

  async function restoreBackup(data) {
    const items = JSON.parse(data);

    for (const item of items) {
      await IDB.put(item.key, item.value);
    }

    location.reload();
  }

  function exportLayerData() {
    return clone(state.layers);
  }

  function importLayers(data) {
    state.layers = clone(data);

    if (state.photoBase) {
      const photoLayer = state.layers.front.find(
        item => item.type === "photo"
      );

      if (photoLayer) {
        state.images[photoLayer.id] = state.photoBase;
      }
    }

    state.selectedId = null;
    draw();
    persist();
    window.dispatchEvent(new Event("editor-selection"));
  }

  function setZoom(zoom) {
    state.zoom = Math.max(0.35, Math.min(1.5, zoom));

    document.getElementById("cardWrap").style.width =
      (318 * state.zoom) + "px";

    document.getElementById("zoomLabel").textContent =
      Math.round(state.zoom * 100) + "%";
  }

  return {
    state,
    draw,
    setSide,
    setTemplate,
    loadTemplate,
    restore,
    addPhoto,
    addSignature,
    addText,
    addPhotoFrame,
    selected,
    update,
    remove,
    setPhotoZoom,
    rotatePhoto,
    resetPhoto,
    imageData,
    persist,
    applyInfo,
    backup,
    restoreBackup,
    exportLayerData,
    importLayers,
    setZoom,
    createTemplateSnapshot,
    applySavedTemplate
  };
})();
