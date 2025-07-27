document.addEventListener("DOMContentLoaded", async function () {
  const tableBody = document.querySelector("#sliderTable tbody");
  const uploadForm = document.getElementById("uploadForm");
  const progressBar = document.getElementById("uploadProgress");

  // Load existing entries from Supabase
  async function loadEntries() {
    const { data, error } = await window.supabase
      .from("slider_entries")
      .select("*")
      .order("id", { ascending: false });

    tableBody.innerHTML = "";
    if (error) {
      tableBody.innerHTML = `<tr><td colspan="5">Error loading entries</td></tr>`;
      return;
    }
    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5">No entries found</td></tr>`;
      return;
    }
    data.forEach((entry, idx) => {
      tableBody.innerHTML += `
        <tr>
          <td><video src="${entry.video_url}" controls style="width: 150px;"></video></td>
          <td>${entry.heading}</td>
          <td>${entry.subheading}</td>
          <td>${entry.paragraph}</td>
          <td>
            <button class="btn btn-sm btn-primary me-1" onclick="editRow(${entry.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRow(${entry.id})">Delete</button>
          </td>
        </tr>
      `;
    });
  }

  // Add this new function at the top level
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Upload video to Supabase Storage
  // Update the uploadVideo function
  async function uploadVideo(file) {
    try {
      const fileName = `${Date.now()}_${file.name}`;

      // Upload the file
      const { data, error } = await window.supabase.storage
        .from("slider-videos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get the public URL
      const {
        data: { publicUrl },
      } = window.supabase.storage.from("slider-videos").getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      throw error;
    }
  }

  // Handle form submit
  // Update the form submit handler
  uploadForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const videoFile = document.getElementById("videoInput").files[0];
    const heading = document.getElementById("headingInput").value.trim();
    const subheading = document.getElementById("subHeadingInput").value.trim();
    const para = document.getElementById("paraInput").value.trim();

    if (!videoFile || !heading || !subheading || !para) {
      showToast("Please fill all fields", false);
      return;
    }

    try {
      // Start upload
      await updateProgressBar(10);

      // Upload video - wait for completion
      const videoUrl = await uploadVideo(videoFile);
      await updateProgressBar(70);

      // Save to database - wait for completion
      const { data, error: insertError } = await window.supabase
        .from("slider_entries")
        .insert([
          {
            video_url: videoUrl,
            heading,
            subheading,
            paragraph: para,
          },
        ])
        .select();

      if (insertError) throw insertError;

      // Wait for form reset and entries to load
      await Promise.all([
        loadEntries(),
        new Promise((resolve) => {
          uploadForm.reset();
          updateProgressBar(100);
          showToast("Upload successful!");
          setTimeout(() => {
            updateProgressBar(0);
            resolve();
          }, 1000);
        }),
      ]);
    } catch (err) {
      console.error("Upload failed:", err);
      showToast(`Upload failed: ${err.message}`, false);
      await updateProgressBar(0);
    }
  });

  // Update the loadEntries function to show more debug info
  async function loadEntries() {
    console.log("Loading entries...");
    const { data, error } = await window.supabase
      .from("slider_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading entries:", error);
      tableBody.innerHTML = `<tr><td colspan="5">Error loading entries: ${error.message}</td></tr>`;
      return;
    }

    console.log("Loaded entries:", data);

    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5">No entries found</td></tr>`;
      return;
    }

    tableBody.innerHTML = data
      .map(
        (entry) => `
        <tr>
            <td><video src="${
              entry.video_url
            }" controls style="width: 150px;"></video></td>
            <td>${entry.heading || ""}</td>
            <td>${entry.subheading || ""}</td>
            <td>${entry.paragraph || ""}</td>
            <td>
                <button class="btn btn-sm btn-primary me-1" onclick="editRow(${
                  entry.id
                })">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRow(${
                  entry.id
                })">Delete</button>
            </td>
        </tr>
    `
      )
      .join("");
  }
  // Update the updateProgressBar function to return a Promise
  function updateProgressBar(percent) {
    return new Promise((resolve) => {
      progressBar.style.width = percent + "%";
      progressBar.textContent = percent + "%";
      // Add a small delay to make progress visible
      setTimeout(resolve, 100);
    });
  }

  // Show toast
  window.showToast = function (message, success = true) {
    const toastEl = document.getElementById("uploadToast");
    const toastMsg = document.getElementById("toastMessage");
    toastMsg.textContent = message;
    toastEl.classList.toggle("bg-success", success);
    toastEl.classList.toggle("bg-danger", !success);
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
  };

  // Delete entry and its associated video
  window.deleteRow = async function (id) {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      // First get the entry to get the video URL
      const { data, error: fetchError } = await window.supabase
        .from("slider_entries")
        .select("video_url")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Extract filename from video URL
      const videoUrl = data.video_url;
      const fileName = videoUrl.split("/").pop(); // Gets the last part of the URL

      // Delete from storage bucket
      const { error: storageError } = await window.supabase.storage
        .from("slider-videos")
        .remove([fileName]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await window.supabase
        .from("slider_entries")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      showToast("Entry and video deleted successfully!", true);
      await loadEntries();
    } catch (err) {
      console.error("Delete failed:", err);
      showToast(`Delete failed: ${err.message}`, false);
    }
  };

  // Edit entry (basic modal logic, you can expand as needed)
  window.editRow = async function (id) {
    // Fetch entry by id
    const { data, error } = await window.supabase
      .from("slider_entries")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      showToast("Error loading entry", false);
      return;
    }
    // Fill modal fields
    document.getElementById("editRowIndex").value = id;
    document.getElementById("editHeading").value = data.heading;
    document.getElementById("editSubheading").value = data.subheading;
    document.getElementById("editParagraph").value = data.paragraph;
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById("editModal"));
    modal.show();
  };

  // Save edited changes
  document
    .getElementById("editForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const id = document.getElementById("editRowIndex").value;
      const heading = document.getElementById("editHeading").value;
      const subheading = document.getElementById("editSubheading").value;
      const para = document.getElementById("editParagraph").value;
      const newVideoFile = document.getElementById("editVideoInput").files[0];

      let videoUrl = null;
      if (newVideoFile) {
        try {
          videoUrl = await uploadVideo(newVideoFile);
        } catch (err) {
          showToast("Video upload failed: " + err.message, false);
          return;
        }
      }

      const updateData = { heading, subheading, paragraph: para };
      if (videoUrl) updateData.video_url = videoUrl;

      const { error } = await window.supabase
        .from("slider_entries")
        .update(updateData)
        .eq("id", id);

      if (error) {
        showToast("Update failed: " + error.message, false);
      } else {
        showToast("Updated successfully!");
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("editModal")
        );
        modal.hide();
        loadEntries();
      }
    });

  // Initial load
  loadEntries();
});
