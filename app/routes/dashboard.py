import json
import math
from collections import Counter
from datetime import datetime

from flask import Blueprint, current_app, jsonify, render_template, request
from flask_login import current_user, login_required
from werkzeug.datastructures import MultiDict

from app.forms import ChangePasswordForm, ProfileForm
from app.ml.predictor import (
    ARTIFACT_DIR,
    FEATURE_META,
    FEATURE_ORDER,
    FEATURE_RANGES,
    PredictionValidationError,
    build_select_options,
    predict,
)
from app.models import User, get_db_connection

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/dashboard")


def _formdata():
    """Accept both JSON and form-encoded bodies from dashboard forms."""
    json_body = request.get_json(silent=True)
    if json_body:
        return MultiDict(json_body)
    return request.form

_DB_COLUMN_BY_FEATURE = {
    "Humidity3pm": "humidity_3pm",
    "Humidity9am": "humidity_9am",
    "MinTemp": "min_temp",
    "Temp3pm": "temp_3pm",
    "Temp9am": "temp_9am",
    "Pressure9am": "pressure_9am",
    "MaxTemp": "max_temp",
    "Pressure3pm": "pressure_3pm",
    "WindGustSpeed": "wind_gust_speed",
    "WindSpeed3pm": "wind_speed_3pm",
}


def _daily_rain_split(history):
    """Rain vs no-rain prediction counts per day, sorted chronologically."""
    day_labels = Counter()
    day_rain = Counter()
    for row in history:
        day = row["created_at"][:10]
        day_labels[day] += 1
        if row["predicted_class"] == 1:
            day_rain[day] += 1
    days_sorted = sorted(day_labels)
    return [
        {"date": d, "rain": day_rain[d], "no_rain": day_labels[d] - day_rain[d]}
        for d in days_sorted
    ]


# ---------------------------------------------------------------------------
# Pages (GET, HTML) - the dashboard shell's sidebar destinations
# ---------------------------------------------------------------------------

@dashboard_bp.route("/")
@login_required
def index():
    db_path = current_app.config["DATABASE_PATH"]
    conn = get_db_connection(db_path)
    rows = conn.execute(
        "SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC",
        (current_user.id,),
    ).fetchall()
    conn.close()
    history = [dict(row) for row in rows]

    total = len(history)
    rain_count = sum(1 for r in history if r["predicted_class"] == 1)
    no_rain_count = total - rain_count
    avg_confidence = (sum(r["confidence"] for r in history) / total) if total else 0.0

    daily = _daily_rain_split(history)

    with open(ARTIFACT_DIR / "mi_scores.json", encoding="utf-8") as f:
        mi_scores = json.load(f)
    selected_mi = sorted(
        (entry for entry in mi_scores if entry["selected"]),
        key=lambda entry: entry["mi_score"],
        reverse=True,
    )
    top_features = [
        {
            "feature": entry["feature"],
            "mi_score": entry["mi_score"],
            "label": FEATURE_META.get(entry["feature"], {}).get("label", entry["feature"]),
            "icon": FEATURE_META.get(entry["feature"], {}).get("icon", "icon_data_scatter"),
            "unit": FEATURE_META.get(entry["feature"], {}).get("unit", ""),
        }
        for entry in selected_mi[:3]
    ]

    snapshot = {
        "avg_humidity_3pm": round(sum(r["humidity_3pm"] for r in history) / total, 1) if total else 0.0,
        "avg_pressure_9am": round(sum(r["pressure_9am"] for r in history) / total, 1) if total else 0.0,
        "avg_max_temp": round(sum(r["max_temp"] for r in history) / total, 1) if total else 0.0,
        "avg_wind_gust": round(sum(r["wind_gust_speed"] for r in history) / total, 1) if total else 0.0,
    }

    recent = []
    for row in history[:5]:
        created_at = datetime.strptime(row["created_at"], "%Y-%m-%d %H:%M:%S")
        recent.append({
            "created_at_display": created_at.strftime("%b %d, %Y %I:%M %p"),
            "label": "Rain" if row["predicted_class"] == 1 else "No Rain",
            "confidence": round(row["confidence"], 1),
            "humidity_3pm": round(row["humidity_3pm"], 1),
            "pressure_9am": round(row["pressure_9am"], 1),
        })

    overview = {
        "total": total,
        "rain_count": rain_count,
        "no_rain_count": no_rain_count,
        "rain_pct": round((rain_count / total) * 100, 1) if total else 0.0,
        "no_rain_pct": round((no_rain_count / total) * 100, 1) if total else 0.0,
        "avg_confidence": round(avg_confidence, 2),
        "daily": daily,
        "top_features": top_features,
        "snapshot": snapshot,
        "recent": recent,
    }

    return render_template("dashboard/index.html", overview=overview)


