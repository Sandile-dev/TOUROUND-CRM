import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as Location from 'expo-location';
import AppIcon from './AppIcon';

let MapView, Marker;
// Only import react-native-maps on native platforms
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
  } catch {}
}

/**
 * Uber-style location picker with interactive map.
 * Props:
 * - value: string (address text)
 * - latitude: number | null
 * - longitude: number | null
 * - onChange: (address, lat, lng) => void
 * - accentColor: string
 */
export default function LocationPicker({ value, latitude, longitude, onChange, accentColor = '#0d9488' }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState({
    latitude: latitude || -26.2041,
    longitude: longitude || 28.0473,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [pin, setPin] = useState(
    latitude && longitude ? { latitude, longitude } : null
  );
  const [address, setAddress] = useState(value || '');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (latitude && longitude) {
      setRegion(prev => ({ ...prev, latitude, longitude }));
      setPin({ latitude, longitude });
    }
  }, [latitude, longitude]);

  const getCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoadingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      const newRegion = { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      setRegion(newRegion);
      setPin({ latitude: lat, longitude: lng });
      if (mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(newRegion, 500);
      }

      // Reverse geocode
      const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo) {
        const addr = [geo.streetNumber, geo.street, geo.city, geo.region].filter(Boolean).join(', ');
        setAddress(addr);
        onChange(addr, lat, lng);
      } else {
        onChange(address, lat, lng);
      }
    } catch {} finally {
      setLoadingLocation(false);
    }
  };

  const handleMapPress = async (e) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setPin({ latitude: lat, longitude: lng });

    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo) {
        const addr = [geo.streetNumber, geo.street, geo.city, geo.region].filter(Boolean).join(', ');
        setAddress(addr);
        onChange(addr, lat, lng);
      } else {
        onChange(address, lat, lng);
      }
    } catch {
      onChange(address, lat, lng);
    }
  };

  const handleAddressChange = (text) => {
    setAddress(text);
    onChange(text, pin?.latitude || null, pin?.longitude || null);
  };

  const canShowMap = Platform.OS !== 'web' && MapView;

  return (
    <View style={styles.container}>
      {/* Address input */}
      <View style={styles.inputRow}>
        <View style={styles.inputIconWrap}>
          <View style={[styles.inputDot, { backgroundColor: accentColor }]} />
        </View>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={handleAddressChange}
          placeholder="Enter your business address"
          placeholderTextColor="#9ca3af"
          onFocus={() => { if (canShowMap) setExpanded(true); }}
        />
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.locateBtn, { backgroundColor: accentColor }]} onPress={getCurrentLocation} disabled={loadingLocation}>
          {loadingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.locateBtnInner}>
              <AppIcon name="locate-outline" size={16} color="#fff" />
              <Text style={styles.locateBtnText}>Use my location</Text>
            </View>
          )}
        </TouchableOpacity>
        {canShowMap && (
          <TouchableOpacity style={styles.toggleBtn} onPress={() => setExpanded(!expanded)}>
            <Text style={styles.toggleBtnText}>{expanded ? 'Hide map' : 'Show map'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Map (native only) */}
      {expanded && canShowMap && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            region={region}
            onRegionChangeComplete={setRegion}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {pin && (
              <Marker
                coordinate={pin}
                draggable
                onDragEnd={(e) => handleMapPress(e)}
              />
            )}
          </MapView>

          {/* Recenter button */}
          <TouchableOpacity
            style={[styles.recenterBtn, { backgroundColor: accentColor }]}
            onPress={getCurrentLocation}
          >
            <Text style={styles.recenterIcon}>◎</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selected coordinates */}
      {pin && (
        <Text style={styles.coordsText}>
          {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#f9fafb', overflow: 'hidden' },
  inputIconWrap: { paddingLeft: 12, paddingRight: 4 },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  input: { flex: 1, padding: 12, fontSize: 14, color: '#111827' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  locateBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  locateBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locateBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: '#f3f4f6' },
  toggleBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  mapContainer: { marginTop: 10, borderRadius: 12, overflow: 'hidden', height: 220, position: 'relative' },
  map: { flex: 1 },
  recenterBtn: { position: 'absolute', bottom: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  recenterIcon: { color: '#fff', fontSize: 18 },
  coordsText: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
});
