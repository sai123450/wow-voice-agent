import pytest
from engine import evaluate_qualification
from models import ExtractedInfo

def test_qualification_qualified():
    # 1. ₹1.5 Cr + Nandi Hills + Dec 2029
    extracted = ExtractedInfo(location_fit=True, budget_fit=True, timeline_fit=True)
    res = evaluate_qualification(extracted)
    assert res.qualified == True

def test_qualification_low_budget():
    # 2. ₹50 Lakh + Nandi Hills + Dec 2029
    extracted = ExtractedInfo(location_fit=True, budget_fit=False, timeline_fit=True)
    res = evaluate_qualification(extracted)
    assert res.qualified == False
    assert "Budget below" in res.reason

def test_qualification_bad_location():
    # 3. ₹1.5 Cr + unsuitable location + Dec 2029
    extracted = ExtractedInfo(location_fit=False, budget_fit=True, timeline_fit=True)
    res = evaluate_qualification(extracted)
    assert res.qualified == False
    assert "Uncomfortable with Nandi Hills" in res.reason

def test_qualification_bad_timeline():
    # 4. ₹1.5 Cr + Nandi Hills + incompatible timeline
    extracted = ExtractedInfo(location_fit=True, budget_fit=True, timeline_fit=False)
    res = evaluate_qualification(extracted)
    assert res.qualified == False
    assert "Timeline incompatible" in res.reason

def test_qualification_missing_info():
    extracted = ExtractedInfo(location_fit=True, budget_fit=None, timeline_fit=True)
    res = evaluate_qualification(extracted)
    assert res.qualified == False
    assert "Missing required information" in res.reason
