import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import storage from '../../utils/storage';
import apiClient from '../../api/client';

export default function ReactivateScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEmail();
  }, []);

  const loadEmail = async () => {
    const stored = await storage.getItem('crm_reactivate_email');
    if (stored) setEmail(stored);
  };

  const handleSend = async () => {
    if (!email) { setError('No email found.'); return; }
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/auth/reactivate?email=${encodeURIComponent(email)}`);
      setSent(true);
      await storage.deleteItem('crm_reactivate_email');
    } catch (err) {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.message || 'Unable to send reactivation link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Touround CRM</Text>
      </View>
      <View style={styles.card}>
        {sent ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.desc}>We've sent a reactivation link to {email}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>Profile Deactivated</Text>
            <Text style={styles.desc}>Your business profile is currently deactivated.</Text>
            {email ? <Text style={{ fontWeight: '500', marginBottom: 16 }}>{email}</Text> : null}
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSend} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reactivation Link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={[styles.button, { backgroundColor: '#f3f4f6', marginTop: 10 }]}>
              <Text style={[styles.buttonText, { color: '#374151' }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 30 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#2dd4bf' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  desc: { color: '#6b7280', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  button: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 14, alignItems: 'center', width: '100%' },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  link: { color: '#0d9488', fontWeight: '600', fontSize: 13 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 12, marginBottom: 14, width: '100%' },
  errorText: { color: '#b91c1c', fontSize: 13 },
});
