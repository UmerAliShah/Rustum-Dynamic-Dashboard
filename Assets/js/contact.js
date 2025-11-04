document.addEventListener("DOMContentLoaded", async function() {
    const contactForm = document.getElementById("contactForm");
    const preview = document.getElementById("preview");
    let currentContactId = null;

    async function loadContactInfo() {
        try {
            const { data, error } = await window.supabase
                .from('contact_info')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1);

            console.log('Load result:', { data, error });

            if (error) throw error;

            if (data && data.length > 0) {
                currentContactId = data[0].id;
                updatePreview(data[0]);
                preview.style.display = 'block';
                contactForm.style.display = 'none';
            } else {
                preview.style.display = 'none';
                contactForm.style.display = 'block';
            }
        } catch (err) {
            console.error('Load error:', err);
            showToast('Failed to load contact information', false);
        }
    }

    function updatePreview(data) {
        document.getElementById('mapPreview').src = data.map_link;
        document.getElementById('previewEmail').textContent = data.email;
        document.getElementById('previewPhone').textContent = data.phone;
        document.getElementById('previewAddress').textContent = data.address;
    }

    window.deleteContact = async function() {
        if (!currentContactId) {
            showToast('No contact information to delete', false);
            return;
        }

        if (!confirm('Are you sure you want to delete contact information?')) {
            return;
        }

        try {
            console.log('Deleting contact with ID:', currentContactId);

            const { error } = await window.supabase
                .from('contact_info')
                .delete()
                .eq('id', currentContactId);

            if (error) throw error;

            showToast('Contact information deleted successfully!');
            currentContactId = null;
            
            // Clear preview
            document.getElementById('mapPreview').src = '';
            document.getElementById('previewEmail').textContent = '';
            document.getElementById('previewPhone').textContent = '';
            document.getElementById('previewAddress').textContent = '';
            
            // Show form, hide preview
            preview.style.display = 'none';
            contactForm.style.display = 'block';
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Failed to delete contact information: ' + err.message, false);
        }
    }

    contactForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            // Get form elements directly
            const mapLinkInput = document.getElementById('map_link');
            const emailInput = document.getElementById('email');
            const phoneInput = document.getElementById('phone');
            const addressInput = document.getElementById('address');

            // Validate inputs exist
            if (!mapLinkInput || !emailInput || !phoneInput || !addressInput) {
                throw new Error('Form fields not found. Check IDs: map_link, email, phone, address');
            }

            // Get values and validate
            const formData = {
                map_link: mapLinkInput.value.trim(),
                email: emailInput.value.trim(),
                phone: phoneInput.value.trim(),
                address: addressInput.value.trim()
            };

            // Validate no empty values
            for (const [key, value] of Object.entries(formData)) {
                if (!value) {
                    throw new Error(`${key} cannot be empty`);
                }
            }

            console.log('Form data to submit:', formData);

            // Insert data
            const { data, error } = await window.supabase
                .from('contact_info')
                .insert([formData])
                .select();

            if (error) {
                console.error('Supabase insert error:', error);
                throw error;
            }

            console.log('Insert response:', data);

            showToast('Contact information saved successfully!');
            this.reset();
            await loadContactInfo();
        } catch (err) {
            console.error('Form submission error:', err);
            showToast(err.message || 'Failed to save contact information', false);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Function to show toast messages
    function showToast(message, success = true) {
        const toast = new bootstrap.Toast(document.getElementById('toast'));
        const toastBody = document.getElementById('toastMessage');
        toastBody.textContent = message;
        document.getElementById('toast').classList.toggle('bg-success', success);
        document.getElementById('toast').classList.toggle('bg-danger', !success);
        toast.show();
    }

    // Initial load
    await loadContactInfo();
});