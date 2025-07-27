document.addEventListener("DOMContentLoaded", async function() {
    const uploadForm = document.getElementById('uploadForm');
    const teamTable = document.querySelector('#teamTable tbody');

    async function uploadImage(file) {
        try {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            updateProgressBar(20);

            const { data, error } = await window.supabase.storage
                .from('team-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) throw error;
            updateProgressBar(70);

            const { data: { publicUrl } } = window.supabase.storage
                .from('team-images')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    async function loadTeamMembers() {
        try {
            const { data, error } = await window.supabase
                .from('team_members')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            teamTable.innerHTML = data.map(member => `
                <tr>
                    <td><img src="${member.image_url}" alt="${member.name}" style="width: 100px; height: 100px; object-fit: cover;"></td>
                    <td>${member.name}</td>
                    <td>${member.designation}</td>
                    <td>
                        <a href="${member.social_links.facebook}" target="_blank" class="btn btn-sm btn-primary me-1"><i class="fab fa-facebook"></i></a>
                        <a href="${member.social_links.twitter}" target="_blank" class="btn btn-sm btn-info me-1"><i class="fab fa-twitter"></i></a>
                        <a href="${member.social_links.linkedin}" target="_blank" class="btn btn-sm btn-dark"><i class="fab fa-linkedin"></i></a>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="editMember(${member.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMember(${member.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            showToast('Failed to load team members: ' + err.message, false);
        }
    }

    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const imageFile = document.getElementById('imageInput').files[0];
            const name = document.getElementById('nameInput').value.trim();
            const designation = document.getElementById('designationInput').value.trim();
            const facebook = document.getElementById('facebookInput').value.trim();
            const twitter = document.getElementById('twitterInput').value.trim();
            const linkedin = document.getElementById('linkedinInput').value.trim();

            if (!imageFile || !name || !designation) {
                throw new Error('Please fill all required fields');
            }

            const imageUrl = await uploadImage(imageFile);
            updateProgressBar(85);

            const { error } = await window.supabase
                .from('team_members')
                .insert([{
                    image_url: imageUrl,
                    name,
                    designation,
                    social_links: { facebook, twitter, linkedin }
                }]);

            if (error) throw error;

            showToast('Team member added successfully!');
            this.reset();
            updateProgressBar(100);
            await loadTeamMembers();

            setTimeout(() => updateProgressBar(0), 1000);
        } catch (err) {
            showToast(err.message || 'Failed to add team member', false);
            updateProgressBar(0);
        } finally {
            submitBtn.disabled = false;
        }
    });

    window.deleteMember = async function(id) {
        if (!confirm('Are you sure you want to delete this team member?')) return;

        try {
            const { data: member } = await window.supabase
                .from('team_members')
                .select('image_url')
                .eq('id', id)
                .single();

            // Delete image from storage
            const fileName = member.image_url.split('/').pop();
            await window.supabase.storage
                .from('team-images')
                .remove([fileName]);

            const { error } = await window.supabase
                .from('team_members')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Team member deleted successfully!');
            await loadTeamMembers();
        } catch (err) {
            showToast('Failed to delete team member: ' + err.message, false);
        }
    };

    window.editMember = async function(id) {
        try {
            const { data: member, error } = await window.supabase
                .from('team_members')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            document.getElementById('editId').value = id;
            document.getElementById('editName').value = member.name;
            document.getElementById('editDesignation').value = member.designation;
            document.getElementById('editFacebook').value = member.social_links.facebook;
            document.getElementById('editTwitter').value = member.social_links.twitter;
            document.getElementById('editLinkedin').value = member.social_links.linkedin;

            new bootstrap.Modal(document.getElementById('editModal')).show();
        } catch (err) {
            showToast('Failed to load team member: ' + err.message, false);
        }
    };

    document.getElementById('editForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const id = document.getElementById('editId').value;
            const updates = {
                name: document.getElementById('editName').value.trim(),
                designation: document.getElementById('editDesignation').value.trim(),
                social_links: {
                    facebook: document.getElementById('editFacebook').value.trim(),
                    twitter: document.getElementById('editTwitter').value.trim(),
                    linkedin: document.getElementById('editLinkedin').value.trim()
                }
            };

            const imageFile = document.getElementById('editImage').files[0];
            if (imageFile) {
                updates.image_url = await uploadImage(imageFile);
            }

            const { error } = await window.supabase
                .from('team_members')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            showToast('Team member updated successfully!');
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            await loadTeamMembers();
        } catch (err) {
            showToast('Failed to update team member: ' + err.message, false);
        } finally {
            submitBtn.disabled = false;
        }
    });

    function updateProgressBar(percent) {
        const progress = document.getElementById('uploadProgress');
        progress.style.width = percent + '%';
        progress.textContent = percent + '%';
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
    await loadTeamMembers();
});