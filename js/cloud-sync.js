
/* ==========================================
   SCHOOL ID MAKER - CLOUD RECORD SYNC
   Local IndexedDB remains the working copy.
========================================== */

(() => {
  const TABLE = "student_records";
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

    if (sidebar) {
      sidebar.appendChild(button);
    } else {
      document.body.appendChild(button);
    }

    button.addEventListener("click", syncRecords);

    return button;
  }

  function recordDate(record) {
    const value = Date.parse(record?.savedAt || "");
    return Number.isFinite(value) ? value : 0;
  }

  function mergeRecords(localRecords, cloudRows) {
    const merged = new Map();

    localRecords.forEach(record => {
      merged.set(String(record.id), record);
    });

    cloudRows.forEach(row => {
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

  async function syncRecords() {
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
        throw new Error("Please sign in as the administrator first.");
      }

      // Read existing local records without deleting anything.
      const localRecords = await IDB.get("records") || [];

      // Get the administrator's existing cloud records.
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

      // Upload missing or newer local records.
      const uploads = [];

      for (const record of localRecords) {
        if (record.id === undefined || record.id === null) {
          continue;
        }

        const localId = String(record.id);
        const cloudRow = cloudById.get(localId);

        const localTime = recordDate(record);
        const cloudTime = recordDate(cloudRow?.record_data);

        if (!cloudRow || localTime > cloudTime) {
          uploads.push({
            user_id: user.id,
            local_id: localId,
            record_data: record,
            updated_at: new Date().toISOString()
          });
        }
      }

      if (uploads.length) {
        const { error: uploadError } = await supabaseClient
          .from(TABLE)
          .upsert(uploads, {
            onConflict: "user_id,local_id"
          });

        if (uploadError) throw uploadError;
      }

      // Fetch the latest cloud copy after uploading.
      const { data: latestRows, error: latestError } =
        await supabaseClient
          .from(TABLE)
          .select("local_id, record_data")
          .eq("user_id", user.id);

      if (latestError) throw latestError;

      // Merge cloud records into IndexedDB.
      // Newer local records are retained.
      const mergedRecords = mergeRecords(
        localRecords,
        latestRows || []
      );

      await IDB.put("records", mergedRecords);

      // Refresh the existing Student Records screen.
      if (window.IDApp?.loadRecords) {
        await window.IDApp.loadRecords();
      }

      notify(
        `Cloud sync complete. ${mergedRecords.length} student record(s) available.`
      );

    } catch (error) {
      console.error("Cloud synchronization failed:", error);
      notify("Cloud sync failed: " + (error.message || "Unknown error."));
    } finally {
      syncing = false;
      button.disabled = false;
      button.textContent = "☁ Sync Cloud";
    }
  }

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
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  window.IDCloudSync = {
    syncRecords
  };
})();
