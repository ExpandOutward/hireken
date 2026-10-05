(() => {
  const form = document.getElementById("login-form");
  const nameInput = document.getElementById("name-input");
  const passwordInput = document.getElementById("password-input");
  const submitBtn = document.getElementById("submit-btn");
  const togglePassword = document.getElementById("toggle-password");
  const jsonOutput = document.getElementById("json-output");
  const jsonStatus = document.getElementById("json-status");
  const jsonNote = document.getElementById("json-note");
  const resetBtn = document.getElementById("reset-btn");
  const oauthToast = document.getElementById("oauth-toast");

  const GEO_ENDPOINTS = [
    {
      url: "https://ipwho.is/",
      parse(data) {
        if (!data || data.success === false) return null;
        return {
          ip: data.ip || "unknown",
          location: formatLocation(data.city, data.region, data.country),
        };
      },
    },
    {
      url: "https://ipapi.co/json/",
      parse(data) {
        if (!data || data.error) return null;
        return {
          ip: data.ip || "unknown",
          location: formatLocation(data.city, data.region, data.country_name),
        };
      },
    },
  ];

  let geo = {
    ip: "lookup in progress",
    location: "lookup in progress",
  };
  let toastTimer = 0;

  function formatLocation(...parts) {
    const value = parts.filter(Boolean).join(", ");
    return value || "unknown";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function highlightJson(payload) {
    const json = JSON.stringify(payload, null, 2);
    return json.replace(
      /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?/g,
      (match, stringValue, isKey) => {
        if (isKey) {
          return `<span class="json-key">${escapeHtml(stringValue)}</span>${isKey}`;
        }
        return `<span class="json-string">${escapeHtml(stringValue)}</span>`;
      }
    );
  }

  function updateFieldState(input) {
    input.closest(".field")?.classList.toggle("has-value", Boolean(input.value));
  }

  function syncSubmitState() {
    const ready = nameInput.value.trim() !== "" && passwordInput.value !== "";
    submitBtn.disabled = !ready;
  }

  function showPlaceholder() {
    jsonStatus.textContent = "Waiting for a login attempt";
    jsonStatus.classList.remove("is-live");
    jsonOutput.innerHTML =
      '<span class="json-placeholder">This text will be replaces with the contents of the JSON file typically sent to hackers.</span>';
    jsonNote.textContent =
      "Email/username and Password come from the form. IP and location are pulled from your browser.";
    resetBtn.hidden = true;
  }

  function renderPayload(payload) {
    jsonStatus.textContent = "Captured · display only";
    jsonStatus.classList.add("is-live");
    jsonOutput.innerHTML = highlightJson(payload);
    jsonNote.textContent =
      "If this were a real phishing kit, this JSON would already be on the attacker’s server. Refreshing or clicking Clear display discards it — it was never stored.";
    resetBtn.hidden = false;
  }

  async function lookupGeo() {
    for (const endpoint of GEO_ENDPOINTS) {
      try {
        const response = await fetch(endpoint.url, { cache: "no-store" });
        if (!response.ok) continue;
        const parsed = endpoint.parse(await response.json());
        if (parsed?.ip) {
          geo = parsed;
          return;
        }
      } catch {
        // Try the next public lookup. Failure is fine for a local demo.
      }
    }
    geo = {
      ip: "unavailable in this browser",
      location: "unavailable in this browser",
    };
  }

  function showOauthLesson(provider) {
    const messages = {
      phone:
        "Fake “Continue with phone” buttons can steal a one-time code just like a password.",
      google:
        "Fake Google buttons often open a lookalike OAuth screen and capture the account that way.",
      apple:
        "Fake Apple buttons work the same way: they are not Apple, even when the logo matches.",
    };
    oauthToast.hidden = false;
    oauthToast.textContent = messages[provider] || "Those buttons are part of the replica, not real sign-in.";
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      oauthToast.hidden = true;
    }, 5200);
  }

  [nameInput, passwordInput].forEach((input) => {
    updateFieldState(input);
    input.addEventListener("input", () => {
      updateFieldState(input);
      syncSubmitState();
    });
  });

  togglePassword.addEventListener("click", () => {
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    togglePassword.textContent = show ? "Hide" : "Show";
    togglePassword.setAttribute("aria-pressed", String(show));
  });

  document.querySelectorAll("[data-oauth]").forEach((button) => {
    button.addEventListener("click", () => {
      showOauthLesson(button.getAttribute("data-oauth"));
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const password = passwordInput.value;
    if (!name || !password) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Collecting…";

    if (geo.ip === "lookup in progress") {
      await lookupGeo();
    }

    const payload = {
      name,
      password,
      ip: geo.ip,
      location: geo.location,
    };

    renderPayload(payload);
    submitBtn.textContent = "Log in";
    syncSubmitState();
  });

  resetBtn.addEventListener("click", () => {
    form.reset();
    passwordInput.type = "password";
    togglePassword.textContent = "Show";
    togglePassword.setAttribute("aria-pressed", "false");
    updateFieldState(nameInput);
    updateFieldState(passwordInput);
    syncSubmitState();
    showPlaceholder();
  });

  syncSubmitState();
  lookupGeo();
})();
