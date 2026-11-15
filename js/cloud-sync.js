
/* ==========================================
   SCHOOL ID MAKER - FULL CLOUD SYNC
   IndexedDB + Supabase Database + Storage
   Includes sidebar cloud storage meter.
========================================== */

(() => {
  const TABLE = "student_records";
  const STATE_TABLE = "app_state";
  const BUCKET = "student-id-assets";

  // Supabase Free plan storage allowance.
  // Change this if your plan's allowance changes.
  const STORAGE_QUOTA = 1024 * 1024 * 1024;

  let syncing = false;
  let storageRefreshing = false;

  /* ======================================
     NOTIFICATIONS
  ====================================== */

  function notify(message) {
    if (window.IDApp?.toast) {
      window.IDApp.toast(message);
    } else {
      alert(message);
    }
  }

  /* ======================================
     SYNC BUTTON
  ====================================== */

  function getSyncButton() {
    let button = document.getElementById("cloudSyncButton");

    if (!button) {
      button = document.createElement("button");
      button.id = "cloudSyncButton";
      button.type = "button";
      button.textContent = "☁ Sync Cloud";

      button.style.cssText = `
        display:block;
        width:calc(100% - 24px);
        margin:8px 12px;
        padding:11px 14px;
        border:1px solid #dce3ed;
        border-radius:9px;
        background:#eef4ff;
        color:#174ea6;
        font-weight:600;
        cursor:pointer;
      `;

      const sidebar = document.getElementById("sidebar");

      if (sidebar) sidebar.appendChild(button);
      else document.body.appendChild(button);
    }

    if (button.dataset.cloudSyncHandler !== "attached") {
      button.addEventListener("click", syncAll);
      button.dataset.cloudSyncHandler = "attached";
    }

    return button;
  }

  /* ======================================
     SIDEBAR CLOUD STORAGE CARD
  ====================================== */

  function getStorageCard() {
    let card = document.getElementById("cloudStorageCard");

    if (!card) {
      card = document.createElement("div");
      card.id = "cloudStorageCard";

      card.style.cssText = `
        display:none;
        margin:12px;
        padding:14px;
        border:1px solid #dce3ed;
        border-radius:12px;
        background:var(--card-bg,#ffffff);
        color:var(--text-color,#202938);
        font-size:13px;
        box-sizing:border-box;
      `;

      card.innerHTML = `
        <div style="
          display:flex;
          align-items:center;
          gap:8px;
          margin-bottom:13px;
        ">
          <span style="font-size:20px;">☁️</span>

          <strong style="flex:1;">
            Cloud Storage
          </strong>

          <button
            id="cloudStorageRefresh"
            type="button"
            title="Refresh storage"
            aria-label="Refresh storage"
            style="
              width:30px;
              height:30px;
              border:1px solid #dce3ed;
              border-radius:8px;
              background:transparent;
              cursor:pointer;
              font-size:17px;
              color:inherit;
            "
          >↻</button>
        </div>

        <div
          id="cloudStorageAmount"
          style="
            font-size:22px;
            font-weight:700;
            margin-bottom:3px;
            word-break:break-word;
          "
        >
          Loading...
        </div>

        <div style="
          color:#8993a3;
          font-size:11px;
          margin-bottom:12px;
        ">
          of 1 GB available
        </div>

        <div style="
          height:8px;
          background:#e8edf4;
          border-radius:20px;
          overflow:hidden;
        ">
          <div
            id="cloudStorageProgress"
            style="
              height:100%;
              width:0%;
              background:#2878ff;
              border-radius:20px;
              transition:width .3s ease;
            "
          ></div>
        </div>

        <div
          id="cloudStorageFiles"
          style="
            margin-top:10px;
            color:#8993a3;
            font-size:11px;
          "
        >
          Checking uploaded files...
        </div>
      `;

      const sidebar = document.getElementById("sidebar");
      const syncButton = document.getElementById("cloudSyncButton");

      if (sidebar) {
        if (syncButton) {
          syncButton.insertAdjacentElement("afterend", card);
        } else {
          sidebar.appendChild(card);
        }
      } else {
        document.body.appendChild(card);
      }

      card.querySelector("#cloudStorageRefresh")
        .addEventListener("click", refreshCloudStorage);
    }

    return card;
  }

  function formatStorage(bytes) {
    if (bytes < 1024) {
      return bytes + " Bytes";
    }

    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB";
    }

    if (bytes < STORAGE_QUOTA) {
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  /* ======================================
     READ STORAGE FILES RECURSIVELY
  ====================================== */

  async function listStorageFiles(path, offset = 0) {
    const { data, error } = await supabaseClient.storage
      .from(BUCKET)
      .list(path, {
        limit: 1000,
        offset,
        sortBy: {
          column: "name",
          order: "asc"
        }
      });

    if (error) throw error;

    let totalBytes = 0;
    let totalFiles = 0;

    for (const item of data || []) {
      // Folders normally have no ID or metadata.
      if (!item.id && !item.metadata) {
        const nestedPath = path
          ? `${path}/${item.name}`
          : item.name;

        const nested = await listStorageFiles(nestedPath);

        totalBytes += nested.bytes;
        totalFiles += nested.files;
      } else {
        const size = Number(
          item.metadata?.size ??
          item.metadata?.contentLength ??
          0
        );

        totalBytes += Number.isFinite(size) ? size : 0;
        totalFiles++;
      }
    }

    // Handle additional pages.
    if ((data || []).length === 1000) {
      const next = await listStorageFiles(path, offset + 1000);

      totalBytes += next.bytes;
      totalFiles += next.files;
    }

    return {
      bytes: totalBytes,
      files: totalFiles
    };
  }

  /* ======================================
     UPDATE STORAGE METER
  ====================================== */

  async function updateStorageUsage(user) {
    const card = getStorageCard();

    if (!user) {
      card.style.display = "none";
      return;
    }

    card.style.display = "block";

    const amount = card.querySelector("#cloudStorageAmount");
    const progress = card.querySelector("#cloudStorageProgress");
    const files = card.querySelector("#cloudStorageFiles");
    const refreshButton = card.querySelector("#cloudStorageRefresh");

    if (storageRefreshing) return;

    storageRefreshing = true;

    refreshButton.disabled = true;
    refreshButton.style.opacity = "0.5";

    amount.textContent = "Loading...";
    files.textContent = "Checking uploaded files...";

    try {
      const result = await listStorageFiles(user.id);

      const percent = Math.min(
        100,
        (result.bytes / STORAGE_QUOTA) * 100
      );

      amount.textContent = formatStorage(result.bytes);

      progress.style.width = percent.toFixed(2) + "%";

      if (percent >= 90) {
        progress.style.background = "#e5484d";
      } else if (percent >= 75) {
        progress.style.background = "#e5a000";
      } else {
        progress.style.background = "#2878ff";
      }

      files.textContent =
        `${result.files} uploaded files · ${percent.toFixed(1)}% used`;

    } catch (error) {
      console.error("Cloud storage usage error:", error);

      amount.textContent = "Unavailable";

      files.textContent =
        error.message || "Unable to check cloud storage.";
    } finally {
      storageRefreshing = false;

      refreshButton.disabled = false;
      refreshButton.style.opacity = "1";
    }
  }

  async function refreshCloudStorage() {
    try {
      const { data, error } = await supabaseClient.auth.getUser();

      if (error) throw error;

      if (!data.user) {
        notify("Please sign in first.");
        return;
      }

      await updateStorageUsage(data.user);

    } catch (error) {
      console.error(error);
      notify("Unable to refresh cloud storage.");
    }
  }

  /* ======================================
     IMAGE HELPERS
  ====================================== */

  function isImageData(value) {
    return typeof value === "string" &&
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
  }

  function imageExtension(dataUrl) {
    const mime =
      dataUrl.match(/^data:(image\/[^;]+)/)?.[1] ||
      "image/png";

    const extensions = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg"
    };

    return extensions[mime] || "png";
  }

  function safePath(value) {
    return String(value)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 180);
  }

  async function uploadImage(dataUrl, userId, key) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const extension = imageExtension(dataUrl);

    const path =
      `${userId}/app-state/${safePath(key)}.${extension}`;

    const { error } = await supabaseClient.storage
      .from(BUCKET)
      .upload(path, blob, {
        upsert: true,
        contentType: blob.type || "image/png"
      });

    if (error) throw error;

    return {
      __schoolIdCloudAsset: path
    };
  }

  async function uploadAssets(value, userId, path = "root") {
    if (isImageData(value)) {
      return uploadImage(value, userId, path);
    }

    if (Array.isArray(value)) {
      const result = [];

      for (let i = 0; i < value.length; i++) {
        result.push(
          await uploadAssets(
            value[i],
            userId,
            `${path}_${i}`
          )
        );
      }

      return result;
    }

    if (value && typeof value === "object") {
      const result = {};

      for (const [key, item] of Object.entries(value)) {
        result[key] = await uploadAssets(
          item,
          userId,
          `${path}_${key}`
        );
      }

      return result;
    }

    return value;
  }

  /* ======================================
     RESTORE PRIVATE STORAGE ASSETS
  ====================================== */

  async function restoreAssets(value) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.__schoolIdCloudAsset
    ) {
      const path = value.__schoolIdCloudAsset;

      const { data, error } = await supabaseClient.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600);

      if (error) throw error;

      const response = await fetch(data.signedUrl);

      if (!response.ok) {
        throw new Error("Unable to download a stored image.");
      }

      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);

        reader.readAsDataURL(blob);
      });
    }

    if (Array.isArray(value)) {
      const result = [];

      for (const item of value) {
        result.push(await restoreAssets(item));
      }

      return result;
    }

    if (value && typeof value === "object") {
      const result = {};

      for (const [key, item] of Object.entries(value)) {
        result[key] = await restoreAssets(item);
      }

      return result;
    }

    return value;
  }

  /* ======================================
     MERGE LOCAL AND CLOUD DATA
  ====================================== */

  function isEmptyValue(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length === 0 ||
        value.every(item => isEmptyValue(item));
    }

    if (typeof value === "object") {
      const values = Object.values(value);

      return values.length === 0 ||
        values.every(item => isEmptyValue(item));
    }

    return false;
  }

  function mergeArray(localArray, cloudArray) {
    const merged = new Map();

    (cloudArray || []).forEach(item => {
      if (item?.id !== undefined) {
        merged.set(String(item.id), item);
      }
    });

    (localArray || []).forEach(item => {
      if (item?.id !== undefined) {
        merged.set(String(item.id), item);
      }
    });

    return Array.from(merged.values());
  }

  function mergeItems(localItems, cloudItems) {
    const merged = new Map();

    // Load cloud data first.
    (cloudItems || []).forEach(item => {
      merged.set(item.key, item.value);
    });

    // Merge existing local data.
    (localItems || []).forEach(item => {
      const key = item.key;
      const localValue = item.value;
      const cloudValue = merged.get(key);

      if (
        (key === "records" || key === "saved-templates") &&
        Array.isArray(localValue) &&
        Array.isArray(cloudValue)
      ) {
        merged.set(
          key,
          mergeArray(localValue, cloudValue)
        );
      } else if (
        isEmptyValue(localValue) &&
        !isEmptyValue(cloudValue)
      ) {
        // Restore populated cloud data if local data is empty.
        merged.set(key, cloudValue);
      } else {
        // Preserve populated local data.
        merged.set(key, localValue);
      }
    });

    return Array.from(merged.entries()).map(
      ([key, value]) => ({
        key,
        value
      })
    );
  }

  /* ======================================
     APPLICATION STATE SYNC
  ====================================== */

  async function syncApplicationState(user) {
    const localItems = await IDB.all();

    const {
      data: cloudRow,
      error: fetchError
    } = await supabaseClient
      .from(STATE_TABLE)
      .select("state_data, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let cloudItems = [];

    if (cloudRow?.state_data?.items) {
      cloudItems = await restoreAssets(
        cloudRow.state_data.items
      );
    }

    const mergedItems = mergeItems(
      localItems,
      cloudItems
    );

    // Restore the merged items locally.
    for (const item of mergedItems) {
      await IDB.put(item.key, item.value);
    }

    // Upload images and convert them to Storage references.
    const cloudReadyItems = await uploadAssets(
      mergedItems,
      user.id,
      "school_id_maker"
    );

    const stateData = {
      version: 1,
      items: cloudReadyItems
    };

    const { error: saveError } = await supabaseClient
      .from(STATE_TABLE)
      .upsert({
        user_id: user.id,
        state_data: stateData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      });

    if (saveError) throw saveError;

    return mergedItems.length;
  }

  /* ======================================
     STUDENT RECORD SYNC
  ====================================== */

  function recordDate(record) {
    const value = Date.parse(record?.savedAt || "");

    return Number.isFinite(value) ? value : 0;
  }

  function mergeRecords(localRecords, cloudRows) {
    const merged = new Map();

    (localRecords || []).forEach(record => {
      merged.set(String(record.id), record);
    });

    (cloudRows || []).forEach(row => {
      if (!row.local_id || !row.record_data) return;

      const key = String(row.local_id);
      const cloudRecord = row.record_data;
      const localRecord = merged.get(key);

      if (
        !localRecord ||
        recordDate(cloudRecord) > recordDate(localRecord)
      ) {
        merged.set(key, cloudRecord);
      }
    });

    return Array.from(merged.values()).sort(
      (a, b) => recordDate(b) - recordDate(a)
    );
  }

  async function syncStudentRecords(user) {
    const localRecords = await IDB.get("records") || [];

    const {
      data: existingRows,
      error: fetchError
    } = await supabaseClient
      .from(TABLE)
      .select("local_id, record_data")
      .eq("user_id", user.id);

    if (fetchError) throw fetchError;

    const cloudById = new Map(
      (existingRows || [])
        .filter(row => row.local_id)
        .map(row => [
          String(row.local_id),
          row
        ])
    );

    const uploads = [];

    for (const record of localRecords) {
      if (
        record.id === undefined ||
        record.id === null
      ) {
        continue;
      }

      const localId = String(record.id);
      const cloudRow = cloudById.get(localId);

      if (
        !cloudRow ||
        recordDate(record) > recordDate(cloudRow.record_data)
      ) {
        uploads.push({
          user_id: user.id,
          local_id: localId,
          record_data: record,
          updated_at: new Date().toISOString()
        });
      }
    }

    if (uploads.length) {
      const { error } = await supabaseClient
        .from(TABLE)
        .upsert(uploads, {
          onConflict: "user_id,local_id"
        });

      if (error) throw error;
    }

    const {
      data: latestRows,
      error: latestError
    } = await supabaseClient
      .from(TABLE)
      .select("local_id, record_data")
      .eq("user_id", user.id);

    if (latestError) throw latestError;

    const merged = mergeRecords(
      localRecords,
      latestRows || []
    );

    await IDB.put("records", merged);

    return merged.length;
  }

  /* ======================================
     MAIN SYNC
  ====================================== */

  async function syncAll() {
    if (syncing) return;

    const button = getSyncButton();

    try {
      syncing = true;

      button.disabled = true;
      button.textContent = "☁ Synchronizing...";

      const {
        data: authData,
        error: authError
      } = await supabaseClient.auth.getUser();

      if (authError) throw authError;

      const user = authData.user;

      if (!user) {
        throw new Error(
          "Please sign in as the administrator first."
        );
      }

      // Synchronize individual student records.
      const recordCount = await syncStudentRecords(user);

      // Synchronize templates, layers, photos and artwork.
      const itemCount = await syncApplicationState(user);

      // Update the sidebar storage meter.
      await updateStorageUsage(user);

      // Refresh application screens.
      if (window.IDCardEditor?.restore) {
        await window.IDCardEditor.restore();
      }

      if (window.IDApp?.loadRecords) {
        await window.IDApp.loadRecords();
      }

      if (window.IDApp?.loadTemplates) {
        await window.IDApp.loadTemplates();
      }

      notify(
        `Cloud sync complete! ${recordCount} student records and ${itemCount} application data items synchronized.`
      );

    } catch (error) {
      console.error(
        "Cloud synchronization failed:",
        error
      );

      notify(
        "Cloud sync failed: " +
        (error.message || "Unknown error.")
      );

    } finally {
      syncing = false;

      button.disabled = false;
      button.textContent = "☁ Sync Cloud";
    }
  }

  /* ======================================
     INITIALIZATION
  ====================================== */

  function initialize() {
    const button = getSyncButton();
    const storageCard = getStorageCard();

    if (window.IDAuth?.isAuthenticated()) {
      button.style.display = "block";
      storageCard.style.display = "block";
    } else {
      button.style.display = "none";
      storageCard.style.display = "none";
    }

    window.addEventListener("admin-authenticated", async () => {
      button.style.display = "block";
      storageCard.style.display = "block";

      const { data, error } =
        await supabaseClient.auth.getUser();

      if (!error && data.user) {
        await updateStorageUsage(data.user);
      }
    });

    supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          button.style.display = "none";
          storageCard.style.display = "none";
        } else {
          button.style.display = "block";
          storageCard.style.display = "block";
        }
      }
    );

    // Load storage usage when the administrator is already signed in.
    supabaseClient.auth.getUser().then(
      ({ data, error }) => {
        if (!error && data.user) {
          updateStorageUsage(data.user);
        }
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

  /* ======================================
     PUBLIC API
  ====================================== */

  window.IDCloudSync = {
    syncAll,
    syncRecords: syncAll,
    syncApplicationState,
    refreshCloudStorage,
    updateStorageUsage
  };

})();
