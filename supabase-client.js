(function() {
  'use strict';

  /* ══════════════════════════════════════════════
     SUPABASE CLIENT & HELPERS
     Handles database operations for user progress,
     reflections, and completion tracking
     ══════════════════════════════════════════════ */

  /* Supabase Configuration — read from injected config if available */
  const config = (typeof window !== 'undefined' && window.LRA_CONFIG) ? window.LRA_CONFIG.supabase : {};
  const SUPABASE_URL = config.url || 'https://swapiobhcpgufihykoqx.supabase.co';
  const SUPABASE_ANON_KEY = config.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXBpb2JoY3BndWZpaHlrb3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4Njc3NTQsImV4cCI6MjA5OTQ0Mzc1NH0.axQuZbOJKLkcL8uC3BTq-GAnX44OylX-fQBXzBA1kp8';
  const APP_BASE_URL_OVERRIDE = (typeof window !== 'undefined' && window.LRA_CONFIG)
    ? (window.LRA_CONFIG.siteUrl || (window.LRA_CONFIG.site && window.LRA_CONFIG.site.publicUrl) || null)
    : null;

  function resolveAppBaseUrl() {
    if (APP_BASE_URL_OVERRIDE) return APP_BASE_URL_OVERRIDE;
    if (typeof window !== 'undefined') {
      var host = window.location.hostname;
      if (host === '127.0.0.1' || host === 'localhost') {
        // Use the current port from window.location for local development
        return window.location.origin;
      }
    }
    return 'https://ladyrabia.vercel.app';
  }

  /* Initialize Supabase client */
  let supabase = null;
  let currentUser = null;
  let currentUserProfile = null;
  
  function initSupabase() {
    if (typeof window.supabase === 'undefined') {
      console.warn('Supabase JS library not loaded.');
      return null;
    }
    
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Set up auth state listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await loadCurrentUser();
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
          currentUserProfile = null;
        }
      });
      
      return supabase;
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      return null;
    }
  }

  /* Load current user and profile */
  async function loadCurrentUser() {
    if (!supabase) return null;
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        currentUser = null;
        currentUserProfile = null;
        return null;
      }
      
      currentUser = user;
      
      // Fetch user profile from users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();
      
      if (!profileError && profile) {
        currentUserProfile = profile;
      }
      
      return { user, profile: currentUserProfile };
    } catch (error) {
      console.error('Failed to load user:', error);
      return null;
    }
  }

  /* Get current user with profile */
  async function getCurrentUser() {
    // Always fetch fresh data to avoid stale cache issues
    return await loadCurrentUser();
  }

  /* Force-refresh the cached current user and profile */
  async function refreshCurrentUser() {
    return await loadCurrentUser();
  }

  /* Get current session (for access token) */
  async function getSession() {
    if (!supabase) return { data: { session: null }, error: 'Supabase not initialized' };
    return await supabase.auth.getSession();
  }

  /* Check if user is admin */
  async function isAdmin() {
    const userData = await getCurrentUser();
    return userData && userData.profile && userData.profile.role === 'admin';
  }

  /* Authentication functions */
  async function signUpWithEmail(email, password, profileData) {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: profileData, // Store in user metadata
          emailRedirectTo: resolveAppBaseUrl() + '/complete-profile.html'
        }
      });
      
      if (error) return { error };
      
      if (data.user) {
        // Save profile fields (name, surname, contact number) to users table
        if (profileData) {
          await updateUserProfile(data.user.id, profileData);
        }
        
        // Auto sign-in happens if email confirmation is disabled
        await loadCurrentUser();
        
        // Auto-sync to Brevo and send welcome email (non-blocking best-effort)
        try {
          if (window.BrevoEmailService) {
            const userProfile = {
              email: email,
              name: (profileData && profileData.name) || '',
              surname: (profileData && profileData.surname) || '',
              contact_number: (profileData && profileData.contactNumber) || '',
              role: 'member',
              created_at: new Date().toISOString(),
              is_active: true
            };
            await window.BrevoEmailService.syncContactToBrevo(userProfile);
            await window.BrevoEmailService.sendWelcomeEmail(userProfile);
          }
        } catch (e) {
          console.warn('[Brevo] Post-signup sync failed (non-fatal):', e);
        }
      }
      
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function signInWithEmail(email, password) {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) return { error };
      
      await loadCurrentUser();
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      console.error('signInWithGoogle: Supabase not initialized');
      return { error: 'Supabase not initialized' };
    }
    
    try {
      // Build the redirect URL - always go to complete-profile first to collect all details
      var redirectTo = resolveAppBaseUrl() + '/complete-profile.html';
      console.log('Google OAuth redirectTo:', redirectTo);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo
        }
      });
      
      if (error) {
        console.error('Supabase signInWithOAuth error:', error);
        return { error };
      }
      
      // Supabase will handle the redirect automatically
      return { data };
    } catch (error) {
      console.error('signInWithGoogle exception:', error);
      return { error };
    }
  }

  async function signOut() {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { error } = await supabase.auth.signOut();
      currentUser = null;
      currentUserProfile = null;
      return { error };
    } catch (error) {
      return { error };
    }
  }

  async function requestPasswordReset(email) {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const redirectTo = resolveAppBaseUrl() + '/update-password.html';
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo
      });
      
      if (error) return { error };
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function updatePassword(newPassword) {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) return { error };
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  /* Admin Content Management */
  /* Outseta-authenticated admins have no Supabase Auth session, so the
     RLS-gated calls below (all keyed off auth.uid()) can't authorize their
     writes. When signed in that way, route through the service-role
     admin-gateway Edge Function instead — same return shape either way, so
     call sites in admin-dashboard.html never need to know which path ran. */
  function useOutsetaAdminGateway() {
    return !!(window.LRAAuth && window.LRAAuth.isAdmin && window.LRAAuth.isAdmin());
  }

  async function callAdminGateway(action, fields) {
    try {
      const token = window.LRAAuth.getAccessToken();
      const res = await fetch(SUPABASE_URL + '/functions/v1/admin-gateway', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: action }, fields || {})),
      });
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok) return { error: { message: json.error || 'Request failed' } };
      return { data: json.data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function callAdminGatewayUpload(file, bucket, path) {
    try {
      const token = window.LRAAuth.getAccessToken();
      const form = new FormData();
      form.append('action', 'uploadAsset');
      form.append('file', file);
      form.append('bucket', bucket);
      form.append('path', path);
      const res = await fetch(SUPABASE_URL + '/functions/v1/admin-gateway', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
      });
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok) return { error: { message: json.error || 'Upload failed' } };
      return { data: json.data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function uploadAsset(file, bucket, path) {
    if (useOutsetaAdminGateway()) return callAdminGatewayUpload(file, bucket, path);
    if (!supabase) return { error: 'Supabase not initialized' };

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) return { error };
      return { data: { path: data.path }, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function createSignedUrl(bucket, path, expiresIn = 3600) {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
      
      if (error) return { error };
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function deleteAsset(bucket, path) {
    if (useOutsetaAdminGateway()) return callAdminGateway('deleteAsset', { bucket: bucket, path: path });
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .remove([path]);
      
      if (error) return { error };
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function upsertContentModule(moduleData) {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase
        .from('content_modules')
        .upsert({
          ...moduleData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'slug'
        })
        .select()
        .single();
      
      if (error) return { error };
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function updateContentModule(slug, fields) {
    if (useOutsetaAdminGateway()) return callAdminGateway('updateContentModule', { slug: slug, fields: fields });
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase
        .from('content_modules')
        .update({
          ...fields,
          updated_at: new Date().toISOString()
        })
        .eq('slug', slug)
        .select()
        .single();
      
      if (error) return { error };
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function getModulesAdmin(filters = {}) {
    if (useOutsetaAdminGateway()) return callAdminGateway('getModulesAdmin', { month: filters.month });
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      let query = supabase
        .from('content_modules')
        .select('*')
        .order('month', { ascending: true })
        .order('week', { ascending: true });
      
      if (filters.month) {
        query = query.eq('month', filters.month);
      }
      
      const { data, error } = await query;
      
      if (error) return { error };
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  async function deleteContentModule(slug) {
    if (useOutsetaAdminGateway()) return callAdminGateway('deleteContentModule', { slug: slug });
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { error } = await supabase
        .from('content_modules')
        .delete()
        .eq('slug', slug);
      
      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async function getModulesForMembers() {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase
        .from('content_modules')
        .select('*')
        .neq('is_disabled', true)  // Include NULL and false - only exclude explicitly disabled modules
        .order('month', { ascending: true })
        .order('week', { ascending: true });

      if (error) {
        console.error('[getModulesForMembers] Query error:', error);
        return { error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('[getModulesForMembers] Exception:', error);
      return { error };
    }
  }

  async function getSignedAssetsForModule(module) {
    if (useOutsetaAdminGateway()) return callAdminGateway('getSignedAssetsForModule', { moduleData: module });
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const assets = {};

      // These are three independent Storage round-trips — run them
      // concurrently instead of one after another.
      const jobs = [];
      if (module.audio_path) {
        jobs.push(
          createSignedUrl(module.audio_path.split('/')[0], module.audio_path, 600)
            .then(function(res) { if (!res.error && res.data) assets.audioUrl = res.data; })
        );
      }
      if (module.pdf_path) {
        jobs.push(
          createSignedUrl(module.pdf_path.split('/')[0], module.pdf_path, 600)
            .then(function(res) { if (!res.error && res.data) assets.pdfUrl = res.data; })
        );
      }
      if (module.image_path) {
        jobs.push(
          createSignedUrl(module.image_path.split('/')[0], module.image_path, 600)
            .then(function(res) { if (!res.error && res.data) assets.imageUrl = res.data; })
        );
      }
      await Promise.all(jobs);

      return { data: assets, error: null };
    } catch (error) {
      return { error };
    }
  }

  /* Profile management */
  async function getUserProfile(authId) {
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authId)
        .single();
      
      if (error) {
        console.error('Failed to fetch profile:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }

  async function createContentModule(moduleData) {
    if (useOutsetaAdminGateway()) return callAdminGateway('createContentModule', { moduleData: moduleData });
    if (!supabase) return { error: 'Supabase not initialized' };

    try {
      // Generate slug from month-week-type
      const monthPart = moduleData.month.replace('-', '');
      const weekPart = `w${moduleData.week}`;
      const typePart = moduleData.type.toLowerCase();
      const slug = `${monthPart}-${weekPart}-${typePart}`;

      const { data, error } = await supabase
        .from('content_modules')
        .insert({
          slug: slug,
          month: moduleData.month,
          week: moduleData.week,
          type: moduleData.type,
          title: moduleData.title || '',
          description: moduleData.description || '',
          reflection_prompt: moduleData.reflectionPrompt || null,
          auto_release_after_days: moduleData.autoReleaseAfterDays || null,
          release_date: moduleData.releaseDate || new Date().toISOString(),
          order_index: moduleData.week || 1,
          is_published: false,
          is_disabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) return { error };
      
      return { data, error: null };
    } catch (error) {
      console.error('Failed to create module:', error);
      return { error };
    }
  }

  async function updateUserProfile(authId, profileData) {
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          name: profileData.name,
          surname: profileData.surname,
          contact_number: profileData.contactNumber,
          updated_at: new Date().toISOString()
        })
        .eq('auth_id', authId)
        .select()
        .single();
      
      if (error) return { error };
      
      // Update cached profile
      if (currentUser && currentUser.id === authId) {
        currentUserProfile = data;
      }
      
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  /* ══════════════════════════════════════════════
     ADMIN FUNCTIONS
     ══════════════════════════════════════════════ */

  async function getAllUsers() {
    if (useOutsetaAdminGateway()) {
      const result = await callAdminGateway('getAllUsers', {});
      return { data: result.data || [], error: result.error };
    }
    if (!supabase) return { data: [], error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching users:', error);
        return { data: [], error };
      }
      
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { data: [], error };
    }
  }

  async function updateUserRole(userId, newRole) {
    if (useOutsetaAdminGateway()) return callAdminGateway('updateUserRole', { userId: userId, newRole: newRole });
    if (!supabase) return { error: 'Supabase not initialized' };
    
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) return { error };
      
      return { data, error: null };
    } catch (error) {
      return { error };
    }
  }

  /* Map dashboard slugs to database slugs */
  function mapModuleSlug(dashboardSlug) {
    // Dashboard uses 'jul-w1', database uses '2026-07-w1'
    var mapping = {
      'may-w1': '2026-05-w1', 'may-w2': '2026-05-w2', 'may-w3': '2026-05-w3', 'may-w4': '2026-05-w4',
      'jun-w1': '2026-06-w1', 'jun-w2': '2026-06-w2', 'jun-w3': '2026-06-w3', 'jun-w4': '2026-06-w4',
      'jul-w1': '2026-07-w1', 'jul-w2': '2026-07-w2', 'jul-w3': '2026-07-w3', 'jul-w4': '2026-07-w4'
    };
    return mapping[dashboardSlug] || dashboardSlug;
  }

  /* Resolve module slug to content_modules UUID (user_progress.module_id is a uuid FK) */
  var moduleUuidCache = {};
  async function resolveModuleUuid(moduleId) {
    var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(moduleId)) return moduleId;
    if (moduleUuidCache[moduleId]) return moduleUuidCache[moduleId];
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('content_modules')
        .select('id')
        .eq('slug', moduleId)
        .maybeSingle();
      if (!error && data && data.id) {
        moduleUuidCache[moduleId] = data.id;
        return data.id;
      }
    } catch (e) {
      console.warn('resolveModuleUuid failed for', moduleId, e);
    }
    return null;
  }

  /* LocalStorage fallback for mock mode.
     Keyed per-user (falling back to 'anon') so two members on the same
     device/browser never read or overwrite each other's completion state. */
  var STORAGE_PREFIX = 'lra_progress_';

  function localProgressKey(moduleId) {
    var userId = currentUser ? currentUser.id : 'anon';
    return STORAGE_PREFIX + userId + '_' + moduleId;
  }

  function getLocalProgress(moduleId) {
    try {
      var data = localStorage.getItem(localProgressKey(moduleId));
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function setLocalProgress(moduleId, data) {
    try {
      localStorage.setItem(localProgressKey(moduleId), JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ══════════════════════════════════════════════
     USER PROGRESS OPERATIONS
     ══════════════════════════════════════════════ */

  /**
   * Get user progress for a specific module
   * @param {string} moduleId - The content module ID
   * @returns {Promise<Object|null>} User progress data or null
   */
  async function getUserProgress(moduleId) {
    // user_progress.user_id is a FK to public.users.id (the profile row),
    // NOT the Supabase auth uid — using currentUser.id here would violate
    // the FK on every write and silently fail (caught below), which is why
    // completion status was never actually persisting to the server before.
    var userId = currentUserProfile ? currentUserProfile.id : null;

    // Authenticated users: server is the source of truth (cross-device sync)
    if (supabase && userId) {
      try {
        var moduleUuid = await resolveModuleUuid(moduleId);
        if (moduleUuid) {
          const { data, error } = await supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', userId)
            .eq('module_id', moduleUuid)
            .maybeSingle();
          if (!error && data) {
            setLocalProgress(moduleId, data); // keep local copy in sync
            return data;
          }
          if (!error && !data) {
            // No server row yet: seed from localStorage if the user has local
            // progress (e.g. from before this fix), otherwise return default
            var localSeed = getLocalProgress(moduleId);
            if (localSeed) return localSeed;
            return {
              user_id: userId,
              module_id: moduleId,
              status: 'available',
              notes: { reflections: [] },
              completed_at: null
            };
          }
        }
      } catch (e) {
        console.warn('getUserProgress Supabase fetch failed:', e);
        // Fall through to localStorage on network failure
      }
    }

    // Anonymous / offline fallback
    var localData = getLocalProgress(moduleId);
    if (localData) {
      return localData;
    }

    // Initialize default structure
    return {
      user_id: userId || 'anonymous',
      module_id: moduleId,
      status: 'available',
      notes: { reflections: [] },
      completed_at: null
    };
  }

  /**
   * Update completion status for a module
   * @param {string} moduleId - The content module ID
   * @param {boolean} isComplete - Whether the module is complete
   * @returns {Promise<boolean>} Success status
   */
  async function updateCompletionStatus(moduleId, isComplete) {
    var progress = await getUserProgress(moduleId);
    var now = new Date().toISOString();
    
    progress.status = isComplete ? 'completed' : 'in_progress';
    progress.completed_at = isComplete ? now : null;
    progress.updated_at = now;
    
    var saved = setLocalProgress(moduleId, progress);
    
    // Persist to Supabase for real users
    // user_progress.user_id is a FK to public.users.id (the profile row),
    // NOT the Supabase auth uid — using currentUser.id here would violate
    // the FK on every write and silently fail (caught below), which is why
    // completion status was never actually persisting to the server before.
    var userId = currentUserProfile ? currentUserProfile.id : null;
    if (supabase && userId) {
      try {
        var moduleUuid = await resolveModuleUuid(moduleId);
        if (moduleUuid) {
          progress.user_id = userId;
          const { error } = await supabase
            .from('user_progress')
            .upsert({
              user_id: userId,
              module_id: moduleUuid,
              status: progress.status,
              notes: progress.notes || { reflections: [] },
              has_reflection: progress.has_reflection === true,
              has_listened_fully: progress.has_listened_fully === true,
              completed_at: progress.completed_at,
              updated_at: now
            }, { onConflict: 'user_id,module_id' });
          if (error) console.warn('updateCompletionStatus Supabase upsert failed:', error);
        }
      } catch (e) {
        console.warn('updateCompletionStatus Supabase persist failed:', e);
      }
    }
    
    return saved;
  }

  /* ══════════════════════════════════════════════
     REFLECTIONS OPERATIONS (JSONB)
     ══════════════════════════════════════════════ */

  /**
   * Generate a simple UUID v4
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get all reflections for a module
   * @param {string} moduleId - The content module ID
   * @returns {Promise<Array>} Array of reflections
   */
  async function getReflections(moduleId) {
    const progress = await getUserProgress(moduleId);
    
    if (!progress || !progress.notes) {
      return [];
    }

    // Handle both JSONB object and plain array formats
    if (progress.notes.reflections && Array.isArray(progress.notes.reflections)) {
      return progress.notes.reflections;
    } else if (Array.isArray(progress.notes)) {
      return progress.notes;
    }

    return [];
  }

  /**
   * Add a new reflection
   * @param {string} moduleId - The content module ID
   * @param {string} content - Reflection content
   * @returns {Promise<Object|null>} New reflection object or null
   */
  async function addReflection(moduleId, content) {
    if (!content || !content.trim()) {
      console.error('Reflection content cannot be empty');
      return null;
    }

    const reflections = await getReflections(moduleId);
    
    const newReflection = {
      id: generateUUID(),
      content: content.trim(),
      timestamp: new Date().toISOString(),
      edited: false
    };

    reflections.push(newReflection);

    const success = await saveReflections(moduleId, reflections);
    return success ? newReflection : null;
  }

  /**
   * Update an existing reflection
   * @param {string} moduleId - The content module ID
   * @param {string} reflectionId - The reflection ID to update
   * @param {string} newContent - New content
   * @returns {Promise<boolean>} Success status
   */
  async function updateReflection(moduleId, reflectionId, newContent) {
    if (!newContent || !newContent.trim()) {
      console.error('Reflection content cannot be empty');
      return false;
    }

    const reflections = await getReflections(moduleId);
    const index = reflections.findIndex(r => r.id === reflectionId);

    if (index === -1) {
      console.error('Reflection not found');
      return false;
    }

    reflections[index].content = newContent.trim();
    reflections[index].edited = true;
    reflections[index].editedAt = new Date().toISOString();

    return await saveReflections(moduleId, reflections);
  }

  /**
   * Delete a reflection
   * @param {string} moduleId - The content module ID
   * @param {string} reflectionId - The reflection ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async function deleteReflection(moduleId, reflectionId) {
    const reflections = await getReflections(moduleId);
    const filtered = reflections.filter(r => r.id !== reflectionId);

    if (filtered.length === reflections.length) {
      console.error('Reflection not found');
      return false;
    }

    return await saveReflections(moduleId, filtered);
  }

  /**
   * Save reflections array to database
   * @param {string} moduleId - The content module ID
   * @param {Array} reflections - Array of reflections
   * @returns {Promise<boolean>} Success status
   */
  async function saveReflections(moduleId, reflections) {
    var progress = await getUserProgress(moduleId);
    var now = new Date().toISOString();
    
    progress.notes = { reflections: reflections };
    progress.has_reflection = reflections.length > 0;
    progress.updated_at = now;
    
    var saved = setLocalProgress(moduleId, progress);
    
    // Persist to Supabase for real users
    // user_progress.user_id is a FK to public.users.id (the profile row),
    // NOT the Supabase auth uid — using currentUser.id here would violate
    // the FK on every write and silently fail (caught below), which is why
    // completion status was never actually persisting to the server before.
    var userId = currentUserProfile ? currentUserProfile.id : null;
    if (supabase && userId) {
      try {
        var moduleUuid = await resolveModuleUuid(moduleId);
        if (moduleUuid) {
          await supabase
            .from('user_progress')
            .upsert({
              user_id: userId,
              module_id: moduleUuid,
              status: progress.status || 'in_progress',
              notes: progress.notes,
              listen_progress_seconds: progress.listen_progress_seconds || 0,
              has_reflection: progress.has_reflection === true,
              has_listened_fully: progress.has_listened_fully === true,
              updated_at: now
            }, { onConflict: 'user_id,module_id' });
        }
      } catch (e) {
        console.warn('saveReflections Supabase persist failed:', e);
      }
    }
    
    return saved;
  }

  /* ══════════════════════════════════════════════
     AUDIO PLAYBACK TRACKING
     ══════════════════════════════════════════════ */

  /**
   * Update audio listen progress
   * @param {string} moduleId - The content module ID
   * @param {number} seconds - Current playback position in seconds
   * @returns {Promise<boolean>} Success status
   */
  async function updateListenProgress(moduleId, seconds) {
    var progress = await getUserProgress(moduleId);
    var now = new Date().toISOString();
    
    progress.listen_progress_seconds = Math.floor(seconds);
    progress.updated_at = now;
    
    var saved = setLocalProgress(moduleId, progress);
    
    // Persist to Supabase for real users
    // user_progress.user_id is a FK to public.users.id (the profile row),
    // NOT the Supabase auth uid — using currentUser.id here would violate
    // the FK on every write and silently fail (caught below), which is why
    // completion status was never actually persisting to the server before.
    var userId = currentUserProfile ? currentUserProfile.id : null;
    if (supabase && userId) {
      try {
        var moduleUuid = await resolveModuleUuid(moduleId);
        if (moduleUuid) {
          await supabase
            .from('user_progress')
            .upsert({
              user_id: userId,
              module_id: moduleUuid,
              status: progress.status || 'in_progress',
              notes: progress.notes || { reflections: [] },
              listen_progress_seconds: progress.listen_progress_seconds,
              has_reflection: progress.has_reflection === true,
              has_listened_fully: progress.has_listened_fully === true,
              updated_at: now
            }, { onConflict: 'user_id,module_id' });
        }
      } catch (e) {
        console.warn('updateListenProgress Supabase persist failed:', e);
      }
    }
    
    return saved;
  }

  /**
   * Mark audio as fully listened
   * @param {string} moduleId - The content module ID
   * @param {boolean} listened - Whether audio was fully listened
   * @returns {Promise<boolean>} Success status
   */
  async function markAudioListenedFully(moduleId, listened) {
    var progress = await getUserProgress(moduleId);
    var now = new Date().toISOString();
    
    progress.has_listened_fully = listened;
    progress.updated_at = now;
    
    var saved = setLocalProgress(moduleId, progress);
    
    // Persist to Supabase for real users
    // user_progress.user_id is a FK to public.users.id (the profile row),
    // NOT the Supabase auth uid — using currentUser.id here would violate
    // the FK on every write and silently fail (caught below), which is why
    // completion status was never actually persisting to the server before.
    var userId = currentUserProfile ? currentUserProfile.id : null;
    if (supabase && userId) {
      try {
        var moduleUuid = await resolveModuleUuid(moduleId);
        if (moduleUuid) {
          await supabase
            .from('user_progress')
            .upsert({
              user_id: userId,
              module_id: moduleUuid,
              status: progress.status || 'in_progress',
              notes: progress.notes || { reflections: [] },
              listen_progress_seconds: progress.listen_progress_seconds || 0,
              has_reflection: progress.has_reflection === true,
              has_listened_fully: progress.has_listened_fully === true,
              updated_at: now
            }, { onConflict: 'user_id,module_id' });
        }
      } catch (e) {
        console.warn('markAudioListenedFully Supabase persist failed:', e);
      }
    }
    
    return saved;
  }

  /**
   * Get signed URL for audio file from Supabase Storage
   * @param {string} storagePath - Path in storage bucket (e.g., 'audio-content/2026-07-w1.mp3')
   * @returns {Promise<string|null>} Signed URL or null
   */
  async function getAudioSignedUrl(storagePath) {
    if (!supabase || !storagePath) return null;
    
    try {
      // Extract bucket and path
      var parts = storagePath.split('/');
      var bucket = parts[0];
      var filePath = parts.slice(1).join('/');
      
      var { data, error } = await supabase
        .storage
        .from(bucket)
        .createSignedUrl(filePath, 3600); // 1 hour expiration
      
      if (error) {
        console.error('Failed to generate signed URL:', error);
        return null;
      }
      
      return data.signedUrl;
    } catch (e) {
      console.error('Error generating signed URL:', e);
      return null;
    }
  }

  /* ══════════════════════════════════════════════
     CONTENT AVAILABILITY (COMPLETION-BASED UNLOCK)
     ══════════════════════════════════════════════ */

  /**
   * Get available content with completion-based unlock logic
   * @param {string} userId - User ID
   * @param {Array} modules - Array of content modules from dashboard
   * @returns {Promise<Array>} Content array with computed states
   */
  async function getAvailableContent(userId, modules) {
    // Build progress map with two bulk queries instead of N+1 per-module fetches
    var progressMap = {};

    if (supabase && userId) {
      try {
        var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        var slugs = modules.map(function(m) { return m.id; }).filter(function(id) { return !uuidRegex.test(id); });

        // Bulk: resolve all slugs to UUIDs in one query
        var slugToUuid = {};
        if (slugs.length) {
          const { data: moduleRows, error: modErr } = await supabase
            .from('content_modules')
            .select('id, slug')
            .in('slug', slugs);
          if (!modErr && moduleRows) {
            moduleRows.forEach(function(r) {
              slugToUuid[r.slug] = r.id;
              moduleUuidCache[r.slug] = r.id;
            });
          }
        }

        // Bulk: fetch ALL progress rows for this user in one query
        const { data: progressRows, error: progErr } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userId);

        var progressByUuid = {};
        if (!progErr && progressRows) {
          progressRows.forEach(function(r) { progressByUuid[r.module_id] = r; });
        }

        modules.forEach(function(module) {
          var uuid = uuidRegex.test(module.id) ? module.id : slugToUuid[module.id];
          var row = uuid ? progressByUuid[uuid] : null;
          if (row) {
            setLocalProgress(module.id, row); // keep local copy in sync
            progressMap[module.id] = row;
          } else {
            var local = getLocalProgress(module.id);
            progressMap[module.id] = local || {
              user_id: userId,
              module_id: module.id,
              status: 'available',
              notes: { reflections: [] },
              completed_at: null
            };
          }
        });
      } catch (e) {
        console.warn('getAvailableContent bulk fetch failed, falling back:', e);
        var fallbackResults = await Promise.all(modules.map(function(module) {
          return getUserProgress(module.id);
        }));
        modules.forEach(function(module, i) {
          progressMap[module.id] = fallbackResults[i];
        });
      }
    } else {
      // Anonymous/offline: localStorage only
      var localResults = await Promise.all(modules.map(function(module) {
        return getUserProgress(module.id);
      }));
      modules.forEach(function(module, i) {
        progressMap[module.id] = localResults[i];
      });
    }
    
    var now = new Date(); // Full datetime comparison (includes hours/minutes)
    
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    function formatReleaseLabel(dateStr) {
      var dt = new Date(dateStr);
      var dateLabel = months[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
      var timeLabel = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return 'Releases on ' + dateLabel + ' at ' + timeLabel;
    }
    
    function isFullyComplete(progress) {
      // The Mark Complete button already enforces audio + reflection before
      // allowing completion, so status='completed' is sufficient proof.
      // Legacy rows may lack the has_reflection/has_listened_fully flags.
      return !!(progress && progress.status === 'completed');
    }

    // Build ONE global chronological sequence across every month, not a
    // per-month restart. 'month' is 'YYYY-MM' so it sorts chronologically
    // as a string; 'week' orders the items within a month. Only the very
    // first item in this whole timeline is free by default — every other
    // item requires the item immediately before it (in this global order,
    // regardless of month) to be fully complete.
    var activeModules = modules.filter(function(module) {
      // Filter out disabled modules - they are completely hidden from members
      return !module.is_disabled;
    });
    var sequence = activeModules.slice().sort(function(a, b) {
      if (a.month !== b.month) return a.month < b.month ? -1 : 1;
      return a.week - b.week;
    });
    var prevModuleById = {};
    for (var i = 1; i < sequence.length; i++) {
      prevModuleById[sequence[i].id] = sequence[i - 1];
    }

    // Compute unlock status for each module
    var contentWithStatus = activeModules.map(function(module) {
        var userProgress = progressMap[module.id];

        var state = 'locked';
        var unlockAfter = null;

        // Check if release datetime has passed (full datetime comparison)
        var isReleased = true; // Default: no date restriction
        if (module.release_date) {
          var releaseDate = new Date(module.release_date);
          isReleased = now >= releaseDate;
        }

        var releaseLabel = module.release_date ? formatReleaseLabel(module.release_date) : null;

        // Unpublished modules are locked with schedule info
        if (!module.is_published) {
          state = 'locked';
          unlockAfter = releaseLabel || 'Not yet released';
        }
        // Published but release datetime hasn't arrived → locked until scheduled time
        else if (!isReleased) {
          state = 'locked';
          unlockAfter = releaseLabel;
        }
        else if (isFullyComplete(userProgress)) {
          // Already completed — stays unlocked forever, even if a later
          // stricter re-check of the chain would otherwise lock it.
          state = 'complete';
        }
        else {
          var prevModule = prevModuleById[module.id];
          if (!prevModule) {
            // The very first item in the global sequence: always available
            // once released (subject to the publish/date checks above).
            state = 'current';
          } else if (isFullyComplete(progressMap[prevModule.id])) {
            state = 'current';
          } else {
            state = 'locked';
            unlockAfter = 'Complete Week ' + prevModule.week + ' (' + prevModule.month + ') to unlock';
          }
        }

        return {
          id: module.id,
          month: module.month,
          week: module.week,
          type: module.type,
          state: state,
          title: module.title,
          note: module.note,
          unlockAfter: unlockAfter,
          status: userProgress.status || 'available'
        };
      });
    
    console.log('[getAvailableContent] ✓ Returning', contentWithStatus.length, 'modules with computed states');
    return contentWithStatus;
  }

  /* ══════════════════════════════════════════════
     STRIPE SUBSCRIPTION FUNCTIONS
     ══════════════════════════════════════════════ */

  async function callStripeFunction(functionName, body) {
    if (!supabase) return { error: { message: 'Supabase not initialized' } };
    var sessionRes = await supabase.auth.getSession();
    var accessToken = sessionRes.data && sessionRes.data.session && sessionRes.data.session.access_token;
    if (!accessToken) return { error: { message: 'Not signed in' } };

    try {
      var res = await fetch(SUPABASE_URL + '/functions/v1/' + functionName, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + accessToken
        },
        body: JSON.stringify(Object.assign({ origin: resolveAppBaseUrl() }, body || {}))
      });
      var data = await res.json().catch(function() { return {}; });
      if (!res.ok) return { error: data && data.error ? { message: data.error } : { message: 'Request failed (' + res.status + ')' } };
      return { data: data, error: null };
    } catch (e) {
      return { error: { message: e.message || 'Network error' } };
    }
  }

  /**
   * Start a Stripe Checkout session for a membership plan.
   * @param {string} plan - 'founding' or 'standard'
   * @returns {Promise<{data?: {url: string}, error?: object}>}
   */
  async function createCheckoutSession(plan) {
    return callStripeFunction('stripe-create-checkout-session', { plan: plan });
  }

  /** Schedule the caller's subscription to cancel at the end of the current billing period. */
  async function cancelSubscription() {
    return callStripeFunction('stripe-cancel-subscription', {});
  }

  /** Undo a scheduled cancellation before the period ends. */
  async function resumeSubscription() {
    return callStripeFunction('stripe-cancel-subscription', { resume: true });
  }

  /** Open the Stripe-hosted billing portal (update card, view invoices, cancel). */
  async function createBillingPortalSession() {
    return callStripeFunction('stripe-create-portal-session', {});
  }

  /**
   * Get the current user's subscription row directly (protected by RLS —
   * each user can only read their own row).
   * @returns {Promise<object|null>}
   */
  async function getSubscription() {
    if (!supabase) return null;
    if (!currentUser) await loadCurrentUser();
    if (!currentUser) return null;
    try {
      var res = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (res.error) {
        console.warn('getSubscription failed:', res.error);
        return null;
      }
      return res.data;
    } catch (e) {
      console.warn('getSubscription exception:', e);
      return null;
    }
  }

  /* ══════════════════════════════════════════════
     INITIALIZATION & EXPORTS
     ══════════════════════════════════════════════ */

  /* Initialize on load */
  initSupabase();

  /* Export API */
  window.SupabaseClient = {
    // Auth functions
    getCurrentUser,
    refreshCurrentUser,
    getSession,
    
    // Module management
    createContentModule,
    isAdmin,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    requestPasswordReset,
    updatePassword,
    getUserProfile,
    updateUserProfile,
    // Admin functions
    getAllUsers,
    updateUserRole,
    uploadAsset,
    createSignedUrl,
    deleteAsset,
    upsertContentModule,
    updateContentModule,
    getModulesAdmin,
    deleteContentModule,
    getModulesForMembers,
    getSignedAssetsForModule,
    // Progress functions
    getUserProgress,
    updateCompletionStatus,
    getReflections,
    addReflection,
    updateReflection,
    deleteReflection,
    updateListenProgress,
    markAudioListenedFully,
    getAudioSignedUrl,
    getAvailableContent,
    // Stripe subscription functions
    createCheckoutSession,
    cancelSubscription,
    resumeSubscription,
    createBillingPortalSession,
    getSubscription
  };

})();
