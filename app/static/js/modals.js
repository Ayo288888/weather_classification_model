(function () {
    "use strict";

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function getModal(name) {
        return document.querySelector('[data-modal="' + name + '"]');
    }

    function openModal(name) {
        var overlay = getModal(name);
        if (!overlay) return;
        document.querySelectorAll(".modal-overlay.is-open").forEach(closeOverlay);
        overlay.hidden = false;
        // rAF so the transition runs from the hidden state
        requestAnimationFrame(function () {
            overlay.classList.add("is-open");
            var firstInput = overlay.querySelector("input");
            if (firstInput) firstInput.focus();
        });
        document.body.style.overflow = "hidden";
    }

    function closeOverlay(overlay) {
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
        window.setTimeout(function () {
            if (!overlay.classList.contains("is-open")) overlay.hidden = true;
        }, 260);
    }

    function closeAllModals() {
        document.querySelectorAll(".modal-overlay.is-open").forEach(closeOverlay);
    }

    function clearFormErrors(form) {
        form.querySelectorAll(".field-error").forEach(function (el) { el.textContent = ""; });
        form.querySelectorAll("input.has-error").forEach(function (el) { el.classList.remove("has-error"); });
        var formError = form.querySelector("[data-form-error]");
        if (formError) formError.textContent = "";
    }

    function setFieldError(form, name, message) {
        var target = form.querySelector('[data-field-error="' + name + '"]');
        var input = form.querySelector('[name="' + name + '"]');
        if (target) target.textContent = message || "";
        if (input) input.classList.toggle("has-error", Boolean(message));
    }

    function showFormErrors(form, errors) {
        Object.keys(errors).forEach(function (field) {
            var messages = Array.isArray(errors[field]) ? errors[field] : [errors[field]];
            var target = form.querySelector('[data-field-error="' + field + '"]');
            if (target) {
                setFieldError(form, field, messages[0]);
            } else {
                var formError = form.querySelector("[data-form-error]");
                if (formError) formError.textContent = messages[0];
            }
        });
    }

    /** Client-side mirror of the server-side validators, for immediate inline feedback. */
    function validateForm(form) {
        var errors = {};
        var get = function (name) {
            var el = form.querySelector('[name="' + name + '"]');
            return el ? el.value.trim() : null;
        };

        var fullname = get("fullname");
        if (fullname !== null) {
            if (!fullname) errors.fullname = ["This field is required."];
            else if (fullname.length < 2) errors.fullname = ["Must be at least 2 characters."];
        }

        var email = get("email");
        if (email !== null) {
            if (!email) errors.email = ["This field is required."];
            else if (!EMAIL_RE.test(email)) errors.email = ["Enter a valid email address."];
        }

        var password = get("password");
        if (password !== null) {
            if (!password) errors.password = ["This field is required."];
            else if (form.dataset.authForm === "register" && password.length < 8) {
                errors.password = ["Must be at least 8 characters."];
            }
        }

        var confirmPassword = get("confirm_password");
        if (confirmPassword !== null) {
            if (!confirmPassword) errors.confirm_password = ["This field is required."];
            else if (confirmPassword !== password) errors.confirm_password = ["Passwords do not match."];
        }

        return errors;
    }

    function initLiveValidation(form) {
        var inputs = Array.prototype.slice.call(form.querySelectorAll("input[name]"));

        function revalidate(name, force) {
            var input = form.querySelector('[name="' + name + '"]');
            var touched = force || (input && input.dataset.touched === "true") || form.dataset.submitted === "true";
            if (!touched) return;
            var errors = validateForm(form);
            setFieldError(form, name, errors[name] ? errors[name][0] : "");
        }

        inputs.forEach(function (input) {
            if (input.type === "checkbox") return;

            input.addEventListener("blur", function () {
                input.dataset.touched = "true";
                revalidate(input.name, true);
                if (input.name === "password") revalidate("confirm_password", false);
            });

            input.addEventListener("input", function () {
                revalidate(input.name, false);
                if (input.name === "password") revalidate("confirm_password", false);
            });
        });
    }

    function submitAuthForm(form) {
        var kind = form.dataset.authForm; // "login" | "register"
        var url = kind === "login" ? "/auth/login" : "/auth/register";

        clearFormErrors(form);
        form.dataset.submitted = "true";

        var clientErrors = validateForm(form);
        if (Object.keys(clientErrors).length) {
            showFormErrors(form, clientErrors);
            return;
        }

        var payload = {};
        new FormData(form).forEach(function (value, key) { payload[key] = value; });

        var submitBtn = form.querySelector(".modal-submit");
        if (submitBtn) submitBtn.disabled = true;

        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
            .then(function (resp) {
                return resp.json().then(function (data) { return { ok: resp.ok, data: data }; });
            })
            .then(function (result) {
                if (result.ok && result.data.success) {
                    var fullname = result.data.user && result.data.user.fullname;
                    var message = kind === "login"
                        ? "Welcome back" + (fullname ? ", " + fullname : "") + "!"
                        : "Account created" + (fullname ? ", welcome " + fullname : "") + "!";
                    window.Flash.queue("success", message);
                    window.location.href = result.data.redirect || "/dashboard/";
                    return;
                }
                showFormErrors(form, result.data.errors || { email: ["Something went wrong. Please try again."] });
                window.Flash.error("Something went wrong. Please check the form and try again.");
            })
            .catch(function () {
                showFormErrors(form, { email: ["Network error. Please try again."] });
                window.Flash.error("Network error. Please try again.");
            })
            .finally(function () {
                if (submitBtn) submitBtn.disabled = false;
            });
    }

    function initModalTriggers() {
        document.querySelectorAll("[data-modal-target]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                openModal(btn.dataset.modalTarget);
            });
        });

        document.querySelectorAll("[data-modal-close]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                closeOverlay(btn.closest(".modal-overlay"));
            });
        });

        document.querySelectorAll("[data-modal-switch]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                closeAllModals();
                window.setTimeout(function () { openModal(btn.dataset.modalSwitch); }, 200);
            });
        });

        document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
            overlay.addEventListener("click", function (event) {
                if (event.target === overlay) closeOverlay(overlay);
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeAllModals();
        });
    }

    function initAuthForms() {
        document.querySelectorAll("[data-auth-form]").forEach(function (form) {
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                submitAuthForm(form);
            });
            initLiveValidation(form);
        });
    }

    function initLogout() {
        var btn = document.querySelector("[data-logout-button]");
        if (!btn) return;
        btn.addEventListener("click", function () {
            fetch("/auth/logout", { method: "POST" }).finally(function () {
                window.Flash.queue("success", "Logged out successfully!");
                window.location.href = "/";
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initModalTriggers();
        initAuthForms();
        initLogout();
    });
})();
