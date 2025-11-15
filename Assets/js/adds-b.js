document.addEventListener("DOMContentLoaded", function () {
  const serviceForm = document.getElementById("serviceForm");
  const serviceTable = document.querySelector("#serviceTable tbody");
  const editServiceForm = document.getElementById("editServiceForm");

  const barForm = document.getElementById("barForm");
  const barTable = document.querySelector("#barTable tbody");
  const editBarForm = document.getElementById("editBarForm");

  // Helper: show bootstrap toast (fallback to alert)
  function showToast(message, success = true) {
    try {
      const toastEl = document.getElementById("toast");
      const toastBody = document.getElementById("toastMessage");
      if (toastEl && toastBody) {
        toastBody.textContent = message;
        toastEl.classList.toggle("bg-success", success);
        toastEl.classList.toggle("bg-danger", !success);
        new bootstrap.Toast(toastEl).show();
        return;
      }
    } catch (e) {
      /* ignore and fallback */
    }
    alert(message);
  }

  // Upload image to storage bucket 'service_images'
  async function uploadImage(file) {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const { data, error } = await window.supabase.storage
      .from("service_images")
      .upload(fileName, file, { cacheControl: "3600", upsert: true });
    if (error) throw error;
    const { data: publicData } = window.supabase.storage
      .from("service_images")
      .getPublicUrl(fileName);
    return { publicUrl: publicData.publicUrl, fileName };
  }

  // Services CRUD
  async function loadServices() {
    try {
      const { data, error } = await window.supabase
        .from("services")
        .select("id, heading, para, image_url, image_path, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      showToast("Failed to load services: " + err.message, false);
      return [];
    }
  }

  function renderServices(services) {
    serviceTable.innerHTML = "";
    services.forEach((s) => {
      serviceTable.innerHTML += `
        <tr>
          <td><img src="${s.image_url || ""}" width="80"></td>
          <td>${escapeHtml(s.heading)}</td>
          <td>${escapeHtml(s.para)}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="window.editService(${s.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="window.deleteService(${s.id})">Delete</button>
          </td>
        </tr>`;
    });
  }

  // Bars CRUD
  async function loadBars() {
    try {
      const { data, error } = await window.supabase
        .from("progress_bars")
        .select("id, category, title, value, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      console.log(data,'test')
      return data || [];
    } catch (err) {
      showToast("Failed to load statistics: " + err.message, false);
      return [];
    }
  }

  function renderBars(bars) {
    barTable.innerHTML = "";
    // Sort by the order in STAT_CATEGORIES for consistent display
    const sortedBars = bars.sort((a, b) => {
      const aIdx = STAT_CATEGORIES.findIndex(c => c.id === a.category);
      const bIdx = STAT_CATEGORIES.findIndex(c => c.id === b.category);
      return aIdx - bIdx;
    });
    
    sortedBars.forEach((b) => {
      barTable.innerHTML += `
        <tr>
          <td>${escapeHtml(b.title)}</td>
          <td>${escapeHtml(b.value)}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="window.editBar(${b.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="window.deleteBar(${b.id})">Delete</button>
          </td>
        </tr>`;
    });
  }

  // Escape helper to avoid accidental HTML injection when rendering strings
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Add service
  serviceForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const file = document.getElementById("serviceImg").files[0];
      const heading = document.getElementById("serviceHeading").value.trim();
      const para = document.getElementById("servicePara").value.trim();

      if (!file || !heading || !para) throw new Error("Please fill all fields and select an image");

      const { publicUrl, fileName } = await uploadImage(file);

      const { data, error } = await window.supabase
        .from("services")
        .insert([{ heading, para, image_url: publicUrl, image_path: fileName }])
        .select()
        .single();

      if (error) throw error;

      showToast("Service added successfully!");
      serviceForm.reset();
      await refreshServices();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to add service", false);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Hardcoded statistic categories
  const STAT_CATEGORIES = [
    { id: "projects_completed", title: "Projects Completed" },
    { id: "current_projects", title: "Current Projects" },
    { id: "team_members", title: "Team Members" },
    { id: "machinery_inventory", title: "Machinery Inventory" }
  ];

  // Add bar (handle four fields for hardcoded categories)
  barForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const values = {
        projects_completed: document.getElementById("barValue1").value.trim(),
        current_projects: document.getElementById("barValue2").value.trim(),
        team_members: document.getElementById("barValue3").value.trim(),
        machinery_inventory: document.getElementById("barValue4").value.trim()
      };

      if (!values.projects_completed || !values.current_projects || !values.team_members || !values.machinery_inventory) {
        throw new Error("Please fill all fields");
      }

      // Upsert each statistic: delete old if exists, then insert new
      const inserts = STAT_CATEGORIES.map((cat, idx) => {
        const valueKey = Object.keys(values)[idx];
        return {
          category: cat.id,
          title: cat.title,
          value: values[valueKey]
        };
      });

      // First, delete all old stats
      const { error: deleteErr } = await window.supabase
        .from("progress_bars")
        .delete()
        .in("category", STAT_CATEGORIES.map(c => c.id));
      if (deleteErr) throw deleteErr;

      // Then insert the new ones
      const { error: insertErr } = await window.supabase
        .from("progress_bars")
        .insert(inserts);
      if (insertErr) throw insertErr;

      showToast("Statistics saved successfully!");
      barForm.reset();
      await refreshBars();
    } catch (err) {
      showToast(err.message || "Failed to save statistics", false);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Delete functions
  window.deleteService = async function (id) {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      // get record to remove file from storage
      const { data: rec, error: fetchErr } = await window.supabase
        .from("services")
        .select("image_path, image_url")
        .eq("id", id)
        .single();
      if (fetchErr && fetchErr.code !== "PGRST116") throw fetchErr;

      // Prefer deleting by stored image_path (more robust). Fall back to URL parsing for older records.
      const imagePath = rec?.image_path || (rec?.image_url ? rec.image_url.split("/service_images/")[1] : null);
      if (imagePath) {
        await window.supabase.storage.from("service_images").remove([imagePath]).catch((e) => console.warn(e));
      }

      const { error } = await window.supabase.from("services").delete().eq("id", id);
      if (error) throw error;
      showToast("Service deleted!");
      await refreshServices();
    } catch (err) {
      showToast("Failed to delete service: " + err.message, false);
    }
  };

  window.deleteBar = async function (id) {
    if (!confirm("Are you sure you want to delete this progress bar?")) return;
    try {
      const { error } = await window.supabase.from("progress_bars").delete().eq("id", id);
      if (error) throw error;
      showToast("Progress bar deleted!");
      await refreshBars();
    } catch (err) {
      showToast("Failed to delete progress bar: " + err.message, false);
    }
  };

  // Edit functions (open modal and submit handlers)
  window.editService = async function (id) {
    try {
      const { data, error } = await window.supabase.from("services").select("*").eq("id", id).single();
      if (error) throw error;
      document.getElementById("editServiceIndex").value = data.id;
      document.getElementById("editServiceHeading").value = data.heading;
      document.getElementById("editServiceParagraph").value = data.para;
      new bootstrap.Modal(document.getElementById("editServiceModal")).show();
    } catch (err) {
      showToast("Failed to load service: " + err.message, false);
    }
  };

  window.editBar = async function (id) {
    try {
      const { data, error } = await window.supabase.from("progress_bars").select("*").eq("id", id).single();
      if (error) throw error;
      document.getElementById("editBarIndex").value = data.id;
      document.getElementById("editBarTitle").value = data.title;
      document.getElementById("editBarValue").value = data.value;
      // Store category so we can update correctly
      document.getElementById("editBarIndex").dataset.category = data.category;
      new bootstrap.Modal(document.getElementById("editBarModal")).show();
    } catch (err) {
      showToast("Failed to load statistic: " + err.message, false);
    }
  };

  editServiceForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const id = document.getElementById("editServiceIndex").value;
    const heading = document.getElementById("editServiceHeading").value.trim();
    const para = document.getElementById("editServiceParagraph").value.trim();
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const { error } = await window.supabase.from("services").update({ heading, para }).eq("id", id);
      if (error) throw error;
      showToast("Service updated!");
      bootstrap.Modal.getInstance(document.getElementById("editServiceModal")).hide();
      await refreshServices();
    } catch (err) {
      showToast("Failed to update service: " + err.message, false);
    } finally {
      submitBtn.disabled = false;
    }
  });

  editBarForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const id = document.getElementById("editBarIndex").value;
    const value = document.getElementById("editBarValue").value.trim();
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      if (!value) throw new Error("Please enter a value");
      const { error } = await window.supabase.from("progress_bars").update({ value }).eq("id", id);
      if (error) throw error;
      showToast("Statistic updated!");
      bootstrap.Modal.getInstance(document.getElementById("editBarModal")).hide();
      await refreshBars();
    } catch (err) {
      showToast("Failed to update statistic: " + err.message, false);
    } finally {
      submitBtn.disabled = false;
    }
  });

  async function refreshServices() {
    const services = await loadServices();
    renderServices(services);
  }

  async function refreshBars() {
    const bars = await loadBars();
    renderBars(bars);
  }

  // Initial load
  (async function init() {
    await refreshServices();
    await refreshBars();
  })();
});
