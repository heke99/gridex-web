import React, { useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MobileBrand } from '../../../packages/mobile-foundation/src/brand';

const tabs = ['Hem', 'Elpriser', 'Förbrukning', 'Avtal', 'Mer'] as const;
type Tab = typeof tabs[number];
const copy: Record<Tab, { title: string; body: string }> = {
  Hem: { title: 'Din el. Samlad på ett ställe.', body: 'Här får du överblick över dina avtal, din förbrukning och dina fakturor.' },
  Elpriser: { title: 'Följ elpriset', body: 'Se dagens publicerade spotpriser för ditt elområde. Ditt avtalspris kan innehålla andra avgifter.' },
  Förbrukning: { title: 'Förstå din förbrukning', body: 'Logga in för att se mätvärden för dina egna anläggningar.' },
  Avtal: { title: 'Dina elavtal', body: 'Se dina avtal i Mina sidor eller fortsätt till webbplatsen för att teckna och hantera avtal.' },
  Mer: { title: 'Vi hjälper dig', body: 'Fakturor, dokument, kontaktuppgifter och support samlas här.' },
};

/** Presentation-only shell. Never treats a chosen brand as authorization. */
export function EnergyAppShell({ brand, customerPanel, contractPanel, pricePanel }: { brand: MobileBrand; customerPanel?: React.ReactNode | ((tab: Tab) => React.ReactNode); contractPanel?: React.ReactNode; pricePanel?: React.ReactNode }) {
  const [active, setActive] = useState<Tab>('Hem');
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const openTab = (tab: Tab) => {
    setActive(tab);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const t = brand.theme;
  const insets = useSafeAreaInsets();
  return <View style={[styles.root, { backgroundColor: t.canvas, paddingTop: insets.top + 12, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <StatusBar barStyle="light-content" />
    <ScrollView ref={scroll} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={[styles.brand, { color: t.accent }]}>{brand.displayName}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>{copy[active].title}</Text>
      <Text style={[styles.body, { color: t.muted }]}>{copy[active].body}</Text>
      {active === 'Elpriser' && pricePanel}
      {(active === 'Hem' || active === 'Avtal') && contractPanel}
      {(typeof customerPanel === 'function' ? customerPanel(active) : customerPanel) ?? <View style={[styles.card, { backgroundColor: t.surface }]}>
        <Text style={[styles.cardTitle, { color: t.text }]}>Mobilappen tar form</Text>
        <Text style={[styles.body, { color: t.muted }]}>Kundinloggning och anslutning till dina uppgifter är inte aktiverade i denna testversion.</Text>
      </View>}
      {active === 'Hem' && <View style={styles.tiles}>
        {(['Elpriser', 'Förbrukning', 'Avtal'] as const).map(tab => <Pressable key={tab} accessibilityRole="button" onPress={() => openTab(tab)} style={[styles.tile, { borderColor: t.muted }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>{tab}</Text>
          <Text style={{ color: t.accent }}>Öppna →</Text>
        </Pressable>)}
      </View>}
    </ScrollView>
    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: t.surface }]}>
      {tabs.map(tab => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: tab === active }} onPress={() => openTab(tab)} style={styles.tab}>
        <Text style={{ color: tab === active ? t.accent : t.muted, fontSize: 12, fontWeight: tab === active ? '700' : '400' }}>{tab}</Text>
      </Pressable>)}
    </View>
    {Platform.OS === 'ios' && <InputAccessoryView nativeID="gridex-keyboard-tools">
      <View style={{ backgroundColor: t.surface, alignItems: 'flex-end', paddingHorizontal: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Stäng tangentbord" onPress={Keyboard.dismiss} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 }}>
          <Text style={{ color: t.accent, fontWeight: '600' }}>Klart</Text>
        </Pressable>
      </View>
    </InputAccessoryView>}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 32, gap: 20 },
  brand: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1, lineHeight: 40 },
  body: { fontSize: 16, lineHeight: 25 },
  card: { padding: 24, borderRadius: 20, gap: 12, marginTop: 12 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  tiles: { gap: 12 },
  tile: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10 },
  tabs: { flexDirection: 'row', paddingVertical: 8 },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
});
