document.addEventListener("DOMContentLoaded", async function () {
    const testimonialForm = document.getElementById('testimonialForm');
    const testimonialTable = document.querySelector('#testimonialTable tbody');
    const logoForm = document.getElementById('logoForm');
    const logoTable = document.querySelector('#logoTable tbody');

    // Upload image to Supabase Storage
    async function uploadImage(file, bucket) {
        try {
            if (!file) throw new Error('No file selected');
            
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            console.log(`Attempting to upload to bucket: ${bucket}`);

            const { data, error } = await window.supabase.storage
                .from(bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Storage error:', error);
                throw error;
            }

            const { data: urlData } = window.supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            if (!urlData?.publicUrl) {
                throw new Error('Failed to get public URL');
            }

            return urlData.publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    // Load testimonials from Supabase
    async function loadTestimonials() {
        const { data, error } = await window.supabase
            .from('testimonials')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            showToast('Failed to load testimonials', false);
            return;
        }

        testimonialTable.innerHTML = data.map(item => `
            <tr>
                <td><img src="${item.image_url}" width="70"></td>
                <td>${item.name}</td>
                <td>${item.post}</td>
                <td>${item.description}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editTestimonial(${item.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTestimonial(${item.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    // Load logos from Supabase
    async function loadLogos() {
        const { data, error } = await window.supabase
            .from('logos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            showToast('Failed to load logos', false);
            return;
        }

        logoTable.innerHTML = data.map(logo => `
            <tr>
                <td><img src="${logo.image_url}" width="70"></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteLogo(${logo.id})">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    // Add testimonial
    testimonialForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            const imgFile = document.querySelector('.testimonial-img').files[0];
            if (!imgFile) {
                showToast('Please select an image', false);
                return;
            }

            // Show loading state
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';

            // Upload image first
            const imageUrl = await uploadImage(imgFile, 'testimonial-images');
            console.log('Image uploaded:', imageUrl);

            // Then save to database
            const { error } = await window.supabase
                .from('testimonials')
                .insert([{
                    image_url: imageUrl,
                    name: document.querySelector('.testimonial-name').value.trim(),
                    post: document.querySelector('.testimonial-post').value.trim(),
                    description: document.querySelector('.testimonial-desc').value.trim()
                }]);

            if (error) throw error;

            showToast('Testimonial added successfully!');
            this.reset();
            await loadTestimonials();
        } catch (err) {
            console.error('Error:', err);
            showToast(err.message || 'Failed to add testimonial', false);
        } finally {
            // Reset button state
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add';
        }
    });

    // Add logo
    logoForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const imgFile = document.querySelector('.logo-img').files[0];

        try {
            const imageUrl = await uploadImage(imgFile, 'logo-images');
            
            const { error } = await window.supabase
                .from('logos')
                .insert([{ image_url: imageUrl }]);

            if (error) throw error;

            showToast('Logo added successfully!');
            logoForm.reset();
            await loadLogos();
        } catch (err) {
            showToast('Failed to add logo: ' + err.message, false);
        }
    });

    // Delete testimonial
    window.deleteTestimonial = async function(id) {
        if (!confirm('Are you sure you want to delete this testimonial?')) return;

        try {
            const { data: testimonial } = await window.supabase
                .from('testimonials')
                .select('image_url')
                .eq('id', id)
                .single();

            const fileName = testimonial.image_url.split('/').pop();
            await window.supabase.storage
                .from('testimonial-images')
                .remove([fileName]);

            const { error } = await window.supabase
                .from('testimonials')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Testimonial deleted successfully!');
            await loadTestimonials();
        } catch (err) {
            showToast('Failed to delete testimonial: ' + err.message, false);
        }
    };

    // Delete logo
    window.deleteLogo = async function(id) {
        if (!confirm('Are you sure you want to delete this logo?')) return;

        try {
            const { data: logo } = await window.supabase
                .from('logos')
                .select('image_url')
                .eq('id', id)
                .single();

            const fileName = logo.image_url.split('/').pop();
            await window.supabase.storage
                .from('logo-images')
                .remove([fileName]);

            const { error } = await window.supabase
                .from('logos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Logo deleted successfully!');
            await loadLogos();
        } catch (err) {
            showToast('Failed to delete logo: ' + err.message, false);
        }
    };

    // Edit testimonial
    window.editTestimonial = async function(id) {
        const { data: testimonial, error } = await window.supabase
            .from('testimonials')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            showToast('Failed to load testimonial details', false);
            return;
        }

        document.getElementById('editTestimonialIndex').value = id;
        document.getElementById('editTestimonialName').value = testimonial.name;
        document.getElementById('editTestimonialPost').value = testimonial.post;
        document.getElementById('editTestimonialDesc').value = testimonial.description;
        new bootstrap.Modal(document.getElementById('editTestimonialModal')).show();
    };

    // Handle edit form submission
    document.getElementById('editTestimonialForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const id = document.getElementById('editTestimonialIndex').value;
        const newImg = document.getElementById('editTestimonialImg').files[0];
        
        try {
            const updates = {
                name: document.getElementById('editTestimonialName').value,
                post: document.getElementById('editTestimonialPost').value,
                description: document.getElementById('editTestimonialDesc').value
            };

            if (newImg) {
                const imageUrl = await uploadImage(newImg, 'testimonial-images');
                updates.image_url = imageUrl;
            }

            const { error } = await window.supabase
                .from('testimonials')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            showToast('Testimonial updated successfully!');
            bootstrap.Modal.getInstance(document.getElementById('editTestimonialModal')).hide();
            await loadTestimonials();
        } catch (err) {
            showToast('Failed to update testimonial: ' + err.message, false);
        }
    });

    // Toast notification function
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
    await loadTestimonials();
    await loadLogos();
});