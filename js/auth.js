
/* ==========================================
   SCHOOL ID MAKER - SINGLE ADMIN AUTH
========================================== */

(() => {
  const style = document.createElement("style");

  style.textContent = `
    #adminLoginScreen {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: #f3f6fb;
      font-family: Arial, sans-serif;
    }

    #adminLoginScreen.hidden {
      display: none;
    }

    .admin-login-card {
      width: 100%;
      max-width: 390px;
      padding: 32px;
      border-radius: 22px;
      background: white;
      box-shadow: 0 15px 50px rgba(20,43,77,.12);
    }

    .admin-login-logo {
      width: 65px;
      height: 65px;
      margin: 0 auto 18px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: #142b4d;
      color: white;
      font-size: 28px;
      font-weight: bold;
    }

    .admin-login-card h2 {
      margin: 0 0 8px;
      text-align: center;
      color: #142b4d;
    }

    .admin-login-subtitle {
      margin: 0 0 25px;
      text-align: center;
      color: #718096;
      font-size: 14px;
    }

    .admin-login-card label {
      display: block;
      margin: 14px 0 7px;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }

    .admin-login-card input {
      box-sizing: border-box;
      width: 100%;
      padding: 13px;
      border: 1px solid #dce3ed;
      border-radius: 10px;
      outline: none;
      font-size: 15px;
    }

    .admin-login-card input:focus {
      border-color: #2470ff;
      box-shadow: 0 0 0 3px rgba(36,112,255,.10);
    }

    #adminLoginButton {
      width: 100%;
      margin-top: 22px;
      padding: 14px;
      border: 0;
      border-radius: 10px;
      background: #142b4d;
      color: white;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
    }

    #adminLoginButton:disabled {
      opacity: .6;
      cursor: wait;
    }

    #adminLoginError {
      display: none;
      margin-top: 14px;
      padding: 11px;
      border-radius: 9px;
      background: #fff0f0;
      color: #bd2525;
      font-size: 13px;
      line-height: 1.5;
    }

    #adminLogoutButton {
      margin: 12px;
      padding: 10px 14px;
      border: 1px solid #dce3ed;
      border-radius: 9px;
      background: white;
      color: #334155;
      cursor: pointer;
    }

    @media (prefers-color-scheme: dark) {
      #adminLoginScreen {
        background: #101722;
      }

      .admin-login-card {
        background: #1b2736;
      }

      .admin-login-card h2,
      .admin-login-card label {
        color: #f1f5f9;
      }

      .admin-login-card input {
        background: #101722;
        color: white;
        border-color: #344256;
      }
    }
  `;

  document.head.appendChild(style);

  const screen = document.createElement("div");
  screen.id = "adminLoginScreen";

  screen.innerHTML = `
    <div class="admin-login-card">
      <div class="admin-login-logo">ID</div>

      <h2>School ID Maker</h2>

      <p class="admin-login-subtitle">
        Administrator sign in
      </p>

      <form id="adminLoginForm">
        <label for="adminEmail">Administrator email</label>
        <input
          id="adminEmail"
          type="email"
          placeholder="Enter your email"
          autocomplete="username"
          required
        >

        <label for="adminPassword">Password</label>
        <input
          id="adminPassword"
          type="password"
          placeholder="Enter your password"
          autocomplete="current-password"
          required
        >

        <button id="adminLoginButton" type="submit">
          Sign In
        </button>

        <div id="adminLoginError"></div>
      </form>
    </div>
  `;

  document.body.appendChild(screen);

  const form = document.getElementById("adminLoginForm");
  const button = document.getElementById("adminLoginButton");
  const errorBox = document.getElementById("adminLoginError");

  let currentUser = null;

  function showLoginError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
  }

  function showLogin() {
    screen.classList.remove("hidden");
    currentUser = null;
  }

  function hideLogin() {
    screen.classList.add("hidden");
  }

  function addLogoutButton() {
    if (document.getElementById("adminLogoutButton")) return;

    const logout = document.createElement("button");
    logout.id = "adminLogoutButton";
    logout.type = "button";
    logout.textContent = "Sign Out";

    logout.onclick = async () => {
      if (!confirm("Are you sure you want to sign out?")) return;

      logout.disabled = true;

      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        alert("Unable to sign out: " + error.message);
        logout.disabled = false;
      }
    };

    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
      sidebar.appendChild(logout);
    } else {
      document.body.appendChild(logout);
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    errorBox.style.display = "none";
    button.disabled = true;
    button.textContent = "Signing in...";

    try {
      const email = document.getElementById("adminEmail").value.trim();
      const password = document.getElementById("adminPassword").value;

      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      currentUser = data.user;

      if (!currentUser) {
        throw new Error("Administrator account was not found.");
      }

      hideLogin();
      addLogoutButton();

      window.dispatchEvent(
        new CustomEvent("admin-authenticated", {
          detail: { user: currentUser }
        })
      );

    } catch (error) {
      showLoginError(error.message || "Sign-in failed.");
    } finally {
      button.disabled = false;
      button.textContent = "Sign In";
    }
  });

  async function initializeAuth() {
    try {
      showLogin();

      const { data, error } =
        await supabaseClient.auth.getSession();

      if (error) throw error;

      if (data.session?.user) {
        currentUser = data.session.user;
        hideLogin();
        addLogoutButton();

        window.dispatchEvent(
          new CustomEvent("admin-authenticated", {
            detail: { user: currentUser }
          })
        );
      }

    } catch (error) {
      showLoginError(
        "Authentication connection failed. " + error.message
      );
    }
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      showLogin();
    }
  });

  window.IDAuth = {
    getUser: () => currentUser,
    isAuthenticated: () => !!currentUser
  };

  initializeAuth();
})();
