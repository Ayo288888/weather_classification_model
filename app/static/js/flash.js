/** SweetAlert2 toast wrapper - shows flash-style notifications for user actions.
 * Exposes window.Flash = { success, error, info, warning, queue }.
 * queue() persists a message across a redirect/reload (e.g. login -> dashboard);
 * it is consumed and shown once on the next page's DOMContentLoaded. */
(function () {
    "use strict";

    var QUEUE_KEY = "wfs_flash";

    function themeColors() {
        var styles = getComputedStyle(document.documentElement);
        return {
            background: styles.getPropertyValue("--color-surface").trim(),
            color: styles.getPropertyValue("--color-text").trim(),
        };
    }

    function fire(icon, message) {
        if (typeof Swal === "undefined" || !message) return;
        var colors = themeColors();
        Swal.mixin({
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            background: colors.background,
            color: colors.color,
            didOpen: function (toast) {
                toast.addEventListener("mouseenter", Swal.stopTimer);
                toast.addEventListener("mouseleave", Swal.resumeTimer);
            },
        }).fire({ icon: icon, title: message });
    }

    function queue(icon, message) {
        try {
            sessionStorage.setItem(QUEUE_KEY, JSON.stringify({ icon: icon, message: message }));
        } catch (e) { /* storage unavailable (private mode, etc.) */ }
    }

    function consumeQueue() {
        var raw;
        try {
            raw = sessionStorage.getItem(QUEUE_KEY);
            sessionStorage.removeItem(QUEUE_KEY);
        } catch (e) {
            return;
        }
        if (!raw) return;
        try {
            var payload = JSON.parse(raw);
            fire(payload.icon, payload.message);
        } catch (e) { /* malformed payload, ignore */ }
    }

    window.Flash = {
        success: function (message) { fire("success", message); },
        error: function (message) { fire("error", message); },
        info: function (message) { fire("info", message); },
        warning: function (message) { fire("warning", message); },
        queue: queue,
    };

    document.addEventListener("DOMContentLoaded", consumeQueue);
})();
