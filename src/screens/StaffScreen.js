import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, RefreshControl, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import KeyboardAwareScroll from '../components/KeyboardAwareScroll';
import AppIcon from '../components/AppIcon';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import staffService from '../api/staffService';
import { ROLE_PERMISSIONS, permissionsForRole } from '../constants/permissions';
import useHeaderInsets from '../hooks/useHeaderInsets';

const STAFF_ROLES = [
  { value: 'MANAGER', label: 'Manager', description: 'Full access to all features except staff management and business settings' },
  { value: 'RECEPTIONIST', label: 'Receptionist', description: 'Reservations, check-in/out, customers, and messages' },
  { value: 'FINANCE', label: 'Finance', description: 'Payments, sales reports, and analytics' },
  { value: 'MARKETING', label: 'Marketing', description: 'Posts, promotions, and reviews' },
  { value: 'EVENTS', label: 'Events Coordinator', description: 'Event tickets, reservations, and customers' },
];

const getRoleBadgeColor = (role) => {
  switch (role) {
    case 'MANAGER': return { bg: '#f3e8ff', color: '#7c3aed' };
    case 'RECEPTIONIST': return { bg: '#dbeafe', color: '#1e40af' };
    case 'FINANCE': return { bg: '#dcfce7', color: '#166534' };
    case 'MARKETING': return { bg: '#ffedd5', color: '#c2410c' };
    case 'EVENTS': return { bg: '#fce7f3', color: '#be185d' };
    default: return { bg: '#f3f4f6', color: '#6b7280' };
  }
};

