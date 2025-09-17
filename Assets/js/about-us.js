document.addEventListener("DOMContentLoaded", async function () {
  const uploadForm = document.getElementById("uploadForm");
  const tableBody = document.querySelector("#sliderTable tbody");

  // Upload video to Supabase Storage
  async function uploadVideo(file) {
    try {
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const { data, error } = await window.supabase.storage
        .from("about_us_videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = window.supabase.storage
        .from("about_us_videos")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      throw err;
    }
  }

  // Load About Us entries
  async function loadAboutUs() {
    try {
      const { data, error } = await window.supabase
        .from("about_us_new")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      renderTable(data);
    } catch (err) {
      showToast("Failed to load data: " + err.message, false);
    }
  }

  // Render table rows
  function renderTable(entries) {
    tableBody.innerHTML = entries
      .map(
        (entry) => `
        <tr>
          <td><video src="${entry.video_url}" controls style="max-width:150px"></video></td>
          <td>${entry.heading}</td>
          <td>${entry.paragraph}</td>
          <td>
            <button class="btn btn-sm btn-warning" onclick="editEntry(${entry.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">Delete</button>
          </td>
        </tr>`
      )
      .join("");
  }

  // Handle form submit
  uploadForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const videoFile = document.getElementById("videoInput").files[0];
      const heading = document.getElementById("headingInput").value.trim();
      const paragraph = document.getElementById("paraInput").value.trim();

      if (!videoFile || !heading || !paragraph) {
        throw new Error("Please fill all fields and upload a video");
      }

      // Upload video to storage
      const videoUrl = await uploadVideo(videoFile);

      // Insert into table
      const { error } = await window.supabase.from("about_us_new").insert([
        {
          video_url: videoUrl,
          heading,
          paragraph,
        },
      ]);

      if (error) throw error;

      showToast("Entry added successfully!");
      uploadForm.reset();
      await loadAboutUs();
    } catch (err) {
      console.error("Submit error:", err);
      showToast(err.message || "Failed to add entry", false);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Delete entry
  window.deleteEntry = async function (id) {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      // Get entry to remove video from storage too
      const { data: entry } = await window.supabase
        .from("about_us_new")
        .select("video_url")
        .eq("id", id)
        .single();

      if (entry?.video_url) {
        const fileName = entry.video_url.split("/").pop();
        await window.supabase.storage.from("about_us_videos").remove([fileName]);
      }

      const { error } = await window.supabase.from("about_us_new").delete().eq("id", id);
      if (error) throw error;

      showToast("Entry deleted successfully!");
      await loadAboutUs();
    } catch (err) {
      showToast("Failed to delete entry: " + err.message, false);
    }
  };

  // Edit entry
  window.editEntry = async function (id) {
    try {
      const { data: entry, error } = await window.supabase
        .from("about_us_new")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      document.getElementById("editRowIndex").value = id;
      document.getElementById("editHeading").value = entry.heading;
      document.getElementById("editParagraph").value = entry.paragraph;

      new bootstrap.Modal(document.getElementById("editModal")).show();
    } catch (err) {
      showToast("Failed to load entry: " + err.message, false);
    }
  };

  // Handle edit form submit
  document.getElementById("editForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const id = document.getElementById("editRowIndex").value;
      const heading = document.getElementById("editHeading").value.trim();
      const paragraph = document.getElementById("editParagraph").value.trim();
      const newVideoFile = document.getElementById("editVideoInput").files[0];

      let videoUrl = null;

      if (newVideoFile) {
        videoUrl = await uploadVideo(newVideoFile);
      }

      const updateData = { heading, paragraph };
      if (videoUrl) updateData.video_url = videoUrl;

      const { error } = await window.supabase
        .from("about_us_new")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      showToast("Entry updated successfully!");
      bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
      await loadAboutUs();
    } catch (err) {
      showToast("Failed to update entry: " + err.message, false);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Initial load
  await loadAboutUs();
});
