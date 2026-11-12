/**
 * Unlisted company / technology profile (/?view=company-technology-profile).
 * Keep fallback markup in sync with company-technology-profile.html.
 */
(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get("view") !== "company-technology-profile") return;

  function addNoIndex() {
    var robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive, nosnippet, noimageindex";
    document.head.appendChild(robots);
  }

  function buildFromFallback() {
    var el = document.getElementById("icfp-company-profile-fallback");
    if (!el) return null;
    var inner = el.content
      ? el.content.cloneNode(true)
      : null;
    var html = inner
      ? (function () {
          var wrap = document.createElement("div");
          wrap.appendChild(inner);
          return wrap.innerHTML;
        })()
      : el.innerHTML;
    return (
      "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\" />" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />" +
      "<meta name=\"robots\" content=\"noindex, nofollow, noarchive, nosnippet, noimageindex\" />" +
      "<title>Company &amp; Technology Profile — Inner City Fire Protection</title>" +
      "<link rel=\"stylesheet\" href=\"./styles.css\" />" +
      "</head><body class=\"stack-doc\">" +
      html +
      "</body></html>"
    );
  }

  function show(html) {
    addNoIndex();
    document.documentElement.classList.remove("icfp-profile-pending");
    document.open();
    document.write(html);
    document.close();
  }

  function run() {
    fetch("./company-technology-profile.html", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(function (res) {
        if (!res.ok) throw new Error("missing");
        return res.text();
      })
      .then(show)
      .catch(function () {
        var html = buildFromFallback();
        if (html) show(html);
        else document.documentElement.classList.remove("icfp-profile-pending");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