@dashboard_bp.route("/classify")
@login_required
def classify_page():
    fields = []
    for name in FEATURE_ORDER:
        meta = FEATURE_META[name]
        low, high = FEATURE_RANGES[name]
        fields.append({
            "name": name,
            "min": low,
            "max": high,
            "options": build_select_options(name),
            **meta,
        })
    return render_template("dashboard/classify.html", fields=fields)


_HISTORY_PAGE_SIZE = 15


@dashboard_bp.route("/history")
@login_required
def history_page():
    db_path = current_app.config["DATABASE_PATH"]
    conn = get_db_connection(db_path)

    total = conn.execute(
        "SELECT COUNT(*) FROM predictions WHERE user_id = ?", (current_user.id,)
    ).fetchone()[0]

    total_pages = max(1, math.ceil(total / _HISTORY_PAGE_SIZE))
    page = min(max(request.args.get("page", 1, type=int) or 1, 1), total_pages)
    offset = (page - 1) * _HISTORY_PAGE_SIZE

    rows = conn.execute(
        "SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (current_user.id, _HISTORY_PAGE_SIZE, offset),
    ).fetchall()
    conn.close()

    table_rows = []
    for row in rows:
        created_at = datetime.strptime(row["created_at"], "%Y-%m-%d %H:%M:%S")
        table_rows.append({
            "created_at_display": created_at.strftime("%b %d, %Y %I:%M %p"),
            "label": "Rain" if row["predicted_class"] == 1 else "No Rain",
            "confidence": round(row["confidence"], 1),
            "humidity_3pm": round(row["humidity_3pm"], 1),
            "pressure_9am": round(row["pressure_9am"], 1),
            "temp_3pm": round(row["temp_3pm"], 1),
            "wind_gust_speed": round(row["wind_gust_speed"], 1),
        })

    pagination = {
        "page": page,
        "total_pages": total_pages,
        "total": total,
        "has_prev": page > 1,
        "has_next": page < total_pages,
    }

    return render_template("dashboard/history.html", table_rows=table_rows, pagination=pagination)


def _downsample(fpr, tpr, target_points=100):
    """The raw ROC curve has one point per unique predicted probability
    (thousands, from the test set) - far more than a chart needs. Keep a
    smooth ~100-point curve, always including the first and last points."""
    n = len(fpr)
    if n <= target_points:
        return fpr, tpr
    step = n / target_points
    indices = sorted({int(i * step) for i in range(target_points)} | {0, n - 1})
    return [fpr[i] for i in indices], [tpr[i] for i in indices]


@dashboard_bp.route("/analytics")
@login_required
def analytics_page():
    with open(ARTIFACT_DIR / "mi_scores.json", encoding="utf-8") as f:
        mi_scores = json.load(f)
    with open(ARTIFACT_DIR / "metrics.json", encoding="utf-8") as f:
        metrics = json.load(f)

    ranked_mi = sorted(mi_scores, key=lambda entry: entry["mi_score"], reverse=True)
    roc_fpr, roc_tpr = _downsample(metrics["roc_curve"]["fpr"], metrics["roc_curve"]["tpr"])

    analytics_data = {
        "accuracy": metrics["accuracy"],
        "precision": metrics["precision"],
        "recall": metrics["recall"],
        "f1_score": metrics["f1_score"],
        "auc_roc": metrics["auc_roc"],
        "confusion_matrix": metrics["confusion_matrix"],
        "roc_curve": {"fpr": roc_fpr, "tpr": roc_tpr},
        "support": metrics["support"],
        "test_set_size": metrics["test_set_size"],
        "mi_scores": ranked_mi,
    }

    return render_template("dashboard/analytics.html", analytics_data=analytics_data, metrics=metrics)


