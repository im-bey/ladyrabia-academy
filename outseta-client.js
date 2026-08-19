/* ── Outseta Auth Integration for Lady Rabi'a Academy ──
   Replaces the old Supabase-Auth-driven auth.js. Outseta (loaded via its
   own <script src="https://cdn.outseta.com/outseta.min.js"> tag with
   o_options, added to <head> on every page) is now the identity provider;
   this file drives the shared nav account pill and exposes a small helper
   other pages use to call the site's Outseta-token-verifying Edge
   Functions (get-available-content, get-signed-assets, update-progress). */
(function () {
  var currentUser = null;

  function waitForOutseta(timeoutMs) {
    var timeout = timeoutMs || 5000;
    var interval = 100;
    var waited = 0;
    return new Promise(function (resolve) {
      if (window.Outseta) return resolve(true);
      var timer = setInterval(function () {
        waited += interval;
        if (window.Outseta) {
          clearInterval(timer);
          resolve(true);
        } else if (waited >= timeout) {
          clearInterval(timer);
          resolve(false);
        }
      }, interval);
    });
  }

  async function signedIn() {
    var ready = await waitForOutseta();
    if (!ready || !window.Outseta) return false;
    try {
      var timeout = new Promise(function (resolve) {
        setTimeout(function () { resolve(null); }, 4000);
      });
      var user = await Promise.race([window.Outseta.getUser(), timeout]);
      if (user && user.Email) {
        currentUser = user;
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function getAccessToken() {
    return window.Outseta ? window.Outseta.getAccessToken() : null;
  }

  /* Call one of the site's Outseta-verified Edge Functions with the
     current access token attached. Throws if the caller isn't signed in —
     every gateway function requires a bearer token. */
  async function callGateway(functionName, body) {
    var token = getAccessToken();
    if (!token) throw new Error('Not signed in');
    var res = await fetch(
      'https://swapiobhcpgufihykoqx.supabase.co/functions/v1/' + functionName,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }
    );
    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error(json.error || 'Request failed');
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  function injectDropdownStyles() {
    if (document.getElementById('lra-dropdown-styles')) return;
    var style = document.createElement('style');
    style.id = 'lra-dropdown-styles';
    style.textContent =
      '.nav-account-dropdown { position: relative; }' +
      '.nav-account-toggle { cursor: pointer; user-select: none; }' +
      '.nav-account-menu { position: absolute; top: calc(100% + 12px); right: 0; min-width: 180px; background: #f9f5ed; border: 1px solid rgba(201,168,76,.35); border-radius: 2px; box-shadow: 0 4px 12px rgba(27,60,40,.15); opacity: 0; visibility: hidden; transform: translateY(-8px); transition: opacity .3s, transform .3s, visibility .3s; z-index: 200; }' +
      '.nav-account-dropdown.is-open .nav-account-menu { opacity: 1; visibility: visible; transform: translateY(0); }' +
      '.nav-account-menu-item { display: block; padding: 12px 18px; font-size: 15px; color: #5a5240; text-decoration: none; border-bottom: 0.5px solid rgba(201,168,76,.2); transition: background .3s, color .3s; font-family: "EB Garamond", Georgia, serif; background: none; border-left: none; border-right: none; border-top: none; width: 100%; text-align: left; cursor: pointer; }' +
      '.nav-account-menu-item:last-child { border-bottom: none; }' +
      '.nav-account-menu-item:hover { background: rgba(181,134,13,.08); color: #1B3C28; }' +
      '@media (max-width: 600px) { .nav-account-menu { right: -10px; } }';
    document.head.appendChild(style);
  }

  function createDropdown(navLinks, authToggleEl) {
    var dropdown = document.createElement('div');
    dropdown.className = 'nav-account-dropdown';

    var toggle = document.createElement('button');
    toggle.className = 'nav-cta nav-account-toggle';
    toggle.type = 'button';
    toggle.style.cssText = 'display: flex; align-items: center; gap: 10px; cursor: pointer;';

    var avatar = document.createElement('div');
    avatar.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; background: rgba(249,245,237,0.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; overflow: hidden;';

    var userName = (currentUser && (currentUser.FirstName || currentUser.FullName)) || 'Account';
    avatar.textContent = userName.charAt(0).toUpperCase();

    var textSpan = document.createElement('span');
    textSpan.textContent = userName;

    toggle.appendChild(avatar);
    toggle.appendChild(textSpan);

    var menu = document.createElement('div');
    menu.className = 'nav-account-menu';

    var dashboardLink = document.createElement('a');
    dashboardLink.className = 'nav-account-menu-item';
    dashboardLink.href = '3-membership-v2-dashboard.html';
    dashboardLink.textContent = 'Dashboard';
    menu.appendChild(dashboardLink);

    var profileBtn = document.createElement('button');
    profileBtn.className = 'nav-account-menu-item';
    profileBtn.type = 'button';
    profileBtn.textContent = 'Profile & Billing';
    profileBtn.addEventListener('click', function () {
      if (window.Outseta) window.Outseta.profile.open({ mode: 'popup' });
    });
    menu.appendChild(profileBtn);

    var communityLink = document.createElement('a');
    communityLink.className = 'nav-account-menu-item';
    communityLink.href = 'community-chat.html';
    communityLink.textContent = 'Community';
    menu.appendChild(communityLink);

    var signOutBtn = document.createElement('button');
    signOutBtn.className = 'nav-account-menu-item';
    signOutBtn.type = 'button';
    signOutBtn.textContent = 'Sign out';
    signOutBtn.addEventListener('click', function () {
      if (window.Outseta) window.Outseta.logout();
    });
    menu.appendChild(signOutBtn);

    dropdown.appendChild(toggle);
    dropdown.appendChild(menu);

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('is-open');
    });
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target)) dropdown.classList.remove('is-open');
    });

    navLinks.insertBefore(dropdown, authToggleEl);
    return dropdown;
  }

  async function apply() {
    var authToggleEl = document.querySelector('[data-auth-toggle]');
    if (!authToggleEl) return;

    var navLinks = authToggleEl.parentNode;
    var nav = document.querySelector('.nav');
    if (nav && !nav.dataset.authChecked) nav.style.visibility = 'hidden';

    try {
      if (await signedIn()) {
        injectDropdownStyles();
        var ctaBtn = document.querySelector('.nav-cta');
        if (ctaBtn) ctaBtn.style.display = 'none';

        var existingDropdown = navLinks.querySelector('.nav-account-dropdown');
        if (!existingDropdown) createDropdown(navLinks, authToggleEl);
        authToggleEl.style.display = 'none';
      } else {
        var cta = document.querySelector('.nav-cta');
        if (cta) cta.style.display = '';
      }
    } finally {
      if (nav) {
        nav.style.visibility = 'visible';
        nav.dataset.authChecked = 'true';
      }
    }
  }

  window.LRAAuth = {
    signedIn: signedIn,
    getUser: async function () { await signedIn(); return currentUser; },
    getAccessToken: getAccessToken,
    callGateway: callGateway,
    signOut: function () {
      if (window.Outseta) window.Outseta.logout();
    },
    refresh: apply,
  };

  waitForOutseta().then(function (ready) {
    if (!ready) return;
    window.Outseta.on('accessToken.set', function () { currentUser = null; apply(); });
    window.Outseta.on('logout', function () {
      currentUser = null;
      apply();
      window.location.href = 'index.html';
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      apply();
    }
  });
})();
