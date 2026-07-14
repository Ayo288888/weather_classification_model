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
            warning: cssVar("--color-warning"),
            danger: cssVar("--color-danger"),
            muted: cssVar("--color-muted"),
            text: cssVar("--color-text"),
            border: cssVar("--color-border"),
            surface: cssVar("--color-surface"),
        };
    }

    function getData() {
        var el = document.getElementById("analytics-data");
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

    /* Draws a bold number + small caption in the hole of a doughnut/pie chart. */
    var centerTextPlugin = {
        id: "centerText",
        afterDraw: function (chart) {
            var opts = chart.config.options.plugins && chart.config.options.plugins.centerText;
            if (!opts || !opts.text) return;
            var ctx = chart.ctx;
            var width = chart.width;
            var height = chart.height;
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "800 " + (opts.fontSize || 24) + "px 'Inter', 'Segoe UI', sans-serif";
            ctx.fillStyle = opts.color || "#1E1B39";
            ctx.fillText(opts.text, width / 2, height / 2 - (opts.subtext ? 11 : 0));
            if (opts.subtext) {
                ctx.font = "600 12px 'Inter', 'Segoe UI', sans-serif";
                ctx.fillStyle = opts.subColor || "#8181A5";
                ctx.fillText(opts.subtext, width / 2, height / 2 + 14);
            }
            ctx.restore();
        },
    };

    function initOutcomesPie(data, colors) {
        var canvas = document.getElementById("chart-outcomes-pie");
        if (!canvas || !window.Chart) return;
        var m = data.confusion_matrix.matrix;
        var tn = m[0][0], fp = m[0][1], fn = m[1][0], tp = m[1][1];

        charts.outcomesPie = new Chart(canvas, {
            type: "pie",
            plugins: [centerTextPlugin],
            data: {
                labels: ["True Negative", "False Positive", "False Negative", "True Positive"],
                datasets: [{
                    data: [tn, fp, fn, tp],
                    backgroundColor: [colors.success, colors.danger, colors.warning, colors.primary],
                    borderColor: colors.surface,
                    borderWidth: 2,
                    hoverOffset: 10,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { animateRotate: true, animateScale: true, duration: 1100, easing: "easeOutQuart" },
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: colors.text, usePointStyle: true, padding: 14, font: { size: 11 } },
                    },
                    centerText: {
                        text: (data.accuracy * 100).toFixed(1) + "%",
                        subtext: "Accuracy",
                        color: colors.text,
                        subColor: colors.muted,
                    },
                },
            },
        });
    }

    function initSupportDonut(data, colors) {
        var canvas = document.getElementById("chart-support-donut");
        if (!canvas || !window.Chart) return;

        charts.supportDonut = new Chart(canvas, {
            type: "doughnut",
            plugins: [centerTextPlugin],
            data: {
                labels: ["No Rain", "Rain"],
                datasets: [{
                    data: [data.support.no_rain, data.support.rain],
                    backgroundColor: [colors.success, colors.primary],
                    borderColor: colors.surface,
                    borderWidth: 2,
                    hoverOffset: 10,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                animation: { animateRotate: true, animateScale: true, duration: 1100, easing: "easeOutQuart" },
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: colors.text, usePointStyle: true, padding: 14 },
                    },
                    centerText: {
                        text: data.test_set_size.toLocaleString(),
                        subtext: "Test Samples",
                        color: colors.text,
                        subColor: colors.muted,
                    },
                },
            },
        });
    }

    function initRocLine(data, colors) {
        var canvas = document.getElementById("chart-roc");
        if (!canvas || !window.Chart) return;
        var ctx = canvas.getContext("2d");
        var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
        gradient.addColorStop(0, colors.primary + "55");
        gradient.addColorStop(1, colors.primary + "05");

        var points = data.roc_curve.fpr.map(function (fpr, i) {
            return { x: fpr, y: data.roc_curve.tpr[i] };
        });

        charts.roc = new Chart(canvas, {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Model ROC",
                        data: points,
                        borderColor: colors.primary,
                        backgroundColor: gradient,
                        fill: true,
                        tension: .25,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        pointBackgroundColor: colors.primary,
                        borderWidth: 2.5,
                    },
                    {
                        label: "Random Chance",
                        data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                        borderColor: colors.muted,
                        borderDash: [6, 6],
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1200, easing: "easeOutQuart" },
                parsing: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: colors.text, usePointStyle: true, padding: 14 },
                    },
                },
                scales: {
                    x: {
                        type: "linear",
                        min: 0,
                        max: 1,
                        title: { display: true, text: "False Positive Rate", color: colors.muted },
                        ticks: { color: colors.muted },
                        grid: { color: colors.border },
                    },
                    y: {
                        min: 0,
                        max: 1,
                        title: { display: true, text: "True Positive Rate", color: colors.muted },
                        ticks: { color: colors.muted },
                        grid: { color: colors.border },
                    },
                },
            },
        });
    }

    function initMiBar(data, colors) {
        var canvas = document.getElementById("chart-mi-full");
        if (!canvas || !window.Chart) return;

        charts.miBar = new Chart(canvas, {
            type: "bar",
            data: {
                labels: data.mi_scores.map(function (m) { return m.feature; }),
                datasets: [{
                    label: "MI Score",
                    data: data.mi_scores.map(function (m) { return m.mi_score; }),
                    backgroundColor: data.mi_scores.map(function (m) {
                        return m.selected ? colors.primary : colors.border;
                    }),
                    borderRadius: 6,
                    maxBarThickness: 22,
                }],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1200, easing: "easeOutQuart" },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            afterLabel: function (item) {
                                return data.mi_scores[item.dataIndex].selected
                                    ? "Selected for training"
                                    : "Not selected";
                            },
                        },
                    },
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: colors.border }, ticks: { color: colors.muted } },
                    y: { grid: { display: false }, ticks: { color: colors.muted, font: { size: 11 } } },
                },
            },
        });
    }

    function updateChartColors() {
        if (!window.Chart) return;
        var colors = palette();

        if (charts.outcomesPie) {
            charts.outcomesPie.data.datasets[0].backgroundColor = [colors.success, colors.danger, colors.warning, colors.primary];
            charts.outcomesPie.data.datasets[0].borderColor = colors.surface;
            charts.outcomesPie.options.plugins.legend.labels.color = colors.text;
            charts.outcomesPie.options.plugins.centerText.color = colors.text;
            charts.outcomesPie.options.plugins.centerText.subColor = colors.muted;
            charts.outcomesPie.update();
        }
        if (charts.supportDonut) {
            charts.supportDonut.data.datasets[0].backgroundColor = [colors.success, colors.primary];
            charts.supportDonut.data.datasets[0].borderColor = colors.surface;
            charts.supportDonut.options.plugins.legend.labels.color = colors.text;
            charts.supportDonut.options.plugins.centerText.color = colors.text;
            charts.supportDonut.options.plugins.centerText.subColor = colors.muted;
            charts.supportDonut.update();
        }
        if (charts.roc) {
            var datasets = charts.roc.data.datasets;
            datasets[0].borderColor = colors.primary;
            datasets[0].pointBackgroundColor = colors.primary;
            datasets[1].borderColor = colors.muted;
            charts.roc.options.plugins.legend.labels.color = colors.text;
            charts.roc.options.scales.x.grid.color = colors.border;
            charts.roc.options.scales.x.ticks.color = colors.muted;
            charts.roc.options.scales.x.title.color = colors.muted;
            charts.roc.options.scales.y.grid.color = colors.border;
            charts.roc.options.scales.y.ticks.color = colors.muted;
            charts.roc.options.scales.y.title.color = colors.muted;
            charts.roc.update();
        }
        if (charts.miBar) {
            var data = getData();
            if (data) {
                charts.miBar.data.datasets[0].backgroundColor = data.mi_scores.map(function (m) {
                    return m.selected ? colors.primary : colors.border;
                });
            }
            charts.miBar.options.scales.x.grid.color = colors.border;
            charts.miBar.options.scales.x.ticks.color = colors.muted;
            charts.miBar.options.scales.y.ticks.color = colors.muted;
            charts.miBar.update();
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        initCounters();

        var data = getData();
        if (!data || !window.Chart) return;

        Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
        var colors = palette();
        initOutcomesPie(data, colors);
        initSupportDonut(data, colors);
        initRocLine(data, colors);
        initMiBar(data, colors);
    });

    document.addEventListener("themechange", updateChartColors);
})();
