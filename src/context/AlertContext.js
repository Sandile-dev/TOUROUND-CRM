import React, { createContext, useContext, useState, useCallback } from 'react';
import { Alert as RNAlert } from 'react-native';
import CustomAlert from '../components/CustomAlert';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);

  const hideAlert = useCallback(() => setAlert(null), []);

  const showSuccess = useCallback((title, message) => setAlert({ type: 'success', title, message }), []);
  const showError = useCallback((title, message) => setAlert({ type: 'error', title: title || 'Error', message }), []);
  const showInfo = useCallback((title, message) => setAlert({ type: 'info', title, message }), []);
  const showConfirm = useCallback((title, message, onConfirm, confirmText, cancelText) =>
    setAlert({ type: 'confirm', title, message, onConfirm, confirmText, cancelText }), []);

  // Override global Alert.alert so existing code uses custom alerts
  RNAlert.alert = (title, message, buttons) => {
    if (buttons && buttons.length > 1) {
      // Has cancel + action (confirm dialog)
      const destructiveBtn = buttons.find(b => b.style === 'destructive');
      const cancelBtn = buttons.find(b => b.style === 'cancel');
      const actionBtn = destructiveBtn || buttons.find(b => b.style !== 'cancel');
      setAlert({
        type: 'confirm',
        title,
        message,
        onConfirm: actionBtn?.onPress,
        confirmText: actionBtn?.text || 'Confirm',
        cancelText: cancelBtn?.text || 'Cancel',
      });
    } else if (buttons && buttons.length === 1 && buttons[0].onPress) {
      // Single button with action
      const isSuccess = title?.toLowerCase().includes('success');
      setAlert({
        type: isSuccess ? 'success' : 'info',
        title,
        message,
        onConfirm: buttons[0].onPress,
      });
    } else {
      // Simple alert (error or info)
      const isError = title?.toLowerCase().includes('error') || title?.toLowerCase().includes('fail');
      const isSuccess = title?.toLowerCase().includes('success') || title?.toLowerCase().includes('saved');
      setAlert({
        type: isError ? 'error' : isSuccess ? 'success' : 'info',
        title,
        message,
      });
    }
  };

  return (
    <AlertContext.Provider value={{ showSuccess, showError, showInfo, showConfirm }}>
      {children}
      <CustomAlert alert={alert} onClose={hideAlert} />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}
