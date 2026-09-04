import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import authService from '../../api/authService';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.logo}>Touround CRM</Text>
        <Text style={styles.subtitle}>Reset your password</Text>
      </View>
      <View style={styles.card}>
        {sent ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.desc}>We've sent a password reset link to {email}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.desc}>Enter your email and we'll send you a reset link.</Text>
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Enter your email" />
            <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
              <Text style={styles.link}>Back to Sign In</Text>
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
  subtitle: { color: '#9ca3af', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  desc: { color: '#6b7280', fontSize: 13, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 14 },
  button: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  link: { color: '#0d9488', fontWeight: '600', fontSize: 13 },
  linkWrap: { alignItems: 'center', marginTop: 14 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: '#b91c1c', fontSize: 13 },
});
