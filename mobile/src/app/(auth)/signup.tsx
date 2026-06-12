import { zodResolver } from "@hookform/resolvers/zod";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { TextField } from "@/ui/TextField";
import { color, space, type } from "@/ui/tokens";

const schema = z
  .object({
    // Yapistirma kaynakli bosluk/satir sonu karakterlerini dogrulamadan once kirp
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Gecerli bir e-posta gir.")),
    password: z.string().min(6, "Sifre en az 6 karakter olmali."),
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Sifreler eslesmiyor.",
  });

type FormValues = z.infer<typeof schema>;

export default function SignUpScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", passwordConfirm: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }
    // E-posta dogrulama aciksa session null doner; kullaniciyi bilgilendir
    if (!data.session) {
      setNeedsConfirmation(true);
    }
    // Session varsa RootNavigator otomatik olarak (tabs)'a gecirir;
    // backend ilk istekte free profili olusturur.
  };

  if (needsConfirmation) {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.brand}>HYROX COACH</Text>
            <Text style={styles.title}>E-postani dogrula</Text>
            <Text style={styles.subtitle}>
              Sana bir dogrulama baglantisi gonderdik. Baglantiya tikladiktan
              sonra giris yapabilirsin.
            </Text>
          </View>
          <Button label="Girise Don" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>HYROX COACH</Text>
          <Text style={styles.title}>Hesap olustur</Text>
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
                autoComplete="new-password"
              />
            )}
          />
          <Controller
            control={control}
            name="passwordConfirm"
            render={({ field, fieldState }) => (
              <TextField
                label="Sifre (tekrar)"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                secureTextEntry
              />
            )}
          />

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <Button label="Kayit Ol" onPress={handleSubmit(onSubmit)} loading={submitting} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zaten hesabin var mi? </Text>
          <Link href="/signin" style={styles.footerLink}>
            Giris yap
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
  subtitle: {
    ...type.body,
    color: color.text.secondary,
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
