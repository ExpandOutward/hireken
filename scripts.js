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

document.addEventListener("DOMContentLoaded", () => {
  initCarousels();
  initModals();
});
