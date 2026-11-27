// StudyRAG - Client Application Logic (Full Feature Set)

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements - Left Panel & Collapsing
  const leftPanel = document.getElementById("left-panel");
  const leftPanelCollapseBtn = document.getElementById("left-panel-collapse-btn");
  const leftPanelExpandBtn = document.getElementById("left-panel-expand-btn");
  const leftPanelExpandFolder = document.getElementById("left-panel-expand-folder");

  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const darkModeIcon = document.getElementById("dark-mode-icon");

  // Profile & Login
  const loginScreen = document.getElementById("login-screen");
  const loginNameInput = document.getElementById("login-name");
  const loginEmailInput = document.getElementById("login-email");
  const guestLoginBtn = document.getElementById("guest-login-btn");
  const googleLoginBtn = document.getElementById("google-login-btn");
  const googleSigninModal = document.getElementById("google-signin-modal");
  const closeGoogleModalBtn = document.getElementById("close-google-modal-btn");
  const googleNameInput = document.getElementById("google-name-input");
  const googleEmailInput = document.getElementById("google-email-input");
  const confirmGoogleLoginBtn = document.getElementById("confirm-google-login-btn");
  const customGoogleClientId = document.getElementById("custom-google-client-id");
  const saveGoogleClientIdBtn = document.getElementById("save-google-client-id-btn");
  const googleBtnContainer = document.getElementById("google-btn-container");

  const profileBtn = document.getElementById("profile-btn");
  const profileDropdown = document.getElementById("profile-dropdown");
  const profileAvatarFallback = document.getElementById("profile-avatar-fallback");
  const profileAvatarImg = document.getElementById("profile-avatar-img");
  const dropdownAvatarText = document.getElementById("dropdown-avatar-text");
  const dropdownName = document.getElementById("dropdown-name");
  const dropdownEmail = document.getElementById("dropdown-email");
  const signOutBtn = document.getElementById("sign-out-btn");

  // Document Management & Ingestion / Web Search Toggle
  const webSearchToggleBtn = document.getElementById("web-search-toggle-btn");
  const sidebarUploadBtn = document.getElementById("sidebar-upload-btn");
  const chatUploadBtn = document.getElementById("chat-upload-btn");
  const toggleCorpusBtn = document.getElementById("toggle-corpus-btn");
  const corpusListContainer = document.getElementById("corpus-list-container");
  const corpusToggleIcon = document.getElementById("corpus-toggle-icon");
  const corpusCountNum = document.getElementById("corpus-count-num");
  const leftPanelToolsBtn = document.getElementById("left-panel-tools-btn");
  const dropzone = document.getElementById("dropzone");
  const browseBtn = document.getElementById("browse-btn");
  const fileUploader = document.getElementById("file-uploader");
  const uploadStatus = document.getElementById("upload-status");
  const uploadStatusText = document.getElementById("upload-status-text");
  const corpusList = document.getElementById("corpus-list");
  const sourcesBadge = document.getElementById("sources-badge");
  const selectAllBtn = document.getElementById("select-all-btn");
  const summarizeBtn = document.getElementById("summarize-btn");
  const mcqBtn = document.getElementById("mcq-btn");
  const flashcardsBtn = document.getElementById("flashcards-btn");
  const cheatsheetBtn = document.getElementById("cheatsheet-btn");

  // Quick Study Feature Chips
  const chipSummary = document.getElementById("chip-summary");
  const chatHistory = [];
  const chipMcq = document.getElementById("chip-mcq");
  const chipFlashcards = document.getElementById("chip-flashcards");
  const chipCheatsheet = document.getElementById("chip-cheatsheet");

  // Chat Canvas & Query Input
  const chatCanvas = document.getElementById("chat-canvas");
  const queryBarContainer = document.getElementById("query-bar-container");
  const quickToolsBar = document.getElementById("quick-tools-bar");
  const queryInput = document.getElementById("query-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const micIcon = document.getElementById("mic-icon");

  // Continuous Learning Modal
  const openLearningBtn = document.getElementById("open-learning-btn");
  const closeLearningBtn = document.getElementById("close-learning-btn");
  const learningModal = document.getElementById("learning-modal");
  const learnedCount = document.getElementById("learned-count");
  const learningLikes = document.getElementById("learning-likes");
  const learningDislikes = document.getElementById("learning-dislikes");
  const learningRate = document.getElementById("learning-rate");
  const learningRulesList = document.getElementById("learning-rules-list");
  const learningRecentList = document.getElementById("learning-recent-list");
  const clearLearningBtn = document.getElementById("clear-learning-btn");

  // State
  let documents = [];
  let speechRecognition = null;
  let isListening = false;
  let webSearchEnabled = localStorage.getItem("studyrag_web_search") === "true";

  // Initialize
  initAuth();
  initTheme();
  initCollapsiblePanels();
  initWebSearchToggle();
  initDynamicFloatEffects();
  initVoiceInput();
  initLearningPreferences();
  loadDocuments();

  // Dynamic 3D float & subtle pointer-tilt effect for file cards and AI Tool buttons
  function attachDynamicFloatEffect(el) {
    if (!el) return;
    el.classList.add("float-tilt-card");

    el.addEventListener("mousemove", (e) => {
      if (el.disabled) return;
      if (el.querySelector(".doc-dropdown-menu:not(.hidden)")) {
        el.style.transform = "";
        return;
      }
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const px = (x / rect.width) - 0.5;
      const py = (y / rect.height) - 0.5;
      const rotateY = (px * 6).toFixed(2);
      const rotateX = (-py * 6).toFixed(2);

      el.style.setProperty("--mx", `${x.toFixed(1)}px`);
      el.style.setProperty("--my", `${y.toFixed(1)}px`);
      el.style.transform = `perspective(700px) translateY(-4px) scale(1.015) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  }

  function initDynamicFloatEffects() {
    [summarizeBtn, mcqBtn, flashcardsBtn, cheatsheetBtn].forEach(attachDynamicFloatEffect);
  }

  // ----------------------------------------------------
  // Dark Theme (Default Reference Dark Mode)
  // ----------------------------------------------------
  function initTheme() {
    setTheme("dark");
  }

  function setTheme(theme) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("studyrag_theme", "dark");
  }

  // ----------------------------------------------------
  // t6: Real Google OAuth & Firebase Authentication
  // ----------------------------------------------------
  let activeGoogleKey = "AIzaSyAyPU7VYvJtEuFq6JoeEijImGb8U6n1SyI";
  let activeAuthDomain = "annular-bison-1t3g1.firebaseapp.com";
  let activeProjectId = "annular-bison-1t3g1";

  async function launchFirebaseSignIn(apiKey) {
    if (!window.__firebaseAuth) {
      alert("Firebase Authentication SDK is loading, please try again in a moment.");
      return;
    }
    const { initializeApp, getAuth, GoogleAuthProvider, signInWithPopup } = window.__firebaseAuth;
    try {
      const fbConfig = {
        apiKey: apiKey.trim(),
        authDomain: activeAuthDomain,
        projectId: activeProjectId
      };

      let app;
      try {
        app = initializeApp(fbConfig, "studyrag-auth");
      } catch {
        // App already initialized
        app = initializeApp(fbConfig, "studyrag-auth-" + Date.now());
      }
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const newUser = {
        name: user.displayName || "Google Scholar",
        email: user.email || "",
        avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "Google")}&background=1e40af&color=fff`,
        userId: user.uid,
        provider: "google"
      };

      saveUser(newUser);
      applyUserProfile(newUser);
      loginScreen.classList.add("hidden");
    } catch (err) {
      console.error("Firebase Sign-In error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        alert("Google Sign-In: " + (err.message || err.code));
      }
    }
  }

  function launchGoogleGisOAuth(clientId) {
    const cid = clientId.trim();
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: cid,
          scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid",
          prompt: "select_account",
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              console.error("Google OAuth error:", tokenResponse);
              alert("Google Sign-In: " + (tokenResponse.error_description || tokenResponse.error));
              return;
            }
            if (tokenResponse.access_token) {
              try {
                const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const profile = await res.json();
                const newUser = {
                  name: profile.name || profile.given_name || "Google Scholar",
                  email: profile.email,
                  avatar: profile.picture || null,
                  provider: "google"
                };
                saveUser(newUser);
                applyUserProfile(newUser);
                loginScreen.classList.add("hidden");
              } catch (err) {
                console.error("Failed to fetch Google profile:", err);
              }
            }
          }
        });
        tokenClient.requestAccessToken({ prompt: "select_account" });
      } catch (err) {
        console.error("Google OAuth init error:", err);
        alert("Failed to initialize Google Sign-In: " + err.message);
      }
    } else {
      const redirectUri = window.location.origin + "/";
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(cid)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=email%20profile%20openid&prompt=select_account`;
      window.open(oauthUrl, "GoogleSignIn", "width=500,height=600");
    }
  }

  function launchRealGoogleAuth(keyOrId) {
    const trimmed = (keyOrId || activeGoogleKey || "").trim();
    if (!trimmed) {
      const box = document.getElementById("google-client-id-box");
      if (box) {
        box.style.display = "flex";
        document.getElementById("google-client-id-input")?.focus();
      }
      return;
    }

    if (trimmed.includes(".apps.googleusercontent.com")) {
      launchGoogleGisOAuth(trimmed);
    } else {
      // Firebase API Key (e.g. AIzaSy...)
      launchFirebaseSignIn(trimmed);
    }
  }

  function initAuth() {
    const user = getSavedUser();
    if (user) {
      applyUserProfile(user);
      loginScreen.classList.add("hidden");
    } else {
      loginScreen.classList.remove("hidden");
    }

    // Load configured Google / Firebase Key from backend or localStorage
    fetch("/api/config")
      .then(r => r.json())
      .then(cfg => {
        activeGoogleKey = cfg.firebase_api_key || cfg.google_client_id || localStorage.getItem("studyrag_google_key") || "AIzaSyAyPU7VYvJtEuFq6JoeEijImGb8U6n1SyI";
        if (cfg.firebase_auth_domain) activeAuthDomain = cfg.firebase_auth_domain;
        if (cfg.firebase_project_id) activeProjectId = cfg.firebase_project_id;
        const input = document.getElementById("google-client-id-input");
        if (input && activeGoogleKey) input.value = activeGoogleKey;
      })
      .catch(() => {
        activeGoogleKey = localStorage.getItem("studyrag_google_key") || "";
      });

    guestLoginBtn.addEventListener("click", () => {
      const name = loginNameInput.value.trim() || "Student Scholar";
      const email = loginEmailInput.value.trim() || "scholar@university.edu";
      const newUser = {
        name: name,
        email: email,
        avatar: null,
        provider: "guest"
      };
      saveUser(newUser);
      applyUserProfile(newUser);
      loginScreen.classList.add("hidden");
    });

    const googleClientIdBox = document.getElementById("google-client-id-box");
    const saveClientIdAndSigninBtn = document.getElementById("save-client-id-and-signin-btn");
    const googleClientIdInput = document.getElementById("google-client-id-input");

    if (googleLoginBtn) {
      googleLoginBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeGoogleKey) {
          launchRealGoogleAuth(activeGoogleKey);
        } else {
          if (googleClientIdBox) {
            googleClientIdBox.style.display = googleClientIdBox.style.display === "none" ? "flex" : "none";
            if (googleClientIdInput && googleClientIdBox.style.display === "flex") {
              googleClientIdInput.focus();
            }
          }
        }
      });
    }

    if (saveClientIdAndSigninBtn && googleClientIdInput) {
      saveClientIdAndSigninBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const keyVal = googleClientIdInput.value.trim();
        if (!keyVal) {
          alert("Please paste your Firebase API Key or Google Client ID.");
          return;
        }
        activeGoogleKey = keyVal;
        localStorage.setItem("studyrag_google_key", keyVal);

        // Persist to backend .env
        try {
          if (keyVal.includes(".apps.googleusercontent.com")) {
            await fetch("/api/config/google_client_id", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: keyVal })
            });
          } else {
            await fetch("/api/config/firebase", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ api_key: keyVal, auth_domain: activeAuthDomain, project_id: activeProjectId })
            });
          }
        } catch (e) {
          console.warn("Failed to persist key:", e);
        }

        if (googleClientIdBox) googleClientIdBox.style.display = "none";
        launchRealGoogleAuth(keyVal);
      });
    }

    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!profileDropdown.contains(e.target) && e.target !== profileBtn) {
        profileDropdown.classList.remove("open");
      }
      if (!e.target.closest(".doc-menu-container")) {
        document.querySelectorAll(".doc-dropdown-menu").forEach(menu => menu.classList.add("hidden"));
      }
    });

    signOutBtn.addEventListener("click", () => {
      localStorage.removeItem("studyrag_user");
      profileDropdown.classList.remove("open");
      loginScreen.classList.remove("hidden");
      loginNameInput.value = "";
      loginEmailInput.value = "";
    });
  }

  function getSavedUser() {
    try {
      const data = localStorage.getItem("studyrag_user");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function saveUser(user) {
    localStorage.setItem("studyrag_user", JSON.stringify(user));
  }

  function applyUserProfile(user) {
    dropdownName.innerText = user.name || "Student";
    dropdownEmail.innerText = user.email || "No email";
    const initials = (user.name || "S").charAt(0).toUpperCase();
    dropdownAvatarText.innerText = initials;

    if (user.avatar) {
      profileAvatarImg.src = user.avatar;
      profileAvatarImg.classList.remove("hidden");
      profileAvatarFallback.classList.add("hidden");
    } else {
      profileAvatarImg.classList.add("hidden");
      profileAvatarFallback.classList.remove("hidden");
      profileAvatarFallback.innerText = initials;
    }
  }

  // ----------------------------------------------------
  // t2 & t4: Collapsible Panels
  // ----------------------------------------------------
  // Collapsible Sources Panel
  // ----------------------------------------------------
  function initCollapsiblePanels() {
    const isLeftCollapsed = localStorage.getItem("studyrag_left_collapsed") === "true";
    toggleLeftPanel(isLeftCollapsed);

    // Left panel collapse / expand events
    if (leftPanelCollapseBtn) {
      leftPanelCollapseBtn.addEventListener("click", () => toggleLeftPanel(true));
    }
    if (leftPanelExpandBtn) {
      leftPanelExpandBtn.addEventListener("click", () => toggleLeftPanel(false));
    }
    if (leftPanelExpandFolder) {
      leftPanelExpandFolder.addEventListener("click", () => toggleLeftPanel(false));
    }

    // Tools icon in collapsed sidebar strip (Requirement 3: Red circled section)
    if (leftPanelToolsBtn) {
      leftPanelToolsBtn.addEventListener("click", () => {
        toggleLeftPanel(false);
        setTimeout(() => {
          const toolsArea = document.getElementById("summarize-btn");
          if (toolsArea) {
            toolsArea.scrollIntoView({ behavior: "smooth", block: "center" });
            const parent = toolsArea.parentElement?.parentElement;
            if (parent) {
              parent.classList.add("ring-2", "ring-amber-400", "transition-all");
              setTimeout(() => {
                parent.classList.remove("ring-2", "ring-amber-400");
              }, 1200);
            }
          }
        }, 150);
      });
    }

    // Web Search Toggle Button (Header top-right)
    // Handled via initWebSearchToggle()

    // Dynamic Quick Tools Bar (Requirement 3: Green circled section)
    // Smoothly reveals when user moves cursor near or on the chat bar, or focuses query input; otherwise hides
    if (queryBarContainer && quickToolsBar) {
      const showTools = () => {
        quickToolsBar.classList.remove("max-h-0", "opacity-0", "-translate-y-1", "pointer-events-none");
        quickToolsBar.classList.add("max-h-12", "opacity-100", "translate-y-0", "pointer-events-auto");
      };
      const hideTools = () => {
        if (document.activeElement !== queryInput) {
          quickToolsBar.classList.add("max-h-0", "opacity-0", "-translate-y-1", "pointer-events-none");
          quickToolsBar.classList.remove("max-h-12", "opacity-100", "translate-y-0", "pointer-events-auto");
        }
      };

      queryBarContainer.addEventListener("mouseenter", showTools);
      queryBarContainer.addEventListener("mouseleave", hideTools);
      if (queryInput) {
        queryInput.addEventListener("focus", showTools);
        queryInput.addEventListener("blur", () => setTimeout(hideTools, 200));
      }
    }
  }

  function initWebSearchToggle() {
    if (!webSearchToggleBtn) return;

    function updateWebSearchUI() {
      webSearchToggleBtn.setAttribute("aria-pressed", webSearchEnabled ? "true" : "false");
      if (webSearchEnabled) {
        webSearchToggleBtn.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 font-label-meta text-xs font-bold transition-all cursor-pointer active:scale-95";
      } else {
        webSearchToggleBtn.className = "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#27272A] hover:bg-[#323238] text-slate-300 border border-[#4B4B54] hover:border-slate-300/60 font-label-meta text-xs font-bold transition-all cursor-pointer active:scale-95";
      }
    }

    updateWebSearchUI();
    webSearchToggleBtn.addEventListener("click", () => {
      webSearchEnabled = !webSearchEnabled;
      localStorage.setItem("studyrag_web_search", String(webSearchEnabled));
      updateWebSearchUI();
    });
  }

  function toggleLeftPanel(collapse) {
    if (collapse) {
      leftPanel.classList.add("collapsed");
    } else {
      leftPanel.classList.remove("collapsed");
    }
    localStorage.setItem("studyrag_left_collapsed", collapse);
  }

  // ----------------------------------------------------
  // Voice Input (Speech-to-Text)
  // ----------------------------------------------------
  function initVoiceInput() {
    if (!micBtn) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      micBtn.addEventListener("click", () => {
        alert("Speech Recognition is not supported by your current browser. Please try Google Chrome or Edge.");
      });
      return;
    }

    try {
      speechRecognition = new SpeechRec();
      speechRecognition.continuous = false;
      speechRecognition.interimResults = true;
      speechRecognition.lang = "en-US";

      speechRecognition.onstart = () => {
        isListening = true;
        micBtn.classList.add("mic-recording", "ring-2", "ring-rose-500", "bg-rose-100");
        if (micIcon) micIcon.innerText = "mic_off";
        if (queryInput) queryInput.placeholder = "Listening... Speak your question...";
      };

      speechRecognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (queryInput) queryInput.value = transcript;
      };

      speechRecognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        stopListening();
        if (event.error === "not-allowed") {
          alert("Microphone permission was denied. Please allow microphone access in your browser settings.");
        }
      };

      speechRecognition.onend = () => {
        stopListening();
      };

      micBtn.addEventListener("click", () => {
        if (isListening) {
          try { speechRecognition.stop(); } catch (e) { }
          stopListening();
        } else {
          if (queryInput) queryInput.value = "";
          try {
            speechRecognition.start();
          } catch (e) {
            console.error("Speech start error:", e);
            stopListening();
          }
        }
      });
    } catch (e) {
      console.warn("Failed to initialize speech recognition:", e);
    }
  }

  function stopListening() {
    isListening = false;
    if (micBtn) {
      micBtn.classList.remove("mic-recording", "ring-2", "ring-rose-500", "bg-rose-100");
    }
    if (micIcon) {
      micIcon.innerText = "mic";
    }
    if (queryInput) {
      queryInput.placeholder = "Ask a question about your uploaded notes...";
    }
  }

  // ----------------------------------------------------
  // t7: Document Management & File Features (Delete, Rename, See)
  // ----------------------------------------------------
  if (chatUploadBtn) chatUploadBtn.addEventListener("click", () => fileUploader.click());
  if (sidebarUploadBtn) sidebarUploadBtn.addEventListener("click", () => fileUploader.click());
  if (browseBtn) browseBtn.addEventListener("click", () => fileUploader.click());
  if (dropzone) {
    dropzone.addEventListener("click", (e) => {
      if (e.target !== browseBtn) fileUploader.click();
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("border-[#0284c7]", "bg-[#e0f2fe]/20");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("border-[#0284c7]", "bg-[#e0f2fe]/20");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("border-[#0284c7]", "bg-[#e0f2fe]/20");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesUpload(e.dataTransfer.files);
      }
    });
  }

  // Support dropping files directly onto floating chat query bar
  if (queryBarContainer) {
    queryBarContainer.addEventListener("dragover", (e) => e.preventDefault());
    queryBarContainer.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesUpload(e.dataTransfer.files);
      }
    });
  }

  // Toggle Corpus Section (Requirement 2)
  if (toggleCorpusBtn && corpusListContainer) {
    toggleCorpusBtn.addEventListener("click", () => {
      const isHidden = corpusListContainer.classList.contains("hidden");
      if (isHidden) {
        corpusListContainer.classList.remove("hidden");
        if (corpusToggleIcon) corpusToggleIcon.innerText = "expand_more";
      } else {
        corpusListContainer.classList.add("hidden");
        if (corpusToggleIcon) corpusToggleIcon.innerText = "chevron_right";
      }
    });
  }

  fileUploader.addEventListener("change", async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFilesUpload(e.target.files);
      fileUploader.value = "";
    }
  });

  async function handleFilesUpload(fileList) {
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      await uploadSingleFile(file);
    }
    await loadDocuments();
  }

  async function uploadSingleFile(file) {
    uploadStatus.classList.remove("hidden");
    uploadStatusText.innerText = `Ingesting ${file.name} (chunking & embedding)...`;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Error uploading document.");
      } else {
        appendSystemNotice(`Successfully ingested <strong>${file.name}</strong> (${data.document.total_pages} pages, ${data.document.total_chunks} chunks).`);
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      uploadStatus.classList.add("hidden");
    }
  }

  async function loadDocuments() {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      documents = data.documents || [];
      renderCorpusList();
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function renderCorpusList() {
    const hasDocs = documents && documents.length > 0;
    if (summarizeBtn) summarizeBtn.disabled = !hasDocs;
    if (mcqBtn) mcqBtn.disabled = !hasDocs;
    if (flashcardsBtn) flashcardsBtn.disabled = !hasDocs;
    if (cheatsheetBtn) cheatsheetBtn.disabled = !hasDocs;

    if (corpusCountNum) corpusCountNum.innerText = documents ? documents.length : 0;

    if (!hasDocs) {
      corpusList.innerHTML = `<div class="text-xs text-[#94a3b8] dark-text-muted italic p-3 text-center rounded-xl border border-dashed border-slate-200 dark-border">No documents uploaded yet.<br>Click "+" on search bar or "Upload Files" above.</div>`;
      sourcesBadge.innerText = "0 / 0 Selected";
      return;
    }

    corpusList.innerHTML = "";

    documents.forEach((doc) => {
      const item = document.createElement("div");
      item.className = "file-item relative hover:z-20 p-2.5 rounded-xl bg-[#18181C] hover:bg-[#222228] border border-[#38383E] hover:border-[#52525E] flex items-center justify-between gap-2 shadow-xs cursor-pointer group";

      const sizeText = formatBytes(doc.file_size_bytes);
      const chunksText = `${doc.chunk_count || 0} chunks`;
      const pagesText = `${doc.pages || 1} ${doc.pages === 1 ? 'page' : 'pages'}`;

      item.innerHTML = `
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <input type="checkbox" checked value="${escapeHtml(doc.name)}" class="doc-checkbox w-3.5 h-3.5 rounded bg-[#0A0A0A] border-neutral-600 text-[#2563eb] accent-[#2563eb] focus:ring-0 cursor-pointer shrink-0" />
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-body-sm text-xs text-white font-bold truncate block" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
            <div class="flex items-center gap-1.5 text-[11px] text-slate-400 font-normal mt-1 whitespace-nowrap overflow-hidden">
              <span class="shrink-0">${sizeText}</span>
              <span class="text-slate-500">·</span>
              <span class="truncate">${chunksText}</span>
              <span class="text-slate-500">·</span>
              <span class="shrink-0">${pagesText}</span>
            </div>
          </div>
        </div>

        <!-- 3-Dot Options Menu (View, Download, Rename, Delete) -->
        <div class="doc-menu-container relative shrink-0">
          <button type="button" class="doc-menu-btn w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer" title="Document Options">
            <span class="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
          
          <div class="doc-dropdown-menu hidden absolute right-0 top-8 w-36 bg-[#1E1E24] border border-[#3E3E48] rounded-xl shadow-2xl z-30 py-1 text-xs text-slate-100 font-medium">
            <a href="/api/files/${encodeURIComponent(doc.name)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 px-3 py-1.5 text-slate-200 hover:bg-[#2A2A32] hover:text-white transition-colors">
              <span class="material-symbols-outlined text-[15px] text-sky-400">visibility</span>
              <span>View</span>
            </a>
            <a href="/api/files/${encodeURIComponent(doc.name)}?download=true" download="${escapeHtml(doc.name)}" class="flex items-center gap-2 px-3 py-1.5 text-slate-200 hover:bg-[#2A2A32] hover:text-white transition-colors">
              <span class="material-symbols-outlined text-[15px] text-emerald-400">download</span>
              <span>Download</span>
            </a>
            <button type="button" class="doc-rename-btn w-full flex items-center gap-2 px-3 py-1.5 text-slate-200 hover:bg-[#2A2A32] hover:text-white transition-colors text-left cursor-pointer">
              <span class="material-symbols-outlined text-[15px] text-blue-400">edit</span>
              <span>Rename</span>
            </button>
            <div class="h-px bg-[#38383E] my-0.5"></div>
            <button type="button" class="doc-delete-btn w-full flex items-center gap-2 px-3 py-1.5 text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 transition-colors text-left cursor-pointer">
              <span class="material-symbols-outlined text-[15px]">delete</span>
              <span>Delete</span>
            </button>
          </div>
        </div>
      `;

      // Event handlers for 3-dot dropdown menu
      const menuBtn = item.querySelector(".doc-menu-btn");
      const dropdownMenu = item.querySelector(".doc-dropdown-menu");
      const renameBtn = item.querySelector(".doc-rename-btn");
      const deleteBtn = item.querySelector(".doc-delete-btn");

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".doc-dropdown-menu").forEach(m => {
          if (m !== dropdownMenu) m.classList.add("hidden");
        });
        dropdownMenu.classList.toggle("hidden");
        if (!dropdownMenu.classList.contains("hidden")) {
          item.style.transform = "";
        }
      });

      renameBtn.addEventListener("click", async () => {
        dropdownMenu.classList.add("hidden");
        const newName = prompt(`Rename "${doc.name}" to:`, doc.name);
        if (!newName || newName.trim() === "" || newName.trim() === doc.name) return;

        try {
          const res = await fetch("/api/documents/rename", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ old_name: doc.name, new_name: newName.trim() })
          });
          const data = await res.json();
          if (res.ok) {
            appendSystemNotice(`Renamed <strong>${escapeHtml(doc.name)}</strong> to <strong>${escapeHtml(newName.trim())}</strong>.`);
            await loadDocuments();
          } else {
            alert(data.detail || "Rename failed.");
          }
        } catch (e) {
          alert("Error renaming: " + e.message);
        }
      });

      deleteBtn.addEventListener("click", async () => {
        dropdownMenu.classList.add("hidden");
        if (!confirm(`Are you sure you want to delete "${doc.name}"? This removes its embeddings from Qdrant.`)) return;

        try {
          const res = await fetch(`/api/documents/${encodeURIComponent(doc.name)}`, {
            method: "DELETE"
          });
          const data = await res.json();
          if (res.ok) {
            appendSystemNotice(`Deleted <strong>${escapeHtml(doc.name)}</strong>.`);
            await loadDocuments();
          } else {
            alert(data.detail || "Delete failed.");
          }
        } catch (e) {
          alert("Error deleting: " + e.message);
        }
      });

      item.addEventListener("click", (e) => {
        if (e.target.closest(".doc-menu-container") || e.target.classList.contains("doc-checkbox")) return;
        const cb = item.querySelector(".doc-checkbox");
        if (cb) {
          cb.checked = !cb.checked;
          updateSourcesBadge();
        }
      });

      attachDynamicFloatEffect(item);
      corpusList.appendChild(item);
    });

    updateSourcesBadge();

    document.querySelectorAll(".doc-checkbox").forEach(cb => {
      cb.addEventListener("change", updateSourcesBadge);
    });
  }

  function updateSourcesBadge() {
    const total = documents.length;
    const active = getActiveDocNames().length;
    sourcesBadge.innerText = `${active} / ${total} Selected`;

    if (selectAllBtn) {
      const checkboxes = document.querySelectorAll(".doc-checkbox");
      if (checkboxes.length > 0 && active === total) {
        selectAllBtn.innerText = "Deselect all";
      } else {
        selectAllBtn.innerText = "Select all";
      }
    }
  }

  function getActiveDocNames() {
    const checkboxes = document.querySelectorAll(".doc-checkbox:checked");
    return Array.from(checkboxes).map(cb => cb.value);
  }

  selectAllBtn.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".doc-checkbox");
    if (checkboxes.length === 0) return;
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateSourcesBadge();
  });

  // ----------------------------------------------------
  // Grounded Chat with t3 (Edit/Copy) & t8 (Citation Toggle) & Formatted Response
  // ----------------------------------------------------
  sendBtn.addEventListener("click", handleSendQuery);
  queryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendQuery();
    }
  });

  async function handleSendQuery() {
    const query = queryInput.value.trim();
    if (!query) return;

    const activeDocs = getActiveDocNames();
    if (activeDocs.length === 0 && !webSearchEnabled) {
      alert("Please select at least one active document from the Sources panel, or enable Web Search.");
      return;
    }

    // Append User Bubble
    appendUserMessage(query);
    queryInput.value = "";

    // Append Loading Skeleton
    const loadingId = appendLoadingSkeleton();

    const savedUser = getSavedUser();
    const currentUserId = (savedUser && (savedUser.email || savedUser.name)) || "guest";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query,
          active_docs: activeDocs,
          user_id: currentUserId,
          history: chatHistory.slice(-8),
          web_search: webSearchEnabled
        })
      });
      const data = await res.json();
      removeElement(loadingId);

      if (!res.ok) {
        appendAssistantError(data.detail || "Error generating response.");
      } else {
        chatHistory.push({ role: "user", content: query });
        chatHistory.push({ role: "assistant", content: data.answer || "" });
        appendAssistantMessage(data, query, activeDocs);
      }
    } catch (err) {
      removeElement(loadingId);
      appendAssistantError("Connection failed: " + err.message);
    }
  }

  // Text-to-speech helper (Web Speech API)
  function speakText(text, btn) {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined text-[17px]">volume_up</span>`;
      }
      return;
    }

    // Clean text: strip citations [1], bold, asterisks, bullet points
    const cleanText = text
      .replace(/\[\d+\]/g, '')
      .replace(/[*_`#]/g, '')
      .replace(/•/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => {
      if (btn) btn.innerHTML = `<span class="material-symbols-outlined text-[17px]">volume_up</span>`;
    };
    utterance.onerror = () => {
      if (btn) btn.innerHTML = `<span class="material-symbols-outlined text-[17px]">volume_up</span>`;
    };
    if (btn) {
      btn.innerHTML = `<span class="material-symbols-outlined text-[17px] text-blue-600 animate-pulse">volume_off</span>`;
    }
    window.speechSynthesis.speak(utterance);
  }

  // User Chat Message with action buttons: Timestamp, Resend (refresh), Edit, Copy
  function appendUserMessage(text) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const wrapper = document.createElement("div");
    wrapper.className = "user-msg-container flex flex-col items-end max-w-2xl ml-auto mb-3 group";

    wrapper.innerHTML = `
      <div class="flex items-end gap-2">
        <div class="bg-[#1e3a8a] text-white px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-md border border-[#2563eb] max-w-xl">
          <p class="font-body-md text-body-md text-white whitespace-pre-wrap">${escapeHtml(text)}</p>
        </div>
        <div class="w-8 h-8 rounded-full bg-[#172554] text-[#93c5fd] flex items-center justify-center shrink-0 font-bold border border-[#2563eb]">
          <span class="material-symbols-outlined text-[18px]">person</span>
        </div>
      </div>

      <!-- Action bar directly below user bubble: Timestamp, Resend, Edit, Copy -->
      <div class="flex items-center gap-2 mt-1 text-slate-300 text-xs pr-10 font-medium">
        <span class="user-time text-[11px] select-none text-slate-400">${timeStr}</span>
        <button type="button" class="user-resend-btn hover:text-white p-0.5 rounded transition-colors cursor-pointer" title="Resend query">
          <span class="material-symbols-outlined text-[16px]">refresh</span>
        </button>
        <button type="button" class="user-edit-btn hover:text-white p-0.5 rounded transition-colors cursor-pointer" title="Edit query">
          <span class="material-symbols-outlined text-[16px]">edit</span>
        </button>
        <button type="button" class="user-copy-btn hover:text-white p-0.5 rounded transition-colors cursor-pointer" title="Copy text">
          <span class="material-symbols-outlined text-[16px]">content_copy</span>
        </button>
      </div>
    `;

    // Resend event: re-sends the query
    const resendBtn = wrapper.querySelector(".user-resend-btn");
    resendBtn.addEventListener("click", () => {
      queryInput.value = text;
      handleSendQuery();
    });

    // Edit event: puts text back in query input and focuses
    const editBtn = wrapper.querySelector(".user-edit-btn");
    editBtn.addEventListener("click", () => {
      queryInput.value = text;
      queryInput.focus();
      queryInput.scrollIntoView({ behavior: "smooth" });
    });

    // Copy event: copies text to clipboard
    const copyBtn = wrapper.querySelector(".user-copy-btn");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = `<span class="material-symbols-outlined text-[16px] text-green-600">check</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">content_copy</span>`;
        }, 1500);
      });
    });

    chatCanvas.appendChild(wrapper);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;
  }

  function appendLoadingSkeleton() {
    const id = "loading-" + Date.now();
    const skeleton = document.createElement("div");
    skeleton.id = id;
    skeleton.className = "flex items-start gap-space-sm max-w-3xl mr-auto loading-pulse";
    skeleton.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shrink-0 border border-[#38383E]">
        <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
      </div>
      <div class="bg-[#1E1E24] p-space-md rounded-2xl rounded-tl-none shadow-md border border-[#38383E] text-xs text-slate-100 flex items-center gap-2 font-medium">
        <span class="material-symbols-outlined animate-spin text-[16px] text-[#60a5fa]">sync</span>
        <span>Searching sources and verifying citations...</span>
      </div>
    `;
    chatCanvas.appendChild(skeleton);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;
    return id;
  }

  // Format AI markdown cleanly (bullets, bold, code, paragraph breaks)
  function formatMarkdownResponse(text) {
    if (!text) return "";
    let html = escapeHtml(text);

    // Inline code / terms
    html = html.replace(/`([^`]+)`/g, '<span class="font-medium text-[#60a5fa]">$1</span>');

    // Bold tags
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');

    // Citations [1], [2] -> interactive badges
    html = html.replace(/\[(\d+)\]/g, (match, p1) => {
      return `<button class="citation-badge inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-meta text-label-meta bg-[#2563eb] text-white font-semibold align-baseline mx-0.5 shadow-sm hover:bg-[#3b82f6] transition-colors cursor-pointer" data-citation-id="${p1}">[${p1}]</button>`;
    });

    // Lists (lines starting with * or - or •)
    const lines = html.split('\n');
    let inList = false;
    let formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
        if (!inList) {
          formattedLines.push('<ul class="list-disc pl-5 space-y-1.5 my-2">');
          inList = true;
        }
        formattedLines.push(`<li class="text-slate-200 leading-relaxed">${line.substring(2)}</li>`);
      } else {
        if (inList) {
          formattedLines.push('</ul>');
          inList = false;
        }
        if (line) {
          formattedLines.push(`<p class="leading-relaxed mb-2">${line}</p>`);
        }
      }
    }
    if (inList) formattedLines.push('</ul>');

    return formattedLines.join('');
  }

  // Assistant Message with sleek Minimalist Action Bar (Copy, Speaker, Like, Dislike, Regenerate)
  function appendAssistantMessage(data, userQuery = "", activeDocs = []) {
    const { answer, citations, is_refusal, used_external_info, web_search_used, web_sources } = data;
    const formattedHtml = formatMarkdownResponse(answer);

    const wrapper = document.createElement("div");
    wrapper.className = "assistant-msg-container flex items-start gap-space-sm max-w-3xl mr-auto mb-4 group";

    let citationsBlock = "";
    if (citations && citations.length > 0 && !is_refusal) {
      const chipHtml = citations.map(c => `
        <button class="citation-chip flex items-center gap-space-xs px-2.5 py-1.5 rounded-lg bg-[#172554] text-[#93c5fd] font-semibold shadow-sm border border-[#2563eb] text-left transition-all hover:bg-[#1e3a8a] cursor-pointer group"
          data-doc="${escapeHtml(c.doc_name)}" data-page="${c.page}" data-text="${escapeHtml(c.text)}" title="Open ${escapeHtml(c.doc_name)} (page ${c.page}) in new tab">
          <span class="font-label-meta text-label-meta font-bold bg-[#2563eb] text-white px-1.5 py-0.5 rounded-full">${c.id}</span>
          <span class="font-label-code text-label-code font-bold truncate max-w-[210px] text-white">${escapeHtml(c.doc_name)}</span>
          <span class="font-label-meta text-label-meta text-slate-300 font-medium">(p. ${c.page})</span>
          <span class="material-symbols-outlined text-[14px] text-slate-300 group-hover:text-white ml-0.5">open_in_new</span>
        </button>
      `).join("");

      // Citations are collapsed by default with a clear toggle button
      citationsBlock = `
        <div class="mt-space-md pt-space-sm border-t border-[#38383E] flex flex-col gap-2">
          <button class="toggle-citations-btn inline-flex items-center gap-1.5 text-xs font-bold text-[#60a5fa] hover:text-[#93c5fd] transition-colors self-start px-2 py-1 rounded hover:bg-[#25252c] cursor-pointer">
            <span class="material-symbols-outlined text-[16px] transition-transform toggle-icon">expand_more</span>
            <span class="toggle-text">Show Citations (${citations.length})</span>
          </button>
          <div class="citations-body flex flex-wrap items-center gap-space-xs">
            ${chipHtml}
          </div>
        </div>
      `;
    }

    const refusalBadge = is_refusal ? `
      <div class="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-950/60 text-rose-200 text-xs font-bold border border-rose-600/70">
        <span class="material-symbols-outlined text-[16px]">info</span>
        <span>Strict Grounding Refusal (Zero Hallucination Guardrail)</span>
      </div>
    ` : '';

    const externalBadge = (!is_refusal && (used_external_info || web_search_used)) ? `
      <div class="mb-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/70 text-amber-200 text-xs font-semibold border border-amber-500/60">
        <span class="material-symbols-outlined text-[15px] text-amber-300">${web_search_used ? 'language' : 'public'}</span>
        <span>${web_search_used ? 'Web Search & External Info Used (Outside Uploaded Files)' : 'External Information Used (Outside Uploaded Files)'}</span>
      </div>
    ` : '';

    let webSourcesBlock = "";
    if (!is_refusal && web_sources && web_sources.length > 0) {
      const webChips = web_sources.map(ws => `
        <a href="${escapeHtml(ws.uri)}" target="_blank" rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#16161C] hover:bg-[#23232C] text-slate-100 border border-[#3E3E48] text-xs font-medium transition-colors"
          title="${escapeHtml(ws.uri)}">
          <span class="material-symbols-outlined text-[14px] text-emerald-400">language</span>
          <span class="truncate max-w-[200px]">${escapeHtml(ws.title || ws.domain || "Web Source")}</span>
          <span class="material-symbols-outlined text-[13px] text-slate-400">open_in_new</span>
        </a>
      `).join("");
      webSourcesBlock = `
        <div class="mt-3 pt-2.5 border-t border-[#38383E] flex flex-col gap-1.5">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">Web Sources (${web_sources.length})</span>
          <div class="flex flex-wrap gap-1.5">${webChips}</div>
        </div>
      `;
    }

    wrapper.innerHTML = `
      <div class="w-8 h-8 rounded-xl ${is_refusal ? 'bg-[#ef4444]' : 'bg-[#2563eb]'} text-white flex items-center justify-center shrink-0 mt-0.5 border border-[#38383E]">
        <span class="material-symbols-outlined text-[18px]">${is_refusal ? 'help_outline' : 'auto_awesome'}</span>
      </div>
      <div class="flex flex-col flex-1 min-w-0">
        <div class="card-body bg-[#1E1E24] p-4 rounded-2xl rounded-tl-sm shadow-md border border-[#38383E]">
          ${refusalBadge}
          ${externalBadge}
          <div class="text-[#f1f5f9] space-y-2 leading-relaxed font-body-md text-body-md font-normal">
            ${formattedHtml}
          </div>
          ${webSourcesBlock}
          ${citationsBlock}
        </div>

        <!-- Minimalist Action Bar: Copy, Speaker, Like, Dislike, Regenerate -->
        <div class="ai-action-bar flex items-center gap-1.5 mt-1.5 pl-1 text-slate-300">
          <button type="button" class="btn-ai-copy hover:text-white p-1 rounded transition-colors cursor-pointer" title="Copy response">
            <span class="material-symbols-outlined text-[17px]">content_copy</span>
          </button>
          <button type="button" class="btn-ai-speak hover:text-white p-1 rounded transition-colors cursor-pointer" title="Read aloud">
            <span class="material-symbols-outlined text-[17px]">volume_up</span>
          </button>
          <button type="button" class="btn-ai-like hover:text-emerald-400 p-1 rounded transition-colors cursor-pointer" title="Good response (trains model)">
            <span class="material-symbols-outlined text-[17px]">thumb_up</span>
          </button>
          <button type="button" class="btn-ai-dislike hover:text-rose-400 p-1 rounded transition-colors cursor-pointer" title="Bad response (trains model)">
            <span class="material-symbols-outlined text-[17px]">thumb_down</span>
          </button>
          <button type="button" class="btn-ai-regenerate hover:text-[#60a5fa] p-1 rounded transition-colors cursor-pointer" title="Regenerate response">
            <span class="material-symbols-outlined text-[17px]">refresh</span>
          </button>
          <span class="ai-feedback-toast hidden text-[11px] font-bold text-emerald-400 ml-1">✓ Model learned</span>
        </div>

        <!-- Individual User Training Feedback Drawer -->
        <div class="ai-feedback-drawer hidden mt-2.5 p-3 rounded-xl bg-[#161618] border border-rose-900/60 text-xs flex flex-col gap-2.5 shadow-lg" style="display: none;">
          <div class="flex items-center justify-between text-slate-200">
            <div class="flex items-center gap-1.5 font-bold text-[11px] text-rose-300">
              <span class="material-symbols-outlined text-[15px]">thumb_down</span>
              <span>Why was this answer unhelpful?</span>
              <span class="text-[10px] text-slate-400 font-normal ml-1">(Trains model for your profile)</span>
            </div>
            <button type="button" class="btn-close-feedback text-slate-400 hover:text-white cursor-pointer"><span class="material-symbols-outlined text-[15px]">close</span></button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="feedback-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Too brief / need more detail</button>
            <button type="button" class="feedback-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Too long / keep it concise</button>
            <button type="button" class="feedback-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Use more bullet points</button>
            <button type="button" class="feedback-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Use simpler language</button>
            <button type="button" class="feedback-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Step-by-step breakdown</button>
            <button type="button" class="feedback-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Add practical examples</button>
            <button type="button" class="feedback-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Focus on exam takeaways</button>
          </div>
          <div class="flex items-center gap-1.5 mt-0.5">
            <input type="text" class="feedback-custom-input flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#38383E] bg-[#1E1E24] text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500" placeholder="Or describe how you want your future answers..." />
            <button type="button" class="btn-submit-custom-feedback px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer">Train My Model</button>
          </div>
        </div>
      </div>
    `;

    chatCanvas.appendChild(wrapper);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;

    // t8: Toggle citations collapse/expand
    const toggleCitationsBtn = wrapper.querySelector(".toggle-citations-btn");
    const citationsBody = wrapper.querySelector(".citations-body");
    const toggleIcon = wrapper.querySelector(".toggle-icon");
    const toggleText = wrapper.querySelector(".toggle-text");

    if (toggleCitationsBtn && citationsBody) {
      toggleCitationsBtn.addEventListener("click", () => {
        const isExpanded = citationsBody.classList.contains("expanded");
        if (isExpanded) {
          citationsBody.classList.remove("expanded");
          toggleIcon.style.transform = "rotate(0deg)";
          toggleText.innerText = `Show Citations (${citations.length})`;
        } else {
          citationsBody.classList.add("expanded");
          toggleIcon.style.transform = "rotate(180deg)";
          toggleText.innerText = "Hide Citations";
        }
      });
    }

    // Attach click listeners to citation chips and inline badges -> opens file in new tab
    wrapper.querySelectorAll(".citation-chip, .citation-badge").forEach(elem => {
      elem.addEventListener("click", () => {
        let docName = elem.getAttribute("data-doc");
        let pageNum = parseInt(elem.getAttribute("data-page"));

        if (!docName && citations) {
          const citId = parseInt(elem.getAttribute("data-citation-id"));
          const match = citations.find(c => c.id === citId);
          if (match) {
            docName = match.doc_name;
            pageNum = match.page;
          }
        }

        if (docName) {
          const pageParam = pageNum ? `#page=${pageNum}` : '';
          window.open(`/api/files/${encodeURIComponent(docName)}${pageParam}`, '_blank');
        }
      });
    });

    // Wire action bar buttons: Copy, Speaker, Like, Dislike, Regenerate
    const copyBtn = wrapper.querySelector(".btn-ai-copy");
    const speakBtn = wrapper.querySelector(".btn-ai-speak");
    const likeBtn = wrapper.querySelector(".btn-ai-like");
    const dislikeBtn = wrapper.querySelector(".btn-ai-dislike");
    const regenBtn = wrapper.querySelector(".btn-ai-regenerate");
    const toast = wrapper.querySelector(".ai-feedback-toast");
    const drawer = wrapper.querySelector(".ai-feedback-drawer");
    const closeDrawerBtn = wrapper.querySelector(".btn-close-feedback");
    const chips = wrapper.querySelectorAll(".feedback-chip");
    const customInput = wrapper.querySelector(".feedback-custom-input");
    const submitCustomBtn = wrapper.querySelector(".btn-submit-custom-feedback");

    // Copy action
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(answer).then(() => {
        copyBtn.innerHTML = `<span class="material-symbols-outlined text-[17px] text-green-600">check</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = `<span class="material-symbols-outlined text-[17px]">content_copy</span>`;
        }, 1500);
      });
    });

    // Speak / TTS action
    speakBtn.addEventListener("click", () => {
      speakText(answer, speakBtn);
    });

    // Feedback helper
    async function sendFeedback(rating, opinion = "") {
      try {
        const savedUser = getSavedUser();
        const currentUserId = (savedUser && (savedUser.email || savedUser.name)) || "guest";
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: userQuery || "Study Query",
            answer: answer || "",
            rating: rating,
            opinion: opinion,
            active_docs: activeDocs,
            user_id: currentUserId
          })
        });
        toast.innerText = opinion ? "✓ Model learned for your profile" : (rating === "like" ? "✓ Model reinforced" : "✓ Unliked (options below)");
        toast.classList.remove("hidden");
        updateLearningStats();
        setTimeout(() => toast.classList.add("hidden"), 3500);
      } catch (err) {
        console.warn("Feedback error:", err);
      }
    }

    // Like action
    likeBtn.addEventListener("click", (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      likeBtn.classList.add("text-emerald-600", "dark:text-emerald-400");
      dislikeBtn.classList.remove("text-rose-600", "dark:text-rose-400");
      drawer.style.display = "none";
      drawer.classList.add("hidden");
      sendFeedback("like");
    });

    // Dislike action - toggles feedback drawer & scrolls into clear view
    dislikeBtn.addEventListener("click", (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isHidden = drawer.style.display === "none" || drawer.classList.contains("hidden");
      if (!isHidden) {
        drawer.style.display = "none";
        drawer.classList.add("hidden");
        return;
      }
      dislikeBtn.classList.add("text-rose-600", "dark:text-rose-400");
      likeBtn.classList.remove("text-emerald-600", "dark:text-emerald-400");
      drawer.style.display = "flex";
      drawer.classList.remove("hidden");
      if (customInput) {
        setTimeout(() => customInput.focus(), 60);
      }
      drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (chatCanvas) chatCanvas.scrollTop = chatCanvas.scrollHeight;
      sendFeedback("dislike");
    });

    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener("click", (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        drawer.style.display = "none";
        drawer.classList.add("hidden");
      });
    }

    chips.forEach(chip => {
      chip.addEventListener("click", (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        sendFeedback("dislike", chip.innerText.trim());
        drawer.style.display = "none";
        drawer.classList.add("hidden");
      });
    });

    function submitCustom() {
      const text = customInput ? customInput.value.trim() : "";
      if (!text) return;
      sendFeedback("dislike", text);
      drawer.style.display = "none";
      drawer.classList.add("hidden");
      if (customInput) customInput.value = "";
    }

    if (submitCustomBtn) {
      submitCustomBtn.addEventListener("click", submitCustom);
    }
    if (customInput) {
      customInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitCustom();
        }
      });
    }

    // Regenerate action: re-runs the query and updates this assistant message
    regenBtn.addEventListener("click", async () => {
      if (!userQuery) return;
      regenBtn.classList.add("animate-spin", "text-blue-600");
      const loadingId = appendLoadingSkeleton();
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: userQuery,
            active_docs: activeDocs.length > 0 ? activeDocs : getActiveDocNames(),
            history: chatHistory.slice(-8),
            web_search: webSearchEnabled
          })
        });
        const newData = await res.json();
        removeElement(loadingId);
        if (res.ok) {
          wrapper.remove();
          appendAssistantMessage(newData, userQuery, activeDocs);
        } else {
          appendAssistantError(newData.detail || "Regeneration failed.");
        }
      } catch (err) {
        removeElement(loadingId);
        appendAssistantError("Regeneration failed: " + err.message);
      } finally {
        regenBtn.classList.remove("animate-spin", "text-blue-600");
      }
    });
  }

  // Helper to attach minimalist action bar for summary cards
  function attachModelTrainingBar(container, queryText, answerText, activeDocs = []) {
    const bar = document.createElement("div");
    bar.className = "flex flex-col mt-2";
    bar.innerHTML = `
      <div class="flex items-center gap-1.5 text-slate-400 dark-text-muted">
        <button type="button" class="btn-summary-copy hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded transition-colors cursor-pointer" title="Copy summary">
          <span class="material-symbols-outlined text-[17px]">content_copy</span>
        </button>
        <button type="button" class="btn-summary-speak hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded transition-colors cursor-pointer" title="Read aloud">
          <span class="material-symbols-outlined text-[17px]">volume_up</span>
        </button>
        <button type="button" class="btn-summary-like hover:text-emerald-600 dark:hover:text-emerald-400 p-1 rounded transition-colors cursor-pointer" title="Good summary">
          <span class="material-symbols-outlined text-[17px]">thumb_up</span>
        </button>
        <button type="button" class="btn-summary-dislike hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded transition-colors cursor-pointer" title="Needs improvement">
          <span class="material-symbols-outlined text-[17px]">thumb_down</span>
        </button>
        <span class="summary-toast hidden text-[11px] font-medium text-emerald-600 dark:text-emerald-400 ml-1">✓ Saved</span>
      </div>

      <!-- Feedback drawer for summary cards -->
      <div class="summary-feedback-drawer hidden mt-2.5 p-3 rounded-xl bg-[#161618] border border-rose-900/60 text-xs flex flex-col gap-2.5 shadow-lg" style="display: none;">
        <div class="flex items-center justify-between text-slate-200">
          <div class="flex items-center gap-1.5 font-bold text-[11px] text-rose-300">
            <span class="material-symbols-outlined text-[15px]">thumb_down</span>
            <span>Why was this summary unhelpful?</span>
            <span class="text-[10px] text-slate-400 font-normal ml-1">(Trains model for your profile)</span>
          </div>
          <button type="button" class="btn-close-summary-feedback text-slate-400 hover:text-white cursor-pointer"><span class="material-symbols-outlined text-[15px]">close</span></button>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" class="summary-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Too brief / need more detail</button>
          <button type="button" class="summary-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Too long / keep it concise</button>
          <button type="button" class="summary-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Use more bullet points</button>
          <button type="button" class="summary-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Use simpler language</button>
          <button type="button" class="summary-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Step-by-step breakdown</button>
          <button type="button" class="summary-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Add practical examples</button>
          <button type="button" class="summary-chip px-2.5 py-1 rounded-lg bg-[#1E1E24] border border-[#38383E] text-slate-200 hover:border-rose-500 hover:text-rose-300 text-[11px] font-medium cursor-pointer transition-colors">Focus on exam takeaways</button>
        </div>
        <div class="flex items-center gap-1.5 mt-0.5">
          <input type="text" class="summary-custom-input flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#38383E] bg-[#1E1E24] text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500" placeholder="Or describe how you want your future summaries..." />
          <button type="button" class="btn-submit-summary-feedback px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer">Train My Model</button>
        </div>
      </div>
    `;

    container.appendChild(bar);

    const copyBtn = bar.querySelector(".btn-summary-copy");
    const speakBtn = bar.querySelector(".btn-summary-speak");
    const likeBtn = bar.querySelector(".btn-summary-like");
    const dislikeBtn = bar.querySelector(".btn-summary-dislike");
    const toast = bar.querySelector(".summary-toast");
    const drawer = bar.querySelector(".summary-feedback-drawer");
    const closeDrawerBtn = bar.querySelector(".btn-close-summary-feedback");
    const chips = bar.querySelectorAll(".summary-chip");
    const customInput = bar.querySelector(".summary-custom-input");
    const submitCustomBtn = bar.querySelector(".btn-submit-summary-feedback");

    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(answerText).then(() => {
        copyBtn.innerHTML = `<span class="material-symbols-outlined text-[17px] text-green-600">check</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = `<span class="material-symbols-outlined text-[17px]">content_copy</span>`;
        }, 1500);
      });
    });

    speakBtn.addEventListener("click", () => {
      speakText(answerText, speakBtn);
    });

    async function sendSummaryFeedback(rating, opinion = "") {
      try {
        const savedUser = getSavedUser();
        const currentUserId = (savedUser && (savedUser.email || savedUser.name)) || "guest";
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: queryText,
            answer: answerText,
            rating: rating,
            opinion: opinion,
            active_docs: activeDocs,
            user_id: currentUserId
          })
        });
        toast.innerText = opinion ? "✓ Model learned for your profile" : (rating === "like" ? "✓ Model reinforced" : "✓ Unliked (options below)");
        toast.classList.remove("hidden");
        updateLearningStats();
        setTimeout(() => toast.classList.add("hidden"), 3000);
      } catch (e) {
        console.warn("Feedback error:", e);
      }
    }

    likeBtn.addEventListener("click", (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      likeBtn.classList.add("text-emerald-600");
      dislikeBtn.classList.remove("text-rose-600");
      drawer.style.display = "none";
      drawer.classList.add("hidden");
      sendSummaryFeedback("like");
    });

    dislikeBtn.addEventListener("click", (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const isHidden = drawer.style.display === "none" || drawer.classList.contains("hidden");
      if (!isHidden) {
        drawer.style.display = "none";
        drawer.classList.add("hidden");
        return;
      }
      dislikeBtn.classList.add("text-rose-600");
      likeBtn.classList.remove("text-emerald-600");
      drawer.style.display = "flex";
      drawer.classList.remove("hidden");
      if (customInput) {
        setTimeout(() => customInput.focus(), 60);
      }
      drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (chatCanvas) chatCanvas.scrollTop = chatCanvas.scrollHeight;
      sendSummaryFeedback("dislike");
    });

    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener("click", (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        drawer.style.display = "none";
        drawer.classList.add("hidden");
      });
    }

    chips.forEach(chip => {
      chip.addEventListener("click", (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        sendSummaryFeedback("dislike", chip.innerText.trim());
        drawer.style.display = "none";
        drawer.classList.add("hidden");
      });
    });

    function submitSummaryCustom() {
      const text = customInput ? customInput.value.trim() : "";
      if (!text) return;
      sendSummaryFeedback("dislike", text);
      drawer.style.display = "none";
      drawer.classList.add("hidden");
      if (customInput) customInput.value = "";
    }

    if (submitCustomBtn) {
      submitCustomBtn.addEventListener("click", submitSummaryCustom);
    }
    if (customInput) {
      customInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitSummaryCustom();
        }
      });
    }
  }

  function appendAssistantError(errorMsg) {
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-start gap-space-sm max-w-3xl mr-auto";
    wrapper.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-[#ef4444] text-white flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-[18px]">error</span>
      </div>
      <div class="bg-[#fee2e2] p-space-md rounded-2xl rounded-tl-none text-[#b91c1c] text-sm border border-[#fecaca]">
        ${escapeHtml(errorMsg)}
      </div>
    `;
    chatCanvas.appendChild(wrapper);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;
  }

  function appendSystemNotice(html) {
    const notice = document.createElement("div");
    notice.className = "inline-flex items-center self-center px-3.5 py-1.5 rounded-lg bg-[#1E1E24] text-slate-100 border border-[#38383E] shadow-xl text-xs gap-1 mx-auto my-2 font-medium";
    notice.innerHTML = html;
    chatCanvas.appendChild(notice);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;
  }

  // ----------------------------------------------------
  // AI Study Suite (Summary, MCQ Quiz, Flashcards, Cheatsheet)
  // ----------------------------------------------------
  function getSelectedDocForTool() {
    const activeDocs = getActiveDocNames();
    if (activeDocs.length > 0) return activeDocs[0];
    if (documents && documents.length > 0) return documents[0].name;
    return null;
  }

  async function triggerSummarize() {
    const docName = getSelectedDocForTool();
    if (!docName) {
      alert("Please upload and select a document to summarize.");
      return;
    }
    const loadingId = appendLoadingSkeleton();
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_name: docName, web_search: webSearchEnabled })
      });
      const data = await res.json();
      removeElement(loadingId);
      if (!res.ok) {
        appendAssistantError(data.detail || "Error generating summary.");
      } else {
        renderSummaryCard(data);
      }
    } catch (err) {
      removeElement(loadingId);
      appendAssistantError("Summarization failed: " + err.message);
    }
  }

  async function triggerMCQ() {
    const docName = getSelectedDocForTool();
    if (!docName) {
      alert("Please upload and select a document to generate MCQs.");
      return;
    }
    const loadingId = appendLoadingSkeleton();
    try {
      const res = await fetch("/api/study/mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_name: docName, count: 5, web_search: webSearchEnabled })
      });
      const data = await res.json();
      removeElement(loadingId);
      if (!res.ok || data.error) {
        appendAssistantError(data.detail || data.error || "Error generating MCQs.");
      } else {
        renderMCQCard(data);
      }
    } catch (err) {
      removeElement(loadingId);
      appendAssistantError("MCQ generation failed: " + err.message);
    }
  }

  async function triggerFlashcards() {
    const docName = getSelectedDocForTool();
    if (!docName) {
      alert("Please upload and select a document to generate flashcards.");
      return;
    }
    const loadingId = appendLoadingSkeleton();
    try {
      const res = await fetch("/api/study/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_name: docName, count: 6, web_search: webSearchEnabled })
      });
      const data = await res.json();
      removeElement(loadingId);
      if (!res.ok || data.error) {
        appendAssistantError(data.detail || data.error || "Error generating flashcards.");
      } else {
        renderFlashcardsCard(data);
      }
    } catch (err) {
      removeElement(loadingId);
      appendAssistantError("Flashcards generation failed: " + err.message);
    }
  }

  async function triggerCheatsheet() {
    const docName = getSelectedDocForTool();
    if (!docName) {
      alert("Please upload and select a document to generate a cheat sheet.");
      return;
    }
    const loadingId = appendLoadingSkeleton();
    try {
      const res = await fetch("/api/study/cheatsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_name: docName, web_search: webSearchEnabled })
      });
      const data = await res.json();
      removeElement(loadingId);
      if (!res.ok || data.error) {
        appendAssistantError(data.detail || data.error || "Error generating cheat sheet.");
      } else {
        renderCheatsheetCard(data);
      }
    } catch (err) {
      removeElement(loadingId);
      appendAssistantError("Cheat sheet generation failed: " + err.message);
    }
  }

  // Attach Event Listeners to Study Tools & Quick Chips
  if (summarizeBtn) summarizeBtn.addEventListener("click", triggerSummarize);
  if (mcqBtn) mcqBtn.addEventListener("click", triggerMCQ);
  if (flashcardsBtn) flashcardsBtn.addEventListener("click", triggerFlashcards);
  if (cheatsheetBtn) cheatsheetBtn.addEventListener("click", triggerCheatsheet);

  if (chipSummary) chipSummary.addEventListener("click", triggerSummarize);
  if (chipMcq) chipMcq.addEventListener("click", triggerMCQ);
  if (chipFlashcards) chipFlashcards.addEventListener("click", triggerFlashcards);
  if (chipCheatsheet) chipCheatsheet.addEventListener("click", triggerCheatsheet);

  function buildExternalNoticeBanner(usedExternal, noticeText, fallbackText) {
    const cleanNotice = (noticeText || "").trim();
    if (!usedExternal && !cleanNotice) return "";
    return `
      <div class="p-2.5 rounded-lg bg-amber-950/70 border border-amber-500/60 text-xs text-amber-100 flex items-start gap-2">
        <span class="material-symbols-outlined text-[16px] text-amber-300 shrink-0 mt-0.5">public</span>
        <div><span class="font-bold text-amber-200">External Information Used (Outside Uploaded Files):</span> ${escapeHtml(cleanNotice || fallbackText)}</div>
      </div>
    `;
  }

  function renderSummaryCard(data) {
    const { title, executive_summary, key_points, used_external_info, external_info_notice } = data;
    const externalBanner = buildExternalNoticeBanner(
      used_external_info,
      external_info_notice,
      "This summary includes external information from outside your uploaded file."
    );

    const keyPointsHtml = (key_points || []).map(pt => `
      <li class="text-xs text-[#475569] dark-text-secondary leading-relaxed">${escapeHtml(pt)}</li>
    `).join("");

    const card = document.createElement("div");
    card.className = "flex items-start gap-space-sm max-w-3xl mr-auto w-full";
    card.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-[#0284c7] text-white flex items-center justify-center shrink-0 shadow-sm">
        <span class="material-symbols-outlined text-[18px]">feed</span>
      </div>
      <div class="bg-white dark-bg-card rounded-xl p-space-md border border-[#cbd5e1] dark-border shadow-sm flex flex-col gap-space-sm flex-1">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-[18px] text-[#0284c7]">feed</span>
          <span class="font-title-md text-title-md font-semibold text-[#0f172a] dark-text">${escapeHtml(title || "Document Summary")}</span>
        </div>
        ${externalBanner}
        <p class="font-body-sm text-body-sm text-[#475569] dark-text-secondary leading-relaxed">
          ${escapeHtml(executive_summary || "")}
        </p>
        ${key_points && key_points.length > 0 ? `<ul class="list-disc pl-4 space-y-1">${keyPointsHtml}</ul>` : ''}
      </div>
    `;

    const summaryCardBody = card.querySelector(".bg-white");
    if (summaryCardBody) {
      attachModelTrainingBar(summaryCardBody, `Summary of ${title}`, executive_summary || title, []);
    }

    chatCanvas.appendChild(card);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;

    chatHistory.push({
      role: "user",
      content: `Summarize ${data.doc_name || title || "this document"}`
    });
    chatHistory.push({
      role: "assistant",
      content: `${title || ""}\n${external_info_notice ? "External Information Used: " + external_info_notice + "\n" : ""}${executive_summary || ""}\n${(key_points || []).join("\n")}`.trim()
    });
  }

  function renderMCQCard(data) {
    const { title, doc_name, questions, used_external_info, external_info_notice } = data;
    const anyQExternal = (questions || []).some(q => q.uses_external_info);
    const externalBanner = buildExternalNoticeBanner(
      used_external_info || anyQExternal,
      external_info_notice,
      "Some questions, options, or explanations include external information from outside your uploaded file."
    );
    const card = document.createElement("div");
    card.className = "flex items-start gap-space-sm max-w-3xl mr-auto w-full";

    const cardId = "mcq-deck-" + Date.now();
    const questionsList = (questions || []).map((q, qIndex) => {
      const qNum = qIndex + 1;
      const optionsHtml = Object.entries(q.options || {}).map(([key, val]) => `
          <button type="button" data-key="${key}" data-correct="${escapeHtml(q.correct_answer)}" class="mcq-option text-left p-2.5 rounded-lg border border-slate-200 dark-border hover:bg-[#1e293b] hover:border-emerald-400/70 transition-colors flex items-center justify-between text-xs font-medium cursor-pointer">
            <span class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-slate-100 dark-bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-[10px] shrink-0">${key}</span>
              <span class="text-slate-800 dark-text">${escapeHtml(val)}</span>
            </span>
            <span class="option-icon material-symbols-outlined text-[16px] hidden"></span>
          </button>
        `).join("");

      return `
          <div class="mcq-item p-3.5 rounded-xl bg-slate-50 dark-bg-surface border border-slate-200 dark-border flex flex-col gap-2.5" data-qid="${qNum}">
            <div class="flex items-start justify-between gap-2">
              <span class="font-semibold text-xs text-slate-900 dark-text leading-relaxed">
                <span class="text-emerald-700 dark:text-emerald-400 font-bold mr-1">Q${qNum}.</span> ${escapeHtml(q.question)}
              </span>
              <div class="flex items-center gap-1.5 shrink-0">
                ${q.uses_external_info ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/70 text-amber-200 border border-amber-500/60 shrink-0" title="Uses knowledge outside your uploaded file">External Info</span>` : ''}
                ${q.topic ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white border border-white/75 shrink-0">${escapeHtml(q.topic)}</span>` : ''}
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 options-container">
              ${optionsHtml}
            </div>
            <div class="explanation-box hidden p-2.5 rounded-lg bg-[#27272F] border border-[#4B4B54] text-xs text-white leading-relaxed">
              <span class="font-bold text-white">Explanation:</span> ${escapeHtml(q.explanation || "Correct answer from source material.")}
              ${q.uses_external_info ? `<span class="block mt-1 text-[11px] font-semibold text-amber-300">Note: This question/explanation uses external information outside your uploaded file.</span>` : ''}
            </div>
          </div>
        `;
    }).join("");

    card.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <span class="material-symbols-outlined text-[18px]">quiz</span>
        </div>
        <div id="${cardId}" class="bg-white dark-bg-card rounded-xl p-space-md border border-[#cbd5e1] dark-border shadow-sm flex flex-col gap-3 flex-1 w-full">
          <div class="flex items-center justify-between border-b border-slate-100 dark-border pb-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-emerald-600">assignment</span>
              <div>
                <span class="font-title-md text-title-md font-bold text-[#0f172a] dark-text">${escapeHtml(title || "Practice Quiz")}</span>
                <span class="text-[11px] text-slate-400 dark-text-muted block">Source: ${escapeHtml(doc_name)} · Instant Answer Feedback</span>
              </div>
            </div>
            <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200">
              ${(questions || []).length} Questions
            </span>
          </div>

          ${externalBanner}

          <div class="flex flex-col gap-3">
            ${questionsList}
          </div>
        </div>
      `;

    // Interactivity for MCQ options
    const cardContainer = card.querySelector(`#${cardId}`);
    if (cardContainer) {
      cardContainer.querySelectorAll(".mcq-item").forEach(item => {
        const options = item.querySelectorAll(".mcq-option");
        const explanation = item.querySelector(".explanation-box");

        options.forEach(opt => {
          opt.addEventListener("click", () => {
            if (item.classList.contains("answered")) return;
            item.classList.add("answered");

            const selectedKey = opt.getAttribute("data-key");
            const correctKey = opt.getAttribute("data-correct");

            options.forEach(o => {
              o.classList.remove("hover:bg-[#1e293b]", "hover:border-emerald-400/70", "cursor-pointer");
              o.disabled = true;
              const key = o.getAttribute("data-key");
              const icon = o.querySelector(".option-icon");

              if (key === correctKey) {
                o.classList.add("bg-emerald-500/15", "border-emerald-500", "ring-1", "ring-emerald-500/40", "font-bold");
                if (icon) {
                  icon.innerText = "check_circle";
                  icon.classList.remove("hidden");
                  icon.classList.add("text-emerald-500");
                }
              } else if (key === selectedKey) {
                o.classList.add("bg-rose-500/15", "border-rose-500", "ring-1", "ring-rose-500/40", "font-bold");
                if (icon) {
                  icon.innerText = "cancel";
                  icon.classList.remove("hidden");
                  icon.classList.add("text-rose-500");
                }
              }
            });

            if (explanation) explanation.classList.remove("hidden");
          });
        });
      });
    }

    chatCanvas.appendChild(card);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;
  }

  function renderFlashcardsCard(data) {
    const { title, doc_name, flashcards, used_external_info, external_info_notice } = data;
    if (!flashcards || flashcards.length === 0) return;

    const anyCardExternal = flashcards.some(fc => fc.uses_external_info);
    const externalBanner = buildExternalNoticeBanner(
      used_external_info || anyCardExternal,
      external_info_notice,
      "Some flashcards include external information from outside your uploaded file."
    );

    const card = document.createElement("div");
    card.className = "flex items-start gap-space-sm max-w-3xl mr-auto w-full";
    const cardId = "flashcard-deck-" + Date.now();

    card.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm font-bold">
          <span class="material-symbols-outlined text-[18px]">style</span>
        </div>
        <div id="${cardId}" class="bg-white dark-bg-card rounded-xl p-space-md border border-[#cbd5e1] dark-border shadow-sm flex flex-col gap-3 flex-1 w-full">
          <div class="flex items-center justify-between border-b border-[#38383E] pb-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-amber-400">style</span>
              <div>
                <span class="font-title-md text-title-md font-bold text-[#f8fafc]">${escapeHtml(title || "Flashcard Deck")}</span>
                <span class="text-[11px] text-slate-300 block">Source: ${escapeHtml(doc_name)} · Active Recall</span>
              </div>
            </div>
            <span class="text-xs font-bold text-amber-200 bg-[#271C08] px-2.5 py-1 rounded-lg border border-amber-400/60 deck-counter">
              Card 1 of ${flashcards.length}
            </span>
          </div>

          ${externalBanner}

          <!-- Flashcard Card Face (High Contrast) -->
          <div class="flashcard-face min-h-[150px] p-5 rounded-xl bg-[#0F1117] border-2 border-amber-400/70 flex flex-col justify-between cursor-pointer transition-all hover:bg-[#151822] hover:border-amber-300 hover:shadow-lg select-none">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-[11px] uppercase font-bold tracking-wider text-amber-300 fc-tag">Prompt</span>
                <span class="fc-external-badge hidden px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-200 border border-amber-400/60">External Info (Outside File)</span>
              </div>
              <span class="text-[11px] text-slate-200 font-medium flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">touch_app</span> Click to Flip
              </span>
            </div>
            <div class="fc-content py-4 text-center font-semibold text-base text-white leading-relaxed"></div>
            <div class="text-center">
              <span class="text-[11px] font-semibold text-amber-300 fc-hint">Tap card to reveal answer</span>
            </div>
          </div>

          <!-- Navigation Controls -->
          <div class="flex items-center justify-between pt-1">
            <button class="fc-prev px-3.5 py-1.5 rounded-lg bg-[#16161C] border border-[#4B4B54] text-slate-100 hover:bg-[#262630] hover:border-amber-400/60 hover:text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:hover:bg-[#16161C] disabled:hover:border-[#4B4B54] cursor-pointer disabled:cursor-not-allowed transition-colors">
              <span class="material-symbols-outlined text-[16px]">arrow_back</span> Prev
            </button>
            <button class="fc-flip px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer transition-colors">
              <span class="material-symbols-outlined text-[16px]">sync</span> Flip Card
            </button>
            <button class="fc-next px-3.5 py-1.5 rounded-lg bg-[#16161C] border border-[#4B4B54] text-slate-100 hover:bg-[#262630] hover:border-amber-400/60 hover:text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:hover:bg-[#16161C] disabled:hover:border-[#4B4B54] cursor-pointer disabled:cursor-not-allowed transition-colors">
              Next <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      `;

    const container = card.querySelector(`#${cardId}`);
    let currentIndex = 0;
    let isFlipped = false;

    const face = container.querySelector(".flashcard-face");
    const tag = container.querySelector(".fc-tag");
    const extBadge = container.querySelector(".fc-external-badge");
    const content = container.querySelector(".fc-content");
    const hint = container.querySelector(".fc-hint");
    const counter = container.querySelector(".deck-counter");
    const prevBtn = container.querySelector(".fc-prev");
    const nextBtn = container.querySelector(".fc-next");
    const flipBtn = container.querySelector(".fc-flip");

    function updateCard() {
      const item = flashcards[currentIndex];
      counter.innerText = `Card ${currentIndex + 1} of ${flashcards.length}`;
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === flashcards.length - 1;

      if (extBadge) {
        if (item.uses_external_info) {
          extBadge.classList.remove("hidden");
        } else {
          extBadge.classList.add("hidden");
        }
      }

      if (!isFlipped) {
        face.className = "flashcard-face min-h-[150px] p-5 rounded-xl bg-[#0F1117] border-2 border-amber-400/70 flex flex-col justify-between cursor-pointer transition-all hover:bg-[#151822] hover:border-amber-300 hover:shadow-lg select-none";
        tag.innerText = item.tag || "Prompt / Question";
        tag.className = "text-[11px] uppercase font-bold tracking-wider text-amber-300 fc-tag";
        content.innerText = item.front;
        content.className = "fc-content py-4 text-center font-semibold text-base text-white leading-relaxed";
        hint.innerText = "Tap card or click Flip to reveal answer";
        hint.className = "text-[11px] font-semibold text-amber-300 fc-hint";
      } else {
        face.className = "flashcard-face min-h-[150px] p-5 rounded-xl bg-[#0A1F17] border-2 border-emerald-400/75 flex flex-col justify-between cursor-pointer transition-all hover:bg-[#0E291F] hover:border-emerald-300 hover:shadow-lg select-none";
        tag.innerText = "Answer / Solution";
        tag.className = "text-[11px] uppercase font-bold tracking-wider text-emerald-300 fc-tag";
        content.innerText = item.back;
        content.className = "fc-content py-4 text-center font-medium text-sm text-white leading-relaxed whitespace-pre-line";
        hint.innerText = "Tap card to flip back to question";
        hint.className = "text-[11px] font-semibold text-emerald-300 fc-hint";
      }
    }

    function toggleFlip() {
      isFlipped = !isFlipped;
      updateCard();
    }

    face.addEventListener("click", toggleFlip);
    flipBtn.addEventListener("click", toggleFlip);
    prevBtn.addEventListener("click", () => {
      if (currentIndex > 0) {
        currentIndex--;
        isFlipped = false;
        updateCard();
      }
    });
    nextBtn.addEventListener("click", () => {
      if (currentIndex < flashcards.length - 1) {
        currentIndex++;
        isFlipped = false;
        updateCard();
      }
    });

    updateCard();
    chatCanvas.appendChild(card);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;
  }

  function renderCheatsheetCard(data) {
    const { title, doc_name, overview, core_definitions, key_formulas_or_rules, common_pitfalls, quick_tips, used_external_info, external_info_notice } = data;
    const anyItemExternal = (core_definitions || []).some(d => d.uses_external_info) || (key_formulas_or_rules || []).some(f => f.uses_external_info);
    const showExternalNotice = Boolean(used_external_info || anyItemExternal || (external_info_notice || "").trim());

    const card = document.createElement("div");
    card.className = "flex items-start gap-space-sm max-w-3xl mr-auto w-full";

    // Strict 3-color Cheat Sheet palette: Charcoal (#1E1E24 / #111116), White/Slate (#f8fafc / #cbd5e1), Purple (#a78bfa / #7c3aed)
    const externalBannerHtml = showExternalNotice ? `
        <div class="p-2.5 rounded-lg bg-[#111116] border border-purple-500/60 text-xs text-slate-200 flex items-start gap-2">
          <span class="material-symbols-outlined text-[16px] text-purple-400 shrink-0 mt-0.5">public</span>
          <div><span class="font-bold text-purple-300">External Information Used (Outside Uploaded Files):</span> ${escapeHtml((external_info_notice || "").trim() || "Some definitions or formulas use external information from outside your uploaded file.")}</div>
        </div>
      ` : '';

    const defsHtml = (core_definitions || []).map(d => `
        <div class="p-2.5 rounded-lg bg-[#111116] border border-[#38383E]">
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-xs text-purple-300">${escapeHtml(d.term)}</span>
            ${d.uses_external_info ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-950 text-purple-200 border border-purple-500/50 shrink-0">External Info</span>` : ''}
          </div>
          <span class="text-xs text-slate-100 leading-relaxed mt-1 block">${escapeHtml(d.definition)}</span>
        </div>
      `).join("");

    const formulasHtml = (key_formulas_or_rules || []).map(f => `
        <div class="p-2.5 rounded-lg bg-[#111116] border border-purple-500/40">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-xs text-purple-300 font-label-code">${escapeHtml(f.name)}</span>
            ${f.uses_external_info ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-950 text-purple-200 border border-purple-500/50 shrink-0">External Info</span>` : ''}
          </div>
          <span class="text-xs text-slate-100 leading-relaxed mt-1 block font-label-code whitespace-pre-line">${escapeHtml(f.detail)}</span>
        </div>
      `).join("");

    const pitfallsHtml = (common_pitfalls || []).map(p => `
        <li class="text-xs text-slate-200 leading-relaxed">${escapeHtml(p)}</li>
      `).join("");

    const tipsHtml = (quick_tips || []).map(t => `
        <li class="text-xs text-slate-200 leading-relaxed">${escapeHtml(t)}</li>
      `).join("");

    card.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <span class="material-symbols-outlined text-[18px]">fact_check</span>
        </div>
        <div class="bg-[#1E1E24] rounded-xl p-space-md border border-[#38383E] shadow-sm flex flex-col gap-3 flex-1 w-full">
          <div class="flex items-center justify-between border-b border-[#38383E] pb-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-purple-400">fact_check</span>
              <div>
                <span class="font-title-md text-title-md font-bold text-slate-100">${escapeHtml(title || "High-Yield Cheat Sheet")}</span>
                <span class="text-[11px] text-slate-300 block">Source: ${escapeHtml(doc_name)} · Exam Quick Revision</span>
              </div>
            </div>
            <span class="text-xs font-bold text-purple-200 bg-[#24193d] px-2.5 py-1 rounded-lg border border-purple-500/50">
              High-Yield
            </span>
          </div>

          ${externalBannerHtml}

          ${overview ? `<p class="text-xs text-slate-200 leading-relaxed bg-[#111116] p-2.5 rounded-lg border border-[#38383E]">${escapeHtml(overview)}</p>` : ''}

          <!-- Core Definitions -->
          ${core_definitions && core_definitions.length > 0 ? `
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-purple-300">Essential Definitions</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${defsHtml}</div>
            </div>
          ` : ''}

          <!-- Formulas & Rules -->
          ${key_formulas_or_rules && key_formulas_or_rules.length > 0 ? `
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-purple-300">Key Formulas & Rules</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${formulasHtml}</div>
            </div>
          ` : ''}

          <!-- Pitfalls & Exam Traps -->
          ${common_pitfalls && common_pitfalls.length > 0 ? `
            <div class="p-3 rounded-lg bg-[#111116] border border-purple-500/40 flex flex-col gap-1">
              <span class="text-xs font-bold text-purple-300 flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px] text-purple-400">warning</span>
                Common Pitfalls & Exam Mistakes to Avoid
              </span>
              <ul class="list-disc pl-5 space-y-1">${pitfallsHtml}</ul>
            </div>
          ` : ''}

          <!-- Quick Tips -->
          ${quick_tips && quick_tips.length > 0 ? `
            <div class="p-3 rounded-lg bg-[#111116] border border-[#38383E] flex flex-col gap-1">
              <span class="text-xs font-bold text-purple-300 flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px] text-purple-400">lightbulb</span>
                Quick Exam Tips
              </span>
              <ul class="list-disc pl-5 space-y-1">${tipsHtml}</ul>
            </div>
          ` : ''}
        </div>
      `;

    chatCanvas.appendChild(card);
    chatCanvas.scrollTop = chatCanvas.scrollHeight;
  }

  // ----------------------------------------------------
  // Continuous Learning & User Preferences
  // ----------------------------------------------------
  function initLearningPreferences() {
    updateLearningStats();

    if (openLearningBtn) {
      openLearningBtn.addEventListener("click", () => {
        learningModal.classList.remove("hidden");
        updateLearningStats();
      });
    }

    if (closeLearningBtn) {
      closeLearningBtn.addEventListener("click", () => {
        learningModal.classList.add("hidden");
      });
    }

    if (learningModal) {
      learningModal.addEventListener("click", (e) => {
        if (e.target === learningModal) learningModal.classList.add("hidden");
      });
    }

    if (clearLearningBtn) {
      clearLearningBtn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to reset learned preferences?")) return;
        try {
          await fetch("/api/feedback/clear", { method: "POST" });
          updateLearningStats();
          appendSystemNotice("Continuous learning memory has been reset.");
        } catch (err) {
          console.error("Failed to clear feedback:", err);
        }
      });
    }
  }

  async function updateLearningStats() {
    try {
      const res = await fetch("/api/feedback/stats");
      if (!res.ok) return;
      const stats = await res.json();

      if (learnedCount) learnedCount.innerText = stats.total_feedbacks || 0;
      if (learningLikes) learningLikes.innerText = stats.likes || 0;
      if (learningDislikes) learningDislikes.innerText = stats.dislikes || 0;
      if (learningRate) learningRate.innerText = stats.satisfaction_rate || "100%";

      // Render active learned rules
      if (learningRulesList) {
        if (stats.learned_rules && stats.learned_rules.length > 0) {
          learningRulesList.innerHTML = stats.learned_rules.map(rule => `
            <div class="flex items-start gap-2 p-2 rounded-lg bg-white dark-bg-card border border-slate-100 dark-border">
              <span class="material-symbols-outlined text-[16px] text-emerald-600 mt-0.5 shrink-0">check_circle</span>
              <span class="text-slate-700 dark-text font-medium leading-relaxed">${escapeHtml(rule)}</span>
            </div>
          `).join("");
        } else {
          learningRulesList.innerHTML = `<span class="text-slate-400 italic">No custom rules yet. Like/dislike answers or leave quick opinions to train your study assistant.</span>`;
        }
      }

      // Render recent feedbacks
      if (learningRecentList) {
        if (stats.recent_feedbacks && stats.recent_feedbacks.length > 0) {
          learningRecentList.innerHTML = stats.recent_feedbacks.map(fb => `
            <div class="p-2.5 flex items-start justify-between gap-2 hover:bg-slate-50 dark-hover:bg-slate-800">
              <div class="flex flex-col min-w-0">
                <span class="font-semibold text-slate-800 dark-text truncate">"${escapeHtml(fb.query)}"</span>
                ${fb.opinion ? `<span class="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Opinion: "${escapeHtml(fb.opinion)}"</span>` : ''}
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${fb.rating === 'like' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                ${escapeHtml(fb.rating)}
              </span>
            </div>
          `).join("");
        } else {
          learningRecentList.innerHTML = `<div class="p-3 text-center text-slate-400 italic">No feedback entries yet.</div>`;
        }
      }
    } catch (e) {
      console.warn("Error updating learning stats:", e);
    }
  }

  // Utilities
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function removeElement(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
});
