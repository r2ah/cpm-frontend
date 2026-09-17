import WKT from 'ol/format/WKT.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import CircleStyle from 'ol/style/Circle.js';
import { fromLonLat } from 'ol/proj.js';

const layerDefinitions = [
  { id: 'gis-calles', endpoint: 'calles', label: 'Calles', color: '#8b4513', type: 'line' },
  { id: 'gis-manzanas', endpoint: 'manzanas', label: 'Manzanas', color: '#d97706', type: 'polygon' },
  { id: 'gis-parcelas', endpoint: 'parcelas', label: 'Parcelas', color: '#16a34a', type: 'polygon' },
  { id: 'gis-edificios', endpoint: 'edificios', label: 'Edificios', color: '#2563eb', type: 'polygon' },
  { id: 'gis-publicos', endpoint: 'publicos', label: 'Espacios públicos', color: '#9333ea', type: 'polygon' }
];

const getApiBase = () =>
  `${window.location.protocol}//${window.location.hostname}:8000/api/v1/gis`;

const authHeaders = () => {
  const token = window.localStorage.getItem('auth_token');

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
};

const fetchLayerData = async (endpoint) => {
  const response = await fetch(
    `${getApiBase()}/layers/${endpoint}`,
    {
      headers: {
        Accept: 'application/json',
        ...authHeaders()
      }
    }
  );
  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    window.localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('La sesión ha expirado.');
  }

  if (!response.ok || payload?.success !== true) {
    throw new Error(
      payload?.message || `No se pudo cargar la capa ${endpoint}.`
    );
  }

  return Array.isArray(payload.data) ? payload.data : [];
};

const fetchBuildingDetails = async (code) => {
  const response = await fetch(
    `${getApiBase()}/buildings/${encodeURIComponent(code)}`,
    {
      headers: {
        Accept: 'application/json',
        ...authHeaders()
      }
    }
  );
  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    window.localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('La sesión ha expirado.');
  }

  if (!response.ok || payload?.success !== true) {
    throw new Error(
      payload?.message || 'No se pudieron obtener los datos del edificio.'
    );
  }

  return payload.data;
};

const toWebMercator = (x, y) => {
  const a = 6378137;
  const eccentricitySquared = 0.00669438;
  const zone = 17;
  const k0 = 0.9996;
  const ePrimeSquared = eccentricitySquared / (1 - eccentricitySquared);
  const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) /
    (1 + Math.sqrt(1 - eccentricitySquared));
  const xFromOrigin = x - 500000;
  const meridionalArc = y / k0;
  const mu = meridionalArc /
    (a * (1 - eccentricitySquared / 4 - 3 * eccentricitySquared ** 2 / 64));
  const phi1 = mu +
    (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
  const sinPhi = Math.sin(phi1);
  const cosPhi = Math.cos(phi1);
  const tanPhi = Math.tan(phi1);
  const n = a / Math.sqrt(1 - eccentricitySquared * sinPhi ** 2);
  const t = tanPhi ** 2;
  const c = ePrimeSquared * cosPhi ** 2;
  const r = a * (1 - eccentricitySquared) /
    (1 - eccentricitySquared * sinPhi ** 2) ** 1.5;
  const d = xFromOrigin / (n * k0);
  const latitude = phi1 - (n * tanPhi / r) *
    (d ** 2 / 2 - (5 + 3 * t + 10 * c - 4 * c ** 2 - 9 * ePrimeSquared) * d ** 4 / 24);
  const longitude = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180 +
    (d - (1 + 2 * t + c) * d ** 3 / 6) / cosPhi;

  return fromLonLat([
    longitude * 180 / Math.PI,
    latitude * 180 / Math.PI
  ]);
};

const transformCoordinates = (coordinates) => {
  if (typeof coordinates[0] === 'number') {
    return toWebMercator(coordinates[0], coordinates[1]);
  }

  return coordinates.map(transformCoordinates);
};

const createLayer = (definition, rows, visible = false) => {
  const format = new WKT();
  const features = rows
    .map((row) => {
      if (!row.geo_wkt) return null;

      try {
        const feature = format.readFeature(row.geo_wkt);
        const geometry = feature.getGeometry();
        geometry.setCoordinates(
          transformCoordinates(geometry.getCoordinates())
        );
        feature.setProperties({
          ...row,
          gisCode: row.codigo ?? null
        });
        return feature;
      } catch (error) {
        console.warn(`Geometría inválida en capa ${definition.endpoint}.`, error);
        return null;
      }
    })
    .filter(Boolean);

  const layer = new VectorLayer({
    source: new VectorSource({ features }),
    visible,
    style: new Style({
      stroke: new Stroke({
        color: definition.color,
        width: definition.type === 'line' ? 2 : 1.5
      }),
      fill: new Fill({ color: `${definition.color}30` }),
      image: new CircleStyle({
        radius: 4,
        fill: new Fill({ color: definition.color })
      })
    })
  });

  layer.set('gisId', definition.id);
  layer.set('gisEndpoint', definition.endpoint);
  return layer;
};

