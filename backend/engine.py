from models import ExtractedInfo, QualificationResult

def evaluate_qualification(extracted: ExtractedInfo) -> QualificationResult:
    # Qualification is purely deterministic based on boolean flags extracted by LLM
    
    # HOT: Meets all criteria (location + budget + timeline + intent)
    # WARM: Meets location and interest, but maybe missing timeline/budget strict alignment or some info missing
    # COLD: Explicit mismatch on budget or location

    if extracted.location_fit == False or extracted.budget_fit == False:
        status = "COLD"
        qualified = False
        reasons = []
        if extracted.location_fit == False:
            reasons.append("Uncomfortable with Nandi Hills location")
        if extracted.budget_fit == False:
            reasons.append("Budget below ₹92.4 lakh")
        reason = ", ".join(reasons)
    elif extracted.location_fit == True and extracted.budget_fit == True and extracted.timeline_fit == True and extracted.intent:
        status = "HOT"
        qualified = True
        reason = "Lead meets all criteria: location, budget (>= ₹92.4 lakh), timeline (Dec 2029), and intent known."
    else:
        status = "WARM"
        qualified = True
        reason = "Lead is interested and location/budget are not negative, but some criteria (like timeline or exact intent) are still pending or slightly misaligned."
        
    return QualificationResult(qualified=qualified, status=status, reason=reason)
