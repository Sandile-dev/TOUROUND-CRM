import AsyncStorage from '@react-native-async-storage/async-storage';

const storage = {
  getItem: (key) => AsyncStorage.getItem(key).catch(() => null),
  setItem: (key, value) => AsyncStorage.setItem(key, value).catch(() => {}),
  deleteItem: (key) => AsyncStorage.removeItem(key).catch(() => {}),
};

export default storage;
