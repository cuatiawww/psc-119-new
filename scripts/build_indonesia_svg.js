const fs = require('fs');
const path = require('path');

const geojsonPath = path.join(__dirname, '../public/indonesia-provinces.geojson');
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

// Indonesia geographic bounds
// Longitude: 95.0 to 141.2
// Latitude: -11.2 to 6.0
const width = 850;
const height = 310;
const minLng = 95.0;
const maxLng = 141.2;
const minLat = -11.2;
const maxLat = 6.0;

function project(lng, lat) {
  const x = ((lng - minLng) / (maxLng - minLng)) * width;
  const y = ((maxLat - lat) / (maxLat - minLat)) * height;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function ringToSvg(ring) {
  return ring
    .map((pt, i) => {
      const [x, y] = project(pt[0], pt[1]);
      return (i === 0 ? 'M' : 'L') + x + ' ' + y;
    })
    .join(' ') + ' Z';
}

function geomToPath(geom) {
  if (geom.type === 'Polygon') {
    return geom.coordinates.map(ringToSvg).join(' ');
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.map(poly => poly.map(ringToSvg).join(' ')).join(' ');
  }
  return '';
}

// Calculate centroid of largest polygon in feature for accurate labeling
function getCentroid(geom) {
  let largestRing = null;
  let maxPts = 0;

  function findRings(coords) {
    if (typeof coords[0][0] === 'number') {
      if (coords.length > maxPts) {
        maxPts = coords.length;
        largestRing = coords;
      }
    } else {
      coords.forEach(findRings);
    }
  }
  findRings(geom.coordinates);

  if (!largestRing) return [width / 2, height / 2];

  let sumX = 0, sumY = 0;
  largestRing.forEach(pt => {
    sumX += pt[0];
    sumY += pt[1];
  });
  const cLng = sumX / largestRing.length;
  const cLat = sumY / largestRing.length;
  return project(cLng, cLat);
}

const provinceFeatures = [];

data.features.forEach(f => {
  const prop = f.properties.Propinsi.trim();
  const pathData = geomToPath(f.geometry);
  const [cx, cy] = getCentroid(f.geometry);

  provinceFeatures.push({
    rawName: prop,
    path: pathData,
    cx: Math.round(cx * 10) / 10,
    cy: Math.round(cy * 10) / 10,
  });
});

console.log('Processed', provinceFeatures.length, 'provinces.');

const outputPath = path.join(__dirname, '../src/lib/indonesiaMapData.ts');
const fileContent = `// Auto-generated accurate GeoJSON polygon paths for all Indonesian Provinces
// Sourced from official Bakosurtanal / Kemenkes boundary data
export interface ProvincePathData {
  id: string;
  names: string[]; // Aliases for matching
  cx: number;
  cy: number;
  path: string;
}

export const INDONESIA_MAP_VIEWBOX = '0 0 ${width} ${height}';
export const INDONESIA_MAP_WIDTH = ${width};
export const INDONESIA_MAP_HEIGHT = ${height};

export const INDONESIA_PROVINCES: ProvincePathData[] = ${JSON.stringify(
  provinceFeatures.map((p, idx) => {
    const raw = p.rawName;
    const names = [raw];

    // Build standard aliases
    let clean = raw.replace(/^(PROV\.|PROVINSI|PROBANTEN|DI\.)\s*/gi, '').trim();
    if (raw === 'PROBANTEN') clean = 'BANTEN';
    if (raw === 'DAERAH ISTIMEWA YOGYAKARTA') {
      names.push('DIY', 'D.I. YOGYAKARTA', 'YOGYAKARTA');
    }
    if (raw === 'DKI JAKARTA') {
      names.push('JAKARTA');
    }
    if (raw === 'DI. ACEH') {
      names.push('ACEH', 'NAD');
    }
    if (raw === 'NUSATENGGARA BARAT') {
      names.push('NUSA TENGGARA BARAT', 'NTB');
    }
    if (raw === 'NUSA TENGGARA TIMUR') {
      names.push('NTT');
    }
    if (raw === 'BANGKA BELITUNG') {
      names.push('KEP. BANGKA BELITUNG', 'KEPULAUAN BANGKA BELITUNG');
    }
    if (raw === 'IRIAN JAYA TIMUR') {
      names.push('PAPUA', 'PAPUA SELATAN', 'PAPUA TENGAH');
    }
    if (raw === 'IRIAN JAYA TENGAH') {
      names.push('PAPUA PEGUNUNGAN', 'PAPUA');
    }
    if (raw === 'IRIAN JAYA BARAT') {
      names.push('PAPUA BARAT', 'PAPUA BARAT DAYA');
    }
    if (raw === 'KALIMANTAN TIMUR') {
      names.push('KALIMANTAN UTARA', 'KALTARA', 'KALTIM');
    }
    if (raw === 'SULAWESI SELATAN') {
      names.push('SULAWESI BARAT', 'SULBAR', 'SULSEL');
    }
    if (clean) names.push(clean);

    return {
      id: 'prov-' + idx,
      names: Array.from(new Set(names)),
      cx: p.cx,
      cy: p.cy,
      path: p.path,
    };
  }),
  null,
  2
)};
`;

fs.writeFileSync(outputPath, fileContent);
console.log('Saved to', outputPath);
