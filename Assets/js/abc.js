document.addEventListener("DOMContentLoaded", async function () {
    const form = document.getElementById('imgTextForm');
    const table = document.querySelector('#imgTextTable tbody');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Upload image to Supabase Storage
    async function uploadImage(file, index) {
        try {
            const fileName = `${Date.now()}_image${index}_${file.name}`;
            const { data, error } = await window.supabase.storage
                .from('abc-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl } } = window.supabase.storage
                .from('abc-images')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error(`Error uploading image ${index}:`, error);
            throw error;
        }
    }

    // Load entries from Supabase
    async function loadEntries() {
        try {
            const { data, error } = await window.supabase
                .from('abc_content')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            table.innerHTML = data.map(entry => `
                <tr>
                    <td><img src="${entry.image1_url}" width="70"></td>
                    <td><img src="${entry.image2_url}" width="70"></td>
                    <td>
                        <p>${entry.paragraph1}</p>
                        <p>${entry.paragraph2}</p>
                        <p>${entry.paragraph3}</p>
                        <p>${entry.paragraph4}</p>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editEntry(${entry.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            showToast('Failed to load entries: ' + err.message, false);
        }
    }

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        try {
            const img1 = document.getElementById('image1').files[0];
            const img2 = document.getElementById('image2').files[0];
            
            if (!img1 || !img2) {
                throw new Error('Please select both images');
            }

            // Show progress in toast
            showToast('Uploading images...', true);

            // Upload images
            const [image1_url, image2_url] = await Promise.all([
                uploadImage(img1, 1),
                uploadImage(img2, 2)
            ]);

            showToast('Saving content...', true);

            // Get paragraphs
            const paragraphs = Array.from(document.querySelectorAll('.para'))
                .map(el => el.value.trim());

            // Validate paragraphs
            if (paragraphs.some(p => !p)) {
                throw new Error('Please fill all paragraphs');
            }

            // Save to database
            const { error } = await window.supabase
                .from('abc_content')
                .insert([{
                    image1_url,
                    image2_url,
                    paragraph1: paragraphs[0],
                    paragraph2: paragraphs[1],
                    paragraph3: paragraphs[2],
                    paragraph4: paragraphs[3]
                }]);

            if (error) {
                console.error('Database error:', error);
                throw new Error(error.message);
            }

            showToast('Content saved successfully!', true);
            form.reset();
            await loadEntries();
        } catch (err) {
            console.error('Save error:', err);
            showToast(err.message || 'Failed to save content', false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add';
        }
    });

    // Delete entry
    window.deleteEntry = async function(id) {
        if (!confirm('Are you sure you want to delete this entry?')) return;

        try {
            const { data: entry } = await window.supabase
                .from('abc_content')
                .select('image1_url, image2_url')
                .eq('id', id)
                .single();

            // Delete images from storage
            const image1Name = entry.image1_url.split('/').pop();
            const image2Name = entry.image2_url.split('/').pop();

            await Promise.all([
                window.supabase.storage.from('abc-images').remove([image1Name]),
                window.supabase.storage.from('abc-images').remove([image2Name])
            ]);

            // Delete database entry
            const { error } = await window.supabase
                .from('abc_content')
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
                .from('abc_content')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            document.getElementById('editIndex').value = id;
            document.querySelectorAll('.edit-para').forEach((el, idx) => {
                el.value = entry[`paragraph${idx + 1}`];
            });

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
            const id = document.getElementById('editIndex').value;
            const img1 = document.getElementById('editImg1').files[0];
            const img2 = document.getElementById('editImg2').files[0];
            const paras = Array.from(document.querySelectorAll('.edit-para')).map(el => el.value.trim());

            const updates = {
                paragraph1: paras[0],
                paragraph2: paras[1],
                paragraph3: paras[2],
                paragraph4: paras[3]
            };

            // Upload new images if provided
            if (img1) updates.image1_url = await uploadImage(img1, 1);
            if (img2) updates.image2_url = await uploadImage(img2, 2);

            const { error } = await window.supabase
                .from('abc_content')
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

    // Toast notification
    function showToast(message, success = true) {
        const toastEl = document.getElementById('toastNotification');
        const toastBody = toastEl.querySelector('.toast-body');
        toastBody.textContent = message;
        toastEl.classList.toggle('bg-success', success);
        toastEl.classList.toggle('bg-danger', !success);
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

    // Initial load
    await loadEntries();
});