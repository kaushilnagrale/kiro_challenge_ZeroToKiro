import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RideScreen } from './src/screens/RideScreen';
import { RouteCompareScreen } from './src/screens/RouteCompareScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';

export type RootStackParamList = {
  Search: undefined;
  RouteCompare: undefined;
  Ride: undefined;
  Summary: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor="#0369a1" />
        <Stack.Navigator
          initialRouteName="Search"
          screenOptions={{
            headerStyle: { backgroundColor: '#0369a1' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#f0f9ff' },
          }}
        >
          <Stack.Screen
            name="Search"
            component={SearchScreen}
            options={{ title: 'PulseRoute', headerLargeTitle: true }}
          />
          <Stack.Screen
            name="RouteCompare"
            component={RouteCompareScreen}
            options={{ title: 'Choose Your Route' }}
          />
          <Stack.Screen
            name="Ride"
            component={RideScreen}
            options={{ title: 'Riding', headerBackVisible: false }}
          />
          <Stack.Screen
            name="Summary"
            component={SummaryScreen}
            options={{ title: 'Ride Summary', headerBackVisible: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
