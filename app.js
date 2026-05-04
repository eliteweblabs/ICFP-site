(function () {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href.length <= 1) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Lightbox for gallery
  const lightbox = (function createLightbox() {
    const backdrop = document.createElement("div");
    backdrop.className = "lightbox-backdrop";
    backdrop.innerHTML =
      '<button class="lightbox-close" aria-label="Close">Close</button>' +
      '<div class="lightbox-inner"><img class="lightbox-image" alt="Expanded photo"/><div class="lightbox-caption" aria-live="polite"></div></div>';
    document.body.appendChild(backdrop);
    const imgEl = backdrop.querySelector(".lightbox-image");
    const capEl = backdrop.querySelector(".lightbox-caption");
    const closeBtn = backdrop.querySelector(".lightbox-close");
    function open(src, caption) {
      imgEl.src = src;
      capEl.textContent = caption || "";
      backdrop.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      backdrop.classList.remove("open");
      imgEl.removeAttribute("src");
      capEl.textContent = "";
      document.body.style.overflow = "";
    }
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    closeBtn.addEventListener("click", close);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
    return { open, close };
  })();

  document.querySelectorAll("[data-lightbox]")?.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const href = a.getAttribute("href");
      const caption =
        a.getAttribute("data-caption") || a.querySelector("img")?.alt || "";
      if (href) lightbox.open(href, caption);
    });
  });

  // Hero slideshow
  (function initHeroSlider() {
    const hero = document.querySelector(".hero");
    const slides = Array.from(document.querySelectorAll(".hero-slide"));
    const dotsWrap = document.querySelector(".hero-dots");
    const progressBar = document.querySelector(".hero-progress-bar");
    const prevBtn = document.querySelector(".hero-prev");
    const nextBtn = document.querySelector(".hero-next");
    if (!slides.length || !dotsWrap) return;

    const DURATION = 5000;
    let current = 0;
    let timer = null;

    const dots = slides.map((_, i) => {
      const btn = document.createElement("button");
      btn.className = "hero-dot" + (i === 0 ? " active" : "");
      btn.setAttribute("aria-label", "Go to slide " + (i + 1));
      btn.addEventListener("click", () => goTo(i, true));
      dotsWrap.appendChild(btn);
      return btn;
    });

    function goTo(index, manual) {
      slides[current].classList.remove("active");
      dots[current].classList.remove("active");
      current = (index + slides.length) % slides.length;
      slides[current].classList.add("active");
      dots[current].classList.add("active");
      if (manual) resetTimer();
    }

    function resetTimer() {
      clearTimeout(timer);
      if (progressBar) {
        progressBar.style.transition = "none";
        progressBar.style.width = "0%";
        progressBar.getBoundingClientRect(); // force reflow
      }
      scheduleNext();
    }

    function scheduleNext() {
      if (progressBar) {
        progressBar.style.transition = "width " + DURATION + "ms linear";
        progressBar.style.width = "100%";
      }
      timer = setTimeout(() => goTo(current + 1), DURATION);
    }

    if (prevBtn) prevBtn.addEventListener("click", () => goTo(current - 1, true));
    if (nextBtn) nextBtn.addEventListener("click", () => goTo(current + 1, true));

    if (hero) {
      hero.addEventListener("mouseenter", () => {
        clearTimeout(timer);
        if (progressBar) progressBar.style.transition = "none";
      });
      hero.addEventListener("mouseleave", () => {
        if (!document.hidden) resetTimer();
      });

      let touchX = 0;
      hero.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
      hero.addEventListener("touchend", (e) => {
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 44) dx > 0 ? goTo(current - 1, true) : goTo(current + 1, true);
      }, { passive: true });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearTimeout(timer);
      else resetTimer();
    });

    scheduleNext();
  })();

  // Contact form
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("form-status");

  function setStatus(message, type) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove("success", "error");
    if (type) statusEl.classList.add(type);
  }

  async function submitForm(payload) {
    const accessKey = window.WEB3FORMS_KEY;
    if (!accessKey) {
      throw new Error("Missing WEB3FORMS_KEY in config.js");
    }
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ access_key: accessKey, ...payload }),
    });
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.message || "Submission failed");
    }
    return json;
  }

  function validate(formData) {
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const honeypot = String(formData.get("company") || "").trim();
    if (honeypot) return { ok: false, reason: "spam" };
    if (!name || !email || !message) return { ok: false, reason: "required" };
    const emailOk = /.+@.+\..+/.test(email);
    if (!emailOk) return { ok: false, reason: "email" };
    return { ok: true, payload: { name, email, phone, message } };
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const result = validate(formData);

      if (!result.ok) {
        if (result.reason === "spam") return;
        if (result.reason === "email")
          setStatus("Please provide a valid email address.", "error");
        else setStatus("Please fill in all required fields.", "error");
        return;
      }

      setStatus("Sending…");
      try {
        await submitForm(result.payload);
        setStatus("Thanks! Your message has been sent.", "success");
        form.reset();
      } catch (err) {
        console.error(err);
        setStatus(
          "Sorry, there was a problem sending your message. Please try again later.",
          "error"
        );
      }
    });
  }

  // Vapi voice AI chat widget
  (function initVapi() {
    const key = window.VAPI_PUBLIC_KEY;
    const assistantId = window.VAPI_ASSISTANT_ID;
    if (!key || !assistantId) return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js";
    script.defer = true;
    script.async = true;
    script.onload = function () {
      window.vapiInstance = window.vapiSDK.run({
        apiKey: key,
        assistant: assistantId,
        config: {
          position: "bottom-right",
          offset: "40px",
          width: "50px",
          height: "50px",
          idle: {
            color: "#e11d48",
            type: "round",
            icon: "https://unpkg.com/lucide-static@0.321.0/icons/phone.svg",
          },
          active: {
            color: "#b91c3b",
            type: "round",
            icon: "https://unpkg.com/lucide-static@0.321.0/icons/phone-off.svg",
          },
        },
      });
    };
    document.head.appendChild(script);
  })();
})();
