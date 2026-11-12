import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, RefreshControl, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import promotionService from '../api/promotionService';
import KeyboardAwareScroll from '../components/KeyboardAwareScroll';
import AppIcon from '../components/AppIcon';
import useHeaderInsets from '../hooks/useHeaderInsets';
import {
  resolveCategory,
  reservationTypeFor,
  RESERVATION_ROOMS,
  RESERVATION_TABLES,
} from '../constants/attractions';

// Service filter options per reservation model.
const SERVICE_TYPES_BY_RESERVATION = {
  [RESERVATION_ROOMS]: [
    { value: 'ALL', label: 'All Services' },
    { value: 'ROOM', label: 'Rooms' },
    { value: 'EVENT', label: 'Tickets' },
  ],
  [RESERVATION_TABLES]: [
    { value: 'ALL', label: 'All Services' },
    { value: 'TABLE', label: 'Tables' },
    { value: 'EVENT', label: 'Tickets' },
  ],
  // SLOTS (Salons and Beauty, Games and Sports, Wellness and Fitness)
  SLOTS: [
    { value: 'ALL', label: 'All Services' },
    { value: 'SLOT', label: 'Slots' },
    { value: 'EVENT', label: 'Tickets' },
  ],
};

const ALL_SERVICE_TYPES = [
  { value: 'ALL', label: 'All Services' },
  { value: 'ROOM', label: 'Rooms' },
  { value: 'TABLE', label: 'Tables' },
  { value: 'SLOT', label: 'Slots' },
  { value: 'EVENT', label: 'Tickets' },
];

const DISCOUNT_TYPES = [
  { value: 'PERCENTAGE', label: 'Percentage (%)' },
  { value: 'FIXED', label: 'Fixed Amount (R)' },
];

