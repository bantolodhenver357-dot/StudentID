
/* ==========================================
   SCHOOL ID MAKER - FULL CLOUD SYNC
   Synchronizes IndexedDB with Supabase.
   Images are stored in private Supabase Storage.
========================================== */

(() => {
  const TABLE = "student_records";
  const STATE_TABLE = "app_state";
  const BUCKET = "student-id-assets";

  let syncing = false;

  function notify(message) {
    if (window.IDApp?.toast) {
      window.IDApp.toast(message);
    } else {
      alert(message);
    }
  }

  function getSyncButton() {
    let button = document.getElementById("cloudSyncButton");
    if (button) return button;

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

    button.addEventListener("click", syncAll);

    return button;
  }

  /* ======================================
     IMAGE HELPERS
  ====================================== */

  function isImageData(value) {
    return typeof value === "string" &&
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
  }

  function imageExtension(dataUrl) {
    const mime = dataUrl.match(/^data:(image\/[^;]+)/)?.[1] || "image/png";

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
    const path = `${userId}/app-state/${safePath(key)}.${extension}`;

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
          await uploadAssets(value[i], userId, `${path}_${i}`)
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

    (cloudItems || []).forEach(item => {
      merged.set(item.key, item.value);
    });

    (localItems || []).forEach(item => {
      const key = item.key;
      const localValue = item.value;
      const cloudValue = merged.get(key);

      if (
        (key === "records" || key === "saved-templates") &&
        Array.isArray(localValue) &&
        Array.isArray(cloudValue)
      ) {
        merged.set(key, mergeArray(localValue, cloudValue));
      } else {
        // Preserve the current browser's copy for matching keys.
        merged.set(key, localValue);
      }
    });

    return Array.from(merged.entries()).map(([key, value]) => ({
      key,
      value
    }));
  }

  /* ======================================
     APPLICATION STATE SYNC
  ====================================== */

  async function syncApplicationState(user) {
    // Read all locally saved application data.
    const localItems = await IDB.all();

    // Retrieve the cloud copy.
    const { data: cloudRow, error: fetchError } =
      await supabaseClient
        .from(STATE_TABLE)
        .select("state_data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

    if (fetchError) throw fetchError;

    let cloudItems = [];

    if (cloudRow?.state_data?.items) {
      const restored = await restoreAssets(
        cloudRow.state_data.items
      );

      cloudItems = restored;
    }

    // Merge without deleting existing local or cloud-only keys.
    const mergedItems = mergeItems(localItems, cloudItems);

    // Save the merged copy locally.
    for (const item of mergedItems) {
      await IDB.put(item.key, item.value);
    }

    // Upload all image data to private Supabase Storage.
    const cloudReadyItems = await uploadAssets(
      mergedItems,
      user.id,
      "school_id_maker"
    );

    // Save the application state in Supabase.
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
     EXISTING STUDENT RECORD SYNC
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

    const { data: existingRows, error: fetchError } =
      await supabaseClient
        .from(TABLE)
        .select("local_id, record_data")
        .eq("user_id", user.id);

    if (fetchError) throw fetchError;

    const cloudById = new Map(
      (existingRows || [])
        .filter(row => row.local_id)
        .map(row => [String(row.local_id), row])
    );

    const uploads = [];

    for (const record of localRecords) {
      if (record.id === undefined || record.id === null) {
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

    const { data: latestRows, error: latestError } =
      await supabaseClient
        .from(TABLE)
        .select("local_id, record_data")
        .eq("user_id", user.id);

    if (latestError) throw latestError;

    const merged = mergeRecords(localRecords, latestRows || []);

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

      const { data: authData, error: authError } =
        await supabaseClient.auth.getUser();

      if (authError) throw authError;

      const user = authData.user;

      if (!user) {
        throw new Error(
          "Please sign in as the administrator first."
        );
      }

      // Synchronize individual student records first.
const recordCount = await syncStudentRecords(user);

// Then synchronize the complete application state,
// including the latest records, photos, signatures and templates.
const itemCount = await syncApplicationState(user);

      // Refresh the editor and student records.
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
      console.error("Cloud synchronization failed:", error);

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

    if (window.IDAuth?.isAuthenticated()) {
      button.style.display = "block";
    } else {
      button.style.display = "none";
    }

    window.addEventListener("admin-authenticated", () => {
      button.style.display = "block";
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        button.style.display = "none";
      } else {
        button.style.display = "block";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  window.IDCloudSync = {
    syncAll,
    syncRecords: syncAll,
    syncApplicationState
  };
})();
