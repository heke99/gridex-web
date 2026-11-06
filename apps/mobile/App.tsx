import React from 'react';
import { gridexBrand } from './brands/gridex.mjs';
import { EnergyAppShell } from './src/EnergyAppShell';
import { MarketPrices } from './src/MarketPrices';
import { ContractActions } from './src/ContractActions';
import { customerApi } from './src/accountClient';
import { CustomerAccess } from './src/CustomerAccess';

export default function App() {
  return <EnergyAppShell brand={gridexBrand} pricePanel={<MarketPrices origin={customerApi ?? 'https://gridex.se'} theme={gridexBrand.theme}/>} contractPanel={<ContractActions origin={customerApi ?? 'https://gridex.se'} theme={gridexBrand.theme} />} customerPanel={<CustomerAccess brand={gridexBrand} />} />;
}
