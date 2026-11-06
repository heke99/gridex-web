import React, { useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import type { MobileBrand } from '../../../packages/mobile-foundation/src/brand';

const tabs = ['Hem', 'Elpriser', 'Förbrukning', 'Avtal', 'Mer'] as const;
type Tab = typeof tabs[number];
const copy: Record<Tab, { title: string; body: string }> = {
  Hem: { title: 'Din el. Samlad på ett ställe.', body: 'Här får du överblick över dina avtal, din förbrukning och dina fakturor.' },
  Elpriser: { title: 'Följ elpriset', body: 'När pristjänsten är ansluten visas aktuella priser och deras källa här.' },
  Förbrukning: { title: 'Förstå din förbrukning', body: 'Logga in för att se mätvärden för dina egna anläggningar.' },
  Avtal: { title: 'Dina elavtal', body: 'Här ska du kunna se dina avtal, teckna nytt och följa ett avtalsbyte.' },
  Mer: { title: 'Vi hjälper dig', body: 'Fakturor, dokument, kontaktuppgifter och support samlas här.' },
};

/** Presentation-only shell. Never treats a chosen brand as authorization. */
export function EnergyAppShell({ brand }: { brand: MobileBrand }) {
  const [active, setActive] = useState<Tab>('Hem');
  const t = brand.theme;
  return <View style={[styles.root, { backgroundColor: t.canvas }]}>
    <StatusBar barStyle="light-content" />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.brand, { color: t.accent }]}>{brand.displayName}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>{copy[active].title}</Text>
      <Text style={[styles.body, { color: t.muted }]}>{copy[active].body}</Text>
      <View style={[styles.card, { backgroundColor: t.surface }]}>
        <Text style={[styles.cardTitle, { color: t.text }]}>Mobilappen tar form</Text>
        <Text style={[styles.body, { color: t.muted }]}>Kundinloggning och anslutning till dina uppgifter är inte aktiverade i denna testversion.</Text>
      </View>
      {active === 'Hem' && <View style={styles.tiles}>
        {(['Elpriser', 'Förbrukning', 'Avtal'] as const).map(tab => <Pressable key={tab} accessibilityRole="button" onPress={() => setActive(tab)} style={[styles.tile, { borderColor: t.muted }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>{tab}</Text>
          <Text style={{ color: t.accent }}>Öppna →</Text>
        </Pressable>)}
      </View>}
    </ScrollView>
    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: t.surface }]}>
      {tabs.map(tab => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: tab === active }} onPress={() => setActive(tab)} style={styles.tab}>
        <Text style={{ color: tab === active ? t.accent : t.muted, fontSize: 12, fontWeight: tab === active ? '700' : '400' }}>{tab}</Text>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 56, paddingBottom: 28 },
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
