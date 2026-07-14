(function () {
    "use strict";

    function notifyThemeChange() {
        document.dispatchEvent(new CustomEvent("themechange", {
            detail: {
                theme: document.documentElement.getAttribute("data-theme"),
            },
        }));
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        try {
            localStorage.setItem("theme", theme);
        } catch (e) {
            /* localStorage unavailable (private mode, etc.) - degrade silently */
        }
        notifyThemeChange();
    }

    function initThemeToggle() {
        var toggle = document.querySelector("[data-theme-toggle]");
        if (!toggle) return;
        toggle.addEventListener("click", function () {
            var current = document.documentElement.getAttribute("data-theme");
            applyTheme(current === "dark" ? "light" : "dark");
        });
    }

    function initMobileNav() {
        var toggle = document.querySelector("[data-nav-toggle]");
        var nav = document.querySelector("[data-nav-links]");
        if (!toggle || !nav) return;
        toggle.addEventListener("click", function () {
            var isOpen = nav.classList.toggle("is-open");
            toggle.setAttribute("aria-expanded", String(isOpen));
        });
        nav.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                nav.classList.remove("is-open");
                toggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    function initGlassyHeader() {
        var header = document.querySelector("[data-site-header]");
        if (!header) return;
        function onScroll() {
            header.classList.toggle("site-header--scrolled", window.scrollY > 12);
        }
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initThemeToggle();
        initMobileNav();
        initGlassyHeader();
    });
})();
