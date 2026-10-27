function normalize(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function inside({ x, y }, bounds) {
  return Number.isFinite(x) && Number.isFinite(y)
    && x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

/** Returns null for a place name, and a validated point for an X,Y query. */
export function parseCoordinateQuery(query, bounds) {
  const text = String(query ?? '').trim().replace(/−/g, '-');
  if (!text) return null;
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
  const pair = new RegExp(`^\\(?\\s*(${number})\\s*(?:,|;|\\s)\\s*(${number})\\s*\\)?$`);
  const labelled = new RegExp(`^[xх]\\s*[:=]?\\s*(${number})\\s*[,; ]*\\s*[yу]\\s*[:=]?\\s*(${number})$`, 'i');
  const match = pair.exec(text) || labelled.exec(text);
  if (!match) {
    if (/^[+\-\d.(][\d\s,;.+\-eE()]*$/.test(text) || /^(?:NaN|[+-]?Infinity)\s*[,;]/i.test(text)) {
      throw new TypeError('Введите две координаты X, Y. Для дробной части используйте точку.');
    }
    return null;
  }
  const point = { x: Number(match[1]), y: Number(match[2]) };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('Координаты должны быть конечными числами.');
  }
  if (!inside(point, bounds)) throw new RangeError('Точка находится за границами карты.');
  return point;
}

/** A local catalogue search, including aliases and the current user's markers. */
export function searchPlaces(query, places = [], userMarkers = [], bounds, limit = 8) {
  const point = parseCoordinateQuery(query, bounds);
  if (point) return [{
    id: `coordinate:${point.x},${point.y}`, name: `Координаты ${point.x}, ${point.y}`,
    ...point, kind: 'coordinate', category: 'landmark',
  }];
  const needle = normalize(query);
  if (!needle) return [];
  const tokens = needle.split(' ');
  const candidates = [
    ...places.map((place) => ({ ...place, kind: 'place' })),
    ...userMarkers.map((marker) => ({ ...marker, kind: 'user' })),
  ];
  return candidates.filter((entry) => typeof entry.name === 'string' && inside(entry, bounds))
    .map((entry) => {
      const names = [entry.name, ...(Array.isArray(entry.aliases) ? entry.aliases : [])].map(normalize);
      const combined = names.join(' ');
      const score = names.some((name) => name === needle) ? 1000
        : names.some((name) => name.startsWith(needle)) ? 800
          : names.some((name) => name.includes(needle)) ? 500
            : tokens.every((token) => combined.includes(token)) ? 250 : 0;
      return { entry, score };
    }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, 'ru'))
    .slice(0, limit).map(({ entry }) => entry);
}
