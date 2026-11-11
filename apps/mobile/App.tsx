import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { gridexBrand } from './brands/gridex.mjs';
import { EnergyAppShell } from './src/EnergyAppShell';
import { MarketPrices } from './src/MarketPrices';
import { ContractActions } from './src/ContractActions';
import { customerApi, customerWebOrigin } from './src/accountClient';
import { CustomerAccess } from './src/CustomerAccess';

export default function App() {
  return <SafeAreaProvider><EnergyAppShell brand={gridexBrand} pricePanel={<MarketPrices origin={customerApi ?? 'https://gridex.se'} theme={gridexBrand.theme}/>} contractPanel={<ContractActions origin={customerWebOrigin ?? 'https://gridex.se'} theme={gridexBrand.theme} />} customerPanel={tab => <CustomerAccess brand={gridexBrand} consumption={tab === 'Förbrukning'} />} /></SafeAreaProvider>;
}
