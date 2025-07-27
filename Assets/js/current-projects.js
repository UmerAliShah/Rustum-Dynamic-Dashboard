document.addEventListener("DOMContentLoaded", async function () {
    const uploadForm = document.getElementById('uploadForm');
    const tableBody = document.querySelector('#sliderTable tbody');
    const progressBar = document.getElementById('uploadProgress');

    // Upload video to Supabase Storage
    async function uploadVideo(file) {
        try {
            const fileName = `${Date.now()}_${file.name}`;
            updateProgressBar(10);

            const { data, error } = await window.supabase.storage
                .from('project-videos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) throw error;
            updateProgressBar(70);

            const { data: { publicUrl } } = window.supabase.storage
                .from('project-videos')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    // Load entries from database
    async function loadEntries() {
        try {
            const { data, error } = await window.supabase
                .from('current_projects')
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

    // Handle form submission
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

            // Upload video
            const videoUrl = await uploadVideo(videoFile);
            updateProgressBar(80);

            // Save to database
            const { error } = await window.supabase
                .from('current_projects')
                .insert([{
                    video_url: videoUrl,
                    heading,
                    description
                }]);

            if (error) throw error;

            showToast('Project added successfully!');
            this.reset();
            updateProgressBar(100);
            await loadEntries();

            setTimeout(() => updateProgressBar(0), 1000);
        } catch (err) {
            console.error('Save error:', err);
            showToast(err.message || 'Failed to save project', false);
            updateProgressBar(0);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Delete entry
    window.deleteEntry = async function(id) {
        if (!confirm('Are you sure you want to delete this project?')) return;

        try {
            const { data: project } = await window.supabase
                .from('current_projects')
                .select('video_url')
                .eq('id', id)
                .single();

            // Delete video from storage
            const fileName = project.video_url.split('/').pop();
            await window.supabase.storage
                .from('project-videos')
                .remove([fileName]);

            // Delete database entry
            const { error } = await window.supabase
                .from('current_projects')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Project deleted successfully!');
            await loadEntries();
        } catch (err) {
            showToast('Failed to delete project: ' + err.message, false);
        }
    };

    // Edit entry
    window.editEntry = async function(id) {
        try {
            const { data: project, error } = await window.supabase
                .from('current_projects')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            document.getElementById('editRowIndex').value = id;
            document.getElementById('editHeading').value = project.heading;
            document.getElementById('editParagraph').value = project.description;

            new bootstrap.Modal(document.getElementById('editModal')).show();
        } catch (err) {
            showToast('Failed to load project: ' + err.message, false);
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
                .from('current_projects')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            showToast('Project updated successfully!');
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            await loadEntries();
        } catch (err) {
            showToast('Failed to update project: ' + err.message, false);
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