import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet, RefreshControl,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import AppIcon from '../components/AppIcon';
import FormError from '../components/FormError';
import useHeaderInsets from '../hooks/useHeaderInsets';
import supportService, { SUPPORT_TYPES, statusLabel, typeLabel } from '../api/supportService';

const SUBJECT_MAX = 120;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;

const statusColors = (status) => {
  switch (String(status || 'PENDING').toUpperCase()) {
    case 'RESOLVED':
    case 'CLOSED': return { bg: '#dcfce7', color: '#166534' };
    case 'IN_PROGRESS':
    case 'OPEN': return { bg: '#dbeafe', color: '#1e40af' };
    case 'REJECTED': return { bg: '#fef2f2', color: '#991b1b' };
    default: return { bg: '#fef3c7', color: '#92400e' }; // PENDING and unknown
  }
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const dateOf = (e) => e?.createdAt || e?.createdDate || e?.dateCreated || e?.created || null;
const responseOf = (e) => (e?.adminResponse || '').trim();

function StatusBadge({ status }) {
  const sc = statusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: sc.bg }]}>
      <Text style={[styles.badgeText, { color: sc.color }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export default function SupportScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { showSuccess } = useAlert();
  const { headerPaddingTop } = useHeaderInsets();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState(SUPPORT_TYPES[0].value);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = await supportService.getMyEnquiries();
      // Newest first.
      list.sort((a, b) => new Date(dateOf(b) || 0) - new Date(dateOf(a) || 0) || (b.id || 0) - (a.id || 0));
      setItems(list);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || 'Failed to load your enquiries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openForm = () => {
    setType(SUPPORT_TYPES[0].value);
    setSubject('');
    setMessage('');
    setFormError('');
    setShowForm(true);
  };

  const openDetail = async (item) => {
    setDetail(item);
    // Refresh the single enquiry so a new admin response shows up.
    if (item?.id == null) return;
    try {
      const fresh = await supportService.getEnquiry(item.id);
      if (fresh && typeof fresh === 'object') {
        setDetail((cur) => (cur?.id === item.id ? { ...item, ...fresh } : cur));
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, ...fresh } : p)));
      }
    } catch { /* keep the list data */ }
  };

  const validate = () => {
    if (subject.trim().length < 3) return 'Please enter a subject (at least 3 characters).';
    if (message.trim().length < MESSAGE_MIN) return `Please describe your ${typeLabel(type).toLowerCase()} (at least ${MESSAGE_MIN} characters).`;
    return '';
  };

  const submit = async () => {
    const problem = validate();
    if (problem) { setFormError(problem); return; }
    setFormError('');
    setSubmitting(true);
    try {
      const created = await supportService.createEnquiry({ subject: subject.trim(), message: message.trim(), type });
      const entry = created && typeof created === 'object' && created.id != null
        ? created
        : null;
      if (entry) setItems((prev) => [entry, ...prev]); else load();
      setShowForm(false);
      // Wait for the sheet to dismiss before presenting the alert (iOS can't stack modals).
      setTimeout(() => showSuccess('Request sent', 'Our support team has been notified and will respond soon.'), 400);
    } catch (err) {
      setFormError(err.message || 'Failed to send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => openDetail(item)}>
      <View style={styles.cardTop}>
        <Text style={styles.cardSubject} numberOfLines={2}>{item.subject || 'No subject'}</Text>
        <StatusBadge status={item.status} />
      </View>
      <View style={styles.cardMeta}>
        <AppIcon name={String(item.type).toUpperCase() === 'COMPLAINT' ? 'alert-circle-outline' : 'help-circle-outline'} size={14} color="#6b7280" />
        <Text style={styles.metaText}>{typeLabel(item.type)}</Text>
        {formatDate(dateOf(item)) ? <Text style={styles.metaText}>  •  {formatDate(dateOf(item))}</Text> : null}
      </View>
      {responseOf(item) ? (
        <View style={styles.replyRow}>
          <AppIcon name="chatbox-ellipses-outline" size={14} color={colors.primary} />
          <Text style={[styles.replyHint, { color: colors.primary }]}>Admin responded</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.headerRow, { paddingTop: headerPaddingTop }]}>
        <TouchableOpacity style={[styles.circleBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <AppIcon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Support</Text>
        </View>
        <TouchableOpacity style={[styles.circleBtn, { backgroundColor: colors.primary }]} onPress={openForm}>
          <AppIcon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => String(item.id ?? i)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: Math.max(insets.bottom, 16) + 100, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              <Text style={styles.sectionTitle}>My enquiries</Text>
              {loadError ? <FormError message={loadError} /> : null}
            </View>
          }
          ListEmptyComponent={
            loadError ? null : (
              <View style={styles.emptyCard}>
                <AppIcon name="help-buoy-outline" size={32} color="#9ca3af" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>No enquiries yet. Tap + to contact our support team.</Text>
              </View>
            )
          }
        />
      )}

      {/* New enquiry sheet */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => !submitting && setShowForm(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New enquiry</Text>
              <TouchableOpacity onPress={() => setShowForm(false)} disabled={submitting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppIcon name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chipRow}>
                {SUPPORT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, type === t.value && { backgroundColor: colors.primary }]}
                    onPress={() => setType(t.value)}
                  >
                    <Text style={[styles.chipText, type === t.value && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Payment issue"
                placeholderTextColor="#9ca3af"
                value={subject}
                onChangeText={setSubject}
                maxLength={SUBJECT_MAX}
                editable={!submitting}
              />

              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your enquiry or complaint"
                placeholderTextColor="#9ca3af"
                value={message}
                onChangeText={setMessage}
                maxLength={MESSAGE_MAX}
                multiline
                textAlignVertical="top"
                editable={!submitting}
              />

              <FormError message={formError} />

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]}
                onPress={submit}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail sheet */}
      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={3}>{detail?.subject || 'Enquiry'}</Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppIcon name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
              <View style={styles.detailMeta}>
                <StatusBadge status={detail?.status} />
                <Text style={styles.metaText}>{typeLabel(detail?.type)}</Text>
                {formatDate(dateOf(detail)) ? <Text style={styles.metaText}>  •  {formatDate(dateOf(detail))}</Text> : null}
              </View>
              <Text style={styles.fieldLabel}>Your message</Text>
              <Text style={styles.bodyText}>{detail?.message || '—'}</Text>
              <Text style={styles.fieldLabel}>Admin response</Text>
              {responseOf(detail) ? (
                <View style={[styles.responseBox, { borderLeftColor: colors.primary }]}>
                  <Text style={styles.bodyText}>{responseOf(detail)}</Text>
                </View>
              ) : (
                <Text style={styles.mutedText}>No response yet. You will be notified when support replies.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  circleBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardSubject: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  metaText: { fontSize: 12, color: '#6b7280' },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  replyHint: { fontSize: 12, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 10, padding: 30, alignItems: 'center', marginTop: 20 },
  emptyText: { color: '#9ca3af', textAlign: 'center', fontSize: 14 },
  // Sheets
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 10, maxHeight: '90%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', lineHeight: 24 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb' },
  textArea: { minHeight: 120 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f3f4f6' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  primaryBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 4 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 21 },
  mutedText: { fontSize: 13, color: '#9ca3af' },
  responseBox: { backgroundColor: '#f9fafb', borderLeftWidth: 3, borderRadius: 6, padding: 12 },
});
