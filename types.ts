export enum TravelTheme {
  HEALING = '힐링',
  GASTRONOMY = '맛집 탐방',
  ACTIVITY = '액티비티',
  INSTAGRAM = '인생샷',
  CULTURE = '문화/예술',
  LUXURY = '호캉스/럭셔리'
}

export enum CompanionType {
  SOLO = '나 혼자',
  COUPLE = '연인과',
  FAMILY = '가족과',
  FRIENDS = '친구와'
}

export interface UserPreferences {
  departure: string;
  waypoint?: string;
  destination: string;
  duration: number;
  budgetLevel: number; // 1 to 5
  budgetAmount: string; // e.g. "50만원" or "500000"
  companions: CompanionType;
  themes: TravelTheme[];
}

export interface Activity {
  id: string;
  time: string;
  placeName: string;
  description: string;
  category: 'meal' | 'sightseeing' | 'cafe' | 'activity' | 'rest';
  estimatedCost: string;
  reason: string;
  locationHint: string; // e.g., "Near Central Park"
}

export interface DayPlan {
  day: number;
  theme: string;
  activities: Activity[];
}

export interface TripPlan {
  tripName: string;
  summary: string;
  days: DayPlan[];
  totalEstimatedBudget: string;
}