import {
  ChakraPetch_600SemiBold,
  ChakraPetch_700Bold,
} from "@expo-google-fonts/chakra-petch";
import { FiraCode_400Regular, FiraCode_500Medium } from "@expo-google-fonts/fira-code";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  useFonts,
} from "@expo-google-fonts/manrope";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/lib/auth";
import { color } from "@/ui/tokens";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    // Splash screen acik kalir; oturum Secure Store'dan okunana kadar bekleriz
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg.base },
      }}
    >
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    FiraCode_400Regular,
    FiraCode_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
