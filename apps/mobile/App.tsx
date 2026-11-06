import React from 'react';
import { gridexBrand } from './brands/gridex.mjs';
import { EnergyAppShell } from './src/EnergyAppShell';

export default function App() {
  return <EnergyAppShell brand={gridexBrand} />;
}
