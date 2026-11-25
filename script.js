/* ============================================================
   Weather Dashboard · Async/Await + Fetch + Nested JSON
   Uses Open-Meteo (free, no API key required)
   ============================================================ */

(function () {
  'use strict';

  // ---------- DOM ----------
  const cityInput     = document.getElementById('cityInput');
  const searchBtn     = document.getElementById('searchBtn');
  const loadingEl     = document.getElementById('loading');
  const errorBox      = document.getElementById('errorBox');
  const weatherResult = document.getElementById('weatherResult');

  const locName       = document.getElementById('locName');
  const locMeta       = document.getElementById('locMeta');
  const tempMain      = document.getElementById('tempMain');
  const conditionText = document.getElementById('conditionText');
  const conditionDesc = document.getElementById('conditionDesc');
  const humidity      = document.getElementById('humidity');
  const windSpeed     = document.getElementById('windSpeed');
  const windDir       = document.getElementById('windDir');
  const feelsLike     = document.getElementById('feelsLike');
  const uvIndex       = document.getElementById('uvIndex');
  const uvLabel       = document.getElementById('uvLabel');
  const hourlyScroll  = document.getElementById('hourlyScroll');

  // ---------- WMO WEATHER CODE MAP ----------
  // Reference: https://open-meteo.com/en/docs
  const weatherCodeMap = {
    0:  { text: 'Clear sky', icon: '☀️' },
    1:  { text: 'Mainly clear', icon: '🌤️' },
    2:  { text: 'Partly cloudy', icon: '⛅' },
    3:  { text: 'Overcast', icon: '☁️' },
    45: { text: 'Fog', icon: '🌫️' },
    48: { text: 'Depositing rime fog', icon: '🌫️' },
    51: { text: 'Light drizzle', icon: '🌦️' },
    53: { text: 'Moderate drizzle', icon: '🌦️' },
    55: { text: 'Dense drizzle', icon: '🌧️' },
    56: { text: 'Light freezing drizzle', icon: '🌧️' },
    57: { text: 'Dense freezing drizzle', icon: '🌧️' },
    61: { text: 'Slight rain', icon: '🌦️' },
    63: { text: 'Moderate rain', icon: '🌧️' },
    65: { text: 'Heavy rain', icon: '🌧️' },
    66: { text: 'Light freezing rain', icon: '🌧️' },
    67: { text: 'Heavy freezing rain', icon: '🌧️' },
    71: { text: 'Slight snow', icon: '🌨️' },
    73: { text: 'Moderate snow', icon: '🌨️' },
    75: { text: 'Heavy snow', icon: '❄️' },
    77: { text: 'Snow grains', icon: '❄️' },
    80: { text: 'Slight rain showers', icon: '🌦️' },
    81: { text: 'Moderate rain showers', icon: '🌧️' },
    82: { text: 'Violent rain showers', icon: '⛈️' },
    85: { text: 'Slight snow showers', icon: '🌨️' },
    86: { text: 'Heavy snow showers', icon: '❄️' },
    95: { text: 'Thunderstorm', icon: '⛈️' },
    96: { text: 'Thunderstorm with slight hail', icon: '⛈️' },
    99: { text: 'Thunderstorm with heavy hail', icon: '⛈️' }
  };

  function getWeatherInfo(code) {
    return weatherCodeMap[code] || { text: 'Unknown', icon: '❓' };
  }

  function uvLabelText(uv) {
    if (uv == null) return '—';
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very High';
    return 'Extreme';
  }

  function degToCompass(deg) {
    if (deg == null) return '—';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  // ---------- UI HELPERS ----------
  function showLoading(show) {
    loadingEl.classList.toggle('active', show);
    if (show) {
      weatherResult.classList.remove('active');
      errorBox.classList.remove('active');
    }
    searchBtn.disabled = show;
  }

  function showError(msg) {
    errorBox.textContent = '⚠️ ' + msg;
    errorBox.classList.add('active');
    weatherResult.classList.remove('active');
  }

  function clearError() {
    errorBox.classList.remove('active');
    errorBox.textContent = '';
  }

  // ---------- MAIN FETCH PIPELINE ----------
  async function fetchWeather(city) {
    if (!city || !city.trim()) {
      showError('Please enter a city name.');
      return;
    }

    clearError();
    showLoading(true);

    try {
      // STEP 1 — Geocoding: city name → coordinates
      const geoUrl =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`;

      const geoRes = await fetch(geoUrl);

      if (!geoRes.ok) {
        throw new Error(`Geocoding request failed (HTTP ${geoRes.status})`);
      }

      const geoData = await geoRes.json();

      if (geoData.error) {
        throw new Error(geoData.reason || 'Geocoding failed');
      }

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`City "${city}" not found. Try a different name.`);
      }

      const location = geoData.results[0];
      const { latitude, longitude } = location;

      // STEP 2 — Weather forecast (current + hourly)
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,` +
        `weather_code,wind_speed_10m,wind_direction_10m,uv_index` +
        `&hourly=temperature_2m,weather_code` +
        `&timezone=auto&forecast_days=1`;

      const weatherRes = await fetch(weatherUrl);

      if (!weatherRes.ok) {
        throw new Error(`Weather request failed (HTTP ${weatherRes.status})`);
      }

      const weatherData = await weatherRes.json();

      if (weatherData.error) {
        throw new Error(weatherData.reason || 'Weather data unavailable');
      }

      if (!weatherData.current) {
        throw new Error('Invalid weather response format');
      }

      // STEP 3 — Render
      renderWeather(location, weatherData);

    } catch (err) {
      console.error('Weather fetch error:', err);
      showError(err.message || 'Something went wrong. Check your connection.');
    } finally {
      showLoading(false);
    }
  }

  // ---------- RENDER ----------
  function renderWeather(location, data) {
    const current = data.current;
    const hourly  = data.hourly;

    // Location header
    const parts = [location.name];
    if (location.admin1) parts.push(location.admin1);
    if (location.country) parts.push(location.country);
    locName.textContent = parts.join(', ');
    locMeta.textContent =
      `📍 ${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}° · ${location.timezone || 'local'}`;

    // Main temperature
    tempMain.textContent = Math.round(current.temperature_2m);

    // Condition
    const info = getWeatherInfo(current.weather_code);
    conditionText.textContent = info.text;
    conditionDesc.textContent = `${info.icon} WMO code: ${current.weather_code}`;

    // Metric cards
    humidity.textContent  = current.relative_humidity_2m + '%';
    windSpeed.textContent = current.wind_speed_10m + ' km/h';
    windDir.textContent   = degToCompass(current.wind_direction_10m) +
                            ' (' + current.wind_direction_10m + '°)';
    feelsLike.textContent = Math.round(current.apparent_temperature) + '°C';
    uvIndex.textContent   = current.uv_index != null ? current.uv_index.toFixed(1) : '—';
    uvLabel.textContent   = uvLabelText(current.uv_index);

    // Hourly preview
    hourlyScroll.innerHTML = '';

    if (hourly && Array.isArray(hourly.time) && Array.isArray(hourly.temperature_2m)) {
      const now = new Date();
      const currentHourISO = now.toISOString().slice(0, 13) + ':00';

      let startIdx = hourly.time.findIndex(t => t >= currentHourISO);
      if (startIdx === -1) startIdx = 0;

      const count = Math.min(8, hourly.time.length - startIdx);

      for (let i = 0; i < count; i++) {
        const idx    = startIdx + i;
        const tStr   = hourly.time[idx];
        const tVal   = hourly.temperature_2m[idx];
        const code   = hourly.weather_code ? hourly.weather_code[idx] : 0;
        const hInfo  = getWeatherInfo(code);

        const d = new Date(tStr);
        const label = d.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const hourDiv = document.createElement('div');
        hourDiv.className = 'hour-item';
        hourDiv.innerHTML = `
          <div class="hour-time">${label}</div>
          <div class="hour-icon">${hInfo.icon}</div>
          <div class="hour-temp">${Math.round(tVal)}°</div>
        `;
        hourlyScroll.appendChild(hourDiv);
      }
    }

    weatherResult.classList.add('active');
  }

  // ---------- EVENTS ----------
  searchBtn.addEventListener('click', () => fetchWeather(cityInput.value));

  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchWeather(cityInput.value);
    }
  });

  // ---------- INIT ----------
  window.addEventListener('DOMContentLoaded', () => {
    cityInput.value = 'Berlin';
    setTimeout(() => fetchWeather('Berlin'), 100);
  });

})();