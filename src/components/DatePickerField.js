import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AppIcon from './AppIcon';

/**
 * A dependency-free date picker rendered as a calendar in a modal.
 * Value is an ISO date string (YYYY-MM-DD). Works on web and native.
 *
 * Props:
 *  - value: 'YYYY-MM-DD' | ''
 *  - onChange: (isoDate: string) => void
 *  - minDate: Date (optional) — dates before this are disabled (defaults to today)
 *  - placeholder: string
 */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISO(s) {
  if (!s) return null;
  const parts = String(s).split('-');
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(d.getTime()) ? null : d;
}

export default function DatePickerField({ value, onChange, minDate, placeholder = 'Select date' }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const selected = parseISO(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const floor = minDate || today;
  floor.setHours(0, 0, 0, 0);

  // The month currently shown in the calendar.
  const [viewDate, setViewDate] = useState(selected || today);

  const openPicker = () => {
    setViewDate(selected || today);
    setOpen(true);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build the calendar grid (leading blanks + day numbers).
  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const changeMonth = (delta) => setViewDate(new Date(year, month + delta, 1));

  const selectDay = (day) => {
    const picked = new Date(year, month, day);
    onChange(toISO(picked));
    setOpen(false);
  };

  const isDisabled = (day) => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d < floor;
  };

  const isSelected = (day) =>
    selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === day;

  const display = selected
    ? `${MONTHS[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}`
    : placeholder;

  return (
    <>
      <TouchableOpacity style={styles.trigger} activeOpacity={0.7} onPress={openPicker}>
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>{display}</Text>
        <AppIcon name="calendar-outline" size={18} color={colors.primary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.calendar} onStartShouldSetResponder={() => true}>
            {/* Month navigation */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
                <AppIcon name="chevron-back" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
                <AppIcon name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>{w}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (day === null) return <View key={`b${idx}`} style={styles.dayCell} />;
                const disabled = isDisabled(day);
                const sel = isSelected(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={styles.dayCell}
                    disabled={disabled}
                    onPress={() => selectDay(day)}
                  >
                    <View style={[styles.dayInner, sel && { backgroundColor: colors.primary }]}>
                      <Text style={[styles.dayText, disabled && styles.dayDisabled, sel && { color: '#fff', fontWeight: '700' }]}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10 },
  triggerText: { fontSize: 14, color: '#111827', fontWeight: '600' },
  placeholder: { color: '#9ca3af', fontWeight: '400' },
  calendarIcon: { fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  calendar: { backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '100%', maxWidth: 340 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  navText: { fontSize: 22, color: '#374151', marginTop: -2 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, color: '#111827' },
  dayDisabled: { color: '#d1d5db' },
  closeBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  closeText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
});
