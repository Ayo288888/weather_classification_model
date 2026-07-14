from datetime import datetime

from flask import Flask
from flask_login import LoginManager

from config import Config

login_manager = LoginManager()
# auth.login is a JSON-only POST endpoint (no GET handler); send unauthenticated
# users to the landing page instead, where they can open the login modal.
login_manager.login_view = "main.index"


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    from app.models import init_db

    init_db(app.config["DATABASE_PATH"])

    login_manager.init_app(app)

    from app.routes.main import main_bp
    from app.routes.auth import auth_bp
    from app.routes.dashboard import dashboard_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)

    @login_manager.user_loader
    def load_user(user_id):
        from flask import current_app

        from app.models import User

        return User.get_by_id(current_app.config["DATABASE_PATH"], user_id)

    @app.context_processor
    def inject_current_year():
        return {"current_year": datetime.now().year}

    return app
