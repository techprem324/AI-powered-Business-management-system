from functools import lru_cache

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

MODEL_VERSION = "northstar-retail-synthetic-v1"
FEATURE_NAMES = ["unit_margin", "discount_rate", "stock_units", "velocity_per_day", "lead_time_days", "seasonality", "category_index"]


def _training_data():
    rng = np.random.default_rng(41)
    count = 2400
    unit_margin = rng.uniform(0.4, 24, count)
    discount = rng.uniform(0, 0.35, count)
    stock = rng.integers(0, 420, count)
    velocity = rng.uniform(0.1, 28, count)
    lead_time = rng.integers(1, 30, count)
    seasonality = rng.uniform(0.65, 1.5, count)
    category = rng.integers(0, 7, count)
    features = np.column_stack([unit_margin, discount, stock, velocity, lead_time, seasonality, category])

    profit = (
        unit_margin * velocity * 7 * (1 - discount)
        + 13 * np.maximum(0, seasonality - 1) * velocity
        - 0.006 * stock * velocity
        + 0.13 * unit_margin * velocity * seasonality
        + (category % 3) * velocity * 0.7
        + rng.normal(0, 18, count)
    )
    reorder = velocity * lead_time * seasonality + 1.65 * np.sqrt(np.maximum(velocity * lead_time, 1))
    demand = velocity * 7 * seasonality + (category % 3) * velocity * 0.4 + discount * velocity * 3
    demand += rng.normal(0, 2.8, count)
    return features, profit, reorder, np.maximum(demand, 0)


def _score(model, features, target):
    predicted = model.predict(features)
    return {
        "rmse": round(float(np.sqrt(mean_squared_error(target, predicted))), 2),
        "mae": round(float(mean_absolute_error(target, predicted)), 2),
        "r2": round(float(r2_score(target, predicted)), 4),
    }


def _score_predictions(target, predicted):
    return {
        "rmse": round(float(np.sqrt(mean_squared_error(target, predicted))), 2),
        "mae": round(float(mean_absolute_error(target, predicted)), 2),
        "r2": round(float(r2_score(target, predicted)), 4),
    }


@lru_cache(maxsize=1)
def get_models():
    features, profit, reorder, demand = _training_data()
    x_train, x_test, y_train, y_test, reorder_train, reorder_test, demand_train, demand_test = train_test_split(
        features, profit, reorder, demand, test_size=0.2, random_state=41
    )
    candidates = {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(n_estimators=160, min_samples_leaf=2, random_state=41, n_jobs=-1),
        "Gradient Boosting": GradientBoostingRegressor(n_estimators=140, max_depth=2, learning_rate=0.06, random_state=41),
    }
    comparison = []
    for name, candidate in candidates.items():
        candidate.fit(x_train, y_train)
        comparison.append({"model": name, **_score(candidate, x_test, y_test)})

    profit_model = candidates["Random Forest"]
    demand_model = RandomForestRegressor(n_estimators=160, min_samples_leaf=3, max_features=0.9, random_state=29, n_jobs=-1)
    demand_model.fit(x_train, demand_train)
    demand_metrics = _score(demand_model, x_test, demand_test)
    demand_baseline_metrics = _score_predictions(demand_test, x_test[:, 3] * 7)
    reorder_model = RandomForestRegressor(n_estimators=120, min_samples_leaf=2, random_state=17, n_jobs=-1)
    reorder_model.fit(x_train, reorder_train)
    reorder_metrics = _score(reorder_model, x_test, reorder_test)
    baseline_profit = float(np.mean(y_test))
    feature_importance = [
        {"feature": name, "importance": round(float(weight), 4)}
        for name, weight in sorted(zip(FEATURE_NAMES, profit_model.feature_importances_), key=lambda item: item[1], reverse=True)
    ]
    return {
        "profit": profit_model,
        "demand": demand_model,
        "reorder": reorder_model,
        "comparison": comparison,
        "demand_comparison": [
            {"model": "7-day velocity baseline", **demand_baseline_metrics},
            {"model": "Random Forest", **demand_metrics},
        ],
        "reorder_metrics": reorder_metrics,
        "feature_importance": feature_importance,
        "profit_baseline_mean": round(baseline_profit, 2),
        "profit_holdout_rows": len(y_test),
        "demand_holdout_rows": len(demand_test),
        "reorder_holdout_rows": len(reorder_test),
        "data_source": "Deterministic synthetic retail training fixture",
        "model_version": MODEL_VERSION,
    }


def predict_product(*, unit_margin: float, discount_rate: float, stock_units: int, velocity_per_day: float,
                    lead_time_days: int, seasonality: float, category_index: int) -> dict:
    models = get_models()
    row = np.array([[unit_margin, discount_rate, stock_units, velocity_per_day, lead_time_days, seasonality, category_index]])
    profit = max(0.0, float(models["profit"].predict(row)[0]))
    demand_week = max(0.0, float(models["demand"].predict(row)[0]))
    reorder_point = max(1, int(round(float(models["reorder"].predict(row)[0]))))
    return {
        "predicted_profit": round(profit, 2),
        "predicted_demand_week": round(demand_week, 2),
        "predicted_reorder_point": reorder_point,
        "model_version": MODEL_VERSION,
    }


def evaluation_report() -> dict:
    models = get_models()
    return {
        "model_version": models["model_version"],
        "data_source": models["data_source"],
        "profit_holdout_rows": models["profit_holdout_rows"],
        "demand_holdout_rows": models["demand_holdout_rows"],
        "demand_comparison": models["demand_comparison"],
        "reorder_holdout_rows": models["reorder_holdout_rows"],
        "profit_comparison": models["comparison"],
        "reorder_metrics": models["reorder_metrics"],
        "feature_importance": models["feature_importance"],
        "caveat": "Metrics are from a synthetic generated fixture and are not evidence of real-world retail accuracy.",
    }
