import { Feather, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import type { User } from '@supabase/supabase-js';
import { AuthFlow, PasswordResetFlow, type AuthProfile, type AuthSubmission, type WellnessGoal, wellnessGoalOptions } from './AuthFlow';
import {
  checkInToCampaign,
  joinCampaign,
  leaveCampaign,
  loadCampaignProgress,
  loadCampaigns,
  loadCart,
  loadFavorites,
  loadProducts,
  loadProfile,
  replaceCart,
  saveFavorite,
  saveWellnessGoals,
} from './lib/backend';
import type { Campaign, Product } from './lib/backend.types';
import { isBackendConfigured, supabase } from './lib/supabase';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

type Tab = 'Discover' | 'Shop' | 'Health' | 'Campaigns' | 'Bag' | 'Profile';
type CartLine = { product: Product; size: string; price: number; quantity: number };

const wellnessAdvice: Record<WellnessGoal, {
  title: string;
  millet: string;
  pairing: string;
  portion: string;
  timing: string;
  note: string;
}> = {
  'blood-sugar-aware': {
    title: 'Blood-sugar-aware meals',
    millet: 'Whole foxtail millet',
    pairing: 'Pair with lentils and non-starchy vegetables; choose certified-organic options if you prefer.',
    portion: 'About 1/2 cup cooked millet as part of a balanced meal.',
    timing: 'Try it at lunch, alongside protein and vegetables.',
    note: 'Millets still contain carbohydrates. Follow your clinician’s advice and your individual meal plan.',
  },
  'digestive-comfort': {
    title: 'Digestive comfort',
    millet: 'Soft-cooked finger millet or foxtail millet',
    pairing: 'Try with well-cooked vegetables and mung dal; choose certified-organic options if you prefer.',
    portion: 'Start with around 1/3 cup cooked and adjust to what you tolerate.',
    timing: 'Try a daytime meal so you can notice how it feels.',
    note: 'Fibre needs vary. Ask a clinician or dietitian for advice if you have ongoing digestive symptoms.',
  },
  'heart-healthy': {
    title: 'Heart-healthy eating',
    millet: 'Pearl millet (bajra)',
    pairing: 'Serve with beans or lentils and leafy vegetables; choose certified-organic options if you prefer.',
    portion: 'About 1/2 cup cooked millet as one part of the meal.',
    timing: 'A lunch or dinner swap can add variety to your usual grains.',
    note: 'This is a general meal idea, not a treatment or substitute for your clinician’s advice.',
  },
  'skin-wellness': {
    title: 'Everyday skin wellness',
    millet: 'A whole-grain millet you enjoy, such as foxtail millet',
    pairing: 'Add seasonal fruit or vegetables, pulses, and enough water through the day; choose certified-organic produce if you prefer.',
    portion: 'About 1/2 cup cooked millet as part of a varied meal.',
    timing: 'Include it at breakfast or lunch when it fits your routine.',
    note: 'Food cannot treat skin conditions. For persistent or painful symptoms, consult a qualified clinician.',
  },
};

const generalWellnessAdvice = {
  title: 'A balanced millet meal',
  millet: 'Rotate whole foxtail, finger, or pearl millet',
  pairing: 'Pair with vegetables and pulses for a varied plate; choose certified-organic options if you prefer.',
  portion: 'Start with about 1/2 cup cooked millet and adjust to your needs.',
  timing: 'Try it at lunch or breakfast as a swap for your usual grain.',
  note: 'Portions vary by person. Choose certified-organic foods if you prefer and can verify the certification.',
};

const colors = {
  ink: '#1B2C20',
  green: '#204B30',
  deepGreen: '#153B26',
  leaf: '#6F9569',
  pale: '#F7F6EF',
  card: '#FFFFFF',
  muted: '#70776D',
  line: '#EDECE4',
  lime: '#DCEFCF',
  gold: '#C48A35',
};

const imageStyles = StyleSheet.create({
  product: { width: '100%', height: '100%' },
  story: { width: '100%', height: '100%', borderRadius: 30, backgroundColor: '#D9E4CF' },
  hero: { width: '100%', height: '100%', position: 'absolute' },
  cart: { width: 90, height: 104, borderRadius: 13, backgroundColor: '#E7E5DA' },
  detail: { width: '100%', height: '100%' },
});

const imageUrl = (photo: string, width = 880) =>
  photo.startsWith('http')
    ? photo
    : `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=82`;

const tabIcons: Record<Tab, keyof typeof Feather.glyphMap> = {
  Discover: 'compass',
  Shop: 'shopping-bag',
  Health: 'activity',
  Campaigns: 'calendar',
  Bag: 'shopping-cart',
  Profile: 'user',
};

function formatRupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function AnimatedAction({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: object;
  accessibilityLabel?: string;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 34 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24 }).start()}
      onPress={onPress}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function SectionHeading({ title, subtitle, action, onAction }: {
  title: string; subtitle?: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} style={styles.textAction}>
          <Text style={styles.textActionLabel}>{action}</Text>
          <Feather name="arrow-up-right" size={15} color={colors.green} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ProductCard({ product, width, wished, onWish, onOpen, onAdd }: {
  product: Product; width: number; wished: boolean; onWish: () => void; onOpen: () => void; onAdd: () => void;
}) {
  return (
    <View style={[styles.productCard, { width }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`View ${product.name}`}>
        <View style={styles.productImageWrap}>
          <Image source={{ uri: imageUrl(product.image, 620) }} style={imageStyles.product} />
          <View style={[styles.productTag, { backgroundColor: product.tagColor }]}>
            <Text style={styles.productTagText}>{product.tag}</Text>
          </View>
          <Pressable
            onPress={(event) => { event.stopPropagation(); onWish(); }}
            style={styles.heartButton}
            accessibilityRole="button"
            accessibilityLabel={wished ? 'Remove from saved items' : 'Save item'}
          >
            <Feather name="heart" size={17} color={wished ? '#C3574B' : colors.green} />
            {wished ? <View style={styles.filledHeart} /> : null}
          </Pressable>
        </View>
        <View style={styles.productInfo}>
          <View style={styles.ratingRow}>
            <Feather name="star" size={12} color={colors.gold} />
            <Text style={styles.ratingText}>{product.rating}</Text>
            <Text style={styles.reviewText}>({product.reviews})</Text>
          </View>
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.productVariety} numberOfLines={1}>{product.variety}</Text>
        </View>
      </Pressable>
      <View style={styles.productBuyRow}>
        <View>
          <Text style={styles.productPrice}>{formatRupees(product.price)}</Text>
          <Text style={styles.productOldPrice}>{formatRupees(product.oldPrice)}</Text>
        </View>
        <AnimatedAction
          onPress={onAdd}
          style={styles.addIconButton}
          accessibilityLabel={`Add ${product.name} to bag`}
        >
          <Feather name="plus" size={19} color="#FFFFFF" />
        </AnimatedAction>
      </View>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [backendError, setBackendError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cartHydratedFor, setCartHydratedFor] = useState('');
  const [wellnessDraft, setWellnessDraft] = useState<WellnessGoal[]>([]);
  const [wellnessConsented, setWellnessConsented] = useState(false);
  const [editingWellness, setEditingWellness] = useState(false);
  const [savingWellness, setSavingWellness] = useState(false);
  const [campaignAction, setCampaignAction] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const authUrl = Linking.useURL();
  const [tab, setTab] = useState<Tab>('Discover');
  const [activeCategory, setActiveCategory] = useState('All grains');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const [healthTab, setHealthTab] = useState('Nutrition');
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [showAssay, setShowAssay] = useState(false);
  const [entrance] = useState(() => new Animated.Value(1));
  const authLoadId = useRef(0);
  const columns = width >= 720 ? 3 : 2;
  const gridGap = 14;
  const cardWidth = Math.min((width - 40 - gridGap * (columns - 1)) / columns, 340);

  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [tab, entrance]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    let mounted = true;

    async function loadAccount(authUser: User) {
      const loadId = ++authLoadId.current;
      try {
        const profile = await loadProfile(authUser);
        if (!mounted || loadId !== authLoadId.current) return;
        setUser(profile);
        setWellnessDraft(profile.goals);
        setWellnessConsented(profile.hasWellnessConsent);
        setAuthError('');
        setTab('Discover');

        try {
          const loadedProducts = await loadProducts();
          const loadedCampaigns = await loadCampaigns();
          const [favorites, savedCart, campaignsWithProgress] = await Promise.all([
            loadFavorites(profile.id),
            loadCart(profile.id, loadedProducts),
            loadCampaignProgress(loadedCampaigns),
          ]);
          if (!mounted || loadId !== authLoadId.current) return;
          setProducts(loadedProducts);
          setCampaigns(campaignsWithProgress);
          setSaved(favorites);
          setCart(savedCart);
          setCartHydratedFor(profile.id);
          setBackendError('');
        } catch (dataError) {
          if (mounted && loadId === authLoadId.current) {
            setBackendError(dataError instanceof Error ? dataError.message : 'We could not load your MilletBloom data.');
          }
        }
      } catch (profileError) {
        if (mounted && loadId === authLoadId.current) {
          setAuthError(profileError instanceof Error ? profileError.message : 'We could not load your account profile.');
          setUser(null);
        }
      } finally {
        if (mounted && loadId === authLoadId.current) setAuthLoading(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        authLoadId.current += 1;
        setUser(null);
        setProducts([]);
        setCampaigns([]);
        setCart({});
        setSaved(new Set());
        setCartHydratedFor('');
        setPasswordRecovery(false);
        setAuthError('');
        setBackendError('');
        setAuthLoading(false);
        return;
      }
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'TOKEN_REFRESHED') return;
      if (session?.user) {
        setAuthLoading(true);
        setTimeout(() => { if (mounted) void loadAccount(session.user); }, 0);
      } else if (event === 'INITIAL_SESSION') {
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      authLoadId.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !authUrl) return;
    async function handleAuthLink(client: NonNullable<typeof supabase>, currentAuthUrl: string) {
      try {
        const link = new URL(currentAuthUrl);
        const query = new URLSearchParams(link.search);
        const fragment = new URLSearchParams(link.hash.replace(/^#/, ''));
        const code = query.get('code');
        const tokenHash = query.get('token_hash') ?? fragment.get('token_hash');
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
          return;
        }
        const recoveryType = query.get('type') ?? fragment.get('type');
        if (tokenHash && recoveryType === 'recovery') {
          const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
          if (error) throw error;
        }
      } catch (linkError) {
        setAuthError(linkError instanceof Error ? linkError.message : 'This sign-in link is invalid or has expired.');
      }
    }
    void handleAuthLink(supabase, authUrl);
  }, [authUrl]);

  useEffect(() => {
    if (!user || cartHydratedFor !== user.id) return;
    const timer = setTimeout(() => {
      void replaceCart(user.id, products, cart).catch((cartError: unknown) => {
        setBackendError(cartError instanceof Error ? cartError.message : 'We could not save your cart.');
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [cart, cartHydratedFor, products, user]);

  const cartCount = Object.values(cart).reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = Object.values(cart).reduce((sum, line) => sum + line.quantity * line.price, 0);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || `${product.name} ${product.variety} ${product.tag}`.toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (activeCategory === 'Flours') return product.slug === 'ragi' || product.slug === 'bajra';
      if (activeCategory === 'Breakfast') return product.slug === 'muesli' || product.slug === 'foxtail';
      return true;
    });
  }, [activeCategory, products, search]);

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(''), 2300);
  }

  function addToBag(product: Product, size = product.sizes[0].label, price = product.sizes[0].price, amount = 1) {
    const key = `${product.id}-${size}`;
    setCart((current) => ({
      ...current,
      [key]: current[key]
        ? { ...current[key], quantity: current[key].quantity + amount }
        : { product, size, price, quantity: amount },
    }));
    flash(`${product.name} added to your bag`);
  }

  function changeLine(key: string, change: number) {
    setCart((current) => {
      const line = current[key];
      if (!line) return current;
      const nextQuantity = line.quantity + change;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: { ...line, quantity: nextQuantity } };
    });
  }

  function toggleSaved(product: Product) {
    const isSaved = saved.has(product.id);
    void saveFavorite(user!.id, product.id, !isSaved).then(() => {
      setSaved((current) => {
        const next = new Set(current);
        if (isSaved) next.delete(product.id);
        else next.add(product.id);
        return next;
      });
    }).catch((favoriteError: unknown) => {
      setBackendError(favoriteError instanceof Error ? favoriteError.message : 'We could not update your saved items.');
    });
  }

  function openProduct(product: Product) {
    setSelectedProduct(product);
    setSelectedSize(0);
    setQuantity(1);
  }

  function addSelectedProduct() {
    if (!selectedProduct) return;
    const size = selectedProduct.sizes[selectedSize];
    addToBag(selectedProduct, size.label, size.price, quantity);
    setSelectedProduct(null);
  }

  const grid = (items: Product[]) => (
    <View style={styles.productGrid}>
      {items.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          width={cardWidth}
          wished={saved.has(product.id)}
          onWish={() => toggleSaved(product)}
          onOpen={() => openProduct(product)}
          onAdd={() => addToBag(product)}
        />
      ))}
    </View>
  );

  async function submitAuthentication(submission: AuthSubmission & { registering: boolean }): Promise<string> {
    if (!supabase) throw new Error('Backend configuration is missing. See the setup instructions in README.md.');
    if (submission.registering) {
      const { data, error } = await supabase.auth.signUp({
        email: submission.email,
        password: submission.password,
        options: { data: { full_name: submission.name } },
      });
      if (error) throw error;
      if (!data.session) {
        return 'Account created. Verify your email, then sign in. You can set your optional wellness preferences from the Health tab after signing in.';
      }
      if (submission.goals.length) await saveWellnessGoals(submission.goals);
      return 'Your account is ready.';
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: submission.email,
      password: submission.password,
    });
    if (error) throw error;
    return 'You are signed in.';
  }

  async function sendPasswordReset(email: string): Promise<string> {
    if (!supabase) throw new Error('Backend configuration is missing. See the setup instructions in README.md.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('auth/reset'),
    });
    if (error) throw error;
    return 'If an account uses that email, a password reset link has been sent.';
  }

  async function updatePassword(password: string): Promise<void> {
    if (!supabase) throw new Error('Backend configuration is missing.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setPasswordRecovery(false);
    setAuthError('');
  }

  async function updateWellnessPreferences() {
    setSavingWellness(true);
    try {
      await saveWellnessGoals(wellnessDraft);
      setUser((current) => current
        ? { ...current, goals: wellnessDraft, hasWellnessConsent: wellnessDraft.length > 0 }
        : current);
      setEditingWellness(false);
      setBackendError('');
      flash('Wellness preferences updated.');
    } catch (preferenceError) {
      setBackendError(preferenceError instanceof Error ? preferenceError.message : 'We could not save those preferences.');
    } finally {
      setSavingWellness(false);
    }
  }

  async function refreshCampaigns() {
    const publishedCampaigns = await loadCampaigns();
    setCampaigns(await loadCampaignProgress(publishedCampaigns));
  }

  async function performCampaignAction(campaign: Campaign, action: 'join' | 'check-in' | 'leave') {
    setCampaignAction(campaign.id);
    try {
      if (action === 'join') await joinCampaign(campaign.id);
      else if (action === 'check-in' && campaign.participantId) await checkInToCampaign(campaign.participantId);
      else if (action === 'leave' && campaign.participantId) await leaveCampaign(campaign.participantId);
      await refreshCampaigns();
      flash(action === 'join' ? 'You joined the challenge.' : action === 'leave' ? 'You left the challenge.' : 'Today’s challenge check-in is saved.');
      setBackendError('');
    } catch (campaignError) {
      setBackendError(campaignError instanceof Error ? campaignError.message : 'We could not update your challenge.');
    } finally {
      setCampaignAction(null);
    }
  }

  const renderDiscover = () => (
    <>
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.eyebrow}>TUESDAY, 13 OCTOBER</Text>
          <Text style={styles.greeting}>A little goodness, daily.</Text>
        </View>
        <View style={styles.streakPill}><Text style={styles.streakIcon}>✳</Text><Text style={styles.streakText}>Day 08</Text></View>
      </View>

      <Pressable onPress={() => setTab('Shop')} style={styles.heroWrap}>
        <Image source={{ uri: imageUrl('photo-1500382017468-9049fed747ef', 1300) }} style={imageStyles.hero} />
        <LinearGradient colors={['rgba(19,54,32,0.03)', 'rgba(19,54,32,0.84)']} style={styles.heroShade}>
          <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveLabel}>FRESH FROM THE FARM</Text></View>
          <Text style={styles.heroTitle}>Rooted in the{'\n'}goodness of grain.</Text>
          <Text style={styles.heroSubtitle}>Ancient millets. A brighter way to eat.</Text>
          <View style={styles.heroButton}><Text style={styles.heroButtonText}>Explore the harvest</Text><Feather name="arrow-right" size={16} color={colors.deepGreen} /></View>
        </LinearGradient>
      </Pressable>

      <View style={styles.storyHeading}><Text style={styles.storyHeadingText}>Meet your growers</Text><Pressable onPress={() => flash('More farm stories coming soon')}><Text style={styles.storyLink}>Their stories <Feather name="arrow-up-right" size={12} color={colors.green} /></Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
        {[
          { title: 'Lakshmi Devi', image: 'photo-1594736797933-d0501ba2fe65', label: 'THE GROWER' },
          { title: 'Deccan farms', image: 'photo-1464226184884-fa280b87c399', label: 'THE LAND' },
          { title: 'Our mill', image: 'photo-1461354464878-ad92f492a5a0', label: 'THE CRAFT' },
          { title: 'Sardar Amar', image: 'photo-1500648767791-00dcc994a43e', label: 'THE FARMER' },
        ].map((story) => (
          <Pressable key={story.title} onPress={() => flash(`${story.title}: a story from our community`)} style={styles.storyItem}>
            <View style={styles.storyPhotoRing}><Image source={{ uri: imageUrl(story.image, 220) }} style={imageStyles.story} /><View style={styles.storyPlay}><Feather name="play" size={10} color="#FFFFFF" /></View></View>
            <Text style={styles.storyName}>{story.title}</Text>
            <Text style={styles.storyLabel}>{story.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.healthSummary}>
        <View style={styles.summaryTop}><View><Text style={styles.summaryEyebrow}>YOUR DAILY WELLNESS</Text><Text style={styles.summaryTitle}>A wholesome start</Text></View><View style={styles.sunIcon}><Feather name="sun" size={19} color={colors.green} /></View></View>
        <Text style={styles.summaryCaption}>Small, thoughtful choices add up. See how today’s grains are nourishing you.</Text>
        <View style={styles.nutritionProgressRow}><View style={styles.progressTrack}><View style={styles.progressFill} /></View><Text style={styles.progressValue}>68%</Text></View>
        <View style={styles.miniMetrics}><View><Text style={styles.metricValue}>12.8<Text style={styles.metricUnit}> g</Text></Text><Text style={styles.metricLabel}>Dietary fibre</Text></View><View style={styles.metricDivider} /><View><Text style={styles.metricValue}>8.4<Text style={styles.metricUnit}> g</Text></Text><Text style={styles.metricLabel}>Plant protein</Text></View><Pressable onPress={() => setTab('Health')} style={styles.viewHealth}><Text style={styles.viewHealthText}>Your guide</Text><Feather name="arrow-right" size={12} color={colors.green} /></Pressable></View>
      </View>

      <SectionHeading title="The good grains" subtitle="Grown with care. Loved at your table." action="See all" onAction={() => setTab('Shop')} />
      {grid(products.slice(0, 4))}

      <LinearGradient colors={['#E4F1D8', '#F0EFE3']} style={styles.impactCard}>
        <View style={styles.impactIcon}><Feather name="droplet" size={21} color={colors.green} /></View>
        <View style={{ flex: 1 }}><Text style={styles.impactTitle}>A lighter footprint</Text><Text style={styles.impactText}>Choosing millets can save up to 70% more water.</Text></View>
        <Feather name="arrow-up-right" size={17} color={colors.green} />
      </LinearGradient>
    </>
  );

  const renderShop = () => (
    <>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>GOOD FOOD, GROWN WELL</Text>
        <Text style={styles.pageTitle}>Shop the harvest</Text>
        <Text style={styles.pageDescription}>Meet your new pantry favourites, from farms we know by name.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {['All grains', 'Flours', 'Breakfast'].map((category) => (
          <Pressable key={category} onPress={() => setActiveCategory(category)} style={[styles.categoryChip, activeCategory === category && styles.categoryChipActive]}>
            <Text style={[styles.categoryChipText, activeCategory === category && styles.categoryChipTextActive]}>{category}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.promiseStrip}><Feather name="check-circle" size={15} color={colors.green} /><Text style={styles.promiseText}>Certified organic</Text><View style={styles.promiseDot} /><Text style={styles.promiseText}>Stone-milled fresh</Text><View style={styles.promiseDot} /><Text style={styles.promiseText}>Farmer-first</Text></View>
      <SectionHeading title="Grown with purpose" subtitle={`${filteredProducts.length} small-batch favourites`} />
      {filteredProducts.length ? grid(filteredProducts) : <View style={styles.emptyState}><Feather name="search" size={28} color={colors.leaf} /><Text style={styles.emptyTitle}>No grains found</Text><Text style={styles.emptyCaption}>Try a different search or browse all grains.</Text></View>}
      <LinearGradient colors={['#EEF3E8', '#E4EEDC']} style={styles.farmBanner}>
        <View style={styles.farmBannerIcon}><Feather name="map-pin" size={20} color={colors.green} /></View>
        <View style={{ flex: 1 }}><Text style={styles.farmBannerTitle}>Trace it back to the farm</Text><Text style={styles.farmBannerText}>Every bag has a grower and a story.</Text></View><Feather name="arrow-right" size={17} color={colors.green} />
      </LinearGradient>
    </>
  );

  const goalCards = [
    { id: 'gut', icon: 'activity' as const, tint: '#E5F1DD', title: 'A happier, healthier gut', subtitle: 'Feel good from the inside out', stats: [['11.5 g', 'Dietary fibre'], ['3.2×', 'Prebiotic goodness']], detail: 'Naturally fibre-rich millets support healthy digestion and keep you feeling satisfied for longer.' },
    { id: 'bones', icon: 'shield' as const, tint: '#F7EBD6', title: 'Strong bones, naturally', subtitle: 'The little grain with big calcium', stats: [['344 mg', 'Calcium'], ['3.9 mg', 'Iron']], detail: 'A thoughtful daily source of plant-based calcium, perfect for the whole family.' },
    { id: 'energy', icon: 'sun' as const, tint: '#E3F0E5', title: 'Steady, feel-good energy', subtitle: 'A balanced meal for your everyday', stats: [['12.3 g', 'Plant protein'], ['Whole grain', 'Everyday goodness']], detail: 'Enjoy whole grains alongside a variety of vegetables and protein for a balanced meal.' },
  ];

  const renderHealth = () => (
    <>
      <View style={styles.pageIntro}>
        <View style={styles.wellnessBadge}><Feather name="heart" size={12} color={colors.green} /><Text style={styles.wellnessBadgeText}>A LITTLE MORE WELL</Text></View>
        <Text style={styles.pageTitle}>Know your{'\n'}nourishment.</Text>
        <Text style={styles.pageDescription}>A thoughtful guide to the goodness in every grain. No fads, just food.</Text>
      </View>
      {user ? (
        <View style={styles.recommendationsSection}>
          <SectionHeading title="Ideas for your table" subtitle="General food ideas based on the focus you selected" />
          {(user.goals.length ? user.goals.map((goal) => wellnessAdvice[goal]) : [generalWellnessAdvice]).map((advice) => (
            <View key={advice.title} style={styles.recommendationCard}>
              <View style={styles.recommendationHeading}><Feather name="sun" size={17} color={colors.green} /><Text style={styles.recommendationTitle}>{advice.title}</Text></View>
              <Text style={styles.recommendationRow}><Text style={styles.recommendationLabel}>Millet: </Text>{advice.millet}</Text>
              <Text style={styles.recommendationRow}><Text style={styles.recommendationLabel}>Pair it with: </Text>{advice.pairing}</Text>
              <Text style={styles.recommendationRow}><Text style={styles.recommendationLabel}>Portion: </Text>{advice.portion}</Text>
              <Text style={styles.recommendationRow}><Text style={styles.recommendationLabel}>When: </Text>{advice.timing}</Text>
              <Text style={styles.recommendationNote}>{advice.note}</Text>
            </View>
          ))}
          <Text style={styles.recommendationDisclaimer}>These ideas do not diagnose, treat, or cure health or skin conditions. Organic foods are not treatments. For a medical condition, ask your healthcare professional before changing your diet.</Text>
          <View style={styles.wellnessPreferencesCard}>
            <View style={styles.preferenceHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recommendationTitle}>Your wellness preferences</Text>
                <Text style={styles.preferenceCaption}>Optional. Used only to personalize general food ideas.</Text>
              </View>
              <Pressable onPress={() => {
                setWellnessDraft(user.goals);
                setWellnessConsented(user.hasWellnessConsent);
                setEditingWellness((current) => !current);
              }} accessibilityRole="button">
                <Text style={styles.preferenceAction}>{editingWellness ? 'Close' : 'Edit'}</Text>
              </Pressable>
            </View>
            {editingWellness ? (
              <>
                {wellnessGoalOptions.map((goal) => {
                  const selected = wellnessDraft.includes(goal.id);
                  const disabled = !selected && wellnessDraft.length >= 2;
                  return (
                    <Pressable
                      key={goal.id}
                      disabled={disabled}
                      onPress={() => setWellnessDraft((current) => selected
                        ? current.filter((item) => item !== goal.id)
                        : [...current, goal.id])}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled }}
                      style={[styles.profileGoalOption, selected && styles.profileGoalOptionActive, disabled && styles.profileGoalOptionDisabled]}
                    >
                      <Feather name={selected ? 'check-square' : 'square'} size={16} color={selected ? colors.green : colors.muted} />
                      <Text style={styles.profileGoalLabel}>{goal.label}</Text>
                    </Pressable>
                  );
                })}
                {wellnessDraft.length > 0 ? (
                  <Pressable onPress={() => setWellnessConsented((current) => !current)} accessibilityRole="checkbox" accessibilityState={{ checked: wellnessConsented }} style={styles.profileConsentRow}>
                    <Feather name={wellnessConsented ? 'check-square' : 'square'} size={16} color={wellnessConsented ? colors.green : colors.muted} />
                    <Text style={styles.profileConsentText}>I consent to saving these wellness preferences for personalized general food ideas.</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => { void updateWellnessPreferences(); }} disabled={savingWellness} style={styles.preferenceSaveButton}>
                  <Text style={styles.preferenceSaveLabel}>{savingWellness ? 'Saving…' : 'Save preferences'}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.preferenceCaption}>{user.goals.length ? `${user.goals.length} focus${user.goals.length > 1 ? 'es' : ''} selected. You can clear or change them anytime.` : 'No wellness preferences saved.'}</Text>
            )}
          </View>
        </View>
      ) : null}
      <View style={styles.segmentedTabs}>{['Nutrition', 'Good to know'].map((item) => <Pressable key={item} onPress={() => setHealthTab(item)} style={[styles.segment, healthTab === item && styles.segmentActive]}><Text style={[styles.segmentText, healthTab === item && styles.segmentTextActive]}>{item}</Text></Pressable>)}</View>
      {healthTab === 'Nutrition' ? (
        <>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeading}><View><Text style={styles.summaryEyebrow}>A SIDE-BY-SIDE LOOK</Text><Text style={styles.comparisonTitle}>Better by nature.</Text></View><View style={styles.grainPill}><Text style={styles.grainPillText}>Finger millet</Text></View></View>
            {[
              { name: 'Dietary fibre', ours: '11.5 g', other: '2.0 g', ratio: 0.86, color: '#52734D' },
              { name: 'Plant protein', ours: '7.3 g', other: '6.8 g', ratio: 0.65, color: '#648261' },
              { name: 'Calcium', ours: '344 mg', other: '10 mg', ratio: 0.94, color: '#B78539' },
              { name: 'Iron', ours: '3.9 mg', other: '0.7 mg', ratio: 0.76, color: '#729B69' },
            ].map((metric) => (
              <View key={metric.name} style={styles.barMetric}>
                <View style={styles.barMetricText}><Text style={styles.barMetricName}>{metric.name}</Text><Text style={styles.barMetricValue}>{metric.ours}<Text style={styles.barMetricOther}> · white rice {metric.other}</Text></Text></View>
                <View style={styles.compareTrack}><View style={[styles.compareFill, { width: `${metric.ratio * 100}%`, backgroundColor: metric.color }]} /></View>
              </View>
            ))}
            <View style={styles.compareLegend}><View style={[styles.legendDot, { backgroundColor: colors.green }]} /><Text style={styles.legendLabel}>Finger millet</Text><View style={[styles.legendDot, { backgroundColor: '#D5D5CC' }]} /><Text style={styles.legendLabel}>White rice</Text><Text style={styles.per100}>Per 100 g</Text></View>
          </View>
          <SectionHeading title="Nourish your way" subtitle="A little goodness for every day" />
          {goalCards.map((goal) => (
            <Pressable key={goal.id} onPress={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)} style={styles.goalCard}>
              <View style={styles.goalHeader}><View style={[styles.goalIcon, { backgroundColor: goal.tint }]}><Feather name={goal.icon} size={19} color={colors.green} /></View><View style={{ flex: 1 }}><Text style={styles.goalTitle}>{goal.title}</Text><Text style={styles.goalSubtitle}>{goal.subtitle}</Text></View><Feather name={expandedGoal === goal.id ? 'chevron-up' : 'chevron-down'} size={17} color={colors.green} /></View>
              <View style={styles.goalStats}>{goal.stats.map(([value, label]) => <View key={label} style={styles.goalStat}><Text style={styles.goalStatValue}>{value}</Text><Text style={styles.goalStatLabel}>{label}</Text></View>)}</View>
              {expandedGoal === goal.id ? <Text style={styles.goalDetail}>{goal.detail}</Text> : null}
              <View style={styles.verifiedRow}><Feather name="check-circle" size={12} color={colors.leaf} /><Text style={styles.verifiedText}>Thoughtfully sourced · Naturally good</Text><Text style={styles.learnMore}>Learn more</Text></View>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowAssay(!showAssay)} style={styles.assayToggle}><Text style={styles.assayText}>See the whole-grain goodness</Text><Feather name={showAssay ? 'minus' : 'plus'} size={17} color={colors.green} /></Pressable>
          {showAssay ? <View style={styles.assayContent}><Text style={styles.assayBody}>Our grains are independently tested for quality and purity. Explore clear, honest nutrition information for every batch.</Text><Text style={styles.assayLink}>Quality pledge  ·  Harvest no. 2408</Text></View> : null}
        </>
      ) : (
        <View style={styles.tipCard}><View style={styles.tipIcon}><Feather name="book-open" size={21} color={colors.green} /></View><Text style={styles.goalTitle}>The simple guide to millets</Text><Text style={styles.tipText}>Rinse, soak for a little while, then cook just like rice. Try finger millet in a cosy morning malt, or toss foxtail millet into your favourite grain bowl.</Text><View style={styles.tipBullet}><Feather name="clock" size={15} color={colors.green} /><Text style={styles.tipBulletText}>Soak 20–30 minutes for a softer texture</Text></View><View style={styles.tipBullet}><Feather name="coffee" size={15} color={colors.green} /><Text style={styles.tipBulletText}>Start with one millet meal a day</Text></View><Pressable style={styles.recipeButton} onPress={() => setTab('Discover')}><Text style={styles.recipeButtonText}>Find an everyday recipe</Text><Feather name="arrow-right" size={16} color="#FFFFFF" /></Pressable></View>
      )}
      <View style={styles.wellnessCallout}><View style={styles.wellnessCalloutIcon}><Feather name="message-circle" size={19} color={colors.deepGreen} /></View><View style={{ flex: 1 }}><Text style={styles.wellnessCalloutTitle}>Wellness, your way</Text><Text style={styles.wellnessCalloutText}>Little, nourishing steps — at your own pace.</Text></View><Feather name="arrow-right" size={16} color={colors.green} /></View>
    </>
  );

  const renderCampaigns = () => (
    <>
      <View style={styles.pageIntro}>
        <View style={styles.wellnessBadge}><Feather name="calendar" size={12} color={colors.green} /><Text style={styles.wellnessBadgeText}>SMALL STEPS, TOGETHER</Text></View>
        <Text style={styles.pageTitle}>Challenges & offers</Text>
        <Text style={styles.pageDescription}>Join a food-habit challenge at your own pace, or explore current offers.</Text>
      </View>
      {campaigns.length ? campaigns.map((campaign) => {
        const isChallenge = campaign.kind === 'challenge';
        const finished = isChallenge && campaign.duration_days !== null && campaign.completedDays >= campaign.duration_days;
        return (
          <View key={campaign.id} style={styles.campaignCard}>
            <View style={styles.campaignTypeRow}>
              <View style={styles.campaignIcon}><Feather name={isChallenge ? 'calendar' : 'tag'} size={18} color={colors.green} /></View>
              <Text style={styles.campaignType}>{isChallenge ? `${campaign.duration_days ?? 'DAILY'}-DAY FOOD HABIT CHALLENGE` : 'MILLETBLOOM OFFER'}</Text>
            </View>
            <Text style={styles.campaignTitle}>{campaign.title}</Text>
            <Text style={styles.campaignDescription}>{campaign.description}</Text>
            {campaign.wellness_goal ? <Text style={styles.campaignGoal}>Focus: {campaign.wellness_goal.replaceAll('-', ' ')}</Text> : null}
            {campaign.reward_description ? <Text style={styles.campaignReward}>{campaign.reward_description}</Text> : null}
            {campaign.discount_percent ? <Text style={styles.campaignDiscount}>{campaign.discount_percent}% offer</Text> : null}
            {isChallenge && campaign.participantId ? (
              <>
                <View style={styles.challengeProgressRow}>
                  <Text style={styles.challengeProgressText}>{campaign.completedDays} of {campaign.duration_days ?? '∞'} daily check-ins</Text>
                  {finished ? <Text style={styles.challengeProgressText}>Complete</Text> : null}
                </View>
                <View style={styles.challengeTrack}>
                  <View style={[styles.challengeFill, { width: `${Math.min(100, (campaign.completedDays / Math.max(1, campaign.duration_days ?? 30)) * 100)}%` }]} />
                </View>
                <View style={styles.campaignActions}>
                  {!campaign.checkedInToday && !finished ? (
                    <Pressable onPress={() => { void performCampaignAction(campaign, 'check-in'); }} disabled={campaignAction === campaign.id} style={styles.campaignPrimaryButton}>
                      <Text style={styles.campaignPrimaryLabel}>{campaignAction === campaign.id ? 'Saving…' : 'Log today’s step'}</Text>
                    </Pressable>
                  ) : <Text style={styles.campaignProgressText}>{finished ? 'Challenge completed — well done.' : 'Today’s step is logged.'}</Text>}
                  <Pressable onPress={() => { void performCampaignAction(campaign, 'leave'); }} disabled={campaignAction === campaign.id} style={styles.campaignTextButton}>
                    <Text style={styles.campaignTextLabel}>Leave</Text>
                  </Pressable>
                </View>
              </>
            ) : isChallenge ? (
              <Pressable onPress={() => { void performCampaignAction(campaign, 'join'); }} disabled={campaignAction === campaign.id} style={styles.campaignPrimaryButton}>
                <Text style={styles.campaignPrimaryLabel}>{campaignAction === campaign.id ? 'Joining…' : 'Join this challenge'}</Text>
                <Feather name="arrow-right" size={15} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Pressable onPress={() => setTab('Shop')} style={styles.campaignPrimaryButton}>
                <Text style={styles.campaignPrimaryLabel}>Explore the harvest</Text>
                <Feather name="arrow-right" size={15} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        );
      }) : (
        <View style={styles.emptyState}>
          <Feather name="calendar" size={27} color={colors.leaf} />
          <Text style={styles.emptyTitle}>New challenges are on their way.</Text>
          <Text style={styles.emptyCaption}>Check back for food-habit challenges and seasonal offers.</Text>
        </View>
      )}
      <Text style={styles.recommendationDisclaimer}>Challenges support everyday food habits only. They do not treat diabetes or any other condition; follow your clinician’s advice.</Text>
    </>
  );

  const renderBag = () => (
    <>
      <View style={styles.pageIntro}><Text style={styles.eyebrow}>A LITTLE GOODNESS, ON ITS WAY</Text><Text style={styles.pageTitle}>Your bag{cartCount ? ` · ${cartCount}` : ''}</Text><Text style={styles.pageDescription}>Every order supports a grower and a gentler way of farming.</Text></View>
      {cartCount === 0 ? (
        <View style={styles.emptyBag}><View style={styles.emptyBagIcon}><Feather name="shopping-bag" size={29} color={colors.green} /></View><Text style={styles.emptyTitle}>Your bag is taking a breath.</Text><Text style={styles.emptyCaption}>Fill it with fresh, nourishing grains from farms you can feel good about.</Text><Pressable onPress={() => setTab('Shop')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Discover the harvest</Text><Feather name="arrow-right" size={16} color="#FFFFFF" /></Pressable></View>
      ) : (
        <>
          <View style={styles.deliveryBanner}><Feather name="truck" size={17} color={colors.green} /><Text style={styles.deliveryBannerText}>You’re one step closer to something good.</Text></View>
          {Object.entries(cart).map(([key, line]) => (
            <View key={key} style={styles.cartLine}>
              <Pressable onPress={() => openProduct(line.product)}><Image source={{ uri: imageUrl(line.product.image, 300) }} style={imageStyles.cart} /></Pressable>
              <View style={styles.cartInfo}><Text style={styles.cartName}>{line.product.name}</Text><Text style={styles.cartSize}>Harvest pack · {line.size}</Text><Text style={styles.cartPrice}>{formatRupees(line.price)}</Text><View style={styles.quantityControl}><Pressable onPress={() => changeLine(key, -1)} style={styles.quantityButton}><Feather name="minus" size={14} color={colors.green} /></Pressable><Text style={styles.quantityValue}>{line.quantity}</Text><Pressable onPress={() => changeLine(key, 1)} style={styles.quantityButton}><Feather name="plus" size={14} color="#FFFFFF" /></Pressable></View></View>
            </View>
          ))}
          <View style={styles.impactCardSmall}><Feather name="heart" size={16} color={colors.green} /><Text style={styles.impactCardSmallText}>Your order supports smallholder farming families.</Text></View>
          <View style={styles.orderCard}><Text style={styles.orderTitle}>A quick little summary</Text><View style={styles.orderRow}><Text style={styles.orderLabel}>Your grains</Text><Text style={styles.orderValue}>{formatRupees(cartTotal)}</Text></View><View style={styles.orderRow}><Text style={styles.orderLabel}>Thoughtful delivery</Text><Text style={styles.freeDelivery}>Calculated at checkout</Text></View><View style={styles.orderDivider} /><View style={styles.orderRow}><Text style={styles.orderTotalLabel}>Subtotal</Text><Text style={styles.orderTotal}>{formatRupees(cartTotal)}</Text></View><View style={[styles.checkoutButton, styles.checkoutDisabled]}><Text style={styles.checkoutButtonText}>Payments are not set up yet</Text></View><Text style={styles.secureNote}>No order will be placed or payment collected in this build.</Text></View>
        </>
      )}
      <SectionHeading title="Goes beautifully with" subtitle="A few more pantry favourites" />
      {grid(products.filter((product) => !Object.values(cart).some((line) => line.product.id === product.id)).slice(0, 2))}
    </>
  );

  const renderProfile = () => (
    <>
      <View style={styles.profileHero}><LinearGradient colors={['#EAF2E0', '#F5F0E5']} style={styles.profileCover}><View style={styles.profileMonogram}><Feather name="user" size={28} color={colors.green} /></View><Text style={styles.profileTitle}>Hello, {user?.name || 'grain lover'}.</Text><Text style={styles.profileSubtitle}>A little goodness looks good on you.</Text><View style={styles.memberBadge}><Feather name="sun" size={12} color={colors.gold} /><Text style={styles.memberText}>HARVEST CLUB MEMBER</Text></View></LinearGradient></View>
      <View style={styles.memberCard}><View style={styles.memberCardTop}><View><Text style={styles.memberEyebrow}>YOUR GOODNESS SO FAR</Text><Text style={styles.memberScore}>8 <Text style={styles.memberPoints}>grain points</Text></Text></View><View style={styles.giftIcon}><Feather name="gift" size={20} color={colors.green} /></View></View><View style={styles.memberProgressTrack}><View style={styles.memberProgressFill} /></View><Text style={styles.memberFootnote}>12 more points to a little thank-you from us</Text></View>
      <SectionHeading title="Your little corner" subtitle="Everything you need, all in one place" />
      <View style={styles.menuCard}>
        {[
          { icon: 'package' as const, title: 'Orders & deliveries', caption: 'Follow the journey of your grains' },
          { icon: 'heart' as const, title: 'Saved favourites', caption: `${saved.size} lovely finds saved for later` },
          { icon: 'map-pin' as const, title: 'Your addresses', caption: 'Help goodness find its way to you' },
          { icon: 'help-circle' as const, title: 'A little help', caption: 'We’re always happy to chat' },
        ].map((item, index) => (
          <Pressable key={item.title} onPress={() => item.title === 'Saved favourites' ? setTab('Shop') : flash(`${item.title}: we’re here to help`)} style={[styles.menuRow, index < 3 && styles.menuRowBorder]}><View style={styles.menuIcon}><Feather name={item.icon} size={17} color={colors.green} /></View><View style={{ flex: 1 }}><Text style={styles.menuTitle}>{item.title}</Text><Text style={styles.menuCaption}>{item.caption}</Text></View><Feather name="chevron-right" size={17} color="#899084" /></Pressable>
        ))}
      </View>
      <Pressable onPress={() => { void supabase?.auth.signOut().then(({ error }) => { if (error) setBackendError(error.message); }); }} style={styles.profileFooter} accessibilityRole="button"><Feather name="log-out" size={16} color={colors.leaf} /><Text style={styles.profileFooterText}>Sign out</Text></Pressable>
    </>
  );

  const renderDetail = () => {
    if (!selectedProduct) return null;
    const price = selectedProduct.sizes[selectedSize];
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setSelectedProduct(null)}>
        <SafeAreaView style={styles.detailSafe}>
          <StatusBar style="dark" />
          <View style={styles.detailHeader}><Pressable onPress={() => setSelectedProduct(null)} style={styles.backButton}><Feather name="arrow-left" size={20} color={colors.ink} /></Pressable><View style={styles.brandMarkSmall}><Feather name="feather" size={16} color={colors.green} /></View><Text style={styles.detailHeaderTitle}>Good things, up close</Text><Pressable onPress={() => toggleSaved(selectedProduct)} style={styles.backButton}><Feather name="heart" size={19} color={saved.has(selectedProduct.id) ? '#C3574B' : colors.ink} /></Pressable></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
            <View style={styles.detailHero}><Image source={{ uri: imageUrl(selectedProduct.image, 1200) }} style={imageStyles.detail} /><LinearGradient colors={['rgba(20,45,27,0.02)', 'rgba(20,45,27,0.48)']} style={styles.detailImageShade}><View style={styles.organicBadge}><Feather name="check-circle" size={13} color="#FFFFFF" /><Text style={styles.organicBadgeText}>GROWN WITH CARE</Text></View><View style={styles.detailRating}><Feather name="star" size={13} color={colors.gold} /><Text style={styles.detailRatingText}>{selectedProduct.rating} ({selectedProduct.reviews} notes)</Text></View><Text style={styles.detailImageCaption}>Goodness from our{'\n'}fields to your table.</Text></LinearGradient></View>
            <View style={styles.detailIntro}><Text style={styles.detailKicker}>A GOOD THING FROM THE DECCAN</Text><Text style={styles.detailName}>{selectedProduct.name}</Text><Text style={styles.detailVariety}>{selectedProduct.variety} · Gently processed</Text><Text style={styles.detailDescription}>{selectedProduct.description}</Text><View style={styles.benefitPills}><View style={styles.benefitPill}><Feather name="check" size={12} color={colors.green} /><Text style={styles.benefitText}>Naturally wholesome</Text></View><View style={styles.benefitPill}><Feather name="shield" size={12} color={colors.green} /><Text style={styles.benefitText}>No unnecessary additives</Text></View></View></View>
            <View style={styles.detailSection}><View style={styles.detailSectionHeading}><View><Text style={styles.summaryEyebrow}>THE LITTLE DETAILS</Text><Text style={styles.detailSectionTitle}>Choose your harvest</Text></View><Text style={styles.harvestNote}>Farmer-first pricing</Text></View><View style={styles.sizeOptions}>{selectedProduct.sizes.map((size, index) => <Pressable key={size.label} onPress={() => setSelectedSize(index)} style={[styles.sizeOption, selectedSize === index && styles.sizeOptionActive]}><Text style={[styles.sizeOptionTitle, selectedSize === index && styles.sizeOptionTitleActive]}>{size.label}</Text><Text style={[styles.sizeOptionPrice, selectedSize === index && styles.sizeOptionPriceActive]}>{formatRupees(size.price)}</Text>{index === 1 ? <View style={styles.popularTag}><Text style={styles.popularTagText}>POPULAR</Text></View> : null}</Pressable>)}</View><View style={styles.detailQuantityRow}><Text style={styles.detailQuantityLabel}>How many?</Text><View style={styles.quantityControl}><Pressable onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.quantityButton}><Feather name="minus" size={14} color={colors.green} /></Pressable><Text style={styles.quantityValue}>{quantity}</Text><Pressable onPress={() => setQuantity(quantity + 1)} style={styles.quantityButton}><Feather name="plus" size={14} color="#FFFFFF" /></Pressable></View></View></View>
            <View style={styles.detailSection}><Text style={styles.summaryEyebrow}>HONESTLY, IT’S GOOD FOR YOU</Text><Text style={styles.detailSectionTitle}>A little nourishment</Text><Text style={styles.perServingNote}>Per 100 g, naturally found in this grain</Text>{selectedProduct.nutrients.map((item) => <View key={item.label} style={styles.nutrientRow}><View style={styles.nutrientBullet} /><Text style={styles.nutrientLabel}>{item.label}</Text><Text style={styles.nutrientValue}>{item.value}</Text></View>)}</View>
            <View style={styles.provenanceCard}><View style={styles.farmBannerIcon}><Feather name="map-pin" size={18} color={colors.green} /></View><View style={{ flex: 1 }}><Text style={styles.provenanceTitle}>Grown together in Karnataka</Text><Text style={styles.provenanceCopy}>From smallholder farms, fairly sourced and freshly harvested.</Text></View><Feather name="arrow-up-right" size={17} color={colors.green} /></View>
          </ScrollView>
          <View style={styles.detailBottom}><View><Text style={styles.detailBottomPrice}>{formatRupees(price.price * quantity)}</Text><Text style={styles.detailBottomNote}>{price.label} · Inclusive of all taxes</Text></View><AnimatedAction onPress={addSelectedProduct} style={styles.detailAddButton}><Feather name="shopping-bag" size={17} color="#FFFFFF" /><Text style={styles.detailAddText}>Add a little goodness</Text></AnimatedAction></View>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderContent = () => {
    if (tab === 'Discover') return renderDiscover();
    if (tab === 'Shop') return renderShop();
    if (tab === 'Health') return renderHealth();
    if (tab === 'Campaigns') return renderCampaigns();
    if (tab === 'Bag') return renderBag();
    return renderProfile();
  };

  if (!isBackendConfigured) return <BackendSetupScreen />;
  if (authLoading) {
    return <LoadingScreen label="Connecting securely…" />;
  }
  if (passwordRecovery) {
    return <PasswordResetFlow onSubmit={updatePassword} />;
  }
  if (authError && !user) {
    return (
      <BackendProblemScreen
        message={authError}
        onSignOut={() => { void supabase?.auth.signOut(); }}
      />
    );
  }
  if (!user) {
    return <AuthFlow onSubmit={submitAuthentication} onResetPassword={sendPasswordReset} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable style={styles.brand} onPress={() => setTab('Discover')}>
          <View style={styles.brandMark}><Feather name="feather" size={17} color={colors.green} /></View>
          <View><Text style={styles.brandName}>MilletBloom</Text><Text style={styles.brandTagline}>GOODNESS, GROWN TOGETHER</Text></View>
        </Pressable>
        <View style={styles.headerActions}><Pressable onPress={() => setTab('Shop')} style={styles.headerButton} accessibilityLabel="Search grains"><Feather name="search" size={19} color={colors.ink} /></Pressable><Pressable onPress={() => setTab('Bag')} style={styles.headerButton} accessibilityLabel="Open shopping bag"><Feather name="shopping-bag" size={19} color={colors.ink} />{cartCount > 0 ? <View style={styles.cartDot} /> : null}</Pressable><Pressable onPress={() => setTab('Profile')} style={styles.avatar}><Feather name="user" size={17} color={colors.green} /></Pressable></View>
      </View>
      {tab === 'Shop' ? <View style={styles.searchInputRow}><Feather name="search" size={17} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search grains, flours and feel-good things" placeholderTextColor="#85887E" style={styles.searchEdit} returnKeyType="search" accessibilityLabel="Search grains" />{search ? <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search"><Feather name="x-circle" size={17} color={colors.muted} /></Pressable> : <Feather name="mic" size={17} color={colors.leaf} />}</View> : null}
      <Animated.View style={[styles.content, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }] }]}>
        <ScrollView
          key={tab}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, tab === 'Discover' ? styles.discoverScroll : null]}
        >
          {backendError ? (
            <View style={styles.backendErrorBanner}>
              <Feather name="alert-circle" size={15} color="#A33E35" />
              <Text style={styles.backendErrorText}>{backendError}</Text>
            </View>
          ) : null}
          {renderContent()}
        </ScrollView>
      </Animated.View>
      <View style={styles.bottomNav}>
        {(['Discover', 'Shop', 'Health', 'Campaigns', 'Bag', 'Profile'] as Tab[]).map((item) => {
          const active = tab === item;
          return (
            <Pressable key={item} onPress={() => setTab(item)} style={styles.navItem} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={item}>
              <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                <Feather name={tabIcons[item]} size={19} color={active ? colors.green : '#767B71'} />
                {item === 'Bag' && cartCount > 0 ? <View style={styles.navBadge}><Text style={styles.navBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text></View> : null}
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item}</Text>
              {active ? <View style={styles.navActiveDot} /> : null}
            </Pressable>
          );
        })}
      </View>
      {notice ? <View pointerEvents="none" style={styles.toast}><Ionicons name="checkmark-circle" size={18} color="#D7EDC8" /><Text style={styles.toastText}>{notice}</Text></View> : null}
      {renderDetail()}
    </SafeAreaView>
  );
}

