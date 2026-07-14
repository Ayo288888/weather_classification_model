from flask_wtf import FlaskForm
from wtforms import BooleanField, PasswordField, StringField
from wtforms.validators import DataRequired, Email, EqualTo, Length


class RegisterForm(FlaskForm):
    fullname = StringField("fullname", validators=[DataRequired(), Length(min=2, max=100)])
    email = StringField("email", validators=[DataRequired(), Email()])
    password = PasswordField("password", validators=[DataRequired(), Length(min=8)])
    confirm_password = PasswordField(
        "confirm_password", validators=[DataRequired(), EqualTo("password")]
    )


class LoginForm(FlaskForm):
    email = StringField("email", validators=[DataRequired(), Email()])
    password = PasswordField("password", validators=[DataRequired()])
    remember = BooleanField("remember")


class ProfileForm(FlaskForm):
    fullname = StringField("fullname", validators=[DataRequired(), Length(min=2, max=100)])
    email = StringField("email", validators=[DataRequired(), Email()])


class ChangePasswordForm(FlaskForm):
    current_password = PasswordField("current_password", validators=[DataRequired()])
    new_password = PasswordField("new_password", validators=[DataRequired(), Length(min=8)])
    confirm_new_password = PasswordField(
        "confirm_new_password", validators=[DataRequired(), EqualTo("new_password")]
    )
