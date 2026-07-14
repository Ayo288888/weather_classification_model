# Render Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the RainSense Flask application on Render with ephemeral SQLite storage.

**Architecture:** Use Render's native Python buildpack. Add `gunicorn` as the production WSGI server, and configure the Render Web Service via a `render.yaml` blueprint file in the root.

**Tech Stack:** Python 3.12, Flask, Gunicorn, Render.

## Global Constraints
- Deploy platform: Render
- Python version: 3.12.3
- WSGI server: Gunicorn

---

### Task 1: Add Gunicorn to requirements.txt

**Files:**
- Modify: `requirements.txt`

**Interfaces:**
- Produces: `gunicorn` package requirement.

- [ ] **Step 1: Modify `requirements.txt`**

  Open `requirements.txt` and append `gunicorn` as a new line. The modified file content must be:
  ```
  flask
  flask-login
  flask-wtf
  werkzeug
  scikit-learn==1.6.1
  imbalanced-learn
  pandas
  numpy
  joblib
  python-dotenv
  email-validator
  gunicorn
  ```

- [ ] **Step 2: Commit changes**

  Run commands:
  ```bash
  git add requirements.txt
  git commit -m "chore: add gunicorn to requirements.txt for Render deployment"
  ```

---

### Task 2: Create render.yaml

**Files:**
- Create: `render.yaml`

- [ ] **Step 1: Create `render.yaml` blueprint**

  Create `render.yaml` in the project root directory with the following content:
  ```yaml
  services:
    - type: web
      name: rain-sense
      env: python
      buildCommand: pip install -r requirements.txt
      startCommand: gunicorn run:app
      envVars:
        - key: PYTHON_VERSION
          value: 3.12.3
        - key: SECRET_KEY
          generateValue: true
        - key: DATABASE_PATH
          value: ./weather.db
  ```

- [ ] **Step 2: Commit changes**

  Run commands:
  ```bash
  git add render.yaml
  git commit -m "feat: add render.yaml blueprint configuration"
  ```
