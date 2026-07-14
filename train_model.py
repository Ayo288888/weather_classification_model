"""
Reproduces the training pipeline from
DEVELOPMENT_OF_WEATHER_FORECASTING_SYSTEM_USING_MUTUAL_INFORMATION_FEATURE_SELECTION.ipynb
and writes the deployment artifacts consumed by app/ml/predictor.py.

Usage:
    python train_model.py [--data-path PATH]
"""
import argparse
import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.feature_selection import mutual_info_classif
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import LabelEncoder

THIS_DIR = Path(__file__).parent
DEFAULT_DATA_PATH = THIS_DIR.parent / "weatherAUS.csv"
ARTIFACT_DIR = THIS_DIR / "app" / "ml" / "artifacts"


def load_and_preprocess(data_path: Path) -> pd.DataFrame:
    df = pd.read_csv(data_path)

    df = df.dropna(subset=["RainTomorrow"])

    num_cols = df.select_dtypes(include=np.number).columns
    for col in num_cols:
        df[col] = df[col].fillna(df[col].median())

    cat_cols = df.select_dtypes(include=["object", "string"]).columns
    for col in cat_cols:
        df[col] = df[col].fillna(df[col].mode()[0])

    df = df.drop_duplicates()

    df["Date"] = pd.to_datetime(df["Date"])
    df["Year"] = df["Date"].dt.year
    df["Month"] = df["Date"].dt.month
    df["Day"] = df["Date"].dt.day
    df = df.drop("Date", axis=1)

    encoder = LabelEncoder()
    for col in df.select_dtypes(include=["object", "string"]).columns:
        df[col] = encoder.fit_transform(df[col])

    return df


def main(data_path: Path):
    print(f"Loading dataset from: {data_path}")
    df = load_and_preprocess(data_path)

    X = df.drop("RainTomorrow", axis=1)
    y = df["RainTomorrow"]

    smote = SMOTE(random_state=42)
    X_balanced, y_balanced = smote.fit_resample(X, y)

    mi_scores = mutual_info_classif(X_balanced, y_balanced, random_state=42)
    mi_df = pd.DataFrame({"Feature": X_balanced.columns, "MI Score": mi_scores})
    mi_df = mi_df.sort_values("MI Score", ascending=False).reset_index(drop=True)

    top_features = mi_df.head(10)["Feature"]
    X_selected = X[top_features]

    X_train, X_test, y_train, y_test = train_test_split(
        X_selected, y, test_size=0.2, random_state=42, stratify=y
    )

    nb_model = GaussianNB()
    nb_model.fit(X_train, y_train)

    y_pred = nb_model.predict(X_test)
    y_prob = nb_model.predict_proba(X_test)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred)
    fpr, tpr, thresholds = roc_curve(y_test, y_prob)

    print(f"Accuracy:  {accuracy:.6f}")
    print(f"Precision: {precision:.6f}")
    print(f"Recall:    {recall:.6f}")
    print(f"F1 Score:  {f1:.6f}")
    print(f"AUC ROC:   {auc:.6f}")
    print(f"Confusion Matrix:\n{cm}")
    print(f"Selected features (MI-ranked): {list(top_features)}")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    with open(ARTIFACT_DIR / "model.pkl", "wb") as f:
        pickle.dump(nb_model, f)

    mi_scores_out = [
        {"feature": row["Feature"], "mi_score": float(row["MI Score"]), "selected": row["Feature"] in set(top_features)}
        for _, row in mi_df.iterrows()
    ]
    with open(ARTIFACT_DIR / "mi_scores.json", "w", encoding="utf-8") as f:
        json.dump(mi_scores_out, f, indent=2)

    metrics_out = {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "auc_roc": float(auc),
        "confusion_matrix": {
            "labels": ["No Rain", "Rain"],
            "matrix": cm.tolist(),
        },
        "roc_curve": {
            "fpr": fpr.tolist(),
            "tpr": tpr.tolist(),
            "thresholds": thresholds.tolist(),
        },
        "class_priors": {"no_rain": float(nb_model.class_prior_[0]), "rain": float(nb_model.class_prior_[1])},
        "test_set_size": int(len(y_test)),
        "support": {"no_rain": int((y_test == 0).sum()), "rain": int((y_test == 1).sum())},
        "selected_features": list(top_features),
    }
    with open(ARTIFACT_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics_out, f, indent=2)

    print(f"\nArtifacts written to: {ARTIFACT_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-path", type=Path, default=DEFAULT_DATA_PATH)
    args = parser.parse_args()
    main(args.data_path)
