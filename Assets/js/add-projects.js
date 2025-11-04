document.addEventListener("DOMContentLoaded", async function() {
    const completedForm = document.getElementById('completedForm');
    const currentForm = document.getElementById('currentForm');

    async function uploadImage(file) {
        try {
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { data, error } = await window.supabase.storage
                .from('project-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl } } = window.supabase.storage
                .from('project-images')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    async function uploadImages(files) {
        const uploadPromises = Array.from(files).map(file => uploadImage(file));
        return Promise.all(uploadPromises);
    }

    async function loadProjects(type) {
        try {
            // First get all projects of specified type
            const { data: projects, error: projectsError } = await window.supabase
                .from('projects')
                .select('id, name, content, created_at')
                .eq('type', type)
                .order('created_at', { ascending: false });

            if (projectsError) throw projectsError;

            // Then get images for each project
            const projectsWithImages = await Promise.all(projects.map(async (project) => {
                const { data: images, error: imagesError } = await window.supabase
                    .from('project_images')
                    .select('image_url')
                    .eq('project_id', project.id);

                if (imagesError) throw imagesError;

                return {
                    ...project,
                    images: images.map(img => img.image_url)
                };
            }));

            return projectsWithImages;
        } catch (error) {
            console.error('Load projects error:', error);
            throw new Error('Failed to load projects: ' + error.message);
        }
    }

    function renderProjects(projects, container, type) {
        container.innerHTML = projects.map(project => `
            <div class="project-card">
                <h5>${project.name}</h5>
                <p>${project.content}</p>
                <div class="project-images">
                    ${project.images.map(img => `<img src="${img}" alt="Project Image">`).join('')}
                </div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-warning" onclick="editProject(${project.id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProject(${project.id})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async function handleFormSubmit(e, type) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            // Get form data
            const name = form.querySelector('input[type="text"]').value.trim();
            const content = form.querySelector('textarea').value.trim();
            const files = form.querySelector('input[type="file"]').files;

            if (!name || !content || files.length === 0) {
                throw new Error('Please fill all fields and select at least one image');
            }

            // First create the project
            const { data: project, error: projectError } = await window.supabase
                .from('projects')
                .insert([{ 
                    name, 
                    content, 
                    type 
                }])
                .select()
                .single();

            if (projectError) throw projectError;

            // Then upload images and create image records
            const imageUrls = await uploadImages(files);
            const imageRecords = imageUrls.map(url => ({
                project_id: project.id,
                image_url: url
            }));

            const { error: imagesError } = await window.supabase
                .from('project_images')
                .insert(imageRecords);

            if (imagesError) throw imagesError;

            showToast('Project added successfully!');
            form.reset();
            await refreshProjects(type);
        } catch (err) {
            console.error('Submit error:', err);
            showToast(err.message || 'Failed to add project', false);
        } finally {
            submitBtn.disabled = false;
        }
    }

    window.deleteProject = async function(id) {
        if (!confirm('Are you sure you want to delete this project?')) return;

        try {
            // Get project type and images before deletion
            const { data: project } = await window.supabase
                .from('projects')
                .select('type, project_images(image_url)')
                .eq('id', id)
                .single();

            // Delete images from storage
            const deletePromises = project.project_images.map(img => {
                const fileName = img.image_url.split('/').pop();
                return window.supabase.storage
                    .from('project-images')
                    .remove([fileName]);
            });

            await Promise.all(deletePromises);

            // Delete project (will cascade delete images)
            const { error } = await window.supabase
                .from('projects')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showToast('Project deleted successfully!');
            refreshProjects(project.type);
        } catch (err) {
            showToast('Failed to delete project: ' + err.message, false);
        }
    };

    window.editProject = async function(id) {
        try {
            const { data: project, error } = await window.supabase
                .from('projects')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            document.getElementById('editProjectName').value = project.name;
            document.getElementById('editProjectContent').value = project.content;
            document.getElementById('editStorageKey').value = project.type;
            document.getElementById('editIndex').value = id;

            new bootstrap.Modal(document.getElementById('editModal')).show();
        } catch (err) {
            showToast('Failed to load project: ' + err.message, false);
        }
    };

    document.getElementById('editForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const id = document.getElementById('editIndex').value;
            const name = document.getElementById('editProjectName').value;
            const content = document.getElementById('editProjectContent').value;

            const { error } = await window.supabase
                .from('projects')
                .update({ name, content })
                .eq('id', id);

            if (error) throw error;

            showToast('Project updated successfully!');
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            
            const { data: project } = await window.supabase
                .from('projects')
                .select('type')
                .eq('id', id)
                .single();
                
            refreshProjects(project.type);
        } catch (err) {
            showToast('Failed to update project: ' + err.message, false);
        } finally {
            submitBtn.disabled = false;
        }
    });

    async function refreshProjects(type) {
        try {
            const projects = await loadProjects(type);
            renderProjects(
                projects,
                document.getElementById(type === 'completed' ? 'completedList' : 'currentList'),
                type
            );
        } catch (err) {
            showToast('Failed to refresh projects: ' + err.message, false);
        }
    }

    // Event listeners
    completedForm.addEventListener('submit', e => handleFormSubmit(e, 'completed'));
    currentForm.addEventListener('submit', e => handleFormSubmit(e, 'current'));

    // Initial load
    await refreshProjects('completed');
    await refreshProjects('current');
});