import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppStateProvider, useAppState } from './src/context/AppState';
import AuthScreen from './src/screens/AuthScreen';
import FamilySetupScreen from './src/screens/FamilySetupScreen';
import BoardScreen from './src/screens/BoardScreen';
import AddItemScreen from './src/screens/AddItemScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import type { RootStackParamList } from './src/navigation';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

function Root() {
  const { loading, session, family } = useAppState();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!session) return <AuthScreen />;
  if (!family) return <FamilySetupScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Board" component={BoardScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="AddItem"
        component={AddItemScreen}
        options={{ title: 'Add to board', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Capture"
        component={CaptureScreen}
        options={{ title: 'Capture', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Root />
      </NavigationContainer>
    </AppStateProvider>
  );
}
