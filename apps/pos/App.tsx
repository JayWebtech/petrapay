import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenEnter } from './src/components/motion';
import { NavigationProvider, Route, useNav } from './src/navigation';
import { HomeScreen } from './src/screens/HomeScreen';
import { NewSaleScreen } from './src/screens/NewSaleScreen';
import { PairScreen } from './src/screens/PairScreen';
import { PaymentScreen } from './src/screens/PaymentScreen';
import { SalesScreen } from './src/screens/SalesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OfflineScreen, StartingScreen } from './src/screens/SplashScreens';
import { SessionProvider, useSession } from './src/state/session';
import { colors } from './src/theme';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { state } = useSession();
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      {state.status === 'starting' ? (
        <StartingScreen />
      ) : state.status === 'offline' ? (
        <OfflineScreen />
      ) : state.status === 'unpaired' ? (
        <ScreenEnter direction="swap">
          <PairScreen reason={state.reason} />
        </ScreenEnter>
      ) : (
        <NavigationProvider>
          <Router />
        </NavigationProvider>
      )}
    </View>
  );
}

function Router() {
  const { route, depth, direction } = useNav();
  const instance = route.name === 'payment' ? route.id : '';
  return (
    <ScreenEnter key={`${depth}:${route.name}:${instance}`} direction={direction}>
      {renderRoute(route)}
    </ScreenEnter>
  );
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'newSale':
      return <NewSaleScreen />;
    case 'payment':
      return <PaymentScreen key={route.id} id={route.id} initial={route.initial} />;
    case 'sales':
      return <SalesScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export default App;
