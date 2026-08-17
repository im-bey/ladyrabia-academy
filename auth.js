/* ── Supabase Auth Integration for Lady Rabi'a Academy ──
   Handles authentication state and navbar updates based on
   real Supabase Auth session. */
(function () {
  var currentUserData = null;

  function waitForSupabaseClient(timeoutMs) {
    var timeout = timeoutMs || 3000;
    var interval = 100;
    var waited = 0;
    return new Promise(function(resolve) {
      if (window.SupabaseClient) return resolve(true);
      var timer = setInterval(function() {
        waited += interval;
        if (window.SupabaseClient) {
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
    var clientReady = await waitForSupabaseClient(3000);
    if (!clientReady || !window.SupabaseClient) return false;
    
    try {
      var userData = await window.SupabaseClient.getCurrentUser();
      if (userData && userData.user) {
        currentUserData = userData;
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function injectDropdownStyles() {
    if (document.getElementById('lra-dropdown-styles')) return;
    
    var style = document.createElement('style');
    style.id = 'lra-dropdown-styles';
    style.textContent = `
      .nav-account-dropdown {
        position: relative;
      }
      .nav-account-toggle {
        cursor: pointer;
        user-select: none;
      }
      .nav-account-menu {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        min-width: 180px;
        background: #f9f5ed;
        border: 1px solid rgba(201,168,76,.35);
        border-radius: 2px;
        box-shadow: 0 4px 12px rgba(27,60,40,.15);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-8px);
        transition: opacity .3s, transform .3s, visibility .3s;
        z-index: 200;
      }
      .nav-account-dropdown.is-open .nav-account-menu {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      .nav-account-menu-item {
        display: block;
        padding: 12px 18px;
        font-size: 15px;
        color: #5a5240;
        text-decoration: none;
        border-bottom: 0.5px solid rgba(201,168,76,.2);
        transition: background .3s, color .3s;
        font-family: 'EB Garamond', Georgia, serif;
      }
      .nav-account-menu-item:last-child {
        border-bottom: none;
      }
      .nav-account-menu-item:hover {
        background: rgba(181,134,13,.08);
        color: #1B3C28;
      }
      @media (max-width: 600px) {
        .nav-account-menu {
          right: -10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createDropdown(navLinks, authToggleEl) {
    // Create dropdown container
    var dropdown = document.createElement('div');
    dropdown.className = 'nav-account-dropdown';
    
    // Create toggle button with nav-cta styling
    var toggle = document.createElement('button');
    toggle.className = 'nav-cta nav-account-toggle';
    toggle.style.cssText = 'display: flex; align-items: center; gap: 10px; cursor: pointer;';
    
    // Add profile picture (Google OAuth avatar) or initials fallback
    var avatar = document.createElement('div');
    avatar.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; background: rgba(249,245,237,0.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; overflow: hidden;';
    
    var userName = 'Account';
    var avatarUrl = null;
    if (currentUserData && currentUserData.user && currentUserData.user.user_metadata) {
      avatarUrl = currentUserData.user.user_metadata.avatar_url || currentUserData.user.user_metadata.picture || null;
    }
    
    if (currentUserData && currentUserData.profile && currentUserData.profile.name) {
      userName = currentUserData.profile.name;
    } else if (currentUserData && currentUserData.user && currentUserData.user.user_metadata && currentUserData.user.user_metadata.full_name) {
      userName = currentUserData.user.user_metadata.full_name;
    }
    
    if (avatarUrl) {
      var avatarImg = document.createElement('img');
      avatarImg.src = avatarUrl;
      avatarImg.alt = '';
      avatarImg.referrerPolicy = 'no-referrer';
      avatarImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
      // Fallback to initials if the image fails to load
      avatarImg.onerror = function() {
        avatarImg.remove();
        avatar.textContent = userName.charAt(0).toUpperCase();
      };
      avatar.appendChild(avatarImg);
    } else {
      avatar.textContent = userName.charAt(0).toUpperCase();
    }
    
    // Create text span
    var textSpan = document.createElement('span');
    textSpan.textContent = userName;
    
    toggle.appendChild(avatar);
    toggle.appendChild(textSpan);
    
    // Create dropdown menu
    var menu = document.createElement('div');
    menu.className = 'nav-account-menu';
    
    // Dashboard link
    var dashboardLink = document.createElement('a');
    dashboardLink.className = 'nav-account-menu-item';
    dashboardLink.href = '3-membership-v2-dashboard.html';
    dashboardLink.textContent = 'Dashboard';
    menu.appendChild(dashboardLink);
    
    // Profile link
    var profileLink = document.createElement('a');
    profileLink.className = 'nav-account-menu-item';
    profileLink.href = '#';
    profileLink.textContent = 'Profile';
    profileLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (window.openProfileModal) {
        window.openProfileModal();
      }
    });
    menu.appendChild(profileLink);
    
    // Community link
    var communityLink = document.createElement('a');
    communityLink.className = 'nav-account-menu-item';
    communityLink.href = 'community-chat.html';
    communityLink.textContent = 'Community';
    menu.appendChild(communityLink);
    
    // Sign out link
    var signOutLink = document.createElement('a');
    signOutLink.className = 'nav-account-menu-item';
    signOutLink.href = '#';
    signOutLink.textContent = 'Sign out';
    signOutLink.addEventListener('click', async function (e) {
      e.preventDefault();
      if (window.SupabaseClient) {
        await window.SupabaseClient.signOut();
      }
      window.location.href = 'index.html';
    });
    menu.appendChild(signOutLink);
    
    dropdown.appendChild(toggle);
    dropdown.appendChild(menu);
    
    // Toggle dropdown on click
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('is-open');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('is-open');
      }
    });
    
    // Insert dropdown before auth toggle element
    navLinks.insertBefore(dropdown, authToggleEl);
    
    return dropdown;
  }

  async function apply() {
    var authToggleEl = document.querySelector('[data-auth-toggle]');
    if (!authToggleEl) return;
    
    var navLinks = authToggleEl.parentNode;
    var nav = document.querySelector('.nav');
    
    // Hide navbar initially to prevent flash
    if (nav && !nav.dataset.authChecked) {
      nav.style.visibility = 'hidden';
    }
    
    if (await signedIn()) {
      // Inject dropdown styles
      injectDropdownStyles();
      
      // Hide the "Request your seat" CTA button if present
      var ctaBtn = document.querySelector('.nav-cta');
      if (ctaBtn) {
        ctaBtn.style.display = 'none';
      }
      
      // Check if dropdown already exists to avoid duplicates
      var existingDropdown = navLinks.querySelector('.nav-account-dropdown');
      if (!existingDropdown) {
        createDropdown(navLinks, authToggleEl);
      }
      
      // Hide the original auth toggle (Log in link)
      authToggleEl.style.display = 'none';
    } else {
      // Show the "Request your seat" CTA button if hidden
      var ctaBtn = document.querySelector('.nav-cta');
      if (ctaBtn) {
        ctaBtn.style.display = '';
      }
    }
    
    // Show navbar after auth check is complete
    if (nav) {
      nav.style.visibility = 'visible';
      nav.dataset.authChecked = 'true';
    }
    /* Login click is handled by modal system if present, or by hash navigation */
  }

  window.LRAAuth = {
    signedIn: signedIn,
    signIn: async function () {
      // Handled by Supabase Auth
      await apply();
    },
    signOut: async function () {
      if (window.SupabaseClient) {
        await window.SupabaseClient.signOut();
      }
      window.location.href = 'index.html';
    },
    refresh: apply
  };

  // Apply on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
