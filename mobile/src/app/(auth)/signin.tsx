import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { color, space, type } from "@/ui/tokens";

const schema = z.object({
  // Yapistirma kaynakli bosluk/satir sonu karakterlerini dogrulamadan once kirp
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Gecerli bir e-posta gir.")),
  password: z.string().min(6, "Sifre en az 6 karakter olmali."),
});

type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);
    if (error) {
      setAuthError("Giris basarisiz. E-posta veya sifre hatali.");
    }
    // Basarili giriste oturum degisikligi RootNavigator'i (tabs)'a yonlendirir
  };

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>HYROX COACH</Text>
          <Text style={styles.title}>Tekrar hos geldin</Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <TextField
                label="E-posta"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <TextField
                label="Sifre"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
                autoComplete="password"
              />
            )}
          />

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <Button label="Giris Yap" onPress={handleSubmit(onSubmit)} loading={submitting} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Hesabin yok mu? </Text>
          <Link href="/signup" style={styles.footerLink}>
            Kayit ol
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: space.xxxl,
  },
  header: {
    gap: space.sm,
  },
  brand: {
    ...type.micro,
    color: color.accent.primary,
  },
  title: {
    ...type.heading1,
    color: color.text.primary,
  },
  form: {
    gap: space.lg,
  },
  authError: {
    ...type.small,
    color: color.status.danger,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  footerText: {
    ...type.small,
    color: color.text.secondary,
  },
  footerLink: {
    ...type.small,
    color: color.accent.primary,
    fontFamily: "Manrope_600SemiBold",
  },
});
