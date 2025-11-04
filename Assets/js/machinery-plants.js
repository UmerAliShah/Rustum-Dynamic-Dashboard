document.addEventListener("DOMContentLoaded", async function() {
    const uploadForm = document.getElementById('uploadForm');
    const tableBody = document.querySelector('#sliderTable tbody');
    const progressBar = document.getElementById('uploadProgress');

    // Upload video to Supabase Storage
    async function uploadVideo(file) {
        try {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            updateProgressBar(20);

            const { data, error } = await window.supabase.storage
                .from('machinery-videos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) throw error;
            updateProgressBar(70);

            const { data: { publicUrl } } = window.supabase.storage
                .from('machinery-videos')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    // Load entries
    async function loadEntries() {
        try {
            const { data, error } = await window.supabase
                .from('machinery_plants')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            tableBody.innerHTML = data.map(entry => `
                <tr>
                    <td><video src="${entry.video_url}" controls style="width: 150px;"></video></td>
                    <td>${entry.heading}</td>
                    <td>${entry.description}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="editEntry(${entry.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            showToast('Failed to load entries: ' + err.message, false);
        }
    }

    // Form submission
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const videoFile = document.getElementById('videoInput').files[0];
            const heading = document.getElementById('headingInput').value.trim();
            const description = document.getElementById('paraInput').value.trim();

            if (!videoFile || !heading || !description) {
                throw new Error('Please fill all fields');
            }

            const videoUrl = await uploadVideo(videoFile);
            updateProgressBar(85);

            const { error } = await window.supabase
                .from('machinery_plants')
                .insert([{ 
                    video_url: videoUrl,
                    heading,
                    description
                }]);

            if (error) throw error;

            showToast('Content added successfully!');
            this.reset();
            updateProgressBar(100);
            await loadEntries();

            setTimeout(() => updateProgressBar(0), 1000);
        } catch (err) {
            showToast(err.message || 'Failed to save content', false);
            updateProgressBar(0);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Delete entry
    window.deleteEntry = async function(id) {
        if (!confirm('Are you sure you want to delete this entry?')) return;

        try {
            const { data: entry } = await window.supabase
                .from('machinery_plants')
                .select('video_url')
                .eq('id', id)
                .single();

            // Delete video from storage
            const fileName = entry.video_url.split('/').pop();
            await window.supabase.storage
                .from('machinery-videos')
                .remove([fileName]);

            const { error } = await window.supabase
                .from('machinery_plants')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Entry deleted successfully!');
            await loadEntries();
        } catch (err) {
            showToast('Failed to delete entry: ' + err.message, false);
        }
    };

    // Edit entry
    window.editEntry = async function(id) {
        try {
            const { data: entry, error } = await window.supabase
                .from('machinery_plants')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            document.getElementById('editRowIndex').value = id;
            document.getElementById('editHeading').value = entry.heading;
            document.getElementById('editParagraph').value = entry.description;

            new bootstrap.Modal(document.getElementById('editModal')).show();
        } catch (err) {
            showToast('Failed to load entry: ' + err.message, false);
        }
    };

    // Handle edit form submission
    document.getElementById('editForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const id = document.getElementById('editRowIndex').value;
            const updates = {
                heading: document.getElementById('editHeading').value.trim(),
                description: document.getElementById('editParagraph').value.trim()
            };

            const videoFile = document.getElementById('editVideoInput').files[0];
            if (videoFile) {
                updates.video_url = await uploadVideo(videoFile);
            }

            const { error } = await window.supabase
                .from('machinery_plants')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            showToast('Entry updated successfully!');
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            await loadEntries();
        } catch (err) {
            showToast('Failed to update entry: ' + err.message, false);
        } finally {
            submitBtn.disabled = false;
        }
    });

    function updateProgressBar(percent) {
        progressBar.style.width = percent + '%';
        progressBar.textContent = percent + '%';
    }

    function showToast(message, success = true) {
        const toastEl = document.getElementById('uploadToast');
        const toastMsg = document.getElementById('toastMessage');
        toastMsg.textContent = message;
        toastEl.classList.toggle('bg-success', success);
        toastEl.classList.toggle('bg-danger', !success);
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

    // Initial load
    await loadEntries();
});