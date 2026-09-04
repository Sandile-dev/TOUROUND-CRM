import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

/**
 * Custom styled alert modal to replace default Alert.alert()
 * 
 * Usage via AlertContext:
 *   const { showSuccess, showError, showConfirm, showInfo } = useAlert();
 *   showSuccess('Done!', 'Your action was successful.');
 *   showError('Error', 'Something went wrong.');
 *   showConfirm('Delete?', 'Are you sure?', () => {}, 'Delete', 'Cancel');
 */
export default function CustomAlert({ alert, onClose }) {
  if (!alert) return null;

  const { type = 'info', title, message, onConfirm, confirmText, cancelText } = alert;

  const config = {
    success: { icon: '\u2713', iconBg: '#dcfce7', iconColor: '#16a34a', btnBg: '#16a34a' },
    error: { icon: '!', iconBg: '#fef2f2', iconColor: '#dc2626', btnBg: '#dc2626' },
    confirm: { icon: '?', iconBg: '#fef3c7', iconColor: '#d97706', btnBg: '#d97706' },
    info: { icon: 'i', iconBg: '#dbeafe', iconColor: '#2563eb', btnBg: '#2563eb' },
  };

  const c = config[type] || config.info;

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: c.iconBg }]}>
            <Text style={[styles.icon, { color: c.iconColor }]}>{c.icon}</Text>
          </View>
          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}

          {type === 'confirm' ? (
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>{cancelText || 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: c.btnBg }]} onPress={() => { onClose(); onConfirm && onConfirm(); }}>
                <Text style={styles.confirmBtnText}>{confirmText || 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.okBtn, { backgroundColor: c.btnBg }]} onPress={onClose}>
              <Text style={styles.okBtnText}>OK</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 320 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  icon: { fontSize: 24, fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },
  confirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  okBtn: { width: '100%', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  okBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
