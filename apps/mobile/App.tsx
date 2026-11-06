import React from 'react';
import { gridexBrand } from './brands/gridex.mjs';
import { EnergyAppShell } from './src/EnergyAppShell';
import { ContractActions } from './src/ContractActions';
import { customerApi } from './src/accountClient';
import { CustomerAccess } from './src/CustomerAccess';

export default function App() {
  return <EnergyAppShell brand={gridexBrand} contractPanel={<ContractActions origin={customerApi ?? 'https://gridex.se'} theme={gridexBrand.theme} />} customerPanel={<CustomerAccess brand={gridexBrand} />} />;
}
