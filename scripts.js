function initCarousels() {
  document.querySelectorAll("[data-carousel]").forEach((root) => {
    const viewport = root.querySelector("[data-carousel-viewport]");
    const prev = root.querySelector("[data-carousel-prev]");
    const next = root.querySelector("[data-carousel-next]");
    const dotsRoot = root.querySelector("[data-carousel-dots]");
    const cards = [...viewport.querySelectorAll(".card")];

    if (!viewport || cards.length === 0) {
      return;
    }

    let index = 0;

    cards.forEach((card, cardIndex) => {
      const dot = document.createElement("button");
      const title = card.querySelector("h3");
      dot.type = "button";
      dot.className = "carousel__dot";
      dot.setAttribute("aria-label", title ? `Show ${title.textContent.trim()}` : `Show card ${cardIndex + 1}`);
      dot.addEventListener("click", () => goTo(cardIndex));
      dotsRoot.append(dot);
    });

    const dots = [...dotsRoot.querySelectorAll(".carousel__dot")];

    function cardLeft(card) {
      const viewportBox = viewport.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      return viewport.scrollLeft + (cardBox.left - viewportBox.left);
    }

    function goTo(nextIndex, behavior = "smooth") {
      index = Math.max(0, Math.min(cards.length - 1, nextIndex));
      viewport.scrollTo({
        left: cardLeft(cards[index]),
        behavior,
      });
      updateControls();
    }

    function updateControls() {
      prev.disabled = index === 0;
      next.disabled = index === cards.length - 1;
      dots.forEach((dot, dotIndex) => {
        dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
      });
    }

    function syncIndexFromScroll() {
      const nearest = cards.reduce((closest, card, cardIndex) => {
        const distance = Math.abs(cardLeft(card) - viewport.scrollLeft);
        return distance < closest.distance ? { index: cardIndex, distance } : closest;
      }, { index: 0, distance: Number.POSITIVE_INFINITY });

      if (nearest.index !== index) {
        index = nearest.index;
        updateControls();
      }
    }

    prev.addEventListener("click", () => goTo(index - 1));
    next.addEventListener("click", () => goTo(index + 1));
    viewport.addEventListener("scroll", syncIndexFromScroll, { passive: true });
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => goTo(index, "auto"), 100);
    });

    root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      }
    });

    goTo(0, "auto");
  });
}

function initModals() {
  const openers = document.querySelectorAll("[data-modal-open]");

  openers.forEach((opener) => {
    opener.addEventListener("click", () => {
      const dialog = document.getElementById(opener.getAttribute("data-modal-open"));
      if (dialog && typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    });
  });

  document.querySelectorAll(".modal").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    dialog.querySelectorAll("[data-modal-close]").forEach((closer) => {
      closer.addEventListener("click", () => dialog.close());
    });
  });
}

function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) {
    return;
  }

  const status = form.querySelector("[data-contact-status]");
  const submit = form.querySelector('button[type="submit"]');
  const fields = [...form.querySelectorAll("input[required], textarea[required]")];

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

  function validate() {
    let firstInvalid = null;

    fields.forEach((field) => {
      clearFieldError(field);
      if (!field.checkValidity()) {
        markInvalid(field);
        if (!firstInvalid) {
          firstInvalid = field;
        }
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      setStatus("Please complete the highlighted fields.", "error");
      return false;
    }

    return true;
  }

  fields.forEach((field) => {
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true" && field.checkValidity()) {
        clearFieldError(field);
      }
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    if (!validate()) {
      return;
    }

    if (form.elements.website && form.elements.website.value.trim()) {
      form.reset();
      setStatus("Thanks. I will be in touch shortly.");
      return;
    }

    const payload = {
      name: form.elements.name.value.trim(),
      businessName: form.elements.businessName.value.trim(),
      businessType: form.elements.businessType.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      service: form.elements.service.value.trim(),
    };

    const webhook = (form.getAttribute("data-webhook") || "").trim();

    if (submit) {
      submit.disabled = true;
    }

    try {
      if (webhook) {
        const body = new URLSearchParams(payload);
        await fetch(webhook, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        });
      }

      form.reset();
      fields.forEach(clearFieldError);
      setStatus("Thanks. I will be in touch shortly.");
    } catch (error) {
      setStatus("The request could not be sent. Please try again.", "error");
    } finally {
      if (submit) {
        submit.disabled = false;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initCarousels();
  initModals();
  initContactForm();
});
