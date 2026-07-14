import pickle
import warnings

import numpy as np
import sklearn

print("Installed scikit-learn version:", sklearn.__version__)

with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter("always")
    with open("weather_forecasting_nb_model.pkl", "rb") as f:
        model = pickle.load(f)
    if caught:
        print(f"\n{len(caught)} warning(s) raised while loading the model:")
        for w in caught:
            print(f"  - [{w.category.__name__}] {w.message}")
    else:
        print("\nNo warnings raised while loading the model.")

print("\nModel type:", type(model))
print("feature_names_in_:", list(model.feature_names_in_))
print("classes_:", model.classes_)

sample = np.array([[50.0, 60.0, 12.0, 20.0, 16.0, 1015.0, 24.0, 1013.0, 35.0, 15.0]])
pred = model.predict(sample)
proba = model.predict_proba(sample)
print("\nSmoke prediction on dummy input:")
print("  predict:", pred)
print("  predict_proba:", proba)
print("\nSMOKE TEST PASSED")
