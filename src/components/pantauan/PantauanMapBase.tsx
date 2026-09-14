'use client'

import { useEffect, useRef } from 'react'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import { fromLonLat } from 'ol/proj'
import { defaults as defaultControls } from 'ol/control'
import 'ol/ol.css'

interface PantauanMapBaseProps {
  /** Center koordinat [lon, lat] dalam WGS84. Default: center Indonesia */
  center?: [number, number]
  /** Zoom level awal. Default: 5 */
  zoom?: number
  /** Tinggi container. Default: 480px */
  height?: string
  /** Callback setelah map terinisialisasi — bisa dipakai untuk menambah layer */
  onMapReady?: (map: OlMap) => void
  /** Class tambahan untuk container */
  className?: string
}

/**
 * Base OpenLayers map wrapper yang bisa dipakai semua halaman PANTAUAN.
 * Layer tambahan (titik gempa, hotspot, choropleth, dsb) ditambahkan
 * melalui callback `onMapReady`.
 */
export default function PantauanMapBase({
  center = [117.5, -1.5], // Tengah Indonesia
  zoom = 5,
  height = '480px',
  onMapReady,
  className = '',
}: PantauanMapBaseProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<OlMap | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = new OlMap({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat(center),
        zoom,
        minZoom: 3,
        maxZoom: 18,
      }),
      controls: defaultControls({ attribution: true, zoom: true }),
    })

    mapInstance.current = map

    if (onMapReady) {
      onMapReady(map)
    }

    return () => {
      map.setTarget(undefined as any)
      mapInstance.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={mapRef}
      className={`w-full ${className}`}
      style={{ height }}
    />
  )
}
