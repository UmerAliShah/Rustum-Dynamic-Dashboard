async function checkAuth() {
    // Don't check auth on index.html (login page)
    if (window.location.pathname.includes('index.html')) {
        return true;
    }

    const { data: { user }, error } = await window.supabase.auth.getUser();
    
    if (error || !user) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

async function login(email, password) {
    try {
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        localStorage.setItem('isLoggedIn', 'true');
        window.location.href = 'home.html';
        return true;
    } catch (err) {
        console.error('Login error:', err);
        throw err;
    }
}

async function logout() {
    try {
        const { error } = await window.supabase.auth.signOut();
        if (error) throw error;
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Logout error:', err);
        throw err;
    }
}

window.auth = {
    checkAuth,
    login,
    logout
};
