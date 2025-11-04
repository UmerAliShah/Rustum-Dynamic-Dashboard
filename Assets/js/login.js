const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageBox = document.getElementById('message');

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      messageBox.classList.add('d-none');
      messageBox.classList.remove('alert-success', 'alert-danger');

      // Supabase sign in
      const { data, error } = await window.supabase.auth.signInWithPassword({
          email,
          password
      });

      if (error) {
          messageBox.textContent = error.message;
          messageBox.classList.remove('d-none');
          messageBox.classList.add('alert', 'alert-danger');
      } else {
          messageBox.textContent = 'Login successful!';
          messageBox.classList.remove('d-none');
          messageBox.classList.add('alert', 'alert-success');
          // Redirect to dashboard or home page
          setTimeout(() => {
              window.location.href = 'home.html'; // Change to your dashboard page
          }, 1000);
      }
    });