(function () {
    "use strict";

    var GAUGE_CIRCUMFERENCE = 326.7256;

    function setFieldError(form, name, message) {
        var target = form.querySelector('[data-field-error="' + name + '"]');
        var input = form.querySelector('[name="' + name + '"]');
        if (target) target.textContent = message || "";
        if (input) input.classList.toggle("has-error", Boolean(message));
    }

    function clearErrors(form) {
        form.querySelectorAll(".field-error").forEach(function (el) { el.textContent = ""; });
        form.querySelectorAll("select.has-error").forEach(function (el) { el.classList.remove("has-error"); });
        var formError = form.querySelector("[data-form-error]");
        if (formError) formError.textContent = "";
    }

    function animateNumber(el, target, decimals) {
        var duration = 900;
        var start = performance.now();
        var startValue = parseFloat(el.textContent) || 0;

        function tick(now) {
            var progress = Math.min((now - start) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var value = startValue + (target - startValue) * eased;
            el.textContent = decimals ? value.toFixed(decimals) : Math.round(value);
            if (progress < 1) window.requestAnimationFrame(tick);
            else el.textContent = decimals ? target.toFixed(decimals) : Math.round(target);
        }

        window.requestAnimationFrame(tick);
    }

    function renderBreakdown(breakdown) {
        var container = document.querySelector("[data-breakdown-list]");
        var template = document.getElementById("breakdown-item-template");
        if (!container || !template) return;
        container.innerHTML = "";

        var maxAbs = breakdown.reduce(function (max, item) {
            return Math.max(max, Math.abs(item.contribution));
        }, 0) || 1;

        breakdown.forEach(function (item) {
            var node = template.content.cloneNode(true);
            node.querySelector("[data-bi-feature]").textContent = item.feature;
            node.querySelector("[data-bi-rank]").textContent =
                "MI Rank #" + item.mi_rank + " · score " + item.mi_score.toFixed(3);
            node.querySelector("[data-bi-value]").textContent = "Entered value: " + item.value;

            var bar = node.querySelector("[data-bi-bar]");
            bar.classList.add("breakdown-item__bar-fill--" + item.direction);
            var pct = Math.round((Math.abs(item.contribution) / maxAbs) * 100);

            container.appendChild(node);
            window.requestAnimationFrame(function () { bar.style.width = pct + "%"; });
        });
    }

    function renderResults(result) {
        var panel = document.querySelector("[data-results-panel]");
        var verdict = document.querySelector("[data-verdict]");
        var isRain = result.prediction === 1;

        verdict.classList.remove("verdict-card--rain", "verdict-card--no-rain");
        verdict.classList.add(isRain ? "verdict-card--rain" : "verdict-card--no-rain");
        document.querySelector("[data-verdict-title]").textContent =
            isRain ? "Rain Expected Tomorrow" : "No Rain Expected Tomorrow";

        var confidence = result.confidence;
        var gaugeCircle = document.querySelector("[data-gauge-circle]");
        var offset = GAUGE_CIRCUMFERENCE * (1 - confidence / 100);
        gaugeCircle.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE);
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                gaugeCircle.style.strokeDashoffset = String(offset);
            });
        });
        animateNumber(document.querySelector("[data-gauge-number]"), confidence, 1);

        var rainPct = result.probability_rain * 100;
        var noRainPct = result.probability_no_rain * 100;
        document.querySelector("[data-prob-rain-value]").textContent = rainPct.toFixed(1) + "%";
        document.querySelector("[data-prob-no-rain-value]").textContent = noRainPct.toFixed(1) + "%";
        var rainFill = document.querySelector("[data-prob-rain-fill]");
        var noRainFill = document.querySelector("[data-prob-no-rain-fill]");
        rainFill.style.width = "0%";
        noRainFill.style.width = "0%";
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                rainFill.style.width = rainPct + "%";
                noRainFill.style.width = noRainPct + "%";
            });
        });

        renderBreakdown(result.feature_breakdown);

        panel.hidden = false;
        window.requestAnimationFrame(function () {
            panel.classList.add("is-visible");
        });

        var saveConfirmation = document.querySelector("[data-save-confirmation]");
        saveConfirmation.hidden = true;
        window.setTimeout(function () { saveConfirmation.hidden = false; }, 550);

        panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    var LOADING_MIN_MS = 2000;

    function delay(ms) {
        return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
    }

    function showLoading() {
        if (typeof Swal === "undefined") return;
        Swal.fire({
            title: "Extracting weather patterns...",
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: function () { Swal.showLoading(); },
        });
    }

    function hideLoading() {
        if (typeof Swal === "undefined") return;
        Swal.close();
    }

    function submitForm(form) {
        clearErrors(form);

        var selects = Array.prototype.slice.call(form.querySelectorAll("select[name]"));
        var payload = {};
        selects.forEach(function (select) { payload[select.name] = select.value; });

        var submitBtn = form.querySelector("[data-classify-submit]");
        submitBtn.disabled = true;
        showLoading();

        var fetchPromise = fetch("/dashboard/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).then(function (resp) {
            return resp.json().then(function (data) { return { ok: resp.ok, data: data }; });
        });

        Promise.all([fetchPromise, delay(LOADING_MIN_MS)])
            .then(function (results) {
                var result = results[0];
                hideLoading();

                if (result.ok && result.data.success) {
                    renderResults(result.data.result);
                    window.Flash.success("Prediction saved to your history.");
                    return;
                }
                var errs = result.data.errors || {};
                Object.keys(errs).forEach(function (name) {
                    var msg = Array.isArray(errs[name]) ? errs[name][0] : errs[name];
                    setFieldError(form, name, msg);
                });
                if (!Object.keys(errs).length) {
                    var formError = form.querySelector("[data-form-error]");
                    if (formError) formError.textContent = "Something went wrong. Please try again.";
                }
                window.Flash.error("Something went wrong. Please check your inputs and try again.");
            })
            .catch(function () {
                hideLoading();
                var formError = form.querySelector("[data-form-error]");
                if (formError) formError.textContent = "Network error. Please try again.";
                window.Flash.error("Network error. Please try again.");
            })
            .finally(function () {
                submitBtn.disabled = false;
            });
    }

    function resetForm(form) {
        form.reset();
        clearErrors(form);
    }

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.querySelector("[data-classify-form]");
        if (!form) return;

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            submitForm(form);
        });

        var resetBtn = document.querySelector("[data-reset-defaults]");
        if (resetBtn) resetBtn.addEventListener("click", function () { resetForm(form); });

        var newPredictionBtn = document.querySelector("[data-new-prediction]");
        if (newPredictionBtn) {
            newPredictionBtn.addEventListener("click", function () {
                var panel = document.querySelector("[data-results-panel]");
                panel.classList.remove("is-visible");
                window.setTimeout(function () { panel.hidden = true; }, 500);
                document.querySelector("[data-classify-card]").scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    });
})();
