import { hasTravelDates, type TravelRequest, type WeatherContext } from "@/lib/travel";

interface GeocodingResponse {
  results?: Array<{
    latitude: number;
    longitude: number;
    name: string;
    admin1?: string;
    country?: string;
  }>;
}

interface ForecastResponse {
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    weather_code: number[];
  };
}

function weatherCodeText(code: number): string {
  if (code === 0) return "晴朗";
  if ([1, 2, 3].includes(code)) return "晴间多云";
  if ([45, 48].includes(code)) return "有雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "毛毛雨";
  if ([61, 63, 65, 66, 67].includes(code)) return "有雨";
  if ([71, 73, 75, 77].includes(code)) return "有雪";
  if ([80, 81, 82].includes(code)) return "阵雨";
  if ([85, 86].includes(code)) return "阵雪";
  if ([95, 96, 99].includes(code)) return "雷雨";
  return "天气多变";
}

async function fetchWithTimeout(url: string, timeoutMs = 5_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TravelNotebook/1.0" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isWithinForecastWindow(startDate: string, endDate: string): boolean {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const max = new Date(today.getTime() + 15 * 86_400_000);
  return start >= today && end <= max;
}

export async function getWeatherContext(request: TravelRequest): Promise<WeatherContext> {
  if (!hasTravelDates(request)) {
    return {
      source: "unavailable",
      summary: "用户未指定旅行日期，因此不调用短期天气预报。请按目的地季节趋势准备，并在确定日期后再次核实天气。",
    };
  }

  if (!isWithinForecastWindow(request.startDate, request.endDate)) {
    return {
      source: "unavailable",
      summary: "旅行日期不在可靠的短期预报窗口内，请仅按季节趋势规划，并在出发前再次核实天气。",
    };
  }

  try {
    const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geoUrl.searchParams.set("name", request.destination);
    geoUrl.searchParams.set("count", "1");
    geoUrl.searchParams.set("language", "zh");
    geoUrl.searchParams.set("format", "json");

    const geoResponse = await fetchWithTimeout(geoUrl.toString());
    if (!geoResponse.ok) throw new Error("地点解析失败");
    const geo = (await geoResponse.json()) as GeocodingResponse;
    const location = geo.results?.[0];
    if (!location) throw new Error("未找到目的地坐标");

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(location.latitude));
    forecastUrl.searchParams.set("longitude", String(location.longitude));
    forecastUrl.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code"
    );
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("start_date", request.startDate);
    forecastUrl.searchParams.set("end_date", request.endDate);

    const forecastResponse = await fetchWithTimeout(forecastUrl.toString());
    if (!forecastResponse.ok) throw new Error("天气查询失败");
    const forecast = (await forecastResponse.json()) as ForecastResponse;
    const daily = forecast.daily;
    if (!daily || daily.time.length === 0) throw new Error("天气数据为空");

    const minTemp = Math.round(Math.min(...daily.temperature_2m_min));
    const maxTemp = Math.round(Math.max(...daily.temperature_2m_max));
    const maxRain = Math.round(Math.max(...daily.precipitation_probability_max));
    const maxWind = Math.round(Math.max(...daily.wind_speed_10m_max));
    const dominantCode = daily.weather_code.reduce((best, code) => {
      const bestCount = daily.weather_code.filter((item) => item === best).length;
      const codeCount = daily.weather_code.filter((item) => item === code).length;
      return codeCount > bestCount ? code : best;
    }, daily.weather_code[0]);
    const locationName = [location.name, location.admin1, location.country]
      .filter(Boolean)
      .join("，");

    return {
      source: "forecast",
      locationName,
      summary: `${locationName}在行程日期内的短期预报：整体${weatherCodeText(dominantCode)}，预计最低约 ${minTemp}°C、最高约 ${maxTemp}°C，单日最高降水概率约 ${maxRain}% ，最大风速约 ${maxWind} km/h。天气仍可能变化，请出发前复核。`,
    };
  } catch {
    return {
      source: "unavailable",
      summary: "暂未取得可靠的实时天气数据，请按季节趋势规划，并在出发前 3–7 天核实官方预报。",
    };
  }
}
