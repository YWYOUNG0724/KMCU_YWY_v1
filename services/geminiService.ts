import { UserPreferences, TripPlan, Activity } from "../types";

export const generateTripPlan = async (prefs: UserPreferences): Promise<TripPlan> => {
  const waypointContext = prefs.waypoint ? `- Layover / Waypoint: ${prefs.waypoint}` : '';
  const prompt = `
    Create a ${prefs.duration}-day trip itinerary starting from departure city "${prefs.departure}", ${prefs.waypoint ? `stopping at or passing through layover/waypoint "${prefs.waypoint}",` : ''} and spending most of the time at destination city "${prefs.destination}".
    The output language must be KOREAN (Hangul).
    
    Context:
    - Departure city: ${prefs.departure}
    ${waypointContext}
    - Destination city: ${prefs.destination}
    - Companions: ${prefs.companions}
    - Budget Level (1-5, 5 is luxury): ${prefs.budgetLevel}
    - Target Budget (per person): ${prefs.budgetAmount}
    - Themes: ${prefs.themes.join(", ")}

    Requirements:
    1. The itinerary must be logically ordered by time and location efficient (minimal travel time between spots, starting from ${prefs.departure}, incorporating ${prefs.waypoint || 'no waypoint'} as appropriate, and exploring ${prefs.destination}).
    2. Provide a specific "reason" for each recommendation based on the user's themes in Korean, mentioning how the departure, layover/waypoint (if specified), or final destination enhances this step.
    3. Include estimated costs in Korean Won (KRW) or appropriate local currency formatted in Korean (e.g., "약 50,000원"). The total estimated sum of activities should correspond to the target budget of "${prefs.budgetAmount}" per person.
    4. Categorize activities strictly as one of these English keys: 'meal', 'sightseeing', 'cafe', 'activity', or 'rest'.
    5. 'tripName', 'summary', 'placeName', 'description', 'reason', 'locationHint' must be in Korean.

    Response Format (JSON Schema):
    {
      "tripName": "Creative Trip Title in Korean",
      "summary": "A short engaging summary of the trip concept in Korean.",
      "totalEstimatedBudget": "Total estimated cost string in Korean",
      "days": [
        {
          "day": 1,
          "theme": "Theme title for the day in Korean",
          "activities": [
            {
              "id": "unique_id",
              "time": "HH:MM",
              "placeName": "Name of place in Korean",
              "description": "Short description in Korean",
              "category": "strictly 'meal' | 'sightseeing' | 'cafe' | 'activity' | 'rest'",
              "estimatedCost": "Cost string in Korean",
              "reason": "Why this fits the user (in Korean)",
              "locationHint": "District or area name in Korean"
            }
          ]
        }
      ]
    }
  `;

  try {
    const response = await fetch('/api/generate-trip-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to generate trip plan');
    }

    return await response.json() as TripPlan;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const getAlternativeActivity = async (
  currentActivity: Activity,
  prefs: UserPreferences,
  context: string = "User wants a different option."
): Promise<Activity> => {
  const prompt = `
    The user is at "${currentActivity.placeName}" (Category: ${currentActivity.category}) in ${prefs.destination}.
    They want an alternative recommendation for this specific time slot.
    Reason/Context: ${context}
    
    User Preferences:
    - Themes: ${prefs.themes.join(", ")}
    - Companions: ${prefs.companions}

    Provide ONE alternative activity that is nearby or logistically similar but better fits the context.
    Output must be in KOREAN.
    Category must be strictly one of: 'meal', 'sightseeing', 'cafe', 'activity', 'rest'.
  `;

  try {
    const response = await fetch('/api/get-alternative-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to get alternative activity');
    }

    return await response.json() as Activity;
  } catch (error) {
    console.error("Gemini Alternative Error:", error);
    throw error;
  }
};

export const replanTripPlan = async (currentPlan: TripPlan, prefs: UserPreferences): Promise<TripPlan> => {
  try {
    const response = await fetch('/api/replan-trip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPlan, prefs }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to replan trip itinerary');
    }

    return await response.json() as TripPlan;
  } catch (error) {
    console.error("Gemini Replan Error:", error);
    throw error;
  }
};
