from flask import Blueprint, current_app, jsonify, request, url_for
from flask_login import login_required, login_user, logout_user
from werkzeug.datastructures import MultiDict

from app.forms import LoginForm, RegisterForm
from app.models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def _formdata():
    """Accept both JSON and form-encoded bodies from modal forms."""
    json_body = request.get_json(silent=True)
    if json_body:
        return MultiDict(json_body)
    return request.form


@auth_bp.route("/register", methods=["POST"])
def register():
    db_path = current_app.config["DATABASE_PATH"]
    form = RegisterForm(formdata=_formdata(), meta={"csrf": False})

    if not form.validate():
        return jsonify({"success": False, "errors": form.errors}), 400

    if User.get_by_email(db_path, form.email.data):
        return jsonify({"success": False, "errors": {"email": ["Email already registered."]}}), 409

    user = User.create(db_path, form.fullname.data, form.email.data, form.password.data)
    login_user(user)
    return jsonify({
        "success": True,
        "user": {"id": user.id, "fullname": user.fullname, "email": user.email},
        "redirect": url_for("dashboard.index"),
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    db_path = current_app.config["DATABASE_PATH"]
    form = LoginForm(formdata=_formdata(), meta={"csrf": False})

    if not form.validate():
        return jsonify({"success": False, "errors": form.errors}), 400

    user = User.get_by_email(db_path, form.email.data)
    if user is None or not user.check_password(form.password.data):
        return jsonify({"success": False, "errors": {"email": ["Invalid email or password."]}}), 401

    login_user(user, remember=form.remember.data)
    return jsonify({
        "success": True,
        "user": {"id": user.id, "fullname": user.fullname, "email": user.email},
        "redirect": url_for("dashboard.index"),
    }), 200


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"success": True}), 200
