(function () {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Mobile nav toggle
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href.length <= 1) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (nav) nav.classList.remove("open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
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

  // Hero background positioning heuristic: center interesting area on load
  (function positionHeroBackground() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const img = new Image();
    img.src = "./images/IMG_8884.jpg";
    img.onload = () => {
      const isPortrait = img.naturalHeight > img.naturalWidth;
      // If portrait, push focal point higher so faces/subjects likely visible
      // If landscape, slight upward bias to avoid cropping heads
      const y = isPortrait ? "30%" : "35%";
      hero.style.setProperty("--hero-bg-pos", `center ${y}`);
      // Simulate a temporary sticky hero feel by adjusting background position on scroll
      const onScroll = () => {
        const rect = hero.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        // Only influence while hero is in view (first viewport height)
        const t = Math.max(0, Math.min(1, 1 - rect.top / vh));
        const dy = Math.round(t * 40); // up to 40px shift
        hero.style.setProperty("--hero-bg-pos", `center calc(${y} + ${dy}px)`);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    };
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

  async function submitToSupabase(payload) {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      throw new Error(
        "Missing Supabase config. Create config.js with SUPABASE_URL and SUPABASE_ANON_KEY."
      );
    }
    const client = supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
    const { data, error } = await client
      .from("contact_messages")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data;
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
    return {
      ok: true,
      payload: {
        name,
        email,
        phone,
        message,
        submitted_at: new Date().toISOString(),
      },
    };
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const result = validate(formData);

      if (!result.ok) {
        if (result.reason === "spam") return; // silently drop
        if (result.reason === "email")
          setStatus("Please provide a valid email address.", "error");
        else setStatus("Please fill in all required fields.", "error");
        return;
      }

      setStatus("Sending…");
      try {
        await submitToSupabase(result.payload);
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
})();