export default function PromotionsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { headerPaddingTop } = useHeaderInsets();
  const attractionId = resolveCategory(user?.attraction);
  const SERVICE_TYPES = SERVICE_TYPES_BY_RESERVATION[reservationTypeFor(attractionId)];

  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    name: '', description: '', discountType: 'PERCENTAGE', discountValue: '',
    serviceType: 'ALL', startDate: '', endDate: '', promoCode: '',
    minimumOrderValue: '', maxUsageCount: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { if (user?.id) loadPromotions(); else setLoading(false); }, [user]);

  const loadPromotions = async () => {
    try {
      const res = await promotionService.getPromotions(user.id);
      setPromotions(Array.isArray(res) ? res : res?.content || []);
    } catch { setPromotions([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadPromotions(); };

  const getPromoStatus = (promo) => {
    const now = new Date();
    const start = promo.startDate ? new Date(promo.startDate) : null;
    const end = promo.endDate ? new Date(promo.endDate) : null;
    if (!promo.active) return 'INACTIVE';
    if (start && now < start) return 'SCHEDULED';
    if (end && now > end) return 'EXPIRED';
    return 'ACTIVE';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return { bg: '#dcfce7', color: '#166534', bar: '#16a34a' };
      case 'SCHEDULED': return { bg: '#dbeafe', color: '#1e40af', bar: '#3b82f6' };
      case 'EXPIRED': return { bg: '#f3f4f6', color: '#6b7280', bar: '#9ca3af' };
      case 'INACTIVE': return { bg: '#f3f4f6', color: '#6b7280', bar: '#d1d5db' };
      default: return { bg: '#f3f4f6', color: '#6b7280', bar: '#9ca3af' };
    }
  };

  const validate = () => {
    if (!form.name || form.name.trim().length < 2) { Alert.alert('Error', 'Name must be at least 2 characters'); return false; }
    const dv = parseFloat(form.discountValue);
    if (!dv || dv <= 0) { Alert.alert('Error', 'Discount value must be greater than 0'); return false; }
    if (form.discountType === 'PERCENTAGE' && dv > 100) { Alert.alert('Error', 'Percentage cannot exceed 100%'); return false; }
    if (!form.startDate || !form.endDate) { Alert.alert('Error', 'Start and end dates are required'); return false; }
    if (new Date(form.endDate) <= new Date(form.startDate)) { Alert.alert('Error', 'End date must be after start date'); return false; }
    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data = {
        name: form.name.trim(), description: form.description.trim(),
        discountType: form.discountType, discountValue: parseFloat(form.discountValue),
        serviceType: form.serviceType, promoCode: form.promoCode.trim().toUpperCase(),
        startDate: form.startDate.trim(), endDate: form.endDate.trim(),
        minimumOrderValue: form.minimumOrderValue ? parseFloat(form.minimumOrderValue) : 0,
        maxUsageCount: form.maxUsageCount ? parseInt(form.maxUsageCount) : 0,
        businessUserId: user.id, active: true,
      };
      const created = await promotionService.createPromotion(data);
      setPromotions(prev => [created || data, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) { Alert.alert('Error', err.message || 'Failed to create promotion'); }
    finally { setSubmitting(false); }
  };

  const handleUpdate = async () => {
    if (!form.name || !form.discountValue) { Alert.alert('Error', 'Please fill required fields'); return; }
    setSubmitting(true);
    try {
      const data = {
        name: form.name.trim(), description: form.description.trim(),
        discountType: form.discountType, discountValue: parseFloat(form.discountValue),
        serviceType: form.serviceType, startDate: form.startDate.trim(), endDate: form.endDate.trim(),
        minimumOrderValue: form.minimumOrderValue ? parseFloat(form.minimumOrderValue) : 0,
        maxUsageCount: form.maxUsageCount ? parseInt(form.maxUsageCount) : 0,
      };
      await promotionService.updatePromotion(editingId, data);
      setPromotions(prev => prev.map(p => p.id === editingId ? { ...p, ...data } : p));
      setEditingId(null); setForm(emptyForm);
    } catch (err) { Alert.alert('Error', err.message || 'Failed to update'); }
    finally { setSubmitting(false); }
  };

  const handleToggle = async (promo) => {
    try {
      await promotionService.togglePromotion(promo.id);
      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, active: !p.active } : p));
    } catch (err) { Alert.alert('Error', err.message || 'Failed to toggle'); }
  };

  const handleDelete = (promo) => {
    Alert.alert('Delete Promotion', `Delete "${promo.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await promotionService.deletePromotion(promo.id); setPromotions(prev => prev.filter(p => p.id !== promo.id)); }
        catch (err) { Alert.alert('Error', err.message || 'Failed to delete'); }
      }},
    ]);
  };

  const startEdit = (promo) => {
    setEditingId(promo.id);
    setForm({
      name: promo.name || '', description: promo.description || '',
      discountType: promo.discountType || 'PERCENTAGE', discountValue: String(promo.discountValue || ''),
      serviceType: promo.serviceType || 'ALL', promoCode: promo.promoCode || '',
      startDate: promo.startDate || '', endDate: promo.endDate || '',
      minimumOrderValue: String(promo.minimumOrderValue || ''), maxUsageCount: String(promo.maxUsageCount || ''),
    });
    setShowForm(false);
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  const renderForm = () => {
    if (!showForm) return null;
    return (
      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Create Promotion</Text>
          <TouchableOpacity onPress={() => { setShowForm(false); setForm(emptyForm); }}>
            <AppIcon name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <TextInput style={styles.input} placeholder="Promotion Name" placeholderTextColor="#9ca3af" value={form.name} onChangeText={t => setForm({ ...form, name: t })} />
        <TextInput style={styles.input} placeholder="Description (optional)" placeholderTextColor="#9ca3af" value={form.description} onChangeText={t => setForm({ ...form, description: t })} multiline />
        <Text style={styles.fieldLabel}>Discount Type</Text>
        <View style={styles.chipRow}>
          {DISCOUNT_TYPES.map(dt => (
            <TouchableOpacity key={dt.value} style={[styles.chip, form.discountType === dt.value && { backgroundColor: colors.primary }]} onPress={() => setForm({ ...form, discountType: dt.value })}>
              <Text style={[styles.chipText, form.discountType === dt.value && { color: '#fff' }]}>{dt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} placeholder={form.discountType === 'PERCENTAGE' ? 'Discount % (e.g. 20)' : 'Amount (e.g. 50)'} placeholderTextColor="#9ca3af" value={form.discountValue} onChangeText={t => setForm({ ...form, discountValue: t })} keyboardType="numeric" />
        <Text style={styles.fieldLabel}>Applies To</Text>
        <View style={styles.chipRow}>
          {SERVICE_TYPES.map(st => (
            <TouchableOpacity key={st.value} style={[styles.chip, form.serviceType === st.value && { backgroundColor: colors.primary }]} onPress={() => setForm({ ...form, serviceType: st.value })}>
              <Text style={[styles.chipText, form.serviceType === st.value && { color: '#fff' }]}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Promo Code (e.g. SUMMER20)" placeholderTextColor="#9ca3af" value={form.promoCode} onChangeText={t => setForm({ ...form, promoCode: t })} autoCapitalize="characters" />
        <TextInput style={styles.input} placeholder="Start Date (YYYY-MM-DD)" placeholderTextColor="#9ca3af" value={form.startDate} onChangeText={t => setForm({ ...form, startDate: t })} />
        <TextInput style={styles.input} placeholder="End Date (YYYY-MM-DD)" placeholderTextColor="#9ca3af" value={form.endDate} onChangeText={t => setForm({ ...form, endDate: t })} />
        <TextInput style={styles.input} placeholder="Min. Order Value (optional)" placeholderTextColor="#9ca3af" value={form.minimumOrderValue} onChangeText={t => setForm({ ...form, minimumOrderValue: t })} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Max Usage Count (optional, 0=unlimited)" placeholderTextColor="#9ca3af" value={form.maxUsageCount} onChangeText={t => setForm({ ...form, maxUsageCount: t })} keyboardType="numeric" />
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={handleCreate} disabled={submitting}>
          <Text style={styles.primaryBtnText}>{submitting ? 'Creating...' : 'Create Promotion'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEditForm = (promo) => {
    const statusColor = getStatusColor(getPromoStatus(promo));
    return (
      <View key={promo.id} style={styles.promoCard}>
        <View style={[styles.cardBar, { backgroundColor: statusColor.bar }]} />
        <View style={styles.promoContent}>
          <Text style={styles.editTitle}>Edit Promotion</Text>
          <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#9ca3af" value={form.name} onChangeText={t => setForm({ ...form, name: t })} />
          <TextInput style={styles.input} placeholder="Discount Value" placeholderTextColor="#9ca3af" value={form.discountValue} onChangeText={t => setForm({ ...form, discountValue: t })} keyboardType="numeric" />
          <View style={styles.chipRow}>
            {SERVICE_TYPES.map(st => (
              <TouchableOpacity key={st.value} style={[styles.chip, form.serviceType === st.value && { backgroundColor: colors.primary }]} onPress={() => setForm({ ...form, serviceType: st.value })}>
                <Text style={[styles.chipText, form.serviceType === st.value && { color: '#fff' }]}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Start Date (YYYY-MM-DD)" placeholderTextColor="#9ca3af" value={form.startDate} onChangeText={t => setForm({ ...form, startDate: t })} />
          <TextInput style={styles.input} placeholder="End Date (YYYY-MM-DD)" placeholderTextColor="#9ca3af" value={form.endDate} onChangeText={t => setForm({ ...form, endDate: t })} />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleUpdate} disabled={submitting}>
              <Text style={styles.saveBtnText}>{submitting ? '...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderPromoCard = (promo) => {
    const status = getPromoStatus(promo);
    const sc = getStatusColor(status);
    if (editingId === promo.id) return renderEditForm(promo);
    return (
      <View key={promo.id} style={[styles.promoCard, !promo.active && { opacity: 0.6 }]}>
        <View style={[styles.cardBar, { backgroundColor: sc.bar }]} />
        <View style={styles.promoContent}>
          <View style={styles.promoHeader}>
            <Text style={styles.promoName}>{promo.name}</Text>
            <View style={[styles.badge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.badgeText, { color: sc.color }]}>{status}</Text>
            </View>
          </View>
          {promo.description ? <Text style={styles.promoDesc}>{promo.description}</Text> : null}
          <View style={styles.promoDetails}>
            <View style={[styles.discountBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.discountText, { color: colors.primary }]}>
                {promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}% OFF` : `R${promo.discountValue} OFF`}
              </Text>
            </View>
            <Text style={styles.promoMeta}>
              {SERVICE_TYPES.find(s => s.value === promo.serviceType)?.label || ALL_SERVICE_TYPES.find(s => s.value === promo.serviceType)?.label || promo.serviceType}
            </Text>
          </View>
          {(promo.startDate || promo.endDate) && (
            <View style={styles.promoDateRow}>
              <AppIcon name="calendar-outline" size={13} color="#6b7280" />
              <Text style={styles.promoDateRange}>{promo.startDate || '—'} → {promo.endDate || '—'}</Text>
            </View>
          )}
          {promo.promoCode ? (
            <View style={styles.promoCodeRow}>
              <Text style={styles.promoCodeLabel}>Code:</Text>
              <Text style={styles.promoCodeValue}>{promo.promoCode}</Text>
            </View>
          ) : null}
          {promo.minimumOrderValue > 0 && <Text style={styles.promoMeta}>Min order: R{promo.minimumOrderValue}</Text>}
          <View style={styles.promoActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]} onPress={() => handleToggle(promo)}>
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>{promo.active ? 'Pause' : 'Activate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f3f4f6' }]} onPress={() => startEdit(promo)}>
              <Text style={styles.actionBtnTextGray}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDelete(promo)}>
              <Text style={styles.actionBtnTextRed}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingTop: headerPaddingTop }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <AppIcon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Promotions</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading promotions...</Text>
      ) : (
        <KeyboardAwareScroll style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {renderForm()}
          {promotions.length === 0 ? (
            <View style={styles.emptyCard}>
              <AppIcon name="pricetag-outline" size={28} color="#9ca3af" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No promotions yet. Create your first one!</Text>
            </View>
          ) : (
            promotions.map(promo => renderPromoCard(promo))
          )}
        </KeyboardAwareScroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef' },
  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  // Form card
  formCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  formClose: { fontSize: 20, color: '#6b7280', padding: 4 },
  // Form
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f3f4f6' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  primaryBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  // Promo card
  promoCard: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  cardBar: { height: 4 },
  promoContent: { padding: 14 },
  promoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  promoName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  promoDesc: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  promoDetails: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  discountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  discountText: { fontSize: 13, fontWeight: '700' },
  promoMeta: { fontSize: 12, color: '#6b7280' },
  promoDateRange: { fontSize: 12, color: '#6b7280' },
  promoDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  promoCodeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  promoCodeLabel: { fontSize: 12, color: '#6b7280', marginRight: 4 },
  promoCodeValue: { fontSize: 12, fontWeight: '700', color: '#374151', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontFamily: 'monospace' },
  promoActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  actionBtnTextGray: { fontSize: 12, fontWeight: '600', color: '#374151' },
  actionBtnTextRed: { fontSize: 12, fontWeight: '600', color: '#dc2626' },
  // Edit inline
  editTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f3f4f6' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  // Empty
  emptyCard: { backgroundColor: '#fff', borderRadius: 10, padding: 30, alignItems: 'center', marginTop: 20 },
  emptyText: { color: '#9ca3af', textAlign: 'center', fontSize: 14 },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
});
