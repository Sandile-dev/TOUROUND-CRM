import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, Image, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import businessService from '../api/businessService';
import useRefreshOnFocus from '../hooks/useRefreshOnFocus';
import { resolveCategory, usesRoomBookings, usesTableReservations } from '../constants/attractions';

const ROOM_TYPES = ['SINGLE', 'DOUBLE', 'SUITE', 'TRIPLE', 'DELUXE'];

export default function ServicesScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const { showSuccess, showError, showConfirm } = useAlert();
  const attractionId = resolveCategory(user?.attraction);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Room fields
  const [roomType, setRoomType] = useState('');
  const [roomTypeDropdownOpen, setRoomTypeDropdownOpen] = useState(false);
  const [pricePerNight, setPricePerNight] = useState('');
  const [adultCapacity, setAdultCapacity] = useState('');
  const [childCapacity, setChildCapacity] = useState('');
  const [totalNumberOfRooms, setTotalNumberOfRooms] = useState('');
  const [roomDescription, setRoomDescription] = useState('');

  // Table fields
  const [capacity, setCapacity] = useState('');
  const [totalNumberOfTables, setTotalNumberOfTables] = useState('');
  const [upfrontPaymentRequired, setUpfrontPaymentRequired] = useState(false);
  const [tablePrice, setTablePrice] = useState('');
  const [tableDescription, setTableDescription] = useState('');
  const [tableAddOns, setTableAddOns] = useState('');

  // Slot fields
  const [description, setDescription] = useState('');
  const [slotCapacity, setSlotCapacity] = useState('');
  const [duration, setDuration] = useState('');
  const [listOfServices, setListOfServices] = useState('');
  const [slotPrice, setSlotPrice] = useState('');
  const [slotUpfrontPayment, setSlotUpfrontPayment] = useState(false);
  const [slotAddOns, setSlotAddOns] = useState('');

  // Images and videos for all service types
  const [serviceImages, setServiceImages] = useState([]);
  const [serviceVideos, setServiceVideos] = useState([]);

  useEffect(() => {
    if (user?.id) loadItems();
  }, [user]);

  const getServiceType = () => {
    if (usesRoomBookings(attractionId)) return 'rooms';
    if (usesTableReservations(attractionId)) return 'tables';
    return 'slots';
  };

  const loadItems = async () => {
    try {
      let res;
      if (usesRoomBookings(attractionId)) {
        res = await businessService.getRooms(user.id);
      } else if (usesTableReservations(attractionId)) {
        res = await businessService.getTables(user.id);
      } else {
        res = await businessService.getSlots(user.id);
      }
      const list = Array.isArray(res) ? res : res?.content || [];
      setItems(list);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadItems(); };

  useRefreshOnFocus(useCallback(() => { resetForm(); loadItems(); }, [user]));

  const resetForm = () => {
    setRoomType(''); setPricePerNight(''); setAdultCapacity(''); setChildCapacity(''); setTotalNumberOfRooms(''); setRoomDescription('');
    setCapacity(''); setTotalNumberOfTables(''); setUpfrontPaymentRequired(false); setTablePrice(''); setTableDescription(''); setTableAddOns('');
    setDescription(''); setSlotCapacity(''); setDuration(''); setListOfServices(''); setSlotPrice(''); setSlotUpfrontPayment(false); setSlotAddOns('');
    setServiceImages([]);
    setServiceVideos([]);
    setEditingItem(null);
    setShowForm(false);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setShowForm(true);
    setServiceImages([]);
    setServiceVideos([]);
    if (usesRoomBookings(attractionId)) {
      setRoomType(item.roomType || '');
      setPricePerNight(String(item.pricePerNight || ''));
      setAdultCapacity(String(item.adultCapacity || ''));
      setChildCapacity(String(item.childCapacity || ''));
      setTotalNumberOfRooms(String(item.totalNumberOfRooms || ''));
      setRoomDescription(item.description || '');
    } else if (usesTableReservations(attractionId)) {
      setCapacity(String(item.capacity || ''));
      setTotalNumberOfTables(String(item.totalNumberOfTables || ''));
      setUpfrontPaymentRequired(item.upfrontPaymentRequired || false);
      setTablePrice(String(item.tablePrice || ''));
      setTableDescription(item.description || '');
      setTableAddOns(Array.isArray(item.addOns) ? item.addOns.join(', ') : (item.addOns || ''));
    } else {
      setDescription(item.description || '');
      setSlotCapacity(String(item.capacity || ''));
      // Backend stores duration in minutes; the form edits in hours.
      setDuration(item.duration ? String(item.duration / 60) : '');
      setListOfServices(Array.isArray(item.listOfServices) ? item.listOfServices.join(', ') : (item.listOfServices || ''));
      setSlotPrice(String(item.slotPrice || ''));
      setSlotUpfrontPayment(item.upfrontPaymentRequired || false);
      setSlotAddOns(Array.isArray(item.addOns) ? item.addOns.join(', ') : (item.addOns || ''));
    }
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Permission Required', 'Please allow access to your photo library to select images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled && result.assets) {
      setServiceImages([...serviceImages, ...result.assets]);
    }
  };

  const pickVideos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Permission Required', 'Please allow access to your photo library to select videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.8 });
    if (!result.canceled && result.assets) {
      setServiceVideos([...serviceVideos, ...result.assets]);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (usesRoomBookings(attractionId)) {
        const parsedPricePerNight = parseFloat(pricePerNight);
        const data = {
          roomType,
          // Backend expects a raw decimal number.
          pricePerNight: Number.isFinite(parsedPricePerNight) ? parsedPricePerNight : 0,
          adultCapacity: Number(adultCapacity),
          childCapacity: childCapacity ? Number(childCapacity) : 0,
          totalNumberOfRooms: Number(totalNumberOfRooms),
          description: roomDescription.trim(),
          businessUserId: user.id,
        };
        if (editingItem) {
          await businessService.updateRoom({ ...data, id: editingItem.id }, serviceImages);
        } else {
          await businessService.createRoom(data, serviceImages, serviceVideos);
        }
      } else if (usesTableReservations(attractionId)) {
        const addOnsArray = tableAddOns.trim() ? tableAddOns.split(',').map(s => s.trim()).filter(Boolean) : [];
        const parsedTablePrice = parseFloat(tablePrice);
        const data = {
          capacity: Number(capacity), totalNumberOfTables: Number(totalNumberOfTables),
          upfrontPaymentRequired,
          // Backend expects a raw decimal number.
          tablePrice: Number.isFinite(parsedTablePrice) ? parsedTablePrice : 0,
          description: tableDescription.trim(),
          addOns: addOnsArray,
          businessUserId: user.id,
        };
        if (editingItem) {
          await businessService.updateTable(editingItem.id, data);
        } else {
          await businessService.createTable(data, serviceImages);
        }
      } else {
        const addOnsArray = slotAddOns.trim() ? slotAddOns.split(',').map(s => s.trim()).filter(Boolean) : [];
        const servicesArray = listOfServices.trim() ? listOfServices.split(',').map(s => s.trim()).filter(Boolean) : [];
        const data = {
          description, capacity: Number(slotCapacity),
          // Duration is entered in hours; backend stores minutes.
          duration: duration ? Math.round(Number(duration) * 60) : 0,
          listOfServices: servicesArray,
          // Backend expects a raw decimal number.
          slotPrice: Number.isFinite(parseFloat(slotPrice)) ? parseFloat(slotPrice) : 0,
          upfrontPaymentRequired: slotUpfrontPayment,
          availabilityStatus: 'available',
          addOns: addOnsArray,
          businessUserId: user.id,
        };
        if (editingItem) {
          await businessService.updateSlot(editingItem.id, data);
        } else {
          await businessService.createSlot(data, serviceImages);
        }
      }
      resetForm();
      loadItems();
      showSuccess('Success', editingItem ? 'Updated successfully' : 'Created successfully');
    } catch (err) {
      showError('Error', err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item) => {
    showConfirm('Delete', 'Are you sure you want to delete this?', async () => {
      try {
        if (usesRoomBookings(attractionId)) await businessService.deleteRoom(item.id);
        else if (usesTableReservations(attractionId)) await businessService.deleteTable(item.id);
        else await businessService.deleteSlot(item.id);
        loadItems();
      } catch (err) {
        showError('Error', err.message || 'Delete failed');
      }
    }, 'Delete', 'Cancel');
  };

  const renderForm = () => {
    if (usesRoomBookings(attractionId)) {
      return (
        <>
          <Text style={styles.fieldLabel}>Room Type</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            activeOpacity={0.7}
            onPress={() => setRoomTypeDropdownOpen(true)}
          >
            <Text style={[styles.dropdownTriggerText, !roomType && styles.dropdownPlaceholder]}>
              {roomType || 'Select room type'}
            </Text>
            <Text style={styles.dropdownCaret}>▾</Text>
          </TouchableOpacity>
          <Modal
            visible={roomTypeDropdownOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setRoomTypeDropdownOpen(false)}
          >
            <TouchableOpacity
              style={styles.dropdownOverlay}
              activeOpacity={1}
              onPress={() => setRoomTypeDropdownOpen(false)}
            >
              <View style={styles.dropdownMenu}>
                <Text style={styles.dropdownMenuTitle}>Select Room Type</Text>
                {ROOM_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.dropdownOption}
                    onPress={() => { setRoomType(type); setRoomTypeDropdownOpen(false); }}
                  >
                    <Text style={[styles.dropdownOptionText, roomType === type && { color: colors.primary, fontWeight: '700' }]}>
                      {type}
                    </Text>
                    {roomType === type && <Text style={[styles.dropdownCheck, { color: colors.primary }]}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={styles.input} placeholder="Description" placeholderTextColor="#9ca3af" value={roomDescription} onChangeText={setRoomDescription} multiline />
          <Text style={styles.fieldLabel}>Price Per Night</Text>
          <TextInput style={styles.input} placeholder="Price Per Night" placeholderTextColor="#9ca3af" keyboardType="numeric" value={pricePerNight} onChangeText={setPricePerNight} />
          <Text style={styles.fieldLabel}>Adult Capacity</Text>
          <TextInput style={styles.input} placeholder="Adult Capacity" placeholderTextColor="#9ca3af" keyboardType="numeric" value={adultCapacity} onChangeText={setAdultCapacity} />
          <Text style={styles.fieldLabel}>Child Capacity</Text>
          <TextInput style={styles.input} placeholder="Child Capacity" placeholderTextColor="#9ca3af" keyboardType="numeric" value={childCapacity} onChangeText={setChildCapacity} />
          <Text style={styles.fieldLabel}>Total Number of Rooms</Text>
          <TextInput style={styles.input} placeholder="Total Number of Rooms" placeholderTextColor="#9ca3af" keyboardType="numeric" value={totalNumberOfRooms} onChangeText={setTotalNumberOfRooms} />
        </>
      );
    } else if (usesTableReservations(attractionId)) {
      return (
        <>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={styles.input} placeholder="Description" placeholderTextColor="#9ca3af" value={tableDescription} onChangeText={setTableDescription} multiline />
          <Text style={styles.fieldLabel}>Capacity</Text>
          <TextInput style={styles.input} placeholder="Capacity" placeholderTextColor="#9ca3af" keyboardType="numeric" value={capacity} onChangeText={setCapacity} />
          <Text style={styles.fieldLabel}>Total Number of Tables</Text>
          <TextInput style={styles.input} placeholder="Total Number of Tables" placeholderTextColor="#9ca3af" keyboardType="numeric" value={totalNumberOfTables} onChangeText={setTotalNumberOfTables} />
          <Text style={styles.fieldLabel}>Table Price</Text>
          <TextInput style={styles.input} placeholder="Table Price" placeholderTextColor="#9ca3af" keyboardType="numeric" value={tablePrice} onChangeText={setTablePrice} />
          <Text style={styles.fieldLabel}>Add-Ons</Text>
          <TextInput style={styles.input} placeholder="Add-Ons (comma separated)" placeholderTextColor="#9ca3af" value={tableAddOns} onChangeText={setTableAddOns} />
          <TouchableOpacity style={styles.toggleRow} onPress={() => setUpfrontPaymentRequired(!upfrontPaymentRequired)}>
            <Text style={styles.toggleLabel}>Upfront Payment Required</Text>
            <View style={[styles.toggle, upfrontPaymentRequired && { backgroundColor: colors.primary }]}>
              <Text style={styles.toggleText}>{upfrontPaymentRequired ? 'Yes' : 'No'}</Text>
            </View>
          </TouchableOpacity>
        </>
      );
    } else {
      return (
        <>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={styles.input} placeholder="Description" placeholderTextColor="#9ca3af" value={description} onChangeText={setDescription} />
          <Text style={styles.fieldLabel}>Capacity</Text>
          <TextInput style={styles.input} placeholder="Capacity" placeholderTextColor="#9ca3af" keyboardType="numeric" value={slotCapacity} onChangeText={setSlotCapacity} />
          <Text style={styles.fieldLabel}>Duration (hours)</Text>
          <TextInput style={styles.input} placeholder="Duration (hours)" placeholderTextColor="#9ca3af" keyboardType="numeric" value={duration} onChangeText={setDuration} />
          <Text style={styles.fieldLabel}>List of Services</Text>
          <TextInput style={styles.input} placeholder="List of Services (comma separated)" placeholderTextColor="#9ca3af" value={listOfServices} onChangeText={setListOfServices} />
          <Text style={styles.fieldLabel}>Slot Price</Text>
          <TextInput style={styles.input} placeholder="Slot Price" placeholderTextColor="#9ca3af" keyboardType="numeric" value={slotPrice} onChangeText={setSlotPrice} />
          <Text style={styles.fieldLabel}>Add-Ons</Text>
          <TextInput style={styles.input} placeholder="Add-Ons (comma separated)" placeholderTextColor="#9ca3af" value={slotAddOns} onChangeText={setSlotAddOns} />
          <TouchableOpacity style={styles.toggleRow} onPress={() => setSlotUpfrontPayment(!slotUpfrontPayment)}>
            <Text style={styles.toggleLabel}>Upfront Payment Required</Text>
            <View style={[styles.toggle, slotUpfrontPayment && { backgroundColor: colors.primary }]}>
              <Text style={styles.toggleText}>{slotUpfrontPayment ? 'Yes' : 'No'}</Text>
            </View>
          </TouchableOpacity>
        </>
      );
    }
  };

  const renderImageThumbnails = (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return null;
    return (
      <View style={styles.thumbnailRow}>
        {imageUrls.map((url, idx) => (
          <Image key={idx} source={{ uri: url }} style={styles.thumbnail} />
        ))}
      </View>
    );
  };

  const renderAddOnsChips = (addOns) => {
    const list = Array.isArray(addOns) ? addOns : (typeof addOns === 'string' && addOns ? addOns.split(',').map(s => s.trim()) : []);
    if (list.length === 0) return null;
    return (
      <View style={styles.chipsRow}>
        {list.map((addon, idx) => (
          <View key={idx} style={[styles.chip, { backgroundColor: colors.light || '#e0f2fe' }]}>
            <Text style={[styles.chipText, { color: colors.primary }]}>{addon}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderServicesChips = (services) => {
    const list = Array.isArray(services) ? services : (typeof services === 'string' && services ? services.split(',').map(s => s.trim()) : []);
    if (list.length === 0) return null;
    return (
      <View style={styles.chipsRow}>
        {list.map((svc, idx) => (
          <View key={idx} style={[styles.chip, { backgroundColor: '#f3e8ff' }]}>
            <Text style={[styles.chipText, { color: '#7c3aed' }]}>{svc}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderItem = (item) => {
    if (usesRoomBookings(attractionId)) {
      return (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primary + '15' }]}>
                <Text style={{ fontSize: 16 }}>🛏️</Text>
              </View>
              <Text style={[styles.cardTitle, { flex: 1 }]}>{item.roomType || 'Room'}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditForm(item)}>
                  <Text style={[styles.actionIcon, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleDelete(item)}>
                  <Text style={[styles.actionIcon, { color: '#dc2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            {item.description ? <Text style={styles.cardSubtitle} numberOfLines={2}>{item.description}</Text> : null}
          </View>
          <View style={styles.cardBody}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>R{item.pricePerNight || 0}/night</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Capacity</Text>
              <Text style={styles.detailValue}>{item.adultCapacity || 0} adults{item.childCapacity ? `, ${item.childCapacity} children` : ''}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Rooms</Text>
              <Text style={styles.detailValue}>{item.totalNumberOfRooms || 0}</Text>
            </View>
          </View>
          {renderImageThumbnails(item.imageUrls)}
        </View>
      );
    } else if (usesTableReservations(attractionId)) {
      return (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primary + '15' }]}>
                <Text style={{ fontSize: 16 }}>🍽️</Text>
              </View>
              <Text style={[styles.cardTitle, { flex: 1 }]}>Table · {item.capacity || 0} seats</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditForm(item)}>
                  <Text style={[styles.actionIcon, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleDelete(item)}>
                  <Text style={[styles.actionIcon, { color: '#dc2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            {item.description ? <Text style={styles.cardSubtitle} numberOfLines={2}>{item.description}</Text> : null}
          </View>
          <View style={styles.cardBody}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Tables</Text>
              <Text style={styles.detailValue}>{item.totalNumberOfTables || 0}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>R{item.tablePrice || 0}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment</Text>
              <Text style={styles.detailValue}>{item.upfrontPaymentRequired ? 'Upfront required' : 'On arrival'}</Text>
            </View>
          </View>
          {renderAddOnsChips(item.addOns)}
          {renderImageThumbnails(item.imageUrls)}
        </View>
      );
    } else {
      return (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { flex: 1 }]}>{item.description || 'Service Slot'}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEditForm(item)}>
                  <Text style={[styles.actionIcon, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleDelete(item)}>
                  <Text style={[styles.actionIcon, { color: '#dc2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            {renderServicesChips(item.listOfServices)}
          </View>
          <View style={styles.cardBody}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Capacity</Text>
              <Text style={styles.detailValue}>{item.capacity || 0} guests</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{item.duration ? (item.duration / 60) : 0} hr</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>R{item.slotPrice || 0}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment</Text>
              <Text style={styles.detailValue}>{item.upfrontPaymentRequired ? 'Upfront required' : 'On arrival'}</Text>
            </View>
          </View>
          {renderAddOnsChips(item.addOns)}
          {renderImageThumbnails(item.imageUrls)}
        </View>
      );
    }
  };

  const serviceLabel = getServiceType() === 'rooms' ? 'Rooms' : getServiceType() === 'tables' ? 'Tables' : 'Slots';
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Header with back arrow */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Service Management</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { resetForm(); setShowForm(!showForm); }}
        >
          <Text style={styles.addBtnText}>{showForm ? '✕' : '+'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingItem ? 'Edit' : 'Add'} {serviceLabel.slice(0, -1)}</Text>
          {renderForm()}

          {/* Add Images button */}
          <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImages}>
            <Text style={[styles.imagePickerBtnText, { color: colors.primary }]}>📷 Add Images</Text>
          </TouchableOpacity>
          {serviceImages.length > 0 && (
            <View style={styles.thumbnailRow}>
              {serviceImages.map((img, idx) => (
                <Image key={idx} source={{ uri: img.uri }} style={styles.thumbnail} />
              ))}
            </View>
          )}

          {/* Add Video button */}
          <TouchableOpacity style={styles.imagePickerBtn} onPress={pickVideos}>
            <Text style={[styles.imagePickerBtnText, { color: colors.primary }]}>🎥 Add Video</Text>
          </TouchableOpacity>
          {serviceVideos.length > 0 && (
            <Text style={styles.videoCount}>{serviceVideos.length} video(s) selected</Text>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <Text style={styles.loadingText}>Loading {serviceLabel.toLowerCase()}...</Text>
      ) : items.length === 0 ? (
        <Text style={styles.emptyText}>No {serviceLabel.toLowerCase()} configured yet.</Text>
      ) : (
        items.map(renderItem)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  formCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  formTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12 },
  dropdownTriggerText: { fontSize: 14, color: '#111827', fontWeight: '600' },
  dropdownPlaceholder: { color: '#9ca3af', fontWeight: '400' },
  dropdownCaret: { fontSize: 12, color: '#6b7280' },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  dropdownMenu: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, width: '100%', maxWidth: 340 },
  dropdownMenuTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', paddingHorizontal: 16, paddingVertical: 8 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  dropdownOptionText: { fontSize: 15, color: '#111827' },
  dropdownCheck: { fontSize: 16, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  toggleLabel: { fontSize: 14, color: '#374151' },
  toggle: { backgroundColor: '#e5e7eb', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  toggleText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  imagePickerBtn: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 6, marginBottom: 8, borderStyle: 'dashed' },
  imagePickerBtnText: { fontSize: 14, fontWeight: '600' },
  videoCount: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 8 },
  submitBtn: { marginTop: 12, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  // Card
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  cardHeader: { marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 16 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionIconBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb' },
  actionIcon: { fontSize: 12, fontWeight: '600' },
  // Card body
  cardBody: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: '#6b7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  // Thumbnails & chips
  thumbnailRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  thumbnail: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#e5e7eb' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  chipText: { fontSize: 11, fontWeight: '500' },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
