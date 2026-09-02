(function () {
  const rail = document.querySelector("[data-rail]");
  const toggle = document.querySelector("[data-menu-toggle]");
  const scrim = document.querySelector("[data-scrim]");
  const links = [...document.querySelectorAll(".toc a")];
  const articles = [...document.querySelectorAll("[data-article]")];
  const searchInput = document.querySelector("[data-search-input]");
  const page = document.querySelector(".page");

  function setMenu(open) {
    rail.classList.toggle("is-open", open);
    scrim.classList.toggle("is-on", open);
    scrim.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", () => {
    setMenu(!rail.classList.contains("is-open"));
  });

  scrim.addEventListener("click", () => setMenu(false));

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) {
        return;
      }
      event.preventDefault();
      setMenu(false);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) {
        return;
      }

      links.forEach((link) => {
        const current = link.getAttribute("href") === `#${visible.target.id}`;
        if (current) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    },
    { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] }
  );

  articles.forEach((article) => io.observe(article));
  links[0]?.setAttribute("aria-current", "true");

  let emptyNote = null;

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    let shown = 0;

    articles.forEach((article) => {
      const match = !query || article.textContent.toLowerCase().includes(query);
      article.classList.toggle("is-hidden", !match);
      if (match) {
        shown += 1;
      }
    });

    if (!emptyNote) {
      emptyNote = document.createElement("p");
      emptyNote.className = "search-empty";
      emptyNote.hidden = true;
      page.prepend(emptyNote);
    }

    emptyNote.hidden = shown > 0;
    emptyNote.textContent = shown > 0 ? "" : `No sections match “${searchInput.value.trim()}”.`;
  });
})();