@dashboard_bp.route("/profile")
@login_required
def profile():
    return render_template("dashboard/profile.html")


@dashboard_bp.route("/profile", methods=["POST"])
@login_required
def update_profile():
    db_path = current_app.config["DATABASE_PATH"]
    form = ProfileForm(formdata=_formdata(), meta={"csrf": False})

    if not form.validate():
        return jsonify({"success": False, "errors": form.errors}), 400

    existing = User.get_by_email(db_path, form.email.data)
    if existing is not None and existing.id != current_user.id:
        return jsonify({"success": False, "errors": {"email": ["Email already registered."]}}), 409

    User.update_details(db_path, current_user.id, form.fullname.data, form.email.data)
    return jsonify({
        "success": True,
        "user": {"fullname": form.fullname.data, "email": form.email.data},
    }), 200


@dashboard_bp.route("/profile/password", methods=["POST"])
@login_required
def update_password():
    db_path = current_app.config["DATABASE_PATH"]
    form = ChangePasswordForm(formdata=_formdata(), meta={"csrf": False})

    if not form.validate():
        return jsonify({"success": False, "errors": form.errors}), 400

    if not current_user.check_password(form.current_password.data):
        return jsonify({
            "success": False,
            "errors": {"current_password": ["Current password is incorrect."]},
        }), 401

    User.update_password(db_path, current_user.id, form.new_password.data)
    return jsonify({"success": True}), 200


# ---------------------------------------------------------------------------
# API (JSON) - called via fetch from the pages above
# ---------------------------------------------------------------------------

@dashboard_bp.route("/classify", methods=["POST"])
@login_required
def classify():
    payload = request.get_json(silent=True) or {}

    try:
        result = predict(payload)
    except PredictionValidationError as exc:
        return jsonify({"success": False, "errors": exc.errors}), 400

    features = {name: float(payload[name]) for name in FEATURE_ORDER}

    db_path = current_app.config["DATABASE_PATH"]
    conn = get_db_connection(db_path)
    columns = [_DB_COLUMN_BY_FEATURE[name] for name in FEATURE_ORDER]
    values = [features[name] for name in FEATURE_ORDER]
    conn.execute(
        f"""
        INSERT INTO predictions
            (user_id, {", ".join(columns)}, predicted_class, confidence, rain_probability, no_rain_probability)
        VALUES (?, {", ".join(["?"] * len(columns))}, ?, ?, ?, ?)
        """,
        (
            current_user.id,
            *values,
            result["prediction"],
            result["confidence"],
            result["probability_rain"],
            result["probability_no_rain"],
        ),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "result": result}), 200


@dashboard_bp.route("/api/history")
@login_required
def history_api():
    db_path = current_app.config["DATABASE_PATH"]
    conn = get_db_connection(db_path)
    rows = conn.execute(
        "SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC",
        (current_user.id,),
    ).fetchall()
    conn.close()
    return jsonify({"success": True, "history": [dict(row) for row in rows]}), 200


@dashboard_bp.route("/api/analytics")
@login_required
def analytics_api():
    mi_scores_path = ARTIFACT_DIR / "mi_scores.json"
    metrics_path = ARTIFACT_DIR / "metrics.json"

    with open(mi_scores_path, encoding="utf-8") as f:
        mi_scores = json.load(f)
    with open(metrics_path, encoding="utf-8") as f:
        metrics = json.load(f)

    return jsonify({"success": True, "mi_scores": mi_scores, "metrics": metrics}), 200
