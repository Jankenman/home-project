const WEATHER_EMOJI_TABLE = {
  晴れ: "☀️",
  くもり: "☁️",
  雨: "☔",
};

const API_URL =
  "https://www.jma.go.jp/bosai/jmatile/data/wdist/VPFD/130010.json";

const getTimePeriod = (hour) => {
  if (0 <= hour && hour <= 9) return "morning";
  else if (9 < hour && hour <= 18) return "daytime";
  else return "night";
};

const getDay = (index, day1lastIndex) => {
  return index <= day1lastIndex ? 1 : 2;
};

const updateStats = (stats, day, period, value, index) => {
  const keyMin = `day${day}min`;
  const keyMax = `day${day}max`;
  const keyMinIdx = `day${day}minIndexes`;
  const keyMaxIdx = `day${day}maxIndexes`;

  if (period === "morning") {
    if (value < stats[keyMin]) {
      stats[keyMin] = value;
      stats[keyMinIdx] = [index];
    } else if (value === stats[keyMin]) {
      stats[keyMinIdx].push(index);
    }
  }
  if (period === "daytime") {
    if (value > stats[keyMax]) {
      stats[keyMax] = value;
      stats[keyMaxIdx] = [index];
    } else if (value === stats[keyMax]) {
      stats[keyMaxIdx].push(index);
    }
  }
};

const getTemperatureStats = (temperatures, timeHours) => {
  const day1LastIndex = timeHours.indexOf(21);
  const stats = {
    day1min: Infinity,
    day1minIndexes: [],
    day1max: -Infinity,
    day1maxIndexes: [],
    day2min: Infinity,
    day2minIndexes: [],
    day2max: -Infinity,
    day2maxIndexes: [],
  };
  temperatures.forEach((temp, index) => {
    const hour = timeHours[index];
    const period = getTimePeriod(hour);
    const day = getDay(index, day1LastIndex);
    if (period !== "other") {
      updateStats(stats, day, period, temp, index);
    }
  });
  return stats;
};

const renderTemperature = (temperatures, stats, rowElement) => {
  const highlight = (td, type) => {
    if (type === "min") td.classList.add("text-blue-600", "font-bold");
    else if (type === "max") td.classList.add("text-red-600", "font-bold");
  };

  temperatures.forEach((temperature, index) => {
    const td = document.createElement("td");
    td.textContent = temperature.toString();

    if (stats.day1minIndexes.includes(index)) highlight(td, "min");
    else if (stats.day1maxIndexes.includes(index)) highlight(td, "max");
    else if (stats.day2minIndexes.includes(index)) highlight(td, "min");
    else if (stats.day2maxIndexes.includes(index)) highlight(td, "max");

    rowElement.appendChild(td);
  });
};

const main = async () => {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    //
    // データ
    //

    // 時刻
    const timeHours = data.areaTimeSeries.timeDefines.map((d) =>
      new Date(d.dateTime).getHours()
    );
    const day1LastIndex = timeHours.indexOf(21);

    // 天気
    const wethersEmojis = data.areaTimeSeries.weather.map((w) => {
      return WEATHER_EMOJI_TABLE[w] || w;
    });

    // 気温
    const temperatures = [...data.pointTimeSeries.temperature].slice(0, -1);
    const temperatureStats = getTemperatureStats(temperatures, timeHours);

    // 最高・最低気温
    const minTemperature = Math.min(
      ...data.pointTimeSeries.minTemperature
        .slice(0, day1LastIndex + 1)
        .filter(Boolean)
    );
    const maxTemperature = Math.max(
      ...data.pointTimeSeries.maxTemperature
        .slice(0, day1LastIndex + 1)
        .filter(Boolean)
    );

    // 風速
    const windRanges = data.areaTimeSeries.wind.map((wind) =>
      wind.range.split(" ").join("-")
    );
    const windRangeMins = data.areaTimeSeries.wind.map((wind) =>
      Number(wind.range.split(" ")[0])
    );
    const windRangeMaxs = data.areaTimeSeries.wind.map((wind) =>
      Number(wind.range.split(" ")[1])
    );

    // 風寒指数
    const windChills = temperatures.map((temperature, i) => {
      const windSpeedAvg = (windRangeMins[i] + windRangeMaxs[i]) / 2;
      const windSpeedKmh = windSpeedAvg * 3.6; // 風速(m/s)をkm/hに変換
      const windChill =
        13.12 +
        0.6215 * temperature -
        11.37 * Math.pow(windSpeedKmh, 0.16) +
        0.3965 * temperature * Math.pow(windSpeedKmh, 0.16);
      return Math.round(windChill * 10) / 10; // 小数点第一位まで表示
    });
    const windChillStats = getTemperatureStats(windChills, timeHours);

    //
    // 描画
    //

    console.log(
      "windChills:",
      windChillStats.day1min,
      windChillStats.day1min === Infinity,
      windChillStats.day1max,
      windChillStats.day1max === -Infinity
    );

    // 最低・最高気温 / 体感気温
    document.getElementById("js-min-temperature").textContent =
      minTemperature === Infinity ? "---" : minTemperature.toString();
    document.getElementById("js-max-temperature").textContent =
      maxTemperature === -Infinity ? "---" : maxTemperature.toString();
    document.getElementById("js-min-windchill").textContent =
      windChillStats.day1min === Infinity
        ? "---"
        : windChillStats.day1min.toString();
    document.getElementById("js-max-windchill").textContent =
      windChillStats.day1max === -Infinity
        ? "---"
        : windChillStats.day1max.toString();

    // 時刻
    const timeRow = document.getElementById("js-time-row");
    timeHours.forEach((hour) => {
      const td = document.createElement("td");
      td.textContent = hour.toString();
      timeRow.appendChild(td);
    });

    // 天気
    const weatherRow = document.getElementById("js-weather-row");
    wethersEmojis.forEach((emoji) => {
      const td = document.createElement("td");
      td.textContent = emoji;
      weatherRow.appendChild(td);
    });

    // 風寒指数
    const windChillRow = document.getElementById("js-wind-chill-row");
    renderTemperature(windChills, windChillStats, windChillRow);

    // 気温
    const temperatureRow = document.getElementById("js-temperature-row");
    renderTemperature(temperatures, temperatureStats, temperatureRow);

    // 風速
    const windSpeedRow = document.getElementById("js-wind-speed-row");
    windRanges.forEach((windRange) => {
      const td = document.createElement("td");
      td.textContent = windRange;
      windSpeedRow.appendChild(td);
    });
  } catch (error) {
    alert(
      "気象庁からデータを取得している間，もしくは処理中にエラーが発生しました。"
    );
    console.error(error);
  }
};

main();
