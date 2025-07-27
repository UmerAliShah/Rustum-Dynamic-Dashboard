document.addEventListener("DOMContentLoaded", async function () {
    const aboutForm = document.getElementById('aboutForm');
    const dataTable = document.querySelector('#aboutTable tbody');
    const submitBtn = document.getElementById('submitBtn');

    // Load existing entries
    async function loadEntries() {
        try {
            const { data, error } = await window.supabase
                .from('about_us')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            dataTable.innerHTML = data.map(entry => `
                <tr>
                    <td>${entry.heading}</td>
                    <td>${entry.description}</td>
                    <td>${entry.counter1_value} ${entry.counter1_text}</td>
                    <td>${entry.counter2_value} ${entry.counter2_text}</td>
                    <td>${entry.counter3_value} ${entry.counter3_text}</td>
                    <td>${entry.counter4_value} ${entry.counter4_text}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="editEntry(${entry.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">Delete</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            showToast(err.message, false);
        }
    }

    // Handle form submission
    aboutForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        try {
            // Disable submit button
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            // Validate and collect form data
            const formData = {
                heading: document.getElementById('headingInput').value.trim(),
                description: document.getElementById('descriptionInput').value.trim(),
                counter1_value: parseInt(document.getElementById('counter1Value').value) || 0,
                counter1_text: document.getElementById('counter1Text').value.trim(),
                counter2_value: parseInt(document.getElementById('counter2Value').value) || 0,
                counter2_text: document.getElementById('counter2Text').value.trim(),
                counter3_value: parseInt(document.getElementById('counter3Value').value) || 0,
                counter3_text: document.getElementById('counter3Text').value.trim(),
                counter4_value: parseInt(document.getElementById('counter4Value').value) || 0,
                counter4_text: document.getElementById('counter4Text').value.trim()
            };

            // Validate required fields
            if (!formData.heading || !formData.description) {
                throw new Error('Please fill in heading and description');
            }

            console.log('Sending data:', formData);

            // Save to Supabase
            const { error } = await window.supabase
                .from('about_us')
                .insert([formData]);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            // Show success message and reset form
            showToast('Content saved successfully!', true);
            aboutForm.reset();
            await loadEntries();

        } catch (err) {
            console.error('Save error:', err);
            showToast(err.message || 'Failed to save content', false);
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Content';
        }
    });

    // Delete entry
    window.deleteEntry = async function(id) {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        
        try {
            const { error } = await window.supabase
                .from('about_us')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Entry deleted successfully!');
            await loadEntries();
        } catch (err) {
            showToast(err.message, false);
        }
    };

    // Edit entry
    window.editEntry = async function(id) {
        try {
            const { data, error } = await window.supabase
                .from('about_us')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            // Fill modal with data
            document.getElementById('editId').value = id;
            document.getElementById('editHeading').value = data.heading;
            document.getElementById('editDescription').value = data.description;
            document.getElementById('editCounter1Value').value = data.counter1_value;
            document.getElementById('editCounter1Text').value = data.counter1_text;
            document.getElementById('editCounter2Value').value = data.counter2_value;
            document.getElementById('editCounter2Text').value = data.counter2_text;
            document.getElementById('editCounter3Value').value = data.counter3_value;
            document.getElementById('editCounter3Text').value = data.counter3_text;
            document.getElementById('editCounter4Value').value = data.counter4_value;
            document.getElementById('editCounter4Text').value = data.counter4_text;

            new bootstrap.Modal(document.getElementById('editModal')).show();
        } catch (err) {
            showToast(err.message, false);
        }
    };

    // Handle edit form submission
    document.getElementById('editForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            const id = document.getElementById('editId').value;
            const updates = {
                heading: document.getElementById('editHeading').value.trim(),
                description: document.getElementById('editDescription').value.trim(),
                counter1_value: parseInt(document.getElementById('editCounter1Value').value),
                counter1_text: document.getElementById('editCounter1Text').value.trim(),
                counter2_value: parseInt(document.getElementById('editCounter2Value').value),
                counter2_text: document.getElementById('editCounter2Text').value.trim(),
                counter3_value: parseInt(document.getElementById('editCounter3Value').value),
                counter3_text: document.getElementById('editCounter3Text').value.trim(),
                counter4_value: parseInt(document.getElementById('editCounter4Value').value),
                counter4_text: document.getElementById('editCounter4Text').value.trim()
            };

            const { error } = await window.supabase
                .from('about_us')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            showToast('Entry updated successfully!');
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            await loadEntries();
        } catch (err) {
            showToast(err.message, false);
        }
    });

    // Show toast notification
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