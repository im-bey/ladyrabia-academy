(function() {
  'use strict';

  /* ══════════════════════════════════════════════
     LESSON MODAL SYSTEM
     High-production modal for displaying lesson content
     with GSAP animations, audio player, and notes
     ══════════════════════════════════════════════ */

  /* Progress/reflection API — now routed through the update-progress and
     get-signed-assets Edge Functions (verified against the Outseta access
     token) instead of direct Supabase client calls under RLS. Shaped to
     match the old progressAPI.* return contracts exactly, so the
     call sites below didn't need to change beyond the object name. */
  var progressAPI = {
    getUserProgress: async function (moduleId) {
      try {
        var res = await window.LRAAuth.callGateway('update-progress', { action: 'get', moduleId: moduleId });
        return res.data || { status: 'available', notes: { reflections: [] } };
      } catch (e) {
        return { status: 'available', notes: { reflections: [] } };
      }
    },
    updateListenProgress: async function (moduleId, seconds) {
      try { await window.LRAAuth.callGateway('update-progress', { action: 'listenProgress', moduleId: moduleId, seconds: seconds }); }
      catch (e) { console.error('updateListenProgress failed', e); }
    },
    markAudioListenedFully: async function (moduleId) {
      try { await window.LRAAuth.callGateway('update-progress', { action: 'markListenedFully', moduleId: moduleId }); }
      catch (e) { console.error('markAudioListenedFully failed', e); }
    },
    updateCompletionStatus: async function (moduleId) {
      try {
        await window.LRAAuth.callGateway('update-progress', { action: 'complete', moduleId: moduleId });
        return true;
      } catch (e) {
        console.error('updateCompletionStatus failed', e);
        return false;
      }
    },
    addReflection: async function (moduleId, content) {
      try {
        await window.LRAAuth.callGateway('update-progress', { action: 'addReflection', moduleId: moduleId, content: content });
        return true;
      } catch (e) {
        console.error('addReflection failed', e);
        return false;
      }
    },
    updateReflection: async function (moduleId, reflectionId, content) {
      try {
        await window.LRAAuth.callGateway('update-progress', { action: 'updateReflection', moduleId: moduleId, reflectionId: reflectionId, content: content });
        return true;
      } catch (e) {
        console.error('updateReflection failed', e);
        return false;
      }
    },
    deleteReflection: async function (moduleId, reflectionId) {
      try {
        await window.LRAAuth.callGateway('update-progress', { action: 'deleteReflection', moduleId: moduleId, reflectionId: reflectionId });
        return true;
      } catch (e) {
        console.error('deleteReflection failed', e);
        return false;
      }
    },
    getReflections: async function (moduleId) {
      try {
        var res = await window.LRAAuth.callGateway('update-progress', { action: 'getReflections', moduleId: moduleId });
        return res.data || [];
      } catch (e) {
        return [];
      }
    },
    getSignedAssetsForModule: async function (moduleData) {
      try {
        var res = await window.LRAAuth.callGateway('get-signed-assets', { moduleId: moduleData.id });
        return { data: res.data, error: null };
      } catch (e) {
        return { data: null, error: e };
      }
    }
  };

  /* Inject modal CSS */
  var style = document.createElement('style');
  style.textContent = `
    /* LESSON MODAL STYLES */
    .lesson-modal-layer {
      position: fixed; inset: 0; z-index: 300;
      display: none; overflow-y: auto;
    }
    .lesson-modal-layer.open { display: block; }
    
    .lesson-modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(20,46,31,.65);
      backdrop-filter: blur(12px);
      opacity: 0;
    }
    
    .lesson-modal-panel {
      position: relative;
      max-width: 920px; margin: 4rem auto;
      background: #f9f5ed;
      border: 1px solid rgba(201,168,76,.35);
      box-shadow: 0 20px 60px -10px rgba(27,60,40,.4);
      opacity: 0;
      transform: translateY(30px) scale(0.96);
    }
    
    .lesson-modal-close {
      position: absolute; top: 1.5rem; right: 1.5rem;
      width: 36px; height: 36px;
      background: transparent;
      border: 1px solid rgba(181,134,13,.3);
      border-radius: 50%;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all .3s ease;
      z-index: 10;
    }
    .lesson-modal-close:hover {
      background: rgba(181,134,13,.1);
      border-color: #b5860d;
      transform: rotate(90deg);
    }
    .lesson-modal-close::before,
    .lesson-modal-close::after {
      content: ''; position: absolute;
      width: 16px; height: 1.5px;
      background: #5a5240;
      transition: background .3s;
    }
    .lesson-modal-close::before { transform: rotate(45deg); }
    .lesson-modal-close::after { transform: rotate(-45deg); }
    .lesson-modal-close:hover::before,
    .lesson-modal-close:hover::after { background: #b5860d; }
    
    .lesson-modal-header {
      padding: 3rem 3rem 2rem;
      border-bottom: 1px solid rgba(201,168,76,.25);
      position: relative;
    }
    
    .lesson-modal-ornament {
      width: 60px; height: 60px;
      margin: 0 auto 1.5rem;
      opacity: 0;
      transform: scale(0.8);
    }
    .lesson-modal-ornament svg {
      width: 100%; height: 100%;
      stroke: #b5860d; fill: none;
    }
    
    .lesson-modal-kicker {
      font-size: 13px;
      letter-spacing: .15em;
      text-transform: uppercase;
      color: #5a5240;
      text-align: center;
      margin-bottom: 0.75rem;
      opacity: 0;
      transform: translateY(10px);
    }
    
    .lesson-modal-title {
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      font-weight: 400;
      line-height: 1.3;
      color: #142e1f;
      text-align: center;
      margin-bottom: 1rem;
      opacity: 0;
      transform: translateY(10px);
    }
    
    .lesson-modal-description {
      font-size: 18px;
      line-height: 1.6;
      color: #5a5240;
      text-align: center;
      max-width: 680px;
      margin: 0 auto;
      opacity: 0;
      transform: translateY(10px);
    }
    
    .lesson-modal-body {
      padding: 2.5rem 3rem 3rem;
    }
    
    .lesson-section {
      margin-bottom: 2.5rem;
      opacity: 0;
      transform: translateY(15px);
    }
    
    .lesson-section-title {
      font-family: 'Playfair Display', serif;
      font-size: 20px;
      font-weight: 500;
      color: #142e1f;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .lesson-section-title::before {
      content: '';
      width: 8px; height: 8px;
      background: none;
      border: 1.5px solid #b5860d;
      transform: rotate(45deg);
    }
    
    /* Custom Audio Player Styles */
    .lesson-audio-player {
      background: #f0ebe0;
      border: 1px solid rgba(201,168,76,.25);
      border-radius: 2px;
      padding: 1.5rem;
    }

    .audio-player-inner {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .audio-player-top-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .audio-play-btn {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      background: #1B3C28;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .3s;
    }
    .audio-play-btn:hover { background: #142e1f; }
    .audio-play-btn svg {
      width: 18px; height: 18px;
      fill: #f9f5ed;
    }

    .audio-seek-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .audio-seek-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      background: rgba(201,168,76,.3);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    .audio-seek-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px; height: 14px;
      background: #b5860d;
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }
    .audio-seek-slider::-moz-range-thumb {
      width: 14px; height: 14px;
      background: #b5860d;
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }

    .audio-time-display {
      font-size: 12px;
      color: #5a5240;
      font-family: 'EB Garamond', Georgia, serif;
      display: flex;
      justify-content: space-between;
    }

    .audio-player-bottom-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-left: 56px;
    }

    .audio-volume-icon {
      width: 20px; height: 20px;
      flex-shrink: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #5a5240;
    }
    .audio-volume-icon:hover { color: #b5860d; }
    .audio-volume-icon svg { width: 16px; height: 16px; fill: currentColor; }

    .audio-volume-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 80px;
      height: 4px;
      background: rgba(201,168,76,.3);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    .audio-volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px; height: 12px;
      background: #b5860d;
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }
    .audio-volume-slider::-moz-range-thumb {
      width: 12px; height: 12px;
      background: #b5860d;
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }

    .lesson-audio-placeholder {
      text-align: center;
      padding: 2rem;
      color: #5a5240;
      font-style: italic;
      background: #f0ebe0;
      border: 1px dashed rgba(201,168,76,.35);
      border-radius: 2px;
    }

    /* PDF Viewer Styles */
    .lesson-pdf-viewer {
      border: 1px solid rgba(201,168,76,.25);
      border-radius: 2px;
      overflow: hidden;
    }

    .lesson-pdf-iframe {
      width: 100%;
      height: 500px;
      border: none;
      display: block;
      background: #f9f5ed;
    }

    .lesson-pdf-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: #f0ebe0;
      border-bottom: 1px solid rgba(201,168,76,.25);
    }

    .lesson-pdf-filename {
      font-size: 14px;
      color: #5a5240;
      font-style: italic;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lesson-pdf-open-btn {
      padding: 6px 14px;
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      background: transparent;
      color: #1B3C28;
      border: 1px solid rgba(201,168,76,.4);
      border-radius: 1px;
      cursor: pointer;
      font-family: 'EB Garamond', serif;
      text-decoration: none;
      transition: all .3s;
      white-space: nowrap;
    }
    .lesson-pdf-open-btn:hover {
      border-color: #b5860d;
      background: rgba(181,134,13,.05);
    }

    .lesson-pdf-placeholder {
      text-align: center;
      padding: 2rem;
      color: #5a5240;
      font-style: italic;
      background: #f0ebe0;
      border: 1px dashed rgba(201,168,76,.35);
      border-radius: 2px;
    }
    
    /* Notes Section */
    .lesson-reflection-prompt {
      font-family: 'EB Garamond', Georgia, serif;
      font-size: 16px;
      font-style: italic;
      color: #5a5240;
      margin: 0 0 0.75rem;
    }
    .lesson-notes-textarea {
      width: 100%;
      min-height: 140px;
      padding: 1rem;
      font-family: 'EB Garamond', Georgia, serif;
      font-size: 16px;
      line-height: 1.6;
      color: #1c1a14;
      background: #f0ebe0;
      border: 1px solid rgba(201,168,76,.25);
      border-radius: 2px;
      resize: vertical;
      transition: border-color .3s;
    }
    .lesson-notes-textarea:focus {
      outline: none;
      border-color: #b5860d;
    }
    .lesson-notes-textarea::placeholder {
      color: #5a5240;
      opacity: 0.6;
    }
    
    .lesson-notes-hint {
      font-size: 14px;
      color: #5a5240;
      margin-top: 0.5rem;
      font-style: italic;
    }
    
    /* Progress Indicator */
    .lesson-progress {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.5rem;
      background: #f0ebe0;
      border: 1px solid rgba(201,168,76,.25);
      border-radius: 2px;
    }
    
    .lesson-progress-icon {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    .lesson-progress-icon svg {
      width: 100%;
      height: 100%;
      stroke: #b5860d;
      fill: none;
    }
    
    .lesson-progress-text {
      font-size: 15px;
      color: #5a5240;
    }
    
    .lesson-mark-complete {
      margin-left: auto;
      padding: 10px 22px;
      font-size: 13px;
      letter-spacing: .1em;
      text-transform: uppercase;
      background: #1B3C28;
      color: #f9f5ed;
      border: none;
      border-radius: 1px;
      cursor: pointer;
      font-family: 'EB Garamond', serif;
      transition: background .3s;
    }
    .lesson-mark-complete:hover {
      background: #142e1f;
    }
    .lesson-mark-complete.completed {
      background: #b5860d;
      cursor: pointer;
    }
    .lesson-mark-complete.incomplete {
      background: #1B3C28;
    }
    .lesson-mark-complete:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #8a8a8a;
    }
    
    /* Reflections System */
    .lesson-post-reflection {
      padding: 10px 22px;
      font-size: 13px;
      letter-spacing: .1em;
      text-transform: uppercase;
      background: #1B3C28;
      color: #f9f5ed;
      border: none;
      border-radius: 1px;
      cursor: pointer;
      font-family: 'EB Garamond', serif;
      transition: background .3s;
      margin-top: 0.75rem;
    }
    .lesson-post-reflection:hover {
      background: #142e1f;
    }
    .lesson-post-reflection:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .lesson-reflections-list {
      margin-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .reflection-card {
      background: #f9f5ed;
      border: 1px solid rgba(201,168,76,.25);
      border-radius: 2px;
      padding: 1rem;
      transition: border-color .3s;
    }
    .reflection-card:hover {
      border-color: rgba(201,168,76,.45);
    }
    
    .reflection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    
    .reflection-timestamp {
      font-size: 12px;
      color: #5a5240;
      font-style: italic;
    }
    
    .reflection-actions {
      display: flex;
      gap: 0.5rem;
    }
    
    .reflection-edit-btn,
    .reflection-delete-btn {
      padding: 4px 10px;
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      background: transparent;
      border: 1px solid rgba(201,168,76,.3);
      border-radius: 1px;
      cursor: pointer;
      font-family: 'EB Garamond', serif;
      color: #5a5240;
      transition: all .3s;
    }
    .reflection-edit-btn:hover {
      border-color: #b5860d;
      color: #142e1f;
      background: rgba(181,134,13,.05);
    }
    .reflection-delete-btn:hover {
      border-color: #a94442;
      color: #a94442;
      background: rgba(169,68,66,.05);
    }
    
    .reflection-content {
      font-size: 15px;
      line-height: 1.7;
      color: #1c1a14;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .reflection-edited-badge {
      font-size: 11px;
      color: #5a5240;
      font-style: italic;
      margin-left: 0.5rem;
      opacity: 0.7;
    }
    
    .reflection-empty {
      text-align: center;
      padding: 1.5rem;
      color: #5a5240;
      font-style: italic;
      font-size: 14px;
    }
    
    /* Completion Requirements */
    .lesson-requirements {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 1rem;
      background: #f0ebe0;
      border: 1px solid rgba(201,168,76,.25);
      border-radius: 2px;
    }
    
    .requirement {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 14px;
      color: #5a5240;
    }
    
    .requirement-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    
    .requirement.met {
      color: #1B3C28;
    }
    
    .requirement.met .requirement-icon {
      color: #1B3C28;
    }
    
    .requirement-text {
      flex: 1;
    }
    
    /* Navigation */
    .lesson-modal-nav {
      display: flex;
      justify-content: space-between;
      padding: 2rem 3rem;
      border-top: 1px solid rgba(201,168,76,.25);
      opacity: 0;
    }
    
    .lesson-nav-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 10px 18px;
      font-size: 14px;
      color: #5a5240;
      background: transparent;
      border: 1px solid rgba(201,168,76,.3);
      border-radius: 1px;
      cursor: pointer;
      font-family: 'EB Garamond', serif;
      transition: all .3s;
    }
    .lesson-nav-btn:hover {
      color: #142e1f;
      border-color: #b5860d;
      background: rgba(181,134,13,.05);
    }
    .lesson-nav-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .lesson-nav-btn svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      fill: none;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .lesson-modal-panel {
        margin: 2rem 1rem;
      }
      .lesson-modal-header,
      .lesson-modal-body,
      .lesson-modal-nav {
        padding-left: 1.5rem;
        padding-right: 1.5rem;
      }
      .lesson-modal-title {
        font-size: 26px;
      }
    }
  `;
  document.head.appendChild(style);

  /* Inject modal HTML */
  var modalHTML = `
    <div class="lesson-modal-layer" id="lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lessonTitle">
      <div class="lesson-modal-backdrop"></div>
      <div class="lesson-modal-panel">
        <button class="lesson-modal-close" type="button" aria-label="Close lesson"></button>
        
        <div class="lesson-modal-header">
          <div class="lesson-modal-ornament">
            <svg viewBox="0 0 60 60">
              <polygon points="30,8 48,30 30,52 12,30" stroke-width="1.5"/>
              <polygon points="30,18 40,30 30,42 20,30" stroke-width="1"/>
            </svg>
          </div>
          <div class="lesson-modal-kicker" id="lessonKicker">Week 1 · Teaching</div>
          <h2 class="lesson-modal-title" id="lessonTitle">The main teaching — gratitude</h2>
          <p class="lesson-modal-description" id="lessonDescription">Shukr as something a household breathes, not something it recites.</p>
        </div>
        
        <div class="lesson-modal-body">
          <div class="lesson-section" id="audioSection">
            <h3 class="lesson-section-title">Listen</h3>
            <div class="lesson-audio-player" id="audioPlayerContainer">
              <div class="lesson-audio-placeholder">
                Audio content will be available soon. Check back after the release date.
              </div>
            </div>
          </div>

          <div class="lesson-section" id="pdfSection">
            <h3 class="lesson-section-title">Read</h3>
            <div id="pdfViewerContainer">
              <div class="lesson-pdf-placeholder">
                No reading material for this lesson.
              </div>
            </div>
          </div>

          <div class="lesson-section" id="notesSection">
            <h3 class="lesson-section-title">Your Reflections</h3>
            <p class="lesson-reflection-prompt" id="reflectionPromptText"></p>
            <textarea
              class="lesson-notes-textarea"
              id="lessonNotes"
              placeholder="Write your thoughts, reflections, and insights here. Click Post to save."
            ></textarea>
            <button class="lesson-post-reflection" id="postReflectionBtn" disabled>Post Reflection</button>
            <div class="lesson-reflections-list" id="reflectionsList"></div>
          </div>
          
          <div class="lesson-section" id="progressSection">
            <div class="lesson-requirements" id="completionRequirements">
              <div class="requirement" id="reflectionRequirement">
                <span class="requirement-icon">⭕</span>
                <span class="requirement-text">Write at least one reflection</span>
              </div>
              <div class="requirement" id="audioRequirement">
                <span class="requirement-icon">⭕</span>
                <span class="requirement-text">Listen to the full audio lesson</span>
              </div>
            </div>
            <div class="lesson-progress">
              <div class="lesson-progress-icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke-width="1.5"/>
                  <path d="M 8 12 L 11 15 L 16 9" stroke-width="1.5"/>
                </svg>
              </div>
              <span class="lesson-progress-text" id="progressText">Mark this lesson as complete when you're done.</span>
              <button class="lesson-mark-complete" id="markCompleteBtn">Mark Complete</button>
            </div>
          </div>
        </div>
        
        <div class="lesson-modal-nav">
          <button class="lesson-nav-btn" id="prevLessonBtn" disabled>
            <svg viewBox="0 0 14 14"><path d="M 10 2 L 4 7 L 10 12" stroke-width="1.5"/></svg>
            Previous
          </button>
          <button class="lesson-nav-btn" id="nextLessonBtn">
            Next
            <svg viewBox="0 0 14 14"><path d="M 4 2 L 10 7 L 4 12" stroke-width="1.5"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  /* Modal state */
  var currentLesson = null;
  var navigationLessons = [];
  var navigationIndex = -1;
  var modalLayer = document.getElementById('lesson-modal');
  var backdrop = modalLayer.querySelector('.lesson-modal-backdrop');
  var panel = modalLayer.querySelector('.lesson-modal-panel');
  var closeBtn = modalLayer.querySelector('.lesson-modal-close');
  var prevLessonBtn = document.getElementById('prevLessonBtn');
  var nextLessonBtn = document.getElementById('nextLessonBtn');
  var activeTl = null;
  
  /* Audio tracking state */
  var audioElement = null;
  var audioDuration = 0;
  var lastSavedPosition = 0;

  /* GSAP Animation Timelines */
  function buildOpenTimeline() {
    var tl = gsap.timeline({ paused: true });
    tl.set(modalLayer, { display: 'block' });
    tl.to(backdrop, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 0);
    tl.to(panel, { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      duration: 0.5, 
      ease: 'power3.out' 
    }, 0.1);
    
    /* Stagger reveal header elements */
    tl.to('.lesson-modal-ornament', { 
      opacity: 1, 
      scale: 1, 
      duration: 0.4, 
      ease: 'back.out(1.4)' 
    }, 0.3);
    tl.to('.lesson-modal-kicker', { 
      opacity: 1, 
      y: 0, 
      duration: 0.3, 
      ease: 'power2.out' 
    }, 0.4);
    tl.to('.lesson-modal-title', { 
      opacity: 1, 
      y: 0, 
      duration: 0.3, 
      ease: 'power2.out' 
    }, 0.5);
    tl.to('.lesson-modal-description', { 
      opacity: 1, 
      y: 0, 
      duration: 0.3, 
      ease: 'power2.out' 
    }, 0.6);
    
    /* Stagger reveal body sections */
    tl.to('.lesson-section', { 
      opacity: 1, 
      y: 0, 
      duration: 0.4, 
      stagger: 0.1, 
      ease: 'power2.out' 
    }, 0.7);
    
    tl.to('.lesson-modal-nav', { 
      opacity: 1, 
      duration: 0.3, 
      ease: 'power2.out' 
    }, 0.9);
    
    return tl;
  }

  function buildCloseTimeline() {
    var tl = gsap.timeline({ paused: true });
    tl.to(panel, { 
      opacity: 0, 
      y: 20, 
      scale: 0.96, 
      duration: 0.3, 
      ease: 'power2.in' 
    }, 0);
    tl.to(backdrop, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.1);
    tl.set(modalLayer, { display: 'none' });
    return tl;
  }

  /* Throttle function for audio tracking */
  function throttle(func, delay) {
    var lastCall = 0;
    return function() {
      var now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, arguments);
      }
    };
  }

  /* Setup audio playback tracking */
  async function setupAudioTracking(audio, moduleId, durationMinutes) {
    audioElement = audio;
    audioDuration = (durationMinutes || 0) * 60; // Prefer provided minutes, else 0 and use metadata
    
    /* Load saved position */
    var progress = await progressAPI.getUserProgress(moduleId);
    if (progress.listen_progress_seconds > 0) {
      audio.currentTime = progress.listen_progress_seconds;
    }
    
    /* Update duration from metadata if not provided */
    audio.addEventListener('loadedmetadata', function() {
      if (!audioDuration || audioDuration <= 0) {
        var metaDur = Math.floor(audio.duration || 0);
        if (metaDur > 0) audioDuration = metaDur;
      }
    });

    /* Track playback with throttled saves */
    audio.addEventListener('timeupdate', throttle(async function() {
      var currentPos = Math.floor(audio.currentTime);
      
      /* Save every 10 seconds */
      if (currentPos - lastSavedPosition >= 10) {
        await progressAPI.updateListenProgress(moduleId, currentPos);
        lastSavedPosition = currentPos;
      }
      
      /* Check if listened fully (95% threshold) */
      var total = audioDuration > 0 ? audioDuration : (isFinite(audio.duration) ? Math.floor(audio.duration) : 0);
      if (total > 0 && currentPos >= total * 0.95) {
        await progressAPI.markAudioListenedFully(moduleId, true);
        await updateCompletionRequirements();
      }
    }, 1000));
    
    /* Save on pause */
    audio.addEventListener('pause', async function() {
      await progressAPI.updateListenProgress(moduleId, Math.floor(audio.currentTime));
    });
    
    /* Mark complete on ended */
    audio.addEventListener('ended', async function() {
      await progressAPI.markAudioListenedFully(moduleId, true);
      await updateCompletionRequirements();
    });
  }

  /* Enable/disable Mark Complete button based on requirements and status */
  async function updateMarkCompleteButton() {
    var btn = document.getElementById('markCompleteBtn');
    var progressText = document.getElementById('progressText');
    if (!currentLesson || !btn) return;
    
    var isCurrentlyComplete = currentLesson.status === 'completed';
    if (isCurrentlyComplete) {
      // Allow marking incomplete at any time
      btn.disabled = false;
      btn.textContent = 'Mark Incomplete';
      btn.classList.add('completed');
      btn.classList.remove('incomplete');
      if (progressText) progressText.textContent = 'You completed this lesson!';
      return;
    }
    
    // Not completed: require both reflection and audio fully listened
    var progress = await progressAPI.getUserProgress(currentLesson.id);
    var canComplete = !!(progress && progress.has_reflection && progress.has_listened_fully);
    btn.disabled = !canComplete;
    btn.textContent = 'Mark Complete';
    btn.classList.remove('completed');
    btn.classList.add('incomplete');
    if (progressText) progressText.textContent = 'Mark this lesson as complete when you\'re done.';
  }

  /* Update completion requirement indicators */
  async function updateCompletionRequirements() {
    if (!currentLesson) return;
    
    var progress = await progressAPI.getUserProgress(currentLesson.id);
    var reflectionReq = document.getElementById('reflectionRequirement');
    var audioReq = document.getElementById('audioRequirement');
    
    if (progress.has_reflection) {
      reflectionReq.classList.add('met');
      reflectionReq.querySelector('.requirement-icon').textContent = '✅';
    } else {
      reflectionReq.classList.remove('met');
      reflectionReq.querySelector('.requirement-icon').textContent = '⭕';
    }
    
    if (progress.has_listened_fully) {
      audioReq.classList.add('met');
      audioReq.querySelector('.requirement-icon').textContent = '✅';
    } else {
      audioReq.classList.remove('met');
      audioReq.querySelector('.requirement-icon').textContent = '⭕';
    }

    // Recompute gating for the Mark Complete button
    await updateMarkCompleteButton();
  }

  function updateLessonNavigationButtons() {
    if (!prevLessonBtn || !nextLessonBtn) return;

    if (!navigationLessons || navigationLessons.length <= 1 || navigationIndex < 0) {
      prevLessonBtn.disabled = true;
      nextLessonBtn.disabled = true;
      return;
    }

    prevLessonBtn.disabled = navigationIndex <= 0;
    nextLessonBtn.disabled = navigationIndex >= navigationLessons.length - 1;
  }

  function openModal(lessonData) {
    currentLesson = lessonData;
    navigationLessons = Array.isArray(lessonData.navigationList) ? lessonData.navigationList : [];
    navigationIndex = navigationLessons.findIndex(function(item) {
      return item && item.id === lessonData.id;
    });
    updateLessonNavigationButtons();

    // Normalize status coming from dashboard ('complete'|'current' -> 'completed'|'in_progress')
    var normalizedStatus = 'in_progress';
    if (lessonData.status === 'completed' || lessonData.status === 'complete') {
      normalizedStatus = 'completed';
    }
    currentLesson.status = normalizedStatus;
    
    /* Populate modal with lesson data */
    document.getElementById('lessonKicker').textContent = 
      `Week ${lessonData.week} · ${lessonData.type.charAt(0).toUpperCase() + lessonData.type.slice(1)}`;
    document.getElementById('lessonTitle').textContent = lessonData.title;
    document.getElementById('lessonDescription').textContent = lessonData.description;
    
    /* Handle audio player + PDF viewer */
    var audioContainer = document.getElementById('audioPlayerContainer');
    var pdfContainer = document.getElementById('pdfViewerContainer');
    
    /* Reset to placeholders */
    audioContainer.innerHTML = '<div class="lesson-audio-placeholder">Audio content will be available soon.</div>';
    pdfContainer.innerHTML = '<div class="lesson-pdf-placeholder">No reading material for this lesson.</div>';
    
    if (lessonData.availability_status === 'locked') {
      audioContainer.innerHTML = '<div class="lesson-audio-placeholder">🔒 This lesson is locked.</div>';
      pdfContainer.innerHTML = '<div class="lesson-pdf-placeholder">🔒 This lesson is locked.</div>';
    } else if (lessonData.moduleData) {
      (async function() {
        try {
          var res = await progressAPI.getSignedAssetsForModule(lessonData.moduleData);
          var urls = (res && res.data) || {};
          
          /* Render audio player */
          if (urls.audioUrl && urls.audioUrl.signedUrl) {
            var audioUrl = urls.audioUrl.signedUrl;
            audioContainer.innerHTML = `
              <div class="audio-player-inner">
                <div class="audio-player-top-row">
                  <button class="audio-play-btn" id="audioPlayBtn" type="button">
                    <svg viewBox="0 0 24 24" id="audioPlayIcon"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div class="audio-seek-wrap">
                    <input type="range" class="audio-seek-slider" id="audioSeekSlider" min="0" max="100" value="0" step="0.1">
                    <div class="audio-time-display">
                      <span id="audioCurrentTime">0:00</span>
                      <span id="audioTotalTime">0:00</span>
                    </div>
                  </div>
                </div>
                <div class="audio-player-bottom-row">
                  <div class="audio-volume-icon" id="audioVolumeIcon">
                    <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                  </div>
                  <input type="range" class="audio-volume-slider" id="audioVolumeSlider" min="0" max="1" value="1" step="0.05">
                </div>
                <audio id="lessonAudio" preload="metadata" style="display:none;">
                  <source src="${audioUrl}" type="audio/mpeg">
                </audio>
              </div>
            `;
            
            var audio = document.getElementById('lessonAudio');
            var playBtn = document.getElementById('audioPlayBtn');
            var playIcon = document.getElementById('audioPlayIcon');
            var seekSlider = document.getElementById('audioSeekSlider');
            var currentTimeEl = document.getElementById('audioCurrentTime');
            var totalTimeEl = document.getElementById('audioTotalTime');
            var volumeSlider = document.getElementById('audioVolumeSlider');
            var volumeIcon = document.getElementById('audioVolumeIcon');
            
            function formatTime(sec) {
              if (!sec || isNaN(sec)) return '0:00';
              var m = Math.floor(sec / 60);
              var s = Math.floor(sec % 60);
              return m + ':' + (s < 10 ? '0' : '') + s;
            }
            
            playBtn.addEventListener('click', function() {
              if (audio.paused) { audio.play(); } else { audio.pause(); }
            });
            
            audio.addEventListener('play', function() {
              playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            });
            audio.addEventListener('pause', function() {
              playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
            });
            
            audio.addEventListener('loadedmetadata', function() {
              totalTimeEl.textContent = formatTime(audio.duration);
              seekSlider.max = Math.floor(audio.duration) || 100;
            });
            
            audio.addEventListener('timeupdate', function() {
              var pos = audio.currentTime;
              seekSlider.value = pos;
              currentTimeEl.textContent = formatTime(pos);
            });
            
            seekSlider.addEventListener('input', function() {
              audio.currentTime = parseFloat(seekSlider.value);
              currentTimeEl.textContent = formatTime(parseFloat(seekSlider.value));
            });
            
            volumeSlider.addEventListener('input', function() {
              audio.volume = parseFloat(volumeSlider.value);
            });
            
            var lastVolume = 1;
            volumeIcon.addEventListener('click', function() {
              if (audio.volume > 0) {
                lastVolume = audio.volume;
                audio.volume = 0;
                volumeSlider.value = 0;
              } else {
                audio.volume = lastVolume;
                volumeSlider.value = lastVolume;
              }
            });
            
            /* Setup audio tracking */
            setupAudioTracking(audio, lessonData.id, lessonData.duration_minutes);
          } else {
            audioContainer.innerHTML = '<div class="lesson-audio-placeholder">No audio content for this lesson.</div>';
          }
          
          /* Render PDF viewer */
          if (urls.pdfUrl && urls.pdfUrl.signedUrl) {
            var pdfUrl = urls.pdfUrl.signedUrl;
            var fileName = lessonData.moduleData.pdf_path ? lessonData.moduleData.pdf_path.split('/').pop() : 'Document.pdf';
            pdfContainer.innerHTML = `
              <div class="lesson-pdf-viewer">
                <div class="lesson-pdf-toolbar">
                  <span class="lesson-pdf-filename">${fileName}</span>
                  <a href="${pdfUrl}" target="_blank" rel="noopener" class="lesson-pdf-open-btn">Open in new tab ↗</a>
                </div>
                <iframe class="lesson-pdf-iframe" src="${pdfUrl}" title="Week ${lessonData.week} reading material"></iframe>
              </div>
            `;
          } else {
            pdfContainer.innerHTML = '<div class="lesson-pdf-placeholder">No reading material for this lesson.</div>';
          }
        } catch (err) {
          console.error('Failed to load lesson assets:', err);
          audioContainer.innerHTML = '<div class="lesson-audio-placeholder">Failed to load audio. Please try again.</div>';
          pdfContainer.innerHTML = '<div class="lesson-pdf-placeholder">Failed to load document. Please try again.</div>';
        }
      })();
    }
    
    /* Show the admin-authored reflection question, or fall back to a
       generic prompt when this module has none set. */
    var reflectionPromptEl = document.getElementById('reflectionPromptText');
    if (reflectionPromptEl) {
      reflectionPromptEl.textContent = (lessonData.moduleData && lessonData.moduleData.reflection_prompt) ||
        'Write a short reflection on this week to unlock the next one.';
    }

    /* Clear textarea and reset post button */
    document.getElementById('lessonNotes').value = '';
    document.getElementById('postReflectionBtn').textContent = 'Post Reflection';
    document.getElementById('postReflectionBtn').disabled = true;
    editingReflectionId = null;
    
    /* Load reflections from Supabase */
    loadReflections(lessonData.id);
    
    /* Update completion requirements */
    updateCompletionRequirements();
    
    /* Update progress status */
    var progressText = document.getElementById('progressText');
    var completeBtn = document.getElementById('markCompleteBtn');
    if (normalizedStatus === 'completed') {
      progressText.textContent = 'You completed this lesson!';
      completeBtn.textContent = 'Mark Incomplete';
      completeBtn.classList.add('completed');
      completeBtn.classList.remove('incomplete');
      completeBtn.disabled = false;
    } else {
      progressText.textContent = 'Mark this lesson as complete when you\'re done.';
      completeBtn.textContent = 'Mark Complete';
      completeBtn.classList.remove('completed');
      completeBtn.classList.add('incomplete');
      // Disable until requirements are confirmed met by async checks
      completeBtn.disabled = true;
    }
    
    /* Apply gating state to Mark Complete button */
    updateMarkCompleteButton();
    
    /* Disable body scroll */
    document.body.style.overflow = 'hidden';
    
    /* Ensure modal layer is visible (class fallback + gsap animation) */
    modalLayer.classList.add('open');
    
    /* Play open animation */
    if (activeTl) activeTl.kill();
    if (window.gsap) {
      activeTl = buildOpenTimeline();
      activeTl.play();
    } else {
      /* No-animation fallback: show immediately */
      modalLayer.style.display = 'block';
      backdrop.style.opacity = '1';
      panel.style.opacity = '1';
      panel.style.transform = 'none';
    }
  }

  function closeModal() {
    /* Re-enable body scroll */
    document.body.style.overflow = '';
    
    /* Play close animation */
    if (activeTl) activeTl.kill();
    if (window.gsap) {
      activeTl = buildCloseTimeline();
      activeTl.play();
    } else {
      modalLayer.classList.remove('open');
      modalLayer.style.display = 'none';
    }
    
    currentLesson = null;
    navigationLessons = [];
    navigationIndex = -1;
    updateLessonNavigationButtons();
  }

  /* Event Listeners */
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  
  /* Escape key to close */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalLayer.classList.contains('open')) {
      closeModal();
    }
  });
  
  /* Mark complete button - toggleable with validation */
  document.getElementById('markCompleteBtn').addEventListener('click', async function() {
    if (!currentLesson) return;
    
    var isCurrentlyComplete = currentLesson.status === 'completed';
    var newStatus = isCurrentlyComplete ? 'in_progress' : 'completed';
    
    /* Validate requirements before marking complete */
    if (!isCurrentlyComplete) {
      var progress = await progressAPI.getUserProgress(currentLesson.id);
      var hasReflection = progress.has_reflection || false;
      var hasListenedFully = progress.has_listened_fully || false;
      
      if (!hasReflection) {
        alert('Please write at least one reflection before marking this lesson as complete.');
        return;
      }
      
      if (!hasListenedFully) {
        alert('Please listen to the entire audio lesson before marking it as complete.');
        return;
      }
    }
    
    /* Update Supabase */
    var success = await progressAPI.updateCompletionStatus(currentLesson.id, !isCurrentlyComplete);
    
    if (success) {
      currentLesson.status = newStatus;
      
      /* Update UI */
      var progressText = document.getElementById('progressText');
      if (newStatus === 'completed') {
        progressText.textContent = 'You completed this lesson!';
        this.textContent = 'Mark Incomplete';
        this.classList.add('completed');
        this.classList.remove('incomplete');
      } else {
        progressText.textContent = 'Mark this lesson as complete when you\'re done.';
        this.textContent = 'Mark Complete';
        this.classList.remove('completed');
        this.classList.add('incomplete');
      }
      
      /* Recompute gating after status change */
      await updateCompletionRequirements();
      await updateMarkCompleteButton();
      
      /* Dispatch event for dashboard sync */
      window.dispatchEvent(new CustomEvent('lessonProgressUpdated', {
        detail: {
          lessonId: currentLesson.id,
          status: newStatus,
          timestamp: new Date().toISOString()
        }
      }));
      
      console.log('Lesson status updated:', currentLesson.id, newStatus);
    } else {
      console.error('Failed to update completion status');
    }
  });
  
  /* Enable/disable post button based on textarea content */
  var notesTextarea = document.getElementById('lessonNotes');
  var postBtn = document.getElementById('postReflectionBtn');
  var editingReflectionId = null;
  
  notesTextarea.addEventListener('input', function() {
    postBtn.disabled = !this.value.trim();
  });
  
  /* Post/Update reflection button */
  postBtn.addEventListener('click', async function() {
    if (!currentLesson) return;
    
    var content = notesTextarea.value.trim();
    if (!content) return;
    
    this.disabled = true;
    this.textContent = editingReflectionId ? 'Updating...' : 'Posting...';
    
    var success;
    if (editingReflectionId) {
      success = await progressAPI.updateReflection(currentLesson.id, editingReflectionId, content);
    } else {
      success = await progressAPI.addReflection(currentLesson.id, content);
    }
    
    if (success) {
      notesTextarea.value = '';
      editingReflectionId = null;
      this.textContent = 'Post Reflection';
      await loadReflections(currentLesson.id);
    } else {
      this.textContent = editingReflectionId ? 'Update Reflection' : 'Post Reflection';
      console.error('Failed to save reflection');
    }
    
    this.disabled = true;
  });
  
  /* Load and display reflections */
  async function loadReflections(moduleId) {
    var reflections = await progressAPI.getReflections(moduleId);
    var listEl = document.getElementById('reflectionsList');
    
    if (!reflections || reflections.length === 0) {
      listEl.innerHTML = '<div class="reflection-empty">No reflections yet. Share your thoughts above.</div>';
      await updateCompletionRequirements();
      return;
    }
    
    /* Sort by timestamp, newest first */
    reflections.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    listEl.innerHTML = reflections.map(function(r) {
      var date = new Date(r.timestamp);
      var formatted = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + 
        ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      
      return '<div class="reflection-card" data-reflection-id="' + r.id + '">' +
        '<div class="reflection-header">' +
          '<span class="reflection-timestamp">' + formatted + 
            (r.edited ? '<span class="reflection-edited-badge">(edited)</span>' : '') +
          '</span>' +
          '<div class="reflection-actions">' +
            '<button class="reflection-edit-btn" data-action="edit">Edit</button>' +
            '<button class="reflection-delete-btn" data-action="delete">Delete</button>' +
          '</div>' +
        '</div>' +
        '<p class="reflection-content">' + escapeHtml(r.content) + '</p>' +
      '</div>';
    }).join('');
    
    /* Attach event listeners to edit/delete buttons */
    listEl.querySelectorAll('[data-action]').forEach(function(btn) {
      btn.addEventListener('click', handleReflectionAction);
    });
    
    /* Update completion requirements */
    await updateCompletionRequirements();
  }
  
  /* Handle edit/delete actions */
  async function handleReflectionAction(e) {
    var action = e.target.getAttribute('data-action');
    var card = e.target.closest('.reflection-card');
    var reflectionId = card.getAttribute('data-reflection-id');
    
    if (action === 'edit') {
      var content = card.querySelector('.reflection-content').textContent;
      notesTextarea.value = content;
      notesTextarea.focus();
      editingReflectionId = reflectionId;
      postBtn.textContent = 'Update Reflection';
      postBtn.disabled = false;
      
      /* Scroll to textarea */
      notesTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (action === 'delete') {
      if (!confirm('Are you sure you want to delete this reflection?')) return;
      
      var success = await progressAPI.deleteReflection(currentLesson.id, reflectionId);
      if (success) {
        await loadReflections(currentLesson.id);
      } else {
        console.error('Failed to delete reflection');
      }
    }
  }
  
  /* Escape HTML to prevent XSS */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /* Navigation buttons */
  if (prevLessonBtn) {
    prevLessonBtn.addEventListener('click', function() {
      if (navigationIndex <= 0) return;
      var target = navigationLessons[navigationIndex - 1];
      if (!target) return;
      openModal(target);
    });
  }

  if (nextLessonBtn) {
    nextLessonBtn.addEventListener('click', function() {
      if (navigationIndex < 0 || navigationIndex >= navigationLessons.length - 1) return;
      var target = navigationLessons[navigationIndex + 1];
      if (!target) return;
      openModal(target);
    });
  }

  /* Expose global function to open modal */
  window.openLessonModal = openModal;
  window.closeLessonModal = closeModal;

})();
