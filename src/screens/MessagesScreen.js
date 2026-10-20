import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform, Modal, Alert, ScrollView, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopNavbar from '../components/TopNavbar';
import AppIcon from '../components/AppIcon';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import businessService from '../api/businessService';
import useRefreshOnFocus from '../hooks/useRefreshOnFocus';

export default function MessagesScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  // New message modal
  const [showNewMsgModal, setShowNewMsgModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState(null);

  useEffect(() => {
    if (user?.id) loadConversations();
  }, [user]);

  // Track keyboard height so the chat input row can lift above the keyboard.
  // We do this manually (rather than relying on KeyboardAvoidingView) because
  // the chat is a bottom-tab screen and the tab bar otherwise steals the space.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setKeyboardHeight(e?.endCoordinates?.height || 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const loadConversations = async () => {
    try {
      const res = await businessService.getMessages(user.id);
      const list = Array.isArray(res) ? res : res?.content || [];
      // Group by customerId
      const grouped = {};
      list.forEach((msg) => {
        const key = msg.customerUserId || msg.senderId;
        if (key == null) return;
        const msgDate = new Date(msg.createdAt || msg.sentAt || 0).getTime();
        // Count as unread only if it's an incoming (customer) message that's unread.
        const incomingUnread =
          msg.read === false &&
          (msg.senderType ? String(msg.senderType).toUpperCase() !== 'BUSINESS' : true);

        if (!grouped[key]) {
          grouped[key] = {
            customerId: key,
            customerName: msg.customerName || msg.senderName || 'Customer',
            lastMessage: msg.content || msg.message || '',
            lastDate: msg.createdAt || msg.sentAt,
            _lastTs: msgDate,
            unread: incomingUnread ? 1 : 0,
          };
        } else {
          if (incomingUnread) grouped[key].unread++;
          // Keep the most recent message as the preview.
          if (msgDate >= grouped[key]._lastTs) {
            grouped[key].lastMessage = msg.content || msg.message || '';
            grouped[key].lastDate = msg.createdAt || msg.sentAt;
            grouped[key]._lastTs = msgDate;
          }
          if (!grouped[key].customerName || grouped[key].customerName === 'Customer') {
            grouped[key].customerName = msg.customerName || msg.senderName || grouped[key].customerName;
          }
        }
      });
      // Sort conversations by most recent activity.
      const convList = Object.values(grouped).sort((a, b) => (b._lastTs || 0) - (a._lastTs || 0));
      setConversations(convList);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Determine if a message was sent by the business (this user) rather than the customer.
  // Rely on senderType/sender id — NOT businessUserId, since every message in a
  // business↔customer thread carries the same businessUserId.
  const isOwnMessage = (msg) => {
    if (msg.senderType) return String(msg.senderType).toUpperCase() === 'BUSINESS';
    const senderId = msg.senderId ?? msg.senderUserId ?? msg.fromUserId;
    if (senderId != null) return String(senderId) === String(user.id);
    return false;
  };

  const openConversation = async (conv) => {
    setSelectedConversation(conv);
    try {
      const res = await businessService.getConversation(conv.customerId, user.id);
      const list = Array.isArray(res) ? res : res?.content || [];
      setMessages(list);

      // Mark unread incoming (customer -> business) messages as read
      let markedAny = false;
      for (const msg of list) {
        const isIncoming = !isOwnMessage(msg);
        if (isIncoming && msg.read === false && msg.id) {
          try {
            await businessService.markMessageRead(msg.id);
            markedAny = true;
          } catch {}
        }
      }
      // Refresh the conversation list so the unread badge clears.
      if (markedAny) loadConversations();
    } catch {
      setMessages([]);
    }
  };

  // From the search modal: select a found customer and open the message form.
  const openConversationForCustomer = (customer) => {
    setShowNewMsgModal(false);
    setCustomerSearch('');
    setFoundCustomer(null);
    openConversation({
      customerId: customer.id,
      customerName: customer.name || 'Customer',
      customerEmail: customer.email || '',
      customerPhone: customer.phone || '',
    });
  };

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || sending) return;
    setSending(true);

    // Optimistic append so the message appears immediately.
    const optimistic = {
      id: `local-${Date.now()}`,
      content: text,
      senderType: 'BUSINESS',
      businessUserId: user.id,
      customerUserId: selectedConversation.customerId,
      createdAt: new Date().toISOString(),
      read: true,
      _pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMessage('');

    try {
      await businessService.sendMessage({
        content: text,
        businessUserId: user.id,
        customerUserId: selectedConversation.customerId,
        senderType: 'BUSINESS',
      });
      // Reconcile with the server copy.
      await openConversation(selectedConversation);
    } catch (err) {
      // Roll back the optimistic message and restore the draft.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMessage(text);
      Alert.alert('Error', err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSearchCustomer = async () => {
    if (!customerSearch.trim()) { Alert.alert('Error', 'Please enter an email or phone number'); return; }
    setSearchingCustomer(true);
    setFoundCustomer(null);

    const query = customerSearch.trim();

    try {
      // Global search endpoint returns { customers, businessUsers, rooms, ... }.
      const res = await businessService.search(query);
      const customers = res?.customers || [];

      if (customers.length > 0) {
        const c = customers[0];
        const fullName = [c.name, c.surname].filter(Boolean).join(' ').trim() || 'Customer';
        setFoundCustomer({
          id: c.id,
          name: fullName,
          email: c.email || '',
          phone: c.phoneNumber || '',
        });
      } else {
        Alert.alert('Not Found', 'No customer found with that email or phone number. Please check the details and try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not search right now. Please try again in a moment.');
    } finally {
      setSearchingCustomer(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadConversations(); };

  useRefreshOnFocus(useCallback(() => { loadConversations(); }, [user]));

  if (selectedConversation) {
    // Lift the input row above the keyboard. On Android the window resizes, so
    // we subtract the bottom inset that's already reclaimed; clamp at >= 0.
    const inputLift = keyboardHeight > 0 ? Math.max(keyboardHeight - insets.bottom, 0) : 0;
    return (
      <View style={styles.screen}>
        <View style={styles.chatHeader}>
          <TouchableOpacity style={[styles.chatBackBtn, { backgroundColor: colors.primary }]} onPress={() => setSelectedConversation(null)}>
            <AppIcon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatTitle} numberOfLines={1}>{selectedConversation.customerName}</Text>
            {(selectedConversation.customerEmail || selectedConversation.customerPhone) ? (
              <Text style={styles.chatSubtitle} numberOfLines={1}>
                {selectedConversation.customerEmail || selectedConversation.customerPhone}
              </Text>
            ) : null}
          </View>
          <View style={{ width: 36 }} />
        </View>
        <FlatList
          data={messages}
          keyExtractor={(item, idx) => String(item.id || idx)}
          renderItem={({ item }) => {
            const isOwn = isOwnMessage(item);
            return (
              <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, isOwn && { color: '#fff' }]}>
                  {item.content || item.message}
                </Text>
                <Text style={[styles.bubbleTime, isOwn && { color: '#d1fae5' }]}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
              </View>
            );
          }}
          contentContainerStyle={styles.chatList}
        />
        <View style={[styles.inputRow, { marginBottom: inputLift }]}>
          <TextInput
            style={styles.msgInput}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={handleSend}
            disabled={sending}
          >
            <AppIcon name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        {navigation.canGoBack() ? (
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
            <AppIcon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Messages</Text>
        </View>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, position: 'relative', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 18 }]} onPress={() => setShowNewMsgModal(true)}>
          <AppIcon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <Text style={styles.loadingText}>Loading conversations...</Text>
      ) : conversations.length === 0 ? (
        <Text style={styles.emptyText}>No messages yet.</Text>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.customerId)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.convCard} onPress={() => openConversation(item)}>
              <View style={[styles.convAvatar, { backgroundColor: colors.light }]}>
                <Text style={[styles.convAvatarText, { color: colors.primary }]}>
                  {item.customerName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.convInfo}>
                <Text style={styles.convName}>{item.customerName}</Text>
                <Text style={styles.convPreview} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              {item.unread > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* New Message Modal */}
      <Modal
        visible={showNewMsgModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewMsgModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Find a Customer</Text>
              <TouchableOpacity onPress={() => { setShowNewMsgModal(false); setFoundCustomer(null); setCustomerSearch(''); }}>
                <AppIcon name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>Search by email or phone number, then select the customer to message them.</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginBottom: 0, height: 48 }]}
                placeholder="Email or phone number"
                placeholderTextColor="#9ca3af"
                value={customerSearch}
                onChangeText={setCustomerSearch}
                autoCapitalize="none"
                keyboardType="email-address"
                onSubmitEditing={handleSearchCustomer}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[styles.searchBtn, { backgroundColor: colors.primary }]}
                onPress={handleSearchCustomer}
                disabled={searchingCustomer}
              >
                {searchingCustomer ? <Text style={styles.searchBtnText}>...</Text> : <AppIcon name="search" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>

            {foundCustomer && (
              <TouchableOpacity
                style={styles.foundCustomerCard}
                activeOpacity={0.7}
                onPress={() => openConversationForCustomer(foundCustomer)}
              >
                <View style={[styles.foundAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.foundAvatarText, { color: colors.primary }]}>
                    {(foundCustomer.name || 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.foundName}>{foundCustomer.name || 'Customer'}</Text>
                  {foundCustomer.email ? <Text style={styles.foundDetail}>{foundCustomer.email}</Text> : null}
                  {foundCustomer.phone ? <Text style={styles.foundDetail}>{foundCustomer.phone}</Text> : null}
                </View>
                <AppIcon name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}

            {foundCustomer && (
              <TouchableOpacity
                style={[styles.modalSendBtn, { backgroundColor: colors.primary }]}
                onPress={() => openConversationForCustomer(foundCustomer)}
              >
                <Text style={styles.modalSendBtnText}>Message {foundCustomer.name || 'Customer'}</Text>
              </TouchableOpacity>
            )}

            {!foundCustomer && !searchingCustomer && (
              <View style={styles.searchEmptyState}>
                <AppIcon name="search-outline" size={36} color="#d1d5db" style={styles.searchEmptyIcon} />
                <Text style={styles.searchEmptyText}>Search for a customer by email or phone to start a conversation.</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef', padding: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 44, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  convCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  convAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  convAvatarText: { fontSize: 16, fontWeight: 'bold' },
  convInfo: { flex: 1 },
  convName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  convPreview: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  unreadBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 40, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  chatBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chatBackIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  chatHeaderInfo: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  chatTitle: { fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center' },
  chatSubtitle: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 1 },
  chatList: { paddingVertical: 10, paddingHorizontal: 16, flexGrow: 1 },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 12, marginBottom: 8 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: '#0d9488' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  bubbleText: { fontSize: 14, color: '#111827' },
  bubbleTime: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  inputRow: { flexDirection: 'row', gap: 8, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  msgInput: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff', color: '#111827' },
  sendBtn: { width: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 18 },
  loadingText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40, fontSize: 14 },
  // FAB
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  fabText: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: -2 },
  // Modal — anchored to the bottom as a sheet so it clears the keyboard.
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, maxHeight: '85%' },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', marginBottom: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 22, color: '#6b7280', padding: 4 },
  modalLabel: { fontSize: 13, fontWeight: '500', color: '#6b7280', marginBottom: 4, marginTop: 8 },
  modalHint: { fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 17 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { fontSize: 18, color: '#fff' },
  searchEmptyState: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  searchEmptyIcon: { fontSize: 36, marginBottom: 10 },
  searchEmptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 19 },
  foundCustomerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  foundAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  foundAvatarText: { fontSize: 14, fontWeight: '700' },
  foundName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  foundDetail: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  foundCheck: { fontSize: 18, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  orText: { paddingHorizontal: 10, fontSize: 11, color: '#9ca3af' },
  modalInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', marginBottom: 8 },
  modalSendBtn: { marginTop: 12, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  modalSendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
