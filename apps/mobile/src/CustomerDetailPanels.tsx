import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MobileTheme } from '../../../packages/mobile-foundation/src/brand';
import type { InvoiceDetail, SupportDetail } from '../../../packages/mobile-foundation/src/customerDetails';
const amount = (value: number | null, currency: string | null) => value === null ? 'Uppgift saknas' : `${value.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} ${currency ?? '(valuta saknas)'}`;

export function InvoicePanel({ invoice, theme: t, busy, openDocument, back }: { invoice: InvoiceDetail; theme: MobileTheme; busy: boolean; openDocument: (reference: string) => void; back: () => void }) {
  const text = { color: t.text }; const muted = { color: t.muted };
  return <View style={{ gap: 14 }}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={back} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>← Alla fakturor</Text></Pressable>
    <Text accessibilityRole="header" style={[text, { fontSize: 22 }]}>Faktura {invoice.number ?? invoice.reference}</Text>
    <Text style={text}>Totalt inklusive moms: {amount(invoice.amount, invoice.currency)}</Text>
    <Text style={muted}>Status: {invoice.status ?? 'Uppgift saknas'}</Text>
    <Text style={muted}>Förfallodag: {invoice.dueDate ?? 'Uppgift saknas'}</Text>
    <Text style={muted}>Fakturadatum: {invoice.issuedAt ?? 'Uppgift saknas'}</Text>
    <Text style={muted}>Period: {invoice.periodStart ?? '—'} – {invoice.periodEnd ?? '—'}</Text>
    <Text accessibilityRole="header" style={[text, { fontSize: 18 }]}>Fakturarader</Text>
    {invoice.lines.length === 0 && <Text style={muted}>Inga fakturarader finns att visa.</Text>}
    {invoice.lines.map(line => <View key={line.reference} style={{ gap: 5, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.muted }}>
      <Text style={[text, { fontWeight: '600' }]}>{line.description ?? 'Fakturarad'}</Text>
      <Text style={muted}>Antal: {line.quantity ?? 'Uppgift saknas'}</Text>
      <Text style={muted}>À-pris: {amount(line.unitPrice, invoice.currency)}</Text>
      <Text style={muted}>Exklusive moms: {amount(line.amountExVat, invoice.currency)}</Text>
      <Text style={muted}>Moms: {amount(line.vatAmount, invoice.currency)}</Text>
      <Text style={text}>Inklusive moms: {amount(line.amountIncVat, invoice.currency)}</Text>
    </View>)}
    <Text accessibilityRole="header" style={[text, { fontSize: 18 }]}>Dokument</Text>
    {invoice.documents.length === 0 && <Text style={muted}>Inga dokument finns att visa.</Text>}
    {invoice.documents.map(doc => <View key={doc.reference} style={{ gap: 6 }}>
      <Text style={text}>{doc.title ?? 'Fakturadokument'}</Text>
      {doc.available ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => openDocument(doc.reference)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Öppna dokument i extern läsare</Text></Pressable> : <Text style={muted}>Dokumentet är inte tillgängligt i appen.</Text>}
    </View>)}
  </View>;
}

export function SupportPanel({ detail, theme: t, busy, back, openWeb }: { detail: SupportDetail; theme: MobileTheme; busy: boolean; back: () => void; openWeb: () => void }) {
  return <View style={{ gap: 14 }}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={back} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>← Alla ärenden</Text></Pressable>
    <Text accessibilityRole="header" style={{ color: t.text, fontSize: 22 }}>{detail.title}</Text>
    <Text style={{ color: t.muted }}>Status: {detail.status}</Text>
    {detail.description && <Text style={{ color: t.text }}>{detail.description}</Text>}
    <Text accessibilityRole="header" style={{ color: t.text, fontSize: 18 }}>Meddelanden</Text>
    {detail.messages.length === 0 && <Text style={{ color: t.muted }}>Inga meddelanden finns att visa.</Text>}
    {detail.messages.map(message => <View key={message.reference} style={{ gap: 6, paddingVertical: 10 }}>
      <Text style={{ color: t.accent }}>{message.author === 'customer' ? 'Du' : 'Kundservice'}{message.kind === 'phone_summary' ? ' · Telefonsammanfattning' : ''}</Text>
      {message.createdAt && <Text style={{ color: t.muted }}>{message.createdAt}</Text>}
      <Text style={{ color: t.text, fontSize: 16, lineHeight: 24 }}>{message.body}</Text>
    </View>)}
    {detail.moreMessages !== false && <Text style={{ color: t.muted }}>{detail.moreMessages === true ? 'Fler meddelanden finns. Du kan också öppna ärendet på Mina sidor på webben.' : 'Här visas de meddelanden som finns tillgängliga för appen.'}</Text>}
    <Pressable accessibilityRole="link" disabled={busy} onPress={openWeb} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Öppna kundservice på webben</Text></Pressable>
  </View>;
}
