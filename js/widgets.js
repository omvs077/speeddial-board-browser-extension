/**
 * widgets.js
 * Live telemetry widgets: geolocation weather, clock/calendar, and a
 * storage-backed to-do list.
 */

const Widgets = {
  /* ---------------- Weather ---------------- */
  weatherDays: [],
  weatherDayIndex: 0,

  async initWeather() {
    const body = document.getElementById("weather-body");
    const saved = await chrome.storage.local.get("weatherManualCity");
    if (saved.weatherManualCity) {
      const { lat, lon } = saved.weatherManualCity;
      try {
        const data = await this._fetchWeather(lat, lon);
        this.weatherDays = this._buildWeatherDays(data, saved.weatherManualCity.name);
        this.weatherDayIndex = 0;
        this._renderWeatherDay();
        return;
      } catch (err) {
        // fall through to geolocation/manual entry below
      }
    }
    if (!navigator.geolocation) {
      this._renderCityFallback(body, "Geolocation unsupported. Enter a city:");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const data = await this._fetchWeather(latitude, longitude);
          this.weatherDays = this._buildWeatherDays(data, "Your location");
          this.weatherDayIndex = 0;
          this._renderWeatherDay();
          this._renderWeatherDots();
        } catch (err) {
          body.textContent = "Weather unavailable";
        }
      },
      (err) => {
        if (err.code === 1) {
          this._renderCityFallback(
            body,
            "Location is blocked (by Chrome or another extension). Enter a city, or fix permissions:",
            true
          );
        } else {
          body.innerHTML = `Location unavailable <button class="retry-btn" id="weather-retry">Retry</button>`;
          document.getElementById("weather-retry").addEventListener("click", () => this.initWeather());
        }
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  },

  async refreshWeather() {
    document.getElementById("weather-body").textContent = "Refreshing\u2026";
    await this.initWeather();
  },

  _renderCityFallback(body, message, showSettingsLink) {
    const linkHtml = showSettingsLink
      ? `<button class="link-btn" id="weather-open-settings">Open Chrome location settings</button>`
      : "";
    body.innerHTML = `
      <div class="weather-fallback">
        <p>${message}</p>
        <input type="text" id="weather-city-input" placeholder="e.g. London" />
        <button class="retry-btn" id="weather-city-submit">Set</button>
        ${linkHtml}
        <div id="weather-city-error" class="weather-error"></div>
      </div>`;
    if (showSettingsLink) {
      document.getElementById("weather-open-settings").addEventListener("click", () => {
        chrome.tabs.create({ url: "chrome://settings/content/location" });
      });
    }
    const input = document.getElementById("weather-city-input");
    const submit = document.getElementById("weather-city-submit");
    const errorEl = document.getElementById("weather-city-error");
    const go = async () => {
      const name = input.value.trim();
      if (!name) return;
      errorEl.textContent = "";
      try {
        const loc = await this._geocodeCity(name);
        await chrome.storage.local.set({ weatherManualCity: loc });
        const data = await this._fetchWeather(loc.lat, loc.lon);
        this.weatherDays = this._buildWeatherDays(data, loc.name);
        this.weatherDayIndex = 0;
        this._renderWeatherDay();
      } catch (err) {
        errorEl.textContent = "City not found. Try again.";
      }
    };
    submit.addEventListener("click", go);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  },

  async _geocodeCity(name) {
    const url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=1";
    const res = await fetch(url);
    if (!res.ok) throw new Error("geocode fetch failed");
    const data = await res.json();
    if (!data.results || !data.results.length) throw new Error("no results");
    const r = data.results[0];
    return { lat: r.latitude, lon: r.longitude, name: r.name };
  },

  async _fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=3&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("weather fetch failed");
    return res.json();
  },

  _buildWeatherDays(data, locationLabel) {
    const days = data.daily.time.map((dateStr, i) => ({
      label: i === 0 ? "Today" : new Date(dateStr).toLocaleDateString([], { weekday: "short" }),
      max: Math.round(data.daily.temperature_2m_max[i]),
      min: Math.round(data.daily.temperature_2m_min[i]),
      code: data.daily.weather_code[i],
    }));
    // Day 0 also carries live current conditions.
    days[0].current = Math.round(data.current.temperature_2m);
    days[0].wind = Math.round(data.current.wind_speed_10m);
    days[0].location = locationLabel || "Your location";
    return days;
  },

  _weatherLabel(code) {
    const map = {
      0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Rime fog", 51: "Light drizzle", 61: "Light rain",
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Rime fog",
      51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
      56: "Freezing drizzle", 57: "Dense freezing drizzle",
      61: "Light rain", 63: "Rain", 65: "Heavy rain",
      66: "Freezing rain", 67: "Heavy freezing rain",
      71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
      80: "Light showers", 81: "Showers", 82: "Violent showers",
      85: "Light snow showers", 86: "Heavy snow showers",
      95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Severe thunderstorm",
    };
    return map[code] || "Unknown";
  },

  _renderWeatherDay() {
    const day = this.weatherDays[this.weatherDayIndex];
    if (!day) return;
    const body = document.getElementById("weather-body");

    if (day.current !== undefined) {
      body.innerHTML = `
        <div class="location-label">${day.location}</div>
        <div class="temp">${day.current}\u00b0C</div>
        <div class="cond">${this._weatherLabel(day.code)} \u00b7 wind ${day.wind} km/h</div>
      `;
    } else {
      body.innerHTML = `
        <div class="temp">${day.max}\u00b0 / ${day.min}\u00b0</div>
        <div class="cond">${day.label} \u00b7 ${this._weatherLabel(day.code)}</div>
      `;
    }
  },

  _renderWeatherDots() {
    const wrap = document.getElementById("weather-dots");
    wrap.innerHTML = "";
    this.weatherDays.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "widget-dot" + (i === this.weatherDayIndex ? " active" : "");
      dot.addEventListener("click", () => {
        this.weatherDayIndex = i;
        this._renderWeatherDay();
        this._renderWeatherDots();
      });
      wrap.appendChild(dot);
    });
  },

  /* ---------------- Clock & Calendar ---------------- */
  initClock() {
    this._tickClock();
    setInterval(() => this._tickClock(), 1000);
  },

  _isoWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  },

  _tickClock() {
    const now = new Date();
    document.getElementById("clock-time").textContent =
      now.toLocaleTimeString([], { hour12: UIController.prefs.timeFormat === "12h" });
    document.getElementById("clock-date").textContent =
      now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    document.getElementById("clock-week").textContent =
      `Week ${String(this._isoWeekNumber(now)).padStart(2, "0")}`;
  },

  /* ---------------- To-Do ---------------- */
  async initTodo() {
    const input = document.getElementById("todo-input");
    const list = document.getElementById("todo-list");

    const render = (tasks) => {
      list.innerHTML = "";
      tasks.forEach((task, idx) => {
        const li = document.createElement("li");
        li.textContent = task;
        li.title = "Click to remove";
        li.addEventListener("click", async () => {
          const { todoTasks = [] } = await chrome.storage.local.get("todoTasks");
          todoTasks.splice(idx, 1);
          await chrome.storage.local.set({ todoTasks });
          render(todoTasks);
        });
        list.appendChild(li);
      });
    };

    const { todoTasks = [] } = await chrome.storage.local.get("todoTasks");
    render(todoTasks);

    input.addEventListener("keydown", async (e) => {
      if (e.key !== "Enter" || !input.value.trim()) return;
      const { todoTasks = [] } = await chrome.storage.local.get("todoTasks");
      todoTasks.push(input.value.trim());
      await chrome.storage.local.set({ todoTasks });
      input.value = "";
      render(todoTasks);
    });
  },

  initAll() {
    this.initWeather();
    this.initClock();
    this.initTodo();
    this._bindWidgetMenus();
  },

  _bindWidgetMenus() {
    document.querySelectorAll(".widget-menu-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = btn.dataset.widget;
        const rect = btn.getBoundingClientRect();

        const sizeItems = ["sm", "md", "lg"].map((s) => ({
          text: { sm: "Small", md: "Medium", lg: "Large" }[s],
          checked: UIController.prefs.sizes[key] === s,
          onClick: () => UIController.setWidgetSize(key, s),
        }));

        const actionItems = [
          { text: "Hide widget", onClick: () => UIController.toggleWidgetByMenu(key) },
        ];
        if (key === "weather") {
          actionItems.unshift({ text: "Refresh", onClick: () => this.refreshWeather() });
          actionItems.unshift({
            text: "Change city",
            onClick: async () => {
              await chrome.storage.local.remove("weatherManualCity");
              const body = document.getElementById("weather-body");
              this._renderCityFallback(body, "Enter a new city:");
            },
          });
        }

        UIController.openContextMenu(rect.left, rect.bottom + 4, [
          { label: "Size", items: sizeItems },
          { label: null, items: actionItems },
        ]);
      });
    });
  },
};