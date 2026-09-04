import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import authService from '../../api/authService';

export default function ResetPasswordScreen({ navigation, route }) {
  const token = route?.params?.token || '';
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (form.newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.newPassword !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (!token) { setError('Invalid or missing reset token'); return; }
    setLoading(true);
    try {
      await authService.resetPassword(token, form.newPassword);
      setSuccess(true);
      setTimeout(() => navigation.navigate('Login'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.logo}>Touround CRM</Text>
      </View>
      <View style={styles.card}>
        {success ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>Password Reset Successful</Text>
            <Text style={styles.desc}>Redirecting to sign in...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Reset Password</Text>
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
            <Text style={styles.label}>New Password</Text>
            <TextInput style={styles.input} value={form.newPassword} onChangeText={(t) => setForm({ ...form, newPassword: t })} secureTextEntry />
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput style={styles.input} value={form.confirmPassword} onChangeText={(t) => setForm({ ...form, confirmPassword: t })} secureTextEntry />
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? 'Resetting...' : 'Reset Password'}</Text>
            </TouchableOpacity>
          </>
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
  desc: { color: '#6b7280', fontSize: 13, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 14 },
  button: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: '#b91c1c', fontSize: 13 },
});
