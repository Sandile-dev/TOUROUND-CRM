import React, { useContext } from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import ReactivateScreen from '../screens/auth/ReactivateScreen';

// Main Screens
import DashboardScreen from '../screens/DashboardScreen';
import PostsScreen from '../screens/PostsScreen';
import ReservationsScreen from '../screens/ReservationsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import MoreMenuScreen from '../screens/MoreMenuScreen';

// More stack screens
import ServicesScreen from '../screens/ServicesScreen';
import ReviewsScreen from '../screens/ReviewsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AppSettingsScreen from '../screens/AppSettingsScreen';
import SalesScreen from '../screens/SalesScreen';
import CustomersScreen from '../screens/CustomersScreen';
import TicketsScreen from '../screens/TicketsScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import PromotionsScreen from '../screens/PromotionsScreen';
import StaffScreen from '../screens/StaffScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MoreStackNav = createNativeStackNavigator();

function TabIcon({ label, focused, color }) {
  // Base Ionicons name per tab; append '-outline' when not focused.
  const baseIcons = {
    Home: 'home',
    Bookings: 'calendar',
    Posts: 'create',
    Chat: 'chatbubble',
    More: 'menu',
  };
  const base = baseIcons[label] || 'ellipse';
  // 'menu' has no outline variant; keep it as-is.
  const iconName = focused || base === 'menu' ? base : `${base}-outline`;
  return (
    <View style={tabStyles.iconWrap}>
      <Ionicons name={iconName} size={24} color={color} />
      <Text style={[tabStyles.label, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 6, width: 80 },
  icon: { fontSize: 26, opacity: 0.5 },
  label: { fontSize: 12, marginTop: 3, fontWeight: '500' },
});

function MoreStack() {
  return (
    <MoreStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MoreStackNav.Screen name="MoreMenu" component={MoreMenuScreen} />
      <MoreStackNav.Screen name="Services" component={ServicesScreen} />
      <MoreStackNav.Screen name="Reviews" component={ReviewsScreen} />
      <MoreStackNav.Screen name="Analytics" component={AnalyticsScreen} />
      <MoreStackNav.Screen name="Sales" component={SalesScreen} />
      <MoreStackNav.Screen name="Customers" component={CustomersScreen} />
      <MoreStackNav.Screen name="Tickets" component={TicketsScreen} />
      <MoreStackNav.Screen name="Payments" component={PaymentsScreen} />
      <MoreStackNav.Screen name="Promotions" component={PromotionsScreen} />
      <MoreStackNav.Screen name="Staff" component={StaffScreen} />
      <MoreStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <MoreStackNav.Screen name="Settings" component={SettingsScreen} />
      <MoreStackNav.Screen name="AppSettings" component={AppSettingsScreen} />
    </MoreStackNav.Navigator>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Base bar (content) height plus the device's bottom inset so the tab bar
  // renders above the Android system navigation buttons / gesture bar.
  const barContentHeight = 60;
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#6b7280',
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: barContentHeight + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 4,
          paddingHorizontal: 16,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Home" focused={focused} color={color} /> }}
      />
      <Tab.Screen
        name="Reservations"
        component={ReservationsScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Bookings" focused={focused} color={color} /> }}
      />
      <Tab.Screen
        name="Posts"
        component={PostsScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Posts" focused={focused} color={color} /> }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Chat" focused={focused} color={color} /> }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="More" focused={focused} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2bb5c4" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="Reactivate" component={ReactivateScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
