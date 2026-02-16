import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace("/");
    } catch (e: any) {
      setError(e.message || "Login failed. Please try again.");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + webTopInset + 60,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="bicycle" size={36} color={Colors.dark.tint} />
          </View>
          <Text style={styles.brandName}>Rinzo</Text>
          <Text style={styles.subtitle}>Delivery Partner</Text>
        </View>

        <View style={styles.form}>
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.dark.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.dark.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.dark.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={Colors.dark.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isSubmitting}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={12}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={Colors.dark.textMuted}
              />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
              isSubmitting && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          Contact your manager for account access
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.dark.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  brandName: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  form: {
    gap: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 75, 110, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 75, 110, 0.2)",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.danger,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.dark.text,
    paddingVertical: 16,
  },
  eyeBtn: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  loginButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#0D0F14",
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.dark.textMuted,
    textAlign: "center",
    marginTop: 32,
  },
});
