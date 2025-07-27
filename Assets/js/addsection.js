document.addEventListener("DOMContentLoaded", async function () {
    const uploadForm = document.getElementById("uploadForm");
    const sliderTableBody = document.getElementById("sliderTableBody");
    let editingRow = null;

    // Upload images to Supabase Storage
    async function uploadImage(file, index) {
        try {
            const fileName = `${Date.now()}_image${index}_${file.name}`;
            console.log(`Uploading image ${index}:`, fileName);

            const { data, error } = await window.supabase.storage
                .from('section-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true // Changed to true to allow overwrites
                });

            if (error) {
                console.error(`Storage error for image ${index}:`, error);
                throw error;
            }

            const { data: { publicUrl } } = window.supabase.storage
                .from('section-images')
                .getPublicUrl(fileName);

            console.log(`Successfully uploaded image ${index}:`, publicUrl);
            return publicUrl;

        } catch (error) {
            console.error(`Error uploading image ${index}:`, error);
            throw new Error(`Failed to upload image ${index}: ${error.message}`);
        }
    }

    // Load entries from Supabase
    async function loadEntries() {
        try {
            const { data, error } = await window.supabase
                .from('sections')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            sliderTableBody.innerHTML = data.map(entry => `
                <tr data-id="${entry.id}">
                    <td><img src="${entry.image1_url}" style="width: 100px"></td>
                    <td><img src="${entry.image2_url}" style="width: 100px"></td>
                    <td>${entry.heading}</td>
                    <td>${entry.sub1}</td><td>${entry.para1}</td>
                    <td>${entry.sub2}</td><td>${entry.para2}</td>
                    <td>${entry.sub3}</td><td>${entry.para3}</td>
                    <td>${entry.sub4}</td><td>${entry.para4}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="editRow(${entry.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteRow(${entry.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error("Error loading entries:", err);
            alert("Failed to load entries");
        }
    }

    // Add this toast function at the top level
    function showToast(message, success = true) {
        const toastEl = document.getElementById("uploadToast");
        const toastMsg = document.getElementById("toastMessage");
        toastMsg.textContent = message;
        toastEl.classList.toggle("bg-success", success);
        toastEl.classList.toggle("bg-danger", !success);
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

    // Handle form submission
    uploadForm.addEventListener("submit", async function(e) {
        e.preventDefault();

        try {
            const img1 = document.getElementById("imageInput1").files[0];
            const img2 = document.getElementById("imageInput2").files[0];
            
            // Validate form fields
            const heading = document.getElementById("headingInput").value.trim();
            const sub1 = document.getElementById("sub1").value.trim();
            const para1 = document.getElementById("para1").value.trim();
            const sub2 = document.getElementById("sub2").value.trim();
            const para2 = document.getElementById("para2").value.trim();
            const sub3 = document.getElementById("sub3").value.trim();
            const para3 = document.getElementById("para3").value.trim();
            const sub4 = document.getElementById("sub4").value.trim();
            const para4 = document.getElementById("para4").value.trim();

            // Check if all fields are filled
            if (!img1 || !img2 || !heading || !sub1 || !para1 || !sub2 || !para2 || 
                !sub3 || !para3 || !sub4 || !para4) {
                alert("Please fill all fields");
                return;
            }

            // Upload both images
            const [image1_url, image2_url] = await Promise.all([
                uploadImage(img1, 1),
                uploadImage(img2, 2)
            ]);

            console.log("Form Data before insert:", {
                image1_url,
                image2_url,
                heading,
                sub1,
                para1,
                sub2,
                para2,
                sub3,
                para3,
                sub4,
                para4
            });

            // Save to Supabase
            const { data, error } = await window.supabase
                .from('sections')
                .insert([{
                    image1_url,
                    image2_url,
                    heading,
                    sub1,
                    para1,
                    sub2,
                    para2,
                    sub3,
                    para3,
                    sub4,
                    para4
                }])
                .select();

            if (error) {
                console.error("Insert error:", error);
                throw error;
            }

            console.log("Inserted data:", data);
            showToast("Entry added successfully!", true);
            uploadForm.reset();
            await loadEntries();

        } catch (err) {
            console.error("Error saving entry:", err);
            showToast("Failed to save entry: " + err.message, false);
        }
    });

    // Delete entry
    window.deleteRow = async function(id) {
        if (!confirm("Are you sure you want to delete this entry?")) return;

        try {
            // First get the entry to get image URLs
            const { data: entry, error: fetchError } = await window.supabase
                .from('sections')
                .select('image1_url, image2_url')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            // Extract filenames from URLs
            const image1Name = entry.image1_url.split('/').pop();
            const image2Name = entry.image2_url.split('/').pop();

            // Delete images from storage
            const storagePromises = [
                window.supabase.storage
                    .from('section-images')
                    .remove([image1Name]),
                window.supabase.storage
                    .from('section-images')
                    .remove([image2Name])
            ];

            await Promise.all(storagePromises);

            // Delete database entry
            const { error: deleteError } = await window.supabase
                .from('sections')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            showToast("Entry deleted successfully!", true);
            await loadEntries(); // Reload the table

        } catch (err) {
            console.error("Error deleting entry:", err);
            showToast("Failed to delete entry: " + err.message, false);
        }
    };

    // Edit entry
    window.editRow = async function(id) {
        try {
            const { data, error } = await window.supabase
                .from('sections')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            // Fill modal form
            document.getElementById("editHeading").value = data.heading;
            document.getElementById("editSub1").value = data.sub1;
            document.getElementById("editPara1").value = data.para1;
            document.getElementById("editSub2").value = data.sub2;
            document.getElementById("editPara2").value = data.para2;
            document.getElementById("editSub3").value = data.sub3;
            document.getElementById("editPara3").value = data.para3;
            document.getElementById("editSub4").value = data.sub4;
            document.getElementById("editPara4").value = data.para4;
            document.getElementById("editRowIndex").value = id;

            new bootstrap.Modal(document.getElementById("editModal")).show();
        } catch (err) {
            console.error("Error loading entry for edit:", err);
            alert("Failed to load entry for editing");
        }
    };

    // Handle edit form submission
    document.getElementById("editForm").addEventListener("submit", async function(e) {
        e.preventDefault();
        const id = document.getElementById("editRowIndex").value;

        try {
            const { error } = await window.supabase
                .from('sections')
                .update({
                    heading: document.getElementById("editHeading").value,
                    sub1: document.getElementById("editSub1").value,
                    para1: document.getElementById("editPara1").value,
                    sub2: document.getElementById("editSub2").value,
                    para2: document.getElementById("editPara2").value,
                    sub3: document.getElementById("editSub3").value,
                    para3: document.getElementById("editPara3").value,
                    sub4: document.getElementById("editSub4").value,
                    para4: document.getElementById("editPara4").value
                })
                .eq('id', id);

            if (error) throw error;

            showToast("Entry updated successfully!", true);
            bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
            await loadEntries();

        } catch (err) {
            console.error("Error updating entry:", err);
            showToast("Failed to update entry: " + err.message, false);
        }
    });

    // Initial load
    await loadEntries();
});