export default function StaffScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { headerPaddingTop } = useHeaderInsets();
  // Only the business owner (not a staff account) can manage staff.
  const isOwner = !user?.isStaff;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = { name: '', surname: '', email: '', password: '', phoneNumber: '', role: 'RECEPTIONIST' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { if (user?.id) loadStaff(); else setLoading(false); }, [user]);

  // Normalize a backend staff record to the fields this screen renders.
  // The API uses firstName/lastName/position/roles; the UI uses name/surname/role.
  const normalizeStaff = (s) => ({
    ...s,
    name: s.name || s.firstName || '',
    surname: s.surname || s.lastName || '',
    role: s.role || s.position || 'RECEPTIONIST',
    status: s.status || (s.active === false ? 'SUSPENDED' : 'ACTIVE'),
  });

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await staffService.getStaffMembers();
      const list = Array.isArray(res) ? res : res?.content || [];
      // Show only staff the business itself created — exclude admin-linked
      // staff (e.g. "Sales Business Partner") whose position is not one of the
      // app's own role labels.
      const ownRoleValues = STAFF_ROLES.map(r => r.value.toLowerCase());
      const ownRoleLabels = STAFF_ROLES.map(r => r.label.toLowerCase());
      const ownStaff = list.filter(s => {
        const pos = (s.position || s.role || '').toLowerCase();
        return ownRoleValues.includes(pos) || ownRoleLabels.includes(pos);
      });
      setStaff(ownStaff.map(normalizeStaff));
    } catch {
      setStaff([]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadStaff(); };

  // Build the API payload from the form. Sends the BusinessController staff
  // contract fields (firstName/lastName/position/roles) and keeps name/surname/
  // role so the record round-trips cleanly for the UI.
  const toStaffPayload = (f, { includePassword = true } = {}) => {
    const label = STAFF_ROLES.find((r) => r.value === f.role)?.label || f.role;
    const payload = {
      firstName: f.name.trim(),
      lastName: f.surname.trim(),
      email: f.email.trim(),
      phoneNumber: f.phoneNumber.trim(),
      position: label,
      roles: ['STAFF'],
      // Fine-grained feature access for this staff member, derived from role.
      permissions: permissionsForRole(f.role),
      // Keep legacy/internal fields for the UI and permission mapping.
      name: f.name.trim(),
      surname: f.surname.trim(),
      role: f.role,
    };
    if (includePassword && f.password) payload.password = f.password;
    return payload;
  };

  const handleCreate = async () => {
    if (!form.name || form.name.trim().length < 2) { Alert.alert('Error', 'Name must be at least 2 characters'); return; }
    if (!form.surname || form.surname.trim().length < 2) { Alert.alert('Error', 'Surname must be at least 2 characters'); return; }
    if (!form.email || !form.email.includes('@')) { Alert.alert('Error', 'Valid email is required'); return; }
    if (!form.password || form.password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    if (!form.role) { Alert.alert('Error', 'Please select a role'); return; }

    setSubmitting(true);
    try {
      const staffData = toStaffPayload(form);
      const created = await staffService.addStaffMember(staffData);
      const row = normalizeStaff(created && typeof created === 'object' ? { ...staffData, ...created } : { ...staffData, id: Date.now(), status: 'ACTIVE' });
      setStaff(prev => [...prev, row]);
      setForm(emptyForm); setShowForm(false);
      Alert.alert('Success', 'Staff member added! They can now login with their credentials.');
    } catch (err) { Alert.alert('Error', err.message || 'Failed to add staff member'); }
    finally { setSubmitting(false); }
  };

  const handleUpdate = async () => {
    if (!form.name || !form.surname || !form.email) { Alert.alert('Error', 'Please fill required fields'); return; }
    setSubmitting(true);
    try {
      const data = toStaffPayload(form, { includePassword: false });
      const updated = await staffService.updateStaffMember(editingId, data);
      setStaff(prev => prev.map(s => s.id === editingId ? normalizeStaff({ ...s, ...data, ...(updated && typeof updated === 'object' ? updated : {}) }) : s));
      setEditingId(null); setForm(emptyForm);
    } catch (err) { Alert.alert('Error', err.message || 'Failed to update'); }
    finally { setSubmitting(false); }
  };

  const handleRemove = (member) => {
    Alert.alert('Remove Staff', `Remove ${member.name} ${member.surname}? They will no longer be able to login.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await staffService.removeStaffMember(member.id); setStaff(prev => prev.filter(s => s.id !== member.id)); }
        catch (err) { Alert.alert('Error', err.message || 'Failed to remove'); }
      }},
    ]);
  };

  const handleToggleStatus = async (member) => {
    const newStatus = member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const label = STAFF_ROLES.find((r) => r.value === member.role)?.label || member.role;
    try {
      // The staff update contract takes name/role fields; send a well-formed
      // payload and include `status`/`active` best-effort for backends that honor it.
      await staffService.updateStaffMember(member.id, {
        firstName: member.name, lastName: member.surname,
        position: label, roles: ['STAFF'],
        name: member.name, surname: member.surname, role: member.role,
        status: newStatus, active: newStatus === 'ACTIVE',
      });
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: newStatus } : s));
    } catch (err) { Alert.alert('Error', err.message || 'Failed to update status'); }
  };

  const startEdit = (member) => {
    setEditingId(member.id);
    setForm({ name: member.name || '', surname: member.surname || '', email: member.email || '', password: '', phoneNumber: member.phoneNumber || '', role: member.role || 'RECEPTIONIST' });
    setShowForm(false);
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };

  // Not owner - show access denied
  if (!isOwner) {
    return (
      <View style={styles.screen}>
        <View style={styles.emptyCard}>
          <AppIcon name="lock-closed-outline" size={28} color="#9ca3af" style={{ marginBottom: 8 }} />
          <Text style={styles.emptyText}>Only the business owner can manage staff members.</Text>
        </View>
      </View>
    );
  }

  const closeAddForm = () => { setShowForm(false); setForm(emptyForm); };

  // Add Staff Member — its own form (full-screen modal).
  const renderAddStaffModal = () => (
    <Modal visible={showForm} animationType="slide" onRequestClose={closeAddForm} presentationStyle="pageSheet">
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={closeAddForm}>
            <AppIcon name="close" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Add Staff Member</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <KeyboardAwareScroll style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Text style={styles.fieldLabel}>First Name</Text>
          <TextInput style={styles.input} placeholder="e.g. Thandi" placeholderTextColor="#9ca3af" value={form.name} onChangeText={t => setForm({ ...form, name: t })} />
          <Text style={styles.fieldLabel}>Surname</Text>
          <TextInput style={styles.input} placeholder="e.g. Nkosi" placeholderTextColor="#9ca3af" value={form.surname} onChangeText={t => setForm({ ...form, surname: t })} />
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput style={styles.input} placeholder="e.g. thandi@business.com" placeholderTextColor="#9ca3af" value={form.email} onChangeText={t => setForm({ ...form, email: t })} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput style={styles.input} placeholder="Min 6 characters" placeholderTextColor="#9ca3af" value={form.password} onChangeText={t => setForm({ ...form, password: t })} secureTextEntry />
          <Text style={styles.fieldLabel}>Phone Number</Text>
          <TextInput style={styles.input} placeholder="e.g. 0821234567" placeholderTextColor="#9ca3af" value={form.phoneNumber} onChangeText={t => setForm({ ...form, phoneNumber: t })} keyboardType="phone-pad" />

          <View style={styles.roleLabelRow}>
            <Text style={styles.fieldLabel}>Role</Text>
            <TouchableOpacity style={styles.viewRolesBtn} onPress={() => setShowRolesModal(true)}>
              <AppIcon name="information-circle-outline" size={15} color={colors.primary} />
              <Text style={[styles.viewRolesBtnText, { color: colors.primary }]}>View Staff Roles</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {STAFF_ROLES.map(r => (
              <TouchableOpacity key={r.value} style={[styles.roleChip, form.role === r.value && { backgroundColor: colors.primary }]} onPress={() => setForm({ ...form, role: r.value })}>
                <Text style={[styles.roleChipText, form.role === r.value && { color: '#fff' }]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={handleCreate} disabled={submitting}>
            <Text style={styles.primaryBtnText}>{submitting ? 'Adding...' : 'Add Staff Member'}</Text>
          </TouchableOpacity>
        </KeyboardAwareScroll>
      </View>
    </Modal>
  );

  // Staff Roles & Responsibilities — reference modal.
  const renderRolesModal = () => (
    <Modal visible={showRolesModal} animationType="slide" transparent onRequestClose={() => setShowRolesModal(false)}>
      <View style={styles.rolesOverlay}>
        <View style={styles.rolesSheet}>
          <View style={styles.rolesSheetHandle} />
          <View style={styles.rolesSheetHeader}>
            <Text style={styles.rolesSheetTitle}>Staff Roles & Responsibilities</Text>
            <TouchableOpacity onPress={() => setShowRolesModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AppIcon name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: '100%' }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {STAFF_ROLES.map(role => {
              const rc = getRoleBadgeColor(role.value);
              const selectable = showForm; // allow tap-to-select when opened from the Add form
              return (
                <TouchableOpacity
                  key={role.value}
                  activeOpacity={selectable ? 0.6 : 1}
                  onPress={selectable ? () => { setForm({ ...form, role: role.value }); setShowRolesModal(false); } : undefined}
                  style={styles.roleRow}
                >
                  <View style={styles.roleHeader}>
                    <View style={[styles.badge, { backgroundColor: rc.bg }]}>
                      <Text style={[styles.badgeText, { color: rc.color }]}>{role.label}</Text>
                    </View>
                    {selectable && form.role === role.value && (
                      <AppIcon name="checkmark-circle" size={18} color={colors.primary} />
                    )}
                  </View>
                  <Text style={styles.roleDesc}>{role.description}</Text>
                  <View style={styles.permChipRow}>
                    {ROLE_PERMISSIONS[role.value]?.map(p => (
                      <View key={p} style={styles.permChipSmall}>
                        <Text style={styles.permChipSmallText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderEditForm = (member) => (
    <View key={member.id} style={[styles.staffCard, { borderColor: colors.primary, borderWidth: 1.5 }]}>
      <Text style={styles.editTitle}>Edit Staff Member</Text>
      <Text style={styles.fieldLabel}>First Name</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={t => setForm({ ...form, name: t })} placeholder="First Name" placeholderTextColor="#9ca3af" />
      <Text style={styles.fieldLabel}>Surname</Text>
      <TextInput style={styles.input} value={form.surname} onChangeText={t => setForm({ ...form, surname: t })} placeholder="Surname" placeholderTextColor="#9ca3af" />
      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput style={styles.input} value={form.email} onChangeText={t => setForm({ ...form, email: t })} placeholder="Email" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
      <Text style={styles.fieldLabel}>Phone</Text>
      <TextInput style={styles.input} value={form.phoneNumber} onChangeText={t => setForm({ ...form, phoneNumber: t })} placeholder="Phone" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
      <Text style={styles.fieldLabel}>Role</Text>
      <View style={styles.chipRow}>
        {STAFF_ROLES.map(r => (
          <TouchableOpacity key={r.value} style={[styles.roleChip, form.role === r.value && { backgroundColor: colors.primary }]} onPress={() => setForm({ ...form, role: r.value })}>
            <Text style={[styles.roleChipText, form.role === r.value && { color: '#fff' }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.editActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleUpdate} disabled={submitting}>
          <Text style={styles.saveBtnText}>{submitting ? '...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStaffCard = (member) => {
    if (editingId === member.id) return renderEditForm(member);
    const roleBadge = getRoleBadgeColor(member.role);
    const isActive = member.status === 'ACTIVE';
    const initials = `${member.name?.[0] || ''}${member.surname?.[0] || ''}`;
    const roleLabel = STAFF_ROLES.find(r => r.value === member.role)?.label || member.role;
    const lastLogin = member.lastLogin ? new Date(member.lastLogin).toLocaleString() : 'Never';

    return (
      <View key={member.id} style={[styles.staffCard, !isActive && { opacity: 0.6 }]}>
        <View style={styles.staffHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
          <View style={styles.staffInfo}>
            <Text style={styles.staffName}>{member.name} {member.surname}</Text>
            <Text style={styles.staffEmail}>{member.email}</Text>
            <View style={styles.staffBadgeRow}>
              <View style={[styles.badge, { backgroundColor: roleBadge.bg }]}>
                <Text style={[styles.badgeText, { color: roleBadge.color }]}>{roleLabel}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: isActive ? '#dcfce7' : '#fef2f2' }]}>
                <Text style={[styles.badgeText, { color: isActive ? '#166534' : '#991b1b' }]}>{member.status}</Text>
              </View>
            </View>
            {member.phoneNumber && (
              <View style={styles.staffMetaRow}>
                <AppIcon name="call-outline" size={13} color="#6b7280" />
                <Text style={styles.staffMeta}>{member.phoneNumber}</Text>
              </View>
            )}
            <Text style={styles.staffMeta}>Last login: {lastLogin}</Text>
          </View>
        </View>
        <View style={styles.staffActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isActive ? '#fef3c7' : '#dcfce7' }]} onPress={() => handleToggleStatus(member)}>
            <Text style={[styles.actionBtnText, { color: isActive ? '#92400e' : '#166534' }]}>{isActive ? 'Suspend' : 'Activate'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f3f4f6' }]} onPress={() => startEdit(member)}>
            <Text style={styles.actionBtnTextGray}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleRemove(member)}>
            <Text style={styles.actionBtnTextRed}>Remove</Text>
          </TouchableOpacity>
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
          <Text style={styles.headerTitle}>Staff Management</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading staff...</Text>
      ) : (
        <KeyboardAwareScroll style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {staff.length === 0 ? (
            <View style={styles.emptyCard}>
              <AppIcon name="people-outline" size={28} color="#9ca3af" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>No staff members yet. Add your first team member!</Text>
            </View>
          ) : (
            staff.map(member => renderStaffCard(member))
          )}
        </KeyboardAwareScroll>
      )}

      {renderAddStaffModal()}
      {renderRolesModal()}
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
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f3f4f6' },
  roleChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  primaryBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  // Add-form: role label row with the "View Staff Roles" trigger.
  roleLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  viewRolesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6 },
  viewRolesBtnText: { fontSize: 12, fontWeight: '600' },
  // Roles modal (bottom sheet)
  rolesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  rolesSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, maxHeight: '85%' },
  rolesSheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', marginBottom: 14 },
  rolesSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rolesSheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  // Permissions preview
  permPreview: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, marginTop: 8 },
  permTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  permDesc: { fontSize: 11, color: '#6b7280', marginTop: 2, marginBottom: 8 },
  permChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  permChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  permChipText: { fontSize: 10, fontWeight: '600' },
  // Staff card
  staffCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10 },
  staffHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  staffEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  staffBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  staffMeta: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  staffMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  staffActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  actionBtnTextGray: { fontSize: 12, fontWeight: '600', color: '#374151' },
  actionBtnTextRed: { fontSize: 12, fontWeight: '600', color: '#dc2626' },
  // Edit
  editTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f3f4f6' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  // Roles section
  rolesSection: { backgroundColor: '#fff', borderRadius: 10, padding: 14 },
  rolesSectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  roleRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  roleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  roleDesc: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  permChipSmall: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#f3f4f6', marginRight: 4, marginBottom: 4 },
  permChipSmallText: { fontSize: 10, color: '#6b7280' },
  // Empty
  emptyCard: { backgroundColor: '#fff', borderRadius: 10, padding: 30, alignItems: 'center', marginTop: 20 },
  emptyText: { color: '#9ca3af', textAlign: 'center', fontSize: 14 },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
});
