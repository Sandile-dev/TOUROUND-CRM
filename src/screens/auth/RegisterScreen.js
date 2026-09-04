import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import authService from '../../api/authService';
import businessService from '../../api/businessService';
import LocationPicker from '../../components/LocationPicker';

export default function RegisterScreen({ navigation }) {
  const { login } = useContext(AuthContext);
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    contactNumber: '', description: '', location: '', latitude: null, longitude: null, attractionId: '',
  });
  const [attractions, setAttractions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('register');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    fetchAttractions();
  }, []);

  const fetchAttractions = async () => {
    try {
      const data = await businessService.getAttractions();
      setAttractions(Array.isArray(data) ? data : data?.content || []);
    } catch {}
  };

  const handleSubmit = async () => {
    setError('');
    if (form.name.length < 3) { setError('Business name must be at least 3 characters'); return; }
    if (!form.email) { setError('Email is required'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(form.password)) { setError('Password must contain at least 1 uppercase letter'); return; }
    if (!/[a-z]/.test(form.password)) { setError('Password must contain at least 1 lowercase letter'); return; }
    if (!/[0-9]/.test(form.password)) { setError('Password must contain at least 1 number'); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password)) { setError('Password must contain at least 1 special character'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (!form.attractionId) { setError('Please select an attraction category'); return; }

    setLoading(true);
    try {
      const regData = {
        name: form.name,
        description: form.description,
        email: form.email,
        contactNumber: `+27${form.contactNumber.replace(/^0/, '')}`,
        password: form.password,
        location: form.location,
        latitude: form.latitude,
        longitude: form.longitude,
        verificationStatus: 'Yes',
        availabilityStatus: 'Open',
        attraction: { id: Number(form.attractionId) },
      };
      await authService.register(regData);
      setStep('verify');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) { setError('Please enter the 6-digit code'); return; }
    setVerifying(true);
    setError('');
    try {
      await authService.verifyEmail(form.email, verificationCode.trim());
      setShowSuccessModal(true);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (step === 'verify') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>Touround CRM</Text>
          <Text style={styles.subtitle}>Verify your email</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.desc}>We sent a 6-digit code to {form.email}</Text>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          <TextInput
            style={[styles.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
            value={verificationCode}
            onChangeText={(t) => setVerificationCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
          />
          <TouchableOpacity style={[styles.button, verifying && styles.buttonDisabled]} onPress={handleVerify} disabled={verifying}>
            <Text style={styles.buttonText}>{verifying ? 'Verifying...' : 'Verify Email'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStep('register')} style={styles.linkWrap}>
            <Text style={styles.link}>Go back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconWrap}>
              <Text style={styles.successIcon}>{'\u2713'}</Text>
            </View>
            <Text style={styles.successTitle}>Email Verified!</Text>
            <Text style={styles.successDesc}>Your account has been verified successfully. You can now sign in.</Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => { setShowSuccessModal(false); navigation.navigate('Login'); }}
            >
              <Text style={styles.successBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.logo}>Touround CRM</Text>
        <Text style={styles.subtitle}>Register your business</Text>
      </View>
      <View style={styles.card}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <Text style={styles.label}>Business Name</Text>
        <TextInput style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="Brief description" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Phone (+27)</Text>
        <TextInput style={styles.input} value={form.contactNumber} onChangeText={(t) => setForm({ ...form, contactNumber: t })} keyboardType="phone-pad" placeholder="712345678" />

        <Text style={styles.label}>Attraction Category</Text>
        <View style={styles.pickerWrap}>
          {attractions.map((a) => (
            <TouchableOpacity
              key={a.id}
              onPress={() => setForm({ ...form, attractionId: String(a.id) })}
              style={[styles.chip, form.attractionId === String(a.id) && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.attractionId === String(a.id) && styles.chipTextActive]}>{a.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Location</Text>
        <LocationPicker
          value={form.location}
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(addr, lat, lng) => setForm({ ...form, location: addr, latitude: lat, longitude: lng })}
          accentColor="#0d9488"
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} secureTextEntry={!showPassword} placeholder="Min 8 characters" placeholderTextColor="#9ca3af" />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eyeIcon}>{showPassword ? '\u{1F648}' : '\u{1F441}'}</Text>
          </TouchableOpacity>
        </View>
        {form.password.length > 0 && (
          <View style={styles.policyBox}>
            <Text style={[styles.policyItem, form.password.length >= 8 && styles.policyPass]}>
              {form.password.length >= 8 ? '\u2713' : '\u25CB'} At least 8 characters
            </Text>
            <Text style={[styles.policyItem, /[A-Z]/.test(form.password) && styles.policyPass]}>
              {/[A-Z]/.test(form.password) ? '\u2713' : '\u25CB'} 1 uppercase letter
            </Text>
            <Text style={[styles.policyItem, /[a-z]/.test(form.password) && styles.policyPass]}>
              {/[a-z]/.test(form.password) ? '\u2713' : '\u25CB'} 1 lowercase letter
            </Text>
            <Text style={[styles.policyItem, /[0-9]/.test(form.password) && styles.policyPass]}>
              {/[0-9]/.test(form.password) ? '\u2713' : '\u25CB'} 1 number
            </Text>
            <Text style={[styles.policyItem, /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password) && styles.policyPass]}>
              {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password) ? '\u2713' : '\u25CB'} 1 special character
            </Text>
          </View>
        )}

        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.passwordRow}>
          <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={form.confirmPassword} onChangeText={(t) => setForm({ ...form, confirmPassword: t })} secureTextEntry={!showConfirmPassword} placeholder="Re-enter password" placeholderTextColor="#9ca3af" />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Text style={styles.eyeIcon}>{showConfirmPassword ? '\u{1F648}' : '\u{1F441}'}</Text>
          </TouchableOpacity>
        </View>
        {form.confirmPassword.length > 0 && form.confirmPassword === form.password && (
          <Text style={styles.matchText}>{'\u2713'} Passwords match</Text>
        )}

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Business Account'}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#111827', padding: 20, paddingVertical: 40, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#2dd4bf' },
  subtitle: { color: '#9ca3af', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  desc: { color: '#6b7280', fontSize: 13, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 4 },
  button: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { backgroundColor: '#9ca3af' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  link: { color: '#0d9488', fontWeight: '600', fontSize: 13 },
  linkWrap: { alignItems: 'center', marginTop: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#6b7280', fontSize: 13 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff' },
  policyBox: { marginBottom: 12, marginTop: 4 },
  policyItem: { fontSize: 12, color: '#9ca3af', marginBottom: 3 },
  policyPass: { color: '#16a34a' },
  matchText: { fontSize: 12, color: '#16a34a', marginTop: 4, marginBottom: 10 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  eyeBtn: { position: 'absolute', right: 12, top: 12 },
  eyeIcon: { fontSize: 18 },
  // Success modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  successModal: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 320 },
  successIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successIcon: { fontSize: 28, color: '#16a34a' },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  successDesc: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  successBtn: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  successBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
