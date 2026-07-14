(function () {
    "use strict";

    function setFieldError(form, name, message) {
        var target = form.querySelector('[data-field-error="' + name + '"]');
        var input = form.querySelector('[name="' + name + '"]');
        if (target) target.textContent = message || "";
        if (input) input.classList.toggle("has-error", Boolean(message));
    }

    function clearErrors(form) {
        form.querySelectorAll(".field-error").forEach(function (el) { el.textContent = ""; });
        form.querySelectorAll("input.has-error").forEach(function (el) { el.classList.remove("has-error"); });
        var formError = form.querySelector("[data-form-error]");
        if (formError) formError.textContent = "";
    }

    function showErrors(form, errors) {
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

    function submitJSON(form, url, onSuccess) {
        clearErrors(form);
        var payload = {};
        new FormData(form).forEach(function (value, key) { payload[key] = value; });

        var submitBtn = form.querySelector('button[type="submit"]');
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
                    onSuccess(result.data);
                    return;
                }
                var errors = result.data.errors || {};
                showErrors(form, errors);
                window.Flash.error("Something went wrong. Please check the form and try again.");
            })
            .catch(function () {
                window.Flash.error("Network error. Please try again.");
            })
            .finally(function () {
                if (submitBtn) submitBtn.disabled = false;
            });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var profileForm = document.querySelector("[data-profile-form]");
        if (profileForm) {
            profileForm.addEventListener("submit", function (event) {
                event.preventDefault();
                submitJSON(profileForm, "/dashboard/profile", function () {
                    window.Flash.queue("success", "Account details updated.");
                    window.location.reload();
                });
            });
        }

        var passwordForm = document.querySelector("[data-password-form]");
        if (passwordForm) {
            passwordForm.addEventListener("submit", function (event) {
                event.preventDefault();
                submitJSON(passwordForm, "/dashboard/profile/password", function () {
                    window.Flash.success("Password updated.");
                    passwordForm.reset();
                });
            });
        }
    });
})();
