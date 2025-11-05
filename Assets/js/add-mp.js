document.addEventListener("DOMContentLoaded", async function () {
  const machineryForm = document.getElementById("machineryForm");
  const plantsForm = document.getElementById("plantsForm");

  async function uploadImages(files, type) {
    const imageUrls = [];
    for (const file of files) {
      try {
        const fileName = `${Date.now()}_${type}_${file.name.replace(
          /\s+/g,
          "_"
        )}`;
        const { data, error } = await window.supabase.storage
          .from("mp-images")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) throw error;

        const {
          data: { publicUrl },
        } = window.supabase.storage.from("mp-images").getPublicUrl(fileName);

        imageUrls.push(publicUrl);
      } catch (error) {
        console.error("Upload error:", error);
        throw error;
      }
    }
    return imageUrls;
  }

  async function handleFormSubmit(e, type) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector("button");
    submitBtn.disabled = true;

    try {
      const title = form.querySelector('input[type="text"]').value.trim();
      const files = form.querySelector('input[type="file"]').files;

      if (!title || files.length === 0) {
        throw new Error("Please fill all fields and select at least one image");
      }

      // Upload images
      const imageUrls = await uploadImages(files, type);

      // Save to database
      const { data: item, error: itemError } = await window.supabase
        .from(type)
        .insert([{ title }])
        .select()
        .single();

      if (itemError) throw itemError;

      // Save image references
      const imageData = imageUrls.map((url) => ({
        [type === "machinery" ? "machinery_id" : "plant_id"]: item.id,
        image_url: url,
      }));

      const { error: imagesError } = await window.supabase
        .from(type === "machinery" ? "machinery_images" : "plant_images")
        .insert(imageData);

      if (imagesError) throw imagesError;

      showToast(`${type} added successfully!`);
      form.reset();
      await refreshList(type);
    } catch (err) {
      showToast(err.message || `Failed to add ${type}`, false);
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function loadEntries(type) {
    try {
      // Get all entries first
      const { data: entries, error: entriesError } = await window.supabase
        .from(type)
        .select("*")
        .order("created_at", { ascending: false });

      if (entriesError) throw entriesError;

      // Then get images for each entry
      const entriesWithImages = await Promise.all(
        entries.map(async (entry) => {
          const { data: images, error: imagesError } = await window.supabase
            .from(type === "machinery" ? "machinery_images" : "plant_images")
            .select("image_url")
            .eq(type === "machinery" ? "machinery_id" : "plant_id", entry.id);

          if (imagesError) throw imagesError;

          return {
            ...entry,
            images: images.map((img) => img.image_url),
          };
        })
      );

      return entriesWithImages;
    } catch (error) {
      console.error("Load error:", error);
      throw new Error(`Failed to load ${type}: ${error.message}`);
    }
  }

  function renderList(entries, containerId, type) {
    const container = document.getElementById(containerId);
    if (!entries.length) {
      container.innerHTML = `<p class="text-center">No ${type} added yet</p>`;
      return;
    }

    container.innerHTML = entries
      .map(
        (entry) => `
            <div class="entry-card">
                <h5>${entry.title}</h5>
                <div class="image-gallery">
                    ${entry.images
                      .map((img) => `<img src="${img}" alt="${entry.title}">`)
                      .join("")}
                </div>
                <div class="mt-2">
                    <button class="btn btn-warning btn-sm" onclick="editEntry('${type}', ${
          entry.id
        })">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteEntry('${type}', ${
          entry.id
        })">Delete</button>
                </div>
            </div>
        `
      )
      .join("");
  }

  window.deleteEntry = async function (type, id) {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const imageTable =
        type === "machinery" ? "machinery_images" : "plant_images";
      const foreignKey = type === "machinery" ? "machinery_id" : "plant_id";

      // 1️⃣ Fetch related images
      const { data: images, error: imagesError } = await window.supabase
        .from(imageTable)
        .select("image_url")
        .eq(foreignKey, id);

      if (imagesError) throw imagesError;

      // 2️⃣ Delete images from storage (if any)
      if (images && images.length > 0) {
        const deletePromises = images
          .map((img) => {
            // Extract correct relative path
            const relativePath = img.image_url.split("/mp-images/")[1];
            if (!relativePath) return null; // skip invalid URLs

            return window.supabase.storage
              .from("mp-images")
              .remove([relativePath]);
          })
          .filter(Boolean);

        await Promise.all(deletePromises);
      }

      // 3️⃣ Delete image records (if cascade isn’t set)
      await window.supabase.from(imageTable).delete().eq(foreignKey, id);

      // 4️⃣ Delete main record
      const { error: mainDeleteError } = await window.supabase
        .from(type)
        .delete()
        .eq("id", id);

      if (mainDeleteError) throw mainDeleteError;

      showToast(`${type} deleted successfully!`);
      await refreshList(type);
    } catch (err) {
      console.error(err);
      showToast(`Failed to delete ${type}: ` + err.message, false);
    }
  };

  window.editEntry = async function (type, id) {
    try {
      const { data: entry, error } = await window.supabase
        .from(type)
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      document.getElementById("editTitle").value = entry.title;
      document.getElementById("editKey").value = type;
      document.getElementById("editIndex").value = id;

      new bootstrap.Modal(document.getElementById("editModal")).show();
    } catch (err) {
      showToast(`Failed to load ${type}: ` + err.message, false);
    }
  };

  async function refreshList(type) {
    try {
      const entries = await loadEntries(type);
      renderList(entries, `${type}List`, type);
    } catch (err) {
      showToast(`Failed to refresh ${type} list: ` + err.message, false);
    }
  }

  function showToast(message, success = true) {
    const toast = new bootstrap.Toast(document.getElementById("toast"));
    const toastBody = document.getElementById("toastMessage");
    toastBody.textContent = message;
    document.getElementById("toast").classList.toggle("bg-success", success);
    document.getElementById("toast").classList.toggle("bg-danger", !success);
    toast.show();
  }

  // Event Listeners
  machineryForm.addEventListener("submit", (e) =>
    handleFormSubmit(e, "machinery")
  );
  plantsForm.addEventListener("submit", (e) => handleFormSubmit(e, "plants"));
  document
    .getElementById("editForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const submitBtn = this.querySelector("button");
      submitBtn.disabled = true;

      try {
        const type = document.getElementById("editKey").value;
        const id = document.getElementById("editIndex").value;
        const title = document.getElementById("editTitle").value.trim();

        const { error } = await window.supabase
          .from(type)
          .update({ title })
          .eq("id", id);

        if (error) throw error;

        showToast(`${type} updated successfully!`);
        bootstrap.Modal.getInstance(
          document.getElementById("editModal")
        ).hide();
        await refreshList(type);
      } catch (err) {
        showToast(`Failed to update: ` + err.message, false);
      } finally {
        submitBtn.disabled = false;
      }
    });

  // Initial load
  await refreshList("machinery");
  await refreshList("plants");
});
