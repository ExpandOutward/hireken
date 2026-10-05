const CONTACT_EMAIL = "kenjsdev@pm.me";

function applyContactEmail() {
  document.querySelectorAll("[data-contact-email]").forEach((node) => {
    node.setAttribute("href", `mailto:${CONTACT_EMAIL}`);
    if (node.querySelector("img")) {
      node.setAttribute("aria-label", CONTACT_EMAIL);
      return;
    }
    node.textContent = CONTACT_EMAIL;
  });
}

function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) {
    return;
  }

  const status = form.querySelector("[data-contact-status]");
  const submit = form.querySelector('button[type="submit"]');
  const methodGroup = document.getElementById("contact-method");
  const serviceGroup = document.getElementById("contact-service");
  const textFields = [...form.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], textarea")].filter(
    (field) => field.name !== "website",
  );

  function setStatus(message, state) {
    if (!status) {
      return;
    }
    status.hidden = !message;
    status.textContent = message;
    if (state) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
    }
  }

  function clearFieldError(field) {
    field.removeAttribute("aria-invalid");
  }

  function markInvalid(field) {
    field.setAttribute("aria-invalid", "true");
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidPhone(value) {
    const digits = value.replace(/\D/g, "");
    return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
  }

  function checkedValues(name) {
    return [...form.elements[name]].filter((field) => field.checked).map((field) => field.value);
  }

  function validate() {
    textFields.forEach(clearFieldError);
    clearFieldError(methodGroup);
    clearFieldError(serviceGroup);

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const phone = form.elements.phone.value.trim();
    const description = form.elements.description.value.trim();
    const contactMethod = checkedValues("contactMethod")[0] || "";
    const services = checkedValues("service");
    let firstInvalid = null;
    let message = "";

    function fail(field, nextMessage) {
      markInvalid(field);
      if (!firstInvalid) {
        firstInvalid = field;
        message = nextMessage;
      }
    }

    if (!name) fail(form.elements.name, "Please complete the highlighted fields.");
    if (!email) fail(form.elements.email, "Please complete the highlighted fields.");
    else if (!isValidEmail(email)) fail(form.elements.email, "Please enter a valid email address.");
    if (!phone) fail(form.elements.phone, "Please complete the highlighted fields.");
    else if (!isValidPhone(phone)) fail(form.elements.phone, "Please enter a valid phone number.");
    if (!contactMethod) fail(methodGroup, "Choose a preferred contact method.");
    if (services.length === 0) fail(serviceGroup, "Choose at least one service.");
    if (!description) fail(form.elements.description, "Please complete the highlighted fields.");

    if (firstInvalid) {
      const focusTarget = firstInvalid.matches("fieldset")
        ? firstInvalid.querySelector("input")
        : firstInvalid;
      focusTarget.focus();
      setStatus(message, "error");
      return null;
    }

    return {
      name,
      email,
      phone,
      "Preferred contact method": contactMethod,
      Service: services.join(", "),
      Description: description,
      _subject: "New inquiry for Empowering David",
      _template: "table",
      _captcha: "false",
      _replyto: email,
    };
  }

  form.addEventListener("input", (event) => {
    const field = event.target;
    if (field.closest && field.closest("[aria-invalid='true']")) {
      clearFieldError(field.closest("fieldset") || field);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    const payload = validate();
    if (!payload) {
      return;
    }

    if (form.elements.website && form.elements.website.value.trim()) {
      form.reset();
      setStatus("Thanks. I will be in touch shortly.");
      return;
    }

    if (submit) {
      submit.disabled = true;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CONTACT_EMAIL)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      const accepted = response.ok && data && String(data.success) === "true";

      if (!accepted) {
        setStatus("The request could not be sent. Please try again.", "error");
        return;
      }

      form.reset();
      textFields.forEach(clearFieldError);
      clearFieldError(methodGroup);
      clearFieldError(serviceGroup);
      setStatus("Thanks. I will be in touch shortly.");
    } catch (error) {
      setStatus("The request could not be sent. Please try again.", "error");
    } finally {
      clearTimeout(timeout);
      if (submit) {
        submit.disabled = false;
      }
    }
  });
}

function boot() {
  applyContactEmail();
  initContactForm();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
