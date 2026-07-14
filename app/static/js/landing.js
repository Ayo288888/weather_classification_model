(function () {
    "use strict";

    var HERO_INTERVAL_MS = 5500;
    var PIPELINE_INTERVAL_MS = 3000;

    /** Generic auto-advancing slider: cycles `slideSelector` elements inside
     * `root` via an `is-active` class, in step with `dotSelector` buttons.
     * Pauses on hover and respects prefers-reduced-motion. */
    function initSlider(root, slideSelector, dotSelector, intervalMs) {
        if (!root) return;

        var slides = Array.prototype.slice.call(root.querySelectorAll(slideSelector));
        var dots = Array.prototype.slice.call(root.querySelectorAll(dotSelector));
        if (!slides.length) return;

        var current = 0;
        var timer = null;
        var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function goTo(index) {
            slides[current].classList.remove("is-active");
            dots[current] && dots[current].classList.remove("is-active");
            dots[current] && dots[current].setAttribute("aria-selected", "false");

            current = (index + slides.length) % slides.length;

            slides[current].classList.add("is-active");
            dots[current] && dots[current].classList.add("is-active");
            dots[current] && dots[current].setAttribute("aria-selected", "true");
        }

        function next() {
            goTo(current + 1);
        }

        function start() {
            if (reducedMotion || timer) return;
            timer = window.setInterval(next, intervalMs);
        }

        function stop() {
            window.clearInterval(timer);
            timer = null;
        }

        dots.forEach(function (dot, index) {
            dot.addEventListener("click", function () {
                goTo(index);
                stop();
                start();
            });
        });

        root.addEventListener("mouseenter", stop);
        root.addEventListener("mouseleave", start);

        start();
    }

    function initHeroSlider() {
        initSlider(document.querySelector("[data-hero]"), ".hero__slide", ".hero__dot", HERO_INTERVAL_MS);
    }

    function initPipelineSlider() {
        initSlider(document.querySelector("[data-pipeline-slider]"), ".pipeline-step", ".pipeline-slider__dot", PIPELINE_INTERVAL_MS);
    }

    function initScrollReveal() {
        var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
        if (!revealEls.length) return;

        if (!("IntersectionObserver" in window)) {
            revealEls.forEach(function (el) { el.classList.add("revealed"); });
            return;
        }

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var target = entry.target;
                    target.classList.add("revealed");

                    var children = Array.prototype.slice.call(target.querySelectorAll(".reveal-child"));
                    children.forEach(function (child, index) {
                        child.style.transitionDelay = (index * 90) + "ms";
                        child.classList.add("revealed");
                    });

                    observer.unobserve(target);
                });
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
        );

        revealEls.forEach(function (el) { observer.observe(el); });
    }

    function animateCounter(el) {
        var target = parseFloat(el.dataset.value || "0");
        var duration = 1400;
        var start = performance.now();

        function tick(now) {
            var progress = Math.min((now - start) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var value = target * eased;
            el.textContent = value.toFixed(2);
            if (progress < 1) {
                window.requestAnimationFrame(tick);
            } else {
                el.textContent = target.toFixed(2);
            }
        }

        window.requestAnimationFrame(tick);
    }

    function initCounters() {
        var counters = Array.prototype.slice.call(document.querySelectorAll("[data-counter]"));
        if (!counters.length) return;

        if (!("IntersectionObserver" in window)) {
            counters.forEach(animateCounter);
            return;
        }

        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                });
            },
            { threshold: 0.5 }
        );

        counters.forEach(function (el) { observer.observe(el); });
    }

    function initFooterYear() {
        var el = document.querySelector("[data-current-year]");
        if (el) el.textContent = new Date().getFullYear();
    }

    document.addEventListener("DOMContentLoaded", function () {
        initHeroSlider();
        initPipelineSlider();
        initScrollReveal();
        initCounters();
        initFooterYear();
    });
})();
