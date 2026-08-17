/* LOGIN MODAL SYSTEM
   Injects a login modal into the page and wires it up with GSAP animations.
   Attach this to any page with `<script src="login-modal.js"></script>`
   just before the closing </body> tag. */
(function () {
  if (document.getElementById('modal-login')) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Add modal CSS */
  var css = document.createElement('style');
  css.textContent =
    '.modal-layer { position: fixed; inset: 0; z-index: 200; display: none; }' +
    '.modal-layer.open { display: block; }' +
    '.modal-backdrop { position: absolute; inset: 0; background: rgba(20,46,31,.55); backdrop-filter: blur(10px); opacity: 0; }' +
    '.modal-positioner { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1.5rem; overflow-y: auto; }' +
    '.modal-panel { position: relative; width: 100%; max-width: 420px; background: var(--ivory); border: 0.5px solid var(--gold-light); border-radius: 1px; padding: 2.6rem 2.3rem 2.4rem; box-shadow: 0 40px 80px -30px rgba(20,46,31,.55); opacity: 0; margin: auto; }' +
    '.modal-panel .c { position: absolute; width: 14px; height: 14px; border-color: var(--gold); }' +
    '.modal-panel .c.tl { top: 5px; left: 5px; border-top: 1px solid; border-left: 1px solid; }' +
    '.modal-panel .c.tr { top: 5px; right: 5px; border-top: 1px solid; border-right: 1px solid; }' +
    '.modal-panel .c.bl { bottom: 5px; left: 5px; border-bottom: 1px solid; border-left: 1px solid; }' +
    '.modal-panel .c.br { bottom: 5px; right: 5px; border-bottom: 1px solid; border-right: 1px solid; }' +
    '.modal-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: none; border: 0.5px solid transparent; border-radius: 50%; color: var(--muted); font-size: 18px; line-height: 1; cursor: pointer; font-family: "EB Garamond", serif; transition: color .3s, border-color .3s; }' +
    '.modal-close:hover { color: var(--green); border-color: var(--gold-light); }' +
    '.modal-header { text-align: center; margin-bottom: 1.6rem; }' +
    '.modal-header .section-lbl { margin-bottom: .7rem; }' +
    '.modal-title { font-family: "Playfair Display", serif; font-size: 24px; font-weight: 400; font-style: italic; color: var(--green); line-height: 1.35; }' +
    '.modal-orn { display: flex; justify-content: center; margin-top: .9rem; }' +
    '.modal-orn svg { width: 120px; height: auto; overflow: visible; }' +
    '.modal-orn path { stroke: var(--gold); fill: none; }' +
    '.auth-form { display: flex; flex-direction: column; gap: 0; }' +
    '.form-fields { border: none; display: flex; flex-direction: column; gap: 1.1rem; margin-bottom: 1.5rem; }' +
    '.field { display: flex; flex-direction: column; gap: 7px; }' +
    '.field label { font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); }' +
    '.field input { border: 0.5px solid rgba(201,168,76,.6); padding: 13px 14px; font-family: "EB Garamond", serif; font-size: 15px; background: var(--ivory); color: var(--ink); border-radius: 1px; outline: none; transition: border-color .3s; width: 100%; }' +
    '.field input:focus { border-color: var(--gold); }' +
    '.modal-panel .btn-primary { display: block; width: 100%; text-align: center; background: var(--green); color: var(--ivory); font-family: "EB Garamond", serif; font-size: 15px; letter-spacing: .08em; padding: 15px 36px; border: none; cursor: pointer; border-radius: 1px; text-decoration: none; position: relative; overflow: hidden; transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s; }' +
    '.modal-panel .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -12px rgba(27,60,40,.55); }' +
    '.modal-panel .btn-primary::before { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 40%, rgba(201,168,76,.4) 50%, transparent 60%); transform: translateX(-110%); }' +
    '.modal-panel .btn-primary:hover::before { transform: translateX(110%); transition: transform .8s ease; }' +
    '.modal-panel .btn-primary span { position: relative; z-index: 1; }' +
    '.modal-alt { text-align: center; margin-top: 1.1rem; font-size: 13px; font-style: italic; }' +
    '.modal-alt a, .modal-alt button { color: var(--muted); text-decoration: none; background: none; border: none; cursor: pointer; font-family: "EB Garamond", serif; font-size: 13px; font-style: italic; padding: 0; border-bottom: 0.5px solid rgba(201,168,76,.5); transition: color .3s, border-color .3s; }' +
    '.modal-alt a:hover, .modal-alt button:hover { color: var(--green); border-color: var(--gold); }' +
    '.auth-tabs { display: flex; gap: 0; border-bottom: 0.5px solid rgba(201,168,76,.3); margin-bottom: 1.8rem; }' +
    '.auth-tab { flex: 1; padding: 12px 16px; background: none; border: none; font-family: "EB Garamond", serif; font-size: 15px; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all .3s; }' +
    '.auth-tab.active { color: var(--green); border-bottom-color: var(--gold); }' +
    '.auth-tab:hover { color: var(--green); }' +
    '.tab-content { display: none; }' +
    '.tab-content.active { display: block; }' +
    '.error-msg { color: #c53030; font-size: 13px; margin-top: 0.5rem; display: none; }' +
    '.error-msg.show { display: block; }';
  document.head.appendChild(css);

  /* Add modal HTML */
  var modal = document.createElement('div');
  modal.id = 'modal-login';
  modal.className = 'modal-layer';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'loginTitle');
  modal.innerHTML =
    '<div class="modal-backdrop" data-modal-backdrop></div>' +
    '<div class="modal-positioner">' +
      '<div class="modal-panel">' +
        '<div class="c tl"></div><div class="c tr"></div><div class="c bl"></div><div class="c br"></div>' +
        '<button class="modal-close" type="button" data-modal-close aria-label="Close">✕</button>' +
        '<header class="modal-header" data-modal-field>' +
          '<span class="section-lbl">Lady Rabi\'a Academy</span>' +
          '<h2 class="modal-title" id="loginTitle">Welcome</h2>' +
          '<div class="modal-orn" aria-hidden="true">' +
            '<svg viewBox="0 0 120 12"><path stroke-width="0.6" d="M 0 6 H 46"/><path stroke-width="0.6" d="M 120 6 H 74"/><path stroke-width="0.7" d="M 60 0.5 L 65.5 6 L 60 11.5 L 54.5 6 Z"/></svg>' +
          '</div>' +
        '</header>' +
        '<div class="auth-tabs" data-modal-field>' +
          '<button class="auth-tab active" data-tab="login" type="button">Log in</button>' +
          '<button class="auth-tab" data-tab="signup" type="button">Sign up</button>' +
        '</div>' +
        '<div class="embed-mount">' +
          '<div class="tab-content active" id="login-tab">' +
            '<form class="auth-form" id="login-form" onsubmit="return false;">' +
              '<fieldset class="form-fields">' +
                '<div class="field" data-modal-field><label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="email" required></div>' +
                '<div class="field" data-modal-field><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required></div>' +
              '</fieldset>' +
              '<button class="btn-primary" type="submit" data-modal-field><span>Log in</span></button>' +
              '<p class="modal-alt" data-modal-field><a href="forgot-password.html">Forgot password?</a></p>' +
            '</form>' +
          '</div>' +
          '<div class="tab-content" id="signup-tab">' +
            '<form class="auth-form" id="signup-form" onsubmit="return false;">' +
              '<fieldset class="form-fields">' +
                '<div class="field" data-modal-field><label for="signup-email">Email</label><input id="signup-email" name="email" type="email" autocomplete="email" required></div>' +
                '<div class="field" data-modal-field><label for="signup-password">Password</label><input id="signup-password" name="password" type="password" autocomplete="new-password" required minlength="6"></div>' +
                '<div class="field" data-modal-field><label for="signup-password-confirm">Confirm Password</label><input id="signup-password-confirm" name="password-confirm" type="password" autocomplete="new-password" required minlength="6"></div>' +
              '</fieldset>' +
              '<div class="error-msg" id="signup-error"></div>' +
              '<button class="btn-primary" type="submit" data-modal-field><span>Sign up</span></button>' +
            '</form>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  /* Tab switching logic */
  var tabs = modal.querySelectorAll('.auth-tab');
  var tabContents = modal.querySelectorAll('.tab-content');
  
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var targetTab = this.getAttribute('data-tab');
      
      // Update tab buttons
      tabs.forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      
      // Update tab content
      tabContents.forEach(function(content) {
        content.classList.remove('active');
      });
      document.getElementById(targetTab + '-tab').classList.add('active');
      
      // Clear any error messages
      var errorMsg = document.getElementById('signup-error');
      if (errorMsg) {
        errorMsg.classList.remove('show');
        errorMsg.textContent = '';
      }
    });
  });

  /* Modal logic */
  var openLayer = null;
  var activeTl = null;

  function buildOpenTimeline(layer) {
    if (!window.gsap) return null;
    var backdrop = layer.querySelector('[data-modal-backdrop]');
    var panel = layer.querySelector('.modal-panel');
    var fields = layer.querySelectorAll('[data-modal-field]');
    var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: .45, ease: 'power2.out' }, 0)
      .fromTo(panel, { opacity: 0, scale: .96, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: .55 }, .1)
      .fromTo(fields, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6, stagger: .07 }, .28);
    if (reduced) tl.timeScale(50);
    return tl;
  }

  function openModal(name) {
    var layer = document.getElementById('modal-' + name);
    if (!layer) return;
    if (openLayer) hardClose(openLayer);
    openLayer = layer;
    layer.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.gsap) {
      activeTl = buildOpenTimeline(layer);
      if (activeTl) activeTl.play(0);
    } else {
      layer.querySelector('.modal-backdrop').style.opacity = '1';
      layer.querySelector('.modal-panel').style.opacity = '1';
    }
  }

  function closeModal() {
    if (!openLayer) return;
    var layer = openLayer;
    openLayer = null;
    if (activeTl) {
      var tl = activeTl;
      activeTl = null;
      tl.timeScale(reduced ? 50 : 1.5);
      tl.eventCallback('onReverseComplete', function () {
        layer.classList.remove('open');
        document.body.style.overflow = '';
      });
      tl.reverse();
    } else {
      hardClose(layer);
    }
  }

  function hardClose(layer) {
    layer.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    if (e.target.matches('[data-modal-close]') || e.target.matches('[data-modal-backdrop]')) {
      e.preventDefault();
      closeModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openLayer) closeModal();
  });

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[href="#login"]');
    if (target) {
      e.preventDefault();
      openModal('login');
    }
  });

  if (location.hash === '#login' && !(window.LRAAuth && LRAAuth.signedIn())) {
    setTimeout(function () { openModal('login'); }, 100);
  }

  var loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      
      var emailInput = document.getElementById('login-email');
      var passwordInput = document.getElementById('login-password');
      var submitBtn = loginForm.querySelector('button[type="submit"]');
      
      if (!emailInput || !passwordInput) return;
      
      var email = emailInput.value.trim();
      var password = passwordInput.value;
      
      if (!email || !password) {
        alert('Please enter your email and password.');
        return;
      }
      
      // Disable submit button
      submitBtn.disabled = true;
      var originalText = submitBtn.querySelector('span').textContent;
      submitBtn.querySelector('span').textContent = 'Signing in...';
      
      try {
        var result = await window.SupabaseClient.signInWithEmail(email, password);
        
        if (result.error) {
          alert(result.error.message || 'Failed to sign in. Please check your credentials.');
          submitBtn.disabled = false;
          submitBtn.querySelector('span').textContent = originalText;
          return;
        }
        
        // Close modal
        if (openLayer) hardClose(openLayer);
        
        // Refresh auth state
        if (window.LRAAuth) await LRAAuth.refresh();
        
        // Get user data to check role and profile completion
        var userData = await window.SupabaseClient.getCurrentUser();
        console.log('Login - userData:', userData);
        console.log('Login - profile:', userData?.profile);
        console.log('Login - role:', userData?.profile?.role);
        
        if (userData && userData.profile) {
          // Redirect based on role first
          if (userData.profile.role === 'admin') {
            console.log('Redirecting admin to admin-dashboard.html');
            // Admins can access dashboard even with incomplete profile
            window.location.href = 'admin-dashboard.html';
            return;
          }
          
          // For members, check if profile is complete (all required fields)
          if (!userData.profile.name || !userData.profile.surname || !userData.profile.contact_number) {
            window.location.href = 'complete-profile.html';
            return;
          }
          
          window.location.href = '3-membership-v2-dashboard.html';
        } else {
          window.location.href = '3-membership-v2-dashboard.html';
        }
        
      } catch (error) {
        console.error('Login error:', error);
        alert('An unexpected error occurred. Please try again.');
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = originalText;
      }
    });
  }
  
  // Sign-up form handler
  var signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      
      var emailInput = document.getElementById('signup-email');
      var passwordInput = document.getElementById('signup-password');
      var confirmPasswordInput = document.getElementById('signup-password-confirm');
      var submitBtn = signupForm.querySelector('button[type="submit"]');
      var errorMsg = document.getElementById('signup-error');
      
      if (!emailInput || !passwordInput || !confirmPasswordInput) return;
      
      var email = emailInput.value.trim();
      var password = passwordInput.value;
      var confirmPassword = confirmPasswordInput.value;
      
      // Clear previous errors
      errorMsg.classList.remove('show');
      errorMsg.textContent = '';
      
      // Validation
      if (!email || !password || !confirmPassword) {
        errorMsg.textContent = 'Please fill in all fields.';
        errorMsg.classList.add('show');
        return;
      }
      
      if (password.length < 6) {
        errorMsg.textContent = 'Password must be at least 6 characters.';
        errorMsg.classList.add('show');
        return;
      }
      
      if (password !== confirmPassword) {
        errorMsg.textContent = 'Passwords do not match.';
        errorMsg.classList.add('show');
        return;
      }
      
      // Disable submit button
      submitBtn.disabled = true;
      var originalText = submitBtn.querySelector('span').textContent;
      submitBtn.querySelector('span').textContent = 'Creating account...';
      
      try {
        var result = await window.SupabaseClient.signUpWithEmail(email, password);
        
        if (result.error) {
          errorMsg.textContent = result.error.message || 'Failed to create account.';
          errorMsg.classList.add('show');
          submitBtn.disabled = false;
          submitBtn.querySelector('span').textContent = originalText;
          return;
        }
        
        // Close modal
        if (openLayer) hardClose(openLayer);
        
        // Redirect to complete profile
        window.location.href = 'complete-profile.html';
        
      } catch (error) {
        console.error('Sign-up error:', error);
        errorMsg.textContent = 'An unexpected error occurred. Please try again.';
        errorMsg.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = originalText;
      }
    });
  }
  
  // Add Google OAuth button to both login and signup tabs
  function addGoogleButtons() {
    // Add to login tab
    var loginForm = document.getElementById('login-form');
    if (loginForm && !document.getElementById('google-login-btn')) {
      var loginSubmitBtn = loginForm.querySelector('button[type="submit"]');
      if (loginSubmitBtn) {
        addGoogleButtonToForm(loginForm, loginSubmitBtn, 'google-login-btn', 'Sign in with Google');
      }
    }
    
    // Add to signup tab
    var signupForm = document.getElementById('signup-form');
    if (signupForm && !document.getElementById('google-signup-btn')) {
      var signupSubmitBtn = signupForm.querySelector('button[type="submit"]');
      if (signupSubmitBtn) {
        addGoogleButtonToForm(signupForm, signupSubmitBtn, 'google-signup-btn', 'Sign up with Google');
      }
    }
  }
  
  function addGoogleButtonToForm(form, submitBtn, btnId, btnText) {
    // Create divider
    var divider = document.createElement('div');
    divider.style.cssText = 'display: flex; align-items: center; gap: 1rem; margin: 1.5rem 0; color: var(--muted); font-size: 13px; font-style: italic;';
    divider.innerHTML = '<span style="flex: 1; height: 0.5px; background: rgba(201,168,76,.4);"></span>or<span style="flex: 1; height: 0.5px; background: rgba(201,168,76,.4);"></span>';
    
    // Create Google button
    var googleBtn = document.createElement('button');
    googleBtn.id = btnId;
    googleBtn.type = 'button';
    googleBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; padding: 13px 36px; background: white; border: 1px solid rgba(201,168,76,.6); border-radius: 1px; font-family: "EB Garamond", serif; font-size: 15px; color: var(--ink); cursor: pointer; transition: all .3s;';
    googleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg><span>' + btnText + '</span>';
    
    googleBtn.addEventListener('click', async function() {
      try {
        var result = await window.SupabaseClient.signInWithGoogle();
        if (result.error) {
          console.error('Google OAuth error:', result.error);
          alert('Google sign-in failed: ' + (result.error.message || result.error.description || JSON.stringify(result.error)));
        }
        // OAuth will redirect automatically
      } catch (error) {
        console.error('Google OAuth exception:', error);
        alert('Failed to sign in with Google: ' + (error.message || error));
      }
    });
    
    // Insert after submit button
    submitBtn.parentNode.insertBefore(divider, submitBtn.nextSibling);
    divider.parentNode.insertBefore(googleBtn, divider.nextSibling);
  }
  
  // Add Google buttons when modal opens
  setTimeout(addGoogleButtons, 100);
})();
