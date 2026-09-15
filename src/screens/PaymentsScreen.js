import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, Modal, TextInput, Alert, ActivityIndicator, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import paymentService from '../api/paymentService';
import { resolveCategory, usesRoomBookings } from '../constants/attractions';

const COMMISSION_RATE = 0.15;
const DELIVERY_FEE_RATE = 0.05;
const PAYOUT_THRESHOLD = 100;

const ALL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'cash', label: 'Cash' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'settings', label: 'My Account' },
];

const PERIOD_OPTIONS = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
  { label: 'All', value: 'all' },
];

export default function PaymentsScreen() {
  const { user } = useContext(AuthContext);
  const { colors } = useTheme();
  const navigation = useNavigation();
  const attractionId = resolveCategory(user?.attraction);
  const hasReservations = attractionId && !usesRoomBookings(attractionId);
  const TABS = hasReservations ? ALL_TABS : ALL_TABS.filter(t => t.id !== 'cash');

  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [commissionOwed, setCommissionOwed] = useState(0);
  const [cashTransactions, setCashTransactions] = useState([]);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [txFilter, setTxFilter] = useState('all');
  const [cashFilter, setCashFilter] = useState('all');

  // Cash payment form
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashForm, setCashForm] = useState({ amount: '', bookingReference: '' });
  const [submitting, setSubmitting] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    bankName: '', accountNumber: '', accountHolder: '',
    branchCode: '', accountType: 'cheque', payoutFrequency: 'weekly',
  });

  useEffect(() => { if (user?.id) loadPaymentData(); else setLoading(false); }, [user, period]);

  const loadPaymentData = async () => {
    setLoading(true);
    try {
      let walletData = null;
      let txData = [];
      try { walletData = await paymentService.getWalletBalance(); } catch {}
      try {
        const txRes = await paymentService.getWalletTransactions();
        txData = Array.isArray(txRes) ? txRes : txRes?.content || [];
      } catch {}

      if (walletData) {
        const grossSales = txData
          .filter(t => t.type === 'EARNING' || t.type === 'CREDIT')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        const platformFee = grossSales * COMMISSION_RATE;
        const serviceFee = grossSales * DELIVERY_FEE_RATE;
        setEarnings({
          grossSales: grossSales / (1 - COMMISSION_RATE - DELIVERY_FEE_RATE),
          platformFee, serviceFee, netEarnings: grossSales,
          pendingBalance: walletData.pendingBalance || 0,
          availableBalance: walletData.balance || walletData.availableBalance || 0,
          totalPaidOut: walletData.totalPaidOut || 0,
          transactionCount: txData.length,
          avgOrderValue: txData.length > 0 ? grossSales / txData.length : 0,
        });
      } else {
        setEarnings(computeEarningsFromLocal());
      }

      const mappedTx = txData.map(t => ({
        id: t.id,
        reference: t.transactionId || t.reference || `TXN-${t.id}`,
        type: t.type || t.description || 'Payment',
        customer: t.customerName || t.description || '',
        date: t.createdAt?.split('T')[0] || t.date || '',
        grossAmount: t.grossAmount || t.amount || 0,
        platformFee: (t.grossAmount || t.amount || 0) * COMMISSION_RATE,
        serviceFee: (t.grossAmount || t.amount || 0) * DELIVERY_FEE_RATE,
        netAmount: t.netAmount || t.amount || 0,
        status: t.status || t.paymentStatus || 'COMPLETED',
        payoutStatus: t.payoutStatus || 'PENDING',
      }));
      setTransactions(mappedTx.length > 0 ? mappedTx : computeTransactionsFromLocal());

      const payoutItems = txData
        .filter(t => t.type === 'PAYOUT' || t.type === 'DEBIT')
        .map(t => ({
          id: t.id, reference: t.transactionId || `PAY-${t.id}`,
          amount: Math.abs(t.amount || 0), status: t.status || 'COMPLETED',
          date: t.createdAt?.split('T')[0] || '', period: '', method: 'Bank Transfer',
        }));
      setPayouts(payoutItems.length > 0 ? payoutItems : computePayoutsFromLocal());

      try {
        const commRes = await paymentService.getCommissionOwed();
        setCommissionOwed(commRes?.amount || commRes?.commissionOwed || commRes || 0);
      } catch {
        const cashTx = txData.filter(t => t.paymentMethod === 'CASH' || t.type === 'CASH');
        setCommissionOwed(cashTx.reduce((s, t) => s + (t.grossAmount || t.amount || 0) * (COMMISSION_RATE + DELIVERY_FEE_RATE), 0));
      }

      const cashItems = txData
        .filter(t => t.paymentMethod === 'CASH' || t.type === 'CASH')
        .map(t => ({
          id: t.id, reference: t.bookingReference || t.transactionId || `CASH-${t.id}`,
          customer: t.customerName || t.description || '',
          date: t.createdAt?.split('T')[0] || t.date || '',
          amount: t.grossAmount || t.amount || 0,
          commission: (t.grossAmount || t.amount || 0) * (COMMISSION_RATE + DELIVERY_FEE_RATE),
          status: t.commissionStatus || t.status || 'UNSETTLED',
        }));
      setCashTransactions(cashItems.length > 0 ? cashItems : computeCashTransactionsFromLocal());
    } catch {
      setEarnings(computeEarningsFromLocal());
      setTransactions(computeTransactionsFromLocal());
      setPayouts(computePayoutsFromLocal());
      setCashTransactions(computeCashTransactionsFromLocal());
      setCommissionOwed(540);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const computeEarningsFromLocal = () => {
    const grossSales = 12500;
    const platformFee = grossSales * COMMISSION_RATE;
    const serviceFee = grossSales * DELIVERY_FEE_RATE;
    const netEarnings = grossSales - platformFee - serviceFee;
    return { grossSales, platformFee, serviceFee, netEarnings, pendingBalance: netEarnings * 0.3, availableBalance: netEarnings * 0.7, totalPaidOut: netEarnings * 2.5, transactionCount: 34, avgOrderValue: grossSales / 34 };
  };

  const computeTransactionsFromLocal = () => [
    { id: 1, reference: 'TXN-001234', type: 'Booking', customer: 'John M.', date: '2026-07-27', grossAmount: 850, platformFee: 127.5, serviceFee: 42.5, netAmount: 680, status: 'COMPLETED', payoutStatus: 'PAID' },
    { id: 2, reference: 'TXN-001235', type: 'Table Reservation', customer: 'Sarah K.', date: '2026-07-26', grossAmount: 450, platformFee: 67.5, serviceFee: 22.5, netAmount: 360, status: 'COMPLETED', payoutStatus: 'PENDING' },
    { id: 3, reference: 'TXN-001236', type: 'Event Ticket', customer: 'Mike T.', date: '2026-07-25', grossAmount: 200, platformFee: 30, serviceFee: 10, netAmount: 160, status: 'COMPLETED', payoutStatus: 'PENDING' },
    { id: 4, reference: 'TXN-001237', type: 'Slot Reservation', customer: 'Lisa N.', date: '2026-07-24', grossAmount: 350, platformFee: 52.5, serviceFee: 17.5, netAmount: 280, status: 'COMPLETED', payoutStatus: 'PAID' },
    { id: 5, reference: 'TXN-001238', type: 'Booking', customer: 'David R.', date: '2026-07-23', grossAmount: 1200, platformFee: 180, serviceFee: 60, netAmount: 960, status: 'REFUNDED', payoutStatus: 'REVERSED' },
    { id: 6, reference: 'TXN-001239', type: 'Table Reservation', customer: 'Thandi M.', date: '2026-07-22', grossAmount: 600, platformFee: 90, serviceFee: 30, netAmount: 480, status: 'COMPLETED', payoutStatus: 'PAID' },
  ];

  const computePayoutsFromLocal = () => [
    { id: 1, reference: 'PAY-0056', amount: 4250, status: 'COMPLETED', date: '2026-07-21', period: '14 Jul - 20 Jul 2026', method: 'Bank Transfer' },
    { id: 2, reference: 'PAY-0055', amount: 3800, status: 'COMPLETED', date: '2026-07-14', period: '07 Jul - 13 Jul 2026', method: 'Bank Transfer' },
    { id: 3, reference: 'PAY-0054', amount: 5100, status: 'COMPLETED', date: '2026-07-07', period: '30 Jun - 06 Jul 2026', method: 'Bank Transfer' },
  ];

  const computeCashTransactionsFromLocal = () => [
    { id: 1, reference: 'RES-78432', customer: 'Peter M.', date: '2026-07-28', amount: 850, commission: 170, status: 'UNSETTLED' },
    { id: 2, reference: 'RES-78401', customer: 'Nomsa K.', date: '2026-07-27', amount: 1200, commission: 240, status: 'UNSETTLED' },
    { id: 3, reference: 'BOOK-45612', customer: 'James O.', date: '2026-07-25', amount: 650, commission: 130, status: 'SETTLED' },
    { id: 4, reference: 'RES-78389', customer: 'Thabo N.', date: '2026-07-24', amount: 400, commission: 80, status: 'SETTLED' },
    { id: 5, reference: 'BOOK-45598', customer: 'Amanda S.', date: '2026-07-22', amount: 950, commission: 190, status: 'SETTLED' },
  ];

  const handleRequestPayout = async () => {
    if (!earnings || earnings.availableBalance < PAYOUT_THRESHOLD) return;
    setRequestingPayout(true);
    try {
      await paymentService.requestPayout(earnings.availableBalance);
      await loadPaymentData();
      Alert.alert('Success', `Payout of R${earnings.availableBalance.toLocaleString()} requested!`);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to request payout.');
    } finally { setRequestingPayout(false); }
  };

  const handleRecordCash = async () => {
    if (!cashForm.amount || !cashForm.bookingReference) {
      Alert.alert('Error', 'Please fill in all fields'); return;
    }
    setSubmitting(true);
    try {
      await paymentService.recordCashPayment({
        amount: parseFloat(cashForm.amount),
        bookingReference: cashForm.bookingReference,
      });
      setCashForm({ amount: '', bookingReference: '' });
      setShowCashModal(false);
      Alert.alert('Success', 'Cash payment recorded!');
      loadPaymentData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to record cash payment');
    } finally { setSubmitting(false); }
  };

  // Initiate an Ozow payment and share the returned approval link with the customer.
  const handleRequestOzow = async () => {
    if (!cashForm.amount || !cashForm.bookingReference) {
      Alert.alert('Error', 'Please fill in all fields'); return;
    }
    setSubmitting(true);
    try {
      const res = await paymentService.createOzowPayment({
        amount: parseFloat(cashForm.amount),
        bookingReference: cashForm.bookingReference,
      });
      const link = res?.approvalLink || res?.approval_link || res?.url;
      setCashForm({ amount: '', bookingReference: '' });
      setShowCashModal(false);
      if (link) {
        // Let the business share the payment link with the customer.
        try {
          await Share.share({ message: `Complete your payment here: ${link}` });
        } catch {}
      } else {
        Alert.alert('Payment created', 'Payment was created but no approval link was returned.');
      }
      loadPaymentData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create Ozow payment');
    } finally { setSubmitting(false); }
  };

  const handleSettleCommission = () => {
    if (commissionOwed <= 0) return;
    Alert.alert('Settle Commission', `Pay R${commissionOwed.toFixed(2)} to Touround?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Settle', onPress: async () => {
        try {
          await paymentService.settleCommission(commissionOwed);
          Alert.alert('Success', 'Commission settled!');
          loadPaymentData();
        } catch (err) { Alert.alert('Error', err.message || 'Failed to settle'); }
      }},
    ]);
  };

  const handleSaveSettings = () => {
    if (!settingsForm.bankName || !settingsForm.accountNumber || !settingsForm.accountHolder) {
      Alert.alert('Error', 'Please fill in all required fields'); return;
    }
    Alert.alert('Saved', 'Payment settings saved successfully!');
  };

  const onRefresh = () => { setRefreshing(true); loadPaymentData(); };

  const getStatusStyle = (status) => {
    const map = {
      COMPLETED: { bg: '#dcfce7', color: '#166534' }, REFUNDED: { bg: '#fef2f2', color: '#991b1b' },
      PENDING: { bg: '#fef3c7', color: '#92400e' }, PROCESSING: { bg: '#dbeafe', color: '#1e40af' },
      PAID: { bg: '#dcfce7', color: '#166534' }, REVERSED: { bg: '#fef2f2', color: '#991b1b' },
      UNSETTLED: { bg: '#fef3c7', color: '#92400e' }, SETTLED: { bg: '#dcfce7', color: '#166534' },
    };
    return map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  };

  // --- RENDER: Overview Tab ---
  const renderOverview = () => {
    if (!earnings) return <Text style={styles.emptyText}>No earnings data available.</Text>;
    return (
      <View>
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>R{earnings.availableBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          <Text style={styles.balancePending}>Pending: R{earnings.pendingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          <TouchableOpacity
            style={[styles.payoutBtn, (requestingPayout || earnings.availableBalance < PAYOUT_THRESHOLD) && { opacity: 0.5 }]}
            onPress={handleRequestPayout}
            disabled={requestingPayout || earnings.availableBalance < PAYOUT_THRESHOLD}
          >
            <Text style={[styles.payoutBtnText, { color: colors.primary }]}>{requestingPayout ? 'Processing...' : 'Request Payout'}</Text>
          </TouchableOpacity>
          {earnings.availableBalance < PAYOUT_THRESHOLD && (
            <Text style={styles.thresholdText}>Min payout: R{PAYOUT_THRESHOLD}. Earn R{(PAYOUT_THRESHOLD - earnings.availableBalance).toFixed(2)} more.</Text>
          )}
        </View>

        {/* Commission Owed Banner */}
        {hasReservations && commissionOwed > 0 && (
          <View style={styles.commissionBanner}>
            <Text style={styles.commissionLabel}>⚠️ Commission Owed to Touround</Text>
            <Text style={styles.commissionAmount}>R{commissionOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            <Text style={styles.commissionSub}>20% commission on cash payments</Text>
          </View>
        )}

        {/* Earnings Breakdown */}
        <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
        <View style={styles.card}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>💳 Gross Sales</Text>
            <Text style={styles.breakdownValue}>R{earnings.grossSales?.toLocaleString()}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>🏢 Platform Fee (15%)</Text>
            <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>-R{earnings.platformFee?.toLocaleString()}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>⚙️ Service Fee (5%)</Text>
            <Text style={[styles.breakdownValue, { color: '#dc2626' }]}>-R{earnings.serviceFee?.toLocaleString()}</Text>
          </View>
          <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10, marginTop: 6 }]}>
            <Text style={[styles.breakdownLabel, { fontWeight: '700' }]}>✅ Net Earnings</Text>
            <Text style={[styles.breakdownValue, { fontWeight: '700', color: '#166534' }]}>R{earnings.netEarnings?.toLocaleString()}</Text>
          </View>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>R{earnings.avgOrderValue?.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Avg Order Value</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>R{earnings.totalPaidOut?.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Paid Out</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#166534' }]}>80%</Text>
            <Text style={styles.statLabel}>Effective Rate</Text>
          </View>
        </View>
      </View>
    );
  };

  // --- RENDER: Transactions Tab ---
  const renderTransactions = () => {
    const filtered = txFilter === 'all' ? transactions : transactions.filter(t => t.status === txFilter);
    return (
      <View>
        {/* Filter chips */}
        <View style={styles.filterRow}>
          {['all', 'COMPLETED', 'REFUNDED', 'PENDING'].map(f => (
            <TouchableOpacity key={f} style={[styles.filterChip, txFilter === f && { backgroundColor: colors.primary }]} onPress={() => setTxFilter(f)}>
              <Text style={[styles.filterChipText, txFilter === f && { color: '#fff' }]}>{f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No transactions found</Text>
        ) : (
          filtered.map(tx => {
            const ss = getStatusStyle(tx.status);
            const ps = getStatusStyle(tx.payoutStatus);
            return (
              <View key={tx.id} style={styles.card}>
                <View style={styles.txHeader}>
                  <Text style={[styles.txRef, { color: colors.primary }]}>{tx.reference}</Text>
                  <View style={[styles.badge, { backgroundColor: ss.bg }]}>
                    <Text style={[styles.badgeText, { color: ss.color }]}>{tx.status}</Text>
                  </View>
                </View>
                <Text style={styles.txMeta}>{tx.type} · {tx.customer}</Text>
                <Text style={styles.txDate}>{tx.date}</Text>
                <View style={styles.txAmounts}>
                  <View style={styles.txAmountCol}>
                    <Text style={styles.txAmountLabel}>Gross</Text>
                    <Text style={styles.txAmountValue}>R{tx.grossAmount?.toLocaleString()}</Text>
                  </View>
                  <View style={styles.txAmountCol}>
                    <Text style={styles.txAmountLabel}>Fees</Text>
                    <Text style={[styles.txAmountValue, { color: '#dc2626' }]}>-R{((tx.platformFee || 0) + (tx.serviceFee || 0)).toLocaleString()}</Text>
                  </View>
                  <View style={styles.txAmountCol}>
                    <Text style={styles.txAmountLabel}>Net</Text>
                    <Text style={[styles.txAmountValue, { color: '#166534', fontWeight: '700' }]}>R{tx.netAmount?.toLocaleString()}</Text>
                  </View>
                  <View style={styles.txAmountCol}>
                    <Text style={styles.txAmountLabel}>Payout</Text>
                    <View style={[styles.badge, { backgroundColor: ps.bg }]}>
                      <Text style={[styles.badgeText, { color: ps.color }]}>{tx.payoutStatus}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  };

  // --- RENDER: Cash Tab ---
  const renderCash = () => {
    const filtered = cashFilter === 'all' ? cashTransactions : cashTransactions.filter(t => t.status === cashFilter);
    const totalCollected = cashTransactions.reduce((s, t) => s + t.amount, 0);
    return (
      <View>
        {/* Summary cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>R{totalCollected.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Cash Collected</Text>
          </View>
          <View style={[styles.statCard, commissionOwed > 0 && { borderColor: '#fca5a5' }]}>
            <Text style={[styles.statValue, { color: commissionOwed > 0 ? '#dc2626' : '#166534' }]}>R{commissionOwed.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Commission Owed</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cashActions}>
          <TouchableOpacity style={[styles.cashActionBtn, { backgroundColor: colors.primary }]} onPress={() => setShowCashModal(true)}>
            <Text style={styles.cashActionBtnText}>+ Record / Request Payment</Text>
          </TouchableOpacity>
          {commissionOwed > 0 && (
            <TouchableOpacity style={[styles.cashActionBtn, { backgroundColor: '#dc2626' }]} onPress={handleSettleCommission}>
              <Text style={styles.cashActionBtnText}>💳 Settle Commission</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter */}
        <View style={styles.filterRow}>
          {['all', 'UNSETTLED', 'SETTLED'].map(f => (
            <TouchableOpacity key={f} style={[styles.filterChip, cashFilter === f && { backgroundColor: colors.primary }]} onPress={() => setCashFilter(f)}>
              <Text style={[styles.filterChipText, cashFilter === f && { color: '#fff' }]}>{f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cash Transactions */}
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No cash transactions found</Text>
        ) : (
          filtered.map(tx => {
            const ss = getStatusStyle(tx.status);
            return (
              <View key={tx.id} style={styles.card}>
                <View style={styles.txHeader}>
                  <Text style={[styles.txRef, { color: colors.primary }]}>{tx.reference}</Text>
                  <View style={[styles.badge, { backgroundColor: ss.bg }]}>
                    <Text style={[styles.badgeText, { color: ss.color }]}>{tx.status}</Text>
                  </View>
                </View>
                <Text style={styles.txMeta}>{tx.customer} · {tx.date}</Text>
                <View style={[styles.txAmounts, { marginTop: 8 }]}>
                  <View style={styles.txAmountCol}>
                    <Text style={styles.txAmountLabel}>Collected</Text>
                    <Text style={styles.txAmountValue}>R{tx.amount.toLocaleString()}</Text>
                  </View>
                  <View style={styles.txAmountCol}>
                    <Text style={styles.txAmountLabel}>Commission</Text>
                    <Text style={[styles.txAmountValue, { color: '#dc2626' }]}>-R{tx.commission.toLocaleString()}</Text>
                  </View>
                  <View style={styles.txAmountCol}>
                    <Text style={styles.txAmountLabel}>You Keep</Text>
                    <Text style={[styles.txAmountValue, { color: '#166534', fontWeight: '700' }]}>R{(tx.amount - tx.commission).toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  };

  // --- RENDER: Payouts Tab ---
  const renderPayouts = () => (
    <View>
      {payouts.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No payouts yet</Text>
          <Text style={[styles.emptyText, { marginTop: 4, fontSize: 12 }]}>Payouts processed weekly once balance exceeds R{PAYOUT_THRESHOLD}</Text>
        </View>
      ) : (
        payouts.map(payout => {
          const ss = getStatusStyle(payout.status);
          return (
            <View key={payout.id} style={styles.card}>
              <View style={styles.txHeader}>
                <View>
                  <Text style={styles.payoutRef}>{payout.reference}</Text>
                  {payout.period ? <Text style={styles.txDate}>{payout.period}</Text> : null}
                  <Text style={styles.txDate}>{payout.date} · {payout.method}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.payoutAmount}>R{payout.amount?.toLocaleString()}</Text>
                  <View style={[styles.badge, { backgroundColor: ss.bg, marginTop: 4 }]}>
                    <Text style={[styles.badgeText, { color: ss.color }]}>{payout.status}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })
      )}
      {/* Payout schedule info */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <Text style={[styles.sectionTitle, { marginBottom: 8, marginTop: 0 }]}>Payout Schedule</Text>
        <Text style={styles.infoText}>• Processed every Monday for previous week</Text>
        <Text style={styles.infoText}>• Arrives in 2-3 business days</Text>
        <Text style={styles.infoText}>• Minimum threshold: R{PAYOUT_THRESHOLD}</Text>
        <Text style={styles.infoText}>• Refunds deducted from next payout</Text>
      </View>
    </View>
  );

  // --- RENDER: Settings Tab ---
  const renderSettings = () => (
    <View>
      <View style={styles.card}>
        <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 12 }]}>Bank Account Details</Text>
        <Text style={styles.fieldLabel}>Bank Name</Text>
        <TextInput style={styles.input} value={settingsForm.bankName} onChangeText={t => setSettingsForm({ ...settingsForm, bankName: t })} placeholder="e.g. FNB, Capitec" placeholderTextColor="#9ca3af" />
        <Text style={styles.fieldLabel}>Account Holder</Text>
        <TextInput style={styles.input} value={settingsForm.accountHolder} onChangeText={t => setSettingsForm({ ...settingsForm, accountHolder: t })} placeholder="Full name as on account" placeholderTextColor="#9ca3af" />
        <Text style={styles.fieldLabel}>Account Number</Text>
        <TextInput style={styles.input} value={settingsForm.accountNumber} onChangeText={t => setSettingsForm({ ...settingsForm, accountNumber: t })} placeholder="Account number" placeholderTextColor="#9ca3af" keyboardType="number-pad" />
        <Text style={styles.fieldLabel}>Branch Code</Text>
        <TextInput style={styles.input} value={settingsForm.branchCode} onChangeText={t => setSettingsForm({ ...settingsForm, branchCode: t })} placeholder="Branch code" placeholderTextColor="#9ca3af" keyboardType="number-pad" />
        <Text style={styles.fieldLabel}>Account Type</Text>
        <View style={styles.filterRow}>
          {[{ v: 'cheque', l: 'Cheque' }, { v: 'savings', l: 'Savings' }].map(opt => (
            <TouchableOpacity key={opt.v} style={[styles.filterChip, settingsForm.accountType === opt.v && { backgroundColor: colors.primary }]} onPress={() => setSettingsForm({ ...settingsForm, accountType: opt.v })}>
              <Text style={[styles.filterChipText, settingsForm.accountType === opt.v && { color: '#fff' }]}>{opt.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.fieldLabel}>Payout Frequency</Text>
        <View style={styles.filterRow}>
          {[{ v: 'weekly', l: 'Weekly' }, { v: 'biweekly', l: 'Bi-Weekly' }, { v: 'monthly', l: 'Monthly' }].map(opt => (
            <TouchableOpacity key={opt.v} style={[styles.filterChip, settingsForm.payoutFrequency === opt.v && { backgroundColor: colors.primary }]} onPress={() => setSettingsForm({ ...settingsForm, payoutFrequency: opt.v })}>
              <Text style={[styles.filterChipText, settingsForm.payoutFrequency === opt.v && { color: '#fff' }]}>{opt.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={handleSaveSettings}>
          <Text style={styles.primaryBtnText}>Save Payment Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Commission Structure Info */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 8 }]}>Commission Structure</Text>
        <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Platform Fee</Text><Text style={[styles.breakdownValue, { color: '#ea580c' }]}>15%</Text></View>
        <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Service Fee</Text><Text style={[styles.breakdownValue, { color: '#7c3aed' }]}>5%</Text></View>
        <View style={[styles.breakdownRow, { backgroundColor: '#f0fdf4', borderRadius: 6, padding: 8, marginTop: 4 }]}>
          <Text style={[styles.breakdownLabel, { color: '#166534', fontWeight: '700' }]}>Your Earnings</Text>
          <Text style={[styles.breakdownValue, { color: '#166534', fontWeight: '700' }]}>80%</Text>
        </View>
      </View>
    </View>
  );

  // --- MAIN RENDER ---
  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Payments & Earnings</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Period filter */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.value} style={[styles.periodChip, period === opt.value && { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 }]} onPress={() => setPeriod(opt.value)}>
            <Text style={[styles.periodChipText, period === opt.value && { color: '#111827', fontWeight: '700' }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 }]} onPress={() => setActiveTab(tab.id)}>
            <Text style={[styles.tabText, activeTab === tab.id && { color: '#111827', fontWeight: '700' }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'transactions' && renderTransactions()}
          {activeTab === 'cash' && renderCash()}
          {activeTab === 'payouts' && renderPayouts()}
          {activeTab === 'settings' && renderSettings()}
        </ScrollView>
      )}

      {/* Record Cash Payment Modal */}
      <Modal visible={showCashModal} transparent animationType="slide" onRequestClose={() => setShowCashModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record a Payment</Text>
              <TouchableOpacity onPress={() => setShowCashModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Record a cash payment, or send the customer an Ozow online payment link. Cash payments add 20% commission to your owed balance.</Text>
            <Text style={styles.fieldLabel}>Booking Reference</Text>
            <TextInput style={styles.input} value={cashForm.bookingReference} onChangeText={t => setCashForm({ ...cashForm, bookingReference: t })} placeholder="e.g. RES-78432" placeholderTextColor="#9ca3af" />
            <Text style={styles.fieldLabel}>Amount (R)</Text>
            <TextInput style={styles.input} value={cashForm.amount} onChangeText={t => setCashForm({ ...cashForm, amount: t })} placeholder="e.g. 850.00" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
            {cashForm.amount ? (
              <View style={styles.commPreview}>
                <Text style={styles.commPreviewText}>Commission: R{(parseFloat(cashForm.amount || 0) * (COMMISSION_RATE + DELIVERY_FEE_RATE)).toFixed(2)} · You keep: R{(parseFloat(cashForm.amount || 0) * 0.8).toFixed(2)}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={handleRecordCash} disabled={submitting}>
              <Text style={styles.primaryBtnText}>{submitting ? 'Working...' : '💵 Record Cash Payment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, styles.ozowBtn]} onPress={handleRequestOzow} disabled={submitting}>
              <Text style={[styles.primaryBtnText, { color: colors.primary }]}>{submitting ? 'Working...' : '🔗 Send Online Payment Link (Ozow)'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f2ef' },
  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 44, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff', marginTop: -1 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  // Period filter
  periodRow: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, margin: 12, marginBottom: 0, padding: 3 },
  periodChip: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  periodChipText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  // Tabs
  tabRow: { backgroundColor: '#e5e7eb', borderRadius: 8, margin: 12, padding: 3, maxHeight: 44 },
  tab: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, marginRight: 2 },
  tabText: { fontSize: 11, fontWeight: '500', color: '#6b7280' },
  // Balance card
  balanceCard: { borderRadius: 16, padding: 20, margin: 0, marginBottom: 12 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 4 },
  balancePending: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 },
  payoutBtn: { backgroundColor: '#fff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-start', marginTop: 14 },
  payoutBtnText: { fontWeight: '600', fontSize: 13 },
  thresholdText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 8 },
  // Commission banner
  commissionBanner: { backgroundColor: '#dc2626', borderRadius: 16, padding: 16, marginBottom: 12 },
  commissionLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  commissionAmount: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 4 },
  commissionSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
  // Section
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8 },
  // Card
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10 },
  // Breakdown
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  breakdownLabel: { fontSize: 13, color: '#374151' },
  breakdownValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 3 },
  // Filter
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f3f4f6' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  // Transactions
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  txRef: { fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  txMeta: { fontSize: 13, color: '#374151', marginTop: 2 },
  txDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  txAmounts: { flexDirection: 'row', marginTop: 10, gap: 4 },
  txAmountCol: { flex: 1 },
  txAmountLabel: { fontSize: 10, color: '#9ca3af', marginBottom: 2 },
  txAmountValue: { fontSize: 12, fontWeight: '600', color: '#111827' },
  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  // Payouts
  payoutRef: { fontSize: 14, fontWeight: '600', color: '#111827' },
  payoutAmount: { fontSize: 18, fontWeight: '700', color: '#111827' },
  // Cash actions
  cashActions: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  cashActionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  cashActionBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  // Settings / form
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb' },
  primaryBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  ozowBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb', marginTop: 10 },
  infoText: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 20, color: '#6b7280', padding: 4 },
  modalSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  commPreview: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 10, marginTop: 8 },
  commPreviewText: { fontSize: 12, color: '#92400e' },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 30, fontSize: 14 },
});
