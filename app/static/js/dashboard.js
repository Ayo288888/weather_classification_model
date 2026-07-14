(function () {
    "use strict";

    function initSidebar() {
        var sidebar = document.querySelector("[data-sidebar]");
        var scrim = document.querySelector("[data-sidebar-scrim]");
        var openBtn = document.querySelector("[data-sidebar-open]");
        var closeBtn = document.querySelector("[data-sidebar-close]");
        if (!sidebar) return;

        function open() {
            sidebar.classList.add("is-open");
            if (scrim) {
                scrim.hidden = false;
                requestAnimationFrame(function () { scrim.classList.add("is-open"); });
            }
            document.body.style.overflow = "hidden";
        }

        function close() {
            sidebar.classList.remove("is-open");
            if (scrim) {
                scrim.classList.remove("is-open");
                window.setTimeout(function () {
                    if (!scrim.classList.contains("is-open")) scrim.hidden = true;
                }, 260);
            }
            document.body.style.overflow = "";
        }

        if (openBtn) openBtn.addEventListener("click", open);
        if (closeBtn) closeBtn.addEventListener("click", close);
        if (scrim) scrim.addEventListener("click", close);

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") close();
        });

        sidebar.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", close);
        });
    }

    document.addEventListener("DOMContentLoaded", initSidebar);
})();
