async function checkAuth() {
  const isLoginPage = window.location.pathname.endsWith('login.html');
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.authenticated && !isLoginPage) {
      window.location.href = '/login.html';
    }
    if (data.authenticated && isLoginPage) {
      window.location.href = '/register.html';
    }
  } catch (err) {
    if (!isLoginPage) window.location.href = '/login.html';
  }
}

function wireLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}

checkAuth();
document.addEventListener('DOMContentLoaded', wireLogout);
