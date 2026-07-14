import sqlite3

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash


def get_db_connection(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path):
    conn = get_db_connection(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            humidity_3pm REAL NOT NULL,
            humidity_9am REAL NOT NULL,
            min_temp REAL NOT NULL,
            temp_3pm REAL NOT NULL,
            temp_9am REAL NOT NULL,
            pressure_9am REAL NOT NULL,
            max_temp REAL NOT NULL,
            pressure_3pm REAL NOT NULL,
            wind_gust_speed REAL NOT NULL,
            wind_speed_3pm REAL NOT NULL,
            predicted_class INTEGER NOT NULL,
            confidence REAL NOT NULL,
            rain_probability REAL NOT NULL,
            no_rain_probability REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        """
    )
    conn.commit()
    conn.close()


class User(UserMixin):
    def __init__(self, id, fullname, email, password_hash):
        self.id = str(id)
        self.fullname = fullname
        self.email = email
        self.password_hash = password_hash

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @staticmethod
    def _from_row(row):
        if row is None:
            return None
        return User(row["id"], row["fullname"], row["email"], row["password_hash"])

    @staticmethod
    def create(db_path, fullname, email, password):
        conn = get_db_connection(db_path)
        password_hash = generate_password_hash(password)
        cur = conn.execute(
            "INSERT INTO users (fullname, email, password_hash) VALUES (?, ?, ?)",
            (fullname, email, password_hash),
        )
        conn.commit()
        user_id = cur.lastrowid
        conn.close()
        return User(user_id, fullname, email, password_hash)

    @staticmethod
    def get_by_id(db_path, user_id):
        conn = get_db_connection(db_path)
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return User._from_row(row)

    @staticmethod
    def get_by_email(db_path, email):
        conn = get_db_connection(db_path)
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        conn.close()
        return User._from_row(row)

    @staticmethod
    def update_details(db_path, user_id, fullname, email):
        conn = get_db_connection(db_path)
        conn.execute(
            "UPDATE users SET fullname = ?, email = ? WHERE id = ?",
            (fullname, email, user_id),
        )
        conn.commit()
        conn.close()

    @staticmethod
    def update_password(db_path, user_id, new_password):
        conn = get_db_connection(db_path)
        password_hash = generate_password_hash(new_password)
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (password_hash, user_id),
        )
        conn.commit()
        conn.close()
