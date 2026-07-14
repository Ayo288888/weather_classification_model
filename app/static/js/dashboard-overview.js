(function () {
    "use strict";

    var charts = {};

    function cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function palette() {
        return {
            primary: cssVar("--color-primary"),
            blue: cssVar("--color-blue"),
            success: cssVar("--color-success"),
            lime: cssVar("--color-lime"),
            muted: cssVar("--color-muted"),
            text: cssVar("--color-text"),
            border: cssVar("--color-border"),
            surface: cssVar("--color-surface"),
        };
    }

    function getData() {
        var el = document.getElementById("overview-data");
        if (!el) return null;
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            return null;
        }
    }

    function animateCounter(el) {
        var target = parseFloat(el.dataset.value || "0");
        var decimals = el.dataset.decimals ? parseInt(el.dataset.decimals, 10) : 0;
        var duration = 1200;
        var start = performance.now();

        function tick(now) {
            var progress = Math.min((now - start) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            var value = target * eased;
            el.textContent = decimals ? value.toFixed(decimals) : Math.round(value).toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(tick);
            } else {
                el.textContent = decimals ? target.toFixed(decimals) : target.toLocaleString();
            }
        }

        window.requestAnimationFrame(tick);
    }

    function initCounters() {
        document.querySelectorAll("[data-stat-counter]").forEach(animateCounter);
    }

    function initTrendChart(data, colors) {
        var canvas = document.getElementById("chart-trends");
        if (!canvas || !window.Chart) return;
        charts.trend = new Chart(canvas, {
            type: "line",
            data: {
                labels: data.daily.map(function (d) { return d.date; }),
                datasets: [
                    {
                        label: "Rain",
                        data: data.daily.map(function (d) { return d.rain; }),
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + "26",
                        fill: true,
                        tension: .4,
                        pointRadius: 3,
                        pointBackgroundColor: colors.primary,
                    },
                    {
                        label: "No Rain",
                        data: data.daily.map(function (d) { return d.no_rain; }),
                        borderColor: colors.success,
                        backgroundColor: colors.success + "26",
                        fill: true,
                        tension: .4,
                        pointRadius: 3,
                        pointBackgroundColor: colors.success,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        align: "end",
                        labels: { color: colors.text, usePointStyle: true, padding: 16 },
                    },
                },
                scales: {
                    x: { grid: { color: colors.border }, ticks: { color: colors.muted } },
                    y: {
                        beginAtZero: true,
                        ticks: { color: colors.muted, precision: 0 },
                        grid: { color: colors.border },
                    },
                },
            },
        });
    }

    function updateChartColors() {
        if (!window.Chart || !charts.trend) return;
        var colors = palette();
        var datasets = charts.trend.data.datasets;
        datasets[0].borderColor = colors.primary;
        datasets[0].backgroundColor = colors.primary + "26";
        datasets[0].pointBackgroundColor = colors.primary;
        datasets[1].borderColor = colors.success;
        datasets[1].backgroundColor = colors.success + "26";
        datasets[1].pointBackgroundColor = colors.success;
        charts.trend.options.plugins.legend.labels.color = colors.text;
        charts.trend.options.scales.x.grid.color = colors.border;
        charts.trend.options.scales.x.ticks.color = colors.muted;
        charts.trend.options.scales.y.grid.color = colors.border;
        charts.trend.options.scales.y.ticks.color = colors.muted;
        charts.trend.update();
    }

    document.addEventListener("DOMContentLoaded", function () {
        initCounters();

        var data = getData();
        if (!data || !window.Chart) return;

        Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
        initTrendChart(data, palette());
    });

    document.addEventListener("themechange", updateChartColors);
})();
