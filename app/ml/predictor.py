import json
import pickle
import threading
from pathlib import Path

import numpy as np
import pandas as pd

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "model.pkl"
MI_SCORES_PATH = ARTIFACT_DIR / "mi_scores.json"

_model = None
_model_lock = threading.Lock()

_mi_lookup = None
_mi_lookup_lock = threading.Lock()


def get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                with open(MODEL_PATH, "rb") as f:
                    _model = pickle.load(f)
    return _model


# Single source of truth for feature order: whatever the loaded model was
# actually fitted on, so predictor and model.pkl can never drift apart.
FEATURE_ORDER = list(get_model().feature_names_in_)


def get_mi_lookup() -> dict:
    """feature name -> {mi_score, rank} , rank 1 = most informative."""
    global _mi_lookup
    if _mi_lookup is None:
        with _mi_lookup_lock:
            if _mi_lookup is None:
                with open(MI_SCORES_PATH, encoding="utf-8") as f:
                    ranked = json.load(f)  # pre-sorted descending by mi_score
                _mi_lookup = {
                    entry["feature"]: {"mi_score": entry["mi_score"], "rank": i + 1}
                    for i, entry in enumerate(ranked)
                }
    return _mi_lookup


# Server-side plausibility bounds. Padded beyond the training data's observed
# min/max (see notebook describe() output) so legitimate extreme weather
# isn't rejected, while still catching garbage/mistyped input.
FEATURE_RANGES = {
    "Humidity3pm": (0, 100),
    "Humidity9am": (0, 100),
    "MinTemp": (-20, 55),
    "MaxTemp": (-10, 60),
    "Temp9am": (-20, 55),
    "Temp3pm": (-20, 55),
    "Pressure9am": (950, 1060),
    "Pressure3pm": (950, 1060),
    "WindGustSpeed": (0, 250),
    "WindSpeed3pm": (0, 200),
}


# UI metadata for the classification form. Each field is presented as a
# dropdown of discrete, physically plausible readings spaced by select_step
# across FEATURE_RANGES. Defaults are the training data's means (see
# notebook describe() output) so a first-time user sees a plausible day.
FEATURE_META = {
    "Humidity3pm": {"label": "Humidity (3pm)", "unit": "%", "select_step": 5, "default": 52, "icon": "icon_drop"},
    "Humidity9am": {"label": "Humidity (9am)", "unit": "%", "select_step": 5, "default": 69, "icon": "icon_drop"},
    "MinTemp": {"label": "Min Temperature", "unit": "°C", "select_step": 1, "default": 12, "icon": "icon_temperature"},
    "MaxTemp": {"label": "Max Temperature", "unit": "°C", "select_step": 1, "default": 23, "icon": "icon_temperature"},
    "Temp9am": {"label": "Temperature (9am)", "unit": "°C", "select_step": 1, "default": 17, "icon": "icon_temperature"},
    "Temp3pm": {"label": "Temperature (3pm)", "unit": "°C", "select_step": 1, "default": 22, "icon": "icon_temperature"},
    "Pressure9am": {"label": "Pressure (9am)", "unit": "hPa", "select_step": 1, "default": 1018, "icon": "icon_gauge"},
    "Pressure3pm": {"label": "Pressure (3pm)", "unit": "hPa", "select_step": 1, "default": 1015, "icon": "icon_gauge"},
    "WindGustSpeed": {"label": "Wind Gust Speed", "unit": "km/h", "select_step": 5, "default": 40, "icon": "icon_weather_squalls"},
    "WindSpeed3pm": {"label": "Wind Speed (3pm)", "unit": "km/h", "select_step": 5, "default": 19, "icon": "icon_weather_squalls"},
}


def build_select_options(name: str) -> list:
    """Discrete dropdown values for a feature: FEATURE_RANGES stepped by
    select_step, always including the exact default even if off-grid."""
    low, high = FEATURE_RANGES[name]
    step = FEATURE_META[name]["select_step"]
    default = FEATURE_META[name]["default"]

    values = set()
    value = low
    while value < high:
        values.add(value)
        value += step
    values.add(high)
    values.add(default)
    return sorted(values)


class PredictionValidationError(Exception):
    def __init__(self, errors: dict):
        self.errors = errors
        super().__init__("Invalid prediction inputs")


def validate_inputs(inputs: dict) -> dict:
    """Return a dict of field -> [error messages]. Empty dict means valid."""
    errors = {}
    for name in FEATURE_ORDER:
        raw = inputs.get(name)
        if raw is None or raw == "":
            errors[name] = ["This field is required."]
            continue
        try:
            value = float(raw)
        except (TypeError, ValueError):
            errors[name] = ["Must be a number."]
            continue
        low, high = FEATURE_RANGES[name]
        if not (low <= value <= high):
            errors[name] = [f"Must be between {low} and {high}."]
    return errors


def _log_gaussian(x, mean, var):
    return -0.5 * np.log(2 * np.pi * var) - ((x - mean) ** 2) / (2 * var)


def predict(inputs: dict) -> dict:
    """Run inference for a single sample.

    `inputs` must contain all keys in FEATURE_ORDER. Raises
    PredictionValidationError if any value is missing, non-numeric, or out
    of the plausible physical range. Returns the class label, per-class
    probabilities, and a per-feature breakdown (input value, MI score/rank,
    and Gaussian log-likelihood per class) so the UI can explain why the
    model decided what it decided.
    """
    errors = validate_inputs(inputs)
    if errors:
        raise PredictionValidationError(errors)

    model = get_model()
    mi_lookup = get_mi_lookup()

    features = {name: float(inputs[name]) for name in FEATURE_ORDER}
    row = pd.DataFrame([features])[FEATURE_ORDER]

    prediction = int(model.predict(row)[0])
    proba = model.predict_proba(row)[0]

    x = row.to_numpy()[0]
    log_no_rain = _log_gaussian(x, model.theta_[0], model.var_[0])
    log_rain = _log_gaussian(x, model.theta_[1], model.var_[1])
    contribution = log_rain - log_no_rain

    breakdown = [
        {
            "feature": name,
            "value": float(x[i]),
            "mi_score": mi_lookup[name]["mi_score"],
            "mi_rank": mi_lookup[name]["rank"],
            "log_likelihood_no_rain": float(log_no_rain[i]),
            "log_likelihood_rain": float(log_rain[i]),
            "contribution": float(contribution[i]),
            "direction": "rain" if contribution[i] > 0 else "no_rain",
        }
        for i, name in enumerate(FEATURE_ORDER)
    ]
    breakdown.sort(key=lambda d: abs(d["contribution"]), reverse=True)

    return {
        "prediction": prediction,
        "label": "Rain Tomorrow" if prediction == 1 else "No Rain Tomorrow",
        "probability_no_rain": float(proba[0]),
        "probability_rain": float(proba[1]),
        "confidence": float(max(proba)) * 100,
        "feature_breakdown": breakdown,
    }
