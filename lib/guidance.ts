import type { Hazard } from "./domain";
export const guidance = [
  { id: "flood", hazard: "flood" as Hazard, title: "Flood preparedness", source: "FEMA Ready.gov · General flood preparedness", url: "https://www.ready.gov/sites/default/files/2024-07/ready.gov_flood_info-sheet.pdf", items: ["Monitor official warnings and follow instructions from local authorities.", "Prepare essential supplies and a household communication plan before disruption.", "Avoid walking, swimming, or driving through floodwater.", "Plan ahead for household members who may need assistance."] },
  { id: "landslide", hazard: "landslide" as Hazard, title: "Landslide preparedness", source: "Government of India · Landslide precautions", url: "https://dgfscdhg.gov.in/landslides", items: ["Plan travel in hilly regions using current weather information.", "Watch for reported cracks, falling rocks, and unusual slope changes.", "Report warning signs to local district authorities without approaching an unstable area.", "Avoid walking over loose debris or damaged electrical wiring."] },
  { id: "weather", hazard: "extreme_weather" as Hazard, title: "Extreme weather preparedness", source: "US National Weather Service · Lightning safety", url: "https://www.weather.gov/safety/lightning-safety", items: ["Plan outdoor activities around current weather information.", "When thunder is heard, seek appropriate indoor shelter.", "Stay away from windows and follow official lightning safety precautions.", "Follow current local authority instructions; this general guide is not a local forecast."] },
];
export const kitItems = ["Drinking water", "Essential medicines", "Torch and batteries", "Charged phone and power bank", "Copies of important documents", "Ready-to-eat food", "Personal hygiene supplies", "Household assistance plan"];
export function relevantGuidance(question: string) {
  const query = question.toLowerCase();
  if (/landslide|slope|পাহাৰ/.test(query)) return [guidance[1]];
  if (/storm|lightning|wind|weather|বতাহ/.test(query)) return [guidance[2]];
  if (/flood|water|বান|পানী/.test(query)) return [guidance[0]];
  if (/kit|prepare|prepar|medicine|document|প্ৰস্তুতি/.test(query)) return guidance;
  return [];
}
