/* ── Outseta Auth Integration for Lady Rabi'a Academy ──
   Replaces the old Supabase-Auth-driven auth.js. Outseta (loaded via its
   own <script src="https://cdn.outseta.com/outseta.min.js"> tag with
   o_options, added to <head> on every page) is now the identity provider;
   this file drives the shared nav account pill and exposes a small helper
   other pages use to call the site's Outseta-token-verifying Edge
   Functions (get-available-content, get-signed-assets, update-progress). */
(function () {
  var currentUser = null;
  // Emails that route to admin-dashboard.html on login instead of the
  // member dashboard, and never need a paid plan. Kept in sync with the
  // dedicated $0 "Admin" plan in Outseta.
  var ADMIN_EMAILS = ['ismailbey.m@gmail.com', 'bey.razia@gmail.com'];

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

  // Outseta's own SDK storage was observed NOT surviving a plain full-page
  // navigation to another page on the same site (confirmed live:
  // window.Outseta.getAccessToken() returned null on admin-dashboard.html
  // seconds after a successful login on another page). Rather than trust
  // it, we keep our own copy in localStorage, which is guaranteed to
  // persist across pages/tabs on this origin, and treat it as the primary
  // source of truth.
  var LOCAL_TOKEN_KEY = 'lra_access_token';

  function persistToken(token) {
    try {
      if (token) localStorage.setItem(LOCAL_TOKEN_KEY, token);
      else localStorage.removeItem(LOCAL_TOKEN_KEY);
    } catch (e) {}
  }

  function readStoredToken() {
    try {
      var token = localStorage.getItem(LOCAL_TOKEN_KEY);
      if (!token || !decodeAccessToken(token)) {
        if (token) persistToken(null); // expired/invalid — clear it
        return null;
      }
      return token;
    } catch (e) {
      return null;
    }
  }

  function getAccessToken() {
    var stored = readStoredToken();
    if (stored) return stored;

    var sdkToken = window.Outseta && window.Outseta.getAccessToken();
    if (sdkToken) {
      persistToken(sdkToken);
      return sdkToken;
    }

    // Fallback for the moment right after an auth redirect: the token sits
    // in ?access_token= before Outseta's SDK has necessarily parsed it.
    try {
      var urlToken = new URLSearchParams(window.location.search).get('access_token');
      if (urlToken) {
        persistToken(urlToken);
        return urlToken;
      }
    } catch (e) {}
    return null;
  }

  /* Decodes the JWT payload locally — no network call. Outseta.getUser()
     (the SDK's own method) turned out to be unreliable in this deployment:
     it's internally rate-limited (Outseta's own code logs "Too many
     requests to Outseta.getUser()") and was observed hanging/never
     resolving even for a single, fresh, server-validated access token, so
     it can't be trusted as the source of truth for "is this person signed
     in." Every claim we need for nav display and gating (email, name,
     person uid, account/plan uid) is already embedded in the JWT itself. */
  function decodeAccessToken(token) {
    try {
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var payload = JSON.parse(atob(b64));
      if (payload.exp && payload.exp * 1000 < Date.now()) return null;
      return payload;
    } catch (e) {
      return null;
    }
  }

  function userFromClaims(claims) {
    return {
      Uid: claims.sub,
      Email: claims.email,
      FirstName: claims.given_name,
      LastName: claims.family_name,
      FullName: claims.name,
      AccountUid: claims['outseta:accountUid'],
      PlanUid: claims['outseta:planUid'],
    };
  }

  async function signedIn() {
    var ready = await waitForOutseta();
    if (!ready || !window.Outseta) return false;
    var token = getAccessToken();
    if (!token) return false;
    var claims = decodeAccessToken(token);
    if (!claims || !claims.email) return false;
    currentUser = userFromClaims(claims);
    return true;
  }

  /* Fetches the logged-in person's full profile via REST (GET
     /api/v1/profile) — fields like PhoneMobile aren't in the JWT, so this
     is needed anywhere the site prefills a form from existing profile data. */
  async function getProfile() {
    var token = getAccessToken();
    if (!token) throw new Error('Not signed in');
    var res = await fetch('https://lady-rabia-academy.outseta.com/api/v1/profile', {
      headers: { Authorization: 'Bearer ' + token },
    });
    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error(json.ErrorMessage || json.error || 'Failed to load profile');
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  /* Updates the logged-in person's own Outseta profile directly via REST
     (PUT /api/v1/profile with their own bearer token), bypassing the SDK's
     unreliable .update() method entirely — same endpoint it calls under
     the hood, just without the flaky wrapper. */
  async function updateProfile(fields) {
    var token = getAccessToken();
    if (!token) throw new Error('Not signed in');
    var res = await fetch('https://lady-rabia-academy.outseta.com/api/v1/profile', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(fields || {}),
    });
    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error(json.ErrorMessage || json.error || 'Profile update failed');
      err.status = res.status;
      err.body = json;
      throw err;
    }
    if (currentUser) currentUser = Object.assign({}, currentUser, fields);
    return json;
  }

  function isAdminEmail(email) {
    return ADMIN_EMAILS.indexOf((email || '').toLowerCase()) !== -1;
  }

  function maybeRedirectAdmin() {
    if (!currentUser || !isAdminEmail(currentUser.Email)) return;
    if (/admin-dashboard\.html$/i.test(window.location.pathname)) return;
    window.location.href = 'admin-dashboard.html';
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

    var isAdmin = isAdminEmail(currentUser && currentUser.Email);
    var dashboardLink = document.createElement('a');
    dashboardLink.className = 'nav-account-menu-item';
    dashboardLink.href = isAdmin ? 'admin-dashboard.html' : '3-membership-v2-dashboard.html';
    dashboardLink.textContent = isAdmin ? 'Admin Dashboard' : 'Dashboard';
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
    getProfile: getProfile,
    updateProfile: updateProfile,
    isAdmin: function () { return !!(currentUser && isAdminEmail(currentUser.Email)); },
    callGateway: callGateway,
    signOut: function () {
      currentUser = null;
      persistToken(null);
      if (window.Outseta) window.Outseta.logout();
    },
    refresh: apply,
  };

  waitForOutseta().then(function (ready) {
    if (!ready) return;

    var freshRedirectLogin = false;
    try {
      freshRedirectLogin = new URLSearchParams(window.location.search).has('access_token');
    } catch (e) {}

    // Strip ?access_token= from the address bar once the SDK has had a
    // chance to read it — no reason to leave a raw JWT sitting in the URL,
    // browser history, or anything that might get bookmarked/shared.
    function cleanRedirectUrl() {
      if (!freshRedirectLogin) return;
      var url = new URL(window.location.href);
      url.searchParams.delete('access_token');
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }

    window.Outseta.on('accessToken.set', async function () {
      currentUser = null;
      await apply();
      cleanRedirectUrl();
      maybeRedirectAdmin();
    });
    window.Outseta.on('logout', function () {
      currentUser = null;
      persistToken(null);
      apply();
      window.location.href = 'index.html';
    });

    function initialLoad() {
      apply().then(function () {
        cleanRedirectUrl();
        if (freshRedirectLogin) maybeRedirectAdmin();
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialLoad);
    } else {
      initialLoad();
    }
  });
})();
