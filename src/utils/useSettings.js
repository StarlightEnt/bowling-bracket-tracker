import { useState, useEffect } from "react";

const DEFAULT_SETTINGS = {
  tournament_name: "Bowling Bracket Tournament",
  tournament_tagline: "",
  tournament_date: "",
  tournament_location: "",
  tournament_welcome: "",
  tournament_logo_url: "",
  primary_color: "#f59e0b",
};

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings({ ...DEFAULT_SETTINGS, ...d.settings });
        setLoaded(true);
        // Apply primary color as CSS variable
        if (d.settings?.primary_color) {
          document.documentElement.style.setProperty(
            "--color-amber", d.settings.primary_color
          );
        }
      })
      .catch(() => setLoaded(true));
  }, []);

  return { settings, loaded };
}
