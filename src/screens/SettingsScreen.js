import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import LocationPicker from '../components/LocationPicker';
import KeyboardAwareScroll from '../components/KeyboardAwareScroll';
import AppIcon from '../components/AppIcon';
import { appendFilePart } from '../utils/fileUpload';

export default function SettingsScreen() {
  const { user, updateUser, logout } = useContext(AuthContext);
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('');
  const [weekdayHours, setWeekdayHours] = useState('');
  const [weekendHours, setWeekendHours] = useState('');
  const [weekdayDays, setWeekdayDays] = useState('');
  const [weekendDays, setWeekendDays] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setDescription(user.description || '');
      setEmail(user.email || '');
      setPhone(user.contactNumber || user.phone || '');
      setLocation(user.location || '');
      setLatitude(user.latitude || null);
      setLongitude(user.longitude || null);
      setCompanyRegistrationNumber(user.companyRegistrationNumber || '');
      setAvailabilityStatus(user.availabilityStatus || '');
      setWeekdayHours(user.operating_hours?.week_days || user.operatingHours || '');
      setWeekendHours(user.operating_hours?.week_ends || '');
      setWeekdayDays(user.operating_days?.week_days || user.operatingDays || '');
      setWeekendDays(user.operating_days?.week_ends || '');
      setVerificationStatus(user.verificationStatus || user.verification_status || 'Not Verified');
    }
  }, [user]);

  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      try {
        const file = result.assets[0];
        const formData = new FormData();
        await appendFilePart(formData, 'file', file, { fallbackName: 'cover.jpg' });
        const res = await businessService.uploadCover(formData);
        await updateUser({ background_image: res.background_image || file.uri });
        Alert.alert('Success', 'Cover image updated');
      } catch (err) {
        Alert.alert('Error', err.message || 'Failed to upload cover');
      }
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      try {
        const file = result.assets[0];
        const formData = new FormData();
        await appendFilePart(formData, 'file', file, { fallbackName: 'logo.jpg' });
        const res = await businessService.uploadLogo(formData);
        await updateUser({ logo: res.logo || file.uri });
        Alert.alert('Success', 'Profile photo updated');
      } catch (err) {
        Alert.alert('Error', err.message || 'Failed to upload photo');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileData = {
        name: name.trim(),
        description: description.trim(),
        email: email.trim(),
        contactNumber: phone.trim(),
        location: location.trim(),
        latitude,
        longitude,
        companyRegistrationNumber: companyRegistrationNumber.trim(),
        availabilityStatus: availabilityStatus.trim(),
        operating_hours: { week_days: weekdayHours.trim(), week_ends: weekendHours.trim() },
        operating_days: { week_days: weekdayDays.trim(), week_ends: weekendDays.trim() },
        attraction: { id: user?.attraction?.id },
      };
      await businessService.updateProfile(profileData);
      await updateUser(profileData);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate Profile',
      'Are you sure? Your business will be hidden from customers.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: async () => {
          try { await businessService.deleteAccount(); await logout(); }
          catch (err) { Alert.alert('Error', err.message || 'Failed to deactivate'); }
        }},
      ]
    );
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() || 'B';

  return (
    <KeyboardAwareScroll style={styles.screen}>
      {/* Facebook-style cover + avatar */}
      <View style={styles.coverContainer}>
        <TouchableOpacity onPress={pickCover} activeOpacity={0.8}>
          {user?.background_image ? (
            <Image source={{ uri: user.background_image }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: colors.primary + '30' }]}>
              <Text style={styles.coverPlaceholderText}>Tap to add cover photo</Text>
            </View>
          )}
          <View style={styles.coverEditBadge}>
            <AppIcon name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Avatar overlapping cover */}
        <View style={styles.avatarWrapper}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
            {user?.logo ? (
              <Image source={{ uri: user.logo }} style={[styles.avatar, { borderColor: colors.primary }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.light, borderColor: colors.primary }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <AppIcon name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Name & category below avatar */}
      <View style={styles.profileInfoSection}>
        <Text style={styles.profileName}>{user?.name || 'Business'}</Text>
        <Text style={styles.profileCategory}>{user?.attraction?.name || ''}</Text>
      </View>

      {/* Form */}
      <View style={styles.formCard}>
        <Text style={styles.sectionHeader}>Business Info</Text>

        <Text style={styles.label}>Business Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Business name" placeholderTextColor="#9ca3af" />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor="#9ca3af" multiline />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />

        <Text style={styles.label}>Location</Text>
        <LocationPicker
          value={location}
          latitude={latitude}
          longitude={longitude}
          onChange={(addr, lat, lng) => { setLocation(addr); setLatitude(lat); setLongitude(lng); }}
          accentColor={colors.primary}
        />

        <Text style={styles.label}>Company Registration Number</Text>
        <TextInput style={styles.input} value={companyRegistrationNumber} onChangeText={setCompanyRegistrationNumber} placeholder="Registration number" placeholderTextColor="#9ca3af" />

        <Text style={styles.label}>Availability Status</Text>
        <TextInput style={styles.input} value={availabilityStatus} onChangeText={setAvailabilityStatus} placeholder="Open / Closed" placeholderTextColor="#9ca3af" />

        <Text style={styles.label}>Verification Status</Text>
        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyText}>{verificationStatus}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionHeader}>Operating Schedule</Text>

        <Text style={styles.label}>Weekday Hours</Text>
        <TextInput style={styles.input} value={weekdayHours} onChangeText={setWeekdayHours} placeholder="e.g. 08:00 - 17:00" placeholderTextColor="#9ca3af" />

        <Text style={styles.label}>Weekend Hours</Text>
        <TextInput style={styles.input} value={weekendHours} onChangeText={setWeekendHours} placeholder="e.g. 09:00 - 14:00" placeholderTextColor="#9ca3af" />

        <Text style={styles.label}>Weekday Days</Text>
        <TextInput style={styles.input} value={weekdayDays} onChangeText={setWeekdayDays} placeholder="e.g. Monday - Friday" placeholderTextColor="#9ca3af" />

        <Text style={styles.label}>Weekend Days</Text>
        <TextInput style={styles.input} value={weekendDays} onChangeText={setWeekendDays} placeholder="e.g. Saturday - Sunday" placeholderTextColor="#9ca3af" />
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
      </TouchableOpacity>

      {/* Deactivate */}
      <TouchableOpacity style={styles.deactivateBtn} onPress={handleDeactivate}>
        <Text style={styles.deactivateText}>Deactivate Profile</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </KeyboardAwareScroll>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef' },

  // Cover + Avatar (Facebook style)
  coverContainer: { position: 'relative', marginBottom: 50 },
  coverImage: { width: '100%', height: 160, backgroundColor: '#e5e7eb' },
  coverPlaceholder: { width: '100%', height: 160, alignItems: 'center', justifyContent: 'center' },
  coverPlaceholderText: { color: '#6b7280', fontSize: 13 },
  coverEditBadge: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: '#fff', width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  coverEditIcon: { fontSize: 14 },

  avatarWrapper: {
    position: 'absolute', bottom: -44, left: 16,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: 'bold' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#fff', width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  avatarEditIcon: { fontSize: 13 },

  // Profile info
  profileInfoSection: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  profileCategory: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Form
  formCard: { backgroundColor: '#fff', marginTop: 8, padding: 16 },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#6b7280', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  readOnlyField: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, backgroundColor: '#f3f4f6' },
  readOnlyText: { fontSize: 14, color: '#6b7280' },

  // Buttons
  saveBtn: { marginHorizontal: 16, marginTop: 16, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deactivateBtn: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  deactivateText: { color: '#dc2626', fontWeight: '600', fontSize: 14 },
});
