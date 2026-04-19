"""Testes da preparação de dataset — não treinam modelo (rápido, sem GPU).

Cobre ``prepare_dataset`` e ``_precision_at_k`` do ``src/train.py``.
Treino de XGBoost fica em eval manual via ``python -m src.train``.
"""

import numpy as np
import pandas as pd
import pytest

from src.train import EXCLUDE_COLS, _precision_at_k, prepare_dataset


@pytest.fixture
def fake_mart(tmp_path):
    """Mart sintético com schema completo e tamanho suficiente pra estratificar."""
    n = 200
    rng = np.random.default_rng(42)
    df = pd.DataFrame({
        "applicant_id":          np.arange(n),
        "defaulted":             rng.choice([0, 1], size=n, p=[0.93, 0.07]),
        "age":                   rng.integers(18, 80, size=n),
        "monthly_income":        rng.normal(5000, 2000, size=n).clip(500, None),
        "revolving_utilization": rng.uniform(0, 1, size=n),
        "debt_ratio":            rng.uniform(0, 2, size=n),
        "open_credit_lines":     rng.integers(0, 20, size=n),
        "dependents":            rng.integers(0, 5, size=n),
        "income_missing":        rng.choice([0, 1], size=n, p=[0.8, 0.2]),
        "late_30_59_days":       rng.integers(0, 5, size=n),
        "late_60_89_days":       rng.integers(0, 3, size=n),
        "late_90_days":          rng.integers(0, 3, size=n),
        "total_late_payments":   rng.integers(0, 10, size=n),
        "has_90day_default":     rng.choice([0, 1], size=n, p=[0.9, 0.1]),
        "risk_tier":             rng.choice(["LOW", "MEDIUM", "HIGH"], size=n),
        "loaded_at":             pd.Timestamp("2026-01-01"),
    })
    path = tmp_path / "mart.parquet"
    df.to_parquet(path)
    return str(path)


def test_prepare_dataset_excludes_leakage_cols(fake_mart):
    X_train, X_test, y_train, y_test, df_test_meta = prepare_dataset(fake_mart)
    for col in EXCLUDE_COLS:
        assert col not in X_train.columns, f"{col} deveria estar excluído de X"


def test_prepare_dataset_split_is_stratified(fake_mart):
    """y_train e y_test devem ter pos_rate próximo — estratificação funcionando."""
    _, _, y_train, y_test, _ = prepare_dataset(fake_mart)
    delta = abs(y_train.mean() - y_test.mean())
    assert delta < 0.02, f"pos_rate delta {delta:.4f} > 0.02 — estratificação falhou"


def test_prepare_dataset_reproducible(fake_mart):
    """Mesmo random_state → mesmas linhas no test set."""
    _, X1, _, _, _ = prepare_dataset(fake_mart, random_state=42)
    _, X2, _, _, _ = prepare_dataset(fake_mart, random_state=42)
    assert X1.index.equals(X2.index)


def test_prepare_dataset_test_meta_aligned(fake_mart):
    """df_test_meta deve ter as mesmas linhas de X_test, mas com colunas extras."""
    _, X_test, _, _, df_test_meta = prepare_dataset(fake_mart)
    assert len(df_test_meta) == len(X_test)
    assert df_test_meta.index.equals(X_test.index)
    # df_test_meta inclui colunas excluídas
    assert "risk_tier" in df_test_meta.columns


def test_precision_at_k_perfect_ranking():
    """Score que ordena perfeitamente (todos positivos no topo) → precision = 1.0 em k <= pos_count."""
    y = pd.Series([1, 1, 0, 0, 0, 0, 0, 0, 0, 0])
    scores = np.array([10, 9, 1, 1, 1, 1, 1, 1, 1, 1])
    assert _precision_at_k(y, scores, 0.2) == 1.0  # top 2 → ambos positivos


def test_precision_at_k_random_ranking_close_to_pos_rate():
    """Score aleatório → precision@k ≈ pos_rate."""
    rng = np.random.default_rng(0)
    n = 1000
    y = pd.Series(rng.choice([0, 1], size=n, p=[0.9, 0.1]))
    scores = rng.random(n)
    pct_20 = _precision_at_k(y, scores, 0.2)
    # Em random, precision@20 deve ficar próximo de 0.1 (pos_rate)
    assert 0.05 < pct_20 < 0.15
