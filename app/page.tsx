'use client';

import { SimulatorFeature } from './features/simulator/SimulatorFeature';
import { ModalProvider } from './providers';

export default function Home() {
  return (
    <ModalProvider>
      <main className="h-screen w-screen overflow-hidden">
        <SimulatorFeature />
      </main>
    </ModalProvider>
  );
}
