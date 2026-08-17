/* PROFILE MODAL SYSTEM
   Displays and allows editing of user profile information */
(function () {
  if (document.getElementById('modal-profile')) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Add modal CSS */
  var css = document.createElement('style');
  css.textContent =
    '.modal-layer { position: fixed; inset: 0; z-index: 200; display: none; }' +
    '.modal-layer.open { display: block; }' +
    '.modal-backdrop { position: absolute; inset: 0; background: rgba(20,46,31,.55); backdrop-filter: blur(10px); opacity: 0; }' +
    '.modal-positioner { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1.5rem; overflow-y: auto; }' +
    '.modal-panel { position: relative; width: 100%; max-width: 480px; background: var(--ivory); border: 0.5px solid var(--gold-light); border-radius: 1px; padding: 2.6rem 2.3rem 2.4rem; box-shadow: 0 40px 80px -30px rgba(20,46,31,.55); opacity: 0; margin: auto; }' +
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
    '.profile-form { display: flex; flex-direction: column; gap: 0; }' +
    '.form-fields { border: none; display: flex; flex-direction: column; gap: 1.1rem; margin-bottom: 1.5rem; }' +
    '.field { display: flex; flex-direction: column; gap: 7px; }' +
    '.field label { font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); }' +
    '.field input { border: 0.5px solid rgba(201,168,76,.6); padding: 13px 14px; font-family: "EB Garamond", serif; font-size: 15px; background: var(--ivory); color: var(--ink); border-radius: 1px; outline: none; transition: border-color .3s; width: 100%; }' +
    '.field input:focus { border-color: var(--gold); }' +
    '.field input:disabled { background: var(--ivory-warm); color: var(--muted); }' +
    '.modal-panel .btn-primary { display: block; width: 100%; text-align: center; background: var(--green); color: var(--ivory); font-family: "EB Garamond", serif; font-size: 15px; letter-spacing: .08em; padding: 15px 36px; border: none; cursor: pointer; border-radius: 1px; text-decoration: none; position: relative; overflow: hidden; transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s; }' +
    '.modal-panel .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -12px rgba(27,60,40,.55); }' +
    '.modal-panel .btn-primary span { position: relative; z-index: 1; }' +
    '.modal-panel .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }' +
    '.profile-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }' +
    '.btn-secondary { flex: 1; text-align: center; background: transparent; color: var(--muted); font-family: "EB Garamond", serif; font-size: 14px; letter-spacing: .08em; padding: 12px 24px; border: 1px solid rgba(201,168,76,.4); cursor: pointer; border-radius: 1px; transition: all .3s; }' +
    '.btn-secondary:hover { border-color: var(--gold); color: var(--green); background: rgba(181,134,13,.05); }' +
    '.error-message { background: rgba(169,68,66,.1); border: 1px solid rgba(169,68,66,.3); color: #a94442; padding: 12px 14px; border-radius: 1px; font-size: 14px; margin-bottom: 1rem; display: none; }' +
    '.error-message.show { display: block; }' +
    '.success-message { background: rgba(27,60,40,.1); border: 1px solid rgba(27,60,40,.3); color: var(--green); padding: 12px 14px; border-radius: 1px; font-size: 14px; margin-bottom: 1rem; display: none; }' +
    '.success-message.show { display: block; }';
  document.head.appendChild(css);

  /* Add modal HTML */
  var modal = document.createElement('div');
  modal.id = 'modal-profile';
  modal.className = 'modal-layer';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'profileTitle');
  modal.innerHTML =
    '<div class="modal-backdrop" data-modal-backdrop></div>' +
    '<div class="modal-positioner">' +
      '<div class="modal-panel">' +
        '<div class="c tl"></div><div class="c tr"></div><div class="c bl"></div><div class="c br"></div>' +
        '<button class="modal-close" type="button" data-modal-close aria-label="Close">✕</button>' +
        '<header class="modal-header" data-modal-field>' +
          '<span class="section-lbl">Lady Rabi\'a Academy</span>' +
          '<h2 class="modal-title" id="profileTitle">Your Profile</h2>' +
          '<div class="modal-orn" aria-hidden="true">' +
            '<svg viewBox="0 0 120 12"><path stroke-width="0.6" d="M 0 6 H 46"/><path stroke-width="0.6" d="M 120 6 H 74"/><path stroke-width="0.7" d="M 60 0.5 L 65.5 6 L 60 11.5 L 54.5 6 Z"/></svg>' +
          '</div>' +
        '</header>' +
        '<div id="profileError" class="error-message"></div>' +
        '<div id="profileSuccess" class="success-message"></div>' +
        '<div class="embed-mount">' +
          '<form class="profile-form" id="profile-form" onsubmit="return false;">' +
            '<fieldset class="form-fields">' +
              '<div class="field" data-modal-field><label for="profile-email">Email</label><input id="profile-email" name="email" type="email" disabled></div>' +
              '<div class="field" data-modal-field><label for="profile-name">Name</label><input id="profile-name" name="name" type="text" required></div>' +
              '<div class="field" data-modal-field><label for="profile-surname">Surname</label><input id="profile-surname" name="surname" type="text" required></div>' +
              '<div class="field" data-modal-field><label for="profile-contact">Contact Number</label><input id="profile-contact" name="contact" type="tel" required></div>' +
            '</fieldset>' +
            '<button class="btn-primary" type="submit" data-modal-field id="saveProfileBtn"><span>Save Changes</span></button>' +
            '<div class="profile-actions">' +
              '<button class="btn-secondary" type="button" id="cancelProfileBtn">Cancel</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  /* Modal logic */
  var openLayer = null;
  var activeTl = null;
  var isEditing = false;

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

  async function openModal() {
    var layer = document.getElementById('modal-profile');
    if (!layer) return;
    if (openLayer) hardClose(openLayer);
    
    // Load user data
    await loadProfileData();
    
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

  async function loadProfileData() {
    try {
      var userData = await window.SupabaseClient.getCurrentUser();
      
      if (!userData || !userData.user) {
        showError('Failed to load profile data.');
        return;
      }

      document.getElementById('profile-email').value = userData.user.email || '';
      document.getElementById('profile-name').value = userData.profile?.name || '';
      document.getElementById('profile-surname').value = userData.profile?.surname || '';
      document.getElementById('profile-contact').value = userData.profile?.contact_number || '';
      
    } catch (error) {
      console.error('Failed to load profile:', error);
      showError('Failed to load profile data.');
    }
  }

  function showError(message) {
    var errorEl = document.getElementById('profileError');
    var successEl = document.getElementById('profileSuccess');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    successEl.classList.remove('show');
  }

  function showSuccess(message) {
    var errorEl = document.getElementById('profileError');
    var successEl = document.getElementById('profileSuccess');
    successEl.textContent = message;
    successEl.classList.add('show');
    errorEl.classList.remove('show');
  }

  function hideMessages() {
    document.getElementById('profileError').classList.remove('show');
    document.getElementById('profileSuccess').classList.remove('show');
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

  // Handle form submission
  var profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      hideMessages();

      var name = document.getElementById('profile-name').value.trim();
      var surname = document.getElementById('profile-surname').value.trim();
      var contact = document.getElementById('profile-contact').value.trim();

      if (!name || !surname || !contact) {
        showError('Please fill in all fields.');
        return;
      }

      var saveBtn = document.getElementById('saveProfileBtn');
      saveBtn.disabled = true;
      saveBtn.querySelector('span').textContent = 'Saving...';

      try {
        var userData = await window.SupabaseClient.getCurrentUser();
        
        if (!userData || !userData.user) {
          showError('Session expired. Please log in again.');
          return;
        }

        var result = await window.SupabaseClient.updateUserProfile(userData.user.id, {
          name: name,
          surname: surname,
          contactNumber: contact
        });

        if (result.error) {
          showError(result.error.message || 'Failed to update profile.');
          saveBtn.disabled = false;
          saveBtn.querySelector('span').textContent = 'Save Changes';
          return;
        }

        showSuccess('Profile updated successfully!');
        saveBtn.querySelector('span').textContent = 'Save Changes';
        
        // Refresh auth state to update navbar
        if (window.LRAAuth) {
          await window.LRAAuth.refresh();
        }
        
        setTimeout(function() {
          closeModal();
        }, 1500);

      } catch (error) {
        console.error('Profile update error:', error);
        showError('An unexpected error occurred. Please try again.');
        saveBtn.disabled = false;
        saveBtn.querySelector('span').textContent = 'Save Changes';
      }
    });
  }

  // Cancel button
  var cancelBtn = document.getElementById('cancelProfileBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      closeModal();
    });
  }

  /* Expose global function to open modal */
  window.openProfileModal = openModal;
  window.closeProfileModal = closeModal;

})();
