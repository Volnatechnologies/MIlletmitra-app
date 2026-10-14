import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, type ComponentProps } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type WellnessGoal = 'blood-sugar-aware' | 'digestive-comfort' | 'heart-healthy' | 'skin-wellness';

export type AuthProfile = {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  goals: WellnessGoal[];
  hasWellnessConsent: boolean;
};

export type AuthSubmission = { name: string; email: string; password: string; goals: WellnessGoal[] };

export const wellnessGoalOptions: { id: WellnessGoal; label: string }[] = [
  { id: 'blood-sugar-aware', label: 'Blood-sugar-aware meals' },
  { id: 'digestive-comfort', label: 'Digestive comfort' },
  { id: 'heart-healthy', label: 'Heart-healthy eating' },
  { id: 'skin-wellness', label: 'Everyday skin wellness' },
];

export function AuthFlow({
  onSubmit,
  onResetPassword,
  backendMessage,
}: {
  onSubmit: (submission: AuthSubmission & { registering: boolean }) => Promise<string>;
  onResetPassword: (email: string) => Promise<string>;
  backendMessage?: string;
}) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [goals, setGoals] = useState<WellnessGoal[]>([]);
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleGoal(goal: WellnessGoal) {
    setGoals((current) => (
      current.includes(goal)
        ? current.filter((item) => item !== goal)
        : current.length < 2
          ? [...current, goal]
          : current
    ));
  }

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (isRegistering && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < (isRegistering ? 8 : 1)) {
      setError(isRegistering ? 'Use at least 8 characters for your password.' : 'Please enter your password.');
      return;
    }
    if (isRegistering && goals.length > 0 && !consented) {
      setError('Please consent before saving optional wellness preferences, or remove your selections.');
      return;
    }

    setError('');
    setMessage('');
    setBusy(true);
    try {
      const result = await onSubmit({
        name: name.trim() || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password,
        goals: isRegistering ? goals : [],
        registering: isRegistering,
      });
      setMessage(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not sign you in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email above first, then request a password reset.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage(await onResetPassword(normalizedEmail));
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'We could not send a password reset email.');
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setIsRegistering((current) => !current);
    setError('');
    setMessage('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.brandMark}><Feather name="feather" size={20} color={colors.green} /></View>
        <Text style={styles.brandName}>MilletBloom</Text>
        <Text style={styles.eyebrow}>GOODNESS, GROWN TOGETHER</Text>
        <Text style={styles.title}>{isRegistering ? 'A little about you.' : 'Welcome back.'}</Text>
        <Text style={styles.subtitle}>
          {isRegistering
            ? 'Create your account and choose what you would like to explore.'
            : 'Sign in to explore thoughtful grains and everyday goodness.'}
        </Text>

        <View style={styles.formCard}>
          {backendMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{backendMessage}</Text> : null}
          {isRegistering ? (
            <Field label="Your name" value={name} onChangeText={setName} placeholder="How should we call you?" autoCapitalize="words" />
          ) : null}
          <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" value={password} onChangeText={setPassword} placeholder={isRegistering ? 'At least 8 characters' : 'Your password'} secureTextEntry autoCapitalize="none" />

          {isRegistering ? (
            <View style={styles.goalsSection}>
              <Text style={styles.fieldLabel}>What would you like to focus on?</Text>
              <Text style={styles.helperText}>Optional. Choose up to two, or skip this step.</Text>
              <View style={styles.goalList}>
                {wellnessGoalOptions.map((goal) => {
                  const selected = goals.includes(goal.id);
                  const disabled = !selected && goals.length >= 2;
                  return (
                    <Pressable
                      key={goal.id}
                      disabled={disabled}
                      onPress={() => toggleGoal(goal.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled }}
                      style={[styles.goalOption, selected && styles.goalOptionSelected, disabled && styles.goalOptionDisabled]}
                    >
                      <Feather name={selected ? 'check-square' : 'square'} size={17} color={selected ? colors.green : colors.muted} />
                      <Text style={[styles.goalLabel, selected && styles.goalLabelSelected]}>{goal.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => setConsented((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consented }}
                style={styles.consentOption}
              >
                <Feather name={consented ? 'check-square' : 'square'} size={17} color={consented ? colors.green : colors.muted} />
                <Text style={styles.consentLabel}>I agree to save these optional wellness preferences to my account so the app can personalize general food ideas. I can remove them later.</Text>
              </Pressable>
              <Text style={styles.medicalNote}>These are general food ideas, not medical advice or treatment. Food cannot diagnose, treat, or cure a health or skin condition.</Text>
            </View>
          ) : null}

          {message ? <Text accessibilityRole="text" style={styles.messageText}>{message}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          <Pressable onPress={() => { void submit(); }} disabled={busy} style={[styles.submitButton, busy && styles.submitButtonDisabled]} accessibilityRole="button">
            <Text style={styles.submitLabel}>{busy ? 'Please wait…' : isRegistering ? 'Create my account' : 'Sign in'}</Text>
            <Feather name="arrow-right" size={17} color="#FFFFFF" />
          </Pressable>
          {!isRegistering ? (
            <Pressable onPress={() => { void resetPassword(); }} disabled={busy} style={styles.resetButton} accessibilityRole="button">
              <Text style={styles.resetLabel}>Forgot your password?</Text>
            </Pressable>
          ) : null}
          <View style={styles.modeRow}>
            <Text style={styles.modePrompt}>{isRegistering ? 'Already have an account?' : 'New to MilletBloom?'}</Text>
            <Pressable onPress={switchMode} accessibilityRole="button">
              <Text style={styles.modeAction}>{isRegistering ? 'Sign in' : 'Create account'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.demoNotice}>
          <Feather name="info" size={15} color={colors.green} />
          <Text style={styles.demoNoticeText}>Your account is secured by Supabase. Wellness selections are optional, require consent, and can be removed from your profile.</Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PasswordResetFlow({
  onSubmit,
}: {
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(password);
      setMessage('Your password has been updated.');
      setPassword('');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'We could not update your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.resetContent}>
          <View style={styles.brandMark}><Feather name="feather" size={20} color={colors.green} /></View>
          <Text style={styles.brandName}>MilletBloom</Text>
          <Text style={styles.title}>Choose a new password.</Text>
          <View style={styles.formCard}>
            <Field label="New password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />
            {message ? <Text style={styles.messageText}>{message}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Pressable onPress={() => { void submit(); }} disabled={busy} style={[styles.submitButton, busy && styles.submitButtonDisabled]} accessibilityRole="button">
              <Text style={styles.submitLabel}>{busy ? 'Please wait…' : 'Update password'}</Text>
              <Feather name="arrow-right" size={17} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  ...inputProps
}: {
  label: string;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholderTextColor="#8A8E84"
        returnKeyType="next"
      />
    </View>
  );
}

const colors = {
  ink: '#1B2C20',
  green: '#204B30',
  deepGreen: '#153B26',
  leaf: '#6F9569',
  pale: '#F7F6EF',
  muted: '#70776D',
  line: '#EDECE4',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pale },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 23, paddingTop: 30, paddingBottom: 28 },
  resetContent: { paddingHorizontal: 23 },
  brandMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#E5EFDC', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  brandName: { color: colors.deepGreen, fontSize: 23, fontWeight: '800', letterSpacing: -0.7, textAlign: 'center', marginTop: 10 },
  eyebrow: { color: colors.leaf, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginTop: 4 },
  title: { color: colors.ink, fontSize: 28, letterSpacing: -0.9, fontWeight: '800', marginTop: 27 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 19 },
  formCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18 },
  field: { marginBottom: 14 },
  fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 47, borderWidth: 1, borderColor: '#E7E7DE', borderRadius: 12, paddingHorizontal: 13, color: colors.ink, fontSize: 13, backgroundColor: '#FCFCF9' },
  goalsSection: { marginTop: 4 },
  helperText: { color: colors.muted, fontSize: 10, marginTop: -2 },
  goalList: { gap: 8, marginTop: 10 },
  goalOption: { minHeight: 42, borderWidth: 1, borderColor: '#E7E7DE', borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  goalOptionSelected: { borderColor: '#AFC5A5', backgroundColor: '#F1F6EC' },
  goalOptionDisabled: { opacity: 0.45 },
  goalLabel: { color: '#4F574D', fontSize: 11 },
  goalLabelSelected: { color: colors.deepGreen, fontWeight: '700' },
  consentOption: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 },
  consentLabel: { flex: 1, color: '#545B51', fontSize: 9, lineHeight: 14 },
  medicalNote: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 11 },
  errorText: { color: '#A33E35', fontSize: 11, marginTop: 2, marginBottom: 8 },
  messageText: { color: colors.green, fontSize: 11, lineHeight: 16, marginTop: 4 },
  submitButton: { minHeight: 49, borderRadius: 13, backgroundColor: colors.deepGreen, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  submitButtonDisabled: { opacity: 0.6 },
  submitLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  resetButton: { alignSelf: 'flex-end', paddingVertical: 10 },
  resetLabel: { color: colors.green, fontSize: 10, fontWeight: '700' },
  modeRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 15 },
  modePrompt: { color: colors.muted, fontSize: 10 },
  modeAction: { color: colors.green, fontSize: 10, fontWeight: '800' },
  demoNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 2, marginTop: 15 },
  demoNoticeText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14 },
});