const renderBuildingDetails = (container, details) => {
  if (!container) return;

  const building = details?.building?.[0] ?? details?.building;
  const alternatives = Array.isArray(details?.alternative_addresses)
    ? details.alternative_addresses
    : [];

  container.replaceChildren();

  const title = document.createElement('strong');
  title.textContent = 'Edificio seleccionado';
  container.appendChild(title);

  const values = [
    ['Código GIS', building?.codigo],
    ['Dirección', building?.direccion_completa],
    ['Municipio', building?.municipio],
    ['Año de construcción', building?.anno_construcion],
    ['Plantas', building?.plantas],
    ['Estado constructivo', building?.estado_constructivo]
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  values.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.textContent = `${label}: ${value}`;
    container.appendChild(item);
  });

  if (alternatives.length) {
    const heading = document.createElement('strong');
    heading.textContent = 'Direcciones alternativas';
    container.appendChild(heading);

    alternatives.forEach((alternative) => {
      const item = document.createElement('div');
      item.textContent = alternative.alt ?? alternative.direccion ?? '';
      container.appendChild(item);
    });
  }
};

export const addGisLayers = async (
  map,
  controlsContainer,
  detailsContainer,
  onBuildingSelected = null
) => {
  if (!map) {
    throw new Error('El mapa GIS todavía no está disponible.');
  }

  const entries = [];
  const entriesByEndpoint = new Map();

  const renderControls = () => {
    if (!controlsContainer) return;

    controlsContainer.innerHTML = `
      <strong>Capas GIS</strong>
      ${layerDefinitions.map((definition) => {
        const entry = entriesByEndpoint.get(definition.endpoint);
        const loaded = Boolean(entry?.layer);
        const loading = entry?.loading === true;
        const unavailable = entry?.error;
        const visible = entry?.visible === true;

        return `
          <label>
            <input
              type="checkbox"
              data-gis-layer="${definition.id}"
              ${visible ? 'checked' : ''}
              ${loading ? 'disabled' : ''}
            >
            ${definition.label}${loading ? ' (cargando...)' : ''}
            ${unavailable ? `<button type="button" data-gis-retry="${definition.id}">Reintentar</button>` : ''}
          </label>
        `;
      }).join('')}
    `;

    controlsContainer.querySelectorAll('[data-gis-layer]').forEach((input) => {
      input.addEventListener('change', async () => {
        const definition = layerDefinitions.find(({ id }) =>
          id === input.dataset.gisLayer
        );
        if (!definition) return;

        const current = entriesByEndpoint.get(definition.endpoint);
        if (current) {
          current.visible = input.checked;
        }

        if (input.checked && !entriesByEndpoint.get(definition.endpoint)?.layer) {
          await loadLayer(definition, true);
        }

        entriesByEndpoint.get(definition.endpoint)?.layer.setVisible(input.checked);
      });
    });

    controlsContainer.querySelectorAll('[data-gis-retry]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const definition = layerDefinitions.find(({ id }) =>
          id === button.dataset.gisRetry
        );
        if (!definition) return;

        await loadLayer(definition, true);
      });
    });
  };

  const loadLayer = async (definition, visible = false) => {
    const existing = entriesByEndpoint.get(definition.endpoint);
    if (existing?.layer || existing?.loading) return existing;

    const entry = {
      definition,
      layer: null,
      error: null,
      loading: true,
      visible
    };
    entriesByEndpoint.set(definition.endpoint, entry);
    renderControls();

    try {
      const rows = await fetchLayerData(definition.endpoint);
      entry.error = null;
      entry.layer = createLayer(definition, rows, visible);
      map.addLayer(entry.layer);
      entries.push(entry);
    } catch (error) {
      console.error(`ERROR CARGANDO CAPA GIS ${definition.endpoint}:`, error);
      entry.error = error;
    } finally {
      entry.loading = false;
      renderControls();
    }

    return entry;
  };

  renderControls();

  map.on('singleclick', async (event) => {
    let selectedFeature = null;
    let selectedLayer = null;

    map.forEachFeatureAtPixel(
      event.pixel,
      (feature, layer) => {
        if (layer?.get('gisEndpoint') === 'edificios') {
          selectedFeature = feature;
          selectedLayer = layer;
        }
      }
    );

    if (!selectedFeature || selectedLayer?.get('gisEndpoint') !== 'edificios') {
      return;
    }

    const code = selectedFeature.get('gisCode');
    if (!code || !detailsContainer) return;

    detailsContainer.textContent = 'Consultando datos del edificio...';

    try {
      const details = await fetchBuildingDetails(code);
      renderBuildingDetails(detailsContainer, details);

      if (typeof onBuildingSelected === 'function') {
        const building = details?.building?.[0] ?? details?.building;
        const address = building?.direccion_completa
          ?? building?.direccion
          ?? [building?.calle, building?.numero].filter(Boolean).join(' ');

        if (address) {
          onBuildingSelected(address, building);
        }
      }
    } catch (error) {
      detailsContainer.textContent = error.message;
    }
  });

  renderControls();
};
