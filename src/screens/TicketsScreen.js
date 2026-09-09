import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet, Alert, RefreshControl, Modal, Platform, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';

let BarCodeScanner;
if (Platform.OS !== 'web') {
  try { BarCodeScanner = require('expo-barcode-scanner').BarCodeScanner; } catch {}
}

// Event category enum values expected by the backend.
const EVENT_CATEGORIES = [
  'GENERAL',
  'VIP',
  'VVIP',
  'EARLY_BIRD',
  'STUDENT',
  'KIDS',
  'VOUCHER',
];

export default function TicketsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);

  // Event form fields
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [category, setCategory] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [totalTickets, setTotalTickets] = useState('');

  // Category dropdown open state
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Event media
  const [eventImages, setEventImages] = useState([]);
  const [eventVideos, setEventVideos] = useState([]);

  // Ticket categories modal
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [ticketModalEventId, setTicketModalEventId] = useState(null);
  const [ticketCategories, setTicketCategories] = useState([{ name: '', price: '', totalTickets: '' }]);
  const [savingCategories, setSavingCategories] = useState(false);

  // Scanner fields
  const [ticketCode, setTicketCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (user?.id) loadEvents();
  }, [user]);

  const loadEvents = async () => {
    try {
      const res = await businessService.getTickets(user.id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setEvents(list);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadEvents(); };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to select images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled && result.assets) {
      setEventImages([...eventImages, ...result.assets]);
    }
  };

  const pickVideos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to select videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (!result.canceled && result.assets) {
      setEventVideos([...eventVideos, ...result.assets]);
    }
  };

  const resetForm = () => {
    setEventName(''); setEventDate(''); setEventTime('');
    setEventLocation(''); setCategory(''); setEventDescription('');
    setTicketPrice(''); setTotalTickets('');
    setEventImages([]); setEventVideos([]);
    setEditingEvent(null); setShowForm(false);
  };

  const openEditForm = (event) => {
    setEditingEvent(event);
    setEventImages([]); setEventVideos([]);
    setEventName(event.name || event.eventName || '');
    setEventDate(event.date || event.eventDate || '');
    setEventTime(event.time || event.eventTime || '');
    setEventLocation(event.location || event.venue || '');
    // Category is an enum string. Prefer the backend's tickeCategoryType field,
    // falling back to other shapes for resilience.
    setCategory(
      event.tickeCategoryType
      || event.ticketCategoryType
      || event.category?.name
      || event.categoryName
      || (typeof event.category === 'string' ? event.category : '')
    );
    setEventDescription(event.description || '');
    setTicketPrice(String(event.ticketPrice || ''));
    setTotalTickets(String(event.totalTickets || ''));
    setShowForm(true);
  };

  const validateDate = (dateStr) => {
    if (!dateStr.trim()) return true; // optional
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr.trim())) return false;
    const inputDate = new Date(dateStr.trim() + 'T00:00:00');
    if (isNaN(inputDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate >= today;
  };

  const handleSubmit = async () => {
    if (!eventName.trim()) {
      Alert.alert('Error', 'Event name is required');
      return;
    }
    if (eventDate.trim() && !validateDate(eventDate)) {
      Alert.alert('Error', 'Event date must be a valid date (YYYY-MM-DD) today or in the future');
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        name: eventName.trim(),
        eventDate: eventDate.trim(),
        eventTime: eventTime.trim(),
        location: eventLocation.trim(),
        description: eventDescription.trim(),
        businessUserId: user.id,
      };
      // Backend field is spelled "tickeCategoryType" (per API contract).
      if (category) data.tickeCategoryType = category;
      if (ticketPrice.trim()) data.ticketPrice = Number(ticketPrice);
      if (totalTickets.trim()) data.totalTickets = Number(totalTickets);

      if (editingEvent) {
        await businessService.updateEvent(editingEvent.id, data, eventImages, eventVideos);
        Alert.alert('Success', 'Event updated');
      } else {
        await businessService.createEvent(data, eventImages, eventVideos);
        // Auto-create an EVENT post
        try {
          const postData = {
            content: `${data.name} — ${data.description || 'Join us for this exciting event!'}`,
            postType: 'EVENT',
            eventDate: data.eventDate ? `${data.eventDate}T${data.eventTime || '00:00:00'}` : '',
            eventLocation: data.location || '',
            attractionId: user?.attraction?.id,
          };
          await businessService.createPost(postData, [], []);
        } catch {}
        Alert.alert('Success', 'Event created');
      }
      resetForm();
      loadEvents();
    } catch (err) {
      Alert.alert('Error', err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (eventId) => {
    Alert.alert('Delete Event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await businessService.deleteEvent(eventId);
            loadEvents();
          } catch (err) {
            Alert.alert('Error', err.message || 'Delete failed');
          }
        }
      },
    ]);
  };

  // Ticket Categories Modal
  const openTicketModal = (eventId) => {
    setTicketModalEventId(eventId);
    setTicketCategories([{ name: '', price: '', totalTickets: '' }]);
    setTicketModalVisible(true);
  };

  const addCategoryRow = () => {
    setTicketCategories([...ticketCategories, { name: '', price: '', totalTickets: '' }]);
  };

  const removeCategoryRow = (index) => {
    if (ticketCategories.length <= 1) return;
    setTicketCategories(ticketCategories.filter((_, i) => i !== index));
  };

  const updateCategoryRow = (index, field, value) => {
    const updated = [...ticketCategories];
    updated[index] = { ...updated[index], [field]: value };
    setTicketCategories(updated);
  };

  const handleSaveCategories = async () => {
    // Validate
    for (let i = 0; i < ticketCategories.length; i++) {
      const cat = ticketCategories[i];
      if (!cat.name.trim()) {
        Alert.alert('Error', `Category ${i + 1}: Name is required`);
        return;
      }
      if (!cat.price.trim() || isNaN(Number(cat.price))) {
        Alert.alert('Error', `Category ${i + 1}: Valid price is required`);
        return;
      }
      if (!cat.totalTickets.trim() || isNaN(Number(cat.totalTickets))) {
        Alert.alert('Error', `Category ${i + 1}: Valid total tickets is required`);
        return;
      }
    }

    setSavingCategories(true);
    try {
      for (const cat of ticketCategories) {
        await businessService.addTicketCategory({
          eventId: ticketModalEventId,
          name: cat.name.trim(),
          price: Number(cat.price),
          totalTickets: Number(cat.totalTickets),
        });
      }
      // Reload the event and update the list
      const updatedEvent = await businessService.getEvent(ticketModalEventId);
      setEvents(prev => prev.map(e => e.id === ticketModalEventId ? updatedEvent : e));
      setTicketModalVisible(false);
      Alert.alert('Success', 'Ticket categories added');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save categories');
    } finally {
      setSavingCategories(false);
    }
  };

  const handleVerifyTicket = async () => {
    if (!ticketCode.trim()) {
      Alert.alert('Error', 'Please enter a ticket code');
      return;
    }
    setVerifying(true);
    setScanResult(null);
    try {
      const result = await businessService.verifyTicket(ticketCode.trim());
      setScanResult({ success: true, data: result });
    } catch (err) {
      setScanResult({ success: false, message: err.message || 'Invalid ticket' });
    } finally {
      setVerifying(false);
    }
  };

  const renderEventsTab = () => (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>Events</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { resetForm(); setShowForm(!showForm); }}
        >
          <Text style={styles.addBtnText}>{showForm ? '✕' : '+'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingEvent ? 'Edit Event' : 'Create Event'}</Text>
          <Text style={styles.fieldLabel}>Event Name</Text>
          <TextInput style={styles.input} placeholder="Event Name" placeholderTextColor="#9ca3af" value={eventName} onChangeText={setEventName} />
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" placeholderTextColor="#9ca3af" value={eventDate} onChangeText={setEventDate} />
          <Text style={styles.fieldLabel}>Time</Text>
          <TextInput style={styles.input} placeholder="Time (HH:MM)" placeholderTextColor="#9ca3af" value={eventTime} onChangeText={setEventTime} />
          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput style={styles.input} placeholder="Location" placeholderTextColor="#9ca3af" value={eventLocation} onChangeText={setEventLocation} />
          <Text style={styles.fieldLabel}>Category</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            activeOpacity={0.7}
            onPress={() => setCategoryDropdownOpen(true)}
          >
            <Text style={[styles.dropdownTriggerText, !category && styles.dropdownPlaceholder]}>
              {category || 'Select category'}
            </Text>
            <Text style={styles.dropdownCaret}>▾</Text>
          </TouchableOpacity>
          <Text style={styles.fieldLabel}>Ticket Price</Text>
          <TextInput style={styles.input} placeholder="Ticket Price" placeholderTextColor="#9ca3af" keyboardType="numeric" value={ticketPrice} onChangeText={setTicketPrice} />
          <Text style={styles.fieldLabel}>Total Tickets</Text>
          <TextInput style={styles.input} placeholder="Total Tickets" placeholderTextColor="#9ca3af" keyboardType="numeric" value={totalTickets} onChangeText={setTotalTickets} />
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={[styles.input, styles.textarea]} placeholder="Description" placeholderTextColor="#9ca3af" multiline numberOfLines={3} value={eventDescription} onChangeText={setEventDescription} />

          {/* Add Images */}
          <TouchableOpacity style={styles.mediaPickerBtn} onPress={pickImages}>
            <Text style={[styles.mediaPickerBtnText, { color: colors.primary }]}>📷 Add Images</Text>
          </TouchableOpacity>
          {eventImages.length > 0 && (
            <View style={styles.thumbnailRow}>
              {eventImages.map((img, idx) => (
                <Image key={idx} source={{ uri: img.uri }} style={styles.thumbnail} />
              ))}
            </View>
          )}

          {/* Add Video */}
          <TouchableOpacity style={styles.mediaPickerBtn} onPress={pickVideos}>
            <Text style={[styles.mediaPickerBtnText, { color: colors.primary }]}>🎥 Add Video</Text>
          </TouchableOpacity>
          {eventVideos.length > 0 && (
            <Text style={styles.videoCount}>{eventVideos.length} video(s) selected</Text>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Saving...' : 'Save Event'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <Text style={styles.loadingText}>Loading events...</Text>
      ) : events.length === 0 ? (
        <Text style={styles.emptyText}>No events created yet.</Text>
      ) : (
        events.map(event => (
          <View key={event.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{event.name || event.eventName}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEditForm(event)}><Text style={styles.editBtn}>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(event.id)}><Text style={styles.deleteBtn}>🗑️</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={styles.cardDetail}>📅 {event.eventDate || event.date || 'TBD'} at {event.eventTime || event.time || 'TBD'}</Text>
            <Text style={styles.cardDetail}>📍 {event.location || event.venue || 'TBD'}</Text>
            {(() => {
              const catLabel = event.tickeCategoryType || event.ticketCategoryType || event.category?.name || event.categoryName || (typeof event.category === 'string' ? event.category : null);
              return catLabel ? <Text style={styles.cardDetail}>🏷️ {catLabel}</Text> : null;
            })()}
            {event.soldTickets != null && <Text style={styles.cardDetail}>🎫 {event.soldTickets} tickets sold</Text>}

            {/* Existing ticket categories */}
            {event.ticketCategories && event.ticketCategories.length > 0 && (
              <View style={styles.categoriesSection}>
                <Text style={styles.categoriesTitle}>Ticket Categories:</Text>
                {event.ticketCategories.map((cat, idx) => (
                  <View key={idx} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <Text style={styles.categoryDetail}>R{cat.price} · {cat.remainingTickets ?? cat.totalTickets} remaining</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Add Tickets Button */}
            <TouchableOpacity
              style={[styles.addTicketsBtn, { borderColor: colors.primary }]}
              onPress={() => openTicketModal(event.id)}
            >
              <Text style={[styles.addTicketsBtnText, { color: colors.primary }]}>+ Add Tickets</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </>
  );

  const openQRScanner = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'QR scanner is only available on mobile devices');
      return;
    }
    if (!BarCodeScanner) {
      try { BarCodeScanner = require('expo-barcode-scanner').BarCodeScanner; } catch {}
    }
    if (!BarCodeScanner) {
      Alert.alert('Not Installed', 'QR scanner package is not installed. Please install expo-barcode-scanner.');
      return;
    }
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setCameraPermission(status === 'granted');
    if (status === 'granted') {
      setShowQRScanner(true);
    } else {
      Alert.alert('Permission Denied', 'Camera permission is required to scan QR codes');
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    setShowQRScanner(false);
    setTicketCode(data);
    // Auto-verify after scan
    setVerifying(true);
    setScanResult(null);
    businessService.verifyTicket(data.trim())
      .then(result => setScanResult({ success: true, data: result }))
      .catch(err => setScanResult({ success: false, message: err.message || 'Invalid ticket' }))
      .finally(() => setVerifying(false));
  };

  const renderScannerTab = () => (
    <View style={styles.scannerContainer}>
      <View style={styles.scanCard}>
        <View style={styles.scanHeaderRow}>
          <Text style={styles.scanTitle}>Scan & Verify</Text>
        </View>

        {/* QR Scanner Button - always show */}
        <TouchableOpacity style={[styles.qrBtn, { backgroundColor: colors.primary }]} onPress={openQRScanner}>
          <Text style={styles.qrBtnText}>📷  Scan QR Code</Text>
        </TouchableOpacity>

        <View style={styles.orDivider}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or enter manually</Text>
          <View style={styles.orLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Enter ticket code..."
          placeholderTextColor="#9ca3af"
          value={ticketCode}
          onChangeText={setTicketCode}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }]}
          onPress={handleVerifyTicket}
          disabled={verifying}
        >
          <Text style={styles.submitBtnText}>{verifying ? 'Verifying...' : 'Verify Ticket'}</Text>
        </TouchableOpacity>

        {scanResult && (
          <View style={[styles.resultCard, { borderColor: scanResult.success ? '#16a34a' : '#dc2626' }]}>
            <Text style={[styles.resultIcon, { color: scanResult.success ? '#16a34a' : '#dc2626' }]}>
              {scanResult.success ? '✓' : '✕'}
            </Text>
            <Text style={[styles.resultText, { color: scanResult.success ? '#16a34a' : '#dc2626' }]}>
              {scanResult.success ? 'Access Granted!' : scanResult.message || 'Invalid Ticket'}
            </Text>
            {scanResult.success && scanResult.data && (
              <View style={styles.resultDetails}>
                {scanResult.data.customerName && <Text style={styles.resultDetail}>Customer: {scanResult.data.customerName}</Text>}
                {scanResult.data.eventName && <Text style={styles.resultDetail}>Event: {scanResult.data.eventName}</Text>}
                {scanResult.data.categoryName && <Text style={styles.resultDetail}>Category: {scanResult.data.categoryName}</Text>}
                {scanResult.data.status && <Text style={styles.resultDetail}>Status: {scanResult.data.status}</Text>}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'‹'}</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Events & Tickets</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('events')}
          >
            <Text style={[styles.tabText, activeTab === 'events' && { color: colors.primary }]}>Events</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'scanner' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('scanner')}
          >
            <Text style={[styles.tabText, activeTab === 'scanner' && { color: colors.primary }]}>Scanner</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'events' ? renderEventsTab() : renderScannerTab()}
      </ScrollView>

      {/* QR Scanner Modal */}
      {showQRScanner && BarCodeScanner && (
        <Modal visible={showQRScanner} animationType="slide" onRequestClose={() => setShowQRScanner(false)}>
          <View style={styles.qrScannerContainer}>
            <BarCodeScanner
              onBarCodeScanned={handleBarCodeScanned}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.qrOverlay}>
              <View style={styles.qrFrame} />
            </View>
            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setShowQRScanner(false)}>
              <Text style={styles.qrCloseBtnText}>Close Scanner</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Category dropdown Modal */}
      <Modal
        visible={categoryDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setCategoryDropdownOpen(false)}
        >
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownMenuTitle}>Select Category</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {EVENT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.dropdownOption}
                  onPress={() => { setCategory(cat); setCategoryDropdownOpen(false); }}
                >
                  <Text style={[styles.dropdownOptionText, category === cat && { color: colors.primary, fontWeight: '700' }]}>
                    {cat}
                  </Text>
                  {category === cat && <Text style={[styles.dropdownCheck, { color: colors.primary }]}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Ticket Categories Modal */}
      <Modal
        visible={ticketModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTicketModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Ticket Categories</Text>
              <TouchableOpacity onPress={() => setTicketModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {ticketCategories.map((cat, index) => (
                <View key={index} style={styles.categoryFormRow}>
                  <View style={styles.categoryFormHeader}>
                    <Text style={styles.categoryFormLabel}>Category {index + 1}</Text>
                    {ticketCategories.length > 1 && (
                      <TouchableOpacity onPress={() => removeCategoryRow(index)}>
                        <Text style={styles.removeCatBtn}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Category Name (e.g. VIP, General)"
                    placeholderTextColor="#9ca3af"
                    value={cat.name}
                    onChangeText={(val) => updateCategoryRow(index, 'name', val)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Price"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={cat.price}
                    onChangeText={(val) => updateCategoryRow(index, 'price', val)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Total Tickets"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={cat.totalTickets}
                    onChangeText={(val) => updateCategoryRow(index, 'totalTickets', val)}
                  />
                </View>
              ))}

              <TouchableOpacity style={styles.addRowBtn} onPress={addCategoryRow}>
                <Text style={[styles.addRowBtnText, { color: colors.primary }]}>+ Add Another Category</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={handleSaveCategories}
              disabled={savingCategories}
            >
              <Text style={styles.submitBtnText}>{savingCategories ? 'Saving...' : 'Save Categories'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  tabRow: { flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  formCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  formTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10 },
  dropdownTriggerText: { fontSize: 14, color: '#111827', fontWeight: '600' },
  dropdownPlaceholder: { color: '#9ca3af', fontWeight: '400' },
  dropdownCaret: { fontSize: 12, color: '#6b7280' },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dropdownMenu: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, width: '100%', maxWidth: 340 },
  dropdownMenuTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', paddingHorizontal: 16, paddingVertical: 8 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  dropdownOptionText: { fontSize: 15, color: '#111827' },
  dropdownCheck: { fontSize: 16, fontWeight: '700' },
  mediaPickerBtn: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 6, marginBottom: 8, borderStyle: 'dashed' },
  mediaPickerBtnText: { fontSize: 14, fontWeight: '600' },
  thumbnailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  thumbnail: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#e5e7eb' },
  videoCount: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 8 },
  submitBtn: { marginTop: 6, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 10 },
  editBtn: { fontSize: 16 },
  deleteBtn: { fontSize: 16 },
  cardDetail: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  categoriesSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  categoriesTitle: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  categoryName: { fontSize: 12, fontWeight: '500', color: '#111827' },
  categoryDetail: { fontSize: 11, color: '#6b7280' },
  addTicketsBtn: { marginTop: 10, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  addTicketsBtnText: { fontSize: 13, fontWeight: '600' },
  scannerContainer: { paddingTop: 4 },
  scanCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  scanHeaderRow: { marginBottom: 16 },
  scanTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  scanLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 10 },
  qrBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  qrBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  orDivider: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  orText: { paddingHorizontal: 12, fontSize: 12, color: '#9ca3af' },
  resultCard: { marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  resultIcon: { fontSize: 40, marginBottom: 8 },
  resultText: { fontSize: 16, fontWeight: '600' },
  resultDetails: { marginTop: 10, width: '100%' },
  resultDetail: { fontSize: 13, color: '#374151', marginBottom: 4 },
  // QR Scanner modal
  qrScannerContainer: { flex: 1, backgroundColor: '#000' },
  qrOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  qrFrame: { width: 250, height: 250, borderWidth: 2, borderColor: '#fff', borderRadius: 16 },
  qrCloseBtn: { position: 'absolute', bottom: 60, alignSelf: 'center', backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  qrCloseBtnText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 22, color: '#6b7280', padding: 4 },
  modalScroll: { maxHeight: 400 },
  categoryFormRow: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  categoryFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryFormLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  removeCatBtn: { fontSize: 12, color: '#dc2626', fontWeight: '500' },
  addRowBtn: { paddingVertical: 12, alignItems: 'center' },
  addRowBtnText: { fontSize: 14, fontWeight: '600' },
});
