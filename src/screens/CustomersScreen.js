import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import AppIcon from '../components/AppIcon';
import { resolveCategory, usesRoomBookings, usesTableReservations } from '../constants/attractions';

export default function CustomersScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const attractionId = resolveCategory(user?.attraction);
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Gather customers from reservations
      let reservations = [];
      if (usesRoomBookings(attractionId)) {
        const res = await businessService.getBookings(user.id);
        reservations = Array.isArray(res) ? res : res?.content || [];
      } else if (usesTableReservations(attractionId)) {
        const res = await businessService.getTableReservations(user.id);
        reservations = Array.isArray(res) ? res : res?.content || [];
      } else {
        const res = await businessService.getReservations(user.id);
        reservations = Array.isArray(res) ? res : res?.content || [];
      }

      // Deduplicate customers
      const customerMap = {};
      reservations.forEach(r => {
        const id = r.customerId || r.customerUserId;
        if (!id) return;
        if (!customerMap[id]) {
          customerMap[id] = {
            id,
            name: r.customerName || r.guestName || '',
            email: r.customerEmail || '',
            phone: r.customerPhone || '',
            lastActivity: r.createdAt,
            status: 'Active',
            interactions: 1,
          };
        } else {
          customerMap[id].interactions++;
          if (r.createdAt > customerMap[id].lastActivity) {
            customerMap[id].lastActivity = r.createdAt;
          }
        }
      });

      // Reservations only carry customerId, so enrich each customer with their
      // profile (name/email/phone) — done in parallel, failures ignored.
      const customerList = Object.values(customerMap);
      await Promise.all(customerList.map(async (c) => {
        if (c.name && c.email) return; // already has details
        try {
          const p = await businessService.getCustomerProfile(c.id);
          if (p) {
            c.name = c.name || [p.name, p.surname].filter(Boolean).join(' ').trim() || p.fullName || 'Customer';
            c.email = c.email || p.email || '';
            c.phone = c.phone || p.phoneNumber || p.contactNumber || p.phone || '';
          }
        } catch {}
        if (!c.name) c.name = 'Customer';
      }));
      setCustomers(customerList);

      // Gather leads from followers + messages
      const leadMap = {};
      try {
        const followers = await businessService.getFollowers(user.id);
        const followerList = Array.isArray(followers) ? followers : followers?.content || [];
        followerList.forEach(f => {
          const id = f.userId || f.customerId || f.id;
          if (id && !customerMap[id]) {
            leadMap[id] = {
              id,
              name: f.name || f.userName || 'Lead',
              source: 'Follower',
              leadScore: 40,
            };
          }
        });
      } catch {}

      try {
        const msgs = await businessService.getMessages(user.id);
        const msgList = Array.isArray(msgs) ? msgs : msgs?.content || [];
        msgList.forEach(m => {
          const id = m.customerUserId || m.senderId;
          if (id && !customerMap[id] && !leadMap[id]) {
            leadMap[id] = {
              id,
              name: m.customerName || m.senderName || 'Lead',
              source: 'Message',
              leadScore: 60,
            };
          } else if (id && leadMap[id]) {
            leadMap[id].leadScore = Math.min(100, leadMap[id].leadScore + 20);
          }
        });
      } catch {}

      setLeads(Object.values(leadMap));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const renderCustomer = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => setDetailCustomer(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{item.name}</Text>
        <View style={[styles.badge, { backgroundColor: '#16a34a20' }]}>
          <Text style={[styles.badgeText, { color: '#16a34a' }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.cardDetail}>{item.email || item.phone || 'No contact info'}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>
          Last: {item.lastActivity ? new Date(item.lastActivity).toLocaleDateString() : 'N/A'}
        </Text>
        <Text style={styles.footerText}>{item.interactions} interaction{item.interactions !== 1 ? 's' : ''}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderLead = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.sourceText}>{item.source}</Text>
      </View>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Lead Score:</Text>
        <View style={styles.scoreBarBg}>
          <View style={[styles.scoreBar, { width: `${item.leadScore}%`, backgroundColor: colors.primary }]} />
        </View>
        <Text style={styles.scoreValue}>{item.leadScore}%</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <AppIcon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Customers</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'customers' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('customers')}
        >
          <Text style={[styles.tabText, activeTab === 'customers' && { color: colors.primary }]}>Customers ({customers.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leads' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('leads')}
        >
          <Text style={[styles.tabText, activeTab === 'leads' && { color: colors.primary }]}>Sales Leads ({leads.length})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : activeTab === 'customers' ? (
        customers.length === 0 ? (
          <Text style={styles.emptyText}>No customers yet.</Text>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderCustomer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )
      ) : (
        leads.length === 0 ? (
          <Text style={styles.emptyText}>No sales leads yet.</Text>
        ) : (
          <FlatList
            data={leads}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderLead}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )
      )}

      {/* Customer detail modal */}
      <Modal visible={!!detailCustomer} transparent animationType="slide" onRequestClose={() => setDetailCustomer(null)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Customer Details</Text>
              <TouchableOpacity onPress={() => setDetailCustomer(null)}>
                <AppIcon name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {detailCustomer && (
              <>
                <View style={[styles.detailAvatar, { backgroundColor: colors.light }]}>
                  <Text style={[styles.detailAvatarText, { color: colors.primary }]}>
                    {(detailCustomer.name || 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>
                {[
                  ['Name', detailCustomer.name || '—'],
                  ['Email', detailCustomer.email || '—'],
                  ['Phone', detailCustomer.phone || '—'],
                  ['Status', detailCustomer.status || '—'],
                  ['Interactions', String(detailCustomer.interactions ?? '—')],
                  ['Last activity', detailCustomer.lastActivity ? new Date(detailCustomer.lastActivity).toLocaleString() : '—'],
                ].map(([label, value]) => (
                  <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 40, marginBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  tabRow: { flexDirection: 'row', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardDetail: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 11, color: '#9ca3af' },
  sourceText: { fontSize: 11, color: '#6b7280', fontStyle: 'italic' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  scoreLabel: { fontSize: 12, color: '#6b7280', marginRight: 8 },
  scoreBarBg: { flex: 1, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  scoreBar: { height: '100%', borderRadius: 4 },
  scoreValue: { fontSize: 12, fontWeight: '600', color: '#111827', marginLeft: 8, width: 35 },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
  // Detail modal
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  detailClose: { fontSize: 22, color: '#6b7280', padding: 4 },
  detailAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  detailAvatarText: { fontSize: 24, fontWeight: 'bold' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  detailLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
