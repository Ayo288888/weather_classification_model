import json

from flask import Blueprint, render_template

from app.ml.predictor import ARTIFACT_DIR

main_bp = Blueprint("main", __name__)


def _load_json(name):
    with open(ARTIFACT_DIR / name, encoding="utf-8") as f:
        return json.load(f)


@main_bp.route("/")
def index():
    metrics = _load_json("metrics.json")
    return render_template("index.html", metrics=metrics)