function BackendSetupScreen() {
  return (
    <SafeAreaView style={styles.setupScreen}>
      <StatusBar style="dark" />
      <View style={styles.setupIcon}><Feather name="cloud" size={24} color={colors.green} /></View>
      <Text style={styles.setupTitle}>Connect MilletBloom</Text>
      <Text style={styles.setupBody}>The app is waiting for its Supabase project settings. Add the project URL and publishable key to your local .env file, then run the database migration described in README.md.</Text>
      <Text style={styles.setupBody}>Never put a Supabase secret or service-role key in the mobile app.</Text>
    </SafeAreaView>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.setupScreen}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={styles.setupBody}>{label}</Text>
    </SafeAreaView>
  );
}

function BackendProblemScreen({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return (
    <SafeAreaView style={styles.setupScreen}>
      <StatusBar style="dark" />
      <View style={styles.setupIcon}><Feather name="alert-triangle" size={24} color={colors.green} /></View>
      <Text style={styles.setupTitle}>We couldn’t load your account</Text>
      <Text style={styles.setupBody}>{message}</Text>
      <Text style={styles.setupBody}>If this is a new Supabase project, apply the migrations in README.md and try signing in again.</Text>
      <Pressable onPress={onSignOut} style={styles.setupButton}><Text style={styles.setupButtonText}>Return to sign in</Text></Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.pale },
  header: { height: 66, paddingHorizontal: 21, backgroundColor: colors.pale, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(41,64,42,0.06)' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#E5EFDC', alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 18, color: colors.deepGreen, letterSpacing: -0.65, fontWeight: '800' },
  brandTagline: { fontSize: 8, letterSpacing: 1.3, color: colors.leaf, marginTop: 2, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerButton: { width: 39, height: 39, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cartDot: { position: 'absolute', width: 8, height: 8, borderRadius: 5, right: 8, top: 8, backgroundColor: colors.gold, borderWidth: 1, borderColor: colors.pale },
  avatar: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#E5EFDC', borderWidth: 1, borderColor: '#BDD3B3', marginLeft: 5, alignItems: 'center', justifyContent: 'center' },
  searchInputRow: { height: 45, marginHorizontal: 20, marginTop: 11, marginBottom: 1, paddingHorizontal: 13, borderRadius: 14, backgroundColor: '#ECEBE4', flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchEdit: { flex: 1, color: colors.muted, fontSize: 12 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 21, paddingBottom: 27 },
  discoverScroll: { paddingTop: 16 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  eyebrow: { color: colors.leaf, fontSize: 9, fontWeight: '800', letterSpacing: 1.35 },
  greeting: { color: colors.ink, fontSize: 20, letterSpacing: -0.6, fontWeight: '700', marginTop: 4 },
  streakPill: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#EFEBDD', borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 5 },
  streakIcon: { color: colors.gold, fontSize: 13 },
  streakText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  heroWrap: { height: 246, borderRadius: 23, overflow: 'hidden', backgroundColor: '#405B43' },
  heroShade: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-start', padding: 20 },
  liveBadge: { backgroundColor: 'rgba(250,248,239,0.94)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 11 },
  liveDot: { width: 7, height: 7, backgroundColor: '#7DAD57', borderRadius: 4 },
  liveLabel: { color: colors.deepGreen, fontSize: 8, letterSpacing: 1.05, fontWeight: '800' },
  heroTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 34, letterSpacing: -1.1, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 7 },
  heroButton: { backgroundColor: '#F8F6EA', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13, marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroButtonText: { fontSize: 11, color: colors.deepGreen, fontWeight: '700' },
  storyHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 23, marginBottom: 13 },
  storyHeadingText: { fontSize: 14, color: colors.ink, fontWeight: '700' },
  storyLink: { color: colors.green, fontSize: 10, fontWeight: '600' },
  storiesRow: { gap: 16, paddingBottom: 2 },
  storyItem: { alignItems: 'center', width: 72 },
  storyPhotoRing: { width: 63, height: 63, padding: 3, borderRadius: 33, borderColor: '#92AC7F', borderWidth: 1.5, position: 'relative' },
  storyPlay: { position: 'absolute', right: -1, bottom: 0, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.green, borderColor: colors.pale, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  storyName: { marginTop: 7, color: colors.ink, fontSize: 9, fontWeight: '600' },
  storyLabel: { color: '#8B8D80', marginTop: 2, fontSize: 7, letterSpacing: 0.75, fontWeight: '700' },
  healthSummary: { marginTop: 22, padding: 17, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFEEE8', shadowColor: '#1D3825', shadowOpacity: 0.04, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryEyebrow: { color: colors.leaf, fontSize: 8, fontWeight: '800', letterSpacing: 1.05 },
  summaryTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginTop: 4, letterSpacing: -0.3 },
  sunIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#EAF2E2', alignItems: 'center', justifyContent: 'center' },
  summaryCaption: { fontSize: 10, lineHeight: 15, color: colors.muted, marginTop: 8 },
  nutritionProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  progressTrack: { height: 7, borderRadius: 5, backgroundColor: '#EAECE5', flex: 1, overflow: 'hidden' },
  progressFill: { width: '68%', height: '100%', backgroundColor: '#638C59', borderRadius: 5 },
  progressValue: { fontSize: 10, color: colors.green, fontWeight: '800' },
  miniMetrics: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 13 },
  metricValue: { color: colors.deepGreen, fontSize: 14, fontWeight: '800' },
  metricUnit: { color: colors.leaf, fontSize: 9 },
  metricLabel: { color: colors.muted, fontSize: 8, marginTop: 2 },
  metricDivider: { width: 1, height: 28, backgroundColor: colors.line },
  viewHealth: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#EEF3E9', borderRadius: 9 },
  viewHealthText: { fontSize: 9, color: colors.green, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 13 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', letterSpacing: -0.55 },
  sectionSubtitle: { color: colors.muted, fontSize: 10, marginTop: 4 },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 7, paddingLeft: 8 },
  textActionLabel: { color: colors.green, fontSize: 10, fontWeight: '700' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', columnGap: 14, rowGap: 14 },
  productCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EFE9', shadowColor: '#233423', shadowOpacity: 0.045, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  productImageWrap: { width: '100%', height: 150, position: 'relative', backgroundColor: '#E5E3D8' },
  productTag: { position: 'absolute', top: 10, left: 9, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  productTagText: { fontSize: 7, letterSpacing: 0.45, color: colors.deepGreen, fontWeight: '800' },
  heartButton: { position: 'absolute', top: 9, right: 9, width: 31, height: 31, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.94)', justifyContent: 'center', alignItems: 'center' },
  filledHeart: { position: 'absolute', top: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: '#C3574B' },
  productInfo: { paddingTop: 10, paddingHorizontal: 11 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 9, color: colors.ink, fontWeight: '700' },
  reviewText: { fontSize: 8, color: '#8B8D81' },
  productName: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 6 },
  productVariety: { color: colors.muted, fontSize: 9, marginTop: 3 },
  productBuyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 11 },
  productPrice: { color: colors.deepGreen, fontWeight: '800', fontSize: 14 },
  productOldPrice: { color: '#9A9B90', textDecorationLine: 'line-through', fontSize: 8, marginTop: 1 },
  addIconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.deepGreen, alignItems: 'center', justifyContent: 'center' },
  impactCard: { marginTop: 20, padding: 17, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  impactIcon: { width: 42, height: 42, backgroundColor: '#FFFFFF', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  impactTitle: { color: colors.deepGreen, fontSize: 12, fontWeight: '700' },
  impactText: { color: '#596655', fontSize: 9, lineHeight: 14, marginTop: 3 },
  pageIntro: { marginBottom: 18 },
  pageTitle: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -1.3, marginTop: 6 },
  pageDescription: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 7, maxWidth: 320 },
  categoryRow: { gap: 8, paddingBottom: 14 },
  categoryChip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, backgroundColor: '#ECEBE4' },
  categoryChipActive: { backgroundColor: colors.deepGreen },
  categoryChipText: { fontSize: 10, color: '#51584D', fontWeight: '600' },
  categoryChipTextActive: { color: '#FFFFFF' },
  promiseStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingHorizontal: 10, paddingVertical: 11, backgroundColor: '#E7EFDE', borderRadius: 12, marginBottom: 4 },
  promiseText: { fontSize: 8, fontWeight: '700', color: colors.green },
  promiseDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#93A887', marginHorizontal: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 46, gap: 9 },
  emptyTitle: { fontSize: 16, color: colors.ink, fontWeight: '700' },
  emptyCaption: { textAlign: 'center', color: colors.muted, fontSize: 10, lineHeight: 16, maxWidth: 245 },
  farmBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, marginTop: 19, borderRadius: 17 },
  farmBannerIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  farmBannerTitle: { color: colors.deepGreen, fontSize: 11, fontWeight: '700' },
  farmBannerText: { color: colors.muted, fontSize: 9, marginTop: 4 },
  wellnessBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 13, backgroundColor: '#E8EFDF' },
  wellnessBadgeText: { color: colors.green, fontSize: 8, letterSpacing: 0.8, fontWeight: '800' },
  recommendationsSection: { marginBottom: 9 },
  recommendationCard: { padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFEEE8', marginBottom: 9 },
  recommendationHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  recommendationTitle: { flex: 1, color: colors.deepGreen, fontSize: 12, fontWeight: '700' },
  recommendationRow: { color: '#545B51', fontSize: 10, lineHeight: 15, marginTop: 4 },
  recommendationLabel: { color: colors.ink, fontWeight: '700' },
  recommendationNote: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  recommendationDisclaimer: { color: colors.muted, fontSize: 9, lineHeight: 14, marginHorizontal: 2, marginBottom: 10 },
  wellnessPreferencesCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginTop: 7 },
  preferenceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  preferenceCaption: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  preferenceAction: { color: colors.green, fontSize: 10, fontWeight: '700', padding: 5 },
  profileGoalOption: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, marginTop: 6, borderRadius: 11, backgroundColor: '#F6F6F0', borderWidth: 1, borderColor: 'transparent' },
  profileGoalOptionActive: { backgroundColor: '#EAF1E4', borderColor: '#A6BA98' },
  profileGoalOptionDisabled: { opacity: 0.5 },
  profileGoalLabel: { color: colors.ink, fontSize: 10, flex: 1 },
  profileConsentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 11 },
  profileConsentText: { color: colors.muted, fontSize: 9, lineHeight: 14, flex: 1 },
  preferenceSaveButton: { alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 11, backgroundColor: colors.deepGreen, marginTop: 5 },
  preferenceSaveLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  segmentedTabs: { padding: 4, backgroundColor: '#ECEBE4', borderRadius: 14, flexDirection: 'row', marginBottom: 15 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  segmentActive: { backgroundColor: '#FFFFFF', shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  segmentText: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  segmentTextActive: { color: colors.deepGreen, fontWeight: '700' },
  comparisonCard: { backgroundColor: '#FFFFFF', borderRadius: 19, borderWidth: 1, borderColor: '#EFEEE8', padding: 16, shadowColor: colors.ink, shadowOpacity: 0.04, shadowRadius: 9, elevation: 2 },
  comparisonHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  comparisonTitle: { fontSize: 17, color: colors.ink, fontWeight: '700', marginTop: 4 },
  grainPill: { backgroundColor: '#E8F0E2', borderRadius: 11, paddingHorizontal: 9, paddingVertical: 6 },
  grainPillText: { color: colors.green, fontSize: 8, fontWeight: '700' },
  barMetric: { marginTop: 10 },
  barMetricText: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  barMetricName: { fontSize: 9, color: '#535B50' },
  barMetricValue: { fontSize: 9, color: colors.deepGreen, fontWeight: '700' },
  barMetricOther: { color: '#9A9B90', fontWeight: '400' },
  compareTrack: { height: 7, backgroundColor: '#E5E5DD', borderRadius: 5, overflow: 'hidden' },
  compareFill: { height: '100%', borderRadius: 5 },
  compareLegend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 2 },
  legendLabel: { fontSize: 8, color: colors.muted },
  per100: { color: '#8D8F82', fontSize: 8, marginLeft: 'auto' },
  goalCard: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 17, marginBottom: 11, borderWidth: 1, borderColor: '#EFEEE8', shadowColor: colors.ink, shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalIcon: { width: 39, height: 39, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  goalTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  goalSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 },
  goalStats: { marginTop: 12, backgroundColor: '#F7F6F0', borderRadius: 12, padding: 10, flexDirection: 'row' },
  goalStat: { flex: 1, alignItems: 'center' },
  goalStatValue: { color: colors.deepGreen, fontSize: 13, fontWeight: '800' },
  goalStatLabel: { color: colors.muted, fontSize: 8, marginTop: 3 },
  goalDetail: { fontSize: 10, lineHeight: 16, color: '#52594F', marginTop: 11 },
  verifiedRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedText: { color: colors.leaf, fontSize: 8, flex: 1 },
  learnMore: { color: colors.green, fontSize: 8, fontWeight: '700' },
  assayToggle: { borderTopColor: '#EAE9E1', borderTopWidth: 1, paddingVertical: 15, marginTop: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assayText: { color: colors.green, fontSize: 11, fontWeight: '700' },
  assayContent: { padding: 13, backgroundColor: '#EFEFE6', borderRadius: 13, marginTop: -4, marginBottom: 8 },
  assayBody: { color: colors.muted, fontSize: 9, lineHeight: 15 },
  assayLink: { color: colors.green, fontSize: 9, fontWeight: '700', marginTop: 8 },
  tipCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 19, borderWidth: 1, borderColor: colors.line },
  tipIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#E5F0DC', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  tipText: { color: '#51584D', fontSize: 11, lineHeight: 18, marginTop: 9 },
  tipBullet: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  tipBulletText: { color: colors.ink, fontSize: 10 },
  recipeButton: { backgroundColor: colors.deepGreen, borderRadius: 12, padding: 13, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  recipeButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  wellnessCallout: { backgroundColor: '#E3EFD8', borderRadius: 17, padding: 15, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  wellnessCalloutIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  wellnessCalloutTitle: { color: colors.deepGreen, fontSize: 11, fontWeight: '700' },
  wellnessCalloutText: { color: '#667161', fontSize: 8, marginTop: 3 },
  deliveryBanner: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, backgroundColor: '#E7EFDF', borderRadius: 12, marginBottom: 13 },
  deliveryBannerText: { color: colors.green, fontSize: 9, fontWeight: '600' },
  cartLine: { flexDirection: 'row', padding: 12, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, marginBottom: 10, gap: 12 },
  cartInfo: { flex: 1, justifyContent: 'center' },
  cartName: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  cartSize: { color: colors.muted, fontSize: 9, marginTop: 4 },
  cartPrice: { color: colors.deepGreen, fontSize: 13, fontWeight: '800', marginTop: 7 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 12, padding: 4, borderRadius: 18, backgroundColor: '#F0F0E9', marginTop: 8 },
  quantityButton: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  quantityValue: { minWidth: 15, textAlign: 'center', color: colors.ink, fontSize: 11, fontWeight: '700' },
  impactCardSmall: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#EAF0E2' },
  impactCardSmallText: { color: colors.green, fontSize: 9, fontWeight: '600' },
  orderCard: { marginTop: 13, padding: 16, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line },
  orderTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
  orderLabel: { color: colors.muted, fontSize: 10 },
  orderValue: { color: colors.ink, fontSize: 10, fontWeight: '600' },
  freeDelivery: { color: colors.green, fontSize: 9, fontWeight: '700' },
  orderDivider: { height: 1, backgroundColor: colors.line, marginVertical: 9 },
  orderTotalLabel: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  orderTotal: { color: colors.deepGreen, fontSize: 16, fontWeight: '800' },
  checkoutButton: { backgroundColor: colors.deepGreen, borderRadius: 13, paddingVertical: 14, marginTop: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  checkoutButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  checkoutDisabled: { opacity: 0.5 },
  secureNote: { color: colors.muted, textAlign: 'center', marginTop: 10, fontSize: 8 },
  emptyBag: { alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 23, paddingVertical: 27 },
  emptyBagIcon: { width: 61, height: 61, borderRadius: 21, backgroundColor: '#E8F0DF', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  primaryButton: { borderRadius: 12, backgroundColor: colors.deepGreen, paddingHorizontal: 17, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 17 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  checkoutCard: { alignItems: 'center', padding: 24, borderRadius: 20, backgroundColor: '#FFFFFF', borderColor: colors.line, borderWidth: 1 },
  checkoutIcon: { width: 59, height: 59, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  checkoutTitle: { color: colors.ink, fontSize: 19, fontWeight: '700', marginTop: 13 },
  checkoutText: { color: colors.muted, textAlign: 'center', lineHeight: 17, fontSize: 10, marginTop: 7 },
  profileHero: { borderRadius: 20, overflow: 'hidden' },
  profileCover: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 15 },
  profileMonogram: { width: 56, height: 56, borderRadius: 21, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#DCE8D3', alignItems: 'center', justifyContent: 'center' },
  profileTitle: { color: colors.deepGreen, fontSize: 20, fontWeight: '700', letterSpacing: -0.6, marginTop: 11 },
  profileSubtitle: { color: colors.muted, fontSize: 10, marginTop: 4 },
  memberBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.72)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  memberText: { color: colors.green, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  memberCard: { marginTop: 13, borderRadius: 17, backgroundColor: '#FFFFFF', padding: 15, borderWidth: 1, borderColor: colors.line },
  memberCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberEyebrow: { color: colors.leaf, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  memberScore: { color: colors.deepGreen, fontSize: 20, fontWeight: '800', marginTop: 4 },
  memberPoints: { color: colors.muted, fontSize: 10, fontWeight: '500' },
  giftIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#E8F0DF', alignItems: 'center', justifyContent: 'center' },
  memberProgressTrack: { height: 6, backgroundColor: '#EBEBE3', borderRadius: 4, marginTop: 11, overflow: 'hidden' },
  memberProgressFill: { width: '40%', height: '100%', backgroundColor: '#769A66', borderRadius: 4 },
  memberFootnote: { color: colors.muted, fontSize: 8, marginTop: 7 },
  menuCard: { paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line },
  menuRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0EFE8' },
  menuIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#EEF2E8', alignItems: 'center', justifyContent: 'center' },
  menuTitle: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  menuCaption: { color: colors.muted, fontSize: 8, marginTop: 3 },
  profileFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 20, paddingVertical: 9 },
  profileFooterText: { color: colors.leaf, fontSize: 10, fontWeight: '600' },
  bottomNav: { minHeight: 68, flexDirection: 'row', backgroundColor: '#FCFBF7', borderTopColor: '#EDECE5', borderTopWidth: 1, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 4, justifyContent: 'space-around', alignItems: 'center' },
  navItem: { minWidth: 57, alignItems: 'center', justifyContent: 'center', gap: 1 },
  navIconWrap: { width: 35, height: 30, borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  navIconWrapActive: { backgroundColor: '#E7EFDF' },
  navBadge: { position: 'absolute', top: -2, right: -2, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FCFBF7' },
  navBadgeText: { color: '#FFFFFF', fontSize: 7, fontWeight: '800' },
  navLabel: { color: '#747970', fontSize: 8, fontWeight: '500' },
  navLabelActive: { color: colors.deepGreen, fontWeight: '700' },
  navActiveDot: { position: 'absolute', bottom: -4, width: 3, height: 3, borderRadius: 2, backgroundColor: colors.green },
  toast: { position: 'absolute', bottom: 81, left: 24, right: 24, backgroundColor: colors.deepGreen, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 10, elevation: 5 },
  toastText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', flexShrink: 1 },
  backendErrorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginTop: 10, padding: 11, backgroundColor: '#FBEAE5', borderRadius: 11 },
  backendErrorText: { color: '#8F3424', fontSize: 9, lineHeight: 14, flex: 1 },
  setupScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: colors.pale },
  setupIcon: { width: 66, height: 66, borderRadius: 23, backgroundColor: '#E5EFDC', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  setupTitle: { color: colors.deepGreen, textAlign: 'center', fontSize: 21, lineHeight: 27, fontWeight: '800', marginBottom: 10 },
  setupBody: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 18, marginBottom: 7 },
  setupButton: { backgroundColor: colors.deepGreen, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 14 },
  setupButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  campaignCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 16, marginBottom: 12 },
  campaignTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  campaignIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E8F0DF', alignItems: 'center', justifyContent: 'center' },
  campaignType: { color: colors.leaf, fontSize: 8, letterSpacing: 0.75, fontWeight: '800', flex: 1 },
  campaignTitle: { color: colors.deepGreen, fontSize: 16, fontWeight: '800', marginTop: 12 },
  campaignDescription: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
  campaignGoal: { color: colors.green, fontSize: 9, fontWeight: '600', marginTop: 9 },
  campaignReward: { color: colors.ink, fontSize: 9, marginTop: 7 },
  campaignDiscount: { color: colors.deepGreen, fontSize: 12, fontWeight: '800', marginTop: 8 },
  challengeProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  challengeProgressText: { color: colors.green, fontSize: 9, fontWeight: '600' },
  challengeTrack: { height: 6, backgroundColor: '#EAECE4', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  challengeFill: { height: '100%', backgroundColor: '#769A66', borderRadius: 4 },
  campaignActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  campaignPrimaryButton: { backgroundColor: colors.deepGreen, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  campaignPrimaryLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  campaignTextButton: { paddingHorizontal: 9, paddingVertical: 10, marginTop: 13 },
  campaignTextLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  campaignProgressText: { color: colors.green, fontSize: 9, fontWeight: '600' },
  detailSafe: { flex: 1, backgroundColor: colors.pale },
  detailHeader: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, justifyContent: 'space-between', borderBottomColor: colors.line, borderBottomWidth: 1 },
  backButton: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center' },
  brandMarkSmall: { width: 29, height: 29, borderRadius: 11, backgroundColor: '#E5EFDC', alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  detailHeaderTitle: { flex: 1, marginLeft: 9, fontSize: 13, color: colors.ink, fontWeight: '700' },
  detailScroll: { paddingHorizontal: 17, paddingTop: 13, paddingBottom: 22 },
  detailHero: { height: 233, borderRadius: 21, overflow: 'hidden', backgroundColor: '#E4E2D6' },
  detailImageShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, padding: 15, justifyContent: 'space-between', alignItems: 'flex-start' },
  organicBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: 'rgba(23,62,37,0.9)' },
  organicBadgeText: { color: '#FFFFFF', fontSize: 8, letterSpacing: 0.7, fontWeight: '800' },
  detailRating: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7 },
  detailRatingText: { color: colors.ink, fontSize: 9, fontWeight: '700' },
  detailImageCaption: { color: '#FFFFFF', fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.5 },
  detailIntro: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, marginTop: 13, borderWidth: 1, borderColor: colors.line },
  detailKicker: { color: colors.leaf, fontSize: 8, fontWeight: '800', letterSpacing: 1.05 },
  detailName: { color: colors.ink, fontSize: 22, lineHeight: 28, letterSpacing: -0.8, fontWeight: '800', marginTop: 6 },
  detailVariety: { color: colors.muted, fontSize: 9, marginTop: 4 },
  detailDescription: { color: '#555B51', fontSize: 10, lineHeight: 17, marginTop: 11 },
  benefitPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  benefitPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 13, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#F0F0E9' },
  benefitText: { color: '#555B51', fontSize: 8 },
  detailSection: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 18, marginTop: 13, borderWidth: 1, borderColor: colors.line },
  detailSectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailSectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginTop: 4, letterSpacing: -0.3 },
  harvestNote: { color: colors.green, fontSize: 8, backgroundColor: '#EDF1E5', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 11 },
  sizeOptions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  sizeOption: { flex: 1, minHeight: 61, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#F3F2EC', borderWidth: 1, borderColor: 'transparent' },
  sizeOptionActive: { backgroundColor: '#E9F0E2', borderColor: '#8AA47D' },
  sizeOptionTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  sizeOptionTitleActive: { color: colors.deepGreen },
  sizeOptionPrice: { color: colors.muted, fontSize: 9, marginTop: 4 },
  sizeOptionPriceActive: { color: colors.green },
  popularTag: { position: 'absolute', top: -7, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.green },
  popularTagText: { color: '#FFFFFF', fontSize: 6, fontWeight: '800', letterSpacing: 0.5 },
  detailQuantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  detailQuantityLabel: { color: colors.muted, fontSize: 10 },
  perServingNote: { color: colors.muted, fontSize: 8, marginTop: 5, marginBottom: 7 },
  nutrientRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', borderTopColor: '#F0EFEA', borderTopWidth: 1, gap: 8 },
  nutrientBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#739268' },
  nutrientLabel: { flex: 1, color: '#555B51', fontSize: 10 },
  nutrientValue: { color: colors.deepGreen, fontSize: 10, fontWeight: '700' },
  provenanceCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, marginTop: 13, borderRadius: 16, backgroundColor: '#EAEFE2' },
  provenanceTitle: { color: colors.deepGreen, fontSize: 10, fontWeight: '700' },
  provenanceCopy: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 3 },
  detailBottom: { minHeight: 73, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  detailBottomPrice: { color: colors.deepGreen, fontSize: 20, fontWeight: '800', letterSpacing: -0.6 },
  detailBottomNote: { color: colors.leaf, fontSize: 8, marginTop: 3 },
  detailAddButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 13, backgroundColor: colors.deepGreen },
  detailAddText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
