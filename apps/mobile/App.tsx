import React from 'react';
import { gridexBrand } from './brands/gridex.mjs';
import { EnergyAppShell } from './src/EnergyAppShell';
import { CustomerAccess } from './src/CustomerAccess';

export default function App() {
  return <EnergyAppShell brand={gridexBrand} customerPanel={<CustomerAccess brand={gridexBrand} />} />;
}
